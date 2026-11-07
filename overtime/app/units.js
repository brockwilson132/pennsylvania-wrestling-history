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
  /* district / region seasons: Strength (average of its schools) and Talent (expected state medalists per school); both are
     left out of a season unless every member school's full district field is on file (tools/build_units.js) */
  const RATE = { district: new Map(), region: new Map() }, TAL = { district: new Map(), region: new Map() };
  UD.ds.forEach(([u, y, c, r, t]) => { if (r) { RATE.district.set(u + '|' + y + '|' + c, r); TAL.district.set(u + '|' + y + '|' + c, t); } });
  UD.rs.forEach(([u, y, c, r, t]) => { const uu = u === 'W' ? 'SW' : u; if (r) { RATE.region.set(uu + '|' + y + '|' + c, r); TAL.region.set(uu + '|' + y + '|' + c, t); } });
  /* schools wrestling per district / region season (every school from its first to its last season on file), the
     divisor for Score per school; and each school's first and last season, the divisor for Score per season */
  const NSCH = { district: new Map(), region: new Map() };
  UD.ds.forEach(([u, y, c, , , n, nw]) => NSCH.district.set(u + '|' + y + '|' + c, nw || n));
  UD.rs.forEach(([u, y, c, , , n, nw]) => NSCH.region.set((u === 'W' ? 'SW' : u) + '|' + y + '|' + c, nw || n));
  const SPAN = UD.span || [];
  /* Unit-season ratings need enough rated wrestlers in the lineup / top-4 per weight. Before 1974 (one class, regional
     fields of one wrestler per district, partial old brackets) most weights are padded with fill values, so unit
     ratings there read far too low; they are not plotted or averaged. Results (bars, stars, podiums) still count. */
  const RATED_FROM = 1974;
  const ratedYear = (y) => y >= RATED_FROM;
  const OFFW = OT.OFF_CLASS || 0.85;
  const colorOf = (s) => { const id = OT.SB && OT.SB.identity(s); return id && id.primary ? id.primary : '#5F6B78'; };
  /* Score is a per-season average: one decimal under 100 */
  const sfmt = (v) => (v >= 100 ? fmt(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1));
  const r10 = (v) => (v ? Math.round(v / 10) * 10 : null);
  const rw = (v) => (v ? Math.round(v) : null);   // a wrestler's own rating, to the point (matches his bracket numbers); r10 is for averages
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
  /* a school's rated seasons in the other class, statewide (the Timeline's second row); never mixed into this class */
  const otherClass = (schoolIdx) => { if (state.cls === 'ALL') return []; const [a, b] = OT.yearsWindow();
    return SS.filter((r) => r[0] === schoolIdx && r[1] >= a && r[1] <= b && r[2] !== state.cls && r[2] !== 'single' && r[5] && ratedYear(r[1])).map((r) => ({ y: r[1], v: r[5], c: r[2], e: false })); };
  function aggregateCore(kind, parent, pageKind, home) {
    return memo('core|' + kind + '|' + (parent ? parent.kind + ':' + parent.id : '') + '|' + pageKind + (home ? '|h' : ''), () => {
      const keyOf = kind === 'school' ? (r) => r[0] : kind === 'district' ? (r) => (r[3] >= 1 && r[3] <= 12 ? r[3] : null) : (r) => (FIVE.includes(r[4]) ? r[4] : null);
      const M = new Map(), w = W3[pageKind] || W3.school;
      (home ? homeRows(parent) : ssIn(parent)).forEach((r) => {
        const k = keyOf(r); if (k == null) return;
        const inC = !home || r[2] === state.cls || r[2] === 'single', m = inC ? 1 : OFFW;
        let a = M.get(k); if (!a) M.set(k, (a = { k, kind, years: new Map(), sp: 0, rp: 0, dp: 0, ti: 0, pod: 0, plc: 0, q: 0, rt: 0, dt: 0, tt: 0, best: null }));
        const y = a.years.get(r[1]) || { y: r[1], rs: 0, rn: 0, ts: 0, tn: 0, sp: 0, rp: 0, dp: 0, ti: 0, rt: 0, dt: 0, tt: 0, nsch: 0 }; a.years.set(r[1], y);
        if (kind !== 'school' && !y['n' + r[2]]) { y['n' + r[2]] = 1; y.nsch += NSCH[kind].get(k + '|' + r[1] + '|' + r[2]) || 0; }
        if (!ratedYear(r[1]) || !inC) { /* no Strength or Talent */ }
        else if (kind === 'school') { if (r[5]) { y.rs += r[5]; y.rn++; y.ts += r[19]; y.tn++; } }
        else if (!y['c' + r[2]]) { y['c' + r[2]] = 1; const kk = k + '|' + r[1] + '|' + r[2], v = RATE[kind].get(kk); if (v) { y.rs += v; y.rn++; y.ts += TAL[kind].get(kk) || 0; y.tn++; } }
        if (!inC) { a.off = (a.off || 0) + 1; a.sp += r[6] * m; a.rp += r[7] * m; a.dp += r[8] * m; y.sp += r[6] * m; y.rp += r[7] * m; y.dp += r[8] * m; a.ti += r[9]; return; }
        y.sp += r[6]; y.rp += r[7]; y.dp += r[8]; y.ti += r[9]; y.rt += r[13]; y.dt += r[14]; y.tt += r[15];
        a.sp += r[6]; a.rp += r[7]; a.dp += r[8]; a.ti += r[9]; a.pod += r[10]; a.plc += r[11]; a.q += r[12]; a.rt += r[13]; a.dt += r[14]; a.tt += r[15];
        if (r[17] >= 0 && (!a.best || r[18] > a.best.r)) a.best = { name: N[r[17]], r: r[18], sch: S[r[0]], y: r[1] };
      });
      return Array.from(M.values()).map((a) => {
        a.ys = Array.from(a.years.values()).sort((p, q) => p.y - q.y); a.series = a.ys.filter((y) => y.rn).map((y) => [y.y, y.rs / y.rn]);
        a.rating = a.series.length ? a.series.reduce((t, x) => t + x[1], 0) / a.series.length : 0;
        /* Talent: expected state medalists per season (per school for districts and regions), over the same seasons as Strength */
        a.tseries = a.ys.filter((y) => y.tn).map((y) => [y.y, y.ts / y.tn]); a.talent = a.tseries.length ? a.tseries.reduce((t, x) => t + x[1], 0) / a.tseries.length : 0;
        a.nS = a.series.length;
        /* Score: era-fair placement points per season (tools/build_units.js), per school for districts and regions. A
           school's seasons are every season of the window from its first to its last on file, scoreless ones included;
           a district's or region's are the seasons it had schools, each divided by the schools wrestling that season. */
        const [wa, wb] = OT.yearsWindow();
        let nSc;
        if (kind === 'school') { const sp = SPAN[a.k]; nSc = sp && sp[1] ? Math.max(1, Math.min(wb, sp[1]) - Math.max(wa, sp[0]) + 1) : a.ys.length; }
        else nSc = a.ys.filter((y) => y.nsch).length || 1;
        a.ys.forEach((y) => { const dv = kind === 'school' ? 1 : y.nsch || 1; y.sc = (y.sp * w[0] + y.rp * w[1] + y.dp * w[2]) / dv; y.pp = [y.sp * w[0] / dv, y.rp * w[1] / dv, y.dp * w[2] / dv]; });
        a.parts = [0, 1, 2].map((i) => a.ys.reduce((t, y) => t + y.pp[i], 0) / nSc); a.score = a.parts[0] + a.parts[1] + a.parts[2]; a.w = w; a.nSc = nSc;
        a.name = kind === 'school' ? S[a.k] : kind === 'district' ? 'District ' + a.k : REGIONS[a.k];
        a.sub = kind === 'district' ? DISTRICTS[a.k] : '';
        a.href = kind === 'school' ? '#school/' + slug(S[a.k]) : kind === 'district' ? '#district/' + a.k : '#region/' + a.k;
        a.color = kind === 'school' ? colorOf(S[a.k]) : null;
        return a;
      });
    });
  }
  /* list members need enough seasons with Strength in the window: a third of them (D3 and D7 have none for 1975-98) */
  function aggregate(kind, parent, pageKind) {
    const [wa, wb] = OT.yearsWindow(); const rs = new Set(ssIn(null).map((r) => r[1]).filter(ratedYear));
    const n = Math.max(1, rs.size), minS = Math.max(1, Math.ceil(n / 3));
    const home = kind === 'school' && state.cls !== 'ALL';
    if (wb < RATED_FROM) return aggregateCore(kind, parent, pageKind, home).filter((a) => a.score > 0).map((a) => { a.rating = a.rating || 0; return a; });
    return aggregateCore(kind, parent, pageKind, home).filter((a) => a.rating && a.series.length >= minS);
  }
  /* one unit's own numbers (its page header and chart): no season minimum */
  function unitAgg(u) {
    if (u.kind === 'state') return memo('own|state', () => { const L = aggregateCore('region', null, 'state'); const ys = new Map(); L.forEach((a) => a.series.forEach(([y, v]) => { const x = ys.get(y) || [0, 0]; x[0] += v; x[1]++; ys.set(y, x); }));
      const series = Array.from(ys).sort((a, b) => a[0] - b[0]).map(([y, x]) => [y, x[0] / x[1]]); const all = ssIn(null);
      /* Score: state points per school per season, statewide */
      const per = new Map(); L.forEach((a) => a.ys.forEach((y) => { const x = per.get(y.y) || [0, 0]; x[0] += y.sp; x[1] += y.nsch; per.set(y.y, x); }));
      const pv = Array.from(per.values()).filter((x) => x[1]);
      return { rating: series.length ? series.reduce((t, x) => t + x[1], 0) / series.length : 0, series, score: pv.length ? pv.reduce((t, x) => t + x[0] / x[1], 0) / pv.length : 0, ti: all.reduce((t, r) => t + r[9], 0), tt: 0 }; });
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
     A bracket's strength is the mean rating of its top eight. Everywhere a result appears it gets one slim bar beside it.
     Every level shares ONE scale anchored to the average state bracket: that bracket sits at 80% of the bar (orange), the
     weakest district brackets (5th percentile) at the empty end, and the scale runs on in straight rating points, so the
     toughest state brackets reach red. A loaded district therefore reads close to a state bracket, a thin one reads cold,
     and a state bracket always reads as the state bracket it is. The bracket header lays the same bar flat, with a tick at
     the average state bracket. */
  const LK = { state: 's', regional: 'r', district: 'd' };
  let LP = null;
  const lvlArr = (lvl) => {
    if (!LP) { LP = { s: [], r: [], d: [] }; const SO = window.WR_SOS || {};
      for (const y in SO) { const Y = SO[y]; for (const k in Y) { const e = Y[k]; if (!e || e[0] == null) continue; const l = k.split('.')[1]; if (LP[l]) LP[l].push(e[0] * 10); } }
      Object.values(LP).forEach((a) => a.sort((x, z) => x - z)); }
    return LK[lvl] ? LP[LK[lvl]] : [];
  };
  const pctIn = (v, lvl = 'state') => { const A = lvlArr(lvl); if (!A.length) return null; let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] < v) lo = m + 1; else hi = m; } return Math.round(100 * lo / A.length); };
  /* cold → hot: ice blue, cyan, green, yellow, orange, fire red. One ramp for every rating and strength colour. */
  const STOPS = [[0, [44, 91, 216]], [0.2, [32, 168, 216]], [0.42, [46, 194, 126]], [0.62, [229, 197, 58]], [0.8, [240, 138, 36]], [1, [232, 57, 43]]];
  const colorAt = (f) => { let i = 0; while (i < STOPS.length - 2 && f > STOPS[i + 1][0]) i++; const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1]; const t = Math.max(0, Math.min(1, (f - a) / (b - a))); return 'rgb(' + ca.map((x, k) => Math.round(x + (cb[k] - x) * t)).join(',') + ')'; };
  const S_AT = 0.8;   // where the average state bracket sits on every bar
  let SAX = null;
  const mean = (A) => A.reduce((a, b) => a + b, 0) / A.length;
  const sAnchor = () => { if (!SAX) { const S = lvlArr('state'), R = lvlArr('regional'), D = lvlArr('district');
      const avg = S.length ? mean(S) : 1710, lo = D.length ? D[Math.floor(0.05 * (D.length - 1))] : 500;
      SAX = { avg, lo: Math.min(lo, avg - 400), lvl: { state: avg, regional: R.length ? mean(R) : null, district: D.length ? mean(D) : null } }; }
    return SAX; };
  const sFrac = (v) => { const { avg, lo } = sAnchor(); return Math.max(0.06, Math.min(1, S_AT * (v - lo) / (avg - lo))); };
  const vsState = (v) => { const d = Math.round((v - sAnchor().avg) / 10) * 10; return Math.abs(d) < 10 ? 'level with the average state bracket' : `${Math.abs(d)} ${d > 0 ? 'above' : 'below'} the average state bracket`; };
  const fieldTip = (v, lvl = 'state', ctx) => { const p = pctIn(v, lvl); return `Strength of competition ${r10(v)} · ${vsState(v)} (${r10(sAnchor().avg)})` + (p != null ? ` · tougher than ${p}% of ${lvl} brackets` : '') + (ctx ? ' · ' + ctx : ''); };
  const compColor = (v, lvl = 'state') => colorAt(sFrac(v, lvl));
  /* ---------- the toughness signal: six signal bars beside every result ----------
     Each bracket is measured against brackets at its OWN level (section counts as district): six equal steps of rating
     points between that level's 5th and 95th percentile, from Docile (one bar) to Violent (six). The column a result sits
     in already says the level, so the bars spend all six steps on "how tough for a district / regional / state bracket".
     The comparison across levels (exact number, how far from the average state bracket) lives in the tooltip and the
     bracket header. Cut points come from every bracket on file, so they follow each rebuild. */
  const SG_N = ['Docile', 'Formidable', 'Competitive', 'Aggressive', 'Hostile', 'Violent'];
  const SG_LV = ['district', 'regional', 'state'];
  const sgLvl = (lvl) => (lvl === 'section' || !LK[lvl] ? (lvl === 'state' ? 'state' : 'district') : lvl);
  let SGC = null;
  const sgCuts = (lvl) => {
    if (!SGC) { SGC = {}; SG_LV.forEach((l) => { const A = lvlArr(l); if (!A.length) return; const q = (p) => A[Math.floor(p * (A.length - 1))], lo = q(0.05), hi = q(0.95);
      SGC[l] = [1, 2, 3, 4, 5].map((i) => Math.round((lo + (hi - lo) * i / 6) / 10) * 10); }); }
    return SGC[sgLvl(lvl)] || [];
  };
  const sgTier = (v, lvl) => sgCuts(lvl).filter((c) => v >= c).length;
  const sgCol = (t) => colorAt(0.08 + 0.9 * t / 5);
  const sgSvg = (t, cls = '') => `<svg class="sgv${cls}" viewBox="0 0 23 14" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 4}" y="${12 - i * 2}" width="3" height="${2 + i * 2}" rx=".6" fill="${i <= t ? sgCol(t) : '#2F3640'}"/>`).join('')}</svg>`;
  const sgRange = (t, lvl) => { const C = sgCuts(lvl); return t === 0 ? `under ${r10(C[0])}` : t === 5 ? `${r10(C[4])}+` : `${r10(C[t - 1])}–${r10(C[t] - 10)}`; };
  const sgTip = (v, lvl, ctx) => { const l = sgLvl(lvl), t = sgTier(v, l), p = pctIn(v, l);
    return `${SG_N[t]} for a ${l} bracket · strength ${r10(v)} · ${vsState(v)}` + (p != null ? ` · tougher than ${p}% of ${l} brackets` : '') + (ctx ? ' · ' + ctx : ''); };
  const smeter = (v, lvl, ctx, num) => {
    if (!v) return '<span class="sgn sg0" aria-hidden="true"></span>';
    const t = sgTier(v, lvl);
    return `<span class="sgn${num ? ' n' : ''}" title="${esc(sgTip(v, lvl, ctx))}" aria-label="${SG_N[t]}">${num ? `<em style="color:${sgCol(t)}">${r10(v)}</em>` : ''}${sgSvg(t)}</span>`;
  };
  /* the old thin line, kept for the one place that is not a bracket: a wrestler's path through a bracket */
  const lineMeter = (v, lvl, ctx) => { if (!v) return '<span class="smtr sm0" aria-hidden="true"><i></i></span>'; const f = sFrac(v, lvl), c = colorAt(f);
    return `<span class="smtr" title="${esc(fieldTip(v, lvl, ctx))}"><i><b style="width:${(100 * f).toFixed(0)}%;background:${c}"></b></i></span>`; };
  /* the key: one row of the six tiers above the bottom bar; tapping it opens what each tier means at each level */
  const sgKey = (open) => {
    const cell = (t) => `<span>${sgSvg(t)}<b>${SG_N[t]}</b></span>`;   // three tiers either side of the bar's centre button, column for column
    const row = `<span class="sgk">${[0, 1, 2].map(cell).join('')}<span class="sgkc" aria-hidden="true"></span>${[3, 4, 5].map(cell).join('')}</span>`;
    if (!open) return row;
    const SG_D = ['The thinnest brackets at its level', 'Below the average bracket', 'Around the average bracket', 'Above the average bracket', 'Among the toughest at its level', 'The toughest at its level'];
    const L = sAnchor().lvl;
    const lvls = SG_LV.map((l) => `<span class="sgl"><i>${l[0].toUpperCase() + l.slice(1)}</i><em>avg ${r10(L[l])}</em></span>`).join('');
    const rows = SG_N.map((n, t) => `<div class="sgr">${sgSvg(t, ' big')}<span class="sgm"><b style="color:${sgCol(t)}">${n}</b><small>${SG_D[t]}</small></span>${SG_LV.map((l) => `<span class="sgv2${sgTier(L[l], l) === t ? ' avg' : ''}">${sgRange(t, l)}</span>`).join('')}</div>`).join('');
    return `${row}<div class="sgx"><p>Signal bars compare a bracket only with brackets at the same level. Its column (district, regional or state) tells you which. A Violent district bracket is still easier than most state brackets: tap a result or open a bracket for the exact strength and how it compares with the average state bracket (${r10(L.state)}).</p><div class="sgt"><span></span><span></span>${lvls}${rows}</div><p class="sgf">The gold dot marks the tier holding each level's average bracket. Strength is the average rating of a bracket's top eight. Each level is cut into six equal steps between its 5th and 95th percentile, using every bracket on file.</p></div>`;
  };
  const sbar = (v, lvl, ctx) => smeter(v, lvl, ctx, false);
  const compBar = (v, tip) => sbar(v, 'state', tip);
  /* bracket header: the same bar lying flat on the same scale, with ticks for the average bracket at its own level and at
     every level above it (a district header shows district, regional and state), labelled under the track */
  const TICK_L = { district: 'Avg district', regional: 'Avg regional', state: 'Avg state' };
  function fieldGauge(v, lvl = 'state') {
    if (v == null) return '';
    const f = sFrac(v, lvl), p = pctIn(v, lvl), L = sAnchor().lvl;
    const from = { state: 0, regional: 1, district: 2, section: 2 }[lvl] ?? 0;   // ticks for this level and every level above it
    const ticks = ['state', 'regional', 'district'].slice(0, from + 1).map((k) => [k, L[k]]).filter((t) => t[1] != null).reverse();
    const st = sgTier(v, lvl);
    return `<div class="fg4" title="${esc(fieldTip(v, lvl))}"><div class="fgl"><span>Strength of competition</span><span class="fgsg">${sgSvg(st)}<i style="color:${sgCol(st)}">${SG_N[st]}</i><b style="color:${colorAt(f)}">${r10(v)}</b></span></div><div class="fgw4"><span class="fgtrk4"><i style="width:${(100 * f).toFixed(1)}%;background:${colorAt(f)}"></i>${ticks.map(([k, a]) => `<u style="left:${(100 * sFrac(a)).toFixed(1)}%"></u>`).join('')}</span>${ticks.length ? `<span class="fgtk">${ticks.map(([k, a]) => `<s style="left:${(100 * sFrac(a)).toFixed(1)}%" title="Average ${k} bracket ${r10(a)}">${TICK_L[k]}</s>`).join('')}</span>` : ''}<em>${vsState(v)}${p != null ? ` · tougher than ${p}% of ${lvl} brackets` : ''}</em></div></div>`;
  }

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
  function resCell(c, lvl, link, num) {
    const lv = c && c.sec ? 'section' : lvl;
    const ok = c && c.r && !c.dnc && !c.nodata; const href = link && ok ? OT.bhref(OT.bkey(c.r, lv)) : null;
    const f = ok ? OT.fieldOf(c.r, lv) : null;
    return `<span class="tc">${smeter(f, lvl, f ? `${c.year} ${lvl}${c.w ? ' ' + wShort(c.w) : ''}` : '', num)}${cellPill(c, lvl, href)}</span>`;
  }
  /* ---------- career grid (wrestler page) ----------
     One compact card that fits a phone screen: a column per high-school season, his season rating on top as a tile on
     the strength scale (peak ringed gold), then one row per level. Each result is a medal-coloured place with the
     bracket's toughness for its level as signal bars to its left (number on tap/hover), so the only numbers in the grid
     are places and ratings. Labels sit on a hairline above their row. */
  function careerGrid(apps, lower, opts = {}) {
    const M = OT.careerCells(apps, lower, { full: opts.full }), cr = OT.careerRating(apps, lower), cols = M.cols;
    const rat = cols.map((c) => { if (!c || !cr) return null; const s = cr.seasons.find((x) => x.year === c.year); return s ? s.rating : null; });
    const pk = Math.max(...rat.filter(Boolean), 0);
    const head = cols.map((c, i) => `<span class="cgh${c ? '' : ' off'}"><b>${OT.GRADE_L[i]}${c ? ` '${String(c.year).slice(2)}` : ''}</b><i>${c && c.w ? wShort(c.w) + ' lb' : ''}</i></span>`).join('');
    const rt = rat.map((v, i) => (v ? `<span class="cgr${v === pk ? ' pk' : ''}" style="--tint:${ratingColor('wrestler', v)}" title="${cols[i].year} season rating ${rw(v)}${v === pk ? ' · peak' : ''}"><b>${rw(v)}</b></span>` : '<span class="cgr none"></span>')).join('');
    const cell = (c, lvl) => {
      if (lvl === 'regional' && c && c.year < 1951) return '<span class="cgc none"></span>';
      if (!c) return '<span class="cgc none"></span>';
      const lv = c.sec ? 'section' : lvl;   // a section result stands in the District row where the section is the district round
      const ok = c.r && !c.dnc && !c.nodata; const href = ok ? OT.bhref(OT.bkey(c.r, lv)) : null;
      const f = ok ? OT.fieldOf(c.r, lv) : null;
      const tag = href ? 'a' : 'span', hr = href ? ` href="${href}"` : '';
      let cls = 'cgp', txt = '', tip = `${c.year}${c.w ? ' · ' + wShort(c.w) : ''} · ${c.sec ? OT.unitLabel('section', c.r.unit) : lvl}`;
      if (c.place) { cls += ' ' + pcls(c.place); txt = ordinal(c.place); tip += ' ' + ordinal(c.place); }
      else if (c.dnc) { cls += ' dnc'; txt = 'DNC'; tip += ': did not compete'; }
      else if (c.nodata) { cls += ' nod'; txt = '–'; tip += ': ' + (c.src || 'no bracket on record'); }
      else if (c.dnp) { cls += ' dnp'; txt = 'DNP'; tip += ': entered, did not place'; }
      else { cls += ' q'; txt = 'Q'; tip += ': ' + (c.src || 'qualified'); }
      if (f) tip += ' · ' + sgTip(f, lv);
      return `<${tag}${hr} class="cgc${c.sec ? ' sec' : ''}" title="${esc(tip)}">${f ? `<span class="sgn">${sgSvg(sgTier(f, lv))}</span>` : '<span class="sgn sg0"></span>'}<span class="${cls}">${txt}</span></${tag}>`;
    };
    const lab = (t, icon) => `<span class="cgl">${icon ? OT.navIcon(icon) : ''}<span>${t}</span></span>`;
    const rows = M.rows.map((row) => lab(row.k === 'district' && row.cells.some((c) => c && c.sec) ? 'District · section' : row.l, LVI[row.k]) + row.cells.map((c) => cell(c, row.k)).join('')).join('');
    return `<div class="cg">${head}${lab('Season rating', null)}${rt}${rows}</div>`;
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
    const dots = rat.map((v, i) => (v ? `<span class="td${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${yp(v).toFixed(1)}px" title="${cols[i].year} · Overtime Rating ${rw(v)}"></span>${big || i === pki ? `<span class="tv${i === pki ? ' pk' : ''}" style="left:${xp(i)}%;top:${(yp(v) - (big ? 20 : 13)).toFixed(1)}px">${rw(v)}</span>` : ''}` : '')).join('');
    const ratingRow = `<span class="tl-r" style="height:${H}px">${ref}<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" vector-effect="non-scaling-stroke"/></svg>${dots}</span>`;
    const head = cols.map((c, i) => `<span class="th">${c ? (big ? `<b>${OT.GRADE_L[i]} '${String(c.year).slice(2)}</b><i>${c.w ? wShort(c.w) + ' lbs' : ''}</i>` : `<b>'${String(c.year).slice(2)}</b> <i>${c.w ? wShort(c.w) : ''}</i>`) : `<b>${OT.GRADE_L[i]}</b><i></i>`}</span>`).join('');
    /* labels sit on a line above the row they name, so the grid uses the full width */
    const lab = (t, icon) => `<span class="tlab">${OT.navIcon(icon)}<span>${t}</span></span>`;
    const rows = M.rows.map((row) => lab(row.l, LVI[row.k]) + row.cells.map((c) => resCell(c, row.k, big, true)).join('')).join('');
    return `<span class="tl${big ? ' big' : ''}">${big ? '<span class="tlab tlr"><span>Rating</span></span>' : ''}${ratingRow}${head}${rows}</span>`;
  }

  /* ---------- best wins and postseason record (lazy) ---------- */
  let BW = null, BWP = null;
  const loadBW = () => BWP || (BWP = fetch('bestwins.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { BW = d; return d; }));
  const recordOf = (name, years) => { if (!BW) return null; const k = nkey(name); const t = [0, 0, 0, 0]; let any = false; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && v.length > 3) { any = true; t[0] += v[3]; t[1] += v[4]; t[2] += v[5]; t[3] += v[6]; } }); return any ? t : null; };
  const shortName = (n) => { const t = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/); return t.length > 1 ? t[0][0] + '. ' + t.slice(1).join(' ') : n; };
  /* wins by type over the postseason: [decisions, major decisions, tech falls, falls] */
  const winTypesOf = (name, years) => { if (!BW) return null; const k = nkey(name); const t = [0, 0, 0, 0]; let any = false; years.forEach((y) => { const v = BW[k + '|' + y]; if (v && v.length > 9) { any = true; t[0] += v[7]; t[1] += v[8]; t[2] += v[9]; t[3] += v[5]; } }); return any ? t : null; };

  /* ---------- wrestler card (the one standard card: Wrestlers list, all-time team, school pages) ----------
     Peak-rating bar down the left (1500 = an average state qualifier, to 2200). Four tiles first: postseason wins by
     type (decisions, majors, tech falls, falls). Then seasons run down: year and grade on the left, District → Regional
     → State across (each result carries its bracket-toughness signal bars inside it, so results centre under their
     level), the weight on the right. The school tag always shows. `rank` is whatever sits left of the name: a list
     rank, a weight or a team. */
  const PK_LO = 1500, PK_HI = 2200;
  const WC_LV = [['district', 'District'], ['regional', 'Regional'], ['state', 'State']];
  /* postseason wins by type as one bar, decisions → falls getting brighter, losses dark red at the end; only the count
     sits in each piece (the colours are explained once, in the key above the list) */
  const WT_K = [['d', 'Decision'], ['m', 'Major decision'], ['t', 'Tech fall'], ['f', 'Fall'], ['l', 'Loss']];
  function winBar(t, rec) {
    if (!t) return `<span class="wtb"${!BW ? ' data-need-bw="1"' : ''}></span>`;
    const v = [t[0], t[1], t[2], t[3], rec ? rec[1] : 0];
    const tip = `${v[0]} decisions · ${v[1]} majors · ${v[2]} tech falls · ${v[3]} falls · ${v[4]} losses`;
    return `<span class="wtb" title="${tip}" aria-label="${tip}">${WT_K.map(([k], j) => (v[j] ? `<span class="${k}" style="flex:${v[j]}">${v[j]}</span>` : '')).join('')}</span>`;
  }
  /* peak rating as signal bars: six steps from 1500 (an average state qualifier) to 2200, coloured on the rating scale */
  function rtgBars(v) {
    const f = Math.max(0, Math.min(1, (v - PK_LO) / (PK_HI - PK_LO))), n = Math.max(1, Math.min(6, Math.ceil(f * 6))), c = colorAt(f);
    return `<svg class="rtb" viewBox="0 0 23 14" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 4}" y="${12 - i * 2}" width="3" height="${2 + i * 2}" rx=".6" fill="${i < n ? c : '#2F3640'}"/>`).join('')}</svg>`;
  }
  /* a result is a disc, every one the same size: gold / silver / bronze with the place, 4th–8th plain with the place,
     an open ring for qualified or advanced without a place, a ring with a dot for did not place, an empty socket for
     not entered; the bracket-toughness bars sit left of it in a slot of their own, so discs centre under their level */
  function disc(c, lvl) {
    if (c && c.place) return `<span class="dk p${Math.min(c.place, 5)}" title="${ordinal(c.place)}">${c.place}</span>`;
    if (c && c.q) return `<span class="dk q" title="${lvl === 'state' ? 'Qualified' : 'Advanced'}, no place"></span>`;
    if (c && (c.dnp || c.dnc)) return `<span class="dk dnp" title="${c.dnc ? 'Did not compete' : 'Did not place'}"></span>`;
    return `<span class="dk none" title="${c && c.nodata ? 'No bracket on record' : 'Not entered'}"></span>`;
  }
  function wcPill(c, lvl) {
    const f = c && c.r ? OT.fieldOf(c.r, c.sec ? 'section' : lvl) : null; const sb = f ? sbar(f, c.sec ? 'section' : lvl, `${c.year} ${c.sec ? 'section' : lvl}`) : '<span class="sgn sg0"></span>';
    return `${sb}${disc(c, lvl)}<span></span>`;
  }
  const LV_ICON = { district: 'district', regional: 'region', state: 'state' };
  const lvIcon = (lvl) => `<span class="lvi" title="${lvl[0].toUpperCase() + lvl.slice(1)}">${OT.navIcon(LV_ICON[lvl])}</span>`;
  /* the key above a list of cards: what the wins colours, the level icons and the discs mean, said once */
  const wlegend = () => `<div class="wlg"><span class="wlg-w">${WT_K.map(([k, l]) => `<span><i class="${k}"></i>${l === 'Major decision' ? 'Major' : l}</span>`).join('')}</span><span class="wlg-l">${WC_LV.map(([k, l]) => `<span>${lvIcon(k)}${l}</span>`).join('')}</span><span class="wlg-d"><span><span class="dk q"></span>Qualified</span><span><span class="dk dnp"></span>No place</span><span>${rtgBars(2000)}Peak rating</span></span></div>`;
  function wrestlerCard(w, rank) {
    if (!w.lower) w.lower = OT.lowerFor(w.apps);
    const cr = OT.careerRating(w.apps, w.lower), sr = cr ? cr.seasons : [];
    const years = Array.from(new Set(w.apps.map((a) => a.year).concat(w.lower.map((r) => r.year)))).sort();
    const y0 = years[0], y1 = years[years.length - 1];
    const M = OT.careerCells(w.apps, w.lower); const at = (k) => M.rows.find((r) => r.k === k).cells;
    const rows = M.cols.map((col, i) => { if (!col) return '';
      const cells = WC_LV.map(([lvl]) => `<span class="wqc">${wcPill(at(lvl)[i], lvl)}</span>`).join('');
      const r = sr.find((x) => x.year === col.year); const wt = col.w || (r && r.w);
      return `<span class="wqy">'${String(col.year).slice(2)}<i>${OT.GRADE_L[i]}</i></span>${cells}<span class="wqw">${wt ? wShort(wt) : ''}</span>`; }).join('');
    const pk = cr ? `<span class="rv2" title="Peak RTG ${rw(cr.peak)}">${rtgBars(cr.peak)}<b>${rw(cr.peak)}</b></span>` : '';
    return `<a class="wq" href="${w.href}">
      <span class="wqh">${rank != null && rank !== '' ? `<i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>` : ''}<span class="nm"><b>${esc(w.name)}</b><small>${OT.stag(w.sch)}<span>${y0 === y1 ? y0 : y0 + '–' + String(y1).slice(2)}</span></small></span>${pk}</span>
      ${winBar(winTypesOf(w.name, years), recordOf(w.name, years))}<span class="wqm"><span></span>${WC_LV.map(([k]) => `<span class="wql">${lvIcon(k)}</span>`).join('')}<span></span>${rows}</span></a>`;
  }
  /* the wrestler page's career: one column per season (year, then grade and weight), a row per level marked by its icon,
     each result a disc with its bracket's toughness bars beside it; tap a result for its bracket */
  function careerDiscs(apps, lower, opts = {}) {
    const M = OT.careerCells(apps, lower, { full: opts.full }), cols = M.cols, n = cols.length;
    const head = cols.map((c, i) => `<span class="cdh${c ? '' : ' off'}"><b>${c ? "'" + String(c.year).slice(2) : '–'}</b><i>${OT.GRADE_L[i]}${c && c.w ? `<em>${wShort(c.w)}</em>` : ''}</i></span>`).join('');
    const cell = (c, lvl) => {
      if (lvl === 'regional' && c && c.year < 1951) return '<span class="cdc"><span class="sgn sg0"></span><span class="dk none" title="No regionals before 1951"></span><span></span></span>';
      const lv = c && c.sec ? 'section' : lvl; const ok = c && c.r && !c.dnc && !c.nodata; const href = ok ? OT.bhref(OT.bkey(c.r, lv)) : null;
      const f = ok ? OT.fieldOf(c.r, lv) : null; const tag = href ? 'a' : 'span';
      return `<${tag}${href ? ` href="${href}"` : ''} class="cdc">${f ? sbar(f, lv, `${c.year} ${lv}`) : '<span class="sgn sg0"></span>'}${disc(c, lvl)}<span></span></${tag}>`;
    };
    const rows = ['state', 'regional', 'district'].map((k) => { const row = M.rows.find((r) => r.k === k); return `<span class="cdl">${lvIcon(k)}</span>` + row.cells.map((c) => cell(c, k)).join(''); }).join('');
    return `<div class="cd" style="--n:${n}"><span></span>${head}${rows}</div>`;
  }

  /* ---------- unit card ----------
     Rating is the graphic: a mini chart of the unit's rating across the window with the 1500 line. Beside it Score and one
     podium per level that counts on this page (State; + Regional on a Region page; + District on District and School). */
  const SORTS = { rating: (a, b) => b.rating - a.rating, talent: (a, b) => b.talent - a.talent || b.rating - a.rating, score: (a, b) => b.score - a.score || b.rating - a.rating, titles: (a, b) => b.ti - a.ti || b.score - a.score, team: (a, b) => (b.tt + (b.dtt || 0)) - (a.tt + (a.dtt || 0)) || b.score - a.score };
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
  /* PIAA team duals championships by unit in the class and window (winner's district from the bracket; region via the
     district's region that season) */
  const dualTitles = (kind) => memo('dt|' + kind, () => {
    const M = new Map(), DS = window.WR_DUALS || [], [wa, wb] = OT.yearsWindow();
    const regOf = new Map(); SS.forEach((r) => { if (r[3] >= 1 && r[4]) regOf.set(r[3] + '|' + r[1], r[4] === 'W' ? 'SW' : r[4]); });
    DS.forEach((d) => { if (!/championship match/i.test(d[2]) || d[0] < wa || d[0] > wb || !clsOk(d[1])) return;
      const k = kind === 'school' ? SIDX.get(canonT(d[3])) : kind === 'district' ? d[4] : regOf.get(d[4] + '|' + d[0]);
      if (k != null) M.set(k, (M.get(k) || 0) + 1); });
    return M;
  });
  /* the seasons a unit won the PIAA team duals (for the team-titles tile's year ticks) */
  const dualYears = (kind) => memo('dy|' + kind, () => {
    const M = new Map(), DS = window.WR_DUALS || [], [wa, wb] = OT.yearsWindow();
    const regOf = new Map(); SS.forEach((r) => { if (r[3] >= 1 && r[4]) regOf.set(r[3] + '|' + r[1], r[4] === 'W' ? 'SW' : r[4]); });
    DS.forEach((d) => { if (!/championship match/i.test(d[2]) || d[0] < wa || d[0] > wb || !clsOk(d[1])) return;
      const k = kind === 'school' ? SIDX.get(canonT(d[3])) : kind === 'district' ? d[4] : regOf.get(d[4] + '|' + d[0]);
      if (k != null) (M.get(k) || M.set(k, []).get(k)).push(d[0]); });
    return M;
  });
  /* unit card: identity, best wrestler and podiums on the left; a 2×2 matrix on the right that fills the card's height:
     Score (with the S/R/D split) · Rating (mini chart on a tint of the strength scale) · Team titles · Individual titles */
  function unitCard(a, rank, sort, pageKind) {
    const lv = LVL3.filter((l, i) => a.w[i]);
    const rt = r10(a.rating);
    const offNote = a.off && a.kind === 'school' && state.cls !== 'ALL' ? `incl. ${a.off} ${state.cls === 'AAA' ? 'AA' : 'AAA'} season${a.off === 1 ? '' : 's'} at 85%` : '';
    const pods = lv.map((l) => podium(placeDist(a.kind, l).get(a.k) || [0, 0, 0, 0, 0, 0, 0, 0], l)).join('');
    const best = a.best ? `<span class="ukbw"><i>Best wrestler</i> <b>${esc(a.best.name)}</b>${a.kind !== 'school' ? ' · ' + esc(a.best.sch) : ''} · <span class="ukbr">RTG ${rw(a.best.r)}</span> · ${a.best.y}</span>` : '';
    // Score tile
    const tot = Math.max(0.01, a.parts[0] + a.parts[1] + a.parts[2]);
    const split = lv.length > 1 ? `<span class="t2sp">${lv.map((l, i) => `<i style="width:${(100 * a.parts[i] / tot).toFixed(1)}%;background:${LV[i][1]}" title="${LV[i][0]} ${sfmt(a.parts[i])}"></i>`).join('')}</span><span class="t2sl">${lv.map((l, i) => `<em>${'SRD'[i]} ${sfmt(a.parts[i])}</em>`).join('')}</span>` : '';
    // Rating tile: tint by where this unit sits on the list's rating range
    const f = rt ? domFrac(a.kind, a.rating) : 0.5;
    const tint = rt ? colorAt(f) : '#2F3640';
    // Team titles: PIAA team championships + PIAA team duals
    const dt = dualTitles(a.kind).get(a.k) || 0;
    const team = a.tt + dt;
    // Individual titles: state, plus regional / district on pages that count them
    const ind = [[a.ti, 'State']].concat(a.w[1] ? [[a.rt, 'Reg']] : []).concat(a.w[2] ? [[a.dt, 'Dist']] : []);
    const hl = (k) => (sort === k ? ' hl' : '');
    return `<a class="uk2" href="${a.href}"${a.color ? ` style="--p1:${a.color}"` : ''}>
      <span class="ukL"><span class="ukh"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i><span class="nm"><b>${esc(a.name)}</b>${a.sub || offNote ? `<small>${[a.sub ? esc(a.sub) : '', offNote].filter(Boolean).join(' · ')}</small>` : ''}</span></span>${best}<span class="ukp">${pods}</span></span>
      <span class="ukM">
        <span class="t2 t2s${hl('score')}"><i class="t2k">Score</i><b>${sfmt(a.score)}</b>${split}</span>
        <span class="t2 t2r${hl('rating')}" style="--tint:${tint}"><i class="t2k">Rating</i><b>${rt || '–'}</b>${miniChart(a.series, '#EEEAE1', false)}</span>
        <span class="t2 t2t"><i class="t2k">Team titles</i><b>${team}</b><span class="t2sl">${a.tt ? `<em>PIAA ${a.tt}</em>` : ''}${dt ? `<em>Duals ${dt}</em>` : ''}${!team ? '<em>—</em>' : ''}</span></span>
        <span class="t2 t2i${hl('titles')}"><i class="t2k">Individual titles</i><b>${a.ti}</b><span class="t2sl">${ind.slice(1).map(([n, l]) => `<em>${l} ${n}</em>`).join('')}</span></span>
      </span></a>`;
  }
  /* one sort control (wrestler lists still use it) */
  const sortSelect = (key, sorts, cur) => `<label class="ssel"><span>Sort</span><select data-sortsel="${key}" aria-label="Sort by">${sorts.map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  /* ---------- standings rows ----------
     A ranked unit is one row: rank, colour edge, name, then one tile per value. Every tile has the same build: the number
     on top, a small graphic of how it was reached across the window underneath, and a tint that says how it compares.
       Titles  individual state titles; gold ticks mark the seasons with a title; gold deepens with the count.
       RTG     the unit rating; line = season ratings; tint on the ice-to-fire strength scale.
       Score   weighted placement points; bars = points per season; tint = where it sits in this list, ice to fire.
       Team    PIAA team titles + team duals titles; ticks mark the seasons (wider screens).
     Column headers sort. Tap a row to open its detail in place. */
  const chipSpark = (series) => { const pts = series.filter((p) => p[1]); if (pts.length < 2) return '<svg class="rcs" viewBox="0 0 60 14" aria-hidden="true"></svg>';
    const y0 = pts[0][0], y1 = pts[pts.length - 1][0], v = pts.map((p) => p[1]), lo = Math.min(...v), hi = Math.max(...v);
    const X = (y) => 1 + 58 * (y - y0) / Math.max(1, y1 - y0), Y = (x) => 13 - 12 * (x - lo) / Math.max(1, hi - lo);
    return `<svg class="rcs" viewBox="0 0 60 14" preserveAspectRatio="none" aria-hidden="true"><path d="${pts.map(([y, x], i) => (i ? 'L' : 'M') + X(y).toFixed(1) + ' ' + Y(x).toFixed(1)).join(' ')}" vector-effect="non-scaling-stroke"/></svg>`; };
  /* bars per season across the window (Score) */
  const chipBars = (vals, y0, y1) => { const n = Math.max(1, y1 - y0 + 1), mx = Math.max(1e-9, ...vals.map((v) => v[1])), bw = 60 / n;
    return `<svg class="rcs rcb" viewBox="0 0 60 14" preserveAspectRatio="none" aria-hidden="true">${vals.filter((v) => v[1] > 0).map(([y, v]) => `<rect x="${((y - y0) * bw).toFixed(2)}" y="${(14 - 13 * v / mx).toFixed(2)}" width="${Math.max(0.6, bw * 0.72).toFixed(2)}" height="${(13 * v / mx).toFixed(2)}"/>`).join('')}</svg>`; };
  /* ticks for the seasons something happened (Titles, Team) */
  const chipTicks = (years, y0, y1) => { const n = Math.max(1, y1 - y0); return `<svg class="rcs rct" viewBox="0 0 60 14" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="M0 13.5 H60" vector-effect="non-scaling-stroke"/>${years.map((y) => `<path d="M${(1 + 58 * (y - y0) / n).toFixed(2)} 2 V13" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`; };
  /* titles per decade (per season when the window is short), as bars on the same scale for every row */
  const chipCount = (years, y0, y1, mx) => { const span = y1 - y0 + 1, step = span > 15 ? 10 : 1, b0 = step === 10 ? Math.floor(y0 / 10) * 10 : y0, nb = Math.floor((y1 - b0) / step) + 1, cnt = new Array(nb).fill(0);
    years.forEach((y) => { const i = Math.floor((y - b0) / step); if (i >= 0 && i < nb) cnt[i]++; }); const m = Math.max(1, mx || Math.max(...cnt)), bw = 60 / nb;
    return `<svg class="rcs rcb" viewBox="0 0 60 14" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="M0 13.5 H60" vector-effect="non-scaling-stroke"/>${cnt.map((c, i) => (c ? `<rect x="${(i * bw + bw * 0.14).toFixed(2)}" y="${(14 - 13 * Math.min(1, c / m)).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${(13 * Math.min(1, c / m)).toFixed(2)}"/>` : '')).join('')}</svg>`; };
  function distRows(a) {
    const lv = LVL3.filter((l, i) => a.w[i]);
    const rows = lv.map((l) => { const c = placeDist(a.kind, l).get(a.k) || [0, 0, 0, 0, 0, 0, 0, 0]; const mx = Math.max(1, ...c), tot = c.reduce((t, x) => t + x, 0);
      return `<div class="sdr"><span class="sdl">${OT.navIcon(LVI[l])}<b>${LV[LVL3.indexOf(l)][0]}</b><i>${tot}</i></span><span class="sdb">${c.map((n, i) => `${((h) => `<span class="sdc" title="${ordinal(i + 1)}: ${n}" style="--h:${h}%"><em>${n || ''}</em><i style="height:${h}%;--c:${MEDC[i]}"></i></span>`)(n ? Math.max(8, Math.round(78 * n / mx)) : 0)}`).join('')}</span></div>`; }).join('');
    return `<div class="sdh"><span></span><span class="sdb">${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<i>${ordinal(p)}</i>`).join('')}</span></div>${rows}`;
  }
  /* Talent: expected state medalists (each wrestler counts his chance of medalling at his season rating); talentAt is
     set only for the old 1650+ count (TALENT_MODE=cut in tools/build_units.js) */
  const talWhat = () => (UD.talentAt ? `wrestlers rated ${UD.talentAt}+` : 'expected state medalists');
  const talTxt = (v, kind) => (!v ? '–' : v.toFixed(2));
  function unitCard(a, rank, sort, pageKind, ctx) {
    const rt = r10(a.rating), tint = rt ? colorAt(domFrac(a.kind, a.rating)) : '#2F3640';
    const dt = dualTitles(a.kind).get(a.k) || 0, team = a.tt + dt;
    const [y0, y1] = ctx.span;
    const tYears = a.ys.filter((y) => y.ti > 0).map((y) => y.y);
    const teamYears = a.ys.filter((y) => y.tt > 0).map((y) => y.y).concat(dualYears(a.kind).get(a.k) || []);
    const gold = (n, mx) => (n ? `--g:${(0.18 + 0.5 * Math.min(1, n / Math.max(1, mx))).toFixed(2)}` : '');
    const off = a.off && a.kind === 'school' && state.cls !== 'ALL' ? `<div class="sxn">Includes ${a.off} ${state.cls === 'AAA' ? 'AA' : 'AAA'} season${a.off === 1 ? '' : 's'} at 85%.</div>` : '';
    const best = a.best ? `<a class="sxw" href="${OT.wrestlerHref({ name: a.best.name, sch: a.best.sch, year: a.best.y })}"><i>Top wrestler</i><b>${esc(a.best.name)}</b>${a.kind !== 'school' ? `<small>${esc(a.best.sch)}</small>` : ''}<em>${rw(a.best.r)} · ${a.best.y}</em></a>` : '';
    const tl = team ? `<div class="sxt"><i>Team titles</i>${[a.tt ? `PIAA <b>${a.tt}</b>` : '', dt ? `Duals <b>${dt}</b>` : ''].filter(Boolean).join(' · ')}</div>` : '';
    const ind = [a.w[1] ? `Regional <b>${a.rt}</b>` : '', a.w[2] ? `District <b>${a.dt}</b>` : ''].filter(Boolean);
    const il = ind.length ? `<div class="sxt"><i>Other titles</i>${ind.join(' · ')}</div>` : '';
    const hl = (k) => (sort === k ? ' on' : '');
    const tile = (cls, k, val, gfx, style, title) => `<span class="vt ${cls}${hl(k)}"${style ? ` style="${style}"` : ''}${title ? ` title="${esc(title)}"` : ''}><b>${val}</b>${gfx}</span>`;
    return `<div class="sx"${a.color ? ` style="--p1:${a.color}"` : ''}><button class="sxr" data-sx aria-expanded="false"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i><span class="nm"><b>${esc(a.name)}</b></span>`
      + tile('vtt' + (a.ti ? '' : ' z'), 'titles', a.ti || '–', chipCount(tYears, y0, y1), gold(a.ti, ctx.maxTi), `${a.ti} state title${a.ti === 1 ? '' : 's'}${tYears.length ? ' · ' + tYears.join(', ') : ''}`)
      + tile('vtr', 'rating', rt || '–', chipSpark(a.series), `--tint:${tint}`, `Strength ${rt} · average of ${a.nS} season${a.nS === 1 ? '' : 's'}`)
      + tile('vtl' + (a.talent ? '' : ' z'), 'talent', talTxt(a.talent, a.kind), chipSpark(a.tseries), '', `Talent ${talTxt(a.talent, a.kind)} · ${talWhat()}${a.kind === 'school' ? '' : ' per school'} per season, average of ${a.tseries.length} season${a.tseries.length === 1 ? '' : 's'}`)
      + tile('vts', 'score', sfmt(a.score), chipBars(a.ys.map((y) => [y.y, y.sc]), y0, y1), '--tint:#2F3640', `Score ${sfmt(a.score)} · ${a.kind === 'school' ? 'placement points per season' : 'placement points per school per season'}`)
      + tile('vtm' + (team ? '' : ' z'), 'team', team || '–', chipCount(teamYears, y0, y1), gold(team, ctx.maxTeam), team ? `${team} team title${team === 1 ? '' : 's'} · ${teamYears.sort((p, q) => p - q).join(', ')}` : 'no team titles')
      + `<span class="vtn" title="seasons with Strength in this window">${a.nS}</span></button>
      <div class="sxd" hidden>${a.sub ? `<div class="sxsub">${esc(a.sub)}</div>` : ''}${distRows(a)}<div class="sxf">${best}${tl}${il}</div>${off}<a class="sxo" href="${a.href}">Open ${esc(a.name)} →</a></div></div>`;
  }
  function unitRankings(kind, parent, pageKind, opts = {}) {
    const sorts = [['rating', 'Strength'], ['talent', 'Talent'], ['score', 'Score'], ['titles', 'Titles'], ['team', 'Team']];
    let sort = sorts.some(([k]) => k === state.usort) ? state.usort : 'rating';
    if (sort === 'rating' && OT.yearsWindow()[1] < RATED_FROM) sort = 'score';
    const DT = dualTitles(kind); const L = aggregate(kind, parent, pageKind).filter((a) => kind !== 'school' || (a.name && String(a.name).trim())).map((a) => { a.dtt = DT.get(a.k) || 0; return a; }).sort(SORTS[sort]);
    L.forEach((a) => { a.kind = kind; });
    if (!L.length) return OT.empty('No ' + (kind === 'school' ? 'schools' : kind + 's') + ' with enough seasons in this window.');
    const lim = state.uall ? L.length : opts.limit || 20;
    const hb = (k, l) => `<button class="ht${sort === k ? ' on' : ''}" data-usort="${k}" aria-pressed="${sort === k}">${l}</button>`;
    const head = `<div class="sxh"><span class="rk"></span><span class="nm"></span><span class="vth">${hb('titles', 'Titles')}</span><span class="vth">${hb('rating', 'Strength')}</span><span class="vth">${hb('talent', 'Talent')}</span><span class="vth">${hb('score', 'Score')}</span><span class="vth vtm">${hb('team', 'Team')}</span><span class="vth vtn" title="seasons with Strength in this window">Seasons</span></div>`;
    const sc = L.map((a) => a.score).sort((p, q) => p - q);
    const yrs = L.flatMap((a) => a.ys.map((y) => y.y)); const [wa, wb] = OT.yearsWindow();
    const ctx = { span: [Math.max(wa, Math.min(...yrs)), Math.min(wb, Math.max(...yrs))], maxTi: Math.max(1, ...L.map((a) => a.ti)), maxTeam: Math.max(1, ...L.map((a) => a.tt + (dualTitles(kind).get(a.k) || 0))),
      scorePct: (v) => { let lo = 0, hi = sc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sc[m] < v) lo = m + 1; else hi = m; } return sc.length > 1 ? lo / (sc.length - 1) : 0.5; } };
    const more = L.length > (opts.limit || 20) ? `<button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Show top ' + (opts.limit || 20) : 'Show all ' + L.length}</button>` : '';
    return { sortSeg: '', html: `<div class="sxl">${head}${L.slice(0, lim).map((a, i) => unitCard(a, i + 1, sort, pageKind, ctx)).join('')}</div>${more ? `<div class="bmore">${more}</div>` : ''}` };
  }

  /* ---------- performance chart ----------
     One grammar on every unit page. On top, the rating chart, the page's primary graphic, with comparison lines picked by
     chips (school → district / region / state averages and up to three other schools; district → region and state
     averages and other districts; region → state average, other regions and its districts; state → the five regions).
     Beneath, one results row per level that counts on this page (State; + Regional on Region pages; + District on
     District and School pages), bars = placement points, gold stars = individual titles; a Team row on School and District
     pages. Tap a season for its sheet. */
  const seriesOf = (kind, id) => { if (kind === 'state') return unitAgg(OT.U.state()).series; const k = kind === 'school' ? SIDX.get(id) : id; const a = aggregateCore(kind, null, kind).find((x) => x.k === k); return a ? a.series : []; };
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
  /* ---------- rating domains: derived, not hand-picked ----------
     For each unit kind and class, the 5th–95th percentile of that kind's season ratings from 1974 on. Maps, heat cells
     and card tints all read colour from these, so a colour means the same strength everywhere. */
  const pctl = (A, q) => { if (!A.length) return null; const i = Math.min(A.length - 1, Math.max(0, Math.round(q * (A.length - 1)))); return A[i]; };
  const DOMS = (() => {
    const pools = {}; const add = (kind, c, v) => { if (!v) return; (pools[kind + '|' + c] = pools[kind + '|' + c] || []).push(v); (pools[kind + '|ALL'] = pools[kind + '|ALL'] || []).push(v); };
    SS.forEach((r) => { if (r[1] >= RATED_FROM && r[5]) add('school', r[2], r[5]); });
    UD.ds.forEach(([u, y, c, r]) => { if (y >= RATED_FROM && r) add('district', c, r); });
    UD.rs.forEach(([u, y, c, r]) => { if (y >= RATED_FROM && r) add('region', c, r); });
    const out = {}; Object.entries(pools).forEach(([k, A]) => { A.sort((x, y) => x - y); out[k] = k.startsWith('school|') ? [pctl(A, 0.10), pctl(A, 0.995)] : [pctl(A, 0.05), pctl(A, 0.95)]; /* schools: the pool is dominated by thin programs, so stretch the top end so strong programs stay distinguishable */ });
    return out;
  })();
  /* wrestlers: 5th–95th percentile of all entrants' season ratings since 1974, from the wstats histograms */
  (() => { const W = window.WR_WSTATS; if (!W) return; const h = new Map(); let n = 0;
    Object.entries(W.g).forEach(([k, g]) => { if (+k.slice(0, 4) < RATED_FROM) return; g[3].split(',').forEach((x) => { const i = x.indexOf(':'), b = +x.slice(0, i), c = +x.slice(i + 1); h.set(b, (h.get(b) || 0) + c); n += c; }); });
    const B = Array.from(h.entries()).sort((a, b) => a[0] - b[0]); const q = (t) => { let acc = 0; for (const [b, c] of B) { acc += c; if (acc >= t * n) return (b + 0.5) * W.bin; } return B.length ? B[B.length - 1][0] * W.bin : null; };
    if (n) DOMS['wrestler|ALL'] = [q(0.05), q(0.95)]; })();
  const ratingDom = (kind) => DOMS[kind + '|' + (state.cls === 'ALL' ? 'ALL' : state.cls)] || DOMS[kind + '|ALL'] || [1300, 1700];
  const domFrac = (kind, v) => { const [lo, hi] = ratingDom(kind); return Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo))); };
  const ratingColor = (kind, v) => (v ? colorAt(domFrac(kind, v)) : null);
  /* map / grid mode on the State page: regions or districts */
  const mapMode = () => (state.mapmode === 'districts' ? 'districts' : 'regions');
  /* ---------- season heat grid ----------
     Rows × seasons, each cell coloured by that unit's rating that season on the shared strength scale. The map shows
     space, this shows time, in the same colours. State: the five regions (or twelve districts) under a State avg row;
     Region: its member districts (as of each season) under the region row; District: its schools (top 15, show all)
     under the district row; School: one rating row with its results rows beneath. Tap a column for that season. */
  function heatRows(u) {
    const own = (kind, label, pts) => ({ kind, label, pts: new Map(pts.filter((p) => p[1] && ratedYear(p[0]))), top: true });
    if (u.kind === 'state') {
      const st = own('region', 'State avg', unitAgg(u).series);
      const R = mapMode() === 'districts'
        ? Array.from({ length: 12 }, (_, i) => i + 1).map((k) => ({ kind: 'district', label: 'D' + k + ' ' + (DISTRICTS[k] || ''), short: 'D' + k, href: '#district/' + k, pts: new Map(seriesOf('district', k).filter((p) => p[1] && ratedYear(p[0]))) }))
        : FIVE.map((g) => ({ kind: 'region', label: REGIONS[g], href: '#region/' + g, pts: new Map(seriesOf('region', g).filter((p) => p[1] && ratedYear(p[0]))) }));
      return [st].concat(R);
    }
    const a = unitAgg(u) || { series: [] };
    if (u.kind === 'region') {
      const top = own('region', REGIONS[u.id], a.series);
      const R = OT.regionMembers(u.id).map((m) => { const ys = new Set(m.years); return { kind: 'district', label: 'D' + m.d + ' ' + (DISTRICTS[m.d] || ''), short: 'D' + m.d, href: '#district/' + m.d, pts: new Map(seriesOf('district', m.d).filter((p) => p[1] && ratedYear(p[0]) && ys.has(p[0]))) }; }).filter((r) => r.pts.size);
      return [top].concat(R);
    }
    if (u.kind === 'district') {
      const top = own('district', 'District ' + u.id, a.series);
      const L = aggregateCore('school', { kind: 'district', id: +u.id }, 'district').filter((x) => x.series.length).sort((p, q) => q.rating - p.rating);
      const R = (state.hall ? L : L.slice(0, 15)).map((x) => ({ kind: 'school', label: S[x.k], href: x.href, pts: new Map(x.series.filter((p) => ratedYear(p[0]))) }));
      return { rows: [top].concat(R), more: L.length > 15 ? L.length : 0 };
    }
    return [own('school', 'Strength', a.series)];
  }
  /* School season grid. Top: the RATING heat row (one cell per season on the cold → hot scale). Beneath it, aligned
     cell rows on the same season columns, no floating marks:
       Individual — State / Regional / District: the number of the school's medalists that season at that level, slate
       cells lighter with more medalists; a gold top edge and a small gold ★n when the school had individual titles.
       Team — District team / Regional team / PIAA team / Duals: the team's finish as a place number in medal colours.
     Select on the grid: tap a column for that season (its lineup opens below); drag across columns (press and hold on a
     phone) for a range. A pill above the grid shows the selection with a clear button. */
  const MEDC2 = { 1: ['#D9A441', '#0B0D10'], 2: ['#B8BFC6', '#0B0D10'], 3: ['#B5733A', '#0B0D10'], 4: ['#8E5A3C', '#EEEAE1'] };
  const medFill = (p) => MEDC2[p] || ['#5F6B78', '#EEEAE1'];
  const DUP = { C: 1, F: 2, SF: 3, QF: 5 };
  const mixHex = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return 'rgb(' + pa.map((x, i) => Math.round(x + (pb[i] - x) * t)).join(',') + ')'; };
  const selOfPerf = (u) => { const p = state.pseason; return p && p.k === u.kind + ':' + u.id ? p : null; };
  function schoolSeasonRows(u) {
    return memo('ssr|' + u.id, () => {
      const by = new Map(); const g = (y) => by.get(y) || by.set(y, { S: 0, R: 0, D: 0, tS: 0, tR: 0, tD: 0 }).get(y);
      ssIn({ kind: 'school', id: u.id }).forEach((r) => { const o = g(r[1]); o.S += r[9] + r[10] + r[11]; o.tS += r[9]; });
      OT.LOWER.forEach((r) => { if (r.sch !== u.id || !OT.inWindow(r.year) || !(state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single') || !(r.place > 0 && r.place <= 8)) return; const o = g(r.year); if (r.lvl === 'district') { o.D++; if (r.place === 1) o.tD++; } else if (r.lvl === 'regional') { o.R++; if (r.place === 1) o.tR++; } });
      return by;
    });
  }
  function perfChart(u) {
    const HR = heatRows(u); const HR0 = Array.isArray(HR) ? HR : HR.rows; const rating = HR0[0];
    const ind = schoolSeasonRows(u), team = teamResults(u);
    const ys = Array.from(rating.pts.keys()).concat(Array.from(ind.keys()), Array.from(team.keys())).filter((y) => OT.inWindow(y));
    if (!ys.length) return OT.empty('No seasons in this window.');
    const y0 = Math.min(...ys), y1 = Math.max(...ys), n = y1 - y0 + 1;
    const phone = (window.innerWidth || 390) < 720;
    const labW = 0; // labels sit on top of their rows, not in a column beside them
    const avail = Math.min(1180, Math.max(240, (window.innerWidth || 390) - (phone ? 40 : 140)));
    const cw = phone ? 18 : Math.max(18, Math.min(44, avail / n)), W = cw * n, X = (y) => cw * (y - y0);
    const scroll = W > avail + 2;
    const RH = phone ? 22 : 26, CH = phone ? 22 : 24, G = 1, GH = 14, LH = phone ? 14 : 15; // rating row, cell rows, gap, group header, label line
    const sel = selOfPerf(u); const sa = sel ? sel.a : null, sb = sel ? sel.b : null;
    let g = '', labs = '', t = 0;
    /* each label is a line ABOVE its row; the label layer sits outside the scroller so it stays pinned at the left */
    const lab = (txt, cls = '') => { labs += `<span class="pl-l gl2${cls}" style="top:${t}px;height:${LH}px">${txt}</span>`; t += LH; };
    /* rating row, exactly as before: cold → hot cells */
    lab('Strength', ' top');
    for (let y = y0; y <= y1; y++) {
      const v = rating.pts.get(y);
      if (!v) { g += `<rect class="he" x="${(X(y) + 1).toFixed(1)}" y="${t}" width="${(cw - 2).toFixed(1)}" height="${RH}" rx="2"/>`; continue; }
      const tip = `${y} · Strength ${r10(v)}`;
      g += `<rect class="hcell" data-py="${y}" data-tip="${esc(tip)}" x="${(X(y) + 1).toFixed(1)}" y="${t}" width="${(cw - 2).toFixed(1)}" height="${RH}" rx="2" fill="${ratingColor('school', v)}"><title>${esc(tip)}</title></rect>`;
    }
    t += RH;
    const group = (name) => { t += 8; g += `<line x1="0" x2="${W}" y1="${t + 0.5}" y2="${t + 0.5}" class="gdv"/>`; labs += `<span class="pl-g" style="top:${t + 3}px">${name}</span>`; t += GH; };
    /* individual rows */
    group('Individual');
    const IR = [['State', 'S', 'tS'], ['Regional', 'R', 'tR'], ['District', 'D', 'tD']];
    const mx = Math.max(1, ...Array.from(ind.values()).map((o) => Math.max(o.S, o.R, o.D)));
    IR.forEach(([name, k, tk], i) => {
      lab(name);
      for (let y = y0; y <= y1; y++) {
        const o = ind.get(y), v = o ? o[k] : 0, ti = o ? o[tk] : 0, x = X(y) + 0.5, w = cw - 1;
        if (!v) { g += `<rect class="ce" data-py="${y}" x="${x.toFixed(1)}" y="${t}" width="${w.toFixed(1)}" height="${CH}"/>`; continue; }
        const f = mixHex('#1D222A', '#6B7684', Math.min(1, 0.25 + 0.75 * v / mx));
        const tip = `${y} · ${v} ${name.toLowerCase()} medalist${v > 1 ? 's' : ''}${ti ? ` · ${ti} title${ti > 1 ? 's' : ''}` : ''}`;
        g += `<g class="cc" data-py="${y}" data-tip="${esc(tip)}"><rect x="${x.toFixed(1)}" y="${t}" width="${w.toFixed(1)}" height="${CH}" fill="${f}"/>`;
        if (ti) g += `<rect x="${x.toFixed(1)}" y="${t}" width="${w.toFixed(1)}" height="2.5" fill="#D9A441"/>`;
        g += `<text x="${(x + w / 2).toFixed(1)}" y="${t + CH / 2 + 4 + (ti ? 1 : 0)}" text-anchor="middle" class="cn">${v}</text>`;
        if (ti && cw >= 22) g += `<text x="${(x + w - 2).toFixed(1)}" y="${t + 9}" text-anchor="end" class="ct">★${ti > 1 ? ti : ''}</text>`;
        g += `<title>${esc(tip)}</title></g>`;
      }
      t += CH + G;
    });
    /* team rows */
    group('Team');
    const TR = [['District team', (o) => o.d], ['Regional team', (o) => o.r], ['PIAA team', (o) => o.s], ['Duals', (o) => (o.u ? DUP[o.u] : null)]];
    const DUW = { 1: 'champion', 2: 'finalist', 3: 'semifinal', 5: 'quarterfinal' };
    TR.forEach(([name, f], i) => {
      lab(name);
      for (let y = y0; y <= y1; y++) {
        const o = team.get(y), p = o ? f(o) : null, x = X(y) + 0.5, w = cw - 1;
        if (!p || p > 8) { g += `<rect class="ce" data-py="${y}" x="${x.toFixed(1)}" y="${t}" width="${w.toFixed(1)}" height="${CH}"/>`; continue; }
        const [bg, fg] = medFill(p);
        const tip = `${y} · ${name} ${name === 'Duals' ? DUW[p] : ordinal(p)}`;
        g += `<g class="cc" data-py="${y}" data-tip="${esc(tip)}"><rect x="${x.toFixed(1)}" y="${t}" width="${w.toFixed(1)}" height="${CH}" fill="${bg}"/><text x="${(x + w / 2).toFixed(1)}" y="${t + CH / 2 + 4}" text-anchor="middle" class="cn${name === 'Duals' && p === 5 ? ' cq' : ''}" style="fill:${fg}">${name === 'Duals' && p === 5 ? 'QF' : p}</text><title>${esc(tip)}</title></g>`;
      }
      t += CH + G;
    });
    const bottom = t;
    /* year labels */
    const step = n <= 8 ? 1 : 5;
    for (let y = y0; y <= y1; y++) if (y % step === 0 || n <= 8) g += `<text x="${(X(y) + cw / 2).toFixed(1)}" y="${bottom + 13}" text-anchor="middle" class="ax">${cw < 30 ? "'" + String(y).slice(2) : y}</text>`;
    /* selection: a gold frame over the selected column(s) */
    if (sel) g += `<rect class="xcol" x="${(X(sa) + 0.5).toFixed(1)}" y="-1.5" width="${(cw * (sb - sa + 1) - 1).toFixed(1)}" height="${bottom + 2}" rx="3"/>`;
    /* hit columns for tap / drag selection (over the whole height) */
    let hits = ''; for (let y = y0; y <= y1; y++) hits += `<rect class="hitc" data-py="${y}" data-tip="${y}" x="${X(y).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${bottom}"/>`;
    g = hits + g;
    const H = bottom + 18;
    const pill = sel ? `<div class="psel"><span class="pselp"><b>${sa === sb ? sa : sa + '–' + sb}</b>${sa === sb ? '' : ' · ' + (sb - sa + 1) + ' seasons'}<button class="pselx" data-pclear aria-label="Clear selection">clear</button></span></div>` : `<div class="psel"><span class="pselh">${phone ? 'Tap a season · press and hold, then drag for a range' : 'Click a season · drag across for a range'}</span></div>`;
    const [dlo, dhi] = ratingDom('school');
    const legend = `<span class="hlg"><span class="mlgl">Strength</span><b>${r10(dlo)}</b><i class="mlgbar"></i><b>${r10(dhi)}</b></span><span><i class="lgc" style="background:#4A5360"></i>medalists</span><span><i class="lgc lgt"></i>individual title</span><span><i class="lgc" style="background:#D9A441"></i><i class="lgc" style="background:#B8BFC6"></i><i class="lgc" style="background:#B5733A"></i>team finish</span>`;
    let sheet = '';
    if (sel && sa === sb) sheet = seasonSheet(u, sa, null, team.get(sa));
    else if (sel) sheet = rangeSummary(u, sa, sb, rating, ind, team);
    return `<div class="perf heat sgrid" data-perf="${esc(u.kind + ':' + u.id)}" data-y0="${y0}" data-cw="${cw}">${pill}<div class="pwrap"><div class="plabs" style="height:${H}px;flex-basis:${labW}px">${labs}</div><div class="pscr${scroll ? ' scroll' : ''}" data-y0="${y0}" data-y1="${y1}"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Season grid">${g}</svg></div></div><div class="plg">${legend}<span class="ptip" aria-live="polite"></span></div>${sheet}</div>`;
  }
  /* a range of seasons on a school: averages and totals across it */
  function rangeSummary(u, a, b, rating, ind, team) {
    const rv = []; let S = 0, R = 0, D = 0, tS = 0, tR = 0, tD = 0; const best = { d: 0, r: 0, s: 0, u: 0 };
    for (let y = a; y <= b; y++) { const v = rating.pts.get(y); if (v) rv.push(v); const o = ind.get(y); if (o) { S += o.S; R += o.R; D += o.D; tS += o.tS; tR += o.tR; tD += o.tD; }
      const tm = team.get(y); if (tm) { if (tm.d === 1) best.d++; if (tm.r === 1) best.r++; if (tm.s && tm.s <= 3) best.s++; if (tm.u === 'C') best.u++; } }
    const avg = rv.length ? rv.reduce((x, y) => x + y, 0) / rv.length : 0;
    const cell = (l, v, sub) => `<span class="rsc"><i>${l}</i><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</span>`;
    return `<div class="ss"><div class="ssh"><b>${a}–${b}</b><span>${b - a + 1} seasons</span><button class="ssx" data-pclear aria-label="Close">✕</button></div><div class="rsg">${cell('Avg Strength', avg ? `<span class="mls" style="--tint:${ratingColor('school', avg)}">${r10(avg)}</span>` : '–', rv.length ? `peak ${r10(Math.max(...rv))}` : '')}${cell('State medals', S, tS ? `${tS} title${tS > 1 ? 's' : ''}` : '')}${cell('Regional medals', R, tR ? `${tR} title${tR > 1 ? 's' : ''}` : '')}${cell('District medals', D, tD ? `${tD} title${tD > 1 ? 's' : ''}` : '')}${cell('Team titles', best.d + best.r, `district ${best.d} · regional ${best.r}`)}${cell('PIAA', best.s, `top-3 team · duals titles ${best.u}`)}</div><div class="note1">Tap one season for its lineup.</div></div>`;
  }
  /* one season under the chart: a school's lineup (each result with its strength bar), or a unit's state placers */
  function seasonSheet(u, y, row, tm, vals) {
    const DU = { C: 'champion', F: 'finalist', SF: 'semifinal', QF: 'quarterfinal', R: 'entered' };
    const tr = tm ? [tm.d ? `District team <b>${ordinal(tm.d)}</b>` : '', tm.r ? `Regional team <b>${ordinal(tm.r)}</b>` : '', tm.s ? `PIAA team <b>${ordinal(tm.s)}</b>${u.kind === 'district' && tm.sn ? ' ' + esc(tm.sn) : ''}` : '', tm.u ? `Team duals <b>${DU[tm.u]}</b>${u.kind === 'district' && tm.un ? ' ' + esc(tm.un) : ''}` : ''].filter(Boolean) : [];
    const vline = (vals || []).map(([o, v]) => `<span><i class="sw" style="background:${o.col || o.color}"></i>${esc(o.label)} <b>${r10(v)}</b></span>`).join('');
    const lvKeys = (PAGE_LV[u.kind === 'school' ? 'district' : u.kind] || []).map((l) => l[0]);
    const pts = row && u.kind !== 'state' ? lvKeys.map((l) => `<span>${l} <b>${row[{ State: 'sp', Regional: 'rp', District: 'dp' }[l]]}</b> pts</span>`).join('') : '';
    const ssr = u.kind === 'school' ? SS.find((r) => r[0] === SIDX.get(u.id) && r[1] === y && clsOk(r[2])) : null;
    const lineTxt = ssr ? `<span>${ssr[5] ? `Strength <b>${r10(ssr[5])}</b> · ` : ''}${ssr[16] ? `${ssr[20]} of ${ssr[21]} weights entered · Talent <b>${ssr[19]}</b>` : 'district field not on file'}</span>` : '';
    const head = `<div class="ssh"><b>${y}</b>${lineTxt}${pts}<button class="ssx" data-pclear aria-label="Close">✕</button></div>${vline ? `<div class="ssv">${vline}</div>` : ''}${tr.length ? `<div class="sstm">${tr.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}`;
    const LV2 = { D: 'district', R: 'regional', S: 'state' };
    if (u.kind === 'school') {
      const st = OT.APP.filter((r) => r.sch === u.id && r.year === y && (state.cls === 'ALL' || r.cls === state.cls || r.cls === 'single'));
      const low = OT.LOWER.filter((r) => r.sch === u.id && r.year === y);
      const by = new Map(); const add = (r, L) => { const k = nkey(r.name); const x = by.get(k) || { name: r.name, w: r.w, wn: r.wn || +r.w || 999, r }; x[L] = r.place || 0; x['r' + L] = r; if (L === 'S') { x.w = r.w; x.wn = r.wn; x.r = r; } by.set(k, x); };
      low.forEach((r) => add(r, r.lvl === 'district' ? 'D' : 'R')); st.forEach((r) => add(r, 'S'));
      const L = Array.from(by.values()).sort((a, b) => (a.wn || 999) - (b.wn || 999));
      const cell = (x, L2) => { const p = x[L2], rr = x['r' + L2], lvl = LV2[L2]; if (p == null) return '<span class="tc"><span class="tp tp0"></span><span class="smtr sm0"><i></i></span></span>'; const f = OT.fieldOf(rr, lvl);
        return `<span class="tc">${f ? sbar(f, lvl, `${y} ${lvl} ${wShort(x.w)}`) : '<span class="sgn sg0"></span>'}${p ? `<b class="tp ${pcls(p)}" title="${lvl} ${ordinal(p)}">${p}</b>` : `<b class="tp q" title="${lvl} qualifier">Q</b>`}</span>`; };
      const rows = L.map((x) => { const rt = OT.ratingOf(x.r, x.S != null ? 'state' : x.r.lvl); return `<a class="sr" href="${OT.wrestlerHref(x.r)}"><span class="w">${wShort(x.w)}</span><span class="n">${esc(x.name)}</span><span class="f">${cell(x, 'D')}${cell(x, 'R')}${cell(x, 'S')}</span><span class="r">${rt ? rw(rt) : ''}</span></a>`; }).join('');
      const mx = placeMatrix(y, (r) => r.sch === u.id, false);
      return `<div class="ss">${head}${mx.indexOf('pmx') >= 0 ? mx : ''}${rows ? `<div class="srh"><span></span><span></span><span class="f"><i>D</i><i>R</i><i>S</i></span><span class="r">RTG</span></div>${rows}` : '<div class="note1">No district, regional or state results on file for this season.</div>'}</div>`;
    }
    const inU = u.kind === 'state' ? () => true : u.kind === 'district' ? (r) => r.d === +u.id : (r) => OT.regionOf(r) === u.id;
    return `<div class="ss">${head}${placeMatrix(y, inU, u.kind === 'state')}</div>`;
  }
  /* a season's state results as a weight × place matrix: weights down the side with each bracket's strength of
     competition, places 1–8 across; each cell a wrestler chip (school colour edge, name, school, RTG). On unit pages
     only that unit's placers show and weights without one are dropped. */
  function placeMatrix(y, inU, all) {
    const classes = state.cls === 'ALL' ? Array.from(new Set(OT.APP.filter((r) => r.year === y).map((r) => r.cls))).sort() : [state.cls];
    const out = classes.map((c) => {
      const yr = OT.APP.filter((r) => r.year === y && (r.cls === c || (r.cls === 'single' && (state.cls === 'ALL' || r.k === c))));
      const byW = new Map(); yr.forEach((r) => { const k = r.wn || +r.w || 0; (byW.get(k) || byW.set(k, { w: r.w, any: r, pl: [] }).get(k)).pl.push(r); });
      const W = Array.from(byW.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      const rows = W.map((v) => {
        const mine = v.pl.filter((r) => r.place && r.place <= 8 && inU(r)); if (!all && !mine.length) return '';
        const f = OT.fieldOf(v.any, 'state');
        const cells = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => { const r = mine.find((x) => x.place === p); if (!r) return '<span class="pmc pm0"></span>';
          const rt = OT.ratingOf(r, 'state'); return `<a class="pmc ${pcls(p)}" href="${OT.wrestlerHref(r)}" style="--p1:${colorOf(r.sch)}" title="${esc(ordinal(p) + ' · ' + r.name + ' · ' + r.sch)}"><b><span class="fnm">${esc(shortName(r.name))}</span><span class="lnm">${esc(String(r.name).replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(-1)[0])}</span></b><small>${esc(r.sch)}</small>${rt ? `<i>${rw(rt)}</i>` : ''}</a>`; }).join('');
        return `<div class="pmr"><span class="pmw"><b>${wShort(v.w)}</b>${f ? `<span class="pmf">${sbar(f, 'state', `${y} state ${wShort(v.w)}`)}<em>${r10(f)}</em></span>` : ''}</span>${cells}</div>`;
      }).join('');
      if (!rows) return '';
      return `${classes.length > 1 ? `<div class="pmcls">Class ${c === 'single' ? 'one class' : c}</div>` : ''}<div class="pmx"><div class="pmg"><div class="pmr pmh"><span class="pmw">Wt</span>${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<span class="pmp ${pcls(p)}">${ordinal(p)}</span>`).join('')}</div>${rows}</div></div>`;
    }).join('');
    return out || '<div class="note1">No state placers this season.</div>';
  }

  Object.assign(OT, { sfmt, winTypesOf, talWhat, unitRtgLabel: () => 'Strength', unitRtgTip: (kind) => (kind === 'school' ? 'Strength: the lineup as a dual-meet team. Its best wrestler at each weight, a weight with nobody entered a forfeit, scored by its chance of beating an average state qualifier (1500) and put back on the rating scale' : 'Strength: the average Strength of its top quarter of schools (at least one) each season'), talTxt, rw, careerGrid, otherClass, ratingDom, ratingColor, domFrac, mapMode, placeMatrix, aggregateCore, ssIn, colorAt, ratedYear, sortSelect, UD, SLUG2S, aggregate, unitAgg, unitRankings, unitCard, wrestlerCard, timeline, compBar, compColor, fieldGauge, fieldTip, wlegend, careerDiscs, winBar, rtgBars, sgKey, sgTier, SG_N, lineMeter, spark, perfChart, loadBW, recordOf, winTypesOf, bwLoaded: () => !!BW, r10, colorOf, W3, sbar, resCell, podium, miniChart, placeDist, RCOL, lineColor, pctIn });
})();
