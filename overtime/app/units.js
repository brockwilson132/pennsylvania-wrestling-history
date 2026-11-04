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
  const colorOf = (s) => { const id = OT.SB && OT.SB.identity(s); return id && id.primary ? id.primary : '#5F6B78'; };
  const r10 = (v) => (v ? Math.round(v / 10) * 10 : null);
  const MEM = new Map(); const memo = (k, f) => { const kk = OT.wkey() + '|' + k; if (!MEM.has(kk)) MEM.set(kk, f()); return MEM.get(kk); };

  /* ss rows in scope (class + window), optionally inside a parent unit (membership as of each season) */
  const inParent = (p) => !p || p.kind === 'state' ? () => true : p.kind === 'region' ? (r) => r[4] === p.id : p.kind === 'district' ? (r) => r[3] === p.id : (r) => r[0] === SIDX.get(p.id);
  const ssIn = (p) => memo('ss|' + (p ? p.kind + ':' + p.id : 'all'), () => { const [a, b] = OT.yearsWindow(), f = inParent(p); return SS.filter((r) => clsOk(r[2]) && r[1] >= a && r[1] <= b && f(r)); });
  const nSeasons = () => memo('nS', () => new Set(ssIn(null).map((r) => r[1])).size || 1);

  /* aggregate ss rows by unit: rating per season (school: its lineup rating; district / region: its own season rating),
     Score parts, state results, titles and the best wrestler. Shared by the lists, the unit header and the chart. */
  function aggregateCore(kind, parent, pageKind) {
    return memo('core|' + kind + '|' + (parent ? parent.kind + ':' + parent.id : '') + '|' + pageKind, () => {
      const keyOf = kind === 'school' ? (r) => r[0] : kind === 'district' ? (r) => (r[3] >= 1 && r[3] <= 12 ? r[3] : null) : (r) => (FIVE.includes(r[4]) ? r[4] : null);
      const M = new Map(), w = W3[pageKind] || W3.school;
      ssIn(parent).forEach((r) => {
        const k = keyOf(r); if (k == null) return;
        let a = M.get(k); if (!a) M.set(k, (a = { k, kind, years: new Map(), sp: 0, rp: 0, dp: 0, ti: 0, pod: 0, plc: 0, q: 0, rt: 0, dt: 0, tt: 0, best: null }));
        const y = a.years.get(r[1]) || { y: r[1], rs: 0, rn: 0, sp: 0, rp: 0, dp: 0, ti: 0, rt: 0, dt: 0, tt: 0 }; a.years.set(r[1], y);
        if (kind === 'school') { if (r[5]) { y.rs += r[5]; y.rn++; } }
        else if (!y['c' + r[2]]) { y['c' + r[2]] = 1; const v = RATE[kind].get(k + '|' + r[1] + '|' + r[2]); if (v) { y.rs += v; y.rn++; } }
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
    const n = nSeasons(), minS = kind === 'school' ? Math.max(1, Math.ceil(n / 3)) : Math.max(1, Math.ceil(n / 2));
    return aggregateCore(kind, parent, pageKind).filter((a) => a.rating && a.series.length >= minS);
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
    let d = '', prev = null; pts.forEach(([y, v]) => { d += (prev == null || y - prev > 1 ? 'M' : 'L') + X(y).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; prev = y; });
    const pk = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lone = pts.length === 1 ? `<circle cx="${X(pts[0][0])}" cy="${Y(pts[0][1])}" r="1.6" fill="#8E98A4"/>` : '';
    return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#EEEAE1" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>${lone}<circle cx="${X(pk[0])}" cy="${Y(pk[1])}" r="2.6" fill="#D9A441"/></svg>`;
  }
  /* strength of competition: a bracket's field (mean rating of its top eight). Drawn as a bar whose height grows with
     the field and whose colour runs green → yellow → orange → red; the bracket header uses the same bar lying flat. */
  const FLO = 1000, FHI = () => (UD.typField.state || 1640) + 160;
  const fpos = (v) => Math.max(0.04, Math.min(1, (v - FLO) / (FHI() - FLO)));
  const PCT = UD.fieldPct || [];
  const pctOf = (v) => { if (!PCT.length) return null; let lo = 0, hi = PCT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (PCT[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / PCT.length); };
  const fieldTip = (v, ctx) => { const p = pctOf(v); return `Strength of competition ${r10(v)}` + (p != null ? ` · tougher than ${p}% of state brackets` : '') + (ctx ? ' · ' + ctx : ''); };
  const STOPS = [[0, [46, 194, 126]], [0.45, [229, 201, 74]], [0.72, [240, 138, 36]], [1, [255, 59, 47]]];
  /* colour and bar height follow where the bracket ranks among all state brackets, so the scale spreads across the range */
  const fq = (v) => { const p = pctOf(v); return p == null ? fpos(v) : Math.max(0.03, p / 100); };
  function compColor(v) { const f = fq(v); let i = 0; while (i < STOPS.length - 2 && f > STOPS[i + 1][0]) i++; const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1]; const t = Math.max(0, Math.min(1, (f - a) / (b - a)));
    return 'rgb(' + ca.map((x, k) => Math.round(x + (cb[k] - x) * t)).join(',') + ')'; }
  /* one season's competition bar (height grows with the field) */
  const compBar = (v, tip, max = 12) => (v ? `<i class="cb" style="height:${(2 + (max - 2) * fq(v)).toFixed(1)}px;background:${compColor(v)}" title="${esc(tip)}"></i>` : '<i class="cb0"></i>');
  /* bracket header: the same scale lying flat, ticks at the typical district, regional and state field */
  function fieldGauge(v, lvl) {
    if (v == null) return '';
    const T = UD.typField || {}, x = (q) => (100 * fpos(q)).toFixed(1);
    const ticks = [['district', 'D'], ['regional', 'R'], ['state', 'S']].filter(([k]) => T[k]).map(([k, l]) => `<span class="fgt${k === lvl ? ' on' : ''}" style="left:${x(T[k])}%" title="typical ${k} field ${r10(T[k])}"><em>${l}</em></span>`).join('');
    return `<div class="fg3" title="${esc(fieldTip(v))}"><div class="fgl"><span>Strength of competition</span><b style="color:${compColor(v)}">${r10(v)}</b></div><div class="fgw"><span class="fgtrk"><i style="width:${x(v)}%;background:linear-gradient(90deg,#2EC27E,${compColor(v)})"></i></span>${ticks}</div></div>`;
  }
  const legend = () => `<span class="clg"><i style="height:5px;background:#2EC27E"></i><i style="height:8px;background:#E5C94A"></i><i style="height:11px;background:#FF3B2F"></i>strength of competition</span>`;

  /* ---------- season timeline: rating line, D / R / S results and competition on one x-axis per season ----------
     Used by wrestler cards (compact, fixed 44px columns) and the wrestler page (full width, results link to brackets). */
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
  function timeline(apps, lower, opts = {}) {
    const M = OT.careerCells(apps, lower, { full: opts.full }), cr = OT.careerRating(apps, lower);
    const big = !!opts.page, cols = M.cols;
    const rat = cols.map((c) => { if (!c || !cr) return null; const s = cr.seasons.find((x) => x.year === c.year); return s ? s.rating : null; });
    const comp = cols.map((c, i) => { let best = null; M.rows.forEach((row) => { const x = row.cells[i]; if (!x || !x.r || x.dnc || x.nodata) return; const f = OT.fieldOf(x.r, row.k); if (f && (!best || f > best[0])) best = [f, row.k, x]; }); return best; });
    /* rating row: a thin line through the season dots, peak gold; values on the page, peak only on cards */
    const vals = rat.filter((v) => v), pkv = vals.length ? Math.max(...vals) : null, pki = rat.indexOf(pkv);
    const lo = vals.length ? Math.min(...vals, big ? 1450 : Infinity) - (big ? 60 : 25) : 0, hi = vals.length ? Math.max(...vals, big ? 1550 : -Infinity) + (big ? 60 : 25) : 1;
    const H = big ? 104 : 24, top = big ? 24 : 14, bot = big ? 8 : 3;
    const yp = (v) => top + (H - top - bot) * (1 - (v - lo) / Math.max(1, hi - lo));
    const xp = (i) => (100 * (i + 0.5) / 4);
    let line = '', prev = null; rat.forEach((v, i) => { if (!v) { prev = null; return; } line += (prev == null ? 'M' : 'L') + xp(i).toFixed(2) + ' ' + yp(v).toFixed(1) + ' '; prev = i; });
    const ref = big && lo < 1500 && hi > 1500 ? `<span class="tq" style="top:${yp(1500).toFixed(1)}px"><em>1500 · avg state qualifier</em></span>` : '';
    const dots = rat.map((v, i) => (v ? `<span class="td${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${yp(v).toFixed(1)}px" title="${cols[i].year} · Overtime Rating ${r10(v)}"></span>${big || i === pki ? `<span class="tv${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${(yp(v) - (big ? 20 : 15)).toFixed(1)}px">${r10(v)}</span>` : ''}` : '')).join('');
    const ratingRow = `<span class="tl-r" style="height:${H}px">${ref}<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" vector-effect="non-scaling-stroke"/></svg>${dots}</span>`;
    const head = cols.map((c, i) => `<span class="th">${c ? (big ? `<b>${OT.GRADE_L[i]} '${String(c.year).slice(2)}</b><i>${c.w ? wShort(c.w) + ' lbs' : ''}</i>` : `<b>'${String(c.year).slice(2)}</b> <i>${c.w ? wShort(c.w) : ''}</i>`) : `<b>${OT.GRADE_L[i]}</b><i></i>`}</span>`).join('');
    const lab = (t, icon) => `<span class="tlab">${big ? t : OT.navIcon(icon)}</span>`;
    const rows = M.rows.map((row) => lab(row.l, LVI[row.k]) + row.cells.map((c) => { const href = big && c && c.r && !c.dnc && !c.nodata ? OT.bhref(OT.bkey(c.r, row.k)) : null; return `<span class="tc">${cellPill(c, row.k, href)}</span>`; }).join('')).join('');
    const compRow = `${big ? '<span class="tlab">Competition</span>' : '<span class="tlab tlc" title="strength of competition">' + legendMini() + '</span>'}` + comp.map((x, i) => `<span class="tc tcb">${x ? compBar(x[0], fieldTip(x[0], `${cols[i].year} ${x[1]} ${x[2].w ? wShort(x[2].w) : ''}`), big ? 26 : 12) + (big ? `<em style="color:${compColor(x[0])}">${r10(x[0])}</em>` : '') : '<i class="cb0"></i>'}</span>`).join('');
    return `<span class="tl${big ? ' big' : ''}"><span class="tlab">${big ? 'Rating' : ''}</span>${ratingRow}<span class="tlab"></span>${head}${rows}${compRow}</span>`;
  }
  const legendMini = () => '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" fill="#2EC27E"/><rect x="4.5" y="5" width="3" height="7" fill="#E5C94A"/><rect x="9" y="1" width="3" height="11" fill="#FF3B2F"/></svg>';

  /* ---------- best wins (lazy) ---------- */
  let BW = null, BWP = null;
  const loadBW = () => BWP || (BWP = fetch('bestwins.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { BW = d; return d; }));
  const bestWinOf = (name, years) => { if (!BW) return null; const k = nkey(name); let b = null; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && (!b || v[0] > b[0])) b = [v[0], v[1], y, v[2]]; }); return b; };
  const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };
  const LVLN = { s: 'state', r: 'regional', d: 'district' };

  /* ---------- wrestler card ----------
     Identity and rating on top; beneath, the season timeline at its natural width and his postseason record beside it.
     Titles, medals and best wins live on his page, not here. */
  const recordOf = (name, years) => { if (!BW) return null; const k = nkey(name); const t = [0, 0, 0, 0]; let any = false; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && v.length > 3) { any = true; t[0] += v[3]; t[1] += v[4]; t[2] += v[5]; t[3] += v[6]; } }); return any ? t : null; };
  function wrestlerCard(w, rank, opts = {}) {
    if (!w.lower) w.lower = OT.lowerFor(w.apps);
    const cr = OT.careerRating(w.apps, w.lower);
    const badge = OT.SB ? OT.SB.svg(w.sch, { size: 28, variant: 'chip', title: false }) : '';
    const years = Array.from(new Set(w.apps.map((a) => a.year).concat(w.lower.map((r) => r.year)))).sort();
    const wn = w.apps.concat(w.lower).sort((a, b) => a.year - b.year).map((a) => a.w).filter(Boolean); const wts = wn.length ? (wShort(wn[0]) === wShort(wn[wn.length - 1]) ? wShort(wn[0]) : wShort(wn[0]) + '–' + wShort(wn[wn.length - 1])) : '';
    const y0 = years[0], y1 = years[years.length - 1];
    const rec = recordOf(w.name, years);
    const stat = rec ? `<span class="wks"><b>${rec[0]}–${rec[1]}</b><i>postseason</i>${rec[2] ? `<span><b>${rec[2]}</b> fall${rec[2] === 1 ? '' : 's'}</span>` : ''}${rec[3] ? `<span><b>${rec[3]}</b> OT win${rec[3] === 1 ? '' : 's'}</span>` : ''}${rec[0] + rec[1] ? `<span><b>${Math.round(100 * rec[0] / (rec[0] + rec[1]))}%</b> won</span>` : ''}</span>` : BW ? '<span class="wks"></span>' : '<span class="wks" data-need-bw="1"></span>';
    return `<a class="wk" href="${w.href}" style="--p1:${colorOf(w.sch)}">
      <span class="wk1">${rank ? `<i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>` : ''}<span class="bdg">${badge}</span><span class="nm"><b>${esc(w.name)}</b><small>${opts.noSchool ? '' : esc(w.sch) + ' · '}${y0 === y1 ? y0 : y0 + '–' + String(y1).slice(2)}${wts ? ' · ' + wts + ' lbs' : ''}</small></span>${cr ? `<span class="rv"><i>RTG</i><b>${r10(cr.peak)}</b></span>` : ''}</span>
      <span class="wkb">${timeline(w.apps, w.lower)}${stat}</span></a>`;
  }

  /* ---------- unit card ---------- */
  const SORTS = { rating: (a, b) => b.rating - a.rating, score: (a, b) => b.score - a.score || b.rating - a.rating, titles: (a, b) => b.ti - a.ti || b.score - a.score };
  function bar(segs, total) { if (!total) return '<span class="ub0"></span>'; return `<span class="ubar">${segs.map(([v, c, l]) => (v > 0 ? `<i style="width:${(100 * v / total).toFixed(2)}%;background:${c}" title="${esc(l)}"></i>` : '')).join('')}</span>`; }
  function unitCard(a, rank, sort) {
    const hero = sort === 'score' ? [fmt(Math.round(a.score)), 'Score'] : sort === 'titles' ? [a.ti, 'Titles'] : [r10(a.rating), 'RTG'];
    const second = sort === 'rating' ? `Score <b>${fmt(Math.round(a.score))}</b>` : `RTG <b>${r10(a.rating)}</b>`;
    const lv = LV.map(([l, c], i) => [a.parts[i], c, l + ' ' + fmt(Math.round(a.parts[i]))]).filter((x, i) => a.w[i]);
    const tot = a.parts.reduce((x, y) => x + y, 0);
    const res = [[a.ti, '#D9A441', 'titles'], [a.pod, '#B8BFC6', '2–4th'], [a.plc, '#5F6B78', '5–8th'], [a.q, '#3A424D', 'qual.']];
    const rtot = a.ti + a.pod + a.plc + a.q;
    return `<a class="uk" href="${a.href}"${a.color ? ` style="--p1:${a.color}"` : ''}>
      <span class="uk1"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i><span class="nm"><b>${esc(a.name)}</b><small>${[a.sub ? esc(a.sub) : '', second].filter(Boolean).join(' · ')}</small></span><span class="rt">${spark(a.series, 52, 22)}<span class="rv"><i>${hero[1]}</i><b>${hero[0]}</b></span></span></span>
      <span class="ukb" title="state results in the window">${bar(res.map(([v, c, l]) => [v, c, v + ' ' + l]), rtot)}<span class="lg"><em>State</em>${res.filter(([v]) => v).map(([v, c, l]) => `<span><i style="background:${c}"></i>${v} ${l}</span>`).join('') || '<span>no state qualifiers</span>'}</span></span>
      ${lv.length > 1 ? `<span class="ukb" title="Score by level">${bar(lv, tot)}<span class="lg"><em>Score</em>${lv.map(([v, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</span></span>` : ''}
      <span class="ukf">${a.tt ? `<span><b>${a.tt}</b> team title${a.tt === 1 ? '' : 's'}</span>` : ''}${a.best ? `<span>Best <b>${esc(a.best.name)}</b> ${r10(a.best.r)}${a.kind !== 'school' ? ' · ' + esc(a.best.sch) : ''} · '${String(a.best.y).slice(2)}</span>` : ''}</span></a>`;
  }
  /* one sort control: a compact select, so a level toggle and the sort fit on one line on a phone */
  const sortSelect = (key, sorts, cur) => `<label class="ssel"><span>Sort</span><select data-sortsel="${key}" aria-label="Sort by">${sorts.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  /* the ranked list of child units, one sort control */
  function unitRankings(kind, parent, pageKind, opts = {}) {
    const sorts = [['rating', 'Rating'], ['score', 'Score']].concat(pageKind !== 'school' ? [['titles', 'Titles']] : []);
    const sort = sorts.some(([k]) => k === state.usort) ? state.usort : 'rating';
    const L = aggregate(kind, parent, pageKind).slice().sort(SORTS[sort]);
    L.forEach((a) => { a.kind = kind; });
    if (!L.length) return OT.empty('No ' + (kind === 'school' ? 'schools' : kind + 's') + ' with enough seasons in this window.');
    const lim = state.uall ? L.length : opts.limit || 20;
    const sortSeg = sortSelect('usort', sorts, sort);
    const more = L.length > (opts.limit || 20) ? `<button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Show top ' + (opts.limit || 20) : 'Show all ' + L.length}</button>` : '';
    return { sortSeg, html: `<div class="ul">${L.slice(0, lim).map((a, i) => unitCard(a, i + 1, sort)).join('')}</div>${more ? `<div class="bmore">${more}</div>` : ''}` };
  }

  /* ---------- performance chart ----------
     One x-axis per season. Rows: Rating (line), then State, Regional and District (bar = placement points that season,
     gold pips on top = individual titles at that level), then Team for a school (district / regional team titles, PIAA
     team tournament top three, PIAA team duals finish). The label column stays put; long windows scroll sideways and open
     on the latest season. */
  function perfRows(u) {
    if (u.kind === 'state') { const A = unitAgg(u); const rows = ssIn(null); const by = new Map(); rows.forEach((r) => { const x = by.get(r[1]) || { y: r[1], sp: 0, rp: 0, dp: 0, ti: 0, rt: 0, dt: 0, rating: 0 }; x.sp += r[6]; x.ti += r[9]; by.set(r[1], x); });
      A.series.forEach(([y, v]) => { if (by.has(y)) by.get(y).rating = v; }); return Array.from(by.values()).sort((a, b) => a.y - b.y); }
    const a = unitAgg(u); if (!a) return [];
    return a.ys.map((y) => ({ y: y.y, rating: y.rn ? y.rs / y.rn : 0, sp: y.sp, rp: y.rp, dp: y.dp, ti: y.ti, rt: y.rt, dt: y.dt }));
  }
  /* a school's team results by season */
  const DROUND = [['Championship match', 'F'], ['Championship semifinals', 'SF'], ['Championship quarterfinals', 'QF']];
  const CT = new Map(); const canonT = (n) => { let v = CT.get(n); if (v === undefined) { v = OT.canon ? OT.canon(n) : n; CT.set(n, v); } return v; };
  function teamResults(sch) {
    return memo('team|' + sch, () => {
      const out = new Map(); const g = (y) => out.get(y) || out.set(y, {}).get(y);
      (OT.LTEAMS || []).forEach((t) => { if (canonT(t.sch) !== sch || !(state.cls === 'ALL' || t.cls === state.cls || t.cls === 'single')) return; const o = g(t.year); const k = t.lvl === 'district' ? 'd' : 'r'; if (o[k] == null || t.place < o[k]) o[k] = t.place; });
      if (OT.TEAMSCORES) OT.TEAMSCORES.forEach((L, k) => { const [y, c] = k.split('|'); if (!(state.cls === 'ALL' || c === state.cls)) return; L.forEach((t) => { if (t.sch === sch) { const o = g(+y); if (o.s == null || t.place < o.s) o.s = t.place; } }); });
      (window.WR_DUALS || []).forEach(([year, cls, round, w, , , l]) => { if ((w !== sch && l !== sch) || !(state.cls === 'ALL' || cls === state.cls)) return; const o = g(year);
        const rank = { C: 4, F: 3, SF: 2, QF: 1, R: 0 }; let v = 'R'; const dr = DROUND.find(([n]) => n === round);
        if (dr) v = dr[1] === 'F' ? (w === sch ? 'C' : 'F') : (w === sch ? (dr[1] === 'SF' ? 'F' : 'SF') : dr[1]);
        if (o.u == null || rank[v] > rank[o.u]) o.u = v; });
      return out;
    });
  }
  const DUN = { C: ['PIAA team duals champion', '#D9A441'], F: ['PIAA team duals finalist', '#B8BFC6'], SF: ['PIAA team duals semifinal', '#B5733A'], QF: ['PIAA team duals quarterfinal', '#5F6B78'] };
  const STN = { 1: '#D9A441', 2: '#B8BFC6', 3: '#B5733A' };
  const glyph = { d: (x, y, s) => `<path d="M${x} ${y - s} L${x + s} ${y + s * 0.8} L${x - s} ${y + s * 0.8}Z" fill="#8E98A4"/>`, r: (x, y, s) => `<path d="M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y}Z" fill="#EEEAE1"/>`,
    s: (x, y, s, c) => `<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" rx="1" fill="${c}"/>`, u: (x, y, s, c) => `<circle cx="${x}" cy="${y}" r="${s - 0.6}" fill="none" stroke="${c}" stroke-width="1.8"/>` };
  const gl = (k, c) => `<svg viewBox="-6 -6 12 12" width="12" height="12" aria-hidden="true">${glyph[k](0, 0, 4.2, c)}</svg>`;
  function perfChart(u) {
    const rows = perfRows(u); if (!rows.length) return OT.empty('No seasons in this window.');
    const sel = state.pseason && state.pseason.k === u.kind + ':' + u.id ? state.pseason.y : null;
    const y0 = rows[0].y, y1 = rows[rows.length - 1].y, n = y1 - y0 + 1, by = new Map(rows.map((r) => [r.y, r]));
    const avail = Math.min(1100, Math.max(300, (window.innerWidth || 390) - (window.innerWidth > 900 ? 190 : 100)));
    const cw = Math.max(n > 30 ? 17 : 0, avail / n), W = cw * n + 8, x = (y) => 4 + cw * (y - y0) + cw / 2;
    const rated = rows.filter((r) => r.rating), rv = rated.map((r) => r.rating);
    const span = rv.length ? Math.max(140, Math.max(...rv) - Math.min(...rv)) : 200, lo = rv.length ? Math.min(...rv) - span * 0.12 : 1300, hi = rv.length ? Math.max(...rv) + span * 0.25 : 1700;
    const RH = 104, ry = (v) => 14 + (RH - 24) * (1 - (v - lo) / (hi - lo));
    const team = u.kind === 'school' ? teamResults(u.id) : null;
    const lvls = u.kind === 'state' ? [['State', 'sp', 'ti', '#D9A441']] : [['State', 'sp', 'ti', '#D9A441'], ['Regional', 'rp', 'rt', '#B8BFC6'], ['District', 'dp', 'dt', '#5F6B78']];
    const rowH = 48, gap = 10, BMAX = 22, PIP = 3, PG = 1.4;
    let g = '', labs = `<span class="pl-l" style="top:0">Rating</span>`;
    const stp = hi - lo > 600 ? 200 : hi - lo > 250 ? 100 : 50; let ax = '';
    for (let v = Math.ceil(lo / stp) * stp; v < hi; v += stp) { g += `<line x1="0" x2="${W}" y1="${ry(v)}" y2="${ry(v)}" class="gl${v === 1500 ? ' q' : ''}"/>`; ax += `<span class="pl-a" style="top:${ry(v) - 7}px">${v}</span>`; }
    let d = '', prev = null; rated.forEach((r) => { d += (prev == null || r.y - prev > 1 ? 'M' : 'L') + x(r.y).toFixed(1) + ' ' + ry(r.rating).toFixed(1) + ' '; prev = r.y; });
    g += `<path d="${d}" class="rl"/>`;
    if (cw >= 12) rated.forEach((r) => { g += `<circle cx="${x(r.y)}" cy="${ry(r.rating)}" r="${cw > 24 ? 2.6 : 1.9}" class="rp"/>`; });
    if (rated.length) { const pk = rated.reduce((a, b) => (b.rating > a.rating ? b : a)); g += `<circle cx="${x(pk.y)}" cy="${ry(pk.rating)}" r="4" class="pk"/><text x="${Math.min(W - 16, Math.max(16, x(pk.y)))}" y="${ry(pk.rating) - 8}" text-anchor="middle" class="pkt">${r10(pk.rating)}</text>`; }
    let t = RH + gap; const bw = Math.max(2, Math.min(cw * 0.66, 18)), pw = Math.max(3, Math.min(cw * 0.5, 10));
    lvls.forEach(([lab, key, tk, col]) => {
      const mx = Math.max(1, ...rows.map((r) => r[key])), usePips = Math.max(0, ...rows.map((r) => r[tk] || 0)) <= 5; labs += `<span class="pl-l" style="top:${t + rowH - 16}px">${lab}</span>`;
      g += `<line x1="0" x2="${W}" y1="${t + rowH}" y2="${t + rowH}" class="bl"/>`;
      rows.forEach((r) => { const v = r[key], tc = r[tk] || 0; const cx = x(r.y); let h = 0;
        if (v) { h = Math.max(2, BMAX * v / mx); g += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(t + rowH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}"><title>${r.y} · ${lab} ${fmt(v)} pts${tc ? ' · ' + tc + ' title' + (tc > 1 ? 's' : '') : ''}</title></rect>`; }
        if (!usePips) { if (tc) g += `<text x="${cx}" y="${(t + rowH - h - 3).toFixed(1)}" text-anchor="middle" class="tln">${tc}</text>`; return; }
        const np = Math.min(tc, 5); for (let k = 0; k < np; k++) { const py = t + rowH - h - 2 - (k + 1) * PIP - k * PG; g += `<rect x="${(cx - pw / 2).toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${PIP}" rx="1" class="pip"/>`; }
        if (tc > 5) g += `<text x="${cx}" y="${(t + rowH - h - 4 - 5 * (PIP + PG)).toFixed(1)}" text-anchor="middle" class="pipn">+${tc - 5}</text>`; });
      t += rowH + gap;
    });
    if (team) {
      const TH = 40; labs += `<span class="pl-l" style="top:${t + TH / 2 - 8}px">Team</span>`; g += `<line x1="0" x2="${W}" y1="${t + TH}" y2="${t + TH}" class="bl"/>`;
      const s = Math.max(2.6, Math.min(cw * 0.3, 4.4));
      for (let y = y0; y <= y1; y++) { const o = team.get(y); if (!o) continue; const cx = x(y); let k = 0; const at = () => t + TH - s - 2 - k++ * (2 * s + 2.5); const tip = [];
        if (o.d === 1) { g += glyph.d(cx, at(), s); tip.push('district team title'); }
        if (o.r === 1) { g += glyph.r(cx, at(), s); tip.push('regional team title'); }
        if (o.s && o.s <= 3) { g += glyph.s(cx, at(), s, STN[o.s]); tip.push('PIAA team ' + ordinal(o.s)); }
        if (o.u && DUN[o.u]) { g += glyph.u(cx, at(), s, DUN[o.u][1]); tip.push(DUN[o.u][0]); }
        if (tip.length) g += `<rect x="${cx - cw / 2}" y="${t}" width="${cw}" height="${TH}" fill="transparent"><title>${y} · ${tip.join(' · ')}</title></rect>`; }
      t += TH + gap;
    }
    const bottom = t - gap;
    const step = cw >= 34 ? 1 : cw >= 22 ? 2 : cw >= 15 ? 5 : 10;
    for (let y = y0; y <= y1; y++) if ((y % step === 0) || (n <= 12)) g += `<text x="${x(y)}" y="${bottom + 15}" text-anchor="middle" class="ax">${cw < 30 ? "'" + String(y).slice(2) : y}</text>`;
    for (let y = y0; y <= y1; y++) g += `<rect data-py="${y}" x="${(4 + cw * (y - y0)).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${bottom}" class="hit${y === sel ? ' on' : ''}"><title>${y}</title></rect>`;
    const legend = (u.kind === 'school' ? `<span><i class="pipk"></i>title (one pip each)</span>` : `<span><b class="tlnk">3</b>titles that season</span>`) + (team ? `<span>${gl('d')}district team title</span><span>${gl('r')}regional team title</span><span>${gl('s', '#D9A441')}PIAA team top 3</span><span>${gl('u', '#D9A441')}PIAA duals finish</span>` : '');
    const sheet = sel ? seasonSheet(u, sel, by.get(sel), team && team.get(sel)) : `<div class="note1">Tap a season for its ${u.kind === 'school' ? 'lineup' : 'state placers'}.</div>`;
    return `<div class="perf" data-perf="${esc(u.kind + ':' + u.id)}"><div class="pwrap"><div class="plabs" style="height:${bottom + 20}px">${labs}${ax}</div><div class="pscr${n > 30 ? ' scroll' : ''}"><svg viewBox="0 0 ${W} ${bottom + 20}" width="${W}" height="${bottom + 20}" role="img" aria-label="Rating and results by season">${g}</svg></div></div>${legend ? `<div class="plg">${legend}</div>` : ''}${sheet}</div>`;
  }
  /* one season under the chart: a school's lineup (best finish at each level, rating), or a unit's state placers */
  function seasonSheet(u, y, row, tm) {
    const DU = { C: 'champion', F: 'finalist', SF: 'semifinal', QF: 'quarterfinal', R: 'entered' };
    const tr = tm ? [tm.d ? `District team <b>${ordinal(tm.d)}</b>` : '', tm.r ? `Regional team <b>${ordinal(tm.r)}</b>` : '', tm.s ? `PIAA team <b>${ordinal(tm.s)}</b>` : '', tm.u ? `Team duals <b>${DU[tm.u]}</b>` : ''].filter(Boolean) : [];
    const head = `<div class="ssh"><b>${y}</b>${row && row.rating ? `<span>RTG <b>${r10(row.rating)}</b></span>` : ''}${row && u.kind !== 'state' ? `<span>State <b>${row.sp}</b></span><span>Regional <b>${row.rp}</b></span><span>District <b>${row.dp}</b></span>` : ''}<button class="ssx" data-py="${y}" aria-label="Close">✕</button></div>${tr.length ? `<div class="sstm">${tr.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}`;
    if (u.kind === 'school') {
      const st = OT.APP.filter((r) => r.sch === u.id && r.year === y && (state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single'));
      const low = OT.LOWER.filter((r) => r.sch === u.id && r.year === y);
      const by = new Map(); const add = (r, L) => { const k = nkey(r.name); const x = by.get(k) || { name: r.name, w: r.w, wn: r.wn || +r.w || 999, D: null, R: null, S: null, r }; x[L] = r.place || 0; if (L === 'S') { x.w = r.w; x.wn = r.wn; x.r = r; } by.set(k, x); };
      low.forEach((r) => add(r, r.lvl === 'district' ? 'D' : 'R')); st.forEach((r) => add(r, 'S'));
      const L = Array.from(by.values()).sort((a, b) => (a.wn || 999) - (b.wn || 999));
      const pill = (p, lvl) => (p == null ? '<span class="sp0"></span>' : p ? `<b class="pl ${pcls(p)}" title="${lvl} ${ordinal(p)}">${p}</b>` : `<b class="pl q" title="${lvl} qualifier">Q</b>`);
      const rows = L.map((x) => { const rt = OT.ratingOf(x.r, x.S != null ? 'state' : x.r.lvl); return `<a class="sr" href="${OT.wrestlerHref(x.r)}"><span class="w">${wShort(x.w)}</span><span class="n">${esc(x.name)}</span><span class="f">${pill(x.D, 'District')}${pill(x.R, 'Regional')}${pill(x.S, 'State')}</span><span class="r">${rt ? r10(rt) : ''}</span></a>`; }).join('');
      return `<div class="ss">${head}${rows ? `<div class="srh"><span></span><span></span><span class="f"><i>D</i><i>R</i><i>S</i></span><span class="r">RTG</span></div>${rows}` : '<div class="note1">No district, regional or state results on file for this season.</div>'}</div>`;
    }
    const inU = u.kind === 'state' ? () => true : u.kind === 'district' ? (r) => r.d === u.id : (r) => OT.regionOf(r) === u.id;
    const pl = OT.APP.filter((r) => r.year === y && r.place && (state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single') && inU(r)).sort((a, b) => a.place - b.place || a.wn - b.wn);
    const rows = pl.slice(0, 40).map((r) => `<a class="sr" href="${OT.wrestlerHref(r)}"><span class="w">${wShort(r.w)}</span><span class="n">${esc(r.name)} <small>${esc(r.sch)}</small></span><span class="f"><b class="pl ${pcls(r.place)}">${r.place}</b></span><span class="r">${r10(OT.ratingOf(r, 'state')) || ''}</span></a>`).join('');
    return `<div class="ss">${head}${rows || '<div class="note1">No state placers this season.</div>'}${pl.length > 40 ? `<div class="note1">and ${pl.length - 40} more</div>` : ''}</div>`;
  }

  Object.assign(OT, { sortSelect, UD, SLUG2S, aggregate, unitAgg, unitRankings, unitCard, wrestlerCard, timeline, compBar, compColor, fieldGauge, fieldTip, wlegend: legend, spark, perfChart, loadBW, bwLoaded: () => !!BW, r10, colorOf, W3 });
})();
