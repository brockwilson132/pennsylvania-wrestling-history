/*
 * SchoolBadge - original badge system for a PA high-school wrestling dashboard.
 * Self-contained, no dependencies. Exposes window.SchoolBadge.
 *
 *   SchoolBadge.svg(school, {size=32, variant:'chip'|'crest', title=true}) -> SVG string
 *   SchoolBadge.colorFor(school, mode='light'|'dark')                        -> "#rrggbb" chart fill
 *   SchoolBadge.palette([schools], mode)    -> {school: "#hex"}  de-conflicted for any list
 *   SchoolBadge.identity(school)            -> identity record (or null if unknown)
 *   SchoolBadge.escape(str)                 -> XML/HTML-escaped string
 *
 * Badges are ORIGINAL designs (shield crest with mat-circle ring and singlet
 * chevron stripes; circular "mat" chip). They do not reproduce any school logo.
 * Colors are approximations of each school's named colors.
 */
(function (root) {
  'use strict';

  var DATA = [{"school": "Nazareth", "colors_named": "blue, white, black", "aliases": ["Nazareth Area", "Nazareth Area High School"], "mascot": "Blue Eagles", "primary": "#1F4E9C", "secondary": "#FFFFFF", "accent": "#111111", "abbr": "NAZ", "confidence": "high"}, {"school": "Northampton", "colors_named": "orange and black", "aliases": ["Northampton Area", "Northampton Area High School", "Konkrete Kids"], "mascot": "Konkrete Kids", "primary": "#E87722", "secondary": "#111111", "accent": null, "abbr": "NOR", "confidence": "high"}, {"school": "Easton", "colors_named": "red and white", "aliases": ["Easton Area", "Easton Area High School", "Easton Red Rovers"], "mascot": "Red Rovers", "primary": "#C8102E", "secondary": "#FFFFFF", "accent": null, "abbr": "EAS", "confidence": "high"}, {"school": "Bethlehem Catholic", "colors_named": "brown and gold", "aliases": ["Becahi", "Bethlehem Catholic High School", "Beth Catholic"], "mascot": "Golden Hawks", "primary": "#4E2A1E", "secondary": "#C9A227", "accent": null, "abbr": "BC", "confidence": "high"}, {"school": "Bethlehem Liberty", "colors_named": "burgundy, navy, white", "aliases": ["Liberty High School", "Liberty (Bethlehem)"], "mascot": "Hurricanes", "primary": "#7A1F3D", "secondary": "#1B2A4A", "accent": "#FFFFFF", "abbr": "LIB", "confidence": "high"}, {"school": "Parkland", "colors_named": "red and gray", "aliases": ["Parkland High School", "Parkland Trojans"], "mascot": "Trojans", "primary": "#C8102E", "secondary": "#8A8D8F", "accent": null, "abbr": "PKL", "confidence": "high"}, {"school": "Bethlehem Freedom", "colors_named": "black and gold", "aliases": ["Freedom High School", "Freedom (Bethlehem)"], "mascot": "Patriots", "primary": "#111111", "secondary": "#F2B705", "accent": null, "abbr": "FRE", "confidence": "high"}, {"school": "Saucon Valley", "aliases": ["Saucon Valley High School"], "mascot": "Panthers", "primary": "#1A1A1A", "secondary": "#9EA2A2", "accent": null, "abbr": "SV", "confidence": "med"}, {"school": "Stroudsburg", "aliases": ["Stroudsburg High School", "Stroudsburg Mounties", "Stroudsburg Mountaineers"], "mascot": "Mountaineers", "primary": "#7B1E3A", "secondary": "#FFFFFF", "accent": null, "abbr": "STR", "confidence": "high"}, {"school": "William Allen", "aliases": ["Allentown Allen", "William Allen High School", "Allentown William Allen"], "mascot": "Canaries", "primary": "#FFD200", "secondary": "#1F3F8F", "accent": null, "abbr": "WA", "confidence": "high"}, {"school": "Blue Mountain", "aliases": ["Blue Mountain High School"], "mascot": "Eagles", "primary": "#14284B", "secondary": "#FFFFFF", "accent": null, "abbr": "BM", "confidence": "high"}, {"school": "Whitehall", "aliases": ["Whitehall High School", "Whitehall-Coplay"], "mascot": "Zephyrs", "primary": "#7A1E2C", "secondary": "#D4A017", "accent": null, "abbr": "WHL", "confidence": "high"}, {"school": "Allentown Dieruff", "aliases": ["Louis E. Dieruff", "Louis E. Dieruff High School"], "mascot": "Huskies", "primary": "#1E4C9A", "secondary": "#8A8D8F", "accent": null, "abbr": "DIE", "confidence": "high"}, {"school": "Emmaus", "aliases": ["Emmaus High School"], "mascot": "Green Hornets", "primary": "#0B6B3A", "secondary": "#F2C230", "accent": null, "abbr": "EMM", "confidence": "high"}, {"school": "Pottsville", "aliases": ["Pottsville Area", "Pottsville Area High School"], "mascot": "Crimson Tide", "primary": "#A6192E", "secondary": "#FFFFFF", "accent": null, "abbr": "POT", "confidence": "high"}, {"school": "Pleasant Valley", "aliases": ["Pleasant Valley High School"], "mascot": "Bears", "primary": "#1D4F91", "secondary": "#FFFFFF", "accent": null, "abbr": "PV", "confidence": "high"}, {"school": "Bangor", "aliases": ["Bangor Area", "Bangor Area High School"], "mascot": "Slaters", "primary": "#800020", "secondary": "#FFFFFF", "accent": null, "abbr": "BAN", "confidence": "high"}, {"school": "East Stroudsburg South", "aliases": ["ES South", "East Stroudsburg High School South", "E. Stroudsburg South"], "mascot": "Cavaliers", "primary": "#4B2E83", "secondary": "#FFFFFF", "accent": null, "abbr": "ESS", "confidence": "high"}, {"school": "Lehighton", "aliases": ["Lehighton Area", "Lehighton Area High School"], "mascot": "Indians", "primary": "#7A1E2C", "secondary": "#FFFFFF", "accent": null, "abbr": "LEH", "confidence": "med"}, {"school": "Southern Lehigh", "aliases": ["Southern Lehigh High School"], "mascot": "Spartans", "primary": "#1C3F94", "secondary": "#FFFFFF", "accent": null, "abbr": "SL", "confidence": "high"}, {"school": "Notre Dame-Green Pond", "aliases": ["Notre Dame (Green Pond)", "Notre Dame Green Pond", "NDGP", "Notre Dame High School (Easton)"], "mascot": "Crusaders", "primary": "#1F3A93", "secondary": "#F1C40F", "accent": null, "abbr": "ND", "confidence": "high"}, {"school": "Pocono Mountain", "aliases": ["Pocono Mountain High School"], "mascot": "Cardinals", "primary": "#C8102E", "secondary": "#FFFFFF", "accent": null, "abbr": "PM", "confidence": "med"}, {"school": "Pocono Mountain East", "aliases": ["PM East", "Pocono Mtn East", "Pocono Mountain East High School"], "mascot": "Cardinals", "primary": "#C8102E", "secondary": "#FFFFFF", "accent": null, "abbr": "PME", "confidence": "high"}, {"school": "Pocono Mountain West", "aliases": ["PM West", "Pocono Mtn West", "Pocono Mountain West High School"], "mascot": "Panthers", "primary": "#1B2A4A", "secondary": "#A7A9AC", "accent": "#FFFFFF", "abbr": "PMW", "confidence": "high"}, {"school": "Allentown Central Catholic", "aliases": ["ACCHS", "Allentown CC"], "mascot": "Vikings", "primary": "#00563F", "secondary": "#FFC72C", "accent": null, "abbr": "ACC", "confidence": "high"}, {"school": "East Stroudsburg", "aliases": ["East Stroudsburg High School", "East Stroudsburg Area"], "mascot": "Cavaliers", "primary": "#4B2E83", "secondary": "#FFFFFF", "accent": null, "abbr": "ES", "confidence": "low"}, {"school": "Hazleton Area", "aliases": ["Hazleton Area High School"], "mascot": "Cougars", "primary": "#C8102E", "secondary": "#A7A9AC", "accent": "#FFFFFF", "abbr": "HAZ", "confidence": "high"}, {"school": "West Hazleton", "aliases": ["West Hazleton High School"], "mascot": "Wildcats", "primary": "#5B6670", "secondary": "#C9CED3", "accent": null, "abbr": "WH", "confidence": "low"}, {"school": "Kiski Area", "aliases": ["Kiski Area High School"], "mascot": "Cavaliers", "primary": "#14284B", "secondary": "#C9A227", "accent": null, "abbr": "KIS", "confidence": "high"}, {"school": "Franklin Regional", "aliases": ["Franklin Regional High School", "Franklin Reg."], "mascot": "Panthers", "primary": "#1F4E9C", "secondary": "#F2B705", "accent": null, "abbr": "FR", "confidence": "high"}, {"school": "Canon-McMillan", "aliases": ["Canon McMillan", "Canon-Mac", "Canon Mac"], "mascot": "Big Macs", "primary": "#1F3F8F", "secondary": "#F2B705", "accent": null, "abbr": "CM", "confidence": "med"}, {"school": "Waynesburg Central", "aliases": ["Waynesburg Central High School"], "mascot": "Raiders", "primary": "#C8102E", "secondary": "#111111", "accent": null, "abbr": "WAY", "confidence": "high"}, {"school": "Council Rock South", "aliases": ["CR South", "Council Rock High School South"], "mascot": "Golden Hawks", "primary": "#14284B", "secondary": "#C9A227", "accent": "#FFFFFF", "abbr": "CRS", "confidence": "high"}, {"school": "Council Rock North", "aliases": ["CR North", "Council Rock High School North"], "mascot": "Indians", "primary": "#1B2A4A", "secondary": "#A7A9AC", "accent": "#FFFFFF", "abbr": "CRN", "confidence": "med"}, {"school": "Central Dauphin", "aliases": ["Central Dauphin High School"], "mascot": "Rams", "primary": "#00703C", "secondary": "#FFFFFF", "accent": null, "abbr": "CD", "confidence": "high"}, {"school": "Cedar Cliff", "aliases": ["Cedar Cliff High School"], "mascot": "Colts", "primary": "#14284B", "secondary": "#C9A227", "accent": "#A7A9AC", "abbr": "CC", "confidence": "high"}, {"school": "Erie Cathedral Prep", "aliases": ["Cathedral Prep", "Erie Prep", "Cathedral Preparatory School"], "mascot": "Ramblers", "primary": "#F26522", "secondary": "#111111", "accent": null, "abbr": "CP", "confidence": "high"}, {"school": "Williamsport", "aliases": ["Williamsport Area", "Williamsport Area High School"], "mascot": "Millionaires", "primary": "#B5122E", "secondary": "#FFFFFF", "accent": null, "abbr": "WMS", "confidence": "high"}, {"school": "Shikellamy", "aliases": ["Shikellamy High School"], "mascot": "Braves", "primary": "#7A1E2C", "secondary": "#FFFFFF", "accent": "#1F3F8F", "abbr": "SHK", "confidence": "high"}, {"school": "Upper Perkiomen", "aliases": ["Upper Perk", "Upper Perkiomen High School"], "mascot": "Indians", "primary": "#1F3F8F", "secondary": "#F2B705", "accent": null, "abbr": "UP", "confidence": "high"}, {"school": "Boyertown", "aliases": ["Boyertown Area", "Boyertown Area Senior High School"], "mascot": "Bears", "primary": "#5B6670", "secondary": "#C9CED3", "accent": null, "abbr": "BOY", "confidence": "low"}, {"school": "Spring-Ford", "aliases": ["Spring Ford", "Spring-Ford Area", "Spring-Ford Area High School"], "mascot": "Rams", "primary": "#002147", "secondary": "#C5B358", "accent": "#FFFFFF", "abbr": "SF", "confidence": "high"}, {"school": "Northern Lebanon", "aliases": ["Northern Lebanon High School", "N. Lebanon"], "mascot": "Vikings", "primary": "#1F3F8F", "secondary": "#F2B705", "accent": null, "abbr": "NL", "confidence": "high"}, {"school": "Bald Eagle Area", "aliases": [], "mascot": "Eagles", "primary": "#1F3F8F", "secondary": "#F2B705", "accent": null, "abbr": "BEA", "confidence": "med"}, {"school": "Altoona", "aliases": ["Altoona Area", "Altoona Area High School"], "mascot": "Mountain Lions", "primary": "#7A1E2C", "secondary": "#FFFFFF", "accent": null, "abbr": "ALT", "confidence": "high"}, {"school": "Penn Hills", "aliases": ["Penn Hills High School"], "mascot": null, "primary": "#C8102E", "secondary": "#F2B705", "accent": null, "abbr": "PH", "confidence": "med"}, {"school": "Mt. Lebanon", "aliases": ["Mount Lebanon", "Mt Lebanon", "Mt. Lebanon High School", "Mt. Lebo"], "mascot": "Blue Devils", "primary": "#1F3F8F", "secondary": "#F2B705", "accent": null, "abbr": "MTL", "confidence": "high"}, {"school": "Thomas Jefferson", "aliases": ["Thomas Jefferson High School", "Thomas Jefferson (Jefferson Hills)"], "mascot": "Jaguars", "primary": "#111111", "secondary": "#F2B705", "accent": null, "abbr": "TJ", "confidence": "med"}, {"school": "Connellsville", "aliases": ["Connellsville Area", "Connellsville Area Senior High School"], "mascot": "Falcons", "primary": "#2251A3", "secondary": "#FFFFFF", "accent": null, "abbr": "CON", "confidence": "high"}, {"school": "Greater Latrobe", "aliases": ["Greater Latrobe Senior High School"], "mascot": "Wildcats", "primary": "#F47920", "secondary": "#111111", "accent": "#FFFFFF", "abbr": "GL", "confidence": "high"}, {"school": "Bishop McDevitt", "aliases": ["Bishop McDevitt (Harrisburg)", "Bishop McDevitt High School"], "mascot": "Crusaders", "primary": "#14284B", "secondary": "#C5B358", "accent": null, "abbr": "BMD", "confidence": "high"}, {"school": "Wilson (West Lawn)", "aliases": ["Wilson High School (West Lawn)"], "mascot": "Bulldogs", "primary": "#C8102E", "secondary": "#FFFFFF", "accent": null, "abbr": "WIL", "confidence": "high"}, {"school": "Lower Dauphin", "aliases": ["Lower Dauphin High School"], "mascot": "Falcons", "primary": "#1F4E9C", "secondary": "#FFFFFF", "accent": null, "abbr": "LD", "confidence": "high"}, {"school": "State College", "aliases": ["State College Area", "State College Area High School"], "mascot": "Little Lions", "primary": "#7A1E2C", "secondary": "#8A8D8F", "accent": null, "abbr": "SC", "confidence": "high"}, {"school": "Owen J. Roberts", "aliases": ["OJR", "Owen J Roberts", "Owen J. Roberts High School"], "mascot": "Wildcats", "primary": "#C8102E", "secondary": "#FFFFFF", "accent": null, "abbr": "OJR", "confidence": "high"}, {"school": "Pennsbury", "aliases": ["Pennsbury High School"], "mascot": "Falcons", "primary": "#F47920", "secondary": "#111111", "accent": null, "abbr": "PEN", "confidence": "high"}, {"school": "Abington Heights", "aliases": ["Abington Heights High School"], "mascot": "Comets", "primary": "#1F4E9C", "secondary": "#FFFFFF", "accent": null, "abbr": "AH", "confidence": "high"}, {"school": "Frazier", "aliases": ["Frazier High School", "Frazier (Perryopolis)"], "mascot": "Commodores", "primary": "#5B6670", "secondary": "#C9CED3", "accent": null, "abbr": "FRZ", "confidence": "low"}, {"school": "Clearfield", "colors_named": "Red and Black", "aliases": [], "mascot": "Bison (Benny the Bison)", "primary": "#c8102e", "secondary": "#111111", "accent": null, "abbr": "CLE", "confidence": "high"}, {"school": "Trinity", "colors_named": "Green and White", "aliases": [], "mascot": "Shamrocks", "primary": "#15803d", "secondary": "#ffffff", "accent": null, "abbr": "TRI", "confidence": "high"}, {"school": "North Allegheny", "colors_named": "Black and Gold", "aliases": [], "mascot": "Tigers", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "NA", "confidence": "high"}, {"school": "Canonsburg", "colors_named": "Blue and Gold (Canon-McMillan)", "aliases": [], "mascot": "Highlanders (Big Macs)", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "CAN", "confidence": "medium"}, {"school": "Shamokin", "colors_named": "Purple and White", "aliases": [], "mascot": "Indians", "primary": "#5b2d8e", "secondary": "#ffffff", "accent": null, "abbr": "SHA", "confidence": "high"}, {"school": "Benton", "colors_named": "Orange", "aliases": [], "mascot": "Tigers", "primary": "#e87722", "secondary": "#ffffff", "accent": null, "abbr": "BEN", "confidence": "medium"}, {"school": "Bald Eagle Nittany", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Eagles", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "BEN", "confidence": "medium"}, {"school": "Montoursville", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Warriors", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "MON", "confidence": "high"}, {"school": "Elmer L. Meyers", "colors_named": "Royal Blue and Gold", "aliases": [], "mascot": "Mohawks", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "ELM", "confidence": "high"}, {"school": "Shaler", "colors_named": "Blue and White with red secondary", "aliases": [], "mascot": "Titans", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": "#c8102e", "abbr": "SHA", "confidence": "high"}, {"school": "Hempfield Area", "colors_named": "Royal Blue and Silver", "aliases": [], "mascot": "Spartans", "primary": "#1f4e9c", "secondary": "#c0c0c0", "accent": null, "abbr": "HA", "confidence": "high"}, {"school": "DuBois", "colors_named": "Red, Black and White", "aliases": [], "mascot": "Beavers", "primary": "#c8102e", "secondary": "#111111", "accent": "#ffffff", "abbr": "DUB", "confidence": "high"}, {"school": "Tyrone", "colors_named": "Orange and Black", "aliases": [], "mascot": "Golden Eagles", "primary": "#e87722", "secondary": "#111111", "accent": null, "abbr": "TYR", "confidence": "medium"}, {"school": "Jefferson-Morgan", "colors_named": "Orange and Black", "aliases": [], "mascot": "Rockets", "primary": "#e87722", "secondary": "#111111", "accent": null, "abbr": "JM", "confidence": "high"}, {"school": "Derry Area", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Trojans", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "DA", "confidence": "high"}, {"school": "North Schuylkill", "colors_named": "Crimson Red and Royal Blue", "aliases": [], "mascot": "Spartans", "primary": "#dc143c", "secondary": "#1f4e9c", "accent": null, "abbr": "NS", "confidence": "medium"}, {"school": "Line Mountain", "colors_named": "Royal Blue and Gold with trim of Red", "aliases": [], "mascot": "Eagles", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": "#c8102e", "abbr": "LM", "confidence": "high"}, {"school": "Burrell", "colors_named": "Blue and White", "aliases": [], "mascot": "Buccaneers", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "BUR", "confidence": "medium"}, {"school": "Bishop McCort", "colors_named": "Red and Gold (fetched text; mascot wording garbled)", "aliases": [], "mascot": "Crushers (from search-result URL slug only)", "primary": "#c8102e", "secondary": "#c9a227", "accent": null, "abbr": "BM", "confidence": "low"}, {"school": "Grove City", "colors_named": "Gold and Black", "aliases": [], "mascot": "Eagles (from search-result URL slug only)", "primary": "#c9a227", "secondary": "#111111", "accent": null, "abbr": "GC", "confidence": "medium"}, {"school": "Cumberland Valley", "colors_named": "Red, Black and White", "aliases": [], "mascot": "Eagles", "primary": "#c8102e", "secondary": "#111111", "accent": "#ffffff", "abbr": "CV", "confidence": "high"}, {"school": "Muncy", "colors_named": "Blue and White", "aliases": [], "mascot": "Indians", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "MUN", "confidence": "high"}, {"school": "Manheim Central", "colors_named": "Maroon and Gray", "aliases": [], "mascot": "Barons", "primary": "#7a1f3d", "secondary": "#8a8d8f", "accent": null, "abbr": "MC", "confidence": "high"}, {"school": "North Penn", "colors_named": "Navy and Columbia Blue", "aliases": [], "mascot": "Knights", "primary": "#1b2a4a", "secondary": "#5fa8e0", "accent": null, "abbr": "NP", "confidence": "medium"}, {"school": "Wilson Area", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Warriors", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "WA", "confidence": "high"}, {"school": "Southern Columbia", "colors_named": "Black and Gold", "aliases": [], "mascot": "Tigers", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "SC", "confidence": "high"}, {"school": "Wyalusing", "colors_named": "Green and Gold", "aliases": [], "mascot": "Rams", "primary": "#15803d", "secondary": "#c9a227", "accent": null, "abbr": "WYA", "confidence": "high"}, {"school": "Shady Side Academy", "colors_named": "Old Gold and Navy", "aliases": [], "mascot": "Bulldogs (Indians retired 2020)", "primary": "#c9a227", "secondary": "#1b2a4a", "accent": null, "abbr": "SSA", "confidence": "high"}, {"school": "Central Mountain", "colors_named": "Royal Blue and White", "aliases": [], "mascot": "Wildcats", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "CM", "confidence": "high"}, {"school": "Bellefonte", "colors_named": "Red and White", "aliases": [], "mascot": "Red Raiders", "primary": "#c8102e", "secondary": "#ffffff", "accent": null, "abbr": "BEL", "confidence": "high"}, {"school": "McGuffey", "colors_named": "Navy Blue and Gold", "aliases": [], "mascot": "Highlanders", "primary": "#1b2a4a", "secondary": "#c9a227", "accent": null, "abbr": "MCG", "confidence": "high"}, {"school": "Warrior Run", "colors_named": "Blue and Gray", "aliases": [], "mascot": "Defenders", "primary": "#1f4e9c", "secondary": "#8a8d8f", "accent": null, "abbr": "WR", "confidence": "high"}, {"school": "Greensburg Salem", "colors_named": "Gold, Brown and White", "aliases": [], "mascot": "Golden Lions", "primary": "#c9a227", "secondary": "#6b4423", "accent": "#ffffff", "abbr": "GS", "confidence": "high"}, {"school": "Susquehanna Township", "colors_named": "Red and White", "aliases": [], "mascot": "not defined (previously Indians)", "primary": "#c8102e", "secondary": "#ffffff", "accent": null, "abbr": "ST", "confidence": "medium"}, {"school": "Northwestern Lehigh", "colors_named": "Black and Gold", "aliases": [], "mascot": "Tigers", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "NL", "confidence": "medium"}, {"school": "Loyalsock", "colors_named": "Maroon, White and Carolina Blue", "aliases": [], "mascot": "Lancers", "primary": "#7a1f3d", "secondary": "#ffffff", "accent": "#5fa8e0", "abbr": "LOY", "confidence": "high"}, {"school": "Brookville", "colors_named": "Navy Blue and White", "aliases": [], "mascot": "Blue Raiders", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": null, "abbr": "BRO", "confidence": "high"}, {"school": "Chartiers Township", "colors_named": "Maroon and Gold (Chartiers-Houston district page)", "aliases": [], "mascot": "Buccaneers", "primary": "#7a1f3d", "secondary": "#c9a227", "accent": null, "abbr": "CT", "confidence": "medium"}, {"school": "Philipsburg-Osceola", "colors_named": "Navy and White", "aliases": [], "mascot": "Mounties", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": null, "abbr": "PO", "confidence": "high"}, {"school": "Fort LeBoeuf", "colors_named": "Blue and White", "aliases": [], "mascot": "Bison", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "FL", "confidence": "medium"}, {"school": "Mifflinburg", "colors_named": "Blue and White", "aliases": [], "mascot": "Wildcats", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "MIF", "confidence": "high"}, {"school": "Northern Lehigh", "colors_named": "Navy and White", "aliases": [], "mascot": "Bulldogs", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": null, "abbr": "NL", "confidence": "high"}, {"school": "Mount Pleasant", "colors_named": "Red, White and Blue", "aliases": [], "mascot": "Vikings", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": "#ffffff", "abbr": "MP", "confidence": "high"}, {"school": "Philipsburg", "colors_named": "Navy and White (Philipsburg-Osceola page; may be the pre-consolidation name)", "aliases": [], "mascot": "Mounties", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": null, "abbr": "PHI", "confidence": "medium"}, {"school": "Chartiers-Houston", "colors_named": "Maroon and Gold", "aliases": [], "mascot": "Buccaneers", "primary": "#7a1f3d", "secondary": "#c9a227", "accent": null, "abbr": "CH", "confidence": "medium"}, {"school": "Saegertown", "colors_named": "Blue and Gold (Penncrest district page)", "aliases": [], "mascot": "not confirmed", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "SAE", "confidence": "medium"}, {"school": "Curwensville", "colors_named": "Black and Gold", "aliases": [], "mascot": "Golden Tide", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "CUR", "confidence": "high"}, {"school": "Catasauqua", "colors_named": "Brown and White (gold sometimes an accent)", "aliases": [], "mascot": "Rough Riders", "primary": "#6b4423", "secondary": "#ffffff", "accent": "#c9a227", "abbr": "CAT", "confidence": "high"}, {"school": "Mount Union", "colors_named": "Royal Blue and Vegas Gold (district page)", "aliases": [], "mascot": "Trojans", "primary": "#1f4e9c", "secondary": "#c5b358", "accent": null, "abbr": "MU", "confidence": "medium"}, {"school": "Salisbury Township", "colors_named": "Navy and White", "aliases": [], "mascot": "not confirmed (Falcons per athletics link text)", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": null, "abbr": "ST", "confidence": "medium"}, {"school": "Forest Hills", "colors_named": "Green and Yellow", "aliases": [], "mascot": "Rangers", "primary": "#15803d", "secondary": "#ffd700", "accent": null, "abbr": "FH", "confidence": "high"}, {"school": "Penn-Trafford", "colors_named": "Green and Gold (article says Dartmouth Green and Green Bay Gold)", "aliases": [], "mascot": "Warriors", "primary": "#1b5e3a", "secondary": "#c9a227", "accent": null, "abbr": "PT", "confidence": "medium"}, {"school": "Allentown", "colors_named": "Canary Yellow and Blue (William Allen HS, Allentown)", "aliases": [], "mascot": "Canaries", "primary": "#ffd700", "secondary": "#1f4e9c", "accent": null, "abbr": "ALL", "confidence": "medium"}, {"school": "Selinsgrove", "colors_named": "Red and Blue", "aliases": [], "mascot": "Seals", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "SEL", "confidence": "high"}, {"school": "Dallastown", "colors_named": "Blue and White", "aliases": [], "mascot": "Wildcats", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "DAL", "confidence": "high"}, {"school": "Huntingdon", "colors_named": "Red and Blue", "aliases": [], "mascot": "Bearcats", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "HUN", "confidence": "high"}, {"school": "West Branch", "colors_named": "Red, White and Royal Blue", "aliases": [], "mascot": "Warriors", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": "#ffffff", "abbr": "WB", "confidence": "high"}, {"school": "Council Rock", "colors_named": "Navy Blue, White and Silver (North campus)", "aliases": [], "mascot": "Indians (under review; wiki still lists it)", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": "#c0c0c0", "abbr": "CR", "confidence": "medium"}, {"school": "Jeannette", "colors_named": "Red and Blue (district page)", "aliases": [], "mascot": "Jayhawks", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "JEA", "confidence": "medium"}, {"school": "Technical Memorial", "colors_named": "Black and Gold (Central Tech lineage)", "aliases": [], "mascot": "Falcons (Central Tech lineage)", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "TM", "confidence": "medium"}, {"school": "Lake Lehman", "colors_named": "Black and Gold", "aliases": [], "mascot": "Knights", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "LL", "confidence": "high"}, {"school": "Meadville", "colors_named": "Red and Black", "aliases": [], "mascot": "Bulldogs", "primary": "#c8102e", "secondary": "#111111", "accent": null, "abbr": "MEA", "confidence": "high"}, {"school": "Danville", "colors_named": "Orange and Purple", "aliases": [], "mascot": "Ironmen", "primary": "#e87722", "secondary": "#5b2d8e", "accent": null, "abbr": "DAN", "confidence": "high"}, {"school": "North Star", "colors_named": "Green and White", "aliases": [], "mascot": "Cougars", "primary": "#15803d", "secondary": "#ffffff", "accent": null, "abbr": "NS", "confidence": "high"}, {"school": "Richland", "colors_named": "Red and Blue", "aliases": [], "mascot": "Rams", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "RIC", "confidence": "high"}, {"school": "Hanover", "colors_named": "Orange and Black", "aliases": [], "mascot": "Nighthawks", "primary": "#e87722", "secondary": "#111111", "accent": null, "abbr": "HAN", "confidence": "medium"}, {"school": "Pen Argyl", "colors_named": "Green and White", "aliases": [], "mascot": "Green Knights", "primary": "#15803d", "secondary": "#ffffff", "accent": null, "abbr": "PA", "confidence": "high"}, {"school": "Chestnut Ridge", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Lions", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "CR", "confidence": "high"}, {"school": "Solanco", "colors_named": "Black and Gold", "aliases": [], "mascot": "Golden Mules", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "SOL", "confidence": "high"}, {"school": "South Park", "colors_named": "Royal Blue and White (black accent)", "aliases": [], "mascot": "Eagles", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": "#111111", "abbr": "SP", "confidence": "high"}, {"school": "Bedford", "colors_named": "Royal Blue and White", "aliases": [], "mascot": "Bisons", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "BED", "confidence": "high"}, {"school": "Erie Strong Vincent", "colors_named": "Red and Black", "aliases": [], "mascot": "Colonels", "primary": "#c8102e", "secondary": "#111111", "accent": null, "abbr": "ESV", "confidence": "medium"}, {"school": "Hollidaysburg", "colors_named": "Navy, Gold and White", "aliases": [], "mascot": "Golden Tigers", "primary": "#1b2a4a", "secondary": "#c9a227", "accent": "#ffffff", "abbr": "HOL", "confidence": "high"}, {"school": "Carnegie", "colors_named": "Green and Gold (Carlynton HS, Carnegie PA)", "aliases": [], "mascot": "Golden Cougars", "primary": "#15803d", "secondary": "#c9a227", "accent": null, "abbr": "CAR", "confidence": "medium"}, {"school": "Greater Johnstown", "colors_named": "Black and Columbia Blue", "aliases": [], "mascot": "Trojans", "primary": "#111111", "secondary": "#5fa8e0", "accent": null, "abbr": "GJ", "confidence": "high"}, {"school": "Boiling Springs", "colors_named": "Purple and Gold", "aliases": [], "mascot": "Bubblers", "primary": "#5b2d8e", "secondary": "#c9a227", "accent": null, "abbr": "BS", "confidence": "high"}, {"school": "Neshaminy", "colors_named": "Red and Blue", "aliases": [], "mascot": "Redskins (Skins; name under legal challenge)", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "NES", "confidence": "high"}, {"school": "Chartiers Valley", "colors_named": "Red and Blue", "aliases": [], "mascot": "Colts", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "CV", "confidence": "high"}, {"school": "Newport", "colors_named": "Blue and White", "aliases": [], "mascot": "Buffaloes", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "NEW", "confidence": "high"}, {"school": "Manheim Township", "colors_named": "Blue and White", "aliases": [], "mascot": "Blue Streaks (Sir Streaksalot the Lion)", "primary": "#1f4e9c", "secondary": "#ffffff", "accent": null, "abbr": "MT", "confidence": "high"}, {"school": "Cranberry", "colors_named": "Maroon and Gold (district page)", "aliases": [], "mascot": "Super Berry", "primary": "#7a1f3d", "secondary": "#c9a227", "accent": null, "abbr": "CRA", "confidence": "medium"}, {"school": "Chambersburg", "colors_named": "Navy Blue, White and Silver Grey", "aliases": [], "mascot": "Trojans", "primary": "#1b2a4a", "secondary": "#ffffff", "accent": "#8a8d8f", "abbr": "CHA", "confidence": "high"}, {"school": "Northern York", "colors_named": "Purple and White", "aliases": [], "mascot": "Polar Bears", "primary": "#5b2d8e", "secondary": "#ffffff", "accent": null, "abbr": "NY", "confidence": "high"}, {"school": "Avella", "colors_named": "Blue and Gold (district page)", "aliases": [], "mascot": "Eagles", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "AVE", "confidence": "medium"}, {"school": "Sayre", "colors_named": "Red and Blue", "aliases": [], "mascot": "Redskins (under legal/community challenge)", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": null, "abbr": "SAY", "confidence": "medium"}, {"school": "Seneca Valley", "colors_named": "Blue and Black (district page)", "aliases": [], "mascot": "Raiders", "primary": "#1f4e9c", "secondary": "#111111", "accent": null, "abbr": "SV", "confidence": "medium"}, {"school": "Delone Catholic", "colors_named": "Red and Blue (school); Black and Gold (athletic)", "aliases": [], "mascot": "Squires", "primary": "#c8102e", "secondary": "#1f4e9c", "accent": "#c9a227", "abbr": "DC", "confidence": "high"}, {"school": "Cameron County", "colors_named": "Red and White", "aliases": [], "mascot": "Red Raiders", "primary": "#c8102e", "secondary": "#ffffff", "accent": null, "abbr": "CC", "confidence": "high"}, {"school": "Biglerville", "colors_named": "Black and Gold", "aliases": [], "mascot": "Canners", "primary": "#111111", "secondary": "#c9a227", "accent": null, "abbr": "BIG", "confidence": "high"}, {"school": "Schuylkill Valley", "colors_named": "Red and Black (district page)", "aliases": [], "mascot": "Panthers", "primary": "#c8102e", "secondary": "#111111", "accent": null, "abbr": "SV", "confidence": "medium"}, {"school": "Canton", "colors_named": "Crimson and White", "aliases": [], "mascot": "Warriors", "primary": "#8b1e2d", "secondary": "#ffffff", "accent": null, "abbr": "CAN", "confidence": "high"}, {"school": "Pittsburgh Central Catholic", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Vikings", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "PCC", "confidence": "high"}, {"school": "Freedom Area", "colors_named": "Red and White", "aliases": [], "mascot": "Bulldogs", "primary": "#c8102e", "secondary": "#ffffff", "accent": null, "abbr": "FA", "confidence": "high"}, {"school": "Brockway", "colors_named": "Red and Black", "aliases": [], "mascot": "Rovers", "primary": "#c8102e", "secondary": "#111111", "accent": null, "abbr": "BRO", "confidence": "high"}, {"school": "Kennard-Dale", "colors_named": "Blue and Gold", "aliases": [], "mascot": "Rams", "primary": "#1f4e9c", "secondary": "#c9a227", "accent": null, "abbr": "KD", "confidence": "high"}, {"school": "Mifflin County", "colors_named": "Purple, Black and Silver", "aliases": [], "mascot": "Huskies", "primary": "#5b2d8e", "secondary": "#111111", "accent": "#c0c0c0", "abbr": "MC", "confidence": "high"}, {"school": "Wyoming Area", "colors_named": "Green and Gold (district page)", "aliases": [], "mascot": "Warriors", "primary": "#15803d", "secondary": "#c9a227", "accent": null, "abbr": "WA", "confidence": "medium"}];

  // ---------- lookup ----------
  var STOP = /\b(high|school|senior|hs|sr|the|of)\b/g;
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/\bmount\b/g, 'mt').replace(/&/g, ' and ')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(STOP, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  var INDEX = {};
  DATA.forEach(function (d) {
    [d.school].concat(d.aliases || []).forEach(function (n) {
      var k = norm(n);
      if (k && !INDEX[k]) INDEX[k] = d;
    });
  });
  function identity(school) {
    if (school && typeof school === 'object') return school;
    return INDEX[norm(school)] || null;
  }

  // ---------- escaping ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeHex(h, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(h || '') ? h.toLowerCase() : fallback;
  }

  // ---------- color math (sRGB <-> OKLab/OKLCH, WCAG contrast) ----------
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r) {
    return '#' + r.map(function (v) {
      v = Math.round(Math.max(0, Math.min(255, v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(c) { return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); }
  function luminance(hex) {
    var r = hexToRgb(hex).map(toLin);
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function hexToOklab(hex) {
    var c = hexToRgb(hex).map(toLin);
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklabToLinRgb(L, a, b) {
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function toLch(hex) {
    var o = hexToOklab(hex);
    var C = Math.sqrt(o[1] * o[1] + o[2] * o[2]);
    var H = (Math.atan2(o[2], o[1]) * 180 / Math.PI + 360) % 360;
    return [o[0], C, H];
  }
  // OKLCH -> hex, reducing chroma until it fits the sRGB gamut
  function fromLch(L, C, H) {
    var hr = H * Math.PI / 180, lo = 0, hi = C, best = null;
    function tryC(c) {
      var rgb = oklabToLinRgb(L, c * Math.cos(hr), c * Math.sin(hr));
      for (var i = 0; i < 3; i++) if (rgb[i] < -1e-4 || rgb[i] > 1 + 1e-4) return null;
      return rgb;
    }
    best = tryC(C);
    if (!best) {
      for (var k = 0; k < 24; k++) {
        var mid = (lo + hi) / 2, r = tryC(mid);
        if (r) { best = r; lo = mid; } else hi = mid;
      }
      if (!best) best = tryC(0);
    }
    return rgbToHex(best.map(function (v) { return fromLin(Math.max(0, Math.min(1, v))); }));
  }
  function deltaE(h1, h2) {
    var a = hexToOklab(h1), b = hexToOklab(h2);
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
  }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    return rgbToHex([0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * t; }));
  }

  // ---------- palette for unknown schools ----------
  var NEUTRAL = { primary: '#4b5563', secondary: '#d1d5db', accent: null };

  function initialsFor(name) {
    var words = norm(name).split(' ').filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 3).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function resolve(school) {
    var d = identity(school);
    var name = d ? d.school : String(school == null ? '' : school);
    var pal = d ? d : NEUTRAL;
    var primary = safeHex(pal.primary, NEUTRAL.primary);
    var secondary = safeHex(pal.secondary, NEUTRAL.secondary);
    var accent = pal.accent ? safeHex(pal.accent, null) : null;
    var abbr = (d && d.abbr) || initialsFor(name);
    abbr = String(abbr).replace(/[^A-Za-z0-9&.\-]/g, '').slice(0, 4).toUpperCase() || '?';
    return { known: !!d, name: name, mascot: d ? d.mascot : null, primary: primary,
             secondary: secondary, accent: accent, abbr: abbr };
  }

  // Text on the primary field: use the school's secondary/accent if it reads
  // (>= 4.5:1), otherwise whichever of white / ink contrasts most.
  function textOn(bg, prefs) {
    for (var i = 0; i < prefs.length; i++) {
      if (prefs[i] && contrast(prefs[i], bg) >= 4.5) return prefs[i];
    }
    return contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111';
  }
  // Ring/stripe color: secondary unless it vanishes against the primary.
  function trimOn(bg, r) {
    var cands = [r.secondary, r.accent, '#ffffff', '#111111'];
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] && contrast(cands[i], bg) >= 1.9) return cands[i];
    }
    return contrast('#ffffff', bg) > contrast('#111111', bg) ? '#ffffff' : '#111111';
  }
  // Edge keeps the badge defined on white AND dark surfaces.
  function edgeFor(primary) {
    var L = toLch(primary)[0];
    return L > 0.6 ? mix(primary, '#000000', 0.45) : (L < 0.3 ? mix(primary, '#ffffff', 0.28) : mix(primary, '#000000', 0.35));
  }

  // ---------- SVG builders ----------
  var FONT = "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif";

  function textEl(abbr, cx, cy, fill, maxW, baseSize) {
    var n = abbr.length;
    var fs = baseSize * (n <= 2 ? 1 : n === 3 ? 0.82 : 0.66);
    var estW = fs * 0.64 * n;           // bold sans average advance
    var fit = estW > maxW ? ' textLength="' + maxW.toFixed(1) + '" lengthAdjust="spacingAndGlyphs"' : '';
    return '<text x="' + cx + '" y="' + (cy + fs * 0.355).toFixed(2) + '" text-anchor="middle" font-family="' + FONT +
      '" font-weight="800" font-size="' + fs.toFixed(2) + '" letter-spacing="' + (n >= 3 ? '-0.3' : '0') +
      '" fill="' + fill + '"' + fit + '>' + esc(abbr) + '</text>';
  }

  // Circle chip: primary disc, inner "mat boundary" ring, initials.
  function chip(r, size) {
    var px = 64 / size;                      // viewBox units per CSS pixel
    var edgeW = Math.max(1.5, px * 1);       // >= 1 device px
    var text = textOn(r.primary, [r.secondary, r.accent]);
    var trim = trimOn(r.primary, r);
    var parts = ['<circle cx="32" cy="32" r="' + (32 - edgeW / 2) + '" fill="' + r.primary + '" stroke="' + edgeFor(r.primary) + '" stroke-width="' + edgeW + '"/>'];
    if (size >= 22) {
      var ringW = Math.max(2.2, px * 1.1);
      parts.push('<circle cx="32" cy="32" r="' + (26.5 - ringW / 2).toFixed(2) + '" fill="none" stroke="' + trim + '" stroke-width="' + ringW.toFixed(2) + '"/>');
    }
    if (!r.known) parts.push('<circle cx="32" cy="32" r="29" fill="none" stroke="' + r.secondary + '" stroke-width="' + Math.max(1.2, px * 0.8) + '" stroke-dasharray="4 3"/>');
    var maxW = size >= 22 ? 36 : 50;
    parts.push(textEl(r.abbr, 32, 32, text, maxW, size >= 22 ? 26 : 34));
    return parts.join('');
  }

  // Shield crest: notched shield, mat-circle ring around initials,
  // two singlet chevron stripes in the point.
  var SHIELD = 'M8 4 H56 L60 8 V30 C60 46 48 56 32 62 C16 56 4 46 4 30 V8 Z';
  function crest(r, size) {
    var px = 64 / size;
    var edgeW = Math.max(1.6, px * 1);
    var text = textOn(r.primary, [r.secondary, r.accent]);
    var trim = trimOn(r.primary, r);
    var trim2 = r.accent && contrast(r.accent, r.primary) >= 1.9 && r.accent !== trim ? r.accent : trim;
    var detailed = size >= 40;
    var p = [];
    p.push('<path d="' + SHIELD + '" fill="' + r.primary + '" stroke="' + edgeFor(r.primary) + '" stroke-width="' + edgeW.toFixed(2) + '" stroke-linejoin="round"/>');
    // top bar (weight-class plate band)
    p.push('<path d="M8 4 H56 L60 8 V12 H4 V8 Z" fill="' + trim + '"/>');
    if (detailed) {
      // mat circle: outer boundary + center starting dot
      p.push('<circle cx="32" cy="29" r="15.5" fill="none" stroke="' + trim + '" stroke-width="' + Math.max(1.6, px * 0.9).toFixed(2) + '"/>');
    }
    // singlet chevrons
    var sw = detailed ? 3.2 : Math.max(3.6, px * 1.3);
    p.push('<path d="M14 45 L32 52.5 L50 45" fill="none" stroke="' + trim + '" stroke-width="' + sw.toFixed(2) + '" stroke-linecap="butt" stroke-linejoin="miter"/>');
    if (detailed) p.push('<path d="M19 51.5 L32 57 L45 51.5" fill="none" stroke="' + trim2 + '" stroke-width="' + (sw * 0.75).toFixed(2) + '" stroke-linejoin="miter"/>');
    if (!r.known) p.push('<path d="' + SHIELD + '" fill="none" stroke="' + r.secondary + '" stroke-width="' + Math.max(1.2, px * 0.8) + '" stroke-dasharray="4 3" transform="translate(32 33) scale(.86) translate(-32 -33)"/>');
    p.push(textEl(r.abbr, 32, detailed ? 29 : 27.5, text, detailed ? 25 : 40, detailed ? 19 : 25));
    return p.join('');
  }

  function svg(school, opts) {
    opts = opts || {};
    var size = Math.max(12, Math.min(256, +opts.size || 32));
    var variant = opts.variant === 'crest' ? 'crest' : 'chip';
    var r = resolve(school);
    var label = r.name + (r.mascot ? ' ' + r.mascot : '');
    var body = variant === 'crest' ? crest(r, size) : chip(r, size);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 64 64" role="img" aria-label="' + esc(label) + '" class="school-badge school-badge--' + variant +
      '" shape-rendering="geometricPrecision">' + (opts.title === false ? '' : '<title>' + esc(label) + '</title>') +
      body + '</svg>';
  }

  // ---------- chart colors ----------
  // Lightness bands chosen so marks read on white (light) or ~#121212 (dark).
  var BAND = { light: [0.50, 0.64], dark: [0.70, 0.84] };
  var OTHER = { light: '#9ca3af', dark: '#6b7280' };

  // District 11 top-8: hand-tuned, deterministic. Higher all-time champion
  // count keeps its true primary; later schools shift within their family.
  //   Nazareth  blue            (primary)
  //   Northampton orange        (primary)
  //   Easton    scarlet         (primary)
  //   Beth Catholic gold        (secondary - "Golden Hawks"; brown too dark/close to orange)
  //   Liberty   violet          (burgundy+navy blend; red & blue already taken)
  //   Parkland  rose-crimson    (red family, shifted ~35deg off Easton)
  //   Freedom   charcoal/silver (black primary; gold already taken by Becahi)
  //   Other     neutral gray
  var TOP8 = {
    light: { 'Nazareth': '#2563c9', 'Northampton': '#d9661a', 'Easton': '#cc2b2b',
             'Bethlehem Catholic': '#a87b00', 'Bethlehem Liberty': '#6d4fc6', 'Parkland': '#b8336f',
             'Bethlehem Freedom': '#3b4048', 'Other': OTHER.light },
    dark:  { 'Nazareth': '#6e9bff', 'Northampton': '#ff9a4d', 'Easton': '#ff6b61',
             'Bethlehem Catholic': '#e8c04a', 'Bethlehem Liberty': '#c38cf5', 'Parkland': '#f07aae',
             'Bethlehem Freedom': '#d9dce0', 'Other': OTHER.dark }
  };

  function adjust(hex, mode) {
    var lch = toLch(hex), band = BAND[mode];
    var L = Math.max(band[0], Math.min(band[1], lch[0]));
    var C = Math.max(lch[1], 0.06);
    return fromLch(L, Math.min(C, 0.2), lch[2]);
  }
  function chromatic(hex) { return hex && toLch(hex)[1] >= 0.045; }

  function colorFor(school, mode) {
    mode = mode === 'dark' ? 'dark' : 'light';
    if (school === 'Other' || school === 'other') return OTHER[mode];
    var d = identity(school);
    if (!d) return OTHER[mode];
    if (TOP8[mode][d.school]) return TOP8[mode][d.school];
    var base = chromatic(d.primary) ? d.primary : chromatic(d.secondary) ? d.secondary : (d.accent && chromatic(d.accent) ? d.accent : null);
    if (!base) { // fully achromatic school (e.g. placeholder) -> neutral slate in band
      return mode === 'light' ? '#4b5563' : '#cbd5e1';
    }
    return adjust(base, mode);
  }

  // De-conflict any list deterministically: keep order (put most important first),
  // each school tries primary, then secondary, then hue steps of +-18deg until
  // OKLab distance >= minDE from every color already assigned.
  function palette(list, mode, minDE) {
    mode = mode === 'dark' ? 'dark' : 'light';
    minDE = minDE || 0.09;
    var used = [], out = {};
    (list || []).forEach(function (s) {
      var key = (identity(s) || {}).school || String(s);
      var first = colorFor(s, mode);
      var d = identity(s);
      var cands = [first];
      if (d && chromatic(d.secondary)) cands.push(adjust(d.secondary, mode));
      var lch = toLch(first);
      for (var k = 1; k <= 9; k++) {
        [1, -1].forEach(function (sg) {
          cands.push(fromLch(lch[0], Math.max(lch[1], 0.08), (lch[2] + sg * 18 * k + 360) % 360));
        });
      }
      var BL = BAND[mode];
      cands.push(fromLch(BL[0], 0.02, 0), fromLch(BL[1], 0.02, 0));
      var pick = cands[0], bestD = -1;
      for (var i = 0; i < cands.length; i++) {
        var md = used.reduce(function (m, u) { return Math.min(m, deltaE(u, cands[i])); }, 9);
        if (md >= minDE) { pick = cands[i]; bestD = md; break; }
        if (md > bestD) { bestD = md; pick = cands[i]; }
      }
      used.push(pick); out[key] = pick;
      if (String(s) !== key) out[String(s)] = pick;
    });
    return out;
  }

  root.SchoolBadge = {
    svg: svg,
    colorFor: colorFor,
    palette: palette,
    identity: function (s) { var d = identity(s); return d ? JSON.parse(JSON.stringify(d)) : null; },
    resolve: resolve,
    list: function () { return DATA.map(function (d) { return d.school; }); },
    escape: esc,
    _util: { contrast: contrast, deltaE: deltaE, toLch: toLch, textOn: textOn },
    TOP8: ['Nazareth', 'Northampton', 'Easton', 'Bethlehem Catholic', 'Bethlehem Liberty', 'Parkland', 'Bethlehem Freedom', 'Other']
  };
})(typeof window !== 'undefined' ? window : this);
