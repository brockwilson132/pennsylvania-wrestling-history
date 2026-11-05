/* Matches Overtime's canonical school names to NCES school locations and writes overtime/schoolgeo.js:
     window.WR_SCHOOLGEO = { "<school>": [lon, lat, src] }
       src: "p" NCES public file, "v" NCES private file, "o" hand override, "s" placed at its successor school (closed/merged)
   Inputs: the two JSON files written by tools/fetch_school_geo.sh.
     node tools/build_school_geo.js [geo folder]       (default ~/Projects/pa-wrestling/sources/geo)

   Matching (precision over recall: a school with no confident match is left out and listed, never guessed):
   - candidates are secondary schools only (no technical/career centers, cyber or charter schools, camps, Montessori,
     elementary/middle schools unless our name says so);
   - our name's distinctive tokens must all appear in the NCES name or its city, at least one in the name itself; NCES
     name tokens that our name doesn't have count against the match;
   - pass 1 looks only in the counties of the PIAA district the school wrestled in most often; pass 2 looks statewide
     but demands a perfect, unique match (schools that wrestle outside their county's district, e.g. Clearfield in D9);
   - the best candidate must beat the runner-up clearly, and each NCES record is used once;
   - closed or merged schools in SUCCESSOR are placed at their successor's location (src "s").
   Hand fixes go in OVERRIDE (name → [lon, lat]). The report lists matches, weak matches and every unmatched school. */
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const ROOT = path.join(__dirname, '..');
const GEO = process.argv[2] || path.join(os.homedir(), 'Projects', 'pa-wrestling', 'sources', 'geo');
const load = (f) => { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'overtime', f), 'utf8'), { window: w }); return w; };
const U = load('units.js').WR_UNITS, MAP = load('pa-map.js').PA_MAP;
const MED = load('medals.js').WR_MEDALS || [];
const OVERRIDE = {};
const SUCCESSOR = { Canonsburg: 'Canon-McMillan', 'Forty Fort': 'Wyoming Valley West', Kingston: 'Wyoming Valley West', Plymouth: 'Wyoming Valley West', Philipsburg: 'Philipsburg-Osceola', 'Chartiers Township': 'Chartiers-Houston', Boswell: 'North Star', Carnegie: 'Carlynton', 'Manheim Borough': 'Manheim Central', Greensburg: 'Greensburg Salem', Latrobe: 'Greater Latrobe', Lansdowne: 'Penn Wood',
  // closed schools placed at the school that absorbed them (location only; the results stay with the old school)
  'Lock Haven': 'Central Mountain', 'Bald Eagle Nittany': 'Central Mountain', Center: 'Central Valley', Kittanning: 'Armstrong', Elderton: 'Armstrong', 'Bishop Hoban': 'Holy Redeemer', Churchill: 'Woodland Hills', Swissvale: 'Woodland Hills', 'Coal Township': 'Shamokin', Sunbury: 'Shikellamy' };
// successors that are not in our data as schools: match them against NCES directly
const GEO_ONLY = ['Armstrong', 'Holy Redeemer', 'Central Valley'];
// our-name → NCES-name aliases where the names share no distinctive token
const ALIAS = { 'Bethlehem Catholic': 'Bethlehem Catholic High School', 'Erie Cathedral Prep': 'Cathedral Preparatory School', "St. Joseph's Prep": "St Joseph's Preparatory School", 'Notre Dame-Green Pond': 'Notre Dame Easton', 'Bishop McDevitt (3)': 'Bishop McDevitt High School', 'Taylor Allderdice': 'Pittsburgh Allderdice', 'Allentown Dieruff': 'Louis E Dieruff', 'J.P. McCaskey': 'McCaskey Campus', 'Steelton': 'Steelton-Highspire', 'Springfield Delco': 'Springfield', 'West Chester Rustin': 'West Chester Bayard Rustin' };

// each school's district: the one it wrestled in most often
const dc = new Map(); U.ss.forEach((r) => { if (!(r[3] >= 1 && r[3] <= 12)) return; const k = r[0]; const m = dc.get(k) || {}; m[r[3]] = (m[r[3]] || 0) + 1; dc.set(k, m); });
const distOf = (i) => { const m = dc.get(i); if (!m) return null; return +Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; };
const countiesOf = {}; Object.entries(MAP.countyOf).forEach(([c, d]) => { (countiesOf[d] = countiesOf[d] || []).push(c.toLowerCase()); });
countiesOf[8] = ['allegheny'];
// D12 (Philadelphia Catholic League) schools also sit in the collar counties
countiesOf[12] = Array.from(new Set((countiesOf[12] || []).concat(['philadelphia', 'delaware', 'montgomery', 'bucks'])));

const STRONG = new Set(['catholic', 'christian', 'academy', 'seminary', 'prep', 'friends', 'baptist', 'lutheran', 'mennonite', 'hebrew', 'islamic', 'road', 'montessori', 'military', 'saint', 'bishop', 'cardinal', 'archbishop', 'stem', 'science', 'arts']);
const SOFT = new Set(['township', 'community', 'county', 'co', 'valley', 'regional', 'memorial']);
const GENERIC = new Set(['ctr', '9', '10', '11', '12', '7', '8', 'high', 'school', 'senior', 'sr', 'jr', 'junior', 'hs', 'shs', 'jshs', 'jrsr', 'the', 'of', 'and', 'secondary', 'campus', 'area', 'hi', 'ms']);
const norm = (s) => String(s || '').toLowerCase().replace(/\bst\.?\b/g, 'saint').replace(/\bmt\.?\b/g, 'mount').replace(/\btwp\b/g, 'township').replace(/\bjr\.?\s*\/\s*sr\.?\b/g, 'jrsr').replace(/\bprep(aratory)?\b/g, 'prep').replace(/['’.]/g, '').replace(/\(\d+\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((t) => t && !GENERIC.has(t));
const COMBINED = /\b(ms|jhs)\s*\/\s*s?hs\b|\bs?hs\s*\/\s*ms\b/gi;
const BAD = /\b(jhs|ms|el sch|el ctr|intrmd|elementary school|(?:jr|junior) (?:hs|high))\b|\b(technical|tech|career|vocational|cyber|charter|\bcs\b|montessori|camp|elementary|primary|intermediate|middle|kindergarten|preschool|early|learning|juvenile|alternative|center|virtual|online|academy regional|day treatment|detention|youth|childrens|children|autism|special)\b/i;
const read = (f) => { const p = path.join(GEO, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; };
const pub = read('pa_public.json').map((r) => ({ ...r, src: 'p' })), pri = read('pa_private.json').map((r) => ({ ...r, src: 'v' }));
if (!pub.length && !pri.length) { console.error('no NCES files in ' + GEO + ' — run tools/fetch_school_geo.sh first'); process.exit(1); }
const isSecondary = (r) => /\b(high|secondary|hs|shs|jshs|jr\/?\s*sr|senior|prep|preparatory|seminary)\b/i.test(r.NAME || '') || (r.src === 'v' && /\b(catholic|academy)\b/i.test(r.NAME || '') && !/elementary|school of/i.test(r.NAME || ''));
const ALL = pub.concat(pri).filter((r) => r.LAT && r.LON && isSecondary(r)).map((r) => {
  const t = toks(r.NAME), ct = toks(r.CITY);
  return { name: r.NAME, city: r.CITY, county: String(r.NMCNTY || '').replace(/ County$/i, '').toLowerCase(), lat: +r.LAT, lon: +r.LON, src: r.src, t: new Set(t), c: new Set(ct), bad: BAD.test(String(r.NAME || '').replace(COMBINED, 'HS')) };
});
/* score our token list q against a candidate: all q tokens covered by name or city, one at least in the name;
   extra distinctive name tokens the candidate has (and we don't) cost 0.3 each */
function score(q, c, ours) {
  if (c.bad && !BAD.test(ours)) return 0;
  let inName = 0, cov = 0; q.forEach((t) => { if (c.t.has(t)) { inName++; cov++; } else if (c.c.has(t)) cov++; });
  if (!inName || cov < q.length) return 0;
  const qs = new Set(q); let extra = 0, soft = 0, strong = 0; c.t.forEach((t) => { if (!qs.has(t) && !c.c.has(t)) { if (STRONG.has(t)) strong++; else if (SOFT.has(t)) soft++; else extra++; } });
  if (strong) return 0;
  return 1 - 0.3 * extra - 0.08 * soft + (c.src === 'p' ? 0.02 : 0);
}
const out = {}, unmatched = [], weak = [], used = new Map(), later = [];
const byKey = new Map();
const put = (s, c, bs) => { byKey.set(toks(ALIAS[s] || s).join(' '), s); out[s] = [+c.lon.toFixed(4), +c.lat.toFixed(4), c.src]; used.set(c, s); if (bs < 0.95) weak.push(`${s} → ${c.name} (${c.city}) ${bs.toFixed(2)}`); };
function best(s, q, pool) {
  let b = null, bs = 0, s2 = 0;
  pool.forEach((c) => { if (used.has(c)) { const o = toks(ALIAS[used.get(c)] || used.get(c)); if (!(o.every((t) => q.includes(t)) || q.every((t) => o.includes(t)))) return; } const v = score(q, c, s); if (v > bs) { s2 = bs; bs = v; b = c; } else if (v > s2) s2 = v; });
  return { b, bs, margin: bs - s2 };
}
// pass 1: inside the counties of the district the school wrestled in, best candidates first (sort by query specificity)
const order = U.schools.map((s, i) => [s, i]).filter(([s]) => s && s.trim()).sort((a, b) => toks(b[0]).length - toks(a[0]).length);
order.forEach(([s, i]) => {
  if (OVERRIDE[s]) { out[s] = OVERRIDE[s].concat('o'); return; }
  if (SUCCESSOR[s]) return; // closed or merged: placed at its successor below, never matched directly
  const d = distOf(i), cs = d ? countiesOf[d] || [] : null; const q = toks(ALIAS[s] || s); if (!q.length) { unmatched.push([s, d, 'no distinctive name']); return; }
  const key = q.join(' '); if (byKey.has(key)) { out[s] = out[byKey.get(key)].slice(); return; }
  const pool = cs ? ALL.filter((c) => cs.includes(c.county)) : ALL;
  const r = best(s, q, pool);
  if (r.b && r.bs >= 0.7 && r.margin >= 0.1) put(s, r.b, r.bs); else later.push([s, q, d]);
});
// pass 2: statewide, perfect and unique only
later.forEach(([s, q, d]) => {
  const C = ALL.filter((c) => !used.has(c) && score(q, c, s) >= 0.99);
  if (C.length === 1) put(s, C[0], 1); else unmatched.push([s, d, C.length ? C.length + ' statewide candidates' : 'no candidate']);
});
// closed / merged schools at their successor
const extra = {}; GEO_ONLY.forEach((n) => { const C = ALL.filter((c) => score(toks(n), c, n) >= 0.7).sort((a, b) => score(toks(n), b, n) - score(toks(n), a, n)); if (C.length) extra[n] = [+C[0].lon.toFixed(4), +C[0].lat.toFixed(4)]; });
Object.entries(SUCCESSOR).forEach(([s, to]) => { if (!U.schools.includes(s) || out[s]) return; const t = out[to] || extra[to]; if (t) out[s] = [t[0], t[1], 's']; else unmatched.push([s, null, 'successor ' + to + ' unmatched']); });

const file = path.join(ROOT, 'overtime', 'schoolgeo.js');
fs.writeFileSync(file, '/* generated by tools/build_school_geo.js from NCES EDGE school locations 2023-24 (p public, v private, s successor, o override) */\nwindow.WR_SCHOOLGEO=' + JSON.stringify(out) + ';\n');
// metrics: overall, and schools with at least one state medal
const medal = new Set(MED.map((r) => r[5]));
const names = U.schools.filter((s) => s && s.trim());
const n = names.length, m = names.filter((s) => out[s]).length;
const mn = names.filter((s) => medal.has(s)), mm = mn.filter((s) => out[s]).length;
const um = unmatched.map(([s, d, why]) => `${medal.has(s) ? '* ' : '  '}${s}${d ? ' (D' + d + ')' : ''} · ${why}`).sort();
fs.writeFileSync(path.join(ROOT, 'data', 'school_geo_report.txt'),
  `matched ${m}/${n} schools (${(100 * m / n).toFixed(1)}%); with a state medal ${mm}/${mn.length} (${(100 * mm / mn.length).toFixed(1)}%)\n\nweaker matches (check):\n${weak.sort().join('\n')}\n\nunmatched (* = has a state medal; closed, merged, renamed or garbled names):\n${um.join('\n')}\n`);
console.log(`schoolgeo.js: matched ${m}/${n} (${(100 * m / n).toFixed(1)}%), state-medal schools ${mm}/${mn.length} (${(100 * mm / mn.length).toFixed(1)}%), ${weak.length} weaker; report in data/school_geo_report.txt`);
