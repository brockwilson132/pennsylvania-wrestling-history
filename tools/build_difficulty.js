#!/usr/bin/env node
/* Rating data for the Overtime app, from tools/ratings.py output and the parsed bouts (method: docs/DIFFICULTY.md, v2).
 *
 *   overtime/sos.js            window.WR_SOS = { year: { "cls.l.unit.wn": [field10, "nk8:rating10,..."] } }   l = s / r / d
 *                              window.WR_RTG_META = { field: { district, regional, state }, lo, hi }  (typical field per level, gauge range)
 *                              rating10 = Overtime Rating / 10 (1500 = the average state qualifier); field10 = the bracket's top-8 mean / 10
 *                              eager: every bracket's field; the rating of every state entrant and district/regional medalist
 *   overtime/sos/<year>.json   lazy, per season: { bkey: { s: { nkey: [rating, bestWin, bestWinName, badLosses] }, b: [[side, round, winner, loser, result, score, flags], ...] } }
 *                              every entrant's rating and quality of wins in that tournament, and every bout, for the bracket view and the wrestler page
 *   (file names kept from v1, when these held 0-99 strength-of-schedule values)
 *
 * bkey matches the app: state  `${year}.${cls}.state.${wn}`, lower `${year}.${cls}.${lvl}.${unit}.${wn}`
 * Usage (repo root): node tools/build_difficulty.js
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const read = (f) => (f.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8'));
function csv(f) {
  const text = read(f); const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const h = rows.shift(); return rows.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const nkey = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const wNum = (w) => (w === 'UNL' || w === 'HWT' || w === 'Hwt' ? 999 : +w);
const D1 = new Set(['North', 'South', 'Central', 'East', 'West']);
const REGION = { North_East: 'NE', North_West: 'NW', South_Central: 'SC', South_East: 'SE', South_West: 'SW', West: 'W', East: 'E', Central_North_West: 'CNW' };
function unitCls(level, tournament) {
  const year = +tournament.slice(0, 4), rest = tournament.slice(5);
  if (level === 'state') { const c = { A: 'AAA', B: 'AA' }[rest] || rest; return { year, unit: 'PIAA', cls: c === 'AAA' || c === 'AA' ? c : 'single' }; }
  const parts = rest.split('_'); let cls = parts.pop(), unit = parts.join('_');
  if (/Super$|Sub$/.test(cls)) { const suf = cls; cls = parts.pop(); unit = parts.join('_') + '_' + suf; }
  if (unit === 'D1_AAA' && D1.has(cls)) { unit = 'D1_' + cls; cls = 'AAA'; }
  cls = { A: 'AAA', B: 'AA' }[cls] || cls; unit = REGION[unit] || unit;
  return { year, unit, cls: cls === 'AAA' || cls === 'AA' ? cls : 'single' };
}
const bkeyOf = (level, tournament, weight) => { const u = unitCls(level, tournament); return level === 'state' ? `${u.year}.${u.cls}.state.${wNum(weight)}` : `${u.year}.${u.cls}.${level}.${u.unit}.${wNum(weight)}`; };

// medalists / state entrants: who the eager file needs
const eager = new Set();
csv('data/brackets/lower_entrants.csv').forEach((r) => { if (r.place) eager.add(bkeyOf(r.level, r.tournament, r.weight) + '|' + nkey(r.name)); });

const F = {}; const FL = { district: [], regional: [], state: [] };
csv('data/difficulty/brackets.csv').forEach((r) => { if (r.field === '') return; F[bkeyOf(r.level, r.tournament, r.weight)] = Math.round(+r.field / 10); if (+r.year >= 1980) FL[r.level].push(+r.field); });
const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const pct = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };
const all = FL.district.concat(FL.regional, FL.state);
const META = { field: { district: Math.round(med(FL.district)), regional: Math.round(med(FL.regional)), state: Math.round(med(FL.state)) }, lo: Math.floor(pct(all, 0.02) / 50) * 50, hi: Math.ceil(pct(all, 0.998) / 50) * 50 };
const P = {}, LAZY = {};
const wsFile = fs.existsSync('data/difficulty/wrestler_seasons.csv') ? 'data/difficulty/wrestler_seasons.csv' : 'data/difficulty/wrestler_seasons.csv.gz';
csv(wsFile).forEach((r) => {
  if (r.season === '') return;
  const k = bkeyOf(r.level, r.tournament, r.weight), n = nkey(r.name), y = +r.year;
  if (r.level === 'state' || eager.has(k + '|' + n)) (P[k] || (P[k] = [])).push(n + ':' + Math.round(+r.season / 10));
  const Y = LAZY[y] || (LAZY[y] = {}); const B = Y[k] || (Y[k] = { s: {}, b: [] });
  B.s[n] = [Math.round(+r.season), r.best === "" ? null : +r.best, r.best_name || null, +r.bad || 0];
});
csv('data/brackets/bouts.csv').forEach((b) => {
  const k = bkeyOf(b.level, b.tournament, b.weight), y = +b.year;
  const Y = LAZY[y] || (LAZY[y] = {}); const B = Y[k] || (Y[k] = { s: {}, b: [] });
  B.b.push([b.side, +b.round, b.winner, b.loser, b.result, b.score, b.flags]);
});
const nk8 = (n) => (n.length <= 8 ? n : n.slice(0, 5) + n.slice(-3));
const OUT = {}; const L1 = { state: 's', regional: 'r', district: 'd' };
new Set([...Object.keys(F), ...Object.keys(P)]).forEach((k) => {
  const p = k.split('.'); const y = p[0], lvl = p[2]; const short = lvl === 'state' ? `${p[1]}.s..${p[3]}` : `${p[1]}.${L1[lvl]}.${p[3]}.${p[4]}`;
  (OUT[y] || (OUT[y] = {}))[short] = [F[k] ?? null, (P[k] || []).map((e) => { const [n, v] = e.split(':'); return nk8(n) + ':' + v; }).join(',')];
});
fs.writeFileSync('overtime/sos.js', 'window.WR_SOS=' + JSON.stringify(OUT) + ';\nwindow.WR_RTG_META=' + JSON.stringify(META) + ';\n');
fs.mkdirSync('overtime/sos', { recursive: true });
let lazyBytes = 0;
Object.entries(LAZY).forEach(([y, obj]) => { const s = JSON.stringify(obj); lazyBytes += s.length; fs.writeFileSync(`overtime/sos/${y}.json`, s); });
console.log('field medians', META, 'sos.js', (fs.statSync('overtime/sos.js').size / 1e6).toFixed(2), 'MB;', Object.keys(F).length, 'brackets;', Object.values(P).reduce((a, v) => a + v.length, 0), 'eager paths;',
  Object.keys(LAZY).length, 'season files', (lazyBytes / 1e6).toFixed(1), 'MB');
