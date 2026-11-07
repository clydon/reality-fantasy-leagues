// A league's playoffs as a bracket (docs/PLAN-start-a-game-gpt.md track L, L8 part 1's engine items, part 2): a playoffs slate's
// games grouped into their series (src/lib/sports/playoffs.ts: each game's round from ESPN's note, each series' winner the side that
// took it), each series a bout of the draw "playoffs" (sequence/bracket.js bracketOf), and a bracket question asked once over the
// playoffs, graded as a draw's. On ESPN's own 2026 playoffs as its scoreboards listed them (tests/fixtures/espn/*-schedule-playoffs-
// 2026.json, recorded 2026-11-06 by scripts/dev-test/record-espn-slate.js --only=post): the NBA's, the NHL's, MLB's and the NFL's.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, defaultsFor, specContextOf, roundOf, seriesOf, playoffsFacts, isBracket, PLAYOFFS } = jiti("../src/lib/sports/index.ts");
const { readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const Br = require("../src/lib/game/sequence/bracket.js");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const LEAGUES = { nba: "basketball/nba", nhl: "hockey/nhl", mlb: "baseball/mlb", nfl: "football/nfl" };
const raw = (k) => require(`./fixtures/espn/${k}-schedule-playoffs-2026.json`);
/** A recording's games as the series read them (the server's leagueGames, every game final as kept). */
function gamesOf(k) {
  const evs = Object.values(raw(k).months).flatMap((m) => readScoreboard(LEAGUES[k], { events: m.events }));
  return evs.map((e) => ({ id: e.id, note: e.note, bestOf: e.bestOf ?? null, at: e.at, status: e.final ? "final" : e.state === "post" ? "off" : e.state, sides: e.competitors.map((c) => ({ id: c.team.id, score: Number(c.score) || 0 })) }));
}
/** ESPN's own record of each series after its last game (series.competitors' wins), by its two teams. */
function espnSeries(k) {
  const out = new Map();
  for (const e of Object.values(raw(k).months).flatMap((m) => m.events).sort((a, b) => a.date.localeCompare(b.date))) {
    const s = e.competitions[0].series;
    if (!s) continue;
    out.set(s.competitors.map((c) => c.id).sort().join("-"), Object.fromEntries(s.competitors.map((c) => [c.id, c.wins])));
  }
  return out;
}
const field = (games) => Br.bracketOf(playoffsFacts(games).bouts, PLAYOFFS);
const counts = (f) => Object.fromEntries(Object.entries(f.matches).map(([k, v]) => [k, v.length]));

test("a game's round from ESPN's note: each league's words, its half, a numbered round counted later", () => {
  const cases = {
    "East 1st Round - Game 3": { half: "East", fromFinal: null, nth: 1 },
    "West Semifinals - Game 2": { half: "West", fromFinal: 3, nth: null },
    "East Finals - Game 1": { half: "East", fromFinal: 2, nth: null },
    "NBA Finals - Game 7": { half: null, fromFinal: 1, nth: null },
    "West 2nd Round - Game 4": { half: "West", fromFinal: null, nth: 2 },
    "East Final - Game 5": { half: "East", fromFinal: 2, nth: null },
    "Stanley Cup Final - Game 6": { half: null, fromFinal: 1, nth: null },
    "ALWC - Game 1": { half: "AL", fromFinal: 4, nth: null },
    "NLDS - Game 5": { half: "NL", fromFinal: 3, nth: null },
    "ALCS - Game 2 Rain - Makeup on Oct 18": { half: "AL", fromFinal: 2, nth: null },
    "World Series - Game 1": { half: null, fromFinal: 1, nth: null },
    "AFC Wild Card Playoffs": { half: "AFC", fromFinal: 4, nth: null },
    "NFC Divisional Playoffs": { half: "NFC", fromFinal: 3, nth: null },
    "AFC Championship": { half: "AFC", fromFinal: 2, nth: null },
    "Super Bowl LX": { half: null, fromFinal: 1, nth: null },
    "First Round - Game 2": { half: null, fromFinal: null, nth: 1 },
    "WNBA Semifinals - Game 3": { half: null, fromFinal: 2, nth: null },
    "WNBA Finals - Game 1": { half: null, fromFinal: 1, nth: null },
    "Eastern Conference Semifinals": { half: "East", fromFinal: 3, nth: null },
  };
  for (const [note, want] of Object.entries(cases)) assert.deepEqual(roundOf(note), want, note);
  for (const note of ["Pro Bowl Games", "Play-In Tournament", "Doubleheader - Game 1", "NBA Cup - Group Play", "", null]) assert.equal(roundOf(note), null, String(note));
});

test("ESPN's 2026 playoffs as brackets: every series, its length and wins as ESPN's own record, each round's distance, the champion", () => {
  const want = {
    // League: each round's series by its distance from the final, the most games a series takes in each, the champion.
    nba: { rounds: { 4: 8, 3: 4, 2: 2, 1: 1 }, bestOf: { 4: 7, 3: 7, 2: 7, 1: 7 }, champion: "18" },
    nhl: { rounds: { 4: 8, 3: 4, 2: 2, 1: 1 }, bestOf: { 4: 7, 3: 7, 2: 7, 1: 7 }, champion: "7" },
    mlb: { rounds: { 4: 4, 3: 4, 2: 2, 1: 1 }, bestOf: { 4: 3, 3: 5, 2: 7, 1: 7 }, champion: "8" },
    nfl: { rounds: { 4: 6, 3: 4, 2: 2, 1: 1 }, bestOf: { 4: 1, 3: 1, 2: 1, 1: 1 }, champion: "26" },
  };
  for (const [k, w] of Object.entries(want)) {
    const games = gamesOf(k);
    const series = seriesOf(games);
    assert.ok(isBracket(series), `${k}: one bracket`);
    const f = field(games);
    assert.equal(f.first, 4, `${k}: four rounds`);
    assert.deepEqual(counts(f), w.rounds, `${k}: each round's series`);
    for (const s of series) assert.equal(s.bestOf, w.bestOf[s.fromFinal], `${k} ${s.id}: its length`);
    assert.deepEqual(f.winners[1], [w.champion], `${k}: the champion`);
    assert.equal(f.over, true);
    assert.equal(playoffsFacts(games).status, "final");
    // Each series won by a majority of its games, as ESPN's own record of it says.
    const espn = espnSeries(k);
    for (const s of series.filter((x) => x.bestOf > 1)) assert.deepEqual(s.wins, espn.get([...s.sides].sort().join("-")), `${k} ${s.id}: ESPN's wins`);
    for (const s of series) assert.ok(s.winner && s.wins[s.winner] === Math.floor(s.bestOf / 2) + 1, `${k} ${s.id}: won`);
    // Every game is in a series (the NFL's Pro Bowl isn't a playoff game).
    assert.equal(series.reduce((n, s) => n + s.games.length, 0), games.filter((g) => roundOf(g.note)).length);
  }
  // A bye: MLB's and the NFL's top seeds enter at the second round (their first series is a division's).
  const enter = (k) => Object.values(field(gamesOf(k)).entrants).filter((n) => n === 3).length;
  assert.equal(enter("mlb"), 4, "MLB's four byes");
  assert.equal(enter("nfl"), 2, "the NFL's two");
  assert.equal(enter("nba"), 0);
});

test("before the playoffs start: a first round of eight series is four from the final; one of four, three; later rounds as they come", () => {
  const pre = (gs) => gs.map((g) => ({ ...g, status: "pre", sides: g.sides.map((s) => ({ ...s, score: 0 })) }));
  // The NBA's first round's Game 1s, listed before any is played: eight series, so a bracket of sixteen.
  const ones = pre(gamesOf("nba").filter((g) => /1st Round - Game 1$/.test(g.note)));
  assert.equal(ones.length, 8);
  const f = field(ones);
  assert.equal(f.first, 4);
  assert.deepEqual(counts(f), { 4: 8 });
  assert.equal(Object.keys(f.entrants).length, 16);
  assert.equal(playoffsFacts(ones).status, "pre");
  assert.deepEqual(f.winners, {}, "nobody's won yet");
  // A first round of four series (the WNBA's) is three from the final; with its semifinals listed, still three.
  const wnba = (note, a, b, i) => ({ id: `w${i}`, note, bestOf: 3, at: `2026-09-1${i}T23:00Z`, status: "pre", sides: [{ id: a, score: 0 }, { id: b, score: 0 }] });
  const four = [["1", "8"], ["2", "7"], ["3", "6"], ["4", "5"]].map(([a, b], i) => wnba("First Round - Game 1", a, b, i));
  assert.equal(field(four).first, 3);
  assert.equal(field([...four, { ...wnba("WNBA Semifinals - Game 1", "1", "4", 8), bestOf: 5 }]).first, 3);
  // The NHL's 2nd round once listed: its first round still four from the final, its second three.
  const nhl = gamesOf("nhl").filter((g) => /(1st|2nd) Round/.test(g.note));
  assert.deepEqual(counts(field(nhl)), { 4: 8, 3: 4 });
  // A series still being played: nobody's taken it.
  const mid = gamesOf("nba").filter((g) => /1st Round - Game [1-3]$/.test(g.note));
  assert.ok(seriesOf(mid).every((s) => s.winner === null && s.status === "in"));
  assert.equal(playoffsFacts(mid).status, "in");
});

test("a series whose length nobody listed: another series' of its round, else no winner yet (never one game's win taken for it)", () => {
  const nba = gamesOf("nba");
  // Every length forgotten (links made before 0305, an answer cached before it): no series is won, the playoffs still on.
  const none = nba.map((g) => ({ ...g, bestOf: null }));
  assert.ok(seriesOf(none).filter((s) => s.games.length > 1).every((s) => s.winner === null), "a series of several games waits");
  assert.equal(playoffsFacts(none).status, "in");
  // One game's length forgotten: its round's others say it.
  const one = nba.map((g, i) => (i === 0 ? { ...g, bestOf: null } : g));
  assert.deepEqual(seriesOf(one).map((s) => [s.id, s.winner, s.bestOf]), seriesOf(nba).map((s) => [s.id, s.winner, s.bestOf]));
  // The NFL's games, no series: one game each.
  assert.ok(seriesOf(gamesOf("nfl")).every((s) => s.bestOf === 1 && s.winner));
  // A conference's semifinals with no half named are a half's (3 from the final), its final 2.
  assert.deepEqual(roundOf("Conference Semifinals - Game 1"), { half: null, fromFinal: 3, nth: null });
  assert.deepEqual(roundOf("Conference Final"), { half: null, fromFinal: 2, nth: null });
});

test("a week-by-week walk grades the bracket only from the week the final was won", () => {
  const { s, q } = bracketLeague();
  // Each game on an episode: the Finals' deciding game in Episode 3, everything before in Episode 1 or 2.
  const nba = gamesOf("nba").map((g) => ({ ...g, episode: /NBA Finals/.test(g.note) ? 3 : /1st Round/.test(g.note) ? 1 : 2 }));
  const playoffs = playoffsFacts(nba);
  assert.equal(playoffs.wonAt, 3);
  const best = perfect(field(nba));
  const facts = { ...S.AnswerLogic.facts(s), playoffs };
  assert.equal(G.verdictOf(q, 0, G.factsThrough(facts, 2)).state, "waiting", "week 2: still being played");
  assert.equal(G.verdictOf(q, 0, G.factsThrough(facts, 3)).state, "known");
  assert.equal(Br.bracketPoints(q, field(nba), best), 32);
});

test("a postseason that isn't one bracket (college's: two finals) is no draw", () => {
  const g = (id, note, a, b) => ({ id, note, bestOf: null, at: `2026-04-0${id}T23:00Z`, status: "final", sides: [{ id: a, score: 70 }, { id: b, score: 60 }] });
  const college = [g("1", "NCAA Men's Basketball Championship - Final Four", "1", "2"), g("2", "NCAA Men's Basketball Championship - Final Four", "3", "4"), g("3", "NCAA Men's Basketball Championship - National Championship", "1", "3")];
  assert.equal(isBracket(seriesOf(college)), false);
  assert.deepEqual(playoffsFacts(college).bouts, {});
  assert.equal(field(college).first, null);
  // A team in two series of one round isn't a bracket either.
  assert.equal(isBracket([{ fromFinal: 2, sides: ["1", "2"] }, { fromFinal: 2, sides: ["1", "3"] }]), false);
});

/** A league playing the NBA's bracket of its playoffs, with two players. */
function bracketLeague(k = "nba") {
  const sport = sportOf(LEAGUES[k]);
  const spec = defaultsFor(sport.id, LEAGUES[k].split("/")[1]).specs.bracket.spec;
  const s = S.defaultState();
  S.addCastaway(s, "Someone");
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: specContextOf(sport, LEAGUES[k].split("/")[1], { playoffs: true }) }), []);
  for (let n = 1; n <= 3; n++) S.ensureEpisodeNumber(s, n, false);
  return { s, q: spec.ask[0] };
}
/** The perfect bracket on a draw: each round's winners. */
const perfect = (f) => Object.fromEntries(Object.entries(f.winners).map(([k, v]) => [k, [...v]]));

test("a bracket of the NBA's playoffs: asked once, graded on the series, each right pick doubling round by round", () => {
  const { s, q } = bracketLeague();
  assert.equal(q.asked, "once");
  assert.deepEqual(G.specWaitsFor(G.gameOf(s.settings)), []);
  assert.equal(G.typeOf(G.gameOf(s.settings)), "questions");
  const games = gamesOf("nba");
  const playoffs = playoffsFacts(games);
  const f = field(games);
  const best = perfect(f);
  // 8 x 1 + 4 x 2 + 2 x 4 + 1 x 8 = 32.
  assert.equal(Br.bracketPoints(q, f, best), 32);
  const loser = f.matches[1][0].find((id) => id !== f.winners[1][0]);
  const wrongChamp = { ...best, 1: [loser] };
  assert.equal(G.answerProblem(q, best, f), null, "the perfect bracket is a bracket");
  const answers = [{ playerId: "ann", question: "bracket", episode: 0, answer: best }, { playerId: "bo", question: "bracket", episode: 0, answer: wrongChamp }];
  const facts = { ...S.AnswerLogic.facts(s), playoffs };
  const g = S.AnswerLogic.grade(s, answers, facts);
  assert.equal(g.points.get("ann"), 32);
  assert.equal(g.points.get("bo"), 24, "the champion's 8 lost");
  // While the final's series is still on: waiting, the draw so far live; before any game, waiting with nothing.
  const midFinal = games.filter((g) => !/NBA Finals - Game [5-7]$/.test(g.note));
  const v = G.verdictOf(q, 1, { ...facts, playoffs: playoffsFacts(midFinal) });
  assert.equal(v.state, "waiting");
  assert.deepEqual(v.live.bracket.winners[1] ?? [], []);
  assert.equal(G.verdictOf(q, 1, { ...facts, playoffs: null }).state, "waiting");
  assert.equal(G.verdictOf(q, 1, { ...facts, playoffs: undefined }).state, "waiting");
});

test("a bracket answer checked against the playoffs as listed: their first round, a bye entering later, one winner a series", () => {
  const { q } = bracketLeague("mlb");
  const games = gamesOf("mlb");
  // At the lock: the Wild Card Series' Game 1s listed (the division series' sides not yet).
  const f = field(games.filter((g) => /WC - Game 1$/.test(g.note)).map((g) => ({ ...g, status: "pre" })));
  assert.equal(f.first, 4);
  const [a, b] = f.matches[4][0];
  assert.equal(G.answerProblem(q, { 4: [a] }, f), null, "a bracket filled in part");
  assert.equal(G.answerProblem(q, { 4: [a, b] }, f), "Pick one winner of each match");
  assert.equal(G.answerProblem(q, { 3: [a] }, f), "A round is won by one of the round before's winners you picked");
  assert.equal(G.answerProblem(q, { 4: ["nobody"] }, f), "Pick only who's in the draw");
  // A bye's team, once its division series is listed, enters there.
  const full = field(games);
  const bye = Object.entries(full.entrants).find(([, n]) => n === 3)[0];
  assert.equal(G.answerProblem(q, { 3: [bye] }, full), null);
  assert.equal(G.answerProblem(q, { 4: [bye] }, full), "A round is won only by someone in it");
  // MLB's bracket: 4 x 1 + 4 x 2 + 2 x 4 + 1 x 8 = 28.
  assert.equal(Br.bracketPoints(q, full, perfect(full)), 28);
});

test("the spec: a bracket of the playoffs only on a league's playoffs, asked once; every pro league's default; its words", () => {
  const nba = sportOf("basketball/nba");
  const problems = (spec, ctx) => G.specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
  const spec = defaultsFor("basketball", "nba").specs.bracket.spec;
  assert.deepEqual(problems(spec, specContextOf(nba, "nba", { playoffs: true })), []);
  assert.ok(problems(spec, specContextOf(nba, "nba")).includes("ask[0].settle: A team game's bracket is its league's playoffs: this season isn't them"));
  assert.ok(problems({ ...spec, ask: [{ ...spec.ask[0], asked: "each" }] }, null).includes("ask[0].asked: A bracket of the playoffs is picked once, before they start: ask it once"));
  assert.ok(problems({ ...spec, ask: [{ ...spec.ask[0], settle: { ...spec.ask[0].settle, of: "MS" } }] }, specContextOf(nba, "nba", { playoffs: true })).includes('ask[0].settle.of: "MS" isn\'t one of the draws: playoffs'));
  // Tennis's draws aren't the playoffs, and a field has none.
  assert.ok(problems(spec, specContextOf(sportOf("tennis/atp"))).some((p) => p.startsWith("ask[0].settle.of:")));
  assert.ok(problems(spec, specContextOf(sportOf("golf/pga"), undefined, { playoffs: true })).includes("ask[0].settle: A bracket is a draw's (tennis's) or a league's playoffs: a field has none"));
  // Every pro league's default (college's postseason isn't one bracket: none).
  for (const [id, league] of [["basketball", "nba"], ["basketball", "wnba"], ["hockey", "nhl"], ["baseball", "mlb"], ["football", "nfl"]]) {
    const d = defaultsFor(id, league).specs.bracket;
    assert.equal(d.on, "playoffs", league);
    assert.deepEqual(problems(d.spec, specContextOf(sportOf(`${id}/${league}`), league, { playoffs: true })), [], league);
  }
  for (const [id, league] of [["basketball", "mens-college-basketball"], ["basketball", "womens-college-basketball"], ["baseball", "college-baseball"], ["football", "college-football"]]) assert.equal(defaultsFor(id, league).specs.bracket, undefined, league);
  // The words.
  const words = G.describeSpec(spec, specContextOf(nba, "nba", { playoffs: true }));
  assert.ok(JSON.stringify(words).includes("Before the playoffs start, pick the winner of every matchup, round by round to the final: 1 point for each one right in the first round, doubling each round after it."), JSON.stringify(words));
});
