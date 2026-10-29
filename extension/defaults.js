// The single source of settings defaults and colour presets.
// Loaded by content.js (content script list), popup.html, background.js (importScripts)
// and inlined into the website by scripts/build_site.py. Change colours here only.
(function (global) {
  'use strict';
  var PRESETS = [
    { name: 'Butter',   value: '#f5d77a' },
    { name: 'Sage',     value: '#b9d4a8' },
    { name: 'Mist',     value: '#b4d3e0' },
    { name: 'Apricot',  value: '#f4c09a' },
    { name: 'Lilac',    value: '#d3c2e6' },
    { name: 'Blush',    value: '#f0bcc4' }
  ];
  // How many sentences before and after the one under the mouse are also lit (lighter).
  var CONTEXT_OPTIONS = [
    { value: 0, label: 'Off', hint: 'Only the sentence under your mouse' },
    { value: 1, label: '±1',  hint: 'Plus one sentence before and after' },
    { value: 2, label: '±2',  hint: 'Plus two sentences before and after' }
  ];
  global.HoverlightConfig = {
    PRESETS: PRESETS,
    CONTEXT_OPTIONS: CONTEXT_OPTIONS,
    DEFAULTS: { enabled: true, color: PRESETS[0].value, opacity: 0.55, context: 0, disabledSites: [] }
  };
})(typeof self !== 'undefined' ? self : this);
