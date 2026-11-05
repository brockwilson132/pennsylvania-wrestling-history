const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800},deviceScaleFactor:2});
await p.goto('file:///home/claude/brand/board.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);
await p.screenshot({path:'board.png',fullPage:true});await b.close();})();
