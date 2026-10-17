// Up next's order (action-items.js byDue / dueAt): what someone is waiting on now first, then the
// soonest deadline, then anything with none; and whose job each item is (`who`). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { byDue, dueAt } = require("../src/lib/game/action-items.js");

const at = (h) => new Date(Date.parse("2026-10-17T12:00:00Z") + h * 3_600_000).toISOString();

test("now before any deadline, soonest first, no deadline last; ties keep their order", () => {
  const items = [
    { kind: "prediction", deadline: null, text: "guess" },
    { kind: "lineup", deadline: at(30), text: "lineup" },
    { kind: "pickup", deadline: at(3), text: "replace" },
    { kind: "results", deadline: null, text: "results" },
    { kind: "pick", deadline: at(30), text: "pick" },
    { kind: "draftTurn", deadline: null, text: "draft" },
  ];
  assert.deepEqual([...items].sort(byDue).map((it) => it.text), ["results", "draft", "replace", "lineup", "pick", "guess"]);
  assert.equal(dueAt({ kind: "lineup", deadline: "not a date" }), Infinity);
});

test("actionItems says whose job each item is", () => {
  const { actionItems } = require("../src/lib/game/action-items.js");
  const StateLogic = require("../src/lib/game/state-logic.js");
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: "eliminator-pool", showId: null });
  s.players = [{ id: "p1", name: "Ana", color: "#f00", active: true, disabled: false }];
  s.castaways = [{ id: "c1", name: "Cast One", tribeId: null, ownerIds: [], status: "active" }];
  s.episodes = [
    { id: "e1", number: 1, events: [], bets: [], picks: [], airsAt: at(-48) },
    { id: "e2", number: 2, events: [], bets: [], picks: [], airsAt: at(48) },
  ];
  const items = actionItems(s, "p1", null, { commissioner: true, now: Date.parse(at(0)) });
  const results = items.find((it) => it.kind === "results");
  assert.equal(results?.who, "commish");
  for (const it of items.filter((x) => x.kind !== "results")) assert.equal(it.who, "you");
});
