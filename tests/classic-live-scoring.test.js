// Classic scoring counts as it happens (docs/PLAN-classic-live-scoring.md): a castaway earns 1 point
// plus 1 for every elimination they outlast, so a team whose castaways are all still in never trails
// one that lost someone early -- and final totals are exactly the old "sum of boot-order places".
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");

function league() {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: "classic-draft", teamSize: 2, setupComplete: true });
  s.castaways = ["a", "b", "c", "d"].map((id) => ({ id, name: id, tribeId: null, ownerIds: [], status: "active", exitEpisodeId: null }));
  s.players = [
    { id: "p1", name: "One", color: "#f00", active: true, disabled: false },
    { id: "p2", name: "Two", color: "#00f", active: true, disabled: false },
  ];
  ["a", "b"].forEach((id) => StateLogic.Core.setOwner(s, id, "p1"));
  ["c", "d"].forEach((id) => StateLogic.Core.setOwner(s, id, "p2"));
  s.episodes = [];
  return s;
}
const locked = (s) => Object.fromEntries(StateLogic.EliminationOrderScoringStrategy.compute(s).map((r) => [r.playerId, r.locked]));
const oldFormula = (s, pid) =>
  s.castaways.filter((c) => c.ownerIds.includes(pid) && c.status === "eliminated").reduce((n, c) => n + c.placementOrder, 0);

test("castaways still in count 1 + eliminations so far; whoever went out keeps their place", () => {
  const s = league();
  assert.deepEqual(locked(s), { p1: 2, p2: 2 });
  const e1 = StateLogic.EpisodeLogic.create(s, 1, false);
  StateLogic.EpisodeLogic.addElimination(s, e1.id, "a", "voted");
  // a out 1st keeps 1; b, c, d each outlasted one = 2.
  assert.deepEqual(locked(s), { p1: 3, p2: 4 });
  assert.ok(locked(s).p2 > locked(s).p1, "the team that lost nobody leads");
});

test("a double boot counts both, and the second out outlasted the first", () => {
  const s = league();
  const e1 = StateLogic.EpisodeLogic.create(s, 1, false);
  StateLogic.EpisodeLogic.addElimination(s, e1.id, "a", "voted");
  StateLogic.EpisodeLogic.addElimination(s, e1.id, "c", "voted");
  // a=1, c=2, b and d still in after two = 3 each.
  assert.deepEqual(locked(s), { p1: 4, p2: 5 });
});

test("final totals equal the old boot-order formula", () => {
  const s = league();
  ["b", "c", "a", "d"].forEach((id, i) => {
    const ep = StateLogic.EpisodeLogic.create(s, i + 1, false);
    StateLogic.EpisodeLogic.addElimination(s, ep.id, id, i === 3 ? "Sole Survivor" : "voted");
  });
  assert.deepEqual(locked(s), { p1: oldFormula(s, "p1"), p2: oldFormula(s, "p2") });
});
