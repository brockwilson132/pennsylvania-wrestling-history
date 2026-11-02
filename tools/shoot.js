/* Screenshots and a layout check: node tools/shoot.js [routes...] */
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const NM = process.env.D3_NM || '/home/claude/almanac/node_modules';
const SITE = path.resolve(__dirname, '..', 'site');
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['home', 'rankings', 'rankings/districts', 'school/nazareth', 'district/11', 'district/7', 'season/2026', 'records', 'about'];
(async () => {
  const b = await chromium.launch(); fs.mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
  for (const [w, h, tag] of [[1440, 900, 'd'], [390, 844, 'm']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 500 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('d3.min.js')) return r.fulfill({ path: path.join(NM, 'd3/dist/d3.min.js') }); if (u.includes('fonts.googleapis')) return r.fulfill({ path: '/home/claude/almanac/localfonts.css', contentType: 'text/css' }); if (u.includes('fonts.gstatic')) return r.abort(); if (/^(file|blob|data):/.test(u)) return r.continue(); return r.abort(); });
    for (const rt of routes) {
      await p.goto('file://' + SITE + '/index.html#' + rt); await p.waitForTimeout(900);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      const wide = sw > w ? await p.evaluate((W) => Array.from(document.querySelectorAll('main *')).filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 && !e.closest('.rt,.cg-wrap'); }).slice(0, 6).map((e) => e.tagName.toLowerCase() + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)), w) : [];
      console.log(tag, rt.padEnd(20), 'scrollW', sw, wide.join(' | '));
      await p.screenshot({ path: path.join(__dirname, '..', 'shots', `${tag}-${rt.replace('/', '_')}.png`), fullPage: true });
    }
    if (errs.length) console.log(tag, 'ERRORS', errs.slice(0, 5));
    await p.close();
  }
  await b.close();
})();
