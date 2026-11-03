#!/usr/bin/env python3
"""Compare District III Records / WPIAL champions with the bracket archive and state seeds.
   python3 -I tools/validate_sources.py  (run from repo root)"""
import csv, re
from collections import defaultdict
def nk(s): return re.sub(r'[^a-z]', '', re.sub(r'\(.*?\)', '', (s or '').lower()))
def last(s): p = re.sub(r'\(.*?\)', '', s or '').split(); return nk(p[-1]) if p else ''
import difflib
def near(a, b): return a == b or difflib.SequenceMatcher(None, a, b).ratio() >= 0.8
def wkey(w): w = (w or '').upper(); return 'HWT' if w in ('HWT', 'UNL', '275', '285') else w
low = defaultdict(list)
for r in csv.DictReader(open('data/brackets/lower_entrants.csv')):
    if r['level'] == 'district' and r['place'] == '1': low[(r['unit'], r['cls'], r['year'], wkey(r['weight']))].append(r)
st = defaultdict(list)
for r in csv.DictReader(open('data/brackets/state_entrants.csv')): st[(r['year'], r['cls'], wkey(r['weight']))].append(r)
out = []
for unit, fn in (('D3', 'data/sources/d3_champions.csv'), ('D7', 'data/sources/d7_champions.csv')):
    rows = list(csv.DictReader(open(fn)))
    a_n = a_ok = s_n = s_ok = 0; mism = []
    for r in rows:
        k = (unit, r['cls'], r['year'], wkey(r['weight']))
        if k in low:
            a_n += 1; ok = any(near(last(x['name']), last(r['name'])) for x in low[k]); a_ok += ok
            if not ok and len(mism) < 6: mism.append(f"{r['year']} {r['cls']} {r['weight']}: src {r['name']} / archive {low[k][0]['name']}")
        # state seed: district place 1 before 1951 is seed "1" with region == district number; after 1951 seeds are regional
        if int(r['year']) < 1951:
            cands = [x for x in st.get((r['year'], r['cls'], wkey(r['weight'])), []) if x['region'] == unit[1:] and x['seed'] == '1']
            if cands: s_n += 1; s_ok += any(near(last(x['name']), last(r['name'])) for x in cands)
    out.append(f"{unit}: {len(rows)} champions; vs archive district champions: {a_ok}/{a_n} agree incl. spelling variants ({100*a_ok/max(a_n,1):.1f}%); vs pre-1951 state seed {unit[1:]}-1: {s_ok}/{s_n} ({100*s_ok/max(s_n,1):.1f}%)")
    out += ['  e.g. ' + m for m in mism]
print('\n'.join(out))
open('data/sources/validation.txt', 'w').write('\n'.join(out) + '\n')
