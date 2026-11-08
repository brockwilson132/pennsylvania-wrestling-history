/* Data for the design-directions page (overtime/proposals/).
 *   node tools/build_proposal.js
 * Emits overtime/proposals/data.json:
 *   schools    [name…]
 *   ss         per school-season: [schoolIdx, year, cls, district, region, teamRating, statePts, regPts, distPts,
 *               stateTitles, podium2to4, placers5to8, stateQualsNoPlace, regTitles, distTitles, teamTitle, coverage]
 *   lineups    {schoolName: {year: [[stdIdx, name, rating, D, R, S]…]}} for a few showcase schools
 *   wrestlers  {AAA: [...], AA: [...]} card pool: each season's ten best careers; the page picks any window's top ten
 * Team rating (per season) = mean Overtime Rating of the school's best wrestler at each standardized weight;
 * a weight with no entrant counts as a replacement-level 1000 (1100 where the district bracket is missing).
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
const SPLIT = { Trinity: { 7: 'Trinity (Washington)' }, 'Hempfield Area': { 3: 'Hempfield' }, Hempfield: { 7: 'Hempfield Area' }, 'Bethlehem Liberty': { 4: 'Liberty' }, 'Pius X (Roseto)': { 1: 'St. Pius X' }, 'Bishop McDevitt': { 12: 'Bishop McDevitt (12)' } };
const splitName = (sch, d) => (SPLIT[sch] && SPLIT[sch][d]) || sch;
const unitDist = (lvl, unit, d) => { if (lvl !== 'district') return d; const m = /^D(\d+)(?:_|$)/.exec(unit || ''); return m ? +m[1] : d; };
const STDK = [['98', 0, 101], ['107', 102, 110], ['114', 111, 117], ['121', 118, 124], ['127', 125, 129], ['133', 130, 136], ['139', 137, 142], ['145', 143, 148], ['152', 149, 156], ['160', 157, 166], ['172', 167, 180], ['189', 181, 200], ['215', 201, 240], ['HWT', 241, 9999]];
const stdIdx = (wn) => { const i = STDK.findIndex(([, a, b]) => wn >= a && wn <= b); return i < 0 ? STDK.length - 1 : i; };
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
const FILL = 1000; // replacement level for a weight where the school entered no one
const FIVE = ['NE', 'NW', 'SC', 'SE', 'SW'];
const normCls = (c) => (c === 'A' ? 'AAA' : c === 'B' ? 'AA' : c);

const SOS = new Map();
const sosOf = (year) => { if (!SOS.has(year)) { const f = path.join(OV, 'sos', year + '.json'); SOS.set(year, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}); } return SOS.get(year); };
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
  if (!name || !nkey(name)) return;
  if (lvl === 'state') { const mb = MEMB[`${year}|${cls}|${wNum(w)}|${nkey(name)}`]; if (mb) { d = mb[0]; if (mb[1]) school = mb[1]; } } else d = unitDist(lvl, unit, d);
  const sch = splitName(canon(school), d);
  const key = lvl === 'state' ? `${year}.${cls}.state.${wNum(w)}` : `${year}.${cls}.${lvl}.${unit}.${wNum(w)}`;
  const s = sosRow(key, name);
  const base = nkey(name) + '|' + sch; const cs = (W.WR_CAREERS || {})[base]; let k = base; if (cs) cs.forEach((y0) => { if (year >= y0) k = base + '#' + y0; });
  A.push({ k, name, sch, year, cls, lvl, w: wNum(w), std: stdIdx(wNum(w)), place: place >= 1 && place <= 8 ? place : 0, d: d || 0, unit, rating: s && s[0] ? s[0] : 0, field: 0, bw: s && s[1] ? s[1] : 0, bwn: s && s[2] ? s[2] : '' });
}
(W.WR_MEDALS || []).forEach(([year, cls, w, place, name, school, d]) => add('state', year, cls, null, w, place, name, school, d));
(W.WR_DATA.champs || []).concat(W.WR_CHAMP_FILL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 1, name, school, d));
(W.WR_QUAL || []).forEach(([year, cls, w, name, school, d]) => add('state', year, cls, null, w, 0, name, school, d));
fs.readdirSync(path.join(OV, 'lower')).filter((f) => f.endsWith('.json')).forEach((f) => {
  const [year, lvl] = f.replace('.json', '').split('-');
  JSON.parse(fs.readFileSync(path.join(OV, 'lower', f), 'utf8')).forEach(([cls, unit, w, place, , name, sch, , , d]) => add(lvl, +year, cls, unit, w, +place || 0, name, sch, d));
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
const cov = new Set(APP.filter((a) => a.lvl === 'district' && a.d).map((a) => a.year + '|' + clsOf(a) + '|' + a.d));
/* weights contested per (year, class) */
const nW = new Map();
APP.filter((a) => a.lvl === 'state').forEach((a) => { const k = a.year + '|' + clsOf(a); const s = nW.get(k) || new Set(); s.add(a.std); nW.set(k, s); });

/* typical rating of a wrestler whose season ended at districts (used where a district bracket is missing) */
const endedAt = new Map(); APP.forEach((a) => { const k = a.k + '|' + a.year; const L = { district: 1, regional: 2, state: 3 }[a.lvl]; const x = endedAt.get(k) || { L: 0, r: 0 }; x.L = Math.max(x.L, L); x.r = Math.max(x.r, a.rating); endedAt.set(k, x); });
const dOnly = Array.from(endedAt.values()).filter((x) => x.L === 1 && x.r).map((x) => x.r);
const DIST_ONLY = Math.round(dOnly.reduce((a, b) => a + b, 0) / dOnly.length);
console.log('typical district-only rating', DIST_ONLY);

/* ---- school seasons ---- */
const TEAMWIN = new Set((W.WR_TEAMS || []).filter((t) => t[2] === 1).map(([year, cls, , , sch]) => year + '|' + cls + '|' + canon(sch)));
const names = [], nidx = new Map(); const N = (s) => { if (!nidx.has(s)) { nidx.set(s, names.length); names.push(s); } return nidx.get(s); };
const schools = [], sidx = new Map(); const S = (s) => { if (!sidx.has(s)) { sidx.set(s, schools.length); schools.push(s); } return sidx.get(s); };
const bySS = new Map();
APP.forEach((a) => { const c = clsOf(a); const k = a.sch + '|' + a.year + '|' + c; (bySS.get(k) || bySS.set(k, []).get(k)).push(a); });
const ss = [];
const SHOW = ['Nazareth', 'Easton', 'Northampton', 'Bethlehem Catholic', 'Bethlehem Liberty', 'Parkland', 'Notre Dame-Green Pond'];
const lineups = {};
bySS.forEach((rows, k) => {
  const [sch, ys, c] = k.split('|'); const year = +ys;
  const dc = new Map(); rows.forEach((a) => { if (a.d) dc.set(a.d, (dc.get(a.d) || 0) + (a.lvl === 'district' ? 3 : 1)); });
  const d = dc.size ? Array.from(dc).sort((a, b) => b[1] - a[1])[0][0] : 0;
  let reg = regionOf(year, c, d) || (rows.find((a) => a.lvl === 'regional' && a.unit) || {}).unit || ''; if (reg === 'W') reg = 'SW'; if (!['NE', 'NW', 'SC', 'SE', 'SW', 'CNW'].includes(reg)) reg = '';
  const covered = cov.has(year + '|' + c + '|' + d);
  /* lineup: best rated wrestler per weight */
  const best = new Map();
  const per = new Map(); // wrestler → {std, rating, D,R,S}
  rows.forEach((a) => { const p = per.get(a.k) || { name: a.name, std: a.std, rating: 0, fwd: 0, D: -1, R: -1, S: -1 }; p.rating = Math.max(p.rating, a.rating); if (a.lvl !== 'district') p.fwd = 1; const L = a.lvl[0].toUpperCase(); const pl = a.place || 0; if (p[L] < 0 || (pl && (!p[L] || pl < p[L]))) p[L] = pl; if (a.lvl === 'state') p.std = a.std; per.set(a.k, p); });
  per.forEach((p) => { const b = best.get(p.std); if (!b || p.rating > b.rating) best.set(p.std, p); });
  /* team rating counts only wrestlers who advanced past districts (regional or state entrants): the regional fields
     are on file for every district, while some district brackets are not, so this stays fair across districts */
  const fwdBest = new Map(); per.forEach((p) => { if (!p.rating) return; const b = fwdBest.get(p.std); if (!b || p.rating > b.rating) fwdBest.set(p.std, p); });
  const weights = nW.get(year + '|' + c) || new Set(Array.from(best.keys()));
  const fill = covered ? FILL : DIST_ONLY; // no district bracket on file: assume a typical district-only entrant
  let sum = 0, n = 0; weights.forEach((i) => { const b = fwdBest.get(i); sum += b ? b.rating : fill; n++; });
  const rated = fwdBest.size > 0 || Array.from(best.values()).some((b) => b.rating);
  const teamRating = rated && n ? Math.round(sum / n) : 0;
  const topW = Array.from(per.values()).filter((p) => p.rating).sort((a, b) => b.rating - a.rating)[0];
  const lv = (L) => rows.filter((a) => a.lvl === L);
  const pts = (L) => lv(L).reduce((t, a) => t + (a.place ? PTS[a.place - 1] : 0), 0);
  const st = lv('state');
  ss.push([S(sch), year, c, d, reg, teamRating, pts('state'), pts('regional'), pts('district'),
    st.filter((a) => a.place === 1).length, st.filter((a) => a.place >= 2 && a.place <= 4).length, st.filter((a) => a.place >= 5).length, st.filter((a) => !a.place).length,
    lv('regional').filter((a) => a.place === 1).length, lv('district').filter((a) => a.place === 1).length, TEAMWIN.has(year + '|' + c + '|' + sch) ? 1 : 0, covered ? 1 : 0,
    topW ? N(topW.name) : -1, topW ? topW.rating : 0]);
  if (SHOW.includes(sch)) { (lineups[sch] = lineups[sch] || {})[year] = Array.from(best.entries()).sort((a, b) => a[0] - b[0]).map(([i, p]) => [i, p.name, p.rating, p.D, p.R, p.S]); }
});
console.log('school-seasons', ss.length, 'schools', schools.length);

/* ---- district and region seasons ----
   district rating = mean Overtime Rating of the wrestlers it sent to regionals that season (one per wrestler);
   region rating   = mean Overtime Rating of the wrestlers it sent to states.
   Both are averages per wrestler sent, so a big district is not rated higher for being big; slot counts already
   scale with the number of schools. */
/* a unit's season rating = how strong its tournament is at the top: the mean Overtime Rating of its four best wrestlers
   at each weight that season (wherever they wrestled), averaged over the weights. Top-4 is the district/regional
   podium that advances; it does not depend on which brackets are on file, and a bigger district earns a higher number
   only when its top four really are better. */
const unitSeason = (unitOf) => {
  const pw = new Map(); // u|year|cls|std -> [ratings of wrestlers]
  const seen = new Map();
  APP.filter((a) => a.rating).forEach((a) => { const c = clsOf(a); const u = unitOf(a, c); if (!u) return; const wk = a.k + '|' + a.year; const k = u + '|' + a.year + '|' + c + '|' + a.std; const s = seen.get(k) || new Map(); s.set(wk, Math.max(s.get(wk) || 0, a.rating)); seen.set(k, s); });
  const m = new Map();
  seen.forEach((s, k) => { const [u, y, c] = k.split('|'); const top = Array.from(s.values()).sort((a, b) => b - a).slice(0, 4); while (top.length < 4) top.push(DIST_ONLY); const avg = top.reduce((a, b) => a + b, 0) / 4; const kk = u + '|' + y + '|' + c; const x = m.get(kk) || { sum: 0, n: 0 }; x.sum += avg; x.n++; m.set(kk, x); });
  return m;
};
const dRate = unitSeason((a) => a.d);
const rRate = unitSeason((a, c) => regionOf(a.year, c, a.d) || '');
const rollup = (keyOf, rate) => {
  const m = new Map();
  ss.forEach((r) => { const u = keyOf(r); if (!u) return; const k = u + '|' + r[1] + '|' + r[2]; const x = m.get(k) || [u, r[1], r[2], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 6; i <= 15; i++) x[i - 2] += r[i]; x[14] = (x[14] || 0) + 1; m.set(k, x); });
  return Array.from(m.values()).map((x) => { const q = rate.get(x[0] + '|' + x[1] + '|' + x[2]); x[3] = q ? Math.round(q.sum / q.n) : 0; return x; });
};
/* [unit, year, cls, rating, statePts, regPts, distPts, stateTitles, podium2to4, placers5to8, qualsNoPlace, regTitles, distTitles, teamTitles, schools] */
const ds = rollup((r) => r[3], dRate), rs = rollup((r) => r[4], rRate);
console.log('district-seasons', ds.length, 'region-seasons', rs.length);

/* ---- wrestler cards ---- */
const byW = new Map(); APP.forEach((a) => (byW.get(a.k) || byW.set(a.k, []).get(a.k)).push(a));
function card(rows) {
  rows.sort((a, b) => a.year - b.year);
  const L = rows[rows.length - 1];
  const years = Array.from(new Set(rows.map((a) => a.year))).sort();
  const seasons = years.map((y) => { const r = rows.filter((a) => a.year === y); const f = (L) => { const x = r.find((a) => a.lvl === L); return x ? x.place : -1; }; const fl = (L) => { const x = r.find((a) => a.lvl === L); return x ? x.field : 0; }; const st = r.find((a) => a.lvl === 'state') || r[0]; return [y, STDK[st.std][0], Math.max(...r.map((a) => a.rating)), f('district'), f('regional'), f('state'), fl('district'), fl('regional'), fl('state')]; });
  const bw = rows.reduce((b, a) => (a.bw > b[0] ? [a.bw, a.bwn, a.year, a.lvl] : b), [0, '', 0, '']);
  const c = clsOf(L);
  return { name: L.name, sch: L.sch, y0: years[0], y1: years[years.length - 1], cls: c, peak: Math.max(...rows.map((a) => a.rating)), titles: rows.filter((a) => a.lvl === 'state' && a.place === 1).length, medals: rows.filter((a) => a.lvl === 'state' && a.place).length, weights: Array.from(new Set(rows.map((a) => STDK[a.std][0]))), seasons, bw };
}
const cards = Array.from(byW.values()).map(card).filter((c) => c.peak > 0);
/* pool: for each (class, season), the ten best careers (by peak) active that season. Any window's top ten is a
   subset of this pool: a wrestler in a window's top ten is in the top ten of every season he wrestled inside it. */
const pool = { AAA: new Set(), AA: new Set() };
['AAA', 'AA'].forEach((c) => {
  const byY = new Map(); cards.filter((x) => x.cls === c).forEach((x) => x.seasons.forEach((sx) => { (byY.get(sx[0]) || byY.set(sx[0], []).get(sx[0])).push(x); }));
  byY.forEach((L) => L.sort((a, b) => b.peak - a.peak || b.titles - a.titles).slice(0, 10).forEach((x) => pool[c].add(x)));
});
const wrestlers = { AAA: Array.from(pool.AAA), AA: Array.from(pool.AA) };
const longest = Math.max(...cards.map((c) => c.y1 - c.y0 + 1));
const typ = {}; ['district', 'regional', 'state'].forEach((L) => { const v = APP.filter((a) => a.lvl === L && a.field && a.year >= 1980).map((a) => a.field); typ[L] = Math.round(v.reduce((x, y) => x + y, 0) / v.length); });
const out = { typField: typ, schools, names, ss, ds, rs, lineups, wrestlers, std: STDK.map((s) => s[0]), longestCareer: longest, built: new Date().toISOString().slice(0, 10) };
fs.mkdirSync(path.join(OV, 'proposals'), { recursive: true });
fs.writeFileSync(path.join(OV, 'proposals', 'data.json'), JSON.stringify(out));
console.log('bytes', fs.statSync(path.join(OV, 'proposals', 'data.json')).size, 'pool', wrestlers.AAA.length, wrestlers.AA.length, 'longest career', longest);

