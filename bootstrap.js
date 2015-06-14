// TODO: bootstrapped extensions cache strings, scripts, etc forever.
//       figure out when and how to cache-bust.
//       bugs 918033, 1051238, 719376

// var {Cc, Ci, Cu} = require("chrome");
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function UniversalSearch() {
  this.iframeURL = 'https://mozilla.org';
}
UniversalSearch.prototype = {
  constructor: UniversalSearch,
  // TODO: hide the second search bar with ToolbarButtonManager
  render: function(win) {
    console.log("entering render");
    var doc = win.document;
    this.urlbar = doc.getElementById('urlbar');
    this.popup = doc.getElementById('PopupAutoCompleteRichResult');

    var sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var escapedCSS = encodeURIComponent('#PopupAutoCompleteRichResult.PopupAutoCompleteRichResultUnivSearch { ' +
      '-moz-binding: url("chrome://universalsearch/content/content.xml#autocomplete-rich-result-popup-univ-search"); }');
    var uri = ios.newURI('data:text/css,' + escapedCSS, null, null);
    // TODO: performance thing: loadAndRegisterSheet is synchronous.
    //       However, the IDL doesn't mention any async alternative.
    console.log('typeof sss: ' + typeof sss);
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);

    console.log('typeof this.popup: ' + typeof this.popup);
    if (this.popup) {
      this.popup.setAttribute("class", 'PopupAutoCompleteRichResultUnivSearch');
      this.popup._appendCurrentResult = function() {
        console.log('popup._appendCurrentResult');
      };
    } else {
      console.log('this.popup is falsy. window.doc.readyState is ' + win.document && win.document.readyState);
    }
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
};

// nsIWindowMediatorListener: onOpenWindow, onCloseWindow, onWindowTitleChange
// TODO: should this just be part of the UniversalSearch object? "when your window is ready, render yourself into it"
var mediatorListener = {
  onOpenWindow: function(win) {
    console.log('onOpenWindow');
    var domWindow = win.QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", this.onDOMWindowLoaded.bind(this, domWindow));
  },
  onDOMWindowLoaded: function(domWindow) {
    domWindow.removeEventListener("load", this.onDOMWindowLoaded.bind(this, domWindow), false);
    this.render(domWindow);
  },
  onCloseWindow: function(win) {
    console.log('onCloseWindow');
    this.derender(win);
  },
  onWindowTitleChange: function(win, title) {
    // no-op 
  },
  render: function(win) {
    // TODO: it looks like the XUL window is not writable. so I guess instead of
    //       having a global on the window, I'll just have globals in here?
    var univSearch = new UniversalSearch();
    univSearch.render(win);
  },
  derender: function(win) {
    // probably should actually fire a shutdown signal,
    // pass a shutdown promise,
    // every piece of the app shuts itself down then resolves its bit,
    // when the base promise resolves, actually delete win.LOL.
  }
};

function startup(aData, aReason) {
  // "inject code into all windows and listen for new windows" code courtesy of Mossop
  // http://www.oxymoronical.com/blog/2011/01/Playing-with-windows-in-restartless-bootstrapped-extensions
  var winMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);

  winMediator.addListener(mediatorListener);

  var windows = winMediator.getEnumerator('navigator:browser');
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    // it seems like the dom is sometimes not yet ready, handle this for render
    console.log('iterating over windows. the readystate is ' + domWindow.document && domWindow.document.readyState);
    if (domWindow.document.readyState == 'complete') {
      console.log('startup found a ready window, rendering into it');
      mediatorListener.render(domWindow);
    } else {
      console.log('startup found a non-ready window, adding an onload handler');
      // mediatorListener handles adding the 'load' listener
      mediatorListener.onOpenWindow(domWindow);
    }
  }
  console.log('exiting universal-search-addon startup');
};

var shutdown = function(aData, aReason) {
  // no teardown is needed for a normal shutdown
  if (reason == APP_SHUTDOWN) { return; }

  var winMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
  winMediator.removeListener(mediatorListener);
};

function install() { console.log('installing universal-search-addon') }
function uninstall() { console.log('unnstalling universal-search-addon') }
function shutdown() { console.log('shutting down universal-search-addon') }

