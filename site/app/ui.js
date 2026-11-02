/* Shared pieces: medals, district identity, school badges, tooltip. Color means a medal and nothing else. */
'use strict';
const METALS = [
  null,
  { name: 'Gold', hi: '#fbe7a1', mid: '#d4a33a', lo: '#7d5a12', ink: '#4a3306' },
  { name: 'Silver', hi: '#fbfcfd', mid: '#c3cad1', lo: '#6b737c', ink: '#2f353b' },
  { name: 'Bronze', hi: '#f0c79c', mid: '#b0773f', lo: '#5f3a17', ink: '#3a220c' },
  { name: 'Copper', hi: '#ffb69b', mid: '#c4593a', lo: '#6e2614', ink: '#3d130a' },
  { name: 'Pewter', hi: '#e2e5e7', mid: '#959ca1', lo: '#4f5559', ink: '#23272a' },
  { name: 'Steel', hi: '#cfe0ec', mid: '#6f8ea6', lo: '#364a5a', ink: '#f2f6f9' },
  { name: 'Gunmetal', hi: '#8e979f', mid: '#4a5158', lo: '#262b30', ink: '#e5e8eb' },
  { name: 'Onyx', hi: '#5f656c', mid: '#222529', lo: '#0b0c0d', ink: '#cfd3d7' }
];
const metal = (p) => METALS[p] || METALS[8];
/* one set of gradients for the whole page */
(function defs() {
  const s = METALS.slice(1).map((m, i) => `<radialGradient id="m${i + 1}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="${m.hi}"/><stop offset=".58" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></radialGradient>`).join('');
  const el = document.createElement('div'); el.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${s}</defs></svg>`; document.body.prepend(el.firstChild);
})();
/* a medal: place number on the metal */
const medal = (p, size = 18, title) => `<svg class="md" width="${size}" height="${size}" viewBox="0 0 20 20" role="img" aria-label="${title || ordinal(p) + ' place'}"><circle cx="10" cy="10" r="9.3" fill="url(#m${p})"${p >= 7 ? ' stroke="#6b727a" stroke-width=".8"' : ''}/><circle cx="10" cy="10" r="7" fill="none" stroke="${metal(p).lo}" stroke-opacity=".5" stroke-width=".7"/><text x="10" y="10" dy=".36em" text-anchor="middle" fill="${metal(p).ink}">${p}</text></svg>`;
/* counts by place as a row of medals: [g,s,b,c,p,s,g,o] */
const shelf = (c, opts = {}) => `<span class="shelf${opts.compact ? ' compact' : ''}">${c.map((n, i) => (n || opts.zeros ? `<span class="sh${n ? '' : ' zero'}" title="${n} × ${ordinal(i + 1)}">${medal(i + 1, opts.size || 16)}<b>${n}</b></span>` : '')).join('')}</span>`;
/* points by place as one bar: how the success was made */
const medalBar = (c, max, w = 120) => { const pts = c.map((n, i) => n * ptsOf(i + 1)); const tot = d3.sum(pts); const W = max ? (tot / max) * w : w; let x = 0; return `<svg class="mbar" width="${w}" height="10" viewBox="0 0 ${w} 10" aria-hidden="true">${pts.map((v, i) => { const ww = tot ? (v / tot) * W : 0; const s = ww > 0 ? `<rect x="${x.toFixed(2)}" y="0" width="${Math.max(0, ww - 0.6).toFixed(2)}" height="10" fill="${metal(i + 1).mid}"/>` : ''; x += ww; return s; }).join('')}</svg>`; };

/* ---------- districts ---------- */
const MAP = window.PA_MAP;
const distMap = (d, w = 40) => { const h = w * MAP.h / MAP.w; const on = MAP.d[d]; const dot = MAP.dot[d]; return `<svg class="pa" width="${w}" height="${h.toFixed(1)}" viewBox="0 0 ${MAP.w} ${MAP.h}" aria-hidden="true"><path d="${MAP.outline}" class="pa-o"/>${on ? `<path d="${on}" class="pa-d"/>` : ''}${d === 8 || d === 12 ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="3.4" class="pa-p"/>` : ''}</svg>`; };
const dtag = (d) => `<span class="dtag">D${d}</span>`;
const distLabel = (d, opts = {}) => `<span class="dist">${opts.map === false ? '' : distMap(d, opts.mapW || 34)}${dtag(d)}${opts.name === false ? '' : `<span class="dn">${esc(DISTRICTS[d].short)}</span>`}</span>`;
const distLink = (d, opts) => `<a class="dlink" href="#district/${d}" title="District ${d}: ${esc(DISTRICTS[d].long)}">${distLabel(d, opts)}</a>`;

/* ---------- schools ---------- */
const LOGOS = window.WR_LOGOS || {};
const chip = (school, size = 22) => { const s = canon(school), f = LOGOS[slug(s)]; if (f) return `<img class="chip logo" src="${f}" width="${size}" height="${size}" alt="" loading="lazy">`; return `<span class="chip" style="width:${size}px;height:${size}px">${SB ? SB.svg(s, { size, variant: 'chip', title: false }) : ''}</span>`; };
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
