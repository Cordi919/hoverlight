"""Hover tests for the core script in headless Chromium.

Run: python3 tests/test_core.py   (needs: pip install playwright && playwright install chromium)
Pointer positions are computed from text ranges, never hard-coded,
because layout differs between viewports and fonts.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CORE = (ROOT / "extension/hoverlight.js").read_text(encoding="utf-8")
FIXTURE = (ROOT / "tests/fixture.html").as_uri()

GET_CTX = "(()=>{const h=CSS.highlights.get('hoverlight-context');return h?[...h].map(r=>r.toString()):[]})()"
GET_HL = "(()=>{const h=CSS.highlights.get('hoverlight-sentence');return h?[...h][0].toString():null})()"
WORD_CENTER = """([sel,word])=>{const el=document.querySelector(sel);const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
for(let n=w.nextNode();n;n=w.nextNode()){const i=n.data.indexOf(word);if(i>=0){const r=document.createRange();
r.setStart(n,i);r.setEnd(n,i+word.length);const b=r.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}}}"""

CASES = [
    ("#p1", "first",  "The first sentence is short."),
    ("#p1", "bold",   "The second one has bold words and a link that ends here."),
    ("#p1", "link",   "The second one has bold words and a link that ends here."),
    ("#p1", "third",  "Then a third sentence follows!"),
    ("#p1", "fourth", "Is this the fourth?"),
    ("#p2", "第二",    "这是第二句，里面有强调的词。"),
    ("#p2", "强调",    "这是第二句，里面有强调的词。"),
    ("#p2", "第三",    "第三句在这里！"),
    ("#li1", "Still", "Still item one."),
]

def main():
    failures = 0
    checks = [0]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 900, "height": 700})
        page.goto(FIXTURE)
        page.add_script_tag(content=CORE)
        page.evaluate("window.h = Hoverlight.create({color:'#7cc4ff', opacity:.5})")

        def check(label, got, want):
            nonlocal failures
            ok = got == want
            checks[0] += 1
            failures += not ok
            print(("PASS " if ok else "FAIL ") + f"{label}: {got!r}" + ("" if ok else f" (wanted {want!r})"))

        for sel, word, want in CASES:
            page.mouse.move(*page.evaluate(WORD_CENTER, [sel, word])); page.wait_for_timeout(60)
            check(word, page.evaluate(GET_HL), want)

        box = page.locator("#ta").bounding_box()
        page.mouse.move(box["x"] + 20, box["y"] + 12); page.wait_for_timeout(60)
        check("textarea ignored", page.evaluate(GET_HL), None)

        page.mouse.move(880, 680); page.wait_for_timeout(60)
        check("margin ignored", page.evaluate(GET_HL), None)

        # context sentences: neighbours in the same paragraph, never across paragraphs
        S1, S2, S3, S4 = ("The first sentence is short.",
                          "The second one has bold words and a link that ends here.",
                          "Then a third sentence follows!", "Is this the fourth?")
        CONTEXT_CASES = [
            (1, "#p1", "third", S3, [S2, S4]),
            (1, "#p1", "first", S1, [S2]),               # start of paragraph: nothing before
            (2, "#p1", "first", S1, [S2, S3]),
            (2, "#p1", "fourth", S4, [S2, S3]),          # end of paragraph: nothing after
            (1, "#p2", "第二", "这是第二句，里面有强调的词。", ["这是第一句话。", "第三句在这里！"]),
            (2, "#li1", "Still", "Still item one.", ["List item one."]),  # stays inside the <li>
            (0, "#p1", "third", S3, []),
        ]
        for ctx, sel, word, want_focus, want_around in CONTEXT_CASES:
            page.mouse.move(5, 5); page.wait_for_timeout(40)
            page.evaluate(f"h.setOptions({{context:{ctx}}})")
            page.mouse.move(*page.evaluate(WORD_CENTER, [sel, word])); page.wait_for_timeout(60)
            check(f"context {ctx} on {word}", (page.evaluate(GET_HL), page.evaluate(GET_CTX)), (want_focus, want_around))

        # changing the setting while hovering updates the neighbours in place
        page.evaluate("h.setOptions({context:1})"); page.wait_for_timeout(40)
        check("live context change", page.evaluate(GET_CTX), [S2, S4])
        page.evaluate("h.setOptions({context:0})")

        x, y = page.evaluate(WORD_CENTER, ["#p1", "bold"])
        page.evaluate("h.setOptions({enabled:false})")
        page.mouse.move(x + 1, y); page.wait_for_timeout(60)
        check("disabled", (page.evaluate(GET_HL), page.evaluate(GET_CTX)), (None, []))
        browser.close()
    print(f"\n{checks[0] - failures} passed, {failures} failed")
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    main()
