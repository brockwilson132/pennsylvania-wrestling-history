/* Overtime — router and interactions */
'use strict';
(() => {
  const { PAGES, state, setCls, setWin, wordmark, navIcon, esc } = OT;
  const main = document.getElementById('main'), brand = document.getElementById('brand'), bnav = document.getElementById('bnav'), hchips = document.getElementById('hchips'), panelEl = document.getElementById('panel'), scrim = document.getElementById('scrim');
  brand.innerHTML = wordmark();
  let panelQ = '';
  const drawChips = () => { hchips.innerHTML = OT.headerChips(); };
  const panelOpen = () => !panelEl.hidden;
  function openPanel(sec) { panelEl.innerHTML = OT.panel(panelQ); panelEl.hidden = false; scrim.hidden = false; document.body.classList.add('noscroll'); if (sec) { const t = panelEl.querySelector('#pg-' + sec); if (t) t.scrollIntoView({ block: 'start' }); } }
  function closePanel() { panelEl.hidden = true; scrim.hidden = true; document.body.classList.remove('noscroll'); panelQ = ''; }
  function refreshPanel() { if (!panelOpen()) return; const top = panelEl.scrollTop, inp = panelEl.querySelector('#psearch'), focus = inp && document.activeElement === inp, pos = inp ? inp.selectionStart : 0; panelEl.innerHTML = OT.panel(panelQ); panelEl.scrollTop = top; if (focus) { const i2 = panelEl.querySelector('#psearch'); i2.focus(); try { i2.setSelectionRange(pos, pos); } catch (e) { /* none */ } } }
  const NAV = [['state', 'State', '#state'], ['region', 'Region', '#region'], ['district', 'District', '#district'], ['school', 'School', '#school'], ['wrestlers', 'Wrestlers', '#wrestlers']];
  /* navigation context: the region / district of what you're looking at, so a tab opens on the right root.
     Tapping the tab you're on resets it to its root; tabs never restore a stale deep page from another context. */
  const ctx = { region: '', district: 0 };
  function setCtx(p, i) {
    if (p === 'state') { ctx.region = ''; ctx.district = 0; return; }
    if (p === 'region' && i) { ctx.region = i; if (ctx.district && !OT.districtRegionSpans(ctx.district).some((x) => x.g === i)) ctx.district = 0; return; }
    if (p === 'district' && i) { ctx.district = +i; const sp = OT.districtRegionSpans(+i); ctx.region = sp.length ? sp[sp.length - 1].g : ctx.region; return; }
    const sch = p === 'school' && i ? (OT.SCHOOL_BY_SLUG.get(i) || OT.SLUG2S.get(i)) : p === 'wrestler' && i ? (OT.getWrestler(i) || {}).sch : null;
    if (sch) { const u = OT.U.school(sch); if (u.d) ctx.district = u.d; if (u.region) ctx.region = u.region; }
  }
  const tabHref = (k, cur) => {
    if (k === cur) return '#' + k; // the tab you're on: back to its root
    if (k === 'region') return ctx.region ? '#region/' + ctx.region : '#region';
    if (k === 'district') return ctx.district ? '#district/' + ctx.district : '#district';
    return '#' + k;
  };
  function route() {
    const raw = (location.hash || '#state').slice(1); const [h, qs] = raw.split('?'); const [page, ...rest] = h.split('/'); const id = rest.join('/');
    const q = {}; (qs || '').split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) q[k] = decodeURIComponent(v || ''); });
    return { page: PAGES[page] ? page : 'state', id: decodeURIComponent(id || ''), q, base: '#' + h };
  }
  /* href for the same page with a bracket overlay open (key) or closed (null) */
  OT.bhref = (key) => { const r = route(); return key ? `${r.base}?b=${encodeURIComponent(key)}` : r.base; };
  const bview = document.getElementById('bview');
  function showBracket(key, focus) {
    if (!key) { if (!bview.hidden) { bview.hidden = true; bview.innerHTML = ''; document.body.classList.remove('noscroll'); } return; }
    const paint = () => { bview.innerHTML = `<div class="bvcard">${OT.bracketView(key, focus)}</div>`; };
    paint(); bview.hidden = false; document.body.classList.add('noscroll'); bview.scrollTop = 0;
    const me = bview.querySelector('.bvl.me'); if (me) me.scrollIntoView({ block: 'center' });
    const again = () => { if (!bview.hidden && route().q.b === key) { const top = bview.scrollTop; paint(); bview.scrollTop = top; } };
    const k = OT.parseBkey(key); if (k && k.lvl !== 'state' && !OT.lowerLoaded(k.year, k.lvl)) OT.loadLower(k.year, k.lvl).then(again);
    if (k && !OT.sosLoaded(k.year)) OT.loadSOS(k.year).then(again);
  }
  let lastBase = '';
  function render(keepScroll) {
    const { page, id, q, base } = route();
    if (base === lastBase && (q.b || bview && !bview.hidden)) { showBracket(q.b, page === 'wrestler' ? id : null); drawChips(); return; }
    lastBase = base;
    let p = page, i = id;
    if (p === 'school' && !i && +q.d) { ctx.district = +q.d; const sp = OT.districtRegionSpans(+q.d); if (sp.length) ctx.region = sp[sp.length - 1].g; }
    setCtx(p, i); state.ctxDistrict = ctx.district;
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.rall = false; state.uall = false; state.pseason = null; state.lastRoute = page + '/' + id; }
    main.innerHTML = PAGES[p](i); main.querySelectorAll('.pscr.scroll').forEach((el) => { el.scrollLeft = el.scrollWidth; }); if (p === 'wrestler') { loadBestWins(i); loadCareer(i); }
    if (main.querySelector('[data-need-people]')) OT.loadPeople().then(() => { if (route().base === base) { lastBase = ''; render(true); } });
    const cur = p === 'wrestler' ? 'wrestlers' : p;
    bnav.innerHTML = `<ul>${NAV.map(([k, l, h]) => `<li><a href="${tabHref(k, cur)}" ${k === cur ? 'aria-current="page"' : ''}>${navIcon(k)}<span>${l}</span></a></li>`).join('')}</ul>`;
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Overtime';
    drawChips();
    if (!keepScroll) window.scrollTo(0, 0);
    wireSearch();
    if (main.querySelector('[data-need-bw]')) OT.loadBW().then(() => { if (route().base === base) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
    showBracket(q.b, page === 'wrestler' ? id : null);
  }
  /* the wrestler page's best wins need his seasons' bout files */
  /* his whole career: full district and regional fields for every season, then repaint */
  function loadCareer(sl) {
    const W = OT.getWrestler(sl); if (!W || W.full) return;
    OT.fullCareer(W).then((changed) => { if (changed && route().page === 'wrestler' && route().id === sl) { const y = window.scrollY; lastBase = ''; render(true); window.scrollTo(0, y); } });
  }
  function loadBestWins(sl) {
    const W = OT.getWrestler(sl); if (!W) return; if (!W.lower) W.lower = OT.lowerFor(W.apps);
    const yrs = OT.yearsOf(W.apps, W.lower); if (yrs.every((y) => OT.sosLoaded(y))) return;
    Promise.all(yrs.map((y) => OT.loadSOS(y))).then(() => { const el = document.getElementById('bestwins'); if (el && el.dataset.w === W.slug) el.innerHTML = OT.bestWinsHTML(W); });
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
  const applyScope = () => { refreshPanel(); render(true); };
  document.addEventListener('click', (e) => {
    const hp = e.target.closest('[data-panel]'); if (hp) { openPanel(hp.dataset.panel); return; }
    if (e.target.closest('[data-panel-close]') || e.target === scrim) { closePanel(); if (e.target.closest('a[href]')) return; return; }
    const ca = e.target.closest('[data-clear-all]'); if (ca) { OT.clearAll(); applyScope(); return; }
    const cl = e.target.closest('button[data-clear]'); if (cl) { OT.clearFilters(cl.dataset.clear); applyScope(); return; }
    const fc = e.target.closest('button[data-f]'); if (fc) { const k = fc.dataset.f; OT.toggleFilter(k, k === 'districts' ? +fc.dataset.v : fc.dataset.v); applyScope(); return; }
    const b = e.target.closest('button[data-cls]'); if (b) { setCls(b.dataset.cls); applyScope(); return; }
    const c = e.target.closest('button[data-kind]'); if (c) { state.child = c.dataset.kind; render(true); return; }
    const lv = e.target.closest('button[data-lvl]'); if (lv) { OT.setLvl(lv.dataset.lvl); state.rall = false; state.bracketAll = false; render(true); return; }
    const us = e.target.closest('button[data-usort]'); if (us) { state.usort = us.dataset.usort; render(true); return; }
    const ws = e.target.closest('button[data-wsort]'); if (ws) { state.wsort = ws.dataset.wsort; render(true); return; }
    const ua = e.target.closest('button[data-uall]'); if (ua) { state.uall = ua.dataset.uall === '1'; render(true); return; }
    const py = e.target.closest('[data-py]'); if (py) { const box = py.closest('.perf'); if (box) { const [kd, ...rest] = box.dataset.perf.split(':'); const id = rest.join(':'); const y = +py.dataset.py; const k = kd + ':' + id; state.pseason = state.pseason && state.pseason.k === k && state.pseason.y === y ? null : { k, y }; const u = kd === 'state' ? OT.U.state() : kd === 'region' ? OT.U.region(id) : kd === 'district' ? OT.U.district(+id) : OT.U.school(id); const sx = box.querySelector('.pscr'), left = sx ? sx.scrollLeft : null; box.outerHTML = OT.perfChart(u); const nb = main.querySelector(`.perf[data-perf="${CSS.escape(box.dataset.perf)}"] .pscr`); if (nb && left != null) nb.scrollLeft = left; } return; }
    const ra = e.target.closest('button[data-rall]'); if (ra) { state.rall = ra.dataset.rall === '1'; render(true); return; }
    const f = e.target.closest('button[data-mode]'); if (f) { state.bmode = f.dataset.mode; render(); return; }
    const w = e.target.closest('button[data-win]'); if (w) { setWin({ mode: w.dataset.win }); applyScope(); return; }
    const bs = e.target.closest('button[data-bvsort]'); if (bs) { state.bvsort = bs.dataset.bvsort; const k = route().q.b; if (k) { const top = bview.scrollTop; bview.innerHTML = `<div class="bvcard">${OT.bracketView(k, route().page === 'wrestler' ? route().id : null)}</div>`; bview.scrollTop = top; } return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const s = e.target.closest('.srow'); if (s) { const open = s.getAttribute('aria-expanded') === 'true'; s.setAttribute('aria-expanded', String(!open)); const pod = s.nextElementSibling; if (pod) { if (!open && pod.dataset.sd && !pod.dataset.done) { pod.innerHTML = OT.seasonDetail(pod.dataset.sd); pod.dataset.done = '1'; } pod.hidden = open; } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('srow')) e.target.click(); });
  document.addEventListener('change', (e) => { const s = e.target.closest('select[data-sortsel]'); if (!s) return; state[s.dataset.sortsel] = s.value; render(true); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-wrange]'); if (!f) return; e.preventDefault(); setWin({ mode: 'custom', from: +f.from.value, to: +f.to.value }); applyScope(); });
  document.addEventListener('input', (e) => { if (false) { panelQ = e.target.value; refreshPanel(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen()) closePanel(); else if (e.key === 'Escape' && !bview.hidden) location.hash = OT.bhref(null); });
  bview.addEventListener('click', (e) => { if (e.target === bview) location.hash = OT.bhref(null); });
  /* the tapped line slides to the top of the bracket while the rest fade, then we go there */
  function slideTo(bl) {
    const box = bl.parentElement, top = box.getBoundingClientRect().top, me = bl.getBoundingClientRect().top;
    box.classList.add('sliding'); bl.classList.add('go'); bl.style.transform = `translateY(${top - me}px)`;
    setTimeout(() => { location.hash = bl.getAttribute('href'); }, 280);
  }
  window.addEventListener('hashchange', render);
  render();
})();
