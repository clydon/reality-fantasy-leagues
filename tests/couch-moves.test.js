// Couch points' moves kept in a league's state (src/lib/game/couch-moves.ts, the user's 2026-10-31 call): pool picks, the player's
// own draft picks (or, before the draft log, each castaway an exclusive draft gave a seat), and lineups only when they put someone
// new in; then counted all time, this year and this week. No database: made-up states. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { stateMoves, movesCounted } = jiti("../src/lib/game/couch-moves.ts");

const DAY = 24 * 3600 * 1000;
const air = (n) => (n <= 3 ? 1000 * n : null);
const ep = (number, more = {}) => ({ number, picks: [], lineups: {}, ...more });
const tally = (moves) => moves.reduce((m, x) => ({ ...m, [x.playerId]: (m[x.playerId] ?? 0) + 1 }), {});

test("a pool pick an episode, at its airtime (a second pick the same night is the same move)", () => {
  const state = { settings: {}, castaways: [], episodes: [ep(1, { picks: [{ playerId: "ann", castawayId: "a" }, { playerId: "bo", castawayId: "b", second: "c" }] }), ep(4, { picks: [{ playerId: "ann", castawayId: "d" }] })] };
  const moves = stateMoves(state, air, 77);
  assert.deepEqual(tally(moves), { ann: 2, bo: 1 });
  assert.deepEqual(moves.filter((m) => m.playerId === "ann").map((m) => m.at), [1000, 77], "no airtime: the fallback");
});

test("draft picks: the player's own from the log; before the log, each castaway an exclusive draft gave a seat", () => {
  const log = [
    { n: 1, playerId: "ann", castawayId: "a", at: "2026-09-27T20:00:00Z" },
    { n: 2, playerId: "bo", castawayId: "b", at: "2026-09-27T20:01:00Z", by: "u-commish" },
    { n: 3, playerId: "bo", castawayId: "c", at: "2026-09-27T20:02:00Z", auto: true },
    { n: 4, playerId: "cy", castawayId: "d", at: "2026-09-27T20:03:00Z", drawn: true },
    { n: 5, playerId: "cy", castawayId: "e", at: "2026-09-27T20:04:00Z", price: 1, filled: true },
    { n: 6, playerId: "cy", castawayId: "f", at: "2026-09-27T20:05:00Z", price: 12 },
  ];
  const logged = stateMoves({ settings: {}, castaways: [], episodes: [], draftLog: log }, air, 0);
  assert.deepEqual(logged, [{ playerId: "ann", at: Date.parse("2026-09-27T20:00:00Z") }, { playerId: "cy", at: Date.parse("2026-09-27T20:05:00Z") }], "not made for them, from the queue, drawn or filled");
  const castaways = [
    { id: "a", ownerIds: ["ann"], acquiredVia: "draft" },
    { id: "b", ownerIds: ["ann"], acquiredVia: "draft" },
    { id: "c", ownerIds: ["bo"], acquiredVia: "replenish" },
    { id: "d", ownerIds: [], acquiredVia: null },
  ];
  assert.deepEqual(tally(stateMoves({ settings: { ownershipMode: "exclusive" }, castaways, episodes: [] }, air, 5)), { ann: 2 }, "before the log: drafted castaways, not a pickup");
  assert.deepEqual(stateMoves({ settings: { ownershipMode: "shared" }, castaways, episodes: [] }, air, 5), [], "a shared draft's picks are blind_draft_picks, counted elsewhere");
});

test("a lineup counts when it's the first or puts someone new in, not when carrying it forward dropped someone", () => {
  const state = {
    settings: {},
    castaways: [],
    episodes: [
      ep(1, { lineups: { ann: ["a", "b"], bo: [] } }),
      ep(2, { lineups: { ann: ["a", "b"], bo: ["x"] } }),
      ep(3, { lineups: { ann: ["a"], bo: ["x"] } }),
      ep(4, { lineups: { ann: ["a", "c"] } }),
      ep(5, { lineups: { ann: ["c", "a"] } }),
    ],
  };
  const moves = stateMoves(state, air, 99);
  assert.deepEqual(
    moves.map((m) => [m.playerId, m.at]),
    [["ann", 1000], ["bo", 2000], ["ann", 99]],
    "ann's first, bo's first real one (an empty one isn't), ann bringing c in at Episode 4; carried, dropped and reordered aren't"
  );
});

test("counted all time, this year and this week", () => {
  const now = Date.parse("2026-10-31T16:00:00Z");
  const yearStart = Date.parse("2026-01-01T05:00:00Z");
  const counts = movesCounted(
    [
      { userId: "ann", at: now - DAY },
      { userId: "ann", at: now - 30 * DAY },
      { userId: "ann", at: Date.parse("2025-12-31T23:00:00Z") },
      { userId: "bo", at: now + 3 * DAY },
    ],
    yearStart,
    now
  );
  assert.deepEqual(counts, [
    { userId: "ann", kind: "move", all: 3, year: 2, week: 1 },
    { userId: "bo", kind: "move", all: 1, year: 1, week: 1 },
  ], "New Year's Eve at 6 PM Eastern is last year; a pick for next week's episode counts this week");
});
