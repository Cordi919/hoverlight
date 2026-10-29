// Connects the Hoverlight core to the settings saved by the popup.
(function () {
  'use strict';
  if (window.__hoverlightContent) return;
  window.__hoverlightContent = true;

  var DEFAULTS = window.HoverlightConfig.DEFAULTS;
  var host = location.hostname;
  var hl = null;

  function apply(s) {
    var on = !!s.enabled && (s.disabledSites || []).indexOf(host) === -1;
    var opts = { enabled: on, color: s.color, opacity: Number(s.opacity), context: Number(s.context) };
    if (!hl) hl = window.Hoverlight.create(opts);
    else hl.setOptions(opts);
  }

  chrome.storage.sync.get(DEFAULTS, apply);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULTS, apply);
  });
})();
