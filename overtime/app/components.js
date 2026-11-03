/* Overtime — shared components. Every level page is built from the same pieces. */
'use strict';
(() => {
  const { esc, fmt, ordinal, wShort, state, setCls, clsName, STD, stdOf, placeCounts, unitStats, rankings, allTimeTeams, bracketOf, seasonsInScope, unitRows, GRADE_L, gradeSlot, lowerRows, REGIONS, DISTRICTS, windowLabel, yearsWindow } = OT;
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
  /* time window: all-time, last 5 / 10 / 25 seasons, or a custom range */
  const windowToggle = () => { const w = state.win, [a, b] = yearsWindow();
    return `<div class="win"><div class="seg sm" role="group" aria-label="Seasons">${[['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25'], ['custom', 'Custom']].map(([k, l]) => `<button data-win="${k}" aria-pressed="${w.mode === k}">${l}</button>`).join('')}</div>${w.mode === 'custom' ? `<form class="wrange" data-wrange><input type="number" name="from" inputmode="numeric" min="1938" max="2026" value="${a}" aria-label="From"><span>–</span><input type="number" name="to" inputmode="numeric" min="1938" max="2026" value="${b}" aria-label="To"><button type="submit" class="go">Go</button></form>` : ''}</div>`; };
  const scopeBar = () => `<div class="scope">${classToggle()}${windowToggle()}</div>`;

  /* unit header + hero numbers */
  function unitHeader(u, o, extra = {}) {
    const hero = extra.hero || [['Medals', o.medals], ['Titles', o.titles], ['Qualifiers', o.quals], u.kind === 'school' ? ['Team titles', o.won] : ['Reg. titles', o.regTitles]];
    return `<header class="uh">
      <div><h1>${esc(u.name)}</h1><div class="sub"><b class="gold">${clsName()} · ${windowLabel()}</b>${extra.sub ? ` · ${extra.sub}` : ''}</div></div>${scopeBar()}
      <div class="hero">${hero.map(([l, v]) => `<div><b>${v == null ? '–' : fmt(v)}</b><span>${l}</span></div>`).join('')}</div>
    </header>`;
  }
  const section = (title, body, right = '') => `<section class="sec"><div class="k"><span>${title}</span>${right ? `<span>${right}</span>` : ''}</div>${body}</section>`;
  const empty = (msg) => `<div class="card empty">${msg}</div>`;

  /* the Bracket: every child unit is one line, seeded by state points, converging toward Hershey. Same component at every level. */
  function bracket(u, crumbs = [], mode, showAll) {
    const { items } = bracketOf(u, mode);
    const crumbBar = `<div class="fcrumb">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.name)}</a><span>›</span>` : `<b>${esc(c.name)}</b>`)).join('')}</div>`;
    const toggle = u.kind === 'state' ? `<div class="seg sm" data-bracket="1"><button data-mode="region" aria-pressed="${mode !== 'district'}">Regions</button><button data-mode="district" aria-pressed="${mode === 'district'}">Districts</button></div>`
      : u.kind === 'school' ? `<div class="seg sm" data-bracket="1"><button data-mode="wrestler" aria-pressed="${mode !== 'weight'}">Wrestlers</button><button data-mode="weight" aria-pressed="${mode === 'weight'}">Weights</button></div>` : '';
    if (!items.length) return crumbBar + empty('No placements in ' + clsName().toLowerCase() + ' for ' + windowLabel() + '.');
    const LIM = 16, show = showAll || items.length <= LIM ? items : items.slice(0, LIM), n = show.length;
    const phone = (window.innerWidth || 390) < 720, RH = phone ? 44 : 40, BW = phone ? 64 : 120, H = n * RH, maxShare = show[0].share || 1;
    // bracket joins: pair consecutive lines round by round until one line reaches Hershey
    const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, n)))), step = (BW - 22) / rounds;
    let ys = show.map((_, i) => i * RH + RH / 2), paths = [];
    for (let k = 0; k < rounds; k++) {
      const x0 = k * step, x1 = (k + 1) * step, next = [];
      for (let i = 0; i < ys.length; i += 2) {
        const a = ys[i], b = ys[i + 1];
        if (b == null) { paths.push(`M${x0} ${a} H${x1}`); next.push(a); continue; }
        const m = (a + b) / 2; paths.push(`M${x0} ${a} H${x1} V${b} H${x0}`); paths.push(`M${x1} ${m} H${x1 + 0.01}`); next.push(m);
      }
      ys = next;
    }
    const fy = ys[0], fx = rounds * step; paths.push(`M${fx} ${fy} H${BW - 20}`);
    const hershey = `<circle cx="${BW - 10}" cy="${fy}" r="7.5" fill="none" stroke="${C.chalk}" stroke-width="2.4"/><circle cx="${BW - 10}" cy="${fy}" r="2.4" fill="${C.red}"/>`;
    const label = `<text transform="translate(${BW - 22} ${Math.min(H - 60, fy + 14)}) rotate(90)" text-anchor="start" font-family="Barlow Condensed" font-weight="700" font-size="10" letter-spacing="2" fill="${C.ash}">HERSHEY</text>`;
    const svg = `<svg class="bj" width="${BW}" height="${H}" viewBox="0 0 ${BW} ${H}" aria-hidden="true"><path d="${paths.join(' ')}" fill="none" stroke="${C.ash}" stroke-width="1" opacity=".8"/>${hershey}${phone ? '' : label}</svg>`;
    const rowsHtml = show.map((it, i) => { const tag = it.href ? 'a' : 'div'; const sh = it.share >= 0.1 ? (100 * it.share).toFixed(0) + '%' : (100 * it.share).toFixed(1) + '%';
      return `<${tag} class="bl" ${it.href ? `href="${it.href}" data-bl="1"` : ''} style="height:${RH}px"><span class="sd${i === 0 ? ' s1' : ''}">${it.seed}</span><span class="nm"><b>${esc(it.name)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span><span class="br"><i style="width:${Math.max(3, 100 * it.share / maxShare)}%"></i></span><span class="sh">${sh}</span></${tag}>`; }).join('');
    const more = items.length > LIM ? `<button class="more" data-bracket-all="${showAll ? '0' : '1'}">${showAll ? 'Show top 16' : `Show all ${items.length}`}</button>` : '';
    return `${crumbBar}<div class="bracket card"><div class="bls">${rowsHtml}</div>${svg}</div>
      <div class="fcap"><span>Seeded by state points · follow a line toward Hershey</span><span class="fright">${more}${toggle}</span></div>`;
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
      <div class="note">Era: share of all state points, summed across every season (×100). Power: the same with a 7-season half-life. Score: placement points, 16-12-9-7-5-3-2-1. A school's seasons in the other class count at 85%. Window: ${windowLabel()}.</div>`;
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

  Object.assign(OT, { C, MED, pc, score, wordmark, navIcon, classToggle, windowToggle, scopeBar, unitHeader, section, empty, bracket, rankTable, wrestlerRank, teamsBlock, seasonsDrawer, lowerBlock, chips, careerGrid, road });
})();
