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
    const ck = slug(sch) + '/' + r[C.y] + (r[C.cls] ? 'b' : ''), cA = state.cmpA;
    const open = cA ? (cA === ck ? `<div class="sxr zsme" aria-current="true">` : `<a class="sxr" href="#dual/${esc(cA)}~${esc(ck)}">`) : `<button class="sxr" data-sx data-ssl="${esc(key)}" aria-expanded="false">`;
    return `<div class="sx zsx${cA ? ' zspk' : ''}" style="--p1:${OT.colorOf(sch)}">${open}<i class="rk${rank === 1 ? ' g' : ''}">${rank}</i>`
      + `<span class="nm zsn"><b class="zsy">${r[C.y]}${dualChamp(r) ? TROPHY : ''}</b>${own ? '' : OT.stag(sch)}</span>`
      + `<span class="zsp${sort === 'medals' ? ' on' : ''}">${medalBars(counts(r))}</span>`
      + `<span class="vt vtr${sort === 'duals' ? ' on' : ''}" style="--tint:${OT.colorAt(Math.max(0.04, SD[pk](r[vi])))}" title="${esc(tip)}"><b>${est}${pct(r[vi])}</b></span>`
      + (cA ? (cA === ck ? '</div>' : '</a>') + '</div>' : `</button><div class="sxd" hidden><div class="zsl" data-sslb="${esc(key)}"></div><div class="zsft"><a class="sxo" href="#school/${slug(sch)}">${esc(sch)} →</a><button class="cmpb" data-cmpa="${esc(ck)}">Compare</button></div></div></div>`);
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
    const cr = state.cmpA && SD.rows.find((x) => slug(S[x[C.sch]]) + '/' + x[C.y] + (x[C.cls] ? 'b' : '') === state.cmpA);
    const pick = cr ? `<div class="zspb"><b class="zsy">${cr[C.y]}</b>${OT.stag(S[cr[C.sch]])}<span class="dqvs">vs</span><b class="zsy">?</b><button class="zspx" data-cmpa="" aria-label="Cancel">×</button></div>` : '';
    return { sortSeg: seg, html: `${pick}<div class="sxl zsl0">${head}${L.slice(0, lim).map((r, i) => seasonRow(r, i + 1, mode, sort, parent && parent.kind === 'school')).join('')}</div>${more}` };
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
  /* ---- Compare: two school seasons wrestle one dual, weight by weight (#dual/<slug>/<year>~<slug>/<year>) ----
     The same model as the ranking (tools/build_units.js, seasons.json `sim`): each bout at the two wrestlers' season
     ratings (the gap shrunk for ratings resting on few bouts), Expected = the chance of each result, Cutoffs = the
     higher-rated wrestler wins and the gap says how. Each weight meets the nearest weight of the other season, nobody
     twice, and a weight with no close partner sits out (eras had different weights); a weight with nobody entered is a district entrant who didn't place, and a weight we can't see is
     the era's fill, both marked ≈.
     Where the two wrestlers met in a bracket THAT season, the real result replaces the model: the last meeting of the
     season (the postseason only moves up, so it is also the biggest stage), decided on the mat (dec, major, tech fall,
     fall; forfeits, injury defaults and DQs stay modelled). Bouts from other seasons never count: a wrestler a year apart
     is a different wrestler, and his rating already holds those bouts. */
  const BP = [3, 4, 5, 6], RPTS = { dec: 3, md: 4, tf: 5, fall: 6 }, LVO = { section: 0, district: 1, regional: 2, state: 3 };
  const K2 = Math.PI * Math.pow(Math.LN10 / 400, 2) / 8;
  const mixAt = (g) => { const { gb, mix } = SD.sim; const x = Math.max(gb[0], Math.min(gb[gb.length - 1], g - 25)); let i = 0; while (i < gb.length - 2 && gb[i + 1] <= x) i++;
    const j = Math.min(gb.length - 1, i + 1), t = gb[j] === gb[i] ? 0 : Math.max(0, Math.min(1, (x - gb[i]) / (gb[j] - gb[i]))); return mix[i].map((v, k) => v + (mix[j][k] - v) * t); };
  /* one bout between ratings (na, nb = bouts behind each rating): [A's expected points, B's, mean of (A - B) squared,
     A's points with cutoffs minus B's, A's win chance] */
  const bout1 = (ra, rb, na, nb) => { if (ra == null) return rb == null ? [0, 0, 0, 0, 0.5] : [0, 6, 36, -6, 0]; if (rb == null) return [6, 0, 36, 6, 1];
    const U = SD.sim.unc || 0, vr = (n) => (n == null ? 0 : U * U / (1 + n)), g0 = ra - rb, g = U ? g0 / Math.sqrt(1 + K2 * (vr(na) + vr(nb))) : g0;
    const p = 1 / (1 + Math.pow(10, -g / 400)), ma = mixAt(g), mb = mixAt(-g); let ea = 0, eb = 0, s2 = 0;
    ma.forEach((q, k) => { ea += p * q * BP[k]; s2 += p * q * BP[k] * BP[k]; }); mb.forEach((q, k) => { eb += (1 - p) * q * BP[k]; s2 += (1 - p) * q * BP[k] * BP[k]; });
    const C = SD.sim.cut, hp = (x) => (x < C[0] ? 3 : x < C[1] ? 4 : x < C[2] ? 5 : 6);
    return [ea, eb, s2, g0 === 0 ? 0 : g0 > 0 ? hp(g0) : -hp(-g0), p]; };
  const Phi = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));
  const rowOf = (sl, yk) => SD.rows.find((x) => slug(S[x[C.sch]]) === sl && String(x[C.y]) + (x[C.cls] ? 'b' : '') === yk);
  const wLab = (w) => (w >= 999 ? 'Hwt' : String(w));
  /* the lineup's slots in weight order: [[rating, share, bouts]]; an empty weight = the era's district non-placer, a weight
     we can't see (field not on file) = the era's fill */
  function slotsOf(r, L) {
    const sim = SD.sim, era = r[C.y] < 1999 ? 0 : 1, empty = sim.forfeit ? [[null, 1]] : sim.empty[era];
    if (!r[C.est]) return L.map((e) => ({ e, mix: e[1] ? [[e[2], 1, e[7]]] : empty, gap: !e[1] }));
    const pv = (v) => 1 / (1 + Math.pow(10, (sim.ref - v) / 400));
    const bin = Math.min(9, Math.floor(20 * L.reduce((t, e) => t + (e[2] != null ? pv(e[2]) : 0), 0) / L.length));
    const fill = sim.fill[era + '|' + bin] || empty;
    return L.map((e) => ({ e, mix: e[1] ? [[e[2], 1, e[7]]] : fill, gap: !e[1], fill: !e[1] }));
  }
  /* each weight meets the nearest weight of the other season, nobody twice (tools/build_units.js pairs): weight order kept,
     fewest total pounds apart, leaving a weight out costs sim.sit pounds; returns the matched [i, j] in weight order */
  const wLb = (w) => (w >= 999 ? 280 : w);
  const pairs = (A, B) => { const G = SD.sim.sit || 8, n = A.length, m = B.length, d = (i, j) => Math.abs(wLb(A[i]) - wLb(B[j]));
    const f = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i + j) * G));
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) f[i][j] = Math.min(f[i - 1][j - 1] + d(i - 1, j - 1), f[i - 1][j] + G, f[i][j - 1] + G);
    const out = []; let i = n, j = m; while (i > 0 && j > 0) { if (f[i][j] === f[i - 1][j - 1] + d(i - 1, j - 1)) { out.push([i - 1, j - 1]); i--; j--; } else if (f[i][j] === f[i - 1][j] + G) i--; else j--; }
    return out.reverse(); };
  /* the last meeting that season between two wrestlers, decided on the mat: { pts, aWon, key } or null */
  function realBout(year, na, nb) {
    const Y = OT.sosYear(year); if (!Y || !na || !nb) return null; const ka = OT.nkey(na), kb = OT.nkey(nb); let best = null;
    Object.entries(Y).forEach(([key, B]) => { const lv = LVO[key.split('.')[2]]; if (lv == null) return;
      B.b.forEach((b, i) => { const w = OT.nkey(b[2]), l = OT.nkey(b[3]); if (!((w === ka && l === kb) || (w === kb && l === ka))) return;
        const o = { lv, i, key, aWon: w === ka, res: b[4] }; if (!best || lv > best.lv || (lv === best.lv && i > best.i)) best = o; }); });
    return best && RPTS[best.res] ? { pts: RPTS[best.res], aWon: best.aWon, key: best.key, res: best.res } : null;
  }
  /* the whole dual: per weight both sides and what the bout is worth in match points to the side it favours (Expected:
     the expected points won minus lost; Cutoffs: 3 to 6; a real result: its points), and the team totals of those */
  function dualOf(ra, La, rb, Lb) {
    const A = slotsOf(ra, La), B = slotsOf(rb, Lb), same = ra[C.y] === rb[C.y];
    let m = 0, v = 0, ta = 0, tb = 0, ha = 0, hb = 0;
    const P = pairs(A.map((x) => x.e[0]), B.map((x) => x.e[0]));
    const bouts = P.map(([i, j]) => { const a = A[i], b = B[j];
      const real = same && !a.gap && !b.gap ? realBout(ra[C.y], a.e[1], b.e[1]) : null;
      let ea = 0, eb = 0, s2 = 0, h = 0, pa = 0;
      if (real) { ea = real.aWon ? real.pts : 0; eb = real.aWon ? 0 : real.pts; s2 = real.pts * real.pts; h = real.aWon ? real.pts : -real.pts; pa = real.aWon ? 1 : 0; }
      else a.mix.forEach(([x, wa, na]) => b.mix.forEach(([y, wb, nb]) => { const o = bout1(x, y, na, nb), k = wa * wb; ea += k * o[0]; eb += k * o[1]; s2 += k * o[2]; h += k * o[3]; pa += k * o[4]; }));
      const mm = ea - eb; m += mm; v += real ? 0 : s2 - mm * mm; ta += Math.max(0, mm); tb += Math.max(0, -mm); ha += Math.max(0, h); hb += Math.max(0, -h);
      return { i, j, wa: a.e[0], wb: b.e[0], a, b, real, ea, eb, h, pa, est: !real && (a.gap || b.gap) }; });
    /* the weights that sit out, in weight order between the bouts */
    const rows = []; let ia = 0, jb = 0;
    bouts.concat([{ i: A.length, j: B.length, end: 1 }]).forEach((o) => { while (ia < o.i) rows.push({ sit: 'a', a: A[ia], wa: A[ia++].e[0] }); while (jb < o.j) rows.push({ sit: 'b', b: B[jb], wb: B[jb++].e[0] }); if (!o.end) { rows.push(o); ia++; jb++; } });
    const t2 = Math.pow(SD.sim.tau || 0, 2);
    return { bouts, rows, ta, tb, ha, hb, p: v + t2 > 1e-9 ? Phi(m / Math.sqrt(v + t2)) : m > 0 ? 1 : m < 0 ? 0 : 0.5 };
  }
  const keyOf = (r) => slug(S[r[C.sch]]) + '/' + r[C.y] + (r[C.cls] ? 'b' : '');
  const parseSide = (t) => { const m = /^(.+)\/(\d{4}b?)$/.exec(t || ''); return m ? { sl: m[1], yk: m[2] } : null; };
  /* the picker for one side: search a school, then its seasons */
  const sidePick = (side, other, q) => {
    const sl = q, rows = sl ? SD.rows.filter((x) => slug(S[x[C.sch]]) === sl).sort((a, b) => b[C.y] - a[C.y] || a[C.cls] - b[C.cls]) : [];
    const mode = MODES[state.smode] ? state.smode : 'exp', [vi, , pk] = MODES[mode];
    const href = (r) => '#dual/' + (side === 'a' ? keyOf(r) + '~' + (other || '') : (other || '') + '~' + keyOf(r));
    return `<div class="dqp" data-dqside="${side}" data-dqother="${esc(other || '')}"><input class="search dqi" type="search" placeholder="${sl ? esc(OT.SLUG2S.get(sl) || '') : ''}" autocomplete="off" aria-label="School"><div class="dql"></div>`
      + (rows.length ? `<div class="dqy">${rows.map((r) => `<a href="${href(r)}"><b>${r[C.y]}</b>${r[C.cls] ? '<small>AA</small>' : ''}<span style="--tint:${OT.colorAt(Math.max(0.04, SD[pk](r[vi])))}">${r[C.est] ? '≈' : ''}${pct(r[vi])}</span></a>`).join('')}</div>` : '') + '</div>';
  };
  function dualPage(id, q = {}) {
    const [ta, tb] = String(id || '').split('~'); const A = parseSide(ta), B = parseSide(tb);
    const mode = MODES[state.smode] ? state.smode : 'exp';
    const seg = `<div class="seg sm zsm0">${[['exp', 'Expected'], ['cut', 'Cutoffs']].map(([k, l]) => `<button data-smode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>`;
    const head = (inner) => `<header class="uh2 dqh"><h1>Compare</h1>${seg}</header>${inner}`;
    if (!SD) { loadSeasons(); return head('<div class="fpn" data-need-ss="1"></div>'); }
    const ra = A && rowOf(A.sl, A.yk), rb = B && rowOf(B.sl, B.yk);
    const team = (r, side, sc) => r ? `<button class="dqt${q.pick === side ? ' on' : ''}" data-dqpick="${side}"><b class="zsy">${r[C.y]}${r[C.cls] ? '<small>AA</small>' : ''}</b>${OT.stag(S[r[C.sch]])}${sc != null ? `<em>${sc}</em>` : ''}</button>`
      : `<button class="dqt dq0" data-dqpick="${side}"><b class="zsy">?</b></button>`;
    const pickFor = (side) => sidePick(side, side === 'a' ? (rb ? keyOf(rb) : '') : (ra ? keyOf(ra) : ''), q.s || (side === 'a' ? A && A.sl : B && B.sl));
    if (!ra || !rb) return head(`<div class="card dqc"><div class="dqteams">${team(ra, 'a')}<span class="dqvs">vs</span>${team(rb, 'b')}</div>${pickFor(ra ? 'b' : 'a')}</div>`);
    const c1 = ra[C.sch] === rb[C.sch] ? '' : '', ka = keyOf(ra).split('/'), kb = keyOf(rb).split('/');
    const La = LU[ka[0][0]] && LU[ka[0][0]][ka[0]] && LU[ka[0][0]][ka[0]][ka[1]], Lb = LU[kb[0][0]] && LU[kb[0][0]][kb[0]] && LU[kb[0][0]][kb[0]][kb[1]];
    const same = ra[C.y] === rb[C.y];
    if (!La || !Lb || (same && !OT.sosLoaded(ra[C.y]))) return head(`<div class="card dqc"><div class="dqteams">${team(ra, 'a')}<span class="dqvs">vs</span>${team(rb, 'b')}</div></div><div class="fpn" data-need-dual="${esc(id)}"></div>`) + c1;
    const D = dualOf(ra, La, rb, Lb), cut = mode === 'cut';
    const sa = cut ? D.ha : D.ta, sb = cut ? D.hb : D.tb, fmtS = (x) => String(Math.round(x)), f1 = (x) => (Math.round(x * 10) / 10).toFixed(cut && Number.isInteger(Math.round(x * 10) / 10) ? 0 : 1);
    const winBar = cut ? '' : `<div class="dqbar" title="${esc(S[ra[C.sch]])} ${pct(Math.round(1000 * D.p))}"><i style="width:${(100 * D.p).toFixed(1)}%"></i></div>`;
    const side = (sl, est) => { const e = sl.e; if (sl.fill) return `<span class="dqw dqx"><b>?</b></span>`;
      if (!e[1]) return `<span class="dqw dqx"><b>—</b></span>`;
      const g = e[6] >= 0 ? `<em class="dqg">${OT.GRADE_L[e[6]]}</em>` : '';
      return `<span class="dqw"><b>${esc(e[1])}</b><span class="dqr">${OT.rtgBars(e[2])}<i>${e[2]}</i>${g}</span></span>`; };
    const rows = D.rows.map((o) => {
      if (o.sit) return `<div class="dqr0 dqso">${o.sit === 'a' ? side(o.a) : '<span></span>'}<span></span><span class="dqwt">${wLab(o.sit === 'a' ? o.wa : o.wb)}</span><span></span>${o.sit === 'b' ? side(o.b) : '<span></span>'}</div>`;
      const aw = o.real ? o.real.aWon : cut ? o.h > 0 : o.ea > o.eb, bw = o.real ? !o.real.aWon : cut ? o.h < 0 : o.ea < o.eb;
      const num = o.real ? String(o.real.pts) : cut ? f1(Math.abs(o.h)) : f1(Math.abs(o.ea - o.eb)), wp = Math.min(99, Math.round(100 * Math.max(o.pa, 1 - o.pa))) + '%';
      const forfeit = !o.real && SD.sim.forfeit && (o.a.gap && !o.a.fill || o.b.gap && !o.b.fill);
      const cell = (won) => won ? (o.real ? `<a class="dqn real" href="${OT.bhref(o.real.key)}" aria-label="Bracket">${OT.navIcon('v_brk')}<b>${num}</b></a>`
        : forfeit ? '<span class="dqn"><b>6</b></span>' : `<button class="dqn${o.est ? ' est' : ''}" data-dqalt="${wp}"><b>${o.est ? '≈' : ''}${num}</b></button>`) : '<span class="dqn"></span>';
      return `<div class="dqr0${aw ? ' aw' : ''}${bw ? ' bw' : ''}">${side(o.a)}${cell(aw)}<span class="dqwt">${o.wa === o.wb ? wLab(o.wa) : `${wLab(o.wa)}<i>${wLab(o.wb)}</i>`}</span>${cell(bw)}${side(o.b)}</div>`; }).join('');
    return head(`<div class="card dqc"><div class="dqteams">${team(ra, 'a', fmtS(sa))}<span class="dqvs">vs</span>${team(rb, 'b', fmtS(sb))}</div>${winBar}${q.pick ? pickFor(q.pick) : ''}<div class="dqb">${rows}</div></div>`);
  }
  /* what the page needs before it can draw: both lineups, and that season's brackets when the two are the same year */
  function loadDual(id) {
    const ps = String(id || '').split('~').map(parseSide).filter(Boolean); const need = [loadSeasons()];
    ps.forEach((p) => need.push(loadLineups(p.sl[0])));
    return Promise.all(need).then(() => { if (ps.length === 2 && ps[0].yk.slice(0, 4) === ps[1].yk.slice(0, 4) && OT.loadSOS) return OT.loadSOS(+ps[0].yk.slice(0, 4)); });
  }
  Object.assign(OT, { loadSeasons, seasonRankings, fillLineup, seasonsLoaded: () => !!SD, dualPage, loadDual, dualKey: keyOf, seasonsRowKey: (k) => k });
})();
