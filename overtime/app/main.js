/* Overtime — router and interactions */
'use strict';
(() => {
  /* OT is rebuilt once, when the second boot stage lands (below): read PAGES and the setters through OT at call time */
  const { state, wordmark, navIcon, esc } = OT;
  const setCls = (c) => OT.setCls(c), setWin = (w) => OT.setWin(w);
  const main = document.getElementById('main'), brand = document.getElementById('brand'), fbar = document.getElementById('fbar'), fpop = document.getElementById('fpop'), fscrim = document.getElementById('fscrim'), mbtn = document.getElementById('mbtn'), sbtn = document.getElementById('sbtn');
  brand.innerHTML = wordmark(); mbtn.innerHTML = navIcon('menu'); sbtn.innerHTML = navIcon('search');
  function route() {
    const raw = (location.hash || '#state').slice(1); const [h, qs] = raw.split('?'); const [page, ...rest] = h.split('/'); const id = rest.join('/');
    const q = {}; (qs || '').split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) q[k] = decodeURIComponent(v || ''); });
    const keep = Object.entries(q).filter(([k]) => k !== 'b').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    return { page: OT.PAGES[page] ? page : 'state', id: decodeURIComponent(id || ''), q, base: '#' + h + (keep ? '?' + keep : '') };
  }
  /* href for the same page with a bracket overlay open (key) or closed (null) */
  OT.bhref = (key) => { const r = route(); return key ? `${r.base}${r.base.includes('?') ? '&' : '?'}b=${encodeURIComponent(key)}` : r.base; };

  /* ---------- the filter bar ----------
     The page is a function of the filters: nothing → State, Region → region, + District → district, School → school,
     Wrestlers → the wrestler list under all of the above. Place and Wrestlers live in the URL (so links and the back
     button work); division, time and weights live in state and are stamped on each history entry. */
  const schoolName = (sl) => sl && (OT.SCHOOL_BY_SLUG.get(sl) || OT.SLUG2S.get(sl));
  const regionOfD = (d) => { const sp = OT.districtRegionSpans(d); return sp.length ? sp[sp.length - 1].g : ''; };
  function F() {
    const { page, id, q } = route(); const o = { r: '', d: 0, s: '', w: false, who: '' };
    const fromSchool = (n) => { const u = OT.U.school(n); o.s = n; o.d = u.d || 0; o.r = u.region || (u.d ? regionOfD(u.d) : ''); };
    if (page === 'region' && id) o.r = id;
    else if (page === 'district' && id) { o.d = +id; o.r = regionOfD(+id); }
    else if (page === 'school' && id) { const n = schoolName(id); if (n) fromSchool(n); }
    else if (page === 'wrestlers') { o.w = true; const n = schoolName(q.s); if (n) fromSchool(n); else if (+q.d) { o.d = +q.d; o.r = q.r || regionOfD(+q.d); } else if (q.r) o.r = q.r; }
    else if (page === 'wrestler') { o.w = true; const W = OT.getWrestler(id); if (W) o.who = W.name; }
    return o;
  }
  const sslug = (n) => OT.U.school(n).href.replace('#school/', '');
  function hrefOf(o) {
    if (o.w) { const p = o.s ? 's=' + sslug(o.s) : o.d ? 'd=' + o.d : o.r ? 'r=' + o.r : ''; return '#wrestlers' + (p ? '?' + p : ''); }
    return o.s ? '#school/' + sslug(o.s) : o.d ? '#district/' + o.d : o.r ? '#region/' + o.r : '#state';
  }
  const winText = () => state.win.mode === 'all' ? 'All-time' : state.win.mode === 'custom' ? OT.windowLabel() : 'Last ' + state.win.mode;
  const wtText = () => { const w = state.f.weights; return !w.length ? 'All' : w.length === 1 ? OT.STD.find((x) => x.k === w[0]).label : w.length + ' wts'; };
  let pop = '', sgOpen = false;
  /* The bottom bar: four tabs (what the page shows) around the filter button (which place, class and seasons).
     Map, Rankings, History and Brackets are views of the place page; Rankings also holds the wrestlers, the
     all-time team and the records. The view lives in the address (?v=rank, ?v=hist, ?v=brk; none = Map) and the Rankings list in
     ?l=, so each tab is its own history entry: Back steps through the tabs, and a link opens the same tab. */
  const TABS = [['map', 'Map', 'v_map'], ['rank', 'Rankings', 'v_rank'], null, ['hist', 'History', 'v_seasons'], ['brk', 'Brackets', 'v_brk']];
  const VIEWK = ['map', 'rank', 'hist', 'brk'];
  /* old addresses: Timeline and Seasons are now the two halves of History */
  const OLDV = { time: ['hist', 'time'], seasons: ['hist', ''] };
  const PLACEP = ['state', 'region', 'district', 'school'];
  const isPlace = (h) => { const m = /^#([a-z]+)(\/[^?]*)?/.exec(h || ''); return !!m && PLACEP.includes(m[1]) && (m[1] === 'state' || !!(m[2] && m[2].length > 1)); };
  /* the same address with its view (and Rankings list) set; Map drops the parameter */
  function withView(h, v, l) {
    const [p, qs] = (h || '#state').split('?'); const q = new URLSearchParams(qs || ''); q.delete('b');
    if (v && v !== 'map') q.set('v', v); else q.delete('v');
    if (l !== undefined) { if (l) q.set('l', l); else q.delete('l'); }
    const s = q.toString(); return p + (s ? '?' + s : '');
  }
  /* a link to another place keeps the tab you are on (the logo always goes home to the Map) */
  const keepView = (h) => (isPlace(h) && !/[?&]v=/.test(h) && state.view !== 'map' ? withView(h, state.view) : h);
  if (!VIEWK.includes(state.view)) state.view = 'map';
  /* a school page has no map: its first tab is the season grid and its best wrestlers */
  const tabLabel = (k, l) => (k === 'map' && route().page === 'school' && route().id ? 'Overview' : l);
  const curTab = () => { const pg = route().page; if (pg === 'wrestlers' || pg === 'wrestler') return 'rank'; return ['state', 'region', 'district', 'school'].includes(pg) ? state.view : ''; };
  const clsText = () => (state.cls === 'ALL' ? 'All' : state.cls) + (state.f.weights.length ? ' · ' + wtText() : '');
  const placeText = (f) => f.s || (f.d ? 'District ' + f.d : f.r ? OT.REGIONS[f.r] : 'Pennsylvania');
  const filtersOn = () => state.cls !== 'AAA' || state.f.weights.length > 0 || state.win.mode !== 'all';
  function drawBar() {
    const cur = curTab();
    const tab = ([k, l, ic]) => `<button class="fb${cur === k ? ' on' : ''}" type="button" data-tab="${k}"${cur === k ? ' aria-current="page"' : ''}>${navIcon(ic)}<span class="fbv">${tabLabel(k, l)}</span></button>`;
    const val = clsText() + ' · ' + winText();
    const mid = `<button class="fb ft${filtersOn() ? ' on' : ''}" type="button" data-fb="filters" aria-label="Filters: ${esc(placeText(F()))}, ${esc(val)}" aria-haspopup="dialog" aria-expanded="${pop === 'filters'}"><span class="ftc">${navIcon('filters')}</span><span class="fbv">${esc(val)}</span></button>`;
    /* the bracket-toughness key rides on top of the bar whenever the page shows signal bars; tap it to open the cut points */
    const sgOn = !pop && !!main.querySelector('.sgn:not(.sg0)'); document.body.classList.toggle('sgk-on', sgOn);
    const key = sgOn ? `<div class="sgkey${sgOpen ? ' open' : ''}" role="button" tabindex="0" aria-expanded="${sgOpen}" aria-label="Bracket toughness key"><div class="sgki">${OT.sgKey(sgOpen)}</div></div>` : '';
    fbar.innerHTML = key + `<div class="fbi tabs">${TABS.map((t) => (t ? tab(t) : mid)).join('')}</div>`;
  }
  /* the popups: one at a time, a sheet above the bar on a phone, a panel anchored to its button on a desktop */
  let SCH = null; const schools = () => SCH || (SCH = OT.UD.schools.map((n) => { const u = OT.U.school(n); return { n, d: u.d || 0, r: u.region || '', q: n.toLowerCase() }; }).sort((a, b) => a.n.localeCompare(b.n)));
  const schoolScope = (f) => schools().filter((x) => (!f.d || x.d === f.d) && (f.d || !f.r || x.r === f.r));
  const schoolItems = (f, qq) => { const t = (qq || '').trim().toLowerCase(); const all = schoolScope(f).filter((x) => !t || x.q.includes(t)); const L = all.slice(0, 80);
    return (L.length ? L.map((x) => `<a class="fpo${x.n === f.s ? ' on' : ''}" href="${hrefOf({ ...f, w: f.w && !f.who, s: x.n })}"><span>${esc(x.n)}</span><small>${x.d ? 'D' + x.d : ''}</small></a>`).join('') : '<div class="fpn">No school by that name here.</div>') + (all.length > 80 ? `<div class="fpn">${all.length - 80} more: type to narrow.</div>` : ''); };
  const POP = {
    filters: () => filtersPage(),
    search: () => `<input class="search" id="gsq" type="search" placeholder="Wrestler, school or district" autocomplete="off" aria-label="Search wrestlers, schools and districts"><div class="gsr" id="gsr"><div class="fpn">Type at least two letters. Wrestlers include everyone in any bracket on file.</div></div>`,
    menu: () => `<nav class="fpm" aria-label="More"><a href="#season">Season recap<small>Champions, team titles, upsets, one season at a time</small></a><a href="#h2h/">Head to head<small>Two wrestlers or two schools, with odds</small></a><a href="#missing">Missing from the archive<small>Tournaments on record only in part</small></a><a href="#about">About<small>How ratings and scores work</small></a></nav>`,
  };
  /* ---------- the filter page ----------
     Changes are a draft until "Show": pick a place on the map, by search or from the path, then seasons, class and
     weights, and see the result once. Closing the page drops the draft. */
  let draft = null;
  const DEF_WIN = { mode: 'all', from: null, to: null };
  const newDraft = () => { const f = F(); return { r: f.r, d: f.d, s: f.s, cls: state.cls, win: { ...state.win }, w: state.f.weights.slice() }; };
  const withWin = (win, fn) => { const keep = state.win; state.win = win; try { return fn(); } finally { state.win = keep; } };
  const dPlace = (g) => g.s || (g.d ? 'District ' + g.d : g.r ? OT.REGIONS[g.r] + ' Region' : 'Pennsylvania');
  const dWin = (g) => (g.win.mode === 'all' ? 'All-time' : g.win.mode === 'custom' ? withWin(g.win, () => OT.windowLabel()) : 'Last ' + g.win.mode + ' seasons');
  const dCls = (g) => (g.cls === 'ALL' ? 'AAA and AA' : g.cls);
  const dWts = (g) => (!g.w.length ? 'All weights' : g.w.length <= 3 ? g.w.map((k) => OT.STD.find((x) => x.k === k).label).join(', ') + ' lbs' : g.w.length + ' weights');
  const sameDraft = (g) => { const f = F(); return g.r === f.r && g.d === f.d && g.s === f.s && g.cls === state.cls && same(g.win, state.win) && same(g.w.slice().sort(), state.f.weights.slice().sort()); };
  function placeMap(g) {
    const M = window.PA_MAP; if (!M || !M.d) return '';
    const cls = (d) => (g.d === d ? 'on' : g.r && regionOfD(d) === g.r ? 'reg' : '');
    const paths = d3.range(1, 13).filter((d) => M.d[d]).map((d) => `<path class="fmd ${cls(d)}" d="${M.d[d]}" data-dp="d:${d}"><title>District ${d} · ${esc(OT.DISTRICTS[d] || '')}</title></path>`).join('');
    const labs = d3.range(1, 13).map((d) => { const p = M.dot[d]; if (!p) return ''; const small = !M.d[d];
      return small ? `<g class="fm8 ${cls(d)}" data-dp="d:${d}"><circle cx="${p[0]}" cy="${p[1]}" r="26"/><text x="${p[0]}" y="${p[1] + 9}">8</text><title>District 8 · ${esc(OT.DISTRICTS[8] || '')}</title></g>` : `<text class="fml ${cls(d)}" x="${p[0]}" y="${p[1] + 12}">${d}</text>`; }).join('');
    return `<svg class="fmap" viewBox="0 0 1000 560" role="group" aria-label="Pick a district on the map">${paths}${labs}</svg>`;
  }
  function placeHits(q) {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean); if (!t.length) return '';
    const regs = OT.FIVE.filter((g) => t.every((w) => (OT.REGIONS[g] + ' region').toLowerCase().includes(w)));
    const dis = DSEARCH.filter((x) => t.every((w) => x.q.split(/\s+/).some((y) => y.startsWith(w)))).slice(0, 4);
    const sch = schools().filter((x) => t.every((w) => x.q.includes(w))).slice(0, 12);
    const row = (dp, name, sub) => `<button type="button" class="fhit" data-dp="${esc(dp)}"><span>${name}</span><small>${esc(sub)}</small></button>`;
    const h = regs.map((g) => row('r:' + g, esc(OT.REGIONS[g]) + ' Region', 'Region')).join('') + dis.map((x) => row('d:' + x.d, 'District ' + x.d, OT.DISTRICTS[x.d] || '')).join('') + sch.map((x) => row('s:' + x.n, esc(x.n), x.d ? 'District ' + x.d : '')).join('');
    return h || '<div class="fpn">Nothing by that name.</div>';
  }
  function filtersPage() {
    const g = draft || (draft = newDraft());
    const path = [['', 'Pennsylvania']].concat(g.r ? [['r:' + g.r, OT.REGIONS[g.r]]] : []).concat(g.d ? [['d:' + g.d, 'District ' + g.d]] : []).concat(g.s ? [['s:' + g.s, g.s]] : []);
    const crumb = `<nav class="fpath" aria-label="Place">${path.map(([dp, n], i) => `${i ? '<span aria-hidden="true">›</span>' : ''}<button type="button" data-dp="${esc(dp)}" class="${i === path.length - 1 ? 'on' : ''}">${esc(n)}</button>`).join('')}</nav>`;
    const regs = `<div class="fregs">${OT.FIVE.map((r) => `<button type="button" class="fpc${g.r === r ? ' on' : ''}" data-dp="${g.r === r && !g.d && !g.s ? '' : 'r:' + r}" aria-pressed="${g.r === r}">${esc(OT.REGIONS[r])}</button>`).join('')}</div>`;
    const inScope = (g.d || g.r) ? schools().filter((x) => (g.d ? x.d === g.d : x.r === g.r)) : [];
    const slist = inScope.length ? `<details class="fsch"${g.s ? ' open' : ''}><summary><span>Schools in ${esc(g.d ? 'District ' + g.d : OT.REGIONS[g.r])}</span><small>${inScope.length}</small></summary><div class="fschl">${inScope.map((x) => `<button type="button" class="${g.s === x.n ? 'on' : ''}" data-dp="s:${esc(x.n)}">${esc(x.n)}</button>`).join('')}</div></details>` : '';
    const seg = (key, items, cur) => `<div class="seg fseg" role="group">${items.map(([k, l]) => `<button type="button" data-${key}="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
    const scr = withWin(g.win, () => OT.timeScrubber());
    const wopen = g.w.length > 0;
    return `<div class="fhd"><h2>Filters</h2><button type="button" class="fclose" data-fclose aria-label="Close">✕</button></div>
      <div class="fsum" aria-live="polite"><b>${esc(dPlace(g))}</b><span>${esc(dCls(g))} · ${esc(dWin(g))} · ${esc(dWts(g))}</span></div>
      <div class="fq"><input class="search" id="fsq" type="search" placeholder="Search a school, district or region" autocomplete="off" aria-label="Search a school, district or region"><div class="fhits" id="fsr"></div></div>
      <section class="fsec fplace"><h3>Place</h3>${crumb}${placeMap(g)}${regs}${slist}</section>
      <section class="fsec"><h3>Seasons</h3>${seg('tw', [['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25']], g.win.mode)}${scr}</section>
      <section class="fsec"><h3>Class</h3>${seg('fdiv', [['AAA', 'AAA'], ['AA', 'AA'], ['ALL', 'Both']], g.cls)}<p class="fpn">Before the split into two classes, every season counts under both.</p></section>
      <section class="fsec"><details class="fwts"${wopen ? ' open' : ''}><summary><h3>Weights</h3><span>${esc(dWts(g))}</span></summary><div class="fpg">${OT.STD.map((x) => `<button type="button" class="fpc${g.w.includes(x.k) ? ' on' : ''}" data-fw="${esc(x.k)}" aria-pressed="${g.w.includes(x.k)}">${x.label}</button>`).join('')}</div><p class="fpn">Weights narrow the wrestler lists, all-time teams and a school's timeline. Ratings, scores and maps count every weight.</p></details></section>
      <div class="ffoot"><button type="button" class="freset" data-freset>Reset</button><button type="button" class="fgo" data-fapply>${sameDraft(g) ? 'Done' : 'Show ' + esc(dPlace(g))}</button></div>`;
  }
  function setDraftPlace(dp) {
    const g = draft; if (!g) return;
    if (!dp) Object.assign(g, { r: '', d: 0, s: '' });
    else if (dp.startsWith('r:')) Object.assign(g, { r: dp.slice(2), d: 0, s: '' });
    else if (dp.startsWith('d:')) { const d = +dp.slice(2); Object.assign(g, { d, r: regionOfD(d), s: '' }); }
    else if (dp.startsWith('s:')) { const n = dp.slice(2), u = OT.U.school(n); Object.assign(g, { s: n, d: u.d || 0, r: u.region || (u.d ? regionOfD(u.d) : '') }); }
  }
  function applyDraft() {
    const g = draft; if (!g) return closePop(); const f = F(); let filt = false;
    if (g.cls !== state.cls) { setCls(g.cls); filt = true; }
    if (!same(g.win, state.win)) { setWin({ ...DEF_WIN, ...g.win }); filt = true; }
    if (!same(g.w.slice().sort(), state.f.weights.slice().sort())) { OT.clearFilters('weights'); g.w.forEach((k) => OT.toggleFilter('weights', k)); filt = true; }
    SCH = null; closePop();
    const h = hrefOf({ w: f.w && !f.who, r: g.r, d: g.d, s: g.s });
    const hv = keepView(h); if (location.hash !== hv) location.hash = hv; else if (filt) changed();
  }
  function paintPop() {
    if (!pop) return; const keepTop = fpop.dataset.pop === pop ? fpop.scrollTop : 0; fpop.innerHTML = `<div class="fpi">${POP[pop]()}</div>`; fpop.dataset.pop = pop; fpop.className = 'fpop' + (pop === 'menu' ? ' menu' : pop === 'search' ? ' menu gs' : '') + (pop === 'filters' ? ' flt' : ''); fpop.scrollTop = keepTop;
    const btn = pop === 'menu' ? mbtn : pop === 'search' ? sbtn : fbar.querySelector(`[data-fb="${pop}"]`);
    if (window.innerWidth >= 720 && btn) { const r = btn.getBoundingClientRect(), W = Math.min(pop === 'filters' ? (window.innerWidth >= 1000 ? 920 : 600) : pop === 'search' ? 460 : 380, window.innerWidth - 24); const L = Math.max(12, Math.min(window.innerWidth - 12 - W, (pop === 'menu' || pop === 'search') ? r.right - W : r.left + r.width / 2 - W / 2)); fpop.style.left = L + 'px'; fpop.style.width = W + 'px'; }
    else { fpop.style.left = ''; fpop.style.width = ''; }
    if (pop === 'search') wireGlobalSearch();
    if (pop === 'filters') { const q = fpop.querySelector('#fsq'), out = fpop.querySelector('#fsr'); if (q) q.addEventListener('input', () => { out.innerHTML = placeHits(q.value); }); }
    const inp = fpop.querySelector('#fps'); if (inp) { inp.addEventListener('input', () => { fpop.querySelector('#fpl').innerHTML = schoolItems(F(), inp.value); }); if (window.innerWidth >= 720) inp.focus(); }
  }
  function openPop(k) { pop = k; if (k === 'filters') draft = newDraft(); fpop.hidden = false; fscrim.hidden = false; fscrim.classList.toggle('menu', k === 'menu'); mbtn.setAttribute('aria-expanded', String(k === 'menu')); sbtn.setAttribute('aria-expanded', String(k === 'search')); paintPop(); drawBar(); }
  function closePop() { if (!pop) return; pop = ''; draft = null; fpop.dataset.pop = ''; fpop.hidden = true; fscrim.hidden = true; fpop.innerHTML = ''; mbtn.setAttribute('aria-expanded', 'false'); sbtn.setAttribute('aria-expanded', 'false'); drawBar(); }
  /* division, time and weights: each change is its own history entry, so Back steps through it */
  const snap = () => ({ cls: state.cls, win: { ...state.win }, w: state.f.weights.slice() });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stamp = () => { try { history.replaceState({ ot: snap() }, ''); } catch (e) { /* none */ } };
  const changed = () => { try { history.pushState({ ot: snap() }, ''); } catch (e) { /* none */ } render(true); };
  window.addEventListener('popstate', (e) => { const s = e.state && e.state.ot; if (!s || same(s, snap())) return; state.win = { ...s.win }; state.f.weights = s.w.slice(); setWin(s.win); setCls(s.cls); try { localStorage.setItem('ot-filters', JSON.stringify({ weights: s.w })); } catch (er) { /* none */ } if (location.hash === lastHash) render(true); });

  const bview = document.getElementById('bview');
  function showBracket(key, focus) {
    if (!key) { if (!bview.hidden) { bview.hidden = true; bview.innerHTML = ''; document.body.classList.remove('noscroll'); } return; }
    const paint = () => { bview.innerHTML = `<div class="bvcard">${OT.bracketView(key, focus)}</div>`; OT.wirePager(bview); };
    paint(); bview.hidden = false; document.body.classList.add('noscroll'); bview.scrollTop = 0;
    const me = bview.querySelector('.bvc.me'); if (me) me.scrollIntoView({ block: 'center' });
    const again = () => { if (!bview.hidden && route().q.b === key) { const top = bview.scrollTop; paint(); bview.scrollTop = top; } };
    const k = OT.parseBkey(key); if (k && k.lvl !== 'state' && !OT.lowerLoaded(k.year, k.lvl)) OT.loadLower(k.year, k.lvl).then(again);
    if (k && !OT.sosLoaded(k.year)) OT.loadSOS(k.year).then(again);
  }
  /* a choice inside a tab (History half, Brackets season and level, Records list) rewrites its parameter in place */
  function setQ(k, v) { const [p0, qs] = (location.hash || '#state').split('?'); const u = new URLSearchParams(qs || ''); u.delete('b'); u.set(k, v); try { history.replaceState(history.state, '', p0 + '?' + u); } catch (er) { /* none */ } lastHash = location.hash; lastBase = ''; render(true); }
  let lastBase = '', lastHash = '';
  function render(keepScroll) {
    const { page, id, q, base } = route(); lastHash = location.hash;
    if (PLACEP.includes(page) && OLDV[q.v]) { const [v, h] = OLDV[q.v]; const [p0, qs] = location.hash.split('?'); const u = new URLSearchParams(qs || ''); u.set('v', v); if (h) u.set('h', h); try { history.replaceState(history.state, '', p0 + '?' + u); } catch (er) { /* none */ } return render(keepScroll); }
    if (PLACEP.includes(page)) { state.view = VIEWK.includes(q.v) ? q.v : 'map'; if (q.l) state.child = q.l; }
    document.body.classList.remove('bars-off');
    if (!OT.full && !coreRoute(page, q)) { waiting = true; if (main.firstChild) { lastBase = ''; main.innerHTML = '<div class="card empty" role="status">Loading the archive…</div>'; } return; }
    if (base === lastBase && (q.b || bview && !bview.hidden)) { showBracket(q.b, page === 'wrestler' ? id : null); stamp(); return; }
    lastBase = base;
    const f = F(); state.ctxDistrict = f.d;
    /* the place filters only narrow the wrestler list; the place pages scope themselves */
    const on = page === 'wrestlers'; Object.assign(state.f, { regions: on && f.r && !f.d && !f.s ? [f.r] : [], districts: on && f.d && !f.s ? [f.d] : [], schools: on && f.s ? [f.s] : [] });
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.rall = false; state.uall = false; state.hall = false; state.pseason = null; state.mlall = false; state.tln = 50; state.lastRoute = page + '/' + id; }
    main.innerHTML = OT.PAGES[page](id, q); main.querySelectorAll('.pscr.scroll, .tlx').forEach((el) => { el.scrollLeft = el.scrollWidth; }); edgeScroll(main); if (page === 'wrestler') { loadBestWins(id); loadCareer(id); } if (page === 'h2h') { loadH2H(id); wireH2H(); } if (page === 'h2hs') { loadH2HS(id); wireH2H(); } if (page === 'season') loadSeason(id); if (main.querySelector('[data-need-upsets]')) OT.loadUpsets().then(() => { if (route().base === base) { lastBase = ''; render(true); } }); if (page === 'about' && OT.wireAbout) OT.wireAbout(main);
    if (main.querySelector('[data-need-people]')) OT.loadPeople().then(() => { if (route().base === base) { lastBase = ''; render(true); } });
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Overtime';
    drawBar(); paintPop(); stamp();
    if (!keepScroll) window.scrollTo(0, 0);
    wireSearch();
    if (main.querySelector('[data-need-ss]')) OT.loadSeasons().then(() => { if (route().base === base) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
    if (main.querySelector('[data-need-bw]')) OT.loadBW().then(() => { if (route().base === base) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
    showBracket(q.b, page === 'wrestler' ? id : null);
  }
  /* the wrestler page's best wins and non-medalist season ratings need his seasons' bout files */
  /* his whole career: full district and regional fields for every season, then repaint */
  function loadCareer(sl) {
    const W = OT.getWrestler(sl); if (!W || W.full) return;
    OT.fullCareer(W).then((changed) => { if (changed && route().page === 'wrestler' && route().id === sl) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
  }
  function loadBestWins(sl) {
    const W = OT.getWrestler(sl); if (!W) return; if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const yrs = OT.yearsOf(W.apps, W.lower); if (yrs.every((y) => OT.sosLoaded(y))) return;
    // repaint the whole page: the season files also carry the season ratings of non-medalist seasons (career grid row)
    Promise.all(yrs.map((y) => OT.loadSOS(y))).then(() => { if (route().page === 'wrestler' && route().id === sl) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
  }
  /* head to head: both careers in full, then both wrestlers' season files, then repaint */
  function loadH2H(id) {
    const sl = String(id).split('~').filter(Boolean); const Ws = sl.map((s) => OT.getWrestler(s)).filter(Boolean); if (Ws.length < 2) return;
    const again = () => { if (route().page === 'h2h' && route().id === id) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } };
    if (Ws.some((W) => !W.full)) { Promise.all(Ws.map((W) => OT.fullCareer(W))).then(again); return; }
    const yrs = Array.from(new Set(Ws.flatMap((W) => OT.yearsOf(W.apps, W.lower || [])))); if (yrs.every((y) => OT.sosLoaded(y))) return;
    Promise.all(yrs.map((y) => OT.loadSOS(y))).then(again);
  }
  function loadSeason(id) {
    const y = OT.YEARS.includes(+id) ? +id : OT.yearsWindow()[1]; if (OT.sosLoaded(y)) return;
    OT.loadSOS(y).then(() => { if (route().page === 'season') { lastBase = ''; render(true); } });
  }
  function loadH2HS(id) {
    const sl = String(id).split('~').filter((s) => s && OT.SLUG2S.has(s)); if (sl.length < 2 || sl.every((s) => OT.h2hsLoaded(s))) return;
    Promise.all(sl.map((s) => OT.loadH2HS(s))).then(() => { if (route().page === 'h2hs' && route().id === id) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
  }
  const searchSchools = (q, n) => { const t = q.toLowerCase().split(/\s+/).filter(Boolean); const out = [];
    OT.SLUG2S.forEach((name, sl) => { const k = name.toLowerCase(); if (t.every((x) => k.includes(x))) out.push({ sl, name, pre: k.startsWith(t[0]) ? 0 : 1 }); });
    return out.sort((a, b) => a.pre - b.pre || a.name.localeCompare(b.name)).slice(0, n); };
  function wireH2H() {
    main.querySelectorAll('.h2i').forEach((inp) => { const box = inp.closest('.h2p'), list = box.querySelector('.h2l'), side = box.dataset.h2side, other = inp.dataset.h2other || '';
      let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const q = inp.value.trim(); if (!q) { list.innerHTML = ''; return; }
        if (inp.dataset.h2kind === 's') { const hit = searchSchools(q, 8); list.innerHTML = hit.length ? hit.map((p) => `<a href="#h2hs/${side === 'a' ? p.sl + '~' + other : other + '~' + p.sl}"><b>${OT.esc(p.name)}</b><small>${OT.schoolDistrict(p.name) ? 'District ' + OT.schoolDistrict(p.name) : ''}</small></a>`).join('') : '<div class="muted">No school by that name.</div>'; return; }
        OT.loadPeople().then(() => { if (inp.value.trim() !== q) return; const hit = OT.searchPeople(q, 8);
          list.innerHTML = hit.length ? hit.map((p) => `<a href="#h2h/${side === 'a' ? p.slug + '~' + other : other + '~' + p.slug}"><b>${OT.esc(p.name)}</b><small>${OT.esc(p.sch)} · ${p.y0 === p.y1 ? p.y0 : p.y0 + '–' + p.y1}</small></a>`).join('') : '<div class="muted">No one by that name.</div>'; }); }, 150); }); });
  }
  /* global search (top bar): schools and districts at once, then wrestlers once the people index is in. Ignores the filters. */
  const DSEARCH = d3.range(1, 13).map((d) => ({ d, q: ('district ' + d + ' d' + d + ' ' + (OT.DISTRICTS[d] || '')).toLowerCase() }));
  function wireGlobalSearch() {
    const inp = fpop.querySelector('#gsq'), out = fpop.querySelector('#gsr'); if (!inp) return;
    OT.loadPeople(); setTimeout(() => inp.focus(), 30);
    const hd = (t) => `<div class="fpk">${t}</div>`;
    const paint = () => { const q = inp.value.trim(), t = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (q.length < 2) { out.innerHTML = '<div class="fpn">Type at least two letters. Wrestlers include everyone in any bracket on file.</div>'; return; }
      const has = (x) => t.every((w) => x.q.includes(w));
      const sch = schools().filter(has).slice(0, 6), dis = DSEARCH.filter((x) => t.every((w) => x.q.split(/\s+/).some((y) => y.startsWith(w))) || x.q.includes(q.toLowerCase())).slice(0, 3);
      const ppl = OT.peopleLoaded() ? OT.searchPeople(q, 25, true) : null;
      let h = '';
      if (dis.length) h += hd('Districts') + dis.map((x) => `<a class="fpo" href="#district/${x.d}"><span>District ${x.d}<i class="fpd">${esc(OT.DISTRICTS[x.d] || '')}</i></span></a>`).join('');
      if (sch.length) h += hd('Schools') + sch.map((x) => `<a class="fpo" href="${hrefOf({ s: x.n })}"><span>${OT.stag(x.n)}</span><small>${x.d ? 'D' + x.d : ''}</small></a>`).join('');
      h += hd('Wrestlers') + (ppl === null ? '<div class="fpn">Loading every wrestler…</div>' : ppl.length ? `<div class="gsp">${ppl.map(OT.personRow).join('')}</div>${ppl.length >= 25 ? '<div class="fpn">Top 25 by rating. Add more of the name or a school to narrow it.</div>' : ''}` : '<div class="fpn">No wrestler by that name.</div>');
      out.innerHTML = h; };
    let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(paint, 120); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = out.querySelector('a'); if (a) { location.hash = keepView(a.getAttribute('href')); closePop(); } } });
    OT.loadPeople().then(() => { if (pop === 'search' && inp.value.trim().length >= 2) paint(); });
    out.addEventListener('click', (e) => { if (e.target.closest('a')) closePop(); });
  }
  /* search: everyone in any bracket (the people index loads on first use) */
  function wireSearch() {
    const inp = document.getElementById('wsearch'); if (!inp) return;
    const list = document.getElementById('wlist'), more = document.getElementById('wmore'); const top = list.innerHTML, topNote = more.textContent;
    OT.loadPeople();
    const card = (p) => { const W = OT.WRESTLER.get(p.slug); if (W) { const w = OT.wrestlersOf(W.apps)[0]; if (w) { w.lower = OT.lowerFor(W.apps); return OT.wrestlerCard(w); } } return OT.personRow(p); };
    OT.loadBW();
    let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const q = inp.value.trim(); if (!q) { list.innerHTML = top; more.textContent = topNote; const hd = document.getElementById('whead'); if (hd) hd.textContent = 'Placewinners'; return; }
      OT.loadPeople().then(() => { if (inp.value.trim() !== q) return; const hit = OT.searchPeople(q, 60); list.innerHTML = (hit.length ? '<div class="wkl">' + hit.map(card).join('') + '</div>' : '<div class="card empty">No one by that name.</div>'); const hd = document.getElementById('whead'); if (hd) hd.textContent = 'Search'; more.textContent = hit.length >= 60 ? 'Showing the top 60 by rating. Add a school or more of the name to narrow it.' : `${hit.length} wrestler${hit.length === 1 ? '' : 's'}.`; }); }, 150); });
  }
  /* repaint one performance chart in place, keeping its horizontal scroll */
  function repaintPerf(box) {
    const [kd, ...rest] = box.dataset.perf.split(':'); const id = rest.join(':');
    const u = kd === 'state' ? OT.U.state() : kd === 'region' ? OT.U.region(id) : kd === 'district' ? OT.U.district(+id) : OT.U.school(id);
    const sx = box.querySelector('.pscr'), left = sx ? sx.scrollLeft : null; const key = box.dataset.perf; box.outerHTML = OT.perfChart(u);
    const nb = main.querySelector(`.perf[data-perf="${CSS.escape(key)}"] .pscr`); if (nb && left != null) nb.scrollLeft = left; edgeScroll(main);
  }
  /* long season grids open at the newest seasons: a fade on the hidden side and a chip that jumps to the first
     season (or back to the latest) show that there is more history sideways */
  function edgeScroll(root) {
    root.querySelectorAll('.pscr.scroll[data-y0]').forEach((el) => {
      if (!el.parentElement.classList.contains('pedge')) {
        const w = document.createElement('div'); w.className = 'pedge' + (el.classList.contains('tlx') ? ' axtop' : '');
        const left = el.scrollLeft; el.before(w); w.append(el); el.scrollLeft = left; w.insertAdjacentHTML('beforeend', '<i class="pfade l" aria-hidden="true"></i><i class="pfade r" aria-hidden="true"></i><button type="button" class="pjump" data-pjump="l"></button>');
      }
      edgeState(el);
    });
  }
  function edgeState(el) {
    const w = el.parentElement, b = w.querySelector('.pjump'); if (!b) return;
    const max = el.scrollWidth - el.clientWidth, atL = el.scrollLeft < 6, atR = el.scrollLeft > max - 6;
    w.classList.toggle('fits', max < 6); w.classList.toggle('atl', atL); w.classList.toggle('atr', atR);
    const back = !atL; b.dataset.pjump = back ? 'l' : 'r'; b.textContent = back ? '← ' + el.dataset.y0 : el.dataset.y1 + ' →';
    b.setAttribute('aria-label', back ? 'Jump to the first season, ' + el.dataset.y0 : 'Jump to the latest season, ' + el.dataset.y1);
  }
  let edgeRaf = 0;
  document.addEventListener('scroll', (e) => { const el = e.target; if (!el.classList || !el.classList.contains('pscr') || !el.parentElement.classList.contains('pedge')) return;
    if (!edgeRaf) edgeRaf = requestAnimationFrame(() => { edgeRaf = 0; edgeState(el); }); }, true);
  window.addEventListener('resize', () => edgeScroll(main));
  /* on a phone the bottom bar (and the key on it) slides away while you scroll down and comes back when you scroll up,
     at the top or at the end of the page */
  let barY = window.scrollY, barRun = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY, dy = y - barY; barY = y; const B = document.body;
    if (pop || window.innerWidth >= 720 || y < 80 || y + window.innerHeight >= document.documentElement.scrollHeight - 24) { B.classList.remove('bars-off'); barRun = 0; return; }
    barRun = Math.sign(dy) === Math.sign(barRun) ? barRun + dy : dy;
    if (barRun > 28) B.classList.add('bars-off'); else if (barRun < -28) B.classList.remove('bars-off');
  }, { passive: true });
  /* hovering a season shows every line's value for it */
  document.addEventListener('mouseover', (e) => { const mk = e.target.closest && e.target.closest('.mapcard [data-mk]'); if (mk) { const c = mk.closest('.mapcard'); c.querySelectorAll('[data-mk]').forEach((el) => el.classList.toggle('hlk', el.dataset.mk === mk.dataset.mk)); } });
  document.addEventListener('mouseout', (e) => { const mk = e.target.closest && e.target.closest('.mapcard [data-mk]'); if (mk) mk.closest('.mapcard').querySelectorAll('.hlk').forEach((el) => el.classList.remove('hlk')); });
  /* school season grid: drag across columns for a range (mouse: press and drag; touch: press and hold, then drag) */
  const PDRAG = { justDragged: false, on: false };
  document.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest && e.target.closest('.sgrid [data-py]'); if (!cell || e.button > 0) return;
    const box = cell.closest('.perf'), svg = box.querySelector('svg'); const y0 = +box.dataset.y0, cw = +box.dataset.cw; const start = +cell.dataset.py;
    const yAt = (x) => { const r = svg.getBoundingClientRect(); return y0 + Math.floor((x - r.left) / cw); };
    let a = start, b = start, armed = e.pointerType === 'mouse', timer = null; const sx = e.clientX, sy = e.clientY;
    let frame = null; const show = () => { if (!frame) { frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); frame.setAttribute('class', 'xcol drag'); frame.setAttribute('rx', 3); svg.appendChild(frame); } const lo = Math.min(a, b), hi = Math.max(a, b); frame.setAttribute('x', cw * (lo - y0) + 0.5); frame.setAttribute('y', -1.5); frame.setAttribute('width', cw * (hi - lo + 1) - 1); frame.setAttribute('height', svg.viewBox.baseVal.height - 16); };
    if (!armed) timer = setTimeout(() => { armed = true; PDRAG.on = true; show(); if (navigator.vibrate) navigator.vibrate(8); }, 330);
    else PDRAG.on = true;
    const move = (ev) => { if (!armed) { if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) cleanup(); return; } const y = yAt(ev.clientX); if (y !== b) { b = y; show(); } };
    const cleanup = () => { clearTimeout(timer); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cleanup); PDRAG.on = false; if (frame) frame.remove(); };
    const up = () => { const was = armed && a !== b; cleanup(); if (!was) return; PDRAG.justDragged = true; setTimeout(() => { PDRAG.justDragged = false; }, 400);
      const [kd, ...rest] = box.dataset.perf.split(':'); state.pseason = { k: kd + ':' + rest.join(':'), a: Math.min(a, b), b: Math.max(a, b) }; repaintPerf(box); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cleanup);
  });
  document.addEventListener('touchmove', (e) => { if (PDRAG.on) e.preventDefault(); }, { passive: false });
  /* TIME scrubber: drag either handle; the window follows on release */
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest && e.target.closest('.tscr .sch'); if (!h) return; e.preventDefault();
    const scr = h.closest('.tscr'), track = scr.querySelector('.scrt'); const y0 = +scr.dataset.y0, y1 = +scr.dataset.y1, n = y1 - y0 + 1;
    let a = +scr.dataset.a, b = +scr.dataset.b; const which = h.dataset.h;
    const pc = (y) => (100 * (y - y0 + 0.5)) / n;
    const yAt = (x) => { const r = track.getBoundingClientRect(); return Math.max(y0, Math.min(y1, y0 + Math.floor(((x - r.left) / Math.max(1, r.width)) * n))); };
    const paint = () => { const lo = Math.min(a, b), hi = Math.max(a, b); scr.querySelector('.sch[data-h="a"]').style.left = pc(a) + '%'; scr.querySelector('.sch[data-h="b"]').style.left = pc(b) + '%'; const fl = scr.querySelector('.scrf'); fl.style.left = (pc(lo) - 50 / n) + '%'; fl.style.width = (100 * (hi - lo + 1)) / n + '%'; scr.querySelector('.scrl').textContent = lo === hi ? String(lo) : lo + '–' + hi; scr.querySelectorAll('.scrs i').forEach((el, i) => el.classList.toggle('out', y0 + i < lo || y0 + i > hi)); };
    const move = (ev) => { const y = yAt(ev.clientX); if (which === 'a') a = y; else b = y; paint(); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); setRange(Math.min(a, b), Math.max(a, b), y0, y1); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
  function setRange(lo, hi, y0, y1) { const w = lo === y0 && hi === y1 ? { mode: 'all' } : { mode: 'custom', from: lo, to: hi };
    if (pop === 'filters' && draft) { draft.win = { ...DEF_WIN, ...w }; paintPop(); return; } if (w.mode === state.win.mode && (w.mode === 'all' || (w.from === state.win.from && w.to === state.win.to))) return; setWin(w); changed(); }
  document.addEventListener('keydown', (e) => { const h = e.target.closest && e.target.closest('.tscr .sch'); if (!h || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); const scr = h.closest('.tscr'); const y0 = +scr.dataset.y0, y1 = +scr.dataset.y1; let a = +scr.dataset.a, b = +scr.dataset.b; const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (h.dataset.h === 'a') a = Math.max(y0, Math.min(b, a + d)); else b = Math.min(y1, Math.max(a, b + d)); setRange(a, b, y0, y1); const nh = fpop.querySelector(`.tscr .sch[data-h="${h.dataset.h}"]`); if (nh) nh.focus(); });
  document.addEventListener('mouseover', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell, .perf .cc, .perf .hitc'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = h.dataset.tip || ''; });
  document.addEventListener('mouseout', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell, .perf .cc, .perf .hitc'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = ''; });
  document.addEventListener('change', (e) => { const inp = e.target.closest && e.target.closest('input[data-cmpadd]'); if (!inp || !state.cmp) return; const v = inp.value.trim(); const s = OT.UD.schools.find((x) => x.toLowerCase() === v.toLowerCase());
    if (s && !state.cmp.extra.includes(s) && state.cmp.extra.length < 3 && 'school:' + s !== state.cmp.key) { state.cmp.extra.push(s); state.cmp.on.add('s:' + s); } repaintPerf(inp.closest('.perf')); });
  /* links to other places keep the tab you are on: the href is set just before the browser follows it */
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || a.id === 'brand') return;
    const h = a.getAttribute('href'), k = keepView(h); if (k !== h) a.setAttribute('href', k); }, true);
  document.addEventListener('click', (e) => {
    /* filter bar and its popups */
    if (e.target.closest('.sgkey')) { sgOpen = !sgOpen; drawBar(); return; }
    const pj = e.target.closest('button[data-pjump]'); if (pj) { const el = pj.parentElement.querySelector('.pscr'); if (el) el.scrollTo({ left: pj.dataset.pjump === 'l' ? 0 : el.scrollWidth, behavior: 'smooth' }); return; }
    const fb = e.target.closest('[data-fb]'); if (fb) { const k = fb.dataset.fb, f = F();
      void f; if (pop === k) closePop(); else openPop(k); return; }
    const tb = e.target.closest('[data-tab]'); if (tb) { const k = tb.dataset.tab, f = F(); closePop();
      /* from a wrestler's page or the wrestler list, the tabs open the place page (his school) */
      const W = f.who ? OT.getWrestler(route().id) : null; const g = W ? { r: '', d: 0, s: W.sch, w: false } : f;
      if (W) { const u = OT.U.school(W.sch); g.d = u.d || 0; g.r = u.region || (u.d ? regionOfD(u.d) : ''); }
      if (f.w && k === 'rank' && !['wrestlers', 'team'].includes(state.child)) state.child = 'wrestlers';
      const onPlace = PLACEP.includes(route().page);
      if (onPlace && !f.w && state.view === k) { window.scrollTo(0, 0); return; }
      const to = onPlace && !f.w ? withView(route().base, k) : withView(hrefOf({ ...g, w: false }), k, f.w && k === 'rank' ? state.child : undefined);
      location.hash = to; return; }
    if (e.target.closest('#sbtn')) { if (pop === 'search') closePop(); else openPop('search'); return; }
    if (e.target.closest('#mbtn')) { if (pop === 'menu') closePop(); else openPop('menu'); return; }
    if (e.target === fscrim) { closePop(); return; }
    if (pop && fpop.contains(e.target)) {
      if (pop === 'filters' && draft) {
        if (e.target.closest('[data-fclose]')) { closePop(); return; }
        if (e.target.closest('[data-fapply]')) { applyDraft(); return; }
        if (e.target.closest('[data-freset]')) { Object.assign(draft, { r: '', d: 0, s: '', cls: 'AAA', win: { ...DEF_WIN }, w: [] }); paintPop(); return; }
        const dp = e.target.closest('[data-dp]'); if (dp) { setDraftPlace(dp.getAttribute('data-dp')); paintPop(); return; }
        const dv = e.target.closest('button[data-fdiv]'); if (dv) { draft.cls = dv.dataset.fdiv; paintPop(); return; }
        const fw = e.target.closest('button[data-fw]'); if (fw) { const k = fw.dataset.fw, i = draft.w.indexOf(k); if (i < 0) draft.w.push(k); else draft.w.splice(i, 1); paintPop(); return; }
        const tw = e.target.closest('button[data-tw]'); if (tw) { draft.win = tw.dataset.tw === 'all' ? { ...DEF_WIN } : { mode: tw.dataset.tw, from: null, to: null }; paintPop(); return; }
        const ty = e.target.closest('button[data-ty]'); if (ty) { const scr = ty.closest('.tscr'); const y = +ty.dataset.ty; const w = draft.win; const one = w.mode === 'custom' && w.from === y && w.to === y; setRange(one ? +scr.dataset.y0 : y, one ? +scr.dataset.y1 : y, +scr.dataset.y0, +scr.dataset.y1); return; }
        return;
      }
      const fw = e.target.closest('button[data-fw]'); if (fw) { OT.toggleFilter('weights', fw.dataset.fw); changed(); return; }
      if (e.target.closest('[data-fwclear]')) { OT.clearFilters('weights'); changed(); return; }
      const tw = e.target.closest('button[data-tw]'); if (tw) { if (tw.dataset.tw !== state.win.mode) { setWin({ mode: tw.dataset.tw }); changed(); } return; }
      const ty = e.target.closest('button[data-ty]'); if (ty) { const scr = ty.closest('.tscr'); const y = +ty.dataset.ty; const one = state.win.mode === 'custom' && state.win.from === y && state.win.to === y; setRange(one ? +scr.dataset.y0 : y, one ? +scr.dataset.y1 : y, +scr.dataset.y0, +scr.dataset.y1); return; }
      const a = e.target.closest('a[href]'); if (a && !a.hasAttribute('data-keep')) { closePop(); return; }
    }
    const tu = e.target.closest('button[data-tlunit]'); if (tu) { state.tlunit = tu.dataset.tlunit; state.tln = 50; render(true); return; }
    if (e.target.closest('button[data-tlgroup]')) { state.tlgroup = !state.tlgroup; render(true); return; }
    if (e.target.closest('button[data-tlmore]')) { const y = window.scrollY; state.tln = (state.tln || 50) + 50; render(true); window.scrollTo(0, y); return; }
    const am = e.target.closest('button[data-attmode]'); if (am) { state.attMode = am.dataset.attmode; try { sessionStorage.setItem('ot-attmode', state.attMode); } catch (er) { /* none */ } render(true); return; }
    const ap = e.target.closest('button[data-attpick]'); if (ap) { const v = ap.dataset.attpick; if (state.attMode === 'weight') state.attW = v; else state.attTeam = +v; render(true); if (ap.closest('.atstep')) { const sec = main.querySelector('.atsec'); if (sec) window.scrollTo(0, Math.max(0, sec.getBoundingClientRect().top + window.scrollY - 76)); } return; }
    const qs = e.target.closest('button[data-qset]'); if (qs) { const [k, v] = qs.dataset.qset.split(':'); setQ(k, v); return; }
    const c = e.target.closest('button[data-kind]'); if (c) { state.child = c.dataset.kind; if (PLACEP.includes(route().page)) { const h = withView(location.hash, state.view, state.child); try { history.replaceState(history.state, '', h); } catch (er) { /* none */ } lastHash = location.hash; } lastBase = ''; render(true); return; }
    const lv = e.target.closest('button[data-lvl]'); if (lv) { OT.setLvl(lv.dataset.lvl); state.rall = false; state.bracketAll = false; render(true); return; }
    const sm = e.target.closest('button[data-smode]'); if (sm) { state.smode = sm.dataset.smode; render(true); return; }
    const ss = e.target.closest('button[data-ssort]'); if (ss) { state.ssort = ss.dataset.ssort; render(true); return; }
    const us = e.target.closest('button[data-usort]'); if (us) { state.usort = us.dataset.usort; render(true); return; }
    const ws = e.target.closest('button[data-wsort]'); if (ws) { state.wsort = ws.dataset.wsort; render(true); return; }
    const mm = e.target.closest('button[data-mapmode]'); if (mm) { state.mapmode = mm.dataset.mapmode; try { localStorage.setItem('ot-mapmode', state.mapmode); } catch (er) { /* none */ } state.pseason = null; render(true); return; }
    const ha = e.target.closest('button[data-hall]'); if (ha) { state.hall = ha.dataset.hall === '1'; render(true); return; }
    const ua = e.target.closest('button[data-uall]'); if (ua) { state.uall = ua.dataset.uall === '1'; render(true); return; }
    const cm = e.target.closest('button[data-cmp]'); if (cm) { const box = cm.closest('.perf'); if (box && state.cmp) { const id = cm.dataset.cmp; if (e.target.closest('em') && id.startsWith('s:')) { state.cmp.extra = state.cmp.extra.filter((s) => 's:' + s !== id); state.cmp.on.delete(id); } else if (!state.cmp.on.has(id)) { state.cmp.on.add(id); state.cmp.focus = id; } else if (state.cmp.focus !== id) state.cmp.focus = id; else { state.cmp.focus = null; if (!cm.dataset.fixed) state.cmp.on.delete(id); } repaintPerf(box); } return; }
    const fl = e.target.closest && e.target.closest('[data-focus]'); if (fl && state.cmp) { const box = fl.closest('.perf'); const id = fl.getAttribute('data-focus'); state.cmp.focus = state.cmp.focus === id ? null : id; if (box) repaintPerf(box); return; }
    const pc = e.target.closest('[data-pclear]'); if (pc) { const box = pc.closest('.perf'); state.pseason = null; if (box) repaintPerf(box); return; }
    const py = e.target.closest('.perf [data-py]'); if (py) { if (PDRAG.justDragged) { PDRAG.justDragged = false; return; } const box = py.closest('.perf'); if (box) { const [kd, ...rest] = box.dataset.perf.split(':'); const id = rest.join(':'); const y = +py.dataset.py; const k = kd + ':' + id; const p = state.pseason;
      if (e.shiftKey && p && p.k === k) state.pseason = { k, a: Math.min(p.a, y), b: Math.max(p.b, y) };
      else state.pseason = p && p.k === k && p.a === y && p.b === y ? null : { k, a: y, b: y }; repaintPerf(box); } return; }
    const ra = e.target.closest('button[data-rall]'); if (ra) { state.rall = ra.dataset.rall === '1'; render(true); return; }
    const f = e.target.closest('button[data-mode]'); if (f) { state.bmode = f.dataset.mode; render(); return; }
    const bs = e.target.closest('button[data-bvsort],button[data-bxside]'); if (bs) { if (bs.dataset.bvsort) state.bvsort = bs.dataset.bvsort; else state.bxside = bs.dataset.bxside; const k = route().q.b; if (k) { const top = bview.scrollTop; bview.innerHTML = `<div class="bvcard">${OT.bracketView(k, route().page === 'wrestler' ? route().id : null)}</div>`; OT.wirePager(bview); bview.scrollTop = top; } return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const mt = e.target.closest('button[data-mmetric]'); if (mt) { state.mmetric = mt.dataset.mmetric; state.mlall = false; render(true); return; }
    const ml = e.target.closest('button[data-mlevel]'); if (ml) { state.mlevel = ml.dataset.mlevel; state.mapmode = ml.dataset.mlevel === 'region' ? 'regions' : 'districts'; try { localStorage.setItem('ot-mapmode', state.mapmode); } catch (er) { /* none */ } state.mlall = false; state.pseason = null; render(true); return; }
    const mcard = e.target.closest && e.target.closest('.mapcard');
    if (mcard) {
      const [kd, ...rest] = mcard.dataset.mapcard.split(':'); const u = { kind: kd, id: rest.join(':') }; const key = mcard.dataset.mapcard;
      const repaint = () => { mcard.outerHTML = OT.mapCard(u); };
      const ms = e.target.closest('button[data-msort]'); if (ms) { state.msort = ms.dataset.msort; repaint(); return; }
      const ma = e.target.closest('button[data-mlall]'); if (ma) { state.mlall = ma.dataset.mlall === '1'; repaint(); return; }
      const row = e.target.closest('.mlr'); if (row && !e.target.closest('a')) { const k = row.dataset.mk; const on = !row.classList.contains('pin'); mcard.querySelectorAll('[data-mk]').forEach((el) => el.classList.toggle('pin', on && el.dataset.mk === k)); return; }
    }
    const sx = e.target.closest('button[data-sx]'); if (sx) { const open = sx.getAttribute('aria-expanded') === 'true'; sx.setAttribute('aria-expanded', String(!open)); const d = sx.nextElementSibling; if (d) d.hidden = open; sx.parentElement.classList.toggle('open', !open); if (!open && d) { const lb = d.querySelector('[data-sslb]'); if (lb && !lb.dataset.done) { lb.dataset.done = '1'; OT.fillLineup(lb); } } return; }
    const s = e.target.closest('.srow'); if (s) { const open = s.getAttribute('aria-expanded') === 'true'; s.setAttribute('aria-expanded', String(!open)); const pod = s.nextElementSibling; if (pod) { if (!open && pod.dataset.sd && !pod.dataset.done) { pod.innerHTML = OT.seasonDetail(pod.dataset.sd); pod.dataset.done = '1'; } pod.hidden = open; } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('srow')) e.target.click(); });
  document.addEventListener('change', (e) => { const s = e.target.closest && e.target.closest('select[data-attsel]'); if (!s) return; if (state.attMode === 'weight') state.attW = s.value; else state.attTeam = +s.value; render(true); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('sgkey')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('change', (e) => { const s = e.target.closest('select[data-sortsel]'); if (!s) return; state[s.dataset.sortsel] = s.value; render(true); });
  document.addEventListener('change', (e) => { const s = e.target.closest('select[data-tyear]'); if (s) location.hash = '#tournaments?y=' + s.value; const qq = e.target.closest('select[data-qsel]'); if (qq) setQ(qq.dataset.qsel, qq.value); const sy = e.target.closest('select[data-syear]'); if (sy) location.hash = '#' + sy.dataset.syear + '/' + sy.value; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) closePop(); else if (e.key === 'Escape' && !bview.hidden) location.hash = OT.bhref(null); });
  window.addEventListener('resize', () => { if (pop) paintPop(); });
  bview.addEventListener('click', (e) => { if (e.target === bview) location.hash = OT.bhref(null); });
  /* the tapped line slides to the top of the bracket while the rest fade, then we go there */
  function slideTo(bl) {
    const box = bl.parentElement, top = box.getBoundingClientRect().top, me = bl.getBoundingClientRect().top;
    box.classList.add('sliding'); bl.classList.add('go'); bl.style.transform = `translateY(${top - me}px)`;
    setTimeout(() => { location.hash = keepView(bl.getAttribute('href')); }, 280);
  }
  window.addEventListener('hashchange', () => render());

  /* ---------- two-stage boot ----------
     The landing page (the State map) needs only the scripts index.html loads up front. Everything in
     OT_LATE (medals, brackets, district fields, ratings, ...) is fetched after the first paint, without blocking it;
     once it is all in, the app files run again over the same OT so every index is built from the full archive, and
     any page that was waiting for it renders. Other pages opened first wait for the archive (the boot loader shows). */
  let waiting = false;
  function coreRoute(page, q) { return page === 'state' && state.view === 'map' && !q.b; }
  function addScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = () => no(new Error('could not load ' + src)); document.body.appendChild(s); }); }
  function loadFull() {
    const late = window.OT_LATE || [];
    const app = Array.from(document.scripts).map((s) => s.getAttribute('src')).filter((s) => s && /^app\//.test(s) && !/main\.js(\?|$)/.test(s));
    if (!late.length) { OT.full = true; return Promise.resolve(); }
    // the boot loader (index.html) shows only while #main is empty, i.e. when a page other than the State map was opened first
    let got = 0; const tick = () => { got++; if (window.OTBoot) window.OTBoot.progress(0.9 * got / late.length); };
    return Promise.all(late.map((f) => addScript(f).then(tick))).then(() => Promise.all(app.map(addScript))).then(() => {
      OT.full = true; SCH = null;
      // repaint whatever is showing from the full archive (the State map comes out the same; a waiting page appears)
      waiting = false; const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y);
      document.dispatchEvent(new Event('ot-full'));
    });
  }
  OT.full = !(window.OT_LATE || []).length;
  render();
  OT.ready = loadFull();

  /* hovering a chip or a line label brightens that series */
  const hlSeries = (e, on) => { const t = e.target.closest && e.target.closest('[data-cmp],[data-focus]'); if (!t) return; const box = t.closest('.perf'); if (!box) return; const id = t.getAttribute('data-cmp') || t.getAttribute('data-focus');
    box.querySelectorAll(`[data-sid="${CSS.escape(id)}"], .elab[data-focus="${CSS.escape(id)}"]`).forEach((n) => n.classList.toggle('hl', on)); };
  document.addEventListener('mouseover', (e) => hlSeries(e, true)); document.addEventListener('mouseout', (e) => hlSeries(e, false));
})();
