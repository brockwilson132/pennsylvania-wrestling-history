/* Interaction checks: node tools/interact.js */
const { chromium } = require('playwright'); const path = require('path');
const NM = process.env.D3_NM || '/home/claude/almanac/node_modules', SITE = path.resolve(__dirname, '..', 'site');
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const touch of [false, true]) {
    const p = await b.newPage({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: touch });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('d3.min.js')) return r.fulfill({ path: path.join(NM, 'd3/dist/d3.min.js') }); if (/^(file|blob|data):/.test(u)) return r.continue(); return r.abort(); });
    const go = async (h) => { await p.goto('file://' + SITE + '/index.html#' + h); await p.waitForTimeout(600); };
    const tap = (sel) => (touch ? p.tap(sel) : p.click(sel));
    await go('home');
    await tap('[data-pick="Northampton"]'); await p.waitForTimeout(300);
    out.push(['pick changes mat caption', (await p.textContent('#hcap')).includes('Northampton')]);
    await go('school/nazareth');
    const y0 = await p.textContent('#yr'); await tap('#prev'); await p.waitForTimeout(200); const y1 = await p.textContent('#yr');
    out.push(['prev season', y0 !== y1]);
    const matEl = await p.$('[data-c="pmat"] svg'); await matEl.scrollIntoViewIfNeeded(); const box = await matEl.boundingBox();
    await (touch ? p.touchscreen.tap(box.x + box.width * 0.85, box.y + box.height * 0.5) : p.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5)); await p.waitForTimeout(200);
    out.push(['mat tap selects a season', (await p.textContent('#yr')) !== y1]);
    await go('season/2026'); await tap('[data-race="districts"]'); await p.waitForTimeout(200);
    out.push(['district race', (await p.$$('.race.d li')).length > 5]);
    await tap('[data-scope="AA"]'); await p.waitForTimeout(500);
    out.push(['class AA season', (await p.textContent('.lede')).includes('Class AA')]);
    await tap('[data-scope="single"]'); await go('home');
    out.push(['one-class era home', (await p.textContent('.lede')).includes('1938')]);
    await tap('[data-scope="AAA"]'); await p.waitForTimeout(400);
    await p.fill('#q', 'kinn'); await p.waitForTimeout(200);
    out.push(['search finds a wrestler', (await p.textContent('#qres')).includes('Kinney')]);
    await go('rankings'); await tap('[data-sort="now"]'); await p.waitForTimeout(200);
    out.push(['sort by now', (await p.textContent('table.rank tbody tr td.nm')).includes('Nazareth')]);
    out.push(['errors', errs.length ? errs.join('; ') : 'none']);
    console.log(touch ? 'phone' : 'desktop', out.splice(0).map(([k, v]) => `${k}: ${v}`).join(' | '));
    await p.close();
  }
  await b.close();
})();
