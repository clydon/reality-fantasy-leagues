// The desk's words for the bot's runs (src/lib/desk-bot-words.ts, docs/PLAN-desk-parity.md part 4a): a run's time as the page
// works it out (runTime) is db/bot-research.js dueAt's, a schedule change's History line, and Autopilot's line.
const test = require("node:test");
const assert = require("node:assert");
const Bot = require("../db/bot-research.js");
const W = require("../src/lib/desk-bot-words.ts");

const H = 3_600_000;
const starts = Date.parse("2026-10-28T20:05:00-04:00");
const ends = starts + H;

test("runTime is dueAt's rule, for every kind, with and without a next episode", () => {
  const nexts = [starts + 7 * 24 * H, starts + 26 * H, ends + 2 * H, null];
  for (const kind of ["quick", "full", "schedule", "trivia", "bingo"])
    for (const after of [0, 5, 60, 540, 1440, 2880])
      for (const next of nexts) {
        const want = Bot.dueAt({ kind, after }, ends, next === null ? null : new Date(next), starts);
        const got = W.runTime({ kind, after }, ends, next, starts);
        assert.strictEqual(got, want ? want.getTime() : null, `${kind}@${after}, next ${next}`);
      }
  assert.strictEqual(W.TRIVIA_AFTER_END, Bot.TRIVIA_AFTER_END);
  assert.deepStrictEqual(W.USUAL, Bot.DEFAULT_SCHEDULE);
});

test("a schedule change's line", () => {
  const usual = W.USUAL.map((r) => ({ ...r }));
  const base = { on: true, runs: usual, minutes: 60 };
  const off = usual.map((r) => (r.kind === "quick" ? { ...r, on: false } : r));
  assert.strictEqual(W.changeLine(base, { ...base, runs: off }), "Who went home (at its end) off");
  const moved = usual.map((r) => (r.after === 720 ? { ...r, after: 540 } : r));
  assert.strictEqual(W.changeLine(base, { ...base, runs: moved }), "Full results: 9 hr after it ends (was 12 hr after it ends)");
  assert.strictEqual(W.changeLine(base, { ...base, runs: [...usual, { kind: "schedule", after: 30, on: true }] }), "Schedule check added, 30 min after it ends");
  assert.strictEqual(W.changeLine(base, { ...base, runs: usual.filter((r) => r.kind !== "bingo") }), "Bingo squares (a day before it airs) taken off");
  assert.strictEqual(W.changeLine(base, { ...base, on: false }), "Autopilot off");
  assert.strictEqual(W.changeLine(base, { ...base, minutes: 90 }), "Episode length: 1 hr 30 min (was 1 hr)");
  assert.strictEqual(W.changeLine({ ...base, runs: [{ kind: "schedule", after: 30, on: true }] }, base), "Schedule reset to our usual five");
});

test("Autopilot's line and the season page's", () => {
  assert.strictEqual(W.autoLine(W.USUAL), "who went home, then full results");
  assert.strictEqual(W.autoLine([{ kind: "schedule", after: 30, on: true }]), "the schedule check after it");
  assert.strictEqual(W.autoLine([{ kind: "trivia", after: 1440, on: true }]), "nothing after it");
  assert.strictEqual(W.researchLine({ on: true, schedule: [{ kind: "schedule", after: 30, on: true }] }), "Autopilot on · the schedule check after each episode");
  assert.strictEqual(W.researchLine({ on: false, schedule: W.USUAL }), "Autopilot off · Run now any time");
  assert.strictEqual(W.dur(1440), "a day");
  assert.strictEqual(W.when({ kind: "trivia", after: 1440 }), "a day before the next episode");
});

test("a run counted from the end steps by its first hour, then an hour at a time on the clock", () => {
  const nine30 = Date.parse("2026-10-28T21:30:00-04:00");
  const l = W.endLadder(nine30, "America/New_York");
  assert.deepStrictEqual(l.slice(0, 11), [0, 5, 10, 15, 20, 30, 45, 60, 90, 150, 210]);
  assert.ok(l.includes(870), "12:00 PM the next day, from a 9:30 PM end");
  const clock = (a) => new Date(nine30 + a * 60_000).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  assert.ok(l.filter((a) => a > 60).every((a) => /:00/.test(clock(a))), "every step past the first hour is on the hour");
  // From 9:05 PM (an 8:05 start): 11:00 PM, then 12:00 PM the next day is 895.
  const nine05 = W.endLadder(Date.parse("2026-10-28T21:05:00-04:00"), "America/New_York");
  assert.deepStrictEqual(nine05.slice(7, 10), [60, 115, 175]);
  assert.ok(nine05.includes(895));
  // A whole-hour end: 11:00 PM is two hours on. No episode: an hour at a time.
  assert.deepStrictEqual(W.endLadder(Date.parse("2026-10-28T21:00:00-04:00"), "America/New_York").slice(7, 9), [60, 120]);
  assert.deepStrictEqual(W.endLadder(null, null).slice(7, 9), [60, 120]);
  assert.ok(Math.max(...l) <= W.END_MAX);
});

test("our usual as data: the words take it", () => {
  const ours = [{ kind: "quick", after: 0, on: true }, { kind: "full", after: 900, on: true }];
  assert.deepStrictEqual(W.missing([{ kind: "quick", after: 0, on: true }], ours), [ours[1]]);
  assert.ok(W.isUsual(ours, ours) && !W.isUsual(W.USUAL, ours));
  assert.deepStrictEqual(W.lackingKinds([{ kind: "schedule", after: 30, on: true }, { kind: "full", after: 60, on: false }]), ["quick", "trivia", "bingo"]);
  assert.strictEqual(W.usualAfter("full", ours), 900);
  assert.strictEqual(W.usualWords("full"), "Usually 1 hr after it ends, and again 12 hr after it ends.");
  assert.strictEqual(W.usualWords("schedule"), "Not one of our usual runs.");
  const base = { on: true, runs: [{ kind: "quick", after: 0, on: false }], minutes: 60 };
  assert.strictEqual(W.changeLine(base, { ...base, runs: ours }, ours), "Schedule reset to our usual two");
});

test("a run retimed and switched in one Save says both; an empty usual is never a reset", () => {
  const was = { on: true, runs: [{ kind: "full", after: 60, on: true }], minutes: 60 };
  assert.strictEqual(W.changeLine(was, { ...was, runs: [{ kind: "full", after: 120, on: false }] }), "Full results: 2 hr after it ends (was 1 hr after it ends), off");
  const two = { on: true, runs: [{ kind: "full", after: 60, on: true }, { kind: "quick", after: 0, on: true }], minutes: 60 };
  assert.notStrictEqual(W.changeLine(two, { ...two, runs: [] }, []), "Schedule reset to our usual no");
});
