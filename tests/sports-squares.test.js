// Squares and brackets (docs/PLAN-start-a-game-gpt.md track L, L4 part 2). Squares: a grid of a team game's two scores' last digits,
// the squares picked or dealt, the digits drawn from a seed, paid at the periods' ends the spec names (sequence/squares.js), each
// period's end read from the plays (TeamSport.periodScores, kept with the final: final.ts) on the recorded fixtures: the 76ers'
// opener's quarters, an NFL game's, a hockey game won in a shootout. Brackets: a draw's winners round by round, before it starts
// (sequence/bracket.js, graded by answers.js), on the 2026 US Open's recorded draws, the live card's way and the kept final's. Each
// sport's default squares or bracket passes the engine's check against its sport, and plays (L3 part 2e). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, defaultsFor, specContextOf, gameFacts, storedGame, storedCard, storedFacts, shapeOf, headerTeams, periodEnds } = jiti("../src/lib/sports/index.ts");
const Sq = require("../src/lib/game/sequence/squares.js");
const Br = require("../src/lib/game/sequence/bracket.js");
const { specProblems, specWaitsFor, squaresParts, describeSpec, verdictOf, pointsFor, answerProblem, isRight } = require("../src/lib/game/game-spec/index.js");

const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
const clone = (x) => JSON.parse(JSON.stringify(x));
const spec = (sport, name, league) => defaultsFor(sport, league).specs[name].spec;
const nba = sportOf("basketball/nba");
const nfl = sportOf("football/nfl");
const nhl = sportOf("hockey/nhl");
const tennis = sportOf("tennis/atp");
const OPENER = require("./fixtures/espn/nba-401909093.json");
const NFL = require("./fixtures/espn/nfl-401872958.json");
const SHOOTOUT = require("./fixtures/espn/nhl-401892547.json");
const USOPEN = require("./fixtures/espn/atp-189-2026.json");

// The grid with each digit in its own place (row r is r, column c is c): a square's number is its two digits.
const PLAIN = { rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d]), cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d]) };
// A team game's facts at its final, its periods' ends read live (the phone's way) or from its kept final (the server's).
const liveFacts = (sport, summary) => gameFacts(sport, sport.stateAt(summary), { status: "final", sides: headerTeams(summary).map((t) => t.id), periods: sport.periodScores(summary) });
const keptFacts = (sport, summary) => storedFacts(sport, clone(storedGame(sport, summary)), "final");
const ends = (sport, summary) => sport.periodScores(summary).map((e) => headerTeams(summary).map((t) => e[t.id]));
const cells = (r) => r.pays.map((p) => p.cell);

test("each period's end from the plays: the 76ers' opener's quarters, an NFL game's, overtime and a shootout kept apart", () => {
  // Rows are the first side in ESPN's header (the home side), the columns the second.
  assert.deepEqual(ends(nba, OPENER), [[18, 35], [45, 69], [82, 90], [114, 106]]);
  assert.deepEqual(ends(nfl, NFL), [[7, 0], [17, 6], [23, 13], [36, 30]]);
  // Tied 3-3 after regulation and overtime, won 4-3 in the shootout: its winning goal is the final's, no period's.
  assert.deepEqual(ends(nhl, SHOOTOUT), [[1, 0], [3, 0], [3, 3], [3, 3]]);
  // Double overtime in men's college basketball (two halves): every period it played.
  assert.deepEqual(ends(sportOf("basketball/mens-college-basketball"), require("./fixtures/espn/ncaam-401820165.json")), [[26, 27], [59, 59], [67, 67], [79, 82]]);
  // A World Cup tie level after extra time, won on penalties: the kicks are never a period's.
  assert.deepEqual(ends(sportOf("soccer/fifa.world"), require("./fixtures/espn/wc-760499.json")), [[0, 1], [1, 1], [1, 1], [1, 1]]);
  // Live: an earlier moment's ends are only the periods a later one has begun after; ESPN's status at halftime ends the second
  // quarter now, before the third's first play.
  const q2 = nba.timeline(OPENER).find((p) => p.period === 2 && p.at);
  assert.equal(nba.periodScores(OPENER, q2.at).length, 1);
  const half = clone(OPENER);
  half.plays = half.plays.filter((p) => p.period.number <= 2);
  half.header.competitions[0].status = { period: 2, type: { name: "STATUS_HALFTIME", state: "in", completed: false, detail: "Halftime" } };
  assert.deepEqual(nba.periodScores(half).map((e) => [e["20"], e["5"]]), [[18, 35], [45, 69]]);
  half.header.competitions[0].status.type.name = "STATUS_IN_PROGRESS";
  assert.equal(nba.periodScores(half).length, 1, "still in the second quarter: only the first has ended");
  // No plays: nothing read (the spec's unread says what then).
  assert.deepEqual(periodEnds([], ["a", "b"], { final: true }), []);
  // A game called after five innings: five ends read, the sixth to the ninth never (the spec's unread says what then).
  const called = clone(require("./fixtures/espn/mlb-401907963.json"));
  called.plays = called.plays.filter((p) => p.period.number <= 5);
  assert.equal(sportOf("baseball/mlb").periodScores(called).length, 5);
});

test("squares paid by quarter on the 76ers' opener and an NFL game: the square of each end's last digits, live and kept alike", () => {
  const sq = squaresParts(spec("basketball", "squares"));
  assert.deepEqual(sq, { grid: 10, take: "pick", each: null, pays: [{ at: 1, points: 1 }, { at: 2, points: 1 }, { at: 3, points: 1 }, { at: "final", points: 2 }], empty: "void", unread: "final" });
  const holders = { 85: "maxey", 59: "maxey", 20: "riley", 46: "sam" };
  const opener = Sq.squaresPays(sq, liveFacts(nba, OPENER), { digits: PLAIN, holders, regulation: 4 });
  // 18-35, 45-69, 82-90, 114-106.
  assert.deepEqual(cells(opener), [85, 59, 20, 46]);
  assert.deepEqual(opener.pays.map((p) => p.state), ["paid", "paid", "paid", "paid"]);
  assert.deepEqual(opener.totals, { maxey: 2, riley: 1, sam: 2 });
  // The kept final pays the same (its periods kept with it: sports_events.shape).
  assert.deepEqual(Sq.squaresPays(sq, keptFacts(nba, OPENER), { digits: PLAIN, holders, regulation: 4 }), opener);
  // The NFL game: 7-0, 17-6, 23-13, 36-30.
  const game = Sq.squaresPays(squaresParts(spec("football", "squares")), keptFacts(nfl, NFL), { digits: PLAIN, holders: { 70: "a", 33: "b" }, regulation: 4 });
  assert.deepEqual(cells(game), [70, 76, 33, 60]);
  assert.deepEqual(game.pays.map((p) => p.state), ["paid", "empty", "paid", "empty"]);
  assert.deepEqual(game.totals, { a: 1, b: 1 });
  // Rolled on: the second quarter's point goes to the third's square, the final's to nobody (nothing after it).
  const rolled = Sq.squaresPays({ ...squaresParts(spec("football", "squares")), empty: "next" }, keptFacts(nfl, NFL), { digits: PLAIN, holders: { 70: "a", 33: "b" }, regulation: 4 });
  assert.deepEqual(rolled.pays.map((p) => [p.points, p.rolled]), [[1, 0], [1, 0], [2, 1], [2, 0]]);
  assert.deepEqual(rolled.totals, { a: 1, b: 2 });
  // A drawn grid: each digit once on each side, the same from the same seed; the square is the one with both last digits.
  const d = Sq.digitsOf("zt-game|1", 10);
  assert.deepEqual(d.rows.flat().sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(Sq.digitsOf("zt-game|1", 10), d);
  assert.notDeepEqual(Sq.digitsOf("zt-game|2", 10), d);
  const drawn = Sq.squaresPays(sq, liveFacts(nba, OPENER), { digits: d, holders: {}, regulation: 4 });
  assert.equal(drawn.pays[3].cell, d.rows.findIndex((g) => g[0] === 4) * 10 + d.cols.findIndex((g) => g[0] === 6));
  // 5 by 5: two digits a row; 114-106's square is the row with 4 and the column with 6.
  const five = Sq.digitsOf("zt-game|1", 5);
  assert.ok(five.rows.every((g) => g.length === 2));
  const r5 = Sq.squaresPays({ ...sq, grid: 5 }, liveFacts(nba, OPENER), { digits: five, holders: {}, regulation: 4 });
  assert.equal(r5.pays[3].cell, five.rows.findIndex((g) => g.includes(4)) * 5 + five.cols.findIndex((g) => g.includes(6)));
});

test("squares at halftime, in overtime and a shootout, live, and a period never read", () => {
  // Halftime on the quarters' second; live at halftime it's paid, the third and the final still to come.
  const half = clone(OPENER);
  half.plays = half.plays.filter((p) => p.period.number <= 2);
  half.header.competitions[0].status = { period: 2, type: { name: "STATUS_HALFTIME", state: "in", completed: false, detail: "Halftime" } };
  const sq = { grid: 10, take: "pick", each: null, pays: [{ at: "half", points: 1 }, { at: 3, points: 1 }, { at: "final", points: 2 }], empty: "void", unread: "final" };
  const facts = gameFacts(nba, nba.stateAt(half), { status: "in", sides: ["20", "5"], periods: nba.periodScores(half) });
  const live = Sq.squaresPays(sq, facts, { digits: PLAIN, holders: { 59: "a" }, regulation: 4 });
  assert.deepEqual(live.pays.map((p) => p.state), ["paid", "waiting", "waiting"]);
  assert.deepEqual(live.totals, { a: 1 });
  // The shootout: the end of regulation 3-3, the final 4-3 (its winner's goal counts there).
  const so = Sq.squaresPays({ ...sq, pays: [{ at: 3, points: 1 }, { at: "final", points: 1 }] }, keptFacts(nhl, SHOOTOUT), { digits: PLAIN, holders: {}, regulation: 3 });
  assert.deepEqual(so.pays.map((p) => p.score), [[3, 3], [4, 3]]);
  // A kept final with no periods (one kept before they were, or a summary with no plays): on the final score, or nobody.
  const bare = clone(storedGame(nba, OPENER));
  delete bare.periods;
  const old = storedFacts(nba, bare, "final");
  const onFinal = Sq.squaresPays(sq, old, { digits: PLAIN, holders: { 46: "a" }, regulation: 4 });
  assert.deepEqual(onFinal.pays.map((p) => [p.state, p.cell]), [["paid", 46], ["paid", 46], ["paid", 46]]);
  assert.deepEqual(onFinal.totals, { a: 4 });
  const voided = Sq.squaresPays({ ...sq, unread: "void" }, old, { digits: PLAIN, holders: { 46: "a" }, regulation: 4 });
  assert.deepEqual(voided.pays.map((p) => p.state), ["void", "void", "paid"]);
  // Rolled on past a void pay: the first quarter's empty square's point goes to the final, not lost with the third's.
  const past = Sq.squaresPays({ ...sq, pays: [{ at: 1, points: 1 }, { at: 3, points: 1 }, { at: "final", points: 2 }], empty: "next", unread: "void" }, { ...old, periods: [{ 20: 18, 5: 35 }] }, { digits: PLAIN, holders: { 46: "a" }, regulation: 4 });
  assert.deepEqual(past.pays.map((p) => [p.state, p.points]), [["empty", 1], ["void", 1], ["paid", 3]]);
  assert.deepEqual(past.totals, { a: 3 });
  // A game called off pays nothing; one not started waits.
  assert.deepEqual(Sq.squaresPays(sq, { ...old, status: "off" }, { digits: PLAIN, holders: {}, regulation: 4 }).pays.map((p) => p.state), ["off", "off", "off"]);
  assert.deepEqual(Sq.squaresPays(sq, { ...old, status: "pre" }, { digits: PLAIN, holders: {}, regulation: 4 }).pays.map((p) => p.state), ["waiting", "waiting", "waiting"]);
});

test("squares taken: dealt at random from a seed, evenly, the rest nobody's; picked squares checked", () => {
  const dealt = Sq.dealSquares("zt-deal", ["c", "a", "b"], 10);
  assert.deepEqual(Object.keys(dealt), ["a", "b", "c"]);
  assert.ok(Object.values(dealt).every((l) => l.length === 33));
  assert.equal(new Set(Object.values(dealt).flat()).size, 99, "nobody shares a square; one left over");
  assert.deepEqual(Sq.dealSquares("zt-deal", ["a", "b", "c"], 10), dealt, "the same seed deals the same");
  assert.ok(Object.values(Sq.dealSquares("zt-deal", ["a", "b"], 5, 4)).every((l) => l.length === 4));
  assert.ok(Object.values(Sq.dealSquares("zt-deal", ["a", "b", "c", "d"], 5, 10)).every((l) => l.length === 6), "never more than go round");
  assert.deepEqual(Sq.holdersOf({ a: [1, 2], b: [2, 3] }), { 1: "a", 2: "a", 3: "b" });
  assert.equal(Sq.pickProblem([0, 99], 10, 5, new Set([4])), null);
  assert.equal(Sq.pickProblem([100], 10), "Squares are numbered 0 to 99");
  assert.equal(Sq.pickProblem([25], 5), "Squares are numbered 0 to 24");
  assert.equal(Sq.pickProblem([1, 1], 10), "Take each square once");
  assert.equal(Sq.pickProblem([1, 2, 3], 10, 2), "Take 2 at most");
  assert.equal(Sq.pickProblem([4], 10, null, new Set([4])), "Someone has that square already");
});

test("the squares spec: each sport's default passes against its sport and plays (L3 part 2e); what the check refuses", () => {
  for (const [sport, league, ctxLeague] of [["basketball", "nba", "basketball/nba"], ["basketball", "wnba", "basketball/wnba"], ["basketball", "mens-college-basketball", "basketball/mens-college-basketball"], ["basketball", "womens-college-basketball", "basketball/womens-college-basketball"], ["football", "nfl", "football/nfl"], ["football", "college-football", "football/college-football"]]) {
    const s = spec(sport, "squares", league);
    assert.deepEqual(problems(s, specContextOf(sportOf(ctxLeague), league)), [], ctxLeague);
    assert.deepEqual(specWaitsFor(s), [], ctxLeague);
  }
  // Men's college basketball is two halves: by quarter is refused there, halftime anywhere with an even number of periods.
  assert.deepEqual(squaresParts(spec("basketball", "squares", "mens-college-basketball")).pays.map((p) => p.at), [1, "final"]);
  const ncaam = specContextOf(sportOf("basketball/mens-college-basketball"), "mens-college-basketball");
  assert.ok(problems(spec("basketball", "squares"), ncaam).includes("score.pays[2].at: A game has 2 halves: pay at the end of one of them, halftime or the final"));
  const nhlCtx = specContextOf(nhl);
  const s = spec("football", "squares");
  const pays = (p) => ({ ...s, score: { ...s.score, pays: p } });
  assert.ok(problems(pays([{ at: "half", points: 1 }]), nhlCtx).includes("score.pays[0].at: 3 periods have no halftime: pay at the end of one of them, or the final"));
  assert.ok(problems(pays([{ at: "half", points: 1 }, { at: 2, points: 1 }]), specContextOf(nfl)).includes("score.pays[0].at: Halftime is the end of the second quarter: it pays once"));
  assert.ok(problems(pays([{ at: 1, points: 1 }, { at: 1, points: 2 }]), null).includes("score.pays[1].at: Each moment pays once"));
  // In the order they're paid.
  assert.ok(problems(pays([{ at: "final", points: 2 }, { at: 1, points: 1 }]), null).includes("score.pays[1].at: Pays come in the order they're paid: each period's end, then the final"));
  assert.ok(problems(pays([{ at: 3, points: 1 }, { at: 1, points: 1 }]), null).includes("score.pays[1].at: Pays come in the order they're paid: each period's end, then the final"));
  assert.ok(problems(pays([{ at: 3, points: 1 }, { at: "half", points: 1 }]), specContextOf(nfl)).includes("score.pays[1].at: Pays come in the order they're paid: halftime after the second quarter's end and before the third's"));
  assert.deepEqual(problems(pays([{ at: 1, points: 1 }, { at: "half", points: 1 }, { at: 3, points: 1 }, { at: "final", points: 1 }]), specContextOf(nfl)), []);
  assert.ok(problems(pays([]), null).includes("score.pays: Squares pay 1 to 10 times: [{ at, points }], at a period's end (its number), halftime ('half') or the final ('final')"));
  assert.ok(problems(pays([{ at: "end", points: 0 }]), null).includes("score.pays[0].points: A pay is worth 1 to 100 points"));
  // A field and a card have no two scores.
  assert.ok(problems(s, specContextOf(sportOf("golf/pga"))).includes("get.by: Squares need a game's two scores: a field has none"));
  assert.ok(problems(s, specContextOf(tennis)).includes("get.by: Squares need a game's two scores: a card has none"));
  // Its own parts, and nothing beside it.
  assert.ok(problems({ ...s, get: { by: "squares", grid: 4, take: "auction", each: 101 } }, null).includes("get.grid: The grid is 10 by 10 (10) or 5 by 5 (5)"));
  assert.ok(problems({ ...s, get: { by: "squares", grid: 5, each: 26 } }, null).includes("get.each: Each takes 1 to 25 squares"));
  assert.ok(problems({ ...s, count: { all: true } }, null).includes("count: Nothing counts but your squares: count null"));
  assert.ok(problems({ ...s, score: { by: "stats", points: { PTS: 1 } } }, null).includes("score.by: Squares pay on their squares alone: score by squares"));
  assert.ok(problems({ ...s, get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { all: true } }, null).includes("get.by: Squares pay whoever holds them: get squares"));
  assert.ok(problems({ ...s, rank: { by: "matchups" } }, null).includes("rank.by: Squares rank by what they win: most points wins (total)"));
  assert.ok(problems({ ...s, ask: spec("football", "pickem").ask }, null).includes("ask: Squares are their own game: questions beside them play in a stage alongside it"));
  assert.ok(problems({ ...s, closes: "weekly" }, null).includes("closes: Squares are taken before the game starts: closes start"));
  assert.ok(problems({ ...s, score: { ...s.score, empty: "keep", unread: "next" } }, null).length === 2);
  assert.ok(problems({ ...s, score: { ...s.score, extra: 1 } }, null).some((p) => p.startsWith("score.extra")));
});

test("the squares words: the grid, how they're taken, what each pay is worth, overtime, an empty square and a period never read", () => {
  const ctx = { ...specContextOf(nfl), part: { singular: "game", plural: "games" } };
  const d = describeSpec(spec("football", "squares"), ctx);
  assert.match(d.sentence, /everyone takes squares on a 10-by-10 grid of the two scores' last digits/);
  assert.match(d.sentence, /wins 1 point at the end of the first quarter, 1 point at the end of the second quarter, 1 point at the end of the third quarter and 2 points at the final score\. Most points wins\./);
  assert.ok(d.rules.includes("Before it starts, take your squares on a grid 10 by 10: as many as you like, first come, first served."));
  assert.ok(d.rules.includes("The final score counts overtime."));
  assert.ok(d.rules.includes("A square nobody holds pays nobody."));
  assert.ok(d.rules.includes("Your squares are yours for every game; the digits are drawn again before each one."));
  const dealt = describeSpec({ ...spec("football", "squares"), span: { from: 1, to: 1 }, get: { by: "squares", grid: 5, take: "deal", each: 4 }, score: { by: "squares", pays: [{ at: "half", points: 1 }], empty: "next", unread: "void" } }, ctx);
  assert.match(dealt.sentence, /everyone is dealt squares at random on a 5-by-5 grid/);
  assert.ok(dealt.rules.includes("Before it starts, everyone is dealt four squares at random on a grid 5 by 5."));
  assert.ok(dealt.rules.some((r) => /two to a row and two to a column/.test(r)));
  assert.ok(dealt.rules.includes("A square nobody holds rolls its points on to the next pay."));
  assert.ok(dealt.rules.includes("If the score at the end of a quarter isn't known (a game called early), that pay goes to nobody."));
  assert.ok(!dealt.rules.some((r) => /drawn again/.test(r)), "one game: one draw");
});

// The 2026 US Open's men's singles as a card's facts: live (the reader's card, each bout's place) or kept (storedCard's).
const usLive = () => gameFacts(tennis, tennis.stateAt(USOPEN), { status: "final", card: tennis.card(USOPEN) });
const usKept = () => storedFacts(tennis, clone(storedCard(tennis, USOPEN)), "final");
const factsOf = (game) => ({ from: 1, to: 1, over: false, episodes: new Map(), names: new Map(), games: new Map([[1, game]]) });

test("a bracket on the US Open's men's singles: every round's winners, each right pick doubling round by round, live and kept alike", () => {
  const q = spec("tennis", "bracket").ask[0];
  const field = Br.bracketOf(usLive().bouts, "MS");
  assert.equal(field.first, 7, "a Grand Slam's 128: seven rounds");
  assert.deepEqual([7, 6, 5, 4, 3, 2, 1].map((k) => (field.winners[k] || []).length), [64, 32, 16, 8, 4, 2, 1]);
  assert.equal(field.matches[7].length, 64);
  assert.ok(field.over);
  assert.deepEqual(Br.bracketOf(usKept().bouts, "MS"), field, "the kept final keeps each bout's round");
  // The perfect bracket: 64 + 2 x 32 + 4 x 16 + 8 x 8 + 16 x 4 + 32 x 2 + 64 = 448.
  const perfect = Object.fromEntries(Object.entries(field.winners).map(([k, ids]) => [k, ids.slice()]));
  assert.equal(answerProblem(q, perfect, field), null);
  for (const facts of [factsOf(usLive()), factsOf(usKept())]) {
    const v = verdictOf(q, 1, facts);
    assert.equal(v.state, "known");
    const final = (field.matches[1] || [])[0];
    const runnerUp = final.find((id) => id !== field.winners[1][0]);
    const wrongChamp = { ...perfect, 1: [runnerUp] };
    const pts = pointsFor(q, v, [{ playerId: "a", answer: perfect }, { playerId: "b", answer: wrongChamp }, { playerId: "c", answer: { 1: [field.winners[1][0]] } }], facts);
    assert.deepEqual(Object.fromEntries(pts), { a: 448, b: 384, c: 64 });
    assert.deepEqual(Object.fromEntries(pointsFor({ ...q, rounds: "same" }, v, [{ playerId: "a", answer: perfect }], facts)), { a: 127 });
    // Right when any pick is (A8's kinds' way: a life or a parlay's leg reads it).
    assert.equal(isRight(q, v, { playerId: "c", answer: { 1: [field.winners[1][0]] } }, [], facts), true);
    assert.equal(isRight(q, v, { playerId: "d", answer: { 1: [runnerUp] } }, [], facts), false);
  }
  // Live, before the final: still waiting, the draw so far for the phone.
  const live = usLive();
  const verdict = verdictOf(q, 1, factsOf({ ...live, status: "in" }));
  assert.equal(verdict.state, "waiting");
  assert.equal(verdict.live.bracket.first, 7);
  // A draw the card hasn't: off once it's final.
  assert.equal(verdictOf({ ...q, settle: { ...q.settle, of: "XD2" } }, 1, factsOf(live)).state, "off");
  // The women's singles on the same card, the WTA's default.
  const ws = spec("tennis", "bracket", "wta").ask[0];
  assert.equal(ws.settle.of, "WS");
  assert.equal(Br.bracketOf(live.bouts, "WS").first, 7);
});

test("a bracket answered before the later rounds are listed: a Grand Slam's first round is seven from the final", () => {
  // The board at the draw's making: the first round's 64 matches, nothing after them.
  const early = clone(USOPEN);
  for (const g of early.board.groupings) g.competitions = g.competitions.filter((c) => String(c.round?.id) === "1" || Number(c.round?.id) > 10);
  const card = tennis.card(early);
  const ms = card.bouts.filter((b) => b.place?.draw === "mens-singles" && !b.place.qualifying);
  assert.equal(ms.length, 64);
  assert.ok(ms.every((b) => b.place.fromFinal === 7));
  const field = Br.bracketOf(gameFacts(tennis, tennis.stateAt(early), { status: "pre", card }).bouts, "MS");
  assert.equal(field.first, 7);
  assert.equal(answerProblem(spec("tennis", "bracket").ask[0], { 7: [field.matches[7][0][0]], 1: [field.matches[7][0][0]] }, field), "A round is won by one of the round before's winners you picked");
});

test("a bracket answer checked against the draw: in it, a round's winners from the round before's, one winner a match", () => {
  const q = spec("tennis", "bracket").ask[0];
  const field = Br.bracketOf(usLive().bouts, "MS");
  const [a, b] = field.matches[7][0];
  assert.equal(answerProblem(q, { 7: [a] }, field), null, "a bracket filled in part");
  assert.equal(answerProblem(q, { 7: [a, b] }, field), "Pick one winner of each match");
  assert.equal(answerProblem(q, { 6: [a] }, field), "A round is won by one of the round before's winners you picked");
  assert.equal(answerProblem(q, { 7: [a], 6: [a] }, field), null);
  assert.equal(answerProblem(q, { 7: ["nobody"] }, field), "Pick only who's in the draw");
  assert.equal(answerProblem(q, { 8: [a] }, field), "The rounds are 1 (the final) to 7");
  assert.equal(answerProblem(q, { 1: [a, b] }, field), "Round 1 has 1 winner at most");
  assert.equal(answerProblem(q, { 7: [a, a] }, field), "Name each one once a round");
  assert.equal(answerProblem(q, [a], field), "Pick the winners: { round: [names] }, the final 1, the semifinals 2");
  // Without the draw, the shape alone.
  assert.equal(answerProblem(q, { 7: ["anyone"] }, null), null);
});

test("the bracket spec: tennis's passes against tennis and plays (L3 part 2e); what the check refuses; its words", () => {
  for (const league of ["atp", "wta"]) {
    const s = spec("tennis", "bracket", league);
    assert.deepEqual(problems(s, specContextOf(tennis)), [], league);
    assert.deepEqual(specWaitsFor(s), [], league);
  }
  const s = spec("tennis", "bracket");
  const q = s.ask[0];
  const asked = (more) => ({ ...s, ask: [{ ...q, ...more }] });
  assert.ok(problems(s, specContextOf(nfl)).includes("ask[0].settle: A bracket is a draw's (tennis's): a team game has none"));
  assert.ok(problems(s, specContextOf(sportOf("mma/ufc"))).includes("ask[0].settle: A bracket is a draw's, and this card's bouts aren't in one"));
  assert.ok(problems(asked({ settle: { ...q.settle, of: "XX" } }), specContextOf(tennis)).includes('ask[0].settle.of: "XX" isn\'t one of the draws: MS, WS, MD, WD, XD'));
  assert.ok(problems(asked({ settle: { by: "final", take: "bracket" } }), null).includes("ask[0].settle.of: Which draw it's the bracket of: its key (tennis's MS, WS...)"));
  assert.ok(problems(asked({ answer: "person", from: "cast", pick: 1, rounds: undefined }), null).includes("ask[0].answer: Only a bracket answer is graded by a draw's bracket"));
  assert.ok(problems(asked({ settle: { by: "final", take: "winner", of: "main" } }), null).includes("ask[0].settle: A bracket answer isn't graded by final winner"));
  assert.ok(problems(asked({ rounds: "triple" }), null).includes("ask[0].rounds: A right pick is worth double each round (double) or the same (same)"));
  assert.ok(problems(asked({ share: "split" }), null).includes("ask[0]: A bracket's points are each right pick's: no share, rollover, shrink or each"));
  assert.ok(problems(asked({ wager: 5 }), null).some((p) => p.startsWith("ask[0].wager")));
  assert.ok(problems({ ...spec("tennis", "pickem"), ask: [{ ...spec("tennis", "pickem").ask[0], rounds: "double" }] }, null).includes("ask[0].rounds: Only a bracket's rounds are worth more as they go"));
  const d = describeSpec(s, { ...specContextOf(tennis), part: { singular: "tournament", plural: "tournaments" } });
  assert.ok(d.rules.some((r) => r.includes("Pick the winner of every match of the men's singles draw, round by round to the final: 1 point for each one right in the first round, doubling each round after it.")), d.rules.join("\n"));
});

test("a kept final's size: a team game's periods and a draw's rounds are a few bytes", () => {
  const shape = shapeOf(storedGame(nba, OPENER));
  assert.ok(JSON.stringify(shape.periods).length < 120);
  const withRounds = JSON.stringify(storedCard(tennis, USOPEN).card.bouts).length;
  const without = JSON.stringify(storedCard(tennis, USOPEN).card.bouts.map(({ fromFinal, ...b }) => b)).length;
  assert.ok(withRounds - without < 8000, `${withRounds - without} bytes for a Grand Slam's rounds`);
});
