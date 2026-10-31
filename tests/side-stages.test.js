// A side stage, when a grouping lasts (docs/PLAN-start-a-game-gpt.md step A12 part 3, the tracker's p8: "draft solo players in the
// challenge. if we ever get teams forming or pairing up that lasts for multiple episode i want us to start a 'side draft' after that
// episode ends"): the spec (a stage's `side` { held }, after the game's own stages, beside them), its words and its round trip through
// a league's settings; when a grouping has lasted (format-timeline.js sideTriggers, from made-up research: only a reliable report opens
// or closes one, an unsure one held and said, a group going home whole keeping it); where each copy plays (StateLogic.StageLogic
// changePlan: once the game has started, from the episode after, never moving once aired, until research is sure the grouping changed,
// its points kept; the maker's OK; a corrected report taking a copy away; the season's end; one that changed before it could play); and
// the overall over the copies, read as the server reads the stages (game-view.ts gameView, no seat: answer-points.ts stageWalk), the
// game ending with its own last stage. No database: the server's side (change-stages.ts) is scripts/dev-test/check-side-stages.js's.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const TL = require("../src/lib/game/formats/format-timeline.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });

const { StageLogic } = S;
const CTX = {
  show: "The Challenge 42",
  moments: [{ id: "dailyWin", label: "Won the daily", defaultPoints: 2, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  group: "pair",
  phases: [{ id: "game", name: "The game" }, { id: "final", name: "The final" }],
};
const SEATS = ["ann", "bo", "cy", "di"];
const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const SOLO = { id: "solo", name: "Solo draft", game: { preset: "outlast", get: { ...DRAFT, each: 3 }, span: { from: 1 } } };
const SIDE = { id: "side", name: "Side draft", side: {}, game: { preset: "outlast", get: DRAFT, ask: [] } };
const P8 = { stages: [SOLO, SIDE] };
const ats = (spec, ctx = CTX) => G.specProblems(spec, ctx).map((p) => p.at);

/** A league of `n` castaways C0.. and seats `people`, its game `spec` through setGame, Episodes 1 to `eps` made, none with results. */
function league(spec, { n = 16, people = SEATS, eps = 12 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const gone = (s, k, i) => S.addElimination(s, ep(s, k).id, s.castaways[i].id, "Eliminated");

// Made-up research (change-stages.test.js's): who is paired with whom at each episode's end, and what the answer says changed.
const pair = (...members) => ({ name: null, members });
function report(episode, groups, { changes = [], left = [], playedAs = "pairs" } = {}) {
  return { episode, left, merged: null, state: { playedAs, phase: null, groups, alone: [], newcomers: [], wentHomeAs: left.length ? "individuals" : "nobody", changes } };
}
const change = (kind, from, when = "end", sure = "high") => ({ kind, from, when, what: `${kind} from ${from}`, sure });
const CAST = "ABCDEFGH".split("");
const P1 = [pair("A", "B"), pair("C", "D"), pair("E", "F"), pair("G", "H")];
const P2 = [pair("A", "C"), pair("B", "D"), pair("E", "G"), pair("F", "H")];
const P3 = [pair("A", "E"), pair("B", "F"), pair("C", "G"), pair("D", "H")];
const P4 = [pair("A", "H"), pair("B", "G"), pair("C", "F"), pair("D", "E")];
/** A season in pairs: P1 from the premiere, re-paired at 2's and 3's ends (P2 for one episode), P3 from 4 holding to 7, everyone on their
 *  own from 8 (said at 7's end: `split` how sure), paired again (P4) from 10. `five` / `seven` replace those episodes' reports (a
 *  corrected one); `upTo` how many episodes have research. */
function season({ split = "high", upTo = 7, five = null, seven = null } = {}) {
  const all = [
    report(1, P1),
    report(2, P2, { changes: [change("swap", 3)] }),
    report(3, P3, { changes: [change("swap", 4)] }),
    report(4, P3),
    five || report(5, P3),
    report(6, P3),
    seven || report(7, [], { changes: [change("split-into-individuals", 8, "end", split)] }),
    report(8, [], { playedAs: "individuals" }),
    report(9, P4, { playedAs: "individuals", changes: [change("pairs-formed", 10)] }),
    report(10, P4),
    report(11, P4),
  ];
  return TL.buildTimeline(all.filter((r) => r.episode <= upTo), { cast: CAST });
}
/** changePlan's triggers for a game's side stages, from a timeline (change-stages.ts triggersFor). */
const triggersOf = (state, tl) => Object.fromEntries(StageLogic.sideStages(state).map((st) => [st.id, TL.sideTriggers(tl, { held: G.stageSide(st).held })]));
const plan = (state, tl, more = {}) => StageLogic.changePlan(state, { triggers: triggersOf(state, tl), starts: { solo: 1 }, copies: {}, open: 6, last: 12, ...more });
const spans = (p) => p.entries.map((e) => [e.key, e.from, e.to]);

test("a side stage: after the game's own stages, beside them; its spec whole, its problems, its waits, its settings and its words", () => {
  assert.deepEqual(ats(P8), []);
  assert.deepEqual(G.specWaitsFor(P8), [], "nothing waits: the engine plays it");
  const full = G.fullSpec(P8);
  assert.equal(G.playsAs(full), "stages");
  assert.deepEqual(full.stages[1].side, { held: 2 }, "held left out: SIDE's");
  assert.deepEqual(G.SIDE, { held: 2 });
  assert.equal(full.stages[1].game.span.from, null, "each copy plays from where its grouping opened it");
  assert.equal(full.stages[1].game.span.to, null, "it ends where the game's own last stage does");
  assert.equal(full.stages[0].game.span.to, null, "the game's own stage is untouched by it: all season");
  assert.equal(full.stages[1].game.extras.draft.opens, "start", "its draft opens at its start, from who's still in");
  assert.deepEqual(full.span, { from: 1, to: null }, "the game's span is its own stages'");
  assert.deepEqual(full.extras.changes, G.CHANGES, "taken as a format change is, by itself by default");
  assert.equal(G.mainCount(full.stages), 1);
  assert.deepEqual(G.stageSide(SIDE), { held: 2 });
  assert.equal(G.stageSide(SOLO), null);
  // The game's own end is a side stage's unless it says.
  const ended = G.fullSpec({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 9 } } }, SIDE] });
  assert.equal(ended.stages[1].game.span.to, 9);
  assert.deepEqual(ended.span, { from: 1, to: 9 });
  assert.equal(G.fullSpec({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 9 } } }, { ...SIDE, game: { ...SIDE.game, span: { to: 7 } } }] }).stages[1].game.span.to, 7);
  // Two of the game's own stages and a side stage beside them; and two side stages.
  const POST = { id: "post", name: "Post", game: { preset: "outlast", get: DRAFT, span: { from: 7 } } };
  assert.deepEqual(ats({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 6 } } }, POST, SIDE] }), []);
  assert.deepEqual(G.fullSpec({ stages: [SOLO, POST, SIDE] }).stages[0].game.span.to, 6, "the own stages still meet");
  assert.deepEqual(ats({ stages: [SOLO, SIDE, { ...SIDE, id: "long", side: { held: 4 } }] }), []);
  // Its problems: never the first, the game's own stages first, its `held`, nothing else of a side stage's, no start of its own, never
  // a format change's too, and nothing of a stage after it ('next-stage' has no stage to start).
  assert.deepEqual(ats({ stages: [SIDE, SOLO] }), ["stages[0].side", "stages[1]"]);
  assert.deepEqual(ats({ stages: [SOLO, SIDE, POST] }), ["stages[2]"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, side: { held: 0 } }] }), ["stages[1].side.held"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, side: { held: G.MAX_HELD + 1 } }] }), ["stages[1].side.held"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, side: { held: G.MAX_HELD } }] }), []);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, side: { held: 2, of: "pairs" } }] }), ["stages[1].side.of"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, side: true }] }), ["stages[1].side"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, game: { ...SIDE.game, span: { from: 4 } } }] }), ["stages[1].game.span.from"]);
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, on: {} }] }), ["stages[1].on"]);
  const Q = { id: "pair", ask: "Which pair wins the daily?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "dailyWin", take: "who" }, fallback: "next-stage" };
  const PAIRS = { id: "pairs", name: "Pairs", game: { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [Q], span: { from: 1 } } };
  assert.deepEqual(ats({ stages: [PAIRS, SIDE] }), ["stages[0].game.ask[0].fallback"], "a side stage isn't the next stage");
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, game: PAIRS.game }] }).filter((a) => a !== "stages[1].game.span.from"), ["stages[1].game.ask[0].fallback"]);
  // A pick each episode from the groups on screen (A6's group question) can be a side stage's game.
  assert.deepEqual(ats({ stages: [SOLO, { ...SIDE, game: { ...PAIRS.game, span: undefined, ask: [{ ...Q, fallback: "void" }] } }] }), []);
  // How a change is taken is a side stage's game's too.
  assert.deepEqual(ats({ ...P8, extras: { changes: { ok: "maker", unanswered: "carry-on" } } }), []);
  assert.deepEqual(ats({ stages: [SOLO, { ...POST, game: { ...POST.game, span: { from: 7 } } }], extras: { changes: { ok: "maker", unanswered: "start" } } }).filter((a) => a.startsWith("extras")), ["extras.changes"]);
  // Through a league's settings, both ways.
  const s = league(P8);
  assert.deepEqual(S.gameOf(s).stages[1].side, { held: 2 });
  assert.deepEqual(StageLogic.sideStages(s).map((x) => x.id), ["side"]);
  assert.deepEqual(StageLogic.onStages(s), []);
  assert.deepEqual(StageLogic.changesOf(s), G.CHANGES);
  assert.equal(StageLogic.decide(s, "side@s3", "skip", "ann", null), null, "the maker can call a side copy off");
  assert.match(StageLogic.decide(s, "solo@s3", "skip", "ann", null), /isn't one of this game's format changes/);
  // Its words.
  const d = G.describeSpec(P8, CTX);
  assert.match(d.sentence, /^A game in two stages for The Challenge 42: Solo draft, an Outlast: everyone drafts 3, all season\..*; and beside it, Side draft, an Outlast: everyone drafts 2, each time the pairs hold two episodes, until they change\./);
  assert.ok(d.rules.some((r) => /^Side draft: once research is sure the pairs have held two episodes and go on as they are, it opens with the next episode/.test(r)), d.rules.join("\n"));
  assert.ok(d.rules.includes("Side draft: it opens by itself; whoever runs the game can call it off."));
  const maker = G.describeSpec({ ...P8, extras: { changes: { ok: "maker", unanswered: "carry-on" } } }, CTX);
  assert.ok(maker.rules.includes("Side draft: whoever runs the game says whether it opens; if nobody does by its first episode, it doesn't."), maker.rules.join("\n"));
  assert.match(G.describeSpec({ stages: [SOLO, { ...SIDE, side: { held: 1 } }] }, CTX).sentence, /each time the pairs hold one episode, until they change/);
});

test("when a grouping lasts: a spell research is sure held its episodes and goes on; one gone before it opens never does; held and said", () => {
  const tl = season();
  // P1 played 1 and 2 but was re-drawn at 2's end; P2 played 3 alone; P3 played 4 to 7, then everyone went on alone.
  assert.deepEqual(tl.spells.map((x) => [x.id, x.played]), [["s1", [1, 2]], ["s2", [3]], ["s3", [4, 5, 6, 7]]]);
  const t = TL.sideTriggers(tl);
  assert.deepEqual(t.act.map((x) => [x.id, x.kind, x.from, x.episode, x.groups, x.held]), [["s3", "lasted", 6, 5, 4, 2]], "P3 held 4 and 5 and went on: from 6");
  assert.deepEqual(t.act[0].closes, { at: 7, episode: 7, ended: "split-into-individuals" }, "everyone on their own after 7: it closes with 7");
  assert.deepEqual(t.held, [], "P1 was gone going into 3: nothing to hold");
  // While it lasts, nothing closes it.
  assert.equal(TL.sideTriggers(season({ upTo: 6 })).act[0].closes, null);
  // Before 5's research, it hasn't held two yet.
  assert.deepEqual(TL.sideTriggers(season({ upTo: 4 })).act, []);
  // Held one: P1 from 2 (to 2), P3 from 5; P2 was re-drawn at the end of the one episode it played. Held three: from 7.
  assert.deepEqual(TL.sideTriggers(tl, { held: 1 }).act.map((x) => [x.id, x.from, x.closes && x.closes.at]), [["s1", 2, 2], ["s3", 5, 7]]);
  assert.deepEqual(TL.sideTriggers(tl, { held: 3 }).act.map((x) => [x.id, x.from]), [["s3", 7]]);
  assert.deepEqual(TL.sideTriggers(tl, { held: 5 }), { act: [], held: [] }, "P3 played four episodes: never held five");
  // Paired again from 10 (P4 shown at 9's end): it opens again, after 11.
  assert.deepEqual(TL.sideTriggers(season({ upTo: 11 })).act.map((x) => [x.id, x.from, x.closes && x.closes.at]), [["s3", 6, 7], ["s9", 12, null]]);
  // A report that doesn't say who is with whom (carried on, unsure) holds the opening to the next sure one, the same spell.
  const carried = { episode: 5, left: [], merged: null, state: { playedAs: "pairs", phase: null, alone: [], newcomers: [], wentHomeAs: "nobody", changes: [] } };
  const u = TL.sideTriggers(season({ five: carried }));
  assert.deepEqual(u.act.map((x) => [x.id, x.from, x.episode]), [["s3", 7, 6]], "sure only at 6's research: from 7");
  // A change announced ahead, not sure, keeps research from being sure the pairs go on: held, never opened.
  const ahead = TL.sideTriggers(season({ five: report(5, P3, { changes: [change("swap", 7, "end", "low")] }) }), { held: 3 });
  assert.deepEqual(ahead.act, []);
  assert.deepEqual(ahead.held.map((x) => [x.id, x.from, x.episode]), [["s3", 7, 6]]);
  // A split research isn't sure of: closing, not closed (the side stage plays on), until a later sure report.
  const unsure = TL.sideTriggers(season({ split: "low" }));
  assert.equal(unsure.act[0].closes, null);
  assert.deepEqual(unsure.act[0].closing, { at: 7, episode: 7, ended: "split-into-individuals" });
  assert.deepEqual(TL.sideTriggers(season({ split: "low", upTo: 8 })).act[0].closes, { at: 7, episode: 8, ended: "split-into-individuals" }, "sure at 8's research");
  // A pair going home together doesn't end the grouping; one broken up does.
  const home = TL.sideTriggers(season({ five: report(5, P3.slice(1), { left: ["A", "E"] }), upTo: 6 }));
  assert.deepEqual(home.act.map((x) => [x.id, x.from, x.closes]), [["s3", 6, null]]);
  // A change at an episode's start (a swap, Survivor's): its last episode is the one before, known from its research.
  const start = TL.sideTriggers(season({ seven: report(7, P4, { changes: [change("swap", 7, "start")] }), upTo: 7 }));
  assert.deepEqual(start.act[0].closes, { at: 6, episode: 7, ended: "swap" });
});

test("where each side copy plays: once the game has started, from the episode after, until research is sure the grouping changed", () => {
  const s = league(P8);
  // Seen at 6's lock, after 5's research: from 6, playing on.
  assert.deepEqual(spans(plan(s, season({ upTo: 5 }))), [["side@s3", 6, null]], "the game's own stage isn't in the plan: nothing moves it");
  const p = plan(s, season({ upTo: 5 }));
  assert.equal(p.entries[0].side, true);
  assert.equal(p.entries[0].copy, 1);
  // After 7's research: it ends with 7, its points kept.
  assert.deepEqual(spans(plan(s, season(), { open: 8, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, 7]]);
  // Never moving once aired; seen late it starts at the first still open; nothing before the game starts, nor while it waits.
  assert.deepEqual(spans(plan(s, season({ upTo: 5 }), { open: 7 })), [["side@s3", 7, null]]);
  assert.deepEqual(spans(plan(s, season({ upTo: 6 }), { open: 7, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, null]]);
  assert.deepEqual(spans(plan(s, season({ upTo: 5 }), { starts: { solo: 7 } })), [["side@s3", 7, null]], "a game that starts at 7");
  assert.deepEqual(plan(s, season({ upTo: 5 }), { starts: { solo: null } }).entries, [], "the game's start not known yet");
  // Seen so late its grouping had changed before it could play: never made (or taken away).
  const late = plan(s, season(), { open: 8 });
  assert.deepEqual(spans(late), []);
  assert.deepEqual(late.unplayed.map((x) => [x.key, x.trigger.episode]), [["side@s3", 7]]);
  // Past the season's end, or its own.
  assert.deepEqual(plan(s, season({ upTo: 5 }), { last: 5 }).late.map((x) => x.key), ["side@s3"]);
  const own = league({ stages: [SOLO, { ...SIDE, game: { ...SIDE.game, span: { to: 6 } } }] });
  assert.deepEqual(spans(plan(own, season(), { open: 8, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, 6]]);
  assert.deepEqual(plan(own, season({ upTo: 6 }), { open: 7 }).late.map((x) => x.key), ["side@s3"]);
  // Never past the game's own end once it's known (a phase end settled: the server's `end`).
  assert.deepEqual(plan(s, season({ upTo: 5 }), { end: 5 }).late.map((x) => x.key), ["side@s3"]);
  assert.deepEqual(spans(plan(s, season({ upTo: 6 }), { open: 7, copies: { "side@s3": { from: 6 } }, end: 9 })), [["side@s3", 6, 9]]);
  assert.deepEqual(spans(plan(s, season(), { open: 8, copies: { "side@s3": { from: 6 } }, end: 6 })), [["side@s3", 6, 6]]);
  const phased = league({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: { phase: "final" } } } }, SIDE] });
  assert.deepEqual(S.gameOf(phased).stages[1].game.span.to, { phase: "final" }, "a side stage ends where the game's own does: before the final");
  assert.deepEqual(spans(plan(phased, season({ upTo: 6 }), { open: 7, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, { phase: "final" }]]);
  assert.deepEqual(spans(plan(phased, season(), { open: 8, copies: { "side@s3": { from: 6 } }, end: 6 })), [["side@s3", 6, 6]]);
  // Again each time a grouping lasts: P4 from 12.
  assert.deepEqual(spans(plan(s, season({ upTo: 11 }), { open: 12, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, 7], ["side@s9", 12, null]]);
  // Unsure: it plays on, held and said; sure later, it ends where research said so (the side stage carried on until then).
  const unsure = plan(s, season({ split: "low" }), { open: 8, copies: { "side@s3": { from: 6 } } });
  assert.deepEqual(spans(unsure), [["side@s3", 6, null]]);
  assert.deepEqual(unsure.held.map((x) => [x.key, x.trigger.episode]), [["side@s3", 7]]);
  assert.deepEqual(spans(plan(s, season({ split: "low", upTo: 8 }), { open: 9, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, 8]]);
  // Research never sure it held: held, never made.
  const held = league({ stages: [SOLO, { ...SIDE, side: { held: 3 } }] });
  const ph = plan(held, season({ five: report(5, P3, { changes: [change("swap", 7, "end", "low")] }) }), { open: 8 });
  assert.deepEqual(spans(ph), []);
  assert.deepEqual(ph.held.map((x) => [x.key ?? null, x.stage, x.trigger.id]), [[null, "side", "s3"]]);
  // A corrected report: P3 re-drawn at 5's end after all (it never held into 6), the copy taken away; corrected back, it's back.
  assert.deepEqual(spans(plan(s, season({ upTo: 5, five: report(5, P4, { changes: [change("swap", 6)] }) }), { copies: { "side@s3": { from: 6 } } })), []);
  assert.deepEqual(spans(plan(s, season({ upTo: 6 }), { open: 7, copies: {} })), [["side@s3", 7, null]], "back from the first still open");
  // A split corrected away (P3 played on): its end its own again.
  assert.deepEqual(spans(plan(s, season({ seven: report(7, P3) }), { open: 8, copies: { "side@s3": { from: 6 } } })), [["side@s3", 6, null]]);
  // The most copies, then no more.
  const many = { act: Array.from({ length: G.MAX_COPIES + 1 }, (_, i) => ({ id: `s${2 * i + 1}`, kind: "lasted", allNew: false, from: 2 * i + 3, when: "end", episode: 2 * i + 2, what: "", held: 2, closes: { at: 2 * i + 3, episode: 2 * i + 3, ended: "changed" } })), held: [] };
  const pm = StageLogic.changePlan(s, { triggers: { side: many }, starts: { solo: 1 }, copies: {}, open: 3, last: 40 });
  assert.equal(pm.entries.length, G.MAX_COPIES);
  assert.deepEqual(pm.capped.map((x) => x.key), [`side@s${2 * G.MAX_COPIES + 1}`]);
  // Two side stages, each its own; beside a stage a change starts, whose plan is part 2's as it was.
  const two = league({ stages: [SOLO, SIDE, { ...SIDE, id: "quick", name: "Quick", side: { held: 1 } }] });
  const later = plan(two, season({ upTo: 11 }), { open: 12 });
  assert.deepEqual(spans(later), [["side@s9", 12, null], ["quick@s9", 12, null]], "seen at 12: only P4 still plays");
  assert.deepEqual(later.unplayed.map((x) => x.key), ["side@s3", "quick@s1", "quick@s3"]);
  const both = plan(two, season({ upTo: 5 }), { open: 6 });
  assert.deepEqual(spans(both), [["side@s3", 6, null], ["quick@s3", 6, null]]);
  const REDRAFT = { id: "re", name: "New draft", on: { change: ["split-into-individuals"] }, game: { preset: "outlast", get: DRAFT } };
  const chain = league({ stages: [SOLO, REDRAFT, SIDE] });
  const tl = season();
  const pc = StageLogic.changePlan(chain, { triggers: { re: TL.stageTriggers(tl, ["split-into-individuals"]), side: TL.sideTriggers(tl) }, starts: { solo: 1 }, copies: { "side@s3": { from: 6 } }, open: 8, last: 12 });
  assert.deepEqual(spans(pc), [["solo", 1, 7], ["re@7:split-into-individuals", 8, null], ["side@s3", 6, 7]]);
});

test("a side copy with the maker's OK: it waits until its lock, then the game's default; start and skip", () => {
  const maker = league({ ...P8, extras: { changes: { ok: "maker", unanswered: "start" } } });
  const tl = season({ upTo: 5 });
  const p = plan(maker, tl, { open: 6 });
  assert.deepEqual(spans(p), []);
  assert.deepEqual(p.pending.map((x) => [x.key, x.until]), [["side@s3", 6]]);
  assert.deepEqual(p.seen, { "side@s3": 6 });
  // Nobody answered by 6's lock: it opens anyway, from the first still open.
  maker.changeStages = { seen: { "side@s3": 6 }, decided: {}, told: [], undone: [] };
  assert.deepEqual(spans(plan(maker, season({ upTo: 6 }), { open: 7 })), [["side@s3", 7, null]]);
  // With carry-on, it lapses.
  const carry = league({ ...P8, extras: { changes: { ok: "maker", unanswered: "carry-on" } } });
  carry.changeStages = { seen: { "side@s3": 6 }, decided: {}, told: [], undone: [] };
  const pl = plan(carry, season({ upTo: 6 }), { open: 7 });
  assert.deepEqual(spans(pl), []);
  assert.deepEqual(pl.lapsed.map((x) => x.key), ["side@s3"]);
  // The maker says start (from 6), then skip (taken away).
  assert.equal(StageLogic.decide(carry, "side@s3", "start", "ann", null), null);
  carry.changeStages.seen = {};
  assert.deepEqual(spans(plan(carry, tl, { open: 6 })), [["side@s3", 6, null]]);
  assert.equal(StageLogic.decide(carry, "side@s3", "skip", "ann", null), null);
  const ps = plan(carry, tl, { open: 6, copies: { "side@s3": { from: 6 } } });
  assert.deepEqual(spans(ps), []);
  assert.deepEqual(ps.skipped.map((x) => x.key), ["side@s3"]);
  // Seen only once its grouping had changed: nobody is asked about it; past the game's end, nor then.
  const dead = league({ ...P8, extras: { changes: { ok: "maker", unanswered: "start" } } });
  const pd = plan(dead, season(), { open: 8 });
  assert.deepEqual([pd.pending, pd.seen, pd.unplayed.map((x) => x.key)], [[], {}, ["side@s3"]]);
  const pe = plan(dead, season({ upTo: 5 }), { open: 6, end: 5 });
  assert.deepEqual([pe.pending, pe.late.map((x) => x.key)], [[], ["side@s3"]]);
  // A skipped copy whose grouping research isn't sure changed isn't said to play on.
  const sk = league({ ...P8, extras: { changes: { ok: "maker", unanswered: "start" } } });
  assert.equal(StageLogic.decide(sk, "side@s3", "skip", "ann", null), null);
  assert.deepEqual(plan(sk, season({ split: "low" }), { open: 8 }).held, []);
});

/** Each stage league's table after each episode it played, as answer-points.ts stageWalk reads them (game-view.ts gameView, no seat). */
function walkOf(stages) {
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const REF = { leagueId: "", name: "", gameType: "", gameName: "", yourRole: null };
  return {
    stages: stages.map(({ key, state }) => {
      const from = S.startEpisode(state);
      const latest = S.SpoilerLogic.latestWithResults(state);
      const entries = [];
      for (let n = from ?? latest + 1; n <= latest; n++) {
        if (!state.episodes.some((e) => e.number === n && S.episodeHasResults(e))) continue;
        const v = gameView(REF, state, null, n, () => null);
        entries.push({ episode: n, over: v.over, rows: v.table.map((t) => ({ playerId: t.playerId, points: t.total, place: t.place })) });
        if (v.over) break;
      }
      return { key, leagueId: `zt-${key}`, from, to: S.lastEpisode(state), entries };
    }),
  };
}
/** The snake draft run to its end: each turn takes the first castaway still in and free. */
function snake(s) {
  S.forceStartDraft(s);
  for (let guard = 0; guard < 200; guard++) {
    const turn = S.currentDraftTurn(s);
    if (!turn || turn.isComplete) return;
    const free = s.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
    if (!free) return;
    S.draftToCurrentTurn(s, free.id);
  }
}

test("a game with a side stage, through the engine: its copies in the standings and the overall, the game ending with its own stage", () => {
  const spec = { stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 9 } } }, SIDE], overall: { by: "points" } };
  const parent = league(spec);
  const tl = season({ upTo: 11 });
  const p = plan(parent, tl, { open: 12, copies: { "side@s3": { from: 6 } }, last: 12 });
  assert.deepEqual(spans(p), [["side@s3", 6, 7]], "P4 from 12 is past the game's own end, 9: too late");
  assert.deepEqual(p.late.map((x) => x.key), ["side@s9"]);
  const solo = league(S.gameOf(parent).stages[0].game);
  const st = S.gameOf(parent).stages[1];
  const copy = league({ ...G.stageGame(st, 6), span: { from: 6, to: 7 } });
  snake(solo);
  for (const s of [solo, copy, parent]) for (let k = 1; k <= 9; k++) gone(s, k, k - 1);
  assert.ok(!S.DraftLogic.waits(copy), "its draft opened once the episode before it had results");
  snake(copy);
  const walk = walkOf([{ key: "solo", state: solo }, { key: "side@s3", state: copy }]);
  const view = StageLogic.withWalk(parent, walk);
  const stands = StageLogic.standings(view);
  assert.deepEqual(stands.map((x) => [x.key, x.stage, x.copy, x.side, x.from, x.to, x.over]), [
    ["solo", "solo", null, false, 1, 9, true],
    ["side@s3", "side", 1, true, 6, 7, true],
  ]);
  const sum = (key, pid) => stands.find((x) => x.key === key).rows.find((r) => r.playerId === pid).points;
  for (const o of StageLogic.overall(view)) assert.equal(o.points, sum("solo", o.playerId) + sum("side@s3", o.playerId), "its points kept in the overall");
  assert.equal(StageLogic.endsAt(view), 9, "the game ends with its own last stage, not the side copy's 7");
  // Someone behind sees only what they've seen: before 6, no side copy has played.
  assert.deepEqual(StageLogic.standings(StageLogic.withWalk(parent, StageLogic.cutWalk(walk, 5))).map((x) => [x.key, x.started]), [["solo", true], ["side@s3", false]]);
  // By wins, a side copy is a stage like any other once it's over.
  const byWins = league({ ...spec, overall: { by: "wins" } });
  for (let k = 1; k <= 9; k++) gone(byWins, k, k - 1);
  const wins = StageLogic.overall(StageLogic.withWalk(byWins, walk));
  assert.ok(wins.reduce((a, o) => a + o.wins, 0) >= 2, "a win in each (ties all win)");
  assert.ok(wins.every((o) => o.stages.length === 2 && o.stages.every((x) => x.over)));
});
