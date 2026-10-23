// Publishes the full-site design mock (.impeccable/mocks/site/, gitignored) as static files the app serves at
// /mock (and /mock/hub, the older link): copies the site into public/mock/site/ and the photos, key art and
// data it reads into public/mock/showcase/. The published index.html gets a <base href="/mock/site/"> so its
// relative files resolve from either URL, and a noindex tag. Re-run after every mock change, then commit
// public/mock/ and deploy. No DB access.
//
//   node scripts/dev-test/publish-site-mock.js
const fs = require("fs");
const path = require("path");

const SRC = ".impeccable/mocks/site", SHOW = ".impeccable/mocks/showcase", OUT = "public/mock";
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
fs.rmSync(path.join(OUT, "site"), { recursive: true, force: true });
fs.rmSync(path.join(OUT, "showcase"), { recursive: true, force: true });

let n = 0, bytes = 0;
const add = (from, to) => { copy(from, to); n++; bytes += fs.statSync(to).size; };
for (const f of fs.readdirSync(SRC).filter((f) => /\.(js|css)$/.test(f))) add(path.join(SRC, f), path.join(OUT, "site", f));
// every page gets noindex; index.html also gets a <base> so it works from /mock and /mock/hub. The other pages
// (option comparisons such as binge-options.html) are opened at /mock/site/<page>.html.
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".html"))) {
  let html = fs.readFileSync(path.join(SRC, f), "utf8");
  if (!html.includes("<head>")) throw new Error(`${f} has no <head>`);
  html = html.replace("<head>", `<head>\n${f === "index.html" ? '<base href="/mock/site/">\n' : ""}<meta name="robots" content="noindex, nofollow">`);
  fs.writeFileSync(path.join(OUT, "site", f), html);
  n++; bytes += html.length;
}
add(path.join(SHOW, "data.js"), path.join(OUT, "showcase", "data.js"));
for (const dir of ["img", "art"]) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else add(p, path.join(OUT, "showcase", path.relative(SHOW, p)));
  });
  walk(path.join(SHOW, dir));
}
console.log(`published ${n} files, ${(bytes / 1e6).toFixed(1)} MB, to ${OUT}/site and ${OUT}/showcase`);
