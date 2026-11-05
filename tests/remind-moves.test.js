// The commissioner's Remind everyone (src/lib/server/remind-moves.js, the pure half of backstage-remind.ts): who hears, who's
// skipped inside the cooldown, and what one person's push says. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { COOLDOWN, KIND, splitDue, remindMessage, whenText } = require("../src/lib/server/remind-moves.js");

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

test("one push per person, naming the games only when there's more than one, with when the episode airs", () => {
  const next = { number: 6, airAt: new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString() };
  const m = remindMessage([lineup, pick], SEASON, next, "alex", NOW);
  assert.equal(m.title, "Survivor 51: episode 6 airs in about 3 hours");
  assert.equal(m.body, "alex sent a reminder · Lineup League: Set your episode 6 lineup (1 empty slot) · Pool: Make your episode 6 pick");
  assert.equal(m.url, "/lineup?league=L1");
  assert.equal(m.next, "/show/s51/tonight");
  assert.equal(m.tag, "reminder-L1");

  const one = remindMessage([pick], SEASON, next, "alex", NOW);
  assert.equal(one.body, "alex sent a reminder · Make your episode 6 pick");
  assert.equal(one.url, "/pick?league=L2");
});

test("no schedule, or an episode already airing: the title says a move is still open instead of a time", () => {
  assert.equal(remindMessage([pick], SEASON, null, "alex", NOW).title, "Survivor 51: you still have a move to make");
  const started = { number: 6, airAt: new Date(NOW.getTime() - 60 * 1000).toISOString() };
  assert.equal(remindMessage([pick], SEASON, started, "alex", NOW).title, "Survivor 51: you still have a move to make");
  assert.equal(remindMessage([], SEASON, null, "alex", NOW), null);
});

test("whenText rounds to hours and never says zero", () => {
  assert.equal(whenText(new Date(NOW.getTime() + 20 * 60 * 1000), NOW), "in about an hour");
  assert.equal(whenText(new Date(NOW.getTime() + 90 * 60 * 1000), NOW), "in about 2 hours");
});
