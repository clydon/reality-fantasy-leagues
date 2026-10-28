// The engine reads specs (docs/PLAN-start-a-game-gpt.md step A2): state-logic.js works out the league type, its flags and
// every game setting from the league's game spec (settings.game when it carries one, else read from its settings), and
// every settings write goes through the spec's validator (RosterLogic.setGame): refused with its problems when it would
// leave a game nobody can play or grow past the one set of size limits, else today's fields written from the spec, with
// what a change does to the rest of the league (a draft's points when its ownership changes, a later start's episode,
// the waiver suggestion). A league carrying its spec carries the one its fields play after every write. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const clone = (v) => JSON.parse(JSON.stringify(v));

/** A league as Start a game makes one (makeLeague), without the database. */
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
/** The same league carrying its spec (the game-specs flag on). */
const carried = (s) => {
  s.settings.game = G.specOf(s.settings);
  return s;
};
const ats = (problems) => problems.map((p) => p.at);

test("the league types' flags are worked out from their presets, and are what they always were", () => {
  // The hand-written table from before A2.
  const was = {
    "classic-draft": { supportsReplenish: true, supportsTrade: true, supportsFinalePredictions: true, hasRoster: true, hasWeeklyPicks: false, hasActiveRoster: false },
    pickem: { supportsReplenish: false, supportsTrade: false, supportsFinalePredictions: false, hasRoster: false, hasWeeklyPicks: true, hasActiveRoster: false },
    "weekly-calls": { supportsReplenish: false, supportsTrade: false, supportsFinalePredictions: false, hasRoster: false, hasWeeklyPicks: false, hasActiveRoster: false, hasCalls: true },
    "weekly-bingo": { supportsReplenish: false, supportsTrade: false, supportsFinalePredictions: false, hasRoster: false, hasWeeklyPicks: false, hasActiveRoster: false, hasBingo: true },
    "active-roster": { supportsReplenish: true, supportsTrade: true, supportsFinalePredictions: true, hasRoster: true, hasWeeklyPicks: false, hasActiveRoster: true },
  };
  const flags = ["supportsReplenish", "supportsTrade", "supportsFinalePredictions", "hasRoster", "hasWeeklyPicks", "hasActiveRoster", "hasCalls", "hasBingo"];
  for (const [id, f] of Object.entries(was)) {
    for (const k of flags) assert.equal(!!S.LEAGUE_TYPES[id][k], !!f[k], `${id} ${k}`);
  }
  // Shared ownership: a blind draft; Outlast loses its waivers (no free agents), Weekly Lineup keeps them.
  const shared = (type) => S.getLeagueType(made(type, (s) => S.updateSettings(s, "ownershipMode", "shared")));
  assert.equal(shared("classic-draft").draftStrategy, S.BlindDraftStrategy);
  assert.deepEqual([shared("classic-draft").supportsReplenish, shared("classic-draft").supportsFinalePredictions], [false, true]);
  assert.deepEqual([shared("active-roster").supportsReplenish, shared("active-roster").id], [true, "active-roster"]);
});

test("the engine plays the spec a league carries, and its fields when it carries none", () => {
  const s = made("classic-draft");
  assert.equal(S.gameOf(s).preset, "outlast");
  // A carried spec decides, whatever a field says (nothing writes one without the other: this is the read only).
  const lineup = clone(s);
  lineup.settings.game = G.fullSpec({ ...G.PRESETS["weekly-lineup"], span: { from: 3, to: 9 } });
  assert.equal(S.getLeagueType(lineup).id, "active-roster");
  assert.deepEqual([S.rosterSize(lineup), S.ActiveRosterLogic.activeSlots(lineup), S.ActiveRosterLogic.benchSlots(lineup)], [5, 3, 2]);
  assert.deepEqual([S.startEpisode(lineup), S.endEpisode(lineup), S.inPlay(lineup, 2), S.inPlay(lineup, 9), S.inPlay(lineup, 10)], [3, 9, false, true, false]);
  assert.equal(S.GhostLogic.joinMode(lineup), "open");
  // One a game can't play, or half written, is passed over for the fields.
  for (const game of [{ spec: 1, get: { by: "squares" } }, { ...G.PRESETS["weekly-lineup"], extras: undefined }, "weekly-lineup", { ...G.PRESETS.outlast, spec: 2 }]) {
    const odd = clone(s);
    odd.settings.game = game;
    assert.equal(S.getLeagueType(odd).id, "classic-draft", JSON.stringify(game).slice(0, 60));
  }
  // Every reading of a league is the same carrying its spec or not.
  for (const type of ["classic-draft", "active-roster", "pickem", "weekly-calls", "weekly-bingo"]) {
    const plain = made(type, (x) => S.updateSettings(x, "waiverRecommendation", "competitive"));
    const both = carried(clone(plain));
    const read = (x) => [S.getLeagueType(x).id, S.rosterSize(x), S.WaiverLogic.supported(x) && S.WaiverLogic.config(x), S.GhostLogic.joinMode(x), S.finalePredictionsAvailable(x), S.computeScores(x)];
    assert.deepEqual(read(both), read(plain), type);
  }
});

test("every write goes through the spec's validator: refused with its problems, and nothing written", () => {
  const s = carried(made("active-roster"));
  const before = clone(s.settings);
  assert.deepEqual(ats(S.updateSettings(s, "activeSlots", 9)), ["count.start"], "a lineup starts 1 to 8");
  assert.deepEqual(ats(S.updateSettings(s, "benchSlots", 7)), ["get.each"], "and benches up to 6");
  assert.deepEqual(ats(S.updateSettings(s, "joinMode", "open").concat(S.updateSettings(s, "ownershipMode", "exclusive"))), []);
  assert.deepEqual(s.settings.joinMode, "open");
  // An exclusive draft with joinMode open reads as ask (GhostLogic): the spec says ask, so nothing's wrong.
  assert.equal(S.GhostLogic.joinMode(s), "ask");
  S.updateSettings(s, "ownershipMode", "shared");
  assert.deepEqual(s.settings.game, G.specOf(s.settings), "the carried spec follows every write");
  assert.deepEqual(ats(S.updateSettings(s, "defaultBetPoints", 9)), [], "clamped as it always was");
  assert.equal(s.settings.defaultBetPoints, 3);
  const refused = carried(made("classic-draft"));
  const was = clone(refused.settings);
  assert.deepEqual(ats(S.updateSettings(refused, "teamSize", 11)), ["get.each"], "an Outlast team is 1 to 10");
  assert.deepEqual(ats(S.updateSettings(refused, "teamSize", 0)), ["get.each"]);
  assert.deepEqual(refused.settings, was, "nothing written");
  assert.notDeepEqual(s.settings, before);
});

test("one set of size limits: a league already bigger keeps its size and can come down, never grow", () => {
  const big = made("classic-draft");
  big.settings.teamSize = 12; // classic's setup had no cap
  assert.deepEqual(ats(S.updateSettings(big, "bonusEnabled", false)), [], "the rest of it still changes");
  assert.deepEqual(ats(S.updateSettings(big, "teamSize", 13)), ["get.each"]);
  assert.deepEqual(ats(S.updateSettings(big, "teamSize", 11)), []);
  assert.equal(S.rosterSize(big), 11);
  assert.deepEqual(ats(S.updateSettings(big, "teamSize", 12)), ["get.each"], "and once down, it stays within reach of the limit");
  // The limits, one definition: the schema's.
  assert.deepEqual([G.MAX_TEAM, G.MAX_STARTERS, G.MAX_BENCH, G.MAX_LINEUP_TEAM], [10, 8, 6, 14]);
  const lineup = made("active-roster");
  Object.assign(lineup.settings, { activeSlots: 10, benchSlots: 8 });
  assert.deepEqual(ats(S.updateSettings(lineup, "activeSlots", 9)), [], "coming down");
  assert.deepEqual(ats(S.updateSettings(lineup, "benchSlots", 9)), ["get.each"], "the bench can't grow past 6");
});

test("what a change does to the rest of the league happens in the writer", () => {
  // A draft changing hands: points still at the old ownership's defaults move to the new one's; a hand-set one stays.
  const s = carried(made("active-roster", (x) => S.updateSettings(x, "ownershipMode", "exclusive")));
  const fmt = S.formatOf(s).events.find((e) => e.defaultPoints && typeof e.defaultPoints === "object" && e.defaultPoints.shared !== e.defaultPoints.exclusive);
  assert.ok(fmt, "a moment with ownership-dependent points");
  const other = S.formatOf(s).events.find((e) => e.id !== fmt.id && typeof e.defaultPoints === "number");
  S.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, [other.id]: 7 });
  assert.equal(s.settings.eventPoints[fmt.id], fmt.defaultPoints.exclusive);
  S.updateSettings(s, "ownershipMode", "shared");
  assert.equal(s.settings.eventPoints[fmt.id], fmt.defaultPoints.shared);
  assert.equal(s.settings.eventPoints[other.id], 7);
  assert.equal(S.ActiveRosterLogic.pointsFor(s, fmt.id), fmt.defaultPoints.shared);
  assert.deepEqual(s.settings.game, G.specOf(s.settings));
  // Guided setup: Weekly Lineup goes shared, its points with it, once.
  const setup = S.defaultState();
  S.updateSettings(setup, "leagueTypeId", "active-roster");
  assert.equal(setup.settings.ownershipMode, "shared");
  assert.equal(setup.settings.eventPoints[fmt.id], fmt.defaultPoints.shared);
  // A later start makes its episode.
  const late = made("pickem");
  S.updateSettings(late, "startEpisode", 6);
  assert.ok(late.episodes.some((e) => e.number === 6));
  // The waiver suggestion: provisional before the draft; a change by hand gives it up.
  const w = carried(made("classic-draft", (x) => { for (let i = 0; i < 18; i++) S.addCastaway(x, `Castaway ${i}`); }));
  S.updateSettings(w, "expectedTeams", 4);
  S.updateSettings(w, "waiverRecommendation", "balanced");
  assert.equal(w.settings.waiverFit, true);
  assert.equal(w.settings.expectedTeams, 4);
  assert.deepEqual(w.settings.game, G.specOf(w.settings));
  S.updateSettings(w, "waiverProcessHours", 48);
  assert.equal(w.settings.waiverFit, undefined);
  // A field the game doesn't use now is kept for when it does (classic's setup, any order).
  const dormant = made("active-roster");
  assert.deepEqual(S.updateSettings(dormant, "teamSize", 6), []);
  assert.equal(dormant.settings.teamSize, 6);
  S.updateSettings(dormant, "leagueTypeId", "classic-draft");
  assert.equal(S.rosterSize(dormant), 6);
});

test("setGame writes a whole spec: Start a game's presets, its span, and nothing nobody can play", () => {
  const s = carried(made("classic-draft"));
  const want = { ...G.PRESETS["survival-pool"], span: { from: 4, to: 8 }, score: { by: "survive", means: "scores", points: 2 } };
  assert.deepEqual(S.setGame(s, want), []);
  assert.equal(S.getLeagueType(s).id, "pickem");
  assert.deepEqual([S.startEpisode(s), S.endEpisode(s), S.PickEmLogic.byScore(s), s.settings.pickemCorrectPoints], [4, 8, true, 2]);
  assert.ok(s.episodes.some((e) => e.number === 4), "its first episode is made");
  assert.deepEqual(s.settings.game, G.fullSpec(want));
  const was = clone(s.settings);
  assert.deepEqual(ats(S.setGame(s, { ...G.PRESETS.outlast, get: { ...G.PRESETS.outlast.get, each: 30 } })), ["get.each"]);
  assert.deepEqual(ats(S.setGame(s, { ...G.PRESETS["weekly-lineup"], count: { all: true } })), [""], "no game plays a draft where all score moments yet");
  assert.deepEqual(ats(S.setGame(s, { ...G.PRESETS.outlast, span: { from: { phase: "merge" }, to: null } })), ["span.from"], "a phase start is A3's");
  assert.deepEqual(s.settings, was, "nothing written");
});

test("migrateLeagueState keeps a carried spec in step, and backfills an old save's waiver order as it was", () => {
  const s = carried(made("active-roster"));
  delete s.settings.eventPoints.votedOut;
  s.settings.game.score.points = { ...s.settings.eventPoints };
  S.migrateLeagueState(s);
  assert.equal(typeof s.settings.eventPoints.votedOut, "number");
  assert.deepEqual(s.settings.game, G.specOf(s.settings));
  // SurvivorDraft's saves, from before 'rolling', ordered waivers by most points when they had no order.
  const old = made("classic-draft");
  delete old.settings.replenishOrderBy;
  assert.equal(S.WaiverLogic.rolling(old), true, "a league made here with none reads the engine's default");
  assert.equal(S.migrateLeagueState(old).settings.replenishOrderBy, "mostPoints");
});

test("the flag's check (scripts/game-specs-flag.js): every kind of league plays the same carrying its spec", () => {
  const { checkLeague } = require("../scripts/game-specs-flag.js");
  const F = require("../db/game-specs.js");
  const cast = (x) => { for (let i = 0; i < 18; i++) S.addCastaway(x, `Castaway ${i}`); };
  const kinds = {
    outlast: made("classic-draft"),
    "outlast, shared": made("classic-draft", (x) => S.updateSettings(x, "ownershipMode", "shared")),
    "outlast, waivers": made("classic-draft", (x) => { cast(x); S.updateSettings(x, "waiverRecommendation", "competitive"); }),
    "weekly lineup, exclusive, a span": made("active-roster", (x) => { S.updateSettings(x, "ownershipMode", "exclusive"); S.updateSettings(x, "startEpisode", 3); S.updateSettings(x, "endEpisode", 7); }),
    "survival pool, by scoring, a call": made("pickem", (x) => S.setGame(x, { ...S.gameOf(x), score: { by: "survive", means: "scores", points: 2 }, extras: { ...S.gameOf(x).extras, calls: true } })),
    "weekly calls": made("weekly-calls"),
    "weekly bingo, locked down": made("weekly-bingo", (x) => S.updateSettings(x, "lockedDown", true)),
  };
  for (const [label, state] of Object.entries(kinds)) {
    const r = checkLeague(state);
    assert.ok(r.ok, `${label}: ${JSON.stringify(r)}`);
  }
  // On and off: carried, then not; a carried spec that drifted (written some way that skipped setGame) is put back.
  const s = made("active-roster");
  assert.equal(F.carryGame(s.settings, true), true);
  assert.equal(F.carryGame(s.settings, true), false, "already in step");
  s.settings.game.count = { start: 1 };
  assert.equal(F.carryGame(s.settings, true), true);
  assert.deepEqual(s.settings.game, G.specOf(s.settings));
  assert.equal(F.carryGame(s.settings, false), true);
  assert.equal("game" in s.settings, false);
});

test("a carried spec is played only when it's whole and sound; written around, it's brought back in step", () => {
  const s = made("classic-draft");
  for (const game of [
    { ...G.PRESETS["weekly-lineup"], span: { from: 1 } }, // half written: no end
    { ...G.PRESETS.outlast, get: { ...G.PRESETS.outlast.get, each: 0 } }, // nothing drafted
    { ...G.PRESETS.outlast, extras: { ...G.PRESETS.outlast.extras, join: "sometimes" } },
  ]) {
    const odd = clone(s);
    odd.settings.game = game;
    odd.settings.teamSize = 4;
    assert.deepEqual([S.getLeagueType(odd).id, S.rosterSize(odd), S.endEpisode(odd)], ["classic-draft", 4, null], JSON.stringify(game).slice(0, 80));
  }
  // An Undo puts fields back as they were, then the spec follows before anything reads it: the old waiver switches are
  // mirrored from what the fields now say (league-changes.ts).
  const w = carried(made("active-roster"));
  S.updateSettings(w, "replaceRule", "never");
  w.settings.replaceRule = "always";
  S.syncGame(w);
  S.WaiverLogic.mirrorLegacy(w);
  assert.deepEqual([S.WaiverLogic.replaceRule(w), w.settings.replenishEnabled], ["always", true]);
});

test("the season's stats read a Weekly Lineup's own points as it plays (season-stats.ts seasonFactsFor)", () => {
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { seasonFacts } = jiti("../src/lib/game/cast-stats.ts");
  const facts = (settings) => seasonFacts({ settings, cast: [], withTribes: false, decisions: [], seen: 0 });
  const id = S.formatOf(S.defaultState()).events.find((e) => !e.implied).id;
  assert.equal(S.ActiveRosterLogic.pointsFor(facts({ leagueTypeId: "active-roster", ownershipMode: "shared", eventPoints: { [id]: 99 } }), id), 99);
  // A facts league that isn't a Weekly Lineup scores by the rulebook's own (so the stats pass the game's type with them).
  assert.notEqual(S.ActiveRosterLogic.pointsFor(facts({ eventPoints: { [id]: 99 } }), id), 99);
});
