// The commissioner's Remind everyone (src/lib/server/remind-moves.js, the pure half of backstage-remind.ts): who hears, who's
// skipped inside the cooldown, and what one person's push says. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { COOLDOWN, KIND, splitDue, remindMessage, whenText, shortEp } = require("../src/lib/server/remind-moves.js");

test("shortEp: a show's Ep, a sport's Wk or G, an unknown word as it is", () => {
  assert.deepEqual([shortEp(null), shortEp("Week"), shortEp("game"), shortEp("Leg")], ["Ep", "Wk", "G", "Leg"]);
});

const SEASON = { id: "s51", label: "Survivor 51" };
const NOW = new Date("2026-11-04T20:00:00Z");
const lineup = { leagueId: "L1", leagueName: "Lineup League", text: "Set your episode 6 lineup (1 empty slot)", href: "/lineup", episode: 6 };
const pick = { leagueId: "L2", leagueName: "Pool", text: "Make your episode 6 pick", href: "/pick", episode: 6 };

test("the cooldown is a few hours and the log's kind is its own", () => {
  assert.equal(COOLDOWN, 4 * 3600 * 1000);
  assert.equal(KIND, "manual");
});

test("who hears: anyone with a move open, except the one tapping and anyone reminded from here lately", () => {
  const moves = new Map([
    ["alex", [lineup]], // tapping
    ["riley", [lineup, pick]],
    ["jordan", []], // nothing open
    ["sam", [pick]], // heard an hour ago
  ]);
  assert.deepEqual(splitDue(moves, new Set(["sam"]), "alex"), { due: ["riley"], skipped: ["sam"] });
});

test("one push per person: the news first (when the episode's moves lock), the season, the games named when there's more than one", () => {
  const next = { number: 6, airAt: new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString() };
  const m = remindMessage([{ ...lineup, kind: "lineup" }, { ...pick, kind: "pick" }], SEASON, next, "alex", NOW);
  assert.equal(m.title, "Ep 6 locks in about 3 hours");
  assert.equal(m.body, "Survivor 51 · alex sent a reminder · Lineup League: set your lineup (1 empty slot) · Pool: make your pick");
  assert.equal(m.url, "/lineup?league=L1");
  // A tap opens Your moves on the first move's tab (src/new/show/dock.tsx reads ?moves=).
  assert.equal(m.next, "/show/s51/tonight?moves=lineup&game=L1");
  assert.equal(m.tag, "reminder-s51");

  const one = remindMessage([{ ...pick, kind: "pick" }], SEASON, next, "alex", NOW);
  assert.equal(one.body, "Survivor 51 · alex sent a reminder · Make your pick");
  assert.equal(one.url, "/pick?league=L2");
  assert.equal(one.next, "/show/s51/tonight?moves=pool&game=L2");

  // The hourly job's own: no sender.
  assert.equal(remindMessage([pick], SEASON, next, null, NOW).body, "Survivor 51 · Make your pick");
});

test("at your own pace: before it airs, when it airs (it locks as you watch); once aired, set it first", () => {
  const paced = { ...pick, kind: "pick", ownPace: true };
  const next = { number: 6, airAt: new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString() };
  const m = remindMessage([paced], SEASON, next, null, NOW);
  assert.equal(m.title, "Ep 6 airs in about 3 hours");
  assert.equal(m.body, "Survivor 51 · Make your pick · It locks when you watch");
  const aired = { number: 6, airAt: new Date(NOW.getTime() - 3600 * 1000).toISOString() };
  const late = remindMessage([{ ...lineup, kind: "lineup", ownPace: true }], SEASON, aired, null, NOW);
  assert.equal(late.title, "Ep 6 aired: set your lineup first");
  assert.equal(late.body, "Survivor 51 · Set your lineup (1 empty slot) · It locks when you watch");
});

test("a sport says its own word for an episode: a week's lineup locks at kickoff", () => {
  const next = { number: 12, airAt: new Date(NOW.getTime() + 2 * 3600 * 1000).toISOString() };
  const m = remindMessage([{ ...lineup, kind: "lineup", text: "Set your episode 12 lineup (2 empty slots)" }], { id: "nfl", label: "NFL 2026", ep: "Wk" }, next, null, NOW);
  assert.equal(m.title, "Wk 12 locks in about 2 hours");
  assert.equal(m.body, "NFL 2026 · Set your lineup (2 empty slots)");
});

test("no schedule, or an episode already airing on a live game: the title says a move is still open", () => {
  assert.equal(remindMessage([pick], SEASON, null, "alex", NOW).title, "Ep 6: a move is still open");
  const started = { number: 6, airAt: new Date(NOW.getTime() - 60 * 1000).toISOString() };
  assert.equal(remindMessage([pick, lineup], SEASON, started, "alex", NOW).title, "Ep 6: moves are still open");
  assert.equal(remindMessage([], SEASON, null, "alex", NOW), null);
});

test("whenText rounds to hours and never says zero", () => {
  assert.equal(whenText(new Date(NOW.getTime() + 20 * 60 * 1000), NOW), "in about an hour");
  assert.equal(whenText(new Date(NOW.getTime() + 90 * 60 * 1000), NOW), "in about 2 hours");
});
