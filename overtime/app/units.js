/* Overtime — units, cards and the performance chart.
   Unit rating and Score come from overtime/units.js (tools/build_units.js): one row per school-season, plus district and
   region season ratings. Everything here is windowed client-side, so any class + season window works. */
'use strict';
(() => {
  const { esc, fmt, ordinal, slug, state, REGIONS, DISTRICTS, wShort, nkey } = OT;
  const UD = window.WR_UNITS || { schools: [], names: [], ss: [], ds: [], rs: [], typField: {}, fieldPct: [] };
  const S = UD.schools, N = UD.names, SS = UD.ss;
  const FIVE = ['NE', 'NW', 'SC', 'SE', 'SW'];
  /* Score weights by the page the list sits on (Brock): State counts state results only; a Region adds regional
     results at 0.4; District and School pages add district results at 0.15. */
  const W3 = { state: [1, 0, 0], region: [1, 0.4, 0], district: [1, 0.4, 0.15], school: [1, 0.4, 0.15] };
  const LV = [['State', '#D9A441'], ['Regional', '#B8BFC6'], ['District', '#5F6B78']];
  const clsOk = (c) => state.cls === 'ALL' || c === state.cls;
  const SIDX = new Map(S.map((s, i) => [s, i]));
  const SLUG2S = new Map(S.map((s) => [slug(s), s]));
  const RATE = { district: new Map(), region: new Map() };
  UD.ds.forEach(([u, y, c, r]) => { if (r) RATE.district.set(u + '|' + y + '|' + c, r); });
  UD.rs.forEach(([u, y, c, r]) => { if (r) RATE.region.set((u === 'W' ? 'SW' : u) + '|' + y + '|' + c, r); });
  /* Unit-season ratings need enough rated wrestlers in the lineup / top-4 per weight. Before 1974 (one class, regional
     fields of one wrestler per district, partial old brackets) most weights are padded with fill values, so unit
     ratings there read far too low; they are not plotted or averaged. Results (bars, stars, podiums) still count. */
  const RATED_FROM = 1974;
  const ratedYear = (y) => y >= RATED_FROM;
  const OFFW = OT.OFF_CLASS || 0.85;
  const colorOf = (s) => { const id = OT.SB && OT.SB.identity(s); return id && id.primary ? id.primary : '#5F6B78'; };
  const r10 = (v) => (v ? Math.round(v / 10) * 10 : null);
  const MEM = new Map(); const memo = (k, f) => { const kk = OT.wkey() + '|' + k; if (!MEM.has(kk)) MEM.set(kk, f()); return MEM.get(kk); };

  /* ss rows in scope (class + window), optionally inside a parent unit (membership as of each season) */
  const inParent = (p) => !p || p.kind === 'state' ? () => true : p.kind === 'region' ? (r) => r[4] === p.id : p.kind === 'district' ? (r) => r[3] === p.id : (r) => r[0] === SIDX.get(p.id);
  const ssIn = (p) => memo('ss|' + (p ? p.kind + ':' + p.id : 'all'), () => { const [a, b] = OT.yearsWindow(), f = inParent(p); return SS.filter((r) => clsOk(r[2]) && r[1] >= a && r[1] <= b && f(r)); });
  const nSeasons = () => memo('nS', () => new Set(ssIn(null).map((r) => r[1])).size || 1);

  /* aggregate ss rows by unit: rating per season (school: its lineup rating; district / region: its own season rating),
     Score parts, state results, titles and the best wrestler. Shared by the lists, the unit header and the chart. */
  /* home: a school list in AAA or AA lists a school only in the class it is in now; its seasons in the other class still
     count, their points at OFF_CLASS (85%); its rating comes from seasons in the listed class only (ratings are scaled
     per class). Everything else counts results in the class they were wrestled in. */
  const homeRows = (parent) => memo('ssH|' + (parent ? parent.kind + ':' + parent.id : 'all'), () => { const [a, b] = OT.yearsWindow(), f = inParent(parent);
    return SS.filter((r) => r[1] >= a && r[1] <= b && f(r) && OT.homeOf(S[r[0]]) === state.cls); });
  function aggregateCore(kind, parent, pageKind, home) {
    return memo('core|' + kind + '|' + (parent ? parent.kind + ':' + parent.id : '') + '|' + pageKind + (home ? '|h' : ''), () => {
      const keyOf = kind === 'school' ? (r) => r[0] : kind === 'district' ? (r) => (r[3] >= 1 && r[3] <= 12 ? r[3] : null) : (r) => (FIVE.includes(r[4]) ? r[4] : null);
      const M = new Map(), w = W3[pageKind] || W3.school;
      (home ? homeRows(parent) : ssIn(parent)).forEach((r) => {
        const k = keyOf(r); if (k == null) return;
        const inC = !home || r[2] === state.cls || r[2] === 'single', m = inC ? 1 : OFFW;
        let a = M.get(k); if (!a) M.set(k, (a = { k, kind, years: new Map(), sp: 0, rp: 0, dp: 0, ti: 0, pod: 0, plc: 0, q: 0, rt: 0, dt: 0, tt: 0, best: null }));
        const y = a.years.get(r[1]) || { y: r[1], rs: 0, rn: 0, sp: 0, rp: 0, dp: 0, ti: 0, rt: 0, dt: 0, tt: 0 }; a.years.set(r[1], y);
        if (!ratedYear(r[1]) || !inC) { /* no rating */ }
        else if (kind === 'school') { if (r[5]) { y.rs += r[5]; y.rn++; } }
        else if (!y['c' + r[2]]) { y['c' + r[2]] = 1; const v = RATE[kind].get(k + '|' + r[1] + '|' + r[2]); if (v) { y.rs += v; y.rn++; } }
        if (!inC) { a.off = (a.off || 0) + 1; a.sp += r[6] * m; a.rp += r[7] * m; a.dp += r[8] * m; y.sp += r[6] * m; y.rp += r[7] * m; y.dp += r[8] * m; a.ti += r[9]; return; }
        y.sp += r[6]; y.rp += r[7]; y.dp += r[8]; y.ti += r[9]; y.rt += r[13]; y.dt += r[14]; y.tt += r[15];
        a.sp += r[6]; a.rp += r[7]; a.dp += r[8]; a.ti += r[9]; a.pod += r[10]; a.plc += r[11]; a.q += r[12]; a.rt += r[13]; a.dt += r[14]; a.tt += r[15];
        if (r[17] >= 0 && (!a.best || r[18] > a.best.r)) a.best = { name: N[r[17]], r: r[18], sch: S[r[0]], y: r[1] };
      });
      return Array.from(M.values()).map((a) => {
        a.ys = Array.from(a.years.values()).sort((p, q) => p.y - q.y); a.series = a.ys.filter((y) => y.rn).map((y) => [y.y, y.rs / y.rn]);
        a.rating = a.series.length ? a.series.reduce((t, x) => t + x[1], 0) / a.series.length : 0;
        a.parts = [a.sp * w[0], a.rp * w[1], a.dp * w[2]]; a.score = a.parts[0] + a.parts[1] + a.parts[2]; a.w = w;
        a.name = kind === 'school' ? S[a.k] : kind === 'district' ? 'District ' + a.k : REGIONS[a.k];
        a.sub = kind === 'district' ? DISTRICTS[a.k] : '';
        a.href = kind === 'school' ? '#school/' + slug(S[a.k]) : kind === 'district' ? '#district/' + a.k : '#region/' + a.k;
        a.color = kind === 'school' ? colorOf(S[a.k]) : null;
        return a;
      });
    });
  }
  /* list members need enough rated seasons in the window: a third of them for schools, half for districts and regions */
  function aggregate(kind, parent, pageKind) {
    const [wa, wb] = OT.yearsWindow(); const rs = new Set(ssIn(null).map((r) => r[1]).filter(ratedYear));
    const n = Math.max(1, rs.size), minS = kind === 'school' ? Math.max(1, Math.ceil(n / 3)) : Math.max(1, Math.ceil(n / 2));
    const home = kind === 'school' && state.cls !== 'ALL';
    if (wb < RATED_FROM) return aggregateCore(kind, parent, pageKind, home).filter((a) => a.score > 0).map((a) => { a.rating = a.rating || 0; return a; });
    return aggregateCore(kind, parent, pageKind, home).filter((a) => a.rating && a.series.length >= minS);
  }
  /* one unit's own numbers (its page header and chart): no season minimum */
  function unitAgg(u) {
    if (u.kind === 'state') return memo('own|state', () => { const L = aggregateCore('region', null, 'state'); const ys = new Map(); L.forEach((a) => a.series.forEach(([y, v]) => { const x = ys.get(y) || [0, 0]; x[0] += v; x[1]++; ys.set(y, x); }));
      const series = Array.from(ys).sort((a, b) => a[0] - b[0]).map(([y, x]) => [y, x[0] / x[1]]); const all = ssIn(null);
      return { rating: series.length ? series.reduce((t, x) => t + x[1], 0) / series.length : 0, series, score: all.reduce((t, r) => t + r[6], 0), ti: all.reduce((t, r) => t + r[9], 0), tt: 0 }; });
    const id = u.kind === 'school' ? SIDX.get(u.id) : u.id;
    return aggregateCore(u.kind, { kind: u.kind, id: u.id }, u.kind).find((a) => a.k === id) || null;
  }

  /* ---------- small graphics ---------- */
  /* sparkline: no axes, peak dot in gold */
  function spark(series, w = 64, h = 22) {
    const pts = series.filter((p) => p[1]); if (!pts.length) return '';
    const y0 = pts[0][0], y1 = pts[pts.length - 1][0];
    const vals = pts.map((p) => p[1]), lo = Math.min(...vals) - 15, hi = Math.max(...vals) + 15;
    const X = (y) => (y1 === y0 ? w / 2 : 2 + (w - 4) * (y - y0) / (y1 - y0)), Y = (v) => h - 2.5 - (h - 5) * (v - lo) / Math.max(1, hi - lo);
    let d = '', prev = null; pts.forEach(([y, v]) => { d += (prev == null ? 'M' : 'L') + X(y).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; prev = y; });
    const pk = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lone = pts.length === 1 ? `<circle cx="${X(pts[0][0])}" cy="${Y(pts[0][1])}" r="1.6" fill="#8E98A4"/>` : '';
    return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#EEEAE1" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>${lone}<circle cx="${X(pk[0])}" cy="${Y(pk[1])}" r="2.6" fill="#D9A441"/></svg>`;
  }
  /* ---------- strength of competition ----------
     A bracket's strength is the mean rating of its top eight. Everywhere a result appears it gets one slim vertical bar
     beside it: height and colour (green → yellow → orange → red) follow where that bracket ranks among brackets of the
     SAME level, so a loaded district reads as loaded and a thin state bracket as thin. The bracket header lays the same
     bar flat. */
  const FLO = 1000, FHI = () => (UD.typField.state || 1640) + 160;
  const fpos = (v) => Math.max(0.06, Math.min(1, (v - FLO) / (FHI() - FLO)));
  const LK = { state: 's', regional: 'r', district: 'd' };
  let LP = null;
  const lvlArr = (lvl) => {
    if (!LP) { LP = { s: [], r: [], d: [] }; const SO = window.WR_SOS || {};
      for (const y in SO) { const Y = SO[y]; for (const k in Y) { const e = Y[k]; if (!e || e[0] == null) continue; const l = k.split('.')[1]; if (LP[l]) LP[l].push(e[0] * 10); } }
      Object.values(LP).forEach((a) => a.sort((x, z) => x - z)); }
    return LP[LK[lvl] || 's'];
  };
  const pctIn = (v, lvl = 'state') => { const A = lvlArr(lvl); if (!A.length) return null; let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / A.length); };
  const STOPS = [[0, [46, 194, 126]], [0.45, [229, 201, 74]], [0.72, [240, 138, 36]], [1, [255, 59, 47]]];
  const colorAt = (f) => { let i = 0; while (i < STOPS.length - 2 && f > STOPS[i + 1][0]) i++; const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1]; const t = Math.max(0, Math.min(1, (f - a) / (b - a))); return 'rgb(' + ca.map((x, k) => Math.round(x + (cb[k] - x) * t)).join(',') + ')'; };
  const sFrac = (v, lvl = 'state') => { const p = pctIn(v, lvl); return p == null ? fpos(v) : Math.max(0.08, p / 100); };
  const fieldTip = (v, lvl = 'state', ctx) => { const p = pctIn(v, lvl); return `Strength of competition ${r10(v)}` + (p != null ? ` · tougher than ${p}% of ${lvl} brackets` : '') + (ctx ? ' · ' + ctx : ''); };
  const compColor = (v, lvl = 'state') => colorAt(sFrac(v, lvl));
  /* the glyph: a 4px bar beside a result, as tall as the result at most */
  const sbar = (v, lvl, ctx) => (v ? `<i class="sb" style="height:${(100 * sFrac(v, lvl)).toFixed(0)}%;background:${colorAt(sFrac(v, lvl))}" title="${esc(fieldTip(v, lvl, ctx))}"></i>` : '<i class="sb sb0"></i>');
  const compBar = (v, tip) => sbar(v, 'state', tip);
  /* bracket header: the same bar lying flat, its length and colour from the same within-level rank */
  function fieldGauge(v, lvl = 'state') {
    if (v == null) return '';
    const f = sFrac(v, lvl), p = pctIn(v, lvl);
    return `<div class="fg4" title="${esc(fieldTip(v, lvl))}"><div class="fgl"><span>Strength of competition</span><b style="color:${colorAt(f)}">${r10(v)}</b></div><div class="fgw4"><span class="fgtrk4"><i style="width:${(100 * f).toFixed(1)}%;background:${colorAt(f)}"></i></span><em>${p != null ? `tougher than ${p}% of ${lvl} brackets` : ''}</em></div></div>`;
  }
  const legend = () => `<span class="clg"><i class="sb" style="height:35%;background:${colorAt(0.15)}"></i><i class="sb" style="height:65%;background:${colorAt(0.55)}"></i><i class="sb" style="height:100%;background:${colorAt(0.95)}"></i>strength of competition, vs. brackets of the same level</span>`;

  /* ---------- season timeline: rating dots on top, D / R / S results beneath, one column per season ----------
     Every result carries its strength bar. Used by wrestler cards (compact) and the wrestler page (full width). */
  const LVI = { district: 'district', regional: 'region', state: 'state' };
  const pcls = (p) => (p >= 5 ? 'c5' : 'c' + p);
  function cellPill(c, lvl, href) {
    if (lvl === 'regional' && c && c.year < 1951) return '<span class="tp tpx"></span>';
    if (!c) return '<span class="tp tp0"></span>';
    const tag = href ? 'a' : 'b', hr = href ? ` href="${href}"` : '';
    const tip = (t) => `${c.year}${c.w ? ' · ' + wShort(c.w) : ''} · ${lvl} ${t}`;
    if (c.place) return `<${tag}${hr} class="tp ${pcls(c.place)}" title="${esc(tip(ordinal(c.place)))}">${c.place}</${tag}>`;
    if (c.dnc) return `<b class="tp dnc" title="${c.year} · did not compete at districts">DNC</b>`;
    if (c.nodata) return `<b class="tp nod" title="${c.year} · ${esc(c.src || 'no bracket on record')}">–</b>`;
    if (c.dnp) return `<${tag}${hr} class="tp dnp" title="${esc(tip('entered, did not place'))}">DNP</${tag}>`;
    return `<${tag}${hr} class="tp q" title="${esc(tip(c.src || 'qualified'))}">Q</${tag}>`;
  }
  /* one result + its strength bar, the unit every career display is made of */
  function resCell(c, lvl, link) {
    const ok = c && c.r && !c.dnc && !c.nodata; const href = link && ok ? OT.bhref(OT.bkey(c.r, lvl)) : null;
    const f = ok ? OT.fieldOf(c.r, lvl) : null;
    return `<span class="tc">${cellPill(c, lvl, href)}${f ? sbar(f, lvl, `${c.year} ${lvl}${c.w ? ' ' + wShort(c.w) : ''}`) : '<i class="sb sb0"></i>'}</span>`;
  }
  function timeline(apps, lower, opts = {}) {
    const M = OT.careerCells(apps, lower, { full: opts.full }), cr = OT.careerRating(apps, lower);
    const big = !!opts.page, cols = M.cols;
    const rat = cols.map((c) => { if (!c || !cr) return null; const s = cr.seasons.find((x) => x.year === c.year); return s ? s.rating : null; });
    const vals = rat.filter((v) => v), pkv = vals.length ? Math.max(...vals) : null, pki = rat.indexOf(pkv);
    const lo = vals.length ? Math.min(...vals, big ? 1450 : Infinity) - (big ? 60 : 30) : 0, hi = vals.length ? Math.max(...vals, big ? 1550 : -Infinity) + (big ? 60 : 30) : 1;
    const H = big ? 112 : 26, top = big ? 24 : 13, bot = big ? 8 : 3;
    const yp = (v) => top + (H - top - bot) * (1 - (v - lo) / Math.max(1, hi - lo));
    const xp = (i) => (100 * (i + 0.5) / 4);
    let line = '', prev = null; rat.forEach((v, i) => { if (!v) { prev = null; return; } line += (prev == null ? 'M' : 'L') + xp(i).toFixed(2) + ' ' + yp(v).toFixed(1) + ' '; prev = i; });
    const ref = lo < 1500 && hi > 1500 ? `<span class="tq" style="top:${yp(1500).toFixed(1)}px">${big ? '<em>1500 · avg state qualifier</em>' : ''}</span>` : '';
    const dots = rat.map((v, i) => (v ? `<span class="td${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${yp(v).toFixed(1)}px" title="${cols[i].year} · Overtime Rating ${r10(v)}"></span>${big || i === pki ? `<span class="tv${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${(yp(v) - (big ? 20 : 13)).toFixed(1)}px">${r10(v)}</span>` : ''}` : '')).join('');
    const ratingRow = `<span class="tl-r" style="height:${H}px">${ref}<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" vector-effect="non-scaling-stroke"/></svg>${dots}</span>`;
    const head = cols.map((c, i) => `<span class="th">${c ? (big ? `<b>${OT.GRADE_L[i]} '${String(c.year).slice(2)}</b><i>${c.w ? wShort(c.w) + ' lbs' : ''}</i>` : `<b>'${String(c.year).slice(2)}</b> <i>${c.w ? wShort(c.w) : ''}</i>`) : `<b>${OT.GRADE_L[i]}</b><i></i>`}</span>`).join('');
    const lab = (t, icon) => `<span class="tlab">${big ? t : OT.navIcon(icon)}</span>`;
    const rows = M.rows.map((row) => lab(row.l, LVI[row.k]) + row.cells.map((c) => resCell(c, row.k, big)).join('')).join('');
    return `<span class="tl${big ? ' big' : ''}"><span class="tlab">${big ? 'Rating' : ''}</span>${ratingRow}<span class="tlab"></span>${head}${rows}</span>`;
  }

  /* ---------- best wins and postseason record (lazy) ---------- */
  let BW = null, BWP = null;
  const loadBW = () => BWP || (BWP = fetch('bestwins.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { BW = d; return d; }));
  const bestWinOf = (name, years) => { if (!BW) return null; const k = nkey(name); let b = null; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && (!b || v[0] > b[0])) b = [v[0], v[1], y, v[2]]; }); return b; };
  const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };
  const LVLN = { s: 'state', r: 'regional', d: 'district' };
  const recordOf = (name, years) => { if (!BW) return null; const k = nkey(name); const t = [0, 0, 0, 0]; let any = false; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && v.length > 3) { any = true; t[0] += v[3]; t[1] += v[4]; t[2] += v[5]; t[3] += v[6]; } }); return any ? t : null; };

  /* ---------- wrestler card ----------
     Row 1: identity and RTG. Row 2: the season grid at its natural width (rating dots above, each result with its strength
     bar), and beside it what the grid can't say: postseason record, falls, OT wins, win rate, titles by level, best win. */
  function wrestlerCard(w, rank, opts = {}) {
    if (!w.lower) w.lower = OT.lowerFor(w.apps);
    const cr = OT.careerRating(w.apps, w.lower);
    const badge = OT.SB ? OT.SB.svg(w.sch, { size: 26, variant: 'chip', title: false }) : '';
    const years = Array.from(new Set(w.apps.map((a) => a.year).concat(w.lower.map((r) => r.year)))).sort();
    const wn = w.apps.concat(w.lower).sort((a, b) => a.year - b.year).map((a) => a.w).filter(Boolean); const wts = wn.length ? (wShort(wn[0]) === wShort(wn[wn.length - 1]) ? wShort(wn[0]) : wShort(wn[0]) + '–' + wShort(wn[wn.length - 1])) : '';
    const y0 = years[0], y1 = years[years.length - 1];
    const rec = recordOf(w.name, years), bw = bestWinOf(w.name, years);
    const ttl = [['D', w.lower.filter((r) => r.lvl === 'district' && r.place === 1).length], ['R', w.lower.filter((r) => r.lvl === 'regional' && r.place === 1).length], ['S', w.apps.filter((a) => a.place === 1).length]].filter(([, n]) => n);
    const st = [];
    if (rec) { st.push([`${rec[0]}–${rec[1]}`, 'postseason']); if (rec[0] + rec[1]) st.push([Math.round(100 * rec[0] / (rec[0] + rec[1])) + '%', 'won']); st.push([rec[2], rec[2] === 1 ? 'fall' : 'falls']); if (rec[3]) st.push([rec[3], rec[3] === 1 ? 'OT win' : 'OT wins']); }
    const stats = `<span class="wst"${!BW ? ' data-need-bw="1"' : ''}>${st.map(([v, l]) => `<span><b>${v}</b><i>${l}</i></span>`).join('')}${ttl.length ? `<span class="wide"><i>titles</i> ${ttl.map(([l, n]) => `${l} <b>${n}</b>`).join(' · ')}</span>` : ''}${bw ? `<span class="wide"><i>best win</i> <b>${esc(shortName(bw[1]))}</b> ${r10(bw[0])} · '${String(bw[2]).slice(2)} ${LVLN[bw[3]] || ''}</span>` : ''}</span>`;
    return `<a class="wk" href="${w.href}" style="--p1:${colorOf(w.sch)}">
      <span class="wk1">${rank ? `<i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>` : ''}<span class="bdg">${badge}</span><span class="nm"><b>${esc(w.name)}</b><small>${opts.noSchool ? '' : esc(w.sch) + ' · '}${y0 === y1 ? y0 : y0 + '–' + String(y1).slice(2)}${wts ? ' · ' + wts + ' lbs' : ''}</small></span>${cr ? `<span class="rv"><i>RTG</i><b>${r10(cr.peak)}</b></span>` : ''}</span>
      <span class="wkb">${timeline(w.apps, w.lower)}${stats}</span></a>`;
  }

  /* ---------- unit card ----------
     Rating is the graphic: a mini chart of the unit's rating across the window with the 1500 line. Beside it Score and one
     podium per level that counts on this page (State; + Regional on a Region page; + District on District and School). */
  const SORTS = { rating: (a, b) => b.rating - a.rating, score: (a, b) => b.score - a.score || b.rating - a.rating, titles: (a, b) => b.ti - a.ti || b.score - a.score };
  /* comparison lines are neutral (colour means medals): chalk / ash tones and dash patterns, each line labelled at its
     right end; the focused series is gold; a school's own line keeps the school colour */
  const GOLD = '#D9A441';
  const NEUT = [['#EEEAE1', ''], ['#B8BFC6', '7 4'], ['#8E98A4', '3 3'], ['#EEEAE1', '1.5 3.5'], ['#B8BFC6', '10 3 2 3'], ['#8E98A4', '']];
  const RNEUT = { NE: NEUT[0], NW: NEUT[1], SC: NEUT[2], SE: NEUT[3], SW: NEUT[4] };
  const RCOL = { NE: '#EEEAE1', NW: '#EEEAE1', SC: '#EEEAE1', SE: '#EEEAE1', SW: '#EEEAE1' };
  const RSHADE = { NE: '#DCD8CF', NW: '#B8BFC6', SC: '#8E98A4', SE: '#5F6B78', SW: '#3E4650' };
  const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0.5; const n = parseInt(m[1], 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  /* a colour that reads on the dark mat: very dark school colours fall back to their secondary or chalk */
  const lineColor = (s) => { const id = OT.SB && OT.SB.identity(s); const p = id && id.primary, q = id && id.secondary; if (p && lum(p) > 0.06) return p; if (q && lum(q) > 0.06 && lum(q) < 0.9) return q; return '#EEEAE1'; };
  const unitColor = (a) => (a.kind === 'school' ? lineColor(S[a.k]) : '#EEEAE1');
  function miniChart(series, color, label = true) {
    const pts = series.filter((p) => p[1]); if (!pts.length) return '<span class="mc mc0">no rated seasons</span>';
    const y0 = pts[0][0], y1 = pts[pts.length - 1][0]; const vals = pts.map((p) => p[1]);
    const lo = Math.min(...vals, 1500) - 40, hi = Math.max(...vals, 1500) + 40;
    const X = (y) => (y1 === y0 ? 50 : 2 + 96 * (y - y0) / (y1 - y0)), Y = (v) => 100 * (1 - (v - lo) / (hi - lo));
    let d = '', gd = '', prev = null, pv = null; pts.forEach(([y, v]) => { if (prev != null && y - prev > 1) gd += 'M' + X(prev).toFixed(2) + ' ' + Y(pv).toFixed(2) + ' L' + X(y).toFixed(2) + ' ' + Y(v).toFixed(2) + ' '; d += (prev == null || y - prev > 1 ? 'M' : 'L') + X(y).toFixed(2) + ' ' + Y(v).toFixed(2) + ' '; prev = y; pv = v; });
    const pk = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    const gap = gd ? `<path d="${gd}" class="gap" style="stroke:${color}" vector-effect="non-scaling-stroke"/>` : '';
    return `<span class="mc"><span class="mcq" style="top:${Y(1500).toFixed(1)}%"><em>1500</em></span><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${gap}<path d="${d}" style="stroke:${color}" vector-effect="non-scaling-stroke"/></svg><span class="mcp" style="left:${X(pk[0]).toFixed(1)}%;top:${Y(pk[1]).toFixed(1)}%" title="peak ${r10(pk[1])} in ${pk[0]}"></span>${label ? `<span class="mcpv" style="left:${X(pk[0]).toFixed(1)}%;top:${Y(pk[1]).toFixed(1)}%">${r10(pk[1])} '${String(pk[0]).slice(2)}</span>` : ''}<span class="mcy"><i>${y0}</i><i>${y1}</i></span></span>`;
  }
  /* finishes 1st–8th by unit at one level, in the class and window (results counted in the class they were wrestled in) */
  const placeDist = (kind, lvl) => memo('pd|' + kind + '|' + lvl, () => {
    const M = new Map(); const add = (k, p) => { if (k == null || !p || p > 8) return; let a = M.get(k); if (!a) M.set(k, (a = [0, 0, 0, 0, 0, 0, 0, 0])); a[p - 1]++; };
    const ok = (r) => OT.inWindow(r.year) && (state.cls === 'ALL' || r.cls === state.cls || (r.cls === 'single' && r.k === state.cls));
    const keyOf = kind === 'school' ? (r) => SIDX.get(r.sch) : kind === 'district' ? (r) => r.d || null : (r) => { const g = OT.regionOf(r); return g === 'W' ? 'SW' : g; };
    if (lvl === 'state') OT.APP.forEach((r) => { if (r.place && ok(r)) add(keyOf(r), r.place); });
    else OT.LOWER.forEach((r) => { if (r.lvl === lvl && r.place && ok(r)) add(keyOf(r), r.place); });
    return M;
  });
  const MEDC = ['#D9A441', '#B8BFC6', '#B5733A', '#8E5A3C', '#5F6B78', '#5F6B78', '#5F6B78', '#5F6B78'];
  const POD_ORDER = [7, 5, 3, 1, 0, 2, 4, 6];
  /* the podium: eight steps 8-6-4-2-1-3-5-7, height = how many times the unit finished there, top edge in the medal colour */
  function podium(counts, lvl, opts = {}) {
    const tot = counts.reduce((a, b) => a + b, 0), mx = Math.max(1, ...counts), H = opts.h || 26;
    const lab = { state: 'State', regional: 'Regional', district: 'District' }[lvl];
    const tip = `${lab}: ` + counts.map((n, i) => `${ordinal(i + 1)} ${n}`).join(' · ');
    return `<span class="pz${tot ? '' : ' pz0'}" title="${esc(tip)}"><span class="pzh">${OT.navIcon(LVI[lvl])}<b>${tot}</b><i>${counts[0] ? counts[0] + ' ★' : ''}</i></span><span class="pzs" style="height:${H}px">${POD_ORDER.map((i) => `<i style="height:${counts[i] ? Math.max(3, Math.round(H * counts[i] / mx)) : 1}px;--c:${MEDC[i]}" title="${ordinal(i + 1)}: ${counts[i]}"></i>`).join('')}</span></span>`;
  }
  const LVL3 = ['state', 'regional', 'district'];
  function unitCard(a, rank, sort, pageKind) {
    const lv = LVL3.filter((l, i) => a.w[i]);
    const rt = r10(a.rating) || '–';
    const hero = sort === 'titles' ? [a.ti, 'Titles'] : sort === 'score' ? [fmt(Math.round(a.score)), 'Score'] : [rt, 'RTG'];
    const second = sort === 'rating' ? [fmt(Math.round(a.score)), 'Score'] : [rt, 'RTG'];
    const offNote = a.off && a.kind === 'school' && state.cls !== 'ALL' ? ` · incl. ${a.off} ${state.cls === 'AAA' ? 'AA' : 'AAA'} season${a.off === 1 ? '' : 's'} at 85%` : '';
    const pods = lv.map((l) => podium(placeDist(a.kind, l).get(a.k) || [0, 0, 0, 0, 0, 0, 0, 0], l)).join('');
    const foot = [a.best ? `Best <b>${esc(a.best.name)}</b> ${r10(a.best.r)}${a.kind !== 'school' ? ' · ' + esc(a.best.sch) : ''} · '${String(a.best.y).slice(2)}` : '', a.tt ? `<b>${a.tt}</b> PIAA team title${a.tt === 1 ? '' : 's'}` : ''].filter(Boolean);
    return `<a class="uk" href="${a.href}"${a.color ? ` style="--p1:${a.color}"` : ''}>
      <span class="uk1"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i><span class="nm"><b>${esc(a.name)}</b><small>${[a.sub ? esc(a.sub) : '', `${second[1]} <b>${second[0]}</b>`].filter(Boolean).join(' · ')}${offNote}</small></span><span class="rv"><i>${hero[1]}</i><b>${hero[0]}</b></span></span>
      <span class="ukm">${miniChart(a.series, unitColor(a))}<span class="ukp">${pods}</span></span>
      ${foot.length ? `<span class="ukf">${foot.map((x) => `<span>${x}</span>`).join('')}</span>` : ''}</a>`;
  }
  /* one sort control */
  const sortSelect = (key, sorts, cur) => `<label class="ssel"><span>Sort</span><select data-sortsel="${key}" aria-label="Sort by">${sorts.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  function unitRankings(kind, parent, pageKind, opts = {}) {
    const sorts = [['rating', 'Rating'], ['score', 'Score']].concat(pageKind !== 'school' ? [['titles', 'Titles']] : []);
    let sort = sorts.some(([k]) => k === state.usort) ? state.usort : 'rating';
    if (sort === 'rating' && OT.yearsWindow()[1] < RATED_FROM) sort = 'score';
    const L = aggregate(kind, parent, pageKind).slice().sort(SORTS[sort]);
    L.forEach((a) => { a.kind = kind; });
    if (!L.length) return OT.empty('No ' + (kind === 'school' ? 'schools' : kind + 's') + ' with enough seasons in this window.');
    const lim = state.uall ? L.length : opts.limit || 20;
    const sortSeg = sortSelect('usort', sorts, sort);
    const more = L.length > (opts.limit || 20) ? `<button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Show top ' + (opts.limit || 20) : 'Show all ' + L.length}</button>` : '';
    return { sortSeg, html: `<div class="ul">${L.slice(0, lim).map((a, i) => unitCard(a, i + 1, sort, pageKind)).join('')}</div>${more ? `<div class="bmore">${more}</div>` : ''}` };
  }

  /* ---------- performance chart ----------
     One grammar on every unit page. On top, the rating chart, the page's primary graphic, with comparison lines picked by
     chips (school → district / region / state averages and up to three other schools; district → region and state
     averages and other districts; region → state average, other regions and its districts; state → the five regions).
     Beneath, one results row per level that counts on this page (State; + Regional on Region pages; + District on
     District and School pages), bars = placement points, gold stars = individual titles; a Team row on School and District
     pages. Tap a season for its sheet. */
  const seriesOf = (kind, id) => { if (kind === 'state') return unitAgg(OT.U.state()).series; const k = kind === 'school' ? SIDX.get(id) : id; const a = aggregateCore(kind, null, kind).find((x) => x.k === k); return a ? a.series : []; };
  const DASH = { st: '1.5 3.5', r: '7 4', d: '3 3' };
  function seriesOptions(u) {
    const O = [];
    if (u.kind === 'state') {
      FIVE.forEach((g) => O.push({ id: 'r:' + g, label: REGIONS[g], kind: 'region', ref: g, color: RNEUT[g][0], dash: RNEUT[g][1], def: true, many: true }));
      O.push({ id: 'st', label: 'State avg', kind: 'state', color: '#8E98A4', dash: DASH.st, def: true });
      return O;
    }
    const own = { id: 'own', kind: u.kind, ref: u.kind === 'district' ? +u.id : u.id, def: true, own: true, fixed: true };
    if (u.kind === 'school') {
      own.label = u.id; own.color = lineColor(u.id); O.push(own);
      if (u.d) O.push({ id: 'd', label: `District ${u.d} avg`, kind: 'district', ref: u.d, color: '#EEEAE1', dash: DASH.d, def: true });
      if (u.region) O.push({ id: 'r', label: `${REGIONS[u.region]} avg`, kind: 'region', ref: u.region, color: '#B8BFC6', dash: DASH.r, def: false });
      O.push({ id: 'st', label: 'State avg', kind: 'state', color: '#8E98A4', dash: DASH.st, def: true });
      (state.cmp && state.cmp.key === 'school:' + u.id ? state.cmp.extra : []).forEach((s, i) => O.push({ id: 's:' + s, label: s, kind: 'school', ref: s, color: NEUT[(i + 3) % 6][0], dash: NEUT[(i + 3) % 6][1] || '5 3', def: true, rm: true }));
    } else if (u.kind === 'district') {
      own.label = 'District ' + u.id; own.color = '#EEEAE1'; O.push(own);
      const sp = OT.districtRegionSpans(+u.id); const g = sp.length ? sp[sp.length - 1].g : null;
      if (g) O.push({ id: 'r', label: `${REGIONS[g]} avg`, kind: 'region', ref: g, color: '#B8BFC6', dash: DASH.r, def: true });
      O.push({ id: 'st', label: 'State avg', kind: 'state', color: '#8E98A4', dash: DASH.st, def: true });
      let n = 0; for (let k = 1; k <= 12; k++) if (k !== +u.id) { const st = NEUT[(n++ + 3) % 6]; O.push({ id: 'x:' + k, label: 'D' + k, kind: 'district', ref: k, color: st[0], dash: st[1] || '5 3', def: false, small: true }); }
    } else {
      own.label = REGIONS[u.id]; own.color = '#EEEAE1'; O.push(own);
      O.push({ id: 'st', label: 'State avg', kind: 'state', color: '#8E98A4', dash: DASH.st, def: true });
      FIVE.filter((g) => g !== u.id).forEach((g, i) => O.push({ id: 'g:' + g, label: REGIONS[g], kind: 'region', ref: g, color: NEUT[(i + 1) % 6][0], dash: NEUT[(i + 1) % 6][1] || '6 3', def: false, small: true }));
      OT.regionMembers(u.id).forEach((m, i) => O.push({ id: 'x:' + m.d, label: 'D' + m.d, kind: 'district', ref: m.d, color: NEUT[(i + 2) % 6][0], dash: NEUT[(i + 2) % 6][1] || '2 2', def: false, small: true }));
    }
    return O;
  }
  function cmpState(u, O) {
    const key = u.kind + ':' + u.id;
    if (!state.cmp || state.cmp.key !== key) {
      let focus = u.kind === 'state' ? null : u.kind === 'school' ? null : 'own';
      if (u.kind === 'state') { let best = -1; O.filter((o) => o.many).forEach((o) => { const s = seriesOf(o.kind, o.ref).filter((p) => p[1] && ratedYear(p[0])); const m = s.length ? s.reduce((t, p) => t + p[1], 0) / s.length : 0; if (m > best) { best = m; focus = o.id; } }); }
      state.cmp = { key, on: new Set(O.filter((o) => o.def).map((o) => o.id)), extra: [], focus };
    }
    if (state.cmp.focus && !state.cmp.on.has(state.cmp.focus)) state.cmp.focus = null;
    O.forEach((o) => { if (o.fixed) state.cmp.on.add(o.id); });
    return state.cmp;
  }
  function perfRows(u) {
    const rows = ssIn(u.kind === 'state' ? null : { kind: u.kind, id: u.kind === 'district' ? +u.id : u.id }); const by = new Map();
    rows.forEach((r) => { const x = by.get(r[1]) || { y: r[1], sp: 0, rp: 0, dp: 0, ti: 0, rt: 0, dt: 0, reg: {} }; x.sp += r[6]; x.rp += r[7]; x.dp += r[8]; x.ti += r[9]; x.rt += r[13]; x.dt += r[14];
      if (u.kind === 'state' && FIVE.includes(r[4])) x.reg[r[4]] = (x.reg[r[4]] || 0) + r[6]; by.set(r[1], x); });
    return Array.from(by.values()).sort((a, b) => a.y - b.y);
  }
  /* a school's team results by season; a district's best team result among its schools */
  const DROUND = [['Championship match', 'F'], ['Championship semifinals', 'SF'], ['Championship quarterfinals', 'QF']];
  const CT = new Map(); const canonT = (n) => { let v = CT.get(n); if (v === undefined) { v = OT.canon ? OT.canon(n) : n; CT.set(n, v); } return v; };
  const DRANK = { C: 4, F: 3, SF: 2, QF: 1, R: 0 };
  function teamResults(u) {
    return memo('team|' + u.kind + ':' + u.id, () => {
      const out = new Map(); const g = (y) => out.get(y) || out.set(y, {}).get(y);
      const mine = u.kind === 'school' ? (s) => s === u.id : (s, y) => { const x = OT.U.school(s); return x && x.d === +u.id; };
      if (u.kind === 'school') (OT.LTEAMS || []).forEach((t) => { if (canonT(t.sch) !== u.id || !(state.cls === 'ALL' || t.cls === state.cls || t.cls === 'single')) return; const o = g(t.year); const k = t.lvl === 'district' ? 'd' : 'r'; if (o[k] == null || t.place < o[k]) o[k] = t.place; });
      if (OT.TEAMSCORES) OT.TEAMSCORES.forEach((L, k) => { const [y, c] = k.split('|'); if (!(state.cls === 'ALL' || c === state.cls)) return; L.forEach((t) => { if (mine(t.sch, +y)) { const o = g(+y); if (o.s == null || t.place < o.s) { o.s = t.place; o.sn = t.sch; } } }); });
      (window.WR_DUALS || []).forEach(([year, cls, round, w, wd, , l, ld]) => { if (!(state.cls === 'ALL' || cls === state.cls)) return;
        const side = u.kind === 'school' ? (w === u.id ? w : l === u.id ? l : null) : (+wd === +u.id ? w : +ld === +u.id ? l : null); if (!side) return; const o = g(year);
        let v = 'R'; const dr = DROUND.find(([n]) => n === round); const won = side === w;
        if (dr) v = dr[1] === 'F' ? (won ? 'C' : 'F') : (won ? (dr[1] === 'SF' ? 'F' : 'SF') : dr[1]);
        if (o.u == null || DRANK[v] > DRANK[o.u]) { o.u = v; o.un = side; } });
      return out;
    });
  }
  const DUN = { C: ['PIAA team duals champion', '#D9A441'], F: ['PIAA team duals finalist', '#B8BFC6'], SF: ['PIAA team duals semifinal', '#B5733A'], QF: ['PIAA team duals quarterfinal', '#5F6B78'] };
  const STN = { 1: '#D9A441', 2: '#B8BFC6', 3: '#B5733A' };
  const glyph = { d: (x, y, s) => `<path d="M${x} ${y - s} L${x + s} ${y + s * 0.8} L${x - s} ${y + s * 0.8}Z" fill="#8E98A4"/>`, r: (x, y, s) => `<path d="M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y}Z" fill="#EEEAE1"/>`,
    s: (x, y, s, c) => `<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" rx="1" fill="${c}"/>`, u: (x, y, s, c) => `<circle cx="${x}" cy="${y}" r="${s - 0.6}" fill="none" stroke="${c}" stroke-width="1.8"/>` };
  const gl = (k, c) => `<svg viewBox="-6 -6 12 12" width="12" height="12" aria-hidden="true">${glyph[k](0, 0, 4.2, c)}</svg>`;
  const PAGE_LV = { state: [['State', 'sp', 'ti', '#D9A441']], region: [['State', 'sp', 'ti', '#D9A441'], ['Regional', 'rp', 'rt', '#B8BFC6']], district: [['State', 'sp', 'ti', '#D9A441'], ['Regional', 'rp', 'rt', '#B8BFC6'], ['District', 'dp', 'dt', '#5F6B78']] };
  function perfChart(u) {
    const O = seriesOptions(u), cs = cmpState(u, O);
    O.forEach((o) => { o.col = cs.focus === o.id ? GOLD : o.color; o.dsh = cs.focus === o.id ? '' : o.dash; });
    const on = O.filter((o) => cs.on.has(o.id));
    const ser = on.map((o) => ({ o, pts: (o.id === 'own' ? (unitAgg(u) || { series: [] }).series : seriesOf(o.kind, o.ref)).filter((p) => p[1] && ratedYear(p[0])) }));
    const rows = perfRows(u);
    const allY = rows.map((r) => r.y).concat(...ser.map((s) => s.pts.map((p) => p[0])));
    if (!allY.length) return OT.empty('No seasons in this window.');
    const sel = state.pseason && state.pseason.k === u.kind + ':' + u.id ? state.pseason.y : null;
    const y0 = Math.min(...allY), y1 = Math.max(...allY), n = y1 - y0 + 1, by = new Map(rows.map((r) => [r.y, r]));
    const phone = (window.innerWidth || 390) < 720;
    const avail = Math.min(1100, Math.max(280, (window.innerWidth || 390) - (phone ? 100 : 190)));
    const LP = ser.some((s) => s.pts.length) ? (phone ? 66 : 112) : 0;
    const cw = Math.max(n > 30 ? 16 : 0, (avail - LP) / n), W = cw * n + 8 + LP, x = (y) => 4 + cw * (y - y0) + cw / 2, WB = W - LP;
    const vals = [].concat(...ser.map((s) => s.pts.map((p) => p[1])));
    const lo0 = vals.length ? Math.min(...vals, 1500) : 1300, hi0 = vals.length ? Math.max(...vals, 1500) : 1700, pad = Math.max(30, (hi0 - lo0) * 0.12);
    const lo = lo0 - pad, hi = hi0 + pad * 1.6;
    const RH = phone ? 150 : 190, ry = (v) => 12 + (RH - 22) * (1 - (v - lo) / (hi - lo));
    let g = '', labs = `<span class="pl-l" style="top:0">Rating</span>`, ax = '';
    const stp = hi - lo > 700 ? 200 : hi - lo > 300 ? 100 : 50;
    for (let v = Math.ceil(lo / stp) * stp; v < hi; v += stp) { g += `<line x1="0" x2="${WB}" y1="${ry(v)}" y2="${ry(v)}" class="gl${v === 1500 ? ' q' : ''}"/>`; ax += `<span class="pl-a" style="top:${ry(v) - 7}px">${v}</span>`; }
    /* comparison lines first, own line(s) on top */
    const firstRated = ser.length ? Math.min(...ser.filter((s) => s.pts.length).map((s) => s.pts[0][0]).concat([9999])) : 9999;
    if (y0 < RATED_FROM && firstRated >= RATED_FROM && firstRated < 9999) { const gx = x(Math.min(RATED_FROM, y1)) - cw / 2; g += `<rect x="0" y="4" width="${Math.max(0, gx)}" height="${RH - 8}" class="nodat"/><text x="${Math.max(6, gx / 2)}" y="${RH / 2}" text-anchor="middle" class="nodt">${gx > 120 ? 'limited data before 1974' : 'limited data'}</text>`; }
    const order = ser.slice().sort((a, b) => ((a.o.id === cs.focus ? 2 : a.o.own ? 1 : 0) - (b.o.id === cs.focus ? 2 : b.o.own ? 1 : 0)));
    const ends = [];
    order.forEach(({ o, pts }) => {
      if (!pts.length) return;
      let d = '', gd = '', prev = null, pv = null; pts.forEach(([y, v]) => { if (prev != null && y - prev > 1) gd += 'M' + x(prev).toFixed(1) + ' ' + ry(pv).toFixed(1) + ' L' + x(y).toFixed(1) + ' ' + ry(v).toFixed(1) + ' '; d += (prev == null || y - prev > 1 ? 'M' : 'L') + x(y).toFixed(1) + ' ' + ry(v).toFixed(1) + ' '; prev = y; pv = v; });
      const foc = o.id === cs.focus;
      if (gd) g += `<path d="${gd}" data-sid="${esc(o.id)}" class="sl gap" style="stroke:${o.col}"/>`;
      const faint = !foc && !o.own && !['d', 'r', 'st'].includes(o.id);
      g += `<path d="${d}" data-sid="${esc(o.id)}" class="sl${o.own ? ' own' : ''}${foc ? ' foc' : ''}${faint ? ' faint' : ''}" style="stroke:${o.col}${o.dsh ? ';stroke-dasharray:' + o.dsh : ''}"/>`;
      if ((o.id === 'own' || foc) && pts.length) { const pk = pts.reduce((a, b) => (b[1] > a[1] ? b : a)); g += `<circle cx="${x(pk[0])}" cy="${ry(pk[1])}" r="4" class="pk"/><text x="${Math.min(WB - 18, Math.max(18, x(pk[0])))}" y="${ry(pk[1]) - 9}" text-anchor="middle" class="pkt">${r10(pk[1])}</text>`; }
      const last = pts[pts.length - 1]; ends.push({ o, y: ry(last[1]), x: x(last[0]), v: last[1] });
    });
    /* direct labels at each line's right end, nudged apart */
    ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    const short = (o) => (o.label.length > (phone ? 9 : 17) ? (o.kind === 'region' ? o.label.replace(/ avg$/, '').replace(/^North|^South/, (m) => m[0]).replace('east', 'E').replace('west', 'W').replace(' Central', 'C') + (/avg$/.test(o.label) ? ' avg' : '') : o.label.slice(0, phone ? 8 : 16) + '…') : o.label);
    const endLabels = ends.map((e) => `<text x="${(e.x + 6).toFixed(1)}" y="${(e.y + 3.5).toFixed(1)}" class="elab${e.o.id === cs.focus ? ' foc' : (!e.o.own && !['d', 'r', 'st'].includes(e.o.id) ? ' faint' : '')}" style="fill:${e.o.col}" data-focus="${esc(e.o.id)}">${esc(short(e.o))}<title>${esc(e.o.label)} · ${r10(e.v)} · tap to focus</title></text>`).join('');
    const valAt = (y) => ser.map(({ o, pts }) => { const p = pts.find((q) => q[0] === y); return p ? [o, p[1]] : null; }).filter(Boolean);
    if (sel) { const sx = x(sel); g += `<line x1="${sx}" x2="${sx}" y1="4" y2="${RH}" class="xh"/>`; valAt(sel).forEach(([o, v]) => { g += `<circle cx="${sx}" cy="${ry(v)}" r="3.4" style="fill:${o.col}" class="xd"/>`; }); }
    /* results rows */
    const lvls = PAGE_LV[u.kind === 'school' ? 'district' : u.kind] || PAGE_LV.district;
    const rowH = 54, gap = 12, BMAX = 26;
    let t = RH + gap; const bw = Math.max(2, Math.min(cw * 0.62, 18)), SS = Math.max(7, Math.min(cw * 0.75, 11));
    lvls.forEach(([lab, key, tk, col]) => {
      labs += `<span class="pl-l" style="top:${t + rowH - 16}px">${u.kind === 'state' ? 'Share' : lab}</span>`;
      g += `<line x1="0" x2="${WB}" y1="${t + rowH}" y2="${t + rowH}" class="bl"/>`;
      const mx = Math.max(1, ...rows.map((r) => r[key]));
      rows.forEach((r) => { const v = r[key]; const cx = x(r.y); let h = 0;
        if (v) {
          h = Math.max(2, BMAX * v / mx);
          if (u.kind === 'state') { /* 100% share of state points by region: neutral shades, the focused region gold */
            const tot = FIVE.reduce((tt, rg) => tt + (r.reg[rg] || 0), 0) || v; let yb = t + rowH; const HH = rowH - 6;
            FIVE.forEach((rg) => { const pv = r.reg[rg] || 0; if (!pv) return; const hh = HH * pv / tot; yb -= hh; g += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yb.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, hh - 0.6).toFixed(1)}" fill="${cs.focus === 'r:' + rg ? GOLD : RSHADE[rg]}"><title>${r.y} · ${REGIONS[rg]} ${Math.round(100 * pv / tot)}% of state points</title></rect>`; });
            h = 0; }
          else g += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(t + rowH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}"><title>${r.y} · ${lab} ${fmt(v)} pts</title></rect>`;
        }
        // a unit wins every title at its own level each season, so those stars would say nothing: skip them
        // stars mark individual titles. A district or region wins most titles below states every season, so on those
        // pages only state titles get stars (the counts below states say nothing); a school gets stars on every row.
        if (u.kind === 'state' || (u.kind !== 'school' && key !== 'sp')) return;
        const tc = r[tk] || 0; if (!tc) return;
        const base = t + rowH - h - 2;
        if (key !== 'sp') { g += `<text x="${cx}" y="${base.toFixed(1)}" text-anchor="middle" class="star${tc > 1 ? ' n' : ''}" style="font-size:${Math.max(7, SS - (tc > 1 ? 2 : 0))}px">★${tc > 1 ? tc : ''}<title>${r.y} · ${tc} ${lab.toLowerCase()} title${tc > 1 ? 's' : ''}</title></text>`; return; }
        if (tc <= 3) for (let k = 0; k < tc; k++) g += `<text x="${cx}" y="${(base - k * (SS - 1)).toFixed(1)}" text-anchor="middle" class="star" style="font-size:${SS}px">★<title>${r.y} · ${tc} ${lab.toLowerCase()} title${tc > 1 ? 's' : ''}</title></text>`;
        else g += `<text x="${cx}" y="${base.toFixed(1)}" text-anchor="middle" class="star n" style="font-size:${Math.max(7, SS - 1.5)}px">★${tc}<title>${r.y} · ${tc} ${lab.toLowerCase()} titles</title></text>`;
      });
      t += rowH + gap;
    });
    const team = u.kind === 'school' || u.kind === 'district' ? teamResults(u) : null;
    if (team) {
      const TH = 40; labs += `<span class="pl-l" style="top:${t + TH / 2 - 8}px">Team</span>`; g += `<line x1="0" x2="${WB}" y1="${t + TH}" y2="${t + TH}" class="bl"/>`;
      const s = Math.max(2.8, Math.min(cw * 0.3, 4.6));
      for (let y = y0; y <= y1; y++) { const o = team.get(y); if (!o) continue; const cx = x(y); let k = 0; const at = () => t + TH - s - 2 - k++ * (2 * s + 3); const tip = [];
        if (o.d === 1) { g += glyph.d(cx, at(), s); tip.push('district team title'); }
        if (o.r === 1) { g += glyph.r(cx, at(), s); tip.push('regional team title'); }
        if (o.s && o.s <= 3) { g += glyph.s(cx, at(), s, STN[o.s]); tip.push('PIAA team ' + ordinal(o.s) + (u.kind === 'district' && o.sn ? ' (' + o.sn + ')' : '')); }
        if (o.u && DUN[o.u]) { g += glyph.u(cx, at(), s, DUN[o.u][1]); tip.push(DUN[o.u][0] + (u.kind === 'district' && o.un ? ' (' + o.un + ')' : '')); }
        if (tip.length) g += `<rect x="${cx - cw / 2}" y="${t}" width="${cw}" height="${TH}" fill="transparent"><title>${y} · ${tip.join(' · ')}</title></rect>`; }
      t += TH + gap;
    }
    const bottom = t - gap;
    const step = cw >= 34 ? 1 : cw >= 22 ? 2 : cw >= 15 ? 5 : 10;
    for (let y = y0; y <= y1; y++) if ((y % step === 0) || (n <= 12)) g += `<text x="${x(y)}" y="${bottom + 15}" text-anchor="middle" class="ax">${cw < 30 ? "'" + String(y).slice(2) : y}</text>`;
    for (let y = y0; y <= y1; y++) { const vs = valAt(y).map(([o, v]) => `${o.label} ${r10(v)}`).join(' · '); g += `<rect data-py="${y}" data-tip="${esc(y + (vs ? ' · ' + vs : ''))}" x="${(4 + cw * (y - y0)).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${bottom}" class="hit${y === sel ? ' on' : ''}"><title>${esc(y + (vs ? ' · ' + vs : ''))}</title></rect>`; }
    g += endLabels;
    /* chips: the legend and the picker in one */
    const chip = (o) => `<button class="sc${cs.on.has(o.id) ? ' on' : ''}${o.small ? ' sm' : ''}${cs.focus === o.id ? ' foc' : ''}" data-cmp="${esc(o.id)}" aria-pressed="${cs.on.has(o.id)}"${o.fixed ? ' data-fixed="1"' : ''}><i style="border-top-color:${o.col}${o.dsh ? ';border-top-style:dashed' : ''}"></i>${esc(o.label)}${o.rm ? '<em aria-label="remove">✕</em>' : ''}</button>`;
    const add = u.kind === 'school' && cs.extra.length < 3 ? `<label class="scadd"><span>+ Compare</span><input list="cmp-schools" data-cmpadd="1" placeholder="school" aria-label="Compare with a school"><datalist id="cmp-schools">${S.map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>` : '';
    const big = O.filter((o) => !o.small), small = O.filter((o) => o.small);
    const chips = `<div class="schips">${big.map(chip).join('')}${add}</div>${small.length ? `<div class="schips sm">${small.map(chip).join('')}</div>` : ''}`;
    const legend = (u.kind === 'state' ? '<span>Share of state points by region:</span>' + FIVE.map((g2) => `<span><i class="sw" style="background:${cs.focus === 'r:' + g2 ? GOLD : RSHADE[g2]}"></i>${REGIONS[g2]}</span>`).join('') : `<span><b class="stk">★</b>individual title</span>`) + (team ? `${u.kind === 'school' ? `<span>${gl('d')}district team title</span><span>${gl('r')}regional team title</span>` : ''}<span>${gl('s', '#D9A441')}PIAA team top 3</span><span>${gl('u', '#D9A441')}PIAA duals finish</span>` : '');
    const sheet = sel ? seasonSheet(u, sel, by.get(sel), team && team.get(sel), valAt(sel)) : `<div class="note1">Tap a season for its ${u.kind === 'school' ? 'lineup' : 'state placers'}.</div>`;
    return `<div class="perf" data-perf="${esc(u.kind + ':' + u.id)}">${chips}<div class="ptip" aria-live="polite"></div><div class="pwrap"><div class="plabs" style="height:${bottom + 20}px">${labs}${ax}</div><div class="pscr${n > 30 ? ' scroll' : ''}"><svg viewBox="0 0 ${W} ${bottom + 20}" width="${W}" height="${bottom + 20}" role="img" aria-label="Rating and results by season">${g}</svg></div></div><div class="plg">${legend}</div>${sheet}</div>`;
  }
  /* one season under the chart: a school's lineup (each result with its strength bar), or a unit's state placers */
  function seasonSheet(u, y, row, tm, vals) {
    const DU = { C: 'champion', F: 'finalist', SF: 'semifinal', QF: 'quarterfinal', R: 'entered' };
    const tr = tm ? [tm.d ? `District team <b>${ordinal(tm.d)}</b>` : '', tm.r ? `Regional team <b>${ordinal(tm.r)}</b>` : '', tm.s ? `PIAA team <b>${ordinal(tm.s)}</b>${u.kind === 'district' && tm.sn ? ' ' + esc(tm.sn) : ''}` : '', tm.u ? `Team duals <b>${DU[tm.u]}</b>${u.kind === 'district' && tm.un ? ' ' + esc(tm.un) : ''}` : ''].filter(Boolean) : [];
    const vline = (vals || []).map(([o, v]) => `<span><i class="sw" style="background:${o.col || o.color}"></i>${esc(o.label)} <b>${r10(v)}</b></span>`).join('');
    const lvKeys = (PAGE_LV[u.kind === 'school' ? 'district' : u.kind] || []).map((l) => l[0]);
    const pts = row && u.kind !== 'state' ? lvKeys.map((l) => `<span>${l} <b>${row[{ State: 'sp', Regional: 'rp', District: 'dp' }[l]]}</b> pts</span>`).join('') : '';
    const head = `<div class="ssh"><b>${y}</b>${pts}<button class="ssx" data-py="${y}" aria-label="Close">✕</button></div>${vline ? `<div class="ssv">${vline}</div>` : ''}${tr.length ? `<div class="sstm">${tr.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}`;
    const LV2 = { D: 'district', R: 'regional', S: 'state' };
    if (u.kind === 'school') {
      const st = OT.APP.filter((r) => r.sch === u.id && r.year === y && (state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single'));
      const low = OT.LOWER.filter((r) => r.sch === u.id && r.year === y);
      const by = new Map(); const add = (r, L) => { const k = nkey(r.name); const x = by.get(k) || { name: r.name, w: r.w, wn: r.wn || +r.w || 999, r }; x[L] = r.place || 0; x['r' + L] = r; if (L === 'S') { x.w = r.w; x.wn = r.wn; x.r = r; } by.set(k, x); };
      low.forEach((r) => add(r, r.lvl === 'district' ? 'D' : 'R')); st.forEach((r) => add(r, 'S'));
      const L = Array.from(by.values()).sort((a, b) => (a.wn || 999) - (b.wn || 999));
      const cell = (x, L2) => { const p = x[L2], rr = x['r' + L2], lvl = LV2[L2]; if (p == null) return '<span class="tc"><span class="tp tp0"></span><i class="sb sb0"></i></span>'; const f = OT.fieldOf(rr, lvl);
        return `<span class="tc">${p ? `<b class="tp ${pcls(p)}" title="${lvl} ${ordinal(p)}">${p}</b>` : `<b class="tp q" title="${lvl} qualifier">Q</b>`}${f ? sbar(f, lvl, `${y} ${lvl} ${wShort(x.w)}`) : '<i class="sb sb0"></i>'}</span>`; };
      const rows = L.map((x) => { const rt = OT.ratingOf(x.r, x.S != null ? 'state' : x.r.lvl); return `<a class="sr" href="${OT.wrestlerHref(x.r)}"><span class="w">${wShort(x.w)}</span><span class="n">${esc(x.name)}</span><span class="f">${cell(x, 'D')}${cell(x, 'R')}${cell(x, 'S')}</span><span class="r">${rt ? r10(rt) : ''}</span></a>`; }).join('');
      return `<div class="ss">${head}${rows ? `<div class="srh"><span></span><span></span><span class="f"><i>D</i><i>R</i><i>S</i></span><span class="r">RTG</span></div>${rows}` : '<div class="note1">No district, regional or state results on file for this season.</div>'}</div>`;
    }
    const inU = u.kind === 'state' ? () => true : u.kind === 'district' ? (r) => r.d === +u.id : (r) => OT.regionOf(r) === u.id;
    const pl = OT.APP.filter((r) => r.year === y && r.place && (state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single') && inU(r)).sort((a, b) => a.place - b.place || a.wn - b.wn);
    const counts = [0, 0, 0, 0, 0, 0, 0, 0]; pl.forEach((r) => { if (r.place <= 8) counts[r.place - 1]++; });
    const rows = pl.slice(0, 40).map((r) => { const f = OT.fieldOf(r, 'state'); return `<a class="sr" href="${OT.wrestlerHref(r)}"><span class="w">${wShort(r.w)}</span><span class="n">${esc(r.name)} <small>${esc(r.sch)}</small></span><span class="f"><span class="tc"><b class="tp ${pcls(r.place)}">${r.place}</b>${f ? sbar(f, 'state', `${y} state ${wShort(r.w)}`) : '<i class="sb sb0"></i>'}</span></span><span class="r">${r10(OT.ratingOf(r, 'state')) || ''}</span></a>`; }).join('');
    return `<div class="ss">${head}${pl.length ? `<div class="sspod">${podium(counts, 'state', { h: 30 })}</div>` : ''}${rows || '<div class="note1">No state placers this season.</div>'}${pl.length > 40 ? `<div class="note1">and ${pl.length - 40} more</div>` : ''}</div>`;
  }

  Object.assign(OT, { sortSelect, UD, SLUG2S, aggregate, unitAgg, unitRankings, unitCard, wrestlerCard, timeline, compBar, compColor, fieldGauge, fieldTip, wlegend: legend, spark, perfChart, loadBW, recordOf, bwLoaded: () => !!BW, r10, colorOf, W3, sbar, resCell, podium, miniChart, placeDist, RCOL, lineColor, pctIn });
})();
