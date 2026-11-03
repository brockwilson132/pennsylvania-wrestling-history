/* Overtime — pages. One level page function; State, Region, District and School all call it. */
'use strict';
(() => {
  const { esc, fmt, ordinal, state, clsName, U, unitRows, unitStats, rankings, regionsInScope, REGIONS, DISTRICTS, distRegions, SCHOOL_BY_SLUG, classHistory, WRESTLER, wrestlersOf, section, empty, unitHeader, bracket, rankTable, windowLabel, wrestlerRank, teamsBlock, seasonsDrawer, lowerBlock, careerGrid, road, chips, placeCounts, lowerRows } = OT;

  /* the one level page */
  function levelPage(u, opts = {}) {
    const o = unitStats(u); const rows = o.apps;
    if (!rows.length) return unitHeader(u, o, opts) + empty(`No ${clsName().toLowerCase()} results for ${esc(u.name)}.`);
    const parts = [unitHeader(u, o, opts)];
    // b. signature viz
    const crumbs = (opts.crumbs || []).concat([{ name: u.name }]); if (u.kind === 'state') crumbs.splice(0, crumbs.length, { name: 'Pennsylvania' });
    parts.push(`<div class="viz">${bracket(u, crumbs, state.bmode, state.bracketAll)}</div>`);
    // c. rankings of children, right under the bracket
    parts.push(`<div class="rk">${opts.rankings(o)}</div>`);
    // d. all-time teams
    parts.push(section('All-time teams', teamsBlock(rows)));
    // e. seasons
    parts.push(section('Seasons', seasonsDrawer(u)));
    // f. lower levels, separate and unmixed
    if (u.kind === 'region') parts.push(lowerBlock(u, 'regional'));
    if (u.kind === 'district') { parts.push(lowerBlock(u, 'district')); }
    if (u.kind === 'school') { parts.push(lowerBlock(u, 'regional')); parts.push(lowerBlock(u, 'district')); }
    return parts.join('');
  }
  const childToggle = (id, kinds, cur) => `<div class="seg sm" data-child="${id}">${kinds.map(([k, l]) => `<button data-kind="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;

  const PAGES = {};
  PAGES.state = () => {
    const u = U.state(); const kind = state.child || 'school';
    return levelPage(u, { sub: 'PIAA individual championships',
      rankings: () => `<div class="tbar" style="margin-bottom:10px">${childToggle('state', [['school', 'Schools'], ['district', 'Districts'], ['region', 'Regions']], kind)}</div>` + rankTable(rankings(kind), { limit: 30, sub: kind === 'school' ? (o) => 'D' + o.u.d : kind === 'district' ? (o) => esc(DISTRICTS[o.u.id]) : null }) });
  };
  PAGES.region = (id) => {
    if (!id) return indexPage('Regions', regionsInScope().map((c) => { const o = unitStats(U.region(c)); return { href: '#region/' + c, name: REGIONS[c], sub: `${fmt(o.medals)} medals · ${fmt(o.titles)} titles` }; }), state.cls === 'ALL' ? 'Regions are the PIAA qualifying tournaments between districts and Hershey. With all classes selected the historical regions stand as they were.' : 'The ' + clsName() + ' regions in this window. Membership follows the state seeds, so a district that moved regions is counted where it actually wrestled; seasons before regions existed are placed through their district.');
    const u = U.region(id); const kind = state.child === 'district' ? 'district' : 'school';
    const rt = state.cls === 'ALL' ? null : d3.mean(OT.seasonsInScope().map((S) => OT.regionTier(S.year, state.cls, id)).filter(Boolean));
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }], sub: rt ? `<span style="display:inline-flex;gap:6px;align-items:center">${OT.bandIcon(rt, 12, 'average region strength over the window: share of state medal points over share of qualifiers')}<span>region strength, ${windowLabel()}</span></span>` : '',
      rankings: () => `<div class="tbar" style="margin-bottom:10px">${childToggle('region', [['school', 'Schools'], ['district', 'Districts']], kind)}</div>` + rankTable(rankings(kind, u), { limit: 25, sub: kind === 'school' ? (o) => 'D' + o.u.d : (o) => esc(DISTRICTS[o.u.id]) }) });
  };
  PAGES.district = (id) => {
    if (!id) return indexPage('Districts', d3.range(1, 13).map((d) => { const o = unitStats(U.district(d)); return { href: '#district/' + d, name: 'District ' + d, sub: `${DISTRICTS[d]} · ${fmt(o.medals)} medals` }; }));
    const u = U.district(+id); const dr = distRegions(+id); const regs = dr.map((c) => `<a href="#region/${c}" style="color:var(--ash)">${REGIONS[c]}</a>`).join(', ');
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(dr.length ? [{ name: REGIONS[dr[0]] + ' Region', href: '#region/' + dr[0] }] : [])], sub: `${esc(DISTRICTS[u.id])}${regs ? ' · wrestles in ' + regs : ''}`,
      rankings: () => rankTable(rankings('school', u), { limit: 25 }) });
  };
  PAGES.school = (sl) => {
    const name = SCHOOL_BY_SLUG.get(sl); if (!name) return `<header class="uh"><h1>Not found</h1></header>` + empty('No school at this address.');
    const u = U.school(name); const hist = classHistory(name).map((h) => `${h.cls === 'single' ? 'One class' : 'Class ' + h.cls} ${h.from === h.to ? h.from : h.from + '–' + h.to}`).join(' · ');
    const o = unitStats(u);
    const roads = o.apps.length ? `<div class="grid2">${[['Trips to Hershey', fmt(o.quals)], ['Medal rate', o.quals ? Math.round(100 * o.medals / o.quals) + '%' : '–'], ['First trip', o.first], ['Latest trip', o.last]].map(([l, v]) => `<div class="card" style="padding:12px"><b class="num" style="font-size:28px;color:var(--gold)">${v == null ? '–' : v}</b><div class="k">${l}</div></div>`).join('')}</div>` : '';
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(u.region ? [{ name: REGIONS[u.region] + ' Region', href: '#region/' + u.region }] : []), { name: 'District ' + u.d, href: '#district/' + u.d }], sub: hist + (o.offMedals ? ` · ${o.offMedals} ${o.offCls} medals count at ${Math.round(100 * o.offClass)}% in ${clsName()}` : ''),
      hero: [['Medals', o.medals], ['Titles', o.titles], ['Team titles', o.won], ['Reg. titles', o.regTitles]],
      rankings: () => roads + '<div style="height:12px"></div>' + wrestlerRank(o.apps, { school: true, limit: 30 }) });
  };
  PAGES.wrestlers = () => {
    const ws = wrestlersOf(OT.careerRows(OT.ROWS().filter((r) => r.place)).filter((r) => r.place));
    const item = (w) => OT.wrestlerCard(w);
    return `<header class="uh"><div><h1>Wrestlers</h1><div class="sub">${fmt(ws.length)} placewinners · sorted by career points${state.win.mode !== 'all' ? ' · anyone who placed in ' + windowLabel() + ', whole career counted' : ''}</div></div></header>
      <input class="search" id="wsearch" type="search" placeholder="Search a wrestler or school" autocomplete="off" aria-label="Search wrestlers">
      <div class="wl" id="wlist" data-n="${ws.length}">${ws.slice(0, 40).map(item).join('')}</div><div class="note" id="wmore">Showing 40 of ${fmt(ws.length)}. Type to search all.</div>`;
  };
  PAGES.wrestler = (sl) => {
    let W = WRESTLER.get(sl); if (!W) W = OT.lowerWrestler(sl); if (!W) return `<header class="uh"><h1>Not found</h1></header>` + empty('No wrestler at this address.');
    if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const u = U.school(W.sch); const places = placeCounts(W.rows); const pts = d3.sum(W.rows, (r) => r.pts);
    const all = W.apps.concat(W.lower); const first = d3.min(all, (r) => r.year), last = d3.max(all, (r) => r.year);
    const dMed = W.lower.filter((r) => r.lvl === 'district' && r.place).length, rMed = W.lower.filter((r) => r.lvl === 'regional' && r.place).length;
    const hero = W.lowerOnly ? [['District medals', dMed], ['Regional medals', rMed], ['District titles', W.lower.filter((r) => r.lvl === 'district' && r.place === 1).length], ['Seasons', new Set(all.map((r) => r.year)).size]] : [['State medals', W.rows.length], ['State titles', places[0]], ['Points', pts], ['D / R medals', `${dMed} / ${rMed}`]];
    const head = `<header class="uh"><div class="crumb"><a href="#state">Pennsylvania</a><span>›</span><a href="#district/${W.d}">District ${W.d}</a><span>›</span><a href="${u.href}">${esc(W.sch)}</a></div>
      <div><h1>${esc(W.name)}</h1><div class="sub">${esc(W.sch)} · ${first === last ? first : first + '–' + last} · ${all.map((r) => r.cls === 'single' ? 'one class' : r.cls).filter((v, i, a) => a.indexOf(v) === i).join('/')}${W.lowerOnly ? ' · never placed at states' : ''}</div></div>
      <div class="hero">${hero.map(([l, v]) => `<div><b>${typeof v === 'number' ? fmt(v) : v}</b><span>${l}</span></div>`).join('')}</div></header>`;
    const grid = section('Career', `<div class="card">${careerGrid(W)}</div>`);
    return head + grid;
  };
  PAGES.about = () => `<header class="uh"><h1>Overtime</h1><div class="sub">Pennsylvania wrestling history, by level.</div></header><div class="card"><p>Every result is an appearance: one wrestler, one season, one weight, at one level of the PIAA bracket. State, Region, District and School are filters over the same appearances, and each level ranks only its own tournament results, so district dominance never mixes with state dominance.</p><p><b>Class moves.</b> A school is counted with the class it is in now, the class of its most recent season, and appears only in that class's lists. Everything it did in the other class still counts for it, but at 85% in Score, Era and Power (medal counts stay whole): an AA result inside the AAA ranking is a little easier, and an AAA result inside the AA ranking is not a measure of AA success. Seasons before 1974, when there was one class, follow the school's lineage. With all classes selected there is no discount.</p><p><b>Regions.</b> In AAA or AA the regions of that class are the only regions (five in AAA; AA has wrestled in four since South Central was folded in). Seasons before 1974, the 2021 super-regionals and any other historical grouping are placed through their district. With all classes selected the historical regions stand as they were.</p><p><b>Scope.</b> The header holds every control: class, the season window (all-time, last 5, 10 or 25 seasons, or a custom range) and multi-select filters for weights, regions, districts and schools. They apply to every number on every page. Era is the share of the window's points; Power keeps its 7-season half-life. For wrestlers the window decides who is in, not what counts: anyone with an appearance in the window is included, and then his whole career is shown and scored, in the wrestler list, in a school's wrestler ranking and in the all-time teams.</p><p><b>Difficulty.</b> Every state bracket (one year, class and weight) gets a strength from what its entrants did in their other seasons: career state points minus that season's, summed over the field, compared only against the other weights of the same year and class, then cut into four tiers. The tier is drawn as a small mat colored green (open) through yellow and orange to red (gauntlet), never as a word; the full name and the biggest names in the bracket are in the tooltip. Any season cell in a wrestler's career opens that tournament's bracket. Regions get the same four tiers each season from their share of state medal points over their share of qualifiers. Turning on <i>Adjust points for field strength</i> in the header multiplies each state result by 0.88, 0.96, 1.04 or 1.12 by tier before Score, Era, Power, the bracket bars and the all-time teams; medal counts never change. District and regional brackets get their own strength from what their medalists did downstream that season (regional points, state points at double weight) and in other seasons, compared within the same level, year and class. Bout-level path difficulty, who you actually beat, is the next layer.</p><p><b>The archive.</b> District and regional results come from 1,794 bracket PDFs (1,252 district, 542 regional) on the PA-Wrestling.com archive, parsed into every medalist, seed, grade and record, plus team scores for about 95% of files. Coverage is uneven by design of the archive: District 3 and District 7 AAA brackets are largely absent, as are some early years; a dashed Q in a career marks a tournament with no file. The PDFs never say who advanced, so qualifiers are inferred: the advancing places are the ones whose wrestlers show up in the next level's field that season. District and regional blocks on the District, Region and School pages rank from those brackets only and never mix with state numbers.</p><p>Sources: PIAA brackets via the PA-Wrestling.com archive.</p></div>`;

  function indexPage(title, items, note) {
    return `<header class="uh"><div><h1>${title}</h1>${note ? `<div class="sub">${note}</div>` : ''}</div></header><div class="idx">${items.map((it) => `<a href="${it.href}"><b>${esc(it.name)}</b><small>${it.sub}</small></a>`).join('')}</div>`;
  }
  Object.assign(OT, { PAGES });
})();
