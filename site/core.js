/* PA Wrestling Almanac, core: data model, scope, helpers and the chart primitives every page shares.
   The organizing idea: every state champion is one mark on the mat, placed by season and lineup spot.
   State, district and school pages all show the same mat, filtered to that unit, and its two projections. */
'use strict';
const RAW = window.WR_DATA;
const SB = window.SchoolBadge;
const LG = window.Logos;
const $view = document.getElementById('view');
const $tip = document.getElementById('tip');

/* ---------------- helpers ---------------- */
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
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const span = (ys) => { const a = d3.min(ys), b = d3.max(ys); return a === b ? String(a) : `${a}–${b}`; };
const wLabel = (w) => (w === 'UNL' ? 'Unlimited' : w + ' lb');

/* ---------------- data ---------------- */
const CH = RAW.champs.concat(window.WR_CHAMP_FILL || []).map(([year, cls, w, name, school, d]) => ({ year, cls, w, wn: wNum(w), name, school, sch: canon(school), d, place: 1 }));
d3.group(CH, (r) => r.year + r.cls).forEach((rs) => rs.sort((a, b) => a.wn - b.wn).forEach((r, i) => { r.slot = i; r.n = rs.length; r.rel = rs.length > 1 ? i / (rs.length - 1) : 0.5; }));
/* every state medalist, with the lineup position of his weight in that season */
const MEDALS = (window.WR_MEDALS || []).map(([year, cls, w, place, name, school, d]) => ({ year, cls, w, wn: wNum(w), place, name, school, sch: canon(school), d, slot: 0, n: 1, rel: 0.5 }));
{ const lineup = new Map(); d3.group(CH, (r) => r.year + r.cls).forEach((rs, k) => lineup.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => r.wn)));
  MEDALS.forEach((m) => { const L = lineup.get(m.year + m.cls); if (!L) return; let i = L.indexOf(m.wn); if (i < 0) i = L.findIndex((v) => v >= m.wn); if (i < 0) i = L.length - 1; m.slot = i; m.n = L.length; m.rel = L.length > 1 ? i / (L.length - 1) : 0.5; }); }
const HAS_MEDALS = MEDALS.length > 0;
/* each season's lineup, lightest first: [{wn, w}] */
const LINEUP = new Map(); d3.group(CH, (r) => r.year + '|' + r.cls).forEach((rs, k) => LINEUP.set(k, rs.slice().sort((a, b) => a.wn - b.wn).map((r) => ({ wn: r.wn, w: r.w }))));
const DIST = RAW.dist.map(([year, cls, d, champs, finalists, medalists, qualifiers]) => ({ year, cls, d, champs, finalists, medalists, qualifiers }));
const TEAMS = RAW.teams.map(([year, type, school, d, runner, tie]) => ({ year, type, school, sch: canon(school), d, runner, tie }));
const D11 = RAW.d11.map(([year, w, name, school]) => ({ year, w, wn: wNum(w), name, school, sch: canon(school) }));
d3.group(D11, (r) => r.year).forEach((rs) => rs.sort((a, b) => a.wn - b.wn).forEach((r, i) => { r.slot = i; r.n = rs.length; r.rel = rs.length > 1 ? i / (rs.length - 1) : 0.5; }));
const REG = RAW.reg.map(([year, w, name, school, d]) => ({ year, w, name, school, d }));
const ALL_YEARS = d3.extent(CH, (r) => r.year);

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
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
/* color means who. Twelve district hues, spread around the wheel and tuned to read on dark rubber;
   the big programs (7, 11, 3, 1, 6) get the most distinct ones. */
const D_COLORS = { 1: '#e8c547', 2: '#c9a27e', 3: '#f06292', 4: '#26c6da', 5: '#a1887f', 6: '#43c37a', 7: '#5b8def', 8: '#8d6e63', 9: '#ff8a65', 10: '#b388ff', 11: '#ff7a1a', 12: '#ef5350' };
const COLORED = [7, 11, 3, 1, 6, 4, 10, 9, 12, 2, 5, 8];
const STEEL = '#8d949c';
const STEEL_2 = '#5d636a';
const CHALK = '#ecebe6';
const GHOST = '#2a2c30';
const dColor = (d) => D_COLORS[+d] || STEEL;
/* a school's color: researched colors first, then its uploaded logo, then a stable generated hue */
const genColor = (name) => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return d3.hcl((h % 360), 48, 68).formatHex(); };
const sColor = (school) => {
  if (SB && SB.identity(school)) return SB.colorFor(school, 'dark');
  if (LG && LG.has(school)) { const c = LG.colorsOf(school).field; if (LG.lum(c) < 0.85 && LG.lum(c) > 0.04) return c; }
  return genColor(school);
};
const schoolKnown = (school) => !!(SB && SB.identity(school)) || !!(LG && LG.has(school));

/* ---------------- class scope ---------------- */
const state = { cls: 'AAA', withSingle: false, level: 'state', depth: 'champ', colorBy: 'district', arYear: null, q: '', focus: null, cmp: 'districts', view: 'mat' };
try { const s = JSON.parse(localStorage.getItem('pawa-scope') || 'null'); if (s && ['AAA', 'AA', 'single'].includes(s.cls)) { state.cls = s.cls; state.withSingle = !!s.withSingle; } } catch (e) { /* storage unavailable */ }
const saveScope = () => { try { localStorage.setItem('pawa-scope', JSON.stringify({ cls: state.cls, withSingle: state.withSingle })); } catch (e) { /* ignore */ } };
const inScope = (r) => {
  if (state.cls === 'single') return r.cls === 'single';
  if (r.cls === state.cls) return true;
  return state.withSingle && r.cls === 'single' && LINEAGE.get(r.sch) === state.cls;
};
const SC = () => CH.filter(inScope);
/* depth: champions only, or every medalist (state level, AAA and AA) */
const depthOn = () => state.depth === 'medal' && HAS_MEDALS;
const SM = () => MEDALS.filter((r) => r.cls === state.cls);
const placeName = (p) => (p === 1 ? 'champion' : ordinal(p) + ' place');
const usesEra = () => state.cls !== 'single' && state.withSingle;
const clsName = () => (state.cls === 'single' ? 'single-class' : 'Class ' + state.cls);
const clsShort = () => (state.cls === 'single' ? '1938–73' : state.cls);
const yearsOf = (rows) => d3.extent(rows, (r) => r.year);
const clsTag = (r) => (r.cls === 'single' ? '1938–73 single class' : 'Class ' + r.cls);

/* ---------------- tournament levels ---------------- */
const NE = [2, 4, 11, 12];
const REGROWS = REG.map((r) => ({ year: r.year, cls: 'AAA', w: r.w, wn: wNum(r.w), name: r.name, school: r.school, sch: canon(r.school), d: +r.d }));
d3.group(REGROWS, (r) => r.year).forEach((rs) => rs.sort((a, b) => a.wn - b.wn).forEach((r, i) => { r.slot = i; r.n = rs.length; r.rel = rs.length > 1 ? i / (rs.length - 1) : 0.5; }));
const DISTROWS = D11.map((r) => ({ year: r.year, cls: 'AAA', w: r.w, wn: r.wn, name: r.name, school: r.school, sch: r.sch, d: 11, slot: r.slot, n: r.n, rel: r.rel }));
const LEVELS = {
  state: { key: 'state', tab: 'State', noun: 'state champion', nouns: 'state champions', title: 'state title', pool: 'statewide', where: () => (state.cls === 'single' ? 'Pennsylvania, 1938–73' : `Pennsylvania, Class ${state.cls}`) },
  regional: { key: 'regional', tab: 'Regional', noun: 'regional champion', nouns: 'regional champions', title: 'regional title', pool: 'across the region', where: () => 'Northeast AAA Regional' },
  district: { key: 'district', tab: 'District', noun: 'district champion', nouns: 'district champions', title: 'district title', pool: 'across the district', where: () => 'District 11 AAA tournament' }
};
const levelRows = (lv, depth) => (lv === 'regional' ? REGROWS : lv === 'district' ? DISTROWS : depth === 'medal' && HAS_MEDALS ? SM() : SC());
const levelsFor = (u) => {
  if (state.cls !== 'AAA') return ['state'];
  if (u.kind === 'district') return ['state'].concat(NE.includes(u.d) ? ['regional'] : []).concat(u.d === 11 ? ['district'] : []);
  if (u.kind === 'school') return ['state'].concat(REGROWS.some((r) => r.sch === u.name) ? ['regional'] : []).concat(DISTROWS.some((r) => r.sch === u.name) ? ['district'] : []);
  return ['state'];
};

/* ---------------- schools ---------------- */
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
const medalsFor = (s) => { if (HAS_MEDALS) { const n = MEDALS.filter((r) => r.cls === 'AAA' && r.sch === canon(s)).length; return n || null; } const m = RAW.medals; if (m[s] != null) return m[s]; const o = SCHOOL_BY_SLUG.get(slug(s)); if (!o) return null; for (const r of o.rows) if (m[r.school] != null) return m[r.school]; return null; };
const wrestlersOf = (rows) => d3.groups(rows, (r) => nkey(r.name) + '|' + r.sch).map(([, rs]) => {
  rs.sort((a, b) => a.year - b.year);
  return { name: rs[rs.length - 1].name, school: rs[rs.length - 1].school, d: rs[0].d, n: rs.length, titles: rs.filter((r) => r.place === 1).length, best: d3.min(rs, (r) => r.place || 1), rows: rs };
}).sort((a, b) => b.n - a.n || b.titles - a.titles || a.rows[0].year - b.rows[0].year);

/* ---------------- small pieces ---------------- */
const badge = (school, size = 22) => LG.chip(canon(school), size);
const dpill = (d) => `<a class="dpill" href="#district-${+d}" title="District ${+d}, ${esc(DISTRICTS[+d])}">D${+d}</a>`;
const dtag = (d) => `<span class="dpill">D${+d}</span>`;
const whoLink = (school, size = 22) => `<a class="who" href="${schoolHref(school)}">${badge(school, size)}<span>${esc(school)}</span></a>`;
const clsPill = (c) => `<span class="cpill c-${c === 'single' ? 's' : c.toLowerCase()}">${c === 'single' ? '1938–73' : c}</span>`;
const tab = (title, sub, id) => `<div class="sec-head"${id ? ` id="${id}"` : ''}><h2 class="tab"><span>${title}</span></h2>${sub ? `<p class="sec-sub">${sub}</p>` : ''}</div>`;
const host = (id) => $view.querySelector(`[data-c="${id}"]`);

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
const svgIn = (h, W, H, label) => d3.select(h).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
const textW = (() => { const c = document.createElement('canvas').getContext('2d'); return (s, size = 13, weight = 500) => { c.font = `${weight} ${size}px Barlow, Arial, sans-serif`; return c.measureText(String(s)).width; }; })();
const widthOf = (el) => Math.max(260, Math.floor(el.getBoundingClientRect().width));

/* ---------------- table ---------------- */
function sortableTable(h, cols, rows, opts = {}) {
  let key = opts.sort || cols.find((c) => c.num)?.key, dir = opts.dir || -1;
  const box = document.createElement('div'); box.className = 'tablebox'; if (opts.maxH) box.style.maxHeight = opts.maxH;
  const t = document.createElement('table'); t.className = 'data';
  box.append(t); h.append(box);
  const draw = () => {
    const rs = rows.slice().sort((a, b) => { const va = a[key], vb = b[key]; if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir; });
    t.innerHTML = `<thead><tr>${cols.map((c) => `<th class="${c.num ? 'n' : ''}${c.key === opts.accent ? ' acc' : ''}" scope="col"><button type="button" data-k="${c.key}" ${c.key === key ? `aria-sort="${dir < 0 ? 'descending' : 'ascending'}"` : ''}>${esc(c.label)}</button></th>`).join('')}</tr></thead><tbody>${rs.length ? rs.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? 'n' : ''}${c.key === opts.accent ? ' acc' : ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">${esc(opts.empty || 'Nothing matches.')}</td></tr>`}</tbody>`;
    t.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k; if (k === key) dir = -dir; else { key = k; dir = cols.find((c) => c.num && c.key === k) ? -1 : 1; } draw(); }));
  };
  draw();
  return { redraw: (r) => { rows = r; draw(); } };
}

/* ---------------- ranked bars ---------------- */
function barList(h, rows, opts) {
  const W = widthOf(h), rowH = opts.rowH || 30, bH = 14;
  const labW = Math.min(W * (W < 480 ? 0.42 : 0.46), d3.max(rows, (r) => textW(r.label, 13.5, 600)) + (opts.badge ? 30 : 0) + 14);
  const vlab = (r) => (W < 480 && r.valueLabel ? String(r.valueLabel).replace(/ seasons/, '').replace(/ \(/, ' (') : r.valueLabel);
  const valW = d3.max(rows, (r) => textW(vlab(r) ?? d3.sum(r.segs, (s) => s.v), 15, 700)) + 16;
  const max = opts.max || d3.max(rows, (r) => d3.sum(r.segs, (s) => s.v)) || 1;
  const lw = W - labW - valW < 90 ? Math.max(110, W - valW - 90) : labW;
  const maxLabel = lw - (opts.badge ? 30 : 0) - 8;
  const fit = (s) => { s = String(s); if (textW(s, 13.5, 600) <= maxLabel) return s; while (s.length > 3 && textW(s + '…', 13.5, 600) > maxLabel) s = s.slice(0, -1); return s + '…'; };
  const x = d3.scaleLinear([0, max], [0, Math.max(40, W - lw - valW)]);
  const svg = svgIn(h, W, rows.length * rowH + 2, opts.label);
  const g = svg.selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(0,${i * rowH})`);
  if (opts.badge) g.append('image').attr('href', (r) => LG.url(canon(r.school || r.label))).attr('x', 0).attr('y', (rowH - 22) / 2).attr('width', 22).attr('height', 22);
  const lx = opts.badge ? 30 : 0;
  g.append('text').attr('class', (r) => (r.hl ? 'lab hl' : 'lab')).attr('x', lx).attr('y', rowH / 2 + 4.5).text((r) => fit(r.label));
  g.each(function (r) {
    let acc = 0; const gg = d3.select(this);
    gg.append('rect').attr('x', lw).attr('y', (rowH - bH) / 2).attr('height', bH).attr('width', x(max)).attr('fill', '#202124');
    r.segs.forEach((s) => {
      if (!s.v) return;
      gg.append('rect').attr('x', lw + x(acc)).attr('y', (rowH - bH) / 2).attr('height', bH).attr('width', Math.max(1.5, x(s.v) - (acc ? 1 : 0))).attr('fill', s.color).attr('opacity', s.opacity ?? 1);
      acc += s.v;
    });
    gg.append('text').attr('class', 'val').attr('x', lw + x(acc) + 7).attr('y', rowH / 2 + 5).text(vlab(r) ?? acc);
  });
  const hit = g.append('rect').attr('class', 'hit').attr('width', W).attr('height', rowH);
  if (opts.tip) bindTip(hit, opts.tip);
  if (opts.href) hit.on('click', (ev, r) => { location.hash = opts.href(r); });
}

/* ---------------- by season: titles per season ---------------- */
function seasonBars(h, rows, opts) {
  const [a, b] = opts.extent;
  const years = d3.range(a, b + 1);
  const W = widthOf(h), H = opts.H || 190, left = 26, right = 4, top = 14, bottom = 22;
  const x = d3.scaleBand(years, [left, W - right]).paddingInner(years.length > 70 ? 0.15 : 0.22);
  const by = d3.group(rows, (r) => r.year);
  const max = Math.max(opts.minMax || 3, d3.max(years, (y) => (by.get(y) || []).length) || 1);
  const y = d3.scaleLinear([0, max], [H - bottom, top]).nice();
  const svg = svgIn(h, W, H, opts.label || 'Titles by season');
  svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', left).attr('x2', W - right).attr('y1', y).attr('y2', y).attr('class', 'grid');
  svg.append('g').selectAll('text').data(y.ticks(4).filter(Number.isInteger)).join('text').attr('class', 'ax').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => v);
  years.forEach((yr) => {
    const rs = (by.get(yr) || []).slice().sort((p, q) => (opts.order ? opts.order(p, q) : 0));
    rs.forEach((r, i) => {
      svg.append('rect').attr('x', x(yr)).attr('width', x.bandwidth()).attr('y', y(i + 1) + 0.5).attr('height', Math.max(1, y(i) - y(i + 1) - 1))
        .attr('fill', opts.color(r)).attr('opacity', r.cls === 'single' && state.cls !== 'single' ? 0.55 : 1);
    });
  });
  if (usesEra() && a < 1974) svg.append('line').attr('x1', x(1974) - 2).attr('x2', x(1974) - 2).attr('y1', top).attr('y2', H - bottom).attr('stroke', CHALK).attr('stroke-dasharray', '3 2');
  const hit = svg.append('g').selectAll('rect').data(years).join('rect').attr('class', 'hit').attr('x', (v) => x(v) - 1).attr('width', x.bandwidth() + 2).attr('y', top).attr('height', H - top - bottom);
  bindTip(hit, (yr) => { const rs = (by.get(yr) || []).slice().sort((p, q) => p.wn - q.wn); return tipHTML(String(yr), plural(rs.length, 'champion'), rs.map((r) => `${esc(r.w)} ${esc(r.name)}${opts.showSchool ? ', ' + esc(r.school) : ''}`).join('<br>') || 'None'); });
  if (opts.click) hit.on('click', (ev, yr) => opts.click(yr));
  const stepY = x.bandwidth() < 7 ? 10 : 5;
  svg.append('g').selectAll('text.yr').data(years.filter((v) => v % stepY === 0)).join('text').attr('class', 'ax').attr('x', (v) => x(v) + x.bandwidth() / 2).attr('y', H - 5).attr('text-anchor', 'middle').text((v) => v);
}

/* ---------------- by weight: standard classes, stacked by who ----------------
   rows: the unit's titles. groups: [{k, color, test}] in display order; a row not matching any group
   falls into `rest`. ref: the pool, drawn as a dashed outline scaled to the unit's count. */
function weightClasses(h, rows, groups, opts) {
  const W = widthOf(h), narrow = W < 520;
  const H = (opts.H || 220), left = 30, right = 6, top = 20, bottom = 24;
  const ks = STD.filter((c) => rows.some((r) => stdOf(r) === c) || (opts.ref || []).some((r) => stdOf(r) === c) || (c.k !== '98'));
  const x = d3.scaleBand(ks.map((c) => c.k), [left, W - right]).paddingInner(0.22);
  const byK = d3.group(rows, (r) => stdOf(r).k);
  const count = (k) => (byK.get(k) || []).length;
  const scale = opts.ref && opts.ref.length ? rows.length / opts.ref.length : 1;
  const refCount = (k) => (opts.ref ? opts.ref.filter((r) => stdOf(r).k === k).length * scale : 0);
  const max = d3.max(ks, (c) => Math.max(count(c.k), refCount(c.k))) || 1;
  const y = d3.scaleLinear([0, max], [H - bottom, top]).nice();
  const svg = svgIn(h, W, H, opts.label || 'Titles by weight class');
  svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('class', 'grid').attr('x1', left).attr('x2', W - right).attr('y1', y).attr('y2', y);
  svg.append('g').selectAll('text').data(y.ticks(4).filter(Number.isInteger)).join('text').attr('class', 'ax').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => v);
  const stackOf = (k) => { const rs = byK.get(k) || []; const segs = groups.map((g) => ({ g, rs: rs.filter(g.test) })); const used = new Set(segs.flatMap((s2) => s2.rs)); segs.push({ g: { k: 'rest', color: opts.restColor || STEEL_2, label: opts.restLabel || 'Everyone else' }, rs: rs.filter((r) => !used.has(r)) }); return segs.filter((s2) => s2.rs.length); };
  ks.forEach((c) => {
    let acc = 0;
    stackOf(c.k).forEach((seg) => {
      const r = svg.append('rect').attr('x', x(c.k)).attr('width', x.bandwidth()).attr('y', y(acc + seg.rs.length)).attr('height', Math.max(0, y(acc) - y(acc + seg.rs.length) - (acc ? 1 : 0))).attr('fill', seg.g.color).style('cursor', opts.click ? 'pointer' : null);
      bindTip(r, () => tipHTML(`${c.label}${c.note ? ' (' + c.note + ')' : ''} · ${seg.g.label || seg.g.k}`, plural(seg.rs.length, opts.noun || 'title'), seg.rs.slice().sort((p, q) => q.year - p.year).slice(0, 6).map((q) => `${q.year} ${esc(q.name)}${groups.length ? ', ' + esc(q.school) : ''}`).join('<br>') + (seg.rs.length > 6 ? '<br>…' : '')));
      if (opts.click) r.on('click', () => opts.click(seg.rs[0]));
      acc += seg.rs.length;
    });
    if (opts.ref) { const rc = refCount(c.k); if (rc) svg.append('line').attr('x1', x(c.k) - 3).attr('x2', x(c.k) + x.bandwidth() + 3).attr('y1', y(rc)).attr('y2', y(rc)).attr('stroke', CHALK).attr('stroke-width', 2).style('pointer-events', 'none'); }
    if (count(c.k) && x.bandwidth() > 18) svg.append('text').attr('class', 'val').attr('x', x(c.k) + x.bandwidth() / 2).attr('y', y(count(c.k)) - 5).attr('text-anchor', 'middle').style('font-size', narrow ? '11px' : '12.5px').text(count(c.k));
  });
  svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', y(0) + 0.5).attr('y2', y(0) + 0.5).attr('stroke', STEEL).attr('stroke-width', 2);
  svg.append('g').selectAll('text.k').data(ks).join('text').attr('class', 'ax').attr('x', (c) => x(c.k) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').style('font-size', narrow ? '10.5px' : null).text((c) => (narrow && c.k === '98' ? '98' : c.label));
}

/* ---------------- by weight: fifths of the lineup, stacked by who ---------------- */
function fifthsChart(h, rows, groups, opts = {}) {
  const W = opts.W || widthOf(h), H = opts.H || 220, left = 30, right = 4, top = 20, bottom = opts.compact ? 18 : 30;
  const x = d3.scaleBand(d3.range(5), [left, W - right]).paddingInner(0.22);
  const tot = rows.length || 1;
  const share = (rs) => { const c = [0, 0, 0, 0, 0]; rs.forEach((r) => { const w = fifthWeights(r); for (let i = 0; i < 5; i++) c[i] += w[i]; }); return c; };
  const all = share(rows);
  const rp = opts.ref ? fifths(opts.ref) : null;
  const comp = !!opts.composition; // each fifth as 100%: who takes it
  const max = comp ? 1 : Math.max(0.3, d3.max(all) / tot, rp ? d3.max(rp) : 0);
  const y = d3.scaleLinear([0, max], [H - bottom, top]);
  const den = (i) => (comp ? (all[i] || 1) : tot);
  const svg = svgIn(h, W, H, opts.label || 'Titles by fifth of the lineup');
  svg.append('g').selectAll('text').data(comp ? [0, 0.5, 1] : y.ticks(3)).join('text').attr('class', 'ax').attr('x', left - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text(pct0);
  const segs = groups.map((g) => ({ g, c: share(rows.filter(g.test)) }));
  const used = new Set(groups.flatMap((g) => rows.filter(g.test)));
  segs.push({ g: { k: 'rest', color: opts.restColor || STEEL_2, label: opts.restLabel || 'Everyone else' }, c: share(rows.filter((r) => !used.has(r))) });
  d3.range(5).forEach((i) => {
    let acc = 0;
    segs.forEach((seg) => { const v = seg.c[i] / den(i); if (v <= 0) return;
      const r = svg.append('rect').attr('x', x(i)).attr('width', x.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v) - (acc ? 1 : 0))).attr('fill', seg.g.color);
      bindTip(r, () => tipHTML(`${FIFTHS[i]} of the lineup · ${seg.g.label || seg.g.k}`, pct1(v) + (groups.length ? ' of all ' + (opts.noun || 'title') + 's' : ' of these ' + (opts.noun || 'title') + 's'), groups.length ? `${pct1(seg.c[i] / (all[i] || 1))} of this fifth` : (rp ? `${opts.refName || 'Pool'}: ${pct1(rp[i])}` : '')));
      acc += v; });
    if (rp) svg.append('line').attr('x1', x(i) - 3).attr('x2', x(i) + x.bandwidth() + 3).attr('y1', y(rp[i])).attr('y2', y(rp[i])).attr('stroke', CHALK).attr('stroke-width', 1.8).attr('stroke-dasharray', '4 3');
    if (!comp) svg.append('text').attr('class', 'val').attr('x', x(i) + x.bandwidth() / 2).attr('y', Math.min(y(all[i] / tot), rp ? y(rp[i]) : 1e9) - 6).attr('text-anchor', 'middle').style('font-size', opts.compact ? '12px' : null).text(pct0(all[i] / tot));
    else { // label the biggest group in each fifth
      const big = segs.filter((sg) => sg.g.k !== 'rest').sort((p, q) => q.c[i] - p.c[i])[0];
      if (big && big.c[i] / den(i) > 0.12) svg.append('text').attr('class', 'val').attr('x', x(i) + x.bandwidth() / 2).attr('y', top - 6).attr('text-anchor', 'middle').style('font-size', '12px').text(`${(big.g.label || '').replace(/<[^>]+>/g, '')} ${pct0(big.c[i] / den(i))}`); }
    svg.append('text').attr('class', 'ax').attr('x', x(i) + x.bandwidth() / 2).attr('y', H - (opts.compact ? 4 : 10)).attr('text-anchor', 'middle').text(['Lightest', 'Light', 'Middle', 'Heavy', 'Heaviest'][i]);
  });
  svg.append('line').attr('x1', left).attr('x2', W - right).attr('y1', y(0) + 0.5).attr('y2', y(0) + 0.5).attr('stroke', STEEL).attr('stroke-width', 2);
}

/* ---------------- standard weight classes ----------------
   Weights drift a few pounds between eras (103 became 106 became 107). Each historical weight is
   filed under today's nearest class; 98 is kept as its own retired class, and 250/275/285/Unlimited
   are all heavyweight. */
const STD = [
  { k: '98', label: '98', note: 'retired after 1988', min: 0, max: 101 },
  { k: '107', label: '107', min: 102, max: 110 }, { k: '114', label: '114', min: 111, max: 117 }, { k: '121', label: '121', min: 118, max: 124 },
  { k: '127', label: '127', min: 125, max: 129 }, { k: '133', label: '133', min: 130, max: 136 }, { k: '139', label: '139', min: 137, max: 142 },
  { k: '145', label: '145', min: 143, max: 148 }, { k: '152', label: '152', min: 149, max: 156 }, { k: '160', label: '160', min: 157, max: 166 },
  { k: '172', label: '172', min: 167, max: 180 }, { k: '189', label: '189', min: 181, max: 200 }, { k: '215', label: '215', min: 201, max: 240 },
  { k: 'HWT', label: 'Hwt', note: '250, 275, 285 and unlimited', min: 241, max: 9999 }
];
const stdOf = (r) => STD.find((c) => r.wn >= c.min && r.wn <= c.max) || STD[STD.length - 1];
const stdIndex = new Map(STD.map((c, i) => [c.k, i]));

/* ---------------- by weight, fifths of the lineup ---------------- */
const FIFTHS = ['Lightest fifth', 'Light', 'Middle', 'Heavy', 'Heaviest fifth'];
/* each champion is spread across the fifths his lineup slot overlaps, so a 13-weight season is exactly 20% per fifth */
const fifthWeights = (r) => { const n = r.n || 13, lo = r.slot / n, hi = (r.slot + 1) / n, out = [0, 0, 0, 0, 0]; for (let i = 0; i < 5; i++) { const a = Math.max(lo, i / 5), b = Math.min(hi, (i + 1) / 5); if (b > a) out[i] = (b - a) * n; } return out; };
const bandOf = (rel) => Math.min(4, Math.floor(rel * 5));
const fifths = (rows) => { const c = [0, 0, 0, 0, 0]; rows.forEach((r) => { const w = fifthWeights(r); for (let i = 0; i < 5; i++) c[i] += w[i]; }); const n = rows.length || 1; return c.map((v) => v / n); };
const heaviness = (rows) => d3.mean(rows, (r) => r.rel);
/* one sentence that says how a unit leans */
function leanSentence(name, rows, ref, pool = 'statewide') {
  if (rows.length < 8) return `${esc(name)} has too few titles here for a reliable lean.`;
  const fp = fifths(rows), rp = fifths(ref);
  const diff = fp.map((v, i) => v - rp[i]);
  const hv = heaviness(rows) - heaviness(ref);
  const side = hv > 0 ? [3, 4] : [0, 1];
  const iMax = side.reduce((m, i) => (diff[i] > diff[m] ? i : m), side[0]);
  const word = hv > 0.04 ? 'lean heavy' : hv < -0.04 ? 'lean light' : 'are spread across the lineup about evenly';
  return `${esc(name)}’s champions ${word}${Math.abs(hv) > 0.04 ? `: ${pct0(fp[iMax])} come from the ${FIFTHS[iMax].toLowerCase().replace(' fifth', '')} fifth, against ${pct0(rp[iMax])} ${pool}` : ''}.`;
}

/* ---------------- the mat ---------------- */
function arenaMat(h, rows, opts) {
  const S = Math.max(260, Math.min(widthOf(h), opts.size || 700));
  const mini = !!opts.mini;
  const c = S / 2, R = S / 2 - (mini ? 6 : Math.max(26, S * 0.05));
  const svg = svgIn(h, S, S, opts.label || `Every ${clsName()} state champion on one mat`);
  const root = svg.append('g').attr('transform', `translate(${c},${c})`);
  const [y0, y1] = yearsOf(rows);
  const years = d3.range(y0, y1 + 1);
  const gap = mini ? 0.2 : S < 480 ? 0.5 : 0.42;
  const ang = d3.scaleBand(years, [gap / 2, 2 * Math.PI - gap / 2]).paddingInner(mini ? 0.08 : years.length > 70 ? 0.1 : 0.16);
  const band = [R * 0.3, R * 0.955];
  // each season fills the band: hub is its lightest weight, edge its heaviest
  const perYear = d3.rollup(rows, (v) => v.length, (r) => r.year);
  const arcOf = (r, pad = 0) => { const k = perYear.get(r.year) || 1, th = (band[1] - band[0]) / k, cen = band[0] + th / 2 + r.rel * (band[1] - band[0] - th); return { innerRadius: cen - th / 2 + pad, outerRadius: cen + th / 2 - pad, startAngle: ang(r.year), endAngle: ang(r.year) + ang.bandwidth() }; };
  const arc = d3.arc();
  root.append('circle').attr('r', R + (mini ? 4 : R * 0.07)).attr('fill', '#1b1c1e').attr('stroke', '#2e3033').attr('stroke-width', mini ? 3 : Math.max(5, R * 0.025));
  root.append('circle').attr('r', R * 0.995).attr('fill', 'none').attr('stroke', 'rgba(236,235,230,.5)').attr('stroke-width', mini ? 1 : 1.5);
  root.append('circle').attr('r', R * 0.275).attr('fill', '#33363a').attr('stroke', '#8d949c').attr('stroke-width', mini ? 1.5 : 3);
  const spokesG = mini ? null : root.append('g');
  const marks = root.append('g').selectAll('path').data(rows).join('path').attr('d', (r) => arc(arcOf(r, mini ? 0.2 : 0.5)));
  if (mini) {
    marks.attr('fill', opts.color);
    root.append('text').attr('class', 'mat-n').attr('text-anchor', 'middle').attr('y', R * 0.07).style('font-size', Math.round(R * 0.2) + 'px').text(opts.center || '');
    return {};
  }
  // weight guide in the top gap, labeled with today's lineup as a reference
  const guide = root.append('g').style('pointer-events', 'none');
  guide.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -band[0]).attr('y2', -band[1]).attr('stroke', 'rgba(236,235,230,.6)');
  [[0.04, '107'], [0.5, '145'], [0.96, '285']].forEach(([f, t]) => { const rr = band[0] + f * (band[1] - band[0]); guide.append('line').attr('x1', -5).attr('x2', 5).attr('y1', -rr).attr('y2', -rr).attr('stroke', CHALK).attr('stroke-width', 1.2); guide.append('text').attr('class', 'ring-lab').attr('x', 8).attr('y', -rr + 4).attr('text-anchor', 'start').style('font-size', S < 480 ? '10px' : null).text(t); });
  if (S >= 480) guide.append('text').attr('class', 'ring-lab dim').attr('transform', `translate(-9,${-(band[0] + band[1]) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('today’s lineup');
  const lab = root.append('g').style('pointer-events', 'none');
  years.filter((y) => y % 5 === 0).forEach((y) => {
    const a = ang(y) + ang.bandwidth() / 2 - Math.PI / 2, rr = R + R * 0.045 + 6, dec = y % 10 === 0;
    lab.append('line').attr('x1', Math.cos(a) * (R * 0.985)).attr('y1', Math.sin(a) * (R * 0.985)).attr('x2', Math.cos(a) * (R + (dec ? 7 : 4))).attr('y2', Math.sin(a) * (R + (dec ? 7 : 4))).attr('stroke', dec ? CHALK : '#5d636a');
    if (dec || (years.length <= 60 && S > 520)) lab.append('text').attr('class', dec ? 'yr-dec' : 'yr').attr('x', Math.cos(a) * rr).attr('y', Math.sin(a) * rr + 4).attr('text-anchor', Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end').text(S < 420 && !dec ? '' : y);
  });
  if (usesEra() && y0 < 1974) { const a = ang(1974) - Math.PI / 2; root.append('line').attr('x1', Math.cos(a) * band[0]).attr('y1', Math.sin(a) * band[0]).attr('x2', Math.cos(a) * (R + 6)).attr('y2', Math.sin(a) * (R + 6)).attr('stroke', CHALK).attr('stroke-dasharray', '3 2').style('pointer-events', 'none'); }
  const spokes = spokesG.selectAll('path').data(years).join('path')
    .attr('d', (y) => arc({ innerRadius: band[0] - 2, outerRadius: band[1] + 2, startAngle: ang(y) - ang.step() * ang.paddingInner() / 2, endAngle: ang(y) + ang.bandwidth() + ang.step() * ang.paddingInner() / 2 }))
    .attr('fill', 'transparent').style('cursor', 'pointer');
  marks.style('cursor', 'pointer');
  const outline = root.append('path').attr('fill', 'none').attr('stroke', CHALK).attr('stroke-width', 2).style('pointer-events', 'none');
  const hot = root.append('path').attr('fill', 'none').attr('stroke', CHALK).attr('stroke-width', 3).style('pointer-events', 'none');
  const cy = root.append('text').attr('class', 'mat-n').attr('text-anchor', 'middle').attr('y', R * 0.03).style('font-size', Math.round(R * 0.15) + 'px').style('pointer-events', 'none');
  const cs = root.append('text').attr('class', 'mat-s').attr('text-anchor', 'middle').attr('y', R * 0.12).style('font-size', Math.max(10.5, Math.round(R * 0.04)) + 'px').style('pointer-events', 'none');
  const act = (fn) => (ev, d) => { if (ev.pointerType === 'touch') return; fn(d); };
  spokes.on('pointerenter', act((y) => opts.preview(y, null))).on('click', (ev, y) => opts.select(y));
  marks.on('pointerenter', act((r) => opts.preview(r.year, r))).on('click', (ev, r) => opts.select(r.year, r));
  svg.on('pointerleave', () => opts.preview(null, null));
  const spokePath = (y) => arc({ innerRadius: band[0] - 1, outerRadius: band[1] + 1, startAngle: ang(y) - 0.003, endAngle: ang(y) + ang.bandwidth() + 0.003 });
  return {
    paint({ color, opacity, stroke, shown, focusMark, previewing, top, sub }) {
      marks.attr('fill', color)
        .attr('opacity', (r) => { const base = opacity(r) * (r.cls === 'single' && state.cls !== 'single' ? 0.6 : 1); return shown != null && previewing && r.year !== shown ? base * 0.45 : base; })
        .attr('stroke', (r) => (stroke(r) ? CHALK : 'none')).attr('stroke-width', 1.4);
      outline.attr('d', shown != null ? spokePath(shown) : null);
      hot.attr('d', focusMark ? arc(arcOf(focusMark, -0.5)) : null);
      cy.text(top); cs.text(sub);
    }
  };
}

/* ================================================================ scoring
   One system everywhere. Each medal earns placement points (16/12/9/7/5/3/2/1 for 1st–8th).
   A season's available points = sum over weights of the points for the places awarded that year,
   so share (points / available) compares 1950, with two places, to 2024, with eight.
   Current power decays by season with a seven-season half-life: one roster generation. */
const PTS = [16, 12, 9, 7, 5, 3, 2, 1];
const ptsOf = (place) => PTS[place - 1] || 0;
const HALF_LIFE = 7;
const LAST_SEASON = d3.max(CH, (r) => r.year);
const decay = (year) => Math.pow(0.5, (LAST_SEASON - year) / HALF_LIFE);
/* per season and class: medals, points available, team standings */
const SEASON = new Map();
(function buildSeasons() {
  const byYC = d3.group(MEDALS, (r) => r.year + '|' + r.cls);
  byYC.forEach((rs, k) => {
    const [year, cls] = k.split('|');
    const avail = d3.sum(rs, (r) => ptsOf(r.place));
    const teams = Array.from(d3.rollup(rs, (v) => ({ pts: d3.sum(v, (r) => ptsOf(r.place)), medals: v.length, titles: v.filter((r) => r.place === 1).length, d: v[0].d, rows: v.slice().sort((a, b) => a.place - b.place || a.wn - b.wn) }), (r) => r.sch)).map(([sch, o]) => ({ sch, ...o })).sort((a, b) => b.pts - a.pts || b.titles - a.titles || b.medals - a.medals);
    teams.forEach((t, i) => { t.rank = i + 1; t.share = avail ? t.pts / avail : 0; });
    const dists = Array.from(d3.rollup(rs, (v) => ({ pts: d3.sum(v, (r) => ptsOf(r.place)), medals: v.length, titles: v.filter((r) => r.place === 1).length, rows: v.slice().sort((a, b) => a.place - b.place || a.wn - b.wn) }), (r) => r.d)).map(([d, o]) => ({ d, ...o })).sort((a, b) => b.pts - a.pts);
    dists.forEach((t, i) => { t.rank = i + 1; t.share = avail ? t.pts / avail : 0; });
    SEASON.set(k, { year: +year, cls, avail, places: d3.max(rs, (r) => r.place), teams, dists, teamBy: new Map(teams.map((t) => [t.sch, t])), distBy: new Map(dists.map((t) => [t.d, t])) });
  });
})();
const seasonOf = (year, cls) => SEASON.get(year + '|' + cls) || null;
/* a unit's record across seasons in scope. unit: {kind:'school', name} or {kind:'district', d} */
function unitStats(unit, cls = state.cls, withSingle = usesEra()) {
  const classes = cls === 'single' ? ['single'] : withSingle ? [cls, 'single'] : [cls];
  const seasons = [];
  SEASON.forEach((S) => {
    if (!classes.includes(S.cls)) return;
    if (S.cls === 'single' && cls !== 'single' && unit.kind === 'school' && LINEAGE.get(unit.name) !== cls) return;
    const t = unit.kind === 'school' ? S.teamBy.get(unit.name) : S.distBy.get(unit.d);
    if (!t) return;
    seasons.push({ year: S.year, cls: S.cls, pts: t.pts, share: t.share, rank: t.rank, medals: t.medals, titles: t.titles, avail: S.avail, rows: t.rows });
  });
  seasons.sort((a, b) => a.year - b.year);
  const pts = d3.sum(seasons, (s) => s.pts), medals = d3.sum(seasons, (s) => s.medals), titles = d3.sum(seasons, (s) => s.titles);
  const share = d3.sum(seasons, (s) => s.share);
  const power = d3.sum(seasons, (s) => s.pts * decay(s.year));
  const recent = seasons.filter((s) => s.year > LAST_SEASON - 10), prior = seasons.filter((s) => s.year <= LAST_SEASON - 10 && s.year > LAST_SEASON - 20);
  const trend = d3.sum(recent, (s) => s.share) - d3.sum(prior, (s) => s.share);
  const best = seasons.length ? seasons.reduce((m, s) => (s.pts > m.pts ? s : m)) : null;
  const top1 = seasons.filter((s) => s.rank === 1).length, top5 = seasons.filter((s) => s.rank <= 5).length;
  return { seasons, pts, medals, titles, share, power, trend, best, top1, top5, n: seasons.length, first: seasons[0]?.year, last: seasons[seasons.length - 1]?.year, finalists: d3.sum(seasons, (s) => s.rows.filter((r) => r.place <= 2).length) };
}
/* all programs or districts ranked, for the current scope */
function rankings(kind) {
  const units = kind === 'district' ? d3.range(1, 13).map((d) => ({ kind: 'district', d, name: `District ${d}` })) : Array.from(new Set(MEDALS.map((r) => r.sch))).map((name) => ({ kind: 'school', name }));
  const out = units.map((u) => ({ u, ...unitStats(u) })).filter((o) => o.n);
  const rankBy = (key) => { out.slice().sort((a, b) => b[key] - a[key]).forEach((o, i) => { o[key + 'Rank'] = i + 1; }); };
  ['pts', 'share', 'power', 'titles', 'medals'].forEach(rankBy);
  return out;
}
/* every state final: 1st vs 2nd at a weight */
const FINALS = (() => { const out = []; d3.group(MEDALS, (r) => r.year + '|' + r.cls + '|' + r.wn).forEach((rs) => { const w = rs.find((r) => r.place === 1), l = rs.find((r) => r.place === 2); if (w && l) out.push({ year: w.year, cls: w.cls, w: w.w, wn: w.wn, win: w, lose: l }); }); return out.sort((a, b) => a.year - b.year || a.wn - b.wn); })();

/* ================= parts of a whole: fifths as one bar per unit ================= */
const FIFTH_COLORS = ['#f1f3f5', '#b9c6d2', '#7f93a8', '#50657c', '#2d3f52'];
const FIFTH_NAMES = ['Lightest', 'Light', 'Middle', 'Heavy', 'Heaviest'];
/* shares of five fifths, weighted (1 per row, or placement points) */
const fifthShares = (rows, wt = () => 1) => { const c = [0, 0, 0, 0, 0]; rows.forEach((r) => { const w = fifthWeights(r), k = wt(r); for (let i = 0; i < 5; i++) c[i] += w[i] * k; }); const t = d3.sum(c) || 1; return c.map((v) => v / t); };
/* 0 = all in the lightest fifth, 100 = all in the heaviest */
const scalePos = (sh) => 100 * d3.sum(sh, (v, i) => v * i) / 4;
const leanWord = (dp) => (Math.abs(dp) < 1.5 ? 'even with' : `${Math.abs(dp).toFixed(0)} pts ${dp > 0 ? 'heavier' : 'lighter'} than`);
/* series: [{label, chip, href, rows, ref:bool}], opts: {wt, noun} */
function fifthBars(h, series, opts = {}) {
  const wt = opts.wt || (() => 1);
  const S = series.map((s) => ({ ...s, sh: fifthShares(s.rows, wt) })).map((s) => ({ ...s, pos: scalePos(s.sh) }));
  const ref = S.find((s) => s.ref);
  const shown = opts.hideRef ? S.filter((s) => !s.ref) : S;
  h.innerHTML = `<div class="fb-legend">${FIFTH_NAMES.map((n, i) => `<span><i style="background:${FIFTH_COLORS[i]}"></i>${n}</span>`).join('')}</div>
    <div class="fb-rows">${shown.map((s) => `<div class="fb-row${s.ref ? ' ref' : ''}">
      <${s.href ? `a href="${s.href}"` : 'div'} class="fb-lab">${s.chip || ''}<span>${esc(s.label)}</span></${s.href ? 'a' : 'div'}>
      <div class="fb-bar" role="img" aria-label="${esc(s.label)}: ${s.sh.map((v, i) => `${FIFTH_NAMES[i]} ${pct0(v)}`).join(', ')}">${s.sh.map((v, i) => `<i data-i="${i}" style="flex:${v.toFixed(4)};background:${FIFTH_COLORS[i]}"><b>${v >= 0.085 ? pct0(v) : ''}</b></i>`).join('')}</div>
      <div class="fb-lean">${s.ref ? (opts.refNote || 'reference') : ref ? leanWord(s.pos - ref.pos) + ' ' + esc(ref.short || ref.label) : ''}</div>
    </div>`).join('')}</div>`;
  h.querySelectorAll('.fb-row').forEach((row, j) => { const s = shown[j]; d3.select(row).selectAll('.fb-bar i').each(function () { bindTip(d3.select(this), () => { const i = +this.dataset.i; return tipHTML(`${FIFTH_NAMES[i]} fifth of the lineup`, `${s.label}: ${pct1(s.sh[i])} of its ${opts.noun || 'titles'}`, ref && !s.ref ? `${ref.label}: ${pct1(ref.sh[i])}` : ''); }); }); });
}

/* ================= by weight class: units down the side, classes across ================= */
/* units: [{label, chip, href, rows, ref:bool}] — a ref unit is not drawn; it sets the green/red edges. opts: {wt, unit:'titles'|'pts'} */
function classGrid(h, units, opts = {}) {
  const wt = opts.wt || (() => 1);
  const ks = STD.filter((c) => c.k !== '98' || units.some((u) => u.rows.some((r) => stdOf(r).k === '98')));
  const U = units.map((u) => { const by = new Map(ks.map((c) => [c.k, { n: 0, v: 0, rs: [] }])); u.rows.forEach((r) => { const o = by.get(stdOf(r).k); if (!o) return; o.n++; o.v += wt(r); o.rs.push(r); }); const tot = d3.sum(Array.from(by.values()), (o) => o.v) || 1; by.forEach((o) => { o.sh = o.v / tot; }); return { ...u, by, tot }; });
  const ref = U.find((u) => u.ref), rows = U.filter((u) => !u.ref);
  const maxSh = d3.max(rows, (u) => d3.max(Array.from(u.by.values()), (o) => o.sh)) || 0.2;
  const alpha = (sh) => (sh ? 0.08 + 0.82 * Math.sqrt(sh / maxSh) : 0);
  const dark = (sh) => alpha(sh) >= 0.5;
  h.innerHTML = `<div class="cg-wrap"><table class="cg"><thead><tr><th class="cg-u"></th>${ks.map((k) => `<th class="cg-k">${k.label}${k.k === '98' ? '<small>retired</small>' : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((u, j) => `<tr><th class="cg-u">${u.href ? `<a href="${u.href}">` : '<span class="cg-n">'}${u.chip || ''}<span>${esc(u.label)}</span>${u.href ? '</a>' : '</span>'}</th>${ks.map((k) => { const o = u.by.get(k.k); const d = ref ? o.sh - ref.by.get(k.k).sh : 0; return `<td data-j="${j}" data-k="${k.k}" style="--a:${alpha(o.sh).toFixed(3)}" class="${d > 0.04 ? 'up' : d < -0.04 ? 'dn' : ''}${dark(o.sh) ? ' dk' : ''}">${o.n ? `<b>${pct0(o.sh)}</b><small>${opts.unit === 'pts' ? fmt(Math.round(o.v)) : o.n}</small>` : '<span class="nil">·</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  d3.select(h).selectAll('td[data-j]').each(function () { bindTip(d3.select(this), () => { const u = rows[+this.dataset.j], o = u.by.get(this.dataset.k), k = ks.find((x) => x.k === this.dataset.k); return tipHTML(`${k.label}${k.note ? ' (' + k.note + ')' : ''} · ${u.label}`, `${pct1(o.sh)} of its ${opts.unit === 'pts' ? 'points' : 'titles'}${ref ? `; ${ref.label}: ${pct1(ref.by.get(k.k).sh)}` : ''}`, o.rs.slice().sort((p, q) => q.year - p.year).slice(0, 5).map((q) => `${q.year} ${esc(q.name)}${q.place > 1 ? ' (' + ordinal(q.place) + ')' : ''}${u.rows.some((r) => r.sch !== q.sch) ? ', ' + esc(q.school) : ''}`).join('<br>') + (o.rs.length > 5 ? '<br>…' : '')); }); });
}

/* ================= the ledger: rows are who, columns are seasons, each cell a finish ================= */
/* opts: {rows:[{key,label,chip,href}], years:[a,b], cell:(key,year)=>{n, tier:1-4, text, sub}|null, selected, onSelect(year), onPreview(year)} */
function ledger(h, opts) {
  const [a, b] = opts.years, years = d3.range(a, b + 1);
  h.innerHTML = `<div class="lg" style="--n:${years.length}">
    <div class="lg-row lg-head"><div class="lg-lab"><span>${esc(opts.corner || '')}</span></div><div class="lg-cells">${years.map((y) => `<i data-y="${y}" class="${y % 10 === 0 ? 'dec' : ''}">${y % 10 === 0 ? `<span>${y}</span>` : ''}</i>`).join('')}</div></div>
    ${opts.rows.map((r) => `<div class="lg-row">
      <${r.href ? `a href="${r.href}"` : 'div'} class="lg-lab">${r.chip || ''}<span>${esc(r.label)}</span></${r.href ? 'a' : 'div'}>
      <div class="lg-cells">${years.map((y) => { const c = opts.cell(r.key, y); return c ? `<i data-y="${y}" data-k="${esc(String(r.key))}" class="t${c.tier}">${c.n != null && c.n <= 9 ? c.n : ''}</i>` : `<i data-y="${y}" data-k="${esc(String(r.key))}" class="nil"></i>`; }).join('')}</div></div>`).join('')}
  </div>`;
  const root = h.querySelector('.lg');
  const fit = () => { const lw = parseFloat(getComputedStyle(root).getPropertyValue('--lw')) || 170; const cw = Math.floor((root.clientWidth - lw - 2) / years.length); root.style.setProperty('--cw', Math.max(15, Math.min(cw, 26)) + 'px'); };
  fit();
  d3.select(root).selectAll('.lg-row:not(.lg-head) i').each(function () {
    const el = this;
    bindTip(d3.select(el), () => { const c = opts.cell(el.dataset.k, +el.dataset.y); const r = opts.rows.find((x) => String(x.key) === el.dataset.k); return c ? tipHTML(`${el.dataset.y} · ${r.label}`, c.text || '', c.sub || '') : tipHTML(`${el.dataset.y} · ${r.label}`, opts.emptyText || 'nothing that season'); });
  });
  root.addEventListener('click', (e) => { const i = e.target.closest('i[data-y]'); if (i && opts.onSelect) opts.onSelect(+i.dataset.y); });
  root.addEventListener('pointerover', (e) => { const i = e.target.closest('i[data-y]'); if (i && opts.onPreview && e.pointerType !== 'touch') opts.onPreview(+i.dataset.y); });
  root.addEventListener('pointerleave', () => { if (opts.onPreview) opts.onPreview(null); });
  let scrolled = false;
  const paint = (year) => { root.querySelectorAll('i.sel').forEach((i) => i.classList.remove('sel')); if (year == null) return; root.querySelectorAll(`i[data-y="${year}"]`).forEach((i) => i.classList.add('sel')); if (!scrolled) { scrolled = true; const i = root.querySelector(`.lg-head i[data-y="${year}"]`); if (i) root.scrollLeft = Math.max(0, i.offsetLeft - root.clientWidth * 0.75); } };
  if (opts.selected != null) paint(opts.selected);
  return { paint };
}
