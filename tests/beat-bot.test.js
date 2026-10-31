// The bot's call as an opponent (docs/PLAN-start-a-game-gpt.md step A14 part 2: the dial rows settle.bot and win.bot, the request
// s35 "Beat the bot: the AI makes its call too; you score when you're right and it's wrong"): a question's `beat: { by: 'bot',
// none? }`. The bot's call on each window is the server's (bot_calls, migration 0206; answer-points.ts botCallsFor hands it to the
// grade as facts.bot once the window has locked), graded by the same data as everyone's; a right answer scores only where the bot's
// call isn't right (a person or group answer each right pick it didn't name; a number the closest only when closer than the bot).
// Its shape and our check; its words; grading every kind it takes; its fallback from the start (no call, or a void one: plays as
// usual, or void); what it composes with (a split pot, only, a rollover, a parlay, a life, asked once); a viewer's mark; the bot's
// line on the table (answer-points.ts botLine). The server's reads are proven by scripts/dev-test/check-beat-bot.js. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");
const jiti = require("jiti")(__filename, { alias: { "@db": path.join(__dirname, "..", "db"), "@": path.join(__dirname, "..", "src") } });

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

const CTX = {
  moments: [
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  grouped: true,
};
/** Who goes home, before each episode, against the bot: the tracker's s35. */
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" }, beat: { by: "bot" } };
const HOW_MANY = { id: "many", ask: "How many idols played?", answer: "number", points: 3, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "count" }, beat: { by: "bot" } };
const game = (ask, score = {}, extra = {}) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...score }, rank: { by: "total" }, ask, ...extra });
const SEATS = ["ann", "bo", "cy", "di"];

/** A game of questions on Survivor with castaways C0.. (two tribes) and seats ann .. di. */
function league(spec, { n = 8, eps = 6 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "wikiSeason", 51);
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  const kele = S.addTribe(s, "Kele", "#c00");
  const hina = S.addTribe(s, "Hina", "#00c");
  s.castaways.forEach((c, i) => {
    c.tribeId = i < n / 2 ? kele.id : hina.id;
  });
  s.players = SEATS.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
/** Episode n's results: castaways `outs` voted out, `events` [type, castaway index] (its full results). */
function results(s, n, outs, events = []) {
  const e = ep(s, n);
  for (const i of outs) S.addElimination(s, e.id, cid(s, i), "Voted Out");
  for (const [type, i] of events) S.addScoringEvent(s, e.id, type, cid(s, i));
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
/** Answers for one question and episode: { playerId: answer }. */
const said = (n, by, question = "boot") => Object.entries(by).map(([playerId, answer]) => ({ playerId, question, episode: n, answer }));
const pts = (m) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
/** The facts with the bot's calls as the server hands them over: { "question|episode": call }. */
const withBot = (s, calls) => ({ ...A.facts(s), bot: new Map(Object.entries(calls)) });
const q0 = (s, i = 0) => S.gameOf(s).ask[i];

test("its shape: one call the bot can make, settled by data, a game of questions' own; its default and round trip", () => {
  assert.deepEqual(G.specProblems(game([BOOT]), CTX), []);
  assert.deepEqual(G.specWaitsFor(game([BOOT])), []);
  assert.deepEqual(G.fullSpec(game([BOOT])).ask[0].beat, { by: "bot", none: "plays" }, "a window the bot didn't call plays as usual by default");
  assert.deepEqual(G.BEAT, { none: "plays" });
  assert.equal(G.isBeat(BOOT), true);
  assert.equal(G.isBeat({ ...BOOT, beat: undefined }), false);
  // Every kind with one call: a person (or more), a group, yes or no, a number, an over/under, a choice.
  const kinds = [
    { answer: "person", pick: 2 },
    { answer: "group", pick: 1 },
    { ...IDOL },
    { ...HOW_MANY },
    { answer: "overUnder", line: 1.5, settle: { by: "moment", moment: "idolPlayed", take: "count" } },
    { answer: "choice", options: ["Kele", "Hina"] },
  ];
  for (const k of kinds) assert.deepEqual(G.specProblems(game([{ ...BOOT, ...k }]), CTX), [], k.answer);
  assert.deepEqual(G.specProblems(game([{ ...BOOT, beat: { by: "bot", none: "void" } }]), CTX), []);
  const problems = (spec) => ats(G.specProblems(spec, CTX));
  assert.deepEqual(problems(game([{ ...BOOT, beat: { by: "computer" } }])), ["ask[0].beat"]);
  assert.deepEqual(problems(game([{ ...BOOT, beat: { by: "bot", none: "later" } }])), ["ask[0].beat.none"]);
  assert.deepEqual(problems(game([{ ...BOOT, beat: { by: "bot", odds: 2 } }])), ["ask[0].beat.odds"], "nothing else in it");
  assert.deepEqual(problems(game([{ ...BOOT, answer: "order", pick: 3, asked: "once", settle: { by: "results", take: "order" } }])), ["ask[0].beat"], "an order isn't one call");
  assert.deepEqual(problems(game([{ ...IDOL, each: "person", settle: { by: "moment", moment: "idolPlayed", take: "happened" } }])), ["ask[0].beat"], "nor a question about each person");
  assert.deepEqual(problems(game([{ ...BOOT, settle: { by: "players", take: "majority" } }])), ["ask[0].beat"], "the bot isn't one of you");
  assert.deepEqual(problems(game([{ id: "t", ask: "Trivia", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" }, beat: { by: "bot" } }])), ["ask[0].beat"]);
  assert.deepEqual(problems(game([{ ...BOOT, wager: 3 }])), ["ask[0].beat"], "a wager is on your own call");
  assert.ok(problems(game([{ ...BOOT, from: "team" }])).includes("ask[0].beat"), "the bot has no team");
  // Only in a game of questions: a draft's finale predictions are its own.
  assert.ok(problems({ preset: "outlast", ask: [{ ...BOOT, asked: "once", settle: { by: "results", take: "winner" } }] }).includes("ask[0].beat"));
  // Its round trip through a league's settings.
  const s = league(game([BOOT]));
  assert.deepEqual(S.gameOf(s).ask[0].beat, { by: "bot", none: "plays" });
});

test("its words: when you're right and the bot isn't, each kind's, and what a window the bot didn't call does", () => {
  const words = describeSpec(game([BOOT]), { ...CTX, show: "Survivor" });
  assert.match(words.sentence, /2 points when you're right and the bot isn't\./);
  assert.match(words.rules.join(" "), /Who goes home\? The bot makes its call too, before it locks\. 2 points if you're right and it isn't\. If the bot makes no call, it plays as usual\./);
  assert.match(describeSpec(game([{ ...BOOT, beat: { by: "bot", none: "void" } }]), CTX).rules.join(" "), /If the bot makes no call, it doesn't count either way\./);
  assert.match(describeSpec(game([{ ...BOOT, pick: 2 }]), CTX).rules.join(" "), /Name two: 2 points for each one right that the bot didn't name\./);
  assert.match(describeSpec(game([HOW_MANY]), CTX).rules.join(" "), /The closest wins 3 points, if closer than the bot\./);
  // An episode fact against the bot keeps its own fallback's words.
  const quote = { id: "quote", ask: "Who says the title quote?", answer: "person", points: 1, asked: "each", settle: { by: "fact", fact: "titleQuote", take: "who" }, beat: { by: "bot" } };
  assert.match(describeSpec(game([quote]), CTX).rules.join(" "), /if you're right and it isn't\. If the bot makes no call, it plays as usual\. If research can't say for sure/);
  // Some of a game's questions against the bot: the sentence says which.
  const plain = { ...IDOL, id: "plain", beat: undefined };
  assert.match(describeSpec(game([BOOT, plain]), CTX).sentence, /On who goes home, only when the bot's call isn't right\./);
  assert.match(describeSpec(game([{ ...BOOT, share: "split" }]), CTX).sentence, /split between everyone right\. Only when the bot's call isn't right\./);
});

test("a person: right and the bot wrong scores; the bot right takes it from everyone; each pick on its own on a double boot", () => {
  const s = league(game([BOOT]));
  const c = (i) => cid(s, i);
  const rows = said(1, { ann: c(5), bo: c(5), cy: c(2) });
  // Nothing graded until the server has said the bot's calls (as trivia without its key).
  results(s, 1, [5]);
  assert.deepEqual(A.grade(s, rows).verdicts.get("boot|1"), { state: "waiting" });
  // The bot said C2: wrong, so ann and bo score.
  assert.deepEqual(pts(A.grade(s, rows, withBot(s, { "boot|1": c(2) })).points), { ann: 2, bo: 2 });
  // The bot said C5 too: right, so nobody does, though ann and bo were right.
  const beaten = A.grade(s, rows, withBot(s, { "boot|1": c(5) }));
  assert.equal(beaten.points.size, 0);
  const v = beaten.verdicts.get("boot|1");
  assert.equal(G.isRight(q0(s), v, rows[0], rows), true, "your call was still right: only the points are the bot's to take");
  assert.equal(G.botRight(q0(s), v, c(5), rows), true);
  assert.equal(G.botRight(q0(s), v, c(2), rows), false);
  // A double boot, pick two: each right pick the bot didn't name.
  const d = league(game([{ ...BOOT, pick: 2 }]));
  results(d, 1, [1, 6]);
  const two = said(1, { ann: [cid(d, 1), cid(d, 6)], bo: [cid(d, 1), cid(d, 3)], cy: [cid(d, 6), cid(d, 0)] });
  assert.deepEqual(pts(A.grade(d, two, withBot(d, { "boot|1": [cid(d, 1), cid(d, 2)] })).points), { ann: 2, cy: 2 }, "C1 was the bot's too");
  assert.deepEqual(pts(A.grade(d, two, withBot(d, { "boot|1": [cid(d, 1), cid(d, 6)] })).points), {}, "it got both");
});

test("a yes or no, a number, a group, an over/under and a choice", () => {
  const s = league(game([IDOL, HOW_MANY]));
  results(s, 1, [5], [["idolPlayed", 0], ["idolPlayed", 1]]);
  const yes = said(1, { ann: "yes", bo: "no", cy: "yes" }, "idol");
  assert.deepEqual(pts(A.grade(s, yes, withBot(s, { "idol|1": "no" })).points), { ann: 1, cy: 1 });
  assert.equal(A.grade(s, yes, withBot(s, { "idol|1": "yes" })).points.size, 0);
  // A number: the closest, only when closer than the bot (two idols were played).
  const many = said(1, { ann: 2, bo: 3, cy: 0 }, "many");
  assert.deepEqual(pts(A.grade(s, many, withBot(s, { "many|1": 4 })).points), { ann: 3 });
  assert.equal(A.grade(s, many, withBot(s, { "many|1": 2 })).points.size, 0, "a tie with the bot is the bot's");
  assert.deepEqual(pts(A.grade(s, said(1, { bo: 3, cy: 0 }, "many"), withBot(s, { "many|1": 2 })).points), {}, "the bot's closer than anyone");
  assert.deepEqual(pts(A.grade(s, said(1, { bo: 3, cy: 0 }, "many"), withBot(s, { "many|1": 5 })).points), { bo: 3 }, "closer than the bot, though not exact");
  const ns = S.gameOf(s).ask[1];
  const nv = A.grade(s, many, withBot(s, { "many|1": 2 })).verdicts.get("many|1");
  assert.equal(G.botRight(ns, nv, 2, many), true);
  assert.equal(G.botRight(ns, nv, 4, many), false);
  // A group (which tribe someone going home was on), an over/under and a choice.
  const g = league(game([{ ...BOOT, id: "tribe", ask: "Which tribe goes to tribal?", answer: "group", pick: 1 }]));
  results(g, 1, [6]);
  const [kele, hina] = g.tribes.map((t) => t.id);
  const tribes = said(1, { ann: hina, bo: kele }, "tribe");
  assert.deepEqual(pts(A.grade(g, tribes, withBot(g, { "tribe|1": kele })).points), { ann: 2 });
  assert.equal(A.grade(g, tribes, withBot(g, { "tribe|1": hina })).points.size, 0);
  const ou = league(game([{ ...HOW_MANY, id: "ou", answer: "overUnder", line: 1.5 }]));
  results(ou, 1, [5], [["idolPlayed", 0], ["idolPlayed", 1]]);
  assert.deepEqual(pts(A.grade(ou, said(1, { ann: "over", bo: "under" }, "ou"), withBot(ou, { "ou|1": "under" })).points), { ann: 3 });
  const ch = league(game([{ ...BOOT, id: "ch", answer: "choice", options: ["Kele", "Hina"], settle: { by: "results", take: "out" } }]));
  results(ch, 1, [6]);
  assert.deepEqual(pts(A.grade(ch, said(1, { ann: "Hina", bo: "Kele" }, "ch"), withBot(ch, { "ch|1": "kele" })).points), { ann: 2 }, "matched the way a choice is");
  assert.equal(A.grade(ch, said(1, { ann: "Hina" }, "ch"), withBot(ch, { "ch|1": "Hina" })).points.size, 0);
});

test("its fallback: a window the bot made no call for plays as usual, or (void) doesn't count either way", () => {
  const s = league(game([BOOT]));
  results(s, 1, [5]);
  const rows = said(1, { ann: cid(s, 5), bo: cid(s, 2) });
  // No call (the bot was away, the game was made after it called): as if there were no bot.
  assert.deepEqual(pts(A.grade(s, rows, withBot(s, {})).points), { ann: 2 });
  assert.equal(A.grade(s, rows, withBot(s, {})).verdicts.get("boot|1").state, "known");
  // A call of null is none.
  assert.deepEqual(pts(A.grade(s, rows, withBot(s, { "boot|1": null })).points), { ann: 2 });
  // void: no points either way, neither right nor wrong.
  const v = league(game([{ ...BOOT, beat: { by: "bot", none: "void" } }]));
  results(v, 1, [5]);
  const vr = said(1, { ann: cid(v, 5), bo: cid(v, 2) });
  const graded = A.grade(v, vr, withBot(v, {}));
  assert.equal(graded.points.size, 0);
  const off = graded.verdicts.get("boot|1");
  assert.equal(off.state, "off");
  assert.match(off.why, /The bot made no call/);
  assert.equal(G.isRight(q0(v), off, vr[0], vr), null);
  // With a call, void plays as any.
  assert.deepEqual(pts(A.grade(v, vr, withBot(v, { "boot|1": cid(v, 1) })).points), { ann: 2 });
  // Still waiting for the episode, whatever the bot said.
  assert.equal(A.grade(v, said(2, { ann: cid(v, 1) }), withBot(v, {})).verdicts.get("boot|2").state, "waiting");
});

test("it composes: a split pot of those who beat it, only, a rollover the bot's right calls carry, a parlay, a life", () => {
  const split = league(game([{ ...BOOT, share: "split", points: 6 }]));
  results(split, 1, [5]);
  const r = said(1, { ann: cid(split, 5), bo: cid(split, 5), cy: cid(split, 5) });
  assert.deepEqual(pts(A.grade(split, r, withBot(split, { "boot|1": cid(split, 2) })).points), { ann: 2, bo: 2, cy: 2 });
  assert.equal(A.grade(split, r, withBot(split, { "boot|1": cid(split, 5) })).points.size, 0);
  // Only: a right pick scores only when nobody else (the bot included) named it.
  const only = league(game([{ ...BOOT, share: "only" }]));
  results(only, 1, [5]);
  assert.deepEqual(pts(A.grade(only, said(1, { ann: cid(only, 5), bo: cid(only, 2) }), withBot(only, { "boot|1": cid(only, 3) })).points), { ann: 2 });
  assert.equal(A.grade(only, said(1, { ann: cid(only, 5) }), withBot(only, { "boot|1": cid(only, 5) })).points.size, 0);
  // A rollover: a week the bot got carries its points into the next.
  const roll = league(game([{ ...BOOT, rollover: true }]));
  results(roll, 1, [5]);
  results(roll, 2, [4]);
  const two = [...said(1, { ann: cid(roll, 5) }), ...said(2, { ann: cid(roll, 4) })];
  const rolled = A.grade(roll, two, withBot(roll, { "boot|1": cid(roll, 5), "boot|2": cid(roll, 0) }));
  assert.deepEqual(pts(rolled.points), { ann: 4 }, "week 1's 2 points carried into week 2");
  // A parlay: right on both legs where the bot took one of them multiplies only what you earned.
  const par = league(game([BOOT, { ...IDOL, beat: undefined }], { parlays: [{ of: ["boot", "idol"], times: 3 }] }));
  results(par, 1, [5], [["idolPlayed", 0]]);
  const both = [...said(1, { ann: cid(par, 5) }), ...said(1, { ann: "yes" }, "idol")];
  assert.deepEqual(pts(A.grade(par, both, withBot(par, { "boot|1": cid(par, 5) })).points), { ann: 3 }, "the idol leg tripled, the boot leg the bot's");
  assert.deepEqual(pts(A.grade(par, both, withBot(par, { "boot|1": cid(par, 1) })).points), { ann: 9 });
  // A life rides on your own call, not the bot's: right but beaten keeps it; wrong loses it.
  const lives = league(game([BOOT], { lives: 1 }, { rank: { by: "standing", oneLeft: "plays" } }));
  results(lives, 1, [5]);
  results(lives, 2, [4]);
  const lr = [...said(1, { ann: cid(lives, 5), bo: cid(lives, 2) }), ...said(2, { ann: cid(lives, 4) })];
  const w = A.walk(lives, lr, withBot(lives, { "boot|1": cid(lives, 5), "boot|2": cid(lives, 1) }));
  assert.deepEqual(w.out, { bo: 1, cy: 1, di: 1 }, "bo was wrong, cy and di didn't answer; ann was right though the bot was too");
  assert.equal(w.totals.ann, 2, "her week 2 beat the bot");
});

test("asked once: the bot's call on the game's window (0), and at a viewer's mark nothing past it is graded", () => {
  const s = league(game([{ ...BOOT, id: "first", ask: "Who goes home first?", asked: "once" }]));
  results(s, 1, [3]);
  const rows = said(0, { ann: cid(s, 3), bo: cid(s, 3) }, "first");
  assert.equal(G.botKey(q0(s), 7), "first|0");
  assert.deepEqual(pts(A.grade(s, rows, withBot(s, { "first|0": cid(s, 1) })).points), { ann: 2, bo: 2 });
  assert.equal(A.grade(s, rows, withBot(s, { "first|0": cid(s, 3) })).points.size, 0);
  // At a viewer's mark before episode 2's results, week 2 waits whatever the bot said.
  const m = league(game([BOOT]));
  results(m, 1, [5]);
  results(m, 2, [4]);
  const seen = S.GhostLogic.viewFor(m, "ann", 1);
  const g = A.grade(seen, said(2, { ann: cid(m, 4) }), withBot(seen, { "boot|2": cid(m, 0) }));
  assert.equal(g.verdicts.get("boot|2").state, "waiting");
});

test("the bot's lock is the players' (a league catching up ignores the broadcast's clock); one waiting for the finale locks for it at the start", () => {
  const BotCalls = require("../db/bot-calls.js");
  const s = league(game([BOOT, { ...BOOT, id: "winner", ask: "Who wins?", asked: "once", closes: "finale", settle: { by: "results", take: "winner" } }]));
  const HOUR = 3600 * 1000;
  const now = Date.parse("2026-11-04T12:00:00Z");
  const boot = q0(s);
  const winner = q0(s, 1);
  // Open before Episode 1 airs; locked once it has (by the schedule's air time for an episode the league hasn't stamped) or has results.
  assert.equal(BotCalls.locked(s, boot, 1, { now, airAt: new Date(now + HOUR).toISOString() }), false);
  assert.equal(BotCalls.locked(s, boot, 1, { now, airAt: new Date(now - HOUR).toISOString() }), true);
  assert.equal(BotCalls.locked(s, boot, 2, { now }), false, "no air time known: open, as the players' is");
  // Who wins waits for the finale for everyone else, but the bot calls it before the game's first episode.
  assert.equal(S.AnswerLogic.closed(s, winner, 0, { now, airAt: new Date(now - HOUR).toISOString() }), false);
  assert.equal(BotCalls.locked(s, winner, 0, { now, airAt: new Date(now - HOUR).toISOString() }), true);
  assert.equal(BotCalls.lockOf(s, winner, 0), 1);
  // The windows whose call locks at an episode: Episode 1's boot and the game's own who wins; Episode 2's boot alone.
  assert.deepEqual(BotCalls.windowsAt(s, 1, { now }).map((w) => [w.q.id, w.window]), [["boot", 1], ["winner", 0]]);
  assert.deepEqual(BotCalls.windowsAt(s, 2, { now }).map((w) => [w.q.id, w.window]), [["boot", 2]]);
  results(s, 1, [5]);
  assert.deepEqual(BotCalls.windowsAt(s, 1, { now }), [], "nothing once its episode has results");
  // A league catching up at its own pace keeps an episode open past the broadcast's air time (closed reads no schedule for it).
  S.updateSettings(s, "revealedThroughEpisode", 1);
  assert.equal(BotCalls.locked(s, boot, 2, { now, airAt: new Date(now - HOUR).toISOString() }), false);
  // Who the bot can name: who's still in, as a seat's answer could (the engine's faces); a group, the groups someone still in is on.
  assert.equal(BotCalls.facesFor(s, boot).length, 7);
  assert.ok(!BotCalls.facesFor(s, boot).some((f) => f.id === cid(s, 5)));
  assert.equal(BotCalls.facesFor(s, IDOL), null, "a yes or no names nobody");
  const g = league(game([{ ...BOOT, id: "tribe", answer: "group", pick: 1 }]));
  assert.deepEqual(BotCalls.facesFor(g, q0(g)).map((f) => f.name), ["Kele", "Hina"]);
});

test("the engine's faces: who's still in, your own team, the groups someone still in is on", () => {
  const s = league(game([BOOT]));
  results(s, 1, [5]);
  assert.deepEqual(S.AnswerLogic.faces(s, q0(s)).map((f) => f.name), ["C0", "C1", "C2", "C3", "C4", "C6", "C7"]);
  assert.equal(S.AnswerLogic.faces(s, q0(s))[0].photoUrl, null);
  s.castaways[0].ownerIds = ["ann"];
  s.castaways[0].ownerId = "ann";
  const team = S.AnswerLogic.faces(s, { ...q0(s), from: "team" }, { playerId: "ann" });
  assert.deepEqual(team.map((f) => f.name), S.Core.ownedCastawayIds(s, "ann").map((id) => s.castaways.find((c) => c.id === id).name));
  // The groups read from the format's state over time on a season played in pairs: none while they aren't sure.
  const g = league(game([{ ...BOOT, id: "pair", answer: "group", pick: 1 }]));
  const fg = { offered: [{ id: "p1", name: "C0 & C1", members: [] }], lockSure: false };
  assert.deepEqual(S.AnswerLogic.faces(g, q0(g), { groups: fg }), []);
  assert.deepEqual(S.AnswerLogic.faces(g, q0(g), { groups: { ...fg, lockSure: true } }), [{ id: "p1", name: "C0 & C1", photoUrl: null }]);
});

test("the bot's line on the table: the windows it called, how many it got right, and each of you against it", () => {
  const { botLine } = jiti("../src/lib/server/answer-points.ts");
  const s = league(game([BOOT]));
  results(s, 1, [5]);
  results(s, 2, [4]);
  results(s, 3, [3]);
  const rows = [
    ...said(1, { ann: cid(s, 5), bo: cid(s, 5), cy: cid(s, 1) }),
    ...said(2, { ann: cid(s, 4), bo: cid(s, 0) }),
    ...said(3, { ann: cid(s, 3) }),
  ];
  const facts = withBot(s, { "boot|1": cid(s, 5), "boot|2": cid(s, 0), "boot|4": cid(s, 2) });
  const line = botLine({ view: s, facts, rows, walk: null });
  // Week 1 the bot was right (nobody scores: ann and bo right, cy wrong); week 2 wrong (ann beat it); week 3 no call (plays as
  // usual, not one of its calls); week 4 not settled.
  assert.equal(line.called, 2);
  assert.equal(line.right, 1);
  assert.deepEqual(line.vs, { ann: { beat: 1, beaten: 1 }, bo: { beat: 0, beaten: 1 }, cy: { beat: 0, beaten: 1 } });
  // A game with nothing against the bot has no line.
  const plain = league(game([{ ...BOOT, beat: undefined }]));
  assert.equal(botLine({ view: plain, facts: A.facts(plain), rows: [], walk: null }), null);
});
