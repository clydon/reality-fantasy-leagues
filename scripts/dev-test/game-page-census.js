// A game's own page, generated: the census, as a report (docs/PLAN-start-a-game-gpt.md U1; the U0 mocks' census.js on the real
// code). tests/game-page.test.js asserts it; this prints what it covers: how many specs from where, each main block and answer
// control and how often, every place a page uses, and which of them draw from the spec alone (a twist's tag) because the game's
// view doesn't carry their state yet. No database, no server.
//   node scripts/dev-test/game-page-census.js [--rolls 150] [--extra <folder of .json specs>]
// --extra adds more specs (the U0 mocks' made-for and typed games: ../reality-fantasy-leagues/.impeccable/mocks, local only).
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const jiti = require(path.join(ROOT, "node_modules", "jiti"))(path.join(ROOT, "x.js"), { alias: { "@": path.join(ROOT, "src") } });
const { compileGame } = jiti("./src/lib/game/game-page/compile.ts");
const M = jiti("./src/lib/game/game-page/model.ts");
const { allSpecs } = require(path.join(ROOT, "tests/fixtures/game-page-specs.js"));

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const dir = arg("--extra", null);
const extra = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f)) : [];
const all = allSpecs({ rolls: +arg("--rolls", 150), extra });
const tally = (xs) => Object.entries(xs.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
const pages = all.map((x) => ({ x, p: compileGame(x.spec) }));
console.log(`SPECS ${all.length}: ${tally(all.map((x) => x.src))}`);
console.log(`HOLES ${pages.filter(({ p }) => p.holes.length).length}`);
console.log(`MAIN ${tally(pages.map(({ p }) => p.main))}`);
console.log(`CONTROLS ${tally(pages.flatMap(({ p }) => p.questions.map((q) => q.control)))}`);
const used = [...new Set(pages.flatMap(({ p }) => p.places))].sort();
const undrawn = used.filter((k) => !M.DRAWN.has(k));
const spec = used.filter((k) => M.DRAWN.get(k) === "spec");
console.log(`PLACES ${used.length} used, ${undrawn.length} not drawn${undrawn.length ? ": " + undrawn.join(" ") : ""}`);
console.log(`FROM THE SPEC ONLY ${spec.length} (a twist's tag until the view carries its state): ${spec.join(" ")}`);
let bad = 0;
for (const { x, p } of pages) for (const phase of ["before", "during", "over"]) if (/undefined|NaN|\[object/.test(JSON.stringify(M.sampleModel(p, { phase, sport: x.sport || null })))) bad++;
console.log(`WORDS ${pages.length * 3} page models drawn, ${bad} with undefined, NaN or [object`);
