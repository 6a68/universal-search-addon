var {Cc, Ci, Cu} = require("chrome");
var { setTimeout } = require('sdk/timers');
var tabs = require('sdk/tabs');

// wasn't able to set a global using the sdk methods, hence, using Cc here
var winMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var window = winMediator.getMostRecentWindow('navigator:browser');
var document = window.document;
window.LOL = {};

function UniversalSearch() {
  this.iframeURL = 'https://mozilla.org';
}
UniversalSearch.prototype = {
  constructor: UniversalSearch,
  // TODO: hide the second search bar with ToolbarButtonManager
  render: function() {
    console.log("entering render");
    this.urlbar = document.getElementById('urlbar');

    var stylesheet = document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'chrome://universalsearch/content/skin/binding.css';
    stylesheet.type = 'text/css';
    stylesheet.style.display = 'none';
    document.documentElement.appendChild(stylesheet);

    this.popup = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
    this.popup.setAttribute("type", 'autocomplete-richlistbox');
    this.popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
    this.popup.setAttribute("class", 'PopupAutoCompleteRichResultUnivSearch');
    this.popup.openPopup = function() {
      console.log('openPopup called inside popup inside addon');
    };
    this.popup.openAutocompletePopup = function() {
      console.log('openAutocompletePopup called inside addon');
    };
    this.popupParent = document.getElementById('PopupAutoCompleteRichResult').parentElement;
    this.popupParent.appendChild(this.popup);
  
    this.iframe = document.getAnonymousElementByAttribute(this.popupParent, "anonid", "universal-search-iframe");
    if (this.iframe) {
      this.iframe.addEventListener('load', this.onLoaded.bind(this), true);
      this.iframe.setAttribute('src', this.iframeURL);
    }

    // swap our popup for the existing one
    this._autocompletepopup = this.urlbar.getAttribute('autocompletepopup');
    this.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

    // TODO: implement the search IDL:
    // this._autocompletesearch = this.urlbar.getAttribute('autocompletesearch');
    // this.urlbar.setAttribute('autocompletesearch', 'univ-search-results');

    // reload the urlbar element
    this.urlbar && this.urlbar.parentNode &&
      this.urlbar.parentNode.insertBefore(this.urlbar, this.urlbar.nextSibling);

    setTimeout(function() {
      this.popup.addEventListener('popuphiding', this.handleEvent.bind(this));
      this.popup.addEventListener('popupshowing', this.handleEvent.bind(this));
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
    }.bind(this), 0, this);

    console.log('exiting render');
  },
  onLoaded: function() {
    console.log('entering onLoaded');
    // TODO NEXT: inject the frame script into the frame
    // set up messaging with the frame script
    // store an object pointer to the message channel
    console.log('exiting onLoaded');
  },
  // called by XBL when the popup is instantiated
  renderPopupContents: function(el) {
    // render some text into the el, let's just see if this works at all.
    console.log('renderPopupContents');
    el.innerHTML += ", hello js world";
  },
  handleEvent: function(evt) {
    console.log('caught an event: ' + evt.type);
  },
  goButtonClick: function(evt) {
    console.log('go button was clicked');
  },
  _appendCurrentResult: function() {
  }
}

window.LOL.univSearch = new UniversalSearch();
window.LOL.univSearch.render();
