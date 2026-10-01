// StateLogic.SpoilerLogic: one viewer's held-back results. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");
const S = StateLogic.SpoilerLogic;

function season() {
  const s = StateLogic.defaultState();
  s.players = [{ id: "p1", name: "A", color: "#f00", active: true, disabled: false }];
  s.tribes = [{ id: "t1", name: "Kele", color: "#00f" }, { id: "t2", name: "Merged", color: "#0f0" }];
  const c = (id) => ({ id, name: id, tribeId: "t1", ownerIds: ["p1"], status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null });
  s.castaways = [c("a"), c("b"), c("c")];
  s.episodes = [1, 2, 3].map((n) => ({ id: "e" + n, number: n, postMerge: false, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }));
  StateLogic.addElimination(s, "e1", "a", "Voted Out");
  StateLogic.addElimination(s, "e2", "b", "Voted Out");
  s.episodes[1].postMerge = true;
  StateLogic.GroupLogic.add(s, "e2", "c", "Merged");
  s.episodes[1].bets = [{ id: "bt", label: "?", points: 1, predictions: [{ id: "p", playerId: "p1", guess: "b", correct: true }] }];
  return s;
}

test("seen through 1: episode 2's elimination, merge, tribe move and grading are all held back", () => {
  const s = season();
  const v = S.viewThrough(s, 1);
  assert.deepEqual(S.hiddenEpisodes(s, 1).map((e) => e.number), [2]);
  assert.equal(v.castaways.find((c) => c.id === "a").status, "eliminated", "episode 1 is still seen");
  const b = v.castaways.find((c) => c.id === "b");
  assert.equal(b.status, "active");
  assert.equal(b.placementOrder, null);
  assert.equal(v.castaways.find((c) => c.id === "c").tribeId, "t1", "back in their tribe from before the move");
  assert.equal(v.episodes[1].postMerge, false);
  assert.equal(v.episodes[1].events.length, 0);
  assert.equal(v.episodes[1].bets[0].predictions[0].correct, null);
  assert.ok(v.episodes[1].resultsHidden);
});

test("the real state is untouched, and nothing hidden returns it as-is", () => {
  const s = season();
  S.viewThrough(s, 0);
  assert.equal(s.castaways.find((c) => c.id === "b").status, "eliminated");
  assert.equal(S.viewThrough(s, 2), s);
  assert.equal(S.viewThrough(s, null), s);
  assert.equal(S.latestWithResults(s), 2);
});
