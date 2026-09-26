// Active Roster: a player who doesn't set a lineup for an episode fields their most recent earlier
// one (ActiveRosterLogic.lineupFor), and scoring follows that same rule. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");

// Two players, three episodes, two active slots. Each castaway earns one immunity (a scoring event)
// in every episode, so a player's score is just "how many of their fielded castaways, per episode".
function makeState() {
  const state = StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", activeSlots: 2, benchSlots: 1, showFormat: "survivor", startEpisode: 1 },
    players: [
      { id: "p1", name: "Ann", color: "#111" },
      { id: "p2", name: "Bo", color: "#222" },
    ],
    castaways: ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      name: id.toUpperCase(),
      ownerIds: ["a", "b", "c"].includes(id) ? ["p1"] : ["p2"],
      status: "active",
    })),
    episodes: [1, 2, 3].map((n) => ({
      id: `ep${n}`,
      number: n,
      events: [],
      lineups: {},
      scoringEvents: ["a", "b", "c", "d", "e"].map((cid) => ({ id: `s${n}${cid}`, type: "individualImmunity", castawayId: cid })),
    })),
  });
  return state;
}

const lineup = (state, ep, pid) => StateLogic.activeRosterLineupFor(state, ep, pid);
const total = (state, pid) => StateLogic.computeScores(state).find((r) => r.playerId === pid).total;
const per = (state) => StateLogic.ActiveRosterLogic.pointsFor(state, "individualImmunity");

test("an episode with no lineup set reuses the last one chosen", () => {
  const s = makeState();
  s.episodes[0].lineups.p1 = ["a", "b"];
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a", "b"]);
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a", "b"]);
  assert.equal(StateLogic.ActiveRosterLogic.lineupIsCarried(s, "ep3", "p1"), true);
  assert.equal(StateLogic.ActiveRosterLogic.lineupIsCarried(s, "ep1", "p1"), false);
  // Scored all three weeks: 2 fielded x 3 episodes.
  assert.equal(total(s, "p1"), 6 * per(s));
});

test("the most recent lineup wins, and a newer one takes over from there", () => {
  const s = makeState();
  s.episodes[0].lineups.p1 = ["a", "b"];
  s.episodes[1].lineups.p1 = ["c"];
  assert.deepEqual(lineup(s, "ep3", "p1"), ["c"]);
  assert.equal(total(s, "p1"), (2 + 1 + 1) * per(s));
});

test("a lineup deliberately set to empty is respected, not replaced", () => {
  const s = makeState();
  s.episodes[0].lineups.p1 = ["a", "b"];
  s.episodes[1].lineups.p1 = [];
  assert.deepEqual(lineup(s, "ep2", "p1"), []);
  assert.deepEqual(lineup(s, "ep3", "p1"), []);
  assert.equal(total(s, "p1"), 2 * per(s));
});

test("a carried lineup drops anyone no longer owned", () => {
  const s = makeState();
  s.episodes[0].lineups.p1 = ["a", "b"];
  s.castaways.find((c) => c.id === "b").ownerIds = ["p2"];
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"]);
});

test("a player who has never set a lineup fields nobody", () => {
  const s = makeState();
  assert.deepEqual(lineup(s, "ep3", "p2"), []);
  assert.equal(total(s, "p2"), 0);
});

test("the Scoreboard's event history follows the same rule as the score", () => {
  const s = makeState();
  s.episodes[0].lineups.p1 = ["a"];
  const { playerEventRows } = require("../src/lib/game/active-roster-rows.ts");
  const rows = playerEventRows(s, "p1");
  assert.deepEqual(rows.map((r) => r.episode), [1, 2, 3]);
  assert.equal(rows.reduce((sum, r) => sum + r.points, 0), total(s, "p1"));
});
