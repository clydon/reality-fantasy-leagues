// Multipliers on any condition (docs/PLAN-start-a-game-gpt.md step C3; the tracker's p23 "In our Outlast, anyone you pick up
// mid-season counts double while they're yours", and the multiplier half of p11, the user's second game: "the new player who
// replaces your lost one scores 0.5x, if you need to replace another it scores 0.25x"). One multiplier piece keyed by a condition
// (the sequence's factorOf, game-spec multipliersOf): a captain, when, how a holding joined, a parlay's legs, a confidence
// ranking's place. The new condition, how a holding joined (score.multiply): its shape, defaults, refusals, words and settings; the
// sequence's stints (drafted, a replacement, a swap; the Nth per team and per slot) and its factor (a number, a list, past the list
// the last again or on by its last step); an Outlast's lines as what each holding earns while it's yours (the user's decision,
// 2026-11-05: never their whole place times it), its series and its table; a lineup's moment lines times it while held. Every
// number here is worked out by hand in its comment. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Seq = require("../src/lib/game/sequence/index.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const WAIVERS = { ...G.fullSpec({ preset: "outlast" }).extras.waivers, replace: "always" };
/** An exclusive Outlast of three each, replacing anyone gone after any episode, its multiplier said. */
const outlast = (multiply, more = {}) => ({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, score: { by: "place", multiply }, extras: { waivers: WAIVERS }, ...more });
/** Exclusive best ball of three each (no lineups to set), its multiplier said. */
const bestBall = (multiply) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null, multiply }, extras: { waivers: WAIVERS } });
// The tracker's rows, as specs.
const P23 = { preset: "outlast", score: { by: "place", multiply: [{ joined: "pickup", times: 2 }] }, extras: { waivers: WAIVERS } };
const GAME2 = outlast([{ joined: "replacement", times: [0.5, 0.25] }]);

test("how a holding joined: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  for (const s of [P23, GAME2, bestBall([{ joined: "replacement", times: [0.5], then: "ratio", per: "slot" }])]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    // Back from the settings they write, whole (settings.joinedTimes).
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(G.withSpec(S.defaultState().settings, GAME2).joinedTimes, [{ joined: "replacement", times: [0.5, 0.25] }]);
  assert.equal(G.typeOf(P23), "classic-draft");
  // One piece: every multiplier a spec has, keyed by its condition, the fields where each was said.
  assert.deepEqual(G.multipliersOf(GAME2), [{ on: "joined", joined: "replacement", times: [0.5, 0.25], per: "team", then: "repeat" }]);
  const lineup = { preset: "weekly-lineup", score: { by: "moments", points: null, captain: { times: 2 }, times: [{ times: 3, finale: true }], multiply: [{ joined: "draft", times: 1.5 }] } };
  assert.deepEqual(G.multipliersOf(lineup), [
    { on: "captain", times: 2 },
    { on: "when", times: 3, finale: true },
    { on: "joined", joined: "draft", times: 1.5 },
  ]);
  assert.deepEqual(G.multipliersOf({ preset: "weekly-calls", score: { by: "answers", parlays: [{ of: ["a", "b"], times: 3 }] } }), [{ on: "legs", of: ["a", "b"], times: 3 }]);
  assert.deepEqual(G.multipliersOf({ preset: "outlast" }), []);
  // Words.
  const d = (s) => G.describeSpec(s);
  assert.ok(d(P23).sentence.endsWith("Pickups score double."), d(P23).sentence);
  assert.ok(d(GAME2).sentence.endsWith("Your first replacement scores half, your second a quarter, and every one after that a quarter."), d(GAME2).sentence);
  assert.ok(d(GAME2).rules.includes("Each counts the boots they outlast while they're yours (one you drafted, their whole place), and keeps for you what they earned before you let them go."));
  const ratio = d(bestBall([{ joined: "replacement", times: [0.5], then: "ratio", per: "slot" }]));
  assert.ok(ratio.rules.includes("On each spot on your team, the first replacement scores half, and each one after that half the one before."));
  assert.ok(ratio.rules.includes("Each counts what they score while they're yours."));
  assert.ok(d(outlast([{ joined: "draft", times: 2 }, { joined: "swap", times: 0.5 }], { extras: { waivers: { ...WAIVERS, windows: { schedule: "every", every: 3, swaps: 1 } } } })).sentence.endsWith("Who you draft scores double. Swaps score half."));
  // Refused, each with why.
  const m = (list, more) => at(outlast(list, more));
  assert.deepEqual(m([]), ["score.multiply"]);
  assert.deepEqual(m([{ joined: "keeper", times: 2 }]), ["score.multiply[0].joined"]);
  assert.deepEqual(m([{ joined: "pickup", times: 1 }]), ["score.multiply[0].times"], "1 multiplies nothing");
  assert.deepEqual(m([{ joined: "pickup", times: 11 }]), ["score.multiply[0].times"]);
  assert.deepEqual(m([{ joined: "pickup", times: [1, 1] }]), ["score.multiply[0].times"], "every one 1");
  assert.deepEqual(m([{ joined: "pickup", times: [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01] }]), ["score.multiply[0].times"], "seven in a list");
  assert.deepEqual(m([{ joined: "draft", times: [1, 0.5] }]), ["score.multiply[0].times"], "everyone drafted joined the same way");
  assert.deepEqual(m([{ joined: "pickup", times: 2 }, { joined: "replacement", times: 0.5 }]), ["score.multiply[1].joined"], "a pickup is a replacement or a swap");
  assert.deepEqual(m([{ joined: "replacement", times: 2 }, { joined: "replacement", times: 0.5 }]), ["score.multiply[1].joined"]);
  assert.deepEqual(m([{ joined: "replacement", times: 2, per: "slot" }]), ["score.multiply[0].per"], "only a list counts the Nth");
  assert.deepEqual(m([{ joined: "replacement", times: [0.5], then: "twice" }]), ["score.multiply[0].then"]);
  assert.deepEqual(m([{ joined: "replacement", times: [0.5, 1], then: "ratio" }]), ["score.multiply[0].then"], "a list that grows can't go on by its step");
  assert.deepEqual(m([{ joined: "replacement", times: [2], then: "ratio" }]), ["score.multiply[0].then"]);
  assert.deepEqual(m([{ joined: "replacement", times: 2, by: 1 }]), ["score.multiply[0].by"], "an unknown key");
  assert.deepEqual(m([{ joined: "draft", times: 2 }, { joined: "replacement", times: 0.5 }, { joined: "swap", times: 0.5 }, { joined: "pickup", times: 2 }]), ["score.multiply"], "at most three");
  // What the waivers can make: none, no replacements, no swaps.
  const none = { extras: { waivers: G.fullSpec({ preset: "outlast" }).extras.waivers } };
  assert.deepEqual(m([{ joined: "replacement", times: 0.5 }], none), ["score.multiply[0].joined"]);
  assert.deepEqual(m([{ joined: "pickup", times: 0.5 }], none), ["score.multiply[0].joined"]);
  assert.deepEqual(m([{ joined: "draft", times: 2 }], none), ["score.multiply[0].joined"], "nobody joins after the draft");
  assert.deepEqual(m([{ joined: "swap", times: 0.5 }]), ["score.multiply[0].joined"], "these waivers make no swaps");
  // In reverse, beside a stock market, or anywhere but a draft.
  assert.ok(at({ ...P23, score: { by: "place", reverse: true, multiply: [{ joined: "pickup", times: 2 }] } }).includes("score.multiply"));
  const market = { preset: "weekly-lineup", get: { by: "draft", each: 5, order: "blind", own: "shared", budget: { trade: {} } }, score: { by: "moments", points: null, multiply: [{ joined: "pickup", times: 2 }] }, rank: { by: "worth" } };
  assert.ok(at(market).includes("score.multiply"));
  assert.ok(at({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1, multiply: [{ joined: "pickup", times: 2 }] } }).includes("score.multiply"), "a pool's score has no multiply");
});

test("the sequence: stints say how each holding joined; a factor reads its condition", () => {
  // Drafted a, b; a replaced by c after Episode 1, c replaced by d after 3, b swapped for e after 4, a pickup from before the game (f, no
  // episode) for nobody.
  const log = [
    { playerId: "p", type: "replenish", addedCastawayId: "f", droppedCastawayId: null, episode: null },
    { playerId: "q", type: "replenish", addedCastawayId: "x", droppedCastawayId: "y", episode: 1 },
    { playerId: "p", type: "replenish", addedCastawayId: "c", droppedCastawayId: "a", episode: 1 },
    { playerId: "p", type: "replenish", addedCastawayId: "d", droppedCastawayId: "c", episode: 3 },
    { playerId: "p", type: "trade", addedCastawayId: "e", droppedCastawayId: "b", episode: 4 },
  ];
  const st = Seq.stints(["f", "d", "e"], log, "p");
  const by = (id) => st.find((s) => s.id === id);
  // The team before any move first (drafted), then each move's add in the log's order.
  assert.deepEqual(st.map((s) => s.id), ["b", "a", "f", "c", "d", "e"]);
  assert.deepEqual([by("a").kind, by("a").from, by("a").to, by("a").ended], ["draft", null, 1, true]);
  assert.deepEqual([by("f").kind, by("f").from, by("f").nth.replacement], ["replacement", null, 1]);
  // Per team: c is the second replacement (f the first), d the third; e the first swap and the fourth pickup. Per slot: c is a's first,
  // d its second; e b's first swap.
  assert.deepEqual([by("c").nth, by("c").line], [{ replacement: 2, swap: 0, pickup: 2 }, { replacement: 1, swap: 0, pickup: 1 }]);
  assert.deepEqual([by("d").nth, by("d").line], [{ replacement: 3, swap: 0, pickup: 3 }, { replacement: 2, swap: 0, pickup: 2 }]);
  assert.deepEqual([by("e").nth, by("e").line], [{ replacement: 0, swap: 1, pickup: 4 }, { replacement: 0, swap: 1, pickup: 1 }]);
  // Held as heldAt has it: c from Episode 2 to 3; a through 1; f all along.
  assert.deepEqual([1, 2, 3, 4, Infinity].map((n) => Seq.heldIn(by("c"), n)), [false, true, true, false, false]);
  assert.deepEqual([1, 2, Infinity].map((n) => Seq.heldIn(by("a"), n)), [true, false, false]);
  for (const n of [1, 2, 3, 4, 5]) assert.deepEqual(new Set(st.filter((s) => Seq.heldIn(s, n)).map((s) => s.id)), Seq.heldAt(["f", "d", "e"], log, "p", n), `episode ${n}`);
  // A factor on how it joined: a number, the Nth from a list, past it the last again or on by its last step.
  const j = (f) => (id) => Seq.factorOf({ on: "joined", ...f }, { stint: by(id) });
  assert.deepEqual(["a", "f", "c", "d", "e"].map(j({ joined: "replacement", times: 0.5 })), [1, 0.5, 0.5, 0.5, 1]);
  assert.deepEqual(["a", "f", "c", "d", "e"].map(j({ joined: "pickup", times: 2 })), [1, 2, 2, 2, 2]);
  assert.deepEqual(["a", "e"].map(j({ joined: "draft", times: 3 })), [3, 1]);
  assert.deepEqual(["f", "c", "d"].map(j({ joined: "replacement", times: [0.5, 0.25] })), [0.5, 0.25, 0.25], "repeat: the third is the last again");
  assert.deepEqual(["f", "c", "d"].map(j({ joined: "replacement", times: [0.5, 0.25], then: "ratio" })), [0.5, 0.25, 0.125], "ratio: on by halves");
  assert.deepEqual(["f", "c", "d"].map(j({ joined: "replacement", times: [0.5, 0.25], per: "slot" })), [0.5, 0.5, 0.25], "per slot: c is a's first, d its second");
  assert.deepEqual(["e"].map(j({ joined: "swap", times: [0.5] })), [0.5]);
  // The other conditions.
  assert.equal(Seq.factorOf({ on: "captain", times: 2 }, { captain: true }), 2);
  assert.equal(Seq.factorOf({ on: "captain", times: 2 }, { captain: false }), 1);
  assert.equal(Seq.factorOf({ on: "when", times: 3, from: 2, to: 4 }, { episode: 4 }), 3);
  assert.equal(Seq.factorOf({ on: "when", times: 3, from: 2, to: 4 }, { episode: 5 }), 1);
  assert.equal(Seq.factorOf({ on: "when", times: 2, phase: "merged" }, { episode: 9, phase: (id) => id === "merged" }), 2);
  assert.equal(Seq.factorOf({ on: "when", times: 2, finale: true }, { episode: 13, finale: () => 13 }), 2);
  assert.equal(Seq.factorOf({ on: "when", times: 2, finale: true }, { episode: 13, finale: () => null }), 1);
  assert.equal(Seq.factorOf({ on: "legs", times: 3 }, { legs: true }), 3);
  assert.equal(Seq.factorOf({ on: "rank", times: 1 }, { rank: 4 }), 4);
  // A move that brought nobody in counts toward no Nth.
  const lone = Seq.stints(["y"], [{ playerId: "p", type: "replenish", addedCastawayId: null, droppedCastawayId: "x", episode: 1 }, { playerId: "p", type: "replenish", addedCastawayId: "y", droppedCastawayId: null, episode: 2 }], "p");
  assert.deepEqual(lone.find((s) => s.id === "y").nth, { replacement: 1, swap: 0, pickup: 1 });
  assert.deepEqual([lone.find((s) => s.id === "x").to, lone.find((s) => s.id === "x").ended], [1, true]);
  // What a place earns while held: whole when drafted and kept; from its value when it joined; until it was let go.
  const v = (m) => [0, 1, 2, 3, 4, 5][Math.min(m, 5)] + 1;
  assert.equal(Seq.earnedWhileHeld(by("e"), Infinity, v), 6 - 5, "from Episode 4's 5 to now's 6");
  assert.equal(Seq.earnedWhileHeld(by("c"), Infinity, v), 4 - 2, "from Episode 1's 2 to Episode 3's 4");
  assert.equal(Seq.earnedWhileHeld(by("c"), 1, v), 0, "not joined yet");
  assert.equal(Seq.earnedWhileHeld(by("a"), Infinity, v), 2, "drafted, its value when let go");
  assert.equal(Seq.earnedWhileHeld(by("f"), Infinity, v), 6, "from before the game: whole");
});

// ---- the engine, on a league ----

/** A league of twelve castaways C0 to C11, three players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8), C9 to C11
 *  free; its game `spec` through setGame; Episodes 1 to 8 made, none with results. */
function league(spec) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  const players = ["ann", "bo", "cy"];
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 8; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const out = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
/** ann replaces `lost` with `add` after the latest results (the move's episode, as waivers log it). */
const replace = (s, add, lost) => S.MidSeasonLogic.applyPickup(s, "ann", cid(s, add), cid(s, lost));
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));
const series = (s) => S.ScoringLogic.walk(s, { series: true }).series.map((e) => Object.fromEntries(e.totals));

/** The season both Outlasts play: C0 out first (Episode 1), ann replaces it with C9; C3 out (2); C9 out (3), ann replaces it with C10;
 *  C6 out (4). Four out, C10 and everyone else still in at 5. */
function season(s) {
  out(s, 1, 0);
  replace(s, 9, 0);
  out(s, 2, 3);
  out(s, 3, 9);
  replace(s, 10, 9);
  out(s, 4, 6);
  return s;
}

test("an Outlast without a multiplier scores as it always did: a pickup's whole place, someone let go for nobody", () => {
  const s = season(league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, extras: { waivers: WAIVERS } }));
  // ann holds C1, C2 and C10 now, all still in after four boots: 5 each. bo C3 (2nd out) 2, C4 and C5 5: 12. cy C6 (4th out), 5, 5: 14.
  assert.deepEqual(totals(s), { ann: 15, bo: 12, cy: 14 });
});

test("the user's second game: a replacement scores half of what it earns while yours, the second a quarter", () => {
  const s = season(league(GAME2));
  // ann: C0, drafted, out first, kept for her: 1. C9 joined after Episode 1 (worth 2 then), out third (3): 1 earned, half: 0.5. C10
  // joined after Episode 3 (worth 4 then), still in at 5: 1, a quarter: 0.25. C1 and C2 drafted, still in: 5 each. 11.75.
  // bo and cy made no move: as without the multiplier.
  assert.deepEqual(totals(s), { ann: 11.75, bo: 12, cy: 14 });
  // The series, each episode once its results are in: after 1, ann's C0 1, C1 and C2 2 each (5; C9 not hers yet); after 2, C0 1, C9
  // from 2 to 3 (half: 0.5), C1 and C2 3 each (7.5); after 3, C0 1, C9 out third (1, half: 0.5), C1, C2 4 each (9.5); after 4,
  // C10 from 4 to 5 (a quarter: 0.25): 11.75.
  assert.deepEqual(series(s).map((e) => e.ann), [5, 7.5, 9.5, 11.75]);
  // bo: C3, C4, C5 2 each after 1 (6); C3 out second, 2, the others 3 each (8); then 4 each (10); then 5 each (12).
  assert.deepEqual(series(s).map((e) => e.bo), [6, 8, 10, 12], "as without the multiplier");
  // The row: rounded to the cent, its roster as held now.
  const ann = S.computeScores(s).find((r) => r.playerId === "ann");
  assert.deepEqual([ann.locked, ann.total], [11.75, 11.75]);
  assert.deepEqual(ann.roster.map((c) => c.name).sort(), ["C1", "C10", "C2"]);
  // A third replacement (C11 for C10 after Episode 5, C10 out fifth): every one after the list a quarter again. C10 earned 1 (4 to 5),
  // a quarter: 0.25; C11 joins worth 6 then, still in at 6: nothing yet. 1 + 0.5 + 0.25 + 6 + 6 = 13.75.
  out(s, 5, 10);
  replace(s, 11, 10);
  assert.equal(totals(s).ann, 13.75);
  out(s, 6, 4);
  // C11 from 6 to 7: 1, a quarter: 0.25; C1, C2 7 each: 1 + 0.5 + 0.25 + 0.25 + 14 = 16.
  assert.equal(totals(s).ann, 16);
});

test("p23: an Outlast's pickups count double while they're yours, never their whole place", () => {
  const s = season(league(P23));
  // ann: C0 1; C9 (2 to 3) 1, double: 2; C10 (4 to 5) 1, double: 2; C1, C2 5 each: 15 (its whole place doubled would be 25).
  assert.deepEqual(totals(s), { ann: 15, bo: 12, cy: 14 });
  // Its whole place counts only for who held them from the start: drafted is 1x.
  const swap = season(league(outlast([{ joined: "draft", times: 2 }])));
  // ann: C0 1, double 2; C9 1 and C10 1 in full; C1, C2 5 each doubled: 2 + 1 + 1 + 20 = 24. bo: 2 + 5 + 5 doubled: 24. cy: 28.
  assert.deepEqual(totals(swap), { ann: 24, bo: 24, cy: 28 });
});

test("a lineup's moments times how each one joined, while they're yours", () => {
  const s = league(bestBall([{ joined: "replacement", times: [0.5, 0.25] }]));
  // Episode 1: C9 (free) wins immunity, 3, nobody's; C0 (ann's) goes home, -3 for her. ann replaces C0 with C9 after it.
  assert.ok(S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 9)));
  out(s, 1, 0);
  replace(s, 9, 0);
  // Episode 2: C9 wins immunity (3, half: 1.5) and finds an idol (2, half: 1); C1 finds an idol (2): ann 4.5, -3 + 4.5 = 1.5 in
  // all. bo's C3 an idol, 2; cy's C6 goes home, -3.
  assert.ok(S.addScoringEvent(s, ep(s, 2).id, "individualImmunity", cid(s, 9)));
  assert.ok(S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 9)));
  assert.ok(S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 1)));
  assert.ok(S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 3)));
  out(s, 2, 6);
  assert.deepEqual(totals(s), { ann: 1.5, bo: 2, cy: -3 });
  // The episode's lines say it.
  const lines = S.ActiveRosterLogic.episodeScore(s, ep(s, 2), "ann").lines;
  assert.deepEqual(lines.map((l) => [s.castaways.find((c) => c.id === l.castawayId).name, l.points]), [["C1", 2], ["C2", 0], ["C9", 2.5]]);
  assert.equal(S.ActiveRosterLogic.combines(s), true);
  // Without a multiplier: C9's immunity in full, 3: -3 + 3.
  const plain = league(bestBall(undefined));
  out(plain, 1, 0);
  replace(plain, 9, 0);
  assert.ok(S.addScoringEvent(plain, ep(plain, 2).id, "individualImmunity", cid(plain, 9)));
  out(plain, 2, 6);
  assert.deepEqual(totals(plain), { ann: 0, bo: 0, cy: -3 });
});
