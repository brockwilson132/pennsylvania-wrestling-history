// Builds medals.js from data/medals/*.csv: one row per placewinner, validated against the champions list.
const fs = require('fs'), path = require('path');
global.window = {}; require('../site/data.js'); require('../site/badges.js');
const R = window.WR_DATA, SB = window.SchoolBadge;
const canon = (s) => { const id = SB.identity(s); return id ? id.school : s; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const dist = JSON.parse(fs.readFileSync('data/school_district.json', 'utf8'));
let lookup = {}; try { lookup = JSON.parse(fs.readFileSync('data/school_districts_lookup.json', 'utf8')); } catch (e) { /* not yet */ }
Object.entries(lookup).forEach(([k, v]) => { if (v && v.d >= 1 && v.d <= 12 && dist[k] == null) dist[k] = v.d; });
const distN = {}; Object.entries(dist).forEach(([k, v]) => { distN[norm(k)] = v; distN[norm(canon(k))] = v; });
// champions by year|cls|weight for validation and district fill
const champ = new Map(); R.champs.forEach(([y, c, w, n, s, d]) => champ.set(`${y}|${c}|${String(w).replace(/^0+/, '')}`, { n, s, d }));
const placeNum = (p) => { const m = String(p).match(/\d+/); return m ? +m[0] : null; };
const wNorm = (w) => { w = String(w).trim().toUpperCase().replace(/\s*LBS?\.?$/, ''); if (/^(UNL|HWT|HEAVY|UNLIMITED|HVY)/.test(w)) return 'UNL'; return w.replace(/^0+/, ''); };
const schoolFix = { 'Chartiers Valley': 'Chartiers Valley', 'Bethlehem Catholic': 'Bethlehem Catholic', 'Hempfield': 'Hempfield Area', 'Liberty': 'Bethlehem Liberty', 'Freedom': 'Bethlehem Freedom', 'Central Catholic (Pittsburgh)': 'Pittsburgh Central Catholic', 'Allen': 'William Allen', 'Dieruff': 'Allentown Dieruff', 'Wilson': 'Wilson (West Lawn)', 'Trinity (Washington)': 'Trinity', 'Cathedral Prep': 'Erie Cathedral Prep', 'McDowell': 'Erie McDowell', 'Kiski': 'Kiski Area' };
const out = [], issues = [], unknownSchools = new Map();
let files = fs.readdirSync('data/medals').filter((f) => /^\d{4}_(AAA|AA|single)\.csv$/.test(f)).sort();
let mismatch = 0, checked = 0;
for (const f of files) {
  const [year, cls] = f.replace('.csv', '').split('_');
  const lines = fs.readFileSync(path.join('data/medals', f), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !/^weight,place/i.test(l) && !/^```/.test(l));
  if (!lines.length) { issues.push(`${year} ${cls}: empty`); continue; }
  const seen = new Set();
  for (const l of lines) {
    const parts = l.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    if (parts.length < 4) { issues.push(`${year} ${cls}: bad line "${l}"`); continue; }
    const [w0, p0, name, ...rest] = parts; let school = rest.join(',').trim();
    const w = wNorm(w0), place = placeNum(p0);
    if (!place || place > 8 || !name) { issues.push(`${year} ${cls}: bad place/name "${l}"`); continue; }
    const orig = school;
    school = schoolFix[school] || school;
    if (/ CC$/.test(school)) school = school.replace(/ CC$/, ' Central Catholic');
    if (school === 'Notre Dame-GP') school = 'Notre Dame-Green Pond';
    const key = `${year}|${cls}|${w}|${place}`;
    if (seen.has(key)) { issues.push(`${year} ${cls}: duplicate ${w} ${place}`); continue; }
    seen.add(key);
    const sch = canon(school);
    let d = dist[school] ?? dist[sch] ?? dist[orig] ?? distN[norm(school)] ?? distN[norm(sch)] ?? (lookup[orig] && lookup[orig].d) ?? null;
    const c = champ.get(`${year}|${cls}|${w}`);
    if (place === 1) {
      checked++;
      if (!c) issues.push(`${year} ${cls} ${w}: champion not in data (${name}, ${school})`);
      else if (norm(c.n).slice(-5) !== norm(name).slice(-5) && norm(c.s) !== norm(school)) { mismatch++; issues.push(`${year} ${cls} ${w}: 1st "${name}, ${school}" vs data "${c.n}, ${c.s}"`); }
      if (c && d == null) d = c.d;
    }
    if (d == null) unknownSchools.set(school, (unknownSchools.get(school) || 0) + 1);
    out.push([+year, cls, w, place, name, school, d]);
  }
}
fs.writeFileSync('data/medals_issues.txt', issues.join('\n'));
fs.writeFileSync('data/medals_unknown_schools.txt', Array.from(unknownSchools).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}\t${n}`).join('\n'));
console.log('files', files.length, 'rows', out.length, 'champions checked', checked, 'mismatches', mismatch, 'issues', issues.length, 'unknown schools', unknownSchools.size, 'rows without district', out.filter((r) => r[6] == null).length);
// champions missing from the original list, recovered from the place-winner files
const fill = out.filter((r) => r[3] === 1 && !champ.has(`${r[0]}|${r[1]}|${r[2]}`) && r[6] != null).map((r) => [r[0], r[1], r[2], r[4], r[5], r[6]]);
console.log('champion fills', fill.length);
fs.writeFileSync('site/medals.js', 'window.WR_MEDALS=' + JSON.stringify(out) + ';\nwindow.WR_CHAMP_FILL=' + JSON.stringify(fill) + ';');
