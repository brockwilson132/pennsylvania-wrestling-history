/* Pages and router. */
'use strict';
const VIEWS = {};
const shelf4 = (c) => shelf(c, { size: 15, compact: true, zeros: true });
const DEFS = `<dl class="defs"><div><dt>Era score</dt><dd>All-time. A program’s share of the points available each season, added up across every season, times 100. Fair across eras.</dd></div><div><dt>Power</dt><dd>Now. The same, but a season seven years back counts half, about one roster generation.</dd></div><div><dt>Trend</dt><dd>Era score from the last ten seasons, against the ten before.</dd></div></dl>`;
const unitName = (u) => (u.kind === 'district' ? `District ${u.d}` : u.name);
const unitLink = (u, size) => (u.kind === 'district' ? distLink(u.d, { mapW: 30 }) : schoolLink(u.name, size || 20));

/* ================= Home ================= */
VIEWS.home = function () {
  const [a, b] = yearsInScope();
  const rows = ROWS();
  const progs = rankings('school'), dists = rankings('district');
  const mode = state.homeRank === 'era' ? 'era' : 'power';
  const score = (o) => (mode === 'era' ? o.allTime : o.now);
  const dBy = new Map(dists.map((o) => [o.u.d, o]));
  const dRank = dists.slice().sort((p, q) => score(q) - score(p));
  if (!state.dsel || !dBy.has(state.dsel)) state.dsel = dRank[0].u.d;
  const top = progs.slice().sort((p, q) => q.now - p.now).slice(0, 10);
  const seasons = seasonsInScope();
  const wins = d3.rollups(seasons, (v) => v.length, (S) => S.teams[0].id).sort((p, q) => q[1] - p[1]);
  const Wall = wrestlersOf(rows), W4 = Wall.filter((w) => w.n >= 4), W3 = Wall.filter((w) => w.titles === 3), W4c = Wall.filter((w) => w.titles >= 4);
  const decades = d3.range(Math.floor(a / 10) * 10, b + 1, 10);
  const decTot = d3.rollup(rows, (v) => d3.sum(v, (r) => r.pts), (r) => Math.floor(r.year / 10) * 10);
  const decD = dists.filter((o) => o.pts / d3.sum(dists, (x) => x.pts) > 0.02).map((o) => ({ d: o.u.d, by: d3.rollup(o.rows, (v) => d3.sum(v, (r) => r.pts), (r) => Math.floor(r.year / 10) * 10) })).map((o) => ({ d: o.d, by: new Map(decades.map((dc) => [dc, (o.by.get(dc) || 0) / (decTot.get(dc) || 1)])) }));
  const decMax = d3.max(decD, (o) => d3.max(Array.from(o.by.values()))) || 1;
  $view.innerHTML = `
  <header class="hero"><h1>Pennsylvania state wrestling</h1><p class="lede">${fmt(rows.length)} state medals in ${clsName()}, ${a}–${b}.</p></header>

  <section class="sec">${sec('Where the strength is', 'Each district shaded by its score. Tap one.')}
    ${seg('hr', [['power', 'Power: now'], ['era', 'Era: all-time']], mode)}
    <div class="statemap"><div class="map-host" data-c="pamap"></div><aside class="dcard" id="dcard"></aside></div>
  </section>

  <section class="sec">${sec('Programs on top now', 'Ranked by power.', null, '<a class="more" href="#rankings">All rankings</a>')}
    <div class="panel tight"><table class="rank home-top"><thead><tr><th class="n">#</th><th>Program</th><th class="n">Power</th><th class="n">Trend</th><th class="hide-m">Medals, last 7 seasons</th></tr></thead><tbody>${top.map((o, i) => `<tr><td class="n rk">${i + 1}</td><td class="nm"><span class="nmw">${schoolLink(o.u.name)}${o.u.d ? dtag(o.u.d) : ''}</span></td><td class="n"><b>${scoreFmt(o.now)}</b></td><td class="n">${trendTxt(o.trend)}</td><td class="hide-m">${shelf(o.recent, { size: 15, compact: true })}</td></tr>`).join('')}</tbody></table></div>
  </section>

  <section class="sec">${sec('All-time teams', 'An all-star lineup from every season: at each weight, the wrestlers with the most points there, each placed once at his best weight. Programs and Districts show who has taken the biggest share of each weight’s points.', null, '<a class="more" href="#weights">Weights</a>')}
    <div data-c="teams"></div>
  </section>

  <section class="sec">${sec('The state in numbers', '')}
    <dl class="tiles">
      <div><dd>${fmt(seasons.length)}</dd><dt>Seasons</dt><span>${a}–${b}</span></div>
      <div><dd>${fmt(progs.length)}</dd><dt>Programs with a medal</dt><span>${fmt(progs.filter((o) => o.titles).length)} with a title</span></div>
      <div><dd>${pct0(d3.sum(progs.slice(0, 10), (o) => o.pts) / d3.sum(progs, (o) => o.pts))}</dd><dt>Points held by the top ten programs</dt><span>of ${fmt(d3.sum(progs, (o) => o.pts))} all-time</span></div>
      <div><dd>${fmt(W4.length)}</dd><dt>Four-time medalists</dt><span>${W3.length} three-time champions, ${W4c.length} four-time</span></div>
      <div><dd>${esc(wins[0][0])}</dd><dt>Most team races won</dt><span>${wins[0][1]} seasons first in points</span></div>
      <div><dd>${esc(DISTRICTS[dRank[0].u.d].short)}</dd><dt>Top district by ${mode === 'era' ? 'era score' : 'power'}</dt><span>District ${dRank[0].u.d}, ${pct0(dRank[0].pts / d3.sum(dists, (o) => o.pts))} of all points</span></div>
    </dl>
  </section>

  <section class="sec">${sec('Who has won the team race', `The school first in placement points each season, newest first. ${wins.slice(0, 4).map(([s, n]) => `${esc(s)} ${n}`).join(' · ')}.`, null, '<a class="more" href="#records">Records</a>')}
    <div class="winners">${seasons.slice().reverse().slice(0, 40).map((S) => `<a class="winner" href="#season/${S.year}" title="${S.year}: ${esc(S.teams[0].id)}, ${S.teams[0].pts} pts">${chip(S.teams[0].id, 26)}<b>${S.year}</b></a>`).join('')}</div>
  </section>

  <section class="sec">${sec('How the map has shifted', 'Each district’s share of the state’s points, decade by decade. The last bar is the current decade.')}
    <div class="smalls dec">${decD.map((o) => `<a class="small" href="#district/${o.d}"><div class="small-h">${distLabel(o.d, { mapW: 30 })}</div><div class="decbars">${decades.map((dc) => `<i title="${dc}s: ${pct1(o.by.get(dc) || 0)}" style="height:${((o.by.get(dc) || 0) / decMax * 100).toFixed(1)}%"></i>`).join('')}</div><div class="decax"><span>${decades[0]}s</span><span>${pct0(o.by.get(decades[decades.length - 1]) || 0)} now</span></div></a>`).join('')}</div>
  </section>`;
  teamsSection(host('teams'), rows, 'state');
  const m = stateMap(host('pamap'), Object.fromEntries(dists.map((o) => [o.u.d, score(o)])), { select: (d) => { state.dsel = d; card(); }, tipText: (d) => { const o = dBy.get(d); return o ? `${mode === 'era' ? 'Era' : 'Power'} ${scoreFmt(score(o))}, ${ordinal(dRank.indexOf(o) + 1)}` : 'no medals'; } });
  const card = () => {
    const o = dBy.get(state.dsel); m.paint(state.dsel);
    if (!o) { $view.querySelector('#dcard').innerHTML = ''; return; }
    const d = o.u.d, mine = progs.filter((p) => p.u.d === d).sort((p, q) => score(q) - score(p)).slice(0, 4);
    const ws = weightShares(o.rows, rows), hi = ws.classes.filter((c) => c.rows.length >= 3).map((c) => ({ c, r: c.share / (ws.overall || 1) })).sort((p, q) => q.r - p.r).slice(0, 3);
    $view.querySelector('#dcard').innerHTML = `<div class="dc-h">${distMap(d, 54)}<div><p class="t3">${ordinal(dRank.indexOf(o) + 1)} of ${dists.length} by ${mode === 'era' ? 'era score' : 'power'}</p><h3>District ${d} · ${esc(DISTRICTS[d].short)}</h3></div></div>
      <dl class="dc-n"><div><dd>${scoreFmt(o.allTime)}</dd><dt>Era</dt></div><div><dd>${scoreFmt(o.now)}</dd><dt>Power</dt></div><div><dd>${trendTxt(o.trend)}</dd><dt>Trend</dt></div></dl>
      <div class="dc-s">${shelf(o.places, { size: 16 })}</div>
      <p class="dc-l">Top programs</p><ol class="dc-p">${mine.map((p) => `<li>${schoolLink(p.u.name, 18)}<b>${scoreFmt(score(p))}</b></li>`).join('')}</ol>
      ${hi.length ? `<p class="dc-l">Strongest weights</p><p class="dc-w">${hi.map((x) => `<a href="#weights/${x.c.c.k}">${x.c.c.label}</a> <span class="t3">${pct0(x.c.share)}</span>`).join(' · ')}</p>` : ''}
      <a class="more" href="#district/${d}">Open District ${d}</a>`;
  };
  card();
  $view.querySelectorAll('[data-hr]').forEach((bt) => bt.addEventListener('click', () => { state.homeRank = bt.dataset.hr; state.dsel = null; render(); }));
};
/* all-time teams, as a multi-view section. scope: 'state' | 'district' | 'school' */
function teamsSection(h, rows, scope) {
  const T = allTimeTeams(rows, 3);
  const D = scope === 'state' ? weightLeaders(rows, (r) => r.d) : null;
  const P = scope !== 'school' ? weightLeaders(rows, (r) => r.sch) : null;
  const views = [['w', 'Wrestlers']].concat(P ? [['p', 'Programs']] : []).concat(D ? [['d', 'Districts']] : []);
  let view = 'w', team = 0;
  const draw = () => {
    const teamSeg = view === 'w' ? `<div class="seg sm" role="group">${['First team', 'Second team', 'Third team'].map((l, i) => `<button type="button" data-team="${i}" aria-pressed="${team === i}">${l}</button>`).join('')}</div>` : '';
    h.querySelector('.tm-tools').innerHTML = `${views.length > 1 ? `<div class="seg" role="group">${views.map(([v, l]) => `<button type="button" data-view="${v}" aria-pressed="${view === v}">${l}</button>`).join('')}</div>` : ''}${teamSeg}`;
    let body = '';
    if (view === 'w') body = `<table class="team"><thead><tr><th>Weight</th><th>Wrestler</th><th class="hide-m">School</th><th>Seasons</th><th>Medals</th><th class="n">Pts</th></tr></thead><tbody>${T.map(({ c, slots }) => { const e = slots[team]; return `<tr><td class="wk">${c.label}</td>${e ? `<td class="nm"><a class="wname" href="${e.href}">${esc(e.name)}</a>${scope === 'state' ? dtag(e.d) : ''}<span class="show-m t3">${esc(e.sch)}</span></td><td class="hide-m">${schoolLink(e.sch, 18)}</td><td class="t3">${e.years}</td><td><span class="career sm">${e.rows.map((r) => medal(r.place, 16, `${r.year}, ${ordinal(r.place)}`)).join('')}</span></td><td class="n"><b>${e.pts}</b></td>` : '<td colspan="5" class="t3">—</td>'}</tr>`; }).join('')}</tbody></table>`;
    else { const L = view === 'p' ? P : D; body = `<table class="team"><thead><tr><th>Weight</th><th>First</th><th>Second</th><th class="hide-m">Third</th></tr></thead><tbody>${L.map(({ c, slots }) => `<tr><td class="wk">${c.label}</td>${[0, 1, 2].map((i) => { const e = slots[i]; return `<td class="${i === 2 ? 'hide-m' : ''}">${e ? `${view === 'p' ? schoolLink(e.id, 18) : distLink(+e.id, { map: false })}<span class="t3 shr">${pct0(e.share)} · ${e.places[0]} titles</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`; }
    h.querySelector('.tm-body').innerHTML = body;
  };
  h.innerHTML = `<div class="tm-tools"></div><div class="tm-body panel tight"></div>`;
  h.addEventListener('click', (e) => { const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; draw(); } const t = e.target.closest('[data-team]'); if (t) { team = +t.dataset.team; draw(); } });
  draw();
}
/* the district whose share of a weight's points most exceeds its overall share (districts with at least 2% overall) */
function overIndex(rs, all) { const T = d3.sum(rs, (r) => r.pts) || 1, A = d3.sum(all, (r) => r.pts) || 1; const ov = d3.rollup(all, (v) => d3.sum(v, (r) => r.pts) / A, (r) => r.d); return d3.rollups(rs, (v) => d3.sum(v, (r) => r.pts) / T, (r) => r.d).filter(([d]) => ov.get(d) >= 0.02).map(([d, share]) => ({ d, share, overall: ov.get(d), idx: share / ov.get(d) })).sort((p, q) => q.idx - p.idx)[0]; }
/* the unit with the largest share of these rows' points */
function topBy(rs, key) { const t = d3.sum(rs, (r) => r.pts) || 1; const [k, v] = d3.rollups(rs, (x) => d3.sum(x, (r) => r.pts), key).sort((p, q) => q[1] - p[1])[0]; return { k, share: v / t }; }

/* ================= Rankings ================= */
function rankingTable(h, kind, opts = {}) {
  let rows = rankings(kind).filter(opts.filter || (() => true));
  const sorts = { all: (o) => o.allTime, now: (o) => o.now, trend: (o) => o.trend, titles: (o) => o.titles, medals: (o) => o.medals, won: (o) => o.won };
  let key = 'all', q = '', dsel = '', limit = opts.limit || 50;
  const draw = () => {
    let L = rows.slice().sort((p, r) => sorts[key](r) - sorts[key](p));
    if (q) L = L.filter((o) => unitName(o.u).toLowerCase().includes(q));
    if (dsel) L = L.filter((o) => o.u.d === +dsel);
    const maxPts = d3.max(rows, (o) => o.pts);
    const th = (k, l, t) => `<th class="n"><button type="button" data-sort="${k}" aria-pressed="${key === k}" title="${t || ''}">${l}${key === k ? ' ↓' : ''}</button></th>`;
    h.querySelector('.rt').innerHTML = `<table class="rank"><thead><tr><th class="n">#</th><th>${kind === 'district' ? 'District' : 'Program'}</th>${th('all', 'Era score', 'All-time: share of each season’s points, summed')}${th('now', 'Power', 'Now: the same, with a seven-season half-life')}<th class="n hide-m"><button type="button" data-sort="trend" aria-pressed="${key === 'trend'}" title="Era score, last ten seasons against the ten before">Trend${key === 'trend' ? ' ↓' : ''}</button></th><th class="hide-m">Last 20 seasons</th>${th('titles', 'Medals', 'Sort by titles')}<th class="n hide-m"><button type="button" data-sort="won" aria-pressed="${key === 'won'}" title="Seasons first in placement points">Team races won${key === 'won' ? ' ↓' : ''}</button></th></tr></thead>
      <tbody>${L.slice(0, limit).map((o, i) => `<tr><td class="n rk">${key === 'all' ? o.allRank : key === 'now' ? o.nowRank : i + 1}</td><td class="nm"><span class="nmw">${unitLink(o.u)}${kind === 'school' && o.u.d && !opts.noTag ? dtag(o.u.d) : ''}</span></td><td class="n"><b>${scoreFmt(o.allTime)}</b></td><td class="n"><b>${scoreFmt(o.now)}</b></td><td class="n hide-m">${trendTxt(o.trend)}</td><td class="hide-m">${spark(o.spark)}</td><td class="n">${shelf4(o.places)}</td><td class="n hide-m">${o.won || '<span class="t3">–</span>'}</td></tr>`).join('')}</tbody></table>
      ${L.length > limit ? `<button type="button" class="btn more-btn" data-more>Show all ${L.length}</button>` : ''}`;
  };
  h.innerHTML = `${opts.tools === false ? '' : `<div class="tools">${kind === 'school' ? `<input class="field" type="search" placeholder="Find a program" aria-label="Find a program"><select class="field" aria-label="District"><option value="">All districts</option>${d3.range(1, 13).map((d) => `<option value="${d}">District ${d}, ${esc(DISTRICTS[d].short)}</option>`).join('')}</select>` : ''}</div>`}<div class="rt"></div>`;
  h.addEventListener('click', (e) => { const s = e.target.closest('[data-sort]'); if (s) { key = s.dataset.sort; draw(); } if (e.target.closest('[data-more]')) { limit = 1e4; draw(); } });
  const inp = h.querySelector('input'), sel = h.querySelector('select');
  if (inp) inp.addEventListener('input', () => { q = inp.value.trim().toLowerCase(); draw(); });
  if (sel) sel.addEventListener('change', () => { dsel = sel.value; draw(); });
  draw();
}
const METHOD = `<details class="method"><summary>How the numbers work: era score, power, trend</summary><p>Every place earns points: 16, 12, 9, 7, 5, 3, 2, 1 for 1st through 8th. <b>All-time</b> adds up a program’s share of the points available each season, times 100, so a title in a 1950s bracket with four places counts the same as one in today’s eight-place bracket. <b>Now</b> is the same with a seven-season half-life, about one roster generation: a medal from seven seasons ago counts half. A <b>team race</b> is the season’s standings by placement points.</p><p>PIAA team scores also count advancement and bonus points, which the results sheets don’t record, so these team races are reconstructions. Checked against the real Class AAA team champions since 1974, they name the same champion in 47 of 53 seasons.</p></details>`;
VIEWS.rankings = function (arg) {
  const kind = arg === 'districts' ? 'district' : 'school';
  $view.innerHTML = `<header class="page-head"><h1>Rankings</h1><p class="lede">Every ${kind === 'district' ? 'district' : 'program'} in ${clsName()}, ranked by its medals. Tap a column to sort.</p>${seg('kind', [['programs', 'Programs'], ['districts', 'Districts']], kind === 'district' ? 'districts' : 'programs')}</header>${METHOD}<div data-c="rt"></div>`;
  $view.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.kind === 'districts' ? '#rankings/districts' : '#rankings'; }));
  rankingTable(host('rt'), kind, { limit: kind === 'district' ? 12 : 50 });
};

/* ================= Program: a school or a district ================= */
function programPage(u) {
  const st = unitStats(u), rows = ROWS(), [a, b] = yearsInScope();
  const R = rankings(u.kind), me = R.find((o) => (u.kind === 'district' ? o.u.d === u.d : o.u.name === u.name));
  const isD = u.kind === 'district';
  const titlesTeam = !isD && state.cls !== 'AA' ? TEAMS.filter((t) => t.sch === u.name) : [];
  const other = !isD ? ['AAA', 'AA'].filter((c) => c !== state.cls && MED.some((r) => r.k === c && r.sch === u.name)) : [];
  const head = isD
    ? `<div class="ph-mark">${distMap(u.d, 120)}</div><div class="ph-id"><p class="crumb">${dtag(u.d)} PIAA district</p><h1>${esc(DISTRICTS[u.d].short)}</h1><p class="about">District ${u.d}: ${esc(DISTRICTS[u.d].long)}.</p></div>`
    : `<div class="ph-mark">${chip(u.name, 72)}</div><div class="ph-id"><p class="crumb">${u.d ? distLink(u.d, { mapW: 30 }) : ''}</p><h1>${esc(u.name)}</h1>${classLine(u.name)}</div>`;
  if (!st.medals) { $view.innerHTML = `<header class="ph">${head}</header><p class="lede">No ${clsName()} state medals on record. ${other.map((c) => `<button type="button" class="btn" data-cls="${c}">Show ${clsName(c)}</button>`).join(' ')} <button type="button" class="btn" data-cls="ALL">Show all classes</button></p>`; bindCls(); return; }
  const nums = [
    [scoreFmt(st.allTime), 'Era score', `${ordinal(me.allRank)} of ${R.length} ${isD ? 'districts' : 'programs'}, all-time`],
    [scoreFmt(st.now), 'Power', `${ordinal(me.nowRank)} of ${R.length}, now`],
    [trendTxt(st.trend), 'Trend', 'era score pts, last 10 seasons vs the 10 before'],
    [fmt(st.pts), 'Points', plural(st.medals, 'medal')],
    [st.won, 'Team races won', st.won ? `first in placement points` : 'by placement points'],
    st.best ? [st.best.year, 'Best season', `${st.best.pts} pts, ${ordinal(st.best.rank)}`] : null
  ].filter(Boolean);
  if (titlesTeam.length) nums.push([titlesTeam.length, 'AAA team titles', titlesTeam.map((t) => t.year).slice(-3).join(', ') + (titlesTeam.length > 3 ? '…' : '')]);
  if (state.year == null || !st.seasons.some((s) => s.year === state.year) || state.yearFor !== unitName(u)) { state.year = st.last; state.yearFor = unitName(u); }
  const W = wrestlersOf(st.rows);
  const progSec = isD ? `<section class="sec">${sec('Its programs', `District ${u.d} schools, ranked by era score.`)}<div data-c="dprog"></div></section>` : '';
  $view.innerHTML = `<header class="ph">${head}</header>
    <dl class="nums">${nums.map(([v, l, s]) => `<div><dd>${v}</dd><dt>${l}</dt><span>${s}</span></div>`).join('')}</dl>
    <div class="shelf-row">${shelf(st.places, { size: 22, zeros: true })}</div>
    ${progSec}
    <section class="sec">${sec('Every medal, season by season', `Each spoke is a ${clsName()} season, clockwise from ${a} at the top; each ring is a spot in that season’s lineup, lightest at the center.${isD ? ' Titles are bright; other medals are dimmed so the titles read.' : ''}`)}
      <div class="matbox"><div class="mat-host" data-c="pmat"></div>
        <aside class="season"><div data-c="strip"></div><p class="strip-cap">Bars: share of each season’s points, colored by team-race finish.</p>
          <div class="scrub"><button type="button" class="btn" id="prev" aria-label="Previous season">‹</button><span id="yr"></span><button type="button" class="btn" id="next" aria-label="Next season">›</button></div>
          <div id="card" aria-live="polite"></div></aside></div>
    </section>
    <section class="sec">${sec('Where on the scale', `Each bar is a weight class: ${isD ? 'the district’s' : esc(u.name) + '’s'} share of all the points won there, split by medal. The level line is its share overall.`)}<p class="lean" id="lean"></p><div class="panel">${tierKey()}<div data-c="wc"></div></div></section>
    <section class="sec">${sec('All-time lineup', `${isD ? 'The district’s' : esc(u.name) + '’s'} best at each weight, each wrestler placed once at his best weight. Use the tabs for the second and third teams${isD ? ', or the district’s leading programs at each weight' : ''}.`)}<div data-c="teams"></div></section>
    <section class="sec">${sec(isD ? 'Its best wrestlers' : 'Its wrestlers', 'Ranked by points; each medal in the order it was won.')}<div data-c="wr"></div></section>
    ${isD && u.d === 11 ? `<section class="sec">${sec('The District 11 tournament', `Champions at the District 11 AAA tournament, ${d3.min(D11, (r) => r.year)}–${d3.max(D11, (r) => r.year)}, by school.`)}<div class="panel"><div data-c="d11"></div></div></section>` : ''}`;
  bindCls();
  // the mat and its season card
  let pv = null;
  const m = mat(host('pmat'), st.rows, { max: 600, dim: isD, label: `${unitName(u)}: every state medal`, preview: (y) => { pv = y; paint(); }, select: (y) => setYear(y) });
  const strip = seasonStrip(host('strip'), st, { select: (y) => setYear(y) });
  const card = $view.querySelector('#card');
  const paint = () => {
    const y = pv || state.year, s = st.seasons.find((x) => x.year === y), S = seasonOf(y);
    m.paint(y, s ? `${s.pts} pts · ${ordinal(s.rank)}` : 'no medals');
    strip.paint(y);
    $view.querySelector('#yr').textContent = y;
    const mine = s ? s.t.rows.slice().sort((p, q) => p.slot - q.slot) : [];
    card.innerHTML = `<p class="race-line">${s ? `<b>${ordinal(s.rank)}</b> of ${isD ? S.dists.length + ' districts' : S.teams.length + ' schools'} in the team race, <b>${s.pts}</b> points${s.rank > 1 ? `; ${isD ? 'District ' + S.dists[0].id : esc(S.teams[0].id)} led with ${(isD ? S.dists[0] : S.teams[0]).pts}` : ''}.` : `No ${clsName()} medals in ${y}.`}</p>
      ${(() => { if (!mine.length) return ''; const li = (r) => `<li>${medal(r.place, 22)}<span class="w">${wShort(r.w)}</span><a class="nm wname" href="${wrestlerHref(r)}">${esc(r.name)}</a>${isD ? schoolLink(r.sch, 18) : ''}</li>`; if (!isD || mine.length <= 8) return `<ol class="mlist">${mine.map(li).join('')}</ol>`; const t = mine.filter((r) => r.place <= 3), rest = mine.filter((r) => r.place > 3); return `<ol class="mlist">${t.map(li).join('')}</ol>${rest.length ? `<details class="rest"><summary>${plural(rest.length, 'more medal')}</summary><ol class="mlist">${rest.map(li).join('')}</ol></details>` : ''}`; })()}
      ${S ? `<a class="more" href="#season/${y}">Open the ${y} season</a>` : ''}`;
  };
  const years = st.seasons.map((s) => s.year);
  const setYear = (y) => { state.year = Math.max(a, Math.min(b, y)); pv = null; paint(); };
  $view.querySelector('#prev').addEventListener('click', () => { const i = years.filter((y) => y < state.year); if (i.length) setYear(i[i.length - 1]); });
  $view.querySelector('#next').addEventListener('click', () => { const i = years.find((y) => y > state.year); if (i) setYear(i); });
  paint();
  // weight
  const ws = weightShares(st.rows, rows);
  weightChart(host('wc'), ws, { H: 240, label: `${unitName(u)}: share of each weight class` });
  const pf = ws.overall < 0.04 ? pct1 : pct0;
  const hi = ws.classes.filter((c) => c.poolPts > 0).map((c) => ({ c, r: c.share / (ws.overall || 1) })).sort((p, q) => q.r - p.r);
  $view.querySelector('#lean').innerHTML = hi.length > 3 ? `Strongest at <b>${hi.slice(0, 2).map((x) => x.c.c.label).join(' and ')}</b>, where it wins ${pf(hi[0].c.share)} and ${pf(hi[1].c.share)} of the points against ${pf(ws.overall)} overall. Weakest at <b>${hi[hi.length - 1].c.c.label}</b> (${pf(hi[hi.length - 1].c.share)}).` : '';
  // wrestlers
  teamsSection(host('teams'), st.rows, isD ? 'district' : 'school');
  wrestlerTable(host('wr'), W, { school: isD, limit: 25 });
  if (isD) rankingTable(host('dprog'), 'school', { filter: (o) => o.u.d === u.d, tools: false, limit: 15, noTag: true });
  if (isD && u.d === 11) { const by = d3.rollups(D11, (v) => v.length, (r) => r.sch).sort((p, q) => q[1] - p[1]).slice(0, 15); const mx = by[0][1]; host('d11').innerHTML = `<ol class="bars">${by.map(([s, n]) => `<li>${schoolLink(s, 18)}<span class="track"><i style="width:${(n / mx * 100).toFixed(1)}%"></i></span><b>${n}</b></li>`).join('')}</ol>`; }
}
function classLine(name) {
  const H = classHistory(name); if (!H.length) return '';
  const moved = H.some((h) => h.cls === 'AAA') && H.some((h) => h.cls === 'AA');
  return `<p class="about">${H.map((h) => `${classLabel(h.cls)} ${h.from}${h.to > h.from ? '–' + h.to : ''}`).join(' · ')}.${H[0].cls === 'single' ? ` One-class seasons count toward Class ${lineage(name)}.` : ''}${moved ? ' Schools change class as enrollment shifts, and in recent cycles the PIAA has moved some successful programs up a class or let them opt up.' : ''}</p>`;
}
function bindCls() { $view.querySelectorAll('[data-cls]').forEach((b) => b.addEventListener('click', () => { setCls(b.dataset.cls); render(); })); }
function wrestlerTable(h, W, opts = {}) {
  let limit = opts.limit || 25;
  const draw = () => { h.innerHTML = `<table class="wr"><thead><tr>${opts.rank ? '<th class="n">#</th>' : ''}<th>Wrestler</th>${opts.school ? '<th class="hide-m">School</th>' : ''}<th>Medals</th><th class="n">Pts</th></tr></thead><tbody>${W.slice(0, limit).map((w, i) => `<tr>${opts.rank ? `<td class="n rk">${i + 1}</td>` : ''}<td class="nm"><a class="wname" href="${wrestlerHref(w.rows[0])}">${esc(w.name)}</a><span class="yrs">${w.rows[0].year}${w.rows.length > 1 ? '–' + w.rows[w.rows.length - 1].year : ''}</span>${opts.school ? `<span class="show-m">${esc(w.school)}</span>` : ''}</td>${opts.school ? `<td class="hide-m">${schoolLink(w.school, 18)}</td>` : ''}<td><span class="career">${w.rows.map((r) => `<span title="${r.year}, ${wLabel(r.w)}, ${ordinal(r.place)}">${medal(r.place, 20)}</span>`).join('')}</span></td><td class="n">${w.pts}</td></tr>`).join('')}</tbody></table>${W.length > limit ? `<button type="button" class="btn more-btn" data-more>Show all ${W.length}</button>` : ''}`; };
  h.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { limit = 1e4; draw(); } });
  draw();
}
VIEWS.school = (s) => { const name = SCHOOL_BY_SLUG.get(s) || s; programPage({ kind: 'school', name, d: schoolDistrict(name) }); };
VIEWS.district = (d) => programPage({ kind: 'district', d: +d, name: `District ${+d}` });

/* ================= Schools: every program, A to Z ================= */
VIEWS.schools = function () {
  const by = d3.group(ROWS(), (r) => r.sch);
  const names = Array.from(by.keys()).sort((p, q) => p.localeCompare(q));
  const info = names.map((n) => ({ n, d: schoolDistrict(n), places: placeCounts(by.get(n)), cls: classHistory(n) }));
  $view.innerHTML = `<header class="page-head"><h1>Schools</h1><p class="lede">${fmt(names.length)} schools with a state medal in ${clsName()}.</p></header>
    <div class="tools"><input class="field" id="sq" type="search" placeholder="Find a school" aria-label="Find a school"><select class="field" id="sd" aria-label="District"><option value="">All districts</option>${d3.range(1, 13).map((d) => `<option value="${d}">District ${d}, ${esc(DISTRICTS[d].short)}</option>`).join('')}</select>${seg('ss', [['az', 'A–Z'], ['medals', 'Most medals']], 'az')}</div>
    <p class="t3" id="scount"></p><div class="dir" id="dir"></div>`;
  let q = '', d = '', sort = 'az';
  const draw = () => {
    let L = info.filter((o) => (!q || o.n.toLowerCase().includes(q)) && (!d || o.d === +d));
    if (sort === 'medals') L = L.slice().sort((p, r) => d3.sum(r.places) - d3.sum(p.places) || r.places[0] - p.places[0]);
    $view.querySelector('#scount').textContent = `${fmt(L.length)} schools`;
    let last = '';
    $view.querySelector('#dir').innerHTML = L.map((o) => { const letter = sort === 'az' ? o.n[0].toUpperCase() : ''; const head = letter && letter !== last ? `<h3 class="letter">${(last = letter)}</h3>` : ''; return `${head}<a class="card" href="${schoolHref(o.n)}">${chip(o.n, 30)}<span class="cn"><b>${esc(o.n)}</b><span class="cl">${o.d ? dtag(o.d) : ''}${Array.from(new Set(o.cls.map((h) => (h.cls === 'single' ? null : h.cls)).filter(Boolean))).map((c) => `<span class="ctag">${c}</span>`).join('')}</span></span>${shelf(o.places, { size: 14, compact: true })}</a>`; }).join('');
  };
  $view.querySelector('#sq').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  $view.querySelector('#sd').addEventListener('change', (e) => { d = e.target.value; draw(); });
  $view.querySelectorAll('[data-ss]').forEach((bt) => bt.addEventListener('click', () => { sort = bt.dataset.ss; $view.querySelectorAll('[data-ss]').forEach((x) => x.setAttribute('aria-pressed', x === bt)); draw(); }));
  draw();
};

/* ================= Season ================= */
VIEWS.season = function (arg) {
  const years = YEARS.filter((y) => boardsFor(y).length);
  const y = years.includes(+arg) ? +arg : years[years.length - 1];
  const boards = boardsFor(y);
  const prev = years.filter((x) => x < y).pop(), next = years.find((x) => x > y);
  const one = boards[0] && boards[0].one;
  const finFor = (S) => FINALS.filter((f) => f.year === y && (S.one || f.cls === S.cls));
  const teamFor = (S) => (S.cls === 'AAA' && !S.one ? TEAMS.filter((t) => t.year === y) : []);
  $view.innerHTML = `<header class="page-head season-head"><div class="yr-nav">${prev ? `<a class="btn" href="#season/${prev}" aria-label="${prev}">‹</a>` : '<span class="btn off">‹</span>'}<h1>${y}</h1>${next ? `<a class="btn" href="#season/${next}" aria-label="${next}">›</a>` : '<span class="btn off">›</span>'}<select class="field" id="ysel" aria-label="Season">${years.slice().reverse().map((x) => `<option${x === y ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
    ${one ? '<p class="lede">One class: every school in the state wrestled in a single tournament until 1974.</p>' : ''}</header>
    ${boards.map((S) => `<section class="sec">${sec(boards.length > 1 ? `${classLabel(S.cls)} team race` : 'The team race', `${S.lineup.length} weights, ${S.places} places at each, ${fmt(d3.sum(S.teams, (t) => t.n))} medals across ${S.teams.length} schools.${teamFor(S).length ? ' ' + teamFor(S).map((t) => `${t.type === 'duals' ? 'State duals' : 'Team title'}: <b>${esc(t.sch)}</b>`).join(' · ') + '.' : ''}`, null, seg('race-' + S.cls, [['schools', 'Schools'], ['districts', 'Districts']], 'schools'))}
      <div class="panel race-host" data-c="race-${S.cls}"></div></section>
      <section class="sec">${sec(boards.length > 1 ? `${classLabel(S.cls)} finals` : 'The finals', '')}<ol class="finals">${finFor(S).map((f) => `<li><span class="w">${wShort(f.w)}</span><span class="f1">${medal(1, 22)}<span><a class="wname" href="${wrestlerHref(f.win)}">${esc(f.win.name)}</a>${schoolLink(f.win.sch, 16)}</span></span><span class="f2">${medal(2, 22)}<span><a class="wname" href="${wrestlerHref(f.lose)}">${esc(f.lose.name)}</a>${schoolLink(f.lose.sch, 16)}</span></span></li>`).join('') || '<li class="empty">Finals results are not on record for this season.</li>'}</ol></section>`).join('')}`;
  boards.forEach((S) => {
    let lim = 15;
    const draw = (mode) => { S._mode = mode; host('race-' + S.cls).innerHTML = raceBoard(S, { mode, limit: mode === 'districts' ? 12 : lim }) + (mode === 'schools' && S.teams.length > lim ? `<button type="button" class="btn more-btn" data-more>Show all ${S.teams.length} schools</button>` : ''); };
    host('race-' + S.cls).addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { lim = 1e4; draw(S._mode); } });
    draw('schools');
    $view.querySelectorAll(`[data-race-${S.cls.toLowerCase()}]`).forEach((bt) => bt.addEventListener('click', () => { $view.querySelectorAll(`[data-race-${S.cls.toLowerCase()}]`).forEach((x) => x.setAttribute('aria-pressed', x === bt)); draw(bt.dataset['race-' + S.cls.toLowerCase()] || bt.getAttribute(`data-race-${S.cls.toLowerCase()}`)); }));
  });
  $view.querySelector('#ysel').addEventListener('change', (e) => { location.hash = '#season/' + e.target.value; });
};

/* ================= Weights: strength at each weight class ================= */
VIEWS.weights = function (arg) {
  const rows = ROWS();
  const ks = STD.filter((c) => rows.some((r) => stdOf(r).k === c.k));
  const c = ks.find((x) => x.k === arg) || ks.find((x) => x.k === '145') || ks[0];
  const rs = rows.filter((r) => stdOf(r).k === c.k);
  const raw = Array.from(new Set(rs.map((r) => r.w))).sort((p, q) => wNum(p) - wNum(q)).map(wShort);
  const W = wrestlersOf(rs);
  const pts = d3.sum(rs, (r) => r.pts), all = d3.sum(rows, (r) => r.pts);
  const dist = d3.rollups(rows, (v) => d3.sum(v, (r) => r.pts), (r) => r.d).map(([d, tot]) => { const at = d3.sum(rs.filter((r) => r.d === d), (r) => r.pts); return { d, at, share: at / pts, overall: tot / all, places: placeCounts(rs.filter((r) => r.d === d)) }; }).filter((o) => o.at).sort((p, q) => q.share - p.share);
  const progs = d3.rollups(rs, (v) => ({ pts: d3.sum(v, (r) => r.pts), places: placeCounts(v) }), (r) => r.sch).map(([sch, o]) => ({ sch, ...o })).sort((p, q) => q.pts - p.pts || q.places[0] - p.places[0]).slice(0, 12);
  const champs = rs.filter((r) => r.place === 1).sort((p, q) => q.year - p.year || q.wn - p.wn);
  const maxShare = dist[0] ? dist[0].share : 1;
  $view.innerHTML = `<header class="page-head"><h1>Weights</h1></header>
    <nav class="wchips" aria-label="Weight class">${ks.map((x) => `<a href="#weights/${x.k}" aria-current="${x.k === c.k}">${x.label}</a>`).join('')}</nav>
    <div class="whead"><h2>${c.label === 'Hwt' ? 'Heavyweight' : c.label + ' lb'}</h2><p class="t3">${raw.length > 1 ? `Includes ${raw.join(', ')}. ` : ''}${plural(champs.length, 'champion')}, ${plural(rs.length, 'medal')} in ${clsName()}.</p></div>
    <div class="two">
      <section class="panel"><h3>Best wrestlers at ${c.label}</h3><p class="sub">Points from medals won at this weight: 16 for a title down to 1 for 8th.</p><ol class="rec wl">${W.slice(0, 15).map((w, i) => `<li><span class="rk">${i + 1}</span><a class="wname" href="${wrestlerHref(w.rows[0])}">${esc(w.name)}</a><b>${w.pts}</b><span class="yrs">${esc(w.school)} · ${w.rows[0].year}${w.rows.length > 1 ? '–' + w.rows[w.rows.length - 1].year : ''} <span class="career sm">${w.rows.map((r) => medal(r.place, 15)).join('')}</span></span></li>`).join('')}</ol></section>
      <section class="panel"><h3>Strongest districts at ${c.label}</h3><p class="sub">Share of the points won at this weight. The tick is the district’s share across all weights.</p><ol class="dbar">${dist.map((o) => `<li><a href="#district/${o.d}">${distLabel(o.d, { mapW: 28 })}</a><span class="track"><i style="width:${(o.share / maxShare * 100).toFixed(1)}%"></i><s style="left:${Math.min(100, o.overall / maxShare * 100).toFixed(1)}%"></s></span><b>${pct0(o.share)}</b></li>`).join('')}</ol></section>
    </div>
    <div class="two">
      <section class="panel"><h3>Strongest programs at ${c.label}</h3><p class="sub">Points from medals at this weight.</p><ol class="rec">${progs.map((o) => `<li>${schoolLink(o.sch, 20)}<b>${o.pts}</b><span class="yrs">${shelf(o.places, { size: 14, compact: true })}</span></li>`).join('')}</ol></section>
      <section class="panel"><h3>Champions at ${c.label}</h3><p class="sub">Newest first.</p><ol class="champs" data-c="champs"></ol></section>
    </div>`;
  let lim = 20;
  const drawCh = () => { host('champs').innerHTML = champs.slice(0, lim).map((r) => `<li><a href="#season/${r.year}" class="yr">${r.year}</a><span class="w">${wShort(r.w)}</span><a class="wname" href="${wrestlerHref(r)}">${esc(r.name)}</a>${schoolLink(r.sch, 16)}</li>`).join('') + (champs.length > lim ? `<li class="more-li"><button type="button" class="btn" data-more>Show all ${champs.length}</button></li>` : ''); };
  drawCh();
  host('champs').addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { lim = 1e4; drawCh(); } });
};

/* ================= Wrestlers ================= */
VIEWS.wrestlers = function () {
  const W = wrestlersOf(ROWS());
  $view.innerHTML = `<header class="page-head"><h1>Wrestlers</h1><p class="lede">${fmt(W.length)} state medalists in ${clsName()}, ranked by career points.</p></header>
    <div class="tools"><input class="field" id="wq" type="search" placeholder="Find a wrestler" aria-label="Find a wrestler"></div><div data-c="wl"></div>`;
  const draw = (q) => { const L = q ? W.filter((w) => w.name.toLowerCase().includes(q) || w.school.toLowerCase().includes(q)) : W; host('wl').innerHTML = ''; wrestlerTable(host('wl'), L, { school: true, limit: 50, rank: !q }); };
  draw('');
  let t; $view.querySelector('#wq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => draw(e.target.value.trim().toLowerCase()), 120); });
};
VIEWS.wrestler = function (arg) {
  const w = WRESTLER.get(arg);
  if (!w) { $view.innerHTML = '<p class="lede">That wrestler isn’t on record.</p>'; return; }
  const pts = d3.sum(w.rows, (r) => r.pts);
  const fin = (r) => FINALS.find((f) => f.year === r.year && f.cls === r.cls && f.wn === r.wn);
  const pool = wrestlersOf(MED.filter((r) => r.k === w.rows[0].k)), rank = pool.findIndex((x) => x.name === w.name && x.school === w.sch) + 1;
  $view.innerHTML = `<header class="ph"><div class="ph-mark">${chip(w.sch, 64)}</div><div class="ph-id"><p class="crumb">${schoolLink(w.sch, 18)} ${w.d ? distLink(w.d, { mapW: 26 }) : ''}</p><h1>${esc(w.name)}</h1><p class="about">${w.rows[0].year}${w.rows.length > 1 ? '–' + w.rows[w.rows.length - 1].year : ''} · ${plural(w.rows.length, 'state medal')} · ${pts} points${rank ? `, ${ordinal(rank)} of ${fmt(pool.length)} in Class ${w.rows[0].k}` : ''}</p></div></header>
    <div class="shelf-row"><span class="career">${w.rows.map((r) => medal(r.place, 30)).join('')}</span></div>
    <section class="sec">${sec('State tournament, season by season', '')}<ol class="career-list">${w.rows.map((r) => { const f = r.place <= 2 ? fin(r) : null; const opp = f ? (r.place === 1 ? f.lose : f.win) : null; return `<li>${medal(r.place, 30)}<div><b>${ordinal(r.place)} at ${wShort(r.w)}</b><span class="t3"><a href="#season/${r.year}">${r.year}</a> · ${classLabel(r.cls)}</span>${opp ? `<span class="fin">${r.place === 1 ? 'Beat' : 'Lost to'} <a class="wname" href="${wrestlerHref(opp)}">${esc(opp.name)}</a>, ${esc(opp.sch)}, in the final</span>` : ''}</div></li>`; }).join('')}</ol></section>`;
};

/* ================= Records ================= */
VIEWS.records = function () {
  const rows = ROWS(), seasons = seasonsInScope();
  const best = seasons.flatMap((S) => S.teams.slice(0, 3).map((t) => ({ S, t }))).sort((p, q) => q.t.share - p.t.share).slice(0, 12);
  const wins = d3.rollups(seasons.filter((S) => S.teams.length), (v) => v.map((S) => S.year), (S) => S.teams[0].id).map(([s, ys]) => ({ s, ys })).sort((p, q) => q.ys.length - p.ys.length).slice(0, 10);
  const runs = d3.groups(rows, (r) => r.sch).map(([s, rs]) => { const ys = Array.from(new Set(rs.map((r) => r.year))).sort((p, q) => p - q); let bestR = { n: 0 }, cur = { n: 0 }; ys.forEach((y, i) => { cur = i && y === ys[i - 1] + 1 ? { n: cur.n + 1, from: cur.from, to: y } : { n: 1, from: y, to: y }; if (cur.n > bestR.n) bestR = cur; }); return { s, ...bestR }; }).sort((p, q) => q.n - p.n).slice(0, 10);
  const W = wrestlersOf(rows);
  const greats = W.filter((w) => w.titles >= 3 || w.n >= 4).sort((p, q) => q.pts - p.pts || q.titles - p.titles || q.n - p.n || p.rows[0].year - q.rows[0].year);
  const fin = FINALS.filter((f) => inScope(f.win)), rec = new Map();
  fin.forEach((f) => { [[f.win.sch, 1], [f.lose.sch, 0]].forEach(([s, w]) => { const o = rec.get(s) || { s, w: 0, l: 0 }; if (w) o.w++; else o.l++; rec.set(s, o); }); });
  const fr = Array.from(rec.values()).filter((o) => o.w + o.l >= 12).sort((p, q) => q.w / (q.w + q.l) - p.w / (p.w + p.l)).slice(0, 12);
  $view.innerHTML = `<header class="page-head"><h1>Records</h1><p class="lede">The marks that stand out in ${clsName()}.</p></header>
    <div class="two">
      <section class="panel"><h3>Most team races won</h3><p class="sub">Seasons first in placement points.</p><ol class="rec">${wins.map((o) => `<li>${schoolLink(o.s, 20)}<b>${o.ys.length}</b><span class="yrs">${o.ys.slice(-6).join(', ')}${o.ys.length > 6 ? '…' : ''}</span></li>`).join('')}</ol></section>
      <section class="panel"><h3>Best single seasons</h3><p class="sub">Largest share of a season’s points.</p><ol class="rec">${best.map(({ S, t }) => `<li>${schoolLink(t.id, 20)}<b>${pct0(t.share)}</b><span class="yrs"><a href="#season/${S.year}">${S.year}</a> · ${shelf(t.places, { size: 13, compact: true })}</span></li>`).join('')}</ol></section>
    </div>
    <div class="two">
      <section class="panel"><h3>Longest runs with a medalist</h3><p class="sub">Consecutive seasons with at least one state place winner.</p><ol class="rec">${runs.map((o) => `<li>${schoolLink(o.s, 20)}<b>${o.n}</b><span class="yrs">${o.from}–${o.to}</span></li>`).join('')}</ol></section>
      <section class="panel"><h3>Finals records</h3><p class="sub">Wins and losses in state finals, schools with twelve or more.</p><ol class="rec">${fr.map((o) => `<li>${schoolLink(o.s, 20)}<b>${o.w}–${o.l}</b><span class="yrs">${pct0(o.w / (o.w + o.l))} in ${o.w + o.l} finals</span></li>`).join('')}</ol></section>
    </div>
    <section class="sec">${sec('The great careers', 'Three-time champions and four-time place winners, ranked by points, then titles, then medals.')}<div data-c="gr"></div></section>`;
  wrestlerTable(host('gr'), greats, { school: true, limit: 30 });
};

/* ================= About ================= */
VIEWS.about = function () {
  $view.innerHTML = `<header class="page-head"><h1>About</h1></header><div class="prose">
    <p>Every Pennsylvania state champion and state place winner since 1938: Class AAA and Class AA since the split in 1974 (now 3A and 2A), and the one-class era before it. Those early seasons count toward AAA or AA by the class each school wrestled in afterwards, or its successor’s for schools that closed or merged. <b>All</b> combines both.</p>
    <div class="key-about">${medalKey()}</div>
    <p><b>Medals and points.</b> Each place is a medal: 1st gold, 2nd silver, 3rd bronze, 4th copper, and 5th through 8th steel, worth 16, 12, 9, 7, 5, 3, 2 and 1 points. The state has awarded different numbers of places over time: finalists only before 1973, four places through 1980, six through 1998 and eight since.</p>
    <p><b>All-time and Now.</b> All-time adds up a program’s share of the points available each season, times 100, so eras with fewer places count the same. Now is the same with a seven-season half-life. Team races are reconstructed from placement points; PIAA team scores also count advancement and bonus points, which these sheets don’t record. Checked against the Class AAA team champions since 1974, placement points name the same champion in 47 of 53 seasons.</p>
    <p><b>Weights.</b> Weight classes have drifted a few pounds over the years, so each is filed under today’s nearest class (103 and 106 count as 107). The 98-pound class, retired after 1988, is kept on its own with the smaller classes of the early years, and every heavyweight limit counts as one class.</p>
    <p><b>Districts.</b> The small maps are drawn from counties. PIAA districts follow school-district lines, so a few edges are approximate.</p>
    <p><b>Gaps.</b> The 1954 one-class results sheet could not be retrieved, so that season shows champions only; 1975 places are incomplete; four Northeast Regional titles are missing.</p>
    <p><b>Sources.</b> <a href="https://www.pa-wrestling.com/">PA-Wrestling.com</a> PIAA championship results and history; District 11 and Northeast Regional history from the same archive.</p>
    <p><b>Code and data.</b> <a href="https://github.com/brockwilson132/pennsylvania-wrestling-history">github.com/brockwilson132/pennsylvania-wrestling-history</a></p></div>`;
};

VIEWS.notfound = () => { $view.innerHTML = `<header class="page-head"><h1>Not found</h1><p class="lede">Nothing lives at this address. <a href="#home">Back to the start</a>.</p></header>`; };

/* ================= chrome: scope, router ================= */
const NAV = [['home', 'Home'], ['rankings', 'Rankings'], ['schools', 'Schools'], ['weights', 'Weights'], ['wrestlers', 'Wrestlers'], ['season', 'Seasons'], ['records', 'Records'], ['about', 'About']];
function chrome(route) {
  document.getElementById('scope').innerHTML = [['AAA', 'Class AAA'], ['AA', 'Class AA'], ['ALL', 'All']].map(([c, l]) => `<button type="button" data-scope="${c}" aria-pressed="${state.cls === c}">${l}</button>`).join('');
  document.getElementById('nav').innerHTML = NAV.map(([k, l]) => `<a href="#${k}" aria-current="${route === k || (k === 'schools' && route === 'school') || (k === 'rankings' && route === 'district') || (k === 'wrestlers' && route === 'wrestler') ? 'page' : 'false'}">${l}</a>`).join('');
}
document.getElementById('scope').addEventListener('click', (e) => { const b = e.target.closest('[data-scope]'); if (!b || b.dataset.scope === state.cls) return; setCls(b.dataset.scope); state.year = null; state.dsel = null; render(); });
function render() {
  const h = (location.hash || '#home').slice(1), [route, arg] = h.split('/');
  const fn = VIEWS[route] || (route === 'home' || !route ? VIEWS.home : VIEWS.notfound);
  tip.hide();
  chrome(VIEWS[route] ? route : 'home');
  $view.innerHTML = '';
  fn(arg ? decodeURIComponent(arg) : undefined);
  const h1 = $view.querySelector('h1'); document.title = (h1 && route !== 'home' ? h1.textContent.trim() + ' · ' : '') + 'PA Wrestling Almanac';
}
let lastRoute = null;
addEventListener('hashchange', () => { const r = location.hash.split('/')[0]; if (r !== lastRoute) scrollTo(0, 0); lastRoute = r; render(); });
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(innerWidth - (window._w || 0)) > 40) { window._w = innerWidth; render(); } }, 200); });
window._w = innerWidth;
render();
