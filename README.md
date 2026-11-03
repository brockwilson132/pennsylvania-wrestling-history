# PA Wrestling Almanac

Every Pennsylvania state wrestling champion and place winner since 1938, by school, district, weight and season.

Success is counted in medals: every state place earns points (16, 12, 9, 7, 5, 3, 2, 1 for 1st–8th), so a program's depth counts along with its titles. Color on the site means a medal and nothing else. See `docs/SPEC.md` for the design.

## Layout

- `site/` the site: static files, no build step. Open `site/index.html` or serve the folder.
  - `app/model.js` data and scoring · `app/ui.js` medals, district maps, badges · `app/charts.js` the mat, weight and race charts · `app/pages.js` pages and router
  - `data.js` champions and history, `medals.js` every place winner, `badges.js` school colors, `pa-map.js` district shapes, `logos/` school logos
- `data/` source data. `data/medals/{YEAR}_{AAA|AA|single}.csv` holds every state place winner; `data/brackets/` holds every state entrant and the official team scores, parsed from the bracket PDFs.
- `tools/`
  - `node tools/build_medals.js` rebuilds `site/medals.js` from the CSVs
  - `bash tools/fetch_brackets.sh` downloads the bracket PDFs (run on your own computer); `python3 tools/parse_state.py <folder>` reads them into `data/brackets/*.csv`; `node tools/build_brackets.js` builds `site/brackets.js` (qualifiers, grades, team scores)
  - `node tools/build_map.js` rebuilds `site/pa-map.js` (needs `d3`, `topojson-client`, `us-atlas`)
  - `python3 tools/make_logo.py "School" image.png` adds a logo to `site/logos/`
  - `node tools/shoot.js` and `node tools/interact.js` are the Playwright checks (layout at phone and desktop width, interactions)
- `archive/` earlier versions.

## Publishing

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main`. Turn it on once in the repo's Settings → Pages → Source: GitHub Actions. On a free GitHub plan, Pages needs the repository to be public.

## Sources

PA-Wrestling.com's PIAA championship archive. Gaps: the 1954 one-class results sheet could not be retrieved, and 1975 places are incomplete.

## History

The `v4-snapshot-save` branch holds the version published before the rebuild.
