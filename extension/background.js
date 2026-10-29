// Keyboard shortcut (Alt+Shift+H / Option+Shift+H) turns Hoverlight on and off everywhere.
// Chrome runs this as a service worker and loads defaults.js here; Firefox loads it
// as an event page with defaults.js listed first in the manifest.
if (typeof importScripts === 'function' && !self.HoverlightConfig) importScripts('defaults.js');
var DEFAULTS = self.HoverlightConfig.DEFAULTS;

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'off' });
  chrome.action.setBadgeBackgroundColor({ color: '#2f5b45' });
}

chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'toggle-hoverlight') return;
  chrome.storage.sync.get(DEFAULTS, function (s) {
    chrome.storage.sync.set({ enabled: !s.enabled });
  });
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'sync' && changes.enabled) updateBadge(changes.enabled.newValue);
});

chrome.runtime.onStartup.addListener(function () {
  chrome.storage.sync.get(DEFAULTS, function (s) { updateBadge(s.enabled); });
});
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(DEFAULTS, function (s) { updateBadge(s.enabled); });
});
