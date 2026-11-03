#!/usr/bin/env python3
"""Ratings and difficulty (strength of schedule) for every wrestler in the PA bracket archive, with the
evaluation that chose the method. Method and evidence: docs/DIFFICULTY.md.

Inputs (repo root): data/brackets/bouts.csv, data/brackets/lower_entrants.csv, data/brackets/state_entrants.csv,
                    overtime/medals.js
Outputs:            data/difficulty/brackets.csv          per bracket: field strength
                    data/difficulty/wrestler_seasons.csv  per wrestler per tournament: path SOS, ratings
                    data/difficulty/eval.txt              every number quoted in the doc
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
# identities: a name+school pair unseen for more than five seasons starts a new identity
years_of = defaultdict(set)
for b in bouts: years_of[b['wk']].add(b['year']); years_of[b['lk']].add(b['year'])
for (lvl, t, w), es in entrants.items():
    for e in es: years_of[e[0]].add(int(t[:4]))
IDN = {}
for k, ys in years_of.items():
    n, prev = 0, None
    for y in sorted(ys):
        if prev is not None and y - prev > 5: n += 1
        IDN[(k, y)] = k if n == 0 else f'{k}#{n}'; prev = y
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
for sc in (0.35, 0.5, 0.7, 1.0):
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

# ============================================================ per tournament records, era anchor, SOS
WIN_W = 2.0
recs = {}
for b in bouts:
    if b['result'] in SKIP or b['i'] not in PRE: continue
    y = b['year']; rw, rl = PRE[b['i']]
    for k, nm, sc, ok, fwd_o, won in ((b['wk'], b['winner'], b['winner_school'], b['lk'], rl, 1), (b['lk'], b['loser'], b['loser_school'], b['wk'], rw, 0)):
        r = recs.setdefault((b['bk'], k), {'bk': b['bk'], 'k': k, 'name': nm, 'school': sc, 'year': y, 'c': b['c'], 'lr': b['lr'], 'opp': [], 'enter': (rw if won else rl)})
        r['opp'].append((theta(ok, y), fwd_o, ok, won, T0.get(y, {}).get(ID(ok, y))))
anchor_vals = defaultdict(list)
for (bk, k), r in recs.items():
    if bk[0] == 'district' and theta(k, r['year']) is not None: anchor_vals[(r['year'], r['c'])].append(theta(k, r['year']))
ANCHOR = {g: (float(np.mean(v)), float(np.std(v))) for g, v in anchor_vals.items() if len(v) >= 50}
SD_REF = float(np.median([sd for (y, c), (m, sd) in ANCHOR.items() if y >= 1980]))
def anc(y, c):
    if (y, c) in ANCHOR: return ANCHOR[(y, c)]
    near = [ANCHOR[g] for g in ANCHOR if g[1] == c and abs(g[0] - y) <= 3] or list(ANCHOR.values())
    return float(np.mean([m for m, s in near])), float(np.mean([s for m, s in near]))
def norm(v, y, c):
    if v is None: return None
    m, sd = anc(y, c); return 1500 + (v - m) / sd * SD_REF
say(f'\nera normalization: z-score against that year+class district wrestlers (mean {min(m for m,s in ANCHOR.values()):.0f}-{max(m for m,s in ANCHOR.values()):.0f}, sd {min(s for m,s in ANCHOR.values()):.0f}-{max(s for m,s in ANCHOR.values()):.0f}), rescaled to sd {SD_REF:.0f}')
def wavg(vals):
    vals = [(v, w) for v, w in vals if v is not None]
    return sum(v * (WIN_W if won else 1) for v, won in vals) / sum(WIN_W if won else 1 for v, won in vals) if vals else None
def sym(k, y, c):
    vals = [norm(T0.get(yy, {}).get(ID(k, yy)), yy, c) for yy in (y - 1, y, y + 1)]
    vals = [v for v in vals if v is not None]; return float(np.mean(vals)) if vals else None
for r in recs.values():
    y, c = r['year'], r['c']
    r['path'] = wavg([(norm(o[0], y, c), o[3]) for o in r['opp']])                    # season strength (batch, smoothed)
    r['path_t'] = wavg([(norm(o[1], y, c), o[3]) for o in r['opp']])                  # forward rating at the bout
    r['path_only'] = wavg([(norm(o[4], y, c), o[3]) for o in r['opp']])               # season-only, no neighbours
    r['path_sym'] = wavg([(sym(o[2], y, c), o[3]) for o in r['opp']])                 # naive symmetric window
    r['season'] = norm(theta(r['k'], y), y, c)
brackets = {}
rec_keys = defaultdict(list)
for (b2, k) in recs: rec_keys[b2].append(k)
for bk, (y, c, unit, lr) in bracket_meta.items():
    keys = list(dict.fromkeys([e[0] for e in entrants.get(bk, [])] + rec_keys.get(bk, [])))
    vals = [norm(theta(k, y), y, c) for k in keys if theta(k, y) is not None]
    top = sorted(vals, reverse=True)[:8]
    brackets[bk] = {'year': y, 'c': c, 'unit': unit, 'lr': lr, 'n': len(keys), 'rated': len(vals), 'field': float(np.mean(top)) if top else None, 'bouts': bouts_in.get(bk, 0)}

# ============================================================ scale 0-99 (fixed, one scale for every level and era)
# one fixed scale per level (district / regional / state), pooled over every season 1980-2026: a deep year can
# have many hard brackets; a district 80 means hard for a district, a state 80 hard for states.
# The one-class era (1938-1973: few bouts per season, 2-4 placers, no regionals before 1951) gets its own scale per level.
SCALE = {}
era = lambda y: 'single' if y <= 1973 else 'modern'
for lvl in ('district', 'regional', 'state'):
    for e, (y0, y1) in (('modern', (1980, 2026)), ('single', (1938, 1973))):
        pv = [r['path'] for r in recs.values() if r['bk'][0] == lvl and r['path'] is not None and y0 <= r['year'] <= y1]
        fv = [B['field'] for bk, B in brackets.items() if bk[0] == lvl and B['field'] is not None and y0 <= B['year'] <= y1]
        if len(pv) < 50 or len(fv) < 20: continue
        SCALE[(lvl, e)] = {'path': (float(np.percentile(pv, 1)), float(np.percentile(pv, 99.5))), 'field': (float(np.percentile(fv, 1)), float(np.percentile(fv, 99.5)))}
def sos(v, lvl='state', kind='path', y=2000):
    if v is None: return None
    lo, hi = SCALE.get((lvl, era(y)), SCALE[(lvl, 'modern')])[kind]; return int(max(0, min(99, round((v - lo) / (hi - lo) * 99))))
say('0-99 scales (1st -> 0, 99.5th -> 99; modern = pooled 1980-2026, single = pooled 1938-1973, per level): ' + '; '.join(f"{l}/{e} path {v['path'][0]:.0f}-{v['path'][1]:.0f}, field {v['field'][0]:.0f}-{v['field'][1]:.0f}" for (l, e), v in SCALE.items()))
for lvl in ('district', 'regional', 'state'):
    ps = [sos(r['path'], lvl) for r in recs.values() if r['bk'][0] == lvl and r['year'] >= 1980]
    fs = [sos(B['field'], lvl, 'field') for bk, B in brackets.items() if bk[0] == lvl and B['year'] >= 1980 and B['field'] is not None]
    say(f'  {lvl:8s} path SOS median {int(np.median(ps))} (p10 {int(np.percentile(ps,10))}, p90 {int(np.percentile(ps,90))});  field median {int(np.median(fs))} (p10 {int(np.percentile(fs,10))}, p90 {int(np.percentile(fs,90))})')

# ============================================================ how much the opponent-strength choice moves SOS
st = [r for r in recs.values() if r['bk'][0] == 'state' and r['year'] >= 1980 and r['path'] is not None]
for nm, key in (('forward rating at the bout', 'path_t'), ('season t only (no neighbouring seasons)', 'path_only'), ('naive symmetric window (t-1, t, t+1 equal)', 'path_sym')):
    a_ = np.array([r['path'] for r in st]); b_ = np.array([r[key] for r in st])
    rho_ = spearmanr(a_, b_).correlation
    ra = np.argsort(np.argsort(-a_)) / len(a_); rb = np.argsort(np.argsort(-b_)) / len(b_)
    topa = set(np.argsort(-a_)[:len(a_) // 10]); topb = set(np.argsort(-b_)[:len(b_) // 10])
    say(f'state path SOS, smoothed season strength vs {nm}: Spearman {rho_:.3f}, mean percentile move {100*np.mean(np.abs(ra-rb)):.1f} pts, top-10% overlap {len(topa & topb)/len(topa):.2f}')
# the freshman example: wins over opponents who were freshmen and later won a state title
champs = {(nk(n) + '|' + nk(s)) for (y, c, w, p, n, s, d) in [(m[0], m[1], m[2], m[3], m[4], m[5], m[6]) for m in med] if p == 1}
ex = []
for r in st:
    for o in r['opp']:
        if o[3] and o[2] in champs and grade.get((o[2], r['year'])) == 0 and grade.get((r['k'], r['year'])) == 3:
            ex.append((norm(o[0], r['year'], r['c']), sym(o[2], r['year'], r['c']), norm(theta(o[2], r['year'] + 3), r['year'] + 3, r['c'])))
if ex:
    say(f'senior state wins over freshmen who later won a state title (n={len(ex)}), opponent strength on the state path scale: smoothed season strength {sos(np.mean([e[0] for e in ex]))}, symmetric window {sos(np.mean([e[1] for e in ex]))}; those opponents as seniors {sos(np.mean([e[2] for e in ex if e[2]]))}')

# ============================================================ which difficulty measure? (held-out evaluation)
career_state = defaultdict(lambda: defaultdict(int))
for (lvl, t, w), es in entrants.items():
    if lvl != 'state': continue
    y = bracket_meta[(lvl, t, w)][0]
    for k, nm, sc, pl, sd in es:
        if pl: career_state[k][y] += PTS[pl - 1]
old_raw, old_tier = {}, {}
for bk, B in brackets.items():
    if bk[0] == 'state': old_raw[bk] = sum(sum(p for yy, p in career_state[e[0]].items() if yy != B['year']) for e in entrants.get(bk, []))
byyc = defaultdict(list)
for bk, v in old_raw.items(): byyc[(brackets[bk]['year'], brackets[bk]['c'])].append((v, bk))
for g, lst in byyc.items():
    lst.sort()
    for i, (v, bk) in enumerate(lst): old_tier[bk] = 1 + min(3, int(4 * i / max(1, len(lst))))
def r2(X, y):
    X = np.column_stack([np.ones(len(y))] + [np.asarray(c, float) for c in X]); y = np.asarray(y, float)
    beta, *_ = np.linalg.lstsq(X, y, rcond=None); p = X @ beta
    return 1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum(), beta
nextpts = {}
for (lvl, t, w), es in entrants.items():
    if lvl == 'state':
        y = bracket_meta[(lvl, t, w)][0]
        for k, nm, sc, pl, sd in es: nextpts[(k, y)] = PTS[pl - 1] if pl else 0
E_rows = []
for r in st:
    if r['year'] > 2025: continue
    pl = state_place.get((r['year'], r['c'], wn(r['bk'][2]), r['k'].split('|')[0]))
    nx = nextpts.get((r['k'], r['year'] + 1))
    if nx is None or r['bk'] not in old_tier or brackets[r['bk']]['field'] is None: continue
    E_rows.append((PTS[pl - 1] if pl else 0, nx, r['enter'], old_tier[r['bk']], brackets[r['bk']]['field'], r['path'], r['path_t'], r['year']))
pts_, nx_, en_, ot_, fl_, pa_, pt_, yr_ = map(np.array, zip(*E_rows))
say(f'\nwhich measure makes a state result a better signal of ability? target = next-season state points of returning qualifiers 1980-2025 (n={len(E_rows)}):')
r0, _ = r2([pts_], nx_); r1, _ = r2([pts_, en_], nx_)
say(f'  placement points alone R2 {r0:.4f}; + own entering rating {r1:.4f}')
for nm, v in (('(a) old tier', ot_), ('(b) field strength', fl_), ('(c) path SOS, blended opponents', pa_), ('(c0) path SOS, forward rating only', pt_)):
    rr, beta = r2([pts_, v], nx_); say(f'  + {nm}: R2 {rr:.4f} (gain {rr - r0:+.4f}), coefficient {beta[2]:+.4f}')
rr, _ = r2([pts_, pa_, fl_], nx_); say(f'  + (d) path + field: R2 {rr:.4f} (gain {rr - r0:+.4f})')
rr, beta = r2([pts_, en_, pa_], nx_); say(f'  path SOS beyond placement AND own entering rating: R2 {rr:.4f} (gain {rr - r1:+.4f}), coefficient {beta[3]:+.4f}')
# does the field make placing harder for a wrestler of given rating?
P_rows = []
for r in recs.values():
    if r['bk'][0] != 'state' or r['year'] < 1980 or r['bk'] not in old_tier or brackets[r['bk']]['field'] is None: continue
    pl = state_place.get((r['year'], r['c'], wn(r['bk'][2]), r['k'].split('|')[0]))
    P_rows.append((r['enter'], old_tier[r['bk']], brackets[r['bk']]['field'], 1 if pl else 0))
en2, ot2, fl2, yy2 = map(np.array, zip(*P_rows))
r0, _ = r2([en2], yy2); say(f'\nP(place at states) for state entrants 1980+ (n={len(P_rows)}): own entering rating R2 {r0:.4f}')
for nm, v in (('(a) old tier', ot2), ('(b) field strength', fl2)):
    rr, beta = r2([en2, v], yy2); say(f'  + {nm}: R2 {rr:.4f} (gain {rr - r0:+.4f}), coefficient {beta[2]:+.5f}')
# stability: no forced quarter per tier
CUTS = (25, 50, 75)
by = defaultdict(list)
for bk, B in brackets.items():
    if bk[0] == 'state' and B['year'] >= 1980 and B['field'] is not None: by[(B['year'], B['c'])].append(sos(B['field'], 'state', 'field') >= CUTS[2])
sh = sorted(np.mean(v) for v in by.values())
say(f'\nfixed cutoffs on the 0-99 scale: {CUTS}; share of a year+class state brackets at 75+ ranges {sh[0]:.2f}-{sh[-1]:.2f}, median {np.median(sh):.2f} (the old method forced 0.25)')
dec = defaultdict(list)
for bk, B in brackets.items():
    if bk[0] == 'state' and B['field'] is not None: dec[B['year'] // 10 * 10].append(sos(B['field'], 'state', 'field', B['year']))
say('  state field median by decade: ' + ', '.join(f"{d}s {int(np.median(v))}" for d, v in sorted(dec.items())))

# ============================================================ outputs
os.makedirs('data/difficulty', exist_ok=True)
with open('data/difficulty/brackets.csv', 'w', newline='') as f:
    c = csv.writer(f); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'unit', 'entrants', 'rated', 'bouts', 'field', 'field_sos', 'old_tier', 'fallback'])
    for bk, B in sorted(brackets.items(), key=lambda kv: (kv[1]['year'], kv[0])):
        c.writerow([bk[0], bk[1], bk[2], B['year'], B['c'], B['unit'], B['n'], B['rated'], B['bouts'], f"{B['field']:.1f}" if B['field'] is not None else '',
                    sos(B['field'], bk[0], 'field', B['year']) if B['field'] is not None else '', old_tier.get(bk, ''), 1 if B['bouts'] == 0 else 0])
with open('data/difficulty/wrestler_seasons.csv', 'w', newline='') as f:
    c = csv.writer(f); c.writerow(['level', 'tournament', 'weight', 'year', 'cls', 'name', 'school', 'enter', 'season', 'path', 'path_sos', 'bouts', 'wins', 'results'])
    res_by = defaultdict(list)
    for b in bouts:
        if b['i'] not in PRE: continue
        res_by[(b['bk'], b['wk'])].append('W ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
        res_by[(b['bk'], b['lk'])].append('L ' + b['result'] + ' ' + b['score'] + (' ' + b['flags'] if b['flags'] else ''))
    for (bk, k), r in recs.items():
        c.writerow([bk[0], bk[1], bk[2], r['year'], r['c'], r['name'], r['school'], f"{r['enter']:.0f}", f"{r['season']:.0f}", f"{r['path']:.0f}",
                    sos(r['path'], bk[0], 'path', r['year']), len(r['opp']), sum(o[3] for o in r['opp']), ' · '.join(x.strip() for x in res_by[(bk, k)])])
open('data/difficulty/eval.txt', 'w').write('\n'.join(out) + '\n')
json.dump({'scale': {f'{l}/{e}': v for (l, e), v in SCALE.items()}, 'sd_ref': SD_REF, 'cuts': CUTS, 'weights': {'t-2': Wt[0], 't-1': Wt[1], 't+1': Wt[2], 't+2': Wt[3]}, 'prior_sd': RES_SD, 'win_weight': WIN_W, 'params': params},
          open('data/difficulty/scale.json', 'w'), indent=1, default=float)
print('wrote', len(brackets), 'brackets', len(recs), 'wrestler-tournaments')
