// One game across two shows (docs/PLAN-start-a-game-gpt.md step A12 part 4b, the tracker's shape.twoShows and s20): a stage's `season`
// plays it on another season (another show's, or another season of the same show), as a league of its own there; its spec whole (no
// end defaulted across seasons, the game's span its own stages' on its own season, the one-after-another rule per season), its problems
// (checked with that season's ctx, ctx.seasons; never the first stage; no format change, side stage or 'next-stage' on a game on more
// than one season), its words and its round trip through a league's settings; 4a's Noticed item 5 (two stages of bingo, or of Weekly
// Calls, on one season at the same time refused, and a side stage of either); and the overall over stages on two seasons (each cut at the
// viewer's mark on its own season: the server cuts the other season's, answer-points.ts stageWalk; the game over once its own stages are,
// never at its own season's end; a stage beside it on another season counting what aired by the game's end). The server's side is
// scripts/dev-test/check-two-shows.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");

const { StageLogic } = S;
const TRAITORS = { show: "the-traitors-us", number: 5 };
const TCTX = {
  show: "The Traitors 5",
  moments: [{ id: "murdered", label: "Murdered", defaultPoints: 2, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: ["Traitor", "Faithful"],
  phases: [{ id: "castle", name: "Castle" }, { id: "endgame", name: "Endgame" }],
};
const CTX = {
  show: "Survivor 51",
  season: "survivor/51",
  moments: [{ id: "individualImmunity", label: "Won individual immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  phases: [{ id: "tribes", name: "Tribes" }, { id: "merged", name: "Merged" }],
  seasons: { "the-traitors-us/5": TCTX },
};
const SEATS = ["ann", "bo", "cy", "di"];
const OUTLAST = { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" } };
const SURVIVOR = { id: "survivor", name: "Survivor", game: { ...OUTLAST, span: { from: 1, to: 13 } } };
const THE_TRAITORS = { id: "traitors", name: "The Traitors", season: TRAITORS, game: { preset: "survival-pool" } };
const TWO = { stages: [SURVIVOR, THE_TRAITORS], overall: { by: "points" } };
const ats = (spec, ctx = CTX, opts) => G.specProblems(spec, ctx, opts).map((p) => p.at);

/** A league on Survivor of `n` castaways and seats `people`, its game `spec` through setGame, Episodes 1 to `eps` made. */
function league(spec, { n = 16, people = SEATS, eps = 13 } = {}) {
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
const gone = (s, k, i) => S.addElimination(s, ep(s, k).id, s.castaways[i].id, "Voted Out");
/** A stage's table at an episode, as the server's walk hands it over: each seat's points in that order, places by them. */
const rows = (pts) => Object.entries(pts).map(([playerId, points], i) => ({ playerId, points, place: i + 1 }));
const entry = (episode, over, pts, at) => ({ episode, over, rows: rows(pts), ...(at ? { at } : {}) });
const day = (d) => new Date(Date.UTC(2026, 8, 1) + d * 86400000).toISOString();

test("a stage on another season: whole, checked with that season's rules, its words and its settings", () => {
  assert.deepEqual(ats(TWO), []);
  assert.deepEqual(G.specProblems(TWO), [], "without ctx, the shape alone");
  assert.deepEqual(G.specWaitsFor(TWO), []);
  assert.equal(G.typeOf(TWO), "stages");
  assert.ok(G.crosses(TWO.stages) && G.onSeasons(TWO.stages));
  assert.deepEqual(G.stageSeason(THE_TRAITORS), TRAITORS);
  assert.equal(G.seasonKey(TRAITORS), "the-traitors-us/5");
  // Each stage checked with its own season's rules: The Traitors' moments on its stage, never Survivor's.
  const murders = { ...THE_TRAITORS, game: { preset: "weekly-lineup", score: { by: "moments", points: { murdered: 3 } } } };
  assert.deepEqual(ats({ stages: [SURVIVOR, murders] }), []);
  assert.deepEqual(ats({ stages: [SURVIVOR, { ...murders, season: undefined, game: { ...murders.game, span: { from: 14 } } }] }), ["stages[1].game.score.points.murdered"], "on Survivor's season it's refused");
  assert.deepEqual(ats({ stages: [SURVIVOR, { ...THE_TRAITORS, game: { preset: "weekly-lineup", score: { by: "moments", points: { individualImmunity: 3 } } } }] }), ["stages[1].game.score.points.individualImmunity"]);
  // A season we don't have, said wrong, the first stage's, the game's own.
  assert.deepEqual(ats(TWO, { ...CTX, seasons: {} }), ["stages[1].season"]);
  assert.match(G.specProblems(TWO, { ...CTX, seasons: undefined })[0].problem, /isn't a season set up as a game here/);
  assert.deepEqual(ats(TWO, { ...CTX, seasons: {} }, { league: true }), [], "a league's own spec keeps the stage it was made with");
  for (const bad of ["the-traitors-us/5", { show: "The Traitors", number: 5 }, { show: "the-traitors-us", number: 0 }, { show: "the-traitors-us" }, { show: "the-traitors-us", number: 5, at: 1 }]) {
    assert.deepEqual(ats({ stages: [SURVIVOR, { ...THE_TRAITORS, season: bad }] }), ["stages[1].season"], JSON.stringify(bad));
  }
  assert.deepEqual(ats({ stages: [{ ...SURVIVOR, season: TRAITORS }, { ...THE_TRAITORS, season: undefined, game: { preset: "survival-pool", span: { from: 14 } } }] }), ["stages[0].season"]);
  assert.deepEqual(ats({ stages: [SURVIVOR, { ...THE_TRAITORS, season: { show: "survivor", number: 51 } }] }), ["stages[1].season"], "the game's own season: leave it out");
  // Whole: nothing defaulted across seasons; the game's span is its own stages' on its own season.
  const open = { stages: [{ ...SURVIVOR, game: OUTLAST }, THE_TRAITORS] };
  assert.deepEqual(ats(open), []);
  const full = G.fullSpec(open);
  assert.deepEqual(full.stages.map((x) => [x.id, x.game.span.from, x.game.span.to]), [["survivor", 1, null], ["traitors", 1, null]], "Survivor's stage doesn't end where The Traitors' starts");
  assert.deepEqual(full.span, { from: 1, to: null });
  assert.deepEqual(G.fullSpec(TWO).span, { from: 1, to: 13 }, "its span on Survivor: its Survivor stage's");
  assert.ok(!full.stages[1].game.extras.draft, "a pool drafts nothing");
  assert.ok(G.sameValue(G.fullSpec(TWO).stages[1].season, TRAITORS));
  // One after another per season: a stage on another season between two of Survivor's.
  const back = (from) => ({ stages: [{ ...SURVIVOR, game: { ...OUTLAST, span: { from: 1, to: 6 } } }, THE_TRAITORS, { id: "again", name: "Again", game: { preset: "weekly-lineup", span: { from } } }] });
  assert.deepEqual(ats(back(7)), []);
  assert.deepEqual(ats(back(9)), ["stages[2].game.span.from"], "it starts where Survivor's stage before ends");
  assert.match(G.specProblems(back(9), CTX)[0].problem, /: 7, the episode after its last/);
  assert.deepEqual(ats(back(3)), ["stages[2].game.span.from"], "an overlap on Survivor, The Traitors' stage between them");
  assert.equal(G.typeOf(back(3)), null, "and no game plays it (playsAs compares it with Survivor's stage before)");
  assert.equal(G.typeOf(back(7)), "stages");
  assert.deepEqual(ats({ stages: [SURVIVOR, { ...THE_TRAITORS, game: { preset: "survival-pool", span: { from: 3, to: 9 } } }] }), [], "its own start and end, on its own season");
  // A game on more than one season: no format change, side stage or 'next-stage'.
  assert.deepEqual(ats({ stages: [{ ...SURVIVOR, game: OUTLAST }, THE_TRAITORS, { id: "c", name: null, on: {}, game: { preset: "weekly-lineup" } }] }), ["stages[2].on"]);
  assert.deepEqual(ats({ stages: [SURVIVOR, THE_TRAITORS, { id: "s", name: null, side: { held: 2 }, game: { preset: "weekly-lineup" } }] }), ["stages[2].side"]);
  const groupAsk = { id: "tribe", ask: "Which tribe wins immunity?", answer: "group", settle: { by: "results", take: "immunity" }, asked: "each", fallback: "next-stage", points: 1 };
  const nextStage = { stages: [{ ...SURVIVOR, game: { get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [groupAsk], span: { from: 1, to: 6 } } }, THE_TRAITORS] };
  assert.ok(ats(nextStage, { ...CTX, grouped: true }).includes("stages[0].game"), "'next-stage' reads the game's own season's groups");
  // Its words.
  const d = describeSpec(TWO, CTX);
  assert.match(d.sentence, /^A game in two stages for Survivor 51 and The Traitors 5: Survivor, an Outlast: .*; then The Traitors on The Traitors 5, a Survival Pool: /);
  assert.ok(d.rules.some((r) => /^A stage on The Traitors 5 plays that season's episodes/.test(r)));
  assert.ok(d.rules.includes(`The Traitors (The Traitors 5): ${describeSpec(THE_TRAITORS.game, { ...TCTX, show: null }).sentence}`));
  assert.match(describeSpec(TWO, { show: "Survivor 51" }).sentence, /on season 5 of the-traitors-us/, "without its season's rules, said plainly");
  // Its round trip through a league's settings, and the game's end.
  const s = league(TWO);
  assert.equal(s.settings.leagueTypeId, "stages");
  assert.ok(G.sameValue(S.gameOf(s).stages[1].season, TRAITORS));
  assert.equal(S.endEpisode(s), 13);
  assert.ok(StageLogic.crosses(s));
  // A stage alongside on another season plays its own span there (never the game's), and isn't held inside the game's.
  const beside = { stages: [{ ...SURVIVOR, game: { preset: "weekly-lineup", span: { from: 1, to: 9 } } }, { id: "bingo", name: "Bingo", alongside: true, season: TRAITORS, game: { preset: "weekly-bingo", span: { from: 20 } } }] };
  assert.deepEqual(ats(beside), []);
  assert.deepEqual(G.fullSpec(beside).stages[1].game.span, { from: 20, to: null });
  assert.ok(!G.crosses(beside.stages) && G.onSeasons(beside.stages), "its own stages are all on its season");
});

test("4a's Noticed item 5: two stages of bingo (or of Weekly Calls) on one season at the same time are refused, and a side stage of either", () => {
  const LINEUP = (span) => ({ id: "lineup", name: "Lineup", game: { preset: "weekly-lineup", span } });
  const bingo = (id, span, more = {}) => ({ id, name: null, alongside: true, ...more, game: { preset: "weekly-bingo", ...(span ? { span } : {}) } });
  const calls = (id, span, more = {}) => ({ id, name: null, ...more, game: { preset: "weekly-calls", ...(span ? { span } : {}) } });
  // Two of bingo at once: the same card's lines twice.
  const twice = { stages: [{ ...bingo("a", { from: 1, to: 9 }), alongside: undefined }, bingo("b")] };
  assert.deepEqual(ats(twice), ["stages[1]"]);
  assert.match(G.specProblems(twice, CTX)[0].problem, /^Two stages of bingo on one season can't play at the same time: a card is each person's for the episode, so both would count the same lines/);
  // Different kinds, two seasons, or one after another: fine.
  assert.deepEqual(ats({ stages: [{ ...bingo("a", { from: 1, to: 9 }), alongside: undefined }, calls("b", undefined, { alongside: true })] }), []);
  assert.deepEqual(ats({ stages: [{ ...bingo("a", { from: 1, to: 9 }), alongside: undefined }, bingo("b", undefined, { season: TRAITORS })] }), [], "a card is each person's on its own season");
  assert.deepEqual(ats({ stages: [LINEUP({ from: 1, to: 9 }), bingo("b", { from: 1, to: 4 }), bingo("c", { from: 5, to: 9 })] }), [], "beside the game, one after the other");
  assert.deepEqual(ats({ stages: [LINEUP({ from: 1, to: 9 }), bingo("b", { from: 1, to: 5 }), bingo("c", { from: 5, to: 9 })] }), ["stages[2]"], "both count Episode 5");
  assert.deepEqual(ats({ stages: [{ ...bingo("a", { from: 1, to: 4 }), alongside: undefined }, LINEUP({ from: 5, to: 8 }), { ...bingo("c", { from: 9 }), alongside: undefined }] }), [], "the game's own, one after another");
  // Weekly Calls: the game's own from 10 on, and one alongside the whole game.
  const callsTwice = { stages: [LINEUP({ from: 1, to: 9 }), calls("own", { from: 10 }), calls("with", undefined, { alongside: true })] };
  assert.deepEqual(ats(callsTwice), ["stages[2]"]);
  assert.match(G.specProblems(callsTwice, CTX)[0].problem, /Two stages of Weekly Calls on one season .* a call is each person's for the episode, so both would count the same calls/);
  // A phase can't be told until it's known: it might meet.
  assert.deepEqual(ats({ stages: [{ ...bingo("a", { from: 1, to: { phase: "merged" } }), alongside: undefined }, LINEUP({ from: { phase: "merged" } }), bingo("c", { from: 12, to: 13 })] }), ["stages[2]"]);
  // A side stage of bingo: every copy would read the same card.
  const side = { stages: [LINEUP({ from: 1 }), { id: "s", name: null, side: { held: 2 }, game: { preset: "weekly-bingo" } }] };
  assert.deepEqual(ats(side), ["stages[1].side"]);
  assert.match(G.specProblems(side, CTX)[0].problem, /a card is each person's for the episode, not a grouping's/);
});

test("one game across two shows through the engine: each stage on its own season, the game over once both are, never at its own season's end", () => {
  const parent = league(TWO);
  for (let k = 1; k <= 3; k++) gone(parent, k, k - 1);
  // The server's walk: Survivor's stage through its results (3), The Traitors' on its own season (5 episodes there already).
  const walk = (survivor, traitors) => ({
    stages: [
      { key: "survivor", leagueId: "zt-s", from: 1, to: 13, entries: survivor },
      { key: "traitors", leagueId: "zt-t", from: 1, to: null, season: "the-traitors-us/5", entries: traitors },
    ],
  });
  const S3 = [entry(1, false, { ann: 1, bo: 1, cy: 1, di: 0 }), entry(2, false, { ann: 2, bo: 2, cy: 1, di: 0 }), entry(3, false, { ann: 3, bo: 2, cy: 1, di: 0 })];
  const T5 = [1, 2, 3, 4, 5].map((n) => entry(n, false, { cy: n, di: n - 1, ann: 0, bo: 0 }));
  const view = StageLogic.withWalk(parent, walk(S3, T5));
  const st = StageLogic.standings(view);
  assert.deepEqual(st.map((x) => [x.key, x.season, x.started, x.over, x.rows[0].points]), [["survivor", null, true, false, 3], ["traitors", "the-traitors-us/5", true, false, 5]], "The Traitors' stage through its own fifth episode, past Survivor's third");
  assert.deepEqual(Object.fromEntries(StageLogic.overall(view).map((o) => [o.playerId, o.overall])), { ann: 3, bo: 2, cy: 6, di: 4 });
  // A viewer through Survivor 2: Survivor's stage cut there; The Traitors' is the server's to cut (at their mark there), untouched here.
  const cut = StageLogic.cutWalk(walk(S3, T5), 2);
  assert.deepEqual(cut.stages.map((x) => x.entries.length), [2, 5]);
  const seen = S.SpoilerLogic.viewThrough(StageLogic.withWalk(parent, walk(S3, T5)), 2);
  assert.deepEqual(Object.fromEntries(StageLogic.overall(seen).map((o) => [o.playerId, o.overall])), { ann: 2, bo: 2, cy: 6, di: 4 });
  // Survivor's stage over at 13, its season over (a Sole Survivor): the game plays on with The Traitors' stage.
  for (let k = 4; k <= 12; k++) gone(parent, k, k - 1);
  S.addElimination(parent, ep(parent, 13).id, parent.castaways[12].id, "Lost Final Tribal (Jury Vote)");
  S.addElimination(parent, ep(parent, 13).id, parent.castaways[13].id, "Sole Survivor");
  const S13 = [...S3, ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => entry(n, false, { ann: n, bo: 2, cy: 1, di: 0 })), entry(13, true, { ann: 13, bo: 2, cy: 1, di: 0 })];
  const mid = StageLogic.withWalk(parent, walk(S13, T5));
  assert.ok(S.seasonEnded(mid), "Survivor's season is over: a Sole Survivor");
  assert.equal(StageLogic.endsAt(mid), 13, "on Survivor, it ends with its Survivor stage");
  assert.equal(S.lastEpisode(mid), 13);
  assert.equal(StageLogic.overAcross(mid), false);
  assert.equal(S.gameOver(mid), false, "not over at Survivor's end: The Traitors' stage plays on");
  assert.equal(S.gameOver(parent), false, "without the walk, never over (nothing to say The Traitors' stage is)");
  // The Traitors' stage over (its winner crowned at its 10th): the game is over.
  const T10 = [...T5, ...[6, 7, 8, 9].map((n) => entry(n, false, { cy: n, di: n - 1, ann: 0, bo: 0 })), entry(10, true, { cy: 12, di: 9, ann: 0, bo: 0 })];
  const end = StageLogic.withWalk(parent, walk(S13, T10));
  assert.equal(StageLogic.overAcross(end), true);
  assert.equal(S.gameOver(end), true);
  assert.ok(StageLogic.over(end));
  assert.deepEqual(Object.fromEntries(StageLogic.overall(end).map((o) => [o.playerId, o.overall])), { ann: 13, bo: 2, cy: 13, di: 9 });
  // By places: Survivor ann, bo, cy, di; The Traitors cy, di, ann, bo (their walk's places as the server hands them).
  const places = league({ ...TWO, overall: { by: "places" } });
  for (let k = 1; k <= 13; k++) gone(places, k, k - 1);
  const byPlaces = Object.fromEntries(StageLogic.overall(StageLogic.withWalk(places, walk(S13, T10))).map((o) => [o.playerId, o.overall]));
  assert.deepEqual(byPlaces, { ann: 4 + 2, bo: 3 + 1, cy: 2 + 4, di: 1 + 3 });
  // A game on one season keeps today's ends: its season's end ends it.
  const one = league({ stages: [SURVIVOR, { ...THE_TRAITORS, season: undefined, game: { preset: "survival-pool", span: { from: 14 } } }] }, { eps: 14 });
  assert.equal(StageLogic.crosses(one), false);
});

test("a stage beside the game on another season counts what aired by the game's end; one on the game's own season, as before", () => {
  // Survivor's Weekly Lineup to 9 (its 9th airing on day 56), The Traitors' bingo alongside on its own season, airing every 3 days.
  const spec = { stages: [{ id: "lineup", name: "Lineup", game: { preset: "weekly-lineup", span: { from: 1, to: 9 } } }, { id: "bingo", name: "Bingo", alongside: true, season: TRAITORS, game: { preset: "weekly-bingo" } }], overall: { by: "points" } };
  assert.deepEqual(ats(spec), []);
  const parent = league(spec);
  for (let k = 1; k <= 9; k++) gone(parent, k, k - 1);
  const lineup = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => entry(n, n === 9, { ann: n, bo: 1, cy: 0, di: 0 }, day(n * 7 - 7)));
  const bingo = Array.from({ length: 30 }, (_, i) => entry(i + 1, false, { di: (i + 1) * 5, ann: 0, bo: 0, cy: 0 }, day(i * 3)));
  const walk = { stages: [{ key: "lineup", leagueId: "zt-l", from: 1, to: 9, entries: lineup }, { key: "bingo", leagueId: "zt-b", from: 1, to: null, outside: true, season: "the-traitors-us/5", entries: bingo }] };
  const view = StageLogic.withWalk(parent, walk);
  const st = StageLogic.standings(view);
  // The game ended with Survivor 9 on day 56: The Traitors' bingo counts its episodes aired by then (days 0 to 54: 19 of them), over there.
  assert.deepEqual(st.map((x) => [x.key, x.over, x.rows[0].playerId, x.rows[0].points]), [["lineup", true, "ann", 9], ["bingo", true, "di", 19 * 5]]);
  assert.equal(StageLogic.endsAt(view), 9);
  assert.equal(S.gameOver(view), true, "a game whose own stages are on its season ends as before");
  // When a stage of the game's own has no air time (no schedule there), when the game ended can't be told: the bingo counts as it stands.
  const noTime = StageLogic.withWalk(parent, { stages: [{ ...walk.stages[0], entries: lineup.map(({ at, ...e }) => e) }, walk.stages[1]] });
  assert.deepEqual(StageLogic.standings(noTime).map((x) => [x.key, x.over, x.rows[0].points]), [["lineup", true, 9], ["bingo", true, 150]]);
  // Before the game's end, the bingo counts as it stands (through its 30th: the server's walk is through what's aired there).
  const mid = StageLogic.withWalk(parent, { stages: [{ ...walk.stages[0], entries: lineup.slice(0, 5) }, walk.stages[1]] });
  assert.deepEqual(StageLogic.standings(mid).map((x) => [x.key, x.over, x.rows[0].points]), [["lineup", false, 5], ["bingo", false, 150]]);
  // A game across two seasons with a stage beside it on its own season: what aired by the last own stage's end, anywhere.
  const across = { stages: [{ id: "lineup", name: "Lineup", game: { preset: "weekly-lineup", span: { from: 1, to: 9 } } }, { ...THE_TRAITORS, game: { preset: "survival-pool", span: { from: 1, to: 4 } } }, { id: "calls", name: "Calls", alongside: true, game: { preset: "weekly-calls" } }], overall: { by: "points" } };
  assert.deepEqual(ats(across), []);
  assert.deepEqual(G.fullSpec(across).stages[2].game.span, { from: 1, to: 9 }, "beside the game on its own season: the game's span there");
  const p2 = league(across);
  for (let k = 1; k <= 9; k++) gone(p2, k, k - 1);
  const pool = [1, 2, 3, 4].map((n) => entry(n, n === 4, { bo: n, ann: 0, cy: 0, di: 0 }, day(60 + n * 7)));
  const calls = Array.from({ length: 13 }, (_, i) => entry(i + 1, false, { cy: i + 1, ann: 0, bo: 0, di: 0 }, day(i * 7)));
  const w2 = { stages: [{ key: "lineup", leagueId: "zt-l", from: 1, to: 9, entries: lineup }, { key: "traitors", leagueId: "zt-t", from: 1, to: 4, season: "the-traitors-us/5", entries: pool }, { key: "calls", leagueId: "zt-c", from: 1, to: 9, outside: true, entries: calls.slice(0, 9) }] };
  const v2 = StageLogic.withWalk(p2, w2);
  assert.deepEqual(StageLogic.standings(v2).map((x) => [x.key, x.over, x.rows[0].points]), [["lineup", true, 9], ["traitors", true, 4], ["calls", true, 9]]);
  assert.equal(S.gameOver(v2), true);
  // The Traitors' pool not over yet: nothing beside it is over either.
  const w3 = { stages: [w2.stages[0], { ...w2.stages[1], entries: pool.slice(0, 2) }, w2.stages[2]] };
  assert.deepEqual(StageLogic.standings(StageLogic.withWalk(p2, w3)).map((x) => x.over), [true, false, false]);
  assert.equal(S.gameOver(StageLogic.withWalk(p2, w3)), false);
});
