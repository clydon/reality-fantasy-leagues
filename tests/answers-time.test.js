// Time (docs/PLAN-start-a-game-gpt.md step A7): questions asked over windows (every N episodes, over the next N, once a phase),
// which episode something happens in (a phase's start, a moment's first), whether a phase starts in a window, and a late lock
// for someone who watches later. Their shape and the data rule; the grader on facts; the engine's windows (where each opens,
// which an answer is for, the phase windows recorded from the season's starts, never moving once opened), its facts (a phase
// start only once the viewer has seen it), and the late lock. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const ats = (problems) => problems.map((p) => p.at);
const HOUR = 3600 * 1000;

/** A league as Start a game makes one, on Survivor, with `n` castaways and players ann, bo and cy. */
function league(type, n = 8) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  S.updateSettings(s, "wikiSeason", 51);
  for (let i = 0; i < n; i++) S.addCastaway(s, `Castaway ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => S.ensureEpisodeNumber(s, n, false);
/** Who went home in episode n (castaway indexes), and what happened in it ([moment, castaway index]). */
function results(s, n, outs, events = []) {
  const e = ep(s, n);
  for (const i of outs) S.addElimination(s, e.id, cid(s, i), "Voted Out");
  for (const [type, i] of events) S.addScoringEvent(s, e.id, type, cid(s, i));
  if (!outs.length && !events.length) S.EpisodeLogic.setNoExit(s, e.id, true);
  return e;
}
const game = (ask, extra) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask, ...extra });

/** Survivor's rules as the data rule sees them: research's moments, two phases (Tribes, then Merged). */
const CTX = {
  moments: [
    { id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  calls: "results",
  roles: [],
  grouped: true,
  phases: [{ id: "tribes", name: "Tribes" }, { id: "merged", name: "Merged" }],
};
const GONE = { id: "gone", ask: "Who'll be gone in the next two?", answer: "person", points: 2, asked: "every", every: 2, settle: { by: "results", take: "out" } };
const WITHIN = { id: "within", ask: "An idol played in the next three?", answer: "yesNo", points: 1, asked: "each", over: 3, settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const MERGE = { id: "merge", ask: "Which episode is the merge?", answer: "number", points: 3, settle: { by: "phase", phase: "merged", take: "starts" } };
const SOON = { id: "soon", ask: "The merge in the next two?", answer: "yesNo", points: 1, asked: "each", over: 2, settle: { by: "phase", phase: "merged", take: "happened" } };
const PHASE = { id: "phase", ask: "Who finds an idol this phase?", answer: "person", points: 1, pick: 2, asked: "phase", settle: { by: "moment", moment: "idolFound", take: "who" } };
const FIRST = { id: "first", ask: "Who wins immunity first?", answer: "person", points: 2, settle: { by: "moment", moment: "individualImmunity", take: "first" } };

test("windows, which episode, a phase and a late lock: their shape and the data rule", () => {
  const at = (q, ctx, extra) => ats(G.specProblems(game([q], extra), ctx));
  for (const q of [GONE, WITHIN, MERGE, SOON, PHASE, FIRST, { ...FIRST, answer: "number" }]) assert.deepEqual(at(q, CTX), [], q.id);
  assert.deepEqual(at({ ...GONE, every: 1 }, CTX), ["ask[0].every"]);
  assert.deepEqual(at({ ...GONE, every: 11 }, CTX), ["ask[0].every"]);
  assert.deepEqual(at({ ...GONE, asked: "each" }, CTX), ["ask[0].every"], "every only asked every few episodes");
  assert.deepEqual(at({ ...WITHIN, asked: "once" }, CTX), ["ask[0].over"], "over only asked each episode");
  assert.deepEqual(at({ ...WITHIN, over: 1 }, CTX), ["ask[0].over"]);
  assert.deepEqual(at({ ...MERGE, asked: "each" }, CTX), ["ask[0].asked"], "which episode a phase starts in is the game's");
  assert.deepEqual(at({ ...MERGE, settle: { ...MERGE.settle, phase: "tribes" } }, CTX), ["ask[0].settle.phase"], "the first phase starts with Episode 1");
  assert.deepEqual(at({ ...MERGE, settle: { ...MERGE.settle, phase: "jury" } }, CTX), ["ask[0].settle.phase"]);
  assert.deepEqual(at({ ...MERGE, settle: { by: "phase", take: "starts" } }), ["ask[0].settle.phase"], "which phase");
  assert.deepEqual(at({ ...WITHIN, settle: { ...WITHIN.settle, phase: "merged" } }), ["ask[0].settle.phase"], "only a phase settles by a phase");
  assert.deepEqual(at(PHASE, { ...CTX, phases: [{ id: "season" }] }), ["ask[0].asked"], "a season of one phase has nothing to ask by phase");
  assert.deepEqual(at({ ...GONE, asked: "every", settle: { by: "results", take: "winner" } }, CTX), ["ask[0].asked"], "who wins is asked once");
  assert.deepEqual(at({ id: "rose", ask: "Who stays?", answer: "person", points: 1, asked: "each", over: 2, settle: { by: "results", take: "stays" } }, CTX), ["ask[0].asked"], "who stays is one episode's");
  // A late lock: a game of questions' own, at a few set hours.
  assert.deepEqual(ats(G.specProblems(game([GONE], { extras: { lateLock: { hours: 24 } } }), CTX)), []);
  assert.deepEqual(ats(G.specProblems(game([GONE], { extras: { lateLock: { hours: 5 } } }), CTX)), ["extras.lateLock"]);
  assert.deepEqual(ats(G.specProblems(game([GONE], { extras: { lateLock: { hours: 24, days: 1 } } }), CTX)), ["extras.lateLock.days"]);
  assert.deepEqual(ats(G.specProblems({ ...G.PRESETS["weekly-calls"], extras: { lateLock: { hours: 24 } } })), ["extras.lateLock"], "Weekly Calls' calls are Call it's");
  assert.deepEqual(ats(G.specProblems({ ...G.PRESETS["weekly-lineup"], extras: { lateLock: { hours: 24 } } })), ["extras.lateLock"]);
  // A game of questions plays them all; its late lock round-trips through its fields.
  const all = game([GONE, WITHIN, MERGE, SOON, PHASE, FIRST], { extras: { lateLock: { hours: 48 } } });
  assert.equal(G.typeOf(all), "questions");
  assert.deepEqual(G.specWaitsFor(all), []);
  const fields = G.settingsOf(all);
  assert.equal(fields.lateLockHours, 48);
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, all)).extras.lateLock, { hours: 48 });
  assert.equal(G.settingsOf(game([GONE])).lateLockHours, undefined, "none: the field goes");
});

test("grading over windows: every N, over the next N, by phase; which episode; a moment's first", () => {
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map(), winner: null, ended: false, order: null, names: new Map(), groupNames: new Map(), phases: new Map(), ...o });
  const who = (m) => new Map(Object.entries(m).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const e = (n, out, moments = {}) => [n, { out, events: new Map(Object.entries(moments).map(([k, v]) => [k, Object.values(v).reduce((a, b) => a + b, 0)])), who: who(moments), in: ["a", "b", "c", "d", "e", "f"], groups: new Map(), roles: new Map() }];
  const q = (x) => G.fullQuestion(x);
  const grade = (qq, n, answers, ff) => Object.fromEntries(G.pointsFor(q(qq), G.verdictOf(q(qq), n, ff), answers, ff));
  // Episodes 1-4: a, b, then nobody, then c go home; an idol played in 3; immunity first in 2 (d); the merge at 3.
  const eps = new Map([e(1, ["a"]), e(2, ["b"], { individualImmunity: { d: 1 } }), e(3, [], { idolPlayed: { e: 1 }, individualImmunity: { e: 1 } }), e(4, ["c"])]);
  const f = facts({ episodes: eps, phases: new Map([["merged", 3]]) });
  // Every two: anyone who went home in the run, once both are in.
  assert.deepEqual(G.verdictOf(q(GONE), 1, f), { state: "known", right: ["a", "b"] });
  assert.deepEqual(grade(GONE, 3, [{ playerId: "ann", answer: "c" }, { playerId: "bo", answer: "a" }], f), { ann: 2 });
  assert.deepEqual(G.verdictOf(q(GONE), 5, facts({ episodes: new Map([...eps, e(5, ["d"])]) })), { state: "waiting" }, "6 isn't in yet");
  // Over the next three: yes as soon as it happens; no once all three are in without it.
  assert.deepEqual(G.verdictOf(q(WITHIN), 1, f), { state: "known", right: ["yes"] });
  assert.deepEqual(G.verdictOf(q(WITHIN), 4, f), { state: "waiting" }, "5 and 6 aren't in");
  const quiet = facts({ episodes: new Map([e(4, []), e(5, []), e(6, [])]) });
  assert.deepEqual(G.verdictOf(q(WITHIN), 4, quiet), { state: "known", right: ["no"] });
  assert.deepEqual(G.verdictOf(q(WITHIN), 5, facts({ ...quiet, to: 6, over: true })), { state: "known", right: ["no"] }, "the game's end cuts a window short");
  // Which episode the merge is: once the viewer has seen it start; the closest wins.
  assert.deepEqual(G.verdictOf(q(MERGE), 0, f), { state: "known", right: [], value: 3 });
  assert.deepEqual(grade(MERGE, 0, [{ playerId: "ann", answer: 4 }, { playerId: "bo", answer: 7 }], f), { ann: 3 });
  assert.deepEqual(G.verdictOf(q(MERGE), 0, facts({ episodes: eps })), { state: "waiting" }, "not seen: no start yet");
  assert.deepEqual(G.verdictOf(q(MERGE), 0, facts({ episodes: eps, over: true })), { state: "off", why: "It didn't start while the game was on" });
  assert.deepEqual(grade({ ...MERGE, answer: "choice", options: ["1-4", "5-8", "9+"] }, 0, [{ playerId: "ann", answer: "1-4" }], f), { ann: 3 }, "a choice of ranges");
  // Whether it starts in a window: yes there; no once its start is known elsewhere, or the game's over without it.
  assert.deepEqual(G.verdictOf(q(SOON), 2, f), { state: "known", right: ["yes"] });
  assert.deepEqual(G.verdictOf(q(SOON), 4, f), { state: "known", right: ["no"] });
  assert.deepEqual(G.verdictOf(q(SOON), 1, facts({ episodes: eps })), { state: "waiting" }, "a start the desk confirms late is never read as no");
  // A moment's first: who it happened to, and the episode (a number answer), once every episode before it is in.
  assert.deepEqual(G.verdictOf(q(FIRST), 0, f), { state: "known", right: ["d"], value: 2 });
  assert.deepEqual(grade({ ...FIRST, answer: "number" }, 0, [{ playerId: "ann", answer: 2 }, { playerId: "bo", answer: 3 }], f), { ann: 2 });
  assert.deepEqual(G.verdictOf(q(FIRST), 0, facts({ episodes: new Map([e(2, ["b"], { individualImmunity: { d: 1 } })]) })), { state: "waiting" }, "1 isn't in");
  // By phase: from the window's first episode to where the next phase's opens (once its start is seen), or the game's end. The
  // merge at 3 known only once it had begun: Merged's window opens at 4, and Tribes' runs to 3.
  const byPhase = facts({
    episodes: new Map([e(1, [], { idolFound: { a: 1 } }), e(2, [], { idolFound: { b: 1 } }), e(3, [], { idolFound: { d: 1 } }), e(4, [], { idolFound: { c: 1 } })]),
    phases: new Map([["merged", 3]]),
    windows: [{ phase: "merged", at: 4, from: 3 }],
    seen: 4,
  });
  assert.deepEqual(G.verdictOf(q(PHASE), 1, byPhase), { state: "known", right: ["a", "b", "d"] }, "Tribes: 1 to 3");
  assert.deepEqual(G.verdictOf(q(PHASE), 4, byPhase), { state: "waiting" }, "Merged: still on");
  assert.deepEqual(G.verdictOf(q(PHASE), 4, { ...byPhase, to: 4, over: true }), { state: "known", right: ["c"] });
  assert.deepEqual(G.verdictOf(q(PHASE), 1, { ...byPhase, seen: 2 }), { state: "waiting" }, "the merge not seen: Tribes isn't over");
  // About each person over a window: their own over the run.
  const EACH = { id: "each", ask: "Does each one go in the next two?", answer: "yesNo", points: 1, asked: "every", every: 2, each: "person", settle: { by: "results", take: "out" } };
  assert.deepEqual(G.specProblems(game([EACH]), CTX), []);
  const v = G.verdictOf(q(EACH), 1, f);
  assert.deepEqual(["a", "b", "c"].map((id) => v.each[id].right[0]), ["yes", "yes", "no"]);
});

test("the engine's windows: where each opens, which an answer is for, phase windows from the season's starts, a start once seen", () => {
  const s = league("pickem", 8);
  assert.deepEqual(S.setGame(s, game([GONE, WITHIN, PHASE, MERGE], { span: { from: 2, to: 9 } }), { ctx: CTX }), []);
  const [gone, within, phase, merge] = S.AnswerLogic.questions(s);
  assert.deepEqual(S.AnswerLogic.windowStarts(s, gone), [2, 4, 6, 8]);
  assert.deepEqual(S.AnswerLogic.windowStarts(s, within), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([S.AnswerLogic.windowAt(s, gone, 5), S.AnswerLogic.opensAt(s, gone, 5), S.AnswerLogic.opensAt(s, gone, 4)], [4, false, true]);
  assert.equal(S.AnswerLogic.byPhase(s), true);
  assert.deepEqual(S.AnswerLogic.windowStarts(s, phase), [2], "the merge isn't known: one window");
  // The desk confirms the merge at 6 while 5 is still to air: its window opens at 6. Settling again changes nothing.
  assert.equal(S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 6 }], open: 5 }), true);
  assert.deepEqual([s.phaseStarts, s.phaseWindows], [{ tribes: 1, merged: 6 }, { merged: 6 }]);
  assert.equal(S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 6 }], open: 5 }), false);
  assert.deepEqual(S.AnswerLogic.windowStarts(s, phase), [2, 6]);
  // Someone further behind than the episode before it doesn't see it (it would say the merge began); at 5 they do.
  assert.deepEqual([S.AnswerLogic.windowStarts(s, phase, 3), S.AnswerLogic.windowStarts(s, phase, 5)], [[2], [2, 6]]);
  assert.equal(S.AnswerLogic.windowAt(s, phase, 7, 3), 2);
  // This week's (open at 6): a correction doesn't move it, answers and all.
  S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 7 }], open: 6 });
  assert.deepEqual([s.phaseWindows, s.phaseStarts.merged], [{ merged: 6 }, 7]);
  S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: null }], open: 6 });
  assert.deepEqual([s.phaseWindows, s.phaseStarts.merged], [{ merged: 6 }, 7], "cleared: it keeps the last start it had");
  s.phaseStarts.merged = 6;
  // Known only once it's begun (7 still open): from 7. Once that's opened (open past it), a correction never moves it.
  const late = league("pickem", 8);
  S.setGame(late, game([PHASE], { span: { from: 2, to: 9 } }), { ctx: CTX });
  S.settlePhases(late, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 6 }], open: 7 });
  assert.deepEqual(late.phaseWindows, { merged: 7 });
  S.settlePhases(late, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 5 }], open: 8 });
  assert.deepEqual([late.phaseWindows, late.phaseStarts.merged], [{ merged: 7 }, 5]);
  // A start that's cleared before its window opens takes the window with it; one before the game's start opens none.
  const cleared = league("pickem", 8);
  S.setGame(cleared, game([PHASE], { span: { from: 2, to: 9 } }), { ctx: CTX });
  S.settlePhases(cleared, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 8 }], open: 5 });
  S.settlePhases(cleared, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: null }], open: 5 });
  assert.deepEqual([cleared.phaseWindows, cleared.phaseStarts], [{}, { tribes: 1 }]);
  S.settlePhases(cleared, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 2 }], open: 3 });
  assert.deepEqual(cleared.phaseWindows, {}, "it started with the game: the game's first window is it");
  // Graded by window: an answer for a window that opens nowhere earns nothing; the merge counts once it's been seen.
  [2, 3, 4, 5, 6].forEach((n, i) => results(s, n, [i]));
  const answers = [
    { playerId: "ann", question: "gone", episode: 2, answer: cid(s, 1) },
    { playerId: "bo", question: "gone", episode: 3, answer: cid(s, 1) },
    { playerId: "ann", question: "merge", episode: 0, answer: 6 },
    { playerId: "bo", question: "merge", episode: 0, answer: 9 },
  ];
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(s, answers).points), { ann: 5 });
  assert.equal(S.AnswerLogic.facts(S.GhostLogic.viewFor(s, "ann", 5)).phases.has("merged"), false, "at 5 the merge isn't seen");
  assert.deepEqual(Object.fromEntries(S.AnswerLogic.grade(S.GhostLogic.viewFor(s, "ann", 5), answers).points), { ann: 2 });
  assert.equal(S.AnswerLogic.closesAt(s, gone, 4), 4);
  assert.equal(S.AnswerLogic.closesAt(s, merge, 0), 2);
  // How it works says each window, and the late lock.
  const late2 = G.describeSpec(game([GONE, WITHIN, PHASE], { extras: { lateLock: { hours: 24 } } }));
  assert.deepEqual(late2.rules.slice(1, 4), [
    "Every two episodes, before the first: Who'll be gone in the next two? 2 points if you're right.",
    "Before each episode, about it and the next two: An idol played in the next three? 1 point if you're right.",
    "Once a phase, as it begins: Who finds an idol this phase? Name two: 1 point for each one right.",
  ]);
  assert.ok(late2.rules.includes("Watching late? Answer before you watch: until you've seen it, up to 24 hours after it airs."));
  assert.equal(late2.details.find((d) => d.id === "lateLock").value, "Answer until you've seen it, up to 24 hours after it airs");
});

test("a late lock: someone who hasn't seen an episode answers until they have, up to its hours past the air time", () => {
  const s = league("pickem", 6);
  const OUT = { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
  assert.deepEqual(S.setGame(s, game([OUT], { span: { from: 1, to: null }, extras: { lateLock: { hours: 24 } } }), { ctx: CTX }), []);
  const q = S.AnswerLogic.questions(s)[0];
  const e1 = ep(s, 1);
  const air = Date.parse("2026-11-01T00:00:00Z");
  e1.airsAt = new Date(air).toISOString();
  const closed = (mark, now) => S.AnswerLogic.closed(s, q, 1, { now, mark });
  assert.equal(closed(null, air - HOUR), false, "before it airs: open for everyone");
  assert.equal(closed(null, air + HOUR), true, "it's started: closed for whoever sees it as it airs");
  assert.equal(closed(0, air + HOUR), false, "not seen: still open, an hour in");
  assert.equal(closed(0, air + 23 * HOUR), false);
  assert.equal(closed(0, air + 25 * HOUR), true, "past the late lock's hours");
  assert.equal(closed(1, air + HOUR), true, "seen it: closed");
  results(s, 1, [0]);
  assert.equal(closed(0, air + 2 * HOUR), false, "its results are in, but not for them: they haven't seen it");
  // This week's for them is the one after their mark while it's open; whoever runs it locking the episode closes it.
  ep(s, 2);
  assert.equal(S.AnswerLogic.episodeNow(s), 2);
  assert.equal(S.AnswerLogic.lateEpisode(s, 0, { now: air + 2 * HOUR }), 1);
  assert.equal(S.AnswerLogic.lateEpisode(s, 0, { now: air + 30 * HOUR }), 2);
  assert.equal(S.AnswerLogic.lateEpisode(s, null, { now: air + 2 * HOUR }), 2);
  // An air time from the schedule (the league hasn't stamped one) does the same.
  delete e1.airsAt;
  const airAtOf = (n) => (n === 1 ? new Date(air).toISOString() : null);
  assert.equal(S.AnswerLogic.lateEpisode(s, 0, { now: air + 2 * HOUR }), 2, "no air time: no late lock");
  assert.equal(S.AnswerLogic.lateEpisode(s, 0, { now: air + 2 * HOUR, airAtOf }), 1);
  e1.airsAt = new Date(air).toISOString();
  e1.lineupsLocked = true;
  assert.equal(closed(0, air + HOUR), true, "locked by whoever runs it");
  // Without a late lock nothing changes.
  const plain = league("pickem", 6);
  S.setGame(plain, game([OUT]), { ctx: CTX });
  ep(plain, 1).airsAt = new Date(air).toISOString();
  assert.equal(S.AnswerLogic.closed(plain, S.AnswerLogic.questions(plain)[0], 1, { now: air + HOUR, mark: 0 }), true);
});
