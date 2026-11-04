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
  /* Overtime Rating: the wrestler's own season strength on one scale (1500 = the average state qualifier), shown as a
     labeled number in chalk. It is not colored: a rating is how good he was, not how hard something was. */
  const rtgTip = 'Overtime Rating: his strength that season from every bout at every level, on one scale for every era (1500 = the average state qualifier; 400 points ≈ 10-to-1 odds)';
  const rtgTag = (v, opts = {}) => { if (v == null || isNaN(v)) return ''; const n = OT.rtg10(v);
    return `<span class="rtg${opts.size ? ' ' + opts.size : ''}" title="${esc(opts.title || rtgTip)}"><i>${opts.label || 'RTG'}</i><b>${n}</b></span>`; };
  /* field strength: one labeled gauge, a gradient bar with ticks at the typical district / regional / state field and a
     marker for this bracket. The only place difficulty uses color. */
  const fieldGauge = (v, lvl) => { if (v == null) return ''; const M = OT.RTG_META, lo = M.lo, hi = M.hi, x = (q) => Math.max(0, Math.min(100, 100 * (q - lo) / (hi - lo)));
    const ticks = [['district', 'D'], ['regional', 'R'], ['state', 'S']].filter(([k]) => M.field[k]).map(([k, l]) => `<span class="fgt${k === lvl ? ' on' : ''}" style="left:${x(M.field[k])}%" title="typical ${k} field ${OT.rtg10(M.field[k])}"><i></i><em>${l}</em></span>`).join('');
    const t = `Field ${OT.rtg10(v)}: the mean Overtime Rating of this bracket's top eight. Typical fields: district ${OT.rtg10(M.field.district)}, regional ${OT.rtg10(M.field.regional)}, state ${OT.rtg10(M.field.state)}.`;
    return `<div class="fg" title="${esc(t)}" aria-label="${esc(t)}"><div class="fgl"><span>FIELD</span><b>${OT.rtg10(v)}</b></div><div class="fgb"><div class="fgr"></div>${ticks}<span class="fgm" style="left:${x(v)}%"></span></div></div>`; };
  const classToggle = () => `<div class="seg" role="group" aria-label="Class">${['AAA', 'AA', 'ALL'].map((k) => `<button data-cls="${k}" aria-pressed="${state.cls === k}">${k === 'ALL' ? 'All' : k}</button>`).join('')}</div>`;
  /* time window: all-time, last 5 / 10 / 25 seasons, or a custom range */
  const windowToggle = () => { const w = state.win, [a, b] = yearsWindow();
    return `<div class="win"><div class="seg" role="group" aria-label="Seasons">${[['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25'], ['custom', 'Custom']].map(([k, l]) => `<button data-win="${k}" aria-pressed="${w.mode === k}">${l}</button>`).join('')}</div>${w.mode === 'custom' ? `<form class="wrange" data-wrange><input type="number" name="from" inputmode="numeric" min="1938" max="2026" value="${a}" aria-label="From"><span>–</span><input type="number" name="to" inputmode="numeric" min="1938" max="2026" value="${b}" aria-label="To"><button type="submit" class="go">Go</button></form>` : ''}</div>`; };
  /* header chips: the current selections, each one opens the control panel */
  const filterChips = () => { const f = state.f; return f.weights.length ? [f.weights.length === 1 ? STD.find((x) => x.k === f.weights[0]).label + ' lbs' : f.weights.length + ' weights'] : []; };
  const headerChips = () => { const fc = filterChips(), n = state.f.weights.length;
    const ic = `<button class="hc ic${n ? ' on' : ''}" data-panel="filters" aria-label="Class, seasons and weights" title="Class, seasons and weights"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>`;
    return ic + `<button class="hc" data-panel="class">${state.cls === 'ALL' ? 'All classes' : state.cls}</button><button class="hc" data-panel="window">${state.win.mode === 'all' ? 'All-time' : state.win.mode === 'custom' ? windowLabel() : 'Last ' + state.win.mode}</button>${fc.map((t) => `<button class="hc on" data-panel="filters">${esc(t)}</button>`).join('')}`; };
  /* the control panel: class, window, multi-select filters */
  const fchip = (kind, v, label, on) => `<button class="fc${on ? ' on' : ''}" data-f="${kind}" data-v="${esc(String(v))}" aria-pressed="${on}">${label}</button>`;
  function panel() {
    const f = state.f;
    return `<div class="pbar"><b>Scope</b><span><button class="pclr" data-clear-all>Reset</button><button class="pdone" data-panel-close>Done</button></span></div>
      <div class="pg" id="pg-class"><div class="k">Class</div>${classToggle()}</div>
      <div class="pg" id="pg-window"><div class="k">Seasons</div>${windowToggle()}</div>
      <div class="pg" id="pg-filters"><div class="k">Weights${f.weights.length ? ` <button class="pclr" data-clear="weights">clear</button>` : ''}</div><div class="fcs">${STD.map((x) => fchip('weights', x.k, x.label, f.weights.includes(x.k))).join('')}</div><div class="note1">Weights narrow the wrestler lists and all-time teams.</div></div>
      <a class="pabout" href="#about" data-panel-close>How ratings and scores work</a>`;
  }

  /* the level switch: which tournament level the podium, bracket, rankings and seasons count */
  const LVLS = [['state', 'State'], ['regional', 'Regional'], ['district', 'District']];
  const levelSwitch = (kind) => { const ok = OT.lvlsFor(kind || 'school'); if (ok.length < 2) return ''; return `<div class="seg lvl" role="group" aria-label="Tournament level">${LVLS.filter(([k]) => ok.includes(k)).map(([k, l]) => `<button data-lvl="${k}" aria-pressed="${state.lvl === k}">${l}</button>`).join('')}</div>`; };
  /* the podium: eight steps, heights fall from 1st, color only on the top edge; each step carries the count */
  const POD = [7, 5, 3, 1, 0, 2, 4, 6], POD_H = [100, 80, 66, 56, 47, 40, 34, 29];
  const podium = (places, opts = {}) => `<div class="pod${opts.sm ? ' sm' : ''}" role="img" aria-label="Medals by place: ${places.map((n, i) => ordinal(i + 1) + ' ' + n).join(', ')}">${POD.map((i) => `<div class="pst"><div class="pblk m${Math.min(i + 1, 5)}" style="height:${POD_H[i]}%"><b>${places[i] ? fmt(places[i]) : ''}</b></div><span>${ordinal(i + 1)}</span></div>`).join('')}</div>`;
  /* one tournament's podium with names: the top three on steps, 4th–8th listed beside */
  function namedPodium(rows) {
    const by = (p) => rows.filter((r) => r.place === p); const nm = (r) => `<a href="${OT.wrestlerHref(r)}"><b>${esc(r.name)}</b><small>${esc(r.sch)}</small></a>`;
    const top = [2, 1, 3].map((p) => { const rs = by(p); return `<div class="npst"><div class="npn">${rs.map(nm).join('') || '<span class="muted">—</span>'}</div><div class="npb m${p}" style="height:${[0, 54, 40, 30][p]}px"><span>${ordinal(p)}</span></div></div>`; }).join('');
    const rest = [4, 5, 6, 7, 8].flatMap((p) => by(p).map((r) => `<li><i class="m${Math.min(p, 5)}">${ordinal(p)}</i>${nm(r)}</li>`)).join('');
    return `<div class="np"><div class="nptop">${top}</div>${rest ? `<ol class="nprest">${rest}</ol>` : ''}</div>`;
  }
  /* unit header: name, context, level switch, hero numbers, podium */
  function unitHeader(u, o, extra = {}) {
    const L = state.lvl;
    const hero = extra.hero || (L === 'state' ? [['Medals', o.medals], ['Titles', o.titles], ['Qualifiers', o.quals], u.kind === 'school' ? ['Team titles', o.won] : ['Reg. titles', o.regTitles]]
      : [['Medals', o.medals], ['Titles', o.titles], u.kind === 'school' ? ['Team titles', o.won] : ['Tournaments', o.cov ? o.cov.n : null], ['Seasons', o.cov ? o.cov.years.length : null]]);
    return `<header class="uh">
      <div><h1>${esc(u.name)}</h1>${extra.sub ? `<div class="sub">${extra.sub}</div>` : ''}</div>
      ${levelSwitch(u.kind)}
      <div class="hero">${hero.map(([l, v]) => `<div><b>${v == null ? '–' : typeof v === 'number' ? fmt(v) : v}</b><span>${l}</span></div>`).join('')}</div>
      ${o.places ? podium(o.places) : ''}
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
    if (!items.length) return crumbBar + empty(`No ${state.lvl} placements here in ${clsName().toLowerCase()}, ${windowLabel()}.`);
    const LIM = 16, show = showAll || items.length <= LIM ? items : items.slice(0, LIM), n = show.length;
    const phone = (window.innerWidth || 390) < 720, RH = phone ? 58 : 50, BW = phone ? 46 : 110, H = n * RH, maxShare = show[0].share || 1;
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
    const fy = ys[0], fx = rounds * step; paths.push(`M${fx} ${fy} H${BW - 16}`);
    const hershey = `<circle cx="${BW - 9}" cy="${fy}" r="6.5" fill="none" stroke="${C.chalk}" stroke-width="2.2"/><circle cx="${BW - 9}" cy="${fy}" r="2.2" fill="${C.red}"/>`;
    const label = `<text transform="translate(${BW - 22} ${Math.min(H - 60, fy + 14)}) rotate(90)" text-anchor="start" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing="2" fill="${C.ash}">HERSHEY</text>`;
    const svg = `<svg class="bj" width="${BW}" height="${H}" viewBox="0 0 ${BW} ${H}" aria-hidden="true"><path d="${paths.join(' ')}" fill="none" stroke="${C.ash}" stroke-width="1" opacity=".8"/>${hershey}${phone ? '' : label}</svg>`;
    const rowsHtml = show.map((it, i) => { const tag = it.href ? 'a' : 'div'; const sh = it.share >= 0.1 ? (100 * it.share).toFixed(0) + '%' : (100 * it.share).toFixed(1) + '%';
      return `<${tag} class="bl" ${it.href ? `href="${it.href}" data-bl="1"` : ''} style="height:${RH}px"><span class="sd${i === 0 ? ' s1' : ''}">${it.seed}</span><span class="bm"><b>${esc(it.name)}</b><span class="b2"><small>${esc(it.sub || '')}</small><span class="br"><i style="width:${Math.max(3, 100 * it.share / maxShare)}%"></i></span><span class="sh">${sh}</span></span></span></${tag}>`; }).join('');
    const more = items.length > LIM ? `<button class="more" data-bracket-all="${showAll ? '0' : '1'}">${showAll ? 'Show top 16' : `Show all ${items.length}`}</button>` : '';
    return `${crumbBar}<div class="bracket card" title="Seeded by ${state.lvl} points · follow a line toward Hershey">${toggle ? `<div class="btop">${toggle}</div>` : ''}<div class="bls">${rowsHtml}</div>${svg}${more ? `<div class="bmore">${more}</div>` : ''}</div>`;
  }

  /* ---- rankings: one ranked list for every level and width. A sort chip picks the big number; under each name an
     eight-cell strip shows the medals by place. Wide screens add the other numbers in a quiet line. ---- */
  const METRICS = [['pts', 'Score'], ['rtg', 'Rating'], ['medals', 'Medals'], ['titles', 'Titles'], ['power', 'Power'], ['era', 'Era']];
  const mval = (o, k) => (k === 'rtg' ? o.rtg : o[k]);
  const mfmt = (v, k) => (v == null ? '–' : k === 'rtg' ? OT.rtg10(v) : k === 'era' || k === 'power' ? score(v) : fmt(Math.round(v)));
  const placeStrip = (places) => `<span class="pstrip">${places.map((n, i) => `<i class="${n ? 'm' + Math.min(i + 1, 5) : 'z'}" title="${n} × ${ordinal(i + 1)}">${n || ''}</i>`).join('')}</span>`;
  function rankList(items, opts = {}) {
    if (!items.length) return empty(opts.emptyMsg || `Nothing here at the ${state.lvl} level in ${clsName().toLowerCase()}.`);
    const ms = METRICS.filter(([k]) => k !== 'rtg' || items.some((i) => i.rtg != null));
    const key = ms.some(([k]) => k === state.rsort) ? state.rsort : 'pts', lab = ms.find(([k]) => k === key)[1];
    const sorted = items.slice().sort((a, b) => (mval(b, key) ?? -1) - (mval(a, key) ?? -1) || b.pts - a.pts || b.medals - a.medals);
    const lim = state.rall ? sorted.length : opts.limit || 25;
    const chips = `<div class="rchips" role="group" aria-label="Sort by">${ms.map(([k, l]) => `<button data-rsort="${k}" aria-pressed="${k === key}">${l}</button>`).join('')}</div>`;
    const rows = sorted.slice(0, lim).map((o, i) => `<a class="rr" href="${o.href}"><span class="rn">${i + 1}</span><span class="rm"><b>${esc(o.name)}</b>${o.sub || o.note ? `<small>${[o.sub, o.note].filter(Boolean).map(esc).join(' · ')}</small>` : ''}</span><span class="rv"><b>${mfmt(mval(o, key), key)}</b><i>${lab}</i></span>${placeStrip(o.places)}<span class="rx">${ms.filter(([k]) => k !== key).map(([k, l]) => `${l} <b>${mfmt(mval(o, k), k)}</b>`).join('<i>·</i>')}</span></a>`).join('');
    const more = sorted.length > (opts.limit || 25) ? `<button class="more" data-rall="${state.rall ? '0' : '1'}">${state.rall ? 'Show top ' + (opts.limit || 25) : 'Show all ' + sorted.length}</button>` : '';
    return `<div class="rcard card">${opts.top || ''}${chips}<div class="rl">${rows}</div>${more ? `<div class="bmore">${more}</div>` : ''}</div>`;
  }
  /* rankings items for units (regions, districts, schools) and for a school's wrestlers */
  const unitItems = (list, kind, ctx) => list.map((o) => ({ name: kind === 'region' ? REGIONS[o.u.id] : o.u.name, href: o.u.href, sub: kind === 'district' ? DISTRICTS[o.u.id] : kind === 'school' && !(ctx && ctx.kind === 'district') && o.u.d ? 'D' + o.u.d : '', note: o.offMedals ? `incl. ${o.offMedals} ${o.offCls} medal${o.offMedals === 1 ? '' : 's'} at ${Math.round(100 * o.offClass)}%` : '', places: o.places, medals: o.medals, titles: o.titles, pts: o.pts, era: o.era, power: o.power }));
  function wrestlerItems(u) {
    const L = state.lvl, [, last] = OT.yearsInScope();
    if (L === 'state') {
      const rows = OT.unitRows(u); const ws = OT.wrestlersOf(careerRows(rows.filter((r) => r.place)).filter((r) => r.place)); const tot = d3.sum(seasonsInScope(), (S) => S.avail) || 1;
      return ws.map((w) => ({ name: w.name, href: w.href, sub: w.years, places: w.places, medals: w.medals, titles: w.titles, pts: w.pts, era: 100 * w.pts / tot * 100, power: 100 * d3.sum(w.rows, (r) => OT.apts(r) * Math.pow(0.5, (last - r.year) / 7)) / tot * 100, rtg: w.rtg ? w.rtg.peak : null }));
    }
    const rows = OT.lowerUnitRows(u, L); const tot = d3.sum(Array.from(new Set(rows.filter((r) => r.place).map((r) => r.year + '|' + (L === 'district' ? r.d : r.region)))), (k) => { const [y, c] = k.split('|'); return OT.lowerAvail(L, +y, L === 'district' ? +c : c); }) || 1;
    return OT.lowerWrestlersOf(rows).map((w) => ({ name: w.name, href: w.href, sub: w.years, places: w.places, medals: w.medals, titles: w.titles, pts: w.pts, era: 100 * w.pts / tot * 100, power: 100 * d3.sum(w.rows, (r) => r.pts * Math.pow(0.5, (last - r.year) / 7)) / tot * 100, rtg: w.rtg ? w.rtg.peak : null }));
  }

  /* all-time teams: one weight per wrestler, ranked by the page's placement credit plus peak rating */
  const ATT_NOTE = { state: 'Ranked by state results and peak rating.', region: 'Ranked by state, then regional results, plus peak rating.', district: 'Ranked by state, regional and district results (state counts most), plus peak rating.', school: 'Ranked by state, regional and district results (state counts most), plus peak rating.' };
  function teamsBlock(u) {
    const T = allTimeTeams(u, 3);
    if (T === null) return '<div class="card empty" data-need-people="1">Loading every wrestler…</div>';
    if (!T.length) return empty('No one on record yet.');
    const lowerToo = u.kind !== 'state';
    const mark = (lv, best, titles) => best ? `<span class="lt" title="${lv === 'R' ? 'Regional' : 'District'} ${titles ? titles + '× champion' : 'best ' + ordinal(best)}">${lv}${titles ? '★' + (titles > 1 ? titles : '') : ordinal(best)}</span>` : '';
    const slot = (s, i) => { if (!s) return '<div class="slot none"></div>';
      const sp = s.sres.map((r) => r.place ? `<span class="yp ${pc(r.place)}" title="${ordinal(r.place)} at states, ${r.year}">${String(r.year).slice(2)}</span>` : `<span class="yp q" title="State qualifier, ${r.year}">${String(r.year).slice(2)}</span>`).join('');
      const lt = lowerToo ? mark('R', s.rB, s.rT) + (u.kind === 'region' ? '' : mark('D', s.dB, s.dT)) : '';
      return `<div class="slot t${i + 1}"><a href="${s.href}"><b>${esc(s.name)}</b><small>${u.kind === 'school' ? '' : esc(s.sch) + ' · '}${s.years}</small></a><span class="pl">${sp}${lt}</span>${s.rtg ? `<span class="srt">${rtgTag(s.rtg, { size: 'xs' })}</span>` : ''}</div>`; };
    return `<div class="teams"><div class="thead"><span></span><span>1st team</span><span>2nd team</span><span>3rd team</span></div>${T.map(({ c, slots }) => `<div class="trow"><div class="w">${c.label}</div>${slots.map(slot).join('')}</div>`).join('')}</div>
      <div class="note">${ATT_NOTE[u.kind]} Each wrestler counts at one weight, his highest-rated. Pills are state results by year${lowerToo ? '; R and D marks are his best regional and district finishes (★ = champion)' : ''}.</div>`;
  }

  /* season details render when a year is opened (a drawer can hold 80+ seasons) */
  const SD = new Map(); let sdN = 0;
  const lazyPod = (f) => { const id = 'sd' + (++sdN); SD.set(id, f); return `<div class="podium" data-sd="${id}" hidden></div>`; };
  OT.seasonDetail = (id) => { const f = SD.get(id); return f ? f() : ''; };
  /* seasons drawer */
  function seasonsDrawer(u) {
    const S = seasonsInScope().map((s) => ({ S: s, t: u.kind === 'state' ? { pts: s.avail, titles: s.lineup.length, n: s.meds.length, rows: s.rows, score: null } : s.by[u.kind].get(u.id) })).filter((x) => x.t).reverse();
    if (!S.length) return empty('No seasons in scope.');
    const rows = S.map(({ S: s, t }) => {
      const champ = s.champion; const label = u.kind === 'school' ? (t.realRank ? ordinal(t.realRank) + ' as a team' : ordinal(t.rank) + ' by points') : u.kind === 'state' ? (champ ? esc(champ.id) + (s.real ? ` ${champ.score}` : '') : '') : (t.rows[0] ? esc(t.rows.filter((r) => r.place === 1).map((r) => r.name).slice(0, 2).join(', ')) || '–' : '–');
      const n = `${t.n || 0} medal${t.n === 1 ? '' : 's'}${t.titles ? ` · ${t.titles} title${t.titles === 1 ? '' : 's'}` : ''}`;
      const pod = t.rows.filter((r) => r.place).sort((a, b) => a.slot - b.slot || a.place - b.place);
      const byW = d3.groups(pod, (r) => r.w);
      const podium = lazyPod(() => `${OT.podiumC(placeCounts(pod), { sm: true })}${byW.map(([w, rs]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(rs[0]))}" title="open the ${s.year} ${wShort(w)} bracket">${wShort(w)}</a><div class="ps">${rs.map((r) => `<span><i style="color:${MED[r.place - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`} ${rtgTag(OT.ratingOf(r, 'state'), { size: 'xs' })}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}`);
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${s.year}</span><span class="c">${label}</span><span class="n">${n}</span></div>${podium}`;
    }).join('');
    const first = S[S.length - 1].S.year, last = S[0].S.year;
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${S.length}</b> <span class="muted">seasons · ${first}–${last}</span></span><span class="k">Open</span></summary><div class="body">${rows}</div></details>`;
  }

  /* lower-level dominance (district / regional brackets): the unit's own tournament results, never mixed with state */
  function lowerSeasons(u, lvl, rows, teams) {
    const champs = d3.group(teams.filter((t) => t.place === 1), (t) => t.year), mine = u.kind === 'school' ? d3.group(teams, (t) => t.year) : null;
    const years = Array.from(new Set(rows.map((r) => r.year).concat(teams.map((t) => t.year)))).sort((a, b) => b - a);
    if (!years.length) return empty('No seasons on file.');
    const BY = d3.group(rows.filter((r) => r.place), (r) => r.year);
    const body = years.map((y) => { const rs = (BY.get(y) || []).slice(); const ch = champs.get(y) || []; const me = mine && mine.get(y);
      const label = u.kind === 'school' ? (me && me.length ? `${ordinal(me[0].place)} as a team · ${me[0].pts}` : rs.length ? `${rs.filter((r) => r.place === 1).length} title${rs.filter((r) => r.place === 1).length === 1 ? '' : 's'}` : '–') : ch.length ? ch.map((t) => `${esc(t.sch)}${u.kind === 'region' || /_|-/.test(t.unit) ? ` <span class="muted">${esc(OT.unitLabel(lvl, t.unit).replace(/^District \d+ ?/, ''))}</span>` : ''} ${t.pts}`).join(' · ') : '–';
      const byW = d3.groups(rs.sort((a, b) => a.wn - b.wn || a.place - b.place), (r) => r.unit + '|' + r.w);
      const podium = lazyPod(() => `${OT.podiumC(placeCounts(rs), { sm: true })}${byW.map(([k, v]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(v[0]))}" title="open the ${y} ${wShort(v[0].w)} bracket">${wShort(v[0].w)}${byW.some(([k2]) => k2 !== k && k2.split('|')[1] === v[0].w) ? ` <small class="muted">${esc(OT.unitLabel(lvl, v[0].unit).replace(/^District \d+ ?/, ''))}</small>` : ''}</a><div class="ps">${v.map((r) => `<span><i style="color:${MED[Math.min(r.place, 8) - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`} ${rtgTag(OT.ratingOf(r, r.lvl), { size: 'xs' })}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}`);
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${y}</span><span class="c">${label}</span><span class="n">${rs.length} medal${rs.length === 1 ? '' : 's'}</span></div>${podium}`; }).join('');
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${years.length}</b> <span class="muted">seasons · ${years[years.length - 1]}–${years[0]}</span></span><span class="k">Open</span></summary><div class="body">${body}</div></details>`;
  }
  /* medal chips */
  const chips = (places) => places.map((n, i) => n ? `<span class="chip ${pc(i + 1)}" title="${n} × ${ordinal(i + 1)}">${n}×${i + 1}</span>` : '').join('');
  /* wrestler card: school-colored stripe + badge, name, district/region icons, then the career matrix (D/R/S × FR–SR) in small pills */
  const LVL_ICON = { district: 'district', regional: 'region', state: 'state' };
  const wrestlerCard = (w) => {
    const id = OT.SB && OT.SB.identity(w.sch); const p1 = (id && id.primary) || '#5F6B78', p2 = (id && id.secondary) || '#EEEAE1';
    const badge = OT.SB ? OT.SB.svg(w.sch, { size: 34, variant: 'chip', title: false }) : '';
    const reg = (OT.schoolRegion && OT.schoolRegion(w.sch)) || '';
    const M = careerCells(w.apps, w.lower); const cr = w.rtg;
    return `<a class="wc" href="${w.href}" style="--p1:${p1};--p2:${p2}">
      <span class="badge">${badge}</span>
      <span class="who"><b>${esc(w.name)}</b><small>${esc(w.sch)} · ${w.years}</small></span>
      <span class="where">${cr ? rtgTag(cr.peak, { size: 'sm', title: `peak Overtime Rating (${cr.peakYear}); career average ${OT.rtg10(cr.avg)}` }) : ''}<span title="District ${w.d}">${navIcon('district')}${w.d}</span>${reg ? `<span title="${esc(OT.REGIONS[reg] || reg)} Region">${navIcon('region')}${esc(reg)}</span>` : ''}</span>
      <span class="cm"><span></span>${M.cols.map((c, i) => `<span class="ch">${colHead(c, i)}</span>`).join('')}
        ${M.rows.map((r) => `<span class="rl" title="${r.l}">${navIcon(LVL_ICON[r.k])}</span>${r.cells.map((c) => cellHTML(c, 'pill')).join('')}`).join('')}</span></a>`;
  };

  /* career matrix: 3 levels × 4 grade slots FR–SR. A cell is one of: place | q (advanced without a recorded place) |
     dnp (entered, did not place) | dnc (did not compete: the district bracket is on record and he is not in it) |
     nodata (no bracket on record) | null (did not advance to this level). DNC needs his full career loaded (opts.full). */
  function careerCells(apps, lowerIn, opts = {}) {
    const low = lowerIn || OT.lowerFor(apps);
    const years = Array.from(new Set(apps.map((a) => a.year).concat(low.map((r) => r.year)))).sort((a, b) => a - b);
    const pseudo = years.map((y) => apps.find((a) => a.year === y) || { ...(low.find((r) => r.year === y && r.grade) || low.find((r) => r.year === y)), year: y, pseudo: true });
    const GI = { FR: 0, SO: 1, JR: 2, SR: 3 };
    const gap = (y) => { const near = pseudo.slice().sort((a, b) => Math.abs(a.year - y) - Math.abs(b.year - y))[0] || {}; return { year: y, empty: true, cls: near.cls, d: near.d }; };
    let cols = null; const g = pseudo.find((p) => p.grade in GI);
    if (g) { const fr = g.year - GI[g.grade]; if (pseudo.every((p) => p.year >= fr && p.year <= fr + 3)) cols = [0, 1, 2, 3].map((i) => pseudo.find((p) => p.year === fr + i) || gap(fr + i)); }
    if (!cols) cols = [0, 1, 2, 3].map((i) => pseudo.find((p) => gradeSlot(p, pseudo) === i) || null);
    const higher = (lvl, y) => (lvl === 'district' ? apps.some((a) => a.year === y) || low.some((r) => r.lvl === 'regional' && r.year === y) : apps.some((a) => a.year === y));
    const dist = (p) => { if (!p.cls || !p.d || p.year > OT.YEARS[OT.YEARS.length - 1]) return null; if (!OT.lowerCovered('district', p.year, p.cls, p.d)) return { year: p.year, nodata: true, src: 'no district bracket on record' };
      return opts.full && OT.lowerLoaded(p.year, 'district') ? { year: p.year, dnc: true } : null; };
    const cell = (lvl, i) => {
      const p = cols[i]; if (!p) return null;
      if (p.empty) return lvl === 'district' ? dist(p) : null;
      const s = apps.find((a) => a.year === p.year); const base = { year: p.year, w: p.w, r: s || p };
      if (lvl === 'state') return s ? (s.place ? { ...base, place: s.place } : { ...base, q: true }) : null;
      const r = low.find((x) => x.lvl === lvl && x.year === p.year);
      if (r) return r.place ? { ...base, r, w: r.w, place: r.place } : higher(lvl, p.year) ? { ...base, r, w: r.w, q: true } : { ...base, r, w: r.w, dnp: true };
      if (!higher(lvl, p.year)) return lvl === 'district' ? dist(p) : null;
      const cls = s ? s.cls : p.cls; const unit = lvl === 'district' ? (s ? s.d : p.d) : (s ? (s.region || OT.regionOf(s, cls === 'single' ? s.k : cls)) : p.region);
      const only = OT.lowerSrc(lvl, p.year, cls, unit);
      if (only) return { ...base, nodata: true, src: only === 'wpial' ? 'only the WPIAL champion is on record' : 'only the District III champion is on record' };
      if (OT.lowerCovered(lvl, p.year, cls, unit)) return { ...base, q: true, src: 'advanced without a recorded place' };
      if (lvl === 'regional' && s && p.year >= 1951 && s.reg) return { ...base, place: s.reg, src: 'from the state seed; no regional file' };
      if (lvl === 'district' && s && p.year < 1951 && s.dist) return { ...base, place: s.dist, src: 'from the state seed; no district file' };
      return { ...base, nodata: true };
    };
    return { cols, rows: [['district', 'District'], ['regional', 'Regional'], ['state', 'State']].map(([k, l]) => ({ k, l, cells: [0, 1, 2, 3].map((i) => cell(k, i)) })) };
  }
  const cellHTML = (c, cls, band, href) => {
    const tag = href ? 'a' : 'div', hr = href ? ` href="${href}"` : '';
    if (!c || c.none) return `<div class="${cls}"></div>`;
    if (c.place) return `<${tag}${hr} class="${cls} ${pc(c.place)}" title="${c.year}${c.w ? ' · ' + wShort(c.w) : ''} · ${ordinal(c.place)}${c.src ? ' · ' + c.src : ''}">${c.place}</${tag}>`;
    if (c.dnc) return `<div class="${cls} dnc" title="${c.year} · did not compete at districts">DNC</div>`;
    if (c.nodata || c.pend) return `<div class="${cls} nod" title="${c.year} · ${c.src || 'no bracket on record'}">—</div>`;
    if (c.dnp) return `<${tag}${hr} class="${cls} dnp" title="${c.year} · entered, did not place">DNP</${tag}>`;
    return `<${tag}${hr} class="${cls} cq" title="${c.year} · ${c.src || 'qualified'}">Q</${tag}>`;
  };
  const colHead = (c, i, full) => (c ? `<b>${full ? c.year : String(c.year).slice(2)}</b><i>${c.w ? wShort(c.w) : GRADE_L[i]}</i>` : `<b>${GRADE_L[i]}</b><i>·</i>`);
  function careerGrid(W) {
    const M = careerCells(W.apps, W.lower, { full: W.full });
    const wrap = (c, k) => { const ok = c && c.r && !c.dnc && !c.nodata; const href = ok ? OT.bhref(OT.bkey(c.r, k)) : null; const f = ok ? OT.fieldOf(c.r, k) : null; return `<div class="cw">${cellHTML(c, 'cell', false, href)}${f ? OT.wedge(f) : '<i class="wdg"></i>'}</div>`; };
    return `<div class="cg"><div></div>${GRADE_L.map((g, i) => `<div class="k h">${g}${M.cols[i] ? `<small>${M.cols[i].year}${M.cols[i].w ? ' · ' + wShort(M.cols[i].w) : ''}</small>` : ''}</div>`).join('')}${M.rows.map((r) => `<div class="k lab">${r.l}</div>${r.cells.map((c) => wrap(c, r.k)).join('')}`).join('')}</div>
      <div class="note">${OT.wlegend()} Tap a result for its bracket. Q advanced without a place · DNP entered, didn't place · DNC didn't compete · – no bracket on record.${W.full ? '' : ' Loading his full career…'}</div>`;
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
    h += `<span style="${at(1, 1)}"></span>` + M.cols.map((c, i) => `<span class="ch${i === ci ? ' on' : ''}" style="${at(1, i + 2)}">${colHead(c, i)}</span>`).join('');
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
    const SB_ = OT.sosBracket(key), nk = OT.nkey;
    const RES = { fall: 'fall', tf: 'TF', md: 'MD', dec: '', ff: 'forfeit', inj: 'inj.', dq: 'DQ' };
    const boutsOf = (name) => { if (!SB_) return []; const n = nk(name); return SB_.b.filter((b) => nk(b[2]) === n || nk(b[3]) === n).sort((a, b) => (a[0] !== 'champ') - (b[0] !== 'champ') || b[1] - a[1]); };
    const boutTxt = (b, name) => { const won = nk(b[2]) === nk(name); let sc = b[5] || ''; if (!won && /^\d+-\d+$/.test(sc)) sc = sc.split('-').reverse().join('-'); const r = [RES[b[4]] ?? b[4], sc, b[6]].filter(Boolean).join(' ');
      return `<span class="${won ? 'bo-w' : 'bo-l'}" title="${won ? 'beat' : 'lost to'} ${esc(won ? b[3] : b[2])}${b[0] === 'champ' ? '' : ' (consolation)'}">${won ? 'W' : 'L'} ${esc(r)}</span>`; };
    const sortBy = state.bvsort === 'rtg' ? 'rtg' : 'seed';
    const sortSeg = F.entrants.length > 1 && !F.src ? `<div class="seg sm bvsort" role="group" aria-label="Order"><button data-bvsort="seed" aria-pressed="${sortBy === 'seed'}">Seed</button><button data-bvsort="rtg" aria-pressed="${sortBy === 'rtg'}">Rating</button></div>` : '';
    const head = `<div class="bvhead"><a class="bvclose" href="${OT.bhref(null)}" aria-label="Close">✕</a><div><div class="k">${lvlName.toUpperCase()} BRACKET</div><h2>${esc(title)}</h2></div>${sortSeg}</div>${F.field != null ? `<div class="bvfield">${OT.fieldGauge(F.field, F.lvl)}</div>` : ''}`;
    const SRCI = { d3records: ['champions only', 'District III Records', 'https://piaadistrict3records.com/'], wpial: ['champions only', 'WPIAL', 'https://wpial.org/'] }[F.src];
    const srcNote = SRCI ? `<div class="bvsrc">${SRCI[0]} · <a href="${SRCI[2]}" target="_blank" rel="noopener">${SRCI[1]}</a> · the bracket archive has no file for this tournament</div>` : '';
    if (SRCI && F.entrants.length) return head + srcNote + `<div class="bvsrclist">${F.entrants.map((e) => `<a class="bvsrcrow" href="#wrestler/${e.slug}"><span class="pill ${pc(e.r.place)}">${e.r.place}</span><span class="bvsrcn"><b>${esc(e.r.name)}</b><small>${esc(e.r.sch)}</small></span></a>`).join('')}</div>`;
    if (!F.entrants.length) return head + empty(F.lvl === 'state' ? 'No entrants on record for this bracket.' : F.covered ? (F.loading ? 'Loading the field…' : 'No placewinners recorded at this weight.') : 'The archive has no file for this tournament.');
    const SBx = OT.sosBracket(key), hasB = !!(SBx && SBx.b.length); const n = F.entrants.length, phone = (window.innerWidth || 390) < 720, RH = phone ? (hasB ? 200 : 136) : (hasB ? 112 : 92), BW = phone ? 54 : 110, H = n * RH;
    const rOf = (r) => { const x = SB_ && SB_.s[nk(r.name)]; return x ? x[0] : OT.ratingOf(r, F.lvl); };
    const ents = sortBy === 'rtg' ? F.entrants.slice().sort((a, b) => (rOf(b.r) || 0) - (rOf(a.r) || 0)) : F.entrants;
    const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, n)))), step = (BW - 22) / rounds;
    let ys = ents.map((_, i) => i * RH + RH / 2), paths = [];
    for (let k = 0; k < rounds; k++) { const x0 = k * step, x1 = (k + 1) * step, next = []; for (let i = 0; i < ys.length; i += 2) { const a = ys[i], b = ys[i + 1]; if (b == null) { paths.push(`M${x0} ${a} H${x1}`); next.push(a); continue; } const m = (a + b) / 2; paths.push(`M${x0} ${a} H${x1} V${b} H${x0}`); next.push(m); } ys = next; }
    const fy = ys[0], fx = rounds * step; paths.push(`M${fx} ${fy} H${BW - 20}`);
    const term = F.lvl === 'state' ? `<circle cx="${BW - 10}" cy="${fy}" r="7.5" fill="none" stroke="${C.chalk}" stroke-width="2.4"/><circle cx="${BW - 10}" cy="${fy}" r="2.4" fill="${C.red}"/>` : `<circle cx="${BW - 10}" cy="${fy}" r="5" fill="${C.chalk}"/>`;
    const label = `<text transform="translate(${BW - 22} ${Math.min(H - 70, fy + 14)}) rotate(90)" text-anchor="start" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing="2" fill="${C.ash}">${F.next}</text>`;
    const svg = `<svg class="bvjoins" width="${BW}" height="${H}" viewBox="0 0 ${BW} ${H}" aria-hidden="true"><path d="${paths.join(' ')}" fill="none" stroke="${C.line2 || C.ash}" stroke-width="1"/>${term}${n > 3 ? label : ''}</svg>`;
    const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };
    const lines = ents.map((e) => {
      const r = e.r, me = e.slug === focusSlug;
      const chip = OT.SB ? OT.SB.svg(r.sch, { size: 22, variant: 'chip', title: false }) : '';
      const meta = [r.grade, r.record].filter(Boolean).join(' · ');
      const sx = SB_ && SB_.s[nk(r.name)]; const rt = rOf(r); const bl = boutsOf(r.name);
      const tag = rtgTag(rt);
      const bw = sx && sx[1] != null ? `<span class="bvbw">Best win: <b>${esc(shortName(sx[2]))}</b> ${OT.rtg10(sx[1])}${sx[3] ? ` <em title="a loss to someone rated 150+ below him">· ${sx[3]} upset loss${sx[3] === 1 ? '' : 'es'}</em>` : ''}</span>` : '';
      const line = bl.length ? `<span class="bvb">${bl.map((b) => boutTxt(b, r.name)).join('<i>·</i>')}${bw}</span>` : '';
      return `<div class="bvl${me ? ' me' : ''}" style="height:${RH}px"><span class="bvtop"><span class="sd">${e.seedLabel || ''}</span><span class="chp">${chip}</span><a class="nm" href="#wrestler/${e.slug}"><b>${esc(r.name)}</b><small>${esc(r.sch)}${meta ? ' · ' + meta : ''}${e.adv ? ' · <em class="advk">advanced</em>' : ''}</small></a><span class="dsp">${tag}</span></span>${line}${entrantMatrix(e, F)}</div>`;
    }).join('');
    const advNote = F.adv ? ` The top ${F.adv} advanced${F.lvl === 'district' ? ' to regionals' : ' to Hershey'}; they are marked advanced.` : '';
    const RN = (d, side) => side === 'champ' ? (['Final', 'Semifinal', 'Quarterfinal', 'Round 1', 'Prelim'][d] || 'Prelim') : (d === 0 ? ({ p3: '3rd place', p5: '5th place', p7: '7th place' }[side] || 'Consolation final') : 'Consolation ' + d);
    const roundsHTML = SB_ && SB_.b.length ? (() => { const sides = [['champ', 'Championship'], ['cons', 'Consolation']].map(([sd, lab]) => { const bs = SB_.b.filter((b) => sd === 'champ' ? b[0] === 'champ' : b[0] !== 'champ'); if (!bs.length) return '';
        const cols = d3.groups(bs, (b) => (b[0] === 'champ' || b[0] === 'p3' || b[0] === 'cons' ? b[1] : -1 - ['p5', 'p7'].indexOf(b[0]))).sort((a, b) => b[0] - a[0]);
        return `<div class="bvr"><div class="k">${lab}</div><div class="bvrc">${cols.map(([d, xs]) => `<div class="bvcol"><div class="k">${esc(RN(Math.max(0, d), xs[0][0]))}</div>${xs.map((b) => `<div class="bvbout"><b>${esc(b[2])}</b><small>over ${esc(b[3])}</small><span>${esc([RES[b[4]] ?? b[4], b[5], b[6]].filter(Boolean).join(' ') || 'dec')}</span></div>`).join('')}</div>`).join('')}</div></div>`; }).join('');
      return `<div class="bvrounds">${sides}</div>`; })() : '';
    const placers = F.entrants.map((e) => e.r).filter((r) => r.place >= 1 && r.place <= 8);
    return head + (placers.length ? namedPodium(placers) : '') + `<div class="bvbody"${F.loading ? ' data-loading="1"' : ''}><div class="bvlines">${lines}</div>${svg}</div>${roundsHTML}<div class="note">${F.loading ? 'Loading the full field… ' : ''}Each line: his bouts here, his rating that season (RTG), and his career by level FR–SR with this tournament ringed.${advNote}</div>`;
  }

  Object.assign(OT, { rtgTag, fieldGauge, bracketView, headerChips, panel, careerCells, wrestlerCard, C, MED, pc, score, wordmark, navIcon, classToggle, windowToggle, unitHeader, section, empty, bracket, rankList, unitItems, wrestlerItems, teamsBlock, seasonsDrawer, lowerSeasons, levelSwitch, namedPodium, podiumC: podium, chips, careerGrid, road });
})();
