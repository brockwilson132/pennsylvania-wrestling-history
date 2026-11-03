# Difficulty (strength of schedule)

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

## 2. Ratings (forward, predictive)

A chronological Elo rating for every wrestler (identity = normalized name + school; a pair unseen for more than
five seasons starts over, so fathers and sons stay separate).

- Updates scale with the result: fall 1.5×, tech fall 1.35×, major 1.2×, decision 1.0×. Forfeits, injury
  defaults and DQs are skipped.
- New ratings move faster (K × (1 + 2 / (bouts + 1))), K = 56.
- **Between seasons** the rating regresses 20% toward the mean and then adds a **grade step fitted from the
  data**: about +107 into the sophomore year, +104 into junior, +112 into senior. A freshman's rating is expected to
  rise, not frozen.
- Tuned on 1980–2017 bouts, tested on 2018–2026 (68,852 bouts, never seen in tuning):

| held-out 2018–2026 | log loss | accuracy |
|---|---|---|
| coin flip | 0.693 | 0.500 |
| rating | **0.562** | **0.708** |
| rating without the margin factor | 0.574 | 0.697 |
| rating without the grade step | 0.616 | 0.653 |

At states, where seeds exist (2018–2026, 8,289 bouts): seed only 0.616, rating only 0.579, seed + rating 0.562.
The rating beats the seed, and the two together beat both.

## 3. How strong was an opponent, in the season you wrestled him?

Brock's concern: a senior who beat a freshman who went on to win a title as a senior should not get credit for
beating a champion. The current season matters most; adjacent seasons less; the season before more than the
season after.

So the strength credited to an opponent in a bout in season *t* is an estimate of **his season-*t* strength**,
built without the bout being scored:

1. **Season-*t* performance, leave-one-bout-out**: a performance rating from his other bouts that season
   (opponents' pre-bout ratings, normal prior around his entering rating).
2. **Adjacent seasons**: his end-of-season ratings for *t*−2 and *t*−1 (forward, no season-*t* information) and his
   season-only performance ratings for *t*+1 and *t*+2 (season-only, so they do not carry season-*t* results forward).

**The weights are fitted, not guessed.** For 67,831 wrestler-seasons with at least four bouts, his season-*t*
performance was regressed on the four adjacent estimates plus grade, coefficients constrained non-negative:

| *t*−2 | *t*−1 | *t*+1 | *t*+2 |
|---|---|---|---|
| 0.21 | **0.62** | 0.36 | 0.14 |

The season before counts almost twice the season after, and both outweigh seasons two away, as expected. The
season-*t* evidence is then blended in with weight n / (n + 16), n = his other bouts that season (16 fitted on bout
prediction with both sides scored leave-one-bout-out). The blend predicts bouts better than the forward rating
(log loss 0.538 vs 0.578 on 25,000 bouts), so it is the better description of how good someone was *that* season.

**What it changes.** Across state runs since 1980, compared with the forward rating at the bout only, Spearman
0.88, a median wrestler's SOS percentile moves 10 points, 70% of the top-10% hardest runs stay in the top 10%.
Against a naive symmetric window (*t*−1, *t*, *t*+1 weighted equally): Spearman 0.90, 9 points, 77%.
On Brock's example: 195 state wins by seniors over freshmen who later won a state title. Those freshmen are
credited at **40** (blend) vs 58 (symmetric window); the same wrestlers as seniors rated 99. The win counts for
beating a good freshman, not for beating a champion.

**Trade-off.** Forward-only ratings underrate genuinely elite freshmen early in their first season (everyone starts
level). The blend partly fixes that through the freshman's own season-*t* results and, at a lower weight, through
what he did the next season, without crediting a win for growth that happened later.

## 4. Two measures, and which one wins at what

- **Field strength** (a bracket): mean season-*t* strength of the bracket's top eight entrants.
- **Path SOS** (one wrestler's run): mean strength of the opponents he actually wrestled in that tournament, wins
  counted twice (a loss still tells you who you had to see).

Both are normalized by era: each season's strengths are z-scored against that year and class's district wrestlers,
then put on **0–99 scales that are fixed per level** (district, regional, state), pooled over 1980–2026
(1938–1973 one-class seasons have their own scale, since there were few bouts and, before 1951, no regionals).
A district 80 means hard for a district; a state 80 means hard for states. Cutoffs are fixed, not per-year
percentiles, so a deep year can have many hard brackets: the share of a year's state brackets at 75+ ranges from
0% to 57% (median 15%), where the old method forced 25% every year.

**Evaluation** (state, 1980–2025):

| question | old tier (a) | field (b) | path (c) | path + field (d) |
|---|---|---|---|---|
| Holding a wrestler's own rating, does the measure make placing harder? Gain in R² for P(place), n = 20,752 | +0.0000 | **+0.0179** | n/a (depends on how far he went) | — |
| Does it make a medal a better signal of ability? Gain in R² for next season's state points over placement points, n = 7,396 | +0.0021 | +0.0027 | +0.0018 | +0.0030 |

- **Field strength wins** as the measure of a bracket: it is the only one that explains how hard it was to place,
  for a wrestler of a given strength. The old percentile tier explains nothing beyond his own rating.
- **Path SOS** is the right description of a run (who he actually had to beat) but adds little *prediction*
  beyond placement and his own rating (+0.0004), because the rating already counts who he beat. It is shown, not
  used to re-rank.
- The opt-in **"Adjust for strength of schedule"** uses (d), the average of path and field on the 0–99 scale,
  mapped smoothly to a multiplier between 0.85 and 1.15 on placement points. Medal counts never change.

## 5. Caveats

- Ratings are relative to the wrestlers each one actually met. AA and AAA rarely meet, so their scales are
  normalized separately against their own district populations; compare within a class.
- State fields rise over the decades on this scale (median 44 in the 1980s to 62 in the 2020s). Part of that is
  real depth, part is that districts grew larger and weaker relative to the state's top eight.
- District 3 and District 7 AAA years missing from the archive have no bouts; their wrestlers' ratings start at
  regionals. 53 brackets with entrants but no bouts are flagged `fallback` and use adjacent-season strength only.
- Pre-1960s regional and district brackets are partial; their SOS rests on few bouts.
- Same name + same school within five seasons is treated as one wrestler.
