// TODO: bootstrapped extensions cache strings, scripts, etc forever.
//       figure out when and how to cache-bust.
//       bugs 918033, 1051238, 719376

const { classes: Cc, interfaces: Ci, utils: Cu, manager: Cm } = Components;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
var logService = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
var log = logService.logStringMessage;

var EXPORTED_SYMBOLS = ['Main'];

var loadIntoWindow = function(win) {
  log('loadIntoWindow start');

  // set the app global per-window
  if(win.US === undefined) {
      Object.defineProperty(win, 'US', {configurable:true, value:{}});
  } else {
      win.US = win.US || {};
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
  win.US.urlbar = win.document.getElementById('urlbar');
  win.US.popup = popup;
  win.US._autocompletepopup = win.US.urlbar.getAttribute('autocompletepopup');
  win.US.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

  // add urlbar and gBrowser.tabContainer listeners
  // obviously we won't put everything top-level on the app namespace, just sketching here
  popup.addEventListener('popuphiding', onPopupHiding);
  popup.addEventListener('popupshowing', onPopupShowing);
  win.gBrowser.tabContainer.addEventListener('TabSelect', onTabSelect);
  win.gBrowser.tabContainer.addEventListener('TabOpen', onTabOpen);
  win.gBrowser.tabContainer.addEventListener('TabClose', onTabClose);

  // deal with the "go button" (right arrow that appears when you type in the bar)
  var goButton = document.getElementById('urlbar-go-button');
  UNIVSEARCH.elements.goButton = goButton;
  UNIVSEARCH.replaced.goButtonClick = goButton.getAttribute('onclick');

  // add our handler, fall through to the existing go button behavior
  goButton.setAttribute('onclick', 'UNIVSEARCH.goButtonClick(); ' + UNIVSEARCH.replaced.goButtonClick);
};

function addListeners(win) {
}

// 1. Extension.load: get a window enumerator, and load the code into each window.
function load() {
  log('load start');
  var enumerator = Services.wm.getEnumerator('navigator:browser');
  while (enumerator.hasMoreElements()) {
    log('enumerator has a window');
    var win = enumerator.getNext();
    try { 
      loadIntoWindow(win);
    } catch (ex) {
      log('load into window failed: ', ex);
    }
  }
  Services.ww.registerNotification(function(win, topic) {
    if (topic == 'domwindowopened') {
    log('iterating windows');
      win.addEventListener('load', function loader() {
        win.removeEventListener('load', loader, false); 
        if (win.location.href == 'chrome://browser/content/browser.xul') {
          loadIntoWindow(win);
        }
      }, false);
    }
  });
};

var Main = { load: load };
