/* Overtime · the rating map. One picture per level, coloured by rating in the class and time window, on the same
   green → yellow → orange → red scale as strength of competition, so colour always means strength.
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
  const legend = (sc, note, hatch) => `<div class="mlg"><span class="mlgl">Rating</span><b>${r10(sc.lo) || '–'}</b><i class="mlgbar"></i><b>${r10(sc.hi) || '–'}</b>${hatch ? `<span class="mlgh"><i></i>${hatch}</span>` : ''}${note ? `<span class="mlgn">${note}</span>` : ''}</div>`;
  const tip = (name, a) => `${name}${a && a.rating ? ' · RTG ' + r10(a.rating) : ''}${a && a.score ? ' · Score ' + fmt(Math.round(a.score)) : ''}`;
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
        fills += `<a href="#district/${d}"><path class="par" d="${dPath(d)}" style="fill:${col}"><title>${esc(tip('District ' + d + ' · ' + (DISTRICTS[d] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></path></a>`;
        const c = d === 12 ? [M.dot[d][0] + 52, M.dot[d][1] - 10] : M.dot[d];
        labels += `<g class="pal sm${d === 12 ? ' out' : ''}" transform="translate(${c[0]},${c[1]})"><text class="pan">D${d}</text>${a && a.rating ? `<text class="pav" y="24">${r10(a.rating)}</text>` : ''}</g>`;
      });
      { const a = A.get(8), c = M.dot[8]; if (!(a && a.rating)) anyNo = true; fills += `<a href="#district/8"><circle class="pd8 on" cx="${c[0]}" cy="${c[1]}" r="9" style="fill:${a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL}"><title>${esc(tip('District 8 · ' + (DISTRICTS[8] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></circle></a>`; }
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
      fills += `<a href="#region/${g}"><path class="par" d="${p}" style="fill:${col}"><title>${esc(tip(REGIONS[g] + ' Region', a))}</title></path></a>`;
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
      fills += `<a href="#district/${d}"><path class="par" d="${dPath(d)}" style="fill:${col}"><title>${esc(tip('District ' + d + ' · ' + (DISTRICTS[d] || ''), a) + (a && a.rating ? '' : ' · ' + noData()))}</title></path></a>`;
      const c = d === 12 ? [M.dot[d][0] + 52, M.dot[d][1] - 10] : M.dot[d]; labels += `<g class="pal${d === 12 ? ' out' : ''}" transform="translate(${c[0]},${c[1]})"><text class="pan">D${d}</text>${a && a.rating ? `<text class="pav" y="28">${r10(a.rating)}</text>` : ''}</g>`;
    });
    if (mine.includes(8)) { const a = A.get(8), c = M.dot[8]; fills += `<a href="#district/8"><circle class="pd8 on" cx="${c[0]}" cy="${c[1]}" r="9" style="fill:${a && a.rating ? OT.ratingColor('district', a.rating) : NOFILL}"><title>${esc(tip('District 8 · ' + (DISTRICTS[8] || ''), a))}</title></circle></a>`; }
    const shp = shapeOf(mine.filter((d) => d !== 8)), rl = shp ? `<path class="parl" d="${PATH(shp)}"/>` : '';
    return wrap(svgOpen([0, 0, M.w, M.h], (REGIONS[code] || code) + ' districts coloured by rating') + fills + rl + outline() + labels + '</svg>', legend(sc, '', anyNo ? noData() : ''));
  }

  /* schools inside a district: real locations when tools/build_school_geo.js has run, otherwise a grid in the shape */
  function districtMap(d) {
    proj();
    const GEO = window.WR_SCHOOLGEO || null; const hasGeo = GEO && Object.keys(GEO).length > 0;
    const L = OT.aggregateCore('school', { kind: 'district', id: d }, 'district').filter((a) => a.rating || a.score);
    const box = (M.box[d] || [0, 0, M.w, M.h]).slice(), pad = 0.08 * Math.max(box[2] - box[0], box[3] - box[1]);
    const vb = [box[0] - pad, box[1] - pad, box[2] - box[0] + 2 * pad, box[3] - box[1] + 2 * pad];
    const k = vb[2] / M.w; // marks and text scale with the zoom
    const own = OT.unitAgg({ kind: 'district', id: d }); const dcol = own && own.rating ? OT.ratingColor('district', own.rating) : NOFILL;
    if (!hasGeo) {
      /* no real coordinates yet: the district itself, coloured by its rating; no invented school positions */
      const base = d === 8 ? `<circle cx="${M.dot[8][0]}" cy="${M.dot[8][1]}" r="${(14 * k).toFixed(1)}" style="fill:${dcol}"/>` : `<path class="par" d="${dPath(d)}" style="fill:${dcol};stroke-width:${(2 * k).toFixed(2)}"/>`;
      const c = M.dot[d];
      const lab = own && own.rating ? `<g class="pal" transform="translate(${c[0]},${c[1]}) scale(${k.toFixed(3)})"><text class="pan">District ${d}</text><text class="pav" y="30">${r10(own.rating)}</text></g>` : '';
      return wrap(svgOpen(vb, 'District ' + d + ' coloured by rating') + `<path class="pax" d="${M.outline}" style="stroke-width:${(1.5 * k).toFixed(2)}"/>` + base + lab + '</svg>', legend(scaleFor([], 'district'), 'School locations coming', own && own.rating ? '' : noData()));
    }
    const sc = scaleFor([], 'school');
    const smax = Math.max(1, ...L.map((a) => a.score || 0));
    const placed = []; let missing = 0;
    L.forEach((a) => { const name = OT.UD.schools[a.k]; const g = GEO[name]; if (g) { const xy = PROJ([g[0], g[1]]); if (xy) { placed.push([a, xy]); return; } } missing++; });
    const top5 = new Set(L.slice().sort((p, q) => (q.rating || 0) - (p.rating || 0)).slice(0, 5).map((a) => a.k));
    const dots = placed.sort((p, q) => (q[0].score || 0) - (p[0].score || 0)).map(([a, [x, y]]) => {
      const name = OT.UD.schools[a.k], r = k * (5 + 11 * Math.sqrt((a.score || 0) / smax)), col = a.rating ? OT.ratingColor('school', a.rating) : '#5F6B78';
      return `<a href="#school/${slug(name)}"><circle class="psd" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" style="fill:${col};stroke-width:${(1.4 * k).toFixed(2)}"><title>${esc(tip(name, a))}</title></circle></a>`;
    }).join('');
    const labs = placed.filter(([a]) => top5.has(a.k)).map(([a, [x, y]]) => `<text class="psl" x="${(x + 10 * k).toFixed(1)}" y="${(y + 4 * k).toFixed(1)}" style="font-size:${(15 * k).toFixed(1)}px;stroke-width:${(4 * k).toFixed(1)}px">${esc(OT.UD.schools[a.k])}</text>`).join('');
    const base = d === 8 ? `<path class="pax" d="${dPath(7)}"/>` : `<path class="padz" d="${dPath(d)}" style="stroke-width:${(2 * k).toFixed(2)}"/>`;
    const note = missing ? `${missing} school${missing > 1 ? 's' : ''} without a location yet` : '';
    return wrap(svgOpen(vb, 'District ' + d + ' schools coloured by rating') + `<path class="pax" d="${M.outline}" style="stroke-width:${(1.5 * k).toFixed(2)}"/>` + base + dots + labs + '</svg>', legend(sc, note) + (L.length ? '<div class="mlgs">Dot size = score</div>' : ''));
  }

  const wrap = (svg, leg) => `<div class="pmap">${svg}${leg}</div>`;
  function ratingMap(u) {
    if (!M || !M.topo || !window.d3) return '';
    try {
      if (u.kind === 'state') return `<div class="mapctl"><div class="seg sm" data-mapmode-seg="1">${[['regions', 'Regions'], ['districts', 'Districts']].map(([k, l]) => `<button data-mapmode="${k}" aria-pressed="${OT.mapMode() === k}">${l}</button>`).join('')}</div></div>` + stateMap();
      if (u.kind === 'region') return regionMap(u.id);
      if (u.kind === 'district') return districtMap(+u.id);
    } catch (e) { console.warn('map', e); }
    return '';
  }
  Object.assign(OT, { ratingMap });
})();
