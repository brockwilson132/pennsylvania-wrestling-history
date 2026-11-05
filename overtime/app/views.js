/* Overtime — the Timeline and All-time team views (chosen with View in the filter bar). */
'use strict';
(() => {
  const OT = window.OT; if (!OT) return;
  const { esc, state, ordinal } = OT;
  const RATED_FROM = 1974;

  /* ---------- Timeline: one heat strip per unit, all on one season axis ----------
     State → schools (or districts, regions), Region → schools (or districts), District → schools, School → its weights
     (the rating of its best wrestler on record at each weight, each season). */
  const UNITS = { state: [['school', 'Schools'], ['district', 'Districts'], ['region', 'Regions']], region: [['school', 'Schools'], ['district', 'Districts']], district: [['school', 'Schools']], school: [['weight', 'Weights']] };
  const SORTS = [['avg', 'Average'], ['last', 'Latest season'], ['peak', 'Peak'], ['name', 'Name']];
  const NOUN = { school: ['school', 'schools'], district: ['district', 'districts'], region: ['region', 'regions'], weight: ['weight', 'weights'] };
  const unitOf = (u) => { const opts = UNITS[u.kind] || UNITS.state; return opts.some(([k]) => k === state.tlunit) ? state.tlunit : opts[0][0]; };
  const parentOf = (u) => (u.kind === 'state' ? null : { kind: u.kind, id: u.kind === 'district' ? +u.id : u.id });

  function unitRowsTL(u, kind) {
    const home = kind === 'school' && state.cls !== 'ALL';
    return OT.aggregateCore(kind, parentOf(u), u.kind === 'state' ? 'state' : u.kind, home).filter((a) => a.series.length && a.name).map((a) => {
      const vals = new Map(a.series), est = new Set(a.ys.filter((y) => y.rn && y.en && y.en * 2 >= y.rn).map((y) => y.y));
      const sch = kind === 'school' ? OT.U.school(a.name) : null;
      const row = { name: a.name, href: a.href, vals, est, d: sch ? sch.d || 0 : 0 };
      /* seasons this school spent in the other class: their own row under it, never in this class's numbers or ranks */
      const oys = home ? OT.otherClass(a.k) : [];
      if (oys.length) row.alt = { name: a.name, cls: oys[0].c, href: a.href, vals: new Map(oys.map((o) => [o.y, o.v])), est: new Set(oys.filter((o) => o.e).map((o) => o.y)) };
      return row;
    });
  }
  function weightRowsTL(u) {
    const recs = OT.unitRows(u).map((r) => ({ r, lvl: 'state' })).concat(OT.lowerUnitRows(u, 'regional').map((r) => ({ r, lvl: 'regional' })), OT.lowerUnitRows(u, 'district').map((r) => ({ r, lvl: 'district' })));
    const by = new Map();
    recs.forEach(({ r }) => { if (r.year < RATED_FROM) return; const v = OT.rtgOf(r); if (!v) return; const c = OT.stdOf(r); const m = by.get(c.k) || by.set(c.k, new Map()).get(c.k); const b = m.get(r.year); if (!b || v > b.v) m.set(r.year, { v, who: r.name }); });
    return OT.STD.filter((c) => by.has(c.k)).map((c) => { const m = by.get(c.k); const who = new Map(Array.from(m, ([y, b]) => [y, b.who])); return { name: c.label, href: '', vals: new Map(Array.from(m, ([y, b]) => [y, b.v])), est: new Set(), who, wi: OT.STD.indexOf(c) }; });
  }
  const n0 = (d) => d.years.filter((y) => d.rank.get(y) && d.rank.get(y).length).length;
  const mean = (A) => A.reduce((t, x) => t + x, 0) / A.length;
  /* the data for one unit and row kind: rows, the season axis and each season's ranking (kept for the tip) */
  let TL = null;
  function tlData(u) {
    const kind = unitOf(u);
    const rows = kind === 'weight' ? weightRowsTL(u) : unitRowsTL(u, kind);
    const [wa, wb] = OT.yearsWindow(); const ys = new Set(); rows.forEach((r) => r.vals.forEach((v, y) => { if (y >= wa && y <= wb) ys.add(y); }));
    const years = ys.size ? d3.range(Math.max(RATED_FROM, d3.min(ys)), d3.max(ys) + 1) : [];
    rows.forEach((r) => { const v = years.map((y) => r.vals.get(y)).filter((x) => x); r.avg = v.length ? mean(v) : 0; r.peak = v.length ? Math.max(...v) : 0; const ly = years.slice().reverse().find((y) => r.vals.get(y)); r.last = ly ? r.vals.get(ly) : 0; r.n = v.length; });
    const rank = new Map(years.map((y) => [y, rows.map((r) => r.vals.get(y)).filter((x) => x).sort((a, b) => b - a)]));
    return { kind, rows: rows.filter((r) => r.n), years, rank };
  }
  const domKind = (kind) => (kind === 'weight' ? 'wrestler' : kind);
  const legendBar = (kind) => { const [lo, hi] = OT.ratingDom(domKind(kind)); const g = d3.range(0, 1.01, 0.1).map((f) => OT.colorAt(f)).join(','); return `<div class="tlleg"><span class="num">${OT.r10(lo)}</span><i style="background:linear-gradient(90deg,${g})"></i><span class="num">${OT.r10(hi)}</span><span class="muted">${kind === 'weight' ? 'wrestler rating' : NOUN[kind][0] + ' rating'}</span></div>`; };
  function timelineView(u) {
    const d = tlData(u); TL = { ...d, u };
    const opts = UNITS[u.kind] || UNITS.state; const sort = SORTS.some(([k]) => k === state.tlsort) ? state.tlsort : 'avg';
    const canGroup = d.kind === 'school' && (u.kind === 'state' || u.kind === 'region'); const grouped = canGroup && state.tlgroup;
    const segs = opts.length > 1 ? `<div class="seg sm" role="group" aria-label="Rows">${opts.map(([k, l]) => `<button type="button" data-tlunit="${k}" aria-pressed="${k === d.kind}">${l}</button>`).join('')}</div>` : '';
    const ctl = `<div class="tlctl">${segs}${canGroup ? `<button type="button" class="chipb${grouped ? ' on' : ''}" data-tlgroup aria-pressed="${!!grouped}">By district</button>` : ''}${OT.sortSelect('tlsort', d.kind === 'weight' ? [['weight', 'Weight']].concat(SORTS.slice(0, 3)) : SORTS, d.kind === 'weight' && !state.tlsort ? 'weight' : sort)}</div>`;
    if (!d.years.length) return `${ctl}${OT.empty(OT.yearsWindow()[1] < RATED_FROM ? 'Ratings start in 1974. Widen TIME to see the timeline.' : 'No rated seasons here in this window.')}`;
    const s = d.kind === 'weight' && (!state.tlsort || state.tlsort === 'weight') ? 'weight' : sort;
    const cmp = { avg: (a, b) => b.avg - a.avg, last: (a, b) => b.last - a.last || b.avg - a.avg, peak: (a, b) => b.peak - a.peak, name: (a, b) => a.name.localeCompare(b.name), weight: (a, b) => a.wi - b.wi }[s] || ((a, b) => b.avg - a.avg);
    /* rankings need enough seasons (a third of the window for schools, half for districts and regions): rows with fewer
       sort after the rest, except by name */
    const minS = d.kind === 'weight' ? 1 : Math.max(1, Math.ceil(n0(d) / (d.kind === 'school' ? 3 : 2)));
    const thin = (r) => (s !== 'name' && r.n < minS ? 1 : 0);
    let rows = d.rows.slice().sort((a, b) => thin(a) - thin(b) || cmp(a, b));
    if (grouped) rows.sort((a, b) => (a.d || 99) - (b.d || 99) || thin(a) - thin(b) || cmp(a, b));
    const lim = Math.min(rows.length, state.tln || 50); const shown = rows.slice(0, lim);
    const n = d.years.length, kd = domKind(d.kind);
    const ax = `<div class="tlax" aria-hidden="true">${d.years.map((y, i) => `<span>${y % 5 === 0 || i === 0 || i === n - 1 ? (y % 100 < 10 ? "'0" : "'") + (y % 100) : ''}</span>`).join('')}</div>`;
    let lastD = null; const idx = new Map(d.rows.map((r, i) => [r, i]));
    const body = shown.map((r) => {
      let g = ''; if (grouped && r.d !== lastD) { lastD = r.d; g = `<div class="tlg"><a href="#district/${r.d}">${r.d ? 'District ' + r.d : 'District not on record'}</a></div>`; }
      const ri = idx.get(r);
      const cells = d.years.map((y, i) => { const v = r.vals.get(y); return v ? `<i data-c="${ri}|${i}" class="${r.est.has(y) ? 'e' : ''}" style="background:${OT.ratingColor(kd, v)}"></i>` : `<i class="n" data-c="${ri}|${i}"></i>`; }).join('');
      const lab = r.href ? `<a class="tll" href="${r.href}">${esc(r.name)}</a>` : `<span class="tll">${esc(r.name)}</span>`;
      const alt = r.alt && r.alt.vals.size ? (() => { const a = r.alt; const cs = d.years.map((y, i) => { const v = a.vals.get(y); return v ? `<i data-c="a${ri}|${i}" class="${a.est.has(y) ? 'e' : ''}" style="background:${OT.ratingColor(kd, v)}"></i>` : `<i class="n" data-c="a${ri}|${i}"></i>`; }).join('');
        const av = Array.from(a.vals).filter(([y]) => y >= d.years[0] && y <= d.years[n - 1]).map(([, v]) => v);
        return av.length ? `<div class="tlr alt"><span class="tlh"><span class="tll">${esc(r.name)} <em>${a.cls === 'AAA' ? 'AAA' : 'AA'} seasons</em></span><span class="tla num" title="average of these seasons; not counted in ${esc(state.cls)}">${OT.r10(mean(av))}</span></span><div class="tls">${cs}</div></div>` : ''; })() : '';
      return `${g}<div class="tlr"><span class="tlh">${lab}<span class="tla num" title="${esc(SORTS.find(([k]) => k === (s === 'weight' ? 'avg' : s))[1])}">${OT.r10(s === 'last' ? r.last : s === 'peak' ? r.peak : r.avg)}</span></span><div class="tls">${cells}</div></div>${alt}`; }).join('');
    const more = rows.length > lim ? `<div class="bmore"><button class="more" type="button" data-tlmore>Show ${Math.min(50, rows.length - lim)} more of ${rows.length}</button></div>` : '';
    const nn = NOUN[d.kind];
    return `${ctl}<div class="tltip" id="tltip" aria-live="polite">${rows.length} ${nn[rows.length === 1 ? 0 : 1]}, ${d.years[0]}–${d.years[n - 1]}. Tap a season for its rating and rank.</div>
      <div class="tlx pscr scroll" style="--n:${n}"><div class="tlin">${ax}${body}</div></div>${more}${legendBar(d.kind)}
      <div class="note">${d.kind === 'weight' ? 'Each weight: the rating of the school\'s best wrestler on record there that season (state entrants and district and regional placewinners).' : 'Each strip: the ' + nn[0] + '\'s season rating, cold to hot.'} Dotted cells are estimated. The number beside each name follows the sort.${d.kind === 'weight' ? '' : ' ' + nn[1][0].toUpperCase() + nn[1].slice(1) + ' rated in fewer than ' + minS + ' of these seasons come last.'}</div>`;
  }
  /* the tip: value and rank among the rows that season */
  const tipFor = (key) => { if (!TL) return '';
    if (key[0] === 'a') { const [ri, i] = key.slice(1).split('|').map(Number); const r = TL.rows[ri], y = TL.years[i]; const a = r && r.alt; if (!a) return ''; const v = a.vals.get(y);
      return v ? `<b>${esc(r.name)}</b> · ${y} · <b class="num">${OT.r10(v)}</b> in ${a.cls}${a.est.has(y) ? ' est.' : ''} · not counted in ${esc(state.cls)}` : `${esc(r.name)} · ${y} · not in ${a.cls}`; }
    const [ri, i] = key.split('|').map(Number); const r = TL.rows[ri], y = TL.years[i]; if (!r) return ''; const v = r.vals.get(y);
    if (!v) return `${esc(r.name)} · ${y} · no rating`;
    const R = TL.rank.get(y) || []; const k = R.indexOf(v) + 1; const nn = NOUN[TL.kind];
    return `<b>${esc(r.name)}</b> · ${y} · <b class="num">${OT.r10(v)}</b>${r.est.has(y) ? ' est.' : ''}${r.who && r.who.get(y) ? ' · ' + esc(r.who.get(y)) : ''} · ${ordinal(k)} of ${R.length} ${nn[R.length === 1 ? 0 : 1]}`; };
  const showTip = (el) => { const t = document.getElementById('tltip'); if (!t || !el.dataset.c) return; t.innerHTML = tipFor(el.dataset.c); document.querySelectorAll('.tls i.hl').forEach((x) => x.classList.remove('hl')); el.classList.add('hl'); };
  if (typeof document !== 'undefined' && !OT.tipWired) { OT.tipWired = true; document.addEventListener('mouseover', (e) => { const c = e.target.closest && e.target.closest('.tls i'); if (c) showTip(c); });
  document.addEventListener('click', (e) => { const c = e.target.closest && e.target.closest('.tls i'); if (c) showTip(c); }); }

  /* ---------- All-time team: weights × depth, as deep as you like ---------- */
  /* one line per season, FR to SR: how tough his toughest bracket that year was (the bar, on the career grid's shared
     scale: every level measured against district brackets, so states read tougher than districts) and how
     far he got. A state result is a medal pill; a season that ended at regionals or districts says so in plain text. */
  const LV_SHORT = { regional: 'Reg', district: 'Dist' };
  function seasonLines(s) {
    const W = OT.getWrestler(s.href.replace('#wrestler/', ''));
    if (!W || !(W.apps.length || (W.lower && W.lower.length))) {   // index entry with no matching rows: state results only, no bars
      if (!s.sres.length) return ''; const y1 = Math.max(...s.sres.map((r) => r.year)), ys = [y1 - 3, y1 - 2, y1 - 1, y1];
      return ys.map((y, i) => { const r = s.sres.find((x) => x.year === y);
        return `<span class="sx"><span class="sg">'${String(y).slice(2)}<i>${OT.GRADE_L[i]}</i></span><span class="smtr sm0"><i></i></span>${r ? (r.place ? `<span class="yp ${OT.pc(r.place)}">${ordinal(r.place)}</span>` : '<span class="yp q">Q</span>') : '<span class="sr0">–</span>'}</span>`; }).join(''); }
    const M = OT.careerCells(W.apps, W.lower && W.lower.length ? W.lower : null);
    const at = (k) => M.rows.find((r) => r.k === k).cells;
    return M.cols.map((col, i) => {
      const lvl = ['state', 'regional', 'district'].find((k) => { const c = at(k)[i]; return c && (c.place || c.q || c.dnp); });
      const c = lvl ? at(lvl)[i] : null; const yr = col ? `'${String(col.year).slice(2)}` : '';
      const f = c && c.r ? OT.fieldOf(c.r, c.sec ? 'section' : lvl) : null;
      const tip = c ? `${col.year} · ${lvl === 'state' ? 'state' : c.sec ? 'section' : lvl}` : '';
      let res;
      if (!c) res = `<span class="sr0">${col ? '–' : ''}</span>`;
      else if (lvl === 'state') res = c.place ? `<span class="yp ${OT.pc(c.place)}" title="${tip} ${ordinal(c.place)}">${ordinal(c.place)}</span>` : `<span class="yp q" title="${tip} qualifier">Q</span>`;
      else res = `<span class="srl" title="${tip}${c.place ? ' ' + ordinal(c.place) : c.q ? ', advanced' : ', did not place'}">${LV_SHORT[lvl]} ${c.place ? ordinal(c.place) : c.q ? 'Q' : 'DNP'}</span>`;
      return `<span class="sx"><span class="sg">${yr || OT.GRADE_L[i]}${yr ? `<i>${OT.GRADE_L[i]}</i>` : ''}</span>${f ? OT.sbar(f, c.sec ? 'section' : lvl, `${col.year} ${lvl}`) : '<span class="sgn sg0"></span>'}${res}</span>`;
    }).join('');
  }
  /* the left bar: peak RTG on a fixed scale from the average state qualifier (1500) to 2200, about the best on record, so the
     all-time greats spread out instead of all reading full */
  const VLO = 1500, VHI = 2200;
  function chip(s, u) {
    if (!s) return '<div class="atc none"></div>';
    const lines = seasonLines(s);
    const vf = s.rtg ? Math.max(0.04, Math.min(1, (s.rtg - VLO) / (VHI - VLO))) : 0;
    const vbar = `<span class="atv" title="${s.rtg ? `Peak RTG ${OT.rtg10(s.rtg)} · bar runs from ${VLO} (average state qualifier) to ${VHI}` : 'No rating'}"><i style="height:${(100 * vf).toFixed(0)}%;background:${s.rtg ? OT.colorAt(vf) : 'transparent'}"></i></span>`;
    return `<a class="atc" href="${s.href}">${vbar}<span class="atl"><span class="atn"><b>${esc(s.name)}</b></span>${s.rtg ? OT.rtgTag(s.rtg, { size: 'xs' }) : ''}${u.kind === 'school' ? '' : `<small>${OT.stag(s.sch)}</small>`}</span>${lines ? `<span class="ats">${lines}</span>` : ''}</a>`;
  }
  function teamGrid(u) {
    const D = Math.max(3, state.attN || 3);
    const T0 = OT.allTimeTeams(u, D);
    if (T0 === null) return '<div class="card empty" data-need-people="1">Loading every wrestler…</div>';
    const T = state.f.weights.length ? T0.filter((x) => state.f.weights.includes(x.c.k)) : T0;
    if (!T.length) return OT.empty('No one on record yet.');
    const team = (i) => ordinal(i + 1);
    const grid = `<div class="atg" style="--c:${D}"><span class="ath atw"></span>${d3.range(D).map((i) => `<span class="ath">${team(i)} team</span>`).join('')}${T.map(({ c, slots }) => `<span class="atw">${c.label}</span>${slots.map((s) => chip(s, u)).join('')}`).join('')}</div>`;
    return `<div class="atx">${grid}</div><div class="note">Ranked the same way on every page: state finishes count 60% (each finish is worth what it rates in its class, so AA places count less), peak rating 40%, each measured against every state qualifier at that weight. Regional, then district results break ties. Each wrestler counts once, at his highest-rated weight. Each card lists his seasons FR to SR: the signal bars show how tough the last bracket he wrestled that season was for its level, from Docile (one bar) to Violent (six).</div>`;
  }
  Object.assign(OT, { timelineView, teamGrid });
})();
