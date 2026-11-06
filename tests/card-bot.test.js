// A card the bot chooses (docs/PLAN-start-a-game-gpt.md track C, C7 part 2): `card: { from: 'bot', each, of, fallback }`, each
// episode's lines the first `each` of the card's list as the bot ranked the season's moments before it (game-spec schema.js
// rankedLines), read from the league's episode stamp (`episode.cardChoice`: db/card-research.js stampChoices, src/lib/server/
// card-choices.ts), its fallback once the card came out without one (the list in turn, or the week void), its lines waiting while
// it isn't out. Its shape, settings both ways and words; grading on a made-up season worked out by hand; the bot's prompt and the
// check of its answer; the stamp; and when bot research's card run is due (db/bot-research.js cardNext). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const CardResearch = require("../db/card-research.js");
const BotResearch = require("../db/bot-research.js");

const A = S.AnswerLogic;
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "rewardWin", label: "Won reward", defaultPoints: 1, answeredBy: "research" },
  ],
  results: true, winner: true, roles: [], grouped: true, jury: true, phases: [],
};
const MOMENTS = ["individualImmunity", "idolFound", "rewardWin"];
const BOT = { from: "bot", each: 2, of: MOMENTS };
const SHEET = { id: "sheet", ask: "This week's sheet", answer: "yesNo", points: 1, asked: "each", card: true, settle: { by: "moment", take: "happened" } };
const questions = (ask, card = BOT) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask, card });
const objectives = (card) => ({ get: { by: "pick", each: 2 }, count: { pick: true }, score: { by: "moments", points: null, only: "card", hits: "pick" }, rank: { by: "weeks" }, card });
const problems = (s) => G.specProblems(s, CTX).map((p) => `${p.at}: ${p.problem}`);
const WORDS = { show: "Survivor 51", castaway: "castaway", moments: CTX.moments };
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** A game on Survivor with ten castaways and three players, made `spec` through setGame. */
function league(spec, type) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  for (let i = 0; i < 10; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  return s;
}
const cid = (s, i) => s.castaways[i].id;

test("the bot's lines: its ranking first, then the list in turn, what can't happen last; its fallback; waiting", () => {
  // Episode 3 of a card of two from five: the draw in turn starts at the list's fifth ((3 - 1) * 2 % 5 = 4).
  const of = ["a", "b", "c", "d", "e"];
  assert.deepEqual(G.rankedLines(of, 2, 3, { moments: ["d", "b"], cannot: [] }), ["d", "b"]);
  // Three a card: Episode 3's draw starts at the list's second ((3 - 1) * 3 % 5 = 1).
  assert.deepEqual(G.rankedLines(of, 3, 3, { moments: ["d"], cannot: [] }), ["d", "b", "c"], "then the list from Episode 3's place (b, c, e, a), less d");
  assert.deepEqual(G.rankedLines(of, 3, 3, { moments: ["d"], cannot: ["b"] }), ["d", "c", "e"], "what can't happen after the rest");
  assert.deepEqual(G.rankedLines(of, 5, 1, { moments: ["c"], cannot: ["a"] }), ["c", "b", "d", "e", "a"], "every line: what can't happen last");
  assert.deepEqual(G.rankedLines(of, 2, 1, { moments: ["x", "c", "c"], cannot: ["c"] }), ["a", "b"], "not the card's, twice, and said can't: none of it ranks");
  assert.deepEqual(G.rankedLines(["a"], 3, 1, { moments: ["a"] }), ["a"], "never more than the list has");
  // cardLines: the stamp, the fallback (the list in turn, or void) and nothing stamped (not out: null).
  const card = G.cardOf(G.fullSpec(questions([SHEET])));
  assert.deepEqual(card, { from: "bot", each: 2, of: MOMENTS, fallback: "spec" });
  assert.deepEqual(G.cardLines(card, 2, { moments: ["rewardWin"], cannot: [] }), ["rewardWin", "individualImmunity"]);
  assert.deepEqual(G.cardLines(card, 2, G.CARD_FALLBACK), ["rewardWin", "individualImmunity"], "Episode 2 in turn");
  assert.deepEqual(G.cardLines({ ...card, fallback: "void" }, 2, G.CARD_FALLBACK), []);
  assert.equal(G.cardLines(card, 2, undefined), null);
  assert.deepEqual(G.cardLines(G.cardOf(G.fullSpec(questions([SHEET], { each: 2, of: MOMENTS }))), 2, undefined), ["rewardWin", "individualImmunity"], "a card from the moments reads no stamp");
  // A line knows its card is the bot's; its moment, and whether it waits.
  const line = G.askOf(G.fullSpec(questions([SHEET])))[1];
  assert.deepEqual(line.card, { of: MOMENTS, each: 2, line: 1, from: "sheet", by: "bot", fallback: "spec" });
  assert.equal(G.cardMoment(line, 1, { moments: ["idolFound", "rewardWin"] }), "rewardWin");
  assert.equal(G.cardMoment(line, 1, undefined), null);
  assert.deepEqual([G.cardWaiting(line, 1, undefined), G.cardWaiting(line, 1, G.CARD_FALLBACK)], [true, false]);
  assert.equal(G.cardWaiting(G.askOf(G.fullSpec(questions([SHEET], { each: 2, of: MOMENTS })))[0], 1, undefined), false);
});

test("its shape, settings both ways and words", () => {
  assert.deepEqual(problems(questions([SHEET])), []);
  assert.deepEqual(problems(questions([SHEET], { ...BOT, fallback: "void" })), []);
  assert.deepEqual(problems(objectives({ ...BOT, each: 1 })), []);
  assert.deepEqual(problems(questions([SHEET], { ...BOT, from: "maker" })), ["card.from: A card is drawn from the show's moments in turn (from 'moments'), or chosen from them by the bot before each episode (from 'bot')"]);
  assert.deepEqual(problems(questions([SHEET], { ...BOT, fallback: "skip" })), ["card.fallback: When the bot hasn't chosen in time, the card is the list's next lines in turn ('spec') or that episode's card is void ('void')"]);
  assert.deepEqual(problems(questions([SHEET], { each: 2, of: MOMENTS, fallback: "void" })), ["card.fallback: Only a card the bot chooses falls back: leave fallback out"]);
  // The data-can-settle rule holds for the bot's list as for any card's.
  assert.deepEqual(problems(questions([SHEET], { ...BOT, of: ["idolFound", "nope"] })), ["card.of[1]: \"nope\" isn't one of the show's moments"]);
  // fullSpec says the fallback; the settings carry it both ways.
  const spec = G.fullSpec(questions([SHEET], { ...BOT, fallback: "void" }));
  assert.deepEqual(spec.card, { ...BOT, fallback: "void" });
  const st = G.settingsOf(spec);
  assert.deepEqual(st.gameCard, { ...BOT, fallback: "void" });
  assert.deepEqual(G.specOf(st).card, spec.card);
  assert.deepEqual(G.fullSpec(questions([SHEET])).card.fallback, "spec");
  // The words (through impeccable's clarify).
  const d = (s) => G.describeSpec(G.fullSpec(s), WORDS);
  const spec1 = d(questions([SHEET]));
  assert.match(spec1.sentence, /Each episode's card is two of won immunity, found an idol and won reward, picked by the AI from what's in play that episode\. It's out by 12 hours before the episode airs\. If the AI hasn't picked by then, it's the next two in turn\./);
  const void1 = d(questions([SHEET], { ...BOT, fallback: "void" }));
  assert.ok(void1.rules.includes("Each episode's card is two of won immunity, found an idol and won reward, picked by the AI from what's in play that episode. It's out by 12 hours before the episode airs. If the AI hasn't picked by then, that episode has no card: nothing scores for it either way."), void1.rules.join("\n"));
  assert.match(d(objectives({ ...BOT, each: 1 })).sentence, /Only the moments on each episode's card count\. Each episode's card is one of won immunity, found an idol and won reward, picked by the AI/);
});

test("graded: the bot's choice where it's stamped, the fallback where the card came out without one, waiting where it isn't out", () => {
  const s = league(questions([SHEET]), "questions");
  // Episode 1, stamped: won reward, found an idol. Castaway 3 won reward; nobody found an idol.
  const e1 = S.ensureEpisodeNumber(s, 1, false);
  e1.cardChoice = { moments: ["rewardWin", "idolFound"], cannot: [] };
  S.addElimination(s, e1.id, cid(s, 9), "Voted Out");
  S.addScoringEvent(s, e1.id, "rewardWin", cid(s, 3));
  // Episode 2, nothing stamped but results in: its fallback, the list in turn (won reward, won immunity). Castaway 2 immune.
  const e2 = S.ensureEpisodeNumber(s, 2, false);
  S.addElimination(s, e2.id, cid(s, 8), "Voted Out");
  S.addScoringEvent(s, e2.id, "individualImmunity", cid(s, 2));
  // Episode 3, stamped (found an idol; won reward can't happen), no results yet; Episode 4, nothing: not out.
  const e3 = S.ensureEpisodeNumber(s, 3, false);
  e3.cardChoice = { moments: ["idolFound"], cannot: ["rewardWin"] };
  S.ensureEpisodeNumber(s, 4, false);
  const rows = [
    // Episode 1: ann yes to the reward (right) and no to an idol (right): 2. bo yes, yes: 1.
    { playerId: "ann", question: "sheet.1", episode: 1, answer: "yes" }, { playerId: "ann", question: "sheet.2", episode: 1, answer: "no" },
    { playerId: "bo", question: "sheet.1", episode: 1, answer: "yes" }, { playerId: "bo", question: "sheet.2", episode: 1, answer: "yes" },
    // Episode 2: ann no to the reward (right), yes to immunity (right): 2. cy yes to the reward (wrong): 0.
    { playerId: "ann", question: "sheet.1", episode: 2, answer: "no" }, { playerId: "ann", question: "sheet.2", episode: 2, answer: "yes" },
    { playerId: "cy", question: "sheet.1", episode: 2, answer: "yes" },
  ];
  const facts = A.facts(s);
  assert.deepEqual([...facts.cardChoices.keys()], [1, 2, 3]);
  assert.equal(facts.cardChoices.get(2), G.CARD_FALLBACK);
  const q = A.questions(s);
  assert.deepEqual([1, 2, 3, 4].map((n) => [G.cardMoment(q[0], n, facts.cardChoices.get(n)), G.cardMoment(q[1], n, facts.cardChoices.get(n))]),
    [["rewardWin", "idolFound"], ["rewardWin", "individualImmunity"], ["idolFound", "individualImmunity"], [null, null]]);
  const g = A.grade(s, rows);
  assert.deepEqual([g.verdicts.get("sheet.1|1"), g.verdicts.get("sheet.2|1")], [{ state: "known", right: ["yes"] }, { state: "known", right: ["no"] }]);
  assert.deepEqual([g.verdicts.get("sheet.1|2"), g.verdicts.get("sheet.2|2")], [{ state: "known", right: ["no"] }, { state: "known", right: ["yes"] }]);
  assert.equal(G.verdictOf(q[0], 4, facts).state, "waiting", "not out");
  assert.equal(G.verdictOf(q[0], 3, facts).state, "waiting", "out, its results not in");
  assert.deepEqual(Object.fromEntries(g.points), { ann: 4, bo: 1 });
  // The same game with the week void: Episode 2's lines are off, no points either way (ann 2, bo 1).
  const v = league(questions([SHEET], { ...BOT, fallback: "void" }), "questions");
  for (const n of [1, 2]) S.ensureEpisodeNumber(v, n, false);
  Object.assign(v.episodes.find((e) => e.number === 1), { cardChoice: { moments: ["rewardWin", "idolFound"], cannot: [] } });
  [1, 2].forEach((n, i) => S.addElimination(v, v.episodes.find((e) => e.number === n).id, cid(v, 9 - i), "Voted Out"));
  S.addScoringEvent(v, v.episodes.find((e) => e.number === 1).id, "rewardWin", cid(v, 3));
  const gv = A.grade(v, rows);
  assert.equal(gv.verdicts.get("sheet.1|2").state, "off");
  assert.deepEqual(Object.fromEntries(gv.points), { ann: 2, bo: 1 });
});

test("the week's objectives from the bot's card: its choice that episode counts, then the fallback", () => {
  const s = league(objectives({ ...BOT, each: 1 }), "pickem");
  for (let k = 1; k <= 3; k++) S.ensureEpisodeNumber(s, k, false);
  const ep = (n) => s.episodes.find((e) => e.number === n);
  // Episode 1 stamped: won reward (the list in turn would be won immunity). Episode 2 with results, nothing stamped: in turn, found
  // an idol. Episode 3: not out, so nothing counts yet.
  ep(1).cardChoice = { moments: ["rewardWin"], cannot: [] };
  // Picks hitting them: ann (3, 1) on Episode 1, where Castaway 3 won reward and Castaway 1 was immune: 1.
  S.setPickEmPick(s, ep(1).id, "ann", cid(s, 3), { picks: [cid(s, 3), cid(s, 1)] });
  S.ActiveRosterLogic.addEvent(s, ep(1).id, "rewardWin", cid(s, 3));
  S.ActiveRosterLogic.addEvent(s, ep(1).id, "individualImmunity", cid(s, 1));
  S.addElimination(s, ep(1).id, cid(s, 9), "Voted Out");
  S.addElimination(s, ep(2).id, cid(s, 8), "Voted Out");
  const at = (n) => MOMENTS.map((m) => S.ActiveRosterLogic.pointsFor(s, m, n));
  assert.deepEqual([at(1), at(2), at(3)], [[0, 0, 1], [0, 1, 0], [0, 0, 0]]);
  const ann = S.computeScores(s).find((r) => r.playerId === "ann");
  assert.equal(ann.total, 1);
});

test("the bot's prompt and the check of its answer", () => {
  const moments = CTX.moments.map((m) => ({ id: m.id, label: m.label }));
  const p = CardResearch.buildCardPrompt({ showName: "Survivor", season: 51, episode: 8, airAt: "Wed Nov 11, 8:00 PM ET", moments, term: "castaways" });
  assert.match(p, /^Search the web for Survivor season 51\. Episode 7 is the latest to air; episode 8 hasn't aired yet\. It airs Wed Nov 11, 8:00 PM ET\./);
  assert.ok(p.includes("- idolFound: Found an idol"));
  assert.ok(p.includes('{"episode": 8, "moments": ["id", "id"], "cannot": ["id"]'));
  const ids = moments.map((m) => m.id);
  const ok = CardResearch.parseCardAnswer('Here:\n```json\n{"episode": 8, "moments": ["idolFound", "nope", "idolFound", "rewardWin"], "cannot": ["individualImmunity"], "why": "An idol is in play."}\n```', 8, ids);
  assert.deepEqual(ok, { status: "live", moments: ["idolFound", "rewardWin"], cannot: ["individualImmunity"], unknown: ["nope"], why: "An idol is in play.", note: null });
  assert.deepEqual(CardResearch.parseCardAnswer('{"moments": ["idolFound"], "cannot": ["idolFound", "rewardWin"]}', 8, ids).moments, [], "said both ways: neither");
  assert.equal(CardResearch.parseCardAnswer('{"moments": ["idolFound"], "cannot": ["idolFound"]}', 8, ids).note, "It ranked none of the moments it was asked about");
  assert.equal(CardResearch.parseCardAnswer('{"episode": 7, "moments": ["idolFound"]}', 8, ids).note, "The answer was about episode 7, not 8");
  assert.equal(CardResearch.parseCardAnswer("I couldn't find anything.", 8, ids).status, "dropped");
  assert.equal(CardResearch.parseCardAnswer('{"moments": ["idolFound"]}', 8, ids).status, "live", "no episode said: the one asked about");
});

test("the stamp: each episode's first decided row; a fallback to file once its card is out without one", () => {
  const s = league(questions([SHEET]), "questions");
  for (let k = 1; k <= 3; k++) S.ensureEpisodeNumber(s, k, false);
  const T0 = Date.parse("2026-11-04T01:00:00Z");
  const airAtOf = (n) => (n <= 3 ? T0 + (n - 1) * 7 * DAY : null);
  const live = (episode, moments) => ({ episode, status: "live", moments, cannot: [] });
  // Episode 1: two live choices: the first stands. Episode 2: a fallback filed, then a choice: the fallback stands (the card was out).
  const rows = [live(1, ["idolFound"]), live(1, ["rewardWin"]), { episode: 2, status: "fallback", moments: [], cannot: [] }, live(2, ["rewardWin"])];
  const now = T0 + 7 * DAY - 3 * HOUR;
  assert.deepEqual(CardResearch.stampChoices(s, rows, airAtOf, now), { changed: true, mark: [] });
  const by = (n) => s.episodes.find((e) => e.number === n).cardChoice;
  assert.deepEqual([by(1), by(2), by(3)], [{ moments: ["idolFound"], cannot: [] }, { fallback: true }, undefined]);
  assert.deepEqual(CardResearch.stampChoices(s, rows, airAtOf, now), { changed: false, mark: [] }, "the same again: nothing changed");
  // An air date moved: a card decided stays as it was, whenever its episode now airs.
  CardResearch.stampChoices(s, rows, (n) => airAtOf(n) + 30 * DAY, now);
  assert.deepEqual([by(1), by(2)], [{ moments: ["idolFound"], cannot: [] }, { fallback: true }]);
  // Episode 3, nothing decided: not out 13 hours before it airs; out (a fallback to file) 11 hours before.
  const three = [live(1, ["idolFound"])];
  assert.deepEqual(CardResearch.stampChoices(s, three, airAtOf, T0 + 14 * DAY - 13 * HOUR).mark, [2]);
  assert.equal(by(3), undefined);
  assert.deepEqual(CardResearch.stampChoices(s, three, airAtOf, T0 + 14 * DAY - 11 * HOUR).mark, [2, 3]);
  assert.deepEqual(by(3), { fallback: true });
  // A game whose card isn't the bot's has its stamps taken off.
  const plain = league(questions([SHEET], { each: 2, of: MOMENTS }), "questions");
  S.ensureEpisodeNumber(plain, 1, false).cardChoice = { fallback: true };
  CardResearch.stampChoices(plain, rows, airAtOf, now);
  assert.equal(plain.episodes.find((e) => e.number === 1).cardChoice, undefined);
  // An episode whose air time isn't known: out at once, on its fallback (no run can be planned for it).
  const late = league(questions([SHEET]), "questions");
  S.ensureEpisodeNumber(late, 1, false);
  assert.deepEqual(CardResearch.stampChoices(late, [], () => null, now).mark, [1]);
  assert.deepEqual(late.episodes.find((e) => e.number === 1).cardChoice, { fallback: true });
  // Only the episodes the game plays: one made for Episode 2 on files nothing for Episode 1.
  const mid = league({ ...questions([SHEET]), span: { from: 2, to: null } }, "questions");
  for (const n of [1, 2]) S.ensureEpisodeNumber(mid, n, false);
  assert.deepEqual(CardResearch.stampChoices(mid, [], () => null, now).mark, [2]);
  assert.equal(mid.episodes.find((e) => e.number === 1).cardChoice, undefined);
});

test("when the card run is due: two days before the episode, no sooner than three hours after the one before ends, never once it's out", () => {
  const T0 = new Date("2026-11-05T01:00:00Z");
  const at = (d, h = 0) => new Date(T0.getTime() + d * DAY + h * HOUR);
  const weekly = [1, 2, 3].map((n) => ({ episode: n, at: at((n - 1) * 7) }));
  const plan = (o) => BotResearch.cardNext({ airTimes: weekly, episodeMinutes: 60, history: [], chosen: new Set(), now: at(3), ...o });
  // Episode 1's card is out already; Episode 2's run is due two days before it (day 5), Episode 3's on day 12.
  assert.deepEqual(plan().map((r) => [r.episode, r.at.toISOString(), r.next.toISOString()]), [[2, at(5).toISOString(), at(5).toISOString()], [3, at(12).toISOString(), at(12).toISOString()]]);
  assert.deepEqual(plan({ chosen: new Set([2]) }).map((r) => r.episode), [3], "a choice made already: not asked again");
  // Tries: three, 20 minutes apart; none left once three have failed.
  const fail = (h) => ({ episode_number: 2, slot: "card", started_at: at(5, h).toISOString(), ok: false });
  assert.equal(plan({ now: at(5, 1), history: [fail(0)] })[0].next.toISOString(), at(5, 1 / 3).toISOString());
  assert.deepEqual(plan({ now: at(5, 1), history: [fail(0), fail(0.4), fail(0.8)] }).map((r) => r.episode), [3]);
  // Nightly: Episode 2 airs a day after Episode 1, so its run is three hours after Episode 1 ends (an hour long), before its card is
  // out 12 hours before it airs; back to back with less room than that, two days before it (from what's known then).
  const nightly = [{ episode: 1, at: at(0) }, { episode: 2, at: at(1) }];
  assert.equal(BotResearch.cardNext({ airTimes: nightly, episodeMinutes: 60, history: [], chosen: new Set(), now: at(0, 2) })[0].at.toISOString(), at(0, 4).toISOString());
  const tight = [{ episode: 1, at: at(5) }, { episode: 2, at: at(5, 2) }];
  assert.deepEqual(BotResearch.cardNext({ airTimes: tight, episodeMinutes: 60, history: [], chosen: new Set(), now: at(0) }).map((r) => [r.episode, r.at.toISOString()]), [[1, at(3).toISOString()], [2, at(3, 2).toISOString()]]);
});
