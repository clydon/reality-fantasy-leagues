// The reveal's standings beat (episode-view.ts mainRevealTable): a game in stages is ranked by the whole game, never by the one stage
// being played (docs/PLAN-game-preview.md, "Noticed, not fixed" 2: the finale's reveal said "you're 3rd" where the game had you 4th).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { mainRevealTable } = jiti("../src/lib/game/episode-view.ts");

const table = (leagueId, gameName) => ({ leagueId, gameName, rows: [] });
const part = (o) => ({ stage: "final", stageOf: null, ...o, table: table(o.leagueId, o.gameName) });

test("a stage's lineup gives way to its game's table: the overall decides it", () => {
  const parts = [part({ leagueId: "P", gameName: "Fantasy league", scores: "stages" }), part({ leagueId: "S2", stageOf: "P", gameName: "Weekly Lineup", scores: "moments" })];
  assert.equal(mainRevealTable(parts).leagueId, "P");
});

test("a game on its own keeps its table; a stage whose game isn't here keeps its own", () => {
  assert.equal(mainRevealTable([part({ leagueId: "L", gameName: "Weekly Lineup", scores: "moments" })]).leagueId, "L");
  assert.equal(mainRevealTable([part({ leagueId: "S2", stageOf: "P", gameName: "Weekly Lineup", scores: "moments" })]).leagueId, "S2");
  // The order between games is as it was: a final lineup first, else a pool's.
  const pool = part({ leagueId: "Q", gameName: "Survival Pool", scores: "survive" });
  assert.equal(mainRevealTable([pool, part({ leagueId: "L", gameName: "Weekly Lineup", scores: "moments" })]).leagueId, "L");
  assert.equal(mainRevealTable([pool, part({ leagueId: "L", gameName: "Weekly Lineup", scores: "moments", stage: "early" })]).leagueId, "Q");
});
