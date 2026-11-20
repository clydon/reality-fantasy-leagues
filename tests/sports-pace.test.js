// Own pace for a sports game (docs/PLAN-sports-ready.md step 2.6; BACKLOG 218): a team sport's seat at its own pace is never more
// than one game behind. The floor from the games' starts (sports/pace.ts paceFloor: by the game, or baseball's by the day), each
// sport's rule as data (its defaults' `pace`), and the engine moving the seats to it (StateLogic.GhostLogic.keepPace). The route
// half (the marks in the database, computer players, the reads) is scripts/dev-test/check-sports-own-pace.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const S = require("../src/lib/game/state-logic.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { paceFloor, paceBy } = jiti("../src/lib/sports/index.ts");

const { GhostLogic } = S;
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [] };
const at = (iso) => Date.parse(iso);

test("the floor by the game: the episode before the latest one started", () => {
  const starts = [
    { episode: 9, at: "2026-11-05T01:15:00Z" }, // Thursday night
    { episode: 9, at: "2026-11-09T18:00:00Z" },
    { episode: 10, at: "2026-11-13T01:15:00Z" },
    { episode: 10, at: "2026-11-16T18:00:00Z" },
  ];
  assert.equal(paceFloor(starts, at("2026-11-04T12:00:00Z"), "game"), null, "nothing started");
  assert.equal(paceFloor(starts, at("2026-11-05T01:15:00Z"), "game"), 8, "Week 9's first kickoff: Week 8 watched");
  assert.equal(paceFloor(starts, at("2026-11-12T12:00:00Z"), "game"), 8, "Week 9 still the latest begun");
  assert.equal(paceFloor(starts, at("2026-11-13T01:15:00Z"), "game"), 9, "Week 10's Thursday kickoff: Week 9 watched");
  // A game called off has no start (the server leaves it out): the week still begins at its first game played.
  assert.equal(paceFloor([{ episode: 3, at: null }, { episode: 4, at: "2026-10-01T00:00:00Z" }], at("2026-10-02T00:00:00Z"), "game"), 3);
});

test("the floor by the day: a doubleheader's first isn't watched at the second's first pitch", () => {
  const starts = [
    { episode: 40, at: "2026-06-01T23:05:00Z" }, // Monday 7:05 PM Eastern
    { episode: 41, at: "2026-06-02T17:05:00Z" }, // Tuesday 1:05 PM, game one
    { episode: 42, at: "2026-06-02T23:05:00Z" }, // Tuesday 7:05 PM, game two
    { episode: 43, at: "2026-06-04T02:10:00Z" }, // Wednesday 10:10 PM Eastern (Thursday in UTC)
    { episode: 44, at: "2026-06-04T17:10:00Z" }, // Thursday 1:10 PM Eastern
  ];
  assert.equal(paceFloor(starts, at("2026-06-02T17:05:00Z"), "day"), 40, "game one: Monday's watched");
  assert.equal(paceFloor(starts, at("2026-06-02T23:30:00Z"), "day"), 40, "game two under way: game one still not marked");
  assert.equal(paceFloor(starts, at("2026-06-02T23:30:00Z"), "game"), 41, "the game rule would have marked it");
  assert.equal(paceFloor(starts, at("2026-06-04T02:10:00Z"), "day"), 42, "Wednesday night: both of Tuesday's watched");
  assert.equal(paceFloor(starts, at("2026-06-04T17:10:00Z"), "day"), 43, "a late game is its Eastern day's (Wednesday's)");
});

test("each sport's rule is data: team sports keep up, individual sports stay plain own pace", () => {
  assert.equal(paceBy("football/nfl"), "game");
  assert.equal(paceBy("football/zt-nfl-slate"), "game", "a check's stand-in league reads as its sport's own");
  assert.equal(paceBy("basketball/nba"), "game");
  assert.equal(paceBy("hockey/nhl"), "game");
  assert.equal(paceBy("soccer/eng.1"), "game");
  assert.equal(paceBy("baseball/mlb"), "day");
  for (const l of ["golf/pga", "racing/f1", "mma/ufc", "tennis/atp"]) assert.equal(paceBy(l), null, l);
});

/** A Survival Pool from Episode 3 on 10 castaways, Episodes 1..`eps` played (one goes home in each), two people and a computer
 *  player, at its own pace from `from` (paceAll: every seat catching up from there). */
function paced({ eps = 6, from = 3, to = null } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000", active: true, disabled: false }));
  s.players.push({ id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true });
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { preset: "survival-pool", span: { from: 3, to } }, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) {
    S.ensureEpisodeNumber(s, k, false);
    S.addElimination(s, s.episodes.find((e) => e.number === k).id, s.castaways[k - 1].id, "Voted Out");
  }
  GhostLogic.paceAll(s, from);
  return s;
}
const marks = (s) => Object.fromEntries(s.players.map((p) => [p.id, p.lateJoin.seenThrough]));

test("keepPace moves every seat behind the floor to it, and only in a game at its own pace with a floor stamped", () => {
  const s = paced();
  assert.deepEqual(marks(s), { ann: 2, bo: 2, bot: 2 });
  assert.equal(GhostLogic.paceDue(s), false, "no floor stamped (a show's game, an individual sport's)");
  assert.deepEqual(GhostLogic.keepPace(s), []);
  s.paceFloor = 2;
  assert.equal(GhostLogic.paceDue(s), false, "nobody behind it");
  s.paceFloor = 5;
  s.players[1].lateJoin.seenThrough = 4; // bo watched further
  assert.equal(GhostLogic.paceDue(s), true);
  assert.deepEqual(GhostLogic.keepPace(s), [
    { playerId: "ann", from: 2, to: 5 },
    { playerId: "bo", from: 4, to: 5 },
    { playerId: "bot", from: 2, to: 5 },
  ]);
  assert.deepEqual(marks(s), { ann: 5, bo: 5, bot: 5 });
  assert.equal(GhostLogic.isCatchingUp(s, "ann"), true, "Episode 6 has results: still catching up, one behind");
  assert.equal(GhostLogic.paceDue(s), false, "a second run changes nothing");
  s.paceFloor = 6;
  GhostLogic.keepPace(s);
  assert.equal(GhostLogic.isCatchingUp(s, "ann"), false, "at the latest results: caught up");
});

test("keepPace never moves past the game's end, nor a seat that left or is still choosing where to start", () => {
  const s = paced({ to: 4 });
  s.paceFloor = 6;
  assert.equal(GhostLogic.paceTarget(s), 4, "the game's last episode");
  s.players[0].disabled = true;
  s.players[1].lateJoin.startEpisode = null;
  assert.deepEqual(GhostLogic.keepPace(s).map((m) => m.playerId), ["bot"]);
  assert.equal(s.players[0].lateJoin.seenThrough, 2);
  const live = paced();
  delete live.settings.ownPace;
  live.paceFloor = 5;
  assert.equal(GhostLogic.paceTarget(live), null, "a live game keeps no pace");
});

test("the floor is stamped, never saved", () => {
  assert.ok(S.StatsLogic.stampedKeys().includes("paceFloor"));
});
