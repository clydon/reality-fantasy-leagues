// Recent changes' Undo keeps a night's order (src/lib/game/results-changes.ts: resultsDiff records each exit a write took
// out with its place in the night, `at`; undoResults hands the night, each put back at its place, to decision-apply.ts
// orderPlacementsByEpisode's `within`). Put back, one of a double boot's exits used to come after the night's others,
// swapping their finishing places in the game (and Outlast's points, which are the finishing order): the same fault the
// season sync had (tests/night-order.test.js), seen fixing it (docs/PLAN-researched-survivor.md, "Noticed, not fixed").
// A change recorded before `at` existed still undoes as it did. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const { resultsDiff, undoResults } = jiti("../src/lib/game/results-changes.ts");

const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Edsger Dijkstra", "Barbara Liskov", "Donald Knuth", "Frances Allen"];

/** A game with Ada out in Episode 1, and the night of Episode 2's exits, first out first. */
function league(night) {
  const s = StateLogic.defaultState();
  s.settings.showId = "my-show";
  s.settings.showFormat = "survivor";
  StateLogic.applyCastImport(s, { castaways: CAST.map((name) => ({ name })) });
  StateLogic.addElimination(s, StateLogic.ensureEpisodeNumber(s, 1, false).id, castaway(s, "Ada Lovelace").id, "Voted Out");
  const ep2 = StateLogic.ensureEpisodeNumber(s, 2, false);
  for (const name of night) StateLogic.addElimination(s, ep2.id, castaway(s, name).id, "Voted Out");
  return s;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
const castaway = (s, name) => s.castaways.find((c) => c.name === name);
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const first = (name) => name.split(" ")[0];
/** Who's out, first out first: "Ada 1 Voted Out". */
const places = (s) =>
  s.castaways
    .filter((c) => c.status === "eliminated")
    .sort((a, b) => a.placementOrder - b.placementOrder)
    .map((c) => `${first(c.name)} ${c.placementOrder} ${c.exitMethod}`);
/** An episode's list of exits, in its order. */
const exits = (s, n) => ep(s, n).events.map((e) => first(s.castaways.find((c) => c.id === e.castawayId).name));
/** A commissioner's hand edit (the eliminations routes): the write, and the change Recent changes records for it. */
function edit(s, write) {
  const before = clone(s);
  write(s);
  return resultsDiff(before, s, 2);
}
const takeOut = (s, name) => StateLogic.removeElimination(s, ep(s, 2).id, castaway(s, name).id);

test("a double boot, the first taken out by hand and put back by Undo: both keep their places, and Outlast's points", () => {
  const s = league(["Grace Hopper", "Alan Turing"]);
  const was = places(s);
  assert.deepEqual(was, ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out"]);
  const change = edit(s, (x) => takeOut(x, "Grace Hopper"));
  assert.deepEqual(change.removed, [{ kind: "elimination", castawayId: castaway(s, "Grace Hopper").id, method: "Voted Out", juryVotes: null, at: 0 }]);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Alan 2 Voted Out"]);

  undoResults(s, change);
  assert.deepEqual(places(s), was);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
  // Outlast scores the finishing order: out 2nd is 2 points, out 3rd 3.
  assert.equal(StateLogic.EliminationOrderScoringStrategy.castawayPoints(s, castaway(s, "Grace Hopper")), 2);
  assert.equal(StateLogic.EliminationOrderScoringStrategy.castawayPoints(s, castaway(s, "Alan Turing")), 3);
});

test("how the first left, changed in one write (out and in again) and undone: back in its place, as it was", () => {
  const s = league(["Grace Hopper", "Alan Turing"]);
  const change = edit(s, (x) => {
    takeOut(x, "Grace Hopper");
    StateLogic.addElimination(x, ep(x, 2).id, castaway(x, "Grace Hopper").id, "Medically Evacuated");
  });
  // The write itself put her after Alan (addElimination hands out the next place); the undo puts her first again.
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Alan 2 Voted Out", "Grace 3 Medically Evacuated"]);
  undoResults(s, change);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
});

test("a triple: the middle one back in the middle; two taken out in one write both back in their places", () => {
  const s = league(["Grace Hopper", "Alan Turing", "Edsger Dijkstra"]);
  const was = places(s);
  const middle = edit(s, (x) => takeOut(x, "Alan Turing"));
  undoResults(s, middle);
  assert.deepEqual(places(s), was);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan", "Edsger"]);

  const two = edit(s, (x) => {
    takeOut(x, "Grace Hopper");
    takeOut(x, "Edsger Dijkstra");
  });
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Alan 2 Voted Out"]);
  undoResults(s, two);
  assert.deepEqual(places(s), was);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan", "Edsger"]);
});

test("another exit added that night since keeps its place; a later episode stays after", () => {
  const s = league(["Grace Hopper", "Alan Turing"]);
  StateLogic.addElimination(s, StateLogic.ensureEpisodeNumber(s, 3, false).id, castaway(s, "Barbara Liskov").id, "Voted Out");
  const change = edit(s, (x) => takeOut(x, "Grace Hopper"));
  // Then the commissioner enters a third that night, Donald, after Alan (by hand it takes the next place, after Episode 3's
  // Barbara, until something orders the season again: the undo does).
  edit(s, (x) => StateLogic.addElimination(x, ep(x, 2).id, castaway(x, "Donald Knuth").id, "Quit"));
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Alan 2 Voted Out", "Barbara 3 Voted Out", "Donald 4 Quit"]);
  undoResults(s, change);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out", "Donald 4 Quit", "Barbara 5 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan", "Donald"]);
});

test("a change recorded before a removed exit kept its place still undoes as it did: put back after the night's others", () => {
  const s = league(["Grace Hopper", "Alan Turing"]);
  const change = edit(s, (x) => takeOut(x, "Grace Hopper"));
  for (const r of change.removed) delete r.at;
  undoResults(s, change);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Alan 2 Voted Out", "Grace 3 Voted Out"]);
  assert.equal(castaway(s, "Grace Hopper").status, "eliminated");
});
