/* PA Wrestling Almanac, second concept: The Path. Every result is a step on one path, District → Regional → State. */
'use strict';
const RAW = window.WR_DATA, SB = window.SchoolBadge, MAP = window.PA_MAP;
const wNum = (w) => (w === 'UNL' ? 999 : +w);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const fmt = d3.format(','), pct0 = d3.format('.0%'), pct1 = d3.format('.1%');
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const wLabel = (w) => (w === 'UNL' ? 'Unlimited' : w === 'HWT' ? 'Heavyweight' : w + ' lb');
const wShort = (w) => (w === 'UNL' ? 'Unl' : w === 'HWT' ? 'Hwt' : String(w));
const scoreFmt = (v) => (v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1));
const DISTRICTS = { 1: 'Southeast', 2: 'Scranton–Wilkes-Barre', 3: 'South Central', 4: 'North Central', 5: 'Bedford–Somerset', 6: 'Central', 7: 'WPIAL', 8: 'Pittsburgh City', 9: 'Northwest Central', 10: 'Northwest', 11: 'Lehigh Valley', 12: 'Philadelphia' };
const REGIONS = { NE: 'Northeast', SE: 'Southeast', SW: 'Southwest', NW: 'Northwest', SC: 'South Central', W: 'West', E: 'East', CNW: 'Central Northwest' };

/* ================= scope ================= */
const state = { cls: 'AAA', year: null, pick: null };
try { const s = localStorage.getItem('path-scope'); if (['AAA', 'AA', 'ALL'].includes(s)) state.cls = s; } catch (e) { /* none */ }
const setCls = (c) => { state.cls = c; try { localStorage.setItem('path-scope', c); } catch (e) { /* none */ } };
const clsName = (c = state.cls) => (c === 'ALL' ? 'all classes' : 'Class ' + c);
const classLabel = (c) => (c === 'single' ? 'One class' : 'Class ' + c);

/* ================= appearances: one wrestler, one season, one weight ================= */
const PTS = [16, 12, 9, 7, 5, 3, 2, 1], ptsOf = (p) => PTS[p - 1] || 0;
const SEEDS = window.WR_SEEDS || {}, GRADES = window.WR_GRADES || {};
const CH = RAW.champs.concat(window.WR_CHAMP_FILL || []).map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), place: 1, name, school, sch: canon(school), d }));
const LINEUP = new Map(); d3.group(CH, (r) => r.year + '|' + r.cls).forEach((rs, k) => LINEUP.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => ({ w: r.w, wn: r.wn }))));
const APP = (window.WR_MEDALS || []).map(([year, cls, w, place, name, school, d]) => ({ year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d }));
{ const have = new Set(APP.filter((r) => r.place === 1).map((r) => r.year + '|' + r.cls + '|' + r.wn)); CH.forEach((r) => { if (!have.has(r.year + '|' + r.cls + '|' + r.wn)) APP.push({ ...r }); }); }
(window.WR_QUAL || []).forEach(([year, cls, w, name, school, d, grade]) => APP.push({ year, cls, w, wn: wNum(w), place: 0, name, school, sch: canon(school), d, grade }));
APP.forEach((r) => {
  r.pts = ptsOf(r.place);
  r.grade = r.grade || GRADES[r.year + '|' + r.cls + '|' + nkey(r.name)] || '';
  const sd = SEEDS[r.year + '|' + r.cls + '|' + nkey(r.name)];
  // the state seed is the regional place (1951 on) or the district place (before 1951)
  if (sd) { if (r.year >= 1951) { r.reg = sd[0]; r.region = sd[1]; } else { r.dist = sd[0]; r.distKnown = true; } }
  if (r.year >= 1951 && r.reg) { r.dist = r.reg <= 2 ? 1 : r.reg <= 4 ? 2 : 3; r.distEst = true; } // placeholder until district brackets load
  const L = LINEUP.get(r.year + '|' + r.cls) || []; let i = L.findIndex((o) => o.wn === r.wn); if (i < 0) i = L.findIndex((o) => o.wn >= r.wn); if (i < 0) i = L.length - 1; r.slot = Math.max(0, i);
});
const SUCCESSOR = { Canonsburg: 'Canon-McMillan', 'Forty Fort': 'Wyoming Valley West', Kingston: 'Wyoming Valley West', Plymouth: 'Wyoming Valley West', Philipsburg: 'Philipsburg-Osceola', 'Chartiers Township': 'Chartiers-Houston', Boswell: 'North Star', Carnegie: 'Carlynton', 'Manheim Borough': 'Manheim Central', Greensburg: 'Greensburg Salem', Latrobe: 'Greater Latrobe', Lansdowne: 'Penn Wood' };
const LIN = new Map(); d3.groups(APP.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => { const c = d3.rollups(rs, (v) => v.length, (r) => r.cls).sort((a, b) => b[1] - a[1]); LIN.set(s, c[0][0]); });
const lineage = (s) => LIN.get(s) || LIN.get(SUCCESSOR[s]) || 'AAA';
APP.forEach((r) => { r.k = r.cls === 'single' ? lineage(r.sch) : r.cls; });
const inScope = (r) => state.cls === 'ALL' || r.k === state.cls;
const ROWS = () => APP.filter(inScope), MEDS = () => ROWS().filter((r) => r.place);
const YEARS = Array.from(new Set(APP.map((r) => r.year))).sort((a, b) => a - b);
const BY_YEAR = d3.group(APP, (r) => r.year);
const TEAMSCORES = new Map(); (window.WR_TEAMS || []).forEach(([year, cls, place, pts, sch]) => { const k = year + '|' + cls; (TEAMSCORES.get(k) || TEAMSCORES.set(k, []).get(k)).push({ place, pts, sch: canon(sch) }); });
const TEAMS = (RAW.teams || []).map(([year, type, school, d, runner, tie]) => ({ year, type, school, sch: canon(school), d, runner, tie }));
const STD = [{ k: '98', label: '≤98', min: 0, max: 101 }, { k: '107', label: '107', min: 102, max: 110 }, { k: '114', label: '114', min: 111, max: 117 }, { k: '121', label: '121', min: 118, max: 124 }, { k: '127', label: '127', min: 125, max: 129 }, { k: '133', label: '133', min: 130, max: 136 }, { k: '139', label: '139', min: 137, max: 142 }, { k: '145', label: '145', min: 143, max: 148 }, { k: '152', label: '152', min: 149, max: 156 }, { k: '160', label: '160', min: 157, max: 166 }, { k: '172', label: '172', min: 167, max: 180 }, { k: '189', label: '189', min: 181, max: 200 }, { k: '215', label: '215', min: 201, max: 240 }, { k: 'HWT', label: 'Hwt', min: 241, max: 9999 }];
const stdOf = (r) => STD.find((c) => r.wn >= c.min && r.wn <= c.max) || STD[STD.length - 1];
const placeCounts = (rows) => { const c = [0, 0, 0, 0, 0, 0, 0, 0]; rows.forEach((r) => { if (r.place >= 1 && r.place <= 8) c[r.place - 1]++; }); return c; };

/* ================= seasons ================= */
const SEASONS = new Map();
function seasonOf(year, scope = state.cls) {
  const key = year + '|' + scope; if (SEASONS.has(key)) return SEASONS.get(key);
  const yr = BY_YEAR.get(year) || [], one = yr.length && yr[0].cls === 'single';
  const rows = (scope === 'ALL' ? yr : yr.filter((r) => r.k === scope)), meds = rows.filter((r) => r.place);
  let S = null;
  if (meds.length) {
    const lc = one ? 'single' : scope === 'ALL' ? 'AAA' : scope, avail = d3.sum(scope === 'ALL' || one ? yr : rows, (r) => r.pts);
    const roll = (key) => Array.from(d3.rollup(rows, (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v), n: v.filter((r) => r.place).length, q: v.filter((r) => !r.place).length, titles: v.filter((r) => r.place === 1).length, d: v[0].d, rows: v.slice().sort((a, b) => a.slot - b.slot || a.place - b.place) }), key)).map(([id, o]) => ({ id, ...o })).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
    const teams = roll((r) => r.sch), dists = roll((r) => r.d);
    [teams, dists].forEach((L) => L.forEach((t, i) => { t.rank = i ? (t.pts === L[i - 1].pts ? L[i - 1].rank : i + 1) : 1; t.share = avail ? t.pts / avail : 0; }));
    S = { year, scope, one, cls: lc, avail, rows, meds, places: d3.max(yr, (r) => r.place), lineup: LINEUP.get(year + '|' + lc) || [], teams, dists, teamBy: new Map(teams.map((t) => [t.id, t])), distBy: new Map(dists.map((t) => [t.id, t])) };
    const real = scope !== 'ALL' && !one ? TEAMSCORES.get(year + '|' + scope) : null;
    if (real && real.length) { S.real = true; const by = new Map(real.map((t) => [t.sch, t])); teams.forEach((t) => { const x = by.get(t.id); t.score = x ? x.pts : 0; t.realRank = x ? x.place : null; }); teams.sort((a, b) => (b.score || 0) - (a.score || 0) || b.pts - a.pts); }
  }
  SEASONS.set(key, S); return S;
}
const seasonsInScope = () => YEARS.map((y) => seasonOf(y)).filter(Boolean);
const yearsInScope = () => { const s = seasonsInScope(); return [s[0].year, s[s.length - 1].year]; };
const boardsFor = (year) => { const yr = BY_YEAR.get(year) || []; if (!yr.length) return []; if (yr[0].cls === 'single') return [seasonOf(year, 'ALL')]; return (state.cls === 'ALL' ? ['AAA', 'AA'] : [state.cls]).map((c) => seasonOf(year, c)).filter(Boolean); };

/* ================= units ================= */
const HALF_LIFE = 7;
const unitKey = (u) => (u.kind === 'district' ? +u.d : u.name);
const inUnit = (u) => (u.kind === 'district' ? (r) => r.d === u.d : u.kind === 'school' ? (r) => r.sch === u.name : () => true);
const STATS = new Map();
function unitStats(u) {
  const key = state.cls + '|' + u.kind + '|' + unitKey(u); if (STATS.has(key)) return STATS.get(key);
  const [a, last] = yearsInScope(), seasons = [];
  seasonsInScope().forEach((S) => { const t = u.kind === 'state' ? { pts: S.avail, share: 1, rank: 1, rows: S.rows } : (u.kind === 'district' ? S.distBy : S.teamBy).get(unitKey(u)); if (t) seasons.push({ year: S.year, S, t, pts: t.pts, share: t.share, rank: t.rank }); });
  const apps = ROWS().filter(inUnit(u)), rows = apps.filter((r) => r.place), places = placeCounts(rows);
  const o = { u, seasons, apps, rows, places, medals: rows.length, titles: places[0], pts: d3.sum(rows, (r) => r.pts), quals: apps.length,
    allTime: 100 * d3.sum(seasons, (s) => s.share), now: 100 * d3.sum(seasons, (s) => s.share * Math.pow(0.5, (last - s.year) / HALF_LIFE)),
    won: seasons.filter((s) => (s.t.realRank ? s.t.realRank === 1 : s.rank === 1)).length,
    first: apps.length ? d3.min(apps, (r) => r.year) : null, last: apps.length ? d3.max(apps, (r) => r.year) : null,
    recent: placeCounts(rows.filter((r) => r.year > last - HALF_LIFE)),
    trend: 100 * (d3.sum(seasons.filter((s) => s.year > last - 10), (s) => s.share) - d3.sum(seasons.filter((s) => s.year <= last - 10 && s.year > last - 20), (s) => s.share)),
    spark: d3.range(last - 19, last + 1).map((y) => { const s = seasons.find((x) => x.year === y); return s ? s.share : 0; }),
    regTitles: apps.filter((r) => r.reg === 1).length, finals: rows.filter((r) => r.place <= 2).length };
  o.qrate = o.quals ? o.medals / o.quals : null;
  STATS.set(key, o); return o;
}
const RANKS = new Map();
function rankings(kind) {
  const key = state.cls + '|' + kind; if (RANKS.has(key)) return RANKS.get(key);
  const units = kind === 'district' ? d3.range(1, 13).map((d) => ({ kind: 'district', d, name: 'District ' + d })) : Array.from(new Set(MEDS().map((r) => r.sch))).map((name) => ({ kind: 'school', name, d: schoolDistrict(name) }));
  const out = units.map(unitStats).filter((o) => o.medals);
  out.slice().sort((a, b) => b.allTime - a.allTime).forEach((o, i) => { o.allRank = i + 1; });
  out.slice().sort((a, b) => b.now - a.now).forEach((o, i) => { o.nowRank = i + 1; });
  out.sort((a, b) => b.allTime - a.allTime); RANKS.set(key, out); return out;
}
const SCHOOL_D = new Map(), SCHOOL_BY_SLUG = new Map();
d3.groups(APP, (r) => r.sch).forEach(([s, rs]) => { SCHOOL_D.set(s, d3.rollups(rs, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0]); SCHOOL_BY_SLUG.set(slug(s), s); });
const schoolDistrict = (s) => SCHOOL_D.get(canon(s)) || null;
const schoolHref = (s) => '#program/' + slug(canon(s));
const classHistory = (s) => { const ys = d3.rollups(APP.filter((r) => r.sch === s), (v) => v[0].cls, (r) => r.year).sort((a, b) => a[0] - b[0]); const out = []; ys.forEach(([y, c]) => { const L = out[out.length - 1]; if (L && L.cls === c) L.to = y; else out.push({ cls: c, from: y, to: y }); }); return out; };

/* ================= wrestlers ================= */
const wKey = (r) => nkey(r.name) + '|' + r.sch, wSlug = (n, s) => slug(n) + '--' + slug(s);
const WRESTLER = new Map();
d3.groups(APP, wKey).forEach(([, all]) => { all.sort((a, b) => a.year - b.year); const L = all[all.length - 1]; WRESTLER.set(wSlug(L.name, L.sch), { name: L.name, sch: L.sch, d: all[0].d, apps: all, rows: all.filter((r) => r.place) }); });
const wrestlerHref = (r) => '#wrestler/' + wSlug(r.name, r.sch);
const wrestlersOf = (rows) => d3.groups(rows, wKey).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); const L = rs[rs.length - 1]; const W = WRESTLER.get(wSlug(L.name, L.sch)); return { name: L.name, school: L.sch, sch: L.sch, d: rs[0].d, n: rs.filter((r) => r.place).length, titles: rs.filter((r) => r.place === 1).length, pts: d3.sum(rs, (r) => r.pts), rows: rs.filter((r) => r.place), apps: W ? W.apps : rs }; }).filter((w) => w.n).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
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
const FINALS = (() => { const out = []; d3.group(APP.filter((r) => r.place), (r) => r.year + '|' + r.cls + '|' + r.wn).forEach((rs) => { const w = rs.find((r) => r.place === 1), l = rs.find((r) => r.place === 2); if (w && l) out.push({ year: w.year, cls: w.cls, w: w.w, win: w, lose: l }); }); return out; })();

/* ================= pieces ================= */
const METALS = [null, { name: 'Gold', hi: '#fbe7a1', mid: '#d4a33a', lo: '#7d5a12', ink: '#4a3306' }, { name: 'Silver', hi: '#fbfcfd', mid: '#c3cad1', lo: '#6b737c', ink: '#2f353b' }, { name: 'Bronze', hi: '#f0c79c', mid: '#b0773f', lo: '#5f3a17', ink: '#3a220c' }, { name: 'Copper', hi: '#ffb69b', mid: '#c4593a', lo: '#6e2614', ink: '#3d130a' }, { name: 'Steel', hi: '#b8bfc6', mid: '#69717a', lo: '#33383e', ink: '#f1f3f5' }];
const metal = (p) => METALS[Math.min(p, 5)];
(function defs() { const el = document.createElement('div'); el.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${METALS.slice(1).map((m, i) => `<radialGradient id="m${i + 1}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="${m.hi}"/><stop offset=".58" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></radialGradient>`).join('')}</defs></svg>`; document.body.prepend(el.firstChild); })();
const medal = (p, size = 18, title, text) => `<svg class="md" width="${size}" height="${size}" viewBox="0 0 20 20" role="img" aria-label="${title || ordinal(p) + ' place'}"><circle cx="10" cy="10" r="9.3" fill="url(#m${Math.min(p, 5)})"/><circle cx="10" cy="10" r="7" fill="none" stroke="${metal(p).lo}" stroke-opacity=".5" stroke-width=".7"/><text x="10" y="10" dy=".36em" text-anchor="middle" fill="${metal(p).ink}"${text && text.length > 1 ? ' font-size="8.5"' : ''}>${text || p}</text></svg>`;
const qpill = (size = 16, title = 'State qualifier') => `<span class="qp" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.6)}px" role="img" aria-label="${title}">Q</span>`;
const shelf = (c, opts = {}) => { const g = c.slice(0, 4).concat([d3.sum(c.slice(4))]); return `<span class="shelf${opts.compact ? ' compact' : ''}">${g.map((n, i) => (n || opts.zeros ? `<span class="sh${n ? '' : ' zero'}" title="${n} × ${i < 4 ? ordinal(i + 1) : '5th–8th'}">${medal(i + 1, opts.size || 16, null, i < 4 ? null : '5+')}<b>${n}</b></span>` : '')).join('')}</span>`; };
const spark = (vals, w = 80, h = 18) => { const m = d3.max(vals) || 1, bw = w / vals.length; return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => `<rect x="${(i * bw).toFixed(1)}" y="${(h - Math.max(v ? 1.5 : 0.6, (v / m) * h)).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(v ? 1.5 : 0.6, (v / m) * h).toFixed(1)}" fill="${v ? '#b9c1c8' : '#30363c'}"/>`).join('')}</svg>`; };
const trendTxt = (t) => (Math.abs(t) < 0.5 ? '<span class="tr flat">even</span>' : `<span class="tr ${t > 0 ? 'up' : 'dn'}">${t > 0 ? '▲' : '▼'} ${scoreFmt(Math.abs(t))}</span>`);
const chip = (school, size = 22) => `<span class="chip" style="width:${size}px;height:${size}px">${SB ? SB.svg(canon(school), { size, variant: 'chip', title: false }) : ''}</span>`;
const schoolLink = (school, size = 20) => `<a class="who" href="${schoolHref(school)}">${chip(school, size)}<span>${esc(canon(school))}</span></a>`;
const dtag = (d) => `<span class="dtag">D${d}</span>`;
const distMap = (d, w = 40) => { const h = w * MAP.h / MAP.w, dot = MAP.dot[d]; return `<svg class="pa" width="${w}" height="${h.toFixed(1)}" viewBox="0 0 ${MAP.w} ${MAP.h}" aria-hidden="true"><path d="${MAP.outline}" class="pa-o"/>${MAP.d[d] ? `<path d="${MAP.d[d]}" class="pa-d"/>` : ''}${d === 8 || d === 12 ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="3.4" class="pa-p"/>` : ''}</svg>`; };
const distLink = (d, opts = {}) => `<a class="dlink" href="#district/${d}">${opts.map === false ? '' : distMap(d, opts.mapW || 32)}${dtag(d)}${opts.name === false ? '' : `<span class="dn">${esc(DISTRICTS[d])}</span>`}</a>`;
const $view = document.getElementById('view'), $tip = document.getElementById('tip');
const host = (id) => $view.querySelector(`[data-c="${id}"]`);
const widthOf = (el) => Math.max(140, Math.floor(el.getBoundingClientRect().width));
const tip = { show(ev, html) { $tip.innerHTML = html; $tip.hidden = false; this.move(ev); }, move(ev) { const r = $tip.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14; if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14; $tip.style.transform = `translate(${Math.max(6, x)}px,${Math.max(6, y)}px)`; }, hide() { $tip.hidden = true; } };
const bindTip = (sel, fn) => sel.on('pointerenter', (ev, d) => { if (ev.pointerType !== 'touch') tip.show(ev, fn(d)); }).on('pointermove', (ev) => tip.move(ev)).on('pointerleave', () => tip.hide());
addEventListener('scroll', () => tip.hide(), { passive: true });
const sec = (n, title, sub, extra = '') => `<div class="sec-head"><span class="eyebrow">${n}</span><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${extra ? `<div class="sec-extra">${extra}</div>` : ''}</div>`;
const seg = (name, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
const LEVELS = [['dist', 'District'], ['reg', 'Regional'], ['place', 'State']];

/* ---- 1. Ladder: a wrestler's career, levels down, grades across ---- */
function ladder(w, opts = {}) {
  const apps = w.apps, size = opts.size || 22, slot = (r) => gradeSlot(r, apps);
  const row = (lvl) => { const g = Array(4).fill(null); apps.forEach((r) => { const i = slot(r); const v = lvl === 'place' ? r.place : r[lvl]; const cur = g[i]; if (v == null && lvl !== 'place') return; if (!cur || (v && (!cur.v || v < cur.v))) g[i] = { v: v || 0, r }; }); return g; };
  const cell = (c, lvl) => { if (!c) return '<i class="gc"></i>'; const r = c.r, est = lvl === 'dist' && r.distEst; const t = `${r.year}${r.grade ? ' ' + r.grade : ''}, ${wLabel(r.w)}: ${lvl === 'place' ? (r.place ? ordinal(r.place) + ' at states' : 'state qualifier') : lvl === 'reg' ? ordinal(r.reg) + ' at the ' + (REGIONS[r.region] || r.region) + ' regional' : (est ? 'district place estimated from the regional seed' : ordinal(r.dist) + ' at districts')}`; return `<i class="gc${est ? ' est' : ''}" title="${esc(t)}">${c.v ? medal(c.v, size) : qpill(size)}</i>`; };
  return `<div class="ladder${opts.compact ? ' compact' : ''}"><div class="lad-h"><b></b>${GRADE_L.map((g) => `<i>${g}</i>`).join('')}</div>${LEVELS.filter(([k]) => !opts.compact || k === 'place').map(([k, l]) => `<div class="lad-r"><b>${l}</b>${row(k).map((c) => cell(c, k)).join('')}</div>`).join('')}</div>`;
}
/* ---- 2. Funnel: the path for a set of appearances ---- */
function funnel(h, apps, opts = {}) {
  const meds = apps.filter((r) => r.place), n = apps.length;
  const tiers = [
    { k: 'pre', label: 'District and regional', val: null, note: 'placers at the two steps before states', est: true, sub: apps.some((r) => r.reg) ? [[1, apps.filter((r) => r.reg === 1).length], [2, apps.filter((r) => r.reg === 2).length], [3, apps.filter((r) => r.reg === 3).length], [4, apps.filter((r) => r.reg >= 4).length]] : null, subNote: 'regional places of the state qualifiers' },
    { k: 'q', label: 'State trips', note: 'qualified for the state tournament', val: n },
    { k: 'm', label: 'Medals', note: 'placed at states', val: meds.length, sub: [[1, meds.filter((r) => r.place === 1).length], [2, meds.filter((r) => r.place === 2).length], [3, meds.filter((r) => r.place === 3).length], [4, meds.filter((r) => r.place === 4).length], [5, meds.filter((r) => r.place >= 5).length]] },
    { k: 'f', label: 'Finals', note: 'in a state final', val: meds.filter((r) => r.place <= 2).length },
    { k: 't', label: 'Titles', note: 'state champions', val: meds.filter((r) => r.place === 1).length }
  ];
  const max = n || 1;
  h.innerHTML = `<div class="funnel">${tiers.map((t, i) => `<div class="ft${t.est ? ' est' : ''}">${t.est ? '<div class="ft-bar"></div><div class="ft-n dim">—</div>' : `<div class="ft-bar" style="--w:${(t.val / max * 100).toFixed(1)}%"><i></i></div><div class="ft-n">${fmt(t.val)}</div>`}<div class="ft-l">${t.label}</div><div class="ft-s">${t.est ? 'brackets being collected' : i > 1 ? `${pct0(t.val / (tiers[i - 1].val || 1))} of the step before` : t.note}</div>${t.sub ? `<div class="ft-sub">${t.subNote ? `<span class="t3">${t.subNote}:</span>` : ''}${t.sub.map(([p, c]) => (c ? `<span>${medal(p, 14, null, p === 5 ? '5+' : null)}${c}</span>` : '')).join('')}</div>` : ''}</div>`).join('')}</div>`;
  requestAnimationFrame(() => h.querySelectorAll('.ft-bar i').forEach((i) => { i.style.width = 'var(--w)'; }));
}
/* ---- 3. Season strip ---- */
function strip(h, st, opts = {}) {
  const [a, b] = yearsInScope(), W = widthOf(h), H = opts.H || 70, top = 8, bottom = 18;
  const x = d3.scaleBand(d3.range(a, b + 1), [0, W]).paddingInner(0.2), max = d3.max(st.seasons, (s) => s.share) || 0.1, y = d3.scaleLinear([0, max], [H - bottom, top]);
  const svg = d3.select(h).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const by = new Map(st.seasons.map((s) => [s.year, s]));
  const bars = svg.append('g').selectAll('rect').data(d3.range(a, b + 1)).join('rect').attr('x', (yy) => x(yy)).attr('width', x.bandwidth()).attr('y', (yy) => (by.get(yy) ? y(by.get(yy).share) : H - bottom - 1)).attr('height', (yy) => (by.get(yy) ? Math.max(1.5, H - bottom - y(by.get(yy).share)) : 1)).attr('fill', (yy) => { const s = by.get(yy); return !s ? '#2b3036' : (s.t.realRank || s.rank) <= 8 ? metal(s.t.realRank || s.rank).mid : '#59616a'; }).style('cursor', 'pointer');
  bindTip(bars, (yy) => { const s = by.get(yy); return s ? `<b>${yy}</b><div>${ordinal(s.t.realRank || s.rank)} in the team race</div><div class="t3">${pct1(s.share)} of the season’s points</div>` : `<b>${yy}</b><div class="t3">no medals</div>`; });
  bars.on('click', (ev, yy) => { if (opts.select) opts.select(yy); });
  d3.range(Math.ceil(a / 10) * 10, b + 1, 10).forEach((yy) => svg.append('text').attr('class', 'ax').attr('x', x(yy) + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(yy));
  const mark = svg.append('rect').attr('class', 'strip-sel').attr('y', 0).attr('height', H - bottom + 2).attr('width', x.bandwidth() + 2);
  return { paint(yy) { mark.attr('x', x(yy) - 1).attr('opacity', x(yy) == null ? 0 : 1); } };
}
/* ---- 4. Board: weights across, levels down ---- */
function board(h, apps, opts = {}) {
  const ks = STD.filter((c) => apps.some((r) => stdOf(r).k === c.k));
  const best = (k, lvl) => { const rs = apps.filter((r) => stdOf(r).k === k); const val = (r) => (lvl === 'place' ? r.place : r[lvl]); const ok = rs.filter((r) => val(r)); if (!ok.length) return rs.length && lvl === 'place' ? { q: rs.length } : null; const b = ok.reduce((m, r) => (val(r) < val(m) ? r : m)); return { r: b, v: val(b), n: ok.filter((r) => val(r) === val(b)).length, est: lvl === 'dist' && b.distEst }; };
  h.innerHTML = `<div class="board" style="--n:${ks.length}"><div class="bd-r bd-h"><b></b>${ks.map((c) => `<i>${c.label}</i>`).join('')}</div>${LEVELS.map(([k, l]) => `<div class="bd-r"><b>${l}</b>${ks.map((c) => { const o = best(c.k, k); return !o ? '<i class="bc"></i>' : o.q ? `<i class="bc" title="${o.q} state trips, no medal">${qpill(16)}</i>` : `<i class="bc${o.est ? ' est' : ''}" title="${esc(o.r.name)}, ${o.r.year}: ${ordinal(o.v)}${o.n > 1 ? ' (' + o.n + ' times)' : ''}">${medal(o.v, 20)}${o.n > 1 ? `<small>×${o.n}</small>` : ''}</i>`; }).join('')}</div>`).join('')}</div>`;
}
/* ---- 5. Rankings table, one set of columns everywhere ---- */
function rankingTable(h, kind, opts = {}) {
  const rows = rankings(kind).filter(opts.filter || (() => true));
  const sorts = { all: (o) => o.allTime, now: (o) => o.now, pts: (o) => o.pts, medals: (o) => o.medals, p1: (o) => o.places[0], p2: (o) => o.places[1], p3: (o) => o.places[2], p4: (o) => o.places[3], p58: (o) => d3.sum(o.places.slice(4)), qrate: (o) => o.qrate || 0, trend: (o) => o.trend, won: (o) => o.won };
  let key = opts.sort || 'all', q = '', limit = opts.limit || 50;
  const draw = () => {
    let L = rows.slice().sort((p, r) => sorts[key](r) - sorts[key](p)); if (q) L = L.filter((o) => o.u.name.toLowerCase().includes(q));
    const th = (k, l, t, extra = '') => `<th class="n ${extra}"><button type="button" data-sort="${k}" aria-pressed="${key === k}" title="${t}">${l}${key === k ? ' ↓' : ''}</button></th>`;
    const mh = (p, k, l) => th(k, medal(p, 15, l, p === 5 ? '5+' : null), l, 'mh');
    h.querySelector('.rt').innerHTML = `<table class="rank"><thead><tr><th class="n">#</th><th>${kind === 'district' ? 'District' : 'Program'}</th>${th('all', 'Era', 'All-time: share of each season’s points, summed')}${th('now', 'Power', 'Now: a seven-season half-life')}${th('pts', 'Score', 'Placement points')}${th('medals', 'Medals', 'State places')}${mh(1, 'p1', 'Titles')}${mh(2, 'p2', 'Seconds')}${mh(3, 'p3', 'Thirds')}${mh(4, 'p4', 'Fourths')}${mh(5, 'p58', 'Fifth to eighth')}${th('qrate', 'Placed', 'Share of state trips that placed')}${th('trend', 'Trend', 'Last ten seasons vs the ten before')}<th>Last 20</th>${th('won', 'Team titles', 'Official team scores from 1976')}</tr></thead>
      <tbody>${L.slice(0, limit).map((o, i) => `<tr><td class="n rk">${key === 'all' ? o.allRank : key === 'now' ? o.nowRank : i + 1}</td><td class="nm"><span class="nmw">${o.u.kind === 'district' ? distLink(o.u.d, { mapW: 28 }) : schoolLink(o.u.name)}${o.u.kind === 'school' && o.u.d && !opts.noTag ? dtag(o.u.d) : ''}</span></td><td class="n"><b>${scoreFmt(o.allTime)}</b></td><td class="n"><b>${scoreFmt(o.now)}</b></td><td class="n">${fmt(o.pts)}</td><td class="n"><b>${o.medals}</b></td>${[0, 1, 2, 3].map((p) => `<td class="n">${o.places[p] || '<span class="t3">·</span>'}</td>`).join('')}<td class="n">${d3.sum(o.places.slice(4)) || '<span class="t3">·</span>'}</td><td class="n">${o.qrate != null ? pct0(o.qrate) : ''}</td><td class="n">${trendTxt(o.trend)}</td><td>${spark(o.spark)}</td><td class="n">${o.won || '<span class="t3">·</span>'}</td></tr>`).join('')}</tbody></table>${L.length > limit ? `<button type="button" class="btn more-btn" data-more>Show all ${L.length}</button>` : ''}`;
  };
  h.innerHTML = `${opts.search ? '<div class="tools"><input class="field" type="search" placeholder="Find a program" aria-label="Find a program"></div>' : ''}<div class="rt"></div>`;
  h.addEventListener('click', (e) => { const s = e.target.closest('[data-sort]'); if (s) { key = s.dataset.sort; draw(); } if (e.target.closest('[data-more]')) { limit = 1e4; draw(); } });
  const inp = h.querySelector('input'); if (inp) inp.addEventListener('input', () => { q = inp.value.trim().toLowerCase(); draw(); });
  draw();
}
function teamsTable(h, rows, opts = {}) {
  const T = allTimeTeams(rows, 3); let team = 0;
  const draw = () => { h.innerHTML = `<div class="tm-tools">${seg('team', [[0, 'First team'], [1, 'Second team'], [2, 'Third team']], team)}</div><table class="team"><tbody>${T.map(({ c, slots }) => { const e = slots[team]; return `<tr><td class="wk">${c.label}</td>${e ? `<td class="nm"><a class="wname" href="${e.href}">${esc(e.name)}</a><span class="t3"> ${esc(e.sch)}${opts.state ? ' · D' + e.d : ''} · ${e.years}</span></td><td><span class="career">${e.rows.map((r) => medal(r.place, 16, `${r.year}, ${ordinal(r.place)}`)).join('')}</span></td><td class="n"><b>${e.pts}</b></td>` : '<td colspan="3" class="t3">—</td>'}</tr>`; }).join('')}</tbody></table>`; };
  h.addEventListener('click', (e) => { const t = e.target.closest('[data-team]'); if (t) { team = +t.dataset.team; draw(); } });
  draw();
}
function raceBoard(S, opts = {}) {
  const L = S.lineup, n = L.length || 13;
  const list = S.teams.slice(0, opts.limit || 15);
  const strip = (t) => { const at = new Map(); t.rows.forEach((r) => { const c = at.get(r.slot); if (!c || (r.place && (!c.place || r.place < c.place))) at.set(r.slot, r); }); return `<div class="rx-strip" style="--n:${n}">${d3.range(n).map((i) => { const r = at.get(i); if (!r) return '<i class="nil"></i>'; return `<i title="${esc(r.name)}: ${r.place ? ordinal(r.place) : 'qualified'} at ${wLabel(r.w)}${r.reg ? ', ' + ordinal(r.reg) + ' at regionals' : ''}">${r.place ? medal(r.place, 18) : qpill(15)}</i>`; }).join('')}</div>`; };
  return `<div class="rx-axis" style="--n:${n}"><span></span><div class="rx-cols">${L.map((o) => `<b>${wShort(o.w)}</b>`).join('')}</div><span></span></div><ol class="race">${list.map((t) => `<li><span class="rk">${S.real ? t.realRank || '' : t.rank}</span><span class="nm">${schoolLink(t.id, 20)}</span>${strip(t)}<span class="pts"><b>${S.real ? t.score : t.pts}</b><small>${S.real ? 'team pts' : 'placement pts'}</small></span></li>`).join('')}</ol>`;
}
function stateMap(h, vals, opts = {}) {
  const W = Math.min(widthOf(h), opts.max || 700), H = W * MAP.h / MAP.w, k = W / MAP.w, max = d3.max(Object.values(vals)) || 1;
  const tone = (v) => d3.interpolateRgb('#272c31', '#eef0f2')(Math.pow((v || 0) / max, 0.7));
  const svg = d3.select(h).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g').attr('transform', `scale(${k})`);
  g.append('path').attr('d', MAP.outline).attr('fill', '#1d2125');
  const ds = d3.range(1, 13);
  const shapes = g.append('g').selectAll('path').data(ds.filter((d) => MAP.d[d])).join('path').attr('d', (d) => MAP.d[d]).attr('fill', (d) => tone(vals[d])).attr('stroke', '#0f1113').attr('stroke-width', 0.35).style('cursor', 'pointer');
  const dots = g.append('g').selectAll('circle').data([8, 12]).join('circle').attr('cx', (d) => MAP.dot[d][0]).attr('cy', (d) => MAP.dot[d][1]).attr('r', 2.6).attr('fill', (d) => tone(vals[d])).attr('stroke', '#0f1113').attr('stroke-width', 0.5).style('cursor', 'pointer');
  const off = { 7: [0, 7], 8: [6, -1.5], 12: [5, 3.2], 1: [-2.5, -1], 5: [0, 1] };
  g.append('g').selectAll('text').data(ds).join('text').attr('class', 'pa-lab').attr('x', (d) => MAP.dot[d][0] + (off[d] || [0, 0])[0]).attr('y', (d) => MAP.dot[d][1] + (off[d] || [0, 0])[1]).attr('text-anchor', 'middle').attr('dy', '.35em').attr('font-size', W < 500 ? 3.6 : 3).attr('fill', (d) => ((vals[d] || 0) / max > 0.45 && (!off[d] || d === 7) ? '#0f1113' : '#eef0f2')).style('pointer-events', 'none').text((d) => 'D' + d);
  const all = shapes.merge(dots); all.on('click', (ev, d) => opts.select && opts.select(d));
  bindTip(all, (d) => `<b>District ${d} · ${esc(DISTRICTS[d])}</b><div class="t3">${opts.tipText ? opts.tipText(d) : ''}</div>`);
}

/* ================= pages ================= */
const VIEWS = {};
const nums = (items) => `<dl class="nums">${items.filter(Boolean).map(([v, l, s]) => `<div><dd>${v}</dd><dt>${l}</dt>${s ? `<span>${s}</span>` : ''}</div>`).join('')}</dl>`;

VIEWS.home = function () {
  const [a, b] = yearsInScope(), apps = ROWS(), meds = apps.filter((r) => r.place);
  const progs = rankings('school'), dists = rankings('district'), seasons = seasonsInScope();
  const nowTop = progs.slice().sort((p, q) => q.now - p.now).slice(0, 10), eraTop = progs.slice(0, 10);
  const S = boardsFor(b)[0], wins = d3.rollups(seasons, (v) => v.length, (x) => x.teams[0].id).sort((p, q) => q[1] - p[1]);
  const list = (L, key, label, sub) => `<div class="card"><h3>${label}</h3><p class="sub">${sub}</p><ol class="toplist">${L.map((o, i) => `<li><span class="rk">${i + 1}</span>${schoolLink(o.u.name, 22)}${dtag(o.u.d)}<b>${scoreFmt(o[key])}</b></li>`).join('')}</ol></div>`;
  $view.innerHTML = `<header class="hero"><p class="eyebrow">Pennsylvania high school wrestling, ${a}–${b}</p><h1>Every path to Hershey.</h1><p class="lede">Districts, regionals and the state tournament, ${plural(apps.length, 'state trip')} and ${fmt(meds.length)} medals across ${fmt(progs.length)} programs in ${clsName()}. One place on one path per wrestler per season; everything here adds those up.</p></header>
    <section class="sec">${sec('01', 'The path, all-time', 'How many made each step. Left to right: districts, regionals, states; then medals, finals, titles.')}<div data-c="funnel"></div></section>
    <section class="sec">${sec('02', 'The programs', '', `<a class="more" href="#programs">All rankings</a>`)}<div class="two">${list(nowTop, 'now', 'Power, now', 'Every medal counts; a season seven years back counts half.')}${list(eraTop, 'allTime', 'Era, all-time', 'Each season’s share of points, added up.')}</div></section>
    <section class="sec">${sec('03', 'The all-time team', 'At each weight, the wrestler with the most points there. Second and third teams follow.', `<a class="more" href="#weights">Weights</a>`)}<div class="card" data-c="teams"></div></section>
    <section class="sec">${sec('04', `The ${b} season`, S && S.real ? 'Official team standings; each school’s wrestlers on the weight axis.' : 'Standings by placement points.', `<a class="more" href="#season/${b}">Open the season</a>`)}<div class="card race-host">${S ? raceBoard(S, { limit: 8 }) : ''}</div></section>
    <section class="sec">${sec('05', 'The districts', `${esc(DISTRICTS[dists[0].u.d])} holds ${pct0(dists[0].pts / d3.sum(dists, (o) => o.pts))} of all points. ${esc(wins[0][0])} has the most team titles, ${wins[0][1]}.`, `<a class="more" href="#districts">Districts</a>`)}<a class="map-link" href="#districts"><div data-c="map"></div></a></section>`;
  funnel(host('funnel'), apps); teamsTable(host('teams'), meds, { state: true });
  stateMap(host('map'), Object.fromEntries(dists.map((o) => [o.u.d, o.now])), { max: 620, select: (d) => { location.hash = '#district/' + d; }, tipText: (d) => { const o = dists.find((x) => x.u.d === d); return o ? `Power ${scoreFmt(o.now)} · Era ${scoreFmt(o.allTime)}` : ''; } });
};

VIEWS.programs = function () { $view.innerHTML = `<header class="page-head"><p class="eyebrow">Rankings</p><h1>Programs</h1><p class="lede">Every program with a state medal in ${clsName()}. Tap a column to sort.</p></header><div data-c="rt"></div>`; rankingTable(host('rt'), 'school', { search: true }); };
VIEWS.districts = function () {
  const dists = rankings('district'), progs = rankings('school');
  $view.innerHTML = `<header class="page-head"><p class="eyebrow">Rankings</p><h1>Districts</h1><p class="lede">Twelve PIAA districts in ${clsName()}, shaded by power. Tap one.</p></header><div class="statemap"><div data-c="map"></div><div class="card dcard" id="dcard"></div></div><section class="sec">${sec('01', 'Ranked', 'The same columns as the program rankings.')}<div data-c="rt"></div></section>`;
  const card = (d) => { const o = dists.find((x) => x.u.d === d); if (!o) return; const mine = progs.filter((p) => p.u.d === d).slice(0, 5); document.getElementById('dcard').innerHTML = `<div class="dc-h">${distMap(d, 60)}<div><p class="eyebrow">District ${d} · ${ordinal(o.allRank)} by era, ${ordinal(o.nowRank)} by power</p><h3>${esc(DISTRICTS[d])}</h3></div></div>${nums([[scoreFmt(o.allTime), 'Era'], [scoreFmt(o.now), 'Power'], [fmt(o.medals), 'Medals'], [pct0(o.qrate), 'Placed']])}<div>${shelf(o.places, { size: 16 })}</div><p class="eyebrow">Top programs</p><ol class="dc-p">${mine.map((p) => `<li>${schoolLink(p.u.name, 18)}<b>${scoreFmt(p.allTime)}</b></li>`).join('')}</ol><a class="more" href="#district/${d}">Open District ${d}</a>`; };
  stateMap(host('map'), Object.fromEntries(dists.map((o) => [o.u.d, o.now])), { select: card, tipText: (d) => { const o = dists.find((x) => x.u.d === d); return o ? `Power ${scoreFmt(o.now)}` : ''; } });
  card(dists.slice().sort((p, q) => q.now - p.now)[0].u.d);
  rankingTable(host('rt'), 'district', { limit: 12 });
};

function entityPage(u) {
  const st = unitStats(u), isD = u.kind === 'district', R = rankings(u.kind), me = R.find((o) => (isD ? o.u.d === u.d : o.u.name === u.name));
  const [a, b] = yearsInScope();
  const head = isD ? `<div class="ph-mark">${distMap(u.d, 130)}</div><div><p class="eyebrow">${dtag(u.d)} PIAA district</p><h1>${esc(DISTRICTS[u.d])}</h1></div>` : `<div class="ph-mark">${chip(u.name, 76)}</div><div><p class="eyebrow">${u.d ? distLink(u.d, { mapW: 28 }) : ''}</p><h1>${esc(u.name)}</h1><p class="sub">${classHistory(u.name).map((h) => `${classLabel(h.cls)} ${h.from}${h.to > h.from ? '–' + h.to : ''}`).join(' · ')}</p></div>`;
  if (!st.quals) { $view.innerHTML = `<header class="ph">${head}</header><p class="lede">No ${clsName()} state trips on record.</p>`; return; }
  if (!state.year || state.yearFor !== u.name || !st.seasons.some((s) => s.year === state.year)) { state.year = st.last; state.yearFor = u.name; }
  const W = wrestlersOf(st.rows), teamTitles = !isD ? TEAMS.filter((t) => t.sch === u.name) : [];
  $view.innerHTML = `<header class="ph">${head}</header>
    ${nums([[ordinal(me.allRank), 'Era rank', `score ${scoreFmt(st.allTime)}, of ${R.length}`], [ordinal(me.nowRank), 'Power rank', `score ${scoreFmt(st.now)}, of ${R.length}`], [fmt(st.pts), 'Score', 'placement points'], [fmt(st.medals), 'Medals', `${fmt(st.quals)} state trips, ${pct0(st.qrate)} placed`], [st.won, 'Team titles', isD ? 'placement points' : 'official from 1976'], [st.regTitles, 'Regional titles', 'since 1951']])}
    <div class="card shelf-row">${shelf(st.places, { size: 22, zeros: true })}</div>
    <section class="sec">${sec('01', 'The path', `Every ${isD ? 'district' : esc(u.name)} wrestler’s steps, ${a}–${b}.`)}<div data-c="funnel"></div></section>
    <section class="sec">${sec('02', 'Season by season', 'Bar height is the share of that season’s points; color is the team finish. Tap a season.')}<div class="card"><div data-c="strip"></div><div id="scard"></div></div></section>
    <section class="sec">${sec('03', 'By weight', 'The best result at each weight, at each level.')}<div class="card" data-c="board"></div></section>
    ${isD ? `<section class="sec">${sec('04', 'Its programs', '')}<div data-c="dprog"></div></section>` : ''}
    <section class="sec">${sec(isD ? '05' : '04', 'All-time lineup', 'The best at each weight, each wrestler placed once per team level.')}<div class="card" data-c="teams"></div></section>
    <section class="sec">${sec(isD ? '06' : '05', isD ? 'Its best wrestlers' : 'Its wrestlers', 'Ranked by points. The ladder shows each state trip under the grade it was taken in.')}<div class="card" data-c="wr"></div></section>`;
  funnel(host('funnel'), st.apps);
  const sp = strip(host('strip'), st, { select: (y) => { state.year = y; card(); } });
  const card = () => { const y = state.year, s = st.seasons.find((x) => x.year === y), S = seasonOf(y); sp.paint(y); const mine = st.apps.filter((r) => r.year === y).sort((p, q) => p.slot - q.slot || p.place - q.place); document.getElementById('scard').innerHTML = `<div class="scard"><div class="sc-h"><span class="yr">${y}</span>${s ? `<span>${ordinal(s.t.realRank || s.rank)} of ${isD ? S.dists.length + ' districts' : S.teams.length + ' schools'}, ${s.t.score != null ? s.t.score + ' team points' : s.pts + ' placement points'}</span>` : '<span>no medals</span>'}<a class="more" href="#season/${y}">Open ${y}</a></div><ol class="mlist">${mine.slice(0, isD ? 12 : 30).map((r) => `<li>${r.place ? medal(r.place, 22) : qpill(20)}<span class="w">${wShort(r.w)}</span><a class="wname" href="${wrestlerHref(r)}">${esc(r.name)}</a>${r.grade ? `<span class="t3">${r.grade}</span>` : ''}${r.reg ? `<span class="t3">${ordinal(r.reg)} ${esc(r.region)} regional</span>` : ''}${isD ? schoolLink(r.sch, 16) : ''}</li>`).join('')}</ol>${mine.length > (isD ? 12 : 30) ? `<p class="t3">and ${mine.length - (isD ? 12 : 30)} more</p>` : ''}</div>`; };
  card();
  board(host('board'), st.apps);
  if (isD) rankingTable(host('dprog'), 'school', { filter: (o) => o.u.d === u.d, noTag: true, limit: 15 });
  teamsTable(host('teams'), st.rows, { state: false });
  let lim = 20; const wr = () => { host('wr').innerHTML = `<table class="wr"><tbody>${W.slice(0, lim).map((w, i) => `<tr><td class="n rk">${i + 1}</td><td class="nm"><a class="wname" href="${wrestlerHref(w.rows[0])}">${esc(w.name)}</a><span class="t3">${isD ? esc(w.sch) + ' · ' : ''}${w.apps[0].year}${w.apps.length > 1 ? '–' + w.apps[w.apps.length - 1].year : ''}</span></td><td>${ladder(w, { compact: true, size: 20 })}</td><td class="n"><b>${w.pts}</b></td></tr>`).join('')}</tbody></table>${W.length > lim ? `<button type="button" class="btn more-btn" data-more>Show all ${W.length}</button>` : ''}`; };
  wr(); host('wr').addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { lim = 1e4; wr(); } });
}
VIEWS.program = (s) => { const name = SCHOOL_BY_SLUG.get(s) || s; entityPage({ kind: 'school', name, d: schoolDistrict(name) }); };
VIEWS.district = (d) => entityPage({ kind: 'district', d: +d, name: 'District ' + d });

VIEWS.season = function (arg) {
  const years = YEARS.filter((y) => boardsFor(y).length), y = years.includes(+arg) ? +arg : years[years.length - 1], boards = boardsFor(y);
  const prev = years.filter((x) => x < y).pop(), next = years.find((x) => x > y);
  $view.innerHTML = `<header class="page-head season-head"><p class="eyebrow">Season</p><div class="yr-nav">${prev ? `<a class="btn" href="#season/${prev}">‹</a>` : '<span class="btn off">‹</span>'}<h1>${y}</h1>${next ? `<a class="btn" href="#season/${next}">›</a>` : '<span class="btn off">›</span>'}<select class="field" id="ysel" aria-label="Season">${years.slice().reverse().map((x) => `<option${x === y ? ' selected' : ''}>${x}</option>`).join('')}</select></div></header>
    ${boards.map((S, bi) => { const fin = FINALS.filter((f) => f.year === y && (S.one || f.cls === S.cls)); return `<section class="sec">${sec(String(bi * 3 + 1).padStart(2, '0'), `${boards.length > 1 ? classLabel(S.cls) + ': ' : ''}The path this season`, `${fmt(S.rows.length)} state trips, ${fmt(S.meds.length)} medals.`)}<div data-c="fun-${S.cls}"></div></section>
      <section class="sec">${sec(String(bi * 3 + 2).padStart(2, '0'), `${boards.length > 1 ? classLabel(S.cls) + ': ' : ''}The team race`, S.real ? 'Official team scores. Each school’s wrestlers on the weight axis: a medal, or Q for a qualifier who did not place.' : 'Standings by placement points.')}<div class="card race-host" data-c="race-${S.cls}"></div></section>
      <section class="sec">${sec(String(bi * 3 + 3).padStart(2, '0'), `${boards.length > 1 ? classLabel(S.cls) + ': ' : ''}The finals`, '')}<ol class="finals">${fin.map((f) => `<li><span class="w">${wShort(f.w)}</span><span class="f">${medal(1, 22)}<span><a class="wname" href="${wrestlerHref(f.win)}">${esc(f.win.name)}</a><small>${esc(f.win.sch)}</small></span></span><span class="f">${medal(2, 22)}<span><a class="wname" href="${wrestlerHref(f.lose)}">${esc(f.lose.name)}</a><small>${esc(f.lose.sch)}</small></span></span></li>`).join('')}</ol></section>`; }).join('')}`;
  boards.forEach((S) => { funnel(host('fun-' + S.cls), S.rows); let lim = 15; const draw = () => { host('race-' + S.cls).innerHTML = raceBoard(S, { limit: lim }) + (S.teams.length > lim ? `<button type="button" class="btn more-btn" data-more>Show all ${S.teams.length}</button>` : ''); }; draw(); host('race-' + S.cls).addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { lim = 1e4; draw(); } }); });
  document.getElementById('ysel').addEventListener('change', (e) => { location.hash = '#season/' + e.target.value; });
};

VIEWS.weights = function (arg) {
  const meds = MEDS(), apps = ROWS(), ks = STD.filter((c) => meds.some((r) => stdOf(r).k === c.k)), c = ks.find((x) => x.k === arg) || ks.find((x) => x.k === '145');
  const rs = meds.filter((r) => stdOf(r).k === c.k), view = state.wview || 'w';
  $view.innerHTML = `<header class="page-head"><p class="eyebrow">Weights</p><h1>${c.label === 'Hwt' ? 'Heavyweight' : c.label + ' lb'}</h1><p class="lede">${plural(rs.filter((r) => r.place === 1).length, 'champion')}, ${plural(rs.length, 'medal')} in ${clsName()}.</p></header>
    <nav class="wchips">${ks.map((x) => `<a href="#weights/${x.k}" aria-current="${x.k === c.k}">${x.label}</a>`).join('')}</nav>
    <div class="sec-head">${seg('wv', [['w', 'Wrestlers'], ['p', 'Programs'], ['d', 'Districts']], view)}</div><div data-c="body"></div>`;
  const body = host('body');
  const over = (units, label) => { const decades = d3.range(Math.floor(d3.min(rs, (r) => r.year) / 10) * 10, d3.max(rs, (r) => r.year) + 1, 10), tot = d3.rollup(rs, (v) => d3.sum(v, (r) => r.pts), (r) => Math.floor(r.year / 10) * 10); const series = units.map((u) => ({ ...u, by: new Map(decades.map((dc) => [dc, d3.sum(rs.filter((r) => u.test(r) && Math.floor(r.year / 10) * 10 === dc), (r) => r.pts) / (tot.get(dc) || 1)])) })); const mx = d3.max(series, (o) => d3.max(Array.from(o.by.values()))) || 1; return `<section class="sec">${sec('02', `${label} at ${c.label}, by decade`, 'Share of this weight’s points. The last bar is the current decade.')}<div class="smalls">${series.map((o) => `<a class="card small" href="${o.href}"><div class="small-h">${o.label}</div><div class="decbars">${decades.map((dc) => `<i title="${dc}s: ${pct1(o.by.get(dc) || 0)}" style="height:${((o.by.get(dc) || 0) / mx * 100).toFixed(1)}%"></i>`).join('')}</div><div class="decax"><span>${decades[0]}s</span><span>${pct0(o.by.get(decades[decades.length - 1]) || 0)} now</span></div></a>`).join('')}</div></section>`; };
  if (view === 'w') { const Wt = wrestlersOf(rs); body.innerHTML = `<section class="sec">${sec('01', `Best at ${c.label}`, 'Points from medals won at this weight only. A wrestler who moved up appears at each weight he placed at.')}<div class="card"><table class="wr"><tbody>${Wt.slice(0, 25).map((w, i) => `<tr><td class="n rk">${i + 1}</td><td class="nm"><a class="wname" href="${wrestlerHref(w.rows[0])}">${esc(w.name)}</a><span class="t3">${esc(w.sch)} · D${w.d} · ${w.rows[0].year}${w.rows.length > 1 ? '–' + w.rows[w.rows.length - 1].year : ''}</span></td><td><span class="career">${w.rows.map((r) => medal(r.place, 18)).join('')}</span></td><td class="n"><b>${w.pts}</b></td></tr>`).join('')}</tbody></table></div></section>`; }
  else if (view === 'p') { const t = d3.sum(rs, (r) => r.pts), P = d3.rollups(rs, (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v) }), (r) => r.sch).map(([sch, o]) => ({ sch, ...o, share: o.pts / t })).sort((p, q) => q.pts - p.pts); body.innerHTML = `<section class="sec">${sec('01', `Programs at ${c.label}`, 'Share of the points won at this weight.')}<div class="card"><ol class="dbar">${P.slice(0, 15).map((o) => `<li>${schoolLink(o.sch, 18)}<span class="track"><i style="width:${(o.share / P[0].share * 100).toFixed(1)}%"></i></span><b>${pct0(o.share)}</b><span class="t3">${shelf(o.places, { size: 13, compact: true })}</span></li>`).join('')}</ol></div></section>` + over(P.slice(0, 8).map((o) => ({ label: `${chip(o.sch, 18)}<span>${esc(o.sch)}</span>`, href: schoolHref(o.sch), test: (r) => r.sch === o.sch })), 'Programs'); }
  else { const t = d3.sum(rs, (r) => r.pts), all = d3.sum(meds, (r) => r.pts), D = d3.rollups(rs, (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v) }), (r) => r.d).map(([d, o]) => ({ d, ...o, share: o.pts / t, overall: d3.sum(meds.filter((r) => r.d === d), (r) => r.pts) / all })).sort((p, q) => q.pts - p.pts); body.innerHTML = `<section class="sec">${sec('01', `Districts at ${c.label}`, 'Share of the points won at this weight. The tick is the district’s share across all weights, so a bar past its tick marks a weight it is strong at.')}<div class="card"><ol class="dbar">${D.map((o) => `<li>${distLink(o.d, { mapW: 28 })}<span class="track"><i style="width:${(o.share / D[0].share * 100).toFixed(1)}%"></i><s style="left:${Math.min(100, o.overall / D[0].share * 100).toFixed(1)}%"></s></span><b>${pct0(o.share)}</b><span class="t3">${shelf(o.places, { size: 13, compact: true })}</span></li>`).join('')}</ol></div></section>` + over(D.slice(0, 8).map((o) => ({ label: distLink(o.d, { mapW: 26 }), href: '#district/' + o.d, test: (r) => r.d === o.d })), 'Districts'); }
  $view.querySelectorAll('[data-wv]').forEach((bt) => bt.addEventListener('click', () => { state.wview = bt.dataset.wv; render(); }));
};

VIEWS.wrestlers = function () {
  const Wt = wrestlersOf(MEDS()); let q = '', lim = 50;
  $view.innerHTML = `<header class="page-head"><p class="eyebrow">People</p><h1>Wrestlers</h1><p class="lede">${fmt(Wt.length)} state medalists in ${clsName()}, by career points.</p></header><div class="tools"><input class="field" id="wq" type="search" placeholder="Find a wrestler or school"></div><div class="card" data-c="wl"></div>`;
  const draw = () => { const L = q ? Wt.filter((w) => w.name.toLowerCase().includes(q) || w.sch.toLowerCase().includes(q)) : Wt; host('wl').innerHTML = `<table class="wr"><thead><tr><th class="n">#</th><th>Wrestler</th><th>State ladder</th><th class="n">Pts</th></tr></thead><tbody>${L.slice(0, lim).map((w, i) => `<tr><td class="n rk">${i + 1}</td><td class="nm"><a class="wname" href="${wrestlerHref(w.rows[0])}">${esc(w.name)}</a><span class="t3">${esc(w.sch)} · D${w.d} · ${w.apps[0].year}${w.apps.length > 1 ? '–' + w.apps[w.apps.length - 1].year : ''}</span></td><td>${ladder(w, { compact: true, size: 20 })}</td><td class="n"><b>${w.pts}</b></td></tr>`).join('')}</tbody></table>${L.length > lim ? `<button type="button" class="btn more-btn" data-more>Show all ${L.length}</button>` : ''}`; };
  draw(); let t; document.getElementById('wq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim().toLowerCase(); draw(); }, 120); }); host('wl').addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { lim = 1e4; draw(); } });
};
VIEWS.wrestler = function (arg) {
  const w = WRESTLER.get(arg); if (!w) { $view.innerHTML = '<p class="lede">Not on record.</p>'; return; }
  const pts = d3.sum(w.rows, (r) => r.pts), fin = (r) => FINALS.find((f) => f.year === r.year && f.cls === r.cls && f.win.wn === r.wn);
  $view.innerHTML = `<header class="ph"><div class="ph-mark">${chip(w.sch, 64)}</div><div><p class="eyebrow">${schoolLink(w.sch, 18)} ${w.d ? distLink(w.d, { mapW: 26 }) : ''}</p><h1>${esc(w.name)}</h1><p class="sub">${w.apps[0].year}${w.apps.length > 1 ? '–' + w.apps[w.apps.length - 1].year : ''} · ${plural(w.apps.length, 'state trip')}, ${plural(w.rows.length, 'medal')} · ${pts} points</p></div></header>
    <div class="card">${ladder(w, { size: 34 })}<p class="t3 note">Each cell is one season, under the grade it was wrestled in. District places marked with a dotted ring are estimates from the regional seed until the district brackets load.</p></div>
    <section class="sec">${sec('01', 'Season by season', '')}<ol class="career-list">${w.apps.map((r) => { const f = r.place && r.place <= 2 ? fin(r) : null, opp = f ? (r.place === 1 ? f.lose : f.win) : null; return `<li>${r.place ? medal(r.place, 32) : qpill(30)}<div><b>${r.place ? ordinal(r.place) + ' at ' + wShort(r.w) : 'Qualified at ' + wShort(r.w)}</b><span class="t3"><a href="#season/${r.year}">${r.year}</a> · ${classLabel(r.cls)}${r.grade ? ' · ' + r.grade : ''}${r.reg ? ` · ${ordinal(r.reg)} at the ${esc(REGIONS[r.region] || r.region)} regional` : ''}</span>${opp ? `<span class="fin">${r.place === 1 ? 'Beat' : 'Lost to'} <a class="wname" href="${wrestlerHref(opp)}">${esc(opp.name)}</a>, ${esc(opp.sch)}, in the final</span>` : ''}</div></li>`; }).join('')}</ol></section>`;
};
VIEWS.about = () => { $view.innerHTML = `<header class="page-head"><p class="eyebrow">About</p><h1>How it works</h1></header><div class="prose"><p><b>One object.</b> Every result is an appearance: one wrestler, one season, one weight, one level, one place. Programs, districts, seasons and weights add those up.</p><p><b>Medals and points.</b> 1st gold, 2nd silver, 3rd bronze, 4th copper, 5th–8th steel, worth 16, 12, 9, 7, 5, 3, 2 and 1 points. Q is a state qualifier who did not place.</p><p><b>Era, Power, Score.</b> Era is a program’s share of the points available each season, summed, times 100. Power is the same with a seven-season half-life. Score is plain placement points.</p><p><b>Levels.</b> State places, qualifiers and grades come from the PIAA brackets. The state seed is the regional place from 1951 and the district place before then. Full district brackets are being collected; until they load, district cells are estimated and marked.</p><p><b>Source.</b> PA-Wrestling.com’s PIAA championship archive.</p></div>`; };

/* ================= chrome ================= */
const NAV = [['home', 'Home'], ['programs', 'Programs'], ['districts', 'Districts'], ['weights', 'Weights'], ['season', 'Seasons'], ['wrestlers', 'Wrestlers'], ['about', 'About']];
const ALIAS = { program: 'programs', district: 'districts', wrestler: 'wrestlers' };
function render() {
  const [route, arg] = (location.hash || '#home').slice(1).split('/');
  const fn = VIEWS[route] || VIEWS.home; tip.hide();
  document.getElementById('scope').innerHTML = [['AAA', 'Class AAA', 'AAA'], ['AA', 'Class AA', 'AA'], ['ALL', 'All', 'All']].map(([c, l, s]) => `<button type="button" data-scope="${c}" aria-pressed="${state.cls === c}"><span class="lg">${l}</span><span class="sm">${s}</span></button>`).join('');
  document.getElementById('nav').innerHTML = NAV.map(([k, l]) => `<a href="#${k}" aria-current="${(ALIAS[route] || route) === k ? 'page' : 'false'}">${l}</a>`).join('');
  $view.innerHTML = ''; fn(arg ? decodeURIComponent(arg) : undefined);
  const h1 = $view.querySelector('h1'); document.title = (h1 && route !== 'home' ? h1.textContent.trim() + ' · ' : '') + 'PA Wrestling Almanac';
}
document.getElementById('scope').addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b || b.dataset.scope === state.cls) return; setCls(b.dataset.scope); state.year = null; render(); });
let lastRoute = null; addEventListener('hashchange', () => { const r = location.hash.split('/')[0]; if (r !== lastRoute) scrollTo(0, 0); lastRoute = r; render(); });
render();
