// The capability tracker (docs/PLAN-start-a-game-gpt.md step A5): tests/fixtures/engine-capabilities.json, each row's status
// worked out from the engine (game-spec capabilities.js), and docs/ENGINE-CAPABILITIES.md written from them by
// scripts/engine-capabilities.js. Keeps it honest: no row says it plays now without a spec the validator passes, every row says
// what it needs, and the doc is what the tracker and the engine say today. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const C = require("../src/lib/game/game-spec/capabilities.js");
const T = require("../scripts/engine-capabilities.js");

const tracker = JSON.parse(fs.readFileSync(T.TRACKER, "utf8"));
const rows = C.rowsOf(tracker);

test("every row says what it needs, with a unique id, a page for a request and a step of the plan", () => {
  const ids = rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  assert.deepEqual(rows.flatMap((r) => C.rowProblems(r)), []);
  assert.ok(tracker.dials.length === 9, "the nine dials");
  assert.ok(tracker.corpus.requests.length >= 100, "the words corpus moved in whole");
});

test("no row plays now without a spec the validator passes, and a spec that doesn't pass yet names its step", () => {
  for (const x of T.statusRows(tracker)) {
    if (x.st.state === "yes") {
      assert.ok(x.row.spec, `${x.row.id}: ✅ has a spec`);
      assert.deepEqual(x.st.problems, [], x.row.id);
      assert.deepEqual(x.st.waits, [], x.row.id);
    }
    if (x.row.spec && x.st.state !== "yes") assert.ok(x.row.step, `${x.row.id}: its spec doesn't pass yet (${JSON.stringify([...x.st.problems, ...x.st.waits])}), so it names the step that brings it`);
  }
  // What the engine plays after A4: every dial has something that plays now.
  for (const d of tracker.dials) assert.ok(T.statusRows({ dials: [d] }).some((x) => x.st.state === "yes"), d.id);
});

test("a row's status comes from the engine: a spec that passes plays now even with a step, the rest wait or ask", () => {
  const sheet = { get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" } };
  const out = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
  const ctx = T.ctxOf({ rulebook: "survivor" });
  assert.equal(C.statusOf({ id: "a", spec: { ...sheet, ask: [out] }, step: "A6" }, ctx).state, "yes", "its step landed");
  // An answer no step has built yet (A6 built which tribe: a group answer).
  const tribe = { ...out, id: "tribe", ask: "Which tribe wins immunity?", answer: "group", settle: { by: "moment", moment: "tribeImmunity", take: "who" } };
  assert.equal(C.statusOf({ id: "b0", spec: { ...sheet, ask: [tribe] }, step: "A6" }, ctx).state, "yes", "A6 landed");
  const vibe = { ...out, id: "vibe", ask: "How did the episode feel?", answer: "vibe" };
  const waiting = C.statusOf({ id: "b", spec: { ...sheet, ask: [vibe] }, step: "A14" }, ctx);
  assert.equal(waiting.state, "step");
  assert.ok(waiting.problems.length > 0, "what's missing is said");
  assert.equal(C.statusOf({ id: "c", step: "A9" }, ctx).state, "step");
  assert.equal(C.statusOf({ id: "d", decide: "a rule" }, ctx).state, "decide");
  assert.equal(C.statusOf({ id: "e", gpt: true }, ctx).state, "gpt");
  assert.equal(C.statusOf({ id: "f", planned: false }, ctx).state, "new");
  // The data rule: a moment the couch answers can't score, so a Weekly Lineup on Below Deck's sample rules scores those 0.
  const bd = T.ctxOf({ rulebook: "belowDeck" });
  assert.equal(C.statusOf({ id: "g", spec: { preset: "weekly-lineup" } }, bd).state, "new");
  assert.equal(C.statusOf({ id: "h", spec: { preset: "weekly-lineup", score: { by: "moments", points: { crewHookup: 0, criesOnCamera: 0 } } } }, bd).state, "yes");
});

test("docs/ENGINE-CAPABILITIES.md is what the tracker and the engine say now (run node scripts/engine-capabilities.js)", () => {
  const doc = fs.readFileSync(T.DOC, "utf8").replace(/\r\n/g, "\n");
  assert.equal(doc, T.render(tracker));
});
