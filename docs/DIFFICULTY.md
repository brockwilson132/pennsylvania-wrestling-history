# Ratings and difficulty

> **v2 (November 2026).** The 0–99 path SOS tags and per-level scales are retired. The primary number is now the
> wrestler's own **Overtime Rating** on one scale (1500 = the average state qualifier); brackets carry a **field**
> strength on the same scale; runs are described by **best win** and **upset losses**; the "Adjust for strength of
> schedule" toggle is removed. Why: `docs/RATING_AUDIT.md`. Sections 1–2 below still describe the bout data and the
> season batch; v2 changes are in section 6, and sections 3–4 are kept as the record of v1.

How Overtime measures how hard a bracket was and how hard a wrestler's run through it was, why it is built
this way, and what the numbers say. Everything here is reproduced by `tools/parse_bouts.py`,
`tools/validate_bouts.py` and `tools/ratings.py`; the numbers are in `data/difficulty/eval.txt` and
`data/brackets/bouts_validation.txt`.

## 1. The data: every bout, not just placements

The archive PDFs are real brackets, drawn by one generator from 1938 to 2026. Bracket lines are thin filled
rectangles, so the tree can be read from geometry instead of guessed from text: a vertical connector joins two
slots, and the slot that starts at the connector between its ends is the winner. Names on later slots are
abbreviated ("M. Ziegler (QT)") and are resolved to the bracket's own entrants; the result printed under the
winner's slot gives the type and score (dec, major, tech fall, fall with time, OT / SV / TB, forfeit, injury, DQ).

- **374,237 bouts** in 24,693 brackets (district, regional, state), 366k of them decided on the mat.
- **Validation:** in 99.3% of brackets the parsed place-1 wrestler wins his bouts, never loses, and wins the final
  (22,563 agree, 150 disagree, mostly abbreviations that could not be resolved). Five brackets were checked line
  by line against rendered pages (2024 AAA 121, 2015 D11 AAA 138, 1985 Northeast AAA 119, 1974 A 98, 1965 112):
  every bout, winner, result and score matched.
- **Coverage:** championship and consolation sides are complete for every state, regional and district bracket
  from the 1980s on. Before that: state championship sides are complete from 1938 (consolations from the mid-70s);
  regionals 1950s–60s have the final but often only part of the bracket; districts reach ~90% from the 1960s.

## 2. Season strength: one batch per season, linked through time

**Why not a running Elo.** A first version rated wrestlers bout by bout in date order. Brock's correction: inside a
season, order is noise. Beating someone at districts who went on to win states three weeks later should count the
same as beating him at states, and his other results that season are evidence too. A running rating says the
district win was over a lesser wrestler only because the tournaments that showed otherwise had not happened yet.

So each season is fit **as one batch**:

- **Bradley–Terry on the Elo scale**, every bout of that season at every level, weighted by result: fall 1.5,
  tech fall 1.4, major 1.2, decision 1.0, decision in OT / SV / TB 0.8. Forfeits, injury defaults and DQs carry no
  information and are dropped. A win counts by the opponent's full-season strength, regardless of round or level.
- **Placements as extra evidence** where a bracket has fewer bouts than placers (old partial brackets, the few
  files with no bout lines): each higher placer is treated as beating each lower placer, at weight
  0.3 / (placers − 1). 2,285 such pairs against 366k real bouts.
- **Seasons are linked by a prior.** Season-*t* strength is shrunk toward a fitted blend of the same wrestler's
  *t*−2, *t*−1, *t*+1 and *t*+2 strengths plus a per-grade term. **The weights are fitted, not guessed**: each
  wrestler-season's season-only strength (his season fit on its own, weak prior) is regressed on his season-only
  strengths in the neighbouring seasons and his grade, slopes constrained non-negative:

| *t*−2 | *t*−1 | *t*+1 | *t*+2 |
|---|---|---|---|
| 0.26 | **0.44** | 0.33 | 0.17 |

  The season before counts more than the season after, and both more than seasons two away. Prior sd 107 rating
  points (the regression residual; a tighter prior was tested on hidden 1990–2017 bouts and did worse).
- **No iteration loop.** Brock's spec suggested iterating the seasons to convergence. Tried: feeding neighbours'
  *smoothed* estimates back into each other's priors double-counts (the fitted weights sum to about 1.2 because the
  season-only regressors are noisy), and the loop amplified instead of settling (largest change still 49 rating
  points after five passes). The prior is therefore built from the neighbours' season-only estimates, exactly the
  quantities the weights were fit on, which makes a single pass the fixed point.

**A forward-only rating is kept for one job: the leak-free prediction test**, and as the "entering rating"
control in the evaluation below. It is a chronological Elo: margin-scaled updates, faster-moving provisional
ratings, 20% regression to the mean between seasons plus a fitted grade step of about +125 per year.
Tuned on 1980–2017, tested on 2018–2026 (68,852 bouts never seen in tuning):

| held-out 2018–2026 | log loss | accuracy |
|---|---|---|
| coin flip | 0.693 | 0.500 |
| forward rating | **0.559** | **0.707** |
| forward rating without the margin factor | 0.571 | 0.696 |
| forward rating without the grade step | 0.616 | 0.653 |

At states, where seeds exist (2018–2026, 8,289 bouts): seed only 0.616, rating only 0.579, seed + rating 0.562.

**Both, on the same hidden bouts.** 10% of 2018–2026 bouts were hidden and the season batch was refit without
them: season-batch strength 0.562 (accuracy 0.697) vs forward rating 0.553 on the same 6,849 bouts. The two are
close; the forward rating is slightly the better pure predictor because it carries a whole career, while the batch
looks two seasons each way. The batch is the better *description* of how good someone was that season, which is
what difficulty needs, and it is leak-free for the bout being predicted.

## 3. What it changes

**Brock's example.** 195 state wins by seniors over freshmen who later won a state title. Those freshmen are
credited at **36** on the state path scale (smoothed season strength) vs 51 with a naive symmetric window
(*t*−1, *t*, *t*+1 weighted equally); the same wrestlers as seniors rated 99. The win counts for beating a good
freshman, not for beating a champion.

**How far rankings move** (state runs since 1980, smoothed season strength vs each alternative):

| compared with | Spearman | mean percentile move | top-10% overlap |
|---|---|---|---|
| forward rating at the time of the bout | 0.86 | 11 pts | 65% |
| season *t* alone, no neighbouring seasons | 0.80 | 13 pts | 60% |
| naive symmetric window | 0.86 | 11 pts | 67% |

**Trade-off.** A forward-only rating underrates a genuinely elite freshman early (everyone starts level), and a
season-only fit is noisy for anyone with few bouts. The smoothed season strength fixes both with his own same-season
results first and his neighbouring seasons second, past above future, without crediting a win for growth that
happened years later.

## 4. Two measures, and which one wins at what

- **Field strength** (a bracket): mean season strength of the bracket's top eight entrants.
- **Path SOS** (one wrestler's run): mean season strength of the opponents he actually wrestled in that
  tournament, wins counted twice (a loss still tells you who you had to see). Both include same-season later results.

Both are normalized by era: each season's strengths are z-scored against that year and class's district wrestlers,
then put on **0–99 scales that are fixed per level** (district, regional, state), pooled over 1980–2026
(1938–1973 one-class seasons have their own scale, since there were few bouts and, before 1951, no regionals).
A district 80 means hard for a district; a state 80 means hard for states. Cutoffs are fixed, not per-year
percentiles, so a deep year can have many hard brackets: the share of a year's state brackets at 75+ ranges from
0% to 64% (median 8%), where the old method forced 25% every year.

**Evaluation** (state, 1980–2025; the control for "own strength" is the forward entering rating, so nothing here
uses the result being explained):

| question | old tier (a) | field (b) | path (c) | path + field (d) |
|---|---|---|---|---|
| Holding a wrestler's own rating, does the measure make placing harder? Gain in R² for P(place), n = 20,752 | +0.0000 | **+0.0143** | n/a (depends on how far he went) | — |
| Does it make a medal a better signal of ability? Gain in R² for next season's state points over placement points, n = 7,396 | +0.0021 | +0.0039 | +0.0039 | **+0.0054** |

- **Field strength wins** as the measure of a bracket: it is the only one that explains how hard it was to place
  for a wrestler of a given strength. The old percentile tier explains nothing beyond his own rating.
- **Path SOS** is the right description of a run and, built on season strength, it now adds information beyond
  placement *and* his own entering rating (+0.0020; the running-Elo version added +0.0004).
- **Combined (d) wins** at making a medal a better signal of ability, so the opt-in **"Adjust for strength of
  schedule"** uses (d), the average of path and field on the 0–99 scale, mapped smoothly to a multiplier between
  0.85 and 1.15 on placement points. Medal counts never change.
- All gains are small in absolute terms: a placement already says most of what a placement can say. Difficulty is
  context for a result, not a replacement for it.

## 5. Caveats

- Strengths are relative to the wrestlers each one actually met. AA and AAA rarely meet, so their scales are
  normalized separately against their own district populations; compare within a class.
- State fields rise from the 1980s to the 2010s on this scale (median 41 to 58). Part of that is real depth, part is
  that districts grew larger relative to the state's top eight.
- District 3 and District 7 AAA years missing from the archive have no bouts; those wrestlers' season strength
  rests on their regional and state bouts.
- Pre-1960s regional and district brackets are partial; their strengths rest on few bouts plus placements.
- Same name + same school within five seasons is treated as one wrestler.

## 6. v2: what changed and the evidence

- **Identity linking** (`tools/identity.py`): 1,184 of 99,549 name keys merged (nicknames, dropped letters, initials,
  empty or parenthesized schools), so one wrestler's bouts pool into one season. Forward held-out log loss
  0.5585 → 0.5576.
- **Prior strength.** v1 tuned the prior that links seasons on a grid whose best value was its edge (1.0). Extended to
  0.7–4.5, hidden 1990–2017 bouts pick **2.0** (log loss 0.5743; 3.0 → 0.5785, 4.5 → 0.5960): the prior sd is now 215,
  so a season's own bouts dominate and neighbouring seasons inform it. Hidden 2018–26 bouts: 0.5623 → **0.5563**.
  Champion rated #1 in his state bracket 66% → **82%** (top 2: 85% → 94%); lower-rated winner of a same-season bout
  12.6% → 7.8%. Proximity weights are unchanged (t−1 0.45, t+1 0.33, t−2 0.26, t+2 0.17).
- **One scale.** Each season's strengths are anchored per class on a rolling 11-season window of state entrants:
  1500 = the average state qualifier, spread 167 (the median sd of modern state qualifiers), so 400 points ≈ 10:1.
  Typical fields since 1980: district 1221, regional 1375, state 1638.
- **Path SOS → best win and upset losses.** Beyond a wrestler's own rating, best win adds +0.0001 to R² for state
  placement points, the mean of opponents beaten +0.0000, upset losses +0.0003; field strength adds +0.0157. For next
  season's state points, best win adds +0.0066 with a negative coefficient. The rating already contains what the
  quality of wins says, so they are shown as description, not scored, and the **adjustment toggle is removed**.
- **Career numbers.** Peak season rating, and the average of his season ratings.
