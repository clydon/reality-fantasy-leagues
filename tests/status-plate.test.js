// Overview's status plate: which beat it says for each phase of a league (src/lib/game/status-plate.ts).
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const { statusPlate } = jiti("../src/lib/game/status-plate.ts");

const DAY = 86_400_000;
// The real clock: StateLogic.isDraftStarted compares a scheduled draft with Date.now(), so a fixed date
// would make "before the draft" go stale.
const NOW = Date.now();

function league() {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: "classic-draft", ownershipMode: "exclusive" });
  s.players = ["Ana", "Ben", "Cy"].map((name, i) => ({ id: `p${i + 1}`, name, color: "#f00", active: true, disabled: false }));
  s.draftOrder = ["p1", "p2", "p3"];
  s.castaways = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `Cast ${i}`, tribeId: null, ownerIds: [], status: "active" }));
  s.episodes = [{ id: "e1", number: 1, events: [], bets: [], picks: [], airsAt: new Date(NOW + 3 * DAY).toISOString() }];
  return s;
}

test("before the draft: when it is and where you pick", () => {
  const s = league();
  s.settings.draftScheduledAt = new Date(NOW + 2 * DAY).toISOString();
  const p = statusPlate(s, { me: "p2", isCommissioner: false, now: NOW });
  assert.equal(p.tag, "Draft");
  assert.match(p.detail, /^In 2 days · you pick 2nd$/);
  assert.equal(p.href, "/draft");
});

test("a commissioner's blocker isn't the plate's: the control room above it has it", () => {
  const s = league();
  const p = statusPlate(s, { me: "p1", isCommissioner: true, now: NOW });
  assert.equal(p.tag, "Draft");
  assert.equal(p.title, "Not scheduled yet");
});

test("draft running: who's on the clock, and whether you're next", () => {
  const s = league();
  s.draftForceStarted = true;
  const p = statusPlate(s, { me: "p2", isCommissioner: false, now: NOW });
  assert.equal(p.title, "Ana is on the clock");
  assert.match(p.detail, /^Pick 1 of \d+ · you're next$/);
});

test("weekly default after the draft: when the next episode airs and how many are left", () => {
  const s = league();
  s.draftForceStarted = true;
  s.draftPicksMade = s.draftOrder.length * StateLogic.rosterSize(s);
  s.castaways[0].status = "eliminated";
  const p = statusPlate(s, { me: "p1", isCommissioner: false, now: NOW });
  assert.equal(p.tag, "Ep 1");
  assert.match(p.title, /^Airs /);
  assert.equal(p.detail, "In 3 days · the cast is down to 11");
  assert.equal(p.href, undefined);
});

test("results waiting to be revealed: no plate (the reveal prompt has the slot)", () => {
  const s = league();
  s.episodes[0].resultsHidden = true;
  assert.equal(statusPlate(s, { me: "p1", isCommissioner: true, now: NOW }), null);
});
