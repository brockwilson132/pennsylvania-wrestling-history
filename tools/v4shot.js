const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const [w,h]=(process.env.VP||'1440x900').split('x').map(Number);
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:w,height:h}});
  p.on('pageerror',e=>console.log('ERR',e.message));
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('d3.min.js')) return r.fulfill({path:path.resolve('node_modules/d3/dist/d3.min.js')});
    if(u.includes('fonts.googleapis')) return r.fulfill({path:path.resolve('localfonts.css'),contentType:'text/css'});
    if(/^(file|blob|data):/.test(u)) return r.continue(); return r.abort();});
  for (const step of process.argv.slice(2)) {
    const [hash, ev, sel] = step.split('|');
    await p.goto('file://'+path.resolve('v4/test.html')+'#'+hash); await p.waitForTimeout(1300);
    if (ev) { await p.evaluate(ev); await p.waitForTimeout(700); }
    const name=`shots/v4-${process.env.TAG||'d'}-${hash}${ev?'-x':''}.png`;
    if (sel) { const el=await p.$(sel); await el.screenshot({path:name}); } else await p.screenshot({path:name, fullPage: process.env.FULL==='1'});
  }
  await b.close();
})();
