"""Find one wrestler filed under two spellings at one school and write the merge list clean_brackets.py applies.

    python3 tools/find_name_merges.py            writes data/sources/name_merges.csv and data/sources/name_merges_report.txt
Run it on cleaned data (after clean_brackets.py); rows from an earlier run are kept, so running it again after the
list has been applied does not lose them. clean_brackets.py applies the list to the bracket CSVs, the state medal files
(data/medals) and the district champion lists (data/sources/d*_champions.csv). After a change to the list:
    python3 tools/clean_brackets.py && node tools/build_medals.js && node tools/build_brackets.js
    cp site/medals.js site/brackets.js overtime/        then the usual pipeline from ratings.py

The archive spells a wrestler differently from bracket to bracket (Jim Reimert / James Reimert / Jim Reinert at
Allentown Allen). ratings.py already pools such variants with tools/identity.py, but the app keys people by the
spelling, so the all-time lists showed one wrestler twice. This finds the pairs with identity.py's name rules and
keeps only the ones a reader would accept without the PDFs:
  - the same school, spelled the same
  - full first names on both (an initial is resolved by the bout cleaner, not here)
  - overlapping or adjacent seasons (no gap over one season), and a combined career of at most four seasons
  - grades, where both have one, give the same graduating class
  - no conflicting results: never both entered in one tournament (twins wrestle at two weights), never in the same
    round of one bracket, never opponents
The surviving pairs are grouped, and every spelling in a group is rewritten to the one printed most often (ties go
to the spelling used at states, then the longer one). The list is a reviewed source file: edit it by hand to keep a
pair apart (delete its row) and rerun clean_brackets.py.
"""
import csv, os, re, sys
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BR = os.path.join(ROOT, 'data', 'brackets'); SRC = os.path.join(ROOT, 'data', 'sources')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from identity import canon_map, first_last

nk = lambda s: re.sub(r'[^a-z]', '', re.sub(r'\([^)]*\)', '', (s or '').lower()))
GR = {'FR': 1, 'SO': 2, 'JR': 3, 'SR': 4, '9': 1, '10': 2, '11': 3, '12': 4, '9th': 1, '10th': 2, '11th': 3, '12th': 4}


def rows(name):
    with open(os.path.join(BR, name), newline='') as f: return list(csv.DictReader(f))


def main():
    LE, SE, B = rows('lower_entrants.csv'), rows('state_entrants.csv'), rows('bouts.csv')
    recs = []                                   # (name, school, year, weight) for identity.canon_map
    spell = defaultdict(Counter)                # key -> spelling -> rows
    at_states = defaultdict(Counter)            # key -> spelling -> state entrant rows
    years = defaultdict(set); grads = defaultdict(set)
    entered = defaultdict(set)                  # bracket -> keys entered
    tourn = defaultdict(set)                    # tournament -> keys entered at any weight (twins wrestle at two weights)
    rounds = defaultdict(lambda: defaultdict(set))   # bracket -> key -> rounds wrestled
    opp = defaultdict(set)
    K = lambda n, s: nk(n) + '|' + nk(s)
    for r in LE:
        k = K(r['name'], r['school']); y = int(r['year']); recs.append((r['name'], r['school'], y, r['weight'], r['tournament']))
        spell[k][r['name']] += 1; years[k].add(y); entered[(r['level'], r['tournament'], r['weight'])].add(k); tourn[(r['level'], r['tournament'])].add(k)
        if r['grade'] in GR: grads[k].add(y + 4 - GR[r['grade']])
    for r in SE:
        k = K(r['name'], r['school']); y = int(r['year']); recs.append((r['name'], r['school'], y, r['weight'], f"{r['year']}_{r['cls']}"))
        spell[k][r['name']] += 1; at_states[k][r['name']] += 1; years[k].add(y); entered[('state', r['year'] + r['cls'], r['weight'])].add(k); tourn[('state', r['year'] + r['cls'])].add(k)
        if r['grade'] in GR: grads[k].add(y + 4 - GR[r['grade']])
    for b in B:
        bk = (b['level'], b['tournament'], b['weight']); y = int(b['year'])
        kw, kl = K(b['winner'], b['winner_school']), K(b['loser'], b['loser_school'])
        for k, n, s in ((kw, b['winner'], b['winner_school']), (kl, b['loser'], b['loser_school'])):
            recs.append((n, s, y, b['weight'], b['tournament'])); spell[k][n] += 1; years[k].add(y); rounds[bk][k].add((b['side'], b['round']))
        opp[kw].add(kl); opp[kl].add(kw)
    canon, merges = canon_map(recs, nk, nk)
    pairs = {tuple(sorted((a, b))) for a, b, _ in merges}
    keep, skipped = [], []
    for a, b in sorted(pairs):
        sa, sb = a.split('|')[1], b.split('|')[1]
        na, nb = spell[a].most_common(1)[0][0], spell[b].most_common(1)[0][0]
        why = None
        if not sa or sa != sb: why = 'different school'
        elif len(first_last(na)[0]) <= 1 or len(first_last(nb)[0]) <= 1: why = 'initial'
        elif min(abs(x - y) for x in years[a] for y in years[b]) > 1: why = 'seasons not adjacent'
        elif max(years[a] | years[b]) - min(years[a] | years[b]) + 1 > 4: why = 'career over four seasons'
        elif grads[a] and grads[b] and not (grads[a] & grads[b]): why = 'grades disagree'
        elif any(a in ks and b in ks for ks in entered.values()): why = 'both entered in one bracket'
        elif any(a in ks and b in ks for ks in tourn.values()): why = 'both entered in one tournament'
        elif b in opp[a]: why = 'wrestled each other'
        elif any(a in rk and b in rk and (rk[a] & rk[b]) for rk in rounds.values()): why = 'same round of one bracket'
        (skipped if why else keep).append((a, b, na, nb, why))
    # group the kept pairs; one spelling per group
    parent = {}
    def find(x):
        while parent.get(x, x) != x: x = parent[x]
        return x
    for a, b, *_ in keep: parent[find(a)] = find(b)
    groups = defaultdict(set)
    for a, b, *_ in keep: groups[find(a)] |= {a, b}
    out = []
    for g in groups.values():
        best = max(g, key=lambda k: (sum(spell[k].values()), sum(at_states[k].values()), len(spell[k].most_common(1)[0][0])))
        to = spell[best].most_common(1)[0][0]
        for k in g:
            for name in spell[k]:
                if name == to: continue
                out.append({'school': k.split('|')[1], 'from': name, 'to': to, 'seasons': '-'.join(str(y) for y in sorted(years[k])[::max(1, len(years[k]) - 1)]),
                            'rows': spell[k][name]})
    # keep what an earlier run found: once clean_brackets has applied the list, the data no longer shows those variants
    path = os.path.join(SRC, 'name_merges.csv'); have = {(r['school'], r['from']) for r in out}
    if os.path.exists(path):
        with open(path, newline='') as f: out += [r for r in csv.DictReader(f) if (r['school'], r['from']) not in have]
    out.sort(key=lambda r: (r['school'], r['to'], r['from']))
    os.makedirs(SRC, exist_ok=True)
    with open(os.path.join(SRC, 'name_merges.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['school', 'from', 'to', 'seasons', 'rows'], lineterminator='\n'); w.writeheader(); w.writerows(out)
    lines = [f'{len(pairs)} candidate pairs from identity.py; {len(keep)} kept, {len(skipped)} skipped; {len(groups)} wrestlers, {len(out)} spellings rewritten', '',
             'skipped:'] + [f'  {why:28s} {na} / {nb} @ {a.split("|")[1]}' for a, b, na, nb, why in sorted(skipped, key=lambda s: s[4])]
    open(os.path.join(SRC, 'name_merges_report.txt'), 'w').write('\n'.join(lines) + '\n'); print(lines[0])


if __name__ == '__main__':
    main()
