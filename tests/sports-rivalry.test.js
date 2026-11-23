// A rivalry's game (src/lib/sports/rivalry.ts; docs/PLAN-sports-couch.md C1): its spec passes our check (the winner shown as it's
// picked, only a side may be), the sport's starting margin, the final's winner and margin, each pick's result, the duel between the
// two fans (a point for the winner, a point for the closest margin among everyone who called one), and the sides split.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { RIVALRY_SPEC, isRivalrySpec, typicalMargin, finalOf, duelOf, sidesOf } = jiti("../src/lib/sports/rivalry.ts");
const Spec = require("../src/lib/game/game-spec/index.js");

const G = "giants";
const E = "eagles";
const pick = (userId, side, margin) => ({ userId, name: userId, side, margin: margin ?? null, called: margin != null });

test("the rivalry's spec is a valid game of questions with public sides", () => {
  const spec = { ...structuredClone(RIVALRY_SPEC), span: { from: 1, to: 1 } };
  const problems = Spec.specProblems(spec, { sport: { league: "football/nfl" } }).filter((p) => /shown/.test(p.path ?? "") || /shown/i.test(p.problem));
  assert.deepEqual(problems, []);
  assert.equal(isRivalrySpec(spec), true);
  assert.equal(isRivalrySpec({ ask: [{ id: "winner", answer: "side" }] }), false);
});

test("only a side is shown as it's picked", () => {
  const bad = structuredClone(RIVALRY_SPEC);
  bad.ask[1].shown = "picked";
  bad.span = { from: 1, to: 1 };
  assert.ok(Spec.specProblems(bad, { sport: { league: "football/nfl" } }).some((p) => /Only who wins/.test(p.problem)));
  const odd = structuredClone(RIVALRY_SPEC);
  odd.ask[0].shown = "always";
  odd.span = { from: 1, to: 1 };
  assert.ok(Spec.specProblems(odd, { sport: { league: "football/nfl" } }).some((p) => /shown: 'picked'/.test(p.problem)));
});

test("a sport's usual margin", () => {
  assert.equal(typicalMargin("football/nfl"), 3);
  assert.equal(typicalMargin("basketball/nba"), 5);
  assert.equal(typicalMargin("baseball/mlb"), 1);
  assert.equal(typicalMargin("hockey/nhl"), 1);
});

test("the final's winner and margin, away first", () => {
  assert.deepEqual(finalOf([19, 11], G, E), { winner: G, margin: 8 });
  assert.deepEqual(finalOf([10, 24], G, E), { winner: E, margin: 14 });
  assert.deepEqual(finalOf([21, 21], G, E), { winner: null, margin: 0 });
  assert.equal(finalOf(null, G, E), null);
});

test("the duel: winner and the closer margin", () => {
  const f = finalOf([19, 11], G, E);
  // Andrew: Giants by 6 (right, 2 off); Riley: Eagles by 3 (wrong, 5 off). Andrew 2, Riley 0.
  const d = duelOf(["andrew", "riley"], [pick("andrew", G, 6), pick("riley", E, 3), pick("sam", G)], f);
  assert.equal(d.who, "andrew");
  assert.deepEqual(d.points, { andrew: 2, riley: 0 });
  assert.deepEqual(d.results.andrew, { userId: "andrew", right: true, off: 2 });
  assert.deepEqual(d.results.sam, { userId: "sam", right: true, off: null });
});

test("a split duel is a tie; a closer spectator takes the margin point from both", () => {
  const f = finalOf([19, 11], G, E);
  // Andrew right but 10 off, Riley wrong but 0 off (Eagles by 8: closest margin): 1 each.
  assert.equal(duelOf(["andrew", "riley"], [pick("andrew", G, 18), pick("riley", E, 8)], f).who, null);
  // Sam's 8 is as close as Riley's: ties all score, so Riley keeps it.
  assert.deepEqual(duelOf(["andrew", "riley"], [pick("andrew", G, 18), pick("riley", E, 8), pick("sam", G, 8)], f).points, { andrew: 1, riley: 1 });
  // Sam alone closest: neither fan gets the margin point; Andrew had the winner.
  assert.equal(duelOf(["andrew", "riley"], [pick("andrew", G, 18), pick("riley", E, 1), pick("sam", G, 8)], f).who, "andrew");
});

test("no calls from either fan: no duel", () => {
  const f = finalOf([19, 11], G, E);
  assert.equal(duelOf(["andrew", "riley"], [pick("sam", G)], f).who, null);
});

test("the sides, each fan first on their own", () => {
  const [away, home] = sidesOf([pick("sam", G), pick("riley", E, 3), pick("andrew", G, 6), pick("jo", E)], G, E, ["andrew", "riley"]);
  assert.deepEqual(away.map((p) => p.userId), ["andrew", "sam"]);
  assert.deepEqual(home.map((p) => p.userId), ["riley", "jo"]);
});
