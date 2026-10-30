// Head to head, with playoffs (docs/PLAN-start-a-game-gpt.md step A11 part 4: the dial win.h2h, "head-to-head with playoffs"):
// rank.by 'matchups', a draft's (Outlast, a lineup, best ball), each episode everyone playing one of the others on that episode's
// points, on a round robin of the seats; the standings by wins, then points; the playoffs (rank.playoffs: the top `teams` seeded,
// a round an episode over the game's last episodes, or from `from`); an odd number of seats (the median, or a bye: rank.odd) and a
// night nobody scores (rank.quiet). Their shape, defaults, words and settings; the engine's walk (MatchupLogic): the schedule, the
// records, the playoffs' place (a span's end, the season's length as its schedule says, kept once begun), the bracket (byes, a tie
// to the better seed), the champion, the game ending with its final, and each fallback (results still early, a corrected result,
// a late joiner, a ghost, a disabled seat, a season longer or shorter than it said, nothing saying the season's end, a viewer
// behind); the table, the couch's standings and the trophy (the playoffs' winner). Run with `npm test`.
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
/** A best-ball draft of three each, exclusive (nobody shares), played head to head: `rank` the rest of its rank. */
const h2h = (rank = {}, more = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, rank: { by: "matchups", ...rank }, ...more });
// The tracker's row (tests/fixtures/engine-capabilities.json), as its spec.
const WIN_H2H = { preset: "weekly-lineup", rank: { by: "matchups", playoffs: { teams: 4 } } };

test("head to head: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  const outlast = { preset: "outlast", get: { by: "draft", each: 3 }, rank: { by: "matchups", odd: "bye", quiet: "tie", playoffs: { teams: 3 } } };
  for (const s of [WIN_H2H, h2h(), h2h({ playoffs: { teams: 2, from: 12 } }), outlast]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specWaitsFor(s), []);
    // Back from the settings they write, whole.
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.equal(G.typeOf(WIN_H2H), "active-roster");
  assert.equal(G.typeOf(outlast), "classic-draft");
  assert.equal(G.flagsOf(G.fullSpec(WIN_H2H)).hasMatchups, true);
  assert.equal(G.flagsOf(G.fullSpec({ preset: "weekly-lineup" })).hasMatchups, false);
  // A rank that says only its playoffs is head to head; the defaults (the user's to set) are read, never filled in.
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", rank: { playoffs: { teams: 4 } } }).rank, { playoffs: { teams: 4 }, by: "matchups" });
  assert.deepEqual(G.MATCHUPS, { odd: "median", quiet: "skip" });
  assert.deepEqual(G.matchupParts(G.fullSpec(WIN_H2H)), { odd: "median", quiet: "skip", playoffs: { teams: 4, rounds: 2, from: null } });
  assert.deepEqual(G.matchupParts(G.fullSpec(outlast)), { odd: "bye", quiet: "tie", playoffs: { teams: 3, rounds: 2, from: null } });
  assert.deepEqual([2, 3, 4, 5, 8].map(G.playoffRounds), [1, 2, 2, 3, 3]);
  assert.equal(G.matchupParts(G.fullSpec({ preset: "weekly-lineup" })), null);
  // Its settings: draftRank 'matchups', and what it says beyond that in rankMatchups.
  const st = G.withSpec(S.defaultState().settings, outlast);
  assert.equal(st.draftRank, "matchups");
  assert.deepEqual(st.rankMatchups, { playoffs: { teams: 3 }, odd: "bye", quiet: "tie" });
  assert.equal(G.withSpec(S.defaultState().settings, h2h()).rankMatchups, undefined);
  // Beside the wrong game, out of range, or beside a race or cuts.
  assert.deepEqual(at({ preset: "survival-pool", rank: { by: "matchups" } }), ["rank.by"], "a pool's picks don't score an episode against someone");
  const questions = { get: { by: "none" }, score: { by: "answers" }, rank: { by: "matchups" }, ask: [{ id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } }] };
  assert.deepEqual(at(questions), ["rank.by"], "a game of questions' is part 4b's");
  assert.equal(G.typeOf(questions), null);
  for (const teams of [1, 9, 2.5, "four"]) assert.deepEqual(at(h2h({ playoffs: { teams } })), ["rank.playoffs.teams"], `teams ${teams}`);
  assert.deepEqual(at(h2h({ playoffs: null })), [], "null: no playoffs");
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, at: 3 } })), ["rank.playoffs.at"], "an unknown key");
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 0 } })), ["rank.playoffs.from"]);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 1 } })), ["rank.playoffs.from"], "at least one episode of matchups before them");
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 5 } }, { span: { from: 5, to: null } })), ["rank.playoffs.from"]);
  // With a span's end, `from` agrees with it (the game ends with its final), and the span leaves room for a regular season.
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 12 } }, { span: { from: 1, to: 13 } })), []);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 11 } }, { span: { from: 1, to: 13 } })), ["rank.playoffs.from"]);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4, from: 13 } }, { span: { from: 1, to: 13 } })), ["rank.playoffs.from"]);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4 } }, { span: { from: 1, to: 2 } })), ["rank.playoffs"]);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4 } }, { span: { from: 1, to: 3 } })), []);
  assert.deepEqual(at(h2h({ playoffs: { teams: 4 } }, { span: { from: 1, to: 2 } }), CTX, { league: true }), [], "a league's own keeps what it plays");
  assert.deepEqual(at(h2h({ odd: "coin" })), ["rank.odd"]);
  assert.deepEqual(at(h2h({ quiet: "wait" })), ["rank.quiet"]);
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { by: "total", playoffs: { teams: 2 } } }), ["rank.playoffs"]);
  assert.deepEqual(at({ preset: "weekly-lineup", rank: { by: "total", odd: "bye", quiet: "tie" } }), ["rank.odd", "rank.quiet"]);
  assert.deepEqual(at(h2h({ race: { to: 20 } })), ["rank.race"], "nobody races beside it");
  assert.deepEqual(at(h2h({ cut: [{ at: { every: 1 } }] })), ["rank.by"], "nobody is cut beside it");
  assert.deepEqual(at(h2h({ oneLeft: "ends" })), ["rank.oneLeft"]);
  // The playoffs take no more than the couch has teams (fewer is fine: the top seeds get byes).
  assert.deepEqual(at(WIN_H2H, { ...CTX, couch: 3 }), ["rank.playoffs.teams"]);
  assert.deepEqual(at(WIN_H2H, { ...CTX, couch: 4 }), []);
  assert.deepEqual(at(WIN_H2H, { ...CTX, couch: 6, teams: 3 }), ["rank.playoffs.teams"], "teams, not people (a shared seat)");
  // The words: the sentence and How it works.
  const d = (s) => G.describeSpec(s, { castaway: "castaway" });
  assert.match(d(WIN_H2H).sentence, /^A Weekly Lineup: .*Each episode you play one of the others head to head: more points wins it\. The top four by wins make the playoffs, over the last two episodes\.$/);
  assert.match(d(h2h()).sentence, /Most wins at the end wins\.$/);
  assert.match(d(h2h({ playoffs: { teams: 2, from: 12 } })).sentence, /The top two by wins make the playoffs, from Episode 12\.$/);
  const rules = d(outlast).rules.join(" ");
  assert.match(rules, /one of you sits each episode out, in turn/);
  assert.match(rules, /An episode where nobody scores is a tie for everyone\./);
  assert.match(rules, /The top seed gets a bye in the first round\./);
  assert.match(rules, /If the season ends before the final, the best seed still in wins\./);
  assert.match(d(WIN_H2H).rules.join(" "), /plays the middle score of everyone else's\. An episode where nobody scores counts for nobody\./);
});

test("the round robin: everyone once a cycle, the same on every read; an odd list leaves one out a round in turn", () => {
  const M = S.MatchupLogic;
  const ids = ["a", "b", "c", "d", "e", "f"];
  const seen = new Set();
  for (let r = 0; r < 5; r++) {
    const pairs = M.round(ids, r);
    assert.equal(pairs.length, 3);
    assert.deepEqual(pairs.flat().sort(), ids, `round ${r}: everyone once`);
    pairs.forEach(([a, b]) => seen.add([a, b].sort().join("")));
  }
  assert.equal(seen.size, 15, "every pair once in five rounds");
  assert.deepEqual(M.round(ids, 5), M.round(ids, 0), "then round again");
  assert.deepEqual(M.round(ids, 2), M.round(ids.slice(), 2), "the same on every read");
  const odd = [0, 1, 2].map((r) => M.round(["a", "b", "c"], r));
  assert.deepEqual(odd.map((pairs) => pairs.find(([, b]) => b === null)[0]), ["a", "b", "c"], "each left out once");
  assert.deepEqual(M.round(["a"], 0), []);
  assert.deepEqual(M.round([], 0), []);
  assert.deepEqual(M.bracket(4), [1, 4, 2, 3]);
  assert.deepEqual(M.bracket(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.equal(M.median([5, 1, 3]), 3);
  assert.equal(M.median([4, 1, 2, 3]), 2.5);
  assert.equal(M.median([]), 0);
});

// ---- the engine, on a league ----

const PLAYERS = ["ann", "bo", "cy", "di"];
/** A league of twelve castaways C0 to C11, the players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8, di C9-C11),
 *  its game `spec` through setGame; Episodes 1 to 10 made, none with results. */
function league(spec, players = PLAYERS) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 10; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Episode n's points by player: 3 (immunity), 2 (an idol), 5 (both) or 0, on each one's first castaway; a night nobody scores
 *  ({}) gets a result that scores nothing (someone without a team found an idol), so it has results. */
function points(s, n, by) {
  for (const [p, pts] of Object.entries(by)) {
    const i = PLAYERS.indexOf(p) * 3;
    if (pts === 3 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i)));
    if (pts === 2 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "idolFound", cid(s, i)));
  }
}
const M = S.MatchupLogic;
const rows = (s) => S.computeScores(s);
const order = (s) => rows(s).map((r) => r.playerId);
const record = (s) => Object.fromEntries(rows(s).map((r) => [r.playerId, `${r.matchups.wins}-${r.matchups.losses}-${r.matchups.ties}`]));
// The round robin over the four (in the order they joined) each episode from 1: 1 ann-di bo-cy, 2 ann-cy di-bo, 3 ann-bo cy-di,
// then again.

test("matchups: more points that episode wins, the same is a tie; the standings by wins, then points; the table follows", () => {
  const s = league(h2h());
  assert.equal(M.on(s), true);
  points(s, 1, { ann: 5, di: 2, bo: 3, cy: 3 });
  assert.deepEqual(record(s), { ann: "1-0-0", di: "0-1-0", bo: "0-0-1", cy: "0-0-1" });
  points(s, 2, { ann: 2, cy: 3, di: 5 });
  points(s, 3, { ann: 3, bo: 2, cy: 5, di: 5 });
  assert.deepEqual(record(s), { ann: "2-1-0", bo: "0-2-1", cy: "1-0-2", di: "1-1-1" });
  // ann's two wins and cy's win and two ties are level (a tie half a win): cy on more points (11 to 10); then di; bo last.
  assert.deepEqual(order(s), ["cy", "ann", "di", "bo"]);
  const r = rows(s).find((x) => x.playerId === "ann");
  assert.deepEqual(r.matchups, { wins: 2, losses: 1, ties: 0, for: 10, against: 7, seed: null, tier: 0, alive: false, champion: false });
  assert.equal(r.total, 10, "its points are still its points");
  // Level on wins: the regular season's points.
  const pts = league(h2h());
  points(pts, 1, { ann: 5, di: 3, bo: 2, cy: 0 });
  assert.deepEqual(order(pts), ["ann", "bo", "di", "cy"]);
  // No playoffs, no end: nothing ends it early.
  assert.equal(M.endsAt(s), null);
  assert.equal(S.lastEpisode(s), null);
  // The table (game-view.ts tableOf) ranks as the engine does, each row's record on it; the view says your matchups.
  const { tableOf, gameView } = jiti("../src/lib/game/game-view.ts");
  const table = tableOf(s, "ann", () => null);
  assert.deepEqual(table.map((x) => [x.playerId, x.rank, x.total, x.record.wins, x.record.ties]), [["cy", "1", 11, 1, 2], ["ann", "2", 10, 2, 0], ["di", "3", 12, 1, 1], ["bo", "4", 5, 0, 1]]);
  const v = gameView({ leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null }, s, "ann", null, () => null);
  assert.deepEqual(v.matchups.next, { episode: 4, round: null, opponent: "di", stand: null });
  assert.deepEqual(v.matchups.last, { episode: 3, round: null, opponent: "bo", stand: null, points: 3, against: 2, result: "win" });
  assert.equal(v.matchups.playoffs, null);
  assert.equal(gameView({ leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null }, s, null, null, () => null).matchups, null, "no seat, no matchups");
  // A game that isn't head to head: no record on its rows.
  const plain = league(h2h({}, { rank: { by: "total" } }));
  points(plain, 1, { ann: 5 });
  assert.ok(rows(plain).every((x) => !("matchups" in x)));
  assert.equal(tableOf(plain, "ann", () => null)[0].record, null);
});

test("an odd number of you: the median of everyone else, or a bye; a night nobody scores counts for nobody, or ties everyone", () => {
  const three = ["ann", "bo", "cy"];
  // Round 1 over ann, bo, cy (and the stand-in): ann left out, bo-cy.
  const median = league(h2h(), three);
  points(median, 1, { ann: 3, bo: 5, cy: 2 });
  // ann against the median of bo's 5 and cy's 2 (3.5): a loss; bo beats cy.
  assert.deepEqual(record(median), { bo: "1-0-0", ann: "0-1-0", cy: "0-1-0" });
  assert.equal(rows(median).find((r) => r.playerId === "ann").matchups.against, 3.5);
  const bye = league(h2h({ odd: "bye" }), three);
  points(bye, 1, { ann: 3, bo: 5, cy: 2 });
  assert.deepEqual(record(bye), { bo: "1-0-0", ann: "0-0-0", cy: "0-1-0" });
  assert.equal(rows(bye).find((r) => r.playerId === "ann").matchups.for, 3, "a bye's points still count toward the standings' points");
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const ref = { leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null };
  assert.deepEqual(gameView(ref, bye, "ann", null, () => null).matchups.last, { episode: 1, round: null, opponent: null, stand: "bye", points: 3, against: null, result: null });
  // Round 2: ann-cy, bo against the median.
  assert.deepEqual(gameView(ref, median, "bo", null, () => null).matchups.next, { episode: 2, round: null, opponent: null, stand: "median" });
  assert.deepEqual(gameView(ref, median, "cy", null, () => null).matchups.next, { episode: 2, round: null, opponent: "ann", stand: null });
  // A night nobody scores (results in, nothing to anyone): skipped by default, everyone tied with quiet 'tie'.
  const skip = league(h2h());
  S.addScoringEvent(skip, ep(skip, 1).id, "idolFound", cid(skip, 0));
  S.removeScoringEvent(skip, ep(skip, 1).id, skip.episodes[0].scoringEvents[0].id);
  S.EpisodeLogic.setNoExit(skip, ep(skip, 1).id, true);
  assert.ok(S.EpisodeLogic.hasResults(ep(skip, 1)));
  assert.deepEqual(record(skip), { ann: "0-0-0", bo: "0-0-0", cy: "0-0-0", di: "0-0-0" });
  assert.equal(M.run(skip).weeks[0].quiet, true);
  const tie = league(h2h({ quiet: "tie" }));
  S.EpisodeLogic.setNoExit(tie, ep(tie, 1).id, true);
  assert.deepEqual(record(tie), { ann: "0-0-1", bo: "0-0-1", cy: "0-0-1", di: "0-0-1" });
  // A 0-0 on a night others scored is a tie like any other.
  const zero = league(h2h());
  points(zero, 1, { bo: 3 });
  assert.deepEqual(record(zero), { bo: "1-0-0", ann: "0-0-1", di: "0-0-1", cy: "0-1-0" });
});

test("results still early wait; a corrected result works it out again; a viewer behind sees only what they've seen", () => {
  const s = league(h2h());
  points(s, 1, { ann: 5, di: 2 });
  S.EpisodeLogic.setResultsStage(s, ep(s, 1).id, "early");
  assert.deepEqual(record(s), { ann: "0-0-0", bo: "0-0-0", cy: "0-0-0", di: "0-0-0" });
  S.EpisodeLogic.setResultsStage(s, ep(s, 1).id, "final");
  assert.deepEqual(record(s), { ann: "1-0-0", bo: "0-0-1", cy: "0-0-1", di: "0-1-0" });
  points(s, 2, { di: 3 });
  // Episode 1's immunity was di's, not ann's: corrected, ann and di swap.
  const imm = ep(s, 1).scoringEvents.find((e) => e.type === "individualImmunity");
  S.removeScoringEvent(s, ep(s, 1).id, imm.id);
  S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 9));
  // 1: ann 2 v di 5 (di), bo-cy 0-0; 2: ann-cy 0-0, di 3 v bo 0 (di).
  assert.deepEqual(record(s), { di: "2-0-0", bo: "0-1-1", cy: "0-0-2", ann: "0-1-1" });
  // Seen through 1 only: Episode 2 isn't there.
  const behind = S.SpoilerLogic.viewThrough(s, 1);
  assert.deepEqual(record(behind), { di: "1-0-0", bo: "0-0-1", cy: "0-0-1", ann: "0-1-0" });
});

test("the playoffs: the top seeds over the game's last episodes; a tie to the better seed; the champion first; over at the final", () => {
  // Episodes 1 to 6, the top four over 5 and 6.
  const s = league(h2h({ playoffs: { teams: 4 } }, { span: { from: 1, to: 6 } }));
  assert.equal(M.playoffsFrom(s), 5);
  assert.equal(M.endsAt(s), 6);
  assert.equal(S.lastEpisode(s), 6);
  points(s, 1, { ann: 5, bo: 3, cy: 2 });
  points(s, 2, { bo: 5, cy: 3 });
  points(s, 3, { di: 5, ann: 2 });
  assert.equal(M.run(s).seeds, null, "not seeded while the regular season plays");
  points(s, 4, { cy: 3, di: 2 });
  // Everyone 2-2: seeded by points (bo 8, cy 8: bo joined first; ann 7, di 7: ann joined first).
  assert.deepEqual(M.run(s).seeds, ["bo", "cy", "ann", "di"]);
  assert.deepEqual(rows(s).map((r) => [r.playerId, r.matchups.seed, r.matchups.tier]), [["bo", 1, 1], ["cy", 2, 1], ["ann", 3, 1], ["di", 4, 1]]);
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const ref = { leagueId: "l", name: "L", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: null };
  assert.deepEqual(gameView(ref, s, "ann", null, () => null).matchups.next, { episode: 5, round: 1, opponent: "cy", stand: null });
  // Round 1: bo-di tied on 2 (the better seed, bo, goes through); cy beats ann.
  points(s, 5, { bo: 2, di: 2, cy: 5, ann: 3 });
  // Level on all of it (2-2, 8 points each), the better seed first.
  assert.deepEqual(rows(s).map((r) => [r.playerId, r.matchups.tier, r.matchups.alive]), [["bo", 2, true], ["cy", 2, true], ["ann", 1, false], ["di", 1, false]]);
  assert.equal(S.gameOver(s), false);
  assert.equal(gameView(ref, s, "ann", null, () => null).matchups.next, null, "ann's out of them: no matchup");
  assert.deepEqual(gameView(ref, s, "bo", null, () => null).matchups.next, { episode: 6, round: 2, opponent: "cy", stand: null });
  // The final: cy beats bo. The champion first, whatever the points; it's over at 6.
  points(s, 6, { cy: 2, ann: 5 });
  assert.equal(M.run(s).champion, "cy");
  assert.deepEqual(order(s), ["cy", "bo", "ann", "di"]);
  assert.deepEqual(rows(s).map((r) => r.matchups.tier), [3, 2, 1, 1]);
  assert.equal(S.gameOver(s), true);
  const v = gameView(ref, s, "cy", null, () => null);
  assert.equal(v.over, true);
  assert.equal(v.matchups.playoffs.champion, "cy");
  assert.equal(v.matchups.next, null);
  assert.deepEqual(v.matchups.last, { episode: 6, round: 2, opponent: "bo", stand: null, points: 2, against: 0, result: "win" });
  assert.equal(v.table[0].record.champion, true);
  // The couch's standings: the champion's plaque, no margin in points.
  const { trophiesOf } = jiti("../src/lib/game/couch-standings.ts");
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const standingRows = tableOf(s, "cy", (p) => `u-${p}`).map((r) => ({ userId: r.userId, name: r.name, place: r.place, rank: r.rank, total: r.total, seat: r.playerId }));
  const game = { leagueId: "l1", name: "L", gameName: "Weekly Lineup", gameType: "active-roster", seasonId: "s1", showId: "sh", showName: "Survivor", label: "Survivor 51", artUrl: null, year: 2026, through: 6, ended: true, rows: standingRows, before: null, matchups: true };
  const people = PLAYERS.map((p) => ({ userId: `u-${p}`, name: p }));
  const shelf = trophiesOf([game], people, "u-cy");
  assert.deepEqual(shelf.plaques[0].winners.map((w) => w.userId), ["u-cy"]);
  assert.equal(shelf.plaques[0].by, null);
});

test("byes in the bracket; the playoffs at the season's end as its schedule says, kept once begun; a season longer or shorter", () => {
  // Three seats, the top three over the last two of eight: the top seed's bye in the first round.
  const three = league(h2h({ playoffs: { teams: 3 } }, { span: { from: 1, to: 8 } }), ["ann", "bo", "cy"]);
  for (let n = 1; n <= 6; n++) points(three, n, { ann: 5, bo: 3, cy: 2 });
  assert.deepEqual(M.run(three).seeds, ["ann", "bo", "cy"]);
  const r1 = M.run(three).rounds[0];
  assert.deepEqual(r1.games.map((g) => [g.aSeed, g.bSeed, g.winner]), [[1, null, "ann"], [2, 3, null]]);
  points(three, 7, { cy: 5, bo: 3 });
  assert.deepEqual(M.run(three).rounds[1].games.map((g) => [g.a, g.b]), [["ann", "cy"]]);
  points(three, 8, { cy: 5 });
  assert.equal(M.run(three).champion, "cy");
  // Two seats in a bracket of four: both byes to the final.
  const two = league(h2h({ playoffs: { teams: 4 } }, { span: { from: 1, to: 4 } }), ["ann", "bo"]);
  points(two, 1, { ann: 5 });
  points(two, 2, { ann: 5 });
  points(two, 3, { bo: 5 });
  assert.deepEqual(M.run(two).rounds[0].games.map((g) => [g.aSeed, g.bSeed, g.winner]), [[1, null, "ann"], [2, null, "bo"]]);
  points(two, 4, { bo: 3 });
  assert.equal(M.run(two).champion, "bo");
  // To the season's end: placed by its length as its schedule says (state.seasonEpisodes, the server's); none while nothing says it.
  const s = league(h2h({ playoffs: { teams: 2 } }));
  assert.equal(M.readsSeasonLength(s), true);
  assert.equal(M.playoffsFrom(s), null);
  assert.equal(S.lastEpisode(s), null);
  s.seasonEpisodes = 6;
  assert.equal(M.playoffsFrom(s), 6);
  assert.equal(M.endsAt(s), 6);
  for (let n = 1; n <= 5; n++) points(s, n, { ann: 5, bo: 3 });
  assert.equal(M.settlePlayoffs(s), false, "nothing to keep before the first round has results");
  assert.equal(s.playoffsFrom, undefined);
  // The schedule says one more before the playoffs begin: they move.
  s.seasonEpisodes = 7;
  assert.equal(M.playoffsFrom(s), 7);
  points(s, 6, { bo: 5 });
  points(s, 7, { ann: 3, bo: 2 });
  assert.equal(M.settlePlayoffs(s), true);
  assert.equal(s.playoffsFrom, 7);
  assert.equal(M.run(s).champion, "ann");
  // Begun, they stay: a season longer than its schedule said ends the game with its final; nothing after it counts.
  s.seasonEpisodes = 9;
  assert.equal(M.playoffsFrom(s), 7);
  assert.equal(S.lastEpisode(s), 7);
  assert.equal(S.gameOver(s), true);
  points(s, 8, { bo: 5 });
  assert.equal(rows(s).find((r) => r.playerId === "bo").total, 22, "Episode 8 doesn't count");
  // A move for an episode after the final is refused.
  assert.equal(M.moveProblem(s, 8), "This game ended with episode 7");
  assert.equal(S.KnockoutLogic.moveProblem(s, "bo", 8), "This game ended with episode 7");
  assert.equal(S.KnockoutLogic.moveProblem(s, "bo", 7), null);
  // The first round's results taken back: let go, placed by the schedule again.
  S.removeScoringEvent(s, ep(s, 8).id, ep(s, 8).scoringEvents[0].id);
  ep(s, 7).scoringEvents.slice().forEach((e) => S.removeScoringEvent(s, ep(s, 7).id, e.id));
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 7)), false);
  assert.equal(M.settlePlayoffs(s), true);
  assert.equal(s.playoffsFrom, undefined);
  assert.equal(M.playoffsFrom(s), 9);
  // A game that no longer places its own lets go of where they began.
  s.playoffsFrom = 7;
  S.setGame(s, h2h(), { ctx: CTX });
  assert.equal(M.settlePlayoffs(s), true);
  assert.equal(s.playoffsFrom, undefined);
  // A span's end and a shorter schedule: the earlier of the two.
  const span = league(h2h({ playoffs: { teams: 2 } }, { span: { from: 1, to: 9 } }));
  span.seasonEpisodes = 8;
  assert.equal(M.playoffsFrom(span), 8);
  // Too short for a regular season: no playoffs.
  const short = league(h2h({ playoffs: { teams: 4 } }));
  short.seasonEpisodes = 2;
  assert.equal(M.playoffsFrom(short), null);
});

test("the season over first: the best seed still in, or the standings when nothing placed the playoffs; Outlast head to head", () => {
  // The schedule said 8, the season ended at 7 (the winner crowned) with the semifinals played: the better seed still in wins.
  const s = league(h2h({ playoffs: { teams: 4 } }));
  s.seasonEpisodes = 8;
  for (let n = 1; n <= 6; n++) points(s, n, { ann: 5, bo: 3, cy: 2 });
  points(s, 7, { di: 5, cy: 3 });
  assert.deepEqual(M.run(s).seeds, ["ann", "bo", "cy", "di"]);
  // Round 1 at 7: ann 0 v di 5 (di), bo 0 v cy 3 (cy).
  assert.equal(M.run(s).champion, null);
  for (let i = 1; i < 12; i++) if (i !== 9) S.addElimination(s, ep(s, 7).id, cid(s, i), "Voted Out");
  S.addElimination(s, ep(s, 7).id, cid(s, 9), "Sole Survivor");
  assert.equal(S.seasonEnded(s), true);
  assert.equal(S.gameOver(s), true);
  assert.equal(M.run(s).champion, "cy", "cy (3) is the better seed still in than di (4)");
  assert.equal(order(s)[0], "cy");
  // Results after the finale (a reunion the schedule counted): the final doesn't play on them.
  points(s, 8, { di: 5 });
  assert.equal(M.run(s).rounds[1].played, false);
  assert.equal(M.run(s).champion, "cy");
  // A schedule that counts two reunion episodes: the playoffs placed after the finale; the season over, the best seed wins.
  const reunion = league(h2h({ playoffs: { teams: 2 } }));
  reunion.seasonEpisodes = 9;
  for (let n = 1; n <= 7; n++) points(reunion, n, { bo: 5, ann: 3 });
  for (let i = 1; i < 12; i++) S.addElimination(reunion, ep(reunion, 7).id, cid(reunion, i), "Voted Out");
  S.addElimination(reunion, ep(reunion, 7).id, cid(reunion, 0), "Sole Survivor");
  points(reunion, 9, { ann: 5 });
  assert.equal(M.playoffsFrom(reunion), 9);
  assert.equal(M.run(reunion).champion, "bo", "seed 1, the final on the reunion not played");
  assert.equal(S.gameOver(reunion), true);
  // Nothing ever said the season's end: no playoffs; the standings decide.
  const none = league(h2h({ playoffs: { teams: 2 } }));
  points(none, 1, { ann: 5 });
  assert.equal(M.run(none).from, null);
  assert.equal(order(none)[0], "ann");
  // Outlast head to head: an episode's points are what each team's grew by (a boot outlasted by each of yours still in).
  const outlast = league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank: { by: "matchups" } });
  S.addElimination(outlast, ep(outlast, 1).id, cid(outlast, 0), "Voted Out");
  // ann lost one (her two left grow by one each, her first out at 1), the rest grow by three: ann-di, bo-cy level.
  assert.deepEqual(record(outlast), { bo: "0-0-1", cy: "0-0-1", di: "1-0-0", ann: "0-1-0" });
  // A night nobody goes home: nobody's points grow, so it counts for nobody.
  S.EpisodeLogic.setNoExit(outlast, ep(outlast, 2).id, true);
  assert.equal(M.run(outlast).weeks[1].quiet, true);
  assert.deepEqual(record(outlast), { bo: "0-0-1", cy: "0-0-1", di: "1-0-0", ann: "0-1-0" });
});

test("who plays: a late joiner from their start, a ghost outside, a disabled seat still in", () => {
  const s = league(h2h(), [...PLAYERS, "eve", "gh"]);
  s.players.find((p) => p.id === "gh").ghost = true;
  s.players.find((p) => p.id === "eve").lateJoin = { startEpisode: 3, catchingUp: false };
  assert.deepEqual(M.seatsAt(s, 1), PLAYERS);
  assert.deepEqual(M.seatsAt(s, 3), [...PLAYERS, "eve"]);
  points(s, 1, { ann: 5 });
  points(s, 3, { ann: 5 });
  const w = M.run(s);
  assert.equal(w.weeks[0].games.length, 2, "four at 1");
  assert.equal(w.weeks[1].games.length, 3, "five at 3: one against the median");
  assert.ok(w.weeks.every((x) => x.games.every((g) => g.a !== "gh" && g.b !== "gh")), "a ghost plays nobody");
  // The earlier weeks stay as they were once she's in.
  assert.deepEqual(w.weeks[0].games.map((g) => [g.a, g.b]), [["ann", "di"], ["bo", "cy"]]);
  // A disabled seat stays in the schedule, its team playing on.
  S.disablePlayer(s, "bo");
  assert.ok(M.seatsAt(s, 4).includes("bo"));
  // A seat still to be brought in isn't.
  s.players.find((p) => p.id === "cy").active = false;
  assert.ok(!M.seatsAt(s, 4).includes("cy"));
});

test("when each seat joined the schedule, kept on every write: a seat brought in later from the next episode, the weeks played as they were", () => {
  const s = league(h2h(), [...PLAYERS, "eve"]);
  s.players.find((p) => p.id === "eve").active = false;
  // The first time, everyone there is in from their own start (a game made head to head mid-season counts its past).
  points(s, 1, { ann: 5 });
  points(s, 2, { bo: 5 });
  assert.equal(M.settleSeats(s), true);
  assert.deepEqual(s.matchupSeats, { ann: 1, bo: 1, cy: 1, di: 1 });
  assert.equal(M.settleSeats(s), false, "nothing new");
  const before = M.run(s).weeks.map((x) => x.games.map((g) => [g.a, g.b]));
  // eve brought in after Episode 2 (no late join of her own): in from 3, the weeks played as they were.
  S.activatePlayer(s, "eve", []);
  assert.deepEqual(M.seatsAt(s, 3), PLAYERS, "not until a write keeps her");
  assert.equal(M.settleSeats(s), true);
  assert.equal(s.matchupSeats.eve, 3);
  points(s, 3, { eve: 0, ann: 2 });
  const w = M.run(s);
  assert.deepEqual(w.weeks.slice(0, 2).map((x) => x.games.map((g) => [g.a, g.b])), before);
  assert.equal(w.weeks[2].games.length, 3, "five at 3: one against the median");
  // A late joiner still catching up isn't in it; once caught up, from the first episode still to play.
  s.players.push({ id: "fay", name: "fay", color: "#000", lateJoin: { startEpisode: 1, catchingUp: true } });
  M.settleSeats(s);
  assert.equal(s.matchupSeats.fay, undefined);
  assert.ok(!M.seatsAt(s, 3).includes("fay"));
  s.players.find((p) => p.id === "fay").lateJoin.catchingUp = false;
  assert.equal(M.settleSeats(s), true);
  assert.equal(s.matchupSeats.fay, 4);
  // A ghost never; a game no longer head to head lets them all go.
  s.players.push({ id: "gh", name: "gh", color: "#000", ghost: true });
  M.settleSeats(s);
  assert.equal(s.matchupSeats.gh, undefined);
  S.setGame(s, h2h({}, { rank: { by: "total" } }), { ctx: CTX });
  assert.equal(M.settle(s), true);
  assert.equal(s.matchupSeats, undefined);
  // A ghost's own row (on their own copy) has no record: it's in nobody's schedule.
  const g = league(h2h(), [...PLAYERS, "gh"]);
  g.players.find((p) => p.id === "gh").ghost = true;
  points(g, 1, { ann: 5 });
  assert.equal(rows(g).find((r) => r.playerId === "gh").matchups, null);
  assert.ok(rows(g).filter((r) => r.playerId !== "gh").every((r) => r.matchups));
});
