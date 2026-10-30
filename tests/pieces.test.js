// Today's games as compositions of the pieces (docs/PLAN-start-a-game-gpt.md step R1): a game's draft mechanic, its scorer and what
// it has come from its spec's own parts (state-logic.js piecesOf: get.order, score.by, game-spec flagsOf), never a league type,
// which only names a game for the screens now (getLeagueType: its words and flags, until R3). Each kind of league Start a game and
// classic make, and every game the tracker plays, plays the pieces its spec names, with the flags the screens read; the waivers'
// recommendation reads how a game scores; and nothing in scoring reads a league type or compares one by name, outside a list
// of what R1 part 2 and R3 still take. That the scores didn't move is the golden replays' (scripts/dev-test/golden.js) and the
// game-specs flag check's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const T = require("../scripts/engine-capabilities.js");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");

const clone = (v) => JSON.parse(JSON.stringify(v));
// The flags the screens read off the league type (state-logic.d.ts LeagueType), which the pieces carry too.
const FLAGS = ["hasRoster", "hasActiveRoster", "hasBestBall", "hasWeeklyPicks", "hasCalls", "hasQuestions", "hasBingo", "supportsReplenish", "supportsTrade", "supportsFinalePredictions"];
const flags = (o) => FLAGS.map((f) => !!o[f]);
// The pieces each part of a spec names.
const DRAFTS = { snake: "SnakeDraftStrategy", blind: "BlindDraftStrategy", draw: "DrawDraftStrategy", auction: "AuctionDraftStrategy" };
const SCORERS = { place: "EliminationOrderScoringStrategy", moments: "ActiveRosterEventScoringStrategy", survive: "PickEmScoringStrategy", answers: "CallsScoringStrategy", lines: "CallsScoringStrategy", stages: "StagesScoringStrategy" };

/** A league as makeLeague sets one up (tests/game-spec.test.js made), without the database. */
function made(type, after) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  S.updateSettings(s, "wikiSeason", 51);
  if (after) after(s);
  S.updateSettings(s, "setupComplete", true);
  return s;
}
const DEMO = {
  id: "zt-pieces", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: 12,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i, exitEpisode: Math.min(i + 1, 12), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out" })),
};
const demo = (type, after) => {
  const s = S.migrateLeagueState(clone(buildDemoState(DEMO, type, 6)));
  if (after) after(s);
  return s;
};
/** A league carrying `game` whole (the game-specs flag), so it's that game that plays. */
const carrying = (game) => ({ ...S.defaultState(), settings: { ...S.defaultState().settings, game } });

test("every kind of league today plays the pieces its spec names, with the flags the screens read", () => {
  const kinds = [
    ["Outlast", made("classic-draft"), "SnakeDraftStrategy", "EliminationOrderScoringStrategy"],
    ["Outlast, shared", made("classic-draft", (s) => S.updateSettings(s, "ownershipMode", "shared")), "BlindDraftStrategy", "EliminationOrderScoringStrategy"],
    ["Outlast, played, with finale predictions and side bets", demo("classic-draft", (s) => S.updateSettings(s, "finalePredictionsEnabled", true)), "SnakeDraftStrategy", "EliminationOrderScoringStrategy"],
    ["Weekly Lineup", made("active-roster"), "BlindDraftStrategy", "ActiveRosterEventScoringStrategy"],
    ["Weekly Lineup, exclusive", made("active-roster", (s) => S.updateSettings(s, "ownershipMode", "exclusive")), "SnakeDraftStrategy", "ActiveRosterEventScoringStrategy"],
    ["Weekly Lineup, played, Balanced waivers", demo("active-roster", (s) => S.updateSettings(s, "waiverRecommendation", "balanced")), "BlindDraftStrategy", "ActiveRosterEventScoringStrategy"],
    ["Survival Pool", made("pickem"), "NoDraftStrategy", "PickEmScoringStrategy"],
    ["Survival Pool, played", demo("pickem"), "NoDraftStrategy", "PickEmScoringStrategy"],
    ["a sport's pool", made("pickem", (s) => { s.settings.poolSurvive = "scores"; }), "NoDraftStrategy", "PickEmScoringStrategy"],
    ["Weekly Calls", made("weekly-calls"), "NoDraftStrategy", "CallsScoringStrategy"],
    ["Weekly Bingo", made("weekly-bingo"), "NoDraftStrategy", "CallsScoringStrategy"],
    ["a league with no game settings", S.defaultState(), "SnakeDraftStrategy", "EliminationOrderScoringStrategy"],
  ];
  for (const [label, state, draft, scorer] of kinds) {
    const p = S.piecesOf(state);
    assert.deepEqual([p.draft.name, p.scorer.name], [draft, scorer], label);
    assert.deepEqual(flags(p), flags(S.getLeagueType(state)), `${label}: the screens' flags`);
    assert.ok(Object.isFrozen(p), `${label}: read only`);
  }
  // The spec's parts that picked them.
  const at = (label) => S.piecesOf(kinds.find((k) => k[0] === label)[1]);
  assert.deepEqual([at("Weekly Lineup").holds, at("Weekly Lineup").counts, at("Weekly Lineup").scores, at("Weekly Lineup").ranks], ["draft", "start", "moments", "total"]);
  assert.deepEqual([at("Survival Pool").holds, at("Survival Pool").counts, at("Survival Pool").scores, at("Survival Pool").ranks], ["pick", "pick", "survive", "streak"]);
  assert.deepEqual([at("Outlast, shared").holds, at("Outlast, shared").counts, at("Outlast, shared").scores, at("Outlast, shared").supportsReplenish], ["draft", "all", "place", false]);
  // A carried spec's pieces are worked out once (it's replaced, never changed in place).
  const lineup = carrying(G.fullSpec({ preset: "weekly-lineup" }));
  assert.equal(S.piecesOf(lineup), S.piecesOf(lineup));
});

test("every game the tracker plays: the pieces its spec names, with the flags the screens read", () => {
  let n = 0;
  for (const x of T.statusRows(JSON.parse(fs.readFileSync(T.TRACKER, "utf8")))) {
    if (x.st.state !== "yes" || !x.row.spec) continue;
    const game = G.fullSpec(x.row.spec);
    const state = carrying(game);
    assert.equal(S.gameOf(state), game, `${x.row.id}: carried`);
    n++;
    const p = S.piecesOf(state);
    assert.equal(p.draft.name, game.get.by === "draft" ? DRAFTS[game.get.order] : "NoDraftStrategy", x.row.id);
    assert.equal(p.scorer.name, SCORERS[game.score.by], x.row.id);
    assert.deepEqual([p.holds, p.scores, p.ranks], [game.get.by, game.score.by, game.rank.by], x.row.id);
    assert.deepEqual(flags(p), flags(S.getLeagueType(state)), `${x.row.id}: the screens' flags`);
  }
  assert.ok(n >= 150, `the tracker's games (${n})`);
});

test("drafting and scoring go through the pieces: a draw, an auction, best ball, a game in stages", () => {
  const draw = G.fullSpec({ preset: "outlast", get: { by: "draft", each: 2, order: "draw", own: "exclusive" } });
  const auction = G.fullSpec({ preset: "outlast", get: { by: "draft", each: 2, order: "auction", own: "exclusive" } });
  const best = G.fullSpec({ preset: "weekly-lineup", count: { best: 2 } });
  for (const [label, game, draft, scorer] of [
    ["a draw", draw, S.DrawDraftStrategy, S.EliminationOrderScoringStrategy],
    ["an auction", auction, S.AuctionDraftStrategy, S.EliminationOrderScoringStrategy],
    ["best ball", best, S.BlindDraftStrategy, S.ActiveRosterEventScoringStrategy],
  ]) {
    const state = carrying(game);
    assert.equal(S.gameOf(state), game, `${label}: carried`);
    assert.deepEqual([S.piecesOf(state).draft, S.piecesOf(state).scorer], [draft, scorer], label);
    // The league type names it the way its ownership and count make it (the screens' Outlast or Weekly Lineup).
    assert.deepEqual(flags(S.piecesOf(state)), flags(S.getLeagueType(state)), label);
  }
  assert.deepEqual([S.getLeagueType(carrying(draw)).id, S.getLeagueType(carrying(auction)).id], ["classic-draft", "classic-draft"]);
  assert.deepEqual([S.piecesOf(carrying(best)).hasBestBall, S.piecesOf(carrying(best)).hasActiveRoster], [true, false]);
  // The draft dispatches to the draw's piece: it deals, nobody takes a turn.
  const s = made("classic-draft");
  assert.deepEqual(S.setGame(s, { ...draw, get: { ...draw.get, each: 1 } }), []);
  assert.equal(S.currentDraftTurn(s), null);
});

test("the waivers' recommendation reads how the game scores: the boot order or moments, never a league type", () => {
  const W = S.WaiverLogic;
  const base = { C: 18, E: 13, T: 4, R: 3, S: 3 };
  assert.equal(W.recommend({ ...base, scores: "survive" }), null, "a pool has no waivers");
  assert.equal(W.recommend({ ...base, scores: "answers" }), null);
  assert.equal(W.recommend({ ...base, scores: "place", shared: true }), null, "nor a shared Outlast");
  assert.deepEqual(W.recommend({ ...base, scores: "place" }).settings.waiverWindows, { schedule: "manual", every: 3, swaps: 3 }, "Outlast's windows are the commissioner's");
  assert.equal(W.recommend({ ...base, scores: "moments" }).settings.waiverWindows.schedule, "every");
  // A league's own reads its spec's.
  assert.equal(W.recommendFor(demo("active-roster")).feasible, true);
  assert.equal(W.recommendFor(demo("classic-draft")).settings.waiverWindows.schedule, "manual");
  assert.equal(W.recommendFor(made("pickem")), null);
});

// What still reads a league type or compares one by name, outside the spec's own vocabulary (game-spec/) and the screens
// (src/components, src/new): each file and the step that takes it. Everything else under src/lib and src/app/api reads the
// pieces. A file that no longer needs its line fails this test until the line goes, so the list only shrinks.
const STILL = {
  // R1 part 2: Weekly Calls, Weekly Bingo and the game of questions (the games scored outside the state).
  "src/lib/server/answer-points.ts": "R1 part 2",
  "src/lib/server/answers.ts": "R1 part 2",
  "src/lib/server/bingo.ts": "R1 part 2",
  "src/lib/server/calls.ts": "R1 part 2",
  "src/lib/server/season-games.ts": "R1 part 2",
  "src/app/api/me/route.ts": "R1 part 2",
  // R3: the type field's writers (Start a game, the lab, the practice couch, the tours, classic's setup) and the screens' readers.
  "src/lib/server/backstage-games.ts": "R3",
  "src/lib/server/backstage.ts": "R3",
  "src/lib/server/couch-joins.ts": "R3",
  "src/lib/server/end-game.ts": "R3",
  "src/lib/server/engine-lab.ts": "R3",
  "src/lib/server/start-game.ts": "R3",
  "src/lib/server/solo.ts": "R3",
  "src/lib/game/action-items.js": "R3",
  "src/lib/game/commissioner-items.ts": "R3",
  "src/lib/game/league-tabs.ts": "R3",
  "src/lib/game/status-plate.ts": "R3",
  "src/lib/game/practice.ts": "R3",
  "src/lib/game/demo-season-builder.ts": "R3",
  "src/lib/overview-layout.ts": "R3",
  "src/lib/tour/practice.ts": "R3",
  "src/lib/tour/practice-steps.ts": "R3",
  "src/lib/tour/use-practice-round.ts": "R3",
};
const TYPE_IDS = "classic-draft|active-roster|pickem|weekly-calls|weekly-bingo|questions|stages";
const COMPARED = new RegExp(`[!=]==\\s*["'](${TYPE_IDS})["']|["'](${TYPE_IDS})["']\\s*[!=]==`);
const code = (text) => text.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
// A spec's own part compared (score.by === 'stages', by('get') === 'none') is the spec, not a league type.
const named = (l) => COMPARED.test(l.replace(/(\.by|by\(["']\w+["']\))\s*[!=]==\s*["'][\w-]+["']/g, ""));
const reads = (lines) => lines.filter((l) => /getLeagueType\(/.test(l) || named(l));

test("nothing in scoring reads a league type or compares one by name (what's left is named, with its step)", () => {
  const root = path.join(__dirname, "..");
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(rel);
    }
  };
  walk("src/lib");
  walk("src/app/api");
  const found = files.filter((f) => !f.startsWith("src/lib/game/game-spec/") && f !== "src/lib/game/state-logic.js")
    .filter((f) => reads(code(fs.readFileSync(path.join(root, f), "utf8"))).length);
  assert.deepEqual(found.filter((f) => !STILL[f]), [], "these read a league type: read the pieces (StateLogic.piecesOf) instead");
  assert.deepEqual(Object.keys(STILL).filter((f) => !found.includes(f)), [], "these no longer read one: take them off the list");
  // In state-logic.js itself: only the setup checklist's words read the league type (its name), and only the league type's own
  // machinery (its flags and its best ball variant) and classic's setup writing the type field name one.
  const engine = code(fs.readFileSync(path.join(root, "src/lib/game/state-logic.js"), "utf8"));
  assert.deepEqual(engine.filter((l) => /getLeagueType\(state\)/.test(l) && !/^\s*function /.test(l)).map((l) => l.trim()), ["value: getLeagueType(state).name },"]);
  assert.deepEqual(engine.filter(named).map((l) => l.trim().slice(0, 40)), ["Object.values(LEAGUE_TYPES).forEach(lt =", "if(base.id === 'active-roster' && Spec.c", "if(field === 'leagueTypeId' && value ==="]);
});
