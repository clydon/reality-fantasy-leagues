// Computer players answering a game's own questions (docs/PLAN-start-a-game-redo.md E1b; bot-logic.js answers): each bot gives
// each open question one answer the engine accepts, from what the league knows (who goes home: the one most in danger), at its
// level; never twice (deterministic: a second run with what was stored has nothing to add); none for a question that's closed or
// a kind it doesn't answer yet; the gallery's list of kinds (start-gallery botsFit) the same as bot-logic's. At your own pace
// (E1b's second slice: catchUpAnswers), each answers each week as it catches up, on its own copy before that week: the same
// answers whatever that week's results were. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const C = require("../src/lib/game/start-gallery/index.js");

const CTX = {
  moments: [
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  calls: "results",
};
const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const WINS = { id: "wins", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
const HOW = { id: "how", ask: "How many idols?", answer: "choice", points: 1, asked: "each", options: ["0", "1", "2+"], settle: { by: "moment", moment: "idolPlayed", take: "count" } };
const ORDER = { id: "order", ask: "The order they go", answer: "order", points: 2, asked: "once", pick: 5, within: 2, settle: { by: "results", take: "order" } };
const CONF = { id: "conf", ask: "Rank who goes home", answer: "confidence", points: 1, pick: 8, asked: "each", settle: { by: "results", take: "out" } };
const CHIPS = { id: "chips", ask: "Your chips on who wins", answer: "chips", points: 1, chips: 10, settle: { by: "results", take: "winner" } };
const PAIRS = { id: "pairs", ask: "Who outlasts whom?", answer: "pairs", points: 1, pairs: 3, settle: { by: "results", take: "outlast" } };
const SPLIT = { id: "split", ask: "The jury's split", answer: "split", points: 5, settle: { by: "results", take: "split" } };
// Staked (E1b's second slice): a wager of house points, of your points as they stand, a bank's, a ticket.
const BET = { id: "bet", ask: "An idol played? Stake on it", answer: "yesNo", points: 1, asked: "each", wager: 3, settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
// Trivia (E1b's leftovers: from the round's key, which the server reads).
const TRIVIA = { id: "trivia", ask: "Trivia about the episode before", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } };
// Still one they don't play: an over/under on a game's own line (read from ESPN as it opens).
const LINE = { id: "line", ask: "Over or under the line?", answer: "overUnder", points: 1, asked: "each", line: "game", settle: { by: "final", take: "total" } };
const game = (ask) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask });

/** A game of questions as Start a game makes one, on Survivor, ann the person and two computer players (castaway ids c0-c7, so two
 *  leagues can be compared). */
function league(ask, levels = ["solid", "sharp"]) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < 8; i++) S.addCastaway(s, `Castaway ${i}`);
  s.castaways.forEach((c, i) => { c.id = `c${i}`; });
  s.players = [{ id: "ann", name: "ann", color: "#000" }, ...levels.map((botLevel, i) => ({ id: `bot${i}`, name: `Bot ${i}`, color: "#000", automated: true, botLevel }))];
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, game(ask), { ctx: CTX }), []);
  return s;
}

test("each computer player answers each open question once, an answer the engine accepts; again, nothing", () => {
  const s = league([OUT, IDOL, WINS, HOW]);
  const out = Bots.answers(s, [], { now: 0 });
  assert.equal(out.length, 2 * 4, JSON.stringify(out));
  const faces = new Set(s.castaways.map((c) => c.id));
  for (const a of out) {
    const q = [OUT, IDOL, WINS, HOW].find((x) => x.id === a.question);
    assert.equal(G.answerProblem(G.fullSpec(game([q])).ask[0], a.answer, G.NAMES.includes(q.answer) ? faces : undefined), null, JSON.stringify(a));
    assert.equal(a.episode, q.id === "wins" ? 0 : S.AnswerLogic.episodeNow(s));
  }
  assert.deepEqual(Bots.answers(s, out, { now: 0 }), [], "run again with what was stored: nothing more");
  assert.deepEqual(Bots.answers(s, [], { now: 0 }), out, "deterministic");
});

test("who goes home: someone still in, never someone out; who wins: the best rated, before the game starts", () => {
  const s = league([OUT, WINS], ["sharp"]);
  const r0 = Bots.ratings(s, Bots.LEVELS.sharp);
  const wins = Bots.answers(s, [], { now: 0 }).find((a) => a.question === "wins");
  assert.ok(wins && r0[wins.answer], "the winner pick: someone still in, with a rating (asked once, before the game starts)");
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  S.addElimination(s, e1.id, s.castaways[7].id, "Voted Out");
  S.ensureNextEpisode(s);
  const out = Bots.answers(s, [], { now: 0 });
  const home = out.find((a) => a.question === "out");
  assert.ok(home && s.castaways.some((c) => c.id === home.answer && c.status === "active"), "someone still in");
  assert.notEqual(home.answer, s.castaways[7].id, "never someone already out");
  assert.equal(out.find((a) => a.question === "wins"), undefined, "who wins closed when the game started");
});

test("a closed question gets none, and a kind it doesn't answer yet gets none", () => {
  const s = league([OUT, TRIVIA]);
  const now = S.AnswerLogic.episodeNow(s);
  const ep = s.episodes.find((e) => e.number === now);
  ep.airsAt = new Date(Date.now() - 3600 * 1000).toISOString();
  assert.deepEqual(Bots.answers(s, [], { now: Date.now() }).filter((a) => a.question === "out"), [], "the episode has started: closed");
  assert.ok(!Bots.answersQuestion(LINE), "an over/under on the game's own line: not yet");
  assert.ok(Bots.answersQuestion(TRIVIA) && Bots.answersAll(s), "trivia: played (from the round's key)");
  assert.ok(Bots.answersQuestion(OUT) && Bots.answersQuestion(IDOL) && Bots.answersQuestion(HOW));
});

test("an order, confidence, chips, pairs and a split: answers the engine accepts, read from the league (E1b's second slice)", () => {
  const ask = [ORDER, CONF, CHIPS, PAIRS, SPLIT];
  const s = league(ask, ["sharp", "casual"]);
  const out = Bots.answers(s, [], { now: 0 });
  assert.deepEqual(out.map((a) => `${a.playerId} ${a.question}`).sort(), ["bot0", "bot1"].flatMap((b) => ask.map((q) => `${b} ${q.id}`)).sort(), JSON.stringify(out));
  const still = new Set(s.castaways.filter((c) => c.status !== "eliminated").map((c) => c.id));
  const by = (b, q) => out.find((a) => a.playerId === b && a.question === q).answer;
  for (const b of ["bot0", "bot1"]) {
    assert.equal(by(b, "order").length, 5, "the boot order: its five");
    assert.equal(by(b, "conf").length, 8, "confidence: everyone still in");
    assert.ok(by(b, "conf").every((id) => still.has(id)));
    const chips = by(b, "chips");
    assert.equal(Object.values(chips).reduce((x, y) => x + y, 0), 10, "every chip down");
    assert.equal(Object.keys(by(b, "pairs")).length, 3, "a pick in each pair");
    assert.ok(by(b, "split").every((n) => Number.isInteger(n) && n > 0));
  }
  assert.ok(Object.keys(by("bot0", "chips")).length < Object.keys(by("bot1", "chips")).length, "sharp concentrates its chips, easy spreads them");
  // Ranked as who goes home, the most in danger first: once someone's gone, never them.
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  S.addElimination(s, e1.id, "c7", "Voted Out");
  S.ensureNextEpisode(s);
  const later = Bots.answers(s, out, { now: 0 }).filter((a) => a.question === "conf");
  assert.equal(later.length, 2, "Episode 2's confidence");
  assert.ok(later.every((a) => !a.answer.includes("c7") && a.answer.length === 7));
});

/** A game of questions with a bank (C6), as the Bank base makes one: who goes home and an idol, each staked from it, and a ticket of both. */
function banked(levels = ["casual"]) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < 8; i++) S.addCastaway(s, `Castaway ${i}`);
  s.castaways.forEach((c, i) => { c.id = `c${i}`; });
  s.players = [{ id: "ann", name: "ann", color: "#000" }, ...levels.map((botLevel, i) => ({ id: `bot${i}`, name: `Bot ${i}`, color: "#000", automated: true, botLevel }))];
  S.updateSettings(s, "setupComplete", true);
  const ask = [
    { ...OUT, points: 0, wager: "total" },
    { ...IDOL, points: 0, wager: "total" },
    { id: "ticket", ask: "Build a ticket", answer: "ticket", points: 0, asked: "each", wager: "total", settle: { by: "legs", of: ["out", "idol"] } },
  ];
  assert.deepEqual(S.setGame(s, { spec: 1, get: { by: "none" }, score: { by: "answers", bank: { start: 500 } }, rank: { by: "total" }, ask }, { ctx: CTX }), []);
  return s;
}

test("stakes: a share of house points; of points or a bank as they stand, within what's left this week; a ticket of its own answers", () => {
  // A wager of house points (up to 3): no room needed.
  const house = Bots.answers(league([BET], ["casual"]), [], { now: 0 }).find((a) => a.question === "bet");
  assert.ok(house && ["yes", "no"].includes(house.answer.answer) && house.answer.stake === 1, `half of 3, rounded down (${JSON.stringify(house)})`);
  // A bank's: without its room, nothing (the server always reads it); with it, each stake a share of what's left after the others.
  const s = banked();
  assert.deepEqual(Bots.answers(s, [], { now: 0 }), [], "no room read: no answer");
  const rooms = new Map([["bot0|live", { points: 500, held: new Map() }]]);
  const out = Bots.answers(s, [], { now: 0, rooms });
  const by = (q) => out.find((a) => a.question === q).answer;
  assert.deepEqual(out.map((a) => a.question), ["out", "idol", "ticket"], "the ticket last, after its legs");
  assert.equal(by("out").stake, 250, "half the bank");
  assert.equal(by("idol").stake, 125, "half of what's left");
  assert.equal(by("ticket").stake, 62, "and half of that");
  assert.equal(by("ticket").legs.length, 2);
  assert.ok(by("ticket").legs.every((id) => ["out", "idol"].includes(id)), "its legs its own answers");
  // Points already on the line elsewhere count against it.
  const held = Bots.answers(s, [], { now: 0, rooms: new Map([["bot0|live", { points: 500, held: new Map([["out|0", 400]]) }]]) });
  assert.equal(held.find((a) => a.question === "out").answer.stake, 50, "500 less 400 held, halved");
  // Each one accepted by the engine, with what it may stake.
  for (const a of out) {
    const q = S.AnswerLogic.questions(s).find((x) => x.id === a.question);
    assert.equal(G.answerProblem(q, a.answer, q.answer === "person" ? new Set(s.castaways.map((c) => c.id)) : undefined, { most: 500 }), null, JSON.stringify(a));
  }
});

test("a card's lines (Prop bets): none while its card isn't out, then each line the card has, staked; Objectives plays, a host's card doesn't", () => {
  const ctx = { ...CTX, moments: ["idolFound", "idolPlayed", "votesNegated", "wentOnJourney", "learnedOfAdvantage", "advantageTargeted", "rewardWin", "tribeImmunity", "individualImmunity", "zeroVotesSafe", "survivedVotes", "challengeRunnerUp"].map((id) => ({ id, label: id, defaultPoints: 1, answeredBy: "research" })) };
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < 8; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = [{ id: "ann", name: "ann", color: "#000" }, { id: "bot0", name: "Bot", color: "#000", automated: true, botLevel: "solid" }];
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, C.baseById("props").spec, { ctx }), []);
  const rooms = new Map([["bot0|live", { points: 500, held: new Map() }]]);
  const before = Bots.answers(s, [], { now: 0, rooms });
  assert.deepEqual(before.map((a) => a.question), ["boot"], "the card's not out: who goes home only (the ticket waits for a second leg of its own)");
  const ep = s.episodes.find((e) => e.number === S.AnswerLogic.episodeNow(s));
  ep.cardChoice = { moments: ["rewardWin", "idolFound"], cannot: [] };
  const next = Bots.answers(s, before, { now: 0, rooms });
  const after = next.filter((a) => a.question.startsWith("sheet."));
  assert.equal(after.length, 4, "the card's four lines");
  const ticket = next.find((a) => a.question === "ticket");
  assert.ok(ticket && ticket.answer.legs.length === 2 && ticket.answer.legs.every((id) => id === "boot" || after.some((a) => a.question === id)), `then the ticket, on its own answers (${JSON.stringify(ticket)})`);
  assert.ok(after.every((a) => ["yes", "no"].includes(a.answer.answer) && Number.isInteger(a.answer.stake)), JSON.stringify(after));
  assert.equal(C.botsFit(C.baseById("props").spec), null, "Prop bets: played");
  assert.equal(C.botsFit(C.baseById("objectives").spec), null, "Objectives: its picks played");
});

test("a host's card (E1b's leftovers): on its turn a computer player writes the card's lines from its list; it sits out its own when the card says", () => {
  const ctx = { ...CTX, moments: ["idolFound", "idolPlayed", "votesNegated", "wentOnJourney", "learnedOfAdvantage", "advantageTargeted", "rewardWin", "tribeImmunity", "individualImmunity"].map((id) => ({ id, label: id, defaultPoints: 1, answeredBy: "research" })) };
  const make = (hostAnswers) => {
    const s = S.defaultState();
    S.ensureNextEpisode(s);
    S.updateSettings(s, "showId", "survivor");
    S.updateSettings(s, "leagueTypeId", "pickem");
    S.updateSettings(s, "wikiSeason", 51);
    for (let i = 0; i < 8; i++) S.addCastaway(s, `Castaway ${i}`);
    s.players = [{ id: "bot0", name: "Bot", color: "#000", automated: true, botLevel: "solid" }, { id: "ann", name: "ann", color: "#000" }];
    S.updateSettings(s, "setupComplete", true);
    const spec = JSON.parse(JSON.stringify(C.baseById("host").spec));
    if (hostAnswers === false) spec.card.hostAnswers = false;
    assert.deepEqual(S.setGame(s, spec, { ctx }), []);
    return s;
  };
  const s = make(true);
  const n = S.AnswerLogic.episodeNow(s);
  assert.equal(S.HostLogic.hostAt(s, n), "bot0", "the first seat hosts first");
  const lines = Bots.hostLines(s, "bot0", n);
  const cfg = S.HostLogic.of(s);
  assert.equal(lines.length, cfg.each);
  assert.ok(lines.every((m) => cfg.of.includes(m)) && new Set(lines).size === lines.length, "from the card's list, none twice");
  assert.deepEqual(Bots.hostLines(s, "bot0", n), lines, "the same every time");
  // Filed as the host's: its lines out, and it answers them (the card says the host answers).
  s.episodes.find((e) => e.number === n).cardChoice = { moments: lines, host: "bot0", how: "host" };
  assert.equal(Bots.answers(s, [], { now: 0 }).filter((a) => a.question.startsWith("host.")).length, cfg.each);
  // A card whose host doesn't answer their own questions: it sits out.
  const t = make(false);
  t.episodes.find((e) => e.number === n).cardChoice = { moments: lines, host: "bot0", how: "host" };
  assert.deepEqual(Bots.answers(t, [], { now: 0 }), [], "it sits its own card out");
  assert.equal(C.botsFit(C.baseById("host").spec), null, "Host's card: played");
});

test("the review's (E1b): a small jury's split adds up; a live late joiner waits; a hand lock binds; one seat-week; a room only when due", () => {
  // A cast of 8: a jury of 3, every guess adding up to it.
  for (const level of ["sharp", "solid", "casual"]) {
    const s = league([SPLIT], [level, level, level]);
    for (const a of Bots.answers(s, [], { now: 0 })) assert.equal(a.answer.reduce((x, y) => x + y, 0), 3, JSON.stringify(a));
  }
  // A late joiner catching up in a live game answers by the live episode, as a person there does: nothing by its mark.
  const live = league([OUT]);
  live.players[1].lateJoin = { startEpisode: 1, catchingUp: true, seenThrough: 0 };
  assert.deepEqual(Bots.catchUpWeeks(live, null), []);
  // Backstage's lock by hand binds a seat catching up at its own pace too (as lateWindow).
  const s = aired([OUT, IDOL], [7, 6, 5]);
  const out = S.AnswerLogic.questions(s).find((q) => q.id === "out");
  assert.ok(!S.AnswerLogic.closed(s, out, 3, { mark: 2, player: "ann" }));
  s.episodes.find((e) => e.number === 3).lineupsLocked = true;
  assert.ok(S.AnswerLogic.closed(s, out, 3, { mark: 2, player: "ann" }), "locked by hand: closed for her too");
  // One seat-week at a time (the server's, so each week's room follows the weeks before it).
  const t = aired([OUT, IDOL], [7, 6, 5]);
  const one = Bots.catchUpAnswers(t, [], 2, undefined, { playerId: "bot1", week: 2 });
  assert.deepEqual([...new Set(one.map((a) => `${a.playerId} ${a.episode}`))], ["bot1 2"]);
  // A room is read only while a staked question is still to answer there.
  const b = banked();
  assert.ok(Bots.needsRoom(b, [], "bot0", null), "nothing answered: the room's needed");
  const due = Bots.answers(b, [], { now: 0, rooms: new Map([["bot0|live", { points: 500, held: new Map() }]]) });
  assert.ok(!Bots.needsRoom(b, due, "bot0", null), "all answered: no room read");
});

test("about each person: an answer for each one still in, yes only for the one most in danger (E1b's leftovers)", () => {
  const EACH = { id: "each", ask: "Each one: out?", answer: "yesNo", points: 1, asked: "each", each: "person", settle: { by: "results", take: "out" } };
  const s = league([EACH]);
  const out = Bots.answers(s, [], { now: 0 });
  assert.equal(out.length, 2);
  for (const a of out) {
    assert.deepEqual(Object.keys(a.answer).sort(), s.castaways.map((c) => c.id).sort(), "each one still in");
    assert.equal(Object.values(a.answer).filter((v) => v === "yes").length, 1, "yes for one");
    const q = S.AnswerLogic.questions(s)[0];
    assert.equal(G.answerProblem(q, a.answer, new Set(s.castaways.map((c) => c.id))), null);
  }
});

test("trivia, from the round's key the server reads: each of its questions, one of its options; none without the key", () => {
  const s = league([TRIVIA], ["sharp", "casual"]);
  const ep = S.AnswerLogic.episodeNow(s);
  assert.deepEqual(Bots.answers(s, [], { now: 0 }), [], "no key read: nothing");
  const key = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, answer: "A", options: ["A", "B", "C", "D"], question: `Q${i}`, kind: "text", episode: ep - 1, seasonId: "s", why: null, source: null }));
  const ctx = { facts: { trivia: new Map([[ep, key]]) }, faces: new Map([[`trivia|${ep}`, new Set(key.flatMap((t) => t.options.map((o) => `${t.id}:${o}`)))]]) };
  const out = Bots.answers(s, [], { now: 0, ctx });
  assert.equal(out.length, 2);
  for (const a of out) assert.equal(Object.keys(a.answer).length, 12, "every question in the round");
  const right = (b) => Object.values(out.find((a) => a.playerId === b).answer).filter((x) => x === "A").length;
  assert.ok(right("bot0") > right("bot1"), `a sharp one remembers more (${right("bot0")} to ${right("bot1")})`);
  assert.deepEqual(Bots.answers(s, [], { now: 0, ctx }), out, "the same every time");
});

test("a sport: a side, each game (only those still to start, ranked where it asks) and a playoffs bracket, from the server's facts", () => {
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { sportOf, specContextOf, defaultsFor } = jiti("../src/lib/sports/index.ts");
  const nba = sportOf("basketball/nba");
  const make = (ask, ctx = specContextOf(nba)) => {
    const s = S.defaultState();
    for (let i = 0; i < 4; i++) S.addCastaway(s, `P${i}`);
    s.players = [{ id: "ann", name: "ann", color: "#000" }, { id: "bot0", name: "Bot", color: "#000", automated: true, botLevel: "solid" }];
    S.updateSettings(s, "setupComplete", true);
    assert.deepEqual(S.setGame(s, { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask }, { ctx }), []);
    for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(s, n, false);
    return s;
  };
  const SIDE = { id: "w", ask: "Who wins?", answer: "side", points: 1, asked: "each", closes: "start", settle: { by: "final", take: "winner" } };
  const s = make([SIDE]);
  const ep = S.AnswerLogic.episodeNow(s);
  const side = Bots.answers(s, [], { now: 0, ctx: { facts: {}, faces: new Map([[`w|${ep}`, new Set(["20", "5"])]]) } });
  assert.ok(side.length === 1 && ["20", "5"].includes(side[0].answer), JSON.stringify(side));
  // Each game: a started game's pick can't be added, so only the one still to start; ranked 1 to the games' count where it asks.
  const later = new Date(Date.now() + 86400000).toISOString();
  const slate = new Map([[ep, new Map([["e1", { status: "pre", listing: { startsAt: later } }], ["e2", { status: "in", listing: { startsAt: new Date(0).toISOString() } }]])]]);
  const games = new Map([["e1", new Set(["20", "5"])], ["e2", new Set(["1", "2"])]]);
  for (const confidence of [false, true]) {
    const EACH = { id: "g", ask: "Pick each game", answer: "side", points: 1, asked: "each", each: "game", closes: "start", settle: { by: "final", take: "winner" }, ...(confidence ? { confidence: true } : {}) };
    const t = make([EACH]);
    const got = Bots.answers(t, [], { now: Date.now(), ctx: { facts: { slate }, faces: new Map([[`g|${ep}`, games]]), now: Date.now() } });
    assert.deepEqual(Object.keys(got[0].answer), ["e1"], "only the game still to start");
    const pick = confidence ? got[0].answer.e1.answer : got[0].answer.e1;
    assert.ok(["20", "5"].includes(pick));
    if (confidence) assert.ok(got[0].answer.e1.confidence >= 1 && got[0].answer.e1.confidence <= 2);
    assert.equal(G.answerProblem(S.AnswerLogic.questions(t)[0], got[0].answer, games), null);
  }
  // A playoffs bracket: each round's winners from the draw as listed.
  const spec = defaultsFor(nba.id, "nba").specs.bracket.spec;
  const b = S.defaultState();
  S.addCastaway(b, "Someone");
  b.players = [{ id: "ann", name: "ann", color: "#000" }, { id: "bot0", name: "Bot", color: "#000", automated: true }];
  S.updateSettings(b, "setupComplete", true);
  assert.deepEqual(S.setGame(b, spec, { ctx: specContextOf(nba, "nba", { playoffs: true }) }), []);
  for (let n = 1; n <= 3; n++) S.ensureEpisodeNumber(b, n, false);
  const q = S.AnswerLogic.questions(b)[0];
  const teams = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const field = { first: 3, entrants: Object.fromEntries(teams.map((t) => [t, 3])), matches: { 3: [["a", "b"], ["c", "d"], ["e", "f"], ["g", "h"]] }, winners: {}, over: false };
  const bep = q.asked === "once" ? 0 : S.AnswerLogic.windowAt(b, q, S.AnswerLogic.episodeNow(b));
  const br = Bots.answers(b, [], { now: 0, ctx: { facts: {}, faces: new Map([[`${q.id}|${bep}`, field]]) } });
  assert.equal(br.length, 1, JSON.stringify(br));
  const Bracket = require("../src/lib/game/sequence/bracket.js");
  assert.equal(Bracket.bracketProblem(br[0].answer, field), null, JSON.stringify(br[0].answer));
  assert.deepEqual([br[0].answer[3].length, br[0].answer[2].length, br[0].answer[1].length], [4, 2, 1], "four, two, a champion");
});

test("the gallery's Computer players square says the same: on for questions they answer, dashed with the reason for the rest", () => {
  assert.equal(C.botsFit(game([OUT, IDOL, WINS, HOW])), null);
  assert.match(C.botsFit(game([OUT, LINE])), /don't answer "Over or under the line\?" yet/);
  assert.equal(C.botsFit(game([OUT, TRIVIA])), null, "trivia: played");
  assert.equal(C.botsFit(game([OUT, BET])), null, "a stake: played");
  assert.equal(C.botsFit(game([OUT, ORDER, CONF, CHIPS, PAIRS, SPLIT])), null, "an order, confidence, chips, pairs and a split: played");
  assert.equal(C.botsFit({ ...G.PRESETS.outlast }), null, "a draft");
  for (const kind of Bots.ANSWERS) assert.ok(Bots.answersQuestion({ id: "q", ask: "x?", answer: kind }) === (C.botsFit(game([{ id: "q", ask: "x?", answer: kind }])) === null), kind);
});

test("played through: as each episode's results land, the next window opens and every computer player answers it", () => {
  const s = league([OUT, IDOL, WINS]);
  const stored = [];
  for (let n = 1; n <= 4; n++) {
    const now = S.AnswerLogic.episodeNow(s);
    const due = Bots.answers(s, stored, { now: 0 });
    stored.push(...due);
    assert.ok(due.some((a) => a.question === "out" && a.episode === now) && due.filter((a) => a.question === "out").length === 2, `episode ${now}: both answer who goes home (${JSON.stringify(due)})`);
    const ep = S.ensureEpisodeNumber(s, now, false);
    const still = s.castaways.filter((c) => c.status === "active");
    S.addElimination(s, ep.id, still[still.length - 1].id, "Voted Out");
    S.ensureNextEpisode(s);
  }
  assert.equal(stored.filter((a) => a.question === "wins").length, 2, "who wins, once each, before it started");
  assert.equal(stored.filter((a) => a.question === "out").length, 2 * 4);
  assert.ok(stored.filter((a) => a.question === "out").every((a) => !stored.some((b) => b !== a && b.playerId === a.playerId && b.question === "out" && b.episode === a.episode)), "one answer a window");
});

/** A season that's aired through `gone.length` episodes (castaway c<n> out in each), played at your own pace from Episode 1. */
function aired(ask, gone) {
  const s = league(ask);
  gone.forEach((n, i) => S.addElimination(s, S.ensureEpisodeNumber(s, i + 1, false).id, `c${n}`, "Voted Out"));
  S.ensureNextEpisode(s);
  S.GhostLogic.paceAll(s, 1);
  return s;
}

test("at your own pace they play a game of questions too, and a draft with finale picks (E1b's second slice)", () => {
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { botsPlay } = jiti("../src/lib/game/computer-players.ts");
  const s = league([OUT, IDOL]);
  assert.ok(botsPlay(s), "live: they answer");
  s.settings.ownPace = true;
  assert.ok(botsPlay(s), "at your own pace: they answer as they catch up");
  assert.ok(botsPlay(league([OUT, TRIVIA])), "trivia too");
  const d = S.defaultState();
  S.ensureNextEpisode(d);
  S.updateSettings(d, "showId", "survivor");
  S.updateSettings(d, "leagueTypeId", "classic-draft");
  S.updateSettings(d, "wikiSeason", 51);
  for (let i = 0; i < 8; i++) S.addCastaway(d, `Castaway ${i}`);
  d.players = [{ id: "ann", name: "ann", color: "#000" }, { id: "bot0", name: "Bot", color: "#000", automated: true }];
  S.updateSettings(d, "setupComplete", true);
  d.settings.ownPace = true;
  assert.ok(botsPlay(d), "a draft at your own pace");
});

test("at your own pace each answers each week as it catches up, on its copy before that week: never the week's results", () => {
  const s = aired([OUT, IDOL, WINS], [7, 6, 5]);
  assert.deepEqual(Bots.answers(s, [], { now: 0 }), [], "nobody plays live: each is catching up");
  const first = Bots.catchUpAnswers(s, [], null);
  assert.deepEqual(first.map((a) => `${a.playerId} ${a.question} ${a.episode}`).sort(), ["bot0 idol 1", "bot0 out 1", "bot0 wins 0", "bot1 idol 1", "bot1 out 1", "bot1 wins 0"], "at the start: who wins, and Episode 1's");
  const on = Bots.catchUpAnswers(s, first, 2);
  assert.deepEqual(on.map((a) => `${a.playerId} ${a.question} ${a.episode}`).sort(), ["bot0 idol 2", "bot0 idol 3", "bot0 out 2", "bot0 out 3", "bot1 idol 2", "bot1 idol 3", "bot1 out 2", "bot1 out 3"], "revealing Episode 2: Episodes 2 and 3's (the week after's, in before anyone opens it)");
  const out3 = on.filter((a) => a.question === "out" && a.episode === 3);
  assert.ok(out3.every((a) => !["c7", "c6"].includes(a.answer)), "who goes home in Episode 3: never someone out by Episode 2");
  // The spoiler guarantee: a season the same through Episode 2 with a different Episode 3 gives the same answers.
  const other = aired([OUT, IDOL, WINS], [7, 6, 4]);
  assert.deepEqual(Bots.catchUpAnswers(other, Bots.catchUpAnswers(other, [], null), 2), on, "the same, whoever went home in Episode 3");
  Bots.catchUpTo(s, 2);
  assert.deepEqual(Bots.catchUpAnswers(s, [...first, ...on], null), [], "caught up to 2: Episode 3's are in already");
  Bots.catchUpTo(s, 3);
  assert.ok(s.players.filter((p) => p.automated).every((p) => !S.GhostLogic.isCatchingUp(s, p.id)), "caught up to the latest");
  const live = Bots.answers(s, [...first, ...on], { now: 0 });
  assert.equal(live.filter((a) => a.question === "out" && a.episode === 4).length, 2, "then live: Episode 4's, as anyone's");
});

test("a person catching up at their own pace answers the episode after their mark, open until they've seen it (own pace part 4)", () => {
  const s = aired([OUT, IDOL, WINS], [7, 6, 5]);
  const AL = S.AnswerLogic;
  assert.ok(AL.ownWeek(s, "ann") && AL.ownWeek(s, "bot0"), "every seat answers by its own mark");
  assert.equal(AL.lateEpisode(s, 0, { player: "ann" }), 1, "at the start: Episode 1");
  assert.equal(AL.lateEpisode(s, 2, { player: "ann" }), 3, "having seen 2: Episode 3");
  const out = AL.questions(s).find((q) => q.id === "out");
  assert.ok(!AL.closed(s, out, 3, { mark: 2, player: "ann" }), "Episode 3 open while ann hasn't seen it, though it aired and has results");
  assert.ok(AL.closed(s, out, 2, { mark: 2, player: "ann" }), "Episode 2 closed once she has");
  const wins = AL.questions(s).find((q) => q.id === "wins");
  assert.ok(!AL.closed(s, wins, 0, { mark: 0, player: "ann" }) && AL.closed(s, wins, 0, { mark: 1, player: "ann" }), "who wins (closes at the game's start): open until she's seen its first episode");
  const last = { ...wins, closes: "finale" };
  assert.ok(!AL.closed(s, last, 0, { mark: 2, player: "ann", finale: 4 }) && AL.closed(s, last, 0, { mark: 4, player: "ann", finale: 4 }), "closing at the finale: open until she's seen it");
  const live = league([OUT]);
  live.players[0].lateJoin = { startEpisode: 1, catchingUp: true, seenThrough: 0 };
  assert.ok(!AL.ownWeek(live, "ann"), "a late joiner catching up in a live game: still on the live episode");
});

test("the gallery: Weekly Calls, Bingo and a stake play; Sharp and Normal differ on what usually happens", () => {
  assert.equal(C.botsFit({ preset: "weekly-calls" }), null, "Weekly Calls: their calls are guesses (E1c)");
  assert.equal(C.botsFit(C.baseById("bingo").spec), null, "Bingo: they tick what's settled (E1c)");
  assert.equal(C.botsFit(game([{ ...IDOL, wager: "total" }])), null, "a stake of your points (E1b's second slice)");
  const sharp = league([IDOL], ["sharp", "sharp", "sharp", "sharp", "sharp", "sharp", "sharp", "sharp"]);
  const casual = league([IDOL], ["casual", "casual", "casual", "casual", "casual", "casual", "casual", "casual"]);
  const yes = (s) => Bots.answers(s, [], { now: 0 }).filter((a) => a.answer === "yes").length;
  assert.ok(yes(sharp) <= yes(casual), `sharp says yes no more often than casual (${yes(sharp)} vs ${yes(casual)})`);
});
