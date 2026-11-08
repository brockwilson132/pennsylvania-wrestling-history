#!/usr/bin/env python3
"""School colour research -> overtime/schoolresearch.js (suggestions shown in the colour editor, colors.html).

Input, one object per school written by the research agents:
  data/colors/research/batch_*.json  pass 1, names from Wikipedia and search results
  data/colors/research/photo_*.json  pass 2, the agents looked at each school's logo, site and photos (wins over pass 1)
  {school, identified_as, colors: [{name, hex, hex_from}], mascot, confidence, wikipedia, sources, era, notes, evidence}

Each colour gets one hex, and the file records where it came from:
  l  sampled from the school's logo (pixels), p  from a clean graphic in a photo
  s  the school's own site theme or brand guide
  w  the school's Wikipedia infobox gives an explicit hex ({{color box|#c4b454}}); CSS colour words there
     ({{color box|navy}}) and their web hex twins (#000080, #0000FF ...) are an editor's generic pick, so they count
     as a name, not a shade
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
    'white': '#FFFFFF', 'black': '#111111', 'cerise': '#DE3163', 'steel': '#708090',
}
CONF = {'high': 3, 'medium': 2, 'low': 1}
FROM = {'logo': 'l', 'photo': 'p', 'school-site': 's', 'wikipedia-infobox': 'w'}
# the hex of CSS colour words: an infobox hex equal to one of these is a generic web colour, not the school's shade
WEB = {'#000080', '#0000FF', '#4169E1', '#800000', '#FF0000', '#008000', '#00FF00', '#FFD700', '#FFFF00', '#C0C0C0', '#808080',
       '#ADD8E6', '#87CEEB', '#FFA500', '#800080', '#A52A2A', '#DC143C', '#B22222', '#228B22', '#006400', '#00008B', '#191970'}


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
    out, missing, recs = {}, set(), {}
    for pat in ('batch_*.json', 'photo_*.json'):   # pass 2 replaces pass 1 school by school
        for f in sorted(glob.glob(os.path.join(RDIR, pat))):
            for x in json.load(open(f)):
                recs[x['school']] = x
    if True:
        for x in recs.values():
            title = wiki_title(x)
            boxes = infobox_hex(wiki_colours(title, cache)) if title else []
            cols = x.get('colors') or []
            # pair infobox boxes with colour names by position only when the counts agree
            wh = [b if re.fullmatch(r'#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?', b) else None for b in boxes] if len(boxes) == len(cols) else [None] * len(cols)
            c = []
            for col, w in zip(cols, wh):
                h, src = col.get('hex'), FROM.get(col.get('hex_from'), 'w') if col.get('hex') else None
                if h and src == 'w' and h.upper() in WEB:
                    h = None
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
                's': [s for s in (x.get('sources') or []) if s], 'e': x.get('era'),
                'x': ' · '.join(t for t in (x.get('evidence'), x.get('notes')) if t),
            }.items() if v}
    json.dump(cache, open(CACHE, 'w'), indent=0, sort_keys=True, ensure_ascii=False)
    J = lambda v: json.dumps(v, ensure_ascii=False)
    body = ',\n'.join(J(k) + ': ' + J(out[k]) for k in sorted(out))
    open(OUT, 'w').write('/* School colour research (tools/build_colour_research.py): suggestions for the colour editor only. '
                         'c: [name, hex, l=logo | p=photo | s=school site | w=Wikipedia hex | n=standard shade for the name]; q: 3 high, 2 medium, 1 low. */\n'
                         'window.OT_RESEARCH = {\n' + body + '\n};\n')
    n = len(out)
    print(f'{n} schools, {sum(1 for v in out.values() if v.get("c"))} with colours;',
          'by confidence', {q: sum(1 for v in out.values() if v.get('q') == q) for q in (3, 2, 1)},
          '; hex from', {s: sum(1 for v in out.values() for c in v.get('c', []) if c[2] == s) for s in 'lpswn'})
    if missing:
        print('colour names with no standard shade (add to STD):', sorted(missing))


if __name__ == '__main__':
    main()
