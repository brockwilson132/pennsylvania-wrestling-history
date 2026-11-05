# Next session: finish the unit-rating redesign, then publish (agreed with Brock, 2026-11-04)

Done (local, not published; live artifact still 1793810176-7dbe)
- Ratings v6 in tools/ratings.py: first-round prior chosen by prediction at the final prior width. Grid -400..-1000
  turned at -700 (log loss .4924 .4886 .4866 .4862 .4875 .4902 .4942). Tests (offsets fit <=2017): hidden 2018-26
  regional+state 78.4% / .452; cross-district .544; every district within +-0.032 (D1 -0.032, D7 -0.006, D11 -0.008).
- Tried and rejected: estimating the first-round level from the group's own bouts (marginal likelihood). The level is
  not identified (it slides with the whole scale; without kid-vs-kid bouts it ran to the grid floor). Before drifting it
  passed -570..-730, agreeing with the prediction choice, so first-round ratings under -700 are genuine estimates.
- Missing regionals inferred from placements (309 wrestler-seasons); adv column in wrestler_seasons.csv / bout_rtg.csv.
- App: first-round ratings hidden (to be revisited, step 2), sections as the District row + section brackets,
  unit lists on a shared axis with an average line, About page ladder / odds calculator / distribution.
- The production ratings run with -700 was started at the end of the session: check /tmp/prod2.log or rerun
  `python3 tools/ratings.py`, then the pipeline (build_lower, build_difficulty, build_bestwins, build_people,
  build_wstats, build_units, check_integrity).

Agreed design for units (Brock approved)
- Three numbers, one word each, same at every level (school -> district -> region):
  Strength: lineup strength. Per weight the school's best wrestler (real rating, first-round kids included); a weight
    with nobody entered is a forfeit (0 chance). Average the chances of beating an average AAA starter, convert back
    to the rating scale ("as strong as 14 wrestlers rated X"). District/region season = average of its schools.
  Talent: wrestlers at state-medalist level (about 1650+) per school per season; rolls up as count / schools.
    (AAA 1999-2026 medals per 10 schools: D11 8.8, D6 8.7, D7 5.8, D3 3.5, D1 3.3.)
  Score: total placement points, as now (sum).
- Over a window: plain average of season values (each season once). NO shrinkage toward district/state (Brock: unfair,
  and short windows). Keep a minimum-seasons rule for ranking and show the season count.
- "RTG" stays for wrestlers only.
- Remove the wrestler-ratings table from the list card; band off.

Steps
1. Install the -700 production ratings; rebuild.
2. Decide with Brock: show first-round wrestlers' ratings again (they are real estimates now). Negative values exist
   (about 5% of all wrestler-seasons, all first-round kids); discuss display (show, or show as "<0").
3. build_units.js: Strength (dual-meet lineup equivalent with forfeits), Talent, Score per school-season, rolled up to
   district and region; remove the coverage estimator / FILL placeholder; app lists + pages + rankings use the three
   names with one-line definitions; remove the wrestler-ratings table.
4. Check D11 vs D7 vs D3 on all three; screenshots of lists, a few schools; before/after for Brock and top wrestlers.
5. Update About (unit ratings section, the three numbers, the first-round rule), then publish once.
