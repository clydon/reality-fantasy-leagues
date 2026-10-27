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

test("the default schedule: quick at 5 minutes, full at 1 and 9 hours, trivia a day before the next episode", () => {
  assert.deepEqual(schedule.map(Bot.slotOf), ["quick@5", "full@60", "full@540", "trivia@1440"]);
});

test("trivia counts back from the next episode: a day before a weekly one, 3 hours after the end for a nightly one, none for a double", () => {
  const hour = 60 * 60 * 1000;
  const run = { kind: "trivia", after: 1440 };
  const ends = 90 * 60 * 1000;
  const due = (gap) => Bot.dueAt(run, ends, gap === null ? null : new Date(gap * hour));
  assert.deepEqual(due(7 * 24), new Date(6 * 24 * hour), "weekly: a day before the next one");
  assert.deepEqual(due(24), new Date(ends + Bot.TRIVIA_AFTER_END * 60 * 1000), "nightly: 3 hours after it ends");
  assert.equal(due(3), null, "a double episode: the next one airs before the recaps can be read");
  assert.deepEqual(due(null), new Date(ends + 24 * hour), "the finale (no next one): a day after it ends");
  const schedule = Bot.normalizeSchedule([{ kind: "trivia", after: 1440 }]);
  const airTimes = [{ episode: 5, at: AIRED }, { episode: 6, at: new Date(AIRED.getTime() + 7 * 24 * hour) }];
  assert.deepEqual(Bot.nextRunAt({ schedule, since: null, airTimes, episodeMinutes: 90, history: [], now: min(-60) }), new Date(AIRED.getTime() + 6 * 24 * hour));
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

test("a quick check keeps trying: every 5 minutes for half an hour, then every 15, for 3 hours", () => {
  const fail = (m) => ({ episode_number: 5, slot: "quick@5", started_at: min(m), ok: false });
  const quick = (now, tries) => due(now, tries).includes("quick@5");
  assert.equal(quick(min(7), [fail(5)]), false, "too soon after the last try");
  assert.equal(quick(min(10), [fail(5)]), true);
  const firstHalfHour = [5, 10, 15, 20, 25, 30].map(fail);
  assert.equal(quick(min(39), [...firstHalfHour, fail(35)]), false, "past its first half hour: 15 minutes apart");
  assert.equal(quick(min(50), [...firstHalfHour, fail(35)]), true);
  const allEvening = [5, 10, 15, 20, 25, 30, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170].map(fail);
  assert.equal(quick(min(185), allEvening), true, "the last try inside 3 hours");
  assert.equal(quick(min(200), [...allEvening, fail(185)]), false, "3 hours on, it stops");
});

test("a full run tries three times, 20 minutes apart", () => {
  const fail = (m) => ({ episode_number: 5, slot: "full@60", started_at: min(m), ok: false });
  const ok = { episode_number: 5, slot: "quick@5", started_at: min(5), ok: true };
  assert.deepEqual(due(min(70), [ok, fail(60)]), []);
  assert.deepEqual(due(min(80), [ok, fail(60)]), ["full@60"]);
  assert.deepEqual(due(min(150), [ok, fail(60), fail(80), fail(100)]), [], "three strikes");
});

test("runs count from when the episode ends", () => {
  const at = (now) => Bot.dueRuns({ schedule, since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history: [], now }).map((r) => r.slot);
  assert.deepEqual(at(min(94)), [], "a 90-minute episode is still on");
  assert.deepEqual(at(min(95)), ["quick@5"]);
  assert.deepEqual(at(min(150)), ["quick@5", "full@60"]);
});

test("nextRunAt: when to come back, by the same rules", () => {
  const NEXT_EP = new Date(AIRED.getTime() + 7 * 24 * 60 * 60 * 1000);
  const airTimes = [{ episode: 5, at: AIRED }, { episode: 6, at: NEXT_EP }];
  const next = (now, history = [], extra = {}) => Bot.nextRunAt({ schedule, since: null, airTimes, episodeMinutes: 90, history, now, ...extra });
  const runAt = (ep, m) => ({ episode_number: ep === 5 ? 5 : 6, slot: m.slot, started_at: m.at, ok: m.ok });
  assert.deepEqual(next(min(-60)), min(95), "before the episode: its quick check, 5 minutes after it ends");
  assert.deepEqual(next(min(100)), min(100), "one is due: now");
  const quickFailed = runAt(5, { slot: "quick@5", at: min(95), ok: false });
  assert.deepEqual(next(min(96), [quickFailed]), min(100), "a retry 5 minutes on");
  const quickOk = runAt(5, { slot: "quick@5", at: min(100), ok: true });
  assert.deepEqual(next(min(101), [quickFailed, quickOk]), min(150), "then the full run, an hour after the end");
  const results = ["quick@5", "full@60", "full@540"].map((slot) => runAt(5, { slot, at: min(600), ok: true }));
  assert.deepEqual(next(min(700), results), new Date(NEXT_EP.getTime() - 24 * 60 * 60 * 1000), "then trivia, a day before the next episode");
  const done = [...results, runAt(5, { slot: "trivia@1440", at: min(700), ok: true })];
  assert.deepEqual(next(min(700), done), new Date(NEXT_EP.getTime() + 95 * 60 * 1000), "then next week's episode");
  assert.equal(next(min(800), done, { airTimes: [{ episode: 5, at: AIRED }] }), null, "nothing left: null");
  assert.deepEqual(next(min(-60), [], { since: min(120) }), min(150), "switched on later: earlier runs never come due");
});

test("an episode night: the VM calls only when told, and the quick check lands within 5 minutes of a source", () => {
  // The bot finds a source from 22 minutes after the episode ends (95 + 17 = 112); full runs always work.
  const history = [];
  const calls = [];
  let now = min(-30);
  for (let guard = 0; guard < 100; guard++) {
    const input = { schedule, since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history, now };
    const [job] = Bot.dueRuns(input);
    if (job) {
      calls.push(Math.round((now - AIRED) / 60000));
      history.push({ episode_number: 5, slot: job.slot, started_at: now, ok: job.kind === "full" || now >= min(112) });
    }
    const when = Bot.nextRunAt({ ...input, history });
    if (!when) break;
    assert.ok(job || when > now, "never told to come back for a run that isn't due");
    now = when > now ? when : new Date(now.getTime() + 60 * 1000);
  }
  assert.deepEqual(calls, [95, 100, 105, 110, 115, 150, 630, 1530], "quick at 95 and every 5 until 115 finds it; full at 150 and 630; trivia a day after (no next episode known)");
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

test("the tie-break: a day after a flag nobody's answer has checked, or after the answer that split a result (step 6c)", () => {
  const T = new Date("2026-10-26T12:00:00Z").getTime();
  const at = (h) => new Date(T + h * 3600 * 1000);
  // A flag after the newest answer: due a day after the flag.
  const flag = Bot.tiebreakNext({ flags: [at(2)], disputed: true, newest: at(0), tries: [] });
  assert.equal(flag.due.getTime(), at(26).getTime());
  assert.equal(flag.next.getTime(), at(26).getTime());
  // A split with no flag waiting: a day after the answer that split it.
  const split = Bot.tiebreakNext({ flags: [at(-5)], disputed: true, newest: at(0), tries: [] });
  assert.equal(split.due.getTime(), at(24).getTime());
  // Nothing open, or a flag an answer has come in since on a fact that's no longer disputed: none.
  assert.equal(Bot.tiebreakNext({ flags: [], disputed: false, newest: at(0), tries: [] }), null);
  assert.equal(Bot.tiebreakNext({ flags: [at(-1)], disputed: false, newest: at(0), tries: [] }), null);
  // Three tries, 20 minutes apart, counted only since the question opened; then it's the admin's.
  const tried = (n) => Array.from({ length: n }, (_, i) => ({ started_at: new Date(at(24).getTime() + i * 20 * 60000), ok: false }));
  assert.equal(Bot.tiebreakNext({ flags: [], disputed: true, newest: at(0), tries: tried(1) }).next.getTime(), at(24).getTime() + 20 * 60000);
  assert.equal(Bot.tiebreakNext({ flags: [], disputed: true, newest: at(0), tries: tried(3) }), null);
  // A split a tie-break already answered stays the admin's; a new flag after it gets one of its own.
  const done = [{ started_at: at(24), ok: true }];
  assert.equal(Bot.tiebreakNext({ flags: [], disputed: true, newest: at(24), tries: done }), null);
  assert.equal(Bot.tiebreakNext({ flags: [at(30)], disputed: true, newest: at(24), tries: done }).due.getTime(), at(54).getTime());
  // Gone stale three days past due (the bot was down): none.
  assert.equal(Bot.tiebreakNext({ flags: [], disputed: true, newest: at(0), tries: [{ started_at: at(24 + 80), ok: false }] }), null);
});
