#!/usr/bin/env python3
"""Put every state place winner in data/medals/*.csv at the place the official bracket prints.

The medal lists were typed in separately from the brackets. In some seasons places 3-8 came in shuffled
(2016 AAA 145: 4 Edwards, 5 Gardner, 6 Port, 7 Martoccio, where the bracket's "Place Winners" box and the
placement bouts both say 4 Martoccio, 5 Gardner, 6 Edwards, 7 Port). The box on each weight's page is the
reference: tools/parse_state.py --places reads it into data/brackets/state_places.csv.

For each weight:
  - a wrestler in the list who is in the box gets the box's place (matched on last name, then first initial)
  - a season or weight missing from the lists is filled from the box (1954)
  - a spelling difference only ("Illingsworth" / "Illingworth") is left as the list has it and reported
Writes the corrected CSVs in place and data/sources/state_places_report.txt.

Usage: python3 tools/sync_state_places.py [--dry]
Then: python3 tools/clean_brackets.py (name merges), node tools/build_medals.js, and the rest of the build.
"""
import csv, os, re, sys, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MED = os.path.join(ROOT, 'data', 'medals')
REF = os.path.join(ROOT, 'data', 'brackets', 'state_places.csv')
REPORT = os.path.join(ROOT, 'data', 'sources', 'state_places_report.txt')

def wnorm(w):
    w = str(w).strip().upper()
    w = re.sub(r'\s*LBS?\.?$', '', w)
    return 'UNL' if re.match(r'^(UNL|HWT|HEAVY|UNLIMITED|HVY)', w) else w.lstrip('0')

def pnum(p):
    m = re.search(r'\d+', str(p)); return int(m.group(0)) if m else None

def last(n):
    n = re.sub(r'\(.*?\)', ' ', n or '')
    n = re.sub(r'\b(Jr|Sr|II|III|IV)\.?$', '', n.strip())
    t = re.sub(r"[^a-z\- ]", '', n.lower()).split()
    return t[-1].replace('-', '') if t else ''

def first(n):
    t = re.sub(r'\(.*?\)', ' ', n or '').strip().lower()
    return t[:1]

def main():
    dry = '--dry' in sys.argv
    ref = collections.defaultdict(dict)
    for r in csv.DictReader(open(REF)):
        ref[(r['year'], r['cls'], wnorm(r['weight']))][int(r['place'])] = r
    rep, moved_w, moved_rows, added = [], [], 0, 0
    files = sorted(f for f in os.listdir(MED) if re.match(r'^\d{4}_(AAA|AA|single)\.csv$', f))
    seen_keys = set()
    for f in files:
        y, c = f[:-4].split('_')
        path = os.path.join(MED, f)
        rows = list(csv.reader(open(path, newline='')))
        if not rows: continue
        head, body = rows[0], rows[1:]
        byw = collections.OrderedDict()
        for r in body:
            if len(r) < 4: continue
            byw.setdefault(wnorm(r[0]), []).append(r)
        out = []
        weights = list(byw) + [w for (yy, cc, w) in ref if yy == y and cc == c and w not in byw]
        for w in weights:
            k = (y, c, w); seen_keys.add(k)
            box = ref.get(k)
            lst = byw.get(w, [])
            if not box:
                out += lst; continue
            if not lst:
                # whole weight missing from the lists: take it from the box
                for p in sorted(box):
                    b = box[p]; out.append([w, str(p), b['name'], b['school']]); added += 1
                rep.append(f'{y} {c} {w}: added from the bracket ({len(box)} places)')
                continue
            new, notes = [], []
            for r in lst:
                p0 = pnum(r[1])
                hits = [p for p, b in box.items() if last(b['name']) == last(r[2])]
                if len(hits) > 1: hits = [p for p in hits if first(box[p]['name']) == first(r[2])] or hits
                if len(hits) == 1 and hits[0] != p0:
                    notes.append(f'{r[2]} {p0}->{hits[0]}')
                    r = [r[0], str(hits[0])] + r[2:]
                elif not hits and p0 in box:
                    rep.append(f'{y} {c} {w} place {p0}: list "{r[2]}", bracket "{box[p0]["name"]}" (spelling only, list kept)')
                new.append(r)
            # a place the box has and the list lacks
            have = {pnum(r[1]) for r in new}
            for p in sorted(set(box) - have):
                b = box[p]; new.append([w, str(p), b['name'], b['school']]); added += 1
                notes.append(f'{b["name"]} added at {p}')
            dup = [p for p, n in collections.Counter(pnum(r[1]) for r in new).items() if n > 1]
            if dup: rep.append(f'{y} {c} {w}: two wrestlers at place {dup} after the move, check by hand')
            if notes:
                moved_w.append(f'{y} {c} {w}: ' + '; '.join(notes)); moved_rows += sum('->' in n for n in notes)
            new.sort(key=lambda r: pnum(r[1]) or 99)
            out += new
        if not dry and out != body:
            with open(path, 'w', newline='') as fh:
                cw = csv.writer(fh, lineterminator='\n'); cw.writerow(head); cw.writerows(out)
    # seasons with no list file at all
    for k in sorted(set(ref) - seen_keys):
        rep.append(f'{k[0]} {k[1]} {k[2]}: in the brackets, no medal file for the season')
    txt = [f'weights reordered: {len(moved_w)}, wrestlers moved: {moved_rows}, rows added: {added}', ''] + moved_w + [''] + rep
    if not dry:
        open(REPORT, 'w').write('\n'.join(txt) + '\n')
    print('\n'.join(txt[:1]))
    return moved_w, rep

if __name__ == '__main__':
    main()
