// Handicaps (docs/PLAN-start-a-game-gpt.md step A11 part 5b: the dial who.handicap and the request s19, "Newcomers get 5 bonus
// points a week"): rank.handicap, points each episode the game plays for whoever it names, newcomers by the couch's history. Its
// shape, defaults, words and settings; the engine (HandicapLogic): who's new from the server's stamp (failing closed without one, a
// computer player never), kept once the game starts (the history changing after it moves nothing; a seat that comes in later kept as
// it's read; the spec changing what newcomers are new to keeps them again), its points (each episode with results from the seat's
// own start, a late joiner's from theirs, none for one still choosing where to start or not brought in, nothing past the span's end,
// a viewer behind, a corrected result); with the rest of the engine (a race, the guillotine and someone knocked out keeping theirs,
// head to head's weeks, teams of players' points); a game of questions' walk (its totals, series and each one's handicap, someone
// knocked out); the table and the couch's standings. The server's stamp (handicaps.ts) is check-handicaps.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const H = S.HandicapLogic;
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
// The tracker's rows (tests/fixtures/engine-capabilities.json), as their spec: who.handicap and s19.
const WHO_HANDICAP = { preset: "weekly-lineup", rank: { by: "total", handicap: { points: 5 } } };
const FIVE = { points: 5 };
/** A best-ball draft of three each, exclusive, its rank `rank` with the handicap `handicap`. */
const best = (handicap, rank = { by: "total" }, more = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null }, rank: { ...rank, handicap }, ...more });
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const questions = (rank, more = {}) => ({ span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...(more.score || {}) }, ask: [BOOT], rank });

test("a handicap: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  const asked = questions({ by: "total", handicap: { points: 2, newTo: "show" } });
  const h2h = best(FIVE, { by: "matchups", playoffs: { teams: 2 } }, { span: { from: 1, to: 6 } });
  const teams = best(FIVE, { by: "total", teams: { of: 2 } });
  const cut = best(FIVE, { by: "standing", cut: [{ at: { every: 1 } }] });
  const race = best(FIVE, { by: "total", race: { to: 30 } });
  const outlast = { preset: "outlast", get: { by: "draft", each: 3 }, rank: { handicap: { points: 50, who: "new", newTo: "couch" } } };
  for (const s of [WHO_HANDICAP, best(FIVE), asked, h2h, teams, cut, race, outlast]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specWaitsFor(s), []);
    // Back from the settings they write, whole.
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.equal(G.flagsOf(G.fullSpec(WHO_HANDICAP)).hasHandicap, true);
  assert.equal(G.flagsOf(G.fullSpec({ preset: "weekly-lineup" })).hasHandicap, false);
  // The defaults (the user's to set) are read, never filled in.
  assert.deepEqual(G.HANDICAP, { who: "new", newTo: "couch" });
  assert.deepEqual(G.fullSpec(WHO_HANDICAP).rank, { by: "total", handicap: { points: 5 } });
  assert.deepEqual(G.handicapParts(G.fullSpec(WHO_HANDICAP)), { points: 5, who: "new", newTo: "couch" });
  assert.deepEqual(G.handicapParts(G.fullSpec(asked)), { points: 2, who: "new", newTo: "show" });
  assert.equal(G.handicapParts(G.fullSpec({ preset: "weekly-lineup" })), null);
  // A game of questions with one is walked (its points added on the walk).
  assert.deepEqual(G.answerParts(G.fullSpec(asked)).handicap, { points: 2, who: "new", newTo: "show" });
  assert.equal(G.answerParts(G.fullSpec(questions({ by: "total" }))), null, "nothing to walk without it");
  // Its settings: rankHandicap, a draft's and a game of questions'.
  assert.deepEqual(G.withSpec(S.defaultState().settings, WHO_HANDICAP).rankHandicap, { points: 5 });
  assert.equal(G.withSpec(S.defaultState().settings, { preset: "weekly-lineup" }).rankHandicap, undefined);
  // Beside the wrong game, or out of range.
  assert.deepEqual(at({ preset: "survival-pool", rank: { handicap: FIVE } }), ["rank.handicap"], "a pool ranks by its streak");
  assert.match(G.specProblems({ preset: "survival-pool", rank: { handicap: FIVE } }, CTX)[0].problem, /would only break ties/);
  assert.deepEqual(at({ preset: "weekly-calls", rank: { handicap: FIVE } }), ["rank.handicap"], "Weekly Calls' calls are counted outside the game");
  assert.deepEqual(at({ preset: "weekly-bingo", rank: { handicap: FIVE } }), ["rank.handicap"], "bingo lines too");
  const coop = { get: { by: "none" }, score: { by: "answers", lives: 3 }, ask: [BOOT], rank: { by: "coop", handicap: FIVE } };
  assert.deepEqual(at(coop), ["rank.handicap"], "co-op's lives are everyone's");
  assert.equal(G.handicapParts(G.fullSpec(coop)), null);
  const market = { preset: "weekly-lineup", get: { by: "draft", each: 5, order: "auction", own: "exclusive", budget: { total: 100, trade: {} } }, rank: { by: "worth", handicap: FIVE } };
  assert.ok(at(market).includes("rank.handicap"), "a stock market ranked by worth");
  assert.equal(G.handicapParts(G.fullSpec(market)), null);
  for (const points of [0, 51, 2.5, "5", undefined]) assert.deepEqual(at(best({ points })), ["rank.handicap.points"], `points ${points}`);
  assert.deepEqual(at(best({ points: 5, who: "champion" })), ["rank.handicap.who"]);
  assert.deepEqual(at(best({ points: 5, newTo: "season" })), ["rank.handicap.newTo"]);
  assert.deepEqual(at(best({ points: 5, each: 1 })), ["rank.handicap.each"], "an unknown key");
  assert.deepEqual(at(best(5)), ["rank.handicap"], "not an object");
  // The words: the sentence and How it works.
  const d = (s, show = "Survivor") => G.describeSpec(s, { castaway: "castaway", show });
  assert.match(d(WHO_HANDICAP).sentence, / Newcomers get 5 points an episode: anyone with no game on this couch from an earlier season\.$/);
  const rules = d(WHO_HANDICAP).rules.join(" ");
  assert.match(rules, /Newcomers get 5 points every episode the game plays, on top of what they score: anyone with no game on this couch from an earlier season\./);
  assert.match(rules, /Who's new is worked out from the couch's games when the game starts, and stays that way all season\. Join after the start and it's worked out as you join, counting from your first episode\./);
  assert.doesNotMatch(rules, /A team you share/);
  const q = d(asked);
  // The show isn't named: the words' show is the season's label ("Survivor 51"), and no game of Survivor 51 is from an earlier season.
  assert.match(d(asked, "Survivor 51").sentence, /Newcomers get 2 points an episode: anyone with no game of this show on this couch from an earlier season\./);
  assert.match(q.rules.join(" "), /Newcomers get 2 points every episode the game plays/);
  assert.match(d({ ...WHO_HANDICAP, extras: { seats: { people: 2 } } }).rules.join(" "), /A team you share counts as new only if everyone on it is\./);
});

// ---- the engine, on a league ----

const PLAYERS = ["ann", "bo", "cy", "di"];
/** The couch's history as the server stamps it: ann and di have played nothing here before; bo has, Survivor too; cy has played
 *  another show here, never Survivor. */
const HISTORY = { ann: { couch: 0, show: 0 }, bo: { couch: 2, show: 1 }, cy: { couch: 1, show: 0 }, di: { couch: 0, show: 0 } };
/** A league of twelve castaways C0 to C11, the players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8, di C9-C11),
 *  its game `spec` through setGame; Episodes 1 to 10 made, none with results; the history stamped unless `history` is null. */
function league(spec, history = HISTORY, players = PLAYERS) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 10; n++) S.ensureEpisodeNumber(s, n, false);
  if (history) s.seatHistory = structuredClone(history);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Episode n's points by player: 3 (immunity), 2 (an idol), 5 (both) or 0, on each one's first castaway; {} a night with nothing
 *  but nobody going home (it's played all the same). */
function points(s, n, by) {
  if (!Object.keys(by).length) assert.ok(S.setNoExit(s, ep(s, n).id, true));
  for (const [p, pts] of Object.entries(by)) {
    const i = PLAYERS.indexOf(p) * 3;
    if (pts === 3 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i)));
    if (pts === 2 || pts === 5) assert.ok(S.addScoringEvent(s, ep(s, n).id, "idolFound", cid(s, i)));
  }
}
const rows = (s) => S.computeScores(s);
const totals = (s) => Object.fromEntries(rows(s).map((r) => [r.playerId, r.total]));
const handicaps = (s) => Object.fromEntries(rows(s).map((r) => [r.playerId, r.handicap]));
const newcomers = (s) => PLAYERS.filter((p) => S.getPlayer(s, p) && H.isNew(s, p));

test("who's new: from the server's stamp, failing closed without one; kept once the game starts", () => {
  // Never read (no stamp): nobody is new, so nobody gets anything.
  const bare = league(best(FIVE), null);
  points(bare, 1, { bo: 3 });
  assert.deepEqual(newcomers(bare), []);
  assert.deepEqual(handicaps(bare), { bo: 0, ann: 0, cy: 0, di: 0 });
  assert.equal(H.settle(bare), false, "nothing to keep from a history nobody read");
  assert.equal(bare.handicapSeats, undefined);
  // Stamped: new to the couch (the default), or to the show.
  const s = league(best(FIVE));
  assert.deepEqual(newcomers(s), ["ann", "di"]);
  assert.deepEqual(H.view(s, "ann"), { points: 5, newTo: "couch", newcomers: ["ann", "di"], yours: true, kept: false });
  assert.equal(H.view(s, "bo").yours, false);
  assert.deepEqual(newcomers(league(best({ points: 5, newTo: "show" }))), ["ann", "cy", "di"]);
  // A computer player is never new, whatever the stamp says.
  const bots = league(best(FIVE), { ...HISTORY, bo: { couch: 0, show: 0 } });
  S.getPlayer(bots, "bo").automated = true;
  assert.deepEqual(newcomers(bots), ["ann", "di"]);
  // Before the start it's the history as it stands: nothing is kept, and a change moves it.
  assert.equal(H.settle(s), false);
  s.seatHistory.di = { couch: 1, show: 1 };
  assert.deepEqual(newcomers(s), ["ann"]);
  s.seatHistory.di = { couch: 0, show: 0 };
  // Started (its first episode has results): kept as the history had it. A computer player (cy here) is never new and never kept.
  S.getPlayer(s, "cy").automated = true;
  delete s.seatHistory.cy;
  assert.equal(H.needsHistory(s), true, "before the start: the history as it stands");
  points(s, 1, { bo: 3 });
  assert.equal(H.needsHistory(s), true, "started, nothing kept yet");
  assert.equal(H.settle(s), true);
  assert.deepEqual(s.handicapSeats, { newTo: "couch", seats: { ann: true, bo: false, di: true } });
  assert.equal(H.view(s, "ann").kept, true);
  assert.equal(H.settle(s), false, "nothing more to keep");
  assert.equal(H.needsHistory(s), false, "everyone a person holds is kept: the server needn't read the history again");
  s.players.push({ id: "zed", name: "zed", color: "#000", disabled: true });
  assert.equal(H.needsHistory(s), false, "nor for a seat that left without being kept");
  s.players.pop();
  // The history changing after the start moves nothing.
  s.seatHistory.ann = { couch: 3, show: 3 };
  s.seatHistory.bo = { couch: 0, show: 0 };
  assert.deepEqual(newcomers(s), ["ann", "di"]);
  // A seat that comes in later (brought in, not a late joiner) is kept as it's read, not before the history has it, counting from the
  // first episode still to play then (Episode 2: the first had been played without them).
  s.players.push({ id: "ed", name: "ed", color: "#000" });
  assert.equal(H.needsHistory(s), true, "ed isn't kept");
  assert.equal(H.settle(s), false, "ed isn't in the history yet");
  assert.equal(H.isNew(s, "ed"), false);
  s.seatHistory.ed = { couch: 0, show: 0 };
  assert.equal(H.isNew(s, "ed"), true, "provisionally, as the history has it");
  assert.equal(H.settle(s), true);
  assert.deepEqual([s.handicapSeats.seats.ed, s.handicapSeats.from], [true, { ed: 2 }]);
  // A computer player's seat taken over by a newcomer: read as they take it, from the first episode still to play.
  delete S.getPlayer(s, "cy").automated;
  s.seatHistory.cy = { couch: 0, show: 0 };
  assert.equal(H.needsHistory(s), true);
  assert.equal(H.settle(s), true);
  assert.deepEqual([s.handicapSeats.seats.cy, s.handicapSeats.from], [true, { ed: 2, cy: 2 }]);
  points(s, 2, {});
  assert.deepEqual(handicaps(s), { ann: 10, di: 10, cy: 5, ed: 5, bo: 0 }, "ann and di from the start, cy and ed from Episode 2");
  // The spec changing what newcomers are new to keeps them all again from the history then, each one's `from` kept.
  assert.deepEqual(S.setGame(s, best({ points: 5, newTo: "show" }), { ctx: CTX }), []);
  assert.equal(H.settle(s), true);
  assert.deepEqual(s.handicapSeats, { newTo: "show", seats: { ann: false, bo: true, cy: true, di: true, ed: true }, from: { ed: 2, cy: 2 } });
  // No handicap any more: what was kept goes.
  assert.deepEqual(S.setGame(s, best(undefined), { ctx: CTX }), []);
  assert.equal(H.settle(s), true);
  assert.equal(s.handicapSeats, undefined);
  assert.equal(rows(s)[0].handicap, undefined, "a game without one has no handicap on its rows");
});

test("its points: each episode with results from the seat's own start, on the row and in the total; the table ranks by them", () => {
  const s = league(best(FIVE));
  points(s, 1, { bo: 3, cy: 2 });
  points(s, 2, {});
  assert.deepEqual(handicaps(s), { ann: 10, di: 10, bo: 0, cy: 0 }, "a night nobody went home is played too");
  assert.deepEqual(totals(s), { ann: 10, di: 10, bo: 3, cy: 2 });
  assert.deepEqual(rows(s).map((r) => r.playerId), ["ann", "di", "bo", "cy"], "ranked with it");
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const table = tableOf(s, "ann", () => null);
  assert.deepEqual(table.map((r) => [r.playerId, r.total, r.handicap, r.rank]), [["ann", 10, 10, "T1"], ["di", 10, 10, "T1"], ["bo", 3, 0, "3"], ["cy", 2, 0, "4"]]);
  assert.equal(tableOf(league(best(undefined)), "ann", () => null)[0].handicap, null, "null without one");
  // A viewer behind sees only what they've seen.
  assert.deepEqual(handicaps(S.GhostLogic.viewFor(s, "bo", 1)), { ann: 5, di: 5, bo: 0, cy: 0 });
  // A corrected result: Episode 2 taken back, its points with it.
  S.setNoExit(s, ep(s, 2).id, false);
  assert.deepEqual(handicaps(s), { ann: 5, di: 5, bo: 0, cy: 0 });
  // A late joiner counts from their own start; one still choosing where to start, or not brought in, gets nothing yet.
  const late = league(best(FIVE), { ...HISTORY, ed: { couch: 0, show: 0 }, fy: { couch: 0, show: 0 }, gu: { couch: 0, show: 0 } }, [...PLAYERS, "ed", "fy", "gu"]);
  S.getPlayer(late, "ed").lateJoin = { startEpisode: 2, catchingUp: false };
  S.getPlayer(late, "fy").lateJoin = { startEpisode: null, catchingUp: false };
  S.getPlayer(late, "gu").active = false;
  for (const n of [1, 2, 3]) points(late, n, {});
  const h = handicaps(late);
  assert.deepEqual([h.ann, h.ed, h.fy, h.gu], [15, 10, 0, 0]);
  // A game over a span: nothing after its end.
  const span = league(best(FIVE, { by: "total" }, { span: { from: 1, to: 2 } }));
  for (const n of [1, 2, 3]) points(span, n, {});
  assert.equal(handicaps(span).ann, 10);
  // Nothing after the season's finale (a reunion with results of its own, as The Challenge's schedule counts).
  const ended = league(best(FIVE));
  points(ended, 1, {});
  S.addElimination(ended, ep(ended, 2).id, cid(ended, 3), "Lost Final Tribal (Jury Vote)");
  S.addElimination(ended, ep(ended, 2).id, cid(ended, 0), "Sole Survivor");
  points(ended, 3, {});
  assert.equal(S.gameOver(ended), true);
  assert.equal(handicaps(ended).ann, 10, "Episodes 1 and 2, not the reunion after the finale");
  // Outlast's points (the boot order) and a handicap's add up the same way.
  const outlast = league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, rank: { by: "total", handicap: FIVE } });
  S.addElimination(outlast, ep(outlast, 1).id, cid(outlast, 3), "Voted Out");
  const o = rows(outlast);
  assert.equal(o.find((r) => r.playerId === "ann").total, 3 * 2 + 5, "three still in after one boot (2 each), and the handicap");
  assert.equal(o.find((r) => r.playerId === "bo").total, 1 + 2 + 2);
});

test("with the rest of the engine: a race, the guillotine (someone out keeps theirs), head to head's weeks, teams of players", () => {
  // A race to 10: ann and di, new, are there after two episodes on the handicap alone; the game ends there.
  const race = league(best(FIVE, { by: "total", race: { to: 10 } }));
  points(race, 1, { bo: 5 });
  points(race, 2, { bo: 3 });
  assert.equal(S.KnockoutLogic.endsAt(race), 2);
  assert.deepEqual(S.KnockoutLogic.run(race).series.map((x) => [x.number, x.totals.get("ann"), x.totals.get("bo")]), [[1, 5, 5], [2, 10, 8]]);
  points(race, 3, { bo: 5 });
  assert.deepEqual(totals(race), { ann: 10, di: 10, bo: 8, cy: 0 }, "nothing after the race was won");
  // The guillotine every episode: the handicap keeps ann and di in on Episode 1 (cy goes). On Episode 3 ann and di tie on the night
  // (the handicap alone), and a night's tie goes to the total: ann, out after it, keeps what she had then.
  const cut = league(best(FIVE, { by: "standing", cut: [{ at: { every: 1 } }] }));
  points(cut, 1, { bo: 5, cy: 3 });
  assert.deepEqual([...S.KnockoutLogic.outs(cut)], [["cy", 1]]);
  points(cut, 2, { di: 3 });
  assert.deepEqual([...S.KnockoutLogic.outs(cut)].sort(), [["bo", 2], ["cy", 1]]);
  points(cut, 3, {});
  assert.deepEqual(S.KnockoutLogic.outs(cut).get("ann"), 3);
  assert.equal(S.KnockoutLogic.endsAt(cut), 3, "one left");
  points(cut, 4, { ann: 5 });
  const out = rows(cut).find((r) => r.playerId === "ann");
  assert.deepEqual([out.total, out.handicap, out.out], [15, 15, 3]);
  assert.deepEqual(rows(cut).map((r) => r.playerId), ["di", "ann", "bo", "cy"]);
  // Head to head: each week's points carry the handicap.
  const h2h = league(best(FIVE, { by: "matchups" }));
  points(h2h, 1, { bo: 3, cy: 2 });
  const week = S.MatchupLogic.run(h2h).weeks[0];
  const pts = Object.fromEntries(week.games.flatMap((g) => [[g.a, g.aPoints], [g.b, g.bPoints]]));
  assert.deepEqual(pts, { ann: 5, bo: 3, cy: 2, di: 5 });
  // Teams of players, summed: a newcomer's handicap is their team's.
  const teams = league(best(FIVE, { by: "total", teams: { of: 2, made: "choose", score: "sum" } }));
  S.TeamLogic.settle(teams);
  for (const [p, t] of Object.entries({ ann: "t1", bo: "t1", cy: "t2", di: "t2" })) S.TeamLogic.choose(teams, p, t);
  points(teams, 1, { bo: 3, cy: 2 });
  S.TeamLogic.settle(teams);
  assert.deepEqual(Object.fromEntries(S.TeamLogic.standings(teams, rows(teams)).map((t) => [t.id, t.points])), { t1: 8, t2: 7 });
});

test("a game of questions: the walk adds it episode by episode, hands it over, and freezes it for someone knocked out", () => {
  const make = (rank, more) => {
    const s = S.defaultState();
    S.ensureNextEpisode(s);
    S.updateSettings(s, "showId", "survivor");
    S.updateSettings(s, "leagueTypeId", "questions");
    for (let i = 0; i < 8; i++) S.addCastaway(s, `C${i}`);
    s.players = PLAYERS.map((id) => ({ id, name: id, color: "#000" }));
    S.updateSettings(s, "setupComplete", true);
    assert.deepEqual(S.setGame(s, questions(rank, more), { ctx: CTX }), []);
    s.seatHistory = structuredClone(HISTORY);
    S.addElimination(s, S.ensureEpisodeNumber(s, 1, false).id, cid(s, 0), "Voted Out");
    S.addElimination(s, S.ensureEpisodeNumber(s, 2, false).id, cid(s, 1), "Voted Out");
    return s;
  };
  const said = (s, n, by) => Object.entries(by).map(([playerId, i]) => ({ playerId, question: "boot", episode: n, answer: cid(s, i) }));
  const s = make({ by: "total", handicap: FIVE });
  const answersOf = (x) => [...said(x, 1, { ann: 3, bo: 0, cy: 0, di: 3 }), ...said(x, 2, { ann: 1, bo: 1, cy: 3, di: 3 })];
  const answers = answersOf(s);
  const w = S.AnswerLogic.walk(s, answers, S.AnswerLogic.facts(s));
  assert.deepEqual(w.totals, { ann: 11, bo: 2, cy: 1, di: 10 });
  assert.deepEqual(w.handicap, { ann: 10, bo: 0, cy: 0, di: 10 });
  const v = S.AnswerLogic.withWalk(s, w);
  assert.deepEqual(rows(v).map((r) => [r.playerId, r.total, r.handicap]), [["ann", 11, 10], ["di", 10, 10], ["bo", 2, 0], ["cy", 1, 0]]);
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  assert.deepEqual(tableOf(v, "ann", (p) => p, (p) => w.totals[p]).map((r) => [r.playerId, r.total, r.handicap]), [["ann", 11, 10], ["di", 10, 10], ["bo", 2, 0], ["cy", 1, 0]]);
  // In teams: the walk's episodes carry it too.
  const t = make({ by: "total", handicap: FIVE, teams: { of: 2 } });
  const wt = S.AnswerLogic.walk(t, answersOf(t), S.AnswerLogic.facts(t));
  assert.deepEqual(wt.series.map((x) => [x.number, x.totals.ann, x.totals.bo]), [[1, 5, 1], [2, 11, 2]]);
  // A life each: ann is wrong at Episode 1 and out, her handicap frozen there (5) while di's goes on.
  const lives = make({ by: "standing", handicap: FIVE }, { score: { lives: 1 } });
  const wl = S.AnswerLogic.walk(lives, answersOf(lives), S.AnswerLogic.facts(lives));
  assert.equal(wl.out.ann, 1);
  assert.deepEqual([wl.totals.ann, wl.handicap.ann, wl.totals.bo, wl.handicap.bo], [5, 5, 2, 0], "bo, right both nights, plays on");
  assert.deepEqual([wl.out.di, wl.totals.di, wl.handicap.di], [1, 5, 5], "di, wrong at Episode 1 too, out with ann, frozen there");
  // Without the walk (a reader not taught it), nobody has points: the safe fallback.
  assert.deepEqual(rows(s).map((r) => r.handicap), [undefined, undefined, undefined, undefined]);
});

test("the couch: a newcomer's handicap is in the points the couch's standings read", () => {
  const s = league(best(FIVE));
  points(s, 1, { bo: 3 });
  const { tableOf } = jiti("../src/lib/game/game-view.ts");
  const { headToHead } = jiti("../src/lib/game/couch-standings.ts");
  const standingRows = tableOf(s, "ann", (p) => `u-${p}`).map((r) => ({ userId: r.userId, name: r.name, place: r.place, rank: r.rank, total: r.total, seat: r.playerId }));
  assert.deepEqual(standingRows.map((r) => [r.userId, r.place, r.total]), [["u-ann", 1, 5], ["u-di", 1, 5], ["u-bo", 3, 3], ["u-cy", 4, 0]]);
  const game = { leagueId: "l1", name: "L", gameName: "Weekly Lineup", gameType: "active-roster", seasonId: "s1", showId: "sh", showName: "Survivor", label: "Survivor 51", artUrl: null, year: 2026, through: 1, ended: false, rows: standingRows, before: null };
  const people = PLAYERS.map((p) => ({ userId: `u-${p}`, name: p }));
  // Power rankings are Couch points since 2026-10-31; head to head reads the places, handicap and all: ann and di both beat bo.
  const h2h = headToHead([game], people, "u-bo");
  assert.deepEqual(h2h.map((h) => [h.userId, h.won, h.lost]).sort(), [["u-ann", 0, 1], ["u-cy", 1, 0], ["u-di", 0, 1]]);
});
