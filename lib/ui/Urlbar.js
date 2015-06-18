// urlbar listeners and event handlers

'use strict';

var EXPORTED_SYMBOLS = ['Urlbar'];

function Urlbar() {}
Urlbar.prototype = {
  // replaced handlers and elements
  replaced: {},
  init: function() {},
  render: function(win) {
    this.urlbar = win.document.getElementById('urlbar');
    this.replaced._autocompletepopup = this.urlbar.getAttribute('autocompletepopup');
    this.urlbar.setAttribute('autocompletepopup', 'PopupAutoCompleteRichResultUnivSearch');

    // listen for events 
  },
  derender: function() {
    // do something with this.replaced, the replaced els
    // unhook all the listeners
  }
};
