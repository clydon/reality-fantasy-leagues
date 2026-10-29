// A pool's pieces (docs/PLAN-start-a-game-gpt.md step A10 part 2: the stretch rows s10 "A pool with 2 lives and one buyback
// before the merge", s11 "On double-boot nights you pick two", s23 "One mulligan a season"): lives (a wrong pick, or none,
// costs one; out at none, no more picks), a buyback (back in from the next episode with one life, its cost off the total,
// until an episode or a phase where data says it starts), mulligans (the first wrong picks forgiven), a second pick (open
// every episode, counting on a night two or more go home, known only from the results; void or counted on a night only one
// goes), and last one standing as a rank. Their shape, defaults, words and settings; the engine's walk (PickEmLogic.history),
// who can pick (eligibility: someone out, a second pick in the cycle and back to back), the second pick's writes, the table's
// order, a phase start confirmed later taking a buyback back, computer players; a plain pool scoring as before. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const POOL = { preset: "survival-pool" };
/** A Survival Pool with `score` and `get` said over its own. */
const pool = (score = {}, get = null, rest = {}) => ({ ...POOL, score: { by: "survive", ...score }, ...(get ? { get: { by: "pick", ...get } } : {}), ...rest });
const STANDING = { rank: { by: "standing" } };

test("a pool's pieces: their shape, defaults, words and settings; what they wait for", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  // s10, s11, s23 as the tracker says them: valid, played today as a Survival Pool, nothing to wait for.
  const s10 = pool({ lives: 2, buyback: { times: 1, before: { phase: "merged" } } }, null, STANDING);
  const s11 = pool({}, { second: { fallback: "void" } });
  const s23 = pool({ mulligans: 1 });
  for (const s of [s10, s11, s23]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.equal(G.typeOf(s), "pickem");
    assert.deepEqual(G.specWaitsFor(s), []);
  }
  // The defaults (the user's to set): a buyback once, any time, for one right pick's points; a second pick void on a night only
  // one goes. Lives keep the streak's rank unless the spec says last one standing.
  assert.deepEqual(G.fullSpec(pool({ lives: 2, buyback: {} })).score.buyback, { times: 1, before: null, cost: 1 });
  assert.equal(G.fullSpec(pool({ points: 3, lives: 2, buyback: {} })).score.buyback.cost, 3);
  assert.deepEqual(G.fullSpec(pool({}, { second: {} })).get.second, { fallback: "void" });
  assert.equal(G.fullSpec(pool({ lives: 2 })).rank.by, "streak");
  // Out of range, or beside the wrong game.
  for (const lives of [0, 6, 1.5, "2"]) assert.deepEqual(at(pool({ lives })), ["score.lives"], `lives ${lives}`);
  for (const mulligans of [0, 4]) assert.deepEqual(at(pool({ mulligans })), ["score.mulligans"], `mulligans ${mulligans}`);
  assert.deepEqual(at(pool({ buyback: {} })), ["score.buyback"], "a buyback needs lives: nobody's out without them");
  assert.deepEqual(at(pool({ lives: 1, buyback: { times: 0 } })), ["score.buyback.times"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { times: 4 } })), ["score.buyback.times"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { cost: -1 } })), ["score.buyback.cost"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { cost: 21 } })), ["score.buyback.cost"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { phase: "" } } })), ["score.buyback.before.phase"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { episode: 1 } } })), ["score.buyback.before.episode"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { episode: 3, phase: "merged" } } })), ["score.buyback.before"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { until: 3 } })), ["score.buyback.until"], "a misspelled key is reported");
  // A new game's buyback before its own first episode could never be used; a league's own keeps what it plays.
  const late = pool({ lives: 1, buyback: { before: { episode: 3 } } }, null, { span: { from: 3, to: null } });
  assert.deepEqual(at(late), ["score.buyback.before.episode"]);
  assert.deepEqual(at(late, CTX, { league: true }), []);
  // Its phase is one of the season's, never its first (nobody is out before Episode 1).
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { phase: "jury" } } })), ["score.buyback.before.phase"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { phase: "premerge" } } })), ["score.buyback.before.phase"]);
  assert.deepEqual(at(pool({ lives: 1, buyback: { before: { phase: "jury" } } }), null), [], "the phase is the data rule's: unchecked without ctx");
  // A second pick: void or counts; a pool whose picks stay in; results that say who goes home.
  assert.deepEqual(at(pool({}, { second: { fallback: "maybe" } })), ["get.second.fallback"]);
  assert.deepEqual(at(pool({ means: "scores" }, { second: {} })), ["get.second"], "nobody goes home in a pool that scores");
  assert.deepEqual(at(pool({}, { second: {} }), { ...CTX, results: false }), ["get.second"]);
  assert.deepEqual(at({ ...G.PRESETS["weekly-lineup"], get: { ...G.PRESETS["weekly-lineup"].get, second: {} } }), ["get.second"], "only a pick has one");
  // Last one standing is a pool with lives.
  assert.deepEqual(at(pool({}, null, STANDING)), ["rank.by"]);
  assert.deepEqual(at({ ...G.PRESETS["weekly-lineup"], ...STANDING }), ["rank.by"]);
  assert.deepEqual(at(pool({ lives: 3 }, null, STANDING)), []);
  // The settings, both ways (none written for a pool without them).
  const full = pool({ lives: 2, mulligans: 1, buyback: { before: { phase: "merged" }, cost: 2 } }, { second: {} }, STANDING);
  const fields = G.settingsOf(full);
  assert.equal(fields.poolLives, 2);
  assert.equal(fields.poolMulligans, 1);
  assert.deepEqual(fields.poolBuyback, { times: 1, before: { phase: "merged" }, cost: 2 });
  assert.deepEqual(fields.poolSecond, { fallback: "void" });
  assert.equal(fields.poolRank, "standing");
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...fields }), G.fullSpec(full)), "reads back as the spec it wrote");
  const plain = G.settingsOf(POOL);
  for (const k of ["poolLives", "poolBuyback", "poolMulligans", "poolSecond", "poolRank"]) {
    assert.equal(plain[k], undefined, k);
    assert.ok(G.OWNED.includes(k), k);
  }
  assert.deepEqual(G.specOf({ ...S.defaultState().settings, ...plain }), G.fullSpec(POOL));
  // Taking them off a league writes them away.
  const back = G.withSpec({ ...S.defaultState().settings, ...fields }, POOL);
  for (const k of ["poolLives", "poolBuyback", "poolMulligans", "poolSecond", "poolRank"]) assert.equal(back[k], undefined, k);
  // In words: the sentence, and How it works for each.
  const words = { show: "Survivor 51", castaway: "castaway", phases: [{ id: "premerge", name: "Pre-merge" }, { id: "merged", name: "Merged" }] };
  const d = G.describeSpec(full, words);
  assert.equal(d.name, "Survival Pool");
  assert.match(d.sentence, /, and a second that counts when two go home,/);
  assert.match(d.sentence, /Two lives: a wrong pick costs one\. One buyback before Merged starts\. One wrong pick forgiven\. Last one standing wins\.$/);
  assert.ok(d.rules.includes("You have two lives: a wrong pick, or no pick, costs one. At none you're out, with no more picks."));
  assert.ok(d.rules.includes("Out before Merged starts? You're back in from the next episode with one life, for 2 points off your total, once."));
  assert.ok(d.rules.includes("Your first wrong pick (or missed one) is forgiven: your streak carries on and you keep your lives."));
  assert.ok(d.rules.some((r) => /second castaway beside the first\. It counts on an episode two or more go home; on one where only one goes, it doesn't count/.test(r)));
  assert.ok(d.rules.includes("Last one standing wins: whoever's still in, then whoever went out last. Ties go to the most points."));
  assert.match(G.describeSpec(pool({}, { second: { fallback: "counts" } }), words).sentence, /, and a second, all season/);
  assert.match(G.describeSpec(pool({ lives: 1, buyback: { times: 2, cost: 0 } }), words).rules.find((r) => r.startsWith("Out")), /^Out\? You're back in from the next episode with one life, at no cost, up to two times\.$/);
  // A plain pool's words are as they were.
  assert.equal(G.describeSpec(POOL, words).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. Longest streak wins.");
});

// ---- the engine, on a league ----

/** A pool of ten castaways C0 to C9 (C9 goes on to win), players ann and bo (and cy when `three`), its game `spec` through
 *  setGame; Episodes 1 to 8 made, none with results. */
function league(spec, { three = false } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `C${i}`);
  s.players = (three ? ["ann", "bo", "cy"] : ["ann", "bo"]).map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let n = 1; n <= 8; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Who picks whom in episode n: { ann: [first, second?] } by castaway index (null: no pick), through the engine's own write. */
function picks(s, n, who) {
  for (const [p, [first, second]] of Object.entries(who)) {
    if (first === null) continue;
    S.setPickEmPick(s, ep(s, n).id, p, cid(s, first));
    if (second !== undefined) S.setPickEmPick(s, ep(s, n).id, p, cid(s, second), { second: true });
  }
}
/** Episode n's results: who went home (indexes). */
const gone = (s, n, ...out) => out.forEach((i) => S.addElimination(s, ep(s, n).id, cid(s, i), i === 9 ? "Sole Survivor" : "Voted Out"));
const H = (s, p) => S.pickEmHistory(s, p);
const order = (s) => S.computeScores(s).map((r) => r.playerId);

test("a plain pool scores as it always did: no parts, the same rows and table", () => {
  const s = league(POOL);
  assert.equal(S.PickEmLogic.parts(s), null);
  picks(s, 1, { ann: [0], bo: [1] });
  gone(s, 1, 0);
  picks(s, 2, { ann: [null], bo: [2] });
  gone(s, 2, 1);
  const h = H(s, "ann");
  assert.deepEqual(Object.keys(h).sort(), ["currentStreak", "longestStreak", "rows", "total"]);
  for (const r of h.rows) assert.deepEqual(Object.keys(r).sort(), ["castawayId", "correct", "episode", "points", "postMerge", "streak"]);
  assert.deepEqual(h.rows.map((r) => r.correct), [false, false]);
  const rows = S.computeScores(s);
  assert.ok(rows.every((r) => !("lives" in r) && !("out" in r)));
  assert.deepEqual(rows.map((r) => [r.playerId, r.longestStreak]), [["bo", 2], ["ann", 0]]);
  // A second pick needs a pool that has one.
  S.setPickEmPick(s, ep(s, 3).id, "bo", cid(s, 3));
  S.setPickEmPick(s, ep(s, 3).id, "bo", cid(s, 4), { second: true });
  assert.equal(S.pickEmPickFor(s, ep(s, 3).id, "bo").second, undefined);
});

test("lives: a wrong pick, or none, costs one; at none you're out, with no more picks; last one standing", () => {
  const s = league(pool({ lives: 2 }, null, STANDING));
  assert.deepEqual(S.PickEmLogic.parts(s), { lives: 2, mulligans: 0, buyback: null, second: null, standing: true });
  picks(s, 1, { ann: [0], bo: [1] });
  gone(s, 1, 0);
  assert.equal(H(s, "ann").lives, 1);
  assert.equal(H(s, "ann").rows[0].lifeLost, true);
  picks(s, 2, { ann: [null], bo: [2] });
  // A pick made before the results that knock ann out (for Episode 3): it never counts.
  picks(s, 3, { ann: [5] });
  gone(s, 2, 1);
  let h = H(s, "ann");
  assert.equal(h.out, 2, "a missed pick costs a life too");
  assert.equal(h.lives, 0);
  assert.equal(h.rows.length, 2, "nothing after the episode she went out in");
  assert.equal(h.rows[1].out, true);
  const e3 = S.pickEmEligibility(s, ep(s, 3).id, "ann");
  assert.deepEqual(e3.available, []);
  assert.equal(e3.out, 2);
  S.removePickEmPick(s, ep(s, 3).id, "ann");
  S.setPickEmPick(s, ep(s, 3).id, "ann", cid(s, 6));
  assert.equal(S.pickEmPickFor(s, ep(s, 3).id, "ann"), null, "someone out can't pick");
  picks(s, 3, { bo: [2] });
  gone(s, 3, 2);
  h = H(s, "bo");
  assert.deepEqual([h.total, h.lives, h.out, h.longestStreak, h.currentStreak], [2, 1, null, 2, 0]);
  // Last one standing: bo, still in, before ann, out.
  assert.deepEqual(order(s), ["bo", "ann"]);
  const row = S.computeScores(s).find((r) => r.playerId === "ann");
  assert.deepEqual([row.lives, row.out, row.mulligans, row.buybacks], [0, 2, 0, 0]);
  // Both out: whoever went out last first, whatever the points.
  picks(s, 4, { bo: [3] });
  gone(s, 4, 3);
  assert.equal(H(s, "bo").out, 4);
  assert.deepEqual(order(s), ["bo", "ann"]);
  // The same game ranked by streak: ann's longest is 0, bo's 2.
  const st = league(pool({ lives: 2 }));
  picks(st, 1, { ann: [1], bo: [0] });
  gone(st, 1, 0);
  picks(st, 2, { ann: [2], bo: [null] });
  gone(st, 2, 1);
  assert.equal(H(st, "bo").out, 2);
  assert.deepEqual(order(st), ["ann", "bo"]);
});

test("last one standing among those still in: their points, then lives left; the table follows the engine", () => {
  const s = league(pool({ lives: 3 }, null, STANDING), { three: true });
  // ann right twice; bo right once, wrong once; cy right once, wrong once, and picks C... each.
  picks(s, 1, { ann: [1], bo: [2], cy: [0] });
  gone(s, 1, 0);
  picks(s, 2, { ann: [2], bo: [1], cy: [3] });
  gone(s, 2, 1);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => [H(s, p).total, H(s, p).lives]), [[2, 3], [1, 2], [1, 2]]);
  assert.deepEqual(order(s).slice(0, 1), ["ann"]);
  // The Games tab's table ranks it the same way, with bo and cy tied.
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const t = tableOf(s, "ann", (p) => `user-${p}`);
  assert.deepEqual(t.map((r) => r.playerId), order(s));
  assert.deepEqual(t.map((r) => r.rank), ["1", "T2", "T2"]);
});

test("mulligans: the first wrong pick (or missed one) is forgiven: no life lost, the streak carries on", () => {
  const s = league(pool({ lives: 1, mulligans: 1 }));
  picks(s, 1, { ann: [1], bo: [null] });
  gone(s, 1, 0);
  picks(s, 2, { ann: [1], bo: [3] });
  gone(s, 2, 1);
  let h = H(s, "ann");
  assert.equal(h.rows[1].forgiven, true);
  assert.deepEqual([h.lives, h.mulligans, h.currentStreak], [1, 0, 1], "forgiven: still one life, the streak of 1 carries");
  assert.equal(H(s, "bo").rows[0].forgiven, true, "a missed pick is forgiven too");
  picks(s, 3, { ann: [3] });
  gone(s, 3, 2);
  h = H(s, "ann");
  assert.deepEqual([h.currentStreak, h.longestStreak], [2, 2]);
  picks(s, 4, { ann: [4] });
  gone(s, 4, 4);
  assert.equal(H(s, "ann").out, 4, "the next wrong one costs her last life");
  // Without lives (a streak pool), a mulligan keeps the streak going.
  const t = league(pool({ mulligans: 2 }));
  picks(t, 1, { ann: [1] });
  gone(t, 1, 0);
  picks(t, 2, { ann: [1] });
  gone(t, 2, 1);
  picks(t, 3, { ann: [2] });
  gone(t, 3, 2);
  picks(t, 4, { ann: [3] });
  gone(t, 4, 4);
  h = H(t, "ann");
  assert.deepEqual([h.longestStreak, h.currentStreak, h.mulligans, h.lives, h.out], [2, 2, 0, null, null]);
});

test("a buyback: back in from the next episode with one life, its cost off the total, while it lasts", () => {
  const s = league(pool({ lives: 1, buyback: { before: { episode: 4 }, cost: 2 } }));
  picks(s, 1, { ann: [1], bo: [1] });
  gone(s, 1, 0);
  picks(s, 2, { ann: [1], bo: [2] });
  gone(s, 2, 1);
  let h = H(s, "ann");
  assert.deepEqual([h.out, h.lives, h.buybacks, h.cost, h.total], [null, 1, 0, 2, -1], "out in 2, before 4: bought back for 2 points");
  assert.equal(h.rows[1].boughtBack, 2);
  assert.notEqual(S.pickEmEligibility(s, ep(s, 3).id, "ann").available.length, 0, "she picks again in 3");
  picks(s, 3, { ann: [3], bo: [3] });
  gone(s, 3, 2);
  picks(s, 4, { ann: [4], bo: [4] });
  gone(s, 4, 4);
  h = H(s, "ann");
  assert.deepEqual([h.out, h.total], [4, 0], "her one buyback used: out in 4");
  h = H(s, "bo");
  assert.deepEqual([h.out, h.buybacks, h.total], [4, 1, 3], "out in 4, not before it: no buyback, though he had one");
});

test("a night that empties someone's lives buys back once, however many of its picks were wrong; the cost's default is capped", () => {
  // One life, one buyback: both picks wrong on a double night. Back in from the next episode with one life, the cost paid once.
  const s = league(pool({ lives: 1, buyback: { times: 2, cost: 1 } }, { second: {} }));
  picks(s, 1, { ann: [0, 1] });
  gone(s, 1, 0, 1);
  let h = H(s, "ann");
  assert.deepEqual([h.out, h.lives, h.buybacks, h.cost, h.rows[0].boughtBack, h.rows[0].lifeLost, h.rows[0].second.lifeLost], [null, 1, 1, 1, 1, true, undefined]);
  // Out for good on a night with no buyback left: once, too.
  const t = league(pool({ lives: 1 }, { second: {} }));
  picks(t, 1, { ann: [0, 1] });
  gone(t, 1, 0, 1);
  h = H(t, "ann");
  assert.deepEqual([h.out, h.lives, h.rows.length, h.rows[0].out], [1, 0, 1, true]);
  // A buyback's cost left out is one right pick's points, never more than a buyback can cost.
  assert.equal(G.fullSpec(pool({ points: 25, lives: 1, buyback: {} })).score.buyback.cost, G.MAX_BUYBACK_COST);
  assert.deepEqual(G.specProblems(pool({ points: 25, lives: 1, buyback: {} })), []);
  // Settings written by hand without a cost still play: the engine reads the pool the one way (poolParts), its defaults filled.
  const u = league(pool({ lives: 1 }));
  u.settings.poolBuyback = { times: 1 };
  delete u.settings.game;
  assert.deepEqual(S.PickEmLogic.parts(u).buyback, { times: 1, before: null, cost: 1 });
  picks(u, 1, { ann: [0] });
  gone(u, 1, 0);
  assert.deepEqual([H(u, "ann").total, H(u, "ann").lives], [-1, 1], "no NaN: the cost is a number");
});

test("a buyback until a phase: it stands while data hasn't said the phase started, and a start confirmed later takes it back", () => {
  const s = league(pool({ lives: 1, buyback: { before: { phase: "merged" } } }));
  assert.equal(S.readsPhases(s), true, "the season's phase starts are recorded for it");
  assert.equal(S.readsPhases(league(pool({ lives: 1, buyback: {} }))), false);
  picks(s, 1, { ann: [1] });
  gone(s, 1, 0);
  picks(s, 2, { ann: [2] });
  gone(s, 2, 2);
  assert.deepEqual([H(s, "ann").out, H(s, "ann").lives], [null, 1], "the merge's start isn't known: bought back");
  // The desk confirms the merge started at 3: the knockout in 2 was before it, so the buyback stands.
  S.settlePhases(s, { phases: [{ id: "premerge", from: 1 }, { id: "merged", from: 3 }], open: 3 });
  assert.deepEqual(s.phaseStarts, { premerge: 1, merged: 3 });
  assert.equal(H(s, "ann").out, null);
  // A correction: the merge started at 2. Out in 2, on or after it: no buyback, so she's out from 2.
  S.settlePhases(s, { phases: [{ id: "premerge", from: 1 }, { id: "merged", from: 2 }], open: 3 });
  assert.equal(H(s, "ann").out, 2);
});

test("a second pick: void on a night only one goes, counted on a night two go, in the cycle only when it counted", () => {
  const s = league(pool({ lives: 2 }, { second: {} }), { three: true });
  // Episode 1, one goes (C0): ann's second (C5) and bo's (C0, who went) are void: no points either way.
  picks(s, 1, { ann: [1, 5], bo: [4, 0], cy: [6] });
  gone(s, 1, 0);
  let row = H(s, "bo").rows[0];
  assert.deepEqual(row.second, { castawayId: cid(s, 0), correct: null, points: 0, void: true });
  assert.equal(H(s, "bo").lives, 2);
  // A void second never played: ann can pick C5 straight away; her first (C1) can't be picked back to back.
  const e2 = S.pickEmEligibility(s, ep(s, 2).id, "ann");
  assert.ok(e2.available.includes(cid(s, 5)));
  assert.equal(e2.blocked[cid(s, 1)].reason, "backToBack");
  // Episode 2, two go (C1, C2): ann's first right and second wrong (a life, and the streak ends: the night's right picks count
  // first); bo's both right (two points, the streak up two); cy made no second pick: nothing, never a miss.
  picks(s, 2, { ann: [5, 2], bo: [3, 6], cy: [7] });
  gone(s, 2, 1, 2);
  assert.equal(S.PickEmLogic.double(s, ep(s, 2)), true);
  let h = H(s, "ann");
  row = h.rows[1];
  assert.deepEqual([row.correct, row.points, row.second.correct, row.second.lifeLost, row.streak, h.lives, h.total], [true, 1, false, true, 0, 1, 2]);
  h = H(s, "bo");
  assert.deepEqual([h.rows[1].points + h.rows[1].second.points, h.currentStreak, h.total, h.lives], [2, 3, 3, 2]);
  h = H(s, "cy");
  assert.deepEqual([h.rows[1].second, h.currentStreak, h.lives], [undefined, 2, 2]);
  // A counted second is in the cycle and back to back: bo's C3 and C6 can't be picked in 3, and nor can C4 (his first in 1).
  const e3 = S.pickEmEligibility(s, ep(s, 3).id, "bo");
  assert.equal(e3.blocked[cid(s, 3)].reason, "backToBack");
  assert.equal(e3.blocked[cid(s, 6)].reason, "backToBack");
  assert.equal(e3.blocked[cid(s, 4)].reason, "cycle");
  // A winner's exit isn't one going home: a finale with one voted out and the winner crowned is a single night.
  gone(s, 8, 8, 9);
  assert.equal(S.PickEmLogic.double(s, ep(s, 8)), false);
  // fallback counts: two picks every night, the second scored like the first.
  const t = league(pool({}, { second: { fallback: "counts" } }));
  picks(t, 1, { ann: [1, 0] });
  gone(t, 1, 0);
  h = H(t, "ann");
  assert.deepEqual([h.rows[0].second.correct, h.total, h.currentStreak], [false, 1, 0]);
  assert.equal(S.pickEmEligibility(t, ep(t, 2).id, "ann").blocked[cid(t, 1)].reason, "backToBack");
});

test("a second pick's writes: beside a first, never the same person; the first changed to it drops it; cleared on its own", () => {
  const s = league(pool({}, { second: {} }));
  const e = ep(s, 1).id;
  S.setPickEmPick(s, e, "ann", cid(s, 1), { second: true });
  assert.equal(S.pickEmPickFor(s, e, "ann"), null, "no second without a first");
  S.setPickEmPick(s, e, "ann", cid(s, 1));
  S.setPickEmPick(s, e, "ann", cid(s, 1), { second: true });
  assert.equal(S.pickEmPickFor(s, e, "ann").second, undefined, "never the first's person");
  S.setPickEmPick(s, e, "ann", cid(s, 2), { second: true });
  assert.equal(S.pickEmPickFor(s, e, "ann").second, cid(s, 2));
  S.setPickEmPick(s, e, "ann", cid(s, 2));
  assert.deepEqual(S.pickEmPickFor(s, e, "ann"), { playerId: "ann", castawayId: cid(s, 2) }, "the first moved onto the second's person drops it");
  S.setPickEmPick(s, e, "ann", cid(s, 3), { second: true });
  S.removePickEmPick(s, e, "ann", { second: true });
  assert.deepEqual(S.pickEmPickFor(s, e, "ann"), { playerId: "ann", castawayId: cid(s, 2) }, "cleared on its own");
  S.setPickEmPick(s, e, "ann", cid(s, 3), { second: true });
  S.removePickEmPick(s, e, "ann");
  assert.equal(S.pickEmPickFor(s, e, "ann"), null, "the whole pick goes, second and all");
  // A pending row shows both.
  S.setPickEmPick(s, e, "bo", cid(s, 4));
  S.setPickEmPick(s, e, "bo", cid(s, 5), { second: true });
  assert.deepEqual(H(s, "bo").rows[0].second, { castawayId: cid(s, 5), correct: null, points: 0 });
  // Once its results are in, neither can be cleared: a wrong second cleared would take back what it cost.
  gone(s, 1, 5, 6);
  S.removePickEmPick(s, e, "bo", { second: true });
  S.removePickEmPick(s, e, "bo");
  assert.deepEqual(S.pickEmPickFor(s, e, "bo"), { playerId: "bo", castawayId: cid(s, 4), second: cid(s, 5) });
  assert.equal(H(s, "bo").rows[0].second.correct, false);
  // In a pool without a second pick, clearing stays as it was (a cleared pick is a miss).
  const t = league(POOL);
  S.setPickEmPick(t, ep(t, 1).id, "bo", cid(t, 4));
  gone(t, 1, 4);
  S.removePickEmPick(t, ep(t, 1).id, "bo");
  assert.equal(S.pickEmPickFor(t, ep(t, 1).id, "bo"), null);
});

test("computer players make a second pick too, and none once they're out", () => {
  const s = league(pool({ lives: 1 }, { second: {} }));
  s.players[1].automated = true;
  Bots.run(s);
  const mine = S.pickEmPickFor(s, ep(s, 1).id, "bo");
  assert.ok(mine && mine.castawayId && mine.second && mine.second !== mine.castawayId, JSON.stringify(mine));
  // Knocked out (their first goes home), they have nobody to pick next.
  S.addElimination(s, ep(s, 1).id, mine.castawayId, "Voted Out");
  assert.equal(H(s, "bo").out, 1);
  Bots.run(s);
  assert.equal(S.pickEmPickFor(s, ep(s, 2).id, "bo"), null);
});
