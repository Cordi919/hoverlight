"""Package the extension for each store.

    python3 scripts/package.py

Creates in dist/:
  hoverlight-chrome-<version>.zip   Chrome Web Store and Microsoft Edge Add-ons
  hoverlight-firefox-<version>.zip  Firefox Add-ons (AMO)

extension/manifest.json is the Chrome manifest. The Firefox manifest is derived
from it here, so there is only one manifest to maintain.
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
DIST = ROOT / "dist"

FIREFOX = {
    "id": "hoverlight@hoverlight-reader",
    "min_version": "140.0",  # first release with data_collection_permissions + CSS Highlight API
}


def firefox_manifest(chrome):
    m = json.loads(json.dumps(chrome))
    # Firefox MV3 runs background code as an event page, not a service worker.
    m["background"] = {"scripts": ["defaults.js", "background.js"]}
    m["browser_specific_settings"] = {
        "gecko": {
            "id": FIREFOX["id"],
            "strict_min_version": FIREFOX["min_version"],
            "data_collection_permissions": {"required": ["none"]},
        }
    }
    return m


def write_zip(path, manifest):
    files = sorted(p for p in EXT.rglob("*") if p.is_file() and p.name != "manifest.json"
                   and not p.name.startswith("."))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2) + "\n")
        for f in files:
            z.write(f, f.relative_to(EXT).as_posix())
    print(f"wrote {path.relative_to(ROOT)} ({len(files) + 1} files)")


def main():
    chrome = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    version = chrome["version"]
    DIST.mkdir(exist_ok=True)
    write_zip(DIST / f"hoverlight-chrome-{version}.zip", chrome)
    write_zip(DIST / f"hoverlight-firefox-{version}.zip", firefox_manifest(chrome))


if __name__ == "__main__":
    main()
