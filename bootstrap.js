
'use strict';

var EXPORTED_SYMBOLS = ['UniversalSearch'];

// define the app namespace
var UniversalSearch = UniversalSearch || {};

// TODO require is undefined?
// var {Cc, Ci, Cu} = require("chrome");
//Cu.import("resource://gre/modules/Services.jsm");
//Cu.import("resource://gre/modules/WebChannel.jsm");

function install() {
  console.error('installing');
}
function uninstall() {
  console.error('uninstalling');
}


// startup is called:
// - when extension is first installed (assuming it's enabled)
// - when extension becomes enabled via addons window
// - when FF starts, if the extension is enabled
function startup(data, reason) {
  console.error('startup called');

  // hide the search bar
  Cu.import('chrome://universalsearch-modules/ToolbarButtonManager.jsm');
  ToolbarButtonManager.hideToolbarElement(window.document, 'search-container');

  // create the popup element
  var popup = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
  popup.setAttribute("type", 'autocomplete-richlistbox');
  popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
  document.getElementById('PopupAutoCompleteRichResult').parentElement.appendChild(popup);
  var urlbar = document.getElementById('urlbar');
  UniversalSearch.elements = {
    popup: popup,
    urlbar: urlbar
  };

  // dynamically append the stylesheet which binds the autocomplete popup
  var stylesheet = window.document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'chrome://universalsearch/content/skin/binding.css';
  stylesheet.type = 'text/css';
  stylesheet.style.display = 'none';
  window.document.documentElement.appendChild(stylesheet);

  // TODO dynamically set the src on the iframe, then set up messaging when it loads

  // override some stuff on the urlbar
  UniversalSearch.replaced = {};
  // TODO: implement this...
  // UniversalSearch.replaced.autocompletesearch = urlbar.getAttribute('autocompletesearch');
  // urlbar.setAttribute('autocompletesearch', 'univ-search-results');
  UniversalSearch.replaced.autocompletepopup = urlbar.getAttribute('autocompletepopup');
  urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

  // add urlbar and gBrowser.tabContainer listeners
  // obviously we won't put everything top-level on the app namespace, just sketching here
  popup.addEventListener('popuphiding', UniversalSearch.onPopupHiding);
  popup.addEventListener('popupshowing', UniversalSearch.onPopupShowing);
  gBrowser.tabContainer.addEventListener('TabSelect', UniversalSearch.onTabSelect);
  gBrowser.tabContainer.addEventListener('TabOpen', UniversalSearch.onTabOpen);
  gBrowser.tabContainer.addEventListener('TabClose', UniversalSearch.onTabClose);
  // TODO add urlbar listeners

  // deal with the "go button" (right arrow that appears when you type in the bar)
  var goButton = document.getElementById('urlbar-go-button');
  UniversalSearch.elements.goButton = goButton;
  UniversalSearch.replaced.goButtonClick = goButton.getAttribute('onclick');
  // add our handler, fall through to the existing go button behavior
  goButton.setAttribute('onclick', 'UniversalSearch.goButtonClick(); ' + UniversalSearch.replaced.goButtonClick);

  // TODO add history dropmarker stanza
  console.log('startup exiting');
}

// shutdown is called:
// - when extension is uninstalled, if currently enabled
// - when extension becomes disabled
// - when FF shuts down, if the extension is enabled
function shutdown(data, reason) {
  console.log('shutting down');
}
