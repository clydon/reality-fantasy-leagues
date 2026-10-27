// Researched trivia's prompt and parse (db/trivia-research.js): the bot's questions about an episode and the season so far,
// each checked on its own (four different options, the answer one of them, a source, an episode no later than the one that
// aired), a person's options matched back to the cast and a number's sorted. No database, no bot. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTriviaPrompt, parseTriviaAnswer, buildCheckPrompt, parseCheckAnswer, judged, QUESTIONS } = require("../db/trivia-research.js");

const cast = ["Ann Archer", "Bo Bright", "Cy Cole", "Di Drake", "Ed Eames"];
const q = (over = {}) => ({
  episode: 4,
  question: "Who found the idol under the well?",
  options: ["Ann Archer", "Bo Bright", "Cy Cole", "Di Drake"],
  answer: "Bo Bright",
  why: "Bo dug it up on day 9.",
  source: "https://example.com/recap",
  ...over,
});
const fenced = (body) => "Here you go:\n```json\n" + JSON.stringify(body) + "\n```";

test("the prompt names the episode, the split and the cast with who's left", () => {
  const p = buildTriviaPrompt({ showName: "Survivor", season: 51, episode: 4, cast: [{ name: "Ann Archer", out: null }, { name: "Cy Cole", out: 2 }] });
  assert.match(p, /Episode 4 is the latest to air; episode 5 hasn't aired yet/);
  assert.match(p, new RegExp(`Write ${QUESTIONS} multiple-choice`));
  assert.match(p, /3 about episode 4 itself/);
  assert.match(p, /- Cy Cole \(left in episode 2\)/);
  assert.match(p, /- Ann Archer\n/);
  assert.match(p, /```json/);
  const first = buildTriviaPrompt({ showName: "Survivor", season: 51, episode: 1, cast: [] });
  assert.match(first, /all 6 about episode 1/);
  assert.doesNotMatch(first, /season so far/);
});

test("a good answer parses, people matched to the cast by first name", () => {
  const r = parseTriviaAnswer(fenced({ found: true, questions: [q({ options: ["Ann", "Bo", "Cy", "Di"], answer: "bo" })] }), 4, cast);
  assert.equal(r.found, true);
  assert.equal(r.questions.length, 1);
  assert.deepEqual(r.questions[0].options, ["Ann Archer", "Bo Bright", "Cy Cole", "Di Drake"]);
  assert.equal(r.questions[0].answer, "Bo Bright");
  assert.equal(r.questions[0].kind, "cast");
});

test("numbers sort, keep their answer, and may come as numbers", () => {
  const r = parseTriviaAnswer(fenced({ questions: [q({ question: "How many votes did Cy get?", options: [5, "3", "2", "4"], answer: 3 })] }), 4, cast);
  assert.equal(r.questions[0].kind, "number");
  assert.deepEqual(r.questions[0].options, ["2", "3", "4", "5"]);
  assert.equal(r.questions[0].answer, "3");
});

test("anything else is text", () => {
  const r = parseTriviaAnswer(fenced({ questions: [q({ question: "What was the reward?", options: ["Pizza", "Burgers", "Tacos", "Letters from home"], answer: "Tacos" })] }), 4, cast);
  assert.equal(r.questions[0].kind, "text");
  assert.equal(r.questions[0].answer, "Tacos");
});

test("bad questions drop, each with why, and the good ones stay", () => {
  const bad = [
    q({ episode: 5 }),
    q({ episode: "two" }),
    q({ options: ["Ann", "Bo", "Cy"] }),
    q({ options: ["Ann", "Bo", "Cy", "ann"] }),
    q({ answer: "Ed Eames" }),
    q({ source: "" }),
    q({ options: ["Ann", "Bo", "Cy", "None of the above"], answer: "Ann" }),
    q({ options: ["Ann", "Ann Archer", "Cy", "Di"], answer: "Cy" }),
    q({ question: "Who?" }),
    "not a question",
  ];
  const r = parseTriviaAnswer(fenced({ found: true, questions: [...bad, q(), q()] }), 4, cast);
  assert.equal(r.questions.length, 1);
  assert.deepEqual(
    r.dropped.map((d) => d.why),
    [
      "episode must be 1 to 4",
      "episode must be 1 to 4",
      "needs exactly 4 options",
      "two options are the same",
      "answer isn't one of the options",
      "no source URL",
      "an all/none/both option",
      "two options are the same person",
      "question missing or too long",
      "not an object",
      "asked twice",
    ]
  );
});

test("not found, nothing usable, or no JSON at all", () => {
  assert.equal(parseTriviaAnswer(fenced({ found: false, questions: [] }), 4, cast).found, false);
  assert.equal(parseTriviaAnswer(fenced({ found: true, questions: [q({ source: null })] }), 4, cast).found, false);
  assert.throws(() => parseTriviaAnswer("Sorry, I couldn't find anything.", 4, cast));
});

test("the check lists every question with its answer and source, and asks for one verdict each", () => {
  const p = buildCheckPrompt({ showName: "Survivor", season: 51, episode: 4, questions: [q(), q({ episode: 2, question: "How many votes did Cy get?", options: ["2", "3", "4", "5"], answer: "3", why: null })] });
  assert.match(p, /1\. \[Episode 4\] Who found the idol under the well\?/);
  assert.match(p, /Options: Ann Archer \| Bo Bright \| Cy Cole \| Di Drake/);
  assert.match(p, /Given answer: Bo Bright/);
  assert.match(p, /Explanation: Bo dug it up on day 9\./);
  assert.match(p, /2\. \[Episode 2\] How many votes/);
  assert.match(p, /"checks"/);
});

test("only a question every check passes goes live; the rest drop, with why", () => {
  const parsed = parseTriviaAnswer(fenced({ questions: [q(), q({ question: "Who lit the fire?" }), q({ question: "Who swam back?" }), q({ question: "Who kept the map?" }), q({ question: "Who sat out?" })] }), 4, cast);
  const checks = parseCheckAnswer(
    fenced({
      checks: [
        { n: 1, correct: true, onlyOne: true, spoilerFree: true, note: "" },
        { n: 2, correct: false, onlyOne: true, spoilerFree: true, note: "It was Cy" },
        { n: 3, correct: true, onlyOne: false, spoilerFree: true },
        { n: 4, correct: true, onlyOne: true, spoilerFree: false },
        { n: 1, correct: false, onlyOne: false, spoilerFree: false },
        { n: 9, correct: true, onlyOne: true, spoilerFree: true },
      ],
    }),
    5
  );
  assert.deepEqual(
    judged(parsed, checks).map((x) => [x.status, x.note]),
    [
      ["live", null],
      ["dropped", "the check couldn't confirm the answer: It was Cy"],
      ["dropped", "another option could be right"],
      ["dropped", "gives a later episode away"],
      ["dropped", "not checked"],
    ]
  );
});
