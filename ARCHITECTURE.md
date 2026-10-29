# Architecture

Hoverlight is small on purpose: one core file, a thin extension shell around it, and a static website that runs the same core as a live demo.

## Layout

```
extension/hoverlight.js   core; no dependencies; exposes window.Hoverlight.create(options)
extension/defaults.js     single source of default settings, colour presets, context options
extension/content.js      runs on every page; reads settings, passes them to the core
extension/popup.*         settings UI; runs the core on its own preview paragraph
extension/background.js   keyboard shortcut and toolbar badge
site/*.src.html           website sources; base.css and the logo are shared partials
docs/                     website output for GitHub Pages (generated)
scripts/build_site.py     builds docs/ and inlines defaults.js + hoverlight.js into the demo
scripts/package.py        store zips; derives the Firefox manifest from the Chrome one
tests/test_core.py        Playwright tests against tests/fixture.html
```

Only `hoverlight.js` contains highlighting logic. Everything else passes options in. The demo page, the popup preview and the extension therefore always behave the same.

## The core, step by step

1. **Find the character.** On `pointermove` (throttled to one check per animation frame), `caretPositionFromPoint` returns the text position under the pointer. Browsers return the *nearest* caret even over blank space, so `pointerIsOnText()` confirms the pointer is inside the glyph box of the character at that position. Without this check, margins and line gaps would light up random sentences.

2. **Gather the block.** The nearest ancestor with a non-inline `display` is the block. All of its text nodes are joined into one string, skipping text that belongs to nested blocks, code, form controls and anything marked `data-hoverlight-ignore`. Joining is what lets a sentence span `<b>`, `<a>` and `<em>`; `locate()` maps string offsets back to `(node, offset)` pairs for building `Range`s.

3. **Split into sentences.** `Intl.Segmenter` with `granularity: 'sentence'`, using the nearest `lang` attribute. Sentences are trimmed and empty ones dropped once per block, then cached until a `MutationObserver` sees the page change.

4. **Pick the focus and its neighbours.** `selectionAt()` returns the sentence containing the pointer. If the pointer is on whitespace between two sentences, it takes the next one. With `context` set to 1 or 2, it also returns that many sentences on each side, **within the same block only**. Crossing into the next paragraph would mix unrelated content and makes the highlight jump unpredictably.

5. **Paint.** Two named highlights from the CSS Custom Highlight API: `hoverlight-sentence` for the focus and `hoverlight-context` for neighbours at 45% of the focus opacity, so the sentence being read always stands out. Nothing is inserted into the page, so layout, selection and copy-paste are unaffected. Browsers without the API get an absolutely positioned overlay as a fallback.

### Edge cases handled

| Case | Handling |
| --- | --- |
| Pointer in the gap between two lines of the same sentence | `stillInsideCurrent()` keeps the highlight while the pointer is within the painted rectangles, which prevents flicker. |
| Touch screens (no hover) | A tap selects the sentence. The tap point is used once, so later scrolling doesn't re-highlight whatever ends up under it. |
| Scrolling with a still mouse | The text under the pointer changes, so scroll schedules a re-check. |
| Changing `context` while hovering | `setOptions()` rebuilds the neighbours around the same focus sentence. |
| Text boxes, contenteditable, buttons, code | Ignored. |

## Settings

`defaults.js` defines `HoverlightConfig.{DEFAULTS, PRESETS, CONTEXT_OPTIONS}`. It is listed first in the manifest's content scripts, loaded with `<script>` in the popup, loaded with `importScripts()` by the Chrome service worker, listed first in Firefox's background scripts, and inlined into the website at build time. Changing a colour or a default therefore happens in one place.

Settings live in `chrome.storage.sync`. The content script listens for changes, so updates from the popup or the keyboard shortcut apply to open tabs immediately.

## Browsers

`extension/manifest.json` targets Chrome and Edge (Manifest V3, service worker). `scripts/package.py` derives the Firefox manifest from it: background scripts instead of a service worker, a gecko ID, and `data_collection_permissions: { required: ["none"] }`. Firefox 140 or later is required.

## Website

`site/index.src.html` and `site/privacy.src.html` share `site/base.css` (palette, type and spacing scale, page frame) and the logo symbol. `build_site.py` inlines those, fills store buttons and footer links from `site.json`, and writes full documents to `docs/`. Empty store links render as "coming soon", so the site can launch before the listings are approved.

The page layout is a single 4-column grid. Every block starts and ends on a column line, and all cards share one padding and radius token. That keeps the reading card, settings panel, comparison figures and step lists aligned.

## Testing

`tests/test_core.py` loads `tests/fixture.html` in headless Chromium, injects the core, moves the real mouse, and reads back `CSS.highlights`. Mouse positions are computed from text ranges rather than hard-coded, because layout varies with viewport and fonts. The cases cover sentences across inline elements, Chinese punctuation, list items, ignored regions, margins, disabling, and every context setting including paragraph edges and switching mid-hover.
