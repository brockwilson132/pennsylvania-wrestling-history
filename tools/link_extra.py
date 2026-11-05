#!/usr/bin/env python3
"""Link the archive-named PDFs in brackets/extra/ (`<year>_<Archive_Name>_results.pdf`) into the folders
and file names the parsers expect, without copying anything:

  brackets/section/<year>_D<d>_<part>_<cls>.pdf   section / sub-section qualifiers (level=section)
  brackets/league/<year>_<League>_single.pdf      league and conference tournaments (level=league)

Section names follow the files already in brackets/section/:
  District4_AA_Section_West_Central -> 1990_D4_SWC_AA       District10_SubSection1 -> 1975_D10_SS1_AAA
  District7_AAA_SubSection2A        -> 2021_D7_SS2A_AAA      District12_AAA_Catholic -> 2015_D12_CAT_AAA
  A/B before 1974 are not classes: one-class years are `single`.

Skipped on purpose:
  - a target name that already exists (the file in brackets/section/ wins)
  - District 1 AAA 2019 onward: those East/North/South/West tournaments are already at the district tier (D1_AAA)
  - anything that is neither a section nor a league (sub-regionals, super-regionals, district gap-fills)

League seasons: Ches-Mont moved its tournament to December, so `2018_19_ChesMont` is the 2018-19 season (2019)
and `2019_20_ChesMont` is 2020; the app numbers a season by its end year. PAC-10 was renamed Pioneer Athletic
Conference, so both names share one unit.

  python3 -I tools/link_extra.py <brackets dir> [--dry-run]
"""
import os, re, sys

DIRS = {'North': 'N', 'East': 'E', 'South': 'S', 'West': 'W', 'Central': 'C', 'West_Central': 'WC', 'East_Central': 'EC'}
LEAGUE_UNIT = {'PAC10': 'Pioneer_Athletic_Conference'}
LEAGUES = {'Central_League', 'ChesMont', 'Delaware_Valley_League', 'East_Penn_League', 'Lehigh_Northampton_League',
           'Lehigh_Valley_League', 'Lower_Bucks_County', 'PAC10', 'Pioneer_Athletic_Conference', 'SOL_American',
           'SOL_Continental', 'SOL_National', 'Suburban_League', 'TriCounty_League'}
SEC = re.compile(r'^District(\d+)(?:_(AAA|AA|A|B))?_(Section|SubSection)_?(.*)$')
D12 = re.compile(r'^District12_AAA_(Catholic|Public)$')


def target(name):
    """archive file name -> ('section'|'league', new base name) or None"""
    base = os.path.basename(name)
    if not base.endswith('_results.pdf'): return None
    year, rest = base[:-len('_results.pdf')].split('_', 1); year = int(year)
    m = re.match(r'^(\d\d)_ChesMont$', rest)
    if m: return 'league', f'{year + 1}_ChesMont_single'
    if rest in LEAGUES: return 'league', f'{year}_{LEAGUE_UNIT.get(rest, rest)}_single'
    m = D12.match(rest)
    if m: return 'section', f'{year}_D12_{m.group(1)[:3].upper()}_AAA'
    m = SEC.match(rest)
    if not m: return None
    d, c, kind, part = m.groups()
    if d == '1' and year >= 2019: return None
    cls = {'A': 'AAA', 'B': 'AA'}.get(c, c) if c else ('single' if year < 1974 else None)
    if cls is None: return None
    part = DIRS.get(part, part.replace('_', ''))
    return 'section', f"{year}_D{d}_{'SS' if kind == 'SubSection' else 'S'}{part}_{cls}"


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    root = args[0] if args else 'brackets'
    src = os.path.join(root, 'extra')
    made, kept, skipped = {'section': 0, 'league': 0}, 0, []
    for f in sorted(os.listdir(src)):
        t = target(f)
        if t is None: skipped.append(f); continue
        level, new = t
        dst = os.path.join(root, level, new + '.pdf')
        if os.path.lexists(dst): kept += 1; continue
        if not dry:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            os.symlink(os.path.relpath(os.path.join(src, f), os.path.dirname(dst)), dst)
        made[level] += 1
    print(f"linked {made['section']} section + {made['league']} league files; {kept} already present; {len(skipped)} left for other parsers")
    for s in skipped: print('  skip', s)
