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
        const y = a.years.get(r[1]) || { y: r[1], rs: 0, rn: 0, sp: 0, rp: 0, dp: 0, ti: 0 }; a.years.set(r[1], y);
        if (kind === 'school') { if (r[5]) { y.rs += r[5]; y.rn++; } }
        else if (!y['c' + r[2]]) { y['c' + r[2]] = 1; const v = RATE[kind].get(k + '|' + r[1] + '|' + r[2]); if (v) { y.rs += v; y.rn++; } }
        y.sp += r[6]; y.rp += r[7]; y.dp += r[8]; y.ti += r[9];
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
  /* field strength wedge: its length and its thickness both grow with the bracket's field (mean rating of its top eight),
     on a green→red gradient that runs the full possible length, so a weak field is short, thin and green and a brutal one
     long, thick and red. One definition, used under career pills and in bracket headers. */
  const FLO = 1000, FHI = () => (UD.typField.state || 1640) + 160;
  const fpos = (v) => Math.max(0.05, Math.min(1, (v - FLO) / (FHI() - FLO)));
  const PCT = UD.fieldPct || [];
  const pctOf = (v) => { if (!PCT.length) return null; let lo = 0, hi = PCT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (PCT[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / PCT.length); };
  const fieldTip = (v) => { const p = pctOf(v); return `Field ${r10(v)}` + (p != null ? ` · tougher than ${p}% of state brackets` : ''); };
  function wedge(v, opts = {}) {
    if (!v) return opts.blank ? '<i class="wdg"></i>' : '';
    const f = fpos(v), L = 100 * f, t = 1 + 3.2 * f, mid = 2.5;
    return `<svg class="wdg${opts.cls ? ' ' + opts.cls : ''}" viewBox="0 0 100 5" preserveAspectRatio="none" role="img" aria-label="${esc(fieldTip(v))}"><title>${esc(fieldTip(v))}</title><polygon points="0,${mid - 0.45} ${L.toFixed(1)},${(mid - t / 2).toFixed(2)} ${L.toFixed(1)},${(mid + t / 2).toFixed(2)} 0,${mid + 0.45}" fill="url(#fwg)"/></svg>`;
  }
  /* bracket-header gauge: the same wedge at full width, with ticks at the typical district, regional and state field */
  function fieldGauge(v, lvl) {
    if (v == null) return '';
    const T = UD.typField || {}, x = (q) => (100 * fpos(q)).toFixed(1);
    const ticks = [['district', 'D'], ['regional', 'R'], ['state', 'S']].filter(([k]) => T[k]).map(([k, l]) => `<span class="fgt${k === lvl ? ' on' : ''}" style="left:${x(T[k])}%" title="typical ${k} field ${r10(T[k])}"><em>${l}</em></span>`).join('');
    return `<div class="fg2" title="${esc(fieldTip(v))}"><div class="fgl"><span>Field</span><b>${r10(v)}</b></div><div class="fgw"><svg class="wdg trk" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,2.05 100,0.9 100,4.1 0,2.95" fill="#242A32"/></svg>${wedge(v)}${ticks}</div></div>`;
  }
  const legend = () => `<span class="wlg"><svg viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,2.05 70,1.1 70,3.9 0,2.95" fill="url(#fwg)"/></svg>field strength</span>`;

  /* ---------- best wins (lazy) ---------- */
  let BW = null, BWP = null;
  const loadBW = () => BWP || (BWP = fetch('bestwins.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { BW = d; return d; }));
  const bestWinOf = (name, years) => { if (!BW) return null; const k = nkey(name); let b = null; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && (!b || v[0] > b[0])) b = [v[0], v[1], y, v[2]]; }); return b; };
  const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };
  const LVLN = { s: 'state', r: 'regional', d: 'district' };

  /* ---------- wrestler card ---------- */
  const pcls = (p) => (p >= 5 ? 'c5' : 'c' + p);
  function pillCell(c, lvl) {
    if (!c || (lvl === 'regional' && c.year < 1951)) return '<span class="pc"></span>';
    const f = c.r && !c.dnc && !c.nodata ? OT.fieldOf(c.r, lvl) : null;
    const tip = (t) => `${c.year}${c.w ? ' · ' + wShort(c.w) : ''} · ${lvl} ${t}${f ? ' · ' + fieldTip(f) : ''}`;
    let p;
    if (c.place) p = `<b class="pl ${pcls(c.place)}" title="${esc(tip(ordinal(c.place)))}">${c.place}</b>`;
    else if (c.dnc) p = `<b class="pl dnc" title="${c.year} · did not compete at districts">DNC</b>`;
    else if (c.nodata) p = `<b class="pl nod" title="${c.year} · ${esc(c.src || 'no bracket on record')}">–</b>`;
    else if (c.dnp) p = `<b class="pl dnp" title="${esc(tip('entered, did not place'))}">DNP</b>`;
    else p = `<b class="pl q" title="${esc(tip(c.src || 'qualified'))}">Q</b>`;
    return `<span class="pc">${p}${f ? wedge(f) : '<i class="wdg"></i>'}</span>`;
  }
  const LVI = { district: 'district', regional: 'region', state: 'state' };
  function wrestlerCard(w, rank, opts = {}) {
    if (!w.lower) w.lower = OT.lowerFor(w.apps);
    const M = OT.careerCells(w.apps, w.lower), cr = OT.careerRating(w.apps, w.lower);
    const badge = OT.SB ? OT.SB.svg(w.sch, { size: 28, variant: 'chip', title: false }) : '';
    const st = w.apps.filter((a) => a.place); const titles = st.filter((a) => a.place === 1).length;
    const years = Array.from(new Set(w.apps.map((a) => a.year).concat(w.lower.map((r) => r.year)))).sort();
    const wn = w.apps.concat(w.lower).sort((a, b) => a.year - b.year).map((a) => a.w).filter(Boolean); const wts = wn.length ? (wShort(wn[0]) === wShort(wn[wn.length - 1]) ? [wShort(wn[0])] : [wShort(wn[0]) + '–' + wShort(wn[wn.length - 1])]) : [];
    const bw = bestWinOf(w.name, years);
    const y0 = years[0], y1 = years[years.length - 1];
    const head = M.cols.map((c, i) => `<span class="ch">${c ? `<b>'${String(c.year).slice(2)}</b>${c.w ? ' ' + wShort(c.w) : ''}` : OT.GRADE_L[i]}</span>`).join('');
    const rows = M.rows.map((r) => `<span class="lv" title="${r.l}">${OT.navIcon(LVI[r.k])}</span>${r.cells.map((c) => pillCell(c, r.k)).join('')}`).join('');
    const foot = [titles ? `<span><b>${titles}</b> title${titles === 1 ? '' : 's'}</span>` : '', st.length ? `<span><b>${st.length}</b> state medal${st.length === 1 ? '' : 's'}</span>` : w.apps.length ? '<span>state qualifier</span>' : '',
      bw ? `<span class="bw" title="best win: ${esc(bw[1])}, rated ${r10(bw[0])}, ${bw[2]} ${LVLN[bw[3]] || ''}">Best win <b>${esc(shortName(bw[1]))}</b> ${r10(bw[0])} · '${String(bw[2]).slice(2)} ${(LVLN[bw[3]] || '')[0] ? LVLN[bw[3]][0].toUpperCase() : ''}</span>` : BW ? '' : '<span class="bw" data-need-bw="1"></span>'].filter(Boolean).join('');
    return `<a class="wk" href="${w.href}" style="--p1:${colorOf(w.sch)}">
      <span class="wk1">${rank ? `<i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>` : ''}<span class="bdg">${badge}</span><span class="nm"><b>${esc(w.name)}</b><small>${opts.noSchool ? '' : esc(w.sch) + ' · '}${y0 === y1 ? y0 : y0 + '–' + String(y1).slice(2)}${wts.length ? ' · ' + wts.join(', ') + ' lbs' : ''}</small></span>${cr ? `<span class="rt">${spark(cr.seasons.map((s) => [s.year, s.rating]), 44, 20)}<span class="rv"><i>RTG</i><b>${r10(cr.peak)}</b></span></span>` : ''}</span>
      <span class="mx"><span></span>${head}${rows}</span>
      ${foot ? `<span class="wkf">${foot}</span>` : ''}</a>`;
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

  /* ---------- performance chart ---------- */
  /* rows per season for a unit: rating, and placement points at each level, titles */
  function perfRows(u) {
    if (u.kind === 'state') { const A = unitAgg(u); const rows = ssIn(null); const by = new Map(); rows.forEach((r) => { const x = by.get(r[1]) || { y: r[1], sp: 0, rp: 0, dp: 0, ti: 0, rating: 0 }; x.sp += r[6]; x.ti += r[9]; by.set(r[1], x); });
      A.series.forEach(([y, v]) => { if (by.has(y)) by.get(y).rating = v; }); return Array.from(by.values()).sort((a, b) => a.y - b.y); }
    const a = unitAgg(u); if (!a) return [];
    return a.ys.map((y) => ({ y: y.y, rating: y.rn ? y.rs / y.rn : 0, sp: y.sp, rp: y.rp, dp: y.dp, ti: y.ti }));
  }
  function perfChart(u) {
    const rows = perfRows(u); if (!rows.length) return OT.empty('No seasons in this window.');
    const sel = state.pseason && state.pseason.k === u.kind + ':' + u.id ? state.pseason.y : null;
    const y0 = rows[0].y, y1 = rows[rows.length - 1].y, n = y1 - y0 + 1;
    const vw = Math.min(1100, Math.max(330, (window.innerWidth || 390) - (window.innerWidth > 900 ? 120 : 34)));
    const W = vw, padL = 46, padR = 6, cw = (W - padL - padR) / n, x = (y) => padL + cw * (y - y0) + cw / 2;
    const rated = rows.filter((r) => r.rating), rv = rated.map((r) => r.rating);
    const span = rv.length ? Math.max(140, Math.max(...rv) - Math.min(...rv)) : 200, lo = rv.length ? Math.min(...rv) - span * 0.12 : 1300, hi = rv.length ? Math.max(...rv) + span * 0.22 : 1700;
    const RH = 112, ry = (v) => 10 + (RH - 22) * (1 - (v - lo) / (hi - lo));
    let g = '';
    const stp = hi - lo > 600 ? 200 : hi - lo > 250 ? 100 : 50; for (let v = Math.ceil(lo / stp) * stp; v < hi; v += stp) g += `<line x1="${padL}" x2="${W - padR}" y1="${ry(v)}" y2="${ry(v)}" class="gl${v === 1500 ? ' q' : ''}"/><text x="${padL - 6}" y="${ry(v) + 4}" text-anchor="end" class="ax">${v}</text>`;
    let d = '', prev = null; rated.forEach((r) => { d += (prev == null || r.y - prev > 1 ? 'M' : 'L') + x(r.y).toFixed(1) + ' ' + ry(r.rating).toFixed(1) + ' '; prev = r.y; });
    g += `<path d="${d}" class="rl"/>`;
    if (rated.length < 30) rated.forEach((r) => { g += `<circle cx="${x(r.y)}" cy="${ry(r.rating)}" r="2" class="rp"/>`; });
    if (rated.length) { const pk = rated.reduce((a, b) => (b.rating > a.rating ? b : a)); g += `<circle cx="${x(pk.y)}" cy="${ry(pk.rating)}" r="4" class="pk"/><text x="${Math.min(W - 18, Math.max(padL + 14, x(pk.y)))}" y="${ry(pk.rating) - 8}" text-anchor="middle" class="pkt">${r10(pk.rating)}</text>`; }
    const lvls = u.kind === 'state' ? [] : [['State', 'sp', '#D9A441'], ['Regional', 'rp', '#B8BFC6'], ['District', 'dp', '#5F6B78']];
    const rowH = 26, top0 = RH + 8;
    lvls.forEach(([lab, key, col], k) => {
      const t = top0 + k * (rowH + 6), mx = Math.max(1, ...rows.map((r) => r[key]));
      g += `<text x="0" y="${t + rowH / 2 + 4}" class="lab">${lab}</text><line x1="${padL}" x2="${W - padR}" y1="${t + rowH}" y2="${t + rowH}" class="bl"/>`;
      rows.forEach((r) => { const v = r[key]; if (!v) return; const h = Math.max(2, (rowH - 3) * v / mx); g += `<rect x="${(x(r.y) - cw * 0.36).toFixed(1)}" y="${(t + rowH - h).toFixed(1)}" width="${Math.max(1, cw * 0.72).toFixed(1)}" height="${h.toFixed(1)}" rx="${cw > 6 ? 1.5 : 0}" fill="${col}"/>`; });
      if (key === 'sp') rows.forEach((r) => { if (r.ti) g += `<text x="${x(r.y)}" y="${t - 1}" text-anchor="middle" class="star">${n > 40 ? '★' : r.ti > 1 ? r.ti + '★' : '★'}</text>`; });
    });
    const bottom = lvls.length ? top0 + lvls.length * (rowH + 6) : RH + 4;
    const step = n > 60 ? 20 : n > 30 ? 10 : n > 12 ? 5 : n > 6 ? 2 : 1;
    for (let y = y0; y <= y1; y++) if ((y - y0) % step === 0 || y === y1) { if (y !== y1 && y1 - y < step / 2 && (y - y0) % step === 0 && y !== y0) continue; g += `<text x="${x(y)}" y="${bottom + 13}" text-anchor="middle" class="ax">${n > 12 ? y : "'" + String(y).slice(2)}</text>`; }
    for (let y = y0; y <= y1; y++) g += `<rect data-py="${y}" x="${(padL + cw * (y - y0)).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${bottom}" class="hit${y === sel ? ' on' : ''}"><title>${y}</title></rect>`;
    const sheet = sel ? seasonSheet(u, sel, rows.find((r) => r.y === sel)) : `<div class="note1">Tap a season for its ${u.kind === 'school' ? 'lineup' : 'state placers'}.</div>`;
    return `<div class="perf" data-perf="${esc(u.kind + ':' + u.id)}"><svg viewBox="0 0 ${W} ${bottom + 18}" width="100%" role="img" aria-label="Rating and results by season">${g}</svg>${sheet}</div>`;
  }
  /* one season under the chart: a school's lineup (best finish at each level, rating), or a unit's state placers */
  function seasonSheet(u, y, row) {
    const head = `<div class="ssh"><b>${y}</b>${row && row.rating ? `<span>RTG <b>${r10(row.rating)}</b></span>` : ''}${row && u.kind !== 'state' ? `<span>State <b>${row.sp}</b></span><span>Regional <b>${row.rp}</b></span><span>District <b>${row.dp}</b></span>` : ''}<button class="ssx" data-py="${y}" aria-label="Close">✕</button></div>`;
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

  Object.assign(OT, { sortSelect, UD, SLUG2S, aggregate, unitAgg, unitRankings, unitCard, wrestlerCard, wedge, fieldGauge, fieldTip, wlegend: legend, spark, perfChart, loadBW, bwLoaded: () => !!BW, r10, colorOf, W3 });
})();
