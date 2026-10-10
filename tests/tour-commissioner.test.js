// The guided tour's commissioner path (src/lib/tour/commissioner.ts, docs/PLAN-guided-tour.md): the
// league starts with the draft closed, and Episode 1's results arrive staged, as research would find
// them, for the commissioner to check and apply. Applies them under the real rules, all of them and
// with one unticked. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const T = jiti("../src/lib/tour/rise-and-fall.ts");
const C = jiti("../src/lib/tour/commissioner.ts");
const S = require("../src/lib/game/state-logic.js");

const ep = (s, n) => s.episodes.find((e) => e.number === n);

// Created, the draft started and played out with you taking whoever's first, everyone's lineup in:
// Episode 1 has aired and its results are staged.
function aired() {
  const s = C.buildCommissionerState();
  assert.ok(!S.isDraftStarted(s), "the commissioner starts the draft");
  assert.equal(s.players.filter((p) => p.automated).length, 2, "Ben and Kat are in as computer players");
  S.forceStartDraft(s);
  while (!S.currentDraftTurn(s).isComplete) {
    S.draftToCurrentTurn(s, S.freeAgents(s)[0].id);
    T.botsDraft(s);
  }
  T.botLineups(s, 1, [T.TOUR_ME, T.TOUR_BEN, T.TOUR_KAT]);
  assert.equal(S.activeRosterLineupFor(s, ep(s, 1).id, T.TOUR_ME).length, 2, "your lineup goes in for you");
  const staged = C.stageResults(s, 1);
  return { s, staged };
}

const item = (d) => ({ kind: d.kind, castawayName: d.castawayName, method: d.method, eventType: d.eventType });

test("Episode 1 is staged, not written: a winner, the bottom two and who went home", () => {
  const { s, staged } = aired();
  assert.ok(!S.episodeHasResults(ep(s, 1)), "nothing is in the league until it's applied");
  assert.ok(ep(s, 1).lineupsLocked, "the episode has aired");
  assert.deepEqual(staged.filter((d) => d.eventType === "wonWeek").map((d) => d.castawayName), ["Clive"]);
  assert.equal(staged.filter((d) => d.eventType === "bottomTwo").length, 2);
  assert.equal(staged.filter((d) => d.kind === "elimination").length, 1);
  assert.ok(staged.some((d) => d.confidence === "low"), "one result is worth checking");
  const panel = C.tourPanel(s, 1, staged);
  assert.equal(panel.prompt, null, "nothing to paste on the tour");
  assert.ok(panel.staged.every((d) => !d.inLeague));
});

test("applying everything scores it like the player's tour, and opens Episode 2", () => {
  const { s, staged } = aired();
  const r = C.applyTourResults(s, 1, staged.map(item));
  assert.equal(r.eliminations.length, 1);
  assert.equal(r.events.length, 3);
  assert.ok(S.episodeHasResults(ep(s, 1)));
  assert.equal(S.getCastaway(s, T.TOUR_STAR).status, "active");
  assert.equal(s.castaways.filter((c) => c.status === "eliminated").length, 1);
  assert.ok(ep(s, 2), "Episode 2 is next");
  assert.ok(C.tourPanel(s, 1, staged).staged.every((d) => d.inLeague), "everything is in the league now");
});

test("an unticked result stays out of the league", () => {
  const { s, staged } = aired();
  const low = staged.find((d) => d.confidence === "low");
  C.applyTourResults(s, 1, staged.filter((d) => d !== low).map(item));
  const lowId = s.castaways.find((c) => c.name === low.castawayName).id;
  assert.ok(!ep(s, 1).scoringEvents.some((e) => e.type === low.eventType && e.castawayId === lowId));
  assert.equal(C.tourPanel(s, 1, staged).staged.filter((d) => !d.inLeague).length, 1);
});
