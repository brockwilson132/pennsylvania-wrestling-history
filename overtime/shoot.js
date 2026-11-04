/* Screenshots + layout check: node shoot.js [routes...] */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const NM = '/home/claude/almanac/node_modules', SITE = __dirname;
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['state', 'region/NE', 'region', 'district/11', 'district', 'school/nazareth', 'wrestlers', 'wrestler/sean-kinney--nazareth'];
const http = require('http');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, s) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch(); fs.mkdirSync(path.join(SITE, 'shots'), { recursive: true }); let bad = 0;
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 500, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('d3.min.js')) return r.fulfill({ path: path.join(NM, 'd3/dist/d3.min.js') }); if (/^(file|blob|data):/.test(u) || u.startsWith(BASE)) return r.continue(); return r.abort(); });
    for (const rt of routes) {
      await p.goto(BASE + '/index.html#' + rt); await p.waitForTimeout(rt.startsWith('wrestler/') || rt.includes('?b=') ? 1800 : 700);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      const wide = await p.evaluate((W) => Array.from(document.querySelectorAll('main *')).filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 && !e.closest('.tw,.drawer .body,.rchips,.schips.sm,.pmap'); }).slice(0, 5).map((e) => e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)), w);
      if (sw > w || wide.length) bad++;
      console.log(tag, rt.padEnd(32), 'scrollW', sw, wide.join(' | '));
      await p.screenshot({ path: path.join(SITE, 'shots', `${tag}-${rt.replace(/[\/?=.]/g, '_')}.png`), fullPage: true });
    }
    if (errs.length) { bad++; console.log(tag, 'ERRORS', errs.slice(0, 6)); }
    await p.close();
  }
  await b.close(); srv.close(); if (bad) { console.log('FAIL'); process.exit(1); } console.log('OK');
})();
