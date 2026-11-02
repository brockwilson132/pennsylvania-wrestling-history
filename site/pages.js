/* Index pages, Weights (compare), Records, Sources, and the app chrome. */
'use strict';
const VIEWS = {};

VIEWS.overview = () => unitPage(stateUnit());

/* ---------------- ranking table shared by Schools and Districts ---------------- */
const SORTS = [['share', 'Era score'], ['power', 'Current power'], ['pts', 'All-time points'], ['titles', 'Titles'], ['medals', 'Medals'], ['trend', 'Trend']];
const spark = (st, color) => {
  const W = 120, H = 28, y0 = LAST_SEASON - 19, ys = d3.range(y0, LAST_SEASON + 1);
  const by = new Map(st.seasons.map((x) => [x.year, x.share]));
  const max = Math.max(0.02, d3.max(ys, (y) => by.get(y) || 0));
  const x = d3.scaleBand(ys, [0, W]).paddingInner(0.3), y = d3.scaleLinear([0, max], [H, 0]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${ys.map((yr) => `<rect x="${x(yr).toFixed(1)}" width="${x.bandwidth().toFixed(1)}" y="${y(by.get(yr) || 0).toFixed(1)}" height="${(H - y(by.get(yr) || 0)).toFixed(1)}" fill="${by.get(yr) ? color : '#2a2c30'}"/>`).join('')}</svg>`;
};
const trendArrow = (t) => (t > 0.08 ? `<span class="tr up">▲ ${Math.round(t * 100)}</span>` : t < -0.08 ? `<span class="tr down">▼ ${Math.round(-t * 100)}</span>` : `<span class="tr flat">—</span>`);
function rankingTable(h, kind) {
  const rows = rankings(kind);
  let sort = state.rankSort || 'share', q = '', df = 'all', limit = 60;
  const draw = () => {
    const f = rows.filter((o) => (kind === 'district' || ((df === 'all' || o.seasons[0] && (SCHOOL_BY_SLUG.get(slug(o.u.name)) || {}).d === +df) && o.u.name.toLowerCase().includes(q)))).sort((p, q2) => q2[sort] - p[sort] || q2.pts - p.pts);
    const color = (o) => (kind === 'district' ? dColor(o.u.d) : sColor(o.u.name));
    h.innerHTML = `<div class="tablebox rank-box"><table class="data rank"><thead><tr><th class="n">#</th><th>${kind === 'district' ? 'District' : 'School'}</th>${kind === 'district' ? '' : '<th>Dist.</th>'}<th class="n${sort === 'share' ? ' acc' : ''}"><button type="button" data-s="share">Era score</button></th><th class="n${sort === 'power' ? ' acc' : ''}"><button type="button" data-s="power">Power</button></th><th class="n${sort === 'pts' ? ' acc' : ''}"><button type="button" data-s="pts">Points</button></th><th class="n${sort === 'titles' ? ' acc' : ''}"><button type="button" data-s="titles">Titles</button></th><th class="n${sort === 'medals' ? ' acc' : ''}"><button type="button" data-s="medals">Medals</button></th><th class="n">Top team</th><th class="sp">Last 20 seasons</th><th class="n${sort === 'trend' ? ' acc' : ''}"><button type="button" data-s="trend">Trend</button></th></tr></thead><tbody>${f.slice(0, limit).map((o, i) => `<tr><td class="n rk">${i + 1}</td><td>${kind === 'district' ? `<a class="who" href="#district-${o.u.d}"><span class="dsw" style="background:${dColor(o.u.d)}"></span><span>District ${o.u.d}</span></a>` : whoLink(o.u.name, 22)}</td>${kind === 'district' ? '' : `<td>${dpill((SCHOOL_BY_SLUG.get(slug(o.u.name)) || { d: o.seasons[0].rows[0].d }).d)}</td>`}<td class="n${sort === 'share' ? ' acc' : ''}">${Math.round(o.share * 100)}</td><td class="n${sort === 'power' ? ' acc' : ''}">${Math.round(o.power)}</td><td class="n${sort === 'pts' ? ' acc' : ''}">${fmt(o.pts)}</td><td class="n${sort === 'titles' ? ' acc' : ''}">${o.titles}</td><td class="n${sort === 'medals' ? ' acc' : ''}">${o.medals}</td><td class="n">${o.top1 || ''}</td><td class="sp">${spark(o, color(o))}</td><td class="n${sort === 'trend' ? ' acc' : ''}">${trendArrow(o.trend)}</td></tr>`).join('')}</tbody></table></div>${f.length > limit ? `<div class="more"><button type="button" class="btn ghost" id="rk-more">Show all ${f.length}</button></div>` : ''}`;
    h.querySelectorAll('[data-s]').forEach((bt) => bt.addEventListener('click', () => { sort = bt.dataset.s; state.rankSort = sort; draw(); }));
    h.querySelector('#rk-more')?.addEventListener('click', () => { limit = 9999; draw(); });
  };
  draw();
  return { filter: (o) => { if (o.q != null) q = o.q.toLowerCase(); if (o.d != null) df = o.d; draw(); } };
}
const METHOD = `Every state medal earns placement points: 16, 12, 9, 7, 5, 3, 2, 1 for 1st through 8th. <b>Points</b> is the all-time sum. <b>Era score</b> is the sum of each season’s share of the points available that year, times 100, so 100 is one full season’s worth; it treats a 1950 finalist (two places awarded) fairly against a 2024 placer (eight). <b>Power</b> is points decayed by recency with a seven-season half-life, one roster generation. <b>Trend</b> compares era score over the last ten seasons with the ten before. <b>Top team</b> is seasons finishing first in points.`;

/* ---------------- Districts ---------------- */
VIEWS.districts = function () {
  const all = SC();
  $view.innerHTML = `<header class="page-head"><h1>Districts</h1><p class="lede">Pennsylvania’s twelve PIAA districts, ranked on the same scoring as every school: placement points from every ${clsName()} state medal. Click a column to re-rank.</p></header>
    ${HAS_MEDALS ? `<section class="sec"><div data-c="rank"></div><p class="method">${METHOD}</p></section>` : ''}
    <section class="sec">${tab('On the mat', `Each district’s ${clsName()} state champions lit on the same state mat; the dark marks are everyone else.`)}<div class="mats" id="mats"></div></section>`;
  if (HAS_MEDALS) rankingTable(host('rank'), 'district');
  const rows = d3.range(1, 13).map((d) => { const rs = all.filter((r) => r.d === d); const lead = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1])[0]; return { d, n: rs.length, lead }; }).sort((a, b) => b.n - a.n || a.d - b.d);
  $view.querySelector('#mats').innerHTML = rows.map((o, i) => `<a class="mat-card" href="#district-${o.d}"><div class="mc-head"><span class="mc-rank">${i + 1}</span><span class="mc-num" style="color:${dColor(o.d)}">${o.d}</span><span class="mc-name"><b>District ${o.d}</b><span>${esc(DISTRICTS[o.d])}</span></span></div><div class="chart" data-c="dm-${o.d}"></div><div class="mc-foot"><b>${o.n}</b> ${o.n === 1 ? 'title' : 'titles'}${o.lead ? `<span>Top program: ${esc(o.lead[0])}, ${o.lead[1]}</span>` : ''}</div></a>`).join('');
  rows.forEach((o) => arenaMat(host('dm-' + o.d), all, { mini: true, size: 240, color: (r) => (r.d === o.d ? dColor(o.d) : GHOST), center: String(o.n), label: `District ${o.d} on the state mat` }));
};

/* ---------------- Schools: the ranking ---------------- */
VIEWS.schools = function () {
  $view.innerHTML = `<header class="page-head"><h1>Schools</h1><p class="lede">Every program with a ${clsName()} state medal, ranked. Era score is the default: it rewards sustained success and treats every era fairly. Power answers who is strong now. Click a column to re-rank.</p></header>
    <div class="controls"><input class="field" id="s-q" type="search" placeholder="Find a school" aria-label="Find a school"><label class="sel">District <select id="s-d"><option value="all">All</option>${d3.range(1, 13).map((d) => `<option value="${d}">${d}</option>`).join('')}</select></label></div>
    <div data-c="rank"></div><p class="method">${METHOD}</p>`;
  if (!HAS_MEDALS) { host('rank').innerHTML = '<p class="empty">Medal data is not loaded.</p>'; return; }
  const t = rankingTable(host('rank'), 'school');
  $view.querySelector('#s-q').addEventListener('input', (e) => t.filter({ q: e.target.value }));
  $view.querySelector('#s-d').addEventListener('change', (e) => t.filter({ d: e.target.value }));
};

/* ---------------- Weights: compare units side by side ---------------- */
VIEWS.weights = function () {
  const champs = SC();
  const med = state.depth === 'medal' && HAS_MEDALS;
  const rows = med ? SM() : champs;
  const wt = med ? (r) => ptsOf(r.place) : () => 1;
  const noun = med ? 'points' : 'titles';
  const top = state.cmp === 'schools';
  const units = top
    ? (HAS_MEDALS ? rankings('school').sort((a, b) => b.share - a.share).slice(0, 12).map((o) => o.u.name) : Array.from(d3.rollup(champs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([sch]) => sch)).map((sch) => ({ label: sch, href: schoolHref(sch), chip: badge(sch, 20), rows: rows.filter((r) => r.sch === sch) }))
    : d3.range(1, 13).map((d) => ({ label: `District ${d}`, href: '#district-' + d, chip: dtag(d), rows: rows.filter((r) => r.d === d) })).filter((o) => o.rows.length >= 10);
  units.forEach((o) => { o.pos = scalePos(fifthShares(o.rows, wt)); });
  units.sort((a, b) => b.pos - a.pos);
  const ref = { label: 'All of ' + clsName(), short: 'the class', rows, ref: true };
  const [a, b] = yearsOf(champs);
  $view.innerHTML = `<header class="page-head"><h1>Weights</h1><p class="lede">Where on the scale each ${top ? 'program' : 'district'} does its winning, compared with the whole of ${clsName()}.</p></header>
    <div class="wt-controls">
      <div class="seg" role="group" aria-label="Compare"><button type="button" data-cmp="districts" aria-pressed="${!top}">Districts</button><button type="button" data-cmp="schools" aria-pressed="${top}">Top 12 programs</button></div>
      ${HAS_MEDALS ? `<div class="seg depth" role="group" aria-label="Count"><button type="button" data-depth="champ" aria-pressed="${!med}">Titles</button><button type="button" data-depth="medal" aria-pressed="${med}">Medal points</button></div>` : ''}
    </div>
    <section class="sec">${tab('Light, middle or heavy', `Each bar is one ${top ? 'program' : 'district'}: all of its ${noun} split into fifths of each season’s lineup, lightest at the left. One that wins evenly across the scale shows about 20% in each. Heaviest-leaning first; the note says how much heavier or lighter it runs than the whole class.`)}
      <div class="panel"><div data-c="fb"></div></div></section>
    <section class="sec">${tab('By weight class', `Each row adds to 100%: the share of that ${top ? 'program' : 'district'}’s ${noun} at each weight, lightest at the left. Brighter is more. A green edge is at least four points above the whole class at that weight; a red edge, four below. The small number is the ${med ? 'points' : 'titles'} behind it. Weights are filed under today’s nearest class (103 and 106 count as 107); 98 is kept as a retired class, and every heavyweight limit is one class.`)}
      <div class="panel"><div data-c="cg"></div></div></section>
    <section class="sec">${tab('The weight classes', `The weights contested in ${clsName()}, season by season, ${a}–${b}. Pennsylvania has reshuffled its lineup several times; today’s 13 weights date from 2023.`)}<div class="chart" data-c="w-hist"></div></section>`;
  $view.querySelectorAll('[data-cmp]').forEach((bt) => bt.addEventListener('click', () => { if (bt.dataset.cmp === state.cmp) return; state.cmp = bt.dataset.cmp; route(true); }));
  $view.querySelectorAll('[data-depth]').forEach((bt) => bt.addEventListener('click', () => { if (bt.dataset.depth === state.depth) return; state.depth = bt.dataset.depth; route(true); }));
  fifthBars(host('fb'), [ref].concat(units), { wt, noun, hideRef: true });
  classGrid(host('cg'), [ref].concat(units), { wt, unit: med ? 'pts' : 'titles' });
  const all = champs;
  const wts = Array.from(new Set(all.map((r) => r.w))).sort((a, b) => wNum(a) - wNum(b));
  const [y0, y1] = yearsOf(all);
  const hh = host('w-hist'); const HW = widthOf(hh), rh = 15, hl = 44, HH = wts.length * rh + 26;
  const hx = d3.scaleLinear([y0, y1 + 1], [hl, HW - 6]);
  const hs = svgIn(hh, HW, HH, 'Weight classes contested by season');
  const ticks = d3.range(Math.ceil(y0 / 10) * 10, y1 + 1, 10);
  hs.append('g').selectAll('line').data(ticks).join('line').attr('class', 'grid').attr('x1', hx).attr('x2', hx).attr('y1', 0).attr('y2', HH - 20);
  hs.append('g').selectAll('text').data(ticks).join('text').attr('class', 'ax').attr('x', hx).attr('y', HH - 5).attr('text-anchor', 'middle').text((v) => v);
  wts.forEach((w, i) => {
    const ys = Array.from(new Set(all.filter((r) => r.w === w).map((r) => r.year))).sort((a, b) => a - b);
    hs.append('text').attr('class', 'ax').attr('x', hl - 6).attr('y', i * rh + 11).attr('text-anchor', 'end').text(w === 'UNL' ? 'Unl.' : w);
    const runs = []; let s = ys[0], p = ys[0];
    ys.slice(1).concat([null]).forEach((y) => { if (y === p + 1) p = y; else { runs.push([s, p]); s = y; p = y; } });
    runs.forEach(([a, b]) => { const r = hs.append('rect').attr('x', hx(a)).attr('y', i * rh + 3).attr('width', Math.max(2, hx(b + 1) - hx(a) - 1)).attr('height', rh - 5).attr('fill', STEEL); bindTip(r, () => tipHTML(wLabel(w), `${a}${b > a ? '–' + b : ''}`, plural(all.filter((q) => q.w === w && q.year >= a && q.year <= b).length, 'champion'))); });
  });
};

/* ---------------- Records ---------------- */
VIEWS.records = function () {
  const all = SC();
  const isAAA = state.cls === 'AAA';
  const seasons = d3.rollups(all, (v) => v, (r) => r.sch, (r) => r.year).flatMap(([s, ys]) => ys.map(([year, v]) => ({ school: s, year, n: v.length, names: v.sort((a, b) => a.wn - b.wn).map((r) => r.w + ' ' + r.name).join(', '), d: v[0].d }))).filter((o) => o.n >= 3).sort((a, b) => b.n - a.n || b.year - a.year);
  const streaks = Array.from(d3.rollup(all, (v) => v, (r) => r.sch)).filter(([, v]) => v.length >= 4).map(([s, v]) => { const ys = Array.from(new Set(v.map((r) => r.year))).sort((a, b) => a - b); let best = { n: 0 }, cur = { n: 0 }; ys.forEach((y, i) => { cur = i && y === ys[i - 1] + 1 ? { n: cur.n + 1, from: cur.from, to: y } : { n: 1, from: y, to: y }; if (cur.n > best.n) best = cur; }); return { school: s, d: v[0].d, ...best }; }).sort((a, b) => b.n - a.n || b.to - a.to).slice(0, 12);
  const W = wrestlersOf(all);
  const [y0, y1] = yearsOf(all);
  const decs = d3.range(decadeOf(y0), y1 + 1, 10);
  const hasM = HAS_MEDALS;
  const MED = hasM ? SM() : [];
  const FIN = hasM ? FINALS.filter((f) => f.cls === state.cls) : [];
  $view.innerHTML = `<header class="page-head"><h1>Records</h1><p class="lede">The marks that stand out in ${clsName()}: dynasties and runs, the great individual careers, rivalries between districts, and how the sport has changed.</p>
    <nav class="jump" aria-label="On this page"><a href="#r-programs" data-jump><span>Programs</span></a>${hasM ? '<a href="#r-medals" data-jump><span>Medals</span></a><a href="#r-finals" data-jump><span>Finals</span></a><a href="#r-shape" data-jump><span>Risers and depth</span></a>' : ''}<a href="#r-wrestlers" data-jump><span>Wrestlers</span></a><a href="#r-rivals" data-jump><span>Rivalries</span></a><a href="#r-trends" data-jump><span>Trends</span></a></nav></header>
    <section class="sec">${tab('Programs', '', 'r-programs')}
      ${isAAA ? `<div class="panel"><h3>AAA team champions, season by season</h3><p class="sub">Team points title at the individual state tournament, since 1976, and the PIAA AAA state duals, since 1999. Each logo is the winner; hover or tap for the runner-up.</p><div class="chart" data-c="t-strip"></div></div>` : ''}
      <div class="two">${panel('t-streak', 'Longest runs with a state champion', `Consecutive seasons with at least one ${clsName()} champion.`)}${isAAA ? `<section class="panel"><h3>Most AAA team titles</h3><p class="sub">Team points titles plus state duals titles.</p><div data-c="t-lead"></div></section>` : `<section class="panel"><h3>Team titles</h3><p class="sub">Team title history was collected for Class AAA only. <button class="linkish" type="button" data-setcls="AAA">Switch to Class AAA</button> to see it.</p></section>`}</div>
      <div class="panel"><h3>Biggest single seasons</h3><p class="sub">Schools with three or more ${clsName()} champions at one tournament.</p><div data-c="t-best"></div></div>
      <div class="panel"><h3>Programs of each decade</h3><p class="sub">The three schools with the most ${clsName()} titles in each decade.</p><div class="decades" id="t-dec"></div></div>
    </section>
    ${hasM ? `<section class="sec">${tab('Medals', `Every ${clsName()} state place winner, ${d3.min(MED, (r) => r.year)}–${d3.max(MED, (r) => r.year)}: finalists only before 1973, four places through 1980, six through 1998, eight since 1999.`, 'r-medals')}
      <div class="two">${panel('md-d', 'Medals by district', 'Every place counts one; the brighter part is titles.')}<section class="panel"><h3>Most medals, by school</h3><p class="sub">Titles are a subset of medals.</p><div data-c="md-s"></div></section></div>
      <div class="two"><section class="panel"><h3>Four-time medalists</h3><p class="sub">Wrestlers who placed in all four seasons they could.</p><div data-c="md-4"></div></section><section class="panel"><h3>Biggest medal hauls</h3><p class="sub">Most medals by one school at one tournament.</p><div data-c="md-haul"></div></section></div>
    </section>` : ''}
    ${hasM ? `<section class="sec">${tab('Finals', `Every ${clsName()} state final is a known matchup: the champion beat the runner-up at that weight. ${fmt(FIN.length)} finals on record.`, 'r-finals')}
      <div class="two"><section class="panel"><h3>Finals records</h3><p class="sub">Wins and losses in state finals, schools with ten or more.</p><div data-c="fn-s"></div></section><section class="panel"><h3>Finals rivalries</h3><p class="sub">Pairs of schools that met most often in a final, and who won.</p><div data-c="fn-r"></div></section></div>
    </section>
    <section class="sec">${tab('Risers and depth', 'How programs are moving, and how they score.', 'r-shape')}
      <div class="two">${panel('sh-rise', 'Risers and fallers', 'Change in era score, last ten seasons against the ten before.')}${panel('sh-depth', 'Depth or stars', 'Each dot is a program with 20 or more medals. Across: medals per season it placed. Up: share of its medals that were titles. Size: points.')}</div>
      <div class="panel"><h3>Career arcs</h3><p class="sub">Wrestlers with three or more medals, by how far they climbed from their first place to their best.</p><div data-c="sh-arc"></div></div>
    </section>` : ''}
    <section class="sec">${tab('Wrestlers', '', 'r-wrestlers')}
      <div class="panel"><h3>Three- and four-time champions</h3><p class="sub">${clsName()} titles, grouped by name and district.</p><div data-c="greats"></div></div>
      <div class="two"><section class="panel"><h3>The climbers</h3><p class="sub">Multi-time champions who moved up the most between first and last title.</p><div data-c="climb"></div></section><section class="panel"><h3>Wrestling families</h3><p class="sub">Shared surnames at one school with two or more champions and three or more titles, any class. A strong hint, not proof, of family.</p><div data-c="fam"></div></section></div>
      <div class="panel"><h3>Champions in both classes</h3><p class="sub">Wrestlers who won titles in Class AA and Class AAA, usually after their school changed classes.</p><div data-c="both"></div></div>
    </section>
    <section class="sec">${tab('Rivalries', '', 'r-rivals')}
      <div class="panel"><h3>Season series</h3><p class="sub">Each season, the district with more ${clsName()} champions wins the season. Pick any two.</p><div class="controls"><label class="sel">District <select id="riv-a"></select></label><span class="vs">vs.</span><label class="sel">District <select id="riv-b"></select></label></div><div id="riv-score"></div><div class="chart" data-c="riv"></div></div>
    </section>
    <section class="sec">${tab('Trends', '', 'r-trends')}
      <div class="two">${panel('parity', 'How many schools win titles', `Distinct schools with a ${clsName()} champion each decade. First and last decades are partial.`)}${panel('conc', 'How concentrated the titles are', 'Share of each decade’s titles won by that decade’s five best schools.')}</div>
      <div class="two">${panel('defend', 'How often champions defend', 'Share of champions who won again the next season.')}${panel('fresh', 'New schools breaking through', 'Schools winning their first-ever title, by decade.')}</div>
    </section>`;
  $view.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  if (isAAA) {
    const h = host('t-strip'); const Wd = widthOf(h), years = d3.range(1976, ALL_YEARS[1] + 1);
    const narrow = Wd < 700;
    // wide: two rows across the years. narrow: a grid of logo tiles per decade
    const cell = narrow ? Math.floor((Wd - 60) / 10) : Math.min(30, (Wd - 90) / years.length);
    const svg = svgIn(h, Wd, 10, 'AAA team champions by season');
    const draw = (t, lab, rowI) => {
      const list = TEAMS.filter((q) => q.type === t).sort((p, q) => p.year - q.year);
      if (!narrow) {
        const x = d3.scaleBand(years, [86, Wd - 4]).paddingInner(0.12); const y0 = rowI * 40;
        svg.append('text').attr('class', 'lab').attr('x', 0).attr('y', y0 + 22).text(lab);
        d3.groups(list, (q) => q.year).forEach(([yr, rs]) => rs.forEach((r, j) => { const hh = 32 / rs.length, sz = Math.min(x.bandwidth(), hh - 2);
          const im = svg.append('image').attr('href', LG.url(canon(r.school))).attr('x', x(yr) + (x.bandwidth() - sz) / 2).attr('y', y0 + 4 + j * hh + (hh - sz) / 2).attr('width', sz).attr('height', sz).style('cursor', 'pointer');
          bindTip(im, () => tipHTML(`${yr}, ${lab}${r.tie ? ' (tie)' : ''}`, r.school, `District ${r.d}${r.runner ? '. Runner-up ' + esc(r.runner) : ''}`, r.school)); im.on('click', () => { location.hash = schoolHref(r.school); }); }));
        if (rowI === 1) svg.append('g').selectAll('text').data(years.filter((y) => y % 5 === 0)).join('text').attr('class', 'ax').attr('x', (y) => x(y) + x.bandwidth() / 2).attr('y', 2 * 40 + 14).attr('text-anchor', 'middle').text((y) => y);
        return 2 * 40 + 20;
      }
      const top = rowI === 0 ? 0 : svg.node().__h;
      svg.append('text').attr('class', 'lab').attr('x', 0).attr('y', top + 14).text(lab);
      const decs = d3.groups(list, (q) => decadeOf(q.year));
      let y = top + 24;
      decs.forEach(([dc, rs]) => {
        svg.append('text').attr('class', 'ax').attr('x', 0).attr('y', y + cell * 0.65).text(dc + 's');
        rs.forEach((r) => { const i = r.year - dc; const sz = cell - 4;
          const im = svg.append('image').attr('href', LG.url(canon(r.school))).attr('x', 44 + i * cell + 2).attr('y', y + 2).attr('width', sz).attr('height', sz);
          bindTip(im, () => tipHTML(`${r.year}, ${lab}${r.tie ? ' (tie)' : ''}`, r.school, `District ${r.d}${r.runner ? '. Runner-up ' + esc(r.runner) : ''}`, r.school)); im.on('click', () => { location.hash = schoolHref(r.school); }); });
        y += cell;
      });
      svg.node().__h = y + 14;
      return y + 14;
    };
    let H = draw('points', 'Team points', 0); H = Math.max(H, draw('duals', 'State duals', 1));
    svg.attr('viewBox', `0 0 ${Wd} ${H}`);
    const tcount = d3.rollups(TEAMS, (v) => ({ pts: v.filter((t) => t.type === 'points').length, duals: v.filter((t) => t.type === 'duals').length, d: v[0].d }), (t) => t.sch).map(([s, o]) => ({ school: s, ...o, total: o.pts + o.duals }));
    sortableTable(host('t-lead'), [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'pts', label: 'Points', num: true }, { key: 'duals', label: 'Duals', num: true }, { key: 'total', label: 'Total', num: true, render: (r) => `<b class="score">${r.total}</b>` }], tcount, { sort: 'total', maxH: '400px', accent: 'total' });
  }
  if (streaks.length) barList(host('t-streak'), streaks.map((s) => ({ label: s.school, school: s.school, segs: [{ v: s.n, color: STEEL }], valueLabel: `${s.n} seasons (${s.from}–${s.to})` })), { badge: true, label: 'Longest runs', href: (r) => schoolHref(r.school) });
  sortableTable(host('t-best'), [{ key: 'year', label: 'Season', num: true }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'n', label: 'Champions', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'names', label: 'Weight and name' }], seasons, { sort: 'n', maxH: '400px', accent: 'n', empty: 'No school has had three champions in one season in this class.' });
  $view.querySelector('#t-dec').innerHTML = decs.map((dc) => { const rs = all.filter((r) => decadeOf(r.year) === dc); if (!rs.length) return ''; const top = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 3); return `<div class="decade"><div class="dec-head"><b>${dc}s</b><span>${rs.length} titles</span></div>${top.map(([s, n], i) => `<a class="dec-row${i ? '' : ' first'}" href="${schoolHref(s)}"><span class="pl">${i + 1}</span>${badge(s, i ? 24 : 30)}<span class="nm">${esc(s)}</span><b>${n}</b></a>`).join('')}</div>`; }).join('');
  sortableTable(host('greats'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'n', label: 'Titles', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'years', label: 'Seasons' }, { key: 'weights', label: 'Weights' }],
    W.filter((w) => w.n >= 3).map((w) => ({ name: w.name, school: w.school, d: w.d, n: w.n, years: w.rows.map((r) => r.year).join(', '), weights: w.rows.map((r) => r.w).join(', ') })), { sort: 'n', maxH: '440px', accent: 'n', empty: 'No three-time champions in this class.' });
  const climbs = W.filter((w) => w.n >= 2).map((w) => { const ws = w.rows.filter((r) => r.w !== 'UNL'); if (ws.length < 2) return null; const a0 = ws[0], a1 = ws[ws.length - 1]; return { name: w.name, school: w.school, from: +a0.w, to: +a1.w, gain: +a1.w - +a0.w, years: `${a0.year}–${a1.year}` }; }).filter(Boolean).sort((a, b) => b.gain - a.gain);
  sortableTable(host('climb'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'from', label: 'First', num: true }, { key: 'to', label: 'Last', num: true }, { key: 'gain', label: 'Climb', num: true, render: (r) => `<b class="score">+${r.gain}</b>` }], climbs.slice(0, 40), { sort: 'gain', maxH: '400px', accent: 'gain' });
  const surname = (n) => { const p = String(n).replace(/\(.*?\)/g, '').replace(/\b(jr|sr|ii|iii|iv)\.?$/i, '').trim().split(/\s+/); return p[p.length - 1]; };
  const fams = d3.groups(CH, (r) => surname(r.name).toLowerCase() + '|' + r.sch).map(([, rs]) => ({ fam: surname(rs[0].name), school: rs[0].sch, people: Array.from(new Set(rs.map((r) => r.name))), n: rs.length, from: d3.min(rs, (r) => r.year), to: d3.max(rs, (r) => r.year) })).filter((f) => f.people.length >= 2 && f.n >= 3);
  sortableTable(host('fam'), [{ key: 'fam', label: 'Family' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'n', label: 'Titles', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'people', label: 'Champions', render: (r) => esc(r.people.map((p) => p.split(' ')[0]).join(', ')) }, { key: 'from', label: 'Span', num: true, render: (r) => `${r.from}–${r.to}` }], fams, { sort: 'n', maxH: '400px', accent: 'n' });
  const both = d3.groups(CH.filter((r) => r.cls !== 'single'), (r) => nkey(r.name) + '|' + r.sch).filter(([, rs]) => new Set(rs.map((r) => r.cls)).size === 2).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); return { name: rs[0].name, school: rs[0].sch, d: rs[0].d, path: rs.map((r) => `${r.year} ${r.cls} ${r.w}`).join(', then ') }; });
  sortableTable(host('both'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'path', label: 'Titles' }], both, { sort: 'name', dir: 1, maxH: '340px', empty: 'None on record.' });
  if (hasM) {
    const byD = d3.range(1, 13).map((d) => { const rs = MED.filter((r) => r.d === d); return { d, label: `District ${d}`, segs: [{ v: rs.filter((r) => r.place === 1).length, color: dColor(d) }, { v: rs.filter((r) => r.place > 1).length, color: dColor(d), opacity: 0.4 }], n: rs.length }; }).filter((o) => o.n).sort((p, q) => q.n - p.n);
    barList(host('md-d'), byD, { label: 'Medals by district', tip: (r) => tipHTML(DISTRICTS[r.d], `District ${r.d}: ${plural(r.n, 'medal')}`, `${r.segs[0].v} titles`), href: (r) => '#district-' + r.d });
    const bySch = Array.from(d3.rollup(MED, (v) => ({ n: v.length, t: v.filter((r) => r.place === 1).length, f: v.filter((r) => r.place <= 2).length, d: v[0].d }), (r) => r.sch)).map(([school, o]) => ({ school, ...o }));
    sortableTable(host('md-s'), [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'n', label: 'Medals', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'f', label: 'Finals', num: true }, { key: 't', label: 'Titles', num: true }], bySch, { sort: 'n', maxH: '420px', accent: 'n' });
    const WM = wrestlersOf(MED).filter((w) => w.n >= 4).map((w) => ({ name: w.name, school: w.school, d: w.d, n: w.n, titles: w.titles, places: w.rows.map((r) => ordinal(r.place)).join(', '), years: `${w.rows[0].year}–${w.rows[w.rows.length - 1].year}` }));
    sortableTable(host('md-4'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'titles', label: 'Titles', num: true, render: (r) => `<b class="score">${r.titles}</b>` }, { key: 'places', label: 'Places, first to last' }, { key: 'years', label: 'Seasons' }], WM, { sort: 'titles', maxH: '420px', accent: 'titles', empty: 'None on record.' });
    const hauls = d3.rollups(MED, (v) => v, (r) => r.sch, (r) => r.year).flatMap(([sc, ys]) => ys.map(([year, v]) => ({ school: sc, year, n: v.length, t: v.filter((r) => r.place === 1).length, d: v[0].d }))).sort((p, q) => q.n - p.n || q.t - p.t).slice(0, 25);
    sortableTable(host('md-haul'), [{ key: 'year', label: 'Season', num: true }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'n', label: 'Medals', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 't', label: 'Titles', num: true }], hauls, { sort: 'n', maxH: '420px', accent: 'n' });
  }
  if (hasM) {
    // finals
    const rec = new Map();
    const add = (sc, w) => { const o = rec.get(sc) || { school: sc, w: 0, l: 0, d: null }; if (w) o.w++; else o.l++; rec.set(sc, o); };
    FIN.forEach((f) => { add(f.win.sch, 1); add(f.lose.sch, 0); rec.get(f.win.sch).d = f.win.d; rec.get(f.lose.sch).d = f.lose.d; });
    const fr = Array.from(rec.values()).map((o) => ({ ...o, n: o.w + o.l, pct: o.w / (o.w + o.l) })).filter((o) => o.n >= 10);
    sortableTable(host('fn-s'), [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'w', label: 'W', num: true }, { key: 'l', label: 'L', num: true }, { key: 'pct', label: 'Win %', num: true, render: (r) => `<b class="score">${pct0(r.pct)}</b>` }], fr, { sort: 'pct', maxH: '420px', accent: 'pct' });
    const pairs = new Map();
    FIN.forEach((f) => { const k = [f.win.sch, f.lose.sch].sort().join('|'); const o = pairs.get(k) || { a: k.split('|')[0], b: k.split('|')[1], n: 0, aw: 0, last: 0 }; o.n++; if (f.win.sch === o.a) o.aw++; o.last = Math.max(o.last, f.year); pairs.set(k, o); });
    const pr = Array.from(pairs.values()).filter((o) => o.n >= 3).sort((p, q) => q.n - p.n).map((o) => ({ pair: `${o.a} vs ${o.b}`, a: o.a, b: o.b, n: o.n, record: `${o.aw}–${o.n - o.aw}`, last: o.last }));
    sortableTable(host('fn-r'), [{ key: 'pair', label: 'Matchup', render: (r) => `${whoLink(r.a, 18)} <span class="vs">vs</span> ${whoLink(r.b, 18)}` }, { key: 'n', label: 'Finals', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'record', label: 'Record (first school)' }, { key: 'last', label: 'Last', num: true }], pr, { sort: 'n', maxH: '420px', accent: 'n', empty: 'No pair has met three times.' });
    // risers and fallers
    const RK = rankings('school').filter((o) => o.seasons.some((x) => x.year > LAST_SEASON - 20));
    const up = RK.slice().sort((p, q) => q.trend - p.trend).slice(0, 8), down = RK.slice().sort((p, q) => p.trend - q.trend).slice(0, 8);
    barList(host('sh-rise'), up.map((o) => ({ label: o.u.name, school: o.u.name, segs: [{ v: o.trend * 100, color: '#43c37a' }], valueLabel: `+${Math.round(o.trend * 100)}` })).concat(down.map((o) => ({ label: o.u.name, school: o.u.name, segs: [{ v: -o.trend * 100, color: '#ef5350' }], valueLabel: `−${Math.round(-o.trend * 100)}` }))), { badge: true, label: 'Risers and fallers', href: (r) => schoolHref(r.school), tip: (r) => tipHTML('Era score, last 10 seasons vs the 10 before', r.label, r.valueLabel, r.school) });
    // depth or stars
    const h = host('sh-depth'); const Wd = widthOf(h), H = 300, left = 40, right = 90, top = 16, bottom = 30;
    const pts = RK.filter((o) => o.medals >= 20).map((o) => ({ o, x: o.medals / o.n, y: o.titles / o.medals, s: o.pts }));
    const x = d3.scaleLinear([0, d3.max(pts, (p) => p.x) * 1.05], [left, Wd - right]), y = d3.scaleLinear([0, Math.max(0.4, d3.max(pts, (p) => p.y) * 1.05)], [H - bottom, top]), r = d3.scaleSqrt([0, d3.max(pts, (p) => p.s)], [3, 16]);
    const svg = svgIn(h, Wd, H, 'Depth or stars');
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('class', 'grid').attr('x1', left).attr('x2', Wd - right).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('class', 'ax').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(pct0);
    svg.append('g').selectAll('text.x').data(x.ticks(5)).join('text').attr('class', 'ax').attr('x', x).attr('y', H - 8).attr('text-anchor', 'middle').text((v) => v);
    svg.append('text').attr('class', 'ax').attr('x', Wd - right).attr('y', H - 8).attr('text-anchor', 'end').text('medals per season →');
    svg.append('text').attr('class', 'ax').attr('transform', `translate(${left - 30},${top}) rotate(-90)`).attr('text-anchor', 'end').text('titles per medal →');
    const dots = svg.append('g').selectAll('circle').data(pts.sort((p, q) => q.s - p.s)).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => r(p.s)).attr('fill', (p) => sColor(p.o.u.name)).attr('fill-opacity', 0.75).attr('stroke', '#141516').style('cursor', 'pointer');
    bindTip(dots, (p) => tipHTML(`${p.o.medals} medals in ${p.o.n} seasons`, p.o.u.name, `${p.x.toFixed(1)} medals per season placed, ${pct0(p.y)} of them titles, ${fmt(p.o.pts)} points`, p.o.u.name));
    dots.on('click', (ev, p) => { location.hash = schoolHref(p.o.u.name); });
    const lab = pts.slice(0, 7).sort((a, b) => y(a.y) - y(b.y)); lab.forEach((p, i) => { p.ly = i ? Math.max(y(p.y), lab[i - 1].ly + 12) : y(p.y); });
    svg.append('g').selectAll('text.l').data(lab).join('text').attr('class', 'ax').attr('x', (p) => x(p.x) + r(p.s) + 3).attr('y', (p) => p.ly + 4).style('fill', 'var(--chalk-2)').text((p) => p.o.u.name);
    // career arcs
    const arcs = wrestlersOf(MED).filter((w) => w.n >= 3).map((w) => { const first = w.rows[0].place, best = w.best; return { name: w.name, school: w.school, d: w.d, n: w.n, climb: first - best, path: w.rows.map((q) => ordinal(q.place)).join(' → '), years: `${w.rows[0].year}–${w.rows[w.rows.length - 1].year}` }; }).sort((p, q) => q.climb - p.climb || q.n - p.n);
    sortableTable(host('sh-arc'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'climb', label: 'Climb', num: true, render: (r) => `<b class="score">${r.climb > 0 ? '+' + r.climb : r.climb}</b>` }, { key: 'path', label: 'Places, first to last' }, { key: 'years', label: 'Seasons' }], arcs.slice(0, 80), { sort: 'climb', maxH: '440px', accent: 'climb' });
  }
  // rivalry
  const dRank = Array.from(d3.rollup(all, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  if (!state.rivA || !dRank.includes(state.rivA)) state.rivA = dRank.includes(11) ? 11 : dRank[0];
  if (!state.rivB || !dRank.includes(state.rivB) || state.rivB === state.rivA) state.rivB = dRank.find((d) => d !== state.rivA);
  const sa = $view.querySelector('#riv-a'), sb = $view.querySelector('#riv-b');
  [sa, sb].forEach((s) => { s.innerHTML = dRank.map((d) => `<option value="${d}">${d}</option>`).join(''); });
  sa.value = state.rivA; sb.value = state.rivB;
  const drawRiv = () => {
    const A = state.rivA, B = state.rivB, years = d3.range(y0, y1 + 1);
    const ca = d3.rollup(all.filter((r) => r.d === A), (v) => v.length, (r) => r.year), cb = d3.rollup(all.filter((r) => r.d === B), (v) => v.length, (r) => r.year);
    let w = 0, l = 0, t = 0, streak = { who: null, n: 0 }, best = { who: null, n: 0, end: null };
    years.forEach((y) => { const x = (ca.get(y) || 0) - (cb.get(y) || 0); const who = x > 0 ? A : x < 0 ? B : null; if (x > 0) w++; else if (x < 0) l++; else t++; if (who && who === streak.who) streak.n++; else streak = { who, n: who ? 1 : 0 }; if (streak.n > best.n) best = { ...streak, end: y }; });
    $view.querySelector('#riv-score').innerHTML = `<div class="scorebug"><div class="sb-side" style="--c:#ecebe6"><span class="sb-name">District ${A}</span><span class="sb-num">${w}</span></div><div class="sb-mid"><span>${t} even</span><span>${y0}–${y1}</span></div><div class="sb-side right" style="--c:#8d949c"><span class="sb-num">${l}</span><span class="sb-name">District ${B}</span></div></div><p class="sub">Longest run: District ${best.who} won ${best.n} straight seasons, ending ${best.end}. Titles overall: District ${A} ${d3.sum(ca.values())}, District ${B} ${d3.sum(cb.values())}.</p>`;
    const h = host('riv'); h.innerHTML = '';
    const Wd = widthOf(h), H = 200, left = 22, top = 10, bottom = 22;
    const x = d3.scaleBand(years, [left, Wd - 4]).paddingInner(0.2);
    const mx = d3.max(years, (y) => Math.max(ca.get(y) || 0, cb.get(y) || 0)) || 1;
    const y = d3.scaleLinear([-mx, mx], [H - bottom, top]);
    const svg = svgIn(h, Wd, H, 'Season series');
    svg.append('line').attr('x1', left).attr('x2', Wd - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', STEEL);
    years.forEach((yr) => { const va = ca.get(yr) || 0, vb = cb.get(yr) || 0, win = va > vb ? 'a' : vb > va ? 'b' : null;
      if (va) svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(va)).attr('height', y(0) - y(va) - 1).attr('fill', CHALK).attr('opacity', win === 'a' ? 1 : 0.25);
      if (vb) svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(0) + 1).attr('height', y(-vb) - y(0) - 1).attr('fill', STEEL).attr('opacity', win === 'b' ? 1 : 0.3); });
    bindTip(svg.append('g').selectAll('rect').data(years).join('rect').attr('class', 'hit').attr('x', (v) => x(v)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), (yr) => tipHTML(String(yr), `District ${A} ${ca.get(yr) || 0}, District ${B} ${cb.get(yr) || 0}`, (ca.get(yr) || 0) === (cb.get(yr) || 0) ? 'Even' : `District ${(ca.get(yr) || 0) > (cb.get(yr) || 0) ? A : B} wins the season`));
    svg.append('g').selectAll('text').data(years.filter((v) => v % 5 === 0)).join('text').attr('class', 'ax').attr('x', (v) => x(v) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((v) => v);
  };
  sa.addEventListener('change', () => { state.rivA = +sa.value; if (state.rivA === state.rivB) { state.rivB = dRank.find((d) => d !== state.rivA); sb.value = state.rivB; } drawRiv(); });
  sb.addEventListener('change', () => { state.rivB = +sb.value; if (state.rivA === state.rivB) { state.rivA = dRank.find((d) => d !== state.rivB); sa.value = state.rivA; } drawRiv(); });
  drawRiv();
  // trends
  const cols = (h, data, opts) => {
    const Wd = widthOf(h), H = 190, left = 30, top = 18, bottom = 22;
    const x = d3.scaleBand(data.map((d) => d.k), [left, Wd - 4]).paddingInner(0.28);
    const y = d3.scaleLinear([0, opts.max || d3.max(data, (d) => d.v) || 1], [H - bottom, top]).nice();
    const svg = svgIn(h, Wd, H, opts.label);
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('class', 'grid').attr('x1', left).attr('x2', Wd - 4).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('class', 'ax').attr('x', left - 5).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(opts.fmt || ((v) => v));
    const g = svg.selectAll('g.c').data(data).join('g').attr('class', 'c');
    g.append('rect').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', (d) => y(d.v)).attr('height', (d) => y(0) - y(d.v)).attr('fill', STEEL);
    g.append('text').attr('class', 'val').attr('x', (d) => x(d.k) + x.bandwidth() / 2).attr('y', (d) => y(d.v) - 5).attr('text-anchor', 'middle').text((d) => d.label);
    g.append('text').attr('class', 'ax').attr('x', (d) => x(d.k) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((d) => d.k);
    if (opts.tip) bindTip(g.append('rect').attr('class', 'hit').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), opts.tip);
  };
  cols(host('parity'), decs.map((dc) => { const n = new Set(all.filter((r) => decadeOf(r.year) === dc).map((r) => r.sch)).size; return { k: dc + 's', v: n, label: String(n) }; }), { label: 'Schools with a champion by decade' });
  cols(host('conc'), decs.map((dc) => { const rs = all.filter((r) => decadeOf(r.year) === dc); const top = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 5); const v = rs.length ? d3.sum(top, (t) => t[1]) / rs.length : 0; return { k: dc + 's', v, label: pct0(v), top }; }), { max: 1, fmt: pct0, label: 'Concentration by decade', tip: (o) => tipHTML(o.k, pct1(o.v) + ' to the top five', o.top.map((t) => esc(t[0]) + ' ' + t[1]).join('<br>')) });
  const key = (r) => nkey(r.name) + '|' + r.sch; const byYear = d3.group(all, (r) => r.year);
  cols(host('defend'), decs.map((dc) => { const rs = all.filter((r) => decadeOf(r.year) === dc && r.year < y1); const nx = rs.filter((r) => (byYear.get(r.year + 1) || []).some((q) => key(q) === key(r))); return { k: dc + 's', v: rs.length ? nx.length / rs.length : 0, label: rs.length ? pct0(nx.length / rs.length) : '', n: rs.length, m: nx.length }; }).filter((o) => o.n), { max: 0.6, fmt: pct0, label: 'Defense rate', tip: (o) => tipHTML(o.k, pct1(o.v) + ' defended', `${o.m} of ${o.n} champions won again the next season`) });
  const firsts = Array.from(d3.rollup(all, (v) => d3.min(v, (r) => r.year), (r) => r.sch));
  cols(host('fresh'), decs.map((dc) => { const l = firsts.filter(([, y]) => decadeOf(y) === dc).map(([s]) => s); return { k: dc + 's', v: l.length, label: String(l.length), l }; }), { label: 'First-time champion schools', tip: (o) => tipHTML(o.k, `${o.v} first-time champion schools`, o.l.slice(0, 12).map(esc).join('<br>') + (o.l.length > 12 ? '<br>…' : '')) });
};

/* ---------------- Sources ---------------- */
VIEWS.about = function () {
  $view.innerHTML = `<header class="page-head"><h1>Sources</h1></header><div class="prose wide">
  <p>State champions (${fmt(CH.length)} on record, ${ALL_YEARS[0]}–${ALL_YEARS[1]}), Class AAA results by district and AAA team titles come from PA-Wrestling.com’s PIAA championship history. Per-district totals were checked against the site’s medal table.</p>
  <p><b>Classes are kept apart.</b> Class AAA (larger schools) and Class AA (smaller schools) have crowned separate champions since 1974, so every count covers one class at a time. Before 1974 all schools wrestled in one class; those titles have their own view, and the “Add 1938–73 titles” switch attaches them to AAA or AA by the class each school wrestled in after the split.</p>
  <p><b>The mat.</b> Every champion is placed by season and by spot in that season’s lineup, lightest at the center. The lineup spot is a rank, so the rings line up across eras even though the weight classes changed.</p>
  <p><b>Weights</b> appear two ways: actual pounds, and fifths of each season’s lineup (lightest fifth to heaviest), which compares eras fairly. The gray shape on unit pages is the whole state’s distribution, scaled to the unit’s count.</p>
  <p><b>District 11</b> also has its complete AAA district tournament history (${fmt(D11.length)} champions) and the Northeast AAA Regional champions.</p>
  <p><b>Medals and rankings.</b> State medalists (places 1–8, or as many as were awarded that season) come from PA-Wrestling.com’s results sheets for every class since 1938; every first place was checked against the champion list. Each medal earns placement points: 16, 12, 9, 7, 5, 3, 2, 1 for first through eighth. <b>Era score</b> is a school’s share of all points available in each season it scored, summed and multiplied by 100, so a title in a twelve-weight 1950s bracket counts the same as one in today’s thirteen-weight, eight-place bracket. <b>Current power</b> is the same share with a seven-season half-life, roughly one roster generation: a point from seven seasons ago is worth half a point now. <b>Trend</b> compares the last ten seasons’ share to the ten before. Districts are rated with the same five numbers.</p>
  <p><b>Limitation.</b> These are placement points only. PIAA team scores also award advancement and bonus points, which the results sheets do not record, so each season’s team race here is a reconstruction. Checked against the real Class AAA team champions since 1974, placement points name the same champion in 47 of 53 seasons. 1975 medals are incomplete and the 1954 single-class sheet could not be retrieved.</p>
  <p><b>Known gaps.</b> About 22 state champions (roughly 1%) could not be retrieved; a few schools may be one title short. Four Northeast Regional titles are missing. Qualifier and team-title data are Class AAA only.</p>
  <p><b>Logos</b> are added by the almanac’s owner. Schools without one show initials in approximate school colors.</p>
  <p>Sources: <a href="https://brackets.pa-wrestling.com/post-season/state/">PA-Wrestling.com state history</a>, <a href="https://brackets.pa-wrestling.com/district-11-aaa/">District 11 AAA history</a>, <a href="https://brackets.pa-wrestling.com/region-north-east-aaa/">Northeast AAA Regional history</a>, <a href="https://www.pa-wrestling.com/hs/stateduals/">PIAA State Duals</a>.</p></div>`;
};

/* ---------------- chrome ---------------- */
const TABS = [['overview', 'State'], ['districts', 'Districts'], ['schools', 'Schools'], ['weights', 'Weights'], ['records', 'Records'], ['about', 'Sources']];
function buildNav() {
  document.getElementById('tabs').innerHTML = TABS.map(([k, l]) => `<a href="#${k}" data-k="${k}">${l}</a>`).join('') + (LG.isOwner ? '<a class="studio-link" href="#studio" data-k="studio">Logo studio</a>' : '');
  markNav();
}
function markNav() {
  const h = location.hash.slice(1) || 'overview';
  const key = /^district-/.test(h) ? 'districts' : /^school-/.test(h) ? 'schools' : h;
  document.querySelectorAll('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.k === key ? 'page' : 'false'));
}
function syncClassBar() {
  document.querySelectorAll('[data-cls]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cls === state.cls ? 'true' : 'false'));
  const era = document.getElementById('era');
  era.checked = state.withSingle; era.disabled = state.cls === 'single';
  document.getElementById('era-wrap').classList.toggle('off', state.cls === 'single');
}
function setClass(cls, withSingle) {
  if (cls) state.cls = cls;
  if (withSingle != null) state.withSingle = withSingle;
  state.focus = null; state.arKey = null;
  saveScope(); syncClassBar(); route(true);
}
document.querySelectorAll('[data-cls]').forEach((b) => b.addEventListener('click', () => setClass(b.dataset.cls)));
document.getElementById('era').addEventListener('change', (e) => setClass(null, e.target.checked));
$view.addEventListener('click', (e) => { const b = e.target.closest('[data-setcls]'); if (b) setClass(b.dataset.setcls); });

/* search */
const SEARCH = (() => {
  const items = [];
  d3.range(1, 13).forEach((d) => items.push({ type: 'District', label: `District ${d}`, sub: DISTRICTS[d], href: '#district-' + d, k: `district ${d} ${DISTRICTS[d]}`.toLowerCase(), d }));
  SCHOOLS.forEach((s) => items.push({ type: 'School', label: s.school, sub: `District ${s.d || '?'}. AAA ${s.aaa}, AA ${s.aa}${s.single ? ', 1938–73 ' + s.single : ''}`, href: '#school-' + s.slug, school: s.school, k: s.school.toLowerCase() }));
  d3.groups(CH, (r) => nkey(r.name) + '|' + r.sch).forEach(([, rs]) => { rs.sort((a, b) => a.year - b.year); const r = rs[0]; items.push({ type: rs.length > 1 ? `${rs.length}-time champion` : 'State champion', label: r.name, sub: `${r.school}: ${rs.map((q) => q.year + ' ' + (q.cls === 'single' ? '' : q.cls + ' ') + q.w).join(', ')}`, href: schoolHref(r.school), school: r.school, k: r.name.toLowerCase() }); });
  return items;
})();
const $q = document.getElementById('gsearch'), $res = document.getElementById('gresults');
let hits = [], sel = -1;
const renderHits = () => {
  if (!hits.length) { $res.hidden = $q.value.trim().length < 2; $res.innerHTML = '<div class="gempty">No district, school or champion by that name.</div>'; return; }
  $res.hidden = false;
  $res.innerHTML = hits.map((h, i) => `<a href="${h.href}" role="option" class="ghit${i === sel ? ' on' : ''}" aria-selected="${i === sel}">${h.school ? badge(h.school, 28) : `<span class="gd">${h.d}</span>`}<span><b>${esc(h.label)}</b> <span class="t">${h.type}</span><br><span class="s">${esc(h.sub)}</span></span></a>`).join('');
};
$q.addEventListener('input', () => {
  const q = $q.value.trim().toLowerCase();
  if (q.length < 2) { hits = []; $res.hidden = true; return; }
  const rank = (it) => (it.k.startsWith(q) ? 0 : 1) * 3 + (it.type === 'District' ? 0 : it.type === 'School' ? 1 : 2);
  hits = SEARCH.filter((it) => it.k.includes(q)).sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label)).slice(0, 9);
  sel = hits.length ? 0 : -1; renderHits();
});
$q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sel]) { location.hash = hits[sel].href; $q.value = ''; $res.hidden = true; $q.blur(); }
  else if (e.key === 'Escape') { $q.value = ''; $res.hidden = true; $q.blur(); }
});
$res.addEventListener('click', () => { $q.value = ''; $res.hidden = true; });
document.addEventListener('click', (e) => { if (!e.target.closest('.gsearch')) $res.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $q.focus(); } });

/* router */
function route(keepScroll) {
  const h = location.hash.slice(1) || 'overview';
  tip.hide();
  const y = window.scrollY;
  let m;
  if (h === 'studio') LogoStudio.render($view, { schools: SCHOOLS.map((o) => ({ school: o.school, d: o.d, titles: o.rows.length })).sort((a, b) => b.titles - a.titles) });
  else if ((m = h.match(/^district-(\d{1,2})$/)) && +m[1] >= 1 && +m[1] <= 12) unitPage(districtUnit(+m[1]));
  else if ((m = h.match(/^school-([a-z0-9-]+)$/))) { const s = SCHOOL_BY_SLUG.get(m[1]); if (s) unitPage(schoolUnit(s)); else $view.innerHTML = `<header class="page-head"><h1>School not found</h1><p class="lede">No state or District 11 champions on record for that school. <a href="#schools">See every school</a>.</p></header>`; }
  else (VIEWS[h] || VIEWS.overview)();
  markNav();
  const t = $view.querySelector('h1')?.textContent || '';
  document.title = (h === 'overview' ? '' : t + ', ') + 'PA Wrestling Almanac';
  if (keepScroll === true) window.scrollTo(0, y);
  else { document.body.classList.remove('enter'); void document.body.offsetWidth; document.body.classList.add('enter'); }
}
LG.setKey((sc) => slug(canon(sc)));
let lgTimer = null, wasOwner = false;
LG.onChange(() => {
  if (LG.isOwner !== wasOwner) { wasOwner = LG.isOwner; buildNav(); }
  if (location.hash === '#studio') return;
  clearTimeout(lgTimer); lgTimer = setTimeout(() => route(true), 120);
});
LG.init();
syncClassBar();
buildNav();
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
let lastW = 0, rt = null;
new ResizeObserver(() => { const w = Math.round($view.getBoundingClientRect().width); if (Math.abs(w - lastW) > 24) { lastW = w; clearTimeout(rt); rt = setTimeout(() => route(true), 160); } }).observe($view);
route();
lastW = Math.round($view.getBoundingClientRect().width);
