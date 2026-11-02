const { chromium } = require('playwright'); const path=require('path');
(async()=>{
  const b=await chromium.launch();
  const pages=['overview','district-11','school-nazareth','districts','schools','weights','records','about'];
  for (const [w,h,tag] of [[390,844,'m'],[1440,900,'d']]) {
    const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.includes('d3.min.js')) return r.fulfill({path:path.resolve('node_modules/d3/dist/d3.min.js')});
      if(u.includes('fonts.googleapis')) return r.fulfill({path:path.resolve('localfonts.css'),contentType:'text/css'});
      if(/^(file|blob|data):/.test(u)) return r.continue(); return r.abort();});
    for (const hs of pages) {
      await p.goto('file://'+path.resolve('v4/test.html')+'#'+hs); await p.waitForTimeout(1200);
      const info = await p.evaluate((W)=>{
        const doc=document.documentElement.scrollWidth; const over=[];
        document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width>0&&(r.right>W+1||r.left<-1)&&!el.closest('svg')) over.push(el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ').slice(0,2).join('.'):'')+' '+Math.round(r.left)+'..'+Math.round(r.right));});
        const small=[]; document.querySelectorAll('button,a,input,select').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width&&r.height&&(r.height<32)&&el.closest('main')) small.push(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]+' '+Math.round(r.width)+'x'+Math.round(r.height));});
        const fonts=[]; document.querySelectorAll('main *').forEach(el=>{const fs=parseFloat(getComputedStyle(el).fontSize); if(el.children.length===0&&el.textContent.trim()&&fs<12&&!el.closest('svg')) fonts.push(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]+' '+fs);});
        return {scrollW:doc, h:document.documentElement.scrollHeight, over:[...new Set(over)].slice(0,12), small:[...new Set(small)].slice(0,10), fonts:[...new Set(fonts)].slice(0,10)};
      }, w);
      console.log(`\n== ${tag} ${hs}  scrollW=${info.scrollW}/${w} height=${info.h}`);
      if(info.over.length) console.log(' OVERFLOW:', info.over.join(' | '));
      if(info.small.length) console.log(' SMALL TARGETS:', info.small.join(' | '));
      if(info.fonts.length) console.log(' SMALL TEXT:', info.fonts.join(' | '));
      await p.screenshot({path:`shots/a4-${tag}-${hs}.png`, fullPage:true});
    }
    if(errs.length) console.log('ERRORS', errs);
    await p.close();
  }
  await b.close();
})();
