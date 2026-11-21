// Settings Round 3b (BACKLOG 165; docs/design-round/settings-r3b-spec.md, "A16"): an empty starting slot fills from the bench by
// itself, where the game says so (settings.benchFill: the first episode it does it in). Off, a starter who went home leaves the slot
// empty (the old rule, unchanged). On, the first on the bench in draft order starts in a carried lineup, only for the slots a starter
// left, never in an episode before it was turned on (no week already played moves), never over a lineup set by hand. filledFor names
// who the bench filled. The switch and its Undo are proven by scripts/dev-test/check-settings-r3b.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");

/** Ann holds a, b, c, d (drafted d before c); two start; she set [a, b] for Episode 1; b went home in Episode 1. */
function makeState(benchFill) {
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", activeSlots: 2, benchSlots: 2, showFormat: "survivor", startEpisode: 1, ...(benchFill ? { benchFill } : {}) },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), ownerIds: ["p1"], status: id === "b" ? "eliminated" : "active", ...(id === "b" ? { exitEpisodeId: "ep1" } : {}) })),
    draftLog: ["a", "b", "d", "c"].map((castawayId, i) => ({ n: i + 1, playerId: "p1", castawayId })),
    episodes: [1, 2, 3].map((n) => ({ id: `ep${n}`, number: n, events: [], lineups: n === 1 ? { p1: ["a", "b"] } : {}, scoringEvents: [] })),
  });
}
const lineup = (s, ep) => StateLogic.activeRosterLineupFor(s, ep, "p1");

test("off: a starter who went home leaves the slot empty", () => {
  const s = makeState();
  assert.deepEqual(lineup(s, "ep1"), ["a", "b"], "b played the episode they went home in");
  assert.deepEqual(lineup(s, "ep2"), ["a"]);
  assert.deepEqual(StateLogic.ActiveRosterLogic.filledFor(s, "ep2", "p1"), []);
});

test("on: the first on the bench in draft order fills the slot, and filledFor says who", () => {
  const s = makeState(1);
  assert.deepEqual(lineup(s, "ep2"), ["a", "d"], "d was drafted before c");
  assert.deepEqual(StateLogic.ActiveRosterLogic.filledFor(s, "ep2", "p1"), ["d"]);
  assert.deepEqual(lineup(s, "ep1"), ["a", "b"], "nothing to fill where nobody had gone");
});

test("turned on from Episode 3: Episode 2 stays as it was played; a lineup set by hand is never filled", () => {
  const s = makeState(3);
  assert.deepEqual(lineup(s, "ep2"), ["a"]);
  assert.deepEqual(lineup(s, "ep3"), ["a", "d"]);
  const set = makeState(1);
  set.episodes[1].lineups.p1 = ["a"];
  assert.deepEqual(lineup(set, "ep2"), ["a"], "she chose one starter: that stands");
  assert.deepEqual(StateLogic.ActiveRosterLogic.filledFor(set, "ep2", "p1"), []);
});
