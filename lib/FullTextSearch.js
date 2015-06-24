'use strict';

XPCOMUtils.defineLazyServiceGetter(this, 'historyService',
  '@mozilla.org/browser/nav-history-service;1', 'nsINavHistoryService');
XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode",
  "resource://gre/modules/ReaderMode.jsm");

XPCOMUtils.defineLazyModuleGetter(this, 'lunr',
  'chrome://universalsearch-lib/vendor/lunr.js');
XPCOMUtils.defineLazyModuleGetter(this, 'readability',
  'chrome://universalsearch-lib/vendor/readability.js');

var EXPORTED_SYMBOLS = 'HistoryFullTextSearch';

// TODO: save index to disk / import from disk
// TODO: add a history listener to scrape this as we go
// TODO: figure out how to build a complete full-text database

// do it like this:
// 
// zz = lunr.Index.load(index.toJSON())

// 1. HistoryFullTextSearch:
// - if the search index file exists, use it
// - if not, create the DB, save it to disk, and use it
//

// TODO: figure out how to serialize this and deserialize this


var FullTextDB = function() {};
FullTextDB.prototype = {
  // the main externally-visible API, except for load / save to disk.
  //
  // - grab the user's recent history
  // - scrape each URL
  // - throw the results into solr
  // - save the thing to disk
  //
  // - expose the result
  // - 
  importHistory: function() {



  },
  // 1. scrape all your history, start with most recent 100 pages
  //    todo: or should we just start with the most visited 100 pages?
  //    snippet nabbed from: https://developer.mozilla.org/Mozilla/Tech/Places/Querying#Using_the_results
  _getRecentHistory: function() {
    var query = historyService.getNewQuery();
    var options = historyService.getNewQueryOptions();

    options.sortingMode = options.SORT_BY_DATE_DESCENDING;
    options.resultType = options.RESULTS_AS_URI;
    options.maxResults = 100;

    var result = historyService.executeQuery(query, options);

    var cont = result.root;
    cont.containerOpen = true;

    var recentPages = [];
    for (var i = 0; i < cont.childCount; i++) {
      var node = cont.getChild(i);
      recentPages.push(node.uri);
    }
    cont.containerOpen = false;
    return recentPages;
  },

  // 2. grab the page and scrape it - we can use the ReaderMode service
  // ReaderMode returns a Promise, so deal with that.
  scrapeURL: function(rawURL, cb) {
    ReaderMode.downloadAndParseDocument(rawURL)
      .then(function(result) {
        cb(result);
      }, function(err) {
        throw err;
      });
  },

  // TODO: specify the index when you query something?
  var idx;

  // 3. chuck it into lunr
  var initLunr = function() {
    // declare the schema
    idx = lunr(function() {
      this.field('title', {boost: 10});
      this.field('excerpt', {boost: 5});
      this.field('body');
      this.field('byline');
      this.ref('url');
    });
  };

  var insert = function(item) {
    // remove any tags from the string, replace them with spaces to aid the tokenizer
    var detagged = item.content.replace(/(<([^>]+)>)/g, " ");
    // index it
    idx.add({
      title: item.title,
      excerpt: item.excerpt,
      body: detagged,
      byline: item.byline,
      url: item.url
    });
  };

  // 4. surface lunr via gecko search service api
};
