// What scores (src/lib/game/formats/rulebook-scores.js, docs/PLAN-rulebook-research.md): the question lists every moment,
// the ladder and the rarity steps; the review takes a rung for each moment (its points are the rung's plus rarity on a
// positive one, never the AI's own number), adds what's missing as custom moments, leaves out repeats, names and off-ladder
// rungs, keeps what it wasn't told about, holds back what's past the reader's mark without a trace, and leaves out what's
// settled. Answers here are made up; the ladder's own arithmetic is checked too. Run with `npm test`.
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
/** Every moment of `blocks` on `rung` at `rarity`, `except` by id. */
const allOn = (blocks, rung, rarity = "mostEpisodes", except = {}) => Object.fromEntries(momentsFor(blocks).map((m) => [m.id, { rung, rarity, ...(except[m.id] || {}) }]));

test("the ladder keeps the three promises by construction, at every rarity", () => {
  const p = Object.fromEntries(S.LADDER.map((r) => [r.id, r.points]));
  // Rarity counts from earned up: a small edge is still a small edge, so the promises hold at every rarity.
  assert.ok(p.edge < S.RARITY_FROM && p.earned >= S.RARITY_FROM);
  for (const { bump } of S.RARITY) {
    // The week's biggest win beats any two small edges, and an earned plus an edge, at the same rarity.
    assert.ok(p.wonAlone + bump > p.edge * 2 && p.wonAlone + bump > p.earned + bump + p.edge, `rarity +${bump}`);
  }
  // What most people get each week stays under what one or two get.
  assert.ok(p.along < p.earned && p.edge < p.earned);
  // The worst week (the worst way out, plus a slip; rarity adds nothing to a loss) is under one biggest win.
  assert.ok(Math.abs(p.ownFault + p.slip) < p.wonAlone && Math.abs(p.ownFault + p.slip * 2) <= p.wonAlone);
  // Top to bottom, strictly falling, the season's win on top; rarity's steps rising from 0.
  for (let i = 1; i < S.LADDER.length; i++) assert.ok(S.LADDER[i].points < S.LADDER[i - 1].points, S.LADDER[i].id);
  assert.equal(S.LADDER[0].id, "wonSeason");
  assert.deepEqual(S.RARITY.map((r) => r.bump), [0, 0.5, 1]);
});

test("the question lists every moment with its id and worth, the ladder, rarity, the show's parts, and the season so far", () => {
  const blocks = challenge();
  const q = S.buildScoresPrompt({ show: "The Challenge", season: "season 42", airing: true, aired: 5, episodeCount: 14, blocks });
  for (const m of momentsFor(blocks)) assert.ok(q.includes(`"${m.id}": ${m.label}`), m.id);
  assert.ok(q.includes("now 3 (5 when shared)"), "a split value, in words");
  for (const r of S.LADDER) assert.ok(q.includes(`${r.id}: ${r.points > 0 ? "+" : ""}${r.points}. ${r.test}`), r.id);
  for (const r of S.RARITY) assert.ok(q.includes(`${r.id}: +${r.bump}. ${r.test}`), r.id);
  assert.match(q, /perUnit: for a moment counted per amount/);
  assert.match(q, /Daily challenge \(segment "dailyChallenge"\)/);
  assert.match(q, /5 of 14 episodes have aired/);
  assert.match(q, /recaps of this season's first 5 episodes/);
  assert.match(q, /its earlier seasons too/);
  assert.match(q, /No names and no results, anywhere/);
  assert.match(q, /"known": "pastSeasons" when this kind of moment has happened in earlier seasons/);
  assert.match(q, /"firstEpisode": the first episode of this season in which it could happen/);
  assert.match(q, /"counted": one of "yesNo"/);
  assert.doesNotMatch(q, /have been watched/, "the whole season is read: what's past the reader is held on our side");
  // A finished season: no airing line, how many episodes it has, and the search isn't pointed at particular episodes.
  const done = S.buildScoresPrompt({ show: "Survivor", season: "season 50", episodeCount: 13, blocks: survivor() });
  assert.doesNotMatch(done, /still airing/);
  assert.match(done, /This season has 13 episodes/);
  assert.doesNotMatch(done, /first \d+ episodes/);
});

test("the review takes each rung's points plus rarity on a positive one, keeps what it wasn't told, and flattens a split value", () => {
  const blocks = challenge();
  const answer = wrap({
    schema: 1,
    scores: {
      dailyChallengeWon: { rung: "wonAlone", rarity: "mostEpisodes", why: "the week's contest" },
      eliminationWon: { rung: "wonAlone", rarity: "someEpisodes", why: "sent the loser home" },
      eliminated: { rung: "out", rarity: "onceOrTwice" },
      quit: { rung: "ownFault", rarity: "onceOrTwice" },
      medicallyRemoved: { rung: "nothing", rarity: "onceOrTwice" },
      finalist: { rung: "bigPlay", rarity: "onceOrTwice" },
      winner: { rung: "wonSeason", rarity: "onceOrTwice", points: 99 },
      disqualified: { rung: "moon" },
      nominatedSurvived: { rung: "earned" },
      nobody: { rung: "edge" },
    },
    add: [],
  });
  const r = S.reviewScores(S.parseScoresAnswer(answer), blocks);
  const row = (id) => r.rows.find((x) => x.id === id);
  assert.deepEqual([row("dailyChallengeWon").before, row("dailyChallengeWon").after, row("dailyChallengeWon").rung, row("dailyChallengeWon").rarity, row("dailyChallengeWon").changed], [2, 4, "wonAlone", "mostEpisodes", true]);
  assert.equal(row("eliminationWon").after, 4.5, "a rung plus some episodes");
  assert.equal(row("finalist").after, 4, "bigPlay plus once or twice");
  assert.equal(row("winner").after, rung("wonSeason").points + 1, "the rung's points plus rarity, never the answer's own number");
  assert.equal(row("eliminated").after, -2, "rarity adds nothing to a loss");
  assert.equal(row("quit").after, -3, "nor to the worst way out");
  assert.equal(row("medicallyRemoved").after, 0, "nor to nothing");
  assert.equal(row("medicallyRemoved").changed, false, "the same value isn't a change");
  // No rarity given: the common one, with a warning; the rung still counts.
  assert.deepEqual([row("nominatedSurvived").after, row("nominatedSurvived").rarity, row("nominatedSurvived").changed], [2, "mostEpisodes", true]);
  assert.ok(r.warnings.some((w) => w.at === "scores.nominatedSurvived.rarity" && /no rarity given/.test(w.message)));
  // Not scored, or a rung that isn't on the ladder: kept, with a warning.
  assert.deepEqual([row("captain").after, row("captain").rung, row("captain").changed], [0.5, null, false]);
  assert.deepEqual([row("disqualified").after, row("disqualified").changed], [-5, false]);
  assert.ok(r.warnings.some((w) => w.at === "scores.captain" && /not scored, kept at 0.5 \(1 when shared\)/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "scores.disqualified" && /"moon" isn't a rung/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "scores.nobody"));
  // A split value takes the number for both halves.
  assert.deepEqual(r.blocks.points.finalist, { exclusive: 4, shared: 4 });
  assert.equal(row("finalist").beforeWord, "3 (5 when shared)");
  assert.equal(r.blocks.points.dailyChallengeWon, 4);
  assert.equal(r.blocks.points.medicallyRemoved, 0, "an override it already had stays");
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.held, []);
  assert.ok(r.changes >= 1);
  // The same answer again gives the same review: nothing random in it.
  assert.deepEqual(S.reviewScores(S.parseScoresAnswer(answer), blocks), r);
});

test("what's missing joins as custom moments with the rung's points; repeats, names and bad rungs are left out", () => {
  const blocks = challenge();
  const answer = wrap({
    schema: 1,
    scores: allOn(blocks, "edge"),
    add: [
      { id: "calledOut", label: "Called out an opponent", rung: "earned", rarity: "someEpisodes", why: "rare", known: "pastSeasons", firstEpisode: 1, counted: "yesNo", answeredBy: "research", reliability: "usually", during: { segment: "elimination" }, exceptWinners: true },
      { label: "Won the elimination", rung: "wonAlone" },
      { label: "Served as the team's captain", rung: "edge" },
      { label: "Bananas got in a fight", rung: "slip" },
      { label: "Each point in the Daily challenge", rung: "perUnit", points: 0.25, counted: "perUnit", answeredBy: "research" },
      { label: "Each lap", rung: "perUnit", points: 9, counted: "perUnit" },
      { label: "Looked tired", rung: "nothing", rarity: "often", counted: "sometimes", answeredBy: "fans", during: { segment: "nope" } },
      { label: "Flew to the moon", rung: "rocket" },
      { rung: "edge" },
    ],
    leftOut: [{ note: "A thing that didn't fit", firstEpisode: 1 }, "A bare sentence", 7],
  });
  const r = S.reviewScores(S.parseScoresAnswer(answer), blocks, { castNames: ["Bananas Devenanzio", "Cara Maria Sorbello"] });
  assert.deepEqual(
    r.added.map((m) => [m.id, m.points, m.rung, m.rarity, m.known, m.firstEpisode]),
    [
      ["calledOut", 2.5, "earned", "someEpisodes", "pastSeasons", 1],
      ["eachPointInTheDailyChallenge", 0.25, "perUnit", null, "thisSeason", 1],
      ["lookedTired", 0, "nothing", "mostEpisodes", "thisSeason", 1],
    ]
  );
  const custom = r.blocks.customMoments.find((m) => m.id === "calledOut");
  assert.deepEqual(custom, { id: "calledOut", label: "Called out an opponent", counted: "yesNo", answeredBy: "research", reliability: "usually", during: { segment: "elimination" }, exceptWinners: true });
  assert.equal(r.blocks.points.calledOut, 2.5);
  assert.equal(r.blocks.points.lookedTired, undefined, "nothing scores nothing: no override");
  const tired = r.blocks.customMoments.find((m) => m.id === "lookedTired");
  assert.deepEqual(tired, { id: "lookedTired", label: "Looked tired", counted: "yesNo", answeredBy: "research", reliability: "usually" }, "answers it doesn't know are tidied");
  assert.ok(r.warnings.some((w) => w.at === "add.lookedTired.counted" && /it said "sometimes"/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "add.lookedTired.during" && /"nope"/.test(w.message)));
  assert.ok(r.warnings.some((w) => w.at === "add.lookedTired.rarity" && /"often" isn't a rarity/.test(w.message)));
  assert.deepEqual(
    r.skipped.map((x) => x.why),
    ["the rulebook has it: Won the Elimination", "the rulebook has it: Served as team captain", "names Bananas Devenanzio", "perUnit points should be between 0.01 and 2", '"rocket" isn\'t a rung of the ladder', "no description"]
  );
  assert.deepEqual(r.leftOut, ["A thing that didn't fit", "A bare sentence"], "with no mark, every note shows");
  assert.deepEqual(r.problems, [], "the blocks it builds pass the schema");
  assert.ok(r.lines.some((l) => /New moment: Called out an opponent/.test(l)));
  // The new moments build, with their points.
  const built = momentsFor(r.blocks);
  assert.equal(built.find((m) => m.id === "calledOut").defaultPoints, 2.5);
  assert.deepEqual(built.find((m) => m.id === "calledOut").from, { custom: "calledOut", segment: "elimination" });
});

test("past the reader's mark, a new-this-season moment is held without a trace; the show's own repertoire never is", () => {
  const blocks = challenge();
  const answer = {
    schema: 1,
    scores: allOn(blocks, "edge"),
    add: [
      { id: "purged", label: "Eliminated in a purge", rung: "out", rarity: "onceOrTwice", known: "pastSeasons", firstEpisode: 9 },
      { id: "earlyTwist", label: "Won the opening twist", rung: "earned", known: "thisSeason", firstEpisode: 2 },
      { id: "lateTwist", label: "Won the Redemption Arena", rung: "bigPlay", known: "thisSeason", firstEpisode: 9 },
      { id: "anyTime", label: "Threw a drink", rung: "slip", known: "thisSeason" },
    ],
    leftOut: [
      { note: "A format from the final didn't fit", firstEpisode: 14 },
      { note: "An opening-night thing didn't fit", firstEpisode: 1 },
      "A bare sentence about the season",
    ],
  };
  const at3 = S.reviewScores(answer, blocks, { mark: 3, episodeCount: 14 });
  assert.deepEqual(at3.added.map((m) => m.id), ["purged", "earlyTwist", "anyTime"], "known from past seasons shows whatever its episode; this season's shows once reached");
  assert.deepEqual(at3.held, ["lateTwist"]);
  const shown = JSON.stringify({ ...at3, held: undefined });
  assert.ok(!shown.includes("Redemption") && !shown.includes("lateTwist"), "no trace of what's held: not in the rows, blocks, lines or problems");
  assert.ok(!at3.blocks.customMoments.some((m) => m.id === "lateTwist") && at3.blocks.points.lateTwist === undefined);
  assert.deepEqual(at3.leftOut, ["An opening-night thing didn't fit"], "notes past the mark are held too; a bare sentence concerns the whole season");
  // Past it: it shows, and the note from the final at the end.
  assert.deepEqual(S.reviewScores(answer, blocks, { mark: 9, episodeCount: 14 }).added.map((m) => m.id), ["purged", "earlyTwist", "lateTwist", "anyTime"]);
  assert.equal(S.reviewScores(answer, blocks, { mark: 14, episodeCount: 14 }).leftOut.length, 3);
  // No mark (0, null, the whole season): nothing is held.
  for (const mark of [0, null, Infinity]) {
    const r = S.reviewScores(answer, blocks, { mark, episodeCount: 14 });
    assert.equal(r.added.length, 4, `mark ${mark}`);
    assert.deepEqual(r.held, []);
    assert.equal(r.leftOut.length, 3);
  }
});

test("settled rows are out of the review: used or put away, they don't come back", () => {
  const blocks = challenge();
  const answer = {
    schema: 1,
    scores: allOn(blocks, "edge", "mostEpisodes", { eliminationWon: { rung: "wonAlone" } }),
    add: [
      { id: "calledOut", label: "Called out an opponent", rung: "earned", known: "pastSeasons" },
      { id: "threwADrink", label: "Threw a drink", rung: "slip", known: "pastSeasons" },
    ],
  };
  const r = S.reviewScores(answer, blocks, { settled: { eliminationWon: "used", calledOut: "used", dailyChallengeWon: "dismissed" } });
  assert.ok(!r.rows.some((x) => x.id === "eliminationWon" || x.id === "dailyChallengeWon"), "settled moments aren't rows any more");
  assert.deepEqual(r.added.map((m) => m.id), ["threwADrink"]);
  assert.equal(r.blocks.points.eliminationWon, blocks.points.eliminationWon, "nor in the blocks to apply: the override stays what it was");
  assert.ok(!r.blocks.customMoments.some((m) => m.id === "calledOut"));
  assert.ok(r.rows.some((x) => x.id === "quit" && x.changed), "the rest is as before");
});

test("picking: declined rows and additions stay as they are, the rest go in, and nothing picked changes nothing", () => {
  const blocks = challenge();
  const r = S.reviewScores(
    {
      schema: 1,
      scores: allOn(blocks, "edge", "mostEpisodes", { eliminationWon: { rung: "wonAlone" }, eliminated: { rung: "out" } }),
      add: [
        { id: "calledOut", label: "Called out an opponent", rung: "earned", known: "pastSeasons", counted: "yesNo", answeredBy: "research", reliability: "usually" },
        { id: "threwADrink", label: "Threw a drink", rung: "slip", known: "pastSeasons", counted: "eachTime", answeredBy: "league" },
      ],
    },
    blocks
  );
  const picked = S.pickScores(blocks, r, ["eliminated", "threwADrink"]);
  assert.equal(picked.points.eliminationWon, 4, "accepted: the rung's points");
  assert.equal(picked.points.eliminated, undefined, "declined: no override written");
  assert.equal(momentsFor(picked).find((m) => m.id === "eliminated").defaultPoints, -3, "declined: worth what it was");
  assert.deepEqual(picked.points.finalist, { exclusive: 1, shared: 1 }, "an accepted split value, flattened as the review has it");
  assert.ok(picked.customMoments.some((m) => m.id === "calledOut") && picked.points.calledOut === 2, "an accepted addition joins with its points");
  assert.ok(!picked.customMoments.some((m) => m.id === "threwADrink") && picked.points.threwADrink === undefined, "a declined addition doesn't");
  assert.equal(picked.customMoments.length, blocks.customMoments.length + 1);
  // Nothing declined is the review's own blocks; everything declined is the rulebook as it was.
  assert.deepEqual(S.pickScores(blocks, r), r.blocks);
  assert.deepEqual(S.pickScores(blocks, r, [...r.rows.map((x) => x.id), ...r.added.map((x) => x.id)]), blocks);
  assert.deepEqual(blocks, challenge(), "the rulebook given isn't touched");
});

test("an added-by-hand moment worth nothing is proposed for dropping; accepted it goes, declined it stays", () => {
  const blocks = challenge();
  const r = S.reviewScores({ schema: 1, scores: allOn(blocks, "edge", "mostEpisodes", { captain: { rung: "nothing", why: "not about one person" }, dailyChallengeWon: { rung: "nothing" } }), add: [] }, blocks);
  const captain = r.rows.find((x) => x.id === "captain");
  assert.deepEqual([captain.drop, captain.changed, captain.after, captain.rung], [true, true, 0, "nothing"], "added by hand: dropped");
  const daily = r.rows.find((x) => x.id === "dailyChallengeWon");
  assert.deepEqual([daily.drop, daily.changed, daily.after], [false, true, 0], "built from a segment: worth 0, never dropped");
  assert.ok(!r.blocks.customMoments.some((m) => m.id === "captain") && r.blocks.points.captain === undefined, "gone from the blocks");
  assert.deepEqual(r.problems, []);
  assert.ok(r.lines.some((l) => /captain/i.test(l)));
  const kept = S.pickScores(blocks, r, ["captain"]);
  assert.ok(kept.customMoments.some((m) => m.id === "captain") && kept.points.captain !== undefined, "declined: kept as it was");
  const gone = S.pickScores(blocks, r, []);
  assert.ok(!gone.customMoments.some((m) => m.id === "captain") && gone.points.captain === undefined, "accepted: dropped");
  assert.match(S.LADDER.find((x) => x.id === "nothing").test, /isn't something one person did/);
  assert.match(S.buildScoresPrompt({ show: "Below Deck", blocks }), /isn't something one person did or had done to them .* stands on nothing/);
});

test("a chat's chatter around the JSON is fine, and no JSON at all is said plainly", () => {
  assert.equal(S.parseScoresAnswer('Here:\n{"schema": 1, "scores": {}}\nDone.').schema, 1);
  assert.throws(() => S.parseScoresAnswer("I couldn't find anything."), /no JSON object/);
  const r = S.reviewScores({}, survivor());
  assert.equal(r.changes, 0);
  assert.equal(r.rows.length, momentsFor(survivor()).length);
  assert.ok(r.rows.every((x) => !x.changed));
});
