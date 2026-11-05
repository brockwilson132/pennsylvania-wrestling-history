/* Build the people index: every wrestler who appears in any district, regional or state bracket.
 *   node tools/build_people.js
 * Emits overtime/people.json (loaded lazily by the Wrestlers tab, search and wrestler pages):
 *   { s: [school…], p: [[name, schoolIdx, firstYear, span, district, best, peak], …] }
 *   best = level*10 + place   (level 1 district · 2 regional · 3 state; place 1–8, 0 = entered without placing)
 *   peak = peak Overtime Rating (0 when no bouts are on record)
 * Keys match the app: normalized name + canonical school (overtime/app/model.js wKey).
 */
'use strict';
const fs = require('fs'), path = require('path');
const OV = path.join(__dirname, '..', 'overtime');
global.window = {};
['badges.js', 'data.js', 'medals.js', 'brackets.js', 'lowermeta.js', 'lower-district.js', 'lower-regional.js', 'membership.js'].forEach((f) => { (0, eval)(fs.readFileSync(path.join(OV, f), 'utf8')); });
const W = window, SB = W.SchoolBadge;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);
/* same corrections as the app (model.js): where a state entrant actually wrestled districts, and two schools sharing a name */
const MEMB = (window.WR_MEMB || { r: {} }).r;
const SPLIT = { Trinity: { 7: 'Trinity (Washington)' }, 'Hempfield Area': { 3: 'Hempfield' }, Hempfield: { 7: 'Hempfield Area' }, 'Bethlehem Liberty': { 4: 'Liberty' }, 'Pius X (Roseto)': { 1: 'St. Pius X' } };
const splitName = (sch, d) => (SPLIT[sch] && SPLIT[sch][d]) || sch;
const unitDist = (lvl, unit, d) => { if (lvl !== 'district') return d; const m = /^D(\d+)(?:_|$)/.exec(unit || ''); return m ? +m[1] : d; };

/* ratings: sos/<year>.json → bracket key → s[nkey] = [rating, …] */
const SOS = new Map();
const sosOf = (year) => { if (!SOS.has(year)) { const f = path.join(OV, 'sos', year + '.json'); SOS.set(year, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}); } return SOS.get(year); };
const rating = (key, name) => { const year = +key.split('.')[0]; const b = sosOf(year)[key]; const x = b && b.s && b.s[nkey(name)]; return x && x[0] ? x[0] : 0; };

const P = new Map();
const FIVE = ['NE', 'NW', 'SC', 'SE', 'SW'];
/* standardized weights, the same buckets as the app (model.js STD) */
const STDK = [['98', 0, 101], ['107', 102, 110], ['114', 111, 117], ['121', 118, 124], ['127', 125, 129], ['133', 130, 136], ['139', 137, 142], ['145', 143, 148], ['152', 149, 156], ['160', 157, 166], ['172', 167, 180], ['189', 181, 200], ['215', 201, 240], ['HWT', 241, 9999]];
const stdIdx = (wn) => { const i = STDK.findIndex(([, a, b]) => wn >= a && wn <= b); return i < 0 ? STDK.length - 1 : i; };
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
/* Raw appearances first, keyed by name + school; careers are split afterwards (see splitCareers), so a father and a
   son, or two unrelated wrestlers with one name at one school decades apart, never merge into one person. */
const RAW = new Map();
const GN = { FR: 9, SO: 10, JR: 11, SR: 12, '7': 7, '8': 8, '7th': 7, '8th': 8 };
function add(lvl, year, cls, unit, w, place, name, school, d, grade) {
  if (!name) return;
  if (lvl === 'state') { const mb = MEMB[`${year}|${cls}|${wNum(w)}|${nkey(name)}`]; if (mb) { d = mb[0]; if (mb[1]) school = mb[1]; } } else d = unitDist(lvl, unit, d);
  const sch = splitName(canon(school), d); if (!nkey(name)) return; const base = nkey(name) + '|' + sch;
  if (lvl === 'state' && !grade) grade = (W.WR_GRADES || {})[`${year}|${cls}|${nkey(name)}`] || '';
  (RAW.get(base) || RAW.set(base, []).get(base)).push({ a: [lvl, year, cls, unit, w, place, name, sch, d], year, g: GN[String(grade || '').trim()] || 0, lvl, wn: wNum(w) });
}
/* Split one name+school into careers. Hard limits: a career spans at most 4 seasons (5 when grades show a repeated
   year or an 8th-grade start), grades never go backward, and every grade must imply the same graduating class (±1 for
   a repeated year). Appearances are taken in season order; anything that breaks a limit starts a new career. Returns
   the start season of each career. */
function splitCareers(apps) {
  const years = Array.from(new Set(apps.map((x) => x.year))).sort((a, b) => a - b);
  const gOf = (y) => { const gs = apps.filter((x) => x.year === y && x.g).map((x) => x.g); return gs.length ? Math.max(...gs) : 0; };
  const cs = [];
  for (const y of years) {
    const g = gOf(y), gy = g ? y + 12 - g : 0; const c = cs[cs.length - 1];
    let ok = !!c;
    if (ok) {
      const repeat = (gy && c.gy && gy === c.gy + 1) || (g && c.lastG && g === c.lastG && y > c.end) || (c.minG && c.minG <= 8);
      const maxSpan = repeat || c.repeat ? 4 : 3;
      if (y - c.start > maxSpan) ok = false;
      if (ok && g && c.lastG && g < c.lastG) ok = false;                       // grade went backward
      if (ok && gy && c.gy && Math.abs(gy - c.gy) > 1) ok = false;             // different graduating class
      if (ok && !gy && c.gy && y > c.gy) ok = false;                           // past his graduation
      if (ok && repeat) c.repeat = true;
    }
    if (!ok) cs.push({ start: y, end: y, gy, lastG: g, minG: g || 99, repeat: false });
    else { const cc = cs[cs.length - 1]; cc.end = y; if (g) { cc.lastG = g; cc.minG = Math.min(cc.minG, g); if (!cc.gy) cc.gy = gy; } }
  }
  return cs.map((c) => c.start);
}
function addAgg(k, lvl, year, cls, unit, w, place, name, sch, d) {
  let p = P.get(k); if (!p) { p = { name, sch, y0: year, y1: year, ds: new Map(), best: 0, peak: 0, ny: 0, res: new Map(), regs: new Map(), pw: null, wc: new Map(), cls: new Map(), ws: 0 }; P.set(k, p); }
  p.cls.set(cls, (p.cls.get(cls) || 0) + (lvl === 'state' ? 3 : 1)); p.ws |= 1 << stdIdx(wNum(w));
  /* a transfer is listed under the school of his last state appearance (as the app's state records file him), else his
     last school: Randy Biggs won 1967 states for Bethlehem Liberty, then wrestled for Freedom (Brock, 2026-11-05) */
  if (lvl === 'state' ? year >= (p.ns || 0) : !p.ns && year >= p.ny) { p.name = name; p.sch = sch; if (lvl === 'state') p.ns = year; }
  if (year >= p.ny) p.ny = year;
  p.y0 = Math.min(p.y0, year); p.y1 = Math.max(p.y1, year);
  if (d) p.ds.set(d, (p.ds.get(d) || 0) + (lvl === 'district' ? 3 : 1));
  const L = { district: 1, regional: 2, state: 3 }[lvl]; const pl = place >= 1 && place <= 8 ? place : 0;
  const cur = Math.floor(p.best / 10), curP = p.best % 10;
  if (L > cur || (L === cur && pl && (!curP || pl < curP))) p.best = L * 10 + pl;
  const key = lvl === 'state' ? `${year}.${cls}.state.${wNum(w)}` : `${year}.${cls}.${lvl}.${unit}.${wNum(w)}`;
  const r = rating(key, name); if (r > p.peak) { p.peak = r; p.pw = wNum(w); }
  /* one result per level and season (the best place seen), for the all-time team credit */
  const rk = lvl + '|' + year, prev = p.res.get(rk);
  if (!prev || (pl && (!prev.place || pl < prev.place))) p.res.set(rk, { lvl, year, place: pl, w: wNum(w) });
  p.wc.set(wNum(w), (p.wc.get(wNum(w)) || 0) + (lvl === 'state' ? 3 : 1));
  if (lvl === 'regional' && unit && FIVE.includes(unit)) p.regs.set(unit, (p.regs.get(unit) || 0) + 1);
}

/* state: medalists, champions and every qualifier */
(W.WR_MEDALS || []).forEach(([year, cls, w, place, name, school, d]) => add('state', year, cls, null, w, place, name, school, d));
(W.WR_DATA.champs || []).concat(W.WR_CHAMP_FILL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 1, name, school, d));
(W.WR_QUAL || []).forEach(([year, cls, w, name, school, d, grade]) => add('state', year, cls, null, w, 0, name, school, d, grade));
/* district / regional: every entrant in the full fields, plus source-only champions in the medalist tables */
const LCLS = ['AAA', 'AA', 'single'];
fs.readdirSync(path.join(OV, 'lower')).filter((f) => f.endsWith('.json')).forEach((f) => {
  const [year, lvl] = f.replace('.json', '').split('-');
  JSON.parse(fs.readFileSync(path.join(OV, 'lower', f), 'utf8')).forEach(([cls, unit, w, place, , name, sch, grade, , d]) => add(lvl, +year, cls, unit, w, +place || 0, name, sch, d, grade));
});
const LS = W.WR_LOWER_META.strs;
[['district', W.WR_LOWER_D], ['regional', W.WR_LOWER_R]].forEach(([lvl, rows]) => (rows || []).forEach(([, year, c, ui, wi, place, ni, si, g, , d]) => add(lvl, year, LCLS[c], LS[ui], LS[wi], place, LS[ni], LS[si], d, ['', 'FR', 'SO', 'JR', 'SR'][g] || '')));

/* careers: split every name+school, then aggregate each career as its own person. careers.js lists, for each
   name+school with more than one career, the start season of every career after the first (the app uses it to give
   each career its own key and page). */
const CAREERS = {}; let nSplit = 0, nSameSeason = 0;
/* transfers: one wrestler, two schools (same rule as tools/ratings.py). A later career at another school joins an earlier
   one when the name matches, grades give the same graduating class, the seasons follow within two years without
   overlapping, the whole career fits in four seasons and the weights are within 30 lb. WR_TRANSFER maps the later
   career key to the earlier one; the app files both under one wrestler page. */
const CAR = []; // {k, nm, y0, y1, gy, wn}
RAW.forEach((apps, base) => { const starts = splitCareers(apps); starts.forEach((st, i) => { const end = starts[i + 1] || 9999; const xs = apps.filter((x) => x.year >= st && x.year < end);
  const gys = new Set(xs.filter((x) => x.g >= 9).map((x) => x.year + 12 - x.g)); const ws = xs.map((x) => x.wn).filter((w) => w && w < 999).sort((a, b) => a - b);
  CAR.push({ k: i ? base + '#' + st : base, nm: base.split('|')[0], y0: Math.min(...xs.map((x) => x.year)), y1: Math.max(...xs.map((x) => x.year)), gy: gys.size === 1 ? [...gys][0] : 0, wn: ws.length ? ws[ws.length >> 1] : 0 }); }); });
const TRANSFER = {}; const byNm = new Map(); CAR.forEach((c) => (byNm.get(c.nm) || byNm.set(c.nm, []).get(c.nm)).push(c));
byNm.forEach((cs) => { if (cs.length < 2 || cs[0].nm.length < 6) return; cs.sort((a, b) => a.y0 - b.y0);
  cs.forEach((b, j) => { for (let i = j - 1; i >= 0; i--) { const a = cs[i]; if (TRANSFER[a.k] || a.k.split('|')[1].split('#')[0] === b.k.split('|')[1].split('#')[0]) continue;
    const root = a; const y0 = root.y0, y1 = Math.max(root.y1, ...cs.filter((c) => TRANSFER[c.k] === root.k).map((c) => c.y1));
    if (b.y0 <= y1 || b.y0 - y1 > 2 || b.y1 - y0 > 3 || !a.gy || a.gy !== b.gy || (a.wn && b.wn && Math.abs(a.wn - b.wn) > 30)) continue;
    TRANSFER[b.k] = a.k; break; } }); });
const TR = (k) => TRANSFER[k] || k;
RAW.forEach((apps, base) => {
  const starts = splitCareers(apps);
  if (starts.length > 1) { CAREERS[base] = starts.slice(1); nSplit++; }
  apps.forEach((x) => { let i = 0; while (i + 1 < starts.length && x.year >= starts[i + 1]) i++; const k = i ? base + '#' + starts[i] : base; addAgg(TR(k), ...x.a); });
  /* two state appearances in one season at weights >12 lb apart: two people sharing a name (counted, not split) */
  const byY = new Map(); apps.filter((x) => x.lvl === 'state').forEach((x) => { (byY.get(x.year) || byY.set(x.year, []).get(x.year)).push(x.wn); });
  byY.forEach((ws) => { if (ws.length > 1 && Math.max(...ws) - Math.min(...ws) > 12) nSameSeason++; });
});
fs.writeFileSync(path.join(OV, 'careers.js'), 'window.WR_CAREERS=' + JSON.stringify(CAREERS) + ';\nwindow.WR_TRANSFER=' + JSON.stringify(TRANSFER) + ';\n');
console.log('transfers linked', Object.keys(TRANSFER).length);
console.log('name+school keys', RAW.size, 'split into several careers', nSplit, 'same-season two-weight state cases', nSameSeason);

const schools = [], sidx = new Map(); const S = (s) => { if (!sidx.has(s)) { sidx.set(s, schools.length); schools.push(s); } return sidx.get(s); };
const out = Array.from(P.values()).sort((a, b) => b.best - a.best || b.peak - a.peak).map((p) => {
  const d = p.ds.size ? Array.from(p.ds).sort((a, b) => b[1] - a[1])[0][0] : 0;
  /* his one all-time-team weight: the weight of his highest-rated season, else the weight he wrestled most (state counts 3x) */
  const pw = p.pw != null ? p.pw : Array.from(p.wc).sort((a, b) => b[1] - a[1])[0][0];
  const R = Array.from(p.res.values());
  const lv = (l) => R.filter((x) => x.lvl === l);
  const pts = (l) => lv(l).reduce((a, x) => a + (x.place ? PTS[x.place - 1] : 0), 0);
  const q = (l) => lv(l).filter((x) => !x.place).length;
  const best = (l) => lv(l).reduce((a, x) => (x.place && (!a || x.place < a) ? x.place : a), 0);
  const titles = (l) => lv(l).filter((x) => x.place === 1).length;
  const sres = lv('state').sort((a, b) => a.year - b.year).map((x) => x.year * 10 + x.place);
  const reg = p.regs.size ? Array.from(p.regs).sort((a, b) => b[1] - a[1])[0][0] : '';
  /* [name, school, firstYear, span, district, best, peak/10, teamWeightIdx, statePts, regionalPts, districtPts,
      stateQuals, regionalQuals, [state year*10+place…], regionalBest, districtBest, regionalTitles, districtTitles, region,
      class (0 AAA · 1 AA · 2 one-class era), weights wrestled (bitmask of standardized weights)] */
  const cl = Array.from(p.cls).sort((a, b) => b[1] - a[1])[0][0];
  return [p.name, S(p.sch), p.y0, p.y1 - p.y0, d, p.best, Math.round(p.peak), stdIdx(pw), pts('state'), pts('regional'), pts('district'), q('state'), q('regional'), sres, best('regional'), best('district'), titles('regional'), titles('district'), reg, cl === 'AAA' ? 0 : cl === 'AA' ? 1 : 2, p.ws];
});
fs.writeFileSync(path.join(OV, 'people.json'), JSON.stringify({ s: schools, p: out }));
const st = fs.statSync(path.join(OV, 'people.json')).size;
console.log('people', out.length, 'schools', schools.length, 'bytes', st, 'rated', out.filter((x) => x[6]).length);
