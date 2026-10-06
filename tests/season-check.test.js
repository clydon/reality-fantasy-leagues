// "Check for rule changes" (src/lib/game/formats/season-check.js, docs/PLAN-season-rule-changes.md): the
// prompt carries the season's rules as they stand, a pasted answer becomes a change the review can
// approve (or "nothing changed"), anything that would redefine what the season already has is refused,
// and research stages a change's new events only from its effective episode. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const Check = require("../src/lib/game/formats/season-check.js");
const R = require("../db/episode-research.js");

const survivor = Formats.FORMATS.survivor;

// What a chat might send back after a mid-season twist (made up: nothing here is a real show's rules).
const answer = (over = {}) => ({
  changed: true,
  summary: "From episode 8 one person a week is sent to a second camp.",
  effectiveEpisode: 8,
  checkedThrough: 9,
  questions: [{ key: "sentToSecondCamp", type: "answer", question: "Were they sent to the second camp this episode?", note: "second camp", tier: "A", where: "every recap" }],
  events: [{ id: "sentToSecondCamp", label: "Sent to the second camp", category: "Mid-season twist", points: 1, tier: "A", why: "reported every week" }],
  rules: { research: [{ when: { answer: "sentToSecondCamp", is: "yes" }, award: "sentToSecondCamp" }], implied: [] },
  sources: ["https://example.com/recap-8"],
  ...over,
});

test("the prompt lists the season's rules as they stand, and what's already recorded", () => {
  const approved = [{ id: "c1", effectiveEpisode: 5, summary: "A journey twist.", delta: { addQuestions: [{ key: "earlierTwist", type: "answer", description: "An earlier twist?" }] } }];
  const prompt = Check.buildCheckPrompt({ showName: "Survivor", seasonLabel: "season 51", data: Formats.withChanges(survivor, approved).data, airedThrough: 9, approved, flags: [{ episode: 9, note: "A new kind of advantage appeared." }] });
  assert.match(prompt, /"Survivor", season 51, which is still airing \(episode 9 has aired\)/);
  assert.match(prompt, /wonIndividualImmunity \(answer\)/, "the questions research asks");
  assert.match(prompt, /\[Journeys & Exile\] wentToExile/, "events by category");
  assert.match(prompt, /earlierTwist/, "an approved change's question is part of the rules now");
  assert.match(prompt, /from episode 5: A journey twist\./);
  assert.match(prompt, /episode 9: A new kind of advantage appeared\./);
  assert.match(prompt, /"changed": "boolean/);
});

test("an answer becomes a change: new questions, events, a new category and gated rules", () => {
  const review = Check.reviewCheck(answer(), survivor.data);
  assert.deepEqual(review.problems, []);
  assert.ok(review.approvable);
  assert.equal(review.effectiveEpisode, 8);
  assert.deepEqual(review.delta.addCategories, [{ id: "midSeasonTwist", label: "Mid-season twist" }]);
  assert.deepEqual(review.delta.addEvents, [{ id: "sentToSecondCamp", label: "Sent to the second camp", defaultPoints: 1, category: "midSeasonTwist" }]);
  assert.deepEqual(review.delta.addQuestions, [{ key: "sentToSecondCamp", type: "answer", description: "Were they sent to the second camp this episode?", note: "second camp" }]);
  assert.match(review.events[0].rules[0].sentence, /→ Sent to the second camp \(from episode 8\)$/);
  assert.deepEqual(Formats.changeProblems({ id: "x", effectiveEpisode: 8, delta: review.delta }), [], "a valid change");
});

test("an event names an existing category by its label or id", () => {
  const review = Check.reviewCheck(answer({ events: [{ ...answer().events[0], category: "journeys & exile" }] }), survivor.data);
  assert.deepEqual(review.delta.addCategories, []);
  assert.equal(review.delta.addEvents[0].category, "twists");
});

test("nothing changed is an answer, and never approvable", () => {
  const review = Check.reviewCheck({ changed: false, summary: "Nothing new through episode 9.", checkedThrough: 9 }, survivor.data);
  assert.equal(review.changed, false);
  assert.equal(review.approvable, false);
  assert.deepEqual(review.problems, []);
  assert.equal(review.checkedThrough, 9);
});

test("a change can't redefine what the season already has", () => {
  const review = Check.reviewCheck(answer({
    events: [{ id: "individualImmunity", label: "Immunity (new)", category: "Challenges", points: 9, tier: "A" }],
    questions: [{ key: "wonIndividualImmunity", type: "answer", question: "again?", tier: "A" }],
    exitMethods: [{ name: "voted out", kind: "out" }],
    rules: { research: [], implied: [] },
  }), survivor.data);
  assert.ok(!review.approvable);
  assert.match(review.problems.map((p) => p.message).join(), /individualImmunity is already an event; a change can't redefine one/);
  assert.deepEqual(review.repairs.map((r) => r.message), ["already a way of leaving; left out", "wonIndividualImmunity is already asked; left out"]);
});

test("what doesn't fit is a problem at its row, and blocks approval", () => {
  const noEpisode = Check.reviewCheck(answer({ effectiveEpisode: null }), survivor.data);
  assert.match(noEpisode.problems.map((p) => p.message).join(), /which episode does it apply from/);
  assert.ok(Check.reviewCheck(answer({ effectiveEpisode: null }), survivor.data, { effectiveEpisode: 8 }).approvable, "the admin can supply it");

  const badRule = Check.reviewCheck(answer({ rules: { research: [{ when: { answer: "noSuchQuestion", is: "yes" }, award: "sentToSecondCamp" }], implied: [] } }), survivor.data);
  assert.ok(!badRule.approvable);
  assert.match(badRule.problems.map((p) => p.message).join(), /no checklist question "noSuchQuestion"/);

  const empty = Check.reviewCheck({ changed: true, effectiveEpisode: 8 }, survivor.data);
  assert.match(empty.problems.map((p) => p.message).join(), /adds nothing/);

  const winner = Check.reviewCheck(answer({ exitMethods: [{ name: "Crowned", kind: "winner" }] }), survivor.data);
  assert.equal(winner.exits[0].kind, "out", "a change can't add a second winner");
});

test("a tier D finding goes to not-trackable, and a flagged mechanic is called out", () => {
  const review = Check.reviewCheck(answer({
    events: [...answer().events, { id: "secretDeal", label: "Made a secret deal", category: "Twist", points: 2, tier: "D", why: "speculation" }],
    flagged: [{ name: "Votes now count double", what: "after the twist", whyCode: "changes how an existing rule works" }],
  }), survivor.data);
  assert.deepEqual(review.notTrackable.map((x) => x.fact), ["Made a secret deal"]);
  assert.equal(review.flagged.length, 1);
  assert.match(review.warnings.map((w) => w.message).join(), /flagged for a developer/);
  assert.ok(review.approvable, "flagged things don't block the additions");
});

test("research stages a change's new event only from its effective episode", () => {
  const delta = Check.reviewCheck(answer(), survivor.data).delta;
  const format = Formats.withChanges(survivor, [{ id: "c", effectiveEpisode: 8, delta }]);
  const payload = { castaways: [{ name: "Ada", leftTheGame: "no", exitMethod: null, sentToSecondCamp: "yes", sources: ["x"], confidence: "high" }] };
  const staged = (episode) => R.candidatesFor(payload, format, episode).map((c) => c.eventType);
  assert.deepEqual(staged(7), []);
  assert.deepEqual(staged(8), ["sentToSecondCamp"]);
});
