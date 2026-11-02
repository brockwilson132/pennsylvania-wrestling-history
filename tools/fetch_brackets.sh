#!/usr/bin/env bash
# Downloads the PIAA state and district bracket PDFs from PA-Wrestling.com's archive
# into ./brackets, skipping files that don't exist. Run it on your own computer:
#   bash tools/fetch_brackets.sh
# then zip the folder (zip -r brackets.zip brackets) and attach it in the chat.
# It is polite to the server: one file at a time with a short pause.
set -u
BASE="https://brackets.pa-wrestling.com/pdfs"
OUT="${1:-brackets}"
mkdir -p "$OUT/state" "$OUT/district"
get() { # url, dest
  [ -s "$2" ] && return 0
  code=$(curl -s -L -o "$2" -w "%{http_code}" "$1")
  if [ "$code" != "200" ] || ! head -c 4 "$2" | grep -q "%PDF"; then rm -f "$2"; return 1; fi
  echo "got $(basename "$2")"; sleep 0.4
}
# state: one class 1938-1973, then AAA and AA (1974-75 sheets may be labeled A and B)
for y in $(seq 1938 1973); do get "$BASE/${y}_PIAA_State_results.pdf" "$OUT/state/${y}_single.pdf"; done
for y in $(seq 1974 2026); do
  for c in AAA AA; do get "$BASE/${y}_PIAA_State_${c}_results.pdf" "$OUT/state/${y}_${c}.pdf"; done
  if [ "$y" -le 1975 ]; then
    get "$BASE/${y}_PIAA_State_A_results.pdf" "$OUT/state/${y}_A.pdf"
    get "$BASE/${y}_PIAA_State_B_results.pdf" "$OUT/state/${y}_B.pdf"
  fi
done
# districts 1-12, AAA and AA, 1974 on
for d in $(seq 1 12); do for y in $(seq 1974 2026); do for c in AAA AA; do
  get "$BASE/${y}_District${d}_${c}_results.pdf" "$OUT/district/${y}_D${d}_${c}.pdf"
done; done; done
echo "done: $(ls "$OUT/state" | wc -l) state files, $(ls "$OUT/district" | wc -l) district files"
