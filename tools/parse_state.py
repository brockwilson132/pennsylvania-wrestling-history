#!/usr/bin/env python3
"""Parse PIAA state bracket PDFs (PA-Wrestling.com archive) into two CSVs:
  data/brackets/state_entrants.csv  year,cls,weight,seed,region,name,school,grade,record
  data/brackets/state_teams.csv     year,cls,place,pts,school,abbr
  data/brackets/state_places.csv    year,cls,weight,place,name,grade,school   (the official "Place Winners" box)
Usage: python3 tools/parse_state.py <folder of PDFs>
       python3 tools/parse_state.py <folder of PDFs> --places    (only the place-winner boxes)

The place-winner box printed beside every weight's bracket is the official order of finish. It is the
reference that data/medals/*.csv is checked against (tools/check_integrity.js), because those lists were
typed in separately and had places 3-8 shuffled in some seasons (2016 AAA, 2017 AA, 2019, 2020 AA, ...).
"""
import csv, os, re, sys
import pdfplumber

SEED = re.compile(r'^([A-Z]{1,4}|\d{1,2})-(\d{1,2})\s+(.+)$')
SCHOOL = re.compile(r'^(.+?),\s*(FR|SO|JR|SR|Fr|So|Jr|Sr|9|10|11|12)(?:,\s*([\d]+-[\d]+(?:-[\d]+)?))?\s*$')
WEIGHT = re.compile(r'^(\d{2,3}|UNL|Unl|Unlimited|HWT|Hwt|Heavyweight)$')
TEAM = re.compile(r'^(\d+)\.\s+([\d.]+)\s+(.+?)\s+([A-Z0-9&\-]{1,6})(?:\s+(?:[\d\-]+\s*)+)?$')
GR = {'Fr': 'FR', 'So': 'SO', 'Jr': 'JR', 'Sr': 'SR', '9': 'FR', '10': 'SO', '11': 'JR', '12': 'SR'}

def words(page):
    return page.extract_words(keep_blank_chars=True, x_tolerance=1.5, y_tolerance=2)

def parse_file(path):
    base = os.path.basename(path)[:-4]
    year, cls = base.split('_'); year = int(year)
    cls = {'A': 'AAA', 'B': 'AA'}.get(cls, cls)
    ents, teams = [], []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            ws = words(page)
            txt = ' '.join(w['text'] for w in ws)
            if 'Team Scores' in txt and 'Place' in txt:
                # team score rows: join words by line
                rows = {}
                for w in ws: rows.setdefault(round(w['top'] / 2.5), []).append(w)
                for k in sorted(rows):
                    line = ' '.join(x['text'] for x in sorted(rows[k], key=lambda x: x['x0']))
                    m = TEAM.match(line)
                    if m: teams.append([year, cls, int(m.group(1)), float(m.group(2)), m.group(3).strip(), m.group(4)])
                continue
            wt = None
            for w in ws:
                if w['x0'] > 440 and w['top'] < 200 and WEIGHT.match(w['text'].strip()):
                    wt = w['text'].strip(); break
            if not wt: continue
            if wt in ('Unl', 'Unlimited'): wt = 'UNL'
            if wt in ('Hwt', 'Heavyweight'): wt = 'HWT'
            seeds = [w for w in ws if w['x0'] < 130 and SEED.match(w['text'].strip())]
            schools = [w for w in ws if SCHOOL.match(w['text'].strip()) and w['x0'] < 330]
            used = set()
            for s in seeds:
                m = SEED.match(s['text'].strip())
                best, bd = None, 1e9
                for i, sc in enumerate(schools):
                    if i in used or sc['x0'] <= s['x0']: continue
                    d = abs(sc['top'] - s['top']) + (0 if abs(sc['top'] - s['top']) < 3 else 2)
                    if d < bd: best, bd = i, d
                if best is None or bd > 14: continue
                used.add(best)
                sm = SCHOOL.match(schools[best]['text'].strip())
                ents.append([year, cls, wt, int(m.group(2)), m.group(1), m.group(3).strip(), sm.group(1).strip(), GR.get(sm.group(2), sm.group(2)), sm.group(3) or ''])
    return ents, teams

GRADES = {'FR', 'SO', 'JR', 'SR', 'Fr', 'So', 'Jr', 'Sr', '9', '10', '11', '12'}

def _sub(a, b):
    """is a a subsequence of b"""
    it = iter(b); return all(c in it for c in a)

def unweave(name):
    """'John-Michael StaudenmayeJrR' -> 'John-Michael Staudenmayer': drop a grade's two letters from the last
    word when the first sits as a capital after a lower-case letter and what is left reads as a name"""
    *head, last = name.split(' ')
    for g in ('FR', 'SO', 'JR', 'SR'):
        for i in range(1, len(last)):
            if last[i] != g[0] or not last[i - 1].islower(): continue
            for j in range(i + 1, len(last)):
                if last[j].upper() != g[1]: continue
                rest = last[:i] + last[i + 1:j] + last[j + 1:]
                if not re.search(r'[a-z][A-Z]', rest.replace('Mc', '').replace('Mac', '')) and rest[-1:].islower():
                    return ' '.join(head + [rest])
    return name

def place_boxes(path, entrants):
    """[(year, cls, weight, place, name, grade, school)] from the 'Place Winners' box on each weight's page.
    entrants: {(year, cls, weight): [names]} so a name whose grade got woven into it by the PDF text layer
    ('John-Michael StaudenmayeJrR') is put back to the bracket's own spelling."""
    base = os.path.basename(path)[:-4]
    year, cls = base.split('_'); cls = {'A': 'AAA', 'B': 'AA'}.get(cls, cls)
    out = []
    norm = lambda t: re.sub(r'[^a-z]', '', t.lower())
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            ws = page.extract_words(x_tolerance=1.5, y_tolerance=2)
            hdr = []
            for v in ws:
                if v['text'] != 'Winners': continue
                pl = [w for w in ws if w['text'] == 'Place' and abs(w['top'] - v['top']) < 3 and w['x1'] < v['x0']]
                if pl: hdr.append(max(pl, key=lambda w: w['x1']))
            if not hdr: continue
            h = hdr[0]
            wts = [w for w in ws if WEIGHT.match(w['text']) and w['top'] < h['top'] and w['x0'] > page.width * 0.5]
            if not wts: continue
            wt = min(wts, key=lambda w: w['top'])['text']
            wt = {'Unl': 'UNL', 'Unlimited': 'UNL', 'Hwt': 'HWT', 'Heavyweight': 'HWT'}.get(wt, wt)
            cand = sorted([w for w in ws if h['top'] + 3 < w['top'] < h['top'] + 200 and w['x0'] > h['x0'] - 95], key=lambda w: w['top'])
            rows, keys = {}, []
            for w in cand:
                k = next((k for k in keys if abs(k - w['top']) < 3.5), None)
                if k is None: k = w['top']; keys.append(k)
                rows.setdefault(k, []).append(w)
            got = 0
            names = entrants.get((year, cls, wt), [])
            nm_only = [e[0] for e in names]
            for k in sorted(rows):
                r = sorted(rows[k], key=lambda w: w['x0']); t = [w['text'] for w in r]
                if len(t) < 3 or not re.fullmatch(r'[1-8]', t[0]): continue
                gi = [i for i, x in enumerate(t) if x in GRADES and i > 1]
                if gi: name, gr, sch = ' '.join(t[1:gi[0]]), GR.get(t[gi[0]], t[gi[0]]), ' '.join(t[gi[0] + 1:])
                else:
                    gap, i = max((r[j + 1]['x0'] - r[j]['x1'], j) for j in range(1, len(r) - 1))
                    name, gr, sch = ' '.join(t[1:i + 1]), '', ' '.join(t[i + 1:])
                    m = re.match(r'^(.*[a-z.])(FR|SO|JR|SR)$', name)
                    if m: name, gr = m.group(1), m.group(2)
                if names and name not in nm_only:
                    # grade letters woven into the name (or name and school): the entrant whose letters, plus
                    # the two grade letters, make this text
                    ns = [e for e in names if len(norm(name)) - len(norm(e[0])) in (0, 2) and _sub(norm(e[0]), norm(name))]
                    if not ns: ns = [e for e in names if len(norm(name + sch)) - len(norm(e[0] + e[1])) == 2 and _sub(norm(e[0] + e[1]), norm(name + sch))]
                    if len(ns) == 1: name, sch = ns[0][0], (sch if norm(sch) == norm(ns[0][1]) or len(ns[0][1]) < 2 else ns[0][1])
                    elif not ns: name = unweave(name)
                out.append([year, cls, wt, int(t[0]), name, gr, sch]); got += 1
                if got == 8: break
    return out

if __name__ == '__main__' and '--places' in sys.argv:
    folder = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'brackets')
    ent = {}
    for r in csv.DictReader(open(os.path.join(out, 'state_entrants.csv'))):
        ent.setdefault((r['year'], r['cls'], r['weight']), []).append((r['name'], r['school']))
    P = []
    for f in sorted(os.listdir(folder)):
        # 1974-75 come twice on the archive (A/AAA and B/AA); keep the A/B originals
        if not f.endswith('.pdf') or re.match(r'197[45]_(AAA|AA)\.pdf$', f): continue
        P += place_boxes(os.path.join(folder, f), ent)
    with open(os.path.join(out, 'state_places.csv'), 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['year', 'cls', 'weight', 'place', 'name', 'grade', 'school']); w.writerows(P)
    print('place rows', len(P), 'weights', len({tuple(x[:3]) for x in P}))
    sys.exit(0)

if __name__ == '__main__':
    folder = sys.argv[1]
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'brackets')
    os.makedirs(out, exist_ok=True)
    E, T, log = [], [], []
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.pdf'): continue
        e, t = parse_file(os.path.join(folder, f))
        E += e; T += t
        wts = len(set(x[2] for x in e))
        log.append(f'{f}: {len(e)} entrants, {wts} weights, {len(t)} team rows')
    with open(os.path.join(out, 'state_entrants.csv'), 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['year', 'cls', 'weight', 'seed', 'region', 'name', 'school', 'grade', 'record']); w.writerows(E)
    with open(os.path.join(out, 'state_teams.csv'), 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['year', 'cls', 'place', 'pts', 'school', 'abbr']); w.writerows(T)
    open(os.path.join(out, 'parse_log.txt'), 'w').write('\n'.join(log))
    print('\n'.join(log[:3] + ['...'] + log[-3:])); print('entrants', len(E), 'team rows', len(T))
