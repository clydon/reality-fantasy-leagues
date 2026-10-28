// An episode's lock on lineups and picks (state-logic.js closedForPlay, 2026-10-27): Auto closes them at its start; whoever runs
// the game can override that, open past the start (ep.openPastAir: a couch that sat down late, Start a game's Include it) or
// locked early (ep.lineupsLocked). Results close them whatever the lock says. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");

const HOUR = 3600 * 1000;

function league(type) {
  const s = S.defaultState();
  Object.assign(s.settings, { leagueTypeId: type, activeSlots: 1, benchSlots: 0, teamSize: 1, setupComplete: true });
  s.tribes = [{ id: "A", name: "A", color: "#f00" }];
  s.castaways = ["a1", "a2", "a3"].map((id) => ({ id, name: id, tribeId: "A", ownerIds: id === "a1" ? ["p1"] : [], status: "active", exitEpisodeId: null }));
  s.players = [{ id: "p1", name: "Ann", color: "#f00", active: true, disabled: false }];
  s.draftOrder = ["p1"];
  s.draftPicksMade = 1;
  s.episodes = [];
  S.ensureNextEpisode(s);
  return s;
}
const ep1 = (s) => s.episodes.find((e) => e.number === 1);
const startedAgo = (s, ms) => (ep1(s).airsAt = new Date(Date.now() - ms).toISOString());

test("Auto: open before the start, closed from it", () => {
  const s = league("active-roster");
  startedAgo(s, -HOUR);
  assert.equal(S.closedForPlay(ep1(s)), false);
  assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep1(s).id), false);
  startedAgo(s, HOUR);
  assert.equal(S.closedForPlay(ep1(s)), true);
  assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep1(s).id), true);
});

test("Override: open past the start, until its results are in", () => {
  const s = league("active-roster");
  startedAgo(s, HOUR);
  ep1(s).openPastAir = true;
  assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep1(s).id), false);
  assert.equal(S.ActiveRosterLogic.validateLineup(s, ep1(s).id, "p1", ["a1"]), null, "a lineup can be set past the start");
  ep1(s).scoringEvents = [{ id: "e1", type: "individualImmunity", castawayId: "a1" }];
  assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep1(s).id), true, "results close it");
});

test("Override: locked before the start", () => {
  const s = league("active-roster");
  startedAgo(s, -HOUR);
  ep1(s).lineupsLocked = true;
  assert.equal(S.closedForPlay(ep1(s)), true);
  assert.equal(S.ActiveRosterLogic.isLineupLocked(s, ep1(s).id), true);
});

test("Survival Pool: a pick past the start only with the override, and not once locked early", () => {
  const s = league("pickem");
  startedAgo(s, HOUR);
  S.PickEmLogic.setPick(s, ep1(s).id, "p1", "a2");
  assert.equal(S.PickEmLogic.pickFor(s, ep1(s).id, "p1"), null, "closed at its start");
  ep1(s).openPastAir = true;
  S.PickEmLogic.setPick(s, ep1(s).id, "p1", "a2");
  assert.equal(S.PickEmLogic.pickFor(s, ep1(s).id, "p1")?.castawayId, "a2", "open past it");
  const t = league("pickem");
  startedAgo(t, -HOUR);
  ep1(t).lineupsLocked = true;
  S.PickEmLogic.setPick(t, ep1(t).id, "p1", "a2");
  assert.equal(S.PickEmLogic.pickFor(t, ep1(t).id, "p1"), null, "locked early");
});
