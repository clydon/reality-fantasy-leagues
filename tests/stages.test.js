// A game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1): a game that ends before a phase starts (span.to { phase }),
// settled as a start at a phase is so a stage that ends before the merge and the next that starts at it always meet; a draft that
// opens at its game's start (extras.draft.opens 'start'), drafting from who's still in, an exclusive one that no longer covers every
// pick then played shared (the 9:10 PM decision's fallback); the staged spec (its stages each a game of its own, in order, and the
// overall), its words and its round trip through a league's settings; and the overall from its stages' tables (StageLogic), at a
// viewer's mark, by points, places or wins. The stages' tables here are read as the server reads them (game-view.ts gameView, no
// seat, at each episode: answer-points.ts stageWalk). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });

const { DraftLogic, StageLogic, GhostLogic } = S;
const CTX = {
  show: "Survivor 51",
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge", name: "Pre-merge" }, { id: "merged", name: "Merged" }, { id: "jury", name: "Jury" }],
};
const SEATS = ["ann", "bo", "cy", "di"];

/** A league of `n` castaways C0.. and seats `people`, its game `spec` through setGame, Episodes 1 to `eps` made, none with results. */
function league(spec, { n = 12, people = SEATS, eps = 10, type = null } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  if (type) S.updateSettings(s, "leagueTypeId", type);
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const cid = (s, i) => s.castaways[i].id;
const gone = (s, k, i, how = "Voted Out") => S.addElimination(s, ep(s, k).id, cid(s, i), how);
/** The snake draft run to its end: each turn takes the first castaway still free, in the cast's order. */
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
const team = (s, p) => s.castaways.filter((c) => (c.ownerIds || []).includes(p)).map((c) => c.name);

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

test("a game that ends before a phase: its spec, its words, its settings and where it settles", () => {
  const spec = { preset: "weekly-lineup", span: { from: 1, to: { phase: "merged" } } };
  assert.deepEqual(G.specProblems(spec, CTX), []);
  assert.deepEqual(G.specWaitsFor(spec), []);
  assert.equal(G.spanEnd(G.fullSpec(spec).span), null, "unknown: it runs on");
  assert.equal(G.spanEndPhase(G.fullSpec(spec).span), "merged");
  assert.equal(G.spanEnd({ from: 1, to: { phase: "merged", at: 7 } }), 7);
  // Said wrong.
  const at = (sp, ctx) => G.specProblems(sp, ctx).map((p) => p.at);
  assert.deepEqual(at({ preset: "weekly-lineup", span: { from: 1, to: { phase: "nope" } } }, CTX), ["span.to.phase"]);
  assert.deepEqual(at({ preset: "weekly-lineup", span: { from: 1, to: { phase: "premerge" } } }, CTX), ["span.to.phase"], "the first phase has nothing before it");
  assert.deepEqual(at({ preset: "weekly-lineup", span: { from: { phase: "merged" }, to: { phase: "merged" } } }, CTX), ["span.to.phase"], "never where it starts");
  assert.deepEqual(at({ preset: "weekly-lineup", span: { from: 1, to: { phase: "merged", at: 0 } } }, null), ["span.to.at"]);
  assert.deepEqual(at({ preset: "weekly-lineup", span: { from: 1, to: { phase: "merged", extra: 1 } } }, null), ["span.to.extra"]);
  // Its words: waiting, then settled.
  assert.match(G.describeSpec(spec, CTX).sentence, /until Merged starts/);
  assert.match(G.describeSpec({ ...spec, span: { from: 2, to: { phase: "merged", at: 7 } } }, CTX).sentence, /Episodes 2–7, until Merged/);
  assert.ok(G.describeSpec(spec, CTX).rules.includes("It ends when Merged starts: nothing from then on scores, and the table there is final."));
  // Its settings: endPhase, with endEpisode once it's settled, both ways.
  const f = G.settingsOf({ ...spec, span: { from: 1, to: { phase: "merged", at: 7 } } });
  assert.equal(f.endPhase, "merged");
  assert.equal(f.endEpisode, 7);
  assert.deepEqual(G.specOf(f).span, { from: 1, to: { phase: "merged", at: 7 } });
  assert.deepEqual(G.specOf(G.settingsOf(spec)).span, { from: 1, to: { phase: "merged" } });
  // A plain game's settings are as they were: no endPhase written.
  assert.equal(G.settingsOf({ preset: "weekly-lineup" }).endPhase, undefined);

  // In a league: runs on while it's unknown, then ends at the episode before the phase's start (the first still open, once it's
  // begun), and never moves once the episode after it has aired.
  const s = league(spec, { type: "active-roster" });
  assert.equal(S.endEpisode(s), null);
  assert.equal(S.endPhase(s), "merged");
  assert.equal(S.inPlay(s, 9), true);
  assert.deepEqual(S.settleStart(s, { from: null, end: 6, open: 3 }), []);
  assert.equal(S.endEpisode(s), 5);
  assert.equal(S.inPlay(s, 5), true);
  assert.equal(S.inPlay(s, 6), false);
  assert.deepEqual(S.settleStart(s, { from: null, end: 6, open: 8 }), [], "the episode after it aired: it stays");
  assert.equal(S.endEpisode(s), 5);
  // Known only once it's begun: the episode before the first still open.
  const late = league(spec, { type: "active-roster" });
  S.settleStart(late, { from: null, end: 6, open: 8 });
  assert.equal(S.endEpisode(late), 7);
  // Cleared again before then: it runs on.
  const cleared = league(spec, { type: "active-roster" });
  S.settleStart(cleared, { from: null, end: 6, open: 3 });
  S.settleStart(cleared, { from: null, end: null, open: 4 });
  assert.equal(S.endEpisode(cleared), null);
  // A game whose end's phase came before its start never plays: its last episode the one before its first.
  const never = league({ preset: "weekly-lineup", span: { from: 6, to: { phase: "merged" } } }, { type: "active-roster" });
  S.settleStart(never, { from: null, end: 4, open: 2 });
  assert.equal(S.endEpisode(never), 5);
  assert.equal([1, 2, 3, 4, 5, 6, 7].some((k) => S.inPlay(never, k)), false);
  assert.match(G.describeSpec(S.gameOf(never), CTX).sentence, /never: Merged came first/);
  // A game from one phase to the next keeps its end when its start waits again.
  const both = league({ preset: "weekly-lineup", span: { from: { phase: "merged" }, to: { phase: "jury" } } }, { type: "active-roster" });
  assert.deepEqual(S.settleStart(both, { from: null, end: null, open: 1 }), []);
  assert.deepEqual(S.gameOf(both).span, { from: { phase: "merged" }, to: { phase: "jury" } });
});

test("a stage that ends before the merge and the next that starts at it always meet", () => {
  const pre = league({ preset: "outlast", span: { from: 1, to: { phase: "merged" } } }, { type: "classic-draft" });
  const post = league({ preset: "outlast", span: { from: { phase: "merged" }, to: null } }, { type: "classic-draft" });
  for (const where of [{ from: 6, end: 6, open: 2 }, { from: 6, end: 6, open: 9 }, { from: null, end: null, open: 3 }]) {
    const a = structuredClone(pre);
    const b = structuredClone(post);
    S.settleStart(a, where);
    S.settleStart(b, where);
    const last = S.endEpisode(a);
    const first = S.startEpisode(b);
    if (where.from === null) {
      assert.equal(last, null);
      assert.equal(first, null);
    } else assert.equal(last + 1, first, JSON.stringify(where));
  }
});

test("a draft that opens at its game's start drafts from who's still in, shared when exclusive no longer covers every pick", () => {
  const spec = { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, span: { from: { phase: "merged" }, to: null }, extras: { draft: { at: null, timer: 0, away: "wait", opens: "start" } } };
  assert.deepEqual(G.specProblems(spec, CTX), []);
  assert.equal(G.settingsOf(spec).draftOpens, "start");
  assert.equal(G.specOf(G.settingsOf(spec)).extras.draft.opens, "start");
  assert.deepEqual(G.specProblems({ ...spec, extras: { draft: { at: null, timer: 0, away: "wait", opens: "later" } } }, null).map((p) => p.at), ["extras.draft.opens"]);
  assert.match(G.describeSpec(spec, CTX).details.find((d) => d.id === "draft").value, /opens once the episode before it is in/);
  const s = league(spec, { type: "classic-draft" });
  assert.equal(DraftLogic.waits(s), "The draft opens once it's known where the game starts");
  S.forceStartDraft(s);
  assert.equal(S.isDraftStarted(s), false, "a Start waits for it to open");
  const first = s.castaways[0].id;
  S.draftToCurrentTurn(s, first);
  assert.equal(s.draftPicksMade || 0, 0, "no pick before it opens");
  assert.equal(S.settleDraftShare(s), null, "nothing counted before it opens");
  // The merge settles at Episode 5: it opens once Episode 4's results are in.
  S.settleStart(s, { from: 5, open: 2 });
  assert.equal(S.startEpisode(s), 5);
  assert.equal(DraftLogic.waits(s), "The draft opens once Episode 4's results are in");
  [1, 2, 3].forEach((k) => gone(s, k, k - 1));
  assert.ok(DraftLogic.waits(s));
  gone(s, 4, 3);
  assert.equal(DraftLogic.waits(s), null);
  // 4 of you × 3 is more than the 8 still in: played shared from now on, a private draft revealed at once, no waivers (a shared
  // Outlast has nobody free).
  assert.deepEqual(S.settleDraftShare(s), { was: "snake", pool: 8, teams: 4, each: 3 });
  const g = S.gameOf(s);
  assert.equal(g.get.own, "shared");
  assert.equal(g.get.order, "blind");
  assert.equal(g.extras.waivers, null);
  assert.equal(S.piecesOf(s).draft.name, "BlindDraftStrategy");
  assert.equal(S.settleDraftShare(s), null, "once");
  // One that still covers stays exclusive, and drafts from who's left.
  const fits = league({ ...spec, get: { ...spec.get, each: 2 } }, { type: "classic-draft" });
  S.settleStart(fits, { from: 5, open: 2 });
  [1, 2, 3, 4].forEach((k) => gone(fits, k, k - 1));
  assert.equal(S.settleDraftShare(fits), null);
  assert.equal(S.gameOf(fits).get.own, "exclusive");
  snake(fits);
  assert.equal(fits.draftPicksMade, 8);
  assert.equal(fits.castaways.slice(0, 4).some((c) => (c.ownerIds || []).length), false, "nobody already gone");
  // Once it's begun it stays open, whatever happens to those results.
  S.removeElimination(fits, ep(fits, 4).id, cid(fits, 3));
  assert.equal(DraftLogic.waits(fits), null);
  // A draw goes on drawing, each seat from its own hat.
  const draw = league({ ...spec, get: { by: "draft", each: 3, order: "draw", own: "exclusive" } }, { type: "classic-draft" });
  S.settleStart(draw, { from: 5, open: 2 });
  assert.equal(S.DrawLogic.ready(draw), false, "no draw before it opens");
  [1, 2, 3, 4].forEach((k) => gone(draw, k, k - 1));
  assert.equal(S.DrawLogic.ready(draw), true);
  assert.equal(S.settleDraftShare(draw).was, "draw");
  assert.deepEqual([S.gameOf(draw).get.order, S.gameOf(draw).get.own], ["draw", "shared"]);
  // A draft that opens any time (today's) is never held, nor counted.
  const any = league({ ...spec, extras: undefined }, { type: "classic-draft" });
  assert.equal(DraftLogic.waits(any), null);
  assert.equal(S.settleDraftShare(any), null);
});

test("the staged spec: its stages whole, in order, its overall, what it waits for, its words and its settings", () => {
  const spec = {
    stages: [
      { id: "pre", name: "Before the merge", game: { preset: "outlast", span: { from: 1 } } },
      { id: "post", name: "After the merge", game: { preset: "outlast", span: { from: { phase: "merged" } } } },
    ],
  };
  const f = G.fullSpec(spec);
  assert.deepEqual(f.stages[0].game.span, { from: 1, to: { phase: "merged" } }, "a stage ends where the next starts");
  assert.equal(f.stages[0].game.extras.draft.opens, undefined, "the first stage drafts as any game does");
  assert.equal(f.stages[1].game.extras.draft.opens, "start", "a later stage drafts from who's still in");
  assert.deepEqual(f.span, { from: 1, to: null });
  assert.deepEqual([f.get, f.count, f.score, f.rank, f.overall], [{ by: "none" }, null, { by: "stages" }, { by: "total" }, { by: "points" }]);
  assert.ok(G.sameValue(G.fullSpec(f), f), "whole stays whole");
  assert.deepEqual(G.specProblems(spec, CTX), []);
  assert.deepEqual(G.specProblems(f, CTX), [], "as stored");
  assert.deepEqual(G.specWaitsFor(spec), []);
  assert.equal(G.typeOf(spec), "stages");
  assert.equal(G.flagsOf(f).hasStages, true);
  assert.equal(G.flagsOf(f).hasRoster, false);
  // An episode end fills from an episode start; a stage's own end is kept.
  assert.deepEqual(G.fullSpec({ stages: [{ id: "a", game: { preset: "outlast" } }, { id: "b", game: { preset: "outlast", span: { from: 7 } } }] }).stages[0].game.span, { from: 1, to: 6 });
  // Its words.
  const d = G.describeSpec(spec, CTX);
  assert.match(d.sentence, /^A game in two stages for Survivor 51: Before the merge, an Outlast/);
  assert.match(d.sentence, /; then After the merge, an Outlast/);
  assert.match(d.sentence, /Overall, each stage's points add up\.$/);
  assert.ok(d.rules.some((r) => /^After the merge: The draft opens once/.test(r)));
  assert.match(G.describeSpec({ ...spec, overall: { by: "places", places: [5, 3, 1] } }, CTX).sentence, /5 for first, 3 for second and 1 for third/);
  // Its settings, both ways.
  const fields = G.settingsOf(spec);
  assert.equal(fields.leagueTypeId, "stages");
  assert.ok(G.sameValue(G.specOf(fields), f));
  assert.ok(G.sameValue(G.specOf(G.withSpec({}, spec)), f));
  // Said wrong.
  const at = (sp) => G.specProblems(sp, CTX).map((p) => p.at);
  const two = (a, b, extra = {}) => ({ stages: [a, b], ...extra });
  const out = { id: "a", game: { preset: "outlast", span: { from: 1, to: 4 } } };
  const lineup = { id: "b", game: { preset: "weekly-lineup", span: { from: 5 } } };
  assert.deepEqual(at({ stages: [out] }), ["stages"], "one stage is just a game");
  assert.deepEqual(at(two(out, { ...lineup, id: "a" })), ["stages[1].id"]);
  assert.deepEqual(at(two(out, { id: "b", game: { preset: "outlast" } })), ["stages[1].game.span.from"], "a later stage says where it starts");
  assert.deepEqual(at(two(out, { id: "b", game: { stages: [] } })), ["stages[1].game.stages"]);
  assert.deepEqual(at(two(out, lineup, { get: { by: "draft" } })), ["get"], "its rules are its stages'");
  assert.deepEqual(at(two(out, lineup, { overall: { by: "places", places: [1, 3] } })), ["overall.places"]);
  assert.deepEqual(at(two(out, lineup, { overall: { by: "points", places: [3, 1] } })), ["overall.places"]);
  assert.deepEqual(at(two(out, lineup, { overall: { by: "most" } })), ["overall.by"]);
  assert.deepEqual(at(two({ id: "a", game: { preset: "outlast", span: { from: 1, to: null } } }, lineup)), ["stages[0].game.span.to"]);
  assert.deepEqual(at(two(out, { id: "b", game: { preset: "outlast", span: { from: { phase: "merged" } } } })), ["stages[1].game.span.from"]);
  assert.deepEqual(at(two({ id: "a", game: { preset: "outlast", span: { from: 1, to: { phase: "merged" } } } }, lineup)), ["stages[1].game.span.from"]);
  assert.deepEqual(at(two(out, { ...lineup, game: { ...lineup.game, get: { by: "draft", each: 99 } } })), ["stages[1].game.get.each"], "each stage checked as a game");
  assert.deepEqual(at({ ...two(out, lineup), extras: { seats: { people: 2 } } }), ["extras.seats"]);
  assert.deepEqual(at({ preset: "outlast", overall: { by: "points" } }), ["overall"]);
  assert.deepEqual(at({ preset: "outlast", score: { by: "stages" } }), ["score.by"]);
  // A12 part 4a: a stage that scores outside the game plays; the game's own stages at the same time are refused (alongside plays).
  const waits = (sp) => G.specWaitsFor(sp).map((w) => w.at);
  assert.deepEqual(waits(two(out, { id: "b", game: { preset: "weekly-bingo", span: { from: 5 } } })), []);
  assert.deepEqual(at(two(out, { ...lineup, game: { ...lineup.game, span: { from: 3 } } })), ["stages[1].game.span.from"]);
  assert.equal(G.typeOf(two(out, { ...lineup, game: { ...lineup.game, span: { from: 3 } } })), null);
  // The exclusive count: the first stage's where the game starts; a later stage's waits for its draft to open.
  const big = { id: "b", game: { preset: "outlast", get: { by: "draft", each: 5, order: "snake", own: "exclusive" }, span: { from: { phase: "merged" } } } };
  const ctx = { ...CTX, pool: 18, couch: 4 };
  assert.deepEqual(G.specProblems(two({ id: "a", game: { preset: "outlast", span: { from: 1 } } }, big), ctx), []);
  assert.deepEqual(G.specProblems(two({ id: "a", game: { preset: "outlast", get: { by: "draft", each: 5, order: "snake", own: "exclusive" }, span: { from: 1 } } }, big), ctx).map((p) => p.at), ["stages[0].game.get.own"]);
});

test("a game in stages through the engine: two drafts, the second at the merge from who's left, and the overall at each mark", () => {
  const spec = {
    stages: [
      { id: "pre", name: "Before the merge", game: { preset: "outlast", span: { from: 1 } } },
      { id: "post", name: "After the merge", game: { preset: "outlast", span: { from: { phase: "merged" } } } },
    ],
  };
  const full = G.fullSpec(spec);
  const parent = league(spec, { type: "pickem" });
  assert.equal(S.getLeagueType(parent).id, "stages");
  assert.equal(S.getLeagueType(parent).hasStages, true);
  assert.equal(StageLogic.on(parent), true);
  assert.deepEqual(StageLogic.stages(parent).map((x) => x.id), ["pre", "post"]);
  const pre = league(full.stages[0].game, { type: "classic-draft" });
  const post = league(full.stages[1].game, { type: "classic-draft" });
  const all = [parent, pre, post];
  // Before anything: joining is open, the overall is everyone at nothing.
  assert.equal(GhostLogic.allowed(parent), true);
  assert.deepEqual(S.computeScores(StageLogic.withWalk(parent, walkOf([{ key: "pre", state: pre }, { key: "post", state: post }]))).map((r) => r.total), [0, 0, 0, 0]);
  // The first draft, before the premiere (3 each of 12: it fits); the second waits for the merge.
  snake(pre);
  assert.equal(pre.draftPicksMade, 12);
  assert.ok(DraftLogic.waits(post));
  snake(post);
  assert.equal(post.draftPicksMade || 0, 0);
  // Episodes 1 to 4 (one goes home each), the merge confirmed at 5: the first ends at 4, the second starts at 5.
  [1, 2, 3, 4].forEach((k) => all.forEach((s) => gone(s, k, k - 1)));
  all.forEach((s) => S.settleStart(s, { from: 5, end: 5, open: 5 }));
  assert.equal(S.endEpisode(pre), 4);
  assert.equal(S.startEpisode(post), 5);
  assert.equal(GhostLogic.allowed(parent), false, "nobody new once the first stage has started");
  // The second draft opens: 4 of you × 3 is more than the 8 still in, so it's shared, and drafts from who's left.
  assert.equal(DraftLogic.waits(post), null);
  assert.equal(S.settleDraftShare(post).pool, 8);
  assert.equal(S.gameOf(post).get.own, "shared");
  // The reveal: each picks three of who's left.
  const left = post.castaways.filter((c) => c.status === "active").map((c) => c.id);
  S.BlindDraftLogic.reveal(post, { ann: left.slice(0, 3), bo: left.slice(1, 4), cy: left.slice(2, 5), di: left.slice(5, 8) });
  assert.deepEqual(team(post, "ann"), ["C4", "C5", "C6"]);
  // Episodes 5 to 11, the last the finale (C11 the winner).
  [5, 6, 7, 8, 9, 10].forEach((k) => all.forEach((s) => gone(s, k, k - 1)));
  all.forEach((s) => S.ensureEpisodeNumber(s, 11, false));
  all.forEach((s) => gone(s, 11, 10));
  all.forEach((s) => gone(s, 11, 11, "Sole Survivor"));
  const walk = walkOf([{ key: "pre", state: pre }, { key: "post", state: post }]);
  // The first stage's table stops at its end, Episode 4; the second's runs from 5 to the finale.
  assert.deepEqual(walk.stages[0].entries.map((e) => e.episode), [1, 2, 3, 4]);
  assert.equal(walk.stages[0].entries[3].over, true);
  assert.deepEqual(walk.stages[1].entries.map((e) => e.episode), [5, 6, 7, 8, 9, 10, 11]);
  assert.equal(walk.stages[1].entries[6].over, true);
  const v = StageLogic.withWalk(parent, walk);
  const stand = StageLogic.standings(v);
  assert.deepEqual(stand.map((x) => [x.key, x.started, x.over]), [["pre", true, true], ["post", true, true]]);
  // The overall by points: each stage's own total, added up.
  const pts = (key, p) => stand.find((x) => x.key === key).rows.find((r) => r.playerId === p).points;
  const rows = S.computeScores(v);
  for (const r of rows) assert.equal(r.total, pts("pre", r.playerId) + pts("post", r.playerId));
  assert.deepEqual(rows.map((r) => r.total), [...rows.map((r) => r.total)].sort((a, b) => b - a), "ranked by it");
  assert.equal(S.gameOver(v), true);
  // At a viewer's mark: through Episode 4 only the first stage counts, through 2 its table then.
  const at4 = S.SpoilerLogic.viewThrough(v, 4);
  assert.deepEqual(StageLogic.standings(at4).map((x) => [x.started, x.over]), [[true, true], [false, false]]);
  assert.equal(at4.stageWalk.stages[1].entries.length, 0, "a viewer's copy holds nothing past their mark");
  const at2 = S.computeScores(S.SpoilerLogic.viewThrough(v, 2));
  for (const r of at2) assert.equal(r.total, walk.stages[0].entries[1].rows.find((x) => x.playerId === r.playerId).points);
  assert.equal(S.gameOver(S.SpoilerLogic.viewThrough(v, 6)), false);
  // By places: each stage that's over, one point for each of you below you, plus one; by wins, stages won.
  const placed = (overall) => S.computeScores(StageLogic.withWalk({ ...parent, settings: { ...parent.settings, stageOverall: overall } }, walk));
  const place = (key, p) => stand.find((x) => x.key === key).rows.find((r) => r.playerId === p).place;
  for (const r of placed({ by: "places" })) assert.equal(r.total, 5 - place("pre", r.playerId) + 5 - place("post", r.playerId));
  const own = (n) => [10, 6][n - 1] ?? 0;
  for (const r of placed({ by: "places", places: [10, 6] })) assert.equal(r.total, own(place("pre", r.playerId)) + own(place("post", r.playerId)));
  for (const r of placed({ by: "wins" })) assert.equal(r.total, (place("pre", r.playerId) === 1 ? 1 : 0) + (place("post", r.playerId) === 1 ? 1 : 0));
  // A stage still playing counts its places only once it's over.
  const mid = S.SpoilerLogic.viewThrough(StageLogic.withWalk({ ...parent, settings: { ...parent.settings, stageOverall: { by: "places" } } }, walk), 7);
  for (const r of S.computeScores(mid)) assert.equal(r.total, 5 - place("pre", r.playerId));
});

test("the overall: ties share a place and a win, someone missing from a stage scores nothing there", () => {
  const spec = { stages: [{ id: "a", game: { preset: "outlast", span: { from: 1, to: 2 } } }, { id: "b", game: { preset: "outlast", span: { from: 3 } } }], overall: { by: "wins" } };
  const s = league(spec, { type: "pickem", people: ["ann", "bo", "cy"] });
  [1, 2, 3].forEach((k) => gone(s, k, k - 1));
  const walk = {
    stages: [
      { key: "a", leagueId: "x", from: 1, to: 2, entries: [{ episode: 2, over: true, rows: [{ playerId: "ann", points: 5, place: 1 }, { playerId: "bo", points: 5, place: 1 }, { playerId: "cy", points: 2, place: 3 }] }] },
      { key: "b", leagueId: "y", from: 3, to: null, entries: [{ episode: 3, over: true, rows: [{ playerId: "cy", points: 9, place: 1 }, { playerId: "ann", points: 1, place: 2 }] }] },
    ],
  };
  const rows = S.computeScores(StageLogic.withWalk(s, walk));
  const by = Object.fromEntries(rows.map((r) => [r.playerId, r]));
  assert.deepEqual([by.ann.wins, by.bo.wins, by.cy.wins], [1, 1, 1], "a tie at the top is a win for each");
  // Level on wins: places next (a stage's places, one for each below plus one, of who's in its table), then points.
  assert.deepEqual([by.ann.placePoints, by.bo.placePoints, by.cy.placePoints], [3 + 1, 3, 1 + 2]);
  // bo and cy level on both: cy's 11 points beat bo's 5.
  assert.deepEqual(rows.map((r) => r.playerId), ["ann", "cy", "bo"]);
  assert.deepEqual(by.bo.stages.map((x) => x.points), [5, null], "bo isn't in stage b's table: nothing from it");
  // The game ends with its last stage, there.
  assert.equal(StageLogic.endsAt(StageLogic.withWalk(s, walk)), null, "a last stage to the season's end ends with the season");
  const early = { stages: [walk.stages[0], { ...walk.stages[1], to: 3 }] };
  assert.equal(StageLogic.endsAt(StageLogic.withWalk(s, early)), 3);
  assert.equal(S.lastEpisode(StageLogic.withWalk(s, early)), 3);
  assert.equal(S.gameOver(StageLogic.withWalk(s, early)), true);
  // No walk: the stages haven't been read, so nothing counts.
  assert.deepEqual(S.computeScores(s).map((r) => r.total), [0, 0, 0]);
});

test("nobody new once a game in stages' first stage has started: a code join waits, inactive", () => {
  const spec = { stages: [{ id: "a", game: { preset: "outlast", span: { from: 1, to: 2 } } }, { id: "b", game: { preset: "outlast", span: { from: 3 } } }] };
  const s = league(spec, { type: "pickem" });
  assert.equal(StageLogic.started(s), false);
  assert.equal(S.addPlayer(structuredClone(s), "eve").active, true, "before it starts, a seat like any");
  gone(s, 1, 0);
  assert.equal(StageLogic.started(s), true);
  assert.equal(GhostLogic.allowed(s), false);
  assert.equal(GhostLogic.joinMode(s), "locked");
  const p = S.addPlayer(s, "eve");
  assert.equal(p.active, false);
  assert.equal(p.lateJoin, undefined);
});

test("stages one after another: a gap between them is refused, and so is an overlap (A12 part 4a: alongside plays at once)", () => {
  const two = (to, from) => ({ stages: [{ id: "a", game: { preset: "outlast", span: { from: 1, to } } }, { id: "b", game: { preset: "outlast", span: { from } } }] });
  assert.deepEqual(G.specProblems(two(5, 6), CTX), []);
  assert.deepEqual(G.specProblems(two(5, 8), CTX).map((p) => p.at), ["stages[1].game.span.from"], "Episodes 6 and 7 would be nobody's");
  assert.deepEqual(G.specProblems(two(5, 4), CTX).map((p) => p.at), ["stages[1].game.span.from"], "Episode 4 and 5 would be both's");
  assert.match(G.specProblems(two(5, 4), CTX)[0].problem, /alongside: true/);
  assert.deepEqual(G.specWaitsFor(two(5, 4)).filter((w) => w.step === "later"), [], "nothing waits for a later part");
});
