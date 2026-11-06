// The week as a result (docs/PLAN-start-a-game-gpt.md track C, C5): a pick each episode scored by what they do (get.by pick, each
// 1 to MAX_PICKS, score.by moments), only these moments counting (score.only) and hits counted (score.hits: every, per pick, per
// objective), and weeks won (rank.by weeks, rank.ties) wherever head to head plays. Their shape, words and settings, the picks
// themselves, the scoring and each week's winner on made-up seasons whose every number is worked out by hand below, weeks won on a
// pool and between teams, and the bots' picks. The user's third game (tracker row p12). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");

const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "rewardWin", label: "Won reward", defaultPoints: 1, answeredBy: "research" },
  ],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [{ id: "premerge" }, { id: "merged" }],
};
const ats = (problems) => problems.map((p) => p.at);
const OBJECTIVES = ["individualImmunity", "idolFound"];
/** The user's third game, x = 2: two picks each episode, only immunity and idols counting, each a hit, weeks won. */
const game = (hits = "pick", rank = { by: "weeks" }, more = {}) => ({
  get: { by: "pick", each: 2 }, count: { pick: true }, score: { by: "moments", points: null, only: OBJECTIVES, hits, ...more }, rank,
});
const WORDS = { show: "Survivor 51", castaway: "castaway", moments: CTX.moments };

function league(spec, ids = ["ann", "bo", "cy"], n = 8) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = ids.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= 4; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const pick = (s, n, p, idx) => S.setPickEmPick(s, ep(s, n).id, p, cid(s, idx[0]), { picks: idx.map((i) => cid(s, i)) });
const picked = (s, n, p) => S.PickEmLogic.picked(S.PickEmLogic.pickFor(s, ep(s, n).id, p)).map((id) => s.castaways.findIndex((c) => c.id === id));
const ev = (s, n, type, i) => S.ActiveRosterLogic.addEvent(s, ep(s, n).id, type, cid(s, i));
const out = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
/**
 * The season (only immunity and idols count; a reward is no objective):
 *   Ep 1: C0 immunity, idol, idol; C1 idol; C2 reward; C3 idol. C7 out.
 *         ann C0 C1: per pick C0 2 + C1 1 = 3; per objective 2 (immunity, idol); every hit 3 + 1 = 4
 *         bo  C0 C2: per pick 2;                per objective 2;                    every hit 3
 *         cy  C3 C2: per pick 1;                per objective 1;                    every hit 1
 *   Ep 2: C1 immunity; C2 idol. C6 out.
 *         ann C2 C3: 1 (idol)   bo C1 C0: 1 (immunity)   cy C0 C1: 1 (immunity)     every way
 *   Ep 3: nothing that counts (C4 a reward). C5 out.
 *         ann C4, bo C4, cy C3: 0 each: a week nobody scores in, nobody wins.
 * Per pick:      ann 3 1 0 = 4, bo 2 1 0 = 3, cy 1 1 0 = 2; week 1 ann, week 2 all three: ann 2, bo 1, cy 1 (bo ahead on points).
 * Per objective: ann 2 1 0 = 3, bo 3, cy 2; week 1 ann and bo (tied), week 2 all three: ann 2, bo 2, cy 1.
 * Every hit:     ann 4 1 0 = 5, bo 4, cy 2; week 1 ann, week 2 all three: ann 2, bo 1, cy 1.
 */
function season(s) {
  pick(s, 1, "ann", [0, 1]); pick(s, 1, "bo", [0, 2]); pick(s, 1, "cy", [3, 2]);
  ev(s, 1, "individualImmunity", 0); ev(s, 1, "idolFound", 0); ev(s, 1, "idolFound", 0); ev(s, 1, "idolFound", 1); ev(s, 1, "rewardWin", 2); ev(s, 1, "idolFound", 3);
  out(s, 1, 7);
  pick(s, 2, "ann", [2, 3]); pick(s, 2, "bo", [1, 0]); pick(s, 2, "cy", [0, 1]);
  ev(s, 2, "individualImmunity", 1); ev(s, 2, "idolFound", 2);
  out(s, 2, 6);
  pick(s, 3, "ann", [4]); pick(s, 3, "bo", [4]); pick(s, 3, "cy", [3]);
  ev(s, 3, "rewardWin", 4);
  out(s, 3, 5);
  return s;
}
const table = (s) => S.computeScores(s).map((r) => [r.playerId, r.total, r.weeks ? r.weeks.won : null]);

test("a pick of several scored by what they do, only these moments, hits and weeks won: their shape, words and settings", () => {
  const at = (spec) => ats(G.specProblems(spec, CTX));
  const g = game();
  assert.deepEqual(at(g), []);
  assert.equal(G.typeOf(g), "pickem");
  // A pick scored by moments repeats freely unless it says; a pool still cycles.
  assert.deepEqual(G.fullSpec(g).get, { by: "pick", each: 2, repeat: "any" });
  assert.equal(G.fullSpec(G.PRESETS["survival-pool"]).get.repeat, "cycle");
  assert.deepEqual(G.weekParts(G.fullSpec(g)), { ties: "all" });
  assert.deepEqual(G.weekParts(G.fullSpec(game("pick", { by: "weeks", ties: "split" }))), { ties: "split" });
  assert.equal(G.flagsOf(G.fullSpec(g)).hasWeeks, true);
  assert.equal(G.flagsOf(G.fullSpec(g)).hasWeeklyPicks, true);
  // Refused, each with its own words.
  assert.deepEqual(at({ ...G.PRESETS["survival-pool"], get: { by: "pick", each: 2, repeat: "cycle" } }), ["get.each"]);
  assert.deepEqual(at({ ...g, get: { by: "pick", each: G.MAX_PICKS + 1 } }), ["get.each"]);
  assert.deepEqual(at({ ...g, score: { ...g.score, only: [] } }), ["score.only"]);
  assert.deepEqual(at({ ...g, score: { ...g.score, only: ["idolFound", "idolFound"] } }), ["score.only"]);
  assert.deepEqual(at({ ...g, score: { ...g.score, only: ["crying"] } }), ["score.only[0]"]);
  assert.deepEqual(at({ ...g, score: { ...g.score, hits: "most" } }), ["score.hits"]);
  assert.deepEqual(at({ ...G.PRESETS["weekly-lineup"], score: { by: "moments", points: null, captain: { times: 2 }, hits: "objective" } }), ["score.hits"]);
  assert.deepEqual(at({ ...G.PRESETS["weekly-lineup"], count: { best: 3 }, score: { by: "moments", points: null, hits: "objective" } }), ["score.hits"]);
  assert.deepEqual(at({ ...G.PRESETS["weekly-calls"], rank: { by: "weeks" } }), ["rank.by"]);
  // A race is refused twice over: a race ranks by its points (or last one standing), and weeks won ranks by the weeks.
  assert.deepEqual(at({ ...G.PRESETS.outlast, rank: { by: "weeks", race: { to: 20 } } }), ["rank.race", "rank.by"]);
  assert.deepEqual(at({ ...G.PRESETS.outlast, rank: { by: "total", ties: "all" } }), ["rank.ties"]);
  assert.deepEqual(at({ ...g, rank: { by: "weeks", ties: "half" } }), ["rank.ties"]);
  // Knocking players out isn't a pick's yet; nor questions beside it (a stage alongside, as beside a pool).
  assert.match(G.specWaitsFor({ ...g, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] } }).map((w) => w.problem).join(" ") + at({ ...g, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] } }).join(" "), /rank/);
  assert.equal(G.typeOf({ ...g, ask: G.finaleQuestions({ top3: 1, winner: 3, from: "any" }) }), null);
  // Weeks won wherever head to head plays: a draft, a game of questions, a pool by its points.
  assert.equal(G.typeOf({ ...G.PRESETS.outlast, rank: { by: "weeks" } }), "classic-draft");
  assert.equal(G.typeOf({ ...G.PRESETS["weekly-lineup"], rank: { by: "weeks", teams: { of: 2 } } }), "active-roster");
  assert.equal(G.typeOf({ ...G.PRESETS["survival-pool"], rank: { by: "weeks" } }), "pickem");
  assert.equal(G.typeOf({ ...G.PRESETS["survival-pool"], score: { by: "survive", means: "staysIn", points: 1, lives: 2 }, rank: { by: "weeks" } }), null);

  // The words.
  const d = G.describeSpec(g, WORDS);
  assert.equal(d.sentence, "A game for Survivor 51: everyone picks two castaways each episode, all season. Scored by Survivor 51's rules. Only two moments count: won immunity and found an idol. Each is an objective: a point for each one each of your castaways hits, once each however often they do it. Each episode, the one with the most points wins it; most episodes won wins.");
  assert.ok(d.rules.includes("No draft. Before each episode, pick two castaways still in: each scores what they do in it."));
  assert.ok(d.rules.includes("Each episode, whoever has the most points in it wins it. Tied for the most, each of you wins it."));
  assert.ok(d.rules.includes("An episode nobody scores in goes to nobody."));
  assert.ok(d.rules.includes("Most episodes won wins the game; a tie goes to the most points."));
  assert.match(G.describeSpec(game("objective"), WORDS).sentence, /a point for each one any of your castaways hits, once however many of them do\./);
  assert.match(G.describeSpec(game("every", { by: "weeks", ties: "none" }), WORDS).sentence, /Each time one happens is a hit, worth a point\..*the one with the most points wins it \(tied, nobody does\)/);
  assert.match(G.describeSpec({ ...G.PRESETS["survival-pool"], rank: { by: "weeks" } }, WORDS).sentence, /A point for each right pick\. Each episode, the one with the most points wins it; most episodes won wins\.$/);

  // The settings, both ways: what a league stores and reads back (the flag off), and a stored spec without any of it as before.
  for (const spec of [g, game("every", { by: "weeks", ties: "split" }, { times: [{ times: 2, finale: true }] }), { ...g, get: { by: "pick", each: 1, repeat: "never" }, rank: { by: "total" } },
    { ...G.PRESETS["weekly-lineup"], score: { by: "moments", points: null, only: ["idolFound"], hits: "every" }, rank: { by: "weeks", ties: "none" } },
    { ...G.PRESETS["survival-pool"], rank: { by: "weeks", ties: "split" } }, { ...G.PRESETS.outlast, rank: { by: "weeks" } }]) {
    const st = G.settingsOf(spec, CTX);
    assert.ok(st, JSON.stringify(spec));
    assert.deepEqual(G.specOf({ ...st, showId: "survivor" }).get, G.fullSpec(spec).get);
    assert.deepEqual(G.specOf({ ...st, showId: "survivor" }).score, G.fullSpec(spec).score);
    assert.deepEqual(G.specOf({ ...st, showId: "survivor" }).rank, G.fullSpec(spec).rank);
  }
  assert.equal(G.settingsOf(g, CTX).poolScore, "moments");
  assert.equal(G.settingsOf(g, CTX).poolEach, 2);
  assert.equal(G.settingsOf(G.PRESETS["survival-pool"], CTX).poolEach, undefined);
  assert.equal(G.settingsOf(G.PRESETS["survival-pool"], CTX).poolScore, undefined);
  assert.equal(G.settingsOf(G.PRESETS["survival-pool"], CTX).poolRepeat, undefined);
});

test("several picks each episode: the whole set at once, one added while there's room, one taken back; anyone still in", () => {
  const s = league(game());
  const id = (i) => cid(s, i);
  pick(s, 1, "ann", [0, 1]);
  assert.deepEqual(picked(s, 1, "ann"), [0, 1]);
  // Stored as before for the first, the rest after it.
  assert.deepEqual(S.PickEmLogic.pickFor(s, ep(s, 1).id, "ann"), { playerId: "ann", castawayId: id(0), more: [id(1)] });
  // Too many, twice the same, or someone out: nothing changes.
  pick(s, 1, "ann", [2, 3, 4]);
  pick(s, 1, "ann", [2, 2]);
  assert.deepEqual(picked(s, 1, "ann"), [0, 1]);
  // One at a time: added while there's room, then nothing.
  S.setPickEmPick(s, ep(s, 1).id, "bo", id(3));
  S.setPickEmPick(s, ep(s, 1).id, "bo", id(3));
  S.setPickEmPick(s, ep(s, 1).id, "bo", id(4));
  S.setPickEmPick(s, ep(s, 1).id, "bo", id(5));
  assert.deepEqual(picked(s, 1, "bo"), [3, 4]);
  // One taken back, the rest kept; the last one taken back clears the pick.
  S.removePickEmPick(s, ep(s, 1).id, "bo", { castawayId: id(3) });
  assert.deepEqual(S.PickEmLogic.pickFor(s, ep(s, 1).id, "bo"), { playerId: "bo", castawayId: id(4) });
  S.removePickEmPick(s, ep(s, 1).id, "bo", { castawayId: id(4) });
  assert.equal(S.PickEmLogic.pickFor(s, ep(s, 1).id, "bo"), null);
  // Anyone still in, every episode (repeat any): the same two again.
  out(s, 1, 7);
  assert.deepEqual(S.PickEmLogic.eligibility(s, ep(s, 2).id, "ann").available.length, 7);
  pick(s, 2, "ann", [0, 1]);
  assert.deepEqual(picked(s, 2, "ann"), [0, 1]);
  // Decided once the episode has results; nothing changes after.
  assert.equal(S.PickEmLogic.decided(ep(s, 1), s), true);
  pick(s, 1, "ann", [2, 3]);
  assert.deepEqual(picked(s, 1, "ann"), [0, 1]);
  // A pick that cycles: last episode's two can't be picked straight away.
  const c = league({ ...game(), get: { by: "pick", each: 2, repeat: "cycle" } });
  pick(c, 1, "ann", [0, 1]);
  out(c, 1, 7);
  const e = S.PickEmLogic.eligibility(c, ep(c, 2).id, "ann");
  assert.deepEqual(Object.keys(e.blocked).sort(), [cid(c, 0), cid(c, 1)].sort());
  assert.equal(e.available.length, 5);
});

test("scored by what they do: only these moments, hits per pick, per objective or every time; weeks won and its ties", () => {
  const per = season(league(game("pick")));
  assert.deepEqual(table(per), [["ann", 4, 2], ["bo", 3, 1], ["cy", 2, 1]]);
  assert.deepEqual(S.WeekLogic.run(per).weeks.map((w) => [w.number, w.winners, w.top]), [[1, ["ann"], 3], [2, ["ann", "bo", "cy"], 1], [3, [], 0]]);
  assert.deepEqual(table(season(league(game("objective")))), [["ann", 3, 2], ["bo", 3, 2], ["cy", 2, 1]]);
  assert.deepEqual(table(season(league(game("every")))), [["ann", 5, 2], ["bo", 4, 1], ["cy", 2, 1]]);
  // Points as the rulebook has them, only immunity and idols (no hits): ann 3 + 2 + 2 + 2 = 9 then 2, bo 3 + 2 + 2 = 7 then 3, cy 2
  // then 3. Week 1 ann; week 2 bo and cy tied at 3: a week each, then the points.
  const pts = season(league({ ...game(), score: { by: "moments", points: null, only: OBJECTIVES } }));
  assert.deepEqual(table(pts), [["ann", 11, 1], ["bo", 10, 1], ["cy", 5, 1]]);
  // Hits with no list: every moment the game scores is an objective, worth a point whatever its points (a reward scored 0 isn't
  // one): the same as only immunity and idols, per pick.
  const all = season(league({ ...game(), score: { by: "moments", points: { rewardWin: 0, individualImmunity: 5 }, hits: "pick" } }));
  assert.deepEqual(table(all), [["ann", 4, 2], ["bo", 3, 1], ["cy", 2, 1]]);
  // Ties: split shares the weeks (week 1 ann and bo half each, week 2 a third each); none gives tied weeks to nobody.
  const split = season(league(game("objective", { by: "weeks", ties: "split" })));
  assert.deepEqual(table(split), [["ann", 3, 0.83], ["bo", 3, 0.83], ["cy", 2, 0.33]]);
  const none = season(league(game("objective", { by: "weeks", ties: "none" })));
  assert.deepEqual(table(none), [["ann", 3, 0], ["bo", 3, 0], ["cy", 2, 0]]);
  // Ranked by its points instead, the same lines (per pick).
  assert.deepEqual(table(season(league(game("pick", { by: "total" })))), [["ann", 4, null], ["bo", 3, null], ["cy", 2, null]]);
  // Head to head plays on it too: three of you, a round robin; it reads the same series of totals.
  const h2h = season(league(game("pick", { by: "matchups", odd: "bye" })));
  assert.ok(S.computeScores(h2h).every((r) => r.matchups));
});

test("weeks won on a pool by its points, and between teams of players", () => {
  // A pool: each right pick a point. Ep 1 C9 out: ann C0, bo C9, cy C1 -> ann, cy. Ep 2 C8 out: ann C1, bo C2, cy C8 -> ann, bo.
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { ...G.PRESETS["survival-pool"], rank: { by: "weeks" } }, { ctx: CTX }), []);
  for (let k = 1; k <= 3; k++) S.ensureEpisodeNumber(s, k, false);
  const p = (n, who) => Object.entries(who).forEach(([pl, i]) => S.setPickEmPick(s, ep(s, n).id, pl, cid(s, i)));
  p(1, { ann: 0, bo: 9, cy: 1 });
  out(s, 1, 9);
  p(2, { ann: 1, bo: 2, cy: 8 });
  out(s, 2, 8);
  // ann 2 right picks and both weeks; bo and cy a point and a week each (level, in either order).
  assert.deepEqual(table(s)[0], ["ann", 2, 2]);
  assert.deepEqual(table(s).slice(1).sort(), [["bo", 1, 1], ["cy", 1, 1]]);
  assert.deepEqual(S.WeekLogic.run(s).weeks.map((w) => w.winners), [["ann", "cy"], ["ann", "bo"]]);

  // Teams of players (summed) on the pick of several, per pick: team A ann + cy, team B bo, chosen. Week 1: A 3 + 1 = 4, B 2: A.
  // Week 2: A 1 + 1 = 2, B 1: A. Week 3: nobody. A wins both; every member shares the team's weeks.
  const t = league(game("pick", { by: "weeks", teams: { of: 2, made: "choose", score: "sum", names: ["A", "B"] } }));
  S.TeamLogic.choose(t, "ann", "t1");
  S.TeamLogic.choose(t, "cy", "t1");
  S.TeamLogic.choose(t, "bo", "t2");
  season(t);
  const rows = S.computeScores(t);
  assert.deepEqual(rows.map((r) => [r.playerId, r.weeks && r.weeks.won]), [["ann", 2], ["cy", 2], ["bo", 0]]);
});

test("the bots pick as many as the game does, whoever looks likeliest to score", () => {
  const s = league(game());
  s.players.push({ id: "bot1", name: "Bot", color: "#000", automated: true });
  const made = Bots.run(s);
  const mine = S.PickEmLogic.picked(S.PickEmLogic.pickFor(s, ep(s, 1).id, "bot1"));
  assert.ok(made >= 1, "a bot made its pick");
  assert.equal(mine.length, 2);
  assert.equal(new Set(mine).size, 2);
});

test("weeks won on a game of questions: each episode's points what its answers settled then add, a week waiting for full results", () => {
  const CTXQ = { ...CTX, calls: "results" };
  const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const IMMUNE = { id: "immune", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy", "di"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT, IMMUNE], rank: { by: "weeks" } }, { ctx: CTXQ }), []);
  const e = (n) => S.ensureEpisodeNumber(s, n, false);
  const said = (q, n, by) => Object.entries(by).map(([playerId, i]) => ({ playerId, question: q, episode: n, answer: cid(s, i) }));
  // Episode 1: C0 goes, C4 wins immunity: ann 1 + 2, cy 1, di 2: ann's week. Episode 2: C1 goes, C5 wins it: bo 1, di 1, cy 2: cy's.
  S.addElimination(s, e(1).id, cid(s, 0), "Voted Out");
  S.addScoringEvent(s, e(1).id, "individualImmunity", cid(s, 4));
  S.addElimination(s, e(2).id, cid(s, 1), "Voted Out");
  S.addScoringEvent(s, e(2).id, "individualImmunity", cid(s, 5));
  const rows = [...said("boot", 1, { ann: 0, bo: 1, cy: 0 }), ...said("immune", 1, { ann: 4, di: 4 }), ...said("boot", 2, { bo: 1, di: 1 }), ...said("immune", 2, { cy: 5, ann: 6 })];
  const A = S.AnswerLogic;
  const w = A.walk(s, rows, A.facts(s));
  assert.deepEqual(w.series, [{ number: 1, totals: { ann: 3, cy: 1, di: 2 } }, { number: 2, totals: { ann: 3, cy: 3, di: 3, bo: 1 } }]);
  const v = A.withWalk(s, w);
  assert.deepEqual(S.WeekLogic.run(v).weeks.map((x) => x.winners), [["ann"], ["cy"]]);
  // ann and cy a week each and 3 points; di 3 points, no week; bo 1.
  assert.deepEqual(S.computeScores(v).map((r) => [r.playerId, r.total, r.weeks.won]), [["ann", 3, 1], ["cy", 3, 1], ["di", 3, 0], ["bo", 1, 0]]);
  // Episode 2's results still early: its week waits (the walk stops before it), so only ann's week counts.
  S.EpisodeLogic.setResultsStage(s, e(2).id, "early");
  const early = A.withWalk(s, A.walk(s, rows, A.facts(s)));
  assert.deepEqual(S.WeekLogic.run(early).weeks.map((x) => x.winners), [["ann"]]);
});

test("the code review's catches: a penalty is no objective, hits per pick beside group slots, a cycle of several, a cleared pick, split weeks", () => {
  // A hit is worth 1 whatever its points, but a moment the game scores below 0 is no objective (unless `only` names it).
  assert.equal(G.momentWorth({ hits: "every" }, "satOut", -0.5), 0);
  assert.equal(G.momentWorth({ hits: "every" }, "idolFound", 2), 1);
  assert.equal(G.momentWorth({ hits: "every", only: ["satOut"] }, "satOut", -0.5), 1);
  assert.equal(G.momentWorth({ points: { idolFound: 5 } }, "idolFound", 2), 5);
  assert.equal(G.momentWorth({ only: ["idolFound"] }, "satOut", -0.5), 0);
  // A group slot's group counts every hit: per pick or per objective is refused beside it.
  const slots = { ...G.PRESETS["weekly-lineup"], get: { ...G.PRESETS["weekly-lineup"].get, groups: { slots: 1 } } };
  assert.deepEqual(ats(G.specProblems({ ...slots, score: { by: "moments", points: null, hits: "pick" } })), ["score.hits"]);
  assert.deepEqual(ats(G.specProblems({ ...slots, score: { by: "moments", points: null, hits: "every" } })), []);
  // A moment `only` names that data can't settle: pointed at the list, not at its points.
  const couch = { ...CTX, moments: [...CTX.moments, { id: "cried", label: "Cried", defaultPoints: 0, answeredBy: "couch" }] };
  const p = G.specProblems({ ...game(), score: { by: "moments", points: null, only: ["cried"], hits: "pick" } }, couch);
  assert.deepEqual(ats(p), ["score.only[0]"]);
  assert.match(p[0].problem, /Take it out of the moments that count/);
  // A cycle of two: with three still in after two picked last week, back to back lets go so two can be picked.
  const c = league({ ...game(), get: { by: "pick", each: 2, repeat: "cycle" } }, ["ann"], 5);
  pick(c, 1, "ann", [0, 1]);
  out(c, 1, 4); out(c, 1, 3);
  assert.deepEqual(picked(c, 1, "ann"), [0, 1]);
  const e = S.PickEmLogic.eligibility(c, ep(c, 2).id, "ann");
  assert.deepEqual(e.available.length, 3);
  assert.deepEqual(e.blocked, {});
  pick(c, 2, "ann", [2, 0]);
  assert.deepEqual(picked(c, 2, "ann"), [2, 0]);
  // A whole pick can't be cleared once its episode has results (it would take back what it scored).
  const s = season(league(game()));
  S.removePickEmPick(s, ep(s, 1).id, "ann");
  assert.deepEqual(picked(s, 1, "ann"), [0, 1]);
  // Three-way ties split three times add up to a whole week.
  const Seq = require("../src/lib/game/sequence/index.js");
  const series = [1, 2, 3].map((n) => ({ number: n, totals: new Map(["a", "b", "c"].map((id) => [id, n])) }));
  assert.equal(Seq.weeks(series, { ties: "split", seatsAt: () => ["a", "b", "c"] }).won.get("a"), 1);
  // A pool that repeats freely says so.
  assert.ok(G.describeSpec({ ...G.PRESETS["survival-pool"], get: { by: "pick", each: 1, repeat: "any" } }, WORDS).rules.includes("Pick anyone still in, every episode: the same castaway as last time too."));
});
