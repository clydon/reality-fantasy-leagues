// Mini-games and two ways of scoring (docs/PLAN-start-a-game-gpt.md step A12 part 4a, the tracker's shape.minis and shape.twoWays): a
// stage of bingo or Weekly Calls (scored outside the game: its table the server's own counts, answer-points.ts stageWalk's
// outsideCounts, handed to the engine as a table at each episode), a season of mini-games one after another, and a stage `alongside:
// true` that plays at the same time as the game's own stages (bingo lines plus answers); its spec whole, its problems, its words and its
// round trip through a league's settings; part 2's plan beside it; and the overall over both, read as the server reads the stages
// (game-view.ts gameView, no seat, the counts handed in as GameCalls), the game ending with its own last stage. No database: the server's
// side is scripts/dev-test/check-mini-stages.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });

const { StageLogic } = S;
const CTX = {
  show: "Survivor 51",
  moments: [{ id: "individualImmunity", label: "Won individual immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  phases: [{ id: "tribes", name: "Tribes" }, { id: "merged", name: "Merged" }],
};
const SEATS = ["ann", "bo", "cy", "di"];
const BINGO = { id: "bingo", name: "Bingo", game: { preset: "weekly-bingo", score: { by: "lines", points: 5 }, span: { from: 1, to: 9 } } };
const CALLS = { id: "calls", name: "Calls", alongside: true, game: { preset: "weekly-calls" } };
const TWO_WAYS = { stages: [BINGO, CALLS], overall: { by: "points" } };
const ats = (spec, ctx = CTX) => G.specProblems(spec, ctx).map((p) => p.at);

/** A league of `n` castaways C0.. and seats `people`, made as its game is (Spec.madeAs), its game `spec` through setGame, Episodes 1 to
 *  `eps` made, none with results. */
function league(spec, { n = 16, people = SEATS, eps = 12 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  const kind = G.typeOf(spec);
  if (kind !== "stages") S.updateSettings(s, "leagueTypeId", G.madeAs(kind));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const gone = (s, k, i) => S.addElimination(s, ep(s, k).id, s.castaways[i].id, "Eliminated");

/**
 * The stages' walk as the server builds it (answer-points.ts stageWalk): each stage's table after each episode it played with results,
 * as anyone on its couch sees it at that mark. A stage scored outside the game is handed its counts (`counts[key](n, playerId)`, its
 * points through n, as outsideCounts adds up each seat's lines or right calls), over once its last episode is within n.
 */
function walkOf(stages, counts = {}) {
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const REF = { leagueId: "", name: "", gameType: "", gameName: "", yourRole: null };
  return {
    stages: stages.map(({ key, state }) => {
      const from = S.startEpisode(state);
      const end = S.endEpisode(state);
      const latest = S.SpoilerLogic.latestWithResults(state);
      const entries = [];
      for (let n = from ?? latest + 1; n <= latest; n++) {
        if (!state.episodes.some((e) => e.number === n && S.episodeHasResults(e))) continue;
        const calls = counts[key] ? { right: (p) => counts[key](n, p), move: null, through: n, ended: end !== null && n >= end } : undefined;
        const v = gameView(REF, state, null, n, () => null, calls);
        entries.push({ episode: n, over: v.over, rows: v.table.map((t) => ({ playerId: t.playerId, points: t.total, place: t.place })) });
        if (v.over) break;
      }
      return { key, leagueId: `zt-${key}`, from, to: S.lastEpisode(state), entries };
    }),
  };
}

test("stages of bingo and Weekly Calls, and a season of mini-games one after another: whole, their words and their settings", () => {
  const minis = {
    stages: [
      { id: "bingo", name: "Bingo", game: { preset: "weekly-bingo", span: { from: 1, to: 4 } } },
      { id: "draft", name: "Draft", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, span: { from: 5, to: 8 } } },
      { id: "calls", name: "Calls", game: { preset: "weekly-calls", span: { from: 9 } } },
    ],
  };
  assert.deepEqual(ats(minis), []);
  assert.deepEqual(G.specWaitsFor(minis), [], "a stage scored outside the game plays since part 4a");
  assert.equal(G.typeOf(minis), "stages");
  const full = G.fullSpec(minis);
  assert.deepEqual(full.stages.map((x) => [x.id, G.typeOf(x.game), x.game.span.from, x.game.span.to]), [["bingo", "weekly-bingo", 1, 4], ["draft", "classic-draft", 5, 8], ["calls", "weekly-calls", 9, null]]);
  assert.equal(full.stages[1].game.extras.draft.opens, "start", "the draft the next week drafts from who's still in then");
  assert.equal(G.mainCount(full.stages), 3, "every stage the game's own");
  const d = describeSpec(minis, { show: "Survivor 51" });
  assert.match(d.sentence, /^A game in three stages for Survivor 51: Bingo, a Weekly Bingo: .*; then Draft, an Outlast: .*; then Calls, a Weekly Calls: /);
  // Its round trip through a league's settings.
  const s = league(minis);
  assert.equal(s.settings.leagueTypeId, "stages");
  assert.ok(G.sameValue(S.gameOf(s).stages.map((x) => x.id), ["bingo", "draft", "calls"]));
  // Each stage's own league plays it alone.
  for (const st of S.gameOf(s).stages) {
    const own = league(G.stageLeagueGame(st));
    assert.equal(own.settings.leagueTypeId, G.madeAs(G.typeOf(st.game)));
  }
  // A Weekly Calls stage between two others, and a bingo stage at a phase.
  assert.deepEqual(ats({ stages: [{ id: "a", game: { preset: "weekly-lineup", span: { from: 1, to: { phase: "merged" } } } }, { id: "b", game: { preset: "weekly-bingo", span: { from: { phase: "merged" } } } }] }), []);
});

test("a stage alongside the game's own: at the same time, after them, inside the game's span; its problems and its words", () => {
  assert.deepEqual(ats(TWO_WAYS), []);
  assert.deepEqual(G.specWaitsFor(TWO_WAYS), []);
  assert.equal(G.typeOf(TWO_WAYS), "stages");
  const full = G.fullSpec(TWO_WAYS);
  assert.deepEqual(full.stages.map((x) => [x.id, x.game.span.from, x.game.span.to]), [["bingo", 1, 9], ["calls", 1, 9]], "the game's span unless it says");
  assert.ok(G.sameValue(full.span, { from: 1, to: 9 }), "the game's span is its own stages'");
  assert.equal(G.mainCount(full.stages), 1);
  assert.ok(G.isBeside(full.stages[1]) && G.stageAlongside(full.stages[1]) === true && !G.stageSide(full.stages[1]));
  assert.ok(!G.fallsTo(full.stages, 1), "nothing chains through it");
  // Its own span, inside the game's.
  const withSpan = (span) => ({ ...TWO_WAYS, stages: [BINGO, { ...CALLS, game: { ...CALLS.game, span } }] });
  assert.deepEqual(ats(withSpan({ from: 4, to: 6 })), []);
  assert.deepEqual(ats(withSpan({ from: 4 })), [], "from 4 to the game's end");
  assert.ok(G.sameValue(G.fullSpec(withSpan({ from: 4 })).stages[1].game.span, { from: 4, to: 9 }));
  assert.deepEqual(ats({ ...TWO_WAYS, stages: [{ ...BINGO, game: { ...BINGO.game, span: { from: 3, to: 9 } } }, { ...CALLS, game: { ...CALLS.game, span: { from: 2 } } }] }), ["stages[1].game.span.from"], "before the game starts");
  assert.deepEqual(ats(withSpan({ to: 10 })), ["stages[1].game.span.to"], "past the game's end");
  assert.deepEqual(ats(withSpan({ to: null })), ["stages[1].game.span.to"], "the season's end, past the game's");
  // A game that ends before a phase: the same phase, or an episode (told once the phase is known).
  const toMerge = { ...BINGO, game: { ...BINGO.game, span: { from: 1, to: { phase: "merged" } } } };
  const atPhase = (span) => ({ stages: [toMerge, { ...CALLS, game: { ...CALLS.game, span } }] });
  assert.deepEqual(ats(atPhase({ to: { phase: "merged" } })), []);
  assert.deepEqual(ats(atPhase({ to: 5 })), []);
  assert.deepEqual(ats(atPhase({ to: null })), ["stages[1].game.span.to"]);
  assert.ok(G.sameValue(G.fullSpec(atPhase({})).stages[1].game.span.to, { phase: "merged" }), "it ends where the game does");
  // Its problems: never the first, only true, never with on or side, never before one of the game's own.
  assert.deepEqual(ats({ stages: [{ ...BINGO, alongside: true }, CALLS] }), ["stages[0].alongside"]);
  assert.deepEqual(ats({ stages: [BINGO, { ...CALLS, alongside: "yes" }] }), ["stages[1].alongside"]);
  assert.deepEqual(ats({ stages: [BINGO, { ...CALLS, side: {} }] }), ["stages[1].alongside"]);
  assert.deepEqual(ats({ stages: [BINGO, { ...CALLS, on: {} }] }), ["stages[1].on"]);
  assert.deepEqual(ats({ stages: [BINGO, CALLS, { id: "late", game: { preset: "weekly-lineup", span: { from: 10 } } }] }), ["stages[2]"], "the game's own stages come first");
  // The game's own stages one after another: an overlap refused, with what to do.
  const overlap = { stages: [BINGO, { id: "c2", game: { preset: "weekly-calls", span: { from: 5 } } }] };
  assert.deepEqual(ats(overlap), ["stages[1].game.span.from"]);
  assert.match(G.specProblems(overlap, CTX)[0].problem, /alongside: true/);
  // Its words.
  const d = describeSpec(TWO_WAYS, { show: "Survivor 51" });
  assert.match(d.sentence, /^A game in two stages for Survivor 51: Bingo, a Weekly Bingo: .*; and beside it, Calls, a Weekly Calls: /);
  assert.ok(d.rules.includes("Calls: it plays at the same time as Bingo, its points counting in the overall with Bingo's."));
  // Its round trip.
  const s = league(TWO_WAYS);
  assert.ok(G.sameValue(S.gameOf(s).stages.map((x) => [x.id, x.alongside ?? null]), [["bingo", null], ["calls", true]]));
});

test("a stage alongside beside a stage a format change starts: part 2's plan copies only that stage, and nothing waits", () => {
  const draft = { by: "draft", each: 2, order: "snake", own: "exclusive" };
  const spec = {
    stages: [
      { id: "solo", name: "Draft", game: { preset: "outlast", get: draft, span: { from: 1 } } },
      { id: "redraft", name: "New draft", on: { again: true }, game: { preset: "outlast", get: draft } },
      { id: "bingo", name: "Bingo", alongside: true, game: { preset: "weekly-bingo" } },
    ],
  };
  assert.deepEqual(ats(spec), []);
  assert.deepEqual(G.specWaitsFor(spec), [], "a stage alongside isn't a stage at an episode after one a change starts");
  const s = league(spec);
  const trig = (id, from) => ({ id, kind: "teams-formed", allNew: true, from, when: "end", episode: from - 1, what: "" });
  const p = StageLogic.changePlan(s, { triggers: { redraft: { act: [trig("c4", 4), trig("c7", 7)], held: [] } }, starts: { solo: 1 }, copies: {}, open: 3, last: 12 });
  assert.deepEqual(p.entries.map((e) => [e.key, e.from, e.to]), [["solo", 1, 3], ["redraft@c4", 4, 6], ["redraft@c7", 7, null]], "the stage alongside is never a copy");
  assert.ok(StageLogic.onStages(s).every((x) => x.id === "redraft"));
});

test("two ways of scoring through the engine: bingo lines and calls at the same time, the overall adding them up at each mark", () => {
  const parent = league(TWO_WAYS);
  const games = S.gameOf(parent).stages;
  const bingo = league(G.stageLeagueGame(games[0]));
  const calls = league(G.stageLeagueGame(games[1]));
  assert.equal(bingo.settings.leagueTypeId, "weekly-bingo");
  assert.equal(calls.settings.leagueTypeId, "weekly-calls");
  for (const s of [bingo, calls, parent]) for (let k = 1; k <= 9; k++) gone(s, k, k - 1);
  // Made-up counts: ann a line every other episode (5 points each), bo one in Episode 3; cy a right call every episode, ann one in 2.
  const lines = { ann: (n) => Math.floor(n / 2), bo: (n) => (n >= 3 ? 1 : 0) };
  const right = { cy: (n) => n, ann: (n) => (n >= 2 ? 1 : 0) };
  const counts = { bingo: (n, p) => (lines[p] ? lines[p](n) : 0) * 5, calls: (n, p) => (right[p] ? right[p](n) : 0) };
  const walk = walkOf([{ key: "bingo", state: bingo }, { key: "calls", state: calls }], counts);
  const view = StageLogic.withWalk(parent, walk);
  const stands = StageLogic.standings(view);
  assert.deepEqual(stands.map((x) => [x.key, x.alongside, x.side, x.from, x.to, x.over]), [["bingo", false, false, 1, 9, true], ["calls", true, false, 1, 9, true]]);
  const over = Object.fromEntries(StageLogic.overall(view).map((o) => [o.playerId, o.points]));
  assert.deepEqual(over, { ann: 4 * 5 + 1, bo: 5, cy: 9, di: 0 }, "each one's lines at 5 a line plus their right calls");
  assert.equal(StageLogic.endsAt(view), 9, "the game ends with its own last stage");
  // At a viewer's mark: someone through 4 sees each stage through 4.
  const at4 = Object.fromEntries(StageLogic.overall(StageLogic.withWalk(parent, StageLogic.cutWalk(walk, 4))).map((o) => [o.playerId, o.points]));
  assert.deepEqual(at4, { ann: 2 * 5 + 1, bo: 5, cy: 4, di: 0 });
  // The engine's own table for the game is the overall.
  const table = S.computeScores(view).map((r) => [r.playerId, r.total]);
  assert.deepEqual(table, [["ann", 21], ["cy", 9], ["bo", 5], ["di", 0]]);
  // By places: each stage's place once it's over (bingo: ann, bo, then cy and di level; calls: cy, ann, then bo and di level).
  const places = league({ ...TWO_WAYS, overall: { by: "places" } });
  for (let k = 1; k <= 9; k++) gone(places, k, k - 1);
  const pts = Object.fromEntries(StageLogic.overall(StageLogic.withWalk(places, walk)).map((o) => [o.playerId, o.overall]));
  assert.deepEqual(pts, { ann: 4 + 3, bo: 3 + 2, cy: 2 + 4, di: 2 + 2 });
  // A stage alongside that ends earlier: the game still ends with its own, and isn't over until both are.
  const early = league({ ...TWO_WAYS, stages: [BINGO, { ...CALLS, game: { ...CALLS.game, span: { from: 1, to: 5 } } }] });
  const calls5 = league(G.stageLeagueGame(S.gameOf(early).stages[1]));
  for (const s of [early, calls5]) for (let k = 1; k <= 9; k++) gone(s, k, k - 1);
  const w2 = walkOf([{ key: "bingo", state: bingo }, { key: "calls", state: calls5 }], counts);
  const v2 = StageLogic.withWalk(early, w2);
  assert.deepEqual(StageLogic.standings(v2).map((x) => [x.key, x.to, x.over]), [["bingo", 9, true], ["calls", 5, true]]);
  assert.equal(StageLogic.endsAt(v2), 9);
  assert.equal(Object.fromEntries(StageLogic.overall(v2).map((o) => [o.playerId, o.points])).cy, 5, "its calls through 5 only");
  const at7 = StageLogic.withWalk(early, walkOf([{ key: "bingo", state: bingo }, { key: "calls", state: calls5 }], counts));
  assert.ok(StageLogic.over(at7));
});

test("a stage beside the game's own when the game ends early, one counted as episodes air, and a stage alongside that starts too late", () => {
  const parent = league({ ...TWO_WAYS, overall: { by: "places" } });
  for (let k = 1; k <= 7; k++) gone(parent, k, k - 1);
  const rows = (pts) => Object.entries(pts).map(([playerId, points], i) => ({ playerId, points, place: i + 1 }));
  const entry = (episode, over, pts) => ({ episode, over, rows: rows(pts) });
  // Bingo, the game's own, ended early at 6 (as a race won would); Calls alongside it went on to 7, not over there.
  const walk = {
    stages: [
      { key: "bingo", leagueId: "zt-b", from: 1, to: 6, outside: true, entries: [entry(5, false, { ann: 10, bo: 5, cy: 0, di: 0 }), entry(6, true, { ann: 15, bo: 5, cy: 0, di: 0 })] },
      { key: "calls", leagueId: "zt-c", from: 1, to: 9, outside: true, entries: [entry(6, false, { cy: 6, ann: 2, bo: 1, di: 0 }), entry(7, false, { bo: 9, cy: 6, ann: 2, di: 0 })] },
    ],
  };
  const view = StageLogic.withWalk(parent, walk);
  const st = StageLogic.standings(view);
  assert.deepEqual(st.map((x) => [x.key, x.over, x.rows[0].playerId]), [["bingo", true, "ann"], ["calls", true, "cy"]], "Calls counts as it stood at 6, the game's end, and is over there");
  assert.equal(StageLogic.endsAt(view), 6);
  const by = Object.fromEntries(StageLogic.overall(view).map((o) => [o.playerId, o.overall]));
  assert.deepEqual(by, { ann: 4 + 3, bo: 3 + 2, cy: 2 + 4, di: 1 + 1 }, "both stages' places count");
  // A stage scored outside the game counts an episode once it has aired, results or not (a talk show's); a draft's waits for results.
  const aired = league(TWO_WAYS);
  for (let k = 1; k <= 5; k++) gone(aired, k, k - 1);
  const past = new Date(Date.now() - 86400000).toISOString();
  for (const k of [6, 7]) ep(aired, k).airsAt = past;
  const w2 = { stages: [{ ...walk.stages[0], to: 9, entries: [entry(5, false, { ann: 10 }), entry(7, false, { ann: 20 })] }, { ...walk.stages[1], outside: undefined, entries: [entry(5, false, { cy: 5 }), entry(7, false, { cy: 7 })] }] };
  const s2 = StageLogic.standings(StageLogic.withWalk(aired, w2));
  assert.deepEqual(s2.map((x) => [x.key, x.rows[0].points]), [["bingo", 20], ["calls", 5]], "bingo through 7 (aired), the other through 5 (its results)");
  // An alongside start after the game's end: said once, at its start.
  const late = { stages: [BINGO, { ...CALLS, game: { ...CALLS.game, span: { from: 12 } } }] };
  assert.deepEqual(ats(late), ["stages[1].game.span.from"]);
  assert.match(G.specProblems(late, CTX)[0].problem, /start it by Episode 9/);
});
