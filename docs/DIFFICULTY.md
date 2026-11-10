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

- **Bradley–Terry on the Elo scale**, every bout of that season at every level, plus **how he won** (2026-11-08,
  replacing the old fall 1.5 / tech 1.4 / major 1.2 / dec 1.0 / OT 0.8 weights). Each bout has two parts: who won,
  P = σ(z) as before, and the margin given the win, a cumulative logit over one ladder of 11 categories ordered by the
  edge each means: OT, decision by 1, by 2–3, by 4–7, fall after 4:00, major 8–11, fall 2:00–4:00, major 12+, fall
  1:00–2:00, fall under 1:00, tech fall. P(at least category k | won) = σ(β·z + o − θₖ), with β and θ per era (scoring
  rules and period lengths changed). The offset o puts each margin **in context**: a level term (at the same rating gap,
  state bouts end in bonus points less often than district bouts) and the winner's shrunk bonus share among his other
  wins and the loser's among his other losses (a grinder who wins everything 3–1 is not marked down for it). So a margin
  moves a rating only when it is unusual for that setting and those two wrestlers. β, θ and o are fitted by
  `tools/fit_margin.py` on the win-only model's ratings (data/difficulty/margin_ctx.json), with the 2018–26 test bouts
  left out; the style counts in `ratings.py` also leave out whatever bouts a test hides. Without the context terms, close
  state wins read as weakness and low-bonus wrestlers were underrated (hidden state bouts: +7% wins above expectation; with
  them about +1%). How much margins count (a scale on β) was chosen 2026-11-08 with Brock: hidden 1990–2017 / 2018–26
  test / state champion rated #1 in his bracket: win-only .5046/.4469/89.3%, ×0.3 .4896/.4292/88.6%, ×0.8
  .4751/.4216/80.8%. ×0.3 is used: most of the clearly real prediction gain (vs win-only 8 standard errors; ×0.8 adds
  .0075, 2.5 s.e.) without rating non-placers over medalists, and the best agreement with state placings. A missing
  score or pin time counts only for what
  is known (some decision; at least a late fall; or the win alone). Losing to a star costs little, and now losing
  close to one shows; getting pinned in 0:30 costs more than losing a decision. Forfeits, injury defaults and DQs carry
  no information and are dropped. A win counts by the opponent's full-season strength, regardless of round or level.
- **Placements as extra evidence** where a bracket has fewer bouts than placers (old partial brackets, the few
  files with no bout lines): each higher placer is treated as beating each lower placer, at weight
  0.3 / (placers − 1). 2,285 such pairs against 366k real bouts.
- **Seasons are linked by a prior.** Season-*t* strength is shrunk toward a fitted prediction from the same
  wrestler's season-only strengths in *t*−2, *t*−1, *t*+1 and *t*+2 plus a per-grade term. **The prediction is
  fitted separately for each neighbour-availability pattern** (which of the four neighbouring seasons exist, whether
  a missing next season is graduation — known senior or 4th season of the career — and whether a missing previous
  season is freshman year), with its own slopes, grade terms and residual sd. Slopes are non-negative. Examples from
  the current fit:

| pattern | n | slopes | sum |
|---|---|---|---|
| senior, has *t*−2 and *t*−1 (graduated) | 15,538 | 0.24, 0.53 | 0.76 |
| junior, has *t*−2, *t*−1, *t*+1 | 6,530 | 0.15, 0.29, 0.43 | 0.87 |
| sophomore, has *t*−1, *t*+1, *t*+2 | 5,567 | 0.35, 0.29, 0.15 | 0.80 |
| freshman, has *t*+1 and *t*+2 | 4,555 | 0.40, 0.20 | 0.60 |

  **Why per pattern (the senior-year taper).** v2 fitted one regression on all rows with missing-value indicators.
  Its slopes (t−1 0.44, t+1 0.33, t−2 0.26, t+2 0.17, sum ≈1.2) were set mostly by wrestlers with neighbours on both
  sides; a senior has no *t*+1 or *t*+2, so his prior was ≈0.7 × his past plus one constant shared with wrestlers who
  simply did not return. That pulled strong seniors toward the mean: among four-season careers peaking at 1850+,
  the junior-to-senior gain was +21 against +149 sophomore-to-junior, 45% peaked as juniors, and 30% of careers
  peaking at 1700+ rated lower as seniors. Brock spotted it. Fitting each pattern on its own rows, and separating
  graduation from not returning, removes it: the JR→SR gain is now +126 / +136 / +122 for peaks 1850+ / 1700–1850 /
  1500–1700 (in line with the earlier years), and 8% of 1700+ careers rate lower as seniors.
- **Prior width.** Hidden 1990–2017 bouts give a nearly flat loss for prior-sd scales 0.7–2.0 (0.5635–0.5644);
  within 0.001 of the best, the widest prior is taken (2.0), so a season's own bouts decide and the prior fills
  gaps. Hidden 2018–26 bouts: season-batch log loss **0.5464** (v2 0.5564).
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

- **Field strength** (a bracket): mean season strength of the bracket's four best-rated entrants, placed or not (a top-eight mean let 1950-70 four-man fields crowd the toughest tier). Toughness tiers in the app are sextiles of this within each level.
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
  12.6% → 7.8%. (v3 replaced the single proximity regression with per-pattern fits; see section 2.)
- **One scale.** Each season's strengths are anchored per class on a rolling 11-season window of state entrants:
  1500 = the average state qualifier, spread 167 (the median sd of modern state qualifiers), so 400 points ≈ 10:1.
  Typical fields since 1980: district 1221, regional 1375, state 1638.
- **Path SOS → best win and upset losses.** Beyond a wrestler's own rating, best win adds +0.0001 to R² for state
  placement points, the mean of opponents beaten +0.0000, upset losses +0.0003; field strength adds +0.0157. For next
  season's state points, best win adds +0.0066 with a negative coefficient. The rating already contains what the
  quality of wins says, so they are shown as description, not scored, and the **adjustment toggle is removed**.
- **Career numbers.** Peak season rating, and the average of his season ratings.

## 7. v3: the senior-year taper

| | v2 | v3 |
|---|---|---|
| JR→SR gain, careers peaking 1850+ | +21 | **+126** |
| JR→SR gain, peaking 1700–1850 | +94 | **+136** |
| JR→SR gain, peaking 1500–1700 | +101 | **+122** |
| peak season FR/SO/JR/SR, peaking 1850+ | 0/8/160/191 | 0/3/15/401 |
| 1700+ careers rated lower as seniors | 30% | 8% |
| champion rated #1 in his state bracket | 82.2% | 82.0% |
| Spearman(rating, state place) | 0.767 | 0.764 |
| lower-rated winner, same-season bouts | 7.9% | 7.8% |
| hidden 2018–26 bouts, season-batch log loss | 0.5564 | **0.5464** |

## 8. v4: coverage-aware prior (AAA wrestlers with no district bracket)

The archive has almost no D3/D7 AAA district brackets, so every SW and SC AAA state entrant had fewer rated bouts per
season, was shrunk harder toward the 1500 prior and came out under-rated (docs/CALIBRATION.md). v4 shifts the prior
mean of each AAA wrestler-season whose district tournament is not on file (full field < 24 entrants, the same rule as
`build_units.js`) by a fitted amount per era. The shift is fitted iteratively on bouts at regionals and states between
covered and uncovered wrestlers, before 2018 only, until those bouts show no residual: **+131 before 1990, +92 for
1990–2004, +83 from 2005**. AA is left alone. Its district coverage is ~96% complete, and an AA shift (+80, fitted
mostly on D3) over-rated AA SC at states in the held-out test.

| | v3 | v4 |
|---|---|---|
| hidden 2018–26 bouts, season-batch log loss | 0.5464 | **0.5428** |
| AAA cross-region state bouts 2018–26, log loss | 0.4312 | **0.4183** |
| AA cross-region state bouts 2018–26, log loss | 0.4261 | 0.4286 |
| AAA region offsets vs NE, 1990–2026 (SW / SC / SE / NW) | +85 / +57 / +5 / −19 | +17 / −12 / −13 / −22 |
| AAA no-district-bracket term | +59 ±3 | +4 ±1 |
| champion rated #1 in his state bracket | 82.0% | **83.6%** |
| Spearman(rating, state place) | 0.764 | 0.776 |
| lower-rated winner, same-season bouts | 7.8% | 7.7% |
| JR→SR gain, peaking 1850+ / 1700–1850 / 1500–1700 | +126 / +136 / +122 | +126 / +133 / +122 |
| 1700+ careers rated lower as seniors | 8% | 8% |

The rating scale is re-anchored to the average state qualifier, so raising SW/SC lowers everyone else slightly. Peaks
fell about 40–50 points: Oliver 2038 → 1987, Cunningham 2033 → 2000, Dillard 2011 → 1971.
