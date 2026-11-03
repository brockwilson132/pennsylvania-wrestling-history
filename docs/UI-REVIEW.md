# UI review, 2 November 2026

Reviewed every page at 1440 and 390 px after the medals rebuild. Ordered by how much each item would improve the site.

## 1. Pages that do too much
- **District page.** The mat is solid for a big district; now titles are bright and other medals dimmed. Still, the season card lists every medalist (27 rows for WPIAL in 2026). Collapse to the team race line plus titles, with "all medalists" behind a toggle.
- **Program page order.** Numbers, shelf, mat, weights, wrestlers is right for a school. For a district, "Its programs" matters more than the mat and should come second.
- **Season page.** Shows up to 40 teams; show 15 and a "show all". Finals list is long on a phone; two columns on desktop would halve it.

## 2. Reading the numbers
- Era score scales differ: programs top out near 200, districts near 2,000. Add "of N" context on every card and say which scale a number is on.
- Trend is unlabeled in sign: "▲ 22" needs "pts" or a tooltip saying "era score, last 10 vs prior 10".
- Ties in "The great careers" (many at 64): add a tie-break on titles, then earlier year, and show it.
- Finals records at an 8-final threshold produce 9–1 lines from small samples; raise to 12 or show the count beside the record.

## 3. Phone
- The header takes about a third of the first screen (brand, class switch, nav). Collapse the brand and class switch to one row; nav now fades at the edge to show it scrolls.
- Tables hide columns on phones (sparkline, medals). Add a per-row expand so nothing is unreachable.
- Weight chart x-axis labels every other class on narrow screens (done).

## 4. Consistency
- Buttons: `.btn`, `.seg`, `.linkish` and table-header buttons have four different looks. Pick two: segmented switch and plain button.
- Panel headings use `h3` in panels but `h2` in sections with the same visual weight. Make section heads clearly bigger.
- District identity: map + tag + name in most places, tag alone in tables, name alone in tiles. Rule: tag + name everywhere, map only in headers and the home map.

## 5. Missing pieces
- No favicon or social image; no document title per page; no "not found" page for a bad hash.
- No keyboard focus styles beyond the browser default on a dark background.
- Logos: files exist for Nazareth, Easton, Northampton; use them in school page headers only.

## 6. Data work that unlocks the next views
- State qualifiers from the 142 state PDFs (Q marks on wrestler, school and season pages; qualifier-to-medal conversion as a program metric).
- District results (districts 1, 6, 9, 10, 11 first), then District 3's own list, then regionals where they exist.
