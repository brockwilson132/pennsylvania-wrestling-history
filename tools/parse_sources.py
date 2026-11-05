#!/usr/bin/env python3
"""Parse supplementary district sources into CSVs.
   python3 -I tools/parse_sources.py <sources_dir> <out_dir>
   sources_dir/d3/year_by_year.pdf   District III Records: district champions by year/class,
                                     * = region champion, (n) = PIAA place, bold = PIAA champion
   sources_dir/d3/tourney_team_winners.pdf  team champions (with points) at the D3 individual tournament
   sources_dir/d3/team_mat_results.pdf      D3 team duals champions 1990-2025
   sources_dir/d7/wpial_champions.pdf        WPIAL individual champions 1936-2024
"""
import csv, re, sys, os
from collections import Counter, defaultdict
import pdfplumber

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
log = []

def segments(page, gap=14):
    """Split each text row into column segments by horizontal gaps; return [(top, x0, text, bold)]."""
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=['fontname'])
    rows = defaultdict(list)
    for w in words: rows[round(w['top'] / 2)].append(w)
    segs = []
    for k in sorted(rows):
        ws = sorted(rows[k], key=lambda w: w['x0'])
        cur = [ws[0]]
        for w in ws[1:]:
            if w['x0'] - cur[-1]['x1'] > gap: segs.append(cur); cur = [w]
            else: cur.append(w)
        segs.append(cur)
    out = []
    for s in segs:
        out.append((s[0]['top'], s[0]['x0'], ' '.join(w['text'] for w in s), any('Bold' in w['fontname'] for w in s[1:])))
    return out

def columns(segs, is_header):
    """Assign each segment to the nearest header column (header x0s merged within 30pt), in reading order."""
    xs = []
    for x in sorted(h[1] for h in segs if is_header(h[2])):
        if not xs or x - xs[-1][-1] > 30: xs.append([x])
        else: xs[-1].append(x)
    cs = [sum(g) / len(g) for g in xs] or [0]
    bycol = defaultdict(list)
    for s in segs: bycol[min(range(len(cs)), key=lambda i: abs(cs[i] - s[1]))].append(s)
    return [sorted(bycol[c], key=lambda s: s[0]) for c in sorted(bycol)]

WMAP = {'HWT': 'HWT', 'Hwt': 'HWT', 'UNL': 'UNL', 'Unl': 'UNL'}
def wnorm(w): return WMAP.get(w, w)

# ---------------- D3 champions ----------------
d3 = []
pdf = pdfplumber.open(os.path.join(SRC, 'd3/year_by_year.pdf'))
hdr = re.compile(r'^(\d{4})-(\d{4})(?:\s+CLASS\s+([23]A|A|B))?')
ent = re.compile(r'^(\d{2,3}|Hwt|Unl|HWT|UNL):\s*(.+?),\s*(.+?)(\*)?\s*(?:\((\d)\))?\s*$')
for pi, page in enumerate(pdf.pages):
    segs = segments(page)
    for colsegs in columns(segs, lambda t: bool(hdr.match(t))):
        year = cls = None
        for top, x0, t, bold in colsegs:
            m = hdr.match(t)
            if m:
                year = int(m.group(2)); cls = {'3A': 'AAA', '2A': 'AA', 'A': 'AAA', 'B': 'AA'}.get(m.group(3) or '', 'single'); continue
            t = re.sub(r'\(\)(\d)\)', r'(\1)', t)   # "Boiling Springs ()5)" is a misprint of "(5)"
            m = ent.match(t)
            if m and year:
                w, name, school, star, pl = m.groups()
                school = school.replace('*', '').strip()
                d3.append(dict(year=year, cls=cls, weight=wnorm(w), place=1, name=name.strip(), school=school,
                               region_champ=1 if star or '*' in m.group(3) else 0, piaa_place=pl or ('1' if bold else ''), source='d3records'))
            elif m is None and re.match(r'^(\d{2,3}|Hwt|Unl):', t):
                log.append(f'd3 unparsed p{pi+1}: {t}')
with open(os.path.join(OUT, 'd3_champions.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(d3[0].keys())); w.writeheader(); w.writerows(d3)
c = Counter((r['year'], r['cls']) for r in d3)
log.append(f'D3 champions: {len(d3)} rows, {len(c)} year-class groups, years {min(r["year"] for r in d3)}-{max(r["year"] for r in d3)}')
log += [f'  d3 {y} {k}: {n}' for (y, k), n in sorted(c.items()) if n < 10]

# ---------------- WPIAL champions ----------------
d7 = []
pdf = pdfplumber.open(os.path.join(SRC, 'd7/wpial_champions.pdf'))
yr = re.compile(r'^(19|20)\d{2}$'); clsre = re.compile(r'^Class\s+([23])A$')
went = re.compile(r'^(\d{2,3}|HWT|Hwt|Unl|UNL)\s*[–-]\s*(.+?)\s*\((.+?)\)\s*$')
for pi, page in enumerate(pdf.pages):
    segs = segments(page)
    for colsegs in columns(segs, lambda t: bool(yr.match(t))):
        year = None; cls = 'single'
        for top, x0, t, bold in colsegs:
            if yr.match(t): year = int(t); cls = 'single' if year < 1974 else cls; continue
            m = clsre.match(t)
            if m: cls = {'3': 'AAA', '2': 'AA'}[m.group(1)]; continue
            # a champion from the neighbouring column glued on ("152 – A (Seneca Valley) 138 – B (Penn-Trafford)"): its year
            # can't be told from the line, so keep the first and log the rest (those years have D7 brackets anyway)
            g = re.search(r'(?<=\))\s+(?:\d{2,3}|HWT|Hwt|Unl|UNL)\s*[–-].*$', t)
            if g: log.append(f'd7 glued entry dropped p{pi+1}: {g.group(0).strip()}'); t = t[:g.start()].strip()
            m = went.match(t)
            if m and year:
                d7.append(dict(year=year, cls=cls, weight=wnorm(m.group(1)), place=1, name=m.group(2).strip(), school=m.group(3).strip().replace('Bethelhem', 'Bethlehem').replace('Canon-McMillion', 'Canon-McMillan'), source='wpial'))
            elif re.match(r'^(\d{2,3}|HWT)\s*[–-]', t): log.append(f'd7 unparsed p{pi+1}: {t}')
with open(os.path.join(OUT, 'd7_champions.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(d7[0].keys())); w.writeheader(); w.writerows(d7)
c = Counter((r['year'], r['cls']) for r in d7)
log.append(f'D7 champions: {len(d7)} rows, {len(c)} year-class groups, years {min(r["year"] for r in d7)}-{max(r["year"] for r in d7)}')
log += [f'  d7 {y} {k}: {n}' for (y, k), n in sorted(c.items()) if n < 10]

# ---------------- D3 team champions at the individual tournament ----------------
team = []
pdf = pdfplumber.open(os.path.join(SRC, 'd3/tourney_team_winners.pdf'))
TGAP = 45
ty = re.compile(r'^(\d{4})-(\d{4})$'); tt = re.compile(r'^([23])A:\s*(.+?)\s*\(([\d.]+)(?:\s*points)?\)')
for page in pdf.pages:
    segs = segments(page, TGAP)
    for colsegs in columns(segs, lambda t: bool(ty.match(t))):
        year = None
        for top, x0, t, b in colsegs:
            m = ty.match(t)
            if m: year = int(m.group(2)); continue
            m = tt.match(t)
            if m and year: team.append(dict(kind='district_individual_team', year=year, cls={'3': 'AAA', '2': 'AA'}[m.group(1)], round='', place=1, school=m.group(2), points=m.group(3), opponent='', score='', source='d3records'))
# D3 team duals champions (first table of team_mat_results): Year | Class 3A (x~72) | Class 2A (x~324)
pdf = pdfplumber.open(os.path.join(SRC, 'd3/team_mat_results.pdf'))
rows = defaultdict(dict)
for top, x0, t, b in segments(pdf.pages[0], 10):
    rows[round(top / 6)][x0] = t
for k, r in sorted(rows.items()):
    yk = [t for x, t in r.items() if re.match(r'^\d{4}:$', t)]
    if not yk: continue
    year = int(yk[0][:4])
    for x, t in r.items():
        if 60 < x < 300: team.append(dict(kind='district_duals_champion', year=year, cls='AAA', round='', place=1, school=t, points='', opponent='', score='', source='d3records'))
        elif x >= 300: team.append(dict(kind='district_duals_champion', year=year, cls='AA', round='', place=1, school=t, points='', opponent='', score='', source='d3records'))
with open(os.path.join(OUT, 'd3_team.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['kind', 'year', 'cls', 'round', 'place', 'school', 'points', 'opponent', 'score', 'source']); w.writeheader(); w.writerows(team)
log.append(f'D3 team rows: {Counter(r["kind"] for r in team)}')
open(os.path.join(OUT, 'parse_log.txt'), 'w').write('\n'.join(log) + '\n')
print('\n'.join(log[:40]))

# ---------------- PIAA team duals (1999-2024), from District III Records ----------------
duals = []
pdf = pdfplumber.open(os.path.join(SRC, 'd3/piaa_team_results.pdf'))
dh = re.compile(r'^(\d{4})-(\d{4})\s+CLASS\s+([23])A')
bout = re.compile(r"^(.+?)(?:\s+\((\d{1,2})\))?\s+(\d{1,3}),\s+(.+?)(?:\s+\((\d{1,2})\))?\s+(\d{1,3})((?:\*|-\d+)?(?:\s+.*)?)?$")
rnd = re.compile(r'^(Preliminary round|Championship .*|Consolation .*|Semifinals?.*|Quarterfinals?.*|Finals?.*|Third place.*|Fifth place.*|Seventh place.*|First round.*|Second round.*|.*[Ff]inal.*)$')
bad = 0
for page in pdf.pages:
    W = page.width
    for half in (0, 1):
        txt = page.crop((half * W / 2, 0, (half + 1) * W / 2, page.height)).extract_text() or ''
        year = cls = None; rname = ''
        for l in txt.split('\n'):
            l = l.strip(); m = dh.match(l)
            if m: year = int(m.group(2)); cls = {'3': 'AAA', '2': 'AA'}[m.group(3)]; rname = ''; continue
            if not year or not l: continue
            m = bout.match(l)
            if m and not rnd.match(l):
                a, ad, asc, b, bd, bsc, note = m.groups()
                duals.append(dict(year=year, cls=cls, round=rname, winner=a.strip(), winner_d=ad or '', winner_score=asc, loser=b.strip(), loser_d=bd or '', loser_score=bsc, note=(note or '').strip(), source='d3records'))
            elif rnd.match(l) or l.isupper() or l.startswith('CHAMPIONS'): rname = l if not l.isupper() else rname
            elif re.search(r'\d+,', l): bad += 1; log.append(f'duals unparsed {year} {cls}: {l}')
# carry district seeds forward within a year/class (later rounds omit them)
seed = {}
for d in duals:
    for side in ('winner', 'loser'):
        k = (d['year'], d['cls'], d[side])
        if d[side + '_d']: seed[k] = d[side + '_d']
        else: d[side + '_d'] = seed.get(k, '')
with open(os.path.join(OUT, 'piaa_duals.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(duals[0].keys())); w.writeheader(); w.writerows(duals)
log.append(f'PIAA duals: {len(duals)} bouts, {len(set((d["year"], d["cls"]) for d in duals))} year-class brackets, {bad} unparsed lines')
open(os.path.join(OUT, 'parse_log.txt'), 'w').write('\n'.join(log) + '\n')
print(log[-1])
