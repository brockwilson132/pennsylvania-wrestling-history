"""Wrestling style: how a wrestler wins and how he loses, and what that does to how a bout ends.

Rating decides who is likely to win. Given a win, the split between decision, major, tech fall and fall depends on the
rating gap AND on the two wrestlers: a pinner pins more than his rating says, and a wrestler who gets pinned a lot is
pinned more. Each wrestler-season gets his record by type over his career so far (this season and up to three before,
same name and school): wins by dec / major / tech fall / fall and losses by the same. A multinomial logit then gives
P(type | win) from the gap plus the winner's shrunk share of each bonus type among his wins and the loser's among his
losses (shrunk toward the overall share with A_SHRINK bouts of prior, so a 2-bout record says little).

Tested on hidden 10% of 2018-26 regional + state bouts (style counts and the fit never see them): log loss of the
win type, gap only vs gap + style, printed below and in data/difficulty/style_eval.txt.

Outputs
  data/difficulty/style.csv.gz   year, weight, name, school key, 8 counts (W dec md tf fall, L dec md tf fall)
  data/difficulty/style_model.json  share p0, shrink A, gap clip, coefficients (rows: features, cols: dec md tf fall)
Margins: a decision by 8+ is a major in every era (majors were not labelled before the 1970s), tech falls as labelled.
"""
import csv, gzip, json, math, re, zlib
from collections import defaultdict
import numpy as np
from scipy.optimize import minimize

def nk(s): return re.sub(r'[^a-z]', '', re.sub(r'\([^)]*\)', '', (s or '').lower()))
def wn(w): return re.sub(r'[^0-9A-Za-z]', '', w or '')
TYPES = {'dec': 0, 'md': 1, 'tf': 2, 'fall': 3}
A_SHRINK, WINDOW, GCLIP = 8.0, 4, (-400.0, 1000.0)

def rtype(r):
    res = r['result']
    if res not in TYPES: return None
    if res in ('dec', 'md'):
        m = re.match(r'\s*(\d+)-(\d+)', r['score'] or '')
        if m: return 1 if int(m[1]) - int(m[2]) >= 8 else 0
    return TYPES[res]

# season ratings (the ones duals and Compare use)
SR = {}
for r in csv.DictReader(gzip.open('data/difficulty/wrestler_seasons.csv.gz', 'rt')):
    if r['season']: SR[(r['key'], int(r['year']))] = float(r['season'])

B = []
for r in csv.DictReader(open('data/brackets/bouts.csv')):
    t = rtype(r)
    if t is None: continue
    y = int(r['year'])
    hid = r['level'] in ('regional', 'state') and y >= 2018 and zlib.crc32('|'.join((r['tournament'], r['weight'], r['side'], r['round'], r['winner'], r['loser'])).encode()) % 10 == 0
    B.append((y, nk(r['winner']) + '|' + nk(r['winner_school']), nk(r['loser']) + '|' + nk(r['loser_school']), t, hid, r['weight'], r['winner'], r['loser']))

def counts(use):
    W = defaultdict(lambda: np.zeros(4)); L = defaultdict(lambda: np.zeros(4))
    for y, w, l, t, hid, *_ in B:
        if use(hid): W[(w, y)][t] += 1; L[(l, y)][t] += 1
    return W, L
def career(D, k, y):
    v = np.zeros(4)
    for d in range(WINDOW): v = v + D.get((k, y - d), 0)
    return v

def feats(hw, hl, g, p0):
    fw = np.log((hw[1:] + A_SHRINK * p0[1:]) / (hw.sum() + A_SHRINK)) - np.log(p0[1:])
    fl = np.log((hl[1:] + A_SHRINK * p0[1:]) / (hl.sum() + A_SHRINK)) - np.log(p0[1:])
    x = max(GCLIP[0], min(GCLIP[1], g)) / 400
    return np.concatenate([[1, x, x * x, x ** 3], fw, fl])

def fit(X, y):
    n, d = X.shape
    def f(wf):
        Wm = np.concatenate([np.zeros((d, 1)), wf.reshape(d, 3)], 1); Z = X @ Wm; Z -= Z.max(1, keepdims=True)
        lse = np.log(np.exp(Z).sum(1)); P = np.exp(Z - lse[:, None]); Y = np.zeros_like(P); Y[np.arange(n), y] = 1
        return -(Z[np.arange(n), y] - lse).sum() + 5e-3 * (wf ** 2).sum(), (X.T @ (P - Y))[:, 1:].ravel() + 1e-2 * wf
    r = minimize(f, np.zeros(d * 3), jac=True, method='L-BFGS-B', options={'maxiter': 3000})
    return np.concatenate([np.zeros((d, 1)), r.x.reshape(d, 3)], 1)
def ll(X, y, Wm):
    Z = X @ Wm; Z -= Z.max(1, keepdims=True); lse = np.log(np.exp(Z).sum(1)); return float(-(Z[np.arange(len(y)), y] - lse).mean())
def probs(X, Wm):
    Z = X @ Wm; Z -= Z.max(1, keepdims=True); P = np.exp(Z); return P / P.sum(1, keepdims=True)

def rows(W, L, p0, sel, loo):
    X, Y = [], []
    for y, w, l, t, hid, *_ in B:
        if y < 2010 or not sel(hid): continue
        gw, gl = SR.get((w, y)), SR.get((l, y))
        if gw is None or gl is None: continue
        hw, hl = career(W, w, y), career(L, l, y)
        if loo: hw = hw.copy(); hl = hl.copy(); hw[t] -= 1; hl[t] -= 1
        X.append(feats(hw, hl, gw - gl, p0)); Y.append(t)
    return np.array(X), np.array(Y)

out = []
def say(s): print(s); out.append(s)
# 1) the test: counts and fit without the hidden bouts
W, L = counts(lambda h: not h)
base = np.zeros(4)
for y, w, l, t, hid, *_ in B:
    if y >= 2010 and not hid: base[t] += 1
p0 = base / base.sum()
Xtr, ytr = rows(W, L, p0, lambda h: not h, True); Xte, yte = rows(W, L, p0, lambda h: h, False)
W0, W1 = fit(Xtr[:, :4], ytr), fit(Xtr, ytr)
say(f'win type (dec/major/tech/fall) on hidden 10% of 2018-26 regional + state bouts, n={len(yte)}: log loss base shares {float(-np.log(p0[yte]).mean()):.4f}, '
    f'rating gap only {ll(Xte[:, :4], yte, W0):.4f}, gap + style {ll(Xte, yte, W1):.4f}')
P0, P1 = probs(Xte[:, :4], W0), probs(Xte, W1)
for k, nm in ((3, 'fall'), (2, 'tech fall'), (1, 'major')):
    yb = yte == k; say(f'  {nm}: Brier gap only {np.mean((P0[:, k] - yb) ** 2):.4f}, gap + style {np.mean((P1[:, k] - yb) ** 2):.4f} (actual share {yb.mean():.3f})')
# calibration of the fall chance by style decile (gap + style)
o = np.argsort(P1[:, 3]); q = np.array_split(o, 5)
say('  fall chance by fifth of predicted chance (predicted / actual): ' + ', '.join(f'{P1[i, 3].mean():.2f}/{(yte[i] == 3).mean():.2f}' for i in q))

# 2) production: every bout
W, L = counts(lambda h: True)
base = np.zeros(4)
for y, w, l, t, hid, *_ in B:
    if y >= 2010: base[t] += 1
p0 = base / base.sum()
Xa, ya = rows(W, L, p0, lambda h: True, True)
WM = fit(Xa, ya)
say('coefficients (rows: 1, gap, gap^2, gap^3, winner major/tech/fall share, loser major/tech/fall share; cols dec/major/tech/fall):')
for r_ in WM: say('  ' + ' '.join(f'{v:+.3f}' for v in r_))
json.dump({'p0': [round(float(v), 4) for v in p0], 'A': A_SHRINK, 'clip': GCLIP, 'W': [[round(float(v), 4) for v in r_] for r_ in WM],
           'note': 'P(type | win) = softmax(W^T x), x = [1, g, g^2, g^3, fw(md,tf,fall), fl(md,tf,fall)], g = clip(gap)/400, '
                   'f = log((n_k + A p0_k) / (n + A)) - log p0_k over the winner\'s wins (fw) or the loser\'s losses (fl)'},
          open('data/difficulty/style_model.json', 'w'), indent=1)
# per wrestler-season career counts, keyed the way tools/build_units.js keys season ratings (year | weight | name)
seen = {}
for y, w, l, t, hid, wt, wname, lname in B:
    for k, nm in ((w, wname), (l, lname)): seen[(y, wn(wt), nm, k)] = 1
with gzip.open('data/difficulty/style.csv.gz', 'wt', newline='') as f:
    c = csv.writer(f); c.writerow(['year', 'weight', 'name', 'key', 'wd', 'wm', 'wt', 'wf', 'ld', 'lm', 'lt', 'lf'])
    for (y, wt, nm, k) in sorted(seen):
        c.writerow([y, wt, nm, k] + [int(v) for v in career(W, k, y)] + [int(v) for v in career(L, k, y)])
open('overtime/style.js', 'w').write('window.WR_STYLE=' + json.dumps({'p0': [round(float(v), 4) for v in p0], 'A': A_SHRINK, 'clip': GCLIP, 'W': [[round(float(v), 4) for v in r_] for r_ in WM]}, separators=(',', ':')) + ';\n')
open('data/difficulty/style_eval.txt', 'w').write('\n'.join(out) + '\n')
