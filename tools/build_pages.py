#!/usr/bin/env python3
"""Build the public website copy of the Overtime app.

usage: python3 tools/build_pages.py <out-dir> [version]

Cloudflare Pages runs this on every push to rebuild (build command: python3 tools/build_pages.py _site,
output directory: _site). The version defaults to the commit Cloudflare is building.

Copies overtime/ to <out-dir>, leaving out the screenshot scripts and old proposals, then stamps every local
script and stylesheet in index.html (and the OT_LATE list) with ?v=<version>. Browsers keep files for a while, so
without the stamp a visitor who comes back right after a deploy can get new code mixed with old data files. The stamp makes each deploy one consistent set.
The claude.ai artifact is published from overtime/ itself and does not use this.
"""
import os, re, shutil, subprocess, sys
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
    if not (a and b and c): sys.exit(f'stamp failed: scripts={a} styles={b} late={c}')
    (out / 'index.html').write_text(html)
    print(f'built {out} v={ver}: {a} scripts, {b} stylesheet, OT_LATE stamped')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3): sys.exit(__doc__)
    ver = sys.argv[2] if len(sys.argv) == 3 else (os.environ.get('CF_PAGES_COMMIT_SHA') or subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip())
    main(sys.argv[1], (ver or 'dev')[:8])
