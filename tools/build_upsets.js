/* All-time upset lists for the app (overtime/upsets.json).
 *   node tools/build_upsets.js
 * An upset: a win over a wrestler rated 1500 or better (an average state qualifier) going in, where the winner's odds
 * from both ratings up to that bout were under 25%. Forfeits, injury defaults, DQs and medical defaults don't count.
 * The winner must have at least MIN_PRIOR rated bouts behind him (earlier seasons, or earlier rounds that season): a
 * wrestler's first bouts sit at the starting prior, which says nothing about him, so a win there is not an upset.
 * Ratings per bout come from data/difficulty/bout_rtg.csv (tools/ratings.py); names and schools from bouts.csv.
 *   top     the 200 biggest upsets at any level      finals  the 100 biggest in state finals
 *   states  the 100 biggest at states                killers the 100 wrestlers with the most upset wins
 *   all     every upset, biggest first (the Records list in Rankings scopes it to a district, region or school)
 * overtime/upsets/<year>.json: the bolt on bracket bouts, { bkey: [[side, round, winner], ...] }. Same rule without the
 *   1500 floor on the loser, so a district bracket shows its own upsets; every Records upset is also a bracket upset.
 * Row: [year, cls, level, unit, weight, side, round, winner, winnerSchool, loser, loserSchool, result, score, flags, preW, preL]
 */
'use strict';
const fs = require('fs'), path = require('path');
const { bkeyOf } = require('./bkey');
const OV = path.join(__dirname, '..', 'overtime'), DB = path.join(__dirname, '..', 'data', 'brackets'), DD = path.join(__dirname, '..', 'data', 'difficulty');
global.window = {}; (0, eval)(fs.readFileSync(path.join(OV, 'badges.js'), 'utf8'));
const SB = window.SchoolBadge, SAME = { Allentown: 'William Allen', Allen: 'William Allen' };
const canon = (s) => { const id = SB && SB.identity(s); const n = id ? id.school : s; return SAME[n] || n; };
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const csv = (line) => { const o = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; };
const read = (f) => { const L = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); const h = csv(L[0]); return L.slice(1).map((l) => { const v = csv(l), o = {}; h.forEach((k, i) => { o[k] = v[i] || ''; }); return o; }); };
const odds = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const MIN_LOSER = 1500, MAX_ODDS = 0.25, MIN_PRIOR = 3;

const R = new Map();
read(path.join(DD, 'bout_rtg.csv')).forEach((r) => { if (r.pre_w === '' || r.pre_l === '') return; R.set([r.level, r.tournament, r.weight, r.side, r.round, nkey(r.winner), nkey(r.loser)].join('|'), [+r.pre_w, +r.pre_l]); });
const ups = [], BR = {};
/* bouts in the order they were wrestled: season, then section < district < regional < state, then the round (a higher
   round number is earlier), championship side before consolations */
const LV = { section: 0, district: 1, regional: 2, state: 3 }, SIDE = (s) => (s === 'champ' ? 0 : 1);
const B = read(path.join(DB, 'bouts.csv')).sort((a, b) => a.year - b.year || LV[a.level] - LV[b.level] || b.round - a.round || SIDE(a.side) - SIDE(b.side));
const seen = new Map(); const bump = (k) => { const n = seen.get(k) || 0; seen.set(k, n + 1); return n; };
B.forEach((b) => {
  if (['ff', 'inj', 'dq', 'med'].includes(b.result)) return;
  const kw = nkey(b.winner) + '|' + canon(b.winner_school), kl = nkey(b.loser) + '|' + canon(b.loser_school);
  const priorW = bump(kw); bump(kl); if (priorW < MIN_PRIOR) return;
  const pre = R.get([b.level, b.tournament, b.weight, b.side, b.round, nkey(b.winner), nkey(b.loser)].join('|')); if (!pre) return;
  const [pw, pl] = pre; const p = odds(pw, pl); if (p >= MAX_ODDS) return;
  const Y = BR[b.year] || (BR[b.year] = {}), k = bkeyOf(b.level, b.tournament, b.weight); (Y[k] || (Y[k] = [])).push([b.side, +b.round, b.winner]);
  if (pl < MIN_LOSER) return;
  ups.push({ p, row: [+b.year, b.cls, b.level, b.level === 'state' ? '' : b.unit, b.weight, b.side, +b.round, b.winner, canon(b.winner_school), b.loser, canon(b.loser_school), b.result, b.score, b.flags, pw, pl] });
});
ups.sort((a, b) => a.p - b.p);
const rows = (L, n) => L.slice(0, n).map((u) => u.row);
const top = rows(ups, 200), states = rows(ups.filter((u) => u.row[2] === 'state'), 100), finals = rows(ups.filter((u) => u.row[2] === 'state' && u.row[5] === 'champ' && u.row[6] === 0), 100);
/* giant killers: upset wins per wrestler (name + school; a transfer counts at each school) */
const K = new Map();
ups.forEach((u) => { const [year, , , , , , , w, ws] = u.row; const k = nkey(w) + '|' + ws; const x = K.get(k) || { name: w, sch: ws, n: 0, best: 1, y0: year, y1: year, big: 0 }; x.n++; x.best = Math.min(x.best, u.p); x.y0 = Math.min(x.y0, year); x.y1 = Math.max(x.y1, year); if (u.row[2] === 'state') x.big++; K.set(k, x); });
const killers = Array.from(K.values()).sort((a, b) => b.n - a.n || a.best - b.best).slice(0, 100).map((x) => [x.name, x.sch, x.n, Math.round(1000 * x.best) / 1000, x.y0, x.y1, x.big]);
const out = { minLoser: MIN_LOSER, maxOdds: MAX_ODDS, minPrior: MIN_PRIOR, n: ups.length, top, states, finals, killers, all: rows(ups, ups.length) };
fs.writeFileSync(path.join(OV, 'upsets.json'), JSON.stringify(out));
fs.mkdirSync(path.join(OV, 'upsets'), { recursive: true }); let nb = 0, bb = 0;
Object.entries(BR).forEach(([y, o]) => { const t = JSON.stringify(o); bb += t.length; nb += Object.values(o).reduce((a, v) => a + v.length, 0); fs.writeFileSync(path.join(OV, 'upsets', y + '.json'), t); });
console.log('bracket upsets', nb, 'in', Object.keys(BR).length, 'season files', (bb / 1e6).toFixed(2), 'MB');
console.log('upsets', ups.length, 'of', R.size, 'rated bouts; top odds', ups[0] && ups[0].p.toFixed(3), 'bytes', fs.statSync(path.join(OV, 'upsets.json')).size);
console.log('giant killers', killers.slice(0, 5).map((k) => `${k[0]} (${k[1]}) ${k[2]}`).join('; '));
