// Results in stages (StateLogic.resultsStage) and the new design's episodes and reveal (src/lib/game/episode-view.ts,
// docs/PLAN-new-design.md step 2): what a viewer sees of each episode at their mark, and the reveal of one episode
// (the copy at n against the copy at n - 1). Runs on made-up demo seasons, so no database is needed. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { episodesSeen, revealIn } = jiti("../src/lib/game/episode-view.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const CURSOR = 5; // results through episode 5
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
const ep = (state, n) => state.episodes.find((e) => e.number === n);

test("an episode's results stage: none, early while only who went home is in, then final", () => {
  const state = league("active-roster");
  assert.equal(S.resultsStage(ep(state, CURSOR + 1)), null, "nothing in yet");
  assert.equal(S.resultsStage(ep(state, CURSOR)), "final", "results from before stages are final");
  S.setResultsStage(state, ep(state, CURSOR).id, "early");
  assert.equal(S.resultsStage(ep(state, CURSOR)), "early");
  // A viewer who hasn't revealed it isn't told even that.
  assert.equal(ep(S.SpoilerLogic.viewThrough(state, CURSOR - 1), CURSOR).resultsStage, undefined);
  S.setResultsStage(state, ep(state, CURSOR).id, "final");
  assert.equal(ep(state, CURSOR).resultsStage, undefined, "final takes the mark off");
});

test("the episodes a viewer has seen stop at their mark, each with who went home", () => {
  const state = league("classic-draft");
  const seen = episodesSeen(ref("classic-draft"), state, ann(state), 3);
  assert.deepEqual(seen.map((e) => e.number), [3, 2, 1]);
  for (const e of seen) {
    assert.equal(e.out.length, 1, `episode ${e.number}: one out`);
    assert.equal(e.out[0].name, `Castaway ${e.number - 1}`);
    assert.equal(e.lines[0].gameName, "classic-draft");
  }
});

test("Weekly Lineup's line reads so far at the early stage", () => {
  const state = league("active-roster");
  S.setResultsStage(state, ep(state, CURSOR).id, "early");
  const five = episodesSeen(ref("active-roster"), state, ann(state), CURSOR).find((e) => e.number === CURSOR);
  assert.equal(five.stage, "early");
  assert.ok(five.lines[0].soFar && /so far$/.test(five.lines[0].big));
});

test("the reveal of episode n: who went home, and the table before and after it", () => {
  const state = league("active-roster");
  const r = revealIn(ref("active-roster"), state, ann(state), CURSOR, userOf);
  assert.equal(r.out.length, 1);
  assert.equal(r.out[0].name, `Castaway ${CURSOR - 1}`);
  assert.ok(r.lineup, "your lineup's part");
  const me = r.table.rows.find((x) => x.you);
  const all = (key) => r.table.rows.reduce((n, x) => n + x[key].total, 0);
  assert.ok(all("after") >= all("before"), "the table moves on from the episode before");
  assert.ok(me.before.place >= 1 && me.after.place >= 1);
  assert.equal(revealIn(ref("active-roster"), state, ann(state), CURSOR + 1, userOf), null, "nothing to reveal with no results");
});

test("the pool's reveal: your pick and the streak it leaves you on", () => {
  const state = league("pickem");
  const r = revealIn(ref("pickem"), state, ann(state), CURSOR, userOf);
  assert.ok(r.game, "the pool's part");
  assert.ok(r.game.streak && r.game.streak.to >= 0);
  assert.ok(/survived|went home|No pick/.test(r.game.title), r.game.title);
});

// The reveal's plates (the user, 2026-11-19: "Missing some name plates"): everyone it names comes with a face and the tribe they were
// in for the episode, the merge's colour once merged; a tribe that won as one brings who won it; the pool's pick and Outlast's team
// come as plates with their fate.
test("the reveal's plates: faces and the tribe each was in for the episode, the merge's colour once merged", () => {
  const tribal = { ...data, groups: [{ key: "a", name: "Toka", color: "#e0b23a" }, { key: "b", name: "Savu", color: "#9b6bd0" }], castaways: data.castaways.map((c, i) => ({ ...c, groupKey: i % 2 ? "b" : "a" })) };
  const build = (type) => S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(tribal, type, CURSOR))));
  const merged = (state) => state.tribes.find((t) => t.name === "Merged Tribe");
  const still = (state, n) => state.castaways.filter((c) => c.status !== "eliminated" || ep(state, n).number < (state.episodes.find((e) => e.id === c.exitEpisodeId)?.number ?? 99));
  const win = (state, n, type, cs) => cs.forEach((c) => ep(state, n).scoringEvents.push({ id: `t_${type}_${c.id}`, type, castawayId: c.id }));

  // Episode 5 is the demo's merge: two on the Reward and one on Immunity, every plate the merge's colour.
  const after = build("classic-draft");
  const [a, b, c] = still(after, CURSOR);
  win(after, CURSOR, "rewardWin", [a, b]);
  win(after, CURSOR, "individualImmunity", [c]);
  const r = revealIn(ref("classic-draft"), after, ann(after), CURSOR, userOf);
  const reward = r.happened.find((h) => h.label === "Reward");
  assert.deepEqual(reward.winners.map((w) => w.face?.id), [a.id, b.id].sort((x, y) => after.castaways.findIndex((q) => q.id === x) - after.castaways.findIndex((q) => q.id === y)));
  assert.ok(r.happened.flatMap((h) => h.winners).every((w) => w.face && w.face.tribe?.colour === merged(after).color), "the merge's colour on every plate");
  assert.equal(reward.winners[0].colour, null, "someone on their own keeps no colour of their own (the old plate's fill)");
  assert.ok(r.out.every((o) => o.tribe), "who went home carries their tribe too");

  // Outlast: everyone you've had, who went tonight first, then who's in, then who went before (dim, with the episode).
  const team = r.game.faces;
  assert.ok(team.length > 0 && team.every((f) => ["in", "out", "gone"].includes(f.fate)));
  const order = team.map((f) => ["out", "in", "gone"].indexOf(f.fate));
  assert.deepEqual(order, [...order].sort((x, y) => x - y), "tonight's first, then still in, then gone");
  assert.ok(team.filter((f) => f.fate === "gone").every((f) => f.outEp < CURSOR && f.tribe), "someone gone before keeps the tribe they left from");

  // Before the merge, a tribe that won as one comes as its tribe, with who won it.
  const before = build("classic-draft");
  const n = CURSOR - 1;
  const toka = still(before, n).filter((x) => x.tribeId === before.tribes.find((t) => t.name === "Toka").id || x.startTribeId === before.tribes.find((t) => t.name === "Toka").id);
  win(before, n, "tribeImmunity", toka);
  const r4 = revealIn(ref("classic-draft"), before, ann(before), n, userOf);
  const imm = r4.happened.find((h) => h.label === "Immunity").winners;
  assert.equal(imm.length, 1);
  assert.equal(imm[0].name, "Toka");
  assert.equal(imm[0].colour, "#e0b23a");
  assert.equal(imm[0].members.length, toka.length);

  // The pool: the pick as a plate, its fate the night's.
  const pool = build("pickem");
  const p = revealIn(ref("pickem"), pool, ann(pool), CURSOR, userOf).game;
  if (p.faces) {
    assert.equal(p.faces.length, 1);
    assert.equal(p.faces[0].fate, /survived/.test(p.title) ? "in" : "out");
  } else assert.equal(p.title, "No pick");
});
