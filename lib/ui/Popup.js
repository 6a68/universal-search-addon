// popup event handlers on the chrome side

'use strict';

XPCOMUtils.defineLazyModuleGetter(this, 'SearchSuggestionController',
  'resource://gre/modules/SearchSuggestionController.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Promise',
  'resource://gre/modules/Promise.jsm');

var EXPORTED_SYMBOLS = [ 'Popup' ];

// TODO use prefs instead
var FRAME_URL = 'https://localhost/github/mozilla-universal-search-content/index.html';

function Popup() {
  // set consts or whatever
};

Popup.prototype = {
  init: function() {
    // startup stuff
  },
  render:  function(win) {
    this.popup = win.document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'panel');
    this.popup.setAttribute('type', 'autocomplete-richlistbox');
    this.popup.setAttribute('id', 'PopupAutoCompleteRichResultUnivSearch');
    this.popup.setAttribute('noautofocus', 'true');
    this.popup.setAttribute('src', FRAME_URL);

    this.popupParent = win.document.getElementById('PopupAutoCompleteRichResult').parentElement;
    this.popupParent.appendChild(this.popup);

    // TODO: not totally sure why, but I think we need to set this after the el hits the dom
    //       and the XBL binding is applied.
    this.popup._appendCurrentResult = this._appendCurrentResult.bind(this);

    this.popup.addEventListener('popuphiding', this.onPopupHiding.bind(this));
    this.popup.addEventListener('popupshowing', this.onPopupShowing.bind(this));

    // set up webchannel
  },
  _getImageURLForResolution: function(aWin, aURL, aWidth, aHeight) {
    if (!aURL.endsWith('.ico') && !aURL.endsWith('.ICO')) {
      return aURL;
    }
    let width  = Math.round(aWidth * aWin.devicePixelRatio);
    let height = Math.round(aHeight * aWin.devicePixelRatio);
    return aURL + (aURL.contains("#") ? "&" : "#") +
           "-moz-resolution=" + width + "," + height;

  },
  _appendCurrentResult: function() {
    var autocompleteResults = this._getAutocompleteSearchResults();
    var searchSuggestions = this._getSearchSuggestions();
    // TODO: send the data over to the iframe
  },
  _getAutocompleteSearchResults: function() {
    var controller = this.popup.mInput.controller;
    var maxResults = 5;
    var results = [];

    // the controller's searchStatus is not a reliable way to decide when/what to send.
    // instead, we'll just check the number of results and act accordingly.
    if (controller.matchCount) {
      results = [];
      for (var i = 0; i < Math.min(maxResults, controller.matchCount); i++) {
        var chromeImgLink = this._getImageURLForResolution(window, controller.getImageAt(i), 16, 16);
        // if we have a favicon link, it'll be of the form "moz-anno:favicon:http://link/to/favicon"
        // else, it'll be a chrome:// link to the default favicon img
        var imgMatches = chromeImgLink.match(/^moz-anno\:favicon\:(.*)/);

        results.push({
          url: Components.classes["@mozilla.org/intl/texttosuburi;1"].
                getService(Components.interfaces.nsITextToSubURI).
                unEscapeURIForUI("UTF-8", controller.getValueAt(i)),
          image: imgMatches ? imgMatches[1] : null,
          title: controller.getCommentAt(i),
          type: controller.getStyleAt(i),
          text: controller.searchString.replace(/^\s+/, "").replace(/\s+$/, "")
        });
      }
    }
    return results;
  },
  _getSearchSuggestions: function() {
    //
    // now, we also want to include the search suggestions in the output, via some separate signal.
    // a lot of this code lifted from browser/modules/AboutHome.jsm and browser/modules/ContentSearch.jsm
    // ( face-with-open-mouth-and-cold-sweat-emoji ), heh
    //
    // TODO: maybe just send signals to ContentSearch instead, the problem there is that I couldn't
    // figure out which message manager to pass into ContentSearch, in order to get the response message back.
    // it's possible all of this code was unnecessary and we could just fire a GetSuggestions message into
    // the ether, and fully expect to get a Suggestions object back with the suggestions. /me shrugs
    // 
    //var suggestionData = { engineName: engine.name, searchString: gURLBar.inputField.value, remoteTimeout: 5000 };
    //ContentSearch._onMessageGetSuggestions(brow.messageManager, suggestionData);
    var controller = this.popup.mInput.controller;

    // it seems like Services.search.isInitialized is always true?
    if (!Services.search.isInitialized) {
      return;
    }
    let MAX_LOCAL_SUGGESTIONS = 3;
    let MAX_SUGGESTIONS = 6;
    let REMOTE_TIMEOUT = 500; // same timeout as in SearchSuggestionController.jsm
    let isPrivateBrowsingSession = false; // we don't care about this right now

    // searchTerm is the same thing as the 'text' item sent down in each result.
    // maybe that's not a useful place to put the search term...
    let searchTerm = controller.searchString.replace(/^\s+/, "").replace(/\s+$/, "")

    // unfortunately, the controller wants to do some UI twiddling.
    // and we don't have any UI to give it. so it barfs.
    let searchController = new SearchSuggestionController();
    let engine = Services.search.currentEngine;
    let ok = SearchSuggestionController.engineOffersSuggestions(engine);

    searchController.maxLocalResults = ok ? MAX_LOCAL_SUGGESTIONS : MAX_SUGGESTIONS;
    searchController.maxRemoteResults = ok ? MAX_SUGGESTIONS : 0;
    searchController.remoteTimeout = REMOTE_TIMEOUT;

    let suggestions = searchController.fetch(searchTerm, isPrivateBrowsingSession, engine);
    // returns a promise for the formatted results of the search suggestion engine
    return suggestions.then(function(dataz) {
      delete dataz.formHistoryResult;
      return Promise.resolve({engine: engine.name, results: dataz});
    });
  },
  onPopupHiding: function() { console.log('onPopupHiding') },
  onPopupShowing: function() { console.log('onPopupShowing') },
};
