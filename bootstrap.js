// TODO: bootstrapped extensions cache strings, scripts, etc forever.
//       figure out when and how to cache-bust.
//       bugs 918033, 1051238, 719376

// var {Cc, Ci, Cu} = require("chrome");
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');


var loadIntoWindow = function(win) {
  console.log('loadIntoWindow start');

  // set the app global per-window
  if(win.FOO === undefined) {
      Object.defineProperty(win, 'FOO', {configurable:true, value:{}});
  } else {
      win.FOO = win.FOO || {};
  }

  // use Services.scriptloader.loadSubScript to load any addl scripts.
  // here, though, we'll just inline everything.

  // load the CSS into the document. not using the stylesheet service.
  var stylesheet = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'chrome://universalsearch-root/content/skin/binding.css';
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

// 1. Extension.load: get a window enumerator, and load the code into each window.
function load() {
  console.log('load start');
  var enumerator = Services.wm.getEnumerator('navigator:browser');
  while (enumerator.hasMoreElements()) {
    console.log('enumerator has a window');
    var win = enumerator.getNext();
    try { 
      loadIntoWindow(win);
    } catch (ex) {
      console.log('load into window failed: ', ex);
    }
  }
  Services.ww.registerNotification(function(win, topic) {
    if (topic == 'domwindowopened') {
    console.log('iterating windows');
      win.addEventListener('load', function loader() {
        win.removeEventListener('load', loader, false); 
        if (win.location.href == 'chrome://browser/content/browser.xul') {
          loadIntoWindow(win);
        }
      }, false);
    }
  });
};


function startup(aData, aReason) {
console.log('startup start');
load();
};

function install() { console.log('installing universal-search-addon') }
function uninstall() { console.log('unnstalling universal-search-addon') }
function shutdown() { console.log('shutting down universal-search-addon') }

