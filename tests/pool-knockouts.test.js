// A pool's knockouts (docs/PLAN-start-a-game-gpt.md step A11 part 2: the corpus row w047 "survivor pool but you can't pick the
// same person twice, and if your pick goes home you're out, last one standing wins, ties split", and A10 part 2's Noticed items
// 8 and 9 as settings): a pick that never repeats (get.repeat 'never', its fallback for a night you've picked everyone still in:
// a missed pick, or a night that doesn't count), and last one standing's end (rank.oneLeft: one or none left ends the game, or
// it plays on; rank.allOut: the night everyone left goes out, all out by their points, all out sharing the win, or all back in),
// the pool's knockouts being its lives (A10 part 2). Their shape, defaults, words and settings; the engine's walk, everyone
// together (PickEmLogic.walk): who can pick, the game ending early (lastEpisode, gameOver, nothing after it counting or picked),
// a corrected result working it out again, the field (someone catching up, a ghost, a late start), the table's order; a draft
// that cuts playing on with one left. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

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
/** A Survival Pool with `score`, `get` and `rank` said over its own. */
const pool = (score = {}, get = null, rank = null) => ({ ...POOL, score: { by: "survive", ...score }, ...(get ? { get: { by: "pick", ...get } } : {}), ...(rank ? { rank } : {}) });
// The corpus row w047, as the tracker says it.
const W047 = pool({ lives: 1 }, { repeat: "never" }, { by: "standing", oneLeft: "ends", allOut: "share" });
const WORDS = { show: "Survivor 51", castaway: "castaway" };

test("a pick that never repeats, and last one standing's end: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  assert.deepEqual(at(W047), []);
  assert.equal(G.typeOf(W047), "pickem");
  assert.deepEqual(G.specWaitsFor(W047), []);
  // The defaults (the user's to set): a night you've picked everyone still in is a missed pick; a pool with lives plays on to its
  // end with one left, and the night everyone left goes out they're all out by their points. Never filled into the spec, so a
  // stored one reads the same.
  assert.equal(G.fullSpec(pool({}, { repeat: "never" })).get.fallback, "miss");
  assert.equal(G.fullSpec(POOL).get.fallback, undefined, "a pick that cycles has no fallback");
  assert.deepEqual(G.fullSpec(pool({ lives: 2 }, null, { by: "standing" })).rank, { by: "standing" });
  const parts = G.poolParts(G.fullSpec(pool({ lives: 2 }, null, { by: "standing" })));
  assert.deepEqual([parts.never, parts.oneLeft, parts.allOut], [null, "plays", "points"]);
  assert.deepEqual(G.poolParts(G.fullSpec(W047)), { lives: 1, mulligans: 0, buyback: null, second: null, standing: true, never: { fallback: "miss" }, oneLeft: "ends", allOut: "share" });
  const streak = G.poolParts(G.fullSpec(pool({ lives: 2 })));
  assert.deepEqual([streak.oneLeft, streak.allOut], [null, null], "a pool ranked by its streak has no last one standing");
  assert.deepEqual(G.poolParts(G.fullSpec(pool({}, { repeat: "never", fallback: "skip" }))).never, { fallback: "skip" }, "a pool with only a pick that never repeats has its parts");
  // Refused.
  assert.deepEqual(at(pool({}, { repeat: "sometimes" })), ["get.repeat"]);
  assert.deepEqual(at(pool({}, { fallback: "skip" })), ["get.fallback"], "a pick that cycles never runs out");
  assert.deepEqual(at(pool({}, { repeat: "never", fallback: "maybe" })), ["get.fallback"]);
  assert.deepEqual(at(pool({ lives: 1 }, null, { by: "standing", oneLeft: "stop" })), ["rank.oneLeft"]);
  assert.deepEqual(at(pool({ lives: 1 }, null, { by: "standing", allOut: "all" })), ["rank.allOut"]);
  assert.deepEqual(at(pool({ lives: 1 }, null, { by: "streak", oneLeft: "ends" })), ["rank.oneLeft"], "only last one standing has one left");
  assert.deepEqual(at(pool({ lives: 1 }, null, { by: "streak", allOut: "back" })), ["rank.allOut"]);
  assert.deepEqual(at(pool({}, null, { by: "standing", oneLeft: "ends" })), ["rank.by", "rank.oneLeft"], "nobody's out of a pool without lives");
  const outlast = (rank) => ({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank });
  const cut = [{ at: { every: 2 }, out: 1 }];
  assert.deepEqual(at(outlast({ by: "standing", cut, oneLeft: "plays" })), [], "a draft that cuts can play on with one left");
  assert.deepEqual(at(outlast({ by: "standing", cut, allOut: "share" })), ["rank.allOut"], "a cut never takes everyone");
  assert.deepEqual(at(outlast({ by: "total", oneLeft: "ends" })), ["rank.oneLeft"], "a draft that knocks nobody out");
  assert.match(G.specProblems(pool({ lives: 1 }, null, { by: "standing", cut }), CTX).find((p) => p.at === "rank.cut").problem, /lives/);
  assert.match(G.specProblems(pool({ lives: 1 }, null, { by: "standing", race: { to: 5 } }), CTX).find((p) => p.at === "rank.race").problem, /a game of questions/);
  assert.deepEqual(at({ ...W047, get: { ...W047.get, never: true } }), ["get.never"], "a misspelled key is reported");
  // The settings, both ways (none written for a pool without them).
  const fields = G.settingsOf(W047);
  assert.deepEqual([fields.poolRepeat, fields.poolFallback, fields.rankOneLeft, fields.rankAllOut], ["never", "miss", "ends", "share"]);
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...fields }), G.fullSpec(W047)), "reads back as the spec it wrote");
  const skip = pool({ lives: 2 }, { repeat: "never", fallback: "skip" }, { by: "standing", allOut: "back" });
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(skip) }), G.fullSpec(skip)));
  const plays = outlast({ by: "standing", cut, oneLeft: "plays" });
  assert.equal(G.settingsOf(plays).rankOneLeft, "plays");
  assert.ok(G.sameValue(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(plays) }), G.fullSpec(plays)));
  const plain = G.settingsOf(POOL);
  for (const k of ["poolRepeat", "poolFallback", "rankOneLeft", "rankAllOut"]) {
    assert.equal(plain[k], undefined, k);
    assert.ok(G.OWNED.includes(k), k);
  }
  const back = G.withSpec({ ...S.defaultState().settings, ...fields }, POOL);
  for (const k of ["poolRepeat", "poolFallback", "rankOneLeft", "rankAllOut"]) assert.equal(back[k], undefined, k);
  // In words.
  const d = G.describeSpec(W047, WORDS);
  assert.equal(d.name, "Survival Pool");
  assert.equal(d.sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, never the same one twice, all season. One life: a wrong pick costs one. Last one standing wins. Once one of you is left, it's over. If everyone left goes out together, they share the win.");
  assert.ok(d.rules.includes("You can't pick the same castaway twice, all season."));
  assert.ok(d.rules.includes("Once you've picked everyone still in, you've nobody left to pick: that counts as a missed pick."));
  assert.ok(!d.rules.some((r) => /until you've used everyone still in/.test(r)), "not the cycle's rule");
  assert.ok(d.rules.includes("Once one of you is left, or none, it's over: nobody picks after that episode."));
  assert.ok(d.rules.includes("If everyone still in goes out the same episode, you're all out and share the win, whatever your points."));
  const ds = G.describeSpec(skip, WORDS);
  assert.ok(ds.rules.includes("Once you've picked everyone still in, an episode you've nobody left to pick doesn't count for you, either way."));
  assert.ok(ds.rules.includes("If everyone still in goes out the same episode, you're all back in for the next, with the lives you had."));
  assert.ok(!G.describeSpec(pool({ lives: 2 }, null, { by: "standing" }), WORDS).rules.some((r) => /goes out the same/.test(r)), "the default is the standing rule's own: ties go to the most points");
  assert.ok(G.describeSpec(plays, WORDS).rules.some((r) => /With one of you left it plays on to the end/.test(r)));
  // A plain pool's words are as they were.
  assert.equal(G.describeSpec(POOL, WORDS).sentence, "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, all season. Longest streak wins.");
});

// ---- the engine, on a league ----

/** A pool of `n` castaways C0 to C(n-1), players `ids`, its game `spec` through setGame; Episodes 1 to 8 made, none with results. */
function league(spec, ids = ["ann", "bo", "cy"], n = 10) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = ids.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= 8; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Who picks whom in episode n: { ann: first | [first, second] } by castaway index, through the engine's own write. */
function picks(s, n, who) {
  for (const [p, x] of Object.entries(who)) {
    const [first, second] = Array.isArray(x) ? x : [x];
    S.setPickEmPick(s, ep(s, n).id, p, cid(s, first));
    if (second !== undefined) S.setPickEmPick(s, ep(s, n).id, p, cid(s, second), { second: true });
  }
}
/** Episode n's results: who went home (indexes). */
const gone = (s, n, ...out) => out.forEach((i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out"));
const H = (s, p) => S.pickEmHistory(s, p);
const rows = (s) => S.computeScores(s).map((r) => [r.playerId, r.out, r.total]);
const available = (s, n, p) => S.pickEmEligibility(s, ep(s, n).id, p).available.map((id) => s.castaways.findIndex((c) => c.id === id));

test("a pick that never repeats: nobody twice (a second pick once it counted); with nobody left, a missed pick or a night that doesn't count", () => {
  // A second pick that was void never played; one that counted is used.
  const s = league(pool({ lives: 2 }, { repeat: "never", second: {} }, { by: "standing" }), ["ann"]);
  picks(s, 1, { ann: [0, 1] });
  gone(s, 1, 9);
  assert.equal(H(s, "ann").rows[0].second.void, true);
  assert.deepEqual(available(s, 2, "ann"), [1, 2, 3, 4, 5, 6, 7, 8], "C0 used; C1's second was void");
  const e2 = S.pickEmEligibility(s, ep(s, 2).id, "ann");
  assert.deepEqual(e2.blocked[cid(s, 0)], { episode: 1, reason: "used" });
  // Not even after a gap: C0 can't come back in 3 either.
  picks(s, 2, { ann: [2, 3] });
  S.setPickEmPick(s, ep(s, 2).id, "ann", cid(s, 0));
  assert.equal(S.pickEmPickFor(s, ep(s, 2).id, "ann").castawayId, cid(s, 2), "a repeat isn't stored");
  gone(s, 2, 7, 8);
  assert.deepEqual(available(s, 3, "ann"), [1, 4, 5, 6], "a night two went home: the second counted, C3 used");

  // Four castaways, two players: once they've picked everyone still in, nobody's left.
  for (const fallback of ["miss", "skip"]) {
    const t = league(pool({ lives: 2 }, { repeat: "never", fallback }, { by: "standing" }), ["ann", "bo"], 4);
    picks(t, 1, { ann: 0, bo: 0 });
    gone(t, 1, 3);
    picks(t, 2, { ann: 1, bo: 2 });
    gone(t, 2, 2);
    // ann has used C0 and C1, the two still in; bo has C1 left.
    assert.deepEqual(available(t, 3, "ann"), [], `${fallback}: nobody left for ann`);
    assert.deepEqual(available(t, 3, "bo"), [1]);
    assert.deepEqual(Object.values(S.pickEmEligibility(t, ep(t, 3).id, "ann").blocked).map((b) => b.reason), ["used", "used"]);
    gone(t, 3, 0);
    const h = H(t, "ann");
    if (fallback === "miss") {
      assert.deepEqual([h.rows[2].correct, h.rows[2].lifeLost, h.lives, h.currentStreak], [false, true, 1, 0], "a missed pick: a life, the streak broken");
    } else {
      assert.deepEqual([h.rows[2].correct, h.rows[2].skipped, h.rows[2].points, h.lives, h.currentStreak, h.total], [null, true, 0, 2, 2, 2], "skipped: no points, no life lost, the streak holds");
    }
  }
  // Skipped only when there was nobody: a forgotten pick with someone left is a miss, whatever the fallback.
  const u = league(pool({ lives: 2 }, { repeat: "never", fallback: "skip" }, { by: "standing" }), ["ann"], 4);
  picks(u, 1, { ann: 0 });
  gone(u, 1, 3);
  gone(u, 2, 2);
  const h = H(u, "ann");
  assert.deepEqual([h.rows[1].correct, h.rows[1].skipped, h.lives], [false, undefined, 1]);
  // Only their own season's picks are used: a pick stored before the game's start (a game from Episode 3) blocks nobody.
  const m = league(pool({ lives: 2 }, { repeat: "never" }, { by: "standing" }, ), ["ann"]);
  S.setGame(m, { ...S.gameOf(m), span: { from: 3, to: null } }, { ctx: CTX });
  ep(m, 1).picks = [{ playerId: "ann", castawayId: cid(m, 0) }];
  assert.ok(available(m, 3, "ann").includes(0));
});

test("one left ends it (oneLeft 'ends'): over there, nobody picks after it, nothing after it counts; a pool plays on by default", () => {
  const s = league(pool({ lives: 1 }, null, { by: "standing", oneLeft: "ends" }));
  picks(s, 1, { ann: 1, bo: 2, cy: 0 });
  gone(s, 1, 0);
  assert.equal(H(s, "cy").out, 1);
  assert.equal(S.lastEpisode(s), null, "two left");
  picks(s, 2, { ann: 3, bo: 4 });
  // bo's pick for Episode 3, made before Episode 2's results: it never counts.
  picks(s, 3, { bo: 5 });
  gone(s, 2, 3);
  assert.equal(S.PickEmLogic.endsAt(s), 2);
  assert.equal(S.KnockoutLogic.endsAt(s), 2, "the game's early end, as a draft's is read");
  assert.equal(S.lastEpisode(s), 2);
  assert.equal(S.endEpisode(s), null, "the span it was made with stays");
  assert.equal(S.gameOver(s), true);
  assert.equal(S.KnockoutLogic.endedBefore(s, 3), true);
  assert.deepEqual(S.pickEmEligibility(s, ep(s, 3).id, "bo"), { available: [], blocked: {}, ended: 2 });
  S.removePickEmPick(s, ep(s, 3).id, "bo");
  S.setPickEmPick(s, ep(s, 3).id, "bo", cid(s, 6));
  assert.equal(S.pickEmPickFor(s, ep(s, 3).id, "bo"), null, "nobody picks after the end");
  picks(s, 3, {});
  gone(s, 3, 6);
  assert.deepEqual(rows(s), [["bo", null, 2], ["ann", 2, 1], ["cy", 1, 0]]);
  assert.equal(H(s, "bo").rows.length, 2, "nothing after the end");
  // A corrected result works it out again (Episode 3 not in yet): ann's pick didn't go home after all, so two are left and the
  // game's back on.
  S.removeElimination(s, ep(s, 3).id, cid(s, 6));
  S.removeElimination(s, ep(s, 2).id, cid(s, 3));
  gone(s, 2, 5);
  assert.equal(S.lastEpisode(s), null);
  assert.equal(S.gameOver(s), false);
  assert.ok(available(s, 3, "bo").length > 0);
  // By default (the user's to set), a pool with lives plays on with one left.
  const d = league(pool({ lives: 1 }, null, { by: "standing" }));
  picks(d, 1, { ann: 1, bo: 2, cy: 0 });
  gone(d, 1, 0);
  picks(d, 2, { ann: 3, bo: 4 });
  gone(d, 2, 3);
  assert.equal(S.lastEpisode(d), null);
  assert.equal(S.gameOver(d), false);
  picks(d, 3, { bo: 5 });
  gone(d, 3, 6);
  assert.deepEqual(rows(d), [["bo", null, 3], ["ann", 2, 1], ["cy", 1, 0]], "the last one's points still grow");
});

test("the night everyone left goes out: all out by their points, sharing the win, or all back in", () => {
  // ann and bo from Episode 1, eve from 2 (a late start): everyone left goes home in 2.
  const night = (allOut) => {
    const s = league(pool({ lives: 1 }, null, { by: "standing", allOut }), ["ann", "bo", "eve"]);
    s.players.find((p) => p.id === "eve").lateJoin = { startEpisode: 2, catchingUp: false };
    picks(s, 1, { ann: 1, bo: 2 });
    gone(s, 1, 0);
    picks(s, 2, { ann: 3, bo: 4, eve: 5 });
    gone(s, 2, 3, 4, 5);
    return s;
  };
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const table = (s) => tableOf(s, "ann", () => null).map((r) => [r.playerId, r.rank]);
  let s = night("points");
  assert.deepEqual(rows(s), [["ann", 2, 1], ["bo", 2, 1], ["eve", 2, 0]]);
  assert.deepEqual(table(s), [["ann", "T1"], ["bo", "T1"], ["eve", "3"]], "the most points among them win");
  assert.equal(S.gameOver(s), false, "a pool plays on by default, with nobody left to pick");
  s = night("share");
  assert.deepEqual(S.computeScores(s).map((r) => [r.playerId, r.shared]), [["ann", true], ["bo", true], ["eve", true]]);
  assert.deepEqual(table(s).map((r) => r[1]), ["T1", "T1", "T1"], "they share the win, whatever their points");
  s = night("back");
  assert.deepEqual(rows(s), [["ann", null, 1], ["bo", null, 1], ["eve", null, 0]], "all back in");
  const h = H(s, "ann");
  assert.deepEqual([h.lives, h.out, h.currentStreak, h.rows[1].spared, h.rows[1].out, h.rows[1].lifeLost, h.rows[1].lives, h.rows[1].streak], [1, null, 1, true, undefined, undefined, 1, 1], "with the life and the streak they had");
  assert.ok(available(s, 3, "ann").length > 0);
  // The next night it's only some of them: they're out as usual.
  picks(s, 3, { ann: 6, bo: 7, eve: 8 });
  gone(s, 3, 6);
  assert.deepEqual(rows(s), [["bo", null, 2], ["eve", null, 1], ["ann", 3, 1]]);
  // bo and eve both out in 4: back again. eve out in 5, and bo alone going out in 6 is just going out (nobody to tie with).
  picks(s, 4, { bo: 8, eve: 9 });
  gone(s, 4, 8, 9);
  assert.deepEqual(rows(s), [["bo", null, 2], ["eve", null, 1], ["ann", 3, 1]]);
  picks(s, 5, { bo: 1, eve: 2 });
  gone(s, 5, 2);
  picks(s, 6, { bo: 7 });
  gone(s, 6, 7);
  assert.deepEqual(rows(s), [["bo", 6, 3], ["eve", 5, 1], ["ann", 3, 1]]);
  assert.equal(H(s, "bo").rows[5].spared, undefined);
  // Not everyone left when someone wasn't in it: one of them still in, the rest out by their points.
  const p = league(pool({ lives: 1 }, null, { by: "standing", allOut: "back" }));
  picks(p, 1, { ann: 1, bo: 2, cy: 3 });
  gone(p, 1, 1, 2);
  assert.deepEqual(rows(p), [["cy", null, 1], ["ann", 1, 0], ["bo", 1, 0]]);
});

test("the field: someone catching up holds the end off; a ghost is outside it, their season stopping at the game's end", () => {
  // di is catching up (her picks for Episodes 1 on aren't made yet): in the game, so ann's going out leaves two.
  const spec = pool({ lives: 1 }, null, { by: "standing", oneLeft: "ends" });
  const s = league(spec, ["ann", "bo", "di"]);
  s.players.find((p) => p.id === "di").lateJoin = { startEpisode: 1, catchingUp: true };
  picks(s, 1, { ann: 0, bo: 1 });
  gone(s, 1, 0);
  assert.equal(S.lastEpisode(s), null, "someone catching up counts as still in");
  s.players.find((p) => p.id === "di").lateJoin.catchingUp = false;
  assert.equal(S.lastEpisode(s), 1, "caught up without a pick: out, and bo is left");
  // A ghost (a late joiner's private season) is outside it: the game ends without them, and their season stops there too.
  const g = league(spec, ["ann", "bo", "gh"]);
  g.players.find((p) => p.id === "gh").ghost = true;
  picks(g, 1, { ann: 0, bo: 1, gh: 2 });
  gone(g, 1, 0);
  assert.equal(S.lastEpisode(g), 1);
  picks(g, 2, { gh: 3 });
  gone(g, 2, 4);
  assert.equal(H(g, "gh").rows.length, 1, "a ghost's season stops at the game's end");
});

test("a draft that cuts plays on with one left when it says so (oneLeft 'plays'), the last one's points still growing", () => {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 9; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  const spec = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }], oneLeft: "plays" } };
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [["ann", "bo", "cy"][Math.floor(i / 3)]]; });
  for (let k = 1; k <= 4; k++) S.ensureEpisodeNumber(s, k, false);
  const imm = (n, i) => assert.ok(S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i)));
  imm(1, 0); imm(1, 3);
  imm(2, 0);
  assert.deepEqual(Object.fromEntries(S.KnockoutLogic.outs(s)), { cy: 1, bo: 2 });
  assert.equal(S.KnockoutLogic.endsAt(s), null);
  assert.equal(S.gameOver(s), false);
  imm(3, 0);
  assert.deepEqual(S.computeScores(s).map((r) => [r.playerId, r.out, r.total]), [["ann", null, 9], ["bo", 2, 3], ["cy", 1, 0]]);
  // The same game ending with one left (the default).
  const e = JSON.parse(JSON.stringify(s));
  delete e.settings.rankOneLeft;
  delete e.settings.game;
  assert.equal(S.KnockoutLogic.endsAt(e), 2);
});
