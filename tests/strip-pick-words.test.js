// The strip names a pick's game when another pick game is on for that episode (BACKLOG 240, the user's yes, 2026-11-21): the Games
// tab's round found "Pick who survives" read as the one-episode game "Who survives?" beside it. src/new/show/pick-words.ts
// pickWords. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { pickWords } = jiti("../src/new/show/pick-words.ts");

const game = (leagueId, gameType, name, gameName, span = null, extra = {}) => ({ leagueId, gameType, name, gameName, span, couchId: "c", seasonId: "s", groupId: null, yourRole: "member", ...extra });
const pool = game("pool", "pickem", "Pool Party", "Survival Pool");
const lineup = game("lineup", "active-roster", "Lineup League", "Weekly Lineup");
const pick = (leagueId, episode = 7) => ({ kind: "pick", leagueId, episode });

test("The only pick game: the strip's words as they were", () => {
  assert.equal(pickWords({ games: [pool, lineup] }, pick("pool")), null);
});

test("A one-episode pick game on for the same episode (yours or not): the season pool is named", () => {
  const quick = game("q7", "pickem", "Who survives? Ep 7", "Survival Pool", { from: 7, to: 7 }, { yourRole: null });
  assert.equal(pickWords({ games: [pool, lineup, quick] }, pick("pool")), "Survival Pool: pick who survives");
});

test("A one-episode pick game for another episode, or archived: not counted", () => {
  const other = game("q9", "pickem", "Who survives? Ep 9", "Survival Pool", { from: 9, to: 9 });
  const old = game("old", "pickem", "Old Pool", "Survival Pool", null, { archived: true });
  assert.equal(pickWords({ games: [pool, other, old] }, pick("pool")), null);
});

test("The one-episode game's own pick: by its own name", () => {
  const quick = game("q7", "pickem", "Who goes home? Ep 7", "Survival Pool", { from: 7, to: 7 });
  assert.equal(pickWords({ games: [pool, quick] }, pick("q7")), "Who goes home?");
});

test("A second pool on the couch you don't play: your pool keeps the game's name (the Games tab's rows count your games)", () => {
  const theirs = game("pool3", "pickem", "Second Chance Pool", "Survival Pool", null, { yourRole: null });
  assert.equal(pickWords({ games: [pool, theirs] }, pick("pool")), "Survival Pool: pick who survives");
});

test("Two season pools: each by its own name, as the Games tab's rows", () => {
  const second = game("pool2", "pickem", "Second Chance Pool", "Survival Pool");
  assert.equal(pickWords({ games: [pool, second] }, pick("pool2")), "Second Chance Pool: pick who survives");
});

test("Not a pick: nothing", () => {
  assert.equal(pickWords({ games: [pool, lineup] }, { kind: "lineup", leagueId: "lineup", episode: 7 }), null);
});
