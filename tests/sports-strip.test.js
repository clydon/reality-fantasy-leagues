// The hub's scores strip: which games, in what order (src/lib/sports/strip.ts; docs/PLAN-sports-couch.md A1), and the line in words
// (src/lib/sports/matchup.ts lineWords). Yours only (your teams' games and the games you play); live, then just finished, then
// today's by kickoff, then each team's next; a final until seen, at most 36 hours; a hidden game never told by where it sits.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { stripGames, needsLaterWeek, FRESH_MS } = jiti("../src/lib/sports/strip.ts");
const { lineWords } = jiti("../src/lib/sports/matchup.ts");

const H = 3600_000;
const NOW = Date.parse("2026-11-22T19:40:00Z"); // Sunday 2:40 PM in the East
const iso = (ms) => new Date(NOW + ms).toISOString();
// The phone's day, in the East (the tests' clock): a fixed offset is fine for one November afternoon.
const dayOf = (at) => new Date(Date.parse(at) - 5 * H).toISOString().slice(0, 10);
const L = "football/nfl";
const game = (id, a, h, ms, state = "pre", extra = {}) => ({ id, league: L, at: iso(ms), state, final: state === "post", sides: [{ id: a }, { id: h }], ...extra });
const ids = (r) => r.map((x) => `${x.g.id}:${x.bucket}`);
const run = (games, o = {}) =>
  stripGames({
    games,
    yours: new Set(o.yours ?? [`${L}|NE`, `${L}|DAL`, `${L}|PIT`]),
    played: new Map(Object.entries(o.played ?? {})),
    hidden: o.hidden ?? (() => false),
    seen: o.seen ?? (() => false),
    now: NOW,
    dayOf,
  });

const SLATE = [
  game("ten-dal", "TEN", "DAL", -1.5 * H, "in"),
  game("pit-phi", "PIT", "PHI", -1.6 * H, "in"),
  game("buf-kc", "BUF", "KC", -1.5 * H, "in"), // nobody's: not here
  game("dal-was-last", "DAL", "WAS", -7 * 24 * H, "post"), // a week old: gone
  game("pit-bal-thu", "PIT", "BAL", -3 * 24 * H, "post"), // Thursday's, past 36 hours: gone
  game("nyj-lac", "NYJ", "LAC", 1.4 * H),
  game("jax-nyg", "JAX", "NYG", 1.75 * H),
  game("ne-lac", "NE", "LAC", 7 * 24 * H + 1.4 * H), // the Patriots' bye: next Sunday
  game("dal-nyg", "DAL", "NYG", 4 * 24 * H), // the Cowboys' next game after today's: not here
  game("sea-sf-mnf", "SEA", "SF", 30 * H), // nobody's
];

test("yours only, in the strip's order: live by kickoff, today's by kickoff, each team's next", () => {
  // Pick'em on the Jets–Chargers and Jaguars–Giants games: games you play.
  const played = { "nyj-lac": { seasonId: "s1", episode: 3 }, "jax-nyg": { seasonId: "s1", episode: 4 } };
  assert.deepEqual(ids(run(SLATE, { played })), ["pit-phi:live", "ten-dal:live", "nyj-lac:today", "jax-nyg:today", "ne-lac:next"]);
});

test("a game you play that isn't the next of its season, on a later day, waits", () => {
  const games = [game("a", "X", "Y", 30 * H), game("b", "X", "Y", 54 * H)];
  assert.deepEqual(ids(run(games, { yours: [], played: { a: { seasonId: "s", episode: 1 }, b: { seasonId: "s", episode: 2 } } })), ["a:next"]);
});

test("a final stays until seen, at most 36 hours, the latest first", () => {
  const games = [game("early", "NE", "NYJ", -20 * H, "post"), game("late", "DAL", "NYG", -4 * H, "post"), game("old", "PIT", "CLE", -(FRESH_MS + H), "post")];
  assert.deepEqual(ids(run(games)), ["late:final", "early:final"]);
  assert.deepEqual(ids(run(games, { seen: (id) => id === "late" })), ["early:final"]);
});

test("a hidden game that's begun says only started: on or over, it sorts by kickoff with the live ones", () => {
  const games = [game("over", "NE", "NYJ", -3.5 * H, "post"), game("on", "DAL", "NYG", -1 * H, "in"), game("later", "PIT", "CLE", 2 * H)];
  const r = run(games, { hidden: (g) => g.state !== "pre" });
  assert.deepEqual(ids(r), ["over:started", "on:started", "later:today"]);
  // Flip which one is over: the order is the same (where a game sits gives nothing away).
  const flipped = [game("over", "NE", "NYJ", -3.5 * H, "in"), game("on", "DAL", "NYG", -1 * H, "post"), game("later", "PIT", "CLE", 2 * H)];
  assert.deepEqual(ids(run(flipped, { hidden: (g) => g.state !== "pre" })).join(), ids(r).join());
});

test("one game watched as if live among the open ones: started, in kickoff order with the live", () => {
  const games = [game("a", "NE", "NYJ", -2 * H, "in"), game("b", "DAL", "NYG", -1 * H, "post")];
  assert.deepEqual(ids(run(games, { hidden: (g) => g.id === "b" })), ["a:live", "b:started"]);
});

test("a game called off isn't on the strip; begun by the clock with no word yet counts as on", () => {
  const games = [game("pp", "NE", "NYJ", -1 * H, "post", { final: false, called: "postponed" }), game("late-word", "DAL", "NYG", -0.1 * H, "pre")];
  assert.deepEqual(ids(run(games)), ["late-word:live"]);
});

test("none of yours: an empty strip (the hub draws none)", () => {
  assert.deepEqual(run(SLATE, { yours: [] }), []);
});

test("a bye: the week after is read only when a team of yours has nothing left", () => {
  const thisWeek = SLATE.filter((g) => g.id !== "ne-lac");
  assert.equal(needsLaterWeek(thisWeek, new Set([`${L}|NE`]), NOW), true);
  assert.equal(needsLaterWeek(thisWeek, new Set([`${L}|DAL`]), NOW), false);
  assert.equal(needsLaterWeek(thisWeek, new Set(), NOW), false);
});

test("the line in words: the favourite and the points, never the book", () => {
  assert.equal(lineWords("LAC -3"), "LAC by 3");
  assert.equal(lineWords("JAX -6.5"), "JAX by 6.5");
  assert.equal(lineWords("ZPHI -3.5"), "ZPHI by 3.5");
  assert.equal(lineWords("EVEN"), "Even");
  assert.equal(lineWords("PK"), "Even");
  assert.equal(lineWords("LAC -0"), "Even");
  assert.equal(lineWords(null), null);
  assert.equal(lineWords("o/u 44.5"), null);
});
