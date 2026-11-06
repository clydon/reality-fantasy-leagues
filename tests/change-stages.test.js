// A stage a format change starts (docs/PLAN-start-a-game-gpt.md step A12 part 2, the tracker's p7: "automatically start a new draft
// stage whenever there is a major format change such as split into teams or split into individuals"): the spec (a later stage's
// `on`, the game's extras.changes), its words and its round trip through a league's settings; where each copy plays
// (StateLogic.StageLogic.changePlan) from the season's format state over time built from made-up research (format-timeline.js:
// only a change research is sure of moves the game, from the episode it takes effect or the first still open; again at every such
// change; the maker's OK and the game's default by the lock; a corrected report taking a copy away and bringing it back; two in one
// episode; the season's end; the most copies); and the overall over the copies, read as the server reads the stages (game-view.ts
// gameView, no seat, at each episode: answer-points.ts stageWalk). No database: the server's side (change-stages.ts) is
// scripts/dev-test/check-change-stages.js's. Run with `npm test`.
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
  phases: [{ id: "game", name: "The game" }, { id: "final", name: "The final" }],
};
const SEATS = ["ann", "bo", "cy", "di"];
const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const SOLO = { id: "solo", name: "Solo", game: { preset: "outlast", get: DRAFT, span: { from: 1 } } };
const REDRAFT = { id: "re", name: "New draft", on: { again: true }, game: { preset: "outlast", get: DRAFT } };
const P7 = { stages: [SOLO, REDRAFT] };

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

// Made-up research: who is paired with whom at each episode's end, and what the answer says changed (format-timeline.test.js's).
const pair = (...members) => ({ name: null, members });
function report(episode, groups, { changes = [], left = [], playedAs = "pairs" } = {}) {
  return { episode, left, merged: null, state: { playedAs, phase: null, groups, alone: [], newcomers: [], wentHomeAs: left.length ? "individuals" : "nobody", changes } };
}
const change = (kind, from, when = "end", sure = "high") => ({ kind, from, when, what: `${kind} from ${from}`, sure });
const CAST = "ABCDEFGH".split("");
const P1 = [pair("A", "B"), pair("C", "D"), pair("E", "F"), pair("G", "H")];
const P2 = [pair("A", "C"), pair("B", "D"), pair("E", "G"), pair("F", "H")];
const P3 = [pair("A", "E"), pair("B", "F"), pair("C", "G"), pair("D", "H")];
/** A season in pairs: re-paired at 3's end (from 4), everyone on their own from 6 (said at 5's end), paired again from 8. `split`
 *  says how sure the answer is of the split at 5; `upTo` how many episodes have research. */
function season({ split = "high", upTo = 7 } = {}) {
  const all = [
    report(1, P1),
    report(2, P1),
    report(3, P2, { changes: [change("swap", 4)] }),
    report(4, P2),
    report(5, [], { changes: [change("split-into-individuals", 6, "end", split)] }),
    report(6, [], { playedAs: "individuals" }),
    report(7, P3, { playedAs: "individuals", changes: [change("pairs-formed", 8)] }),
  ];
  return TL.buildTimeline(all.filter((r) => r.episode <= upTo), { cast: CAST });
}
/** changePlan's triggers for a game's stages a change starts, from a timeline. */
const triggersOf = (state, tl) => Object.fromEntries(StageLogic.onStages(state).map((st) => [st.id, TL.stageTriggers(tl, G.stageOn(st).change)]));
const plan = (state, tl, more = {}) => StageLogic.changePlan(state, { triggers: triggersOf(state, tl), starts: { solo: 1 }, copies: {}, open: 6, last: 12, ...more });
const spans = (p) => p.entries.map((e) => [e.key, e.from, e.to]);

test("a stage a format change starts: its spec whole, its problems, its waits, its settings and its words", () => {
  const full = G.fullSpec(P7);
  assert.deepEqual(full.stages[1].on, { change: TL.MAJOR, again: true }, "the kinds left out: a major change (F3's MAJOR)");
  assert.equal(full.stages[1].game.span.from, null, "each copy starts where its change takes effect");
  assert.equal(full.stages[0].game.span.to, null, "the stage before runs on until then");
  assert.equal(full.stages[1].game.extras.draft.opens, "start", "a later stage's draft opens at its start");
  assert.deepEqual(full.extras.changes, G.CHANGES);
  assert.deepEqual(G.CHANGES, { ok: "auto", unanswered: "start" });
  assert.equal(G.playsAs(full), "stages");
  assert.deepEqual(G.specProblems(P7, CTX), []);
  assert.deepEqual(G.specWaitsFor(P7), []);
  assert.deepEqual(G.fullSpec({ stages: [SOLO, { ...REDRAFT, on: {} }] }).stages[1].on, { change: TL.MAJOR, again: false }, "once by default");
  // Its problems.
  const problems = (spec) => G.specProblems(spec, CTX).map((p) => p.at);
  assert.deepEqual(problems({ stages: [{ ...SOLO, on: {} }, REDRAFT] }), ["stages[0].on", "stages[0].game.span.from"], "the first stage starts where the game does");
  assert.deepEqual(problems({ stages: [SOLO, { ...REDRAFT, on: { change: ["twist"] } }] }), ["stages[1].on.change"], "a twist never starts one");
  assert.deepEqual(problems({ stages: [SOLO, { ...REDRAFT, on: { change: ["merge", "merge"] } }] }), ["stages[1].on.change"]);
  assert.deepEqual(problems({ stages: [SOLO, { ...REDRAFT, on: { again: "yes", when: 1 } }] }), ["stages[1].on.when", "stages[1].on.again"]);
  assert.deepEqual(problems({ stages: [SOLO, { ...REDRAFT, game: { ...REDRAFT.game, span: { from: 5 } } }] }), ["stages[1].game.span.from"], "its start is its change's");
  assert.deepEqual(problems({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: 5 } } }, REDRAFT] }), ["stages[0].game.span.to"], "the stage before ends where it starts");
  assert.deepEqual(problems({ ...P7, extras: { changes: { ok: "never", unanswered: "maybe", by: 1 } } }), ["extras.changes.by", "extras.changes.ok", "extras.changes.unanswered"]);
  assert.deepEqual(problems({ stages: [SOLO, { ...SOLO, id: "two", game: { ...SOLO.game, span: { from: 7 } } }], extras: { changes: { ok: "auto" } } }), ["extras.changes"], "only a game a change moves");
  assert.deepEqual(problems({ preset: "outlast", extras: { changes: { ok: "auto" } } }), ["extras.changes"]);
  // What waits: the players' vote (A14), a stage at a phase after one a change starts (later parts).
  assert.deepEqual(G.specWaitsFor({ ...P7, extras: { changes: { ok: "vote" } } }).map((w) => [w.at, w.step]), [["extras.changes.ok", "later"]]);
  const after = { stages: [SOLO, REDRAFT, { id: "fin", name: "Final", game: { preset: "outlast", get: DRAFT, span: { from: { phase: "final" } } } }] };
  assert.deepEqual(G.specWaitsFor(after).map((w) => [w.at, w.step]), [["stages[2].game.span.from", "later"]]);
  // A stage a change starts after another (pairs, then on their own again) plays.
  const two = { stages: [SOLO, { ...REDRAFT, id: "pairs", on: { change: ["pairs-formed"] } }, { ...REDRAFT, id: "alone", on: { change: ["split-into-individuals"] } }] };
  assert.deepEqual(G.specProblems(two, CTX), []);
  assert.equal(G.playsAs(G.fullSpec(two)), "stages");
  // Its settings, both ways.
  const maker = { ...P7, extras: { changes: { ok: "maker", unanswered: "carry-on" } } };
  const st = G.settingsOf(maker);
  assert.deepEqual(st.formatChanges, { ok: "maker", unanswered: "carry-on" });
  assert.deepEqual(G.settingsOf(P7).formatChanges, G.CHANGES);
  assert.equal(G.settingsOf({ stages: [SOLO, { ...SOLO, id: "two", game: { ...SOLO.game, span: { from: 7 } } }] }).formatChanges, undefined);
  assert.ok(G.sameValue(G.fullSpec(G.specOf({ ...st, showId: "the-challenge" })), G.fullSpec(maker)), "the round trip");
  // Its words.
  const d = G.describeSpec(P7, CTX);
  assert.match(d.sentence, /Solo, an Outlast: everyone drafts 2, until the format changes\./);
  assert.match(d.sentence, /New draft, an Outlast: everyone drafts 2, from each major change of format\./);
  assert.ok(d.rules.includes("The new stage starts by itself; whoever runs the game can call it off."));
  const words = G.describeSpec({ ...two, extras: { changes: { ok: "maker", unanswered: "carry-on" } } }, CTX);
  assert.match(words.sentence, /from the first time pairs form\..*from the first time everyone goes on alone\./);
  assert.ok(words.rules.includes("Whoever runs the game says whether a new stage starts; if nobody does by its first episode, the game carries on as it is."));
  // A stage a change starts with an end of its own says it.
  assert.match(G.describeSpec({ stages: [SOLO, { ...REDRAFT, on: {}, game: { ...REDRAFT.game, span: { to: 12 } } }] }, CTX).sentence, /from the first major change of format to Episode 12\./);
});

test("where each copy plays: a change research is sure of, from where it takes effect or the next still open, again at each one", () => {
  const s = league(P7);
  // Episode 3's research (at 4's lock): every pair re-drawn from 4, a major change ('swap-all'): a copy from 4.
  assert.deepEqual(spans(plan(s, season({ upTo: 3 }), { open: 4 })), [["solo", 1, 3], ["re@3:swap", 4, null]]);
  // Episode 5's research (at 6's lock): the split from 6, a second copy; the first ends with 5.
  const tl = season({ upTo: 5 });
  const p = plan(s, tl, { copies: { "re@3:swap": { from: 4 } } });
  assert.deepEqual(spans(p), [["solo", 1, 3], ["re@3:swap", 4, 5], ["re@5:split-into-individuals", 6, null]], "every major change after the first stage started");
  assert.deepEqual(p.entries.map((e) => e.copy), [null, 1, 2]);
  // Only a split and pairs forming count: the swap doesn't start one.
  const only = league({ stages: [SOLO, { ...REDRAFT, on: { change: ["split-into-individuals", "pairs-formed"], again: true } }] });
  assert.deepEqual(spans(plan(only, tl)), [["solo", 1, 5], ["re@5:split-into-individuals", 6, null]]);
  // Once: the first only.
  const once = league({ stages: [SOLO, { ...REDRAFT, on: { change: ["split-into-individuals", "pairs-formed"] } }] });
  const split6 = { "re@5:split-into-individuals": { from: 6 } };
  assert.deepEqual(spans(plan(once, season(), { open: 8, copies: split6 })), [["solo", 1, 5], ["re@5:split-into-individuals", 6, null]]);
  assert.deepEqual(spans(plan(only, season(), { open: 8, copies: split6 })), [["solo", 1, 5], ["re@5:split-into-individuals", 6, 7], ["re@7:pairs-formed", 8, null]]);
  // Seen late (its research came after 6 aired): from the first episode still open, never before.
  assert.deepEqual(spans(plan(only, tl, { open: 7 })), [["solo", 1, 6], ["re@5:split-into-individuals", 7, null]]);
  // Once made and aired, a copy never moves.
  assert.deepEqual(spans(plan(only, tl, { open: 9, copies: { "re@5:split-into-individuals": { from: 7 } } })), [["solo", 1, 6], ["re@5:split-into-individuals", 7, null]]);
  // Unsure: held, flagged, never acted on; the first stage plays on.
  const unsure = plan(only, season({ split: "low", upTo: 5 }));
  assert.deepEqual(spans(unsure), [["solo", 1, null]]);
  assert.deepEqual(unsure.held.map((x) => [x.stage, x.trigger.kind, x.trigger.from]), [["re", "split-into-individuals", 6]]);
  // Nothing before the first stage's start counts, nor anything while it waits.
  assert.deepEqual(spans(plan(only, tl, { starts: { solo: 6 } })), [["solo", 6, null]]);
  assert.deepEqual(spans(plan(only, tl, { starts: { solo: null } })), [["solo", null, null]]);
  // Past the season's end: never.
  const late = plan(only, tl, { open: 7, last: 6 });
  assert.deepEqual(spans(late), [["solo", 1, null]]);
  assert.deepEqual(late.late.map((x) => x.key), ["re@5:split-into-individuals"]);
});

test("the plan's edge cases: two in one episode, two still to come at once, the most copies, two stages a change starts", () => {
  // Two changes in one episode (the swap and the split both said at 5's end, from 6): one copy.
  const both = [report(1, P1), report(2, P1), report(5, [], { changes: [change("swap", 6), change("split-into-individuals", 6)] })];
  const s = league(P7);
  const tl2 = TL.buildTimeline([...both.slice(0, 2), report(3, P1), report(4, P1), both[2]], { cast: CAST });
  const kinds = TL.stageTriggers(tl2).act.map((t) => t.kind);
  assert.ok(kinds.includes("split-into-individuals"), kinds.join());
  assert.deepEqual(spans(plan(s, tl2)).length, 2, "one copy for the episode, whichever kinds");
  // Two still to come that both land on the first episode still open (both seen late): the later change is the format now.
  const only = league({ stages: [SOLO, { ...REDRAFT, on: { change: ["split-into-individuals", "pairs-formed"], again: true } }] });
  const p = plan(only, season(), { open: 9 });
  assert.deepEqual(spans(p), [["solo", 1, 8], ["re@7:pairs-formed", 9, null]]);
  assert.deepEqual(p.superseded.map((x) => [x.key, x.by]), [["re@5:split-into-individuals", "re@7:pairs-formed"]]);
  // The most copies: past them, the last plays on.
  const many = [];
  for (let k = 1; k <= 30; k++) many.push(report(k, k % 2 ? P1 : P2, { changes: k > 1 ? [change("swap", k + 1)] : [] }));
  const tl3 = TL.buildTimeline(many, { cast: CAST });
  const swaps = league({ stages: [SOLO, { ...REDRAFT, on: { change: ["swap"], again: true } }] });
  const big = plan(swaps, tl3, { open: 32, last: 40, copies: Object.fromEntries(TL.stageTriggers(tl3, ["swap"]).act.map((t) => [`re@${t.id}`, { from: t.from }])) });
  assert.equal(big.entries.filter((e) => e.copy).length, G.MAX_COPIES);
  assert.ok(big.capped.length > 0);
  // Two stages a change starts: the pairs' copies end where everyone goes on alone.
  const two = league({ stages: [SOLO, { ...REDRAFT, id: "pairs", on: { change: ["swap", "pairs-formed"], again: true } }, { ...REDRAFT, id: "alone", on: { change: ["split-into-individuals"] } }] });
  const tp = StageLogic.changePlan(two, { triggers: triggersOf(two, season()), starts: { solo: 1 }, copies: {}, open: 4, last: 12 });
  assert.deepEqual(spans(tp), [["solo", 1, 3], ["pairs@3:swap", 4, 5], ["alone@5:split-into-individuals", 6, null]], "pairs forming at 8 comes after the next stage began");
  // The stage right before hasn't started (its phase not known yet): nothing starts on a change, whatever started before it.
  const phased = league({ stages: [{ ...SOLO, game: { ...SOLO.game, span: { from: 1, to: { phase: "final" } } } }, { id: "fin", name: "Final", game: { preset: "outlast", get: DRAFT, span: { from: { phase: "final" } } } }, { ...REDRAFT, on: { change: ["split-into-individuals"] } }] });
  assert.deepEqual(spans(StageLogic.changePlan(phased, { triggers: triggersOf(phased, season()), starts: { solo: 1, fin: null }, copies: {}, open: 8, last: 12 })), [["solo", 1, undefined], ["fin", null, null]]);
});

test("with the maker's OK: a change waits until its lock, then the game's default; skip and start; a corrected report undone and back", () => {
  const maker = (unanswered) => league({ stages: [SOLO, { ...REDRAFT, on: { change: ["split-into-individuals", "pairs-formed"], again: true } }], extras: { changes: { ok: "maker", unanswered } } });
  const tl = season({ upTo: 5 });
  const s = maker("carry-on");
  // Seen at 6's lock: it waits for the maker until 6 starts.
  const p = plan(s, tl);
  assert.deepEqual(spans(p), [["solo", 1, null]]);
  assert.deepEqual(p.pending.map((x) => [x.key, x.until]), [["re@5:split-into-individuals", 6]]);
  assert.deepEqual(p.seen, { "re@5:split-into-individuals": 6 });
  s.changeStages = { seen: p.seen };
  // Nobody answered by then: carry on (the game's default here) ...
  const lapsed = plan(s, tl, { open: 7 });
  assert.deepEqual(spans(lapsed), [["solo", 1, null]]);
  assert.deepEqual(lapsed.lapsed.map((x) => x.key), ["re@5:split-into-individuals"]);
  assert.deepEqual(lapsed.seen, {}, "seen once");
  // ... or start, from the first episode still open.
  const t = maker("start");
  t.changeStages = { seen: p.seen };
  assert.deepEqual(spans(plan(t, tl, { open: 7 })), [["solo", 1, 6], ["re@5:split-into-individuals", 7, null]]);
  // Seen late (a corrected report at 9): the maker has until 9's lock.
  const u = maker("carry-on");
  assert.deepEqual(plan(u, tl, { open: 9 }).pending.map((x) => x.until), [9]);
  // The maker's answers: start (before the lock: from 6) ...
  assert.equal(StageLogic.decide(s, "re@5:split-into-individuals", "start", "maker", "2026-10-30T00:00:00Z"), null);
  assert.deepEqual(spans(plan(s, tl)), [["solo", 1, 5], ["re@5:split-into-individuals", 6, null]]);
  // ... or skip: never started, and a started one taken away.
  assert.equal(StageLogic.decide(s, "re@5:split-into-individuals", "skip", "maker"), null);
  const skipped = plan(s, tl, { copies: { "re@5:split-into-individuals": { from: 6 } }, open: 8 });
  assert.deepEqual(spans(skipped), [["solo", 1, null]]);
  assert.deepEqual(skipped.skipped.map((x) => x.key), ["re@5:split-into-individuals"]);
  assert.equal(StageLogic.decide(s, "re@5:split-into-individuals", "maybe"), "Say 'start' or 'skip'");
  assert.equal(StageLogic.decide(s, "other@5:merge", "start"), "That isn't one of this game's format changes");
  // A corrected report: research no longer says the split, so its copy isn't in the plan (the server takes it away) and the first
  // stage plays on; said again, it's back where it was.
  const auto = league(P7);
  const made = { "re@5:split-into-individuals": { from: 6 } };
  const was = TL.buildTimeline([report(1, P1), report(2, P1), report(3, P1), report(4, P1), report(5, [], { changes: [change("split-into-individuals", 6)] })], { cast: CAST });
  assert.deepEqual(spans(plan(auto, was, { copies: made, open: 8 })), [["solo", 1, 5], ["re@5:split-into-individuals", 6, null]]);
  const corrected = TL.buildTimeline([report(1, P1), report(2, P1), report(3, P1), report(4, P1), report(5, P1)], { cast: CAST });
  assert.deepEqual(spans(plan(auto, corrected, { copies: made, open: 8 })), [["solo", 1, null]]);
  assert.deepEqual(TL.timelineDiff(was, corrected).changes.gone, ["5:split-into-individuals"], "what moved: the change its copy started on");
  assert.deepEqual(spans(plan(auto, was, { copies: {}, open: 8 })), [["solo", 1, 7], ["re@5:split-into-individuals", 8, null]], "back, taken from the first episode still open when nothing of it is left");
});

/** A game in stages' walk as the server reads it (answer-points.ts stageWalk): each stage's table, no seat, after each episode. */
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

test("a game a format change moved, through the engine: the copies in the standings and the overall, each where the plan put it", () => {
  const spec = { stages: [SOLO, { ...REDRAFT, on: { change: ["split-into-individuals", "pairs-formed"], again: true } }], overall: { by: "points" } };
  const parent = league(spec);
  const tl = season();
  const p = plan(parent, tl, { open: 6, last: 12 });
  // Each stage a league of its own, made where the plan says (the copies with their start; the first stage's end the plan's).
  const stageState = (st, e) => {
    const g = G.stageGame(st, e.from);
    return league({ ...g, span: { from: e.from, to: e.to } });
  };
  const solo = stageState(SOLO, { from: 1, to: 5 });
  const copy1 = stageState(spec.stages[1], p.entries[1]);
  snake(solo);
  // Everyone gets the season's results; a stage counts only its own episodes.
  const all = [solo, copy1];
  for (const s of all) for (let k = 1; k <= 7; k++) gone(s, k, k - 1);
  assert.ok(!S.DraftLogic.waits(copy1), "its draft opened once the episode before it had results");
  snake(copy1);
  // Seen at 8's lock: pairs from 8, a second copy; the first copy ends with 7.
  const p8 = plan(parent, tl, { open: 8, copies: { [p.entries[1].key]: { from: 6 } } });
  assert.deepEqual(spans(p8), [["solo", 1, 5], ["re@5:split-into-individuals", 6, 7], ["re@7:pairs-formed", 8, null]]);
  assert.deepEqual(S.setGame(copy1, { ...S.gameOf(copy1), span: { from: 6, to: 7 } }), []);
  const copy2 = stageState(spec.stages[1], p8.entries[2]);
  for (let k = 1; k <= 7; k++) gone(copy2, k, k - 1);
  snake(copy2);
  for (const s of [solo, copy1, copy2, parent]) gone(s, 8, 7);
  for (let k = 1; k <= 8; k++) if (!S.episodeHasResults(ep(parent, k))) gone(parent, k, k - 1);
  const walk = walkOf([{ key: "solo", state: solo }, { key: p8.entries[1].key, state: copy1 }, { key: p8.entries[2].key, state: copy2 }]);
  const view = StageLogic.withWalk(parent, walk);
  const st = StageLogic.standings(view);
  assert.deepEqual(st.map((x) => [x.key, x.stage, x.copy, x.from, x.to, x.over]), [
    ["solo", "solo", null, 1, 5, true],
    ["re@5:split-into-individuals", "re", 1, 6, 7, true],
    ["re@7:pairs-formed", "re", 2, 8, null, false],
  ]);
  // The overall adds each stage's points as its table shows them.
  const sum = (key, pid) => st.find((x) => x.key === key).rows.find((r) => r.playerId === pid).points;
  for (const o of StageLogic.overall(view)) assert.equal(o.points, sum("solo", o.playerId) + sum("re@5:split-into-individuals", o.playerId) + sum("re@7:pairs-formed", o.playerId));
  assert.equal(StageLogic.endsAt(view), null, "the last copy plays on");
  // Someone behind sees only the stages they've seen.
  assert.deepEqual(StageLogic.standings(StageLogic.withWalk(parent, StageLogic.cutWalk(walk, 5))).map((x) => [x.key, x.started]), [["solo", true], ["re@5:split-into-individuals", false], ["re@7:pairs-formed", false]]);
});
