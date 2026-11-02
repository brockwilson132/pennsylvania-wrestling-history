const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('d3.min.js')) return r.fulfill({path:path.resolve('node_modules/d3/dist/d3.min.js')});
    if(u.includes('fonts.googleapis')) return r.fulfill({path:path.resolve('localfonts.css'),contentType:'text/css'});
    if(/^(file|blob|data):/.test(u)) return r.continue(); return r.abort();});
  await p.goto('file://'+path.resolve('v4/test.html')+'#overview'); await p.waitForTimeout(1200);
  const yr=()=>p.$eval('.card-yr',e=>e.textContent);
  console.log('start',await yr());
  await p.focus('[data-c="mat"]'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); console.log('after 2 left',await yr());
  await p.click('#m-prev'); console.log('after prev',await yr());
  const sw=await p.$('[data-c="wc"] svg rect'); await sw.click(); await p.waitForTimeout(600); console.log('weight click ->',await yr(), 'scrollY',await p.evaluate(()=>scrollY));
  await p.evaluate(()=>{const r=document.querySelector('#m-year'); r.value=1999; r.dispatchEvent(new Event('input'));}); console.log('timeline 1999 ->', await yr());
  await p.click('#m-legend button:nth-child(2)'); await p.waitForTimeout(200); console.log('legend D11 ->', await p.$eval('.mat-n',e=>e.textContent), await p.$$eval('.lineup li.off',l=>l.length),'faded rows');
  await p.click('#m-legend button:nth-child(2)');
  for (const c of ['AA','single']) { await p.click(`[data-cls="${c}"]`); await p.waitForTimeout(500); console.log(c, await yr(), await p.$eval('#mat h2',e=>e.textContent)); }
  await p.click('[data-cls="AAA"]'); await p.check('#era'); await p.waitForTimeout(500); console.log('era', await yr(), await p.$eval('#m-year',e=>e.min));
  for (const h of ['district-3','school-easton','school-saucon-valley','dynasties','weights','insights','schools','about','studio','district-11']) { await p.evaluate(h=>location.hash=h,h); await p.waitForTimeout(500); }
  // levels on a D11 school
  await p.click('[data-cls="AAA"]'); await p.uncheck('#era'); await p.evaluate(()=>location.hash='school-nazareth'); await p.waitForTimeout(700);
  for (const lv of ['regional','district','state']) { await p.click(`[data-lv="${lv}"]`); await p.waitForTimeout(500); console.log(lv, await p.$eval('.record .lead dd',e=>e.textContent), await p.$eval('.card-sub',e=>e.textContent)); }
  await p.evaluate(()=>location.hash='district-2'); await p.waitForTimeout(600); console.log('d2 levels', await p.$$eval('[data-lv]',bs=>bs.map(b=>b.textContent)));
  await p.fill('#m-q','kinney'); await p.waitForTimeout(300); console.log('search d2', await p.$eval('#m-card',e=>e.textContent.slice(0,80)));
  await p.evaluate(()=>location.hash='school-nazareth'); await p.waitForTimeout(600);
  await p.click('[data-depth="medal"]'); await p.waitForTimeout(600); console.log('medal mode', await p.$eval('.record .lead dd',e=>e.textContent), await p.$eval('.card-sub',e=>e.textContent), 'lit cells', await p.$$eval('[data-c="mat"] path[fill]:not([fill="#2a2c30"]):not([fill="none"]):not([fill="transparent"])',l=>l.length));
  await p.click('[data-depth="champ"]'); await p.waitForTimeout(400);
  await p.evaluate(()=>location.hash='overview'); await p.waitForTimeout(600); await p.click('[data-cb="school"]'); await p.waitForTimeout(500); console.log('school colors legend', await p.$$eval('#m-legend button',b=>b.length));
  await p.click('[data-cb="district"]'); await p.waitForTimeout(300);
  console.log('errors',errs);
  await b.close();
})();
