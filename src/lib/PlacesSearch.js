'use strict';

// This class searches the Places DB for us, answering these questions:
// - Given a user-typed string, are there matching history entries?
// - Given a retrieved history entry, is it a bookmark? a currently-open tab?
//
// Our main query is a simplified version of the default query used in the
// existing autocomplete code, which is very similar across both the new
// (UnifiedComplete) and old (nsPlacesAutoComplete) implementations in FF.
//
// Non-optimizations to consider when/if we optimize for performance:
// - Existing code stores its own list of all open windows in an in-memory
//   SQLite table. I have no idea how the performance compares to just using
//   the global list of windows/tabs maintained by nsSessionStore.
// - We don't worry about Places keywords or tags. This includes ignoring
//   special characters like '^', which can be used to limit searches to
//   subsets of history--definitely not a mainstream feature.
// - We don't worry about adaptive searches, or really, nearly any of the
//   edge cases explicitly considered here:
//   https://dxr.mozilla.org/mozilla-central/source/ (url continues)
//     toolkit/components/places/UnifiedComplete.js#865-874
// - UnifiedComplete does large multi-joins, rather than a series of simple
//   queries. I'm not sure what performance gains are possible with
//   more complex queries, but I don't expect much from SQLite in terms of
//   query planning and execution. We also don't have a remote DB, so the
//   common network latency issues don't apply. Basically, it'll be neat
//   to get some hard numbers around this later.
// - We don't worry about whether a query was typed by the user or not.
//   This corresponds to BOOKMARKED_HOST_QUERY and related constants in the 
//   existing code.

/* global Components, PlacesUtils, Services, SessionStore, Task, XPCOMUtils */

const {utils: Cu, interfaces: Ci, classes: Cc} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'console',
  'resource://gre/modules/devtools/Console.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'PlacesUtils',
  'resource://gre/modules/PlacesUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services',
  'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'SessionStore',
  'resource:///modules/sessionstore/SessionStore.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Task',
  'resource://gre/modules/Task.jsm');

const EXPORTED_SYMBOLS = ['PlacesSearch'];

const PlacesSearch = {

  // This function returns the base history query used by the existing
  // autocomplete code. Given an optional SQL query fragment (`conditions`),
  // which we don't currently use, return a SQL query which fetches fuzzy
  // matches from the Places DB, sorted in frecency order.
  //
  // Frecency is a decaying measure of frequency + recency of visits to a URL.
  // It is an integer >= 0, with no maximum value. Its value is roughly:
  //   frecency = (visit_count * visit_type) for the 10 most recent visits,
  // where visit_type is based on whether the URL was typed, clicked, etc. The
  // detailed weighting behavior is defined in nsNavHistory, and is driven by a
  // huge number of configurable preferences given there.
  //
  // Frecency decays by 0.975 per day, so that the value for a given site drops
  // by half if the page is not visited for 28 days. nsNavHistory::DecayFrecency
  // contains the implementation and additional details.
  //
  // See also MDN: https://mdn.io/Frecency_algorithm.
  //
  // The actual frecency calculation is in components/places/SQLFunctions.cpp.
  //
  // AUTOCOMPLETE_MATCH is a sqlite function defined in SQLFunctions.cpp.
  defaultQuery: function(conditions = '') {

    // Start by defining some constants used in the search:

    // This constant corresponds to the :query_type variable, which could take
    // any of these values:
    //   - QUERYTYPE_FILTERED, used by the main search query and adaptive query
    //   - QUERYTYPE_AUTOFILL_HOST, used for urlbar autofill of domain names,
    //   - QUERYTYPE_AUTOFILL_URL, used for urlbar autofill of complete urls.
    // Since we're not concerned with autofilling the urlbar, QUERYTYPE_FILTERED
    // seems like the clear choice.
    // This constant is defined in UnifiedComplete, not in any interface, so
    // we'll just assign its numeric value directly here.
    const QUERY_TYPE = 0; // QUERYTYPE_FILTERED

    // This constant corresponds to the :matchBehavior variable, which is passed
    // to the AUTOCOMPLETE_MATCH function.
    //   - It specifies where to match within a searchable term: anywhere, at
    //     the beginning of the term, on word boundaries within the term, or a
    //     few other options. 
    //   - We use the default value, MATCH_BOUNDARY, which matches on word
    //     boundaries within each searchable term.
    //   - See the MATCH_* constants in mozIPlacesAutoComplete.idl for more.
    const MATCH_BEHAVIOR = Ci.mozIPlacesAutoComplete.MATCH_BOUNDARY;

    // This constant corresponds to the :searchBehavior variable, also passed to
    // the AUTOCOMPLETE_MATCH function. Unlike matchBehavior, we construct this
    // value by adding up options, C-style (that is, via bitwise OR).
    //   - It specifies which fields to search out of history, bookmarks, tags,
    //     page titles, page URLs, typed pages, javascript: URLs, currently-open
    //     pages, and whether to include search suggestions.
    //   - It also specifies whether to use the union or intersection of places
    //     fields for the 'restrict' case (not sure, but seems like this is used
    //     to narrow searches where the input is an empty string).
    //   - See the BEHAVIOR_* constants in mozIPlacesAutoComplete.idl for more.
    //   - The behavior constants are bitwise OR-ed together, look at how
    //     store._defaultBehavior is constructed in UnifiedComplete.
    //   - In our case, we want to search history, bookmarks, tags, page titles,
    //     page URLs, and typed pages, but not javascript URLs, currently-open
    //     pages (because, unlike the existing code, we don't track open tabs
    //     in a SQLite temp table--we use a simpler approach, see isOpen below),
    //     or search suggestions (because we separately query the search
    //     suggestion service). So, the correct value is:
    //       BEHAVIOR_HISTORY and BEHAVIOR_BOOKMARK and ...,
    //     which is a number constructed by taking the bitwise OR of the values
    //     of those BEHAVIOR_* constants:
    //       1 << 0 | 1 << 1 | 1 << 2 | 1 << 3 | 1 << 4 | 1 << 5 = 63.
    const SEARCH_BEHAVIOR = 63;

    // This subquery can't be omitted: it yields several booleans that we have
    // to pass to the AUTOCOMPLETE_MATCH function, namely, 'bookmarked', 'tags',
    // and 'btitle'.
    const SQL_BOOKMARK_TAGS_FRAGMENT =
      `EXISTS(SELECT 1 FROM moz_bookmarks WHERE fk = h.id) AS bookmarked,
       ( SELECT title FROM moz_bookmarks WHERE fk = h.id AND title NOTNULL
         ORDER BY lastModified DESC LIMIT 1
       ) AS btitle,
       ( SELECT GROUP_CONCAT(t.title, ', ')
         FROM moz_bookmarks b
         JOIN moz_bookmarks t ON t.id = +b.parent AND t.parent = :parent
         WHERE b.fk = h.id
       ) AS tags`;

    // TODO: t.open_count isn't a thing! so we set it to zero...
    let query =
      `SELECT ${QUERY_TYPE}, h.url, h.title, f.url, ${SQL_BOOKMARK_TAGS_FRAGMENT},
              h.visit_count, h.typed, h.id, h.frecency
       FROM moz_places h
       LEFT JOIN moz_favicons f ON f.id = h.favicon_id
       WHERE h.frecency <> 0
         AND AUTOCOMPLETE_MATCH(:searchString, h.url,
                                IFNULL(btitle, h.title), tags,
                                h.visit_count, h.typed,
                                bookmarked, /* t.open_count, */ 0,
                                ${MATCH_BEHAVIOR}, ${SEARCH_BEHAVIOR})
         ${conditions}
       ORDER BY h.frecency DESC, h.id DESC
       LIMIT :maxResults`;
    return query;
  },

  // Check whether a given URL is already an open tab.
  //
  // If anything goes wrong, return a falsy value.
  //
  // Note: we don't currently attempt to canonicalize the urls in any way, so we
  // might see false negatives due to variants like http vs https, www vs no www,
  // query strings, or hashes.
  isOpen: function(url) {
    const openUrls = [];
    let browserState;

    // Get a list of all open tabs from nsSessionStore, then look for the specified
    // url in the list.
    // If anything goes wrong with parsing the browser state JSON, just give up
    // and return a falsy value.
    try {
      browserState = JSON.parse(SessionStore.getBrowserState());
    } catch (ex) {}

    if (!browserState) {
      return;
    }

    // Iterate over open windows, and open tabs in each window, and grab the
    // first URL in each tab entry. I assume other entries listings would
    // correspond to iframes or frames, neither of which we care about.
    browserState.windows.forEach((w) => {
      w.tabs.forEach((t) => {
        openUrls.push(t.entries[0].url);
      });
    });

    return openUrls.indexOf(url) > -1;
  },

  // Check whether a given URL is bookmarked or not.
  //
  // This *might* turn out to be slow, but it sure is simple to read ;-)
  isBookmarked: function(url) {
    // Create an nsIURI object, expected by the bookmarks service.
    // The nice thing is that this will clean up the url a bit, e.g.
    // it normalizes trailing slashes for us.
    try {
      let fancyUrl = Services.io.newURI(url, null, null);
    } catch (ex) {
      // newURI throws for some URIs; give up if that happens.
      return false;
    }

    return PlacesUtils.bookmarks.isBookmarked(fancyUrl);
  },

  // public API, search wrapper. 
  // manages throttling / debouncing, and canceling old requests
  search: Task.async(function* (searchString) {
    // what's the very simplest starting point?
    // 1. get a DB connection
    // 2. call defaultQuery to get the SQL
    // 3. execute the SQL, passing in {searchString: query, maxResults:20}
    // 4. return the result to the caller, which will be the popup.
    // don't worry about debouncing.
    // don't worry about canceling in-flight.
    // here we go:

    let db = yield PlacesUtils.promiseDBConnection();
    const query = this.defaultQuery();
    const params = {
      searchString: searchString,
      maxResults: 20
    };

    let result = yield db.execute(query, params);

    // result rows are not pleasant to work with.
    // let's just console.log and see how it goes.
    console.log(result);
    yield result;

    // ideas for a nice, robust version:
    // what's the simplest way to handle a bunch of keystrokes?
    // throttle/debounce and pause 20msec each time.
    // how do we handle late replies?
    // set a timestamp and if the response is too old, ignore it.
    // but yeah, do this in the morning.
  }),

  // main search function
  // TODO this needs to be cancelable in flight
  _search: function(query) {
    // trim string
    // unescape encoded URI string, see nsPlacesAutoComplete.fixupSearchText
    // look for string in Places (limit to 10 results? 6 results?)
    // - the query does include a favicon check, but we could simplify further
    //   by pulling that out to top level
    // look up bookmarks info for top 6
    // look up whether it's open for top 6
    // send top 6 to iframe
    
  }

};
