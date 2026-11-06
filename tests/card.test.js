// A new card each week (docs/PLAN-start-a-game-gpt.md track C, C7): one generator for each episode's set of questions or objectives,
// `card: { from: 'moments', each, of }`, the show's moments its list names drawn in turn (Weekly Calls' rotation, drawInTurn), read
// by a question on the card (`card: true`: one question for each of its lines, the line's moment settling it that episode) and by the
// moments that count each week (`score.only: 'card'`). Its shape and refusals, the draw, the questions as they're answered (askOf),
// its settings both ways, its words; grading on a made-up season worked out by hand below: a sheet on the card with a ticket built from
// its lines and a bank (tracker row p10, the user's first game), and the week's objectives (row p12, the user's third). Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const A = S.AnswerLogic;
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "rewardWin", label: "Won reward", defaultPoints: 1, answeredBy: "research" },
    { id: "confessional", label: "Cried", defaultPoints: 1, answeredBy: "league" },
  ],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [],
};
const MOMENTS = ["individualImmunity", "idolFound", "rewardWin"];
const SHEET = { id: "sheet", ask: "This week's sheet", answer: "yesNo", points: 1, asked: "each", card: true, settle: { by: "moment", take: "happened" } };
const WHO = { id: "who", ask: "Who does it?", answer: "person", points: 2, asked: "each", card: true, settle: { by: "moment", take: "who" } };
const TICKET = { id: "ticket", ask: "Build a ticket", answer: "ticket", points: 0, asked: "each", wager: "total", settle: { by: "legs", of: ["sheet"] } };
const questions = (ask, card = { each: 2, of: MOMENTS }, score = {}) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers", ...score }, rank: { by: "total" }, ask, card });
const objectives = (card = { each: 1, of: MOMENTS }, hits = "pick") => ({
  get: { by: "pick", each: 2 }, count: { pick: true }, score: { by: "moments", points: null, only: "card", hits }, rank: { by: "weeks" }, card,
});
const problems = (s) => G.specProblems(s, CTX).map((p) => `${p.at}: ${p.problem}`);
const ats = (s) => G.specProblems(s, CTX).map((p) => p.at);
const WORDS = { show: "Survivor 51", castaway: "castaway", moments: CTX.moments };
const obj = (m) => Object.fromEntries(m || []);

test("the draw: each episode the next `each` of the list, round and round it (Weekly Calls' rotation)", () => {
  const list = ["a", "b", "c", "d", "e"];
  assert.deepEqual([1, 2, 3, 4].map((n) => G.drawInTurn(list, 2, n)), [["a", "b"], ["c", "d"], ["e", "a"], ["b", "c"]]);
  assert.deepEqual(G.drawInTurn(list, 5, 3), list, "the whole list, every episode");
  assert.deepEqual(G.drawInTurn(["a", "b"], 3, 1), ["a", "b"], "never more than the list has");
  assert.deepEqual(G.drawInTurn(list, 2, 0), ["a", "b"], "before the first, the first");
  assert.deepEqual([G.drawInTurn([], 2, 1), G.drawInTurn(list, 0, 1)], [[], []]);
  // The card's lines, and the moment a line is about at an episode.
  const card = G.cardOf(G.fullSpec(questions([SHEET])));
  assert.deepEqual(card, { from: "moments", each: 2, of: MOMENTS });
  assert.deepEqual([1, 2, 3].map((n) => G.cardLines(card, n)), [["individualImmunity", "idolFound"], ["rewardWin", "individualImmunity"], ["idolFound", "rewardWin"]]);
  const line2 = G.askOf(G.fullSpec(questions([SHEET])))[1];
  assert.deepEqual([1, 2, 3].map((n) => G.cardMoment(line2, n)), ["idolFound", "individualImmunity", "rewardWin"]);
  assert.equal(G.cardMoment({ ...line2, card: { ...line2.card, line: 5 } }, 1), null);
  assert.equal(G.cardMoment(SHEET, 1), null, "the question as the spec says it isn't a line");
});

test("the questions as they're answered: each on the card one for each line, a ticket's legs its lines", () => {
  const s = G.fullSpec(questions([SHEET, WHO, { id: "boot", ask: "Who goes home?", answer: "person", points: 3, asked: "each", settle: { by: "results", take: "out" } }, TICKET]));
  const ask = G.askOf(s);
  assert.deepEqual(ask.map((q) => q.id), ["sheet.1", "sheet.2", "who.1", "who.2", "boot", "ticket"]);
  assert.deepEqual(ask[0].card, { of: MOMENTS, each: 2, line: 0, from: "sheet" });
  assert.deepEqual(ask[5].settle.of, ["sheet.1", "sheet.2"]);
  assert.equal(G.askOf(s), ask, "worked out once for each list");
  assert.equal(G.linesAsked(s), 6);
  // A ticket's parts read from its lines: two to two legs (the card's two), 3 times its stake for both.
  assert.deepEqual([G.ticketOf(ask[5]).min, G.ticketOf(ask[5]).max, G.ticketOf(ask[5]).payouts], [2, 2, [3]]);
  // A game without a card: its own list, the same array.
  const plain = G.fullSpec(questions([{ ...SHEET, card: undefined, settle: { by: "moment", moment: "idolFound", take: "happened" } }], undefined));
  delete plain.card;
  assert.equal(G.askOf(plain), plain.ask);
  // The engine reads them through AnswerLogic.questions.
  const st = S.defaultState();
  S.updateSettings(st, "leagueTypeId", "questions");
  S.updateSettings(st, "showId", "survivor");
  assert.deepEqual(S.setGame(st, questions([SHEET, TICKET]), { ctx: CTX }), []);
  assert.deepEqual(A.questions(st).map((q) => q.id), ["sheet.1", "sheet.2", "ticket"]);
});

test("its shape: a card, a question on it, the moments that count each week; what's refused", () => {
  assert.deepEqual(problems(questions([SHEET])), []);
  assert.deepEqual(problems(questions([SHEET, WHO, TICKET], { each: 2, of: MOMENTS }, { bank: { start: 500 } })), []);
  assert.deepEqual(problems(questions([{ ...SHEET, answer: "number", settle: { by: "moment", take: "count" } }, { ...WHO, settle: { by: "moment", take: "most" } }])), []);
  assert.deepEqual(problems(questions([{ ...SHEET, wager: "total", odds: "pool", share: "split" }])), [], "a line is a question: a stake, odds, a share");
  assert.deepEqual(problems(objectives()), []);
  assert.deepEqual(problems({ ...objectives(), get: { by: "draft", each: 3, order: "snake", own: "shared" }, count: { start: 2 }, rank: { by: "total" } }).filter((p) => p.startsWith("card") || p.startsWith("score")), [], "a lineup's objectives too");
  assert.equal(G.typeOf(questions([SHEET])), "questions");
  assert.equal(G.typeOf(objectives()), "pickem");
  assert.deepEqual(G.specWaitsFor(questions([SHEET, TICKET], undefined, { bank: { start: 500 } })), []);
  assert.deepEqual(G.specWaitsFor(objectives()), []);
  // The card's own.
  assert.deepEqual(problems(questions([SHEET], { each: 0, of: MOMENTS })), ["card.each: A card has 1 to 12 lines each episode"]);
  assert.deepEqual(problems(questions([SHEET], { each: 13, of: MOMENTS })), ["card.each: A card has 1 to 12 lines each episode"]);
  assert.deepEqual(problems(questions([SHEET], { each: 4, of: MOMENTS })), ["card.each: A card of 4 each episode is drawn from at least 4 moments: name more, or draw fewer"]);
  assert.deepEqual(problems(questions([SHEET], { each: 1, of: [] })), ["card.of: A card is drawn from a list of 1 to 40 of the show's moments"]);
  assert.deepEqual(problems(questions([SHEET], { each: 1, of: ["idolFound", "idolFound"] })), ["card.of: A moment is named twice"]);
  assert.deepEqual(problems(questions([SHEET], { each: 1, of: MOMENTS, from: "bot" })), ["card.from: A card is drawn from the show's moments: from 'moments'"]);
  assert.deepEqual(problems(questions([SHEET], "card")), ["card: A card is { from: 'moments', each, of: [the show's moments] }"]);
  assert.ok(ats(questions([SHEET], { each: 1, of: MOMENTS, extra: 1 })).includes("card.extra"));
  // The data-can-settle rule: each moment is the show's, one research answers.
  assert.deepEqual(problems(questions([SHEET], { each: 1, of: ["idolFound", "nope"] })), ["card.of[1]: \"nope\" isn't one of the show's moments"]);
  assert.deepEqual(problems(questions([SHEET], { each: 1, of: ["idolFound", "confessional"] })), ["card.of[1]: Cried is the couch's word: research doesn't answer it, so data can't settle it"]);
  assert.deepEqual(problems(objectives({ each: 1, of: ["confessional", "idolFound"] })), ["card.of[0]: Cried is the couch's word: research doesn't answer it, so data can't settle it"]);
  // Nothing reads it.
  assert.deepEqual(problems(questions([{ ...SHEET, card: undefined, settle: { by: "moment", moment: "idolFound", take: "happened" } }])), ["card: A card is for questions on it (card: true) or the moments that count each week (score.only: 'card')"]);
  // A question on the card.
  const bad = (q, at, more) => assert.ok(problems(questions(more || [q])).some((p) => p.startsWith(`ask[0].${at}`)), `${at}: ${problems(questions(more || [q])).join(" | ")}`);
  bad({ ...SHEET, asked: "once" }, "asked");
  bad({ ...SHEET, over: 2 }, "asked");
  bad({ ...SHEET, settle: { by: "moment", take: "happened", moment: "idolFound" } }, "settle.moment");
  bad({ ...SHEET, settle: { by: "results", take: "out" } }, "settle");
  bad({ ...SHEET, settle: { by: "moment", take: "first" } }, "settle");
  bad({ ...SHEET, answer: "overUnder", line: 1, settle: { by: "moment", take: "count" } }, "answer");
  bad({ ...SHEET, answer: "choice", options: ["Yes", "No"] }, "answer");
  bad({ ...SHEET, rollover: true }, "rollover");
  bad({ ...SHEET, card: "yes" }, "card");
  assert.deepEqual(problems({ ...questions([SHEET]), card: undefined }), ["ask[0].card: A question on the card needs the game's card: { from: 'moments', each, of }"]);
  assert.ok(ats({ ...G.PRESETS.outlast, ask: [SHEET], card: { each: 1, of: MOMENTS } }).some((at) => at === "ask[0].card"), "a draft's own questions are the spec's");
  // A line's id is no other question's; each line is a question against the most a game asks.
  assert.ok(problems(questions([SHEET, { ...SHEET, id: "sheet.2", card: undefined, settle: { by: "moment", moment: "idolFound", take: "happened" } }])).includes("ask[0].id: \"sheet.2\" is a line of the card \"sheet\": name the other question something else"));
  assert.ok(ats(questions([SHEET, WHO, { ...SHEET, id: "s3" }], { each: 5, of: [...MOMENTS, "idolFound2", "x"].slice(0, 3).concat(["a", "b"]) })).includes("card.each"));
  // A parlay, the players' own answers and a life don't ride on a card's lines (each is a new moment each week); a ticket does.
  const IDOL = { id: "idol", ask: "Idol?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolFound", take: "happened" } };
  assert.ok(problems(questions([SHEET, IDOL], undefined, { parlays: [{ of: ["sheet", "idol"], times: 2 }] })).includes("score.parlays[0].of: \"sheet\" is the card's: its lines are new each week, so build a ticket from them"));
  assert.ok(ats(questions([SHEET, { ...IDOL, id: "most", settle: { by: "players", take: "majority", of: "sheet" } }])).includes("ask[1].settle.of"));
  assert.ok(ats(questions([SHEET, IDOL], undefined, { lives: 2, livesOn: ["sheet"] })).includes("score.livesOn[0]"));
  assert.ok(ats(questions([SHEET], undefined, { lives: 2 })).includes("score.lives"), "nothing a life rides on");
  // The code review's: a line's id fits what an answer is stored by (40 characters: "<id>.<n>"); a card far too big refused before
  // anything is drawn from it; a life rides on the game's own questions beside a card (the card's lines are each still about their
  // own episode, so head to head waits for them).
  assert.ok(problems(questions([{ ...SHEET, id: "x".repeat(39) }])).includes("ask[0].id: A question on the card leaves room for its lines' numbers: an id of 38 characters at most"));
  assert.deepEqual(problems(questions([{ ...SHEET, id: "x".repeat(38) }])), []);
  const t0 = Date.now();
  assert.ok(ats(questions([SHEET, TICKET], { each: 1e9, of: MOMENTS })).includes("card.each"));
  assert.ok(Date.now() - t0 < 1000, "refused at once");
  assert.equal(G.askOf(G.fullSpec(questions([SHEET], { each: 1e9, of: MOMENTS }))).length, 1, "nothing drawn from it");
  const lives = { ...questions([SHEET, IDOL], undefined, { lives: 2 }), rank: { by: "standing" } };
  assert.deepEqual(problems(lives), []);
  assert.deepEqual(G.answerParts(G.fullSpec(lives)).on, ["idol"]);
  assert.ok(G.livesQuestion(G.askOf(G.fullSpec(questions([SHEET])))[0]), "a line is about its episode alone");
  // The moments that count each week: only with a card.
  assert.deepEqual(problems({ ...objectives(), card: undefined }), ["score.only: Only the card's moments count each week: give the game a card, { from: 'moments', each, of }"]);
});

test("its settings, both ways: the card in gameCard, only the card's moments in scoreOnly", () => {
  const spec = G.fullSpec(questions([SHEET, TICKET], { each: 2, of: MOMENTS }, { bank: { start: 500 } }));
  const st = G.settingsOf(spec);
  assert.deepEqual(st.gameCard, { each: 2, of: MOMENTS, from: "moments" });
  assert.deepEqual(G.specOf(st).card, spec.card);
  assert.deepEqual(G.specOf(st).ask, spec.ask);
  const pick = G.fullSpec(objectives());
  const ps = G.settingsOf(pick);
  assert.equal(ps.scoreOnly, "card");
  assert.deepEqual(ps.gameCard, { each: 1, of: MOMENTS, from: "moments" });
  const back = G.specOf(ps);
  assert.deepEqual([back.score.only, back.card], ["card", pick.card]);
  assert.equal(G.settingsOf(G.fullSpec(G.PRESETS["weekly-lineup"])).gameCard, undefined);
});

test("its words: the card, its questions and a ticket from its lines; the moments that count each week", () => {
  const d = (s) => G.describeSpec(G.fullSpec(s), WORDS);
  const sheet = d(questions([{ ...SHEET, points: 0, wager: "total" }, TICKET], { each: 2, of: MOMENTS }, { bank: { start: 500 } }));
  assert.match(sheet.sentence, /^A game for Survivor 51: everyone answers two questions before each episode: whether each of the card's two moments happens, all season\. Each episode's card is the next two of won immunity, found an idol and won reward, in turn, so it's new each episode\. /);
  assert.match(sheet.sentence, /Build a ticket from the card's two lines: put two of your calls on it and stake any of your bank; all of them right wins 3 times your stake for two\./);
  assert.ok(sheet.rules.includes("No draft, no team. Answer two questions:"), sheet.rules.join("\n"));
  assert.ok(sheet.rules.includes("Each episode's card is the next two of won immunity, found an idol and won reward, in turn, so it's new each episode."));
  assert.ok(sheet.rules.some((r) => r.startsWith("Before each episode: This week's sheet: for each of the two moments on that episode's card, whether it happens: each its own question.")), sheet.rules.join("\n"));
  assert.ok(sheet.rules.some((r) => r.startsWith("Before each episode: Build a ticket: from the card's two lines, put two of your answers on it")));
  const who = d(questions([WHO], { each: 1, of: MOMENTS }));
  assert.match(who.sentence, /everyone answers one question before each episode: who does the card's moment, all season\. Each episode's card is the next one of won immunity, found an idol and won reward, in turn/);
  assert.ok(who.rules.some((r) => r.startsWith("Before each episode: Who does it? For each of the moment on that episode's card, who does it: each its own question.")) || who.rules.some((r) => r.includes("who does it: each its own question.")), who.rules.join("\n"));
  const all = d(questions([SHEET], { each: 3, of: MOMENTS }));
  assert.match(all.sentence, /Each episode's card: won immunity, found an idol and won reward\./);
  const p12 = d(objectives());
  assert.match(p12.sentence, /Only the moments on each episode's card count\. Each episode's card is the next one of won immunity, found an idol and won reward, in turn, so it's new each episode\. Each is an objective:/);
  assert.ok(p12.rules.includes("Only the moments on each episode's card count. Each episode's card is the next one of won immunity, found an idol and won reward, in turn, so it's new each episode."), p12.rules.join("\n"));
});

/** A game of questions on Survivor with ten castaways and `players`, made `spec` through setGame. */
function league(spec, type, players = ["ann", "bo", "cy"]) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  for (let i = 0; i < 10; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;

test("graded: each line on its moment that episode, a ticket from the card's lines, a bank (p10)", () => {
  const s = league(questions([SHEET, WHO, TICKET], { each: 2, of: MOMENTS }, { bank: { start: 100 } }), "questions");
  // Episode 1's card: won immunity, found an idol. Castaway 9 out; Castaway 0 immune; Castaway 1 found an idol.
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  S.addElimination(s, e1.id, cid(s, 9), "Voted Out");
  S.addScoringEvent(s, e1.id, "individualImmunity", cid(s, 0));
  S.addScoringEvent(s, e1.id, "idolFound", cid(s, 1));
  // Episode 2's card: won reward, won immunity. Castaway 8 out; Castaway 3 won reward; Castaway 2 immune.
  const e2 = S.ensureEpisodeNumber(s, 2, false);
  S.addElimination(s, e2.id, cid(s, 8), "Voted Out");
  S.addScoringEvent(s, e2.id, "rewardWin", cid(s, 3));
  S.addScoringEvent(s, e2.id, "individualImmunity", cid(s, 2));
  S.ensureEpisodeNumber(s, 3, false);
  const say = (n, by) => Object.entries(by).flatMap(([playerId, a]) => Object.entries(a).map(([question, answer]) => ({ playerId, question, episode: n, answer: typeof answer === "number" ? cid(s, answer) : answer })));
  const rows = [
    // Episode 1: ann yes (immunity: right, 1), no (an idol: wrong), Castaway 0 and 1 (right, 2 each): 5; her ticket of both sheet
    // lines for 10 lost (the idol's wrong). bo yes, yes (right, 1 each), Castaway 2 on immunity (wrong): 2; his ticket of both for 5
    // won: 3 x 5 = 15. cy answers nothing.
    ...say(1, {
      ann: { "sheet.1": "yes", "sheet.2": "no", "who.1": 0, "who.2": 1, ticket: { legs: ["sheet.1", "sheet.2"], stake: 10 } },
      bo: { "sheet.1": "yes", "sheet.2": "yes", "who.1": 2, ticket: { legs: ["sheet.1", "sheet.2"], stake: 5 } },
    }),
    // Episode 2: ann no (a reward: wrong), yes (immunity: right, 1), Castaway 3 on the reward (right, 2): 3. bo yes on the reward
    // (right, 1): 1.
    ...say(2, { ann: { "sheet.1": "no", "sheet.2": "yes", "who.1": 3 }, bo: { "sheet.1": "yes" } }),
    // Episode 3, no results yet.
    ...say(3, { ann: { "sheet.1": "yes" } }),
  ];
  const g = A.grade(s, rows);
  assert.deepEqual(g.verdicts.get("sheet.1|1"), { state: "known", right: ["yes"] });
  assert.deepEqual(g.verdicts.get("who.2|1").right, [cid(s, 1)], "Episode 1's second line, an idol found");
  assert.deepEqual(g.verdicts.get("who.1|2").right, [cid(s, 3)], "Episode 2's first line, a reward");
  // Nobody answered it, but it stands all the same: Episode 2's second line, immunity.
  assert.deepEqual(G.verdictOf(A.questions(s)[3], 2, A.facts(s)).right, [cid(s, 2)]);
  assert.equal(g.verdicts.get("sheet.1|3").state, "waiting");
  assert.deepEqual(obj(g.earned.get("ticket|1")), { ann: -10, bo: 15 });
  assert.deepEqual(g.verdicts.get("ticket|1").tickets, { ann: { right: false, legs: 1 }, bo: { right: true, legs: 2 } });
  // The bank, the lines' points and the tickets: ann 100 + 5 - 10 + 3 = 98; bo 100 + 2 + 15 + 1 = 118; cy the bank alone.
  assert.deepEqual(obj(g.points), { ann: 98, bo: 118, cy: 100 });
  // The table ranks them so (a game of questions' points are the server's: the table reads them as lines).
  assert.equal(G.cardMoment(A.questions(s).find((q) => q.id === "sheet.1"), 2), "rewardWin");
});

test("the week's objectives from the card: only its moments that episode count (p12)", () => {
  const s = league(objectives({ each: 1, of: MOMENTS }), "pickem");
  for (let k = 1; k <= 4; k++) S.ensureEpisodeNumber(s, k, false);
  const ep = (n) => s.episodes.find((e) => e.number === n);
  const pick = (n, p, idx) => S.setPickEmPick(s, ep(n).id, p, cid(s, idx[0]), { picks: idx.map((i) => cid(s, i)) });
  const ev = (n, type, i) => S.ActiveRosterLogic.addEvent(s, ep(n).id, type, cid(s, i));
  const out = (n, i) => S.addElimination(s, ep(n).id, cid(s, i), "Voted Out");
  // Episode 1's card: won immunity. Castaway 0 immune and found an idol; Castaway 1 found an idol. ann (0, 1) 1; bo (0, 2) 1; cy
  // (3, 2) 0: ann and bo share the week.
  pick(1, "ann", [0, 1]); pick(1, "bo", [0, 2]); pick(1, "cy", [3, 2]);
  ev(1, "individualImmunity", 0); ev(1, "idolFound", 0); ev(1, "idolFound", 1);
  out(1, 9);
  // Episode 2's card: found an idol. Castaway 2 found one; Castaway 1 immune. ann (2, 3) 1; bo (1, 0) 0; cy (0, 1) 0: ann's week.
  pick(2, "ann", [2, 3]); pick(2, "bo", [1, 0]); pick(2, "cy", [0, 1]);
  ev(2, "idolFound", 2); ev(2, "individualImmunity", 1);
  out(2, 8);
  // Episode 3's card: won reward. Castaway 4 won it, Castaway 3 found an idol. ann (4) 1; bo (4) 1; cy (3) 0: ann and bo.
  pick(3, "ann", [4]); pick(3, "bo", [4]); pick(3, "cy", [3]);
  ev(3, "rewardWin", 4); ev(3, "idolFound", 3);
  out(3, 7);
  const rows = S.computeScores(s).map((r) => [r.playerId, r.total, r.weeks.won]);
  assert.deepEqual(rows, [["ann", 3, 3], ["bo", 2, 2], ["cy", 0, 0]]);
  assert.deepEqual(S.WeekLogic.run(s).weeks.map((w) => [w.number, w.winners]), [[1, ["ann", "bo"]], [2, ["ann"]], [3, ["ann", "bo"]]]);
  // A moment's points as the episode it's in reads them; with no episode, every moment the card's list names counts.
  assert.deepEqual([1, 2, 3].map((n) => S.ActiveRosterLogic.pointsFor(s, "idolFound", n)), [0, 1, 0]);
  assert.equal(S.ActiveRosterLogic.pointsFor(s, "idolFound"), 1);
});
