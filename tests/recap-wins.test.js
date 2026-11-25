// An episode's headline wins on its page and in the reveal (src/lib/game/episode-recap.ts): a win shows as a
// tribe only when it was strictly a tribe contest, otherwise by the winners' names. Survivor 51 Ep 9 is the
// case: a reward won by a team picked for it, in a merged game whose merge was never recorded, showed as all
// three old tribes. Runs on a made-up demo season, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { episodeRecapWins } = jiti("../src/lib/game/episode-recap.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 12 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 12 - i,
    exitEpisode: i < 3 ? i + 1 : EPISODES, exitMethod: "Voted Out",
  })),
};

// Three tribes of three still in play at episode 5 (castaways 3-11).
function season() {
  const state = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", 4))));
  state.tribes = ["Red", "Blue", "Gold"].map((name, i) => ({ id: `t${i}`, name, color: "#000" }));
  state.castaways.forEach((c, i) => { c.tribeId = `t${i % 3}`; delete c.startTribeId; });
  const ep = state.episodes.find((e) => e.number === 5);
  ep.groups = []; ep.postMerge = false;
  return { state, ep, inPlay: state.castaways.slice(3) };
}
const win = (ep, type, cs) => { ep.scoringEvents = [...(ep.scoringEvents || []), ...cs.map((c, i) => ({ id: `${type}${i}`, type, castawayId: c.id }))]; };
const reward = (state, ep) => episodeRecapWins(state, ep).find((w) => w.label === "Reward");
const immunity = (state, ep) => episodeRecapWins(state, ep).find((w) => w.label === "Immunity");
const names = (w) => w.castaways.map((c) => c.name).sort();
const tribeNames = (w) => w.tribes.map((t) => t.tribe.name).sort();

test("a reward a whole tribe won shows as its tribe", () => {
  const { state, ep, inPlay } = season();
  win(ep, "rewardWin", inPlay.filter((c) => c.tribeId === "t1"));
  assert.deepEqual(tribeNames(reward(state, ep)), ["Blue"]);
  assert.deepEqual(reward(state, ep).castaways, []);
});

test("a reward won by a team picked across the tribes shows by name (Survivor 51 Ep 9)", () => {
  const { state, ep, inPlay } = season();
  // Five winners, from every tribe, including the whole of one: still names, since no tribe lost.
  const team = [...inPlay.filter((c) => c.tribeId === "t0"), ...inPlay.filter((c) => c.tribeId !== "t0").slice(0, 2)];
  assert.equal(new Set(team.map((c) => c.tribeId)).size, 3);
  win(ep, "rewardWin", team);
  assert.deepEqual(reward(state, ep).tribes, []);
  assert.deepEqual(names(reward(state, ep)), team.map((c) => c.name).sort());
});

test("part of a tribe winning a reward shows by name", () => {
  const { state, ep, inPlay } = season();
  const two = inPlay.filter((c) => c.tribeId === "t2").slice(0, 2);
  win(ep, "rewardWin", two);
  assert.deepEqual(reward(state, ep).tribes, []);
  assert.deepEqual(names(reward(state, ep)), two.map((c) => c.name).sort());
});

test("tribe immunity is still its tribe's when only some of it was logged", () => {
  const { state, ep, inPlay } = season();
  win(ep, "tribeImmunity", inPlay.filter((c) => c.tribeId === "t0").slice(0, 1));
  assert.deepEqual(tribeNames(immunity(state, ep)), ["Red"]);
});

test("after the merge a whole old tribe's win is by name", () => {
  const { state, ep, inPlay } = season();
  ep.postMerge = true;
  win(ep, "rewardWin", inPlay.filter((c) => c.tribeId === "t1"));
  assert.deepEqual(reward(state, ep).tribes, []);
  assert.equal(reward(state, ep).castaways.length, 3);
});
