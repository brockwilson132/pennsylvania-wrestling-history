/* Time-aware membership for state rows: which district a state entrant actually wrestled out of, that season.
 *   node tools/build_membership.js        (run after tools/build_lower.js; build_people.js reads the output)
 * Emits overtime/membership.js → window.WR_MEMB = { r: { "year|cls|wn|nkey(name)": [district, school override or 0] } }
 *
 * Why: state rows carried one district per school from a static lookup, which is wrong for schools that changed
 * districts (Mount Carmel wrestled in District 11 for part of the 1980s–90s, District 4 otherwise), wrong for schools
 * the lookup guessed (Indian Valley is District 6, Penncrest is the Media school in District 1), and wrong where the
 * state build folded two schools into one name (Hempfield, Lancaster County, District 3, was renamed Hempfield Area,
 * the Westmoreland County school in District 7). The district brackets say where each wrestler actually competed.
 *
 * Per state row, in order:
 *   1. his own district row that season (same normalized name; same school, or a school name that contains the
 *      other, e.g. Hempfield / Hempfield Area) → that tournament's district, and the district bracket's school name;
 *   2. otherwise his school's district that season from the district brackets (nearest season within 3 years);
 *   3. otherwise unchanged.
 * Only rows whose district or school changes are written. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OV = path.join(ROOT, 'overtime');
global.window = {};
['badges.js', 'data.js', 'medals.js', 'brackets.js', 'seeds.js'].forEach((f) => { (0, eval)(fs.readFileSync(path.join(OV, f), 'utf8')); });
const W = window, SB = W.SchoolBadge;
const SAME_APP = { Allentown: 'William Allen', Allen: 'William Allen' };
const SAME_LOW = { ...SAME_APP, 'Notre Dame-GP': 'Notre Dame-Green Pond', 'St. Pius X': 'Pius X (Roseto)', 'Pius X': 'Pius X (Roseto)', 'Juniata Joint': 'Juniata' };
const canonApp = (s) => { const id = SB.identity(s); const n = id ? id.school : s; return SAME_APP[n] || n; };
const canonLow = (s) => { const id = SB.identity(s); const n = id ? id.school : s; return SAME_LOW[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const sk = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);

function csv(file) {
  const t = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean); const H = t[0].split(',');
  return t.slice(1).map((line) => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); const o = {}; H.forEach((h, i) => { o[h] = out[i] || ''; }); return o; });
}
const E = csv(path.join(ROOT, 'data/brackets/lower_entrants.csv')).filter((r) => r.level === 'district');
const unitD = (unit) => { const m = /^D(\d+)$/.exec(unit) || /^D(\d+)_/.exec(unit); return m ? +m[1] : null; };

/* school → season → district, from single-district tournaments */
const SD = new Map();
E.forEach((r) => { const d = unitD(r.unit); if (!d) return; const s = canonLow(r.school); const m = SD.get(s) || SD.set(s, new Map()).get(s); const k = +r.year; const c = m.get(k) || m.set(k, new Map()).get(k); c.set(d, (c.get(d) || 0) + 1); });
const sdOf = (s, y) => { const m = SD.get(s); if (!m) return null; for (const dy of [0, -1, 1, -2, 2, -3, 3]) { const c = m.get(y + dy); if (c) return Array.from(c).sort((a, b) => b[1] - a[1])[0][0]; } return null; };
/* a wrestler's district row: season → nkey → [{d, sch}] (joint tournaments resolve through the school's map) */
const BY = new Map();
E.forEach((r) => { const s = canonLow(r.school), y = +r.year; const d = unitD(r.unit) || sdOf(s, y); if (!d) return; const k = y + '|' + nkey(r.name); (BY.get(k) || BY.set(k, []).get(k)).push({ d, sch: s }); });

const STATIC = new Map();
const rows = [];
const SEEDS = W.WR_SEEDS || {};
(W.WR_MEDALS || []).forEach(([year, cls, w, place, name, school, d]) => rows.push({ year, cls, w, name, school, d }));
(W.WR_DATA.champs || []).concat(W.WR_CHAMP_FILL || []).forEach(([year, cls, w, name, school, d]) => rows.push({ year, cls, w, name, school, d }));
(W.WR_QUAL || []).forEach(([year, cls, w, name, school, d, g, seed, region]) => rows.push({ year, cls, w, name, school, d, region }));
rows.forEach((r) => { if (!r.region && r.year >= 1951) { const sd = SEEDS[`${r.year}|${r.cls}|${nkey(r.name)}`]; if (sd) r.region = sd[1]; } });

/* pass 1 assigns districts; pass 2 checks each row's printed seed region against what the rest of its district did that
   season. A school whose wrestlers keep landing in another region was given the wrong district (two Trinitys, the two
   Hempfields, Donegal): move those rows to the district, among the school's (or a same-named school's) district-bracket
   districts, that fed the seeded region that season. */
const FIVE = ['NE', 'SE', 'SC', 'NW', 'SW'];
const out = {}; const why = { linked: 0, school: 0, same: 0, none: 0, renamed: 0 }; const moved = new Map();
rows.forEach((r) => {
  const sch = canonApp(r.school), k = `${r.year}|${r.cls}|${wNum(r.w)}|${nkey(r.name)}`;
  let d = null, over = 0;
  const cands = (BY.get(r.year + '|' + nkey(r.name)) || []);
  const a = sk(sch);
  let hit = cands.find((c) => c.sch === sch) || cands.find((c) => { const b = sk(c.sch); return b && a && (a.includes(b) || b.includes(a)); });
  if (hit) { d = hit.d; if (hit.sch !== sch) { over = hit.sch; why.renamed++; } why.linked++; }
  else { d = sdOf(sch, r.year); if (d) why.school++; else why.none++; }
  r.k = k; r.sch = sch; r.d1 = d || r.d; r.over = over; r.linked = !!hit;
});
const DY = new Map(); // cls|year|d → Map(region → [schools])
rows.forEach((r) => { if (r.year < 1951 || !FIVE.includes(r.region) || !r.d1) return; const k = r.cls + '|' + r.year + '|' + r.d1; const m = DY.get(k) || DY.set(k, new Map()).get(k); (m.get(r.region) || m.set(r.region, []).get(r.region)).push(r.over || r.sch); });
const majorOther = (cls, year, d, sch) => { const m = DY.get(cls + '|' + year + '|' + d); if (!m) return null; let best = null, bn = 0; m.forEach((L, reg) => { const n = L.filter((x) => x !== sch).length; if (n > bn) { bn = n; best = reg; } }); return best; };
const famDistricts = (sch) => { const a = sk(sch), out = []; SD.forEach((m, s) => { const b = sk(s); if (s === sch || (a && b && (a.includes(b) || b.includes(a)))) { const ds = new Map(); m.forEach((c) => c.forEach((n, d) => ds.set(d, (ds.get(d) || 0) + n))); ds.forEach((n, d) => out.push({ s, d, n })); } }); return out; };
let fixed = 0;
rows.forEach((r) => {
  if (r.linked || r.year < 1951 || !FIVE.includes(r.region)) return;
  const name = r.over || r.sch, mo = majorOther(r.cls, r.year, r.d1, name);
  if (!mo || mo === r.region) return;
  const c = famDistricts(name).filter((x) => x.d !== r.d1 && majorOther(r.cls, r.year, x.d, name) === r.region).sort((a, b) => b.n - a.n)[0];
  if (!c) return;
  r.d1 = c.d; if (c.s !== name) r.over = c.s; fixed++;
});
/* official district → regional feeds (data/sources/postseason_membership.csv, parsed from the PA wrestling archive's
   district pages by tools/parse_postseason.py). These are the base: a district can only be placed in a regional it is
   officially listed as feeding; the seeds only decide which one when a district is split between several. */
const OFFICIAL = {};
fs.readFileSync(path.join(__dirname, '..', 'data', 'sources', 'postseason_membership.csv'), 'utf8').trim().split(/\r?\n/).slice(1).forEach((ln) => {
  const [d, level, , cls, region] = ln.split(',');
  if (!region || !(level === 'regional' || level === 'super-regional')) return;
  const k = cls + '|' + d; (OFFICIAL[k] = OFFICIAL[k] || []).includes(region) || OFFICIAL[k].push(region);
});
Object.values(OFFICIAL).forEach((a) => a.sort());
const offOk = (cls, d, reg) => !OFFICIAL[cls + '|' + d] || OFFICIAL[cls + '|' + d].includes(reg);
/* a seed outside its district's official regionals usually means the entrant was put in the wrong district
   (Hempfield vs Hempfield Area, William Penn vs William Penn Charter): move him to a same-named school's district
   that does feed that regional */
let offMoved = 0;
rows.forEach((r) => {
  if (r.year < 1951 || !r.region || !r.d1 || offOk(r.cls, r.d1, r.region)) return;
  const name = r.over || r.sch;
  const c = famDistricts(name).filter((x) => x.d !== r.d1 && OFFICIAL[r.cls + '|' + x.d] && offOk(r.cls, x.d, r.region)).sort((a, b) => b.n - a.n)[0];
  if (!c) return;
  r.d1 = c.d; if (c.s !== name) r.over = c.s; offMoved++;
});
console.log('moved to a district that feeds their regional', offMoved);
rows.forEach((r) => {
  if (!r.d1 || (r.d1 === r.d && !r.over)) { why.same++; return; }
  out[r.k] = [r.d1, r.over || 0];
  const mk = (r.over || r.sch) + ': D' + r.d + '→D' + r.d1; moved.set(mk, (moved.get(mk) || 0) + 1);
});
console.log('seed-region fixes', fixed);
const offBad = rows.filter((r) => r.year >= 1951 && r.region && r.d1 && !offOk(r.cls, r.d1, r.region));
{ const c = new Map(); offBad.forEach((r) => { const k = `${r.cls} D${r.d1} ${r.region}`; const v = c.get(k) || c.set(k, []).get(k); v.push(r.year); v.s = (v.s || new Set()).add(r.sch + (r.over ? '>' + r.over : '')); }); console.log('seeds outside the official regional set', offBad.length); c.forEach((v, k) => console.log('  ', k, v.length, Math.min(...v) + '-' + Math.max(...v), Array.from(v.s).join(';'))); }
fs.writeFileSync(path.join(OV, 'membership.js'), `/* generated by tools/build_membership.js: where each state entrant actually wrestled districts that season (r),
   and the regionals each district officially fed, by class (dr) */\nwindow.WR_MEMB=${JSON.stringify({ r: out, dr: OFFICIAL })};\n`);
console.log('state rows', rows.length, why, 'changed', Object.keys(out).length);
console.log(Array.from(moved).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => `${v}\t${k}`).join('\n'));
