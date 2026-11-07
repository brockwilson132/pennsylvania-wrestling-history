/* PIAA team duals (1999–2026: PA-Wrestling.com dual meet pages, bout-checked, plus District III Records rows the site lacks; the source column says which) → overtime/duals.js
 *   node tools/build_duals.js
 * row = [year, cls, round, winner, winnerDistrict, winnerScore, loser, loserDistrict, loserScore, note] */
'use strict';
const fs = require('fs');
global.window = {}; require('../site/badges.js');
const SB = window.SchoolBadge;
const SAME = { Allentown: 'William Allen', Allen: 'William Allen', 'Notre Dame-GP': 'Notre Dame-Green Pond', 'Fath Christian Academy': 'Faith Christian Academy', 'Canon McMillan': 'Canon-McMillan', 'West Lawn Wilson': 'Wilson (West Lawn)' };
const canon = (s) => { s = SAME[s] || s; const id = SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const t = fs.readFileSync('data/sources/piaa_duals.csv', 'utf8').split(/\r?\n/).filter(Boolean); const H = t[0].split(',');
const rows = t.slice(1).map((line) => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); const o = {}; H.forEach((h, i) => { o[h] = out[i] || ''; }); return o; });
const D = rows.map((r) => [+r.year, r.cls, r.round, canon(r.winner), +r.winner_d || 0, +r.winner_score, canon(r.loser), +r.loser_d || 0, +r.loser_score, r.note]);
fs.writeFileSync('overtime/duals.js', `window.WR_DUALS=${JSON.stringify(D)};`);
console.log('duals', D.length, 'bouts →', (fs.statSync('overtime/duals.js').size / 1e3).toFixed(0), 'KB');
