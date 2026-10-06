// Stage 3 step 2 (docs/PLAN-stage-3-format-proposals.md): a league on a stored format plays by the data
// cached in its settings, a built-in format never needs or keeps any, and every server lookup goes
// through db/show-formats.js. The database itself isn't needed: `db` is a stand-in that answers the one
// query these helpers make. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const SF = require("../db/show-formats.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const P = require("../src/lib/game/formats/proposal.js");

const data = P.reviewProposal({
  show: { name: "The Mole Island", castawayTerm: "Player", tribeTerm: "Team" },
  exitMethods: [{ name: "Executed", kind: "out" }, { name: "Winner", kind: "winner" }],
  questions: [{ key: "wonMission", type: "answer", question: "Did they win the mission?", note: "won the mission", tier: "A" }],
  events: [
    { id: "missionWin", label: "Won a mission", category: "Missions", points: 2, tier: "A" },
    { id: "executed", label: "Executed", category: "Leaving", points: -3, tier: "A" },
  ],
  rules: { research: [{ when: { answer: "wonMission", is: "yes" }, award: "missionWin" }], implied: [{ whenExit: "Executed", award: "executed" }] },
}).data;

// A stand-in database: show_formats has `data` approved under its id, and counts the queries made.
function fakeDb(rowsById) {
  const db = { queries: 0 };
  db.query = async (sql, [id]) => {
    db.queries++;
    assert.match(sql, /FROM show_formats WHERE id=\$1 AND status='approved'/);
    return { rows: rowsById[id] ? [{ data: rowsById[id] }] : [] };
  };
  return db;
}

test("a league scores by its cached stored format, and ignores data on a built-in", () => {
  const settings = { leagueTypeId: "active-roster" };
  SF.setLeagueFormat(settings, data.id, data);
  const state = JSON.parse(JSON.stringify(StateLogic.migrateLeagueState({ settings, players: [], castaways: [], episodes: [] })));
  const f = StateLogic.formatOf(state);
  assert.equal(f.name, "The Mole Island");
  assert.deepEqual(StateLogic.defaultEventPoints(state), { missionWin: 2, executed: -3 });
  const ep = { number: 1, events: [{ castawayId: "c1", method: "Executed" }], scoringEvents: [] };
  assert.deepEqual(StateLogic.ActiveRosterLogic.episodeEvents(state, ep).map((e) => e.type), ["executed"]);

  // A built-in id with data beside it (however it got there) is still the built-in.
  assert.equal(StateLogic.formatOf({ settings: { showFormat: "traitors", showFormatData: data } }).id, "traitors");
  // Stored id, data missing: the default, as for any unknown id.
  assert.equal(StateLogic.formatOf({ settings: { showFormat: data.id } }).id, "survivor");
  // No settings at all.
  assert.equal(StateLogic.formatOf(null).id, "survivor");
});

test("setLeagueFormat keeps data only for a stored format", () => {
  const s = {};
  SF.setLeagueFormat(s, data.id, data);
  assert.deepEqual(s, { showFormat: data.id, showFormatData: data });
  SF.setLeagueFormat(s, "generic", data);
  assert.deepEqual(s, { showFormat: "generic" }, "switching to a built-in drops the cached data");
  SF.setLeagueFormat(s, null, null);
  assert.deepEqual(s, { showFormat: null });
});

test("server lookups resolve stored formats, and never query for a built-in", async () => {
  const db = fakeDb({ [data.id]: data });
  assert.equal((await SF.resolveFormat(db, data.id)).name, "The Mole Island");
  assert.equal(await SF.isPlayableFormat(db, data.id), true);
  assert.equal(await SF.isPlayableFormat(db, "a-draft"), false);
  assert.equal((await SF.resolveFormat(db, "a-draft")).id, "survivor");
  const before = db.queries;
  assert.equal((await SF.resolveFormat(db, "survivor")).id, "survivor");
  assert.equal(await SF.isPlayableFormat(db, "challenge"), true);
  assert.equal(await SF.formatDataFor(db, null), null);
  assert.equal(await SF.isPlayableFormat(db, 7), false);
  assert.equal(db.queries, before, "built-ins (and nonsense) never touch the database");
});
