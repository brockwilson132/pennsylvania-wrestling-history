# Are some districts or regions mis-rated? (calibration check, Nov 2026)

Analysis only; nothing in the app changed. Scripts: `tools/calib_residuals.py`, `tools/calib_offsets.py`.
Inputs: `data/brackets/bouts.csv`, `data/difficulty/wrestler_seasons.csv` (season ratings, ratings v3).

## Method
State tournament bouts 1990–2026 (the only place every district meets), forfeits/injury/DQ dropped. Each bout's
expected result comes from the two wrestlers' season ratings (Elo scale, 400 points ≈ 10:1). Two views:

1. Residuals (actual − expected wins) summed by the wrestler's district and region.
2. A logistic model on **cross-region** state bouts only (24,786 bouts): P(win) uses rating difference plus a
   per-region offset (NE fixed at 0), optionally plus a term for "this wrestler has no district bracket on file".
   An offset of +X means that region's wrestlers win at states as if they were X points better than rated.

Approximate 95% intervals are ±10–12 points per region (AAA and AA), ±9 for the coverage term in AAA, ±24 in AA.

## Findings
**AAA: the South West (WPIAL, D7) and South Central (D3) are under-rated; the cause is mostly missing district brackets.**

| AAA, cross-region state bouts | NE | NW | SC | SE | SW |
|---|---|---|---|---|---|
| Region offset 1990–2026 | 0 | −19 | **+57** | +5 | **+85** |
| Region offset 2011–2026 | 0 | −19 | **+68** | +23 | **+103** |
| With a "no district bracket" term (+59 ±9) | 0 | −21 | −2 | −11 | +26 |
| 2025–26 only (full WPIAL brackets on file; n=378, ±45) | 0 | 0 | +38 | +55 | 0 |

- Every SW and SC AAA state entrant lacks a district bracket (the archive has almost no D7/D3 AAA district files);
  about 45% of AAA state-bout sides overall. Wrestlers with no district bouts get fewer rated bouts per season, so the
  season fit shrinks them harder toward their prior and they come out under-rated. Adding a single coverage term
  (+59 points for a wrestler with no district bracket, identified mainly by District 1 AAA seasons that are partly
  missing) absorbs SC entirely and most of SW, leaving SW at +26.
- In 2025–26, the only WPIAL AAA seasons with full district brackets, the SW offset is ~0 (wide interval), which is
  consistent with coverage being the cause.
- Held-out test: offsets fitted on 1990–2017 improve 2018–26 cross-region state log loss from 0.4312 to 0.4228 (AAA).
- Per-district residual tables (all bouts, not just cross-region) agree: at states every AAA district with brackets on
  file shows a negative residual and the positive mass sits with wrestlers whose district is unknown (D3/D7).

**AA: no meaningful regional bias.** Offsets are within ±20 of NE and do not improve held-out log loss
(0.4261 → 0.4273). AA coverage is ~96% complete; the coverage term (+79 ±24) rests on few wrestlers.

**Regionals** (within-region, cross-district): residuals are dominated by the same shrinkage pattern (stronger
districts slightly positive, weak ones negative, e.g. AAA D11 +50, D12 −80, D8 −160 points), which is expected
regression-to-prior for very strong/very weak fields and is not a coverage effect; treat with caution.

## Effect on D7 vs D11 schools (estimate)
WPIAL AAA wrestlers are under-rated by roughly 60–100 points at states. School ratings average the lineup's season
ratings, so D7 AAA school ratings would rise by a similar amount: Canon-McMillan ~1200 → ~1270–1300 against Easton
1380. The gap narrows by about half; the remainder is a real difference in this data (D11's lineups are deeper).

## Fix (implemented, v4 in docs/DIFFICULTY.md section 8)
`tools/ratings.py` now gives AAA wrestler-seasons with no district bracket on file a coverage-aware prior. The shift is
+131 / +92 / +83 for pre-1990 / 1990–2004 / 2005+, fitted on pre-2018 regional and state bouts between covered and
uncovered wrestlers. AA is not shifted (an AA shift made the AA held-out test worse).

| | before | after |
|---|---|---|
| AAA held-out 2018–26 cross-region state log loss (no offsets) | 0.4312 | **0.4183** |
| AAA region offsets 1990–2026 vs NE: SW / SC | +85 / +57 | +17 / −12 |
| AAA held-out-fitted offsets: SW / SC | +77 / +55 | +11 / −11 |
| AAA no-district-bracket term | +59 ±3 | +4 ±1 |
| AA held-out cross-region log loss | 0.4261 | 0.4286 |
| AA offsets: SC / SE / SW | −18 / −20 / −14 | −21 / −28 / −15 |

SC is now within noise of NE. SW stays slightly positive (+11 to +17, a few standard errors). NW (−22) and SE (−13)
were mildly negative before the fix and still are.

AAA school ratings, all-time / since 2017:

| | before | after |
|---|---|---|
| Canon-McMillan | 1204 / 1230 | 1212 / 1236 |
| Waynesburg Central | 1163 / 1220 | 1172 / 1230 |
| North Allegheny | 1173 / 1163 | 1183 / 1176 |
| Cumberland Valley | 1194 / 1124 | 1218 / 1132 |
| Central Dauphin | 1183 / 1196 | 1206 / 1212 |
| Easton | 1377 / 1304 | 1328 / 1254 |
| Nazareth | 1374 / 1477 | 1323 / 1434 |
| District 7 | 1452 / 1548 | 1491 / 1569 |
| District 3 | 1453 / 1443 | 1508 / 1477 |
| District 11 | 1520 / 1542 | 1475 / 1502 |
| District 1 | 1473 / 1466 | 1443 / 1482 |

Schools moved less than the earlier estimate (Canon-McMillan ~1270–1300). The units coverage estimator already
corrected D7 school ratings for missing brackets, and re-anchoring the scale lowered D11. The Canon-McMillan–Easton
gap narrows from 173 to 116 points. D3 and D7 now rate above D11 as districts.
