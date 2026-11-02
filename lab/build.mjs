// Writes The Lab's cards into index.html from builds.json, so the page is complete before any
// script runs (search engines, link previews, readers without JavaScript). Run after any change to
// builds.json, lab.css, lab.js or render.js:
//
//     node lab/build.mjs
//
// It also inlines the list as JSON for lab.js and re-stamps the ?v= cache keys, because
// Hostinger's CDN keeps old CSS and JS for days.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), "utf8");

// render.js is a browser module; load it here without a package.json by importing it as data
const R = await import("data:text/javascript;base64," + Buffer.from(read("render.js")).toString("base64"));
const data = JSON.parse(read("builds.json"));
const m = R.model(data);

let html = read("index.html");
const fill = (name, content) => {
  const re = new RegExp(`(<!-- lab:${name} -->)[\\s\\S]*?(<!-- /lab:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html has no lab:${name} markers`);
  html = html.replace(re, (_, a, b) => a + content + b);
};
fill("stats", R.stats(m));
fill("wheel", R.wheel(m));
fill("now", R.now(m, 0));
fill("shelf", R.shelf(m, "all"));
fill("chips", R.chips(m, "all"));
fill("grid", R.grid(m, "all"));
const json = JSON.stringify(data).replace(/</g, "\\u003c");
fill("data", `<script type="application/json" id="lab-data">${json}</script>`);
if (m.newestOpen) html = html.replace(/(id="heroOpen" href=")[^"]*(")/, `$1${m.newestOpen.href}$2`);

const v = createHash("sha1").update(read("lab.css") + read("lab.js") + read("render.js")).digest("hex").slice(0, 8);
html = html.replace(/(\.\/lab\.css)(\?v=[\w]+)?/, `$1?v=${v}`).replace(/(\.\/lab\.js)(\?v=[\w]+)?/, `$1?v=${v}`);

writeFileSync(join(here, "index.html"), html);

// Present mode: write each figure's steps (guides.json) and the stamped guide.js into its page
if (existsSync(join(here, "guides.json"))) {
  const guides = JSON.parse(read("guides.json"));
  const gv = createHash("sha1").update(read("guide.js")).digest("hex").slice(0, 8);
  for (const [slug, cfg] of Object.entries(guides)) {
    const file = join(here, slug, "index.html");
    if (!existsSync(file)) { console.warn(`guide: no page for ${slug}`); continue; }
    let page = readFileSync(file, "utf8");
    const block = `<!-- lab:guide --><script type="application/json" id="lab-guide">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script><script src="../guide.js?v=${gv}" defer></script><!-- /lab:guide -->`;
    if (page.includes("<!-- lab:guide -->")) page = page.replace(/<!-- lab:guide -->[\s\S]*?<!-- \/lab:guide -->/, block);
    else { const i = page.lastIndexOf("</body>"); page = page.slice(0, i) + block + "\n" + page.slice(i); }
    writeFileSync(file, page);
  }
  console.log(`guide: ${Object.keys(guides).length} figures, stamp v=${gv}`);
}
console.log(`lab: ${m.real.length} builds in ${data.courses.length} courses, stamp v=${v}`);
