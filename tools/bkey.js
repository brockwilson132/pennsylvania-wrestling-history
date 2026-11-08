/* Bracket keys shared by the build scripts; they match the app's OT.bkey:
 *   state `${year}.${cls}.state.${wn}`, lower `${year}.${cls}.${lvl}.${unit}.${wn}` */
'use strict';
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
module.exports = { wNum, unitCls, bkeyOf };
