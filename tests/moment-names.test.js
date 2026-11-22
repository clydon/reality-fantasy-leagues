// One name for each moment everywhere (BACKLOG 251, the user's pick 2026-11-22): a game shows a moment in the show's words, the
// rulebook's, as the castaway's sheet does; the game's format keeps its own labels underneath.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const { momentName, momentNamer } = jiti("../src/lib/game/moment-names.ts");

const survivor = () => {
  const state = S.defaultState();
  state.settings = { ...state.settings, showFormat: "survivor" };
  return state;
};

test("a Survivor game names its moments as the show's rulebook does", () => {
  const state = survivor();
  assert.equal(S.formatOf(state).events.find((e) => e.id === "individualImmunity").label, "Individual immunity win", "the format keeps its label");
  assert.equal(momentName(state, "individualImmunity"), "Won the Immunity challenge");
  assert.equal(momentName(state, "challengeRunnerUp"), "2nd in the Immunity challenge");
  assert.equal(momentName(state, "learnedOfAdvantage"), "Learned of an idol or advantage privately");
});

test("a moment the rulebook doesn't name keeps the game's own word; an unknown type is itself", () => {
  const state = survivor();
  const name = momentNamer(state);
  for (const e of S.formatOf(state).events) assert.ok(name(e.id).length > 0, e.id);
  assert.equal(name("aCouchsOwnMoment"), "aCouchsOwnMoment");
});
