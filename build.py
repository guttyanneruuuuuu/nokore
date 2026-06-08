#!/usr/bin/env python3
"""Inline game.js into index.html to produce a single self-contained file.

Usage:
    python3 build.py

Reads game.js + index_template (the current index.html with either an external
<script src="./game.js"> tag OR an existing inlined module) and regenerates a
single-file index.html. Three.js stays as a CDN importmap dependency.
"""
import re
import sys

GAME_JS = "game.js"
INDEX = "index.html"

PLACEHOLDER_EXTERNAL = '<script type="module" src="./game.js"></script>'

def main():
    with open(GAME_JS, "r", encoding="utf-8") as f:
        js = f.read()

    # Strip any developer autotest block: keep everything before the
    # DOMContentLoaded init and append a clean init.
    idx = js.find("window.addEventListener('DOMContentLoaded'")
    if idx == -1:
        print("ERROR: could not find DOMContentLoaded init in game.js", file=sys.stderr)
        sys.exit(1)
    js_core = js[:idx] + "window.addEventListener('DOMContentLoaded',()=>{ window.GAME=new Game(); });\n"

    with open(INDEX, "r", encoding="utf-8") as f:
        html = f.read()

    inline = '<script type="module">\n' + js_core + '\n</script>'

    if PLACEHOLDER_EXTERNAL in html:
        html = html.replace(PLACEHOLDER_EXTERNAL, inline)
    else:
        # Replace an already-inlined module block (between the importmap script
        # and </body>). Match the last <script type="module"> ... </script>.
        pattern = re.compile(r'<script type="module">.*?</script>', re.DOTALL)
        matches = list(pattern.finditer(html))
        if not matches:
            print("ERROR: no module script to replace in index.html", file=sys.stderr)
            sys.exit(1)
        # The importmap is type="importmap"; module blocks are the game.
        last = matches[-1]
        html = html[:last.start()] + inline + html[last.end():]

    with open(INDEX, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Built single-file {INDEX} ({len(html)} bytes)")
    assert "class Game" in html, "Game class missing after build!"
    assert "autotest" not in html, "autotest leaked into production build!"
    print("OK: verified Game class present, no autotest hook.")

if __name__ == "__main__":
    main()
