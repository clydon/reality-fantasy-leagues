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

// ---- BACKLOG 57: a carried lineup reads who the seat held FOR THAT EPISODE, never who it holds now ----
// A free agent to bring in, and the moves as the waivers make them (MidSeasonLogic, each logged at the episode whose results came
// before it: a move logged at episode k counts from k + 1).
function withFreeAgent(s) {
  s.castaways.push({ id: "f", name: "F", ownerIds: [], status: "active" });
  s.episodes.forEach((e) => e.scoringEvents.push({ id: `s${e.number}f`, type: "individualImmunity", castawayId: "f" }));
  return s;
}
const M = StateLogic.MidSeasonLogic;

test("a starter swapped out later still counts for the weeks already played with them (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  const before = total(s, "p1");
  // After episode 2: b out for f.
  M.applyAddDrop(s, "p1", "b", "f", { episode: 2 });
  assert.deepEqual(lineup(s, "ep1", "p1"), ["a", "b"]);
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a", "b"], "played before the swap: as it was fielded");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a"], "after the swap: a gap to fill");
  assert.equal(total(s, "p1"), (2 + 2 + 1) * per(s));
  assert.equal(before, 6 * per(s));
});

test("a swap after the last episode played changes no total (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  const before = total(s, "p1");
  M.applyAddDrop(s, "p1", "b", "f", { episode: 3 });
  assert.equal(total(s, "p1"), before);
  [1, 2, 3].forEach((n) => assert.deepEqual(lineup(s, `ep${n}`, "p1"), ["a", "b"]));
});

test("replacing a starter who went home keeps the week they played, and leaves a gap after it (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  // b goes home in episode 2, and is replaced after it.
  const b = s.castaways.find((c) => c.id === "b");
  b.status = "eliminated";
  b.exitEpisodeId = "ep2";
  s.episodes[1].events = [{ castawayId: "b", method: "Voted Out" }];
  const before = total(s, "p1");
  M.applyPickup(s, "p1", "f", "b", { episode: 2 });
  assert.equal(total(s, "p1"), before, "no new results: no new total");
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a", "b"], "they played the episode they went home in");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a"]);
});

test("someone let go and brought back carries only into the weeks they were held for (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  M.applyAddDrop(s, "p1", "f", "b", { episode: 2 });
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"], "not theirs for episode 2");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a", "b"], "theirs again for episode 3");
});

test("taking a move back gives every carried week its lineup again (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  const tx = M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"]);
  M.revert(s, tx);
  s.midSeason.log = s.midSeason.log.filter((x) => x.id !== tx.id);
  [1, 2, 3].forEach((n) => assert.deepEqual(lineup(s, `ep${n}`, "p1"), ["a", "b"]));
});

test("a new episode's lineups are copied in from who each seat holds for it (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes = s.episodes.slice(0, 2);
  s.episodes[0].lineups.p1 = ["a", "b"];
  s.episodes[1].lineups = {};
  M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  StateLogic.ActiveRosterLogic.carryForwardLineups(s, "ep2");
  assert.deepEqual(s.episodes[1].lineups.p1, ["a"]);
});

test("a seat ahead of the move's episode keeps the weeks it had played (its own pace, a waiver week at everyone's episode) (BACKLOG 57)", () => {
  const s = withFreeAgent(makeState());
  s.episodes[0].lineups.p1 = ["a", "b"];
  // p1 has played through episode 3 at its own pace; the week everyone has reached is episode 1's, and p1 swaps b out in it.
  s.players.find((p) => p.id === "p1").lateJoin = { startEpisode: 1, catchingUp: false, seenThrough: 3 };
  const before = total(s, "p1");
  const tx = M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  assert.equal(tx.seen, 3, "the move keeps how far its seat had played");
  assert.equal(total(s, "p1"), before, "no week it had played changes");
  [1, 2, 3].forEach((n) => assert.deepEqual(lineup(s, `ep${n}`, "p1"), ["a", "b"]));
  // A seat that hadn't played past the move's episode: the move counts from the next one, as ever.
  const t = withFreeAgent(makeState());
  t.episodes[0].lineups.p1 = ["a", "b"];
  t.players.find((p) => p.id === "p1").lateJoin = { startEpisode: 1, catchingUp: true, seenThrough: 1 };
  const tx2 = M.applyAddDrop(t, "p1", "b", "f", { episode: 1 });
  assert.equal(tx2.seen, undefined);
  assert.deepEqual(lineup(t, "ep2", "p1"), ["a"], "a week it hasn't played: a gap to fill");
});

// ---- BACKLOG 69: a lineup SET for an episode leaves out whoever its seat let go before that episode ----
// A live game saves every seat's next lineup as the episode is made, so a swap before it airs used to leave the old starter in
// it: scoring for a team that no longer held them. Read from the move log, never written into the lineup.

test("a starter swapped away before an episode leaves the lineup saved for it: a gap, not the new one (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  // After episode 1: b out for f.
  M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  assert.deepEqual(lineup(s, "ep1", "p1"), ["a", "b"], "the week played with them: untouched");
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"], "let go before it: a gap to fill");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a"]);
  assert.deepEqual(s.episodes[1].lineups.p1, ["a", "b"], "nothing saved is rewritten");
  assert.equal(StateLogic.ActiveRosterLogic.lineupIsCarried(s, "ep2", "p1"), false);
  assert.equal(total(s, "p1"), (2 + 1 + 1) * per(s), "nobody scores for a team that let them go");
  // Saving a lineup again fills the gap with whoever they hold now.
  s.episodes[1].events = [];
  s.episodes[1].scoringEvents = [];
  assert.equal(StateLogic.ActiveRosterLogic.validateLineup(s, "ep2", "p1", ["a", "b"]), "B isn't on your roster");
});

test("taking the move back brings them back to the saved lineup (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  const tx = M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"]);
  M.revert(s, tx);
  s.midSeason.log = s.midSeason.log.filter((x) => x.id !== tx.id);
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a", "b"]);
});

test("a move after an episode never touches the lineup saved for it (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  const before = total(s, "p1");
  M.applyAddDrop(s, "p1", "b", "f", { episode: 3 });
  [1, 2, 3].forEach((n) => assert.deepEqual(lineup(s, `ep${n}`, "p1"), ["a", "b"]));
  assert.equal(total(s, "p1"), before);
});

test("someone brought back before the episode is in its saved lineup again (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  M.applyAddDrop(s, "p1", "f", "b", { episode: 2 });
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a"], "not theirs for episode 2");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a", "b"], "theirs again for episode 3");
});

test("only the log lets someone go: a roster changed by hand leaves a saved lineup as it was (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  s.castaways.find((c) => c.id === "b").ownerIds = ["p2"];
  [1, 2, 3].forEach((n) => assert.deepEqual(lineup(s, `ep${n}`, "p1"), ["a", "b"]));
});

test("someone who hasn't seen the move still sees the saved lineup whole (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  M.applyAddDrop(s, "p1", "b", "f", { episode: 2 });
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a"]);
  // A viewer through episode 1: the move, made after episode 2, is taken back on their copy.
  const view = StateLogic.SpoilerLogic.viewThrough(s, 1);
  assert.deepEqual(lineup(view, "ep3", "p1"), ["a", "b"]);
});

test("a seat ahead of the move's episode keeps the lineups it saved for weeks it had played (BACKLOG 69)", () => {
  const s = withFreeAgent(makeState());
  s.episodes.forEach((e) => (e.lineups.p1 = ["a", "b"]));
  s.players.find((p) => p.id === "p1").lateJoin = { startEpisode: 1, catchingUp: false, seenThrough: 2 };
  const before = total(s, "p1");
  // The week everyone has reached is episode 1's; p1, through 2, swaps in it.
  M.applyAddDrop(s, "p1", "b", "f", { episode: 1 });
  assert.deepEqual(lineup(s, "ep2", "p1"), ["a", "b"], "played before the move: as fielded");
  assert.deepEqual(lineup(s, "ep3", "p1"), ["a"], "the first week it hadn't played: a gap");
  assert.equal(total(s, "p1"), before - per(s));
});
