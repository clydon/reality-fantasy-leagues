// Does a production build ship what a live preview loads? (docs/PLAN-preview-release.md, step 6). On Vercel a function gets only its
// traced files; the preview routes load the gameplay bench's runtime from disk at run time (createRequire), which the bundler can't
// see, so next.config.ts lists them (PREVIEW_FILES). This plays a preview's runtime path headless (a definition built on the made-up
// season, its verdict, a season played, the live maker and the live tier loaded), records every file it loads or reads from this
// checkout, and checks each preview route's trace (<distDir>/server/app/.../route.js.nft.json) holds them all; then says how big
// each route's traced files are, against Vercel's 250 MB (unzipped) for a function.
//
// Needs a build: NEXT_DIST_DIR=.next-build npx next build (a folder of its own, beside a running dev server). No database.
//   node scripts/dev-test/preview-trace-check.js [--dist=.next-build]
const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = path.resolve(__dirname, "../..");
const dist = path.resolve(root, (process.argv.find((a) => a.startsWith("--dist=")) || "--dist=.next-build").slice(7));
const ROUTES = ["api/previews", "api/preview-live", "api/preview-live/make", "api/preview-live/[id]", "api/preview-live/sweep"];

// Everything loaded or read from this checkout while a preview's runtime runs.
const seen = new Set();
const note = (f) => { if (typeof f === "string" && path.isAbsolute(f)) { const a = path.resolve(f); if (a.startsWith(root + path.sep) && fs.existsSync(a)) seen.add(a); } };
const read = fs.readFileSync;
fs.readFileSync = function (f, ...rest) { note(f); return read.call(this, f, ...rest); };
const load = Module._load;
Module._load = function (request, parent, ...rest) {
  try { note(Module._resolveFilename(request, parent)); } catch { /* a builtin, or not found: the load says */ }
  return load.call(this, request, parent, ...rest);
};

function run() {
  const Def = require(path.join(root, "tools/gameplay-bench/preview/definition.cjs"));
  const { season } = require(path.join(root, "tests/fixtures/preview-season/season.js"));
  const { typical } = require(path.join(root, "tools/gameplay-bench/preview/preview.cjs"));
  for (const base of ["fantasy", "pool", "sheet"]) {
    const d = Def.build(season(), { base, gameId: base, changes: base === "fantasy" ? ["redraft"] : [], seed: 7 });
    if (!Def.verdict(d).ok) throw Error(base + " should be previewable");
    typical(d, 1, 7, Def.resultsFor(season()), "alex");
  }
  require(path.join(root, "tools/gameplay-bench/preview/live.cjs"));
  require(path.join(root, "tools/gameplay-bench/live-db.cjs"));
  require(path.join(root, "scripts/dev-test/fixture-art.js"));
}

// A route's trace as it ships: the build writes each route's trace before next.config.ts's outputFileTracingExcludes, which apply
// when its function is packaged; so they're applied here, as they will be.
const picomatch = require("picomatch");
const config = require("jiti")(__filename)(path.join(root, "next.config.ts")).default;
function traced(route) {
  const nft = path.join(dist, "server/app", route, "route.js.nft.json");
  if (!fs.existsSync(nft)) return null;
  const { files } = JSON.parse(read.call(fs, nft, "utf8"));
  const globs = Object.entries(config.outputFileTracingExcludes || {}).filter(([k]) => picomatch(k)("/" + route)).flatMap(([, v]) => v);
  const out = picomatch(globs.map((g) => g.replace(/^\.\//, "")), { dot: true });
  return new Set(files.map((f) => path.resolve(path.dirname(nft), f)).filter((f) => !out(path.relative(root, f).split(path.sep).join("/"))));
}

seen.clear(); // what the check itself loaded (the config, picomatch) isn't a preview's
run();
const needed = [...seen].filter((f) => !path.basename(f).startsWith(".env") && !f.includes(`${path.sep}tests${path.sep}fixtures${path.sep}preview-season`) && !f.endsWith("preview-trace-check.js"));
let bad = 0;
for (const route of ROUTES) {
  const files = traced(route);
  if (!files) { console.log(`${route}: no trace in ${path.relative(root, dist)} (not built yet?)`); bad++; continue; }
  const missing = needed.filter((f) => !files.has(f));
  const bytes = [...files].reduce((t, f) => { try { return t + fs.statSync(f).size; } catch { return t; } }, 0);
  console.log(`${route}: ${files.size} files, ${(bytes / 1048576).toFixed(1)} MB traced; ${missing.length} of the ${needed.length} a preview loads missing`);
  for (const f of missing) console.log("   missing " + path.relative(root, f));
  if (missing.length) bad++;
}
process.exitCode = bad ? 1 : 0;
