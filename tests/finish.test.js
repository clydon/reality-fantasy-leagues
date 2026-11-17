// Who finished (BACKLOG 96): a season's winner and finalists leave too, but reaching the end isn't going home. The engine's rule
// (src/lib/game/selectors.ts finishOf, from the format's end-of-game exits) and the faces' (src/new/show/finish.ts).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { finishOf, isKnockedOut } = jiti("../src/lib/game/selectors.ts");
const { goneHome, finishWord } = jiti("../src/new/show/finish.ts");

const survivor = (exitMethod) => [{ settings: { showFormat: "survivor" }, castaways: [] }, { id: "c", name: "Savannah Louie", status: exitMethod ? "eliminated" : "active", exitMethod }];

test("The winner finished, a finalist finished, everyone else who left went home", () => {
  assert.equal(finishOf(...survivor("Sole Survivor")), "won");
  assert.equal(finishOf(...survivor("Lost Final Tribal (Jury Vote)")), "final");
  assert.equal(finishOf(...survivor("Lost Fire-Making")), null, "out at the final four");
  assert.equal(finishOf(...survivor("Voted Out")), null);
  assert.equal(finishOf(...survivor(undefined)), null, "still in");
  // The same rule as a game's own view: a finisher isn't knocked out.
  assert.equal(isKnockedOut(...survivor("Sole Survivor")), false);
  assert.equal(isKnockedOut(...survivor("Lost Fire-Making")), true);
  // Another format's words: The Traitors' Winner and Finalist.
  const traitors = { settings: { showFormat: "traitors" }, castaways: [] };
  assert.equal(finishOf(traitors, { id: "x", name: "X", status: "eliminated", exitMethod: "Winner" }), "won");
  assert.equal(finishOf(traitors, { id: "y", name: "Y", status: "eliminated", exitMethod: "Finalist" }), "final");
});

test("Faces: only someone who went home greys, and a finisher's words are the show's", () => {
  assert.equal(goneHome({ out: 13, finish: "won" }), false);
  assert.equal(goneHome({ out: 13, finish: "final" }), false);
  assert.equal(goneHome({ out: 6 }), true);
  assert.equal(goneHome({ out: null }), false);
  assert.equal(finishWord({ finish: "won", how: "Sole Survivor" }), "Sole Survivor");
  assert.equal(finishWord({ finish: "won", how: null }), "Winner");
  assert.equal(finishWord({ finish: "final", how: "Lost Final Tribal (Jury Vote)" }), "Finalist");
  assert.equal(finishWord({ how: "Voted Out" }), null);
});
