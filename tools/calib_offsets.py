import csv, re, math, collections, json
import numpy as np
from scipy.optimize import minimize
csv.field_size_limit(10**9)
R='/home/claude/pennsylvania-wrestling-history/'
def nk(s): return re.sub(r'[^a-z]','',(s or '').lower())
season_by={}; reg={}; nb=collections.Counter(); hasdist=set()
def rlab(t):
    t2=t[5:]
    for k,v in [('North_East','NE'),('North_West','NW'),('South_Central','SC'),('South_East','SE'),('South_West','SW')]:
        if t2.startswith(k): return v
    return None
for r in csv.DictReader(open(R+'data/difficulty/wrestler_seasons.csv')):
    try: s=float(r['season'])
    except: continue
    y=int(r['year']); k=(y,nk(r['name']),nk(r['school']))
    season_by[k]=s
    try: nb[k]+=int(r['bouts'] or 0)
    except: pass
    if r['level']=='regional':
        g=rlab(r['tournament'])
        if g: reg[k]=g
    if r['level']=='district': hasdist.add(k)
SKIP={'ff','inj','dq','forfeit','def',''}
rows=[]
for b in csv.DictReader(open(R+'data/brackets/bouts.csv')):
    if b['level']!='state' or b['cls'] not in('AAA','AA'): continue
    y=int(b['year'])
    if y<1990: continue
    if (b['result'] or '').lower() in SKIP: continue
    w=(y,nk(b['winner']),nk(b['winner_school'])); l=(y,nk(b['loser']),nk(b['loser_school']))
    if w not in season_by or l not in season_by: continue
    gw,gl=reg.get(w),reg.get(l)
    if not gw or not gl or gw==gl: continue
    rows.append((y,b['cls'],gw,gl,season_by[w],season_by[l],w in hasdist,l in hasdist,nb[w],nb[l]))
print('cross-region state bouts 1990+', len(rows))
REG=['NE','NW','SC','SE','SW']
def fit(sub, label, extra=False):
    # P(win) = sigmoid(ln10/400*(rw-rl + off[gw]-off[gl] [+ c*(nodist_w - nodist_l)])), off[NE]=0
    def nll(th):
        off=dict(zip(REG,[0]+list(th[:4]))); c=th[4] if extra else 0
        tot=0
        for y,cl,gw,gl,rw,rl,dw,dl,bw,bl in sub:
            z=math.log(10)/400*(rw-rl+off[gw]-off[gl]+c*((not dw)-(not dl)))
            tot+=math.log1p(math.exp(-z))
        return tot
    x0=np.zeros(5 if extra else 4)
    res=minimize(nll,x0,method='BFGS')
    se=np.sqrt(np.diag(res.hess_inv))
    base=nll(np.zeros_like(x0))
    out={'label':label,'n':len(sub),'off':{'NE':0,**{REG[i+1]:(round(res.x[i]),round(1.96*se[i])) for i in range(4)}},'ll_base':base/len(sub),'ll_fit':res.fun/len(sub)}
    if extra: out['nodist_c']=(round(res.x[4]),round(1.96*se[4]))
    return out
res=[]
for cls in ('AAA','AA'):
    for lo,hi,lab in [(1990,2026,'1990-2026'),(2011,2026,'2011-2026'),(2025,2026,'2025-2026')]:
        sub=[r for r in rows if r[1]==cls and lo<=r[0]<=hi]
        if len(sub)<100: continue
        res.append(fit(sub,f'{cls} {lab}'))
    sub=[r for r in rows if r[1]==cls]
    res.append(fit(sub,f'{cls} 1990-2026 +no-district-bracket term',extra=True))
for r in res: print(json.dumps(r))
# leak-free-ish check: fit offsets on 1990-2017 state cross-region bouts, apply to 2018-2026
for cls in ('AAA','AA'):
    tr=[r for r in rows if r[1]==cls and r[0]<=2017]; te=[r for r in rows if r[1]==cls and r[0]>=2018]
    f=fit(tr,'train')
    off={k:(v if isinstance(v,int) else v[0]) for k,v in f['off'].items()}
    def ll(sub,off):
        t=0
        for y,cl,gw,gl,rw,rl,*_ in sub:
            z=math.log(10)/400*(rw-rl+off[gw]-off[gl]); t+=math.log1p(math.exp(-z))
        return t/len(sub)
    print(cls,'held-out 2018-26 cross-region state bouts n=',len(te),'logloss base',round(ll(te,{k:0 for k in REG}),4),'with offsets',round(ll(te,off),4), 'offsets', off)
# approximate 95% CI half-widths for offsets / coverage term: 1.96 * 400/ln10 / sqrt(sum p(1-p)) over involved bouts
def ci(sub, pred):
    v=0
    for y,cl,gw,gl,rw,rl,dw,dl,*_ in sub:
        if pred(gw,gl,dw,dl):
            p=1/(1+10**((rl-rw)/400)); v+=p*(1-p)
    return round(1.96*400/math.log(10)/math.sqrt(v)) if v else None
for cls in ('AAA','AA'):
    sub=[r for r in rows if r[1]==cls]
    print(cls, {g: ci(sub, lambda a,b,c,d,g=g: g in (a,b)) for g in REG}, 'nodist', ci(sub, lambda a,b,c,d: (not c)!=(not d)),
          'share of state entrants w/o district bracket', round(sum((not r[6])+(not r[7]) for r in sub)/(2*len(sub)),3))
    for g in REG:
        n=sum(1 for r in sub if g in (r[2],r[3])); nd=sum(1 for r in sub for side,dd in ((r[2],r[6]),(r[3],r[7])) if side==g and not dd)
        print('  ',g,'bouts',n,'wrestler-sides w/o district bracket',nd)
