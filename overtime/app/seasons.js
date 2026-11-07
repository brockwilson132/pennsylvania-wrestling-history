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
  const C = { sch: 0, y: 1, cls: 2, d: 3, reg: 4, exp: 5, expM: 6, cut: 7, cutM: 8, est: 9, str: 10, sp: 11, ti: 12, med: 13, tt: 14 };
  const SORTS = {
    exp: (a, b) => b[C.exp] - a[C.exp] || b[C.expM] - a[C.expM],
    cut: (a, b) => b[C.cut] - a[C.cut] || b[C.cutM] - a[C.cutM] || b[C.exp] - a[C.exp],
    titles: (a, b) => b[C.ti] - a[C.ti] || b[C.exp] - a[C.exp],
    medals: (a, b) => b[C.med] - a[C.med] || b[C.exp] - a[C.exp],
  };
  const inPlace = (p) => !p || p.kind === 'state' ? () => true : p.kind === 'region' ? (r) => r[C.reg] === p.id : p.kind === 'district' ? (r) => r[C.d] === +p.id : (r) => r[C.sch] === SIDX.get(p.id);
  const clsOk = (r) => state.cls === 'ALL' || (r[C.cls] ? 'AA' : 'AAA') === state.cls;
  const pct = (v) => (v / 10).toFixed(1) + '%';
  /* duals won, tinted by where the season sits among every season on file (colour = strength) */
  const tile = (cls, on, val, f, title) => `<span class="vt ${cls}${on ? ' on' : ''}" style="--tint:${OT.colorAt(Math.max(0.04, f))}" title="${esc(title)}"><b>${val}</b></span>`;
  const plain = (cls, on, n, title) => `<span class="vt ${cls}${on ? ' on' : ''}${n ? '' : ' z'}" title="${esc(title)}"><b>${n || '–'}</b></span>`;
  function seasonRow(r, rank, sort, own) {
    const sch = S[r[C.sch]], cls = r[C.cls] ? 'AA' : 'AAA', key = slug(sch) + '|' + r[C.y] + (r[C.cls] ? 'b' : '');
    const sub = [r[C.y], cls, r[C.d] ? 'D' + r[C.d] : '', r[C.est] ? 'estimated' : ''].filter(Boolean).join(' · ');
    const fld = SD.field;
    return `<div class="sx scx" style="--p1:${OT.colorOf(sch)}"><button class="sxr" data-sx data-ssl="${esc(key)}" aria-expanded="false"><i class="rk${rank === 1 ? ' g' : ''}">${rank}</i><span class="nm scn">${own ? `<b>${r[C.y]}</b><small>${sub.replace(r[C.y] + ' · ', '')}</small>` : `${OT.stag(sch)}<small>${sub}</small>`}</span>`
      + plain('vtt', sort === 'titles', r[C.ti], `${r[C.ti]} state title${r[C.ti] === 1 ? '' : 's'}`)
      + tile('vtr vte', sort === 'exp', pct(r[C.exp]), SD.p5(r[C.exp]), `Expected: wins ${pct(r[C.exp])} of duals against the ${fld} best seasons, by expected points · average margin ${(r[C.expM] / 10).toFixed(1)}`)
      + tile('vtr vtc', sort === 'cut', pct(r[C.cut]), SD.p7(r[C.cut]), `Cutoffs: wins ${pct(r[C.cut])} of duals against the ${fld} best seasons when the higher-rated wrestler always wins · average margin ${(r[C.cutM] / 10).toFixed(1)}`)
      + plain('vtd', sort === 'medals', r[C.med], `${r[C.med]} state medal${r[C.med] === 1 ? '' : 's'}`)
      + `</button><div class="sxd" hidden><div class="scl" data-sslb="${esc(key)}">Loading the lineup…</div><a class="sxo" href="#school/${slug(sch)}">Open ${esc(sch)} →</a></div></div>`;
  }
  /* the list for a place (null = Pennsylvania) */
  function seasonRankings(parent) {
    if (!SD) { loadSeasons(); return { sortSeg: '', html: '<div class="fpn" data-need-ss="1">Loading every school season…</div>' }; }
    const sort = SORTS[state.ssort] ? state.ssort : 'exp';
    const [wa, wb] = OT.yearsWindow(), f = inPlace(parent);
    const L = SD.rows.filter((r) => r[C.y] >= wa && r[C.y] <= wb && clsOk(r) && f(r)).sort(SORTS[sort]);
    if (!L.length) return { sortSeg: '', html: OT.empty(wb < SD.from ? `School seasons start in ${SD.from}: earlier season ratings read too low to compare.` : 'No school seasons in this window.') };
    const lim = state.uall ? Math.min(L.length, 200) : 25;
    const hb = (k, l, c = '') => `<span class="vth${c}"><button class="ht${sort === k ? ' on' : ''}" data-ssort="${k}" aria-pressed="${sort === k}">${l}</button></span>`;
    const head = `<div class="sxh sch"><span class="rk"></span><span class="nm"></span>${hb('titles', 'Titles')}${hb('exp', 'Expected')}${hb('cut', 'Cutoffs')}${hb('medals', 'Medals')}</div>`;
    const note = `<div class="sck">Each season wrestles a dual against each of the ${SD.field} best seasons since ${SD.from}. The share it wins: <b>Expected</b> counts each bout's chance of a decision, major, tech fall or fall; <b>Cutoffs</b> gives every bout to the higher-rated wrestler.${wa < SD.from ? ` Seasons before ${SD.from} aren't ranked.` : ''}</div>`;
    const more = L.length > 25 ? `<div class="bmore"><button class="more" data-uall="${state.uall ? '0' : '1'}">${state.uall ? 'Show top 25' : 'Show ' + Math.min(L.length, 200) + (L.length > 200 ? ' of ' + fmt(L.length) : '')}</button></div>` : '';
    return { sortSeg: '', html: `${note}<div class="sxl scl0">${head}${L.slice(0, lim).map((r, i) => seasonRow(r, i + 1, sort, parent && parent.kind === 'school')).join('')}</div>${more}` };
  }
  /* an opened row: the lineup, weight by weight */
  const fin = (p, lvl) => (p == null || p < 0 ? '<span class="wqp x">–</span>' : p ? `<span class="wqp ${OT.pc ? OT.pc(p) : ''}">${ordinal(p)}</span>` : `<span class="wqp q">${lvl === 'S' ? 'Q' : 'Adv'}</span>`);
  function fillLineup(el) {
    const key = el.dataset.sslb; if (!key) return; const [sl, yk] = key.split('|'); const c = sl[0];
    const draw = (d) => {
      const L = d && d[sl] && d[sl][yk]; if (!L) { el.textContent = 'No lineup on file.'; return; }
      const r = SD.rows.find((x) => slug(S[x[C.sch]]) === sl && String(x[C.y]) + (x[C.cls] ? 'b' : '') === yk); const est = r && r[C.est];
      const rows = L.map(([w, name, rt, D, R, St]) => `<div class="scr"><span class="scw">${OT.wShort(SD.w[w])}</span>${name ? `<span class="scm">${esc(name)}</span><span class="scv" style="--tint:${OT.colorAt(Math.max(0.04, Math.min(1, (rt - 1500) / 700)))}">${rt}</span>${fin(D, 'D')}${fin(R, 'R')}${fin(St, 'S')}` : `<span class="scm scx0">${est ? 'not on file' : 'nobody entered'}</span><span></span><span></span><span></span><span></span>`}</div>`).join('');
      el.innerHTML = `<div class="scr scrh"><span>Wt</span><span>Wrestler</span><span title="Season rating; colour from 1500 (average state qualifier) to 2200">RTG</span><span>Dist</span><span>Reg</span><span>State</span></div>${rows}`
        + (est ? `<div class="sxn">This district's full field isn't on file for ${yk.replace('b', '')}: only wrestlers who reached regionals are shown, and each other weight counts as what that spot held for teams like this one in seasons that are on file.</div>` : '')
        + (r ? `<div class="sxn">Expected ${pct(r[C.exp])} · Cutoffs ${pct(r[C.cut])} against the ${SD.field} best · Strength ${r[C.str] || '–'}</div>` : '');
    };
    if (LU[c]) draw(LU[c]); else loadLineups(c).then(draw);
  }
  Object.assign(OT, { loadSeasons, seasonRankings, fillLineup, seasonsLoaded: () => !!SD });
})();
