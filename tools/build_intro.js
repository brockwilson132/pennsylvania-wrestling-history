/* District shapes for the boot loader in overtime/index.html: the PIAA district outlines from overtime/pa-map.js
 * (1000x560 map units), lightly simplified, with the centre of each district's box. The loader draws them with the
 * same transform as the lockup's state outline (which is the map outline at 1/10 scale), so the pieces lock into it.
 * Rewrites the `var DS = {...}` line in index.html.   node tools/build_intro.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const OV = path.join(__dirname, '..', 'overtime'), ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(OV, 'pa-map.js'), 'utf8'), ctx);
const M = ctx.window.PA_MAP;
const dp = (pts, eps) => { if (pts.length < 3) return pts; let mx = 0, ix = 0; const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > mx) { mx = d; ix = i; } }
  return mx > eps ? dp(pts.slice(0, ix + 1), eps).slice(0, -1).concat(dp(pts.slice(ix), eps)) : [a, b]; };
const DS = {};
for (const [k, d] of Object.entries(M.d)) {
  if (!d) continue;   // district 8 (Pittsburgh City League) has no area of its own on the map
  const p = d.split(/(?=M)/).map((sub) => { const pts = [...sub.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]); const s = dp(pts, 0.8);
    return s.length < 3 ? '' : 'M' + s.map((q) => q[0].toFixed(0) + ',' + q[1].toFixed(0)).join('L') + 'Z'; }).join('');
  const b = M.box[k]; DS[k] = [p, Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)];
}
const f = path.join(OV, 'index.html'), html = fs.readFileSync(f, 'utf8'), re = /var DS = \{.*?\}, DG = /;
if (!re.test(html)) throw new Error('no `var DS = {...}, DG = ` in index.html');
fs.writeFileSync(f, html.replace(re, () => 'var DS = ' + JSON.stringify(DS) + ', DG = '));
console.log(Object.keys(DS).length, 'districts written to index.html');
