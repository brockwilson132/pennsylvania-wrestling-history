const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const http = require('http');
const NM = '/home/claude/almanac/node_modules', SITE = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
// usage: node shotc.js outdir w h name route [js-before] ...
(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch(); const [out, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]]; fs.mkdirSync(out, { recursive: true });
  const jobs = JSON.parse(process.argv[5]);
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('d3.min.js')) return r.fulfill({ path: path.join(NM, 'd3/dist/d3.min.js') }); if (u.startsWith(BASE)) return r.continue(); return r.abort(); });
    await p.goto(BASE + '/index.html#about'); if (j.pre) await p.evaluate(j.pre); await p.goto(BASE + '/index.html?x=' + Math.random() + '#' + j.route); await p.waitForTimeout(j.wait || 3000);
    if (j.click) { for (const c of j.click) { await p.click(c).catch((e) => errs.push('click ' + c)); await p.waitForTimeout(1500); } }
    if (j.js) await p.evaluate(j.js);
    await p.waitForTimeout(800);
    if (j.sel) { const el = await p.$(j.sel); if (el) await el.screenshot({ path: path.join(out, j.name + '.png') }); else errs.push('no ' + j.sel); }
    else await p.screenshot({ path: path.join(out, j.name + '.png'), fullPage: !!j.full });
    console.log(j.name, errs.slice(0, 3)); await p.close();
  }
  await b.close(); srv.close();
})();
