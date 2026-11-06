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
