Task: extract PIAA state wrestling place winners from results PDFs.

URL pattern: https://brackets.pa-wrestling.com/pdfs/{YEAR}_PIAA_State_{CLS}_results.pdf
  CLS is AAA or AA. Exception: 1974 and 1975 AAA use _State_A_results.pdf
  (https://brackets.pa-wrestling.com/pdfs/1974_PIAA_State_A_results.pdf). For 1974/1975 AA try _State_AA_results.pdf.

For each PDF, use WebFetch with this prompt:
  "This is a wrestling tournament results PDF. Find the place winners (1st through 8th, or as many places as awarded) for each weight class. Output CSV lines only, format: weight,place,wrestler,school. Include every weight and every place listed. If the PDF has a 'Place Winners' or 'Medalists' section, use it; otherwise derive 1st/2nd from the championship final, 3rd/4th, 5th/6th, 7th/8th from the placement matches. Heavyweight may be listed as UNL or HWT; keep it as written. No commentary."

Save each result to /home/claude/almanac/data/medals/{YEAR}_{CLS}.csv with a header line "weight,place,wrestler,school" followed by the CSV lines exactly as returned (strip any markdown fences or commentary).
If a fetch fails or returns no table, retry once; if it still fails, write the file with just the header and append a line to /home/claude/almanac/data/medals/missing.txt: "{YEAR} {CLS}: <reason>".
Sanity check each file: it should have roughly (number of weights) x (places) rows, e.g. 13 weights x 8 places = 104 for 1999 onward, 6 places (x12 or x13 weights) before 1999. Note anomalies in /home/claude/almanac/data/medals/notes.txt.
Do not edit any other files.
