/*!
 * Hoverlight core — highlight the whole sentence under the mouse pointer.
 *
 * How it works
 *  1. On pointer move (throttled to one check per animation frame) we ask the
 *     browser which character is under the pointer (caretPositionFromPoint).
 *  2. We confirm the pointer is really over that character, not just near it,
 *     so hovering in margins or empty space doesn't light anything up.
 *  3. We gather all text in the surrounding block (paragraph, list item, ...)
 *     — including text inside <b>, <a>, <em> and so on — and split it into
 *     sentences with Intl.Segmenter, which understands many languages
 *     (English ". ? !", Chinese "。？！", etc.).
 *  4. The sentence is painted with the CSS Custom Highlight API, which colours
 *     text without touching the page's DOM, so layouts never shift.
 *
 * Option `context` (0–2) also lights the sentences just before and after,
 * in the same paragraph, at a lighter strength.
 *
 * Works as a browser-extension content script and as a plain <script> on a
 * web page:  const hl = Hoverlight.create({ color: '#f5d77a', opacity: 0.55 });
 */
(function (global) {
  'use strict';

  if (global.Hoverlight) return; // already loaded in this frame

  var HIGHLIGHT_NAME = 'hoverlight-sentence';   // the sentence under the pointer
  var CONTEXT_NAME = 'hoverlight-context';      // neighbouring sentences, painted lighter
  var CONTEXT_STRENGTH = 0.45;                  // neighbours use 45% of the focus opacity
  var MAX_CONTEXT = 2;
  // Standalone fallback only. The extension and demo pass values from defaults.js.
  var DEFAULTS = { enabled: true, color: '#f5d77a', opacity: 0.55, context: 0, root: null };

  var SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|BUTTON|SVG|CANVAS|IFRAME|CODE|PRE|KBD|SAMP)$/;
  var INLINE_DISPLAYS = /^(inline|inline-block|inline-flex|inline-grid|contents|ruby|ruby-text|ruby-base)$/;

  var supportsHighlightAPI =
    typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';

  // ---------- small helpers ----------

  function hexToRgba(hex, alpha) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) h = DEFAULTS.color.slice(1);
    var n = parseInt(h, 16);
    var a = Math.max(0, Math.min(1, Number(alpha)));
    if (isNaN(a)) a = DEFAULTS.opacity;
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function caretFromPoint(x, y) {
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(x, y);
      return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
  }

  function rectContains(rect, x, y, pad) {
    return x >= rect.left - pad && x <= rect.right + pad &&
           y >= rect.top - pad && y <= rect.bottom + pad;
  }

  // Is the pointer really on top of a character next to this caret position?
  // (Browsers return the *nearest* caret even when you hover empty space.)
  function pointerIsOnText(node, offset, x, y) {
    var len = node.data.length;
    var range = document.createRange();
    for (var i = Math.max(0, offset - 1); i <= Math.min(len - 1, offset); i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      var rects = range.getClientRects();
      for (var j = 0; j < rects.length; j++) {
        if (rectContains(rects[j], x, y, 1)) return true;
      }
    }
    return false;
  }

  function isEditable(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.isContentEditable) return true;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)) return true;
    }
    return false;
  }

  function isSkipped(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP_TAGS.test(e.tagName.toUpperCase())) return true;
      if (e.hasAttribute && e.hasAttribute('data-hoverlight-ignore')) return true;
    }
    return false;
  }

  // Nearest ancestor that is laid out as a block (p, li, td, h1, div, ...).
  function blockAncestor(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      var d = getComputedStyle(el).display;
      if (!INLINE_DISPLAYS.test(d)) return el;
      el = el.parentElement;
    }
    return el || document.body;
  }

  var segmenterCache = {};
  function getSegmenter(lang) {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return null;
    var key = lang || 'default';
    if (!segmenterCache[key]) {
      try { segmenterCache[key] = new Intl.Segmenter(lang || undefined, { granularity: 'sentence' }); }
      catch (e) { segmenterCache[key] = new Intl.Segmenter(undefined, { granularity: 'sentence' }); }
    }
    return segmenterCache[key];
  }

  // Split text into [start, end) sentence spans.
  function splitSentences(text, lang) {
    var spans = [];
    var seg = getSegmenter(lang);
    if (seg) {
      var it = seg.segment(text)[Symbol.iterator]();
      for (var s = it.next(); !s.done; s = it.next()) {
        spans.push([s.value.index, s.value.index + s.value.segment.length]);
      }
      return spans;
    }
    // Fallback for very old browsers: end at . ! ? 。！？ followed by space/quote/end.
    var re = /[^.!?。！？]*(?:[.!?。！？]+["'”’)\]]*\s*|$)/g, m;
    while ((m = re.exec(text)) && m[0].length) spans.push([m.index, m.index + m[0].length]);
    return spans;
  }

  // Collect the text nodes that belong directly to `block` (not to a nested block).
  function collectBlockText(block) {
    var nodes = [];
    var starts = [];
    var text = '';
    var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || isSkipped(p)) return NodeFilter.FILTER_REJECT;
        if (blockAncestor(n) !== block) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push(n);
      starts.push(text.length);
      // collapse runs of whitespace the way the page renders them, but keep length 1:1
      text += n.data;
    }
    return { nodes: nodes, starts: starts, text: text };
  }

  // Map a character offset in the block's joined text back to (node, offset).
  function locate(info, pos, preferEnd) {
    var lo = 0, hi = info.nodes.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (info.starts[mid] < pos || (!preferEnd && info.starts[mid] === pos)) lo = mid; else hi = mid - 1;
    }
    return { node: info.nodes[lo], offset: pos - info.starts[lo] };
  }

  function langOf(el) {
    var withLang = el.closest && el.closest('[lang]');
    return (withLang && withLang.getAttribute('lang')) || document.documentElement.lang || undefined;
  }

  // ---------- the controller ----------

  function create(userOptions) {
    var opts = Object.assign({}, DEFAULTS, userOptions || {});
    var styleEl = null;
    var overlayEl = null;           // fallback painter when the Highlight API is missing
    var cache = null;               // { block, info, sentences: [[start, end], ...] }
    var current = null;             // { block, index, context, focus: Range, around: [Range] }
    var lastPoint = null;
    var frame = 0;
    var observer = null;
    var tapOnce = false;            // a tap is a one-off point, not a resting pointer

    function root() { return opts.root || document; }

    // How many sentences before and after the focus sentence to light up (0, 1 or 2).
    function contextSize() {
      var n = Math.round(Number(opts.context) || 0);
      return Math.max(0, Math.min(MAX_CONTEXT, n));
    }

    function ensureStyle() {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-hoverlight', '');
        (document.head || document.documentElement).appendChild(styleEl);
      }
      var bg = hexToRgba(opts.color, opts.opacity);
      var bgAround = hexToRgba(opts.color, opts.opacity * CONTEXT_STRENGTH);
      styleEl.textContent =
        '::highlight(' + HIGHLIGHT_NAME + '){background-color:' + bg + ';}' +
        '::highlight(' + CONTEXT_NAME + '){background-color:' + bgAround + ';}' +
        '.hoverlight-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483646;}' +
        '.hoverlight-overlay>div{position:fixed;border-radius:3px;background:' + bg + ';mix-blend-mode:multiply;}' +
        '.hoverlight-overlay>div.around{background:' + bgAround + ';}';
    }

    function paint(sel) {
      if (supportsHighlightAPI) {
        CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(sel.focus));
        if (sel.around.length) CSS.highlights.set(CONTEXT_NAME, new Highlight(...sel.around));
        else CSS.highlights.delete(CONTEXT_NAME);
        return;
      }
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.className = 'hoverlight-overlay';
        document.documentElement.appendChild(overlayEl);
      }
      overlayEl.textContent = '';
      function boxes(range, cls) {
        var rects = range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i], d = document.createElement('div');
          if (cls) d.className = cls;
          d.style.left = r.left + 'px'; d.style.top = r.top + 'px';
          d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
          overlayEl.appendChild(d);
        }
      }
      sel.around.forEach(function (r) { boxes(r, 'around'); });
      boxes(sel.focus, '');
    }

    function clear() {
      current = null;
      if (supportsHighlightAPI) {
        CSS.highlights.delete(HIGHLIGHT_NAME);
        CSS.highlights.delete(CONTEXT_NAME);
      }
      if (overlayEl) overlayEl.textContent = '';
    }

    // Sentences of a block, already trimmed of surrounding whitespace, empty ones dropped.
    function blockInfo(block) {
      if (cache && cache.block === block) return cache;
      var info = collectBlockText(block);
      var text = info.text;
      var sentences = [];
      splitSentences(text, langOf(block)).forEach(function (span) {
        var s = span[0], e = span[1];
        while (s < e && /\s/.test(text[s])) s++;
        while (e > s && /\s/.test(text[e - 1])) e--;
        if (e > s) sentences.push([s, e]);
      });
      cache = { block: block, info: info, sentences: sentences };
      return cache;
    }

    function rangeFor(info, start, end) {
      var a = locate(info, start, false);
      var b = locate(info, end, true);
      var range = document.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      return range;
    }

    // The focus sentence under (textNode, offset) plus its neighbours in the same block.
    function selectionAt(textNode, offset) {
      var block = blockAncestor(textNode);
      var c = blockInfo(block);
      var idx = c.info.nodes.indexOf(textNode);
      if (idx < 0 || !c.sentences.length) return null;
      var pos = c.info.starts[idx] + offset;

      // the sentence containing pos; on whitespace between two sentences, take the next one
      var index = c.sentences.length - 1;
      for (var i = 0; i < c.sentences.length; i++) {
        if (pos < c.sentences[i][1]) { index = i; break; }
      }

      var ctx = contextSize();
      if (current && current.block === block && current.index === index && current.context === ctx) {
        return current; // unchanged
      }
      var around = [];
      for (var j = Math.max(0, index - ctx); j <= Math.min(c.sentences.length - 1, index + ctx); j++) {
        if (j !== index) around.push(rangeFor(c.info, c.sentences[j][0], c.sentences[j][1]));
      }
      return {
        block: block,
        index: index,
        context: ctx,
        focus: rangeFor(c.info, c.sentences[index][0], c.sentences[index][1]),
        around: around
      };
    }

    // Keep the highlight if the pointer is in the gap between lines of the
    // same sentence, so it doesn't flicker as you move down a paragraph.
    function stillInsideCurrent(x, y) {
      if (!current) return false;
      var ranges = [current.focus].concat(current.around);
      for (var k = 0; k < ranges.length; k++) {
        var rects = ranges[k].getClientRects();
        for (var i = 0; i < rects.length; i++) {
          if (rectContains(rects[i], x, y, 4)) return true;
        }
      }
      return false;
    }

    function update() {
      frame = 0;
      if (!opts.enabled || !lastPoint) return;
      if (tapOnce) { tapOnce = false; var p = lastPoint; lastPoint = null; return updateAt(p.x, p.y); }
      updateAt(lastPoint.x, lastPoint.y);
    }

    function updateAt(x, y) {

      var target = document.elementFromPoint(x, y);
      var scope = root();
      if (!target || (scope !== document && !scope.contains(target)) || isEditable(target) || isSkipped(target)) {
        clear();
        return;
      }

      var caret = caretFromPoint(x, y);
      if (!caret || !caret.node || caret.node.nodeType !== 3 ||
          !caret.node.data.trim() || !pointerIsOnText(caret.node, caret.offset, x, y) ||
          isSkipped(caret.node.parentElement) ||
          (scope !== document && !scope.contains(caret.node))) {
        if (!stillInsideCurrent(x, y)) clear();
        return;
      }

      var next = selectionAt(caret.node, caret.offset);
      if (!next) { clear(); return; }
      if (next !== current) {
        current = next;
        paint(current);
      } else if (!supportsHighlightAPI) {
        paint(current); // overlay boxes must follow scrolling
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function onMove(e) {
      if (e.pointerType === 'touch') return;
      lastPoint = { x: e.clientX, y: e.clientY };
      schedule();
    }
    // Touch screens have no hover, so a tap selects the sentence instead.
    function onDown(e) {
      if (e.pointerType !== 'touch') return;
      lastPoint = { x: e.clientX, y: e.clientY };
      tapOnce = true;
      schedule();
    }
    function onLeave(e) {
      if (!e.relatedTarget) { lastPoint = null; clear(); }
    }
    function onScroll() {
      if (lastPoint) schedule(); // the text under a still pointer changes as you scroll
    }

    function attach() {
      ensureStyle();
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerout', onLeave, { passive: true });
      document.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      // throw away cached sentences when the page's text changes
      observer = new MutationObserver(function () { cache = null; current = null; });
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }

    function detach() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onLeave);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (observer) observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clear();
    }

    attach();
    if (!opts.enabled) clear();

    return {
      setOptions: function (next) {
        Object.assign(opts, next || {});
        ensureStyle();
        if (!opts.enabled) clear();
        else if (current && current.context !== contextSize()) {
          // rebuild the neighbours around the same focus sentence
          var c = blockInfo(current.block), f = c.sentences[current.index];
          var node = locate(c.info, f[0], false);
          current = null;
          var sel = selectionAt(node.node, node.offset);
          if (sel) { current = sel; paint(current); }
        }
        else if (current) paint(current);
      },
      getOptions: function () { return Object.assign({}, opts); },
      refresh: function () { cache = null; current = null; schedule(); },
      destroy: function () {
        detach();
        if (styleEl) styleEl.remove();
        if (overlayEl) overlayEl.remove();
      }
    };
  }

  global.Hoverlight = {
    create: create,
    splitSentences: splitSentences,
    version: '1.2.0'
  };
})(typeof window !== 'undefined' ? window : this);
