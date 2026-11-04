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
      const rows = fin.map((d) => `<tr><td class="num">${d.year}</td><td>${d.cls}</td><td><a href="#school/${OT.slug(d.w)}"><b>${esc(d.w)}</b></a> <small class="ash">D${d.wd || '?'}</small></td><td class="num">${d.ws}–${d.ls}</td><td><a href="#school/${OT.slug(d.l)}">${esc(d.l)}</a></td></tr>`).join('');
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
    if (a.rating) it.push([OT.r10(a.rating), 'RTG', 'Overtime Rating, averaged over the seasons in the window']);
    if (a.score) it.push([fmt(Math.round(a.score)), 'Score', 'placement points in the window, weighted for this page']);
    return `<div class="usum">${it.map(([v, l, t]) => `<span${t ? ` title="${esc(t)}"` : ''}><b>${v}</b><i>${l}</i></span>`).join('')}</div>`;
  }
  function levelPage(u, opts = {}) {
    state.lvl = 'state';
    const crumbs = (opts.crumbs || []).concat([{ name: '' }]);
    const head = `<header class="uh2">${crumbBar(crumbs)}<h1>${esc(u.name)}</h1>${opts.sub ? `<div class="sub">${opts.sub}</div>` : ''}${summary(u)}</header>`;
    const rk = opts.rankings();
    const rankSec = `<section class="sec"><div class="sech"><h2>${rk.title}</h2><span class="ctl">${rk.toggle || ''}${rk.sortSeg || ''}</span></div>${rk.html}</section>`;
    const map = u.kind === 'school' ? '' : OT.ratingMap(u);
    const parts = [head, map ? `<section class="sec secmap">${map}</section>` : '', u.kind === 'school' ? `<section class="sec">${OT.perfChart(u)}</section>` : '', rankSec, section('All-time team', teamsBlock(u)), section('Seasons', seasonsDrawer(u))];
    if (u.kind === 'state' || u.kind === 'school') parts.push(dualsBlock(u));
    if (u.kind === 'school') parts.push(section('Roster', rosterBlock(u)));
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
      rankings: () => unitRank('school', { kind: 'district', id: +id }, 'district') }) + (missingRows(+id).length ? section('Missing from the archive', missingBlock(+id)) : '');
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
      rankings: () => wrestlerRank(OT.unitRows(u), { limit: 15, noSchool: true }) });
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
    const r = wrestlerRank(OT.ROWS().filter((x) => x.place), { limit: 40, title: 'Placewinners' });
    return `<header class="uh2"><h1>Wrestlers</h1><div class="sub">State placewinners, ${clsName()}, ${windowLabel()}, with their whole careers. Search finds anyone in any district, regional or state bracket.</div></header>
      <input class="search" id="wsearch" type="search" placeholder="Search any wrestler or school" autocomplete="off" aria-label="Search wrestlers">
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
    const sumI = (cr ? [[OT.r10(cr.peak), 'Peak RTG'], [OT.r10(cr.avg), 'Career avg']] : []).concat(heroK.filter(([, v]) => v !== 0 && v !== '0 / 0').map(([l, v]) => [typeof v === 'number' ? fmt(v) : v, l])).concat(recI);
    const head = `<header class="uh2"><div class="crumb"><a href="#state">Pennsylvania</a><span>›</span><a href="#district/${W.d}">District ${W.d}</a><span>›</span><a href="${u.href}">${esc(W.sch)}</a></div>
      <h1>${esc(W.name)}</h1><div class="sub">${esc(W.sch)} · ${first === last ? first : first + '–' + last}${W.lowerOnly && !W.apps.length ? ' · never reached states' : ''}</div>
      <div class="usum"${OT.bwLoaded() ? '' : ' data-need-bw="1"'}>${sumI.map(([v, l]) => `<span><b>${v}</b><i>${l}</i></span>`).join('')}</div></header>`;
    const tl = section('Career', `<div class="card tlcard">${OT.timeline(W.apps, W.lower, { page: true, full: W.full })}<div class="note">Tap a result for its bracket. Q advanced without a place · DNP entered, didn't place · DNC didn't compete · – no bracket on record. The bar beside each result is that bracket\'s strength of competition.${W.full ? '' : ' Loading his full career…'}</div></div>`);
    const bw = section('Best wins', `<div class="card" id="bestwins" data-w="${W.slug}">${bestWinsHTML(W)}</div>`);
    return head + tl + bw;
  };
  PAGES.about = () => `<header class="uh2"><h1>Overtime</h1><div class="sub">Pennsylvania high school wrestling history, from districts to Hershey.</div></header><div class="card about">
    <h3>Overtime Rating</h3><p>Every bout in the archive is read from the brackets (about 374,000, 1938–2026), and every wrestler gets a rating for each season from all of his bouts at districts, regionals and states, fit together, so beating the eventual state champion at districts counts the same as beating him at Hershey. Falls and tech falls count a little more than decisions. Neighbouring seasons inform a rating lightly, the year before more than the year after. One scale for every level and era: 1500 is the average state qualifier, and 400 points is about 10-to-1 odds. A wrestler's RTG is his peak season.</p>
    <h3>Rating for schools, districts and regions</h3><p>A school's season rating is the average rating of its lineup: its best wrestler at each weight, with an empty weight counting as a replacement-level entrant. Where a season's district bracket is not on file (most District 3 and District 7 AAA seasons, where the archive has only champions), the wrestlers who lost at districts are unknown, so the rating is estimated: the school's wrestlers who reached regionals and states count as they are, and each other weight gets the value a school with that profile shows when the bracket is on file (fitted on seasons with full brackets; checked by hiding District 1 and 11 brackets, mean error about 32 points, and on the two WPIAL seasons that are on file, about 19). Estimated values carry a dotted underline. In the wrestler-ratings table, districts whose brackets are not on file are left out of the State and Region averages. A district's or region's season rating is the average of its four best wrestlers at each weight, so a bigger district rates higher only when its best really are better. Over the selected seasons, a unit's rating is the average of its season ratings. Lists need enough seasons in the window to be ranked: a third of them for schools, half for districts and regions.</p>
    <h3>Score</h3><p>Score is how much a unit won in the selected seasons: placement points, 16-12-9-7-5-3-2-1 for 1st through 8th, weighted by the page. On the State page only state results count. A Region page adds regional results at 0.4. District and School pages add district results at 0.15. District strength varies too much to compare district medals statewide, which is why the State page ignores them. Score grows with size and years by design; Rating does not.</p>
    <h3>Strength of competition</h3><p>A bracket's strength of competition is the average rating of its top eight. Every result in the app, on cards, career grids, brackets and season sheets, carries a slim bar beside it: the taller and hotter the bar, the tougher that bracket was compared with other brackets of the same level, so a loaded district reads as loaded. The bracket header lays the same bar flat. Tap or hover for the number.</p>
    <h3>Colour</h3><p>Every rating and strength colour in the app uses one cold-to-hot scale: blue is ice, then cyan, green, yellow and orange, and red is on fire. Maps, the season grid, rating chips and strength bars all read from it, so a colour means the same strength everywhere. Each kind of unit (school, district, region) has its own range, taken from its season ratings since 1974, and the legend under each picture shows it.</p>
    <h3>Seasons and classes</h3><p>The header sets the class and the seasons (all-time, the last 5, 10 or 25, or a custom range); weights narrow the wrestler lists and all-time teams. Totals count each result in the class it was wrestled in. For wrestlers the seasons decide who is in, not what counts: anyone who wrestled a season inside the window is included with his whole career. Region and district membership is taken as of each season.</p>
    <h3>All-time teams</h3><p>Every wrestler who appears in any bracket for the place is a candidate, at one weight: the weight of his highest-rated season. Value is 0.6 × his placement credit plus 0.4 × his peak rating, each compared with the other candidates at that weight. Placement credit follows the page, like Score: state only on the State page, plus regional at 0.4 on a Region page, plus district at 0.15 on District and School pages.</p>
    <h3>Careers</h3><p>In a career grid, Q means he advanced without a recorded place, DNP that he entered and did not place, DNC that the district bracket is on record and he is not in it, and a dash that no bracket is on record. Careers are split by graduating class, so a father and son with the same name at the same school are two people.</p>
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
  Object.assign(OT, { PAGES });
})();
