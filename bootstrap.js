var {Cc, Ci, Cu} = require("chrome");
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

var winMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var win = winMediator.getMostRecentWindow('navigator:browser');
var doc = win.document;
win.LOL = {};

function UniversalSearch() {
  this.iframeURL = 'https://mozilla.org';
}
UniversalSearch.prototype = {
  constructor: UniversalSearch,
  // TODO: hide the second search bar with ToolbarButtonManager
  render: function() {
    console.log("entering render");

    this.urlbar = doc.getElementById('urlbar');
    this.popup = doc.getElementById('PopupAutoCompleteRichResult');

    // use the Stylesheet Service to load in the CSS containing the -moz-binding XBL magic
    var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
              .getService(Ci.nsIStyleSheetService);
    var ios = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService);
    var escapedCSS = encodeURIComponent('#PopupAutoCompleteRichResult.PopupAutoCompleteRichResultUnivSearch { ' +
    '-moz-binding: url("' + self.path.chrome + '/content/content.xml#autocomplete-rich-result-popup-univ-search"); }');
    var uri = ios.newURI('data:text/css,' + escapedCSS, null, null);
    // TODO: performance thing: loadAndRegisterSheet is synchronous.
    //       However, the IDL doesn't mention any async alternative.
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);

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

var startup = function(aData, aReason) {
  win.LOL.univSearch = new UniversalSearch();
  win.LOL.univSearch.render();
};
