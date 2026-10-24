// db/rulebooks.js and db/backfill-rulebooks.js without a database (docs/PLAN-new-design.md step R3): comparing format
// data whatever its key order, what a league plays by with no rulebook, the reader each format stands for, a season's
// confirmed merge only on a clean switch, the flag off touching nothing, and a season change's delta as ops. The
// database side (the backfill, the flag on and off over real rows, every league scoring the same) is
// scripts/dev-test/check-rulebook-flag.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const R = require("../db/rulebooks.js");
const { opsFromDelta } = require("../db/backfill-rulebooks.js");
const survivorBlocks = require("../src/lib/game/formats/blocks/survivor.blocks.js");
const STORED = require("./fixtures/stored-formats.json");

// A db that answers each query from `answer(sql, params)` and records what it was asked.
const fakeDb = (answer) => {
  const asked = [];
  return { asked, query: async (sql, params) => (asked.push(sql), { rows: answer(sql, params) || [] }) };
};

test("format data compares by content, whatever order jsonb gave its keys", () => {
  const data = Formats.FORMATS.survivor.data;
  const reversed = (v) =>
    Array.isArray(v) ? v.map(reversed) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reversed(v[k])])) : v;
  assert.notEqual(JSON.stringify(reversed(data)), JSON.stringify(data));
  assert.ok(R.sameData(reversed(data), data));
  assert.ok(R.sameData({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!R.sameData({ a: [1, 2] }, { a: [2, 1] }), "a list's order is part of what it says");
  assert.ok(!R.sameData(data, { ...data, name: "Other" }));
});

test("what a league plays by with no rulebook: its own copy, else its show's format, else Survivor's", () => {
  const [id, stored] = Object.entries(STORED)[0];
  const own = { ...Formats.FORMATS.survivor.data, name: "Ours" };
  assert.deepEqual(R.legacyBase({ leagueRulesetData: own, showFormat: "traitors" }), { data: own, reader: "league" });
  assert.deepEqual(R.legacyBase({ showFormat: "traitors" }), { data: Formats.FORMATS.traitors.data, reader: "traitors" });
  assert.deepEqual(R.legacyBase({ showFormat: id, showFormatData: stored }), { data: stored, reader: "research" });
  assert.deepEqual(R.legacyBase({}), { data: Formats.FORMATS.survivor.data, reader: "survivor" }, "a league from before formats");
  assert.deepEqual(R.legacyBase({ showFormat: id }), { data: Formats.FORMATS.survivor.data, reader: "survivor" }, "a stored format with no data cached reads as Survivor, as formatFor does");
  assert.equal(R.readerOf(Formats.FORMATS.generic), "research", "generic has no reader of its own");
});

test("the merge counts as confirmed only on a clean switch in the season's accepted results", async () => {
  const at = (episodes) => fakeDb(() => episodes.map(([n, every, some]) => ({ n, every, some })));
  const blocks = survivorBlocks.blocks;
  assert.deepEqual(await R.knownPhaseStarts(at([[5, false, false], [6, true, true], [7, true, true]]), "s", blocks), { merged: 6 });
  assert.deepEqual(await R.knownPhaseStarts(at([[6, false, false], [7, false, true], [8, true, true]]), "s", blocks), {}, "an episode mixing both");
  assert.deepEqual(await R.knownPhaseStarts(at([[6, true, true], [7, false, false]]), "s", blocks), {}, "back to pre-merge after it");
  assert.deepEqual(await R.knownPhaseStarts(at([[1, false, false]]), "s", blocks), {}, "not merged yet");
  const traitors = require("../src/lib/game/formats/blocks/traitors.blocks.js").blocks;
  const db = at([[1, true, true]]);
  assert.deepEqual(await R.knownPhaseStarts(db, "s", traitors), {});
  assert.equal(db.asked.length, 0, "a rulebook with no merge doesn't ask");
});

test("with the flag off, syncing a league only takes settings.rulebook out", async () => {
  const db = fakeDb((sql) => (/app_settings/.test(sql) ? [{ value: false }] : null));
  const settings = { showId: "survivor", wikiSeason: 51, rulebook: { id: "x", version: 1, data: {}, reader: "survivor" } };
  assert.deepEqual(await R.syncLeagueRulebook(db, "league", settings), { written: false, removed: true });
  assert.ok(!("rulebook" in settings));
  assert.equal(db.asked.length, 1, "nothing but the flag is read");
  assert.deepEqual(await R.syncLeagueRulebook(fakeDb(() => null), "league", settings, { on: false }), { written: false, removed: false });
});

test("a season change's delta becomes rulebook ops where the blocks can say it, and the rest is listed", () => {
  const delta = {
    addCategories: [{ id: "midSeason", label: "Mid-season twist" }],
    addEvents: [
      { id: "sentAway", label: "Sent away", defaultPoints: 1, category: "midSeason" },
      { id: "exiledAfterTwist", label: "Exiled (new rules)", defaultPoints: 2, implied: true, category: "midSeason" },
    ],
    addQuestions: [{ key: "sentAway", type: "answer", description: "Sent away this episode?" }],
    addExitMethods: [{ name: "Banished", endgame: false }],
    addRules: { research: [{ when: { answer: "sentAway", is: "yes" }, award: "sentAway" }], implied: [{ whenExiled: true, award: "exiledAfterTwist" }] },
    retireEvents: ["individualImmunity"],
  };
  const { ops, untranslated } = opsFromDelta(delta, survivorBlocks.aliases);
  assert.deepEqual(ops, [
    { op: "add", block: "customMoments", value: { id: "sentAway", label: "Sent away", question: "Sent away this episode?", counted: "yesNo", answeredBy: "research", reliability: "usually" } },
    { op: "add", block: "points", id: "sentAway", value: 1 },
    { op: "add", block: "waysOut", value: { id: "banished", name: "Banished", means: "out", cause: "story" } },
    { op: "add", block: "momentsOff", id: "immunityChallengeWon" },
  ]);
  assert.deepEqual(untranslated, ["event exiledAfterTwist (implied)", "category midSeason"]);
});
