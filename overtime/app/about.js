/* About page visuals for the Overtime Rating: a ladder of landmark seasons, a head-to-head odds calculator and the
   distribution of state-qualifier seasons. Everything is computed from the data the app already has (eager state
   ratings in WR_SOS, state wrestlers in OT.WRESTLER), so the numbers follow every rebuild. */
(() => {
  const OT = window.OT; const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const odds = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  const pc = (p) => Math.round(100 * p) + '%';
  const FROM = 1990;
  let DATA = null;
  /* state-qualifier seasons since 1990 (each wrestler's season rating at states), placers, champions, best ever */
  function data() {
    if (DATA) return DATA;
    const seasons = [];
    Object.entries(window.WR_SOS || {}).forEach(([y, Y]) => { if (+y < FROM) return; Object.entries(Y).forEach(([k, e]) => { if (!k.includes('.s..') || !e || !e[1]) return; e[1].split(',').forEach((x) => { const i = x.lastIndexOf(':'); const v = +x.slice(i + 1); if (v) seasons.push(v); }); }); });
    seasons.sort((a, b) => a - b);
    const plc = [], ch = []; let best = null;
    OT.APP.forEach((r) => { if (r.year < FROM || !r.place) return; const v = OT.ratingOf(r, 'state'); if (!v) return; plc.push(v); if (r.place === 1) ch.push(v); if (!best || v > best.v) best = { v, r }; });
    const med = (A) => { const S = A.slice().sort((a, b) => a - b); return S.length ? S[Math.floor(S.length / 2)] : null; };
    const q = (p) => seasons[Math.min(seasons.length - 1, Math.floor(p * seasons.length))];
    const people = Array.from(OT.WRESTLER.values()).map((W) => { const c = OT.careerOf(W, W.apps); return c && c.peak ? { name: W.name, sch: W.sch, slug: W.slug, peak: c.peak, year: c.peakYear, key: (W.name + ' ' + W.sch).toLowerCase() } : null; }).filter(Boolean);
    DATA = { seasons, medalist: med(plc), champ: med(ch), p99: q(0.99), best, people };
    return DATA;
  }
  const pctBelow = (v) => { const S = data().seasons; let lo = 0, hi = S.length; while (lo < hi) { const m = (lo + hi) >> 1; if (S[m] < v) lo = m + 1; else hi = m; } return lo / S.length; };

  /* ---------- ratings ladder ---------- */
  function ladder() {
    const D = data(); const lo = 1000, hi = Math.ceil((D.best ? D.best.v : 2200) / 100) * 100 + 50;
    const X = (v) => (100 * (v - lo) / (hi - lo)).toFixed(2);
    const marks = [
      [1500, 'Average state qualifier'],
      [D.medalist, 'Typical state medalist'],
      [D.champ, 'Typical state champion'],
      [D.p99, 'Top 1% of state seasons'],
      D.best ? [D.best.v, `Best season since ${FROM}: ${D.best.r.name}, ${D.best.r.year}`] : null,
    ].filter((m) => m && m[0]).sort((a, b) => a[0] - b[0]);
    const pins = marks.map(([v, l], i) => `<div class="lad-m ${i % 2 ? 'dn' : 'up'}" style="left:${X(v)}%;--tint:${OT.ratingColor('wrestler', v)}"><i></i><span><b>${Math.round(v)}</b>${esc(l)}<em>beats an average qualifier ${pc(odds(v, 1500))}</em></span></div>`).join('');
    const ticks = []; for (let v = lo; v <= hi; v += 100) ticks.push(`<span class="lad-t" style="left:${X(v)}%">${v % 200 === 0 ? v : ''}</span>`);
    const grad = Array.from({ length: 11 }, (_, i) => OT.ratingColor('wrestler', lo + (hi - lo) * i / 10)).join(',');
    const gaps = [100, 200, 300, 400].map((g) => `<span><b>${g}</b> points ahead · wins ${pc(odds(g, 0))}</span>`).join('');
    const list = marks.slice().reverse().map(([v, l]) => `<div class="ladl-r"><b style="color:${OT.ratingColor('wrestler', v)}">${Math.round(v)}</b><span>${esc(l)}<em>beats an average qualifier ${pc(odds(v, 1500))}</em></span><i><s style="left:${X(v)}%;background:${OT.ratingColor('wrestler', v)}"></s></i></div>`).join('');
    return `<div class="ladl">${list}</div><div class="lad"><div class="lad-ax" style="background:linear-gradient(90deg,${grad})">${pins}</div><div class="lad-ts">${ticks.join('')}</div></div><div class="lad-g">${gaps}</div>`;
  }

  /* ---------- odds calculator ---------- */
  const pick = { a: null, b: null };
  function defaults() { const D = data(); const f = (s) => D.people.find((p) => p.key.startsWith(s)); pick.a = pick.a || f('brock wilson nazareth') || D.people[0]; pick.b = pick.b || f('jarod verkleeren') || D.people[1]; }
  function sideHTML(k) { const p = pick[k]; return `<div class="oc-s" data-oc="${k}"><input class="oc-i" type="search" placeholder="Search a state wrestler" value="${p ? esc(p.name) : ''}" aria-label="Wrestler ${k === 'a' ? 'one' : 'two'}"><div class="oc-l" hidden></div>${p ? `<div class="oc-p"><a href="#wrestler/${p.slug}">${esc(p.sch)}</a> · peak <b style="color:${OT.ratingColor('wrestler', p.peak)}">${Math.round(p.peak)}</b> (${p.year})</div>` : ''}</div>`; }
  function resultHTML() {
    const { a, b } = pick; if (!a || !b) return '';
    const p = odds(a.peak, b.peak);
    return `<div class="oc-r"><div class="oc-bar"><i class="a" style="width:${(100 * p).toFixed(1)}%"></i><i class="b" style="width:${(100 * (1 - p)).toFixed(1)}%"></i></div>
      <div class="oc-t"><span><b>${pc(p)}</b> ${esc(a.name)}</span><span>${esc(b.name)} <b>${pc(1 - p)}</b></span></div>
      <p class="oc-n">Each at his best season. ${Math.abs(Math.round(a.peak - b.peak))} points apart. Odds are for one bout; a real bout also depends on weight, style and the day.</p></div>`;
  }
  function calc() { defaults(); return `<div class="oc"><div class="oc-row">${sideHTML('a')}<span class="oc-vs">vs</span>${sideHTML('b')}</div><div class="oc-res">${resultHTML()}</div></div>`; }

  /* ---------- distribution ---------- */
  function dist() {
    const D = data(); const S = D.seasons; if (!S.length) return '';
    const lo = 900, hi = Math.ceil((D.best ? D.best.v : 2200) / 50) * 50 + 50, bw = 25, nb = Math.ceil((hi - lo) / bw);
    const H = new Array(nb).fill(0); S.forEach((v) => { const i = Math.max(0, Math.min(nb - 1, Math.floor((v - lo) / bw))); H[i]++; });
    const mx = Math.max(...H); const W = 100 / nb;
    const bars = H.map((n, i) => `<i style="left:${(i * W).toFixed(2)}%;width:${(W * 0.86).toFixed(2)}%;height:${(100 * n / mx).toFixed(1)}%;background:${OT.ratingColor('wrestler', lo + (i + 0.5) * bw)}"></i>`).join('');
    const X = (v) => (100 * (v - lo) / (hi - lo)).toFixed(2);
    const mk = (p, cls) => (p ? `<span class="ds-k ${cls}" style="left:${X(p.peak)}%"><b>${esc(p.name.split(' ').slice(-1)[0])}</b> ${Math.round(p.peak)}</span>` : '');
    const ticks = []; for (let v = 1000; v <= hi; v += 200) ticks.push(`<span class="lad-t" style="left:${X(v)}%">${v}</span>`);
    const txt = [pick.a, pick.b].filter(Boolean).map((p) => `${esc(p.name)}'s best season is higher than ${pc(pctBelow(p.peak))} of state-qualifier seasons since ${FROM}.`).join(' ');
    return `<div class="ds"><div class="ds-h">${bars}<span class="ds-avg" style="left:${X(1500)}%"><em>avg qualifier</em></span>${mk(pick.a, 'a')}${mk(pick.b, 'b')}</div><div class="lad-ts">${ticks.join('')}</div><p class="oc-n">${S.length.toLocaleString()} state-qualifier seasons since ${FROM}. ${txt}</p></div>`;
  }

  function aboutViz() {
    return `<h3>The scale</h3><p>Only the gap between two ratings means anything: it sets the odds when they meet. 1500 is the average state qualifier each season. These landmarks are typical seasons, measured from the archive since ${FROM}.</p>${ladder()}
      <h3>Head to head</h3><p>Pick any two state wrestlers to see how often the first would beat the second, each at his best season.</p>${calc()}
      <h3>Where a season sits</h3><p>Every state-qualifier season since ${FROM}, by rating. The two wrestlers above are marked.</p><div class="ds-wrap">${dist()}</div>`;
  }
  function wireAbout(root) {
    const box = root.querySelector('.oc'); if (!box) return;
    const D = data();
    const refresh = () => { box.querySelector('.oc-res').innerHTML = resultHTML(); const dw = root.querySelector('.ds-wrap'); if (dw) dw.innerHTML = dist(); };
    box.addEventListener('input', (e) => {
      const inp = e.target.closest('.oc-i'); if (!inp) return; const s = inp.closest('.oc-s'), L = s.querySelector('.oc-l');
      const t = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!t.length) { L.hidden = true; return; }
      const hits = D.people.filter((p) => t.every((w) => p.key.includes(w))).sort((a, b) => b.peak - a.peak).slice(0, 8);
      L.innerHTML = hits.map((p) => `<button type="button" data-ocp="${esc(p.slug)}"><b>${esc(p.name)}</b> <small>${esc(p.sch)} · ${Math.round(p.peak)}</small></button>`).join('') || '<span class="oc-none">No state wrestler by that name</span>';
      L.hidden = false;
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ocp]'); if (!b) return; const s = b.closest('.oc-s'), k = s.dataset.oc;
      pick[k] = D.people.find((p) => p.slug === b.dataset.ocp) || pick[k];
      s.outerHTML = sideHTML(k); refresh();
    });
  }
  Object.assign(OT, { aboutViz, wireAbout });
})();
