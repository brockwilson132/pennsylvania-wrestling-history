/*
 * Logos and foil.
 *   Logos: the owner's uploaded school logos, read live from the artifact's db (collection "logos",
 *          one document per school, readable by every viewer, writable by the owner only).
 *   Foil:  renders any logo as a holographic foil plate at runtime. The foil is computed in the
 *          browser from the logo's own alpha (CSS masks), so one clean cut-out is all a school needs.
 *   Mono:  a sewn felt monogram for schools without a logo yet.
 */
(function (root) {
  'use strict';
  const SB = root.SchoolBadge;
  const map = new Map();          // key -> {school, asset, url, colors, updated}
  const listeners = new Set();
  const env = { db: null, assets: null, user: null, owner: false, ready: false, keyOf: (s) => s };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  /* ---------------- colors ---------------- */
  const hexRGB = (h) => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = hexRGB(h); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const INK = '#14233f';

  /** Banner colors for a school: field (felt) and thread (lettering). */
  function colorsOf(school) {
    const id = SB && SB.identity(school);
    const rec = get(school);
    let field = id && id.primary, thread = id && id.secondary, accent = id && id.accent;
    if ((!field || !id) && rec && rec.colors && rec.colors.length) {
      const cs = rec.colors.filter((c) => lum(c) > 0.015 && lum(c) < 0.85);
      field = cs[0] || rec.colors[0]; thread = rec.colors.find((c) => c !== field && contrast(c, field) > 2.4) || null;
    }
    if (!field) field = '#5b6676';
    // on the dark page a black or navy disc vanishes: lead with the secondary when it reads better
    if (lum(field) < 0.05 && thread && lum(thread) > 0.12 && thread.toLowerCase() !== '#ffffff') { const t = field; field = thread; thread = t; }
    else if (lum(field) < 0.05) field = '#4a5058';
    if (!thread || contrast(thread, field) < 2.2) thread = contrast('#ffffff', field) >= contrast(INK, field) ? '#ffffff' : INK;
    return { field, thread, accent: accent || null, known: !!id || !!(rec && rec.colors) };
  }

  /* ---------------- monogram (fallback mark) ---------------- */
  const monoCache = new Map();
  function abbrOf(school) {
    const id = SB && SB.identity(school);
    if (id && id.abbr) return id.abbr;
    const words = String(school).replace(/\(.*?\)/g, '').replace(/\b(area|high|school|senior|junior|jr|sr|central|regional)\b/gi, ' ').split(/[\s-]+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase();
    return (words[0] || school).slice(0, 3).toUpperCase();
  }
  function monoURL(school) {
    if (monoCache.has(school)) return monoCache.get(school);
    const { field, thread } = colorsOf(school);
    const a = abbrOf(school);
    const fs = a.length <= 2 ? 40 : a.length === 3 ? 31 : 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${field}"/><circle cx="50" cy="50" r="42.5" fill="none" stroke="${thread}" stroke-width="1.6" stroke-dasharray="3.2 2.6"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Graduate, 'Arial Black', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="${fs}" letter-spacing="1" fill="${thread}">${esc(a)}</text></svg>`;
    const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    monoCache.set(school, u);
    return u;
  }

  /* ---------------- store ---------------- */
  function get(school) { return map.get(env.keyOf(school)) || null; }
  function has(school) { return map.has(env.keyOf(school)); }
  function url(school) { const r = get(school); return r ? r.url : monoURL(school); }

  /** <img> chip for tables and lists. */
  function chip(school, size) {
    const r = get(school);
    return `<img class="chip${r ? ' logo' : ''}" src="${url(school)}" width="${size}" height="${size}" alt="" loading="lazy">`;
  }

  /** Holographic foil plate. opts: {size, live (pointer-reactive), tone ('light'|'dark')} */
  function foil(school, opts = {}) {
    const r = get(school), u = url(school);
    const size = opts.size || 96;
    return `<span class="foil${r ? '' : ' mono'}${opts.live ? ' live' : ''}" style="--logo:url('${u}');width:${size}px;height:${size}px" aria-hidden="true"><img src="${u}" alt="" draggable="false"><i class="sheen"></i><i class="glare"></i></span>`;
  }

  /* pointer: tilt + move the light across any live foil */
  let raf = 0, pending = null;
  const apply = () => {
    raf = 0; if (!pending) return;
    const { el, x, y } = pending; pending = null;
    const b = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (x - b.left) / b.width)), py = Math.max(0, Math.min(1, (y - b.top) / b.height));
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--ry', ((px - 0.5) * 22).toFixed(2) + 'deg');
    el.style.setProperty('--rx', ((0.5 - py) * 18).toFixed(2) + 'deg');
    el.classList.add('lit');
  };
  document.addEventListener('pointermove', (e) => {
    const host = e.target.closest && e.target.closest('[data-foil-host]');
    const el = host ? host.querySelector('.foil.live') : (e.target.closest && e.target.closest('.foil.live'));
    if (!el) return;
    pending = { el, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const host = e.target.closest && (e.target.closest('[data-foil-host]') || e.target.closest('.foil.live'));
    if (!host || (e.relatedTarget && host.contains(e.relatedTarget))) return;
    const el = host.classList.contains('foil') ? host : host.querySelector('.foil.live');
    if (el) { el.classList.remove('lit'); ['--mx', '--my', '--rx', '--ry'].forEach((p) => el.style.removeProperty(p)); }
  });

  /* ---------------- platform hookup ---------------- */
  async function init() {
    const c = root.claude;
    if (!c || typeof c.use !== 'function') return;
    try {
      const [db, user, assets] = await Promise.all([c.use('db'), c.use('user'), c.use('assets')]);
      env.db = db; env.user = user; env.assets = assets;
      env.owner = !!(user && (await Promise.resolve(user.isOwner())));
      emit();
      if (!db) return;
      db.collection('logos').onSnapshot((snap) => {
        map.clear();
        snap.docs.forEach((d) => {
          const v = d.data(); if (!v || !v.asset) return;
          map.set(d.id, { ...v, key: d.id, url: v.url || '/_blob/' + v.asset });
        });
        monoCache.clear();
        env.ready = true; emit();
      }, () => { env.ready = true; emit(); });
    } catch (e) { console.warn('Logos unavailable', e); }
  }

  /* writes (owner only; the db rule enforces it too) */
  async function save(school, blob, meta) {
    if (!env.db || !env.assets) throw new Error('Saving needs the published app, opened by its owner.');
    const key = env.keyOf(school);
    const prev = map.get(key);
    const up = await env.assets.upload(blob);
    await env.db.collection('logos').doc(key).set({ school, asset: up.id, url: up.url || null, colors: meta.colors || [], src: meta.src || '', updated: Date.now() });
    if (prev && prev.asset && prev.asset !== up.id) { try { await env.assets.delete(prev.asset); } catch (e) { /* old file already gone */ } }
    return up;
  }
  async function remove(school) {
    const key = env.keyOf(school), prev = map.get(key);
    if (!env.db) return;
    await env.db.collection('logos').doc(key).delete();
    if (prev && prev.asset && env.assets) { try { await env.assets.delete(prev.asset); } catch (e) { /* ignore */ } }
  }

  root.Logos = {
    init, get, has, url, chip, foil, colorsOf, monoURL, abbrOf, save, remove, contrast, lum,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    setKey: (fn) => { env.keyOf = fn; },
    get canEdit() { return env.owner && !!env.db && !!env.assets; },
    get isOwner() { return env.owner; },
    get ready() { return env.ready; },
    get count() { return map.size; },
    all: () => Array.from(map.values())
  };
})(window);
