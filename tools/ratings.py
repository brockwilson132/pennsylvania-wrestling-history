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
    return {'district': 0, 'regional': 2, 'state': 3}[level]
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
for b in csv.DictReader(open('data/brackets/bouts.csv')):
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
    def __init__(s, K=40, rho=0.75, grow=(60, 40, 25), init=(1500, 1500, 1540, 1580), marg=(1.5, 1.35, 1.2, 1.0), prov=2.0, S=400):
        s.K, s.rho, s.grow, s.init, s.marg, s.S, s.prov = K, rho, grow, init, dict(zip(MARGIN_TYPES, marg)), S, prov
        s.R, s.last, s.n = {}, {}, Counter()
    def kf(s, key): return s.K * (1 + s.prov / (s.n[key] + 1))
    def get(s, k, year, lr):
        if k in s.last and year - s.last[k] > 5: s.R.pop(k, None); s.n[k] = 0      # new identity after a long gap
        if k not in s.R: s.R[k] = s.init[lr]; s.last[k] = year
        elif s.last[k] < year:
            gap = year - s.last[k]; g = grade.get((k, year))
            step = s.grow[g - 1] if g is not None and g >= 1 else sum(s.grow) / len(s.grow)
            s.R[k] = 1500 + (s.rho ** gap) * (s.R[k] - 1500) + step; s.last[k] = year
        return s.R[k]
    def p(s, ra, rb): return 1 / (1 + 10 ** ((rb - ra) / s.S))

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
            pre[b['i']] = (rw, rl); end[(b['wk'], b['year'])] = E.R[b['wk']]; end[(b['lk'], b['year'])] = E.R[b['lk']]
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
    if len(pl) < 2 or bouts_in.get(bk, 0) >= len(pl): continue
    for i in range(len(pl)):
        for j in range(i + 1, len(pl)):
            season_b[y].append((pl[i][1], pl[j][1], PLACE_W / (len(pl) - 1), -1)); npseudo += 1
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
        if r[3] >= 0: nb_of[(r[0], y)] += 1; nb_of[(r[1], y)] += 1
gr = lambda i, y: grade.get((i.split('#')[0], y))
def smoother(mask=None, iters=5, report=False, sd_scale=1.0):
    # 0) season-only estimates (weak prior), the regression target and regressors
    T0 = {}
    for y in YEARS:
        ids = ids_of[y]; T0[y] = fit_season(season_b[y], ids, [1500] * len(ids), [250] * len(ids), mask)
    # 1) proximity weights: season-only t ~ season-only t-2, t-1, t+1, t+2 (+ grade), non-negative slopes
    rows = []
    for y in YEARS:
        for i, v in T0[y].items():
            if nb_of[(i, y)] < 4: continue
            A = [T0.get(y + d, {}).get(i) for d in (-2, -1, 1, 2)]
            if all(x is None for x in A): continue
            rows.append((v, A, gr(i, y)))
    def design(A, g): return [(v - 1500) if v is not None else 0.0 for v in A] + [1.0 if v is None else 0.0 for v in A] + [1.0 if g == j else 0.0 for j in range(4)] + [1.0]
    X = np.array([design(A, g) for _, A, g in rows]); yv = np.array([v - 1500 for v, *_ in rows])
    fit = lsq_linear(X, yv, bounds=([0] * 4 + [-np.inf] * 9, [np.inf] * 13)); Wt = fit.x
    res_sd = float((yv - X @ Wt).std()) * sd_scale
    pop_sd = float(np.std([v for y in YEARS for v in T0[y].values()]))
    # 2) prior mean for season t from the neighbours' SEASON-ONLY estimates, exactly the quantities the weights were
    #    fit on. (Feeding the neighbours' smoothed estimates back in and iterating double-counts: the fitted weights
    #    sum to ~1.2 because season-only regressors are noisy, so the loop amplified instead of settling; tried and
    #    rejected, see docs/DIFFICULTY.md.) With the prior built this way one pass is the fixed point.
    T = {y: dict(T0[y]) for y in YEARS}
    for it in range(1):
        delta = 0.0
        for y in YEARS:
            ids = ids_of[y]; mu, sd = [], []
            for i in ids:
                A = [T0.get(y + d, {}).get(i) for d in (-2, -1, 1, 2)]
                if any(x is not None for x in A): mu.append(1500 + float(np.dot(design(A, gr(i, y)), Wt))); sd.append(res_sd)
                else: mu.append(1500 + float(np.dot(design([None] * 4, gr(i, y)), Wt))); sd.append(pop_sd)
            new = fit_season(season_b[y], ids, mu, sd, mask)
            delta = max(delta, max(abs(new[i] - T[y][i]) for i in ids)); T[y] = new
        if report: say(f'  prior pass: largest change from season-only estimates {delta:.0f}')
    return T, T0, Wt, res_sd
# prior strength: the regression residual overstates the prior sd (its target is itself noisy), so scale it,
# tuned on hidden 1990-2017 bouts
random.seed(5)
tune_held = {b['i'] for b in bouts if 1990 <= b['year'] <= 2017 and b['result'] not in SKIP and random.random() < 0.05}
tb = [b for b in bouts if b['i'] in tune_held]
scores = {}
for sc in (0.7, 1.0, 1.5, 2.0, 3.0, 4.5):
    Tt, *_ = smoother(mask=tune_held, sd_scale=sc)
    scores[sc] = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Tt[b['year']][b['li']] - Tt[b['year']][b['wi']]) / 400)))) for b in tb])
SDS = min(scores, key=scores.get)
say('prior sd scale (hidden 5% of 1990-2017 bouts): ' + ', '.join(f'{k}: {v:.4f}' for k, v in scores.items()) + f' -> {SDS}')
# leak-free test of the batch rating: hide 10% of 2018-2026 bouts, fit without them, predict them
random.seed(3)
held = {b['i'] for b in bouts if b['year'] >= 2018 and b['result'] not in SKIP and random.random() < 0.10}
Th, *_ = smoother(mask=held, sd_scale=SDS)
hb = [b for b in bouts if b['i'] in held]
ll_batch = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((Th[b['year']][b['li']] - Th[b['year']][b['wi']]) / 400)))) for b in hb])
ll_fwd = np.mean([-math.log(max(1e-9, 1 / (1 + 10 ** ((PRE[b['i']][1] - PRE[b['i']][0]) / 400)))) for b in hb])
acc_b = np.mean([Th[b['year']][b['wi']] > Th[b['year']][b['li']] for b in hb])
say(f'held-out 10% of 2018-2026 bouts (n={len(hb)}), fit without them: season-batch strength log loss {ll_batch:.4f} accuracy {acc_b:.3f}; forward rating {ll_fwd:.4f}')
say('  (the batch number uses the rest of that season, before and after the bout; the forward number uses only the past. Both are leak-free for the hidden bout.)')
T, T0, Wt, RES_SD = smoother(report=True, sd_scale=SDS)
say(f'proximity weights (season-only strength at t regressed on t-2, t-1, t+1, t+2 with grade, non-negative): t-2 {Wt[0]:.3f}  t-1 {Wt[1]:.3f}  t+1 {Wt[2]:.3f}  t+2 {Wt[3]:.3f}; grade FR..SR {Wt[8]:+.0f} {Wt[9]:+.0f} {Wt[10]:+.0f} {Wt[11]:+.0f}; prior sd {RES_SD:.0f}')
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
with open('data/difficulty/brackets.csv', 'w', newline='') as f:
    c = csv.writer(f); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'unit', 'entrants', 'rated', 'bouts', 'field', 'fallback'])
    for bk, B in sorted(brackets.items(), key=lambda kv: (kv[1]['year'], kv[0])):
        c.writerow([bk[0], bk[1], bk[2], B['year'], B['c'], B['unit'], B['n'], B['rated'], B['bouts'], f"{B['field']:.0f}" if B['field'] is not None else '', 1 if B['bouts'] == 0 else 0])
names_of = {}
for r in recs.values(): names_of.setdefault((r['k'], r['year']), r['name'])
with open('data/difficulty/wrestler_seasons.csv', 'w', newline='') as f:
    c = csv.writer(f); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'name', 'school', 'key', 'enter', 'season', 'best', 'best_name', 'best_side', 'best_round', 'best_result',
                                   'qow', 'bad', 'season_best', 'season_best_name', 'season_bad', 'bouts', 'wins', 'results'])
    res_by = defaultdict(list)
    for b in bouts:
        if b['i'] not in PRE: continue
        res_by[(b['bk'], b['wk'])].append('W ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
        res_by[(b['bk'], b['lk'])].append('L ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
    f0 = lambda v: f'{v:.0f}' if v is not None else ''
    for (bk, k), r in recs.items():
        bst = r['best']; sb = season_best.get((k, r['year']))
        c.writerow([bk[0], bk[1], bk[2], r['year'], r['c'], r['name'], r['school'], k, f0(r['enter']), f0(r['rating']),
                    f0(bst[0]) if bst else '', names_of.get((bst[1], r['year']), '') if bst else '', bst[3] if bst else '', bst[4] if bst else '', bst[5] if bst else '',
                    f0(r['qow']), r['bad'], f0(sb[0]) if sb else '', names_of.get((sb[1], r['year']), '') if sb else '', season_bad[(k, r['year'])],
                    len(r['opp']), sum(o[2] for o in r['opp']), ' · '.join(x.strip() for x in res_by[(bk, k)])])
open('data/difficulty/eval.txt', 'w').write('\n'.join(out) + '\n')
json.dump({'sd_ref': SD_REF, 'bad_loss_gap': BAD, 'weights': {'t-2': Wt[0], 't-1': Wt[1], 't+1': Wt[2], 't+2': Wt[3]}, 'prior_sd': RES_SD, 'params': params},
          open('data/difficulty/scale.json', 'w'), indent=1, default=float)
print('wrote', len(brackets), 'brackets', len(recs), 'wrestler-tournaments')
