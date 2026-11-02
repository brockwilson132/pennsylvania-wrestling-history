/*
 * SchoolLogo: original mascot seals for District 11 programs.
 * Each seal is a round "mat medallion": an outer ring carrying the school name and mascot,
 * a center field in the school's primary color, and an original geometric mascot mark.
 * These are new designs built from each school's colors and mascot name; they do not copy school logos.
 *
 *   SchoolLogo.svg(school, {size, ring:true|false}) -> SVG string, or null when no mark exists
 *   SchoolLogo.has(school) -> boolean
 */
(function (root) {
  'use strict';
  var SB = root.SchoolBadge;

  /* ---- glyphs: drawn in a 100 x 100 box, mark color `c`, detail (cut-out) color `k` ---- */
  var G = {
    eagle: function (c, k) { // raptor head with feathered mane, facing left
      return '<path fill="' + c + '" d="M6 50c2-10 10-16 20-17 8-11 21-17 36-17 13 0 23 5 29 14l-9 5 12 9-12 5 9 12H76l4 14-14-6-6 14c-6-10-10-14-16-18l-12-4c-6 2-12 2-17-2-2-2-3-4-1-6z"/>' +
        '<path fill="' + k + '" d="M24 37l26-6-4 7c-8-1-15 0-22-1z"/><circle cx="38" cy="43" r="4" fill="' + k + '"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.6" stroke-linecap="round" d="M9 55c6 1 13 0 19-3M58 50l14-4M56 60l14-2"/>';
    },
    hawk: function (c, k) { // hawk head with swept-back crest, facing left
      return '<path fill="' + c + '" d="M6 52c2-10 10-16 20-17 6-9 16-15 28-17l6-12 6 10 8-10 2 12 10-8-2 13c6 4 10 10 12 17l-10 3 10 9-12 3 7 12H76l2 14-12-7-6 12c-6-10-10-14-16-18l-12-4c-6 2-12 2-17-2-2-2-3-4-1-6z"/>' +
        '<path fill="' + k + '" d="M24 39l26-6-4 7c-8-1-15 0-22-1z"/><circle cx="38" cy="45" r="4" fill="' + k + '"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.6" stroke-linecap="round" d="M9 57c6 1 13 0 19-3M58 52l14-4M56 62l14-2"/>';
    },
    hardhat: function (c, k) { // Konkrete Kids: hard hat over a stack of block
      return '<path fill="' + c + '" d="M20 54c0-18 13-32 30-32s30 14 30 32h8v8H12v-8z"/>' +
        '<path fill="' + k + '" d="M46 23h8v24h-8zM30 33l6-5 3 22h-7zM70 33l-6-5-3 22h7z" opacity=".9"/>' +
        '<g fill="' + c + '"><rect x="16" y="68" width="32" height="12" rx="1.5"/><rect x="52" y="68" width="32" height="12" rx="1.5"/><rect x="30" y="83" width="40" height="11" rx="1.5"/></g>';
    },
    compass: function (c, k) { // Red Rovers: compass rose
      return '<circle cx="50" cy="50" r="30" fill="none" stroke="' + c + '" stroke-width="4"/>' +
        '<path fill="' + c + '" d="M50 4l8 38 38 8-38 8-8 38-8-38-38-8 38-8z"/>' +
        '<path fill="' + k + '" d="M50 4l8 38-8 8zM96 50l-38 8-8-8zM50 96l-8-38 8-8zM4 50l38-8 8 8z" opacity=".45"/>' +
        '<circle cx="50" cy="50" r="5" fill="' + k + '"/>';
    },
    hurricane: function (c, k) { // Hurricanes: storm swirl with eye
      return '<path fill="' + c + '" d="M50 8c-8 0-17 2-24 7 8-1 15 0 21 3C29 18 14 31 12 48c-2 15 7 30 22 36-5-6-8-13-8-20 9 16 31 23 48 13 14-7 21-23 17-38-1 8-5 15-11 19 2-19-11-37-30-40 6-2 13-2 19 0-8-6-19-9-29-8z"/>' +
        '<circle cx="50" cy="52" r="10" fill="' + k + '"/><circle cx="50" cy="52" r="4.5" fill="' + c + '"/>';
    },
    helmet: function (c, k) { // Trojans / Spartans: crested helmet, front view
      return '<path fill="' + c + '" d="M10 30C12 8 88 8 90 30 80 20 66 15 50 15S20 20 10 30z"/>' +
        '<path fill="' + c + '" d="M50 18c-20 0-33 14-33 32v28l17 12h7V64l4-6h10l4 6v26h7l17-12V50c0-18-13-32-33-32z"/>' +
        '<path fill="' + k + '" d="M27 44h46v8H56v8H44v-8H27z"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.4" d="M24 72l10 8M76 72l-10 8" opacity=".6"/>';
    },
    tricorn: function (c, k) { // Patriots: tricorn hat with a star
      return '<path fill="' + c + '" d="M6 58c10-4 20-14 26-28 6 5 12 7 18 7s12-2 18-7c6 14 16 24 26 28-12 10-28 14-44 14S18 68 6 58z"/>' +
        '<path fill="' + k + '" d="M50 40l3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.1L50 58.7l-7.3 3.8 1.4-8.1-5.9-5.8 8.2-1.2z"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.5" d="M14 60c11 6 23 8 36 8s25-2 36-8" opacity=".6"/>';
    },
    cat: function (c, k) { // Panthers / Cougars / Wildcats: big-cat face
      return '<path fill="' + c + '" d="M14 14l22 14c9-4 19-4 28 0l22-14-4 28c4 7 6 14 5 22-3 18-18 30-37 30S16 82 13 64c-1-8 1-15 5-22z"/>' +
        '<path fill="' + k + '" d="M26 48l16 4-3 6c-6 0-11-4-13-10zM74 48l-16 4 3 6c6 0 11-4 13-10zM42 68h16l-8 8z"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.6" stroke-linecap="round" d="M50 76v6M50 82c-4 4-10 4-14 1M50 82c4 4 10 4 14 1M22 70l12-2M78 70l-12-2M24 78l11-4M76 78l-11-4"/>';
    },
    mountain: function (c, k) { // Mountaineers: twin peaks with snowcaps
      return '<path fill="' + c + '" d="M4 86l30-50 14 22 16-30 32 58z"/>' +
        '<path fill="' + k + '" d="M34 36l-8 14 6-3 4 4 4-6zM64 28l-9 17 6-3 3 5 5-7 4 3z"/>' +
        '<path fill="none" stroke="' + c + '" stroke-width="3" d="M58 14c4-4 10-4 14 0" /><circle cx="78" cy="14" r="5" fill="' + c + '"/>';
    },
    canary: function (c, k) { // Canaries: round songbird, facing left
      return '<path fill="' + c + '" d="M30 26c10-10 30-8 36 6 8 0 18 6 22 16l8 22-14-8c-6 12-20 20-36 18-14-2-24-12-26-24-1-8 2-16 6-22l-12 2 12-8c1-1 2-2 4-2z"/>' +
        '<circle cx="38" cy="36" r="3.6" fill="' + k + '"/><path fill="' + k + '" d="M18 40l10-4 2 6z"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="3" stroke-linecap="round" d="M48 56c8 6 18 6 26 0M52 64c7 4 15 4 21 0" opacity=".7"/>';
    },
    wind: function (c, k) { // Zephyrs: gusting wind
      return '<g fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round">' +
        '<path d="M8 36h50c10 0 16-6 16-13S68 10 60 12"/><path d="M8 54h70c10 0 16 7 16 14s-7 13-15 11"/><path d="M18 72h30"/><path d="M26 20h14"/></g>';
    },
    husky: function (c, k) { // Huskies: dog face with a pale mask
      return '<path fill="' + c + '" d="M16 4l24 22c6-2 14-2 20 0L84 4l2 40c4 6 5 12 4 18-3 18-20 32-40 32S13 80 10 62c-1-6 0-12 4-18z"/>' +
        '<path fill="' + k + '" d="M24 18l10 10-8 8zM76 18l-10 10 8 8z" opacity=".55"/>' +
        '<path fill="' + k + '" d="M50 34c-6 0-10 6-12 12-6-2-12 0-16 4 2 14 12 28 28 36 16-8 26-22 28-36-4-4-10-6-16-4-2-6-6-12-12-12z"/>' +
        '<circle cx="36" cy="50" r="4.2" fill="' + c + '"/><circle cx="64" cy="50" r="4.2" fill="' + c + '"/><path fill="' + c + '" d="M42 64h16l-8 9z"/><path fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" d="M50 73v5"/>';
    },
    hornet: function (c, k) { // Green Hornets: striped hornet, wings up
      return '<path fill="' + c + '" d="M50 30c9 0 15 7 15 16 0 14-7 30-15 46-8-16-15-32-15-46 0-9 6-16 15-16z"/>' +
        '<path fill="' + k + '" d="M36 50h28v6H36zM38 63h24v6H38zM42 76h16v5H42z"/><circle cx="50" cy="22" r="10" fill="' + c + '"/>' +
        '<path fill="' + c + '" opacity=".75" d="M46 38C30 22 10 20 6 30c-3 8 14 16 38 14zM54 38c16-16 36-18 40-8 3 8-14 16-38 14z"/>' +
        '<path fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round" d="M45 14l-8-10M55 14l8-10"/>';
    },
    wave: function (c, k) { // Crimson Tide: cresting wave
      return '<path fill="' + c + '" d="M6 84c6-28 26-56 56-60 18-2 32 8 32 22 0 12-10 18-20 14 6-2 8-8 6-12-4-7-16-8-24-2-14 10-12 30 6 38H6z"/>' +
        '<path fill="none" stroke="' + c + '" stroke-width="5" stroke-linecap="round" d="M6 94h88"/>';
    },
    bear: function (c, k) { // Bears: bear face
      return '<circle cx="22" cy="24" r="13" fill="' + c + '"/><circle cx="78" cy="24" r="13" fill="' + c + '"/><circle cx="22" cy="24" r="6" fill="' + k + '"/><circle cx="78" cy="24" r="6" fill="' + k + '"/>' +
        '<path fill="' + c + '" d="M50 18c22 0 38 16 38 38 0 20-16 36-38 36S12 76 12 56c0-22 16-38 38-38z"/>' +
        '<ellipse cx="50" cy="68" rx="16" ry="12" fill="' + k + '"/><path fill="' + c + '" d="M43 62h14l-7 7z"/><circle cx="37" cy="48" r="4" fill="' + k + '"/><circle cx="63" cy="48" r="4" fill="' + k + '"/>';
    },
    slate: function (c, k) { // Slaters: overlapping roof slates with a hammer
      var p = '';
      [[14, 52], [38, 52], [62, 52], [26, 70], [50, 70], [74, 70]].forEach(function (q) { p += '<path fill="' + c + '" d="M' + q[0] + ' ' + q[1] + 'h22v16c0 2-1 4-3 4H' + (q[0] + 3) + 'c-2 0-3-2-3-4z"/>'; });
      return p + '<path fill="' + c + '" d="M30 12l8-6 30 30-6 6zM58 36l6-6 6 6-14 14-6-6z"/><path fill="' + k + '" d="M36 10l4-3 26 27-3 3z" opacity=".5"/>';
    },
    plume: function (c, k) { // Cavaliers: plumed cavalier hat
      return '<path fill="' + c + '" d="M6 66c12-8 24-12 44-12s32 4 44 12c-14 6-28 8-44 8S20 72 6 66z"/>' +
        '<path fill="' + c + '" d="M26 58c0-16 10-28 24-28s24 12 24 28c-8-2-16-3-24-3s-16 1-24 3z"/>' +
        '<path fill="' + k + '" d="M26 52c8-2 16-3 24-3s16 1 24 3v6c-8-2-16-3-24-3s-16 1-24 3z"/>' +
        '<path fill="' + c + '" opacity=".85" d="M70 40C76 20 92 10 98 14c-4 4-6 10-8 16 4-2 8-2 10 0-6 2-10 6-12 10 3 0 6 1 7 3-8 2-16 2-25-3z"/>';
    },
    shield: function (c, k) { // Crusaders: shield with cross
      return '<path fill="' + c + '" d="M50 6l38 12v26c0 24-16 42-38 50C28 86 12 68 12 44V18z"/>' +
        '<path fill="' + k + '" d="M44 22h12v20h20v12H56v30H44V54H24V42h20z"/>';
    },
    cardinal: function (c, k) { // Cardinals: crested songbird, facing left
      return '<path fill="' + c + '" d="M66 4L56 22c12 4 20 14 20 26l18 18-20-2c-4 14-18 26-36 26 9-8 13-17 13-27-8 4-17 4-25-1l-15 3 8-11c-2-6-2-12 1-18L4 30l16-3c6-9 17-13 28-11z"/>' +
        '<path fill="' + k + '" d="M20 28c6 5 13 7 20 5-2 9-11 14-21 11z"/><path fill="' + c + '" d="M6 33l13-5 2 8z"/><circle cx="34" cy="31" r="3" fill="' + c + '"/>' +
        '<path fill="none" stroke="' + k + '" stroke-width="2.6" stroke-linecap="round" d="M50 54c8 2 15 0 20-5M48 64c8 2 16 0 22-6" opacity=".7"/>';
    },
    viking: function (c, k) { // Vikings: horned helmet
      return '<path fill="' + c + '" d="M50 24c20 0 34 14 34 32v12H16V56c0-18 14-32 34-32z"/>' +
        '<path fill="' + c + '" d="M18 52C8 46 4 32 8 16c4 12 12 20 22 24zM82 52c10-6 14-20 10-36-4 12-12 20-22 24z"/>' +
        '<path fill="' + k + '" d="M44 26h12v42H44zM16 66h68v6H16z" opacity=".85"/><path fill="' + c + '" d="M14 74h72v10H14z"/>' +
        '<g fill="' + k + '"><circle cx="26" cy="79" r="2.4"/><circle cx="50" cy="79" r="2.4"/><circle cx="74" cy="79" r="2.4"/></g>';
    },
    arrows: function (c, k) { // Lehighton: crossed arrows chevron mark (no tribal imagery)
      return '<g fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round"><path d="M18 82L82 18M82 82L18 18"/></g>' +
        '<path fill="' + c + '" d="M88 12L66 18l16 16zM12 12l22 6-16 16z"/><path fill="' + c + '" d="M10 90l4-16 12 12zM90 90l-4-16-12 12z"/>';
    }
  };

  var MAP = {
    'Nazareth': { g: 'eagle', name: 'NAZARETH', mascot: 'BLUE EAGLES' },
    'Northampton': { g: 'hardhat', name: 'NORTHAMPTON', mascot: 'KONKRETE KIDS' },
    'Easton': { g: 'compass', name: 'EASTON', mascot: 'RED ROVERS' },
    'Bethlehem Catholic': { g: 'hawk', name: 'BETHLEHEM CATHOLIC', mascot: 'GOLDEN HAWKS', field: 'secondary' },
    'Bethlehem Liberty': { g: 'hurricane', name: 'LIBERTY', mascot: 'HURRICANES' },
    'Parkland': { g: 'helmet', name: 'PARKLAND', mascot: 'TROJANS' },
    'Bethlehem Freedom': { g: 'tricorn', name: 'FREEDOM', mascot: 'PATRIOTS' },
    'Saucon Valley': { g: 'cat', name: 'SAUCON VALLEY', mascot: 'PANTHERS' },
    'Stroudsburg': { g: 'mountain', name: 'STROUDSBURG', mascot: 'MOUNTAINEERS' },
    'William Allen': { g: 'canary', name: 'WILLIAM ALLEN', mascot: 'CANARIES', field: 'secondary' },
    'Blue Mountain': { g: 'eagle', name: 'BLUE MOUNTAIN', mascot: 'EAGLES' },
    'Whitehall': { g: 'wind', name: 'WHITEHALL', mascot: 'ZEPHYRS' },
    'Allentown Dieruff': { g: 'husky', name: 'DIERUFF', mascot: 'HUSKIES' },
    'Emmaus': { g: 'hornet', name: 'EMMAUS', mascot: 'GREEN HORNETS' },
    'Pottsville': { g: 'wave', name: 'POTTSVILLE', mascot: 'CRIMSON TIDE' },
    'Pleasant Valley': { g: 'bear', name: 'PLEASANT VALLEY', mascot: 'BEARS' },
    'Bangor': { g: 'slate', name: 'BANGOR', mascot: 'SLATERS' },
    'East Stroudsburg South': { g: 'plume', name: 'EAST STROUDSBURG SOUTH', mascot: 'CAVALIERS' },
    'East Stroudsburg': { g: 'plume', name: 'EAST STROUDSBURG', mascot: 'CAVALIERS' },
    'Lehighton': { g: 'arrows', name: 'LEHIGHTON', mascot: 'DISTRICT XI' },
    'Southern Lehigh': { g: 'helmet', name: 'SOUTHERN LEHIGH', mascot: 'SPARTANS' },
    'Notre Dame-Green Pond': { g: 'shield', name: 'NOTRE DAME', mascot: 'CRUSADERS' },
    'Pocono Mountain': { g: 'cardinal', name: 'POCONO MOUNTAIN', mascot: 'CARDINALS' },
    'Pocono Mountain East': { g: 'cardinal', name: 'POCONO MTN EAST', mascot: 'CARDINALS' },
    'Pocono Mountain West': { g: 'cat', name: 'POCONO MTN WEST', mascot: 'PANTHERS' },
    'Allentown Central Catholic': { g: 'viking', name: 'CENTRAL CATHOLIC', mascot: 'VIKINGS' },
    'Hazleton Area': { g: 'cat', name: 'HAZLETON AREA', mascot: 'COUGARS' },
    'West Hazleton': { g: 'cat', name: 'WEST HAZLETON', mascot: 'WILDCATS' }
  };

  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(h) { var c = hexToRgb(h).map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { var p = hexToRgb(a), q = hexToRgb(b); return '#' + [0, 1, 2].map(function (i) { var v = Math.round(p[i] + (q[i] - p[i]) * t); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var uid = 0;

  function resolveName(school) {
    if (MAP[school]) return school;
    var id = SB && SB.identity(school);
    return id && MAP[id.school] ? id.school : null;
  }

  function svg(school, opts) {
    opts = opts || {};
    var key = resolveName(school);
    if (!key) return null;
    var m = MAP[key];
    var id = SB.identity(key) || { primary: '#334155', secondary: '#e2e8f0' };
    var P = id.primary.toLowerCase(), S = (id.secondary || '#ffffff').toLowerCase(), A = id.accent ? id.accent.toLowerCase() : null;
    var field = m.field === 'secondary' ? S : P;
    var other = m.field === 'secondary' ? P : S;
    // mark color: the school's other color if it reads on the field, else white/ink
    var mark = contrast(other, field) >= 2.2 ? other : (A && contrast(A, field) >= 2.2 ? A : (contrast('#ffffff', field) > contrast('#101418', field) ? '#ffffff' : '#101418'));
    var cut = field;
    // ring: a deep version of the primary; text reads on it
    var ring = lum(P) < 0.06 ? mix(P, '#ffffff', 0.08) : mix(P, '#05070c', 0.55);
    if (m.field === 'secondary') ring = lum(P) < 0.06 ? P : mix(P, '#05070c', 0.35);
    var ringText = '#ffffff';
    var trim = contrast(S, ring) >= 2 ? S : (contrast(P, ring) >= 2 ? P : '#ffffff');
    if (trim === ringText && A && contrast(A, ring) >= 2) trim = A;
    var size = opts.size || 96;
    var n = ++uid;
    var top = esc(m.name), bot = esc(m.mascot);
    var fs = Math.min(11.2, 150 / Math.max(10, m.name.length)) ;
    var fsb = Math.min(10, 130 / Math.max(10, m.mascot.length));
    var ringOn = opts.ring !== false;
    var small = size < 46;
    var g = G[m.g](mark, cut);
    var out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 120 120" role="img" aria-label="' + esc(key) + ' ' + esc(m.mascot.toLowerCase()) + ' seal">';
    out += '<defs><path id="t' + n + '" d="M17 60a43 43 0 0 1 86 0"/><path id="b' + n + '" d="M14 60a46 46 0 0 0 92 0"/>' +
      '<radialGradient id="g' + n + '" cx="40%" cy="32%" r="75%"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".22"/></radialGradient></defs>';
    if (ringOn && small) {
      out += '<circle cx="60" cy="60" r="58" fill="' + ring + '" stroke="' + mix(ring, '#000000', 0.4) + '" stroke-width="3"/>';
    } else if (ringOn) {
      out += '<circle cx="60" cy="60" r="58.5" fill="' + ring + '" stroke="' + mix(ring, '#000000', 0.4) + '" stroke-width="1.5"/>';
      out += '<circle cx="60" cy="60" r="55" fill="none" stroke="' + trim + '" stroke-width="1.2" opacity=".85"/>';
      out += '<text font-family="Arial Narrow, Roboto Condensed, Arial, sans-serif" font-weight="800" font-size="' + fs.toFixed(1) + '" letter-spacing="1.2" fill="' + ringText + '" text-anchor="middle"><textPath href="#t' + n + '" startOffset="50%">' + top + '</textPath></text>';
      out += '<text font-family="Arial Narrow, Roboto Condensed, Arial, sans-serif" font-weight="700" font-size="' + fsb.toFixed(1) + '" letter-spacing="1.4" fill="' + trim + '" text-anchor="middle" dominant-baseline="hanging"><textPath href="#b' + n + '" startOffset="50%">' + bot + '</textPath></text>';
      out += '<g fill="' + trim + '"><path d="M6.5 60l3-3 3 3-3 3z"/><path d="M107.5 60l3-3 3 3-3 3z"/></g>';
    }
    var R = !ringOn ? 58 : small ? 50 : 40;
    out += '<circle cx="60" cy="60" r="' + R + '" fill="' + field + '" stroke="' + trim + '" stroke-width="' + (ringOn ? 2.5 : 3) + '"/>';
    // mat starting lines, faint, behind the mark
    out += '<g opacity=".16" fill="' + mark + '"><rect x="' + (60 - R * 0.55) + '" y="58.5" width="' + (R * 0.5) + '" height="3"/><rect x="' + (60 + R * 0.05) + '" y="58.5" width="' + (R * 0.5) + '" height="3"/></g>';
    var sc = (R * 1.32) / 100;
    out += '<g transform="translate(' + (60 - 50 * sc) + ' ' + (60 - 50 * sc) + ') scale(' + sc.toFixed(3) + ')">' + g + '</g>';
    out += '<circle cx="60" cy="60" r="' + R + '" fill="url(#g' + n + ')"/>';
    out += '</svg>';
    return out;
  }

  root.SchoolLogo = { svg: svg, has: function (s) { return !!resolveName(s); }, list: function () { return Object.keys(MAP); } };
})(typeof window !== 'undefined' ? window : this);
