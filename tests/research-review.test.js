// Research's review as data (docs/PLAN-start-a-game-gpt.md S2, src/lib/game/formats/research-review.js): the checks a
// rulebook's blocks give research for any show, the research block's own words and checks, how answers read to a
// reviewer, and a missed group move in the vote's own words. Survivor's own (every check survivor.js's code made, from
// its blocks) is in tests/rulebook-golden.test.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { fill, nth, phrasesOf } = require("../src/lib/game/formats/research-review.js");
const ER = require("../db/episode-research.js");

const clone = (x) => JSON.parse(JSON.stringify(x));
const CAST = ["Ann Example", "Bo Example", "Cy Example", "Di Example", "Ed Example"];
const TERMS = { castaway: "player", castaways: "players", tribe: "team", tribes: "teams" };
const person = (name, answers) => ({ name, leftTheGame: "no", exitMethod: null, sources: ["https://example.invalid"], confidence: "high", ...answers });
const payload = (people, episode = {}) => ({ ...episode, castaways: CAST.map((n) => person(n, people[n] || {})) });

/** A made-up competition: a prize, a shield that keeps you safe (a team's win skips the council), a council by vote. */
function island() {
  return {
    schema: 1, kind: "competition", show: "Island Test",
    cast: { unit: "people", singular: "player", plural: "players", groups: { type: "sides", singular: "team", change: "atPhases" } },
    season: { phases: [{ id: "teams", name: "Teams", starts: { type: "episode", n: 1 }, changes: [] }], finale: null },
    segments: [
      { id: "prize", name: "Prize", decidedBy: "result", takesPart: "groupsThenEach", decides: "winner", onTheLine: "reward", often: "everyEpisode" },
      { id: "shield", name: "Shield", decidedBy: "result", takesPart: "groupsThenEach", decides: "topThree", onTheLine: "safety", often: "everyEpisode", places: "place" },
      { id: "council", name: "Council", decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome", often: "everyEpisode", skippedBy: "shield" },
    ],
    waysOut: [
      { id: "out", name: "Voted out", means: "out", cause: { segment: "council" } },
      { id: "champion", name: "Champion", means: "winner" },
    ],
    twists: [{ id: "tokens", type: "advantage", name: "Tokens", oneIsCalled: "a token", gotBy: "found", does: ["cancelsVotes"], lasts: "oneUse", cancelled: "count" }],
  };
}

function compiled(blocks) {
  assert.deepEqual(blocksProblems(blocks), []);
  const out = compileRulebook(blocks, { id: "island-test" });
  assert.deepEqual(out.problems, []);
  return { ...out, format: Formats.formatForRulebook(out.data, "research") };
}
const review = (format, p, groups) => ER.validateResearch(clone(p), CAST, TERMS, format, groups ? { groups } : {});

test("a show's blocks give research its checks: a vote by the cast, a team's win that skips it, a safe win, a place, a token", () => {
  const { data, format, warnings } = compiled(island());
  assert.deepEqual(warnings, []);
  assert.deepEqual(data.research.checks.map((k) => k.id), [
    "shieldWonVotedOut", "shieldFirstNotWon", "councilVotesWhileAway", "councilSkippedBy", "councilNoVotesFound", "councilVoteCount", "tokensCancelledUnplayed",
  ]);
  // Every one of them, in the blocks' own words.
  const r = review(format, payload({
    "Ann Example": { councilAttended: "no", councilVotesReceived: 2 },
    "Bo Example": { shieldWon: "yes", leftTheGame: "yes", exitMethod: "Voted out" },
    "Cy Example": { shieldPlace: 1, shieldWon: "no", tokensVotesCancelled: 1, tokensPlayed: "no" },
  }));
  assert.deepEqual(r.problems, [
    "Ann Example: 2 votes against someone who wasn't at Council",
    "Bo Example: went home (Voted out) despite winning the Shield",
    "Cy Example: finished 1st in the Shield but isn't marked as winning it",
    "Cy Example: votes cancelled by a token they aren't marked as playing",
  ]);
  // The episode's: the team that won the shield wasn't at the council (cleared to unknown, one line each), then the votes.
  const e = review(format, payload({
    "Ann Example": { councilAttended: "yes", shieldGroupWon: "yes", councilVotesReceived: 0 },
    "Bo Example": { councilAttended: "yes", councilVotesReceived: 3, councilVotedFor: "Cy Example" },
    "Cy Example": { councilAttended: "yes", councilVotesReceived: 1, councilVotedFor: "Bo Example" },
  }));
  assert.deepEqual(e.problems, [
    "Ann Example: marked as at Council, but in the team that won the Shield (cleared to unknown)",
    "4 votes counted against people, but 2 people at Council are recorded voting: check who was there",
  ]);
  assert.equal(e.entries[0].councilAttended, "unknown");
  // Everyone there on zero: the counts look missing, so nobody is marked safe.
  const z = review(format, payload({ "Ann Example": { councilAttended: "yes", councilVotesReceived: 0 }, "Bo Example": { councilAttended: "yes", councilVotesReceived: 0 } }));
  assert.deepEqual(z.problems, ["Everyone at Council was given zero votes, so the vote counts look missing (cleared, nobody marked safe)"]);
  assert.deepEqual(z.entries.slice(0, 2).map((c) => c.councilVotesReceived), [null, null]);
  assert.deepEqual(ER.candidatesFor({ castaways: clone(z.entries) }, format, 1).filter((i) => i.eventType === "councilZeroVotes"), [], "nothing staged as safe");
});

test("a vote asked whether it was held clears its attendance when it wasn't", () => {
  const blocks = island();
  blocks.research = { questions: { councilHeld: { type: "answer", of: "episode", words: "Was there a Council this episode?" } } };
  const { data, format } = compiled(blocks);
  assert.ok(data.research.checks.some((k) => k.id === "councilNotHeld"));
  const r = review(format, payload({ "Ann Example": { councilAttended: "yes", councilVotesReceived: 2 } }, { councilHeld: "no" }));
  assert.deepEqual(r.problems, ["No Council this episode, but some people were marked as attending it (cleared)"]);
  assert.deepEqual([r.entries[0].councilAttended, r.entries[0].councilVotesReceived], ["no", null]);
});

test("the research block's checks: their own words, their own condition, off, and one of its own", () => {
  const blocks = island();
  blocks.customMoments = [{ id: "sulked", label: "Sulked", counted: "yesNo", answeredBy: "research" }];
  blocks.research = {
    questions: { shieldNote: { type: "string", words: "Anything said about the shield." } },
    checks: {
      councilVotesWhileAway: { words: "{name}: {councilVotesReceived} against someone away" },
      shieldFirstNotWon: { when: { all: [{ answer: "shieldPlace", equals: 1 }, { answer: "shieldWon", isNot: "yes" }, { answer: "prizeWon", isNot: "yes" }] } },
      councilVoteCount: { off: true },
      sulkedUnsaid: { when: { all: [{ answer: "sulked", is: "yes" }, { answer: "shieldNote", present: false }] }, words: "{name}: sulked, and nothing said about it" },
      // Neither one the compiler makes nor whole: left out, said.
      halfOne: { words: "Nothing to check" },
      // Reads a question the rulebook doesn't ask: left out, said.
      strayOne: { when: { answer: "nobodyAsks", is: "yes" }, words: "{name}: stray" },
      // Its own condition for one the blocks make reads one too: the blocks' own instead, said.
      shieldWonVotedOut: { when: { answer: "nobodyAsks", is: "yes" } },
    },
  };
  const { data, format, warnings } = compiled(blocks);
  const ids = data.research.checks.map((k) => k.id);
  assert.ok(!ids.includes("councilVoteCount") && ids.includes("sulkedUnsaid") && !ids.includes("halfOne") && !ids.includes("strayOne"));
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /^How research checks "halfOne": this rulebook makes no such check/);
  assert.match(warnings[1], /^How research checks "shieldWonVotedOut": .*nobodyAsks.*, so it's checked as the blocks make it$/);
  assert.match(warnings[2], /^How research checks "strayOne": .*nobodyAsks.*, so it's left out$/);
  assert.deepEqual(data.research.checks.find((k) => k.id === "shieldWonVotedOut").when.all[0], { answer: "shieldWon", is: "yes" });
  const r = review(format, payload({
    "Ann Example": { councilAttended: "no", councilVotesReceived: 1 },
    "Bo Example": { shieldPlace: 1, shieldWon: "no", prizeWon: "yes" },
    "Cy Example": { shieldPlace: 1, shieldWon: "no", sulked: "yes" },
  }));
  assert.deepEqual(r.problems, [
    "Ann Example: 1 against someone away",
    "Cy Example: finished 1st in the Shield but isn't marked as winning it",
    "Cy Example: sulked, and nothing said about it",
  ]);
});

test("a talk show's rulebook has nothing to check, and a compiled rulebook's checks pass formatProblems", () => {
  const talk = { schema: 1, kind: "talk", show: "Late Test", cast: { unit: "people", singular: "host", plural: "hosts", groups: null }, season: { phases: [{ id: "all", name: "All", starts: { type: "episode", n: 1 }, changes: [] }] }, segments: [], waysOut: [], customMoments: [{ id: "cameo", label: "A surprise cameo", counted: "yesNo", answeredBy: "league" }] };
  assert.equal(compileRulebook(talk, { id: "late-test" }).data.research.checks, undefined);
  assert.deepEqual(formatProblems(compiled(island()).data), []);
});

test("formatProblems refuses checks and words that don't fit the checklist", () => {
  const { data } = compiled(island());
  const broken = (change) => {
    const d = clone(data);
    change(d.research);
    return formatProblems(d);
  };
  assert.match(broken((r) => r.checks.push({ id: "bad", when: { answer: "nope", is: "yes" }, say: "x" })).join(), /no checklist question "nope"/);
  assert.match(broken((r) => r.checks.push({ id: "bad", when: { answer: "councilAttended", is: "yes" }, say: "{name}: {nope}" })).join(), /\{nope\} isn't something it can say/);
  assert.match(broken((r) => r.checks.push({ id: "bad", when: { answer: "councilAttended", is: "yes" }, set: { councilAttended: "maybe" }, say: "x" })).join(), /"maybe" isn't an answer it can have/);
  assert.match(broken((r) => r.checks.push({ id: "bad", when: { answer: "councilAttended", is: "yes" }, set: { leftTheGame: "no" }, say: "x" })).join(), /read on every format/);
  assert.match(broken((r) => r.checks.push({ id: "bad", of: "episode", when: { value: "nothing", greaterThan: 0 }, say: "x" })).join(), /"nothing" isn't one it counts/);
  assert.match(broken((r) => r.checks.push({ id: "bad", of: "episode", set: { councilVotesReceived: null }, say: "x" })).join(), /repairs who `who` says/);
  assert.match(broken((r) => r.checks.push({ ...r.checks[0] })).join(), /id used twice/);
  assert.match(broken((r) => (r.checklist.find((f) => f.key === "councilVotesReceived").shown = { answer: "nobody", is: "yes" })).join(), /no checklist question "nobody"/);
  assert.match(broken((r) => (r.groupVotes = [{ attended: "councilVotesReceived", say: "{name}" }])).join(), /a yes-or-no checklist question/);
});

test("how an answer reads: its words as a template, the fallback after the bar, {s} and {nth}, when it's said, and nothing", () => {
  assert.equal(fill("{value} vote{s} against", () => null, 1), "1 vote against");
  assert.equal(fill("{value} vote{s} against", () => null, 3), "3 votes against");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(nth), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  assert.equal(fill("found {what|an advantage}", (k) => ({ what: "" })[k]), "found an advantage");
  assert.equal(fill("found {what|an advantage}", (k) => ({ what: "an idol" })[k]), "found an idol");
  const fields = [
    { key: "votes", type: "integer", note: "{value} vote{s} against", sentence: "received {value} vote(s)" },
    { key: "place", type: "integer", note: "{nth} in the race", shown: { any: [{ answer: "place", equals: 2 }, { answer: "place", equals: 3 }] } },
    { key: "found", type: "answer", note: "found {what|something}" },
    { key: "what", type: "string", note: false },
    { key: "at", type: "answer", note: "at the council" },
    { key: "said", type: "string", note: "said" },
    { key: "count", type: "integer" },
  ];
  const c = { name: "Ann", votes: 2, place: 2, found: "yes", what: null, at: "yes", said: "hello", count: 4 };
  assert.deepEqual(phrasesOf(fields, c), ["2 votes against", "2nd in the race", "found something", "at the council", "said: hello", "count: 4"]);
  assert.deepEqual(phrasesOf(fields, c, { sentence: true })[0], "received 2 vote(s)");
  assert.deepEqual(phrasesOf(fields, { ...c, place: 1, votes: 0 }).slice(0, 1), ["found something"], "1st isn't said, and no votes isn't either");
  // Braces that name nothing it can say are part of a label (a moment labelled that way), as stored notes always were.
  assert.deepEqual(phrasesOf([{ key: "catch", type: "answer", note: "said {catchphrase}" }], { catch: "yes" }), ["said {catchphrase}"]);
});

test("a missed group move on a show that isn't Survivor, in the vote's own words, and only before the groups end", () => {
  const { data, format } = compiled(island());
  assert.deepEqual(data.research.groupVotes, [
    { attended: "councilAttended", say: "{name} was at {group}'s Council but was still on {was}: added a move to {group} (reject it in review if that's wrong)" },
  ]);
  const groups = { "Ann Example": "Reds", "Bo Example": "Reds", "Cy Example": "Reds", "Di Example": "Blues", "Ed Example": "Blues" };
  const at = { councilAttended: "yes", councilVotesReceived: 1, councilVotedFor: "Di Example" };
  const p = payload({ "Ann Example": at, "Bo Example": at, "Cy Example": at, "Di Example": { ...at, councilVotesReceived: 3, councilVotedFor: "Ann Example" } });
  const r = review(format, p, groups);
  assert.ok(r.problems.includes("Di Example was at Reds's Council but was still on Blues: added a move to Reds (reject it in review if that's wrong)"));
  assert.equal(r.entries[3].newGroup, "Reds");
  assert.ok(!review(format, { ...p, merged: "yes" }, groups).problems.some((m) => /added a move/.test(m)), "not once the groups end");
  // A vote nobody's group skips is everyone's: no group moves read from it.
  const open = island();
  delete open.segments[2].skippedBy;
  assert.equal(compiled(open).data.research.groupVotes, undefined);
});

test("data frozen from Survivor before it said which vote one tribe goes to reads Survivor's, read by its code half", () => {
  const old = clone(Formats.FORMATS.survivor.data);
  delete old.research.groupVotes;
  assert.deepEqual(Formats.formatForRulebook(old, "survivor").data.research.groupVotes, Formats.FORMATS.survivor.data.research.groupVotes);
  assert.equal(Formats.formatForRulebook(old, "research").data.research.groupVotes, undefined, "a data-only reader reads only its data");
  // ...and only the votes it asks who was at (a fresh copy: a format is built once per data).
  const without = clone(old);
  without.research.checklist = without.research.checklist.filter((f) => f.key !== "attendedTribal");
  without.rules.research = without.rules.research.filter((r) => !JSON.stringify(r).includes("attendedTribal"));
  assert.equal(Formats.formatForRulebook(without, "survivor").data.research.groupVotes, undefined);
});

test("the research prompt has a chat put what it couldn't settle in notableTwist only when the format asks it", () => {
  const ctx = (format) => ({ showName: "Island Test", season: 1, episodeNumber: 2, castNames: CAST, castGroups: { "Ann Example": "Reds" }, terms: TERMS, format });
  const asks = ER.buildPrompt(ctx(Formats.FORMATS.survivor));
  assert.match(asks.system, /say so in notableTwist\./);
  assert.match(asks.user, /notableTwist alone\./);
  const { format } = compiled(island());
  const not = ER.buildPrompt(ctx(format));
  assert.doesNotMatch(`${not.system}\n${not.user}`, /notableTwist/);
  assert.match(not.system, /lower the confidence\.$/m);
  assert.match(not.user, /that is the only place a team change is recorded\./);
  // A re-ask of a few questions leaves it out too.
  assert.doesNotMatch(ER.buildPrompt(ctx(ER.onlyFormat(Formats.FORMATS.survivor, ["votesReceived"]))).system, /notableTwist/);
});
