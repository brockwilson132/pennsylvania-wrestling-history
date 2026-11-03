/* Overtime — router and interactions */
'use strict';
(() => {
  const { PAGES, state, setCls, setWin, wordmark, navIcon, esc, chips } = OT;
  const main = document.getElementById('main'), brand = document.getElementById('brand'), bnav = document.getElementById('bnav');
  brand.innerHTML = wordmark();
  const NAV = [['state', 'State', '#state'], ['region', 'Region', '#region'], ['district', 'District', '#district'], ['school', 'School', '#school'], ['wrestlers', 'Wrestlers', '#wrestlers']];
  const lastSchool = () => { try { return localStorage.getItem('ot-school') || ''; } catch (e) { return ''; } };
  function route() {
    const h = (location.hash || '#state').slice(1); const [page, ...rest] = h.split('/'); const id = rest.join('/');
    return { page: PAGES[page] ? page : 'state', id: decodeURIComponent(id || '') };
  }
  function render() {
    const { page, id } = route();
    let p = page, i = id;
    if (p === 'school' && !i) { i = lastSchool(); if (!i) { p = 'state'; } }
    if (p === 'school' && i) try { localStorage.setItem('ot-school', i); } catch (e) { /* none */ }
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.lastRoute = page + '/' + id; }
    main.innerHTML = PAGES[p](i);
    const cur = p === 'wrestler' ? 'wrestlers' : p;
    bnav.innerHTML = `<ul>${NAV.map(([k, l, h]) => `<li><a href="${k === 'school' ? '#school' + (lastSchool() ? '/' + lastSchool() : '') : h}" ${k === cur ? 'aria-current="page"' : ''}>${navIcon(k)}<span>${l}</span></a></li>`).join('')}</ul>`;
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Overtime';
    window.scrollTo(0, 0);
    wireSearch();
  }
  function wireSearch() {
    const inp = document.getElementById('wsearch'); if (!inp) return;
    const list = document.getElementById('wlist'), more = document.getElementById('wmore');
    const ws = OT.wrestlersOf(OT.ROWS().filter((r) => r.place));
    const item = (w) => OT.wrestlerCard(w);
    let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { const q = inp.value.trim().toLowerCase(); const hit = q ? ws.filter((w) => (w.name + ' ' + w.sch).toLowerCase().includes(q)) : ws; list.innerHTML = hit.slice(0, 60).map(item).join('') || '<div class="card empty">No one by that name.</div>'; more.textContent = hit.length > 60 ? `Showing 60 of ${hit.length}.` : `${hit.length} wrestler${hit.length === 1 ? '' : 's'}.`; }, 120); });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cls]'); if (b) { setCls(b.dataset.cls); render(); return; }
    const c = e.target.closest('button[data-kind]'); if (c) { state.child = c.dataset.kind; render(); return; }
    const f = e.target.closest('button[data-mode]'); if (f) { state.bmode = f.dataset.mode; render(); return; }
    const w = e.target.closest('button[data-win]'); if (w) { setWin({ mode: w.dataset.win }); render(); return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const s = e.target.closest('.srow'); if (s) { const open = s.getAttribute('aria-expanded') === 'true'; s.setAttribute('aria-expanded', String(!open)); const pod = s.nextElementSibling; if (pod) pod.hidden = open; }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('srow')) e.target.click(); });
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-wrange]'); if (!f) return; e.preventDefault(); setWin({ mode: 'custom', from: +f.from.value, to: +f.to.value }); render(); });
  /* the tapped line slides to the top of the bracket while the rest fade, then we go there */
  function slideTo(bl) {
    const box = bl.parentElement, top = box.getBoundingClientRect().top, me = bl.getBoundingClientRect().top;
    box.classList.add('sliding'); bl.classList.add('go'); bl.style.transform = `translateY(${top - me}px)`;
    setTimeout(() => { location.hash = bl.getAttribute('href'); }, 280);
  }
  window.addEventListener('hashchange', render);
  render();
})();
