/* PA Wrestling Almanac: data model and scoring.
   Success is counted in medals. Every state place earns points (16, 12, 9, 7, 5, 3, 2, 1 for 1st–8th).
   All-time = a program's share of the points available each season, summed, x100.
   Now = the same with a seven-season half-life. */
'use strict';
const RAW = window.WR_DATA, SB = window.SchoolBadge;

/* ---------- helpers ---------- */
const wNum = (w) => (w === 'UNL' ? 999 : +w);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const fmt = d3.format(',');
const fmt1 = d3.format(',.1f');
const pct0 = d3.format('.0%'), pct1 = d3.format('.1%');
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const canon = (s) => { const id = SB && SB.identity(s); return id ? id.school : s; };
const wLabel = (w) => (w === 'UNL' ? 'Unlimited' : w === 'HWT' ? 'Heavyweight' : w + ' lb');
const wShort = (w) => (w === 'UNL' ? 'Unl' : w === 'HWT' ? 'Hwt' : String(w));

/* ---------- districts ---------- */
const DISTRICTS = {
  1: { short: 'Southeast', long: 'Philadelphia suburbs: Bucks, Chester, Delaware and Montgomery' },
  2: { short: 'Scranton–Wilkes-Barre', long: 'Wyoming Valley, Scranton and the northeast corner' },
  3: { short: 'South Central', long: 'Harrisburg, Lancaster, York, Reading and the Cumberland Valley' },
  4: { short: 'North Central', long: 'Williamsport and the Susquehanna Valley' },
  5: { short: 'Bedford–Somerset', long: 'Bedford, Fulton and Somerset counties' },
  6: { short: 'Central', long: 'State College, Altoona, Johnstown and the central mountains' },
  7: { short: 'WPIAL', long: 'Western Pennsylvania: Pittsburgh’s suburbs and surrounding counties' },
  8: { short: 'Pittsburgh City', long: 'Pittsburgh City League' },
  9: { short: 'Northwest Central', long: 'Clarion, Elk, Jefferson, McKean and the north woods' },
  10: { short: 'Northwest', long: 'Erie, Crawford, Mercer, Venango and Warren' },
  11: { short: 'Lehigh Valley', long: 'Lehigh Valley, the Poconos and Schuylkill County' },
  12: { short: 'Philadelphia', long: 'Philadelphia Public and Catholic leagues' }
};

/* ---------- scope: Class AAA, Class AA, or all of it ----------
   Before 1974 every school wrestled in one class. Those seasons count toward AAA or AA
   by the class each school wrestled in afterwards (or its successor's, for closed schools). */
const state = { cls: 'AAA', pick: null };
try { const s = localStorage.getItem('pawa-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* storage unavailable */ }
const setCls = (c) => { state.cls = c; try { localStorage.setItem('pawa-scope', c); } catch (e) { /* ignore */ } };
const clsName = (c = state.cls) => (c === 'ALL' ? 'all classes' : c === 'single' ? 'the one-class era' : 'Class ' + c);
const clsShort = (c = state.cls) => (c === 'single' ? '1938–73' : c === 'ALL' ? 'All' : c);
const classLabel = (c) => (c === 'single' ? 'One class' : 'Class ' + c);

/* ---------- rows: every place winner, champions filling any gap ---------- */
const CH = RAW.champs.concat(window.WR_CHAMP_FILL || []).map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), place: 1, name, school, sch: canon(school), d }));
const LINEUP = new Map(); // year|cls -> [{w, wn}] lightest first
d3.group(CH, (r) => r.year + '|' + r.cls).forEach((rs, k) => LINEUP.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => ({ w: r.w, wn: r.wn }))));
const MED = (window.WR_MEDALS || []).map(([year, cls, w, place, name, school, d]) => ({ year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d }));
{ const have = new Set(MED.filter((r) => r.place === 1).map((r) => r.year + '|' + r.cls + '|' + r.wn)); CH.forEach((r) => { if (!have.has(r.year + '|' + r.cls + '|' + r.wn)) MED.push({ ...r, filled: true }); }); }
MED.forEach((r) => { const L = LINEUP.get(r.year + '|' + r.cls) || []; let i = L.findIndex((o) => o.wn === r.wn); if (i < 0) i = L.findIndex((o) => o.wn >= r.wn); if (i < 0) i = L.length - 1; r.slot = Math.max(0, i); r.n = L.length || 1; });
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
const ptsOf = (p) => PTS[p - 1] || 0;
MED.forEach((r) => { r.pts = ptsOf(r.place); });
const SUCCESSOR = { Canonsburg: 'Canon-McMillan', 'Forty Fort': 'Wyoming Valley West', Kingston: 'Wyoming Valley West', Plymouth: 'Wyoming Valley West', Philipsburg: 'Philipsburg-Osceola', Allentown: 'William Allen', 'Chartiers Township': 'Chartiers-Houston', Boswell: 'North Star', Carnegie: 'Carlynton', 'Manheim Borough': 'Manheim Central', Greensburg: 'Greensburg Salem', Latrobe: 'Greater Latrobe', Lansdowne: 'Penn Wood' };
const LIN = new Map();
d3.groups(MED.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { const c = d3.rollups(rs, (v) => ({ n: v.length, last: d3.max(v, (r) => r.year) }), (r) => r.cls).sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last); LIN.set(s, c[0][0]); });
const lineage = (s) => LIN.get(s) || LIN.get(SUCCESSOR[s]) || 'AAA';
MED.forEach((r) => { r.k = r.cls === 'single' ? lineage(r.sch) : r.cls; });
const inScope = (r) => state.cls === 'ALL' || r.k === state.cls;
const ROWS = () => MED.filter(inScope);
const YEARS = Array.from(new Set(MED.map((r) => r.year))).sort((a, b) => a - b);
const BY_YEAR = d3.group(MED, (r) => r.year);

/* ---------- standard weight classes: drift of a few pounds is filed under today's class ---------- */
const STD = [
  { k: '98', label: '≤98', note: 'retired after 1988; also the 85 and 95 lb classes of the 1930s–50s', min: 0, max: 101 },
  { k: '107', label: '107', min: 102, max: 110 }, { k: '114', label: '114', min: 111, max: 117 }, { k: '121', label: '121', min: 118, max: 124 },
  { k: '127', label: '127', min: 125, max: 129 }, { k: '133', label: '133', min: 130, max: 136 }, { k: '139', label: '139', min: 137, max: 142 },
  { k: '145', label: '145', min: 143, max: 148 }, { k: '152', label: '152', min: 149, max: 156 }, { k: '160', label: '160', min: 157, max: 166 },
  { k: '172', label: '172', min: 167, max: 180 }, { k: '189', label: '189', min: 181, max: 200 }, { k: '215', label: '215', min: 201, max: 240 },
  { k: 'HWT', label: 'Hwt', note: '250, 275, 285 and unlimited', min: 241, max: 9999 }
];
const stdOf = (r) => STD.find((c) => r.wn >= c.min && r.wn <= c.max) || STD[STD.length - 1];

/* ---------- seasons and team races, per year and scope ----------
   A season's points available are the whole tournament's: both classes under All, the one
   class before 1974. So a share is always a share of what was really on offer. */
const SEASONS = new Map();
function seasonOf(year, scope = state.cls) {
  const key = year + '|' + scope;
  if (SEASONS.has(key)) return SEASONS.get(key);
  const yr = BY_YEAR.get(year) || [];
  const one = yr.length && yr[0].cls === 'single';
  const rows = scope === 'ALL' ? yr : yr.filter((r) => r.k === scope);
  let S = null;
  if (rows.length) {
    const lc = one ? 'single' : scope === 'ALL' ? 'AAA' : scope;
    const avail = d3.sum(scope === 'ALL' || one ? yr : rows, (r) => r.pts);
    const roll = (key) => Array.from(d3.rollup(rows, (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v), n: v.length, titles: v.filter((r) => r.place === 1).length, d: v[0].d, rows: v.slice().sort((a, b) => a.slot - b.slot || a.place - b.place) }), key)).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
    const teams = roll((r) => r.sch), dists = roll((r) => r.d);
    [teams, dists].forEach((L) => L.forEach((t, i) => { t.rank = i ? (t.pts === L[i - 1].pts ? L[i - 1].rank : i + 1) : 1; t.share = avail ? t.pts / avail : 0; }));
    S = { year, scope, one, cls: lc, avail, rows, places: d3.max(yr, (r) => r.place), lineup: LINEUP.get(year + '|' + lc) || [], teams, dists, teamBy: new Map(teams.map((t) => [t.id, t])), distBy: new Map(dists.map((t) => [t.id, t])) };
  }
  SEASONS.set(key, S);
  return S;
}
/* what a season page shows: the one-class field before 1974, else each class in scope */
const boardsFor = (year) => { const yr = BY_YEAR.get(year) || []; if (!yr.length) return []; if (yr[0].cls === 'single') return [seasonOf(year, 'ALL')]; return (state.cls === 'ALL' ? ['AAA', 'AA'] : [state.cls]).map((c) => seasonOf(year, c)).filter(Boolean); };
function placeCounts(rows) { const c = [0, 0, 0, 0, 0, 0, 0, 0]; rows.forEach((r) => { if (r.place >= 1 && r.place <= 8) c[r.place - 1]++; }); return c; }
const seasonsInScope = () => YEARS.map((y) => seasonOf(y)).filter(Boolean);
const yearsInScope = () => { const s = seasonsInScope(); return s.length ? [s[0].year, s[s.length - 1].year] : [0, 0]; };

/* ---------- units: a school or a district ---------- */
const HALF_LIFE = 7;
const lastYear = () => yearsInScope()[1];
const unitKey = (u) => (u.kind === 'district' ? +u.d : u.name);
const inUnit = (u) => (u.kind === 'district' ? (r) => r.d === u.d : (r) => r.sch === u.name);
const STATS = new Map();
function unitStats(u) {
  const key = state.cls + '|' + u.kind + '|' + unitKey(u);
  if (STATS.has(key)) return STATS.get(key);
  const last = lastYear(), seasons = [];
  seasonsInScope().forEach((S) => { const t = (u.kind === 'district' ? S.distBy : S.teamBy).get(unitKey(u)); if (t) seasons.push({ year: S.year, S, t, pts: t.pts, share: t.share, rank: t.rank }); });
  const rows = seasons.flatMap((s) => s.t.rows);
  const places = placeCounts(rows);
  const o = {
    u, seasons, rows, places, medals: rows.length, titles: places[0], pts: d3.sum(seasons, (s) => s.pts),
    allTime: 100 * d3.sum(seasons, (s) => s.share),
    now: 100 * d3.sum(seasons, (s) => s.share * Math.pow(0.5, (last - s.year) / HALF_LIFE)),
    won: seasons.filter((s) => s.rank === 1).length,
    best: seasons.length ? seasons.reduce((m, s) => (s.share > m.share ? s : m)) : null,
    first: seasons.length ? seasons[0].year : null, last: seasons.length ? seasons[seasons.length - 1].year : null,
    recent: placeCounts(rows.filter((r) => r.year > last - HALF_LIFE)),
    trend: 100 * (d3.sum(seasons.filter((s) => s.year > last - 10), (s) => s.share) - d3.sum(seasons.filter((s) => s.year <= last - 10 && s.year > last - 20), (s) => s.share)),
    spark: d3.range(last - 19, last + 1).map((y) => { const s = seasons.find((x) => x.year === y); return s ? s.share : 0; })
  };
  STATS.set(key, o);
  return o;
}
const RANKS = new Map();
function rankings(kind) {
  const key = state.cls + '|' + kind;
  if (RANKS.has(key)) return RANKS.get(key);
  const units = kind === 'district' ? d3.range(1, 13).map((d) => ({ kind: 'district', d, name: `District ${d}` })) : Array.from(new Set(ROWS().map((r) => r.sch))).map((name) => ({ kind: 'school', name, d: schoolDistrict(name) }));
  const out = units.map(unitStats).filter((o) => o.medals);
  out.slice().sort((a, b) => b.allTime - a.allTime).forEach((o, i) => { o.allRank = i + 1; });
  out.slice().sort((a, b) => b.now - a.now).forEach((o, i) => { o.nowRank = i + 1; });
  out.sort((a, b) => b.allTime - a.allTime);
  RANKS.set(key, out);
  return out;
}

/* ---------- schools ---------- */
const SCHOOL_D = new Map(), SCHOOL_BY_SLUG = new Map();
d3.groups(MED.concat((RAW.d11 || []).map(([year, w, name, school]) => ({ sch: canon(school), d: 11, year }))), (r) => r.sch).forEach(([s, rs]) => {
  const d = d3.rollups(rs, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0];
  SCHOOL_D.set(s, d); SCHOOL_BY_SLUG.set(slug(s), s);
});
const schoolDistrict = (s) => SCHOOL_D.get(canon(s)) || null;
const schoolHref = (s) => '#school/' + slug(canon(s));
/* the classes a school has wrestled in, as runs of seasons: [{cls, from, to}] */
const classHistory = (s) => { const ys = d3.rollups(MED.filter((r) => r.sch === s), (v) => v[0].cls, (r) => r.year).sort((a, b) => a[0] - b[0]); const out = []; ys.forEach(([y, c]) => { const L = out[out.length - 1]; if (L && L.cls === c) L.to = y; else out.push({ cls: c, from: y, to: y }); }); return out; };

/* ---------- wrestlers ---------- */
const wKey = (r) => nkey(r.name) + '|' + r.sch;
const wSlug = (name, sch) => slug(name) + '--' + slug(sch);
const WRESTLER = new Map(); // slug -> {name, sch, d, rows}
d3.groups(MED, wKey).forEach(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; WRESTLER.set(wSlug(L.name, L.sch), { name: L.name, sch: L.sch, d: rs[0].d, rows: rs }); });
const wrestlerHref = (r) => '#wrestler/' + wSlug(r.name, r.sch);
const wrestlersOf = (rows) => d3.groups(rows, (r) => nkey(r.name) + '|' + r.sch).map(([, rs]) => {
  rs.sort((a, b) => a.year - b.year);
  return { name: rs[rs.length - 1].name, school: rs[rs.length - 1].sch, d: rs[0].d, n: rs.length, titles: rs.filter((r) => r.place === 1).length, best: d3.min(rs, (r) => r.place), pts: d3.sum(rs, (r) => r.pts), rows: rs };
}).sort((a, b) => b.pts - a.pts || b.titles - a.titles);

/* ---------- weight: share of each class's points ---------- */
function weightShares(rows, pool) {
  const poolBy = d3.rollup(pool, (v) => d3.sum(v, (r) => r.pts), (r) => stdOf(r).k);
  const total = d3.sum(pool, (r) => r.pts) || 1, mine = d3.sum(rows, (r) => r.pts);
  return {
    overall: mine / total,
    classes: STD.filter((c) => poolBy.get(c.k)).map((c) => {
      const rs = rows.filter((r) => stdOf(r).k === c.k), poolPts = poolBy.get(c.k) || 1;
      const byPlace = d3.range(1, 9).map((p) => d3.sum(rs.filter((r) => r.place === p), (r) => r.pts) / poolPts);
      return { c, share: d3.sum(rs, (r) => r.pts) / poolPts, byPlace, places: placeCounts(rs), rows: rs, poolPts };
    })
  };
}

/* ---------- finals: 1st vs 2nd at each weight ---------- */
const FINALS = (() => { const out = []; d3.group(MED, (r) => r.year + '|' + r.cls + '|' + r.wn).forEach((rs) => { const w = rs.find((r) => r.place === 1), l = rs.find((r) => r.place === 2); if (w && l) out.push({ year: w.year, cls: w.cls, w: w.w, wn: w.wn, win: w, lose: l }); }); return out.sort((a, b) => a.year - b.year || a.wn - b.wn); })();

/* ---------- team titles (Class AAA) and District 11 history ---------- */
const TEAMS = (RAW.teams || []).map(([year, type, school, d, runner, tie]) => ({ year, type, school, sch: canon(school), d, runner, tie }));
const D11 = (RAW.d11 || []).map(([year, w, name, school]) => ({ year, w, wn: wNum(w), name, school, sch: canon(school) }));
const REG = (RAW.reg || []).map(([year, w, name, school, d]) => ({ year, w, wn: wNum(w), name, school, sch: canon(school), d: +d }));
