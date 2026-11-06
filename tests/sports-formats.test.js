// The formats as the engine's pieces with sports data (docs/PLAN-start-a-game-gpt.md track L, L4). Part 1a: pick'em (who wins
// each game, a soccer match's draw an answer too) and pick a few (three names, each right one scoring), the engine's questions
// (A4) on the sports settles, as each sport's default specs (src/lib/sports/defaults/*.json: `pickem`, `pickAFew`), checked by
// the game spec's own check and graded by its grader from the recorded fixtures (tests/fixtures/espn/), the kept final's way too
// (final.ts storedFacts, as the server reads one). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const L = jiti("../src/lib/sports/index.ts");
const { sportOf, sportById, allSports, defaultsFor, specContextOf, gameFacts, storedGame, storedFacts, shapeOf } = L;
const { specProblems, verdictOf, pointsFor, answerProblem, DRAW } = require("../src/lib/game/game-spec/index.js");

const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
const factsOf = (game) => ({ from: 1, to: 1, over: false, episodes: new Map(), names: new Map(), games: new Map([[1, game]]) });
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name).id;
const teamOf = (box, name) => box.teams.find((t) => t.name.includes(name)).id;
const points = (q, facts, answers) => Object.fromEntries(pointsFor(q, verdictOf(q, 1, facts), answers.map(([playerId, answer]) => ({ playerId, answer })), facts));
const spec = (sport, name, league) => defaultsFor(sport, league).specs[name].spec;

const soccer = sportOf("soccer/usa.1");
// A team game's facts at its final, from its recorded summary (as the phone's poller or a later watch works them out).
const finalOf = (sport, summary) => {
  const box = sport.readBox(summary);
  return { box, facts: factsOf(gameFacts(sport, sport.stateAt(summary), { status: "final", sides: box.teams.map((t) => t.id), people: box.people })) };
};

test("every sport has a pick'em and a pick a few, as data the engine's check passes; a draw is an answer only on who wins a team game", () => {
  for (const sport of allSports()) {
    const d = defaultsFor(sport.id, sport.leagues?.[0]);
    assert.ok(d.specs.pickem, `${sport.name}: a pick'em`);
    if (sport.id !== "mma" && sport.id !== "tennis") assert.ok(d.specs.pickAFew, `${sport.name}: a pick a few`);
  }
  // Soccer's pick'em takes a draw; the rest's don't.
  assert.equal(spec("soccer", "pickem").ask[0].draw, true);
  assert.equal(spec("basketball", "pickem").ask[0].draw, undefined);
  const ctx = specContextOf(soccer);
  const pickem = spec("soccer", "pickem");
  const with_ = (q) => ({ ...pickem, ask: [{ ...pickem.ask[0], ...q }] });
  assert.ok(problems(with_({ draw: false }), ctx).includes("ask[0].draw: A draw is one of the answers (draw: true), or leave it out"));
  assert.ok(problems(with_({ answer: "number", settle: { by: "final", take: "total" } }), ctx).includes("ask[0].draw: Only who wins a game (a side answer) takes a draw as an answer"));
  // A field or a card is won by someone: no draw.
  const golfQ = spec("golf", "pickem");
  assert.ok(problems({ ...golfQ, ask: [{ ...golfQ.ask[0], draw: true }] }, specContextOf(sportOf("golf/pga"))).includes("ask[0].draw: Only who wins a game (a side answer) takes a draw as an answer"));
  assert.ok(problems({ ...pickem, ask: [{ ...pickem.ask[0] }] }, specContextOf(sportOf("golf/pga"))).includes("ask[0].draw: A field's winner is someone: no draw to pick"));
  // A draw's answer: the sides, or a draw where the question takes one.
  assert.equal(answerProblem({ answer: "side", draw: true }, DRAW, new Set(["1", "2"])), null);
  assert.equal(answerProblem({ answer: "side", draw: true }, "3", new Set(["1", "2"])), "Pick one of the sides, or a draw");
  assert.equal(answerProblem({ answer: "side" }, DRAW, new Set(["1", "2"])), "Pick one of the sides");
});

test("soccer's pick'em: a league match that ends level is a draw; a cup tie won on penalties or in extra time is its winner's", () => {
  const q = spec("soccer", "pickem").ask[0];
  const plain = { ...q, draw: undefined };
  // San Diego 2, Seattle 2 (MLS): the draw is right; a question without draws has nobody right.
  const mls = finalOf(soccer, require("./fixtures/espn/mls-761901.json"));
  assert.deepEqual(verdictOf(q, 1, mls.facts), { state: "known", right: [DRAW] });
  assert.equal(verdictOf(plain, 1, mls.facts).state, "off");
  assert.deepEqual(points(q, mls.facts, [["a", DRAW], ["b", teamOf(mls.box, "San Diego")]]), { a: 1 });
  // Australia 1, Egypt 1, Egypt through 4-2 on penalties (the World Cup): Egypt's, whether or not the question takes a draw.
  const wc = finalOf(soccer, require("./fixtures/espn/wc-760499.json"));
  const sideOf = (name) => wc.facts.games.get(1).sides.find((s) => s.id === teamOf(wc.box, name));
  assert.deepEqual([sideOf("Australia"), sideOf("Egypt")].map((s) => [s.score, s.shootout]), [[1, 2], [1, 4]], "level, and each side's shootout goals");
  assert.deepEqual(verdictOf(q, 1, wc.facts).right, [teamOf(wc.box, "Egypt")]);
  assert.deepEqual(verdictOf(plain, 1, wc.facts).right, [teamOf(wc.box, "Egypt")]);
  assert.equal(verdictOf({ id: "t", ask: "?", answer: "number", points: 1, settle: { by: "final", take: "total" }, asked: "each", closes: "start" }, 1, wc.facts).value, 2, "the total is the match's goals: never the shootout's");
  // Holstein Kiel 1, Hoffenheim 1, Kiel through 4-3 on penalties (the DFB-Pokal, ESPN's thinner feed).
  const dfb = finalOf(soccer, require("./fixtures/espn/dfb-401917034.json"));
  assert.deepEqual(verdictOf(q, 1, dfb.facts).right, [teamOf(dfb.box, "Kiel")]);
  // Spain 1, Argentina 0 after extra time: Spain's (a sportsbook's three ways would call it a draw at 90 minutes: not ours).
  const aet = finalOf(soccer, require("./fixtures/espn/wc-760517.json"));
  assert.deepEqual(verdictOf(q, 1, aet.facts).right, [teamOf(aet.box, "Spain")]);
  // The kept final reads the same: the server's way (storedFacts), the shootout from its kept lines.
  const kept = JSON.parse(JSON.stringify(storedGame(soccer, require("./fixtures/espn/wc-760499.json"))));
  assert.deepEqual(verdictOf(q, 1, factsOf(storedFacts(soccer, kept, "final"))).right, [teamOf(wc.box, "Egypt")]);
  assert.deepEqual(shapeOf(kept), { kind: "team", shootout: { [teamOf(wc.box, "Australia")]: 2, [teamOf(wc.box, "Egypt")]: 4 } }, "kept as ESPN's header says it");
  // ESPN's own shootout score is read over the players' kicks: a kept final whose kicks went missing still has Egypt through.
  const bare = { ...kept, lines: Object.fromEntries(Object.entries(kept.lines).map(([id, l]) => [id, { ...l, SOGOAL: 0 }])) };
  assert.deepEqual(verdictOf(q, 1, factsOf(storedFacts(soccer, bare, "final"))).right, [teamOf(wc.box, "Egypt")]);
  const keptDraw = JSON.parse(JSON.stringify(storedGame(soccer, require("./fixtures/espn/mls-761901.json"))));
  assert.deepEqual(verdictOf(q, 1, factsOf(storedFacts(soccer, keptDraw, "final"))).right, [DRAW]);
  assert.equal(shapeOf(keptDraw), null, "a draw with no shootout keeps no shape");
});

test("pick a few: three names, each one who leads the game scoring; the 76ers' opener's tie at the top, Bermuda's winner", () => {
  const nba = sportOf("basketball/nba");
  const sixers = finalOf(nba, require("./fixtures/espn/nba-401909093.json"));
  const q = spec("basketball", "pickAFew").ask[0];
  const [maxey, mitchell, embiid] = ["Tyrese Maxey", "Donovan Mitchell", "Joel Embiid"].map((n) => nameOf(sixers.box, n));
  // Maxey and Mitchell tied on 32: both right, 3 points each.
  assert.deepEqual(points(q, sixers.facts, [["a", [maxey, mitchell, embiid]], ["b", [maxey, embiid, nameOf(sixers.box, "Evan Mobley")]], ["c", [embiid]]]), { a: 6, b: 3 });
  // Its pick'em: the side that won.
  assert.deepEqual(points(spec("basketball", "pickem").ask[0], sixers.facts, [["a", "20"], ["b", "5"]]), { a: 1 });
  // A field: one of three is the winner.
  const golf = sportOf("golf/pga");
  const BERMUDA = require("./fixtures/espn/pga-401850917.json");
  const state = golf.stateAt(BERMUDA);
  const facts = factsOf(gameFacts(golf, state, { status: "final" }));
  const [first] = state.standings.filter((s) => s.place === 1).map((s) => s.id);
  const others = state.standings.filter((s) => s.place > 1).slice(0, 4).map((s) => s.id);
  assert.deepEqual(points(spec("golf", "pickAFew").ask[0], facts, [["a", [others[0], first, others[1]]], ["b", others.slice(1, 4)]]), { a: 5 });
  // Baseball's by total bases (derived from the plays' counts: Sport.full), the Red Sox-Yankees game's leader.
  const mlb = sportById("baseball");
  const game = finalOf(mlb, require("./fixtures/espn/mlb-401907924.json"));
  const tb = verdictOf(spec("baseball", "pickAFew").ask[0], 1, game.facts);
  assert.equal(tb.state, "known");
  assert.ok(tb.value >= 4 && tb.right.length >= 1, `the most total bases: ${tb.value}`);
});

test("lineup locks per sport: each game's own start, its day's first, its week's first (Tuesday to Monday); a game with no start has none", () => {
  const { locksOf, specCloses } = L;
  // Each sport's cadence, as its season spec says it.
  assert.deepEqual(["basketball", "hockey", "baseball", "football", "soccer", "golf", "racing", "mma", "tennis"].map((id) => specCloses(sportById(id).lock)), ["daily", "daily", "daily", "weekly", "weekly", "start", "start", "start", "daily"]);
  // An NFL week as ESPN lists it: Thursday night, Sunday's three windows, Monday night; then the next Thursday.
  const week = [
    { episode: 1, at: "2026-11-06T01:15:00Z" }, // Thu 8:15 PM EST
    { episode: 2, at: "2026-11-08T18:00:00Z" }, // Sun 1 PM
    { episode: 3, at: "2026-11-08T21:25:00Z" }, // Sun 4:25 PM
    { episode: 4, at: "2026-11-09T01:20:00Z" }, // Sun 8:20 PM EST (Monday in UTC)
    { episode: 5, at: "2026-11-10T01:15:00Z" }, // Mon 8:15 PM
    { episode: 6, at: "2026-11-13T01:15:00Z" }, // the next Thu
    { episode: 7, at: null }, // not scheduled yet
  ];
  const at = (m) => [1, 2, 3, 4, 5, 6, 7].map((n) => m.get(n) ?? null);
  assert.deepEqual(at(locksOf(week, "start")), [...week.slice(0, 6).map((w) => new Date(w.at).toISOString()), null]);
  const sunday = "2026-11-08T18:00:00.000Z";
  assert.deepEqual(at(locksOf(week, "daily")), ["2026-11-06T01:15:00.000Z", sunday, sunday, sunday, "2026-11-10T01:15:00.000Z", "2026-11-13T01:15:00.000Z", null], "Sunday night's game is Sunday's in Eastern time");
  assert.deepEqual(at(locksOf(week, "weekly")), [...Array(5).fill("2026-11-06T01:15:00.000Z"), "2026-11-13T01:15:00.000Z", null]);
  // A lock is never after the episode's own start.
  for (const [n, lock] of locksOf(week, "weekly")) assert.ok(Date.parse(lock) <= Date.parse(week[n - 1].at));
  // A doubleheader: both games lock at the first's start by the day, each at its own by its start.
  const twice = [{ episode: 1, at: "2026-07-04T17:05:00Z" }, { episode: 2, at: "2026-07-04T23:10:00Z" }, { episode: 3, at: "2026-07-05T17:35:00Z" }];
  assert.deepEqual(at(locksOf(twice, "daily")).slice(0, 3), ["2026-07-04T17:05:00.000Z", "2026-07-04T17:05:00.000Z", "2026-07-05T17:35:00.000Z"]);
});
