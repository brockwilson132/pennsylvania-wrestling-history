/* The app's script files in the order the browser ends up running them: the <script src> tags of overtime/index.html,
 * with the second-stage data files (window.OT_LATE, loaded after the first screen by app/main.js) in the place of the
 * inline script that lists them, ahead of the app files. Build and check tools that run the app in a vm use this.
 *   const scripts = require('./app_scripts')(html)  // e.g. ['https://…/d3.min.js', 'data.js', …, 'medals.js', …, 'app/main.js'] */
'use strict';
module.exports = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>|<script>\s*window\.OT_LATE\s*=\s*\[([^\]]*)\]/g)) {
    if (m[1]) out.push(m[1]); else out.push(...Array.from(m[2].matchAll(/['"]([^'"]+)['"]/g)).map((x) => x[1]));
  }
  return out;
};
