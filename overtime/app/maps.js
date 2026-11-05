/* Overtime · the rating map. One picture per level, coloured by rating in the class and time window, on the same
   blue (ice) → cyan → green → yellow → orange → red (fire) scale as strength of competition, so colour always means strength.
   State: regions (the union of their member districts in the window) with district lines inside.
   Region: the whole state for context, this region's districts coloured, everything else faint.
   District: the district zoomed in, its schools as dots (colour = rating, size = score), top five labelled.
   Region shapes are merged at run time from county topology, because district membership changes over the years. */
(function () {
  'use strict';
  const OT = window.OT, M = window.PA_MAP, T = window.topojson;
  const { esc, fmt, REGIONS, DISTRICTS, slug } = OT;
  const FIVE = ['NE', 'NW', 'SC', 'SE', 'SW'];
  const r10 = (v) => (v ? Math.round(v / 10) * 10 : null);
  let PROJ = null, PATH = null;
  const proj = () => { if (!PROJ) { PROJ = d3.geoMercator().scale(M.proj.scale).translate(M.proj.translate); PATH = d3.geoPath(PROJ).digits(1); } return PROJ; };
  const geomsOf = (ds) => M.topo.objects.c.geometries.filter((g) => ds.includes(g.properties.d));
  const SHAPE = new Map();
  const shapeOf = (ds) => { const k = ds.slice().sort((a, b) => a - b).join(','); if (!SHAPE.has(k)) { proj(); SHAPE.set(k, T ? T.merge(M.topo, geomsOf(ds)) : null); } return SHAPE.get(k); };
  const dPath = (d) => M.d[d] || '';

  /* district → region in the window: the region it fed most often (rows carry the district and region of each season) */
  function membership() {
    const votes = new Map(); OT.ssIn(null).forEach((r) => { const d = r[3], g = r[4] === 'W' ? 'SW' : r[4]; if (!(d >= 1 && d <= 12) || !FIVE.includes(g)) return; const m = votes.get(d) || {}; m[g] = (m[g] || 0) + 1; votes.set(d, m); });
    const of = {}, mixed = [];
    votes.forEach((m, d) => { const e = Object.entries(m).sort((a, b) => b[1] - a[1]); of[d] = e[0][0]; if (e.length > 1 && e[1][1] > 0.05 * e[0][1]) mixed.push(d); });
    return { of, mixed };
  }
  /* colour domain: derived per unit kind and class (5th–95th percentile of season ratings since 1974), shared with the
     heat grid and the card tints so a colour means the same strength everywhere */
  const scaleFor = (vals, kind = 'district') => { const [lo, hi] = OT.ratingDom(kind); return { lo, hi, f: (x) => OT.domFrac(kind, x) }; };
  const HATCH = '<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#1A1F26"/><line x1="0" y1="0" x2="0" y2="10" stroke="#3A424D" stroke-width="3"/></pattern></defs>';
  const NOFILL = 'url(#hatch)';
  /* the colour key: the full-width cold → hot ramp between a weak icon (one bar lit) and a strong one (all four lit) */
  const sig = (n, c) => `<svg viewBox="0 0 22 18" width="22" height="18" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<rect x="${i * 5.5 + 0.5}" y="${13 - i * 4}" width="4" height="${5 + i * 4}" rx="1" fill="${i < n ? c : 'none'}" stroke="${i < n ? c : '#5F6B78'}" stroke-width="1"/>`).join('')}</svg>`;
  const legend = (sc, note, hatch) => `<div class="mlg"><div class="mlgr"><span class="mlgi" title="Weaker${sc.lo ? ' · ' + r10(sc.lo) : ''}">${sig(1, '#2C5BD8')}</span><i class="mlgbar" role="img" aria-label="Strength colour scale, ${r10(sc.lo) || '–'} to ${r10(sc.hi) || '–'}" title="Strength ${r10(sc.lo) || '–'} to ${r10(sc.hi) || '–'}"></i><span class="mlgi" title="Stronger${sc.hi ? ' · ' + r10(sc.hi) : ''}">${sig(4, '#E8392B')}</span></div>${hatch ? `<span class="mlgh"><i></i>${hatch}</span>` : ''}${note ? `<span class="mlgn">${note}</span>` : ''}</div>`;
  const tip = (name, a) => `${name}${a && a.rating ? ' · Strength ' + r10(a.rating) : ''}${a && a.score ? ' · Score ' + OT.sfmt(a.score) : ''}`;
  const svgOpen = (vb, label) => `<svg class="pam" viewBox="${vb.join(' ')}" role="img" aria-label="${esc(label)}">${HATCH}`;
  const outline = () => `<path class="pao" d="${M.outline}"/>`;

  const noData = () => (OT.state.cls === 'ALL' ? 'no data' : 'no ' + OT.state.cls + ' data in this window');
  function stateMap() {
    proj();
    const { of, mixed } = membership();
    const byD = OT.mapMode() === 'districts';
    let fills = '', lines = '', labels = '', anyNo = false;
    if (byD) {
      const L = OT.aggregateCore('district', null, 'state'); const A = new Map(L.map((a) => [a.k, a]));
      Object.keys(M.d).filter((d) => M.d[d]).map(Number).forEach((d) => {
        const a = A.get(d), col = a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL; if (!(a && a.rating)) anyNo = true;
        fills += `<a href="#district/${d}"><path class="par" data-mk="d${d}" d="${dPath(d)}" style="fill:${col}"><title>${esc(tip('District ' + d + ' · ' + (DISTRICTS[d] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></path></a>`;
        const c = d === 12 ? [M.dot[d][0] + 52, M.dot[d][1] - 10] : M.dot[d];
        labels += `<g class="pal sm${d === 12 ? ' out' : ''}" transform="translate(${c[0]},${c[1]})"><text class="pan">D${d}</text>${a && a.rating ? `<text class="pav" y="24">${r10(a.rating)}</text>` : ''}</g>`;
      });
      { const a = A.get(8), c = M.dot[8]; if (!(a && a.rating)) anyNo = true; fills += `<a href="#district/8"><circle class="pd8 on" data-mk="d8" cx="${c[0]}" cy="${c[1]}" r="9" style="fill:${a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL}"><title>${esc(tip('District 8 · ' + (DISTRICTS[8] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></circle></a>`; }
      FIVE.forEach((g) => { const ds = Object.keys(of).map(Number).filter((d) => of[d] === g && d !== 8); const shp = ds.length ? shapeOf(ds) : null; if (shp) lines += `<path class="parl thin" d="${PATH(shp)}"/>`; });
      const sc = scaleFor([], 'district');
      return wrap(svgOpen([0, 0, M.w, M.h], 'Districts of Pennsylvania coloured by rating') + fills + lines + outline() + labels + '</svg>', legend(sc, '', anyNo ? noData() : ''));
    }
    const L = OT.aggregateCore('region', null, 'state'); const A = new Map(L.map((a) => [a.k, a]));
    const sc = scaleFor([], 'region');
    FIVE.forEach((g) => {
      const ds = Object.keys(of).map(Number).filter((d) => of[d] === g && d !== 8); if (!ds.length) return;
      const a = A.get(g), col = a && a.rating ? OT.ratingColor('region', a.rating) : NOFILL, shp = shapeOf(ds), p = shp ? PATH(shp) : ds.map(dPath).join(' ');
      if (!(a && a.rating)) anyNo = true;
      fills += `<a href="#region/${g}"><path class="par" data-mk="${g}" d="${p}" style="fill:${col}"><title>${esc(tip(REGIONS[g] + ' Region', a))}</title></path></a>`;
      lines += `<path class="parl" d="${p}"/>`;
      const c = shp ? PATH.centroid(shp) : M.dot[ds[0]];
      labels += `<g class="pal" transform="translate(${c[0].toFixed(0)},${c[1].toFixed(0)})"><text class="pan">${esc(REGIONS[g])}</text>${a && a.rating ? `<text class="pav" y="30">${r10(a.rating)}</text>` : ''}</g>`;
    });
    /* any district with no member region in the window (e.g. no AAA schools) is hatched, never a silent grey */
    const covered = new Set(Object.keys(of).map(Number));
    const holes = Object.keys(M.d).filter((d) => M.d[d] && !covered.has(+d)).map((d) => `<path class="par" d="${dPath(d)}" style="fill:${NOFILL}"><title>District ${d} · ${noData()}</title></path>`).join('');
    if (holes) anyNo = true;
    const dl = Object.keys(M.d).filter((d) => M.d[d]).map((d) => `<path class="pad" d="${dPath(d)}"/>`).join('');
    const dn = Object.keys(M.dot).map((d) => `<text class="pdn" x="${M.dot[d][0]}" y="${M.dot[d][1] + (d == 8 ? -12 : 0)}">${d}</text>`).join('') + `<circle class="pd8" cx="${M.dot[8][0]}" cy="${M.dot[8][1]}" r="6"/>`;
    const note = mixed.length ? `District${mixed.length > 1 ? 's' : ''} ${mixed.join(', ')} changed region in this window; shown with the region ${mixed.length > 1 ? 'each' : 'it'} fed most` : '';
    return wrap(svgOpen([0, 0, M.w, M.h], 'Regions of Pennsylvania coloured by rating') + fills + holes + dl + lines + outline() + dn + labels + '</svg>', legend(sc, note, anyNo ? noData() : ''));
  }

  function regionMap(code) {
    proj();
    const { of } = membership();
    const mine = Object.keys(of).map(Number).filter((d) => of[d] === code);
    const L = OT.aggregateCore('district', { kind: 'region', id: code }, 'region'); const A = new Map(L.map((a) => [a.k, a]));
    const sc = scaleFor([], 'district'); let anyNo = false;
    let fills = '', labels = '';
    Object.keys(M.d).filter((d) => M.d[d]).map(Number).forEach((d) => {
      const isMine = mine.includes(d), a = A.get(d);
      if (!isMine) { fills += `<path class="pax" d="${dPath(d)}"/>`; return; }
      const col = a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL; if (!(a && a.rating)) anyNo = true;
      fills += `<a href="#district/${d}"><path class="par" data-mk="d${d}" d="${dPath(d)}" style="fill:${col}"><title>${esc(tip('District ' + d + ' · ' + (DISTRICTS[d] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></path></a>`;
      const c = d === 12 ? [M.dot[d][0] + 52, M.dot[d][1] - 10] : M.dot[d]; labels += `<g class="pal${d === 12 ? ' out' : ''}" transform="translate(${c[0]},${c[1]})"><text class="pan">D${d}</text>${a && a.rating ? `<text class="pav" y="28">${r10(a.rating)}</text>` : ''}</g>`;
    });
    if (mine.includes(8)) { const a = A.get(8), c = M.dot[8]; fills += `<a href="#district/8"><circle class="pd8 on" data-mk="d8" cx="${c[0]}" cy="${c[1]}" r="9" style="fill:${a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL}"><title>${esc(tip('District 8 · ' + (DISTRICTS[8] || ''), a))}</title></circle></a>`; }
    const shp = shapeOf(mine.filter((d) => d !== 8)), rl = shp ? `<path class="parl" d="${PATH(shp)}"/>` : '';
    return wrap(svgOpen([0, 0, M.w, M.h], (REGIONS[code] || code) + ' districts coloured by rating') + fills + rl + outline() + labels + '</svg>', legend(sc, '', anyNo ? noData() : ''));
  }

  /* schools inside a district: real locations when tools/build_school_geo.js has run, otherwise a grid in the shape */
  function districtMap(d) {
    proj();
    const GEO = window.WR_SCHOOLGEO || null; const hasGeo = GEO && Object.keys(GEO).length > 0;
    const L = OT.aggregateCore('school', { kind: 'district', id: d }, 'district').filter((a) => a.rating || a.score);
    const box = (M.box[d] || [0, 0, M.w, M.h]).slice(), pad = 0.14 * Math.max(box[2] - box[0], box[3] - box[1]);
    // square-ish frame so a thin district isn't stretched edge to edge, with room for the neighbours
    let bw = box[2] - box[0] + 2 * pad, bh = box[3] - box[1] + 2 * pad; const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    if (bw / bh < 1.4) bw = bh * 1.4; else if (bw / bh > 2.2) bh = bw / 2.2;
    const vb = [cx - bw / 2, cy - bh / 2, bw, bh];
    const k = vb[2] / M.w; // marks and text scale with the zoom
    // neighbouring districts drawn faint for context, labelled with their number
    const nbrs = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12].filter((x) => x !== d && dPath(x)).map((x) => `<a href="#district/${x}"><path class="pnb" d="${dPath(x)}" style="stroke-width:${(1 * k).toFixed(2)}"><title>District ${x}</title></path></a>`).join('')
      + [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12].filter((x) => x !== d && M.dot[x]).map((x) => `<text class="pnbl" x="${M.dot[x][0]}" y="${M.dot[x][1]}" style="font-size:${(13 * k).toFixed(1)}px">D${x}</text>`).join('');
    const own = OT.unitAgg({ kind: 'district', id: d }); const dcol = own && own.rating ? OT.ratingColor('district', own.rating) : NOFILL;
    if (!hasGeo) {
      /* no real coordinates yet: the district itself, coloured by its rating; no invented school positions */
      const base = d === 8 ? `<circle cx="${M.dot[8][0]}" cy="${M.dot[8][1]}" r="${(14 * k).toFixed(1)}" style="fill:${dcol}"/>` : `<path class="par" d="${dPath(d)}" style="fill:${dcol};stroke-width:${(2 * k).toFixed(2)}"/>`;
      const c = M.dot[d];
      const lab = own && own.rating ? `<g class="pal" transform="translate(${c[0]},${c[1]}) scale(${k.toFixed(3)})"><text class="pan">District ${d}</text><text class="pav" y="30">${r10(own.rating)}</text></g>` : '';
      return wrap(svgOpen(vb, 'District ' + d + ' coloured by rating') + nbrs + `<path class="paxo" d="${M.outline}" style="stroke-width:${(1.5 * k).toFixed(2)}"/>` + base + lab + '</svg>', legend(scaleFor([], 'district'), 'School locations coming', own && own.rating ? '' : noData()));
    }
    const sc = scaleFor([], 'school');
    const smax = Math.max(1, ...L.map((a) => a.score || 0));
    const placed = []; let missing = 0;
    L.forEach((a) => { const name = OT.UD.schools[a.k]; const g = GEO[name]; if (g) { const xy = PROJ([g[0], g[1]]); if (xy) { placed.push([a, xy]); return; } } missing++; });
    const top5 = new Set(L.slice().sort((p, q) => (q.rating || 0) - (p.rating || 0)).slice(0, 5).map((a) => a.k));
    const dots = placed.sort((p, q) => (q[0].score || 0) - (p[0].score || 0)).map(([a, [x, y]]) => {
      const name = OT.UD.schools[a.k], r = k * (5 + 11 * Math.sqrt((a.score || 0) / smax)), col = a.rating ? OT.ratingColor('school', a.rating) : '#5F6B78';
      return `<a href="#school/${slug(name)}"><circle class="psd" data-mk="s${a.k}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="fill:${col};stroke-width:${(1.4 * k).toFixed(2)}"><title>${esc(tip(name, a))}</title></circle></a>`;
    }).join('');
    const labs = placed.filter(([a]) => top5.has(a.k)).map(([a, [x, y]]) => `<text class="psl" x="${(x + 10 * k).toFixed(1)}" y="${(y + 4 * k).toFixed(1)}" style="font-size:${(15 * k).toFixed(1)}px;stroke-width:${(4 * k).toFixed(1)}px">${esc(OT.UD.schools[a.k])}</text>`).join('');
    const base = d === 8 ? `<path class="pax" d="${dPath(7)}"/>` : `<path class="padz" d="${dPath(d)}" style="stroke-width:${(2 * k).toFixed(2)}"/>`;
    const note = missing ? `${missing} school${missing > 1 ? 's' : ''} without a location yet` : '';
    return wrap(svgOpen(vb, 'District ' + d + ' schools coloured by rating') + nbrs + `<path class="paxo" d="${M.outline}" style="stroke-width:${(1.5 * k).toFixed(2)}"/>` + base + dots + labs + '</svg>', legend(sc, note) + (L.length ? '<div class="mlgs">Dot size = score</div>' : ''));
  }

  const wrap = (svg, leg) => `<div class="pmap">${svg}${leg}</div>`;
  function mapOnly(u) {
    if (u.kind === 'state') return stateMap();
    if (u.kind === 'region') return regionMap(u.id);
    if (u.kind === 'district') return districtMap(+u.id);
    return '';
  }
  /* ---------- the map card ----------
     Map (space) + the coloured units as a list. Time comes from the TIME filter in the bottom bar. */
  const pageKey = (u) => u.kind + ':' + u.id;
  function listUnits(u) {
    if (u.kind === 'state') {
      if (OT.mapMode() === 'districts') return { kind: 'district', L: () => OT.aggregateCore('district', null, 'state'), keys: Array.from({ length: 12 }, (_, i) => i + 1), mk: (k) => 'd' + k, name: (k) => 'D' + k + ' ' + (DISTRICTS[k] || ''), href: (k) => '#district/' + k };
      return { kind: 'region', L: () => OT.aggregateCore('region', null, 'state'), keys: FIVE, mk: (k) => k, name: (k) => REGIONS[k], href: (k) => '#region/' + k };
    }
    if (u.kind === 'region') { const { of } = membership(); return { kind: 'district', L: () => OT.aggregateCore('district', { kind: 'region', id: u.id }, 'region'), keys: Object.keys(of).map(Number).filter((d) => of[d] === u.id).sort((a, b) => a - b), mk: (k) => 'd' + k, name: (k) => 'D' + k + ' ' + (DISTRICTS[k] || ''), href: (k) => '#district/' + k }; }
    return { kind: 'school', L: () => OT.aggregateCore('school', { kind: 'district', id: +u.id }, 'district'), keys: null, mk: (k) => 's' + k, name: (k) => OT.UD.schools[k], href: (k) => '#school/' + slug(OT.UD.schools[k]) };
  }
  /* WRESTLER RATINGS context (no names): Best / Avg / 5th-percentile season rating of the wrestlers who entered this
     page's tournament level (districts on a District page, regionals on a Region page, states on the State page),
     statewide, in the region and in the district, for the selection and class. Groups come from wstats.js
     (per season, class, level and district: max, sum, count and a 10-point histogram). */
  const WS = window.WR_WSTATS || null;
  const PARTIAL = new Set((WS && WS.p) || []);
  /* own: the scope is a single district (its own partial groups still count, flagged); otherwise partial district
     groups are left out so a champions-only district cannot pull a State or Region average up */
  function wrestlerStats(lvl, ds, y0, y1, own) {
    if (!WS) return null;
    let partial = 0, skipped = 0;
    const cl = OT.state.cls, cls = cl === 'ALL' ? ['AAA', 'AA', 'single'] : [cl, 'single'];
    let mx = 0, sum = 0, n = 0; const h = new Map();
    for (let y = y0; y <= y1; y++) for (const c of cls) for (const d of ds) {
      const gk = `${y}|${c}|${lvl}|${d}`, g = WS.g[gk]; if (!g) continue;
      if (PARTIAL.has(gk)) { if (!own) { skipped++; continue; } partial++; }
      mx = Math.max(mx, g[0]); sum += g[1]; n += g[2];
      g[3].split(',').forEach((x) => { const i = x.indexOf(':'); const b = +x.slice(0, i); h.set(b, (h.get(b) || 0) + +x.slice(i + 1)); });
    }
    if (!n) return null;
    const bins = Array.from(h.entries()).sort((a, b) => a[0] - b[0]); let acc = 0, p5 = bins[0][0] * WS.bin; const t = 0.05 * n;
    for (const [bn, c] of bins) { acc += c; if (acc >= t) { p5 = (bn + 0.5) * WS.bin; break; } }
    return [mx, sum / n, p5, n, partial, skipped];
  }
  function contextTable(u, sel) {
    const lvl = u.kind === 'district' ? 'd' : u.kind === 'region' ? 'r' : 's';
    const [w0, w1] = OT.yearsWindow(), y0 = sel ? sel.a : w0, y1 = sel ? sel.b : w1;
    const ALL = Array.from({ length: 12 }, (_, i) => i + 1);
    const of = (sel ? OT.withSub([sel.a, sel.b], membership) : membership()).of;
    const scopes = [['State', ALL]];
    if (u.kind === 'region') scopes.push(['Region', ALL.filter((d) => of[d] === u.id)]);
    if (u.kind === 'district') { const g = of[+u.id]; if (g) scopes.push(['Region', ALL.filter((d) => of[d] === g)]); scopes.push(['District', [+u.id]]); }
    const chip = (v) => `<span class="mls ctx" style="--tint:${v ? OT.ratingColor('wrestler', v) : '#2F3640'}">${v ? r10(v) : '–'}</span>`;
    let anySkip = 0;
    const body = scopes.map(([l, ds]) => { const own = ds.length === 1 && l === 'District'; const x = wrestlerStats(lvl, ds, y0, y1, own); if (x && x[5]) anySkip++;
      const part = x && x[4] ? ' <em class="ctp" title="Part of this district\'s brackets are not on file (champions only or missing), so only wrestlers who reached regionals or states are counted for those seasons; average and low read high.">partial</em>' : '';
      return `<div class="ctr"><span class="ctxl">${l}${part}${x ? `<small>${fmt(x[3])} wrestlers</small>` : ''}</span>${x ? chip(x[0]) + chip(x[1]) + chip(x[2]) : '<span class="ctn">no rated wrestlers</span>'}</div>`; }).join('');
    const who = lvl === 'd' ? 'district entrants' : lvl === 'r' ? 'regional entrants' : 'state entrants';
    const note = lvl === 'd' && anySkip ? ' · districts whose brackets are not on file are left out of State and Region' : '';
    return `<div class="ctx"><div class="cth"><span>Wrestler ratings</span><i>Best</i><i>Avg</i><i>Low*</i></div>${body}<div class="ctf">${who} · season ratings · *5th percentile${note}</div></div>`;
  }
  /* team benchmarks in line with the units list: best / average / low over each scope. Low is the true minimum for short
     lists (the 12 districts, the 5 regions) and the 5th percentile for long ones (schools), where one tiny program would
     otherwise set it. */
  const p5of = (A) => { const S = A.slice().sort((a, b) => a - b); return S[Math.max(0, Math.round(0.05 * (S.length - 1)))]; };
  const bstat = (L) => { const A = L.map((a) => a.rating).filter(Boolean); if (!A.length) return null; const S = A.slice().sort((a, b) => a - b), m = S.length >> 1; return { best: Math.max(...A), avg: A.reduce((t, v) => t + v, 0) / A.length, med: S.length % 2 ? S[m] : (S[m - 1] + S[m]) / 2, low: A.length < 20 ? Math.min(...A) : p5of(A), p5: A.length >= 20 }; };
  function benchScopes(u, U) {
    if (u.kind === 'district') { const g = membership().of[+u.id]; return [['State', () => OT.aggregateCore('school', null, 'state')]].concat(g ? [['Region', () => OT.aggregateCore('school', { kind: 'region', id: g }, 'region')]] : []).concat([['District', () => U.L()]]); }
    if (u.kind === 'region') return [['State', () => OT.aggregateCore('district', null, 'state')], ['Region', () => U.L()]];
    return [['State', () => U.L()]];
  }
  function unitList(u, sel) {
    const U = listUnits(u);
    const full = new Map(U.L().filter((a) => a.rating).map((a) => [a.k, a.rating]));
    const now = sel ? OT.withSub([sel.a, sel.b], () => new Map(U.L().filter((a) => a.rating).map((a) => [a.k, a.rating]))) : full;
    const nsF = new Map(U.L().filter((a) => a.rating).map((a) => [a.k, a.nS]));
    let keys = U.keys || Array.from(new Set([...full.keys()]));
    let rows = keys.map((k) => ({ k, s: now.get(k) || 0, v: full.get(k) || 0 })).filter((r) => (r.s || r.v) && String(U.name(r.k) || '').trim());
    const srt = OT.state.msort === 'avg' ? 'avg' : 'sel', key = (r) => (srt === 'avg' ? r.v : r.s);
    rows.sort(srt === 'avg' ? (p, q) => q.v - p.v || q.s - p.s : (p, q) => q.s - p.s || q.v - p.v);
    const lim = u.kind === 'district' && !OT.state.mlall ? 12 : rows.length, more = rows.length > lim ? rows.length : 0;
    /* every row on one shared horizontal scale, with a single line for the statewide median running through the rows:
       distance between units is visible, not just their order, and above/below the middle reads at a glance. Optional
       band (sessionStorage ot-band, for review): the 10th-90th percentile of the unit's own season values in the window,
       the same measure as its dot, so steady units and up-and-down ones look different. */
    const stScope = () => OT.aggregateCore(U.kind, null, 'state');   // the line: the median unit of this list's kind statewide (school, district or region)
    const stB = bstat(stScope()), stS = sel ? OT.withSub([sel.a, sel.b], () => bstat(stScope())) : stB;
    const two = !!sel; const ref = two ? (stS && stS.med) : (stB && stB.med);   // median, so one very weak or very strong unit doesn't move the line
    const vis = rows.slice(0, lim);
    const band = (() => { try { return sessionStorage.getItem('ot-band') === '1'; } catch (e) { return false; } })(), q = (A, p) => { const S = A.slice().sort((x, y) => x - y); return S[Math.max(0, Math.min(S.length - 1, Math.round(p * (S.length - 1))))]; };
    const bandOf = (k) => { if (!band) return null; const L_ = two ? OT.withSub([sel.a, sel.b], () => U.L()) : U.L(); const it = L_.find((a) => a.k === k);
      const A = it && it.series ? it.series.map((x) => x[1]).filter(Boolean) : []; return A.length >= 3 ? [q(A, 0.1), q(A, 0.9)] : null; };
    vis.forEach((r) => { r.band = bandOf(r.k); });
    const vals = vis.flatMap((r) => [two ? r.s : r.v].concat(r.band || [])).filter(Boolean).concat(ref ? [ref] : []);
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = Math.max(10, (hi0 - lo0) * 0.06), lo = lo0 - pad, hi = hi0 + pad;
    const X = (v) => (100 * (v - lo) / (hi - lo)).toFixed(2);
    const hd = (k, l) => `<button class="ht${srt === k ? ' on' : ''}" data-msort="${k}">${l}</button>`;
    const [wy0, wy1] = OT.yearsWindow(), span = (a, b) => (a === b ? String(a) : a + '–' + b);
    const refTxt = ref ? `Median ${U.kind} ${r10(ref)}` : '';
    const body = vis.map((r) => {
      const d = r.s && r.v ? Math.round((r.s - r.v) / 10) * 10 : 0;
      const dl = !two || !r.s || !r.v ? '' : d > 0 ? `<em class="up">▲${d}</em>` : d < 0 ? `<em class="dn">▼${-d}</em>` : '<em>·</em>';
      const v1 = two ? r.s : r.v;
      const tint = v1 ? OT.ratingColor(U.kind, v1) : '#2F3640';
      const trk = `<span class="mlt" aria-hidden="true">${ref ? `<i class="mltl" style="left:${X(ref)}%"></i>` : ''}${r.band ? `<i class="mltb" style="left:${X(r.band[0])}%;width:${(X(r.band[1]) - X(r.band[0])).toFixed(2)}%;--tint:${tint}"></i>` : ''}${v1 ? `<i class="mltd" style="left:${X(v1)}%;--tint:${tint}"></i>` : ''}</span>`;
      return `<div class="mlr ax${two ? '' : ' one'}" data-mk="${U.mk(r.k)}"><a class="mln" href="${U.href(r.k)}">${esc(U.name(r.k))}</a>${trk}<span class="mls" style="--tint:${tint}" title="${esc(`Strength ${v1 ? r10(v1) : '–'}` + (!two && nsF.get(r.k) ? ` · average of ${nsF.get(r.k)} season${nsF.get(r.k) === 1 ? '' : 's'}` : ''))}">${v1 ? r10(v1) : '–'}</span>${two ? `<span class="mla">${r.v ? r10(r.v) : '–'}${dl}</span>` : ''}</div>`;
    }).join('');
    const moreBtn = more ? `<button class="more" data-mlall="${OT.state.mlall ? '0' : '1'}">${OT.state.mlall ? 'Show top 12' : 'Show all ' + more}</button>` : '';
    const who = U.kind === 'school' ? 'Teams' : U.kind === 'district' ? 'Districts' : 'Regions';
    return `<div class="ml"><div class="mlh ax${two ? '' : ' one'}"><span>${who}</span><span class="mltk">${refTxt ? `<i style="left:${X(ref)}%">${refTxt}</i>` : ''}${band ? '<em>band: middle 80% of its seasons</em>' : ''}</span>${two ? hd('sel', span(sel.a, sel.b)) + hd('avg', span(wy0, wy1)) : `<button class="ht on" disabled title="${esc(OT.unitRtgTip(U.kind))}">${OT.unitRtgLabel(U.kind)}</button>`}</div>${body || '<div class="note1">No rated units in this window.</div>'}${moreBtn ? `<div class="bmore">${moreBtn}</div>` : ''}</div>`;
  }
  /* the TIME scrubber (filter bar): the whole archive as a heat strip of the statewide rating per season, two handles
     for the window. Drawn with the window set to all-time so the strip always spans every season of the class. */
  function timeScrubber() {
    const st = OT.state, keep = st.win; const [a, b] = OT.yearsWindow();
    st.win = { mode: 'all', from: null, to: null };
    let y0, y1, RS;
    try { [y0, y1] = OT.yearsWindow(); const own = OT.unitAgg(OT.U.state()); RS = new Map(((own && own.series) || []).filter((p) => p[1] && OT.ratedYear(p[0]))); } finally { st.win = keep; }
    const n = y1 - y0 + 1; const pc = (y) => (n === 1 ? 50 : (100 * (y - y0 + 0.5)) / n); const ys = Array.from({ length: n }, (_, i) => y0 + i);
    const strip = `<span class="scrs">${ys.map((y) => { const v = RS.get(y); return `<i class="${y < a || y > b ? 'out' : ''}" style="${v ? 'background:' + OT.ratingColor('region', v) : ''}"></i>`; }).join('')}</span>`;
    const ticks = ys.map((y) => { const v = RS.get(y); return `<button class="sct${y >= a && y <= b ? ' in' : ''}" data-ty="${y}" style="left:${(pc(y) - 50 / n).toFixed(2)}%;width:${(100 / n).toFixed(3)}%" aria-label="${y}" title="${y}${v ? ' · statewide rating ' + r10(v) : ''}"></button>`; }).join('');
    const labs = ys.filter((y) => y % 10 === 0).map((y) => `<i style="left:${pc(y).toFixed(2)}%">${y}</i>`).join('');
    return `<div class="scr tscr" data-y0="${y0}" data-y1="${y1}" data-a="${a}" data-b="${b}"><div class="scrh"><b class="scrl">${a === b ? a : a + '–' + b}</b><span class="muted">${a === b ? '1 season' : (b - a + 1) + ' seasons'}</span></div><div class="scrt hs">${strip}<span class="scrf" style="left:${(pc(a) - 50 / n).toFixed(2)}%;width:${((100 * (b - a + 1)) / n).toFixed(2)}%"></span>${ticks}<span class="sch" data-h="a" style="left:${pc(a).toFixed(2)}%" role="slider" aria-label="First season" aria-valuenow="${a}" tabindex="0"></span><span class="sch" data-h="b" style="left:${pc(b).toFixed(2)}%" role="slider" aria-label="Last season" aria-valuenow="${b}" tabindex="0"></span></div><div class="scrx">${labs}</div></div>`;
  }
  function mapCard(u) {
    /* the map follows TIME; a single season also gets that season's state placers */
    const [w0, w1] = OT.yearsWindow(); const sel = w0 === w1 ? { a: w0, b: w1 } : null;
    const map = mapOnly(u);
    if (!map) return '';
    let sheet = '';
    if (sel && sel.a === sel.b) {
      const inU = u.kind === 'state' ? () => true : u.kind === 'district' ? (r) => r.d === +u.id : (r) => OT.regionOf(r) === u.id;
      sheet = `<div class="ss mss"><div class="ssh"><b>${sel.a}</b><span>state placers</span></div>${OT.placeMatrix(sel.a, inU, u.kind === 'state')}</div>`;
    }
    return `<div class="mapcard" data-mapcard="${esc(pageKey(u))}"><div class="mcb"><div class="mcm">${map}</div>${unitList(u, null)}</div>${sheet}</div>`;
  }
  /* the state map's Regions/Districts switch; it lives on the page's title row */
  const mapModeSeg = () => `<div class="seg sm" role="group" aria-label="Map" data-mapmode-seg="1">${[['regions', 'Regions'], ['districts', 'Districts']].map(([k, l]) => `<button data-mapmode="${k}" aria-pressed="${OT.mapMode() === k}">${l}</button>`).join('')}</div>`;
  function ratingMap(u) {
    if (!M || !M.topo || !window.d3) return '';
    try { return mapCard(u); } catch (e) { console.warn('map', e); }
    return '';
  }
  Object.assign(OT, { ratingMap, mapCard, timeScrubber, mapModeSeg });
})();
