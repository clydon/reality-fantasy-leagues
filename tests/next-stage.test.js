// The 'next-stage' fallback (docs/PLAN-start-a-game-gpt.md step A12 part 2b): a group question asked each episode, or group slots,
// in a stage of a game in stages that can't be played as the groups stand ends that stage, and the game's next stage starts, through
// part 2's machinery (StateLogic.StageLogic.changePlan, change-stages.ts's copies and its undo). The spec (only a stage's with a stage
// after it; the next stage starts on it, its `on` left out or with kinds of its own; no end of its own for the stage before; a stage's
// own league carrying it), its words; where research says the groups are gone (format-timeline.js groupsGone: only a sure report
// moves the game, an unsure one is held and the episode is void, a re-draw moves nothing); and the plan from it (from the episode it
// takes effect or the first still open, one copy with the stage's own kinds, the maker's OK, a corrected report taking it away). No
// database: the server's side is scripts/dev-test/check-change-stages.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const TL = require("../src/lib/game/formats/format-timeline.js");

const { StageLogic } = S;
const CTX = {
  show: "The Challenge 42",
  moments: [{ id: "dailyWin", label: "Won the daily", defaultPoints: 2, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  group: "team",
  phases: [{ id: "game", name: "The game" }, { id: "final", name: "The final" }],
};
const ats = (spec, ctx = CTX, opts) => G.specProblems(spec, ctx, opts).map((p) => p.at);
const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const Q = { id: "pair", ask: "Which pair wins the daily?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "dailyWin", take: "who" }, fallback: "next-stage" };
const QUESTIONS = { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [Q], span: { from: 1 } };
const PAIRS = { id: "pairs", name: "Pairs", game: QUESTIONS };
const SOLO = { id: "solo", name: "Solo", game: { preset: "outlast", get: DRAFT } };
const SPEC = { stages: [PAIRS, SOLO] };
/** A lineup with a group slot, its fallback 'next-stage'. */
const SLOTTED = { preset: "weekly-lineup", get: { ...G.PRESETS["weekly-lineup"].get, groups: { slots: 1, fallback: "next-stage" } }, span: { from: 1 } };

/** A league of 16 castaways and four seats, its game `spec` through setGame, Episodes 1 to 12 made. */
function league(spec) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 16; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo", "cy", "di"].map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= 12; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}

// Made-up research (change-stages.test.js's): who is with whom at each episode's end, and what the answer says changed.
const pair = (...members) => ({ name: null, members });
function report(episode, groups, { changes = [], left = [], playedAs = "pairs" } = {}) {
  return { episode, left, merged: null, state: { playedAs, phase: null, groups, alone: [], newcomers: [], wentHomeAs: left.length ? "individuals" : "nobody", changes } };
}
const change = (kind, from, when = "end", sure = "high") => ({ kind, from, when, what: `${kind} from ${from}`, sure });
const CAST = "ABCDEFGH".split("");
const P1 = [pair("A", "B"), pair("C", "D"), pair("E", "F"), pair("G", "H")];
const P2 = [pair("A", "C"), pair("B", "D"), pair("E", "G"), pair("F", "H")];
const P3 = [pair("A", "E"), pair("B", "F"), pair("C", "G"), pair("D", "H")];
/** Pairs, re-paired at 3's end (from 4), everyone on their own from 6 (said at 5's end: `split` how sure), paired again from 8;
 *  `five` replaces Episode 5's report (a corrected one); `upTo` how many episodes have research. */
function season({ split = "high", upTo = 7, five = null, six = null } = {}) {
  const all = [
    report(1, P1),
    report(2, P1),
    report(3, P2, { changes: [change("swap", 4)] }),
    report(4, P2),
    five || report(5, [], { changes: [change("split-into-individuals", 6, "end", split)] }),
    six || report(6, [], { playedAs: "individuals" }),
    report(7, P3, { playedAs: "individuals", changes: [change("pairs-formed", 8)] }),
  ];
  return TL.buildTimeline(all.filter((r) => r.episode <= upTo), { cast: CAST });
}
/** changePlan's triggers as the server reads them (change-stages.ts triggersFor): each stage a change starts, its kinds' changes,
 *  and, for one the stage before's 'next-stage' fallback starts, where the groups are gone (withGone: one per change). */
function triggersOf(state, tl) {
  const falls = StageLogic.fallbackStarts(state);
  const gone = TL.groupsGone(tl);
  return Object.fromEntries(StageLogic.onStages(state).map((st) => [st.id, falls.has(st.id) ? TL.withGone(TL.stageTriggers(tl, G.stageOn(st).change), gone) : TL.stageTriggers(tl, G.stageOn(st).change)]));
}
const plan = (state, tl, more = {}) => StageLogic.changePlan(state, { triggers: triggersOf(state, tl), starts: { pairs: 1 }, copies: {}, open: 6, last: 12, ...more });
const spans = (p) => p.entries.map((e) => [e.key, e.from, e.to]);

test("the 'next-stage' fallback: a stage's with a stage after it, which starts on it; refused alone or in the last stage", () => {
  assert.deepEqual(ats(SPEC), []);
  assert.deepEqual(G.specWaitsFor(SPEC), [], "nothing waits: the engine plays it");
  const full = G.fullSpec(SPEC);
  assert.deepEqual(full.stages[1].on, { change: [], again: false }, "its start left out: the fallback alone starts it");
  assert.equal(full.stages[1].game.span.from, null, "it plays from where the groups are gone");
  assert.equal(full.stages[0].game.span.to, null, "the stage before runs on until then");
  // Alone, or in the last stage, there's nothing to start.
  assert.deepEqual(ats(QUESTIONS), ["ask[0].fallback"]);
  assert.match(G.specProblems(QUESTIONS, CTX)[0].problem, /a stage with another after it/);
  assert.deepEqual(ats(SLOTTED), ["get.groups.fallback"]);
  assert.deepEqual(ats({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 5 } } }, { ...PAIRS, game: { ...QUESTIONS, span: { from: 6 } } }] }), ["stages[1].game.ask[0].fallback"]);
  // Group slots carry it the same way.
  assert.deepEqual(ats({ stages: [{ id: "slots", name: "Slots", game: SLOTTED }, SOLO] }), []);
  // The next stage starts on it: never at an episode or a phase of its own; and the stage before has no end of its own.
  assert.deepEqual(ats({ stages: [PAIRS, { ...SOLO, game: { ...SOLO.game, span: { from: 6 } } }] }), ["stages[1].game.span.from"]);
  assert.deepEqual(ats({ stages: [{ ...PAIRS, game: { ...QUESTIONS, span: { from: 1, to: 5 } } }, SOLO] }), ["stages[0].game.span.to"]);
  // With kinds of its own too: whichever comes first. An empty list only after a fallback (else nothing would start it).
  assert.deepEqual(ats({ stages: [PAIRS, { ...SOLO, on: { change: ["teams-formed"] } }] }), []);
  assert.deepEqual(G.fullSpec({ stages: [PAIRS, { ...SOLO, on: { change: ["teams-formed"] } }] }).stages[1].on.change, ["teams-formed"]);
  assert.deepEqual(ats({ stages: [PAIRS, { ...SOLO, on: { change: [] } }] }), []);
  const SOLO1 = { ...SOLO, id: "first", game: { ...SOLO.game, span: { from: 1 } } };
  assert.deepEqual(ats({ stages: [SOLO1, { ...SOLO, on: { change: [] } }] }), ["stages[1].on.change"]);
  // A void fallback starts nothing: the stage after says where it starts, as ever.
  assert.deepEqual(ats({ stages: [{ ...PAIRS, game: { ...QUESTIONS, ask: [{ ...Q, fallback: "void" }] } }, SOLO] }), ["stages[1].game.span.from", "stages[0].game.span.to"]);
  // A league of its own can't take it either; a stage's own league plays it as void (stageLeagueGame: where the stage ends is the
  // game in stages' plan), made as a pool as the lab makes one.
  const own = S.defaultState();
  S.updateSettings(own, "showId", "survivor");
  S.updateSettings(own, "leagueTypeId", G.madeAs("questions"));
  for (let i = 0; i < 8; i++) S.addCastaway(own, `C${i}`);
  S.updateSettings(own, "setupComplete", true);
  assert.deepEqual(S.setGame(own, QUESTIONS, { ctx: CTX }).map((p) => p.at), ["ask[0].fallback"]);
  assert.equal(G.stageLeagueGame(PAIRS).ask[0].fallback, "void");
  assert.equal(PAIRS.game.ask[0].fallback, "next-stage", "the stage itself is left as it was");
  assert.deepEqual(S.setGame(own, G.stageLeagueGame(PAIRS), { ctx: CTX }), []);
  assert.equal(S.gameOf(own).ask[0].fallback, "void");
  assert.equal(G.stageLeagueGame({ id: "slots", game: SLOTTED }).get.groups.fallback, "void");
  assert.equal(G.stageLeagueGame(SOLO), SOLO.game, "a stage without it plays its game as it is");
  // Through a league's settings, both ways; the stage it starts.
  const s = league(SPEC);
  assert.deepEqual(S.gameOf(s).stages[1].on, { change: [], again: false });
  assert.deepEqual([...StageLogic.fallbackStarts(s)], ["solo"]);
  assert.deepEqual(StageLogic.onStages(s).map((x) => x.id), ["solo"]);
  assert.deepEqual([...StageLogic.fallbackStarts(league({ stages: [SOLO1, { ...SOLO, on: {} }] }))], [], "a stage a change starts, no fallback before it");
  // Its words.
  const d = G.describeSpec(SPEC, CTX);
  assert.match(d.sentence, /Pairs, .*until there are no more teams\..*; then Solo, .*once there are no more teams/);
  assert.ok(d.rules.some((r) => /^Pairs: once research is sure nobody is in a team going into an episode, it ends and Solo starts/.test(r)), d.rules.join("\n"));
  assert.match(G.describeSpec({ stages: [PAIRS, { ...SOLO, on: { change: ["teams-formed"] } }] }, CTX).sentence, /Pairs, .*until the format changes, or there are no more teams\..*then Solo, .*from the first time teams form, or once there are no more teams/);
});

test("where the groups are gone: a sure split or merge leaving nobody in a group; unsure, held; a re-draw moves nothing", () => {
  const tl = season();
  const g = TL.groupsGone(tl);
  assert.deepEqual(g.act.map((t) => [t.id, t.kind, t.from, t.episode, t.gone]), [["5:split-into-individuals", "split-into-individuals", 6, 5, true]]);
  assert.deepEqual(g.held, [], "the re-pairing at 3 left the game in pairs, and pairs forming at 7 isn't the groups going");
  // The same change as the stage's own kinds would read: one id, so a stage both start starts once.
  assert.equal(TL.stageTriggers(tl, ["split-into-individuals"]).act[0].id, g.act[0].id);
  // Unsure of the split: held, flagged, never acted on; once the next episode's research is sure nobody's in a pair going into 7,
  // from 7, keyed by the split still.
  const unsure = TL.groupsGone(season({ split: "low", upTo: 5 }));
  assert.deepEqual([unsure.act.length, unsure.held.map((t) => t.from)], [0, [6]]);
  assert.deepEqual(TL.groupsGone(season({ split: "low" })).act.map((t) => [t.id, t.from, t.episode]), [["5:split-into-individuals", 7, 6]]);
  assert.deepEqual(TL.groupsGone(season({ split: "low" })).held, []);
  // Before Episode 5's research: nothing.
  assert.deepEqual(TL.groupsGone(season({ upTo: 4 })), { act: [], held: [] });
  // The merge (one group of everyone) after tribes; and a season never in groups.
  const tribes = [{ name: "Kele", members: ["A", "B", "C", "D"] }, { name: "Hina", members: ["E", "F", "G", "H"] }];
  const merged = TL.buildTimeline([report(1, tribes, { playedAs: "groups" }), report(2, [{ name: "Merged", members: CAST }], { playedAs: "groups", changes: [change("merge", 3)] })], { cast: CAST });
  assert.deepEqual(TL.groupsGone(merged).act.map((t) => [t.kind, t.from]), [["merge", 3]]);
  const alone = TL.buildTimeline([report(1, [], { playedAs: "individuals" }), report(2, [], { playedAs: "individuals" })], { cast: CAST });
  assert.deepEqual(TL.groupsGone(alone), { act: [], held: [] });
  // A group question's choices read 'next-stage' as void (where the stage ends is the plan's).
  for (const n of [4, 6, 9]) assert.deepEqual(TL.groupChoices(tl, n, { fallback: "next-stage" }), TL.groupChoices(tl, n));
  // The stage's own kinds and the fallback: one trigger per change, a sure one taking a held one's place.
  const t = TL.withGone(TL.stageTriggers(season({ split: "low" }), ["split-into-individuals"]), TL.groupsGone(season({ split: "low" })));
  assert.deepEqual([t.act.map((x) => [x.id, x.from]), t.held], [[["5:split-into-individuals", 7]], []]);
});

test("the plan: the next stage from where the groups are gone; held while unsure; seen late; with its own kinds; the maker's OK; undone", () => {
  const parent = league(SPEC);
  const tl = season();
  assert.deepEqual(spans(plan(parent, tl)), [["pairs", 1, 5], ["solo@5:split-into-individuals", 6, null]]);
  // Unsure: held, Pairs plays on; sure at the next episode's research: from 7.
  const held = plan(parent, season({ split: "low", upTo: 5 }));
  assert.deepEqual(spans(held), [["pairs", 1, null]]);
  assert.deepEqual(held.held.map((h) => [h.stage, h.trigger.from]), [["solo", 6]]);
  assert.deepEqual(spans(plan(parent, season({ split: "low" }), { open: 7 })), [["pairs", 1, 6], ["solo@5:split-into-individuals", 7, null]]);
  // Seen once 8 is the first still open: from 8, Pairs scoring 6 and 7 (it had their results all along).
  assert.deepEqual(spans(plan(parent, tl, { open: 8 })), [["pairs", 1, 7], ["solo@5:split-into-individuals", 8, null]]);
  // A copy made never moves once it has aired.
  assert.deepEqual(spans(plan(parent, tl, { open: 8, copies: { "solo@5:split-into-individuals": { from: 6 } } })), [["pairs", 1, 5], ["solo@5:split-into-individuals", 6, null]]);
  // Its own kinds too: the same change starts it once; another kind later doesn't make a second (once, not again).
  const both = league({ stages: [PAIRS, { ...SOLO, on: { change: ["split-into-individuals", "pairs-formed"] } }] });
  assert.deepEqual(spans(plan(both, tl, { open: 8 })), [["pairs", 1, 7], ["solo@5:split-into-individuals", 8, null]]);
  // Only its own kind, pairs forming at 7's end: the groups going at 5 still comes first.
  const formed = league({ stages: [PAIRS, { ...SOLO, on: { change: ["pairs-formed"] } }] });
  assert.deepEqual(spans(plan(formed, tl)), [["pairs", 1, 5], ["solo@5:split-into-individuals", 6, null]]);
  // With the maker's OK: it waits until 6's lock, then starts by default.
  const maker = league({ ...SPEC, extras: { changes: { ok: "maker" } } });
  const asked = plan(maker, tl);
  assert.deepEqual([spans(asked), asked.pending.map((x) => [x.key, x.until])], [[["pairs", 1, null]], [["solo@5:split-into-individuals", 6]]]);
  assert.equal(StageLogic.decide(maker, "solo@5:split-into-individuals", "start", "ann"), null);
  assert.deepEqual(spans(plan(maker, tl)), [["pairs", 1, 5], ["solo@5:split-into-individuals", 6, null]]);
  // A corrected report: Episode 5 still in pairs, the split at 6's end. The copy from 5's report is gone from the plan (the server
  // takes it away) and Pairs plays on until the new one; said again, it's back.
  const late = season({ five: report(5, P2), six: report(6, [], { playedAs: "individuals", changes: [change("split-into-individuals", 7)] }) });
  assert.deepEqual(TL.groupsGone(late).act.map((t) => [t.id, t.from]), [["6:split-into-individuals", 7]]);
  assert.deepEqual(spans(plan(parent, late, { open: 7, copies: { "solo@5:split-into-individuals": { from: 6 } } })), [["pairs", 1, 6], ["solo@6:split-into-individuals", 7, null]]);
  // Our comparison alone (the answer never said the split): unsure, held, Pairs plays on.
  const unsaid = season({ five: report(5, P2) });
  assert.deepEqual([TL.groupsGone(unsaid).act.length, TL.groupsGone(unsaid).held.map((t) => [t.id, t.from])], [0, [["6:split-into-individuals", 7]]]);
  assert.deepEqual(spans(plan(parent, unsaid, { open: 7 })), [["pairs", 1, null]]);
  assert.deepEqual(spans(plan(parent, tl, { open: 6 })), [["pairs", 1, 5], ["solo@5:split-into-individuals", 6, null]]);
});
