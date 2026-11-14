/* Overtime — pages. One level page function; State, Region, District and School all call it. */
'use strict';
(() => {
  const { esc, fmt, ordinal, state, U, SCHOOL_BY_SLUG, section, empty, seasonsDrawer, placeCounts } = OT;


  /* PIAA team duals (1999–2026, PA-Wrestling.com dual meet pages and District III Records): champions on the State page, a school's record on its page */
  const DUALS = (window.WR_DUALS || []).map(([year, cls, round, w, wd, ws, l, ld, ls, note]) => ({ year, cls, round, w, wd, ws, l, ld, ls, note }));
  const dualsIn = () => DUALS.filter((d) => OT.inWindow(d.year) && (state.cls === 'ALL' || d.cls === state.cls));
  function dualsBlock(u) {
    const ds = dualsIn(); if (!ds.length) return '';
    const src = '<div class="note">PIAA team duals results from <a href="https://www.pa-wrestling.com/hs/stateduals/" target="_blank" rel="noopener">PA-Wrestling.com</a> dual meet pages (scores checked bout by bout) and <a href="https://piaadistrict3records.com/" target="_blank" rel="noopener">District III Records</a>.</div>';
    if (u.kind === 'state') {
      const fin = ds.filter((d) => /championship match/i.test(d.round)).sort((a, b) => b.year - a.year || a.cls.localeCompare(b.cls));
      if (!fin.length) return '';
      const rows = fin.map((d) => `<tr><td class="num">${d.year}</td><td>${d.cls}</td><td><a href="#school/${OT.slug(d.w)}"><b>${esc(d.w)}</b></a> <span class="ash">D${d.wd || '?'}</span></td><td class="num">${d.ws}–${d.ls}</td><td><a href="#school/${OT.slug(d.l)}">${esc(d.l)}</a></td></tr>`).join('');
      return section('Team duals champions', `<div class="card tw"><table class="dt"><thead><tr><th>Year</th><th>Class</th><th>Champion</th><th>Final</th><th>Runner-up</th></tr></thead><tbody>${rows}</tbody></table></div>${src}`);
    }
    if (u.kind !== 'school') return '';
    const mine = ds.filter((d) => OT.schIs(d.w, u.id) || OT.schIs(d.l, u.id)); if (!mine.length) return '';
    const by = d3.groups(mine, (d) => d.year + '|' + d.cls).map(([k, v]) => { const [year, cls] = k.split('|'); const won = v.filter((d) => OT.schIs(d.w, u.id)).length, lost = v.length - won; const fin = v.find((d) => /championship match/i.test(d.round)); const best = fin ? (OT.schIs(fin.w, u.id) ? 'Champion' : 'Runner-up') : v.some((d) => /semifinal/i.test(d.round) && /championship/i.test(d.round)) ? 'Semifinal' : v.some((d) => /quarterfinal/i.test(d.round) && /championship/i.test(d.round)) ? 'Quarterfinal' : '—'; return { year: +year, cls, won, lost, best, v }; }).sort((a, b) => b.year - a.year);
    const tw = d3.sum(by, (b) => b.won), tl = d3.sum(by, (b) => b.lost), titles = by.filter((b) => b.best === 'Champion').length;
    const rows = by.map((b) => `<tr><td class="num">${b.year}</td><td>${b.cls}</td><td class="num">${b.won}–${b.lost}</td><td>${b.best === 'Champion' ? '<b class="gold">Champion</b>' : b.best}</td><td><small class="ash">${b.v.map((d) => (OT.schIs(d.w, u.id) ? 'W ' + d.ws + '–' + d.ls + ' ' + esc(d.l) : 'L ' + d.ls + '–' + d.ws + ' ' + esc(d.w))).join(' · ')}</small></td></tr>`).join('');
    return section('Team duals', `<div class="card tw"><div class="k" style="margin-bottom:8px">${by.length} appearances · ${tw}–${tl}${titles ? ' · ' + titles + ' title' + (titles > 1 ? 's' : '') : ''}</div><table class="dt"><thead><tr><th>Year</th><th>Class</th><th>Record</th><th>Finish</th><th>Matches</th></tr></thead><tbody>${rows}</tbody></table></div>${src}`);
  }
  /* the one level page: name, rating and score inline → performance chart → rankings → all-time team → seasons */
  /* the page's numbers: four tiles under the title. Region and district: Strength, Talent, Score, Titles; tapping one
     sets what the list under the map shows. Each bar is its percentile among every unit of the same kind statewide in
     this window and class (the line under it says the rank). Strength takes the map colours, Talent the same cold → hot
     ramp, Score and Titles (placements) gold. School: the same four, not tappable (its list is wrestlers). State: one
     metric tile (pick Strength, Talent, Score or Titles: this window against the all-time value, which sits at 4/5 of
     the bar like the average state bracket on the difficulty bars) and Regions, Districts, Schools: the list level,
     each showing its leader in the picked metric. */
  const GOLD = '#D9A441';
  const METRICS = [['rating', 'Strength'], ['talent', 'Talent'], ['score', 'Score'], ['ti', 'Titles']];
  const mval = (m) => (x) => (x && x[m]) || 0;
  const mtxt = (m, v, kind) => (!v ? '–' : m === 'rating' ? OT.r10(v) : m === 'talent' ? OT.talTxt(v, kind) : m === 'score' ? OT.sfmt(v) : fmt(v));
  const MTIP = { rating: (k) => OT.unitRtgTip(k), talent: (k) => `Talent: ${OT.talWhat()}${k === 'school' ? '' : ' per school'} per season`, score: (k) => (k === 'school' ? 'Score: placement points per season' : 'Score: placement points per school per season'), ti: () => 'Titles: individual state champions' };
  const bar = (frac, color, tick) => `<span class="mtb" aria-hidden="true"><em style="width:${(100 * Math.max(0.03, Math.min(1, frac || 0))).toFixed(1)}%;background:${color}"></em>${tick != null ? `<u style="left:${(100 * tick).toFixed(1)}%"></u>` : ''}</span>`;
  const tileHtml = (o) => { const inner = `<i>${o.label}</i><b>${o.val}</b>${o.sub ? `<s>${o.sub}</s>` : ''}${bar(o.frac, o.color, o.tick)}<small>${o.cap}</small>`;
    return o.select ? `<label class="mtile on pick"${o.tip ? ` title="${esc(o.tip)}"` : ''}>${inner}<select data-sortsel="mmetric" aria-label="Metric">${METRICS.map(([k, l]) => `<option value="${k}"${k === o.m ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
      : o.btn ? `<button type="button" class="mtile${o.on ? ' on' : ''}" ${o.btn} aria-pressed="${!!o.on}"${o.tip ? ` title="${esc(o.tip)}"` : ''}>${inner}</button>` : `<div class="mtile"${o.tip ? ` title="${esc(o.tip)}"` : ''}>${inner}</div>`; };
  const curMetric = () => (METRICS.some(([k]) => k === state.mmetric) ? state.mmetric : 'rating');
  const metricColor = (m, kind, v, pct) => (m === 'rating' ? OT.ratingColor(kind, v) || '#2F3640' : m === 'talent' ? OT.colorAt(pct) : GOLD);
  function summary(u) {
    const a = OT.unitAgg(u); if (!a) return '';
    if (u.kind === 'state') return stateTiles(a);
    const L = OT.aggregateCore(u.kind, null, u.kind), id = a.k, cur = curMetric(), tap = u.kind !== 'school';
    const out = METRICS.map(([m, label]) => { const f = mval(m), v = f(a), n = L.length, rank = 1 + L.filter((x) => f(x) > v).length;
      const pct = n > 1 ? (n - rank) / (n - 1) : 1;
      return tileHtml({ label, val: mtxt(m, v, u.kind), frac: v ? pct : 0, color: metricColor(m, u.kind, v, pct), cap: v ? `${ordinal(rank)} of ${fmt(n)}` : 'none', on: tap && m === cur, btn: tap ? `data-mmetric="${m}"` : '',
        tip: MTIP[m](u.kind) + ` · ${ordinal(rank)} of ${fmt(n)} ${plural[u.kind]} statewide; the bar is its percentile` }); });
    return `<div class="mtiles">${out.join('')}</div>`;
  }
  const plural = { school: 'schools', district: 'districts', region: 'regions' };
  /* the state's own value of a metric in the current window: Strength and Talent average the regions' seasons, Score is
     state points per school per season, Titles the champions crowned */
  function stateVal(m) {
    if (m === 'ti') return OT.aggregateCore('school', null, 'state').reduce((t, x) => t + x.ti, 0);
    if (m === 'score') return OT.unitAgg(U.state()).score;
    const L = OT.aggregateCore('region', null, 'state'), key = m === 'talent' ? 'tseries' : 'series', ys = new Map();
    L.forEach((x) => x[key].forEach(([y, v]) => { const z = ys.get(y) || [0, 0]; z[0] += v; z[1]++; ys.set(y, z); }));
    const A = Array.from(ys.values()); return A.length ? A.reduce((t, z) => t + z[0] / z[1], 0) / A.length : 0;
  }
  const allTime = (f) => { const keep = state.win; state.win = { mode: 'all', from: null, to: null }; try { return f(); } finally { state.win = keep; } };
  function stateTiles() {
    const m = curMetric(), label = METRICS.find(([k]) => k === m)[1], v = stateVal(m), all = allTime(() => stateVal(m));
    const frac = m === 'rating' ? OT.domFrac('region', v) : m === 'ti' ? v / (all || 1) : 0.8 * v / (all || 1);
    const tick = m === 'rating' ? (all ? OT.domFrac('region', all) : null) : m === 'ti' ? null : 0.8;
    const lvl = ['region', 'district', 'school'].includes(state.mlevel) ? state.mlevel : OT.mapMode() === 'districts' ? 'district' : 'region';
    const out = [tileHtml({ select: true, m, label: label + ' ▾', val: mtxt(m, v, 'state'), frac, tick, color: m === 'rating' ? OT.ratingColor('region', v) || '#2F3640' : m === 'talent' ? OT.colorAt(frac) : GOLD,
      cap: m === 'ti' ? `of ${fmt(all)} all-time` : `All-time ${mtxt(m, all, 'state')}`, tip: MTIP[m]('region') + ' · statewide, this window against all-time' })];
    [['region', 'Regions'], ['district', 'Districts'], ['school', 'Schools']].forEach(([k, l]) => {
      const L = OT.aggregateCore(k, null, 'state').filter((x) => (k !== 'district' || (x.k >= 1 && x.k <= 12))), f = mval(m);
      const top = L.slice().sort((p, q) => f(q) - f(p))[0], tv = top ? f(top) : 0, mx = tv || 1;
      const nm = top ? (k === 'district' ? 'District ' + top.k : top.name) : '';
      out.push(tileHtml({ label: l, val: mtxt(m, tv, k), sub: esc(nm), frac: m === 'rating' ? OT.domFrac(k, tv) : tv / mx, color: m === 'rating' ? OT.ratingColor(k, tv) || '#2F3640' : m === 'talent' ? OT.colorAt(1) : GOLD,
        cap: `Top of ${fmt(L.length)}`, on: k === lvl, btn: `data-mlevel="${k}"`, tip: `List the ${l.toLowerCase()} by ${label}; the tile shows the top one` }));
    });
    return `<div class="mtiles st">${out.join('')}</div>`;
  }
  /* The place page has three tabs, and the line under the title always says which time it shows:
     Overview (map and tiles, or a school's season grid) and All-time take a range of seasons (the scrubber);
     Season takes one year (‹ year ›). */
  const VIEWS = ['map', 'season', 'all'];
  const lastYear = () => OT.YEARS[OT.YEARS.length - 1];
  const seasonYear = () => { const y = +qv('y') || state.sy; return OT.YEARS.includes(y) ? y : lastYear(); };
  /* run f with the window set to one season (caches are keyed by the window, so nothing leaks) */
  const inYear = (y, f) => { const keep = state.win; state.win = { mode: 'custom', from: y, to: y }; try { return f(); } finally { state.win = keep; } };
  const yearPick = (y) => { const ys = OT.YEARS, i = ys.indexOf(y), prev = ys[i - 1], next = ys[i + 1];
    const arrow = (z, t) => (z ? `<button type="button" class="chipb tya" data-qset="y:${z}" aria-label="Season ${z}">${t}</button>` : `<span class="chipb tya off" aria-hidden="true">${t}</span>`);
    return `<div class="tline typick">${arrow(prev, '‹')}<select data-qsel="y" aria-label="Season">${ys.slice().reverse().map((k) => `<option value="${k}"${k === y ? ' selected' : ''}>${k}</option>`).join('')}</select>${arrow(next, '›')}</div>`; };
  const rangeLine = () => `<div class="tline">${OT.timeScrubber({ pre: true })}</div>`;
  function levelPage(u, opts = {}) {
    state.lvl = 'state';
    const v = VIEWS.includes(state.view) ? state.view : 'map';
    const VN = { season: 'Season', all: 'All-time' };
    const act = opts.action || '';
    const time = v === 'season' ? yearPick(seasonYear()) : rangeLine();
    const head = v === 'map' ? `<header class="uh2 uhc"><div class="uht"><h1>${esc(u.name)}</h1>${act}</div>${time}${summary(u)}</header>`
      : `<header class="uh2 uhc uhs"><div class="uht"><h1>${esc(u.name)}<span class="uhv">${VN[v]}</span></h1>${act}</div>${time}</header>`;
    const parts = [head];
    if (v === 'season') parts.push(seasonView(u));
    else if (v === 'all') parts.push(allView(u, opts));
    else if (u.kind === 'school') {
      const rk = wrestlerRank(OT.unitRows(u), { limit: 15, noSchool: true });
      parts.push(`<section class="sec">${OT.perfChart(u)}</section>`, `<section class="sec"><div class="sech"><h2>Best wrestlers</h2><span class="ctl">${rk.sortSeg || ''}</span></div>${rk.html}</section>`, section('Roster', rosterBlock(u)));
    } else { const map = OT.ratingMap(u); if (map) parts.push(`<section class="sec secmap">${map}</section>`); }
    return parts.join('');
  }
  /* ---------- Season: one year at this place ---------- */
  const SEASON_TABS = [['medals', 'Medals'], ['team', 'Team'], ['brk', 'Brackets'], ['up', 'Upsets']];
  function seasonView(u) {
    const y = seasonYear(); state.sy = y;
    const s = SEASON_TABS.some(([k]) => k === qv('s')) ? qv('s') : 'medals';
    const row = `<div class="rkk">${qseg('s', SEASON_TABS, s)}</div>`;
    if (s === 'brk') return row + `<section class="sec">${bracketsView(u, y)}</section>`;
    return row + `<section class="sec">${inYear(y, () => (s === 'team' ? seasonTeam(u, y) : s === 'up' ? recordsView(u, 'upsets') : seasonMedals(u, y)))}</section>`;
  }
  /* the place's state medals that season, weight by weight */
  function seasonMedals(u, y) {
    const mine = rowIn(u);
    const pod = OT.APP.filter((r) => r.year === y && r.place && inClsP(r.cls) && mine(r) && (!state.f.weights.length || state.f.weights.includes(OT.stdOf(r).k)))
      .sort((a, b) => a.wn - b.wn || a.place - b.place);
    if (!pod.length) return empty('No state medals here this season.');
    const byW = d3.groups(pod, (r) => (state.cls === 'ALL' ? r.cls + ' ' : '') + r.w);
    return `<div class="card smed">${OT.podiumC(placeCounts(pod), { sm: true })}${byW.map(([, rs]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(rs[0]))}">${state.cls === 'ALL' && rs[0].cls !== 'single' ? `<small>${rs[0].cls}</small> ` : ''}${OT.wShort(rs[0].w)}</a><div class="ps">${rs.map((r) => `<span><i style="color:${OT.MED[r.place - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` ${OT.stag(r.sch, { abbr: true })}`} ${(() => { const v = OT.ratingOf(r, 'state'); return v ? `<b class="smr">${OT.rtgBars(v)}${OT.rw(v)}</b>` : ''; })()}</span>`).join('')}</div></div>`).join('')}</div>`;
  }
  /* the team side of the season: the state tournament's team scores and the duals final (State), the place's schools that
     season (Region, District), the school's own finish and duals (School) */
  function seasonTeam(u, y) {
    if (u.kind === 'state') return stateTeams(y);
    if (u.kind === 'school') return seasonsDrawer(u) + dualsBlock(u);
    const r = OT.unitRankings('school', { kind: u.kind, id: u.id }, u.kind);
    return typeof r === 'string' ? r : `<div class="sech sechs"><span class="ctl">${r.sortSeg || ''}</span></div>${r.html}`;
  }
  /* ---------- All-time: a range of seasons at this place ---------- */
  function allView(u, opts) {
    const units = opts.units || [];
    const groups = (units.length ? [['schools', 'Schools', units.map(([k]) => k)]] : [])
      .concat([['wrestlers', 'Wrestlers', ['wrestlers']], ['teams', 'Teams', ['team', 'seasons']], ['records', 'Records', ['records']], ['trend', 'Trend', ['trend']]]);
    const all = groups.flatMap((g) => g[2]);
    const kind = all.includes(state.child) ? state.child : all[0];
    const g = groups.find((x) => x[2].includes(kind));
    const top = `<div class="seg sm rkseg">${groups.map(([, l, ks]) => `<button type="button" data-kind="${ks[0]}" aria-pressed="${ks.includes(kind)}">${l}</button>`).join('')}</div>`;
    const subs = g[0] === 'schools' && units.length > 1 ? units : g[0] === 'teams' ? [['team', 'All-time team'], ['seasons', 'Best seasons']] : null;
    const sub = subs ? `<div class="seg sm rkseg">${subs.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join('')}</div>` : '';
    let rk;
    if (kind === 'wrestlers') rk = wrestlerRank(OT.unitRows(u), { limit: 25, noSchool: u.kind === 'school' });
    else if (kind === 'seasons') rk = OT.seasonRankings(u.kind === 'state' ? null : { kind: u.kind, id: u.id });
    else if (kind === 'team') rk = { html: `<div class="atsec">${OT.teamGrid(u)}</div>` };
    else if (kind === 'records') rk = { html: recordsView(u) };
    else if (kind === 'trend') rk = { html: `<div class="tlsec">${OT.timelineView(u)}</div>` };
    else rk = unitRank(kind, opts.parent || null, u.kind, '');
    return `<div class="rkk">${top}</div>${sub ? `<div class="rkk">${sub}</div>` : ''}<section class="sec">${rk.sortSeg || rk.toggle ? `<div class="sech sechs"><span class="ctl">${rk.sortSeg || ''}</span></div>` : ''}${rk.toggle ? `<div class="rkk">${rk.toggle}</div>` : ''}${rk.html}</section>`;
  }
  /* the current address's query, and a choice row that rewrites one of its parameters in place */
  const qv = (k) => new URLSearchParams((location.hash.split('?')[1]) || '').get(k) || '';
  const qseg = (k, items, cur) => `<div class="seg sm rkseg">${items.map(([v, l]) => `<button type="button" data-qset="${k}:${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
  const inClsP = (c) => state.cls === 'ALL' || c === state.cls || c === 'single';
  /* is a medal or bracket row (state APP or district/regional LOWER) from this place? */
  const rowIn = (u) => u.kind === 'state' ? () => true : u.kind === 'school' ? (r) => OT.schIs(r.sch, u.id)
    : u.kind === 'district' ? (r) => (r.d || OT.schoolDistrict(r.sch)) === u.id : (r) => (r.lvl ? r.region : OT.regionOf(r)) === u.id;
  /* Brackets: every bracket on record for one season at one level, scoped to the place; the latest season and the
     state tournament first. A weight with this place's placers in it is marked. */
  function bracketsView(u, y) {
    const lvs = [['state', 'State'], ['regional', 'Regional'], ['district', 'District']];
    const lv = lvs.some(([k]) => k === qv('bl')) ? qv('bl') : 'state';
    const mine = rowIn(u), cn = (c) => (c === 'single' ? 'One class' : c);
    const src = lv === 'state' ? OT.APP.filter((r) => r.year === y) : OT.LOWER.filter((r) => r.year === y && r.lvl === lv);
    const rs = src.filter((r) => inClsP(r.cls));
    /* a regional or district tournament belongs to the place when one of its placers does (a region's own regional) */
    const units = lv === 'state' ? null : new Set(rs.filter((r) => (lv === 'regional' && u.kind === 'region' ? r.unit === u.id : mine(r))).map((r) => r.unit));
    const keep = rs.filter((r) => !units || units.has(r.unit));
    const nameOf = (r) => (lv === 'state' ? 'State championships' : OT.unitLabel(lv, r.unit));
    const groups = d3.groups(keep, nameOf, (r) => r.cls).map(([nm, byC]) => byC.map(([c, v]) => {
      const byW = d3.groups(v, (r) => r.wn).sort((a, b) => a[0] - b[0]);
      /* mark only when the tournament is wider than the place (a district's own district bracket is all its own) */
      const mark = u.kind === 'school' || (u.kind === 'district' && lv !== 'district') || (u.kind === 'region' && lv === 'state');
      const chips = byW.map(([, g]) => { const n = mark ? g.filter(mine).length : 0;
        return `<a class="twl${n ? ' has' : ''}" href="${OT.bhref(OT.bkey(g[0], lv))}">${g[0].wn}${n ? `<i>${n}</i>` : ''}</a>`; }).join('');
      return { nm, c, html: `<div class="tbrow"><span class="tbn"><b>${esc(nm)}</b><small>${cn(c)}</small></span><span class="tbws">${chips}</span></div>` }; })).flat()
      .sort((a, b) => (parseInt(a.nm.replace(/\D+/, ''), 10) || 0) - (parseInt(b.nm.replace(/\D+/, ''), 10) || 0) || a.nm.localeCompare(b.nm) || a.c.localeCompare(b.c));
    return `<div class="rkk">${qseg('bl', lvs, lv)}</div>` + (groups.length ? `<div class="card tlist">${groups.map((g) => g.html).join('')}</div>` : empty('No brackets on record here this season.'));
  }
  /* Records (a Rankings choice): the biggest upsets, upsets at states, the giant killers and the most state titles,
     for this place (the winner's school), class and seasons */
  function recordsView(u, fixed) {
    const kinds = [['upsets', 'Upsets'], ['states', 'At states'], ['killers', 'Giant killers'], ['titles', 'Most titles']].concat(u.kind === 'state' || u.kind === 'school' ? [['duals', 'Duals']] : []);
    const k = fixed || (kinds.some(([x]) => x === qv('rc')) ? qv('rc') : 'upsets');
    const seg = fixed ? '' : `<div class="rkk">${qseg('rc', kinds, k)}</div>`;
    if (k === 'duals') return seg + (dualsBlock(u) || empty('No PIAA team duals here in this window.'));
    const UP = OT.upsets(); if (!UP || !UP.all) return seg + '<div class="card"><div class="muted bwl" data-need-upsets="1">Loading…</div></div>';
    const sch = (r) => r[8], inPlace = u.kind === 'state' ? () => true : u.kind === 'school' ? (r) => OT.schIs(sch(r), u.id)
      : u.kind === 'district' ? (r) => OT.schoolDistrict(sch(r)) === u.id : (r) => OT.schoolRegion(sch(r)) === u.id;
    const A = UP.all.filter((r) => inClsP(r[1]) && OT.inWindow(r[0]) && inPlace(r));
    const wl = (name, s) => `<a href="#wrestler/${OT.slug(name)}--${OT.slug(s)}">${esc(name)}</a>`;
    if (k === 'titles') {
      const ws = OT.wrestlersOf(OT.careerRows(OT.unitRows(u))).filter((w) => w.titles > 0).sort((a, b) => b.titles - a.titles || (b.rtg ? b.rtg.peak : 0) - (a.rtg ? a.rtg.peak : 0)).slice(0, 50);
      return seg + (ws.length ? `<div class="card"><ol class="slist">${ws.map((w, i) => `<li><span class="sw">${i + 1}</span><span class="sn"><b><a href="${w.href}">${esc(w.name)}</a></b><small>${OT.stag(w.sch, { abbr: true })} ${w.years}</small></span><span class="sr">${w.titles} <i>title${w.titles === 1 ? '' : 's'}</i></span></li>`).join('')}</ol></div>` : empty('No state champions here in this window.'));
    }
    if (k === 'killers') {
      const K = new Map(); A.forEach((r) => { const key = r[7] + '|' + r[8]; const p = oddsOf(r[14], r[15]); const x = K.get(key) || { name: r[7], sch: r[8], n: 0, best: 1, y0: r[0], y1: r[0], st: 0 };
        x.n++; x.best = Math.min(x.best, p); x.y0 = Math.min(x.y0, r[0]); x.y1 = Math.max(x.y1, r[0]); if (r[2] === 'state') x.st++; K.set(key, x); });
      const L = Array.from(K.values()).sort((a, b) => b.n - a.n || a.best - b.best).slice(0, 50);
      return seg + (L.length ? `<div class="card"><ol class="slist">${L.map((x, i) => `<li><span class="sw">${i + 1}</span><span class="sn"><b>${wl(x.name, x.sch)}</b><small>${OT.stag(x.sch, { abbr: true })} ${x.y0 === x.y1 ? x.y0 : x.y0 + '–' + x.y1}${x.st ? ` · ${x.st} at states` : ''} · best ${pct(x.best)}</small></span><span class="sr">${x.n} <i>upset${x.n === 1 ? '' : 's'}</i></span></li>`).join('')}</ol></div>` : empty('No upsets here in this window.'));
    }
    const L = (k === 'states' ? A.filter((r) => r[2] === 'state') : A).slice(0, 50);
    const where = (r) => (r[2] === 'state' ? 'States' : OT.unitLabel(r[2], r[3]));
    const key = (r) => (r[2] === 'state' ? `${r[0]}.${r[1]}.state.${OT.wNum(r[4])}` : `${r[0]}.${r[1]}.${r[2]}.${r[3]}.${OT.wNum(r[4])}`);
    return seg + (L.length ? `<div class="card"><ol class="bw h2m">${L.map((r) => `<li><a href="${OT.bhref(key(r))}"><span class="bwn"><b>${esc(r[7])} over ${esc(r[9])}</b><small>${r[0]} · ${esc(where(r))} · ${OT.wShort(r[4])} · ${RN(r[5], r[6])} · ${[RES[r[11]] || r[11], r[12]].filter(Boolean).join(' ')} · ${OT.rw(r[14])} vs ${OT.rw(r[15])}</small></span><span class="bwr"><b>${pct(oddsOf(r[14], r[15]))}</b><i>odds</i></span></a></li>`).join('')}</ol></div>` : empty('No upsets here in this window.'));
  }
  const KN = { school: 'Rankings', district: 'Rankings', region: 'Rankings' };
  const unitRank = (kind, parent, pageKind, toggle) => { const r = OT.unitRankings(kind, parent, pageKind); return typeof r === 'string' ? { title: KN[kind], toggle, html: r } : { title: KN[kind], toggle, sortSeg: r.sortSeg, html: r.html }; };
  /* wrestlers ranked by peak rating (or weighted score); the window decides who is in, the whole career counts */
  const wScore = (w) => { const low = w.lower || OT.lowerFor(w.apps); return d3.sum(w.apps, (a) => a.place ? OT.PTS[a.place - 1] : 0) + 0.4 * d3.sum(low.filter((r) => r.lvl === 'regional'), (r) => r.place ? OT.PTS[r.place - 1] || 0 : 0) + 0.15 * d3.sum(low.filter((r) => r.lvl === 'district'), (r) => r.place ? OT.PTS[r.place - 1] || 0 : 0); };
  function wrestlerRank(rows, opts = {}) {
    const sorts = [['rating', 'Rating'], ['score', 'Score']]; const sort = state.wsort === 'score' ? 'score' : 'rating';
    const ws = OT.wrestlersOf(OT.careerRows(rows));
    ws.forEach((w) => { const c = w.rtg; w.peak = c ? c.peak : 0; if (sort === 'score') w.sc = wScore(w); });
    ws.sort(sort === 'score' ? (a, b) => b.sc - a.sc || b.peak - a.peak : (a, b) => b.peak - a.peak || b.titles - a.titles);
    const lim = state.uall ? Math.min(ws.length, 200) : opts.limit || 25;
    const sortSeg = OT.sortSelect('wsort', sorts, sort);
    const more = ws.length > (opts.limit || 25) ? `<div class="bmore"><button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Show top ' + (opts.limit || 25) : 'Show ' + Math.min(ws.length, 200) + (ws.length > 200 ? ' of ' + fmt(ws.length) : '')}</button></div>` : '';
    return { title: opts.title || 'Rankings', sortSeg, html: ws.length ? `<div class="wkl">${OT.wlegend()}${ws.slice(0, lim).map((w, i) => OT.wrestlerCard(w, i + 1, { noSchool: opts.noSchool })).join('')}</div>${more}` : empty('No state qualifiers in this window.'), n: ws.length };
  }

  const PAGES = {};
  PAGES.state = () => levelPage(U.state(), { units: [['school', 'Schools'], ['district', 'Districts'], ['region', 'Regions']] });
  PAGES.region = (id) => levelPage(U.region(id), { units: [['school', 'Schools'], ['district', 'Districts']], parent: { kind: 'region', id } });
  /* "Missing from the archive": seasons the bracket archive itself marks as incomplete (WR_MISSING, tools/build_missing.js) */
  const MISS = window.WR_MISSING || { t: [], m: [], r: [] };
  const yearRuns = (ys) => { const out = []; ys.forEach((y) => { const l = out[out.length - 1]; if (l && y === l[1] + 1) l[1] = y; else out.push([y, y]); }); return out.map(([a, b]) => a === b ? a : a + '–' + String(b).slice(2)).join(', '); };
  const missingRows = (d) => { const seen = new Set(); return MISS.r.filter((r) => { if (d != null && r[0] !== d) return false; const [, lvl, cls] = MISS.t[r[1]]; if (d != null && lvl === 'state') return false; if (d != null && state.cls !== 'ALL' && cls !== state.cls && cls !== 'single') return false; const k = r[1] + '|' + r[2]; if (seen.has(k)) return false; seen.add(k); return true; }); };
  function missingBlock(d) {
    const rows = missingRows(d); if (!rows.length) return '';
    const g = d3.groups(rows, (r) => r[1] + '|' + r[3]).map(([, v]) => ({ t: MISS.t[v[0][1]], m: MISS.m[v[0][3]].replace(/\.$/, ''), ys: v.map((r) => r[2]).sort((a, b) => a - b) }))
      .sort((a, b) => a.t[0].localeCompare(b.t[0]) || a.ys[0] - b.ys[0]);
    const body = g.map((x) => `<div class="mrow"><span class="mt">${esc(x.t[0])}</span><span class="my num">${yearRuns(x.ys)}</span><span class="mm muted">${esc(x.m)}</span></div>`).join('');
    const seasons = new Set(rows.map((r) => r[1] + '|' + r[2])).size;
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${seasons}</b> <span class="muted">incomplete tournaments</span></span><span class="k">Open</span></summary><div class="body mlist">${body}</div></details>`;
  }
  PAGES.district = (id) => levelPage(U.district(+id), { units: [['school', 'Schools']], parent: { kind: 'district', id: +id } });
  PAGES.school = (sl) => {
    const name = SCHOOL_BY_SLUG.get(sl) || OT.SLUG2S.get(sl); if (!name) return `<header class="uh2"><h1>Not found</h1></header>` + empty('No school at this address.');
    return levelPage(U.school(name), { action: `<a class="cmpb" href="#h2hs/${sl}~" aria-label="Compare ${esc(name)} with another school">Compare</a>` });
  };
  /* a school's roster: everyone who wrestled for it in any bracket (the people index, loaded on demand) */
  function rosterBlock(u) {
    if (!OT.peopleLoaded()) return '<div class="card empty" data-need-people="1">Loading the roster…</div>';
    const ps = OT.peopleOf(u.id); if (!ps.length) return empty('No one on record.');
    const y0 = d3.min(ps, (p) => p.y0), y1 = d3.max(ps, (p) => p.y1);
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${fmt(ps.length)}</b> <span class="muted">wrestlers · ${y0}–${y1}</span></span><span class="k">Open</span></summary><div class="body plist">${ps.map(personRow).join('')}</div></details>`;
  }
  const bestTxt = (p) => (p.lvl ? `${p.lvl[0].toUpperCase() + p.lvl.slice(1)} ${p.place ? ordinal(p.place) : p.lvl === 'state' ? 'qualifier' : 'entrant'}` : '');
  const personRow = (p) => `<a class="prr" href="#wrestler/${p.slug}"><span class="pn"><b>${esc(p.name)}</b><small>${esc(p.sch)} · ${p.y0 === p.y1 ? p.y0 : p.y0 + '–' + p.y1}</small></span><span class="pb ${p.place ? 'm' + Math.min(p.place, 5) : ''}">${bestTxt(p)}</span>${p.peak ? OT.rtgTag(p.peak, { size: 'sm' }) : '<span></span>'}</a>`;
  OT.personRow = personRow;
  PAGES.wrestler = (sl) => {
    const W = OT.getWrestler(sl);
    if (!W) return OT.peopleLoaded() ? `<header class="uh"><h1>Not found</h1></header>` + empty('No wrestler at this address.') : `<header class="uh"><h1>Loading…</h1></header><div class="card empty" data-need-people="1">Looking up this wrestler…</div>`;
    if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const u = U.school(W.sch); const places = placeCounts(W.rows);
    const all = W.apps.concat(W.lower); const first = all.length ? d3.min(all, (r) => r.year) : W.person && W.person.y0, last = all.length ? d3.max(all, (r) => r.year) : W.person && W.person.y1;
    const cr = OT.careerRating(W.apps, W.lower);
    const yrs = OT.yearsOf(W.apps, W.lower);
    /* the header: peak rating (with its signal bars), career average and titles by level; the wins and every result are in Career below */
    const tD = W.lower.filter((r) => r.lvl === 'district' && r.place === 1).length, tR = W.lower.filter((r) => r.lvl === 'regional' && r.place === 1).length, tS = places[0];
    const sumI = (cr ? [[`${OT.rtgBars(cr.peak)}${OT.rw(cr.peak)}`, 'Peak RTG'], [OT.rw(cr.avg), 'Career avg']] : []).concat([[`${tD + tR + tS}<small>${[['D', tD], ['R', tR], ['S', tS]].map(([l, n]) => `<span>${l}${n}</span>`).join('')}</small>`, 'Titles']]);
    const head = `<header class="uh2"><div class="crumb"><a href="#state">Pennsylvania</a><span>›</span><a href="#district/${W.d}">District ${W.d}</a><span>›</span><a href="${u.href}">${esc(W.sch)}</a></div>
      <div class="whd"><h1>${esc(W.name)}</h1><a class="cmpb" href="#h2h/${W.slug}~" aria-label="Compare ${esc(W.name)} with another wrestler">Compare</a></div><div class="sub wsub">${OT.stag(W.sch)}<span>${first === last ? first : first + '–' + last}</span>${W.lowerOnly && !W.apps.length ? ' · never reached states' : ''}</div>
      <div class="wqts wqhero"${OT.bwLoaded() ? '' : ' data-need-bw="1"'}>${sumI.map(([v, l]) => `<span class="wqt"><i>${l}</i><b>${v}</b></span>`).join('')}</div></header>`;
    const wt4 = OT.winTypesOf(W.name, yrs), rc = OT.recordOf(W.name, yrs);
    const tl = section('Career', `<div class="card cgcard cdcard"${OT.bwLoaded() ? '' : ' data-need-bw="1"'}>${OT.seasonRows(W.apps, W.lower, { full: W.full, link: true, sr: cr ? cr.seasons : [] })}<div class="wtw">${OT.winBar(wt4, rc)}${OT.winKey()}</div>${W.full ? '' : '<div class="note">Loading his full career…</div>'}</div>`);
    const bw = section('Best wins', `<div class="card" id="bestwins" data-w="${W.slug}">${bestWinsHTML(W)}</div>`);
    return head + tl + bw;
  };
  /* head to head: two wrestlers, every bout between them, and the odds at their best */
  const pct = (p) => (p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(100 * p) + '%');
  const h2hOdds = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  /* how a bout between the two ends: A's fall / tech / major / decision on the left, B's on the right, each piece as wide
     as its chance (rating decides who wins, each wrestler's own record of wins and losses by type decides how) */
  function h2hHow(A, ca, B, cb, p) {
    const sa = OT.styleOf(A, ca.peakYear), sb = OT.styleOf(B, cb.peakYear), ma = OT.styleMix(ca.peak - cb.peak, sa, sb), mb = OT.styleMix(cb.peak - ca.peak, sb, sa);
    if (!ma || !mb) return '';
    const K = ['d', 'm', 't', 'f'], N = ['decision', 'major', 'tech fall', 'fall'];
    const seg = (q, k, who) => (q < 0.005 ? '' : `<span class="${K[k]}" style="flex:${q.toFixed(4)}" title="${esc(who)} by ${N[k]} ${pct(q)}">${q >= 0.07 ? Math.round(100 * q) : ''}</span>`);
    const left = [3, 2, 1, 0].map((k) => seg(p * ma[k], k, A.name)).join(''), right = [0, 1, 2, 3].map((k) => seg((1 - p) * mb[k], k, B.name)).join('');
    return `<div class="h2how"><div class="wtb">${left}<i class="h2mid"></i>${right}</div>${OT.winKey ? `<div class="h2hk">${OT.winKey(true)}</div>` : ''}</div>`;
  }
  const h2hIds = (id) => { const [a, b] = String(id || '').split('~'); return [a || '', b || '']; };
  function h2hPick(side, W, other) {
    const ph = side === 'a' ? 'First wrestler' : 'Second wrestler';
    return `<div class="h2p" data-h2side="${side}"><input class="search h2i" type="search" placeholder="${W ? esc(W.name) + ' · change' : 'Search ' + ph.toLowerCase()}" autocomplete="off" aria-label="${ph}" data-h2other="${esc(other || '')}"><div class="h2l"></div>
      ${W ? `<div class="h2w"><a href="#wrestler/${W.slug}"><b>${esc(W.name)}</b></a><small>${esc(W.sch)}</small></div>` : `<div class="h2w muted">${ph}</div>`}</div>`;
  }
  PAGES.h2h = (id) => {
    const [sa, sb] = h2hIds(id); const A = sa ? OT.getWrestler(sa) : null, B = sb ? OT.getWrestler(sb) : null;
    const need = (sa && !A) || (sb && !B);
    const head = `<header class="uh2"><h1>Compare</h1></header>${h2hTabs('w')}
      <div class="card h2pick">${h2hPick('a', A, sb)}<span class="h2vs">vs</span>${h2hPick('b', B, sa)}</div>`;
    if (need) return head + (OT.peopleLoaded() ? empty('No wrestler at this address.') : '<div class="card empty" data-need-people="1">Looking up the wrestlers…</div>');
    if (!A || !B) return head;
    if (A.slug === B.slug) return head + empty('Pick two different wrestlers.');
    [A, B].forEach((W) => { if (!W.lower) W.lower = OT.lowerFor(W.apps); });
    const ready = A.full && B.full && OT.yearsOf(A.apps, A.lower).concat(OT.yearsOf(B.apps, B.lower)).every((y) => OT.sosLoaded(y));
    const ca = OT.careerRating(A.apps, A.lower), cb = OT.careerRating(B.apps, B.lower);
    let odds = '';
    if (ca && cb) { const p = h2hOdds(ca.peak, cb.peak);
      odds = section('At their best', `<div class="card"><div class="usum"><span><b>${pct(p)}</b><i>${esc(A.name)} · peak ${OT.rw(ca.peak)} (${ca.peakYear})</i></span><span><b>${pct(1 - p)}</b><i>${esc(B.name)} · peak ${OT.rw(cb.peak)} (${cb.peakYear})</i></span></div>${ready ? h2hHow(A, ca, B, cb, p) : ''}<div class="note">Odds for one bout between each at his best season, ${Math.abs(Math.round(ca.peak - cb.peak))} points apart. Weight, style and the day decide a real bout.</div></div>`); }
    else odds = section('At their best', `<div class="card"><div class="note">${esc((ca ? B : A).name)} has no season rating (first-round exits carry none), so there are no odds.</div></div>`);
    let met;
    if (!ready) met = '<div class="muted bwl">Loading their bouts…</div>';
    else { const M = OT.meetings(A, B); const wa = M.filter((m) => m.aWon).length;
      met = !M.length ? '<div class="muted bwl">They never met in a bracket on record.</div>'
        : `<div class="usum"><span><b>${wa}–${M.length - wa}</b><i>${esc(A.name)}'s record against ${esc(B.name)}</i></span></div><ol class="bw h2m">${M.map((m) => { const win = m.aWon ? A : B, los = m.aWon ? B : A; const rw = m.aWon ? m.ra : m.rb, rl = m.aWon ? m.rb : m.ra;
          return `<li><a href="${OT.bhref(m.key)}"><span class="bwn"><b>${esc(win.name)} over ${esc(los.name)}</b><small>${m.year} · ${m.lvl} · ${OT.wShort(m.w)} · ${RN(m.side, m.round)} · ${[RES[m.result] || m.result, m.score, m.flags].filter(Boolean).join(' ')}${rw != null && rl != null ? ` · ${OT.rw(rw)} vs ${OT.rw(rl)}, ${pct(h2hOdds(rw, rl))} for the winner` : ''}</small></span></a></li>`; }).join('')}</ol>`; }
    return head + section('Meetings', `<div class="card" id="h2hmeet">${met}</div>`) + odds;
  };
  /* head to head, schools: bouts between their wrestlers, PIAA team duals, and dual-meet odds from each season's lineup */
  /* Wrestlers / Schools / Seasons; from a school pair, Seasons opens that school's seasons to pick from */
  /* Compare: one tool, three things to compare; the same choice row on all three */
  const h2hTabs = (on, sl) => `<div class="rkk"><div class="seg sm rkseg">${[['w', 'Wrestlers', '#h2h/'], ['s', 'Schools', '#h2hs/'], ['d', 'Seasons', '#dual/~' + (sl ? '?pick=a&s=' + sl : '')]].map(([k, l, h]) => `<a href="${h}" aria-pressed="${on === k}">${l}</a>`).join('')}</div></div>`;
  OT.h2hTabs = h2hTabs;
  function h2hsPick(side, name, other) {
    const ph = side === 'a' ? 'First school' : 'Second school';
    return `<div class="h2p" data-h2side="${side}"><input class="search h2i" data-h2kind="s" type="search" placeholder="${name ? esc(name) + ' · change' : 'Search ' + ph.toLowerCase()}" autocomplete="off" aria-label="${ph}" data-h2other="${esc(other || '')}"><div class="h2l"></div>
      ${name ? `<div class="h2w"><a href="#school/${OT.slug(name)}"><b>${esc(name)}</b><small>${OT.schoolDistrict(name) ? 'District ' + OT.schoolDistrict(name) : ''}</small></a></div>` : `<div class="h2w muted">${ph}</div>`}</div>`;
  }
  PAGES.dual = (id, q) => OT.dualPage(id, q);
  PAGES.h2hs = (id) => {
    const [sa, sb] = h2hIds(id); const nA = sa ? OT.SLUG2S.get(sa) : null, nB = sb ? OT.SLUG2S.get(sb) : null;
    const head = `<header class="uh2"><h1>Compare</h1></header>${h2hTabs('s', sa)}
      <div class="card h2pick">${h2hsPick('a', nA, sb)}<span class="h2vs">vs</span>${h2hsPick('b', nB, sa)}</div>`;
    if ((sa && !nA) || (sb && !nB)) return head + empty('No school at this address.');
    if (!nA || !nB) return head;
    if (sa === sb) return head + empty('Pick two different schools.');
    if (!OT.h2hsLoaded(sa) || !OT.h2hsLoaded(sb)) return head + '<div class="card"><div class="muted bwl" data-need-h2hs="1">Loading both schools…</div></div>';
    const A = OT.h2hsOf(sa) || { L: {}, o: {} }, B = OT.h2hsOf(sb) || { L: {}, o: {} };
    const bouts = new Map(((A.o || {})[B.n || nB] || []).map(([y, w, l]) => [y, [w, l]]));
    const odds = new Map(); Object.keys(A.L).forEach((y) => { if (B.L[y]) odds.set(+y, OT.dualOdds(A.L[y][1], B.L[y][1])); });
    const ys = Array.from(new Set([...bouts.keys(), ...odds.keys()])).sort((a, b) => b - a);
    const tw = d3.sum(Array.from(bouts.values()), (v) => v[0]), tl = d3.sum(Array.from(bouts.values()), (v) => v[1]);
    const short = (n) => esc(n);
    let meet;
    if (!ys.length) meet = '<div class="muted bwl">Their wrestlers never met in a bracket on record, and they never had lineups on file in the same season.</div>';
    else meet = `${bouts.size ? `<div class="usum"><span><b>${tw}–${tl}</b><i>${short(nA)} wrestlers against ${short(nB)}</i></span><span><b>${bouts.size}</b><i>seasons they met</i></span></div>` : '<div class="note">Their wrestlers never met in a bracket on record.</div>'}
      ${(() => { const row = (y) => { const b = bouts.get(y), o = odds.get(y);
          return `<tr><td class="num">${y}</td><td class="num">${b ? `${b[0]}–${b[1]}` : '<span class="ash">–</span>'}</td><td class="num"${o ? ` title="${short(nA)} would win ${o.exp.toFixed(1)} of ${o.n} bouts on average"` : ''}>${o ? `<b>${pct(o.p)}</b>` : '<span class="ash">–</span>'}</td></tr>`; };
        const th = `<thead><tr><th>Year</th><th>Bouts</th><th>Dual odds</th></tr></thead>`;
        return `<table class="dt h2st">${th}<tbody>${ys.slice(0, 15).map(row).join('')}</tbody></table>${ys.length > 15 ? `<details class="h2more"><summary>${ys.length - 15} earlier seasons</summary><table class="dt h2st">${th}<tbody>${ys.slice(15).map(row).join('')}</tbody></table></details>` : ''}`; })()}
      <div class="note">Bouts: every postseason bout between the two schools' wrestlers that year (sections, districts, regionals, states; forfeits left out), from ${short(nA)}'s side. Dual odds: ${short(nA)}'s chance in a dual meet against ${short(nB)} that season. The two lineups that year wrestled weight by weight, each bout at the two wrestlers' season ratings, a weight with nobody entered a forfeit. It counts bouts won, not team points, and only seasons where both schools' full district fields are on file have a lineup.</div>`;
    const DM = DUALS.filter((d) => (OT.slug(d.w) === sa && OT.slug(d.l) === sb) || (OT.slug(d.w) === sb && OT.slug(d.l) === sa)).sort((a, b) => b.year - a.year);
    const duals = DM.length ? section('PIAA team duals', `<div class="card"><table class="dt h2st"><tbody>${DM.map((d) => `<tr><td class="num">${d.year}</td><td><b>${esc(d.w)}</b> ${d.ws}–${d.ls}<br><small class="ash">${esc(d.round)}</small></td></tr>`).join('')}</tbody></table></div>`) : '';
    const best = (X) => { let b = null; Object.entries(X.L).forEach(([y, [st, L]]) => { if (!b || st > b.s) b = { y: +y, s: st, L }; }); return b; };
    const ba = best(A), bb = best(B);
    const peak = ba && bb ? (() => { const o = OT.dualOdds(ba.L, bb.L, ba.y !== bb.y); return section('At their best', `<div class="card"><div class="usum"><span><b>${pct(o.p)}</b><i>${short(nA)} ${ba.y} · Strength ${OT.rw(ba.s)}</i></span><span><b>${pct(1 - o.p)}</b><i>${short(nB)} ${bb.y} · Strength ${OT.rw(bb.s)}</i></span></div><div class="note">Each school's strongest lineup on file, wrestled weight by weight: ${short(nA)} would win ${o.exp.toFixed(1)} of ${o.n} bouts on average. Weight classes changed over the years: each weight is matched to the nearest of today's, and when the two seasons differ only the weights both had are wrestled.</div></div>`); })()
      : section('At their best', `<div class="card"><div class="note">${short(ba ? nB : nA)} has no season with its full district field on file, so there is no lineup to match.</div></div>`);
    return head + section('Meetings', `<div class="card">${meet}</div>`) + duals + peak;
  };
  /* season recap: one season on one page — champions and their finals, team scores and duals, the strongest wrestlers,
     the biggest upsets, titles by district, and the season's numbers */
  const oddsOf = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  /* the state tournament's team scores (top five) and the PIAA team duals final, for each class that season */
  function stateTeams(y) {
    const cn = (c) => (c === 'single' ? 'One class' : 'Class ' + c);
    const classes = Array.from(new Set(OT.APP.filter((r) => r.year === y && inClsP(r.cls)).map((r) => r.cls))).sort((a, b) => (a === 'AAA' ? -1 : b === 'AAA' ? 1 : 0));
    if (!classes.length) return empty('No state results on record for this season.');
    return classes.map((c) => { const T = (OT.TEAMSCORES.get(y + '|' + c) || []).slice().sort((a, b) => a.place - b.place).slice(0, 5);
      const S = OT.seasonOf(y, c === 'single' ? 'ALL' : c); const byPts = S ? S.teams.slice(0, 5) : [];
      const dual = DUALS.find((d) => d.year === y && (c === 'single' || d.cls === c) && /championship match/i.test(d.round));
      const list = T.length ? `<ol class="slist">${T.map((t) => `<li><span class="sw">${t.place}</span><span class="sn"><a href="#school/${OT.slug(t.sch)}"><b>${esc(t.sch)}</b></a></span><span class="sr">${t.pts}</span></li>`).join('')}</ol>`
        : `<ol class="slist">${byPts.map((t, i) => `<li><span class="sw">${i + 1}</span><span class="sn"><a href="#school/${OT.slug(t.id)}"><b>${esc(t.id)}</b></a></span><span class="sr">${t.pts} <i>pts</i></span></li>`).join('')}</ol>`;
      return `<div class="card"><div class="k">${cn(c)}</div>${list}${dual ? `<div class="k" style="margin-top:10px">${cn(c)} · duals</div><div class="sdual"><a href="#school/${OT.slug(dual.w)}"><b>${esc(dual.w)}</b></a> ${dual.ws}–${dual.ls} ${esc(dual.l)}</div>` : ''}</div>`; }).join('');
  }
  PAGES.about = () => `<header class="uh2"><h1>Overtime</h1><div class="sub">Pennsylvania high school wrestling history, from districts to Hershey.</div></header><div class="card about">
    <h3>Overtime Rating</h3><p>Every bout in the archive is read from the brackets (about 374,000, 1938–2026). Each season, every wrestler's rating is fit from all of his postseason bouts at once: sections, districts, regionals and states. So beating the eventual state champion at districts counts the same as beating him at Hershey. Falls and tech falls count a little more than decisions. A wrestler's neighbouring seasons give the starting point, and each district starts at its own level, measured from how its wrestlers do against other districts at regionals and states. A win over someone who went out in the first round counts for very little, because those wrestlers start well below the rest. That rule is the same in every district, so a district with bigger fields doesn't collect extra credit. A wrestler's RTG is his best season. Wrestlers whose season ended in the first round get no rating in the app: their numbers exist only to set that starting point, not to rank them. In brackets, the number beside each name is his rating from the bouts up to that point, with every opponent at his full-season strength; after his last bout it is his season rating. Every season is put on one scale: the 16 best at each weight in that season are lined up with the 16 best of today, top end included, so the 1940s, with only a few bouts per wrestler, don't crowd the all-time lists. 1500 is an average state qualifier of 1999–2026. Checked on bouts hidden from the fit, the rating picks the winner of 78% of 2018–26 regional and state bouts.</p>
    ${OT.aboutViz ? OT.aboutViz() : ''}
    <h3>Strength, Talent and Score</h3><p>Every school, district and region gets the same three numbers. RTG is for wrestlers only.</p><p>Strength: how good the lineup is, like a dual-meet team. At each weight, take the school's best wrestler that season at his rating, including kids who lost in the first round. A weight with nobody entered is a forfeit. Each wrestler's chance of beating an average state qualifier is averaged over the weights, and that average is put back on the rating scale. A Strength of 1300 means the lineup wrestles like a wrestler rated 1300 at every weight. A district's or region's Strength is the average of its top quarter of schools each season (at least one), so a big district isn't rewarded for its size and a small one isn't made to count every school.</p><p>Talent: expected state medalists per season. Each wrestler counts his chance of placing in the top eight at states at his season rating, so a 1550 counts about half, a 1700 about nine-tenths and a 1900 nearly one. The chances come from every season since 2001, when all eight places are on file. For a district or region it is per school.</p><p>Score: placement points per season (per school per season for a district or region).</p><p>Over several seasons, Strength and Talent are plain averages of the season values, and the season count is shown. A season counts only when the district's full field is on file (every entrant, not just the placewinners), because otherwise an empty weight can't be told from a kid who lost early. District 3 and District 7 have no brackets below regionals from 1975 to 1998, so those seasons have Score but no Strength or Talent. Lists rank a school, district or region only when it has Strength for at least a third of the seasons in the window.</p>
    <h3>Score</h3><p>Score is how much a unit wins in a typical season: placement points, 16-12-9-7-5-3-2-1 for 1st through 8th, weighted by the page, averaged over the seasons in the window. On the State page only state results count. A Region page adds regional results at 0.4. District and School pages add district results at 0.15. District strength varies too much to compare district medals statewide, which is why the State page ignores them.</p><p>Three things keep it fair across eras and sizes. Every season is scaled to 13 weights, because seasons had anywhere from 9 to 14. The state record only names the top 2 places before 1974, the top 4 for 1974–82 and the top 6 for 1983–2000, but every weight still had a 3rd through 8th; each missing place is shared equally among the wrestlers who could have won it (state entrants with no place on file, then, when the state bracket was smaller than eight, the regional finalists who didn't reach states). Before regionals existed (1938–50) the missing places are left out. A school's seasons run from its first to its last on file, scoreless seasons included. A district's or region's points are divided by its schools that season, counting every school between its first and last season on file, so a district with missing brackets isn't divided by fewer schools.</p>
    <h3>Strength of competition</h3><p>A bracket's strength of competition is the average rating of its four best-rated wrestlers, whether or not they placed. Every result in the app, on cards, career grids, brackets and season sheets, has a set of signal bars to its left showing how tough that bracket was <em>for its level</em>: a district bracket is compared only with district brackets, a regional with regionals, a state bracket with state brackets. There are six tiers, from Docile (one bar) through Formidable, Competitive, Aggressive and Hostile to Violent (six bars). Each level's brackets are split into six equal groups, so each tier holds a sixth of the brackets on file at that level. Because the steps are per level, a Violent district bracket can still be easier than a Docile state bracket. The key above the bottom bar lists the tiers, and tapping it shows the cut points at each level. For the comparison across levels, tap a result or open a bracket: the header gives the exact strength, its tier, and how far it sits above or below the average state bracket.</p>
    <h3>Colour</h3><p>Every rating and strength colour in the app uses one cold-to-hot scale: blue is ice, then cyan, green, yellow and orange, and red is on fire. Maps, the season grid, rating chips and strength bars all read from it, so a colour means the same strength everywhere. Each kind of unit (school, district, region) has its own range, taken from its season ratings since 1974, and the legend under each picture shows it.</p>
    <h3>Seasons and classes</h3><p>The filter bar at the bottom sets the division, the place (region, district, school) and the seasons (TIME: all-time, the last 5, 10 or 25, or any range on the strip); weights narrow the wrestler lists and all-time teams. Totals count each result in the class it was wrestled in. For wrestlers the seasons decide who is in, not what counts: anyone who wrestled a season inside the window is included with his whole career. Region and district membership is taken as of each season.</p>
    <h3>All-time teams</h3><p>Every wrestler who appears in any bracket for the place is a candidate, at one weight: the weight of his highest-rated season. Each wrestler gets one value, the same on every page: 0.6 × his state finishes plus 0.4 × his peak rating, each measured against every state qualifier at that weight, all years and both classes. Each state finish is worth the average rating of the wrestlers who finished there in that class, above an average state qualifier who did not place, added up over his career. So a AAA title counts for more than an AA title, and the drop-off from 1st to 8th is what the results show, not a set points table. Regional results, then district results, only break ties. So a wrestler ahead of another on the Pennsylvania team is ahead of him on their region, district and school teams too.</p>
    <h3>Careers</h3><p>Where a district runs sections instead of a district tournament (District 7, District 3 and District 1 in most seasons), the section result fills the District row, marked District · section. In a career grid, Q means he advanced without a recorded place, DNP that he entered and did not place, DNC that the district bracket is on record and he is not in it, and a dash that no bracket is on record. Careers are split by graduating class, so a father and son with the same name at the same school are two people.</p>
    <h3>Missing from the archive</h3><p>The bracket archive marks some tournaments as incomplete: no official team scores, or consolation rounds not on record. Those seasons count only what was recorded. Each District page lists its own.</p>${missingBlock(null)}
    <h3>Sources</h3><p><a href="https://brackets.pa-wrestling.com/" target="_blank" rel="noopener">PA-Wrestling.com bracket archive</a>: every state bracket 1938–2026 and 1,794 district and regional brackets, with seeds, grades, records and team scores. <a href="https://piaadistrict3records.com/" target="_blank" rel="noopener">District III Records</a>: District 3 champions 1938–2024, team champions and PIAA team duals 1999–2023. <a href="https://www.pa-wrestling.com/hs/stateduals/" target="_blank" rel="noopener">PA-Wrestling.com state duals</a>: PIAA team duals 1999–2026, scores checked bout by bout. <a href="https://wpial.org/" target="_blank" rel="noopener">WPIAL</a>: District 7 champions 1936–2024. The District III and WPIAL lists fill only tournaments the archive has no file for. Most District 3 and District 7 AAA district brackets are not yet in the archive, so those years show the champion and nothing below.</p></div>`;

  /* rating strip: his Overtime Rating season by season, peak marked, and his best wins (from the lazy season files) */
  const RN = (side, d) => side === 'champ' ? (['final', 'semifinal', 'quarterfinal', 'first round', 'prelim'][d] || 'prelim') : ({ p3: '3rd-place bout', p5: '5th-place bout', p7: '7th-place bout' }[side] || 'consolation');
  const RES = { fall: 'fall', tf: 'tech fall', md: 'major', dec: 'dec' };
  function bestWinsHTML(W) {
    const yrs = OT.yearsOf(W.apps, W.lower); if (!yrs.every((y) => OT.sosLoaded(y))) return '<div class="muted bwl">Loading best wins…</div>';
    const bw = OT.bestWins(W.apps, W.lower, 5); if (!bw.length) return '<div class="muted bwl">No bouts on record.</div>';
    return `<ol class="bw">${bw.map((b) => `<li><a href="${OT.bhref(b.key)}"><span class="bwn"><b>${esc(b.opp)}</b><small>${b.year} · ${b.lvl} · ${OT.wShort(b.w)} · ${RN(b.side, b.round)} · ${[RES[b.result] || b.result, b.score, b.flags].filter(Boolean).join(' ')}</small></span>${OT.rtgTag(b.rating)}</a></li>`).join('')}</ol>`;
  }
  function ratingStrip(W) {
    const c = OT.careerRating(W.apps, W.lower); if (!c) return '';
    const S = c.seasons, n = S.length, w = 300, h = 96, px = 26, py = 22;
    const lo = Math.min(d3.min(S, (x) => x.rating), 1400) - 40, hi = Math.max(d3.max(S, (x) => x.rating), 1700) + 40;
    const X = (i) => (n === 1 ? w / 2 : px + i * (w - 2 * px) / (n - 1)), Y = (v) => py + (h - 2 * py) * (1 - (v - lo) / (hi - lo));
    const q = Y(1500);
    const pts = S.map((x, i) => `${X(i)},${Y(x.rating)}`).join(' ');
    const svg = `<svg class="rsp" viewBox="0 0 ${w} ${h}" role="img" aria-label="Overtime Rating by season"><line x1="8" x2="${w - 8}" y1="${q}" y2="${q}" class="rq"/><text x="${w - 8}" y="${q + 11}" text-anchor="end" class="rqt">1500 · avg state qualifier</text>${n > 1 ? `<polyline points="${pts}" class="rl"/>` : ''}${S.map((x, i) => { const pk = x.year === c.peakYear; return `<circle cx="${X(i)}" cy="${Y(x.rating)}" r="${pk ? 5 : 3.5}" class="${pk ? 'pk' : 'pt'}"/><text x="${X(i)}" y="${Y(x.rating) - 9}" text-anchor="middle" class="rv${pk ? ' pk' : ''}">${OT.rtg10(x.rating)}</text><text x="${X(i)}" y="${h - 4}" text-anchor="middle" class="ry">${x.grade && /^(FR|SO|JR|SR)$/.test(x.grade) ? x.grade + ' ' : ''}'${String(x.year).slice(2)}</text>`; }).join('')}</svg>`;
    return section('Rating', `<div class="card rcard"><div class="rhead"><div><span class="k">Career average</span><b class="num">${OT.rtg10(c.avg)}</b></div><div><span class="k">Peak</span><b class="num gold">${OT.rtg10(c.peak)}</b> <small class="muted">${c.peakYear}</small></div></div>${svg}<div class="k" style="margin-top:6px">Best wins</div><div id="bestwins" data-w="${esc(W.slug)}">${bestWinsHTML(W)}</div><div class="note">His strength each season from every bout at every level. 1500 = the average state qualifier.</div></div>`);
  }
  OT.bestWinsHTML = bestWinsHTML;
  /* Missing from the archive (menu) */
  PAGES.missing = () => `<header class="uh2"><h1>Missing</h1></header>${missingBlock(null).replace('<details class="drawer">', '<details class="drawer" open>') || empty('Nothing marked missing.')}`;
  Object.assign(OT, { PAGES });
})();
