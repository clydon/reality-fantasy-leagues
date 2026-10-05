// Formats as data (src/lib/game/formats/checklist.js and define.js): a research checklist written as a
// list of fields builds the same Zod schema a hand-written one would, bad data is refused with a reason,
// and a checklist nobody hand-wrote -- the shape docs/PLAN-ai-generated-show-formats.md's phase 3 will
// propose -- runs through research end to end. Run with `npm test`.
//
// That the four shipped formats are unchanged by the move to data is proven separately, by diffing
// tests/harness/format-regression.js's output from before and after.
const test = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");
const C = require("../src/lib/game/formats/checklist.js");
const { defineFormat, formatProblems } = require("../src/lib/game/formats/define.js");
const Formats = require("../src/lib/game/formats/index.js");
const R = require("../db/episode-research.js");
const { termsFor } = require("../db/wiki-sync.js");

const Answer = z.enum(["yes", "no", "unknown"]);
const EXITS = ["Evicted", "Walked", "Winner", "Other"];
const json = (schema) => JSON.stringify(z.toJSONSchema(schema, { io: "output" }));
const CORE = [
  { key: "name", type: "string", description: "Their full name." },
  { key: "leftTheGame", type: "answer", description: "Did they leave?" },
  { key: "exitMethod", type: "exitMethod", nullable: true, description: "How they left." },
  { key: "sources", type: "stringList", description: "URLs." },
  { key: "confidence", type: "enum", values: ["high", "medium", "low"], description: "How sure." },
];

test("each field type builds what the same field written by hand would", () => {
  const cases = [
    [{ key: "a", type: "answer", description: "d" }, Answer.describe("d")],
    [{ key: "a", type: "string", nullable: true, description: "d" }, z.string().nullable().describe("d")],
    [{ key: "a", type: "integer", nullable: true, description: "d" }, z.number().int().nullable().describe("d")],
    [{ key: "a", type: "enum", values: ["x", "y"], description: "d" }, z.enum(["x", "y"]).describe("d")],
    [{ key: "a", type: "exitMethod", nullable: true, description: "d" }, z.enum(EXITS).nullable().describe("d")],
    [{ key: "a", type: "stringList", nullable: true, description: "d" }, z.array(z.string()).nullable().describe("d")],
    [{ key: "a", type: "string" }, z.string()],
  ];
  for (const [field, byHand] of cases) {
    assert.equal(json(C.buildChecklist([field], z, Answer, EXITS)), json(z.object({ a: byHand })), JSON.stringify(field));
  }
  // An answer with nothing added is the shared Answer itself, as the hand-written episode fields were.
  assert.equal(C.buildShape([{ key: "held", type: "answer" }], z, Answer, EXITS).held, Answer);
});

test("the description goes on the field, not inside its nullable", () => {
  const built = json(C.buildChecklist([{ key: "a", type: "integer", nullable: true, description: "d" }], z, Answer, EXITS));
  assert.notEqual(built, json(z.object({ a: z.number().int().describe("d").nullable() })));
});

test("fields that can't be built are refused, each with its reason", () => {
  const problems = (field) => C.fieldProblems([field]).join("; ");
  assert.match(problems({ key: "a", type: "date" }), /type must be one of/);
  assert.match(problems({ key: "a", type: "answer", nulable: true }), /unknown property "nulable"/);
  assert.match(problems({ key: "Has Space", type: "answer" }), /camelCase/);
  assert.match(problems({ key: "a", type: "enum" }), /needs a list of values/);
  assert.match(problems({ key: "a", type: "enum", values: ["x", "x"] }), /listed twice/);
  assert.match(problems({ key: "a", type: "string", values: ["x"] }), /only an enum/);
  assert.match(problems({ key: "a", type: "string", description: "  " }), /non-empty/);
  assert.match(problems({ key: "a", type: "string", nullable: "yes" }), /true or false/);
  assert.match(C.fieldProblems([{ key: "a", type: "answer" }, { key: "a", type: "answer" }]).join(), /used twice/);
  assert.match(C.fieldProblems([{ key: "summary", type: "answer" }], { reserved: ["summary"] }).join(), /reserved/);
});

test("a checklist must have the fields the research code reads on every format", () => {
  assert.deepEqual(C.checklistProblems(CORE), []);
  assert.match(C.checklistProblems(CORE.filter((f) => f.key !== "sources")).join(), /sources: missing/);
  const wrong = CORE.map((f) => (f.key === "exitMethod" ? { ...f, nullable: false } : f));
  assert.match(C.checklistProblems(wrong).join(), /exitMethod: must be a nullable exitMethod/);
  const badConfidence = CORE.map((f) => (f.key === "confidence" ? { ...f, values: ["sure", "unsure"] } : f));
  assert.match(C.checklistProblems(badConfidence).join(), /confidence: values must be/);
  const jury = [...CORE, { key: "juryVotesReceived", type: "string" }];
  assert.match(C.checklistProblems(jury).join(), /juryVotesReceived: must be a nullable integer/);
});

// A format nobody hand-wrote: what phase 3's research step would propose for a Big Brother-style show.
const bigBrother = {
  id: "big-brother",
  name: "Big Brother",
  exitMethods: EXITS,
  terms: { castaway: "Houseguest", tribe: "Team" },
  winnerExitMethod: "Winner",
  endgameExitMethods: ["Winner"],
  events: [
    { id: "wonHoh", label: "Won Head of Household", defaultPoints: 3 },
    { id: "wonVeto", label: "Won the Power of Veto", defaultPoints: { exclusive: 2, shared: 3 } },
    { id: "nominatedSurvived", label: "Nominated and survived", defaultPoints: 1 },
  ],
  eventCategories: [{ id: "comps", label: "Competitions", events: ["wonHoh", "wonVeto"] }],
  recap: [{ label: "Head of Household", events: ["wonHoh"] }],
  hasMerge: false,
  hasGroups: false,
  wiki: {
    voteSections: ["Voting History"],
    guideSections: ["Houseguests"],
    missingVotesNote: "no voting table",
    missingGuideNote: "no houseguest table",
    eventTypes: ["wonHoh"],
    routineEliminations: 1,
  },
  research: {
    checklist: [
      ...CORE.slice(0, 3),
      { key: "wonHoh", type: "answer", description: "Did they win Head of Household this week?" },
      { key: "wonVeto", type: "answer", description: "Did they win the Power of Veto?" },
      { key: "nominated", type: "answer", description: "Were they on the block at the eviction?" },
      { key: "evictionVotes", type: "integer", nullable: true, description: "Votes to evict them. Null if not nominated." },
      ...CORE.slice(3),
    ],
    episodeFields: [{ key: "evictionHeld", type: "answer" }],
    searchHint: ["Search for this week's recap.", "", "Then answer the checklist."],
    claims: ["leftTheGame", "wonHoh", "wonVeto"],
  },
};
const bigBrotherCode = {
  wiki: { episodesSchema: (zz) => zz.object({ episodes: zz.array(zz.object({ number: zz.number() })) }), episodesPrompt: () => ({ system: "s", user: "u" }), rejectEvent: () => null },
  research: {
    entryProblems: () => [],
    items: (entry, add) => {
      if (entry.wonHoh === "yes") add("event", "wonHoh");
      if (entry.wonVeto === "yes") add("event", "wonVeto");
      if (entry.nominated === "yes" && entry.leftTheGame !== "yes") add("event", "nominatedSurvived");
    },
    notes: () => [],
    sentences: () => [],
  },
};

test("a format's data half is checked: plain JSON, and every list refers to something that exists", () => {
  assert.deepEqual(formatProblems(bigBrother), []);
  for (const id of Object.keys(Formats.FORMATS)) assert.deepEqual(formatProblems(Formats.formatFor(id).data), [], id);
  const broken = (patch) => formatProblems({ ...structuredClone(bigBrother), ...patch }).join("; ");
  assert.match(broken({ winnerExitMethod: "Champion" }), /winnerExitMethod: not one of the exit methods/);
  assert.match(broken({ eventCategories: [{ id: "x", label: "X", events: ["wonPov"] }] }), /must all be in the catalog/);
  assert.match(broken({ events: [...bigBrother.events, { id: "wonHoh", label: "again", defaultPoints: 1 }] }), /id used twice/);
  assert.match(broken({ events: [{ id: "x", label: "X", defaultPoints: { exclusive: 1 } }] }), /defaultPoints/);
  assert.match(broken({ research: { ...bigBrother.research, claims: ["evictionVotes"] } }), /research.claims/);
  assert.match(broken({ research: { ...bigBrother.research, episodeFields: [{ key: "summary", type: "answer" }] } }), /reserved/);
  assert.match(broken({ wiki: { ...bigBrother.wiki, eventTypes: ["nope"] } }), /wiki.eventTypes/);
  assert.match(broken({ hasMerge: "no" }), /hasMerge/);
  assert.match(broken({ colour: "red" }), /unknown key "colour"/);
  assert.match(formatProblems({ ...bigBrother, impliedEvents: () => [] }).join(), /not plain JSON|unknown key/);
});

test("defineFormat refuses overlapping or misplaced halves", () => {
  assert.throws(() => defineFormat({ ...bigBrother, winnerExitMethod: "Champion" }, bigBrotherCode), /winnerExitMethod/);
  assert.throws(() => defineFormat(bigBrother, { ...bigBrotherCode, events: [] }), /code can't supply "events"/);
  assert.throws(() => defineFormat(bigBrother, { ...bigBrotherCode, wiki: { ...bigBrotherCode.wiki, voteSections: () => [] } }), /isn't something code supplies/);
  assert.throws(() => defineFormat(bigBrother, { ...bigBrotherCode, roles: { roleFor: () => "x" } }), /roles needs both/);
  assert.throws(() => defineFormat(bigBrother, { wiki: bigBrotherCode.wiki, research: { ...bigBrotherCode.research, notes: undefined } }), /notes/);
});

test("the data stays reachable on the built format without changing what it looks like", () => {
  const f = defineFormat(bigBrother, bigBrotherCode);
  assert.equal(f.data, bigBrother);
  assert.ok(!Object.keys(f).includes("data"));
  assert.deepEqual(Object.keys(f.research), ["checklistSchema", "episodeFields", "searchHint", "entryProblems", "claims", "items", "notes", "sentences"]);
});

test("a checklist nobody hand-wrote runs through research end to end", () => {
  const format = defineFormat(bigBrother, bigBrotherCode);
  const cast = ["Dan Gheesling", "Janelle Pierzina", "Will Kirby"];
  const ctx = { showName: "Big Brother", showSlug: "bb", season: 10, episodeNumber: 3, castNames: cast, terms: termsFor({ castaway_term: "Houseguests" }).terms, format, domains: [] };

  // The prose prompt asks every question (saying "None" where the schema says "Null").
  const prose = R.buildPastePrompt(ctx, []);
  for (const f of bigBrother.research.checklist.filter((x) => !["name", "sources", "confidence"].includes(x.key))) {
    assert.ok(prose.includes(f.description.replace(/\bNull\b/g, "None")), f.key);
  }
  assert.ok(R.buildPrompt({ ...ctx, bets: [] }).system.includes("every houseguest still in the game"));
  // Every provider dialect accepts it.
  for (const dialect of ["strict", "gemini"]) {
    const item = R.jsonSchemaFor(R.researchSchemaFor(format, false), dialect).properties.castaways.items;
    assert.deepEqual(Object.keys(item.properties), bigBrother.research.checklist.map((f) => f.key), dialect);
  }

  // A chat fills in the skeleton -- with one exit method the show doesn't have, which is repaired.
  const skel = R.pasteSkeleton(ctx, []);
  assert.equal(skel.evictionHeld, "unknown");
  Object.assign(skel.castaways[0], { wonHoh: "yes", sources: ["https://example.com"], confidence: "high" });
  Object.assign(skel.castaways[1], { nominated: "yes", evictionVotes: 2, wonVeto: "yes", sources: ["https://example.com"] });
  Object.assign(skel.castaways[2], { nominated: "yes", leftTheGame: "yes", exitMethod: "Backdoored", sources: [] });
  const text = R.extractJsonObject("Here you go:\n```json\n" + JSON.stringify(skel) + "\n```");
  const parsed = R.parseJsonAnswer(text, R.researchSchemaFor(format, false), "bb");
  assert.equal(parsed.castaways[2].exitMethod, "Other", "an exit the show doesn't have becomes Other");

  const review = R.validateResearch(parsed, cast, ctx.terms, format);
  assert.deepEqual(review.fatal, []);
  assert.ok(review.problems.some((p) => p.includes("Will Kirby: claims leftTheGame with no source cited")));
  const staged = R.candidatesFor(parsed, format).map((i) => `${i.castawayName}:${i.kind}:${i.eventType || i.method}`);
  assert.deepEqual(staged.sort(), ["Dan Gheesling:event:wonHoh", "Janelle Pierzina:event:nominatedSurvived", "Janelle Pierzina:event:wonVeto", "Will Kirby:elimination:Other"]);

  // A wrong type is still refused with where it went wrong.
  skel.castaways[0].evictionVotes = "two";
  assert.throws(() => R.parseJsonAnswer(JSON.stringify(skel), R.researchSchemaFor(format, false), "bb"), /castaways\.0\.evictionVotes/);
});
