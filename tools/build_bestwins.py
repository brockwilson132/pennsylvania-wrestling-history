"""Season best wins for every wrestler who reached states at least once (lazy file for wrestler cards).
   python3 tools/build_bestwins.py   ->  overtime/bestwins.json  {"<nkey(name)>|<year>": [oppRating, oppName, level]}"""
import csv, json, re, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
nkey = lambda s: re.sub(r'[^a-z]', '', re.sub(r'\(.*?\)', '', s.lower()))
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/difficulty/wrestler_seasons.csv'))))
state_keys = {r['key'] for r in rows if r['level'] == 'state'}
best, clash = {}, set()
for r in rows:
    if r['key'] not in state_keys or not r['best']: continue
    k = nkey(r['name']) + '|' + r['year']
    v = [round(float(r['best'])), r['best_name'], r['level'][0], r['key']]
    cur = best.get(k)
    if cur and cur[3] != v[3]: clash.add(k)
    if not cur or v[0] > cur[0]: best[k] = v
out = {k: v[:3] for k, v in best.items() if k not in clash}
json.dump(out, open(os.path.join(ROOT, 'overtime/bestwins.json'), 'w'), separators=(',', ':'))
print('seasons', len(out), 'dropped clashes', len(clash), 'bytes', os.path.getsize(os.path.join(ROOT, 'overtime/bestwins.json')))
