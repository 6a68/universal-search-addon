'use strict';

// full text client-local database.
// one per firefox instance, not one per window.
// TODO: define this as a service or a singleton.

XPCOMUtils.defineLazyServiceGetter(this, 'historyService',
  '@mozilla.org/browser/nav-history-service;1', 'nsINavHistoryService');
XPCOMUtils.defineLazyModuleGetter(this, "ReaderMode",
  "resource://gre/modules/ReaderMode.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'Log',
  "resource://gre/modules/Log.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'Promise',
  "resource://gre/modules/Promise.jsm");


XPCOMUtils.defineLazyModuleGetter(this, 'lunr',
  'chrome://universalsearch-lib/vendor/lunr.js');
XPCOMUtils.defineLazyModuleGetter(this, 'readability',
  'chrome://universalsearch-lib/vendor/readability.js');

var EXPORTED_SYMBOLS = 'HistoryFullTextSearch';

// TODO: finish the save to disk / import from disk part. it sucks.
// TODO: add a history listener to scrape this as we go




// 1. HistoryFullTextSearch:
// we only want one of these per browser as a whole. how do we do singletons in gecko?
// we'll just create one of these if it does not already exist on the global US object created by main.js.
if (!US) {
  throw new Error('need the addon global to set our singleton on it');
}
if ('historyFullTextSearch' in US) { return; }
US.historyFullTextSearch = {}; // set this for now, overwrite when we're initialized

// initialization:
// - lazily create the search index file if it doesn't exist
//
// - we are using pages, not visits. so let's just suck the whole thing in:
// -
// 
// 
  
var INDEX_FILE_LOCATION = 'chrome://universalsearch-lib/lunrIndex.json';

var FullTextDB = function() {
  this._log = Log.repository.getLogger('UniversalSearchAddon.HistoryFullTextSearch');
  this._log.level = Log.Level.Debug;
  this._log.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));

  // either init from a file or create a new index
  this.initIndex()
};

// 1. (wip) the bit about loading from disk
// 2. the bit about scraping the full contents of the places DB in an
//    intelligent, interruptible way.
// 3. (done) the bit about actually using lunr to serialize a scraped page
// 4. (done) the bit where we scrape a page via ReaderMode
FullTextDB.prototype = {
  // lunr.js index
  _index: null,

  // becomes true when the full-text DB loads.
  // listen for 'ready' event to know when it's ready:
  // fullTextDB.on('ready', onReadyFn);
  _initialized: false,
  set initialized(bool) {
    this._initialized = bool;
    this.fire('ready');
  },
  get initialized() {
    return this._initialized;
  },

  // TODO: replace with Services.obs.addObserver / removeObserver / notifyObservers
  listeners: {
    'ready': []
  },
  // XXX explicitly register all events inside the listeners object.
  //     this ensures we can grep for the full list of events.
  on: function(evt, listener) {
    if (!(evt in this.listeners)) {
      throw new Error('you cannot subscribe to the unknown event ' + evt + );
    }
    this.listeners[evt].push(listener);
  },
  off: function(evt, listener) {
    if (!(evt in this.listeners)) { return; }
    this.listeners[evt].forEach(function(registeredListener, i) {
      if (registeredListener === listener) {
        this.listeners[evt].splice(i, 1);
      }
    });
  },
  // XXX only allowing one param to be passed to handlers
  fire: function(evt, packet) {
    if (!(evt in this.listeners)) { return; }
    this.listeners[evt]forEach(function(handler) {
      handler.call(null, packet);
    });
  },

  // the main externally-visible API, except for load / save to disk.
  //
  // - grab the user's recent history
  // - scrape each URL
  // - throw the results into solr
  // - save the thing to disk
  //
  // - expose the result
  // - 

  // initialization of the database from a file
  //
  // I stole this code from the _httpGetRequest method in Experiments.jsm
  // but I removed the timeout and channel priority setting
  _networkRequest: null,
  _loadFile: function (url) {
    this._log.trace("_loadFile(" + url + ")");
    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    try {
      xhr.open("GET", url);
    } catch (e) {
      this._log.error("_loadFile() - Error opening request to " + url + ": " + e);
      return Promise.reject(new Error("Experiments - Error opening XHR for " + url));
    }

    this._networkRequest = xhr;
    let deferred = Promise.defer();

    let log = this._log;
    let errorhandler = (evt) => {
      log.error("_loadFile::onError() - Error making request to " + url + ": " + evt.type);
      deferred.reject(new Error("XHR error loading " + url + " - " + evt.type));
      this._networkRequest = null;
    };
    xhr.onerror = errorhandler;
    xhr.ontimeout = errorhandler;
    xhr.onabort = errorhandler;

    xhr.onload = (event) => {
      if (xhr.status !== 200 && xhr.state !== 0) {
        log.error("_loadFile::onLoad() - Request to " + url + " returned status " + xhr.status);
        deferred.reject(new Error("XHR status for " + url + " is " + xhr.status));
        this._networkRequest = null;
        return;
      }

      deferred.resolve(xhr.responseText);
      this._networkRequest = null;
    };

    xhr.send(null);
    return deferred.promise;
  },

  // ugh, I guess use Promises here too.
  initIndex: function() {
    return new Promise(function(resolve, reject) {
      // xhr the file but do not parse the text, lunr.js handles that
      if (!OS.exists(INDEX_FILE_LOCATION)) {
        // create the empty index & return it
        // declare the schema
        this._index = lunr(function() {
          this.field('title', {boost: 10});
          this.field('excerpt', {boost: 5});
          this.field('body');
          this.field('byline');
          // TODO: can I boost on frecency as an integer? does it do the right thing?
          //       or will it just return a match on the exact frecency integer?
          // TODO: is frecency normalized?
          this.field('frecency');
          this.ref('url');
        });
        resolve();
      } 
      // else, load the file and return the index
      var fileContents;
      this._loadFile(filename).then(function onFileLoaded(contents) {
        this._index = lunr.Index.load(contents);
        this.initialized = true;
        resolve();
      }, onFileErr(err) {
        this.log.error('Could not load index file: ', err);
        reject('could not load lunr database from file:', err);
      });
    });
  },
  // 1. scrape all your history
  //    snippet nabbed from: https://developer.mozilla.org/Mozilla/Tech/Places/Querying#Using_the_results
  // TODO: instead of initial 100, iterate through the entire thing.
  //       and set some state to keep track of the highest and lowest ID numbers.
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
  // just return a promise as is done elsewhere in the file
  _scrapeURL: function(rawURL, cb) {
    return Promise(function(resolve, reject) {
      ReaderMode.downloadAndParseDocument(rawURL)
        .then(resolve, reject);
    });
  },
  _indexScrapedPage: function(item) {
    // remove any tags from the string, replace them with spaces to aid the tokenizer
    var detagged = item.content.replace(/(<([^>]+)>)/g, " ");
    // TODO: use historyService to get frecency for the URL, include it in the index
    idx.add({
      title: item.title,
      excerpt: item.excerpt,
      body: detagged,
      byline: item.byline,
      url: item.url
    });
  },
  // set up a history listener to append stuff to the DB on each page.
  historyListener: function() {
    // if we're not in private browsing mode,
    // grab the url of the page when it loads,
    // pass it to _scrapeURL,
    // then call _indexScrapedPage.
    // NOTE: we don't check if you've loaded the page before because we want to
    //       get the updated frecency number from the places table.
  },

  // 4. surface lunr via gecko search service api
  //    ....or not.
  search: function(searchTerm) {
    if (!this._initialized) { return; }
    var results = this._index.search(searchTerm);
    // TODO: results will just be a list of IDs.
    // we need to store the scraped stuff someplace else in order to return
    // content to the user.
  }

  
};
