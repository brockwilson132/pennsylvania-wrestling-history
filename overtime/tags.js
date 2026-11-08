/* Overtime — school name tag colours, shared by the app (index.html) and the colour editor (colors.html).
   A tag is a pill filled with one colour, a dot in a second and the name in a third. Brock's sets live in
   schoolcolors.js (window.OT_COLORS: sets id -> [fill, dot, text], schools name -> set id), written by the editor.
   A school without a set snaps its badge file colours (badges.js) to the presets below; with neither it is grey. */
'use strict';
(() => {
  const PRESETS = {
    red: '#C8102E', maroon: '#7A1E2C', orange: '#E87722', gold: '#C9A227', yellow: '#FFD200', green: '#15803D', dkgreen: '#0B4D2C',
    royal: '#1F4E9C', navy: '#1B2A4A', ltblue: '#7EC8F2', purple: '#4B2E83', brown: '#4E2A1E', grey: '#8A8D8F', white: '#FFFFFF', black: '#111111',
  };
  const NONE = { fill: '#2A3038', acc: '#4A5360', ink: '#EEEAE1', none: true };
  const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const relLum = (h) => { const c = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const READS = 3.8;   // tags are bold condensed caps: 3.8:1 keeps Emmaus gold-on-green (3.9) and drops grey-on-red (1.8)
  const PK = Object.entries(PRESETS);
  const nearestKey = (h) => { const [r, g, b] = hexRgb(h); let best = 'grey', bd = Infinity;
    PK.forEach(([k, m]) => { const [R, G, B] = hexRgb(m); const d = 2 * (r - R) ** 2 + 4 * (g - G) ** 2 + 3 * (b - B) ** 2; if (d < bd) { bd = d; best = k; } }); return best; };
  /* fill, dot and text from colours in order (main first): the text is the first later colour that reads on the fill */
  const fromColours = (hs) => { const fill = hs[0], acc = hs[1] || hs[0];
    const ink = hs.slice(1).find((c) => contrast(fill, c) >= READS) || (contrast(fill, '#FFFFFF') >= contrast(fill, '#000000') ? '#FFFFFF' : '#000000');
    return { fill, acc, ink }; };
  const AUTO = new Map();
  /* a school with no set: its badge colours snapped to the presets, or grey */
  function auto(sch) {
    if (AUTO.has(sch)) return AUTO.get(sch);
    const id = typeof window !== 'undefined' && window.SchoolBadge && window.SchoolBadge.identity(sch); let p = NONE;
    if (id && id.primary) { const ks = [id.primary, id.secondary, id.accent].filter(Boolean).map(nearestKey).filter((k, i, a) => a.indexOf(k) === i); p = fromColours(ks.map((k) => PRESETS[k])); }
    AUTO.set(sch, p); return p;
  }
  const data = () => (typeof window !== 'undefined' && window.OT_COLORS) || { swatches: [], sets: {}, schools: {} };
  /* the paint for one school (doc: an editor working copy; default the published file) */
  function paint(sch, doc) { const d = doc || data(), id = d.schools[sch], s = id && d.sets[id];
    return s ? { fill: s[0], acc: s[1], ink: s[2], set: id } : auto(sch); }
  /* schoolcolors.js as text: one set or school per line, so every edit is a small readable diff */
  function serialize(d) {
    const J = JSON.stringify, sets = Object.keys(d.sets), sch = Object.keys(d.schools).sort((a, b) => a.localeCompare(b));
    return '/* School name tag colours, written by the colour editor (colors.html). sets: id -> [fill, dot, text]; schools: name -> set id. */\n'
      + 'window.OT_COLORS = {\n"swatches": [' + d.swatches.map((h) => J(h)).join(', ') + '],\n'
      + '"sets": {\n' + sets.map((k) => J(k) + ': [' + d.sets[k].map((h) => J(h)).join(', ') + ']').join(',\n') + '\n},\n'
      + '"schools": {\n' + sch.map((k) => J(k) + ': ' + J(d.schools[k])).join(',\n') + '\n}\n};\n';
  }
  const parse = (txt) => JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  const api = { PRESETS, NONE, READS, contrast, fromColours, auto, paint, serialize, parse };
  if (typeof window !== 'undefined') window.OTTags = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
