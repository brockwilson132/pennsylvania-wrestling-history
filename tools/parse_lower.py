#!/usr/bin/env python3
"""Parse PIAA district and regional bracket PDFs (PA-Wrestling.com archive) into CSVs.

  data/brackets/lower_entrants.csv
      level,tournament,year,cls,unit,weight,place,seed,name,school,grade,record
  data/brackets/lower_teams.csv
      level,tournament,year,cls,unit,place,points,school,abbr
  data/brackets/lower_parse_log.txt   per-file counts + files with <6 weights or no placers

Usage: python3 -I tools/parse_lower.py <district folder> <regional folder> [--jobs N]

Layout (same generator for every year, 1938-2026):
  * page 0 (and sometimes page 1): "Team Scores" table, rows "1. 241.5 Bethlehem Catholic BECA 3 2 3 - 1",
    or "Tournament Teams" (no scores) which we skip.
  * one page per weight: the weight sits top-right (x>440, top<200). First-round entrants are a
    name word (x<135, optional seed prefix like "NE-1", "WC-1", "4-1" or a bare section letter "W")
    paired with a "School, GR, W-L" word on the same row. A "Place Winners" block lists the
    placers: [number] name grade school, one row each (numbers absent in the earliest years).
"""
import csv, os, re, sys
from multiprocessing import Pool
import pdfplumber

SEEDP = re.compile(r'^(?:([A-Z]{1,3}|\d{1,2}(?:/\d{1,2})?)-(\d{1,2})|([A-Z]))\s+(.+)$')
SCHOOL = re.compile(r'^(.+?)(?:,\s*(FR|SO|JR|SR|Fr|So|Jr|Sr|9|10|11|12))?(?:,\s*([\d]+-[\d]+(?:-[\d]+)?))?\s*,?\s*$')
ABBR_TAIL = re.compile(r'\([A-Z0-9&\-]{1,6}\)\s*$')
# a bout tag like "T. Donnelly (CUV)" sits at the end of the text; "(TD)" in "Tom (TD) Donnelly" is a nickname
# and "(West Lawn)" / "(Roseto)" are part of a school's name, so neither should hide the word
TAG_IN = re.compile(r'\([A-Z0-9&\-]{1,6}\)\s*(?:$|[A-Z][a-z]*\.|Fall|Dec|Maj|TF|Bye|DQ|Inj|Def|Forf|Med|FF|\d)')
WEIGHT = re.compile(r'^(\d{2,3}|UNL|Unl|Unlimited|HWT|Hwt|Heavyweight)$')
TEAM = re.compile(r'^(\d+)\.\s+([\d.]+)\s+(.+?)(?:\s+((?=[A-Z0-9&\-]*[A-Z])[A-Z0-9&\-]{1,6}))?(?:\s+(?:[\d\-]+\s*)+)?$')
RESULT = re.compile(r'^(Fall|Dec\.|Sup\. Dec\.|Maj\.|TF|Bye|DQ|Inj\.|Def\.|Forf\.|Med\.|FF|OT|SV|TB|UTB|\d+(st|nd|rd|th) Place|CHAMPION|Champion)')
GRADES = {'FR', 'SO', 'JR', 'SR', '9', '10', '11', '12', 'Fr', 'So', 'Jr', 'Sr'}
GR = {'Fr': 'FR', 'So': 'SO', 'Jr': 'JR', 'Sr': 'SR', '9': 'FR', '10': 'SO', '11': 'JR', '12': 'SR'}
REGION = {'North_East': 'NE', 'North_West': 'NW', 'South_Central': 'SC', 'South_East': 'SE', 'South_West': 'SW', 'West': 'W', 'East': 'E', 'Central_North_West': 'CNW'}

def words(page):
    return page.extract_words(keep_blank_chars=True, x_tolerance=1.2, y_tolerance=2)

def rows_of(ws, tol=3.2):
    """group words into visual rows by top coordinate"""
    out = []
    for w in sorted(ws, key=lambda w: (w['top'], w['x0'])):
        if out and abs(out[-1][0] - w['top']) <= tol: out[-1][1].append(w)
        else: out.append([w['top'], [w]])
    return [sorted(r[1], key=lambda w: w['x0']) for r in out]

def meta(path):
    base = os.path.basename(path)[:-4]
    year, rest = base.split('_', 1); year = int(year)
    parts = rest.split('_'); cls = parts[-1]; unit = '_'.join(parts[:-1])
    if cls in ('A', 'B'): cls = {'A': 'AAA', 'B': 'AA'}[cls]
    if cls.endswith('Super'): cls, unit = parts[-2], '_'.join(parts[:-2]) + '_Super'
    if cls.endswith('Sub'): cls, unit = parts[-2], '_'.join(parts[:-2]) + '_Sub'
    level = 'district' if unit.startswith('D') else 'regional'
    folders = os.path.normpath(path).split(os.sep)[:-1]     # works for `section/x.pdf` as well as `brackets/section/x.pdf`
    if 'section' in folders: level = 'section'   # section/sub-section qualifiers below districts
    if 'league' in folders: level = 'league'     # league/conference tournaments, off the PIAA path
    if level == 'regional': unit = REGION.get(unit, unit)
    return base, year, cls, unit, level

def parse_place_block(ws, y0):
    """rows under the 'Place Winners' header -> [(place, name, grade, school)]"""
    cand = [w for w in ws if w['top'] > y0 + 2 and w['top'] < y0 + 170 and w['x0'] > 180
            and not TAG_IN.search(w['text']) and not RESULT.match(w['text'].strip()) and 'corrections' not in w['text']
            and not w['text'].startswith('Latest results') and not w['text'].startswith('http')]
    out, n = [], 0
    for row in rows_of(cand):
        toks = [w['text'].strip() for w in row if w['text'].strip()]
        if len(toks) < 2: continue
        place = None
        if toks[0].isdigit() and 1 <= int(toks[0]) <= 8: place = int(toks[0]); toks = toks[1:]
        if not toks or (len(toks) < 2 and place is None): continue
        if len(toks) == 1:  # name, grade and school glued into one word ("Michael (Misha) StrangaSrRityGarden Spot")
            out.append((place, toks[0], '', '')); continue
        grade = ''
        gi = [i for i, t in enumerate(toks) if t in GRADES]
        if gi: grade = GR.get(toks[gi[-1]], toks[gi[-1]]); school = ' '.join(toks[gi[-1] + 1:]); name = ' '.join(toks[:gi[-1]])
        else: school = toks[-1]; name = ' '.join(toks[:-1])
        if not name or not school: continue
        n += 1
        out.append((place if place else n, name, grade, school))
    return out

def parse_file(path):
    base, year, cls, unit, level = meta(path)
    ents, teams, log = [], [], []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                ws = words(page)
                wt = None
                for w in ws:
                    if w['x0'] > 440 and w['top'] < 200 and WEIGHT.match(w['text'].strip()):
                        wt = w['text'].strip(); break
                if not wt:
                    # team-score page(s)
                    for row in rows_of(ws):
                        line = ' '.join(x['text'] for x in row)
                        m = TEAM.match(line.strip())
                        if m: teams.append([level, base, year, cls, unit, int(m.group(1)), float(m.group(2)), m.group(3).strip(), m.group(4) or ''])
                    continue
                if wt in ('Unl', 'Unlimited'): wt = 'UNL'
                if wt in ('Hwt', 'Heavyweight'): wt = 'HWT'
                # placers
                hdr = [w for w in ws if w['text'].strip() == 'Place Winners']
                placers = parse_place_block(ws, hdr[0]['top']) if hdr else []
                # first-round entrants
                def is_school_word(t):
                    m = SCHOOL.match(t.strip()); return bool(m and (m.group(2) or m.group(3)) and ',' in t)
                names = [w for w in ws if w['x0'] < 135 and w['top'] > 55 and not ABBR_TAIL.search(w['text']) and w['text'].strip() not in ('Bye', '')
                         and not RESULT.match(w['text'].strip()) and not w['text'].startswith('Latest') and not w['text'].startswith('http')
                         and not (is_school_word(w['text']) and not SEEDP.match(w['text'].strip()))]
                schools = [w for w in ws if 100 < w['x0'] < 345 and ',' in w['text'] and not TAG_IN.search(w['text'])]
                used, seen = set(), []
                for nw in names:
                    best, bd = None, 1e9
                    for i, sc in enumerate(schools):
                        if i in used or sc['x0'] <= nw['x0'] + 5: continue
                        d = abs(sc['top'] - nw['top'])
                        if d < bd: best, bd = i, d
                    nm = nw['text'].strip(); seed = ''
                    m = SEEDP.match(nm)
                    if m: seed = (m.group(1) + '-' + m.group(2)) if m.group(1) else m.group(3); nm = m.group(4).strip()
                    if best is None or bd > 4:
                        # merged "NameSchool, GR, rec" word?
                        if ',' in nw['text']:
                            sm = SCHOOL.match(nm)
                            if sm:
                                # split camel boundary: lowercase followed by uppercase
                                mm = re.match(r'^(.+?[a-z])([A-Z][^,]*)$', sm.group(1))
                                if mm:
                                    seen.append([wt, '', seed, mm.group(1).strip(), mm.group(2).strip(), GR.get(sm.group(2) or '', sm.group(2) or ''), sm.group(3) or ''])
                                    continue
                        if nm and len(nm) > 1 and wt: seen.append([wt, '', seed, nm, '', '', ''])
                        continue
                    used.add(best)
                    sm = SCHOOL.match(schools[best]['text'].strip())
                    school, grade, rec = (sm.group(1).strip(), GR.get(sm.group(2) or '', sm.group(2) or ''), sm.group(3) or '') if sm else (schools[best]['text'].strip(), '', '')
                    seen.append([wt, '', seed, nm, school, grade, rec])
                # attach places
                def key(s): return re.sub(r'[^a-z]', '', s.lower())
                for pl, name, grade, school in placers:
                    hit = None
                    for e in seen:
                        if key(e[3]) == key(name) and (not e[4] or key(e[4])[:6] == key(school)[:6]): hit = e; break
                    if hit is None:
                        for e in seen:
                            if key(e[3]) == key(name): hit = e; break
                    if hit is None:
                        for e in seen:  # last-name + school fallback
                            if key(e[3].split()[-1]) == key(name.split()[-1]) and key(e[4])[:6] == key(school)[:6]: hit = e; break
                    if hit is None:  # same school, same first name, last name garbled ("Charles (Chuck) SamselSl R")
                        def fl(n):
                            t = re.sub(r'\([^)]*\)', '', n).split()
                            return (key(t[0]), key(''.join(t[1:]))[:4]) if len(t) > 1 else None
                        m = [e for e in seen if not e[1] and (not school or (e[4] and key(e[4])[:6] == key(school)[:6])) and fl(name) and fl(e[3]) == fl(name)]
                        if len(m) == 1: hit = m[0]
                    if hit is None and not school: continue
                    if hit is None:
                        seen.append([wt, pl, '', name, school, grade, ''])
                    else:
                        hit[1] = pl
                        if not hit[4]: hit[4] = school
                        if not hit[5]: hit[5] = grade
                for e in seen:
                    if e[3].count('(') > e[3].count(')'): e[3] = re.sub(r'\((\S+)', r'(\1)', e[3], count=1)  # "Thomas (Mike Conrow"
                    ents.append([level, base, year, cls, unit, e[0], e[1], e[2], e[3], e[4], e[5], e[6]])
    except Exception as ex:
        log.append(f'{base}: ERROR {ex}')
        return ents, teams, log
    wts = sorted(set(e[5] for e in ents)); nplace = sum(1 for e in ents if e[6]); maxp = max([e[6] for e in ents if e[6]] or [0])
    flag = ''
    if len(wts) < 6: flag += ' <6 WEIGHTS'
    if nplace == 0: flag += ' NO PLACERS'
    log.append(f'{base}: {len(ents)} entrants, {nplace} placed (max place {maxp}), {len(wts)} weights, {len(teams)} team rows{flag}')
    return ents, teams, log

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    jobs = 2
    for a in sys.argv[1:]:
        if a.startswith('--jobs'): jobs = int(a.split('=')[1]) if '=' in a else jobs
    files = []
    for folder in args:
        files += [os.path.join(folder, f) for f in sorted(os.listdir(folder)) if f.endswith('.pdf')]
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'brackets')
    # --out=DIR writes the three files somewhere else (leagues go to data/brackets/league so ratings never read them)
    out = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--out=')), out)
    os.makedirs(out, exist_ok=True)
    E, T, L = [], [], []
    with Pool(jobs) as pool:
        for e, t, l in pool.imap(parse_file, files, chunksize=4):
            E += e; T += t; L += l
            if len(L) % 100 == 0: print(len(L), 'files', flush=True)
    with open(os.path.join(out, 'lower_entrants.csv'), 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['level', 'tournament', 'year', 'cls', 'unit', 'weight', 'place', 'seed', 'name', 'school', 'grade', 'record']); w.writerows(E)
    with open(os.path.join(out, 'lower_teams.csv'), 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['level', 'tournament', 'year', 'cls', 'unit', 'place', 'points', 'school', 'abbr']); w.writerows(T)
    flagged = [l for l in L if 'WEIGHTS' in l or 'PLACERS' in l or 'ERROR' in l]
    open(os.path.join(out, 'lower_parse_log.txt'), 'w').write('\n'.join(L) + '\n\n== FLAGGED (%d) ==\n' % len(flagged) + '\n'.join(flagged))
    print('files', len(files), 'entrants', len(E), 'placed', sum(1 for e in E if e[6]), 'team rows', len(T), 'flagged', len(flagged))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import clean_brackets
    clean_brackets.run(out)   # strip Forfeit / team-score lines / seed prefixes / phantom placers (see clean_brackets.py)
