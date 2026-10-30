// Questions about who and about each (docs/PLAN-start-a-game-gpt.md step A6): a person or group answer settled by who a moment
// happened to (which tribe won immunity, who found an idol, who it happened to most), who stays, a secret role (who the Traitors
// are, how many make the end), and one question asked of each person still in, an answer for each (each couple's judges' score,
// a per-unit moment's units). Their shape and the data-can-settle rule; the grader on facts; and the engine's facts from a
// league: each person's group episode by episode (a swap counts from its own episode, and never before someone has seen it),
// each person's count of a moment, everyone's role. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const ats = (problems) => problems.map((p) => p.at);

/** A league as Start a game makes one, on Survivor, with `n` castaways and players ann, bo and cy. */
function league(type, n = 8, after) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < n; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  if (after) after(s);
  S.updateSettings(s, "setupComplete", true);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Who went home in episode n (castaway indexes), and what happened in it ([moment, castaway index, units?]). */
function results(s, n, outs, events = []) {
  const e = ep(s, n);
  for (const i of outs) S.addElimination(s, e.id, cid(s, i), "Voted Out");
  for (const [type, i, units] of events) S.addScoringEvent(s, e.id, type, cid(s, i), units);
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
const game = (ask, extra) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask, ...extra });

/** Survivor's rules as the data rule sees them (answers.ts questionContext): research's moments (tribe immunity, idols, a per-unit
 *  moment: each judges' point a unit) and the couch's, tribes, no secret roles. */
const CTX = {
  moments: [
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
    { id: "cried", label: "Cried at tribal", defaultPoints: 0, answeredBy: "league" },
    { id: "tribeImmunity", label: "Tribe won immunity", defaultPoints: 1, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "judgesPoint", label: "Each judges' point", defaultPoints: 0, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  calls: "results",
  roles: [],
  grouped: true,
};
const ROLES = { ...CTX, roles: ["Traitor", "Faithful"], grouped: false };
const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const TRIBE = { id: "tribe", ask: "Which tribe wins immunity?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "tribeImmunity", take: "who" } };
const FINDS = { id: "finds", ask: "Who finds an idol?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "idolFound", take: "who" } };
const SCORES = { id: "scores", ask: "Each couple's judges' score?", answer: "number", points: 1, asked: "each", each: "person", settle: { by: "moment", moment: "judgesPoint", take: "count" } };
const STAYS = { id: "stays", ask: "Who gets a rose?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "stays" } };
const TRAITORS = { id: "traitors", ask: "Who are the Traitors?", answer: "person", points: 2, pick: 3, settle: { by: "role", role: "Traitor", take: "who" } };

test("who a moment happened to, which group, who stays, a secret role and a question about each person: their shape and the data rule", () => {
  const at = (q, ctx, extra) => ats(G.specProblems(game([q], extra), ctx));
  for (const q of [TRIBE, FINDS, SCORES, STAYS, { ...FINDS, pick: 3, asked: "once" }, { ...FINDS, settle: { ...FINDS.settle, take: "most" } }]) assert.deepEqual(at(q, CTX), [], q.id);
  assert.equal(G.fullQuestion(TRIBE).pick, 1, "a group answer names one by default");
  assert.equal(G.fullQuestion(TRIBE).from, undefined, "only a person answer picks from someone");
  // Which group: by who a moment happened to, or who went home; never who it happened to most, never a show without groups.
  assert.deepEqual(at({ ...TRIBE, settle: { by: "results", take: "out" } }, CTX), []);
  assert.deepEqual(at({ ...TRIBE, settle: { ...TRIBE.settle, take: "most" } }, CTX), ["ask[0].settle"]);
  assert.deepEqual(at({ ...TRIBE, from: "cast" }, CTX), ["ask[0].from"]);
  assert.deepEqual(at(TRIBE, { ...CTX, grouped: false }), ["ask[0].answer"], "nobody's in a group");
  assert.deepEqual(at({ ...TRIBE, settle: { ...TRIBE.settle, moment: "cried" } }, CTX), ["ask[0].settle.moment"], "the couch's word still can't settle it");
  // Who stays: an episode's, a person named or a yes or no asked of each person.
  assert.deepEqual(at({ ...STAYS, asked: "once" }, CTX), ["ask[0].asked"]);
  assert.deepEqual(at({ ...STAYS, answer: "yesNo" }, CTX), ["ask[0].settle"], "a yes or no on who stays is asked of each person");
  assert.deepEqual(at({ ...STAYS, answer: "yesNo", each: "person" }, CTX), []);
  assert.deepEqual(at({ ...OUT, answer: "yesNo" }, CTX), ["ask[0].settle"], "will anyone go home tonight? is a moment's (Survivor's votedOut), not who did");
  assert.deepEqual(at(STAYS, { ...CTX, results: false }), ["ask[0].settle"], "a series' results don't say who stays");
  // A secret role: one of the show's.
  assert.deepEqual(at(TRAITORS, ROLES), []);
  assert.deepEqual(at({ ...TRAITORS, answer: "number", pick: undefined, settle: { ...TRAITORS.settle, take: "count" } }, ROLES), []);
  assert.deepEqual(at({ ...TRAITORS, settle: { ...TRAITORS.settle, role: "Mole" } }, ROLES), ["ask[0].settle.role"]);
  assert.deepEqual(at(TRAITORS, CTX), ["ask[0].settle.role"], "no secret roles on the show");
  assert.deepEqual(at({ ...TRAITORS, settle: { by: "role", take: "who" } }), ["ask[0].settle.role"], "which role");
  assert.deepEqual(at({ ...IDOL, settle: { ...IDOL.settle, role: "Traitor" } }), ["ask[0].settle.role"], "only a role settles by a role");
  assert.deepEqual(at({ ...TRAITORS, answer: "group", pick: 1 }, ROLES), ["ask[0].settle", "ask[0].answer"]);
  // About each person: a yes or no, a number, an over/under or a choice for each, settled by their own moment or their exit.
  assert.deepEqual(at({ ...SCORES, answer: "overUnder", line: 24.5 }, CTX), []);
  assert.deepEqual(at({ ...SCORES, answer: "choice", options: ["0-20", "21-25", "26+"] }, CTX), []);
  assert.deepEqual(at({ ...SCORES, answer: "choice", options: ["low", "high"] }, CTX), ["ask[0].options"]);
  assert.deepEqual(at({ ...SCORES, answer: "yesNo", settle: { by: "results", take: "out" } }, CTX), []);
  assert.deepEqual(at({ ...SCORES, answer: "person" }, CTX), ["ask[0].answer"]);
  assert.deepEqual(at({ ...SCORES, settle: { ...FINDS.settle } }, CTX), ["ask[0].settle"], "who it happened to isn't each one's own");
  assert.deepEqual(at({ ...SCORES, answer: "yesNo" }, CTX), ["ask[0].settle"], "a yes or no is whether it happened");
  assert.deepEqual(at({ ...SCORES, each: "group" }, CTX), ["ask[0].each"]);
  assert.deepEqual(at({ ...SCORES, asked: "once", closes: "finale" }, CTX), ["ask[0].closes", "ask[0].closes"]);
  // Every one a game of questions plays today, one of the 12 each.
  assert.equal(G.typeOf(game([TRIBE, FINDS, SCORES, STAYS])), "questions");
  assert.deepEqual(G.specWaitsFor(game([TRIBE, FINDS, SCORES, STAYS])), []);
});

test("grading who a moment happened to (and most), the groups they were on, who stays, and each person's own", () => {
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map(), winner: null, ended: false, order: null, names: new Map(), groupNames: new Map(), ...o });
  const q = (x) => G.fullQuestion(x);
  const grade = (qq, n, answers, ff) => Object.fromEntries(G.pointsFor(q(qq), G.verdictOf(q(qq), n, ff), answers, ff));
  const who = (m) => new Map(Object.entries(m).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const groups = (m) => new Map(Object.entries(m));
  // Episode 1: Kele (a, b) won immunity, c found an idol, d went home. Episode 2: a has been swapped onto Hina, which wins with c.
  const e1 = { out: ["d"], events: new Map([["tribeImmunity", 2], ["idolFound", 1], ["judgesPoint", 45]]), who: who({ tribeImmunity: { a: 1, b: 1 }, idolFound: { c: 1 }, judgesPoint: { a: 24, b: 21 } }), in: ["a", "b", "c", "d"], groups: groups({ a: "kele", b: "kele", c: "hina", d: "hina" }), roles: new Map() };
  const e2 = { out: [], events: new Map([["tribeImmunity", 2], ["idolFound", 2]]), who: who({ tribeImmunity: { a: 1, c: 1 }, idolFound: { b: 1, c: 1 } }), in: ["a", "b", "c"], groups: groups({ a: "hina", b: "kele", c: "hina" }), roles: new Map() };
  const e3 = { out: null, events: null, who: null, in: ["a", "b", "c"], groups: groups({}), roles: null };
  const f = facts({ episodes: new Map([[1, e1], [2, e2], [3, e3]]), names: new Map([["a", "Ana"], ["b", "Ben"], ["c", "Cy"]]), groupNames: new Map([["kele", "Kele"], ["hina", "Hina"]]) });
  // Which tribe: the group of whoever it happened to, as they stood that episode (a swap counts from its own).
  assert.deepEqual(G.verdictOf(q(TRIBE), 1, f), { state: "known", right: ["a", "b"], groups: ["kele"] });
  assert.deepEqual(grade(TRIBE, 1, [{ playerId: "ann", answer: "kele" }, { playerId: "bo", answer: "hina" }], f), { ann: 1 });
  assert.deepEqual(grade(TRIBE, 2, [{ playerId: "ann", answer: "kele" }, { playerId: "bo", answer: "hina" }], f), { bo: 1 });
  assert.deepEqual(G.verdictOf(q(TRIBE), 3, f), { state: "waiting" });
  assert.deepEqual(grade({ ...TRIBE, answer: "choice", options: ["Kele", "Hina"] }, 2, [{ playerId: "ann", answer: "Hina" }], f), { ann: 1 }, "a choice of names matches a group's");
  assert.deepEqual(grade({ ...TRIBE, settle: { by: "results", take: "out" } }, 1, [{ playerId: "ann", answer: "hina" }], f), { ann: 1 }, "which tribe lost someone");
  // Nobody it happened to on a group (after the tribes split up): off, never a question nobody can get right.
  const solo = facts({ episodes: new Map([[1, { ...e1, groups: groups({}) }]]) });
  assert.deepEqual(G.verdictOf(q(TRIBE), 1, solo), { state: "off", why: "Nobody it happened to was on a group" });
  assert.deepEqual(G.verdictOf(q(FINDS), 1, solo), { state: "known", right: ["c"] }, "a person answer doesn't need one");
  // Who found one: each one named right scores; nobody did is off.
  assert.deepEqual(grade({ ...FINDS, pick: 2 }, 2, [{ playerId: "ann", answer: ["b", "c"] }, { playerId: "bo", answer: ["a", "c"] }], f), { ann: 4, bo: 2 });
  assert.deepEqual(G.verdictOf(q({ ...FINDS, settle: { ...FINDS.settle, moment: "medevac" } }), 1, f), { state: "off", why: "It didn't happen" });
  // Who it happened to most (ties all), and asked once, over the game: known once it's over.
  const MOST = { ...FINDS, settle: { ...FINDS.settle, take: "most" } };
  assert.deepEqual(G.verdictOf(q({ ...MOST, settle: { ...MOST.settle, moment: "judgesPoint" } }), 1, f), { state: "known", right: ["a"], value: 24 });
  const twice = facts({ ...f, from: 1, to: 2, over: true, episodes: new Map([[1, e1], [2, e2]]) });
  assert.deepEqual(G.verdictOf(q({ ...MOST, asked: "once" }), 0, twice), { state: "known", right: ["c"], value: 2 });
  assert.deepEqual(G.verdictOf(q({ ...MOST, asked: "once" }), 0, f), { state: "waiting" }, "not until the game is over");
  assert.deepEqual(grade({ ...MOST, answer: "choice", pick: undefined, options: ["Ana", "Ben"], settle: { ...MOST.settle, moment: "judgesPoint" } }, 1, [{ playerId: "ann", answer: "Ana" }], f), { ann: 2 }, "a choice of names, never a count's range");
  assert.deepEqual(G.verdictOf(q({ ...FINDS, asked: "once" }), 0, twice), { state: "known", right: ["c", "b"], groups: ["hina", "kele"] });
  assert.deepEqual(G.verdictOf(q({ ...TRIBE, asked: "once" }), 0, twice).groups, ["kele", "hina"]);
  // Who stays: everyone in at its start who didn't go home.
  assert.deepEqual(G.verdictOf(q(STAYS), 1, f), { state: "known", right: ["a", "b", "c"] });
  assert.deepEqual(grade(STAYS, 1, [{ playerId: "ann", answer: "d" }, { playerId: "bo", answer: "c" }], f), { bo: 1 });
  // Each person: the closest on each one scores (ties all), only for who was in at its start.
  const e = (ans) => ans.map(([playerId, answer]) => ({ playerId, answer }));
  assert.deepEqual(grade(SCORES, 1, e([["ann", { a: 24, b: 30 }], ["bo", { a: 20, b: 22 }], ["cy", { b: 22, z: 9 }]]), f), { ann: 1, bo: 1, cy: 1 });
  const v1 = G.verdictOf(q(SCORES), 1, f);
  assert.deepEqual(Object.keys(v1.each), ["a", "b", "c", "d"], "each one in at its start");
  assert.deepEqual(v1.each.c, { state: "known", right: [], value: 0 });
  assert.deepEqual(G.verdictOf(q(SCORES), 3, f), { state: "waiting" });
  // ...their yes or no on going home, and an over/under for each.
  const GOES = { ...SCORES, id: "goes", answer: "yesNo", settle: { by: "results", take: "out" } };
  assert.deepEqual(grade(GOES, 1, e([["ann", { d: "yes", a: "no" }], ["bo", { d: "no" }]]), f), { ann: 2 });
  assert.equal(G.isRight(q(GOES), G.verdictOf(q(GOES), 1, f), { playerId: "bo", answer: { d: "no" } }, e([["bo", { d: "no" }]]), f), false);
  assert.equal(G.isRight(q(GOES), G.verdictOf(q(GOES), 1, f), { playerId: "ann", answer: { d: "yes" } }, e([["ann", { d: "yes" }]]), f), true);
  const OVER = { ...SCORES, id: "over", answer: "overUnder", line: 22.5 };
  assert.deepEqual(grade(OVER, 1, e([["ann", { a: "over", b: "over" }], ["bo", { b: "under" }]]), f), { ann: 1, bo: 1 });
  // ...and asked once, over the game: whether it ever happened to them, once it's over.
  const EVER = { ...SCORES, id: "ever", answer: "yesNo", asked: "once", settle: { by: "moment", moment: "idolFound", take: "happened" } };
  assert.deepEqual(Object.fromEntries(Object.entries(G.verdictOf(q(EVER), 0, twice).each).map(([k, v]) => [k, v.right[0]])), { a: "no", b: "yes", c: "yes", d: "no" });
  assert.deepEqual(G.verdictOf(q(EVER), 0, f), { state: "waiting" });
  // What an answer has to be: a group someone still in is on; for each person, { who: answer } for those still in.
  assert.equal(G.answerProblem(q(TRIBE), "kele", new Set(["kele", "hina"])), null);
  assert.equal(G.answerProblem(q(TRIBE), "uli", new Set(["kele", "hina"])), "Name a group someone still in is on");
  assert.equal(G.answerProblem(q(TRIBE), ["kele", "hina"], null), "Name one");
  assert.equal(G.answerProblem(q(SCORES), { a: 24 }, new Set(["a", "b"])), null);
  assert.equal(G.answerProblem(q(SCORES), { d: 24 }, new Set(["a", "b"])), "Answer only for who is still in");
  assert.equal(G.answerProblem(q(SCORES), { a: -1 }, null), "A number, 0 or more");
  assert.equal(G.answerProblem(q(SCORES), {}, null), "Answer for someone");
  assert.equal(G.answerProblem(q(SCORES), 24, null), "An answer for each person: { who: answer }");
});

test("a game's facts from its league: groups after a swap and each person's count, as each viewer has seen them", () => {
  const s = league("pickem", 8, (st) => {
    const kele = S.addTribe(st, "Kele", "#c00");
    const hina = S.addTribe(st, "Hina", "#00c");
    st.castaways.forEach((c, i) => { c.tribeId = i < 4 ? kele.id : hina.id; });
  });
  const [kele, hina] = s.tribes.map((t) => t.id);
  assert.deepEqual(ats(S.setGame(s, game([TRIBE, FINDS, SCORES]))), ["ask"], "never without the show's ctx");
  assert.deepEqual(S.setGame(s, game([TRIBE, FINDS, SCORES]), { ctx: CTX }), []);
  const e1 = results(s, 1, [7], [["tribeImmunity", 0], ["tribeImmunity", 1], ["idolFound", 4]]);
  // A per-unit moment, as a rulebook with one records it (Dancing with the Stars' judges' points: research's score as its units).
  // Survivor's own format has none, so it's written as the results would.
  e1.scoringEvents.push({ id: "sev_j0", type: "judgesPoint", castawayId: cid(s, 0), units: 24 }, { id: "sev_j1", type: "judgesPoint", castawayId: cid(s, 1), units: 21 });
  results(s, 2, [6], [["tribeImmunity", 4], ["tribeImmunity", 5]]);
  // Episode 3 swaps castaway 0 onto Hina, which then wins with them.
  assert.ok(S.addGroupChange(s, ep(s, 3).id, cid(s, 0), "Hina"));
  results(s, 3, [5], [["tribeImmunity", 0], ["tribeImmunity", 4]]);
  const f = S.AnswerLogic.facts(s);
  assert.deepEqual([1, 2, 3].map((n) => f.episodes.get(n).groups.get(cid(s, 0))), [kele, kele, hina], "on Kele until the swap's episode");
  assert.deepEqual(f.episodes.get(1).who.get("judgesPoint"), new Map([[cid(s, 0), 24], [cid(s, 1), 21]]), "a per-unit moment's units, each person's");
  assert.equal(f.episodes.get(3).in.length, 6, "who was in at its start");
  assert.equal(f.groupNames.get(hina), "Hina");
  const answers = [
    { playerId: "ann", question: "tribe", episode: 1, answer: kele },
    { playerId: "bo", question: "tribe", episode: 1, answer: hina },
    { playerId: "ann", question: "tribe", episode: 3, answer: kele },
    { playerId: "bo", question: "tribe", episode: 3, answer: hina },
    { playerId: "cy", question: "finds", episode: 1, answer: cid(s, 4) },
    { playerId: "ann", question: "scores", episode: 1, answer: { [cid(s, 0)]: 24, [cid(s, 1)]: 25 } },
    { playerId: "bo", question: "scores", episode: 1, answer: { [cid(s, 1)]: 21 } },
  ];
  // ann: Kele in Episode 1, castaway 0's 24 exactly; bo: Hina after the swap, castaway 1's 21 (closer than ann's 25); cy: the idol.
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(s, answers).points), { ann: 2, bo: 2, cy: 2 });
  // Someone who's seen only Episode 2 knows nothing of the swap: castaway 0 is still on Kele, and Episode 3 isn't graded.
  const view = S.GhostLogic.viewFor(s, "ann", 2);
  assert.equal(S.AnswerLogic.facts(view).episodes.has(3), false);
  assert.equal(view.castaways[0].tribeId, kele);
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(view, answers).points), { ann: 2, bo: 1, cy: 2 });
  // How it works says each one.
  assert.deepEqual(G.describeSpec(S.gameOf(s)).rules.slice(1, 4), [
    "Before each episode: Which tribe wins immunity? 1 point if you're right.",
    "Before each episode: Who finds an idol? 2 points if you're right.",
    "Before each episode: Each couple's judges' score? Answer for each person still in: the closest on each wins 1 point.",
  ]);
});

test("a secret role from its league (The Traitors): who held it in the game, who's left at the end, and how many", () => {
  const t = S.defaultState();
  S.ensureNextEpisode(t);
  S.updateSettings(t, "showId", "traitors");
  S.updateSettings(t, "showFormat", "traitors");
  for (let i = 0; i < 6; i++) S.addCastaway(t, `Player ${i}`);
  t.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(t, "setupComplete", true);
  const end = { id: "end", ask: "How many Traitors make the end?", answer: "number", points: 3, settle: { by: "role", role: "Traitor", take: "count" } };
  const left = { id: "left", ask: "Which Traitor is still in after tonight?", answer: "person", points: 1, asked: "each", settle: { by: "role", role: "Traitor", take: "end" } };
  assert.deepEqual(ats(S.setGame(t, game([TRAITORS, end, left], { span: { from: 1, to: 3 } }), { ctx: CTX })), ["ask[0].settle.role", "ask[1].settle.role", "ask[2].settle.role"]);
  assert.deepEqual(S.setGame(t, game([TRAITORS, end, left], { span: { from: 1, to: 3 } }), { ctx: ROLES }), []);
  const tc = (i) => t.castaways[i].id;
  const te = (n) => S.ensureEpisodeNumber(t, n, false);
  [0, 1].forEach((i) => S.addRole(t, te(1).id, tc(i), "Traitor"));
  S.addElimination(t, te(1).id, tc(5), "Murdered");
  S.addElimination(t, te(2).id, tc(0), "Banished");
  S.addRole(t, te(3).id, tc(2), "Recruited Traitor");
  S.addElimination(t, te(3).id, tc(4), "Murdered");
  const f = S.AnswerLogic.facts(t);
  const [qWho, qEnd, qLeft] = S.gameOf(t).ask;
  assert.equal(f.over, true);
  assert.deepEqual(G.verdictOf(qWho, 0, f), { state: "known", right: [tc(0), tc(1), tc(2)] }, "a recruit counts");
  assert.deepEqual(G.verdictOf(qEnd, 0, f), { state: "known", right: [], value: 2 }, "in at the last episode: 1 and the recruit");
  assert.deepEqual(G.verdictOf(qLeft, 2, f), { state: "known", right: [tc(1)] }, "0 was banished that night");
  const answers = [
    { playerId: "ann", question: "traitors", episode: 0, answer: [tc(0), tc(1), tc(3)] },
    { playerId: "bo", question: "end", episode: 0, answer: 2 },
    { playerId: "ann", question: "end", episode: 0, answer: 1 },
    { playerId: "bo", question: "left", episode: 2, answer: tc(1) },
    { playerId: "ann", question: "left", episode: 2, answer: tc(0) },
  ];
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(t, answers).points), { ann: 4, bo: 4 });
  // Someone who's seen only Episode 1: nothing over the game is known yet, and Episode 2 isn't graded.
  const view = S.GhostLogic.viewFor(t, "ann", 1);
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(view, answers).points), {});
});
