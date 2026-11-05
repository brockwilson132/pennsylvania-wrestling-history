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
  let pop = '';
  /* View: what the page body shows for the current selection; remembered for the session */
  const VIEWS = [['map', 'Map', 'The picture and its list'], ['rank', 'Rankings', 'Standings for this selection'], ['time', 'Timeline', 'Every team, season by season'], ['team', 'All-time team', 'The best at each weight, as deep as you like'], ['seasons', 'Seasons', 'Results season by season']];
  try { const v = sessionStorage.getItem('ot-view'); if (VIEWS.some(([k]) => k === v)) state.view = v; } catch (e) { /* none */ }
  if (!state.view) state.view = 'map';
  /* a school page has no map: its first view is the season grid and the wrestler list */
  const viewLabel = (k, l) => (k === 'map' && route().page === 'school' && route().id ? 'Overview' : l);
  const viewName = () => (state.view === 'team' ? 'Team' : viewLabel(state.view, (VIEWS.find(([k]) => k === state.view) || VIEWS[0])[1]));
  const NO_VIEW = new Set(['wrestler', 'wrestlers', 'about', 'tournaments', 'missing']);   // pages the View button does not change
  const paText = () => (state.cls === 'ALL' ? 'All' : state.cls) + (state.f.weights.length ? ' · ' + wtText() : '');
  function drawBar() {
    const f = F();
    const cell = (k, name, val, on, icon) => `<button class="fb${on ? ' on' : ''}" type="button" data-fb="${k}" aria-label="${name}: ${esc(val)}"${k === 'wrestlers' ? '' : ` aria-haspopup="dialog" aria-expanded="${pop === k}"`}>${icon || navIcon(k)}<span class="fbv">${esc(val)}</span></button>`;
    const wv = f.w ? (f.who ? f.who.split(' ').slice(-1)[0] : 'List') : 'Wrestlers';
    const time = `<button class="fb ft${state.win.mode !== 'all' ? ' on' : ''}" type="button" data-fb="time" aria-label="Time: ${esc(winText())}" aria-haspopup="dialog" aria-expanded="${pop === 'time'}"><span class="ftc">${OT.stopwatch(30)}</span><span class="fbv">${esc(winText())}</span></button>`;
    const paOn = state.cls !== 'AAA' || state.f.weights.length > 0;
    fbar.innerHTML = `<div class="fbi">${cell('pa', 'Pennsylvania', paText(), paOn, navIcon('state', paOn))}${cell('region', 'Region', f.r || 'Region', !!f.r, navIcon('region', f.r))}${cell('district', 'District', f.d ? 'D' + f.d : 'District', !!f.d, navIcon('district', f.d))}${time}${cell('school', 'School', f.s || 'School', !!f.s)}${cell('wrestlers', 'Wrestlers', wv, f.w)}${NO_VIEW.has(route().page) ? '<span class="fb off" aria-hidden="true"></span>' : cell('view', 'View', viewName(), false, navIcon('v_' + state.view))}</div>`;
  }
  /* the popups: one at a time, a sheet above the bar on a phone, a panel anchored to its button on a desktop */
  let SCH = null; const schools = () => SCH || (SCH = OT.UD.schools.map((n) => { const u = OT.U.school(n); return { n, d: u.d || 0, r: u.region || '', q: n.toLowerCase() }; }).sort((a, b) => a.n.localeCompare(b.n)));
  const schoolScope = (f) => schools().filter((x) => (!f.d || x.d === f.d) && (f.d || !f.r || x.r === f.r));
  const schoolItems = (f, qq) => { const t = (qq || '').trim().toLowerCase(); const all = schoolScope(f).filter((x) => !t || x.q.includes(t)); const L = all.slice(0, 80);
    return (L.length ? L.map((x) => `<a class="fpo${x.n === f.s ? ' on' : ''}" href="${hrefOf({ ...f, s: x.n })}"><span>${esc(x.n)}</span><small>${x.d ? 'D' + x.d : ''}</small></a>`).join('') : '<div class="fpn">No school by that name here.</div>') + (all.length > 80 ? `<div class="fpn">${all.length - 80} more: type to narrow.</div>` : ''); };
  const POP = {
    pa: () => { const f = F();
      return `<div class="fph"><b>Pennsylvania</b>${f.r || f.d || f.s ? `<a class="fpx" href="${hrefOf({ w: f.w && !f.who })}">Statewide</a>` : ''}</div>
      <div class="fpk">Division</div><div class="seg" role="group" aria-label="Division">${[['AAA', 'AAA'], ['AA', 'AA'], ['ALL', 'All']].map(([k, l]) => `<button type="button" data-fdiv="${k}" aria-pressed="${state.cls === k}">${l}</button>`).join('')}</div>
      <div class="fpk fpkw"><span>Weights</span>${state.f.weights.length ? '<button class="fpx" type="button" data-fwclear>Clear</button>' : ''}</div><div class="fpg">${OT.STD.map((x) => `<button type="button" class="fpc${state.f.weights.includes(x.k) ? ' on' : ''}" data-fw="${esc(x.k)}" aria-pressed="${state.f.weights.includes(x.k)}">${x.label}</button>`).join('')}</div>
      <div class="fpn">Before the split into two classes, every season counts under both. Weights narrow the wrestler lists, all-time teams and a school's timeline; ratings, scores and maps count every weight.</div>`; },
    region: () => { const f = F();
      const regs = OT.FIVE.map((g) => `<a class="fpo${f.r === g ? ' on' : ''}" href="${hrefOf({ w: f.w && !f.who, r: g })}"><span>${esc(OT.REGIONS[g])}</span><small>${g}</small></a>`).join('');
      return `<div class="fph"><b>Region</b>${f.r ? `<a class="fpx" href="${hrefOf({ w: f.w && !f.who })}">All regions</a>` : ''}</div><div class="fpl">${regs}</div>`; },
    district: () => { const f = F(); const win = OT.windowLabel();
      const mem = f.r ? OT.regionMembers(f.r) : d3.range(1, 13).map((d) => ({ d, span: win }));
      const item = (m) => `<a class="fpo${f.d === m.d ? ' on' : ''}" href="${hrefOf({ w: f.w && !f.who, r: f.r && m.span === win ? f.r : regionOfD(m.d), d: m.d })}"><span>District ${m.d}<i class="fpd">${esc(OT.DISTRICTS[m.d] || '')}</i></span><small>${m.span === win ? (f.r ? '' : regionOfD(m.d)) : esc(m.span)}</small></a>`;
      return `<div class="fph"><b>District</b><span class="muted">${f.r ? esc(OT.REGIONS[f.r]) + ' Region' : 'Pennsylvania'}</span>${f.d ? `<a class="fpx" href="${hrefOf({ w: f.w && !f.who, r: f.r })}">All districts</a>` : ''}</div><div class="fpl">${mem.map(item).join('')}</div>${mem.some((m) => m.span !== win) ? '<div class="fpn">Membership as of each season.</div>' : ''}`; },
    school: () => { const f = F(); const where = f.d ? 'District ' + f.d : f.r ? OT.REGIONS[f.r] + ' Region' : 'Pennsylvania';
      return `<div class="fph"><b>School</b><span class="muted">${esc(where)}</span>${f.s ? `<a class="fpx" href="${hrefOf({ ...f, s: '' })}">All schools</a>` : ''}</div><input class="search fps" id="fps" type="search" placeholder="Find a school" autocomplete="off" aria-label="Find a school"><div class="fpl" id="fpl">${schoolItems(f, '')}</div>`; },
    view: () => `<div class="fph"><b>View</b></div><div class="fpl fpv">${VIEWS.map(([k, l, d]) => `<button type="button" class="fpo${state.view === k ? ' on' : ''}" data-view="${k}" aria-pressed="${state.view === k}">${navIcon('v_' + k)}<span>${viewLabel(k, l)}<i class="fpd">${d}</i></span></button>`).join('')}</div>`,
    time: () => `<div class="fph"><b>Time</b></div><div class="fpg">${[['all', 'All-time'], ['5', 'Last 5'], ['10', 'Last 10'], ['25', 'Last 25']].map(([k, l]) => `<button type="button" class="fpc${state.win.mode === k ? ' on' : ''}" data-tw="${k}" aria-pressed="${state.win.mode === k}">${l}</button>`).join('')}</div>${OT.timeScrubber()}<div class="fpn">Drag either end, or tap a season. The strip is the statewide rating each season; grey seasons, before 1974, have no rating.</div>`,
    search: () => `<input class="search" id="gsq" type="search" placeholder="Wrestler, school or district" autocomplete="off" aria-label="Search wrestlers, schools and districts"><div class="gsr" id="gsr"><div class="fpn">Type at least two letters. Wrestlers include everyone in any bracket on file.</div></div>`,
    menu: () => `<nav class="fpm" aria-label="More"><a href="#tournaments">Tournaments<small>Every bracket, season by season</small></a><a href="#missing">Missing from the archive<small>Tournaments on record only in part</small></a><a href="#about">About<small>How ratings and scores work</small></a></nav>`,
  };
  function paintPop() {
    if (!pop) return; fpop.innerHTML = `<div class="fpi">${POP[pop]()}</div>`; fpop.className = 'fpop' + (pop === 'menu' ? ' menu' : pop === 'search' ? ' menu gs' : '') + (pop === 'time' ? ' time' : '');
    const btn = pop === 'menu' ? mbtn : pop === 'search' ? sbtn : fbar.querySelector(`[data-fb="${pop}"]`);
    if (window.innerWidth >= 720 && btn) { const r = btn.getBoundingClientRect(), W = Math.min(pop === 'time' ? 560 : pop === 'search' ? 460 : 380, window.innerWidth - 24); const L = Math.max(12, Math.min(window.innerWidth - 12 - W, (pop === 'menu' || pop === 'search') ? r.right - W : r.left + r.width / 2 - W / 2)); fpop.style.left = L + 'px'; fpop.style.width = W + 'px'; }
    else { fpop.style.left = ''; fpop.style.width = ''; }
    if (pop === 'search') wireGlobalSearch();
    const inp = fpop.querySelector('#fps'); if (inp) { inp.addEventListener('input', () => { fpop.querySelector('#fpl').innerHTML = schoolItems(F(), inp.value); }); if (window.innerWidth >= 720) inp.focus(); }
  }
  function openPop(k) { pop = k; fpop.hidden = false; fscrim.hidden = false; fscrim.classList.toggle('menu', k === 'menu'); mbtn.setAttribute('aria-expanded', String(k === 'menu')); sbtn.setAttribute('aria-expanded', String(k === 'search')); paintPop(); drawBar(); }
  function closePop() { if (!pop) return; pop = ''; fpop.hidden = true; fscrim.hidden = true; fpop.innerHTML = ''; mbtn.setAttribute('aria-expanded', 'false'); sbtn.setAttribute('aria-expanded', 'false'); drawBar(); }
  /* division, time and weights: each change is its own history entry, so Back steps through it */
  const snap = () => ({ cls: state.cls, win: { ...state.win }, w: state.f.weights.slice() });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stamp = () => { try { history.replaceState({ ot: snap() }, ''); } catch (e) { /* none */ } };
  const changed = () => { try { history.pushState({ ot: snap() }, ''); } catch (e) { /* none */ } render(true); };
  window.addEventListener('popstate', (e) => { const s = e.state && e.state.ot; if (!s || same(s, snap())) return; state.win = { ...s.win }; state.f.weights = s.w.slice(); setWin(s.win); setCls(s.cls); try { localStorage.setItem('ot-filters', JSON.stringify({ weights: s.w })); } catch (er) { /* none */ } if (location.hash === lastHash) render(true); });

  const bview = document.getElementById('bview');
  function showBracket(key, focus) {
    if (!key) { if (!bview.hidden) { bview.hidden = true; bview.innerHTML = ''; document.body.classList.remove('noscroll'); } return; }
    const paint = () => { bview.innerHTML = `<div class="bvcard">${OT.bracketView(key, focus)}</div>`; };
    paint(); bview.hidden = false; document.body.classList.add('noscroll'); bview.scrollTop = 0;
    const me = bview.querySelector('.bvc.me'); if (me) me.scrollIntoView({ block: 'center' });
    const again = () => { if (!bview.hidden && route().q.b === key) { const top = bview.scrollTop; paint(); bview.scrollTop = top; } };
    const k = OT.parseBkey(key); if (k && k.lvl !== 'state' && !OT.lowerLoaded(k.year, k.lvl)) OT.loadLower(k.year, k.lvl).then(again);
    if (k && !OT.sosLoaded(k.year)) OT.loadSOS(k.year).then(again);
  }
  let lastBase = '', lastHash = '';
  function render(keepScroll) {
    const { page, id, q, base } = route(); lastHash = location.hash;
    if (!OT.full && !coreRoute(page, q)) { waiting = true; if (main.firstChild) { lastBase = ''; main.innerHTML = '<div class="card empty" role="status">Loading the archive…</div>'; } return; }
    if (base === lastBase && (q.b || bview && !bview.hidden)) { showBracket(q.b, page === 'wrestler' ? id : null); stamp(); return; }
    lastBase = base;
    const f = F(); state.ctxDistrict = f.d;
    /* the place filters only narrow the wrestler list; the place pages scope themselves */
    const on = page === 'wrestlers'; Object.assign(state.f, { regions: on && f.r && !f.d && !f.s ? [f.r] : [], districts: on && f.d && !f.s ? [f.d] : [], schools: on && f.s ? [f.s] : [] });
    if (page + '/' + id !== state.lastRoute) { state.bracketAll = false; state.rall = false; state.uall = false; state.hall = false; state.pseason = null; state.mlall = false; state.tln = 50; state.attN = 3; state.lastRoute = page + '/' + id; }
    main.innerHTML = OT.PAGES[page](id, q); main.querySelectorAll('.pscr.scroll, .tlx').forEach((el) => { el.scrollLeft = el.scrollWidth; }); if (page === 'wrestler') { loadBestWins(id); loadCareer(id); } if (page === 'about' && OT.wireAbout) OT.wireAbout(main);
    if (main.querySelector('[data-need-people]')) OT.loadPeople().then(() => { if (route().base === base) { lastBase = ''; render(true); } });
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Overtime';
    drawBar(); paintPop(); stamp();
    if (!keepScroll) window.scrollTo(0, 0);
    wireSearch();
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
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = out.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); closePop(); } } });
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
    const nb = main.querySelector(`.perf[data-perf="${CSS.escape(key)}"] .pscr`); if (nb && left != null) nb.scrollLeft = left;
  }
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
  function setRange(lo, hi, y0, y1) { const w = lo === y0 && hi === y1 ? { mode: 'all' } : { mode: 'custom', from: lo, to: hi }; if (w.mode === state.win.mode && (w.mode === 'all' || (w.from === state.win.from && w.to === state.win.to))) return; setWin(w); changed(); }
  document.addEventListener('keydown', (e) => { const h = e.target.closest && e.target.closest('.tscr .sch'); if (!h || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); const scr = h.closest('.tscr'); const y0 = +scr.dataset.y0, y1 = +scr.dataset.y1; let a = +scr.dataset.a, b = +scr.dataset.b; const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (h.dataset.h === 'a') a = Math.max(y0, Math.min(b, a + d)); else b = Math.min(y1, Math.max(a, b + d)); setRange(a, b, y0, y1); const nh = fpop.querySelector(`.tscr .sch[data-h="${h.dataset.h}"]`); if (nh) nh.focus(); });
  document.addEventListener('mouseover', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell, .perf .cc, .perf .hitc'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = h.dataset.tip || ''; });
  document.addEventListener('mouseout', (e) => { const h = e.target.closest && e.target.closest('.perf .hit, .perf .hcell, .perf .cc, .perf .hitc'); if (!h) return; const tip = h.closest('.perf').querySelector('.ptip'); if (tip) tip.textContent = ''; });
  document.addEventListener('change', (e) => { const inp = e.target.closest && e.target.closest('input[data-cmpadd]'); if (!inp || !state.cmp) return; const v = inp.value.trim(); const s = OT.UD.schools.find((x) => x.toLowerCase() === v.toLowerCase());
    if (s && !state.cmp.extra.includes(s) && state.cmp.extra.length < 3 && 'school:' + s !== state.cmp.key) { state.cmp.extra.push(s); state.cmp.on.add('s:' + s); } repaintPerf(inp.closest('.perf')); });
  document.addEventListener('click', (e) => {
    /* filter bar and its popups */
    const fb = e.target.closest('[data-fb]'); if (fb) { const k = fb.dataset.fb, f = F();
      if (k === 'wrestlers') { closePop(); location.hash = hrefOf({ ...f, w: !f.w || !!f.who }); return; }
      if (pop === k) closePop(); else openPop(k); return; }
    if (e.target.closest('#sbtn')) { if (pop === 'search') closePop(); else openPop('search'); return; }
    if (e.target.closest('#mbtn')) { if (pop === 'menu') closePop(); else openPop('menu'); return; }
    if (e.target === fscrim) { closePop(); return; }
    if (pop && fpop.contains(e.target)) {
      const dv = e.target.closest('button[data-fdiv]'); if (dv) { if (dv.dataset.fdiv !== state.cls) { setCls(dv.dataset.fdiv); SCH = null; changed(); } closePop(); return; }
      const fw = e.target.closest('button[data-fw]'); if (fw) { OT.toggleFilter('weights', fw.dataset.fw); changed(); return; }
      if (e.target.closest('[data-fwclear]')) { OT.clearFilters('weights'); changed(); return; }
      const vw = e.target.closest('button[data-view]'); if (vw) { state.view = vw.dataset.view; try { sessionStorage.setItem('ot-view', state.view); } catch (er) { /* none */ } closePop(); const f = F(); if (f.w) location.hash = hrefOf({ ...f, w: false }); else { lastBase = ''; render(); } return; }
      const tw = e.target.closest('button[data-tw]'); if (tw) { if (tw.dataset.tw !== state.win.mode) { setWin({ mode: tw.dataset.tw }); changed(); } return; }
      const ty = e.target.closest('button[data-ty]'); if (ty) { const scr = ty.closest('.tscr'); const y = +ty.dataset.ty; const one = state.win.mode === 'custom' && state.win.from === y && state.win.to === y; setRange(one ? +scr.dataset.y0 : y, one ? +scr.dataset.y1 : y, +scr.dataset.y0, +scr.dataset.y1); return; }
      const a = e.target.closest('a[href]'); if (a && !a.hasAttribute('data-keep')) { closePop(); return; }
    }
    const tu = e.target.closest('button[data-tlunit]'); if (tu) { state.tlunit = tu.dataset.tlunit; state.tln = 50; render(true); return; }
    if (e.target.closest('button[data-tlgroup]')) { state.tlgroup = !state.tlgroup; render(true); return; }
    if (e.target.closest('button[data-tlmore]')) { const y = window.scrollY; state.tln = (state.tln || 50) + 50; render(true); window.scrollTo(0, y); return; }
    if (e.target.closest('button[data-attmore]')) { const y = window.scrollY; state.attN = (state.attN || 3) + 3; render(true); window.scrollTo(0, y); const x = main.querySelector('.atx'); if (x) x.scrollLeft = x.scrollWidth; return; }
    const c = e.target.closest('button[data-kind]'); if (c) { state.child = c.dataset.kind; render(true); return; }
    const lv = e.target.closest('button[data-lvl]'); if (lv) { OT.setLvl(lv.dataset.lvl); state.rall = false; state.bracketAll = false; render(true); return; }
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
    const bs = e.target.closest('button[data-bvsort]'); if (bs) { state.bvsort = bs.dataset.bvsort; const k = route().q.b; if (k) { const top = bview.scrollTop; bview.innerHTML = `<div class="bvcard">${OT.bracketView(k, route().page === 'wrestler' ? route().id : null)}</div>`; bview.scrollTop = top; } return; }
    const ba = e.target.closest('button[data-bracket-all]'); if (ba) { state.bracketAll = ba.dataset.bracketAll === '1'; render(); return; }
    const bl = e.target.closest('a.bl[data-bl]'); if (bl) { e.preventDefault(); slideTo(bl); return; }
    const mcard = e.target.closest && e.target.closest('.mapcard');
    if (mcard) {
      const [kd, ...rest] = mcard.dataset.mapcard.split(':'); const u = { kind: kd, id: rest.join(':') }; const key = mcard.dataset.mapcard;
      const repaint = () => { mcard.outerHTML = OT.mapCard(u); };
      const ms = e.target.closest('button[data-msort]'); if (ms) { state.msort = ms.dataset.msort; repaint(); return; }
      const ma = e.target.closest('button[data-mlall]'); if (ma) { state.mlall = ma.dataset.mlall === '1'; repaint(); return; }
      const row = e.target.closest('.mlr'); if (row && !e.target.closest('a')) { const k = row.dataset.mk; const on = !row.classList.contains('pin'); mcard.querySelectorAll('[data-mk]').forEach((el) => el.classList.toggle('pin', on && el.dataset.mk === k)); return; }
    }
    const sx = e.target.closest('button[data-sx]'); if (sx) { const open = sx.getAttribute('aria-expanded') === 'true'; sx.setAttribute('aria-expanded', String(!open)); const d = sx.nextElementSibling; if (d) d.hidden = open; sx.parentElement.classList.toggle('open', !open); return; }
    const s = e.target.closest('.srow'); if (s) { const open = s.getAttribute('aria-expanded') === 'true'; s.setAttribute('aria-expanded', String(!open)); const pod = s.nextElementSibling; if (pod) { if (!open && pod.dataset.sd && !pod.dataset.done) { pod.innerHTML = OT.seasonDetail(pod.dataset.sd); pod.dataset.done = '1'; } pod.hidden = open; } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('srow')) e.target.click(); });
  document.addEventListener('change', (e) => { const s = e.target.closest('select[data-sortsel]'); if (!s) return; state[s.dataset.sortsel] = s.value; render(true); });
  document.addEventListener('change', (e) => { const s = e.target.closest('select[data-tyear]'); if (s) location.hash = '#tournaments?y=' + s.value; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) closePop(); else if (e.key === 'Escape' && !bview.hidden) location.hash = OT.bhref(null); });
  window.addEventListener('resize', () => { if (pop) paintPop(); });
  bview.addEventListener('click', (e) => { if (e.target === bview) location.hash = OT.bhref(null); });
  /* the tapped line slides to the top of the bracket while the rest fade, then we go there */
  function slideTo(bl) {
    const box = bl.parentElement, top = box.getBoundingClientRect().top, me = bl.getBoundingClientRect().top;
    box.classList.add('sliding'); bl.classList.add('go'); bl.style.transform = `translateY(${top - me}px)`;
    setTimeout(() => { location.hash = bl.getAttribute('href'); }, 280);
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
