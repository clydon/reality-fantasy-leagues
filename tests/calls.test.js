// Call it's rules (src/lib/game/calls.ts, docs/PLAN-new-design.md step 12 part 2): the two calls an episode gets from a show's
// rulebook (Who goes home? where someone goes home every episode, then yes-or-no moments that change from episode to episode,
// never a secret role's or one research can't answer), how a call is settled (who went home, nobody did, every result in, the
// couch's say on a talk show), and the tallies the pool and Weekly Calls read. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { callMoments, callQuestions, callKeys, verdictOf, isRight, settleSays, tallyCalls, CALLS_PER_EPISODE } = jiti("../src/lib/game/calls.ts");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("./fixtures/rulebook-samples.js");

const faces = [
  { id: "c1", name: "Ann", photo: null },
  { id: "c2", name: "Bo", photo: null },
  { id: "c3", name: "Cy", photo: null },
];
const book = (b) => (b.blocks ? b : { blocks: b, aliases: null });

test("a competition: Who goes home? from who's still in, then one moment, by its recorded event id", () => {
  const qs = callQuestions(BUILT_IN_BLOCKS.survivor, 2, faces);
  assert.equal(qs.length, CALLS_PER_EPISODE);
  assert.deepEqual(
    qs.map((q) => [q.key, q.kind, q.by]),
    [
      ["out", "cast", "results"],
      ["m:idolPlayed", "yesno", "results"],
    ]
  );
  assert.equal(qs[0].lead, "Who goes home?");
  assert.deepEqual(qs[0].options.map((o) => o.key), ["c1", "c2", "c3"]);
  assert.equal(qs[1].lead, "Anyone this episode?");
  assert.equal(qs[1].what, "Played an idol or advantage");
  assert.deepEqual(qs[1].options.map((o) => o.key), ["yes", "no"]);
  // The moment goes round the show's twists, episode by episode.
  assert.notEqual(callQuestions(BUILT_IN_BLOCKS.survivor, 3, faces)[1].key, qs[1].key);
  assert.equal(callQuestions(BUILT_IN_BLOCKS.survivor, 2, faces)[1].key, qs[1].key, "the same for everyone");
});

test("no cast known (or someone behind): no Who goes home?, so two moments", () => {
  const qs = callQuestions(BUILT_IN_BLOCKS.survivor, 2, null);
  assert.equal(qs.length, 2);
  assert.ok(qs.every((q) => q.kind === "yesno"));
  assert.deepEqual(callKeys(BUILT_IN_BLOCKS.survivor, 2, true), ["out", "m:idolPlayed"]);
});

test("a secret role's moments and a role's name are never called; the couch's own moments neither", () => {
  const ids = callMoments(BUILT_IN_BLOCKS.traitors).map((m) => m.id);
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => !/traitor|faithful|recruit/i.test(id)), ids.join());
  const named = callMoments(BUILT_IN_BLOCKS.traitors).map((m) => m.label);
  assert.ok(named.every((l) => !/Traitor|Faithful/.test(l)), named.join());
  const bd = SAMPLES.belowDeck.blocks || SAMPLES.belowDeck;
  assert.ok(callMoments(book(bd), 2).length >= 2, "a series still gets two");
});

test("a series has nobody going home: two moments; a talk show's are the couch's to settle", () => {
  const series = callQuestions(book(SAMPLES.belowDeck.blocks || SAMPLES.belowDeck), 1, faces);
  assert.equal(series.length, 2);
  assert.ok(series.every((q) => q.kind === "yesno" && q.by === "results"));
  const talk = callQuestions(book(SAMPLES.snl.blocks || SAMPLES.snl), 1, faces);
  assert.equal(talk.length, 2);
  assert.ok(talk.every((q) => q.by === "couch" && q.lead === "Tonight?"));
  assert.notDeepEqual(
    callQuestions(book(SAMPLES.snl.blocks || SAMPLES.snl), 2, faces).map((q) => q.key),
    talk.map((q) => q.key),
    "a different two next show"
  );
});

test("settling: who went home (early results are enough), nobody did, every result in, the couch's say", () => {
  const facts = { out: ["c2"], events: null };
  assert.deepEqual(verdictOf("out", "results", facts, null), { state: "known", right: ["c2"] });
  assert.deepEqual(verdictOf("m:idolPlayed", "results", facts, null), { state: "waiting" }, "a moment waits for the final results");
  assert.deepEqual(verdictOf("m:idolPlayed", "results", { out: ["c2"], events: new Set(["idolPlayed"]) }, null), { state: "known", right: ["yes"] });
  assert.deepEqual(verdictOf("m:idolFound", "results", { out: ["c2"], events: new Set(["idolPlayed"]) }, null), { state: "known", right: ["no"] });
  assert.deepEqual(verdictOf("out", "results", { out: [], events: new Set() }, null), { state: "off", why: "Nobody went home" });
  assert.deepEqual(verdictOf("out", "results", null, null), { state: "waiting" });
  assert.deepEqual(verdictOf("m:breaksCharacter", "couch", null, null), { state: "waiting" });
  assert.deepEqual(verdictOf("m:breaksCharacter", "couch", null, "yes"), { state: "known", right: ["yes"] });
  assert.equal(isRight({ state: "known", right: ["c2"] }, "c2"), true);
  assert.equal(isRight({ state: "known", right: ["c2"] }, "c1"), false);
  assert.equal(isRight({ state: "off", why: "Nobody went home" }, "c1"), null, "called off: neither");
  assert.equal(isRight({ state: "waiting" }, "c1"), null);
});

test("the couch's say: two agreeing, more than say otherwise; alone, your own", () => {
  assert.equal(settleSays([], false), null);
  assert.equal(settleSays([true], false), null, "one voice waits for a second");
  assert.equal(settleSays([true, true], false), "yes");
  assert.equal(settleSays([true, false], false), null, "a split waits");
  assert.equal(settleSays([true, false, false], false), "no");
  assert.equal(settleSays([false], true), "no", "alone on the show: yours settles it");
});

test("tallies: right calls and settled ones, by person; only some questions for a pool", () => {
  const verdicts = new Map([
    [5, { out: { state: "known", right: ["c2"] }, "m:idolPlayed": { state: "known", right: ["no"] } }],
    [6, { out: { state: "off", why: "Nobody went home" }, "m:idolFound": { state: "waiting" } }],
  ]);
  const calls = [
    { userId: "ann", episode: 5, key: "out", answer: "c2" },
    { userId: "ann", episode: 5, key: "m:idolPlayed", answer: "yes" },
    { userId: "ann", episode: 6, key: "out", answer: "c1" },
    { userId: "bo", episode: 5, key: "out", answer: "c1" },
    { userId: "bo", episode: 5, key: "m:idolPlayed", answer: "no" },
    { userId: "bo", episode: 6, key: "m:idolFound", answer: "yes" },
  ];
  const all = tallyCalls(calls, verdicts);
  assert.deepEqual(all.get("ann"), { right: 1, settled: 2 });
  assert.deepEqual(all.get("bo"), { right: 1, settled: 2 });
  const outs = tallyCalls(calls, verdicts, (k) => k === "out");
  assert.deepEqual(outs.get("ann"), { right: 1, settled: 1 });
  assert.deepEqual(outs.get("bo"), { right: 0, settled: 1 });
});
