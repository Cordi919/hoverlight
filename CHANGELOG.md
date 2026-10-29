# Changelog

## [Unreleased]

### Added
- Firefox support: `scripts/package.py` builds a Firefox package from the same source.
- Website for GitHub Pages with a live demo, store buttons and a privacy policy.
- Store listing text and images (`store/`).
- Tests run automatically on GitHub Actions.

## [1.2.0] — 2026-10-29

### Added
- **Context** setting: also highlight 1 or 2 sentences before and after the hovered one, in a softer shade, within the same paragraph.

### Changed
- Sentence boundaries are computed and trimmed once per paragraph and cached, instead of on every pointer move.

## [1.1.0] — 2026-10-29

### Changed
- New visual identity: warm neutral palette and a logo made of three highlighted lines.
- New colour presets: Butter, Sage, Mist, Apricot, Lilac, Blush. Default strength 55%.
- Default settings and presets now live in one file, `extension/defaults.js`.

## [1.0.0] — 2026-10-29

### Added
- Highlight the whole sentence under the mouse, across bold text, links and line breaks.
- Colour presets, custom colour and strength.
- Pause per site; <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> to toggle everywhere.
- Tap to highlight on touch screens.
