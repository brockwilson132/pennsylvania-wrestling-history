#!/usr/bin/env python3
"""Sanity and consistency audit of the wrestler ratings. Numbers feed docs/RATING_AUDIT.md.
Usage: python3 -I tools/rating_audit.py <wrestler_seasons.csv> [rating column] [label]
"""
import csv, json, re, sys
from collections import defaultdict, Counter
import numpy as np
from scipy.stats import spearmanr
nk = lambda s: re.sub(r'[^a-z]', '', re.sub(r'\([^)]*\)', '', (s or '').lower()))
def wn(w):
    m = re.match(r'\d+', str(w)); return int(m.group()) if m else 999
f = sys.argv[1]; col = sys.argv[2] if len(sys.argv) > 2 else 'season'; label = sys.argv[3] if len(sys.argv) > 3 else f
med = json.loads(open('overtime/medals.js').read().split('window.WR_MEDALS=', 1)[1].split(';')[0])
place = {(y, c, wn(w), nk(n)): p for y, c, w, p, n, s, d in med}
titles = Counter(); medals = Counter()
for y, c, w, p, n, s, d in med:
    k = nk(n) + '|' + nk(s); medals[k] += 1
    if p == 1: titles[k] += 1
rows = list(csv.DictReader(open(f)))
print(f'== {label}: {len(rows)} wrestler-tournaments, rating column "{col}"')
# one value per wrestler-season (the season rating is shared by every tournament of that season)
season = {}
for r in rows:
    if r[col] == '': continue
    season[(nk(r['name']) + '|' + nk(r['school']), int(r['year']))] = (float(r[col]), r['name'], r['school'], r['cls'])
# ---- state brackets: champion #1, Spearman with place
st = defaultdict(list)
for r in rows:
    if r['level'] != 'state' or r[col] == '': continue
    y = int(r['year']); c = r['cls']
    p = place.get((y, c, wn(r['weight']), nk(r['name'])))
    st[(r['tournament'], r['weight'])].append((float(r[col]), p or 9, r['name']))
ch1 = top2 = nb = 0; rhos = []
for bk, es in st.items():
    if len(es) < 6 or not any(p == 1 for _, p, _ in es): continue
    nb += 1; es.sort(key=lambda e: -e[0])
    rank = [p for _, p, _ in es]
    if rank[0] == 1: ch1 += 1
    if 1 in rank[:2]: top2 += 1
    rh = spearmanr([-e[0] for e in es], [e[1] for e in es]).correlation
    if not np.isnan(rh): rhos.append(rh)
print(f'state brackets with a champion and 6+ rated entrants: {nb}; champion rated #1 in {ch1/nb:.1%}, top 2 in {top2/nb:.1%}; '
      f'mean Spearman(rating, place) {np.mean(rhos):.3f}')
# ---- head-to-head inversions: same-season bout where the winner is rated below the loser
inv = n = big = 0
for b in csv.DictReader(open('data/brackets/bouts.csv')):
    if b['result'] in ('ff', 'inj', 'dq'): continue
    y = int(b['year']); w = season.get((nk(b['winner']) + '|' + nk(b['winner_school']), y)); l = season.get((nk(b['loser']) + '|' + nk(b['loser_school']), y))
    if not w or not l: continue
    n += 1
    if w[0] < l[0]: inv += 1
    if w[0] < l[0] - 100: big += 1
print(f'same-season bouts: {n}; winner rated below loser {inv/n:.1%} (by 100+ points {big/n:.1%})')
# ---- top seasons and careers
top = sorted(season.items(), key=lambda kv: -kv[1][0])[:50]
print('\ntop 50 wrestler-seasons:')
for (k, y), (v, nm, sc, c) in top:
    print(f'  {v:6.0f} {y} {c:6s} {nm} ({sc}) titles {titles[k]} medals {medals[k]}')
car = defaultdict(list)
for (k, y), v in season.items(): car[k].append((v[0], y, v[1], v[2]))
peaks = sorted(car.items(), key=lambda kv: -max(x[0] for x in kv[1]))[:50]
print('\ntop 50 careers by peak:')
for k, ss in peaks:
    pk = max(ss); print(f'  {pk[0]:6.0f} peak {pk[1]} {pk[2]} ({pk[3]}) seasons {len(ss)} titles {titles[k]} medals {medals[k]}')
multi = [k for k in titles if titles[k] >= 3]
pk_all = sorted((max(x[0] for x in v) for v in car.values()), reverse=True)
def pct(v): return 100 * (1 - np.searchsorted(-np.array(pk_all), -v) / len(pk_all))
ps = [pct(max(x[0] for x in car[k])) for k in multi if k in car]
print(f'\n3x+ state champions: {len(multi)}, rated {len(ps)}; peak percentile median {np.median(ps):.2f}, min {min(ps):.2f}; '
      f'in the all-time top 50 by peak: {sum(1 for k, _ in peaks if titles[k] >= 3)}, top 200: {sum(1 for k in multi if k in car and max(x[0] for x in car[k]) >= pk_all[199])}')
