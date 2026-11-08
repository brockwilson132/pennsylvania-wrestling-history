/* Overtime — shared components. Every level page is built from the same pieces. */
'use strict';
(() => {
  const { esc, fmt, ordinal, wShort, state, setCls, clsName, STD, stdOf, placeCounts, unitStats, rankings, allTimeTeams, bracketOf, seasonsInScope, unitRows, GRADE_L, gradeSlot, lowerRows, REGIONS, DISTRICTS, windowLabel, yearsWindow, careerRows, nFilters } = OT;
  const MAP = window.PA_MAP, MS = (MAP && MAP.w ? MAP.w / 100 : 1), HX = 65.5, HY = 39.5; // Hershey (100-wide units)
  const C = { mat: '#0B0D10', chalk: '#EEEAE1', ash: '#8E98A4', gold: '#D9A441', red: '#FF3B2F', green: '#2EC27E', slate: '#161A20', line: '#242A32' };
  const MED = ['#D9A441', '#B8BFC6', '#B5733A', '#8E5A3C', '#5F6B78', '#5F6B78', '#5F6B78', '#5F6B78'];
  const pc = (p) => (p >= 5 ? 'c5' : 'c' + p);
  const score = (v) => (v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1));


  /* ---- school name tags ----
     A school is a small pill in its own colours: filled with its main colour, a dot in its second, the name in a third.
     The colours are Brock's sets in schoolcolors.js (edited on colors.html); a school without a set snaps its badge
     colours to presets, and one with neither gets the plain grey tag. The logic lives in tags.js (shared with the editor). */
  const TAGS = window.OTTags;
  const tagPaint = (sch) => TAGS.paint(sch);
  const abbrOf = (sch) => TAGS.abbr(sch);
  /* stag(school): the full-name tag; stag(school, {abbr:true}): the short tag for tight spots (bracket lines, badges) */
  const stag = (sch, o = {}) => { const p = tagPaint(sch);
    return `<span class="stag tF${o.abbr ? ' ab' : ''}${p.none ? ' nc' : ''}${o.cls ? ' ' + o.cls : ''}" style="--tf:${p.fill};--ta:${p.acc};--ti:${p.ink}"${o.abbr ? ` title="${esc(sch)}"` : ''}><i></i>${o.abbr ? `<u>${esc(abbrOf(sch))}</u>` : esc(sch)}</span>`; };

  /* brand */
  /* the top-bar logo: the loader's lockup (index.html #boot) without its tagline. OVERTIME sits across the state
     outline; the letters inside the state are cut out of it, so the border runs between the R and the T. */
  const PA_LOCK = 'M71.9,55L66.6,55L63.1,55L59.7,55L56.2,55L52.4,55L52.2,55L42.2,54.9L38.3,54.9L37.6,54.9L30.8,54.9L28.9,54.9L21.5,55L20.1,55L15.6,55L13.1,55L5.1,55L3.4,55L3.5,51.4L3.4,50L3.4,48.8L3.4,45.8L3.5,40.8L3.4,39.2L3.4,35.8L3.4,31.3L3.4,30.3L3.4,25.5L3.4,25.3L3.5,23.7L3.4,17.8L3.4,17.5L3.4,10L3.4,7.3L6.2,6.2L8.8,4.8L9.3,4.4L9.9,3.2L10.6,3.2L10.8,3.7L12.9,2.4L15.6,1L15.6,6.8L18,6.8L26.8,6.8L29,6.9L38.8,6.8L40.4,6.8L47.7,6.9L50,6.8L57.7,6.8L60.2,6.8L60.9,6.8L66.8,6.8L73.4,6.9L74,6.9L79.8,6.9L83.9,6.8L85.3,6.8L85.9,6.8L86.7,7.9L87,7.8L87.5,9.7L88.3,9.6L89.3,10L90.5,11.1L90,11.7L90.8,12.1L91,14.9L90.6,15.4L91.9,17.3L92,18L92.6,17.9L93.5,18.5L93.3,18.8L94.8,18.8L95.6,19.1L96.6,20.6L95.6,20.8L94.4,22.1L93.6,24.3L92.9,25.2L91.8,26.2L92.2,26.1L91.3,27.3L89.6,28.4L89.8,28.8L90.1,29.8L90.9,30.9L89.6,32.9L88.9,32.9L88.4,34.7L88.9,35.1L88.5,35.6L88.5,36.4L88.6,36.8L89.1,37.4L90.1,37.3L90.6,37.9L90.5,39.7L90.8,40.5L92.2,40.8L92.6,42L93.8,43L94.2,43.9L95.3,44.7L96.1,46L95.2,46.7L94.6,46.5L93.9,47.4L92.1,48.1L90.7,49.3L89.6,50L89.4,51.5L88.3,52L87.4,52.3L86,52.5L85,53.3L83.7,52.6L82.2,52.6L81.1,52.9L80.2,53.5L79.1,55L73.5,55L72,55Z';
  const wordmark = () => { const tx = `<text x="54.48" y="157.31" font-family="'Archivo Black'" font-size="96" letter-spacing="-1">OVERTIME</text>`;
    return `<svg class="lk" viewBox="28 25 583 183" role="img" aria-label="Overtime"><defs><clipPath id="otlkpa"><path d="${PA_LOCK}" transform="translate(24,24) scale(3.271578947368421)"/></clipPath></defs><path d="${PA_LOCK}" transform="translate(24,24) scale(3.271578947368421)" fill="currentColor"/><g fill="currentColor">${tx}</g><g fill="#0B0D10" clip-path="url(#otlkpa)">${tx}</g></svg>`; };
  /* bar icons, 1.75 strokes on a 26 box. PA, Region and District are the real outline (icongeo.js, built by
     tools/build_icons.js); the selected region or district fills gold. School: a field house with the mat inside.
     Wrestlers: two wrestlers in a collar tie. */
  const IG = window.OT_ICONGEO || { outline: '', d: {}, r: {} }, SW = 1.75, GOLDF = '#D9A441';
  const paLine = `<path d="${IG.outline}" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round"/>`;
  const geoIcon = (shapes, sel, w) => Object.entries(shapes).map(([k, p]) => `<path d="${p}" fill="${String(k) === String(sel) ? GOLDF : 'none'}" stroke="currentColor" stroke-width="${w}" stroke-opacity=".85" stroke-linejoin="round"/>`).join('') + paLine;
  const NAVI = {
    state: (on) => `<path d="${IG.outline}" fill="${on ? GOLDF : 'none'}" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round"/>`,
    region: (sel) => geoIcon(IG.r, sel, 0.9),
    district: (sel) => geoIcon(IG.d, sel, 0.6),
    school: `<path d="M3.5 22.5 V12.5 C6 8 9.2 5.5 13 5.5 C16.8 5.5 20 8 22.5 12.5 V22.5 Z" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round"/><path d="M2 22.5 H24" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round"/><ellipse cx="13" cy="18" rx="5.6" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="13" cy="18" rx="1.5" ry=".7" fill="currentColor"/><path d="M8 10.6 H18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`,
    wrestlers: `<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7.4" r="2.2"/><circle cx="17" cy="7.4" r="2.2"/><path d="M7.4 10.2 C5.6 11.4 4.8 13.2 4.9 15.4 L3.6 22.5 M4.9 15.4 C6.4 17 7.2 19.4 7.6 22.5"/><path d="M18.6 10.2 C20.4 11.4 21.2 13.2 21.1 15.4 L22.4 22.5 M21.1 15.4 C19.6 17 18.8 19.4 18.4 22.5"/><path d="M8.2 12.6 L15.6 10 M17.8 12.6 L10.4 10"/></g>`,
    division: `<rect x="3.5" y="15" width="5" height="8" rx="1" fill="currentColor"/><rect x="10.5" y="10" width="5" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17.5" y="4" width="5" height="19" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>`,
    filters: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7H22M4 13H22M4 19H22"/></g><circle cx="9" cy="7" r="2.6" fill="var(--slate)" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="13" r="2.6" fill="var(--slate)" stroke="currentColor" stroke-width="2"/><circle cx="11" cy="19" r="2.6" fill="var(--slate)" stroke="currentColor" stroke-width="2"/>`,
    weights: `<path d="M9 8.5 A4 4 0 1 1 17 8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 11 H19.5 L22 23 H4 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    search: `<circle cx="11.5" cy="11.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16.5 16.5 L22 22" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
    menu: `<path d="M4 8 H22 M4 13 H22 M4 18 H22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
    /* the View item: one glyph per view */
    v_map: `<path d="M3 7 L9 4.5 L17 7 L23 4.5 V19 L17 21.5 L9 19 L3 21.5 Z M9 4.5 V19 M17 7 V21.5" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round"/>`,
    v_rank: `<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round"><path d="M9 6.5 H23 M9 13 H20 M9 19.5 H16"/></g><g fill="currentColor"><circle cx="4.5" cy="6.5" r="1.6"/><circle cx="4.5" cy="13" r="1.6"/><circle cx="4.5" cy="19.5" r="1.6"/></g>`,
    v_time: `<g fill="currentColor"><rect x="3" y="5" width="4" height="4" rx=".8" opacity=".35"/><rect x="8" y="5" width="4" height="4" rx=".8" opacity=".6"/><rect x="13" y="5" width="4" height="4" rx=".8"/><rect x="18" y="5" width="4" height="4" rx=".8" opacity=".7"/><rect x="3" y="11" width="4" height="4" rx=".8" opacity=".8"/><rect x="8" y="11" width="4" height="4" rx=".8" opacity=".45"/><rect x="13" y="11" width="4" height="4" rx=".8" opacity=".6"/><rect x="18" y="11" width="4" height="4" rx=".8"/><rect x="3" y="17" width="4" height="4" rx=".8" opacity=".5"/><rect x="8" y="17" width="4" height="4" rx=".8"/><rect x="13" y="17" width="4" height="4" rx=".8" opacity=".35"/><rect x="18" y="17" width="4" height="4" rx=".8" opacity=".6"/></g>`,
    v_team: `<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round"><rect x="3.5" y="4" width="19" height="18" rx="2"/><path d="M3.5 10 H22.5 M3.5 16 H22.5 M9.5 4 V22"/></g><path d="M13 7 H20 M13 13 H18.5 M13 19 H17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`,
    v_brk: `<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"><path d="M3 5 H8 V10 H3 M3 16 H8 V21 H3 M8 7.5 H12 V18.5 H8 M12 13 H17"/></g><g fill="currentColor"><circle cx="20.5" cy="13" r="2.6"/></g>`,
    v_seasons: `<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="5.5" width="19" height="17" rx="2"/><path d="M3.5 10.5 H22.5 M8.5 3 V7.5 M17.5 3 V7.5"/></g><g fill="currentColor"><rect x="6.5" y="13" width="3" height="3" rx=".6"/><rect x="11.5" y="13" width="3" height="3" rx=".6"/><rect x="16.5" y="13" width="3" height="3" rx=".6"/><rect x="6.5" y="17.5" width="3" height="3" rx=".6"/><rect x="11.5" y="17.5" width="3" height="3" rx=".6"/></g>`,
  };
  /* the stopwatch O from the wordmark, on its own: crown, ring, the red overtime wedge, the hand */
  const stopwatch = (sz = 26) => { const cx = 13, cy = 14.5, R = 9.2, a = 35 * Math.PI / 180;
    return `<svg viewBox="0 0 26 26" width="${sz}" height="${sz}" aria-hidden="true"><rect x="${cx - 2.4}" y="1.2" width="4.8" height="2.6" rx="1" fill="currentColor"/><rect x="${cx - 1.2}" y="3.4" width="2.4" height="2.2" fill="currentColor"/><circle cx="${cx}" cy="${cy}" r="${R * .9}" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M ${cx} ${cy - R * .62} A ${R * .62} ${R * .62} 0 0 1 ${(cx + R * .62 * Math.sin(a)).toFixed(2)} ${(cy - R * .62 * Math.cos(a)).toFixed(2)} L ${cx} ${cy} Z" fill="${C.red}"/><line x1="${cx}" y1="${cy}" x2="${(cx + R * .55 * Math.sin(a)).toFixed(2)}" y2="${(cy - R * .55 * Math.cos(a)).toFixed(2)}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="1.3" fill="currentColor"/></svg>`; };
  const navIcon = (k, sel) => { const v = NAVI[k]; return `<svg viewBox="0 0 26 26" aria-hidden="true">${typeof v === 'function' ? v(sel) : v || ''}</svg>`; };
  /* Overtime Rating: the wrestler's own season strength on one scale (1500 = the average state qualifier), shown as a
     labeled number in chalk. It is not colored: a rating is how good he was, not how hard something was. */
  const rtgTip = 'Overtime Rating: his strength that season from every bout at every level, on one scale for every era (1500 = the average state qualifier; 400 points ≈ 10-to-1 odds)';
  const rtgTag = (v, opts = {}) => { if (v == null || isNaN(v)) return ''; const n = OT.rtg10(v);
    return `<span class="rtg${opts.size ? ' ' + opts.size : ''}" title="${esc(opts.title || rtgTip)}"><i>${opts.label || 'RTG'}</i><b>${n}</b></span>`; };
  const classToggle = () => `<div class="seg" role="group" aria-label="Class">${['AAA', 'AA', 'ALL'].map((k) => `<button data-cls="${k}" aria-pressed="${state.cls === k}">${k === 'ALL' ? 'All' : k}</button>`).join('')}</div>`;
  /* time window: all-time, last 5 / 10 / 25 seasons, or a custom range */
  const windowToggle = () => { const w = state.win, [a, b] = yearsWindow();
    return `<div class="win"><div class="seg" role="group" aria-label="Seasons">${[['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25'], ['custom', 'Custom']].map(([k, l]) => `<button data-win="${k}" aria-pressed="${w.mode === k}">${l}</button>`).join('')}</div>${w.mode === 'custom' ? `<form class="wrange" data-wrange><input type="number" name="from" inputmode="numeric" min="1938" max="2026" value="${a}" aria-label="From"><span>–</span><input type="number" name="to" inputmode="numeric" min="1938" max="2026" value="${b}" aria-label="To"><button type="submit" class="go">Go</button></form>` : ''}</div>`; };
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

  /* all-time teams: one weight per wrestler, ranked by one value that is the same on every page (model.js attValue) */
  const ATT_NOTE_ALL = 'Ranked the same way on every page: state finishes count 60% (each finish is worth what it rates in its class, so AA places count less), peak rating 40%, each measured against every state qualifier at that weight. Regional, then district results break ties.';
  const ATT_NOTE = { state: ATT_NOTE_ALL, region: ATT_NOTE_ALL, district: ATT_NOTE_ALL, school: ATT_NOTE_ALL };
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
      const champ = s.champion; const label = u.kind === 'school' ? (t.realRank ? ordinal(t.realRank) + ' as a team' : ordinal(t.rank) + ' by points') : u.kind === 'state' ? (champ ? esc(champ.id) + (s.real ? ` ${champ.score}` : s.year < OT.TEAMSCORES_FROM ? ' <small class="ash">by points · team scores not published before 1976</small>' : ' <small class="ash">by points</small>') : '') : (t.rows[0] ? esc(t.rows.filter((r) => r.place === 1).map((r) => r.name).slice(0, 2).join(', ')) || '–' : '–');
      const n = `${t.n || 0} medal${t.n === 1 ? '' : 's'}${t.titles ? ` · ${t.titles} title${t.titles === 1 ? '' : 's'}` : ''}`;
      const pod = t.rows.filter((r) => r.place).sort((a, b) => a.slot - b.slot || a.place - b.place);
      const byW = d3.groups(pod, (r) => r.w);
      const podium = lazyPod(() => `${OT.podiumC(placeCounts(pod), { sm: true })}${byW.map(([w, rs]) => `<div class="prow"><a class="w" href="${OT.bhref(OT.bkey(rs[0]))}" title="open the ${s.year} ${wShort(w)} bracket">${wShort(w)}</a><div class="ps">${rs.map((r) => `<span><i style="color:${MED[r.place - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`} ${rtgTag(OT.ratingOf(r, 'state'), { size: 'xs' })}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}`);
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${s.year}</span><span class="c">${label}</span><span class="n">${n}</span></div>${podium}`;
    }).join('');
    const first = S[S.length - 1].S.year, last = S[0].S.year;
    return `<details class="drawer" open><summary><span><b class="num" style="font-size:20px">${S.length}</b> <span class="muted">seasons · ${first}–${last}</span></span><span class="k">Open</span></summary><div class="body">${rows}</div></details>`;
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
    return `<details class="drawer" open><summary><span><b class="num" style="font-size:20px">${years.length}</b> <span class="muted">seasons · ${years[years.length - 1]}–${years[0]}</span></span><span class="k">Open</span></summary><div class="body">${body}</div></details>`;
  }
  /* medal chips */
  const chips = (places) => places.map((n, i) => n ? `<span class="chip ${pc(i + 1)}" title="${n} × ${ordinal(i + 1)}">${n}×${i + 1}</span>` : '').join('');
  /* wrestler card: school-colored stripe + badge, name, district/region icons, then the career matrix (D/R/S × FR–SR) in small pills */
  const LVL_ICON = { district: 'district', regional: 'region', state: 'state' };
  const wrestlerCard = (w) => {
    const id = OT.SB && OT.SB.identity(w.sch); const p1 = (id && id.primary) || '#5F6B78', p2 = (id && id.secondary) || '#EEEAE1';
    const badge = stag(w.sch, { abbr: true });
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
    const dist = (p) => { if (!p.cls || !p.d || p.year > OT.YEARS[OT.YEARS.length - 1]) return null;
      if (!OT.lowerCovered('district', p.year, p.cls, p.d)) { if (OT.sectionCovered(p.year, p.cls, p.d)) return opts.full && OT.lowerLoaded(p.year, 'section') ? { year: p.year, dnc: true } : null; return { year: p.year, nodata: true, src: 'no district bracket on record' }; }
      return opts.full && OT.lowerLoaded(p.year, 'district') ? { year: p.year, dnc: true } : null; };
    const cell = (lvl, i) => {
      const p = cols[i]; if (!p) return null;
      if (p.empty) return lvl === 'district' ? dist(p) : null;
      const s = apps.find((a) => a.year === p.year); const base = { year: p.year, w: p.w, r: s || p };
      if (lvl === 'state') return s ? (s.place ? { ...base, place: s.place } : { ...base, q: true }) : null;
      const r = low.find((x) => x.lvl === lvl && x.year === p.year);
      if (!r && lvl === 'district') { // a section that was the district round: placed, advanced or entered (full field loaded)
        const sr = low.find((x) => x.lvl === 'section' && x.year === p.year) || OT.sectionFor(apps.length ? apps : low, p.year);
        if (sr) return sr.place ? { ...base, r: sr, w: sr.w, place: sr.place, sec: true } : higher(lvl, p.year) ? { ...base, r: sr, w: sr.w, q: true, sec: true } : { ...base, r: sr, w: sr.w, dnp: true, sec: true }; }
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
    return { cols, rows: [['state', 'State'], ['regional', 'Regional'], ['district', 'District']].map(([k, l]) => ({ k, l, cells: [0, 1, 2, 3].map((i) => cell(k, i)) })) };
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
  /* road to Hershey: one season as a line across the state */
  function road(r, W) {
    const s = 3, X = 6, Y = 10; const P = (x, y) => [X + x * s, Y + y * s];
    const d0 = (MAP.dot[r.d] || [300, 300]).map((v) => v / MS); const [dx, dy] = P(d0[0], d0[1]), [hx, hy] = P(HX, HY);
    const rx = dx + (hx - dx) * 0.5, ry = Math.min(dy, hy) - 14;
    const placed = !!r.place, reg = r.reg;
    return `<svg viewBox="0 0 320 190" role="img" aria-label="${r.year} road to Hershey"><g transform="translate(${X},${Y}) scale(${s / MS})"><path d="${MAP.outline}" fill="${C.slate}" stroke="${C.ash}" stroke-width="${0.45 * MS}" stroke-linejoin="round"/></g>
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
  const BV_LVLS = ['state', 'regional', 'district'];   // same order as careerCells rows: State on top everywhere
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
        const rr = here ? r : c && c.r && !c.dnc && !c.nodata ? c.r : null; const fv = rr ? OT.fieldOf(rr, row.k) : null;
        h += `<span class="pw" style="${at(k + 2, i + 2)}">${fv ? OT.sbar(fv, row.k, (rr.year || '') + ' ' + row.k) : '<span class="sgn sg0"></span>'}${cell}</span>`;
      });
    });
    return `<span class="cm bvm">${h}</span>`;
  }

  const RES = { fall: 'Fall', tf: 'TF', md: 'MD', dec: 'Dec', ff: 'FF', inj: 'Inj', dq: 'DQ' };
  const resTxt = (b) => [RES[b[4]] ?? b[4], b[5], b[6]].filter(Boolean).join(' ');
  const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };

  /* ---- the bracket as it was wrestled ----
     Bouts carry side, depth from the final, winner, loser and result, not bracket slots, so the tree is rebuilt from who
     advanced: a bout's two feeders are each wrestler's previous win on the same side. Top/bottom follows the order the
     bouts were read off the PDF, which runs top to bottom. Wrestlers with no feeder (byes, consolation drop-ins) enter
     where they first wrestled. Each match box: two bout lines, the result above (with the bolt on an upset), winner bright.
     Desktop draws the whole tree; a phone pages through it one round at a time (bracketPager). */
  function buildTrees(bouts, sideOk) {
    const B = bouts.map((b, i) => ({ b, i, d: b[1] })).filter((x) => sideOk(x.b[0]));
    const by = new Map(); const nk = OT.nkey;
    B.forEach((x) => [x.b[2], x.b[3]].forEach((n) => { const k = nk(n); (by.get(k) || by.set(k, []).get(k)).push(x); }));
    const feeder = (x, name) => { let best = null; (by.get(nk(name)) || []).forEach((y) => { if (y !== x && nk(y.b[2]) === nk(name) && y.d > x.d && (!best || y.d < best.d)) best = y; }); return best; };
    const parentOf = (x) => { let best = null; (by.get(nk(x.b[2])) || []).forEach((y) => { if (y !== x && y.d < x.d && (!best || y.d > best.d)) best = y; }); return best; };
    const used = new Set();
    const node = (x) => { used.add(x); const ps = [x.b[2], x.b[3]].map((n) => { const f = feeder(x, n); return { name: n, won: n === x.b[2], child: f && !used.has(f) ? node(f) : null }; });
      ps.forEach((p) => { p.key = p.child ? p.child.minI : 1e9 + (p.won ? 0 : 1); });
      ps.sort((p, q) => p.key - q.key);
      const kids = ps.filter((p) => p.child).map((p) => p.child);
      return { x, ps, minI: Math.min(x.i, ...kids.map((k) => k.minI)), size: ps.reduce((t, p) => t + (p.child ? p.child.size : 1), 0), maxD: Math.max(x.d, ...kids.map((k) => k.maxD)) }; };
    return B.filter((x) => !parentOf(x)).sort((p, q) => p.d - q.d || p.i - q.i).map(node);
  }
  function bracketTree(trees, ctx, opts) {
    if (!trees.length) return '';
    const BW = 300, GAP = 30, SH = 37, LH = 26, TOP = 26;
    const maxD = Math.max(...trees.map((t) => t.maxD)), minD = Math.min(...trees.map((t) => t.x.d));
    const cols = maxD - minD + 1, END = 112;
    const W = cols * (BW + GAP) + END;
    let y0 = TOP, boxes = '', paths = [], gold = [];
    const X = (d) => (maxD - d) * (BW + GAP);
    const place = (n, top) => { // returns center y
      let cur = top; const ys = n.ps.map((p) => { if (p.child) { const c = place(p.child, cur); cur += p.child.size * SH; return c; } const c = cur + SH / 2; cur += SH; return null; });
      const cy = top + n.size * SH / 2; const x = X(n.x.d);
      const lineY = [cy - LH / 2, cy + LH / 2];
      n.ps.forEach((p, k) => { if (p.child) { const c = p.child; const x1 = X(c.x.d) + BW, yc = c.cy, xm = x - GAP / 2; const d = `M${x1} ${yc} H${xm} V${lineY[k]} H${x}`; (ctx.isFocus(p.name) ? gold : paths).push(d); } });
      n.cy = cy;
      const b = n.x.b; const rows = n.ps.map((p) => ctx.line(p.name, p.won, b)).join('');
      boxes += `<div class="bxm${n.ps.some((p) => ctx.isFocus(p.name)) ? ' me' : ''}" style="left:${x}px;top:${cy - LH}px;width:${BW}px"><span class="bxr">${b.u ? BOLT : ''}${esc(resTxt(b))}</span>${rows}</div>`;
      return cy;
    };
    const heads = [];
    for (let d = maxD; d >= minD; d--) heads.push(`<span class="bxh" style="left:${X(d)}px;width:${BW}px">${esc(opts.roundName(d))}</span>`);
    trees.forEach((t) => {
      const cy = place(t, y0);
      const w = t.x.b[2], x = X(t.x.d) + BW;
      (ctx.isFocus(w) ? gold : paths).push(`M${x} ${cy - LH / 2} H${x + GAP / 2}`);
      if (t.x.d === 0 && opts.finish) boxes += `<div class="bxw" style="left:${x + GAP / 2 + 4}px;top:${cy - LH / 2 - 15}px">${opts.finish(w)}</div>`;
      y0 += t.size * SH + 18;
    });
    const H = y0;
    return `<div class="bxs"><div class="bxc" style="width:${W}px;height:${H}px">${heads.join('')}<svg class="bxj" width="${W}" height="${H}" aria-hidden="true"><path d="${paths.join(' ')}"/><path class="g" d="${gold.join(' ')}"/></svg>${boxes}</div></div>`;
  }

  /* ---- the bracket on a phone: one round per page ----
     A bout line with the full name, his school pill, grade, signal bars and rating needs the whole width, so a phone shows
     one round at a time: swipe or tap a round chip. The two bouts that meet in the next round share a bracket on the right;
     the next round peeks in from the edge. Championship and consolation (with the placement bouts) each have their pages. */
  const BOLT = '<svg class="ubolt" viewBox="0 0 12 16" role="img" aria-label="Upset"><title>Upset</title><path d="M7.2 0 1 9h4.2L3.8 16 11 6.4H6.6z" fill="currentColor"/></svg>';
  function roundsOf(trees) { const by = new Map(); const visit = (n, par) => { n.par = par; n.ps.forEach((p) => { if (p.child) visit(p.child, n); }); (by.get(n.x.d) || by.set(n.x.d, []).get(n.x.d)).push(n); }; trees.forEach((t) => visit(t, null)); return by; }
  function bracketPager(pages, ctx, side) {
    if (!pages.length) return '';
    const card = (b) => `<div class="b2m${[b[2], b[3]].some((n) => ctx.isFocus(n)) ? ' me' : ''}"><div class="bxr2">${b.u ? BOLT : ''}<span>${esc(resTxt(b))}</span></div>${ctx.line(b[2], true, b)}${ctx.line(b[3], false, b)}</div>`;
    let at = pages.findIndex((pg) => pg.groups.some((g) => g.some((b) => ctx.isFocus(b[2]) || ctx.isFocus(b[3])))); if (at < 0) at = 0;
    const chips = `<div class="b2chips" role="tablist">${pages.map((pg, i) => `<button role="tab" data-b2pg="${i}" aria-selected="${i === at}" title="${esc(pg.name)}">${pg.chip}</button>`).join('')}</div>`;
    const body = pages.map((pg) => `<div class="b2pg">${pg.groups.map((g) => `<div class="b2g${g.length > 1 ? ' pair' : ''}">${g.map(card).join('')}</div>`).join('')}</div>`).join('');
    return `${chips}<div class="b2pager" data-b2side="${side}" data-b2at="${at}">${body}</div>`;
  }
  /* pages from the bout trees: one per round, earliest first; bouts paired by the bout they feed */
  function pagesOf(trees, name, chip) {
    const by = roundsOf(trees);
    return Array.from(by.keys()).sort((a, b) => b - a).map((d, i, all) => { const groups = []; by.get(d).forEach((n) => { const g = groups[groups.length - 1]; if (g && n.par && g.par === n.par) g.push(n.x.b); else { const ng = [n.x.b]; ng.par = n.par; groups.push(ng); } });
      return { name: name(d), chip: chip(d, i, all.length), groups }; });
  }
  /* swipe and chips: the chip row follows the page in view, and the pager is as tall as that page */
  function wirePager(root) {
    root.querySelectorAll('.b2pager').forEach((pg) => {
      const chips = pg.previousElementSibling, pages = Array.from(pg.children);
      const fit = (i) => { pg.style.height = pages[i].offsetHeight + 'px'; Array.from(chips.children).forEach((c, j) => c.setAttribute('aria-selected', String(j === i))); const c = chips.children[i]; if (c && (c.offsetLeft < chips.scrollLeft || c.offsetLeft + c.offsetWidth > chips.scrollLeft + chips.clientWidth)) chips.scrollLeft = c.offsetLeft - 8; pg.dataset.b2at = i; };
      const go = (i, smooth) => { const left = pages[i].offsetLeft - pages[0].offsetLeft; pg.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' }); fit(i); };
      go(+pg.dataset.b2at || 0, false);
      let t = 0; pg.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const x = pg.scrollLeft; let best = 0; pages.forEach((p, i) => { if (Math.abs(p.offsetLeft - pages[0].offsetLeft - x) < Math.abs(pages[best].offsetLeft - pages[0].offsetLeft - x)) best = i; }); fit(best); }, 60); }, { passive: true });
      chips.addEventListener('click', (e) => { const b = e.target.closest('[data-b2pg]'); if (b) go(+b.dataset.b2pg, true); });
    });
  }

  /* the eight medalists: top three on a podium (name, school, his rating with its signal bars), 4th–8th as rows. The
     bars on a rating are the same six tiers as the bracket's own level, so a rating reads against that level's brackets. */
  function medalists(placers, info, lvl) {
    const rtg = (i) => (i.rt == null ? '' : `<span class="mdsg">${OT.rtgBars(i.rt)}<b>${i.raw ? Math.round(i.rt) : OT.rtg10(i.rt)}</b></span>`);
    const by = (p) => placers.filter((r) => r.place === p);
    const chip = (r) => stag(r.sch, { abbr: true });
    const stats = (r) => { const i = info(r); return `<span class="mdv" title="${i.raw ? 'RTG after the tournament' : 'season rating'}">${rtg(i)}</span>`; };
    const H = { 1: 70, 2: 52, 3: 40 };
    const top = [2, 1, 3].map((p) => { const rs = by(p); return `<div class="mdst p${p}">${rs.map((r) => `<a class="mdn" href="${OT.wrestlerHref(r)}">${chip(r, 26)}<b>${esc(r.name)}</b><small>${esc(r.sch)}</small>${stats(r)}</a>`).join('') || '<span class="mdn"><b class="muted">—</b></span>'}<div class="mdb m${p}" style="height:${H[p]}px"><span>${p}</span></div></div>`; }).join('');
    /* 4th–8th: place, name over his full school tag (as in the field below), then his rating with its signal bars in a
       fixed column at the right edge so the numbers line up down the list */
    const rest = [4, 5, 6, 7, 8].flatMap((p) => by(p).map((r) => { const i = info(r);
      return `<a class="mdr" href="${OT.wrestlerHref(r)}"><i class="pill ${pc(p)}">${p}</i><span class="mdnm"><b>${esc(r.name)}</b>${stag(r.sch)}</span><span class="mdrt">${rtg(i)}</span></a>`; })).join('');
    return `<div class="md"><div class="mdtop">${top}</div>${rest ? `<div class="mdrest">${rest}</div>` : ''}</div>`;
  }

  /* ---- tournament bracket view: one year · level · unit · weight ----
     Header and strength of competition, the medalists, the bracket as wrestled (championship, then consolation, then
     placement bouts), then the field: every entrant with his bouts and career matrix. */
  function bracketView(key, focusSlug) {
    const F = OT.bracketField(key); if (!F) return '';
    const lvlName = { state: 'State', regional: 'Regional', district: 'District', section: 'Section' }[F.lvl] || 'District';
    const unit = F.unitLabel;
    const title = `${F.year} · ${unit}${F.lvl === 'state' ? ' State' : ''} · ${F.cls === 'single' ? 'one class' : F.cls} · ${wShort(F.w)}`;
    const SB_ = OT.sosBracket(key), nk = OT.nkey;
    const head = `<div class="bvhead"><a class="bvclose" href="${OT.bhref(null)}" aria-label="Close">✕</a><div><div class="k">${lvlName.toUpperCase()} BRACKET</div><h2>${esc(title)}</h2></div></div>${F.field != null ? `<div class="bvfield">${OT.fieldGauge(F.field, F.lvl)}</div>` : ''}`;
    const SRCI = { d3records: ['champions only', 'District III Records', 'https://piaadistrict3records.com/'], wpial: ['champions only', 'WPIAL', 'https://wpial.org/'] }[F.src];
    const srcNote = SRCI ? `<div class="bvsrc">${SRCI[0]} · <a href="${SRCI[2]}" target="_blank" rel="noopener">${SRCI[1]}</a> · the bracket archive has no file for this tournament</div>` : '';
    if (SRCI && F.entrants.length) return head + srcNote + `<div class="bvsrclist">${F.entrants.map((e) => `<a class="bvsrcrow" href="#wrestler/${e.slug}"><span class="pill ${pc(e.r.place)}">${e.r.place}</span><span class="bvsrcn"><b>${esc(e.r.name)}</b><small>${esc(e.r.sch)}</small></span></a>`).join('')}</div>`;
    if (!F.entrants.length) return head + empty(F.lvl === 'state' ? 'No entrants on record for this bracket.' : F.covered ? (F.loading ? 'Loading the field…' : 'No placewinners recorded at this weight.') : 'The archive has no file for this tournament.');
    const phone = (window.innerWidth || 390) < 900;
    const EN = new Map(F.entrants.map((e) => [nk(e.r.name), e]));
    const rOfName = (n) => { const x = SB_ && SB_.s[nk(n)]; if (x) return x[0]; const e = EN.get(nk(n)); return e ? OT.ratingOf(e.r, F.lvl) : null; };
    const rOf = (r) => rOfName(r.name);
    const bouts = SB_ ? SB_.b : [];
    /* RTG as of each bout: each bout carries both wrestlers' season-so-far rating before and after it, so
       the number after one bout is the number going into the next. Older season files without it fall back to the
       season-rating step. */
    const hasElo = bouts.some((b) => b.length > 8);
    const PRE = new Map(), EIN = new Map(), EOUT = new Map();
    const ordered = bouts.slice().sort((a, b) => (a[0] === 'champ' ? 0 : 1) - (b[0] === 'champ' ? 0 : 1) || b[1] - a[1]);
    bouts.forEach((b) => { if (hasElo && b.length > 8) PRE.set(b, [b[7], b[8]]); });
    if (hasElo) { const seq = new Map(); bouts.filter((b) => b.length > 8).forEach((b) => { [[b[2], b[7], b[9]], [b[3], b[8], b[10]]].forEach(([n, a, z]) => { if (a == null) return; const k = nk(n); (seq.get(k) || seq.set(k, []).get(k)).push([a, z]); }); });
      seq.forEach((v, k) => { const lo = v.reduce((m, x) => (x[0] < m[0] ? x : m)); let first = v[0], last = v[0];
        /* first bout = the one whose "before" no other bout's "after" produced; last = the one whose "after" feeds none */
        const afters = new Set(v.map((x) => x[1])), befores = new Set(v.map((x) => x[0]));
        first = v.find((x) => !afters.has(x[0])) || lo; last = v.find((x) => !befores.has(x[1])) || v[v.length - 1];
        EIN.set(k, first[0]); EOUT.set(k, last[1]); }); }
    const focusN = (() => { const e = F.entrants.find((x) => x.slug === focusSlug); return e ? nk(e.r.name) : null; })();
    const ctx = { phone, isFocus: (n) => focusN && nk(n) === focusN,
      line: (n, won, b) => { const e = EN.get(nk(n)); const pr = PRE.get(b); const rt = pr ? (won ? pr[0] : pr[1]) : rOfName(n);
        const chip = e ? stag(e.r.sch, { abbr: true, cls: 'xs' }) : '<i class="bxnc"></i>';
        const tip = `${n}${e ? ' · ' + e.r.sch : ''}${e && e.seedLabel ? ' · seed ' + e.seedLabel : ''}${rt != null ? (pr ? ' · RTG going in ' + Math.round(rt) : ' · RTG ' + OT.rtg10(rt)) : ''}`;
        const inner = `${chip}<i class="b2gr">${e && e.r.grade ? esc(e.r.grade) : ''}</i><span class="b2n">${esc(n)}</span><span class="b2v">${rt != null ? OT.rtgBars(rt) : '<i class="b2sg"></i>'}<b${rt == null ? ' class="nr"' : ''}>${rt != null ? (pr ? Math.round(rt) : OT.rtg10(rt)) : '–'}</b></span>`;
        return e ? `<a class="b2l${won ? ' w' : ''}${ctx.isFocus(n) ? ' me' : ''}" href="#wrestler/${e.slug}" title="${esc(tip)}">${inner}</a>` : `<span class="b2l${won ? ' w' : ''}" title="${esc(tip)}">${inner}</span>`; } };
    const RNC = (d) => ['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Pigtails'][d] || 'Prelims';
    const RNX = (d) => (d === 0 ? '3rd place' : d === 1 ? 'Consolation semis' : 'Consolation R' + d);
    const champT = buildTrees(bouts, (s) => s === 'champ');
    const consT = buildTrees(bouts, (s) => s === 'p3' || s === 'cons');
    const placeB = bouts.filter((b) => b[0] === 'p5' || b[0] === 'p7').sort((p, q) => (p[0] > q[0]) - (p[0] < q[0]));
    const finish = (lab) => (n) => `<i>${lab}</i><b>${esc(n)}</b>`;
    const placeBox = (b) => `<div class="bxp"><div class="k">${b[0] === 'p5' ? '5th place' : '7th place'}</div><div class="bxm st"><span class="bxr">${b.u ? BOLT : ''}${esc(resTxt(b))}</span>${ctx.line(b[2], true, b)}${ctx.line(b[3], false, b)}</div></div>`;
    const bxside = state.bxside === 'cons' && consT.length + placeB.length ? 'cons' : 'champ';
    const sideSeg = consT.length || placeB.length ? `<div class="seg sm b2side" role="group" aria-label="Side"><button data-bxside="champ" aria-pressed="${bxside === 'champ'}">Championship</button><button data-bxside="cons" aria-pressed="${bxside === 'cons'}">Consolation</button></div>` : '';
    const CHC = (d) => ['F', 'SF', 'QF', 'R16', 'R32', 'PIG'][d] || 'PRE';
    const CHX = (d, i) => (d === 0 ? '3RD' : d === 1 ? 'CSF' : 'C' + (i + 1));
    const pages = bxside === 'champ' ? pagesOf(champT, RNC, CHC)
      : pagesOf(consT, RNX, CHX).concat(placeB.map((b) => ({ name: b[0] === 'p5' ? '5th place' : '7th place', chip: b[0] === 'p5' ? '5TH' : '7TH', groups: [[b]] })));
    const bracketHTML = !champT.length ? '' : phone ? `<section class="bxsec b2sec">${sideSeg}${bracketPager(pages, ctx, bxside)}</section>`
      : `<section class="bxsec"><div class="bxk"><h3>Championship</h3></div>${bracketTree(champT, ctx, { roundName: RNC, finish: finish('Champion') })}</section>`
      + (consT.length ? `<section class="bxsec"><div class="bxk"><h3>Consolation</h3></div>${bracketTree(consT, ctx, { roundName: RNX, finish: finish('3rd') })}</section>` : '')
      + (placeB.length ? `<section class="bxsec"><div class="bxk"><h3>Placement bouts</h3></div><div class="bxps">${placeB.map(placeBox).join('')}</div></section>` : '');
    // the field: every entrant with his bouts and career matrix
    const sortBy = state.bvsort === 'rtg' ? 'rtg' : 'seed';
    const sortSeg = F.entrants.length > 1 && !F.src ? `<div class="seg sm bvsort" role="group" aria-label="Order"><button data-bvsort="seed" aria-pressed="${sortBy === 'seed'}">Seed</button><button data-bvsort="rtg" aria-pressed="${sortBy === 'rtg'}">Rating</button></div>` : '';
    const boutsOf = (name) => { const n = nk(name); return bouts.filter((b) => nk(b[2]) === n || nk(b[3]) === n).sort((a, b) => (a[0] !== 'champ') - (b[0] !== 'champ') || b[1] - a[1]); };
    const boutTxt = (b, name) => { const won = nk(b[2]) === nk(name); let sc = b[5] || ''; if (!won && /^\d+-\d+$/.test(sc)) sc = sc.split('-').reverse().join('-'); const r = [{ fall: 'fall', tf: 'TF', md: 'MD', dec: '', ff: 'forfeit', inj: 'inj.', dq: 'DQ' }[b[4]] ?? b[4], sc, b[6]].filter(Boolean).join(' ');
      return `<span class="${won ? 'bo-w' : 'bo-l'}" title="${won ? 'beat' : 'lost to'} ${esc(won ? b[3] : b[2])}${b[0] === 'champ' ? '' : ' (consolation)'}">${won ? 'W' : 'L'} ${esc(r)}</span>`; };
    const RSH = (b) => { const d = b[1]; if (b[0] === 'champ') return ['Final', 'SF', 'QF', 'R16', 'R32', 'Pig'][d] || 'Pre'; if (b[0] === 'p3') return '3rd'; if (b[0] === 'p5') return '5th'; if (b[0] === 'p7') return '7th'; return d === 1 ? 'C-SF' : 'C' + d; };
    const ents = sortBy === 'rtg' ? F.entrants.slice().sort((a, b) => (rOf(b.r) || 0) - (rOf(a.r) || 0)) : F.entrants;
    const lines = ents.map((e) => {
      const r = e.r, me = e.slug === focusSlug;
      const sx = SB_ && SB_.s[nk(r.name)]; const bl = boutsOf(r.name);
      {
        const fin = r.place ? `<span class="bvfin ${pc(r.place)}" title="Finished ${ordinal(r.place)}">${ordinal(r.place)}</span>` : e.adv ? '<span class="bvfin adv" title="Advanced">Adv</span>' : '';
        const rows = bl.map((b) => { const won = nk(b[2]) === nk(r.name); const t = boutTxt(b, r.name); return `<span class="bvr">${RSH(b)}</span>${t}`; }).join('');
        const bwl = (sx && sx[1] != null) || r.record ? `<span class="bvbw2">${r.record ? `Record <b>${esc(r.record)}</b>${sx && sx[1] != null ? ' · ' : ''}` : ''}${sx && sx[1] != null ? `Best win <b>${esc(shortName(sx[2]))}</b> ${OT.rtg10(sx[1])}${sx[3] ? ` <em title="a loss to someone rated 150+ below him">· ${sx[3]} upset loss${sx[3] === 1 ? '' : 'es'}</em>` : ''}` : ''}</span>` : '';
        const bouts = rows ? `<span class="bvbl">${rows}</span>` : '';
        /* how tough his path was: his opponents' average rating going into each bout, on this level's strength scale */
        const opp = bl.map((b) => { const won = nk(b[2]) === nk(r.name); const v = b.length > 8 ? (won ? b[8] : b[7]) : null; return v != null ? v : rOfName(won ? b[3] : b[2]); }).filter((v) => v != null);
        const path = opp.length ? opp.reduce((a, v) => a + v, 0) / opp.length : null;
        const pbar = path != null ? OT.rtgBars(path) : '';
        /* his rating with the rating ladder bars used for every wrestler rating (OT.rtgBars) */
        const rv = rOf(r), rbar = rv ? OT.rtgBars(rv) : '';
        const pline = path != null ? `<span class="bvop"><span>Opponents averaged</span>${pbar}<b>${Math.round(path)}</b></span>` : '';
        return `<details class="bvc${me ? ' me' : ''}"${me ? ' open' : ''}><summary>${fin || '<span></span>'}<span class="sdg"><span class="sd">${e.seedLabel || ''}</span>${r.grade ? `<i>${r.grade}</i>` : ''}</span><span class="cn"><b>${esc(r.name)}</b><small>${stag(r.sch, { cls: 'xs' })}</small></span><span class="dsp">${rbar}${rv ? `<b class="bvrt" title="RTG">${OT.rtg10(rv)}</b>` : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="bvcx">${bouts}${pline}${bwl}${entrantMatrix(e, F)}<a class="bvgo" href="#wrestler/${e.slug}">${esc(r.name)}'s page</a></div></details>`;
      }
    }).join('');
    const advNote = F.adv ? ` The top ${F.adv} advanced${F.lvl === 'district' ? ' to regionals' : ' to Hershey'}.` : '';
    const placers = F.entrants.map((e) => e.r).filter((r) => r.place >= 1 && r.place <= 8);
    const info = (r) => ({ rt: hasElo && EOUT.has(nk(r.name)) ? EOUT.get(nk(r.name)) : rOf(r), raw: hasElo && EOUT.has(nk(r.name)) });
    return head + (placers.length ? medalists(placers, info, F.lvl) : '') + bracketHTML
      + `<section class="bxsec"><div class="bxk"><h3>The field</h3>${sortSeg}</div><div class="bvlist"${F.loading ? ' data-loading="1"' : ''}>${lines}</div></section>`
      + `<div class="note">${F.loading ? 'Loading the full field… ' : ''}${bouts.length ? (hasElo ? 'Bracket numbers are his RTG as the season went: the same season fit as his season rating, using only his bouts up to that point, with each opponent at his full-season strength. After his last bout of the season it is his season RTG. Medalists show the RTG after the tournament. ' : '') : ''}Each entrant: his bouts here, his season rating, and his career by level FR–SR with this tournament ringed.${advNote}</div>`;
  }

  Object.assign(OT, { wirePager, stag, tagPaint, rtgTag, bracketView, stopwatch, careerCells, wrestlerCard, C, MED, pc, score, wordmark, navIcon, classToggle, windowToggle, unitHeader, section, empty, bracket, rankList, unitItems, wrestlerItems, teamsBlock, seasonsDrawer, lowerSeasons, levelSwitch, namedPodium, podiumC: podium, chips, road });
})();
