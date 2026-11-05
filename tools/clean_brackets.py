"""Clean wrestler names in the parsed bracket CSVs (run after parse_lower.py / parse_bouts.py, before ratings.py).

    python3 tools/clean_brackets.py            rewrites data/brackets/lower_entrants.csv and bouts.csv in place
    python3 tools/clean_brackets.py --check    exits 1 if anything is still left to clean (used by check_integrity)
    python3 tools/clean_brackets.py --dir=data/brackets/league     another folder
parse_lower.py and parse_bouts.py run it on their output folder after writing, so a re-parse comes out clean.

The PDF parsers leave text in the name column that is not a wrestler. Every rule is idempotent:
  entrants (lower_entrants.csv)
    1. team-score blocks parsed as a weight ("Place", "1.", "54.0" at weight 10/12): rows at a weight under 80 dropped
    2. not a wrestler: "Forfeit", "Double Forfeit", "Bye", bare numbers, result text ("Sup. Dec. 13-1"): dropped
    3. seed prefixes the parser missed ("LL2-1 ", "1A-1 ", "6--1 ", "3 "): moved to the seed column
    4. grade printed after the name or school ("John Davies 8th", "Dallas, 8th"): moved to the grade column
    4b. the name's last letter printed inside the school ("Stephen Laudermilc", "Nhortheast Bradford"): moved back
    5. phantom placers whose "name" is a school line ("Abington Heights, JR 1") or was lost ("Forfeit", place 1,
       Northern Lehigh): the place goes to the one unplaced entrant of that school in the bracket; the row is dropped
    5b. garbled rows whose school is another wrestler of the bracket ("Ray Worsen", school "Ethan Totin", 7th): the
       place goes to that wrestler's own row, the garbled row is dropped
    6. the same wrestler twice in one bracket (placer row + entrant row): merged into one row
    7. blank school filled from the bracket's own bouts when exactly one school goes with that name
  bouts (bouts.csv)
    8. a side that is not a wrestler ("Forfeit", "Double Forfeit", "Bye"): bout dropped (no contest)
    9. result text glued to a name ("T. Rosengrant (PNMT)Fall 2:36") cut off; seed prefixes stripped; a side with no school ("J. Boudreau", " SE-1 Gerald (Jerry) WilliamsManheim Central,
       SR, 19-0-1", " ? Hibbard Haverford High") resolved to the bracket's entrant when exactly one entrant fits
Names whose first name is unknown in the source ("? Miller") are real wrestlers and are kept.
Writes data/brackets/clean_report.txt.
"""
import csv, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BR = os.environ.get('BRACKETS', os.path.join(ROOT, 'data', 'brackets'))

JUNK = re.compile(r'^(?:(?:double\s+)?forfeit|forf\.?|bye|place|pts|points|team|tbd|vacant|open|none|n/?a)$', re.I)
NUM = re.compile(r'^[\d.\s,-]+$')
RESULT = re.compile(r'^(?:sup\.?|maj\.?|tech\.?|dec\.?|fall|tf|def\.?|inj\.?|dq|disq\.?|forf\.?|med\.?|ff)(?:\s|$)', re.I)
SLOT = re.compile(r'^[A-Z?]\.?\s.+\([A-Z0-9&\-]{1,6}\)\s*(?:Dec|Maj|Fall|TF|Disq|DQ|Sup|Def|Inj|Forf|Med|Bye)', re.I)   # a later-round slot "F. Last (ABBR)Dec. 8-2", not an entrant
SEED = re.compile(r'^(?:[A-Z]{1,3}\d?|\d{1,2}[A-Z]?)-{1,2}\d{1,2}\s+(?=\S)|^\d{1,2}\s+(?=[A-Z?])')
GRADE_TAIL = re.compile(r',?\s+(\d{1,2}(?:st|nd|rd|th))$')
SCHOOL_GRADE = re.compile(r'^(.+?),\s*(FR|SO|JR|SR)\s*,\s*-?[\d-]+$')   # school cell that swallowed grade and a garbled record: "Maplewood, JR, -1-17"
SCHOOL_LINE = re.compile(r'^(.+?),\s*(FR|SO|JR|SR|Fr|So|Jr|Sr|\d{1,2}(?:th)?)\b(?:,\s*\d+-\d+(?:-\d+)?\s*\d?|\s+\d)\s*$')   # needs a record or a place: "Josh Barlow, Jr" is a wrestler
GLUE = re.compile(r'(?<=\))\s*(?:Dec|Maj|Fall|TF|Disq|DQ|Sup|Def|Inj|Forf|Med)\b.*$', re.I)
NOT_WRESTLER = lambda n: bool(JUNK.match(n) or NUM.match(n) or RESULT.match(n) or SLOT.match(n))


def key(s):
    return re.sub(r'[^a-z?]', '', re.sub(r'\([^)]*\)', ' ', s or '').lower())


def last_key(s):
    t = re.sub(r'\([^)]*\)', ' ', s or '').split()
    return key(t[-1]) if t else ''


def read(name):
    with open(os.path.join(BR, name), newline='') as f:
        r = csv.DictReader(f); return r.fieldnames, list(r)


def write(name, fields, rows):
    p = os.path.join(BR, name)
    with open(p + '.tmp', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator='\r\n'); w.writeheader(); w.writerows(rows)
    os.replace(p + '.tmp', p)


def weight_ok(w):
    return not (w.isdigit() and int(w) < 80)


def order_key(sc, x):
    """how early the stray letters sit in sc, read in order (smaller = the letters taken as soon as they appear)"""
    pos, j = [], 0
    for ch in x:
        j = sc.index(ch, j); pos.append(j); j += 1
    return pos


WOVEN = {}   # (tournament, weight, garbled name, garbled school) -> (name, school), from 4c, applied to the bouts too


def unweave(sc, k):
    """sc is k with 2-10 lowercase letters woven into k's first word: every way to read it as (k, those letters)."""
    sp = sc.find(' '); first = sp if sp > 0 else len(sc)
    from functools import lru_cache

    @lru_cache(maxsize=None)
    def go(j, i, started, woven):   # position in sc, in k; a stray letter seen; a school letter after one
        if j == len(sc): return {''} if i == len(k) and woven else set()
        out = set(); ch = sc[j]
        if i < len(k) and ch == k[i]: out |= go(j + 1, i + 1, started, woven or (started and j < first))
        if j < first and ch.islower(): out |= {ch + x for x in go(j + 1, i, True, woven)}
        return out
    return {(k, x) for x in go(0, 0, False, False) if 2 <= len(x) <= 10}


def clean_entrants(E, B, rep):
    out = []
    for r in E:
        r['name'] = r['name'].strip(); r['school'] = r['school'].strip()
        if not weight_ok(r['weight']): rep['entrants: team-score line at a non-weight'] += 1; continue
        if NOT_WRESTLER(r['name']):
            rep[f"entrants: not a wrestler ({'Forfeit' if 'forfeit' in r['name'].lower() else 'number/result/label'})"] += 1
            if r['place'] and r['school'] and not RESULT.match(r['school']): r['_junk'] = 1; out.append(r)   # placer whose name was lost: rule 5
            continue
        m = SEED.match(r['name'])
        if m:
            if not r['seed']: r['seed'] = m.group(0).strip().replace('--', '-')
            r['name'] = r['name'][m.end():].strip(); rep['entrants: seed prefix moved to seed'] += 1
        if RESULT.match(r['school']): r['school'] = ''
        for col in ('name', 'school'):
            g = GRADE_TAIL.search(r[col])
            if g:
                r[col] = r[col][:g.start()].strip()
                if not r['grade']: r['grade'] = g.group(1)
                rep['entrants: grade moved out of name/school'] += 1
        g = SCHOOL_GRADE.match(r['school'])
        if g:
            r['school'] = g.group(1).strip()
            if not r['grade']: r['grade'] = g.group(2)
            rep['entrants: grade and record cut from school'] += 1
        out.append(r)
    # 4b. the name's last letter printed inside the school ("Stephen Laudermilc", "Nhortheast Bradford"): put it back
    n = Counter(r['school'] for r in out)
    for r in out:
        sc = r['school']
        if len(sc) > 4 and n[sc] <= 30 and n[sc[0] + sc[2:]] >= 20 * n[sc] and r['name'][-1:].isalpha():
            r['name'] += sc[1]; r['school'] = sc[0] + sc[2:]; rep['entrants: letter moved back from school to name'] += 1
    # 4c. the end of the name woven letter by letter into the school's first word ("Que'Shawn Jenkins-Bar",
    #     "Bkissdhaolpe McDevitt (3)" = "Bishop" + "ksdale"): take the known school back out, the rest ends the name
    n = Counter(r['school'] for r in out)
    known = [k for k, c in n.items() if c >= 20 and len(k) >= 4]
    names = set(r['name'] for r in out)
    for r in out:
        sc = r['school']
        if n[sc] > 3 or not r['name'][-1:].isalpha(): continue
        hits = set().union(*[unweave(sc, k) for k in known if k[0] == sc[:1] and len(k) < len(sc)])
        if len({k for k, _ in hits}) == 1 and hits:
            # the letters can often be read more than one way ("Higginbot" + "ham"/"hma"): take the reading that gives a
            # name seen elsewhere, else the one that keeps the letters in the order they were printed (the first found)
            seen = [h for h in hits if (r['name'] + h[1]) in names]
            k, extra = (seen or sorted(hits, key=lambda h: order_key(sc, h[1])))[0]
            WOVEN[(r['tournament'], r['weight'], r['name'], sc)] = (r['name'] + extra, k)
            r['name'] += extra; r['school'] = k; rep['entrants: name letters woven into school taken back out'] += 1
    # group by bracket
    by = defaultdict(list)
    for r in out: by[(r['level'], r['tournament'], r['weight'])].append(r)
    bs = defaultdict(lambda: defaultdict(set))   # bracket -> name key -> schools seen in its bouts
    for b in B:
        for s in ('winner', 'loser'):
            if b[s + '_school'].strip(): bs[(b['level'], b['tournament'], b['weight'])][key(b[s])].add(b[s + '_school'].strip())
    keep = []
    for bk, rows in by.items():
        drop = set()
        # 5. phantom placer: name is a school line
        for i, r in enumerate(rows):
            m = SCHOOL_LINE.match(r['name'])
            if not m and not r.get('_junk'): continue
            sch = r['school']; place = r['place']
            cand = [x for j, x in enumerate(rows) if j != i and j not in drop and not SCHOOL_LINE.match(x['name']) and not x.get('_junk')
                    and not x['place'] and sch and key(x['school']) == key(sch)]
            if place and len(cand) == 1: cand[0]['place'] = place; rep['entrants: phantom placer, place given to its wrestler'] += 1
            else: rep['entrants: phantom school-line row dropped'] += 1
            drop.add(i)
        # 5b. garbled row whose "school" is another wrestler of the same bracket ("Logan Harmon", school "Tyler Bender")
        names = {key(r['name']) for r in rows}
        for i, r in enumerate(rows):
            if i not in drop and r['school'] and key(r['school']) in names:
                drop.add(i); twin = [x for j, x in enumerate(rows) if j != i and j not in drop and key(x['name']) == key(r['name']) and not x['place']]
                if r['place'] and len(twin) == 1: twin[0]['place'] = r['place']; rep['entrants: garbled row (school is a wrestler), place given to its wrestler'] += 1
                else: rep['entrants: garbled row (school is a wrestler) dropped'] += 1
        # 6. duplicates: same name key in one bracket
        seen = {}
        for i, r in enumerate(rows):
            if i in drop: continue
            k = key(r['name'])
            if k in seen:
                a = rows[seen[k]]
                if a['school'] and r['school'] and key(a['school'])[:6] != key(r['school'])[:6]: continue   # two kids, same name
                for c in ('place', 'seed', 'school', 'grade', 'record'):
                    if not a[c] and r[c]: a[c] = r[c]
                drop.add(i); rep['entrants: duplicate row merged'] += 1
            else: seen[k] = i
        # 7. blank school from the bracket's bouts
        for i, r in enumerate(rows):
            if i in drop or r['school']: continue
            s = bs[bk].get(key(r['name']), set())
            if len(s) == 1: r['school'] = next(iter(s)); rep['entrants: blank school filled from bouts'] += 1
        keep += [r for i, r in enumerate(rows) if i not in drop]
    for r in keep: r.pop('_junk', None)
    order = {id(r): i for i, r in enumerate(out)}
    keep.sort(key=lambda r: order[id(r)])
    rep['entrants: still no school (kept)'] = sum(1 for r in keep if not r['school'])
    return keep


def clean_bouts(B, E, S, rep):
    ents = defaultdict(list)   # bracket -> [(name, school)]
    for r in E: ents[(r['level'], r['tournament'], r['weight'])].append((r['name'], r['school']))
    for r in S: ents[('state', f"{r['year']}_{r['cls']}", r['weight'])].append((r['name'], r['school']))

    def resolve(raw, bk):
        s = SEED.sub('', raw.strip()).strip()
        cands = ents.get(bk, [])
        k = key(s)
        if not k: return None
        hit = [c for c in cands if key(c[0]) == k and c[1]]
        if len(hit) != 1: hit = [c for c in cands if c[1] and k.startswith(key(c[0])) and len(key(c[0])) >= 5]   # "NameSchool, GR, rec"
        if len(hit) != 1:   # "J. Boudreau" / "?. Gourley": initial + last name
            m = re.match(r'^([A-Z?])\.?\s+(.+?)(?:\s*\([A-Z0-9&\-]{1,6}\))?$', s)
            if m:
                ini, last = m.group(1).lower(), key(m.group(2))
                hit = [c for c in cands if c[1] and last_key(c[0]) == last and (ini == '?' or key(c[0])[:1] == ini)]
        if len(hit) != 1:   # "? Hibbard Haverford High": name followed by its school
            hit = [c for c in cands if c[1] and k.startswith(key(c[0])) and key(c[1])[:6] in k[len(key(c[0])):]]
        if len(hit) == 1: return hit[0]
        # not among the bracket's entrants (the state entrant lists have gaps): split "Name School, GR, rec" on a known school
        t = re.sub(r',\s*(?:FR|SO|JR|SR|\d{1,2}(?:th)?)\b.*$', '', s, flags=re.I).strip()
        for sch in SCHOOLS:
            if t.endswith(sch) and len(t) > len(sch):
                nm = t[:-len(sch)].strip()
                if len(nm.split()) >= 2 and not re.search(r'\d', nm): return (nm, sch)
            k = len(sch) + 1   # "HarnatkiewicNzeshaminy-Maple Point": the name's last letter sits inside the school
            if len(t) > k and t.endswith(sch[1:]) and t[-k] == sch[0] and t[-k - 1] != ' ':
                nm = t[:-k] + t[-k + 1]
                if len(nm.split()) >= 2 and not re.search(r'\d', nm): return (nm, sch)
        return None

    sn = Counter(r['school'] for r in E) + Counter(r['school'] for r in S)
    SCHOOLS = sorted((x for x in sn if len(x) >= 4 and sn[x] >= 3), key=len, reverse=True)
    out = []
    for b in B:
        for side in ('winner', 'loser'):   # "T. Rosengrant (PNMT)Fall 2:36": the result is glued on, the name is real
            g = GLUE.search(b[side])
            if g: b[side] = b[side][:g.start()].rstrip(); rep['bouts: result text cut off a name'] += 1
        if NOT_WRESTLER(b['winner'].strip()) or NOT_WRESTLER(b['loser'].strip()): rep['bouts: side is not a wrestler, dropped'] += 1; continue
        bk = (b['level'], b['tournament'], b['weight'])
        for s in ('winner', 'loser'):
            w = WOVEN.get((b['tournament'], b['weight'], b[s], b[s + '_school']))
            if w: b[s], b[s + '_school'] = w; rep['bouts: name letters woven into school taken back out'] += 1
            n = b[s].strip(); m = SEED.match(n)
            if m: n = n[m.end():].strip(); rep['bouts: seed prefix stripped'] += 1
            b[s] = n
            if not b[s + '_school'].strip():
                hit = resolve(n, bk)
                if hit: b[s], b[s + '_school'] = hit; rep['bouts: name resolved to its entrant'] += 1
                else: rep['bouts: side still has no school (kept)'] += 1
        out.append(b)
    return out


def junk_left(E, B):
    bad = [r['name'] for r in E if not weight_ok(r['weight']) or NOT_WRESTLER(r['name']) or SEED.match(r['name']) or SCHOOL_LINE.match(r['name'])]
    bad += [b[s] for b in B for s in ('winner', 'loser') if NOT_WRESTLER(b[s].strip()) or SEED.match(b[s]) or GLUE.search(b[s]) or b[s] != b[s].strip()]
    return bad


def run(folder=None, check=False):
    """Clean (or with check=True only count) the CSVs in folder; the parsers call this after they write."""
    global BR
    if folder: BR = folder
    if not all(os.path.exists(os.path.join(BR, f)) for f in ('lower_entrants.csv', 'bouts.csv')):
        print('clean_brackets: lower_entrants.csv and bouts.csv not both in', BR, '- skipped'); return 0
    ef, E = read('lower_entrants.csv'); bf, B = read('bouts.csv')
    S = read('state_entrants.csv')[1] if os.path.exists(os.path.join(BR, 'state_entrants.csv')) else []
    if check:
        bad = junk_left(E, B)
        print(f'{len(bad)} names left to clean' + (f': {Counter(bad).most_common(8)}' if bad else ''))
        return len(bad)
    rep = Counter(); n0e, n0b = len(E), len(B)
    for _ in range(6):   # entrant schools filled from bouts let more bout names resolve, and back: repeat to a fixed point
        r = Counter(); E = clean_entrants(E, B, r); B = clean_bouts(B, E, S, r)
        moved = {k: v for k, v in r.items() if 'still' not in k and 'seed prefix stripped' not in k}
        for k, v in r.items():
            if 'still' in k: rep[k] = v
            else: rep[k] += v
        if not moved: break
    write('lower_entrants.csv', ef, E); write('bouts.csv', bf, B)
    lines = [f'entrants {n0e} -> {len(E)}, bouts {n0b} -> {len(B)}'] + [f'{v:7d}  {k}' for k, v in sorted(rep.items())]
    open(os.path.join(BR, 'clean_report.txt'), 'w').write('\n'.join(lines) + '\n'); print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    d = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--dir=')), None)
    sys.exit(1 if run(d, '--check' in sys.argv) else 0)
