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
  assert.strictEqual(W.changeLine(base, { ...base, runs: off }), "Who went home (5 min after it ends) off");
  const moved = usual.map((r) => (r.after === 540 ? { ...r, after: 720 } : r));
  assert.strictEqual(W.changeLine(base, { ...base, runs: moved }), "Full results: 12 hr after it ends (was 9 hr after it ends)");
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
