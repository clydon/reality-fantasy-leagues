// db/reminders.js: who gets reminded, when, and never twice. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { runReminders } = require("../db/reminders.js");

const HOUR = 3600 * 1000;
const EP2_AIRS = Air.zonedToUtc("2026-09-30", "20:00", "America/New_York"); // premiere 09-23, weekly

function league() {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: "active-roster", activeSlots: 2, showId: "survivor", wikiSeason: 49 });
  s.players = [{ id: "p1", name: "A", color: "#f00", active: true, disabled: false }];
  const c = (id) => ({ id, name: id, tribeId: null, ownerIds: ["p1"], status: "active", exitEpisodeId: null });
  s.castaways = [c("a"), c("b"), c("c")];
  s.episodes = [
    { id: "e1", number: 1, events: [{ castawayId: "z", method: "Voted Out" }], scoringEvents: [], bets: [], picks: [], lineups: { p1: ["a", "b"] } },
    { id: "e2", number: 2, events: [], scoringEvents: [], bets: [], picks: [], lineups: { p1: ["a"] } },
  ];
  return s;
}

// Just enough of pg's Pool for runReminders: one airing season, one league, one member.
function fakePool(state) {
  const logged = new Set();
  return {
    logged,
    async query(sql, params) {
      if (sql.includes("FROM show_seasons")) {
        return {
          rows: [{ id: "s49", season_number: 49, slug: "survivor", premiere_date: "2026-09-23", air_time: "20:00", air_tz: "America/New_York",
                   status: "airing", episode_count: 13, finale_date: null, wiki_air_dates: {}, researched: [] }],
        };
      }
      if (sql.includes("FROM leagues")) return { rows: [{ id: "L1", name: "Test League", state }] };
      if (sql.includes("FROM league_memberships")) return { rows: [{ user_id: "u1", player_id: "p1" }] };
      if (sql.includes("INSERT INTO reminder_log")) {
        const key = params.join("|");
        if (logged.has(key)) return { rowCount: 0 };
        logged.add(key);
        return { rowCount: 1 };
      }
      throw new Error("unexpected query: " + sql);
    },
  };
}

test("a day out with an empty lineup slot: one 24h reminder, and a rerun sends nothing", async () => {
  const pool = fakePool(league());
  const now = new Date(EP2_AIRS.getTime() - 20 * HOUR);
  assert.equal((await runReminders(pool, { now })).sent, 1);
  assert.deepEqual([...pool.logged], ["u1|L1|lineup|2|24h"]);
  assert.equal((await runReminders(pool, { now: new Date(now.getTime() + HOUR) })).sent, 0);
});

test("two hours out it reminds again, once", async () => {
  const pool = fakePool(league());
  await runReminders(pool, { now: new Date(EP2_AIRS.getTime() - 20 * HOUR) });
  assert.equal((await runReminders(pool, { now: new Date(EP2_AIRS.getTime() - 1.5 * HOUR) })).sent, 1);
  assert.ok(pool.logged.has("u1|L1|lineup|2|2h"));
});

test("nothing when the lineup is full, too far out, already aired, or the league is catching up", async () => {
  const full = league();
  full.episodes[1].lineups.p1 = ["a", "b"];
  assert.equal((await runReminders(fakePool(full), { now: new Date(EP2_AIRS.getTime() - 3 * HOUR) })).sent, 0);
  assert.equal((await runReminders(fakePool(league()), { now: new Date(EP2_AIRS.getTime() - 30 * HOUR) })).sent, 0);
  assert.equal((await runReminders(fakePool(league()), { now: new Date(EP2_AIRS.getTime() + HOUR) })).sent, 0);
  const catchingUp = league();
  catchingUp.settings.revealedThroughEpisode = 1;
  assert.equal((await runReminders(fakePool(catchingUp), { now: new Date(EP2_AIRS.getTime() - 3 * HOUR) })).sent, 0);
});

test("auto-research timing: N hours after it airs takes over from the weekly slot", () => {
  const aired = Air.zonedToUtc("2026-09-30", "20:00", "America/New_York");
  const weekly = { airTz: "America/New_York", researchWeekday: 4, researchTime: "12:00" };
  assert.equal(Air.nextResearchSlot(aired, { ...weekly, researchDelayHours: 12 }).getTime(), aired.getTime() + 12 * HOUR);
  assert.equal(Air.nextResearchSlot(aired, weekly).getTime(), Air.zonedToUtc("2026-10-01", "12:00", "America/New_York").getTime());
  assert.equal(Air.nextResearchSlot(aired, { airTz: "America/New_York" }), null);
});

// The commissioner's results nudge (the morning after an episode airs with nothing recorded).
const EP2_MORNING = Air.zonedToUtc("2026-10-01", "09:00", "America/New_York");

test("results: the morning after it airs with nothing recorded, the commissioner gets one push", async () => {
  const pool = fakePool(league());
  assert.equal((await runReminders(pool, { now: new Date(EP2_MORNING.getTime() - HOUR) })).sent, 0);
  assert.equal((await runReminders(pool, { now: new Date(EP2_MORNING.getTime() + HOUR) })).sent, 1);
  assert.ok(pool.logged.has("u1|L1|2"), [...pool.logged].join(", "));
  assert.equal((await runReminders(pool, { now: new Date(EP2_MORNING.getTime() + 2 * HOUR) })).sent, 0);
});

test("results: nothing once results are in, or once that day is over", async () => {
  const done = league();
  done.episodes[1].events = [{ castawayId: "c", method: "Voted Out" }];
  assert.equal((await runReminders(fakePool(done), { now: new Date(EP2_MORNING.getTime() + HOUR) })).sent, 0);
  assert.equal((await runReminders(fakePool(league()), { now: new Date(EP2_MORNING.getTime() + 13 * HOUR) })).sent, 0);
});

test("results: the morning after is 9am at least six hours after airtime", () => {
  const { morningAfter } = require("../db/reminders.js");
  const tz = "America/New_York";
  assert.equal(morningAfter(Air.zonedToUtc("2026-09-30", "20:00", tz), tz).getTime(), Air.zonedToUtc("2026-10-01", "09:00", tz).getTime());
  assert.equal(morningAfter(Air.zonedToUtc("2026-10-01", "05:00", tz), tz).getTime(), Air.zonedToUtc("2026-10-02", "09:00", tz).getTime());
  assert.equal(morningAfter(Air.zonedToUtc("2026-10-01", "01:00", tz), tz).getTime(), Air.zonedToUtc("2026-10-01", "09:00", tz).getTime());
});
