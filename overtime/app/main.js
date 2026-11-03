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
  const lastSchool = () => { try { return localStorage.getItem('ot-school') || ''; } catch (e) { return ''; } };
  function route() {
    const h = (location.hash || '#state').slice(1); const [page, ...rest] = h.split('/'); const id = rest.join('/');
    return { page: PAGES[page] ? page : 'state', id: decodeURIComponent(id || '') };
  }
  function render(keepScroll) {
    const { page, id } = route();
    let p = page, i = id;
    if (p === 'school' && !i) { i = lastSchool(); if (!i) { p = 'state'; } }
    if (p === 'school' && i) try { localStorage.setItem('ot-school', i); } catch (e) { /* none */ }
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.lastRoute = page + '/' + id; }
    main.innerHTML = PAGES[p](i);
    const cur = p === 'wrestler' ? 'wrestlers' : p;
    bnav.innerHTML = `<ul>${NAV.map(([k, l, h]) => `<li><a href="${k === 'school' ? '#school' + (lastSchool() ? '/' + lastSchool() : '') : h}" ${k === cur ? 'aria-current="page"' : ''}>${navIcon(k)}<span>${l}</span></a></li>`).join('')}</ul>`;
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Overtime';
    drawChips();
    if (!keepScroll) window.scrollTo(0, 0);
    wireSearch();
  }
  function wireSearch() {
    const inp = document.getElementById('wsearch'); if (!inp) return;
    const list = document.getElementById('wlist'), more = document.getElementById('wmore');
    const ws = OT.wrestlersOf(OT.careerRows(OT.ROWS().filter((r) => r.place)).filter((r) => r.place));
    const item = (w) => OT.wrestlerCard(w);
    let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const q = inp.value.trim().toLowerCase(); const hit = q ? ws.filter((w) => (w.name + ' ' + w.sch).toLowerCase().includes(q)) : ws; list.innerHTML = hit.slice(0, 60).map(item).join('') || '<div class="card empty">No one by that name.</div>'; more.textContent = hit.length > 60 ? `Showing 60 of ${hit.length}.` : `${hit.length} wrestler${hit.length === 1 ? '' : 's'}.`; }, 120); });
  }
  const applyScope = () => { refreshPanel(); render(true); };
  document.addEventListener('click', (e) => {
    const hp = e.target.closest('[data-panel]'); if (hp) { openPanel(hp.dataset.panel); return; }
    if (e.target.closest('[data-panel-close]') || e.target === scrim) { closePanel(); return; }
    const ca = e.target.closest('[data-clear-all]'); if (ca) { OT.clearAll(); applyScope(); return; }
    const cl = e.target.closest('button[data-clear]'); if (cl) { OT.clearFilters(cl.dataset.clear); applyScope(); return; }
    const fc = e.target.closest('button[data-f]'); if (fc) { const k = fc.dataset.f; OT.toggleFilter(k, k === 'districts' ? +fc.dataset.v : fc.dataset.v); applyScope(); return; }
    const b = e.target.closest('button[data-cls]'); if (b) { setCls(b.dataset.cls); applyScope(); return; }
    const c = e.target.closest('button[data-kind]'); if (c) { state.child = c.dataset.kind; render(); return; }
    const f = e.target.closest('button[data-mode]'); if (f) { state.bmode = f.dataset.mode; render(); return; }
    const w = e.target.closest('button[data-win]'); if (w) { setWin({ mode: w.dataset.win }); applyScope(); return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const s = e.target.closest('.srow'); if (s) { const open = s.getAttribute('aria-expanded') === 'true'; s.setAttribute('aria-expanded', String(!open)); const pod = s.nextElementSibling; if (pod) pod.hidden = open; }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('srow')) e.target.click(); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-wrange]'); if (!f) return; e.preventDefault(); setWin({ mode: 'custom', from: +f.from.value, to: +f.to.value }); applyScope(); });
  document.addEventListener('input', (e) => { if (e.target.id === 'psearch') { panelQ = e.target.value; refreshPanel(); } });
  document.addEventListener('change', (e) => { if (e.target.matches('input[data-adjust]')) { OT.setAdjust(e.target.checked); applyScope(); } });
  document.addEventListener('click', (e) => { const th = e.target.closest('th[data-sort]'); if (th) { state.wsort = th.dataset.sort; render(true); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen()) closePanel(); });
  /* the tapped line slides to the top of the bracket while the rest fade, then we go there */
  function slideTo(bl) {
    const box = bl.parentElement, top = box.getBoundingClientRect().top, me = bl.getBoundingClientRect().top;
    box.classList.add('sliding'); bl.classList.add('go'); bl.style.transform = `translateY(${top - me}px)`;
    setTimeout(() => { location.hash = bl.getAttribute('href'); }, 280);
  }
  window.addEventListener('hashchange', render);
  render();
})();
