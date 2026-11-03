/* Overtime — shared components. Every level page is built from the same pieces. */
'use strict';
(() => {
  const { esc, fmt, ordinal, wShort, state, setCls, clsName, STD, stdOf, placeCounts, unitStats, rankings, allTimeTeams, hierarchyOf, seasonsInScope, unitRows, GRADE_L, gradeSlot, lowerRows, REGIONS, DISTRICTS } = OT;
  const MAP = window.PA_MAP, HX = 65.5, HY = 39.5; // Hershey
  const C = { mat: '#0B0D10', chalk: '#EEEAE1', ash: '#8E98A4', gold: '#D9A441', red: '#FF3B2F', green: '#2EC27E', slate: '#161A20', line: '#242A32' };
  const MED = ['#D9A441', '#B8BFC6', '#B5733A', '#8E5A3C', '#5F6B78', '#5F6B78', '#5F6B78', '#5F6B78'];
  const pc = (p) => (p >= 5 ? 'c5' : 'c' + p);
  const score = (v) => (v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1));

  /* brand */
  const wordmark = () => { const F = 92, R = F * 0.36, cx = 14 + R, cy = 120, a = 35 * Math.PI / 180;
    return `<svg viewBox="0 0 560 170" aria-label="Overtime"><rect x="${cx - R * .16}" y="${cy - R - R * .30}" width="${R * .32}" height="${R * .22}" rx="3" fill="currentColor"/><rect x="${cx - R * .09}" y="${cy - R - R * .12}" width="${R * .18}" height="${R * .14}" fill="currentColor"/><circle cx="${cx}" cy="${cy}" r="${R * .88}" fill="none" stroke="currentColor" stroke-width="${R * .24}"/><path d="M ${cx} ${cy - R * .62} A ${R * .62} ${R * .62} 0 0 1 ${cx + R * .62 * Math.sin(a)} ${cy - R * .62 * Math.cos(a)} L ${cx} ${cy} Z" fill="${C.red}"/><line x1="${cx}" y1="${cy}" x2="${cx + R * .55 * Math.sin(a)}" y2="${cy - R * .55 * Math.cos(a)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/><text x="${cx + R + F * .09}" y="${cy + F * .355}" font-family="'Archivo Black'" font-size="${F}" letter-spacing="-1" fill="currentColor">VERTIME</text></svg>`; };
  const NAVI = {
    state: `<path d="${MAP.outline}" transform="translate(1,4) scale(.245)" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`,
    region: `<path d="M3 13 L13 3 L23 13 L13 23 Z M3 13 H23 M13 3 V23" fill="none" stroke="currentColor" stroke-width="2"/>`,
    district: `<rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="15" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="15" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="15" y="15" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/>`,
    school: `<path d="M3 23 V11 L13 4 L23 11 V23 Z M10 23 V15 H16 V23" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    wrestlers: `<circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13 L13 6 M13 13 L17.5 15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const navIcon = (k) => `<svg viewBox="0 0 26 26" aria-hidden="true">${NAVI[k]}</svg>`;
  const classToggle = (small) => `<div class="seg${small ? ' sm' : ''}" role="group" aria-label="Class">${['AAA', 'AA', 'ALL'].map((c) => `<button data-cls="${c}" aria-pressed="${state.cls === c}">${c === 'ALL' ? 'All' : c}</button>`).join('')}</div>`;

  /* unit header + hero numbers */
  function unitHeader(u, o, extra = {}) {
    const hero = extra.hero || [['Medals', o.medals], ['Titles', o.titles], ['Qualifiers', o.quals], u.kind === 'school' ? ['Team titles', o.won] : ['Reg. titles', o.regTitles]];
    return `<header class="uh">
      <div style="display:flex;justify-content:space-between;align-items:end;gap:10px;flex-wrap:wrap"><div><h1>${esc(u.name)}</h1>${extra.sub ? `<div class="sub">${extra.sub}</div>` : ''}</div>${classToggle()}</div>
      <div class="hero">${hero.map(([l, v]) => `<div><b>${v == null ? '–' : fmt(v)}</b><span>${l}</span></div>`).join('')}</div>
    </header>`;
  }
  const section = (title, body, right = '') => `<section class="sec"><div class="k"><span>${title}</span>${right ? `<span>${right}</span>` : ''}</div>${body}</section>`;
  const empty = (msg) => `<div class="card empty">${msg}</div>`;

  /* the Floor: every unit is a mat sized by its (discounted) state points; the same component at every level */
  function floor(u, crumbs = [], mode) {
    const H = hierarchyOf(u, mode);
    const W = Math.min((window.innerWidth || 390) - 32, 1100), HT = W < 720 ? 300 : 380;
    const crumbBar = `<div class="fcrumb">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.name)}</a><span>›</span>` : `<b>${esc(c.name)}</b>`)).join('')}</div>`;
    if (!H.children || !H.children.length) return crumbBar + empty('No placements in ' + clsName().toLowerCase() + ' yet.');
    const root = d3.hierarchy(H).sum((d) => (d.children ? 0 : d.pts)).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, HT]).paddingOuter(0).paddingInner(3).paddingTop((d) => (d.depth === 1 && d.children ? 0 : 0)).round(true)(root);
    const top = root.children, n = top.length, total = root.value;
    const ramp = d3.interpolateRgb(C.chalk, '#2A313A');
    const href = (d) => (d.data.kind && OT.unitByKind[d.data.kind] && d.data.id != null ? OT.unitByKind[d.data.kind](d.data.id).href : null);
    const tiles = top.map((d, i) => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0, t = n > 1 ? Math.pow(i / (n - 1), 0.7) : 0, bg = ramp(t), dark = t > 0.5;
      const share = (100 * d.value / total), sh = share >= 10 ? share.toFixed(0) + '%' : share.toFixed(1) + '%';
      const pl = d.data.places || [0, 0, 0, 0];
      const big = w >= 112 && h >= 82, mid = w >= 60 && h >= 44, small = w >= 34 && h >= 20; const medc = (k) => (dark ? MED[k] : ['#8A6410', '#5F6B78', '#8F4F1E', '#6E4330'][k]);
      const label = big ? `<b>${esc(d.data.name)}</b><span class="sh">${sh}</span><span class="pl">${pl.slice(0, 4).map((c, k) => c ? `<i style="color:${medc(k)}">${c}</i>` : '').join('')}</span>`
        : mid ? `<b>${esc(d.data.name)}</b><span class="sh">${sh}</span>` : small ? `<b>${esc(d.data.name)}</b>` : '';
      const subs = d.children ? d.children.map((c) => `<i class="sub" style="left:${c.x0 - d.x0}px;top:${c.y0 - d.y0}px;width:${Math.max(0, c.x1 - c.x0)}px;height:${Math.max(0, c.y1 - c.y0)}px"></i>`).join('') : '';
      const h2 = href(d);
      return `<div class="tile${dark ? ' dk' : ''}${big ? ' big' : mid ? ' mid' : small ? ' sm' : ' xs'}" style="left:${d.x0}px;top:${d.y0}px;width:${w}px;height:${h}px;background:${bg}" ${h2 ? `data-href="${h2}" role="link" tabindex="0"` : ''} title="${esc(d.data.name)} · ${fmt(Math.round(d.value))} pts · ${sh}${d.data.titles ? ' · ' + d.data.titles + ' titles' : ''}">${subs}${label}</div>`;
    }).join('');
    const toggle = u.kind === 'state' ? `<div class="seg sm" data-floor="1"><button data-mode="region" aria-pressed="${mode !== 'district'}">Regions</button><button data-mode="district" aria-pressed="${mode === 'district'}">Districts</button></div>` : '';
    return `${crumbBar}<div class="floor card" style="height:${HT}px"><div class="fl" style="width:${W}px;height:${HT}px">${tiles}</div></div>
      <div class="fcap"><span>Share of state points · tap a mat to go there</span>${toggle}</div>`;
  }

  /* rankings table */
  const COLS = ['Rank', 'Name', 'Era', 'Power', 'Score', 'Medals', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  function rankTable(rows, opts = {}) {
    if (!rows.length) return empty(opts.emptyMsg || 'Nothing here in ' + clsName().toLowerCase() + '.');
    const lim = opts.limit || 25;
    const body = rows.slice(0, lim).map((o, i) => { const u = o.u || o; const name = opts.name ? opts.name(o) : esc(u.name); let sub = opts.sub ? opts.sub(o) : ''; if (o.offMedals) sub += `${sub ? ' · ' : ''}incl. ${o.offMedals} ${o.offCls} medal${o.offMedals === 1 ? '' : 's'} at ${Math.round(100 * o.offClass)}%`;
      return `<tr><td class="rk sticky1">${i + 1}</td><td class="l sticky2"><a href="${u.href || o.href}">${name}</a>${sub ? `<small class="muted"> ${sub}</small>` : ''}</td><td class="num">${score(o.era)}</td><td class="num">${score(o.power)}</td><td class="num">${fmt(o.pts)}</td><td class="num">${fmt(o.medals)}</td>${o.places.map((n, k) => `<td class="num p${n ? Math.min(k + 1, 5) : 0}">${n || '·'}</td>`).join('')}</tr>`; }).join('');
    const more = rows.length > lim ? `<div class="note">Showing ${lim} of ${rows.length}. ${opts.moreHref ? `<a href="${opts.moreHref}">See all</a>` : ''}</div>` : '';
    return `<div class="tw"><table><thead><tr>${COLS.map((c, i) => `<th class="${i < 2 ? 'l ' : ''}${i === 0 ? 'sticky1' : i === 1 ? 'sticky2' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>${more}
      <div class="note">Era: share of all state points, summed across every season (×100). Power: the same with a 7-season half-life. Score: placement points, 16-12-9-7-5-3-2-1. A school's seasons in the other class count at 85%.</div>`;
  }
  /* wrestler rows as rankings (Score, Medals, places); Era/Power shown as career share */
  function wrestlerRank(rows, opts = {}) {
    const ws = OT.wrestlersOf(rows.filter((r) => r.place)); if (!ws.length) return empty('No placewinners in ' + clsName().toLowerCase() + '.');
    const tot = d3.sum(seasonsInScope(), (S) => S.avail) || 1;
    const [, last] = OT.yearsInScope();
    const list = ws.map((w) => ({ ...w, u: { name: w.name, href: w.href }, era: 100 * w.pts / tot * 100, power: 100 * d3.sum(w.rows, (r) => r.pts * Math.pow(0.5, (last - r.year) / 7)) / tot * 100 })).sort((a, b) => b.pts - a.pts || b.titles - a.titles);
    return rankTable(list, { limit: opts.limit || 25, sub: (o) => (opts.school ? '' : esc(o.sch)) + ' ' + o.years, moreHref: opts.moreHref });
  }

  /* all-time teams */
  function teamsBlock(rows) {
    const T = allTimeTeams(rows.filter((r) => r.place), 3); if (!T.length) return empty('No placewinners yet.');
    return `<div class="teams"><div class="thead"><span></span><span>1ST TEAM</span><span>2ND TEAM</span><span>3RD TEAM</span></div>${T.map(({ c, slots }) => `<div class="trow"><div class="w">${c.label}</div>${slots.map((s, i) => s ? `<a class="slot t${i + 1}" href="${s.href}"><b>${esc(s.name)}</b><small>${esc(s.sch)} · ${s.years}</small><span class="pl">${s.rows.map((r) => `<i style="background:${MED[r.place - 1]}" title="${ordinal(r.place)} ${r.year}"></i>`).join('')}</span></a>` : '<div class="slot none"></div>').join('')}</div>`).join('')}</div>
      <div class="note">Best career at each weight by placement points. A wrestler can hold a slot at every weight he placed at, but never two slots on the same team.</div>`;
  }

  /* seasons drawer */
  function seasonsDrawer(u) {
    const S = seasonsInScope().map((s) => ({ S: s, t: u.kind === 'state' ? { pts: s.avail, titles: s.lineup.length, n: s.meds.length, rows: s.rows, score: null } : s.by[u.kind].get(u.id) })).filter((x) => x.t).reverse();
    if (!S.length) return empty('No seasons in scope.');
    const rows = S.map(({ S: s, t }) => {
      const champ = s.champion; const label = u.kind === 'school' ? (t.realRank ? ordinal(t.realRank) + ' as a team' : ordinal(t.rank) + ' by points') : u.kind === 'state' ? (champ ? esc(champ.id) + (s.real ? ` ${champ.score}` : '') : '') : (t.rows[0] ? esc(t.rows.filter((r) => r.place === 1).map((r) => r.name).slice(0, 2).join(', ')) || '–' : '–');
      const n = `${t.n || 0} medal${t.n === 1 ? '' : 's'}${t.titles ? ` · ${t.titles} title${t.titles === 1 ? '' : 's'}` : ''}`;
      const pod = t.rows.filter((r) => r.place).sort((a, b) => a.slot - b.slot || a.place - b.place);
      const byW = d3.groups(pod, (r) => r.w);
      const podium = `<div class="podium" hidden>${byW.map(([w, rs]) => `<div class="prow"><div class="w">${wShort(w)}</div><div class="ps">${rs.map((r) => `<span><i style="color:${MED[r.place - 1]}">${ordinal(r.place)}</i> <a href="${OT.wrestlerHref(r)}" style="text-decoration:none">${esc(r.name)}</a>${u.kind === 'school' ? '' : ` <span class="muted">${esc(r.sch)}</span>`}</span>`).join('')}</div></div>`).join('') || '<div class="muted">No medals this season.</div>'}</div>`;
      return `<div class="srow" role="button" tabindex="0" aria-expanded="false"><span class="y">${s.year}</span><span class="c">${label}</span><span class="n">${n}</span></div>${podium}`;
    }).join('');
    const first = S[S.length - 1].S.year, last = S[0].S.year;
    return `<details class="drawer"><summary><span><b class="num" style="font-size:20px">${S.length}</b> <span class="muted">seasons · ${first}–${last}</span></span><span class="k">Open</span></summary><div class="body">${rows}</div></details>`;
  }

  /* lower-level dominance (district / regional brackets) */
  function lowerBlock(u, lvl) {
    const rows = lowerRows(lvl).filter((r) => (state.cls === 'ALL' || r.cls === state.cls) && (u.kind === 'district' ? r.d === u.id : u.kind === 'region' ? r.region === u.id : r.sch === u.id));
    const title = lvl === 'district' ? 'District results' : 'Regional results';
    if (!rows.length) return section(title, empty(`${title} are being collected from the bracket archive. This block will rank the same way as the state block, from ${lvl} brackets only, and nothing here mixes with state numbers.`));
    const ws = OT.wrestlersOf(rows);
    return section(title, rankTable(ws.map((w) => ({ ...w, u: { name: w.name, href: w.href }, era: 0, power: 0 })), { limit: 15 }));
  }

  /* medal chips */
  const chips = (places) => places.map((n, i) => n ? `<span class="chip ${pc(i + 1)}" title="${n} × ${ordinal(i + 1)}">${n}×${i + 1}</span>` : '').join('');

  /* career grid */
  function careerGrid(W) {
    const apps = W.apps; const levels = [['district', 'District'], ['regional', 'Regional'], ['state', 'State']];
    const cell = (lvl, g) => {
      if (lvl === 'state') { const r = apps.find((a) => gradeSlot(a, apps) === g); if (!r) return `<div class="cell"></div>`; return r.place ? `<div class="cell ${pc(r.place)}" title="${r.year} · ${wShort(r.w)}">${r.place}</div>` : `<div class="cell cq" title="${r.year} qualifier">Q</div>`; }
      const low = lowerRows(lvl).filter((a) => OT.wKey(a) === OT.wKey(apps[0])); const r = low.find((a) => apps.some((s) => gradeSlot(s, apps) === g && s.year === a.year));
      if (r) return r.place ? `<div class="cell ${pc(r.place)}">${r.place}</div>` : `<div class="cell cq">Q</div>`;
      // state seed = regional place from 1951, district place before
      const s = apps.find((a) => gradeSlot(a, apps) === g); if (s && lvl === 'regional' && s.year >= 1951 && s.reg) return `<div class="cell ${pc(s.reg)}" title="Regional place, from the state seed">${s.reg}</div>`;
      if (s && lvl === 'district' && s.year < 1951 && s.dist) return `<div class="cell ${pc(s.dist)}" title="District place, from the state seed">${s.dist}</div>`;
      if (s && lvl === 'district' && s.year >= 1951) return `<div class="cell pend" title="District bracket not loaded yet">Q</div>`;
      return `<div class="cell"></div>`;
    };
    return `<div class="cg"><div></div>${GRADE_L.map((g) => `<div class="k h">${g}</div>`).join('')}${levels.map(([k, l]) => `<div class="k lab">${l}</div>${[0, 1, 2, 3].map((g) => cell(k, g)).join('')}`).join('')}</div>
      <div class="note">District and regional rows fill in from the bracket archive; until then the regional cell shows the state seed (the regional place since 1951) and a dashed Q marks a district qualification we know happened but have not loaded.</div>`;
  }

  /* road to Hershey: one season as a line across the state */
  function road(r, W) {
    const s = 3, X = 6, Y = 10; const P = (x, y) => [X + x * s, Y + y * s];
    const d0 = MAP.dot[r.d] || [30, 30]; const [dx, dy] = P(d0[0], d0[1]), [hx, hy] = P(HX, HY);
    const rx = dx + (hx - dx) * 0.5, ry = Math.min(dy, hy) - 14;
    const placed = !!r.place, reg = r.reg;
    return `<svg viewBox="0 0 320 190" role="img" aria-label="${r.year} road to Hershey"><g transform="translate(${X},${Y}) scale(${s})"><path d="${MAP.outline}" fill="${C.slate}" stroke="${C.ash}" stroke-width=".45" stroke-linejoin="round"/></g>
      <path d="M${dx} ${dy} Q ${(dx + rx) / 2} ${dy + 6} ${rx} ${ry}" fill="none" stroke="${C.gold}" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
      <path d="M${rx} ${ry} Q ${(rx + hx) / 2} ${ry - 10} ${hx} ${hy}" fill="none" stroke="${C.gold}" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="${dx}" cy="${dy}" r="7" fill="${C.mat}" stroke="${C.gold}" stroke-width="2.5"/>
      <circle cx="${rx}" cy="${ry}" r="7" fill="${reg ? C.gold : C.mat}" stroke="${C.gold}" stroke-width="2.5"/>${reg ? `<text x="${rx}" y="${ry + 4}" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="10" fill="${C.mat}">${reg}</text>` : ''}
      <circle cx="${hx}" cy="${hy}" r="15" fill="${C.gold}"/><circle cx="${hx}" cy="${hy}" r="10" fill="${C.mat}"/><circle cx="${hx}" cy="${hy}" r="6" fill="${placed ? MED[r.place - 1] : C.red}"/>${placed ? `<text x="${hx}" y="${hy + 3.6}" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="9" fill="${C.mat}">${r.place}</text>` : ''}
      <g font-family="Barlow Condensed" font-weight="700" font-size="11" letter-spacing="1.5" fill="${C.ash}"><text x="${dx}" y="${dy + 22}" text-anchor="middle">D${r.d}</text><text x="${rx}" y="${ry - 12}" text-anchor="middle">${r.region ? r.region + ' REGION' : 'REGIONAL'}</text><text x="${hx}" y="${hy + 30}" text-anchor="middle" fill="${C.chalk}">HERSHEY · ${placed ? ordinal(r.place).toUpperCase() : 'QUALIFIER'}</text></g>
      </svg>`;
  }

  Object.assign(OT, { C, MED, pc, score, wordmark, navIcon, classToggle, unitHeader, section, empty, floor, rankTable, wrestlerRank, teamsBlock, seasonsDrawer, lowerBlock, chips, careerGrid, road });
})();
