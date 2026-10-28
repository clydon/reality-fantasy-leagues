// The draft room and the blind draft as one player reads them (src/lib/game/draft-view.ts, docs/PLAN-new-design.md
// step 7), and the engine's draft log (state-logic.js SnakeDraftStrategy.pick): who's on the clock and since when, the
// timer, the snake order, picks made for someone, Undo last pick, and a blind draft that shows nobody's picks before the
// reveal. Runs on a made-up league (no database). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { draftView, draftClock, draftKind, snakeOwner } = jiti("../src/lib/game/draft-view.ts");
const S = require("../src/lib/game/state-logic.js");

const PEOPLE = ["ann", "bo", "cy"];
const CAST = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];

function league({ shared = false, size = 2 } = {}) {
  return S.migrateLeagueState({
    settings: { leagueTypeId: "classic-draft", showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive", teamSize: size, startEpisode: 1 },
    players: PEOPLE.map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: [...PEOPLE],
    tribes: [{ id: "t1", name: "Toka", color: "#e0b23a" }],
    castaways: CAST.map((id) => ({ id, name: `${id.toUpperCase()} Person`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
}
const ref = (role = "member") => ({ leagueId: "L", name: "Cup", gameType: "classic-draft", gameName: "Outlast", yourRole: role });
const view = (s, me, role, own = { queue: [], mine: null }) => draftView(ref(role), s, me, null, (p) => `u-${p}`, own, (u) => (u === "u-admin" ? "admin" : null));

test("behind: the draft waits for a reveal only when someone left in what you haven't seen", () => {
  const s = league();
  S.forceStartDraft(s);
  // Episode 2's results are in (a sport's game fills in live); you're on Episode 1.
  s.episodes.push({ id: "ep2", number: 2, events: [], scoringEvents: [{ id: "e1", type: "individualImmunity", castawayId: "c3" }], bets: [], picks: [], lineups: {} });
  const behind = (st) => draftView(ref(), st, "ann", 1, (p) => `u-${p}`, { queue: [], mine: null }, () => null);
  let g = behind(s);
  assert.equal(g.revealFirst, null, "nobody left: draft away");
  assert.equal(g.cast.length, 8);
  assert.ok(g.cast.every((c) => !c.points), "and no points past where you are");
  // Someone goes home in Episode 2: the list would give it away.
  Object.assign(s.castaways.find((c) => c.id === "c8"), { status: "eliminated", exitEpisodeId: "ep2", exitMethod: "Voted Out", placementOrder: 8 });
  g = behind(s);
  assert.equal(g.revealFirst, 2);
});

test("the snake order runs down the list and back up", () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => snakeOwner(PEOPLE, i)), ["ann", "bo", "cy", "cy", "bo", "ann"]);
});

test("before the start: waiting, the order and the cast; nobody on the clock", () => {
  const s = league();
  const g = view(s, "bo", "member");
  assert.equal(draftKind(s), "snake");
  assert.equal(g.phase, "waiting");
  assert.equal(g.clock, null);
  assert.deepEqual(g.seats.map((x) => x.playerId), PEOPLE);
  assert.equal(g.turns.length, 6);
  assert.equal(g.cast.length, 8);
  assert.ok(g.cast.every((c) => c.points === null), "no points before the season");
});

test("a pick goes in the log; a pick made for someone says who made it", () => {
  const s = league();
  S.forceStartDraft(s);
  assert.ok(s.draftStartedAt && s.draftTurnAt, "the start stamps the clock");
  S.draftToCurrentTurn(s, "c1");
  S.draftToCurrentTurn(s, "c2", { by: "u-admin" });
  assert.deepEqual(s.draftLog.map((e) => [e.n, e.playerId, e.castawayId, e.by ?? null]), [
    [1, "ann", "c1", null],
    [2, "bo", "c2", "u-admin"],
  ]);
  const g = view(s, "cy", "member");
  assert.equal(g.phase, "live");
  assert.equal(g.clock.playerId, "cy");
  assert.equal(g.clock.n, 3);
  assert.deepEqual(g.picks.map((p) => [p.round, p.inRound, p.castawayId, p.by]), [
    [1, 1, "c1", null],
    [1, 2, "c2", "admin"],
  ]);
  assert.equal(g.madeFor, 1);
  assert.deepEqual(g.owners.c2, ["bo"]);
  assert.ok(g.canUndo, "the last pick is in the log");
});

test("taking back the last pick puts its player on the clock again", () => {
  const s = league();
  S.forceStartDraft(s);
  S.draftToCurrentTurn(s, "c1");
  S.draftToCurrentTurn(s, "c2");
  S.undraft(s, "c2");
  assert.equal(s.draftPicksMade, 1);
  assert.deepEqual(s.draftLog.map((e) => e.castawayId), ["c1"]);
  assert.equal(draftClock(s).playerId, "bo");
});

test("the pick timer counts from the turn's start; a nudge belongs to its turn", () => {
  const s = league();
  S.forceStartDraft(s);
  s.settings.draftTimer = 60;
  s.draftTurnAt = "2026-01-05T20:00:00.000Z";
  s.draftNudge = { n: 1, at: "2026-01-05T20:01:00.000Z", by: "u-admin" };
  let c = draftClock(s);
  assert.equal(c.endsAt, "2026-01-05T20:01:00.000Z");
  assert.ok(c.nudged);
  S.draftToCurrentTurn(s, "c1");
  c = draftClock(s);
  assert.ok(!c.nudged, "the next pick clears it");
  assert.ok(Date.parse(c.since) > Date.parse("2026-01-05T20:00:00.000Z"));
  S.updateSettings(s, "draftTimer", 45);
  assert.equal(s.settings.draftTimer, 0, "only off, 2 minutes or 60 seconds");
  S.updateSettings(s, "draftAway", "anything");
  assert.equal(s.settings.draftAway, "wait");
});

test("played out: done, each team in the order it picked", () => {
  const s = league();
  S.forceStartDraft(s);
  for (const id of ["c1", "c2", "c3", "c4", "c5", "c6"]) S.draftToCurrentTurn(s, id);
  const g = view(s, "ann", "commissioner");
  assert.equal(g.phase, "done");
  assert.deepEqual(g.teams.find((t) => t.playerId === "ann").castawayIds, ["c1", "c6"]);
  assert.deepEqual(g.teams.find((t) => t.playerId === "cy").castawayIds, ["c3", "c4"]);
  assert.ok(g.commissioner && g.runs);
});

test("a blind draft shows who's in and your own picks, never anyone else's, until the reveal", () => {
  const s = league({ shared: true });
  S.forceStartDraft(s);
  S.BlindDraftLogic.setLockedPlayerIds(s, ["ann"]);
  const bo = view(s, "bo", "member");
  assert.equal(bo.kind, "blind");
  assert.equal(bo.phase, "live");
  assert.deepEqual(bo.locked, ["ann"]);
  assert.equal(bo.mine, null);
  assert.deepEqual(bo.teams, []);
  const ann = view(s, "ann", "member", { queue: [], mine: ["c1", "c2"] });
  assert.deepEqual(ann.mine, ["c1", "c2"]);
  S.BlindDraftLogic.reveal(s, { ann: ["c1", "c2"], bo: ["c1", "c3"], cy: ["c2", "c4"] });
  const after = view(s, "bo", "member");
  assert.equal(after.phase, "done");
  assert.equal(after.teams.length, 3);
  assert.deepEqual(after.owners.c1.sort(), ["ann", "bo"]);
});
