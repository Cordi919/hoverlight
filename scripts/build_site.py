"""Build the website in docs/ (served by GitHub Pages) from the sources in site/.

    python3 scripts/build_site.py

What it does
  * Inlines shared pieces into each page: site/base.css, the logo, and for the
    demo extension/defaults.js + extension/hoverlight.js (so the live demo runs
    the exact code that ships in the extension).
  * Fills in store buttons, footer links and the contact line from site.json.
    Empty links render as "coming soon", so the site can go live before the
    store listings are approved.
  * Writes full HTML documents to docs/, plus bare copies to dist/preview/ for
    previewing outside GitHub Pages.

Edit files in site/ and site.json. Never edit docs/*.html by hand.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "docs"
PREVIEW = ROOT / "dist" / "preview"
PAGES = ["index", "privacy"]

LOGO_FAVICON = (
    "data:image/svg+xml,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 22'%3E"
    "%3Crect y='1' width='17' height='5' rx='2.5' fill='%233e7357'/%3E"
    "%3Crect y='8.5' width='26' height='5' rx='2.5' fill='%23f0c854'/%3E"
    "%3Crect y='16' width='12' height='5' rx='2.5' fill='%239cc48f'/%3E%3C/svg%3E"
)

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f7f2df" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111a15" media="(prefers-color-scheme: dark)">
<link rel="icon" href="{favicon}">
{head}
</head>
<body>
{body}
</body>
</html>
"""

STORES = [
    ("chrome", "Add to Chrome", "primary"),
    ("edge", "Add to Edge", ""),
    ("firefox", "Add to Firefox", ""),
]


def esc(url):
    return html.escape(url, quote=True)


def cta(links):
    parts = []
    for key, label, cls in STORES:
        url = links.get(key, "").strip()
        if url:
            parts.append(f'<a class="btn {cls}" href="{esc(url)}" rel="noopener">{label}</a>')
        else:
            name = label.replace("Add to ", "")
            parts.append(f'<span class="btn soon" aria-disabled="true">{name} <small>coming soon</small></span>')
    gh = links.get("github", "").strip()
    if gh:
        parts.append(f'<a class="text-link" href="{esc(gh)}" rel="noopener">View source on GitHub</a>')
    return "\n      ".join(parts)


def footer_links(links, page):
    items = [("./", "Home")] if page != "index" else [("#install", "Get started")]
    items.append(("privacy.html", "Privacy"))
    gh = links.get("github", "").strip()
    if gh:
        items.append((gh, "GitHub"))
    return " ".join(f'<a href="{esc(u)}">{t}</a>' for u, t in items)


def contact(links):
    email = links.get("email", "").strip()
    gh = links.get("github", "").strip()
    if email:
        return f' at <a href="mailto:{esc(email)}">{html.escape(email)}</a>'
    if gh:
        return f' as an <a href="{esc(gh.rstrip("/"))}/issues">issue on GitHub</a>'
    return ""


def build():
    links = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    parts = {
        "/*BASE_CSS*/": (SITE / "base.css").read_text(encoding="utf-8"),
        "<!--LOGO-->": (SITE / "logo.svg.html").read_text(encoding="utf-8"),
        "/*DEFAULTS*/": (ROOT / "extension/defaults.js").read_text(encoding="utf-8"),
        "/*CORE*/": (ROOT / "extension/hoverlight.js").read_text(encoding="utf-8"),
        "<!--CTA-->": cta(links),
        "<!--CONTACT-->": contact(links),
    }
    OUT.mkdir(exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    (OUT / ".nojekyll").write_text("")  # serve files as-is, no Jekyll processing

    for page in PAGES:
        src = (SITE / f"{page}.src.html").read_text(encoding="utf-8")
        assert src.count("<!--BODY-->") == 1, f"{page}: needs exactly one <!--BODY--> marker"
        src = src.replace("<!--FOOTER_LINKS-->", footer_links(links, page))
        for marker, value in parts.items():
            assert src.count(marker) <= 1, f"{page}: {marker} appears more than once"
            src = src.replace(marker, value)
        head, body = src.split("<!--BODY-->")
        head = "\n".join(l for l in head.splitlines() if "claude:viewport-fit-sides" not in l)
        (OUT / f"{page}.html").write_text(
            HEAD.format(favicon=LOGO_FAVICON, head=head.strip(), body=body.strip()), encoding="utf-8")
        (PREVIEW / f"{page}.html").write_text(src.replace("<!--BODY-->", ""), encoding="utf-8")
        print(f"built docs/{page}.html")


if __name__ == "__main__":
    build()
