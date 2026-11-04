/* Build the district / regional data files for the Overtime app from the parsed bracket CSVs.
 *   node tools/build_lower.js
 * Emits:
 *   overtime/lower-district.js, overtime/lower-regional.js  → window.WR_LOWER_D / WR_LOWER_R (medalists only; row = [lvl, year, cls, unit, weight, place, name, school, grade, seed, d], strings in WR_LOWER_META.strs)
 *   overtime/lowerteams.js                                   → window.WR_LOWER_TEAMS
 *   overtime/lowermeta.js                                    → window.WR_LOWER_META (coverage, district→region by year, advancing places)
 *   overtime/lower/<year>-<level>.json                       → full entrant lists (lazy, for the bracket view)
 */
'use strict';
const fs = require('fs'), path = require('path');
global.window = {}; require('../site/badges.js');
const SB = window.SchoolBadge;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen', 'Notre Dame-GP': 'Notre Dame-Green Pond', 'St. Pius X': 'Pius X (Roseto)', 'Pius X': 'Pius X (Roseto)', 'Juniata Joint': 'Juniata' };
const canon = (s) => { const id = SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');

function csv(file) {
  const t = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean); const H = t[0].split(',');
  return t.slice(1).map((line) => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); const o = {}; H.forEach((h, i) => { o[h] = out[i] || ''; }); return o; });
}
const E = csv('data/brackets/lower_entrants.csv'), T = csv('data/brackets/lower_teams.csv');

/* supplementary sources fill whole tournaments the archive lacks (District III Records: D3 champions;
   WPIAL: D7 champions). Only (year, cls, unit) tournaments with no archive file are filled; place 1 only, no field. */
const SRCS = { D3: ['data/sources/d3_champions.csv', 'd3records'], D7: ['data/sources/d7_champions.csv', 'wpial'] };
const have = new Set(E.filter((r) => r.level === 'district').map((r) => { const cls = r.cls === 'A' ? 'AAA' : r.cls === 'B' ? 'AA' : r.cls; return `${r.year}|${cls}|${r.unit}`; }));
const SRC = {}; let added = 0;
Object.entries(SRCS).forEach(([unit, [file, src]]) => { if (!fs.existsSync(file)) return; csv(file).forEach((r) => {
  const k = `${r.year}|${r.cls}|${unit}`; if (have.has(k)) return;
  E.push({ level: 'district', tournament: `${r.year}_${unit}_${r.cls}_${src}`, year: r.year, cls: r.cls, unit, weight: r.weight === 'HWT' ? 'UNL' : r.weight, place: '1', seed: '', name: r.name.replace(/\s+Jr\.?$/, ''), school: r.school, grade: '', record: '', src });
  SRC[`district|${r.year}|${r.cls}|${unit}`] = src; added++; }); });
console.log('source rows added', added, 'tournaments', Object.keys(SRC).length);

/* normalize unit / class. District 1 AAA parts come through as unit D1_AAA with the part in cls. */
const D1 = new Set(['North', 'South', 'Central', 'East', 'West']);
function norm(r) {
  let unit = r.unit, cls = r.cls;
  if (unit === 'D1_AAA' && D1.has(cls)) { unit = 'D1_' + cls; cls = 'AAA'; }
  if (cls === 'A') cls = 'AAA'; if (cls === 'B') cls = 'AA';
  return { unit, cls };
}
const CLS = { AAA: 0, AA: 1, single: 2 }, GR = { '': 0, FR: 1, SO: 2, JR: 3, SR: 4 };
const stateDist = JSON.parse(fs.readFileSync('data/school_district.json', 'utf8'));
let lookup = {}; try { lookup = JSON.parse(fs.readFileSync('data/school_districts_lookup.json', 'utf8')); } catch (e) { /* none */ }

/* school → district by year, from the district-level rows themselves (the tournament a school wrestled in) */
const unitDistrict = (unit) => { const m = /^D(\d+)(?:_|$|-)/.exec(unit); return m ? +m[1] : null; };
const SD = new Map(); // sch → Map(year → d)
E.forEach((r) => { if (r.level !== 'district' && r.level !== 'section') return; const { unit } = norm(r); const m = /^D(\d+)$/.exec(unit) || /^D(\d+)_/.exec(unit); if (!m) return; const s = canon(r.school); (SD.get(s) || SD.set(s, new Map()).get(s)).set(+r.year, +m[1]); });
const distOf = (sch, year, unit) => {
  const m = SD.get(sch); if (m) { if (m.has(year)) return m.get(year); let best = null, bd = 1e9; m.forEach((d, y) => { if (Math.abs(y - year) < bd) { bd = Math.abs(y - year); best = d; } }); if (best) return best; }
  const d = stateDist[sch] || lookup[sch]; if (d) return +d;
  return unitDistrict(unit);
};

/* strings tables */
const strs = [], sidx = new Map(); const S = (s) => { if (!sidx.has(s)) { sidx.set(s, strs.length); strs.push(s); } return sidx.get(s); };
const parts = { district: [], regional: [], section: [] }; // section medalists are kept out of the app files
const rows = E.map((r) => { const { unit, cls } = norm(r); let sch = canon(r.school); if (sch === 'Bishop McDevitt') { const ud = unitDistrict(unit); sch = ud === 3 || /^S[CE]$/.test(unit) ? 'Bishop McDevitt (3)' : 'Bishop McDevitt (12)'; } const year = +r.year; return { ...r, unit, cls, sch, year, place: r.place ? +r.place : 0, d: r.level === 'district' || r.level === 'section' ? (unitDistrict(unit) && /^D\d+$/.test(unit) ? unitDistrict(unit) : distOf(sch, year, unit)) : distOf(sch, year, unit) }; });
rows.forEach((r) => { if (!r.place) return; parts[r.level].push([r.level === 'district' ? 0 : 1, r.year, CLS[r.cls], S(r.unit), S(r.weight), r.place, S(r.name), S(r.sch), GR[r.grade] || 0, S(r.seed || ''), r.d || 0]); });

/* coverage: which (level, year, cls, unit) tournaments exist */
const cov = {}; rows.forEach((r) => { if (r.level === 'section') return; cov[`${r.level}|${r.year}|${r.cls}|${r.unit}`] = 1; });

/* district → region membership by year and class: a regional entrant's school district (from the district rows) */
const mem = new Map(); // cls|year|d → counts by region
rows.filter((r) => r.level === 'regional' && r.d).forEach((r) => { const k = `${r.cls}|${r.year}|${r.d}`; const m = mem.get(k) || mem.set(k, new Map()).get(k); m.set(r.unit, (m.get(r.unit) || 0) + 1); });
const dreg = []; mem.forEach((m, k) => { const [cls, year, d] = k.split('|'); const best = Array.from(m).sort((a, b) => b[1] - a[1])[0]; dreg.push([cls, +year, +d, best[0], best[1], Array.from(m.values()).reduce((a, b) => a + b, 0)]); });

/* advancing places: per tournament, the max place whose wrestler appears in the next level that season */
const nextIdx = new Map(); // level|year|cls → Set(nkey|sch)
rows.forEach((r) => { const k = `${r.level}|${r.year}|${r.cls}`; (nextIdx.get(k) || nextIdx.set(k, new Set()).get(k)).add(nkey(r.name) + '|' + r.sch); });
const stateIdx = new Map();
{ global.window = {}; require('../site/medals.js'); require('../site/brackets.js'); const add = (year, cls, name, school) => { const k = `${year}|${cls}`; (stateIdx.get(k) || stateIdx.set(k, new Set()).get(k)).add(nkey(name) + '|' + canon(school)); };
  (window.WR_MEDALS || []).forEach(([year, cls, w, place, name, school]) => add(year, cls, name, school)); (window.WR_QUAL || []).forEach(([year, cls, w, name, school]) => add(year, cls, name, school)); }
const adv = {}; // level|year|cls|unit → [modal n, {weight: n} overrides]
const byT = new Map(); rows.forEach((r) => { if (r.level === 'section') return; const k = `${r.level}|${r.year}|${r.cls}|${r.unit}`; (byT.get(k) || byT.set(k, []).get(k)).push(r); });
byT.forEach((rs, k) => {
  const [level, year, cls] = k.split('|'); const nx = level === 'section' ? (nextIdx.get(`district|${year}|${cls}`) || new Set()) : level === 'district' ? (nextIdx.get(`regional|${year}|${cls}`) || stateIdx.get(`${year}|${cls}`) || new Set()) : (stateIdx.get(`${year}|${cls}`) || new Set());
  const perW = {}; const byW = new Map(); rs.forEach((r) => (byW.get(r.weight) || byW.set(r.weight, []).get(r.weight)).push(r));
  byW.forEach((v, w) => { const n = Math.max(0, ...v.filter((r) => r.place && nx.has(nkey(r.name) + '|' + r.sch)).map((r) => r.place)); perW[w] = n; });
  const vals = Object.values(perW).filter((n) => n > 0); const modal = vals.length ? Array.from(new Map(vals.map((n) => [n, vals.filter((x) => x === n).length])).entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] : 0;
  const over = {}; Object.entries(perW).forEach(([w, n]) => { if (n > modal) over[w] = n; });
  adv[k] = Object.keys(over).length ? [modal, over] : [modal];
});

/* lazy entrant files */
fs.mkdirSync('overtime/lower', { recursive: true }); fs.readdirSync('overtime/lower').forEach((f) => fs.unlinkSync(path.join('overtime/lower', f)));
const byYL = new Map(); rows.forEach((r) => { const k = `${r.year}-${r.level}`; (byYL.get(k) || byYL.set(k, []).get(k)).push([r.cls, r.unit, r.weight, r.place, r.seed || '', r.name, r.sch, r.grade, r.record, r.d || 0]); });
/* section entrants are a build input (tools/build_units.js), not an app file */
fs.mkdirSync('data/brackets/lower-section', { recursive: true }); fs.readdirSync('data/brackets/lower-section').forEach((f) => fs.unlinkSync(path.join('data/brackets/lower-section', f)));
let nfiles = 0, bytes = 0; byYL.forEach((v, k) => { const j = JSON.stringify(v); if (k.endsWith('-section')) { fs.writeFileSync(`data/brackets/lower-section/${k}.json`, j); return; } fs.writeFileSync(`overtime/lower/${k}.json`, j); nfiles++; bytes += j.length; });

/* teams */
const teams = T.filter((r) => r.level !== 'section').map((r) => { const { unit, cls } = norm(r); return [r.level === 'district' ? 0 : 1, +r.year, CLS[cls], S(unit), +r.place, +r.points, S(canon(r.school))]; });

const write = (file, name, obj) => { const j = `window.${name}=${JSON.stringify(obj)};`; fs.writeFileSync(file, j); return j.length; };
const sizes = {
  district: write('overtime/lower-district.js', 'WR_LOWER_D', parts.district),
  regional: write('overtime/lower-regional.js', 'WR_LOWER_R', parts.regional),
  teams: write('overtime/lowerteams.js', 'WR_LOWER_TEAMS', teams),
  meta: write('overtime/lowermeta.js', 'WR_LOWER_META', { strs, cov: Object.keys(cov), dreg, adv, src: SRC }),
};
/* linking report: state placers 1974+ with a district row (exact name key, or last name + school + year + weight) */
{ const meds = (window.WR_MEDALS || []).filter((m) => m[0] >= 1974); const dIdx = new Map(); rows.filter((r) => r.level === 'district').forEach((r) => { const k = `${r.year}|${r.cls}|${r.sch}`; (dIdx.get(k) || dIdx.set(k, []).get(k)).push(r); });
  let exact = 0, last = 0, miss = 0; const missing = [];
  meds.forEach(([year, cls, w, place, name, school]) => { const sch = canon(school); const c = dIdx.get(`${year}|${cls}|${sch}`) || []; const nk = nkey(name); if (c.some((r) => nkey(r.name) === nk)) exact++; else { const ln = name.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, ''); if (c.some((r) => r.name.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '') === ln && r.weight === w)) last++; else { miss++; if (missing.length < 40) missing.push(`${year} ${cls} ${w} ${name} (${school})`); } } });
  console.log(`link rate, state placers 1974+: exact ${exact}, last-name ${last}, missing ${miss} of ${meds.length} (${((exact + last) / meds.length * 100).toFixed(1)}%)`);
  fs.writeFileSync('data/brackets/lower_link_report.txt', `exact ${exact}\nlast-name ${last}\nmissing ${miss}\nof ${meds.length}\n\nsample missing:\n${missing.join('\n')}\n`);
}
console.log('rows', parts.district.length, 'district medalists,', parts.regional.length, 'regional medalists;', teams.length, 'team rows;', nfiles, 'entrant files', (bytes / 1e6).toFixed(1), 'MB;', 'sizes', Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}MB`).join(', '));
console.log('coverage', Object.keys(cov).length, 'tournaments; dreg', dreg.length, 'rows; adv', Object.keys(adv).length);
