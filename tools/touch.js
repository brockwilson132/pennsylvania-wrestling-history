const { chromium, devices } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({...devices['iPhone 13'], locale:'en-US'}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('d3.min.js')) return r.fulfill({path:path.resolve('node_modules/d3/dist/d3.min.js')});
    if(u.includes('fonts.googleapis')) return r.fulfill({path:path.resolve('localfonts.css'),contentType:'text/css'});
    if(/^(file|blob|data):/.test(u)) return r.continue(); return r.abort();});
  await p.goto('file://'+path.resolve('v4/test.html')+'#overview'); await p.waitForTimeout(1200);
  const yr=()=>p.$eval('.card-yr',e=>e.textContent);
  const mat=await p.$('[data-c="mat"] svg'); const bb=await mat.boundingBox();
  await p.tap('[data-c="mat"] svg', {position:{x:bb.width*0.2, y:bb.height*0.3}}); await p.waitForTimeout(300); console.log('tap mat ->', await yr());
  await p.tap('#m-next'); console.log('tap next ->', await yr());
  const tl=await p.$('#m-year'); const tb=await tl.boundingBox(); await p.touchscreen.tap(tb.x+tb.width*0.5, tb.y+tb.height/2); await p.waitForTimeout(300); console.log('tap timeline mid ->', await yr());
  await p.tap('.tabs a[data-k="districts"]'); await p.waitForTimeout(900); console.log('districts page h1', await p.$eval('h1',e=>e.textContent));
  await p.tap('.mat-card'); await p.waitForTimeout(900); console.log('->', await p.$eval('h1',e=>e.textContent), 'width ok', await p.evaluate(()=>document.documentElement.scrollWidth));
  console.log('errors', errs);
  await b.close();
})();
