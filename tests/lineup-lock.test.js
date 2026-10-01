// Lineups and picks lock when the episode starts airing (ep.airsAt), or once it has results.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");

function league(type) {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: type, activeSlots: 2 });
  s.players = [{ id: "p1", name: "A", color: "#f00", active: true, disabled: false }];
  const c = (id) => ({ id, name: id, tribeId: null, ownerIds: type === "pickem" ? [] : ["p1"], status: "active", exitEpisodeId: null });
  s.castaways = [c("a"), c("b"), c("c")];
  s.episodes = [{ id: "e1", number: 1, postMerge: false, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }];
  return s;
}
const HOUR = 3600 * 1000;

test("a lineup is open before the episode airs and locked from the moment it does", () => {
  const s = league("active-roster");
  s.episodes[0].airsAt = new Date(Date.now() + HOUR).toISOString();
  assert.equal(StateLogic.ActiveRosterLogic.isLineupLocked(s, "e1"), false);
  assert.ok(StateLogic.setActiveRosterLineup(s, "e1", "p1", ["a", "b"]));
  s.episodes[0].airsAt = new Date(Date.now() - 60 * 1000).toISOString();
  assert.equal(StateLogic.ActiveRosterLogic.isLineupLocked(s, "e1"), true);
  assert.match(StateLogic.ActiveRosterLogic.validateLineup(s, "e1", "p1", ["a"]), /started/);
});

test("no schedule: open until results arrive", () => {
  const s = league("active-roster");
  assert.equal(StateLogic.ActiveRosterLogic.isLineupLocked(s, "e1"), false);
  StateLogic.addElimination(s, "e1", "c", "Voted Out");
  assert.equal(StateLogic.ActiveRosterLogic.isLineupLocked(s, "e1"), true);
});

test("an Eliminator Pool pick can't be made or changed once the episode has started", () => {
  const s = league("pickem");
  s.episodes[0].airsAt = new Date(Date.now() - 60 * 1000).toISOString();
  StateLogic.setPickEmPick(s, "e1", "p1", "a");
  assert.equal(StateLogic.pickEmPickFor(s, "e1", "p1"), null);
  s.episodes[0].airsAt = new Date(Date.now() + HOUR).toISOString();
  StateLogic.setPickEmPick(s, "e1", "p1", "a");
  assert.equal(StateLogic.pickEmPickFor(s, "e1", "p1").castawayId, "a");
});
