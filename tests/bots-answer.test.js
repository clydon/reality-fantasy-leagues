// Computer players answering a game's own questions (docs/PLAN-start-a-game-redo.md E1b; bot-logic.js answers): each bot gives
// each open question one answer the engine accepts, from what the league knows (who goes home: the one most in danger), at its
// level; never twice (deterministic: a second run with what was stored has nothing to add); none for a question that's closed or
// a kind it doesn't answer yet; the gallery's list of kinds (start-gallery botsFit) the same as bot-logic's. Run with `npm test`.
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
const game = (ask) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask });

/** A game of questions as Start a game makes one, on Survivor, ann the person and two computer players. */
function league(ask, levels = ["solid", "sharp"]) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < 8; i++) S.addCastaway(s, `Castaway ${i}`);
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
  const s = league([OUT, ORDER]);
  const now = S.AnswerLogic.episodeNow(s);
  const ep = s.episodes.find((e) => e.number === now);
  ep.airsAt = new Date(Date.now() - 3600 * 1000).toISOString();
  assert.deepEqual(Bots.answers(s, [], { now: Date.now() }).filter((a) => a.question === "out"), [], "the episode has started: closed");
  assert.ok(!Bots.answersQuestion(ORDER) && !Bots.answersAll(s), "an order: not yet");
  assert.ok(Bots.answersQuestion(OUT) && Bots.answersQuestion(IDOL) && Bots.answersQuestion(HOW));
});

test("the gallery's Computer players square says the same: on for questions they answer, dashed with the reason for the rest", () => {
  assert.equal(C.botsFit(game([OUT, IDOL, WINS, HOW])), null);
  assert.match(C.botsFit(game([OUT, ORDER])), /don't answer "The order they go" yet/);
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
