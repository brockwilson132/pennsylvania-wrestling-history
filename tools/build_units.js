/* Unit ratings and per-season results for the app (overtime/units.js).
 *   node tools/build_units.js
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
const SPLIT = { Trinity: { 7: 'Trinity (Washington)' }, 'Hempfield Area': { 3: 'Hempfield' }, Hempfield: { 7: 'Hempfield Area' }, 'Bethlehem Liberty': { 4: 'Liberty' }, 'Pius X (Roseto)': { 1: 'St. Pius X' } };
const splitName = (sch, d) => (SPLIT[sch] && SPLIT[sch][d]) || sch;
const unitDist = (lvl, unit, d) => { if (lvl !== 'district' && lvl !== 'section') return d; const m = /^D(\d+)(?:_|$)/.exec(unit || ''); return m ? +m[1] : d; };
const STDK = [['98', 0, 101], ['107', 102, 110], ['114', 111, 117], ['121', 118, 124], ['127', 125, 129], ['133', 130, 136], ['139', 137, 142], ['145', 143, 148], ['152', 149, 156], ['160', 157, 166], ['172', 167, 180], ['189', 181, 200], ['215', 201, 240], ['HWT', 241, 9999]];
const stdIdx = (wn) => { const i = STDK.findIndex(([, a, b]) => wn >= a && wn <= b); return i < 0 ? STDK.length - 1 : i; };
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
const FILL = 1000; // replacement level for a weight where the school entered no one
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

/* typical rating of a wrestler whose season ended at districts (used where a district bracket is missing) */
const endedAt = new Map(); APP.forEach((a) => { const k = a.k + '|' + a.year; const L = { section: 0.5, district: 1, regional: 2, state: 3 }[a.lvl]; const x = endedAt.get(k) || { L: 0, r: 0 }; x.L = Math.max(x.L, L); x.r = Math.max(x.r, a.rating); endedAt.set(k, x); });
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
const FEAT = []; // parallel to ss: observable features for the coverage estimator
const SHOW = ['Nazareth', 'Easton', 'Northampton', 'Bethlehem Catholic', 'Bethlehem Liberty', 'Parkland', 'Notre Dame-Green Pond'];
const lineups = {};
bySS.forEach((rows, k) => {
  const [sch, ys, c] = k.split('|'); const year = +ys;
  const dc = new Map(); rows.forEach((a) => { if (a.d) dc.set(a.d, (dc.get(a.d) || 0) + (a.lvl === 'district' || a.lvl === 'section' ? 3 : 1)); });
  const d = dc.size ? Array.from(dc).sort((a, b) => b[1] - a[1])[0][0] : 0;
  let reg = regionOf(year, c, d) || (rows.find((a) => a.lvl === 'regional' && a.unit) || {}).unit || ''; if (reg === 'W') reg = 'SW'; if (!['NE', 'NW', 'SC', 'SE', 'SW', 'CNW'].includes(reg)) reg = '';
  const covered = cov.has(year + '|' + c + '|' + d);
  /* lineup: best rated wrestler per weight */
  const best = new Map();
  const per = new Map(); // wrestler → {std, rating, D,R,S}
  rows.forEach((a) => { const p = per.get(a.k) || { name: a.name, std: a.std, rating: 0, fwd: 0, X: -1, D: -1, R: -1, S: -1 }; p.rating = Math.max(p.rating, a.rating); if (a.lvl !== 'district' && a.lvl !== 'section') p.fwd = 1; const L = { section: 'X', district: 'D', regional: 'R', state: 'S' }[a.lvl]; const pl = a.place || 0; if (p[L] < 0 || (pl && (!p[L] || pl < p[L]))) p[L] = pl; if (a.lvl === 'state') p.std = a.std; per.set(a.k, p); });
  per.forEach((p) => { const b = best.get(p.std); if (!b || p.rating > b.rating) best.set(p.std, p); });
  /* team rating counts only wrestlers who advanced past districts (regional or state entrants): the regional fields
     are on file for every district, while some district brackets are not, so this stays fair across districts */
  const fwdBest = new Map(); per.forEach((p) => { if (!p.rating) return; const b = fwdBest.get(p.std); if (!b || p.rating > b.rating) fwdBest.set(p.std, p); });
  const weights = nW.get(year + '|' + c) || new Set(Array.from(best.keys()));
  /* observable whether or not the district bracket is on file: the school's best wrestler at each weight who
     reached regionals or states */
  const obsBest = new Map(); per.forEach((p) => { if (!p.rating || !p.fwd) return; const b = obsBest.get(p.std); if (!b || p.rating > b.rating) obsBest.set(p.std, p); });
  let sum = 0, n = 0, nObs = 0, sumObs = 0; const unobsY = [];
  weights.forEach((i) => { n++; const o = obsBest.get(i); if (o) { nObs++; sumObs += o.rating; } const b = fwdBest.get(i); sum += b ? b.rating : FILL; if (!o) unobsY.push(b ? b.rating : FILL); });
  const rated = fwdBest.size > 0 || Array.from(best.values()).some((b) => b.rating);
  const full = rated && n ? sum / n : 0;
  FEAT.push({ year, c, d, covered, n, k: nObs, sumObs, meanObs: nObs ? sumObs / nObs : 0, unobsY, full, rated });
  const teamRating = 0; // filled in after the estimator is fitted
  const topW = Array.from(per.values()).filter((p) => p.rating).sort((a, b) => b.rating - a.rating)[0];
  const lv = (L) => rows.filter((a) => a.lvl === L);
  const pts = (L) => lv(L).reduce((t, a) => t + (a.place ? PTS[a.place - 1] : 0), 0);
  const st = lv('state');
  ss.push([S(sch), year, c, d, reg, teamRating, pts('state'), pts('regional'), pts('district'),
    st.filter((a) => a.place === 1).length, st.filter((a) => a.place >= 2 && a.place <= 4).length, st.filter((a) => a.place >= 5).length, st.filter((a) => !a.place).length,
    lv('regional').filter((a) => a.place === 1).length, lv('district').filter((a) => a.place === 1).length, TEAMWIN.has(year + '|' + c + '|' + sch) ? 1 : 0, covered ? 1 : 0,
    topW ? N(topW.name) : -1, topW ? topW.rating : 0, 0]);
  if (SHOW.includes(sch)) { (lineups[sch] = lineups[sch] || {})[year] = Array.from(best.entries()).sort((a, b) => a[0] - b[0]).map(([i, p]) => [i, p.name, p.rating, p.D, p.R, p.S]); }
});
console.log('school-seasons', ss.length, 'schools', schools.length);

/* ---- coverage estimator ----
   Where a district bracket is not on file we only see the school's wrestlers who reached regionals or states. Fit, on
   seasons where the bracket IS on file, what the best district-only wrestler at an unobserved weight rates (FILL when
   the school had nobody there), from the school's observed strength, how many weights it got through, class and era;
   then rating = (observed sum + unobserved weights × predicted value) / weights. */
const eraOf = (y) => (y < 1990 ? 0 : y < 2005 ? 1 : 2);
/* how selective the district is: regional entrants per school that season (the WPIAL sends few per school, so getting
   a wrestler through says more there than in a small district) */
const advN = new Map(), schN = new Map();
APP.filter((a) => a.lvl === 'regional' && a.d).forEach((a) => { const k = a.year + '|' + clsOf(a) + '|' + a.d; const s2 = advN.get(k) || new Set(); s2.add(a.k); advN.set(k, s2); });
FEAT.forEach((f) => { const k = f.year + '|' + f.c + '|' + f.d; schN.set(k, (schN.get(k) || 0) + 1); });
FEAT.forEach((f) => { const k = f.year + '|' + f.c + '|' + f.d; f.adv = ((advN.get(k) || new Set()).size) / (schN.get(k) || 1); });
const xrow = (f) => [1, f.k ? f.meanObs - 1500 : 0, f.k ? 0 : 1, f.k / f.n, eraOf(f.year) === 1 ? 1 : 0, eraOf(f.year) === 2 ? 1 : 0, f.c === 'AA' ? 1 : 0];
function ols(X, y) { const p = X[0].length; const A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  X.forEach((r, i) => { for (let a = 0; a < p; a++) { b[a] += r[a] * y[i]; for (let c2 = 0; c2 < p; c2++) A[a][c2] += r[a] * r[c2]; } });
  for (let a = 0; a < p; a++) A[a][a] += 1e-6; // tiny ridge for safety
  for (let col = 0; col < p; col++) { let piv = col; for (let r = col + 1; r < p; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r; [A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = 0; r < p; r++) if (r !== col) { const f = A[r][col] / A[col][col]; for (let c2 = col; c2 < p; c2++) A[r][c2] -= f * A[col][c2]; b[r] -= f * b[col]; } }
  return b.map((v, i) => v / A[i][i]); }
const trainOn = (keep) => { const X = [], y = []; FEAT.forEach((f) => { if (!f.covered || !f.rated || f.year < 1974 || !(f.c === 'AAA' || f.c === 'AA') || !keep(f)) return; f.unobsY.forEach((v) => { X.push(xrow(f)); y.push(v); }); }); return ols(X, y); };
const estimate = (f, beta) => { if (!f.rated || !f.n) return 0; const x = xrow(f); const yhat = x.reduce((t, v, i) => t + v * beta[i], 0); return (f.sumObs + (f.n - f.k) * yhat) / f.n; };
// hold-out check: fit without Districts 1 and 11, estimate their covered seasons as if the bracket were missing
const betaHO = trainOn((f) => f.d !== 1 && f.d !== 11);
const ho = FEAT.filter((f) => f.covered && f.rated && f.year >= 1974 && (f.d === 1 || f.d === 11) && f.n);
const errs = ho.map((f) => Math.abs(estimate(f, betaHO) - f.full)), bias = ho.map((f) => estimate(f, betaHO) - f.full);
const oldErr = ho.map((f) => Math.abs((f.sumObs + (f.n - f.k) * DIST_ONLY) / f.n - f.full));
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
console.log(`hold-out D1+D11 school-seasons n=${ho.length}: estimator MAE ${mean(errs).toFixed(1)} bias ${mean(bias).toFixed(1)}; old constant fill MAE ${mean(oldErr).toFixed(1)}`);
// second check on the district this exists for: the few WPIAL (D7) AAA seasons whose full bracket IS on file
const betaNo7 = trainOn((f) => f.d !== 7);
const d7 = FEAT.filter((f) => f.covered && f.rated && f.year >= 1974 && f.d === 7 && f.c === 'AAA' && f.n);
const e7 = d7.map((f) => estimate(f, betaNo7) - f.full);
console.log(`D7 AAA covered school-seasons n=${d7.length} (years ${Array.from(new Set(d7.map((f) => f.year))).join(',')}): estimator bias ${mean(e7).toFixed(1)} MAE ${mean(e7.map(Math.abs)).toFixed(1)}`);
const BETA = trainOn(() => true);
console.log('estimator coefficients', BETA.map((v) => v.toFixed(3)).join(' '));
let nEst = 0;
ss.forEach((r, i) => { const f = FEAT[i]; if (!f.rated || !f.n) { r[5] = 0; return; } if (f.covered) r[5] = Math.round(f.full); else { r[5] = Math.round(estimate(f, BETA)); r[19] = 1; nEst++; } });
console.log('estimated school-seasons', nEst, 'of', ss.filter((r) => r[5]).length);
fs.writeFileSync(path.join(__dirname, '..', 'data', 'difficulty', 'coverage_estimator.txt'), [
  'School season rating where the district bracket is not on file',
  `features: [1, meanObserved-1500, noObserved, observedShare, era1990-2004, era2005+, classAA]`,
  `coefficients: ${BETA.map((v) => v.toFixed(3)).join(' ')}`,
  `hold-out (fit without D1/D11, estimate their covered seasons): n=${ho.length} MAE ${mean(errs).toFixed(1)} bias ${mean(bias).toFixed(1)}; old constant-fill MAE ${mean(oldErr).toFixed(1)}`,
  `estimated school-seasons: ${nEst}`].join('\n') + '\n');

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
const dCov = (u, y, c) => cov.has(y + '|' + c + '|' + u);
const rRate = unitSeason((a, c) => regionOf(a.year, c, a.d) || '');
const rollup = (keyOf, rate) => {
  const m = new Map();
  ss.forEach((r) => { const u = keyOf(r); if (!u) return; const k = u + '|' + r[1] + '|' + r[2]; const x = m.get(k) || [u, r[1], r[2], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 6; i <= 15; i++) x[i - 2] += r[i]; x[14] = (x[14] || 0) + 1; m.set(k, x); });
  ss.forEach((r) => { const u = keyOf(r); if (!u) return; const x = m.get(u + '|' + r[1] + '|' + r[2]); if (x) { x[15] = (x[15] || 0) + (r[19] ? 1 : 0); } });
  return Array.from(m.values()).map((x) => { const q = rate.get(x[0] + '|' + x[1] + '|' + x[2]); x[3] = q ? Math.round(q.sum / q.n) : 0; x[16] = (x[15] || 0) / (x[14] || 1) >= 0.5 ? 1 : 0; return x; });
};
/* [unit, year, cls, rating, statePts, regPts, distPts, stateTitles, podium2to4, placers5to8, qualsNoPlace, regTitles, distTitles, teamTitles, schools] */
const ds = rollup((r) => r[3], dRate), rs = rollup((r) => r[4], rRate);
console.log('district-seasons', ds.length, 'region-seasons', rs.length);

/* ---- output ----
   ss  [schoolIdx, year, cls, district, region, teamRating, statePts, regPts, distPts, stateTitles, podium2to4,
        placers5to8, stateQualsNoPlace, regTitles, distTitles, teamTitle, coverage, bestNameIdx, bestRating]
   ds / rs  [unit, year, cls, rating]  (sums come from ss, grouped by the season's own district / region) */
const typ = {}; ['district', 'regional', 'state'].forEach((L) => { const v = APP.filter((a) => a.lvl === L && a.field && a.year >= 1980).map((a) => a.field); typ[L] = Math.round(v.reduce((x, y) => x + y, 0) / v.length); });
const stateFields = APP.filter((a) => a.lvl === 'state' && a.field).map((a) => a.field);
const fset = new Map(); APP.filter((a) => a.lvl === 'state' && a.field).forEach((a) => fset.set(a.year + '|' + a.cls + '|' + a.w, a.field));
const fsorted = Array.from(fset.values()).sort((a, b) => a - b);
const pct = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((q) => fsorted[Math.min(fsorted.length - 1, Math.floor(q / 100 * (fsorted.length - 1)))]);
const out = { typField: typ, fieldPct: fsorted.filter((_, i) => i % 5 === 0), schools, names, ss, ds: ds.map((x) => x.slice(0, 4).concat([x[16] || 0])), rs: rs.map((x) => x.slice(0, 4).concat([x[16] || 0])) };
fs.writeFileSync(path.join(OV, 'units.js'), 'window.WR_UNITS=' + JSON.stringify(out) + ';\n');
console.log('units.js bytes', fs.statSync(path.join(OV, 'units.js')).size, 'state brackets', fsorted.length, 'deciles', pct.join(' '));
