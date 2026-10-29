"""Render the store listing images into store/images/.

    python3 scripts/make_store_images.py

Needs Playwright + Chromium, and the Lexend and Literata fonts installed locally
(screenshots can't fetch Google Fonts). Every highlight in these images is drawn
by the real extension/hoverlight.js, and the popup is a screenshot of the real
extension popup, so the listing never shows anything the extension can't do.

Outputs
  screenshot-1-hover.png      1280x800  Chrome / Edge / Firefox screenshots
  screenshot-2-context.png    1280x800
  screenshot-3-settings.png   1280x800
  promo-small-440x280.png     Chrome small promo tile
  promo-marquee-1400x560.png  Chrome marquee tile (optional)
  logo-300.png                Edge store logo
"""
import base64
import json
import shutil
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
OUT = ROOT / "store" / "images"
CORE = (EXT / "hoverlight.js").read_text(encoding="utf-8")
CONFIG = (EXT / "defaults.js").read_text(encoding="utf-8")
ARTICLE = (ROOT / "store" / "article.html").read_text(encoding="utf-8")
BASE_CSS = (ROOT / "site" / "base.css").read_text(encoding="utf-8")
LOGO = (ROOT / "site" / "logo.svg.html").read_text(encoding="utf-8")

FRAME = """<!doctype html><html><head><meta charset="utf-8"><style>
{base}
html, body {{ margin: 0; width: {w}px; height: {h}px; overflow: hidden; }}
body {{ background: var(--paper); }}
.wrap {{ position: relative; width: 100%; height: 100%; padding: 56px 72px 0; box-sizing: border-box; }}
.caption {{ display: flex; align-items: center; gap: 14px; margin: 0 0 36px; }}
.caption svg {{ flex: none; }}
.caption h2 {{ margin: 0; font: 600 34px/1.15 var(--font-ui); letter-spacing: -0.02em; color: var(--ink); }}
.window {{
  position: absolute; left: 72px; right: 72px; top: 150px; bottom: -24px;
  background: #fffdf8; border: 1px solid var(--rule); border-radius: 14px 14px 0 0;
  box-shadow: 0 30px 60px -30px rgba(30,51,41,.35); overflow: hidden;
}}
.bar {{ height: 40px; border-bottom: 1px solid var(--rule); display: flex; align-items: center; gap: 8px; padding: 0 18px; }}
.bar i {{ width: 11px; height: 11px; border-radius: 50%; background: var(--rule); }}
.bar .tool {{ margin-left: auto; display: flex; align-items: center; justify-content: center; width: 30px; height: 26px; border-radius: 6px; }}
.bar .tool.on {{ background: rgba(47,91,69,.12); }}
.article {{ max-width: 660px; margin: 40px 0 0 90px; color: #24302a; font: 400 19px/1.85 var(--font-read); }}
.article .kicker {{ font: 600 12px/1 var(--font-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); margin: 0 0 12px; }}
.article h1 {{ font: 600 32px/1.2 var(--font-ui); letter-spacing: -0.02em; margin: 0 0 22px; color: var(--ink); }}
.article p {{ margin: 0 0 20px; }}
.popup {{ position: absolute; right: 26px; top: 46px; width: 320px; border-radius: 12px; box-shadow: 0 24px 50px -16px rgba(30,51,41,.45), 0 0 0 1px rgba(30,51,41,.08); }}
</style></head><body>
{logo}
<div class="wrap">
  <div class="caption"><svg width="34" height="29" aria-hidden="true"><use href="#logo"/></svg><h2>{caption}</h2></div>
  <div class="window">
    <div class="bar"><i></i><i></i><i></i><span class="tool{tool_on}"><svg width="19" height="16"><use href="#logo"/></svg></span></div>
    {article}
    {popup}
  </div>
</div>
<script>{config}</script><script>{core}</script>
</body></html>"""

TILE = """<!doctype html><html><head><meta charset="utf-8"><style>
{base}
html, body {{ margin: 0; width: {w}px; height: {h}px; overflow: hidden; }}
body {{ background: var(--paper); display: flex; align-items: center; }}
.tile {{ display: flex; align-items: center; gap: {gap}px; padding: 0 {pad}px; }}
.name {{ font: 600 {name_size}px/1 var(--font-ui); letter-spacing: -0.02em; color: var(--ink); margin: 0 0 {name_gap}px; }}
.line {{ font: 500 {line}px/1.35 var(--font-ui); letter-spacing: -0.01em; color: var(--ink); margin: 0; }}
.line span {{ background: linear-gradient(transparent 12%, #f5d77a 12% 90%, transparent 90%); border-radius: 4px; padding: 0 .05em; }}
</style></head><body>{logo}
<div class="tile"><svg width="{lw}" height="{lh}" aria-hidden="true"><use href="#logo"/></svg>
<div><p class="name">Hoverlight</p><p class="line">{line_html}</p></div></div></body></html>"""


def word_point(page, word):
    return page.evaluate("""(word) => {
      const w = document.createTreeWalker(document.querySelector('.article'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const i = n.data.indexOf(word);
        if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + word.length);
          const b = r.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }
      }
    }""", word)


def popup_png(p, tmp):
    """Screenshot the real extension popup with Context set to ±1."""
    ctx = p.chromium.launch_persistent_context(str(tmp / "profile"), channel="chromium", headless=True,
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
    eid = sw.url.split("/")[2]
    page = ctx.new_page()
    page.set_viewport_size({"width": 320, "height": 700})
    page.goto(f"chrome-extension://{eid}/popup.html")
    page.click("#context button:nth-child(2)")
    page.wait_for_timeout(200)
    page.mouse.move(150, 108)  # hover the preview so it shows a live highlight
    page.wait_for_timeout(150)
    height = page.evaluate("document.body.scrollHeight")
    path = tmp / "popup.png"
    page.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": 320, "height": height})
    ctx.close()
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def shoot(browser, name, caption, hover_word, options, popup=""):
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.set_content(FRAME.format(base=BASE_CSS, w=1280, h=800, logo=LOGO, caption=caption,
        article=ARTICLE, popup=popup, config=CONFIG, core=CORE,
        tool_on=" on" if popup else ""))
    page.evaluate(f"window.hl = Hoverlight.create({json.dumps(options)})")
    page.mouse.move(*word_point(page, hover_word))
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / name))
    page.close()
    print("wrote", (OUT / name).relative_to(ROOT))


def tile(browser, filename, w, h, **kw):
    page = browser.new_page(viewport={"width": w, "height": h})
    page.set_content(TILE.format(base=BASE_CSS, w=w, h=h, logo=LOGO, **kw))
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUT / filename))
    page.close()
    print("wrote", (OUT / filename).relative_to(ROOT))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    try:
        with sync_playwright() as p:
            popup = f'<img class="popup" src="{popup_png(p, tmp)}" alt="">'
            browser = p.chromium.launch()
            base = {"color": "#f5d77a", "opacity": 0.55}
            shoot(browser, "screenshot-1-hover.png", "Rest your mouse on a sentence. It lights up.",
                  "measures direction", dict(base, context=0))
            shoot(browser, "screenshot-2-context.png", "Turn on Context to keep nearby sentences in view.",
                  "Because the sun", dict(base, context=1))
            shoot(browser, "screenshot-3-settings.png", "Your colour, your strength, one click away.",
                  "it simply flies", dict(base, context=1), popup=popup)
            line = "Rest your mouse on a sentence. <span>It lights up.</span>"
            tile(browser, "promo-small-440x280.png", 440, 280, gap=24, pad=36, name_size=36, name_gap=12,
                 line=16, lw=70, lh=59, line_html=line.replace(" <span>", "<br><span>"))
            tile(browser, "promo-marquee-1400x560.png", 1400, 560, gap=56, pad=150, name_size=84, name_gap=26,
                 line=40, lw=150, lh=127, line_html=line)
            page = browser.new_page(viewport={"width": 300, "height": 300})
            page.set_content(f"<style>{BASE_CSS} html,body{{margin:0;width:300px;height:300px;background:var(--paper);"
                             f"display:grid;place-items:center}}</style>{LOGO}"
                             '<svg width="196" height="166"><use href="#logo"/></svg>')
            page.screenshot(path=str(OUT / "logo-300.png"))
            print("wrote", (OUT / "logo-300.png").relative_to(ROOT))
            browser.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
