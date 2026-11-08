/* Overtime — school colour editor (colors.html). Brock's page: build pill sets (fill, dot, text) from swatches and
   tap schools to give them a set. Saving commits overtime/schoolcolors.js to the rebuild branch through the GitHub API
   with his own fine-grained token (this repo only, Contents read and write), kept only in this browser; the site
   redeploys on that commit. Anyone can open the page, but only a token with write access to the repo can save.
   Work in progress is kept in localStorage, and a save merges his changes onto the latest file on GitHub. */
'use strict';
(() => {
  const REPO = 'brockwilson132/pennsylvania-wrestling-history', BRANCH = 'rebuild', PATH = 'overtime/schoolcolors.js';
  const NPATH = 'data/school_notes.json';   // Brock's notes on data issues, one per school, for a thread to research
  const API = (p = PATH) => `https://api.github.com/repos/${REPO}/contents/${p}`;
  const K_TOKEN = 'ot-colors-token', K_DRAFT = 'ot-colors-draft';
  const T = window.OTTags, root = document.getElementById('ed');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const J = JSON.stringify;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  const norm = (d) => ({ swatches: (d && d.swatches) || [], sets: (d && d.sets) || {}, schools: (d && d.schools) || {} });

  /* every school in the archive, with the district it wrestled in most recently */
  const UD = window.WR_UNITS || { schools: [], ss: [] };
  const DIST = new Map(); (UD.ss || []).forEach((r) => { const s = UD.schools[r[0]]; const o = DIST.get(s); if (r[3] && (!o || r[1] >= o[0])) DIST.set(s, [r[1], r[3]]); });
  /* medals per school over every season and class, one count per level: [district, regional, state] (places 1-8) */
  const MED = new Map(); (UD.ss || []).forEach((r) => { const s = UD.schools[r[0]]; const m = MED.get(s) || MED.set(s, [0, 0, 0]).get(s); m[0] += r[23] || 0; m[1] += r[22] || 0; m[2] += r[9] + r[10] + r[11]; });
  /* the seasons a school shows up in any bracket (district, section, regional or state), as ranges: 1972–1988 · 2001–2025 */
  const YRS = new Map(); (UD.ss || []).forEach((r) => { const s = UD.schools[r[0]]; (YRS.get(s) || YRS.set(s, new Set()).get(s)).add(r[1]); });
  const RANGE = new Map();
  const rangeOf = (s) => { if (RANGE.has(s)) return RANGE.get(s); const ys = [...(YRS.get(s) || [])].sort((a, b) => a - b), out = [];
    ys.forEach((y) => { const L = out[out.length - 1]; if (L && y === L[1] + 1) L[1] = y; else out.push([y, y]); });
    const t = out.map(([a, b]) => (a === b ? String(a) : a + '–' + b)).join(' · '); RANGE.set(s, t); return t; };
  const medOf = (s, i) => (MED.get(s) || [0, 0, 0])[i];
  const SORTS = { D: 0, R: 1, S: 2 };

  /* ---- state ---- */
  let base = norm(clone(window.OT_COLORS)), doc = clone(base);
  const draft = (() => { try { return JSON.parse(ls.get(K_DRAFT) || 'null'); } catch (e) { return null; } })();
  if (draft && draft.doc && draft.base) { base = norm(draft.base); doc = norm(draft.doc); }
  const nnorm = (o) => (o && typeof o === 'object' ? o : {});
  let nBase = nnorm(draft && draft.nBase), notes = nnorm(clone((draft && draft.notes) || nBase));
  const ui = { sort: 'az', note: '', sel: Object.keys(doc.sets)[0] || null, part: 0, q: '', f: 'all', focus: '', del: false, add: false, armDel: false, min: false, save: '', err: '', tok: false };
  const undo = [];
  const keep = () => ls.set(K_DRAFT, changes() ? J({ base, doc, nBase, notes }) : null);
  const edit = (fn) => { undo.push(J({ doc, sel: ui.sel })); if (undo.length > 100) undo.shift(); fn(); ui.save = ''; ui.err = ''; keep(); draw(); };

  /* what changed since the file was loaded: sets, schools and swatches, key by key */
  function diff(a, b) {
    const out = { sets: [], schools: [], swAdd: b.swatches.filter((h) => !a.swatches.includes(h)), swDel: a.swatches.filter((h) => !b.swatches.includes(h)) };
    ['sets', 'schools'].forEach((k) => { new Set([...Object.keys(a[k]), ...Object.keys(b[k])]).forEach((x) => { if (J(a[k][x]) !== J(b[k][x])) out[k].push(x); }); });
    return out;
  }
  const ndiff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => J(a[k]) !== J(b[k]));
  const changes = () => { const d = diff(base, doc); return d.sets.length + d.schools.length + d.swAdd.length + d.swDel.length + ndiff(nBase, notes).length; };
  const colourChanges = () => { const d = diff(base, doc); return d.sets.length + d.schools.length + d.swAdd.length + d.swDel.length; };
  /* lay this browser's changes over the latest file on GitHub (another save may have landed since this page loaded) */
  function merge(remote) {
    const m = norm(clone(remote)), d = diff(base, doc);
    d.sets.forEach((k) => { if (doc.sets[k]) m.sets[k] = doc.sets[k]; else delete m.sets[k]; });
    d.schools.forEach((k) => { if (doc.schools[k]) m.schools[k] = doc.schools[k]; else delete m.schools[k]; });
    m.swatches = m.swatches.filter((h) => !d.swDel.includes(h)).concat(d.swAdd.filter((h) => !m.swatches.includes(h)));
    Object.keys(m.schools).forEach((k) => { if (!m.sets[m.schools[k]]) delete m.schools[k]; });
    return m;
  }

  /* identical sets fold into the first one (schools follow it), so copies and re-creations never pile up */
  function dedupe(m) { const seen = new Map(), alias = {};
    Object.keys(m.sets).forEach((id) => { const k = m.sets[id].map((h) => h.toUpperCase()).join(); if (seen.has(k)) { alias[id] = seen.get(k); delete m.sets[id]; } else seen.set(k, id); });
    Object.keys(m.schools).forEach((s) => { if (alias[m.schools[s]]) m.schools[s] = alias[m.schools[s]]; });
    Object.defineProperty(m, 'alias', { value: alias, enumerable: false, configurable: true, writable: true }); return m; }
  /* ---- GitHub ---- */
  const token = () => ls.get(K_TOKEN) || '';
  const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const b64e = (s) => { const b = new TextEncoder().encode(s); let t = ''; b.forEach((x) => { t += String.fromCharCode(x); }); return btoa(t); };
  async function gh(method, body, p = PATH) {
    const r = await fetch(method === 'GET' ? `${API(p)}?ref=${BRANCH}&t=${Date.now()}` : API(p), { method, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? J(body) : undefined });
    if (!r.ok) { const e = new Error(r.status === 401 ? 'Token not accepted (401)' : r.status === 403 || r.status === 404 ? `Token cannot write to the repo (${r.status})` : r.status === 409 ? 'conflict' : 'GitHub ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  /* the notes file as it is on GitHub now (none yet: empty) */
  const latestNotes = async () => { try { const j = await gh('GET', null, NPATH); const txt = b64d(j.content); return { sha: j.sha, txt, notes: nnorm(JSON.parse(txt)) }; }
    catch (e) { if (e.status === 404) return { sha: null, txt: '', notes: {} }; throw e; } };
  /* one school per line, in name order, so a thread can read it and every edit is a one-line diff */
  const nserialize = (o) => '{\n' + Object.keys(o).sort((a, b) => a.localeCompare(b)).map((k) => J(k) + ': ' + J(o[k])).join(',\n') + '\n}\n';
  const nmerge = (remote) => { const m = clone(remote); ndiff(nBase, notes).forEach((k) => { if (notes[k]) m[k] = notes[k]; else delete m[k]; }); return m; };
  async function saveNotes() {
    const ks = ndiff(nBase, notes); if (!ks.length) return;
    for (let i = 0; i < 3; i++) {
      const L = await latestNotes(), m = nmerge(L.notes), txt = nserialize(m);
      try { if (txt !== L.txt) await gh('PUT', { message: 'School notes: ' + ks.slice(0, 3).join(', ') + (ks.length > 3 ? ` +${ks.length - 3}` : ''), content: b64e(txt), branch: BRANCH, ...(L.sha ? { sha: L.sha } : {}) }, NPATH);
        nBase = m; notes = clone(m); return; } catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
    }
    throw new Error('GitHub kept changing under the save; try again');
  }
  const latest = async () => { const j = await gh('GET'); const txt = b64d(j.content); return { sha: j.sha, txt, doc: norm(T.parse(txt)) }; };
  function message(d) {
    const sch = d.schools.slice(0, 3).join(', '), more = d.schools.length > 3 ? ` +${d.schools.length - 3}` : '';
    const bits = [d.schools.length ? sch + more : '', d.sets.length ? `${d.sets.length} set${d.sets.length > 1 ? 's' : ''}` : '', d.swAdd.length + d.swDel.length ? 'swatches' : ''].filter(Boolean);
    return 'School colours: ' + (bits.join('; ') || 'update');
  }
  async function save() {
    if (!token()) { ui.tok = true; draw(); return; }
    ui.save = 'busy'; ui.err = ''; draw();
    try {
      await saveNotes(); keep();
      if (!colourChanges()) { ui.save = 'ok'; draw(); setTimeout(() => { if (ui.save === 'ok') { ui.save = ''; draw(); } }, 4000); return; }
      for (let i = 0; i < 3; i++) {
        const L = await latest(), m = dedupe(merge(L.doc)), txt = T.serialize(m);
        try {
          if (txt !== L.txt) await gh('PUT', { message: message(diff(base, doc)), content: b64e(txt), sha: L.sha, branch: BRANCH });
          base = m; doc = clone(m); if (ui.sel && m.alias[ui.sel]) ui.sel = m.alias[ui.sel]; delete m.alias; delete doc.alias; delete base.alias; if (ui.sel && !doc.sets[ui.sel]) ui.sel = Object.keys(doc.sets)[0] || null; undo.length = 0; keep();
          ui.save = 'ok'; draw(); setTimeout(() => { if (ui.save === 'ok') { ui.save = ''; draw(); } }, 4000); return;
        } catch (e) { if (e.status !== 409) throw e; }   // someone saved in between: fetch again and re-merge
      }
      throw new Error('GitHub kept changing under the save; try again');
    } catch (e) { ui.save = 'err'; ui.err = e.message; draw(); }
  }
  /* on open, start from the latest file on GitHub rather than the published copy (a deploy takes a minute or two) */
  async function refresh() {
    if (!token()) return;
    try { const N = await latestNotes(); if (J(N.notes) !== J(nBase)) { const m = ndiff(nBase, notes).length ? nmerge(N.notes) : N.notes; nBase = N.notes; notes = clone(m); keep(); draw(); } }
    catch (e) { ui.err = e.message; draw(); }
    try { const L = await latest(); const had = changes(); const m = had ? merge(L.doc) : L.doc;
      if (J(L.doc) !== J(base)) { base = L.doc; doc = norm(m); if (ui.sel && !doc.sets[ui.sel]) ui.sel = Object.keys(doc.sets)[0] || null; keep(); draw(); } }
    catch (e) { ui.err = e.message; draw(); }
  }

  /* ---- helpers ---- */
  const setPaint = (id) => { const s = doc.sets[id]; return s ? { fill: s[0], acc: s[1], ink: s[2] } : T.NONE; };
  const greyN = () => { const all = new Set([...UD.schools, ...Object.keys(doc.schools)]); let n = 0; all.forEach((x) => { if (!doc.schools[x] && T.auto(x).none) n++; }); return n; };
  /* sets in colour order (greys and blacks first, then by hue, then by the dot) so similar sets sit together */
  const hue = (h) => { const n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.12) return -1 + mx; const x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return x * 60; };
  const byColour = (a, b) => { const A = doc.sets[a], B = doc.sets[b]; return hue(A[0]) - hue(B[0]) || hue(A[1]) - hue(B[1]); };
  const uses = (id) => Object.values(doc.schools).filter((v) => v === id).length;
  const newId = () => { let id; do { id = Math.random().toString(36).slice(2, 6); } while (doc.sets[id] || /^\d/.test(id)); return id; };
  const pill = (name, p, cls = '') => `<span class="stag tF${p.none ? ' nc' : ''}${cls ? ' ' + cls : ''}" style="--tf:${p.fill};--ta:${p.acc};--ti:${p.ink}"><i></i>${esc(name)}</span>`;
  const abbr = (sch) => { const r = window.SchoolBadge && window.SchoolBadge.resolve ? window.SchoolBadge.resolve(sch) : null; return r ? r.abbr : String(sch || '?').slice(0, 3).toUpperCase(); };
  const hexOk = (h) => /^#?[0-9a-f]{6}$/i.test(h.trim());
  const hexN = (h) => '#' + h.trim().replace('#', '').toUpperCase();
  const I = {
    back: '<path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    undo: '<path d="M9 7 L4 12 L9 17 M4.5 12 H14 A5.5 5.5 0 0 1 14 23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -3)"/>',
    key: '<circle cx="8" cy="14" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11.2 11.2 L20 3.5 M16.5 6.5 L19 9 M14.5 8.5 L16.5 10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    save: '<path d="M7 18 H6 A4 4 0 0 1 6 10 A6 6 0 0 1 17.6 8.6 A4.6 4.6 0 0 1 18 18 H17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 20 V12 M9 15 L12 12 L15 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    ok: '<path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    spin: '<path d="M12 3 A9 9 0 1 1 3 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    err: '<path d="M12 3 L22 20 H2 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9 V14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>',
    up: '<path d="M6 15 L12 9 L18 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M12 5 V19 M5 12 H19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    trash: '<path d="M5 7 H19 M10 7 V4.5 H14 V7 M7 7 L8 20 H16 L17 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15.5 V6 A2 2 0 0 1 7 4 H15.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    pick: '<path d="M14.5 5.5 L18.5 9.5 M16.5 3.5 A2.1 2.1 0 0 1 20.5 7.5 L17.5 10.5 L13.5 6.5 Z M14.8 9.2 L6.5 17.5 L5 21 L8.5 19.5 L16.8 11.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>',
    note: '<path d="M5 4 H15 L19 8 V20 H5 Z M15 4 V8 H19 M8 12 H16 M8 16 H13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>',
    noted: '<path d="M5 4 H15 L19 8 V20 H5 Z" fill="currentColor"/><path d="M8 12 H16 M8 16 H13" stroke="#0B0D10" stroke-width="1.9" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16 L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    warn: '<path d="M12 3 L22 20 H2 Z" fill="currentColor" opacity=".18"/><path d="M12 3 L22 20 H2 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9 V14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>',
  };
  /* the app's level icons (components.js NAVI): the state outline, its regions, its districts (icongeo.js) */
  const IG = window.OT_ICONGEO || { outline: '', d: {}, r: {} };
  const geo = (k) => { const line = `<path d="${IG.outline}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>`;
    const parts = (sh, w) => Object.values(sh).map((p) => `<path d="${p}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-opacity=".85" stroke-linejoin="round"/>`).join('');
    return `<svg viewBox="0 0 26 26" aria-hidden="true">${k === 'district' ? parts(IG.d, 0.6) : k === 'region' ? parts(IG.r, 0.9) : ''}${line}</svg>`; };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

  /* ---- drawing ---- */
  function schoolsShown() {
    const all = [...new Set([...UD.schools, ...Object.keys(doc.schools)])];
    const t = ui.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((s) => { const k = s.toLowerCase(); if (t.length && !t.every((x) => k.includes(x))) return false;
      if (ui.f === 'set') return doc.schools[s] === ui.sel;
      if (ui.f === 'grey') return !doc.schools[s] && T.auto(s).none;
      if (ui.f === 'notes') return !!notes[s];
      if (ui.f !== 'all') return DIST.has(s) && DIST.get(s)[1] === +ui.f; return true; })
      .sort((a, b) => (ui.sort in SORTS ? medOf(b, SORTS[ui.sort]) - medOf(a, SORTS[ui.sort]) : 0) || a.localeCompare(b));
  }
  function brush() {
    const p = setPaint(ui.sel), name = ui.focus && doc.schools[ui.focus] === ui.sel ? ui.focus : (Object.keys(doc.schools).find((s) => doc.schools[s] === ui.sel) || 'School');
    const s = doc.sets[ui.sel] || ['#2A3038', '#4A5360', '#EEEAE1'], cur = s[ui.part];
    const low = ui.sel && T.contrast(s[0], s[2]) < T.READS;
    const parts = `<div class="ce-pt" role="group" aria-label="Part">
      <button class="ce-pb" data-part="0" aria-pressed="${ui.part === 0}" aria-label="Fill"><span class="ce-sw0" style="background:${s[0]}"></span></button>
      <button class="ce-pb" data-part="1" aria-pressed="${ui.part === 1}" aria-label="Dot"><span class="ce-sw1" style="background:${s[1]}"></span></button>
      <button class="ce-pb" data-part="2" aria-pressed="${ui.part === 2}" aria-label="Text"><span class="ce-sw2" style="--fill:${s[0]};color:${s[2]}">Aa</span></button>
      ${low ? `<button class="ce-warn" data-fix aria-label="Make the text readable">${svg('warn')}</button>` : ''}</div>`;
    const sw = `<div class="ce-sg${ui.del ? ' ce-del' : ''}">${doc.swatches.map((h) => `<button class="ce-sw" data-sw="${h}" style="background:${h}" aria-pressed="${!ui.del && ui.sel && h.toUpperCase() === cur.toUpperCase()}" aria-label="${h}"></button>`).join('')}
      <button class="ce-sw ce-tool" data-swadd aria-pressed="${ui.add}" aria-label="Add a colour">${svg('plus')}</button></div>`;
    const cx = ui.add ? `<div class="ce-cx"><input type="color" id="cxp" value="${cur}"><input type="text" id="cxh" value="${cur}" maxlength="7" spellcheck="false" autocomplete="off" inputmode="text"><button class="ce-ib" data-cxok aria-label="Add">${svg('ok')}</button><button class="ce-ib${ui.del ? ' ce-err' : ''}" data-swdel aria-pressed="${ui.del}" aria-label="Remove colours">${svg('trash')}</button></div>` : '';
    const sets = `<div class="ce-ss" role="group" aria-label="Sets">
      <button class="ce-sb ce-tool" data-snew aria-label="New set">${svg('plus')}</button>
      ${ui.sel ? `<button class="ce-sb ce-tool" data-scopy aria-label="Copy set">${svg('copy')}</button><button class="ce-sb ce-tool${ui.armDel ? ' ce-arm' : ''}" data-sdel aria-label="Delete set">${svg('trash')}</button>` : ''}
      ${Object.keys(doc.sets).sort(byColour).map((id) => { const q = setPaint(id); return `<button class="ce-sb" data-set="${id}" aria-pressed="${id === ui.sel}" style="--fill:${q.fill};--acc:${q.acc};--ink:${q.ink}"><i></i>${uses(id)}</button>`; }).join('')}</div>`;
    const big = ui.sel ? name : 'School';
    const pp = ui.sel ? p : T.NONE;
    return `<div class="ce-pv" style="--pz:${Math.max(13, Math.min(23, Math.floor(560 / Math.max(big.length, 1))))}px"><span class="ce-pvb">${pill(big, pp)}</span><span class="ce-pvs">${pill(big, pp)}${pill(abbr(big), pp, 'ab')}${pill(abbr(big), pp, 'ab xs')}</span></div>${ui.min ? '' : parts + sw + cx}${sets}`;
  }
  function list() {
    const ss = schoolsShown(), sp = setPaint(ui.sel);
    const chips = [['all', 'All'], ['set', `<span class="ce-mini" style="--f:${sp.fill};--a:${sp.acc}"><b><i></i></b>${ui.sel ? uses(ui.sel) : 0}</span>`], ['grey', `<span class="ce-mini" style="--f:${T.NONE.fill};--a:${T.NONE.acc}"><b><i></i></b>${greyN()}</span>`]]
      .concat([['notes', `<span class="ce-mini">${svg('note')}${Object.keys(notes).length}</span>`]])
      .concat(Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)]));
    const sorts = [['az', '<b class="ce-az">A–Z</b>'], ['D', geo('district')], ['R', geo('region')], ['S', geo('state')]];
    return `<div class="ce-fl"><label class="ce-fs">${svg('search')}<input id="q" type="search" value="${esc(ui.q)}" autocomplete="off" aria-label="Search schools"></label><div class="ce-so" role="group" aria-label="Sort">${sorts.map(([k, l]) => `<button data-sort="${k}" aria-pressed="${ui.sort === k}" aria-label="${{ az: 'Name', D: 'District medals', R: 'Regional medals', S: 'State medals' }[k]}">${l}</button>`).join('')}</div></div>
      <div class="ce-ch" role="group" aria-label="Show">${chips.map(([k, l]) => `<button data-f="${k}" aria-pressed="${ui.f === k}">${l}</button>`).join('')}</div>
      <ul class="ce-sl">${ss.map((s) => { const p = T.paint(s, doc), use = ui.sel && doc.schools[s] === ui.sel, d = DIST.get(s);
        return `<li class="ce-sr${use ? ' ce-use' : ''}${ui.focus === s ? ' ce-foc' : ''}" data-s="${esc(s)}"><span class="ce-ck">${svg('ok')}</span><span class="ce-nm">${pill(s, p)}<small>${rangeOf(s)}</small></span><span class="ce-dn${ui.sort in SORTS ? ' ce-md' : ''}">${ui.sort in SORTS ? medOf(s, SORTS[ui.sort]) || '' : d ? d[1] : ''}</span><button class="ce-nb${notes[s] ? ' ce-has' : ''}" data-note aria-label="Note">${svg(notes[s] ? 'noted' : 'note')}</button><button class="ce-pk${p.none && !doc.schools[s] ? ' ce-no' : ''}" data-pick aria-label="Use this school's colours">${svg('pick')}</button></li>`; }).join('')}</ul>`;
  }
  function draw() {
    const n = changes(), focusQ = document.activeElement && document.activeElement.id === 'q', caret = focusQ ? document.activeElement.selectionStart : 0;
    const sv = ui.save === 'busy' ? 'spin' : ui.save === 'ok' ? 'ok' : ui.save === 'err' ? 'err' : 'save';
    const y = window.scrollY, lsy = root.querySelector('.ce-ss') ? root.querySelector('.ce-ss').scrollLeft : 0;
    root.innerHTML = `<div class="ce-eb"><div class="ce-eh">
        <a class="ce-ib" href="./" aria-label="Back to Overtime">${svg('back')}</a><span class="ce-sp"></span>
        <button class="ce-ib" data-min aria-label="${ui.min ? 'Show colours' : 'Hide colours'}">${svg(ui.min ? 'down' : 'up')}</button>
        <button class="ce-ib" data-undo aria-label="Undo"${undo.length ? '' : ' disabled'}>${svg('undo')}</button>
        <button class="ce-ib${token() ? ' ce-on' : ''}" data-tok aria-label="GitHub token">${svg('key')}${token() ? '' : '<span class="ce-dt"></span>'}</button>
        <button class="ce-ib${ui.save ? " ce-" + ui.save : ""}" data-save aria-label="Save"${n || ui.save ? '' : ' disabled'}>${svg(sv)}${n && ui.save !== 'busy' ? `<span class="ce-bd">${n}</span>` : ''}</button>
      </div>${brush()}</div>
      ${ui.err ? `<div class="ce-msg" role="alert">${esc(ui.err)}</div>` : ''}<div class="ce-lw">${list()}</div>
      ${ui.note ? `<div class="ce-tk" data-tkbg><div class="ce-tkc ce-nt"><div class="ce-nth">${pill(ui.note, T.paint(ui.note, doc))}</div><textarea id="nt" rows="4" spellcheck="true">${esc(notes[ui.note] ? notes[ui.note].note : '')}</textarea><div class="ce-ntb">${notes[ui.note] ? `<button class="ce-ib" data-ntdel aria-label="Delete note">${svg('trash')}</button>` : ''}<span class="ce-sp"></span><button class="ce-ib" data-ntok aria-label="Keep note">${svg('ok')}</button></div></div></div>` : ''}
      ${ui.tok ? `<div class="ce-tk" data-tkbg><div class="ce-tkc"><input id="tok" type="password" placeholder="github_pat_…" value="${esc(token())}" autocomplete="off" spellcheck="false"><button class="ce-ib" data-tkok aria-label="Keep token">${svg('ok')}</button>${token() ? `<button class="ce-ib" data-tkdel aria-label="Forget token">${svg('trash')}</button>` : ''}</div></div>` : ''}`;
    window.scrollTo(0, y); const s2 = root.querySelector('.ce-ss'); if (s2) s2.scrollLeft = lsy;
    if (focusQ) { const q = document.getElementById('q'); q.focus(); q.setSelectionRange(caret, caret); }
    if (ui.tok) document.getElementById('tok').focus();
    if (ui.note) { const t = document.getElementById('nt'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }

  /* ---- actions ---- */
  function paintSwatch(h) { if (!ui.sel) return; if (doc.sets[ui.sel][ui.part].toUpperCase() === h.toUpperCase()) return; edit(() => { doc.sets[ui.sel] = doc.sets[ui.sel].slice(); doc.sets[ui.sel][ui.part] = h; }); }
  function addSwatch() { const h = document.getElementById('cxh').value; if (!hexOk(h)) return; const v = hexN(h);
    edit(() => { if (!doc.swatches.includes(v)) doc.swatches.push(v); ui.add = false; if (ui.sel) { doc.sets[ui.sel] = doc.sets[ui.sel].slice(); doc.sets[ui.sel][ui.part] = v; } }); }
  function tapSchool(s) {
    ui.focus = s; if (!ui.sel) { draw(); return; }
    edit(() => { if (doc.schools[s] === ui.sel) delete doc.schools[s]; else doc.schools[s] = ui.sel; });
  }
  function pickSchool(s) {
    ui.focus = s; const id = doc.schools[s];
    if (id) { ui.sel = id; ui.armDel = false; draw(); return; }
    const p = T.auto(s); if (p.none) return;
    edit(() => { const n = newId(); doc.sets[n] = [p.fill, p.acc, p.ink]; doc.schools[s] = n; ui.sel = n; });
  }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-s],[data-tkbg]'); if (!t) return; const d = t.dataset;
    if (d.part != null) { ui.part = +d.part; draw(); }
    else if (d.sw) { if (ui.del) edit(() => { doc.swatches = doc.swatches.filter((h) => h !== d.sw); }); else paintSwatch(d.sw); }
    else if (d.swadd != null) { ui.add = !ui.add; ui.del = false; draw(); }
    else if (d.swdel != null) { ui.del = !ui.del; draw(); }
    else if (d.cxok != null) addSwatch();
    else if (d.set) { ui.sel = d.set; ui.armDel = false; if (ui.f === 'set') window.scrollTo(0, 0); draw(); }
    else if (d.snew != null) edit(() => { const n = newId(); doc.sets[n] = ['#111111', '#8A8D8F', '#FFFFFF']; ui.sel = n; ui.part = 0; ui.armDel = false; ui.min = false; });
    else if (d.scopy != null) edit(() => { const n = newId(); doc.sets[n] = doc.sets[ui.sel].slice(); ui.sel = n; ui.armDel = false; ui.min = false; });
    else if (d.sdel != null) { if (!ui.armDel) { ui.armDel = true; draw(); return; }
      edit(() => { const id = ui.sel; delete doc.sets[id]; Object.keys(doc.schools).forEach((k) => { if (doc.schools[k] === id) delete doc.schools[k]; }); ui.sel = Object.keys(doc.sets)[0] || null; ui.armDel = false; }); }
    else if (d.f) { ui.f = d.f; draw(); }
    else if (d.sort) { ui.sort = d.sort; draw(); }
    else if (d.note != null) { e.stopPropagation(); ui.note = t.closest('[data-s]').dataset.s; draw(); }
    else if (d.ntok != null) { const v = document.getElementById('nt').value.trim(), k = ui.note; ui.note = '';
      if (v) { if (!notes[k] || notes[k].note !== v) notes[k] = { note: v, at: new Date().toISOString().slice(0, 10) }; } else delete notes[k]; ui.save = ''; keep(); draw(); }
    else if (d.ntdel != null) { delete notes[ui.note]; ui.note = ''; ui.save = ''; keep(); draw(); }
    else if (d.pick != null) { e.stopPropagation(); pickSchool(t.closest('[data-s]').dataset.s); }
    else if (d.s) tapSchool(d.s);
    else if (d.fix != null) { const c = doc.sets[ui.sel], ink = [c[1], '#FFFFFF', '#000000'].find((h) => T.contrast(c[0], h) >= T.READS) || (T.contrast(c[0], '#FFFFFF') >= T.contrast(c[0], '#000000') ? '#FFFFFF' : '#000000');
      edit(() => { doc.sets[ui.sel] = [c[0], c[1], ink]; }); }
    else if (d.min != null) { ui.min = !ui.min; draw(); }
    else if (d.undo != null) { const u = undo.pop(); if (u) { const o = JSON.parse(u); doc = o.doc; ui.sel = o.sel; ui.save = ''; keep(); draw(); } }
    else if (d.save != null) { if (ui.save === 'err' && !changes()) { ui.save = ''; ui.err = ''; draw(); } else save(); }
    else if (d.tok != null) { ui.tok = true; draw(); }
    else if (d.tkok != null) { ls.set(K_TOKEN, document.getElementById('tok').value.trim() || null); ui.tok = false; ui.err = ''; draw(); refresh(); }
    else if (d.tkdel != null) { ls.set(K_TOKEN, null); ui.tok = false; draw(); }
    else if (d.tkbg != null && e.target === t) { ui.tok = false; ui.note = ''; draw(); }
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'q') { ui.q = e.target.value; const lw = root.querySelector('.ce-lw'); const pos = e.target.selectionStart; lw.innerHTML = list(); const q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos); }
    else if (e.target.id === 'cxp') document.getElementById('cxh').value = e.target.value.toUpperCase();
    else if (e.target.id === 'cxh' && hexOk(e.target.value)) document.getElementById('cxp').value = hexN(e.target.value).toLowerCase();
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'cxh') addSwatch(); if (e.key === 'Enter' && e.target.id === 'tok') root.querySelector('[data-tkok]').click(); });
  window.addEventListener('beforeunload', (e) => { if (changes()) { e.preventDefault(); e.returnValue = ''; } });
  draw(); refresh();
})();
