// The rulebook library (src/lib/game/formats/library/): every researched rulebook is a valid rulebook, its stored
// compiled data is exactly what its blocks compile to (so a compiler change can't leave it stale unnoticed: re-save
// with scripts/dev-test/save-rulebook-library.js), the engine takes it, and it says nothing about results. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { LIBRARY, libraryRulebook } = require("../src/lib/game/formats/library/index.js");
const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { compileRulebook, formatForRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const R = require("../src/lib/game/formats/rulebook-research.js");

test("every library rulebook is valid, compiles to what's stored, and the engine takes it", () => {
  for (const [id, e] of Object.entries(LIBRARY)) {
    assert.equal(e.id, id, `${id}: keyed by its own id`);
    assert.equal(e.status, "draft", `${id}: a research draft until a person reviews it`);
    assert.deepEqual(blocksProblems(e.blocks), [], id);
    const { data, problems } = compileRulebook(e.blocks, { id });
    assert.deepEqual(problems, [], id);
    assert.deepEqual(e.compiled, data, `${id}: the stored compile is current (re-save it if the compiler changed on purpose)`);
    assert.doesNotThrow(() => formatForRulebook(e.compiled), id);
  }
  assert.equal(libraryRulebook("scrubs").show, "Scrubs");
  assert.equal(libraryRulebook("nope"), null);
});

test("the library covers every kind of show, and says nothing about what happened", () => {
  const kinds = Object.values(LIBRARY).map((e) => (e.blocks.kind === "series" ? `series:${e.blocks.start}` : e.blocks.kind));
  for (const k of ["competition", "series:reality", "series:scripted", "talk", "sport"]) assert.ok(kinds.includes(k), `a ${k} rulebook`);
  for (const [id, e] of Object.entries(LIBRARY)) {
    const { warnings, phaseStarts } = R.reviewRulebook(e.blocks);
    assert.deepEqual(warnings.filter((w) => /happened in an episode/.test(w.message)), [], `${id}: no sentence about an episode`);
    assert.deepEqual(phaseStarts, {}, `${id}: no season data in the blocks`);
  }
});
