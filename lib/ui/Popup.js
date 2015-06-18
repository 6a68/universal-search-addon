// popup event handlers on the chrome side

'use strict';

var EXPORTED_SYMBOLS = [ 'Popup' ];

function Popup() {
  // set consts or whatever
};

Popup.prototype = {
  init: function() {
    // startup stuff
  },
  render:  function(win) {
    this.popup = win.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "panel");
    this.popup.setAttribute("type", 'autocomplete-richlistbox');
    this.popup.setAttribute("id", 'PopupAutoCompleteRichResultUnivSearch');
    this.popup.setAttribute("noautofocus", 'true');

    this.popupParent = win.document.getElementById('PopupAutoCompleteRichResult').parentElement;
    this.popupParent.appendChild(this.popup);

    // TODO: not totally sure why, but I think we need to set this after the el hits the dom
    //       and the XBL binding is applied.
    this.popup._appendCurrentResult = this._appendCurrentResult;

    this.popup.addEventListener('popuphiding', this.onPopupHiding.bind(this));
    this.popup.addEventListener('popupshowing', this.onPopupShowing.bind(this));
  },
  _appendCurrentResult: function() { console.log('_appendCurrentResult') },
  onPopupHiding: function() { console.log('onPopupHiding') },
  onPopupShowing: function() { console.log('onPopupShowing') },
};
