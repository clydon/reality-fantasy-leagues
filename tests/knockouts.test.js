// A draft's race and players knocked out (docs/PLAN-start-a-game-gpt.md step A11 part 1: the dials win.race, win.guillotine and
// win.cut, the stretch rows s01 "Guillotine: everyone drafts 4, the lowest scorer each week is out and their castaways go back
// in the pool", s02 "Points every week, but at the merge the bottom half of us is cut" and s36 "First to 20 points wins"):
// rank.race (the first to N points wins, and the game ends after that episode) and rank.cut (every n episodes by the points over
// them, or after an episode or before a phase by the total; the bottom n or half; a tie at the line; a night nobody goes home),
// ranked last one standing. Their shape, defaults, words and settings; the engine's walk (KnockoutLogic): who's out and when,
// their points frozen, the table's order, the game ending at a race's end or with one left, only final results moving it, a
// phase's start known only once a viewer has seen it, a late joiner outside the field, a knocked-out player's castaways back in
// the pool (an exclusive draft) and their moves refused; a plain draft scoring as before. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

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
/** A best-ball draft of three each, exclusive (nobody shares), its rank said. */
const draft = (rank, more = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, rank, ...more });
const EVERY = (out = 1, more = {}) => ({ cut: [{ at: { every: 1 }, out, ...more }] });
// The tracker's rows (tests/fixtures/engine-capabilities.json), as specs.
const S01 = { preset: "weekly-lineup", get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { best: 4 }, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] } };
const S02 = { preset: "weekly-lineup", rank: { by: "standing", cut: [{ at: { phase: "merged" }, out: "half" }] } };
const S36 = { preset: "weekly-lineup", rank: { by: "total", race: { to: 20 } } };

test("a race and cuts: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  for (const s of [S01, S02, S36]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.equal(G.typeOf(s), "active-roster");
    assert.deepEqual(G.specWaitsFor(s), []);
    // Back from the settings they write, whole.
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  // Outlast takes them too.
  const outlast = { preset: "outlast", get: { by: "draft", each: 3 }, rank: { cut: [{ at: { episode: 4 }, out: 2 }], race: { to: 40 } } };
  assert.deepEqual(at(outlast), []);
  assert.equal(G.typeOf(outlast), "classic-draft");
  // The defaults (the user's to set): one goes, a tie at the line keeps them all, a night nobody goes home cuts like any other;
  // a rank that says only its cuts ranks last one standing, one that says only its race keeps the game's.
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", rank: { cut: [{ at: { every: 2 } }] } }).rank, { cut: [{ at: { every: 2 }, out: 1, tie: "keep", quiet: "cut" }], by: "standing" });
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", rank: { race: { to: 20 } } }).rank, { race: { to: 20 }, by: "total" });
  // The flags.
  assert.equal(G.flagsOf(G.fullSpec(S01)).hasCuts, true);
  assert.equal(G.flagsOf(G.fullSpec(S01)).hasRace, false);
  assert.equal(G.flagsOf(G.fullSpec(S36)).hasRace, true);
  assert.equal(G.flagsOf(G.fullSpec({ preset: "weekly-lineup" })).hasCuts, false);
  // Out of range, or beside the wrong game.
  const cut = (c, rank = {}) => ({ preset: "weekly-lineup", rank: { by: "standing", cut: [{ at: { every: 1 }, ...c }], ...rank } });
  for (const out of [0, 21, 1.5, "third"]) assert.deepEqual(at(cut({ out })), ["rank.cut[0].out"], `out ${out}`);
  for (const every of [0, 11]) assert.deepEqual(at(cut({ at: { every } })), ["rank.cut[0].at.every"], `every ${every}`);
  assert.deepEqual(at(cut({ at: { every: 1, episode: 2 } })), ["rank.cut[0].at"]);
  assert.deepEqual(at(cut({ at: {} })), ["rank.cut[0].at"]);
  assert.deepEqual(at(cut({ tie: "coin" })), ["rank.cut[0].tie"]);
  assert.deepEqual(at(cut({ quiet: "wait" })), ["rank.cut[0].quiet"]);
  assert.deepEqual(at(cut({ when: 2 })), ["rank.cut[0].when"], "an unknown key");
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { by: "standing", cut: [] } }), ["rank.by", "rank.cut"]);
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { by: "total", cut: [{ at: { every: 1 } }] } }), ["rank.by"], "cuts rank last one standing");
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { by: "standing" } }), ["rank.by"], "standing is a pool's with lives, or a draft's with cuts");
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { race: { to: 0 } } }), ["rank.race"]);
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { race: { to: 1001 } } }), ["rank.race"]);
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { race: { to: 20, by: 1 } } }), ["rank.race.by"]);
  assert.deepEqual(at({ preset: "survival-pool", rank: { by: "streak", race: { to: 5 } } }), ["rank.race"], "a pool's race is part 2's");
  assert.deepEqual(at({ preset: "survival-pool", score: { by: "survive", lives: 2 }, rank: { by: "standing", cut: [{ at: { every: 1 } }] } }), ["rank.cut"]);
  assert.ok(at({ preset: "weekly-calls", rank: { by: "total", race: { to: 5 } } }).includes("rank.race"), "a game of questions' race is part 2's");
  // A cut at an episode is one the game plays, before its last (a league's own keeps what it plays).
  const atEp = (n, span) => ({ preset: "weekly-lineup", span, rank: { by: "standing", cut: [{ at: { episode: n } }] } });
  assert.deepEqual(at(atEp(3, { from: 4, to: null })), ["rank.cut[0].at.episode"]);
  assert.deepEqual(at(atEp(8, { from: 1, to: 8 })), ["rank.cut[0].at.episode"]);
  assert.deepEqual(at(atEp(8, { from: 1, to: 8 }), CTX, { league: true }), []);
  // A cut before a phase: one of the season's, not its first, and not the phase the game starts at; a night skipped needs results.
  const atPhase = (phase, span) => ({ preset: "weekly-lineup", span, rank: { by: "standing", cut: [{ at: { phase } }] } });
  assert.deepEqual(at(atPhase("jury")), ["rank.cut[0].at.phase"]);
  assert.deepEqual(at(atPhase("premerge")), ["rank.cut[0].at.phase"]);
  assert.deepEqual(at(atPhase("merged", { from: { phase: "merged" }, to: null })), ["rank.cut[0].at.phase"]);
  assert.deepEqual(at(cut({ quiet: "skip" }), { ...CTX, results: false }), ["rank.cut[0].quiet"]);
  // A stock market ranked by worth has no race or cuts.
  const market = { preset: "weekly-lineup", get: { by: "draft", each: 5, order: "blind", own: "shared", budget: { trade: {} } }, rank: { by: "worth", race: { to: 20 } } };
  assert.ok(at(market).includes("rank.race"));
  // The words.
  const d = (spec) => G.describeSpec(spec, { show: "Survivor 51", phases: [{ id: "premerge", name: "Tribes" }, { id: "merged", name: "Merged" }] });
  assert.match(d(S01).sentence, /Each episode the lowest scorer is out\. Last one standing wins\./);
  assert.match(d(S02).sentence, /Before Merged starts the bottom half is cut\./);
  assert.match(d(S36).sentence, /First to 20 points wins: the game ends there\./);
  assert.match(d(S01).rules.join(" "), /go back in the pool/);
  assert.doesNotMatch(d(S02).rules.join(" "), /go back in the pool/, "a shared draft's castaways were never anyone's alone");
  assert.match(d(cut({ at: { every: 2 }, out: 2, tie: "all", quiet: "skip" })).rules.join(" "), /Every two episodes the two lowest scorers over them are out\. A tie on those points goes to whoever has fewer in all\. Tied at the line, you all go/);
  assert.equal(d(S01).sentence.startsWith("A game"), true);
  assert.equal(d({ preset: "weekly-lineup", rank: { cut: [{ at: { every: 1 } }] } }).sentence.startsWith("A Weekly Lineup"), true, "still its draft's game");
});

// ---- the engine, on a league ----

/** A league of twelve castaways C0 to C11, the players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8, di
 *  C9-C11), its game `spec` through setGame; Episodes 1 to 8 made, none with results. */
function league(spec, players = ["ann", "bo", "cy", "di"]) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 8; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const PLAYERS = ["ann", "bo", "cy", "di"];
/** Episode n's points by player: 3 (immunity), 2 (an idol), 5 (both) or 0, on each one's first castaway. */
function points(s, n, by) {
  for (const [p, pts] of Object.entries(by)) {
    const i = PLAYERS.indexOf(p) * 3;
    if (pts === 3 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i)));
    if (pts === 2 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "idolFound", cid(s, i)));
  }
}
const K = S.KnockoutLogic;
const outs = (s) => Object.fromEntries([...K.outs(s)].sort());
const order = (s) => S.computeScores(s).map((r) => r.playerId);
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));

test("a plain draft scores as it always did: no race, no cuts, no `out` on its rows", () => {
  const s = league(draft({ by: "total" }));
  points(s, 1, { ann: 5, bo: 3, cy: 2 });
  assert.equal(K.on(s), false);
  assert.deepEqual(K.outs(s), new Map());
  assert.equal(K.endsAt(s), null);
  assert.equal(S.endEpisode(s), null);
  assert.ok(S.computeScores(s).every((r) => !("out" in r)));
  assert.deepEqual(totals(s), { ann: 5, bo: 3, cy: 2, di: 0 });
});

test("the guillotine: the lowest each episode is out, ties to the total, frozen there; one left ends it", () => {
  const s = league(draft(EVERY()));
  points(s, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.deepEqual(outs(s), { di: 1 });
  // Two tied on the episode's points: the lower total goes (ann 7, cy 4).
  points(s, 2, { ann: 2, bo: 3, cy: 2 });
  assert.deepEqual(outs(s), { cy: 2, di: 1 });
  assert.equal(S.gameOver(s), false);
  // Tied again, ann 10 against bo 9: bo goes, and ann is left: it's over at 3.
  points(s, 3, { ann: 3, bo: 3 });
  assert.deepEqual(outs(s), { bo: 3, cy: 2, di: 1 });
  assert.equal(K.endsAt(s), 3);
  assert.equal(S.lastEpisode(s), 3);
  assert.equal(S.endEpisode(s), null, "the span it was made with stays");
  assert.equal(S.gameOver(s), true);
  // Last one standing: ann, then whoever went out last; each one's points frozen at their last episode in.
  assert.deepEqual(order(s), ["ann", "bo", "cy", "di"]);
  assert.deepEqual(totals(s), { ann: 10, bo: 9, cy: 4, di: 0 });
  assert.deepEqual(S.computeScores(s).map((r) => r.out), [null, 3, 2, 1]);
  // Nothing after the end counts (it scores as it stood: spanView), even for whoever's left.
  points(s, 4, { ann: 5, bo: 5 });
  assert.deepEqual(totals(s), { ann: 10, bo: 9, cy: 4, di: 0 });
  // The table follows the engine (game-view.ts tableOf).
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const table = tableOf(s, "bo", () => null);
  assert.deepEqual(table.map((r) => [r.playerId, r.rank, r.total]), [["ann", "1", 10], ["bo", "2", 9], ["cy", "3", 4], ["di", "4", 0]]);
});

test("a tie at the line: kept (nobody tied there goes), or all of them (never everyone); a night nobody goes home skipped", () => {
  // Tied on the episode's points and the total: nobody goes.
  const keep = league(draft(EVERY()));
  points(keep, 1, { ann: 5, bo: 3, cy: 0, di: 0 });
  assert.deepEqual(outs(keep), {});
  // Tied, sending them all.
  const all = league(draft(EVERY(1, { tie: "all" })));
  points(all, 1, { ann: 5, bo: 3, cy: 0, di: 0 });
  assert.deepEqual(outs(all), { cy: 1, di: 1 });
  // Everyone tied: never everyone.
  const level = league(draft(EVERY(1, { tie: "all" })));
  points(level, 1, { ann: 3, bo: 3, cy: 3, di: 3 });
  assert.deepEqual(outs(level), {});
  // Two go, the bottom half: ties inside it go together.
  const half = league(draft(EVERY("half")));
  points(half, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.deepEqual(outs(half), { cy: 1, di: 1 });
  // A night nobody goes home (the results say so) skipped: no cut; the next one cuts on its own points.
  const quiet = league(draft(EVERY(1, { quiet: "skip" })));
  points(quiet, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  S.EpisodeLogic.setNoExit(quiet, ep(quiet, 1).id, true);
  assert.deepEqual(outs(quiet), {});
  points(quiet, 2, { ann: 0, bo: 3, cy: 2, di: 5 });
  assert.deepEqual(outs(quiet), { ann: 2 });
  // The same night cut like any other (the default).
  const cuts = league(draft(EVERY()));
  points(cuts, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  S.EpisodeLogic.setNoExit(cuts, ep(cuts, 1).id, true);
  assert.deepEqual(outs(cuts), { di: 1 });
});

test("every two episodes, on the points over them; after an episode by the total; only final results move it", () => {
  const two = league(draft({ cut: [{ at: { every: 2 } }] }));
  points(two, 1, { ann: 0, bo: 3, cy: 2, di: 5 });
  assert.deepEqual(outs(two), {}, "nothing after the first of two");
  points(two, 2, { ann: 5, bo: 3, cy: 2, di: 2 });
  // Over the two: ann 5, bo 6, cy 4, di 7.
  assert.deepEqual(outs(two), { cy: 2 });
  points(two, 3, { ann: 5, bo: 0, di: 0 });
  points(two, 4, { ann: 0, bo: 3, di: 2 });
  // Over 3 and 4: ann 5, bo 3, di 2: di goes (cy's points don't count, she's out).
  assert.deepEqual(outs(two), { cy: 2, di: 4 });
  // After an episode, by the total.
  const after = league(draft({ cut: [{ at: { episode: 2 }, out: 2 }] }));
  points(after, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.deepEqual(outs(after), {});
  points(after, 2, { ann: 0, bo: 0, cy: 2, di: 5 });
  // Totals: ann 5, bo 3, cy 4, di 5: bo and cy go.
  assert.deepEqual(outs(after), { bo: 2, cy: 2 });
  assert.equal(S.gameOver(after), false, "two left: it plays on");
  // An episode with its early results (who went home, before the scoring) waits.
  const early = league(draft(EVERY()));
  points(early, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  S.EpisodeLogic.setResultsStage(early, ep(early, 1).id, "early");
  assert.deepEqual(outs(early), {});
  S.EpisodeLogic.setResultsStage(early, ep(early, 1).id, "final");
  assert.deepEqual(outs(early), { di: 1 });
  // An episode where nothing scored can stay early for good: once a later one has results, it counts as it stands.
  const stuck = league(draft(EVERY()));
  points(stuck, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  S.EpisodeLogic.setResultsStage(stuck, ep(stuck, 1).id, "early");
  points(stuck, 2, { ann: 5, bo: 3, cy: 2 });
  assert.deepEqual(outs(stuck), { cy: 2, di: 1 });
  // A corrected result works it out again: nothing is stored.
  S.addScoringEvent(early, ep(early, 1).id, "individualImmunity", cid(early, 9));
  S.addScoringEvent(early, ep(early, 1).id, "idolFound", cid(early, 9));
  assert.deepEqual(outs(early), { cy: 1 });
});

test("before a phase: after the episode before it starts, by the total, as soon as data says where it starts", () => {
  const s = league(draft({ cut: [{ at: { phase: "merged" }, out: "half" }] }));
  points(s, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  points(s, 2, { ann: 0, bo: 3, cy: 0, di: 3 });
  assert.equal(S.readsPhases(s), true);
  assert.deepEqual(outs(s), {}, "nothing says where Merged starts yet");
  // Where Merged starts is the desk's (settlePhases). Known ahead, the cut lands at once: totals after 2 are ann 5, bo 6, cy 2,
  // di 3, so cy and di go, before Merged's first episode.
  S.settlePhases(s, { phases: [{ id: "premerge", from: 1 }, { id: "merged", from: 3 }], open: 3 });
  assert.deepEqual(outs(s), { cy: 2, di: 2 });
  // A viewer who's seen only Episode 1 sees no cut.
  assert.deepEqual(outs(S.SpoilerLogic.viewThrough(s, 1)), {});
  // Known only once it's begun (the fallback): the cut lands then, the phase's first episode no longer counting for them.
  const late = league(draft({ cut: [{ at: { phase: "merged" }, out: "half" }] }));
  points(late, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  points(late, 2, { ann: 0, bo: 3, cy: 0, di: 3 });
  points(late, 3, { ann: 3, bo: 0, cy: 5, di: 0 });
  assert.deepEqual(outs(late), {});
  S.settlePhases(late, { phases: [{ id: "premerge", from: 1 }, { id: "merged", from: 3 }], open: 4 });
  assert.deepEqual(outs(late), { cy: 2, di: 2 });
  assert.deepEqual(totals(late), { ann: 8, bo: 6, cy: 2, di: 3 });
  // Their rows add up: the parts frozen with the total.
  const cy = S.computeScores(late).find((r) => r.playerId === "cy");
  assert.equal(cy.locked + cy.bonus + cy.finale, cy.total);
});

test("a race: the first to N wins and the game ends there; two at once, the most points; nobody there, played out", () => {
  const s = league(draft({ race: { to: 8 } }));
  points(s, 1, { ann: 5, bo: 3 });
  assert.equal(K.endsAt(s), null);
  points(s, 2, { ann: 3, bo: 3 });
  // ann 8: it's over at 2, ann first.
  assert.equal(K.endsAt(s), 2);
  assert.equal(S.gameOver(s), true);
  assert.deepEqual(order(s).slice(0, 2), ["ann", "bo"]);
  points(s, 3, { bo: 5 });
  assert.deepEqual(totals(s), { ann: 8, bo: 6, cy: 0, di: 0 }, "nothing after the finish counts");
  // A move for an episode after the finish is refused.
  assert.equal(K.moveProblem(s, "bo", 3), "This game ended with episode 2");
  // Two past it the same episode: the most points first.
  const two = league(draft({ race: { to: 8 } }));
  points(two, 1, { ann: 5, bo: 5 });
  points(two, 2, { ann: 3, bo: 5 });
  assert.equal(K.endsAt(two), 2);
  assert.deepEqual(order(two).slice(0, 2), ["bo", "ann"]);
  // Nobody gets there: the game runs on, ranked by the total.
  const far = league(draft({ race: { to: 100 } }));
  points(far, 1, { ann: 5, bo: 3 });
  assert.equal(S.gameOver(far), false);
  assert.deepEqual(order(far).slice(0, 2), ["ann", "bo"]);
  // A race beside cuts: whichever comes first.
  const both = league(draft({ race: { to: 6 }, cut: [{ at: { every: 1 } }] }));
  points(both, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  points(both, 2, { ann: 2, bo: 0, cy: 2 });
  assert.equal(K.endsAt(both), 2);
  assert.deepEqual(outs(both), { di: 1 });
});

test("the walk reads the table's own points: a lineup's and Outlast's totals through each episode", () => {
  const lineup = league(draft({ race: { to: 1000 } }));
  points(lineup, 1, { ann: 5, bo: 3, cy: 2 });
  points(lineup, 2, { ann: 2, di: 5 });
  const last = K.series(lineup).pop().totals;
  for (const r of S.computeScores(lineup)) assert.equal(last.get(r.playerId), r.total, r.playerId);
  const outlast = league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank: { race: { to: 1000 } } });
  S.addElimination(outlast, ep(outlast, 1).id, cid(outlast, 0), "Voted Out");
  S.addElimination(outlast, ep(outlast, 2).id, cid(outlast, 4), "Voted Out");
  S.addElimination(outlast, ep(outlast, 3).id, cid(outlast, 11), "Voted Out");
  const series = K.series(outlast);
  assert.deepEqual(series.map((x) => x.number), [1, 2, 3]);
  for (const r of S.computeScores(outlast)) assert.equal(series[2].totals.get(r.playerId), r.total, r.playerId);
  // After Episode 1: ann's out-first C0 earns 1, her two still in 2 each; everyone else's three 2 each.
  assert.deepEqual(Object.fromEntries(series[0].totals), { ann: 5, bo: 6, cy: 6, di: 6 });
  // Outlast with a cut: the lowest after each episode.
  const cut = league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank: { cut: [{ at: { every: 1 } }] } });
  S.addElimination(cut, ep(cut, 1).id, cid(cut, 0), "Voted Out");
  assert.deepEqual(outs(cut), { ann: 1 });
});

test("someone out: no more moves, out of the waivers, and in an exclusive draft their castaways back in the pool", () => {
  const s = league(draft(EVERY()));
  points(s, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.equal(K.isOut(s, "di"), true);
  assert.equal(K.moveProblem(s, "di", 2), "You’re out of this game");
  assert.equal(K.moveProblem(s, "ann", 2), null);
  assert.deepEqual(S.WaiverLogic.rotation(s).sort(), ["ann", "bo", "cy"]);
  // Their castaways are free agents for everyone else; they keep them for their history, and a claim keeps them too.
  const free = S.RosterLogic.freeAgents(s).map((c) => c.name).sort();
  assert.deepEqual(free, ["C10", "C11", "C9"]);
  S.Core.setOwner(s, cid(s, 9), "ann");
  assert.deepEqual(s.castaways[9].ownerIds.sort(), ["ann", "di"]);
  assert.deepEqual(S.RosterLogic.freeAgents(s).map((c) => c.name).sort(), ["C10", "C11"]);
  // A shared draft's were never anyone's alone: nothing is freed.
  const shared = league(draft(EVERY(), { get: { by: "draft", each: 3, order: "blind", own: "shared" } }));
  points(shared, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.equal(K.isOut(shared, "di"), true);
  assert.equal(K.frees(shared), false);
  // A lineup refused for someone out (validateLineup), and for an episode after the game's end.
  const lineup = league(draft(EVERY(), { count: { start: 2 } }));
  S.ActiveRosterLogic.setLineup(lineup, ep(lineup, 1).id, "ann", [cid(lineup, 0), cid(lineup, 1)]);
  S.ActiveRosterLogic.setLineup(lineup, ep(lineup, 1).id, "bo", [cid(lineup, 3), cid(lineup, 4)]);
  S.ActiveRosterLogic.setLineup(lineup, ep(lineup, 1).id, "cy", [cid(lineup, 6), cid(lineup, 7)]);
  points(lineup, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.equal(S.ActiveRosterLogic.validateLineup(lineup, ep(lineup, 2).id, "di", [cid(lineup, 9)]), "You’re out of this game");
  assert.equal(S.ActiveRosterLogic.validateLineup(lineup, ep(lineup, 2).id, "ann", [cid(lineup, 0)]), null);
});

test("the field: a late joiner's private season isn't in it, nor someone still catching up; each from their own start", () => {
  const s = league(draft(EVERY()), ["ann", "bo", "cy", "di", "gh"]);
  s.players.find((p) => p.id === "gh").ghost = true;
  points(s, 1, { ann: 5, bo: 3, cy: 2, di: 2 });
  // gh scored nothing but isn't in the field: cy and di tie at the bottom (and on the total), so nobody goes.
  assert.deepEqual(outs(s), {});
  // Someone who joined at Episode 3 isn't in the field before it.
  const late = league(draft(EVERY()), ["ann", "bo", "cy", "di", "eve"]);
  late.players.find((p) => p.id === "eve").lateJoin = { startEpisode: 3, catchingUp: false };
  points(late, 1, { ann: 5, bo: 3, cy: 2, di: 0 });
  assert.deepEqual(outs(late), { di: 1 });
});

test("each team as it stood: a pickup after a cut doesn't reach back; nobody new joins once someone's out", () => {
  const outlast = { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank: { cut: [{ at: { every: 1 } }] } };
  const s = league(outlast);
  // Episode 1: ann's C0 goes first (1 point, her others 2 each: 5, everyone else 6): she's out.
  S.addElimination(s, ep(s, 1).id, cid(s, 0), "Voted Out");
  assert.deepEqual(outs(s), { ann: 1 });
  assert.equal(S.GhostLogic.allowed(s), false, "nobody new joins a field already cut");
  // bo picks up ann's C1 after Episode 1 (it counts from 2): his Episode 1 stays 6, and a claim keeps ann's history.
  s.midSeason.log.push({ playerId: "bo", addedCastawayId: cid(s, 1), droppedCastawayId: null, episode: 1 });
  S.Core.addOwner(s, cid(s, 1), "bo");
  const after1 = K.series(s)[0].totals;
  assert.equal(after1.get("bo"), 6);
  assert.equal(after1.get("ann"), 5);
  // Episode 2: cy's C6 goes (placement 2): cy 2 + 3 + 3 = 8, over the episode 2 to bo's 6 (four still in) and di's 3: cy goes.
  S.addElimination(s, ep(s, 2).id, cid(s, 6), "Voted Out");
  assert.equal(K.series(s)[1].totals.get("bo"), 12);
  assert.deepEqual(outs(s), { ann: 1, cy: 2 });
  // Before anyone's out, joining is as the game says.
  const open = league(outlast);
  assert.equal(S.GhostLogic.allowed(open), true);
});

test("someone catching up is in the game but can't be cut until they've caught up; the game isn't over while they're in", () => {
  const s = league(draft(EVERY()), ["ann", "bo", "cy", "di"]);
  s.players.find((p) => p.id === "di").lateJoin = { startEpisode: 1, catchingUp: true };
  points(s, 1, { ann: 5, bo: 3, cy: 2 });
  // di scored nothing but is catching up: cy goes.
  assert.deepEqual(outs(s), { cy: 1 });
  points(s, 2, { ann: 5, bo: 3 });
  assert.deepEqual(outs(s), { bo: 2, cy: 1 });
  // ann and di are left: not over while di is in.
  assert.equal(K.endsAt(s), null);
  assert.equal(S.gameOver(s), false);
});
