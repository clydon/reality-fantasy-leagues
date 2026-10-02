// The Scoreboard's per-team episode summary (src/lib/game/episode-team-summary.ts): bullets compared
// against the league, and the copyable "why it mattered" prompt. Runs on a made-up Active Roster demo
// season, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { episodeTeamBullets, latestScoredEpisode, buildSummaryPrompt } = jiti("../src/lib/game/episode-team-summary.ts");
const { episodePlayerPoints } = jiti("../src/lib/game/active-roster-rows.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out",
  })),
};
const state = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", 6))));

test("summarizes the latest scored episode, never a later one", () => {
  const ep = latestScoredEpisode(state);
  assert.ok(ep, "a scored episode exists");
  assert.ok(ep.number <= 6);
  assert.ok(S.ActiveRosterLogic.episodeEvents(state, ep).length > 0);
});

test("every team gets its calls and a net line, never naming another team", () => {
  const ep = latestScoredEpisode(state);
  const field = episodePlayerPoints(state, ep.id);
  for (const { player } of field) {
    const bullets = episodeTeamBullets(state, ep.id, player.id);
    // Compared to the league, never to a named team.
    for (const b of bullets) for (const other of state.players) if (other.id !== player.id) assert.ok(!b.text.includes(other.name), b.text);
    const best = bullets.find((b) => b.kind === "best");
    if (best) assert.ok(best.points > 0 && best.text.startsWith("Started "));
    const costly = bullets.find((b) => b.kind === "costly");
    if (costly) assert.ok(costly.points < 0);
    const saved = bullets.find((b) => b.kind === "benchSaved");
    if (saved) assert.ok(saved.points < 0 && saved.text.startsWith("Good call benching "));
    assert.equal(bullets.at(-1).kind, "net");
    assert.match(bullets.at(-1).text, /league average/);
  }
});

test("the net line tracks the race: the leader against 2nd, everyone else against 1st", () => {
  const ep = latestScoredEpisode(state);
  for (const p of state.players) {
    const net = episodeTeamBullets(state, ep.id, p.id).at(-1).text;
    assert.match(net, /(ahead of 2nd|lead over 2nd|held your lead|on 1st place|behind 1st|pace with 1st)/, net);
  }
});

test("an unknown player or episode gets no bullets", () => {
  const ep = latestScoredEpisode(state);
  assert.deepEqual(episodeTeamBullets(state, ep.id, "nobody"), []);
  assert.deepEqual(episodeTeamBullets(state, "ep_missing", state.players[0].id), []);
});

test("the prompt carries the episode notes when there are some, and just the numbers when not", () => {
  const bullets = [
    { kind: "net", icon: "", text: "+1.5 vs. league average · gained 2 on 1st place" },
    { kind: "best", icon: "", text: "Started Kim (won immunity)", points: 3 },
  ];
  const withNotes = buildSummaryPrompt(bullets, "Ep 3: a blindside at Tribal.", 3);
  assert.match(withNotes, /WHAT HAPPENED IN THE EPISODE:\nEp 3: a blindside at Tribal\./);
  assert.match(withNotes, /- \+1\.5 vs\. league average · gained 2 on 1st place\n- Started Kim \(won immunity\) \(\+3\)/);
  assert.match(withNotes, /20 words or fewer/);
  const without = buildSummaryPrompt(bullets, null, 3);
  assert.ok(!without.includes("WHAT HAPPENED"));
  assert.match(without, /THIS TEAM'S EPISODE:/);
});
