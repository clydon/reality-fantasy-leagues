// Active Roster replenish (the "down to X" threshold), scheduled swaps, the rolling reverse-draft
// priority list, and how both work under shared vs exclusive ownership. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");

// Three players (draft order a, b, c), 3 active + 2 bench, 18 castaways. Each player owns five.
// `shared` gives b and c an overlap, as a blind draft would.
function league({ shared = true, eliminated = [], completedThrough = 0, settings = {} } = {}) {
  const ids = Array.from({ length: 18 }, (_, i) => `c${i + 1}`);
  const rosters = { a: ids.slice(0, 5), b: ids.slice(5, 10), c: shared ? ["c6", "c7", ...ids.slice(10, 13)] : ids.slice(10, 15) };
  const state = S.migrateLeagueState({
    settings: {
      leagueTypeId: "active-roster", showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive",
      activeSlots: 3, benchSlots: 2, replenishEnabled: true, tradeEnabled: true, startEpisode: 1,
      replenishOrderBy: "rolling", ...settings,
    },
    players: ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), color: "#000" })),
    draftOrder: ["a", "b", "c"],
    castaways: ids.map((id, i) => ({
      id, name: id, status: eliminated.includes(id) ? "eliminated" : "active", placementOrder: eliminated.indexOf(id) + 1 || undefined,
      ownerIds: Object.entries(rosters).filter(([, r]) => r.includes(id)).map(([p]) => p),
    })),
    episodes: Array.from({ length: 12 }, (_, i) => ({
      id: `ep${i + 1}`, number: i + 1, lineups: {}, scoringEvents: [],
      // An episode "has results" once it has an elimination.
      events: i + 1 <= completedThrough ? [{ castawayId: `c${18 - i}`, method: "Voted Out" }] : [],
    })),
  });
  return state;
}
const owners = (s, id) => s.castaways.find((c) => c.id === id).ownerIds.slice().sort();

test("shared Active Roster leagues can now run replenish and swap; shared Classic Draft still can't", () => {
  assert.equal(S.replenishAvailable(league()), true);
  assert.equal(S.tradeAvailable(league()), true);
  const classic = league();
  classic.settings.leagueTypeId = "classic-draft";
  assert.equal(S.replenishAvailable(classic), false);
});

test("who's available: shared = anyone still in who isn't yours; exclusive = unowned only", () => {
  const shared = league({ eliminated: ["c16"] });
  const forB = S.availableFor(shared, "b").map((c) => c.id);
  assert.ok(forB.includes("c1"), "another player's castaway is available in shared");
  assert.ok(!forB.includes("c6"), "your own isn't");
  assert.ok(!forB.includes("c16"), "an eliminated one isn't");
  const excl = league({ shared: false });
  assert.deepEqual(S.availableFor(excl, "b").map((c) => c.id), ["c16", "c17", "c18"]);
});

test("replenish threshold: owed picks only once down to X in the game, and only back to X+1", () => {
  const s = league({ eliminated: ["c1", "c2", "c3"] }); // a has 2 of 5 left; default X = 3 - 1 = 2
  assert.equal(S.MidSeasonLogic.replenishAt(s), 2);
  assert.equal(S.replenishNeed(s, "a"), 1);
  assert.equal(S.replenishNeed(s, "b"), 0);
  const generous = league({ eliminated: ["c1", "c2"], settings: { replenishAt: 3 } });
  assert.equal(S.replenishNeed(generous, "a"), 1, "a commissioner can set a higher X");
  assert.equal(S.startReplenish(league()), false, "nobody's down to X: nothing to start");
});

test("a shared replenish adds without taking the castaway from anyone else, and releases one loss", () => {
  const s = league({ eliminated: ["c1", "c2", "c3"] });
  assert.equal(S.startReplenish(s), true);
  assert.equal(S.currentReplenishTurn(s).playerId, "a");
  S.replenishAssign(s, "c8"); // b's castaway
  assert.deepEqual(owners(s, "c8"), ["a", "b"]);
  assert.equal(S.MidSeasonLogic.inGameCount(s, "a"), 3);
  assert.equal(s.castaways.filter((c) => c.ownerIds.includes("a")).length, 5, "roster size unchanged: a loss was released");
  assert.ok(S.currentReplenishTurn(s).isComplete);
});

test("an exclusive replenish can't take someone else's castaway", () => {
  const s = league({ shared: false, eliminated: ["c1", "c2", "c3"] });
  S.startReplenish(s);
  S.replenishAssign(s, "c8");
  assert.deepEqual(owners(s, "c8"), ["b"]);
  assert.equal(S.currentReplenishTurn(s).isComplete, false, "the turn wasn't used up");
});

test("rolling priority: starts in reverse draft order, and whoever moves goes to the back", () => {
  const s = league({ completedThrough: 3 });
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), ["c", "b", "a"]);
  assert.equal(S.startTrade(s), true);
  assert.deepEqual(s.midSeason.trade.queue.map((q) => q.playerId), ["c", "b", "a"]);
  S.tradeSwap(s, "c11", "c1"); // c swaps
  S.tradeSkip(s); // b passes
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), ["b", "a", "c"], "c used it and went to the back; b kept its place");
});

test("standings priority: fewest points first, recomputed each round", () => {
  const s = league({ completedThrough: 3, settings: { replenishOrderBy: "leastPoints" } });
  // Give 'c' points: its active castaway scores in episode 1.
  s.episodes[0].lineups = { c: ["c11"] };
  s.episodes[0].scoringEvents = [{ id: "x", type: "individualImmunity", castawayId: "c11" }];
  S.startTrade(s);
  assert.equal(s.midSeason.trade.queue[2].playerId, "c", "the leader goes last");
});

test("swap windows: every 3 episodes by default, one round per window", () => {
  const s = league({ completedThrough: 2 });
  assert.equal(S.swapWindow(s).due, false);
  assert.equal(S.swapWindow(s).nextAfterEpisode, 3);
  assert.equal(S.startTrade(s), false, "no window yet");
  const open = league({ completedThrough: 3 });
  assert.deepEqual(S.swapWindow(open), { due: true, afterEpisode: 3, nextAfterEpisode: 3 });
  assert.equal(S.startTrade(open), true);
  assert.equal(S.swapWindow(open).due, false, "starting a round uses the window");
  assert.equal(S.swapWindow(open).nextAfterEpisode, 6);
  const later = league({ completedThrough: 7, settings: { swapEvery: 2 } });
  assert.deepEqual(S.swapWindow(later), { due: true, afterEpisode: 6, nextAfterEpisode: 6 });
});

test("a swap needs both halves: nothing happens if the add isn't available", () => {
  const s = league({ shared: false, completedThrough: 3 });
  S.startTrade(s);
  const before = JSON.stringify(s.castaways);
  S.tradeSwap(s, "c11", "c1"); // c1 belongs to a: not available in exclusive
  assert.equal(JSON.stringify(s.castaways), before);
  assert.equal(s.midSeason.trade.index, 0, "still c's turn");
});
