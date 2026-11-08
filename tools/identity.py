"""Identity linking for wrestler names across levels and seasons.

The archive spells the same wrestler differently from bracket to bracket: nicknames (Joe / Joey / Joseph),
parenthesized nicknames, initials on later bracket slots, dropped letters (Montes / Monte), suffixes (Jr, III),
and an empty or abbreviated school. Keys built as nk(name)|nk(school) split one wrestler into several, so his
bouts do not pool into one season rating.

canon_map(records) takes (key, name, school, year, weight) and returns {key: canonical key}. Two keys merge when,
in the same season, they share a school (or one school is empty / a prefix of the other) and a last name (exact,
or one letter apart / two letters swapped for names of 5+ letters), their first names are compatible (equal, one a prefix
of the other, an initial, or a known nickname pair; any first names when the school, season and weight agree and
the two never meet in one tournament), and their weights are within one class of each other. Merges are then
carried across seasons through the same school and an exact first+last name match is not required.
Brothers at the same school are protected by the first-name rule (Sonny / Sammy are not compatible) and the
weight rule.
"""
import re
from collections import defaultdict

NICK = [('william', 'bill', 'billy', 'will', 'willie', 'liam'), ('robert', 'bob', 'bobby', 'rob', 'robby', 'robbie', 'bert'),
        ('richard', 'rich', 'rick', 'ricky', 'dick', 'richie'), ('michael', 'mike', 'mikey', 'mick'), ('anthony', 'tony'),
        ('james', 'jim', 'jimmy', 'jamie'), ('john', 'jack', 'johnny', 'jon', 'jonathan', 'jonny'), ('joseph', 'joe', 'joey', 'jo'),
        ('charles', 'charlie', 'chuck', 'chas'), ('thomas', 'tom', 'tommy'), ('daniel', 'dan', 'danny'), ('matthew', 'matt', 'matty'),
        ('christopher', 'chris', 'kit'), ('zachary', 'zach', 'zack', 'zak', 'zachery'), ('samuel', 'sam', 'sammy'), ('nicholas', 'nick', 'nicky', 'nic', 'nico'),
        ('alexander', 'alex', 'al', 'xander'), ('andrew', 'andy', 'drew'), ('benjamin', 'ben', 'benny', 'benji'), ('david', 'dave', 'davey'),
        ('edward', 'ed', 'eddie', 'ted', 'ned'), ('frederick', 'fred', 'freddie'), ('gerald', 'jerry', 'gerry'), ('gregory', 'greg'),
        ('jeffrey', 'jeff', 'geoffrey'), ('joshua', 'josh'), ('kenneth', 'ken', 'kenny'), ('lawrence', 'larry'), ('leonard', 'len', 'lenny', 'leo'),
        ('nathaniel', 'nathan', 'nate'), ('patrick', 'pat', 'paddy'), ('peter', 'pete'), ('phillip', 'philip', 'phil'), ('raymond', 'ray'),
        ('ronald', 'ron', 'ronnie'), ('donald', 'don', 'donnie'), ('douglas', 'doug'), ('stephen', 'steven', 'steve', 'stevie'),
        ('timothy', 'tim', 'timmy'), ('vincent', 'vince', 'vinny', 'vinnie'), ('walter', 'walt'), ('theodore', 'ted', 'teddy', 'theo'),
        ('eugene', 'gene'), ('harold', 'harry', 'hal'), ('henry', 'hank', 'harry'), ('jacob', 'jake'), ('maxwell', 'max'),
        ('mitchell', 'mitch'), ('cameron', 'cam'), ('dominic', 'dom', 'dominick'), ('gabriel', 'gabe'), ('isaac', 'ike'),
        ('jason', 'jay'), ('jerome', 'jerry'), ('kevin', 'kev'), ('louis', 'lou', 'louie'), ('martin', 'marty'), ('salvatore', 'sal'),
        ('terrence', 'terry', 'terence'), ('tyler', 'ty'), ('victor', 'vic'), ('zachariah', 'zach'), ('albert', 'al', 'bert'),
        ('arthur', 'art'), ('bradley', 'brad'), ('calvin', 'cal'), ('clifford', 'cliff'), ('curtis', 'curt'), ('dennis', 'denny'),
        ('frank', 'frankie', 'francis'), ('franklin', 'frank'), ('jonathon', 'jon'), ('joel', 'joe'), ('kyle', 'ky'), ('nolan', 'no'),
        ('rodney', 'rod'), ('russell', 'russ'), ('stanley', 'stan'), ('thaddeus', 'thad'), ('tobias', 'toby'), ('wesley', 'wes')]
NICKSET = defaultdict(set)
for grp in NICK:
    for a in grp: NICKSET[a] |= set(grp)
SUFFIX = {'jr', 'sr', 'ii', 'iii', 'iv', 'v'}

def toks(name):
    s = re.sub(r'\([^)]*\)', ' ', (name or '').lower()); s = re.sub(r'[^a-z\s\.\'-]', ' ', s)
    t = [re.sub(r'[^a-z]', '', x) for x in re.split(r'[\s\.]+', s)]
    t = [x for x in t if x and x not in SUFFIX]
    return t
def nick(name):
    m = re.search(r'\(([^)]*)\)', name or ''); return re.sub(r'[^a-z]', '', m.group(1).lower()) if m else ''
def first_last(name):
    t = toks(name)
    if not t: return '', ''
    if len(t) == 1: return '', t[0]
    return t[0], t[-1]
def first_ok(a, b, na='', nb=''):
    if not a or not b: return True
    if a == b: return True
    if len(a) == 1 or len(b) == 1: return a[0] == b[0]
    if a.startswith(b) or b.startswith(a): return min(len(a), len(b)) >= 3
    if b in NICKSET.get(a, ()) : return True
    if na and (na == b or b in NICKSET.get(na, ())): return True
    if nb and (nb == a or a in NICKSET.get(nb, ())): return True
    return False
def lev1(a, b):
    if a == b: return True
    if abs(len(a) - len(b)) > 1: return False
    if len(a) == len(b): return sum(x != y for x, y in zip(a, b)) == 1
    if len(a) > len(b): a, b = b, a
    for i in range(len(b)):
        if b[:i] + b[i + 1:] == a: return True
    return False
def dist(a, b):
    """edit distance, a swap of two neighbouring letters counting as one"""
    d = [[i + j if not i * j else 0 for j in range(len(b) + 1)] for i in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]: d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[-1][-1]
def last_ok(a, b):
    if a == b: return True
    if min(len(a), len(b)) >= 5 and lev1(a, b): return True
    if len(a) == len(b) >= 5 and [i for i in range(len(a)) if a[i] != b[i]] in ([i, i + 1] for i in range(len(a) - 1)) and sorted(a) == sorted(b): return True   # Weismantle / Weismantel
    if min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a)): return True   # hyphenated / truncated
    return False
def school_ok(a, b):
    if not a or not b or a == b: return True
    return min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a))
def wnum(w):
    m = re.match(r'\d+', str(w)); return int(m.group()) if m else 300

def canon_map(records, nk_name, nk_school):
    """records: iterable of (name, school, year, weight[, tournament]). Returns {key: canonical key} with key = nk(name)|nk(school)."""
    info = {}
    by_year = defaultdict(lambda: defaultdict(set))   # year -> last-name bucket -> keys
    w_of = defaultdict(set); yrs = defaultdict(set)
    tn = defaultdict(set)   # key -> tournaments it is entered in, when the records name them (5th field)
    for rec in records:
        name, school, year, weight = rec[:4]
        k = nk_name(name) + '|' + nk_school(school)
        if len(rec) > 4: tn[k].add(rec[4])
        if k not in info:
            f, l = first_last(name); info[k] = (f, l, nick(name), nk_school(school), name)
        w_of[(k, year)].add(wnum(weight)); yrs[k].add(year)
        by_year[year][info[k][1][:3]].add(k)
        if info[k][3]: by_year[year]['@' + info[k][3]].add(k)   # and by school: a misprint early in the last name (Coley / Cooley)
    parent = {}
    def find(x):
        while parent.get(x, x) != x: parent[x] = parent.get(parent[x], parent[x]); x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb: return
        # canonical: the key with more seasons, then the longer (fuller) name
        if (len(yrs[ra]), len(ra)) < (len(yrs[rb]), len(rb)): ra, rb = rb, ra
        parent[rb] = ra
    def weights_close(a, b, y):
        wa, wb = w_of[(a, y)], w_of[(b, y)]
        return any(abs(x - z) <= 12 for x in wa for z in wb)
    JUNK = re.compile(r'forfeit|^bye$|^tbd$|unknown|vacant')
    weak = lambda k: (len(info[k][0]) <= 1) or not info[k][3]          # initial-only first name, or no school
    cand = defaultdict(set)
    for y, buckets in by_year.items():
        done = set()
        for _, keys in buckets.items():
            keys = sorted(keys)
            if len(keys) < 2: continue
            for i in range(len(keys)):
                for j in range(i + 1, len(keys)):
                    a, b = keys[i], keys[j]
                    if (a, b) in done: continue
                    done.add((a, b)); fa, la, na, sa, _ = info[a]; fb, lb, nb, sb, _ = info[b]
                    if not school_ok(sa, sb): continue
                    # one school enters one wrestler per weight: the same school, season and weight (and only that
                    # weight for both) with the same last name is one wrestler even when two sheets disagree on his
                    # first name (Jason / Jake Dell, South Western 145, 1994) or on two letters at once (Phil Califati /
                    # Phillip Calafati)
                    # (never two keys entered in one tournament: those are two wrestlers; first names must start alike)
                    # In that slot the last name may also be two letters off (Shiffert / Shifflet, Mattila / Matilla) when
                    # the first names agree.
                    slot = (sa and sa == sb and fa and fb and fa[0] == fb[0] and len(w_of[(a, y)]) == 1
                            and w_of[(a, y)] == w_of[(b, y)] and tn[a] and tn[b] and not (tn[a] & tn[b])
                            and (last_ok(la, lb) or (first_ok(fa, fb, na, nb) and la[:1] == lb[:1] and min(len(la), len(lb)) >= 5 and dist(la, lb) <= 2)))
                    if not slot and not last_ok(la, lb): continue
                    if not slot:
                        if not first_ok(fa, fb, na, nb): continue
                        if not weights_close(a, b, y): continue
                        if fa and fb and fa != fb and la != lb: continue          # two differences at once: too loose
                    if JUNK.search(info[a][4].lower()) or JUNK.search(info[b][4].lower()): continue
                    cand[(a, y)].add(b); cand[(b, y)].add(a)
    # a weak key (initial or no school) merges only when it has exactly one candidate that season; strong pairs
    # (full first names, both schools present) merge directly. This blocks chains like V. Smith -> Phil Smith.
    merges = []
    for (a, y), cs in cand.items():
        for b in cs:
            if a > b: continue
            if weak(a) and len(cand[(a, y)]) != 1: continue
            if weak(b) and len(cand[(b, y)]) != 1: continue
            merges.append((a, b, y)); union(a, b)
    # across seasons: the same wrestler spelled differently in different years (Joey -> Joe, Brenneman -> Breneman).
    # Strong keys only, same school, never present in the same season (that would be two people), seasons within
    # three years, weights within 30 lb.
    by_school_last = defaultdict(list)
    for k, (f, l, n, sc, nm) in info.items():
        if sc and len(f) > 1 and not JUNK.search(nm.lower()): by_school_last[(sc, l[:3])].append(k)
    for _, ks in by_school_last.items():
        if len(ks) < 2 or len(ks) > 60: continue
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                a, b = ks[i], ks[j]
                if find(a) == find(b) or (yrs[a] & yrs[b]): continue
                fa, la, na, sa, _ = info[a]; fb, lb, nb, sb, _ = info[b]
                if a.split('|')[0] == b.split('|')[0]: continue
                if not last_ok(la, lb) or not first_ok(fa, fb, na, nb): continue
                if fa != fb and la != lb: continue
                close = [(ya, yb) for ya in yrs[a] for yb in yrs[b] if abs(ya - yb) <= 3]
                if not close: continue
                ya, yb = close[0]
                if not any(abs(x - z) <= 30 for x in w_of[(a, ya)] for z in w_of[(b, yb)]): continue
                merges.append((a, b, min(ya, yb))); union(a, b)
    return {k: find(k) for k in info}, merges
