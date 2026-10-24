// Bot research's schedule (db/bot-research.js dueRuns / normalizeSchedule) and its quick-check answer
// parser: which runs are due when, retries, and what counts as "too early". Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Bot = require("../db/bot-research.js");

const AIRED = new Date("2026-10-22T00:05:00Z"); // Wednesday 8:05pm Eastern
const min = (n) => new Date(AIRED.getTime() + n * 60 * 1000);
const schedule = Bot.normalizeSchedule(null);
const due = (now, history = [], extra = {}) =>
  Bot.dueRuns({ schedule, since: null, airTimes: [{ episode: 5, at: AIRED }], history, now, ...extra }).map((r) => r.slot);

test("the default schedule: quick at 5 minutes, full at 1 and 9 hours", () => {
  assert.deepEqual(schedule.map(Bot.slotOf), ["quick@5", "full@60", "full@540"]);
});

test("nothing is due before its time, then each run comes due in turn", () => {
  assert.deepEqual(due(min(4)), []);
  assert.deepEqual(due(min(6)), ["quick@5"]);
  assert.deepEqual(due(min(61)), ["quick@5", "full@60"]);
  assert.deepEqual(due(min(541)), ["quick@5", "full@60", "full@540"]);
});

test("a run that succeeded is done; one still running isn't started twice", () => {
  const ok = { episode_number: 5, slot: "quick@5", started_at: min(5), ok: true };
  assert.deepEqual(due(min(61), [ok]), ["full@60"]);
  const running = { episode_number: 5, slot: "full@60", started_at: min(60), ok: null };
  assert.deepEqual(due(min(62), [ok, running]), []);
  // Cut off (a redeploy, the route's ceiling): after ten minutes it's a failed attempt and retried.
  assert.deepEqual(due(min(85), [ok, running]), ["full@60"]);
});

test("failures are retried at a pace, and only three times", () => {
  const fail = (m) => ({ episode_number: 5, slot: "quick@5", started_at: min(m), ok: false });
  assert.deepEqual(due(min(7), [fail(5)]), [], "too soon after the last try");
  assert.deepEqual(due(min(11), [fail(5)]), ["quick@5"]);
  assert.deepEqual(due(min(30), [fail(5), fail(11), fail(17)]), [], "three strikes");
});

test("switched on mid-season: earlier runs are never picked up", () => {
  assert.deepEqual(due(min(70), [], { since: min(30) }), ["full@60"]);
});

test("a missed quick check goes stale; a full one is still worth doing", () => {
  assert.deepEqual(due(min(14 * 60)), ["full@60", "full@540"]);
});

test("runs switched off are skipped", () => {
  const s = Bot.normalizeSchedule([{ kind: "quick", after: 5, on: false }, { kind: "full", after: 60 }]);
  assert.deepEqual(Bot.dueRuns({ schedule: s, since: null, airTimes: [{ episode: 5, at: AIRED }], history: [], now: min(70) }).map((r) => r.slot), ["full@60"]);
});

test("normalizeSchedule refuses nonsense", () => {
  assert.throws(() => Bot.normalizeSchedule([{ kind: "medium", after: 5 }]), /kind/);
  assert.throws(() => Bot.normalizeSchedule([{ kind: "quick", after: -1 }]), /after/);
  assert.throws(() => Bot.normalizeSchedule([{ kind: "full", after: 60 }, { kind: "full", after: 60 }]), /Two full runs/);
  assert.deepEqual(Bot.normalizeSchedule([{ kind: "full", after: 540 }, { kind: "quick", after: 5 }]).map(Bot.slotOf), ["quick@5", "full@540"]);
});

test("the quick answer: names matched to the cast, fences and chatter tolerated", () => {
  const cast = ["Alexis Levine", "Linnea Capobianco", "Brady Booker"];
  const text = 'Here you go:\n```json\n{"found": true, "left": [{"name": "Alexis", "how": "Voted Out"}, {"name": "linnea capobianco", "how": "Voted Out"}], "headline": "A double boot after a tied revote.", "sources": ["https://example.com/recap", "not a url"]}\n```';
  const q = Bot.parseQuickAnswer(text, cast);
  assert.equal(q.found, true);
  assert.deepEqual(q.left.map((p) => [p.name, p.matched]), [["Alexis Levine", true], ["Linnea Capobianco", true]]);
  assert.deepEqual(q.sources, ["https://example.com/recap"]);
  assert.equal(q.left[0].how, "Voted Out");
  const story = Bot.parseQuickAnswer('{"left": [{"name": "Alexis", "how": "Voted Out by unanimous consensus after a 4-4 tie on the revote"}], "headline": "x"}', cast);
  assert.equal(story.left[0].how, null, "a story in 'how' isn't shown as a label");
  assert.equal(Bot.quickMessage(q), "Alexis Levine & Linnea Capobianco left. A double boot after a tied revote.");
});

test("the quick answer: not found yet, or empty, is not found", () => {
  assert.equal(Bot.parseQuickAnswer('{"found": false, "left": [], "headline": ""}', []).found, false);
  assert.equal(Bot.parseQuickAnswer('{"left": [], "headline": ""}', []).found, false);
});

test("the quick prompt names the episode, the cast and the show's own exits", () => {
  const ctx = { showName: "Survivor", season: 51, episodeNumber: 5, castNames: ["Alexis Levine"], terms: { castaways: "Castaways" }, format: { exitMethods: ["Voted Out", "Quit", "Other"] } };
  const p = Bot.buildQuickPrompt(ctx, AIRED, "America/New_York");
  assert.match(p, /Survivor season 51, episode 5/);
  assert.match(p, /Voted Out, Quit, or any other way/);
  assert.match(p, /Alexis Levine/);
  assert.match(p, /"found": true/);
});
