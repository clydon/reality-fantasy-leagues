// Solo (docs/PLAN-sports-couch.md C4; src/lib/sports/own-calls.ts): a fan's own games told by their question (your calls, the season
// call), the season call's state from the team's regular season (the record it was made at, the record it calls, how it's going, its
// verdict), and the stepper's start at the record's pace. Pure. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { OWN_CALLS_SPEC, seasonCallSpec, ownKindOf, seasonCallState, paceWins, recordWords } = jiti("../src/lib/sports/own-calls.ts");
const { CALL_SPEC } = jiti("../src/lib/sports/fan-call.ts");
const { specProblems } = require("../src/lib/game/game-spec/index.js");
const { sportOf, specContextOf } = jiti("../src/lib/sports/index.ts");

const g = (id, result = null, off = false) => ({ id, at: null, result, ...(off ? { off: true } : {}) });

test("a game is your calls or the season call by its question; a couch's call is neither; both specs pass our check", () => {
  assert.equal(ownKindOf(OWN_CALLS_SPEC), "calls");
  assert.equal(ownKindOf(seasonCallSpec("8")), "season");
  assert.equal(ownKindOf(CALL_SPEC), null);
  const ctx = specContextOf(sportOf("football/nfl"));
  assert.deepEqual(specProblems({ ...OWN_CALLS_SPEC, span: { from: 3, to: 17 } }, ctx), []);
  assert.deepEqual(specProblems({ ...seasonCallSpec("8"), span: { from: 12, to: 17 } }, ctx), []);
});

test("the season call: made at 8-2-1 with six left, five wins called is 13-3-1; four won is 12-4-1, off by one; a game called off counts nothing", () => {
  const season = [...Array.from({ length: 8 }, (_, i) => g(`w${i}`, "W")), g("l1", "L"), g("l2", "L"), g("t1", "T"), g("a"), g("b"), g("c"), g("d"), g("e"), g("f")];
  const call = { wins: 5, games: ["a", "b", "c", "d", "e", "f"] };
  let st = seasonCallState(call, season);
  assert.equal(recordWords(st.at), "8–2–1");
  assert.equal(recordWords(st.called), "13–3–1");
  assert.equal(st.settled, false);
  assert.equal(st.left, 6);
  const done = season.map((x) => (["a", "b", "c", "d"].includes(x.id) ? { ...x, result: "W" } : ["e", "f"].includes(x.id) ? { ...x, result: "L" } : x));
  st = seasonCallState(call, done);
  assert.equal(st.settled, true);
  assert.equal(recordWords(st.finished), "12–4–1");
  assert.equal(st.off, -1);
  const offGame = done.map((x) => (x.id === "f" ? { ...x, result: null, off: true } : x));
  st = seasonCallState(call, offGame);
  assert.equal(st.count, 5, "five games it can count");
  assert.equal(recordWords(st.called), "13–2–1");
});

test("the stepper starts at the record's pace (a tie half), held to the games left", () => {
  assert.equal(paceWins({ w: 8, l: 2, t: 1 }, 6), 5);
  assert.equal(paceWins({ w: 0, l: 0, t: 0 }, 17), 9);
  assert.equal(paceWins({ w: 1, l: 9, t: 0 }, 6), 1);
});
