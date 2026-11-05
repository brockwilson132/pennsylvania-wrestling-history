import csv, re, math, sys, collections, json
csv.field_size_limit(10**9)
R='/home/claude/pennsylvania-wrestling-history/'
def nk(s): return re.sub(r'[^a-z]','',(s or '').lower())
rate={}      # (level,tournament,weight,nk(name)) -> season
season_by={} # (year,nk(name),nk(school)) -> season (any row)
dist={}      # (year,nk(name),nk(school)) -> district label
reg={}       # (year,nk(name),nk(school)) -> region label
def dlab(t):
    m=re.match(r'\d{4}_D(\d+(?:-\d+)?)',t)
    return 'D'+m.group(1) if m else None
def rlab(t):
    t2=t[5:]
    for k,v in [('North_East','NE'),('North_West','NW'),('South_Central','SC'),('South_East','SE'),('South_West','SW'),('Central_North_West','CNW')]:
        if t2.startswith(k): return v
    if 'Super' in t2: return 'Super'
    return None
for r in csv.DictReader(open(R+'data/difficulty/wrestler_seasons.csv')):
    try: s=float(r['season'])
    except: continue
    y=int(r['year']); n=nk(r['name']); sc=nk(r['school'])
    rate[(r['level'],r['tournament'],r['weight'],n)]=s
    season_by[(y,n,sc)]=s
    if r['level']=='district':
        d=dlab(r['tournament'])
        if d: dist[(y,n,sc)]=d
    if r['level']=='regional':
        g=rlab(r['tournament'])
        if g: reg[(y,n,sc)]=g
SKIP={'ff','inj','dq','forfeit','def',''}
def run(level, years=(1990,2026)):
    agg=collections.defaultdict(lambda:[0.0,0.0,0])  # key -> [sum(actual-exp), sum var, n]
    miss=0; tot=0; pairs=[]
    for b in csv.DictReader(open(R+'data/brackets/bouts.csv')):
        if b['level']!=level: continue
        y=int(b['year'])
        if not(years[0]<=y<=years[1]) or b['cls'] not in('AAA','AA'): continue
        if (b['result'] or '').lower() in SKIP: continue
        tot+=1
        w=(y,nk(b['winner']),nk(b['winner_school'])); l=(y,nk(b['loser']),nk(b['loser_school']))
        rw=rate.get((level,b['tournament'],b['weight'],w[1])) or season_by.get(w)
        rl=rate.get((level,b['tournament'],b['weight'],l[1])) or season_by.get(l)
        if rw is None or rl is None: miss+=1; continue
        p=1/(1+10**((rl-rw)/400))
        dw,dl=dist.get(w),dist.get(l)
        gw,gl=reg.get(w),reg.get(l)
        pairs.append((y,b['cls'],dw,dl,gw,gl,rw,rl))
        for side,(d,g,act,pe) in {'w':(dw,gw,1,p),'l':(dl,gl,0,1-p)}.items():
            for key in [('D',b['cls'],d),('R',b['cls'],g),('D',b['cls']+'|'+('2011+' if y>=2011 else 'pre2011'),d)]:
                if key[2] is None: continue
                if level=='regional' and key[0]=='R': continue
                a=agg[key]; a[0]+=act-pe; a[1]+=pe*(1-pe); a[2]+=1
    return agg,tot,miss,pairs
out={}
for lvl in ('state','regional'):
    agg,tot,miss,pairs=run(lvl)
    out[lvl]=(agg,tot,miss)
    print(f'== {lvl}: bouts {tot}, unmatched ratings {miss}')
    for key in sorted(agg, key=lambda k:(k[0],k[1],k[2])):
        s,v,n=agg[key]
        if n<80: continue
        z=s/math.sqrt(v) if v else 0
        # residual per bout and implied rating offset: d(prob)/d(rating) ~ p(1-p)*ln10/400 ; offset ≈ s / (v*ln10/400)
        off=s/(v*math.log(10)/400) if v else 0
        se=1/math.sqrt(v*(math.log(10)/400)**2) if v else 0
        print(f'{key[0]} {key[1]:14s} {key[2]:6s} n={n:5d} resid/bout={s/n:+.3f} z={z:+.1f} offset={off:+.0f} ±{1.96*se:.0f}')
json.dump({lvl:{'|'.join(map(str,k)):v for k,v in out[lvl][0].items()} for lvl in out}, open('/home/claude/calib/agg.json','w'))
