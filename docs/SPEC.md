# PA Wrestling Almanac: rebuild spec

## The idea

One question per page, one way of drawing, and color with one meaning.

- **Success is measured in medals.** Every state place earns points: 16, 12, 9, 7, 5, 3, 2, 1 for 1st through 8th. Titles and depth count together; a 1st is worth sixteen 8ths.
- **Color means a medal.** 1st gold, 2nd silver, 3rd bronze, 4th copper, 5th pewter, 6th steel, 7th gunmetal, 8th onyx. Nothing else on the page is colored.
- **Who is named, not colored.** Schools carry their badge or logo. Districts carry a small Pennsylvania map with the district lit, a fixed-width tag (D1–D12) and a short regional name.
- **Weight is read as share.** At each weight class: what share of the state's points went to this school or district, against its share overall. The bar is split by medal, so you see where they win and how.

## Two numbers

- **All-time** (era score): a program's share of the points available each season, summed, times 100. Fair across eras with different lineup sizes and numbers of places.
- **Now**: the same with a seven-season half-life (one roster generation).

## Pages

1. **Home.** A summary that introduces each lens: the medal key, programs on top now, districts by medals, where each district wins on the scale, and the latest season's team race.
2. **Rankings.** Programs and districts, one table each, sortable: All-time, Now, medals by metal, points.
3. **Program** (same layout for a school and a district). Header numbers; the mat, now colored by medal; where on the scale; wrestlers; for districts, its schools and, for District 11, its own tournament history.
4. **Season.** One year: the team race on a shared weight axis (medals in place), the district race, and each final.
5. **Records.** Dynasties and runs, best seasons, finals records, four-time medalists.
6. **About.** Method, sources and gaps.

## Dropped

The Weights tab (its idea now lives in every program page and on Home), the ledger, district colors, and the switches for level, champions or medalists, color by and mat or ledger. One scope switch remains: Class AAA, Class AA, or the single-class era (1938–73).

## Hosting

Static files in `site/`, served by GitHub Pages. Logos are files in `site/logos/` listed in `site/logos/manifest.js`; `tools/logo-studio.html` turns an image into a logo file for the repo, so only the repo owner can change them.
