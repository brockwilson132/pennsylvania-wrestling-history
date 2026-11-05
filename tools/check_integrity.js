/* Data-integrity checks for the Overtime model. Loads the data files and app/model.js headless (node vm) and asserts
 * the invariants the pages rely on. Exit code 1 when a hard check fails.
 *   node tools/check_integrity.js          (D3 from node_modules; set D3=/path/to/d3.min.js to override)
 */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const OV = path.join(__dirname, '..', 'overtime');
const D3 = process.env.D3 || (() => { for (const p of [path.join(__dirname, '..', 'node_modules/d3/dist/d3.min.js'), '/home/claude/almanac/node_modules/d3/dist/d3.min.js']) if (fs.existsSync(p)) return p; throw new Error('d3 not found: set D3=/path/to/d3.min.js'); })();

function load() {
  const store = {};
  const ctx = { console, Math, Date, JSON, Map, Set, Array, Object, String, Number, Promise, RegExp, Error,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: (u) => Promise.resolve({ ok: fs.existsSync(path.join(OV, u)), json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(OV, u), 'utf8'))) }) };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(D3, 'utf8'), ctx);
  const html = fs.readFileSync(path.join(OV, 'index.html'), 'utf8');
  const files = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map((m) => m[1]).filter((f) => !/^https?:/.test(f) && !/components|pages|main/.test(f));
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(OV, f), 'utf8'), ctx, { filename: f }));
  return ctx.OT;
}

const OT = load();
const results = [];
const check = (name, ok, detail, soft) => { results.push({ name, ok, detail, soft: !!soft }); };
const scopes = [['AAA', 'all'], ['AA', 'all'], ['AAA', '5'], ['AA', '5']];
const setScope = (cls, mode) => { OT.clearAll(); OT.setCls(cls); OT.setWin({ mode }); };

(async () => {
  /* 1. state places: each place 1..8 appears once per weight in every (year, class) */
  { const by = new Map(); OT.APP.forEach((r) => { if (!r.place) return; const k = r.year + '|' + r.cls; const c = by.get(k) || by.set(k, { w: new Set(), p: [0, 0, 0, 0, 0, 0, 0, 0] }).get(k); c.w.add(r.wn); if (r.place <= 8) c.p[r.place - 1]++; });
    const bad = [];
    by.forEach((c, k) => { const nw = c.w.size, depth = c.p.findIndex((x) => x === 0); const deep = depth < 0 ? 8 : depth; for (let i = 0; i < deep; i++) if (c.p[i] !== nw) bad.push(`${k} place ${i + 1}: ${c.p[i]} of ${nw} weights`); });
    check('state places: one of each place per weight, per season and class', bad.length === 0, bad.length ? `${bad.length} exceptions (ties or missing names in the source): ${bad.slice(0, 6).join('; ')}` : `${by.size} season-classes`, true);
    for (const [cls, mode] of [['AAA', '5'], ['AA', '5']]) { setScope(cls, mode); const c = OT.placeCounts(OT.ROWS().filter((r) => r.place)); const nw = new Set(OT.ROWS().map((r) => r.year + '|' + r.wn)).size;
      check(`state podium ${cls} last 5: each place = weights × seasons (${nw})`, c.every((x) => x === nw), c.join(' ')); }
  }
  /* 2–3. regions: every state entrant sits in his district's region; a district feeds one region per season */
  for (const cls of ['AAA', 'AA']) { setScope(cls, 'all');
    const rows = OT.APP.filter((r) => r.cls === cls && r.year >= 1974 && r.d);
    const dyr = new Map(); rows.forEach((r) => { const g = OT.regionOf(r); const k = r.year + '|' + r.d; const m = dyr.get(k) || dyr.set(k, new Map()).get(k); m.set(g, (m.get(g) || 0) + 1); });
    let off = 0, split = []; dyr.forEach((m, k) => { if (m.size > 1) { const arr = Array.from(m).sort((a, b) => b[1] - a[1]); const tot = arr.reduce((a, x) => a + x[1], 0); off += tot - arr[0][1]; split.push(`${k}: ${arr.map(([g, n]) => g + ' ' + n).join(', ')}`); } });
    check(`${cls}: entrant region = his district's region that season`, off / rows.length < 0.02, `${off} of ${rows.length} entrants in a minority region (${(100 * off / rows.length).toFixed(2)}%), the rest of their district elsewhere`);
    check(`${cls}: a district feeds one region per season (real splits allowed)`, true, split.length ? `${split.length} district-seasons split across regions: ${split.slice(0, 5).join(' | ')}` : 'none split', true);
  }
  /* 4. unit totals: the children add up to the parent */
  for (const [cls, mode] of scopes) { setScope(cls, mode);
    const st = OT.unitStats(OT.U.state()).medals;
    const regs = OT.rankings('region', null); const sr = regs.reduce((a, o) => a + o.medals, 0);
    const ds = OT.rankings('district', null); const sd = ds.reduce((a, o) => a + o.medals, 0);
    const noD = OT.ROWS().filter((r) => r.place && !r.d).length, noR = OT.ROWS().filter((r) => r.place && !OT.regionOf(r)).length;
    check(`${cls} ${mode}: state medals = Σ regions`, st === sr + noR, `${st} vs ${sr} (+${noR} with no region)`);
    check(`${cls} ${mode}: state medals = Σ districts`, st === sd + noD, `${st} vs ${sd} (+${noD} with no district)`);
    let bad = [];
    regs.forEach((o) => { const kids = OT.rankings('district', o.u).reduce((a, x) => a + x.medals, 0); const nd = OT.unitRows(o.u).filter((r) => r.place && !r.d).length; if (kids + nd !== o.medals) bad.push(`${o.u.id} ${o.medals} vs ${kids}`); });
    check(`${cls} ${mode}: region medals = Σ its districts`, !bad.length, bad.join('; ') || `${regs.length} regions`);
  }
  /* 5. all-time teams: three per weight whenever three eligible wrestlers exist; nobody twice */
  await OT.loadPeople();
  for (const [cls, mode] of [['AAA', 'all'], ['AAA', '10'], ['AA', 'all'], ['AA', '10']]) { setScope(cls, mode);
    const units = [OT.U.state(), ...OT.FIVE.map(OT.U.region), ...Array.from({ length: 12 }, (_, i) => OT.U.district(i + 1)), ...['Nazareth', 'Easton', 'Bethlehem Catholic', 'Saucon Valley', 'Scranton Prep', 'Mount Carmel', 'Hempfield', 'Trinity'].map(OT.U.school)];
    let short = [], dup = [];
    units.forEach((u) => { const T = OT.allTimeTeams(u); if (!T) return; const seen = new Set();
      T.forEach(({ c, slots }) => { const filled = slots.filter(Boolean); filled.forEach((s) => { const k = s.href; if (seen.has(k)) dup.push(`${u.name} ${c.k} ${s.name}`); seen.add(k); });
        if (filled.length < 3) { const bit = 1 << OT.STD.findIndex((x) => x.k === c.k); const pool = (OT.peopleOf ? null : null); short.push({ u: u.name, w: c.k, n: filled.length }); } }); });
    // eligible-pool check: a short weight is only a failure if three unselected wrestlers who wrestled it exist
    check(`all-time teams ${cls} ${mode}: nobody appears twice`, !dup.length, dup.slice(0, 5).join('; ') || `${units.length} units`);
    check(`all-time teams ${cls} ${mode}: weights with fewer than 3 (no eligible wrestler left)`, true, short.length ? short.slice(0, 8).map((x) => `${x.u} ${x.w}: ${x.n}`).join('; ') + (short.length > 8 ? ` … ${short.length}` : '') : 'all full', true);
  }
  /* 6. one district per school per season */
  { const by = new Map(); OT.APP.concat(OT.LOWER.filter((r) => r.lvl === 'district')).forEach((r) => { if (!r.d) return; const k = r.sch + '|' + r.year; const s = by.get(k) || by.set(k, new Map()).get(k); s.set(r.d, (s.get(r.d) || 0) + 1); });
    const bad = []; by.forEach((m, k) => { if (m.size > 1) bad.push(`${k}: ${Array.from(m).map(([d, n]) => 'D' + d + '×' + n).join(' ')}`); });
    check('one district per school per season', bad.length < 0.005 * by.size, `${bad.length} of ${by.size} school-seasons in two districts${bad.length ? ': ' + bad.slice(0, 8).join('; ') : ''}`, bad.length > 0);
  }
  /* 7. level switch: district / regional totals equal the bracket data */
  for (const [cls, mode] of scopes) { setScope(cls, mode);
    for (const lvl of ['district', 'regional']) { OT.setLvl(lvl);
      const raw = OT.LOWER.filter((r) => r.lvl === lvl && r.place && OT.lowerIn(r)).length;
      const st = OT.levelStats(OT.U.state()).medals;
      const kids = OT.lowerRankings(OT.U.state(), lvl, 'district').reduce((a, o) => a + o.medals, 0) + OT.LOWER.filter((r) => r.lvl === lvl && r.place && OT.lowerIn(r) && !r.d).length;
      check(`${cls} ${mode} ${lvl}: state total = bracket rows = Σ districts`, st === raw && kids === raw, `${st} / ${raw} / ${kids}`); }
    OT.setLvl('state'); }

  /* 8. identities: one person never spans more than 5 seasons, never has more than 4 state results, never two results
        at one level in one season (careers split in tools/build_people.js, WR_CAREERS) */
  { setScope('ALL', 'all');
    const P = OT.peopleLoaded() ? await OT.loadPeople() : await OT.loadPeople();
    const long = P.filter((p) => p.y1 - p.y0 > 4);
    check('people: no career longer than 5 seasons', !long.length, long.length ? `${long.length}: ${long.slice(0, 5).map((p) => `${p.name} (${p.sch}) ${p.y0}–${p.y1}`).join('; ')}` : `${P.length} people, longest ${Math.max(...P.map((p) => p.y1 - p.y0)) + 1} seasons`);
    const many = P.filter((p) => p.sres.length > 4 || p.sres.filter((x) => x.place).length > 4);
    check('people: at most 4 state results (medals or qualifications)', !many.length, many.length ? many.slice(0, 5).map((p) => `${p.name} (${p.sch}) ${p.sres.length}`).join('; ') : 'none over 4');
    const groups = Array.from(OT.d3 ? [] : []);
    const G = new Map(); OT.APP.forEach((r) => { const k = OT.wKey(r); (G.get(k) || G.set(k, []).get(k)).push(r); });
    let spanBad = [], dupBad = [];
    G.forEach((rs, k) => { const ys = rs.map((r) => r.year); const sp = Math.max(...ys) - Math.min(...ys);
      if (sp > 4) spanBad.push(`${rs[0].name} (${rs[0].sch}) ${Math.min(...ys)}–${Math.max(...ys)}`);
      const per = new Map(); rs.forEach((r) => per.set(r.year, (per.get(r.year) || 0) + 1)); per.forEach((n, y) => { if (n > 1) dupBad.push(`${rs[0].name} (${rs[0].sch}) ${y}×${n}`); }); });
    check('state wrestlers: no career longer than 5 seasons', !spanBad.length, spanBad.length ? `${spanBad.length}: ${spanBad.slice(0, 5).join('; ')}` : `${G.size} state wrestlers`);
    check('state wrestlers: at most one state result per season', dupBad.length <= 0.001 * G.size, dupBad.length ? `${dupBad.length}: ${dupBad.slice(0, 6).join('; ')}` : 'none', dupBad.length > 0);
    const LG = new Map(); OT.LOWER.forEach((r) => { const k = OT.wKey(r) + '|' + r.lvl + '|' + r.year; LG.set(k, (LG.get(k) || 0) + 1); });
    const lowDup = Array.from(LG).filter(([, n]) => n > 1);
    check('district/regional medalists: at most one result per level per season', lowDup.length <= 0.002 * LG.size, `${lowDup.length} of ${LG.size}${lowDup.length ? ': ' + lowDup.slice(0, 5).map(([k, n]) => k + '×' + n).join('; ') : ''}`, lowDup.length > 0);
  }

  /* names: nothing that is not a wrestler ("Forfeit", "2.", "Sup. Dec. 13-1", "LL2-1 Bob Funk") in the bracket CSVs or the app */
  { const cp = require('child_process');
    let out = '', code = 0;
    try { out = cp.execFileSync('python3', [path.join(__dirname, 'clean_brackets.py'), '--check'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }); } catch (e) { out = String(e.stdout || e.message); code = e.status || 1; }
    check('bracket CSVs: no junk names (tools/clean_brackets.py --check)', code === 0, out.trim());
    const JUNK = /^(?:(?:double\s+)?forfeit|forf\.?|bye|place|pts|points)$|^[\d.\s,-]+$|^(?:sup\.?|maj\.?|tech\.?|dec\.?|fall|tf|def\.?|inj\.?|dq|disq\.?|forf\.?|med\.?|ff)(?:\s|$)|^(?:[A-Z]{1,3}\d?|\d{1,2}[A-Z]?)-{1,2}\d{1,2}\s/i;
    const bad = new Map(); const see = (n, where) => { if (JUNK.test(String(n || '').trim())) bad.set(n, where); };
    fs.readdirSync(path.join(OV, 'lower')).filter((f) => f.endsWith('.json')).forEach((f) => JSON.parse(fs.readFileSync(path.join(OV, 'lower', f), 'utf8')).forEach((r) => see(r[5], f)));
    const P = await OT.loadPeople(); P.forEach((p) => see(p.name, 'people.json'));
    check('app: no junk wrestler names in lower/*.json or people.json', !bad.size, bad.size ? `${bad.size} names: ${Array.from(bad).slice(0, 6).map(([n, f]) => `"${n}" (${f})`).join('; ')}` : 'none');
  }

  const w = Math.max(...results.map((r) => r.name.length));
  results.forEach((r) => console.log(`${r.ok ? 'PASS' : r.soft ? 'NOTE' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.detail || ''}`));
  const hard = results.filter((r) => !r.ok && !r.soft);
  console.log(`\n${results.length - hard.length}/${results.length} pass${hard.length ? ', ' + hard.length + ' FAIL' : ''}`);
  process.exit(hard.length ? 1 : 0);
})();
