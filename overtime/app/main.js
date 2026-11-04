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
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.rall = false; state.uall = false; state.hall = false; state.pseason = null; state.mlall = false; state.lastRoute = page + '/' + id; }
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
  /* repaint one performance chart in place, keeping its horizontal scroll */
  function repaintPerf(box) {
    const [kd, ...rest] = box.dataset.perf.split(':'); const id = rest.join(':');
    const u = kd === 'state' ? OT.U.state() : kd === 'region' ? OT.U.region(id) : kd === 'district' ? OT.U.district(+id) : OT.U.school(id);
    const sx = box.querySelector('.pscr'), left = sx ? sx.scrollLeft : null; const key = box.dataset.perf; box.outerHTML = OT.perfChart(u);
    const nb = main.querySelector(`.perf[data-perf="${CSS.escape(key)}"] .pscr`); if (nb && left != null) nb.scrollLeft = left;
  }
  /* hovering a season shows every line's value for it */
  document.addEventListener('mouseover', (e) => { const mk = e.target.closest && e.target.closest('.mapcard [data-mk]'); if (mk) { const c = mk.closest('.mapcard'); c.querySelectorAll('[data-mk]').forEach((el) => el.classList.toggle('hlk', el.dataset.mk === mk.dataset.mk)); } });
  document.addEventListener('mouseout', (e) => { const mk = e.target.closest && e.target.closest('.mapcard [data-mk]'); if (mk) mk.closest('.mapcard').querySelectorAll('.hlk').forEach((el) => el.classList.remove('hlk')); });
  /* season scrubber: drag either handle to a sub-range of the header window */
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest && e.target.closest('.scr .sch'); if (!h) return; e.preventDefault();
    const scr = h.closest('.scr'), card = scr.closest('.mapcard'), track = scr.querySelector('.scrt'); const y0 = +scr.dataset.y0, y1 = +scr.dataset.y1, n = y1 - y0 + 1;
    let a = +scr.dataset.a, b = +scr.dataset.b; const which = h.dataset.h;
    const pc = (y) => (100 * (y - y0 + 0.5)) / n;
    const yAt = (x) => { const r = track.getBoundingClientRect(); return Math.max(y0, Math.min(y1, y0 + Math.floor(((x - r.left) / Math.max(1, r.width)) * n))); };
    const paint = () => { const lo = Math.min(a, b), hi = Math.max(a, b); scr.querySelector('.sch[data-h="a"]').style.left = pc(a) + '%'; scr.querySelector('.sch[data-h="b"]').style.left = pc(b) + '%'; const f = scr.querySelector('.scrf'); f.style.left = (pc(lo) - 50 / n) + '%'; f.style.width = (100 * (hi - lo + 1)) / n + '%'; scr.querySelector('.scrl').textContent = lo === hi ? String(lo) : lo + '–' + hi + ' · avg'; };
    const move = (ev) => { const y = yAt(ev.clientX); if (which === 'a') a = y; else b = y; paint(); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); const lo = Math.min(a, b), hi = Math.max(a, b); const [kd, ...rest] = card.dataset.mapcard.split(':'); state.msel = lo === y0 && hi === y1 ? null : { k: card.dataset.mapcard, a: lo, b: hi }; card.outerHTML = OT.mapCard({ kind: kd, id: rest.join(':') }); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
  document.addEventListener('mouseover', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = h.dataset.tip || ''; });
  document.addEventListener('mouseout', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = ''; });
  document.addEventListener('change', (e) => { const inp = e.target.closest && e.target.closest('input[data-cmpadd]'); if (!inp || !state.cmp) return; const v = inp.value.trim(); const s = OT.UD.schools.find((x) => x.toLowerCase() === v.toLowerCase());
    if (s && !state.cmp.extra.includes(s) && state.cmp.extra.length < 3 && 'school:' + s !== state.cmp.key) { state.cmp.extra.push(s); state.cmp.on.add('s:' + s); } repaintPerf(inp.closest('.perf')); });
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
    const mm = e.target.closest('button[data-mapmode]'); if (mm) { state.mapmode = mm.dataset.mapmode; try { localStorage.setItem('ot-mapmode', state.mapmode); } catch (er) { /* none */ } state.pseason = null; render(true); return; }
    const ha = e.target.closest('button[data-hall]'); if (ha) { state.hall = ha.dataset.hall === '1'; render(true); return; }
    const ua = e.target.closest('button[data-uall]'); if (ua) { state.uall = ua.dataset.uall === '1'; render(true); return; }
    const cm = e.target.closest('button[data-cmp]'); if (cm) { const box = cm.closest('.perf'); if (box && state.cmp) { const id = cm.dataset.cmp; if (e.target.closest('em') && id.startsWith('s:')) { state.cmp.extra = state.cmp.extra.filter((s) => 's:' + s !== id); state.cmp.on.delete(id); } else if (!state.cmp.on.has(id)) { state.cmp.on.add(id); state.cmp.focus = id; } else if (state.cmp.focus !== id) state.cmp.focus = id; else { state.cmp.focus = null; if (!cm.dataset.fixed) state.cmp.on.delete(id); } repaintPerf(box); } return; }
    const fl = e.target.closest && e.target.closest('[data-focus]'); if (fl && state.cmp) { const box = fl.closest('.perf'); const id = fl.getAttribute('data-focus'); state.cmp.focus = state.cmp.focus === id ? null : id; if (box) repaintPerf(box); return; }
    const py = e.target.closest('[data-py]'); if (py) { const box = py.closest('.perf'); if (box) { const [kd, ...rest] = box.dataset.perf.split(':'); const id = rest.join(':'); const y = +py.dataset.py; const k = kd + ':' + id; state.pseason = state.pseason && state.pseason.k === k && state.pseason.y === y ? null : { k, y }; repaintPerf(box); } return; }
    const ra = e.target.closest('button[data-rall]'); if (ra) { state.rall = ra.dataset.rall === '1'; render(true); return; }
    const f = e.target.closest('button[data-mode]'); if (f) { state.bmode = f.dataset.mode; render(); return; }
    const w = e.target.closest('button[data-win]'); if (w) { setWin({ mode: w.dataset.win }); applyScope(); return; }
    const bs = e.target.closest('button[data-bvsort]'); if (bs) { state.bvsort = bs.dataset.bvsort; const k = route().q.b; if (k) { const top = bview.scrollTop; bview.innerHTML = `<div class="bvcard">${OT.bracketView(k, route().page === 'wrestler' ? route().id : null)}</div>`; bview.scrollTop = top; } return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const mcard = e.target.closest && e.target.closest('.mapcard');
    if (mcard) {
      const [kd, ...rest] = mcard.dataset.mapcard.split(':'); const u = { kind: kd, id: rest.join(':') }; const key = mcard.dataset.mapcard;
      const repaint = () => { mcard.outerHTML = OT.mapCard(u); };
      const ty = e.target.closest('button[data-msel-y]'); if (ty) { const y = +ty.dataset.mselY; const m = state.msel; state.msel = m && m.k === key && m.a === y && m.b === y ? null : { k: key, a: y, b: y }; repaint(); return; }
      if (e.target.closest('[data-msel-reset]')) { state.msel = null; repaint(); return; }
      const ms = e.target.closest('button[data-msort]'); if (ms) { state.msort = ms.dataset.msort; repaint(); return; }
      const ma = e.target.closest('button[data-mlall]'); if (ma) { state.mlall = ma.dataset.mlall === '1'; repaint(); return; }
      const row = e.target.closest('.mlr'); if (row && !e.target.closest('a')) { const k = row.dataset.mk; const on = !row.classList.contains('pin'); mcard.querySelectorAll('[data-mk]').forEach((el) => el.classList.toggle('pin', on && el.dataset.mk === k)); return; }
    }
    const sx = e.target.closest('button[data-sx]'); if (sx) { const open = sx.getAttribute('aria-expanded') === 'true'; sx.setAttribute('aria-expanded', String(!open)); const d = sx.nextElementSibling; if (d) d.hidden = open; sx.parentElement.classList.toggle('open', !open); return; }
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

  /* hovering a chip or a line label brightens that series */
  const hlSeries = (e, on) => { const t = e.target.closest && e.target.closest('[data-cmp],[data-focus]'); if (!t) return; const box = t.closest('.perf'); if (!box) return; const id = t.getAttribute('data-cmp') || t.getAttribute('data-focus');
    box.querySelectorAll(`[data-sid="${CSS.escape(id)}"], .elab[data-focus="${CSS.escape(id)}"]`).forEach((n) => n.classList.toggle('hl', on)); };
  document.addEventListener('mouseover', (e) => hlSeries(e, true)); document.addEventListener('mouseout', (e) => hlSeries(e, false));
})();
