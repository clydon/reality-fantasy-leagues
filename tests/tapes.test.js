// Season tapes' recorder (scripts/dev-test/tapes.js, docs/PLAN-playtests.md step P1): the queue's order (breadth first, a
// season's questions only once its tape knows its episodes, a show's first season before anyone's second), backing off,
// what reads like a usage limit, file names, the journal's line, and answering a prompt from a tape (the same prompt, else
// the same kind of question about the same episode). No database, no bot. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tapes-test-"));
process.env.TAPES_DIR = dir;
const T = require("../scripts/dev-test/tapes.js");
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const SHOWS = [
  { key: "a", tvmaze: 1, seasons: [3, 2] },
  { key: "b", tvmaze: 2, seasons: [9] },
];
const keys = (jobs) => jobs.map((j) => (j.kind === "words" ? `words:${j.id}` : `${j.show}/${j.season}/${T.nameOf(j)}`));

test("before any tape: each show's first season's setup, then the second seasons'", () => {
  const jobs = T.planJobs({ shows: SHOWS, episodesOf: () => null });
  assert.deepEqual(keys(jobs), ["a/3/season", "b/9/season", "a/2/season"]);
});

test("breadth first: every first season's core, the words, the first seasons' content, then second seasons", () => {
  const eps = { "a/3": 2, "b/9": 1, "a/2": 1 };
  const jobs = T.planJobs({ shows: SHOWS, episodesOf: (s, n) => eps[`${s}/${n}`] ?? null, words: ["w1"] });
  assert.deepEqual(keys(jobs), [
    "a/3/season",
    "a/3/season-rules",
    "a/3/season-cast",
    "a/3/e01-quick",
    "a/3/e01-full",
    "a/3/e02-quick",
    "a/3/e02-full",
    "b/9/season",
    "b/9/season-rules",
    "b/9/season-cast",
    "b/9/e01-quick",
    "b/9/e01-full",
    "words:w1",
    "a/3/e01-trivia",
    "a/3/e01-bingo",
    "a/3/e02-trivia",
    "a/3/e02-bingo",
    "a/3/season-bingo-season",
    "a/3/season-recaps",
    "b/9/e01-trivia",
    "b/9/e01-bingo",
    "b/9/season-bingo-season",
    "b/9/season-recaps",
    "a/2/season",
    "a/2/season-rules",
    "a/2/season-cast",
    "a/2/e01-quick",
    "a/2/e01-full",
    "a/2/e01-trivia",
    "a/2/e01-bingo",
    "a/2/season-bingo-season",
    "a/2/season-recaps",
  ]);
});

test("only one season, and only some kinds (its setup always kept: its episodes' questions wait for it)", () => {
  const jobs = T.planJobs({ shows: SHOWS, episodesOf: () => 1, only: { show: "a", season: 2 }, kinds: ["full"] });
  assert.deepEqual(keys(jobs), ["a/2/season", "a/2/season-rules", "a/2/season-cast", "a/2/e01-full"]);
  const all = T.planJobs({ shows: SHOWS, episodesOf: () => 1, only: { show: "b", season: null } });
  assert.ok(all.every((j) => j.show === "b"));
  assert.ok(!all.some((j) => j.kind === "words"), "the words corpus isn't a season's");
});

test("file names and keys", () => {
  assert.equal(T.nameOf({ kind: "season", episode: null }), "season");
  assert.equal(T.nameOf({ kind: "cast", episode: null }), "season-cast");
  assert.equal(T.nameOf({ kind: "full", episode: 3 }), "e03-full");
  assert.equal(T.nameOf({ kind: "quick", episode: 12 }), "e12-quick");
  assert.equal(T.keyOf({ show: "a", season: 3, kind: "full", episode: 3 }), "a/3/e03-full");
});

test("backing off: 5, 15, then 60 minutes", () => {
  assert.equal(T.backoffMs(0), 0);
  assert.equal(T.backoffMs(1), 5 * 60_000);
  assert.equal(T.backoffMs(2), 15 * 60_000);
  assert.equal(T.backoffMs(3), 60 * 60_000);
  assert.equal(T.backoffMs(9), 60 * 60_000);
});

test("a pause holds the queue until it's over", () => {
  const now = Date.parse("2026-10-28T05:00:00Z");
  assert.equal(T.holdFor({ pausedUntil: null }, now), null);
  assert.equal(T.holdFor({ pausedUntil: "2026-10-28T04:59:00Z" }, now), null);
  assert.deepEqual(T.holdFor({ pausedUntil: "2026-10-28T05:05:00Z", pauseWhy: "x" }, now), { wait: 5 * 60_000, why: "x" });
});

test("what reads like a usage limit or a bot check", () => {
  for (const s of [
    "You've reached our limit of messages per hour. Please try again later.",
    "You've hit your usage limit for GPT-5.",
    "ChatGPT didn't answer. 127.0.0.1:8765: HTTP 429",
    "Too many requests in 1 hour. Try again later.",
    "We detected unusual activity from your device.",
    "Please verify you are human",
    "Just a moment...",
  ]) assert.ok(T.looksLimited(s), s);
  for (const s of ["ChatGPT didn't answer. 127.0.0.1:8765: No reply after 270s", '{"found": true, "left": []}', "", null]) assert.ok(!T.looksLimited(s), String(s));
});

test("the journal's line", () => {
  const at = Date.parse("2026-10-28T05:00:00Z");
  const line = T.journalLine(at, { show: "the-traitors-us", season: 4, kind: "full", episode: 3 }, { ok: true, seconds: 42.2, message: "11 new\nresult(s)", tries: 0 });
  assert.match(line, /^2026-10-28T05:00:00\.000Z {2}the-traitors-us 4 e03 full +ok +42\.2s {2}11 new result\(s\)$/);
  assert.match(T.journalLine(at, { show: "s", season: 1, kind: "cast", episode: null }, { ok: false, seconds: 5, message: "x", tries: 1 }), /s 1 season cast +failed \(try 1\)/);
  assert.match(T.journalLine(at, { show: "s", season: 1, kind: "cast", episode: null }, { ok: false, seconds: 5, message: "x", tries: T.TRIES }), /GAVE UP/);
});

test("answering from a tape: the same prompt, else the same kind about the same episode", () => {
  const files = [
    { kind: "full", episode: 1, prompt: "Research episode 1 of X.\nStart from this skeleton", answer: "A1" },
    { kind: "full", episode: 2, prompt: "Research episode 2 of X.\nStart from this skeleton", answer: "A2" },
    { kind: "bingo", episode: 2, prompt: "Write 30 bingo squares for episode 2", answer: "B2", check: { prompt: "These are bingo squares for people watching episode 2", answer: "C2" } },
    { kind: "rules", episode: null, prompt: "How X works as a rulebook for a fantasy game", answer: "R" },
    { kind: "full", episode: 3, prompt: "p3", answer: null },
    { kind: "full", episode: 4, prompt: "Research episode 4 of X.", answer: "gave up", ok: false },
    { kind: "bingo-season", episode: null, prompt: "Write 40 bingo squares for the season", answer: "BS", check: { prompt: "These are bingo squares for people watching the season", answer: "CS" } },
    { kind: "bingo", episode: 5, prompt: "Write 30 bingo squares for Week 5", answer: "B5" },
  ];
  const asks = T.asksOf(files);
  assert.equal(asks.length, 8, "a check's ask counts; a question with no answer, or that gave up, doesn't");
  assert.equal(T.pickAnswer(asks, "Research episode 4 of X (again)", "full"), null, "a tape that gave up is never an answer");
  assert.equal(T.pickAnswer(asks, "Write 40 bingo squares for the whole season (again)", "bingo"), "BS", "no episode: the season's own bank");
  assert.equal(T.pickAnswer(asks, "These are bingo squares for people watching the season (again)", "bingoCheck"), "CS");
  assert.equal(T.pickAnswer(asks, "Write 30 bingo squares for Week 5 (again)", "bingo"), "B5", "the show's own word for an episode");
  assert.equal(T.pickAnswer(asks, "Research   episode 2 of X.\n\nStart from this skeleton", "full"), "A2", "whitespace aside");
  assert.equal(T.pickAnswer(asks, "Research episode 1 of X (worded anew). Start from this skeleton", "full"), "A1");
  assert.equal(T.pickAnswer(asks, "These are bingo squares for people watching episode 2 (again)", "bingoCheck"), "C2");
  assert.equal(T.pickAnswer(asks, "How X works as a rulebook for a fantasy game, today", "setup"), "R");
  assert.equal(T.pickAnswer(asks, "Research episode 3 of X", "full"), null, "nothing recorded for it");
  assert.equal(T.pickAnswer(asks, "Something else entirely", "other"), null);
});

test("answerer reads a tape from disk", () => {
  const d = path.join(dir, "z", "1");
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "e01-quick.json"), JSON.stringify({ kind: "quick", episode: 1, prompt: "Answer two things about episode 1", answer: '{"found":true}' }));
  fs.writeFileSync(path.join(d, "e01-quick.try1.json"), JSON.stringify({ kind: "quick", episode: 1, prompt: "Answer two things about episode 1", answer: "a failed try" }));
  const answer = T.answerer("z", 1);
  assert.equal(answer("Answer two things about episode 1", "quick"), '{"found":true}', "never a failed try's");
  assert.equal(answer("Answer two things about episode 2", "quick"), "{}");
});
