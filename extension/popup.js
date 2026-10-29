(function () {
  'use strict';

  var DEFAULTS = window.HoverlightConfig.DEFAULTS;
  var PRESETS = window.HoverlightConfig.PRESETS;
  var CONTEXT_OPTIONS = window.HoverlightConfig.CONTEXT_OPTIONS;

  var $ = function (id) { return document.getElementById(id); };
  var state = Object.assign({}, DEFAULTS);
  var host = null;

  // Live preview inside the popup itself
  var preview = window.Hoverlight.create({ root: $('preview'), color: state.color, opacity: state.opacity });

  function save(patch) {
    Object.assign(state, patch);
    chrome.storage.sync.set(patch);
    render();
  }

  function buildSwatches() {
    var wrap = $('swatches');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'swatch';
      b.type = 'button';
      b.style.background = p.value;
      b.title = p.name;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', p.name);
      b.dataset.value = p.value;
      b.addEventListener('click', function () { save({ color: p.value }); });
      wrap.appendChild(b);
    });
    var custom = document.createElement('label');
    custom.className = 'swatch custom';
    custom.title = 'Pick any colour';
    custom.setAttribute('role', 'radio');
    custom.setAttribute('aria-label', 'Custom colour');
    var input = document.createElement('input');
    input.type = 'color';
    input.id = 'customColor';
    input.addEventListener('input', function () { save({ color: input.value }); });
    custom.appendChild(input);
    wrap.appendChild(custom);
  }

  function render() {
    $('enabled').checked = !!state.enabled;
    document.body.classList.toggle('off', !state.enabled);
    $('opacity').value = state.opacity;
    $('opacityOut').textContent = Math.round(state.opacity * 100) + '%';
    $('customColor').value = state.color;

    var isPreset = false;
    document.querySelectorAll('.swatch').forEach(function (el) {
      var on = el.dataset.value && el.dataset.value.toLowerCase() === state.color.toLowerCase();
      if (on) isPreset = true;
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    var c = document.querySelector('.swatch.custom');
    c.setAttribute('aria-checked', isPreset ? 'false' : 'true');
    if (!isPreset) c.style.boxShadow = 'inset 0 0 0 9px ' + state.color;
    else c.style.boxShadow = '';

    var ctx = Number(state.context) || 0;
    $('context').querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-checked', Number(b.dataset.value) === ctx ? 'true' : 'false');
    });
    $('contextHint').textContent = CONTEXT_OPTIONS.filter(function (o) { return o.value === ctx; })[0].hint;

    var siteOff = host && state.disabledSites.indexOf(host) !== -1;
    $('siteOff').checked = !!siteOff;

    preview.setOptions({ enabled: state.enabled, color: state.color, opacity: Number(state.opacity), context: ctx });
  }

  function buildContext() {
    CONTEXT_OPTIONS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.dataset.value = o.value;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', o.hint);
      b.addEventListener('click', function () { save({ context: o.value }); });
      $('context').appendChild(b);
    });
  }

  buildSwatches();
  buildContext();

  $('enabled').addEventListener('change', function (e) { save({ enabled: e.target.checked }); });
  $('opacity').addEventListener('input', function (e) { save({ opacity: Number(e.target.value) }); });
  $('siteOff').addEventListener('change', function (e) {
    if (!host) return;
    var list = state.disabledSites.filter(function (h) { return h !== host; });
    if (e.target.checked) list.push(host);
    save({ disabledSites: list });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    try {
      var url = new URL(tabs[0].url);
      if (/^https?:$/.test(url.protocol)) host = url.hostname;
    } catch (e) { /* chrome:// pages etc. */ }
    if (host) $('host').textContent = host;
    else $('siteOff').disabled = true;
    chrome.storage.sync.get(DEFAULTS, function (s) { state = s; render(); });
  });
})();
