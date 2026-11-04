// What scores (src/lib/game/formats/rulebook-scores.js, docs/PLAN-rulebook-research.md): the question lists every moment
// and the ladder; the review takes a rung for each moment (its points are the rung's, never the AI's own number), adds
// what's missing as custom moments, leaves out repeats, names and off-ladder rungs, and keeps what it wasn't told about.
// Answers here are made up; the ladder's own arithmetic is checked too. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/formats/rulebook-scores.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");

const clone = (x) => JSON.parse(JSON.stringify(x));
const challenge = () => clone(BUILT_IN_BLOCKS.challenge.blocks);
const survivor = () => clone(BUILT_IN_BLOCKS.survivor.blocks);
const rung = (id) => S.LADDER.find((r) => r.id === id);
const wrap = (o) => "Sure, here it is:\n```json\n" + JSON.stringify(o) + "\n```\nLet me know if you want changes.";

test("the ladder keeps the three promises by construction", () => {
  const p = Object.fromEntries(S.LADDER.map((r) => [r.id, r.points]));
  // The week's biggest win beats any two small edges, and an earned plus an edge.
  assert.ok(p.wonAlone > p.edge * 2 && p.wonAlone > p.earned + p.edge);
  // The worst week (the worst way out, plus a slip) is under one biggest win; with two slips, never over it.
  assert.ok(Math.abs(p.ownFault + p.slip) < p.wonAlone && Math.abs(p.ownFault + p.slip * 2) <= p.wonAlone);
  // What most people get each week is small; what one or two get is 2 or more.
  assert.ok(p.along <= 1 && p.edge <= 1 && p.earned >= 2);
  // Top to bottom, strictly falling, and the season's win on top.
  for (let i = 1; i < S.LADDER.length; i++) assert.ok(S.LADDER[i].points < S.LADDER[i - 1].points, S.LADDER[i].id);
  assert.equal(S.LADDER[0].id, "wonSeason");
});

test("the question lists every moment with its id and worth, the ladder, the show's parts, and the season so far", () => {
  const blocks = challenge();
  const q = S.buildScoresPrompt({ show: "The Challenge", season: "season 42", airing: true, aired: 5, episodeCount: 14, blocks });
  for (const m of momentsFor(blocks)) assert.ok(q.includes(`"${m.id}": ${m.label}`), m.id);
  assert.ok(q.includes("now 3 (5 when shared)"), "a split value, in words");
  for (const r of S.LADDER) assert.ok(q.includes(`${r.id}: ${r.points > 0 ? "+" : ""}${r.points}. ${r.test}`), r.id);
  assert.match(q, /perUnit: for a moment counted per amount/);
  assert.match(q, /Daily challenge \(segment "dailyChallenge"\)/);
  assert.match(q, /5 of 14 episodes have aired/);
  assert.match(q, /recaps of this season's first 5 episodes/);
  assert.match(q, /No names and no results, anywhere/);
  assert.match(q, /"counted": one of "yesNo"/);
  // A finished season: no airing line, and the search isn't pointed at particular episodes.
  const done = S.buildScoresPrompt({ show: "Survivor", season: "season 50", blocks: survivor() });
  assert.doesNotMatch(done, /still airing/);
  assert.doesNotMatch(done, /first \d+ episodes/);
});

test("the review takes each rung's points, keeps what it wasn't told, and flattens a split value as the stepper does", () => {
  const blocks = challenge();
  const answer = wrap({
    schema: 1,
    scores: {
      dailyChallengeWon: { rung: "wonAlone", why: "the week's contest" },
      eliminationWon: { rung: "wonAlone", why: "sent the loser home" },
      eliminated: { rung: "out" },
      quit: { rung: "ownFault" },
      medicallyRemoved: { rung: "nothing" },
      finalist: { rung: "bigPlay" },
      winner: { rung: "wonSeason", points: 99 },
      disqualified: { rung: "moon" },
      nobody: { rung: "edge" },
    },
    add: [],
  });
  const r = S.reviewScores(S.parseScoresAnswer(answer), blocks);
  const row = (id) => r.rows.find((x) => x.id === id);
  assert.deepEqual([row("dailyChallengeWon").before, row("dailyChallengeWon").after, row("dailyChallengeWon").rung, row("dailyChallengeWon").changed], [2, 4, "wonAlone", true]);
  assert.equal(row("dailyChallengeWon").why, "the week's contest");
  assert.equal(row("winner").after, rung("wonSeason").points, "the rung's points, never the answer's own number");
  assert.equal(row("medicallyRemoved").changed, false, "the same value isn't a change");
  // Not scored, or a rung that isn't on the ladder: kept, with a warning.
  assert.deepEqual([row("captain").after, row("captain").rung, row("captain").changed], [0.5, null, false]);
  assert.deepEqual([row("disqualified").after, row("disqualified").changed], [-5, false]);
  assert.ok(r.warnings.some((w) => w.at === "scores.captain" && /not scored, kept at 0.5 \(1 when shared\)/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "scores.disqualified" && /"moon" isn't a rung/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "scores.nobody"));
  // A split value takes the rung's number for both halves.
  assert.deepEqual(r.blocks.points.finalist, { exclusive: 3, shared: 3 });
  assert.equal(row("finalist").beforeWord, "3 (5 when shared)");
  assert.equal(r.blocks.points.dailyChallengeWon, 4);
  assert.equal(r.blocks.points.medicallyRemoved, 0, "an override it already had stays");
  assert.deepEqual(r.problems, []);
  assert.ok(r.changes >= 1);
  // The same answer again gives the same review: nothing random in it.
  assert.deepEqual(S.reviewScores(S.parseScoresAnswer(answer), blocks), r);
});

test("what's missing joins as custom moments with the rung's points; repeats, names and bad rungs are left out", () => {
  const blocks = challenge();
  const scores = Object.fromEntries(momentsFor(blocks).map((m) => [m.id, { rung: "edge" }]));
  const answer = wrap({
    schema: 1,
    scores,
    add: [
      { id: "calledOut", label: "Called out an opponent", rung: "earned", why: "rare", counted: "yesNo", answeredBy: "research", reliability: "usually", during: { segment: "elimination" }, exceptWinners: true },
      { label: "Won the elimination", rung: "wonAlone" },
      { label: "Served as the team's captain", rung: "edge" },
      { label: "Bananas got in a fight", rung: "slip" },
      { label: "Each point in the Daily challenge", rung: "perUnit", points: 0.25, counted: "perUnit", answeredBy: "research" },
      { label: "Each lap", rung: "perUnit", points: 9, counted: "perUnit" },
      { label: "Looked tired", rung: "nothing", counted: "sometimes", answeredBy: "fans", during: { segment: "nope" } },
      { label: "Flew to the moon", rung: "rocket" },
      { rung: "edge" },
    ],
    leftOut: ["A thing that didn't fit", 7],
  });
  const r = S.reviewScores(S.parseScoresAnswer(answer), blocks, { castNames: ["Bananas Devenanzio", "Cara Maria Sorbello"] });
  assert.deepEqual(
    r.added.map((m) => [m.id, m.points, m.rung]),
    [
      ["calledOut", 2, "earned"],
      ["eachPointInTheDailyChallenge", 0.25, "perUnit"],
      ["lookedTired", 0, "nothing"],
    ]
  );
  const custom = r.blocks.customMoments.find((m) => m.id === "calledOut");
  assert.deepEqual(custom, { id: "calledOut", label: "Called out an opponent", counted: "yesNo", answeredBy: "research", reliability: "usually", during: { segment: "elimination" }, exceptWinners: true });
  assert.equal(r.blocks.points.calledOut, 2);
  assert.equal(r.blocks.points.lookedTired, undefined, "nothing scores nothing: no override");
  const tired = r.blocks.customMoments.find((m) => m.id === "lookedTired");
  assert.deepEqual(tired, { id: "lookedTired", label: "Looked tired", counted: "yesNo", answeredBy: "research", reliability: "usually" }, "answers it doesn't know are tidied");
  assert.ok(r.warnings.some((w) => w.at === "add.lookedTired.counted" && /it said "sometimes"/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "add.lookedTired.during" && /"nope"/.test(w.message)));
  assert.deepEqual(
    r.skipped.map((x) => x.why),
    ["the rulebook has it: Won the Elimination", "the rulebook has it: Served as team captain", "names Bananas Devenanzio", "perUnit points should be between 0.01 and 2", '"rocket" isn\'t a rung of the ladder', "no description"]
  );
  assert.deepEqual(r.leftOut, ["A thing that didn't fit"]);
  assert.deepEqual(r.problems, [], "the blocks it builds pass the schema");
  assert.ok(r.lines.some((l) => /New moment: Called out an opponent/.test(l)));
  // The new moments build, with their points.
  const built = momentsFor(r.blocks);
  assert.equal(built.find((m) => m.id === "calledOut").defaultPoints, 2);
  assert.deepEqual(built.find((m) => m.id === "calledOut").from, { custom: "calledOut", segment: "elimination" });
});

test("a chat's chatter around the JSON is fine, and no JSON at all is said plainly", () => {
  assert.equal(S.parseScoresAnswer('Here:\n{"schema": 1, "scores": {}}\nDone.').schema, 1);
  assert.throws(() => S.parseScoresAnswer("I couldn't find anything."), /no JSON object/);
  const r = S.reviewScores({}, survivor());
  assert.equal(r.changes, 0);
  assert.equal(r.rows.length, momentsFor(survivor()).length);
  assert.ok(r.rows.every((x) => !x.changed));
});
