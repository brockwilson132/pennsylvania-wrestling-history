"""Season best win and postseason record for every wrestler who reached states at least once (lazy file for wrestler cards).
   python3 tools/build_bestwins.py   ->  overtime/bestwins.json
   {"<nkey(name)>|<year>": [oppRating|0, oppName, level, wins, losses, falls, otWins]}
   Record counts every parsed bout that season at districts, regionals and states (forfeits and injury defaults are not bouts)."""
import csv, json, re, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
nkey = lambda s: re.sub(r'[^a-z]', '', re.sub(r'\(.*?\)', '', s.lower()))
OT = re.compile(r'\b(OT|SV|TB|UTB|2OT|3OT)\b')
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/difficulty/wrestler_seasons.csv'))))
ADVN = {(r['tournament'], r['weight'], r['name']) for r in rows if (r.get('adv') or '1').strip() != '0'}   # best wins only over wrestlers who advanced
state_keys = {r['key'] for r in rows if r['level'] == 'state'}
agg, owner, clash = {}, {}, set()
for r in rows:
    if r['key'] not in state_keys: continue
    k = nkey(r['name']) + '|' + r['year']
    if owner.setdefault(k, r['key']) != r['key']: clash.add(k); continue
    a = agg.setdefault(k, [0, '', '', 0, 0, 0, 0])
    if r['best'] and (r['tournament'], r['weight'], r['best_name']) in ADVN and float(r['best']) > a[0]: a[0], a[1], a[2] = round(float(r['best'])), r['best_name'], ('x' if r['level'] == 'section' else r['level'][0])
    for t in (r['results'] or '').split(' · '):
        t = t.strip()
        if not t: continue
        if t[0] == 'W':
            a[3] += 1
            if ' fall' in t: a[5] += 1
            if OT.search(t): a[6] += 1
        elif t[0] == 'L': a[4] += 1
out = {k: v for k, v in agg.items() if k not in clash}
p = os.path.join(ROOT, 'overtime/bestwins.json')
json.dump(out, open(p, 'w'), separators=(',', ':'))
print('seasons', len(out), 'dropped clashes', len(clash), 'bytes', os.path.getsize(p))
