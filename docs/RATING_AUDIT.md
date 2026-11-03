# Rating audit (November 2026)

Why the bracket view showed Cameron Coy (three-time state champion) at 54, Brock Wilson at 36, Luke Gardner at 39
and Jacob Montes at 68 in the 2016 PIAA AAA 145 bracket, what else was wrong, and what changed. Numbers come from
`tools/rating_audit.py` (v1 = the SOS release, v2 = this one) and `data/difficulty/eval.txt`.

## 1. What Brock saw: path SOS read as a rating

The numbers on each bracket line were **path SOS**: the strength of the opponents that wrestler faced in that
tournament, wins counted twice, rescaled 0–99. They were never the wrestler's own strength. The wrestlers' own v1
season strengths were in the right order all along:

| 2016 AAA 145 | own season strength (v1) | opponents' strength (v1 path) | tag shown | finish |
|---|---|---|---|---|
| Cameron Coy | **2091** | 1810 | 54 | 1st |
| Brock Wilson | **1922** | 1737 | 36 | 2nd |
| Luke Gardner | **1815** | 1749 | 39 | 5th |
| Jacob Montes | **1735** | 1870 | 68 | DNP |

Montes's 68 is high because he lost to Coy and to Ryan Krause: losing to good wrestlers makes a hard path, not a good
wrestler. Coy's 54 is lower because he beat everyone, including wrestlers who were simply weaker than him. Brock beat
Gardner at districts and regionals; his own strength was 107 above Gardner's, but the tag compared their opponents.

**The per-level 0–99 scale made it worse.** Each level had its own scale (district paths 1364–1745, state paths
1582–2004), so the same strength meant different numbers at different levels. Brock's 2016 path read **74 at
districts** (opponents 1650) and **36 at states** (opponents 1737): the harder schedule showed the smaller number.

Verdict: the diagnosis holds. The presentation was the main fault: a number that looked like a rating, colored like a
grade, on a scale that changed with the level.

## 2. Sanity and consistency of the ratings themselves

| | v1 | v2 |
|---|---|---|
| State brackets where the champion is rated #1 (1,530 brackets, 6+ rated entrants) | 66.3% | **82.2%** |
| … champion in the top 2 | 85.0% | **94.1%** |
| Mean Spearman, rating vs state place, within a bracket | 0.711 | **0.769** |
| Same-season bouts the lower-rated wrestler won | 12.6% | **7.8%** |
| … by 100+ points | 1.6% | 1.2% |
| Hidden 2018–26 bouts, season-batch log loss (n = 6,849) | 0.5623 | **0.5563** |
| Hidden 1990–2017 bouts, tuning log loss | 0.5755 | **0.5743** |
| 3x+ state champions: median percentile of career peak (74 wrestlers) | 99.93 | 99.93 |
| … lowest | 99.03 | 99.25 |

**Why a champion was often not #1 in v1.** In 517 brackets the champion was not rated first; the median gap was 59
points. Typical case: 1981 AA 138, John Cappiello rated 165 above Jeff Gray, who beat him 13-5 in the final.
Cappiello's strong neighbouring seasons pulled his 1981 rating up, Gray's weaker ones pulled his down. The prior
linking seasons was too strong: its strength was tuned on a grid (0.35–1.0 × the fitted residual) and the best value
was the edge of the grid, 1.0. Extending the grid (0.7–4.5) puts the optimum at **2.0**, a prior sd of 215 instead of
108; 3.0 and 4.5 are worse. With the season's own bouts weighted properly the champion is #1 in 82% of brackets and
both held-out tests improve. This is Brock's rule in numbers: the current season matters most, and the neighbouring
seasons now inform it rather than override it.

**Top of the all-time list (v2, peak season).** Matt Gerhard 1983 (2065), Jim Conklin 1942, Keanu Dillard 2025,
Jan Clark 1976, George Custer 1940, Charlie Heller 1976, Sammy Sasso 2017, Jordan Oliver 2007, Chance Marsteller
2013, Adam Waters 2025: four-timers and three-timers throughout; 30 of the top 50 careers are 3x+ champions.
Entries that look surprising, and why:

- **J.J. Fasnacht** (Pine Grove, 1990), **Ken Whitsel** (Lewistown, 1978), **Tom Bold** (Bethlehem Catholic,
  1979) and **Norm Walker** (Greenville, 1976) each won one state title, and the peak is that title season: unbeaten
  through districts, regionals and states (Whitsel 11-0 with nine falls; Bold 11-0 with eight
  falls and a major; Fasnacht 11-0, his best win a 1807-rated opponent at states). A peak rating measures the best
  single season, not how many titles a career holds; the career average and the medal columns carry the rest.
- **Vincenzo Joseph** (Pittsburgh Central Catholic) shows "0 titles" in the audit only because the audit joins medals
  by school spelling and the brackets abbreviate the school ("Pittsburgh CC"); he won two state titles and his
  rating (1986 peak) is correct. The app joins by its own canonical school names and is not affected.

## 3. Identity: one wrestler, several keys

Wrestlers were keyed by name + school as printed, so nicknames (Joe / Joey), dropped letters (Brenneman /
Breneman), initials on later bracket slots ("C. Stoneking"), an empty or parenthesized school ("Wilson (West Lawn)"
reduces to "wilson" in one PDF and nothing in another) split one wrestler's bouts across keys, and his rating used
only part of his season. `tools/identity.py` now merges keys when, in the same season, they share a school (or one is
empty or a prefix), a last name (exact, one letter apart, or a prefix), compatible first names (equal, prefix,
initial, or a nickname pair), and weights within 12 lb; keys with only an initial or no school merge only when they
have exactly one candidate that season, so V. Smith never chains onto Phil Smith. Across seasons, full names at the
same school merge when they never appear in the same season, are within three seasons and 30 lb of each other.

- **1,184 of 99,549 name keys** merged into another (1,654 merge events; about 230 across seasons).
- Effect: forward-rating held-out log loss 0.5585 → 0.5576; the batch fit is unchanged in method.
- Brothers at one school (Sonny / Sammy Sasso) are kept apart by the first-name rule.
- "Jacob Montes" in the 2016 bracket was not a split; one key, one rating (1473 in v2).

## 4. Scale

The 0–99 per-level scale is retired. v2 has **one scale for everything**: the Overtime Rating, an Elo-type number
where **1500 is the average state qualifier**. Each season's batch strengths are anchored per class (AAA, AA, one-class
era) on a rolling 11-season window of state entrants, so drift between separately fitted seasons is removed while a
deep year still reads deeper than its neighbours; the spread is the median sd of modern state qualifiers (167
points), so 400 points still means about 10-to-1.

Field strength is the mean rating of a bracket's top eight on the same scale, so levels read naturally:

| typical field, 1980–2026 | median | p10 | p90 |
|---|---|---|---|
| district | 1221 | 1078 | 1346 |
| regional | 1375 | 1287 | 1479 |
| state | 1638 | 1584 | 1685 |

## 5. Quality of wins, bad losses, and the adjustment toggle

Path SOS is replaced by two plainer descriptions of a run: **best win** (the highest-rated opponent he beat, with
the mean of opponents beaten kept in the data) and **upset losses** (losses to someone rated 150+ below him). Tested
against the wrestler's own rating (state entrants 1980+, n = 20,752):

| added to own season rating | gain in R² for state placement points | gain for next season's state points (n = 7,405) |
|---|---|---|
| best win | +0.0001 | +0.0066 (negative coefficient) |
| mean of opponents beaten | +0.0000 | +0.0001 |
| upset losses | +0.0003 | — |
| field strength | **+0.0157** | +0.0051 |

Once a wrestler's own rating is known, the quality of his wins adds nothing to where he placed, and its small effect
on next season runs the wrong way. **The "Adjust for strength of schedule" toggle is removed**: there is nothing for it
to adjust that the rating does not already carry. Field strength still explains placement beyond rating (a deep
bracket costs places), so it stays as context on every bracket, as a gauge.

## 6. What the app shows now

- Bracket lines: the wrestler's **RTG** (his own season rating), in chalk, uncolored, with his best win in that
  tournament under his bouts. A Seed / Rating toggle reorders the field.
- Bracket header: **Field** as a gradient gauge with ticks at the typical district, regional and state field; the
  only place difficulty uses color.
- Wrestler page: a rating strip (season by season, peak marked) and his five best career wins, each opening its
  bracket.
- Wrestler cards, school tables, all-time teams, season podiums: the rating where one wrestler is shown; no
  difficulty tags on school, district or region aggregates.
