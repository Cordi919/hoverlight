# Store listing

Live listings: [Chrome Web Store](https://chromewebstore.google.com/detail/hoverlight-%E2%80%94-sentence-rea/pggkiefgeaeoiaiikofdkokpdhlopjne) · [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/hoverlight/) · Edge: not submitted yet.

Copy-paste text and answers for the Chrome Web Store, Microsoft Edge Add-ons and
Firefox Add-ons. Images are in [`images/`](images/) and are regenerated with
`python3 scripts/make_store_images.py`.



---

## Shared text

**Name**

```
Hoverlight — Sentence Reading Guide
```

**Short description** (Chrome summary is the manifest description, max 132 characters; Firefox summary max 250)

```
Rest your mouse on a sentence and the whole sentence lights up. A gentle reading guide for dyslexia, ADHD and tired eyes.
```

**Detailed description**

```
Rest your mouse on a sentence and the whole sentence lights up.

Hoverlight is a reading guide for people who lose their place on the page: readers with dyslexia or ADHD, people reading in a second language, or anyone whose eyes keep slipping to the wrong line on a long article.

It works like the coloured overlay strip some readers keep on their desk, with one difference. A paper strip, like most on-screen reading rulers, only knows about lines. Hoverlight follows sentences, so when a sentence starts in the middle of one line and ends on the next, all of it stays lit.

There is no overlay and no separate reader view. You read the page as it is, links stay clickable, and nothing shifts.

FEATURES
• Hover over any sentence to highlight it. No clicking.
• Six soft colours, or pick any colour you like.
• Adjustable strength, from a faint tint to a bold band.
• Context: also light the one or two sentences before and after, in a softer shade.
• Works across bold text, links and line breaks.
• Understands sentence endings in many languages.
• Leaves text boxes alone, so it never gets in the way of typing.
• Pause it on any website with one click.
• Keyboard shortcut to switch it on and off: Option+Shift+H on Mac, Alt+Shift+H on Windows.

WHERE IT WORKS
• Most web pages: articles, news, Wikipedia, documentation, online textbooks and course pages.
• Chrome, Edge, Brave and Arc on Mac, Windows, Linux and ChromeOS. Also available for Firefox.
• Mouse, trackpad, or tap on a touch-screen laptop.

WHERE IT DOESN'T WORK YET
• PDFs opened in the browser's built-in PDF viewer (browsers don't allow extensions there).
• Google Docs while editing, and other editors that draw text on a canvas.
• Desktop apps outside the browser, scanned pages and text inside images.
• Safari and mobile browsers.

PRIVACY
Hoverlight does not collect, store or send any data. It has no analytics, no accounts and makes no network requests. Only your settings are saved, in your browser.

Hoverlight is free and open source.
Try the live demo: https://cordi919.github.io/hoverlight/
Source code: https://github.com/cordi919/hoverlight
```

**Links**

| Field | Value |
| --- | --- |
| Homepage / website | `https://cordi919.github.io/hoverlight/` |
| Support | `https://github.com/cordi919/hoverlight/issues` |
| Privacy policy | `https://cordi919.github.io/hoverlight/privacy.html` |

---

## Chrome Web Store

Upload: `dist/hoverlight-chrome-<version>.zip` (run `python3 scripts/package.py`).

**Store listing tab**

| Field | Value |
| --- | --- |
| Category | Accessibility |
| Language | English |
| Store icon | uses `extension/icons/icon128.png` from the package |
| Screenshots | `images/screenshot-1-hover.png`, `-2-context.png`, `-3-settings.png` (1280×800) |
| Small promo tile | `images/promo-small-440x280.png` |
| Marquee promo tile | `images/promo-marquee-1400x560.png` (optional) |

**Privacy tab**

Single purpose description:

```
Highlights the sentence under the user's mouse pointer (and optionally the sentences around it) on web pages, to help people keep their place while reading.
```

Permission justifications:

| Permission | Justification |
| --- | --- |
| `storage` | `Saves the user's settings: on/off, highlight colour, strength, number of context sentences, and websites where the user paused the extension.` |
| `activeTab` | `Lets the settings popup read the current tab's website address, so the user can pause the extension on that website only.` |
| Host permission (content script on all URLs) | `The extension's only feature is highlighting the sentence under the mouse on whatever page the user is reading, so the content script must run on all pages. It reads page text locally to find sentence boundaries and colours them with the CSS Highlight API. Page content is never stored or sent anywhere.` |

| Question | Answer |
| --- | --- |
| Are you using remote code? | **No.** All JavaScript is included in the package. |
| Data usage: what user data do you collect? | Check **nothing**. |
| Certifications | Check all three (no selling data, no unrelated use, no creditworthiness use). |
| Privacy policy URL | `https://cordi919.github.io/hoverlight/privacy.html` |

**Distribution tab:** Public, all regions.

---

## Microsoft Edge Add-ons

Upload the **same Chrome zip**. Edge Add-ons runs Chrome extensions unchanged.

| Field | Value |
| --- | --- |
| Category | Accessibility |
| Store logo | `images/logo-300.png` |
| Screenshots | the same three 1280×800 images |
| Small promotional tile | `images/promo-small-440x280.png` |
| Privacy policy URL | as above |
| Notes for certification | `No login needed. Open any article, enable the extension, and rest the mouse on a sentence. Settings are in the toolbar popup. Shortcut: Alt+Shift+H.` |

---

## Firefox Add-ons (addons.mozilla.org)

Upload: `dist/hoverlight-firefox-<version>.zip`. Choose **"On this site"** (listed on AMO).

| Field / question | Value |
| --- | --- |
| Summary | the short description above |
| Description | the detailed description above |
| Category | the closest available, for example *Appearance* or *Other* |
| Support site / email | GitHub issues link above |
| Privacy policy | paste the text of `docs/privacy.html` or link to it |
| Does it use minified, concatenated or machine-generated code? | **No.** Source is uploaded as written. |
| Screenshots | the same three images |
| Notes to reviewer | `No login needed. Open any article and rest the mouse on a sentence. Settings are in the toolbar popup. The extension makes no network requests and declares data_collection_permissions: none.` |

The Firefox manifest is generated by `scripts/package.py`. It declares
`data_collection_permissions: { required: ["none"] }`, which Mozilla requires for
all new add-ons, and needs Firefox 140 or later.
