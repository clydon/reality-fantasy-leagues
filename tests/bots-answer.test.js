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
// A stake: still one they don't play (they'd need their points as they stand).
const BET = { id: "bet", ask: "An idol played? Stake on it", answer: "yesNo", points: 1, asked: "each", wager: 3, settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
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
  const s = league([OUT, BET]);
  const now = S.AnswerLogic.episodeNow(s);
  const ep = s.episodes.find((e) => e.number === now);
  ep.airsAt = new Date(Date.now() - 3600 * 1000).toISOString();
  assert.deepEqual(Bots.answers(s, [], { now: Date.now() }).filter((a) => a.question === "out"), [], "the episode has started: closed");
  assert.ok(!Bots.answersQuestion(BET) && !Bots.answersAll(s), "a stake: not yet");
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

test("the gallery's Computer players square says the same: on for questions they answer, dashed with the reason for the rest", () => {
  assert.equal(C.botsFit(game([OUT, IDOL, WINS, HOW])), null);
  assert.match(C.botsFit(game([OUT, BET])), /stake points/);
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
  assert.ok(!botsPlay(league([OUT, BET])), "a stake: not yet, at any pace");
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

test("the gallery: Weekly Calls and Bingo play, a stake says why; Sharp and Normal differ on what usually happens", () => {
  assert.equal(C.botsFit({ preset: "weekly-calls" }), null, "Weekly Calls: their calls are guesses (E1c)");
  assert.equal(C.botsFit(C.baseById("bingo").spec), null, "Bingo: they tick what's settled (E1c)");
  assert.match(C.botsFit(game([{ ...IDOL, wager: "total" }])), /stake points/);
  const sharp = league([IDOL], ["sharp", "sharp", "sharp", "sharp", "sharp", "sharp", "sharp", "sharp"]);
  const casual = league([IDOL], ["casual", "casual", "casual", "casual", "casual", "casual", "casual", "casual"]);
  const yes = (s) => Bots.answers(s, [], { now: 0 }).filter((a) => a.answer === "yes").length;
  assert.ok(yes(sharp) <= yes(casual), `sharp says yes no more often than casual (${yes(sharp)} vs ${yes(casual)})`);
});
