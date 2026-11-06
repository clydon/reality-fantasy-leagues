// The sports settles (docs/PLAN-start-a-game-gpt.md track L, L1 part 4b): a question a sport's game settles, `final` (who wins,
// the total, the margin; a field's winner, a card's bout's) and `stat` (who has the most or least of it, how many: of a player, a
// team or the game), checked by the game spec's own check (schema.js) against a sport's ctx, graded by its grader
// (answers.js sportsVerdict) from the sports' facts (src/lib/sports/spec.ts gameFacts: the game as of the viewer's moment). On
// the user's 76ers sentence (tests/fixtures/sports-examples.js) and the recorded fixtures (tests/fixtures/espn/), and live: the
// 76ers' opener replayed through the phone's poller in virtual time, an over known the moment the total passed its line, a
// later watch 20 minutes behind seeing it 20 minutes later. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const L = jiti("../src/lib/sports/index.ts");
const { sportOf, sportById, specContextOf, gameFacts, LiveGame } = L;
const { specProblems, verdictOf, pointsFor, answerProblem } = require("../src/lib/game/game-spec/index.js");
const { asOf, bounds } = require("../scripts/dev-test/espn-replay.js");
const { virtual } = require("./harness/virtual-time");
const examples = require("./fixtures/sports-examples.js");

const MIN = 60_000;
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name).id;
const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
const factsOf = (game) => ({ from: 1, to: 1, over: false, episodes: new Map(), names: new Map(), games: new Map([[1, game]]) });
// A game of questions on one game, its questions as given.
const quiz = (ask, span = { from: 1, to: 1 }) => ({ spec: 1, span, pool: { of: "cast", where: null }, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, closes: "start", ask });
const q = (answer, settle, more = {}) => ({ id: "q", ask: "?", answer, points: 1, settle, ...more });

const SIXERS = require("./fixtures/espn/nba-401909093.json");
const nba = sportOf("basketball/nba");

test("the check: a sports question is a game's (asked each episode, or once in a game of one); whose is a stat's or a bout's; a place's best is its least; a final says what the sport's do", () => {
  const ex = examples.sixersOpener;
  const ctx = specContextOf(nba);
  assert.deepEqual(problems(ex.spec, ctx), [], "the user's 76ers sentence");
  const season = { from: 1, to: null };
  assert.ok(problems(quiz([q("side", { by: "final", take: "winner" }, { asked: "once" })], season), ctx).includes("ask[0].asked: A final is one game's: ask it each episode, or once in a game of just one"));
  assert.deepEqual(problems(quiz([q("number", { by: "stat", stat: "HR", take: "value" }, { asked: "once" })], { from: 1, to: 3 }), specContextOf(sportById("baseball"))), [], "a stat over the game's span: a series' home runs");
  assert.deepEqual(problems(quiz([q("side", { by: "final", take: "winner" }, { asked: "each" })], season), ctx), []);
  assert.ok(problems(quiz([q("number", { by: "stat", stat: "PTS", take: "value" }, { asked: "each", over: 3 })], season), ctx).some((p) => /that game's/.test(p)), "never over a window");
  assert.deepEqual(problems(quiz([q("overUnder", { by: "stat", stat: "PTS", take: "value", of: "4431679" }, { line: 25.5 })]), ctx), [], "a player's line");
  assert.ok(problems(quiz([q("number", { by: "final", take: "total", of: "20" })]), ctx).includes("ask[0].settle.of: Only a stat, who wins a card's bout, or a draw's bracket says whose"));
  assert.ok(problems(quiz([q("person", { by: "stat", stat: "PTS", take: "most", of: "" })]), ctx).some((p) => /Whose:/.test(p)));
  assert.ok(problems(quiz([q("person", { by: "stat", stat: "XYZ", take: "most" })]), ctx).some((p) => /Nothing counts "XYZ"/.test(p)));
  assert.ok(problems(quiz([q("person", { by: "moment", moment: "m", stat: "PTS", take: "happened" })]), ctx).includes("ask[0].settle.stat: Only a stat settles by a stat"));
  // A field: who wins is a person, a place's most is the last place, and there's no total.
  const golf = specContextOf(sportOf("golf/pga"));
  assert.deepEqual(problems(quiz([q("person", { by: "final", take: "winner" })]), golf), []);
  assert.deepEqual(problems(quiz([q("person", { by: "stat", stat: "POS", take: "least" })]), golf), []);
  assert.ok(problems(quiz([q("person", { by: "stat", stat: "POS", take: "most" })]), golf).includes("ask[0].settle.take: POS is a place: the most of it is the last place, so who places best is the least"));
  assert.ok(problems(quiz([q("number", { by: "final", take: "total" })]), golf).includes("ask[0].settle.take: A field's final says who wins: no total or margin"));
  assert.ok(problems(quiz([q("side", { by: "final", take: "winner" })]), golf).includes("ask[0].answer: A field is won by someone: answer person"));
  assert.ok(problems(quiz([q("person", { by: "final", take: "winner" })]), ctx).includes("ask[0].answer: A team game is won by a side: answer side"));
  assert.ok(problems(quiz([q("side", { by: "final", take: "winner", of: "20" })]), ctx).includes("ask[0].settle.of: Only a card's bout says whose win: a game has one winner"));
  assert.ok(problems(quiz([q("person", { by: "stat", stat: "POS", take: "least" }, { asked: "once" })], { from: 1, to: 3 }), golf).includes("ask[0].asked: POS is a place, which doesn't add up over games: ask it each episode"));
  // A card: the main event's winner, or a bout's by its id.
  const mma = specContextOf(sportOf("mma/ufc"));
  assert.deepEqual(problems(quiz([q("person", { by: "final", take: "winner", of: "main" })]), mma), []);
  // A side answer is a side.
  assert.equal(answerProblem({ answer: "side" }, "20", new Set(["20", "5"])), null);
  assert.equal(answerProblem({ answer: "side" }, "13", new Set(["20", "5"])), "Pick one of the sides");
  assert.equal(answerProblem({ answer: "side" }, "", null), "Pick a side");
});

test("the 76ers' opener as the user typed it: the winner, the top scorer (a tie: both right) and the under, from the final", () => {
  const ex = examples.sixersOpener;
  const box = nba.readBox(SIXERS);
  const game = gameFacts(nba, nba.stateAt(SIXERS), { status: "final", sides: box.teams.map((t) => t.id), people: box.people });
  const facts = factsOf(game);
  const [winner, top, total] = ex.spec.ask.map((x) => ({ ...x, asked: "once" }));
  assert.deepEqual(verdictOf(winner, 1, facts), { state: "known", right: [ex.settles.winner] });
  const v = verdictOf(top, 1, facts);
  assert.equal(v.value, ex.settles.top.PTS);
  assert.deepEqual(v.right.map((id) => box.people[id].name).sort(), [...ex.settles.top.people].sort());
  assert.deepEqual(verdictOf(total, 1, facts), { state: "known", right: [], value: ex.settles.total });
  // Graded: the side, a person (either of the tied), the under.
  const points = (question, answers) => Object.fromEntries(pointsFor(question, verdictOf(question, 1, facts), answers, facts));
  // (pointsFor lists who earned something.)
  assert.deepEqual(points(winner, [{ playerId: "a", answer: "20" }, { playerId: "b", answer: "5" }]), { a: 1 });
  assert.deepEqual(points(top, [{ playerId: "a", answer: nameOf(box, "Donovan Mitchell") }, { playerId: "b", answer: nameOf(box, "Tyrese Maxey") }, { playerId: "c", answer: nameOf(box, "Joel Embiid") }]), { a: 1, b: 1 });
  assert.deepEqual(points(total, [{ playerId: "a", answer: "under" }, { playerId: "b", answer: "over" }]), { a: 1 });
  // The margin, a team's and a player's numbers, the least.
  const st = (settle) => verdictOf(q("number", settle, { asked: "once" }), 1, facts);
  assert.equal(st({ by: "final", take: "margin" }).value, 8);
  assert.equal(st({ by: "stat", stat: "PTS", take: "value", of: "20" }).value, 114, "a team's players' points add to its score");
  assert.equal(st({ by: "stat", stat: "PTS", take: "value", of: nameOf(box, "Tyrese Maxey") }).value, 32);
  assert.equal(st({ by: "stat", stat: "PTS", take: "value" }).value, 220, "the game's");
  const most = verdictOf(q("person", { by: "stat", stat: "REB", take: "most", of: "5" }, { asked: "once" }), 1, facts);
  assert.ok(most.right.every((id) => box.people[id].team === "5"), "among the Cavaliers only");
});

test("what doesn't count either way: a game called off, a tie, nobody with the stat; before the start, waiting", () => {
  const winner = q("side", { by: "final", take: "winner" }, { asked: "once" });
  const at = (game) => verdictOf(winner, 1, factsOf({ sides: [{ id: "1", score: 3 }, { id: "2", score: 3 }], lines: {}, teams: {}, ...game }));
  assert.equal(at({ status: "off" }).state, "off");
  assert.match(at({ status: "final" }).why, /A tie/);
  assert.deepEqual(at({ status: "pre" }), { state: "waiting" });
  assert.deepEqual(verdictOf(winner, 1, { from: 1, to: 1, episodes: new Map() }), { state: "waiting" }, "no games read: waiting");
  const steals = q("person", { by: "stat", stat: "STL", take: "most" }, { asked: "once" });
  assert.equal(verdictOf(steals, 1, factsOf({ status: "final", sides: [], lines: { a: { STL: 0 } }, teams: {} })).state, "off");
  // A stat under 0 (plus-minus): the most of those who have it.
  const pm = q("person", { by: "stat", stat: "PM", take: "most" }, { asked: "once" });
  assert.deepEqual(verdictOf(pm, 1, factsOf({ status: "final", sides: [], lines: { a: { PM: -3 }, b: { PM: -1 }, c: { PTS: 2 } }, teams: {} })), { state: "known", right: ["b"], value: -1 });
  // A season-long stat asked once: one game final isn't the season's.
  const season = { from: 1, to: null, over: false, episodes: new Map(), names: new Map(), games: new Map([[1, { status: "final", sides: [], lines: { a: { HR: 1 } }, teams: {} }]]) };
  assert.equal(verdictOf(q("person", { by: "stat", stat: "HR", take: "most" }, { asked: "once" }), 0, season).state, "waiting");
  assert.equal(verdictOf(q("person", { by: "stat", stat: "HR", take: "most" }, { asked: "once" }), 0, { ...season, over: true }).state, "known");
});

test("a stat asked once, over the game's span: the Red Sox-Yankees series' home runs, its two games added up", () => {
  const ex = examples.redSoxYankees;
  const baseball = sportById("baseball");
  const games = new Map();
  let first;
  ex.recorded.forEach((f, i) => {
    const game = require(`./fixtures/${f}`);
    const box = baseball.readBox(game);
    first = first ?? box;
    games.set(i + 1, gameFacts(baseball, baseball.reduce(baseball.timeline(game)), { status: "final", sides: box.teams.map((t) => t.id), people: box.people }));
  });
  const facts = { from: 1, to: 2, over: true, episodes: new Map(), names: new Map(), games };
  const hr = (take, of) => verdictOf(q(take === "value" ? "number" : "person", { by: "stat", stat: "HR", take, ...(of ? { of } : {}) }, { asked: "once" }), 0, facts);
  const most = hr("most");
  assert.equal(most.value, 2);
  assert.deepEqual(most.right.map((id) => first.people[id]?.name), ["Ben Rice"], "the series' most: two");
  assert.equal(hr("value", most.right[0]).value, 2);
  assert.equal(hr("value").value, ex.settles.best.reduce((n, b) => n + b.HR, 0), "the series' home runs: every one of them");
  // Before the second game's final, it stands where the first left it.
  const partway = { ...facts, games: new Map([[1, games.get(1)], [2, { ...games.get(2), status: "in" }]]) };
  assert.equal(verdictOf(q("number", { by: "stat", stat: "HR", take: "value" }, { asked: "once" }), 0, partway).state, "waiting");
});

test("a field and a card: golf's winner from its places, the least place; a fight card's main event and a bout by its id", () => {
  const golf = sportOf("golf/pga");
  const BERMUDA = require("./fixtures/espn/pga-401850917.json");
  const state = golf.stateAt(BERMUDA);
  const facts = factsOf(gameFacts(golf, state, { status: "final" }));
  const first = state.standings.filter((s) => s.place === 1).map((s) => s.id);
  assert.deepEqual(verdictOf(q("person", { by: "final", take: "winner" }, { asked: "once" }), 1, facts).right, first);
  assert.deepEqual(verdictOf(q("person", { by: "stat", stat: "POS", take: "least" }, { asked: "once" }), 1, facts).right, first);

  const mma = sportOf("mma/ufc");
  const UFC324 = require("./fixtures/espn/ufc-600057024.json");
  const card = mma.card(UFC324);
  const cardFacts = factsOf(gameFacts(mma, mma.stateAt(UFC324), { status: "final", card }));
  const main = card.bouts.find((b) => b.main);
  const result = mma.stateAt(UFC324).bouts[main.id].result;
  assert.deepEqual(verdictOf(q("person", { by: "final", take: "winner" }, { asked: "once" }), 1, cardFacts).right, [result.winner], "the main event, by default");
  const gaethje = card.bouts.find((b) => b.sides.includes(nameOf(mma.readBox(UFC324), "Justin Gaethje")));
  assert.deepEqual(verdictOf(q("person", { by: "final", take: "winner", of: gaethje.id }, { asked: "once" }), 1, cardFacts).right, [nameOf(mma.readBox(UFC324), "Justin Gaethje")]);
  assert.match(verdictOf(q("person", { by: "final", take: "winner", of: "nope" }, { asked: "once" }), 1, cardFacts).why, /isn't on the card/);
  assert.throws(() => gameFacts(mma, mma.stateAt(UFC324), { status: "final" }), /need the card/);
  const draw = factsOf({ status: "final", sides: [], lines: {}, teams: {}, bouts: { b: { sides: ["x", "y"], winner: null, outcome: "draw", main: true } } });
  assert.match(verdictOf(q("person", { by: "final", take: "winner" }, { asked: "once" }), 1, draw).why, /A draw/);
});

test("live, through the phone's poller in virtual time: the 76ers' opener, an over known the moment the total passes its line, the rest at the final; 20 minutes behind, 20 minutes later", async () => {
  const sport = nba;
  const b = bounds(SIXERS, sport);
  const vt = virtual(b.first - 20 * MIN);
  const fetch = async () => ({ ok: true, status: 200, json: async () => asOf(SIXERS, vt.now(), { sport }) });
  const g = new LiveGame({ sport, league: SIXERS._recorded.league, event: SIXERS._recorded.event, every: 30_000, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  const over = q("overUnder", { by: "final", take: "total" }, { asked: "once", line: 200.5 });
  const under = q("overUnder", { by: "final", take: "total" }, { asked: "once", line: examples.sixersOpener.line.overUnder });
  const winner = q("side", { by: "final", take: "winner" }, { asked: "once" });
  const statusOf = (final, on) => (final ? "final" : on ? "in" : "pre");
  const factsAt = (state, status) => factsOf(gameFacts(sport, state, { status, sides: g.sides, people: g.people }));
  let liveAt = null;
  const seen = [];
  g.start();
  await vt.settle();
  for (let i = 0; i < 5000 && (await vt.advance()); i++) {
    const at = vt.now();
    const now = g.state(L.live());
    const facts = factsAt(now, statusOf(g.final, g.status === "in"));
    const v = verdictOf(over, 1, facts);
    if (v.state === "known" && liveAt === null) {
      liveAt = at;
      assert.ok(v.early && v.value > 200.5 && !g.final, "known early, before the final");
      assert.equal(now.score["20"] + now.score["5"], v.value);
    }
    if (liveAt !== null) assert.equal(verdictOf(over, 1, facts).state, "known", "and it stays known");
    // Live, the winner is still waiting, with who's ahead.
    const w = verdictOf(winner, 1, facts);
    if (!g.final && w.live) seen.push(w.live.right[0]);
    if (!g.final) assert.notEqual(w.state, "known", "nobody wins before the final");
  }
  assert.ok(g.final, "the game ended");
  assert.ok(liveAt !== null, "the over was known live");
  // Someone 20 minutes behind (synced): at each moment, the game as of 20 minutes before it, never final before they reach its
  // end. They know the over 20 minutes after the live viewer did (within an ask: the live one knew it at the next answer).
  let lateAt = null;
  for (let t = b.first; t <= b.end + 30 * MIN && lateAt === null; t += 15_000) {
    const m = t - 20 * MIN;
    const late = g.stateAt(m);
    if (verdictOf(over, 1, factsAt(late, statusOf(m >= b.last, late.plays > 0))).state === "known") lateAt = t;
  }
  assert.ok(lateAt !== null && Math.abs(lateAt - liveAt - 20 * MIN) <= 45_000, `20 minutes behind: ${(lateAt - liveAt) / MIN} minutes later`);
  assert.ok(seen.includes("20") && seen.includes("5"), "both led at some point");
  // At the final: the answers settle as the recording's box score says.
  const end = factsAt(g.state(L.ended()), "final");
  assert.deepEqual(verdictOf(winner, 1, end).right, ["20"]);
  assert.deepEqual(verdictOf(under, 1, end), { state: "known", right: [], value: 220 });
  assert.equal(verdictOf(over, 1, end).early, undefined, "the final's verdict is the final's");
});
