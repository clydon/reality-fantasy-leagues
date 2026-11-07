// L3 part 2 (docs/PLAN-start-a-game-gpt.md track L): the engine's hook for a game scored by a sport's stats. The server stamps each
// final game's kept lines on the copy of the league it reads (StateLogic.StatsLogic.stamp: src/lib/server/sports/score.ts
// stampStats), never stored; the scoring sequence's step 2 reads them as each holding's moments (sequence/stats.js statMoments),
// so a lineup's starters, a captain, the episode's multiplier, best ball's best n and everyone drafted count them as a show's
// moments count. On the recorded 76ers opener (tests/fixtures/espn/nba-401909093.json) kept as the server keeps it: each seat's
// points are the phone's scorer's on the same lines. Part 2c: a game of questions on the sports settles (each sport's pick'em and
// pick a few), its episode's results once its game is final (the stamp's ep.gameFinal), graded on the server's facts.games. Run
// with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, defaultsFor, specContextOf, storedGame, storedFacts, renamed } = jiti("../src/lib/sports/index.ts");
const { statLine, cents } = require("../src/lib/game/sequence/stats.js");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const SIXERS = require("./fixtures/espn/nba-401909093.json");
const nba = sportOf("basketball/nba");
const CTX = specContextOf(nba);
const POINTS = defaultsFor("basketball").specs.season.spec.score.points;
// The opener as the server keeps it (read back as saved), and its six biggest scorers: ann drafts the 76ers', bo the Cavaliers'.
const kept = JSON.parse(JSON.stringify(storedGame(nba, SIXERS)));
const byName = new Map(Object.keys(kept.people).map((id) => [nba.readBox(SIXERS).people[id]?.name, id]));
const phoneOf = (athlete) => statLine({ by: "stats", points: POINTS }, nba.full(kept.lines[athlete])).points;
const box = nba.readBox(SIXERS);
/** Each team's three with the most points at the table (the 76ers are "20"). */
const threeOf = (team) => Object.keys(kept.lines).filter((id) => kept.people[id]?.team === team)
  .sort((a, b) => phoneOf(b) - phoneOf(a)).slice(0, 3).map((id) => box.people[id].name);
const SIXERS_THREE = threeOf("20");
const CAVS_THREE = threeOf("5");

/** A league of the six (ann holding the 76ers' three, bo the Cavaliers'), its game `spec` (the NBA's table) written through setGame
 *  with the sport's ctx; Episodes 1 and 2 made, none with results. */
function league(spec, ctx = CTX) {
  const s = S.defaultState();
  for (const name of [...SIXERS_THREE, ...CAVS_THREE]) S.addCastaway(s, name);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [i < 3 ? "ann" : "bo"]; });
  for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const base = (more) => ({
  spec: 1, span: { from: 1, to: null }, pool: { of: "cast", where: null }, get: { by: "draft", each: 3, order: "snake", own: "exclusive" },
  count: { start: 2 }, score: { by: "stats", points: POINTS }, rank: { by: "total" }, closes: "start", ...more,
});
const LINEUP = base();
const CAPTAIN = base({ score: { by: "stats", points: POINTS, captain: { times: 2 } } });
const BEST = base({ count: { best: 2 } });
const ALL = base({ count: { all: true } });
const cid = (s, name) => s.castaways.find((c) => c.name === name).id;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const score = (s, who) => S.computeScores(s).find((r) => r.playerId === who).total;
/** The opener's lines in the league's people (as stampStats hands them over: castaway id to counts, derived stats worked out),
 *  with someone the cast hasn't got left under the provider's id. */
const linesIn = (s) => Object.fromEntries(Object.entries(kept.lines).map(([athlete, l]) => {
  const name = nba.readBox(SIXERS).people[athlete]?.name;
  const c = s.castaways.find((x) => x.name === name);
  return [c ? c.id : `espn:${athlete}`, nba.full(l)];
}));
/** Each of the six's points on the opener at the table, as the phone's scorer gives them. */
const phone = (name) => phoneOf(byName.get(name));

test("a lineup scored by stats: places in the sequence as a lineup of moments does, and plays", () => {
  for (const spec of [LINEUP, CAPTAIN, BEST, ALL, base({ score: { by: "stats", points: POINTS, times: [{ episode: 2, times: 2 }] } })]) {
    assert.deepEqual(G.specProblems(spec, CTX), [], JSON.stringify(spec.count));
    assert.deepEqual(G.specWaitsFor(spec), [], "it plays now");
    assert.equal(G.typeOf(spec), "active-roster");
  }
  // A captain only on a lineup, as a show's; a stock market's prices are moments'; a pick each episode by its stats has no place
  // yet.
  assert.deepEqual(G.specProblems({ ...BEST, score: { ...CAPTAIN.score } }, CTX).map((p) => p.at), ["score.captain"]);
  assert.equal(G.specWaitsFor(base({ get: { by: "pick", each: 1, repeat: "cycle" }, count: { pick: true } })).length, 1);
  // (Categories play since part 2d: below.)
  assert.equal(G.flagsOf(G.fullSpec(LINEUP)).hasActiveRoster, true);
  // A league's settings say it (statScoring, its table; countAll, everyone drafted counting) and read it back, the cast still in
  // as a show's is (nobody leaves a sport's).
  for (const spec of [CAPTAIN, BEST, ALL, base({ score: { by: "stats", points: POINTS, byPosition: { PTS: { C: 2 } }, times: [{ episode: 2, times: 2 }] } })]) {
    const st = G.withSpec(S.defaultState().settings, spec);
    assert.deepEqual(G.specOf(st), { ...G.fullSpec(spec), preset: "weekly-lineup", pool: { of: "cast", where: { stillIn: true } } }, JSON.stringify(spec.count));
    assert.equal(st.eventPoints, undefined);
  }
  assert.equal(G.flagsOf(G.fullSpec(BEST)).hasBestBall, true);
});

test("the stamp: each final episode's lines on the copy, the league's castaways only, results once they're in, never saved", () => {
  const s = league(LINEUP);
  const L = S.StatsLogic;
  assert.equal(L.on(s), true);
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), false);
  L.stamp(s, { lines: { 1: linesIn(s) }, groups: { [cid(s, SIXERS_THREE[1])]: "C", "espn:1": "G" } });
  assert.deepEqual(Object.keys(ep(s, 1).statLines).sort(), s.castaways.map((c) => c.id).sort(), "nobody the cast hasn't got");
  assert.deepEqual(s.statGroups, { [cid(s, SIXERS_THREE[1])]: "C" });
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), true, "the game's lines are its results");
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 2)), false);
  assert.equal(S.SpoilerLogic.latestWithResults(s), 1);
  // What a write saves leaves them out (db.ts's replacer), and unstamp takes them off.
  const keys = new Set(L.stampedKeys());
  const saved = JSON.parse(JSON.stringify(s, (k, v) => (keys.has(k) ? undefined : v)));
  assert.equal(saved.episodes.some((e) => e.statLines), false);
  assert.equal(saved.statGroups, undefined);
  L.unstamp(s);
  assert.equal(ep(s, 1).statLines, undefined);
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), false);
  // A show's game is never stats'.
  const show = S.defaultState();
  assert.equal(L.on(show), false);
});

test("a lineup by points per stat on the 76ers opener: the starters' stat lines at the table, a captain's doubled, the bench's not", () => {
  const s = league(CAPTAIN);
  const A = S.ActiveRosterLogic;
  const e1 = ep(s, 1).id;
  assert.equal(A.captainTimes(s), 2);
  assert.ok(A.setLineup(s, e1, "ann", [cid(s, SIXERS_THREE[0]), cid(s, SIXERS_THREE[1])]));
  assert.ok(A.setCaptain(s, e1, "ann", cid(s, SIXERS_THREE[0])));
  assert.ok(A.setLineup(s, e1, "bo", [cid(s, CAVS_THREE[0]), cid(s, CAVS_THREE[1])]));
  // Before the final's kept: nothing scored, the lineups still open.
  assert.equal(score(s, "ann"), 0);
  S.StatsLogic.stamp(s, { lines: { 1: linesIn(s) } });
  const ann = cents(2 * phone(SIXERS_THREE[0]) + phone(SIXERS_THREE[1]));
  const bo = cents(phone(CAVS_THREE[0]) + phone(CAVS_THREE[1]));
  assert.equal(SIXERS_THREE[0], "Tyrese Maxey", "Maxey's 32 points and the rest the most");
  assert.equal(score(s, "ann"), ann);
  assert.equal(score(s, "bo"), bo);
  assert.equal(A.setCaptain(s, e1, "ann", cid(s, SIXERS_THREE[1])), false, "locked once its results are in");
  // The episode's lines as the screens read them: each holding's points, the captain's counted twice, the bench's not counted.
  const line = A.episodeScore(s, ep(s, 1), "ann");
  assert.deepEqual(line.lines.map((l) => [l.castawayId, l.points, l.captain, l.counted]), [
    [cid(s, SIXERS_THREE[0]), cents(2 * phone(SIXERS_THREE[0])), true, true],
    [cid(s, SIXERS_THREE[1]), phone(SIXERS_THREE[1]), false, true],
  ]);
  assert.deepEqual(S.StatsLogic.lineOf(s, ep(s, 1), cid(s, SIXERS_THREE[2])), statLine({ by: "stats", points: POINTS }, nba.full(kept.lines[byName.get(SIXERS_THREE[2])])));
  // Episode 2's game final too (a line by hand): the lineups carry, the captain with them.
  S.StatsLogic.stamp(s, { lines: { 1: linesIn(s), 2: { [cid(s, SIXERS_THREE[0])]: { PTS: 10 }, [cid(s, SIXERS_THREE[2])]: { PTS: 40 } } } });
  assert.equal(score(s, "ann"), cents(ann + 2 * 10));
  assert.equal(score(s, "bo"), bo);
});

test("the spoiler view and a span cut a game's stat lines as any result: past the mark, nothing scored", () => {
  const s = league(BEST);
  S.StatsLogic.stamp(s, { lines: { 1: linesIn(s), 2: { [cid(s, SIXERS_THREE[0])]: { PTS: 10 } } } });
  const both = score(s, "ann");
  const v = S.SpoilerLogic.viewThrough(s, 1);
  assert.equal(ep(v, 2).statLines, undefined);
  assert.equal(ep(v, 2).resultsHidden, true);
  assert.ok(ep(v, 1).statLines, "what they've seen stays");
  assert.equal(S.computeScores(v).find((r) => r.playerId === "ann").total, cents(both - 10));
  const none = S.GhostLogic.viewFor(s, "ann", 0);
  assert.equal(none.episodes.some((e) => e.statLines), false);
  assert.equal(S.computeScores(none).find((r) => r.playerId === "ann").total, 0);
  // A game over Episode 1 alone scores as it stood there.
  const one = league(base({ span: { from: 1, to: 1 }, count: { best: 2 } }));
  S.StatsLogic.stamp(one, { lines: { 1: linesIn(one), 2: { [cid(one, SIXERS_THREE[0])]: { PTS: 10 } } } });
  assert.equal(score(one, "ann"), cents(both - 10));
});

test("best ball, everyone drafted, and an episode's multiplier on stats", () => {
  const best = league(BEST);
  S.StatsLogic.stamp(best, { lines: { 1: linesIn(best) } });
  const top2 = (names) => cents(names.map(phone).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0));
  assert.equal(score(best, "ann"), top2(SIXERS_THREE), "the best two of the three, no lineups");
  assert.equal(score(best, "bo"), top2(CAVS_THREE));
  const all = league(ALL);
  S.StatsLogic.stamp(all, { lines: { 1: linesIn(all) } });
  assert.equal(score(all, "ann"), cents(SIXERS_THREE.map(phone).reduce((a, b) => a + b, 0)), "everyone drafted scores");
  assert.equal(S.ActiveRosterLogic.episodeScore(all, ep(all, 1), "ann").lines.every((l) => l.counted), true);
  const timed = league(base({ count: { best: 2 }, score: { by: "stats", points: POINTS, times: [{ episode: 1, times: 2 }] } }));
  S.StatsLogic.stamp(timed, { lines: { 1: linesIn(timed) } });
  assert.equal(S.ActiveRosterLogic.timesFor(timed, 1), 2);
  assert.equal(score(timed, "ann"), cents(2 * top2(SIXERS_THREE)));
});

test("a free agent's points so far are their stat lines' at the table (waivers take the best)", () => {
  const s = league(LINEUP);
  S.StatsLogic.stamp(s, { lines: { 1: linesIn(s), 2: { [cid(s, SIXERS_THREE[2])]: { PTS: 40 } } } });
  assert.equal(S.WaiverLogic.castawayPoints(s, cid(s, SIXERS_THREE[2])), cents(phone(SIXERS_THREE[2]) + 40));
  assert.equal(S.WaiverLogic.castawayPoints(s, cid(s, CAVS_THREE[1])), phone(CAVS_THREE[1]));
});

test("a card's bouts: each holding's bouts scored at their format's table (tennis's best of five), stamped with the lines", () => {
  const score = defaultsFor("tennis").specs.season.spec.score;
  const s = league(base({ count: { best: 2 }, score }), specContextOf(sportOf("tennis/atp")));
  const zed = s.castaways[0].id;
  const won = { MP: 1, GW: 18, GL: 9, SW: 3, SL: 0, W: 1, STR: 1 };
  // A best of five won in straight sets and a best of three: the line is their sum, each bout at its own format's points.
  const bouts = [{ id: "r1", format: 5, line: won }, { id: "r2", format: 3, line: won }];
  const line = Object.fromEntries(Object.keys(won).map((k) => [k, 2 * won[k]]));
  S.StatsLogic.stamp(s, { lines: { 1: { [zed]: line } }, bouts: { 1: { [zed]: bouts } } });
  const want = statLine(score, line, { bouts });
  assert.ok(want.points !== statLine(score, line).points, "the formats change the points");
  assert.deepEqual(S.StatsLogic.lineOf(s, ep(s, 1), zed), want);
  assert.equal(S.ActiveRosterLogic.episodeScore(s, ep(s, 1), "ann").lines.find((l) => l.castawayId === zed).points, want.points);
  assert.ok(S.SpoilerLogic.viewThrough(s, 0).episodes.every((e) => !e.statBouts), "cut with the lines");
});

test("a day's or a week's lock: each episode locks at its day's or week's first start (ep.locksAt), the hand overrides as before", () => {
  const s = league(base({ closes: "weekly" }));
  assert.deepEqual(G.specWaitsFor(G.gameOf(s.settings)), []);
  assert.equal(G.gameOf(s.settings).closes, "weekly", "the settings say it (lockCloses)");
  const e1 = ep(s, 1);
  const e2 = ep(s, 2);
  const T = Date.parse("2026-11-08T18:00:00Z");
  // Sunday's late game (Episode 2) locks with Thursday's (Episode 1), the week's first start.
  e1.airsAt = new Date(T - 3 * 86_400_000).toISOString();
  e2.airsAt = new Date(T).toISOString();
  e1.locksAt = e1.airsAt;
  e2.locksAt = e1.airsAt;
  const before = T - 3 * 86_400_000 - 60_000;
  const between = T - 86_400_000;
  assert.equal(S.closedForPlay(e2, before), false);
  assert.equal(S.closedForPlay(e2, between), true, "locked at the week's first start, before its own");
  // A lock later than its own start is never read (its start locks it); no start, the lock alone; the hand's overrides win.
  e2.locksAt = new Date(T + 60_000).toISOString();
  assert.equal(S.closedForPlay(e2, T + 1), true);
  delete e2.airsAt;
  assert.equal(S.closedForPlay(e2, T), false);
  assert.equal(S.closedForPlay(e2, T + 120_000), true);
  e2.locksAt = e1.airsAt;
  e2.openPastAir = true;
  assert.equal(S.closedForPlay(e2, between), false, "kept open past its start");
  delete e2.openPastAir;
  e2.lineupsLocked = true;
  assert.equal(S.closedForPlay(e2, before), true, "locked early by hand");
  // The words: the day's or week's first game, for every game in it.
  const rule = (spec) => G.describeSpec(spec, { ...CTX, part: { singular: "game", plural: "games" } }).rules.find((r) => r.startsWith("Lineups lock"));
  assert.equal(rule(base({ closes: "weekly" })), "Lineups lock when the week's first game starts, for every game that week. Change yours as often as you like until then.");
  assert.equal(rule(base({ closes: "daily" })), "Lineups lock when the day's first game starts, for every game that day. Change yours as often as you like until then.");
  assert.equal(rule(base()), "Lineups lock when the game starts. Change yours as often as you like until then.");
});

/** L3 part 2c: a league playing one of the sport's own games of questions (its defaults' pickem or pickAFew), on the six, with
 *  facts.games as the server reads it: the opener (Episode 1) kept in the league's people, Episode 2 still to play. */
function questions(name, span = { from: 1, to: null }) {
  const s = league({ ...defaultsFor("basketball").specs[name].spec, span });
  s.castaways.forEach((c) => { c.ownerIds = []; });
  const idOf = (athlete) => s.castaways.find((c) => c.name === box.people[athlete]?.name)?.id ?? `espn:${athlete}`;
  const games = new Map([
    [1, storedFacts(nba, renamed(kept, idOf), "final")],
    [2, { status: "pre", sides: [{ id: "20", score: 0 }, { id: "5", score: 0 }], lines: {}, teams: {} }],
  ]);
  const facts = (st) => ({ ...S.AnswerLogic.facts(st), games });
  return { s, games, facts };
}

test("a game of questions on a sport's games: pick'em and pick a few play, graded on its games, its episode's results its final", () => {
  for (const sport of ["basketball", "football", "baseball", "hockey", "soccer", "golf", "racing", "mma", "tennis"]) {
    for (const [name, d] of Object.entries(defaultsFor(sport).specs)) {
      if (name !== "pickem" && name !== "pickAFew") continue;
      assert.deepEqual(G.specWaitsFor(d.spec), [], `${sport}'s ${name} plays now`);
      assert.equal(G.typeOf(d.spec), "questions");
    }
  }
  const { s, games, facts } = questions("pickem");
  assert.equal(S.StatsLogic.reads(s), true, "it reads the sport's games");
  assert.equal(S.StatsLogic.on(s), false, "but isn't scored by their stats");
  assert.equal(S.StatsLogic.reads(league(LINEUP)), true);
  assert.equal(S.StatsLogic.reads(S.defaultState()), false, "a show's game reads none");
  const answers = [{ playerId: "ann", question: "winner", episode: 1, answer: "20" }, { playerId: "bo", question: "winner", episode: 1, answer: "5" },
    { playerId: "ann", question: "winner", episode: 2, answer: "5" }];
  // Graded on its games (the 76ers won), whatever the stamp says; the game still to play waits.
  const g = S.AnswerLogic.grade(s, answers, facts(s));
  assert.equal(g.points.get("ann"), 1);
  assert.equal(g.points.get("bo") || 0, 0);
  assert.equal(g.verdicts.get("winner|2").state, "waiting");
  // Before the stamp the opener's episode has no results; stamped with its final, it has, and only its own.
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), false);
  S.StatsLogic.stamp(s, { finals: [1] });
  assert.equal(ep(s, 1).gameFinal, true);
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), true);
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 2)), false);
  assert.equal(S.SpoilerLogic.latestWithResults(s), 1);
  assert.ok(!ep(s, 1).statLines, "no lines for a game of questions");
  // The spoiler view drops it past a viewer's mark; the stamp comes off whole.
  const unseen = S.SpoilerLogic.viewThrough(s, 0);
  assert.equal(unseen.episodes.some((e) => e.gameFinal || S.EpisodeLogic.hasResults(e)), false);
  assert.ok(S.StatsLogic.stampedKeys().includes("gameFinal"));
  S.StatsLogic.unstamp(s);
  assert.equal(ep(s, 1).gameFinal, undefined);
  // A walk's week k never grades a later game's question.
  assert.deepEqual([...G.factsThrough({ ...facts(s), games }, 1).games.keys()], [1]);
});

test("one game's pick'em is over at its final; pick a few on the opener: Maxey and Mitchell tied on 32, both right", () => {
  const one = questions("pickem", { from: 1, to: 1 });
  assert.equal(S.gameOver(one.s), false);
  S.StatsLogic.stamp(one.s, { finals: [1] });
  assert.equal(S.gameOver(one.s), true, "its one game final: the game is over");
  assert.equal(S.gameOver(S.SpoilerLogic.viewThrough(one.s, 0)), false, "not for a viewer who hasn't seen it");
  const { s, facts } = questions("pickAFew");
  S.StatsLogic.stamp(s, { finals: [1] });
  const [maxey, mitchell] = ["Tyrese Maxey", "Donovan Mitchell"].map((n) => cid(s, n));
  const [third, fourth] = s.castaways.map((c) => c.id).filter((id) => id !== maxey && id !== mitchell);
  const answers = [
    { playerId: "ann", question: "few", episode: 1, answer: [maxey, mitchell, third] },
    { playerId: "bo", question: "few", episode: 1, answer: [maxey, third, fourth] },
  ];
  const g = S.AnswerLogic.grade(s, answers, facts(s));
  assert.equal(g.points.get("ann"), 6, "two right, three points each");
  assert.equal(g.points.get("bo"), 3);
  // At the viewer's mark the server's games are still to play (leagueGames' mark): nothing graded.
  const pre = new Map([[1, { status: "pre", sides: [], lines: {}, teams: {} }]]);
  assert.equal(S.AnswerLogic.grade(S.SpoilerLogic.viewThrough(s, 0), answers, { ...S.AnswerLogic.facts(S.SpoilerLogic.viewThrough(s, 0)), games: pre }).points.get("ann") || 0, 0);
});

// L3 part 2d: categories and roto. The NBA's nine on the opener (Episode 1) and the same lines again (Episode 2), ann starting the
// 76ers' first two, bo the Cavaliers' first two.
const Cats = require("../src/lib/game/sequence/categories.js");
const CATS = defaultsFor("basketball").categories.stats;
const DEFS = nba.categoryDefs();
function cats(rank, count = { start: 2 }) {
  const s = league(base({ count, score: { by: "stats", categories: CATS }, rank }));
  // Lineups first: an episode with its results in is locked.
  for (const n of [1, 2]) {
    S.ActiveRosterLogic.setLineup(s, ep(s, n).id, "ann", SIXERS_THREE.slice(0, 2).map((x) => cid(s, x)));
    S.ActiveRosterLogic.setLineup(s, ep(s, n).id, "bo", CAVS_THREE.slice(0, 2).map((x) => cid(s, x)));
  }
  const lines = linesIn(s);
  S.StatsLogic.stamp(s, { lines: { 1: lines, 2: lines }, defs: DEFS });
  return s;
}
/** Ann's and bo's totals on one episode, worked out straight from the lines (the scorer's own, not the engine's). */
const direct = (s, names) => Cats.categoryTotals(names.map((x) => linesIn(s)[cid(s, x)]), CATS, DEFS);

test("head to head on categories: each episode's starters' totals compared category by category, the record by each or by most", () => {
  for (const name of ["categories", "roto"]) for (const sport of ["basketball", "hockey", "baseball"]) {
    assert.deepEqual(G.specWaitsFor(defaultsFor(sport).specs[name].spec), [], `${sport}'s ${name} plays now`);
  }
  const s = cats({ by: "categories" });
  assert.equal(S.MatchupLogic.on(s), true);
  assert.equal(G.flagsOf(G.gameOf(s.settings)).hasMatchups, true);
  assert.equal(G.flagsOf(G.gameOf(s.settings)).hasCategories, true);
  const m = Cats.categoryMatchup(direct(s, SIXERS_THREE.slice(0, 2)), direct(s, CAVS_THREE.slice(0, 2)), CATS, DEFS);
  const view = S.MatchupLogic.view(s, "ann");
  // Two episodes of the same lines: each category's result twice.
  assert.deepEqual([view.record.wins, view.record.losses, view.record.ties], [2 * m.a.wins, 2 * m.a.losses, 2 * m.a.ties]);
  assert.equal(view.last.points, m.a.wins);
  assert.equal(view.last.against, m.b.wins);
  const rows = S.computeScores(s);
  const lead = m.a.wins > m.b.wins ? "ann" : "bo";
  if (m.a.wins !== m.b.wins) assert.equal(rows[0].playerId, lead, "the record ranks the table");
  assert.equal(rows.find((r) => r.playerId === "ann").matchups.wins, 2 * m.a.wins);
  // By most categories: whoever won more of them wins the episode.
  const most = S.MatchupLogic.view(cats({ by: "matchups" }), "ann").record;
  assert.deepEqual([most.wins, most.losses, most.ties], m.result === "a" ? [2, 0, 0] : m.result === "b" ? [0, 2, 0] : [0, 0, 2]);
  // Everyone drafted counting: the whole team's lines.
  const all = cats({ by: "categories" }, { all: true });
  const mAll = Cats.categoryMatchup(direct(all, SIXERS_THREE), direct(all, CAVS_THREE), CATS, DEFS);
  assert.equal(S.MatchupLogic.view(all, "ann").record.wins, 2 * mAll.a.wins);
  // The viewer's copy at their mark has no lines and nothing played; the settings say it back.
  assert.equal(S.MatchupLogic.view(S.SpoilerLogic.viewThrough(s, 0), "ann").record.wins, 0);
  assert.equal(G.specOf(s.settings).rank.by, "categories");
  assert.equal(S.StatsLogic.stampedKeys().includes("statDefs"), true);
});

test("roto: each category ranks everyone on the game so far, the row's total its roto points", () => {
  const s = cats({ by: "roto" });
  assert.equal(S.MatchupLogic.on(s), false);
  assert.equal(S.RotoLogic.on(s), true);
  // The game so far: both episodes' lines added (each count twice, each rate the same).
  const twice = (names) => Cats.categoryTotals(names.flatMap((x) => [linesIn(s)[cid(s, x)], linesIn(s)[cid(s, x)]]), CATS, DEFS);
  const want = Cats.roto(new Map([["ann", twice(SIXERS_THREE.slice(0, 2))], ["bo", twice(CAVS_THREE.slice(0, 2))]]), CATS, DEFS);
  const rows = S.computeScores(s);
  assert.deepEqual(rows.map((r) => [r.playerId, r.total]), want.map((r) => [r.id, r.total]));
  assert.deepEqual(rows[0].roto.points, want[0].points);
  assert.equal(want.reduce((n, r) => n + r.total, 0), CATS.length * 3, "each category hands out 2 + 1");
  // Nothing seen: every category tied, 1.5 each.
  assert.deepEqual(S.computeScores(S.SpoilerLogic.viewThrough(s, 0)).map((r) => r.total), [CATS.length * 1.5, CATS.length * 1.5]);
  assert.equal(G.specOf(s.settings).rank.by, "roto");
});

test("categories' playoffs: seeded by the record (categories won breaking a tie), a round by most categories, a tie to the better seed", () => {
  const parts = { by: "categories", categories: ["PTS", "REB"], odd: "median", quiet: "skip", playoffs: { teams: 2, rounds: 1, from: 3 } };
  const defs = { PTS: { better: "higher", group: "x" }, REB: { better: "higher", group: "x" } };
  const t = (o) => new Map(Object.entries(o));
  const played = [
    { number: 1, totals: t({ a: { PTS: 10, REB: 5 }, b: { PTS: 8, REB: 6 }, c: { PTS: 1, REB: 1 } }) },
    { number: 2, totals: t({ a: { PTS: 10, REB: 9 }, b: { PTS: 9, REB: 9 }, c: { PTS: 12, REB: 1 } }) },
    // The final: the two seeds level in both categories, so the better seed wins it.
    { number: 3, totals: t({ a: { PTS: 5, REB: 5 }, b: { PTS: 5, REB: 5 }, c: { PTS: 50, REB: 50 } }) },
  ];
  const w = Cats.categoryMatchups(played, { parts, defs, start: 1, from: 3, finale: null, ended: false, seatsAt: () => ["a", "b", "c"] });
  assert.equal(w.weeks.length, 2);
  assert.deepEqual(w.seeds.length, 2);
  assert.equal(w.rounds[0].played, true);
  assert.equal(w.champion, w.seeds[0]);
  assert.equal(w.rounds[0].games[0].aPoints, 0, "level in both: no category won");
  const r = w.records.get(w.seeds[0]);
  assert.ok(r.wins * 2 + r.ties >= 1 && r.for >= r.wins - 0, "the record is the categories'");
});

// L3 part 2e: squares on the 76ers' opener, kept as the server keeps it (its quarters' ends 18-35, 45-69, 82-90 and the final 114-106,
// the 76ers' "20" the rows, the Cavaliers' "5" the columns), the digits drawn plain (row r is r, column c is c) so a square's number
// is its two digits.
const SQUARES = defaultsFor("basketball").specs.squares.spec;
const PLAIN = { rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d]), cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d]) };
const OPENER_SCORE = (() => { const f = storedFacts(nba, kept, "final"); return { status: f.status, sides: f.sides, periods: f.periods }; })();
/** A squares league of three (ann, bo, cy), Episodes 1 and 2 made, none locked. */
function squaresLeague(spec = SQUARES) {
  const s = S.defaultState();
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}

test("squares: their place in the sequence, the settings round trip, and each default plays", () => {
  assert.deepEqual(G.specProblems(SQUARES, CTX), []);
  assert.deepEqual(G.specWaitsFor(SQUARES), [], "it plays now");
  assert.equal(G.typeOf(SQUARES), "squares");
  assert.equal(G.flagsOf(G.fullSpec(SQUARES)).hasSquares, true);
  for (const sport of ["basketball", "football"]) assert.equal(G.typeOf(defaultsFor(sport).specs.squares.spec), "squares", sport);
  // Ranked by anything but their points, or with questions beside them, they have no place (a stage alongside).
  assert.equal(G.typeOf({ ...SQUARES, rank: { by: "matchups" } }), null);
  assert.equal(G.typeOf({ ...SQUARES, ask: [{ id: "w", ask: "Who wins?", answer: "side", points: 1, asked: "each", closes: "start", settle: { by: "final", take: "winner" } }] }), null);
  const st = G.withSpec(S.defaultState().settings, SQUARES);
  assert.equal(st.leagueTypeId, "squares");
  assert.deepEqual(G.specOf(st), { ...G.fullSpec(SQUARES), pool: { of: "cast", where: { stillIn: true } } });
  const s = squaresLeague();
  assert.equal(S.getLeagueType(s).id, "squares");
  assert.equal(S.SquaresLogic.on(s), true);
  assert.equal(S.StatsLogic.reads(s), true, "the server stamps its games");
});

test("squares taken: first come, up to each, changed until the first lock; then set, a late seat taking what's left from the next game", () => {
  const s = squaresLeague({ ...SQUARES, get: { ...SQUARES.get, each: 3 } });
  const L = S.SquaresLogic;
  assert.equal(L.take(s, "ann", [85, 46]), null);
  assert.equal(L.take(s, "bo", [46]), "Someone has that square already");
  assert.equal(L.take(s, "bo", [59, 1, 2, 3]), "Take 3 at most");
  assert.equal(L.take(s, "bo", [59, 100]), "Squares are numbered 0 to 99");
  assert.equal(L.take(s, "bo", [59, 7]), null);
  assert.equal(L.take(s, "bo", [59]), null, "changed as often as you like");
  assert.equal(L.take(s, "zed", [1]), "You're not playing this game");
  assert.deepEqual(L.heldAt(s, 1), { ann: [46, 85], bo: [59] });
  // The first game locks: squares are set; cy, with none, takes what's left, counting from Episode 2.
  ep(s, 1).lineupsLocked = true;
  assert.equal(L.locked(s), true);
  assert.equal(L.take(s, "ann", [85]), "Squares are set once the game starts");
  assert.equal(L.take(s, "cy", [85]), "Someone has that square already");
  assert.equal(L.take(s, "cy", [20]), null);
  assert.deepEqual(L.heldAt(s, 1), { ann: [46, 85], bo: [59] });
  assert.deepEqual(L.heldAt(s, 2), { ann: [46, 85], bo: [59], cy: [20] });
  assert.equal(s.squares.picks.cy.from, 2);
  // Dealt at random: nothing to take.
  assert.equal(L.take(squaresLeague({ ...SQUARES, get: { by: "squares", grid: 10, take: "deal" } }), "ann", [1]), "Squares are dealt at random in this game");
});

test("squares paid on the 76ers opener: the square of each quarter's end and the final, the digits drawn at the lock, kept at the next write", () => {
  const s = squaresLeague();
  const L = S.SquaresLogic;
  L.take(s, "ann", [85, 46]);
  L.take(s, "bo", [59]);
  // Before the lock: no digits, even stamped (the server draws none then), and nothing to draw.
  S.StatsLogic.stamp(s, { digits: { 1: PLAIN } });
  assert.equal(L.digitsAt(s, ep(s, 1)), null);
  assert.deepEqual(L.toDraw(s), []);
  ep(s, 1).lineupsLocked = true;
  assert.deepEqual(L.toDraw(s).map((e) => e.number), [1]);
  assert.equal(L.due(s), true);
  // The final kept: its score stamped, the episode's results in.
  S.StatsLogic.stamp(s, { finals: [1], games: { 1: OPENER_SCORE }, periods: 4, digits: { 1: PLAIN } });
  assert.equal(S.EpisodeLogic.hasResults(ep(s, 1)), true);
  const pays = L.pays(s, ep(s, 1));
  assert.deepEqual(pays.pays.map((p) => [p.at, p.cell, p.state, p.seat]), [[1, 85, "paid", "ann"], [2, 59, "paid", "bo"], [3, 20, "empty", null], ["final", 46, "paid", "ann"]]);
  assert.deepEqual(S.computeScores(s).map((r) => [r.playerId, r.total]), [["ann", 3], ["bo", 1], ["cy", 0]]);
  // The viewer who hasn't seen it: nothing paid.
  assert.deepEqual(S.computeScores(S.SpoilerLogic.viewThrough(s, 0)).map((r) => r.total), [0, 0, 0]);
  // Kept at the next write: the digits in the league, so the stamp coming off (or the secret changing) moves nothing.
  assert.equal(L.settle(s), true);
  assert.deepEqual(s.squares.digits[1], PLAIN);
  assert.equal(L.due(s), false);
  const keys = new Set(S.StatsLogic.stampedKeys());
  const saved = JSON.parse(JSON.stringify(s, (k, v) => (keys.has(k) ? undefined : v)));
  assert.equal(saved.episodes.some((e) => e.gameScore || e.squareDigits), false, "the stamp is never saved");
  assert.deepEqual(saved.squares.digits[1], PLAIN);
  S.StatsLogic.stamp(saved, { finals: [1], games: { 1: OPENER_SCORE }, periods: 4, digits: { 1: { rows: PLAIN.cols, cols: PLAIN.rows.slice().reverse() } } });
  assert.deepEqual(S.computeScores(saved).map((r) => r.total), [3, 1, 0], "the kept digits, not a new draw");
  // An empty square's points rolled on to the next pay where the spec says so.
  const next = squaresLeague({ ...SQUARES, score: { ...SQUARES.score, empty: "next" } });
  L.take(next, "ann", [46]);
  ep(next, 1).lineupsLocked = true;
  S.StatsLogic.stamp(next, { finals: [1], games: { 1: OPENER_SCORE }, periods: 4, digits: { 1: PLAIN } });
  assert.deepEqual(L.pays(next, ep(next, 1)).pays.map((p) => p.points), [1, 2, 3, 5], "every quarter empty: the final takes them all");
  assert.equal(S.computeScores(next)[0].total, 5);
});

test("squares dealt at the first lock: evenly from the first game's id, kept at the next write so a later seat moves nobody's", () => {
  const s = squaresLeague({ ...SQUARES, get: { by: "squares", grid: 10, take: "deal" } });
  const L = S.SquaresLogic;
  assert.deepEqual(L.heldAt(s, 1), {}, "nothing dealt before the lock");
  ep(s, 1).lineupsLocked = true;
  const dealt = L.heldAt(s, 1);
  assert.deepEqual(Object.keys(dealt).sort(), ["ann", "bo", "cy"]);
  assert.deepEqual(Object.values(dealt).map((c) => c.length), [33, 33, 33], "as many as go round evenly");
  assert.equal(new Set(Object.values(dealt).flat()).size, 99);
  assert.equal(L.due(s), true);
  L.settle(s);
  assert.deepEqual(s.squares.dealt.seats, ["ann", "bo", "cy"]);
  s.players.push({ id: "dee", name: "dee", color: "#000" });
  assert.deepEqual(L.heldAt(s, 2), dealt, "a late joiner has none");
  assert.deepEqual(L.mine(s, "ann"), dealt.ann);
});

test("a bracket question plays: tennis's defaults are a game of questions now", () => {
  for (const league of ["atp", "wta"]) {
    const spec = defaultsFor("tennis", league).specs.bracket.spec;
    assert.deepEqual(G.specWaitsFor(spec), [], league);
    assert.equal(G.typeOf(spec), "questions", league);
  }
});

// L3 part 2f: a league's slate, a week of several games an episode. The server stamps a week only once every game in it is over, its
// lines the week's (each game's counts and derived stats added up) and each game's (`statGames`), so a table scores each game on its
// own: a double-double is a game's, never the week's sum's.
test("a slate's week: each game at the table on its own and added up, a double-double a game's; never saved, never past the mark", () => {
  const spec = base({ score: { by: "stats", points: { PTS: 1, DD: 5 } }, count: { all: true } });
  const s = league(spec);
  const [x] = s.castaways.map((c) => c.id);
  // Two games in the week: a double-double in the first (10 and 10), none in the second.
  const g1 = { [x]: { PTS: 10, REB: 10, DD: 1 } };
  const g2 = { [x]: { PTS: 4, REB: 3, DD: 0 } };
  const week = { [x]: { PTS: 14, REB: 13, DD: 1 } };
  S.StatsLogic.stamp(s, { lines: { 1: week }, byGame: { 1: { g1, g2 } }, finals: [1] });
  const scored = S.StatsLogic.scored(s, ep(s, 1));
  assert.deepEqual(scored.map((m) => m.points), [15, 4], "a moment a game");
  assert.equal(score(s, "ann"), 19);
  const line = S.StatsLogic.lineOf(s, ep(s, 1), x);
  assert.equal(line.points, 19);
  assert.deepEqual(line.parts.map((p) => [p.stat, p.value, p.points]).sort(), [["DD", 1, 5], ["PTS", 14, 14]]);
  // The viewer who hasn't seen the week: nothing; a write saves none of it.
  assert.equal(S.SpoilerLogic.viewThrough(s, 0).episodes.some((e) => e.statGames), false);
  const keys = new Set(S.StatsLogic.stampedKeys());
  assert.equal(JSON.parse(JSON.stringify(s, (k, v) => (keys.has(k) ? undefined : v))).episodes.some((e) => e.statGames), false);
});

// L8 part 1's engine items: a lineup locking at each game's start (closes 'game'): Yahoo's daily lineups inside a week's episode.
// Episode 1's games: Monday's (x and z play: g1) and Wednesday's (everyone: g2), each holding locked from its game's start to the end
// of that day (the server's ep.gameStarts and ep.holdingGames).
const H = 3_600_000;
const MON = Date.parse("2026-11-09T00:00:00Z"); // Sun Nov 8, 7 PM EST
function eachGameLineup(spec = base({ closes: "game", score: { by: "stats", points: { PTS: 1 } } })) {
  const s = league(spec);
  const [x, y, z] = s.castaways.map((c) => c.id);
  const e = ep(s, 1);
  e.airsAt = new Date(MON).toISOString();
  e.gameStarts = {
    g1: { at: new Date(MON).toISOString(), until: new Date(MON + 5 * H).toISOString() },
    g2: { at: new Date(MON + 48 * H).toISOString(), until: new Date(MON + 53 * H).toISOString() },
  };
  e.holdingGames = { [x]: ["g1", "g2"], [y]: ["g2"], [z]: ["g1", "g2"] };
  return { s, e, x, y, z };
}

test("a lineup locking at each game's start: a lineup scored by stats plays it; anything else is refused, and its words", () => {
  const { s } = eachGameLineup();
  assert.deepEqual(G.specWaitsFor(G.gameOf(s.settings)), []);
  assert.equal(G.gameOf(s.settings).closes, "game", "the settings say it (lockCloses)");
  const why = (spec) => G.specProblems(spec, CTX).map((p) => p.at);
  assert.deepEqual(why(base({ closes: "game" })), []);
  assert.deepEqual(why(base({ closes: "game", count: { best: 2 } })), ["closes"], "best ball has no lineup");
  assert.deepEqual(why(base({ closes: "game", count: { all: true } })), ["closes"]);
  assert.deepEqual(why(base({ closes: "game", score: { by: "moments", points: null } })), ["closes"], "a show's moments have no games");
  assert.deepEqual(why({ ...CAPTAIN, closes: "game" }), ["score.captain"], "a captain is the episode's");
  const rule = G.describeSpec(base({ closes: "game" }), { ...CTX, part: { singular: "week", plural: "weeks" } }).rules.find((r) => r.startsWith("Each "));
  assert.equal(rule, "Each person locks when their game starts, for the rest of that day. Change the rest of your lineup as often as you like until theirs start: each game counts for whoever's in your lineup when it starts.");
});

test("a lineup locking at each game's start: each holding locks at its own game for the rest of its day, the week at its last game", () => {
  const { s, e, x, y, z } = eachGameLineup();
  const A = S.ActiveRosterLogic;
  const set = (ids, t) => A.setLineup(s, e.id, "ann", ids, t);
  assert.equal(set([x, z], MON - 24 * H), true, "Sunday, before the week");
  assert.equal(set([x, y], MON - 23 * H), true, "changed again before any game: the one before is replaced");
  assert.equal(set([x, z], MON - 22 * H), true);
  assert.equal(e.lineupsAt.ann.length, 1);
  // Monday night, during x's and z's game: neither moves, out or in; y (no game today) can't take z's place.
  assert.equal(A.isLineupLocked(s, e.id, MON + H), false, "the week is open to its last game");
  assert.equal(A.validateLineup(s, e.id, "ann", [x, y], MON + H), `${s.castaways[2].name}'s game has started: they stay in your lineup until the day's over`);
  assert.equal(A.validateLineup(s, e.id, "bo", [s.castaways[3].id], MON + H), null, "bo's own aren't playing");
  // Tuesday: Monday's day is over, so z makes way for y for Wednesday's game.
  assert.equal(set([x, y], MON + 14 * H), true);
  assert.equal(e.lineupsAt.ann.length, 2, "the Sunday lineup counted for Monday's game: kept");
  // Wednesday's game started: everyone locked, the week too.
  assert.equal(A.heldLocked(e, y, MON + 49 * H), true);
  assert.equal(A.isLineupLocked(s, e.id, MON + 49 * H), true, "locked at the week's last game");
  assert.equal(A.isLineupLocked(s, e.id, MON + 47 * H), false);
  // Each game counts its own lineup: Monday's x and z, Wednesday's x and y (z's 20 on Wednesday was on the bench).
  S.StatsLogic.stamp(s, { lines: { 1: { [x]: { PTS: 13 }, [y]: { PTS: 7 }, [z]: { PTS: 25 } } }, byGame: { 1: { g1: { [x]: { PTS: 10 }, [z]: { PTS: 5 } }, g2: { [x]: { PTS: 3 }, [y]: { PTS: 7 }, [z]: { PTS: 20 } } } }, finals: [1] });
  assert.equal(score(s, "ann"), 10 + 5 + 3 + 7);
  assert.deepEqual(A.lineupAt(s, e, "ann", MON), [x, z]);
  // Kept open past its start by whoever runs the game: one lineup, as it stands, for every game.
  e.openPastAir = true;
  assert.equal(score(s, "ann"), 13 + 7);
  delete e.openPastAir;
  // The server's game starts are never saved; the lineups set are.
  const keys = new Set(S.StatsLogic.stampedKeys());
  const saved = JSON.parse(JSON.stringify(s, (k, v) => (keys.has(k) ? undefined : v))).episodes[0];
  assert.equal(saved.gameStarts, undefined);
  assert.equal(saved.holdingGames, undefined);
  assert.equal(saved.lineupsAt.ann.length, 2);
});

test("a lineup locking at each game's start: a lineup set before it, a game with no start, categories game by game, no games stamped", () => {
  const cats = base({ closes: "game", score: { by: "stats", categories: ["PTS", "REB"] }, rank: { by: "categories" } });
  const { s, e, x, y, z } = eachGameLineup(cats);
  const A = S.ActiveRosterLogic;
  // A lineup set before the game locked at each game's start counts from the week's start.
  e.lineups = { ann: [x, z] };
  assert.equal(A.setLineup(s, e.id, "ann", [x, y], MON + 14 * H), true);
  assert.deepEqual(e.lineupsAt.ann.map((l) => l.ids), [[x, z], [x, y]]);
  // Categories: each game's lines of whoever was in at its start.
  const g1 = { [x]: { PTS: 10, REB: 1 }, [z]: { PTS: 5, REB: 9 } };
  const g2 = { [x]: { PTS: 3, REB: 2 }, [y]: { PTS: 7, REB: 0 }, [z]: { PTS: 20, REB: 20 } };
  S.StatsLogic.stamp(s, { lines: { 1: {} }, byGame: { 1: { g1, g2, g3: { [z]: { PTS: 1, REB: 1 } } } }, finals: [1], defs: DEFS });
  // g3 has no start stamped: the lineup as it stands (x and y), so z's line there isn't counted.
  const counted = S.StatsLogic.countedLines(s, e, "ann");
  assert.deepEqual(counted, [g1[x], g1[z], g2[x], g2[y]]);
  // No games stamped (no schedule, a league at its own pace): one lineup, as at the start.
  S.StatsLogic.unstamp(s);
  delete e.gameStarts;
  assert.equal(A.eachGame(s, e), false);
  assert.equal(A.validateLineup(s, e.id, "ann", [x, z], MON - H), null);
  assert.equal(A.validateLineup(s, e.id, "ann", [x, z], MON + H), "This episode has started -- lineups are locked");
});

// L3 part 2f part 2: a question about each game of the episode (a week's slate's pick'em, confidence points). Episode 1's games: the
// 76ers' opener (the 76ers, "20", won), a second final ("7" beat "9") and a third called off; Episode 2's, one final and one to play.
function eachGame(ask = {}) {
  const pickem = defaultsFor("basketball").specs.pickem.spec;
  const spec = { ...pickem, ask: [{ ...pickem.ask[0], each: "game", ...ask }] };
  const s = league(spec);
  s.castaways.forEach((c) => { c.ownerIds = []; });
  const idOf = (athlete) => s.castaways.find((c) => c.name === box.people[athlete]?.name)?.id ?? `espn:${athlete}`;
  const fin = (a, b, sa, sb) => ({ status: "final", sides: [{ id: a, score: sa }, { id: b, score: sb }], lines: {}, teams: {} });
  const slate = new Map([
    [1, new Map([["g1", storedFacts(nba, renamed(kept, idOf), "final")], ["g2", fin("7", "9", 101, 96)], ["g3", { status: "off", sides: [{ id: "1", score: 0 }, { id: "2", score: 0 }], lines: {}, teams: {} }]])],
    [2, new Map([["g4", fin("7", "1", 99, 100)], ["g5", { status: "pre", sides: [{ id: "9", score: 0 }, { id: "2", score: 0 }], lines: {}, teams: {} }]])],
  ]);
  const facts = (st) => ({ ...S.AnswerLogic.facts(st), slate });
  return { s, q: S.AnswerLogic.questions(s)[0], slate, facts };
}
const facesOf = (slate, n) => new Map([...slate.get(n)].map(([id, g]) => [id, new Set(g.sides.map((x) => x.id))]));

test("a question about each game: it plays (who wins, a total's range, the closest), confidence on who wins; the rest refused", () => {
  const pickem = defaultsFor("football").specs.pickem.spec;
  const withAsk = (ask) => ({ ...pickem, ask: [{ ...pickem.ask[0], each: "game", ...ask }] });
  for (const ask of [{}, { confidence: true }, { answer: "choice", settle: { by: "final", take: "total" }, options: ["0-40", "41-50", "51+"] }, { answer: "number", settle: { by: "final", take: "margin" } }]) {
    assert.deepEqual(G.specProblems(withAsk(ask)), [], JSON.stringify(ask));
    assert.deepEqual(G.specWaitsFor(withAsk(ask)), []);
    assert.equal(G.typeOf(withAsk(ask)), "questions");
  }
  const refused = (ask, where) => assert.ok(G.specProblems(withAsk(ask)).some((p) => p.at === `ask[0].${where}`), `${JSON.stringify(ask)} at ${where}`);
  refused({ answer: "overUnder", settle: { by: "final", take: "total" }, line: 44 }, "answer");
  refused({ asked: "once" }, "asked");
  refused({ answer: "choice", settle: { by: "final", take: "total" }, options: ["0-40", "41+"], confidence: true }, "confidence");
  refused({ share: "split" }, "share");
  refused({ confidence: "yes" }, "confidence");
  assert.ok(G.specProblems({ ...pickem, ask: [{ ...pickem.ask[0], confidence: true }] }).some((p) => p.at === "ask[0].confidence"), "confidence only on each game");
  assert.deepEqual(G.specProblems({ ...pickem, ask: [{ ...pickem.ask[0], each: "team" }] }).map((p) => p.at), ["ask[0].each"]);
  // Its words: each game, each locking on its own; confidence, each right pick its rank.
  const rules = G.describeSpec(withAsk({ confidence: true })).rules.join(" ");
  assert.match(rules, /Answer for each game of the/);
  assert.match(rules, /rank your picks by how sure you are/);
  assert.match(rules, /each locks on its own/);
});

test("a question about each game graded game by game: a game called off doesn't count, confidence a right pick's rank, waiting till the last", () => {
  const { s, q, slate, facts } = eachGame();
  const answers = [
    { playerId: "ann", question: "winner", episode: 1, answer: { g1: "20", g2: "9", g3: "1" } },
    { playerId: "bo", question: "winner", episode: 1, answer: { g1: "5", g2: "7" } },
    { playerId: "ann", question: "winner", episode: 2, answer: { g4: "1", g5: "9" } },
  ];
  const g = S.AnswerLogic.grade(s, answers, facts(s));
  const v1 = g.verdicts.get("winner|1");
  assert.equal(v1.state, "known");
  assert.deepEqual(Object.keys(v1.each), ["g1", "g2", "g3"]);
  assert.deepEqual(v1.each.g1.right, ["20"]);
  assert.equal(v1.each.g3.state, "off", "the game called off");
  assert.equal(g.points.get("ann"), 1, "the 76ers right, the rest wrong or off");
  assert.equal(g.points.get("bo"), 1);
  assert.equal(G.isRight(q, v1, answers[0], answers.slice(0, 2), facts(s)), true);
  // Episode 2 waits for its last game, with where each stands.
  const v2 = g.verdicts.get("winner|2");
  assert.equal(v2.state, "waiting");
  assert.deepEqual(v2.live.each.g4.right, ["1"]);
  // A walk's week k never grades a later week's games.
  assert.deepEqual([...G.factsThrough(facts(s), 1).slate.keys()], [1]);
  // Confidence: a right pick its rank, times the question's points.
  const c = eachGame({ confidence: true, points: 2 });
  const ranked = [
    { playerId: "ann", question: "winner", episode: 1, answer: { g1: { answer: "20", confidence: 3 }, g2: { answer: "9", confidence: 2 }, g3: { answer: "1", confidence: 1 } } },
    { playerId: "bo", question: "winner", episode: 1, answer: { g1: { answer: "5", confidence: 1 }, g2: { answer: "7", confidence: 3 } } },
  ];
  const cg = S.AnswerLogic.grade(c.s, ranked, c.facts(c.s));
  assert.equal(cg.points.get("ann"), 6, "the 76ers at 3, times 2");
  assert.equal(cg.points.get("bo"), 6, "7 at 3, times 2");
  assert.equal(G.isRight(c.q, cg.verdicts.get("winner|1"), ranked[1], ranked, c.facts(c.s)), true);
  // No slate handed over (a show's facts): it waits.
  assert.equal(G.verdictOf(q, 1, S.AnswerLogic.facts(s)).state, "waiting");
  void slate;
});

test("a question about each game's answers: its games' sides only, each rank once from 1 to its games; it closes at its last game's start", () => {
  const { s, q, slate } = eachGame();
  const faces = facesOf(slate, 1);
  assert.equal(G.answerProblem(q, { g1: "20", g2: "9" }, faces), null);
  assert.equal(G.answerProblem(q, { g9: "20" }, faces), "Answer only for its games");
  assert.equal(G.answerProblem(q, { g1: "7" }, faces), "Pick one of the sides");
  assert.equal(G.answerProblem(q, "20", faces), "An answer for each game: { game: answer }");
  assert.equal(G.answerProblem(q, {}, faces), "Answer for a game");
  const c = eachGame({ confidence: true });
  assert.equal(G.answerProblem(c.q, { g1: { answer: "20", confidence: 3 }, g2: { answer: "9", confidence: 1 } }, faces), null);
  assert.equal(G.answerProblem(c.q, { g1: { answer: "20", confidence: 3 }, g2: { answer: "9", confidence: 3 } }, faces), "Use each confidence once");
  assert.equal(G.answerProblem(c.q, { g1: { answer: "20", confidence: 4 } }, faces), "Confidence is 1 to 3");
  assert.equal(G.answerProblem(c.q, { g1: "20" }, faces), "Your pick and how sure you are: { answer, confidence }");
  // The lock: the episode's own start (its first game) doesn't close it; its last game's start does (the server's lastStart).
  ep(s, 1).airsAt = "2026-11-08T18:00:00.000Z";
  const at = (iso) => Date.parse(iso);
  const o = { lastStart: "2026-11-09T01:20:00.000Z" };
  assert.equal(S.AnswerLogic.closed(s, q, 1, { now: at("2026-11-08T19:00:00.000Z") }), true, "without it, the episode's start");
  assert.equal(S.AnswerLogic.closed(s, q, 1, { ...o, now: at("2026-11-08T19:00:00.000Z") }), false);
  assert.equal(S.AnswerLogic.closed(s, q, 1, { ...o, now: at("2026-11-09T01:20:00.000Z") }), true);
  ep(s, 1).lineupsLocked = true;
  assert.equal(S.AnswerLogic.closed(s, q, 1, { ...o, now: at("2026-11-08T19:00:00.000Z") }), true, "locked early by hand");
});
