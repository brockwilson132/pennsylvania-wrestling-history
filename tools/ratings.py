#!/usr/bin/env python3
"""Ratings and difficulty (strength of schedule) for every wrestler in the PA bracket archive, with the
evaluation that chose the method. Method and evidence: docs/DIFFICULTY.md.

Inputs (repo root): data/brackets/bouts.csv, data/brackets/lower_entrants.csv, data/brackets/state_entrants.csv,
                    overtime/medals.js
Outputs:            data/difficulty/brackets.csv          per bracket: field strength (rating scale)
                    data/difficulty/wrestler_seasons.csv  per wrestler per tournament: season rating, quality of wins, bad losses
                    data/difficulty/eval.txt              every number quoted in the doc
v2 (docs/RATING_AUDIT.md): identity linking across name variants (tools/identity.py); one absolute scale where
1500 = the average state qualifier (rolling 11-season window per class); path SOS and the 0-99 per-level scales
are retired in favour of the wrestler's own rating, quality of wins and bad losses.
Usage: python3 -I tools/ratings.py [--grid]

Two layers:
 1. Forward rating (predictive): chronological Elo, no future information. Provisional ratings move faster,
    result margin scales the update (fall/TF/MD > dec), between seasons the rating regresses toward the mean
    and adds a grade-aware improvement step fitted from the data (a freshman is expected to get better).
 2. Opponent strength for SOS (descriptive): how good was this opponent in the season of the bout? A blend of
    his season-t performance rating computed WITHOUT the bout being scored (leave-one-bout-out) and his
    adjacent seasons (end of t-1 and t-2 forward ratings, t+1 and t+2 season performance ratings), with
    proximity weights fitted by non-negative regression, and the season-t share shrunk by how many other
    bouts he had that season. A senior who beat a freshman who later won a title gets credit for the
    freshman he beat, mostly, not for the champion the freshman became.
"""
import csv, json, math, os, re, sys, itertools, random
from collections import defaultdict, Counter
import numpy as np
from scipy.optimize import lsq_linear
from scipy.stats import spearmanr

def nk(s): return re.sub(r'[^a-z]', '', re.sub(r'\([^)]*\)', '', (s or '').lower()))
def wn(w):
    m = re.match(r'\d+', str(w)); return int(m.group()) if m else 999
MARGIN_TYPES = ('fall', 'tf', 'md', 'dec')
SKIP = {'ff', 'inj', 'dq'}
PTS = [16, 12, 9, 7, 5, 3, 2, 1]
GR = {'FR': 0, 'SO': 1, 'JR': 2, 'SR': 3, '9': 0, '10': 1, '11': 2, '12': 3, 'Fr': 0, 'So': 1, 'Jr': 2, 'Sr': 3}
def lvl_rank(level, unit):
    if level == 'regional' and unit.endswith('_Sub'): return 1
    return {'section': 0, 'district': 0, 'regional': 2, 'state': 3}[level]   # sections: qualifiers below districts
def clsg(c): return c if c in ('AAA', 'AA') else 'single'
out = []
def say(*a):
    s = ' '.join(str(x) for x in a); out.append(s); print(s, flush=True)

# ============================================================ load
D1PARTS = {'North', 'South', 'Central', 'East', 'West'}
REGION = {'North_East': 'NE', 'North_West': 'NW', 'South_Central': 'SC', 'South_East': 'SE', 'South_West': 'SW', 'West': 'W', 'East': 'E', 'Central_North_West': 'CNW'}
def unit_cls(unit, cls):
    # same normalization as tools/build_lower.js: District 1 AAA parts arrive as unit D1_AAA with the part in cls
    if unit == 'D1_AAA' and cls in D1PARTS: unit, cls = 'D1_' + cls, 'AAA'
    return REGION.get(unit, unit), {'A': 'AAA', 'B': 'AA'}.get(cls, cls)
bouts = []
NO_SEC_BOUTS = bool(os.environ.get('RATINGS_NO_SECTION_BOUTS'))   # test switch: drop section bouts, keep section entrants for district labels
# first-round rule, the same for every district (sections are the district round where a district is split into them):
#   keep  - every bout counts (default)
#   drop  - district and section bouts left out of the rating; their brackets still label each wrestler's district
#   prior - every bout counts; wrestlers whose season ended in the first round get their own prior mean, fitted so that
#           on average their ratings sit where their prior says (an offset per class and era, learned from the data)
FIRST = os.environ.get('RATINGS_FIRST_STAGE', 'prior')
for b in csv.DictReader(open('data/brackets/bouts.csv')):
    if NO_SEC_BOUTS and b['level'] == 'section': continue
    if FIRST == 'drop' and b['level'] in ('district', 'section'): continue
    b['year'] = int(b['year']); b['round'] = int(b['round'])
    b['unit'], b['cls'] = unit_cls(b['unit'], b['cls'])
    b['wk'] = nk(b['winner']) + '|' + nk(b['winner_school']); b['lk'] = nk(b['loser']) + '|' + nk(b['loser_school'])
    b['lr'] = lvl_rank(b['level'], b['unit']); b['bk'] = (b['level'], b['tournament'], b['weight']); b['c'] = clsg(b['cls'])
    bouts.append(b)
bouts.sort(key=lambda b: (b['year'], b['lr'], b['tournament'], b['weight'], b['side'] != 'champ', -b['round']))
for i, b in enumerate(bouts): b['i'] = i
med = json.loads(open('overtime/medals.js').read().split('window.WR_MEDALS=', 1)[1].split(';')[0])
state_place = {(y, c, wn(w), nk(n)): p for y, c, w, p, n, s, d in med}
def state_tname(y, c):
    if y <= 1973: return f'{y}_single'
    if y <= 1975: return f'{y}_{"A" if c == "AAA" else "B"}'
    return f'{y}_{c}'
entrants = defaultdict(list)       # bracket key -> [(key, name, school, place, seed)]
grade = {}                         # (key, year) -> 0..3
for r in csv.DictReader(open('data/brackets/lower_entrants.csv')):
    k = nk(r['name']) + '|' + nk(r['school'])
    entrants[(r['level'], r['tournament'], r['weight'])].append((k, r['name'], r['school'], int(r['place']) if r['place'] else None, r['seed']))
    if r['grade'] in GR: grade[(k, int(r['year']))] = GR[r['grade']]
for r in csv.DictReader(open('data/brackets/state_entrants.csv')):
    y = int(r['year']); c = r['cls']; k = nk(r['name']) + '|' + nk(r['school'])
    entrants[('state', state_tname(y, c), r['weight'])].append((k, r['name'], r['school'], state_place.get((y, c, wn(r['weight']), nk(r['name']))),
                                                                (r['region'] + '-' + r['seed']) if r['region'] else r['seed']))
    if r['grade'] in GR: grade[(k, y)] = GR[r['grade']]
# ---- identity linking (v2): merge name variants of one wrestler so his bouts pool into one season rating
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from identity import canon_map
_idrec = [(b['winner'], b['winner_school'], b['year'], b['weight']) for b in bouts] + [(b['loser'], b['loser_school'], b['year'], b['weight']) for b in bouts]
for (lvl, t, w), es in entrants.items():
    for e in es: _idrec.append((e[1], e[2], int(t[:4]), w))
CANON, _merges = canon_map(_idrec, nk, nk); del _idrec
CK = lambda k: CANON.get(k, k)
for b in bouts: b['wk'] = CK(b['wk']); b['lk'] = CK(b['lk'])
for bk in list(entrants): entrants[bk] = [(CK(e[0]),) + tuple(e[1:]) for e in entrants[bk]]
grade = {(CK(k), y): g for (k, y), g in sorted(grade.items(), key=lambda kv: kv[0][0] == CK(kv[0][0]))}
# ---- transfers: one wrestler, two schools. Keys are name|school, so a transfer looked like two people and his second
# school's seasons started with no history. Merge two keys with the same name when every check agrees: grades give the
# same graduating class, the seasons do not overlap and follow within two years, the career fits in four seasons, and
# the weights are close (within 30 lb).
_yrs = defaultdict(set); _wts = defaultdict(list)
for b in bouts:
    for k in (b['wk'], b['lk']): _yrs[k].add(b['year'])
    m_ = re.match(r'\d+', str(b['weight']))
    if m_: _wts[(b['wk'], b['year'])].append(int(m_.group())); _wts[(b['lk'], b['year'])].append(int(m_.group()))
for (lvl, t, w), es in entrants.items():
    for e in es: _yrs[e[0]].add(int(t[:4]))
_gyk = defaultdict(set)
for (kk, y), g in grade.items(): _gyk[kk].add(y + 3 - g)
_byname = defaultdict(list)
for k in _yrs: _byname[k.split('|')[0]].append(k)
TRANSFER = {}
for nm, ks in _byname.items():
    if len(ks) < 2 or len(nm) < 6: continue
    ks = sorted(ks, key=lambda k: min(_yrs[k]))
    for i, a in enumerate(ks):
        for b2 in ks[i + 1:]:
            ra = TRANSFER.get(a, a)
            ya, yb = _yrs[ra] | set().union(*[_yrs[x] for x, v in TRANSFER.items() if v == ra]), _yrs[b2]
            if b2 in TRANSFER or ya & yb or min(yb) <= max(ya) or min(yb) - max(ya) > 2 or max(yb) - min(ya) > 3: continue
            ga, gb = _gyk.get(a, set()) | _gyk.get(ra, set()), _gyk.get(b2, set())
            if len(ga) != 1 or len(gb) != 1 or ga != gb: continue
            wa = [w_ for y in ya for w_ in _wts.get((ra, y), [])]; wb = [w_ for y in yb for w_ in _wts.get((b2, y), [])]
            if wa and wb and abs(np.median(wa) - np.median(wb)) > 30: continue
            TRANSFER[b2] = ra
for b in bouts: b['wk'] = TRANSFER.get(b['wk'], b['wk']); b['lk'] = TRANSFER.get(b['lk'], b['lk'])
for bk in list(entrants): entrants[bk] = [(TRANSFER.get(e[0], e[0]),) + tuple(e[1:]) for e in entrants[bk]]
grade = {(TRANSFER.get(k, k), y): g for (k, y), g in grade.items()}
say(f'transfers: {len(TRANSFER)} name+school keys linked to the same wrestler at an earlier school')
say(f'identity linking: {sum(1 for k, v in CANON.items() if k != v)} of {len(CANON)} name keys merged into another ({len(_merges)} merge events)')
bracket_meta = {}
for b in bouts: bracket_meta.setdefault(b['bk'], (b['year'], b['c'], b['unit'], b['lr']))
for (lvl, t, w) in entrants:
    if (lvl, t, w) in bracket_meta: continue
    y = int(t[:4]); rest = t[5:]
    if lvl == 'state': c = clsg({'A': 'AAA', 'B': 'AA'}.get(rest, rest)); unit = 'PIAA'
    else:
        parts = rest.split('_'); unit, c = unit_cls('_'.join(parts[:-1]), parts[-1]); c = clsg(c)
    bracket_meta[(lvl, t, w)] = (y, c, unit, lvl_rank(lvl, unit))
key_cls = {}
for b in bouts: key_cls[(b['wk'], b['year'])] = b['c']; key_cls[(b['lk'], b['year'])] = b['c']
say(f'bouts {len(bouts)} (rated: {sum(b["result"] not in SKIP for b in bouts)}), brackets {len(bracket_meta)}, wrestlers with a grade-season {len(grade)}')

# ============================================================ layer 1: forward Elo
class Elo:
    def __init__(s, K=40, rho=0.75, grow=(60, 40, 25), init=(1500, 1500, 1540, 1580), marg=(1.5, 1.35, 1.2, 1.0), prov=2.0, S=400, gap='decay'):
        s.K, s.rho, s.grow, s.init, s.marg, s.S, s.prov, s.gap = K, rho, grow, init, dict(zip(MARGIN_TYPES, marg)), S, prov, gap
        s.R, s.last, s.n = {}, {}, Counter()
    def kf(s, key): return s.K * (1 + s.prov / (s.n[key] + 1))
    def get(s, k, year, lr):
        if k in s.last and year - s.last[k] > 5: s.R.pop(k, None); s.n[k] = 0      # new identity after a long gap
        if k not in s.R: s.R[k] = s.init[lr]; s.last[k] = year
        elif s.last[k] < year:
            gap = year - s.last[k]; g = grade.get((k, year))
            step = s.grow[g - 1] if g is not None and g >= 1 else sum(s.grow) / len(s.grow)
            # a missed season: 'decay' regresses once per elapsed year (the old rule), 'hold' regresses once however
            # long the gap, 'grow' regresses once and adds the growth step for every grade he moved up
            if s.gap == 'decay': s.R[k] = 1500 + (s.rho ** gap) * (s.R[k] - 1500) + step
            else:
                st = step
                if s.gap == 'grow' and gap > 1 and g is not None:
                    st = sum(s.grow[x - 1] for x in range(max(1, g - gap + 1), g + 1))
                s.R[k] = 1500 + s.rho * (s.R[k] - 1500) + st
            s.last[k] = year
        return s.R[k]
    def p(s, ra, rb): return 1 / (1 + 10 ** ((rb - ra) / s.S))

POST = {}
def run(params, keep=False):
    E = Elo(**params); tune = [0, 0]; hold = [0, 0, 0]
    pre = {} ; end = {}
    for b in bouts:
        if b['result'] in SKIP: continue
        rw = E.get(b['wk'], b['year'], b['lr']); rl = E.get(b['lk'], b['year'], b['lr'])
        pw = E.p(rw, rl); l = -math.log(max(pw, 1e-9))
        if 1980 <= b['year'] <= 2017: tune[0] += l; tune[1] += 1
        elif b['year'] > 2017: hold[0] += l; hold[1] += 1; hold[2] += 1 if pw > 0.5 else 0.5 if pw == 0.5 else 0
        m = E.marg.get(b['result'], 1.0)
        E.R[b['wk']] = rw + E.kf(b['wk']) * m * (1 - pw); E.R[b['lk']] = rl - E.kf(b['lk']) * m * (1 - pw)
        E.n[b['wk']] += 1; E.n[b['lk']] += 1
        if keep:
            pre[b['i']] = (rw, rl); POST[b['i']] = (E.R[b['wk']], E.R[b['lk']]); end[(b['wk'], b['year'])] = E.R[b['wk']]; end[(b['lk'], b['year'])] = E.R[b['lk']]
    return tune[0] / tune[1], hold[0] / hold[1], hold[2] / hold[1], hold[1], E, pre, end

def fit_growth(params):
    """grade-aware improvement step: mean residual of next season's end rating vs. the regressed prior, by grade."""
    for _ in range(2):
        *_, E, pre, end = run(params, keep=True)
        res = defaultdict(list)
        for (k, y), r in end.items():
            nxt = end.get((k, y + 1)); g = grade.get((k, y + 1))
            if nxt is None or g is None or g < 1: continue
            res[g].append(nxt - (1500 + params['rho'] * (r - 1500)))
        params = dict(params, grow=tuple(round(float(np.mean(res[g])) if res[g] else 30, 1) for g in (1, 2, 3)))
    return params

params = dict(K=56, rho=0.8, grow=(100, 100, 100), init=(1500, 1500, 1500, 1500), marg=(1.5, 1.35, 1.2, 1.0), prov=2)   # --grid result, 1980-2017
if '--grid' in sys.argv:
    grid = list(itertools.product([24, 32, 40, 56], [0.5, 0.65, 0.8], [(1500, 1500, 1500, 1500), (1500, 1500, 1560, 1620), (1500, 1520, 1600, 1680)],
                                  [(1, 1, 1, 1), (1.5, 1.35, 1.2, 1.0), (2.0, 1.7, 1.35, 1.0)], [0, 2, 4]))
    random.seed(1); random.shuffle(grid); best = None
    params = fit_growth(params)
    for K, rho, init, marg, prov in grid[:48]:
        p = dict(params, K=K, rho=rho, init=init, marg=marg, prov=prov)
        lt, *_ = run(p)
        if best is None or lt < best[0]: best = (lt, p); print('  best so far', round(lt, 4), p, flush=True)
    params = best[1]
params = fit_growth(params)
say('forward rating parameters (tuned on 1980-2017 bouts, grade steps fitted):', params)
# missed seasons: compare the three gap rules on held-out 2018-26 bouts, overall and for bouts where a wrestler is
# back after sitting out at least one season; keep the best on the returners (ties go to the overall score)
def _gap_eval(mode):
    p_ = dict(params, gap=mode); E_ = Elo(**p_); seen = {}; ll = [0.0, 0]; llr = [0.0, 0]
    for b in bouts:
        if b['result'] in SKIP: continue
        back = any(b['year'] - seen.get(k, b['year']) >= 2 for k in (b['wk'], b['lk']))
        rw = E_.get(b['wk'], b['year'], b['lr']); rl = E_.get(b['lk'], b['year'], b['lr']); pw = E_.p(rw, rl)
        if b['year'] > 2017:
            l = -math.log(max(pw, 1e-9)); ll[0] += l; ll[1] += 1
            if back: llr[0] += l; llr[1] += 1
        m = E_.marg.get(b['result'], 1.0); E_.R[b['wk']] = rw + E_.kf(b['wk']) * m * (1 - pw); E_.R[b['lk']] = rl - E_.kf(b['lk']) * m * (1 - pw)
        E_.n[b['wk']] += 1; E_.n[b['lk']] += 1; seen[b['wk']] = b['year']; seen[b['lk']] = b['year']
    return ll[0] / ll[1], llr[0] / max(1, llr[1]), llr[1]
_gr = {m: _gap_eval(m) for m in ('decay', 'hold', 'grow')}
for m, (a, r, n_) in _gr.items(): say(f'missed-season rule {m}: held-out 2018-26 log loss {a:.4f}; bouts with a wrestler back after a missed season (n={n_}) {r:.4f}')
params = dict(params, gap=min(_gr, key=lambda m: (round(_gr[m][1], 4), _gr[m][0])))
say(f'missed-season rule chosen: {params["gap"]}')
lt, lh, acc, nh, E, PRE, END = run(params, keep=True)
say(f'forward rating log loss: tuning years {lt:.4f}; held-out 2018-2026 {lh:.4f} over {nh} bouts, accuracy {acc:.3f} (coin flip 0.6931)')
_, lh1, acc1, *_ = run(dict(params, marg=(1, 1, 1, 1)))
_, lh2, acc2, *_ = run(dict(params, grow=(0, 0, 0)))
say(f'  ablations held-out: no margin factor {lh1:.4f} / {acc1:.3f}; no grade step {lh2:.4f} / {acc2:.3f}')
seed_of = {}
for (lvl, t, w), es in entrants.items():
    if lvl != 'state': continue
    for k, nm, sc, pl, sd in es:
        m = re.match(r'^[A-Z/0-9]+-(\d+)$', sd or '')
        if m: seed_of[(t, w, k)] = int(m.group(1))
pairs = []
for b in bouts:
    if b['i'] not in PRE or b['level'] != 'state' or b['year'] < 1980: continue
    sw, sl = seed_of.get((b['tournament'], b['weight'], b['wk'])), seed_of.get((b['tournament'], b['weight'], b['lk']))
    if sw and sl: pairs.append((sw - sl, *PRE[b['i']], b['year']))
def lgl(z): return -math.log(1 / (1 + math.exp(-z)))
tr = [r for r in pairs if r[3] <= 2017]; te = [r for r in pairs if r[3] > 2017]
a = min((x / 100 for x in range(1, 200)), key=lambda a: sum(lgl(-a * d) for d, *_ in tr))
X = np.array([[-d, (rw - rl) / 400] for d, rw, rl, y in tr]);
from scipy.optimize import minimize
f = lambda w: np.mean(np.log1p(np.exp(-(X @ w))))
wfit = minimize(f, [0.3, 1.0]).x
Xt = np.array([[-d, (rw - rl) / 400] for d, rw, rl, y in te])
say(f'state bouts 2018-2026 with both regional seeds (n={len(te)}): seed-only {np.mean([lgl(-a*d) for d,*_ in te]):.4f}, '
    f'rating-only {np.mean([-math.log(1/(1+10**((rl-rw)/400))) for d,rw,rl,y in te]):.4f}, seed+rating {np.mean(np.log1p(np.exp(-(Xt @ wfit)))):.4f}')

# ============================================================ layer 2: season strength (batch, smoothed through time)
# Brock's rule: inside a season, order is noise. Beating someone at districts who went on to win states that season
# counts the same as beating him at states. So each season is fit as one batch (Bradley-Terry on the Elo scale, every
# bout of that season at every level, weighted by result), and seasons are linked by a prior: season t is shrunk
# toward a fitted blend of the same wrestler's t-2, t-1, t+1, t+2 strengths plus a per-grade term. The forward Elo
# above is kept only for the leak-free prediction test and as the "entering rating" control in the evaluation.
C_ = math.log(10) / 400
MW = {'fall': 1.5, 'tf': 1.4, 'md': 1.2, 'dec': 1.0}
def mweight(b):
    if b['result'] in SKIP: return 0.0
    if b['result'] == 'dec' and re.search(r'\b(OT|SV|TB|UTB|2OT|UT)\b', b['flags'] or ''): return 0.8
    return MW.get(b['result'], 1.0)
# identities: one name+school can be several people (father and son, or unrelated wrestlers years apart). Same rule as
# tools/build_people.js splitCareers: a career spans at most 4 seasons (5 when grades show a repeated year), grades
# never go backward, every grade implies the same graduating class (+-1 for a repeat), no season past graduation.
years_of = defaultdict(set)
for b in bouts: years_of[b['wk']].add(b['year']); years_of[b['lk']].add(b['year'])
for (lvl, t, w), es in entrants.items():
    for e in es: years_of[e[0]].add(int(t[:4]))
def split_careers(k, ys):
    cs = []
    for y in sorted(ys):
        g = grade.get((k, y)); g = g + 9 if g is not None else 0; gy = y + 12 - g if g else 0
        c = cs[-1] if cs else None; ok = c is not None
        if ok:
            rep = (gy and c['gy'] and gy == c['gy'] + 1) or (g and c['lg'] and g == c['lg'] and y > c['end'])
            if y - c['start'] > (4 if (rep or c['rep']) else 3): ok = False
            if ok and g and c['lg'] and g < c['lg']: ok = False
            if ok and gy and c['gy'] and abs(gy - c['gy']) > 1: ok = False
            if ok and not gy and c['gy'] and y > c['gy']: ok = False
            if ok and rep: c['rep'] = True
        if not ok: cs.append(dict(start=y, end=y, gy=gy, lg=g, rep=False))
        else:
            c['end'] = y
            if g: c['lg'] = g; c['gy'] = c['gy'] or gy
    return [c['start'] for c in cs]
IDN = {}; _nsplit = 0
for k, ys in years_of.items():
    starts = split_careers(k, ys); _nsplit += len(starts) > 1
    for y in ys:
        n = sum(1 for st in starts[1:] if y >= st)
        IDN[(k, y)] = k if n == 0 else f'{k}#{n}'
say(f'careers: {_nsplit} name+school keys split into several careers')
ID = lambda k, y: IDN.get((k, y), k)
for b in bouts: b['wi'] = ID(b['wk'], b['year']); b['li'] = ID(b['lk'], b['year'])
# season data: bouts + placement-implied pairs for brackets without (enough) bouts
season_b = defaultdict(list)          # year -> [(winner id, loser id, weight, bout index or -1)]
for b in bouts:
    m = mweight(b)
    if m > 0: season_b[b['year']].append((b['wi'], b['li'], m, b['i']))
bouts_in = Counter(b['bk'] for b in bouts)
PLACE_W = 0.3
npseudo = 0
for bk, es in entrants.items():
    y = int(bk[1][:4]); pl = sorted([(e[3], ID(e[0], y)) for e in es if e[3]], key=lambda x: x[0])
    if len(pl) < 2 or bouts_in.get(bk, 0) >= len(pl) or (NO_SEC_BOUTS and bk[0] == 'section') or (FIRST == 'drop' and bk[0] in ('district', 'section')): continue
    for i in range(len(pl)):
        for j in range(i + 1, len(pl)):
            season_b[y].append((pl[i][1], pl[j][1], PLACE_W / (len(pl) - 1), ('P', bk[0]))); npseudo += 1
say(f'\nseason-batch fit: {sum(len(v) for v in season_b.values()) - npseudo} bouts + {npseudo} placement-implied pairs (weight {PLACE_W}/(placers-1)) for brackets with fewer bouts than placers')
def fit_season(rows, ids, mu, sd, mask=None):
    """MAP Bradley-Terry: maximize sum m*log sigma(c*(t_w - t_l)) - sum (t-mu)^2/(2 sd^2)"""
    idx = {k: i for i, k in enumerate(ids)}
    W = np.array([idx[r[0]] for r in rows if mask is None or r[3] not in mask], int)
    L = np.array([idx[r[1]] for r in rows if mask is None or r[3] not in mask], int)
    M = np.array([r[2] for r in rows if mask is None or r[3] not in mask], float)
    mu = np.asarray(mu, float); iv = 1 / np.asarray(sd, float) ** 2
    def f(t):
        z = C_ * (t[W] - t[L]); sp = np.logaddexp(0, -z)
        g = np.zeros_like(t); s = M * C_ * (1 / (1 + np.exp(z)))
        np.add.at(g, W, -s); np.add.at(g, L, s)
        d = t - mu; return float((M * sp).sum() + 0.5 * (iv * d * d).sum()), g + iv * d
    r = minimize(f, mu.copy(), jac=True, method='L-BFGS-B', options={'maxiter': 500})
    return dict(zip(ids, r.x))
YEARS = sorted(season_b)
ids_of = {y: sorted({r[0] for r in season_b[y]} | {r[1] for r in season_b[y]}) for y in YEARS}
nb_of = Counter()
for y in YEARS:
    for r in season_b[y]:
        if isinstance(r[3], int): nb_of[(r[0], y)] += 1; nb_of[(r[1], y)] += 1
gr = lambda i, y: grade.get((i.split('#')[0], y))
start_of = {}
for y in YEARS:
    for i in ids_of[y]:
        if i not in start_of or y < start_of[i]: start_of[i] = y
# ---- coverage: is the wrestler's district bracket on file for this season? Same rule as tools/build_units.js: a
# district tournament counts only when its full field is on file (>= 24 entrants). Wrestlers whose district bracket is
# missing (most D7 and D3 AAA seasons) have only their regional/state bouts, so the season fit pulls them toward a
# too-low mean; docs/CALIBRATION.md measured the effect at states (+59 points). A fitted shift per class and era moves
# their prior mean back. Fitted on cross-coverage bouts before 2018 only, so the 2018-26 tests stay leak-free.
_tsize = Counter()
for (lvl, t, w), es in entrants.items():
    if lvl in ('district', 'section'): _tsize[t] += len(es)
# a section bracket (the qualifier below districts: D3, D7 and D1 AAA) shows the same full field, so it counts too
COVERED = set()
for (lvl, t, w), es in entrants.items():
    if lvl in ('district', 'section') and _tsize[t] >= 24:
        y = int(t[:4])
        for e in es: COVERED.add((ID(e[0], y), y))
CLS_OF = {}
for b in bouts: CLS_OF.setdefault((b['wi'], b['year']), b['c']); CLS_OF.setdefault((b['li'], b['year']), b['c'])
def era_of(y): return 'e0' if y < 1990 else 'e1' if y < 2005 else 'e2'
ADV = set()   # wrestler-seasons that reached a regional or state bracket
for (lvl, t, w), es in entrants.items():
    if lvl in ('regional', 'state'):
        y = int(t[:4])
        for e in es: ADV.add((ID(e[0], y), y))
for b in bouts:
    if b['level'] in ('regional', 'state'): ADV.add((b['wi'], b['year'])); ADV.add((b['li'], b['year']))
def _ud(unit):
    m = re.match(r'D(\d+)', unit or ''); return int(m.group(1)) if m else None
def _e5(y): return 0 if y < 1956 else 1 if y < 1974 else 2 if y < 1990 else 3 if y < 2005 else 4
# where the regional a bracket fed is missing from the record, its wrestlers would all look like first-round exits and
# get the lower prior: missing data penalising them. Infer who advanced from where they placed: the number that advance
# from that kind of bracket (district number, level, class, era) in seasons where the regional is on file.
_regy = defaultdict(set)                          # (year, weight) -> wrestler ids in regional or state brackets that season
for (lvl, t, w), es in entrants.items():
    if lvl in ('regional', 'state'):
        y = int(t[:4]); [_regy[(y, wn(w))].add(ID(e[0], y)) for e in es]
_tier = {int(t[:4]) for (lvl, t, w) in entrants if lvl == 'regional'}
_has_dist = {(int(t[:4]), _ud(bracket_meta[(lvl, t, w)][2]), wn(w)) for (lvl, t, w) in entrants if lvl == 'district'}
_nadv = defaultdict(list); _missing = []
for (lvl, t, w), es in entrants.items():
    if lvl not in ('district', 'section'): continue
    y = int(t[:4])
    if y not in _tier: continue
    d = _ud(bracket_meta[(lvl, t, w)][2])
    if lvl == 'section' and (y, d, wn(w)) in _has_dist: continue     # a district bracket above it decides who advanced
    k = (d, lvl, bracket_meta[(lvl, t, w)][1], _e5(y)); ids = [ID(e[0], y) for e in es]
    n_ = sum(1 for i in ids if i in _regy[(y, wn(w))])
    if n_: _nadv[k].append(n_)
    elif any(e[3] for e in es): _missing.append(((lvl, t, w), k, y))
_nadv_l = defaultdict(list)
for k, v in _nadv.items(): _nadv_l[k[1]] += v
_inferred = 0
for bk, k, y in _missing:
    v = _nadv.get(k) or _nadv_l.get(k[1]) or [4]
    K = int(np.median(v))
    for e in entrants[bk]:
        if e[3] and e[3] <= K and (ID(e[0], y), y) not in ADV: ADV.add((ID(e[0], y), y)); _inferred += 1
say(f'reached regionals: {len(ADV)} wrestler-seasons on file + {_inferred} inferred from placements in {len(_missing)} brackets whose regional is missing')
def cov_group(i, y):
    """None when the district bracket is on file; else (class, era)"""
    if (i, y) in COVERED: return None
    return (CLS_OF.get((i, y), 'single'), era_of(y))
# ---- district prior (v5): every wrestler-season's prior mean starts at his district's level, fitted from how that
# district's wrestlers do against other districts' wrestlers at regionals and states (one offset per district, class and
# era). With few bouts on file a rating leans on its prior, and a single statewide prior mean pulls every district toward
# the state average: districts with thin records (missing brackets, no sections) look more average than they are, and
# districts with deep records less so. A per-district prior fitted on cross-district results treats every district by
# the same rule and replaces the v4 coverage shift (a special rule for wrestlers without a district bracket).
_dvote = defaultdict(Counter); _sdvote = defaultdict(Counter)
def _unit_d(unit):
    m = re.match(r'D(\d+)', unit or ''); return int(m.group(1)) if m else None
for (lvl, t, w), es in entrants.items():
    if lvl not in ('district', 'section'): continue
    y, _c, unit, _lr = bracket_meta[(lvl, t, w)]; d = _unit_d(unit)
    if not d: continue
    for e in es: _dvote[(ID(e[0], y), y)][d] += 1; _sdvote[nk(e[2])][d] += 1
for b in bouts:
    if b['level'] in ('district', 'section'):
        d = _unit_d(b['unit'])
        if d: _dvote[(b['wi'], b['year'])][d] += 1; _dvote[(b['li'], b['year'])][d] += 1
SCH_OF = {}
for b in bouts: SCH_OF.setdefault((b['wi'], b['year']), nk(b['winner_school'])); SCH_OF.setdefault((b['li'], b['year']), nk(b['loser_school']))
def dist_of(i, y):
    v = _dvote.get((i, y))
    if v: return v.most_common(1)[0][0]
    s = _sdvote.get(SCH_OF.get((i, y), ''))
    return s.most_common(1)[0][0] if s else None
def era5(y): return 0 if y < 1956 else 1 if y < 1974 else 2 if y < 1990 else 3 if y < 2005 else 4
GROUP_MODE = os.environ.get('RATINGS_GROUP', 'district')
BLOCK = int(os.environ.get('RATINGS_BLOCK', 0))   # 0: the five eras; N: N-season blocks, smoothed between neighbours
def eblock(y): return era5(y) if not BLOCK else y // BLOCK * BLOCK
def dist_group(i, y):
    d = dist_of(i, y); return None if d is None else (CLS_OF.get((i, y), 'single'), eblock(y), d)
def grp(i, y): return dist_group(i, y) if GROUP_MODE == 'district' else cov_group(i, y)
say(f'coverage: {len(COVERED)} wrestler-seasons with their district bracket on file; district tournaments with a full field: {sum(1 for t in _tsize if _tsize[t] >= 24)} of {len(_tsize)}')
DS = (-2, -1, 1, 2)
def avail(T0, i, y): return tuple(T0.get(y + d, {}).get(i) is not None for d in DS)
def gone(i, y, av):
    """no next season because he graduated (known SR, or the 4th season of his career): structurally missing,
    not the same as a wrestler who did not return."""
    return (not av[2]) and (gr(i, y) == 3 or y - start_of.get(i, y) >= 3)
def fresh(i, y, av): return (not av[1]) and gr(i, y) == 0
MIN_PAT = 300
PRIORS = {}; CAPTURE = [False]
STG = {}
def stg(i, y):
    """(class, era) for a wrestler-season that ended in the first round (no regional or state bracket); else None"""
    if (i, y) in ADV: return None
    return (CLS_OF.get((i, y), 'single'), era_of(y))
def smoother(mask=None, iters=5, report=False, sd_scale=1.0, shift=None):
    """Season-only fits, then one prior pass. The prior for season t is a regression on the neighbours'
    season-only strengths fitted SEPARATELY per neighbour-availability pattern (which of t-2, t-1, t+1, t+2 exist,
    plus whether a missing next season is graduation and a missing previous season is freshman year). A single
    regression with missing-value indicators uses slopes fitted where both sides exist (they sum ~1.2), so a senior
    with only his past got a prior of ~0.7 x past: elite seniors were pulled toward the mean (the senior-year taper)."""
    T0 = {}
    for y in YEARS:
        ids = ids_of[y]; sh = (lambda i: (shift or {}).get(grp(i, y), 0.0))
        T0[y] = fit_season(season_b[y], ids, [1500 + sh(i) + STG.get(stg(i, y), 0.0) for i in ids], [250] * len(ids), mask)
    def pkey(i, y):
        av = avail(T0, i, y); return av + (gone(i, y, av), fresh(i, y, av))
    def coarse(k): return (any(k[:2]), any(k[2:4]), k[4], k[5])
    groups = defaultdict(list); cgroups = defaultdict(list)
    for y in YEARS:
        for i, v in T0[y].items():
            if nb_of[(i, y)] < 4: continue
            k = pkey(i, y)
            if not any(k[:4]): continue
            A = [T0.get(y + d, {}).get(i) for d in DS]
            groups[k].append((v, A, gr(i, y))); cgroups[coarse(k)].append((v, A, gr(i, y)))
    def design(A, g, av): return [(A[j] - 1500) for j in range(4) if av[j]] + [1.0 if g == j else 0.0 for j in range(4)] + [1.0]
    def fitg(rows, av):
        X = np.array([design(A, g, av) for _, A, g in rows]); yv = np.array([v - 1500 for v, *_ in rows]); ns = sum(av)
        f = lsq_linear(X, yv, bounds=([0] * ns + [-np.inf] * 5, [np.inf] * (ns + 5)))
        return f.x, float((yv - X @ f.x).std()) * sd_scale
    models = {}; cmodels = {}
    for k, rows in groups.items():
        if len(rows) >= MIN_PAT: models[k] = fitg(rows, k[:4])
    pop_sd = float(np.std([v for y in YEARS for v in T0[y].values()]))
    def model(k):
        if k in models: return models[k], k[:4]
        ck = coarse(k)
        if ck + k[:4] not in cmodels:
            # coarse fallback: same side availability, rows restricted to the exact availability of k for the regressors
            rows = [r for r in cgroups.get(ck, []) if all((r[1][j] is not None) >= k[j] for j in range(4))]
            cmodels[ck + k[:4]] = fitg(rows, k[:4]) if len(rows) >= 50 else None
        m = cmodels.get(ck + k[:4]); return (m, k[:4]) if m else (None, k[:4])
    nog = [(v - 1500, gr(i, y)) for y in YEARS for i, v in T0[y].items() if nb_of[(i, y)] >= 4 and not any(avail(T0, i, y))]
    gmean = {j: float(np.mean([v for v, g in nog if g == j])) if any(g == j for v, g in nog) else 0.0 for j in (0, 1, 2, 3, None)}
    T = {y: dict(T0[y]) for y in YEARS}
    for it in range(1):
        delta = 0.0
        for y in YEARS:
            ids = ids_of[y]; mu, sd = [], []
            for i in ids:
                k = pkey(i, y)
                if any(k[:4]):
                    m, av = model(k)
                    if m is not None:
                        w, rs = m; A = [T0.get(y + d, {}).get(i) for d in DS]
                        mu.append(1500 + float(np.dot(design(A, gr(i, y), av), w))); sd.append(rs); continue
                mu.append(1500 + gmean.get(gr(i, y), gmean[None])); sd.append(pop_sd)
            if shift: mu = [m + shift.get(grp(i, y), 0.0) * SHIFT_PASS for m, i in zip(mu, ids)]
            if STG: mu = [m + STG.get(stg(i, y), 0.0) for m, i in zip(mu, ids)]
            new = fit_season(season_b[y], ids, mu, sd, mask)
            if (report or CAPTURE[0]) and mask is None: PRIORS[y] = (ids, mu, sd)
            delta = max(delta, max(abs(new[i] - T[y][i]) for i in ids)); T[y] = new
        if report: say(f'  prior pass: largest change from season-only estimates {delta:.0f}')
    if report:
        say('  prior models by neighbour pattern (t-2 t-1 t+1 t+2 | graduated | freshman): n, slopes, slope sum, resid sd')
        for k in sorted(models, key=lambda k: -len(groups[k])):
            w, rs = models[k]; ns = sum(k[:4]); sl = ' '.join(f'{x:.2f}' for x in w[:ns])
            say(f'    {"".join("x" if a else "." for a in k[:4])} g{int(k[4])} f{int(k[5])}: n={len(groups[k])}, slopes {sl}, sum {sum(w[:ns]):.2f}, sd {rs:.0f}')
    top = max(models, key=lambda k: len(groups[k])) if models else None
    return T, T0, [0] * 13, (models[top][1] if top else pop_sd)
# ---- coverage shift: iterate until bouts between covered and uncovered wrestler-seasons (regional + state, before 2018)
# show no remaining coverage residual, one shift per (class, era)
SHIFT_PASS = 1.0
# AAA only: AA district coverage is ~96% complete and its uncovered wrestlers are mostly D3; an AA shift (+80, fitted
# on those) over-rated AA SC at states in the 2018-26 held-out test (cross-region log loss 0.4261 -> 0.4314)
SHIFT_CLASSES = {'AAA'}
def cov_resid(T, lo, hi, skip=frozenset()):
    acc = defaultdict(list)
    for b in bouts:
        if b['i'] in skip: continue
        if b['result'] in SKIP or b['level'] in ('district', 'section') or not (lo <= b['year'] <= hi): continue
        gw, gl = cov_group(b['wi'], b['year']), cov_group(b['li'], b['year'])
        if (gw is None) == (gl is None): continue
        tw, tl = T.get(b['year'], {}).get(b['wi']), T.get(b['year'], {}).get(b['li'])
        if tw is None or tl is None: continue
        g = gw or gl; sgn = 1.0 if gw else -1.0            # +: the uncovered wrestler won
        if g[0] not in SHIFT_CLASSES: continue
        acc[g].append((tw - tl, sgn))
    out = {}
    for g, rows in acc.items():
        if len(rows) < 200: continue
        d = np.array([r[0] for r in rows]); sg = np.array([r[1] for r in rows])
        def nll(c): return float(np.logaddexp(0, -C_ * (d + c * sg)).sum())
        r = minimize(lambda x: nll(x[0]), [0.0], method='Nelder-Mead'); out[g] = (float(r.x[0]), len(rows))
    return out
def dist_resid(T, lo, hi, skip=frozenset()):
    """joint logistic fit of one correction per district group on cross-district regional and state bouts"""
    rows = []
    for b in bouts:
        if b['i'] in skip or b['result'] in SKIP or b['level'] in ('district', 'section') or not (lo <= b['year'] <= hi): continue
        gw, gl = dist_group(b['wi'], b['year']), dist_group(b['li'], b['year'])
        if gw is None or gl is None or gw == gl: continue
        tw, tl = T.get(b['year'], {}).get(b['wi']), T.get(b['year'], {}).get(b['li'])
        if tw is None or tl is None: continue
        rows.append((tw - tl, gw, gl))
    cnt = Counter(); [cnt.update([g, h]) for _, g, h in rows]
    G = sorted(g for g, n_ in cnt.items() if n_ >= (60 if BLOCK else 150)); gi = {g: k for k, g in enumerate(G)}
    # with blocks, neighbouring blocks of the same class and district are tied together (random-walk penalty, sd SMOOTH
    # raw points per block), so a district's level can change over time without one thin block swinging on its own
    nb = []
    if BLOCK:
        for g in G:
            h = (g[0], g[1] + BLOCK, g[2])
            if h in gi: nb.append((gi[g], gi[h]))
    nb = np.array(nb, int).reshape(-1, 2); lam2 = 1 / SMOOTH ** 2
    rows = [r for r in rows if r[1] in gi or r[2] in gi]
    d = np.array([r[0] for r in rows]); W_ = np.array([gi.get(r[1], -1) for r in rows]); L_ = np.array([gi.get(r[2], -1) for r in rows])
    lam = 1e-4
    def f(c):
        cw = np.where(W_ >= 0, c[np.maximum(W_, 0)], 0.0); cl = np.where(L_ >= 0, c[np.maximum(L_, 0)], 0.0)
        z = C_ * (d + cw - cl); sp = np.logaddexp(0, -z); s_ = -C_ / (1 + np.exp(z))
        g = np.zeros(len(G)); np.add.at(g, W_[W_ >= 0], s_[W_ >= 0]); np.add.at(g, L_[L_ >= 0], -s_[L_ >= 0])
        val = float(sp.sum() + 0.5 * lam * (c * c).sum()); g = g + lam * c
        if len(nb):
            dd = c[nb[:, 0]] - c[nb[:, 1]]; val += 0.5 * lam2 * float((dd * dd).sum())
            np.add.at(g, nb[:, 0], lam2 * dd); np.add.at(g, nb[:, 1], -lam2 * dd)
        return val, g
    r = minimize(f, np.zeros(len(G)), jac=True, method='L-BFGS-B')
    c = r.x - np.average(r.x, weights=[cnt[g] for g in G])   # anchored: corrections average zero over bouts
    return {g: (float(c[gi[g]]), cnt[g]) for g in G}
RESID = dist_resid if GROUP_MODE == 'district' else cov_resid
SMOOTH = float(os.environ.get('RATINGS_SMOOTH', 40))
NIT = int(os.environ.get('RATINGS_SHIFT_ITERS', 15)); TOL = float(os.environ.get('RATINGS_SHIFT_TOL', 2))
# the district offsets are fitted on seasons up to FIT_HI: 2017 while testing (so the 2018-26 tests stay unseen), all
# seasons for the published ratings (the default)
FIT_HI = 2017 if os.environ.get('RATINGS_SHIFT_TEST') or os.environ.get('RATINGS_FIT_TEST') else 2026
SHIFT = {}
# RATINGS_NO_SHIFT=1 turns the coverage shift off, for the with/without comparison on held-out state bouts
for it in range(0 if os.environ.get('RATINGS_NO_SHIFT') else NIT):
    Ts, *_ = smoother(sd_scale=2.0, shift=SHIFT)
    res = RESID(Ts, 1938 if GROUP_MODE == 'district' else 1974, FIT_HI)
    say(f'{GROUP_MODE} prior pass {it + 1}: largest residual {max([abs(v[0]) for v in res.values()] or [0]):.0f} over {len(res)} groups')
    done_s = all(abs(v[0]) < TOL for v in res.values())
    for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
    done_p = True
    if done_s and done_p: break
say(f'{GROUP_MODE} prior offsets (raw points added to the prior mean): ' + ', '.join(f'{"/".join(str(x) for x in k)} {v:+.0f}' for k, v in sorted(SHIFT.items(), key=lambda kv: str(kv[0]))))
# first-round prior (RATINGS_FIRST_STAGE=prior): one offset added to the prior mean of every wrestler-season that ended in
# the first round. It can't be set from those wrestlers' own fitted ratings (a wrestler with no wins has no lower bound,
# so the mean keeps falling), so it is chosen by prediction: hide 10% of 1990-2017 regional and state bouts and keep
# the offset that predicts them best. The 2018-26 tests never see this choice.
# first-round level by marginal likelihood (RATINGS_FIRST_STAGE=marginal): the group of wrestlers whose season ended in
# the first round gets its own prior offset, estimated from their own bouts against everyone else's fitted strengths.
# Each wrestler's strength is integrated over his prior (Gauss-Hermite), so a wrestler with no wins does not run off to
# minus infinity the way a point estimate does, and the group level settles where its real results put it.
def est_first(Tf, label):
    from numpy.polynomial.hermite_e import hermegauss
    xk, wk = hermegauss(24); lw = np.log(wk / math.sqrt(2 * math.pi))
    G = sorted({g for y in PRIORS for i in PRIORS[y][0] for g in [stg(i, y)] if g is not None})
    gi = {g: n for n, g in enumerate(G)}
    kid_m, kid_s, kid_g, b_kid, b_opp, b_sg, b_w = [], [], [], [], [], [], []
    for y in YEARS:
        if y not in PRIORS: continue
        ids, mu, sd = PRIORS[y]; Ty = Tf[y]; loc = {}
        for i, m, s_ in zip(ids, mu, sd):
            g = stg(i, y)
            if g is None: continue
            loc[i] = len(kid_m); kid_m.append(m - STG.get(g, 0.0)); kid_s.append(s_); kid_g.append(gi[g])
        for r in season_b[y]:
            for me, op, sg in ((r[0], r[1], 1), (r[1], r[0], -1)):
                if me in loc and op in Ty and op not in loc and isinstance(r[3], int): b_kid.append(loc[me]); b_opp.append(Ty[op]); b_sg.append(sg); b_w.append(r[2])   # only bouts against wrestlers outside the group place the group
    kid_m, kid_s, kid_g = np.array(kid_m), np.array(kid_s), np.array(kid_g)
    b_kid, b_opp, b_sg, b_w = np.array(b_kid), np.array(b_opp), np.array(b_sg, float), np.array(b_w)
    def total(delta):   # delta per group -> marginal log likelihood per group
        th = (kid_m + delta[kid_g])[:, None] + kid_s[:, None] * xk[None, :]          # kids x nodes
        z = C_ * b_sg[:, None] * (th[b_kid] - b_opp[:, None])
        ll = np.zeros_like(th); np.add.at(ll, b_kid, -b_w[:, None] * np.logaddexp(0, -z))
        mx = (ll + lw).max(1, keepdims=True); per = (mx[:, 0] + np.log(np.exp(ll + lw - mx).sum(1)))
        return np.bincount(kid_g, weights=per, minlength=len(G))
    grid = np.arange(-1400, 1, 50.0); best = np.full(len(G), -1e300); arg = np.zeros(len(G))
    for d in grid:
        v = total(np.full(len(G), d)); upd = v > best; best[upd] = v[upd]; arg[upd] = d
    for step in (25.0, 10.0, 4.0):   # refine each group around its best
        for d0 in (-step, step):
            v = total(arg + d0); better = v > best; best[better] = v[better]; arg = np.where(better, arg + d0, arg)
    out = {g: float(arg[gi[g]]) for g in G}
    say(f'  first-round level ({label}), marginal likelihood over {len(kid_m)} wrestler-seasons, {len(b_kid)} bouts: ' + ', '.join(f'{g[0]}/{g[1]} {v:+.0f}' for g, v in sorted(out.items())))
    return out
if FIRST == 'marginal':
    STG.update({(c, e): -400.0 for c in ('AAA', 'AA', 'single') for e in ('e0', 'e1', 'e2')})
    for it in range(8):
        CAPTURE[0] = True; Ts, *_ = smoother(sd_scale=2.0, shift=SHIFT); CAPTURE[0] = False
        new_ = est_first(Ts, f'pass {it + 1}'); moved = max(abs(new_.get(k, v) - v) for k, v in STG.items()); STG.update(new_)
        for it2 in range(NIT):
            Ts, *_ = smoother(sd_scale=2.0, shift=SHIFT); res = RESID(Ts, 1938, FIT_HI)
            if all(abs(v[0]) < TOL for v in res.values()): break
            for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
        if moved < 10: break
if FIRST == 'prior':
    import zlib
    TUNE = {b['i'] for b in bouts if b['level'] in ('regional', 'state') and 1990 <= b['year'] <= 2017 and b['result'] not in SKIP
            and zlib.crc32(('t|' + b['tournament'] + b['weight'] + b['winner'] + b['loser'] + str(b['round'])).encode()) % 10 == 0}
    tb_ = [b for b in bouts if b['i'] in TUNE]; best = None
    for off in (-200, -300, -400, -500, -600, -800, -1000, -1500):
        STG.clear(); STG.update({(c, e): float(off) for c in ('AAA', 'AA', 'single') for e in ('e0', 'e1', 'e2')})
        Tt, *_ = smoother(mask=TUNE, sd_scale=2.0, shift=SHIFT)
        ll = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Tt[b['year']][b['li']] - Tt[b['year']][b['wi']]) / 400)))) for b in tb_])
        say(f'  first-round prior offset {off:+d}: log loss on hidden 1990-2017 regional + state bouts {ll:.4f}')
        if best is None or ll < best[1]: best = (off, ll)
    STG.clear(); STG.update({(c, e): float(best[0]) for c in ('AAA', 'AA', 'single') for e in ('e0', 'e1', 'e2')})
    say(f'first-round prior offset chosen: {best[0]:+d}')
    for it in range(NIT):
        Ts, *_ = smoother(sd_scale=2.0, shift=SHIFT); res = RESID(Ts, 1938, FIT_HI)
        say(f'district prior refit {it + 1} with first-round prior: largest residual {max(abs(v[0]) for v in res.values()):.0f}')
        if all(abs(v[0]) < TOL for v in res.values()): break
        for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
# prior strength: the regression residual overstates the prior sd (its target is itself noisy), so scale it,
# tuned on hidden 1990-2017 bouts
random.seed(5)
tune_held = {b['i'] for b in bouts if 1990 <= b['year'] <= 2017 and b['result'] not in SKIP and random.random() < 0.05}
tb = [b for b in bouts if b['i'] in tune_held]
scores = {}
for sc in (0.7, 1.0, 1.5, 2.0, 2.5, 3.0, 4.5):
    Tt, *_ = smoother(mask=tune_held, sd_scale=sc, shift=SHIFT)
    scores[sc] = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Tt[b['year']][b['li']] - Tt[b['year']][b['wi']]) / 400)))) for b in tb])
# the held-out loss is nearly flat across a range of prior widths; within that flat range (0.001 of the best) take
# the widest prior, so the season's own bouts decide and the prior only fills gaps
SDS = max(k for k, v in scores.items() if v <= min(scores.values()) + 0.001)
say('prior sd scale (hidden 5% of 1990-2017 bouts): ' + ', '.join(f'{k}: {v:.4f}' for k, v in scores.items()) + f' -> {SDS}')
# the district offsets move the prior mean, and how far a rating follows its prior depends on the prior width: offsets
# fitted at one width and applied at another over- or under-shoot (most where a season has few bouts). Refit them at
# the width the ratings actually use.
if SDS != 2.0 and not os.environ.get('RATINGS_NO_SHIFT'):
    for it in range(NIT):
        Ts, *_ = smoother(sd_scale=SDS, shift=SHIFT); res = RESID(Ts, 1938, FIT_HI)
        say(f'district prior refit {it + 1} at prior sd scale {SDS}: largest residual {max(abs(v[0]) for v in res.values()):.0f}')
        if all(abs(v[0]) < TOL for v in res.values()): break
        for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
    if FIRST == 'marginal':   # the first-round level again, at the final prior width
        for it in range(8):
            CAPTURE[0] = True; Ts, *_ = smoother(sd_scale=SDS, shift=SHIFT); CAPTURE[0] = False
            new_ = est_first(Ts, f'final width, pass {it + 1}'); moved = max(abs(new_.get(k, v) - v) for k, v in STG.items()); STG.update(new_)
            for it2 in range(NIT):
                Ts, *_ = smoother(sd_scale=SDS, shift=SHIFT); res = RESID(Ts, 1938, FIT_HI)
                if all(abs(v[0]) < TOL for v in res.values()): break
                for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
            if moved < 10: break
    if FIRST == 'prior':   # the first-round offset was chosen at the wider width; check it again at this one
        best2 = None
        for off in (-400, -500, -600, -700, -800, -900, -1000):
            STG.update({k: float(off) for k in STG})
            Tt, *_ = smoother(mask=TUNE, sd_scale=SDS, shift=SHIFT)
            ll = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Tt[b['year']][b['li']] - Tt[b['year']][b['wi']]) / 400)))) for b in tb_])
            say(f'  first-round prior offset {off:+d} at prior sd scale {SDS}: log loss {ll:.4f}')
            if best2 is None or ll < best2[1]: best2 = (off, ll)
        STG.update({k: float(best2[0]) for k in STG}); say(f'first-round prior offset at the final width: {best2[0]:+d}')
        if best2[0] != best[0]:
            for it in range(NIT):
                Ts, *_ = smoother(sd_scale=SDS, shift=SHIFT); res = RESID(Ts, 1938, FIT_HI)
                say(f'district prior refit {it + 1} after the offset change: largest residual {max(abs(v[0]) for v in res.values()):.0f}')
                if all(abs(v[0]) < TOL for v in res.values()): break
                for g, (c, n) in res.items(): SHIFT[g] = SHIFT.get(g, 0.0) + c
# ---- does the coverage shift earn its place? Hide 15% of 1980-2017 state bouts, fit the shift and the ratings without
# them (shift fitted on the remaining bouts only), and score the hidden bouts with and without the shift. The subset that
# matters is bouts where exactly one wrestler has no district (or section) bracket on file.
if os.environ.get('RATINGS_SHIFT_TEST'):
    random.seed(11)
    SH = {b['i'] for b in bouts if b['level'] == 'state' and 1980 <= b['year'] <= 2017 and b['result'] not in SKIP and random.random() < 0.15}
    shH = {}
    for it in range(NIT):
        Tq, *_ = smoother(mask=SH, sd_scale=SDS, shift=shH)
        rq = RESID(Tq, 1938 if GROUP_MODE == 'district' else 1974, 2017, skip=SH)
        if all(abs(v[0]) < TOL for v in rq.values()): break
        for g, (c, n_) in rq.items(): shH[g] = shH.get(g, 0.0) + c
    def score(T, sel):
        ll = [-math.log(max(1e-9, 1 / (1 + 10 ** ((T[b['year']][b['li']] - T[b['year']][b['wi']]) / 400)))) for b in sel if T.get(b['year'], {}).get(b['wi']) is not None and T.get(b['year'], {}).get(b['li']) is not None]
        return np.mean(ll), len(ll)
    Ton, *_ = smoother(mask=SH, sd_scale=SDS, shift=shH); Toff, *_ = smoother(mask=SH, sd_scale=SDS, shift={})
    hb_all = [b for b in bouts if b['i'] in SH]
    hb_x = [b for b in hb_all if (cov_group(b['wi'], b['year']) is None) != (cov_group(b['li'], b['year']) is None) and b['c'] == 'AAA']
    for lab, sel in (('all hidden state bouts', hb_all), ('AAA, one side without a bracket', hb_x)):
        a, na = score(Ton, sel); c_, nc = score(Toff, sel)
        say(f'shift test, {lab} (n={na}): log loss with shift {a:.4f}, without {c_:.4f}')
    hb_cd = [b for b in hb_all if dist_of(b['wi'], b['year']) and dist_of(b['li'], b['year']) and dist_of(b['wi'], b['year']) != dist_of(b['li'], b['year'])]
    a, na = score(Ton, hb_cd); c_, nc = score(Toff, hb_cd); say(f'shift test, cross-district hidden state bouts (n={na}): log loss with {GROUP_MODE} prior {a:.4f}, without {c_:.4f}')
    # fairness: does each district win the hidden cross-district state bouts as often as its ratings say? (+ = underrated)
    tr_cd = [b for b in bouts if b['i'] not in SH and b['level'] == 'state' and 1980 <= b['year'] <= 2017 and b['result'] not in SKIP and dist_of(b['wi'], b['year']) and dist_of(b['li'], b['year']) and dist_of(b['wi'], b['year']) != dist_of(b['li'], b['year'])]
    for lab, T_, sel_ in (('with', Ton, hb_cd), ('without', Toff, hb_cd), ('TRAINING bouts, with', Ton, tr_cd)):
        acc = defaultdict(lambda: [0.0, 0.0, 0])
        for b in sel_:
            tw, tl = T_.get(b['year'], {}).get(b['wi']), T_.get(b['year'], {}).get(b['li'])
            if tw is None or tl is None: continue
            e = 1 / (1 + 10 ** ((tl - tw) / 400))
            for i_, sgn in ((b['wi'], 1), (b['li'], -1)):
                d_ = dist_of(i_, b['year']); a_ = acc[d_]; a_[0] += (1 - e) * sgn; a_[2] += 1
        say(f'  fairness {lab} prior, hidden cross-district state bouts: wins above expectation per bout by district: ' + ', '.join(f'D{d_} {v[0] / v[2]:+.3f} (n={v[2]})' for d_, v in sorted(acc.items()) if v[2] >= 60))
    import zlib
    HM = {b['i'] for b in bouts if b['level'] in ('regional', 'state') and b['year'] >= 2018 and b['result'] not in SKIP
          and zlib.crc32('|'.join((b['tournament'], b['weight'], b['side'], str(b['round']), b['winner'], b['loser'])).encode()) % 10 == 0}
    Tm, *_ = smoother(mask=HM, sd_scale=SDS, shift=SHIFT); hm = [b for b in bouts if b['i'] in HM]
    sc_, n_ = score(Tm, hm); acc_ = np.mean([Tm[b['year']][b['wi']] > Tm[b['year']][b['li']] for b in hm])
    say(f'common test, hidden 10% of 2018-26 regional + state bouts (n={n_}): log loss {sc_:.4f}, accuracy {acc_:.3f}')
# leak-free test of the batch rating: hide 10% of 2018-2026 bouts, fit without them, predict them
random.seed(3)
held = {b['i'] for b in bouts if b['year'] >= 2018 and b['result'] not in SKIP and random.random() < 0.10}
Th, *_ = smoother(mask=held, sd_scale=SDS, shift=SHIFT)
hb = [b for b in bouts if b['i'] in held]
ll_batch = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Th[b['year']][b['li']] - Th[b['year']][b['wi']]) / 400)))) for b in hb])
ll_fwd = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((PRE[b['i']][1] - PRE[b['i']][0]) / 400)))) for b in hb])
acc_b = np.mean([Th[b['year']][b['wi']] > Th[b['year']][b['li']] for b in hb])
say(f'held-out 10% of 2018-2026 bouts (n={len(hb)}), fit without them: season-batch strength log loss {ll_batch:.4f} accuracy {acc_b:.3f}; forward rating {ll_fwd:.4f}')
say('  (the batch number uses the rest of that season, before and after the bout; the forward number uses only the past. Both are leak-free for the hidden bout.)')
T, T0, Wt, RES_SD = smoother(report=True, sd_scale=SDS, shift=SHIFT)
say(f'prior sd (most common pattern, scaled): {RES_SD:.0f}')
def theta(k, y): return T.get(y, {}).get(ID(k, y))

# ============================================================ v2: one absolute scale, quality of wins, bad losses
# Scale: 1500 = the average state qualifier. Anchor per class group (AAA, AA, one-class era) on a rolling 11-season
# window of state entrants' season strength, so long drift between separately fitted seasons is removed while a
# deep year still reads deeper than its neighbours. Spread: the median sd of modern state qualifiers (raw Elo
# points), so a 400-point gap still means about 10:1.
state_vals = defaultdict(list)
for (lvl, t, w), es in entrants.items():
    if lvl != 'state': continue
    y, c = bracket_meta[(lvl, t, w)][:2]
    for e in es:
        v = theta(e[0], y)
        if v is not None: state_vals[(y, c)].append(v)
def _window(y, c):
    vals = [v for yy in range(y - 5, y + 6) for v in state_vals.get((yy, c), [])]
    return (float(np.mean(vals)), float(np.std(vals))) if len(vals) >= 40 else None
ANCHOR = {}
for y in YEARS:
    for c in ('AAA', 'AA', 'single'):
        a = _window(y, c)
        if a: ANCHOR[(y, c)] = a
SD_REF = float(np.median([sd for (y, c), (m, sd) in ANCHOR.items() if y >= 1980 and c != 'single']))
def anc(y, c):
    if (y, c) in ANCHOR: return ANCHOR[(y, c)]
    near = sorted((abs(g[0] - y), g) for g in ANCHOR if g[1] == c) or sorted((abs(g[0] - y), g) for g in ANCHOR)
    return ANCHOR[near[0][1]]
def norm(v, y, c):
    if v is None: return None
    m, sd = anc(y, c); return 1500 + (v - m) / sd * SD_REF
say(f'\nscale: 1500 = average state qualifier (rolling 11 seasons per class); raw anchor means {min(m for m,s in ANCHOR.values()):.0f}-{max(m for m,s in ANCHOR.values()):.0f}, '
    f'sd {min(s for m,s in ANCHOR.values()):.0f}-{max(s for m,s in ANCHOR.values()):.0f}; spread {SD_REF:.0f}')
# cls of a wrestler-season (for the scale): the class of his bouts that season
def rating(k, y, c=None):
    v = theta(k, y)
    if v is None: return None
    return norm(v, y, c or key_cls.get((k, y), 'single'))
# per tournament records: own rating, wins (opponent ratings), losses
BAD = 150   # a loss to someone rated 150+ below (about a 30% upset)
recs = {}
for b in bouts:
    if b['result'] in SKIP or b['i'] not in PRE: continue
    y = b['year']; rw, rl = PRE[b['i']]
    for k, nm, sc, ok, won in ((b['wk'], b['winner'], b['winner_school'], b['lk'], 1), (b['lk'], b['loser'], b['loser_school'], b['wk'], 0)):
        r = recs.setdefault((b['bk'], k), {'bk': b['bk'], 'k': k, 'name': nm, 'school': sc, 'year': y, 'c': b['c'], 'lr': b['lr'], 'opp': [], 'enter': (rw if won else rl)})
        r['opp'].append((rating(ok, y, b['c']), ok, won, b['side'], b['round'], b['result'], b['score']))
for r in recs.values():
    y, c = r['year'], r['c']
    r['rating'] = rating(r['k'], y, c)
    wins = [o for o in r['opp'] if o[2] and o[0] is not None]
    r['best'] = max(wins, key=lambda o: o[0]) if wins else None
    r['qow'] = float(np.mean([o[0] for o in wins])) if wins else None
    r['bad'] = sum(1 for o in r['opp'] if not o[2] and o[0] is not None and r['rating'] is not None and o[0] <= r['rating'] - BAD)
# season level: best win and bad losses across every tournament of the season
season_best = {}; season_bad = Counter(); season_qow = defaultdict(list)
for r in recs.values():
    key = (r['k'], r['year'])
    if r['best'] and (key not in season_best or r['best'][0] > season_best[key][0]): season_best[key] = r['best']
    season_bad[key] += r['bad']; season_qow[key] += [o[0] for o in r['opp'] if o[2] and o[0] is not None]
brackets = {}
rec_keys = defaultdict(list)
for (b2, k) in recs: rec_keys[b2].append(k)
for bk, (y, c, unit, lr) in bracket_meta.items():
    keys = list(dict.fromkeys([e[0] for e in entrants.get(bk, [])] + rec_keys.get(bk, [])))
    vals = [norm(theta(k, y), y, c) for k in keys if theta(k, y) is not None]
    top = sorted(vals, reverse=True)[:8]
    brackets[bk] = {'year': y, 'c': c, 'unit': unit, 'lr': lr, 'n': len(keys), 'rated': len(vals), 'field': float(np.mean(top)) if top else None, 'bouts': bouts_in.get(bk, 0)}
for lvl in ('district', 'regional', 'state'):
    fs = [B['field'] for bk, B in brackets.items() if bk[0] == lvl and B['year'] >= 1980 and B['field'] is not None]
    say(f'  {lvl:8s} field strength 1980+: median {np.median(fs):.0f} (p10 {np.percentile(fs,10):.0f}, p90 {np.percentile(fs,90):.0f})')

# ============================================================ evaluation v2
# 1) consistency inside state brackets
med_k = defaultdict(dict)
for (lvl, t, w), es in entrants.items():
    if lvl != 'state': continue
    y = bracket_meta[(lvl, t, w)][0]
    for k, nm, sc, pl, sd in es: med_k[(t, w)][k] = (pl or 9, y)
nb = ch1 = top2 = 0; rh = []
for (t, w), es in med_k.items():
    vals = [(rating(k, y), pl) for k, (pl, y) in es.items() if rating(k, y) is not None]
    if len(vals) < 6 or not any(p == 1 for _, p in vals): continue
    nb += 1; vals.sort(key=lambda x: -x[0]); ranks = [p for _, p in vals]
    ch1 += ranks[0] == 1; top2 += 1 in ranks[:2]
    x = spearmanr([-v for v, _ in vals], [p for _, p in vals]).correlation
    if not np.isnan(x): rh.append(x)
say(f'\nstate brackets (6+ rated, champion known, n={nb}): champion rated #1 {ch1/nb:.1%}, top 2 {top2/nb:.1%}; mean Spearman(rating, place) {np.mean(rh):.3f}')
inv = n_ = 0
for b in bouts:
    if b['result'] in SKIP: continue
    a, c2 = theta(b['wk'], b['year']), theta(b['lk'], b['year'])
    if a is None or c2 is None: continue
    n_ += 1; inv += a < c2
say(f'same-season bouts where the winner is rated below the loser: {inv/n_:.1%} of {n_}')
# 2) does quality of wins add to placement, beyond the wrestler's own rating? (state entrants 1980+)
career_pts = {}
for (t, w), es in med_k.items():
    for k, (pl, y) in es.items(): career_pts[(k, y)] = PTS[pl - 1] if pl <= 8 else 0
Q_rows = []
for r in recs.values():
    if r['bk'][0] != 'state' or r['year'] < 1980 or r['rating'] is None: continue
    sb = season_best.get((r['k'], r['year'])); sq = season_qow.get((r['k'], r['year']))
    nx = career_pts.get((r['k'], r['year'] + 1)); cur = career_pts.get((r['k'], r['year']), 0)
    Q_rows.append((r['rating'], sb[0] if sb else r['rating'] - 200, float(np.mean(sq)) if sq else r['rating'] - 200, season_bad[(r['k'], r['year'])], cur, nx,
                   brackets[r['bk']]['field'] or 1500))
def r2(X, y):
    X = np.column_stack([np.ones(len(y))] + [np.asarray(c, float) for c in X]); y = np.asarray(y, float)
    beta, *_ = np.linalg.lstsq(X, y, rcond=None); p = X @ beta
    return 1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum(), beta
rt, bw, mq, bl, cur, nx, fl = map(np.array, zip(*Q_rows))
r0, _ = r2([rt], cur); say(f'\nstate placement points 1980+ (n={len(Q_rows)}): own season rating R2 {r0:.4f}')
for nm, v in (('best win', bw), ('mean of opponents beaten', mq), ('bad losses', bl), ('field strength', fl)):
    rr, beta = r2([rt, v], cur); say(f'  + {nm}: R2 {rr:.4f} (gain {rr - r0:+.4f}), coefficient {beta[2]:+.4f}')
m = np.array([x is not None for x in nx]); nx2 = np.array([x for x in nx if x is not None], float)
r0, _ = r2([rt[m], cur[m]], nx2); say(f'next-season state points of returners (n={m.sum()}): rating + this season placement R2 {r0:.4f}')
for nm, v in (('best win', bw), ('mean of opponents beaten', mq), ('bad losses', bl), ('field strength', fl)):
    rr, beta = r2([rt[m], cur[m], v[m]], nx2); say(f'  + {nm}: R2 {rr:.4f} (gain {rr - r0:+.4f}), coefficient {beta[3]:+.5f}')

# ============================================================ outputs
os.makedirs('data/difficulty', exist_ok=True)
with open(os.environ.get('RATINGS_OUT', 'data/difficulty') + '/brackets.csv', 'w', newline='') as f:
    c = csv.writer(f, lineterminator='\n'); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'unit', 'entrants', 'rated', 'bouts', 'field', 'fallback'])
    for bk, B in sorted(brackets.items(), key=lambda kv: (kv[1]['year'], kv[0])):
        c.writerow([bk[0], bk[1], bk[2], B['year'], B['c'], B['unit'], B['n'], B['rated'], B['bouts'], f"{B['field']:.0f}" if B['field'] is not None else '', 1 if B['bouts'] == 0 else 0])
names_of = {}
for r in recs.values(): names_of.setdefault((r['k'], r['year']), r['name'])
# RTG as of each round, for the bracket view. The same season fit as the season rating (same priors, same bouts), run
# again after every round with only the bouts up to that round; placement-implied pairs count once their level is over.
# A wrestler's number going into a bout is the fit before that round, coming out is the fit after it, and after his last
# bout of the season it equals his season rating.
STAGE = {'section': 0, 'district': 1, 'regional': 2, 'state': 3}
def _stage(b): return 1.5 if b['level'] == 'regional' and b['unit'].endswith('_Sub') else STAGE[b['level']]
BI = {b['i']: b for b in bouts}
# bout order inside a bracket: a wrestler's championship bouts come before his consolation bouts, each from the earliest
# round (highest number) down; a bout's wave is one past the later of the two wrestlers' previous bouts. Waves line up
# with the session order of a real tournament (pigtails, first round, first consolations, quarters, ...).
WAVE = {}
_byb = defaultdict(list)
for b in bouts: _byb[b['bk']].append(b)
for bl in _byb.values():
    last = {}
    for b in sorted(bl, key=lambda b: (b['side'] != 'champ', b['side'], -b['round'])):
        w = 1 + max(last.get(b['wi'], 0), last.get(b['li'], 0)); WAVE[b['i']] = w; last[b['wi']] = last[b['li']] = w
def fit_one(mu_i, sd_i, obs, t0):
    """one wrestler's MAP strength with opponents fixed: obs = [(opponent strength, +1 won / -1 lost, weight)]"""
    t = t0; iv = 1 / sd_i ** 2
    for _ in range(30):
        g = iv * (t - mu_i); h = iv
        for o, sg, m in obs:
            z = C_ * sg * (t - o); p = 1 / (1 + np.exp(z)); g -= m * C_ * sg * p; h += m * C_ * C_ * p * (1 - p)
        st = g / h; t -= st
        if abs(st) < 1e-4: break
    return t
LV = {'section': 0, 'district': 1, 'regional': 2, 'state': 3}
with open(os.environ.get('RATINGS_OUT', 'data/difficulty') + '/bout_rtg.csv', 'w', newline='') as f:
    c_ = csv.writer(f, lineterminator='\n'); c_.writerow(['level', 'tournament', 'weight', 'side', 'round', 'winner', 'loser', 'pre_w', 'pre_l', 'post_w', 'post_l', 'adv_w', 'adv_l'])
    nfit = 0; maxgap = 0.0
    for y in YEARS:
        if y not in PRIORS: continue
        ids, mu, sd = PRIORS[y]; Ty = T[y]; P0 = {i: (m, s_) for i, m, s_ in zip(ids, mu, sd)}
        mine = defaultdict(list)          # wrestler -> [(time key, opponent final strength, sign, weight, bout index)]
        for r in season_b[y]:
            if isinstance(r[3], int):
                b = BI[r[3]]; k = (_stage(b), WAVE[r[3]])
            else:
                k = (LV[r[3][1]] + 0.9, 10 ** 6)   # placement-implied pairs count once that level is over
            mine[r[0]].append((k, Ty[r[1]], 1, r[2], r[3])); mine[r[1]].append((k, Ty[r[0]], -1, r[2], r[3]))
        AS = {}                           # (wrestler, bout index) -> (before, after)
        for i, ev in mine.items():
            ev.sort(key=lambda e: e[0]); m_i, s_i = P0[i]; t = m_i; done = []
            for n_, e in enumerate(ev):
                if not isinstance(e[4], int): done.append(e[1:4]); continue
                pre = fit_one(m_i, s_i, done, t) if done else m_i
                post = fit_one(m_i, s_i, done + [x[1:4] for x in ev[n_:] if x[0] == e[0]], pre); nfit += 1
                AS[(i, e[4])] = (pre, post)
                if all(x[0] <= e[0] for x in ev): maxgap = max(maxgap, abs(post - Ty[i]))
                done.append(e[1:4]); t = pre
        for r in season_b[y]:
            if not isinstance(r[3], int): continue
            b = BI[r[3]]; (pw_, qw_), (pl_, ql_) = AS[(b['wi'], r[3])], AS[(b['li'], r[3])]; c = b['c']
            c_.writerow([b['level'], b['tournament'], b['weight'], b['side'], b['round'], b['winner'], b['loser']] + [round(norm(x, y, c)) for x in (pw_, pl_, qw_, ql_)] + [int((b['wi'], y) in ADV), int((b['li'], y) in ADV)])
say(f'RTG as of each round: {nfit} bout checkpoints, last checkpoint vs season RTG max gap {maxgap:.2f} (should be ~0)')
with open(os.environ.get('RATINGS_OUT', 'data/difficulty') + '/wrestler_seasons.csv', 'w', newline='') as f:
    c = csv.writer(f, lineterminator='\n'); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'name', 'school', 'key', 'enter', 'season', 'best', 'best_name', 'best_side', 'best_round', 'best_result',
                                   'qow', 'bad', 'season_best', 'season_best_name', 'season_bad', 'bouts', 'wins', 'results', 'adv'])
    res_by = defaultdict(list)
    for b in bouts:
        if b['i'] not in PRE: continue
        res_by[(b['bk'], b['wk'])].append('W ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
        res_by[(b['bk'], b['lk'])].append('L ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
    f0 = lambda v: f'{v:.0f}' if v is not None else ''
    WK2WI = {}
    for b in bouts: WK2WI[(b['wk'], b['year'])] = b['wi']; WK2WI[(b['lk'], b['year'])] = b['li']
    for (bk, k), r in recs.items():
        bst = r['best']; sb = season_best.get((k, r['year']))
        c.writerow([bk[0], bk[1], bk[2], r['year'], r['c'], r['name'], r['school'], k, f0(r['enter']), f0(r['rating']),
                    f0(bst[0]) if bst else '', names_of.get((bst[1], r['year']), '') if bst else '', bst[3] if bst else '', bst[4] if bst else '', bst[5] if bst else '',
                    f0(r['qow']), r['bad'], f0(sb[0]) if sb else '', names_of.get((sb[1], r['year']), '') if sb else '', season_bad[(k, r['year'])],
                    len(r['opp']), sum(o[2] for o in r['opp']), ' · '.join(x.strip() for x in res_by[(bk, k)]), int((WK2WI.get((k, r['year']), ID(k, r['year'])), r['year']) in ADV)])
open(os.environ.get('RATINGS_OUT', 'data/difficulty') + '/eval.txt', 'w').write('\n'.join(out) + '\n')
json.dump({'sd_ref': SD_REF, 'bad_loss_gap': BAD, 'weights': 'per neighbour-availability pattern, see eval.txt', 'prior_sd': RES_SD, 'params': params},
          open(os.environ.get('RATINGS_OUT', 'data/difficulty') + '/scale.json', 'w'), indent=1, default=float)
print('wrote', len(brackets), 'brackets', len(recs), 'wrestler-tournaments')
