// Active Roster pickups (the "down to X" threshold), add/drop weeks, the rolling reverse-draft waiver
// order, and how they work under shared vs exclusive ownership, run as waivers. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const W = S.WaiverLogic;

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
  assert.ok(["a", "b", "c"].every((p) => W.pickupsOwed(league(), p).count === 0), "nobody's down to X: nobody's owed one");
});

// A waiver week after the latest episode with results, its claims processed at once.
function runWeek(s, claims) {
  const p = W.open(s, Date.parse("2026-03-01T00:00:00Z"));
  for (const c of Object.values(claims)) Object.assign(c, { pickupIds: c.pickupIds ?? [], dropId: c.dropId ?? null, addIds: c.addIds ?? [] });
  W.process(s, claims, { now: Date.parse("2026-03-02T00:00:00Z") });
  return p;
}

test("a shared pickup adds without taking the castaway from anyone else, and releases one loss", () => {
  const s = league({ eliminated: ["c1", "c2", "c3"], completedThrough: 1 });
  runWeek(s, { a: { pickupIds: ["c8"] } }); // b's castaway
  assert.deepEqual(owners(s, "c8"), ["a", "b"]);
  assert.equal(S.MidSeasonLogic.inGameCount(s, "a"), 3);
  assert.equal(s.castaways.filter((c) => c.ownerIds.includes("a")).length, 5, "roster size unchanged: a loss was released");
});

test("an exclusive pickup can't claim someone else's castaway", () => {
  const s = league({ shared: false, eliminated: ["c1", "c2", "c3"], completedThrough: 1 });
  const p = W.open(s, Date.now());
  assert.equal(W.checkClaim(s, p, "a", { pickupIds: ["c8"] }).error, "Claim free agents only");
  assert.deepEqual(W.checkClaim(s, p, "a", { pickupIds: ["c16"] }).claim.pickupIds, ["c16"]);
});

test("rolling waiver order: starts in reverse draft order, and whoever's claim goes through goes to the back", () => {
  const s = league({ completedThrough: 3 });
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), ["c", "b", "a"]);
  runWeek(s, { c: { dropId: "c11", addIds: ["c1"] } }); // c's add/drop; b and a make none
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), ["b", "a", "c"], "c's went through and went to the back; b kept its place");
});

test("standings order: fewest points first, recomputed each week", () => {
  const s = league({ completedThrough: 3, settings: { replenishOrderBy: "leastPoints" } });
  // Give 'c' points: its active castaway scores in episode 1.
  s.episodes[0].lineups = { c: ["c11"] };
  s.episodes[0].scoringEvents = [{ id: "x", type: "individualImmunity", castawayId: "c11" }];
  assert.equal(S.MidSeasonLogic.order(s, ["a", "b", "c"])[2], "c", "the leader goes last");
});

test("add/drop weeks: every 3 episodes by default, or every swapEvery", () => {
  const s = league();
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => W.isAddDropEpisode(s, n)), [false, false, true, false, false, true, false]);
  const every2 = league({ settings: { swapEvery: 2 } });
  assert.deepEqual([5, 6, 7].map((n) => W.isAddDropEpisode(every2, n)), [false, true, false]);
  assert.equal(W.open(league({ completedThrough: 3 }), Date.now()).addDrop, true);
  assert.equal(W.open(league({ completedThrough: 2, settings: { tradeEnabled: false } }), Date.now()).addDrop, false);
});

test("an add/drop claim needs both halves, and the add has to be free", () => {
  const s = league({ shared: false, completedThrough: 3 });
  const p = W.open(s, Date.now());
  assert.equal(W.checkClaim(s, p, "c", { addIds: ["c16"] }).error, "Choose who to drop");
  assert.equal(W.checkClaim(s, p, "c", { dropId: "c11" }).error, "Choose who to add");
  assert.equal(W.checkClaim(s, p, "c", { dropId: "c11", addIds: ["c1"] }).error, "Claim free agents only", "c1 is a's");
});

test("switching over mid-window: a swap from the old live rounds after that episode uses the week's add/drop", () => {
  const s = league({ completedThrough: 3 });
  // What a live round's swap left in the log: no waiver week, the episode it followed.
  s.midSeason.log.push({ id: "tx_old", type: "trade", playerId: "c", addedCastawayId: "c1", droppedCastawayId: "c11", episode: 3, at: "2026-02-28T00:00:00Z" });
  const p = W.open(s, Date.now());
  assert.equal(W.addDropUsed(s, p, "c"), true);
  assert.equal(W.addDropUsed(s, p, "b"), false);
  assert.equal(W.checkClaim(s, p, "c", { dropId: "c12", addIds: ["c2"] }).error, "You’ve made this week’s add/drop");
  const earlier = { ...s.midSeason.log[0], id: "tx_older", playerId: "b", episode: 2 };
  s.midSeason.log.push(earlier);
  assert.equal(W.addDropUsed(s, p, "b"), false, "a swap after an earlier episode doesn't count");
});
