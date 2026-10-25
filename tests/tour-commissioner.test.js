// The guided tour's commissioner path (src/lib/tour/commissioner.ts, docs/PLAN-commissioner-tour.md): the
// league starts with no cast and the draft closed; you import Survivor 51's cast, start the draft and play it
// out, and Episode 1's results arrive staged, as research would find them, for the commissioner to check and
// apply. Applies them under the real rules, all of them and with one unticked. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const C = jiti("../src/lib/tour/commissioner.ts");
const { TOUR_CAST_NAMES } = jiti("../src/lib/tour/samples.ts");
const S = require("../src/lib/game/state-logic.js");

const ep = (s, n) => s.episodes.find((e) => e.number === n);

// Created, the cast imported, the draft started and played out with you taking whoever's first (Ben and Kat
// from their lists), everyone's lineup in: Episode 1 has aired and its results are staged.
function aired() {
  const s = C.buildCommissionerState();
  assert.equal(s.castaways.length, 0, "the league starts with no cast: importing it is a step of the tour");
  assert.ok(!S.isDraftStarted(s), "the commissioner starts the draft");
  assert.equal(s.players.filter((p) => p.automated).length, 2, "Ben and Kat are in as computer players");
  S.applyCastImport(s, { tribes: [{ name: "Toka" }, { name: "Savu" }], castaways: TOUR_CAST_NAMES.map((name) => ({ name })) });
  S.forceStartDraft(s);
  C.botsDraftSurvivor(s);
  while (!S.currentDraftTurn(s).isComplete) {
    S.draftToCurrentTurn(s, S.freeAgents(s)[0].id);
    C.botsDraftSurvivor(s);
  }
  C.setAllLineups(s, 1);
  assert.equal(S.activeRosterLineupFor(s, ep(s, 1).id, s.players.find((p) => p.name === "You").id).length, 2, "your lineup goes in for you");
  const staged = C.stageResults(1);
  return { s, staged };
}

const item = (d) => ({ kind: d.kind, castawayName: d.castawayName, method: d.method, eventType: d.eventType });

test("Episode 1 is staged, not written: who went home, the immunity winners and one to check", () => {
  const { s, staged } = aired();
  assert.ok(!S.episodeHasResults(ep(s, 1)), "nothing is in the league until it's applied");
  assert.ok(ep(s, 1).lineupsLocked, "the episode has aired");
  assert.deepEqual(staged.filter((d) => d.kind === "elimination").map((d) => d.castawayName), ["Mike Pinsky"]);
  assert.equal(staged.filter((d) => d.eventType === "tribeImmunity").length, 3);
  assert.equal(staged.filter((d) => d.confidence === "low").length, 1, "one result is worth checking");
  const panel = C.tourPanel(s, 1, staged);
  assert.equal(panel.prompt, null, "nothing to paste on the tour");
  assert.ok(panel.staged.every((d) => !d.inLeague));
});

test("applying everything scores it", () => {
  const { s, staged } = aired();
  const r = C.applyTourResults(s, 1, staged.map(item));
  assert.equal(r.eliminations.length, 1);
  assert.equal(r.events.length, staged.filter((d) => d.kind === "event").length);
  assert.ok(S.episodeHasResults(ep(s, 1)));
  assert.deepEqual(s.castaways.filter((c) => c.status === "eliminated").map((c) => c.name), ["Mike Pinsky"]);
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
