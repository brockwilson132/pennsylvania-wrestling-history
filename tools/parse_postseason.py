"""Parse PA-Wrestling.com post-season index pages (one per district) into an official membership table, and the
"missing results" pages into a list of known gaps.

    python3 -I tools/parse_postseason.py [folder]        (default /home/claude/sources/postseason)

Writes
  data/sources/postseason_membership.csv  district, level, tournament, cls, region, y0, y1, slug
      level: district | sub-regional | regional | super-regional | state ; region: NE/NW/SE/SW/SC/CNW/W/E for regionals
  data/sources/missing_results.csv        district, level, tournament, cls, year, missing
Boys tournaments only. A year range like "1974-1990, 1995-2026" becomes one row per span.
"""
import csv, html, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/sources/postseason'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data', 'sources')
os.makedirs(OUT, exist_ok=True)

LEVEL = {'PIAA District Tournaments': 'district', 'PIAA Sub-Regional Tournaments': 'sub-regional',
         'PIAA Regional Tournaments': 'regional', 'PIAA Super Regional Tournaments': 'super-regional',
         'PIAA State Championships': 'state'}
REG = [('Central North West', 'CNW'), ('North West', 'NW'), ('North East', 'NE'), ('South West', 'SW'),
       ('South East', 'SE'), ('South Central', 'SC'), ('West', 'W'), ('East', 'E'), ('Central', 'C')]


def lines_of(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    t = re.sub(r'<br\s*/?>', '\n', t)
    t = re.sub(r'</(p|div|li|tr|h\d|td|th|a)>', '\n', t)
    txt = html.unescape(re.sub(r'<[^>]+>', '', t)).replace('\xa0', ' ')
    return [l.strip() for l in txt.split('\n') if l.strip()], s


def cls_of(name):
    if re.search(r'\bAAA\b|\b3A\b|\bClass A\b', name):
        return 'AAA'
    if re.search(r'\bAA\b|\b2A\b|\bClass B\b', name):
        return 'AA'
    return 'single'


def region_of(name):
    for k, v in REG:
        if re.search(r'\b' + k + r'\b', name):
            return v
    return ''


def spans(s):
    out = []
    for part in re.split(r'[,;]', s):
        m = re.match(r'\s*(\d{4})(?:\s*[-–]\s*(\d{4}))?\s*$', part)
        if m:
            out.append((int(m.group(1)), int(m.group(2) or m.group(1))))
    return out


memb, miss = [], []
for d in range(1, 13):
    f = os.path.join(SRC, f'district{d}.html')
    if not os.path.exists(f):
        continue
    L, raw = lines_of(f)
    slugs = dict((html.unescape(re.sub(r'<[^>]+>', '', t)).strip(), h) for h, t in re.findall(r'<a[^>]+href="(/[^"]+/)"[^>]*>(.*?)</a>', raw, flags=re.S))
    level, boys = None, False
    i = 0
    while i < len(L):
        l = L[i]
        if l == 'Boys Tournaments':
            boys = True
        elif l == 'Girls Tournaments' or l.startswith('Copyright'):
            boys = False
        elif l in LEVEL:
            level = LEVEL[l]
        elif boys and level and i + 1 < len(L) and spans(L[i + 1]):
            name = l
            for y0, y1 in spans(L[i + 1]):
                memb.append([d, level, name, cls_of(name), region_of(name) if level in ('regional', 'super-regional') else '', y0, y1, slugs.get(name, '')])
            i += 1
        i += 1
    fm = os.path.join(SRC, f'district{d}_missing.html')
    if os.path.exists(fm):
        L, _ = lines_of(fm)
        level, boys = None, False
        for j, l in enumerate(L):
            if l == 'Boys Tournaments':
                boys = True
            elif l == 'Girls Tournaments' or l.startswith('Copyright'):
                boys = False
            elif l in LEVEL:
                level = LEVEL[l]
            elif boys and level:
                m = re.match(r'^(\d{4})\s+(.+)$', l)
                if m and j + 1 < len(L) and not re.match(r'^\d{4}\s', L[j + 1]):
                    miss.append([d, level, m.group(2), cls_of(m.group(2)), int(m.group(1)), L[j + 1]])

with open(os.path.join(OUT, 'postseason_membership.csv'), 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['district', 'level', 'tournament', 'cls', 'region', 'y0', 'y1', 'slug']); w.writerows(memb)
with open(os.path.join(OUT, 'missing_results.csv'), 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['district', 'level', 'tournament', 'cls', 'year', 'missing']); w.writerows(miss)
print(f'membership rows {len(memb)}, missing rows {len(miss)}')
