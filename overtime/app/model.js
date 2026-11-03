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
  const state = { cls: 'AAA', win: { mode: 'all', from: null, to: null }, f: EMPTY_F(), adj: false };
  try { state.adj = localStorage.getItem('ot-adjust') === '1'; } catch (e) { /* none */ }
  try { const s = localStorage.getItem('ot-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* none */ }
  try { const w = JSON.parse(localStorage.getItem('ot-window') || 'null'); if (w && ['all', '5', '10', '25', 'custom'].includes(w.mode)) state.win = w; } catch (e) { /* none */ }
  try { const f = JSON.parse(localStorage.getItem('ot-filters') || 'null'); if (f && typeof f === 'object') state.f = { ...EMPTY_F(), ...f }; } catch (e) { /* none */ }
  const clearCaches = () => { STATS.clear(); RANKS.clear(); SEASONS.clear(); WIN.clear(); SREG.clear(); DREG.clear(); };
  const save = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* none */ } };
  const setCls = (c) => { state.cls = c; save('ot-scope', c); clearCaches(); };
  const setAdjust = (v) => { state.adj = !!v; save('ot-adjust', state.adj ? '1' : '0'); clearCaches(); };
  const setWin = (w) => { state.win = { ...state.win, ...w }; save('ot-window', state.win); clearCaches(); };
  /* multi-select filters: weights (STD keys), regions, districts, schools. Toggle a value in or out. */
  const toggleFilter = (kind, v) => { const L = state.f[kind]; const i = L.indexOf(v); if (i < 0) L.push(v); else L.splice(i, 1); save('ot-filters', state.f); clearCaches(); };
  const clearFilters = (kind) => { if (kind) state.f[kind] = []; else state.f = EMPTY_F(); save('ot-filters', state.f); clearCaches(); };
  const clearAll = () => { state.cls = 'AAA'; state.win = { mode: 'all', from: null, to: null }; state.f = EMPTY_F(); state.adj = false; save('ot-scope', 'AAA'); save('ot-window', state.win); save('ot-filters', state.f); save('ot-adjust', '0'); clearCaches(); };
  const nFilters = () => state.f.weights.length + state.f.regions.length + state.f.districts.length + state.f.schools.length;
  const wkey = () => state.cls + '|' + state.win.mode + (state.win.mode === 'custom' ? state.win.from + '-' + state.win.to : '') + '|' + JSON.stringify(state.f) + (state.adj ? '|adj' : '');
  const clsName = (c = state.cls) => (c === 'ALL' ? 'All classes' : 'Class ' + c);

  /* appearances */
  const PTS = [16, 12, 9, 7, 5, 3, 2, 1], ptsOf = (p) => PTS[p - 1] || 0;
  const SEEDS = window.WR_SEEDS || {}, GRADES = window.WR_GRADES || {};
  const CH = RAW.champs.concat(window.WR_CHAMP_FILL || []).map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), place: 1, name, school, sch: canon(school), d }));
  const LINEUP = new Map(); d3.group(CH, (r) => r.year + '|' + r.cls).forEach((rs, k) => LINEUP.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => ({ w: r.w, wn: r.wn }))));
  const APP = (window.WR_MEDALS || []).map(([year, cls, w, place, name, school, d]) => ({ year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d }));
  { const have = new Set(APP.filter((r) => r.place === 1).map((r) => r.year + '|' + r.cls + '|' + r.wn)); CH.forEach((r) => { if (!have.has(r.year + '|' + r.cls + '|' + r.wn)) APP.push({ ...r }); }); }
  (window.WR_QUAL || []).forEach(([year, cls, w, name, school, d, grade]) => APP.push({ year, cls, w, wn: wNum(w), place: 0, name, school, sch: canon(school), d, grade }));
  APP.forEach((r) => {
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
  const isOff = (r) => state.cls !== 'ALL' && r.off;
  const wt = (r) => (isOff(r) ? (state.cls === 'AAA' ? OFF_CLASS : OFF_DOWN) : 1);
  const wpts = (r) => apts(r) * wt(r);
  /* time window: all-time, last N seasons in scope, or a custom range */
  const WIN = new Map();
  function yearsWindow() {
    const k = wkey(); if (WIN.has(k)) return WIN.get(k);
    const ys = Array.from(new Set(APP.filter((r) => state.cls === 'ALL' || r.k === state.cls).map((r) => r.year))).sort((a, b) => a - b);
    let out = [ys[0], ys[ys.length - 1]];
    if (state.win.mode === 'custom') out = [Math.max(ys[0], +state.win.from || ys[0]), Math.min(ys[ys.length - 1], +state.win.to || ys[ys.length - 1])];
    else if (state.win.mode !== 'all') out = [ys[Math.max(0, ys.length - +state.win.mode)], ys[ys.length - 1]];
    if (out[0] > out[1]) out = [out[1], out[1]];
    WIN.set(k, out); return out;
  }
  const inWindow = (y) => { const [a, b] = yearsWindow(); return y >= a && y <= b; };
  const windowLabel = () => { const [a, b] = yearsWindow(); return a === b ? String(a) : a + '–' + b; };
  const passFilters = (r) => { const f = state.f;
    return (!f.weights.length || f.weights.includes(stdOf(r).k)) && (!f.districts.length || f.districts.includes(r.d)) && (!f.schools.length || f.schools.includes(r.sch)) && (!f.regions.length || f.regions.includes(regionOf(r))); };
  const inScopeNoWin = (r) => (state.cls === 'ALL' || r.k === state.cls) && passFilters(r);
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
  const unitLabel = (lvl, unit) => { if (lvl === 'regional') return (REGIONS[unit] || unit) + ' Regional'; const m = /^D(\d+)(?:[_-](.+))?$/.exec(unit || ''); if (!m) return String(unit); return (m[2] && /^\d/.test(m[2]) ? `Districts ${m[1]}-${m[2]}` : `District ${m[1]}`) + (m[2] && !/^\d/.test(m[2]) ? ' ' + m[2] : ''); };
  const decodeLower = (lvl, rows) => rows.map(([, year, c, ui, wi, place, ni, si, g, sdi, d]) => { const cls = LCLS[c], unit = LS[ui], w = LS[wi], sch = LS[si]; return { lvl, year, cls, unit, w, wn: wNum(w), place, name: LS[ni], school: sch, sch, d: d || null, region: lvl === 'regional' ? unit : dregOf(cls, year, d), grade: LGR[g] || '', seed: LS[sdi] || '', pts: ptsOf(place) }; });
  const LOWER = decodeLower('district', window.WR_LOWER_D || []).concat(decodeLower('regional', window.WR_LOWER_R || []));
  const lowerRows = (lvl) => LOWER.filter((r) => r.lvl === lvl);
  const LTEAMS = (window.WR_LOWER_TEAMS || []).map(([l, year, c, ui, place, pts, si]) => ({ lvl: l ? 'regional' : 'district', year, cls: LCLS[c], unit: LS[ui], place, pts, sch: LS[si] }));
  { const LH = new Map(); LOWER.forEach((r) => { if (r.cls === 'single') return; const p = LH.get(r.sch); if (!p || r.year > p.year) LH.set(r.sch, r); });
    const LL = new Map(); d3.groups(LOWER.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { LL.set(s, d3.rollups(rs, (v) => v.length, (r) => r.cls).sort((a, b) => b[1] - a[1])[0][0]); });
    LOWER.forEach((r) => { const home = HOME.get(r.sch) || HOME.get(SUCCESSOR[r.sch]) || (LH.get(r.sch) || {}).cls || LL.get(r.sch) || 'AAA'; r.k = r.cls === 'single' ? (LIN.get(r.sch) || LL.get(r.sch) || home) : home; r.off = r.cls !== 'single' && r.cls !== r.k; }); }
  const lowerSrc = (lvl, year, cls, unit) => (LM.src || {})[`${lvl}|${year}|${cls}|${lvl === 'district' ? 'D' + unit : unit}`] || null;
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
  const regionOf = (r, scope = state.cls) => { if (scope === 'ALL') return r.region || null; if (r.cls === scope && FIVE.includes(r.region)) return r.region; const dr = dregOf(scope, r.year, r.d); return dr && FIVE.includes(dr) ? dr : modernRegion(r.d, scope); };
  const regionOrder = () => (state.cls === 'ALL' ? REGION_ORDER : FIVE);

  /* school → district, school → region (majority, per scope), district → regions (majority, per scope) */
  const SCHOOL_D = new Map(), SCHOOL_BY_SLUG = new Map();
  d3.groups(APP, (r) => r.sch).forEach(([s, rs]) => { SCHOOL_D.set(s, d3.rollups(rs, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0]); SCHOOL_BY_SLUG.set(slug(s), s); });
  const SREG = new Map(), DREG = new Map();
  const schoolRegion = (s) => { const k = state.cls + '|' + s; if (SREG.has(k)) return SREG.get(k); const rs = APP.filter((r) => r.sch === s && (state.cls === 'ALL' || r.k === state.cls)).map((r) => regionOf(r)).filter(Boolean); const v = rs.length ? d3.rollups(rs, (x) => x.length, (x) => x).sort((a, b) => b[1] - a[1])[0][0] : null; SREG.set(k, v); return v; };
  const distRegions = (d) => { const k = state.cls + '|' + d; if (DREG.has(k)) return DREG.get(k); const rs = APP.filter((r) => r.d === d && (state.cls === 'ALL' || r.k === state.cls) && (state.cls !== 'ALL' || r.year >= 1974)).map((r) => regionOf(r)).filter(Boolean); const tot = rs.length || 1; const v = d3.rollups(rs, (x) => x.length, (x) => x).sort((a, b) => b[1] - a[1]).filter((x) => x[1] >= 0.05 * tot).map((x) => x[0]); DREG.set(k, v); return v; };
  const schoolDistrict = (s) => SCHOOL_D.get(canon(s)) || null;
  const classHistory = (s) => { const ys = d3.rollups(APP.filter((r) => r.sch === s), (v) => v[0].cls, (r) => r.year).sort((a, b) => a[0] - b[0]); const out = []; ys.forEach(([y, c]) => { const L = out[out.length - 1]; if (L && L.cls === c) L.to = y; else out.push({ cls: c, from: y, to: y }); }); return out; };

  /* units */
  const U = {
    state: () => ({ kind: 'state', id: 'state', name: 'Pennsylvania', href: '#state' }),
    region: (code) => ({ kind: 'region', id: code, name: (REGIONS[code] || code) + ' Region', short: code, href: '#region/' + code }),
    district: (d) => ({ kind: 'district', id: +d, name: 'District ' + d, sub: DISTRICTS[d], href: '#district/' + d }),
    school: (name) => ({ kind: 'school', id: name, name, d: schoolDistrict(name), get region() { return schoolRegion(name); }, href: '#school/' + slug(name) }),
  };
  const inUnit = (u) => u.kind === 'state' ? () => true : u.kind === 'region' ? (r) => regionOf(r) === u.id : u.kind === 'district' ? (r) => r.d === u.id : (r) => r.sch === u.id;
  const unitRows = (u) => ROWS().filter(inUnit(u));
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
    else units = Array.from(new Set(rows.filter((r) => r.place).map((r) => r.sch))).map(U.school);
    const out = units.map((x) => unitStats(x, p && p.kind !== 'state' ? p : null)).filter((o) => o.medals);
    out.slice().sort((a, b) => b.era - a.era).forEach((o, i) => { o.eraRank = i + 1; });
    out.slice().sort((a, b) => b.power - a.power).forEach((o, i) => { o.powerRank = i + 1; });
    out.sort((a, b) => b.era - a.era); RANKS.set(key, out); return out;
  }

  /* wrestlers */
  const wKey = (r) => nkey(r.name) + '|' + r.sch, wSlug = (n, s) => slug(n) + '--' + slug(s);
  const WRESTLER = new Map();
  d3.groups(APP, wKey).forEach(([, all]) => { all.sort((a, b) => a.year - b.year); const L = all[all.length - 1]; WRESTLER.set(wSlug(L.name, L.sch), { name: L.name, sch: L.sch, d: all[0].d, apps: all, rows: all.filter((r) => r.place), slug: wSlug(L.name, L.sch) }); });
  const wrestlerHref = (r) => '#wrestler/' + wSlug(r.name, r.sch);
  /* ---- difficulty, layer 1: strength of field ----
     A state bracket (year, class, weight) is as strong as what its entrants did in their OTHER seasons: for every entrant,
     career state points minus this season's points, summed. Brackets are compared only against the other weights of the
     same year and class (a percentile), then cut into four tiers: 1 Open (<25%), 2 Solid, 3 Loaded, 4 Gauntlet (>=75%).
     Fewer than 4 known entrants: no tier. */
  const TIER_NAMES = [null, 'Open', 'Solid', 'Loaded', 'Gauntlet'];
  const ADJ = [0.88, 0.96, 1.04, 1.12];
  const CAREER_PTS = new Map(); APP.forEach((r) => { const k = wKey(r); CAREER_PTS.set(k, (CAREER_PTS.get(k) || 0) + r.pts); });
  const FIELD = new Map();
  d3.group(APP, (r) => r.year + '|' + r.cls + '|' + r.wn).forEach((rs, key) => {
    const byW = d3.rollups(rs, (v) => ({ other: CAREER_PTS.get(wKey(v[0])) - d3.sum(v, (r) => r.pts), r: v[0] }), wKey).map(([, o]) => o);
    const strength = d3.sum(byW, (o) => o.other);
    const top = byW.filter((o) => o.other > 0).sort((a, b) => b.other - a.other).slice(0, 3).map((o) => ({ name: o.r.name, sch: o.r.sch, other: o.other }));
    FIELD.set(key, { year: rs[0].year, cls: rs[0].cls, w: rs[0].w, wn: rs[0].wn, n: byW.length, strength, top, tier: null, pct: null });
  });
  d3.group(Array.from(FIELD.values()), (f) => f.year + '|' + f.cls).forEach((fs) => {
    const ok = fs.filter((f) => f.n >= 4).sort((a, b) => a.strength - b.strength); const n = ok.length;
    ok.forEach((f, i) => { f.pct = n > 1 ? i / (n - 1) : 0.5; f.tier = f.pct < 0.25 ? 1 : f.pct < 0.5 ? 2 : f.pct < 0.75 ? 3 : 4; });
  });
  const fieldInfo = (year, cls, w) => FIELD.get(year + '|' + cls + '|' + wNum(w)) || null;
  const fieldTier = (year, cls, w) => { const f = fieldInfo(year, cls, w); return f ? f.tier : null; };
  const fieldOf = (r) => (r.lvl && r.lvl !== 'state' ? lowerFieldTier(r.lvl, r.year, r.cls, r.unit, r.w) : fieldTier(r.year, r.cls, r.w));
  /* district / regional brackets: same idea once WR_LOWER exists — for each entrant of a district (or regional) bracket,
     sum the state points they earned that season AND their career state points in other seasons (downstream achievement),
     percentile within the same year, class and level across weights and districts/regions, four tiers. Returns null until
     the bracket archive is parsed. Bout-level path difficulty (who you actually beat) is a later layer on top of this. */
  /* district / regional bracket strength: for every medalist of the bracket, what he did downstream that season
     (regional points, state points at double weight) plus his career state points in other seasons; percentile within
     the same level, year and class across every unit and weight; four tiers. Computed on first use. */
  let LFT = null;
  const stateByYK = new Map(); APP.forEach((r) => { const k = r.year + '|' + wKey(r); stateByYK.set(k, (stateByYK.get(k) || 0) + r.pts); });
  function buildLFT() {
    LFT = new Map(); const regByYK = new Map();
    LOWER.forEach((r) => { if (r.lvl === 'regional') { const k = r.year + '|' + wKey(r); regByYK.set(k, (regByYK.get(k) || 0) + r.pts); } });
    const acc = new Map();
    LOWER.forEach((r) => { if (!r.place) return; const key = `${r.lvl}|${r.year}|${r.cls}|${r.unit}|${r.wn}`; const yk = r.year + '|' + wKey(r); const st = stateByYK.get(yk) || 0; const career = (CAREER_PTS.get(wKey(r)) || 0) - st;
      const v = 2 * st + (r.lvl === 'district' ? (regByYK.get(yk) || 0) : 0) + career; const o = acc.get(key) || acc.set(key, { year: r.year, cls: r.cls, lvl: r.lvl, unit: r.unit, w: r.w, wn: r.wn, n: 0, strength: 0, top: [], tier: null, pct: null }).get(key); o.n++; o.strength += v; if (v > 0) o.top.push({ name: r.name, sch: r.sch, other: v }); });
    acc.forEach((o) => { o.top.sort((a, b) => b.other - a.other); o.top = o.top.slice(0, 3); });
    d3.group(Array.from(acc.values()), (f) => f.lvl + '|' + f.year + '|' + f.cls).forEach((fs) => { const ok = fs.filter((f) => f.n >= 2).sort((a, b) => a.strength - b.strength); const n = ok.length; ok.forEach((f, i) => { f.pct = n > 1 ? i / (n - 1) : 0.5; f.tier = f.pct < 0.25 ? 1 : f.pct < 0.5 ? 2 : f.pct < 0.75 ? 3 : 4; }); });
    acc.forEach((o, k) => LFT.set(k, o));
  }
  const lowerFieldInfo = (lvl, year, cls, unit, w) => { if (!LFT) buildLFT(); return LFT.get(`${lvl}|${year}|${cls}|${unit}|${wNum(w)}`) || null; };
  const lowerFieldTier = (lvl, year, cls, unit, w) => { const f = lowerFieldInfo(lvl, year, cls, unit, w); return f ? f.tier : null; };
  /* adjusted points: opt-in multiplier by field tier, medal counts untouched */
  const adjMult = (r) => { if (!state.adj) return 1; const t = fieldOf(r); return t ? ADJ[t - 1] : 1; };
  const apts = (r) => r.pts * adjMult(r);
  const avgTier = (rows) => { const ts = rows.map(fieldOf).filter(Boolean); return ts.length ? d3.mean(ts) : null; };
  /* region strength per year and class: share of state medal points over share of qualifiers, percentile across regions */
  const RTIER = new Map();
  ['AAA', 'AA'].forEach((c) => d3.group(APP.filter((r) => r.cls === c), (r) => r.year).forEach((rs, year) => {
    const reg = (r) => regionOf(r, c); const tot = d3.sum(rs, (r) => r.pts) || 1, nq = rs.length || 1;
    const L = d3.rollups(rs.filter((r) => reg(r)), (v) => (d3.sum(v, (r) => r.pts) / tot) / (v.length / nq), reg).sort((a, b) => a[1] - b[1]);
    const n = L.length; L.forEach(([code, ratio], i) => { const pct = n > 1 ? i / (n - 1) : 0.5; RTIER.set(year + '|' + c + '|' + code, { ratio, pct, tier: pct < 0.25 ? 1 : pct < 0.5 ? 2 : pct < 0.75 ? 3 : 4 }); });
  }));
  const regionInfo = (year, cls, code) => RTIER.get(year + '|' + cls + '|' + code) || null;
  const regionTier = (year, cls, code) => { const x = regionInfo(year, cls, code); return x ? x.tier : null; };

  const wrestlersOf = (rows) => d3.groups(rows, wKey).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; const W = WRESTLER.get(wSlug(L.name, L.sch)); const meds = rs.filter((r) => r.place); return { name: L.name, sch: L.sch, d: rs[0].d, medals: meds.length, titles: meds.filter((r) => r.place === 1).length, pts: d3.sum(rs, apts), raw: d3.sum(rs, (r) => r.pts), field: avgTier(rs), places: placeCounts(rs), rows: meds, apps: W ? W.apps : rs, years: rs[0].year === L.year ? String(L.year) : rs[0].year + '–' + L.year, href: wrestlerHref(L) }; }).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
  const GRADE_I = { FR: 0, SO: 1, JR: 2, SR: 3 }, GRADE_L = ['FR', 'SO', 'JR', 'SR'];
  const gradeSlot = (r, apps) => { if (r.grade in GRADE_I) return GRADE_I[r.grade]; const k = apps.find((a) => a.grade in GRADE_I); if (k) return Math.max(0, Math.min(3, GRADE_I[k.grade] + (r.year - k.year))); const i = apps.indexOf(r); return Math.max(0, Math.min(3, 3 - (apps.length - 1 - i))); };
  function allTimeTeams(rows, depth = 3) {
    const cands = [];
    d3.group(rows, wKey).forEach((rs, key) => { d3.rollups(rs, (v) => ({ pts: d3.sum(v, apts), titles: v.filter((r) => r.place === 1).length, n: v.length, rows: v.slice().sort((a, b) => a.year - b.year) }), (r) => stdOf(r).k).forEach(([k, o]) => { const L = o.rows[o.rows.length - 1]; cands.push({ key, k, name: L.name, sch: L.sch, d: o.rows[0].d, pts: o.pts, titles: o.titles, n: o.n, rows: o.rows, years: o.rows[0].year === L.year ? String(L.year) : `${o.rows[0].year}–${L.year}`, href: wrestlerHref(L) }); }); });
    cands.sort((p, q) => q.pts - p.pts || q.titles - p.titles || q.n - p.n || p.rows[0].year - q.rows[0].year);
    const slots = new Map(STD.map((c) => [c.k, Array(depth).fill(null)])), held = new Map();
    cands.forEach((c) => { const S = slots.get(c.k), H = held.get(c.key) || new Set(); for (let i = 0; i < depth; i++) if (!S[i] && !H.has(i)) { S[i] = c; H.add(i); held.set(c.key, H); break; } });
    return STD.filter((c) => slots.get(c.k).some(Boolean)).map((c) => ({ c, slots: slots.get(c.k) }));
  }
  /* the bracket: a unit's children seeded by (discounted) state points in the current scope and window */
  function bracketOf(u, mode) {
    const rows = unitRows(u).filter((r) => r.place), total = d3.sum(rows, wpts) || 1;
    let items;
    if (u.kind === 'school' && mode === 'weight') items = d3.groups(rows, (r) => stdOf(r).k).map(([k, v]) => ({ name: STD.find((c) => c.k === k).label, pts: d3.sum(v, wpts), n: v.length, href: null }));
    else if (u.kind === 'school') items = wrestlersOf(careerRows(rows)).map((w) => ({ name: w.name, sub: w.years, pts: w.pts, n: w.medals, href: w.href }));
    else {
      const kind = u.kind === 'state' ? (mode === 'district' ? 'district' : 'region') : u.kind === 'region' ? 'district' : 'school';
      items = rankings(kind, u.kind === 'state' ? null : u).map((o) => ({ name: kind === 'region' ? REGIONS[o.u.id] : o.u.name, sub: kind === 'district' ? DISTRICTS[o.u.id] : kind === 'school' && u.kind !== 'district' ? 'D' + o.u.d : '', pts: o.pts, n: o.medals, href: o.u.href }));
    }
    items = items.filter((it) => it.pts > 0 && !(it.n < 3 && it.pts / total < 0.005)).sort((a, b) => b.pts - a.pts).map((it, i) => ({ ...it, seed: i + 1, share: it.pts / total }));
    return { items, total };
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
  const loadLower = (year, lvl) => { const k = year + '-' + lvl; if (LFIELD.has(k)) return Promise.resolve(LFIELD.get(k)); if (LLOAD.has(k)) return LLOAD.get(k); if (!LM.cov.some((c) => c.startsWith(`${lvl}|${year}|`))) { LFIELD.set(k, []); return Promise.resolve([]); }
    const p = fetch(`lower/${k}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((rows) => { const out = rows.map(([cls, unit, w, place, seed, name, sch, grade, record, d]) => ({ lvl, year, cls, unit, w, wn: wNum(w), place: +place || 0, seed, name, school: sch, sch, grade, record, d: d || null, region: lvl === 'regional' ? unit : dregOf(cls, year, d), pts: ptsOf(+place || 0) })); LFIELD.set(k, out); LLOAD.delete(k); return out; });
    LLOAD.set(k, p); return p; };
  function bracketField(key) {
    const k = parseBkey(key); if (!k) return null;
    let rows, loading = false;
    if (k.lvl === 'state') rows = APP.filter((r) => r.year === k.year && r.cls === k.cls && r.wn === k.wn);
    else { const full = LFIELD.get(k.year + '-' + k.lvl); if (full) rows = full.filter((r) => r.cls === k.cls && r.unit === k.unit && r.wn === k.wn); else { rows = LOWER.filter((r) => r.lvl === k.lvl && r.year === k.year && r.cls === k.cls && r.unit === k.unit && r.wn === k.wn); loading = LM.cov.includes(`${k.lvl}|${k.year}|${k.cls}|${k.unit}`); } }
    const seedN = (r) => { if (r.lvl === 'state' || !r.lvl) return seedNum(r); const m = /(\d+)\s*$/.exec(r.seed || ''); return m ? +m[1] : 99; };
    rows = rows.slice().sort((a, b) => (a.place || 99) - (b.place || 99) || seedN(a) - seedN(b) || a.name.localeCompare(b.name));
    const w = rows[0] ? rows[0].w : String(k.wn);
    const tier = k.lvl === 'state' ? fieldTier(k.year, k.cls, w) : lowerFieldTier(k.lvl, k.year, k.cls, k.unit, w);
    const info = k.lvl === 'state' ? fieldInfo(k.year, k.cls, w) : lowerFieldInfo(k.lvl, k.year, k.cls, k.unit, w);
    const adv = k.lvl === 'state' ? null : advOf(k.lvl, k.year, k.cls, k.unit, w);
    const entrants = rows.map((r) => { const W = WRESTLER.get(wSlug(r.name, r.sch)) || lowerWrestler(wSlug(r.name, r.sch)); const career = W ? W.rows.filter((x) => x.year !== r.year) : []; const sameSeason = k.lvl === 'state' ? null : (stateByYK.get(r.year + '|' + wKey(r)) ? APP.find((x) => x.year === r.year && wKey(x) === wKey(r)) : null);
      return { r, W, slug: wSlug(r.name, r.sch), career, sameSeason, adv: adv && r.place && r.place <= adv, seedLabel: r.lvl === 'state' || !r.lvl ? (r.year >= 1951 ? (r.region ? `${r.region}-${r.reg || '?'}` : (r.reg ? String(r.reg) : '')) : (r.dist ? `D${r.d}-${r.dist}` : `D${r.d}`)) : (r.seed ? String(r.seed) : '') }; });
    const src = (LM.src || {})[`${k.lvl}|${k.year}|${k.cls}|${k.unit}`] || null;
    return { ...k, key, w, tier, info, adv, loading, src, covered: k.lvl === 'state' || LM.cov.includes(`${k.lvl}|${k.year}|${k.cls}|${k.unit}`), entrants, unitLabel: k.lvl === 'state' ? 'PIAA' : unitLabel(k.lvl, k.unit), next: k.lvl === 'state' ? 'HERSHEY' : k.lvl === 'regional' ? 'TO STATES' : 'TO REGIONALS' };
  }

  /* ---- lower-level dominance: a district's (or region's, or school's) own tournament results, never mixed with state ---- */
  const lowerIn = (r) => (state.cls === 'ALL' || r.k === state.cls) && inWindow(r.year) && passFilters(r);
  const lowerUnitRows = (u, lvl) => LOWER.filter((r) => r.lvl === lvl && lowerIn(r) && (u.kind === 'district' ? r.d === u.id : u.kind === 'region' ? r.region === u.id : u.kind === 'school' ? r.sch === u.id : true));
  const LAV = new Map(); LOWER.forEach((r) => { if (!r.place) return; const cont = r.lvl === 'district' ? r.d : r.region; const k = `${r.lvl}|${r.year}|${cont}|${r.k}`; LAV.set(k, (LAV.get(k) || 0) + r.pts); });
  const lowerAvail = (lvl, year, cont) => (state.cls === 'ALL' ? ['AAA', 'AA'].reduce((a, c) => a + (LAV.get(`${lvl}|${year}|${cont}|${c}`) || 0), 0) : LAV.get(`${lvl}|${year}|${cont}|${state.cls}`) || 0);
  function lowerStats(u, lvl, rows) {
    const [, last] = yearsWindow(); const meds = rows.filter((r) => r.place); let era = 0, power = 0;
    d3.rollups(meds, (v) => ({ pts: d3.sum(v, wpts), cont: lvl === 'district' ? v[0].d : v[0].region }), (r) => r.year).forEach(([y, o]) => { const av = lowerAvail(lvl, y, o.cont); if (av) { const sh = o.pts / av; era += sh; power += sh * Math.pow(0.5, (last - y) / HALF_LIFE); } });
    const offRows = state.cls === 'ALL' ? [] : meds.filter(isOff);
    return { u, lvl, rows: meds, apps: rows, places: placeCounts(meds), medals: meds.length, titles: meds.filter((r) => r.place === 1).length, pts: Math.round(d3.sum(meds, wpts)), era: 100 * era, power: 100 * power, offMedals: offRows.length, offCls: offRows.length ? offRows[0].cls : null, offClass: OFF_CLASS, first: meds.length ? d3.min(meds, (r) => r.year) : null, last: meds.length ? d3.max(meds, (r) => r.year) : null };
  }
  const lowerRankings = (u, lvl, kind) => { const rows = lowerUnitRows(u, lvl); const g = kind === 'district' ? d3.groups(rows, (r) => r.d).filter(([d]) => d).map(([d, v]) => lowerStats(U.district(d), lvl, v)) : d3.groups(rows, (r) => r.sch).map(([s, v]) => lowerStats(U.school(s), lvl, v)); return g.filter((o) => o.medals).sort((a, b) => b.era - a.era || b.pts - a.pts); };
  const lowerTeamRows = (u, lvl) => LTEAMS.filter((t) => t.lvl === lvl && inWindow(t.year) && (state.cls === 'ALL' || t.cls === state.cls || (t.cls === 'single' && (LIN.get(t.sch) || 'AAA') === state.cls)) && (u.kind === 'district' ? (t.unit === 'D' + u.id || t.unit.startsWith('D' + u.id + '_') || t.unit.replace('D', '').split('-').includes(String(u.id)) && t.unit.includes('-')) : u.kind === 'region' ? t.unit === u.id : u.kind === 'school' ? t.sch === u.id : true));
  const lowerCoverage = (u, lvl) => { const ks = LM.cov.map((c) => c.split('|')).filter((p) => p[0] === lvl && (state.cls === 'ALL' || p[2] === state.cls || p[2] === 'single') && (u.kind === 'district' ? (p[3] === 'D' + u.id || p[3].startsWith('D' + u.id + '_') || (p[3].includes('-') && p[3].replace('D', '').split('-').includes(String(u.id)))) : u.kind === 'region' ? p[3] === u.id : true)); const ys = Array.from(new Set(ks.map((p) => +p[1]))).sort((a, b) => a - b); return { n: ks.length, years: ys, first: ys[0], last: ys[ys.length - 1] }; };
  /* a state wrestler's district and regional rows: exact key, then last name + school + season as a fallback */
  const LIDX = new Map(), LIDX2 = new Map();
  LOWER.forEach((r) => { const k = wKey(r); (LIDX.get(k) || LIDX.set(k, []).get(k)).push(r); const k2 = r.sch + '|' + r.year; (LIDX2.get(k2) || LIDX2.set(k2, []).get(k2)).push(r); });
  const lastName = (n) => String(n).replace(/\(.*?\)/g, '').trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
  const lowerFor = (apps) => { if (!apps || !apps.length) return []; const out = (LIDX.get(wKey(apps[0])) || []).slice(); const have = new Set(out.map((r) => r.lvl + '|' + r.year)); const ln = lastName(apps[0].name);
    apps.forEach((a) => (LIDX2.get(a.sch + '|' + a.year) || []).forEach((r) => { if (!have.has(r.lvl + '|' + r.year) && lastName(r.name) === ln && Math.abs(r.wn - a.wn) <= 20) { out.push(r); have.add(r.lvl + '|' + r.year); } }));
    return out.sort((a, b) => a.year - b.year || (a.lvl === 'district' ? 0 : 1) - (b.lvl === 'district' ? 0 : 1)); };
  /* wrestlers who only appear in the archive (never placed at states) still get a page */
  let LWRESTLER = null;
  const lowerWrestler = (sl) => { if (!LWRESTLER) { LWRESTLER = new Map(); d3.groups(LOWER, (r) => wSlug(r.name, r.sch)).forEach(([k, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; LWRESTLER.set(k, { name: L.name, sch: L.sch, d: rs[0].d, apps: [], rows: [], lower: rs, slug: k, lowerOnly: true }); }); } return LWRESTLER.get(sl) || null; };
  Object.assign(OT, { lowerSrc, bkey, parseBkey, bracketField, SB, LTEAMS, lowerAvail, lowerIn, lowerUnitRows, lowerStats, lowerRankings, lowerTeamRows, lowerCoverage, lowerFor, lowerWrestler, lowerLoaded, loadLower, lowerCovered, advOf, dregOf, unitLabel, lowerUnitFor, COV, setAdjust, ADJ, TIER_NAMES, fieldInfo, fieldTier, fieldOf, lowerFieldTier, lowerFieldInfo, adjMult, apts, avgTier, regionInfo, regionTier, toggleFilter, clearFilters, clearAll, nFilters, passFilters, inScopeNoWin, careerRows, OFF_CLASS, wt, wpts, isOff, homeOf, setWin, wkey, yearsWindow, inWindow, windowLabel, FIVE, regionOf, regionOrder, schoolRegion, distRegions, bracketOf, esc, slug, nkey, fmt, ordinal, canon, wShort, DISTRICTS, REGIONS, REGION_ORDER, state, setCls, clsName, PTS, APP, ROWS, YEARS, STD, stdOf, placeCounts, LOWER, lowerRows, SCHOOL_BY_SLUG, SCHOOL_D, schoolDistrict, classHistory, U, unitRows, regionsInScope, seasonOf, seasonsInScope, yearsInScope, unitStats, rankings, WRESTLER, wrestlerHref, wrestlersOf, GRADE_L, gradeSlot, allTimeTeams, unitByKind, wKey });
})();
