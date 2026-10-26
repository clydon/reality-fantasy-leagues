// Start a game that fits (docs/PLAN-new-design.md step 10 part 2b), the pure half: which season games each kind of show's
// rulebook can feed (formats/rulebook-fits.js gamesFor, on the built-ins and the library), the doesn't-fit line and each
// game's line in the show's own words; a sport's Survival Pool surviving a race by scoring in it; a game started mid-season
// taking newcomers into its draft (results before its own start are history); and an archived game standing still. No
// network or database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { gamesFor, noFitLine, gameLine } = require("../src/lib/game/formats/rulebook-fits.js");
const { howItWorks } = require("../src/lib/game/formats/rulebook-describe.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { actionItems } = require("../src/lib/game/action-items.js");
const S = require("../src/lib/game/state-logic.js");

const fits = (blocks, compiled) => gamesFor(blocks, compiled).filter((g) => g.fits).map((g) => g.key);

test("what fits each kind: a competition all three, a series Weekly Lineup, a sport the draft and the pool, talk its weekly games", () => {
  for (const id of ["survivor", "traitors", "challenge"]) assert.deepEqual(fits(BUILT_IN_BLOCKS[id].blocks), ["survivalPool", "weeklyLineup", "outlast"], id);
  assert.deepEqual(fits(LIBRARY["the-amazing-race"].blocks, LIBRARY["the-amazing-race"].compiled), ["survivalPool", "weeklyLineup", "outlast"], "a leg's pit stop sends a team home");
  for (const id of ["below-deck", "scrubs", "the-real-housewives-of-beverly-hills"]) assert.deepEqual(fits(LIBRARY[id].blocks, LIBRARY[id].compiled), ["weeklyLineup"], id);
  assert.deepEqual(fits(LIBRARY["world-series"].blocks, LIBRARY["world-series"].compiled), ["weeklyLineup", "survivalPool"]);
  const talk = gamesFor(LIBRARY["saturday-night-live"].blocks);
  assert.deepEqual(talk.filter((g) => g.fits).map((g) => [g.key, g.soon, g.type]), [["weeklyBingo", "12", null], ["weeklyCalls", null, "weekly-calls"]], "Weekly Calls starts (step 12 part 2), Weekly Bingo is still coming");
  assert.deepEqual(talk.filter((g) => !g.fits).map((g) => g.key), ["survivalPool", "weeklyLineup", "outlast"]);
  const types = Object.fromEntries(gamesFor(BUILT_IN_BLOCKS.survivor.blocks).map((g) => [g.key, g.type]));
  assert.deepEqual(types, { survivalPool: "pickem", weeklyLineup: "active-roster", outlast: "classic-draft" });
});

test("a competition that doesn't send someone home every episode loses Survival Pool; one without a winner loses Outlast", () => {
  const b = structuredClone(BUILT_IN_BLOCKS.survivor.blocks);
  b.segments = b.segments.map((s) => (s.onTheLine === "goingHome" ? { ...s, often: "someEpisodes" } : s));
  b.waysOut = b.waysOut.filter((w) => w.means !== "winner");
  const g = gamesFor(b);
  assert.deepEqual(g.filter((x) => x.fits).map((x) => x.key), ["weeklyLineup"]);
  assert.equal(noFitLine(g, b, "Survivor"), "Survival Pool needs someone going home most episodes. Outlast needs people knocked out one by one, and a winner.");
  // A finale that crowns someone in the compiled rules is a winner too.
  assert.ok(gamesFor(b, { events: new Array(9), winnerExitMethod: "Sole Survivor" }).find((x) => x.key === "outlast").fits);
});

test("the doesn't-fit line, per kind (the mock's RB_NOFIT)", () => {
  const line = (id, show) => noFitLine(gamesFor(LIBRARY[id].blocks), LIBRARY[id].blocks, show);
  assert.equal(line("below-deck", "Below Deck"), "Survival Pool and Outlast need someone knocked out most episodes. Nobody is, on Below Deck.");
  assert.equal(line("saturday-night-live", "SNL"), "Drafts need a cast that scores week to week. SNL's games are one show at a time, all season.");
  assert.equal(line("world-series", "Formula 1"), "Outlast needs people knocked out one by one. Nobody is, in Formula 1.");
  assert.equal(noFitLine(gamesFor(BUILT_IN_BLOCKS.survivor.blocks), BUILT_IN_BLOCKS.survivor.blocks, "Survivor"), null);
});

test("each game's line, in the show's words: a sport's race and players, a series' crew or characters", () => {
  const f1 = { ...structuredClone(LIBRARY["world-series"].blocks), parts: { singular: "race", plural: "races" }, cast: { ...LIBRARY["world-series"].blocks.cast, singular: "driver", plural: "drivers" } };
  assert.equal(gameLine("weeklyLineup", f1), "Draft five drivers, start three each race");
  assert.equal(gameLine("survivalPool", f1), "Pick one driver to score each race. Never the same twice");
  assert.equal(gameLine("weeklyLineup", LIBRARY.scrubs.blocks), "Draft the characters, start three each week, score what happens to them");
  assert.match(gameLine("weeklyLineup", LIBRARY["below-deck"].blocks), /^Draft the crew members, start three each week, score what they get up to$/);
  assert.equal(gameLine("survivalPool", BUILT_IN_BLOCKS.survivor.blocks), "No draft · pick one castaway to survive each episode · best for mid-season");
  assert.equal(gameLine("outlast", BUILT_IN_BLOCKS.survivor.blocks), "Draft a team, the last one standing carries you");
});

test("How it works lists only the games that fit", () => {
  assert.deepEqual(howItWorks(LIBRARY["world-series"].blocks, {}).games.map((g) => g.name), ["Weekly Lineup", "Survival Pool"]);
  assert.deepEqual(howItWorks(LIBRARY["saturday-night-live"].blocks, {}).games.map((g) => g.name), ["Weekly Bingo", "Weekly Calls"]);
});

// ---------- the engine ----------

const EPISODES = 10;
const seats = (n) => Array.from({ length: n }, (_, i) => ({ key: `p${i}`, name: `player${i}`, color: "#000" }));
const data = (players) => ({
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES, players,
  castaways: Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, name: `Castaway ${i}`, placement: i + 1, exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 11 ? "Sole Survivor" : "Voted Out" })),
});
const demo = (type, cursor, n = 2) => S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data(seats(n)), type, cursor))));
const ep = (s, n) => s.episodes.find((e) => e.number === n);

test("a sport's Survival Pool: a pick survives an event by scoring in it, decided once its scores are in", () => {
  const s = demo("pickem", 3);
  s.settings.poolSurvive = "scores";
  const me = s.players[0].id;
  const four = ep(s, 4) ?? S.ensureEpisodeNumber(s, 4, false);
  const [a, b] = s.castaways.filter((c) => c.status === "active");
  S.setPickEmPick(s, four.id, me, a.id);
  assert.equal(S.pickEmDecided(four, s), false, "nothing in yet");
  const type = S.formatOf(s).events.find((e) => S.ActiveRosterLogic.pointsFor(s, e.id) > 0).id;
  S.addScoringEvent(s, four.id, type, b.id);
  assert.equal(S.pickEmDecided(four, s), true, "its scores are in");
  assert.equal(S.pickEmDecided(four), false, "a pool that survives by staying in waits for who went home");
  const row = S.pickEmHistory(s, me).rows.find((r) => r.episode === 4);
  assert.equal(row.correct, false, "a didn't score");
  S.addScoringEvent(s, four.id, type, a.id);
  assert.equal(S.pickEmHistory(s, me).rows.find((r) => r.episode === 4).correct, true, "now a scored: survived");
});

test("a game started mid-season isn't underway until a result of its own: newcomers join its draft", () => {
  const s = demo("active-roster", 5);
  s.settings.startEpisode = 6;
  // Undraft everyone: a game that's just been started (a turn-based draft, nobody's picked).
  s.settings.ownershipMode = "exclusive";
  s.castaways.forEach((c) => (c.ownerIds = []));
  s.draftPicksMade = 0;
  s.draftLog = [];
  s.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  assert.equal(S.currentDraftTurn(s)?.isComplete, false, "nobody's drafted");
  assert.equal(S.GhostLogic.isUnderway(s), false, "earlier results are history");
  const late = S.addPlayer(s, "newcomer");
  assert.ok(!late.lateJoin && s.draftOrder.includes(late.id), "a newcomer joins its draft");
  s.settings.startEpisode = 1;
  assert.equal(S.GhostLogic.isUnderway(s), true, "from the start, results in make it underway");
});

test("an archived game stands still: nothing's due, no waivers run", () => {
  const s = demo("active-roster", 4);
  const me = s.players[0].id;
  s.settings.archivedAt = new Date().toISOString();
  assert.deepEqual(actionItems(s, me, null, { commissioner: true }), []);
  assert.equal(S.WaiverLogic.due(s, Date.now()), null);
});
