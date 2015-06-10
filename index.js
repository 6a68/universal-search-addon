var {Cc, Ci, Cu} = require("chrome");
var tabs = require('sdk/tabs');

// let's try to get the chrome window, first
var activeWindow = require('sdk/windows').browserWindows.activeWindow;
var browserWindow = require('sdk/view/core').viewFor(activeWindow);

var document = browserWindow.document;




// startup is called:
// - when extension is first installed (assuming it's enabled)
// - when extension becomes enabled via addons window
// - when FF starts, if the extension is enabled
function UniversalSearch() {
  // consts or prefs...
  this.iframeURL = 'https://mozilla.org';

  //this.render();
}
UniversalSearch.prototype = {
  constructor: UniversalSearch,
  // grab some pointers to els, hide the search bar, render the popup,
  // append the XBL-binding stylesheet, and set the iframe src
  render: function() {
    console.log("entering render");
    // grab element pointers...maybe do this in constructor instead?
    // does the addon render() automatically any time it's in a new window?
    // do I have to manually draw it into each new window?
    this.urlbar = document.getElementById('urlbar');

    // hide the second search bar
    // TODO: this didn't work, neither Cu.import nor require. fix it later.
    // maybe use commonjs instead? Cu.import('chrome://universalsearch-modules/ToolbarButtonManager.jsm');
    // var ToolbarButtonManager = require('./lib/ToolbarButtonManager');
    // ToolbarButtonManager.hideToolbarElement(document, 'search-container');

    // dynamically append the stylesheet which binds the autocomplete popup
    var stylesheet = document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'chrome://universalsearch/content/skin/binding.css';
    stylesheet.type = 'text/css';
    stylesheet.style.display = 'none';
    document.documentElement.appendChild(stylesheet);

    // render the popup and append to the XUL document
    this.popup = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
    this.popup.setAttribute("type", 'autocomplete-richlistbox');
    this.popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
    this.popup.setAttribute("class", 'PopupAutoCompleteRichResultUnivSearch');
    this.popupParent = document.getElementById('PopupAutoCompleteRichResult').parentElement;
    this.popupParent.appendChild(this.popup);
  
    // the stylesheet binds our XBL to the page, so the browser el should be accessible
    // TODO: it's not there. figure out why.
    this.iframe = document.getAnonymousElementByAttribute(this.popupParent, "anonid", "universal-search-iframe");
    if (this.iframe) {
      this.iframe.addEventListener('load', this.onLoaded.bind(this), true);
      this.iframe.setAttribute('src', this.iframeURL);
    }

    // swap our popup for the existing one
    this._autocompletepopup = this.urlbar.getAttribute('autocompletepopup');
    this.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');
    // TODO: implement the search IDL
    // this._autocompletesearch = this.urlbar.getAttribute('autocompletesearch');
    // this.urlbar.setAttribute('autocompletesearch', 'univ-search-results');

    // add urlbar and tab event listeners
    // obviously we won't put everything top-level on the app namespace, just sketching here
    this.popup.addEventListener('popuphiding', this.handleEvent.bind(this));
    this.popup.addEventListener('popupshowing', this.handleEvent.bind(this));
    // TODO: do we even have gBrowser? should we use tabs SDK instead?
    tabs.on('open', this.handleEvent.bind(this));
    tabs.on('close', this.handleEvent.bind(this));
    tabs.on('activate', this.handleEvent.bind(this));
    tabs.on('deactivate', this.handleEvent.bind(this));
    // TODO add urlbar listeners

    // deal with the "go button" (right arrow that appears when you type in the bar)
    // TODO: neither the go button, nor the iframe, are ready. do we need to setTimeout?
    this.goButton = document.getElementById('urlbar-go-button');
    this._goButtonClick = this.goButton.getAttribute('onclick');
    // add our handler, fall through to the existing go button behavior
    this.goButton.setAttribute('onclick', 'UniversalSearch.goButtonClick(); ' + this._goButtonClick);

    // TODO add history dropmarker stanza

    console.log('exiting render');
  },
  onLoaded: function() {
    console.log('entering onLoaded');
    // TODO NEXT: inject the frame script into the frame
    // set up messaging with the frame script
    // store an object pointer to the message channel
    this.iframe.removeEventListener('load', onLoaded.bind(this), true);
    this.iframe.messageManager.loadFrameScript(self.data.url('frameScript.js'), true);
    this.iframe.messageManager.sendAsyncMessage('ping');
    this.iframe.messageManager.addMessageListener('pong', function(msg) {
      console.log('got a message from content: ' + message.name)
    });
    console.log('exiting onLoaded');
  },
  handleEvent: function(evt) {
    console.log('caught an event: ' + evt.type);
  },
  goButtonClick: function(evt) {
    console.log('go button was clicked');
  }
}

var univSearch = new UniversalSearch();
univSearch.render();

