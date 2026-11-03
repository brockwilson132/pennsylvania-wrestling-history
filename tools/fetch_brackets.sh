#!/usr/bin/env bash
# Downloads PIAA post-season bracket PDFs from PA-Wrestling.com's archive into
# ~/Projects/pa-wrestling/brackets: state, district and regional tournaments.
# Safe to re-run: existing files are skipped, known-missing names are skipped.
#   bash ~/Projects/pa-wrestling/fetch_v3.sh
#
# v3 fix: a name that doesn't exist on the archive comes back as HTTP 200 with an
# HTML page, not a 404. v2 treated that as a throttle and slept 15+60+135+240 s per
# name, which looked like a hang. Now any 200 that isn't a PDF is recorded as missing.
# Only 429 / 5xx / connection failures back off, and every request prints a line.
set -u
BASE="https://brackets.pa-wrestling.com/pdfs"
OUT="${1:-$HOME/Projects/pa-wrestling/brackets}"
mkdir -p "$OUT/state" "$OUT/district" "$OUT/regional" "$OUT/log"
MISS="$OUT/log/missing.txt"; touch "$MISS"
LOG="$OUT/log/fetch.log"
n_got=0; n_miss=0
say() { echo "$(date +%H:%M:%S) $*" | tee -a "$LOG"; }
get() { # name-without-extension, dest
  local url="$BASE/$1_results.pdf" dest="$2" tries=0 code
  [ -s "$dest" ] && return 0
  grep -qxF "$1" "$MISS" && return 1
  while :; do
    code=$(curl -s -L --max-time 45 -A "Mozilla/5.0 (pa-wrestling-history archive sync)" -o "$dest" -w "%{http_code}" "$url")
    if [ "$code" = "200" ] && head -c 4 "$dest" 2>/dev/null | grep -q "%PDF"; then
      n_got=$((n_got+1)); say "got  $(basename "$dest")  ($n_got new, $n_miss missing)"; sleep 0.7; return 0
    fi
    rm -f "$dest"
    case "$code" in
      200|404|403|410) n_miss=$((n_miss+1)); echo "$1" >> "$MISS"; say "miss $1 (http $code)"; sleep 0.3; return 1 ;;
      *) tries=$((tries+1))
         if [ $tries -ge 4 ]; then say "gave up on $1 (http $code), will retry next run"; return 1; fi
         say "http $code on $1, waiting $((tries*20))s"; sleep $((tries*20)) ;;
    esac
  done
}
# try a list of name variants for one tournament-year; stop at the first that exists
try() { local dest="$1"; shift; for n in "$@"; do get "$n" "$dest" && return 0; done; return 1; }
cls() { # year, class -> the class token used that year (1974-75 used A and B)
  if [ "$1" -le 1975 ]; then [ "$2" = "AAA" ] && echo A || echo B; else echo "$2"; fi; }

say "start: $(ls "$OUT/state" | wc -l) state, $(ls "$OUT/district" | wc -l) district, $(ls "$OUT/regional" | wc -l) regional on disk"

# ---- regionals first (nothing downloaded yet) ----
for y in $(seq 1974 2026); do for c in AAA AA; do k=$(cls $y $c)
  for r in North_East North_West South_Central South_East South_West West; do
    try "$OUT/regional/${y}_${r}_${c}.pdf" "${y}_${r}_${k}" "${y}_${r}_${c}" "${y}_${r}_${k}_Regional" "${y}_${r}_${c}_Regional"
  done
done; done
for y in $(seq 1951 1973); do for r in North_East South_East South_West Central_North_West; do try "$OUT/regional/${y}_${r}_single.pdf" "${y}_${r}" "${y}_${r}_Regional"; done; done
for y in 2021; do for r in East West; do for c in AAA AA; do try "$OUT/regional/${y}_${r}_${c}_Super.pdf" "${y}_${r}_${c}_Super_Regional" "${y}_Super_Region_${r}_${c}" "${y}_${r}_${c}_Super"; done; done; done
for y in $(seq 2000 2026); do
  try "$OUT/regional/${y}_D2-12_AA_Sub.pdf" "${y}_District2-12_AA_Sub-Regional" "${y}_District_2-12_AA_Sub-Regional"
  try "$OUT/regional/${y}_D2-4_AAA_Sub.pdf" "${y}_District2-4_AAA_Sub-Regional"
  try "$OUT/regional/${y}_D5-6_AA_Sub.pdf" "${y}_District5-6_AA_Sub-Regional"
  try "$OUT/regional/${y}_D6-9_AAA_Sub.pdf" "${y}_District6-9_AAA_Sub-Regional"
done
say "regionals pass done: $(ls "$OUT/regional" | wc -l) files"

# ---- districts, second pass for anything the first run skipped ----
for d in 2 4 5 6 9 10 11 12 3 7 8 1; do for y in $(seq 1974 2026); do for c in AAA AA; do k=$(cls $y $c)
  try "$OUT/district/${y}_D${d}_${c}.pdf" "${y}_District${d}_${k}" "${y}_District${d}_${c}"
done; done; done
for y in $(seq 1974 2026); do k=$(cls $y AAA); kb=$(cls $y AA)
  for part in North South Central East West; do try "$OUT/district/${y}_D1_AAA_${part}.pdf" "${y}_District1_${k}_${part}" "${y}_District1_AAA_${part}" "${y}_District1_${part}_${k}"; done
  try "$OUT/district/${y}_D1-12_AA.pdf" "${y}_District1-12_${kb}" "${y}_District1-12_AA"
  try "$OUT/district/${y}_D4-9_AAA.pdf" "${y}_District4-9_${k}" "${y}_District4-9_AAA"
  try "$OUT/district/${y}_D5-9_AAA.pdf" "${y}_District5-9_${k}" "${y}_District5-9_AAA"
  try "$OUT/district/${y}_D9-10_AAA.pdf" "${y}_District9-10_${k}" "${y}_District9-10_AAA"
  try "$OUT/district/${y}_D6-9.pdf" "${y}_District6-9" "${y}_District6-9_AAA"
done
for d in $(seq 1 12); do for y in $(seq 1938 1973); do try "$OUT/district/${y}_D${d}_single.pdf" "${y}_District${d}"; done; done

# ---- state (fills any gap) ----
for y in $(seq 1938 1973); do try "$OUT/state/${y}_single.pdf" "${y}_PIAA_State"; done
for y in $(seq 1976 2026); do for c in AAA AA; do try "$OUT/state/${y}_${c}.pdf" "${y}_PIAA_State_${c}"; done; done

say "done: $(ls "$OUT/state" | wc -l) state, $(ls "$OUT/district" | wc -l) district, $(ls "$OUT/regional" | wc -l) regional files; $n_got new this run, $(wc -l < "$MISS") names known missing"
