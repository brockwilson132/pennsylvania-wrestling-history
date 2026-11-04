/* Overtime — pages. One level page function; State, Region, District and School all call it. */
'use strict';
(() => {
  const { esc, fmt, ordinal, state, clsName, U, unitStats, regionsInScope, REGIONS, DISTRICTS, distRegions, SCHOOL_BY_SLUG, classHistory, WRESTLER, wrestlersOf, section, empty, unitHeader, bracket, rankList, unitItems, wrestlerItems, levelRankings, levelStats, windowLabel, teamsBlock, seasonsDrawer, lowerSeasons, careerGrid, placeCounts } = OT;


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
  /* the one level page: header (level switch, hero, podium) → bracket → rankings → all-time team → seasons */
  function seasonsFor(u) {
    if (state.lvl === 'state') return seasonsDrawer(u);
    const rows = OT.lowerUnitRows(u, state.lvl), teams = OT.lowerTeamRows(u, state.lvl);
    return lowerSeasons(u, state.lvl, rows, teams);
  }
  function levelPage(u, opts = {}) {
    OT.pageLvl(u.kind);
    const o = levelStats(u);
    const parts = [unitHeader(u, o, opts)];
    const crumbs = (opts.crumbs || []).concat([{ name: u.name }]); if (u.kind === 'state') crumbs.splice(0, crumbs.length, { name: 'Pennsylvania' });
    if (!o.medals) parts.push(empty(state.lvl === 'state' ? `No state medals for ${esc(u.name)} in ${clsName().toLowerCase()}, ${windowLabel()}.` : o.cov && !o.cov.n ? `The archive has no ${state.lvl} brackets for ${esc(u.name)}${state.cls !== 'ALL' ? ' in ' + clsName() : ''}.` : `No ${state.lvl} medals for ${esc(u.name)} in this scope.`));
    else {
      parts.push(`<div class="viz">${bracket(u, crumbs, state.bmode, state.bracketAll)}</div>`);
      parts.push(section('Rankings', opts.rankings(o)));
    }
    parts.push(section('All-time team', teamsBlock(u)));
    if (o.medals) parts.push(section('Seasons', seasonsFor(u)));
    if (u.kind === 'state' || u.kind === 'school') parts.push(dualsBlock(u));
    if (u.kind === 'school') parts.push(section('Roster', rosterBlock(u)));
    return parts.join('');
  }
  const childToggle = (id, kinds, cur) => `<div class="seg sm" data-child="${id}">${kinds.map(([k, l]) => `<button data-kind="${k}" aria-pressed="${k === cur}">${l}</button>`).join('')}</div>`;
  const unitRank = (kind, u, toggle) => rankList(unitItems(levelRankings(kind, u), kind, u), { top: toggle ? `<div class="rtop">${toggle}</div>` : '' });

  const PAGES = {};
  PAGES.state = () => {
    const u = U.state(); const kind = ['school', 'district', 'region'].includes(state.child) ? state.child : 'school';
    return levelPage(u, { sub: 'PIAA individual championships', rankings: () => unitRank(kind, u, childToggle('state', [['school', 'Schools'], ['district', 'Districts'], ['region', 'Regions']], kind)) });
  };
  PAGES.region = (id) => {
    if (!id) return indexPage('Regions', regionsInScope().map((c) => { const o = unitStats(U.region(c)); return { href: '#region/' + c, name: REGIONS[c], sub: `${fmt(o.medals)} state medals · ${fmt(o.titles)} titles` }; }), state.cls === 'ALL' ? 'The qualifying tournaments between districts and Hershey.' : 'The ' + clsName() + ' regions.');
    const u = U.region(id); const kind = state.child === 'district' ? 'district' : 'school';
    const mem = OT.regionMembers(id), win = OT.windowLabel(); const full = mem.every((m) => m.span === win);
    const memSub = mem.length ? mem.map((m) => `<a href="#district/${m.d}" style="color:var(--ash)">District ${m.d}</a>${full ? '' : ' · ' + m.span}`).join(full ? ', ' : '<br>') + (full ? '' : '<br><span class="note1">Membership as of each season</span>') : '';
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }], sub: memSub, rankings: () => unitRank(kind, u, childToggle('region', [['school', 'Schools'], ['district', 'Districts']], kind)) });
  };
  PAGES.district = (id) => {
    if (!id) return indexPage('Districts', d3.range(1, 13).map((d) => { const o = unitStats(U.district(d)); return { href: '#district/' + d, name: 'District ' + d, sub: `${DISTRICTS[d]} · ${fmt(o.medals)} state medals` }; }));
    const u = U.district(+id); const spans = OT.districtRegionSpans(+id), win = OT.windowLabel(); const dr = spans.map((x) => x.g);
    const one = spans.length === 1 && spans[0].span === win;
    const regs = spans.map((x) => `<a href="#region/${x.g}" style="color:var(--ash)">${REGIONS[x.g]}</a>${one ? '' : ' ' + x.span}`).join(', ');
    const movers = OT.districtMovers(+id).filter((m) => m.span !== win && m.n < 0.85 * m.total).slice(0, 4);
    const moveNote = (one ? '' : '') + (movers.length ? `<br><span class="note1">Part of the window: ${movers.map((m) => `<a href="#school/${OT.slug(m.sch)}" style="color:var(--ash)">${esc(m.sch)}</a> ${m.span}`).join(' · ')}</span>` : '') + (!one || movers.length ? '<br><span class="note1">Membership as of each season</span>' : '');
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(dr.length ? [{ name: REGIONS[dr[0]] + ' Region', href: '#region/' + dr[0] }] : [])], sub: `${esc(DISTRICTS[u.id])}${regs ? ' · wrestles in ' + regs : ''}${moveNote}`,
      rankings: () => unitRank('school', u) });
  };
  PAGES.school = (sl) => {
    const name = SCHOOL_BY_SLUG.get(sl); if (!name) return `<header class="uh"><h1>Not found</h1></header>` + empty('No school at this address.');
    OT.pageLvl('school'); const u = U.school(name); const hist = classHistory(name).map((h) => `${h.cls === 'single' ? 'One class' : 'Class ' + h.cls} ${h.from === h.to ? h.from : h.from + '–' + h.to}`).join(' · ');
    const o = unitStats(u);
    return levelPage(u, { crumbs: [{ name: 'Pennsylvania', href: '#state' }, ...(u.region ? [{ name: REGIONS[u.region] + ' Region', href: '#region/' + u.region }] : []), { name: 'District ' + u.d, href: '#district/' + u.d }], sub: hist + (state.lvl === 'state' && o.offMedals ? ` · ${o.offMedals} ${o.offCls} medals count at ${Math.round(100 * o.offClass)}%` : ''),
      hero: state.lvl === 'state' ? [['Medals', o.medals], ['Titles', o.titles], ['Team titles', o.won], ['Qualifiers', o.quals]] : null,
      rankings: () => rankList(wrestlerItems(u), { limit: 25 }) });
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
    const ws = wrestlersOf(OT.careerRows(OT.ROWS().filter((r) => r.place)).filter((r) => r.place));
    return `<header class="uh"><div><h1>Wrestlers</h1><div class="sub">Top state placewinners in ${clsName().toLowerCase()}, ${windowLabel()}. Search finds anyone who wrestled in a district, regional or state bracket.</div></div></header>
      <input class="search" id="wsearch" type="search" placeholder="Search any wrestler or school" autocomplete="off" aria-label="Search wrestlers">
      <div class="wl" id="wlist">${ws.slice(0, 40).map(OT.wrestlerCard).join('')}</div><div class="note" id="wmore">Showing 40 of ${fmt(ws.length)} placewinners.</div>`;
  };
  PAGES.wrestler = (sl) => {
    const W = OT.getWrestler(sl);
    if (!W) return OT.peopleLoaded() ? `<header class="uh"><h1>Not found</h1></header>` + empty('No wrestler at this address.') : `<header class="uh"><h1>Loading…</h1></header><div class="card empty" data-need-people="1">Looking up this wrestler…</div>`;
    if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const u = U.school(W.sch); const places = placeCounts(W.rows); const pts = d3.sum(W.rows, (r) => r.pts);
    const all = W.apps.concat(W.lower); const first = all.length ? d3.min(all, (r) => r.year) : W.person && W.person.y0, last = all.length ? d3.max(all, (r) => r.year) : W.person && W.person.y1;
    const dMed = W.lower.filter((r) => r.lvl === 'district' && r.place).length, rMed = W.lower.filter((r) => r.lvl === 'regional' && r.place).length;
    const hero = W.lowerOnly ? [['District medals', dMed], ['Regional medals', rMed], ['District titles', W.lower.filter((r) => r.lvl === 'district' && r.place === 1).length], ['Seasons', new Set(all.map((r) => r.year)).size]] : [['State medals', W.rows.length], ['State titles', places[0]], ['Points', pts], ['D / R medals', `${dMed} / ${rMed}`]];
    const head = `<header class="uh"><div class="crumb"><a href="#state">Pennsylvania</a><span>›</span><a href="#district/${W.d}">District ${W.d}</a><span>›</span><a href="${u.href}">${esc(W.sch)}</a></div>
      <div><h1>${esc(W.name)}</h1><div class="sub">${esc(W.sch)} · ${first === last ? first : first + '–' + last}${W.lowerOnly && !W.apps.length ? ' · never reached states' : ''}</div></div>
      <div class="hero">${hero.map(([l, v]) => `<div><b>${typeof v === 'number' ? fmt(v) : v}</b><span>${l}</span></div>`).join('')}</div></header>`;
    const grid = section('Career', `<div class="card">${careerGrid(W)}</div>`);
    return head + grid + ratingStrip(W);
  };
  PAGES.about = () => `<header class="uh"><h1>Overtime</h1><div class="sub">Pennsylvania wrestling history, by level.</div></header><div class="card"><p>Every result is an appearance: one wrestler, one season, one weight, at one level of the PIAA bracket. State, Region, District and School are filters over the same appearances, and each level ranks only its own tournament results, so district dominance never mixes with state dominance.</p><p><b>Class moves.</b> A school is counted with the class it is in now, the class of its most recent season, and appears only in that class's lists. Everything it did in the other class still counts for it, but at 85% in Score, Era and Power (medal counts stay whole): an AA result inside the AAA ranking is a little easier, and an AAA result inside the AA ranking is not a measure of AA success. Seasons before 1974, when there was one class, follow the school's lineage. With all classes selected there is no discount.</p><p><b>Regions.</b> In AAA or AA the regions of that class are the only regions (five in AAA; AA has wrestled in four since South Central was folded in). Seasons before 1974, the 2021 super-regionals and any other historical grouping are placed through their district. With all classes selected the historical regions stand as they were.</p><p><b>Scope.</b> The header holds every control: class, the season window (all-time, last 5, 10 or 25 seasons, or a custom range) and multi-select filters for weights, regions, districts and schools. They apply to every number on every page. Era is the share of the window's points; Power keeps its 7-season half-life. For wrestlers the window decides who is in, not what counts: anyone with an appearance in the window is included, and then his whole career is shown and scored, in the wrestler list, in a school's wrestler ranking and in the all-time teams.</p><p><b>Overtime Rating.</b> Every bout in the archive is read from the brackets (374,000 of them, 1938–2026), and every wrestler gets a rating for each season. A season is fit as one batch from all his bouts at districts, regionals and states, so a win counts by how good the opponent was that whole season, whatever the round or level: beating the eventual state champion at districts counts the same as beating him at Hershey. Falls and tech falls count a little more than decisions. Neighbouring seasons inform a rating only lightly, the year before more than the year after, so a senior's win over a freshman who later became a champion is credited for the freshman he beat. Ratings sit on one scale for every level and era: 1500 is the average state qualifier, and 400 points is about 10-to-1 odds. In a state bracket the champion carries the top rating 82% of the time. RTG on a card is his peak season.</p><p><b>Field and best wins.</b> A bracket's field is the mean rating of its top eight, shown as a gauge against a typical district (about 1220), regional (about 1380) and state field (about 1640). Each tournament also lists a wrestler's best win, by the opponent's rating that season, and any upset losses (to someone rated 150 or more below him). These describe a run; they are not added to scores, because once a wrestler's own rating is known they predict nothing more about where he places (docs/DIFFICULTY.md). Districts and regionals with only champions on record (District III Records, the WPIAL) have no bouts and so no ratings.</p><p><b>The archive.</b> District and regional results come from 1,794 bracket PDFs (1,252 district, 542 regional) on the PA-Wrestling.com archive, parsed into every medalist, seed, grade and record, plus team scores for about 95% of files. Coverage is uneven by design of the archive: District 3 and District 7 AAA brackets are largely absent from it, as are some early years. For those, the champion comes from District III Records or the WPIAL; a dashed Q in a career marks a district result that is not on record. The PDFs never say who advanced, so qualifiers are inferred: the advancing places are the ones whose wrestlers show up in the next level's field that season. </p><p><b>Levels.</b> The State · Regional · District switch on every page picks which tournament the podium, bracket, rankings and seasons count; levels never mix. <b>All-time teams.</b> Every wrestler who appears in any bracket for the place is a candidate, at one weight: the weight of his highest-rated season. Value = 0.6 × his placement credit + 0.4 × his peak Overtime Rating, each as a z-score among that place's candidates at the weight. Placement credit is 16-12-9-7-5-3-2-1 per place over his whole career, weighted by level, and depends on the page: State counts state results only, because district strength varies too much to compare statewide; a Region adds regional results at 0.4; a District or School adds those plus district results at 0.15. Qualifying without placing earns a little (1 at states, 0.5 at regionals, times the weight). The rating carries strength of schedule, so a medal from a weak bracket is checked by who he actually beat. In a career, Q means he advanced without a recorded place, DNP that he entered and did not place, DNC that the district bracket is on record and he is not in it, and a dash that no bracket is on record.</p><p><b>Sources.</b> <a href="https://brackets.pa-wrestling.com/" target="_blank" rel="noopener">PA-Wrestling.com bracket archive</a>: every state bracket 1938–2026 and 1,794 district and regional brackets, with seeds, grades, records and team scores. <a href="https://piaadistrict3records.com/" target="_blank" rel="noopener">District III Records</a>: District 3 champions for every year and class 1938–2024 (with region champions and PIAA finishes marked), District 3 team champions, and PIAA team duals results 1999–2024. <a href="https://wpial.org/" target="_blank" rel="noopener">WPIAL</a>: District 7 champions 1936–2024. The District III and WPIAL lists fill only tournaments the archive has no file for, so those years show the champion and nothing below; agreement with the archive where both exist is above 99% once spelling variants are allowed.</p></div>`;

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
    return section('Rating', `<div class="card rcard"><div class="rhead"><div><span class="k">Peak</span>${OT.rtgTag(c.peak, { size: 'lg', title: 'peak Overtime Rating, ' + c.peakYear })}<small class="muted">${c.peakYear}</small></div><div><span class="k">Career average</span><b class="num">${OT.rtg10(c.avg)}</b></div></div>${svg}<div class="k" style="margin-top:6px">Best wins</div><div id="bestwins" data-w="${esc(W.slug)}">${bestWinsHTML(W)}</div><div class="note">His strength each season from every bout at every level. 1500 = the average state qualifier.</div></div>`);
  }
  OT.bestWinsHTML = bestWinsHTML;
  function indexPage(title, items, note) {
    return `<header class="uh"><div><h1>${title}</h1>${note ? `<div class="sub">${note}</div>` : ''}</div></header><div class="idx">${items.map((it) => `<a href="${it.href}"><b>${esc(it.name)}</b><small>${it.sub}</small></a>`).join('')}</div>`;
  }
  Object.assign(OT, { PAGES });
})();
