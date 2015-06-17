// TODO: bootstrapped extensions cache strings, scripts, etc forever.
//       figure out when and how to cache-bust.
//       bugs 918033, 1051238, 719376

// var {Cc, Ci, Cu} = require("chrome");
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');

if(window.FOO === undefined) {
    Object.defineProperty( window, 'FOO', {configurable:true, value:{}});
} else {
    window.FOO = window.FOO || {};
}


// 1. Extension.load: get a window enumerator, and load the code into each window.
function load() {
  var enumerator = Services.wm.getEnumerator('navigator:browser');
  while (enumerator.hasMoreElements()) {
    var win = enumerator.getNext();
    loadIntoWindow(win);
  }
  Services.ww.registerNotification(function(win, topic) {
    if (topic == 'domwindowopened') {
      win.addEventListener('load', function loader() {
        win.removeEventListener('load', loader, false); 
        if (win.location.href == 'chrome://browser.content/browser.xul') {
          loadIntoWindow(win);
        }
      }, false);
    }
  });
};

var loadIntoWindow = function(win) {
  // use Services.scriptloader.loadSubScript to load any addl scripts.
  // here, though, we'll just inline everything.

  // load the CSS into the document. not using the stylesheet service.
  var stylesheet = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'chrome://universalsearch/skin/binding.css';
  stylesheet.type = 'text/css';
  stylesheet.style.display = 'none';
  win.document.documentElement.appendChild(stylesheet);

  // create the popup and append it to the dom.
  var popup = win.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
  popup.setAttribute("type", 'autocomplete-richlistbox');
  popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
  popup.setAttribute("noautofocus", 'true');
  win.document.getElementById('PopupAutoCompleteRichResult').parentElement.appendChild(popup);

  // grab node pointers and swap the popup into the DOM.
  FOO.urlbar = win.document.getElementById('urlbar');
  FOO.popup = popup;
  FOO._autocompletepopup = FOO.urlbar.getAttribute('autocompletepopup');
  FOO.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');
  
};

FOO.main = function(browserEl) {
};





function startup(aData, aReason) {
load();
};

function install() { console.log('installing universal-search-addon') }
function uninstall() { console.log('unnstalling universal-search-addon') }
function shutdown() { console.log('shutting down universal-search-addon') }

