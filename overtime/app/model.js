/* Overtime — model. One object: an appearance (one wrestler, one season, one weight, one level).
   Levels are filters over appearances; dominance is computed per level and never mixed. */
'use strict';
const OT = (window.OT = {});
(() => {
  const RAW = window.WR_DATA, SB = window.SchoolBadge;
  const wNum = (w) => (w === 'UNL' ? 999 : +w);
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
  const state = { cls: 'AAA', win: { mode: 'all', from: null, to: null } };
  try { const s = localStorage.getItem('ot-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* none */ }
  try { const w = JSON.parse(localStorage.getItem('ot-window') || 'null'); if (w && ['all', '5', '10', '25', 'custom'].includes(w.mode)) state.win = w; } catch (e) { /* none */ }
  const clearCaches = () => { STATS.clear(); RANKS.clear(); SEASONS.clear(); WIN.clear(); SREG.clear(); DREG.clear(); };
  const setCls = (c) => { state.cls = c; try { localStorage.setItem('ot-scope', c); } catch (e) { /* none */ } clearCaches(); };
  const setWin = (w) => { state.win = { ...state.win, ...w }; try { localStorage.setItem('ot-window', JSON.stringify(state.win)); } catch (e) { /* none */ } clearCaches(); };
  const wkey = () => state.cls + '|' + state.win.mode + (state.win.mode === 'custom' ? state.win.from + '-' + state.win.to : '');
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
  const wpts = (r) => r.pts * wt(r);
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
  const inScope = (r) => (state.cls === 'ALL' || r.k === state.cls) && inWindow(r.year);
  const actualIn = (r, scope, one) => scope === 'ALL' || (one ? r.k === scope : r.cls === scope);
  const ROWS = () => APP.filter(inScope);
  const YEARS = Array.from(new Set(APP.map((r) => r.year))).sort((a, b) => a - b);
  const BY_YEAR = d3.group(APP, (r) => r.year);
  const TEAMSCORES = new Map(); (window.WR_TEAMS || []).forEach(([year, cls, place, pts, sch]) => { const k = year + '|' + cls; (TEAMSCORES.get(k) || TEAMSCORES.set(k, []).get(k)).push({ place, pts, sch: canon(sch) }); });
  const STD = [{ k: '98', label: '≤98', min: 0, max: 101 }, { k: '107', label: '107', min: 102, max: 110 }, { k: '114', label: '114', min: 111, max: 117 }, { k: '121', label: '121', min: 118, max: 124 }, { k: '127', label: '127', min: 125, max: 129 }, { k: '133', label: '133', min: 130, max: 136 }, { k: '139', label: '139', min: 137, max: 142 }, { k: '145', label: '145', min: 143, max: 148 }, { k: '152', label: '152', min: 149, max: 156 }, { k: '160', label: '160', min: 157, max: 166 }, { k: '172', label: '172', min: 167, max: 180 }, { k: '189', label: '189', min: 181, max: 200 }, { k: '215', label: '215', min: 201, max: 240 }, { k: 'HWT', label: 'Hwt', min: 241, max: 9999 }];
  const stdOf = (r) => STD.find((c) => r.wn >= c.min && r.wn <= c.max) || STD[STD.length - 1];
  const placeCounts = (rows) => { const c = [0, 0, 0, 0, 0, 0, 0, 0]; rows.forEach((r) => { if (r.place >= 1 && r.place <= 8) c[r.place - 1]++; }); return c; };

  /* lower-level appearances (district / regional brackets) — filled by the bracket parser; empty until then */
  const LOWER = (window.WR_LOWER || []).map(([lvl, year, cls, w, place, name, school, d, region]) => ({ lvl, year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d, region, pts: ptsOf(place) }));
  const lowerRows = (lvl) => LOWER.filter((r) => r.lvl === lvl);

  /* regions. In AAA or AA the five PIAA regions of that class are the only regions; rows from before 1974, from the 2021
     super-regionals, or from any other historical region are placed through their district (majority mapping for that
     class). With all classes selected the historical regions stand as they were. */
  const FIVE = ['NE', 'SE', 'SC', 'NW', 'SW'];
  const DEFAULT_REG = { 1: 'SE', 2: 'NE', 3: 'SC', 4: 'NE', 5: 'SW', 6: 'SC', 7: 'SW', 8: 'SW', 9: 'NW', 10: 'NW', 11: 'NE', 12: 'SE' };
  const DIST_MOD = { AAA: new Map(), AA: new Map() };
  ['AAA', 'AA'].forEach((c) => d3.groups(APP.filter((r) => r.cls === c && FIVE.includes(r.region)), (r) => r.d).forEach(([d, rs]) => DIST_MOD[c].set(d, d3.rollups(rs, (v) => v.length, (r) => r.region).sort((a, b) => b[1] - a[1])[0][0])));
  const modernRegion = (d, c) => DIST_MOD[c].get(d) || DIST_MOD[c === 'AAA' ? 'AA' : 'AAA'].get(d) || DEFAULT_REG[d] || null;
  const regionOf = (r, scope = state.cls) => (scope === 'ALL' ? (r.region || null) : (r.cls === scope && FIVE.includes(r.region)) ? r.region : modernRegion(r.d, scope));
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
  const wrestlersOf = (rows) => d3.groups(rows, wKey).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; const W = WRESTLER.get(wSlug(L.name, L.sch)); const meds = rs.filter((r) => r.place); return { name: L.name, sch: L.sch, d: rs[0].d, medals: meds.length, titles: meds.filter((r) => r.place === 1).length, pts: d3.sum(rs, (r) => r.pts), places: placeCounts(rs), rows: meds, apps: W ? W.apps : rs, years: rs[0].year === L.year ? String(L.year) : rs[0].year + '–' + L.year, href: wrestlerHref(L) }; }).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
  const GRADE_I = { FR: 0, SO: 1, JR: 2, SR: 3 }, GRADE_L = ['FR', 'SO', 'JR', 'SR'];
  const gradeSlot = (r, apps) => { if (r.grade in GRADE_I) return GRADE_I[r.grade]; const k = apps.find((a) => a.grade in GRADE_I); if (k) return Math.max(0, Math.min(3, GRADE_I[k.grade] + (r.year - k.year))); const i = apps.indexOf(r); return Math.max(0, Math.min(3, 3 - (apps.length - 1 - i))); };
  function allTimeTeams(rows, depth = 3) {
    const cands = [];
    d3.group(rows, wKey).forEach((rs, key) => { d3.rollups(rs, (v) => ({ pts: d3.sum(v, (r) => r.pts), titles: v.filter((r) => r.place === 1).length, n: v.length, rows: v.slice().sort((a, b) => a.year - b.year) }), (r) => stdOf(r).k).forEach(([k, o]) => { const L = o.rows[o.rows.length - 1]; cands.push({ key, k, name: L.name, sch: L.sch, d: o.rows[0].d, pts: o.pts, titles: o.titles, n: o.n, rows: o.rows, years: o.rows[0].year === L.year ? String(L.year) : `${o.rows[0].year}–${L.year}`, href: wrestlerHref(L) }); }); });
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
    else if (u.kind === 'school') items = wrestlersOf(rows).map((w) => ({ name: w.name, sub: w.years, pts: w.pts, n: w.medals, href: w.href }));
    else {
      const kind = u.kind === 'state' ? (mode === 'district' ? 'district' : 'region') : u.kind === 'region' ? 'district' : 'school';
      items = rankings(kind, u.kind === 'state' ? null : u).map((o) => ({ name: kind === 'region' ? REGIONS[o.u.id] : o.u.name, sub: kind === 'district' ? DISTRICTS[o.u.id] : kind === 'school' && u.kind !== 'district' ? 'D' + o.u.d : '', pts: o.pts, n: o.medals, href: o.u.href }));
    }
    items = items.filter((it) => it.pts > 0 && !(it.n < 3 && it.pts / total < 0.005)).sort((a, b) => b.pts - a.pts).map((it, i) => ({ ...it, seed: i + 1, share: it.pts / total }));
    return { items, total };
  }
  const unitByKind = { region: (id) => U.region(id), district: (id) => U.district(id), school: (id) => U.school(id) };

  Object.assign(OT, { SB, OFF_CLASS, wt, wpts, isOff, homeOf, setWin, wkey, yearsWindow, inWindow, windowLabel, FIVE, regionOf, regionOrder, schoolRegion, distRegions, bracketOf, esc, slug, nkey, fmt, ordinal, canon, wShort, DISTRICTS, REGIONS, REGION_ORDER, state, setCls, clsName, PTS, APP, ROWS, YEARS, STD, stdOf, placeCounts, LOWER, lowerRows, SCHOOL_BY_SLUG, SCHOOL_D, schoolDistrict, classHistory, U, unitRows, regionsInScope, seasonOf, seasonsInScope, yearsInScope, unitStats, rankings, WRESTLER, wrestlerHref, wrestlersOf, GRADE_L, gradeSlot, allTimeTeams, unitByKind, wKey });
})();
