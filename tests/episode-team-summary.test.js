// The Scoreboard's per-team episode summary (src/lib/game/episode-team-summary.ts): bullets compared
// against the league, and the copyable "why it mattered" prompt. Runs on a made-up Active Roster demo
// season, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { episodeTeamBullets, latestScoredEpisode, buildLeaguePrompt, parseLeagueReply, weekInRace } = jiti("../src/lib/game/episode-team-summary.ts");
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

test("one prompt covers every team: lineups, benches, the race, and where to read this episode's recap", () => {
  const ep = latestScoredEpisode(state);
  const source = { showName: "Traitors", seasonNumber: 5, seasonName: "New Blood", domains: ["survivor.fandom.com", "ew.com"] };
  const withNotes = buildLeaguePrompt(state, ep.id, source);
  assert.match(withNotes, new RegExp(`Read a recap of Traitors, season 5 \\(New Blood\\), episode ${ep.number}`));
  assert.match(withNotes, /Use these sites, best first: survivor\.fandom\.com, ew\.com\./);
  // Kept to this episode: the lines are shown to the whole league.
  assert.match(withNotes, new RegExp(`Use ONLY what happened in episode ${ep.number} and before\\. Nothing from episode ${ep.number + 1} or later`));
  assert.match(withNotes, /not a page covering the whole season/);
  // A season name that only repeats the show and number is left out.
  const plain = buildLeaguePrompt(state, ep.id, { ...source, showName: "Survivor", seasonNumber: 51, seasonName: "Survivor 51" });
  assert.match(plain, new RegExp(`Read a recap of Survivor, season 51, episode ${ep.number}`));
  for (const p of state.players) {
    assert.ok(withNotes.includes(`TEAM: ${p.name}`), `${p.name}'s block`);
    assert.ok(withNotes.includes(`${p.name}: <line>`), `${p.name} in the reply format`);
  }
  assert.match(withNotes, /- Started: .*\[started by \d of 3 teams\]/);
  assert.match(withNotes, /- Bench: /);
  assert.match(withNotes, /league average/);
  assert.match(withNotes, /30 words or fewer/);
  assert.match(withNotes, /Don't round up/);
  // Examples use made-up people, so nothing from the real season gets copied into an answer.
  for (const c of state.castaways) assert.ok(!withNotes.split("Reply with exactly")[0].includes(c.name), c.name);
  assert.match(withNotes, /No two lines may start the same way/);
  assert.ok(!buildLeaguePrompt(state, ep.id, null).includes("LOOK UP THE EPISODE"));
});

test("the prompt says what each bench cost, and what every team had in common", () => {
  const { rosterAtEpisode, castawayEpisodeStats } = jiti("../src/lib/game/active-roster-rows.ts");
  for (let cursor = 1; cursor <= EPISODES; cursor++) {
    const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", cursor))));
    const ep = latestScoredEpisode(s);
    if (!ep) continue;
    const prompt = buildLeaguePrompt(s, ep.id, null);
    const lineups = s.players.map((p) => S.activeRosterLineupFor(s, ep.id, p.id));
    for (const c of s.castaways) {
      const all = lineups.every((ids) => ids.includes(c.id));
      if (all) assert.ok(prompt.includes(`every team started ${c.name}`) || prompt.includes(` and ${c.name}`), `ep ${ep.number}: ${c.name} shared`);
    }
    for (const p of s.players) {
      const pts = (c) => castawayEpisodeStats(s, ep.id, c.id).total;
      const roster = rosterAtEpisode(s, p.id, ep.id);
      const startedIds = new Set(S.activeRosterLineupFor(s, ep.id, p.id));
      if (roster.length === startedIds.size) continue;
      const best = S.roundPoints(roster.map(pts).sort((a, b) => b - a).slice(0, s.settings.activeSlots).reduce((t, n) => t + n, 0));
      const left = S.roundPoints(best - roster.filter((c) => startedIds.has(c.id)).reduce((t, c) => t + pts(c), 0));
      const block = prompt.slice(prompt.indexOf(`TEAM: ${p.name}`)).split("\n\n")[0];
      if (left > 0) assert.ok(block.includes(`so ${left} points were left on the bench`), block);
      else assert.ok(block.includes("Started the best possible lineup"), block);
    }
  }
});

test("a pasted reply is split onto teams, forgiving of the extras chats add", () => {
  const teams = [
    { id: "a", name: "Sam" },
    { id: "b", name: "Sam B" },
    { id: "c", name: "Alex" },
  ];
  const reply = [
    "Here you go:",
    "- **Sam:** Rode Toka's immunity win all the way.",
    "2. Sam B — \"Benched Ana the night she went home.\"",
    "alex: Started three people who did nothing.",
    "",
  ].join("\r\n");
  const { lines, unmatched } = parseLeagueReply(reply, teams);
  assert.deepEqual(lines, {
    a: "Rode Toka's immunity win all the way.",
    b: "Benched Ana the night she went home.",
    c: "Started three people who did nothing.",
  });
  assert.deepEqual(unmatched, ["Here you go:"]);
});

test("a reply with every team run together on one line still splits onto teams", () => {
  const teams = [
    { id: "a", name: "Sam" },
    { id: "b", name: "Sam B" },
    { id: "c", name: "Alex" },
  ];
  const { lines, unmatched } = parseLeagueReply(
    "Sam: Rode Toka's immunity win. Sam B: Benched Ana the night she went home. **Alex:** Started three people who did nothing.",
    teams
  );
  assert.deepEqual(lines, {
    a: "Rode Toka's immunity win.",
    b: "Benched Ana the night she went home.",
    c: "Started three people who did nothing.",
  });
  assert.deepEqual(unmatched, []);
});

test("a name mid-sentence isn't a new team, and a sign-off after the last line isn't part of it", () => {
  const teams = [
    { id: "a", name: "Rob" },
    { id: "b", name: "Alex" },
  ];
  const { lines, unmatched } = parseLeagueReply(
    "Alex: Started Rob - the castaway - who went home.\nRob: Robbed by a blindside.\n\nHope these help!",
    teams
  );
  assert.deepEqual(lines, { b: "Started Rob - the castaway - who went home.", a: "Robbed by a blindside." });
  assert.deepEqual(unmatched, ["Hope these help!"]);
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

test("a copied chat reply with Markdown line breaks (a trailing backslash) reads cleanly", () => {
  const teams = [
    { id: "c", name: "conor" },
    { id: "j", name: "riley" },
    { id: "a", name: "jordan" },
  ];
  const reply =
    "conor: Rode Toka's two challenge wins.\\\n riley: Benched Ana before she was voted out.\\\n jordan: Left Patt on the bench.";
  assert.deepEqual(parseLeagueReply(reply, teams).lines, {
    c: "Rode Toka's two challenge wins.",
    j: "Benched Ana before she was voted out.",
    a: "Left Patt on the bench.",
  });
});
