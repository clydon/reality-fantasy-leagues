// A game's own page, generated from its spec (docs/PLAN-start-a-game-gpt.md U1; src/lib/game/game-page/): the census U0's round 2
// proved on the mocks, on the real code. (1) The grammar: every value of every dial in the engine's vocabulary has a place. (2) Every
// spec the repo can make (tests/fixtures/game-page-specs.js: the engine's rolls on four rulebooks, each sport's standard games, the
// presets and the engine's own fixtures) compiles with no hole. (3) Every place any of them uses is one the page draws (DRAWN).
// (4) All sixteen answer controls turn up in real specs. (5) Every spec's page model, drawn against a made-up game, has no undefined,
// NaN or [object in its words. Set GAME_PAGE_EXTRA to a folder of more specs (the U0 mocks' made-for and typed games) to add them.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const G = require("../src/lib/game/game-spec/index.js");
const { compileGame } = jiti("../src/lib/game/game-page/compile.ts");
const { vocabCoverage, TWISTS, GRAMMAR } = jiti("../src/lib/game/game-page/grammar.ts");
const M = jiti("../src/lib/game/game-page/model.ts");
const { allSpecs } = require("./fixtures/game-page-specs.js");

const extraDir = process.env.GAME_PAGE_EXTRA;
const extra = extraDir && fs.existsSync(extraDir) ? fs.readdirSync(extraDir).filter((f) => f.endsWith(".json")).map((f) => path.join(extraDir, f)) : [];
const ALL = allSpecs({ rolls: 150, extra });
const PAGES = ALL.map((x) => ({ x, p: compileGame(x.spec) }));

test("the grammar places every value of the engine's vocabulary", () => {
  const vc = vocabCoverage(G.VOCAB);
  assert.deepEqual(vc.holes, [], "vocabulary values with no place on a page");
  assert.ok(vc.rows.length >= 200, `only ${vc.rows.length} values`);
});

test("every spec compiles to a page with no hole", () => {
  assert.ok(ALL.length > 1000, `only ${ALL.length} specs`);
  const holed = PAGES.filter(({ p }) => p.holes.length).map(({ x, p }) => `${x.id}: ${p.holes.join(", ")}`);
  assert.deepEqual(holed, []);
});

test("every place a page can have is one the page draws", () => {
  const places = new Set();
  for (const ps of [...Object.values(GRAMMAR).flatMap((v) => Object.values(v)), ...Object.values(TWISTS)]) for (const [k, id] of ps) if (k !== "line") places.add(`${k}:${id}`);
  for (const { p } of PAGES) for (const k of p.places) places.add(k);
  const undrawn = [...places].filter((k) => !M.DRAWN.has(k));
  assert.deepEqual(undrawn, [], "places nothing draws");
});

test("all sixteen answer controls turn up in real specs, and every main block", () => {
  const controls = new Set(PAGES.flatMap(({ p }) => p.questions.map((q) => q.control)));
  for (const c of ["person", "group", "yesNo", "number", "overUnder", "choice", "calls", "order", "confidence", "chips", "split", "pairs", "side", "bracket", "trivia", "ticket"]) assert.ok(controls.has(c), `no spec asks a ${c} question`);
  const mains = new Set(PAGES.map(({ p }) => p.main));
  // objectives: no spec we have scores by objective (score.hits objective), so the page draws it without a real example.
  for (const m of ["together", "race", "matchup", "worth", "week", "board", "card", "team", "picks", "ladder", "slate", "ballot", "stages"]) assert.ok(mains.has(m), `no spec leads with ${m}`);
});

test("every page's words, at every phase, are whole: no undefined, NaN or [object", () => {
  let bad = [];
  for (const { x, p } of PAGES) {
    for (const phase of ["before", "during", "over"]) {
      const words = JSON.stringify(M.sampleModel(p, { phase, sport: x.sport || null }));
      if (/undefined|NaN|\[object/.test(words)) bad.push(`${x.id} (${phase})`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});
