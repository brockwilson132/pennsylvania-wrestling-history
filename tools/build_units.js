/* School, district and region numbers for the app (overtime/units.js).
 *   node tools/build_units.js
 * Emits window.WR_UNITS = { schools, names, ss, ds, rs, ref, talentAt, typField, fieldPct } (layout under "output").
 * Strength (per season) = the school's lineup as a dual-meet team: best wrestler at each weight at his real season
 *   rating, a weight with nobody entered is a forfeit; the average chance of beating an average state qualifier, turned
 *   back into a rating. Only seasons whose full district field is on file. District / region = average of its schools.
 * Talent = expected state medalists, sum of P(medal | season rating); district / region = per school.
 * Score  = era-fair placement points per season (per school per season for districts and regions); see below.
 * Identity keys follow tools/build_people.js.
 */
'use strict';
const fs = require('fs'), path = require('path');
const OV = path.join(__dirname, '..', 'overtime');
global.window = {};
['badges.js', 'data.js', 'medals.js', 'brackets.js', 'lowermeta.js', 'lower-district.js', 'lower-regional.js', 'membership.js', 'lowerteams.js', 'careers.js'].forEach((f) => { (0, eval)(fs.readFileSync(path.join(OV, f), 'utf8')); });
const W = window, SB = W.SchoolBadge;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);
const MEMB = (W.WR_MEMB || { r: {} }).r;
const SPLIT = { Trinity: { 7: 'Trinity (Washington)' }, 'Hempfield Area': { 3: 'Hempfield' }, Hempfield: { 7: 'Hempfield Area' }, 'Bethlehem Liberty': { 4: 'Liberty' }, 'Pius X (Roseto)': { 1: 'St. Pius X' } };
const splitName = (sch, d) => (SPLIT[sch] && SPLIT[sch][d]) || sch;
const unitDist = (lvl, unit, d) => { if (lvl !== 'district' && lvl !== 'section') return d; const m = /^D(\d+)(?:_|$)/.exec(unit || ''); return m ? +m[1] : d; };
const STDK = [['98', 0, 101], ['107', 102, 110], ['114', 111, 117], ['121', 118, 124], ['127', 125, 129], ['133', 130, 136], ['139', 137, 142], ['145', 143, 148], ['152', 149, 156], ['160', 157, 166], ['172', 167, 180], ['189', 181, 200], ['215', 201, 240], ['HWT', 241, 9999]];
const stdIdx = (wn) => { const i = STDK.findIndex(([, a, b]) => wn >= a && wn <= b); return i < 0 ? STDK.length - 1 : i; };
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
const FIVE = ['NE', 'NW', 'SC', 'SE', 'SW'];
const normCls = (c) => (c === 'A' ? 'AAA' : c === 'B' ? 'AA' : c);

const SOS = new Map();
const sosOf = (year) => { if (!SOS.has(year)) { const rd = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}); SOS.set(year, { ...rd(path.join(OV, 'sos', year + '.json')), ...rd(path.join(__dirname, '..', 'data', 'difficulty', 'sos-section', year + '.json')) }); } return SOS.get(year); };
const sosRow = (key, name) => { const year = +key.split('.')[0]; const b = sosOf(year)[key]; return (b && b.s && b.s[nkey(name)]) || null; };

/* field strength per bracket (mean rating of its top eight), from tools/ratings.py */
const FIELD = new Map();
fs.readFileSync(path.join(__dirname, '..', 'data', 'difficulty', 'brackets.csv'), 'utf8').trim().split('\n').slice(1).forEach((line) => {
  const [level, , weight, year, cls, unit, , , , field] = line.split(',');
  if (field) FIELD.set([level, year, normCls(cls), level === 'state' ? '' : unit, wNum(weight)].join('|'), +field);
});
const fieldOf = (a) => FIELD.get([a.lvl, a.year, normCls(a.cls), a.lvl === 'state' ? '' : a.unit, a.w].join('|')) || 0;

/* ---- collect appearances ---- */
const A = []; // {k, name, sch, year, cls, lvl, w, std, place, d, unit, rating, bw, bwn}
function add(lvl, year, cls, unit, w, place, name, school, d) {
  if (!name || !nkey(name) || /^(forfeit|bye|open|vacant)$/i.test(String(name).trim()) || !String(school || '').trim()) return;   // placeholder rows, not wrestlers
  if (/_Sub$|Super/.test(String(unit || ''))) return;   // sub-regionals (1995–98) and 2021 super-regionals are extra rounds on top of a district or regional: counting them would give those seasons two sets of places and titles at one level
  if (lvl === 'state') { const mb = MEMB[`${year}|${cls}|${wNum(w)}|${nkey(name)}`]; if (mb) { d = mb[0]; if (mb[1]) school = mb[1]; } } else d = unitDist(lvl, unit, d);
  const sch = splitName(canon(school), d);
  const key = lvl === 'state' ? `${year}.${cls}.state.${wNum(w)}` : `${year}.${cls}.${lvl}.${unit}.${wNum(w)}`;
  const s = sosRow(key, name);
  const base = nkey(name) + '|' + sch; const cs = (W.WR_CAREERS || {})[base]; let k = base; if (cs) cs.forEach((y0) => { if (year >= y0) k = base + '#' + y0; });
  A.push({ k, name, raw: school, sch, year, cls, lvl, w: wNum(w), std: stdIdx(wNum(w)), place: place >= 1 && place <= 8 ? place : 0, d: d || 0, unit, rating: s && s[0] ? s[0] : 0, field: 0, bw: s && s[1] ? s[1] : 0, bwn: s && s[2] ? s[2] : '' });
}
(W.WR_MEDALS || []).forEach(([year, cls, w, place, name, school, d]) => add('state', year, cls, null, w, place, name, school, d));
(W.WR_DATA.champs || []).concat(W.WR_CHAMP_FILL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 1, name, school, d));
(W.WR_QUAL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 0, name, school, d));
const SECDIR = path.join(__dirname, '..', 'data', 'brackets', 'lower-section'); // section qualifiers (below districts)
const lowerFiles = fs.readdirSync(path.join(OV, 'lower')).filter((f) => f.endsWith('.json')).map((f) => path.join(OV, 'lower', f))
  .concat(fs.existsSync(SECDIR) ? fs.readdirSync(SECDIR).filter((f) => f.endsWith('.json')).map((f) => path.join(SECDIR, f)) : []);
lowerFiles.forEach((fp) => {
  const f = path.basename(fp); const [year, lvl] = f.replace('.json', '').split('-');
  JSON.parse(fs.readFileSync(fp, 'utf8')).forEach(([cls, unit, w, place, , name, sch, , , d]) => add(lvl, +year, cls, unit, w, +place || 0, name, sch, d));
});
const LS = W.WR_LOWER_META.strs, LCLS = ['AAA', 'AA', 'single'];
[['district', W.WR_LOWER_D], ['regional', W.WR_LOWER_R]].forEach(([lvl, rows]) => (rows || []).forEach(([, year, c, ui, wi, place, ni, si, , , d]) => add(lvl, year, LCLS[c], LS[ui], LS[wi], place, LS[ni], LS[si], d)));

/* dedupe: one appearance per (wrestler, year, level), keep the best place */
const dd = new Map();
A.forEach((a) => { const k = a.k + '|' + a.year + '|' + a.lvl; const p = dd.get(k); if (!p || (a.place && (!p.place || a.place < p.place)) || (!p.rating && a.rating)) dd.set(k, p ? { ...p, ...a, rating: Math.max(p.rating, a.rating), place: a.place && (!p.place || a.place < p.place) ? a.place : p.place } : a); });
const APP = Array.from(dd.values());
APP.forEach((a) => { a.field = fieldOf(a); });
console.log('appearances with a field strength', APP.filter((a) => a.field).length);
console.log('appearances', A.length, 'deduped', APP.length);

/* lineage class for one-class seasons */
const clsCount = new Map();
APP.forEach((a) => { if (a.cls === 'AAA' || a.cls === 'AA') { const m = clsCount.get(a.sch) || { AAA: 0, AA: 0 }; m[a.cls]++; clsCount.set(a.sch, m); } });
const lineage = (s) => { const m = clsCount.get(s); return m ? (m.AAA >= m.AA ? 'AAA' : 'AA') : 'AAA'; };
const clsOf = (a) => (a.cls === 'AAA' || a.cls === 'AA' ? a.cls : a.cls === 'A' ? 'AAA' : a.cls === 'B' ? 'AA' : lineage(a.sch));

/* district → region per (year, class) from regional appearances */
const dr = new Map();
APP.filter((a) => a.lvl === 'regional' && a.d && a.unit).forEach((a) => { const k = a.year + '|' + clsOf(a) + '|' + a.d; const m = dr.get(k) || new Map(); m.set(a.unit, (m.get(a.unit) || 0) + 1); dr.set(k, m); });
const regionOf = (year, cls, d) => { const m = dr.get(year + '|' + cls + '|' + d); if (!m) return ''; const r = Array.from(m).sort((a, b) => b[1] - a[1])[0][0]; return r === 'W' ? 'SW' : r; };
/* district coverage: was there a district bracket for (year, class, district)? */
/* A district bracket counts as on file only when its full field is (entrants beyond the placewinners): champions-only fills
   (District III Records, WPIAL) and placewinner-only rows do not show who else wrestled, so they are not coverage. */
/* A full section field (D3, D7 and D1 AAA qualifiers below districts) shows the same thing, so it counts as coverage too. */
const fullCnt = new Map();
lowerFiles.filter((fp) => /-(district|section)\.json$/.test(fp)).forEach((fp) => {
  const year = +path.basename(fp).split('-')[0];
  JSON.parse(fs.readFileSync(fp, 'utf8')).forEach(([cls, unit, , , , , , , , d]) => {
    const dd = unitDist('district', unit, d); if (!dd) return; const c = normCls(cls) === 'single' ? lineage('') : normCls(cls);
    const k = year + '|' + (c === 'AAA' || c === 'AA' ? c : 'AAA') + '|' + dd; fullCnt.set(k, (fullCnt.get(k) || 0) + 1);
    if (normCls(cls) === 'single') { const k2 = year + '|AA|' + dd; fullCnt.set(k2, (fullCnt.get(k2) || 0) + 1); }
  });
});
const cov = new Set(); fullCnt.forEach((n, k) => { if (n >= 24) cov.add(k); }); // more than champions + runners-up for ~12 weights
/* weights contested per (year, class) */
const nW = new Map();
APP.filter((a) => a.lvl === 'state').forEach((a) => { const k = a.year + '|' + clsOf(a); const s = nW.get(k) || new Set(); s.add(a.std); nW.set(k, s); });

/* ---- real season ratings (tools/ratings.py entrant_ratings.csv: every entrant, sections included) ----
   The app hides first-round-only ratings, so overtime/sos leaves them out; Strength needs them, so read the season
   rating of every entrant from the ratings output. Key: year | weight | name, matched on school where names repeat. */
const WSF = ['entrant_ratings.csv', 'entrant_ratings.csv.gz', 'wrestler_seasons.csv', 'wrestler_seasons.csv.gz'].map((f) => path.join(__dirname, '..', 'data', 'difficulty', f)).find((f) => fs.existsSync(f));
const REAL = new Map();
{
  const txt = WSF.endsWith('.gz') ? require('zlib').gunzipSync(fs.readFileSync(WSF)).toString('utf8') : fs.readFileSync(WSF, 'utf8');
  const lines = txt.split('\n'); const h = lines[0].replace(/\r$/, '').split(','); const ix = (k) => h.indexOf(k);
  const iW = ix('weight'), iY = ix('year'), iN = ix('name'), iK = ix('key'), iS = ix('season');
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].replace(/\r$/, '').split(','); if (f.length !== h.length || f[iS] === '') continue;   // names with commas are quoted; rare, skipped
    const k = f[iY] + '|' + wNum(f[iW]) + '|' + nkey(f[iN]); const sk = (f[iK] || '').split('|')[1] || '';
    const L = REAL.get(k) || REAL.set(k, []).get(k); if (!L.some((x) => x[0] === sk)) L.push([sk, +f[iS]]);
  }
}
const realOf = (a) => { const L = REAL.get(a.year + '|' + a.w + '|' + nkey(a.name)); if (!L) return null; if (L.length === 1) return L[0][1]; const m = L.find((x) => x[0] === nkey(a.raw)); return m ? m[1] : null; };
let nReal = 0; APP.forEach((a) => { const v = realOf(a); a.real = v == null ? (a.rating || null) : v; if (v != null) nReal++; });
console.log('real season ratings', WSF.split('/').pop(), 'matched', nReal, 'of', APP.length);

/* ---- era-fair placement points ----
   Score counts placement points (16 12 9 7 5 3 2 1 for 1st-8th). Two things made raw totals unfair across eras:
   1. Places on file. The state record keeps 1st-2nd before 1974 (when only about four wrestlers reached states at a
      weight), 1st-4th for 1974-82, 1st-6th for 1983-2000 and 1st-8th since. Every weight still had a 3rd-8th best
      wrestler; we just don't know who. Each missing state place is shared out at its expected value: first among the
      bracket's state entrants with no place on file (a place they could have won), then, where the state bracket was
      too small to hold eight places, among the regional finalists of that weight who did not reach states (the next
      round down, best regional place first). Where neither list is on file (1938-50: no regionals) the place is left
      out rather than guessed.
   2. How much there was to win. Seasons had 9 to 14 weights, one class until 1974 and two since, and anywhere from
      about 50 to 500 schools wrestling, so a season's points per school swing threefold from era to era. Each season's
      points are therefore put in today's terms (below, after the school spans): points per school that season, at that
      level and in that class, are scaled to the 1999-2026 average.
   Regional and district points keep only the places on file: their entrant lists depend on which brackets survive, so
   filling them would reward districts with fuller archives. */
const bkOf = (a) => [a.lvl, a.year, normCls(a.cls), a.lvl === 'state' ? '' : a.unit, a.lvl === 'state' ? a.std : a.w].join('|');
const BKT = new Map(); APP.forEach((a) => { const k = bkOf(a); (BKT.get(k) || BKT.set(k, []).get(k)).push(a); });
APP.forEach((a) => { a.pts = a.place ? PTS[a.place - 1] : 0; a.fill = 0; });
/* regional finalists (by weight bucket) who did not reach states, per (year, class, weight bucket) */
const REGP = new Map(); APP.filter((a) => a.lvl === 'regional' && a.place).forEach((a) => { const k = a.year + '|' + normCls(a.cls) + '|' + a.std; (REGP.get(k) || REGP.set(k, []).get(k)).push(a); });
const atState = new Set(APP.filter((a) => a.lvl === 'state').map((a) => a.k + '|' + a.year));
let filled = 0, unfilled = 0;
BKT.forEach((rows, k) => {
  if (!k.startsWith('state|')) return;
  const have = new Set(rows.filter((a) => a.place).map((a) => a.place));
  let missing = [1, 2, 3, 4, 5, 6, 7, 8].filter((p) => !have.has(p));
  if (!missing.length) return;
  const share = (group) => {   // the group takes the next places in order, shared equally
    if (!group.length || !missing.length) return;
    const take = missing.slice(0, group.length); missing = missing.slice(take.length);
    const each = take.reduce((t, p) => t + PTS[p - 1], 0) / group.length; group.forEach((a) => { a.fill += each; }); filled += take.length;
  };
  share(rows.filter((a) => !a.place));
  if (missing.length) {
    const r0 = rows[0], reg = (REGP.get(r0.year + '|' + normCls(r0.cls) + '|' + r0.std) || []).filter((a) => !atState.has(a.k + '|' + a.year));
    const byPl = new Map(); reg.forEach((a) => { (byPl.get(a.place) || byPl.set(a.place, []).get(a.place)).push(a); });
    Array.from(byPl.keys()).sort((p, q) => p - q).forEach((p) => share(byPl.get(p)));
  }
  unfilled += missing.length;
});
console.log('state places not on file: shared out', filled, 'left out', unfilled);
/* era-fair points of one appearance (state places include the shared-out missing places) */
const fairPts = (a) => a.pts + (a.lvl === 'state' ? a.fill : 0);

/* ---- school seasons ----
   Strength: the school's lineup as a dual-meet team. At each weight its best wrestler that season at his real rating
   (first-round kids included); a weight with nobody entered is a forfeit (no chance). Average every weight's chance of
   beating the reference wrestler, then turn that average chance back into a rating: "wrestles like a lineup of
   wrestlers rated X at every weight" (reference: an average state qualifier, see REF). Only where the district's full field is on file: elsewhere a weight we can't see
   could be a forfeit or a kid who lost at districts, so the season gets no Strength (no estimate, no penalty).
   Talent: expected state medalists that season (above), same seasons as Strength.
   Score parts: era-fair placement points (above). */
const TALENT = 1650;   // kept for the before/after comparison only (TALENT_MODE=cut)
/* Talent = expected state medalists: each wrestler counts his chance of placing in the top eight at states given his
   season rating, P(medal | rating), so a 1640 and a 1660 count about the same and a 1900 counts nearly 1. The chance is
   a logistic fit on every rated wrestler-season from 2001 on (when all eight places are on file): medalled at states or
   not, against his season rating. Ratings are on one scale where 1500 is the average state qualifier of the class, so
   the same curve applies to every season and class. */
const wsx = new Map();
APP.forEach((a) => { if (a.real == null) return; const k = a.k + '|' + a.year; const x = wsx.get(k) || wsx.set(k, { r: a.real, y: a.year, m: 0 }).get(k); if (a.real > x.r) x.r = a.real; if (a.lvl === 'state' && a.place) x.m = 1; });
const fitX = Array.from(wsx.values()).filter((x) => x.y >= 2001);
let B0 = -2, B1 = 1;
for (let it = 0; it < 50; it++) {   // Newton steps on the logistic log-likelihood, rating centred at 1500
  let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
  fitX.forEach((x) => { const z = (x.r - 1500) / 100, p = 1 / (1 + Math.exp(-(B0 + B1 * z))), w = p * (1 - p); g0 += x.m - p; g1 += (x.m - p) * z; h00 += w; h01 += w * z; h11 += w * z * z; });
  const det = h00 * h11 - h01 * h01, d0 = (h11 * g0 - h01 * g1) / det, d1 = (h00 * g1 - h01 * g0) / det; B0 += d0; B1 += d1; if (Math.abs(d0) + Math.abs(d1) < 1e-9) break;
}
const pMedal = (r) => 1 / (1 + Math.exp(-(B0 + B1 * (r - 1500) / 100)));
const half = Math.round(1500 - 100 * B0 / B1);
const TALENT_MODE = process.env.TALENT_MODE || 'expected';
console.log(`Talent: P(state medal | rating) fitted on ${fitX.length} wrestler-seasons 2001-26; 50% at ${half};`, [1400, 1500, 1600, 1650, 1700, 1800, 1900].map((r) => r + ' ' + (100 * pMedal(r)).toFixed(0) + '%').join(', '),
  `; medalists counted ${fitX.filter((x) => x.m).length}, expected ${fitX.reduce((t, x) => t + pMedal(x.r), 0).toFixed(0)}`);
{ const by = {}; Array.from(wsx.values()).filter((x) => x.y >= 1974).forEach((x) => { const d = Math.floor(x.y / 10) * 10; const t = by[d] || (by[d] = [0, 0, 0]); t[0] += pMedal(x.r); t[1] += x.m; t[2] += x.r >= TALENT ? 1 : 0; });
  console.log('Talent by decade: expected medalists / medalists on file / wrestlers 1650+:', Object.entries(by).map(([d, t]) => d + ' ' + t.map((v) => Math.round(v)).join('/')).join(', ')); }
const pWin = (r, ref) => 1 / (1 + Math.pow(10, (ref - r) / 400));
const TEAMWIN = new Set((W.WR_TEAMS || []).filter((t) => t[2] === 1).map(([year, cls, , , sch]) => year + '|' + cls + '|' + canon(sch)));
const names = [], nidx = new Map(); const N = (s) => { if (!nidx.has(s)) { nidx.set(s, names.length); names.push(s); } return nidx.get(s); };
const schools = [], sidx = new Map(); const S = (s) => { if (!sidx.has(s)) { sidx.set(s, schools.length); schools.push(s); } return sidx.get(s); };
const bySS = new Map();
APP.forEach((a) => { const c = clsOf(a); const k = a.sch + '|' + a.year + '|' + c; (bySS.get(k) || bySS.set(k, []).get(k)).push(a); });
const SHOW = ['Nazareth', 'Easton', 'Northampton', 'Bethlehem Catholic', 'Bethlehem Liberty', 'Parkland', 'Notre Dame-Green Pond'];
const lineups = {};
const SEAS = []; // per school-season: {row, lineup: [real rating or null per contested weight], covered}
bySS.forEach((rows, k) => {
  const [sch, ys, c] = k.split('|'); const year = +ys;
  const dc = new Map(); rows.forEach((a) => { if (a.d) dc.set(a.d, (dc.get(a.d) || 0) + (a.lvl === 'district' || a.lvl === 'section' ? 3 : 1)); });
  const d = dc.size ? Array.from(dc).sort((a, b) => b[1] - a[1])[0][0] : 0;
  let reg = regionOf(year, c, d) || (rows.find((a) => a.lvl === 'regional' && a.unit) || {}).unit || ''; if (reg === 'W') reg = 'SW'; if (!['NE', 'NW', 'SC', 'SE', 'SW', 'CNW'].includes(reg)) reg = '';
  const covered = cov.has(year + '|' + c + '|' + d);
  const per = new Map(); // wrestler → {std, real, shown, D,R,S}
  rows.forEach((a) => { const p = per.get(a.k) || { name: a.name, std: a.std, real: null, shown: 0, X: -1, D: -1, R: -1, S: -1 };
    if (a.real != null && (p.real == null || a.real > p.real)) p.real = a.real; p.shown = Math.max(p.shown, a.rating);
    const L = { section: 'X', district: 'D', regional: 'R', state: 'S' }[a.lvl]; const pl = a.place || 0; if (p[L] < 0 || (pl && (!p[L] || pl < p[L]))) p[L] = pl; if (a.lvl === 'state') p.std = a.std; per.set(a.k, p); });
  const best = new Map(), unrated = new Set(); per.forEach((p) => { if (p.real == null) { unrated.add(p.std); return; } const b = best.get(p.std); if (!b || p.real > b.real) best.set(p.std, p); });
  const weights = Array.from(nW.get(year + '|' + c) || new Set(best.keys())).sort((a, b) => a - b);
  const lineup = weights.map((i) => (best.get(i) ? best.get(i).real : null));
  /* an entrant with no rating (his bracket's bouts are not on file) is not a forfeit, and we can't say how good he was:
     the season gets no Strength */
  const blind = weights.some((i) => !best.get(i) && unrated.has(i));
  const talent = TALENT_MODE === 'cut' ? Array.from(per.values()).filter((p) => p.real != null && p.real >= TALENT).length
    : Math.round(100 * Array.from(per.values()).reduce((t, p) => t + (p.real != null ? pMedal(p.real) : 0), 0)) / 100;
  const topW = Array.from(per.values()).filter((p) => p.shown).sort((a, b) => b.shown - a.shown)[0];
  const lv = (L) => rows.filter((a) => a.lvl === L);
  const pts = (L) => lv(L).reduce((t, a) => t + fairPts(a), 0);
  const regFill = lv('regional').reduce((t, a) => t + a.fill, 0);   // shared-out state places earned at regionals
  const st = lv('state');
  const row = [S(sch), year, c, d, reg, 0, pts('state') + regFill, pts('regional'), pts('district'),
    st.filter((a) => a.place === 1).length, st.filter((a) => a.place >= 2 && a.place <= 4).length, st.filter((a) => a.place >= 5).length, st.filter((a) => !a.place).length,
    lv('regional').filter((a) => a.place === 1).length, lv('district').filter((a) => a.place === 1).length, TEAMWIN.has(year + '|' + c + '|' + sch) ? 1 : 0, covered ? 1 : 0,
    topW ? N(topW.name) : -1, topW ? topW.shown : 0, covered ? talent : 0, lineup.filter((v) => v != null).length, weights.length];
  SEAS.push({ row, lineup, covered, blind, c, year, d });
  if (SHOW.includes(sch)) { (lineups[sch] = lineups[sch] || {})[year] = Array.from(best.entries()).sort((a, b) => a[0] - b[0]).map(([i, p]) => [i, p.name, Math.round(p.real), p.D, p.R, p.S]); }
});
/* the reference: the average AAA starter (a school's best wrestler at a weight, weights with nobody left out), over
   every season from 1974 on where the full district field is on file */
const refPool = []; SEAS.forEach((s) => { if (s.covered && s.c === 'AAA' && s.year >= 1974) s.lineup.forEach((v) => { if (v != null) refPool.push(v); }); });
/* The lineup is scored against an average state qualifier (1500), not the average starter: the average starter rates
   far below (first-round kids are rated low), which puts every lineup's number far under the wrestler scale and lets
   the weakest kids' ratings, which rest mostly on the first-round rule, decide it. UNIT_REF overrides it for tests. */
const AVG_STARTER = Math.round(refPool.reduce((a, b) => a + b, 0) / refPool.length);
const REF = process.env.UNIT_REF ? +process.env.UNIT_REF : 1500;
console.log('reference', REF, '(average AAA starter would be', AVG_STARTER, 'from', refPool.length, 'lineup spots)');
const strengthOf = (lineup) => { if (!lineup.length) return 0; const P = lineup.reduce((t, v) => t + (v == null ? 0 : pWin(v, REF)), 0) / lineup.length; if (P <= 0) return 0; return REF + 400 * Math.log10(P / (1 - P)); };
const ss = SEAS.map((s) => { if (s.covered && !s.blind && s.row[20]) s.row[5] = Math.round(strengthOf(s.lineup)); return s.row; });
{ const t = {}; SEAS.forEach((s) => { if (s.year < 1974) return; const k = 'D' + s.d + ' ' + (s.year < 1999 ? '74-98' : '99-26'); const x = t[k] || (t[k] = [0, 0, 0]); x[0]++; if (!s.covered) x[1]++; else if (s.blind) x[2]++; });
  console.log('school-seasons from 1974: [all, field not on file, entrant without a rating]'); console.log(Object.entries(t).sort().map(([k, v]) => k + ' ' + v.join('/')).join('  ')); }
console.log('school-seasons', ss.length, 'schools', schools.length, 'with Strength', ss.filter((r) => r[5]).length);

/* ---- school spans ----
   Score is a per-season average, so it needs to know how many seasons a school was wrestling, and a district's Score
   is per school, so it needs to know how many schools it had. A school only shows up in a season when one of its
   wrestlers is in a bracket on file, and where a district's brackets are missing (D3 and D7 1975-98) its weaker
   schools vanish from those seasons. Counting only the seasons and schools we can see would divide a gap district's
   points by too few and lift it. So a school counts in every season from its first to its last on file, in the
   district, region and class of its nearest season on file. */
const byS = new Map(); ss.forEach((r) => { (byS.get(r[0]) || byS.set(r[0], []).get(r[0])).push(r); });
const span = schools.map(() => [0, 0]);
const unitCnt = new Map();   // 'd|' or 'r|' + unit|year|cls -> schools wrestling that season
byS.forEach((rows, i) => {
  rows.sort((p, q) => p[1] - q[1]); const y0 = rows[0][1], y1 = rows[rows.length - 1][1]; span[i] = [y0, y1];
  let j = 0;
  for (let y = y0; y <= y1; y++) {
    while (j + 1 < rows.length && Math.abs(rows[j + 1][1] - y) < Math.abs(rows[j][1] - y)) j++;
    const near = rows.filter((r) => r[1] === y); (near.length ? near : [rows[j]]).forEach((r) => {
      const c = r[2], rg = regionOf(y, c, r[3]), reg = r[1] === y || !['NE', 'NW', 'SC', 'SE', 'SW', 'CNW'].includes(rg) ? r[4] : rg;
      if (r[3]) { const k = 'd|' + r[3] + '|' + y + '|' + c; unitCnt.set(k, (unitCnt.get(k) || 0) + 1); }
      if (reg) { const k = 'r|' + reg + '|' + y + '|' + c; unitCnt.set(k, (unitCnt.get(k) || 0) + 1); }
      { const k = 'all|' + y + '|' + c; unitCnt.set(k, (unitCnt.get(k) || 0) + 1); }
    });
  }
});

/* ---- points in today's terms ----
   For each season, class and level: points per school = the level's points that season / schools wrestling that season
   (spans above). Scale every school's points so that number equals its 1999-2026 average. District points are averaged
   only over district-seasons whose full field is on file, so missing district brackets don't move the scale. */
{
  const tot = new Map();
  ss.forEach((r) => { const k = r[1] + '|' + r[2]; const x = tot.get(k) || tot.set(k, [0, 0, 0, 0, 0]).get(k); x[0] += r[6]; x[1] += r[7]; if (r[16]) { x[2] += r[8]; x[4]++; } });
  const perSch = new Map(); tot.forEach((x, k) => { const n = unitCnt.get('all|' + k) || 0; if (n) perSch.set(k, [x[0] / n, x[1] / n, x[4] ? x[2] / x[4] : 0]); });
  const ref = [0, 1, 2].map((i) => { const v = Array.from(perSch).filter(([k, x]) => +k.split('|')[0] >= 1999 && x[i] > 0).map(([, x]) => x[i]); return v.reduce((a, b) => a + b, 0) / v.length; });
  console.log("today's terms: points per school per class-season 1999-2026: state", ref[0].toFixed(2), 'regional', ref[1].toFixed(2), 'district', ref[2].toFixed(2));
  const dec = {}; perSch.forEach((x, k) => { const d = Math.floor(+k.split('|')[0] / 10) * 10; const t = dec[d] || (dec[d] = [0, 0]); t[0] += x[0]; t[1]++; });
  console.log('state points per school before scaling, by decade:', Object.entries(dec).map(([d, t]) => d + ' ' + (t[0] / t[1]).toFixed(2)).join(', '));
  ss.forEach((r) => { const x = perSch.get(r[1] + '|' + r[2]); [6, 7, 8].forEach((c, i) => { r[c] = x && x[i] > 0 ? Math.round(10 * r[c] * ref[i] / x[i]) / 10 : 0; }); });
}

/* ---- district and region seasons ----
   Strength: the average Strength of its top quarter of schools that season (at least one school). A fixed share, not a
   fixed count, so a 50-school district isn't rewarded for its size and a 5-school district isn't made to count every
   school; every district is judged by its leading programs in the same proportion (Brock, 2026-11-05).
   Talent: its expected state medalists divided by its schools.
   Both only where every member school's full field is on file (otherwise the schools we can't see would be missing
   from the ranking and the school count). Score sums come from ss in the app. */
const TOP_SHARE = 0.25;
const unitRoll = (keyOf, kk) => {
  const m = new Map();
  ss.forEach((r) => { const u = keyOf(r); if (!u) return; const k = u + '|' + r[1] + '|' + r[2]; const x = m.get(k) || { u, y: r[1], c: r[2], n: 0, nCov: 0, str: [], tal: 0 }; x.n++; if (r[16]) { x.nCov++; x.tal += r[19]; if (r[5]) x.str.push(r[5]); } m.set(k, x); });
  return Array.from(m.values()).map((x) => {
    const all = x.n && x.nCov === x.n; const top = x.str.sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(x.str.length * TOP_SHARE)));
    return [x.u, x.y, x.c, all && top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : 0, all ? Math.round(100 * x.tal / x.n) / 100 : 0, x.n, Math.max(x.n, unitCnt.get(kk + '|' + x.u + '|' + x.y + '|' + x.c) || 0)];
  });
};
const ds = unitRoll((r) => r[3], 'd'), rs = unitRoll((r) => r[4], 'r');
console.log('district-seasons', ds.length, 'with Strength', ds.filter((x) => x[3]).length, 'region-seasons', rs.length, 'with Strength', rs.filter((x) => x[3]).length);

/* ---- output ----
   ss  [schoolIdx, year, cls, district, region, strength, statePts, regPts, distPts, stateTitles, podium2to4,
        placers5to8, stateQualsNoPlace, regTitles, distTitles, teamTitle, fullFieldOnFile, bestNameIdx, bestRating,
        talent, weightsFilled, weightsContested]   strength 0 = none (field not on file); talent counts only when on file
   ds / rs  [unit, year, cls, strength, talentPerSchool, schools, schoolsWrestling]  (0 = not on file for every member school;
            schoolsWrestling counts every school between its first and last season on file, for Score per school)
   span     [firstSeason, lastSeason] per school index, for Score per season
   statePts, regPts, distPts are era-fair placement points (see above), one decimal */
const typ = {}; ['district', 'regional', 'state'].forEach((L) => { const v = APP.filter((a) => a.lvl === L && a.field && a.year >= 1980).map((a) => a.field); typ[L] = Math.round(v.reduce((x, y) => x + y, 0) / v.length); });
const fset = new Map(); APP.filter((a) => a.lvl === 'state' && a.field).forEach((a) => fset.set(a.year + '|' + a.cls + '|' + a.w, a.field));
const fsorted = Array.from(fset.values()).sort((a, b) => a - b);
const pct = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((q) => fsorted[Math.min(fsorted.length - 1, Math.floor(q / 100 * (fsorted.length - 1)))]);
const out = { typField: typ, fieldPct: fsorted.filter((_, i) => i % 5 === 0), schools, names, span, ss, ref: REF, talentAt: TALENT_MODE === 'cut' ? TALENT : 0, talentHalf: half, ds, rs };
fs.writeFileSync(path.join(OV, 'units.js'), 'window.WR_UNITS=' + JSON.stringify(out) + ';\n');
console.log('units.js bytes', fs.statSync(path.join(OV, 'units.js')).size, 'state brackets', fsorted.length, 'deciles', pct.join(' '));
