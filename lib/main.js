// TODO: bootstrapped extensions cache strings, scripts, etc forever.
//       figure out when and how to cache-bust.
//       bugs 918033, 1051238, 719376

const { classes: Cc, interfaces: Ci, utils: Cu, manager: Cm } = Components;
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/devtools/Console.jsm');


var EXPORTED_SYMBOLS = ['Main'];

var loadIntoWindow = function(win) {
  console.log('loadIntoWindow start');

  var document = win.document;

  // set the app global per-window
  if(win.US === undefined) {
      Object.defineProperty(win, 'US', {configurable:true, value:{}});
  } else {
      win.US = win.US || {};
  }

  // use Services.scriptloader.loadSubScript to load any addl scripts.
  // here, though, we'll just inline everything.

  // load the CSS into the document. not using the stylesheet service.
  var stylesheet = document.createElementNS('http://www.w3.org/1999/xhtml', 'h:link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'chrome://universalsearch-root/content/skin/binding.css';
  stylesheet.type = 'text/css';
  stylesheet.style.display = 'none';
  document.documentElement.appendChild(stylesheet);

  // create the popup and append it to the dom.
  var popup = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
  popup.setAttribute("type", 'autocomplete-richlistbox');
  popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
  popup.setAttribute("noautofocus", 'true');
  document.getElementById('PopupAutoCompleteRichResult').parentElement.appendChild(popup);
  var _appendCurrentResult = function() { console.log('_appendCurrentResult') }
  popup._appendCurrentResult = _appendCurrentResult;

  // grab node pointers and swap the popup into the DOM.
  win.US.urlbar = document.getElementById('urlbar');
  win.US.popup = popup;
  win.US.replaced = {};
  win.US.replaced._autocompletepopup = win.US.urlbar.getAttribute('autocompletepopup');
  win.US.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

  // add urlbar and gBrowser.tabContainer listeners
  // obviously we won't put everything top-level on the app namespace, just sketching here
  popup.addEventListener('popuphiding', function onPopupHiding() { console.log('onPopupHiding') });
  popup.addEventListener('popupshowing', function onPopupShowing() { console.log('onPopupShowing') });
  win.gBrowser.tabContainer.addEventListener('TabSelect', function onTabSelect() {
    console.log('onTabSelect');
  });
  win.gBrowser.tabContainer.addEventListener('TabOpen', function onTabOpen() {
    console.log('onTabOpen');
  });
  win.gBrowser.tabContainer.addEventListener('TabClose', function onTabClose() {
    console.log('onTabClose');
  });

  // deal with the "go button" (right arrow that appears when you type in the bar)
  win.US.goButton = document.getElementById('urlbar-go-button');
  win.US.replaced.goButtonClick = win.US.goButton.getAttribute('onclick');
  // add our handler, fall through to the existing go button behavior
  win.US.goButton.setAttribute('onclick', 'US.goButtonClick(); ' + win.US.replaced.goButtonClick);

  // we call this function when the XBL loads, so we can get a pointer to the anonymous
  // browser element.
  win.US.setBrowser = function(browserEl) {
    win.US.browser = browserEl;
  }
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

var Main = { load: load };
