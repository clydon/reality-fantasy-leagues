// L3 part 3 (docs/PLAN-start-a-game-gpt.md track L): each holding's points live on the phone (src/lib/sports/points.ts
// livePoints), from the poller's state as of the viewer's moment through the scoring sequence's line (statePoints, statLine),
// the saved final (src/lib/sports/final.ts: what the server keeps) replacing the poller's provisional points once the viewer's
// moment reaches the end, with what the final changed said. On the recorded fixtures (tests/fixtures/espn/): the 76ers opener
// replayed through LiveGame in virtual time (scripts/dev-test/espn-replay.js, as tests/sports-live.test.js does), a golf
// tournament through LiveEvent's golf feed, and a tennis event's draws scored by format. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const L = jiti("../src/lib/sports/index.ts");
const { asOf, bounds, known } = require("../scripts/dev-test/espn-replay.js");
const { virtual } = require("./harness/virtual-time");
const { statLine } = require("../src/lib/game/sequence/stats.js");

const { sportOf, defaultsFor, LiveGame, LiveEvent, golfFeed, drawFeed, livePoints, asMoments, atFinal, statePoints, storedGame, storedField, storedCard, finalState } = L;
const MIN = 60_000;
// As saved and read back: the database's JSON.
const json = (x) => JSON.parse(JSON.stringify(x));
const scoreOf = (sport) => defaultsFor(sport.id, sport.leagues?.[0]).specs.season.spec.score;
const pointsOnly = (by) => Object.fromEntries(Object.entries(by).map(([id, s]) => [id, s.points]));

test("the 76ers opener live through the poller in virtual time: each ask's points the recording's as known then, provisional; at the end the saved final's, with what it changed", async () => {
  const SIXERS = require("./fixtures/espn/nba-401909093.json");
  const nba = sportOf("basketball/nba");
  const score = scoreOf(nba);
  const box = nba.readBox(SIXERS);
  const maxey = Object.values(box.people).find((p) => p.name === "Tyrese Maxey").id;
  // The league's people: Maxey is a castaway; everyone else keeps ESPN's id.
  const who = (id) => (id === maxey ? "c-maxey" : null);
  const groupOf = (h) => (h === "c-maxey" ? "G" : null);
  const saved = json(storedGame(nba, SIXERS));

  const b = bounds(SIXERS, nba);
  const vt = virtual(b.first - 20 * MIN);
  const fetch = async () => ({ ok: true, status: 200, json: async () => asOf(SIXERS, vt.now(), { sport: nba }) });
  const truth = known(nba, SIXERS);
  const g = new LiveGame({ sport: nba, league: "basketball/nba", event: "401909093", every: 30_000, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  g.start();
  await vt.settle();
  let asks = 0;
  let scored = 0;
  for (let i = 0; i < 5000 && (await vt.advance()); i++) {
    asks++;
    const at = vt.now();
    const live = g.state(L.live());
    // The server has the final only once the game's over (its daily job, or a Players tab read).
    const p = livePoints(nba, score, { live, saved: g.final ? saved : null, who, groupOf });
    if (atFinal(live)) {
      assert.equal(p.from, g.final ? "final" : "live", "at the end, the saved final once it's in");
      continue;
    }
    assert.equal(p.from, "live");
    const want = statePoints(nba, score, truth(at, false), { groupOf: (id) => groupOf(who(id) ?? id) });
    assert.deepEqual(pointsOnly(p.points), Object.fromEntries(Object.entries(pointsOnly(want)).map(([id, n]) => [who(id) ?? id, n])), new Date(at).toISOString());
    if (p.points["c-maxey"]?.points) scored++;
    // Someone 20 minutes behind, synced, sees the game then, even with the final saved: their moment isn't the end.
    const late = livePoints(nba, score, { live: g.state(L.startAt(at - 20 * MIN, at)), saved, who, groupOf });
    assert.equal(late.from, "live");
  }
  assert.ok(g.done && g.final && asks > 100, `asked all game (${asks})`);
  assert.ok(scored > 50, "Maxey scored as his castaway all game");

  // The end with the final saved: its points, the same as the poller's end (ESPN's own box score), nothing changed.
  const end = g.state(L.ended());
  const p = livePoints(nba, score, { live: end, saved, who, groupOf });
  assert.equal(p.from, "final");
  assert.deepEqual(p.points, livePoints(nba, score, { live: end, who, groupOf }).points);
  assert.deepEqual(p.corrections, {});
  assert.equal(p.points["c-maxey"].points, statLine(score, nba.full(saved.lines[maxey]), { group: "G" }).points);
  // A scorer's change after the final (a rebound given to Maxey): the saved final's, and the change said.
  const fixed = json(saved);
  fixed.lines[maxey].REB = (fixed.lines[maxey].REB ?? 0) + 1;
  const after = livePoints(nba, score, { live: end, saved: fixed, who, groupOf });
  const d = Math.round((statLine(score, nba.full(fixed.lines[maxey]), { group: "G" }).points - statLine(score, nba.full(saved.lines[maxey]), { group: "G" }).points) * 100) / 100;
  assert.ok(d > 0, "a rebound scores");
  assert.deepEqual(after.corrections, { "c-maxey": d });
  // No poller (the viewer's past the end): the saved final alone; nothing saved and no poller: nothing.
  assert.deepEqual(livePoints(nba, score, { saved: fixed, who, groupOf }).points, after.points);
  assert.deepEqual(livePoints(nba, score, { who }), { points: {}, from: "none", corrections: {} });
  assert.equal(livePoints(nba, score, { live: null, saved: null }).from, "none", "the poller's not answered yet");
  // A final not wholly kept (its box score not final): never replaces the poller's.
  assert.equal(livePoints(nba, score, { live: end, saved: { ...saved, final: false } }).from, "live");
  // The rest of the sequence's moments: one per holding that scored.
  const moments = asMoments(p.points);
  assert.ok(moments.every((m) => m.points !== 0) && moments.some((m) => m.castawayId === "c-maxey"));
});

test("a golf tournament through its poller (one ask of the recorded final), and a mid-event moment: the poller's provisional, then the saved final's", async () => {
  const BERMUDA = require("./fixtures/espn/pga-401850917.json");
  const golf = sportOf("golf/pga");
  const score = scoreOf(golf);
  const fetch = async (url) => ({ ok: true, status: 200, json: async () => (url.includes("leaderboard") ? BERMUDA.leaderboard : BERMUDA.board) });
  const g = new LiveEvent({ feed: golfFeed(golf), league: "golf/pga", event: "401850917", fetch, now: () => Date.parse("2026-11-20T00:00:00Z") });
  await g.poll();
  assert.equal(g.status, "post");
  const saved = json(storedField(golf, g.answer));
  const end = g.stateAt();
  assert.ok(atFinal(end), "the poller's end is the final's correction");
  const p = livePoints(golf, score, { live: end, saved });
  assert.equal(p.from, "final");
  assert.deepEqual(p.corrections, {});
  assert.deepEqual(p.points, statePoints(golf, score, golf.stateAt(BERMUDA)), "the kept final scores as ESPN's own answer");
  // After round 2's holes are known (its first sight: the next round's tee times), places by the plays so far.
  const mid = g.plays.find((x) => x.period === 3)?.at;
  assert.ok(mid, "a third round");
  const then = g.stateAt(Date.parse(mid) - 1);
  const q = livePoints(golf, score, { live: then, saved });
  assert.equal(q.from, "live");
  assert.deepEqual(q.points, statePoints(golf, score, then));
  assert.notDeepEqual(pointsOnly(q.points), pointsOnly(p.points), "two rounds in isn't the end");
});

test("a tennis event's draws scored by format: the poller's card for its live points, the kept card's for the final's (each match at its best of three or five)", async () => {
  const USOPEN = require("./fixtures/espn/atp-189-2026.json");
  const tennis = sportOf("tennis/atp");
  const score = scoreOf(tennis);
  assert.ok(Object.keys(score.byFormat ?? {}).length, "tennis's default scores by format");
  const fetch = async () => ({ ok: true, status: 200, json: async () => USOPEN.board });
  const g = new LiveEvent({ feed: drawFeed(tennis), league: "tennis/atp", event: "189-2026", fetch, now: () => Date.parse("2026-12-01T00:00:00Z") });
  await g.poll();
  const saved = json(storedCard(tennis, g.answer));
  const end = g.stateAt();
  const p = livePoints(tennis, score, { live: end, saved, card: g.shape });
  assert.equal(p.from, "final");
  assert.deepEqual(p.points, statePoints(tennis, score, tennis.stateAt(USOPEN), { card: tennis.card(USOPEN) }));
  assert.deepEqual(p.corrections, {});
  assert.ok(Object.values(p.points).some((s) => s.parts.some((x) => x.bout)), "a match's points carry its bout");
  // Live, the poller's card says each match's format; without it the scorer says so rather than score every match at the usual.
  const mid = g.stateAt(Date.parse(g.plays[Math.floor(g.plays.length / 2)].at));
  assert.equal(livePoints(tennis, score, { live: mid, saved, card: g.shape }).from, "live");
  assert.throws(() => livePoints(tennis, score, { live: mid }), /needs the card/);
  // The kept card read back as the sport's state: every bout done with ESPN's result.
  const st = finalState(saved);
  assert.equal(Object.keys(st.bouts).length, saved.results.length);
});
