// Paste import (db/episode-research.js), end to end short of the database: prompt -> skeleton ->
// a chat's answer -> parse -> validate -> staged results. Run with `npm test`.
//
// Driven by the format registry, not hand-written per show: every format, every checklist field, every
// allowed answer. A new show format, a new checklist question or a new scoring event is covered as
// soon as it exists, and a mapping that stages something the app can't apply fails here first.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const { termsFor } = require("../db/wiki-sync.js");

const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"];
const BETS = [
  { label: "Will an idol be played?", guesses: ["yes", "no"] },
  { label: "Who goes home?", guesses: ["Ada", "Grace Hopper"] },
];
const FORMATS = Formats.formatOptions().map((f) => Formats.formatFor(f.id));

const ctxFor = (format) => ({
  showName: "Test Show",
  showSlug: "test",
  season: 1,
  episodeNumber: 2,
  castNames: CAST,
  terms: termsFor({}).terms,
  format,
  domains: [],
});
const schemaFor = (format, bets) => R.researchSchemaFor(format, bets.length > 0);
const jsonSchema = (format, bets) => R.jsonSchemaFor(schemaFor(format, bets), "strict");
// What an admin actually pastes: the chat's JSON with the usual chatter and code fence around it.
const asPasted = (obj) => "Sure! Here's the checklist:\n```json\n" + JSON.stringify(obj, null, 2) + "\n```\nLet me know if you need more.";
const parse = (format, bets, text) => R.parseJsonAnswer(R.extractJsonObject(text), schemaFor(format, bets), "test");

// The checklist fields of one person, straight off the schema: name -> { values, type }.
function entryFields(format) {
  const item = jsonSchema(format, []).properties.castaways.items;
  const out = {};
  for (const [key, node] of Object.entries(item.properties)) {
    const variants = node.anyOf || [node];
    const real = variants.find((v) => v.type !== "null") || node;
    const nullable = variants.some((v) => v.type === "null") || (Array.isArray(node.type) && node.type.includes("null"));
    out[key] = { enum: real.enum, type: Array.isArray(real.type) ? real.type.find((t) => t !== "null") : real.type, nullable };
  }
  return out;
}

// Everything a staged result may legally be, per format -- what apply-time accepts.
function allowedResult(format, item) {
  if (item.kind === "event") return format.events.some((e) => e.id === item.eventType);
  if (item.kind === "elimination") return format.exitMethods.includes(item.method) && item.eventType === "";
  if (item.kind === "exiled") return item.eventType === "";
  if (item.kind === "role") return !!item.method && item.eventType === "";
  return false;
}

for (const format of FORMATS) {
  test(`${format.id}: the prompt carries the schema, every person and every bet`, () => {
    const prompt = R.buildPastePrompt(ctxFor(format), BETS, { structured: true });
    for (const name of CAST) assert.ok(prompt.includes(name), `prompt is missing ${name}`);
    for (const bet of BETS) assert.ok(prompt.includes(bet.label), `prompt is missing bet "${bet.label}"`);
    for (const field of Object.keys(entryFields(format))) assert.ok(prompt.includes(`"${field}"`), `prompt is missing field ${field}`);
    // The prose prompt must not ask for JSON, but must still ask every checklist question -- the
    // structuring pass can only score what the chat was asked about.
    const prose = R.buildPastePrompt(ctxFor(format), [], { structured: false });
    assert.ok(!prose.includes("JSON Schema"));
    const person = jsonSchema(format, []).properties.castaways.items.properties;
    for (const [field, node] of Object.entries(person)) {
      if (["name", "sources", "confidence"].includes(field) || !node.description) continue;
      assert.ok(prose.includes(node.description.replace(/\bNull\b/g, "None")), `prose prompt doesn't ask about ${field}`);
    }
  });

  test(`${format.id}: the untouched skeleton round-trips cleanly, with bets and without`, () => {
    for (const bets of [[], BETS]) {
      const skel = R.pasteSkeleton(ctxFor(format), bets);
      assert.deepEqual(Object.keys(skel).sort(), Object.keys(jsonSchema(format, bets).properties).sort());
      assert.deepEqual(skel.castaways.map((c) => c.name), CAST);
      const parsed = parse(format, bets, asPasted(skel));
      assert.equal(parsed.repairs, undefined, `the skeleton itself needed repairs: ${parsed.repairs}`);
      const review = R.validateResearch(parsed, CAST, ctxFor(format).terms, format);
      assert.deepEqual(review.fatal, []);
      // All "don't know": nothing should be staged from it.
      assert.deepEqual(R.candidatesFor(parsed, format), []);
      if (bets.length) assert.equal(skel.betAnswers.length, bets.length);
    }
  });

  test(`${format.id}: every value of every checklist field parses and stages only legal results`, () => {
    const fields = entryFields(format);
    for (const [field, spec] of Object.entries(fields)) {
      if (field === "name" || field === "sources") continue;
      const values = spec.enum ? [...spec.enum] : spec.type === "integer" || spec.type === "number" ? [0, 3] : spec.type === "string" ? ["some text"] : [];
      if (spec.nullable) values.push(null);
      for (const value of values) {
        const skel = R.pasteSkeleton(ctxFor(format), []);
        const person = skel.castaways[0];
        person.sources = ["https://example.com/recap"];
        person.confidence = "high";
        person[field] = value;
        // An exit method only means something when they left.
        if (field === "exitMethod" && value !== null) person.leftTheGame = "yes";
        const parsed = parse(format, [], asPasted(skel));
        assert.equal(parsed.repairs, undefined, `${field}=${JSON.stringify(value)} needed repairs: ${parsed.repairs}`);
        assert.deepEqual(parsed.castaways[0][field], value, `${field}=${JSON.stringify(value)} didn't survive parsing`);
        const review = R.validateResearch(parsed, CAST, ctxFor(format).terms, format);
        assert.deepEqual(review.fatal, [], `${field}=${JSON.stringify(value)} was fatal`);
        for (const item of R.candidatesFor(parsed, format)) {
          assert.ok(allowedResult(format, item), `${field}=${JSON.stringify(value)} staged an illegal result: ${JSON.stringify(item)}`);
          assert.equal(item.castawayName, CAST[0]);
        }
      }
    }
  });

  test(`${format.id}: each exit method stages an elimination, and the winner is placed last`, () => {
    for (const method of format.exitMethods) {
      const skel = R.pasteSkeleton(ctxFor(format), []);
      Object.assign(skel.castaways[1], { leftTheGame: "yes", exitMethod: method, sources: ["https://example.com"], confidence: "high" });
      const items = R.candidatesFor(parse(format, [], asPasted(skel)), format).filter((i) => i.kind === "elimination");
      assert.deepEqual(items.map((i) => [i.castawayName, i.method]), [[CAST[1], method]]);
    }
    // A finale: the winner listed first in cast order still stages after the runner-up.
    const skel = R.pasteSkeleton(ctxFor(format), []);
    const runnerUp = format.exitMethods.find((m) => m !== format.winnerExitMethod && m !== "Other");
    Object.assign(skel.castaways[0], { leftTheGame: "yes", exitMethod: format.winnerExitMethod, sources: ["x"] });
    Object.assign(skel.castaways[2], { leftTheGame: "yes", exitMethod: runnerUp, sources: ["x"] });
    const order = R.candidatesFor(parse(format, [], asPasted(skel)), format).filter((i) => i.kind === "elimination");
    assert.deepEqual(order.map((i) => i.method), [runnerUp, format.winnerExitMethod]);
  });

  test(`${format.id}: every "yes" claim a reviewer is asked to source produces a result`, () => {
    for (const claim of format.research.claims) {
      const skel = R.pasteSkeleton(ctxFor(format), []);
      Object.assign(skel.castaways[0], { [claim]: "yes", sources: ["x"], confidence: "high" });
      if (claim === "leftTheGame") skel.castaways[0].exitMethod = format.exitMethods[0];
      const items = R.candidatesFor(parse(format, [], asPasted(skel)), format);
      assert.ok(items.length > 0, `${claim}: "yes" stages nothing`);
    }
  });

  test(`${format.id}: an answer outside the show's options is repaired and reported, not fatal`, () => {
    const skel = R.pasteSkeleton(ctxFor(format), []);
    Object.assign(skel.castaways[0], { leftTheGame: "yes", exitMethod: "Abducted by aliens" });
    skel.castaways[1].leftTheGame = "definitely";
    const parsed = parse(format, [], asPasted(skel));
    assert.equal(parsed.castaways[0].exitMethod, "Other");
    assert.equal(parsed.castaways[1].leftTheGame, "unknown");
    assert.equal(parsed.repairs.length, 2);
  });

  test(`${format.id}: someone missing from the answer is fatal; a stranger is dropped with a note`, () => {
    const skel = R.pasteSkeleton(ctxFor(format), []);
    const missing = { ...skel, castaways: skel.castaways.slice(1) };
    assert.ok(R.validateResearch(parse(format, [], asPasted(missing)), CAST, ctxFor(format).terms, format).fatal.length > 0);
    const extra = { ...skel, castaways: [...skel.castaways, { ...skel.castaways[0], name: "Nobody Real" }] };
    const review = R.validateResearch(parse(format, [], asPasted(extra)), CAST, ctxFor(format).terms, format);
    assert.deepEqual(review.fatal, []);
    assert.ok(review.problems.some((p) => p.includes("Nobody Real")));
  });

  test(`${format.id}: bet answers map back to their question, and only listed guesses count`, () => {
    const skel = R.pasteSkeleton(ctxFor(format), BETS);
    skel.betAnswers[1] = { ...skel.betAnswers[1], answer: "Ada Lovelace", correctGuesses: ["Ada", "Somebody Else"], confidence: "high" };
    const answers = R.betAnswersFrom(parse(format, BETS, asPasted(skel)), BETS);
    assert.equal(answers.length, BETS.length);
    assert.equal(answers[1].question, BETS[1].label);
    assert.deepEqual(answers[1].correctGuesses, ["Ada"]);
    assert.equal(answers[0].answer, null);
  });
}

test("a paste with no JSON in it is a clear error, not a charge", () => {
  assert.throws(() => R.extractJsonObject("I couldn't find anything about that episode."), /no JSON object/);
  assert.throws(() => parse(FORMATS[0], [], "{ this is not json }"), /valid JSON/);
});

test("every format has something to paste", () => {
  assert.ok(FORMATS.length >= 3);
  for (const format of FORMATS) assert.ok(Object.keys(entryFields(format)).length > 3, `${format.id} has an empty checklist`);
});
