# Next session: ratings v6 rollout (agreed with Brock, 2026-11-04)

State at hand-off
- tools/ratings.py v6 is built locally and committed (8d212d2), NOT published. Live artifact is still version 1793810176-7dbe (v5 ratings + RTG-as-of brackets).
- v6 = first-round prior (-600, chosen on hidden 1990-2017 regional+state bouts at the final prior width) + district offsets refit
  at the final prior width (bug fix: offsets were fitted at sd scale 2.0, applied at 1.0) + offsets fit through 2026 (RATINGS_FIT_ALL=1).
- Test results (offsets fit <=2017): hidden 2018-26 regional+state bouts 78.1% / log loss 0.455 (live 75.8% / 0.497);
  cross-district hidden state bouts 0.544 (live 0.560); all districts within +-0.032 (D7 -0.005, D1 -0.032).
- Known leftover: D7 AAA 2000-04 about 8% overrated at states (era 1990-2004 spans no-bracket and full-bracket D7 years);
  5-season blocks were tested and lost (overfit).

Decisions made
- Keep 1500 = average state qualifier (1000 would make 37% of ratings negative). No scale change, no 0-1000, no Pareto.
- No percentile/odds callouts on cards. About page gets: ratings ladder, odds calculator, distribution chart.
- Unit ratings are renamed "Team RTG".

Steps
1. Audit "reached regionals" (ADV in ratings.py) where regional brackets are missing: infer advancement from district
   placements (district qualifier counts per era) so missing regional data never puts a wrestler in the first-round group.
   Rerun the fairness test; rebuild.
2. Ratings for wrestlers whose season ended in the first round: do not show (tiles, lists, rankings, bracket boxes show
   a plain mark, results stay). Decide the 8 advancers below 0 (min -246): inspect for data errors.
   Check knock-on: best wins, team RTG, field strength, district/region wrestler stats should use advancers only.
3. Career grid District row: show the section result (with section name) where a district splits into sections and
   has no separate district tournament (D7, D3, D1; D12 seasons with both: show the district).
4. District/region lists: replace best/avg/low divider rows with a shared horizontal axis per row (dot/bar) and one
   state-average line; mock with and without a 10th-90th percentile depth band; screenshots to Brock before publishing.
5. Rename unit ratings "Team RTG"; fix the Pennsylvania-page headline (1490 = mean of the five regions' team ratings).
6. About page: ratings ladder (landmark seasons + named wrestlers, odds per gap), odds calculator (pick two wrestlers),
   distribution chart (state-qualifier seasons, a chosen wrestler marked), short plain-language method note.
7. Before/after for Brock and top wrestlers per weight, screenshots reviewed, then publish once.
   Section batch 2 (pack_p2.sh) is not needed for ratings.
