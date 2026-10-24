// One season game as the new design's show space reads it (src/lib/game/game-view.ts, docs/PLAN-new-design.md step
// 1): the viewer's moves, table, cast and who's set, from their own copy at their mark, so nothing past it is in it;
// and each game's rules in plain words (game-rules.ts). Runs on made-up demo seasons, so no database is needed.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { gameView, weekProgress } = jiti("../src/lib/game/game-view.ts");
const { gameRules } = jiti("../src/lib/game/game-rules.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const CURSOR = 5; // results through episode 5; episode 6 is this week
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: i + 1,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const league = (type) => S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, type, CURSOR))));
const ref = (type) => ({ leagueId: `l-${type}`, name: type, gameType: type, gameName: type, yourRole: "member" });
const userOf = (p) => `user-${p}`;
const ann = (state) => state.players.find((p) => p.name === "ann").id;

test("a viewer up to date sees the table through the latest results and this week's moves", () => {
  const state = league("active-roster");
  const g = gameView(ref("active-roster"), state, ann(state), CURSOR, userOf);
  assert.equal(g.through, CURSOR);
  assert.equal(g.revealFirst, null);
  assert.equal(g.lineup.episode, CURSOR + 1);
  assert.ok(g.lineup.slots > 0 && g.lineup.roster.length >= g.lineup.slots);
  assert.equal(g.table.length, 3);
  assert.equal(g.table.filter((r) => r.you).length, 1);
  assert.ok(g.table.every((r) => r.userId === userOf(r.playerId)));
  // Places share a tie and count on from it.
  for (let i = 1; i < g.table.length; i++) assert.ok(g.table[i].total <= g.table[i - 1].total);
});

test("a viewer behind sees nothing past their mark, and is asked to reveal first", () => {
  for (const type of ["classic-draft", "active-roster", "pickem"]) {
    const state = league(type);
    const g = gameView(ref(type), state, ann(state), 3, userOf);
    assert.equal(g.through, 3, type);
    assert.ok(g.cast.every((c) => !c.left || (c.out !== null && c.out <= 3)), `${type}: nobody out after episode 3`);
    assert.equal(g.cast.filter((c) => c.left).length, 3, `${type}: the three out by episode 3`);
    if (type !== "classic-draft") assert.equal(g.revealFirst, 4, type);
    // The table as it stood after episode 3: no pick decided past it.
    assert.ok(g.table.every((r) => r.picks.every((p) => p.episode <= 3 || r.you)), type);
  }
});

test("someone else's pick stays theirs until it's decided", () => {
  const state = league("pickem");
  const me = ann(state);
  const other = state.players.find((p) => p.name === "bo").id;
  const { ep } = { ep: S.pickEmUpcomingEpisode(state) };
  const free = S.pickEmEligibility(state, ep.id, other).available[0];
  S.setPickEmPick(state, ep.id, other, free);
  const g = gameView(ref("pickem"), state, me, CURSOR, userOf);
  const bo = g.table.find((r) => r.playerId === other);
  assert.ok(bo.picks.every((p) => p.correct !== null), "bo's pending pick isn't shown to ann");
  const mine = gameView(ref("pickem"), state, other, CURSOR, userOf).table.find((r) => r.you);
  assert.ok(mine.picks.some((p) => p.episode === ep.number && p.castawayId === free), "but bo sees their own");
  assert.equal(g.progress.label, "picked");
  assert.equal(g.progress.done, S.pickEmPickFor(state, ep.id, me) ? 2 : 1);
});

test("open predictions: unsettled, on an episode with no results, with your own guess", () => {
  const state = league("classic-draft");
  const me = ann(state);
  const bet = S.addBetToUpcoming(state, "Will an idol be played?", 2, me);
  const ep = state.episodes.find((e) => (e.bets || []).some((b) => b.id === bet.id));
  S.addBetPrediction(state, ep.id, bet.id, me, "Yes");
  const g = gameView(ref("classic-draft"), state, me, CURSOR, userOf);
  const q = g.predictions.find((p) => p.betId === bet.id);
  assert.ok(q, "the new prediction is open");
  assert.equal(q.guess.text, "Yes");
  assert.ok(g.predictions.every((p) => p.episode > CURSOR), "none on an episode with results");
});

test("who's set: lineups set over the league's own players", () => {
  const state = league("active-roster");
  const p = weekProgress(state, ann(state), userOf);
  assert.equal(p.label, "lineups set");
  assert.equal(p.of, 3);
  assert.equal(p.people.length, 3);
  assert.equal(p.done, p.people.filter((x) => x.done).length);
  assert.equal(weekProgress(league("classic-draft"), null, userOf), null, "Outlast has no weekly move");
});

test("each game's rules come from its own settings", () => {
  const lineup = league("active-roster");
  assert.ok(gameRules(lineup).some((r) => r.includes(`start ${["no", "one", "two", "three", "four", "five"][S.ActiveRosterLogic.activeSlots(lineup)]}`)));
  assert.ok(gameRules(lineup).some((r) => /Only starters score/.test(r)));
  assert.ok(gameRules(league("pickem")).some((r) => /streak/.test(r)));
  assert.ok(gameRules(league("classic-draft")).some((r) => /boot they outlast/.test(r)));
  const off = league("classic-draft");
  off.settings.bonusEnabled = false;
  assert.ok(!gameRules(off).some((r) => /^Predictions/.test(r)), "no predictions line when they're off");
});
