// Step 2.5 (docs/PLAN-sports-ready.md; BACKLOG 219): waivers for sports. Every team sport's season game has waivers that run (Yahoo's
// defaults, 2026-11-20: a rolling order, a window every week; the NFL no limit, the NBA's and NHL's 4 a week, MLB's 6), and the NBA's,
// NHL's and MLB's lineups lock at each player's game ("Daily - Today") with a waiver period every game day: claims clear that
// morning (12 hours before its first game), free agents until its last game starts, nobody whose game has started that day coming in
// or going out. The NFL's stay weekly, its free agency now running until the week's last game. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { defaultsFor } = jiti("../src/lib/sports/index.ts");

const W = S.WaiverLogic;
const H = 3600_000;
const at = (iso) => Date.parse(iso);

test("each team sport's season game has waivers that run: the NFL's weekly with no limit, the daily sports' every game day", () => {
  const w = (league, id = "season") => defaultsFor(league.split("/")[0], league).specs[id].spec.extras?.waivers;
  const nfl = w("football/nfl");
  assert.deepEqual(nfl.windows, { schedule: "everyEpisode", every: 3, swaps: 15 }, "no limit: the team's size");
  assert.equal(nfl.order, "rolling");
  assert.equal(nfl.daily, undefined);
  for (const [league, swaps] of [["basketball/nba", 4], ["hockey/nhl", 4], ["baseball/mlb", 6]]) {
    const d = defaultsFor(league.split("/")[0], league).specs;
    assert.equal(d.season.spec.closes, "game", `${league}: each player at his own game`);
    assert.deepEqual([w(league).windows.swaps, w(league).daily, w(league).hours], [swaps, true, 12], league);
    assert.equal(w(league, "bestBall").daily, undefined, `${league}: best ball has no lineup to lock, its waivers by the week`);
    assert.equal(w(league, "short"), undefined, `${league}: a few players for a game or two: none`);
    // The spec's check and the settings' round trip.
    assert.deepEqual(G.specProblems(d.season.spec).filter((p) => p.at.startsWith("extras.waivers")), [], league);
    assert.deepEqual(G.gameOf(G.settingsOf(d.season.spec)).extras.waivers, d.season.spec.extras.waivers, `${league}: round trip`);
  }
  const s = defaultsFor("basketball", "basketball/nba").specs.season.spec;
  const said = (spec) => (G.describeSpec(spec).details || []).find((x) => x.id === "waivers")?.value || "";
  assert.match(said(s), /claims clear each game day's morning, free agents until its last game, 4 swaps a/);
  assert.match(said(defaultsFor("football", "football/nfl").specs.season.spec), /a window after every .*, 15 swaps/);
  assert.deepEqual(G.specProblems({ ...s, closes: "daily" }).filter((p) => p.at === "extras.waivers.daily").length, 1, "every game day goes with a lineup locking at each game");
  assert.deepEqual(G.specProblems({ ...s, extras: { ...s.extras, waivers: { ...s.extras.waivers, windows: { schedule: "manual", every: 3, swaps: 0 } } } }).filter((p) => p.at === "extras.waivers.daily").length, 1, "and a window every episode");
});

// An NBA season game of two seats on a week slate, its games stamped as the server stamps them (gameStarts by event: its start and
// its day's end in the East; holdingGames by castaway). Week 1: Monday (two games, 7 PM and 9:30 PM Eastern) and Wednesday; week 2:
// Monday. Ann holds a1 (Monday's first game) and a2; Bo b1, b2; f1 (Monday's first game), f2 (Wednesday's) and f3 are free.
const MON = "2026-11-24T05:00:00.000Z", WED = "2026-11-26T05:00:00.000Z", MON2 = "2026-12-01T05:00:00.000Z";
function nba({ swaps = 4 } = {}) {
  const d = defaultsFor("basketball", "basketball/nba").specs.season.spec;
  const spec = { ...d, get: { ...d.get, each: 2, ir: undefined }, count: { start: 1 }, extras: { ...d.extras, waivers: { ...d.extras.waivers, windows: { schedule: "everyEpisode", every: 3, swaps: Math.min(swaps, 2) } } } };
  delete spec.get.ir;
  const owner = { a1: "ann", a2: "ann", b1: "bo", b2: "bo" };
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: ["ann", "bo"].map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["ann", "bo"],
    tribes: [{ id: "t1", name: "Rivertown" }],
    castaways: ["a1", "a2", "b1", "b2", "f1", "f2", "f3"].map((id) => ({ id, name: id.toUpperCase(), status: "active", tribeId: "t1", ownerIds: owner[id] ? [owner[id]] : [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [
      { id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: { ann: ["a1"] }, airsAt: "2026-11-24T00:00:00.000Z",
        gameStarts: { g1: { at: "2026-11-24T00:00:00.000Z", until: MON }, g2: { at: "2026-11-24T02:30:00.000Z", until: MON }, g3: { at: "2026-11-26T00:00:00.000Z", until: WED } },
        holdingGames: { a1: ["g1"], f1: ["g1"], b1: ["g2"], f2: ["g3"], a2: ["g3"] } },
      { id: "ep2", number: 2, events: [], scoringEvents: [], bets: [], picks: [], lineups: {}, airsAt: "2026-12-01T00:00:00.000Z",
        gameStarts: { g4: { at: "2026-12-01T00:00:00.000Z", until: MON2 } }, holdingGames: { a1: ["g4"], a2: ["g4"] } },
    ],
    draftPicksMade: 4,
  });
  return s;
}
// The waiver clock as the server runs it (waivers.js syncWaivers): each step due, until none.
function sync(s, now) {
  const steps = [];
  for (let i = 0; i < 8; i++) {
    const step = W.due(s, now);
    if (!step) break;
    steps.push(step);
    if (step === "open") W.open(s, now);
    else if (step === "process") W.process(s, {}, { now });
    else if (step === "close") W.close(s, now);
    else W.cancel(s);
  }
  return steps;
}

test("the NBA: a waiver period every game day, its claims clearing that morning and free agents until its last game", () => {
  const s = nba();
  assert.equal(W.daily(s), true);
  assert.deepEqual(W.gameDays(s).map((d) => [d.until, d.episode]), [[MON, 1], [WED, 1], [MON2, 2]]);
  // Monday, 1 AM Eastern: Monday's period opens, for Week 1 (its episode the one before), and waits for the morning.
  assert.deepEqual(sync(s, at("2026-11-23T06:00:00Z")), ["open"]);
  let p = W.current(s);
  assert.deepEqual([p.day, p.episode, p.window, p.swaps, p.phase], [MON, 0, true, 2, "open"]);
  assert.equal(p.processAt, "2026-11-23T12:00:00.000Z", "12 hours before 7 PM's first game: 7 AM Eastern");
  assert.equal(p.closesAt, "2026-11-24T02:30:00.000Z", "free agents until 9:30 PM's last game starts");
  assert.deepEqual(sync(s, at("2026-11-23T08:00:00Z")), []);
  assert.deepEqual(sync(s, at("2026-11-23T12:00:00Z")), ["process"]);
  // Free agency, before any game: Ann swaps a2 for f2.
  assert.equal(W.freeAgencyMove(s, "ann", "f2", "a2", at("2026-11-23T15:00:00Z")), null);
  // Once Monday's first game has started: f1 (in it) can't come in, a1 (in Ann's lineup, in it) can't go out.
  const live = at("2026-11-24T01:00:00Z");
  assert.match(W.freeAgencyMove(s, "ann", "f1", "f2", live) || "", /F1's game has started: add them once the day's over/);
  assert.match(W.freeAgencyMove(s, "ann", "f3", "a1", live) || "", /A1's game has started: move them once the day's over/);
  assert.equal(W.freeAgencyMove(s, "bo", "f3", "b2", live), null, "anyone else, as before");
  // Monday's last game starts: the period closes and Wednesday's opens, Week 1's swaps counted across both days.
  assert.deepEqual(sync(s, at("2026-11-24T02:30:00Z")), ["close", "open"]);
  p = W.current(s);
  assert.deepEqual([p.day, p.episode], [WED, 0]);
  assert.equal(W.swapsLeft(s, p, "ann"), 1, "one of Week 1's two used on Monday");
  assert.equal(W.swapsLeft(s, p, "bo"), 1);
  // Wednesday's last game: Week 2's Monday opens, its swaps new.
  assert.deepEqual(sync(s, at("2026-11-26T00:00:00Z")), ["process", "close", "open"]);
  p = W.current(s);
  assert.deepEqual([p.day, p.episode], [MON2, 1]);
  assert.equal(W.swapsLeft(s, p, "ann"), 2);
  // After the last game day: nothing more opens.
  assert.deepEqual(sync(s, at("2026-12-01T00:00:00Z")), ["process", "close"]);
  assert.deepEqual(sync(s, at("2026-12-02T00:00:00Z")), []);
});

test("the NBA's daily waivers wait for the draft, and a copy without its games' days runs them by the episode", () => {
  const s = nba();
  s.draftPicksMade = 3;
  assert.deepEqual(sync(s, at("2026-11-23T06:00:00Z")), [], "the draft isn't done");
  const bare = nba();
  for (const ep of bare.episodes) { delete ep.gameStarts; delete ep.holdingGames; }
  assert.equal(W.daily(bare), false);
});

test("the NFL: weekly waivers, free agents until the week's last game starts (each player locking at his own)", () => {
  const d = defaultsFor("football", "football/nfl").specs.season.spec;
  const spec = { ...d, get: { ...d.get, each: 2 }, count: { start: 1 }, extras: { ...d.extras, waivers: { ...d.extras.waivers, windows: { ...d.extras.waivers.windows, swaps: 2 } } } };
  delete spec.get.ir;
  delete spec.rank.playoffs;
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: ["ann", "bo"].map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["ann", "bo"],
    tribes: [{ id: "t1", name: "Rivertown" }],
    castaways: ["a1", "a2", "b1", "b2", "f1"].map((id) => ({ id, name: id.toUpperCase(), status: "active", tribeId: "t1", ownerIds: id.startsWith("a") ? ["ann"] : id.startsWith("b") ? ["bo"] : [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [
      { id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {}, noExit: true },
      { id: "ep2", number: 2, events: [], scoringEvents: [], bets: [], picks: [], lineups: { ann: ["a1"] }, airsAt: "2026-11-27T01:15:00.000Z",
        gameStarts: { t: { at: "2026-11-27T01:15:00.000Z", until: "2026-11-27T05:00:00.000Z" }, s: { at: "2026-11-29T18:00:00.000Z", until: "2026-11-30T05:00:00.000Z" }, m: { at: "2026-12-01T01:15:00.000Z", until: "2026-12-01T05:00:00.000Z" } },
        holdingGames: { a1: ["t"], f1: ["s"] } },
    ],
    draftPicksMade: 4,
  });
  assert.equal(W.daily(s), false);
  assert.deepEqual(sync(s, at("2026-11-25T12:00:00Z")), ["open"]);
  const p = W.current(s);
  assert.equal(p.processAt, "2026-11-26T01:15:00.000Z", "the day before Thursday night's kickoff");
  assert.equal(p.closesAt, "2026-12-01T01:15:00.000Z", "free agents until Monday night's kickoff, not Thursday's");
  assert.deepEqual(sync(s, at("2026-11-27T12:00:00Z")), ["process"]);
  assert.match(W.freeAgencyMove(s, "ann", "f1", "a1", at("2026-11-27T02:00:00Z")) || "", /A1.s game has started: move them once the day.s over/, "Thursday night: a starter in it stays till the day.s over");
  assert.equal(W.freeAgencyMove(s, "ann", "f1", "a2", at("2026-11-28T15:00:00Z")), null, "Saturday: Sunday's player comes in");
});
