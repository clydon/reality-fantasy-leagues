// Whom an episode's research asks about (src/lib/game/formats/rulebook-roster.js): people still in the game, by what
// the rulebook's ways out mean. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { whoToAsk } = require("../src/lib/game/formats/rulebook-roster.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("./fixtures/rulebook-samples.js");

const people = [
  { name: "Ann" },
  { name: "Bo", left: { episode: 2, means: "out" } },
  { name: "Cy", left: { episode: 5, means: "out" } },
  { name: "Di", left: { episode: 3, means: "outForOne" } },
  { name: "Ed", left: { episode: 9, means: "finalist" } },
];

test("a competition asks only about who's still in", () => {
  const r = whoToAsk(BUILT_IN_BLOCKS.survivor.blocks, people, 5);
  assert.deepEqual(r.ask, ["Ann", "Cy", "Di", "Ed"], "Cy leaves this episode, so is still asked about");
  assert.deepEqual(r.skipped, [{ name: "Bo", why: "left in episode 2" }]);
  assert.deepEqual(whoToAsk(BUILT_IN_BLOCKS.survivor.blocks, people, 10).ask, ["Ann", "Di"], "a finish is gone too");
  assert.equal(r.asksArrivals, false);
});

test("out for one race isn't out: a sport asks about everyone", () => {
  assert.deepEqual(whoToAsk(SAMPLES.formula1, people.filter((p) => p.name !== "Bo"), 5).ask, ["Ann", "Cy", "Di", "Ed"]);
});

test("a comeback from people who left keeps them in the questions", () => {
  const b = JSON.parse(JSON.stringify(BUILT_IN_BLOCKS.survivor.blocks));
  b.twists.push({ id: "redemption", type: "comeback", name: "Redemption Island", who: "peopleWhoLeft", how: "winHeadToHead" });
  assert.deepEqual(whoToAsk(b, people, 6).ask, ["Ann", "Bo", "Cy", "Di", "Ed"]);
});

test("a rulebook with new arrivals asks who's new", () => {
  assert.equal(whoToAsk(SAMPLES.belowDeck, people, 3).asksArrivals, true, "a new hire");
  assert.equal(whoToAsk(SAMPLES.snl, people, 3).asksArrivals, false);
});
