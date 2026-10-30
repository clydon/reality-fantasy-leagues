// The game spec (docs/PLAN-start-a-game-gpt.md step A1; src/lib/game/game-spec/): today's five games as presets, every
// league's settings to a spec and back with nothing lost, the spec in words (How it works says what the Rules sheet,
// game-rules.ts, says), what's wrong with a spec (the data-can-settle rule among it), what a spec waits for, and the
// plan's three examples (tests/fixtures/game-specs.js). "Nothing lost" is checked against the engine itself: a league's
// own spec fields taken out and written back from the spec alone, every reading state-logic.js makes of its settings (its
// game type, roster, waivers, joining, span, points, scores...) is the same. Every league in the local database too,
// read only, skipped when there isn't one. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const G = require("../src/lib/game/game-spec/index.js");
const S = require("../src/lib/game/state-logic.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const survivorBlocks = require("../src/lib/game/formats/blocks/survivor.blocks.js").blocks;
const { gameRules } = jiti("../src/lib/game/game-rules.ts");
const { draftTimer } = jiti("../src/lib/game/draft-view.ts");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const EXAMPLES = require("./fixtures/game-specs.js");

const clone = (v) => JSON.parse(JSON.stringify(v));
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/** A league as makeLeague (src/lib/server/new-game.ts) sets one up for Start a game, without the database. */
function made(type, after) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", type);
  S.updateSettings(s, "revealedThroughEpisode", null);
  S.updateSettings(s, "wikiSeason", 51);
  if (after) after(s);
  S.updateSettings(s, "setupComplete", true);
  return s;
}

/** A demo season part-played (three players, 20 castaways, 12 episodes), so drafts, picks and results score. */
const DEMO = {
  id: "zt-spec", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: 12,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i, exitEpisode: Math.min(i + 1, 12), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out" })),
};
const demo = (type, after) => {
  const s = S.migrateLeagueState(clone(buildDemoState(DEMO, type, 6)));
  if (after) after(s);
  return s;
};

// What each kind of game is made of, written here apart from the spec's own code, so a field the spec forgets is caught:
// the round trip takes these out of a league and writes them back from its spec alone.
const WAIVER_FIELDS = ["replaceRule", "replenishAt", "waiverWindows", "waiverFeel", "autoFill", "replenishOrderBy", "waiverProcessHours", "freeAgencyEnabled", "replenishEnabled", "tradeEnabled", "swapEvery"];
// A10 part 3: a draw and a draft spread across the cast's groups; part 3b: an auction and a draft's prices; part 4: keepers.
// A11 part 1: a draft's rank (a stock market's worth, or last one standing), its race and its cuts; part 2, whether one left ends it.
const DRAFT_FIELDS = ["ownershipMode", "draftScheduledAt", "draftTimer", "draftAway", "finalePredictionsEnabled", "finaleTop3Points", "finaleWinnerPoints", "finalePredictionScope", "draftDraw", "draftAcross", "draftAuction", "draftBudget", "draftKeep", "draftRank", "draftRace", "draftCut", "rankOneLeft"];
const GAME_FIELDS = {
  every: ["leagueTypeId", "startEpisode", "startPhase", "endEpisode", "allowLateJoiners", "joinMode", "lockedDown", "bonusEnabled", "defaultBetPoints"],
  // A9 part 2: Outlast in reverse; best ball, a lineup's captain, points that multiply by when. A10 part 3c: a stock market
  // ranked by worth.
  "classic-draft": [...DRAFT_FIELDS, "teamSize", "reverseOrder"],
  "active-roster": [...DRAFT_FIELDS, "activeSlots", "benchSlots", "eventPoints", "hideStartersUntilLock", "bestBall", "captainTimes", "pointsTimes", "groupSlots"],
  // A10 part 2: a pool's lives, buyback, mulligans, second pick and last one standing. A11 part 2: a pick that never repeats and
  // its fallback; last one standing's end.
  pickem: ["pickemCorrectPoints", "poolSurvive", "calls", "poolLives", "poolBuyback", "poolMulligans", "poolSecond", "poolRank", "seatPeople", "poolRepeat", "poolFallback", "rankOneLeft", "rankAllOut"],
  "weekly-calls": [],
  // A9: points per line; a game of questions' parlays.
  "weekly-bingo": ["linePoints"],
  // A11 part 2b: a game of questions' lives (on which questions), race and cuts, and its end.
  questions: ["questions", "lateLockHours", "parlays", "seatPeople", "questionsLives", "questionsLivesOn", "questionsRace", "questionsCut", "rankOneLeft", "rankAllOut"],
};
// A10 part 4b: a team two people share, wherever a seat has something to share (not a call or a bingo card).
GAME_FIELDS["classic-draft"].push("seatPeople");
GAME_FIELDS["active-roster"].push("seatPeople");
const gameFields = (state) => [...GAME_FIELDS.every, ...GAME_FIELDS[S.getLeagueType(state).id], ...(S.WaiverLogic.supported(state) ? WAIVER_FIELDS : [])];

/** Everything state-logic.js reads of a league's settings, as it reads it (what's switched off, not what it would be). */
function readings(state) {
  const t = S.getLeagueType(state);
  const W = S.WaiverLogic;
  const A = S.ActiveRosterLogic;
  const st = state.settings;
  const ids = [...new Set([...Object.keys(st.eventPoints || {}), ...S.formatOf(state).events.map((e) => e.id)])].sort();
  const finale = S.finalePredictionsAvailable(state);
  return {
    type: [t.id, t.draftStrategy.name, t.scoringStrategy.name],
    flags: ["hasRoster", "hasWeeklyPicks", "hasActiveRoster", "hasCalls", "hasQuestions", "hasBingo", "supportsReplenish", "supportsTrade", "supportsFinalePredictions"].map((f) => !!t[f]),
    roster: [S.rosterSize(state), A.activeSlots(state), A.benchSlots(state), st.ownershipMode === "shared"],
    span: [S.startEpisode(state), S.startPhase(state), S.endEpisode(state), S.gameOver(state), state.episodes.map((e) => S.inPlay(state, e.number))],
    waivers: W.supported(state)
      ? {
          config: W.config(state), rule: W.replaceRule(state), windows: W.windows(state), hours: W.processHours(state),
          freeAgency: W.freeAgencyOn(state), rolling: W.rolling(state), order: st.replenishOrderBy || "rolling", shortAt: W.shortAt(state),
          enabled: W.enabled(state), replenish: S.replenishAvailable(state), trade: S.tradeAvailable(state), swapEvery: S.MidSeasonLogic.swapEvery(state),
        }
      : null,
    join: [S.GhostLogic.joinMode(state), S.GhostLogic.allowed(state), S.GhostLogic.lockedDown(state)],
    finale: finale ? [st.finaleTop3Points || 0, st.finaleWinnerPoints || 0, st.finalePredictionScope === "ownPicksOnly"] : null,
    // As the engine reads them (A4): only beside a draft, the games that score them.
    bets: S.betsOn(state) ? [true, S.betsOn(state).points] : [false, null],
    questions: S.gameOf(state).ask,
    draft: [draftTimer(state), st.draftScheduledAt || null],
    pool: [typeof st.pickemCorrectPoints === "number" ? st.pickemCorrectPoints : 1, S.PickEmLogic.byScore(state), S.PickEmLogic.callsOn(state)],
    points: ids.map((id) => [id, A.pointsFor(state, id)]),
    hideStarters: st.hideStartersUntilLock === true,
    scores: S.computeScores(state).map((r) => [r.playerId, r.total, r.locked, r.bonus, r.finale, r.longestStreak ?? null]),
  };
}

/** The round trip, on one league: its spec is valid, carries everything (rebuilt from the spec alone it plays the same),
 *  writes back nothing it didn't already say, and reads back as itself; How it works is the Rules sheet's. */
function roundTrip(state, label) {
  const st = state.settings;
  const spec = G.specOf(st);
  assert.deepEqual(G.specProblems(spec), [], `${label}: its spec has no problems`);
  assert.deepEqual(G.specWaitsFor(spec), [], `${label}: today's engine plays it`);
  assert.equal(G.typeOf(spec), S.getLeagueType(state).id, `${label}: the spec plays as its league type`);
  const owned = G.ownedFields(spec);
  const rebuilt = { ...state, settings: G.withSpec(omit(st, [...new Set([...owned, ...gameFields(state)])]), spec) };
  assert.deepEqual(readings(rebuilt), readings(state), `${label}: rebuilt from its spec alone, it plays the same`);
  assert.deepEqual(G.withSpec(st, spec), st, `${label}: writing its own spec back changes nothing`);
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, spec)), spec, `${label}: written onto a new league, it reads as the same spec`);
  assert.deepEqual(G.fullSpec(spec), spec, `${label}: specOf gives a whole spec`);
  const f = S.formatOf(state);
  const ctx = { castaway: f.terms.castaway.toLowerCase(), groups: f.eventCategories.map((c) => c.label).filter(Boolean) };
  // The Rules sheet reads the league's spec (A2): the one it carries, or this one.
  assert.deepEqual(G.describeSpec(spec, ctx).rules, gameRules(state), `${label}: How it works is the Rules sheet's`);
  return spec;
}

test("the settings fields a spec can write are exactly what the games are made of", () => {
  const all = [...new Set(Object.values(GAME_FIELDS).flat().concat(WAIVER_FIELDS))].sort();
  assert.deepEqual([...G.OWNED].sort(), all);
  assert.deepEqual(G.OWNED.filter((k) => G.OUTSIDE.includes(k)), [], "nothing is both");
});

test("the presets: whole, valid, played today as the league type each names, and back from their own settings", () => {
  assert.deepEqual(Object.keys(G.PRESETS).sort(), ["outlast", "survival-pool", "weekly-bingo", "weekly-calls", "weekly-lineup"]);
  for (const [id, p] of Object.entries(G.PRESETS)) {
    assert.equal(p.preset, id);
    assert.deepEqual(G.fullSpec(p), p, `${id} is whole`);
    assert.deepEqual(G.specProblems(p), [], `${id} has no problems`);
    assert.deepEqual(G.specWaitsFor(p), [], `${id} is played today`);
    assert.equal(G.typeOf(p), G.PRESET_TYPES[id]);
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, p)), p, `${id} reads back from the settings it writes`);
  }
  // Only the mechanics decide the game: a preset's name on another game's parts doesn't make it that game.
  assert.equal(G.typeOf({ ...G.PRESETS.outlast, preset: "weekly-lineup" }), "classic-draft");
});

test("the presets are what Start a game makes today", () => {
  const sameBut = (state, preset, label) => {
    const spec = G.specOf(state.settings);
    assert.deepEqual({ ...spec, score: null }, { ...G.PRESETS[preset], score: null }, label);
    return spec;
  };
  sameBut(made("classic-draft"), "outlast", "Outlast");
  sameBut(made("pickem"), "survival-pool", "Survival Pool");
  sameBut(made("weekly-calls"), "weekly-calls", "Weekly Calls");
  sameBut(made("weekly-bingo"), "weekly-bingo", "Weekly Bingo");
  // Weekly Lineup: the shared blind draft, 5 each, 3 start. Its points are defaultState's copy of the rulebook's own,
  // made before the show is known: a map rather than null, scoring the same.
  const wl = made("active-roster");
  const spec = sameBut(wl, "weekly-lineup", "Weekly Lineup");
  assert.equal(typeof spec.score.points, "object");
  const own = { ...wl, settings: G.withSpec(wl.settings, G.PRESETS["weekly-lineup"]) };
  assert.equal(own.settings.eventPoints, undefined, "the preset's null points leave the rulebook's own");
  assert.deepEqual(readings(own).points.filter(([id]) => S.formatOf(wl).events.some((e) => e.id === id)), readings(wl).points.filter(([id]) => S.formatOf(wl).events.some((e) => e.id === id)));
  // On a sport: Weekly Lineup is already the shared draft, and a pool pick survives by scoring.
  assert.equal(sameBut(made("pickem", (s) => (s.settings.poolSurvive = "scores")), "survival-pool", "a sport's pool").score.means, "scores");
});

test("every kind of league round-trips through its spec", () => {
  const kinds = {
    "Outlast": made("classic-draft"),
    "Outlast, shared (no waivers)": made("classic-draft", (s) => S.updateSettings(s, "ownershipMode", "shared")),
    "Outlast, played": demo("classic-draft"),
    "Outlast, a span": demo("classic-draft", (s) => { S.updateSettings(s, "startEpisode", 2); S.updateSettings(s, "endEpisode", 4); }),
    "Weekly Lineup": made("active-roster"),
    "Weekly Lineup, exclusive": made("active-roster", (s) => S.updateSettings(s, "ownershipMode", "exclusive")),
    "Weekly Lineup, played": demo("active-roster"),
    "Weekly Lineup, Balanced waivers and its own points": demo("active-roster", (s) => {
      S.updateSettings(s, "waiverRecommendation", "balanced");
      S.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, votedOut: -7 });
      S.updateSettings(s, "hideStartersUntilLock", true);
    }),
    "Weekly Lineup, everything changed": demo("active-roster", (s) => {
      S.updateSettings(s, "waiverRecommendation", "competitive");
      S.updateSettings(s, "replaceRule", "whenShort");
      S.updateSettings(s, "replenishAt", 1);
      S.updateSettings(s, "waiverWindows", { schedule: "everyEpisode", swaps: 2 });
      S.updateSettings(s, "joinMode", "ask");
      S.updateSettings(s, "lockedDown", true);
      S.updateSettings(s, "draftTimer", 60);
      S.updateSettings(s, "draftAway", "queue");
      S.updateSettings(s, "draftScheduledAt", "2026-10-28T23:00:00.000Z");
      S.updateSettings(s, "finalePredictionsEnabled", true);
      S.updateSettings(s, "finalePredictionScope", "ownPicksOnly");
      S.updateSettings(s, "bonusEnabled", false);
    }),
    "Survival Pool": made("pickem"),
    "Survival Pool, played": demo("pickem"),
    "the public pool (a weekly call)": made("pickem", (s) => { s.settings.calls = true; }),
    "a sport's pool (survive by scoring)": made("pickem", (s) => { s.settings.poolSurvive = "scores"; }),
    "Survival Pool, nobody new": made("pickem", (s) => S.updateSettings(s, "joinMode", "locked")),
    "Weekly Calls": made("weekly-calls"),
    "Weekly Bingo": made("weekly-bingo", (s) => S.updateSettings(s, "endEpisode", 9)),
    // A phase start (step A3 part 2): waiting for the merge (nothing in play), and settled where it starts.
    "Weekly Lineup, waiting for the merge": made("active-roster", (s) => S.updateSettings(s, "startPhase", "merged")),
    "Survival Pool, played, waiting for the merge": demo("pickem", (s) => S.updateSettings(s, "startPhase", "merged")),
    "Outlast, played, from the merge (settled at 8)": demo("classic-draft", (s) => {
      S.updateSettings(s, "startPhase", "merged");
      S.settleStart(s, { from: 8, open: 7 });
    }),
    "Weekly Lineup, played, from the merge (settled at 4), through 10": demo("active-roster", (s) => {
      S.updateSettings(s, "startPhase", "merged");
      S.settleStart(s, { from: 3, open: 4 });
      S.updateSettings(s, "endEpisode", 10);
    }),
    "classic's late-joiner switch off": made("classic-draft", (s) => S.updateSettings(s, "allowLateJoiners", false)),
    "pre-v2 waiver switches only": demo("classic-draft", (s) => {
      for (const k of ["replaceRule", "waiverWindows", "waiverFeel", "autoFill"]) delete s.settings[k];
      Object.assign(s.settings, { replenishEnabled: true, tradeEnabled: true, swapEvery: 2 });
    }),
  };
  for (const [label, state] of Object.entries(kinds)) roundTrip(state, label);
  // The phase starts read as they were written: waiting is the phase with no episode, settled is both.
  assert.deepEqual(G.specOf(kinds["Weekly Lineup, waiting for the merge"].settings).span, { from: { phase: "merged" }, to: null });
  assert.deepEqual([kinds["Weekly Lineup, waiting for the merge"].settings.startEpisode, kinds["Weekly Lineup, waiting for the merge"].settings.startPhase], [null, "merged"]);
  assert.deepEqual(G.specOf(kinds["Outlast, played, from the merge (settled at 8)"].settings).span, { from: { phase: "merged", at: 8 }, to: null });
  assert.deepEqual(G.specOf(kinds["Weekly Lineup, played, from the merge (settled at 4), through 10"].settings).span, { from: { phase: "merged", at: 4 }, to: 10 });
});

test("the Rules sheet (game-rules.ts, describeSpec since A2) says what it always did, and now a sport's pool and finale predictions", () => {
  const sheet = (type, after) => gameRules(made(type, after));
  const BETS = "Predictions: a right answer earns its points (usually 1), once at least two of you have answered.";
  assert.deepEqual(sheet("classic-draft"), [
    "Snake-draft a team of three: once someone picks a castaway, nobody else can have them.",
    "Each castaway earns 1 point, plus 1 for every boot they outlast.",
    "So they end on their place in the boot order: the last one standing carries you.",
    "No lineups to set. Just watch.",
    BETS,
  ]);
  assert.deepEqual(sheet("active-roster", (s) => { S.updateSettings(s, "startEpisode", 3); S.updateSettings(s, "endEpisode", 9); }), [
    "Draft a team of five in private; everyone's picks are revealed at once, and the same castaway can be on more than one team.",
    "Before each episode, start three. Only starters score.",
    "Points come from what happens: Idols & Advantages, Challenges, Tribal Council, Journeys & Exile, Endgame and Leaving the game.",
    "Lineups lock when the episode starts. Change yours as often as you like until then.",
    BETS,
    "Scoring starts at Episode 3; the episodes before it are history.",
    "It ends with Episode 9: nothing after it scores, and the table there is final.",
  ]);
  // A pool never scored side bets, so its sheet says nothing of them, switched on or not (A4).
  assert.deepEqual(sheet("pickem"), sheet("pickem", (s) => S.updateSettings(s, "bonusEnabled", false)));
  assert.deepEqual(sheet("pickem"), [
    "No draft. Before each episode, pick one castaway you think stays in.",
    "Right: your streak grows. Wrong, or no pick: it resets. Your best streak still counts.",
    "You can't pick the same castaway again until you've used everyone still in, and never two episodes in a row.",
    "Longest streak wins; ties go to the most right picks.",
  ]);
  assert.deepEqual(sheet("weekly-calls"), [
    "No draft, no team. Before each show starts, make two calls about what will happen in it.",
    "The couch says what happened as it watches: two of you agreeing settles a call.",
    "Change your calls until it starts. Nobody sees them until then.",
    "Most right calls by the finale wins.",
  ]);
  assert.deepEqual(sheet("weekly-bingo", (s) => S.updateSettings(s, "endEpisode", 1)), [
    "No draft, no team. Every show you get a new bingo card: eight things that might happen, the middle one free.",
    "Tick a square when it happens. Three in a row, down or across makes a line.",
    "A square counts once the couch agrees it happened: two of you ticking it, or saying so, settles it.",
    "Most lines by the finale wins.",
    "It's one episode: Episode 1, then it's over.",
  ]);
  // A sport's pool survives by scoring, and the sheet says so; finale predictions are on it when they're on.
  assert.equal(sheet("pickem", (s) => S.setGame(s, { ...S.gameOf(s), score: { by: "survive", means: "scores", points: 1 } }))[0], "No draft. Before each episode, pick one castaway you think scores in it.");
  const finale = sheet("classic-draft", (s) => { S.updateSettings(s, "finalePredictionsEnabled", true); S.updateSettings(s, "finalePredictionScope", "ownPicksOnly"); });
  assert.equal(finale[finale.length - 1], "Finale predictions: before the finale, name your final three and the winner from your own team. 1 point for each of the three you get, 3 points for the winner.");
});

test("the three examples: their specs, what the wizard says, and what each waits for", () => {
  for (const ex of EXAMPLES) {
    assert.deepEqual(G.specProblems(ex.spec), [], `${ex.name}: well formed`);
    assert.deepEqual(G.specProblems(ex.spec, ex.ctx), [], `${ex.name}: data settles everything it scores and asks`);
    const d = G.describeSpec(ex.spec, ex.ctx);
    assert.equal(d.sentence, ex.sentence, ex.name);
    assert.equal(d.parts.map((p) => p.text).join(""), d.sentence);
    assert.equal(G.typeOf(ex.spec), ex.type, ex.name);
    assert.deepEqual(G.specWaitsFor(ex.spec).map(({ at, step }) => ({ at, step })), ex.waits, ex.name);
    assert.equal(G.settingsOf(ex.spec) === null, ex.type === null, `${ex.name}: settings only for a game played today`);
  }
  const [survivor, series, opener] = EXAMPLES;
  // Survivor 51's Weekly Lineup is today's game, starting at Episode 7, and Survivor's moments are all research's (or known
  // from them), so the rulebook's own points pass the data rule.
  const s = made("active-roster");
  const plays = { ...s, settings: G.withSpec(s.settings, survivor.spec) };
  assert.deepEqual(readings(plays).span.slice(0, 2), [7, null]);
  assert.deepEqual(readings(plays).roster, [5, 3, 2, true]);
  assert.deepEqual(G.specProblems(survivor.spec, { moments: momentsFor(survivorBlocks) }), []);
  assert.deepEqual(G.describeSpec(survivor.spec, survivor.ctx).parts.filter((p) => p.at).map((p) => p.at), ["preset", "about", "get", "count", "span", "score"]);
  // Total bases aren't one of ESPN's per-player columns (the sports branch counts them from the plays): without them,
  // nothing settles the TB points.
  const espnOnly = { ...series.ctx, stats: series.ctx.stats.filter((x) => x.key !== "TB") };
  assert.deepEqual(G.specProblems(series.spec, espnOnly).map((p) => p.at), ["score.points.TB"]);
  // A top scorer needs the sport's points stat; the over/under's line can wait for the wizard (or ESPN's).
  assert.deepEqual(G.specProblems(opener.spec, { ...opener.ctx, stats: [] }).map((p) => p.at), ["ask[1].settle.stat"]);
  const withLine = clone(opener.spec);
  withLine.ask[2].line = 237.5;
  assert.match(G.describeSpec(withLine, opener.ctx).sentence, /total points: over or under \(237\.5\)\./);
  assert.ok(G.describeSpec(withLine, opener.ctx).rules.includes("Total points: over or under? The line is 237.5. 1 point if you're right."));
});

test("the data-can-settle rule: research's moments, the sport's stats, and settles data can do", () => {
  const moments = [
    { id: "votedOut", label: "Voted out", defaultPoints: -3, answeredBy: "research" },
    { id: "winner", label: "Wins", defaultPoints: 5, auto: true },
    { id: "cried", label: "Cries at tribal", defaultPoints: 1, answeredBy: "league" },
  ];
  const wl = (points) => ({ ...G.PRESETS["weekly-lineup"], score: { by: "moments", points } });
  const at = (spec, opts) => G.specProblems(spec, { moments }, opts).map((p) => p.at);
  assert.deepEqual(at(wl({ votedOut: -2, winner: 6, cried: 0 })), [], "research's, one known from them, and the couch's at 0");
  assert.deepEqual(at(wl({ cried: 2 })), ["score.points.cried"], "the couch's word can't settle it");
  assert.deepEqual(at(wl({ votedOut: -2 })), ["score.points.cried"], "left out of the points, it still scores the rulebook's own");
  assert.deepEqual(at(wl(null)), ["score.points.cried"], "the rulebook's own points include the couch's moment");
  assert.deepEqual(at({ ...wl(null), get: { by: "draft", each: 5, order: "snake", own: "exclusive" } }, undefined), ["score.points.cried"]);
  assert.deepEqual(G.specProblems(wl(null), { moments: moments.slice(0, 2) }), []);
  assert.deepEqual(at(wl({ cried: 0, dances: 1 })), ["score.points.dances"], "not one of the show's moments");
  // A league's own (A2's writes): its couch moments (Make it ours) and its leftover ids from another format stay as they are.
  assert.deepEqual(at(wl({ cried: 2, dances: 1 }), { league: true }), []);
  const off = [{ ...moments[2], off: true }];
  assert.deepEqual(G.specProblems(wl(null), { moments: off }), [], "a moment switched off doesn't score");
  assert.deepEqual(G.specProblems(wl({ cried: 2 }), { moments: off }), [], "whatever its points say");

  const asks = (q) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "q", ask: "?", points: 1, ...q }] });
  assert.deepEqual(G.specProblems(asks({ answer: "yesNo", settle: { by: "moment", moment: "votedOut", take: "happened" } }), { moments }), []);
  assert.deepEqual(G.specProblems(asks({ answer: "yesNo", settle: { by: "moment", moment: "cried", take: "happened" } }), { moments }).map((p) => p.at), ["ask[0].settle.moment"]);
  assert.deepEqual(G.specProblems(asks({ answer: "person", settle: { by: "results", take: "out" } }), { moments, results: false }).map((p) => p.at), ["ask[0].settle"], "a series' results don't say who goes home");
  assert.deepEqual(G.specProblems(asks({ answer: "number", settle: { by: "stat", stat: "HR", take: "value" } }), { stats: ["HR"] }), []);
  // Without ctx only the shape is checked.
  assert.deepEqual(G.specProblems(asks({ answer: "yesNo", settle: { by: "moment", moment: "cried", take: "happened" } })), []);
});

test("specProblems: what's wrong with a spec's shape", () => {
  const P = G.PRESETS;
  const at = (spec) => G.specProblems(spec).map((p) => p.at);
  assert.deepEqual(G.specProblems(null), [{ at: "", problem: "A game spec is an object" }]);
  assert.deepEqual(at({ ...P.outlast, spec: 2 }), ["spec"]);
  assert.deepEqual(at({ ...P.outlast, preset: "fantasy" }), ["preset"]);
  assert.deepEqual(at({ ...P.outlast, span: { from: 0, to: null } }), ["span.from"]);
  assert.deepEqual(at({ ...P.outlast, span: { from: 5, to: 4 } }), ["span.to"]);
  // A phase start (A3): the phase named, `at` an episode once it's settled, an end from there on (any, while it waits).
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged" }, to: null } }), []);
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged", at: 9 }, to: 9 } }), []);
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged" }, to: 4 } }), [], "while it waits its end can't be checked");
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "" }, to: null } }), ["span.from.phase"]);
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged", at: 0 }, to: null } }), ["span.from.at"]);
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged", at: 9 }, to: 8 } }), ["span.to"]);
  assert.deepEqual(at({ ...P.outlast, span: { from: { phase: "merged", when: 3 }, to: null } }), ["span.from.when"]);
  // With the season's phases: one of them, never the first (that's Episode 1).
  const phases = [{ id: "tribes" }, { id: "merged" }];
  const phaseAt = (phase) => G.specProblems({ ...P.outlast, span: { from: { phase }, to: null } }, { phases }).map((p) => p.at);
  assert.deepEqual(phaseAt("merged"), []);
  assert.deepEqual(phaseAt("tribes"), ["span.from.phase"]);
  assert.deepEqual(phaseAt("finale"), ["span.from.phase"]);
  assert.deepEqual(at({ ...P.outlast, pool: { of: "cast", where: { tribe: "x" } } }), ["pool.where"]);
  assert.deepEqual(at({ ...P.outlast, get: { ...P.outlast.get, order: "blind" } }), ["get.order"], "exclusive drafts snake");
  assert.deepEqual(at({ ...P.outlast, get: { ...P.outlast.get, each: 0 } }), ["get.each"]);
  assert.deepEqual(at({ ...P.outlast, get: { ...P.outlast.get, each: 11 } }), ["get.each"], "Game settings' team is 1 to 10");
  assert.deepEqual(at({ ...P["weekly-lineup"], get: { ...P["weekly-lineup"].get, each: 15 }, count: { start: 8 } }), ["get.each"], "a lineup's team is up to 14");
  assert.deepEqual(at({ ...P["weekly-lineup"], count: { start: "3" } }), ["count.start"]);
  assert.deepEqual(at({ ...P.outlast, preset: "constructor" }), ["preset"], "only a preset's own name");
  assert.deepEqual(at({ ...P["weekly-lineup"], count: { constructor: 3 } }), ["count", "count"]);
  assert.deepEqual(at({ ...P.outlast, count: null }), ["count", "score.by"]);
  assert.deepEqual(at({ ...P["weekly-lineup"], count: { start: 6 } }), ["count.start"], "can't start more than you draft");
  assert.deepEqual(at({ ...P["survival-pool"], count: { start: 1 } }), ["count", "count"]);
  assert.deepEqual(at({ ...P["survival-pool"], rank: { by: "total" }, score: { by: "place" } }), ["score.by"]);
  assert.deepEqual(at({ ...P.outlast, rank: { by: "streak" } }), ["rank.by"]);
  assert.deepEqual(at({ ...P["weekly-calls"], score: { by: "moments", points: null } }), ["score.by", "ask[0]"], "nothing of yours to score, and the calls are a game of their own");
  assert.deepEqual(at({ ...P["weekly-calls"], ask: [] }), ["ask"]);
  assert.deepEqual(at({ ...P["weekly-calls"], closes: "never" }), ["closes"]);
  assert.deepEqual(at({ ...P["survival-pool"], extras: { ...P["survival-pool"].extras, waivers: G.NO_WAIVERS } }), ["extras.waivers"]);
  assert.deepEqual(at({ ...P.outlast, get: { by: "draft", each: 3, order: "blind", own: "shared" }, extras: { ...P.outlast.extras, waivers: G.NO_WAIVERS } }), ["extras.waivers"], "a shared Outlast has no free agents");
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, waivers: { ...G.NO_WAIVERS, hours: 36 } } }), ["extras.waivers.hours"]);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, waivers: null } }), ["extras.waivers"], "a draft with free agents says what its waivers do");
  // Nothing WaiverLogic would quietly read as something else: Outlast replaces every loss, a window swaps at most the team,
  // and "short" is below the team.
  const wv = (spec, w) => ({ ...spec, extras: { ...spec.extras, waivers: { ...G.NO_WAIVERS, ...w } } });
  assert.deepEqual(at(wv(P.outlast, { replace: "whenShort" })), ["extras.waivers.replace"]);
  assert.deepEqual(at(wv(P["weekly-lineup"], { replace: "whenShort" })), []);
  assert.deepEqual(at(wv(P.outlast, { windows: { schedule: "every", every: 3, swaps: 4 } })), ["extras.waivers.windows.swaps"]);
  assert.deepEqual(at(wv(P["weekly-lineup"], { short: 5 })), ["extras.waivers.short"]);
  assert.deepEqual(at(wv(P["weekly-lineup"], { short: 4 })), []);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, bets: { points: 4 } } }), ["extras.bets"]);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, join: "open" } }), ["extras.join"], "an exclusive draft asks");
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, calls: true } }), ["extras.calls"]);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, draft: { at: "soon", timer: 0, away: "wait" } } }), ["extras.draft"]);
  assert.deepEqual(at({ ...P["survival-pool"], extras: { ...P["survival-pool"].extras, finale: { top3: 1, winner: 3, from: "any" } } }), ["extras.finale"]);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, hideStarters: true } }), ["extras.hideStarters"]);
  const q = { id: "a", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } };
  const asks = (...qs) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: qs });
  assert.deepEqual(at(asks(q)), []);
  assert.deepEqual(at(asks(q, q)), ["ask[1].id"]);
  assert.deepEqual(at(asks({ ...q, answer: "yesNo" })), ["ask[0].settle"], "a yes-or-no isn't graded by a final's winner");
  assert.deepEqual(at(asks({ ...q, settle: { by: "vibes", take: "winner" } })), ["ask[0].settle"], "data settles every question");
  assert.deepEqual(at(asks({ ...q, settle: { by: "final", take: "mvp" } })), ["ask[0].settle.take"]);
  assert.deepEqual(at(asks({ ...q, answer: "overUnder", line: "high", settle: { by: "final", take: "total" } })), ["ask[0].line"]);
  assert.deepEqual(at(asks({ ...q, answer: "choice", options: ["one"] })), ["ask[0].options"]);
  assert.deepEqual(at(asks({ ...q, answer: "person", settle: { by: "results", take: "placed" } })), ["ask[0].settle.place"]);
  assert.deepEqual(at(asks({ ...q, answer: "overUnder", settle: { by: "final", take: "total" } })), [], "a line left out is the wizard's to ask");
  // A draft's time is an instant with its zone, as it's stored.
  const room = (at) => ({ ...P.outlast, extras: { ...P.outlast.extras, draft: { at, timer: 0, away: "wait" } } });
  assert.deepEqual(at(room("2026-10-28T23:00:00.000Z")), []);
  assert.deepEqual(at(room("2026-10-28T19:00-04:00")), []);
  assert.deepEqual(at(room("1")), ["extras.draft"]);
  assert.deepEqual(at(room("2026-10-28 20:00")), ["extras.draft"], "no zone: whose 8 PM?");
  // Nothing a game spec doesn't have: a misspelled key isn't quietly played as the default.
  assert.deepEqual(at({ ...P.outlast, scoring: { by: "moments" }, extras: { ...P.outlast.extras, sideBets: { points: 3 } } }), ["scoring", "extras.sideBets"]);
  assert.deepEqual(at({ ...P.outlast, get: { ...P.outlast.get, size: 3 } }), ["get.size"]);
  assert.deepEqual(at(asks({ ...q, settle: { ...q.settle, who: "x" }, hint: "" })), ["ask[0].hint", "ask[0].settle.who"]);
  assert.deepEqual(at({ ...P.outlast, extras: { ...P.outlast.extras, waivers: { ...G.NO_WAIVERS, windows: { ...G.NO_WAIVERS.windows, often: 1 } } } }), ["extras.waivers.windows.often"]);
});

test("specWaitsFor: what a spec needs that isn't built, and the step that builds it", () => {
  const P = G.PRESETS;
  const waits = (spec) => G.specWaitsFor(spec).map(({ at, step }) => `${at}:${step}`);
  // A phase start is built (A3 part 2): every preset plays one.
  for (const p of Object.values(P)) assert.deepEqual(waits({ ...p, span: { from: { phase: "merged" }, to: null } }), [], p.preset);
  assert.equal(G.typeOf({ ...P.outlast, span: { from: { phase: "merged", at: 9 }, to: null } }), "classic-draft");
  // Best ball plays (A9 part 2): Weekly Lineup's game, with no lineups.
  assert.deepEqual(waits({ ...P["weekly-lineup"], count: { best: 3 } }), []);
  assert.equal(G.typeOf({ ...P["weekly-lineup"], count: { best: 3 } }), "active-roster");
  assert.deepEqual(waits({ ...P["weekly-lineup"], rank: { by: "matchups" }, closes: "daily" }), ["rank.by:sports", "closes:sports"]);
  assert.deepEqual(waits({ spec: 1, get: { by: "squares" }, score: { by: "stats", points: { PTS: 1 } } }), ["get.by:sports", "score.by:sports"]);
  assert.deepEqual(waits({ ...P.outlast, pool: { of: "cast", where: { group: "tribe-1" } } }), ["pool.where:later"]);
  // Every part built, but no game plays a draft where everyone scores moments without a lineup.
  assert.deepEqual(waits({ ...P["weekly-lineup"], count: { all: true } }), [":null"]);
  assert.equal(G.typeOf({ ...P["weekly-lineup"], count: { all: true } }), null);
  assert.equal(G.settingsOf({ ...P["weekly-lineup"], count: { all: true } }), null);
});

test("fullSpec and settingsOf: a part said in part takes the rest from its preset, and nothing invalid is written", () => {
  const P = G.PRESETS;
  // "We draft 6 each" on a Weekly Lineup is still its shared, blind draft; saying the ownership brings its order.
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", get: { by: "draft", each: 6 } }).get, { by: "draft", each: 6, order: "blind", own: "shared" });
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", get: { by: "draft", own: "exclusive" } }).get, { by: "draft", own: "exclusive", each: 5, order: "snake" });
  assert.deepEqual(G.fullSpec({ preset: "survival-pool", score: { by: "survive", means: "scores" } }).score, { by: "survive", means: "scores", points: 1 });
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", span: { from: 7 } }).span, { from: 7, to: null });
  // Another kind of part keeps only what it says.
  assert.deepEqual(G.fullSpec({ preset: "weekly-lineup", get: { by: "pick" } }).get, { by: "pick", each: 1, repeat: "cycle" });
  // A spec with problems writes nothing.
  assert.equal(G.settingsOf({ ...P.outlast, get: { ...P.outlast.get, each: 0 } }), null);
  assert.equal(G.settingsOf({ ...P.outlast, extras: { ...P.outlast.extras, bets: { points: 50 } } }), null);
  assert.equal(G.withSpec({}, { ...P["weekly-lineup"], count: { start: "3" } }), null);
  assert.equal(G.settingsOf({ ...P.outlast, preset: "toString" }), null);
  assert.deepEqual(G.specOf({ leagueTypeId: "constructor", teamSize: 3 }).preset, "outlast", "an unknown league type plays Outlast");
  // A part of another kind than the preset's takes the mechanics' own defaults, not the preset's.
  const pick = G.fullSpec({ preset: "weekly-lineup", get: { by: "pick" } });
  assert.deepEqual([pick.count, pick.score, pick.rank], [{ pick: true }, undefined, { by: "total" }]);
  assert.deepEqual(G.specProblems(pick).map((p) => p.at), ["score.by"], "only what it hasn't said yet");
  assert.deepEqual(G.fullSpec({ get: { by: "pick" }, score: { by: "survive" } }).rank, { by: "streak" });
  // The presets can't be changed in place: every caller gets copies.
  assert.ok(Object.isFrozen(P.outlast.extras.waivers) && Object.isFrozen(G.NO_WAIVERS) && Object.isFrozen(P["weekly-lineup"].get));
  assert.notEqual(G.fullSpec(P.outlast).extras.waivers, G.NO_WAIVERS);
  // A league's own spec keeps a team bigger than a new game's (classic's setup has no cap); a new game's doesn't.
  const big = G.specOf({ leagueTypeId: "classic-draft", teamSize: 12 });
  assert.deepEqual(G.specProblems(big).map((p) => p.at), ["get.each"]);
  assert.deepEqual(G.specProblems(big, null, { league: true }), []);
  assert.equal(G.withSpec({ leagueTypeId: "classic-draft", teamSize: 12 }, big).teamSize, 12);
  assert.deepEqual(G.specProblems({ ...P["weekly-lineup"], get: { ...P["weekly-lineup"].get, each: 14 }, count: { start: 13 } }).map((p) => p.at), ["count.start"], "a new lineup starts up to 8");
  assert.deepEqual(G.specProblems({ ...P["weekly-lineup"], get: { ...P["weekly-lineup"].get, each: 10 }, count: { start: 2 } }).map((p) => p.at), ["get.each"], "and benches up to 6");
});

test("withSpec writes only the parts that change, and the result always reads as the spec", () => {
  const P = G.PRESETS;
  // Classic's late-joiner switch off over a Who can join choice: the spec says locked; written back, the choice survives
  // for when the switch comes back on. Changing it writes both.
  const switchedOff = { ...made("active-roster").settings, allowLateJoiners: false, joinMode: "ask" };
  const locked = G.specOf(switchedOff);
  assert.equal(locked.extras.join, "locked");
  assert.deepEqual(G.withSpec(switchedOff, locked), switchedOff);
  const open = G.withSpec(switchedOff, { ...locked, extras: { ...locked.extras, join: "open" } });
  assert.deepEqual([open.allowLateJoiners, open.joinMode], [true, "open"]);
  // The waiver suggestion still to be fitted at the draft stays while the waivers don't change, and goes when they do.
  const fitted = demo("active-roster");
  S.updateSettings(fitted, "waiverRecommendation", "competitive");
  fitted.settings.waiverFit = true;
  const spec = G.specOf(fitted.settings);
  assert.equal(G.withSpec(fitted.settings, { ...spec, span: { from: 2, to: null } }).waiverFit, true);
  assert.equal(G.withSpec(fitted.settings, { ...spec, extras: { ...spec.extras, waivers: G.NO_WAIVERS } }).waiverFit, undefined);
  // A replenishAt beyond today's team reads as the team less one (WaiverLogic.shortAt), and stays as stored.
  const shrunk = { ...made("active-roster").settings, replaceRule: "whenShort", replenishAt: 4, benchSlots: 0 };
  assert.equal(G.specOf(shrunk).extras.waivers.short, 2);
  assert.deepEqual(G.specProblems(G.specOf(shrunk)), []);
  assert.deepEqual(G.withSpec(shrunk, G.specOf(shrunk)), shrunk);
  // A stored value another part hid shows through once that part changes: written too. A pool with an old finale switch
  // on becoming a draft; an exclusive draft's "open" (read as ask) going shared.
  const pool = { ...made("pickem").settings, finalePredictionsEnabled: true };
  assert.deepEqual(G.specOf(G.withSpec(pool, P["weekly-lineup"])).ask, []);
  assert.equal(G.withSpec(pool, P["weekly-lineup"]).finalePredictionsEnabled, false);
  const exclusive = { ...made("active-roster", (s) => S.updateSettings(s, "ownershipMode", "exclusive")).settings, joinMode: "open" };
  const ask = G.specOf(exclusive);
  assert.equal(ask.extras.join, "ask");
  const shared = G.withSpec(exclusive, { ...ask, get: { ...ask.get, own: "shared", order: "blind" } });
  assert.equal(shared.joinMode, "ask");
  // Every kind into every other: the result reads as the spec asked for.
  for (const from of Object.values(P)) {
    for (const to of Object.values(P)) {
      const st = G.withSpec(made(G.PRESET_TYPES[from.preset]).settings, from);
      assert.deepEqual(G.specOf(G.withSpec(st, to)), G.fullSpec(to), `${from.preset} into ${to.preset}`);
    }
  }
});

test("describeSpec: the sentence for each game, and the details nobody asked about", () => {
  const ctx = { show: "Survivor 51", castaway: "castaway" };
  const say = (spec, c = ctx) => G.describeSpec(spec, c).sentence;
  assert.equal(say(G.PRESETS.outlast), "An Outlast for Survivor 51: everyone drafts 3, all season. Each scores by how long they last: the last one standing carries you.");
  assert.equal(say({ ...G.PRESETS["survival-pool"], span: { from: 3, to: 3 } }), "A Survival Pool for Survivor 51: everyone picks one castaway to stay in each episode, just Episode 3. Longest streak wins.");
  assert.equal(say({ ...G.PRESETS["survival-pool"], score: { by: "survive", means: "scores", points: 1 } }, { show: "Formula 1", castaway: "driver", part: { singular: "race", plural: "races" } }),
    "A Survival Pool for Formula 1: everyone picks one driver to score each race, all season. Longest streak wins.");
  assert.equal(say(G.PRESETS["weekly-calls"], { show: "Late Night" }), "A Weekly Calls for Late Night: two calls before every episode, all season. Most right by the finale wins.");
  assert.equal(say(G.PRESETS["weekly-bingo"], {}), "A Weekly Bingo: a new bingo card every episode, all season. Most lines by the finale wins.");
  // A phase start, by the phase's name when the rulebook's phases are given (else its id); once settled, where it plays from.
  const lineupFrom = (from, to = null) => ({ ...G.PRESETS["weekly-lineup"], span: { from, to } });
  const phases = [{ id: "tribes", name: "Tribes" }, { id: "merged", name: "Merged" }];
  assert.equal(say(lineupFrom({ phase: "merged" }), { ...ctx, phases }), "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, from when Merged starts. Scored by Survivor 51's rules.");
  assert.equal(say(lineupFrom({ phase: "merged" })), "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, from when merged starts. Scored by Survivor 51's rules.");
  assert.equal(say(lineupFrom({ phase: "merged" }, 12), { ...ctx, phases }), "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, from when Merged starts to Episode 12. Scored by Survivor 51's rules.");
  assert.equal(say(lineupFrom({ phase: "merged", at: 9 }), { ...ctx, phases }), "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, Episode 9 to the finale, starting with Merged. Scored by Survivor 51's rules.");
  assert.ok(G.describeSpec(lineupFrom({ phase: "merged" }), { ...ctx, phases }).rules.includes("It starts when Merged starts: nothing before then scores."));
  assert.ok(G.describeSpec(lineupFrom({ phase: "merged", at: 9 }, 9), { ...ctx, phases }).rules.includes("It's one episode: Episode 9, then it's over."));
  assert.ok(G.describeSpec(lineupFrom({ phase: "merged", at: 9 }), { ...ctx, phases }).rules.includes("It starts with Merged, at Episode 9: the episodes before it are history."));
  // A question game over one episode, settled at a phase, asks before that episode.
  assert.match(say({ spec: 1, get: { by: "none" }, score: { by: "answers" }, span: { from: { phase: "merged", at: 9 }, to: 9 }, ask: [{ id: "w", ask: "Who goes?", answer: "person", points: 1, settle: { by: "results", take: "out" } }] }, { ...ctx, phases }), /before Episode 9/);
  const moments = [{ id: "votedOut", defaultPoints: -3 }, { id: "immunity", defaultPoints: { exclusive: 2, shared: 3 } }];
  const points = (p) => ({ ...G.PRESETS["weekly-lineup"], score: { by: "moments", points: p } });
  assert.match(say(points({ votedOut: -3, immunity: 3 }), { ...ctx, moments }), /Scored by Survivor 51's rules\.$/, "the shared draft's own defaults");
  assert.match(say(points({ votedOut: -5, immunity: 3 }), { ...ctx, moments }), /with one moment's points changed\.$/);
  assert.match(say(points({ votedOut: -5 })), /with the game's own points\.$/, "without the moments it can't say how many");
  assert.match(say(points({ votedOut: -3, immunity: 0 }), { ...ctx, moments: [moments[0], { ...moments[1], off: true }] }), /Scored by Survivor 51's rules\.$/, "an off moment's points change nothing");
  const stats = { spec: 1, get: { by: "draft", each: 3 }, count: { all: true }, score: { by: "stats", points: { AST: 1, HR: 4, TB: 1 } } };
  assert.match(say(stats, { stats: [{ key: "AST", label: "assist" }, "HR", "TB"] }), /Scored 1 an assist, 4 an HR and 1 a TB\.$/);

  const details = (spec) => Object.fromEntries(G.describeSpec(spec, ctx).details.map((d) => [d.id, [d.value, d.recommended]]));
  assert.deepEqual(details(G.PRESETS["weekly-lineup"]), {
    draft: ["In private, revealed at once · No pick timer · no time set", true],
    join: ["Anyone on the couch", true],
    waivers: ["No replacements · no windows unless you open one", true],
    bets: ["On, 1 point each", true],
    finale: ["Off", true],
    hideStarters: ["Shown as they're set", true],
    lockedDown: ["No", true],
    seats: ["One each", true],
  });
  const tuned = clone(G.PRESETS.outlast);
  Object.assign(tuned.extras, { join: "locked", bets: null, draft: { at: null, timer: 120, away: "queue" }, waivers: { ...G.NO_WAIVERS, replace: "always", windows: { schedule: "every", every: 3, swaps: 1 } } });
  const d = details(tuned);
  assert.deepEqual(d.join, ["Nobody new", false]);
  assert.deepEqual(d.bets, ["Off", false]);
  assert.deepEqual(d.draft, ["Snake: everyone takes turns · 2 minutes a pick, then from their queue · no time set", false]);
  assert.deepEqual(d.waivers, ["Replace right away · a window every 3 episodes, one swap", false]);
  // The same values in another order are still what we'd recommend.
  const reordered = clone(G.PRESETS.outlast);
  reordered.extras.draft = { away: "wait", timer: 0, at: null };
  assert.deepEqual(details(reordered).draft[1], true);
  // Locked down closes joining, whatever Who can join says.
  const locked = clone(G.PRESETS["weekly-lineup"]);
  locked.extras.lockedDown = true;
  assert.deepEqual(details(locked).join, ["Nobody new while it's locked down", true]);
  // A game with no preset starts with no side bets: they're graded by whoever runs it, not by data.
  assert.equal(G.fullSpec(EXAMPLES[1].spec).extras.bets, null);
  // The preset's name only while it plays the preset's game.
  const outlastish = { ...G.PRESETS["weekly-lineup"], count: { all: true }, score: { by: "place" } };
  assert.equal(G.describeSpec(outlastish, ctx).name, null);
  assert.match(say(outlastish), /^A game for Survivor 51: everyone drafts 5, all season\./);
  assert.equal(G.describeSpec({ ...G.PRESETS["weekly-lineup"], get: { ...G.PRESETS["weekly-lineup"].get, each: 6 } }, ctx).name, "Weekly Lineup");
  // A spec still being made is said as far as it goes.
  assert.equal(say({ get: { by: "none" } }), "A game for Survivor 51: nothing to pick, all season.");
  assert.equal(say({ get: { by: "pick" } }), "A game for Survivor 51: everyone picks one castaway to stay in each episode, all season.");
  assert.doesNotThrow(() => G.describeSpec({ get: null, rank: null, score: null, extras: { waivers: "yes", draft: 1 } }, ctx));
  const partly = G.describeSpec({ get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "w" }] }, ctx);
  assert.ok(!partly.rules.join(" ").includes("undefined"), partly.rules.join(" | "));
  assert.ok(!JSON.stringify(G.describeSpec({ ...G.PRESETS.outlast, extras: { ...G.PRESETS.outlast.extras, join: "constructor" } }, ctx).details).includes("function"));
});

// ---------- every league in the local database (read only: nothing is written, and only ids are printed) ----------
const DB = process.env.AUTH_DATABASE_URL || "";
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB);

test("every league in the local database round-trips through its spec", { skip: !LOCAL && "needs the local database" }, async (t) => {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DB });
  let rows;
  try {
    ({ rows } = await pool.query("SELECT id, state FROM leagues ORDER BY created_at, id"));
  } catch (e) {
    return t.skip(`local database not reachable: ${e.code || e.message}`);
  } finally {
    await pool.end();
  }
  if (!rows.length) return t.skip("no leagues in the local database");
  for (const r of rows) {
    const label = `league ${r.id}`;
    const unknown = Object.keys(r.state.settings).filter((k) => !G.OWNED.includes(k) && !G.OUTSIDE.includes(k));
    assert.deepEqual(unknown, [], `${label}: a settings field the spec doesn't know. Add it to the spec (game-spec/settings.js OWNED) or to OUTSIDE`);
    roundTrip(r.state, label);
  }
  t.diagnostic(`${rows.length} leagues`);
});
