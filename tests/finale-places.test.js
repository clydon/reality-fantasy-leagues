// BACKLOG 116 (PLAYTEST-REPORT finding 17): a finale's places follow how each finished, not the order research named them in. Within
// a night, anyone knocked out first, then the format's endgame exits in its order (lowest place first), the winner last: a finale
// filed winner first still places the winner first, and its medal is gold. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { applyDecision, orderPlacementsByEpisode, finishRank } = jiti("../src/lib/game/decision-apply.ts");
const { medalFor } = jiti("../src/lib/game/selectors.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 16; // one boot an episode, the final three at the finale
function season() {
  const data = {
    id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
    players: ["ann", "bo"].map((key) => ({ key, name: key, color: "#000" })),
    castaways: Array.from({ length: 18 }, (_, i) => ({
      key: `k${i}`, name: `Castaway ${i}`, placement: i + 1, exitEpisode: Math.min(i + 1, EPISODES),
      exitMethod: i === 17 ? "Sole Survivor" : i >= 15 ? "Lost Final Tribal (Jury Vote)" : "Voted Out",
    })),
  };
  return S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "classic-draft", EPISODES - 1))));
}
const fact = (name, method, n = EPISODES) => ({ episode_number: n, post_merge: true, kind: "elimination", castaway_name: name, method, event_type: "", jury_votes: null, units: null, applied: null });
const place = (s, name) => s.castaways.find((c) => c.name === name).placementOrder;

test("a finale filed winner first still places the winner first", () => {
  const s = season();
  // The quick check's order: the winner first.
  applyDecision(s, fact("Castaway 17", "Sole Survivor"), []);
  applyDecision(s, fact("Castaway 15", "Lost Final Tribal (Jury Vote)"), []);
  applyDecision(s, fact("Castaway 16", "Lost Final Tribal (Jury Vote)"), []);
  orderPlacementsByEpisode(s);
  const winner = s.castaways.find((c) => c.name === "Castaway 17");
  assert.equal(S.seasonWinner(s)?.name, "Castaway 17");
  assert.equal(winner.placementOrder, s.castaways.length, "the winner's place is 1st");
  assert.equal(medalFor(s, winner.placementOrder), "gold");
  // The two who lost the vote keep the order they were filed in between them.
  assert.ok(place(s, "Castaway 15") < place(s, "Castaway 16"));
});

test("a finale night's last boot goes before its finalists, whatever order they're filed in", () => {
  const s = season();
  applyDecision(s, fact("Castaway 17", "Sole Survivor"), []);
  applyDecision(s, fact("Castaway 16", "Lost Final Tribal (Jury Vote)"), []);
  applyDecision(s, fact("Castaway 15", "Voted Out"), []); // the fire-making loser: knocked out
  orderPlacementsByEpisode(s);
  assert.deepEqual(["Castaway 15", "Castaway 16", "Castaway 17"].map((n) => place(s, n)), [16, 17, 18]);
});

test("finishRank: knocked out 0, the endgame exits in the format's order, the winner above them all", () => {
  const rank = finishRank(season());
  assert.equal(rank("Voted Out"), 0);
  assert.equal(rank(null), 0);
  assert.equal(rank("Lost Final Tribal (Jury Vote)"), 1);
  assert.equal(rank("Sole Survivor"), 3);
});

// Finding 1: the research checklist says plainly that the winner and the finalists leave the game at the finale, in the format's
// own exits, on a show that crowns a winner; a show nobody wins asks as before.
const R = require("../db/episode-research.js");
const F = require("../src/lib/game/formats/index.js");
const person = (format) => R.jsonSchemaFor(R.researchSchemaFor(format), "strict").properties.castaways.items.properties;

test("the checklist tells research the finale's winner and finalists leave, with which exits", () => {
  const p = person(F.FORMATS.survivor);
  assert.match(p.leftTheGame.description, /At the finale the winner and every finalist leave the game too: 'yes' for each of them\.$/);
  assert.match(p.exitMethod.description, /the winner's is "Sole Survivor", and each finalist's is how they finished \("Lost Final Tribal \(Jury Vote\)"\)\.$/);
  const data = JSON.parse(JSON.stringify(F.FORMATS.survivor.data));
  data.winnerExitMethod = null;
  const nobody = F.formatForRulebook(data, "");
  assert.doesNotMatch(person(nobody).leftTheGame.description, /finale/, "a show nobody wins asks as before");
});
