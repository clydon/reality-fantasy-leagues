// Scoring that combines, per lineup (docs/PLAN-start-a-game-gpt.md step A9, part 2): a captain whose points multiply, best ball
// (your best n count each episode, no lineups), Outlast in reverse (out early scores more), and points that multiply by when
// (an episode, a run of them, a phase, the finale: "double in the finale"). Their shape and the data rule; the settings both
// ways (none of them written for a game that has none); the engine on a league (a captain named, carried, benched and locked;
// best ball's team per episode through a waiver move; the boot order reversed, live and final; each window's multiplier, a phase
// known only once it's begun, the finale once it's over); today's lineups scoring as before; computer players' captains; How it
// works. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "satOut", label: "Sat out", defaultPoints: -0.5, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "tribes" }, { id: "merged" }],
};
const P = G.PRESETS;
const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { start: 2 }, score: { by: "moments", points: null } };
const CAPTAIN = { ...LINEUP, score: { ...LINEUP.score, captain: { times: 2 } } };
const BEST = { ...LINEUP, count: { best: 2 } };
const REVERSE = { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, score: { by: "place", reverse: true } };
const timed = (times, base = LINEUP) => ({ ...base, score: { ...base.score, times } });

test("A9 part 2's parts: their shape, and where each goes", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  for (const spec of [CAPTAIN, BEST, REVERSE, timed([{ finale: true, times: 2 }]), timed([{ episode: 3, times: 2 }, { from: 1, to: 2, times: 3 }, { from: 5, times: 0.5 }, { phase: "merged", times: 2 }])]) {
    assert.deepEqual(at(spec), [], JSON.stringify(spec.score));
    assert.deepEqual(G.specWaitsFor(spec), [], "it plays now");
  }
  // A captain: more than 1, up to 10, on a lineup only.
  assert.deepEqual(at({ ...CAPTAIN, score: { ...CAPTAIN.score, captain: { times: 1 } } }), ["score.captain"]);
  assert.deepEqual(at({ ...CAPTAIN, score: { ...CAPTAIN.score, captain: { times: 11 } } }), ["score.captain"]);
  assert.deepEqual(at({ ...CAPTAIN, score: { ...CAPTAIN.score, captain: 2 } }), ["score.captain"]);
  assert.deepEqual(at({ ...CAPTAIN, score: { ...CAPTAIN.score, captain: { times: 2, vice: true } } }), ["score.captain.vice"]);
  assert.deepEqual(at({ ...BEST, score: { ...BEST.score, captain: { times: 2 } } }), ["score.captain"], "best ball has no starters to name");
  assert.deepEqual(at({ ...P.outlast, score: { by: "place", captain: { times: 2 } } }), ["score.captain"], "Outlast scores places, not moments");
  // Best ball: 1 to 8 of the team.
  assert.deepEqual(at({ ...BEST, count: { best: 5 } }), ["count.best"]);
  assert.deepEqual(at({ ...BEST, get: { ...BEST.get, each: 12 }, count: { best: 9 } }), ["count.best"]);
  assert.deepEqual(at({ ...BEST, extras: { hideStarters: true } }), ["extras.hideStarters"], "no starters to hide");
  // Reverse: true, on Outlast.
  assert.deepEqual(at({ ...REVERSE, score: { by: "place", reverse: false } }), ["score.reverse"]);
  assert.deepEqual(at({ ...LINEUP, score: { ...LINEUP.score, reverse: true } }), ["score.reverse"]);
  // When: one window each, times more than 0 and not 1, up to 10; inside a new game's episodes; a finale needs a game that runs
  // to it; a phase of the season's; the finale only on a show whose results place it.
  assert.deepEqual(at(timed([])), ["score.times"]);
  assert.deepEqual(at(timed([{ times: 2 }])), ["score.times[0]"]);
  assert.deepEqual(at(timed([{ episode: 3, from: 3, times: 2 }])), ["score.times[0]"]);
  assert.deepEqual(at(timed([{ episode: 3, times: 1 }])), ["score.times[0].times"]);
  assert.deepEqual(at(timed([{ episode: 3, times: 0 }])), ["score.times[0].times"]);
  assert.deepEqual(at(timed([{ episode: 0, times: 2 }])), ["score.times[0].episode"]);
  assert.deepEqual(at(timed([{ episode: 3, to: 4, times: 2 }])), ["score.times[0].to"]);
  assert.deepEqual(at(timed([{ from: 4, to: 3, times: 2 }])), ["score.times[0].to"]);
  assert.deepEqual(at(timed([{ finale: false, times: 2 }])), ["score.times[0].finale"]);
  assert.deepEqual(at(timed([{ episode: 3, times: 2, when: "late" }])), ["score.times[0].when"]);
  assert.deepEqual(at(timed(Array.from({ length: 9 }, (_, i) => ({ episode: i + 1, times: 2 })))), ["score.times"]);
  assert.deepEqual(at({ ...timed([{ episode: 3, times: 2 }]), span: { from: 5, to: null } }), ["score.times[0]"], "before the game starts");
  assert.deepEqual(at({ ...timed([{ from: 8, times: 2 }]), span: { from: 1, to: 6 } }), ["score.times[0]"], "after it ends");
  assert.deepEqual(at({ ...timed([{ finale: true, times: 2 }]), span: { from: 1, to: 6 } }), ["score.times[0].finale"]);
  assert.deepEqual(ats(G.specProblems({ ...timed([{ finale: true, times: 2 }]), span: { from: 1, to: 6 } }, CTX, { league: true })), [], "a league's own keeps what it plays");
  assert.deepEqual(at(timed([{ phase: "jury", times: 2 }])), ["score.times[0].phase"]);
  assert.deepEqual(at(timed([{ finale: true, times: 2 }]), { ...CTX, results: false }), ["score.times[0].finale"]);
  assert.deepEqual(at({ ...P.outlast, score: { by: "place", times: [{ finale: true, times: 2 }] } }), ["score.times"], "Outlast's places don't multiply");
  // What each plays as: best ball is Weekly Lineup's game with no lineups; reverse is Outlast's.
  assert.equal(G.typeOf(BEST), "active-roster");
  assert.equal(G.typeOf(REVERSE), "classic-draft");
  assert.equal(G.typeOf(CAPTAIN), "active-roster");
  const flags = G.flagsOf(G.fullSpec(BEST));
  assert.equal(flags.hasBestBall, true);
  assert.equal(flags.hasActiveRoster, false);
  assert.equal(G.flagsOf(G.fullSpec(LINEUP)).hasBestBall, false);
});

test("the settings both ways: each part in its own field, none of them written for a game without it", () => {
  const base = S.defaultState().settings;
  for (const spec of [CAPTAIN, BEST, REVERSE, timed([{ finale: true, times: 2 }, { phase: "merged", times: 3 }]), { ...BEST, get: { ...BEST.get, own: "shared", order: "blind" } }]) {
    const back = G.specOf(G.withSpec(base, spec));
    assert.deepEqual(back, G.fullSpec(spec), JSON.stringify(spec.score));
  }
  const fields = (spec) => G.withSpec(base, spec);
  assert.equal(fields(BEST).bestBall, true);
  assert.equal(fields(BEST).activeSlots, 2);
  assert.equal(fields(BEST).benchSlots, 2);
  assert.equal(fields(CAPTAIN).captainTimes, 2);
  assert.deepEqual(fields(timed([{ finale: true, times: 2 }])).pointsTimes, [{ finale: true, times: 2 }]);
  assert.equal(fields(REVERSE).reverseOrder, true);
  // Today's games carry none of them, and a spec read back from their settings says none (no stored spec drifts).
  for (const p of Object.values(P)) {
    const st = fields(p);
    for (const k of ["bestBall", "captainTimes", "pointsTimes", "reverseOrder"]) assert.equal(k in st, false, `${p.preset}: ${k}`);
    assert.deepEqual(G.specOf(st), p);
  }
  // Back from best ball to a lineup, from reverse to Outlast: the field goes.
  const lineupAgain = G.withSpec(fields(BEST), LINEUP);
  assert.equal("bestBall" in lineupAgain, false);
  assert.deepEqual(G.specOf(lineupAgain).count, { start: 2 });
  assert.equal("reverseOrder" in G.withSpec(fields(REVERSE), { ...REVERSE, score: { by: "place" } }), false);
  assert.equal("captainTimes" in G.withSpec(fields(CAPTAIN), LINEUP), false);
  // A starters' switch left on a lineup made best ball isn't read as hidden starters.
  const hidden = { ...fields(BEST), hideStartersUntilLock: true };
  assert.equal(G.specOf(hidden).extras.hideStarters, false);
});

/** A Survivor Weekly Lineup (4 each, 2 starters) of eight castaways, ann holding C0-C3 and bo C4-C7, its game `spec` written
 *  through setGame with the show's ctx; Episodes 1 to 4 made, none with results. */
function league(spec) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 8; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [i < 4 ? "ann" : "bo"]; });
  for (let n = 1; n <= 4; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const score = (s, who) => S.computeScores(s).find((r) => r.playerId === who).total;
/** Episode n's results: each [castaway index, moment] scored, and who went home (an index), if anyone. */
function results(s, n, events, gone) {
  for (const [i, type] of events) assert.ok(S.addScoringEvent(s, ep(s, n).id, type, cid(s, i)), type);
  if (gone !== undefined) S.addElimination(s, ep(s, n).id, cid(s, gone), "Voted Out");
}

test("a captain: named each episode among the starters, carried while they start, double their points, locked with the lineup", () => {
  const s = league(CAPTAIN);
  const A = S.ActiveRosterLogic;
  const e1 = ep(s, 1).id;
  assert.equal(A.captainTimes(s), 2);
  assert.equal(A.combines(s), true);
  assert.ok(A.setLineup(s, e1, "ann", [cid(s, 0), cid(s, 1)]));
  assert.equal(A.validateCaptain(s, e1, "ann", cid(s, 2)), "Your captain is one of your starters");
  assert.equal(A.validateCaptain(s, e1, "ann", cid(s, 4)), "Your captain is one of your starters");
  assert.ok(A.setCaptain(s, e1, "ann", cid(s, 0)));
  assert.ok(A.setLineup(s, e1, "bo", [cid(s, 4), cid(s, 5)]));
  // Episode 1: ann's captain wins immunity (3 x 2) and her other starter finds an idol (2); bo's captain-less 3 and -0.5.
  results(s, 1, [[0, "individualImmunity"], [1, "idolFound"], [4, "individualImmunity"], [5, "satOut"]]);
  assert.equal(score(s, "ann"), 8);
  assert.equal(score(s, "bo"), 2.5);
  assert.equal(A.setCaptain(s, e1, "ann", cid(s, 1)), false, "locked once it has results");
  // Episode 2: nobody names anyone; ann's captain carries (she still starts), and a negative doubles too.
  results(s, 2, [[0, "satOut"], [1, "individualImmunity"]]);
  assert.equal(A.captainFor(s, ep(s, 2).id, "ann"), cid(s, 0));
  assert.equal(score(s, "ann"), 8 - 1 + 3);
  // Episode 3: ann benches her captain; the armband comes off with it (nobody counts double), and stays off.
  const e3 = ep(s, 3).id;
  assert.ok(A.setCaptain(s, e3, "ann", cid(s, 0)));
  assert.ok(A.setLineup(s, e3, "ann", [cid(s, 1), cid(s, 2)]));
  assert.equal(s.episodes.find((e) => e.id === e3).captains.ann, null);
  assert.equal(A.captainFor(s, e3, "ann"), null);
  results(s, 3, [[1, "individualImmunity"]]);
  assert.equal(score(s, "ann"), 10 + 3);
  // Episode 4: bo names his (null clears it again; a game with no captain refuses one).
  const e4 = ep(s, 4).id;
  assert.ok(A.setCaptain(s, e4, "bo", cid(s, 5)));
  assert.ok(A.setCaptain(s, e4, "bo", null));
  assert.equal(A.captainFor(s, e4, "bo"), null);
  assert.ok(A.setCaptain(s, e4, "bo", cid(s, 4)));
  const line = A.episodeScore(s, ep(s, 4), "bo");
  assert.deepEqual(line.lines.map((l) => [l.castawayId, l.captain, l.counted]), [[cid(s, 4), true, true], [cid(s, 5), false, true]]);
  const plain = league(LINEUP);
  assert.equal(S.ActiveRosterLogic.validateCaptain(plain, ep(plain, 1).id, "ann", cid(plain, 0)), "This game has no captain");
});

test("best ball: each episode the best n of the team it held then, no lineups; a waiver move counts from the episode after", () => {
  const s = league(BEST);
  const A = S.ActiveRosterLogic;
  const t = S.getLeagueType(s);
  assert.equal(t.id, "active-roster");
  assert.equal(t.hasBestBall, true);
  assert.equal(t.hasActiveRoster, false);
  assert.equal(A.activeSlots(s), 0);
  assert.equal(A.validateLineup(s, ep(s, 1).id, "ann", [cid(s, 0)]), "This league type has no active roster");
  // Episode 1: ann's four score 3, 2, -0.5 and nothing: her best two, 5. bo's one score of 3 and three nothings: 3.
  results(s, 1, [[0, "individualImmunity"], [1, "idolFound"], [2, "satOut"], [4, "individualImmunity"]]);
  assert.equal(score(s, "ann"), 5);
  assert.equal(score(s, "bo"), 3);
  const one = A.episodeScore(s, ep(s, 1), "ann");
  assert.deepEqual(one.lines.filter((l) => l.counted).map((l) => l.castawayId), [cid(s, 0), cid(s, 1)]);
  // After Episode 1, ann drops C3 for nobody's... bo's C7: a swap logged after Episode 1 (counts from 2).
  s.castaways[7].ownerIds = [];
  S.MidSeasonLogic.applyAddDrop(s, "ann", cid(s, 3), cid(s, 7));
  assert.equal(s.midSeason.log[s.midSeason.log.length - 1].episode, 1);
  assert.deepEqual(A.teamFor(s, ep(s, 1), "ann"), [cid(s, 0), cid(s, 1), cid(s, 2), cid(s, 3)], "Episode 1's team had C3");
  assert.deepEqual(A.teamFor(s, ep(s, 2), "ann"), [cid(s, 0), cid(s, 1), cid(s, 2), cid(s, 7)]);
  assert.equal(score(s, "ann"), 5, "the move doesn't reach back");
  // Episode 2: C3 (gone from her team) and C7 (new) both score; only C7 is hers. C0 finds an idol and goes home (2 - 3 = -1):
  // her best two are C7's 2 and a nothing.
  results(s, 2, [[3, "individualImmunity"], [7, "idolFound"], [0, "idolFound"]], 0);
  assert.equal(score(s, "ann"), 5 + 2);
  // Episode 3: C0 is gone; her three left score -0.5, -0.5 and nothing: the best two, -0.5.
  results(s, 3, [[1, "satOut"], [2, "satOut"]]);
  assert.equal(score(s, "ann"), 7 - 0.5);
  assert.deepEqual(A.teamFor(s, ep(s, 3), "ann"), [cid(s, 1), cid(s, 2), cid(s, 7)]);
  // The shared draft is its own variant: blind, still best ball.
  const shared = league({ ...BEST, get: { ...BEST.get, own: "shared", order: "blind" } });
  assert.equal(S.getLeagueType(shared).draftStrategy, S.BlindDraftStrategy);
  assert.equal(S.getLeagueType(shared).hasBestBall, true);
});

test("points that multiply by when: an episode, a run, a phase once it's begun, the finale once it's over; a captain on top", () => {
  const A = S.ActiveRosterLogic;
  const s = league({ ...CAPTAIN, score: { ...CAPTAIN.score, times: [{ episode: 2, times: 2 }, { from: 2, to: 3, times: 3 }, { phase: "merged", times: 0.5 }, { finale: true, times: 2 }] } });
  assert.equal(A.timesFor(s, 1), 1);
  assert.equal(A.timesFor(s, 2), 6, "in two windows: both");
  assert.equal(A.timesFor(s, 3), 3);
  // A phase counts once the settle pass records where it starts (it reads the season's phases now), and only from the
  // episode before it on: someone behind never learns a phase began.
  assert.equal(S.readsPhases(s), true);
  assert.equal(S.readsPhases(league(CAPTAIN)), false);
  assert.equal(S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 3 }], open: 1 }), true);
  assert.deepEqual(s.phaseStarts, { tribes: 1, merged: 3 });
  assert.deepEqual(s.phaseWindows, {}, "no questions, no windows");
  assert.equal(A.timesFor(s, 3), 3, "nobody's up to Episode 2 yet: the merge isn't known");
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "ann", [cid(s, 0), cid(s, 1)]);
  S.ActiveRosterLogic.setCaptain(s, ep(s, 1).id, "ann", cid(s, 0));
  results(s, 1, [[0, "individualImmunity"]]);
  results(s, 2, [[0, "individualImmunity"], [1, "idolFound"]]);
  assert.equal(A.timesFor(s, 3), 1.5, "up to Episode 2: Episode 3 is the merge's, half points");
  assert.equal(A.timesFor(s, 4), 0.5);
  results(s, 3, [[1, "individualImmunity"]]);
  // 1: her captain 3 x 2 = 6. 2: (3 x 2 + 2) x 6 = 48. 3: 3 x 1.5 = 4.5.
  assert.equal(score(s, "ann"), 6 + 48 + 4.5);
  // The finale is the episode that ends the season: the winner's, once they've won.
  assert.equal(A.timesFor(s, 4), 0.5);
  for (let i = 2; i < 8; i++) S.addElimination(s, ep(s, 4).id, cid(s, i), i === 7 ? "Sole Survivor" : "Voted Out");
  results(s, 4, [[0, "individualImmunity"]]);
  assert.equal(A.timesFor(s, 4), 1, "the merge's half, the finale's double");
  assert.equal(score(s, "ann"), 58.5 + 6);
  // A spoiler view before the finale doesn't know it.
  assert.equal(A.timesFor(S.SpoilerLogic.viewThrough(s, 3), 4), 0.5);
});

test("Outlast in reverse: the earlier they go home the more, counted live as if each went home next", () => {
  const E = S.EliminationOrderScoringStrategy;
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  assert.deepEqual(S.setGame(s, REVERSE, { ctx: CTX }), []);
  assert.equal(E.reversed(s), true);
  s.castaways.forEach((c, i) => { c.ownerIds = [i % 2 ? "bo" : "ann"]; }); // ann C0, C2, C4; bo C1, C3, C5
  for (let n = 1; n <= 3; n++) S.ensureEpisodeNumber(s, n, false);
  // Nobody out: everyone still in counts 6 (what the first one out would score).
  assert.equal(E.stillInPoints(s), 6);
  assert.equal(score(s, "ann"), 18);
  // C0 out first (6), C3 second (5): still in, 4 each.
  S.addElimination(s, ep(s, 1).id, cid(s, 0), "Voted Out");
  S.addElimination(s, ep(s, 2).id, cid(s, 3), "Voted Out");
  assert.equal(E.castawayPoints(s, s.castaways[0]), 6);
  assert.equal(E.castawayPoints(s, s.castaways[3]), 5);
  assert.equal(E.castawayPoints(s, s.castaways[1]), 4);
  const row = S.computeScores(s).find((r) => r.playerId === "ann");
  assert.equal(row.total, 6 + 4 + 4);
  assert.equal(row.banked, 6);
  assert.equal(score(s, "bo"), 5 + 4 + 4);
  // The end: C1 3rd (4), C4 4th (3), C2 5th (2), C5 wins (1). ann 6 + 3 + 2, bo 4 + 5 + 1.
  for (const i of [1, 4, 2]) S.addElimination(s, ep(s, 3).id, cid(s, i), "Voted Out");
  S.addElimination(s, ep(s, 3).id, cid(s, 5), "Sole Survivor");
  assert.equal(score(s, "ann"), 11);
  assert.equal(score(s, "bo"), 10);
  // Plain Outlast on the same results: the boot order as it always was.
  assert.deepEqual(S.setGame(s, { ...REVERSE, score: { by: "place" } }, { ctx: CTX }), []);
  assert.equal(E.reversed(s), false);
  assert.equal(score(s, "ann"), 1 + 5 + 4);
  assert.equal(score(s, "bo"), 3 + 2 + 6);
});

test("today's lineups score as they always did, and computer players name a captain", () => {
  const s = league(LINEUP);
  const A = S.ActiveRosterLogic;
  assert.equal(A.combines(s), false);
  assert.equal(A.captainTimes(s), 0);
  assert.equal(A.timesFor(s, 1), 1);
  A.setLineup(s, ep(s, 1).id, "ann", [cid(s, 0), cid(s, 1)]);
  results(s, 1, [[0, "individualImmunity"], [1, "satOut"], [2, "idolFound"]]);
  assert.equal(score(s, "ann"), 2.5);
  // episodeScore says the same of a plain lineup.
  assert.equal(A.episodeScore(s, ep(s, 1), "ann").total, 2.5);
  // A computer player in a captain game names its best starter.
  const c = league(CAPTAIN);
  c.players[1].automated = true;
  Bots.run(c);
  const e = S.currentEpisode(c);
  const lineup = A.lineupFor(c, e.id, "bo");
  assert.equal(lineup.length, 2);
  assert.equal(A.captainFor(c, e.id, "bo"), lineup[0]);
});

test("How it works says each one", () => {
  const ctx = { show: "Survivor 51", castaway: "castaway", phases: [{ id: "merged", name: "Merged" }] };
  const d = (spec) => G.describeSpec(spec, ctx);
  assert.match(d(CAPTAIN).sentence, /one of them a captain who scores double/);
  assert.ok(d(CAPTAIN).rules.some((r) => /Name one of your starters captain each episode: their points count double\./.test(r)));
  assert.match(d(BEST).sentence, /their best 2 count each episode/);
  assert.ok(d(BEST).rules.some((r) => /your best two count, whoever they are: no lineups to set/.test(r)));
  assert.equal(d(REVERSE).name, null, "reverse isn't Outlast");
  assert.match(d(REVERSE).sentence, /the first one out carries you/);
  assert.ok(d(REVERSE).rules.includes("Each castaway earns 1 point, plus 1 for everyone who outlasts them."));
  const t = d(timed([{ finale: true, times: 2 }, { from: 1, to: 3, times: 3 }, { phase: "merged", times: 0.5 }]));
  assert.match(t.sentence, /Points in the finale count double\. Points in Episodes 1–3 count triple\. Points in Merged count half\./);
  assert.ok(t.rules.includes("An episode in two of them counts both."));
  // Today's lineup and Outlast say what they always said.
  assert.equal(d(LINEUP).rules.some((r) => /captain|best|Points in/.test(r)), false);
  assert.ok(d(P.outlast).rules.includes("Each castaway earns 1 point, plus 1 for every boot they outlast."));
});
