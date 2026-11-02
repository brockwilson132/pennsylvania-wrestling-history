/* Charts. Rows are who, columns are time or weight, color is the medal. */
'use strict';

/* ---------- the mat: every season is a spoke, every lineup spot a ring, every cell the unit's medal ---------- */
function mat(h, unitRows, opts = {}) {
  const [a, b] = opts.years || yearsInScope();
  const years = d3.range(a, b + 1).filter((y) => seasonOf(y));
  const W = Math.min(widthOf(h), opts.max || 640), cx = W / 2, cy = W / 2, R = W / 2 - 22, r0 = R * 0.3;
  const gap = 0.16 * Math.PI, span = 2 * Math.PI - gap, step = span / years.length, a0 = gap / 2;
  const best = new Map(); unitRows.forEach((r) => { const k = r.year + '|' + r.slot; const c = best.get(k); if (!c || r.place < c.place) best.set(k, r); });
  const svg = svgIn(h, W, W, opts.label || 'The mat');
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  g.append('circle').attr('r', R + 8).attr('class', 'mat-rim');
  const cells = [];
  years.forEach((y, i) => { const L = seasonOf(y).lineup; const n = L.length || 1; L.forEach((o, s) => cells.push({ y, s, n, w: o.w, a: a0 + i * step, r: best.get(y + '|' + s) })); });
  const arc = d3.arc().innerRadius((c) => r0 + (R - r0) * c.s / c.n + 0.35).outerRadius((c) => r0 + (R - r0) * (c.s + 1) / c.n - 0.35).startAngle((c) => c.a + 0.0025).endAngle((c) => c.a + step - 0.0025);
  const cellSel = g.append('g').selectAll('path').data(cells).join('path').attr('d', arc).attr('class', (c) => (c.r ? 'mc on' : 'mc')).attr('fill', (c) => (c.r ? `url(#m${c.r.place})` : null));
  bindTip(cellSel, (c) => (c.r ? `<b>${c.y} · ${wLabel(c.w)}</b><div class="tl">${medal(c.r.place, 16)} ${esc(c.r.name)}</div><div class="t3">${esc(c.r.sch)}, ${ordinal(c.r.place)}</div>` : `<b>${c.y} · ${wLabel(c.w)}</b><div class="t3">${opts.emptyText || 'no medal'}</div>`));
  // decade labels
  years.forEach((y, i) => { if (y % 10 && y !== a) return; const ang = a0 + i * step + step / 2 - Math.PI / 2; g.append('text').attr('class', 'ax').attr('x', Math.cos(ang) * (R + 15)).attr('y', Math.sin(ang) * (R + 15) + 4).attr('text-anchor', 'middle').text(y); });
  // axis in the gap
  g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -r0).attr('y2', -R).attr('class', 'mat-axis');
  [['lightest', r0 + 10], ['heaviest', R - 4]].forEach(([t, r]) => g.append('text').attr('class', 'ax small').attr('x', 4).attr('y', -r + 3).text(t));
  const sel = g.append('path').attr('class', 'mat-sel');
  const hub = g.append('g');
  hub.append('circle').attr('r', r0 - 6).attr('class', 'mat-hub');
  const t1 = hub.append('text').attr('class', 'hub-y').attr('text-anchor', 'middle').attr('y', 4);
  const t2 = hub.append('text').attr('class', 'hub-s').attr('text-anchor', 'middle').attr('y', 22);
  const yearAt = (ev) => { const [x, y] = d3.pointer(ev, g.node()); const rr = Math.hypot(x, y); if (rr < r0 * 0.6 || rr > R + 10) return null; let ang = Math.atan2(y, x) + Math.PI / 2; if (ang < 0) ang += 2 * Math.PI; const i = Math.floor((ang - a0) / step); return i >= 0 && i < years.length ? years[i] : null; };
  svg.on('pointermove', (ev) => { if (ev.pointerType === 'touch') return; const y = yearAt(ev); if (opts.preview) opts.preview(y); }).on('pointerleave', () => opts.preview && opts.preview(null)).on('click', (ev) => { const y = yearAt(ev); if (y && opts.select) opts.select(y); });
  return {
    paint(year, sub) {
      const i = years.indexOf(year);
      sel.attr('d', i < 0 ? null : d3.arc()({ innerRadius: r0 - 2, outerRadius: R + 3, startAngle: a0 + i * step, endAngle: a0 + (i + 1) * step }));
      t1.text(year || ''); t2.text(sub || '');
    }
  };
}

/* ---------- a unit's seasons: bar height is its share of the season's points, color its team-race finish ---------- */
function seasonStrip(h, st, opts = {}) {
  const [a, b] = opts.years || yearsInScope();
  const W = widthOf(h), H = opts.H || 64, top = 6, bottom = 16;
  const x = d3.scaleBand(d3.range(a, b + 1), [0, W]).paddingInner(0.18);
  const max = d3.max(st.seasons, (s) => s.share) || 0.1;
  const y = d3.scaleLinear([0, max], [H - bottom, top]);
  const svg = svgIn(h, W, H, 'Points by season');
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', H - bottom + 0.5).attr('y2', H - bottom + 0.5).attr('class', 'base');
  const by = new Map(st.seasons.map((s) => [s.year, s]));
  const bars = svg.append('g').selectAll('rect').data(d3.range(a, b + 1)).join('rect').attr('x', (yy) => x(yy)).attr('width', x.bandwidth()).attr('y', (yy) => (by.get(yy) ? y(by.get(yy).share) : H - bottom - 1)).attr('height', (yy) => (by.get(yy) ? Math.max(1.5, H - bottom - y(by.get(yy).share)) : 1)).attr('fill', (yy) => { const s = by.get(yy); return !s ? '#2a2f35' : s.rank <= 8 ? metal(s.rank).mid : '#59616a'; }).style('cursor', 'pointer');
  bindTip(bars, (yy) => { const s = by.get(yy); return s ? `<b>${yy}</b><div class="tl">${s.rank <= 8 ? medal(s.rank, 16) : ''} ${ordinal(s.rank)} in the team race</div><div class="t3">${s.pts} points, ${pct0(s.share)} of the season</div>` : `<b>${yy}</b><div class="t3">no medals</div>`; });
  bars.on('click', (ev, yy) => opts.select && opts.select(yy));
  d3.range(Math.ceil(a / 10) * 10, b + 1, 10).forEach((yy) => svg.append('text').attr('class', 'ax').attr('x', x(yy) + x.bandwidth() / 2).attr('y', H - 3).attr('text-anchor', 'middle').text(yy));
  const mark = svg.append('rect').attr('class', 'strip-sel').attr('y', 0).attr('height', H - bottom + 2).attr('width', x.bandwidth() + 2);
  return { paint(yy) { mark.attr('x', x(yy) - 1).attr('opacity', x(yy) == null ? 0 : 1); } };
}

/* ---------- where on the scale: share of each weight class's points, split by medal ---------- */
const TIERS = [{ label: 'Titles', places: [1], color: '#d4a33a' }, { label: '2nd–3rd', places: [2, 3], color: '#c3cad1' }, { label: '4th–8th', places: [4, 5, 6, 7, 8], color: '#69717a' }];
const tierKey = () => `<span class="tiers">${TIERS.map((t) => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('')}<span><i class="line"></i>share overall</span></span>`;
function weightChart(h, ws, opts = {}) {
  const W = widthOf(h), H = opts.H || 220, left = opts.mini ? 4 : 34, right = opts.mini ? 4 : 8, top = opts.mini ? 14 : 22, bottom = opts.mini ? 16 : 24;
  const cs = ws.classes;
  const x = d3.scaleBand(cs.map((c) => c.c.k), [left, W - right]).paddingInner(opts.mini ? 0.16 : 0.22);
  const max = Math.max(ws.overall * 1.6, d3.max(cs, (c) => c.share) * 1.08) || 0.1;
  const y = d3.scaleLinear([0, max], [H - bottom, top]);
  const pf = max < 0.06 ? pct1 : pct0;
  const svg = svgIn(h, W, H, opts.label || 'Share of each weight class');
  if (!opts.mini) {
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('class', 'grid').attr('x1', left).attr('x2', W - right).attr('y1', y).attr('y2', y);
    svg.append('g').selectAll('text').data(y.ticks(4).filter((v) => v > 0 || true)).join('text').attr('class', 'ax').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(pf);
  }
  cs.forEach((c) => {
    let acc = 0;
    const g = svg.append('g').datum(c);
    if (opts.mini) g.append('rect').attr('x', x(c.c.k)).attr('width', x.bandwidth()).attr('y', y(c.share)).attr('height', Math.max(0, H - bottom - y(c.share))).attr('fill', c.share > ws.overall ? '#eceef0' : '#4b535b');
    else TIERS.forEach((t) => { const v = d3.sum(t.places, (p) => c.byPlace[p - 1]); if (!v) return; g.append('rect').attr('x', x(c.c.k)).attr('width', x.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v) - (acc ? 0.8 : 0))).attr('fill', t.color); acc += v; });
    g.append('rect').attr('x', x(c.c.k) - 1).attr('width', x.bandwidth() + 2).attr('y', top).attr('height', H - bottom - top).attr('fill', 'transparent');
    if (!opts.mini && x.bandwidth() > 20) svg.append('text').attr('class', 'val' + (c.share > ws.overall * 1.15 ? ' hi' : '')).attr('x', x(c.c.k) + x.bandwidth() / 2).attr('y', y(c.share) - 5).attr('text-anchor', 'middle').text(c.share ? pf(c.share) : '');
    bindTip(g, () => `<b>${c.c.label}${c.c.note ? ' <span class="t3">(' + c.c.note + ')</span>' : ''}</b><div class="tl">${pct1(c.share)} of the state’s points here</div><div class="t3">${pct1(ws.overall)} overall · ${c.rows.length ? shelf(c.places, { size: 14 }) : 'no medals'}</div>`);
  });
  // the overall share: a level line across the classes
  svg.append('line').attr('class', 'avg').attr('x1', left).attr('x2', W - right).attr('y1', y(ws.overall)).attr('y2', y(ws.overall));
  svg.append('text').attr('class', 'ax avg-t').attr('x', W - right).attr('y', y(ws.overall) - 4).attr('text-anchor', 'end').text(opts.mini ? pf(ws.overall) : `overall ${pf(ws.overall)}`);
  svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', H - bottom + 0.5).attr('y2', H - bottom + 0.5).attr('class', 'base');
  const labs = opts.mini ? cs.filter((c, i) => i === 0 || c.c.k === '145' || i === cs.length - 1) : cs;
  svg.append('g').selectAll('text').data(labs).join('text').attr('class', 'ax').attr('x', (c) => x(c.c.k) + x.bandwidth() / 2).attr('y', H - (opts.mini ? 3 : 7)).attr('text-anchor', 'middle').text((c) => c.c.label);
}

/* ---------- a season's team race, every school on one weight axis ---------- */
function raceBoard(S, opts = {}) {
  if (!S) return '<p class="empty">No results on record for this season.</p>';
  const L = S.lineup, n = L.length || 13, P = S.places;
  const axis = (d) => `<div class="rx-axis${d ? ' d' : ''}" style="--n:${n}"><span></span><div class="rx-cols">${d ? '<b></b>' : ''}${L.map((o) => `<b>${wShort(o.w)}</b>`).join('')}</div></div>`;
  const title = (r) => `${esc(r.name)}, ${esc(r.sch)}: ${wLabel(r.w)}, ${ordinal(r.place)}`;
  if (opts.mode === 'districts') {
    const list = S.dists.slice(0, opts.limit || 12);
    const grid = (t) => { const at = new Map(t.rows.map((r) => [r.slot + '|' + r.place, r])); return `<div class="rx-grid" style="--n:${n}">${d3.range(1, P + 1).map((p) => `${medal(p, 13)}${d3.range(n).map((i) => { const r = at.get(i + '|' + p); return r ? `<i title="${title(r)}">${chip(r.sch, 16)}</i>` : '<i class="nil"></i>'; }).join('')}`).join('')}</div>`; };
    return `${axis(true)}<ol class="race d">${list.map((t) => `<li><span class="rk">${t.rank}</span><span class="nm">${distLink(t.id, { mapW: 30 })}</span><span class="pts"><b>${t.pts}</b> pts</span><span class="mini">${shelf(t.places, { size: 14, compact: true })}</span>${grid(t)}</li>`).join('')}</ol>`;
  }
  const list = S.teams.filter(opts.filter || (() => true)).slice(0, opts.limit || 15);
  const strip = (t) => { const at = new Map(); t.rows.forEach((r) => { if (!at.has(r.slot) || r.place < at.get(r.slot).place) at.set(r.slot, r); }); return `<div class="rx-strip" style="--n:${n}">${d3.range(n).map((i) => { const r = at.get(i); return r ? `<i title="${title(r)}">${medal(r.place, 18)}</i>` : '<i class="nil"></i>'; }).join('')}</div>`; };
  return `${axis(false)}<ol class="race">${list.map((t) => `<li class="${opts.hl && opts.hl === t.id ? 'hl' : ''}"><span class="rk">${t.rank}</span><span class="nm">${schoolLink(t.id, 20)}</span><span class="pts"><b>${t.pts}</b> pts</span>${strip(t)}</li>`).join('')}</ol>`;
}

/* ---------- Pennsylvania by district: shade is the chosen score, label is the district ---------- */
function stateMap(h, vals, opts = {}) {
  const W = Math.min(widthOf(h), opts.max || 760), H = W * MAP.h / MAP.w, k = W / MAP.w;
  const max = d3.max(Object.values(vals)) || 1;
  const tone = (v) => d3.interpolateRgb('#262b30', '#eceef0')(Math.pow((v || 0) / max, 0.7));
  const svg = svgIn(h, W, H, opts.label || 'Pennsylvania by district');
  const g = svg.append('g').attr('transform', `scale(${k})`);
  g.append('path').attr('d', MAP.outline).attr('fill', '#1e2226');
  const ds = d3.range(1, 13);
  const shapes = g.append('g').selectAll('path').data(ds.filter((d) => MAP.d[d])).join('path').attr('d', (d) => MAP.d[d]).attr('fill', (d) => tone(vals[d])).attr('stroke', '#131416').attr('stroke-width', 0.35).attr('class', 'pa-dist');
  const dots = g.append('g').selectAll('circle').data([8, 12]).join('circle').attr('cx', (d) => MAP.dot[d][0]).attr('cy', (d) => MAP.dot[d][1]).attr('r', 2.6).attr('fill', (d) => tone(vals[d])).attr('stroke', '#131416').attr('stroke-width', 0.5).attr('class', 'pa-dist');
  const off = { 7: [0, 7], 8: [6, -1.5], 12: [5, 3.2], 1: [-2.5, -1], 5: [0, 1] };
  const lab = g.append('g').selectAll('g').data(ds).join('g').attr('transform', (d) => { const [x, y] = MAP.dot[d], o = off[d] || [0, 0]; return `translate(${x + o[0]},${y + o[1]})`; }).style('pointer-events', 'none');
  lab.append('text').attr('class', 'pa-lab').attr('text-anchor', 'middle').attr('dy', '.35em').attr('font-size', W < 500 ? 3.6 : 3).attr('fill', (d) => ((vals[d] || 0) / max > 0.45 && (!off[d] || d === 7) ? '#131416' : '#eceef0')).text((d) => 'D' + d);
  const all = shapes.merge(dots);
  all.style('cursor', 'pointer').on('click', (ev, d) => opts.select && opts.select(d));
  bindTip(all, (d) => `<b>District ${d} · ${esc(DISTRICTS[d].short)}</b><div class="t3">${opts.tipText ? opts.tipText(d) : ''}</div>`);
  return { paint(sel) { all.attr('stroke', (d) => (d === sel ? '#eceef0' : '#131416')).attr('stroke-width', (d) => (d === sel ? 0.9 : d === 8 || d === 12 ? 0.5 : 0.35)); all.filter((d) => d === sel).raise(); } };
}
