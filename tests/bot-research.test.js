// Bot research's schedule (db/bot-research.js dueRuns / normalizeSchedule) and its quick-check answer
// parser: which runs are due when, retries, and what counts as "too early". Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Bot = require("../db/bot-research.js");

const AIRED = new Date("2026-10-22T00:05:00Z"); // Wednesday 8:05pm Eastern
const min = (n) => new Date(AIRED.getTime() + n * 60 * 1000);
// The runs after an episode, as these tests were written for them (our usual before 2026-10-29: the timing rules don't change
// with it): bingo's (before an episode airs) has tests of its own below.
const schedule = Bot.normalizeSchedule([
  { kind: "quick", after: 5 },
  { kind: "full", after: 60 },
  { kind: "full", after: 540 },
  { kind: "trivia", after: 1440 },
]);
const due = (now, history = [], extra = {}) =>
  Bot.dueRuns({ schedule, since: null, airTimes: [{ episode: 5, at: AIRED }], history, now, ...extra }).map((r) => r.slot);

test("the default schedule: quick at its end, full at 1 and 12 hours (before noon's final results), trivia a day before the next episode, bingo a day before this one", () => {
  assert.deepEqual(Bot.normalizeSchedule(null).map(Bot.slotOf), ["quick@0", "full@60", "full@720", "trivia@1440", "bingo@1440"]);
  // An 8:05 PM Eastern start, 90 minutes: the last full run at 9:35 AM, before 12:00 PM's final results.
  const last = Bot.dueAt({ kind: "full", after: 720 }, AIRED.getTime() + 90 * 60 * 1000, null, AIRED.getTime());
  assert.equal(last.toISOString(), "2026-10-22T13:35:00.000Z");
});

test("an episode our old usual already asked about isn't asked again under the new one", () => {
  const usual = Bot.normalizeSchedule(null).filter((r) => r.kind === "quick" || r.kind === "full");
  const done = ["quick@5", "full@60", "full@540"].map((slot) => ({ episode_number: 5, slot, started_at: min(30), ok: true }));
  const due = (history) => Bot.dueRuns({ schedule: usual, since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history, now: min(90 + 12 * 60 + 5) }).map((r) => r.slot);
  assert.deepEqual(due([]), ["full@60", "full@720"], "without history: the full runs (the quick check has gone stale)");
  assert.deepEqual(due(done), []);
});

test("a quick check at the episode's end is due at its end", () => {
  const atEnd = Bot.normalizeSchedule([{ kind: "quick", after: 0 }]);
  const due = (now) => Bot.dueRuns({ schedule: atEnd, since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history: [], now }).map((r) => r.slot);
  assert.deepEqual(due(min(89)), []);
  assert.deepEqual(due(min(90)), ["quick@0"]);
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

// ---------- bingo (docs/PLAN-bingo-bank.md step 2) ----------
const DAY = 24 * 60;
const bingoOnly = Bot.normalizeSchedule([{ kind: "bingo", after: DAY }]);
const bingo = (now, history = [], extra = {}) =>
  Bot.dueRuns({ schedule: bingoOnly, since: null, airTimes: [{ episode: 5, at: AIRED }], history, now, ...extra }).map((r) => `${r.slot}${r.forSeason ? "+season" : ""}`);

test("bingo counts back from when this episode starts, and never at or after it", () => {
  const starts = AIRED.getTime();
  assert.deepEqual(Bot.dueAt({ kind: "bingo", after: DAY }, starts + 90 * 60000, null, starts), min(-DAY), "a day before it airs");
  assert.deepEqual(Bot.dueAt({ kind: "bingo", after: 30 }, starts + 90 * 60000, null, starts), min(-30));
  assert.equal(Bot.dueAt({ kind: "bingo", after: 0 }, starts + 90 * 60000, null, starts), null, "at airtime: too late for squares");
  assert.equal(Bot.dueAt({ kind: "bingo", after: DAY }, starts + 90 * 60000, null, null), null, "no air time: nothing to count back from");
  assert.throws(() => Bot.normalizeSchedule([{ kind: "bingo", after: DAY }, { kind: "bingo", after: DAY }]), /Two bingo runs 1440 minutes before it airs/);
});

test("a bingo run: due a day before, three tries 20 minutes apart, none once the episode airs", () => {
  assert.deepEqual(bingo(min(-DAY - 1)), []);
  assert.deepEqual(bingo(min(-DAY)), ["bingo@1440"]);
  const fail = (m) => ({ episode_number: 5, slot: "bingo@1440", started_at: min(m), ok: false });
  assert.deepEqual(bingo(min(-DAY + 10), [fail(-DAY)]), [], "a retry waits 20 minutes");
  assert.deepEqual(bingo(min(-DAY + 20), [fail(-DAY)]), ["bingo@1440"]);
  assert.deepEqual(bingo(min(-DAY + 60), [fail(-DAY), fail(-DAY + 20), fail(-DAY + 40)]), [], "three strikes");
  assert.deepEqual(bingo(min(-10)), ["bingo@1440"], "the VM was down all day: still worth it ten minutes before");
  assert.deepEqual(bingo(min(0)), [], "it's on: too late");
  assert.deepEqual(bingo(min(-1), [fail(-15)]), [], "a retry that would land after airtime never comes");
  const nextAfterLate = Bot.nextRunAt({ schedule: bingoOnly, since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history: [fail(-15)], now: min(-14) });
  assert.equal(nextAfterLate, null, "and the VM isn't told to come back for it");
  const ok = { episode_number: 5, slot: "bingo@1440", started_at: min(-DAY), ok: true };
  assert.deepEqual(bingo(min(-DAY + 30), [ok]), [], "written: done");
  assert.deepEqual(bingo(min(-60), [], { since: min(-120) }), [], "switched on after its time: not picked up");
});

test("a season without its own bank: each bingo run brings a job for it, after the episode's, with tries of its own", () => {
  assert.deepEqual(bingo(min(-DAY), [], { seasonBank: false }), ["bingo@1440", "bingo@season+season"]);
  const episodeOk = { episode_number: 5, slot: "bingo@1440", started_at: min(-DAY), ok: true };
  assert.deepEqual(bingo(min(-DAY + 2), [episodeOk], { seasonBank: false }), ["bingo@season+season"], "the next call writes the season's");
  const seasonOk = { episode_number: 5, slot: "bingo@season", started_at: min(-DAY + 2), ok: true };
  assert.deepEqual(bingo(min(-DAY + 4), [episodeOk, seasonOk], { seasonBank: false }), []);
  assert.deepEqual(bingo(min(-DAY), [], { seasonBank: true }), ["bingo@1440"], "a season with a bank of its own: just the episode's");
  assert.deepEqual(bingo(min(5), [], { seasonBank: false }), [], "neither once it airs");
  const airTimes = [{ episode: 5, at: AIRED }, { episode: 6, at: min(7 * DAY) }];
  const next = (now, history = [], seasonBank = true) => Bot.nextRunAt({ schedule: bingoOnly, since: null, airTimes, episodeMinutes: 90, history, now, seasonBank });
  assert.deepEqual(next(min(-2 * DAY)), min(-DAY), "nextRunAt: a day before Episode 5");
  assert.deepEqual(next(min(10)), min(6 * DAY), "Episode 5's on: a day before Episode 6");
  assert.deepEqual(next(min(-DAY + 2), [episodeOk], false), min(-DAY + 2), "the season's job: now");
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

test("results someone asked for (0152): at once, held while a try runs, again two minutes after a failure, then given up", () => {
  const asked = new Date("2026-10-27T18:00:00Z");
  const at = (m) => new Date(asked.getTime() + m * 60 * 1000);
  const try_ = (m, ok) => ({ started_at: at(m).toISOString(), ok });
  assert.equal(Bot.askedNext(asked, [], at(5)).getTime(), asked.getTime(), "never tried: due since it was asked");
  // A try running holds it until it would count as cut off; once cut off, it's a failed try.
  assert.equal(Bot.askedNext(asked, [try_(1, null)], at(3)).getTime(), at(1).getTime() + Bot.RUNNING_STALE_MS);
  assert.equal(Bot.askedNext(asked, [try_(1, false)], at(3)).getTime(), at(3).getTime(), "failed at 1: tried again 2 minutes on");
  assert.equal(Bot.askedNext(asked, [try_(1, true)], at(3)), null, "it worked: never again");
  assert.equal(Bot.askedNext(asked, [try_(1, false), try_(3, false)], at(9)), null, `${Bot.ASKED_TRIES} tries, then given up`);
  assert.equal(Bot.askedNext(asked, [try_(1, false), try_(3, null)], at(5)).getTime(), at(3).getTime() + Bot.RUNNING_STALE_MS, "the last try still running");
  assert.equal(Bot.askedNext(asked, [try_(1, false), try_(3, null)], at(30)), null, "the last try cut off: given up");
});

test("results someone asked for: each episode's full results in order, one at a time", () => {
  const asked = new Date("2026-10-27T18:00:00Z");
  const at = (m) => new Date(asked.getTime() + m * 60 * 1000);
  const run = (m, ok) => ({ started_at: at(m).toISOString(), ok });
  const ask = (n, tries = []) => ({ episode_number: n, asked_at: asked, tries });
  const next = (asks, m) => Bot.seasonAskNext(asks, at(m));
  // Nothing tried: Episode 1's full results.
  assert.deepEqual(next([ask(1), ask(2)], 1), { episode: 1, kind: "full", slot: Bot.ASKED_SLOT, at: asked });
  // Running: the season waits (2 doesn't start alongside it).
  assert.ok(next([ask(1, [run(1, null)]), ask(2)], 2).hold);
  // In: 2 next. Failed once: held two minutes, then 1 again. Failed twice: given up, 2 goes.
  assert.equal(next([ask(1, [run(1, true)]), ask(2)], 3).episode, 2);
  assert.ok(next([ask(1, [run(1, false)]), ask(2)], 2).hold);
  assert.equal(next([ask(1, [run(1, false)]), ask(2)], 4).episode, 1);
  assert.equal(next([ask(1, [run(1, false), run(4, false)]), ask(2)], 7).episode, 2);
  assert.equal(next([], 1), null);
  // Asked again (0154): the job says for what.
  assert.equal(next([{ ...ask(3), mode: "missing" }], 1).mode, "missing");
  assert.equal("mode" in next([ask(3)], 1), false);
});
