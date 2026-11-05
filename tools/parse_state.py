#!/usr/bin/env python3
"""Parse PIAA state bracket PDFs (PA-Wrestling.com archive) into two CSVs:
  data/brackets/state_entrants.csv  year,cls,weight,seed,region,name,school,grade,record
  data/brackets/state_teams.csv     year,cls,place,pts,school,abbr
Usage: python3 tools/parse_state.py <folder of PDFs>
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
