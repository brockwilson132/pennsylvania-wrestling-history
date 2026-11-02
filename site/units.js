/* The unit page. State, district and school are one page with a different unit, at any tournament
   level the data covers. Built for a phone first: header, record, the arena (mat + timeline + season),
   by weight, who, every champion. */
'use strict';

const panel = (id, title, sub) => `<section class="panel"><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}<div class="chart" data-c="${id}"></div></section>`;

/* ---------------- units ---------------- */
function stateUnit() {
  return { kind: 'state', name: 'Pennsylvania', title: 'Pennsylvania', crumb: state.cls === 'single' ? 'One class for every school, 1938–73' : `Class ${state.cls}, ${state.cls === 'AAA' ? 'larger' : 'smaller'} schools, since 1974` };
}
function districtUnit(d) { return { kind: 'district', d, name: `District ${d}`, title: `District ${d}`, crumb: esc(DISTRICTS[d]) }; }
function schoolUnit(s) {
  const id = SB && SB.identity(s.school);
  const colors = id && id.colors_named ? id.colors_named.replace(/, ([^,]+)$/, ' and $1') : '';
  const about = [id && id.mascot ? esc(id.mascot) + '.' : '', colors ? esc(colors.charAt(0).toUpperCase() + colors.slice(1)) + '.' : ''].filter(Boolean).join(' ');
  return { kind: 'school', s, name: s.school, title: s.school, crumb: s.d ? `<a href="#district-${s.d}">District ${s.d}</a>, ${esc(DISTRICTS[s.d])}` : '', about };
}
function headerMark(u) {
  if (u.kind === 'school') return `<span class="hm hm-logo" data-foil-host>${LG.foil(u.name, { size: 96, live: true })}</span>`;
  return `<span class="hm" style="--u:${u.kind === 'district' ? dColor(u.d) : STEEL}"><b>${u.kind === 'district' ? u.d : 'PA'}</b></span>`;
}
function recordFor(u, lv, rows, all, depth, champs) {
  if (lv === 'state' && HAS_MEDALS && u.kind !== 'state') {
    const st = unitStats(u.kind === 'school' ? { kind: 'school', name: u.name } : { kind: 'district', d: u.d });
    const R = rankings(u.kind), me = R.find((o) => (u.kind === 'school' ? o.u.name === u.name : o.u.d === u.d));
    const out = [[fmt(st.titles), `${clsShort()} state titles`], [fmt(st.medals), 'state medals'], [fmt(st.pts), 'placement points'], [me ? `${ordinal(me.shareRank)}` : '—', `era score ${Math.round(st.share * 100)}`], [me ? ordinal(me.powerRank) : '—', `current power ${Math.round(st.power)}`]];
    if (st.top1) out.push([st.top1, `season${st.top1 === 1 ? '' : 's'} as top team`]);
    if (u.kind === 'school' && state.cls === 'AAA') { const teams = TEAMS.filter((t) => t.sch === u.name); if (teams.length) out.push([teams.length, 'AAA team titles']); }
    return out;
  }
  if (lv === 'state' && HAS_MEDALS && u.kind === 'state') {
    const S = Array.from(SEASON.values()).filter((x) => x.cls === state.cls || (usesEra() && x.cls === 'single'));
    const W = wrestlersOf(depth === 'medal' ? rows : champs);
    return [[fmt(champs.length), 'state titles'], [fmt(d3.sum(S, (x) => x.teams.reduce((n, t) => n + t.medals, 0))), 'state medals'], [S.length, 'seasons'], [fmt(new Set(rows.map((r) => r.sch)).size), `schools with a ${depth === 'medal' ? 'medalist' : 'champion'}`], [fmt(W.filter((w) => w.n >= 4).length), 'four-time ' + (depth === 'medal' ? 'medalists' : 'champions')]];
  }
  const L = depth === 'medal' ? { title: 'state medal', titles: 'state medals' } : LEVELS[lv];
  const titlesN = depth === 'medal' ? champs.filter((r) => (u.kind === 'state') || (u.kind === 'district' ? r.d === u.d : r.sch === u.name)).length : null;
  const rankBy = (key) => { const t = Array.from(d3.rollup(all, (v) => v.length, key)).sort((a, b) => b[1] - a[1]); const me = u.kind === 'district' ? u.d : u.name; const i = t.findIndex((x) => x[0] === me); return i < 0 ? null : 1 + t.filter((x) => x[1] > t[i][1]).length; };
  const W = wrestlersOf(rows);
  const seasons = new Set(rows.map((r) => r.year)).size;
  const who = depth === 'medal' ? 'medalist' : 'champion';
  if (u.kind === 'state') return [[fmt(rows.length), `${L.title}s`]].concat(depth === 'medal' ? [[fmt(titlesN), 'state titles']] : []).concat([[seasons, 'seasons'], [fmt(new Set(rows.map((r) => r.sch)).size), `schools with a ${who}`], [fmt(W.filter((w) => w.n >= 2).length), `multi-time ${who}s`], [W.filter((w) => w.n >= 4).length, `four-time ${who}s`]]);
  const out = [[fmt(rows.length), `${L.title}s`]];
  if (depth === 'medal') out.push([fmt(titlesN), 'state titles']);
  if (u.kind === 'district') {
    if (lv === 'district') out.push([fmt(new Set(rows.map((r) => r.sch)).size), 'schools with a champion'], [seasons, 'seasons'], [fmt(W.filter((w) => w.n >= 2).length), 'multi-time champions']);
    else {
      const rk = rankBy((r) => r.d);
      out.push([rk ? ordinal(rk) : '—', `of ${lv === 'regional' ? 4 : 12} districts`], [all.length ? pct0(rows.length / all.length) : '—', `of ${lv === 'regional' ? 'the region’s' : 'the state’s'} titles`], [fmt(new Set(rows.map((r) => r.sch)).size), 'schools with a champion']);
      if (lv === 'state' && depth !== 'medal' && HAS_MEDALS) out.push([fmt(MEDALS.filter((r) => r.cls === state.cls && r.d === u.d).length), `${clsShort()} state medals`]);
      if (lv === 'state' && state.cls === 'AAA') out.push([TEAMS.filter((t) => +t.d === u.d).length, 'AAA team titles']);
    }
    return out;
  }
  const rk = rankBy((r) => r.sch);
  out.push([rk ? ordinal(rk) : '—', `in ${lv === 'state' ? 'the state' : lv === 'regional' ? 'the region' : 'the district'}`], [seasons, `seasons with a ${who}`]);
  if (lv === 'state') {
    const s = u.s; const teams = TEAMS.filter((t) => t.sch === s.school);
    const other = state.cls === 'AAA' ? ['AA', s.aa] : state.cls === 'AA' ? ['AAA', s.aaa] : null;
    if (other && other[1]) out.push([other[1], `Class ${other[0]} titles`]);
    if (depth !== 'medal' && HAS_MEDALS) out.push([fmt(MEDALS.filter((r) => r.cls === state.cls && r.sch === u.name).length), `${clsShort()} state medals`]);
    if (teams.length) out.push([teams.length, 'AAA team titles']);
  }
  return out;
}

/* ---------------- the page ---------------- */
function unitPage(u) {
  const levels = levelsFor(u);
  const lv = levels.includes(state.level) ? state.level : 'state';
  // the state page always works from every medal: the mat shows champions, the panel the team race
  const depth = lv === 'state' && (u.kind === 'state' ? HAS_MEDALS : depthOn()) ? 'medal' : 'champ';
  const L0 = LEVELS[lv];
  const L = depth === 'medal' ? { ...L0, noun: 'state medalist', nouns: 'state medalists', title: 'state medal' } : L0;
  const champs = levelRows(lv, 'champ');
  const all = levelRows(lv, depth);
  const isState = u.kind === 'state', isSchool = u.kind === 'school', isDistrict = u.kind === 'district';
  const inUnit = (r) => isState || (isDistrict ? r.d === u.d : r.sch === u.name);
  const rows = all.filter(inUnit);
  const [a, b] = yearsOf(all);
  const empty = !rows.length;
  const wholeUnit = isState || (isDistrict && lv === 'district');
  const poolWord = lv === 'state' ? 'the state' : lv === 'regional' ? 'the region' : 'the district';
  const poolAdv = lv === 'state' ? 'statewide' : lv === 'regional' ? 'across the region' : 'across the district';
  const uColor = isSchool ? sColor(u.name) : isDistrict ? dColor(u.d) : CHALK;

  // color says who: districts on the state mat, schools on a district mat, the one school on its page
  let groups = [], colorOf;
  const bySchool = isState && state.colorBy === 'school';
  if (isState || (isDistrict && lv === 'district')) {
    if (isState && !bySchool) {
      groups = d3.range(1, 13).map((d) => ({ k: 'd' + d, label: `D${d}`, title: `District ${d}, ${DISTRICTS[d]}`, color: dColor(d), test: (r) => r.d === d }));
      colorOf = (r) => dColor(r.d);
    } else if (isState) {
      // every school in its own color; the legend lists the top programs
      const top = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.sch)).sort((x, y) => y[1] - x[1]).slice(0, 10).map((x) => x[0]);
      groups = top.map((sc) => ({ k: 's:' + sc, label: esc(sc), chip: badge(sc, 16), color: sColor(sc), test: (r) => r.sch === sc }));
      groups.push({ k: 'other', label: 'All other schools', color: null, test: (r) => !top.includes(r.sch) });
      colorOf = (r) => sColor(r.sch);
    } else {
      const top = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.sch)).sort((x, y) => y[1] - x[1]).slice(0, 7).map((x) => x[0]);
      const pal = SB ? SB.palette(top, 'dark') : {};
      top.forEach((sc) => { if (!pal[sc] || pal[sc] === SB.colorFor('Other', 'dark')) pal[sc] = sColor(sc); });
      groups = top.map((sc) => ({ k: 's:' + sc, label: esc(sc), chip: badge(sc, 16), color: pal[sc], test: (r) => r.sch === sc }));
      groups.push({ k: 'other', label: 'Other schools', color: STEEL, test: (r) => !top.includes(r.sch) });
      colorOf = (r) => pal[r.sch] || STEEL;
    }
    groups.forEach((g) => { g.n = rows.filter(g.test).length; });
    groups = groups.filter((g) => g.n).sort((x, y) => (x.k === 'other') - (y.k === 'other') || y.n - x.n);
  } else if (isDistrict) {
    const top = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.sch)).sort((x, y) => y[1] - x[1]).slice(0, 7).map((x) => x[0]);
    const pal = SB ? SB.palette(top, 'dark') : {};
    top.forEach((sc) => { if (!pal[sc] || pal[sc] === SB.colorFor('Other', 'dark')) pal[sc] = sColor(sc); });
    groups = top.map((sc) => ({ k: 's:' + sc, label: esc(sc), chip: badge(sc, 16), color: pal[sc], test: (r) => r.sch === sc }));
    groups.push({ k: 'other', label: 'Other schools', color: STEEL, test: (r) => !top.includes(r.sch) });
    groups.forEach((g) => { g.n = rows.filter(g.test).length; });
    groups = groups.filter((g) => g.n);
    colorOf = (r) => pal[r.sch] || STEEL;
  } else colorOf = () => uColor;

  const key = u.kind + (u.d || u.name || '') + lv + depth + state.cls + state.withSingle;
  if (state.arKey !== key) { state.arKey = key; state.arYear = rows.length ? d3.max(rows, (r) => r.year) : b; state.q = ''; state.focus = null; }
  if (state.arYear < a || state.arYear > b) state.arYear = b;

  const stats = recordFor(u, lv, rows, all, depth, champs);
  const canDepth = lv === 'state' && HAS_MEDALS && !isState;
  const lvSwitch = levels.length > 1 ? `<div class="levels" role="group" aria-label="Tournament level">${levels.map((k) => `<button type="button" data-lv="${k}" aria-pressed="${k === lv}"><b>${fmt(levelRows(k, 'champ').filter(inUnit).length)}</b><span>${LEVELS[k].nouns}</span></button>`).join('')}</div>` : '';
  const depthSwitch = canDepth ? `<div class="seg depth" role="group" aria-label="Depth"><button type="button" data-depth="champ" aria-pressed="${depth === 'champ'}">Champions</button><button type="button" data-depth="medal" aria-pressed="${depth === 'medal'}">All medalists <span class="n">${fmt(levelRows('state', 'medal').filter(inUnit).length)}</span></button></div>` : '';
  const levelNote = lv === 'state' ? '' : `<p class="level-note">${lv === 'regional' ? `Northeast AAA Regional, ${a}–${b}: Districts 2, 4 and 11, and District 12 since 2013. Four regional titles are missing from the record.` : `District 11 AAA tournament, ${a}–${b}.`}</p>`;
  const unitPoss = esc(u.name) + '’s';
  const ledgerOn = state.view === 'ledger';
  const ledgerMedals = lv === 'state' && HAS_MEDALS;
  const ledgerSub = isSchool
    ? (ledgerMedals ? `Every ${unitPoss} state medal: each row is a weight class, each column a season, and the number is the place.` : `Every ${unitPoss} ${L.noun}: each row is a weight class, each column a season.`)
    : ledgerMedals
    ? `Where each ${isState && !bySchool ? 'district' : 'school'} finished in the team race, season by season. Each row is a ${isState && !bySchool ? 'district' : 'school'}, each column a season, and the number is its finish${isDistrict ? ' among District ' + u.d + ' schools' : isState && !bySchool ? ' among the 12 districts' : ' statewide'}, by placement points.`
    : `Each row is a school, each column a season, and the number is how many ${L.nouns} it had.`;
  const matSub = ledgerOn ? ledgerSub : depth === 'medal' && !wholeUnit
    ? `Every weight ${esc(u.name)} medaled at, among all ${fmt(champs.length)} ${L0.nouns} in ${poolWord}: bright for a title, dimmer for a lower place. Each spoke is a season, clockwise from ${a} at the top; each ring is a spot in that season’s lineup, lightest at the hub.`
    : depth === 'medal' ? `The mat shows the champion at each weight; the charts below count every medal. Each spoke is a season, clockwise from ${a} at the top; each ring is a spot in the lineup, lightest at the hub. Color is the ${isState && !bySchool ? 'district' : 'school'}.`
    : wholeUnit
    ? `Every ${L.noun} since ${a}, one mark each. Each spoke is a season, clockwise from ${a} at the top. Each ring is a spot in that season’s lineup: lightest at the hub, heaviest at the rim. Color is the ${isState && !bySchool ? 'district' : 'school'}.`
    : `${unitPoss} ${plural(rows.length, L.noun)} lit up among all ${fmt(all.length)} in ${poolWord}. Each spoke is a season, clockwise from ${a} at the top. Each ring is a spot in that season’s lineup: lightest at the hub, heaviest at the rim.`;

  $view.innerHTML = `<header class="hdr">
      ${headerMark(u)}
      <div class="hdr-id">${u.crumb ? `<p class="crumb">${u.crumb}</p>` : ''}<h1>${esc(u.title)}</h1>${u.about ? `<p class="about">${u.about}</p>` : ''}</div>
      <div class="hdr-switches">${lvSwitch}${depthSwitch}</div>
    </header>
    <div class="knurl" aria-hidden="true"></div>
    ${levelNote}
    <dl class="record">${stats.map(([v, l], i) => `<div class="${i ? '' : 'lead'}" style="--u:${uColor}"><dd>${v}</dd><dt>${l}</dt></div>`).join('')}</dl>
    ${empty ? `<p class="lede">No ${clsName()} ${L.nouns} on record for ${esc(u.name)}.${isSchool && lv === 'state' ? ' Try the class switch above.' : ''}</p>` : ''}
    <section class="sec arena" id="mat">${tab('The arena', matSub)}
      <div class="mat-tools">
        <div class="seg" role="group" aria-label="View"><button type="button" data-view="mat" aria-pressed="${!ledgerOn}">Mat</button><button type="button" data-view="ledger" aria-pressed="${ledgerOn}">Ledger</button></div>
        ${isState ? `<div class="seg" role="group" aria-label="${ledgerOn ? 'Rows' : 'Color by'}"><button type="button" data-cb="district" aria-pressed="${!bySchool}">Districts</button><button type="button" data-cb="school" aria-pressed="${bySchool}">Schools</button></div>` : ''}
        <input class="field" id="m-q" type="search" placeholder="Find a wrestler or school" aria-label="Find a wrestler or school on the mat"${ledgerOn ? ' hidden' : ''}>
        ${groups.length > 1 && !ledgerOn ? `<div class="legend" id="m-legend" aria-label="Show one group"></div>` : ''}
      </div>
      <div class="mat-body${ledgerOn ? ' ledger-mode' : ''}">
        ${ledgerOn ? `<div class="lg-wrap"><div data-c="ledger"></div><div class="lg-key">${ledgerMedals ? (isSchool ? '<span><i class="t1">1</i>champion</span><span><i class="t2">2</i>2nd–3rd</span><span><i class="t3">5</i>4th–8th</span>' : `<span><i class="t1">1</i>won the team race</span><span><i class="t2">2</i>2nd–3rd</span><span><i class="t3">6</i>${isState && !bySchool ? '4th–6th' : '4th–10th'}</span><span><i class="t4"></i>lower</span>`) : '<span><i class="t1">2</i>titles that season</span>'}<span><i class="nil"></i>none</span><span class="lg-hint">Tap a season to open it</span></div></div>` : `<div class="mat-wrap"><div class="chart" data-c="mat" tabindex="0" aria-label="The mat. Use the arrow keys to change season."></div></div>`}
        <aside class="season">
          <div class="timeline" id="m-tl"><div class="chart" data-c="tl"></div><input type="range" id="m-year" min="${a}" max="${b}" step="1" aria-label="Season"></div>
          <div class="scrub"><button type="button" class="btn" id="m-prev" aria-label="Previous season">‹</button><span class="tl-note">${wholeUnit ? 'Drag the timeline or point at the mat' : depth === 'medal' ? `Bars are ${unitPoss} points each season` : `Ticks mark ${unitPoss} seasons`}</span><button type="button" class="btn" id="m-next" aria-label="Next season">›</button></div>
          <div id="m-card" aria-live="polite"></div>
        </aside>
      </div>
    </section>` +
    (empty ? '' : `<section class="sec">${tab('By weight', wholeUnit
        ? `Who ${depth === 'medal' ? 'medals' : 'wins'} at each weight. Weights have drifted a few pounds between eras, so each title is filed under today’s nearest class (103 and 106 count as 107); 98 is kept as a retired class and every heavyweight limit is one class. Color is the ${isState ? (bySchool ? 'school' : 'district') : 'school'}.`
        : `Where on the scale ${unitPoss} ${depth === 'medal' ? 'medals came' : 'champions won'}. Weights are filed under today’s nearest class (103 and 106 count as 107). The chalk tick on each bar is where ${poolWord} would stand with the same total, so a bar past its tick is a strength.${isDistrict ? ' Color is the school.' : ''}`)}
      <p class="lean" id="lean"></p>
      ${isSchool ? '' : '<div class="legend static" id="w-legend"></div>'}
      <div class="panel"><h3>By weight class</h3><div class="chart" data-c="wc"></div></div>
      <div class="panel"><h3>Light, middle or heavy</h3><p class="sub">${wholeUnit ? `Each season’s lineup split into fifths, lightest to heaviest. Each bar is everyone who ${depth === 'medal' ? 'medaled' : 'won'} in that fifth; the colors show who takes the biggest share.` : `${unitPoss} ${depth === 'medal' ? 'medal points' : 'titles'} split into fifths of each season’s lineup, lightest at the left. An even program would show about 20% in each; the note says how much heavier or lighter it runs than ${poolWord}.`}</p><div class="chart" data-c="fifths"></div></div>
    </section>
    <section class="sec" id="who">${tab(isSchool ? 'The champions' : 'Who wins', '')}<div class="two" id="who-body"></div></section>
    <section class="sec">${tab('Every champion', 'Newest first. Click a column to sort.', 'every-tab')}<div class="controls"><input class="field" id="e-q" type="search" placeholder="Filter by wrestler or school" aria-label="Filter the list"></div><div data-c="every"></div></section>`) +
    (isDistrict && u.d === 11 && state.cls === 'AAA' ? d11Section() : '');

  $view.querySelectorAll('[data-lv]').forEach((bt) => bt.addEventListener('click', () => { if (bt.dataset.lv === lv) return; state.level = bt.dataset.lv; route(true); }));
  $view.querySelectorAll('[data-depth]').forEach((bt) => bt.addEventListener('click', () => { if (bt.dataset.depth === depth) return; state.depth = bt.dataset.depth; route(true); }));
  $view.querySelectorAll('[data-cb]').forEach((bt) => bt.addEventListener('click', () => { if ((bt.dataset.cb === 'school') === bySchool) return; state.colorBy = bt.dataset.cb; state.focus = null; route(true); }));
  $view.querySelectorAll('[data-view]').forEach((bt) => bt.addEventListener('click', () => { if (bt.dataset.view === state.view) return; state.view = bt.dataset.view; state.q = ''; state.focus = null; route(true); }));

  /* ---- the arena ---- */
  const card = $view.querySelector('#m-card'), range = $view.querySelector('#m-year'), q = $view.querySelector('#m-q'), leg = $view.querySelector('#m-legend');
  q.value = state.q;
  let pv = { y: null, r: null }, showMatches = true, mat = null, tl = null, lg = null;
  const ql = () => state.q.toLowerCase();
  const isMatch = (r) => !!ql() && (r.name.toLowerCase().includes(ql()) || r.school.toLowerCase().includes(ql()));
  const inFocus = (r) => { if (!state.focus) return true; const g = groups.find((x) => x.k === state.focus); return g ? g.test(r) : true; };
  // in medal mode a champion cell is lit when the unit medaled at that weight that season
  const medalAt = new Map(); if (depth === 'medal' && !wholeUnit) rows.forEach((m) => { const k = m.year + '|' + m.wn; const cur = medalAt.get(k); if (!cur || m.place < cur.place) medalAt.set(k, m); });
  const cellMedal = (r) => medalAt.get(r.year + '|' + r.wn);
  const litChamp = (r) => inUnit(r) && inFocus(r) && (!ql() || isMatch(r));
  const lit = (r) => (depth === 'medal' && !wholeUnit ? (() => { const m = cellMedal(r); return !!m && inFocus(m) && (!ql() || isMatch(m)); })() : litChamp(r));
  const cellColor = (r) => (depth === 'medal' && !wholeUnit ? (cellMedal(r) ? colorOf(cellMedal(r)) : GHOST) : (lit(r) ? colorOf(r) : GHOST));
  const cellOpacity = (r) => { if (depth !== 'medal' || wholeUnit) return 1; const m = cellMedal(r); return !m ? 1 : m.place === 1 ? 1 : m.place <= 3 ? 0.72 : 0.45; };
  const drawLegend = () => { if (leg) leg.innerHTML = groups.map((g) => `<button type="button" data-k="${esc(g.k)}" aria-pressed="${state.focus === g.k}" class="${state.focus && state.focus !== g.k ? 'dim' : ''}" ${g.title ? `title="${g.title}"` : ''}><i class="${g.color ? '' : 'multi'}" style="${g.color ? 'background:' + g.color : ''}"></i>${g.chip || ''}${g.label} <span class="n">${g.n}</span></button>`).join(''); };
  const row = (r, focusRow) => `<li class="${focusRow === r || (focusRow && r.year === focusRow.year && r.wn === focusRow.wn && r.place === 1 && !inUnit(focusRow)) ? 'on ' : ''}${(depth === 'medal' ? inUnit(r) && inFocus(r) : lit(r)) ? 'lit' : 'off'}" style="--c:${inUnit(r) ? colorOf(r) : STEEL_2}"><span class="w">${r.w === 'UNL' ? 'Unl.' : esc(r.w)}</span><span class="nm">${r.place && r.place > 1 ? `<span class="pl">${ordinal(r.place)}</span>` : ''}${esc(r.name)}</span><a class="who" href="${schoolHref(r.school)}">${badge(r.school, 20)}<span>${esc(r.school)}</span></a>${lv === 'district' ? '' : dpill(r.d)}</li>`;
  const seasonCard = (y, focusRow) => {
    const pool = depth === 'medal' ? champs : all;
    const rs = pool.filter((r) => r.year === y).sort((p, q2) => p.wn - q2.wn);
    const mine = (depth === 'medal' && !wholeUnit ? rows.filter((r) => r.year === y).sort((p, q2) => p.wn - q2.wn || p.place - q2.place) : rs.filter(inUnit)), rest = rs.filter((r) => !inUnit(r));
    const head = wholeUnit ? plural(rs.length, depth === 'medal' ? 'state medal' : L.noun) : depth === 'medal' ? `${esc(u.name)}: ${plural(mine.length, 'medal')}` : `${esc(u.name)}: ${mine.length} of ${rs.length}`;
    if (!rs.length) return `<div class="card-head"><span class="card-yr">${y}</span><span class="card-sub">no ${L.nouns} on record</span></div>`;
    const S = depth === 'medal' && !wholeUnit ? seasonOf(y, rs[0].cls) : null;
    const tm = S ? (isSchool ? S.teamBy.get(u.name) : S.distBy.get(u.d)) : null;
    const raceLine = tm ? `<p class="race-line"><b>${tm.pts} points</b>, ${ordinal(tm.rank)} of ${isSchool ? S.teams.length : S.dists.length} ${isSchool ? 'schools' : 'districts'} that medaled${tm.rank > 1 ? `; leader ${esc(isSchool ? S.teams[0].sch : 'District ' + S.dists[0].d)}, ${(isSchool ? S.teams[0] : S.dists[0]).pts}` : ''}.</p>` : (S ? `<p class="race-line">No points this season.</p>` : '');
    if (wholeUnit && depth === 'medal') {
      const S = seasonOf(y, rs[0] ? rs[0].cls : state.cls);
      const byDist = isState && !bySchool;
      const LU = (S && LINEUP.get(S.year + '|' + S.cls)) || [];
      const n = LU.length || 13, P = S ? S.places : 8;
      const wl = (w) => (w === 'UNL' ? 'Unl' : w === 'HWT' ? 'Hwt' : w);
      const axis = `<div class="rx-axis${byDist ? ' d' : ''}" style="--n:${n}"><span class="rx-cap"></span><div class="rx-cols">${byDist ? '<b></b>' : ''}${LU.map((o) => `<b>${wl(o.w)}</b>`).join('')}</div></div>`;
      const cellTitle = (r) => `${esc(r.name)}, ${esc(r.school)}, ${wLabel(r.w)}, ${ordinal(r.place)}`;
      const schoolStrip = (t) => { const at = new Map(t.rows.map((r) => [r.slot, r])); return `<div class="rx-strip" style="--n:${n}">${d3.range(n).map((i) => { const r = at.get(i); return r ? `<i class="p${r.place === 1 ? 1 : r.place <= 3 ? 2 : 3}" title="${cellTitle(r)}">${r.place}</i>` : '<i class="nil"></i>'; }).join('')}</div>`; };
      const distGrid = (t) => { const at = new Map(t.rows.map((r) => [r.slot + '|' + r.place, r])); return `<div class="rx-grid" style="--n:${n}">${d3.range(1, P + 1).map((p) => `<b>${p}</b>${d3.range(n).map((i) => { const r = at.get(i + '|' + p); return r ? `<i title="${cellTitle(r)}">${badge(r.school, 17)}</i>` : '<i class="nil"></i>'; }).join('')}`).join('')}</div>`; };
      const list = !S ? [] : byDist ? S.dists : (isState ? S.teams : S.teams.filter((t) => t.d === u.d)).slice(0, 12);
      const head = `<div class="card-head"><span class="card-yr">${y}</span><span class="card-sub">team race${byDist ? ' by district' : ''}, ${plural(S ? d3.sum(S.teams, (t) => t.medals) : 0, 'medal')}</span>${pv.y != null && pv.y !== state.arYear ? '<span class="card-note">Click to keep</span>' : ''}</div>`;
      const note = byDist ? `<p class="rx-note">Across: that season’s weights. Down: places 1–${P}. Each badge is the district’s school that placed there.</p>` : `<p class="rx-note">Across: that season’s weights. Each number is where the school’s wrestler placed.</p>`;
      const item = (t, i) => byDist
        ? `<li><span class="rk">${i + 1}</span><a class="who" href="#district-${t.d}">${dtag(t.d)}<span>District ${t.d}</span></a><span class="pts"><b>${t.pts}</b> pts</span><span class="mini">${t.titles ? plural(t.titles, 'title') + ', ' : ''}${plural(t.medals, 'medal')}</span>${distGrid(t)}</li>`
        : `<li><span class="rk">${i + 1}</span><a class="who" href="${schoolHref(t.sch)}">${badge(t.sch, 20)}<span>${esc(t.sch)}</span></a><span class="pts"><b>${t.pts}</b> pts</span><span class="mini">${t.titles ? plural(t.titles, 'title') + ', ' : ''}${plural(t.medals, 'medal')}${isState ? '' : ''}</span>${schoolStrip(t)}</li>`;
      const top = byDist ? list.slice(0, 4) : list, more = byDist ? list.slice(4) : [];
      return `${head}${note}${axis}<ol class="race rx${byDist ? ' d' : ''}">${top.map(item).join('')}</ol>
        ${more.length ? `<details class="rest"><summary>Districts ranked ${top.length + 1}–${list.length}</summary><ol class="race rx d" start="${top.length + 1}">${more.map((t, i) => item(t, i + top.length)).join('')}</ol></details>` : ''}
        <details class="rest"><summary>The ${rs.length} champions</summary><ol class="lineup">${rs.map((r) => row(r, focusRow)).join('')}</ol></details>`;
    }
    if (wholeUnit) return `<div class="card-head"><span class="card-yr">${y}</span><span class="card-sub">${head}</span>${pv.y != null && pv.y !== state.arYear ? '<span class="card-note">Click to keep</span>' : ''}</div><ol class="lineup">${rs.map((r) => row(r, focusRow)).join('')}</ol>`;
    return `<div class="card-head"><span class="card-yr">${y}</span><span class="card-sub">${head}</span>${pv.y != null && pv.y !== state.arYear ? '<span class="card-note">Click to keep</span>' : ''}</div>
      ${raceLine}${mine.length ? `<ol class="lineup">${mine.map((r) => row(r, focusRow)).join('')}</ol>` : `<p class="empty">No ${esc(u.name)} ${depth === 'medal' ? 'medalist' : 'champion'} this season.</p>`}
      ${rest.length ? `<details class="rest"${focusRow && !inUnit(focusRow) ? ' open' : ''}><summary>${depth === 'medal' ? `The ${rs.length} champions` : `The other ${rest.length} champions`}</summary><ol class="lineup">${(depth === 'medal' ? rs : rest).map((r) => row(r, focusRow)).join('')}</ol></details>` : ''}`;
  };
  const matchCard = () => {
    const ms = all.filter((r) => inUnit(r) && isMatch(r)).sort((p, q2) => p.year - q2.year || p.wn - q2.wn);
    if (!ms.length) return `<div class="card-head"><span class="card-sub">No ${L.noun} or school matches “${esc(state.q)}”${isState ? '' : ' at ' + esc(u.name)}.</span></div>`;
    return `<div class="card-head"><span class="card-yr">${ms.length}</span><span class="card-sub">match “${esc(state.q)}”</span></div>
      <ol class="lineup matches">${ms.slice(0, 60).map((r) => `<li class="lit" style="--c:${colorOf(r)}"><button type="button" class="yr-btn" data-year="${r.year}">${r.year}</button><span class="w">${esc(r.w)}</span><span class="nm">${esc(r.name)}</span><a class="who" href="${schoolHref(r.school)}">${badge(r.school, 20)}<span>${esc(r.school)}</span></a></li>`).join('')}</ol>
      <p class="card-foot">${ms.length > 60 ? 'Showing the first 60. ' : ''}Pick a season to open its lineup.</p>`;
  };
  const buildLedger = () => {
    const years = [a, b];
    const seasons = Array.from(SEASON.values()).filter((S) => S.cls === state.cls || (usesEra() && S.cls === 'single'));
    const Sby = new Map(seasons.map((S) => [S.year, S]));
    const tierOf = (rank, small) => (rank === 1 ? 1 : rank <= 3 ? 2 : rank <= (small ? 6 : 10) ? 3 : 4);
    let rowsDef, cell, corner = '';
    if (isSchool) {
      const src = ledgerMedals ? all.filter(inUnit) : rows;
      const byKY = d3.group(src, (r) => stdOf(r).k + '|' + r.year);
      rowsDef = STD.filter((c) => src.some((r) => stdOf(r).k === c.k)).map((c) => ({ key: c.k, label: c.label + (c.k === '98' ? ' (retired)' : '') }));
      corner = 'Weight';
      cell = (k, y) => { const rs = byKY.get(k + '|' + y); if (!rs) return null; const best = rs.reduce((m, r) => ((r.place || 1) < (m.place || 1) ? r : m)); const pl = best.place || 1; return { n: pl, tier: pl === 1 ? 1 : pl <= 3 ? 2 : 3, text: `${best.name}, ${wLabel(best.w)}, ${pl === 1 ? 'champion' : ordinal(pl)}` }; };
    } else if (ledgerMedals) {
      const byDist = isState && !bySchool;
      const R = rankings(byDist ? 'district' : 'school').filter((o) => byDist || (isDistrict ? o.seasons.some((x) => x.rows[0].d === u.d) : true)).sort((p, q) => q.share - p.share);
      const keys = (isState && !byDist ? R.slice(0, 40) : R).map((o) => (byDist ? o.u.d : o.u.name));
      rowsDef = keys.map((k) => (byDist ? { key: k, label: `District ${k}`, href: '#district-' + k, chip: dtag(k) } : { key: k, label: k, href: schoolHref(k), chip: badge(k, 16) }));
      corner = byDist ? 'District' : 'School';
      cell = (k, y) => {
        const S = Sby.get(y); if (!S) return null;
        if (byDist) { const t = S.distBy.get(+k); if (!t) return null; return { n: t.rank, tier: tierOf(t.rank, true), text: `${ordinal(t.rank)} of ${S.dists.length} districts, ${t.pts} pts`, sub: `${t.titles ? plural(t.titles, 'title') + ', ' : ''}${plural(t.medals, 'medal')}` }; }
        const t = S.teamBy.get(k); if (!t) return null;
        const rank = isDistrict ? S.teams.filter((x) => x.d === u.d).findIndex((x) => x.sch === k) + 1 : t.rank;
        return { n: rank, tier: tierOf(rank, false), text: `${ordinal(rank)} ${isDistrict ? 'in District ' + u.d : 'of ' + S.teams.length + ' schools'}, ${t.pts} pts`, sub: `${isDistrict ? ordinal(t.rank) + ' statewide. ' : ''}${t.rows.map((r) => `${r.w} ${esc(r.name)} (${ordinal(r.place)})`).join('<br>')}` };
      };
    } else {
      const pool = rows;
      const byKY = d3.rollup(pool, (v) => v, (r) => r.sch, (r) => r.year);
      const keys = Array.from(byKY.keys()).sort((p, q) => d3.sum(Array.from(byKY.get(q).values()), (v) => v.length) - d3.sum(Array.from(byKY.get(p).values()), (v) => v.length));
      rowsDef = keys.map((k) => ({ key: k, label: k, href: schoolHref(k), chip: badge(k, 16) }));
      corner = 'School';
      cell = (k, y) => { const v = byKY.get(k) && byKY.get(k).get(y); if (!v) return null; return { n: v.length, tier: v.length >= 3 ? 1 : v.length === 2 ? 2 : 3, text: plural(v.length, L.noun), sub: v.map((r) => `${r.w} ${esc(r.name)}`).join('<br>') }; };
    }
    return ledger(host('ledger'), { rows: rowsDef, years, cell, corner, selected: state.arYear, emptyText: ledgerMedals ? 'no medalists that season' : 'none that season', onSelect: (y) => setYear(y), onPreview: (y) => { pv = { y, r: null }; paint(); } });
  };
  const paint = () => {
    const listing = ql() && showMatches && pv.y == null;
    const shown = listing ? null : pv.y != null ? pv.y : state.arYear;
    const nIn = (y) => all.filter((r) => r.year === y && inUnit(r)).length, nAll = (y) => all.filter((r) => r.year === y).length;
    if (lg) lg.paint(shown != null ? shown : state.arYear);
    if (mat) mat.paint({ color: cellColor, opacity: cellOpacity, stroke: isMatch, shown, focusMark: pv.r, previewing: pv.y != null,
      top: shown != null ? String(shown) : fmt(all.filter((r) => inUnit(r) && inFocus(r) && (!ql() || isMatch(r))).length), sub: shown != null ? (wholeUnit ? (depth === 'medal' ? (() => { const S = seasonOf(shown, state.cls); const t = S ? (isState ? S.teams[0] : S.teams.filter((x) => x.d === u.d)[0]) : null; return t ? `${t.sch}, ${t.pts} pts` : plural(nAll(shown), 'medal'); })() : plural(nAll(shown), 'champion')) : `${nIn(shown)} ${depth === 'medal' ? 'medal' + (nIn(shown) === 1 ? '' : 's') : 'of ' + nAll(shown)}`) : 'matches' });
    tl.paint(shown != null ? shown : state.arYear);
    card.innerHTML = listing ? matchCard() : seasonCard(shown, pv.r) + (ql() && !showMatches ? '<button type="button" class="linkish back" data-back>Back to the matches</button>' : '');
    range.value = state.arYear;
  };
  const setYear = (y) => { state.arYear = Math.max(a, Math.min(b, y)); showMatches = false; pv = { y: null, r: null }; paint(); };
  if (!ledgerOn) { host('mat').innerHTML = ''; mat = arenaMat(host('mat'), champs, { preview: (y, r) => { pv = { y, r }; paint(); }, select: (y) => setYear(y), label: `${L.nouns} on one mat` }); }
  else lg = buildLedger();
  const tlPts = depth === 'medal' && !wholeUnit ? (() => { const st = unitStats(isSchool ? { kind: 'school', name: u.name } : { kind: 'district', d: u.d }); return new Map(st.seasons.map((x) => [x.year, x])); })() : null;
  tl = timeline(host('tl'), rows, all, { extent: [a, b], color: wholeUnit ? STEEL : uColor, whole: wholeUnit, pts: tlPts });
  paint();
  q.addEventListener('input', () => { state.q = q.value.trim(); showMatches = true; paint(); });
  if (leg) leg.addEventListener('click', (e) => { const bt = e.target.closest('button'); if (!bt) return; state.focus = state.focus === bt.dataset.k ? null : bt.dataset.k; drawLegend(); paint(); });
  range.addEventListener('input', () => setYear(+range.value));
  $view.querySelector('#m-prev').addEventListener('click', () => setYear(state.arYear - 1));
  $view.querySelector('#m-next').addEventListener('click', () => setYear(state.arYear + 1));
  if (!ledgerOn) host('mat').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setYear(state.arYear - 1); e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setYear(state.arYear + 1); e.preventDefault(); } });
  card.addEventListener('click', (e) => { const yb = e.target.closest('[data-year]'); if (yb) setYear(+yb.dataset.year); if (e.target.closest('[data-back]')) { showMatches = true; paint(); } });
  drawLegend();
  if (empty) return;

  /* ---- by weight ---- */
  const toMat = (y) => { tip.hide(); setYear(y); document.getElementById('mat').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  // state: by district (or school). district: by school, at every level. school: its own color.
  const wGroups = isSchool ? [{ k: 'unit', label: u.name, color: uColor, test: inUnit }] : groups.filter((g) => g.k !== 'other' && g.color);
  const restLabel = isSchool ? u.name : isState && !bySchool ? 'Other districts' : 'Other schools';
  if (!isSchool) $view.querySelector('#w-legend').innerHTML = wGroups.map((g) => `<span><i style="background:${g.color}"></i>${g.chip || ''}${g.label}</span>`).join('') + `<span><i style="background:${STEEL_2}"></i>${restLabel}</span>`;
  weightClasses(host('wc'), rows, wGroups, { ref: wholeUnit ? null : all, restColor: isSchool ? uColor : STEEL_2, restLabel, noun: L.title, click: (r) => toMat(r.year), H: 230 });
  if (wholeUnit) fifthsChart(host('fifths'), rows, wGroups, { restColor: STEEL_2, restLabel, noun: L.title, H: 220, composition: true });
  else { const wtF = depth === 'medal' ? (r) => ptsOf(r.place || 1) : () => 1; const poolName = poolWord.charAt(0).toUpperCase() + poolWord.slice(1); fifthBars(host('fifths'), [{ label: poolName, short: poolWord, rows: all, ref: true }, { label: u.name, chip: isSchool ? badge(u.name, 20) : dtag(u.d), rows, href: null }], { wt: wtF, hideRef: true, noun: depth === 'medal' ? 'points' : L.title.toLowerCase() + 's' }); }
  const med = d3.median(rows.filter((r) => r.w !== 'UNL'), (r) => r.wn), medAll = d3.median(all.filter((r) => r.w !== 'UNL'), (r) => r.wn);
  $view.querySelector('#lean').innerHTML = wholeUnit
    ? `The middle ${L.noun} won at <b>${Math.round(med)} lb</b>. Older lineups had more weights in the 125–145 range than today’s, so those classes carry a few extra titles.`
    : `${leanSentence(u.name, rows, all, poolAdv)} The middle ${esc(u.name)} champion won at <b>${Math.round(med)} lb</b>, against ${Math.round(medAll)} lb ${poolAdv}.`;

  /* ---- who ---- */
  const who = $view.querySelector('#who-body');
  const W = wrestlersOf(rows);
  const progBars = (id) => barList(host(id), Array.from(d3.rollup(rows, (v) => v, (r) => r.sch)).map(([sc, v]) => ({ label: sc, school: sc, segs: [{ v: v.length, color: isDistrict ? colorOf(v[0]) : STEEL }], v })).sort((p, q2) => q2.segs[0].v - p.segs[0].v).slice(0, 15), { badge: true, label: 'Programs', tip: (r) => tipHTML(span(r.v.map((x) => x.year)), r.label, plural(r.v.length, L.title), r.label), href: (r) => schoolHref(r.label) });
  if (isState) {
    who.innerHTML = panel('w-d', 'Districts', `${clsName()} titles by district. Click one to open it.`) + panel('w-s', 'Programs', `The 15 schools with the most ${clsName()} titles.`);
    barList(host('w-d'), d3.range(1, 13).map((d) => ({ d, label: `District ${d}`, segs: [{ v: rows.filter((r) => r.d === d).length, color: dColor(d) }] })).sort((p, q2) => q2.segs[0].v - p.segs[0].v), { label: 'Titles by district', tip: (r) => tipHTML(DISTRICTS[r.d], `District ${r.d}: ${r.segs[0].v} titles`, pct1(r.segs[0].v / rows.length) + ' of the state'), href: (r) => '#district-' + r.d });
    progBars('w-s');
  } else if (isDistrict) {
    who.innerHTML = panel('w-s', 'Programs', `District ${u.d} schools ranked by ${L.title}s.`) + `<section class="panel"><h3>Multi-time champions</h3><p class="sub">District ${u.d} wrestlers with two or more ${L.title}s.</p><div data-c="w-m"></div></section>`;
    progBars('w-s');
  } else {
    const best = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.year)).sort((p, q2) => q2[1] - p[1] || q2[0] - p[0])[0];
    const hi = [`<p><b>${plural(rows.length, L.title)}</b>, ${span(rows.map((r) => r.year))}.${best && best[1] > 1 ? ` Best season ${best[0]}, with ${best[1]} champions.` : ''}</p>`];
    if (lv === 'state') {
      const teams = TEAMS.filter((t) => t.sch === u.name);
      if (teams.length) hi.push(`<p><b>AAA team titles:</b> ${teams.sort((p, q2) => p.year - q2.year).map((t) => `${t.year} ${t.type === 'points' ? 'team points' : 'state duals'}${t.tie ? ' (tie)' : ''}`).join(', ')}.</p>`);
      const other = u.s.rows.filter((r) => !inScope(r));
      if (other.length) hi.push(`<p><b>Outside this view:</b> ${d3.rollups(other, (v) => v.length, (r) => r.cls).map(([c, n]) => `${n} ${c === 'single' ? '1938–73' : 'Class ' + c}`).join(', ')} title${other.length === 1 ? '' : 's'}. Use the class switch to see them.</p>`);
    }
    if (levels.length > 1) hi.push(`<p><b>All levels:</b> ${levels.map((k) => `${fmt(levelRows(k).filter(inUnit).length)} ${LEVELS[k].title}s`).join(', ')}. Switch the level at the top of the page.</p>`);
    who.innerHTML = `<section class="panel"><h3>Wrestlers</h3><p class="sub">Every ${esc(u.name)} ${L.noun}, most titles first.</p><div data-c="w-m"></div></section><section class="panel"><h3>Highlights</h3><div class="prose">${hi.join('')}</div></section>`;
  }
  if (!isState) {
    const m = (isSchool ? W : W.filter((w) => w.n >= 2)).map((w) => ({ name: w.name, school: w.school, n: w.n, titles: w.titles, best: w.best, years: w.rows.map((r) => r.year + (depth === 'medal' && r.place > 1 ? ' (' + ordinal(r.place) + ')' : '')).join(', '), weights: w.rows.map((r) => r.w).join(', ') }));
    const cols = [{ key: 'name', label: 'Wrestler' }].concat(isSchool ? [] : [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }]).concat(depth === 'medal' ? [{ key: 'n', label: 'Medals', num: true, render: (r) => `<b class="score">${r.n}</b>` }, { key: 'titles', label: 'Titles', num: true }, { key: 'best', label: 'Best', num: true, render: (r) => ordinal(r.best) }] : [{ key: 'n', label: 'Titles', num: true, render: (r) => `<b class="score">${r.n}</b>` }]).concat([{ key: 'years', label: 'Seasons' }, { key: 'weights', label: 'Weights' }]);
    if (m.length) sortableTable(host('w-m'), cols, m, { sort: 'n', maxH: '420px' }); else host('w-m').innerHTML = `<p class="empty">No multi-time ${L.nouns}.</p>`;
  }

  /* ---- every champion ---- */
  const list = rows.map((r) => ({ year: r.year, w: r.w, wn: r.wn, name: r.name, school: r.school, d: r.d, cls: r.cls, place: r.place || 1 }));
  const cols = [{ key: 'year', label: 'Season', num: true, render: (r) => `${r.year}${r.cls === 'single' && state.cls !== 'single' ? ' ' + clsPill('single') : ''}` }, { key: 'wn', label: 'Weight', num: true, render: (r) => esc(r.w) }].concat(depth === 'medal' ? [{ key: 'place', label: 'Place', num: true, render: (r) => `<b class="score">${ordinal(r.place)}</b>` }] : []).concat([{ key: 'name', label: depth === 'medal' ? 'Medalist' : 'Champion' }])
    .concat(isSchool ? [] : [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }]).concat(isState ? [{ key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }] : []);
  const tbl = sortableTable(host('every'), cols, list, { sort: 'year', maxH: '520px' });
  if (depth === 'medal') $view.querySelector('#every-tab h2 span').textContent = 'Every medalist';
  $view.querySelector('#e-q').addEventListener('input', (e) => { const v = e.target.value.toLowerCase(); tbl.redraw(list.filter((r) => r.name.toLowerCase().includes(v) || r.school.toLowerCase().includes(v))); });
  if (isDistrict && u.d === 11 && state.cls === 'AAA') d11Draw();
}

/* the timeline under the mat: seasons across, a tick for every title, the open season marked */
function timeline(h, rows, all, opts) {
  const [a, b] = opts.extent; const years = d3.range(a, b + 1);
  const W = widthOf(h), H = 44, left = 8, right = 8;
  const x = d3.scaleBand(years, [left, W - right]).paddingInner(0.25);
  const by = opts.pts ? new Map(Array.from(opts.pts, ([y, s]) => [y, s.pts])) : d3.rollup(rows, (v) => v.length, (r) => r.year);
  const max = d3.max(by.values()) || 1;
  const svg = svgIn(h, W, H, 'Seasons');
  svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', 30.5).attr('y2', 30.5).attr('stroke', STEEL_2);
  svg.append('g').selectAll('rect').data(years).join('rect').attr('x', (y) => x(y)).attr('width', x.bandwidth()).attr('y', (y) => 30 - (by.get(y) ? (opts.whole ? 14 : 6 + 20 * (by.get(y) / max)) : 2)).attr('height', (y) => (by.get(y) ? (opts.whole ? 14 : 6 + 20 * (by.get(y) / max)) : 2)).attr('fill', (y) => (by.get(y) ? opts.color : STEEL_2)).attr('opacity', (y) => (by.get(y) ? 0.9 : 0.6));
  const cur = svg.append('rect').attr('y', 2).attr('height', 34).attr('width', Math.max(3, x.bandwidth() + 2)).attr('fill', 'none').attr('stroke', CHALK).attr('stroke-width', 1.5);
  svg.append('g').selectAll('text').data(years.filter((y) => y % (W < 420 ? 20 : 10) === 0)).join('text').attr('class', 'ax').attr('x', (y) => x(y) + x.bandwidth() / 2).attr('y', H - 2).attr('text-anchor', 'middle').text((y) => y);
  return { paint: (y) => { cur.attr('x', x(y) - 1); } };
}

/* ---------------- District 11: how district, regional and state titles connect ---------------- */
function d11Section() {
  return `<section class="sec">${tab('District to state', `District 11 is the one district with its full tournament history here, so every wrestler’s path from district to regional to state can be traced, ${d3.min(D11, (r) => r.year)}–${d3.max(D11, (r) => r.year)}.`)}
    <div class="two">${panel('d11-pipe', 'The path', 'Every District 11 district champion, how many also won the Northeast Regional that season, and how many finished as state champion.')}${panel('d11-conv', 'District champions who also won state', 'Dim bar: district titles. Bright: those that became state titles the same season.')}</div>
    <div class="two">${panel('d11-reg', 'Regional champions by district', '')}${panel('d11-streak', 'Longest runs with a district champion', 'Consecutive seasons in which the school crowned at least one district champion.')}</div>
    <div class="panel"><h3>State champions who did not win districts</h3><p class="sub">District 11 wrestlers who lost, or did not wrestle, at the district tournament and still won the AAA state title.</p><div data-c="d11-snd"></div></div>
  </section>`;
}
function d11Draw() {
  const tot = Array.from(d3.rollup(D11, (v) => v.length, (r) => r.sch)).sort((p, q) => q[1] - p[1]);
  const key = (r) => r.year + '|' + nkey(r.name);
  const rk = new Set(REG.map(key)); const st11 = CH.filter((r) => r.cls === 'AAA' && r.d === 11);
  const sk = new Set(st11.map(key)), dk = new Set(D11.map(key));
  const nReg = D11.filter((r) => rk.has(key(r))).length, nSt = D11.filter((r) => sk.has(key(r))).length;
  barList(host('d11-pipe'), [{ label: 'District champions', segs: [{ v: D11.length, color: STEEL_2 }] }, { label: 'Also won the regional', segs: [{ v: nReg, color: STEEL }], valueLabel: `${fmt(nReg)} (${pct0(nReg / D11.length)})` }, { label: 'Also won state', segs: [{ v: nSt, color: dColor(11) }], valueLabel: `${fmt(nSt)} (${pct0(nSt / D11.length)})` }], { label: 'District to state', rowH: 40 });
  const conv = tot.slice(0, 10).map(([s, n]) => { const dd = D11.filter((r) => r.sch === s && sk.has(key(r))).length; return { label: s, school: s, n, dd, segs: [{ v: dd, color: sColor(s) }, { v: n - dd, color: sColor(s), opacity: 0.25 }], valueLabel: `${pct0(dd / n)} (${dd} of ${n})` }; });
  barList(host('d11-conv'), conv, { badge: true, label: 'District to state conversion', tip: (r) => tipHTML('Same-season district and state titles', r.school, `${r.dd} of ${r.n} district champions also won state`, r.school), href: (r) => schoolHref(r.school) });
  host('d11-reg').insertAdjacentHTML('beforebegin', `<p class="sub" style="margin-top:-6px">District 11 has won <b>${pct0(REGROWS.filter((r) => r.d === 11).length / REGROWS.length)}</b> of the ${fmt(REGROWS.length)} Northeast Regional titles on record. Orange: District 11.</p>`);
  seasonBars(host('d11-reg'), REGROWS, { extent: d3.extent(REGROWS, (r) => r.year), color: (r) => dColor(r.d), order: (p, q) => (q.d === 11) - (p.d === 11), showSchool: true, minMax: 10, label: 'Regional champions by district' });
  const lastY = d3.max(D11, (r) => r.year);
  const streaks = d3.groups(D11, (r) => r.sch).map(([s, rs]) => { const ys = Array.from(new Set(rs.map((r) => r.year))).sort((p, q) => p - q); let best = { n: 0 }, cur = { n: 0 }; ys.forEach((y, i) => { cur = i && y === ys[i - 1] + 1 ? { n: cur.n + 1, from: cur.from, to: y } : { n: 1, from: y, to: y }; if (cur.n > best.n) best = cur; }); return { school: s, ...best, active: best.to === lastY }; }).sort((p, q) => q.n - p.n).slice(0, 8);
  barList(host('d11-streak'), streaks.map((s) => ({ label: s.school, school: s.school, segs: [{ v: s.n, color: sColor(s.school) }], valueLabel: `${s.n} seasons (${s.from}–${s.to}${s.active ? ', active' : ''})` })), { badge: true, label: 'Longest district title streaks', href: (r) => schoolHref(r.school) });
  const snd = st11.filter((r) => !dk.has(key(r))).map((r) => ({ year: r.year, w: r.w, name: r.name, school: r.school }));
  sortableTable(host('d11-snd'), [{ key: 'year', label: 'Season', num: true }, { key: 'w', label: 'Weight' }, { key: 'name', label: 'State champion' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }], snd, { sort: 'year', maxH: '340px' });
}
