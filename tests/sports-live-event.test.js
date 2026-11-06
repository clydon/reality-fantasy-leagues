// A field's, a draw's and a card's event live on the phone (src/lib/sports/live-event.ts; docs/PLAN-start-a-game-gpt.md track L,
// L2 part 2): each play at the moment a phone first saw it as it is, however often it asks; a suspended match on; the asking
// rhythm (every 30 s while a match is on, until the next start between, stopping once everything's over); golf's where, and an
// answer cut short; a race weekend's and a fight card's later rounds (the core API's calls: a session's grid and statistics, a
// bout's plays and statistics), each asked once or until it's settled.
// On recorded fixtures (tests/fixtures/espn/), put back to moments in play; virtual time (tests/harness/virtual-time.js).
// scripts/dev-test/check-live-event.js replays the real live recordings through the same poller.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, LiveEvent, drawFeed, golfFeed, raceFeed, cardFeed, firstSeen, FIELD_EVERY_MS, DRAW_EVERY_MS, RACE_EVERY_MS, CARD_EVERY_MS, PRE_WAIT_MS } = jiti("../src/lib/sports/index.ts");
const { virtual } = require("./harness/virtual-time");

const BASTAD = require("./fixtures/espn/wta-306-2026.json");
const BERMUDA = require("./fixtures/espn/pga-401850917.json");
const MIAMI = require("./fixtures/espn/f1-600057432.json");
const DAYTONA = require("./fixtures/espn/nascar-premier-202502160001.json");
const UFC324 = require("./fixtures/espn/ufc-600057024.json");
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

/** A stand-in for ESPN's site, web and core APIs: `answer()` the answer of record-espn.js's as of now (its board, FightCenter and
 *  core), `override(kind, url)` a call's own body or status first; every call logged by its kind. ESPN's 404 where the answer has
 *  none. */
function espn(answer, override = () => undefined) {
  const calls = [];
  const fetch = async (url) => {
    const a = answer();
    const reply = (kind, body) => {
      calls.push({ kind, url });
      const mine = override(kind, url);
      if (typeof mine === "number") return { ok: false, status: mine, json: async () => ({}) };
      const b = mine === undefined ? body : mine;
      return b == null ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => clone(b) };
    };
    if (url.includes("/fightcenter/")) return reply("fightcenter", a.fightcenter);
    if (url.includes("/scoreboard/")) return reply("board", a.board);
    let m = /\/racing\/leagues\/[^/]+\/events\/[^/]+\/competitions\/([^/]+)\/competitors(?:\/([^/?]+)\/(statistics|status))?/.exec(url);
    if (m) {
      const cs = a.core?.[m[1]]?.competitors ?? [];
      if (!m[2]) return reply("list", { items: cs.map((c) => ({ ...c, statistics: { $ref: "link" }, status: { $ref: "link" } })) });
      return reply(m[3], cs.find((c) => String(c.id) === m[2])?.[m[3]]);
    }
    m = /\/mma\/leagues\/[^/]+\/events\/[^/?]+(?:\/competitions\/([^/]+)\/(plays|competitors\/([^/]+)\/statistics))?/.exec(url);
    if (m && !m[1]) return reply("event", a.event);
    if (m && m[2] === "plays") return reply("plays", { items: a.core?.[m[1]]?.plays ?? [] });
    if (m) return reply("statistics", a.core?.[m[1]]?.competitors?.find((c) => String(c.id) === m[3])?.statistics);
    throw new Error(`nothing stands in for ${url}`);
  };
  return { fetch, calls, count: (kind, since = 0) => calls.slice(since).filter((c) => c.kind === kind).length };
}
const boardOf = (a) => (a.board.events ? a.board.events[0] : a.board);
/** UFC 324 with its main event on, three minutes from its end: no result anywhere; its plays and when it ended and was announced. */
function ufcMainOn() {
  const main = "401836543";
  const plays = UFC324.core[main].plays;
  const at = (text) => Date.parse(plays.find((p) => p.type.text === text).wallclock);
  const on = clone(UFC324);
  on.board.status.type = { state: "in", completed: false, name: "STATUS_IN_PROGRESS" };
  const inPlay = { clock: 120, displayClock: "2:00", period: 5, type: { state: "in", completed: false, name: "STATUS_IN_PROGRESS" } };
  const bm = on.board.competitions.find((c) => String(c.id) === main);
  bm.status = clone(inPlay);
  for (const x of bm.competitors) x.winner = false;
  const fm = Object.values(on.fightcenter.cards).flatMap((x) => x.competitions).find((c) => String(c.id) === main);
  fm.status = clone(inPlay);
  for (const x of fm.competitors) x.winner = false;
  return { on, main, plays, bm, over: at("Fight Over"), announced: at("Results") };
}
const linesOf = (sport, a, event) => sport.reduce(sport.timeline(a), null, event).lines;

test("a race weekend live (Miami 2026): the board every 30 s while the race is on, its grid once from its start, a session's statistics and statuses once it's over; done once the race's are had, every line the weekend's", async () => {
  const f1 = sportOf("racing/f1");
  const race = boardOf(MIAMI).competitions.find((c) => c.type.abbreviation === "Race");
  const sid = String(race.id);
  const start = Date.parse(race.date);
  // The race on: its order the running order, nobody the winner, ESPN's board in.
  const on = clone(MIAMI);
  const b = boardOf(on);
  b.status.type = { state: "in", completed: false, name: "STATUS_IN_PROGRESS" };
  const r = b.competitions.find((c) => String(c.id) === sid);
  r.status = { period: 30, type: { state: "in", completed: false, name: "STATUS_IN_PROGRESS", detail: "Lap 30" } };
  for (const c of r.competitors) c.winner = false;
  let now = on;
  const vt = virtual(start + 40 * 60_000);
  const api = espn(() => now);
  const g = new LiveEvent({ feed: raceFeed(f1), league: "racing/f1", event: "600057432", fetch: api.fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  g.start();
  await vt.settle();
  assert.equal(g.status, "in");
  assert.equal(g.detail, "Lap 30");
  // The first ask: the board; the sprint's and the race's lists (their grids); the sprint's and qualifying's statistics and
  // statuses, over (22 drivers each); not sprint qualifying's or practice's (their board's order alone), nor the race's yet.
  assert.equal(api.count("board"), 1);
  assert.equal(api.count("list"), 2);
  assert.equal(api.count("statistics"), 44);
  assert.equal(api.count("status"), 44);
  assert.ok(!api.calls.some((c) => c.url.includes(`/competitions/${sid}/competitors/`)), "nothing of the race's but its list while it's on");
  const grid = g.plays.filter((p) => p.session === "Race" && p.kind === "grid");
  assert.equal(grid.length, 22);
  assert.ok(grid.every((p) => p.at === iso(start)), "the grid at the race's start");
  const leader = r.competitors.find((c) => c.order === 1).id;
  assert.equal(g.stateAt(null).lines[leader].FIN, 1, "the running order");
  assert.equal(g.stateAt(null).lines[leader].LAPS, undefined, "no laps till it's over");
  // 30 s on: the board alone.
  let since = api.calls.length;
  await vt.advance();
  assert.equal(vt.now(), start + 40 * 60_000 + RACE_EVERY_MS);
  assert.deepEqual(api.calls.slice(since).map((c) => c.kind), ["board"]);
  // Over: the race's statistics and statuses in the same ask, and then nothing more to ask.
  now = MIAMI;
  since = api.calls.length;
  await vt.advance();
  const T = vt.now();
  assert.equal(api.count("statistics", since), 22);
  assert.equal(api.count("status", since), 22);
  assert.equal(api.count("list", since), 0, "the race's list once");
  assert.ok(g.done);
  assert.equal(vt.timers.length, 0, "no more asks");
  assert.deepEqual(g.stateAt(null).lines, linesOf(f1, MIAMI, f1.fieldEvent(MIAMI)), "every line the weekend's");
  const res = g.plays.find((p) => p.session === "Race" && p.who === leader && p.kind === "race-result");
  assert.equal(res.at, iso(T), "the race's result at this ask, its first sight as it is");
  assert.ok(g.plays.filter((p) => p.session === "Qual").every((p) => Date.parse(p.at) <= start + 40 * 60_000), "qualifying's at its first sight");
});

test("NASCAR's statistics waited for (Daytona 2025): the winner's asked every 10 minutes while ESPN hasn't filled them in, everyone's once it has; places and the grid till then", async () => {
  const cup = sportOf("racing/nascar-premier");
  const ev = boardOf(DAYTONA);
  const sid = String(ev.competitions[0].id);
  const start = Date.parse(ev.competitions[0].date);
  const winner = String(ev.competitions[0].competitors.find((c) => c.order === 1).id);
  // Before ESPN fills them in (Martinsville 2026, live): every car the race's laps, nobody a lap led, no points.
  const unfilled = clone(DAYTONA);
  for (const c of unfilled.core[sid].competitors) {
    if (!c.statistics) continue;
    c.statistics = { splits: { categories: [{ stats: [{ name: "lapsCompleted", value: 201 }, { name: "lapsLead", value: 0 }, { name: "championshipPts", value: 0 }, { name: "place", value: c.order ?? 0 }, { name: "pole", value: c.startOrder ?? 0 }] }] } };
  }
  const T0 = start + 4 * 3600_000;
  const filledAt = T0 + 25 * 60_000;
  const vt = virtual(T0);
  const api = espn(() => (vt.now() >= filledAt ? DAYTONA : unfilled));
  const g = new LiveEvent({ feed: raceFeed(cup), league: "racing/nascar-premier", event: String(ev.id), fetch: api.fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  g.start();
  await vt.settle();
  // Its list for the grid, the winner's statistics alone: not filled in, so the race isn't over yet.
  assert.deepEqual(api.calls.map((c) => c.kind), ["board", "list", "statistics"]);
  assert.ok(api.calls[2].url.endsWith(`/competitors/${winner}/statistics`));
  assert.equal(g.status, "pre");
  assert.ok(Math.abs(g.nextDelay() - PRE_WAIT_MS) <= RACE_EVERY_MS * 0.2);
  const line = g.stateAt(null).lines[winner];
  assert.equal(line.FIN, 1);
  assert.ok(line.GRID > 0);
  assert.equal(line.LAPS, undefined, "laps not read till they're the cars'");
  // Ten minutes on, the winner's again; then filled in: everyone's, then done.
  let since = api.calls.length;
  await vt.advance();
  assert.deepEqual(api.calls.slice(since).map((c) => c.kind), ["board", "statistics"]);
  while (!g.done && (await vt.advance()));
  assert.ok(vt.now() >= filledAt && vt.now() < filledAt + PRE_WAIT_MS * 1.2);
  assert.equal(api.count("statistics"), 4 + ev.competitions[0].competitors.length - 1, "the winner's four times, then the rest");
  assert.equal(vt.timers.length, 0);
  assert.deepEqual(g.stateAt(null).lines, linesOf(cup, DAYTONA, cup.fieldEvent(DAYTONA)), "every line the race's");
  // A car listed with no statistics (didn't qualify: ESPN's 404) isn't asked again.
  const none = DAYTONA.core[sid].competitors.filter((c) => !c.statistics).map((c) => String(c.id));
  for (const id of none) assert.equal(api.calls.filter((c) => c.url.endsWith(`/competitors/${id}/statistics`)).length, 1);
});

test("a card live (UFC 324): its board and FightCenter every 30 s, the bout on's plays each ask, ESPN's moments kept; a bout's statistics once settled, used only once they're the FightCenter's; done once the main event's are", async () => {
  const mma = sportOf("mma/ufc");
  // The main event on, three minutes from its end: no result anywhere, its plays so far (ESPN's lag, 35 s).
  const { on, main, plays, bm, over, announced } = ufcMainOn();
  const T0 = over - 3 * 60_000;
  const vt = virtual(T0);
  const lag = 35_000;
  const answer = () => {
    const a = vt.now() >= announced + 55_000 ? clone(UFC324) : clone(on);
    a.core[main].plays = plays.filter((p) => !p.wallclock || Date.parse(p.wallclock) <= vt.now() - lag);
    return a;
  };
  // The main event's statistics run ahead of the official count till 11 minutes after its end; one bout's plays fail once
  // (asked again); the card's rounds 404 (none: not asked again).
  const flaky = String(UFC324.board.competitions[0].id);
  let failed = false;
  const api = espn(answer, (kind, url) => {
    if (kind === "event") return null;
    if (kind === "plays" && url.includes(`/competitions/${flaky}/`) && !failed) return (failed = true), 500;
    if (kind === "statistics" && url.includes(`/competitions/${main}/`) && vt.now() < over + 11 * 60_000) {
      const fighter = url.match(/competitors\/([^/]+)\//)[1];
      const s = clone(UFC324.core[main].competitors.find((c) => String(c.id) === fighter).statistics);
      for (const c of s.splits.categories) for (const x of c.stats) if (x.name === "sigStrikesLanded") x.value += 5;
      return s;
    }
  });
  const g = new LiveEvent({ feed: cardFeed(mma), league: "mma/ufc", event: "600057024", fetch: api.fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  assert.deepEqual(Object.keys(g.urls), ["board", "fightcenter"]);
  assert.ok(g.urls.fightcenter.startsWith("https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/fightcenter/600057024"));
  g.start();
  await vt.settle();
  assert.equal(g.status, "in");
  // The first ask: the board, the FightCenter, the card's rounds, every bout's plays (the one on's, and those over once), and the
  // statistics of every bout over and settled but the one whose plays failed (its end not known yet).
  const bouts = UFC324.board.competitions.length;
  assert.equal(api.count("event"), 1);
  assert.equal(api.count("plays"), bouts);
  assert.equal(api.count("statistics"), 2 * (bouts - 2));
  assert.equal(g.stateAt(null).bouts[main].result, null);
  // 30 s on: the bout on's plays, the failed one's again and its statistics; not the rounds (ESPN has none).
  let since = api.calls.length;
  await vt.advance();
  assert.equal(vt.now(), T0 + CARD_EVERY_MS);
  assert.deepEqual(api.calls.slice(since).map((c) => c.kind).sort(), ["board", "fightcenter", "plays", "plays", "statistics", "statistics"]);
  // On to its result: ESPN's moments for its end and its result, not each poll's.
  while (g.status === "in") await vt.advance();
  assert.ok(vt.now() >= announced + 55_000 && vt.now() < announced + 55_000 + CARD_EVERY_MS * 1.2, "on the rhythm till the card's final");
  const endAt = () => g.plays.find((p) => p.id === `${main}:end`)?.at;
  const resultAt = () => g.plays.find((p) => p.id === `${main}:result`)?.at;
  assert.equal(endAt(), new Date(over).toISOString().replace(".000Z", "Z"));
  assert.equal(resultAt(), plays.find((p) => p.type.text === "Results").wallclock);
  // The card final, but the main event's statistics not settled: held, its numbers the FightCenter's, till 10 minutes from its end.
  assert.equal(g.status, "pre");
  assert.equal(g.next, over + 10 * 60_000);
  const fighter = String(bm.competitors[0].id);
  const ssl = (n) => n.lines[fighter].SSL;
  const official = mma.reduce(mma.timeline(UFC324), null, mma.card(UFC324)).lines[fighter].SSL;
  assert.equal(ssl(g.stateAt(null)), official, "the FightCenter's totals");
  since = api.calls.length;
  await vt.advance();
  assert.ok(vt.now() >= over + 10 * 60_000 && vt.now() < over + 10 * 60_000 + CARD_EVERY_MS, "the next ask once it's settled");
  assert.equal(api.count("statistics", since), 2, "asked once settled");
  assert.equal(g.status, "pre", "running ahead of the FightCenter's: not used, asked again");
  assert.equal(ssl(g.stateAt(null)), official);
  while (!g.done && (await vt.advance()));
  assert.ok(vt.now() >= over + 11 * 60_000 && vt.now() < over + 12 * 60_000);
  assert.equal(vt.timers.length, 0);
  assert.equal(api.count("event"), 1);
  assert.equal(endAt(), new Date(over).toISOString().replace(".000Z", "Z"), "not moved on");
  assert.equal(resultAt(), plays.find((p) => p.type.text === "Results").wallclock, "not re-stamped");
  assert.deepEqual(g.stateAt(null).lines, mma.reduce(mma.timeline(UFC324), null, mma.card(UFC324)).lines, "every line the card's");
  assert.equal(g.stateAt(over - 1).bouts[main].result, null, "a later watch before its end sees no result");
});

test("a weekend between sessions waits for the next start, asked for on the rhythm once it's gone and ESPN hasn't it on; a card before its start the same; one called off is over", () => {
  const f1 = raceFeed(sportOf("racing/f1"));
  const a = clone(MIAMI);
  const b = boardOf(a);
  const race = b.competitions.find((c) => c.type.abbreviation === "Race");
  const qual = b.competitions.find((c) => c.type.abbreviation === "Qual");
  race.status = { period: 0, type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } };
  b.status.type = { state: "post", completed: true, name: "STATUS_FINAL" };
  const start = Date.parse(race.date);
  // Qualifying's statistics had: between, until the race.
  const had = { board: a.board, ...Object.fromEntries(qual.competitors.flatMap((c) => [[`stats:${qual.id}:${c.id}`, {}], [`status:${qual.id}:${c.id}`, {}]])) };
  const sr = b.competitions.find((c) => c.type.abbreviation === "SR");
  Object.assign(had, Object.fromEntries(sr.competitors.flatMap((c) => [[`stats:${sr.id}:${c.id}`, {}], [`status:${sr.id}:${c.id}`, {}]])));
  const answer = f1.answer(had, iso(start - 3600_000));
  assert.deepEqual(f1.where(answer, start - 3600_000), { status: "pre", next: start, detail: null });
  assert.equal(f1.where(answer, start + 10 * 60_000).status, "in", "its start gone, ESPN not on yet");
  assert.equal(f1.where(answer, start + 2 * 3600_000).status, "pre");
  // A session over with its statistics still to have holds the weekend open.
  const asks = f1.more({ had: { board: a.board }, got: { board: a.board }, now: start - 3600_000, league: "racing/f1", event: "600057432" });
  assert.equal(asks[`stats:${qual.id}:${qual.competitors[0].id}`], `core:/v2/sports/racing/leagues/f1/events/600057432/competitions/${qual.id}/competitors/${qual.competitors[0].id}/statistics`);
  assert.equal(f1.where(f1.answer({ board: a.board }, iso(start - 3600_000)), start - 3600_000).next, start, "still between");
  race.status = { period: 57, type: { state: "post", completed: true, name: "STATUS_FINAL" } };
  assert.equal(f1.where(f1.answer({ board: a.board }, iso(start)), start + 3 * 3600_000).status, "pre", "the race's statistics to have");

  const card = cardFeed(sportOf("mma/ufc"));
  const c = clone(UFC324);
  c.board.status.type = { state: "pre", completed: false, name: "STATUS_SCHEDULED" };
  for (const x of c.board.competitions) x.status = { period: 0, type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } };
  c.fightcenter = null;
  const first = Math.min(...c.board.competitions.map((x) => Date.parse(x.date)));
  const ca = card.answer({ board: c.board, fightcenter: null }, iso(first - 3600_000));
  assert.equal(card.where(ca, first - 3600_000).status, "pre");
  assert.equal(card.where(ca, first - 3600_000).next, first);
  assert.equal(card.where(ca, first + 5 * 60_000).status, "in", "its start gone, no bout on yet");
  assert.deepEqual(card.more({ had: { board: c.board }, got: { board: c.board }, now: first - 3600_000, league: "mma/ufc", event: "600057024" }), {}, "nothing of the core's before a bout's on");
  c.board.status.type = { state: "post", completed: false, name: "STATUS_CANCELED" };
  assert.equal(card.where(card.answer({ board: c.board }, iso(first)), first).status, "post", "called off");
});

test("a card's FightCenter failing doesn't fail an ask (the board says who won); ESPN's 404 never wipes what's had; a bout over is asked on till its plays announce its result", async () => {
  const mma = sportOf("mma/ufc");
  const { on, main, plays, over, announced } = ufcMainOn();
  const vt = virtual(over - 60_000);
  let fc = 500;
  let plays404 = false;
  // Its result's announcement filed late: 5 minutes after its end, the card final from 2 minutes after it.
  const late = over + 5 * 60_000;
  const answer = () => {
    const a = vt.now() >= over + 2 * 60_000 ? clone(UFC324) : clone(on);
    a.core[main].plays = plays.filter((p) => Date.parse(p.wallclock) <= vt.now() - 35_000 && (vt.now() >= late || !["Results", "Unofficial Winner Decision"].includes(p.type.text)));
    return a;
  };
  const api = espn(answer, (kind, url) => (kind === "fightcenter" ? fc : kind === "plays" && plays404 && url.includes(`/competitions/${main}/`) ? null : undefined));
  const g = new LiveEvent({ feed: cardFeed(mma), league: "mma/ufc", event: "600057024", fetch: api.fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  g.start();
  await vt.settle();
  assert.equal(g.failures, 0, "the FightCenter failing isn't a failed ask");
  assert.equal(g.status, "in");
  assert.ok(g.stateAt(null).bouts["401836545"].result.winner, "a bout over's result from the board");
  assert.equal(api.count("statistics"), 0, "no FightCenter totals had: no statistics to settle");
  // ESPN's 404 for the bout on's plays once: the plays had are kept.
  fc = undefined;
  plays404 = true;
  const n = g.plays.filter((p) => p.bout === main).length;
  await vt.advance();
  assert.ok(g.had[`plays:${main}`].items.length > 0);
  assert.equal(g.plays.filter((p) => p.bout === main).length, n);
  plays404 = false;
  // The card final, its plays not announcing its result yet: asked on every 30 s, then its statistics once settled, then done.
  while (g.status === "in") await vt.advance();
  assert.equal(g.status, "pre");
  assert.ok(g.nextDelay() <= CARD_EVERY_MS * 1.1);
  const asksBefore = api.count("plays");
  while (vt.now() < late) await vt.advance();
  assert.ok(api.count("plays") - asksBefore >= 4, "the plays asked on till they announce it");
  assert.equal(g.plays.find((p) => p.id === `${main}:result`).at, iso(over + 2 * 60_000), "its result at the first ask that had it, its announcement filed later");
  while (!g.done && (await vt.advance()));
  assert.ok(vt.now() >= over + 10 * 60_000 && vt.now() < over + 11 * 60_000, "done once its statistics are settled");
  assert.ok(announced < late);
});
