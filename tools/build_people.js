/* Build the people index: every wrestler who appears in any district, regional or state bracket.
 *   node tools/build_people.js
 * Emits overtime/people.json (loaded lazily by the Wrestlers tab, search and wrestler pages):
 *   { s: [school…], p: [[name, schoolIdx, firstYear, span, district, best, peak], …] }
 *   best = level*10 + place   (level 1 district · 2 regional · 3 state; place 1–8, 0 = entered without placing)
 *   peak = peak Overtime Rating / 10 (0 when no bouts are on record)
 * Keys match the app: normalized name + canonical school (overtime/app/model.js wKey).
 */
'use strict';
const fs = require('fs'), path = require('path');
const OV = path.join(__dirname, '..', 'overtime');
global.window = {};
['badges.js', 'data.js', 'medals.js', 'brackets.js', 'lowermeta.js', 'lower-district.js', 'lower-regional.js'].forEach((f) => { (0, eval)(fs.readFileSync(path.join(OV, f), 'utf8')); });
const W = window, SB = W.SchoolBadge;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);

/* ratings: sos/<year>.json → bracket key → s[nkey] = [rating, …] */
const SOS = new Map();
const sosOf = (year) => { if (!SOS.has(year)) { const f = path.join(OV, 'sos', year + '.json'); SOS.set(year, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}); } return SOS.get(year); };
const rating = (key, name) => { const year = +key.split('.')[0]; const b = sosOf(year)[key]; const x = b && b.s && b.s[nkey(name)]; return x && x[0] ? x[0] : 0; };

const P = new Map();
function add(lvl, year, cls, unit, w, place, name, school, d) {
  if (!name) return; const sch = canon(school); const k = nkey(name) + '|' + sch; if (!nkey(name)) return;
  let p = P.get(k); if (!p) { p = { name, sch, y0: year, y1: year, ds: new Map(), best: 0, peak: 0, ny: 0 }; P.set(k, p); }
  if (year >= p.ny) { p.ny = year; p.name = name; }
  p.y0 = Math.min(p.y0, year); p.y1 = Math.max(p.y1, year);
  if (d) p.ds.set(d, (p.ds.get(d) || 0) + 1);
  const L = { district: 1, regional: 2, state: 3 }[lvl]; const pl = place >= 1 && place <= 8 ? place : 0;
  const cur = Math.floor(p.best / 10), curP = p.best % 10;
  if (L > cur || (L === cur && pl && (!curP || pl < curP))) p.best = L * 10 + pl;
  const key = lvl === 'state' ? `${year}.${cls}.state.${wNum(w)}` : `${year}.${cls}.${lvl}.${unit}.${wNum(w)}`;
  const r = rating(key, name); if (r > p.peak) p.peak = r;
}

/* state: medalists, champions and every qualifier */
(W.WR_MEDALS || []).forEach(([year, cls, w, place, name, school, d]) => add('state', year, cls, null, w, place, name, school, d));
(W.WR_DATA.champs || []).concat(W.WR_CHAMP_FILL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 1, name, school, d));
(W.WR_QUAL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 0, name, school, d));
/* district / regional: every entrant in the full fields, plus source-only champions in the medalist tables */
const LCLS = ['AAA', 'AA', 'single'];
fs.readdirSync(path.join(OV, 'lower')).filter((f) => f.endsWith('.json')).forEach((f) => {
  const [year, lvl] = f.replace('.json', '').split('-');
  JSON.parse(fs.readFileSync(path.join(OV, 'lower', f), 'utf8')).forEach(([cls, unit, w, place, , name, sch, , , d]) => add(lvl, +year, cls, unit, w, +place || 0, name, sch, d));
});
const LS = W.WR_LOWER_META.strs;
[['district', W.WR_LOWER_D], ['regional', W.WR_LOWER_R]].forEach(([lvl, rows]) => (rows || []).forEach(([, year, c, ui, wi, place, ni, si, , , d]) => add(lvl, year, LCLS[c], LS[ui], LS[wi], place, LS[ni], LS[si], d)));

const schools = [], sidx = new Map(); const S = (s) => { if (!sidx.has(s)) { sidx.set(s, schools.length); schools.push(s); } return sidx.get(s); };
const out = Array.from(P.values()).sort((a, b) => b.best - a.best || b.peak - a.peak).map((p) => {
  const d = p.ds.size ? Array.from(p.ds).sort((a, b) => b[1] - a[1])[0][0] : 0;
  return [p.name, S(p.sch), p.y0, p.y1 - p.y0, d, p.best, Math.round(p.peak / 10)];
});
fs.writeFileSync(path.join(OV, 'people.json'), JSON.stringify({ s: schools, p: out }));
const st = fs.statSync(path.join(OV, 'people.json')).size;
console.log('people', out.length, 'schools', schools.length, 'bytes', st, 'rated', out.filter((x) => x[6]).length);
