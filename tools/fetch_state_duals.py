"""PIAA team-duals lineups, bout by bout, from PA-Wrestling's state-duals pages.

/hs/stateduals/<year>_<aa|aaa>.htm links every dual's page (/hs/teams/<slug>/dual_meet_stats.htm?id=N), which lists
each bout: weight, winner, result, loser, score, with athlete links that carry each wrestler's team slug. Writes
data/sources/state_dual_bouts.csv (one row per bout) for tools/build_units.js: a lineup weight with nobody in the
postseason brackets takes that season's state-duals starter, and two teams' state-duals bouts are real results in Compare.
A team's slug is mapped to its name by the name common to every dual header it appears in.

  python3 tools/fetch_state_duals.py [first_year] [last_year]
"""
import csv, html, os, re, sys, time, urllib.request
from collections import Counter, defaultdict

BASE = 'https://www.pa-wrestling.com'
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'sources', 'state_dual_bouts.csv')
Y0, Y1 = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1999, 2026)

def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'overtime-history-bot'}), timeout=30) as r:
                return r.read().decode('latin-1')
        except Exception as e:
            if k == tries - 1: print('FAIL', url, e); return ''
            time.sleep(2 ** k)

RES = [(r'won by forfeit over|forfeit', 'ff'), (r'injury default|inj\.', 'inj'), (r'disqualif|disq\.|\bDQ\b', 'dq'), (r'medical forfeit', 'ff'),
       (r'tech\. fall|technical fall|tech fall', 'tf'), (r'maj\. dec|major dec', 'md'), (r'pinned|fall', 'fall'), (r'dec\.|decision', 'dec')]
LINE = re.compile(r'<p class="statsLine">\s*(\d+|HWT|Hwt)\s*-\s*(.*?)</p>', re.S)
ATH = re.compile(r'<a href="/hs/teams/([^/]+)/athlete_stats\.htm\?id=(\d+)"[^>]*>(.*?)</a>', re.S)

def bouts_of(page):
    out = []
    for w, body in LINE.findall(page):
        a = ATH.findall(body)
        if len(a) < 1: continue
        mid = re.sub(r'<[^>]+>', ' ', body.split('</a>', 1)[1] if '</a>' in body else '')
        res = next((t for p, t in RES if re.search(p, mid, re.I)), '')
        sc = re.search(r',\s*([^()]*?)\s*\(\d+-\d+\)', re.sub(r'<[^>]+>', '', body))
        win, los = a[0], a[1] if len(a) > 1 else ('', '', '')
        out.append([w, html.unescape(win[2]).strip(), win[0], html.unescape(los[2]).strip(), los[0], res, sc.group(1).strip() if sc else ''])
    return out

rows, seen, slugnames = [], set(), defaultdict(Counter)
for y in range(Y0, Y1 + 1):
    for c in ('aaa', 'aa'):
        idx = get(f'{BASE}/hs/stateduals/{y}_{c}.htm')
        links = re.findall(r'href="(/hs/teams/([^/]+)/dual_meet_stats\.htm\?id=(\d+))"', idx)
        n = 0
        for href, slug, did in links:
            if did in seen: continue
            seen.add(did); page = get(BASE + href); time.sleep(0.25)
            m = re.search(r'class="statsScore">\s*(.*?)\s*</p>', page, re.S)
            head = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip() if m else ''
            hm = re.match(r'(.+?)\s+(\d+),\s*(.+?)\s+(\d+)\s*$', head)
            if not hm: print('no score', y, c, did, head[:60]); continue
            ta, sa, tb, sb = hm.group(1), int(hm.group(2)), hm.group(3), int(hm.group(4))
            rd = re.search(r'class="statsLocation">\s*(.*?)<', page, re.S); rd = html.unescape(rd.group(1)).strip() if rd else ''
            dt = re.search(r'class="statsDate">\s*on\s*(.*?)\s*</p>', page, re.S); dt = dt.group(1).strip() if dt else ''
            bs = bouts_of(page)
            for b in bs:
                for s in (b[2], b[4]):
                    if s: slugnames[s].update([ta, tb])
                rows.append([y, c.upper(), did, dt, rd, ta, sa, tb, sb] + b)
            n += 1
        print(y, c, 'duals', n, 'bouts so far', len(rows), flush=True)

name = {s: cnt.most_common(1)[0][0] for s, cnt in slugnames.items()}
with open(OUT, 'w', newline='') as f:
    wr = csv.writer(f)
    wr.writerow(['year', 'cls', 'dual_id', 'date', 'round', 'team_a', 'score_a', 'team_b', 'score_b', 'weight', 'winner', 'winner_team', 'loser', 'loser_team', 'result', 'score'])
    for r in rows:
        r = r[:]; r[11] = name.get(r[11], r[11]); r[13] = name.get(r[13], r[13]); wr.writerow(r)
print('wrote', OUT, len(rows), 'bouts', len(seen), 'duals')
