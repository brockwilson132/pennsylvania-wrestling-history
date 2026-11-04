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
bracket's own entrants by first initial + last name. A tree whose leaves include full entrants is the
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

def page_bouts(page):
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
        if len(row) >= 2 and row[-1]['x1'] > h['x1'] - 12 and ',' in row[-1]['text'] and row[0]['x0'] < h['x1'] - 60:
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
            entr.append({'name': nm, 'school': sch, 'n': norm(nm)})
    def resolve(L):
        if L is None: return None
        if 'full' in L:
            m = SEEDP.match(L['full']); nm = (m.group(4) if m else L['full']).strip()
            return {'name': nm, 'school': re.split(r',', L['school'])[0].strip()}
        t = L['abbr']
        if not t or RES.match(t) and not re.search(r'[A-Z][a-z]+', t[3:]): return None
        m = ABBR.match(t)
        ini = (m.group(1) or '').rstrip('.').lower(); last = norm(m.group(2))
        if not last: return None
        cand = [e for e in entr if e['n'].endswith(last) and (not ini or norm(e['name'])[:1] == ini[:1])]
        if not cand: cand = [e for e in entr if last and last in e['n']]
        if len(cand) >= 1: return {'name': cand[0]['name'], 'school': cand[0]['school']}
        return {'name': (m.group(1) or '') + ' ' + m.group(2), 'school': '', 'unresolved': True}
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
        if norm(W['name']) == norm(A['name']): win, lose = A, B
        elif norm(W['name']) == norm(B['name']): win, lose = B, A
        else:
            # winner slot printed abbreviated differently: fall back to last-name match
            wl = norm(W['name'])[-5:]
            if norm(A['name']).endswith(wl): win, lose = A, B
            elif norm(B['name']).endswith(wl): win, lose = B, A
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
            for page in pdf.pages:
                w, bs = page_bouts(page)
                if w is None: continue
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
    for d, level in zip(args, ('state', 'district', 'regional', 'section')):
        tasks += [(os.path.join(d, f), level) for f in sorted(os.listdir(d)) if f.endswith('.pdf')]
    # 1974-75 state files exist twice (A/AAA and B/AA); keep the A/B originals
    tasks = [t for t in tasks if not (t[1] == 'state' and re.match(r'197[45]_(AAA|AA)\.pdf$', os.path.basename(t[0])))]
    out = 'data/brackets/bouts.csv'; os.makedirs('data/brackets', exist_ok=True)
    logs = []
    with open(out, 'w', newline='') as f, Pool(jobs) as pool:
        cw = csv.writer(f)
        cw.writerow(['level', 'tournament', 'year', 'cls', 'unit', 'weight', 'side', 'round', 'winner', 'winner_school', 'loser', 'loser_school', 'result', 'score', 'flags'])
        for rows, log in pool.imap_unordered(parse_file, tasks, chunksize=4):
            cw.writerows(rows); logs.append(log)
    with open('data/brackets/bouts_log.txt', 'w') as f: f.write('\n'.join(sorted(logs)) + '\n')
    print('files', len(tasks))

if __name__ == '__main__':
    main()
