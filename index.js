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

    this.popup = document.getElementById('PopupAutoCompleteRichResult');
    this.popup.setAttribute("class", 'PopupAutoCompleteRichResultUnivSearch');
    this.popup._appendCurrentResult = function() {
      console.log('popup._appendCurrentResult');
    };

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
    console.log('renderPopupContents');
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
