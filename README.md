# PA Wrestling Almanac

A history of Pennsylvania high school wrestling: every PIAA state champion and state medalist since 1938, by district, school and weight, with District 11 and Northeast Regional history.

## Layout

- `site/` the app. Static files: open `site/index.html` or serve the folder.
- `data/` source data. `data/medals/{YEAR}_{AAA|AA|single}.csv` holds every state place winner; `tools/build_medals.js` turns them into `site/medals.js`.
- `tools/` build script and the Playwright checks used during development (layout audit at phone width, interaction and touch checks).
- `archive/` earlier versions, kept for reference.

## Sources

Results from PA-Wrestling.com's PIAA championship archive (results sheets for each season). Gaps: the 1954 single-class sheet could not be retrieved, and 1975 places are incomplete.

## Status

The `v4-snapshot` tag is the version published as a Claude artifact on 2 November 2026. A rebuild is in progress. In this snapshot, school logos live in the Claude artifact's owner-only storage and are not in the repo; the rebuild moves them into `site/logos/` so the site can run on GitHub Pages.
