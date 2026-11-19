// A draft that waits for whoever runs the game (docs/design-round/draft-start-spec.md): when it's its Commissioner's to start
// (action-items.js draftStartDue, runnerItems), what everyone else is told (draft-soon.ts draftSoonOf), and the draft room's read
// (draft-view.ts startDue, runBy). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const { runnerItems, draftStartDue, actionItems } = require("../src/lib/game/action-items.js");
const { draftSoonOf } = jiti("../src/lib/game/draft-soon.ts");
const { draftView } = jiti("../src/lib/game/draft-view.ts");

const PEOPLE = ["ann", "bo", "cy"];
function league({ shared = false, people = PEOPLE, cast = 6 } = {}) {
  return S.migrateLeagueState({
    settings: { leagueTypeId: "classic-draft", showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive", teamSize: 2, startEpisode: 1 },
    players: people.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), color: "#000", active: true })),
    draftOrder: [...people],
    tribes: [{ id: "t1", name: "Toka", color: "#e0b23a" }],
    castaways: Array.from({ length: cast }, (_, i) => ({ id: `c${i}`, name: `C${i} Person`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
}

test("a draft with no time set is its Commissioner's to start, as their own move; never in actionItems", () => {
  for (const shared of [false, true]) {
    const s = league({ shared });
    assert.equal(draftStartDue(s), true, shared ? "blind" : "turn-based");
    const [it] = runnerItems(s);
    assert.equal(it.kind, "draftStart");
    assert.equal(it.text, "Start the draft");
    assert.equal(it.draft, shared ? "blind" : "snake");
    assert.equal(it.who, "you");
    // The classic bar and the reminders read actionItems: nothing new there.
    assert.ok(!actionItems(s, "ann", null, { commissioner: true }).some((x) => x.kind === "draftStart"));
  }
});

test("nothing to start: a time set (it starts by itself), started, one seat, no cast", () => {
  const timed = league();
  S.updateSettings(timed, "draftScheduledAt", new Date(Date.now() + 86400000).toISOString());
  assert.equal(draftStartDue(timed), false, "a time set: it starts by itself");
  const started = league();
  S.forceStartDraft(started);
  assert.equal(draftStartDue(started), false, "started");
  assert.deepEqual(runnerItems(started), []);
  assert.equal(draftStartDue(league({ people: ["ann"] })), false, "alone: Backstage's Invite people first");
  assert.equal(draftStartDue(league({ cast: 0 })), false, "no cast: Backstage's Add the cast first");
});

test("everyone else: who it waits for, by the Commissioner's seat name; when it starts; gone once it's started", () => {
  const s = league();
  assert.deepEqual(draftSoonOf(s, ["bo"]), { kind: "snake", at: null, waits: null, runBy: "Bo", startDue: true });
  assert.equal(draftSoonOf(s, [])?.runBy, null, "nobody known: the words say whoever runs the game");
  const at = new Date(Date.now() + 86400000).toISOString();
  S.updateSettings(s, "draftScheduledAt", at);
  assert.equal(draftSoonOf(s, ["bo"]).at, at);
  assert.equal(draftSoonOf(s, ["bo"]).startDue, false);
  S.forceStartDraft(s);
  assert.equal(draftSoonOf(s, ["bo"]), null);
});

test("the draft room: whose Start it is, and the name everyone else is told", () => {
  const s = league();
  const ref = (role) => ({ leagueId: "L", name: "Cup", gameType: "classic-draft", gameName: "Outlast", yourRole: role, runnerIds: ["ann"] });
  const view = (me, role) => draftView(ref(role), s, me, null, (p) => `u-${p}`, { queue: [], mine: null }, () => null);
  const runner = view("ann", "commissioner");
  assert.equal(runner.startDue, true);
  assert.equal(runner.runBy, "Ann");
  const player = view("bo", "member");
  assert.equal(player.startDue, false, "only a Commissioner starts it");
  assert.equal(player.runBy, "Ann");
});
