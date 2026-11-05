/* Shared pieces: medals, district identity, school badges, tooltip. Color means a medal and nothing else. */
'use strict';
const METALS = [
  null,
  { name: 'Gold', hi: '#fbe7a1', mid: '#d4a33a', lo: '#7d5a12', ink: '#4a3306' },
  { name: 'Silver', hi: '#fbfcfd', mid: '#c3cad1', lo: '#6b737c', ink: '#2f353b' },
  { name: 'Bronze', hi: '#f0c79c', mid: '#b0773f', lo: '#5f3a17', ink: '#3a220c' },
  { name: 'Copper', hi: '#ffb69b', mid: '#c4593a', lo: '#6e2614', ink: '#3d130a' },
  { name: 'Steel', hi: '#b8bfc6', mid: '#69717a', lo: '#33383e', ink: '#f1f3f5' },
  { name: 'Steel', hi: '#b8bfc6', mid: '#69717a', lo: '#33383e', ink: '#f1f3f5' },
  { name: 'Steel', hi: '#b8bfc6', mid: '#69717a', lo: '#33383e', ink: '#f1f3f5' },
  { name: 'Steel', hi: '#b8bfc6', mid: '#69717a', lo: '#33383e', ink: '#f1f3f5' }
];
const metal = (p) => METALS[p] || METALS[8];
/* one set of gradients for the whole page */
(function defs() {
  const s = METALS.slice(1).map((m, i) => `<radialGradient id="m${i + 1}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="${m.hi}"/><stop offset=".58" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></radialGradient>`).join('');
  const el = document.createElement('div'); el.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${s}</defs></svg>`; document.body.prepend(el.firstChild);
})();
/* a medal: place number on the metal */
const medal = (p, size = 18, title, text) => `<svg class="md" width="${size}" height="${size}" viewBox="0 0 20 20" role="img" aria-label="${title || ordinal(p) + ' place'}"><circle cx="10" cy="10" r="9.3" fill="url(#m${Math.min(p, 8)})"/><circle cx="10" cy="10" r="7" fill="none" stroke="${metal(p).lo}" stroke-opacity=".5" stroke-width=".7"/><text x="10" y="10" dy=".36em" text-anchor="middle" fill="${metal(p).ink}"${text && text.length > 1 ? ' font-size="8.5"' : ''}>${text || p}</text></svg>`;
/* counts by place as a row of medals: 1st, 2nd, 3rd, 4th, then 5th–8th together */
const shelf = (c, opts = {}) => { const g = c.slice(0, 4).concat([d3.sum(c.slice(4))]); return `<span class="shelf${opts.compact ? ' compact' : ''}">${g.map((n, i) => (n || opts.zeros ? `<span class="sh${n ? '' : ' zero'}" title="${n} × ${i < 4 ? ordinal(i + 1) : '5th–8th'}">${medal(i + 1, opts.size || 16, i < 4 ? null : '5th to 8th', i < 4 ? null : '5+')}<b>${n}</b></span>` : '')).join('')}</span>`; };
/* points by place as one bar: how the success was made */
const medalBar = (c, max, w = 120) => { const pts = c.map((n, i) => n * ptsOf(i + 1)).slice(0, 4).concat([d3.sum(c.slice(4).map((n, i) => n * ptsOf(i + 5)))]); const tot = d3.sum(pts); const W = max ? (tot / max) * w : w; let x = 0; return `<svg class="mbar" width="${w}" height="10" viewBox="0 0 ${w} 10" aria-hidden="true">${pts.map((v, i) => { const ww = tot ? (v / tot) * W : 0; const s = ww > 0 ? `<rect x="${x.toFixed(2)}" y="0" width="${Math.max(0, ww - 0.6).toFixed(2)}" height="10" fill="${metal(Math.min(i + 1, 5)).mid}"/>` : ''; x += ww; return s; }).join('')}</svg>`; };

/* the medal key: 1st–4th each have a metal; 5th–8th share steel */
const KEY = [[1, 'Gold', '1st', '16'], [2, 'Silver', '2nd', '12'], [3, 'Bronze', '3rd', '9'], [4, 'Copper', '4th', '7'], [5, 'Steel', '5th–8th', '5, 3, 2, 1']];
const medalKey = () => `<div class="key">${KEY.map(([p, n, pl, pts]) => `<span>${medal(p, 22)}<b>${n}</b><i>${pl} · ${pts} pts</i></span>`).join('')}</div>`;
/* last 20 seasons as tiny bars */
const spark = (vals, w = 80, h = 18) => { const m = d3.max(vals) || 1, bw = w / vals.length; return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => `<rect x="${(i * bw).toFixed(1)}" y="${(h - Math.max(v ? 1.5 : 0.6, (v / m) * h)).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.max(v ? 1.5 : 0.6, (v / m) * h).toFixed(1)}" fill="${v ? '#aab2ba' : '#3a4047'}"/>`).join('')}</svg>`; };
const trendTxt = (t) => (Math.abs(t) < 0.5 ? '<span class="tr flat">even</span>' : `<span class="tr ${t > 0 ? 'up' : 'dn'}">${t > 0 ? '▲' : '▼'} ${scoreFmt(Math.abs(t))}</span>`);

/* ---------- districts ---------- */
const MAP = window.PA_MAP;
const distMap = (d, w = 40) => { const h = w * MAP.h / MAP.w; const on = MAP.d[d]; const dot = MAP.dot[d]; return `<svg class="pa" width="${w}" height="${h.toFixed(1)}" viewBox="0 0 ${MAP.w} ${MAP.h}" aria-hidden="true"><path d="${MAP.outline}" class="pa-o"/>${on ? `<path d="${on}" class="pa-d"/>` : ''}${d === 8 || d === 12 ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="3.4" class="pa-p"/>` : ''}</svg>`; };
const dtag = (d) => `<span class="dtag">D${d}</span>`;
const distLabel = (d, opts = {}) => `<span class="dist">${opts.map === false ? '' : distMap(d, opts.mapW || 34)}${dtag(d)}${opts.name === false ? '' : `<span class="dn">${esc(DISTRICTS[d].short)}</span>`}</span>`;
const distLink = (d, opts) => `<a class="dlink" href="#district/${d}" title="District ${d}: ${esc(DISTRICTS[d].long)}">${distLabel(d, opts)}</a>`;

/* ---------- schools ---------- */
/* school badge: initials in the school's colors. Logo files in site/logos are kept for future use on school pages. */
const chip = (school, size = 22) => { const s = canon(school); return `<span class="chip" style="width:${size}px;height:${size}px">${SB ? SB.svg(s, { size, variant: 'chip', title: false }) : ''}</span>`; };
const schoolLink = (school, size = 20) => `<a class="who" href="${schoolHref(school)}">${chip(school, size)}<span>${esc(canon(school))}</span></a>`;

/* ---------- tooltip ---------- */
const $tip = document.getElementById('tip');
const tip = {
  show(ev, html) { $tip.innerHTML = html; $tip.hidden = false; this.move(ev); },
  move(ev) { const pad = 14, r = $tip.getBoundingClientRect(); let x = ev.clientX + pad, y = ev.clientY + pad; if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad; $tip.style.transform = `translate(${Math.max(6, x)}px,${Math.max(6, y)}px)`; },
  hide() { $tip.hidden = true; }
};
const bindTip = (sel, fn) => sel.on('pointerenter', (ev, d) => { if (ev.pointerType === 'touch') return; tip.show(ev, fn(d)); }).on('pointermove', (ev) => tip.move(ev)).on('pointerleave', () => tip.hide());
addEventListener('scroll', () => tip.hide(), { passive: true });

/* ---------- layout bits ---------- */
const $view = document.getElementById('view');
const host = (id) => $view.querySelector(`[data-c="${id}"]`);
const widthOf = (el) => Math.max(140, Math.floor(el.getBoundingClientRect().width));
const svgIn = (el, w, h, label) => d3.select(el).append('svg').attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img').attr('aria-label', label || '');
const sec = (title, sub, id, extra = '') => `<div class="sec-head"${id ? ` id="${id}"` : ''}><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}${extra}</div>`;
const seg = (name, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div>`;
const scoreFmt = (v) => (v >= 100 ? fmt(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1));

/* ---------- a career on a grid: District, Regional, State; FR SO JR SR in each ----------
   Medals are placed by grade (from the brackets); a Q is a state qualifier who did not place.
   District and regional results are on file only for District 11 (district) and the Northeast AAA Regional. */
const qpill = (size = 16, title = 'State qualifier') => `<span class="qp" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.62)}px" role="img" aria-label="${title}">Q</span>`;
const GRADE_L = ['FR', 'SO', 'JR', 'SR'];
function careerGrid(w, opts = {}) {
  const apps = w.apps || appsOf(w.name, w.school || w.sch);
  const size = opts.size || 18, full = !!opts.full;
  const slot = (r) => gradeSlot(r, apps);
  const state = Array(4).fill(null); apps.forEach((r) => { const i = slot(r); if (!state[i] || (r.place && (!state[i].place || r.place < state[i].place))) state[i] = r; });
  const yearGrade = new Map(apps.map((r) => [r.year, slot(r)]));
  const other = (rows) => { const g = Array(4).fill(null); rows.forEach((r) => { let i = yearGrade.get(r.year); if (i == null) { const k = apps.find((a) => a.grade in GRADE_I); i = k ? Math.max(0, Math.min(3, GRADE_I[k.grade] + (r.year - k.year))) : null; } if (i != null && !g[i]) g[i] = r; }); return g; };
  const sch = w.school || w.sch;
  const dRows = full ? D11.filter((r) => r.sch === sch && nkey(r.name) === nkey(w.name)).map((r) => ({ ...r, place: 1 })) : [];
  const rRows = full ? REG.filter((r) => r.sch === sch && nkey(r.name) === nkey(w.name)).map((r) => ({ ...r, place: 1 })) : [];
  const cell = (r, lvl) => (!r ? '<i class="gc"></i>' : r.place ? `<i class="gc" title="${r.year}, ${lvl}, ${wLabel(r.w)}, ${ordinal(r.place)}${r.grade ? ', ' + r.grade : ''}">${medal(r.place, size)}</i>` : `<i class="gc" title="${r.year}, state qualifier at ${wLabel(r.w)}${r.grade ? ', ' + r.grade : ''}">${qpill(size)}</i>`);
  const group = (label, cells, lvl, known) => `<span class="gg${known ? '' : ' nodata'}" title="${known ? label + ': champions only on file' : label + ': results not collected for this district'}"><b>${label}</b>${cells.map((r) => cell(r, lvl)).join('')}</span>`;
  const d = w.d || schoolDistrict(sch);
  return `<span class="cg${full ? ' full' : ''}">${full ? group('District', other(dRows), 'district', d === 11) + group('Regional', other(rRows), 'regional', [2, 4, 11, 12].includes(d)) : ''}${group('State', state, 'state', true)}</span>`;
}
const gradeHead = () => `<span class="gh">${GRADE_L.map((g) => `<i>${g}</i>`).join('')}</span>`;
