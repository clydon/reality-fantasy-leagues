// The season's schedule as research confirms it (db/migrations/0067 season_episodes): each episode's research
// says when the NEXT one airs and how long it runs (db/episode-research.js nextEpisodeFrom), and every air time
// (src/lib/game/air-schedule.js episodeAirTime: lineup locks, reminders, the bot clock) follows it: a week off,
// a special at another time, a two-hour episode. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Air = require("../src/lib/game/air-schedule.js");
const Research = require("../db/episode-research.js");
const Bot = require("../db/bot-research.js");

// Wednesdays at 8 PM Eastern from 7 October 2026.
const season = { premiereDate: "2026-10-07", airTime: "20:00", airTz: "America/New_York" };
const iso = (d) => d.toISOString();

test("exactAirTime takes only a real instant with its offset", () => {
  assert.equal(iso(Air.exactAirTime("2026-11-05T20:00:00-05:00")), "2026-11-06T01:00:00.000Z");
  assert.equal(iso(Air.exactAirTime("2026-11-06T01:00:00Z")), "2026-11-06T01:00:00.000Z");
  assert.equal(Air.exactAirTime("2026-11-05T20:00:00"), null, "no offset: not exact");
  assert.equal(Air.exactAirTime("November 5, 2026"), null);
  assert.equal(Air.exactAirTime(null), null);
});

test("without anything confirmed, episodes are weekly from the premiere", () => {
  assert.equal(iso(Air.episodeAirTime(season, 4, {})), "2026-10-29T00:00:00.000Z"); // Oct 28, 8 PM EDT
  assert.equal(iso(Air.episodeAirTime(season, 5, {})), "2026-11-05T01:00:00.000Z"); // Nov 4, 8 PM EST
});

test("a week off: the confirmed date moves that episode and every one after it", () => {
  // Episode 8 skips Nov 25 (Thanksgiving week) and airs Dec 2; research confirmed it.
  const dates = { 8: "2026-12-03T01:00:00Z" };
  assert.equal(iso(Air.episodeAirTime(season, 7, dates)), "2026-11-19T01:00:00.000Z", "before it: unchanged");
  assert.equal(iso(Air.episodeAirTime(season, 8, dates)), "2026-12-03T01:00:00.000Z");
  assert.equal(iso(Air.episodeAirTime(season, 9, dates)), "2026-12-10T01:00:00.000Z", "a week after the moved one");
});

test("a special at 9 PM keeps its time, and the next week is back at 8", () => {
  const dates = { 5: "2026-11-05T02:00:00Z" }; // Nov 4, 9 PM EST
  assert.equal(iso(Air.episodeAirTime(season, 5, dates)), "2026-11-05T02:00:00.000Z");
  assert.equal(iso(Air.episodeAirTime(season, 6, dates)), "2026-11-12T01:00:00.000Z");
});

test("a confirmed start wins over the wiki's printed date for the same episode", () => {
  const dates = { 5: "2026-11-05T02:00:00Z" };
  const wikiOnly = { 5: "November 4, 2026" };
  assert.equal(iso(Air.episodeAirTime(season, 5, wikiOnly)), "2026-11-05T01:00:00.000Z", "the wiki's date at the usual time");
  assert.equal(iso(Air.episodeAirTime(season, 5, dates)), "2026-11-05T02:00:00.000Z");
});

test("nextEpisodeFrom: what research says, cleaned up", () => {
  const now = new Date("2026-10-29T03:00:00Z");
  const opts = { tz: "America/New_York", airTime: "20:00", now };
  const clean = (next) => Research.nextEpisodeFrom(next, opts);
  const full = clean({ airsAt: "2026-11-04T20:00:00-05:00", minutes: 120, note: "two-hour episode" });
  assert.deepEqual({ ...full, airAt: iso(full.airAt) }, { airAt: "2026-11-05T01:00:00.000Z", minutes: 120, note: "two-hour episode" });
  assert.equal(iso(clean({ airsAt: "2026-11-04T21:00" }).airAt), "2026-11-05T02:00:00.000Z", "no offset: the season's zone");
  assert.equal(iso(clean({ airsAt: "2026-11-04" }).airAt), "2026-11-05T01:00:00.000Z", "a date alone: the usual start");
  assert.equal(clean({ airsAt: "2026-10-21T20:00:00-04:00", minutes: null }), null, "already aired: nothing");
  assert.equal(clean({ airsAt: "2027-03-01T20:00:00-05:00" }), null, "months away: nothing");
  assert.deepEqual(clean({ airsAt: null, minutes: 90 }), { airAt: null, minutes: 90, note: null }, "a length alone still counts");
  assert.equal(clean({ airsAt: null, minutes: 2 }), null, "a length that can't be right");
  assert.equal(clean({ airsAt: "soon", minutes: null, note: "" }), null);
  assert.equal(clean(null), null);
});

test("the bot clock counts from a two-hour episode's own end", () => {
  const schedule = Bot.normalizeSchedule(null);
  const aired = new Date("2026-11-05T01:00:00Z");
  const at = (min) => new Date(aired.getTime() + min * 60 * 1000);
  const due = (now, minutes) =>
    Bot.dueRuns({ schedule, since: null, airTimes: [{ episode: 5, at: aired, ...(minutes ? { minutes } : {}) }], episodeMinutes: 90, history: [], now }).map(
      (r) => r.slot
    );
  assert.deepEqual(due(at(96), null), ["quick@5"], "the season's 90 minutes");
  assert.deepEqual(due(at(96), 120), [], "this one runs 120: still on");
  assert.deepEqual(due(at(125), 120), ["quick@5"]);
});

test("the schedule check: asks only about the next episode, and reads the answer", () => {
  const prompt = Bot.buildSchedulePrompt("Survivor", 51, 6, new Date("2026-10-29T00:00:00Z"), "America/New_York");
  assert.match(prompt, /Survivor season 51: when does episode 7 air\?/);
  assert.match(prompt, /Episode 6, which aired/);
  assert.match(prompt, /"airsAt": "2026-11-04T20:00:00-05:00"/);
  assert.doesNotMatch(prompt, /left the game/, "no results asked for");
  const a = Bot.parseScheduleAnswer('```json\n{"found": true, "airsAt": "2026-11-04T20:00:00-05:00", "minutes": "120", "note": "two-hour", "sources": ["https://x.y/z", "nope"]}\n```');
  assert.deepEqual(a, { found: true, airsAt: "2026-11-04T20:00:00-05:00", minutes: 120, note: "two-hour", sources: ["https://x.y/z"] });
  assert.equal(Bot.parseScheduleAnswer('{"found": false, "airsAt": null, "minutes": null}').found, false);
  assert.equal(Bot.parseScheduleAnswer('{"airsAt": null, "minutes": null, "note": "soon"}').found, false, "nothing usable is not found");
});

test("a schedule check is a run like the others: on a schedule, three tries 20 minutes apart", () => {
  const schedule = Bot.normalizeSchedule([{ kind: "schedule", after: 30 }]);
  assert.deepEqual(schedule.map(Bot.slotOf), ["schedule@30"]);
  const aired = new Date("2026-10-29T00:00:00Z");
  const at = (min) => new Date(aired.getTime() + min * 60 * 1000);
  const tries = (...m) => m.map((x) => ({ episode_number: 6, slot: "schedule@30", started_at: at(x), ok: false }));
  const due = (now, history = []) =>
    Bot.dueRuns({ schedule, since: null, airTimes: [{ episode: 6, at: aired }], episodeMinutes: 90, history, now }).map((r) => r.slot);
  assert.deepEqual(due(at(119)), []);
  assert.deepEqual(due(at(120)), ["schedule@30"], "half an hour after a 90-minute episode ends");
  assert.deepEqual(due(at(130), tries(120)), []);
  assert.deepEqual(due(at(140), tries(120)), ["schedule@30"]);
  assert.deepEqual(due(at(200), tries(120, 140, 160)), [], "three tries");
});

test("the research schema asks about the next episode, and the paste skeleton has it empty", () => {
  const Formats = require("../src/lib/game/formats/index.js");
  const prompt = Research.buildPastePrompt(
    { showName: "Survivor", season: 51, episodeNumber: 6, castNames: ["Alexis Levine"], format: Formats.formatFor("survivor"), terms: {} },
    [],
    { structured: true }
  );
  assert.match(prompt, /"nextEpisode"/);
  assert.match(prompt, /"airsAt": null/);
});
