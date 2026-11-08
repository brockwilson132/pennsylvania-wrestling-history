#!/usr/bin/env python3
"""School colour research -> overtime/schoolresearch.js (suggestions shown in the colour editor, colors.html).

Input: data/colors/research/batch_*.json, one object per school written by the research agents:
  {school, identified_as, colors: [{name, hex, hex_from}], mascot, confidence, wikipedia, sources, era, notes}

Each colour gets one hex, and the file records where it came from:
  s  the agent read a hex on the school's own site or brand guide
  w  the school's Wikipedia infobox gives an explicit hex ({{color box|#c4b454}}); CSS colour words there
     ({{color box|navy}}) are an editor's generic pick, so they count as a name, not a shade
  n  only a colour name was found: the standard shade for that name below (the editor's own swatches where
     one fits), so the same name always gives the same colour
Wikipedia pages are cached in data/colors/research/wiki_cache.json (delete it to refetch).

Output: window.OT_RESEARCH = {school: {c: [[name, hex, s|w|n], ...], q: 3|2|1, m: mascot, w: wiki title,
  s: [source urls], e: era note, x: notes}}. Only the editor loads it; the app never does.
"""
import glob, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RDIR = os.path.join(ROOT, 'data', 'colors', 'research')
CACHE = os.path.join(RDIR, 'wiki_cache.json')
OUT = os.path.join(ROOT, 'overtime', 'schoolresearch.js')

# standard shade per colour name: the editor's swatches (overtime/schoolcolors.js) where one fits
STD = {
    'red': '#C8102E', 'scarlet': '#BB0000', 'cardinal': '#9D2235', 'crimson': '#9E1B32', 'cherry': '#C8102E',
    'maroon': '#7A1E2C', 'burgundy': '#7A1E2C', 'garnet': '#73000A', 'wine': '#722F37',
    'orange': '#E87722', 'burnt orange': '#BF5700',
    'gold': '#C9A227', 'old gold': '#CFB53B', 'vegas gold': '#C5B358', 'athletic gold': '#FFB81C', 'bright gold': '#FFC72C',
    'yellow': '#FFD200',
    'green': '#15803D', 'kelly green': '#00843D', 'dark green': '#0B4D2C', 'forest green': '#0B4D2C', 'hunter green': '#0B4D2C',
    'teal': '#00808C',
    'blue': '#1F4E9C', 'royal blue': '#1F4E9C', 'royal': '#1F4E9C', 'navy': '#1B2A4A', 'navy blue': '#1B2A4A', 'dark blue': '#1B2A4A',
    'columbia blue': '#7EC8F2', 'carolina blue': '#7EC8F2', 'light blue': '#7EC8F2', 'sky blue': '#7EC8F2', 'powder blue': '#7EC8F2',
    'purple': '#4B2E83', 'violet': '#4B2E83',
    'brown': '#4E2A1E',
    'gray': '#8A8D8F', 'grey': '#8A8D8F', 'silver': '#A7A9AC', 'steel gray': '#708090', 'steel grey': '#708090',
    'white': '#FFFFFF', 'black': '#111111',
}
CONF = {'high': 3, 'medium': 2, 'low': 1}


def std(name):
    k = re.sub(r'\s+', ' ', name.lower().replace('-', ' ')).strip()
    if k in STD:
        return STD[k]
    for w in sorted(STD, key=len, reverse=True):   # "Bright Kelly Green" -> kelly green
        if re.search(r'\b' + w + r'\b', k):
            return STD[w]
    return None


def fetch(title):
    u = 'https://en.wikipedia.org/w/index.php?' + urllib.parse.urlencode({'title': title, 'action': 'raw', 'redirect': 'yes'})
    for wait in (1, 4, 15, 40):
        try:
            time.sleep(0.4)
            return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'overtime-colours/1.0'}), timeout=20).read().decode('utf8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ''
            if e.code != 429:
                raise
            time.sleep(wait)
    raise RuntimeError('rate limited')


def wiki_colours(title, cache):
    """the infobox colours field of a Wikipedia page ('' when it has none), cached"""
    if title in cache:
        return cache[title]
    try:
        t = fetch(title)
        m = re.match(r'#REDIRECT\s*\[\[([^\]|#]+)', t, re.I)
        if m:
            t = fetch(m.group(1).strip())
    except Exception as e:  # noqa: BLE001 - offline: no infobox hex this run, try again next run
        print('  wiki fetch failed:', title, e, file=sys.stderr)
        return ''
    m = re.search(r'\|\s*(?:school_)?colou?rs?\s*=\s*(.*?)(?=\n\s*\|\s*[a-z_ ]+\s*=|\n\}\})', t, re.I | re.S)
    cache[title] = m.group(1).strip() if m else ''
    return cache[title]


def infobox_hex(field):
    """the colour boxes in an infobox colours field, in order"""
    return [b.strip() for b in re.findall(r'\{\{\s*colou?r ?box\s*\|\s*([^|}]+)', field or '', re.I)]


def wiki_title(x):
    if x.get('wikipedia'):
        return x['wikipedia']
    for s in x.get('sources') or []:
        if 'en.wikipedia.org/wiki/' in s and not s.startswith('search:'):
            return urllib.parse.unquote(s.split('/wiki/')[1]).replace('_', ' ')
    return None


def main():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    out, missing = {}, set()
    for f in sorted(glob.glob(os.path.join(RDIR, 'batch_*.json'))):
        for x in json.load(open(f)):
            title = wiki_title(x)
            boxes = infobox_hex(wiki_colours(title, cache)) if title else []
            cols = x.get('colors') or []
            # pair infobox boxes with colour names by position only when the counts agree
            wh = [b if re.fullmatch(r'#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?', b) else None for b in boxes] if len(boxes) == len(cols) else [None] * len(cols)
            c = []
            for col, w in zip(cols, wh):
                h, src = col.get('hex'), 's' if col.get('hex_from') == 'school-site' else 'w' if col.get('hex') else None
                if not h and w:
                    h, src = w, 'w'
                if not h:
                    h, src = std(col['name']), 'n'
                if not h:
                    missing.add(col['name'])
                    continue
                if len(h) == 4:
                    h = '#' + ''.join(ch * 2 for ch in h[1:])
                c.append([col['name'], h.upper(), src])
            out[x['school']] = {k: v for k, v in {
                'c': c, 'q': CONF.get(x.get('confidence'), 1), 'm': x.get('mascot'), 'w': title,
                's': [s for s in (x.get('sources') or []) if s], 'e': x.get('era'), 'x': x.get('notes'),
            }.items() if v}
    json.dump(cache, open(CACHE, 'w'), indent=0, sort_keys=True, ensure_ascii=False)
    J = lambda v: json.dumps(v, ensure_ascii=False)
    body = ',\n'.join(J(k) + ': ' + J(out[k]) for k in sorted(out))
    open(OUT, 'w').write('/* School colour research (tools/build_colour_research.py): suggestions for the colour editor only. '
                         'c: [name, hex, s=school site | w=Wikipedia hex | n=standard shade for the name]; q: 3 high, 2 medium, 1 low. */\n'
                         'window.OT_RESEARCH = {\n' + body + '\n};\n')
    n = len(out)
    print(f'{n} schools, {sum(1 for v in out.values() if v.get("c"))} with colours;',
          'by confidence', {q: sum(1 for v in out.values() if v.get('q') == q) for q in (3, 2, 1)},
          '; hex from', {s: sum(1 for v in out.values() for c in v.get('c', []) if c[2] == s) for s in 'swn'})
    if missing:
        print('colour names with no standard shade (add to STD):', sorted(missing))


if __name__ == '__main__':
    main()
