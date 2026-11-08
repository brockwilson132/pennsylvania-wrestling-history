#!/usr/bin/env python3
"""Build the public website copy of the Overtime app (GitHub Pages).

usage: python3 tools/build_pages.py <out-dir> <version>

Copies overtime/ to <out-dir>, leaving out the screenshot scripts and old proposals, then stamps every local
script and stylesheet in index.html, the OT_LATE list and colors.html (the school colour editor) with ?v=<version>. GitHub Pages lets browsers keep
files for 10 minutes and we cannot change that header, so without the stamp a visitor who comes back right after
a deploy can get new code mixed with old data files. The stamp makes each deploy one consistent set.
The claude.ai artifact is published from overtime/ itself and does not use this.
"""
import re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'overtime'
SKIP = {'proposals', 'shots', 'node_modules', 'shoot.js', 'shootb.js', 'shotc.js', '.gitignore'}

def main(out, ver):
    out = Path(out)
    if out.exists(): shutil.rmtree(out)
    shutil.copytree(ROOT, out, ignore=lambda d, names: [n for n in names if Path(d) == ROOT and n in SKIP])
    html = (out / 'index.html').read_text()
    local = r'(?!https?:|data:|#|//)([^"?]+\.(?:js|css))'
    html, a = re.subn(r'(<script src=")' + local + '"', rf'\1\2?v={ver}"', html)
    html, b = re.subn(r'(<link rel="stylesheet" href=")' + local + '"', rf'\1\2?v={ver}"', html)
    def late(m): return re.sub(r"'([^'?]+\.js)'", rf"'\1?v={ver}'", m.group(0))
    html, c = re.subn(r'window\.OT_LATE = \[[^\]]*\]', late, html)
    html, d = re.subn(r"fetch\('intro\.m4a'\)", f"fetch('intro.m4a?v={ver}')", html)  # loader music, fetched on demand
    if not (a and b and c and d): sys.exit(f'stamp failed: scripts={a} styles={b} late={c} audio={d}')
    (out / 'index.html').write_text(html)
    # the colour editor is its own page: stamp its scripts and stylesheet the same way
    ed = (out / 'colors.html').read_text()
    ed, d = re.subn(r'(<script src=")' + local + '"', rf'\1\2?v={ver}"', ed)
    ed, e = re.subn(r'(<link rel="stylesheet" href=")' + local + '"', rf'\1\2?v={ver}"', ed)
    if not (d and e): sys.exit(f'stamp failed in colors.html: scripts={d} styles={e}')
    (out / 'colors.html').write_text(ed)
    print(f'built {out} v={ver}: {a} scripts, {b} stylesheet, OT_LATE stamped; colors.html {d} scripts')

if __name__ == '__main__':
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(*sys.argv[1:])
