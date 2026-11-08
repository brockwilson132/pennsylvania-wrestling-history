#!/usr/bin/env python3
"""Recover bout-by-bout results from the PA-Wrestling.com bracket PDFs (state, district, regional).

  data/brackets/bouts.csv
      level,tournament,year,cls,unit,weight,side,round,winner,winner_school,loser,loser_school,result,score,flags
  data/brackets/bouts_log.txt   per-file counts and validation

Usage: python3 -I tools/parse_bouts.py <state dir> <district dir> <regional dir> [--jobs N]

Every bracket in the archive is drawn by the same generator (1938-2026). Bracket lines are thin filled
rectangles: a horizontal rect is one wrestler's slot, a vertical rect joins two slots, and the slot that
starts where the vertical rect sits, between its ends, is the winner of that bout. So the tree is read
from geometry, not guessed from text:

  bout  = vertical rect V at x=vx spanning [a,b]
  upper = horizontal rect ending at vx whose bottom is at a      (feeder 1)
  lower = horizontal rect ending at vx whose top is at b         (feeder 2)
  win   = horizontal rect starting at vx with a < top < b        (winner's slot)

The text sitting on a slot names its wrestler: first-round slots carry "SEED Full Name ... School, GR, W-L",
later slots "F. Last (ABBR)". The result ("Dec. 3-2", "Fall 2:57", "Maj. Dec. 13-4", "TF 19-3 3:18",
"Dec. 6-3 SV", "Bye", "Forfeit") is printed just under the winner's slot. Abbreviated names are resolved to the
bracket's own entrants by first initial + last name (see match_abbr): the last name must be a whole-word ending of
the entrant's name, so "C. Houser" is never read as Chad Frankhouser, and a name that fits two entrants is left
unresolved rather than given to whichever comes first on the page. A tree whose leaves include full entrants is the
championship side; trees made only of abbreviated slots are consolation / placement bouts.
"""
import csv, os, re, sys
from multiprocessing import Pool
import pdfplumber

SEEDP = re.compile(r'^(?:([A-Z]{1,3}|\d{1,2}(?:/\d{1,2})?)-(\d{1,2})|([A-Z]))\s+(.+)$')
ABBR = re.compile(r'^([A-Z][a-z]?\.)?\s*(.+?)\s*(?:\(([^)]*)\)?)?\s*$')
WEIGHT = re.compile(r'^(\d{2,3}|UNL|Unl|Unlimited|HWT|Hwt|Heavyweight)$')
REGION = {'North_East': 'NE', 'North_West': 'NW', 'South_Central': 'SC', 'South_East': 'SE', 'South_West': 'SW', 'West': 'W', 'East': 'E', 'Central_North_West': 'CNW'}
RES = re.compile(r'(Fall|Pin|Sup\.?\s*Dec|Maj\.?\s*Dec|Tech\.?\s*Fall|TF|Dec|Forfeit|Forf|FF|Def|Default|Inj|DQ|Disq|Med|Bye|Ref|Criteria|Crit)', re.I)

def meta(path, level):
    base = os.path.basename(path)[:-4]
    year, rest = base.split('_', 1); year = int(year)
    if level == 'state':
        cls = {'A': 'AAA', 'B': 'AA'}.get(rest, rest)
        return base, year, cls, 'PIAA'
    parts = rest.split('_'); cls = parts[-1]; unit = '_'.join(parts[:-1])
    if cls in ('A', 'B'): cls = {'A': 'AAA', 'B': 'AA'}[cls]
    if cls.endswith('Super'): cls, unit = parts[-2], '_'.join(parts[:-2]) + '_Super'
    if cls.endswith('Sub'): cls, unit = parts[-2], '_'.join(parts[:-2]) + '_Sub'
    if level == 'regional': unit = REGION.get(unit, unit)
    return base, year, cls, unit

def norm(s):
    s = re.sub(r'\([^)]*\)', ' ', s or '')
    return re.sub(r'[^a-z]', '', s.lower())

SUFFIX = {'jr', 'sr', 'ii', 'iii', 'iv', 'v'}

def name_keys(name):
    """(first-name key, set of last-name keys) for a full name. Last-name keys are the whole-word endings of the
    name ("Van Horn" -> vanhorn and horn), with and without a generational suffix ("Smith Jr" -> smithjr, smith),
    plus each part of a hyphenated surname ("Mejias-Santana" -> mejiassantana, mejias, santana) and the whole name."""
    t = [w for w in re.sub(r'\([^)]*\)', ' ', name or '').split() if norm(w)]
    if not t: return '', set()
    first, rest = norm(t[0]), t[1:]
    keys = set()
    for tail in (rest, rest[:-1] if len(rest) > 1 and norm(rest[-1]) in SUFFIX else None):
        if not tail: continue
        for i in range(len(tail)): keys.add(''.join(norm(w) for w in tail[i:]))
        keys.update(norm(p) for p in re.split(r'-', tail[-1]) if len(norm(p)) >= 3)
    keys.add(''.join(norm(w) for w in t))   # some sheets (2021 pools) print the whole name in later slots
    keys -= SUFFIX | {''}
    return first, keys

def one_edit(a, b):
    """a and b differ by at most one letter added, dropped or changed (a misprint in the abbreviated slot)."""
    if a == b: return True
    if abs(len(a) - len(b)) > 1 or min(len(a), len(b)) < 5: return False
    if len(a) == len(b): return sum(x != y for x, y in zip(a, b)) == 1
    if len(a) > len(b): a, b = b, a
    return any(b[:i] + b[i + 1:] == a for i in range(len(b)))

def tag_fit(tag, school, teams):
    """How well the school tag in "F. Last (TAG)" fits a school: 3 the file's own team table gives TAG to this
    school, 2 TAG is made of the starts of the school's words in order ("BOS" = Boiling Springs, "PO" =
    Philipsburg-Osceola), 1 TAG's letters appear in order in the name, 0 it cannot be this school.
    A tag the team table gives to another school scores 0."""
    t, s = norm(tag), norm(school)
    if not t or not s: return 1
    if t in teams:
        a = teams[t]
        return 3 if a == s or a.startswith(s) or s.startswith(a) else 0
    words = [norm(w) for w in re.split(r'[\s\-/().]+', school) if norm(w)]
    def pre(i, j):   # tag[i:] built from prefixes of words[j:], each word used at most once, in order
        if i == len(t): return True
        return any(t[i:i + k] == words[jj][:k] and pre(i + k, jj + 1)
                   for jj in range(j, len(words)) for k in range(1, len(words[jj]) + 1) if i + k <= len(t))
    if pre(0, 0): return 2
    it = iter(s)
    return 1 if all(ch in it for ch in t) else 0

def match_abbr(ini, last, tag, cands, teams=None):
    """The one entrant an abbreviated slot "F. Last (TAG)" names, or None when no entrant or more than one fits.
    Tried in order, each step only if the previous found nobody:
      1. last name is a whole-word ending of the entrant's name and the initial agrees
      2. the same with a one-letter misprint in the last name, initial agrees
      3. last name exact, initial disagrees (a nickname, or a first name printed differently on the sheet)
    Within a step, when more than one entrant fits, the school tag picks the one whose school it fits best
    (tag_fit); a tie is ambiguous and the slot stays unresolved."""
    ini = norm(ini)
    def ok_ini(e): return not ini or e['first'].startswith(ini)
    steps = (lambda e: last in e['keys'] and ok_ini(e),
             lambda e: ok_ini(e) and any(one_edit(last, k) for k in e['keys']),
             lambda e: last in e['keys'])
    for test in steps:
        hit = [e for e in cands if test(e)]
        if len({(e['n'], norm(e['school'])) for e in hit}) > 1 and tag:
            fit = {id(e): tag_fit(tag, e['school'], teams or {}) for e in hit}
            best = max(fit.values())
            if best > 0: hit = [e for e in hit if fit[id(e)] == best]
        if len({(e['n'], norm(e['school'])) for e in hit}) == 1: return hit[0]
        if hit: return None
    return None

def classify(text):
    t = (text or '').strip()
    flags = []
    for f in ('OT', 'SV', 'TB', 'UTB', '2OT', 'UT'):
        if re.search(r'\b' + f + r'\b', t): flags.append(f)
    m = RES.search(t)
    if not m: return None, '', ''
    k = m.group(1).lower().replace(' ', '')
    if k.startswith(('fall', 'pin')): typ = 'fall'
    elif k.startswith(('sup', 'maj')): typ = 'md'
    elif k.startswith(('tech', 'tf')): typ = 'tf'
    elif k.startswith('dec'): typ = 'dec'
    elif k.startswith(('forf', 'ff')): typ = 'ff'
    elif k.startswith(('def', 'inj', 'med')): typ = 'inj'
    elif k.startswith(('dq', 'disq')): typ = 'dq'
    elif k.startswith('bye'): typ = 'bye'
    elif k.startswith(('ref', 'crit')): typ = 'dec'
    else: typ = 'dec'
    sc = re.search(r'(\d{1,2})\s*-\s*(\d{1,2})', t)
    tm = re.search(r'(\d{1,2}:\d{2})', t)
    score = sc.group(0).replace(' ', '') if sc else (tm.group(1) if tm else '')
    if typ == 'tf' and tm and sc: score = sc.group(0).replace(' ', '') + ' ' + tm.group(1)
    return typ, score, ' '.join(flags)

TEAM = re.compile(r'^(\d+)\.\s+([\d.]+)\s+(.+?)\s+((?=[A-Z0-9&\-]*[A-Z])[A-Z0-9&\-]{1,6})(?:\s+(?:[\d\-]+\s*)+)?$')

def team_tags(page):
    """the team-score table on a tournament's first page(s): {tag: school key}, e.g. {'sc': 'statecollege'}"""
    out = {}
    for line in (page.extract_text() or '').split('\n'):
        m = TEAM.match(line.strip())
        if m: out.setdefault(norm(m.group(4)), norm(m.group(3)))
    return out

def page_bouts(page, teams=None):
    ws = page.extract_words(keep_blank_chars=True, x_tolerance=1.2, y_tolerance=2)
    weight = None
    for w in ws:
        if w['x0'] > 440 and w['top'] < 200 and WEIGHT.match(w['text'].strip()):
            weight = w['text'].strip(); break
    if not weight: return None, []
    rects = list(page.rects) + [c for c in page.curves if c['x1'] - c['x0'] < 2.5 or c['bottom'] - c['top'] < 2.5]  # a few slots are drawn as closed paths
    H = [r for r in rects if (r['bottom'] - r['top']) < 2.5 and (r['x1'] - r['x0']) > 15]
    V = [r for r in rects if (r['x1'] - r['x0']) < 2.5 and (r['bottom'] - r['top']) > 4]
    if not H or not V: return weight, []
    def label(h):
        row = [w for w in ws if h['top'] - 3.5 <= w['bottom'] <= h['top'] + 3 and w['top'] < h['top'] - 2 and h['x0'] - 3 <= w['x0'] < h['x1'] - 2]
        row.sort(key=lambda w: w['x0'])
        if not row: return None
        # first-round slot: name at the left, "School, GR, W-L" right-aligned at the end of the line
        # (some 1960s-80s D6/D11 sheets end the school text 14pt short of the line, so allow 20)
        if len(row) >= 2 and row[-1]['x1'] > h['x1'] - 20 and ',' in row[-1]['text'] and row[0]['x0'] < h['x1'] - 60:
            return {'full': row[0]['text'].strip(), 'school': row[-1]['text'].strip()}
        txt = ''.join(w['text'] if i == 0 else (('' if w['x0'] - row[i - 1]['x1'] < 1.5 else ' ') + w['text']) for i, w in enumerate(row))
        return {'abbr': txt.strip()}
    def result(h):
        row = [w for w in ws if h['top'] - 0.5 <= w['top'] <= h['top'] + 7 and h['x0'] - 3 <= w['x0'] < h['x0'] + 40]
        row.sort(key=lambda w: w['x0'])
        return ' '.join(w['text'] for w in row).strip()
    # entrants on this page
    entr = []
    for h in H:
        L = label(h)
        if L and 'full' in L:
            m = SEEDP.match(L['full']); nm = (m.group(4) if m else L['full']).strip()
            sch = re.split(r',', L['school'])[0].strip()
            first, keys = name_keys(nm)
            entr.append({'name': nm, 'school': sch, 'n': norm(nm), 'first': first, 'keys': keys})
    def resolve(L):
        if L is None: return None
        if 'full' in L:
            m = SEEDP.match(L['full']); nm = (m.group(4) if m else L['full']).strip()
            return {'name': nm, 'school': re.split(r',', L['school'])[0].strip()}
        t = L['abbr']
        if not t or RES.match(t) and not re.search(r'[A-Z][a-z]+', t[3:]): return None
        # the result printed under a slot sometimes runs into its school tag: "H. Yacoviello-Andrus (BEDSe)c. 13-6";
        # the name is everything before "(", the tag the capitals right after it
        # (a nickname in brackets, "J. (Rocky) Miller" or "Jerome (JJ) Fitzsimmons", is not a tag: a tag starts with two
        # capitals or digits, follows at least an initial and a last name, and no more name comes after it)
        tm = [x for x in re.finditer(r'\(([A-Z0-9&\-]{2,})', t) if not re.search(r'\)\s+[A-Z][a-z]', t[x.end():])]
        if tm and len(t[:tm[-1].start()].split()) >= 2: t, tag = t[:tm[-1].start()].strip(), tm[-1].group(1)
        else: tag = None
        m = ABBR.match(t)
        ini = (m.group(1) or '').rstrip('.').lower(); last = norm(m.group(2))
        if not last: return None
        tag = tag or m.group(3)
        e = match_abbr(ini, last, tag, entr, teams)
        if e: return {'name': e['name'], 'school': e['school']}
        return {'name': ((m.group(1) or '') + ' ' + m.group(2)).strip(), 'school': '', 'unresolved': True,
                'ini': ini, 'last': last, 'tag': tag}
    near = lambda a, b, t=1.6: abs(a - b) <= t
    bouts = []
    for v in V:
        vx = (v['x0'] + v['x1']) / 2
        up = [h for h in H if near(h['x1'], vx, 1.8) and near(h['bottom'], v['top'], 2.2)]
        lo = [h for h in H if near(h['x1'], vx, 1.8) and (near(h['top'], v['bottom'], 2.2) or near(h['bottom'], v['bottom'], 2.2))]
        wn = [h for h in H if near(h['x0'], vx, 1.8) and v['top'] - 1 < h['top'] < v['bottom'] + 1]
        if not up or not lo or not wn: continue
        u, l, w = up[0], lo[0], wn[0]
        A, B, W = resolve(label(u)), resolve(label(l)), resolve(label(w))
        res = result(w); typ, score, flags = classify(res)
        if typ == 'bye' or A is None or B is None or W is None: continue
        who = lambda x: (norm(x['name']), norm(x['school']))   # two "Mike Snyder"s can share a bracket: name and school
        if who(A) == who(B): continue
        nA, nB, nW = norm(A['name']), norm(B['name']), norm(W['name'])
        if who(W) == who(A) or (nW == nA != nB): win, lose = A, B
        elif who(W) == who(B) or (nW == nB != nA): win, lose = B, A
        elif W.get('unresolved'):
            # winner slot not among the page's entrants: match it to one of the two wrestlers in this bout only
            pair = [dict(x, n=norm(x['name']), first=name_keys(x['name'])[0], keys=name_keys(x['name'])[1]) for x in (A, B)]
            hit = match_abbr(W['ini'], W['last'], W['tag'], pair, teams)
            if hit is None: continue
            win, lose = (A, B) if hit is pair[0] else (B, A)
        else: continue
        bouts.append({'vx': vx, 'top': v['top'], 'bot': v['bottom'], 'wtop': w['top'], 'win': win, 'lose': lose,
                      'typ': typ or 'dec', 'score': score, 'flags': flags, 'u': id(u), 'l': id(l), 'w': id(w),
                      'leafA': 'full' in (label(u) or {}), 'leafB': 'full' in (label(l) or {})})
    # tree structure: a bout feeds the bout whose feeder slot is this bout's winner slot
    by_feeder = {}
    for i, b in enumerate(bouts): by_feeder[b['u']] = i; by_feeder[b['l']] = i
    parent = {i: by_feeder.get(b['w']) for i, b in enumerate(bouts)}
    roots = [i for i in parent if parent[i] is None]
    comp, depth = {}, {}
    for r in roots:
        stack = [(r, 0)]
        while stack:
            i, d = stack.pop(); comp[i] = r; depth[i] = d
            stack += [(j, d + 1) for j, p in parent.items() if p == i]
    champ_roots = {comp[i] for i, b in enumerate(bouts) if b['leafA'] or b['leafB']}
    titles = [(w['top'], w['x0'], w['text'].strip()) for w in ws if re.match(r'^(3rd|5th|7th) Place$', w['text'].strip())]
    def side_of(r):
        if r in champ_roots: return 'champ'
        b = bouts[r]
        best = None
        for ty, tx, tt in titles:
            d = abs(ty - b['wtop']) + abs(tx - b['vx']) * 0.3
            if d < 90 and (best is None or d < best[0]): best = (d, tt)
        return {'3rd Place': 'p3', '5th Place': 'p5', '7th Place': 'p7'}.get(best[1]) if best else 'cons'
    sides = {r: side_of(r) for r in roots}
    out = []
    for i, b in enumerate(bouts):
        out.append({'side': sides.get(comp.get(i), 'cons'), 'round': depth.get(i, 0), **b})
    return weight, out

def parse_file(args):
    path, level = args
    try:
        base, year, cls, unit = meta(path, level)
    except Exception:
        return [], f'{os.path.basename(path)}\tbad name'
    rows, nweights, nunres = [], 0, 0
    try:
        with pdfplumber.open(path) as pdf:
            teams = {}
            for page in pdf.pages:
                w, bs = page_bouts(page, teams)
                if w is None:
                    for k, v in team_tags(page).items(): teams.setdefault(k, v)
                    continue
                nweights += 1
                for b in bs:
                    if b['win'].get('unresolved') or b['lose'].get('unresolved'): nunres += 1
                    rows.append([level, base, year, cls, unit, w, b['side'], b['round'], b['win']['name'], b['win']['school'],
                                 b['lose']['name'], b['lose']['school'], b['typ'], b['score'], b['flags']])
    except Exception as e:
        return rows, f'{base}\tERROR {e}'
    return rows, f'{base}\tweights={nweights}\tbouts={len(rows)}\tunresolved={nunres}'

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    jobs = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--jobs=')), '4'))
    tasks = []
    # folders are state district regional section by position; a folder named league (or any of those names)
    # takes its level from its name, so `parse_bouts.py brackets/league --out=data/brackets/league` works alone
    LEVELS = ('state', 'district', 'regional', 'section', 'league')
    for d, level in zip(args, LEVELS):
        name = os.path.basename(os.path.normpath(d))
        if name in LEVELS: level = name
        tasks += [(os.path.join(d, f), level) for f in sorted(os.listdir(d)) if f.endswith('.pdf')]
    # 1974-75 state files exist twice (A/AAA and B/AA); keep the A/B originals
    tasks = [t for t in tasks if not (t[1] == 'state' and re.match(r'197[45]_(AAA|AA)\.pdf$', os.path.basename(t[0])))]
    odir = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--out=')), 'data/brackets')
    out = os.path.join(odir, 'bouts.csv'); os.makedirs(odir, exist_ok=True)
    logs = []
    with open(out, 'w', newline='') as f, Pool(jobs) as pool:
        cw = csv.writer(f)
        cw.writerow(['level', 'tournament', 'year', 'cls', 'unit', 'weight', 'side', 'round', 'winner', 'winner_school', 'loser', 'loser_school', 'result', 'score', 'flags'])
        for rows, log in pool.imap_unordered(parse_file, tasks, chunksize=4):
            cw.writerows(rows); logs.append(log)
    with open(os.path.join(odir, 'bouts_log.txt'), 'w') as f: f.write('\n'.join(sorted(logs)) + '\n')
    print('files', len(tasks))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import clean_brackets
    clean_brackets.run(odir)   # same name cleanup as parse_lower.py, then garbled bout names resolved to entrants

if __name__ == '__main__':
    main()
