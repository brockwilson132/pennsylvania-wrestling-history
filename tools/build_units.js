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

/* grade (FR..SR) per entrant from the parsed entrant lists, for the lineups (Compare shows it beside each name) */
const GRADE = new Map(), GI = { FR: 0, SO: 1, JR: 2, SR: 3 };
['lower_entrants.csv', 'state_entrants.csv'].forEach((f) => { const fp = path.join(__dirname, '..', 'data', 'brackets', f); if (!fs.existsSync(fp)) return;
  const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/), hd = lines[0].split(','), ix = (c) => hd.indexOf(c), [iY, iW, iN, iG] = ['year', 'weight', 'name', 'grade'].map(ix);
  lines.slice(1).forEach((line) => { const x = line.split(','); if (x.length !== hd.length || GI[x[iG]] == null) return; GRADE.set(x[iY] + '|' + wNum(x[iW]) + '|' + nkey(x[iN]), GI[x[iG]]); }); });
A.forEach((a) => { const g = GRADE.get(a.year + '|' + a.w + '|' + nkey(a.name)); a.g = g == null ? -1 : g; });
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
const nW = new Map(), nWA = new Map();
APP.filter((a) => a.lvl === 'state').forEach((a) => { const k = a.year + '|' + clsOf(a); const s = nW.get(k) || new Set(); s.add(a.std); nW.set(k, s); const t = nWA.get(k) || new Set(); t.add(a.w); nWA.set(k, t); });

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
/* postseason bouts per wrestler-season (year | weight | name): how much a season rating rests on */
const NBO = new Map();
{ const L = fs.readFileSync(path.join(__dirname, '..', 'data', 'brackets', 'bouts.csv'), 'utf8').split(/\r?\n/); const h = L[0].split(','); const [iY, iW, iA, iB] = ['year', 'weight', 'winner', 'loser'].map((c) => h.indexOf(c));
  for (let i = 1; i < L.length; i++) { const f = L[i].split(','); if (f.length !== h.length) continue; [iA, iB].forEach((j) => { if (!f[j]) return; const k = f[iY] + '|' + wNum(f[iW]) + '|' + nkey(f[j]); NBO.set(k, (NBO.get(k) || 0) + 1); }); } }
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
  rows.forEach((a) => { const p = per.get(a.k) || { name: a.name, std: a.std, w: a.w, real: null, nb: 0, shown: 0, X: -1, D: -1, R: -1, S: -1 }; if (p.g == null || p.g < 0) p.g = a.g; p.nb = Math.max(p.nb, NBO.get(a.year + '|' + a.w + '|' + nkey(a.name)) || 0);
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
  /* the lineup as far as regionals show it (regional and state entrants): all we can see where the district field is not on file */
  const bestR = new Map(); per.forEach((p) => { if (p.real == null || (p.R < 0 && p.S < 0)) return; const b = bestR.get(p.std); if (!b || p.real > b.real) bestR.set(p.std, p); });
  /* the lineup by the season's own weights (not weight brackets): [weight, his rating, his rating if he reached regionals] */
  const ws = Array.from(nWA.get(year + '|' + c) || new Set(rows.map((a) => a.w))).sort((a, b) => a - b);
  const bw = new Map(), bwR = new Map(); per.forEach((p) => { if (p.real == null) return; const w = p.w; if (!bw.has(w) || p.real > bw.get(w).real) bw.set(w, p); if ((p.R >= 0 || p.S >= 0) && (!bwR.has(w) || p.real > bwR.get(w).real)) bwR.set(w, p); });
  const lw = ws.map((w) => [w, bw.get(w) ? bw.get(w).real : null, bwR.get(w) ? bwR.get(w).real : null, bw.get(w) || null, bwR.get(w) || null]);
  SEAS.push({ lw, row, lineup, weights, sch, covered, blind, c, year, d, best, bestR, med: Array.from(per.values()).filter((p) => p.S > 0).map((p) => p.S).sort((a, b) => a - b).join('') });
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

/* ---- school seasons as dual-meet teams (overtime/seasons.json, the Rankings "School seasons" list) ----
   Every school season from 1974 on wrestles a dual meet against each of the 500 best school seasons (Brock, 2026-11-07).
   At each weight the two lineups' wrestlers meet at their season ratings: the chance of each result comes from the
   rating gap, so a 50-point edge isn't a sure win. Win chance on the rating scale (400); given a win, the split between
   decision 3, major 4, tech fall 5 and fall 6 comes from every 2010-26 bout between two rated wrestlers at that gap, so
   every era is scored by today's rules. A weight with nobody entered is scored as a district entrant who didn't place. Weights are matched by weight
   bracket (STDK); a weight only one season contested isn't wrestled, and the score is scaled to 13 bouts. A dual's win
   chance is the normal approximation of the team-score difference. Ranking = share of the 500 duals won.
   Where the district field is not on file (D3 and D7 1975-98, and seasons with an unrated entrant) the lineup is what
   regionals show; each weight with no regional wrestler is filled with what that spot held in seasons whose field is on
   file, in the same era and for teams of the same regional strength: a forfeit share plus five rating quantiles. Tested by
   hiding the field of every district in turn: the best seasons came out within 2-3 Strength points. Those rows are marked.
   Before 1974 season ratings read too low to compare (see RATED_FROM in the app), so the list starts in 1974. */
{
  const t0 = Date.now();
  const SEASON_FROM = 1974, FIELD_N = +(process.env.SEASON_FIELD || 500);
  /* bonus split by rating gap, from 2010-26 bouts */
  const W5 = new Map(), GAPS = []; let nBo = 0; // gap bin -> [dec, md, tf, fall]
  {
    const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'brackets', 'bouts.csv'), 'utf8').split(/\r?\n/);
    const hd = lines[0].split(','), ix = (c) => hd.indexOf(c);
    const [iY, iW, iWn, iLn, iR] = ['year', 'weight', 'winner', 'loser', 'result'].map(ix);
    const T = { dec: 0, md: 1, tf: 2, fall: 3 };
    const one = (y, w, n) => { const L = REAL.get(y + '|' + wNum(w) + '|' + nkey(n)); return L && L.length === 1 ? L[0][1] : null; };
    lines.slice(1).forEach((line) => { if (!line) return; const f = line.split(','); if (f.length !== hd.length) return; const y = +f[iY]; const t = T[f[iR]]; if (y < 2010 || t == null) return;
      const a = one(y, f[iW], f[iWn]), b = one(y, f[iW], f[iLn]); if (a == null || b == null) return;
      nBo++; GAPS.push([a - b, t]); const g = Math.floor(Math.max(-100, Math.min(600, a - b)) / 50) * 50; const x = W5.get(g) || W5.set(g, [0, 0, 0, 0]).get(g); x[t]++; });
  }
  const gb = Array.from(W5.keys()).sort((a, b) => a - b), gmix = gb.map((g) => { const x = W5.get(g), t = x.reduce((p, q) => p + q, 0); return x.map((v) => v / t); });
  const mixAt = (g) => { const x = Math.max(gb[0], Math.min(gb[gb.length - 1], g - 25)); let i = 0; while (i < gb.length - 2 && gb[i + 1] <= x) i++; const j = Math.min(gb.length - 1, i + 1), t = gb[j] === gb[i] ? 0 : Math.max(0, Math.min(1, (x - gb[i]) / (gb[j] - gb[i]))); return gmix[i].map((v, k) => v + (gmix[j][k] - v) * t); };
  console.log(`dual bonus split by gap (dec/md/tf/fall), ${nBo} bouts 2010-26:`, [0, 100, 200, 300, 400].map((g) => g + ' ' + mixAt(g).map((v) => v.toFixed(2)).join('/')).join(', '));
  const BP = [3, 4, 5, 6], GMAX = 3000, BM = new Float64Array(2 * GMAX / 5 + 1), BV = new Float64Array(2 * GMAX / 5 + 1);
  for (let i = 0; i < BM.length; i++) { const g = i * 5 - GMAX, p = 1 / (1 + Math.pow(10, -g / 400)), ma = mixAt(g), mb = mixAt(-g); let m = 0, s2 = 0;
    ma.forEach((q, k) => { m += p * q * BP[k]; s2 += p * q * BP[k] * BP[k]; }); mb.forEach((q, k) => { m -= (1 - p) * q * BP[k]; s2 += (1 - p) * q * BP[k] * BP[k]; }); BM[i] = m; BV[i] = s2 - m * m; }
  /* hard cutoffs (Brock): the higher-rated wrestler always wins, and the gap alone says how: the cut points split the
     2010-26 bouts by gap so that decisions, majors, tech falls and falls come out in their real shares */
  GAPS.sort((p, q) => p[0] - q[0]);
  const share = [0, 1, 2, 3].map((t) => GAPS.filter((g) => g[1] === t).length / GAPS.length);
  const CUT = [0, 1, 2].map((k) => GAPS[Math.min(GAPS.length - 1, Math.round(GAPS.length * share.slice(0, k + 1).reduce((p, q) => p + q, 0)))][0]);
  console.log('hard cutoffs: real shares dec/md/tf/fall', share.map((v) => v.toFixed(2)).join('/'), '; major from', Math.round(CUT[0]), 'tech fall from', Math.round(CUT[1]), 'fall from', Math.round(CUT[2]));
  const hardPts = (g) => (g < CUT[0] ? 3 : g < CUT[1] ? 4 : g < CUT[2] ? 5 : 6);
  const hard = (ra, rb) => (ra == null ? (rb == null ? 0 : -6) : rb == null ? 6 : ra === rb ? 0 : ra > rb ? hardPts(ra - rb) : -hardPts(rb - ra));
  /* one bout: [mean, mean of square] of (A points - B points); null = nobody entered */
  /* a season rating resting on few bouts is uncertain: its spread is UNC / sqrt(1 + bouts); the win chance is averaged
     over both wrestlers' spreads, which shrinks the gap the bout is scored at (UNC tuned on the real state duals below) */
  let UNC = +(process.env.SEASON_UNC || 0); const K2 = Math.PI * Math.pow(Math.LN10 / 400, 2) / 8;
  const varOf = (n) => (n == null ? 0 : UNC * UNC / (1 + n));
  const bout = (ra, rb, na, nb) => { if (ra == null) return rb == null ? [0, 0] : [-6, 36]; if (rb == null) return [6, 36]; let g = ra - rb; if (UNC) g /= Math.sqrt(1 + K2 * (varOf(na) + varOf(nb)));
    const i = Math.round((Math.max(-GMAX, Math.min(GMAX, g)) + GMAX) / 5); return [BM[i], BV[i] + BM[i] * BM[i]]; };
  /* the fill for a weight we can't see */
  const pv = (r) => 1 / (1 + Math.pow(10, (REF - r) / 400));
  const eraOf = (y) => (y < 1999 ? 0 : 1);
  const regLine = (s) => s.weights.map((i) => (s.bestR.get(i) ? s.bestR.get(i).real : null));
  const binOf = (s, R) => Math.min(9, Math.floor(20 * R.reduce((t, r) => t + (r != null ? pv(r) : 0), 0) / R.length));
  const UNK = new Map();
  SEAS.forEach((s) => { if (s.year < SEASON_FROM || !s.covered || s.blind || !s.row[5]) return; const R = regLine(s), k = eraOf(s.year) + '|' + binOf(s, R);
    R.forEach((r, j) => { if (r == null) (UNK.get(k) || UNK.set(k, []).get(k)).push(s.lineup[j]); }); });
  const FILL = new Map(); UNK.forEach((a, k) => { const f = a.filter((v) => v == null).length / a.length, v = a.filter((x) => x != null).sort((p, q) => p - q);
    FILL.set(k, [[null, f]].concat([0.1, 0.3, 0.5, 0.7, 0.9].map((q) => [v[Math.floor(q * (v.length - 1))], (1 - f) / 5]))); });
  /* an empty weight (nobody entered in the postseason) is not a forfeit: the school had someone in the room who didn't make
     the postseason lineup, so he is scored as a typical district entrant who didn't place, of the same era (five rating
     quantiles). The same rule for every era and district. SEASON_EMPTY=forfeit scores it as a forfeit instead. */
  const BK = [0, 1].map((e) => { const v = []; SEAS.forEach((s) => { if (s.year < SEASON_FROM || eraOf(s.year) !== e || !s.covered) return;
    s.lw.forEach((l) => { const p = l[3]; if (p && p.D === 0 && p.R < 0 && p.S < 0) v.push(p.real); }); }); v.sort((p, q) => p - q);
    return [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => [v[Math.floor(q * (v.length - 1))], 0.2]); });
  const FORFEIT = process.env.SEASON_EMPTY === 'forfeit';
  const empty = (y, wt) => (FORFEIT ? [[null, wt]] : BK[eraOf(y)].map(([r, w]) => [r, w * wt]));
  console.log('empty weight scored as a district non-placer, era quantiles:', BK.map((b) => b.map((x) => Math.round(x[0])).join('/')).join(' | '), FORFEIT ? '(off: forfeit)' : '');
  FILL.forEach((f, k) => { const e = +k.split('|')[0]; FILL.set(k, f.flatMap(([r, w]) => (r == null ? empty(e ? 2000 : 1990, w) : [[r, w]]))); });
  /* the pool: every school season from 1974 with a lineup we can see */
  const pool = [];
  SEAS.forEach((s) => { if (s.year < SEASON_FROM || !s.weights.length) return; const exact = s.covered && !s.blind && s.row[5]; const R = regLine(s);
    if (!exact && !R.some((r) => r != null)) return;
    const fill = exact ? null : FILL.get(eraOf(s.year) + '|' + binOf(s, R));
    /* one slot per weight the season actually had, lightest first (a weight bracket of STDK can hold two of a season's
       weights, 130 and 135 in 2002-11 or 182 and 195 in 2012-23, so slots are by position, not by bracket) */
    const lw = s.lw; const slot = lw.map((x) => (exact ? (x[1] != null ? [[x[1], 1, x[3].nb]] : empty(s.year, 1)) : x[2] != null ? [[x[2], 1, x[4].nb]] : fill));
    if (process.env.SEASON_ALIGN === 'bucket') { const o = new Array(STDK.length); s.weights.forEach((i, j) => { o[i] = exact ? [[s.lineup[j], 1]] : R[j] != null ? [[R[j], 1]] : fill; }); pool.push({ s, slot: o, est: !exact }); return; }
    slot.wts = lw.map((x) => x[0]); slot.wk = slot.wts.join(',');
    pool.push({ s, slot, est: !exact }); });
  /* two lineups meet weight by weight, each weight against the nearest weight of the other season and nobody twice
     (Brock, 2026-11-08). The pairing keeps weight order and takes the fewest total pounds apart, where leaving a weight
     out costs SIT pounds (heavyweight counted as 280): two weights more than 2 x SIT apart never meet, and a weight with no
     close partner sits out (2000 has 13 weights to 2017's 14: 2000's 140 meets 2017's 138, and 2000's 135 sits out).
     The score is scaled to 13 bouts, so a weight sitting out costs neither side. overtime/app/seasons.js pairs the same way. */
  const SIT = 8, wLb = (w) => (w >= 999 ? 280 : w);
  const pairs = (A, B) => { const n = A.length, m = B.length, d = (i, j) => Math.abs(wLb(A[i]) - wLb(B[j]));
    const f = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i + j) * SIT));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) f[i][j] = Math.min(f[i - 1][j - 1] + d(i - 1, j - 1), f[i - 1][j] + SIT, f[i][j - 1] + SIT);
    const out = []; let i = n, j = m; while (i > 0 && j > 0) { if (f[i][j] === f[i - 1][j - 1] + d(i - 1, j - 1)) { out.push([i - 1, j - 1]); i--; j--; } else if (f[i][j] === f[i - 1][j] + SIT) i--; else j--; }
    return out.reverse(); };
  const PAIRS = new Map(); const pairsOf = (A, B) => { const k = A.wk + '|' + B.wk; return PAIRS.get(k) || PAIRS.set(k, pairs(A.wts, B.wts)).get(k); };
  const dual = (A, B) => { let m = 0, q = 0, n = 0, h = 0; const bucket = process.env.SEASON_ALIGN === 'bucket';
    const P = bucket ? null : pairsOf(A, B);
    for (let b = 0; b < (bucket ? A.length : P.length); b++) { const a = bucket ? A[b] : A[P[b][0]], c = bucket ? B[b] : B[P[b][1]]; if (!a || !c) continue; n++;
      if (a.length === 1 && c.length === 1) { const r = bout(a[0][0], c[0][0], a[0][2], c[0][2]); m += r[0]; q += r[1] - r[0] * r[0]; h += hard(a[0][0], c[0][0]); continue; }
      let mm = 0, ee = 0; for (const [ra, wa, na] of a) for (const [rb, wb, nb] of c) { const r = bout(ra, rb, na, nb); mm += wa * wb * r[0]; ee += wa * wb * r[1]; h += wa * wb * hard(ra, rb); } m += mm; q += ee - mm * mm; }
    return n ? [m * 13 / n, q * 13 / n, h * 13 / n] : [0, 1, 0]; };
  const Phi = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));
  /* the 500: best by expected margin against every season (opponents at each weight pooled, rounded to 10 points) */
  /* tune on every real PIAA team-duals result on file (1230 since 1999), the same constants then used for every era:
     UNC, the spread of a season rating resting on few bouts, and TAU, the dual-to-dual swing a lineup can't show
     (lineup changes, weight bumps, a bad night), added to the spread of the team score */
  let TAU = 0;
  { global.window = global.window || {}; require(path.join(OV, 'duals.js')); const DS = (global.window.WR_DUALS || []); const byK = new Map(pool.map((p) => [p.s.sch + '|' + p.s.year + '|' + p.s.c, p]));
    const G = DS.map((d) => [byK.get(d[3] + '|' + d[0] + '|' + d[1]), byK.get(d[6] + '|' + d[0] + '|' + d[1]), d[5] - d[8], d]).filter((g) => g[0] && g[1] && g[2] !== 0);
    const evalU = (u, t) => { UNC = u; let ll = 0, ok = 0, se = 0; G.forEach(([a, b, real]) => { const [m, v] = dual(a.slot, b.slot); const p = Math.min(1 - 1e-6, Math.max(1e-6, Phi(m / Math.sqrt(v + t * t + 1e-9)))); ll -= Math.log(p); ok += p > 0.5; se += (m - real) * (m - real); }); return [ll / G.length, ok / G.length, Math.sqrt(se / G.length)]; };
    let best = null;
    (process.env.SEASON_UNC_GRID || '0,150,250,350,450,600').split(',').map(Number).forEach((u) => (process.env.SEASON_TAU_GRID || '0,4,8,12,16').split(',').map(Number).forEach((t) => {
      const r = evalU(u, t); console.log(`  spread ${u} swing ${t}: ${G.length} real duals, log loss ${r[0].toFixed(4)}, winner picked ${(100 * r[1]).toFixed(1)}%, margin rmse ${r[2].toFixed(1)}`); if (!best || r[0] < best[2]) best = [u, t, r[0]]; }));
    UNC = process.env.SEASON_UNC != null ? +process.env.SEASON_UNC : best[0]; TAU = process.env.SEASON_TAU != null ? +process.env.SEASON_TAU : best[1]; console.log('rating spread used:', UNC, 'dual swing used:', TAU);
    if (process.env.SEASON_SHOW) G.filter((g) => [g[0], g[1]].some((p) => p.s.sch + '|' + p.s.year === process.env.SEASON_SHOW)).forEach(([a, b, real, d]) => { const [m, v] = dual(a.slot, b.slot); console.log('   ', d[0], d[2], d[3], d[5] + '-' + d[8], d[6], '| model margin', m.toFixed(1), 'winner chance', (100 * Phi(m / Math.sqrt(v + TAU * TAU))).toFixed(0) + '%'); });
    /* do lineups with weak spots (a weight empty or below 700 in the postseason) beat the model's margin? */
    { const holes = (p) => p.slot.filter((o) => o.length === 1 ? o[0][0] == null || o[0][0] < 700 : false).length; const B = new Map();
      G.forEach(([a, b, real]) => { const [m] = dual(a.slot, b.slot); const k = Math.max(-4, Math.min(4, holes(a) - holes(b))); const x = B.get(k) || [0, 0, 0]; x[0]++; x[1] += real - m; x[2] += m; B.set(k, x);
        const k2 = 'r' + Math.max(-4, Math.min(4, holes(b) - holes(a))); const y = B.get(k2) || [0, 0, 0]; y[0]++; y[1] += m - real; y[2] -= m; B.set(k2, y); });
      [-4, -3, -2, -1, 0, 1, 2, 3, 4].forEach((k) => { const x = B.get(k) || [0, 0, 0], y = B.get('r' + k) || [0, 0, 0]; const n = x[0] + y[0]; if (n) console.log(`   weak spots, team minus opponent ${k}: ${n} duals, real minus model margin ${((x[1] + y[1]) / n).toFixed(1)}`); }); }
    if (process.env.SEASON_TUNE_ONLY) process.exit(0); }
  const NB = 14, posB = (j, n) => (n <= 1 ? 0 : Math.round(j * (NB - 1) / (n - 1)));
  const H = Array.from({ length: NB }, () => new Map()), HN = new Array(NB).fill(0);
  pool.forEach((p) => p.slot.forEach((o, j) => { if (!o) return; const b = posB(j, p.slot.length); HN[b]++; o.forEach(([r, w]) => { const k = r == null ? 'x' : Math.round(r / 10) * 10; H[b].set(k, (H[b].get(k) || 0) + w); }); }));
  const HA = H.map((m, b) => Array.from(m).map(([k, w]) => [k === 'x' ? null : k, w / Math.max(1, HN[b])]));
  pool.forEach((p) => { let m = 0, n = 0; p.slot.forEach((o, j) => { if (!o) return; n++; for (const [ra, wa, na] of o) for (const [rb, wb] of HA[posB(j, p.slot.length)]) m += wa * wb * bout(ra, rb, na, 2)[0]; }); p.m1 = n ? m * 13 / n : -99; });
  let field = pool.slice().sort((a, b) => b.m1 - a.m1).slice(0, FIELD_N);
  /* expected: chance of winning each dual; hard: the dual scored with cutoffs, a win 1, a tie a half */
  const rate = (F) => pool.forEach((p) => { let w = 0, m = 0, n = 0, hw = 0, hm = 0; for (const o of F) { if (o === p) continue; const [mm, v, hh] = dual(p.slot, o.slot); w += Phi(mm / Math.sqrt(v + TAU * TAU + 1e-9)); m += mm; hw += hh > 0.05 ? 1 : hh < -0.05 ? 0 : 0.5; hm += hh; n++; } p.win = w / n; p.mar = m / n; p.hwin = hw / n; p.hmar = hm / n; });
  rate(field);
  /* once more against the 500 best by the duals themselves */
  field = pool.slice().sort((a, b) => b.win - a.win).slice(0, FIELD_N); rate(field);
  pool.sort((a, b) => b.win - a.win || b.mar - a.mar);
  if (process.env.SEASON_DEBUG) { const [x, y] = process.env.SEASON_DEBUG.split(',').map((k) => pool.find((p) => p.s.sch + '|' + p.s.year + '|' + p.s.c === k));
    const P = pairsOf(x.slot, y.slot); let tot = 0;
    P.forEach(([i, j]) => { const a = x.slot[i], b = y.slot[j]; let r = 0, h = 0; for (const [ra, wa, na] of a) for (const [rb, wb, nb] of b) { r += wa * wb * bout(ra, rb, na, nb)[0]; h += wa * wb * hard(ra, rb); } tot += r; console.log('  ', x.s.lw[i][0], a.length > 1 ? 'empty' : Math.round(a[0][0] || 0), 'vs', y.s.lw[j][0], b.length > 1 ? 'empty' : Math.round(b[0][0] || 0), r.toFixed(1), 'cut', h.toFixed(1)); });
    console.log('  expected margin', tot.toFixed(1), 'ranks', pool.indexOf(x) + 1, pool.indexOf(y) + 1); }
  console.log(`school seasons as duals: ${pool.length} seasons (${pool.filter((p) => p.est).length} with weights filled), field ${FIELD_N}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  { const hr = pool.slice().sort((a, b) => b.hwin - a.hwin || b.hmar - a.hmar); const hk = new Map(hr.map((p, i) => [p, i + 1]));
    pool.forEach((p) => { p.hrk = hk.get(p); });
    pool.slice(0, 25).forEach((p, i) => console.log('  ' + (i + 1), p.s.sch, p.s.year, p.s.c, (100 * p.win).toFixed(1) + '%', 'margin ' + p.mar.toFixed(1), '| hard #' + p.hrk, (100 * p.hwin).toFixed(1) + '%', p.hmar.toFixed(1), p.est ? '(filled)' : ''));
    console.log('  hard cutoffs top 25:'); hr.slice(0, 25).forEach((p, i) => console.log('  ' + (i + 1), p.s.sch, p.s.year, p.s.c, (100 * p.hwin).toFixed(1) + '%', 'margin ' + p.hmar.toFixed(1), '| expected #' + (pool.indexOf(p) + 1), p.est ? '(filled)' : '')); }
  /* output. seasons.json (loaded when the list is opened):
       rows [schoolIdx (WR_UNITS.schools), year, class, district, region, duals won per 1000, average margin x10, the same
             two with hard cutoffs, weights
             filled (1) or field on file (0), Strength, state points, state titles, state medals, team title, state places ('1135')]
     seasons/<first letter of the school slug>.json (loaded when a row is opened): { slug: { year: lineup } }, lineup =
       [[weight (999 = heavyweight), name, rating, district place, regional place, state place, grade 0-3 FR-SR or -1, bouts behind the rating], ...] (place -1 not there, 0 entered
       without a place; a weight with nobody is [weight bracket]) */
  const slugS = (x) => String(x).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const LB = {};
  const rows = pool.map((p) => { const s = p.s, r = s.row;
    const sl = slugS(s.sch); if (sl) { const o = (LB[sl[0]] = LB[sl[0]] || {}); const x = o[sl] || (o[sl] = {});
      x[s.year + (s.c === 'AA' ? 'b' : '')] = s.lw.map((l) => { const w = p.est ? l[4] : l[3]; return w ? [l[0], w.name, Math.round(w.real), w.D, w.R, w.S, w.g == null ? -1 : w.g, w.nb || 0] : [l[0]]; }); }
    return [r[0], s.year, s.c === 'AA' ? 1 : 0, r[3], r[4], Math.round(1000 * p.win), Math.round(10 * p.mar), Math.round(1000 * p.hwin), Math.round(10 * p.hmar), p.est ? 1 : 0, r[5], r[6], r[9], r[10] + r[11], r[15], s.med]; });
  /* sim: what the app needs to wrestle any two seasons against each other the same way (Compare): the bonus split by gap
     (gap bins, [dec, md, tf, fall] shares), the hard cut points, the rating spread and dual swing, the empty-weight
     quantiles by era, and the fill for weights we can't see, keyed era|bin */
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const sim = { gb, mix: gmix.map((x) => x.map(r3)), cut: CUT.map((v) => Math.round(v)), ref: REF, unc: UNC, tau: TAU, sit: SIT, forfeit: FORFEIT ? 1 : 0,
    empty: BK.map((b) => b.map(([r, w]) => [Math.round(r), r3(w)])), fill: Object.fromEntries(Array.from(FILL).map(([k, v]) => [k, v.map(([r, w]) => [r == null ? null : Math.round(r), r3(w)])])) };
  fs.writeFileSync(path.join(OV, 'seasons.json'), JSON.stringify({ field: FIELD_N, from: SEASON_FROM, w: STDK.map((x) => x[0]), sim, rows }));
  const dir = path.join(OV, 'seasons'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  let lb = 0; Object.entries(LB).forEach(([c, o]) => { const t = JSON.stringify(o); lb += t.length; fs.writeFileSync(path.join(dir, c + '.json'), t); });
  console.log('seasons.json bytes', fs.statSync(path.join(OV, 'seasons.json')).size, 'lineups', Object.keys(LB).length, 'files', lb, 'bytes');
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

/* ---- head to head (overtime/h2h/<first letter of school slug>.json, keyed by slug, loaded by the head-to-head page) ----
   o: every postseason bout between this school's wrestlers and another school's, as [year, won, lost] per opponent
      (forfeits, injury defaults and DQs left out; a bout's schools are the ones its wrestlers are filed under above).
   L: the lineup of every season with a Strength, [weight slot, real rating or null for a forfeit] — the app plays two
      lineups against each other weight by weight for dual-meet odds. */
{
  const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const who = new Map(); // year|lvl|weight|name(|raw school) -> school
  const put = (k, sch) => { const p = who.get(k); who.set(k, p === undefined || p === sch ? sch : null); };
  A.forEach((a) => { const k = `${a.year}|${a.lvl}|${a.w}|${nkey(a.name)}`; put(k, a.sch); put(k + '|' + nkey(a.raw), a.sch); });
  const schOf = (year, lvl, w, name, raw) => { const k = `${year}|${lvl}|${wNum(w)}|${nkey(name)}`; return who.get(k + '|' + nkey(raw)) || who.get(k) || splitName(canon(raw), 0); };
  /* spellings that differ only in punctuation ("Bellwood Antis", "Bellwood-Antis") share an address in the app: one school here too */
  const one = new Map(); schools.forEach((s) => { const k = slug(s); if (!one.has(k)) one.set(k, s); });
  const same = (s) => { const k = slug(s); if (!one.has(k)) one.set(k, s); return one.get(k); };
  const H = new Map(); const get = (s) => H.get(s) || H.set(s, { L: {}, o: {} }).get(s);
  const lines = fs.readFileSync(path.join(__dirname, '..', 'data', 'brackets', 'bouts.csv'), 'utf8').split(/\r?\n/);
  const hd = lines[0].split(','), ix = (c) => hd.indexOf(c);
  const [iL, iY, iW, iWn, iWs, iLn, iLs, iR] = ['level', 'year', 'weight', 'winner', 'winner_school', 'loser', 'loser_school', 'result'].map(ix);
  const csv = (line) => { const o = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; };
  let nb = 0;
  lines.slice(1).forEach((line) => { if (!line) return; const f = csv(line); if (['ff', 'inj', 'dq'].includes(f[iR])) return;
    if (!String(f[iWs] || '').trim() || !String(f[iLs] || '').trim()) return;
    const y = +f[iY], a = same(schOf(y, f[iL], f[iW], f[iWn], f[iWs])), b = same(schOf(y, f[iL], f[iW], f[iLn], f[iLs])); if (!a || !b || a === b) return;
    const tally = (s, o, won) => { const m = get(s).o; const L = m[o] || (m[o] = []); let r = L[L.length - 1]; if (!r || r[0] !== y) { r = L.find((x) => x[0] === y); if (!r) { r = [y, 0, 0]; L.push(r); } } r[won ? 1 : 2]++; };
    tally(a, b, true); tally(b, a, false); nb++; });
  SEAS.forEach((s) => { if (!s.row[5]) return; const L = get(same(s.sch)).L, prev = L[s.year];
    if (prev && prev.s >= s.row[5]) return; L[s.year] = { s: s.row[5], w: s.weights.map((i, j) => [i, s.lineup[j] == null ? null : Math.round(s.lineup[j])]) }; });
  const dir = path.join(OV, 'h2h'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const seen = new Map(), B = {}; let bytes = 0;
  H.forEach((v, sch) => { const sl = slug(sch); if (!sl) return; if (seen.has(sl)) { console.log('h2h slug clash', sl, seen.get(sl), sch); return; } seen.set(sl, sch);
    Object.values(v.o).forEach((L) => L.sort((p, q) => p[0] - q[0]));
    const L = {}; Object.entries(v.L).forEach(([y, x]) => { L[y] = [x.s, x.w]; });
    (B[sl[0]] = B[sl[0]] || {})[sl] = { n: sch, L, o: v.o }; });
  /* one file per first letter of the slug: the published artifact holds at most 511 files, so 790 school files won't fit */
  Object.entries(B).forEach(([c, o]) => { const txt = JSON.stringify(o); bytes += txt.length; fs.writeFileSync(path.join(dir, c + '.json'), txt); });
  console.log('h2h: bouts between schools', nb, 'schools', seen.size, 'files', Object.keys(B).length, 'bytes', bytes);
}
