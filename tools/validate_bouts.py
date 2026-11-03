#!/usr/bin/env python3
"""Validate data/brackets/bouts.csv against parsed placements and report coverage by level x decade.
Usage: python3 -I tools/validate_bouts.py   (run from the repo root) -> data/brackets/bouts_validation.txt"""
import csv, json, re
from collections import defaultdict, Counter

def nk(s): return re.sub(r'[^a-z]', '', re.sub(r'\([^)]*\)', '', (s or '').lower()))
def wn(w):
    m = re.match(r'\d+', str(w)); return int(m.group()) if m else 999

bouts = list(csv.DictReader(open('data/brackets/bouts.csv')))
place1 = {}
for r in csv.DictReader(open('data/brackets/lower_entrants.csv')):
    if r['place'] == '1': place1[(r['level'], r['tournament'], wn(r['weight']))] = nk(r['name'])
med = json.loads(open('overtime/medals.js').read().split('window.WR_MEDALS=', 1)[1].split(';')[0])
for y, c, w, p, n, s, d in med:
    if p == 1: place1[('state', y, c, wn(w))] = nk(n)

def skey(b):
    if b['level'] == 'state':
        c = b['cls'] if b['cls'] in ('AAA', 'AA') else 'single'
        return ('state', int(b['year']), c, wn(b['weight']))
    return (b['level'], b['tournament'], wn(b['weight']))

by = defaultdict(list)
for b in bouts: by[(b['level'], b['tournament'], b['weight'])].append(b)
cov = defaultdict(Counter); ok = bad = miss = 0; bad_ex = []
for (lvl, t, w), bs in by.items():
    dec = (int(bs[0]['year']) // 10) * 10
    champ = [b for b in bs if b['side'] == 'champ']
    final = [b for b in champ if b['round'] == '0']
    cons = [b for b in bs if b['side'] != 'champ']
    cov[(lvl, dec)]['brackets'] += 1
    if final: cov[(lvl, dec)]['final'] += 1
    # a full championship side = the final plus every bout down to the first round: n_champ >= entrants-1 is unknown here,
    # so use a structural proxy: the final's winner wins log2-ish bouts and every champ bout's winner appears later
    if final and len(champ) >= 3: cov[(lvl, dec)]['champ_side'] += 1
    if cons: cov[(lvl, dec)]['cons_side'] += 1
    k = skey(bs[0])
    want = place1.get(k)
    if champ:
        if want is None: miss += 1
        else:
            won = any(nk(b['winner']) == want for b in champ); lost = any(nk(b['loser']) == want for b in champ)
            if won and not lost and (not final or nk(final[0]['winner']) == want): ok += 1
            else:
                bad += 1
                if len(bad_ex) < 12: bad_ex.append(f'{lvl} {t} {w}: final winner {final[0]["winner"] if final else "-"}; place-1 {want}; won {won} lost {lost}')
# bouts per placer (plausibility)
wins = Counter(); tot = Counter()
for b in bouts:
    k = (b['level'], b['tournament'], b['weight'])
    wins[(k, nk(b['winner']))] += 1; tot[(k, nk(b['winner']))] += 1; tot[(k, nk(b['loser']))] += 1
champ_bouts = Counter()
for (lvl, t, w), bs in by.items():
    f = [b for b in bs if b['side'] == 'champ' and b['round'] == '0']
    if f: champ_bouts[tot[((lvl, t, w), nk(f[0]['winner']))]] += 1
types = Counter(b['result'] for b in bouts)
lines = [f'bouts {len(bouts)}  brackets {len(by)}',
         f'champion check (place-1 wins in the bouts, never loses, and wins the final when one is found): match {ok}, mismatch {bad}, no place-1 to compare {miss}  ({100*ok/max(1,ok+bad):.2f}% agree)',
         'mismatch examples:'] + ['  ' + e for e in bad_ex] + [
         'bouts wrestled by the champion (count -> brackets): ' + ', '.join(f'{k}:{v}' for k, v in sorted(champ_bouts.items())),
         'result types: ' + ', '.join(f'{k}:{v}' for k, v in types.most_common()),
         '', 'coverage by level x decade (brackets with a final / full champ side / consolation side):']
for (lvl, dec) in sorted(cov):
    c = cov[(lvl, dec)]; n = c['brackets']
    lines.append(f'  {lvl:9s} {dec}s  brackets {n:5d}  final {100*c["final"]/n:5.1f}%  champ side {100*c["champ_side"]/n:5.1f}%  consolation {100*c["cons_side"]/n:5.1f}%')
open('data/brackets/bouts_validation.txt', 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
