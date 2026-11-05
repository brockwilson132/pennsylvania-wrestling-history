# PA Wrestling Almanac, second concept: The Path

## One idea
Every result in Pennsylvania wrestling is a step on one path: **District → Regional → State**. A wrestler walks it each season; a program is the sum of its wrestlers' paths; a district is the sum of its programs'. The whole app is built from that single object, the *appearance*: one wrestler, one season, one weight, one level, one place.

## One visual grammar
- **Levels run left to right.** District, Regional, State. Always in that order, always the same width.
- **Color is a medal.** Gold, silver, bronze, copper for 1st–4th; steel for 5th–8th. A Q is a qualifier who did not place. Nothing else is colored.
- **Identity is a name and a mark.** School badge, district tag, wrestler name. Never a hue.
- **Time runs left to right too**, in seasons or in grades (FR SO JR SR).

## Five pieces, used everywhere
1. **Ladder** (a wrestler): three rows, District / Regional / State, four columns, FR / SO / JR / SR. Medals in the cells.
2. **Funnel** (a program, district, season or the state): how many started at districts, placed, reached regionals, reached states, medaled, won. Conversion between tiers is the measure of depth.
3. **Season strip** (any unit over time): one bar per season, height is share of points, color is team finish.
4. **Board** (any unit by weight): 14 weights across, levels down, the best result in each cell.
5. **Shelf**: medal counts by metal, with points.

## Three numbers, one set of columns
Era (all-time share), Power (now, seven-season half-life), Score (placement points). Every ranking table, at every level, shows the same columns in the same order: Era, Power, Score, Medals, 1st, 2nd, 3rd, 4th, 5th–8th, Placed %, Trend, team titles.

## Pages (same skeleton on every entity page)
Header → headline numbers → Funnel → Season strip → Board → Teams/people → tables.
- Home: the state's path this season and all-time, Power and Era top tens, the all-time first team, the map.
- Programs (ranking), Program page.
- Districts (map + ranking), District page (same skeleton as Program).
- Seasons, Season page: official standings with each school's wrestlers on the weight axis, D/R/S.
- Weights: one weight at a time; wrestlers, programs, districts as separate views, never mixed.
- Wrestlers, Wrestler page.

## Scope switch
Class AAA / Class AA / All. Pre-1974 seasons count toward each school's later class.

## Data status
State: complete (places, qualifiers, grades, official team scores from 1976). Regional: place for every state qualifier since 1951 (the state seed). District: place for every state qualifier before 1951; full district brackets arriving from the archive download. The mock marks estimated district cells until then.
