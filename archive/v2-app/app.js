/* PA Wrestling Almanac. Every view reads the class switch: AAA, AA, or the single-class era. */
(function () {
'use strict';
const RAW = window.WR_DATA;
const SB = window.SchoolBadge;
const LG = window.Logos;
const $view = document.getElementById('view');
const $tip = document.getElementById('tip');

/* ================================================================ data */
const wNum = (w) => (w === 'UNL' ? 999 : +w);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const fmt = d3.format(',');
const pct0 = d3.format('.0%');
const pct1 = d3.format('.1%');
const decadeOf = (y) => Math.floor(y / 10) * 10;
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const canon = (s) => { const id = SB && SB.identity(s); return id ? id.school : s; };

const CH = RAW.champs.map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), name, school, sch: canon(school), d }));
d3.group(CH, (r) => r.year + r.cls).forEach((rs) => rs.sort((a, b) => a.wn - b.wn).forEach((r, i) => { r.slot = i; r.rel = rs.length > 1 ? i / (rs.length - 1) : 0.5; }));
const DIST = RAW.dist.map(([year, cls, d, champs, finalists, medalists, qualifiers]) => ({ year, cls, d, champs, finalists, medalists, qualifiers }));
const TEAMS = RAW.teams.map(([year, type, school, d, runner, tie]) => ({ year, type, school, sch: canon(school), d, runner, tie }));
const D11 = RAW.d11.map(([year, w, name, school]) => ({ year, w, wn: wNum(w), name, school, sch: canon(school) }));
d3.group(D11, (r) => r.year).forEach((rs) => rs.sort((a, b) => a.wn - b.wn).forEach((r, i) => { r.slot = i; r.rel = rs.length > 1 ? i / (rs.length - 1) : 0.5; }));
const REG = RAW.reg.map(([year, w, name, school, d]) => ({ year, w, name, school, d }));
const ALL_YEARS = d3.extent(CH, (r) => r.year);

/* lineage: the class a school wrestled in after the 1974 split (most titles; ties go to the latest) */
const LINEAGE = new Map();
d3.groups(CH.filter((r) => r.cls !== 'single'), (r) => r.sch).forEach(([s, rs]) => {
  const c = d3.rollups(rs, (v) => ({ n: v.length, last: d3.max(v, (r) => r.year) }), (r) => r.cls).sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last);
  LINEAGE.set(s, c[0][0]);
});

const DISTRICTS = {
  1: 'Philadelphia suburbs', 2: 'Wyoming Valley and Scranton', 3: 'South Central', 4: 'North Central',
  5: 'Bedford and Somerset', 6: 'Central', 7: 'WPIAL, Pittsburgh area', 8: 'Pittsburgh City League',
  9: 'Northwest Central', 10: 'Northwest (Erie)', 11: 'Lehigh Valley, Poconos and Schuylkill', 12: 'Philadelphia'
};
const COLORED = [7, 11, 6, 4, 3, 10];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dColor = (d) => (COLORED.includes(+d) ? css('--d' + d) : css('--other'));
const sColor = (school) => { if (SB && SB.identity(school)) return SB.colorFor(school, 'light'); if (LG && LG.has(school)) { const c = LG.colorsOf(school).field; return LG.lum(c) > 0.7 || LG.lum(c) < 0.02 ? css('--other') : c; } return css('--other'); };

/* ================================================================ class scope */
const state = { cls: 'AAA', withSingle: false, focus: null, q: '', d11focus: null, d11q: '' };
try { const s = JSON.parse(localStorage.getItem('pawa-scope') || 'null'); if (s && ['AAA', 'AA', 'single'].includes(s.cls)) { state.cls = s.cls; state.withSingle = !!s.withSingle; } } catch (e) { /* storage unavailable */ }
const saveScope = () => { try { localStorage.setItem('pawa-scope', JSON.stringify({ cls: state.cls, withSingle: state.withSingle })); } catch (e) { /* ignore */ } };

const inScope = (r) => {
  if (state.cls === 'single') return r.cls === 'single';
  if (r.cls === state.cls) return true;
  return state.withSingle && r.cls === 'single' && LINEAGE.get(r.sch) === state.cls;
};
const SC = () => CH.filter(inScope);
const usesEra = () => state.cls !== 'single' && state.withSingle;
const clsName = () => (state.cls === 'single' ? 'single-class' : 'Class ' + state.cls);
const clsLong = () => (state.cls === 'single' ? 'the single-class era (1938–1973)' : `Class ${state.cls}${usesEra() ? ` (with 1938–73 titles of schools that later wrestled ${state.cls})` : ' (1974–present)'}`);
const yearsOf = (rows) => d3.extent(rows, (r) => r.year);
const clsTag = (r) => (r.cls === 'single' ? '1938–73 single class' : 'Class ' + r.cls);

/* schools */
const SCHOOL_BY_SLUG = new Map();
const SCHOOLS = [];
const addSchool = (s) => { const o = { school: s, slug: slug(s), rows: [], d: null }; SCHOOLS.push(o); SCHOOL_BY_SLUG.set(o.slug, o); return o; };
d3.groups(CH, (r) => r.sch).forEach(([s, rs]) => { const o = addSchool(s); o.rows = rs; });
new Set(D11.map((r) => r.sch)).forEach((s) => { if (!SCHOOL_BY_SLUG.has(slug(s))) addSchool(s).d = 11; });
SCHOOLS.forEach((o) => {
  if (o.rows.length) o.d = d3.rollups(o.rows, (v) => v.length, (r) => r.d).sort((a, b) => b[1] - a[1])[0][0];
  o.aaa = o.rows.filter((r) => r.cls === 'AAA').length; o.aa = o.rows.filter((r) => r.cls === 'AA').length; o.single = o.rows.filter((r) => r.cls === 'single').length;
  o.lineage = LINEAGE.get(o.school) || null;
});
const schoolHref = (s) => '#school-' + slug(canon(s));
const medalsFor = (s) => { const m = RAW.medals; if (m[s] != null) return m[s]; const o = SCHOOL_BY_SLUG.get(slug(s)); if (!o) return null; for (const r of o.rows) if (m[r.school] != null) return m[r.school]; return null; };

/* multi-time champions within the current scope (same name, same district) */
const wrestlersOf = (rows) => d3.groups(rows, (r) => nkey(r.name) + '|' + r.d).map(([, rs]) => {
  rs.sort((a, b) => a.year - b.year);
  return { name: rs[rs.length - 1].name, school: rs[rs.length - 1].school, d: rs[0].d, n: rs.length, rows: rs };
}).sort((a, b) => b.n - a.n || a.rows[0].year - b.rows[0].year);

/* ================================================================ helpers */
const badgeURL = (school) => LG.url(canon(school));
const badge = (school, size = 22) => LG.chip(canon(school), size);
const dpill = (d) => { const c = dColor(d); const l = d3.hsl(d3.color(c) || '#999').l; return `<a class="dpill" href="#district-${+d}" style="background:${c};color:${l > 0.62 ? '#14233f' : '#fff'}" title="District ${+d}">D${+d}</a>`; };
const whoLink = (school, size = 22) => `<a class="who" href="${schoolHref(school)}">${badge(school, size)}<span>${esc(school)}</span></a>`;
const clsPill = (c) => `<span class="cpill c-${c === 'single' ? 's' : c.toLowerCase()}">${c === 'single' ? '1938–73' : c}</span>`;

const tip = {
  show(ev, html) { $tip.innerHTML = html; $tip.style.display = 'block'; this.move(ev); },
  move(ev) {
    const w = $tip.offsetWidth, h = $tip.offsetHeight;
    let x = ev.clientX + 16, y = ev.clientY + 16;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 16;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - 16;
    $tip.style.left = Math.max(8, x) + 'px'; $tip.style.top = Math.max(8, y) + 'px';
  },
  hide() { $tip.style.display = 'none'; }
};
const tipHTML = (a, b, c, school) => `<div class="t1">${esc(a)}</div><div class="t2">${school ? badge(school, 20) : ''}<span>${esc(b)}</span></div>${c ? `<div class="t3">${c}</div>` : ''}`;
const bindTip = (sel, fn) => sel.on('pointerenter', (ev, d) => tip.show(ev, fn(d))).on('pointermove', (ev) => tip.move(ev)).on('pointerleave', () => tip.hide());

const svgIn = (host, W, H, label) => d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
const textW = (() => { const c = document.createElement('canvas').getContext('2d'); return (s, size = 12.5, weight = 400) => { c.font = `${weight} ${size}px 'Public Sans', Arial, sans-serif`; return c.measureText(String(s)).width; }; })();
const widthOf = (el) => Math.max(280, Math.floor(el.getBoundingClientRect().width));

function sortableTable(host, cols, rows, opts = {}) {
  let key = opts.sort || cols.find((c) => c.num)?.key, dir = opts.dir || -1;
  const box = document.createElement('div'); box.className = 'tablebox'; if (opts.maxH) box.style.maxHeight = opts.maxH;
  const t = document.createElement('table'); t.className = 'data';
  box.append(t); host.append(box);
  const draw = () => {
    const rs = rows.slice().sort((a, b) => { const va = a[key], vb = b[key]; if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir; });
    t.innerHTML = `<thead><tr>${cols.map((c) => `<th class="${c.num ? 'n' : ''}${c.key === opts.accent ? ' acc' : ''}" scope="col"><button type="button" data-k="${c.key}" ${c.key === key ? `aria-sort="${dir < 0 ? 'descending' : 'ascending'}"` : ''}>${esc(c.label)}</button></th>`).join('')}</tr></thead><tbody>${rs.length ? rs.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? 'n' : ''}${c.key === opts.accent ? ' acc' : ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">${esc(opts.empty || 'Nothing matches.')}</td></tr>`}</tbody>`;
    t.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k; if (k === key) dir = -dir; else { key = k; dir = cols.find((c) => c.key === k).num ? -1 : 1; } draw(); }));
  };
  draw();
  return { redraw: (r) => { rows = r; draw(); } };
}

/* ================================================================ charts */
/* The arena: every champion on one mat. Spokes are seasons (clockwise from the top), rings are lineup
   spots (lightest at the center). Returns handles so selection and filters update without a redraw. */
function arenaMat(h, rows, opts) {
  const S = Math.max(300, Math.min(widthOf(h), 720));
  const c = S / 2, R = S / 2 - 30;
  const svg = svgIn(h, S, S, `Every ${clsName()} state champion arranged on a wrestling mat`);
  const root = svg.append('g').attr('transform', `translate(${c},${c})`);
  const [y0, y1] = yearsOf(rows);
  const years = d3.range(y0, y1 + 1);
  const gap = 0.34;
  const ang = d3.scaleBand(years, [gap / 2, 2 * Math.PI - gap / 2]).paddingInner(years.length > 70 ? 0.1 : 0.14);
  const band = [R * 0.34, R * 0.955];
  const n = d3.max(rows, (r) => r.slot) + 1;
  const st = (band[1] - band[0]) / n;
  const arc = d3.arc();
  // mat surface, ring guides, and the 28-foot circle
  root.append('circle').attr('r', R + 22).attr('fill', '#f3f5f7').attr('stroke', '#d5dade');
  root.append('g').selectAll('circle').data(d3.range(n + 1)).join('circle').attr('r', (i) => band[0] + i * st).attr('fill', 'none').attr('stroke', '#e3e7eb').attr('stroke-width', 1);
  root.append('circle').attr('r', R * 0.995).attr('fill', 'none').attr('stroke', css('--circle')).attr('stroke-width', Math.max(5, R * 0.028));
  root.append('circle').attr('r', R * 0.315).attr('fill', '#fff').attr('stroke', '#14233f').attr('stroke-width', 1.4);
  // the radial axis, written in the gap at the top
  const ax = root.append('g').attr('class', 'ring-axis').style('pointer-events', 'none');
  ax.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -band[0] - 4).attr('y2', -band[1] + 6).attr('stroke', '#6f7b8c').attr('stroke-width', 1).attr('marker-end', 'url(#ar-arrow)');
  svg.append('defs').append('marker').attr('id', 'ar-arrow').attr('viewBox', '0 0 8 8').attr('refX', 4).attr('refY', 4).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0 0L8 4L0 8z').attr('fill', '#6f7b8c');
  const fs = Math.max(9.5, Math.min(11.5, R * 0.035));
  if (R >= 200) ax.append('text').attr('transform', `translate(${-fs * 0.45},${-band[0] - 8}) rotate(-90)`).attr('text-anchor', 'start').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#445166').text('lightest');
  if (R >= 200) ax.append('text').attr('transform', `translate(${-fs * 0.45},${-band[1] + 4}) rotate(-90)`).attr('text-anchor', 'end').style('font-size', fs + 'px').style('font-weight', 700).style('fill', '#445166').text('heaviest');
  // season labels
  const lab = root.append('g').style('pointer-events', 'none');
  years.filter((y) => y % 5 === 0).forEach((y) => {
    const a = ang(y) + ang.bandwidth() / 2 - Math.PI / 2, rr = R + 13, dec = y % 10 === 0;
    lab.append('line').attr('x1', Math.cos(a) * (R * 0.985)).attr('y1', Math.sin(a) * (R * 0.985)).attr('x2', Math.cos(a) * (R + (dec ? 7 : 4))).attr('y2', Math.sin(a) * (R + (dec ? 7 : 4))).attr('stroke', dec ? '#445166' : '#9aa3ae');
    if (dec || years.length <= 60) lab.append('text').attr('x', Math.cos(a) * rr).attr('y', Math.sin(a) * rr + 4).attr('text-anchor', Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end')
      .style('font-weight', dec ? 800 : 600).style('font-size', dec ? '12.5px' : '11px').style('fill', dec ? '#14233f' : '#6f7b8c').text(y);
  });
  if (usesEra() && y0 < 1974) {
    const a = ang(1974) - Math.PI / 2;
    root.append('line').attr('x1', Math.cos(a) * band[0]).attr('y1', Math.sin(a) * band[0]).attr('x2', Math.cos(a) * (R + 6)).attr('y2', Math.sin(a) * (R + 6)).attr('stroke', '#14233f').attr('stroke-width', 1.4).attr('stroke-dasharray', '3 2').style('pointer-events', 'none');
  }
  // one wedge per season, under the marks, so the whole spoke is a target
  const spokes = root.append('g').selectAll('path').data(years).join('path')
    .attr('d', (y) => arc({ innerRadius: band[0] - 2, outerRadius: band[1] + 2, startAngle: ang(y) - ang.step() * ang.paddingInner() / 2, endAngle: ang(y) + ang.bandwidth() + ang.step() * ang.paddingInner() / 2 }))
    .attr('fill', 'transparent').style('cursor', 'pointer');
  const marks = root.append('g').selectAll('path').data(rows).join('path')
    .attr('d', (r) => arc({ innerRadius: band[0] + r.slot * st + 0.6, outerRadius: band[0] + (r.slot + 1) * st - 0.6, startAngle: ang(r.year), endAngle: ang(r.year) + ang.bandwidth() }))
    .style('cursor', 'pointer');
  const outline = root.append('path').attr('fill', 'none').attr('stroke', '#14233f').attr('stroke-width', 2).style('pointer-events', 'none');
  const hot = root.append('path').attr('fill', 'none').attr('stroke', '#14233f').attr('stroke-width', 2.4).style('pointer-events', 'none');
  const cy = root.append('text').attr('class', 'huge').attr('text-anchor', 'middle').attr('y', R * 0.02).style('font-size', Math.round(R * 0.15) + 'px').style('pointer-events', 'none');
  const cs = root.append('text').attr('text-anchor', 'middle').attr('y', R * 0.12).style('font-size', Math.max(10.5, Math.round(R * 0.04)) + 'px').style('font-weight', 600).style('fill', '#445166').style('pointer-events', 'none');
  const ch = root.append('text').attr('text-anchor', 'middle').attr('y', R * 0.19).style('font-size', Math.max(9.5, Math.round(R * 0.032)) + 'px').style('fill', '#6f7b8c').style('pointer-events', 'none');
  spokes.on('pointerenter', (ev, y) => opts.preview(y, null)).on('click', (ev, y) => opts.select(y));
  marks.on('pointerenter', (ev, r) => opts.preview(r.year, r)).on('click', (ev, r) => opts.select(r.year, r));
  svg.on('pointerleave', () => opts.preview(null, null));
  const spokePath = (y) => arc({ innerRadius: band[0] - 1, outerRadius: band[1] + 1, startAngle: ang(y) - 0.6 / R * 2, endAngle: ang(y) + ang.bandwidth() + 0.6 / R * 2 });
  return {
    paint({ color, dim, match, shown, focusMark, previewing, total, label }) {
      marks.attr('fill', color)
        .attr('opacity', (r) => { const base = dim(r) ? 0.1 : r.cls === 'single' && state.cls !== 'single' ? 0.6 : 1; return shown != null && r.year !== shown && previewing ? base * 0.45 : base; })
        .attr('stroke', (r) => (match(r) ? '#14233f' : 'none')).attr('stroke-width', 1.4);
      outline.attr('d', shown != null ? spokePath(shown) : null);
      hot.attr('d', focusMark ? arc({ innerRadius: band[0] + focusMark.slot * st, outerRadius: band[0] + (focusMark.slot + 1) * st, startAngle: ang(focusMark.year) - 0.004, endAngle: ang(focusMark.year) + ang.bandwidth() + 0.004 }) : null);
      if (shown != null) { const k = rows.filter((r) => r.year === shown).length; cy.text(shown); cs.text(`${k} champion${k === 1 ? '' : 's'}`); ch.text(''); }
      else { cy.text(fmt(total)); cs.text(label || `${clsName()} champions`); ch.text(''); }
    }
  };
}

function championGrid(host, rows, opts) {
  const W = widthOf(host);
  const [from, to] = yearsOf(rows);
  const years = d3.range(from, to + 1);
  const left = 54, right = 6, top = 4, bottom = 22;
  const colW = (W - left - right) / years.length;
  const cellH = Math.max(8, Math.min(18, colW * 1.1));
  const n = d3.max(rows, (r) => r.slot) + 1;
  const H = top + n * cellH + bottom;
  const x = d3.scaleBand(years, [left, W - right]).paddingInner(colW > 6 ? 0.12 : 0.05);
  const svg = svgIn(host, W, H, opts.label);
  svg.append('text').attr('x', left - 8).attr('y', top + 10).attr('text-anchor', 'end').text('light');
  svg.append('text').attr('x', left - 8).attr('y', top + n * cellH - 2).attr('text-anchor', 'end').text('heavy');
  const rects = svg.append('g').selectAll('rect').data(rows).join('rect')
    .attr('x', (r) => x(r.year)).attr('y', (r) => top + r.slot * cellH + 0.75)
    .attr('width', x.bandwidth()).attr('height', cellH - 1.5).attr('rx', Math.min(2.5, x.bandwidth() / 3))
    .attr('fill', (r) => opts.color(r)).attr('opacity', (r) => (opts.dim && opts.dim(r) ? 0.12 : r.cls === 'single' && state.cls !== 'single' ? 0.62 : 1))
    .attr('stroke', (r) => (opts.mark && opts.mark(r) ? css('--ink') : 'none')).attr('stroke-width', 1.6)
    .style('cursor', opts.click ? 'pointer' : null);
  bindTip(rects, opts.tip);
  if (opts.click) rects.on('click', (ev, r) => opts.click(r));
  if (usesEra() && from < 1974 && opts.eraLine !== false) svg.append('line').attr('x1', x(1974) - 2).attr('x2', x(1974) - 2).attr('y1', top).attr('y2', top + n * cellH).attr('stroke', css('--gold')).attr('stroke-dasharray', '3 2');
  const stepY = colW < 9 ? 10 : 5;
  svg.append('g').selectAll('text').data(years.filter((y) => y % stepY === 0)).join('text')
    .attr('x', (y) => x(y) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((y) => y);
}

function barList(host, rows, opts) {
  const W = widthOf(host);
  const rowH = opts.rowH || 30;
  const showExtra = opts.extra && W >= 620;
  const labW = Math.min(W * 0.5, d3.max(rows, (r) => textW(r.label, 12.5, 600) + (showExtra && r.extra ? textW(r.extra, 11) + 8 : 0)) + (opts.badge ? 30 : 0) + 14);
  const valW = d3.max(rows, (r) => textW(r.valueLabel ?? d3.sum(r.segs, (s) => s.v), 16, 800)) + 18;
  const max = opts.max || d3.max(rows, (r) => d3.sum(r.segs, (s) => s.v)) || 1;
  let lw = labW;
  if (W - lw - valW < 90) lw = Math.max(110, W - valW - 90);
  const maxLabel = lw - (opts.badge ? 30 : 0) - 8;
  const fit = (s) => { s = String(s); if (textW(s, 12.5, 600) <= maxLabel) return s; while (s.length > 3 && textW(s + '…', 12.5, 600) > maxLabel) s = s.slice(0, -1); return s + '…'; };
  const x = d3.scaleLinear([0, max], [0, Math.max(40, W - lw - valW)]);
  const H = rows.length * rowH + 4;
  const svg = svgIn(host, W, H, opts.label);
  const g = svg.selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * rowH})`);
  if (opts.badge) g.append('image').attr('href', (r) => badgeURL(r.school || r.label, 22, 'chip')).attr('x', 0).attr('y', (rowH - 22) / 2).attr('width', 22).attr('height', 22);
  const lx = opts.badge ? 30 : 0;
  g.append('text').attr('class', (r) => (r.hl ? 'gold-b' : 'ink-b')).attr('x', lx).attr('y', rowH / 2 + 4.5).text((r) => fit(r.label));
  if (showExtra) g.append('text').attr('x', (r) => lx + textW(r.label, 12.5, 600) + 8).attr('y', rowH / 2 + 4.5).text((r) => r.extra || '');
  g.each(function (r) {
    let acc = 0;
    const gg = d3.select(this);
    gg.append('rect').attr('x', lw).attr('y', (rowH - 16) / 2).attr('height', 16).attr('rx', 3).attr('width', x(max)).attr('fill', '#eef0f2');
    r.segs.forEach((s) => {
      if (!s.v) return;
      gg.append('rect').attr('x', lw + x(acc) + (acc ? 1 : 0)).attr('y', (rowH - 16) / 2).attr('height', 16).attr('rx', 3)
        .attr('width', Math.max(1.5, x(s.v) - (acc ? 1 : 0))).attr('fill', s.color).attr('opacity', s.opacity ?? 1);
      acc += s.v;
    });
    gg.append('text').attr('class', 'num').style('white-space', 'pre').attr('x', lw + x(acc) + 8).attr('y', rowH / 2 + 5.5).text(r.valueLabel ?? acc);
  });
  const hit = g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', 0).attr('width', W).attr('height', rowH);
  if (opts.tip) bindTip(hit, opts.tip);
  if (opts.href) hit.on('click', (ev, r) => { location.hash = opts.href(r); });
}

function yearBars(host, years, stacks, opts) {
  const W = widthOf(host), H = opts.H || 210, left = 30, right = 6, top = 12, bottom = 22;
  const x = d3.scaleBand(years, [left, W - right]).paddingInner(0.2);
  const max = opts.max || d3.max(years, (y) => d3.sum(stacks, (s) => s.get(y) || 0)) || 1;
  const yS = d3.scaleLinear([0, max], [H - bottom, top]).nice();
  const svg = svgIn(host, W, H, opts.label);
  svg.append('g').selectAll('line').data(yS.ticks(4)).join('line').attr('x1', left).attr('x2', W - right).attr('y1', yS).attr('y2', yS).attr('stroke', css('--grid'));
  svg.append('g').selectAll('text').data(yS.ticks(4).filter(Number.isInteger)).join('text').attr('x', left - 6).attr('y', (v) => yS(v) + 4).attr('text-anchor', 'end').text((v) => v);
  years.forEach((yr) => {
    let acc = 0;
    stacks.forEach((s) => {
      const v = s.get(yr) || 0; if (!v) return;
      svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', yS(acc + v) + (acc ? 1 : 0)).attr('height', Math.max(0, yS(acc) - yS(acc + v) - (acc ? 1 : 0))).attr('rx', Math.min(2, x.bandwidth() / 3)).attr('fill', s.color).attr('opacity', s.opacity ?? 1);
      acc += v;
    });
  });
  if (opts.era && years[0] < 1974 && years[years.length - 1] >= 1974) svg.append('line').attr('x1', x(1974) - 2).attr('x2', x(1974) - 2).attr('y1', top).attr('y2', H - bottom).attr('stroke', css('--gold')).attr('stroke-dasharray', '3 2');
  const hit = svg.append('g').selectAll('rect').data(years).join('rect').attr('class', 'hit').attr('x', (y) => x(y) - 1).attr('width', x.bandwidth() + 2).attr('y', top).attr('height', H - top - bottom);
  if (opts.tip) bindTip(hit, opts.tip);
  const stepY = x.bandwidth() < 7 ? 10 : 5;
  svg.append('g').selectAll('text').data(years.filter((y) => y % stepY === 0)).join('text').attr('x', (y) => x(y) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((y) => y);
}

function simpleCols(h, data, opts) {
  const W = widthOf(h), H = opts.H || 200, left = 34, right = 4, top = 18, bottom = 22;
  const x = d3.scaleBand(data.map((d) => d.k), [left, W - right]).paddingInner(0.25);
  const y = d3.scaleLinear([0, opts.max || d3.max(data, (d) => d.v) || 1], [H - bottom, top]).nice();
  const svg = svgIn(h, W, H, opts.label || 'chart');
  svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', left).attr('x2', W - right).attr('y1', y).attr('y2', y).attr('stroke', css('--grid'));
  svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(opts.fmtAxis || ((v) => v));
  const g = svg.selectAll('g.c').data(data).join('g').attr('class', 'c');
  g.append('rect').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', (d) => y(d.v)).attr('height', (d) => y(0) - y(d.v)).attr('rx', 3).attr('fill', (d) => d.color || opts.color);
  if (x.bandwidth() > 22) g.append('text').attr('class', 'ink-b').attr('x', (d) => x(d.k) + x.bandwidth() / 2).attr('y', (d) => y(d.v) - 5).attr('text-anchor', 'middle').style('font-size', '11.5px').text((d) => d.label);
  g.append('text').attr('x', (d) => x(d.k) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((d) => (x.bandwidth() < 30 ? "'" + d.k.slice(2) : d.k));
  bindTip(g.append('rect').attr('class', 'hit').attr('x', (d) => x(d.k)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), opts.tip);
}

function powerHeat(h, rows, highlight) {
  const W = widthOf(h);
  const [a, b] = yearsOf(rows);
  const decs = d3.range(decadeOf(a), b + 1, 10);
  const left = 74, top = 22, rowH = 23, H = top + 12 * rowH + 4;
  const x = d3.scaleBand(decs, [left, W - 2]).paddingInner(0.08);
  const tot = d3.rollup(rows, (v) => v.length, (r) => decadeOf(r.year));
  const cell = d3.rollup(rows, (v) => v.length, (r) => r.d, (r) => decadeOf(r.year));
  const max = d3.max(Array.from(cell.values()).flatMap((m) => Array.from(m, ([dc, n]) => n / tot.get(dc)))) || 1;
  const lo = '#f1f3f5', hi = '#14233f';
  const svg = svgIn(h, W, H, 'Share of state titles by district and decade');
  svg.append('g').selectAll('text').data(decs).join('text').attr('x', (d) => x(d) + x.bandwidth() / 2).attr('y', 12).attr('text-anchor', 'middle').text((d) => (x.bandwidth() < 34 ? "'" + String(d).slice(2) + 's' : d + 's'));
  d3.range(1, 13).forEach((d, i) => {
    const yy = top + i * rowH;
    svg.append('text').attr('class', d === highlight ? 'gold-b' : 'ink').attr('x', 0).attr('y', yy + 15).text('District ' + d);
    decs.forEach((dc) => {
      const n = (cell.get(d) && cell.get(d).get(dc)) || 0, s = tot.get(dc) ? n / tot.get(dc) : 0;
      const t = Math.sqrt(s / max);
      const fill = d3.interpolateRgb(lo, hi)(0.08 + 0.92 * t);
      const r = svg.append('rect').attr('x', x(dc)).attr('y', yy + 2).attr('width', x.bandwidth()).attr('height', rowH - 4).attr('rx', 3)
        .attr('fill', n ? fill : 'none').attr('stroke', n ? (d === highlight ? css('--gold') : 'none') : css('--grid')).attr('stroke-width', 2);
      bindTip(r, () => tipHTML(`District ${d} · ${dc}s · ${clsName()}`, `${pct1(s)} of the decade's titles`, `${n} of ${tot.get(dc) || 0}`));
      r.on('click', () => { location.hash = '#district-' + d; }).style('cursor', 'pointer');
      if (n && x.bandwidth() > 30) svg.append('text').attr('x', x(dc) + x.bandwidth() / 2).attr('y', yy + 15).attr('text-anchor', 'middle').style('pointer-events', 'none').style('font-size', '10.5px').style('fill', textOn(fill)).text(pct0(s));
    });
  });
}

const relLum = (c) => { const { r, g, b } = d3.rgb(c); const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const textOn = (c) => { const L = relLum(c); return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0559) ? '#ffffff' : '#14233f'; };

/* weight fingerprint */
const BANDS = ['Lightest fifth', 'Light', 'Middle', 'Heavy', 'Heaviest fifth'];
const bandOf = (rel) => Math.min(4, Math.floor(rel * 5));
const fingerprint = (rows) => { const c = [0, 0, 0, 0, 0]; rows.forEach((r) => { c[bandOf(r.rel)]++; }); const n = rows.length || 1; return c.map((v) => v / n); };
const heaviness = (rows) => d3.mean(rows, (r) => r.rel);
function fpChart(host, rows, ref, color, opts = {}) {
  const W = opts.W || widthOf(host), H = opts.H || 170, left = 4, right = 4, top = 18, bottom = 34;
  const fp = fingerprint(rows), refFp = fingerprint(ref);
  const x = d3.scaleBand(d3.range(5), [left, W - right]).paddingInner(0.22);
  const y = d3.scaleLinear([0, Math.max(0.36, d3.max(fp), d3.max(refFp))], [H - bottom, top]);
  const svg = svgIn(host, W, H, opts.label || 'Weight fingerprint');
  svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', css('--rule'));
  const g = svg.selectAll('g').data(d3.range(5)).join('g');
  g.append('rect').attr('x', (i) => x(i)).attr('width', x.bandwidth()).attr('y', (i) => y(fp[i])).attr('height', (i) => y(0) - y(fp[i])).attr('rx', 3).attr('fill', color);
  g.append('line').attr('x1', (i) => x(i) - 3).attr('x2', (i) => x(i) + x.bandwidth() + 3).attr('y1', (i) => y(refFp[i])).attr('y2', (i) => y(refFp[i])).attr('stroke', css('--chalk')).attr('stroke-width', 2).attr('stroke-dasharray', '3 2');
  g.append('text').attr('class', 'ink-b').attr('x', (i) => x(i) + x.bandwidth() / 2).attr('y', (i) => Math.min(y(fp[i]), y(refFp[i])) - 6).attr('text-anchor', 'middle').text((i) => pct0(fp[i]));
  g.append('text').attr('x', (i) => x(i) + x.bandwidth() / 2).attr('y', H - 16).attr('text-anchor', 'middle').text((i) => (x.bandwidth() < 60 ? ['Lightest', 'Light', 'Middle', 'Heavy', 'Heaviest'][i] : BANDS[i]));
  bindTip(g.append('rect').attr('class', 'hit').attr('x', (i) => x(i)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), (i) => tipHTML(BANDS[i] + ' of the lineup', pct1(fp[i]) + ' of these titles', 'Statewide in this class: ' + pct1(refFp[i])));
}

/* ================================================================ page pieces */
function pageHead(kicker, title, lede, pre) {
  return `<header class="pagehead"><div class="headrow">${pre || ''}<h1>${title}</h1></div>${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
}
/* box score: a printed line of figures; the first cell is the headline */
const tiles = (items) => `<dl class="box">${items.map(([v, l], i) => `<div><dt>${l}</dt><dd${i === 0 ? ' class="gold"' : ''}>${v}</dd></div>`).join('')}</dl>`;
const panel = (id, title, sub, extra = '') => `<section class="sheet" id="${id}"><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${extra}<div class="chart" data-c="${id}"></div></section>`;
const notePanel = (title, text) => `<section class="sheet"><h2>${title}</h2><p class="sub" style="margin-bottom:0">${text}</p></section>`;
const host = (id) => $view.querySelector(`[data-c="${id}"]`);
const eraNote = () => (usesEra() ? ` Titles from 1938–73 (before the class split) appear in a lighter shade, left of the dashed line.` : '');
const VIEWS = {};

/* small drawing that teaches the mat: one spoke = one season, one ring = one lineup spot */
const arenaKey = () => `<svg class="arena-key" viewBox="0 0 250 92" role="img" aria-label="How to read the mat"><g transform="translate(46,86)"><path d="M0 0 L-30 -74 A80 80 0 0 1 30 -74 Z" fill="#f3f5f7" stroke="#d5dade"/>${[0, 1, 2, 3, 4].map((i) => `<path d="${d3.arc()({ innerRadius: 22 + i * 11, outerRadius: 31 + i * 11, startAngle: -0.09, endAngle: 0.09 })}" fill="${i === 2 ? '#14233f' : '#9aa9bd'}"/>`).join('')}</g><text x="92" y="22" style="font:700 11.5px var(--body);fill:#14233f">One spoke = one season</text><text x="92" y="40" style="font:400 11px var(--body);fill:#445166">a mark for each champion</text><text x="92" y="62" style="font:700 11.5px var(--body);fill:#14233f">One ring = one weight spot</text><text x="92" y="80" style="font:400 11px var(--body);fill:#445166">lightest in, heaviest out</text></svg>`;

/* a felt banner for one program: logo foil, name, count, and the seasons sewn on */
function bannerHTML(t, i) {
  const c = LG.colorsOf(t.school);
  const yrs = Array.from(d3.rollup(t.rows, (v) => v.length, (r) => r.year)).sort((a, b) => a[0] - b[0]);
  const MAX = 27, shown = yrs.length > MAX ? yrs.slice(yrs.length - (MAX - 1)) : yrs;
  return `<a class="banner" href="${schoolHref(t.school)}" style="--field:${c.field};--thread:${c.thread}" data-foil-host aria-label="${esc(t.school)}, ${t.n} ${clsName()} state titles">
    <span class="bn-rank" aria-hidden="true">${i + 1}</span>
    ${LG.foil(t.school, { size: 84, live: true })}
    <span class="bn-name">${esc(t.school)}</span>
    <span class="bn-n">${t.n}</span><span class="bn-l">state titles</span>
    <span class="bn-years">${shown.map(([y, n]) => `<span>${y}${n > 1 ? `<i>×${n}</i>` : ''}</span>`).join('')}</span>
    ${yrs.length > shown.length ? `<span class="bn-more">and ${yrs.length - shown.length} earlier seasons</span>` : ''}
  </a>`;
}

/* ================================================================ Statewide */
VIEWS.overview = function () {
  const rows = SC();
  const [y0, y1] = yearsOf(rows);
  const byD = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]);
  const recent = rows.filter((r) => r.year >= 2010);
  const recD = Array.from(d3.rollup(recent, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]);
  const W = wrestlersOf(rows);
  const schools = new Set(rows.map((r) => r.sch)).size;
  const topSchool = Array.from(d3.rollup(rows, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1])[0];
  const title = state.cls === 'single' ? 'Every single-class state champion' : `Every Class ${state.cls} state champion`;
  const lede = `${fmt(rows.length)} ${clsName()} state titles, ${y0}–${y1}, each one a mark on the circle. District ${byD[0][0]} (${DISTRICTS[byD[0][0]]}) has won the most, ${byD[0][1]}.` +
    (recD.length > 1 ? ` Since 2010, District ${recD[0][0]} leads with ${recD[0][1]} to District ${recD[1][0]}'s ${recD[1][1]}.` : '') + ` The top program is <a href="${schoolHref(topSchool[0])}">${esc(topSchool[0])}</a> with ${topSchool[1]}.`;
  const top = Array.from(d3.rollup(rows, (v) => v, (r) => r.sch)).map(([sc, v]) => ({ school: sc, n: v.length, rows: v })).sort((a, b) => b.n - a.n || d3.min(a.rows, (r) => r.year) - d3.min(b.rows, (r) => r.year)).slice(0, 8);
  const span = `${y0}–${y1}`;
  $view.innerHTML = `<section class="wall">
      <div class="wall-head"><h1>${state.cls === 'single' ? 'Single-class champions' : `Class ${state.cls} champions`}</h1><p>The ${top.length} programs with the most ${clsName()} state titles, ${span}. Each banner lists the seasons it won them.</p></div>
      <div class="rod" aria-hidden="true"></div>
      <div class="banners">${top.map((t, i) => bannerHTML(t, i)).join('')}</div>
    </section>
    <p class="lede">${lede}</p>
    ${tiles([[fmt(rows.length), `${clsName()} state titles`], [fmt(schools), 'schools with a champion'], [fmt(W.filter((w) => w.n >= 2).length), 'multi-time champions'], [W.filter((w) => w.n >= 3).length, 'three-time champions'], [W.filter((w) => w.n >= 4).length, 'four-time champions']])}
    <section class="sheet arena" id="arena">
      <div class="arena-head">
        <div><h2>The arena</h2><p class="sub">Every ${clsName()} state champion on one mat. Each spoke is a season, running clockwise from ${y0} at the top. Each ring is a spot in that season's lineup, lightest at the center and heaviest at the edge.${usesEra() ? ' The dashed line marks the 1974 class split; earlier titles are lighter.' : ''} Point at the mat to read a season; click or use the slider to keep one open.</p></div>
        ${arenaKey()}
      </div>
      <div class="arena-tools">
        <div class="seg" role="group" aria-label="Color the mat by"><button type="button" data-m="district">Color by district</button><button type="button" data-m="school">Top schools</button></div>
        <input class="field" id="ov-q" type="search" placeholder="Find a wrestler or school" aria-label="Find a wrestler or school on the mat">
      </div>
      <div class="legend" id="ov-legend" aria-label="Show one group"></div>
      <div class="arena-body">
        <div class="arena-mat">
          <div class="chart" data-c="mat" tabindex="0" aria-label="The mat. Use the left and right arrow keys to change season."></div>
        </div>
        <aside class="arena-card">
          <div class="scrub"><button type="button" class="btn ghost small" id="ar-prev" aria-label="Previous season">‹</button><input type="range" id="ar-year" min="${y0}" max="${y1}" step="1" aria-label="Season"><button type="button" class="btn ghost small" id="ar-next" aria-label="Next season">›</button></div>
          <div id="ar-card" aria-live="polite"></div>
        </aside>
      </div>
    </section>` +
    `<section class="sheet"><h2>Season by season</h2><p class="sub">The same ${fmt(rows.length)} champions as a bracket sheet: seasons left to right, weights from lightest (top) to heaviest. The arena's filters apply here too. Click a square to open its season in the arena.${eraNote()}</p><div class="chart" data-c="grid"></div></section>` +
    `<div class="two">${panel('standings', 'District standings', `All-time ${clsName()} state titles by district.${usesEra() ? ' The lighter part of each bar is 1938–73 titles of schools that later wrestled ' + state.cls + '.' : ''} Click a district to open it.`)}${panel('power', 'Balance of power by decade', `Each district's share of the decade's ${clsName()} titles. Darker cells mean a bigger share. Click a cell to open the district.`)}</div>` +
    `<div class="two">${panel('parity', 'How many schools win titles', `Distinct schools with at least one ${clsName()} state champion in each decade. The first and last decades are partial.`)}${panel('conc', 'How concentrated the titles are', `Share of each decade's ${clsName()} titles won by that decade's five most successful schools.`)}</div>` +
    `<section class="sheet"><h2>Three- and four-time champions</h2><p class="sub">${clsName()} titles only, grouped by name and district. Click a column to sort.</p><div data-c="greats"></div></section>`;

  /* ---- the arena ---- */
  const [, lastY] = yearsOf(rows);
  if (!state.arYear || state.arYear < y0 || state.arYear > y1) state.arYear = lastY;
  if (!state.arMode) state.arMode = 'district';
  const topSch = top.map((t) => t.school);
  const topPal = SB ? SB.palette(topSch, 'light') : {};
  topSch.forEach((sc) => { if (!topPal[sc] || topPal[sc] === SB.colorFor('Other', 'light')) topPal[sc] = sColor(sc) === css('--other') ? LG.colorsOf(sc).field : sColor(sc); });
  const markColor = (r) => (state.arMode === 'school' ? (topPal[r.sch] || '#d3d8dd') : dColor(r.d));
  const q = $view.querySelector('#ov-q'); q.value = state.q;
  const leg = $view.querySelector('#ov-legend'), card = $view.querySelector('#ar-card'), range = $view.querySelector('#ar-year');
  const counts = d3.rollup(rows, (v) => v.length, (r) => r.d), sCounts = d3.rollup(rows, (v) => v.length, (r) => r.sch);
  let pv = { y: null, r: null }, showMatches = true;
  const ql = () => state.q.toLowerCase();
  const isMatch = (r) => !!ql() && (r.name.toLowerCase().includes(ql()) || r.school.toLowerCase().includes(ql()));
  const inFocus = (r) => { const f = state.focus; if (!f) return true; if (f.startsWith('s:')) return f === 's:__other' ? !topSch.includes(r.sch) : r.sch === f.slice(2); return f === 'other' ? !COLORED.includes(r.d) : r.d === +f; };
  const isDim = (r) => !inFocus(r) || (ql() && !isMatch(r));
  const drawLegend = () => {
    const f = state.focus;
    const items = state.arMode === 'school'
      ? topSch.map((sc) => ({ k: 's:' + sc, label: esc(sc), chip: badge(sc, 16), color: topPal[sc], n: sCounts.get(sc) })).concat([{ k: 's:__other', label: 'All other schools', color: '#d3d8dd', n: rows.filter((r) => !topSch.includes(r.sch)).length }])
      : COLORED.map((d) => ({ k: String(d), label: `D${d}`, color: dColor(d), n: counts.get(d) || 0 })).sort((a, b) => b.n - a.n).concat([{ k: 'other', label: 'Other districts', color: css('--other'), n: rows.filter((r) => !COLORED.includes(r.d)).length }]);
    leg.innerHTML = items.map((it) => `<button type="button" data-k="${esc(it.k)}" aria-pressed="${f === it.k}" class="${f && f !== it.k ? 'dim' : ''}"><i style="background:${it.color}"></i>${it.chip || ''}${it.label} <span class="mini">${it.n}</span></button>`).join('');
    $view.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === state.arMode));
  };
  const seasonCard = (y, focusRow) => {
    const rs = rows.filter((r) => r.year === y).sort((a, b) => a.wn - b.wn);
    const tally = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]);
    const lead = tally[0];
    return `<div class="card-head"><div><span class="card-yr">${y}</span><span class="card-cls">${clsName()} state champions</span></div>${pv.y != null && pv.y !== state.arYear ? '<span class="card-note">Click to keep this season open</span>' : ''}</div>
      ${rs.length ? `<ol class="lineup">${rs.map((r) => `<li class="${focusRow && focusRow === r ? 'on' : ''}${isDim(r) ? ' faded' : ''}" style="--c:${markColor(r)}"><span class="w">${r.w === 'UNL' ? 'Unl.' : esc(r.w)}</span><span class="nm">${esc(r.name)}${r.cls === 'single' && state.cls !== 'single' ? ' <span class="mini">(single class)</span>' : ''}</span><a class="who" href="${schoolHref(r.school)}">${badge(r.school, 20)}<span>${esc(r.school)}</span></a>${dpill(r.d)}</li>`).join('')}</ol>
      <p class="card-foot">${lead ? `District ${lead[0]} had the most champions this season, ${lead[1]} of ${rs.length}.` : ''}${tally.length > 1 ? ' ' + tally.slice(1, 4).map(([d, k]) => `District ${d}, ${k}`).join('; ') + (tally.length > 4 ? `; ${tally.length - 4} more district${tally.length - 4 === 1 ? '' : 's'}` : '') + '.' : ''}</p>`
      : `<p class="empty">No ${clsName()} champions on record for ${y}.</p>`}`;
  };
  const matchCard = () => {
    const ms = rows.filter(isMatch).sort((a, b) => a.year - b.year || a.wn - b.wn);
    if (!ms.length) return `<div class="card-head"><div><span class="card-cls">No ${clsName()} champion or school matches “${esc(state.q)}”.</span></div></div>`;
    return `<div class="card-head"><div><span class="card-yr">${ms.length}</span><span class="card-cls">champion${ms.length === 1 ? '' : 's'} match “${esc(state.q)}”</span></div></div>
      <ol class="lineup matches">${ms.slice(0, 60).map((r) => `<li style="--c:${markColor(r)}"><button type="button" class="yr-btn" data-year="${r.year}">${r.year}</button><span class="w">${esc(r.w)}</span><span class="nm">${esc(r.name)}</span><a class="who" href="${schoolHref(r.school)}">${badge(r.school, 20)}<span>${esc(r.school)}</span></a></li>`).join('')}</ol>
      ${ms.length > 60 ? `<p class="card-foot">Showing the first 60. Narrow the search to see the rest.</p>` : '<p class="card-foot">Pick a season to open its full lineup.</p>'}`;
  };
  let mat = null;
  const paint = () => {
    const listing = ql() && showMatches && pv.y == null;
    const shown = listing ? null : pv.y != null ? pv.y : state.arYear;
    mat.paint({ color: markColor, dim: isDim, match: isMatch, shown, focusMark: pv.r, previewing: pv.y != null, total: rows.filter((r) => !isDim(r)).length, label: listing ? 'matching champions' : null });
    card.innerHTML = listing ? matchCard() : seasonCard(shown, pv.r) + (ql() && !showMatches ? '<button type="button" class="linkish back" data-back>Back to the matches</button>' : '');
    range.value = state.arYear;
  };
  const setYear = (y) => { state.arYear = Math.max(y0, Math.min(y1, y)); showMatches = false; pv = { y: null, r: null }; paint(); };
  const drawMats = () => {
    host('mat').innerHTML = '';
    mat = arenaMat(host('mat'), rows, { preview: (y, r) => { pv = { y, r }; paint(); }, select: (y) => setYear(y) });
    paint();
    host('grid').innerHTML = '';
    championGrid(host('grid'), rows, { label: `Grid of ${clsName()} state champions`, color: markColor, dim: isDim, mark: isMatch,
      tip: (r) => tipHTML(`${r.year} · ${clsTag(r)} · ${r.w === 'UNL' ? 'Unlimited' : r.w + ' lb'}`, r.name, `${esc(r.school)}, District ${r.d}`, r.school),
      click: (r) => { tip.hide(); setYear(r.year); $view.querySelector('#arena').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  };
  q.addEventListener('input', () => { state.q = q.value.trim(); showMatches = true; drawMats(); });
  leg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.focus = state.focus === b.dataset.k ? null : b.dataset.k; drawLegend(); drawMats(); });
  $view.querySelector('.arena-tools .seg').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b || b.dataset.m === state.arMode) return; state.arMode = b.dataset.m; state.focus = null; drawLegend(); drawMats(); });
  range.addEventListener('input', () => setYear(+range.value));
  $view.querySelector('#ar-prev').addEventListener('click', () => setYear(state.arYear - 1));
  $view.querySelector('#ar-next').addEventListener('click', () => setYear(state.arYear + 1));
  host('mat').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setYear(state.arYear - 1); e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setYear(state.arYear + 1); e.preventDefault(); } });
  card.addEventListener('click', (e) => { const yb = e.target.closest('[data-year]'); if (yb) setYear(+yb.dataset.year); if (e.target.closest('[data-back]')) { showMatches = true; paint(); } });
  drawLegend();
  drawMats();

  const st = d3.range(1, 13).map((d) => {
    const rs = rows.filter((r) => r.d === d);
    const pre = rs.filter((r) => r.cls === 'single').length;
    return { d, label: `District ${d}`, extra: DISTRICTS[d], segs: [{ v: pre, color: dColor(d), opacity: 0.5 }, { v: rs.length - pre, color: dColor(d) }], total: rs.length, pre };
  }).sort((a, b) => b.total - a.total);
  barList(host('standings'), st, { label: 'State titles by district', extra: true, rowH: 30,
    tip: (r) => tipHTML(DISTRICTS[r.d], `District ${r.d}: ${r.total} ${clsName()} titles`, `${pct1(r.total / rows.length)} of all${r.pre ? ` · ${r.pre} from 1938–73` : ''}`), href: (r) => '#district-' + r.d });
  powerHeat(host('power'), rows, null);
  const decs = d3.range(decadeOf(y0), y1 + 1, 10);
  simpleCols(host('parity'), decs.map((dc) => { const n = new Set(rows.filter((r) => decadeOf(r.year) === dc).map((r) => r.sch)).size; return { k: dc + 's', v: n, label: String(n) }; }), { color: css('--chalk-2'), tip: (o) => tipHTML(o.k, o.v + ' schools with a champion') });
  simpleCols(host('conc'), decs.map((dc) => {
    const rs = rows.filter((r) => decadeOf(r.year) === dc);
    const top = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const v = rs.length ? d3.sum(top, (t) => t[1]) / rs.length : 0;
    return { k: dc + 's', v, label: pct0(v), top };
  }), { color: css("--ink-2"), max: 1, fmtAxis: pct0, tip: (o) => tipHTML(o.k + ', top five schools', pct1(o.v) + ' of the titles', o.top.map((t) => esc(t[0]) + ' ' + t[1]).join('<br>')) });
  const g = W.filter((w) => w.n >= 3).map((w) => ({ name: w.name, school: w.school, d: w.d, n: w.n, first: w.rows[0].year, last: w.rows[w.n - 1].year, weights: w.rows.map((r) => r.w).join(' · ') }));
  sortableTable(host('greats'), [
    { key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) },
    { key: 'n', label: 'Titles', num: true, render: (r) => `<span class="score">${r.n}</span>` }, { key: 'first', label: 'First', num: true }, { key: 'last', label: 'Last', num: true }, { key: 'weights', label: 'Weights' }
  ], g, { sort: 'n', maxH: '460px', accent: 'n', empty: 'No three-time champions in this class.' });
};

/* ================================================================ District */
function districtView(d) {
  const all = SC();
  const rs = all.filter((r) => r.d === d);
  const color = dColor(d);
  const ranks = Array.from(d3.rollup(all, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]);
  const rank = ranks.findIndex((x) => x[0] === d) + 1;
  const W = wrestlersOf(rs);
  const schools = Array.from(d3.rollup(rs, (v) => v, (r) => r.sch)).map(([s, v]) => ({ school: s, rows: v, n: v.length, pre: v.filter((r) => r.cls === 'single').length, first: d3.min(v, (r) => r.year), last: d3.max(v, (r) => r.year) })).sort((a, b) => b.n - a.n || d3.ascending(a.school, b.school));
  const hv = rs.length ? heaviness(rs) : null, hvAll = heaviness(all);
  const lean = rs.length >= 20 ? (hv > hvAll + 0.04 ? 'lean toward the heavier weights' : hv < hvAll - 0.04 ? 'lean toward the lighter weights' : 'are spread evenly across the lineup') : null;
  const other = d3.rollup(CH.filter((r) => r.d === d), (v) => v.length, (r) => r.cls);
  const otherNote = state.cls === 'single' ? '' : ` In Class ${state.cls === 'AAA' ? 'AA' : 'AAA'} the district has ${other.get(state.cls === 'AAA' ? 'AA' : 'AAA') || 0}.`;
  const pre = `<span class="dnum" aria-hidden="true"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="44" fill="#fff" stroke="#c9ced3"/><circle cx="46" cy="46" r="36" fill="none" stroke="${color}" stroke-width="7"/></svg><b>${d}</b></span>`;
  const isAAA = state.cls === 'AAA';
  const dRows = DIST.filter((r) => r.d === d && r.cls === 'AAA');
  const mod = DIST.filter((r) => r.cls === 'AAA' && r.year >= 1999 && r.d === d);
  const q99 = d3.sum(mod, (r) => r.qualifiers), m99 = d3.sum(mod, (r) => r.medalists);
  const teamN = TEAMS.filter((t) => +t.d === d).length;
  const tileItems = [[fmt(rs.length), `${clsName()} state titles`], [`${rank ? ordinal(rank) : '—'}`, 'of 12 districts'], [rs.length ? pct1(rs.length / all.length) : '—', `of all ${clsName()} titles`], [W.filter((w) => w.n >= 2).length, 'multi-time champions']];
  if (isAAA) tileItems.push([fmt(d3.sum(dRows, (r) => r.medalists || 0)), 'AAA state medals since 1973'], [q99 ? pct0(m99 / q99) : '—', 'of AAA qualifiers medaled, 1999–2026'], [teamN, 'AAA team titles']);
  $view.innerHTML = pageHead(esc(DISTRICTS[d]) + ', ' + clsName(), `District ${d}`,
    rs.length ? `District ${d} wrestlers have won <b>${fmt(rs.length)}</b> ${clsLong()} state titles, ${rank === 1 ? 'the most of any district' : `${ordinal(rank)} among the 12 districts`}.${schools[0] ? ` Its leading program is <a href="${schoolHref(schools[0].school)}">${esc(schools[0].school)}</a> with ${schools[0].n}.` : ''}${lean ? ` Its champions ${lean} compared with the rest of the state.` : ''}${otherNote}` : `District ${d} has no ${clsName()} state champions on record.${otherNote}`, pre) +
    `<nav class="dstrip" aria-label="Districts">${d3.range(1, 13).map((k) => `<a href="#district-${k}"${k === d ? ' aria-current="page"' : ''} title="District ${k}, ${esc(DISTRICTS[k])}">${k}</a>`).join('')}</nav>` +
    tiles(tileItems) +
    (rs.length ? `<div class="two">${panel('d-years', 'Titles by season', `${clsName()} state champions from District ${d} each season. Hover a bar for the names.${eraNote()}`)}${panel('d-share', 'Share of the state\'s titles, five-season rolling', `District ${d} in its color, the other eleven in gray. Each point is the district's share of ${clsName()} titles over the previous five seasons.`)}</div>` +
    `<div class="two">${panel('d-schools', 'Leading programs', `District ${d} schools ranked by ${clsName()} state titles. Click a school for its profile.`)}${panel('d-fp', 'Weight fingerprint', `Where District ${d}'s champions fall in each season's lineup, in fifths from lightest to heaviest. The dashed line is the statewide share for this class.`)}</div>` +
    `<div class="two">${isAAA ? panel('d-eff', 'Turning qualifiers into medals', 'Class AAA, 1999–2026, when eight places medaled. Dot: share of each district\'s state qualifiers who medaled. Bar: share who won the title.') : notePanel('Turning qualifiers into medals', 'Qualifier and medal counts by district were collected for Class AAA only. Switch the class to AAA to see this comparison.')}<section class="sheet"><h2>Multi-time champions</h2><p class="sub">District ${d} wrestlers with two or more ${clsName()} titles.</p><div data-c="d-multi"></div></section></div>` +
    `<section class="sheet"><h2>Every District ${d} ${clsName()} champion</h2><p class="sub">Newest first. Click a column to sort.</p><div class="controls"><input class="field" id="d-q" type="search" placeholder="Filter by wrestler or school" aria-label="Filter the list by wrestler or school"></div><div data-c="d-list"></div></section>` : '') +
    (d === 11 ? (isAAA ? d11Section() : `<div class="notice">${badge('Nazareth', 28)}<span>District 11's full district tournament and Northeast Regional history are Class AAA. <button class="linkish" type="button" data-setcls="AAA">Switch to Class AAA</button> to see them.</span></div>`) : '');

  if (rs.length) {
    const [a, b] = yearsOf(all);
    const yrs = d3.range(a, b + 1);
    const cur = d3.rollup(rs.filter((r) => r.cls !== 'single'), (v) => v.length, (r) => r.year), old = d3.rollup(rs.filter((r) => r.cls === 'single'), (v) => v.length, (r) => r.year);
    yearBars(host('d-years'), yrs, [{ get: (y) => old.get(y), color, opacity: 0.55 }, { get: (y) => cur.get(y), color }], { label: 'Titles by season', era: usesEra(),
      tip: (y) => { const list = rs.filter((r) => r.year === y); return tipHTML(String(y), `${list.length} champion${list.length === 1 ? '' : 's'}`, list.map((r) => `${esc(r.w)} · ${esc(r.name)}, ${esc(r.school)}`).join('<br>') || 'None'); } });
    shareLines(host('d-share'), d, all);
    barList(host('d-schools'), schools.slice(0, 15).map((s) => ({ label: s.school, school: s.school, segs: [{ v: s.pre, color: sColor(s.school), opacity: 0.5 }, { v: s.n - s.pre, color: sColor(s.school) }], s })), { badge: true, label: 'Leading programs', rowH: 30,
      tip: (r) => tipHTML(`${r.s.first}–${r.s.last}`, r.s.school, `${r.s.n} ${clsName()} titles${r.s.pre ? ` (${r.s.pre} from 1938–73)` : ''}`, r.s.school), href: (r) => schoolHref(r.s.school) });
    fpChart(host('d-fp'), rs, all, color, { label: `District ${d} weight fingerprint` });
    if (isAAA) effChart(host('d-eff'), d);
    const m = W.filter((w) => w.n >= 2).map((w) => ({ name: w.name, school: w.school, n: w.n, years: w.rows.map((r) => r.year).join(', ') }));
    if (m.length) sortableTable(host('d-multi'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'n', label: 'Titles', num: true, render: (r) => `<span class="score">${r.n}</span>` }, { key: 'years', label: 'Seasons' }], m, { sort: 'n', maxH: '360px' });
    else host('d-multi').innerHTML = '<p class="empty">No multi-time champions in this class.</p>';
    const listRows = rs.map((r) => ({ year: r.year, w: r.w, wn: r.wn, name: r.name, school: r.school, cls: r.cls }));
    const tbl = sortableTable(host('d-list'), [{ key: 'year', label: 'Season', num: true, render: (r) => `${r.year}${r.cls === 'single' ? ' ' + clsPill('single') : ''}` }, { key: 'wn', label: 'Weight', num: true, render: (r) => esc(r.w) }, { key: 'name', label: 'Champion' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }], listRows, { sort: 'year', maxH: '440px' });
    $view.querySelector('#d-q').addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); tbl.redraw(listRows.filter((r) => r.name.toLowerCase().includes(q) || r.school.toLowerCase().includes(q))); });
  }
  if (d === 11 && isAAA) d11Draw();
}

function shareLines(h, focus, all) {
  const W = widthOf(h), H = 220, left = 34, right = 70, top = 12, bottom = 22;
  const [a, b] = yearsOf(all);
  const yrs = d3.range(a + 4, b + 1);
  const per = d3.rollup(all, (v) => v.length, (r) => r.d, (r) => r.year);
  const tot = d3.rollup(all, (v) => v.length, (r) => r.year);
  const series = d3.range(1, 13).map((d) => ({ d, pts: yrs.map((y) => { let n = 0, t = 0; for (let k = y - 4; k <= y; k++) { n += (per.get(d) && per.get(d).get(k)) || 0; t += tot.get(k) || 0; } return { y, v: t ? n / t : 0 }; }) }));
  const x = d3.scaleLinear([yrs[0], yrs[yrs.length - 1]], [left, W - right]);
  const y = d3.scaleLinear([0, d3.max(series, (s) => d3.max(s.pts, (p) => p.v)) || 0.1], [H - bottom, top]).nice();
  const svg = svgIn(h, W, H, 'Rolling share of state titles by district');
  svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', left).attr('x2', W - right).attr('y1', y).attr('y2', y).attr('stroke', css('--grid'));
  svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(pct0);
  const line = d3.line().x((p) => x(p.y)).y((p) => y(p.v));
  series.filter((s) => s.d !== focus).forEach((s) => svg.append('path').attr('d', line(s.pts)).attr('fill', 'none').attr('stroke', css('--other')).attr('stroke-width', 1.2));
  const f = series.find((s) => s.d === focus);
  const area = d3.area().x((p) => x(p.y)).y0(y(0)).y1((p) => y(p.v));
  const gid = 'ar' + focus;
  const gr = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  gr.append('stop').attr('offset', '0%').attr('stop-color', dColor(focus)).attr('stop-opacity', 0.35);
  gr.append('stop').attr('offset', '100%').attr('stop-color', dColor(focus)).attr('stop-opacity', 0);
  svg.append('path').attr('d', area(f.pts)).attr('fill', `url(#${gid})`);
  svg.append('path').attr('d', line(f.pts)).attr('fill', 'none').attr('stroke', dColor(focus)).attr('stroke-width', 2.6).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  const last = f.pts[f.pts.length - 1];
  svg.append('circle').attr('cx', x(last.y)).attr('cy', y(last.v)).attr('r', 4.5).attr('fill', dColor(focus)).attr('stroke', css('--house')).attr('stroke-width', 2);
  svg.append('text').attr('class', 'ink-b').attr('x', x(last.y) + 9).attr('y', y(last.v) + 4).text(`D${focus} ${pct0(last.v)}`);
  svg.append('g').selectAll('text.x').data(x.ticks(6).filter(Number.isInteger)).join('text').attr('x', x).attr('y', H - 5).attr('text-anchor', 'middle').text((v) => v);
  const hit = svg.append('rect').attr('class', 'hit').attr('x', left).attr('y', top).attr('width', W - left - right).attr('height', H - top - bottom);
  const dot = svg.append('circle').attr('r', 4.5).attr('fill', dColor(focus)).attr('stroke', css('--house')).attr('stroke-width', 2).style('display', 'none').style('pointer-events', 'none');
  hit.on('pointermove', (ev) => {
    const [mx] = d3.pointer(ev); const yr = Math.round(x.invert(mx)); const p = f.pts.find((q) => q.y === yr); if (!p) return;
    dot.style('display', null).attr('cx', x(p.y)).attr('cy', y(p.v));
    const rk = series.map((s) => ({ d: s.d, v: s.pts.find((q) => q.y === yr).v })).sort((u, w) => w.v - u.v);
    tip.show(ev, tipHTML(`${yr - 4}–${yr}`, `District ${focus}: ${pct1(p.v)}`, 'Leaders: ' + rk.slice(0, 3).map((r) => `D${r.d} ${pct0(r.v)}`).join(' · ')));
  }).on('pointerleave', () => { tip.hide(); dot.style('display', 'none'); });
}

function effChart(h, focus) {
  const mod = DIST.filter((r) => r.cls === 'AAA' && r.year >= 1999);
  const rows = d3.range(1, 13).map((d) => { const rr = mod.filter((r) => r.d === d); const q = d3.sum(rr, (r) => r.qualifiers); return { d, q, m: d3.sum(rr, (r) => r.medalists), c: d3.sum(rr, (r) => r.champs) }; }).filter((r) => r.q >= 30).map((r) => ({ ...r, mr: r.m / r.q, cr: r.c / r.q })).sort((a, b) => b.mr - a.mr);
  const W = widthOf(h), rowH = 25, left = 78, right = 50, top = 20;
  const H = top + rows.length * rowH + 22;
  const x = d3.scaleLinear([0, d3.max(rows, (r) => r.mr)], [left, W - right]).nice();
  const svg = svgIn(h, W, H, 'Medal and title rate per state qualifier by district');
  svg.append('g').selectAll('line').data(x.ticks(4)).join('line').attr('x1', x).attr('x2', x).attr('y1', top - 4).attr('y2', H - 20).attr('stroke', css('--grid'));
  svg.append('g').selectAll('text').data(x.ticks(4)).join('text').attr('x', x).attr('y', H - 5).attr('text-anchor', 'middle').text(pct0);
  const avg = d3.sum(rows, (r) => r.m) / d3.sum(rows, (r) => r.q);
  svg.append('line').attr('x1', x(avg)).attr('x2', x(avg)).attr('y1', top - 8).attr('y2', H - 20).attr('stroke', css('--chalk-2')).attr('stroke-dasharray', '3 3');
  svg.append('text').attr('x', x(avg) + 5).attr('y', top - 8).text('state average ' + pct0(avg));
  const g = svg.selectAll('g.r').data(rows).join('g').attr('class', 'r').attr('transform', (r, i) => `translate(0,${top + i * rowH})`).style('cursor', 'pointer');
  const on = (r) => r.d === focus;
  g.append('text').attr('class', (r) => (on(r) ? 'gold-b' : 'ink')).attr('x', 0).attr('y', 15).text((r) => 'District ' + r.d);
  g.append('rect').attr('x', left).attr('y', 6).attr('height', 11).attr('rx', 2).attr('width', (r) => x(r.cr) - left).attr('fill', (r) => (on(r) ? dColor(r.d) : css('--other'))).attr('opacity', 0.6);
  g.append('line').attr('x1', left).attr('x2', (r) => x(r.mr)).attr('y1', 11.5).attr('y2', 11.5).attr('stroke', (r) => (on(r) ? dColor(r.d) : css('--other'))).attr('stroke-width', 1.5);
  g.append('circle').attr('cx', (r) => x(r.mr)).attr('cy', 11.5).attr('r', (r) => (on(r) ? 7 : 5)).attr('fill', (r) => (on(r) ? dColor(r.d) : css('--other'))).attr('stroke', css('--house')).attr('stroke-width', 2);
  g.append('text').attr('class', (r) => (on(r) ? 'ink-b' : '')).attr('x', (r) => x(r.mr) + 11).attr('y', 15).text((r) => pct0(r.mr));
  bindTip(g.append('rect').attr('class', 'hit').attr('width', W).attr('height', rowH), (r) => tipHTML(`District ${r.d} · AAA 1999–2026`, `${pct1(r.mr)} of qualifiers medaled`, `${fmt(r.q)} qualifiers · ${fmt(r.m)} medals · ${r.c} titles (${pct1(r.cr)})`));
  g.on('click', (ev, r) => { location.hash = '#district-' + r.d; });
}

/* ---------------- District 11 deep dive (Class AAA) ---------------- */
function d11Section() {
  return `<div class="section-title"><div><h2>Inside District 11</h2><p>The district tournament and the Northeast Regional, ${d3.min(D11, (r) => r.year)}–${d3.max(D11, (r) => r.year)}, Class AAA. District 11 is the one district with its full tournament history here, so every wrestler's path from district to regional to state can be traced.</p></div></div>
  <section class="sheet"><h2>The District 11 programs</h2><p class="sub">Every District 11 school with a AAA district title, ranked by district titles, with its AAA district and state title counts. Click a logo for the school.</p><div class="logos" id="d11-seals"></div></section>
  <section class="sheet"><h2>Every District 11 AAA district champion</h2><p class="sub">One square per district champion, colored by school. Seasons run left to right; weights run lightest (top) to heaviest. Click a school chip to isolate it.</p>
  <div class="controls"><input class="field" id="d11-q" type="search" placeholder="Highlight a wrestler or school" aria-label="Highlight a District 11 wrestler or school"><button class="ghost" type="button" id="d11-clear">Show all schools</button></div><div class="legend" id="d11-legend"></div><div class="chart" data-c="d11-grid" style="margin-top:12px"></div></section>
  <div class="two">${panel('d11-pipe', 'From district to regional to state', 'Every District 11 district champion, how many also won the Northeast Regional that season, and how many finished as state champion.')}${panel('d11-reg', 'Northeast Regional champions by district', 'District 11 shares the Northeast AAA Regional with Districts 2 and 4, and with District 12 since 2013.')}</div>
  <div class="two">${panel('d11-conv', 'District champions who also won state', 'Faded bar: district titles. Solid bar: those that became state titles the same season. The label is the conversion rate.')}${panel('d11-streak', 'Longest runs with a district champion', 'Consecutive seasons in which the school crowned at least one district champion.')}</div>
  <div class="two">${panel('d11-dec', 'Share of district titles by decade', 'The first and last bars are partial decades.')}<section class="sheet"><h2>State champions who did not win districts</h2><p class="sub">District 11 wrestlers who lost, or did not wrestle, at the district tournament and still won the AAA state title.</p><div data-c="d11-snd"></div></section></div>`;
}
function d11Draw() {
  const tot = Array.from(d3.rollup(D11, (v) => v.length, (r) => r.school)).sort((a, b) => b[1] - a[1]);
  const stAAA = d3.rollup(CH.filter((r) => r.cls === 'AAA'), (v) => v.length, (r) => r.sch);
  $view.querySelector('#d11-seals').innerHTML = tot.map(([s, n]) => `<a class="logo-card" href="${schoolHref(s)}" data-foil-host>${LG.foil(canon(s), { size: 84, live: true })}<b>${esc(canon(s) === 'William Allen' ? 'Allen' : s)}</b><span>${n} district, ${stAAA.get(canon(s)) || 0} state</span></a>`).join('');
  const top = tot.slice(0, 7).map((t) => t[0]);
  const pal = SB ? SB.palette(top, 'light') : {};
  const col = (s) => pal[s] || css('--other');
  const leg = $view.querySelector('#d11-legend');
  const drawLeg = () => {
    leg.innerHTML = top.map((s) => `<button type="button" data-s="${esc(s)}" aria-pressed="${state.d11focus === s}" class="${state.d11focus && state.d11focus !== s ? 'dim' : ''}"><i style="background:${col(s)}"></i>${badge(s, 18)}${esc(s)} <span class="mini">${tot.find((t) => t[0] === s)[1]}</span></button>`).join('') + `<button type="button" data-s="__other" aria-pressed="${state.d11focus === '__other'}" class="${state.d11focus && state.d11focus !== '__other' ? 'dim' : ''}"><i style="background:${css('--other')}"></i>All other schools</button>`;
  };
  const drawGrid = () => {
    const h = host('d11-grid'); h.innerHTML = '';
    const ql = state.d11q.toLowerCase();
    const match = (r) => r.name.toLowerCase().includes(ql) || r.school.toLowerCase().includes(ql);
    const inF = (r) => !state.d11focus || (state.d11focus === '__other' ? !top.includes(r.school) : r.school === state.d11focus);
    championGrid(h, D11, { label: 'District 11 district champions', eraLine: false, color: (r) => col(r.school), dim: (r) => !inF(r) || (ql && !match(r)), mark: (r) => ql && match(r),
      tip: (r) => tipHTML(`${r.year} · ${r.w === 'UNL' ? 'Unlimited' : r.w + ' lb'}`, r.name, esc(r.school), r.school), click: (r) => { location.hash = schoolHref(r.school); } });
  };
  leg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.d11focus = state.d11focus === b.dataset.s ? null : b.dataset.s; drawLeg(); drawGrid(); });
  const q = $view.querySelector('#d11-q'); q.value = state.d11q; q.addEventListener('input', () => { state.d11q = q.value.trim(); drawGrid(); });
  $view.querySelector('#d11-clear').addEventListener('click', () => { state.d11focus = null; state.d11q = ''; q.value = ''; drawLeg(); drawGrid(); });
  drawLeg(); drawGrid();

  const key = (r) => r.year + '|' + nkey(r.name);
  const rk = new Set(REG.map(key));
  const st11 = CH.filter((r) => r.cls === 'AAA' && r.d === 11);
  const sk = new Set(st11.map(key)), dk = new Set(D11.map(key));
  const nReg = D11.filter((r) => rk.has(key(r))).length, nSt = D11.filter((r) => sk.has(key(r))).length;
  const ph = host('d11-pipe');
  const steps = [['District champions', D11.length], ['Also won the Northeast Regional', nReg], ['Also won the state title', nSt]];
  const Wd = widthOf(ph), rowH = 66, svg = svgIn(ph, Wd, steps.length * rowH, 'District 11 pipeline');
  const x = d3.scaleLinear([0, D11.length], [0, Wd - 4]);
  steps.forEach(([lab, v], i) => {
    const g = svg.append('g').attr('transform', `translate(0,${i * rowH})`);
    g.append('text').attr('class', 'num').attr('x', 0).attr('y', 19).style('font-size', '24px').style('fill', i === 2 ? css('--gold') : null).text(fmt(v));
    g.append('text').attr('class', 'ink').attr('x', textW(fmt(v), 24, 800) + 12).attr('y', 18).text(Wd < 560 ? lab.replace('Also won the Northeast Regional', 'Won the regional').replace('Also won the state title', 'Won state') + (i ? ` · ${pct0(v / D11.length)}` : '') : lab + (i ? `, ${pct0(v / D11.length)} of district champions` : ''));
    g.append('rect').attr('x', 0).attr('y', 28).attr('height', 24).attr('rx', 5).attr('width', x(D11.length)).attr('fill', '#f1f3f5').attr('stroke', css('--rule'));
    g.append('rect').attr('x', 0).attr('y', 28).attr('height', 24).attr('rx', 5).attr('width', Math.max(2, x(v))).attr('fill', i === 2 ? css('--gold') : dColor(11)).attr('opacity', [0.5, 0.8, 1][i]);
  });
  const regYears = d3.range(d3.min(REG, (r) => r.year), d3.max(REG, (r) => r.year) + 1);
  const rd = (dd) => d3.rollup(REG.filter((r) => (dd === 'x' ? ![11, 2, 4].includes(+r.d) : +r.d === dd)), (v) => v.length, (r) => r.year);
  const r11 = rd(11), r2 = rd(2), r4 = rd(4), rx = rd('x');
  host('d11-reg').insertAdjacentHTML('beforebegin', `<p class="sub" style="margin-top:-8px">District 11 has won <b>${pct0(REG.filter((r) => +r.d === 11).length / REG.length)}</b> of the ${fmt(REG.length)} regional titles on record. Orange: District 11; light gray: District 2; dark gray: District 4.</p>`);
  yearBars(host('d11-reg'), regYears, [{ get: (y) => r11.get(y), color: dColor(11) }, { get: (y) => r2.get(y), color: css('--chalk-2'), opacity: 0.5 }, { get: (y) => r4.get(y), color: css('--other') }, { get: (y) => rx.get(y), color: css('--rule') }], { label: 'Regional champions by district',
    tip: (y) => tipHTML(String(y), `District 11: ${r11.get(y) || 0} of ${(r11.get(y) || 0) + (r2.get(y) || 0) + (r4.get(y) || 0) + (rx.get(y) || 0)}`, `District 2: ${r2.get(y) || 0} · District 4: ${r4.get(y) || 0}${rx.get(y) ? ' · District 12: ' + rx.get(y) : ''}`) });
  const conv = tot.slice(0, 10).map(([s, n]) => { const dd = D11.filter((r) => r.school === s && sk.has(key(r))).length; return { label: s, school: s, n, dd, segs: [{ v: dd, color: sColor(s) }, { v: n - dd, color: sColor(s), opacity: 0.22 }], valueLabel: `${pct0(dd / n)} (${dd} of ${n})` }; });
  barList(host('d11-conv'), conv, { badge: true, label: 'District to state conversion by school', tip: (r) => tipHTML('Same-season district and state titles', r.school, `${r.dd} of ${r.n} district champions also won state (${pct1(r.dd / r.n)})`, r.school), href: (r) => schoolHref(r.school) });
  const lastY = d3.max(D11, (r) => r.year);
  const streaks = d3.groups(D11, (r) => r.school).map(([s, rs]) => { const ys = Array.from(new Set(rs.map((r) => r.year))).sort((a, b) => a - b); let best = { n: 0 }, cur = { n: 0 }; ys.forEach((y, i) => { cur = i && y === ys[i - 1] + 1 ? { n: cur.n + 1, from: cur.from, to: y } : { n: 1, from: y, to: y }; if (cur.n > best.n) best = cur; }); return { school: s, ...best, active: best.to === lastY }; }).sort((a, b) => b.n - a.n).slice(0, 8);
  barList(host('d11-streak'), streaks.map((s) => ({ label: s.school, school: s.school, segs: [{ v: s.n, color: sColor(s.school) }], valueLabel: `${s.n} seasons (${s.from}–${s.to}${s.active ? ', active' : ''})`, s })), { badge: true, label: 'Longest district title streaks', tip: (r) => tipHTML(`${r.s.from}–${r.s.to}`, r.school, `${r.s.n} straight seasons with a district champion${r.s.active ? ' (still going)' : ''}`, r.school), href: (r) => schoolHref(r.school) });
  const decs = Array.from(new Set(D11.map((r) => decadeOf(r.year)))).sort();
  const dh = host('d11-dec'); const DW = widthOf(dh), rowH2 = 34, left = 52, DH = decs.length * rowH2 + 22;
  const xs = d3.scaleLinear([0, 1], [left, DW - 4]);
  const dsvg = svgIn(dh, DW, DH, 'District 11 title share by decade');
  decs.forEach((dc, i) => {
    const rs = D11.filter((r) => decadeOf(r.year) === dc);
    const counts = top.map((s) => [s, rs.filter((r) => r.school === s).length]).concat([['All other schools', rs.filter((r) => !top.includes(r.school)).length]]);
    let acc = 0;
    dsvg.append('text').attr('class', 'ink').attr('x', 0).attr('y', i * rowH2 + 21).text(dc + 's');
    counts.forEach(([s, n]) => {
      if (!n) return;
      const r = dsvg.append('rect').attr('x', xs(acc / rs.length) + 1).attr('y', i * rowH2 + 5).attr('height', rowH2 - 10).attr('rx', 3).attr('width', Math.max(0, xs((acc + n) / rs.length) - xs(acc / rs.length) - 2)).attr('fill', s === 'All other schools' ? css('--other') : col(s));
      bindTip(r, () => tipHTML(dc + 's', s, `${n} of ${rs.length} district titles (${pct0(n / rs.length)})`, s === 'All other schools' ? null : s));
      acc += n;
    });
  });
  dsvg.append('g').selectAll('text.t').data([0, 0.5, 1]).join('text').attr('x', xs).attr('y', DH - 4).attr('text-anchor', (v) => (v === 0 ? 'start' : v === 1 ? 'end' : 'middle')).text(pct0);
  const snd = st11.filter((r) => !dk.has(key(r))).map((r) => ({ year: r.year, w: r.w, name: r.name, school: r.school }));
  sortableTable(host('d11-snd'), [{ key: 'year', label: 'Season', num: true }, { key: 'w', label: 'Weight' }, { key: 'name', label: 'State champion' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }], snd, { sort: 'year', maxH: '340px' });
}

/* ================================================================ Weights */
VIEWS.weights = function () {
  const all = SC();
  const hvAll = heaviness(all);
  const dlist = d3.range(1, 13).map((d) => ({ d, rows: all.filter((r) => r.d === d) })).filter((o) => o.rows.length >= 20).map((o) => ({ ...o, h: heaviness(o.rows) })).sort((a, b) => b.h - a.h);
  $view.innerHTML = pageHead(`Weight classes, ${clsName()}`, 'Who wins where on the scale',
    `Each season's weight classes are ranked from lightest to heaviest, so champions from different eras are compared by where they sat in that year's lineup, not by pounds. In ${clsName()}, ${dlist.length ? `District ${dlist[0].d} leans heaviest and District ${dlist[dlist.length - 1].d} lightest.` : ''}`) +
    `<section class="sheet"><h2>Weight fingerprint by district</h2><p class="sub">Share of each district's ${clsName()} titles in each fifth of the lineup. The dashed line is the statewide share for this class. Ordered from heaviest-leaning to lightest; districts with fewer than 20 titles are left out.</p><div class="three" id="w-grid"></div></section>` +
    `<div class="two">${panel('w-schools', 'Heavyweight and lightweight programs', `Schools with eight or more ${clsName()} titles, placed by the average lineup position of their champions (0 = lightest weight, 1 = heaviest). The dashed line is the class average.`)}${panel('w-hist', 'The weight classes through history', `The weights contested in ${clsName()} by season. Pennsylvania has reshuffled its lineup several times; the current 13 weights date from 2023.`)}</div>`;
  const grid = $view.querySelector('#w-grid');
  const per = Math.max(1, Math.floor(widthOf(grid) / 300));
  dlist.forEach((o) => {
    const card = document.createElement('a');
    card.className = 'fpcard'; card.href = '#district-' + o.d;
    card.innerHTML = `<span class="fph"><b style="color:${dColor(o.d)}">${o.d}</b><span>District ${o.d}<br><span class="mini">${o.rows.length} titles · ${o.h > hvAll ? 'heavier' : 'lighter'} by ${Math.abs((o.h - hvAll) * 100).toFixed(0)} pts</span></span></span>`;
    const h = document.createElement('div'); h.className = 'chart'; card.append(h); grid.append(card);
    fpChart(h, o.rows, all, dColor(o.d), { H: 150, W: Math.max(240, widthOf(grid) / per - 40), label: `District ${o.d} weight fingerprint` });
  });
  const sc = Array.from(d3.rollup(all, (v) => v, (r) => r.sch)).filter(([, v]) => v.length >= 8).map(([s, v]) => ({ school: s, n: v.length, h: heaviness(v), d: v[0].d })).sort((a, b) => b.h - a.h);
  const h = host('w-schools');
  if (!sc.length) { h.innerHTML = '<p class="empty">No school has eight titles in this class.</p>'; }
  else {
    const W = widthOf(h), rowH = 22, left = Math.min(W * 0.42, d3.max(sc, (s) => textW(s.school, 12.5, 400)) + 30), H = sc.length * rowH + 26;
    const x = d3.scaleLinear([0.2, 0.8], [left, W - 30]);
    const svg = svgIn(h, W, H, 'Average weight position of champions by school');
    svg.append('line').attr('x1', x(hvAll)).attr('x2', x(hvAll)).attr('y1', 0).attr('y2', H - 20).attr('stroke', css('--chalk-2')).attr('stroke-dasharray', '3 3');
    svg.append('g').selectAll('text').data([0.2, 0.35, 0.5, 0.65, 0.8]).join('text').attr('x', x).attr('y', H - 4).attr('text-anchor', 'middle').text((v) => (v === 0.2 ? '← lighter' : v === 0.8 ? 'heavier →' : v.toFixed(2)));
    const g = svg.selectAll('g.s').data(sc).join('g').attr('class', 's').attr('transform', (s, i) => `translate(0,${i * rowH})`).style('cursor', 'pointer');
    g.append('image').attr('href', (s) => badgeURL(s.school, 18, 'chip')).attr('x', 0).attr('y', 2).attr('width', 18).attr('height', 18);
    g.append('text').attr('class', 'ink').attr('x', 24).attr('y', 15).text((s) => s.school);
    const cx = (s) => x(Math.max(0.2, Math.min(0.8, s.h)));
    g.append('line').attr('x1', x(hvAll)).attr('x2', cx).attr('y1', 11).attr('y2', 11).attr('stroke', (s) => sColor(s.school)).attr('stroke-width', 2);
    g.append('circle').attr('cx', cx).attr('cy', 11).attr('r', 5.5).attr('fill', (s) => sColor(s.school)).attr('stroke', css('--house')).attr('stroke-width', 1.5);
    bindTip(g.append('rect').attr('class', 'hit').attr('width', W).attr('height', rowH), (s) => tipHTML(`District ${s.d} · ${s.n} ${clsName()} titles`, s.school, `Average lineup position ${s.h.toFixed(2)} (class average ${hvAll.toFixed(2)})`, s.school));
    g.on('click', (ev, s) => { location.hash = schoolHref(s.school); });
  }
  const wts = Array.from(new Set(all.map((r) => r.w))).sort((a, b) => wNum(a) - wNum(b));
  const [y0, y1] = yearsOf(all);
  const hh = host('w-hist'); const HW = widthOf(hh), rh = 15, hl = 44, HH = wts.length * rh + 26;
  const hx = d3.scaleLinear([y0, y1 + 1], [hl, HW - 6]);
  const hs = svgIn(hh, HW, HH, 'Weight classes contested by season');
  const ticks = d3.range(Math.ceil(y0 / 10) * 10, y1 + 1, 10);
  hs.append('g').selectAll('line').data(ticks).join('line').attr('x1', hx).attr('x2', hx).attr('y1', 0).attr('y2', HH - 20).attr('stroke', css('--grid'));
  hs.append('g').selectAll('text').data(ticks).join('text').attr('x', hx).attr('y', HH - 5).attr('text-anchor', 'middle').text((v) => v);
  wts.forEach((w, i) => {
    const ys = Array.from(new Set(all.filter((r) => r.w === w).map((r) => r.year))).sort((a, b) => a - b);
    hs.append('text').attr('class', 'ink').attr('x', hl - 6).attr('y', i * rh + 11).attr('text-anchor', 'end').style('font-size', '10.5px').text(w);
    const runs = []; let s = ys[0], p = ys[0];
    ys.slice(1).concat([null]).forEach((y) => { if (y === p + 1) p = y; else { runs.push([s, p]); s = y; p = y; } });
    runs.forEach(([a, b]) => {
      const r = hs.append('rect').attr('x', hx(a)).attr('y', i * rh + 3).attr('width', Math.max(2, hx(b + 1) - hx(a) - 1)).attr('height', rh - 5).attr('rx', 2).attr('fill', css('--chalk-2')).attr('opacity', .8);
      bindTip(r, () => tipHTML(w === 'UNL' ? 'Unlimited' : w + ' lb', `${a}${b > a ? '–' + b : ''}`, `${all.filter((q) => q.w === w && q.year >= a && q.year <= b).length} champions`));
    });
  });
};

/* ================================================================ Dynasties */
VIEWS.dynasties = function () {
  const all = SC();
  const seasons = d3.rollups(all, (v) => v, (r) => r.sch, (r) => r.year).flatMap(([s, ys]) => ys.map(([year, v]) => ({ school: s, year, n: v.length, names: v.map((r) => r.w + ' ' + r.name).join(', '), d: v[0].d }))).filter((o) => o.n >= 3).sort((a, b) => b.n - a.n || b.year - a.year);
  const streaks = Array.from(d3.rollup(all, (v) => v, (r) => r.sch)).filter(([, v]) => v.length >= 4).map(([s, v]) => { const ys = Array.from(new Set(v.map((r) => r.year))).sort((a, b) => a - b); let best = { n: 0 }, cur = { n: 0 }; ys.forEach((y, i) => { cur = i && y === ys[i - 1] + 1 ? { n: cur.n + 1, from: cur.from, to: y } : { n: 1, from: y, to: y }; if (cur.n > best.n) best = cur; }); return { school: s, d: v[0].d, ...best }; }).sort((a, b) => b.n - a.n || b.to - a.to).slice(0, 12);
  const isAAA = state.cls === 'AAA';
  const tcount = d3.rollups(TEAMS, (v) => ({ pts: v.filter((t) => t.type === 'points').length, duals: v.filter((t) => t.type === 'duals').length, d: v[0].d }), (t) => t.sch).map(([s, o]) => ({ school: s, ...o, total: o.pts + o.duals })).sort((a, b) => b.total - a.total || b.pts - a.pts);
  const [y0, y1] = yearsOf(all);
  const decs = d3.range(decadeOf(y0), y1 + 1, 10);
  const big = seasons[0];
  $view.innerHTML = pageHead(`Dynasties, ${clsName()}`, 'The programs that ran the sport',
    `${big ? `The biggest single ${clsName()} season belongs to <a href="${schoolHref(big.school)}">${esc(big.school)}</a> in ${big.year}, with ${big.n} state champions.` : ''}${isAAA ? ` ${esc(tcount[0].school)} has the most AAA team titles (${tcount[0].pts} team points titles and ${tcount[0].duals} state duals titles).` : ''}`) +
    (isAAA ? panel('t-strip', 'AAA team champions, season by season', 'Top row: team points title at the individual state tournament, 1976 on. Bottom row: PIAA AAA state duals, current format since 1999. Colored by school; hover for the winner and runner-up.') +
      `<div class="two"><section class="sheet"><h2>Most AAA team titles</h2><p class="sub">Team points titles at the state tournament plus state duals titles.</p><div data-c="t-lead"></div></section>${panel('t-streak', 'Longest runs with a state champion', `Consecutive seasons in which a school had at least one ${clsName()} state champion.`)}</div>`
      : `<div class="two">${notePanel('Team titles', `Team title history was collected for Class AAA only. <button class="linkish" type="button" data-setcls="AAA">Switch to Class AAA</button> to see the team points and state duals champions.`)}${panel('t-streak', 'Longest runs with a state champion', `Consecutive seasons in which a school had at least one ${clsName()} state champion.`)}</div>`) +
    `<section class="sheet"><h2>Biggest single seasons</h2><p class="sub">Schools with three or more ${clsName()} state champions at one tournament.</p><div data-c="t-best"></div></section>` +
    `<section class="sheet"><h2>Programs of each decade</h2><p class="sub">The three schools with the most ${clsName()} state titles in each decade.</p><div class="three" id="t-dec-grid"></div></section>`;
  if (isAAA) {
    const h = host('t-strip'); const W = widthOf(h), years = d3.range(1976, ALL_YEARS[1] + 1), left = 92, rowH = 36, H = 2 * rowH + 26;
    const x = d3.scaleBand(years, [left, W - 4]).paddingInner(0.12);
    const svg = svgIn(h, W, H, 'AAA team champions by season');
    [['points', 'Team points'], ['duals', 'State duals']].forEach(([t, lab], i) => {
      svg.append('text').attr('class', 'ink-b').attr('x', 0).attr('y', i * rowH + 22).text(lab);
      d3.groups(TEAMS.filter((q) => q.type === t), (q) => q.year).forEach(([yr, rs]) => rs.forEach((r, j) => {
        const hh = (rowH - 8) / rs.length;
        const rect = svg.append('rect').attr('x', x(yr)).attr('y', i * rowH + 4 + j * hh).attr('width', x.bandwidth()).attr('height', hh - (rs.length > 1 ? 1 : 0)).attr('rx', 2).attr('fill', sColor(r.school)).style('cursor', 'pointer');
        bindTip(rect, () => tipHTML(`${yr} · ${lab}${r.tie ? ' (tie)' : ''}`, r.school, `District ${r.d}${r.runner ? ' · runner-up ' + esc(r.runner) : ''}`, r.school));
        rect.on('click', () => { location.hash = schoolHref(r.school); });
      }));
    });
    svg.append('g').selectAll('text').data(years.filter((y) => y % (x.bandwidth() < 12 ? 10 : 5) === 0)).join('text').attr('x', (y) => x(y) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((y) => y);
    sortableTable(host('t-lead'), [{ key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'pts', label: 'Points', num: true }, { key: 'duals', label: 'Duals', num: true }, { key: 'total', label: 'Total', num: true, render: (r) => `<span class="score">${r.total}</span>` }], tcount, { sort: 'total', maxH: '420px', accent: 'total' });
  }
  if (streaks.length) barList(host('t-streak'), streaks.map((s) => ({ label: s.school, school: s.school, segs: [{ v: s.n, color: sColor(s.school) }], valueLabel: `${s.n} seasons (${s.from}–${s.to})`, s })), { badge: true, label: 'Longest state champion streaks', tip: (r) => tipHTML(`${r.s.from}–${r.s.to}`, r.school, `${r.s.n} straight seasons with a ${clsName()} state champion`, r.school), href: (r) => schoolHref(r.school) });
  sortableTable(host('t-best'), [{ key: 'year', label: 'Season', num: true }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'n', label: 'Champions', num: true, render: (r) => `<span class="score">${r.n}</span>` }, { key: 'names', label: 'Champions (weight and name)' }], seasons, { sort: 'n', maxH: '420px', accent: 'n', empty: 'No school has had three champions in one season in this class.' });
  const dg = $view.querySelector('#t-dec-grid');
  decs.forEach((dc) => {
    const rs = all.filter((r) => decadeOf(r.year) === dc);
    if (!rs.length) return;
    const top = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const card = document.createElement('div'); card.className = 'podium';
    card.innerHTML = `<div class="dec"><b>${dc}s</b><span class="mini">${rs.length} titles</span></div>` + top.map(([s, n], i) => `<div class="row"><span class="place p${i + 1}">${i + 1}</span>${badge(s, i ? 24 : 30, 'chip')}<a href="${schoolHref(s)}" style="font-weight:${i ? 400 : 600}">${esc(s)}</a><span class="n">${n}</span></div>`).join('');
    dg.append(card);
  });
};

/* ================================================================ Schools */
VIEWS.schools = function () {
  const key = state.cls === 'AAA' ? 'aaa' : state.cls === 'AA' ? 'aa' : 'single';
  const scoped = (s) => (state.cls === 'single' ? s.single : s[key] + (usesEra() && s.lineage === state.cls ? s.single : 0));
  const rows = SCHOOLS.filter((s) => s.rows.length).map((s) => ({ ...s, cur: scoped(s), medals: medalsFor(s.school) }));
  const withAny = rows.filter((r) => r.cur > 0).length;
  $view.innerHTML = pageHead(`Schools, ${clsName()}`, 'Every school with a state champion',
    `${fmt(withAny)} schools have won at least one ${clsLong()} state title. AAA, AA and single-class titles are counted in separate columns; the highlighted column follows the class switch.`) +
    `<section class="sheet"><div class="controls"><input class="field" id="s-q" type="search" placeholder="Filter by school name" aria-label="Filter by school name"><label class="sel">District <select id="s-d"><option value="all">All</option>${d3.range(1, 13).map((d) => `<option value="${d}">${d}</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="s-only" checked> Only schools with ${clsName()} titles</label></div><div data-c="s-table"></div></section>`;
  const seg = $view.querySelector('#s-d');
  let df = 'all', q = '', only = true;
  const tbl = sortableTable(host('s-table'), [
    { key: 'school', label: 'School', render: (r) => whoLink(r.school, 22) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) },
    { key: 'aaa', label: 'AAA', num: true }, { key: 'aa', label: 'AA', num: true }, { key: 'single', label: '1938–73', num: true }
  ].concat(usesEra() ? [{ key: 'cur', label: `${state.cls} with 1938–73`, num: true, render: (r) => `<span class="score">${r.cur}</span>` }] : []).concat([
    { key: 'medals', label: 'AAA medals', num: true }
  ]), rows, { sort: usesEra() ? 'cur' : key, maxH: '660px', accent: usesEra() ? 'cur' : key });
  const apply = () => { tbl.redraw(rows.filter((r) => (df === 'all' || r.d === +df) && (!only || r.cur > 0) && r.school.toLowerCase().includes(q))); };
  seg.addEventListener('change', () => { df = seg.value; apply(); });
  $view.querySelector('#s-q').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); apply(); });
  $view.querySelector('#s-only').addEventListener('change', (e) => { only = e.target.checked; apply(); });
  apply();
};

function schoolView(sl) {
  const s = SCHOOL_BY_SLUG.get(sl);
  if (!s) { $view.innerHTML = pageHead('Schools', 'School not found', 'That school has no state or District 11 champions on record. <a href="#schools">See every school</a>.'); return; }
  const id = SB && SB.identity(s.school);
  const d11rows = D11.filter((r) => r.sch === s.school);
  const teams = TEAMS.filter((t) => t.sch === s.school);
  const medals = medalsFor(s.school);
  const col = LG.colorsOf(s.school);
  const lin = s.lineage ? `Wrestles in Class ${s.lineage}${s.aaa && s.aa ? ', with titles in both AAA and AA' : ''}.` : (s.single ? 'Titles only from the single-class era.' : '');
  const about = [id && id.mascot ? esc(id.mascot) + '.' : '', id && id.colors_named ? esc(id.colors_named.charAt(0).toUpperCase() + id.colors_named.slice(1)) + '.' : '', lin].filter(Boolean).join(' ');
  const sewnGroup = (label, rs) => { if (!rs.length) return ''; const yrs = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.year)).sort((a, b) => a[0] - b[0]); return `<h3>${label}</h3><div class="yrs">${yrs.map(([y, n]) => `<span>${y}${n > 1 ? `<i> ×${n}</i>` : ''}</span>`).join('')}</div>`; };
  const sewn = [sewnGroup('Class AAA state champions', s.rows.filter((r) => r.cls === 'AAA')), sewnGroup('Class AA state champions', s.rows.filter((r) => r.cls === 'AA')), sewnGroup('State champions, 1938–73', s.rows.filter((r) => r.cls === 'single'))].filter(Boolean).join('<div style="height:12px"></div>');
  const c = sColor(s.school);
  $view.innerHTML = `<header class="school-hero" style="--field:${col.field};--thread:${col.thread}">
      <div class="plate" data-foil-host>${LG.foil(s.school, { size: 210, live: true })}</div>
      <div><p class="crumb">${s.d ? `<a href="#district-${s.d}">District ${s.d}</a>, ${esc(DISTRICTS[s.d])}` : ''}</p><h1>${esc(s.school)}</h1>${about ? `<p class="about">${about}</p>` : ''}</div>
      ${sewn ? `<div class="sewn">${sewn}</div>` : ''}
    </header>` +
    tiles([[s.aaa + s.aa + s.single, 'state titles, all classes'], [s.aaa, 'Class AAA'], [s.aa, 'Class AA'], [s.single, '1938–73'], [medals ?? '—', 'AAA state medals'], [teams.length, 'AAA team titles']].concat(d11rows.length ? [[d11rows.length, 'District 11 AAA district titles']] : [])) +
    panel('sc-years', 'Titles by season', `<span class="key"><i style="background:${c}"></i>AAA</span><span class="key"><i style="background:${c};opacity:.45"></i>AA</span><span class="key"><i class="hatch"></i>1938–73 single class</span>${d11rows.length ? '<span class="key"><i style="background:transparent;border:1.5px solid ' + c + '"></i>District 11 title (outline)</span>' : ''} Hover a season for the names.`) +
    `<div class="two"><section class="sheet"><h2>State champions</h2><p class="sub">Every state title, with the class it was won in.</p><div data-c="sc-list"></div></section><section class="sheet"><h2>Highlights</h2><div data-c="sc-hi"></div></section></div>`;
  const firstY = d3.min([s.rows.length ? d3.min(s.rows, (r) => r.year) : null, d11rows.length ? d3.min(d11rows, (r) => r.year) : null].filter((v) => v != null)) || 1974;
  const yrs = d3.range(firstY, ALL_YEARS[1] + 1);
  const by = (cls) => d3.rollup(s.rows.filter((r) => r.cls === cls), (v) => v.length, (r) => r.year);
  const A = by('AAA'), AA = by('AA'), S1 = by('single'), DD = d3.rollup(d11rows, (v) => v.length, (r) => r.year);
  const h = host('sc-years'); const W = widthOf(h), H = 210, left = 30, top = 12, bottom = 22;
  const x = d3.scaleBand(yrs, [left, W - 4]).paddingInner(0.2);
  const max = d3.max(yrs, (y) => Math.max((A.get(y) || 0) + (AA.get(y) || 0) + (S1.get(y) || 0), DD.get(y) || 0)) || 1;
  const y = d3.scaleLinear([0, Math.max(3, max)], [H - bottom, top]).nice();
  const svg = svgIn(h, W, H, 'Titles by season');
  const pat = svg.append('defs').append('pattern').attr('id', 'hatch').attr('width', 5).attr('height', 5).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 5).attr('height', 5).attr('fill', c).attr('opacity', 0.25);
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('stroke', c).attr('stroke-width', 2.2);
  svg.append('g').selectAll('line').data(y.ticks(3)).join('line').attr('x1', left).attr('x2', W - 4).attr('y1', y).attr('y2', y).attr('stroke', css('--grid'));
  svg.append('g').selectAll('text').data(y.ticks(3).filter(Number.isInteger)).join('text').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => v);
  yrs.forEach((yr) => {
    const dd = DD.get(yr) || 0;
    if (dd) svg.append('rect').attr('x', x(yr) - 1).attr('width', x.bandwidth() + 2).attr('y', y(dd)).attr('height', y(0) - y(dd)).attr('rx', 2).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.4).attr('opacity', 0.75);
    let acc = 0;
    [[S1.get(yr), 'url(#hatch)', 1], [A.get(yr), c, 1], [AA.get(yr), c, 0.45]].forEach(([v, fill, op]) => {
      if (!v) return;
      svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(acc + v) + (acc ? 1 : 0)).attr('height', y(acc) - y(acc + v) - (acc ? 1 : 0)).attr('rx', 2).attr('fill', fill).attr('opacity', op);
      acc += v;
    });
  });
  bindTip(svg.append('g').selectAll('rect').data(yrs).join('rect').attr('class', 'hit').attr('x', (v) => x(v)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), (yr) => {
    const a = s.rows.filter((r) => r.year === yr), b = d11rows.filter((r) => r.year === yr);
    return tipHTML(String(yr), `${a.length} state${d11rows.length ? ' · ' + b.length + ' district' : ''}`, a.map((r) => `${r.cls === 'single' ? '1938–73' : r.cls} state: ${esc(r.w)} ${esc(r.name)}`).concat(b.map((r) => `District: ${esc(r.w)} ${esc(r.name)}`)).join('<br>') || 'None');
  });
  svg.append('g').selectAll('text').data(yrs.filter((v) => v % (x.bandwidth() < 7 ? 10 : 5) === 0)).join('text').attr('x', (v) => x(v) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((v) => v);
  const lr = s.rows.map((r) => ({ year: r.year, cls: r.cls, w: r.w, wn: r.wn, name: r.name }));
  if (lr.length) sortableTable(host('sc-list'), [{ key: 'year', label: 'Season', num: true }, { key: 'cls', label: 'Class', render: (r) => clsPill(r.cls) }, { key: 'wn', label: 'Weight', num: true, render: (r) => esc(r.w) }, { key: 'name', label: 'Champion' }], lr, { sort: 'year', maxH: '420px' });
  else host('sc-list').innerHTML = '<p class="empty">No state champions on record.</p>';
  const hi = [];
  ['AAA', 'AA', 'single'].forEach((cl) => {
    const rs = s.rows.filter((r) => r.cls === cl); if (!rs.length) return;
    const multi = d3.groups(rs, (r) => nkey(r.name)).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
    const best = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.year)).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    hi.push(`<div class="hiblock"><h3>${cl === 'single' ? 'Single class, 1938–73' : 'Class ' + cl}</h3><p>${rs.length} state title${rs.length === 1 ? '' : 's'}, ${d3.min(rs, (r) => r.year) === d3.max(rs, (r) => r.year) ? d3.min(rs, (r) => r.year) : d3.min(rs, (r) => r.year) + '–' + d3.max(rs, (r) => r.year)}.${best[1] > 1 ? ` Best season ${best[0]}, with ${best[1]} champions.` : ''}</p>${multi.length ? `<div class="chips">${multi.map(([, v]) => `<span>${esc(v[0].name)} ×${v.length}</span>`).join('')}</div>` : ''}</div>`);
  });
  if (teams.length) hi.push(`<div class="hiblock"><h3>AAA team titles</h3><div class="chips">${teams.sort((a, b) => a.year - b.year).map((t) => `<span>${t.year} ${t.type === 'points' ? 'team points' : 'state duals'}${t.tie ? ' (tie)' : ''}</span>`).join('')}</div></div>`);
  host('sc-hi').innerHTML = hi.join('') || '<p class="empty">No highlights yet.</p>';
}

/* ================================================================ Insights */
const SLOT_LABELS = ['107', '114', '121', '127', '133', '139', '145', '152', '160', '172', '189', '215', '285'];
VIEWS.insights = function () {
  const all = SC();
  const [y0, y1] = yearsOf(all);
  const dRank = Array.from(d3.rollup(all, (v) => v.length, (r) => r.d)).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  if (!state.rivA || !dRank.includes(state.rivA)) state.rivA = dRank.includes(11) ? 11 : dRank[0];
  if (!state.rivB || !dRank.includes(state.rivB) || state.rivB === state.rivA) state.rivB = dRank.find((d) => d !== state.rivA);
  $view.innerHTML = pageHead(`Insights, ${clsName()}`, 'Deeper cuts',
    `Seven questions the ${fmt(all.length)} ${clsName()} titles can answer: who wins the district rivalry season by season, how often champions defend, which schools own each spot in the lineup, the wrestling families, the newcomers, the climbers, and the wrestlers who won in both classes.`) +
    `<section class="sheet"><h2>Season series</h2><p class="sub">Each season, the district with more ${clsName()} state champions wins the season. Pick any two districts.</p>
      <div class="controls"><label class="sel">District <select id="riv-a">${dRank.map((d) => `<option value="${d}">${d}</option>`).join('')}</select></label><span class="vs">vs.</span><label class="sel">District <select id="riv-b">${dRank.map((d) => `<option value="${d}">${d}</option>`).join('')}</select></label></div>
      <div id="riv-score"></div><div class="chart" data-c="riv"></div></section>` +
    `<div class="two">${panel('defend', 'How often champions defend', `Share of each season's ${clsName()} champions who won again the next season (same wrestler and school, any weight). Grouped by decade.`)}${panel('fresh', 'New schools breaking through', `Schools winning their first-ever ${clsName()} state title, by decade.`)}</div>` +
    `<section class="sheet"><h2>Who owns each spot in the lineup</h2><p class="sub">Every season's weights mapped onto today's 13-weight lineup by position (lightest to heaviest), then the schools with the most ${clsName()} titles at each position. The labels are the current weights.</p><div data-c="kings"></div></section>` +
    `<div class="two"><section class="sheet"><h2>Wrestling families</h2><p class="sub">Shared surnames at one school with at least two different champions and three or more state titles between them, any class. A shared surname is a strong hint, not proof, of family.</p><div data-c="fam"></div></section><section class="sheet"><h2>The climbers</h2><p class="sub">Multi-time ${clsName()} champions who moved up the most between their first and last titles, in pounds.</p><div data-c="climb"></div></section></div>` +
    `<section class="sheet"><h2>Champions in both classes</h2><p class="sub">Wrestlers who won state titles in Class AA and Class AAA, usually after their school changed classes.</p><div data-c="both"></div></section>`;
  const sa = $view.querySelector('#riv-a'), sb = $view.querySelector('#riv-b');
  sa.value = state.rivA; sb.value = state.rivB;
  const drawRiv = () => {
    const A = state.rivA, Bd = state.rivB;
    const years = d3.range(y0, y1 + 1);
    const ca = d3.rollup(all.filter((r) => r.d === A), (v) => v.length, (r) => r.year), cb = d3.rollup(all.filter((r) => r.d === Bd), (v) => v.length, (r) => r.year);
    let w = 0, l = 0, t = 0, streak = { who: null, n: 0 }, best = { who: null, n: 0, end: null };
    years.forEach((y) => { const x = (ca.get(y) || 0) - (cb.get(y) || 0); const who = x > 0 ? A : x < 0 ? Bd : null; if (x > 0) w++; else if (x < 0) l++; else t++; if (who && who === streak.who) streak.n++; else streak = { who, n: who ? 1 : 0 }; if (streak.n > best.n) best = { ...streak, end: y }; });
    $view.querySelector('#riv-score').innerHTML = `<div class="scorebug"><div class="sb-team" style="--c:${dColor(A)}"><span class="sb-name"><span class="long">District </span><span class="short">D</span>${A}</span><span class="sb-num">${w}</span></div><div class="sb-mid"><span>${t} even</span><span>${y0}–${y1}</span></div><div class="sb-team right" style="--c:${dColor(Bd)}"><span class="sb-num">${l}</span><span class="sb-name"><span class="long">District </span><span class="short">D</span>${Bd}</span></div></div><p class="sub" style="margin:10px 0 0">Longest run: District ${best.who} won ${best.n} straight seasons, ending ${best.end}. Titles overall: District ${A} ${d3.sum(ca.values())}, District ${Bd} ${d3.sum(cb.values())}.</p>`;
    const h = host('riv'); h.innerHTML = '';
    const W = widthOf(h), H = 220, left = 26, top = 12, bottom = 22;
    const x = d3.scaleBand(years, [left, W - 4]).paddingInner(0.2);
    const mx = d3.max(years, (y) => Math.max(ca.get(y) || 0, cb.get(y) || 0)) || 1;
    const y = d3.scaleLinear([-mx, mx], [H - bottom, top]);
    const svg = svgIn(h, W, H, 'Season series between two districts');
    svg.append('line').attr('x1', left).attr('x2', W - 4).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', css('--rule'));
    svg.append('text').attr('x', left).attr('y', top + 8).attr('class', 'ink-b').text(`District ${A} ↑`);
    svg.append('text').attr('x', left).attr('y', H - bottom - 4).attr('class', 'ink-b').text(`District ${Bd} ↓`);
    years.forEach((yr) => {
      const va = ca.get(yr) || 0, vb = cb.get(yr) || 0, win = va > vb ? 'a' : vb > va ? 'b' : null;
      if (va) svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(va)).attr('height', y(0) - y(va) - 1).attr('rx', 2).attr('fill', dColor(A)).attr('opacity', win === 'a' ? 1 : 0.35);
      if (vb) svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(0) + 1).attr('height', y(-vb) - y(0) - 1).attr('rx', 2).attr('fill', dColor(Bd)).attr('opacity', win === 'b' ? 1 : 0.35);
    });
    bindTip(svg.append('g').selectAll('rect').data(years).join('rect').attr('class', 'hit').attr('x', (v) => x(v)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - top - bottom), (yr) => tipHTML(String(yr), `District ${A} ${ca.get(yr) || 0}, District ${Bd} ${cb.get(yr) || 0}`, (ca.get(yr) || 0) === (cb.get(yr) || 0) ? 'Even' : `District ${(ca.get(yr) || 0) > (cb.get(yr) || 0) ? A : Bd} wins the season`));
    svg.append('g').selectAll('text.yr').data(years.filter((v) => v % (x.bandwidth() < 7 ? 10 : 5) === 0)).join('text').attr('x', (v) => x(v) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((v) => v);
  };
  sa.addEventListener('change', () => { state.rivA = +sa.value; if (state.rivA === state.rivB) { state.rivB = dRank.find((d) => d !== state.rivA); sb.value = state.rivB; } drawRiv(); });
  sb.addEventListener('change', () => { state.rivB = +sb.value; if (state.rivA === state.rivB) { state.rivA = dRank.find((d) => d !== state.rivB); sa.value = state.rivA; } drawRiv(); });
  drawRiv();

  // defend
  const key = (r) => nkey(r.name) + '|' + r.sch;
  const byYear = d3.group(all, (r) => r.year);
  const decs = d3.range(decadeOf(y0), y1 + 1, 10);
  const def = decs.map((dc) => {
    const rs = all.filter((r) => decadeOf(r.year) === dc && r.year < y1);
    const next = rs.filter((r) => (byYear.get(r.year + 1) || []).some((q) => key(q) === key(r)));
    return { k: dc + 's', v: rs.length ? next.length / rs.length : 0, label: rs.length ? pct0(next.length / rs.length) : '', n: rs.length, m: next.length };
  }).filter((o) => o.n);
  simpleCols(host('defend'), def, { color: css('--ink-2'), max: Math.max(0.6, d3.max(def, (o) => o.v)), fmtAxis: pct0, tip: (o) => tipHTML(o.k, `${pct1(o.v)} defended`, `${o.m} of ${o.n} champions won again the next season`) });
  // fresh
  const firsts = Array.from(d3.rollup(all, (v) => d3.min(v, (r) => r.year), (r) => r.sch));
  const fr = decs.map((dc) => { const list = firsts.filter(([, y]) => decadeOf(y) === dc).map(([s]) => s); return { k: dc + 's', v: list.length, label: String(list.length), list }; });
  simpleCols(host('fresh'), fr, { color: css('--chalk-2'), tip: (o) => tipHTML(o.k, `${o.v} first-time champion schools`, o.list.slice(0, 12).map(esc).join('<br>') + (o.list.length > 12 ? '<br>…' : '')) });
  // kings
  const slotOf = (r) => Math.round(r.rel * 12);
  const kings = d3.range(13).map((i) => {
    const rs = all.filter((r) => slotOf(r) === i);
    const top = Array.from(d3.rollup(rs, (v) => v.length, (r) => r.sch)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { slot: i, w: SLOT_LABELS[i], n: rs.length, top };
  });
  const kh = host('kings');
  kh.innerHTML = `<div class="kings">${kings.map((k) => `<div class="king"><div class="kw">${k.w}<small>${k.slot === 0 ? 'lightest' : k.slot === 12 ? 'heaviest' : ''}</small></div>${k.top.map(([s, n], i) => `<a class="kr${i ? '' : ' first'}" href="${schoolHref(s)}">${badge(s, i ? 22 : 34)}<span>${esc(s)}</span><b>${n}</b></a>`).join('')}</div>`).join('')}</div>`;
  // families
  const surname = (n) => { const p = String(n).replace(/\(.*?\)/g, '').replace(/\b(jr|sr|ii|iii|iv)\.?$/i, '').trim().split(/\s+/); return p[p.length - 1]; };
  const fams = d3.groups(CH, (r) => surname(r.name).toLowerCase() + '|' + r.sch).map(([, rs]) => ({ fam: surname(rs[0].name), school: rs[0].sch, d: rs[0].d, people: Array.from(new Set(rs.map((r) => r.name))), n: rs.length, from: d3.min(rs, (r) => r.year), to: d3.max(rs, (r) => r.year) })).filter((f) => f.people.length >= 2 && f.n >= 3).sort((a, b) => b.n - a.n || b.people.length - a.people.length);
  sortableTable(host('fam'), [{ key: 'fam', label: 'Family' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'n', label: 'Titles', num: true, render: (r) => `<span class="score">${r.n}</span>` }, { key: 'people', label: 'Champions', render: (r) => esc(r.people.map((p) => p.split(' ')[0]).join(', ')) }, { key: 'from', label: 'Span', num: true, render: (r) => `${r.from}–${r.to}` }], fams, { sort: 'n', maxH: '420px', accent: 'n' });
  // climbers
  const climbs = wrestlersOf(all).filter((w) => w.n >= 2).map((w) => { const ws = w.rows.filter((r) => r.w !== 'UNL'); if (ws.length < 2) return null; const a0 = ws[0], a1 = ws[ws.length - 1]; return { name: w.name, school: w.school, from: +a0.w, to: +a1.w, gain: +a1.w - +a0.w, years: `${a0.year}–${a1.year}`, n: w.n }; }).filter(Boolean).sort((a, b) => b.gain - a.gain);
  const avg = d3.mean(climbs, (c) => c.gain);
  host('climb').insertAdjacentHTML('beforebegin', `<p class="sub" style="margin-top:-8px">Across ${climbs.length} multi-time champions, the average climb from first to last title is <b>${avg ? avg.toFixed(0) : 0} pounds</b>.</p>`);
  sortableTable(host('climb'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'from', label: 'First', num: true }, { key: 'to', label: 'Last', num: true }, { key: 'gain', label: 'Climb', num: true, render: (r) => `<span class="score">+${r.gain}</span>` }, { key: 'years', label: 'Seasons' }], climbs.slice(0, 40), { sort: 'gain', maxH: '420px', accent: 'gain' });
  // both classes
  const both = d3.groups(CH.filter((r) => r.cls !== 'single'), (r) => nkey(r.name) + '|' + r.sch).filter(([, rs]) => new Set(rs.map((r) => r.cls)).size === 2).map(([, rs]) => { rs.sort((a, b) => a.year - b.year); return { name: rs[0].name, school: rs[0].sch, d: rs[0].d, aa: rs.filter((r) => r.cls === 'AA').length, aaa: rs.filter((r) => r.cls === 'AAA').length, path: rs.map((r) => `${r.year} ${r.cls} ${r.w}`).join(' → ') }; });
  sortableTable(host('both'), [{ key: 'name', label: 'Wrestler' }, { key: 'school', label: 'School', render: (r) => whoLink(r.school, 20) }, { key: 'd', label: 'District', num: true, render: (r) => dpill(r.d) }, { key: 'aa', label: 'AA', num: true }, { key: 'aaa', label: 'AAA', num: true }, { key: 'path', label: 'Titles' }], both, { sort: 'aaa', maxH: '360px', empty: 'None on record.' });
};

/* ================================================================ About */
VIEWS.about = function () {
  $view.innerHTML = pageHead('About the data', 'Sources and caveats', '') + `<section class="sheet"><div class="prose">
  <p>State champions (${fmt(CH.length)} on record, ${ALL_YEARS[0]}–${ALL_YEARS[1]}), Class AAA state results by district, and AAA team titles come from PA-Wrestling.com's PIAA championship history pages. Per-district totals were checked against the site's medal table, which balances to the number of weight classes every year.</p>
  <p><b>Classes are kept apart.</b> Class AAA (larger schools) and Class AA (smaller schools) have crowned separate state champions since 1974, so every count, ranking and chart here covers one class at a time. Before 1974 all schools wrestled in one class. Those titles live in their own view; the "Include 1938–73" switch adds them to AAA or AA by the class each school competed in after the split (its class with the most titles since 1974, ties going to the most recent). Of the 402 single-class titles, 227 attach to AAA programs, 64 to AA programs, and 111 belong to schools with no title after 1974, which stay in the single-class view only.</p>
  <p><b>District 11</b> also has its complete AAA district tournament history (${fmt(D11.length)} champions, checked school by school against the site's totals) and the Northeast AAA Regional champions, so its district, regional and state results are linked by wrestler name and season.</p>
  <p><b>Known gaps.</b> About 22 state champions (roughly 1%, mostly late-alphabet surnames) could not be retrieved; district totals are unaffected, but a few schools may be one title short. Four Northeast Regional titles (1986, 2004, 2025 and 2026, most likely West Scranton's) are missing. AAA medal totals by school cover the state's top 80 programs; qualifier, medal and team-title data were collected for Class AAA only.</p>
  <p><b>Weights</b> are compared by position in each season's lineup (lightest = 0, heaviest = 1), not by pounds, because the weight classes have changed several times.</p>
  <p><b>School identity.</b> School colors approximate each school's named colors; schools without researched colors show a gray badge. The badges are original designs built from those colors and initials, not school logos.</p>
  <p>Sources: <a href="https://brackets.pa-wrestling.com/post-season/state/">PA-Wrestling.com state history</a>, <a href="https://brackets.pa-wrestling.com/district-11-aaa/">District 11 AAA history</a>, <a href="https://brackets.pa-wrestling.com/region-north-east-aaa/">Northeast AAA Regional history</a>, <a href="https://www.pa-wrestling.com/hs/stateduals/">PIAA State Duals</a>.</p></div></section>`;
};

/* ================================================================ chrome: nav, class switch, search */
const TABS = [['overview', 'Statewide'], ['districts', 'Districts'], ['schools', 'Schools'], ['dynasties', 'Dynasties'], ['weights', 'Weight classes'], ['insights', 'Insights'], ['about', 'Sources']];
let dmenu = null;
function closeDMenu() { if (dmenu) { dmenu.remove(); dmenu = null; document.getElementById('dm-btn')?.setAttribute('aria-expanded', 'false'); } }
function openDMenu(btn) {
  closeDMenu();
  const byD = d3.rollup(SC(), (v) => v.length, (r) => r.d);
  const h = location.hash.slice(1);
  dmenu = document.createElement('div'); dmenu.className = 'dmenu'; dmenu.setAttribute('role', 'menu');
  dmenu.innerHTML = d3.range(1, 13).map((d) => `<a role="menuitem" href="#district-${d}"${h === 'district-' + d ? ' aria-current="page"' : ''}>${dpill(d).replace('<a ', '<span ').replace('</a>', '</span>').replace(/href="[^"]*"/, '')}<span>${esc(DISTRICTS[d])}</span><span class="n">${byD.get(d) || 0}</span></a>`).join('');
  document.body.append(dmenu);
  const b = btn.getBoundingClientRect();
  dmenu.style.top = (b.bottom + 4) + 'px';
  dmenu.style.left = Math.max(10, Math.min(b.left, window.innerWidth - dmenu.offsetWidth - 10)) + 'px';
  btn.setAttribute('aria-expanded', 'true');
  dmenu.querySelector('a')?.focus();
}
function buildNav() {
  const t = document.getElementById('tabs');
  t.innerHTML = TABS.map(([k, l]) => k === 'districts'
    ? `<a href="#district-11" id="dm-btn" role="button" aria-haspopup="menu" aria-expanded="false" class="dm">${l} <span aria-hidden="true" style="font-size:10px">▾</span></a>`
    : `<a href="#${k}">${l}</a>`).join('') + (LG.isOwner ? '<a class="studio-link" href="#studio">Logo studio</a>' : '');
  const btn = document.getElementById('dm-btn');
  btn.addEventListener('click', (e) => { e.preventDefault(); dmenu ? closeDMenu() : openDMenu(btn); });
  markNav();
}
document.addEventListener('click', (e) => { if (dmenu && !e.target.closest('.dmenu') && !e.target.closest('#dm-btn')) closeDMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDMenu(); });
window.addEventListener('scroll', closeDMenu, { passive: true });
function markNav() {
  const h = location.hash.slice(1) || 'overview';
  const key = /^district-/.test(h) ? 'districts' : /^school-/.test(h) ? 'schools' : h;
  document.querySelectorAll('#tabs a').forEach((a) => {
    const k = a.id === 'dm-btn' ? 'districts' : a.getAttribute('href').slice(1);
    a.setAttribute('aria-current', k === key ? 'page' : 'false');
  });
}

function syncClassBar() {
  document.querySelectorAll('[data-cls]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cls === state.cls ? 'true' : 'false'));
  const era = document.getElementById('era');
  era.checked = state.withSingle; era.disabled = state.cls === 'single';
  document.getElementById('era-label').textContent = state.cls === 'single' ? 'Add 1938–73 titles' : `Add 1938–73 titles of later-${state.cls} schools`;
  document.getElementById('era-wrap').classList.toggle('off', state.cls === 'single');
}
function setClass(cls, withSingle) {
  if (cls) state.cls = cls;
  if (withSingle != null) state.withSingle = withSingle;
  state.focus = null;
  saveScope(); syncClassBar(); buildNav(); route(true);
}
document.querySelectorAll('[data-cls]').forEach((b) => b.addEventListener('click', () => setClass(b.dataset.cls)));
document.getElementById('era').addEventListener('change', (e) => setClass(null, e.target.checked));
$view.addEventListener('click', (e) => { const b = e.target.closest('[data-setcls]'); if (b) setClass(b.dataset.setcls); });

/* global search */
const SEARCH = (() => {
  const items = [];
  SCHOOLS.forEach((s) => items.push({ type: 'school', label: s.school, sub: `District ${s.d || '?'}. AAA ${s.aaa}, AA ${s.aa}${s.single ? ', 1938–73 ' + s.single : ''}`, href: '#school-' + s.slug, school: s.school, k: s.school.toLowerCase() }));
  d3.groups(CH, (r) => nkey(r.name) + '|' + r.sch).forEach(([, rs]) => { rs.sort((a, b) => a.year - b.year); const r = rs[0]; items.push({ type: 'wrestler', label: r.name, sub: `${r.school}: ${rs.map((q) => q.year + ' ' + (q.cls === 'single' ? '' : q.cls + ' ') + q.w).join(', ')}`, href: schoolHref(r.school), school: r.school, k: r.name.toLowerCase(), n: rs.length }); });
  return items;
})();
const $q = document.getElementById('gsearch'), $res = document.getElementById('gresults');
let hits = [], sel = -1;
const renderHits = () => {
  if (!hits.length) { $res.hidden = $q.value.trim().length < 2; $res.innerHTML = '<div class="gempty">No school or state champion by that name.</div>'; return; }
  $res.hidden = false;
  $res.innerHTML = hits.map((h, i) => `<a href="${h.href}" role="option" class="ghit${i === sel ? ' on' : ''}" aria-selected="${i === sel}">${badge(h.school, 28)}<span><b>${esc(h.label)}</b> <span class="t">${h.type === 'school' ? 'School' : 'State champion' + (h.n > 1 ? ', ' + h.n + ' titles' : '')}</span><br><span class="mini">${esc(h.sub)}</span></span></a>`).join('');
};
$q.addEventListener('input', () => {
  const q = $q.value.trim().toLowerCase();
  if (q.length < 2) { hits = []; $res.hidden = true; return; }
  hits = SEARCH.filter((it) => it.k.includes(q)).sort((a, b) => (a.k.startsWith(q) ? 0 : 1) - (b.k.startsWith(q) ? 0 : 1) || (a.type === 'school' ? 0 : 1) - (b.type === 'school' ? 0 : 1) || a.label.localeCompare(b.label)).slice(0, 9);
  sel = hits.length ? 0 : -1; renderHits();
});
$q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderHits(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sel]) { location.hash = hits[sel].href; $q.value = ''; $res.hidden = true; $q.blur(); }
  else if (e.key === 'Escape') { $q.value = ''; $res.hidden = true; $q.blur(); }
});
$res.addEventListener('click', () => { $q.value = ''; $res.hidden = true; });
document.addEventListener('click', (e) => { if (!e.target.closest('.gsearch')) $res.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $q.focus(); } });

/* ================================================================ router */
function route(keepScroll) {
  const h = location.hash.slice(1) || 'overview';
  tip.hide();
  const y = window.scrollY;
  let m;
  if (h === 'studio') { closeDMenu(); LogoStudio.render($view, { schools: SCHOOLS.map((o) => ({ school: o.school, d: o.d, titles: o.rows.length })).sort((a, b) => b.titles - a.titles) }); }
  else if ((m = h.match(/^district-(\d{1,2})$/)) && +m[1] >= 1 && +m[1] <= 12) districtView(+m[1]);
  else if ((m = h.match(/^school-([a-z0-9-]+)$/))) schoolView(m[1]);
  else (VIEWS[h] || VIEWS.overview)();
  markNav();
  document.title = (h === 'overview' ? '' : (document.querySelector('#view h1')?.textContent || '') + ', ') + 'PA Wrestling Almanac';
  if (keepScroll === true) window.scrollTo(0, y);
  else { $view.classList.remove('enter'); void $view.offsetWidth; $view.classList.add('enter'); }
  closeDMenu();
}
LG.setKey((sc) => slug(canon(sc)));
let lgTimer = null, wasOwner = false;
LG.onChange(() => {
  if (LG.isOwner !== wasOwner) { wasOwner = LG.isOwner; buildNav(); }
  if (location.hash === '#studio') return; // the studio redraws itself
  clearTimeout(lgTimer); lgTimer = setTimeout(() => route(true), 120);
});
LG.init();
syncClassBar();
buildNav();
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
let lastW = 0, rt = null;
new ResizeObserver(() => { const w = Math.round($view.getBoundingClientRect().width); if (Math.abs(w - lastW) > 24) { lastW = w; clearTimeout(rt); rt = setTimeout(() => route(true), 160); } }).observe($view);
route();
lastW = Math.round($view.getBoundingClientRect().width);
})();
