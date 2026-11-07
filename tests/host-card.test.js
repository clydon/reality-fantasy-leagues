// A rotating host's questions (docs/PLAN-start-a-game-gpt.md step A14 part 6; the tracker's s43, "Each week a different one of us
// writes 3 questions."): a card a host chooses, `card: { from: 'host', each, of, fallback, closes, hostAnswers }`. Each episode one of
// the game's seats, in turn (HostLogic.hostAt: the league's order, the one after the episode before's host, skipping anyone who
// left), chooses the card's lines from its list of the show's moments; the server keeps them (host_cards: host-cards.ts) until the
// host's time is up, then files them (HostLogic.file) and stamps them on the episode (`episode.cardChoice`), and everyone answers
// them as the questions on the card (C7). Its shape, defaults, refusals, words and settings; the turn; what's filed; the lines (too
// few: the list in turn, or only the host's); the host's own answers; when the host's time is up. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const A = S.AnswerLogic;
const H = S.HostLogic;
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "rewardWin", label: "Won reward", defaultPoints: 1, answeredBy: "research" },
    { id: "cried", label: "Cried", defaultPoints: 0, answeredBy: "league" },
  ],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [],
};
const MOMENTS = ["individualImmunity", "idolFound", "rewardWin"];
const HOST = { from: "host", each: 2, of: MOMENTS };
const SHEET = { id: "sheet", ask: "This week's questions", answer: "yesNo", points: 1, asked: "each", card: true, settle: { by: "moment", take: "happened" } };
const questions = (card = HOST, ask = [SHEET]) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask, card });
const S43 = questions({ from: "host", each: 3, of: MOMENTS });
const at = (spec, ctx = CTX) => G.specProblems(spec, ctx).map((p) => p.at);
const WORDS = { show: "Survivor 51", castaway: "castaway", moments: CTX.moments };
const HOUR = 3600 * 1000;

/** A game on Survivor with ten castaways and three players (ann, bo, cy, in that order), made `spec` through setGame. */
function league(spec) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (const n of [1, 2, 3, 4, 5]) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;

test("the host's card: its shape, defaults, words and settings; what's refused", () => {
  for (const s of [questions(), S43, questions({ ...HOST, fallback: "void", closes: 24, hostAnswers: false })]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(G.cardOf(questions()), { from: "host", each: 2, of: MOMENTS, fallback: "spec", closes: 12, hostAnswers: true });
  assert.deepEqual(G.fullSpec(questions()).card, { from: "host", each: 2, of: MOMENTS, fallback: "spec", closes: 12, hostAnswers: true }, "the spec says its defaults");
  assert.equal(G.hostCard(G.cardOf(questions())), true);
  assert.equal(G.chosenCard(G.cardOf(questions())), true);
  assert.equal(G.botCard(G.cardOf(questions())), false);
  // Each line asked as a question on the card, knowing its card is the host's.
  assert.deepEqual(G.askOf(questions())[1].card, { of: MOMENTS, each: 2, line: 1, from: "sheet", by: "host", fallback: "spec", hostAnswers: true });
  // Words (through impeccable's clarify: "chooses", the card).
  const d = G.describeSpec(S43, WORDS);
  assert.ok(d.sentence.includes("Each episode, one of you hosts and chooses its card: three of won immunity, found an idol and won reward."), d.sentence);
  assert.ok(d.rules.includes("You take turns hosting, in the order you joined. Anyone who joins later goes last; anyone who leaves is skipped."));
  assert.ok(d.rules.includes("The host has until 12 hours before the episode airs to choose, and can change the card until then. Only the host sees it until then; then everyone does."));
  assert.ok(d.rules.includes("If the host chooses fewer than three in time, the rest come from the list, in turn."));
  assert.ok(d.rules.includes("The host answers the card too."));
  const v = G.describeSpec(questions({ ...HOST, fallback: "void", closes: 1, hostAnswers: false }), WORDS);
  assert.ok(v.rules.includes("The host has until 1 hour before the episode airs to choose, and can change the card until then. Only the host sees it until then; then everyone does."));
  assert.ok(v.rules.includes("If the host chooses fewer than two in time, only theirs count. If they choose none, nothing scores that episode."));
  assert.ok(v.rules.includes("The host sits out the card they chose."));
  // Refused, each with why.
  const c = (card) => at(questions(card));
  assert.deepEqual(c({ ...HOST, of: [...MOMENTS, "cried"] }), ["card.of[3]"], "the couch's word: data can't settle it");
  assert.deepEqual(c({ ...HOST, closes: 0 }), ["card.closes"], "the host needs a deadline before the episode, so everyone can answer");
  assert.deepEqual(c({ ...HOST, closes: 49 }), ["card.closes"]);
  assert.deepEqual(c({ ...HOST, closes: 1.5 }), ["card.closes"]);
  assert.deepEqual(c({ ...HOST, hostAnswers: "yes" }), ["card.hostAnswers"]);
  assert.deepEqual(c({ ...HOST, fallback: "skip" }), ["card.fallback"]);
  assert.deepEqual(c({ each: 2, of: MOMENTS, closes: 12 }), ["card.closes"], "only a host's card has a deadline");
  assert.deepEqual(c({ from: "bot", each: 2, of: MOMENTS, hostAnswers: true }), ["card.hostAnswers"]);
  assert.deepEqual(c({ ...HOST, from: "players" }), ["card.from"]);
  // The moments that count, chosen by a host: they'd choose by their own team.
  const objectives = { get: { by: "pick", each: 2 }, count: { pick: true }, score: { by: "moments", points: null, only: "card", hits: "pick" }, rank: { by: "weeks" }, card: HOST };
  assert.ok(at(objectives).includes("score.only"), JSON.stringify(at(objectives)));
  // In a stage: the turn is the whole game's.
  const staged = { stages: [{ id: "one", game: questions() }, { id: "two", game: questions({ each: 2, of: MOMENTS }), on: { phase: "merged" } }] };
  assert.ok(G.specProblems(staged).some((p) => p.at === "stages[0].game.card.from"), JSON.stringify(G.specProblems(staged)));
});

test("whose turn it is: the league's order, from the one after the episode before's host, skipping anyone who left", () => {
  const s = league(questions());
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => H.hostAt(s, n)), ["ann", "bo", "cy", "ann", "bo"]);
  assert.equal(H.hostAt(s, 9), null, "an episode the league doesn't have");
  // The turn after a seat: each seat once, that seat last.
  assert.deepEqual(H.turn(s, "bo"), ["cy", "ann", "bo"]);
  assert.deepEqual(H.turn(s, null), ["ann", "bo", "cy"]);
  // A filed episode's host is its stamp's: Episode 2 went to cy (someone corrected), so the turn goes on from cy.
  ep(s, 2).cardChoice = { fallback: true, host: "cy", how: "fallback" };
  assert.deepEqual([1, 2, 3, 4].map((n) => H.hostAt(s, n)), ["ann", "cy", "ann", "bo"]);
  delete ep(s, 2).cardChoice;
  // bo leaves: skipped. di joins: last in the turn.
  s.players.find((p) => p.id === "bo").active = false;
  s.players.push({ id: "di", name: "di", color: "#000" });
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => H.hostAt(s, n)), ["ann", "cy", "di", "ann", "cy"]);
  assert.deepEqual(H.turn(s, "bo"), ["cy", "di", "ann"], "after someone who left: on from where they were");
  // Someone taken out of the league altogether (no place in its order any more): the turn goes on from the host before them.
  const gone = league(questions());
  gone.players.push({ id: "di", name: "di", color: "#000" });
  ep(gone, 1).cardChoice = { fallback: true, host: "ann", how: "fallback" };
  ep(gone, 2).cardChoice = { fallback: true, host: "bo", how: "fallback" };
  ep(gone, 3).cardChoice = { fallback: true, host: "cy", how: "fallback" };
  gone.players = gone.players.filter((p) => p.id !== "cy");
  assert.deepEqual([4, 5].map((n) => H.hostAt(gone, n)), ["di", "ann"], "di, who came after cy, not ann again");
  assert.deepEqual(H.after(gone, 3), ["di", "ann", "bo"]);
  // A ghost (a late joiner playing a season of their own) never hosts.
  s.players.push({ id: "gh", name: "gh", color: "#000", ghost: true });
  assert.equal(S.SecretRoleLogic.seats(s).includes("gh"), false);
  // A game starting at Episode 3: its first host is the first seat.
  const later = league({ ...questions(), span: { from: 3, to: null } });
  assert.deepEqual([2, 3, 4].map((n) => H.hostAt(later, n)), [null, "ann", "bo"]);
  assert.deepEqual(H.episodes(later), [3, 4, 5]);
});

test("what's filed, and the card's lines: the host's, the rest the list in turn or none; the fallback", () => {
  const s = league(questions({ ...HOST, each: 3 }));
  // The host's lines stand, in their order.
  assert.deepEqual(H.file(s, 1, { playerId: "ann", moments: ["rewardWin", "idolFound", "individualImmunity"] }), { moments: ["rewardWin", "idolFound", "individualImmunity"], host: "ann", how: "host" });
  // Someone who doesn't host it, nothing chosen, or nothing on the list: the fallback (still its host's turn).
  assert.deepEqual(H.file(s, 1, { playerId: "bo", moments: ["rewardWin"] }), { fallback: true, host: "ann", how: "fallback" });
  assert.deepEqual(H.file(s, 1, null), { fallback: true, host: "ann", how: "fallback" });
  assert.deepEqual(H.file(s, 1, { playerId: "ann", moments: ["cried"] }), { fallback: true, host: "ann", how: "fallback" });
  // Too few, a moment twice: the host's first, the rest from the list in turn (fallback spec), or only the host's (void).
  const card = G.cardOf(questions({ ...HOST, each: 3 }));
  assert.deepEqual(G.cardLines(card, 2, { moments: ["rewardWin", "rewardWin"], host: "bo", how: "host" }), ["rewardWin", "individualImmunity", "idolFound"]);
  const voided = { ...card, fallback: "void" };
  assert.deepEqual(G.cardLines(voided, 2, { moments: ["rewardWin", "rewardWin"], host: "bo", how: "host" }), ["rewardWin"]);
  assert.deepEqual(G.cardLines(voided, 2, { fallback: true, host: "bo", how: "fallback" }), []);
  assert.deepEqual(G.cardLines(card, 2, { fallback: true, host: "bo", how: "fallback" }), G.drawInTurn(MOMENTS, 3, 2));
  assert.equal(G.cardLines(card, 2, undefined), null, "not out yet: its lines wait");
});

test("graded: the host's lines, the fallback, a line not chosen in time; the host's own answers, played or sat out", () => {
  const spec = (more) => questions({ ...HOST, ...more });
  const play = (s) => {
    // Episode 1, ann's card: won reward, found an idol. Castaway 3 won reward; nobody found an idol.
    ep(s, 1).cardChoice = { moments: ["rewardWin", "idolFound"], host: "ann", how: "host" };
    S.addElimination(s, ep(s, 1).id, cid(s, 9), "Voted Out");
    S.addScoringEvent(s, ep(s, 1).id, "rewardWin", cid(s, 3));
    // Episode 2, bo's card: only found an idol (too few). Castaway 2 found an idol, castaway 4 won immunity.
    ep(s, 2).cardChoice = { moments: ["idolFound"], host: "bo", how: "host" };
    S.addElimination(s, ep(s, 2).id, cid(s, 8), "Voted Out");
    S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 2));
    S.addScoringEvent(s, ep(s, 2).id, "individualImmunity", cid(s, 4));
    // Episode 3: cy's turn, out without a card (the fallback).
    ep(s, 3).cardChoice = { fallback: true, host: "cy", how: "fallback" };
  };
  const rows = [
    // Episode 1: ann (the host) yes, no: 2. bo yes, yes: 1.
    { playerId: "ann", question: "sheet.1", episode: 1, answer: "yes" }, { playerId: "ann", question: "sheet.2", episode: 1, answer: "no" },
    { playerId: "bo", question: "sheet.1", episode: 1, answer: "yes" }, { playerId: "bo", question: "sheet.2", episode: 1, answer: "yes" },
    // Episode 2: bo (the host) yes to an idol: 1. cy yes to an idol (right), yes to the second line (won reward, from the list: wrong): 1.
    { playerId: "bo", question: "sheet.1", episode: 2, answer: "yes" },
    { playerId: "cy", question: "sheet.1", episode: 2, answer: "yes" }, { playerId: "cy", question: "sheet.2", episode: 2, answer: "yes" },
  ];
  const s = league(spec());
  play(s);
  const q = A.questions(s);
  const f = A.facts(s);
  assert.deepEqual([1, 2, 3].map((n) => [G.cardMoment(q[0], n, f.cardChoices.get(n)), G.cardMoment(q[1], n, f.cardChoices.get(n))]),
    [["rewardWin", "idolFound"], ["idolFound", "rewardWin"], G.drawInTurn(MOMENTS, 2, 3)]);
  // Episode 2's second line, the list in turn from where its draw starts (rewardWin, individualImmunity, ...): won reward, nobody: no.
  const g = A.grade(s, rows);
  assert.deepEqual(g.verdicts.get("sheet.2|2"), { state: "known", right: ["no"] });
  assert.deepEqual(Object.fromEntries(g.points), { ann: 2, bo: 2, cy: 1 });
  // Void: a line the host didn't choose is off, no points either way.
  const v = league(spec({ fallback: "void" }));
  play(v);
  const gv = A.grade(v, rows);
  assert.equal(gv.verdicts.get("sheet.2|2").state, "off");
  assert.match(gv.verdicts.get("sheet.2|2").why, /The host didn't choose this one in time/);
  assert.deepEqual(Object.fromEntries(gv.points), { ann: 2, bo: 2, cy: 1 });
  // The host sits out their own card: ann's Episode 1 and bo's Episode 2 answers earn nothing.
  const sit = league(spec({ hostAnswers: false }));
  play(sit);
  assert.equal(H.sitsOut(sit, 1, "ann"), true);
  assert.equal(H.sitsOut(sit, 1, "bo"), false);
  assert.equal(H.sitsOut(s, 1, "ann"), false, "the host answers too, by default");
  assert.deepEqual(Object.fromEntries(A.grade(sit, rows).points), { bo: 1, cy: 1 });
});

test("when the host's time is up: hours before it airs, once it locks or has results", () => {
  const s = league(questions({ ...HOST, closes: 24 }));
  const air = Date.parse("2026-11-11T01:00:00Z");
  ep(s, 2).airsAt = new Date(air).toISOString();
  assert.equal(H.closesAt(s, 2), air - 24 * HOUR);
  assert.equal(H.closed(s, 2, air - 25 * HOUR), false);
  assert.equal(H.closed(s, 2, air - 24 * HOUR), true);
  assert.equal(H.closesAt(s, 3), null, "no air time");
  assert.equal(H.closed(s, 3, air), false, "...open while its host hasn't chosen a whole card");
  assert.equal(H.closed(s, 3, air, { playerId: "cy", moments: ["idolFound"] }), false, "...one line of two");
  assert.equal(H.closed(s, 3, air, { playerId: "ann", moments: ["idolFound", "rewardWin"] }), false, "...someone else's");
  assert.equal(H.closed(s, 3, air, { playerId: "cy", moments: ["idolFound", "rewardWin"] }), true, "...out once its host has chosen it all");
  ep(s, 3).lineupsLocked = true;
  assert.equal(H.closed(s, 3, air), true);
  S.addElimination(s, ep(s, 4).id, cid(s, 9), "Voted Out");
  assert.equal(H.closed(s, 4, 0), true, "results in");
  assert.equal(H.of(league(questions({ each: 2, of: MOMENTS }))), null, "a card drawn in turn has no host");
});
