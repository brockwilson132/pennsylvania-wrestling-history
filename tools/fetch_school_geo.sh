#!/usr/bin/env bash
# Downloads Pennsylvania school locations (latitude/longitude) from the NCES EDGE geocode services, public and private
# schools, 2023-24, into ~/Projects/pa-wrestling/sources/geo/. Then run tools/build_school_geo.js on them.
#   bash tools/fetch_school_geo.sh            (from the repo folder, or pass an output folder as $1)
# Sources: NCES EDGE "Public School Locations 2023-24" and "Private School Locations 2023-24"
#   https://catalog.data.gov/dataset/public-school-locations-2023-24
#   https://catalog.data.gov/dataset/private-school-locations-2023-24
set -eu
OUT="${1:-$HOME/Projects/pa-wrestling/sources/geo}"
mkdir -p "$OUT"
fetch() { # layer url, output file
  python3 - "$1" "$2" <<'PY'
import json, sys, time, urllib.parse, urllib.request
base, out = sys.argv[1], sys.argv[2]
rows, off = [], 0
while True:
    q = urllib.parse.urlencode({'where': "STATE='PA'", 'outFields': '*', 'returnGeometry': 'false', 'f': 'json',
                                'resultOffset': off, 'resultRecordCount': 2000, 'orderByFields': 'OBJECTID'})
    req = urllib.request.Request(base + '/query?' + q, headers={'User-Agent': 'pa-wrestling-history (research)'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as r: d = json.load(r); break
        except Exception as e:
            print('  retry', attempt + 1, e); time.sleep(5 * (attempt + 1))
    else: raise SystemExit('gave up on ' + base)
    if 'error' in d: raise SystemExit(str(d['error']))
    feats = d.get('features', []); rows += [f['attributes'] for f in feats]; off += len(feats)
    print('  ', len(rows), 'rows');
    if not feats or not d.get('exceededTransferLimit'): break
json.dump(rows, open(out, 'w'))
print('wrote', out, len(rows), 'schools')
PY
}
echo "public schools"
fetch "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2324/MapServer/0" "$OUT/pa_public.json"
echo "private schools"
fetch "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PRIVATESCH_2324/MapServer/0" "$OUT/pa_private.json"
echo "done: $OUT"
