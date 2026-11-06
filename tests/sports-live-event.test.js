// A field's and a draw's event live on the phone (src/lib/sports/live-event.ts; docs/PLAN-start-a-game-gpt.md track L, L2 part
// 2): each play at the moment a phone first saw it as it is, however often it asks; a suspended match on; the asking rhythm (every
// 30 s while a match is on, until the next start between, stopping once everything's over); golf's where, and an answer cut short.
// On recorded fixtures (tests/fixtures/espn/), put back to moments in play; virtual time (tests/harness/virtual-time.js).
// scripts/dev-test/check-live-event.js replays the real live recordings through the same poller.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, LiveEvent, drawFeed, golfFeed, firstSeen, FIELD_EVERY_MS, DRAW_EVERY_MS, PRE_WAIT_MS } = jiti("../src/lib/sports/index.ts");
const { virtual } = require("./harness/virtual-time");

const BASTAD = require("./fixtures/espn/wta-306-2026.json");
const BERMUDA = require("./fixtures/espn/pga-401850917.json");
const tennis = sportOf("tennis/atp");
const golf = sportOf("golf/pga");
const clone = (x) => JSON.parse(JSON.stringify(x));
const iso = (t) => new Date(t).toISOString().replace(".000Z", "Z");
const finalOf = (a) => a.board.groupings.find((g) => g.grouping.slug === "mens-singles").competitions.find((c) => c.round.displayName === "Final");

test("first seen: a play had again as it is keeps its earliest moment; one ESPN changes counts from its change; one an answer lacked keeps its moment; in time order", () => {
  const seen = new Map();
  const play = (id, at, deltas, score = {}) => ({ id, at, period: 1, half: null, clock: null, text: id, kind: "hole", team: null, unit: null, people: [], who: "x", score, deltas });
  const one = firstSeen(seen, [play("a", "2026-10-30T13:00:00Z", { x: { STR: 4 } }), play("b", "2026-10-30T13:00:00Z", { x: { STR: 3 } })]);
  assert.deepEqual(one.map((p) => p.at), ["2026-10-30T13:00:00Z", "2026-10-30T13:00:00Z"]);
  // A minute on: a the same (its running score moved by b's rescore: not its content), b rescored, c new.
  const two = firstSeen(seen, [play("a", "2026-10-30T13:01:00Z", { x: { STR: 4 } }, { x: 9 }), play("b", "2026-10-30T13:01:00Z", { x: { STR: 4 } }), play("c", "2026-10-30T13:01:00Z", { x: { STR: 5 } })]);
  assert.deepEqual(two.map((p) => [p.id, p.at]), [["a", "2026-10-30T13:00:00Z"], ["b", "2026-10-30T13:01:00Z"], ["c", "2026-10-30T13:01:00Z"]]);
  assert.deepEqual(two[0].score, { x: 9 }, "the answer's own running score");
  // An answer lacking c, then one with it again: c keeps its first sight.
  firstSeen(seen, [play("a", "2026-10-30T13:02:00Z", { x: { STR: 4 } })]);
  const four = firstSeen(seen, [play("c", "2026-10-30T13:03:00Z", { x: { STR: 5 } }), play("a", "2026-10-30T13:03:00Z", { x: { STR: 4 } })]);
  assert.deepEqual(four.map((p) => [p.id, p.at]), [["a", "2026-10-30T13:00:00Z"], ["c", "2026-10-30T13:01:00Z"]], "sorted by moment");
  // A play's own moment earlier than its first sight (a reader's known-by) stands.
  assert.equal(firstSeen(seen, [play("d", "2026-10-30T12:00:00Z", {})])[0].at, "2026-10-30T12:00:00Z");
});

test("a draw live: each play at a phone's first sight of it, a suspended match on, its result when first seen and not each poll's; every 30 s while on, stopping once all's over", async () => {
  const T1 = Date.parse("2026-07-19T13:40:00Z");
  const vt = virtual(T1);
  const fin = finalOf(BASTAD);
  const id = String(fin.id);
  // The 2026 Nordea Open's men's final, put back to the 2nd set (Rublev a set up, 3-2), then suspended (ESPN's feed stalled), then
  // as recorded.
  const on = clone(BASTAD);
  const rublev = Object.values(tennis.readBox(BASTAD).people).find((p) => p.name === "Andrey Rublev").id;
  const onFin = on.board.groupings.flatMap((g) => g.competitions).find((c) => String(c.id) === id);
  onFin.status = { period: 2, type: { state: "in", name: "STATUS_IN_PROGRESS" } };
  for (const x of onFin.competitors) {
    delete x.winner;
    const mine = String(x.id) === rublev;
    x.linescores = [{ value: mine ? 6 : 4, winner: mine }, { value: mine ? 3 : 2 }];
  }
  const held = clone(on);
  held.board.groupings.flatMap((g) => g.competitions).find((c) => String(c.id) === id).status = { period: 2, type: { id: "8", name: "STATUS_SUSPENDED", state: "post", completed: false } };
  let now = on;
  const fetch = async (url) => {
    fetch.asked.push({ at: vt.now(), url });
    return { ok: true, status: 200, json: async () => clone(now.board) };
  };
  fetch.asked = [];
  const g = new LiveEvent({ feed: drawFeed(tennis), league: "tennis/atp", event: "306-2026", fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  assert.deepEqual(g.urls, { board: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard/306-2026" });
  g.start();
  await vt.settle();
  assert.equal(g.status, "in");
  const setAt = () => g.plays.find((p) => p.bout === id && p.kind === "set").at;
  assert.equal(setAt(), iso(T1));
  // Suspended: still on, no result; the 1st set still at its first sight.
  now = held;
  await vt.advance();
  assert.equal(vt.now(), T1 + DRAW_EVERY_MS);
  assert.equal(g.status, "in");
  assert.equal(g.stateAt(null).bouts[id].result, null);
  assert.equal(setAt(), iso(T1));
  // Over: its result at this ask; and the ask after it, the same answer, leaves it there.
  now = BASTAD;
  await vt.advance();
  const T3 = vt.now();
  const resultAt = () => g.plays.find((p) => p.bout === id && p.kind === "result").at;
  assert.equal(resultAt(), iso(T3));
  assert.equal(setAt(), iso(T1), "the 1st set as first seen, though the finished answer has it too");
  assert.equal(g.stateAt(T3 - 1).bouts[id].result, null, "a later watch before it sees no result");
  assert.equal(g.stateAt(T3).bouts[id].result.winner, rublev);
  // Every match over, the event's last day still to come (its endDate): between, asking every 10 minutes, until it's gone.
  assert.equal(g.status, "pre");
  assert.ok(Math.abs(g.nextDelay() - PRE_WAIT_MS) <= DRAW_EVERY_MS * 0.2);
  await vt.advance();
  assert.equal(resultAt(), iso(T3), "not moved on by the next poll");
  while (!g.done && (await vt.advance()));
  assert.ok(g.done && vt.now() > Date.parse(BASTAD.board.endDate));
  assert.equal(vt.timers.length, 0, "no more asks");
  assert.ok(fetch.asked.length < 100);
});

test("a draw between matches waits for the next listed start; one listed and gone but not on yet is asked for on the rhythm", () => {
  const feed = drawFeed(tennis);
  const a = clone(BASTAD);
  const ms = a.board.groupings.flatMap((g) => g.competitions);
  const [m1, m2] = ms.slice(-2);
  for (const m of [m1, m2]) {
    m.status = { period: 0, type: { state: "pre", name: "STATUS_SCHEDULED" } };
    for (const x of m.competitors) delete x.linescores;
  }
  m1.date = "2026-07-19T12:00Z";
  m2.date = "2026-07-19T14:00Z";
  assert.deepEqual(feed.where(a, Date.parse("2026-07-19T10:00Z")), { status: "pre", next: Date.parse("2026-07-19T12:00Z"), detail: null });
  assert.equal(feed.where(a, Date.parse("2026-07-19T12:10Z")).status, "in", "its start gone, not on yet");
  assert.equal(feed.where(a, Date.parse("2026-07-19T12:10Z")).next, Date.parse("2026-07-19T14:00Z"));
  m2.timeValid = false;
  m1.date = "2026-07-18T12:00Z";
  assert.deepEqual(feed.where(a, Date.parse("2026-07-19T12:10Z")), { status: "pre", next: null, detail: null }, "a placeholder start isn't one; one gone a day isn't due");
  // A suspended match keeps the draw on for six hours from its start, then it waits as between (rain overnight, a stall never
  // cleared); past the event's last day it doesn't hold it open.
  m1.status = { period: 2, type: { id: "8", name: "STATUS_SUSPENDED", state: "post", completed: false } };
  m1.date = "2026-07-19T12:00Z";
  assert.equal(feed.where(a, Date.parse("2026-07-19T13:00Z")).status, "in");
  assert.equal(feed.where(a, Date.parse("2026-07-19T19:00Z")).status, "pre");
  m2.status = { period: 0, type: { state: "post", completed: true, name: "STATUS_FINAL" } };
  assert.equal(feed.where(a, Date.parse(a.board.endDate) + 1).status, "post");
});

test("golf live: on while a round's in play, between rounds until the next tee time, over at the final; the plays at their first sight; an answer cut short changes nothing, twice it's taken", () => {
  const feed = golfFeed(golf);
  assert.deepEqual(feed.paths("golf/pga", "401850917"), { board: "/apis/site/v2/sports/golf/pga/scoreboard/401850917", leaderboard: "/apis/site/v2/sports/golf/leaderboard?event=401850917" });
  assert.equal(FIELD_EVERY_MS, 60_000);
  const a = clone(BERMUDA);
  const lb = a.leaderboard.events[0];
  assert.equal(feed.where(a, 0).status, "post");
  lb.status.type = { state: "in", completed: false, name: "STATUS_IN_PROGRESS" };
  lb.competitions[0].status.type = { state: "in", name: "STATUS_IN_PROGRESS", detail: "Round 4 - In Progress" };
  assert.deepEqual(feed.where(a, 0), { status: "in", next: null, detail: "Round 4 - In Progress" });
  lb.competitions[0].status.type = { state: "post", name: "STATUS_PLAY_COMPLETE", detail: "Round 3 - Play Complete" };
  const first = Math.min(...lb.competitions[0].competitors.map((c) => Date.parse(c.status?.teeTime)).filter(Number.isFinite));
  assert.deepEqual(feed.where(a, first - 3600_000), { status: "pre", next: first, detail: "Round 3 - Play Complete" });
  assert.equal(feed.where(a, first + 10 * 60_000).status, "in", "the first tee time gone, ESPN not in play yet: asked on the rhythm");
  const last = Math.max(...lb.competitions[0].competitors.map((c) => Date.parse(c.status?.teeTime)).filter(Number.isFinite));
  assert.equal(feed.where(a, last + 2 * 3600_000).status, "pre", "every tee time gone an hour and more: between");

  // The final, asked twice: every play at the first answer's moment.
  const T1 = Date.parse("2026-10-26T01:00:00Z");
  let t = T1;
  const g = new LiveEvent({ feed, league: "golf/pga", event: "401850917", now: () => t });
  assert.ok(g.take(feed.answer({ board: BERMUDA.board, leaderboard: BERMUDA.leaderboard }, iso(t))));
  const n = g.plays.length;
  assert.ok(n > 1000 && g.done);
  t += FIELD_EVERY_MS;
  assert.equal(g.take(feed.answer({ board: BERMUDA.board, leaderboard: BERMUDA.leaderboard }, iso(t))), false, "the same answer changes nothing");
  assert.ok(g.plays.every((p) => Date.parse(p.at) <= T1));
  const end = g.stateAt(null);
  assert.deepEqual(end.lines, golf.stateAt(BERMUDA).lines, "the end is the event's");
  // Cut short (the leaderboard and board with one player): nothing, then taken the second time.
  const cut = clone(BERMUDA);
  cut.leaderboard.events[0].competitions[0].competitors.splice(1);
  const bc = cut.board.events ? cut.board.events[0] : cut.board;
  bc.competitions[0].competitors.splice(1);
  t += FIELD_EVERY_MS;
  assert.equal(g.take(feed.answer({ board: cut.board, leaderboard: cut.leaderboard }, iso(t))), false);
  assert.equal(g.plays.length, n);
  t += FIELD_EVERY_MS;
  assert.equal(g.take(feed.answer({ board: cut.board, leaderboard: cut.leaderboard }, iso(t))), true);
  assert.ok(g.plays.length < n);
  assert.equal(feed.answer({ board: {}, leaderboard: { events: [] } }, iso(t)), null, "no event: a failed ask");
  // An answer with no plays, once some are had, changes nothing, however often it comes.
  const none = clone(BERMUDA);
  none.leaderboard.events[0].competitions[0].competitors = [];
  (none.board.events ? none.board.events[0] : none.board).competitions[0].competitors = [];
  const k = g.plays.length;
  for (let i = 0; i < 3; i++) assert.equal(g.take(feed.answer({ board: none.board, leaderboard: none.leaderboard }, iso((t += FIELD_EVERY_MS)))), false);
  assert.equal(g.plays.length, k);
});
