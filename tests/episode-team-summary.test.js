// The Scoreboard's per-team episode summary (src/lib/game/episode-team-summary.ts): bullets compared
// against the league, and the copyable "why it mattered" prompt. Runs on a made-up Active Roster demo
// season, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { episodeTeamBullets, latestScoredEpisode, buildSummaryPrompt, weekInRace } = jiti("../src/lib/game/episode-team-summary.ts");
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

test("every team's calls are well-formed and never name another team", () => {
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
    // Only notable calls: every line with points has at least a point riding on it.
    for (const b of bullets) if (b.points !== undefined) assert.ok(Math.abs(b.points) >= 1, b.text);
  }
});

test("a perfect lineup is exactly when no other starters from the roster would have scored more", () => {
  const { rosterAtEpisode, castawayEpisodeStats } = jiti("../src/lib/game/active-roster-rows.ts");
  for (let cursor = 1; cursor <= EPISODES; cursor++) {
    const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", cursor))));
    const ep = latestScoredEpisode(s);
    if (!ep) continue;
    for (const p of s.players) {
      const pts = (c) => castawayEpisodeStats(s, ep.id, c.id).total;
      const roster = rosterAtEpisode(s, p.id, ep.id);
      const startedIds = new Set(S.activeRosterLineupFor(s, ep.id, p.id));
      const started = roster.filter((c) => startedIds.has(c.id)).reduce((t, c) => t + pts(c), 0);
      const best = roster.map(pts).sort((a, b) => b - a).slice(0, s.settings.activeSlots).reduce((t, n) => t + n, 0);
      const choice = roster.length > startedIds.size && roster.some((c) => pts(c) !== 0);
      const perfect = episodeTeamBullets(s, ep.id, p.id).some((b) => b.kind === "perfect");
      assert.equal(perfect, choice && started >= best - 1e-9, `ep ${ep.number}, ${p.name}`);
    }
  }
});

test("an unknown player or episode gets no bullets", () => {
  const ep = latestScoredEpisode(state);
  assert.deepEqual(episodeTeamBullets(state, ep.id, "nobody"), []);
  assert.deepEqual(episodeTeamBullets(state, "ep_missing", state.players[0].id), []);
});

test("the prompt carries the episode notes when there are some, and just the numbers when not", () => {
  const bullets = [
    { kind: "perfect", icon: "", text: "Perfect lineup: you started your best possible team" },
    { kind: "best", icon: "", text: "Started Kim (won immunity)", points: 3 },
  ];
  const withNotes = buildSummaryPrompt(bullets, "Ep 3: a blindside at Tribal.", 3);
  assert.match(withNotes, /WHAT HAPPENED IN THE EPISODE:\nEp 3: a blindside at Tribal\./);
  assert.match(withNotes, /- Perfect lineup: you started your best possible team\n- Started Kim \(won immunity\) \(\+3\)/);
  assert.match(withNotes, /20 words or fewer/);
  const without = buildSummaryPrompt(bullets, null, 3);
  assert.ok(!without.includes("WHAT HAPPENED"));
  assert.match(without, /THIS TEAM'S EPISODE:/);
});

test("the race arrow: everyone measured against 1st, the leader against 2nd, mirrored when the lead changes", () => {
  let tookLeadSeen = 0;
  for (let cursor = 2; cursor <= EPISODES; cursor++) {
    const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", cursor))));
    const ep = latestScoredEpisode(s);
    const race = Object.fromEntries(s.players.map((p) => [p.id, weekInRace(s, ep.id, p.id)]));
    const leaders = s.players.filter((p) => race[p.id].leading);
    assert.ok(leaders.length >= 1, `ep ${ep.number}: someone leads`);
    for (const p of s.players) if (race[p.id].tookLead) {
      tookLeadSeen++;
      assert.equal(leaders.length, 1, "a lead taken is a sole lead");
      assert.ok(race[p.id].gained > 0, "you only take the lead by gaining");
    }
    // A sole leader's number and 2nd place's are mirror images: the same gap, seen from each side.
    if (leaders.length === 1) {
      const lead = race[leaders[0].id];
      const others = s.players.filter((p) => p.id !== leaders[0].id).map((p) => race[p.id].gained);
      assert.ok(others.some((g) => Math.abs(g + lead.gained) < 1e-9), `ep ${ep.number}: ${lead.gained} vs ${others}`);
    }
  }
  assert.equal(weekInRace(state, latestScoredEpisode(state).id, "nobody"), null);
  console.log(`  (lead changes seen across the demo season: ${tookLeadSeen})`);
});
