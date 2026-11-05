/* Overtime — model. One object: an appearance (one wrestler, one season, one weight, one level).
   Levels are filters over appearances; dominance is computed per level and never mixed. */
'use strict';
const OT = (window.OT = {});
(() => {
  const RAW = window.WR_DATA, SB = window.SchoolBadge;
  const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
  /* careers (tools/build_people.js): one name at one school can be several people (father and son, or unrelated
     wrestlers decades apart). WR_CAREERS lists, per name+school, the start season of every career after the first;
     a row belongs to the latest career that started on or before its season. */
  const CAR = window.WR_CAREERS || {};
  const cStart = (base, y) => { const st = CAR[base]; let s0 = 0; if (st) for (const x of st) if (y >= x) s0 = x; return s0; };
  const fmt = d3.format(',');
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
  const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
  const wShort = (w) => (w === 'UNL' ? 'Unl' : w === 'HWT' ? 'Hwt' : String(w));
  const DISTRICTS = { 1: 'Southeast', 2: 'Scranton–Wilkes-Barre', 3: 'South Central', 4: 'North Central', 5: 'Bedford–Somerset', 6: 'Central', 7: 'WPIAL', 8: 'Pittsburgh City', 9: 'Northwest Central', 10: 'Northwest', 11: 'Lehigh Valley', 12: 'Philadelphia' };
  const REGIONS = { NE: 'Northeast', SE: 'Southeast', SW: 'Southwest', NW: 'Northwest', SC: 'South Central', W: 'West', E: 'East', CNW: 'Central Northwest' };
  const REGION_ORDER = ['NE', 'SE', 'SC', 'NW', 'SW', 'CNW', 'E', 'W'];

  /* scope */
  const EMPTY_F = () => ({ weights: [], regions: [], districts: [], schools: [] });
  const state = { cls: 'AAA', win: { mode: 'all', from: null, to: null }, f: EMPTY_F() };
  try { const mm = localStorage.getItem('ot-mapmode'); if (mm === 'districts' || mm === 'regions') state.mapmode = mm; } catch (e) { /* none */ }
  try { const s = localStorage.getItem('ot-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* none */ }
  try { const w = JSON.parse(localStorage.getItem('ot-window') || 'null'); if (w && ['all', '5', '10', '25', 'custom'].includes(w.mode)) state.win = w; } catch (e) { /* none */ }
  try { const f = JSON.parse(localStorage.getItem('ot-filters') || 'null'); if (f && Array.isArray(f.weights)) state.f = { ...EMPTY_F(), weights: f.weights }; } catch (e) { /* none */ }  // only weights remain a filter
  const MEMO = new Map(); const memo = (k, f) => { if (!MEMO.has(k)) MEMO.set(k, f()); return MEMO.get(k); };
  const clearCaches = () => { MEMO.clear(); STATS.clear(); RANKS.clear(); SEASONS.clear(); WIN.clear(); SREG.clear(); DREG.clear(); };
  const save = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* none */ } };
  const setCls = (c) => { state.cls = c; save('ot-scope', c); clearCaches(); };
  const setWin = (w) => { state.win = { ...state.win, ...w }; save('ot-window', state.win); clearCaches(); };
  /* multi-select filters: weights (STD keys), regions, districts, schools. Toggle a value in or out. */
  const toggleFilter = (kind, v) => { const L = state.f[kind]; const i = L.indexOf(v); if (i < 0) L.push(v); else L.splice(i, 1); save('ot-filters', state.f); clearCaches(); };
  const clearFilters = (kind) => { if (kind) state.f[kind] = []; else state.f = EMPTY_F(); save('ot-filters', state.f); clearCaches(); };
  const clearAll = () => { state.cls = 'AAA'; state.win = { mode: 'all', from: null, to: null }; state.f = EMPTY_F(); save('ot-scope', 'AAA'); save('ot-window', state.win); save('ot-filters', state.f); save('ot-adjust', '0'); clearCaches(); };
  /* level switch: which tournament level the podium, bracket, rankings and seasons count (all-time teams pool every level) */
  try { const v = localStorage.getItem('ot-level'); state.lvlPref = ['state', 'regional', 'district'].includes(v) ? v : 'state'; } catch (e) { state.lvlPref = 'state'; }
  state.lvl = state.lvlPref;
  /* which tournament levels a page may count (Brock): district medals can't be compared statewide (a lone AAA school in
     a small district wins nearly everything there), so the State page counts state results only and a Region page
     state and regional; District and School pages may switch to any level. */
  const lvlsFor = (kind) => (kind === 'state' ? ['state'] : kind === 'region' ? ['state', 'regional'] : ['state', 'regional', 'district']);
  const pageLvl = (kind) => { state.lvl = lvlsFor(kind).includes(state.lvlPref) ? state.lvlPref : 'state'; return state.lvl; };
  const setLvl = (l) => { state.lvlPref = l; state.lvl = l; save('ot-level', l); };
  const nFilters = () => state.f.weights.length + state.f.regions.length + state.f.districts.length + state.f.schools.length;
  const wkey = () => state.cls + '|' + state.win.mode + (state.win.mode === 'custom' ? state.win.from + '-' + state.win.to : '') + '|' + JSON.stringify(state.f) + (state.sub ? '|sub' + state.sub[0] + '-' + state.sub[1] : '');
  const clsName = (c = state.cls) => (c === 'ALL' ? 'All classes' : 'Class ' + c);

  /* appearances */
  const PTS = [16, 12, 9, 7, 5, 3, 2, 1], ptsOf = (p) => PTS[p - 1] || 0;
  const SEEDS = window.WR_SEEDS || {}, GRADES = window.WR_GRADES || {};
  const CH = RAW.champs.concat(window.WR_CHAMP_FILL || []).map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), place: 1, name, school, sch: canon(school), d }));
  const LINEUP = new Map(); d3.group(CH, (r) => r.year + '|' + r.cls).forEach((rs, k) => LINEUP.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => ({ w: r.w, wn: r.wn }))));
  const APP = (window.WR_MEDALS || []).map(([year, cls, w, place, name, school, d]) => ({ year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d }));
  { const have = new Set(APP.filter((r) => r.place === 1).map((r) => r.year + '|' + r.cls + '|' + r.wn)); CH.forEach((r) => { if (!have.has(r.year + '|' + r.cls + '|' + r.wn)) APP.push({ ...r }); }); }
  (window.WR_QUAL || []).forEach(([year, cls, w, name, school, d, grade]) => APP.push({ year, cls, w, wn: wNum(w), place: 0, name, school, sch: canon(school), d, grade }));
  /* where each state entrant actually wrestled districts that season (tools/build_membership.js): fixes schools that
     changed districts, wrong static lookups, and two schools folded into one name (Hempfield / Hempfield Area) */
  const MEMB = (window.WR_MEMB || { r: {} }).r;
  /* two schools sharing one printed name, told apart by the district they wrestled in */
  const SPLIT = { Trinity: { 7: 'Trinity (Washington)' }, 'Hempfield Area': { 3: 'Hempfield' }, Hempfield: { 7: 'Hempfield Area' }, 'Bethlehem Liberty': { 4: 'Liberty' }, 'Pius X (Roseto)': { 1: 'St. Pius X' } };
  const splitName = (sch, d) => (SPLIT[sch] && SPLIT[sch][d]) || sch;
  APP.forEach((r) => {
    const mb = MEMB[`${r.year}|${r.cls}|${r.wn}|${nkey(r.name)}`]; if (mb) { r.d = mb[0]; if (mb[1]) { r.school = mb[1]; r.sch = canon(mb[1]); } }
    { const s2 = splitName(r.sch, r.d); if (s2 !== r.sch) { r.school = s2; r.sch = s2; } }
    r.lvl = 'state'; r.pts = ptsOf(r.place);
    r.grade = r.grade || GRADES[r.year + '|' + r.cls + '|' + nkey(r.name)] || '';
    const sd = SEEDS[r.year + '|' + r.cls + '|' + nkey(r.name)];
    // the state seed is the regional place (1951 on) or the district place (before 1951)
    if (sd) { if (r.year >= 1951) { r.reg = sd[0]; r.region = sd[1]; } else { r.dist = sd[0]; } }
    const L = LINEUP.get(r.year + '|' + r.cls) || []; let i = L.findIndex((o) => o.wn === r.wn); if (i < 0) i = L.findIndex((o) => o.wn >= r.wn); if (i < 0) i = L.length - 1; r.slot = Math.max(0, i);
  });
  const SUCCESSOR = { Canonsburg: 'Canon-McMillan', 'Forty Fort': 'Wyoming Valley West', Kingston: 'Wyoming Valley West', Plymouth: 'Wyoming Valley West', Philipsburg: 'Philipsburg-Osceola', 'Chartiers Township': 'Chartiers-Houston', Boswell: 'North Star', Carnegie: 'Carlynton', 'Manheim Borough': 'Manheim Central', Greensburg: 'Greensburg Salem', Latrobe: 'Greater Latrobe', Lansdowne: 'Penn Wood' };
  const LIN = new Map(); d3.groups(APP.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { const c = d3.rollups(rs, (v) => v.length, (r) => r.cls).sort((a, b) => b[1] - a[1]); LIN.set(s, c[0][0]); });
  const lineage = (s) => LIN.get(s) || LIN.get(SUCCESSOR[s]) || 'AAA';
  /* A school is counted with the class it is in now (the class of its most recent season) and appears only in that
     class's lists. Its seasons in the other class still count for it, discounted by OFF_CLASS in Score, Era and Power
     (medal counts stay whole). Pre-1974 one-class rows follow lineage (the class the school later wrestled most). */
  const OFF_CLASS = 0.85; // results from the other class, viewed in the AAA ranking
  const OFF_DOWN = 0.85;  // results from the other class, viewed in the AA ranking (same for now; tune separately if wanted)
  const HOME = new Map(); d3.groups(APP.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { HOME.set(s, rs.reduce((a, b) => (b.year > a.year ? b : a)).cls); });
  const homeOf = (s) => HOME.get(s) || HOME.get(SUCCESSOR[s]) || lineage(s);
  APP.forEach((r) => { r.k = r.cls === 'single' ? lineage(r.sch) : homeOf(r.sch); r.off = r.cls !== 'single' && r.cls !== r.k; });
  /* Two scopes. Totals for the state, a region or a district (hero numbers, podium, bracket shares, seasons) count results
     by the ACTUAL class of the tournament. A school's own record (its page, its row in a rankings list) follows the
     school's current class and carries its other-class seasons at OFF_CLASS. */
  const actScope = (r) => state.cls === 'ALL' || (r.cls === 'single' ? r.k === state.cls : r.cls === state.cls);
  const homeScope = (r) => state.cls === 'ALL' || r.k === state.cls;
  const isOff = (r) => state.cls !== 'ALL' && r.cls !== 'single' && r.cls !== state.cls;
  const wt = (r) => (isOff(r) ? (state.cls === 'AAA' ? OFF_CLASS : OFF_DOWN) : 1);
  const apts = (r) => r.pts;   // v2: no strength-of-schedule adjustment (docs/DIFFICULTY.md: it added nothing beyond the rating)
  const wpts = (r) => apts(r) * wt(r);
  /* time window: all-time, last N seasons in scope, or a custom range */
  const WIN = new Map();
  function yearsWindow() {
    const k = wkey(); if (WIN.has(k)) return WIN.get(k);
    const ys = Array.from(new Set(APP.filter(actScope).map((r) => r.year))).sort((a, b) => a - b);
    let out = [ys[0], ys[ys.length - 1]];
    if (state.win.mode === 'custom') out = [Math.max(ys[0], +state.win.from || ys[0]), Math.min(ys[ys.length - 1], +state.win.to || ys[ys.length - 1])];
    else if (state.win.mode !== 'all') out = [ys[Math.max(0, ys.length - +state.win.mode)], ys[ys.length - 1]];
    if (out[0] > out[1]) out = [out[1], out[1]];
    /* a map selection narrows the header window (never widens it) while a map card is drawn */
    if (state.sub) { const a = Math.max(out[0], state.sub[0]), b = Math.min(out[1], state.sub[1]); if (a <= b) out = [a, b]; }
    WIN.set(k, out); return out;
  }
  /* run fn with the window narrowed to [a, b] */
  function withSub(range, fn) { const prev = state.sub; state.sub = range; try { return fn(); } finally { state.sub = prev; }
  }
  const inWindow = (y) => { const [a, b] = yearsWindow(); return y >= a && y <= b; };
  const windowLabel = () => { const [a, b] = yearsWindow(); return a === b ? String(a) : a + '–' + b; };
  const passFilters = (r) => { const f = state.f;
    return (!f.weights.length || f.weights.includes(stdOf(r).k)) && (!f.districts.length || f.districts.includes(r.d)) && (!f.schools.length || f.schools.includes(r.sch)) && (!f.regions.length || f.regions.includes(regionOf(r))); };
  const inScopeNoWin = (r) => actScope(r) && passFilters(r);
  const schoolScope = (r) => homeScope(r) && passFilters(r) && inWindow(r.year);
  const inScope = (r) => inScopeNoWin(r) && inWindow(r.year);
  /* whole careers: a wrestler is eligible if any appearance is in the window; then every appearance of his (in class and filters) counts */
  const careerRows = (rows) => { const keys = new Set(rows.map(wKey)); return APP.filter((r) => keys.has(wKey(r)) && inScopeNoWin(r)); };
  const actualIn = (r, scope, one) => scope === 'ALL' || (one ? r.k === scope : r.cls === scope);
  const ROWS = () => APP.filter(inScope);
  const YEARS = Array.from(new Set(APP.map((r) => r.year))).sort((a, b) => a - b);
  const BY_YEAR = d3.group(APP, (r) => r.year);
  const TEAMSCORES = new Map(); (window.WR_TEAMS || []).forEach(([year, cls, place, pts, sch]) => { const k = year + '|' + cls; (TEAMSCORES.get(k) || TEAMSCORES.set(k, []).get(k)).push({ place, pts, sch: canon(sch) }); });
  const STD = [{ k: '98', label: '≤98', min: 0, max: 101 }, { k: '107', label: '107', min: 102, max: 110 }, { k: '114', label: '114', min: 111, max: 117 }, { k: '121', label: '121', min: 118, max: 124 }, { k: '127', label: '127', min: 125, max: 129 }, { k: '133', label: '133', min: 130, max: 136 }, { k: '139', label: '139', min: 137, max: 142 }, { k: '145', label: '145', min: 143, max: 148 }, { k: '152', label: '152', min: 149, max: 156 }, { k: '160', label: '160', min: 157, max: 166 }, { k: '172', label: '172', min: 167, max: 180 }, { k: '189', label: '189', min: 181, max: 200 }, { k: '215', label: '215', min: 201, max: 240 }, { k: 'HWT', label: 'Hwt', min: 241, max: 9999 }];
  const stdOf = (r) => STD.find((c) => r.wn >= c.min && r.wn <= c.max) || STD[STD.length - 1];
  const placeCounts = (rows) => { const c = [0, 0, 0, 0, 0, 0, 0, 0]; rows.forEach((r) => { if (r.place >= 1 && r.place <= 8) c[r.place - 1]++; }); return c; };

  /* ---- the bracket archive: district and regional medalists (full fields load lazily for the bracket view) ---- */
  const LM = window.WR_LOWER_META || { strs: [], cov: [], dreg: [], adv: {} };
  const LS = LM.strs, LCLS = ['AAA', 'AA', 'single'], LGR = ['', 'FR', 'SO', 'JR', 'SR'];
  const COV = new Set(LM.cov);
  const DREG_T = new Map(); LM.dreg.forEach(([cls, year, d, reg]) => DREG_T.set(cls + '|' + year + '|' + d, reg));
  const dregOf = (cls, year, d) => DREG_T.get(cls + '|' + year + '|' + d) || null;
  const unitLabel = (lvl, unit) => { if (lvl === 'section') { const m = /^D(\d+)_(.+)$/.exec(unit || ''); if (!m) return String(unit); const s = m[2], nm = /^S\d+$/.test(s) ? 'Section ' + s.slice(1) : s === 'CAT' ? 'Catholic section' : s === 'PUB' ? 'Public section' : 'Section ' + s.replace(/^S/, ''); return `District ${m[1]} ${nm}`; } if (lvl === 'regional') return (REGIONS[unit] || unit) + ' Regional'; const m = /^D(\d+)(?:[_-](.+))?$/.exec(unit || ''); if (!m) return String(unit); return (m[2] && /^\d/.test(m[2]) ? `Districts ${m[1]}-${m[2]}` : `District ${m[1]}`) + (m[2] && !/^\d/.test(m[2]) ? ' ' + m[2] : ''); };
  const unitDist = (lvl, unit, d) => { if (lvl !== 'district' && lvl !== 'section') return d; const m = /^D(\d+)(?:_|$)/.exec(unit || ''); return m ? +m[1] : d; };
  const decodeLower = (lvl, rows) => rows.map(([, year, c, ui, wi, place, ni, si, g, sdi, d0]) => { const cls = LCLS[c], unit = LS[ui], w = LS[wi], d = unitDist(lvl, unit, d0), sch = splitName(LS[si], d); return { lvl, year, cls, unit, w, wn: wNum(w), place, name: LS[ni], school: sch, sch, d: d || null, region: lvl === 'regional' ? unit : dregOf(cls, year, d), grade: LGR[g] || '', seed: LS[sdi] || '', pts: ptsOf(place) }; });
  const LOWER = decodeLower('district', window.WR_LOWER_D || []).concat(decodeLower('regional', window.WR_LOWER_R || []));
  /* section placers, where the section is the district round (its district held no district tournament that season):
     kept apart from LOWER so district counts, points and pages are unchanged; the career grid's District row uses them */
  const LSEC = decodeLower('section', window.WR_LOWER_X || []);
  const lowerRows = (lvl) => LOWER.filter((r) => r.lvl === lvl);
  const LTEAMS = (window.WR_LOWER_TEAMS || []).map(([l, year, c, ui, place, pts, si]) => ({ lvl: l ? 'regional' : 'district', year, cls: LCLS[c], unit: LS[ui], place, pts, sch: LS[si] }));
  { const LH = new Map(); LOWER.forEach((r) => { if (r.cls === 'single') return; const p = LH.get(r.sch); if (!p || r.year > p.year) LH.set(r.sch, r); });
    const LL = new Map(); d3.groups(LOWER.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { LL.set(s, d3.rollups(rs, (v) => v.length, (r) => r.cls).sort((a, b) => b[1] - a[1])[0][0]); });
    LOWER.forEach((r) => { const home = HOME.get(r.sch) || HOME.get(SUCCESSOR[r.sch]) || (LH.get(r.sch) || {}).cls || LL.get(r.sch) || 'AAA'; r.k = r.cls === 'single' ? (LIN.get(r.sch) || LL.get(r.sch) || home) : home; r.off = r.cls !== 'single' && r.cls !== r.k; }); }
  const LKH = new Map(); LOWER.forEach((r) => { if (!LKH.has(r.sch)) LKH.set(r.sch, r.k); });
  const lowerHome = (s) => HOME.get(s) || HOME.get(SUCCESSOR[s]) || LKH.get(s) || 'AAA';
  const lowerSrc = (lvl, year, cls, unit) => (LM.src || {})[`${lvl}|${year}|${cls}|${lvl === 'district' ? 'D' + unit : unit}`] || null;
  const sectionCovered = (year, cls, d) => (LM.scov || []).some((k) => k.startsWith(`section|${year}|${cls}|D${d}_`));
  const lowerCovered = (lvl, year, cls, unit) => { if (lvl === 'regional') return COV.has(`regional|${year}|${cls}|${unit}`); const p = `district|${year}|${cls}|D${unit}`; return COV.has(p) || COV.has(p + '_North') || COV.has(p + '_South') || COV.has(p + '_Central') || COV.has(p + '_East') || COV.has(p + '_West') || Array.from(COV).some((k) => k.startsWith(p + '-') || (k.startsWith(`district|${year}|${cls}|D`) && k.split('|')[3].split('-').length > 1 && k.split('|')[3].replace('D', '').split('-').includes(String(unit)))); };
  const advOf = (lvl, year, cls, unit, w) => { const a = LM.adv[`${lvl}|${year}|${cls}|${unit}`]; if (!a) return null; return (a[1] && a[1][w]) || a[0] || null; };

  /* regions. In AAA or AA the five PIAA regions of that class are the only regions; rows from before 1974, from the 2021
     super-regionals, or from any other historical region are placed through their district (majority mapping for that
     class). With all classes selected the historical regions stand as they were. */
  const FIVE = ['NE', 'SE', 'SC', 'NW', 'SW'];
  const DEFAULT_REG = { 1: 'SE', 2: 'NE', 3: 'SC', 4: 'NE', 5: 'SW', 6: 'SC', 7: 'SW', 8: 'SW', 9: 'NW', 10: 'NW', 11: 'NE', 12: 'SE' };
  const DIST_MOD = { AAA: new Map(), AA: new Map() };
  ['AAA', 'AA'].forEach((c) => d3.groups(APP.filter((r) => r.cls === c && FIVE.includes(r.region)), (r) => r.d).forEach(([d, rs]) => DIST_MOD[c].set(d, d3.rollups(rs, (v) => v.length, (r) => r.region).sort((a, b) => b[1] - a[1])[0][0])));
  const modernRegion = (d, c) => DIST_MOD[c].get(d) || DIST_MOD[c === 'AAA' ? 'AA' : 'AAA'].get(d) || DEFAULT_REG[d] || null;
  /* district → region by season and class, from the state seeds of that district's entrants (corrected districts) plus
     the regional brackets (lowermeta). A wrestler's own seed is trusted only when at least a fifth of his district's
     entrants that season carry the same region (a real split, e.g. District 6 AA feeding two regionals); a lone seed
     that disagrees with the rest of his district is a parsing slip and the district's region is used instead. */
  /* the official feeds (WR_MEMB.dr, from the archive's district pages) are the base: a seed or regional bracket that
     puts a district in a regional it never fed is ignored, so seeds only choose between a split district's regionals */
  const OFFREG = (window.WR_MEMB || {}).dr || {};
  const offOk = (cls, d, reg) => !reg || !FIVE.concat(['CNW']).includes(reg) || !OFFREG[cls + '|' + d] || OFFREG[cls + '|' + d].includes(reg);
  const DYR = new Map();
  const dyAdd = (k, reg, n) => { const [c, , d] = k.split('|'); if (!offOk(c, d, reg)) return; const m = DYR.get(k) || DYR.set(k, new Map()).get(k); m.set(reg, (m.get(reg) || 0) + n); };
  APP.forEach((r) => { if (r.year >= 1951 && r.region && r.d) dyAdd(r.cls + '|' + r.year + '|' + r.d, r.region, 1); });
  LM.dreg.forEach(([cls, year, d, reg, n]) => dyAdd(cls + '|' + year + '|' + d, reg, n || 1));
  const dyMajor = (cls, year, d, five) => { const m = DYR.get(cls + '|' + year + '|' + d); if (!m) return null; let best = null, bn = 0; m.forEach((n, reg) => { if ((!five || FIVE.includes(reg)) && n > bn) { bn = n; best = reg; } }); return best; };
  const dyShare = (cls, year, d, reg) => { const m = DYR.get(cls + '|' + year + '|' + d); if (!m) return 0; let t = 0; m.forEach((n) => { t += n; }); return t ? (m.get(reg) || 0) / t : 0; };
  const regionOf = (r, scope = state.cls) => {
    if (r.lvl === 'regional') { if (scope === 'ALL' || FIVE.includes(r.region)) return r.region || null; }
    const own = r.lvl === 'regional' ? r.region : (r.region && offOk(r.cls, r.d, r.region) && (r.lvl === 'district' || r.year < 1951 || !r.d || dyShare(r.cls, r.year, r.d, r.region) >= 0.2) ? r.region : null);
    if (scope === 'ALL') return own || dyMajor(r.cls, r.year, r.d, false) || null;
    // the region he actually wrestled in that season (one-class seasons included: D3 went to the Southeast regional
    // 1951–73), when it is one of the five
    if ((r.cls === scope || r.cls === 'single') && own && FIVE.includes(own)) return own;
    // a district-season whose entrants mostly went to a non-standard region (WPIAL "W" from 2025, the 2021 East/West
    // super-regionals, the old Central Northwest) is placed in its usual modern region rather than a minority one
    const kc = r.cls === 'single' ? 'single' : scope;
    const dm = dyMajor(kc, r.year, r.d, false); if (dm && FIVE.includes(dm)) return dm;
    if (!dm) { const dr = dregOf(kc, r.year, r.d); if (dr && FIVE.includes(dr) && offOk(kc, r.d, dr)) return dr; }
    const mr = modernRegion(r.d, scope); if (offOk(kc, r.d, mr)) return mr;
    return ((OFFREG[kc + '|' + r.d] || []).find((g) => FIVE.includes(g))) || mr; };
  const regionOrder = () => (state.cls === 'ALL' ? REGION_ORDER : FIVE);

  /* school → district, school → region (majority, per scope), district → regions (majority, per scope) */
  const SCHOOL_D = new Map(), SCHOOL_BY_SLUG = new Map();
  d3.groups(APP, (r) => r.sch).forEach(([s, rs]) => { SCHOOL_D.set(s, d3.rollups(rs, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0]); SCHOOL_BY_SLUG.set(slug(s), s); });
  const SREG = new Map(), DREG = new Map();
  const schoolRegion = (s) => { const k = state.cls + '|' + s; if (SREG.has(k)) return SREG.get(k); const rs = APP.filter((r) => r.sch === s && (state.cls === 'ALL' || r.k === state.cls)).map((r) => regionOf(r)).filter(Boolean); const v = rs.length ? d3.rollups(rs, (x) => x.length, (x) => x).sort((a, b) => b[1] - a[1])[0][0] : null; SREG.set(k, v); return v; };
  const distRegions = (d) => { const k = state.cls + '|' + d; if (DREG.has(k)) return DREG.get(k); const rs = APP.filter((r) => r.d === d && actScope(r) && (state.cls !== 'ALL' || r.year >= 1974)).map((r) => regionOf(r)).filter(Boolean); const tot = rs.length || 1; const v = d3.rollups(rs, (x) => x.length, (x) => x).sort((a, b) => b[1] - a[1]).filter((x) => x[1] >= 0.05 * tot).map((x) => x[0]); DREG.set(k, v); return v; };
  const schoolDistrict = (s) => SCHOOL_D.get(canon(s)) || null;
  /* membership as of each season: which districts fed a region, which regions a district fed, and which schools wrestled
     in a district only part of the window (state rows in the actual class plus the district/regional brackets) */
  const spanText = (ys) => { const a = Array.from(new Set(ys)).sort((x, y) => x - y), out = []; a.forEach((y) => { const L = out[out.length - 1]; if (L && y === L[1] + 1) L[1] = y; else out.push([y, y]); }); return out.map(([x, y]) => (x === y ? String(x) : x + '–' + y)).join(', '); };
  const memberRows = () => memo('mr|' + wkey(), () => ROWS().concat(LOWER.filter(lowerIn)));
  const regionMembers = (code) => memo('rm|' + wkey() + '|' + code, () => { const by = new Map(); memberRows().forEach((r) => { if (!r.d || regionOf(r) !== code) return; (by.get(r.d) || by.set(r.d, new Set()).get(r.d)).add(r.year); });
    return Array.from(by, ([d, ys]) => ({ d, years: Array.from(ys), span: spanText(Array.from(ys)), n: ys.size })).filter((m) => m.n >= 1).sort((a, b) => a.d - b.d); });
  const districtRegionSpans = (d) => memo('drs|' + wkey() + '|' + d, () => { const by = new Map(); memberRows().forEach((r) => { if (r.d !== d) return; const g = regionOf(r); if (!g) return; const k = r.year; const m = by.get(k) || by.set(k, new Map()).get(k); m.set(g, (m.get(g) || 0) + 1); });
    const byReg = new Map(); by.forEach((m, y) => { const g = Array.from(m).sort((a, b) => b[1] - a[1])[0][0]; (byReg.get(g) || byReg.set(g, []).get(g)).push(y); });
    return Array.from(byReg, ([g, ys]) => ({ g, years: ys, span: spanText(ys), n: ys.length })).sort((a, b) => b.n - a.n); });
  const districtMovers = (d) => memo('dm|' + wkey() + '|' + d, () => { const by = new Map(); memberRows().forEach((r) => { if (!r.d) return; const m = by.get(r.sch) || by.set(r.sch, new Map()).get(r.sch); (m.get(r.d) || m.set(r.d, new Set()).get(r.d)).add(r.year); });
    const out = []; by.forEach((m, sch) => { if (!m.has(d) || m.size < 2) return; const ys = Array.from(m.get(d)); const other = Array.from(m.keys()).filter((x) => x !== d); const all = new Set(); m.forEach((v) => v.forEach((y) => all.add(y))); out.push({ sch, span: spanText(ys), n: ys.length, total: all.size, other }); });
    return out.sort((a, b) => b.n - a.n); });
  const classHistory = (s) => { const ys = d3.rollups(APP.filter((r) => r.sch === s), (v) => v[0].cls, (r) => r.year).sort((a, b) => a[0] - b[0]); const out = []; ys.forEach(([y, c]) => { const L = out[out.length - 1]; if (L && L.cls === c) L.to = y; else out.push({ cls: c, from: y, to: y }); }); return out; };

  /* units */
  const U = {
    state: () => ({ kind: 'state', id: 'state', name: 'Pennsylvania', href: '#state' }),
    region: (code) => ({ kind: 'region', id: code, name: (REGIONS[code] || code) + ' Region', short: code, href: '#region/' + code }),
    district: (d) => ({ kind: 'district', id: +d, name: 'District ' + d, sub: DISTRICTS[d], href: '#district/' + d }),
    school: (name) => ({ kind: 'school', id: name, name, d: schoolDistrict(name), get region() { return schoolRegion(name); }, href: '#school/' + slug(name) }),
  };
  const inUnit = (u) => u.kind === 'state' ? () => true : u.kind === 'region' ? (r) => regionOf(r) === u.id : u.kind === 'district' ? (r) => r.d === u.id : (r) => r.sch === u.id;
  const unitRows = (u) => (u.kind === 'school' ? memo('sr|' + wkey() + '|' + u.id, () => APP.filter((r) => r.sch === u.id && schoolScope(r))) : ROWS().filter(inUnit(u)));
  const regionsInScope = () => regionOrder().filter((c) => ROWS().some((r) => regionOf(r) === c));

  /* seasons */
  const SEASONS = new Map();
  function seasonOf(year, scope = state.cls) {
    const key = year + '|' + scope; if (SEASONS.has(key)) return SEASONS.get(key);
    const yr = BY_YEAR.get(year) || [], one = yr.length && yr[0].cls === 'single';
    const rows = yr.filter((r) => actualIn(r, scope, one)), meds = rows.filter((r) => r.place);
    let S = null;
    if (meds.length) {
      const lc = one ? 'single' : scope === 'ALL' ? 'AAA' : scope, avail = d3.sum(scope === 'ALL' || one ? yr : rows, (r) => r.pts);
      const roll = (key) => Array.from(d3.rollup(rows.filter((r) => key(r) != null), (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v), n: v.filter((r) => r.place).length, q: v.filter((r) => !r.place).length, titles: v.filter((r) => r.place === 1).length, rows: v.slice().sort((a, b) => a.slot - b.slot || a.place - b.place) }), key)).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
      const teams = roll((r) => r.sch), dists = roll((r) => r.d), regs = roll((r) => regionOf(r, scope));
      [teams, dists, regs].forEach((L) => L.forEach((t, i) => { t.rank = i ? (t.pts === L[i - 1].pts ? L[i - 1].rank : i + 1) : 1; t.share = avail ? t.pts / avail : 0; }));
      S = { year, scope, one, cls: lc, avail, rows, meds, lineup: LINEUP.get(year + '|' + lc) || [], teams, dists, regs, by: { school: new Map(teams.map((t) => [t.id, t])), district: new Map(dists.map((t) => [t.id, t])), region: new Map(regs.map((t) => [t.id, t])) } };
      const real = scope !== 'ALL' && !one ? TEAMSCORES.get(year + '|' + scope) : null;
      if (real && real.length) { S.real = true; const by = new Map(real.map((t) => [t.sch, t])); teams.forEach((t) => { const x = by.get(t.id); t.score = x ? x.pts : 0; t.realRank = x ? x.place : null; }); teams.sort((a, b) => (b.score || 0) - (a.score || 0) || b.pts - a.pts); }
      S.champion = teams[0] || null;
    }
    SEASONS.set(key, S); return S;
  }
  const seasonsInScope = () => YEARS.filter(inWindow).map((y) => seasonOf(y)).filter(Boolean);
  const yearsInScope = () => { const s = seasonsInScope(); return s.length ? [s[0].year, s[s.length - 1].year] : yearsWindow(); };

  /* unit stats: Era, Power, Score, Trend */
  const HALF_LIFE = 7, STATS = new Map();
  function unitStats(u, p) {
    const key = wkey() + '|' + u.kind + '|' + u.id + (p ? '|' + p.kind + ':' + p.id : ''); if (STATS.has(key)) return STATS.get(key);
    const [first0, last] = yearsInScope(), seasons = []; const nSeasons = seasonsInScope().length;
    seasonsInScope().forEach((S) => { const t = u.kind === 'state' ? { pts: S.avail, share: 1, rank: 1, rows: S.rows, titles: S.lineup.length } : S.by[u.kind].get(u.id); if (t) seasons.push({ year: S.year, S, t, pts: t.pts, share: t.share, rank: t.rank }); });
    const apps = p ? unitRows(u).filter(inUnit(p)) : unitRows(u), rows = apps.filter((r) => r.place), places = placeCounts(rows);
    // per-season share of the scope's available points, with off-class rows discounted
    const sh = new Map();
    if (u.kind === 'state') seasons.forEach((s) => sh.set(s.year, 1));
    else d3.rollups(rows, (v) => d3.sum(v, wpts), (r) => r.year).forEach(([y, p]) => { const S = seasonOf(y); if (S && S.avail) sh.set(y, p / S.avail); });
    const shares = Array.from(sh, ([year, share]) => ({ year, share }));
    const offRows = state.cls === 'ALL' ? [] : rows.filter(isOff);
    const o = { u, seasons, apps, rows, places, medals: rows.length, titles: places[0], pts: Math.round(d3.sum(rows, wpts)), quals: apps.length,
      offMedals: offRows.length, offCls: offRows.length ? offRows[0].cls : null, offClass: OFF_CLASS,
      era: 100 * d3.sum(shares, (s) => s.share), power: 100 * d3.sum(shares, (s) => s.share * Math.pow(0.5, (last - s.year) / HALF_LIFE)),
      won: u.kind === 'school' ? seasons.filter((s) => (s.t.realRank ? s.t.realRank === 1 : s.rank === 1)).length : null,
      first: apps.length ? d3.min(apps, (r) => r.year) : null, last: apps.length ? d3.max(apps, (r) => r.year) : null,
      trend: nSeasons < 20 ? null : 100 * (d3.sum(shares.filter((s) => s.year > last - 10), (s) => s.share) - d3.sum(shares.filter((s) => s.year <= last - 10 && s.year > last - 20), (s) => s.share)),
      spark: d3.range(last - 19, last + 1).map((y) => sh.get(y) || 0),
      regTitles: apps.filter((r) => r.reg === 1).length, within: p || null };
    STATS.set(key, o); return o;
  }
  const RANKS = new Map();
  /* child rankings: units of `kind` inside parent unit `p` */
  function rankings(kind, p) {
    const key = wkey() + '|' + kind + '|' + (p ? p.kind + ':' + p.id : ''); if (RANKS.has(key)) return RANKS.get(key);
    const rows = p ? unitRows(p) : ROWS(); let units;
    if (kind === 'region') units = regionsInScope().filter((c) => rows.some((r) => regionOf(r) === c)).map(U.region);
    else if (kind === 'district') units = d3.range(1, 13).filter((d) => rows.some((r) => r.d === d)).map(U.district);
    else units = Array.from(new Set(rows.filter((r) => r.place).map((r) => r.sch))).filter((s) => state.cls === 'ALL' || homeOf(s) === state.cls).map(U.school);
    const out = units.map((x) => unitStats(x, p && p.kind !== 'state' ? p : null)).filter((o) => o.medals);
    out.slice().sort((a, b) => b.era - a.era).forEach((o, i) => { o.eraRank = i + 1; });
    out.slice().sort((a, b) => b.power - a.power).forEach((o, i) => { o.powerRank = i + 1; });
    out.sort((a, b) => b.era - a.era); RANKS.set(key, out); return out;
  }

  /* wrestlers */
  /* transfers (tools/build_people.js WR_TRANSFER): a later career at another school maps to his earlier career key, so
     both schools' rows form one wrestler; his page and links use the slug of his last school */
  const TRF = window.WR_TRANSFER || {}, SLUGK = new Map();
  const wKey = (r) => { const b = nkey(r.name) + '|' + r.sch, c = cStart(b, r.year), k = c ? b + '#' + c : b; return TRF[k] || k; }, wSlug = (n, s) => slug(n) + '--' + slug(s);
  const ownSlug = (r) => { const c = cStart(nkey(r.name) + '|' + r.sch, r.year); return wSlug(r.name, r.sch) + (c ? '-' + c : ''); };
  const rSlug = (r) => SLUGK.get(wKey(r)) || ownSlug(r);
  const WRESTLER = new Map();
  d3.groups(APP, wKey).forEach(([k, all]) => { all.sort((a, b) => a.year - b.year); const L = all[all.length - 1]; const sl = ownSlug(L); SLUGK.set(k, sl); WRESTLER.set(sl, { name: L.name, sch: L.sch, d: all[0].d, apps: all, rows: all.filter((r) => r.place), slug: sl }); });
  const wrestlerHref = (r) => '#wrestler/' + rSlug(r);
  /* ---- Overtime Rating (docs/DIFFICULTY.md, v2) ----
     Every bout in the archive is parsed; each season is fit as one batch (a win counts by the opponent's full-season
     strength, whatever the round or level), seasons are linked by fitted proximity weights, and the result is put on
     one scale for every level and era: 1500 = the average state qualifier. FIELD = the mean rating of a bracket's top
     eight, on the same scale, so a district reads below a regional below states. Data: sos.js (eager: every bracket's
     field, the rating of every state entrant and district/regional medalist) and sos/<year>.json (lazy: every entrant's
     rating, best win and bad losses per tournament, and every bout). */
  const stateByYK = new Map(); APP.forEach((r) => { const k = r.year + '|' + wKey(r); stateByYK.set(k, (stateByYK.get(k) || 0) + r.pts); });
  const SOSD = window.WR_SOS || {}, RTG_META = window.WR_RTG_META || { field: {}, lo: 1000, hi: 1750 };
  const L1 = { state: 's', regional: 'r', district: 'd', section: 'x' };
  const nk8 = (n) => (n.length <= 8 ? n : n.slice(0, 5) + n.slice(-3));
  const sosEntry = (lvl, year, cls, unit, wn) => { const Y = SOSD[year]; if (!Y) return null; return Y[lvl === 'state' ? `${cls}.s..${wn}` : `${cls}.${L1[lvl]}.${unit}.${wn}`] || null; };
  const RMAPC = new Map();
  const rmap = (e) => { let m = RMAPC.get(e); if (!m) { m = new Map(); (e[1] || '').split(',').forEach((x) => { if (!x) return; const i = x.lastIndexOf(':'); m.set(x.slice(0, i), +x.slice(i + 1)); }); RMAPC.set(e, m); } return m; };
  const entryOf = (r, lvl = r.lvl || 'state') => { const k = parseBkey(bkey(r, lvl)); return k ? sosEntry(k.lvl, k.year, k.cls, k.unit, k.wn) : null; };
  /* his season rating, from any bracket he wrestled in that season */
  const ratingOf = (r, lvl) => { const e = entryOf(r, lvl); if (!e) return null; const m = rmap(e), t = nk8(nkey(r.name)); let v = m.get(t);
    if (v == null) { const c = []; m.forEach((x, k) => { if (k[0] === t[0] && k.slice(-3) === t.slice(-3)) c.push(x); }); if (c.length === 1) v = c[0]; }  // Joe / Joey, nicknames
    if (v == null) { const B = sosBracket(bkey(r, lvl)), x = B && B.s[nkey(r.name)]; if (x && x[0] != null) v = x[0]; }  // non-medalists (section and DNP seasons): the season file, once loaded
    return v == null ? null : v; };
  const fieldOf = (r, lvl) => { const e = entryOf(r, lvl); return e && e[0] != null ? e[0] * 10 : null; };
  const fieldAt = (lvl, year, cls, unit, wn) => { const e = sosEntry(lvl, year, cls, unit, wn); return e && e[0] != null ? e[0] * 10 : null; };
  const rtg10 = (v) => (v == null ? null : Math.round(v));   // shown to the point so the season tile, the bracket and the headline agree
  /* a wrestler's ratings by season (state rows first, then district / regional rows of seasons without a state trip) */
  const seasonRatings = (apps, lower) => { const by = new Map();
    (apps || []).forEach((r) => { const v = ratingOf(r, 'state'); if (v != null && !by.has(r.year)) by.set(r.year, { year: r.year, rating: v, w: r.w, grade: r.grade }); });
    (lower || []).forEach((r) => { if (by.has(r.year)) return; const v = ratingOf(r, r.lvl); if (v != null) by.set(r.year, { year: r.year, rating: v, w: r.w, grade: r.grade }); });
    return Array.from(by.values()).sort((a, b) => a.year - b.year); };
  const CAREER = new Map();
  const careerOf = (W, rs) => { const k = W ? W.slug : wKey(rs[0]); if (CAREER.has(k)) return CAREER.get(k); const apps = W ? W.apps : rs; const v = careerRating(apps, W ? (W.lower || lowerFor(apps)) : lowerFor(apps)); CAREER.set(k, v); return v; };
  const careerRating = (apps, lower) => { const s = seasonRatings(apps, lower); if (!s.length) return null; const pk = s.reduce((a, b) => (b.rating > a.rating ? b : a)); return { peak: pk.rating, peakYear: pk.year, avg: d3.mean(s, (x) => x.rating), seasons: s }; };
  /* bouts and every entrant's path, per season, fetched when a bracket opens */
  const SOSY = new Map();
  const sosLoaded = (year) => SOSY.has(year) && !(SOSY.get(year) instanceof Promise);
  const loadSOS = (year) => { if (SOSY.has(year)) { const v = SOSY.get(year); return v instanceof Promise ? v : Promise.resolve(v); } const p = fetch(`sos/${year}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { SOSY.set(year, d); return d; }); SOSY.set(year, p); return p; };
  /* a wrestler's best wins across his career, from the lazy season files (load his years first) */
  /* every bout between two wrestlers: scan the brackets A wrestled in (state, regional, district, section) for bouts with
     B on the other side, from the lazy season files (load both careers and their years first) */
  const meetings = (A, B) => { const out = [];
    const rowsOf = (W) => (W.apps || []).map((r) => [r, 'state']).concat((W.lower || []).map((r) => [r, r.lvl]));
    const bRows = new Map(rowsOf(B).map(([r, lvl]) => [bkey(r, lvl), r])), seen = new Set();
    rowsOf(A).forEach(([r, lvl]) => { const key = bkey(r, lvl), rb = bRows.get(key); if (!rb || seen.has(key)) return; seen.add(key); const S = sosBracket(key); if (!S) return;
      const ka = nkey(r.name), kb = nkey(rb.name);
      S.b.forEach((b) => { const w = nkey(b[2]), l = nkey(b[3]); if (!((w === ka && l === kb) || (w === kb && l === ka))) return;
        const sa = S.s[ka], sb = S.s[kb];
        out.push({ key, lvl, year: r.year, w: r.w, side: b[0], round: b[1], aWon: w === ka, result: b[4], score: b[5], flags: b[6], ra: sa && sa[0] != null ? sa[0] : null, rb: sb && sb[0] != null ? sb[0] : null }); }); });
    const LV = { section: 0, district: 1, regional: 2, state: 3 };
    return out.sort((a, b) => a.year - b.year || LV[a.lvl] - LV[b.lvl]); };
  /* head to head for schools: overtime/h2h/<slug>.json (tools/build_units.js) — bouts between the two schools' wrestlers
     by year, and each season's lineup for dual-meet odds */
  const H2HS = new Map();
  const loadH2HS = (sl) => { if (!H2HS.has(sl)) { const p = fetch(`h2h/${sl}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => { H2HS.set(sl, d); return d; }); H2HS.set(sl, p); } const v = H2HS.get(sl); return v instanceof Promise ? v : Promise.resolve(v); };
  const h2hsOf = (sl) => { const v = H2HS.get(sl); return v && !(v instanceof Promise) ? v : null; };
  const h2hsLoaded = (sl) => H2HS.has(sl) && !(H2HS.get(sl) instanceof Promise);
  /* one dual meet, weight by weight: each bout won at the two wrestlers' season-rating odds; a weight one side has no
     one at is a forfeit to the other. Chance that A wins more bouts than B (a tie counts half). Counts bouts, not team
     points, so bonus-point wins don't move it. common: only weights both lineups have (seasons from different eras). */
  const dualOdds = (La, Lb, common) => { const a = new Map(La), b = new Map(Lb); const ps = [];
    new Set([...a.keys(), ...b.keys()]).forEach((k) => { if (common && !(a.has(k) && b.has(k))) return; const x = a.get(k), y = b.get(k); const ha = x != null, hb = y != null;
      if (!ha && !hb) return; ps.push(ha && hb ? 1 / (1 + Math.pow(10, (y - x) / 400)) : ha ? 1 : 0); });
    let dist = [1]; ps.forEach((p) => { const nd = new Array(dist.length + 1).fill(0); dist.forEach((v, i) => { nd[i] += v * (1 - p); nd[i + 1] += v * p; }); dist = nd; });
    const n = ps.length; let win = 0; dist.forEach((v, i) => { if (2 * i > n) win += v; else if (2 * i === n) win += v / 2; });
    return { p: win, n, exp: ps.reduce((t, p) => t + p, 0) }; };
  const bestWins = (apps, lower, n = 5) => { const out = [], seen = new Set();
    const rows = (apps || []).map((r) => [r, 'state']).concat((lower || []).map((r) => [r, r.lvl]));
    rows.forEach(([r, lvl]) => { const key = bkey(r, lvl); const B = sosBracket(key); if (!B) return; const me = nkey(r.name);
      B.b.forEach((b) => { if (nkey(b[2]) !== me || ['ff', 'inj', 'dq'].includes(b[4])) return; const o = B.s[nkey(b[3])]; if (!o || o[0] == null) return; const id = key + '|' + b[3]; if (seen.has(id)) return; seen.add(id);
        out.push({ key, lvl, year: r.year, w: r.w, opp: b[3], rating: o[0], side: b[0], round: b[1], result: b[4], score: b[5], flags: b[6] }); }); });
    return out.sort((a, b) => b.rating - a.rating).slice(0, n); };
  const yearsOf = (apps, lower) => Array.from(new Set((apps || []).concat(lower || []).map((r) => r.year)));
  const sosBracket = (key) => { const k = parseBkey(key); if (!k) return null; const d = SOSY.get(k.year); return d && !(d instanceof Promise) ? d[key] || null : null; };

  const wrestlersOf = (rows) => d3.groups(rows, wKey).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; const W = WRESTLER.get(rSlug(L)); const meds = rs.filter((r) => r.place); return { name: L.name, sch: L.sch, d: rs[0].d, medals: meds.length, titles: meds.filter((r) => r.place === 1).length, pts: d3.sum(rs, apts), raw: d3.sum(rs, (r) => r.pts), get rtg() { return careerOf(W, rs); }, places: placeCounts(rs), rows: meds, apps: W ? W.apps : rs, years: rs[0].year === L.year ? String(L.year) : rs[0].year + '–' + L.year, href: wrestlerHref(L) }; }).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
  const GRADE_I = { FR: 0, SO: 1, JR: 2, SR: 3 }, GRADE_L = ['FR', 'SO', 'JR', 'SR'];
  const gradeSlot = (r, apps) => { if (r.grade in GRADE_I) return GRADE_I[r.grade]; const k = apps.find((a) => a.grade in GRADE_I); if (k) return Math.max(0, Math.min(3, GRADE_I[k.grade] + (r.year - k.year))); const i = apps.indexOf(r); return Math.max(0, Math.min(3, 3 - (apps.length - 1 - i))); };

  /* ---- one level at a time: the podium, bracket, rankings and seasons count the selected tournament level ---- */
  const levelRows = (u) => (state.lvl === 'state' ? unitRows(u) : lowerUnitRows(u, state.lvl));
  function levelStats(u) {
    if (state.lvl === 'state') return unitStats(u);
    const lvl = state.lvl, rows = lowerUnitRows(u, lvl), o = lowerStats(u, lvl, rows), teams = lowerTeamRows(u, lvl);
    o.won = teams.filter((t) => t.place === 1).length; o.teams = teams; o.cov = lowerCoverage(u, lvl); return o;
  }
  const levelRankings = (kind, u) => (state.lvl === 'state' ? rankings(kind, u && u.kind !== 'state' ? u : null) : lowerRankings(u || U.state(), state.lvl, kind));
  /* wrestlers ranked at one level: state rows count his whole career (window decides who is in); lower rows as given */
  const rtgOf = (r) => { if (r._rt === undefined) r._rt = ratingOf(r, r.lvl || 'state'); return r._rt; };
  const lowerWrestlersOf = (rows) => d3.groups(rows.filter((r) => r.place), wKey).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; const pk = d3.max(rs, rtgOf);
    return { name: L.name, sch: L.sch, d: rs[0].d, medals: rs.length, titles: rs.filter((r) => r.place === 1).length, pts: d3.sum(rs, wpts), places: placeCounts(rs), rows: rs, apps: [], lower: rs, years: rs[0].year === L.year ? String(L.year) : rs[0].year + '–' + L.year, href: wrestlerHref(L), rtg: pk ? { peak: pk } : null }; }).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
  /* the bracket: a unit's children seeded by points at the selected level, in the current scope and window */
  function bracketOf(u, mode) {
    const L = state.lvl, rows = levelRows(u).filter((r) => r.place), total = d3.sum(rows, wpts) || 1;
    let items;
    if (u.kind === 'school' && mode === 'weight') items = d3.groups(rows, (r) => stdOf(r).k).map(([k, v]) => ({ name: STD.find((c) => c.k === k).label + ' lbs', pts: d3.sum(v, wpts), n: v.length, href: null }));
    else if (u.kind === 'school') items = (L === 'state' ? wrestlersOf(careerRows(rows)) : lowerWrestlersOf(rows)).map((w) => ({ name: w.name, sub: w.years, pts: w.pts, n: w.medals, href: w.href }));
    else {
      const kind = u.kind === 'state' ? (mode === 'district' ? 'district' : 'region') : u.kind === 'region' ? 'district' : 'school';
      items = levelRankings(kind, u).map((o) => ({ name: kind === 'region' ? REGIONS[o.u.id] : o.u.name, sub: kind === 'district' ? DISTRICTS[o.u.id] : kind === 'school' && u.kind !== 'district' ? 'D' + o.u.d : '', pts: o.pts, n: o.medals, href: o.u.href }));
    }
    items = items.filter((it) => it.pts > 0 && !(it.n < 3 && it.pts / total < 0.005)).sort((a, b) => b.pts - a.pts).map((it, i) => ({ ...it, seed: i + 1, share: it.pts / total }));
    return { items, total };
  }
  /* all-time teams: every wrestler who appears in any bracket for the unit is a candidate, at ONE weight (the weight of
     his highest-rated season). Value = ALPHA · z(placement credit) + (1 − ALPHA) · z(peak Overtime Rating), z within the
     unit's candidates at that weight (the unit's whole pool when a weight has fewer than 10). Placement credit depends on
     the page: State counts state results only (district strength varies too much to compare statewide); Region adds
     regional results; District and School add district results too. Points 16-12-9-7-5-3-2-1 per place over his whole
     career, times the level weight; advancing without placing earns a little (state 1, regional 0.5, times the weight).
     The window decides who is eligible (any season inside it); his whole career counts. The level switch does not apply. */
  const ATT_ALPHA = 0.6;
  const ATT_W = { state: { s: 1, r: 0, d: 0 }, region: { s: 1, r: 0.4, d: 0 }, district: { s: 1, r: 0.4, d: 0.15 }, school: { s: 1, r: 0.4, d: 0.15 } };
  const attCredit = (p, kind) => { const w = ATT_W[kind]; return w.s * (p.sP + p.sQ) + w.r * (p.rP + 0.5 * p.rQ) + w.d * p.dP; };
  const personClass = (p) => (p.cls === 'AAA' || p.cls === 'AA' ? p.cls : p.cls === 'single' ? lineage(p.sch) : homeOf(p.sch));
  const personRegion = (p) => regionOf({ cls: personClass(p), region: FIVE.includes(p.reg) ? p.reg : null, year: p.y1, d: p.d, lvl: 'regional' });
  const personIn = (u) => u.kind === 'state' ? () => true : u.kind === 'region' ? (p) => personRegion(p) === u.id : u.kind === 'district' ? (p) => p.d === u.id : (p) => p.sch === u.id;
  const personScope = (p) => { if (state.cls !== 'ALL' && personClass(p) !== state.cls) return false; const [a, b] = yearsWindow(); if (p.y1 < a || p.y0 > b) return false;
    const f = state.f; return (!f.weights.length || f.weights.includes(p.tw)) && (!f.districts.length || f.districts.includes(p.d)) && (!f.schools.length || f.schools.includes(p.sch)) && (!f.regions.length || f.regions.includes(personRegion(p))); };
  const zf = (arr, g) => { if (!arr.length) return () => 0; const v = arr.map(g); const m = d3.mean(v); const sd = d3.deviation(v) || 1; return (x) => (g(x) - m) / sd; };
  function allTimeTeams(u, depth = 3) { if (!PEOPLE) return null; return memo('att|' + wkey() + '|' + u.kind + '|' + u.id + '|' + depth, () => allTimeTeams0(u, depth)); }
  function allTimeTeams0(u, depth) {
    const kind = u.kind, inU = personIn(u);
    const pool = PEOPLE.filter((p) => p.tw && inU(p) && personScope(p)); if (!pool.length) return [];
    const cr = (p) => attCredit(p, kind), rated = pool.filter((p) => p.peak);
    const zC0 = zf(pool, cr), zR0 = zf(rated, (p) => p.peak);
    const byW = d3.group(pool, (p) => p.tw);
    const val = (p, zC, zR) => ATT_ALPHA * zC(p) + (1 - ATT_ALPHA) * (p.peak ? zR(p) : 0);
    const slotOf = (p, credit, k, alt) => ({ name: p.name, sch: p.sch, d: p.d, href: '#wrestler/' + p.slug, rtg: p.peak, years: p.y0 === p.y1 ? String(p.y0) : `${p.y0}–${p.y1}`, sres: p.sres, rB: p.rB, dB: p.dB, rT: p.rT, dT: p.dT, credit, w: k, alt: !!alt });
    const used = new Set();
    const rows = STD.filter((c) => byW.has(c.k)).map((c) => { const arr = byW.get(c.k), big = arr.length >= 10, ra = arr.filter((p) => p.peak);
      const zC = big ? zf(arr, cr) : zC0, zR = big && ra.length >= 5 ? zf(ra, (p) => p.peak) : zR0;
      const ranked = arr.map((p) => ({ p, v: val(p, zC, zR), credit: cr(p) })).sort((x, y) => y.v - x.v || y.credit - x.credit || (y.p.peak || 0) - (x.p.peak || 0));
      const slots = ranked.slice(0, depth).map(({ p, credit }) => { used.add(p); return slotOf(p, credit, c.k); });
      return { c, slots }; });
    /* a weight with open slots is filled by wrestlers who also wrestled it but did not make a team at their own weight
       (still one weight per wrestler: nobody appears twice) */
    const wi = (k) => STD.findIndex((c) => c.k === k);
    const open = STD.filter((c) => !byW.has(c.k)).map((c) => ({ c, slots: [] })).concat(rows).filter((x) => x.slots.length < depth);
    if (open.length) {
      const pairs = []; open.forEach((x) => { const bit = 1 << wi(x.c.k); pool.forEach((p) => { if (!used.has(p) && (p.ws & bit)) pairs.push({ x, p, v: val(p, zC0, zR0), credit: cr(p) }); }); });
      pairs.sort((a, b) => b.v - a.v || b.credit - a.credit);
      pairs.forEach(({ x, p, credit }) => { if (used.has(p) || x.slots.length >= depth) return; used.add(p); x.slots.push(slotOf(p, credit, x.c.k, true)); });
      open.forEach((x) => { if (!rows.includes(x) && x.slots.length) rows.push(x); });
    }
    rows.sort((a, b) => wi(a.c.k) - wi(b.c.k));
    rows.forEach((x) => { while (x.slots.length < depth) x.slots.push(null); });
    return rows;
  }
  const unitByKind = { region: (id) => U.region(id), district: (id) => U.district(id), school: (id) => U.school(id) };

  /* ---- tournament brackets (the field of one year · class · level · unit · weight) ----
     key: year.cls.state.wn  |  year.cls.district.D11.wn  |  year.cls.regional.NE.wn */
  const bkey = (r, lvl = r.lvl || 'state') => lvl === 'state' ? `${r.year}.${r.cls}.state.${r.wn}` : `${r.year}.${r.cls}.${lvl}.${r.lvl === lvl && r.unit ? r.unit : lvl === 'district' ? lowerUnitFor('district', r.year, r.cls, r.d) : lowerUnitFor('regional', r.year, r.cls, r.region || regionOf(r, r.cls === 'single' ? r.k : r.cls))}.${r.wn}`;
  const parseBkey = (k) => { const p = String(k || '').split('.'); if (p.length < 4) return null; const [year, cls, lvl] = p; return lvl === 'state' ? { year: +year, cls, lvl, wn: +p[3] } : { year: +year, cls, lvl, unit: p[3], wn: +p[4] }; };
  const seedNum = (r) => (r.lvl === 'state' || !r.lvl) ? (r.year >= 1951 ? (r.reg || 99) : (r.dist || 99)) : (r.seed || 99);
  /* which archive unit a (district, year, class) or (region code) maps to; D1 AAA splits into North/South/... parts */
  const lowerUnitFor = (lvl, year, cls, id) => { if (lvl === 'regional') return id || '?'; const base = 'D' + id; if (COV.has(`district|${year}|${cls}|${base}`)) return base; const alt = Array.from(COV).map((k) => k.split('|')).filter((p) => p[0] === 'district' && +p[1] === year && p[2] === cls && (p[3].startsWith(base + '_') || p[3].split('-').map((x) => x.replace('D', '')).includes(String(id)))); return alt.length ? alt[0][3] : base; };
  /* full fields of one year and level, fetched on demand for the bracket view */
  const LFIELD = new Map(), LLOAD = new Map();
  const lowerLoaded = (year, lvl) => LFIELD.has(year + '-' + lvl);
  const loadLower = (year, lvl) => { const k = year + '-' + lvl; if (LFIELD.has(k)) return Promise.resolve(LFIELD.get(k)); if (LLOAD.has(k)) return LLOAD.get(k); if (!LM.cov.concat(LM.scov || []).some((c) => c.startsWith(`${lvl}|${year}|`))) { LFIELD.set(k, []); return Promise.resolve([]); }
    const p = fetch(`lower/${k}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((rows) => { const out = rows.map(([cls, unit, w, place, seed, name, sch0, grade, record, d0]) => { const d = unitDist(lvl, unit, d0), sch = splitName(sch0, d); return { lvl, year, cls, unit, w, wn: wNum(w), place: +place || 0, seed, name, school: sch, sch, grade, record, d: d || null, region: lvl === 'regional' ? unit : dregOf(cls, year, d), pts: ptsOf(+place || 0) }; }); LFIELD.set(k, out); LLOAD.delete(k); return out; });
    LLOAD.set(k, p); return p; };
  function bracketField(key) {
    const k = parseBkey(key); if (!k) return null;
    let rows, loading = false;
    if (k.lvl === 'state') rows = APP.filter((r) => r.year === k.year && r.cls === k.cls && r.wn === k.wn);
    else { const full = LFIELD.get(k.year + '-' + k.lvl); if (full) rows = full.filter((r) => r.cls === k.cls && r.unit === k.unit && r.wn === k.wn); else { rows = LOWER.filter((r) => r.lvl === k.lvl && r.year === k.year && r.cls === k.cls && r.unit === k.unit && r.wn === k.wn); loading = LM.cov.includes(`${k.lvl}|${k.year}|${k.cls}|${k.unit}`); } }
    const seedN = (r) => { if (r.lvl === 'state' || !r.lvl) return seedNum(r); const m = /(\d+)\s*$/.exec(r.seed || ''); return m ? +m[1] : 99; };
    rows = rows.slice().sort((a, b) => (a.place || 99) - (b.place || 99) || seedN(a) - seedN(b) || a.name.localeCompare(b.name));
    const w = rows[0] ? rows[0].w : String(k.wn);
    const field = fieldAt(k.lvl, k.year, k.cls, k.unit, k.wn != null ? k.wn : wNum(w));
    const adv = k.lvl === 'state' ? null : advOf(k.lvl, k.year, k.cls, k.unit, w);
    const entrants = rows.map((r) => { const W = WRESTLER.get(rSlug(r)) || lowerWrestler(rSlug(r)); const career = W ? W.rows.filter((x) => x.year !== r.year) : []; const sameSeason = k.lvl === 'state' ? null : (stateByYK.get(r.year + '|' + wKey(r)) ? APP.find((x) => x.year === r.year && wKey(x) === wKey(r)) : null);
      return { r, W, slug: rSlug(r), career, sameSeason, adv: adv && r.place && r.place <= adv, seedLabel: r.lvl === 'state' || !r.lvl ? (r.year >= 1951 ? (r.region ? `${r.region}-${r.reg || '?'}` : (r.reg ? String(r.reg) : '')) : (r.dist ? `D${r.d}-${r.dist}` : `D${r.d}`)) : (r.seed ? String(r.seed) : '') }; });
    const src = (LM.src || {})[`${k.lvl}|${k.year}|${k.cls}|${k.unit}`] || null;
    return { ...k, key, w, field, adv, loading, src, covered: k.lvl === 'state' || LM.cov.concat(LM.scov || []).includes(`${k.lvl}|${k.year}|${k.cls}|${k.unit}`), entrants, unitLabel: k.lvl === 'state' ? 'PIAA' : unitLabel(k.lvl, k.unit), next: k.lvl === 'state' ? 'HERSHEY' : k.lvl === 'regional' ? 'TO STATES' : 'TO REGIONALS' };
  }

  /* ---- lower-level dominance: a district's (or region's, or school's) own tournament results, never mixed with state ---- */
  const lowerIn = (r) => actScope(r) && inWindow(r.year) && passFilters(r);
  const lowerSchoolIn = (r) => homeScope(r) && inWindow(r.year) && passFilters(r);
  const lowerUnitRows = (u, lvl) => memo('lur|' + wkey() + '|' + lvl + '|' + u.kind + '|' + u.id, () => LOWER.filter((r) => r.lvl === lvl && (u.kind === 'school' ? lowerSchoolIn(r) : lowerIn(r)) && (u.kind === 'district' ? r.d === u.id : u.kind === 'region' ? regionOf(r) === u.id : u.kind === 'school' ? r.sch === u.id : true)));
  const LAV = new Map(); LOWER.forEach((r) => { if (!r.place) return; const cont = r.lvl === 'district' ? r.d : r.region; const k = `${r.lvl}|${r.year}|${cont}|${r.k}`; LAV.set(k, (LAV.get(k) || 0) + r.pts); });
  const lowerAvail = (lvl, year, cont) => (state.cls === 'ALL' ? ['AAA', 'AA'].reduce((a, c) => a + (LAV.get(`${lvl}|${year}|${cont}|${c}`) || 0), 0) : LAV.get(`${lvl}|${year}|${cont}|${state.cls}`) || 0);
  function lowerStats(u, lvl, rows) {
    const [, last] = yearsWindow(); const meds = rows.filter((r) => r.place); let era = 0, power = 0;
    d3.rollups(meds, (v) => ({ pts: d3.sum(v, wpts), cont: lvl === 'district' ? v[0].d : v[0].region }), (r) => r.year).forEach(([y, o]) => { const av = lowerAvail(lvl, y, o.cont); if (av) { const sh = o.pts / av; era += sh; power += sh * Math.pow(0.5, (last - y) / HALF_LIFE); } });
    const offRows = state.cls === 'ALL' ? [] : meds.filter(isOff);
    return { u, lvl, rows: meds, apps: rows, places: placeCounts(meds), medals: meds.length, titles: meds.filter((r) => r.place === 1).length, pts: Math.round(d3.sum(meds, wpts)), era: 100 * era, power: 100 * power, offMedals: offRows.length, offCls: offRows.length ? offRows[0].cls : null, offClass: OFF_CLASS, first: meds.length ? d3.min(meds, (r) => r.year) : null, last: meds.length ? d3.max(meds, (r) => r.year) : null };
  }
  const lowerRankings = (u, lvl, kind) => { const rows = lowerUnitRows(u, lvl); const g = kind === 'region' ? d3.groups(rows, (r) => regionOf(r)).filter(([c]) => c && regionOrder().includes(c)).map(([c, v]) => lowerStats(U.region(c), lvl, v)) : kind === 'district' ? d3.groups(rows, (r) => r.d).filter(([d]) => d).map(([d, v]) => lowerStats(U.district(d), lvl, v)) : Array.from(new Set(rows.map((r) => r.sch))).filter((s) => state.cls === 'ALL' || lowerHome(s) === state.cls).map((s) => lowerStats(U.school(s), lvl, lowerUnitRows(U.school(s), lvl).filter((r) => u.kind === 'district' ? r.d === u.id : u.kind === 'region' ? regionOf(r) === u.id : true))); return g.filter((o) => o.medals).sort((a, b) => b.era - a.era || b.pts - a.pts); };
  const lowerTeamRows = (u, lvl) => LTEAMS.filter((t) => t.lvl === lvl && inWindow(t.year) && (state.cls === 'ALL' || t.cls === state.cls || (t.cls === 'single' && (LIN.get(t.sch) || 'AAA') === state.cls)) && (u.kind === 'district' ? (t.unit === 'D' + u.id || t.unit.startsWith('D' + u.id + '_') || t.unit.replace('D', '').split('-').includes(String(u.id)) && t.unit.includes('-')) : u.kind === 'region' ? t.unit === u.id : u.kind === 'school' ? t.sch === u.id : true));
  const lowerCoverage = (u, lvl) => { const ks = LM.cov.map((c) => c.split('|')).filter((p) => p[0] === lvl && (state.cls === 'ALL' || p[2] === state.cls || p[2] === 'single') && (u.kind === 'district' ? (p[3] === 'D' + u.id || p[3].startsWith('D' + u.id + '_') || (p[3].includes('-') && p[3].replace('D', '').split('-').includes(String(u.id)))) : u.kind === 'region' ? p[3] === u.id : true)); const ys = Array.from(new Set(ks.map((p) => +p[1]))).sort((a, b) => a - b); return { n: ks.length, years: ys, first: ys[0], last: ys[ys.length - 1] }; };
  /* a state wrestler's district and regional rows: exact key, then last name + school + season as a fallback */
  const LIDX = new Map(), LIDX2 = new Map();
  LOWER.forEach((r) => { const k = wKey(r); (LIDX.get(k) || LIDX.set(k, []).get(k)).push(r); const k2 = r.sch + '|' + r.year; (LIDX2.get(k2) || LIDX2.set(k2, []).get(k2)).push(r); });
  const lastName = (n) => String(n).replace(/\(.*?\)/g, '').trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
  const firstName = (n) => String(n).replace(/\(.*?\)/g, '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  /* same person, different spelling of the first name (Joe / Joey, Matt / Matthew); brothers (Tyler / Trevor) stay apart */
  const sameFirst = (a, b) => { const x = firstName(a), y = firstName(b); return x === y || (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x))); };
  const LSIDX = new Map(), LSIDX2 = new Map();
  LSEC.forEach((r) => { const k = wKey(r); (LSIDX.get(k) || LSIDX.set(k, []).get(k)).push(r); const k2 = r.sch + '|' + r.year; (LSIDX2.get(k2) || LSIDX2.set(k2, []).get(k2)).push(r); });
  /* his section result in a season: exact key, then last name + school + season + weight */
  const sectionFor = (apps, year) => { const a0 = apps && apps[0]; if (!a0) return null; const ex = (LSIDX.get(wKey(a0)) || []).find((r) => r.year === year); if (ex) return ex;
    const ln = lastName(a0.name); const near = apps.find((a) => a.year === year) || a0;
    return (LSIDX2.get(near.sch + '|' + year) || []).find((r) => lastName(r.name) === ln && sameFirst(r.name, a0.name) && (!near.wn || Math.abs(r.wn - near.wn) <= 20)) || null; };
  const lowerFor = (apps) => { if (!apps || !apps.length) return []; const out = (LIDX.get(wKey(apps[0])) || []).slice(); const have = new Set(out.map((r) => r.lvl + '|' + r.year)); const ln = lastName(apps[0].name);
    apps.forEach((a) => (LIDX2.get(a.sch + '|' + a.year) || []).forEach((r) => { if (!have.has(r.lvl + '|' + r.year) && lastName(r.name) === ln && sameFirst(r.name, apps[0].name) && Math.abs(r.wn - a.wn) <= 20) { out.push(r); have.add(r.lvl + '|' + r.year); } }));
    return out.sort((a, b) => a.year - b.year || (a.lvl === 'district' ? 0 : 1) - (b.lvl === 'district' ? 0 : 1)); };
  /* wrestlers who only appear in the archive (never placed at states) still get a page */
  let LWRESTLER = null;
  const lowerWrestler = (sl) => { if (!LWRESTLER) { LWRESTLER = new Map(); d3.groups(LOWER, (r) => rSlug(r)).forEach(([k, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; LWRESTLER.set(k, { name: L.name, sch: L.sch, d: rs[0].d, apps: [], rows: [], lower: rs, slug: k, lowerOnly: true }); }); } return LWRESTLER.get(sl) || null; };

  /* ---- everyone: the people index (every wrestler in any district, regional or state bracket), loaded on demand ---- */
  let PEOPLE = null, PEOPLE_BY = null, PPL = null;
  const LVLN = ['', 'district', 'regional', 'state'];
  const loadPeople = () => PPL || (PPL = fetch('people.json').then((r) => (r.ok ? r.json() : { s: [], p: [] })).catch(() => ({ s: [], p: [] })).then((D) => {
    PEOPLE = D.p.map(([name, si, y0, sp, d, best, peak, tw, sP, rP, dP, sQ, rQ, sres, rB, dB, rT, dT, reg, cl, ws]) => { const sch = D.s[si]; return { name, sch, y0, y1: y0 + sp, d, lvl: LVLN[Math.floor(best / 10)], place: best % 10, peak: peak || null, slug: wSlug(name, sch) + (cStart(nkey(name) + '|' + sch, y0) ? '-' + cStart(nkey(name) + '|' + sch, y0) : ''), key: ((k) => TRF[k] || k)(nkey(name) + '|' + sch + (cStart(nkey(name) + '|' + sch, y0) ? '#' + cStart(nkey(name) + '|' + sch, y0) : '')),   /* a transfer's key is his first school's, like wKey */ q: (name + ' ' + sch).toLowerCase(), tw: tw != null ? STD[tw].k : null, sP: sP || 0, rP: rP || 0, dP: dP || 0, sQ: sQ || 0, rQ: rQ || 0, sres: (sres || []).map((v) => ({ year: Math.floor(v / 10), place: v % 10 })), rB: rB || 0, dB: dB || 0, rT: rT || 0, dT: dT || 0, reg: reg || null, cls: cl === 0 ? 'AAA' : cl === 1 ? 'AA' : cl === 2 ? 'single' : null, ws: ws || 0 }; });
    PEOPLE_BY = new Map(PEOPLE.map((p) => [p.slug, p])); return PEOPLE; }));
  const peopleLoaded = () => !!PEOPLE;
  const peopleOf = (sch) => (PEOPLE || []).filter((p) => p.sch === sch).sort((a, b) => (b.peak || 0) - (a.peak || 0) || b.y1 - a.y1);
  const searchPeople = (q, n = 60) => { const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!t.length || !PEOPLE) return []; const out = []; const f = state.f, geo = (p) => (!f.districts.length || f.districts.includes(p.d)) && (!f.schools.length || f.schools.includes(p.sch)) && (!f.regions.length || f.regions.includes(personRegion(p))); for (const p of PEOPLE) { if (t.every((x) => p.q.includes(x)) && geo(p)) { out.push(p); if (out.length >= 2000) break; } } return out.sort((a, b) => (b.peak || 0) - (a.peak || 0)).slice(0, n).concat([]).map((p) => p); };
  const personOf = (sl) => (PEOPLE_BY ? PEOPLE_BY.get(sl) || null : null);
  const PW = new Map();
  /* any wrestler by address: state record, archive medalist, or (once the index is in) anyone in a bracket */
  const getWrestler = (sl) => { let W = WRESTLER.get(sl) || lowerWrestler(sl); if (W) return W; if (PW.has(sl)) return PW.get(sl); const p = personOf(sl); if (!p) return null;
    if (SLUGK.has(p.key) && WRESTLER.has(SLUGK.get(p.key))) return WRESTLER.get(SLUGK.get(p.key));   // a transfer filed under his last school: the same wrestler as his state rows
    const apps = APP.filter((r) => wKey(r) === p.key).sort((a, b) => a.year - b.year);
    W = { name: p.name, sch: p.sch, d: p.d, apps, rows: apps.filter((r) => r.place), lower: [], slug: sl, lowerOnly: !apps.length, person: p }; PW.set(sl, W); return W; };
  /* his whole career: load the full district, regional and section fields for every season FR to SR and pick out his
     rows, so a season he sat out reads DNC and a season he entered without placing reads DNP. Sections count where they
     are the district round (the shipped lower/<year>-section.json files), so a kid who only ever wrestled a section has
     a career too */
  const GI = { FR: 0, SO: 1, JR: 2, SR: 3 };
  const careerYears = (W) => { const rows = (W.apps || []).concat(W.lower || []); const ys = rows.map((r) => r.year); if (W.person) ys.push(W.person.y0, W.person.y1); if (!ys.length) return [];
    const g = rows.find((r) => r.grade in GI); if (g) { const fr = g.year - GI[g.grade]; const out = [0, 1, 2, 3].map((i) => fr + i); if (ys.every((y) => out.includes(y))) return out; }
    const a = Math.min(...ys), b = Math.max(...ys); return d3.range(a, b + 1); };
  function mergeLower(W, years) {
    const key = wKey(W.apps[0] || W.lower[0] || { name: W.name, sch: W.sch }); const ln = lastName(W.name);
    const base = new Map(); (W.lower0 || W.lower || []).forEach((r) => base.set(r.lvl + '|' + r.year, r));
    const wts = (W.apps || []).concat(W.lower0 || W.lower || []).map((r) => r.wn).filter((x) => x && x < 999);
    const near = (wn, y) => { const same = (W.apps || []).concat(W.lower0 || []).filter((r) => r.year === y).map((r) => r.wn); const ref = same.length ? same : wts; return !ref.length || ref.some((x) => Math.abs(x - wn) <= (same.length ? 20 : 40)); };
    years.forEach((y) => ['district', 'regional', 'section'].forEach((lvl) => { const F = LFIELD.get(y + '-' + lvl); if (!F) return;
      let m = F.find((r) => wKey(r) === key); if (!m && !base.has(lvl + '|' + y)) m = F.find((r) => r.sch === W.sch && lastName(r.name) === ln && sameFirst(r.name, W.name) && near(r.wn, y));
      if (m) base.set(lvl + '|' + y, m); }));
    return Array.from(base.values()).sort((a, b) => a.year - b.year || (a.lvl === 'district' ? 0 : 1) - (b.lvl === 'district' ? 0 : 1));
  }
  const fullCareer = (W) => { if (!W || W.full) return Promise.resolve(false); if (!W.lower0) W.lower0 = (W.lower && W.lower.length ? W.lower : lowerFor(W.apps)).slice();
    const pass = (years, n) => Promise.all(years.flatMap((y) => [loadLower(y, 'district'), loadLower(y, 'regional'), loadLower(y, 'section')])).then(() => { W.lower = mergeLower(W, years);
      const more = careerYears(W); const add = more.filter((y) => !years.includes(y)); if (add.length && n < 2) return pass(years.concat(add).sort((a, b) => a - b), n + 1); W.full = true; W.span = years; return true; });
    return pass(careerYears({ ...W, lower: W.lower0 }), 0); };
  Object.assign(OT, { meetings, loadH2HS, h2hsOf, h2hsLoaded, dualOdds, sectionFor, sectionCovered, LSEC, clearCaches, withSub, TEAMSCORES, rSlug, lvlsFor, pageLvl, LOWER, lowerHome, spanText, regionMembers, districtRegionSpans, districtMovers, actScope, homeScope, splitName, ATT_ALPHA, ATT_W, peopleOf, searchPeople, setLvl, levelRows, levelStats, levelRankings, lowerWrestlersOf, rtgOf, loadPeople, peopleLoaded, personOf, getWrestler, fullCareer, careerYears, LFIELD, careerOf, ratingOf, fieldOf, fieldAt, rtg10, seasonRatings, careerRating, bestWins, yearsOf, RTG_META, loadSOS, sosLoaded, sosBracket, lowerSrc, bkey, parseBkey, bracketField, SB, LTEAMS, lowerAvail, lowerIn, lowerUnitRows, lowerStats, lowerRankings, lowerTeamRows, lowerCoverage, lowerFor, lowerWrestler, lowerLoaded, loadLower, lowerCovered, advOf, dregOf, unitLabel, lowerUnitFor, COV, apts, toggleFilter, clearFilters, clearAll, nFilters, passFilters, inScopeNoWin, careerRows, OFF_CLASS, wt, wpts, isOff, homeOf, setWin, wkey, yearsWindow, inWindow, windowLabel, FIVE, regionOf, regionOrder, schoolRegion, distRegions, bracketOf, esc, slug, nkey, fmt, ordinal, canon, wShort, DISTRICTS, REGIONS, REGION_ORDER, state, setCls, clsName, PTS, APP, ROWS, YEARS, STD, stdOf, placeCounts, LOWER, lowerRows, SCHOOL_BY_SLUG, SCHOOL_D, schoolDistrict, classHistory, U, unitRows, regionsInScope, seasonOf, seasonsInScope, yearsInScope, unitStats, rankings, WRESTLER, wrestlerHref, wrestlersOf, GRADE_L, gradeSlot, allTimeTeams, unitByKind, wKey });
})();
