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
  const state = { cls: 'AAA' };
  try { const s = localStorage.getItem('ot-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* none */ }
  const setCls = (c) => { state.cls = c; try { localStorage.setItem('ot-scope', c); } catch (e) { /* none */ } STATS.clear(); RANKS.clear(); SEASONS.clear(); };
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
  /* A school belongs to every class it has wrestled in. In AAA or AA scope its seasons in that class count in full and its
     seasons in the other class still count, discounted by OFF_CLASS in Score, Era and Power (medal counts stay whole).
     So a program that moved classes appears in both rankings, weighted toward the class being viewed. Pre-1974 one-class
     rows follow lineage (the class the school later wrestled most). */
  const OFF_CLASS = 0.85; // AA results viewed in the AAA ranking
  const OFF_DOWN = 0.85;  // AAA results viewed in the AA ranking (same for now; tune separately if wanted)
  const CLASSES = new Map(); APP.forEach((r) => { if (r.cls !== 'single') (CLASSES.get(r.sch) || CLASSES.set(r.sch, new Set()).get(r.sch)).add(r.cls); });
  const classesOf = (s) => CLASSES.get(s) || CLASSES.get(SUCCESSOR[s]) || new Set([lineage(s)]);
  const HOME = new Map(); d3.groups(APP.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { HOME.set(s, rs.reduce((a, b) => (b.year > a.year ? b : a)).cls); });
  const homeOf = (s) => HOME.get(s) || HOME.get(SUCCESSOR[s]) || lineage(s);
  APP.forEach((r) => { r.k = r.cls === 'single' ? lineage(r.sch) : r.cls; r.classes = classesOf(r.sch); });
  const isOff = (r) => state.cls !== 'ALL' && r.cls !== 'single' && r.cls !== state.cls;
  const wt = (r) => (isOff(r) ? (state.cls === 'AAA' ? OFF_CLASS : OFF_DOWN) : 1);
  const wpts = (r) => r.pts * wt(r);
  const inScope = (r) => state.cls === 'ALL' || (r.cls === 'single' ? r.k === state.cls : r.classes.has(state.cls));
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

  /* school → district, school → region (majority), district → region (majority, by era) */
  const SCHOOL_D = new Map(), SCHOOL_R = new Map(), SCHOOL_BY_SLUG = new Map();
  d3.groups(APP, (r) => r.sch).forEach(([s, rs]) => {
    SCHOOL_D.set(s, d3.rollups(rs, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0]);
    const rg = d3.rollups(rs.filter((r) => r.region), (v) => v.length, (r) => r.region).sort((a, b) => b[1] - a[1]); if (rg.length) SCHOOL_R.set(s, rg[0][0]);
    SCHOOL_BY_SLUG.set(slug(s), s);
  });
  const DIST_R = new Map(); d3.groups(APP.filter((r) => r.region && r.year >= 1974), (r) => r.d).forEach(([d, rs]) => { const tot = rs.length; DIST_R.set(d, d3.rollups(rs, (v) => v.length, (r) => r.region).sort((a, b) => b[1] - a[1]).filter((x) => x[1] >= 0.05 * tot).map((x) => x[0])); });
  const schoolDistrict = (s) => SCHOOL_D.get(canon(s)) || null;
  const classHistory = (s) => { const ys = d3.rollups(APP.filter((r) => r.sch === s), (v) => v[0].cls, (r) => r.year).sort((a, b) => a[0] - b[0]); const out = []; ys.forEach(([y, c]) => { const L = out[out.length - 1]; if (L && L.cls === c) L.to = y; else out.push({ cls: c, from: y, to: y }); }); return out; };

  /* units */
  const U = {
    state: () => ({ kind: 'state', id: 'state', name: 'Pennsylvania', href: '#state' }),
    region: (code) => ({ kind: 'region', id: code, name: (REGIONS[code] || code) + ' Region', short: code, href: '#region/' + code }),
    district: (d) => ({ kind: 'district', id: +d, name: 'District ' + d, sub: DISTRICTS[d], href: '#district/' + d }),
    school: (name) => ({ kind: 'school', id: name, name, d: schoolDistrict(name), region: SCHOOL_R.get(name) || null, href: '#school/' + slug(name) }),
  };
  const inUnit = (u) => u.kind === 'state' ? () => true : u.kind === 'region' ? (r) => r.region === u.id : u.kind === 'district' ? (r) => r.d === u.id : (r) => r.sch === u.id;
  const unitRows = (u) => ROWS().filter(inUnit(u));
  const regionsInScope = () => REGION_ORDER.filter((c) => ROWS().some((r) => r.region === c));

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
      const teams = roll((r) => r.sch), dists = roll((r) => r.d), regs = roll((r) => r.region || null);
      [teams, dists, regs].forEach((L) => L.forEach((t, i) => { t.rank = i ? (t.pts === L[i - 1].pts ? L[i - 1].rank : i + 1) : 1; t.share = avail ? t.pts / avail : 0; }));
      S = { year, scope, one, cls: lc, avail, rows, meds, lineup: LINEUP.get(year + '|' + lc) || [], teams, dists, regs, by: { school: new Map(teams.map((t) => [t.id, t])), district: new Map(dists.map((t) => [t.id, t])), region: new Map(regs.map((t) => [t.id, t])) } };
      const real = scope !== 'ALL' && !one ? TEAMSCORES.get(year + '|' + scope) : null;
      if (real && real.length) { S.real = true; const by = new Map(real.map((t) => [t.sch, t])); teams.forEach((t) => { const x = by.get(t.id); t.score = x ? x.pts : 0; t.realRank = x ? x.place : null; }); teams.sort((a, b) => (b.score || 0) - (a.score || 0) || b.pts - a.pts); }
      S.champion = teams[0] || null;
    }
    SEASONS.set(key, S); return S;
  }
  const seasonsInScope = () => YEARS.map((y) => seasonOf(y)).filter(Boolean);
  const yearsInScope = () => { const s = seasonsInScope(); return [s[0].year, s[s.length - 1].year]; };

  /* unit stats: Era, Power, Score, Trend */
  const HALF_LIFE = 7, STATS = new Map();
  function unitStats(u) {
    const key = state.cls + '|' + u.kind + '|' + u.id; if (STATS.has(key)) return STATS.get(key);
    const [, last] = yearsInScope(), seasons = [];
    seasonsInScope().forEach((S) => { const t = u.kind === 'state' ? { pts: S.avail, share: 1, rank: 1, rows: S.rows, titles: S.lineup.length } : S.by[u.kind].get(u.id); if (t) seasons.push({ year: S.year, S, t, pts: t.pts, share: t.share, rank: t.rank }); });
    const apps = unitRows(u), rows = apps.filter((r) => r.place), places = placeCounts(rows);
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
      trend: 100 * (d3.sum(shares.filter((s) => s.year > last - 10), (s) => s.share) - d3.sum(shares.filter((s) => s.year <= last - 10 && s.year > last - 20), (s) => s.share)),
      spark: d3.range(last - 19, last + 1).map((y) => sh.get(y) || 0),
      regTitles: apps.filter((r) => r.reg === 1).length };
    STATS.set(key, o); return o;
  }
  const RANKS = new Map();
  /* child rankings: units of `kind` inside parent unit `p` */
  function rankings(kind, p) {
    const key = state.cls + '|' + kind + '|' + (p ? p.kind + ':' + p.id : ''); if (RANKS.has(key)) return RANKS.get(key);
    const rows = p ? unitRows(p) : ROWS(); let units;
    if (kind === 'region') units = regionsInScope().filter((c) => rows.some((r) => r.region === c)).map(U.region);
    else if (kind === 'district') units = d3.range(1, 13).filter((d) => rows.some((r) => r.d === d)).map(U.district);
    else units = Array.from(new Set(rows.filter((r) => r.place).map((r) => r.sch))).map(U.school);
    const out = units.map(unitStats).filter((o) => o.medals);
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
  /* floor hierarchy: unit → children by level, sized by (discounted) points */
  function hierarchyOf(u, mode) {
    const rows = unitRows(u).filter((r) => r.place);
    const node = (name, kind, id, rs, depth) => {
      const o = { name, kind, id, pts: d3.sum(rs, wpts), n: rs.length, places: placeCounts(rs), titles: rs.filter((r) => r.place === 1).length };
      if (depth <= 0) return o;
      let groups;
      if (kind === 'state' && mode === 'district') groups = d3.groups(rs, (r) => r.d).map(([k, v]) => node('District ' + k, 'district', k, v, depth - 1));
      else if (kind === 'state') groups = d3.groups(rs, (r) => r.region || 'pre').map(([k, v]) => node(k === 'pre' ? 'Before regions' : (REGIONS[k] || k), 'region', k === 'pre' ? null : k, v, depth - 1));
      else if (kind === 'region') groups = d3.groups(rs, (r) => r.d).map(([k, v]) => node('District ' + k, 'district', k, v, depth - 1));
      else if (kind === 'district') groups = d3.groups(rs, (r) => r.sch).map(([k, v]) => node(k, 'school', k, v, depth - 1));
      else if (kind === 'school') groups = d3.groups(rs, (r) => stdOf(r).k).map(([k, v]) => node(STD.find((c) => c.k === k).label, 'weight', k, v, depth - 1));
      else groups = d3.groups(rs, (r) => r.place).map(([k, v]) => node(ordinal(k), 'place', k, v, 0));
      o.children = groups.filter((g) => g.pts > 0).sort((a, b) => b.pts - a.pts);
      return o;
    };
    return node(u.name, u.kind, u.id, rows, u.kind === 'region' ? 2 : 1);
  }
  const unitByKind = { region: (id) => U.region(id), district: (id) => U.district(id), school: (id) => U.school(id) };

  Object.assign(OT, { OFF_CLASS, wt, wpts, isOff, homeOf, classesOf, esc, slug, nkey, fmt, ordinal, canon, wShort, DISTRICTS, REGIONS, REGION_ORDER, state, setCls, clsName, PTS, APP, ROWS, YEARS, STD, stdOf, placeCounts, LOWER, lowerRows, SCHOOL_BY_SLUG, SCHOOL_D, SCHOOL_R, DIST_R, schoolDistrict, classHistory, U, unitRows, regionsInScope, seasonOf, seasonsInScope, yearsInScope, unitStats, rankings, WRESTLER, wrestlerHref, wrestlersOf, GRADE_L, gradeSlot, allTimeTeams, hierarchyOf, unitByKind, wKey });
})();
