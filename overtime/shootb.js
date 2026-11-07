const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const NM = process.env.D3_NM || '/home/claude/almanac/node_modules', SITE = __dirname;
const http = require('http');
/* "route@view": the tab is part of the address (?v=rank|time|seasons, team = the all-time team list) */
const withV = (rt, v) => (!v || v === 'map' ? rt : rt + (rt.includes('?') ? '&' : '?') + (v === 'team' ? 'v=rank&l=team' : 'v=' + v));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch(); const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const routes = process.argv.slice(3);
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('d3.min.js')) return r.fulfill({ path: path.join(NM, 'd3/dist/d3.min.js') }); if (u.startsWith(BASE)) return r.continue(); return r.abort(); });
    let i = 0;
    for (const rt0 of routes) { const [rt, view] = rt0.split('@');
            await p.goto(BASE + '/index.html?n=' + (i++) + '#' + withV(rt, view)); await p.waitForTimeout(2500);
      const open = await p.evaluate(() => { const v = document.querySelector('.bview:not([hidden])'); if (v && v.querySelector('.bvcard')) { v.style.position = 'static'; v.style.overflow = 'visible'; document.querySelector('main') && (document.querySelector('main').style.display = 'none'); return true; } return false; });
      const f = path.join(out, `${tag}-${rt0.replace(/[\/?=.@#&]/g, '_')}.png`);
      await p.screenshot({ path: f, fullPage: true }); console.log(tag, rt0, open, errs.slice(-3));
    }
    await p.close();
  }
  await b.close(); srv.close();
})();
