"""Margin model parameters for tools/ratings.py (RATINGS_MARGIN=ordered): data/difficulty/margin_ctx.json.

Per era: slope beta and 10 thresholds of the cumulative logit P(at least category k | won) = sigma(beta*z + o - theta_k),
z = C*(rating gap), and the offset o = reg*[regional] + state*[state] + fw*f(winner) + fl*f(loser), where f is the
wrestler's shrunk log-odds of bonus results (major, tech fall, fall) among his OTHER wins (winner) or losses (loser) in a
+-3 season window, relative to the era share p0. Fitted by maximum likelihood on season ratings from the win-only model
(run ratings.py with RATINGS_MARGIN=weights first), so the margins are not fitted to ratings that already hold them.
usage: python3 tools/fit_margin.py <wrestler_seasons.csv of the win-only run> data/difficulty/margin_ctx.json
"""
import csv, re, sys, math, json, zlib
import numpy as np
from collections import defaultdict
from scipy.optimize import minimize
sys.path.insert(0, 'tools')
nk=lambda s:re.sub(r'[^a-z]','',re.sub(r'\([^)]*\)','',(s or '').lower()))
C_=math.log(10)/400
WS=sys.argv[1]
R={}
for r in csv.DictReader(open(WS)):
    if r['season']: R[(int(r['year']),r['key'])]=float(r['season'])
def mcat(b,y):
    res, sc, fl = b['result'], b['score'] or '', b['flags'] or ''
    if res == 'fall':
        m = re.fullmatch(r'(\d{1,2}):(\d\d)', sc.strip())
        if not m: return (4, 10)
        t = int(m[1]) * 60 + int(m[2]); k = 9 if t < 60 else 8 if t < 120 else 6 if t < 240 else 4
        return (k, k)
    if res == 'tf': return (10, 10)
    if res in ('dec', 'md'):
        if re.search(r'\b(OT|SV|TB|UTB|2OT|UT)\b', fl): return (0, 0)
        m = re.match(r'\s*(\d+)-(\d+)', sc)
        if not m: return (0, 3) if res == 'dec' and y >= 1974 else None
        d = int(m[1]) - int(m[2])
        if d <= 0: return None
        k = 1 if d <= 1 else 2 if d <= 3 else 3 if d <= 7 else 5 if d <= 11 else 7
        return (k, k)
    return None
def bon(c): return None if c is None or c[0]!=c[1] and not (c[0]>=4) else (1 if c[0]>=4 else 0)  # bonus = fall/md/tf
def mera(y): return 0 if y < 1956 else 1 if y < 1974 else 2 if y < 1990 else 3 if y < 2005 else 4
B=[]
Wc=defaultdict(lambda:[0,0]); Lc=defaultdict(lambda:[0,0])   # (key,year) -> [bonus, n] among wins / losses
for r in csv.DictReader(open('data/brackets/bouts.csv')):
    y=int(r['year']); c=mcat(r,y)
    if c is None: continue
    if r['level'] in ('regional', 'state') and y >= 2018 and zlib.crc32('|'.join((r['tournament'], r['weight'], r['side'], r['round'], r['winner'], r['loser'])).encode()) % 10 == 0: continue   # the common test stays unseen
    w=nk(r['winner'])+'|'+nk(r['winner_school']); l=nk(r['loser'])+'|'+nk(r['loser_school'])
    bb=1 if c[0]>=4 else (0 if c[1]<=3 else None)
    if bb is not None: Wc[(w,y)][0]+=bb; Wc[(w,y)][1]+=1; Lc[(l,y)][0]+=bb; Lc[(l,y)][1]+=1
    B.append((y,w,l,c,bb,r['level']))
A=8.0
def car(D,k,y):
    a=[0,0]
    for d in range(-3,4):   # whole career window around the season (+-3)
        v=D.get((k,y+d)); 
        if v: a[0]+=v[0]; a[1]+=v[1]
    return a
rows=defaultdict(list); p0={}
tot=defaultdict(lambda:[0,0])
for y,w,l,c,bb,lv in B:
    if bb is not None: tot[mera(y)][0]+=bb; tot[mera(y)][1]+=1
for e,(a,n) in tot.items(): p0[e]=a/n
for y,w,l,c,bb,lv in B:
    gw,gl=R.get((y,w)),R.get((y,l))
    if gw is None or gl is None: continue
    e=mera(y); p=p0[e]
    hw=car(Wc,w,y); hl=car(Lc,l,y)
    if bb is not None: hw[0]-=bb; hw[1]-=1; hl[0]-=bb; hl[1]-=1
    lg=lambda q:math.log(q/(1-q))
    fw=lg((hw[0]+A*p)/(hw[1]+A))-lg(p); fl=lg((hl[0]+A*p)/(hl[1]+A))-lg(p)
    rows[e].append((C_*(gw-gl),c[0],c[1],lv=='regional',lv=='state',fw,fl,y))
def fit(rs,use):
    z=np.array([r[0] for r in rs]); lo=np.array([r[1] for r in rs]); hi=np.array([r[2] for r in rs])
    X=np.array([[r[3],r[4],r[5],r[6]] for r in rs],float)[:,use]
    k=X.shape[1]
    def f(p):
        bt=math.exp(p[0]); th=np.concatenate([[-1e6],np.cumsum(np.concatenate([[p[1]],np.exp(p[2:11])])),[1e6]]); o=X@p[11:] if k else 0
        a_=bt*z+o-th[lo]; b_=bt*z+o-th[hi+1]
        v=np.logaddexp(0,a_)+np.logaddexp(0,b_)-a_-np.log1p(-np.exp(np.minimum(th[lo]-th[hi+1],-1e-12)))
        return float(v.sum())
    p0_=np.concatenate([[math.log(0.3),-3.0],np.log(np.full(9,0.6)),np.zeros(k)])
    r=minimize(f,p0_,method='L-BFGS-B',options={'maxiter':5000})
    return r, len(rs)
out={}
for e in sorted(rows):
    rs=rows[e]
    r0,n=fit(rs,[]); r1,_=fit(rs,[0,1]); r2,_=fit(rs,[0,1,2,3])
    print(f'era {e} n={n}: ll/bout base {r0.fun/n:.4f} +level {r1.fun/n:.4f} +style {r2.fun/n:.4f}; beta {math.exp(r0.x[0]):.3f}->{math.exp(r2.x[0]):.3f}; reg {r2.x[11]:+.3f} state {r2.x[12]:+.3f} fw {r2.x[13]:+.3f} fl {r2.x[14]:+.3f}')
    x=r2.x; out[e]={'beta':math.exp(x[0]),'t':list(np.cumsum(np.concatenate([[x[1]],np.exp(x[2:11])]))),'reg':x[11],'state':x[12],'fw':x[13],'fl':x[14],'p0':p0[e]}
json.dump(out,open(sys.argv[2],'w'),indent=1,default=float)
