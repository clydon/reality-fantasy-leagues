// G3, the GPT learns sports (docs/PLAN-start-a-game-gpt.md track G): a sport's page as the Start-a-game GPT reads it. The sport's
// ctx (src/lib/sports/page.ts sportPageContext), the stat words to the Sport's keys (statKeyOf, game-words pack.js statKeyIn), the
// pack's sports part (its teams, games and ESPN's lines, never a score), the manual's sports section (the sport's standard games in
// place of a show's presets, only a sport's examples), and our check's readings (a stat's key, the standard table, the game's own
// line, a team's id, a show's preset off). The user's two sentences end to end on the stand-in: drafted as a bot might, checked,
// the same game as the tracker's, and set as a league's game on the sport's ctx. No database, no bot, no ESPN.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const W = require("../src/lib/game/game-words/index.js");
const S = require("../src/lib/game/game-spec/schema.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const B = require("./fixtures/game-words/bank.js");
const P = jiti("../src/lib/sports/page.ts");
const { sportOf } = jiti("../src/lib/sports/index.ts");

const TRACKER = require("./fixtures/engine-capabilities.json");
const row = (id) => B.requests().find((r) => r.id === id) || TRACKER.examples.find((r) => r.id === id);

// A matchup's page, as the server's pack has it: the Red Sox at the Yankees, two games still to play (one with ESPN's line).
const series = {
  sport: "baseball",
  espn: "baseball/mlb",
  event: "Red Sox at Yankees",
  teams: [{ id: "2", name: "Red Sox" }, { id: "10", name: "Yankees" }],
  games: [
    { episode: 1, at: "2026-09-29T23:05:00Z", sides: [{ id: "2", name: "Red Sox" }, { id: "10", name: "Yankees", home: true }], started: false, line: 8.5 },
    { episode: 2, at: "2026-09-30T23:05:00Z", sides: [{ id: "2", name: "Red Sox" }, { id: "10", name: "Yankees", home: true }], started: false },
  ],
};
const opener = {
  sport: "basketball",
  espn: "basketball/nba",
  event: "Cavaliers at 76ers",
  games: [{ episode: 1, at: "2026-10-22T23:00:00Z", sides: [{ id: "5", name: "Cavaliers" }, { id: "20", name: "76ers", home: true }], started: false, line: 237.5 }],
};

test("the stat words to the Sport's keys: a key, a column, a label or a noun, singular or plural, never a guess", () => {
  const mlb = sportOf("baseball/mlb");
  for (const [w, k] of [["home runs", "HR"], ["a home run", "HR"], ["HR", "HR"], ["hr", "HR"], ["total bases", "TB"], ["RBIs", "RBI"], ["stolen bases", "SB"], ["strikeouts", "K"]]) assert.equal(P.statKeyOf(mlb, w), k, w);
  const nba = sportOf("basketball/nba");
  for (const [w, k] of [["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"], ["three-pointers made", "3PM"], ["steals", "STL"]]) assert.equal(P.statKeyOf(nba, w), k, w);
  assert.equal(P.statKeyOf(nba, "threes"), null, "words no stat says name none");
  assert.equal(P.statKeyOf(mlb, ""), null);
  // The pack's own words (the bank's, the server's) read the same.
  assert.equal(W.statKeyIn(P.statWords(mlb), "Home Runs"), "HR");
});

test("a sport's page: its ctx says nobody goes home, so a show's questions and scoring don't play on it", () => {
  const ctx = P.sportPageContext("basketball/nba", { show: "Cavaliers at 76ers" });
  assert.equal(ctx.results, false);
  assert.equal(ctx.shape, "team");
  assert.ok(ctx.stats.some((s) => s.key === "PTS"));
  const home = { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "out", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } }] };
  assert.ok(S.specProblems(home, ctx).some((p) => /results don't say who goes home/.test(p.problem)));
  assert.equal(P.sportPageContext("curling/wcf"), null, "a league no sport reads has none");
  assert.ok(P.sportPageContext("basketball/nba", { playoffs: true }).draws.some((d) => d.key === "playoffs"));
  // Its standard games: a playoffs-only one (the bracket) only on a playoffs page.
  assert.ok(!P.sportGames("basketball/nba").some((g) => g.id === "bracket"));
  assert.ok(P.sportGames("basketball/nba", { playoffs: true }).some((g) => g.id === "bracket"));
});

test("the pack's sports part: its sport, teams, games and lines (never a score, a line only while the game's to play), its stats in their words", () => {
  const pack = B.packOf(series);
  assert.equal(pack.kind, "sport");
  assert.deepEqual(pack.sport, { id: "baseball", name: "Baseball", league: "baseball/mlb" });
  assert.deepEqual(pack.teams.map((t) => t.name), ["Red Sox", "Yankees"]);
  assert.equal(pack.games[0].line, 8.5);
  assert.equal(pack.games[1].line, undefined);
  assert.ok(pack.knows.lines && pack.knows.finals && pack.knows.playerStats);
  assert.equal(pack.moments, undefined, "a sport has no moments");
  assert.ok(pack.stats.some((s) => s.key === "TB" && s.says === "Total bases"));
  assert.ok(pack.standard.games.some((g) => g.id === "pickem"));
  // A started game's line isn't the pack's (it's kept with the question); its score never is.
  const started = W.packOf({ label: "x", kind: "sport", sport: { league: "baseball/mlb" }, games: [{ episode: 1, sides: [{ id: "2", name: "Red Sox", score: 5 }], started: true, line: 8.5 }] });
  assert.equal(started.games[0].line, undefined);
  assert.equal(started.games[0].sides[0].score, undefined);
  const ids = W.idsOf(pack);
  assert.ok(ids.teams.has("10") && ids.stats.has("HR"));
});

test("the manual on a sport's page: its sports section and standard games in place of a show's presets, only a sport's values and examples", () => {
  const ctx = B.ctxOf(series);
  const text = W.manualFor(ctx, { kind: "sport", examples: B.requests(), games: B.gamesOf(series) });
  assert.match(text, /THIS PAGE IS A SPORT'S/);
  assert.match(text, /"line": "game"/);
  assert.match(text, /THE SPORT'S STANDARD GAMES/);
  assert.match(text, /- "pickem": Each game, before it starts/);
  assert.ok(!/PRESETS \(/.test(text), "no show presets");
  const line = (key) => text.split("\n").find((l) => l.startsWith(`- ${key}:`)) || "";
  assert.match(line("score.by"), /stats =/);
  assert.ok(!/moments =|place =/.test(line("score.by")), "a show's scoring isn't offered");
  assert.ok(!/results =|moment =|trivia =/.test(line("ask.settle")), "nor a show's settles");
  // The standard games' tables are left out (our check fills them in).
  assert.ok(!/"PYDS"/.test(W.manualFor(B.ctxOf({ sport: "football", espn: "football/nfl" }), { kind: "sport", games: B.gamesOf({ sport: "football", espn: "football/nfl" }) })));
  // Its examples are sports requests (the user's Red Sox sentence), never a show's.
  assert.ok(text.includes("For this upcoming Red Sox"));
  assert.ok(!/Survivor|castaway/.test(text.split("EXAMPLES THAT PLAY")[1] || ""));
  // A show's page is as it was: its presets, no sports section.
  const show = W.manualFor(B.ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" }), { kind: "show", examples: B.requests() });
  assert.match(show, /PRESETS \(/);
  assert.ok(!/THIS PAGE IS A SPORT'S/.test(show));
});

test("the user's Red Sox sentence, drafted as a bot might (the stat's words for keys): our check reads the keys, the same game as the tracker's", () => {
  const r = row("w002");
  const draft = { draft: 1, game: { spec: 1, get: { by: "draft", each: 3 }, count: { all: true }, score: { by: "stats", points: { home_run: 5, "total bases": 1 } } }, said: [{ part: "get", quote: "draft 3 players each" }, { part: "score", quote: "5 points for every home run and 1 point for each total base" }], assumed: [], ask: [], cantYet: [], summary: "" };
  const res = W.checkAnswer(JSON.stringify(draft), B.checkOpts(series, r.words));
  assert.equal(res.state, "game", JSON.stringify(res.ask));
  assert.deepEqual(res.spec, r.spec);
  assert.deepEqual(res.fixed.map((f) => [f.part, f.quiet]), [["score.points.HR", true], ["score.points.TB", true]]);
  // A number said of a stat by its words stays said once its key is read (the said part moves with it).
  const own = W.checkAnswer(JSON.stringify({ ...draft, said: [{ part: "get", quote: "draft 3 players each" }, { part: "score.points.home_run", quote: "5 points for every home run" }, { part: "score.points.total bases", quote: "1 point for each total base" }] }), B.checkOpts(series, r.words));
  assert.deepEqual(own.spec.score.points, { HR: 5, TB: 1 }, JSON.stringify(own.dropped));
  assert.match(res.describe.sentence, /everyone drafts 3, all season\. Scored 5 a home run and 1 a total base\./);
  // It plays as a league's game on the sport's ctx (StateLogic's writer: L3 part 2a's hook).
  const s = StateLogic.defaultState();
  for (const n of ["Aaron Judge", "Rafael Devers"]) StateLogic.addCastaway(s, n);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  assert.deepEqual(StateLogic.setGame(s, { ...res.spec, get: { ...res.spec.get, each: 1 } }, { ctx: B.ctxOf(series) }), []);
});

test("the user's 76ers sentence: an over/under they gave no line takes the game's own (ESPN's), and a line they said stays", () => {
  const r = row("w003");
  const asks = (line) => [
    { id: "winner", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } },
    { id: "top", ask: "Who scores the most points?", answer: "person", points: 1, settle: { by: "stat", stat: "points", take: "most" } },
    { id: "total", ask: "Total points: over or under?", answer: "overUnder", ...(line === undefined ? {} : { line }), points: 1, settle: { by: "final", take: "total" } },
  ];
  const said = [{ part: "ask", quote: "predict 3 things: winner, top scorer, and over/under total points" }, { part: "span", quote: "the 76ers home opener" }];
  for (const line of [237.5, undefined, null]) {
    const draft = { draft: 1, game: { spec: 1, span: { from: 1, to: 1 }, get: { by: "none" }, score: { by: "answers" }, ask: asks(line) }, said, assumed: [{ part: "ask", value: 1, why: "a point each" }], ask: [], cantYet: [], summary: "" };
    const res = W.checkAnswer(JSON.stringify(draft), B.checkOpts(opener, r.words));
    assert.equal(res.state, "game", `${line}: ${JSON.stringify([res.ask, res.problems])}`);
    assert.deepEqual(res.spec, r.spec, String(line));
    assert.ok(res.assumed.some((a) => a.part === "ask[2].line" && a.value === "game" && /ESPN's line/.test(a.why)));
    assert.ok(res.assumed.some((a) => a.part === "ask[1].settle.stat" && a.value === "PTS"));
  }
  // A line in their words is theirs.
  const words = "76ers home opener: winner and over/under 230.5 total points";
  const draft = { draft: 1, game: { span: { from: 1, to: 1 }, get: { by: "none" }, score: { by: "answers" }, ask: [asks(230.5)[2]] }, said: [{ part: "ask[0]", quote: "over/under 230.5 total points" }], assumed: [{ part: "ask", value: 1, why: "a point" }], ask: [], cantYet: [], summary: "" };
  const own = W.checkAnswer(JSON.stringify(draft), B.checkOpts(opener, words));
  assert.equal(own.spec.ask[0].line, 230.5);
  assert.match(own.describe.sentence, /over or under \(230\.5\)/);
});

test("our check on a sport's page: the standard table where no points were named, a team by its name, a show's preset the sport's own game", () => {
  const opts = (words) => B.checkOpts(series, words);
  // Points per stat with none named: the sport's standard table (Yahoo's), shown as ours.
  const none = W.checkAnswer(JSON.stringify({ game: { get: { by: "draft", each: 3 }, count: { all: true }, score: { by: "stats" } }, said: [{ part: "get", quote: "draft 3 each" }, { part: "score", quote: "by their stats" }] }), opts("draft 3 each, scored by their stats"));
  assert.equal(none.state, "game", JSON.stringify(none.problems));
  assert.ok(none.spec.score.points.TB > 0 && none.spec.score.points.SV > 0, "Yahoo's table: a total base, a save");
  assert.ok(none.assumed.some((a) => a.part === "score.points" && /standard table/.test(a.why)));
  // A team's stat by the team's name: its id; one the page hasn't got: out, and asked whose.
  const q = (of) => ({ game: { span: { from: 1, to: 1 }, get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "hr", ask: "How many home runs?", answer: "number", points: 1, settle: { by: "stat", stat: "HR", take: "value", of } }] }, said: [{ part: "ask", quote: "how many home runs" }], assumed: [{ part: "ask", value: 1, why: "a point" }] });
  const named = W.checkAnswer(JSON.stringify(q("Yankees")), opts("how many home runs do the Yankees hit"));
  assert.equal(named.spec.ask[0].settle.of, "10");
  // Two teams that fit the words name neither (two "Sox"), so it's asked.
  const sox = W.checkAnswer(JSON.stringify(q("Sox")), B.checkOpts({ ...series, teams: [{ id: "2", name: "Red Sox" }, { id: "4", name: "White Sox" }] }, "how many home runs do the Sox hit"));
  assert.equal(sox.spec.ask[0].settle.of, undefined);
  const unknown = W.checkAnswer(JSON.stringify(q("Mets")), opts("how many home runs do the Mets hit"));
  assert.equal(unknown.spec.ask[0].settle.of, undefined);
  assert.ok(unknown.dropped.some((d) => d.part === "ask[0].settle.of") && unknown.ask.some((a) => a.part === "ask[0].settle.of" && a.options.includes("Yankees")));
  // A show's preset (Weekly Lineup) on a sport's page: the sport's own most like it (a season-long league), asked which game.
  const preset = W.checkAnswer(JSON.stringify({ game: { preset: "weekly-lineup" }, said: [{ part: "preset", quote: "a weekly lineup" }] }), opts("a weekly lineup"));
  assert.equal(preset.spec.preset, undefined);
  assert.equal(preset.spec.score.by, "stats");
  assert.ok(Object.keys(preset.spec.score.points).length > 5 && !preset.dropped.some((d) => /^score\.points\./.test(d.part)), "the standard table whole, its numbers ours");
  assert.deepEqual(S.specProblems(preset.spec, B.ctxOf(series)), []);
  const which = preset.ask.find((a) => a.part === "preset");
  assert.equal(which.options[0], "Season-long league");
  // A pool on a sport: nobody goes home, so a right pick is one who scores.
  const pool = W.checkAnswer(JSON.stringify({ game: { get: { by: "pick", each: 1 }, score: { by: "survive" } }, said: [{ part: "get", quote: "pick one player" }] }), opts("pick one player each game"));
  assert.equal(pool.spec.score.means, "scores");
  assert.match(pool.describe.sentence, /picks one player to score each game/);
  // Nothing in their words says which game: the sport's own games, never a show's.
  const vague = W.checkAnswer(JSON.stringify({ game: { get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "w", ask: "Who wins?", answer: "side", points: 1, asked: "each", settle: { by: "final", take: "winner" } }] }, assumed: [{ part: "ask", value: 1, why: "a point" }] }), opts("something for this series"));
  const game = vague.ask.find((a) => a.question === "Which game?");
  assert.ok(game && game.options.includes("Pick'em") && !game.options.includes("Weekly Lineup"), JSON.stringify(vague.ask));
});
