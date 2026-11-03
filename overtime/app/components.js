/* Overtime — shared components. Every level page is built from the same pieces. */
'use strict';
(() => {
  const { esc, fmt, ordinal, wShort, state, setCls, clsName, STD, stdOf, placeCounts, unitStats, rankings, allTimeTeams, bracketOf, seasonsInScope, unitRows, GRADE_L, gradeSlot, lowerRows, REGIONS, DISTRICTS, windowLabel, yearsWindow, careerRows, nFilters } = OT;
  const MAP = window.PA_MAP, HX = 65.5, HY = 39.5; // Hershey
  const C = { mat: '#0B0D10', chalk: '#EEEAE1', ash: '#8E98A4', gold: '#D9A441', red: '#FF3B2F', green: '#2EC27E', slate: '#161A20', line: '#242A32' };
  const MED = ['#D9A441', '#B8BFC6', '#B5733A', '#8E5A3C', '#5F6B78', '#5F6B78', '#5F6B78', '#5F6B78'];
  const pc = (p) => (p >= 5 ? 'c5' : 'c' + p);
  const score = (v) => (v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1));

  /* brand */
  const wordmark = () => { const F = 92, R = F * 0.36, cx = 14 + R, cy = 120, a = 35 * Math.PI / 180;
    return `<svg viewBox="0 0 560 170" aria-label="Overtime"><rect x="${cx - R * .16}" y="${cy - R - R * .30}" width="${R * .32}" height="${R * .22}" rx="3" fill="currentColor"/><rect x="${cx - R * .09}" y="${cy - R - R * .12}" width="${R * .18}" height="${R * .14}" fill="currentColor"/><circle cx="${cx}" cy="${cy}" r="${R * .88}" fill="none" stroke="currentColor" stroke-width="${R * .24}"/><path d="M ${cx} ${cy - R * .62} A ${R * .62} ${R * .62} 0 0 1 ${cx + R * .62 * Math.sin(a)} ${cy - R * .62 * Math.cos(a)} L ${cx} ${cy} Z" fill="${C.red}"/><line x1="${cx}" y1="${cy}" x2="${cx + R * .55 * Math.sin(a)}" y2="${cy - R * .55 * Math.cos(a)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/><text x="${cx + R + F * .09}" y="${cy + F * .355}" font-family="'Archivo Black'" font-size="${F}" letter-spacing="-1" fill="currentColor">VERTIME</text></svg>`; };
  const NAVI = {
    state: `<path d="${MAP.outline}" transform="translate(1,4) scale(.245)" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`,
    region: `<path d="M3 13 L13 3 L23 13 L13 23 Z M3 13 H23 M13 3 V23" fill="none" stroke="currentColor" stroke-width="2"/>`,
    district: `<rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="15" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="15" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="15" y="15" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/>`,
    school: `<path d="M3 23 V11 L13 4 L23 11 V23 Z M10 23 V15 H16 V23" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    wrestlers: `<circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13 L13 6 M13 13 L17.5 15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const navIcon = (k) => `<svg viewBox="0 0 26 26" aria-hidden="true">${NAVI[k]}</svg>`;
  /* difficulty glyph: a small mat (filled circle with a thinner inner ring) colored green → red by tier. Never a word; the tier name lives in the title. */
  const TIER_COLORS = [null, '#2EC27E', '#B8C94A', '#F08A24', '#FF3B2F'];
  const tierColor = (tier) => tier ? TIER_COLORS[Math.max(1, Math.min(4, Math.round(tier)))] : null;
  const bandIcon = (tier, h = 12, extra = '') => { if (!tier) return ''; const t = Math.max(1, Math.min(4, Math.round(tier))); const col = TIER_COLORS[t], r = h / 2;
    return `<svg class="band" width="${h}" height="${h}" viewBox="0 0 ${h} ${h}" role="img" aria-label="Field strength ${t} of 4"><title>${OT.TIER_NAMES[t]} field${extra ? ' · ' + extra : ''}</title><circle cx="${r}" cy="${r}" r="${r}" fill="${col}"/><circle cx="${r}" cy="${r}" r="${r * 0.58}" fill="none" stroke="${C.mat}" stroke-width="${Math.max(1, h / 9)}" opacity=".85"/></svg>`; };
  const fieldTip = (r) => { const f = OT.fieldInfo(r.year, r.cls, r.w); return f && f.top.length ? 'in the bracket: ' + f.top.map((t) => t.name).join(', ') : ''; };
  const bandFor = (r, h = 12) => bandIcon(OT.fieldOf(r), h, fieldTip(r));
  const classToggle = () => `<div class="seg" role="group" aria-label="Class">${['AAA', 'AA', 'ALL'].map((k) => `<button data-cls="${k}" aria-pressed="${state.cls === k}">${k === 'ALL' ? 'All' : k}</button>`).join('')}</div>`;
  /* time window: all-time, last 5 / 10 / 25 seasons, or a custom range */
  const windowToggle = () => { const w = state.win, [a, b] = yearsWindow();
    return `<div class="win"><div class="seg" role="group" aria-label="Seasons">${[['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25'], ['custom', 'Custom']].map(([k, l]) => `<button data-win="${k}" aria-pressed="${w.mode === k}">${l}</button>`).join('')}</div>${w.mode === 'custom' ? `<form class="wrange" data-wrange><input type="number" name="from" inputmode="numeric" min="1938" max="2026" value="${a}" aria-label="From"><span>–</span><input type="number" name="to" inputmode="numeric" min="1938" max="2026" value="${b}" aria-label="To"><button type="submit" class="go">Go</button></form>` : ''}</div>`; };
  /* header chips: the current selections, each one opens the control panel */
  const filterChips = () => { const f = state.f, out = [];
    if (f.weights.length) out.push(f.weights.length === 1 ? STD.find((s) => s.k === f.weights[0]).label + ' lbs' : f.weights.length + ' weights');
    if (f.regions.length) out.push(f.regions.length === 1 ? REGIONS[f.regions[0]] : f.regions.length + ' regions');
    if (f.districts.length) out.push(f.districts.length === 1 ? 'District ' + f.districts[0] : f.districts.length + ' districts');
    if (f.schools.length) out.push(f.schools.length === 1 ? f.schools[0] : f.schools.length + ' schools');
    return out; };
  const headerChips = () => { const fc = filterChips(); const n = nFilters();
    const ic = `<button class="hc ic${n ? ' on' : ''}" data-panel="filters" aria-label="Filters" title="Filters"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>${n ? `<b>${n}</b>` : ''}</button>`;
    const main = `<button class="hc" data-panel="class">${state.cls === 'ALL' ? 'All classes' : state.cls}</button><button class="hc" data-panel="window">${state.win.mode === 'all' ? 'All-time' : windowLabel()}</button>${fc.map((t) => `<button class="hc on" data-panel="filters">${esc(t)}</button>`).join('')}${state.adj ? `<button class="hc on" data-panel="adjust" title="Points adjusted for field strength">Adjusted</button>` : ''}`;
    return (window.innerWidth || 390) < 720 ? ic + main : main + ic; };
  /* the control panel: class, window, multi-select filters */
  const fchip = (kind, v, label, on) => `<button class="fc${on ? ' on' : ''}" data-f="${kind}" data-v="${esc(String(v))}" aria-pressed="${on}">${label}</button>`;
  function panel(q = '') {
    const f = state.f;
    const schools = Array.from(OT.SCHOOL_D.keys()).sort();
    const ql = q.trim().toLowerCase(); const hits = ql ? schools.filter((s) => s.toLowerCase().includes(ql)).slice(0, 12) : [];
    return `<div class="pbar"><b>Scope</b><span><button class="pclr" data-clear-all>Clear all</button><button class="pdone" data-panel-close>Done</button></span></div>
      <div class="pg" id="pg-class"><div class="k">Class</div>${classToggle()}</div>
      <div class="pg" id="pg-window"><div class="k">Seasons</div>${windowToggle()}</div>
      <div class="pg" id="pg-adjust"><div class="k">Difficulty</div><label class="sw"><input type="checkbox" data-adjust ${state.adj ? 'checked' : ''}><span class="tr"></span><span>Adjust points for field strength <small class="muted">× 0.88 / 0.96 / 1.04 / 1.12 by tier ${bandIcon(1, 10)} ${bandIcon(2, 10)} ${bandIcon(3, 10)} ${bandIcon(4, 10)}</small></span></label></div>
      <div class="pg" id="pg-filters"><div class="k">Weights${f.weights.length ? ` <button class="pclr" data-clear="weights">clear</button>` : ''}</div><div class="fcs">${STD.map((s) => fchip('weights', s.k, s.label, f.weights.includes(s.k))).join('')}</div></div>
      <div class="pg"><div class="k">Regions${f.regions.length ? ` <button class="pclr" data-clear="regions">clear</button>` : ''}</div><div class="fcs">${OT.regionOrder().map((r) => fchip('regions', r, REGIONS[r], f.regions.includes(r))).join('')}</div></div>
      <div class="pg"><div class="k">Districts${f.districts.length ? ` <button class="pclr" data-clear="districts">clear</button>` : ''}</div><div class="fcs">${d3.range(1, 13).map((d) => fchip('districts', d, 'D' + d, f.districts.includes(d))).join('')}</div></div>
      <div class="pg"><div class="k">Schools${f.schools.length ? ` <button class="pclr" data-clear="schools">clear</button>` : ''}</div>${f.schools.length ? `<div class="fcs">${f.schools.map((s) => fchip('schools', s, esc(s) + ' ×', true)).join('')}</div>` : ''}<input class="search psearch" id="psearch" type="search" placeholder="Add a school" value="${esc(q)}" autocomplete="off" aria-label="Search schools">${hits.length ? `<div class="fcs">${hits.map((s) => fchip('schools', s, esc(s), f.schools.includes(s))).join('')}</div>` : ''}</div>`;
  }

  /* unit header + hero numbers */
  function unitHeader(u, o, extra = {}) {
    const hero = extra.hero || [['Medals', o.medals], ['Titles', o.titles], ['Qualifiers', o.quals], u.kind === 'school' ? ['Team titles', o.won] : ['Reg. titles', o.regTitles]];
    return `<header class="uh">
      <div><h1>${esc(u.name)}</h1>${extra.sub ? `<div class="sub">${extra.sub}</div>` : ''}</div>
      <div class="hero">${hero.map(([l, v]) => `<div><b>${v == null ? '–' : fmt(v)}</b><span>${l}</span></div>`).join('')}</div>
    </header>`;
  }
  const section = (title, body, right = '') => `<section class="sec"><div class="k"><span>${title}</span>${right ? `<span>${right}</span>` : ''}</div>${body}</section>`;
  const empty = (msg) => `<div class="card empty">${msg}</div>`;

  /* the Bracket: every child unit is one line, seeded by state points, converging toward Hershey. Same component at every level. */
  function bracket(u, crumbs = [], mode, showAll) {
    const { items } = bracketOf(u, mode);
    const crumbBar = `<div class="fcrumb">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.name)}</a><span>›</span>` : `<b>${esc(c.name)}</b>`)).join('')}</div>`;
    const toggle = u.kind === 'state' ? `<div class="seg sm" data-bracket="1"><button data-mode="region" aria-pressed="${mode !== 'district'}">Regions</button><button data-mode="district" aria-pressed="${mode === 'district'}">Districts</button></div>`
      : u.kind === 'school' ? `<div class="seg sm" data-bracket="1"><button data-mode="wrestler" aria-pressed="${mode !== 'weight'}">Wrestlers</button><button data-mode="weight" aria-pressed="${mode === 'weight'}">Weights</button></div>` : '';
    if (!items.length) return crumbBar + empty('No placements in ' + clsName().toLowerCase() + ' for ' + windowLabel() + '.');
    const LIM = 16, show = showAll || items.length <= LIM ? items : items.slice(0, LIM), n = show.length;
    const phone = (window.innerWidth || 390) < 720, RH = phone ? 44 : 40, BW = phone ? 64 : 120, H = n * RH, maxShare = show[0].share || 1;
    // bracket joins: pair consecutive lines round by round until one line reaches Hershey
    const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, n)))), step = (BW - 22) / rounds;
    let ys = show.map((_, i) => i * RH + RH / 2), paths = [];
    for (let k = 0; k < rounds; k++) {
      const x0 = k * step, x1 = (k + 1) * step, next = [];
      for (let i = 0; i < ys.length; i += 2) {
        const a = ys[i], b = ys[i + 1];
        if (b == null) { paths.push(`M${x0} ${a} H${x1}`); next.push(a); continue; }
        const m = (a + b) / 2; paths.push(`M${x0} ${a} H${x1} V${b} H${x0}`); paths.push(`M${x1} ${m} H${x1 + 0.01}`); next.push(m);
      }
      ys = next;
    }
    const fy = ys[0], fx = rounds * step; paths.push(`M${fx} ${fy} H${BW - 20}`);
    const hershey = `<circle cx="${BW - 10}" cy="${fy}" r="7.5" fill="none" stroke="${C.chalk}" stroke-width="2.4"/><circle cx="${BW - 10}" cy="${fy}" r="2.4" fill="${C.red}"/>`;
    const label = `<text transform="translate(${BW - 22} ${Math.min(H - 60, fy + 14)}) rotate(90)" text-anchor="start" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing="2" fill="${C.ash}">HERSHEY</text>`;
    const svg = `<svg class="bj" width="${BW}" height="${H}" viewBox="0 0 ${BW} ${H}" aria-hidden="true"><path d="${paths.join(' ')}" fill="none" stroke="${C.ash}" stroke-width="1" opacity=".8"/>${hershey}${phone ? '' : label}</svg>`;
    const rowsHtml = show.map((it, i) => { const tag = it.href ? 'a' : 'div'; const sh = it.share >= 0.1 ? (100 * it.share).toFixed(0) + '%' : (100 * it.share).toFixed(1) + '%';
      return `<${tag} class="bl" ${it.href ? `href="${it.href}" data-bl="1"` : ''} style="height:${RH}px"><span class="sd${i === 0 ? ' s1' : ''}">${it.seed}</span><span class="nm"><b>${esc(it.name)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span><span class="br"><i style="width:${Math.max(3, 100 * it.share / maxShare)}%"></i></span><span class="sh">${sh}</span></${tag}>`; }).join('');
    const more = items.length > LIM ? `<button class="more" data-bracket-all="${showAll ? '0' : '1'}">${showAll ? 'Show top 16' : `Show all ${items.length}`}</button>` : '';
    return `${crumbBar}<div class="bracket card" title="Seeded by state points · follow a line toward Hershey">${toggle ? `<div class="btop">${toggle}</div>` : ''}<div class="bls">${rowsHtml}</div>${svg}${more ? `<div class="bmore">${more}</div>` : ''}</div>`;
  }

  /* rankings table */
  const COLS = ['Rank', 'Name', 'Era', 'Power', 'Score', 'Medals', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  function rankTable(rows, opts = {}) {
    if (!rows.length) return empty(opts.emptyMsg || 'Nothing here in ' + clsName().toLowerCase() + '.');
    const lim = opts.limit || 25;
    const X = opts.extra; // optional extra column {label, key, cell(o)} placed after Medals; header is a sort control when opts.sortKey is set
    const body = rows.slice(0, lim).map((o, i) => { const u = o.u || o; const name = opts.name ? opts.name(o) : esc(u.name); let sub = opts.sub ? opts.sub(o) : ''; if (o.offMedals) sub += `${sub ? ' · ' : ''}incl. ${o.offMedals} ${o.offCls} medal${o.offMedals === 1 ? '' : 's'} at ${Math.round(100 * o.offClass)}%`;
      return `<tr><td class="rk sticky1">${i + 1}</td><td class="l sticky2"><a href="${u.href || o.href}">${name}</a>${sub ? `<small class="muted"> ${sub}</small>` : ''}</td><td class="num">${score(o.era)}</td><td class="num">${score(o.power)}</td><td class="num">${fmt(Math.round(o.pts))}</td><td class="num">${fmt(o.medals)}</td>${X ? `<td class="num xc">${X.cell(o)}</td>` : ''}${o.places.map((n, k) => `<td class="num p${n ? Math.min(k + 1, 5) : 0}">${n || '·'}</td>`).join('')}</tr>`; }).join('');
    const more = rows.length > lim ? `<div class="note">Showing ${lim} of ${rows.length}. ${opts.moreHref ? `<a href="${opts.moreHref}">See all</a>` : ''}</div>` : '';
    const cols = X ? COLS.slice(0, 6).concat([X.label]).concat(COLS.slice(6)) : COLS;
    const th = (c, i) => { const sortable = opts.sortKey && (c === 'Score' || (X && c === X.label)); const key = c === 'Score' ? 'pts' : X && c === X.label ? X.key : null; const on = sortable && opts.sortKey === key;
      return `<th class="${i < 2 ? 'l ' : ''}${i === 0 ? 'sticky1' : i === 1 ? 'sticky2' : ''}${sortable ? ' sortable' : ''}${on ? ' on' : ''}"${sortable ? ` data-sort="${key}" role="button" tabindex="0" title="Sort by ${c}"` : ''}>${c}${on ? ' ▾' : ''}</th>`; };
    return `<div class="tw"><table><thead><tr>${cols.map(th).join('')}</tr></thead><tbody>${body}</tbody></table></div>${more}
      <div class="note">${opts.note || `Era: share of all state points, summed across every season (×100). Power: the same with a 7-season half-life. Score: placement points, 16-12-9-7-5-3-2-1${state.adj ? ', adjusted for field strength (× 0.88–1.12 by tier)' : ''}. A school's seasons in the other class count at 85%. Window: ${windowLabel()}.`}</div>`;
  }
  /* wrestler rows as rankings (Score, Medals, places); Era/Power shown as career share */
  function wrestlerRank(rows, opts = {}) {
    const ws = OT.wrestlersOf(opts.prepared ? rows.filter((r) => r.place) : careerRows(rows.filter((r) => r.place)).filter((r) => r.place)); if (!ws.length) return empty('No placewinners in ' + clsName().toLowerCase() + '.');
    const tot = (opts.prepared ? d3.sum(Array.from(new Set(rows.filter((r) => r.place).map((r) => r.lvl + '|' + r.year + '|' + (r.lvl === 'district' ? r.d : r.region)))), (k) => { const [l, y, c] = k.split('|'); return OT.lowerAvail(l, +y, l === 'district' ? +c : c); }) : d3.sum(seasonsInScope(), (S) => S.avail)) || 1;
    const [, last] = OT.yearsInScope();
    const sortKey = state.wsort === 'field' ? 'field' : 'pts';
    const list = ws.map((w) => ({ ...w, u: { name: w.name, href: w.href }, era: 100 * w.pts / tot * 100, power: 100 * d3.sum(w.rows, (r) => OT.apts(r) * Math.pow(0.5, (last - r.year) / 7)) / tot * 100 }))
      .sort((a, b) => sortKey === 'field' ? ((b.field || 0) - (a.field || 0) || b.pts - a.pts) : (b.pts - a.pts || b.titles - a.titles));
    return rankTable(list, { limit: opts.limit || 25, note: opts.note, sub: (o) => (opts.school ? '' : esc(o.sch)) + ' ' + o.years, moreHref: opts.moreHref, sortKey,
      extra: { label: 'Field', key: 'field', cell: (o) => o.field ? bandIcon(o.field, 12, `average over ${o.apps.length} bracket${o.apps.length === 1 ? '' : 's'}`) : '·' } });
  }

  /* all-time teams */
  function teamsBlock(rows, opts = {}) {
    const T = allTimeTeams(opts.prepared ? rows.filter((r) => r.place) : careerRows(rows.filter((r) => r.place)).filter((r) => r.place), 3); if (!T.length) return empty('No placewinners yet.');
    return `<div class="teams"><div class="thead"><span></span><span>1ST TEAM</span><span>2ND TEAM</span><span>3RD TEAM</span></div>${T.map(({ c, slots }) => `<div class="trow"><div class="w">${c.label}</div>${slots.map((s, i) => s ? `<div class="slot t${i + 1}"><a href="${s.href}"><b>${esc(s.name)}</b><small>${esc(s.sch)} · ${s.years}</small></a><span class="pl">${s.rows.map((r) => `<a class="yr" href="${OT.bhref(OT.bkey(r))}" title="${ordinal(r.place)} ${r.year} · open the bracket"><i style="background:${MED[r.place - 1]}"></i>${String(r.year).slice(2)}</a>`).join('')}${bandIcon(OT.avgTier(s.rows), 9, 'average over the seasons at this weight')}</span></div>` : '<div class="slot none"></div>').join('')}</div>`).join('')}</div>
      <div class="note">${opts.note || 'Best career at each weight by placement points. A wrestler can hold a slot at every weight he placed at, but never two slots on the same team. Anyone who placed in the window is in; his whole career counts.'}</div>`;
  }

  /* seasons drawer */
  function seasonsDrawer(u) {
    const S = seasonsInScope().map((s) => ({ S: s, t: u.kind === 'state' ? { pts: s.avail, titles: s.lineup.length, n: s.meds.length, rows: s.rows, score: null } : s.by[u.kind].get(u.id) })).filter((x) => x.t).reverse();
    if (!S.length) return empty('No seasons in scope.');
    const rows = S.map(({ S: s, t }) => {
      const champ = s.champion; const label = u.kind === 'school' ? (t.realRank ? ordinal(t.realRank) + ' as a team' : ordinal(t.rank) + ' by points') : u.kind === 'state' ? (champ ? esc(champ.id) + (s.real ? ` ${champ.score}` : '') : '') : (t.rows[0] ? esc(t.rows.filter((r) => r.place === 1).map((r) => r.name).slice(0, 2).join(', ')) || '–' : '–');
      const n = `${t.n || 0} medal${t.n === 1 ? '' : 's'}${t.titles ? ` · ${t.titles} title${t.titles === 1 ? '' : 's'}` : ''}`;
      const pod = t.rows.filter((r) => r.place).sort((a, b) => a.slot - b.slot || a.place - b.place);
      const byW = d3.groups(pod, (r) => r.w);
      const podium = `<div class="podium" hidden>${byW.map(([w, rs]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(rs[0]))}" title="open the ${s.year} ${wShort(w)} bracket">${wShort(w)} ${bandFor(rs[0], 10)}</a><div class="ps">${rs.map((r) => `<span><i style="color:${MED[r.place - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}</div>`;
      const rband = u.kind === 'region' && s.cls !== 'single' ? bandIcon(OT.regionTier(s.year, s.cls, u.id), 12, 'region strength that season: share of state medal points over share of qualifiers') : '';
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${s.year}</span><span class="c">${label}</span><span class="n">${rband ? rband + ' ' : ''}${n}</span></div>${podium}`;
    }).join('');
    const first = S[S.length - 1].S.year, last = S[0].S.year;
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${S.length}</b> <span class="muted">seasons · ${first}–${last}</span></span><span class="k">Open</span></summary><div class="body">${rows}</div></details>`;
  }

  /* lower-level dominance (district / regional brackets): the unit's own tournament results, never mixed with state */
  function lowerSeasons(u, lvl, rows, teams) {
    const champs = d3.group(teams.filter((t) => t.place === 1), (t) => t.year), mine = u.kind === 'school' ? d3.group(teams, (t) => t.year) : null;
    const years = Array.from(new Set(rows.map((r) => r.year).concat(teams.map((t) => t.year)))).sort((a, b) => b - a);
    if (!years.length) return empty('No seasons on file.');
    const body = years.map((y) => { const rs = rows.filter((r) => r.year === y && r.place); const ch = champs.get(y) || []; const me = mine && mine.get(y);
      const label = u.kind === 'school' ? (me && me.length ? `${ordinal(me[0].place)} as a team · ${me[0].pts}` : rs.length ? `${rs.filter((r) => r.place === 1).length} title${rs.filter((r) => r.place === 1).length === 1 ? '' : 's'}` : '–') : ch.length ? ch.map((t) => `${esc(t.sch)}${u.kind === 'region' || /_|-/.test(t.unit) ? ` <span class="muted">${esc(OT.unitLabel(lvl, t.unit).replace(/^District \d+ ?/, ''))}</span>` : ''} ${t.pts}`).join(' · ') : '–';
      const byW = d3.groups(rs.sort((a, b) => a.wn - b.wn || a.place - b.place), (r) => r.unit + '|' + r.w);
      const podium = `<div class="podium" hidden>${byW.map(([k, v]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(v[0]))}" title="open the ${y} ${wShort(v[0].w)} bracket">${wShort(v[0].w)}${byW.some(([k2]) => k2 !== k && k2.split('|')[1] === v[0].w) ? ` <small class="muted">${esc(OT.unitLabel(lvl, v[0].unit).replace(/^District \d+ ?/, ''))}</small>` : ''} ${bandFor(v[0], 10)}</a><div class="ps">${v.map((r) => `<span><i style="color:${MED[Math.min(r.place, 8) - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}</div>`;
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${y}</span><span class="c">${label}</span><span class="n">${rs.length} medal${rs.length === 1 ? '' : 's'}</span></div>${podium}`; }).join('');
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${years.length}</b> <span class="muted">seasons · ${years[years.length - 1]}–${years[0]}</span></span><span class="k">Open</span></summary><div class="body">${body}</div></details>`;
  }
  function lowerBlock(u, lvl) {
    const title = lvl === 'district' ? 'District results' : 'Regional results';
    const rows = OT.lowerUnitRows(u, lvl), teams = OT.lowerTeamRows(u, lvl), cov = OT.lowerCoverage(u, lvl);
    if (!rows.length) return section(title, empty(cov.n ? `No ${lvl} medals for ${esc(u.name)} in this scope.` : `The archive has no ${lvl} brackets for ${esc(u.name)}${state.cls !== 'ALL' ? ' in ' + clsName() : ''}.`));
    const o = OT.lowerStats(u, lvl, rows); const tt = u.kind === 'school' ? teams.filter((t) => t.place === 1).length : null;
    const hero = `<div class="hero" style="margin:0 0 12px">${[['Medals', o.medals], ['Titles', o.titles], u.kind === 'school' ? ['Team titles', tt] : ['Tournaments', cov.n], ['Seasons', cov.first ? `${cov.first}–${cov.last}` : '–']].map(([l, v]) => `<div><b>${typeof v === 'number' ? fmt(v) : v}</b><span>${l}</span></div>`).join('')}</div>`;
    const kind = u.kind === 'region' && state.lchild === 'district' ? 'district' : 'school';
    const toggle = u.kind === 'region' ? `<div class="tbar" style="margin-bottom:10px"><div class="seg sm"><button data-lkind="school" aria-pressed="${kind === 'school'}">Schools</button><button data-lkind="district" aria-pressed="${kind === 'district'}">Districts</button></div></div>` : '';
    const note = `Era: share of the ${lvl === 'district' ? "district's" : "region's"} ${lvl} points, summed across seasons (×100). Power: the same with a 7-season half-life. Score: ${lvl} placement points, 16-12-9-7-5-3-2-1${state.adj ? ', adjusted for field strength' : ''}. From ${lvl} brackets only; nothing here mixes with state results. ${cov.n} tournament${cov.n === 1 ? '' : 's'} on file${cov.first ? `, ${cov.first}–${cov.last}` : ''}.`;
    const rank = u.kind === 'school' ? wrestlerRank(rows, { school: true, limit: 20, prepared: true, note }) : rankTable(OT.lowerRankings(u, lvl, kind), { limit: 20, note, sub: kind === 'school' && u.kind !== 'district' ? (x) => 'D' + (x.rows[0] && x.rows[0].d || '') : null });
    const teamsN = `Best ${lvl} career at each weight by placement points, from ${lvl} brackets only.`;
    return section(title, hero + toggle + rank) + section(`All-time ${lvl} teams`, teamsBlock(rows, { prepared: true, note: teamsN })) + section(`${lvl === 'district' ? 'District' : 'Regional'} seasons`, lowerSeasons(u, lvl, rows, teams));
  }

  /* medal chips */
  const chips = (places) => places.map((n, i) => n ? `<span class="chip ${pc(i + 1)}" title="${n} × ${ordinal(i + 1)}">${n}×${i + 1}</span>` : '').join('');
  /* wrestler card: school-colored stripe + badge, name, district/region icons, then the career matrix (D/R/S × FR–SR) in small pills */
  const LVL_ICON = { district: 'district', regional: 'region', state: 'state' };
  const wrestlerCard = (w) => {
    const id = OT.SB && OT.SB.identity(w.sch); const p1 = (id && id.primary) || '#5F6B78', p2 = (id && id.secondary) || '#EEEAE1';
    const badge = OT.SB ? OT.SB.svg(w.sch, { size: 34, variant: 'chip', title: false }) : '';
    const reg = (OT.schoolRegion && OT.schoolRegion(w.sch)) || '';
    const M = careerCells(w.apps, w.lower);
    return `<a class="wc" href="${w.href}" style="--p1:${p1};--p2:${p2}">
      <span class="badge">${badge}</span>
      <span class="who"><b>${esc(w.name)}</b><small>${esc(w.sch)} · ${w.years}</small></span>
      <span class="where"><span title="District ${w.d}">${navIcon('district')}${w.d}</span>${reg ? `<span title="${esc(OT.REGIONS[reg] || reg)} Region">${navIcon('region')}${esc(reg)}</span>` : ''}</span>
      <span class="cm"><span></span>${M.cols.map((c, i) => `<span class="ch">${c ? `<b>${String(c.year).slice(2)} ${bandFor(c, 9)}</b><i>${wShort(c.w)}</i>` : `<b>${GRADE_L[i]}</b><i>·</i>`}</span>`).join('')}
        ${M.rows.map((r) => `<span class="rl" title="${r.l}">${navIcon(LVL_ICON[r.k])}</span>${r.cells.map((c) => cellHTML(c, 'pill')).join('')}`).join('')}</span></a>`;
  };

  /* career grid */
  /* career matrix: 3 levels × 4 grade slots. Each cell: null | {place, q, pend, year, w, src} */
  function careerCells(apps, lowerIn) {
    const low = lowerIn || OT.lowerFor(apps);
    const years = Array.from(new Set(apps.map((a) => a.year).concat(low.map((r) => r.year)))).sort((a, b) => a - b);
    const pseudo = years.map((y) => apps.find((a) => a.year === y) || { ...(low.find((r) => r.year === y && r.grade) || low.find((r) => r.year === y)), year: y, pseudo: true });
    const slotOf = (g) => pseudo.find((p) => gradeSlot(p, pseudo) === g);
    const higher = (lvl, y) => (lvl === 'district' ? apps.some((a) => a.year === y) || low.some((r) => r.lvl === 'regional' && r.year === y) : apps.some((a) => a.year === y));
    const cell = (lvl, g) => {
      const p = slotOf(g); if (!p) return null;
      const s = apps.find((a) => a.year === p.year); const base = { year: p.year, w: p.w, r: s || p };
      if (lvl === 'state') return s ? (s.place ? { ...base, place: s.place } : { ...base, q: true }) : { ...base, none: true };
      const r = low.find((x) => x.lvl === lvl && x.year === p.year);
      if (r) return { ...base, r, w: r.w, place: r.place };
      if (!higher(lvl, p.year)) return { ...base, none: true };
      const cls = s ? s.cls : p.cls; const unit = lvl === 'district' ? (s ? s.d : p.d) : (s ? (s.region || OT.regionOf(s, cls === 'single' ? s.k : cls)) : p.region);
      const only = OT.lowerSrc(lvl, p.year, cls, unit);
      if (only) return { ...base, pend: true, src: only === 'wpial' ? 'only the WPIAL champion is on record for this year' : 'only the District III champion is on record for this year' };
      if (OT.lowerCovered(lvl, p.year, cls, unit)) return { ...base, q: true, src: 'advanced without a recorded place' };
      if (lvl === 'regional' && s && p.year >= 1951 && s.reg) return { ...base, place: s.reg, src: 'from the state seed; no regional file' };
      if (lvl === 'district' && s && p.year < 1951 && s.dist) return { ...base, place: s.dist, src: 'from the state seed; no district file' };
      return { ...base, pend: true };
    };
    return { cols: [0, 1, 2, 3].map(slotOf), rows: [['district', 'District'], ['regional', 'Regional'], ['state', 'State']].map(([k, l]) => ({ k, l, cells: [0, 1, 2, 3].map((g) => cell(k, g)) })) };
  }
  const cellHTML = (c, cls, band, href) => {
    const tag = href ? 'a' : 'div', hr = href ? ` href="${href}"` : '';
    if (!c || c.none) return `<div class="${cls}"></div>`;
    const tier = band && c.r ? OT.fieldOf(c.r) : null, col = tierColor(tier);
    const edge = col ? ` style="box-shadow:inset 0 4px 0 ${col}"` : '';
    const b = band && c.r && tier ? `<span class="cb">${bandFor(c.r, 9)}</span>` : '';
    if (c.place) return `<${tag}${hr} class="${cls} ${pc(c.place)}"${edge} title="${c.year} · ${wShort(c.w)}${c.src ? ' · ' + c.src : ''}${href ? ' · open the bracket' : ''}">${c.place}${b}</${tag}>`;
    if (c.pend) return `<${tag}${hr} class="${cls} pend" title="${c.year} · ${c.src || 'no bracket file on the archive for this tournament'}${href ? ' · open what is on record' : ''}">Q</${tag}>`;
    return `<${tag}${hr} class="${cls} cq"${edge} title="${c.year} qualifier${href ? ' · open the bracket' : ''}">Q${b}</${tag}>`;
  };
  function careerGrid(W) {
    const M = careerCells(W.apps, W.lower);
    return `<div class="cg"><div></div>${GRADE_L.map((g, i) => `<div class="k h">${g}${M.cols[i] ? `<small>${M.cols[i].year} · ${wShort(M.cols[i].w)}</small>` : ''}</div>`).join('')}${M.rows.map((r) => `<div class="k lab">${r.l}</div>${r.cells.map((c) => cellHTML(c, 'cell', true, c && !c.none && !c.pend ? OT.bhref(OT.bkey(c.r, r.k)) : null)).join('')}`).join('')}</div>
      <div class="note">Tap any season to open that tournament's bracket. The colored edge is the strength of that bracket, green (open) to red (gauntlet), from what its entrants did at the next levels and in other seasons. An outlined Q is a tournament he came through without a recorded place; a dashed Q means the archive has no file for it.</div>`;
  }

  /* road to Hershey: one season as a line across the state */
  function road(r, W) {
    const s = 3, X = 6, Y = 10; const P = (x, y) => [X + x * s, Y + y * s];
    const d0 = MAP.dot[r.d] || [30, 30]; const [dx, dy] = P(d0[0], d0[1]), [hx, hy] = P(HX, HY);
    const rx = dx + (hx - dx) * 0.5, ry = Math.min(dy, hy) - 14;
    const placed = !!r.place, reg = r.reg;
    return `<svg viewBox="0 0 320 190" role="img" aria-label="${r.year} road to Hershey"><g transform="translate(${X},${Y}) scale(${s})"><path d="${MAP.outline}" fill="${C.slate}" stroke="${C.ash}" stroke-width=".45" stroke-linejoin="round"/></g>
      <path d="M${dx} ${dy} Q ${(dx + rx) / 2} ${dy + 6} ${rx} ${ry}" fill="none" stroke="${C.gold}" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
      <path d="M${rx} ${ry} Q ${(rx + hx) / 2} ${ry - 10} ${hx} ${hy}" fill="none" stroke="${C.gold}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="${dx}" cy="${dy}" r="7" fill="${C.mat}" stroke="${C.gold}" stroke-width="2.5"/>
      <circle cx="${rx}" cy="${ry}" r="7" fill="${reg ? C.gold : C.mat}" stroke="${C.gold}" stroke-width="2.5"/>${reg ? `<text x="${rx}" y="${ry + 4}" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="10" fill="${C.mat}">${reg}</text>` : ''}
      <circle cx="${hx}" cy="${hy}" r="15" fill="${C.gold}"/><circle cx="${hx}" cy="${hy}" r="10" fill="${C.mat}"/><circle cx="${hx}" cy="${hy}" r="6" fill="${placed ? MED[r.place - 1] : C.red}"/>${placed ? `<text x="${hx}" y="${hy + 3.6}" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="9" fill="${C.mat}">${r.place}</text>` : ''}
      <g font-family="Barlow Condensed" font-weight="700" font-size="11" letter-spacing="1.5" fill="${C.ash}"><text x="${dx}" y="${dy + 22}" text-anchor="middle">D${r.d}</text><text x="${rx}" y="${ry - 12}" text-anchor="middle">${r.region ? r.region + ' REGION' : 'REGIONAL'}</text><text x="${hx}" y="${hy + 30}" text-anchor="middle" fill="${C.chalk}">HERSHEY · ${placed ? ordinal(r.place).toUpperCase() : 'QUALIFIER'}</text></g>
      </svg>`;
  }

  /* entrant career matrix inside a bracket view: same pills as the wrestler cards, with this tournament highlighted
     (its season column outlined, its level row tinted, the intersection ringed in gold) */
  const BV_LVLS = ['district', 'regional', 'state'];
  function entrantMatrix(e, F) {
    const r = e.r, W = e.W;
    let apps = W ? (W.apps || []) : [], low = W ? (W.lower || OT.lowerFor(apps)) : [];
    if (F.lvl === 'state' && !apps.some((a) => a.year === r.year)) apps = apps.concat([r]).sort((a, b) => a.year - b.year);
    if (F.lvl !== 'state' && !low.some((x) => x.lvl === F.lvl && x.year === r.year)) low = low.concat([{ ...r, lvl: F.lvl }]).sort((a, b) => a.year - b.year);
    const M = careerCells(apps, low);
    const ci = M.cols.findIndex((c) => c && c.year === r.year), ri = BV_LVLS.indexOf(F.lvl);
    const at = (row, col) => `grid-row:${row};grid-column:${col}`;
    let h = '';
    if (ci >= 0) h += `<span class="mcol" style="grid-row:1 / span 4;grid-column:${ci + 2}"></span>`;
    h += `<span class="mrow" style="grid-row:${ri + 2};grid-column:1 / -1"></span>`;
    h += `<span style="${at(1, 1)}"></span>` + M.cols.map((c, i) => `<span class="ch${i === ci ? ' on' : ''}" style="${at(1, i + 2)}">${c ? `<b>${String(c.year).slice(2)}</b><i>${wShort(c.w)}</i>` : `<b>${GRADE_L[i]}</b><i>·</i>`}</span>`).join('');
    M.rows.forEach((row, k) => {
      h += `<span class="rl" style="${at(k + 2, 1)}" title="${row.l}">${navIcon(LVL_ICON[row.k])}</span>`;
      row.cells.forEach((c, i) => {
        const here = i === ci && k === ri;
        let cell;
        if (here) { // this tournament's own result, taken from the bracket row
          const cls = `pill here${e.adv ? ' adv' : ''}`;
          cell = r.place ? `<span class="${cls} ${pc(r.place)}" title="${r.year} · ${wShort(r.w)} · ${ordinal(r.place)}${e.adv ? ' · advanced' : ''}">${r.place}</span>` : `<span class="${cls} cq" title="${r.year} · ${F.lvl === 'state' ? 'qualified' : 'did not place'}">${F.lvl === 'state' ? 'Q' : 'DNP'}</span>`;
        } else cell = cellHTML(c, 'pill');
        h += cell.replace(/^<(div|span|a)([^>]*?)class="/, (m, t, a) => `<${t}${a}style="${at(k + 2, i + 2)}" class="`);
      });
    });
    return `<span class="cm bvm">${h}</span>`;
  }

  /* ---- tournament bracket view: one year · level · unit · weight, in the app's bracket language ----
     No bout data yet, so pairings are not fabricated: entrants sit on the left in seed order, the joins are structure
     only, and each finish is a medal pill at the end of the line. */
  function bracketView(key, focusSlug) {
    const F = OT.bracketField(key); if (!F) return '';
    const lvlName = { state: 'State', regional: 'Regional', district: 'District' }[F.lvl];
    const unit = F.unitLabel;
    const title = `${F.year} · ${unit}${F.lvl === 'state' ? ' State' : ''} · ${F.cls === 'single' ? 'one class' : F.cls} · ${wShort(F.w)}`;
    const dot = F.tier ? bandIcon(F.tier, 16, F.info && F.info.top && F.info.top.length ? 'in the bracket: ' + F.info.top.map((t) => t.name).join(', ') : '') : '';
    const head = `<div class="bvhead"><a class="bvclose" href="${OT.bhref(null)}" aria-label="Close">✕</a><div><div class="k">${lvlName.toUpperCase()} BRACKET</div><h2>${esc(title)}</h2></div>${dot ? `<div class="bvdot">${dot}</div>` : ''}</div>`;
    const SRCI = { d3records: ['champions only', 'District III Records', 'https://piaadistrict3records.com/'], wpial: ['champions only', 'WPIAL', 'https://wpial.org/'] }[F.src];
    const srcNote = SRCI ? `<div class="bvsrc">${SRCI[0]} · <a href="${SRCI[2]}" target="_blank" rel="noopener">${SRCI[1]}</a> · the bracket archive has no file for this tournament</div>` : '';
    if (SRCI && F.entrants.length) return head + srcNote + `<div class="bvsrclist">${F.entrants.map((e) => `<a class="bvsrcrow" href="#wrestler/${e.slug}"><span class="pill ${pc(e.r.place)}">${e.r.place}</span><span class="bvsrcn"><b>${esc(e.r.name)}</b><small>${esc(e.r.sch)}</small></span></a>`).join('')}</div>`;
    if (!F.entrants.length) return head + empty(F.lvl === 'state' ? 'No entrants on record for this bracket.' : F.covered ? (F.loading ? 'Loading the field…' : 'No placewinners recorded at this weight.') : 'The archive has no file for this tournament.');
    const n = F.entrants.length, phone = (window.innerWidth || 390) < 720, RH = phone ? 128 : 92, BW = phone ? 54 : 110, H = n * RH;
    const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, n)))), step = (BW - 22) / rounds;
    let ys = F.entrants.map((_, i) => i * RH + RH / 2), paths = [];
    for (let k = 0; k < rounds; k++) { const x0 = k * step, x1 = (k + 1) * step, next = []; for (let i = 0; i < ys.length; i += 2) { const a = ys[i], b = ys[i + 1]; if (b == null) { paths.push(`M${x0} ${a} H${x1}`); next.push(a); continue; } const m = (a + b) / 2; paths.push(`M${x0} ${a} H${x1} V${b} H${x0}`); next.push(m); } ys = next; }
    const fy = ys[0], fx = rounds * step; paths.push(`M${fx} ${fy} H${BW - 20}`);
    const term = F.lvl === 'state' ? `<circle cx="${BW - 10}" cy="${fy}" r="7.5" fill="none" stroke="${C.chalk}" stroke-width="2.4"/><circle cx="${BW - 10}" cy="${fy}" r="2.4" fill="${C.red}"/>` : `<circle cx="${BW - 10}" cy="${fy}" r="5" fill="${C.chalk}"/>`;
    const label = `<text transform="translate(${BW - 22} ${Math.min(H - 70, fy + 14)}) rotate(90)" text-anchor="start" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing="2" fill="${C.ash}">${F.next}</text>`;
    const svg = `<svg class="bvjoins" width="${BW}" height="${H}" viewBox="0 0 ${BW} ${H}" aria-hidden="true"><path d="${paths.join(' ')}" fill="none" stroke="${C.line2 || C.ash}" stroke-width="1"/>${term}${n > 3 ? label : ''}</svg>`;
    const lines = F.entrants.map((e) => {
      const r = e.r, me = e.slug === focusSlug;
      const chip = OT.SB ? OT.SB.svg(r.sch, { size: 22, variant: 'chip', title: false }) : '';
      const meta = [r.grade, r.record].filter(Boolean).join(' · ');
      return `<div class="bvl${me ? ' me' : ''}" style="height:${RH}px"><span class="bvtop"><span class="sd">${e.seedLabel || ''}</span><span class="chp">${chip}</span><a class="nm" href="#wrestler/${e.slug}"><b>${esc(r.name)}</b><small>${esc(r.sch)}${meta ? ' · ' + meta : ''}${e.adv ? ' · <em class="advk">advanced</em>' : ''}</small></a><span class="dsp" aria-hidden="true"></span></span>${entrantMatrix(e, F)}</div>`;
    }).join('');
    const advNote = F.adv ? ` The top ${F.adv} advanced${F.lvl === 'district' ? ' to regionals' : ' to Hershey'}; they are marked advanced.` : '';
    return head + `<div class="bvbody"${F.loading ? ' data-loading="1"' : ''}><div class="bvlines">${lines}</div>${svg}</div><div class="note">${F.loading ? 'Loading the full field… ' : ''}Pairings and bout scores come with the next parse; until then lines show the field in seed order and where each wrestler finished.${advNote} Each line carries that wrestler's whole career, district, regional and state across FR to SR; this tournament is the ringed pill, its season outlined and its level tinted. The gold line is the wrestler you came from.</div>`;
  }

  Object.assign(OT, { tierColor, bracketView, bandIcon, bandFor, fieldTip, headerChips, panel, careerCells, wrestlerCard, C, MED, pc, score, wordmark, navIcon, classToggle, windowToggle, unitHeader, section, empty, bracket, rankTable, wrestlerRank, teamsBlock, seasonsDrawer, lowerBlock, chips, careerGrid, road });
})();
