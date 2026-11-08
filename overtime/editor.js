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
  const norm = (d) => ({ swatches: (d && d.swatches) || [], sets: (d && d.sets) || {}, schools: (d && d.schools) || {}, abbr: (d && d.abbr) || {} });

  /* every school in the archive, with the district it wrestled in most recently */
  const UD = window.WR_UNITS || { schools: [], ss: [] };
  const DIST = new Map(); (UD.ss || []).forEach((r) => { const s = UD.schools[r[0]]; const o = DIST.get(s); if (r[3] && (!o || r[1] >= o[0])) DIST.set(s, [r[1], r[3]]); });
  /* each school's class in its latest season */
  const CLS = new Map(); (UD.ss || []).forEach((r) => { const s = UD.schools[r[0]], o = CLS.get(s); if (!o || r[1] >= o[0]) CLS.set(s, [r[1], r[2]]); });
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
  /* researched school colours (schoolresearch.js): suggestions only, nothing changes until Brock taps one in */
  const RES = window.OT_RESEARCH || {};
  const resOf = (s) => { const r = RES[s]; return r && r.c && r.c.length ? r : null; };
  /* a suggestion as a tag: fill = the first colour, dot = the second, text = the first later colour that reads on the fill */
  const resCols = (r) => { const hs = r.c.map((c) => c[1]); const p = T.fromColours(hs); return [p.fill, hs.length > 1 ? hs[1] : p.ink, p.ink]; };
  /* a school with a suggestion that its tag doesn't wear yet (unset, or set to other colours) */
  const resDiff = (s) => { const r = resOf(s); if (!r) return false; const id = doc.schools[s], cur = id && doc.sets[id]; return !cur || J(cur.map((h) => h.toUpperCase())) !== J(resCols(r).map((h) => h.toUpperCase())); };

  /* ---- state ---- */
  let base = norm(clone(window.OT_COLORS)), doc = clone(base);
  const draft = (() => { try { return JSON.parse(ls.get(K_DRAFT) || 'null'); } catch (e) { return null; } })();
  if (draft && draft.doc && draft.base) { base = norm(draft.base); doc = norm(draft.doc); }
  const nnorm = (o) => (o && typeof o === 'object' ? o : {});
  let nBase = nnorm(draft && draft.nBase), notes = nnorm(clone((draft && draft.notes) || nBase));
  const ui = { sort: 'az', note: '', pick: '', seq: [], recent: (() => { try { return JSON.parse(ls.get('ot-colors-recent') || '[]'); } catch (e) { return []; } })(), sel: Object.keys(doc.sets)[0] || null, part: 0, q: '', f: 'all', cl: '', th: '', thOpen: false, focus: '', del: false, add: false, armDel: false, min: false, save: '', err: '', tok: false };
  const undo = [];
  const keep = () => ls.set(K_DRAFT, changes() ? J({ base, doc, nBase, notes }) : null);
  const edit = (fn) => { undo.push(J({ doc, sel: ui.sel })); if (undo.length > 100) undo.shift(); fn(); ui.save = ''; ui.err = ''; keep(); draw(); };

  /* what changed since the file was loaded: sets, schools and swatches, key by key */
  function diff(a, b) {
    const out = { sets: [], schools: [], abbr: [], swAdd: b.swatches.filter((h) => !a.swatches.includes(h)), swDel: a.swatches.filter((h) => !b.swatches.includes(h)) };
    ['sets', 'schools', 'abbr'].forEach((k) => { new Set([...Object.keys(a[k]), ...Object.keys(b[k])]).forEach((x) => { if (J(a[k][x]) !== J(b[k][x])) out[k].push(x); }); });
    return out;
  }
  const ndiff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => J(a[k]) !== J(b[k]));
  const changes = () => { const d = diff(base, doc); return d.sets.length + d.schools.length + d.abbr.length + d.swAdd.length + d.swDel.length + ndiff(nBase, notes).length; };
  const colourChanges = () => { const d = diff(base, doc); return d.sets.length + d.schools.length + d.abbr.length + d.swAdd.length + d.swDel.length; };
  /* lay this browser's changes over the latest file on GitHub (another save may have landed since this page loaded) */
  function merge(remote) {
    const m = norm(clone(remote)), d = diff(base, doc);
    d.sets.forEach((k) => { if (doc.sets[k]) m.sets[k] = doc.sets[k]; else delete m.sets[k]; });
    d.schools.forEach((k) => { if (doc.schools[k]) m.schools[k] = doc.schools[k]; else delete m.schools[k]; });
    d.abbr.forEach((k) => { if (doc.abbr[k]) m.abbr[k] = doc.abbr[k]; else delete m.abbr[k]; });
    m.swatches = m.swatches.filter((h) => !d.swDel.includes(h)).concat(d.swAdd.filter((h) => !m.swatches.includes(h)));
    Object.keys(m.schools).forEach((k) => { if (!m.sets[m.schools[k]]) delete m.schools[k]; });
    return m;
  }

  /* identical sets fold into the first one (schools follow it), so copies and re-creations never pile up */
  function dedupe(m) { const seen = new Map(), alias = {};
    Object.keys(m.sets).forEach((id) => { const k = m.sets[id].map((h) => h.toUpperCase()).join(); if (seen.has(k)) { alias[id] = seen.get(k); delete m.sets[id]; } else seen.set(k, id); });
    Object.keys(m.schools).forEach((s) => { if (alias[m.schools[s]]) m.schools[s] = alias[m.schools[s]]; });
    const used = new Set(Object.values(m.schools)); Object.keys(m.sets).forEach((id) => { if (!used.has(id)) delete m.sets[id]; });
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
    const who = [...new Set(d.schools.concat(d.abbr))], sch = who.slice(0, 3).join(', '), more = who.length > 3 ? ` +${who.length - 3}` : '';
    const bits = [who.length ? sch + more : '', d.sets.length ? `${d.sets.length} set${d.sets.length > 1 ? 's' : ''}` : '', d.swAdd.length + d.swDel.length ? 'swatches' : ''].filter(Boolean);
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
  const abbr = (sch) => T.abbr(sch, doc);
  /* short names already used in the same district */
  const abClash = (s) => { const d = DIST.get(s); if (!d) return []; const a = abbr(s); return UD.schools.filter((x) => x !== s && DIST.get(x) && DIST.get(x)[1] === d[1] && abbr(x) === a); };
  const hexOk = (h) => /^#?[0-9a-f]{6}$/i.test(h.trim());
  const hexN = (h) => '#' + h.trim().replace('#', '').toUpperCase();
  const I = {
    flask: '<path d="M9.5 3.5 H14.5 M10.5 3.5 V9.5 L5 19 A1.2 1.2 0 0 0 6 20.5 H18 A1.2 1.2 0 0 0 19 19 L13.5 9.5 V3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/><path d="M7.6 15 H16.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 11 V16.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.3" fill="currentColor"/>',
    ext: '<path d="M14 4.5 H19.5 V10 M19.5 4.5 L11 13 M17 14 V19.5 H4.5 V7 H10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
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
    clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5 V12 L15 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    shield: '<path d="M12 3 L19.5 6 V11.5 C19.5 16 16.3 19.4 12 21 C7.7 19.4 4.5 16 4.5 11.5 V6 Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    link: '<path d="M10 14 L14 10 M8.5 11.5 L6.5 13.5 A3.5 3.5 0 0 0 11.5 18.5 L13.5 16.5 M15.5 12.5 L17.5 10.5 A3.5 3.5 0 0 0 12.5 5.5 L10.5 7.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16 L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    palette: '<path d="M12 3.5 A8.5 8.5 0 0 0 12 20.5 C13.6 20.5 14 19.4 13.3 18.3 C12.5 17 13.3 15.6 14.8 15.6 H17 A3.5 3.5 0 0 0 20.5 12 C20.5 7.3 16.7 3.5 12 3.5 Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="8" cy="11" r="1.4" fill="currentColor"/><circle cx="11" cy="7.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/>',
    warn: '<path d="M12 3 L22 20 H2 Z" fill="currentColor" opacity=".18"/><path d="M12 3 L22 20 H2 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9 V14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>',
  };
  /* the app's level icons (components.js NAVI): the state outline, its regions, its districts (icongeo.js) */
  const IG = window.OT_ICONGEO || { outline: '', d: {}, r: {} };
  const geo = (k) => { const line = `<path d="${IG.outline}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>`;
    const parts = (sh, w) => Object.values(sh).map((p) => `<path d="${p}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-opacity=".85" stroke-linejoin="round"/>`).join('');
    return `<svg viewBox="0 0 26 26" aria-hidden="true">${k === 'district' ? parts(IG.d, 0.6) : k === 'region' ? parts(IG.r, 0.9) : ''}${line}</svg>`; };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

  /* ---- drawing ---- */
  /* the list before the theme filter (search + chip), so theme counts follow the other filters */
  function baseShown() {
    const all = [...new Set([...UD.schools, ...Object.keys(doc.schools)])];
    const t = ui.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((s) => { const k = s.toLowerCase(); if (t.length && !t.every((x) => k.includes(x))) return false;
      if (ui.cl && !(CLS.has(s) && CLS.get(s)[1] === ui.cl)) return false;
      if (ui.f === 'grey') return !doc.schools[s] && T.auto(s).none;
      if (ui.f === 'notes') return !!notes[s];
      if (ui.f === 'res') return resDiff(s);
      if (ui.f !== 'all') return DIST.has(s) && DIST.get(s)[1] === +ui.f; return true; });
  }
  /* pill themes in the list: every distinct fill + dot + text, in colour order, with how many schools wear it */
  function themes(L) { const m = new Map(); L.forEach((s) => { const k = pkey(s, doc); const t = m.get(k); if (t) t.n++; else m.set(k, { k, p: T.paint(s, doc), n: 1 }); });
    return [...m.values()].sort((a, b) => hue(a.p.fill) - hue(b.p.fill) || hue(a.p.acc) - hue(b.p.acc) || b.n - a.n); }
  function schoolsShown() {
    return baseShown().filter((s) => !ui.th || pkey(s, doc) === ui.th)
      .sort((a, b) => (ui.sort in SORTS ? medOf(b, SORTS[ui.sort]) - medOf(a, SORTS[ui.sort]) : 0) || a.localeCompare(b));
  }
  /* the colour sheet for one school: its tag at every size, the saved sets to pick from (or none), and its own fill,
     dot and text. Editing colours never changes another school: a set shared with others is copied for this one first. */
  const colOf = (s) => { const id = doc.schools[s]; if (id && doc.sets[id]) return doc.sets[id]; const p = T.paint(s, doc); return [p.fill, p.acc, p.ink]; };
  /* schools whose names look like this one (one name inside the other, or a shared uncommon word, or a badge alias):
     the candidates for "same school, different name" notes */
  const STOP = new Set('high school area regional senior junior jr sr township twp catholic central north south east west valley mount mountain mt saint st county academy joint memorial christian prep the of and hs upper lower new city borough'.split(' '));
  const ALL = [...new Set([...UD.schools, ...Object.keys(window.OT_COLORS ? window.OT_COLORS.schools : {})])];
  const words = (n) => n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
  const WIX = new Map(); ALL.forEach((n) => words(n).forEach((w) => (WIX.get(w) || WIX.set(w, []).get(w)).push(n)));
  const aliases = (n) => { const id = window.SchoolBadge && window.SchoolBadge.identity(n); return id ? [id.school].concat(id.aliases || []).map((a) => a.toLowerCase()) : []; };
  function similar(n) {
    const lo = n.toLowerCase(), al = aliases(n), out = new Map();
    ALL.forEach((m) => { if (m === n) return; const ml = m.toLowerCase(); if (ml.includes(lo) || lo.includes(ml) || al.includes(ml)) out.set(m, 0); });
    words(n).forEach((w) => { const L = WIX.get(w) || []; if (L.length <= 6) L.forEach((m) => { if (m !== n && !out.has(m)) out.set(m, 1); }); });
    return [...out].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, 6).map((x) => x[0]);
  }
  const used = (id) => { ui.recent = [id].concat(ui.recent.filter((x) => x !== id)).slice(0, 6); ls.set('ot-colors-recent', J(ui.recent)); };
  /* the next or previous school in the list as it was when the picker opened */
  const step = (dir) => { const i = ui.seq.indexOf(ui.pick), n = ui.seq[i + dir]; if (n) { ui.pick = n; ui.focus = n; ui.add = false; ui.del = false; draw(); } };
  function sheet(s) {
    const at = ui.seq.indexOf(s), prev = at > 0, next = at >= 0 && at < ui.seq.length - 1, dd = DIST.get(s);
    const nav = `<div class="ce-nav"><button class="ce-ib" data-prev aria-label="Previous school"${prev ? '' : ' disabled'}>${svg('back')}</button><span class="ce-meta">${dd ? `<b>${dd[1]}</b>` : ''}${rangeOf(s)}</span><button class="ce-ib${notes[s] ? ' ce-on' : ''}" data-pnote aria-label="Note">${svg(notes[s] ? 'noted' : 'note')}</button><button class="ce-ib ce-fw" data-next aria-label="Next school"${next ? '' : ' disabled'}>${svg('back')}</button></div>`;
    const id = doc.schools[s], p = T.paint(s, doc), c = colOf(s), cur = c[ui.part], none = !id && p.none;
    const low = !none && T.contrast(c[0], c[2]) < T.READS;
    const pv = `<div class="ce-pv" style="--pz:${Math.max(13, Math.min(23, Math.floor(560 / Math.max(s.length, 1))))}px"><span class="ce-pvb">${pill(s, p)}</span><span class="ce-pvs">${pill(s, p)}${pill(abbr(s), p, 'ab')}${pill(abbr(s), p, 'ab xs')}<label class="ce-abl"><input id="ab" value="${esc(abbr(s))}" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Short name">${abClash(s).length ? `<span class="ce-la" role="img" aria-label="Another school in the district uses this short name">${svg('warn')}</span>` : ''}</label></span></div>`;
    const rec = ui.recent.filter((k) => doc.sets[k]).slice(0, 6);
    const chip = (k) => { const q = setPaint(k); return `<button class="ce-sb" data-set="${k}" aria-pressed="${k === id}" style="--fill:${q.fill};--acc:${q.acc};--ink:${q.ink}"><i></i>Aa</button>`; };
    const recent = rec.length ? `<div class="ce-ss ce-rec" role="group" aria-label="Recent sets">${svg('clock')}${rec.map(chip).join('')}</div>` : '';
    const sets = recent + `<div class="ce-ss" role="group" aria-label="Sets"><button class="ce-sb ce-none" data-auto aria-pressed="${!id}" aria-label="No set" style="--fill:${T.NONE.fill};--acc:${T.NONE.acc};--ink:${T.NONE.ink}"><i></i></button>${Object.keys(doc.sets).sort(byColour).map((k) => { const q = setPaint(k); return `<button class="ce-sb" data-set="${k}" aria-pressed="${k === id}" style="--fill:${q.fill};--acc:${q.acc};--ink:${q.ink}"><i></i>Aa</button>`; }).join('')}</div>`;
    const parts = `<div class="ce-pt" role="group" aria-label="Part">
      <button class="ce-pb" data-part="0" aria-pressed="${ui.part === 0}" aria-label="Fill"><span class="ce-sw0" style="background:${c[0]}"></span></button>
      <button class="ce-pb" data-part="1" aria-pressed="${ui.part === 1}" aria-label="Dot"><span class="ce-sw1" style="background:${c[1]}"></span></button>
      <button class="ce-pb" data-part="2" aria-pressed="${ui.part === 2}" aria-label="Text"><span class="ce-sw2" style="--fill:${c[0]};color:${c[2]}">Aa</span></button>
      ${low ? `<button class="ce-warn" data-fix aria-label="Make the text readable">${svg('warn')}</button>` : ''}</div>`;
    const sw = `<div class="ce-sg${ui.del ? ' ce-del' : ''}">${doc.swatches.map((h) => `<button class="ce-sw" data-sw="${h}" style="background:${h}" aria-pressed="${!ui.del && !none && h.toUpperCase() === cur.toUpperCase()}" aria-label="${h}"></button>`).join('')}
      <button class="ce-sw ce-tool" data-swadd aria-pressed="${ui.add}" aria-label="Add a colour">${svg('plus')}</button></div>`;
    const cx = ui.add ? `<div class="ce-cx"><input type="color" id="cxp" value="${cur}"><input type="text" id="cxh" value="${cur}" maxlength="7" spellcheck="false" autocomplete="off" inputmode="text"><button class="ce-ib" data-cxok aria-label="Add">${svg('ok')}</button><button class="ce-ib${ui.del ? ' ce-err' : ''}" data-swdel aria-pressed="${ui.del}" aria-label="Remove colours">${svg('trash')}</button></div>` : '';
    const bid = window.SchoolBadge && window.SchoolBadge.identity(s), bh = bid ? [bid.primary, bid.secondary, bid.accent].filter(Boolean).map((h) => h.toUpperCase()) : [];
    const badge = bh.length ? `<div class="ce-bdg">${svg('shield')}${bh.map((h) => `<button class="ce-sw" data-sw="${h}" style="background:${h}" aria-pressed="${!none && h === cur.toUpperCase()}" aria-label="${h}"></button>`).join('')}</div>` : '';
    const rr = resOf(s), rc = rr && resCols(rr), src = rr && (rr.s || []).find((u) => !u.startsWith('search:'));
    const rlink = rr && (src || (rr.w ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(rr.w.replace(/ /g, '_')) : (rr.s || [''])[0].replace(/^search:/, '')));
    const rinfo = rr && [rr.e, rr.x].filter(Boolean).join(' · ');
    const research = rr ? `<div class="ce-res"><span class="ce-rq" role="img" aria-label="Confidence ${rr.q} of 3">${[1, 2, 3].map((i) => `<b class="${i <= rr.q ? 'on' : ''}"></b>`).join('')}</span>${rr.c.map((c) => `<button class="ce-sw${c[2] === 'n' ? '' : ' ce-hx'}" data-sw="${c[1]}" style="background:${c[1]}" aria-pressed="${!none && c[1] === cur.toUpperCase()}" aria-label="${esc(c[0])} ${c[1]}"></button>`).join('')}<span class="ce-sp"></span><button class="ce-sb ce-ra" data-resok aria-pressed="${!!id && J(colOf(s).map((h) => h.toUpperCase())) === J(rc.map((h) => h.toUpperCase()))}" style="--fill:${rc[0]};--acc:${rc[1]};--ink:${rc[2]}" aria-label="Use"><i></i>Aa</button>${rinfo ? `<button class="ce-ib${ui.rinfo ? ' ce-on' : ''}" data-rinfo aria-label="Notes">${svg('info')}</button>` : ''}${rlink ? `<a class="ce-ib" href="${esc(rlink)}" target="_blank" rel="noopener" aria-label="Source">${svg('ext')}</a>` : ''}</div>${ui.rinfo && rinfo ? `<div class="ce-rx">${esc(rinfo)}</div>` : ''}` : '';
    const sim = similar(s);
    const kin = sim.length ? `<div class="ce-kin">${svg('link')}${sim.map((m) => `<button class="ce-kn" data-jump="${esc(m)}">${pill(m, T.paint(m, doc), 'xs')}<small>${rangeOf(m)}</small></button>`).join('')}</div>` : '';
    const was = changed(s) ? `<button class="ce-rv ce-rvs" data-rvs aria-label="Back to saved colours">${svg('undo')}${pill(s, T.paint(s, base))}</button>` : '';
    return `<div class="ce-tk" data-tkbg><div class="ce-tkc ce-cs">${nav}${pv}${was}${research}${kin}${sets}${parts}${rr ? '' : badge}${sw}${cx}<div class="ce-ntb"><span class="ce-sp"></span><button class="ce-ib ce-done" data-csok aria-label="Done">${svg('ok')}</button></div></div></div>`;
  }
  function list() {
    const ss = schoolsShown();
    const chips = [['all', 'All'], ['grey', `<span class="ce-mini" style="--f:${T.NONE.fill};--a:${T.NONE.acc}"><b><i></i></b>${greyN()}</span>`]]
      .concat([['notes', `<span class="ce-mini">${svg('note')}${Object.keys(notes).length}</span>`]])
      .concat([['res', `<span class="ce-mini">${svg('flask')}${Object.keys(RES).filter(resDiff).length}</span>`]])
      .concat(Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)]));
    const tp = ui.th && themes(baseShown()).find((t) => t.k === ui.th), tq = tp ? tp.p : null;
    const thChip = `<button data-thopen aria-pressed="${ui.thOpen}" aria-label="Pill themes">${tq ? `<span class="ce-mini" style="--f:${tq.fill};--a:${tq.acc}"><b><i></i></b></span>` : svg('palette')}</button>`;
    const thRow = ui.thOpen ? `<div class="ce-ss ce-thr" role="group" aria-label="Pill themes">${themes(baseShown()).map((t) => `<button class="ce-sb" data-th="${t.k}" aria-pressed="${t.k === ui.th}" style="--fill:${t.p.fill};--acc:${t.p.acc};--ink:${t.p.ink}"><i></i>${t.n}</button>`).join('')}</div>` : '';
    const sorts = [['az', '<b class="ce-az">A–Z</b>'], ['D', geo('district')], ['R', geo('region')], ['S', geo('state')]];
    return `<div class="ce-fl"><label class="ce-fs">${svg('search')}<input id="q" type="search" value="${esc(ui.q)}" autocomplete="off" aria-label="Search schools"></label><div class="ce-so" role="group" aria-label="Sort">${sorts.map(([k, l]) => `<button data-sort="${k}" aria-pressed="${ui.sort === k}" aria-label="${{ az: 'Name', D: 'District medals', R: 'Regional medals', S: 'State medals' }[k]}">${l}</button>`).join('')}</div></div>
      <div class="ce-ch" role="group" aria-label="Show">${thChip}${['AAA', 'AA'].map((c) => `<button data-cl="${c}" aria-pressed="${ui.cl === c}">${c}</button>`).join('')}${chips.map(([k, l]) => `<button data-f="${k}" aria-pressed="${ui.f === k}">${l}</button>`).join('')}</div>${thRow}
      <ul class="ce-sl">${ss.map((s) => { const p = T.paint(s, doc), d = DIST.get(s);
        return `<li class="ce-sr${ui.focus === s ? ' ce-foc' : ''}" data-s="${esc(s)}"><span class="ce-nm"><span class="ce-nmr">${pill(s, p)}${changed(s) ? `<button class="ce-rv" data-rv aria-label="Back to saved colours">${svg('undo')}${pill(abbr(s), T.paint(s, base), 'ab xs')}</button>` : ''}</span><small>${rangeOf(s)}</small></span><span class="ce-dn${ui.sort in SORTS ? ' ce-md' : ''}">${ui.sort in SORTS ? medOf(s, SORTS[ui.sort]) || '' : d ? d[1] : ''}</span><button class="ce-nb${notes[s] ? ' ce-has' : ''}" data-note aria-label="Note">${svg(notes[s] ? 'noted' : 'note')}</button></li>`; }).join('')}</ul>`;
  }
  function draw() {
    const n = changes(), focusQ = document.activeElement && document.activeElement.id === 'q', caret = focusQ ? document.activeElement.selectionStart : 0;
    const sv = ui.save === 'busy' ? 'spin' : ui.save === 'ok' ? 'ok' : ui.save === 'err' ? 'err' : 'save';
    const y = window.scrollY, sc = root.querySelector('.ce-cs'), csy = sc ? sc.scrollTop : 0;
    root.innerHTML = `<div class="ce-eb"><div class="ce-eh">
        <a class="ce-ib" href="./" aria-label="Back to Overtime">${svg('back')}</a><span class="ce-sp"></span>
        <button class="ce-ib" data-undo aria-label="Undo"${undo.length ? '' : ' disabled'}>${svg('undo')}</button>
        <button class="ce-ib${token() ? ' ce-on' : ''}" data-tok aria-label="GitHub token">${svg('key')}${token() ? '' : '<span class="ce-dt"></span>'}</button>
        <button class="ce-ib${ui.save ? " ce-" + ui.save : ""}" data-save aria-label="Save"${n || ui.save ? '' : ' disabled'}>${svg(sv)}${n && ui.save !== 'busy' ? `<span class="ce-bd">${n}</span>` : ''}</button>
      </div></div>
      ${ui.err ? `<div class="ce-msg" role="alert">${esc(ui.err)}</div>` : ''}<div class="ce-lw">${list()}</div>
      ${ui.pick ? sheet(ui.pick) : ''}
      ${ui.note ? `<div class="ce-tk" data-tkbg><div class="ce-tkc ce-nt"><div class="ce-nth">${pill(ui.note, T.paint(ui.note, doc))}</div><textarea id="nt" rows="4" spellcheck="true">${esc(notes[ui.note] ? notes[ui.note].note : '')}</textarea><div class="ce-ntb">${notes[ui.note] ? `<button class="ce-ib" data-ntdel aria-label="Delete note">${svg('trash')}</button>` : ''}<span class="ce-sp"></span><button class="ce-ib" data-ntok aria-label="Keep note">${svg('ok')}</button></div></div></div>` : ''}
      ${ui.tok ? `<div class="ce-tk" data-tkbg><div class="ce-tkc"><input id="tok" type="password" placeholder="github_pat_…" value="${esc(token())}" autocomplete="off" spellcheck="false"><button class="ce-ib" data-tkok aria-label="Keep token">${svg('ok')}</button>${token() ? `<button class="ce-ib" data-tkdel aria-label="Forget token">${svg('trash')}</button>` : ''}</div></div>` : ''}`;
    window.scrollTo(0, y); const s2 = root.querySelector('.ce-cs'); if (s2) s2.scrollTop = csy;
    if (focusQ) { const q = document.getElementById('q'); q.focus(); q.setSelectionRange(caret, caret); }
    if (ui.tok) document.getElementById('tok').focus();
    if (ui.note) { const t = document.getElementById('nt'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }

  /* ---- actions ---- */
  /* the set this school's colour edits go to: its own set, or a fresh copy when it shares one (or has none) */
  const pkey = (s, d) => { const q = T.paint(s, d); return q.fill + q.acc + q.ink; };
  const changed = (s) => pkey(s, doc) !== pkey(s, base);
  /* put one school back to its saved colours (its saved set, restored or re-made if it was edited since) */
  function revert(s) { edit(() => { const id = base.schools[s];
    if (!id) { delete doc.schools[s]; return; }
    const was = base.sets[id]; if (J(doc.sets[id]) === J(was)) { doc.schools[s] = id; return; }
    const others = Object.keys(doc.schools).some((k) => k !== s && doc.schools[k] === id);
    if (!doc.sets[id] || !others) { doc.sets[id] = was.slice(); doc.schools[s] = id; } else { const n = newId(); doc.sets[n] = was.slice(); doc.schools[s] = n; } }); }
  function own(s) { const id = doc.schools[s]; if (id && uses(id) === 1) return id; const n = newId(); doc.sets[n] = colOf(s).slice(); doc.schools[s] = n; return n; }
  function setPart(h) { const s = ui.pick; if (colOf(s)[ui.part].toUpperCase() === h.toUpperCase() && doc.schools[s]) return; edit(() => { const id = own(s); doc.sets[id] = doc.sets[id].slice(); doc.sets[id][ui.part] = h; used(id); }); }
  function addSwatch() { const h = document.getElementById('cxh').value; if (!hexOk(h)) return; const v = hexN(h);
    if (!doc.swatches.includes(v)) edit(() => { doc.swatches.push(v); }); ui.add = false; setPart(v); draw(); }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-s],[data-tkbg]'); if (!t) return; const d = t.dataset;
    if (d.part != null) { ui.part = +d.part; draw(); }
    else if (d.sw) { if (ui.del) edit(() => { doc.swatches = doc.swatches.filter((h) => h !== d.sw); }); else setPart(d.sw); }
    else if (d.swadd != null) { ui.add = !ui.add; ui.del = false; draw(); }
    else if (d.swdel != null) { ui.del = !ui.del; draw(); }
    else if (d.cxok != null) addSwatch();
    else if (d.set) { const k = ui.pick; used(d.set); if (doc.schools[k] !== d.set) edit(() => { doc.schools[k] = d.set; }); else draw(); }
    else if (d.prev != null) step(-1);
    else if (d.pnote != null) { ui.note = ui.pick; draw(); }
    else if (d.jump) { ui.pick = d.jump; ui.focus = d.jump; ui.add = false; ui.del = false; draw(); }
    else if (d.next != null) step(1);
    else if (d.auto != null) { const k = ui.pick; if (doc.schools[k]) edit(() => { delete doc.schools[k]; }); }
    else if (d.csok != null) { ui.pick = ''; ui.add = false; ui.del = false; draw(); }
    else if (d.resok != null) { const s = ui.pick, rc = resCols(resOf(s)).map((h) => h.toUpperCase());
      const same = Object.keys(doc.sets).find((k) => J(doc.sets[k].map((h) => h.toUpperCase())) === J(rc));
      edit(() => { if (same) doc.schools[s] = same; else { const n = own(s); doc.sets[n] = rc; } }); }
    else if (d.rinfo != null) { ui.rinfo = !ui.rinfo; draw(); }
    else if (d.f) { ui.f = d.f; draw(); }
    else if (d.cl) { ui.cl = ui.cl === d.cl ? '' : d.cl; draw(); }
    else if (d.thopen != null) { ui.thOpen = !ui.thOpen; if (!ui.thOpen) ui.th = ''; draw(); }
    else if (d.th) { ui.th = ui.th === d.th ? '' : d.th; draw(); }
    else if (d.sort) { ui.sort = d.sort; draw(); }
    else if (d.note != null) { e.stopPropagation(); ui.note = t.closest('[data-s]').dataset.s; draw(); }
    else if (d.ntok != null) { const v = document.getElementById('nt').value.trim(), k = ui.note; ui.note = '';
      if (v) { if (!notes[k] || notes[k].note !== v) notes[k] = { note: v, at: new Date().toISOString().slice(0, 10) }; } else delete notes[k]; ui.save = ''; keep(); draw(); }
    else if (d.ntdel != null) { delete notes[ui.note]; ui.note = ''; ui.save = ''; keep(); draw(); }
    else if (d.rvs != null) revert(ui.pick);
    else if (d.rv != null) { e.stopPropagation(); revert(t.closest('[data-s]').dataset.s); }
    else if (d.s) { ui.focus = d.s; ui.pick = d.s; ui.seq = schoolsShown(); draw(); }
    else if (d.fix != null) { const c = colOf(ui.pick), ink = [c[1], '#FFFFFF', '#000000'].find((h) => T.contrast(c[0], h) >= T.READS) || (T.contrast(c[0], '#FFFFFF') >= T.contrast(c[0], '#000000') ? '#FFFFFF' : '#000000');
      const keepPart = ui.part; ui.part = 2; setPart(ink); ui.part = keepPart; draw(); }
    else if (d.undo != null) { const u = undo.pop(); if (u) { const o = JSON.parse(u); doc = o.doc; ui.sel = o.sel; ui.save = ''; keep(); draw(); } }
    else if (d.save != null) { if (ui.save === 'err' && !changes()) { ui.save = ''; ui.err = ''; draw(); } else save(); }
    else if (d.tok != null) { ui.tok = true; draw(); }
    else if (d.tkok != null) { ls.set(K_TOKEN, document.getElementById('tok').value.trim() || null); ui.tok = false; ui.err = ''; draw(); refresh(); }
    else if (d.tkdel != null) { ls.set(K_TOKEN, null); ui.tok = false; draw(); }
    else if (d.tkbg != null && e.target === t) { if (ui.note || ui.tok) { ui.tok = false; ui.note = ''; } else { ui.pick = ''; ui.add = false; ui.del = false; } draw(); }
  });
  root.addEventListener('change', (e) => { if (e.target.id !== 'ab' || !ui.pick) return; const s = ui.pick, v = e.target.value.trim().toUpperCase().replace(/[^A-Z0-9&.'-]/g, '').slice(0, 5);
    const auto = T.abbr(s, { ...doc, abbr: {} }); if ((v || auto) === abbr(s)) { e.target.value = abbr(s); return; }
    edit(() => { if (!v || v === auto) delete doc.abbr[s]; else doc.abbr[s] = v; }); });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'q') { ui.q = e.target.value; const lw = root.querySelector('.ce-lw'); const pos = e.target.selectionStart; lw.innerHTML = list(); const q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos); }
    else if (e.target.id === 'cxp') document.getElementById('cxh').value = e.target.value.toUpperCase();
    else if (e.target.id === 'cxh' && hexOk(e.target.value)) document.getElementById('cxp').value = hexN(e.target.value).toLowerCase();
  });
  document.addEventListener('keydown', (e) => { if (!ui.pick || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return; if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') { ui.pick = ''; draw(); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'ab') e.target.blur(); if (e.key === 'Enter' && e.target.id === 'cxh') addSwatch(); if (e.key === 'Enter' && e.target.id === 'tok') root.querySelector('[data-tkok]').click(); });
  window.addEventListener('beforeunload', (e) => { if (changes()) { e.preventDefault(); e.returnValue = ''; } });
  draw(); refresh();
})();
