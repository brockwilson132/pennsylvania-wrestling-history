/*
 * Logo studio (owner only). Drop logo files; each one is matched to a school by file name,
 * cut out from its background, trimmed, squared to 512 px, and its colors are pulled.
 * Saving uploads the cut-out and records it for the school; every viewer then sees it as foil.
 */
(function (root) {
  'use strict';
  const L = root.Logos, SB = root.SchoolBadge;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OUT = 512;

  /* ================= image pipeline ================= */
  async function decode(file) {
    const u = URL.createObjectURL(file);
    try {
      const img = new Image(); img.decoding = 'async'; img.src = u; await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(u), 4000); }
  }
  function rasterize(img) {
    let w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
    const s = Math.min(1400 / Math.max(w, h), Math.max(1, 700 / Math.max(w, h)));
    w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    return c;
  }

  /** Background color from the border: the most common quantized border color. */
  function borderStats(d, w, h) {
    const bins = new Map(); let n = 0, clear = 0;
    const take = (i) => {
      n++; const a = d[i + 3]; if (a < 200) { clear++; return; }
      const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
      const b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(k, b);
    };
    for (let x = 0; x < w; x++) { take(x * 4); take(((h - 1) * w + x) * 4); }
    for (let y = 1; y < h - 1; y++) { take(y * w * 4); take((y * w + w - 1) * 4); }
    let best = null; bins.forEach((b) => { if (!best || b.n > best.n) best = b; });
    return { transparent: clear / n > 0.35, bg: best ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255], share: best ? best.n / n : 0 };
  }

  /**
   * Remove the background. Flood-fills from the border through pixels close to the background
   * color (connected only, so white details inside the mark survive), or keys it out everywhere
   * when `holes` is on. Edge pixels get partial alpha and the background tint is pulled out of them.
   */
  function cutout(src, opt) {
    const w = src.width, h = src.height;
    const x = src.getContext('2d', { willReadFrequently: true });
    const im = x.getImageData(0, 0, w, h), d = im.data;
    const st = borderStats(d, w, h);
    const info = { bg: st.bg, transparent: st.transparent, removed: 0 };
    if (opt.remove && !st.transparent) {
      const [br, bg, bb] = st.bg, T = opt.tol, T2 = T * 2.1;
      const dist = new Float32Array(w * h);
      for (let p = 0, i = 0; p < w * h; p++, i += 4) { const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb; dist[p] = Math.sqrt(dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.9); }
      const gone = new Uint8Array(w * h);
      if (opt.holes) { for (let p = 0; p < w * h; p++) if (dist[p] <= T) gone[p] = 1; }
      else {
        const q = new Int32Array(w * h); let qh = 0, qt = 0;
        const push = (p) => { if (!gone[p] && dist[p] <= T) { gone[p] = 1; q[qt++] = p; } };
        for (let xx = 0; xx < w; xx++) { push(xx); push((h - 1) * w + xx); }
        for (let yy = 0; yy < h; yy++) { push(yy * w); push(yy * w + w - 1); }
        while (qh < qt) { const p = q[qh++], px = p % w; if (px > 0) push(p - 1); if (px < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < w * (h - 1)) push(p + w); }
      }
      for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        if (gone[p]) { d[i + 3] = 0; info.removed++; continue; }
        // soft edge: a kept pixel next to a removed one fades by how close it is to the background
        const px = p % w;
        const near = (px > 0 && gone[p - 1]) || (px < w - 1 && gone[p + 1]) || (p >= w && gone[p - w]) || (p < w * (h - 1) && gone[p + w]);
        if (near && dist[p] < T2) {
          const a = Math.max(0.04, Math.min(1, (dist[p] - T) / (T2 - T)));
          d[i] = Math.max(0, Math.min(255, (d[i] - br * (1 - a)) / a));
          d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - bg * (1 - a)) / a));
          d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - bb * (1 - a)) / a));
          d[i + 3] = Math.round(d[i + 3] * a);
        }
      }
      info.removed /= w * h;
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(im, 0, 0);
    return { canvas: c, info };
  }

  /** Trim to the visible mark, pad, and center on a square OUT x OUT canvas. */
  function squareUp(src) {
    const w = src.width, h = src.height, d = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = Math.round(OUT * 0.04), s = (OUT - pad * 2) / Math.max(bw, bh);
    // downscale in halving steps for clean edges
    let cur = src, cx = x0, cy = y0, cw = bw, ch = bh;
    while (cw * s < cw / 2.2) {
      const t = document.createElement('canvas'); t.width = Math.ceil(cw / 2); t.height = Math.ceil(ch / 2);
      const tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(cur, cx, cy, cw, ch, 0, 0, t.width, t.height);
      cur = t; cx = 0; cy = 0; cw = t.width; ch = t.height;
    }
    const out = document.createElement('canvas'); out.width = OUT; out.height = OUT;
    const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
    const dw = bw * s, dh = bh * s;
    o.drawImage(cur, cx, cy, cw, ch, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);
    return out;
  }

  /** Dominant colors of the visible mark (k-means, k = 6). */
  function palette(c) {
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const px = []; const step = Math.max(1, Math.floor((c.width * c.height) / 6000));
    for (let p = 0; p < c.width * c.height; p += step) { const i = p * 4; if (d[i + 3] > 220) px.push([d[i], d[i + 1], d[i + 2]]); }
    if (!px.length) return [];
    const k = Math.min(6, px.length);
    let cent = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice());
    let lab = new Uint8Array(px.length);
    for (let it = 0; it < 10; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      px.forEach((p, j) => { let bi = 0, bd = 1e9; cent.forEach((c2, ci) => { const dd = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (dd < bd) { bd = dd; bi = ci; } }); lab[j] = bi; const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
      cent = sum.map((s, i) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[i]));
    }
    const counts = cent.map(() => 0); lab.forEach((l) => counts[l]++);
    const hex = (c2) => '#' + c2.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const out = [];
    cent.map((c2, i) => ({ c: c2, n: counts[i] / px.length })).filter((o) => o.n > 0.03).sort((a, b) => b.n - a.n).forEach((o) => {
      if (!out.some((q) => (q.c[0] - o.c[0]) ** 2 + (q.c[1] - o.c[1]) ** 2 + (q.c[2] - o.c[2]) ** 2 < 900)) out.push(o);
    });
    // chromatic colors first, so the felt is the school color rather than an outline black
    const chroma = (c2) => Math.max(...c2) - Math.min(...c2);
    out.sort((a, b) => (chroma(b.c) > 40) - (chroma(a.c) > 40) || b.n - a.n);
    return out.slice(0, 4).map((o) => hex(o.c));
  }

  async function processItem(it) {
    const cut = cutout(it.raster, { remove: it.remove, holes: it.holes, tol: it.tol });
    const sq = squareUp(cut.canvas);
    it.info = cut.info;
    it.colors = palette(sq);
    it.out = sq;
    it.blob = await new Promise((r) => sq.toBlob(r, 'image/png'));
    if (it.preview) URL.revokeObjectURL(it.preview);
    it.preview = URL.createObjectURL(it.blob);
  }

  /* ================= matching file names to schools ================= */
  const STOP = /\b(logo|logos|final|copy|transparent|wrestling|athletics|high|school|hs|senior|area|the|png|jpg|jpeg|svg|webp|v\d+|\d{2,4}x\d{2,4})\b/g;
  const norm = (s) => String(s).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[_\-.+()]+/g, ' ').replace(STOP, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  function matcher(schools) {
    const idx = [];
    schools.forEach((s) => {
      const names = [s.school];
      const id = SB && SB.identity(s.school);
      if (id) { (id.aliases || []).forEach((a) => names.push(a)); if (id.abbr) names.push(id.abbr); if (id.mascot) names.push(s.school + ' ' + id.mascot); }
      names.forEach((n) => idx.push({ s, n: norm(n) }));
    });
    return (file) => {
      const q = norm(file); if (!q) return null;
      const qt = q.split(' ');
      let best = null, bs = 0;
      idx.forEach(({ s, n }) => {
        if (!n) return;
        let sc;
        if (n === q) sc = 1;
        else {
          const nt = n.split(' ');
          const inter = qt.filter((t) => nt.includes(t)).length;
          sc = inter / Math.max(qt.length, nt.length);
          if (q.replace(/ /g, '') === n.replace(/ /g, '')) sc = 0.98;
          else if (n.startsWith(q) || q.startsWith(n)) sc = Math.max(sc, 0.7 * Math.min(q.length, n.length) / Math.max(q.length, n.length) + 0.2);
        }
        sc += Math.min(0.03, (s.titles || 0) / 3000); // break ties toward the bigger program
        if (sc > bs) { bs = sc; best = s; }
      });
      return bs >= 0.5 ? best : null;
    };
  }

  /* ================= UI ================= */
  let ctx = null, queue = [], host = null, filter = { d: 'all', missing: false, q: '' }, unsub = null, busy = false;

  function render(h, context) {
    host = h; ctx = context;
    ctx.match = matcher(ctx.schools);
    if (unsub) unsub();
    let could = L.canEdit;
    unsub = L.onChange(() => { if (!host || !host.isConnected || location.hash !== '#studio') { unsub(); unsub = null; return; } if (L.canEdit !== could) { render(host, ctx); return; } drawCoverage(); });
    host.innerHTML = `
      <header class="pagehead">
        <h1>Logo studio</h1>
        <p class="lede">Drop logo files to add them to the almanac. Name each file after its school (<code>nazareth.png</code>, <code>bethlehem-catholic.jpg</code>) and it is matched for you. Backgrounds are cut out, the mark is trimmed and squared, and its colors are pulled for the banner. Only you can see this page and save logos; everyone you share the almanac with sees the result.</p>
      </header>
      ${L.canEdit ? '' : `<p class="notice">${L.isOwner ? 'Saving is not available in this view. Open the published almanac to save logos.' : 'Preview only: logos are saved from the published almanac, by its owner.'} You can still try files here to see how they will look.</p>`}
      <section class="sheet studio-drop" id="st-drop" tabindex="0">
        <div class="drop-art" aria-hidden="true">${L.foil('Nazareth', { size: 64 })}</div>
        <div><h2>Add logos</h2><p>PNG, JPG, WebP or SVG. A transparent PNG is best; a logo on a plain white or solid background works too.</p></div>
        <label class="btn">Choose files<input type="file" id="st-file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" multiple hidden></label>
      </section>
      <div id="st-queue-bar" class="queue-bar" hidden></div>
      <div id="st-queue" class="st-queue"></div>
      <section class="sheet">
        <div class="sheet-head"><h2>Coverage</h2><p class="sub" id="st-cov-sub"></p></div>
        <div class="controls">
          <input class="field" id="st-q" type="search" placeholder="Find a school" aria-label="Find a school">
          <label class="sel">District <select id="st-d"><option value="all">All</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" id="st-missing"> Missing a logo</label>
        </div>
        <div id="st-cov" class="cov"></div>
      </section>
      <datalist id="st-schools">${ctx.schools.map((s) => `<option value="${esc(s.school)}">`).join('')}</datalist>`;
    const drop = host.querySelector('#st-drop'), inp = host.querySelector('#st-file');
    inp.addEventListener('change', () => { add(Array.from(inp.files || [])); inp.value = ''; });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add(Array.from(e.dataTransfer.files || [])));
    host.querySelector('#st-q').addEventListener('input', (e) => { filter.q = e.target.value.toLowerCase(); drawCoverage(); });
    host.querySelector('#st-d').addEventListener('change', (e) => { filter.d = e.target.value; drawCoverage(); });
    host.querySelector('#st-missing').addEventListener('change', (e) => { filter.missing = e.target.checked; drawCoverage(); });
    host.querySelector('#st-cov').addEventListener('click', onCoverageClick);
    drawQueue(); drawCoverage();
  }

  async function add(files, forced) {
    const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|svg|gif)$/i.test(f.name));
    for (const f of imgs) {
      const it = { id: Math.random().toString(36).slice(2), file: f, name: f.name, school: forced || (ctx.match(f.name) || {}).school || '', remove: true, holes: false, tol: 34, state: 'working', orig: URL.createObjectURL(f) };
      queue.unshift(it); drawQueue();
      try {
        it.raster = rasterize(await decode(f));
        await processItem(it);
        it.state = 'ready';
      } catch (e) { it.state = 'error'; it.error = 'This file could not be read as an image.'; }
      drawQueue();
    }
  }

  const checker = 'st-check';
  function card(it) {
    const s = it.school, known = ctx.schools.some((x) => x.school === s);
    const col = known ? L.colorsOf(s) : { field: '#5b6676', thread: '#fff' };
    if (it.state === 'working') return `<article class="sheet qcard" data-id="${it.id}"><p class="mini">Cutting out ${esc(it.name)}…</p></article>`;
    if (it.state === 'error') return `<article class="sheet qcard" data-id="${it.id}"><p><b>${esc(it.name)}</b>: ${esc(it.error)}</p><button class="btn ghost" data-act="discard">Remove</button></article>`;
    const bgNote = it.info.transparent ? 'Already transparent, so nothing was cut.' : it.remove ? `Cut ${Math.round(it.info.removed * 100)}% of the image as background.` : 'Background kept.';
    return `<article class="sheet qcard${it.state === 'saved' ? ' saved' : ''}" data-id="${it.id}">
      <div class="q-imgs">
        <figure><div class="${checker}"><img src="${it.orig}" alt=""></div><figcaption>Original</figcaption></figure>
        <figure><div class="${checker}"><img src="${it.preview}" alt=""></div><figcaption>Cut out</figcaption></figure>
        <figure><div class="q-plate" style="--field:${col.field}" data-foil-host><span class="foil live" style="--logo:url('${it.preview}');width:132px;height:132px"><img src="${it.preview}" alt=""><i class="sheen"></i><i class="glare"></i></span></div><figcaption>As foil, on the school banner</figcaption></figure>
      </div>
      <div class="q-form">
        <label class="lab">School<input class="field" list="st-schools" data-k="school" value="${esc(s)}" placeholder="Type a school" spellcheck="false"></label>
        ${s && !known ? '<p class="warn">No school by that name in the almanac. Pick one from the list.</p>' : ''}
        ${!s ? '<p class="warn">The file name did not match a school. Type the school.</p>' : ''}
        <p class="mini">${esc(it.name)}. ${bgNote}</p>
        <label class="check"><input type="checkbox" data-k="remove" ${it.remove ? 'checked' : ''} ${it.info.transparent ? 'disabled' : ''}> Cut out the background</label>
        <label class="check"><input type="checkbox" data-k="holes" ${it.holes ? 'checked' : ''} ${!it.remove || it.info.transparent ? 'disabled' : ''}> Also clear enclosed spaces, like the inside of letters</label>
        <label class="lab range">Cut strength<input type="range" min="8" max="110" step="2" data-k="tol" value="${it.tol}" ${!it.remove || it.info.transparent ? 'disabled' : ''}></label>
        <div class="swatches-row"><span class="mini">Colors found</span>${it.colors.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
        <div class="q-actions">
          ${it.state === 'saved' ? '<span class="ok">Saved</span>' : `<button class="btn" data-act="save" ${!known || !L.canEdit || busy ? 'disabled' : ''}>Save logo</button>`}
          <button class="btn ghost" data-act="discard">${it.state === 'saved' ? 'Clear' : 'Discard'}</button>
        </div>
      </div>
    </article>`;
  }

  function drawQueue() {
    if (!host) return;
    const q = host.querySelector('#st-queue'), bar = host.querySelector('#st-queue-bar');
    q.innerHTML = queue.map(card).join('');
    const ready = queue.filter((it) => it.state === 'ready' && ctx.schools.some((x) => x.school === it.school));
    bar.hidden = queue.length < 2;
    bar.innerHTML = `<span>${queue.length} files. ${ready.length} ready to save.</span><button class="btn" data-act="save-all" ${!ready.length || !L.canEdit || busy ? 'disabled' : ''}>Save ${ready.length} logos</button><button class="btn ghost" data-act="clear">Clear the list</button>`;
    q.querySelectorAll('[data-k]').forEach((el) => {
      const it = queue.find((x) => x.id === el.closest('.qcard').dataset.id);
      const ev = el.type === 'range' ? 'change' : el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'change' : 'change';
      el.addEventListener(ev, async () => {
        const k = el.dataset.k;
        if (k === 'school') { it.school = el.value.trim(); drawQueue(); return; }
        it[k] = el.type === 'checkbox' ? el.checked : +el.value;
        await processItem(it); drawQueue();
      });
    });
  }

  async function saveOne(it) {
    it.state = 'saving';
    try { await L.save(it.school, it.blob, { colors: it.colors, src: it.name }); it.state = 'saved'; }
    catch (e) { it.state = 'ready'; flash(`${it.school}: ${e && e.message ? e.message : 'the logo could not be saved'}. Try again.`); }
  }
  function flash(msg) {
    const bar = host.querySelector('#st-queue-bar'); bar.hidden = false;
    bar.insertAdjacentHTML('afterbegin', `<span class="warn">${esc(msg)}</span>`);
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !host || !host.contains(b)) return;
    const act = b.dataset.act, c = b.closest('.qcard'), it = c && queue.find((x) => x.id === c.dataset.id);
    if (act === 'discard') { queue = queue.filter((x) => x !== it); drawQueue(); }
    else if (act === 'clear') { queue = []; drawQueue(); }
    else if (act === 'save' && it) { busy = true; drawQueue(); await saveOne(it); busy = false; drawQueue(); }
    else if (act === 'save-all') {
      busy = true; drawQueue();
      for (const x of queue.filter((q) => q.state === 'ready' && ctx.schools.some((s) => s.school === q.school))) { await saveOne(x); drawQueue(); }
      busy = false; drawQueue();
    }
  });

  function drawCoverage() {
    if (!host) return;
    const box = host.querySelector('#st-cov'); if (!box) return;
    const all = ctx.schools.filter((s) => s.titles > 0);
    const have = all.filter((s) => L.has(s.school)).length;
    host.querySelector('#st-cov-sub').textContent = `${have} of ${all.length} schools with a state champion have a logo. Schools are listed by state titles, most first.`;
    const rows = all.filter((s) => (filter.d === 'all' || s.d === +filter.d) && (!filter.missing || !L.has(s.school)) && (!filter.q || s.school.toLowerCase().includes(filter.q))).slice(0, 240);
    box.innerHTML = rows.length ? rows.map((s) => {
      const on = L.has(s.school);
      return `<div class="cov-row${on ? ' on' : ''}" data-school="${esc(s.school)}">${L.chip(s.school, 34)}<span class="cov-name"><b>${esc(s.school)}</b><span class="mini">District ${s.d || '?'}, ${s.titles} state title${s.titles === 1 ? '' : 's'}</span></span>
        <label class="btn small ghost">${on ? 'Replace' : 'Add'}<input type="file" accept="image/*" hidden data-for="${esc(s.school)}"></label>
        ${on && L.canEdit ? '<button class="btn small ghost danger" data-remove>Remove</button>' : ''}</div>`;
    }).join('') : '<p class="empty">No schools match.</p>';
    box.querySelectorAll('input[data-for]').forEach((inp) => inp.addEventListener('change', () => { add(Array.from(inp.files || []), inp.dataset.for); inp.value = ''; host.querySelector('#st-queue').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  }
  let armed = null;
  async function onCoverageClick(e) {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    const row = b.closest('.cov-row'), s = row.dataset.school;
    if (armed !== s) { armed = s; b.textContent = 'Remove for good?'; b.classList.add('armed'); return; }
    armed = null; b.disabled = true; b.textContent = 'Removing…';
    try { await L.remove(s); } catch (err) { b.textContent = 'Could not remove'; }
  }

  root.LogoStudio = { render, _pipeline: { cutout, squareUp, palette, matcher, norm } };
})(window);
