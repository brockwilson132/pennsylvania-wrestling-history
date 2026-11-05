/* Overtime — pages. One level page function; State, Region, District and School all call it. */
'use strict';
(() => {
  const { esc, fmt, ordinal, state, clsName, U, REGIONS, DISTRICTS, SCHOOL_BY_SLUG, classHistory, section, empty, windowLabel, teamsBlock, seasonsDrawer, placeCounts } = OT;


  /* PIAA team duals (1999–2024, District III Records): champions on the State page, a school's record on its page */
  const DUALS = (window.WR_DUALS || []).map(([year, cls, round, w, wd, ws, l, ld, ls, note]) => ({ year, cls, round, w, wd, ws, l, ld, ls, note }));
  const dualsIn = () => DUALS.filter((d) => OT.inWindow(d.year) && (state.cls === 'ALL' || d.cls === state.cls));
  function dualsBlock(u) {
    const ds = dualsIn(); if (!ds.length) return '';
    const src = '<div class="note">PIAA team duals results from <a href="https://piaadistrict3records.com/" target="_blank" rel="noopener">District III Records</a>.</div>';
    if (u.kind === 'state') {
      const fin = ds.filter((d) => /championship match/i.test(d.round)).sort((a, b) => b.year - a.year || a.cls.localeCompare(b.cls));
      if (!fin.length) return '';
      const rows = fin.map((d) => `<tr><td class="num">${d.year}</td><td>${d.cls}</td><td><a href="#school/${OT.slug(d.w)}"><b>${esc(d.w)}</b></a> <span class="ash">D${d.wd || '?'}</span></td><td class="num">${d.ws}–${d.ls}</td><td><a href="#school/${OT.slug(d.l)}">${esc(d.l)}</a></td></tr>`).join('');
      return section('Team duals champions', `<div class="card tw"><table class="dt"><thead><tr><th>Year</th><th>Class</th><th>Champion</th><th>Final</th><th>Runner-up</th></tr></thead><tbody>${rows}</tbody></table></div>${src}`);
    }
    if (u.kind !== 'school') return '';
    const mine = ds.filter((d) => d.w === u.id || d.l === u.id); if (!mine.length) return '';
    const by = d3.groups(mine, (d) => d.year + '|' + d.cls).map(([k, v]) => { const [year, cls] = k.split('|'); const won = v.filter((d) => d.w === u.id).length, lost = v.length - won; const fin = v.find((d) => /championship match/i.test(d.round)); const best = fin ? (fin.w === u.id ? 'Champion' : 'Runner-up') : v.some((d) => /semifinal/i.test(d.round) && /championship/i.test(d.round)) ? 'Semifinal' : v.some((d) => /quarterfinal/i.test(d.round) && /championship/i.test(d.round)) ? 'Quarterfinal' : '—'; return { year: +year, cls, won, lost, best, v }; }).sort((a, b) => b.year - a.year);
    const tw = d3.sum(by, (b) => b.won), tl = d3.sum(by, (b) => b.lost), titles = by.filter((b) => b.best === 'Champion').length;
    const rows = by.map((b) => `<tr><td class="num">${b.year}</td><td>${b.cls}</td><td class="num">${b.won}–${b.lost}</td><td>${b.best === 'Champion' ? '<b class="gold">Champion</b>' : b.best}</td><td><small class="ash">${b.v.map((d) => (d.w === u.id ? 'W ' + d.ws + '–' + d.ls + ' ' + esc(d.l) : 'L ' + d.ls + '–' + d.ws + ' ' + esc(d.w))).join(' · ')}</small></td></tr>`).join('');
    return section('Team duals', `<div class="card tw"><div class="k" style="margin-bottom:8px">${by.length} appearances · ${tw}–${tl}${titles ? ' · ' + titles + ' title' + (titles > 1 ? 's' : '') : ''}</div><table class="dt"><thead><tr><th>Year</th><th>Class</th><th>Record</th><th>Finish</th><th>Matches</th></tr></thead><tbody>${rows}</tbody></table></div>${src}`);
  }
  /* the one level page: name, rating and score inline → performance chart → rankings → all-time team → seasons */
  const crumbBar = (crumbs) => crumbs.length > 1 ? `<div class="crumb">${crumbs.slice(0, -1).map((c) => `<a href="${c.href}">${esc(c.name)}</a>`).join('<span>›</span>')}</div>` : '';
  function summary(u) {
    const a = OT.unitAgg(u); if (!a) return '';
    const it = [];
    if (a.rating && u.kind !== 'state') it.push([OT.r10(a.rating), 'Strength', OT.unitRtgTip(u.kind) + `, averaged over ${a.nS} season${a.nS === 1 ? '' : 's'} in the window`]);
    if (a.talent && u.kind !== 'state') it.push([OT.talTxt(a.talent, u.kind), 'Talent', `${OT.talWhat()}${u.kind === 'school' ? '' : ' per school'} per season (each wrestler counts his chance of medalling at states at his season rating), averaged over ${a.tseries.length} season${a.tseries.length === 1 ? '' : 's'}`]);
    if (a.nS && u.kind !== 'state') it.push([a.nS, 'Seasons', 'seasons in the window with the full district field on file, which Strength and Talent average over']);
    if (a.score && u.kind !== 'state') it.push([OT.sfmt(a.score), 'Score', u.kind === 'school' ? 'placement points per season, weighted for this page' : 'placement points per school per season, weighted for this page']);
    return `<div class="usum">${it.map(([v, l, t]) => `<span${t ? ` title="${esc(t)}"` : ''}><b>${v}</b><i>${l}</i></span>`).join('')}</div>`;
  }
  function levelPage(u, opts = {}) {
    state.lvl = 'state';
    const crumbs = (opts.crumbs || []).concat([{ name: '' }]);
    const head = `<header class="uh2">${crumbBar(crumbs)}<h1>${esc(u.name)}</h1>${opts.sub ? `<div class="sub">${opts.sub}</div>` : ''}${summary(u)}</header>`;
    const rk = opts.rankings();
    const rankSec = `<section class="sec"><div class="sech"><h2>${rk.title}</h2><span class="ctl">${rk.toggle || ''}${rk.sortSeg || ''}</span></div>${rk.html}</section>`;
    const v = state.view || 'map';
    const parts = [head];
    if (v === 'map') { const map = u.kind === 'school' ? '' : OT.ratingMap(u); parts.push(map ? `<section class="sec secmap">${map}</section>` : '', u.kind === 'school' ? `<section class="sec">${OT.perfChart(u)}</section>` + rankSec : ''); }
    else if (v === 'rank') parts.push(rankSec);
    else if (v === 'time') parts.push(`<section class="sec tlsec"><div class="sech"><h2>Timeline</h2></div>${OT.timelineView(u)}</section>`);
    else if (v === 'team') parts.push(`<section class="sec atsec"><div class="sech"><h2>All-time team</h2><button type="button" class="chipb" data-attmore>+ 3 teams</button></div>${OT.teamGrid(u)}</section>`);
    else { parts.push(section('Seasons', seasonsDrawer(u))); if (u.kind === 'state' || u.kind === 'school') parts.push(dualsBlock(u)); if (u.kind === 'school') parts.push(section('Roster', rosterBlock(u))); if (opts.seasonsExtra) parts.push(opts.seasonsExtra); }
    return parts.join('');
  }
  const childToggle = (id, kinds, cur) => `<div class="seg sm" data-child="${id}">${kinds.map(([k, l]) => `<button data-kind="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;
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
  PAGES.state = () => {
    const u = U.state(); const kind = ['school', 'district', 'region'].includes(state.child) ? state.child : 'school';
    return levelPage(u, { sub: 'PIAA individual championships', rankings: () => unitRank(kind, null, 'state', childToggle('state', [['school', 'Schools'], ['district', 'Districts'], ['region', 'Regions']], kind)) });
  };
  PAGES.region = (id) => {
    if (!id) { const r = OT.unitRankings('region', null, 'state'); return `<header class="uh2"><h1>Regions</h1><div class="sub">The qualifying tournaments between districts and Hershey${state.cls === 'ALL' ? '' : ', ' + clsName()}.</div></header><section class="sec"><div class="sech"><h2>Rankings</h2><span class="ctl">${r.sortSeg || ''}</span></div>${r.html || r}</section>`; }
    const u = U.region(id); const kind = state.child === 'district' ? 'district' : 'school';
    const mem = OT.regionMembers(id), win = OT.windowLabel(); const full = mem.every((m) => m.span === win);
    const memSub = mem.length ? mem.map((m) => `<a href="#district/${m.d}">District ${m.d}</a>${full ? '' : ' ' + m.span}`).join(', ') + (full ? '' : ' · <span class="note1">membership as of each season</span>') : '';
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }], sub: memSub, rankings: () => unitRank(kind, { kind: 'region', id }, 'region', childToggle('region', [['school', 'Schools'], ['district', 'Districts']], kind)) });
  };
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
  PAGES.district = (id) => {
    if (!id) { const r = OT.unitRankings('district', null, 'state'); return `<header class="uh2"><h1>Districts</h1><div class="sub">The twelve PIAA districts${state.cls === 'ALL' ? '' : ', ' + clsName()}.</div></header><section class="sec"><div class="sech"><h2>Rankings</h2><span class="ctl">${r.sortSeg || ''}</span></div>${r.html || r}</section>`; }
    const u = U.district(+id); const spans = OT.districtRegionSpans(+id), win = OT.windowLabel(); const dr = spans.map((x) => x.g);
    const one = spans.length === 1 && spans[0].span === win;
    const regs = spans.map((x) => `<a href="#region/${x.g}">${REGIONS[x.g]}</a>${one ? '' : ' ' + x.span}`).join(', ');
    const movers = OT.districtMovers(+id).filter((m) => m.span !== win && m.n < 0.85 * m.total).slice(0, 4);
    const moveNote = movers.length ? ` · part of the window: ${movers.map((m) => `<a href="#school/${OT.slug(m.sch)}">${esc(m.sch)}</a> ${m.span}`).join(', ')}` : '';
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(dr.length ? [{ name: REGIONS[dr[0]] + ' Region', href: '#region/' + dr[0] }] : [])], sub: `${esc(DISTRICTS[u.id])}${regs ? ' · wrestles in ' + regs : ''}${moveNote}${!one || movers.length ? ' · <span class="note1">membership as of each season</span>' : ''}`,
      rankings: () => unitRank('school', { kind: 'district', id: +id }, 'district'), seasonsExtra: missingRows(+id).length ? section('Missing from the archive', missingBlock(+id)) : '' });
  };
  /* School tab root: the schools of the district you were looking at (or pick one) */
  function schoolIndex() {
    const d = state.ctxDistrict || 0;
    const picker = `<div class="dpick">${d3.range(1, 13).map((k) => `<a href="#school?d=${k}" class="${k === d ? 'on' : ''}">D${k}</a>`).join('')}</div>`;
    const r = d ? OT.unitRankings('school', { kind: 'district', id: d }, 'district') : OT.unitRankings('school', null, 'state');
    const html = typeof r === 'string' ? r : r.html, sortSeg = typeof r === 'string' ? '' : r.sortSeg;
    return `<header class="uh2"><h1>${d ? 'Schools · District ' + d : 'Schools'}</h1><div class="sub">${d ? esc(DISTRICTS[d]) + ' · ' : 'Statewide · '}pick a district or a school.</div>${picker}</header><section class="sec"><div class="sech"><h2>Rankings</h2><span class="ctl">${sortSeg}</span></div>${html}</section>`;
  }
  PAGES.school = (sl) => {
    if (!sl) return schoolIndex();
    const name = SCHOOL_BY_SLUG.get(sl) || OT.SLUG2S.get(sl); if (!name) return `<header class="uh2"><h1>Not found</h1></header>` + empty('No school at this address.');
    const u = U.school(name); const hist = classHistory(name).map((h) => `${h.cls === 'single' ? 'One class' : 'Class ' + h.cls} ${h.from === h.to ? h.from : h.from + '–' + h.to}`).join(' · ');
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(u.region ? [{ name: REGIONS[u.region] + ' Region', href: '#region/' + u.region }] : []), ...(u.d ? [{ name: 'District ' + u.d, href: '#district/' + u.d }] : [])], sub: hist,
      rankings: () => wrestlerRank(OT.unitRows(u), { limit: 15, noSchool: true }) }) + `<div class="note"><a href="#h2hs/${sl}~">Head to head with another school →</a></div>`;
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
  PAGES.wrestlers = () => {
    const r = wrestlerRank(OT.ROWS().filter((x) => x.place), { limit: 40, title: 'Placewinners' }); const f = state.f;
    const where = f.schools[0] || (f.districts[0] ? 'District ' + f.districts[0] : f.regions[0] ? REGIONS[f.regions[0]] + ' Region' : '');
    return `<header class="uh2"><h1>Wrestlers</h1><div class="sub">State placewinners${where ? ' from ' + esc(where) : ''}, ${clsName()}, ${windowLabel()}, with their whole careers. Search finds anyone in any district, regional or state bracket${where ? ' from ' + esc(where) : ''}.</div></header>
      <input class="search" id="wsearch" type="search" placeholder="Search ${where ? esc(where) + ' wrestlers' : 'any wrestler or school'}" autocomplete="off" aria-label="Search wrestlers">
      <section class="sec"><div class="sech"><h2 id="whead">Placewinners</h2><span class="ctl" id="wctl">${r.sortSeg}</span></div><div id="wlist">${r.html}</div><div class="note" id="wmore"></div></section>`;
  };
  PAGES.wrestler = (sl) => {
    const W = OT.getWrestler(sl);
    if (!W) return OT.peopleLoaded() ? `<header class="uh"><h1>Not found</h1></header>` + empty('No wrestler at this address.') : `<header class="uh"><h1>Loading…</h1></header><div class="card empty" data-need-people="1">Looking up this wrestler…</div>`;
    if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const u = U.school(W.sch); const places = placeCounts(W.rows); const pts = d3.sum(W.rows, (r) => r.pts);
    const all = W.apps.concat(W.lower); const first = all.length ? d3.min(all, (r) => r.year) : W.person && W.person.y0, last = all.length ? d3.max(all, (r) => r.year) : W.person && W.person.y1;
    const dMed = W.lower.filter((r) => r.lvl === 'district' && r.place).length, rMed = W.lower.filter((r) => r.lvl === 'regional' && r.place).length;
    const hero = W.lowerOnly ? [['District medals', dMed], ['Regional medals', rMed], ['District titles', W.lower.filter((r) => r.lvl === 'district' && r.place === 1).length], ['Seasons', new Set(all.map((r) => r.year)).size]] : [['State titles', places[0]], ['State medals', W.rows.length], ['Regional medals', rMed], ['District medals', dMed]];
    const cr = OT.careerRating(W.apps, W.lower);
    const yrs = OT.yearsOf(W.apps, W.lower); const rec = OT.bwLoaded() ? OT.recordOf(W.name, yrs) : null;
    const recI = rec ? [[`${rec[0]}–${rec[1]}`, 'Postseason']].concat(rec[2] ? [[rec[2], rec[2] === 1 ? 'Fall' : 'Falls']] : []) : [];
    const heroK = W.lowerOnly ? hero : [['State medals', W.rows.length], ['State titles', places[0]]];
    const sumI = (cr ? [[OT.rw(cr.peak), 'Peak RTG'], [OT.rw(cr.avg), 'Career avg']] : []).concat(heroK.filter(([, v]) => v !== 0 && v !== '0 / 0').map(([l, v]) => [typeof v === 'number' ? fmt(v) : v, l])).concat(recI);
    const head = `<header class="uh2"><div class="crumb"><a href="#state">Pennsylvania</a><span>›</span><a href="#district/${W.d}">District ${W.d}</a><span>›</span><a href="${u.href}">${esc(W.sch)}</a></div>
      <h1>${esc(W.name)}</h1><div class="sub">${esc(W.sch)} · ${first === last ? first : first + '–' + last}${W.lowerOnly && !W.apps.length ? ' · never reached states' : ''}</div>
      <div class="usum"${OT.bwLoaded() ? '' : ' data-need-bw="1"'}>${sumI.map(([v, l]) => `<span><b>${v}</b><i>${l}</i></span>`).join('')}</div></header>`;
    const tl = section('Career', `<div class="card cgcard">${OT.careerGrid(W.apps, W.lower, { full: W.full })}<div class="note">Tap a result for its bracket. Bar = how tough that bracket was. Q advanced · DNP didn't place · DNC didn't compete · – no bracket on file.${W.full ? '' : ' Loading his full career…'}</div></div>`);
    const bw = section('Best wins', `<div class="card" id="bestwins" data-w="${W.slug}">${bestWinsHTML(W)}</div>`);
    const vs = `<div class="note"><a href="#h2h/${W.slug}~">Head to head with another wrestler →</a></div>`;
    return head + tl + bw + vs;
  };
  /* head to head: two wrestlers, every bout between them, and the odds at their best */
  const pct = (p) => (p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(100 * p) + '%');
  const h2hOdds = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  const h2hIds = (id) => { const [a, b] = String(id || '').split('~'); return [a || '', b || '']; };
  function h2hPick(side, W, other) {
    const ph = side === 'a' ? 'First wrestler' : 'Second wrestler';
    return `<div class="h2p" data-h2side="${side}"><input class="search h2i" type="search" placeholder="${W ? esc(W.name) + ' · change' : 'Search ' + ph.toLowerCase()}" autocomplete="off" aria-label="${ph}" data-h2other="${esc(other || '')}"><div class="h2l"></div>
      ${W ? `<div class="h2w"><a href="#wrestler/${W.slug}"><b>${esc(W.name)}</b></a><small>${esc(W.sch)}</small></div>` : `<div class="h2w muted">${ph}</div>`}</div>`;
  }
  PAGES.h2h = (id) => {
    const [sa, sb] = h2hIds(id); const A = sa ? OT.getWrestler(sa) : null, B = sb ? OT.getWrestler(sb) : null;
    const need = (sa && !A) || (sb && !B);
    const head = `<header class="uh2"><h1>Head to head</h1><div class="sub">Any two wrestlers in any bracket: every bout between them, and the odds at their best.</div></header>${h2hTabs('w')}
      <div class="card h2pick">${h2hPick('a', A, sb)}<span class="h2vs">vs</span>${h2hPick('b', B, sa)}</div>`;
    if (need) return head + (OT.peopleLoaded() ? empty('No wrestler at this address.') : '<div class="card empty" data-need-people="1">Looking up the wrestlers…</div>');
    if (!A || !B) return head;
    if (A.slug === B.slug) return head + empty('Pick two different wrestlers.');
    [A, B].forEach((W) => { if (!W.lower) W.lower = OT.lowerFor(W.apps); });
    const ready = A.full && B.full && OT.yearsOf(A.apps, A.lower).concat(OT.yearsOf(B.apps, B.lower)).every((y) => OT.sosLoaded(y));
    const ca = OT.careerRating(A.apps, A.lower), cb = OT.careerRating(B.apps, B.lower);
    let odds = '';
    if (ca && cb) { const p = h2hOdds(ca.peak, cb.peak);
      odds = section('At their best', `<div class="card"><div class="usum"><span><b>${pct(p)}</b><i>${esc(A.name)} · peak ${OT.rw(ca.peak)} (${ca.peakYear})</i></span><span><b>${pct(1 - p)}</b><i>${esc(B.name)} · peak ${OT.rw(cb.peak)} (${cb.peakYear})</i></span></div><div class="note">Odds for one bout between each at his best season, ${Math.abs(Math.round(ca.peak - cb.peak))} points apart. Weight, style and the day decide a real bout.</div></div>`); }
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
  const h2hTabs = (on) => `<div class="dpick h2tab"><a href="#h2h/" class="${on === 'w' ? 'on' : ''}">Wrestlers</a><a href="#h2hs/" class="${on === 's' ? 'on' : ''}">Schools</a></div>`;
  function h2hsPick(side, name, other) {
    const ph = side === 'a' ? 'First school' : 'Second school';
    return `<div class="h2p" data-h2side="${side}"><input class="search h2i" data-h2kind="s" type="search" placeholder="${name ? esc(name) + ' · change' : 'Search ' + ph.toLowerCase()}" autocomplete="off" aria-label="${ph}" data-h2other="${esc(other || '')}"><div class="h2l"></div>
      ${name ? `<div class="h2w"><a href="#school/${OT.slug(name)}"><b>${esc(name)}</b><small>${OT.schoolDistrict(name) ? 'District ' + OT.schoolDistrict(name) : ''}</small></a></div>` : `<div class="h2w muted">${ph}</div>`}</div>`;
  }
  PAGES.h2hs = (id) => {
    const [sa, sb] = h2hIds(id); const nA = sa ? OT.SLUG2S.get(sa) : null, nB = sb ? OT.SLUG2S.get(sb) : null;
    const head = `<header class="uh2"><h1>Head to head</h1><div class="sub">Two schools: every postseason bout between their wrestlers, their PIAA team duals, and the odds of a dual meet between their lineups.</div></header>${h2hTabs('s')}
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
  const yearPick = (y, page) => { const ys = OT.YEARS, i = ys.indexOf(y), prev = ys[i - 1], next = ys[i + 1];
    return `<div class="typick">${prev ? `<a class="chipb" href="#${page}/${prev}" aria-label="Season ${prev}">‹ ${prev}</a>` : '<span></span>'}<select data-syear="${page}" aria-label="Season">${ys.slice().reverse().map((k) => `<option value="${k}"${k === y ? ' selected' : ''}>${k}</option>`).join('')}</select>${next ? `<a class="chipb" href="#${page}/${next}" aria-label="Season ${next}">${next} ›</a>` : '<span></span>'}</div>`; };
  PAGES.season = (id) => {
    const ys = OT.YEARS, y = ys.includes(+id) ? +id : OT.yearsWindow()[1];
    const inCls = (c) => state.cls === 'ALL' || c === state.cls || c === 'single';
    const cn = (c) => (c === 'single' ? 'One class' : 'Class ' + c);
    const head = `<header class="uh2"><h1>${y} season</h1><div class="sub">The season in one place${state.cls === 'ALL' ? '' : ', ' + clsName()}: champions and finals, team titles, the strongest wrestlers, the biggest upsets.</div>${yearPick(y, 'season')}</header>`;
    if (!OT.sosLoaded(y)) return head + '<div class="card"><div class="muted bwl" data-need-season="1">Loading the season…</div></div>';
    const SY = OT.sosYear(y) || {};
    const rows = OT.APP.filter((r) => r.year === y && inCls(r.cls)); const champs = rows.filter((r) => r.place === 1);
    if (!rows.length) return head + empty('No state results on record for this season.');
    const classes = Array.from(new Set(rows.map((r) => r.cls))).sort((a, b) => (a === 'AAA' ? -1 : b === 'AAA' ? 1 : 0));
    const who = (r) => `<a href="${OT.wrestlerHref(r)}"><b>${esc(r.name)}</b></a>`;
    const rowByKey = new Map(rows.map((r) => [OT.bkey(r) + '|' + OT.nkey(r.name), r]));
    /* champions, with the final */
    const champBlock = classes.map((c) => { const cs = champs.filter((r) => r.cls === c).sort((a, b) => a.wn - b.wn);
      const items = cs.map((r) => { const B = OT.sosBracket(OT.bkey(r)); const fin = B && B.b.find((b) => b[0] === 'champ' && b[1] === 0 && OT.nkey(b[2]) === OT.nkey(r.name)); const rt = B && B.s[OT.nkey(r.name)];
        const prior = (() => { const W = OT.getWrestler(OT.rSlug(r)); const n = W ? W.rows.filter((x) => x.place === 1 && x.year < y).length : 0; return n ? `<span class="rpt">${ordinal(n + 1)} title</span>` : ''; })();
        return `<li><span class="sw">${OT.wShort(r.w)}</span><span class="sn"><span class="snr">${who(r)}${prior}</span><small>${esc(r.sch)}${r.d ? ' · D' + r.d : ''}${fin ? ` · ${[RES[fin[4]] || fin[4], fin[5], fin[6]].filter(Boolean).join(' ')} over ${esc(fin[3])}` : ''}</small></span><span class="sr">${rt && rt[0] ? OT.rw(rt[0]) : ''}</span></li>`; }).join('');
      return `<div class="card"><div class="k">${cn(c)}</div><ol class="slist">${items}</ol></div>`; }).join('');
    /* team: state tournament scores, duals */
    const teamBlock = classes.map((c) => { const T = (OT.TEAMSCORES.get(y + '|' + c) || []).slice().sort((a, b) => a.place - b.place).slice(0, 5);
      const S = OT.seasonOf(y, c === 'single' ? 'ALL' : c); const byPts = S ? S.teams.slice(0, 5) : [];
      const dual = DUALS.find((d) => d.year === y && (c === 'single' || d.cls === c) && /championship match/i.test(d.round));
      const list = T.length ? `<ol class="slist">${T.map((t) => `<li><span class="sw">${t.place}</span><span class="sn"><a href="#school/${OT.slug(t.sch)}"><b>${esc(t.sch)}</b></a></span><span class="sr">${t.pts}</span></li>`).join('')}</ol>`
        : `<ol class="slist">${byPts.map((t, i) => `<li><span class="sw">${i + 1}</span><span class="sn"><a href="#school/${OT.slug(t.id)}"><b>${esc(t.id)}</b></a><small>${t.titles ? t.titles + ' title' + (t.titles > 1 ? 's' : '') + ' · ' : ''}${t.n} medal${t.n === 1 ? '' : 's'}</small></span><span class="sr">${t.pts} <i>pts</i></span></li>`).join('')}</ol><div class="note">${y < OT.TEAMSCORES_FROM ? 'Official team scores were not published before 1976; this is by placement points from the medals on record.' : 'No official team scores on record for this tournament; ranked by placement points.'}</div>`;
      return `<div class="card"><div class="k">${cn(c)} · tournament</div>${list}${dual ? `<div class="k" style="margin-top:10px">${cn(c)} · duals</div><div class="sdual"><a href="#school/${OT.slug(dual.w)}"><b>${esc(dual.w)}</b></a> ${dual.ws}–${dual.ls} over ${esc(dual.l)}</div>` : ''}</div>`; }).join('');
    /* strongest of the season: season ratings across the state brackets */
    const names = new Map(); const top = [];
    Object.entries(SY).forEach(([key, B]) => { const k = OT.parseBkey(key); if (!k || k.lvl !== 'state' || !inCls(k.cls)) return;
      B.b.forEach((b) => { names.set(OT.nkey(b[2]), b[2]); names.set(OT.nkey(b[3]), b[3]); });
      Object.entries(B.s).forEach(([nk, x]) => { if (x[0]) top.push({ key, k, nk, rating: x[0], r: rowByKey.get(key + '|' + nk) || null }); }); });
    top.sort((a, b) => b.rating - a.rating);
    const topBlock = `<div class="card"><ol class="slist">${top.slice(0, 10).map((t, i) => { const nm = t.r ? t.r.name : names.get(t.nk) || t.nk;
      return `<li><span class="sw">${i + 1}</span><span class="sn">${t.r ? who(t.r) : `<b>${esc(nm)}</b>`}<small>${t.r ? esc(t.r.sch) + ' · ' : ''}${cn(t.k.cls)} ${OT.wShort(t.r ? t.r.w : t.k.wn)}${t.r && t.r.place ? ' · ' + ordinal(t.r.place) : ''}</small></span><span class="sr">${OT.rw(t.rating)}</span></li>`; }).join('')}</ol><div class="note">Season ratings, every bout of the postseason counted. 1500 = the average state qualifier.</div></div>`;
    /* biggest upsets: the winner's odds before the bout, from the ratings up to that point, any level */
    const ups = []; let nb = 0, falls = 0, ot = 0;
    Object.entries(SY).forEach(([key, B]) => { const k = OT.parseBkey(key); if (!k || !inCls(k.cls)) return;
      B.b.forEach((b) => { if (['ff', 'inj', 'dq', 'med'].includes(b[4])) return; nb++; if (b[4] === 'fall') falls++; if (/OT|SV|TB/.test(b[6] || '')) ot++;
        if (b[7] == null || b[8] == null) return; const p = oddsOf(b[7], b[8]); if (p < 0.3 && b[8] >= 1500) ups.push({ key, k, b, p }); }); });
    ups.sort((a, b) => a.p - b.p);
    const LVL = { state: 'States', regional: 'Regional', district: 'District', section: 'Section' };
    const where = (k) => k.lvl === 'state' ? 'States' : OT.unitLabel(k.lvl, k.unit);
    const upBlock = ups.length ? `<div class="card"><ol class="bw h2m">${ups.slice(0, 10).map(({ key, k, b, p }) => `<li><a href="${OT.bhref(key)}"><span class="bwn"><b>${esc(b[2])} over ${esc(b[3])}</b><small>${esc(where(k))} · ${cn(k.cls)} ${OT.wShort(k.wn)} · ${RN(b[0], b[1])} · ${[RES[b[4]] || b[4], b[5], b[6]].filter(Boolean).join(' ')} · ${OT.rw(b[7])} vs ${OT.rw(b[8])}</small></span><span class="bwr"><b>${pct(p)}</b><i>odds</i></span></a></li>`).join('')}</ol><div class="note">The winner's odds going in, from both wrestlers' ratings up to that bout, at any level. Only wins over a wrestler rated 1500 or better.</div></div>` : empty('No upsets on record.');
    /* titles by district */
    const byD = d3.rollup(champs.filter((r) => r.d), (v) => v.length, (r) => r.d); const medD = d3.rollup(rows.filter((r) => r.d && r.place), (v) => v.length, (r) => r.d);
    const dList = Array.from(byD).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const dBlock = dList.length ? `<div class="card"><ol class="slist">${dList.map(([d, n]) => `<li><span class="sw">D${d}</span><span class="sn"><a href="#district/${d}"><b>District ${d}</b></a><small>${medD.get(d) || 0} medal${medD.get(d) === 1 ? '' : 's'}</small></span><span class="sr">${n} <i>title${n === 1 ? '' : 's'}</i></span></li>`).join('')}</ol></div>` : '';
    /* the numbers */
    const brN = Object.keys(SY).filter((key) => { const k = OT.parseBkey(key); return k && inCls(k.cls); }).length;
    const nums = [[champs.length, 'state titles'], [rows.filter((r) => r.place).length, 'state medals'], [rows.length, 'state entrants'], [brN, 'brackets on record'], [fmt(nb), 'bouts'], [nb ? Math.round(100 * falls / nb) + '%' : '–', 'ended by fall'], [ot, 'overtime bouts']];
    const numBlock = `<div class="card"><div class="usum">${nums.map(([v, l]) => `<span><b>${v}</b><i>${l}</i></span>`).join('')}</div>${y === 2021 ? '<div class="note">2021 states were eight-man brackets (COVID year), so every qualifier medaled: no entrants without a place.</div>' : ''}</div>`;
    return head + section('Champions', champBlock) + section('Team titles', teamBlock) + section('Strongest of the season', topBlock) + section('Biggest upsets', upBlock) + (dBlock ? section('Titles by district', dBlock) : '') + section('By the numbers', numBlock);
  };
  /* upsets: the biggest all-time, at states, in state finals, and the wrestlers with the most of them */
  PAGES.upsets = (id, q = {}) => {
    const t = ['top', 'states', 'finals', 'killers'].includes(q.t) ? q.t : 'top';
    const tabs = `<div class="dpick h2tab">${[['top', 'All levels'], ['states', 'States'], ['finals', 'State finals'], ['killers', 'Giant killers']].map(([k, l]) => `<a href="#upsets?t=${k}" class="${k === t ? 'on' : ''}">${l}</a>`).join('')}</div>`;
    const head = `<header class="uh2"><h1>Upsets</h1><div class="sub">Wins over a wrestler rated 1500 or better (an average state qualifier) at odds under 25%, from both wrestlers' ratings going into the bout. The winner has at least three rated bouts behind him, so his rating rests on something.${state.cls === 'ALL' ? '' : ' ' + clsName() + ' only.'}</div>${tabs}</header>`;
    const U = OT.upsets(); if (!U) return head + '<div class="card"><div class="muted bwl" data-need-upsets="1">Loading…</div></div>';
    const inCls = (c) => state.cls === 'ALL' || c === state.cls || c === 'single';
    const cn = (c) => (c === 'single' ? 'One class' : 'Class ' + c);
    const wl = (name, sch) => `<a href="#wrestler/${OT.slug(name)}--${OT.slug(sch)}">${esc(name)}</a>`;
    if (t === 'killers') { const K = U.killers;
      return head + `<div class="card"><ol class="slist">${K.map((k, i) => `<li><span class="sw">${i + 1}</span><span class="sn"><b>${wl(k[0], k[1])}</b><small>${esc(k[1])} · ${k[4] === k[5] ? k[4] : k[4] + '–' + k[5]}${k[6] ? ` · ${k[6]} at states` : ''} · best ${pct(k[3])}</small></span><span class="sr">${k[2]} <i>upset${k[2] === 1 ? '' : 's'}</i></span></li>`).join('')}</ol><div class="note">Upset wins in a career, by the rule above. Ties go to the longer odds.</div></div>`; }
    const L = U[t].filter((r) => inCls(r[1])).slice(0, 100);
    const where = (r) => r[2] === 'state' ? 'States' : OT.unitLabel(r[2], r[3]);
    const key = (r) => r[2] === 'state' ? `${r[0]}.${r[1]}.state.${OT.wNum(r[4])}` : `${r[0]}.${r[1]}.${r[2]}.${r[3]}.${OT.wNum(r[4])}`;
    return head + (L.length ? `<div class="card"><ol class="bw h2m">${L.map((r) => { const p = oddsOf(r[14], r[15]);
      return `<li><a href="${OT.bhref(key(r))}"><span class="bwn"><b>${esc(r[7])} over ${esc(r[9])}</b><small>${r[0]} · ${esc(where(r))} · ${cn(r[1])} ${OT.wShort(r[4])} · ${RN(r[5], r[6])} · ${[RES[r[11]] || r[11], r[12], r[13]].filter(Boolean).join(' ')} · ${esc(r[8])} vs ${esc(r[10])} · ${OT.rw(r[14])} vs ${OT.rw(r[15])}</small></span><span class="bwr"><b>${pct(p)}</b><i>odds</i></span></a></li>`; }).join('')}</ol><div class="note">Tap a bout for its bracket. ${U.n ? fmt(U.n) + ' upsets by this rule in ' + fmt(574000) + '+ bouts on record.' : ''}</div></div>` : empty('No upsets in scope.'));
  };
  PAGES.about = () => `<header class="uh2"><h1>Overtime</h1><div class="sub">Pennsylvania high school wrestling history, from districts to Hershey.</div></header><div class="card about">
    <h3>Overtime Rating</h3><p>Every bout in the archive is read from the brackets (about 374,000, 1938–2026). Each season, every wrestler's rating is fit from all of his postseason bouts at once: sections, districts, regionals and states. So beating the eventual state champion at districts counts the same as beating him at Hershey. Falls and tech falls count a little more than decisions. A wrestler's neighbouring seasons give the starting point, and each district starts at its own level, measured from how its wrestlers do against other districts at regionals and states. A win over someone who went out in the first round counts for very little, because those wrestlers start well below the rest. That rule is the same in every district, so a district with bigger fields doesn't collect extra credit. A wrestler's RTG is his best season. Wrestlers whose season ended in the first round get no rating in the app: their numbers exist only to set that starting point, not to rank them. In brackets, the number beside each name is his rating from the bouts up to that point, with every opponent at his full-season strength; after his last bout it is his season rating. Every season is put on one scale: the 16 best at each weight in that season are lined up with the 16 best of today, top end included, so the 1940s, with only a few bouts per wrestler, don't crowd the all-time lists. 1500 is an average state qualifier of 1999–2026. Checked on bouts hidden from the fit, the rating picks the winner of 78% of 2018–26 regional and state bouts.</p>
    ${OT.aboutViz ? OT.aboutViz() : ''}
    <h3>Strength, Talent and Score</h3><p>Every school, district and region gets the same three numbers. RTG is for wrestlers only.</p><p>Strength: how good the lineup is, like a dual-meet team. At each weight, take the school's best wrestler that season at his rating, including kids who lost in the first round. A weight with nobody entered is a forfeit. Each wrestler's chance of beating an average state qualifier is averaged over the weights, and that average is put back on the rating scale. A Strength of 1300 means the lineup wrestles like a wrestler rated 1300 at every weight. A district's or region's Strength is the average of its top quarter of schools each season (at least one), so a big district isn't rewarded for its size and a small one isn't made to count every school.</p><p>Talent: expected state medalists per season. Each wrestler counts his chance of placing in the top eight at states at his season rating, so a 1550 counts about half, a 1700 about nine-tenths and a 1900 nearly one. The chances come from every season since 2001, when all eight places are on file. For a district or region it is per school.</p><p>Score: placement points per season (per school per season for a district or region).</p><p>Over several seasons, Strength and Talent are plain averages of the season values, and the season count is shown. A season counts only when the district's full field is on file (every entrant, not just the placewinners), because otherwise an empty weight can't be told from a kid who lost early. District 3 and District 7 have no brackets below regionals from 1975 to 1998, so those seasons have Score but no Strength or Talent. Lists rank a school, district or region only when it has Strength for at least a third of the seasons in the window.</p>
    <h3>Score</h3><p>Score is how much a unit wins in a typical season: placement points, 16-12-9-7-5-3-2-1 for 1st through 8th, weighted by the page, averaged over the seasons in the window. On the State page only state results count. A Region page adds regional results at 0.4. District and School pages add district results at 0.15. District strength varies too much to compare district medals statewide, which is why the State page ignores them.</p><p>Three things keep it fair across eras and sizes. Every season is scaled to 13 weights, because seasons had anywhere from 9 to 14. The state record only names the top 2 places before 1974, the top 4 for 1974–82 and the top 6 for 1983–2000, but every weight still had a 3rd through 8th; each missing place is shared equally among the wrestlers who could have won it (state entrants with no place on file, then, when the state bracket was smaller than eight, the regional finalists who didn't reach states). Before regionals existed (1938–50) the missing places are left out. A school's seasons run from its first to its last on file, scoreless seasons included. A district's or region's points are divided by its schools that season, counting every school between its first and last season on file, so a district with missing brackets isn't divided by fewer schools.</p>
    <h3>Strength of competition</h3><p>A bracket's strength of competition is the average rating of its top eight. Every result in the app, on cards, career grids, brackets and season sheets, carries a slim bar beside it: the taller and hotter the bar, the tougher that bracket was compared with other brackets of the same level, so a loaded district reads as loaded. The bracket header lays the same bar flat. Tap or hover for the number.</p>
    <h3>Colour</h3><p>Every rating and strength colour in the app uses one cold-to-hot scale: blue is ice, then cyan, green, yellow and orange, and red is on fire. Maps, the season grid, rating chips and strength bars all read from it, so a colour means the same strength everywhere. Each kind of unit (school, district, region) has its own range, taken from its season ratings since 1974, and the legend under each picture shows it.</p>
    <h3>Seasons and classes</h3><p>The filter bar at the bottom sets the division, the place (region, district, school) and the seasons (TIME: all-time, the last 5, 10 or 25, or any range on the strip); weights narrow the wrestler lists and all-time teams. Totals count each result in the class it was wrestled in. For wrestlers the seasons decide who is in, not what counts: anyone who wrestled a season inside the window is included with his whole career. Region and district membership is taken as of each season.</p>
    <h3>All-time teams</h3><p>Every wrestler who appears in any bracket for the place is a candidate, at one weight: the weight of his highest-rated season. Value is 0.6 × his placement credit plus 0.4 × his peak rating, each compared with the other candidates at that weight. Placement credit follows the page, like Score: state only on the State page, plus regional at 0.4 on a Region page, plus district at 0.15 on District and School pages.</p>
    <h3>Careers</h3><p>Where a district runs sections instead of a district tournament (District 7, District 3 and District 1 in most seasons), the section result fills the District row, marked District · section. In a career grid, Q means he advanced without a recorded place, DNP that he entered and did not place, DNC that the district bracket is on record and he is not in it, and a dash that no bracket is on record. Careers are split by graduating class, so a father and son with the same name at the same school are two people.</p>
    <h3>Missing from the archive</h3><p>The bracket archive marks some tournaments as incomplete: no official team scores, or consolation rounds not on record. Those seasons count only what was recorded. Each District page lists its own.</p>${missingBlock(null)}
    <h3>Sources</h3><p><a href="https://brackets.pa-wrestling.com/" target="_blank" rel="noopener">PA-Wrestling.com bracket archive</a>: every state bracket 1938–2026 and 1,794 district and regional brackets, with seeds, grades, records and team scores. <a href="https://piaadistrict3records.com/" target="_blank" rel="noopener">District III Records</a>: District 3 champions 1938–2024, team champions and PIAA team duals 1999–2024. <a href="https://wpial.org/" target="_blank" rel="noopener">WPIAL</a>: District 7 champions 1936–2024. The District III and WPIAL lists fill only tournaments the archive has no file for. Most District 3 and District 7 AAA district brackets are not yet in the archive, so those years show the champion and nothing below.</p></div>`;

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
  function indexPage(title, items, note) {
    return `<header class="uh"><div><h1>${title}</h1>${note ? `<div class="sub">${note}</div>` : ''}</div></header><div class="idx">${items.map((it) => `<a href="${it.href}"><b>${esc(it.name)}</b><small>${it.sub}</small></a>`).join('')}</div>`;
  }

  /* Tournaments (menu): every bracket in the archive for one season, by level and unit */
  PAGES.tournaments = (id, q = {}) => {
    const ys = OT.YEARS, y = ys.includes(+q.y) ? +q.y : OT.yearsWindow()[1];
    const inCls = (c) => state.cls === 'ALL' || c === state.cls || c === 'single';
    const cn = (c) => (c === 'single' ? 'One class' : c);
    const link = (r, lvl) => `<a class="twl" href="#tournaments?y=${y}&b=${encodeURIComponent(OT.bkey(r, lvl))}">${r.wn}</a>`;
    const rowsOf = (rs, lvl, name) => d3.groups(rs.filter((r) => inCls(r.cls)), (r) => name(r), (r) => r.cls).map(([nm, byC]) => byC.map(([c, v]) => {
      const one = Array.from(d3.group(v, (r) => r.wn).values()).map((g) => g[0]).sort((a, b) => a.wn - b.wn);
      return { nm, c, html: `<div class="tbrow"><span class="tbn"><b>${esc(nm)}</b><small>${cn(c)}</small></span><span class="tbws">${one.map((r) => link(r, lvl)).join('')}</span></div>` }; })).flat();
    const st = rowsOf(OT.APP.filter((r) => r.year === y), 'state', () => 'State championships');
    const reg = rowsOf(OT.LOWER.filter((r) => r.year === y && r.lvl === 'regional'), 'regional', (r) => OT.unitLabel('regional', r.unit)).sort((a, b) => a.nm.localeCompare(b.nm) || a.c.localeCompare(b.c));
    const dis = rowsOf(OT.LOWER.filter((r) => r.year === y && r.lvl === 'district'), 'district', (r) => OT.unitLabel('district', r.unit)).sort((a, b) => (parseInt(a.nm.replace(/\D+/, ''), 10) - parseInt(b.nm.replace(/\D+/, ''), 10)) || a.nm.localeCompare(b.nm) || a.c.localeCompare(b.c));
    const i = ys.indexOf(y), prev = ys[i - 1], next = ys[i + 1];
    const pick = `<div class="typick">${prev ? `<a class="chipb" href="#tournaments?y=${prev}" aria-label="Season ${prev}">‹ ${prev}</a>` : '<span></span>'}<select data-tyear aria-label="Season">${ys.slice().reverse().map((k) => `<option value="${k}"${k === y ? ' selected' : ''}>${k}</option>`).join('')}</select>${next ? `<a class="chipb" href="#tournaments?y=${next}" aria-label="Season ${next}">${next} ›</a>` : '<span></span>'}</div>`;
    const blk = (t, rs) => rs.length ? section(t, `<div class="card tlist">${rs.map((r) => r.html).join('')}</div>`) : '';
    return `<header class="uh2"><h1>Tournaments</h1><div class="sub">Every bracket on record for one season${state.cls === 'ALL' ? '' : ', ' + clsName()}. Tap a weight to open its bracket.</div>${pick}</header>`
      + (y === 2021 ? '<div class="note">2021: eight-man state brackets (COVID year) after East and West super-regionals.</div>' : '') + (blk('State', st) + blk('Regionals', reg) + blk('Districts', dis) || empty('No brackets on record for this season.'));
  };
  /* Missing from the archive (menu) */
  PAGES.missing = () => `<header class="uh2"><h1>Missing</h1><div class="sub">Tournaments the bracket archive marks as incomplete: no official team scores, or consolation rounds not on record. Those seasons count only what was recorded.</div></header>${missingBlock(null).replace('<details class="drawer">', '<details class="drawer" open>') || empty('Nothing marked missing.')}`;
  Object.assign(OT, { PAGES });
})();
