/* Overtime — School seasons: every school season from 1974 on, ranked against each other as dual-meet teams.
   Data: overtime/seasons.json (tools/build_units.js), loaded when the list is first opened; each season's lineup comes
   from overtime/seasons/<first letter of the school slug>.json when its row is opened.
   Each season wrestles a dual against every one of the 500 best seasons, weight by weight at the wrestlers' season ratings.
     Expected  share of those duals won, each bout counting its chance of a decision, major, tech fall or fall
     Cutoffs   share won outright when the higher-rated wrestler always wins and the gap alone decides the bonus
   One number per season, the same on every page; the place, class and seasons filters only choose which seasons are
   listed. */
'use strict';
(() => {
  const { esc, fmt, ordinal, slug, state } = OT;
  const UD = OT.UD, S = UD.schools;
  const SIDX = new Map(S.map((s, i) => [s, i]));
  let SD = null, SDP = null; const LU = {}, LUP = {};
  const loadSeasons = () => SDP || (SDP = fetch('seasons.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
    SD = d || { rows: [], field: 500, w: [] };
    /* rank of every season by each measure, statewide, for the colour of its tile */
    /* tile colour: where the season sits among the field (the best 500 by that measure); below the field, the coldest end */
    ['5', '7'].forEach((c) => { const v = SD.rows.map((r) => r[+c]).sort((a, b) => b - a).slice(0, SD.field).reverse(), n = v.length;
      SD['p' + c] = (x) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; } return n > 1 ? lo / (n - 1) : 0.5; }; });
    return SD; }));
  const loadLineups = (c) => LUP[c] || (LUP[c] = fetch('seasons/' + c + '.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { LU[c] = d; return d; }));
  const C = { sch: 0, y: 1, cls: 2, d: 3, reg: 4, exp: 5, expM: 6, cut: 7, cutM: 8, est: 9, str: 10, sp: 11, ti: 12, med: 13, tt: 14, pl: 15 };
  const MODES = { exp: [C.exp, C.expM, 'p5'], cut: [C.cut, C.cutM, 'p7'] };
  const medalPts = (r) => String(r[C.pl] || '').split('').reduce((t, p) => t + OT.PTS[+p - 1], 0);
  const inPlace = (p) => !p || p.kind === 'state' ? () => true : p.kind === 'region' ? (r) => r[C.reg] === p.id : p.kind === 'district' ? (r) => r[C.d] === +p.id : (r) => r[C.sch] === SIDX.get(p.id);
  const clsOk = (r) => state.cls === 'ALL' || (r[C.cls] ? 'AA' : 'AAA') === state.cls;
  /* PIAA team-duals champions (on file from 1999): a trophy beside the year, not part of the number */
  let DCH = null; const dualChamp = (r) => { if (!DCH) { DCH = new Set(); (window.WR_DUALS || []).forEach((d) => { if (/championship match/i.test(d[2])) DCH.add((OT.canon ? OT.canon(d[3]) : d[3]) + '|' + d[0] + '|' + (d[1] === 'AA' ? 1 : 0)); }); }
    return DCH.has(S[r[C.sch]] + '|' + r[C.y] + '|' + r[C.cls]); };
  const TROPHY = '<svg class="zst" viewBox="0 0 24 24" aria-label="State duals champion"><path d="M7 3h10v5a5 5 0 0 1-10 0z M7 5H3.5v1.5A3.5 3.5 0 0 0 7 10 M17 5h3.5v1.5A3.5 3.5 0 0 1 17 10 M12 13v4 M8 21h8 M9.5 17h5v4h-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  const pct = (v) => (v / 10).toFixed(1) + '%';
  const counts = (r) => { const c = [0, 0, 0, 0, 0, 0, 0, 0]; String(r[C.pl] || '').split('').forEach((p) => { if (+p) c[+p - 1]++; }); return c; };
  /* state medals by place, 1st to 8th left to right: bar height = how many, top edge in the medal colour */
  const MEDC = ['#D9A441', '#B8BFC6', '#B5733A', '#8E5A3C', '#5F6B78', '#5F6B78', '#5F6B78', '#5F6B78'];
  const medalBars = (c) => { const tot = c.reduce((a, b) => a + b, 0), mx = Math.max(1, ...c), H = 18;
    return `<span class="pz${tot ? '' : ' pz0'}" title="${c.map((n, i) => ordinal(i + 1) + ' ' + n).join(' · ')}"><span class="pzh">${OT.navIcon('state')}<b>${tot}</b><i>${c[0] ? c[0] + ' ★' : ''}</i></span><span class="pzs" style="height:${H}px">${c.map((n, i) => `<i style="height:${n ? Math.max(3, Math.round(H * n / mx)) : 1}px;--c:${MEDC[i]}"></i>`).join('')}</span></span>`; };
  function seasonRow(r, rank, mode, sort, own) {
    const sch = S[r[C.sch]], key = slug(sch) + '|' + r[C.y] + (r[C.cls] ? 'b' : ''); const [vi, mi, pk] = MODES[mode];
    const est = r[C.est] ? '≈' : '';
    const tip = `${mode === 'exp' ? 'Expected' : 'Cutoffs'} · wins ${pct(r[vi])} of duals vs the ${SD.field} best · margin ${(r[mi] / 10).toFixed(1)}${est ? ' · estimated lineup' : ''}`;
    return `<div class="sx zsx" style="--p1:${OT.colorOf(sch)}"><button class="sxr" data-sx data-ssl="${esc(key)}" aria-expanded="false"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>`
      + `<span class="nm zsn"><b class="zsy">${r[C.y]}${dualChamp(r) ? TROPHY : ''}</b>${own ? '' : OT.stag(sch)}</span>`
      + `<span class="zsp${sort === 'medals' ? ' on' : ''}">${medalBars(counts(r))}</span>`
      + `<span class="vt vtr${sort === 'duals' ? ' on' : ''}" style="--tint:${OT.colorAt(Math.max(0.04, SD[pk](r[vi])))}" title="${esc(tip)}"><b>${est}${pct(r[vi])}</b></span>`
      + `</button><div class="sxd" hidden><div class="zsl" data-sslb="${esc(key)}"></div><a class="sxo" href="#school/${slug(sch)}">${esc(sch)} →</a></div></div>`;
  }
  /* the list for a place (null = Pennsylvania) */
  function seasonRankings(parent) {
    if (!SD) { loadSeasons(); return { sortSeg: '', html: '<div class="fpn" data-need-ss="1"></div>' }; }
    const mode = MODES[state.smode] ? state.smode : 'exp', sort = state.ssort === 'medals' ? 'medals' : 'duals'; const [vi, mi] = MODES[mode];
    const [wa, wb] = OT.yearsWindow(), f = inPlace(parent);
    const L = SD.rows.filter((r) => r[C.y] >= wa && r[C.y] <= wb && clsOk(r) && f(r))
      .sort(sort === 'medals' ? (a, b) => medalPts(b) - medalPts(a) || b[vi] - a[vi] : (a, b) => b[vi] - a[vi] || b[mi] - a[mi]);
    const seg = `<div class="seg sm zsm0">${[['exp', 'Expected'], ['cut', 'Cutoffs']].map(([k, l]) => `<button data-smode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>`;
    if (!L.length) return { sortSeg: seg, html: OT.empty(wb < SD.from ? `Ranked from ${SD.from}.` : 'No school seasons in this window.') };
    const lim = state.uall ? Math.min(L.length, 200) : 25;
    const hb = (k, l) => `<span class="vth"><button class="ht${sort === k ? ' on' : ''}" data-ssort="${k}" aria-pressed="${sort === k}">${l}</button></span>`;
    const head = `<div class="sxh zsh"><span class="rk"></span><span class="nm"></span>${hb('medals', 'Medals')}${hb('duals', 'Duals won')}</div>`;
    const more = L.length > 25 ? `<div class="bmore"><button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Top 25' : 'Show ' + Math.min(L.length, 200) + (L.length > 200 ? ' of ' + fmt(L.length) : '')}</button></div>` : '';
    return { sortSeg: seg, html: `<div class="sxl zsl0">${head}${L.slice(0, lim).map((r, i) => seasonRow(r, i + 1, mode, sort, parent && parent.kind === 'school')).join('')}</div>${more}` };
  }
  /* an opened row: the lineup, weight by weight */
  /* finishes as small place pills: place, Q (entered, no place), dash (not there) */
  const fin = (p) => (p == null || p < 0 ? '<span class="zsq x">–</span>' : p ? `<span class="zsq ${OT.pc ? OT.pc(p) : ''}">${ordinal(p)}</span>` : '<span class="zsq q">Q</span>');
  function fillLineup(el) {
    const key = el.dataset.sslb; if (!key) return; const [sl, yk] = key.split('|'); const c = sl[0];
    const draw = (d) => {
      const L = d && d[sl] && d[sl][yk]; if (!L) { el.textContent = 'No lineup on file.'; return; }
      const r = SD.rows.find((x) => slug(S[x[C.sch]]) === sl && String(x[C.y]) + (x[C.cls] ? 'b' : '') === yk); const est = r && r[C.est];
      const rows = L.map(([w, name, rt, D, R, St]) => `<div class="zsr"><span class="zsw">${w >= 999 ? 'Hwt' : w}</span>${name ? `<span class="zsm">${esc(name)}</span><span class="zsv" style="--tint:${OT.colorAt(Math.max(0.04, Math.min(1, (rt - 1500) / 700)))}">${rt}</span>${fin(D)}${fin(R)}${fin(St)}` : `<span class="zsm zsx0">${est ? 'not on file' : '—'}</span><span></span><span></span><span></span><span></span>`}</div>`).join('');
      el.innerHTML = `<div class="zsr zsrh"><span>Wt</span><span>Wrestler</span><span>RTG</span><span>Dist</span><span>Reg</span><span>State</span></div>${rows}`
;
    };
    if (LU[c]) draw(LU[c]); else loadLineups(c).then(draw);
  }
  Object.assign(OT, { loadSeasons, seasonRankings, fillLineup, seasonsLoaded: () => !!SD });
})();
