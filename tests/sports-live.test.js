// The live clock (docs/PLAN-start-a-game-gpt.md track L, step L2): a game's clock for someone (src/lib/sports/clock.ts: live,
// synced, snapped, and the pieces the engine's live calls, A15, build on), a game live on the phone (src/lib/sports/live.ts:
// asking ESPN every 15 s while it's on and the screen visible, stopping when final, backing off when ESPN fails, merging each
// answer's plays), and every recorded game (tests/fixtures/espn/) replayed through it in virtual time from
// scripts/dev-test/espn-replay.js: each answer's state equals the recording as known at that moment, but for what a later play
// settles (listed per game, each within minutes), and the end equals ESPN's box score. The same through a real HTTP stand-in
// at 60x is scripts/dev-test/check-live-clock.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const L = jiti("../src/lib/sports/index.ts");
const { asOf, bounds, known, differences, settles, FINAL_AFTER_MS } = require("../scripts/dev-test/espn-replay.js");

const { sportOf, LiveGame, mergeTimeline } = L;
const { virtual } = require("./harness/virtual-time");
const FIXTURES = path.join(__dirname, "fixtures", "espn");
// The team sports' recorded games: a field's (golf's board and leaderboard) has no plays in time to replay (tests/sports-golf.test.js).
const games = fs
  .readdirSync(FIXTURES)
  .filter((f) => !f.includes("schedule"))
  .map((f) => ({ file: f, summary: JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) }))
  .filter((g) => !g.summary.board);
const load = (name) => games.find((g) => g.file.startsWith(name)).summary;
const sportFor = (s) => sportOf(s._recorded.league);
const sidesOf = (s) => s.header.competitions[0].competitors.map((c) => String(c.team.id));
const MIN = 60_000;
const T0 = Date.parse("2026-10-22T23:00:00Z");

/** A fetch answering a recorded game as of the virtual time (`down`: ESPN failing), logging each ask's moment. */
function replayFetch(summary, vt, sport) {
  const f = async () => {
    f.asked.push(vt.now());
    if (f.down) return { ok: false, status: 503, json: async () => ({}) };
    const body = asOf(summary, vt.now(), { sport });
    return { ok: true, status: 200, json: async () => body };
  };
  f.asked = [];
  f.down = false;
  return f;
}

/* ---- The clock. ---- */

test("a clock is live (now), synced (pressed play, paused, nudged, set by a tapped play; never ahead of live) or snapped (the end for anyone not watching)", () => {
  const w = T0 + 60 * MIN;
  assert.equal(L.momentOf(L.live(), w), w);
  // Press play on a recording of a game that started an hour ago: an hour behind, running in real time.
  let c = L.startAt(T0, w);
  assert.deepEqual(c, { mode: "synced", at: T0, wall: w, running: true });
  assert.equal(L.momentOf(c, w + 10 * MIN), T0 + 10 * MIN);
  assert.equal(L.behind(c, w + 10 * MIN), 60 * MIN);
  // Pause: the game stays put; play: it runs on from there.
  c = L.pause(c, w + 10 * MIN);
  assert.equal(L.momentOf(c, w + 30 * MIN), T0 + 10 * MIN);
  c = L.resume(c, w + 30 * MIN);
  assert.equal(L.momentOf(c, w + 31 * MIN), T0 + 11 * MIN);
  // 30 s either way.
  c = L.nudge(c, w + 31 * MIN, -30_000);
  assert.equal(L.momentOf(c, w + 31 * MIN), T0 + 11 * MIN - 30_000);
  c = L.nudge(L.nudge(c, w + 31 * MIN, 30_000), w + 31 * MIN, 30_000);
  assert.equal(L.momentOf(c, w + 31 * MIN), T0 + 11 * MIN + 30_000);
  // Tap the last play you saw: the clock is that play's moment, still running (or still paused).
  c = L.setTo(c, w + 32 * MIN, T0 + 20 * MIN);
  assert.equal(L.momentOf(c, w + 33 * MIN), T0 + 21 * MIN);
  assert.equal(L.setTo(L.pause(c, w + 33 * MIN), w + 33 * MIN, T0 + 5 * MIN).running, false);
  // Never ahead of live: a running clock that catches up is live again, and pressing play on a game not yet on is live.
  assert.deepEqual(L.nudge(L.startAt(w - 10_000, w), w, 30_000), L.live());
  assert.deepEqual(L.startAt(w + MIN, w), L.live());
  assert.equal(L.momentOf({ mode: "synced", at: w - 10_000, wall: w - 60_000, running: true }, w), w, "capped at live");
  // Back from live is a stream's delay; forward from live goes nowhere.
  assert.deepEqual(L.nudge(L.live(), w, -30_000), { mode: "synced", at: w - 30_000, wall: w, running: true });
  assert.deepEqual(L.nudge(L.live(), w, 30_000), L.live());
  // Pausing live leaves you behind it.
  assert.equal(L.behind(L.pause(L.live(), w), w + MIN), MIN);
  // Snapped: fixed; the end for anyone not watching; playing from a snapped moment runs on from it, the end can't run.
  assert.equal(L.momentOf(L.snapped(T0 + MIN), w), T0 + MIN);
  assert.equal(L.momentOf(L.ended(), w), Infinity);
  assert.equal(L.behind(L.ended(), w), null);
  assert.deepEqual(L.resume(L.snapped(T0 + MIN), w), { mode: "synced", at: T0 + MIN, wall: w, running: true });
  assert.deepEqual(L.resume(L.ended(), w), L.ended());
  assert.deepEqual(L.nudge(L.ended(), w, -30_000), L.ended());
  // Plain data: kept on the phone as JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
});

test("a clock's game: the plays up to its moment, the last play at or before it (a snapped clock's), 0-0 before the first", () => {
  const s = load("nba-401909093");
  const sport = sportFor(s);
  const plays = sport.timeline(s);
  const sides = sidesOf(s);
  const first = L.playMoment(plays[0]);
  assert.equal(L.playAt(plays, first - 1), null);
  assert.equal(L.playAt(plays, first), plays.filter((p) => L.playMoment(p) === first).pop());
  const mid = L.playMoment(plays[250]);
  assert.equal(L.playMoment(L.playAt(plays, mid + 1)), mid);
  assert.equal(L.playAt(plays, Infinity), plays[plays.length - 1], "the end is the final's correction");
  assert.equal(L.playAt([{ at: null }], 0), null, "a play with no time is only the end's");
  // Through a clock: before the first play the score is 0-0 (never the header's final: a later watch's spoiler).
  const before = L.stateOn(sport, plays, L.startAt(first - MIN, first + 9 * 60 * MIN), first + 9 * 60 * MIN, sides);
  assert.deepEqual(before.score, { 5: 0, 20: 0 });
  assert.equal(before.plays, 0);
  const half = L.stateOn(sport, plays, L.snapped(mid), 0, sides);
  assert.deepEqual(half, sport.reduce(plays, mid, sides));
  const end = L.stateOn(sport, plays, L.ended(), 0, sides);
  assert.deepEqual(end.score, { 5: 106, 20: 114 });
});

test("GameState.score is seeded from the header's sides before the first play, in every recorded game (L1's Noticed)", () => {
  for (const { file, summary } of games) {
    const sport = sportFor(summary);
    const state = sport.stateAt(summary, bounds(summary, sport).first - 1);
    assert.deepEqual(Object.keys(state.score).sort(), sidesOf(summary).sort(), file);
    assert.ok(Object.values(state.score).every((v) => v === 0), file);
  }
  assert.deepEqual(sportOf("baseball/mlb").reduce([]).score, {}, "no sides, no score");
});

test("for the engine's live calls (A15): a window between two moments, each viewer's own lock, a call's stamp, earlier worth more", () => {
  const w = { opens: T0, closes: T0 + 10 * MIN };
  assert.ok(L.isOpen(w, T0) && L.isOpen(w, T0 + 10 * MIN - 1));
  assert.ok(!L.isOpen(w, T0 - 1) && !L.isOpen(w, T0 + 10 * MIN));
  assert.ok(L.isOpen({ opens: null, closes: null }, 0));
  // Someone watching live locks at the close; someone 30 minutes behind locks 30 minutes later, at their own close.
  const wall = T0 + 10 * MIN;
  const late = L.startAt(T0 - 20 * MIN, wall);
  assert.ok(L.isLocked(w, L.live(), wall));
  assert.ok(!L.isLocked(w, late, wall));
  assert.ok(!L.isLocked(w, late, wall + 29 * MIN) && L.isLocked(w, late, wall + 30 * MIN));
  assert.ok(!L.isLocked({ opens: T0, closes: null }, L.ended(), wall), "a window open to the end never locks");
  // A call carries the game's moment on its caller's clock, and the real time it was made.
  assert.deepEqual(L.stamp(late, wall + 5 * MIN), { at: T0 - 15 * MIN, wall: wall + 5 * MIN, mode: "synced" });
  assert.equal(L.earliness(w, T0), 1);
  assert.equal(L.earliness(w, T0 + 5 * MIN), 0.5);
  assert.equal(L.earliness(w, T0 + 10 * MIN), null, "at the close it's shut");
  assert.equal(L.earliness({ opens: T0, closes: null }, T0), null);
  // A unit's stretch: an at-bat from its first pitch to its result (live calls' "this at-bat").
  const s = load("mlb-401907924");
  const plays = sportFor(s).timeline(s);
  const result = plays.find((p) => p.unit && p.kind === "home-run") ?? plays.find((p) => p.unit && Object.values(p.deltas).some((d) => d.HR));
  const atBat = L.unitWindow(plays, result.unit);
  const its = plays.filter((p) => p.unit === result.unit);
  assert.deepEqual(atBat, { opens: L.playMoment(its[0]), closes: L.playMoment(its[its.length - 1]) });
  assert.ok(L.playMoment(result) <= atBat.closes);
  assert.equal(L.unitWindow(plays, "no such unit"), null);
});

/* ---- The replay's answers. ---- */

test("a recorded game as ESPN would have answered at a moment: pre, then the plays so far with their score, then the recording", () => {
  const s = load("nba-401909093");
  const sport = sportFor(s);
  const b = bounds(s);
  const pre = asOf(s, b.first - MIN, { sport });
  assert.equal(pre.header.competitions[0].status.type.state, "pre");
  assert.deepEqual(pre.plays, []);
  assert.deepEqual(pre.header.competitions[0].competitors.map((c) => [c.score, "winner" in c]), [["0", false], ["0", false]]);
  assert.equal(pre.header.competitions[0].date, `${new Date(b.first).toISOString().slice(0, 16)}Z`, "the first play's minute");
  const mid = Date.parse("2026-10-23T00:30:00Z");
  const on = asOf(s, mid, { sport });
  assert.equal(on.header.competitions[0].status.type.state, "in");
  assert.ok(on.plays.length > 100 && on.plays.length < s.plays.length);
  const state = sport.stateAt(s, mid);
  assert.deepEqual(on.header.competitions[0].competitors.map((c) => Number(c.score)), sidesOf(s).map((id) => state.score[id]));
  assert.equal(on.header.competitions[0].status.type.detail, sport.where(state.last));
  // Who's who stays (the readers match names to it); nothing is counted yet.
  const box = sport.readBox(on);
  assert.equal(box.final, false);
  assert.deepEqual(Object.keys(box.people).sort(), Object.keys(sport.readBox(s).people).sort());
  assert.ok(Object.values(box.people).every((p) => Object.values(p.stats).every((v) => v === 0)));
  // A minute after the last play, the recording itself.
  assert.equal(asOf(s, b.last, { sport }).header.competitions[0].status.type.state, "in");
  assert.equal(asOf(s, b.end, { sport }), s);
});

test("football live: the drive going on is drives.current, read once (also when ESPN lists it in drives.previous too)", () => {
  const s = load("nfl-401873017");
  const sport = sportFor(s);
  const b = bounds(s);
  // A moment in the middle of a drive.
  let at = b.first + 30 * MIN;
  let ans = asOf(s, at, { sport });
  while (!(ans.drives.current && ans.drives.current.plays.length >= 2)) ans = asOf(s, (at += 15_000), { sport });
  const ids = (x) => sport.readPlays(x).map((p) => p.id);
  const plays = ids(ans);
  assert.equal(new Set(plays).size, plays.length);
  for (const p of ans.drives.current.plays) assert.ok(plays.includes(String(p.id)), "its plays are read");
  const twice = { ...ans, drives: { previous: [...ans.drives.previous, ans.drives.current], current: ans.drives.current } };
  assert.deepEqual(ids(twice), plays);
  // Its plays carry the drive as their unit, as a finished drive's do.
  const current = sport.readPlays(ans).filter((p) => ans.drives.current.plays.some((q) => String(q.id) === p.id));
  assert.ok(current.every((p) => p.unit === String(ans.drives.current.id)));
});

/* ---- Merging answers. ---- */

test("each answer's plays win, unless the answer is behind (an older cache edge's): the timeline never goes back", () => {
  const p = (id, at) => ({ id, at, period: 1, half: null, clock: null, text: id, kind: "x", team: null, unit: null, people: [], score: {}, deltas: {} });
  const have = [p("a", "2026-10-22T23:10:00Z"), p("b", "2026-10-22T23:11:00Z"), p("c", "2026-10-22T23:12:00Z")];
  const more = [...have, p("d", "2026-10-22T23:13:00Z")];
  assert.equal(mergeTimeline([], more), more);
  assert.equal(mergeTimeline(have, more), more, "more plays");
  const fixed = [have[0], { ...have[1], text: "changed on review" }, have[2]];
  assert.equal(mergeTimeline(have, fixed), fixed, "the same plays read again: ESPN's latest wins");
  const dropped = [have[0], have[2]];
  assert.equal(mergeTimeline(have, dropped), dropped, "a play ESPN dropped");
  assert.equal(mergeTimeline(more, have), more, "behind: its newest is one had before");
  assert.equal(mergeTimeline(have, []), have, "an answer with nothing");
  const refiled = [have[0], have[1], p("c2", "2026-10-22T23:12:30Z")];
  assert.equal(mergeTimeline(have, refiled), refiled, "the newest play filed again under another id, later");
  const older = [have[0], p("b2", "2026-10-22T23:10:30Z")];
  assert.equal(mergeTimeline(have, older), have, "behind: its newest is earlier than the newest had");
});

test("merging: an answer cut short (ESPN's live soccer answer with its commentary cut to its first 40 entries, its key events whole) changes nothing", () => {
  // Liverpool–Chelsea, 2026-10-28, 22:14:41: 40 commentary entries between answers of 119, its newest play (the end, a key
  // event) still in it. Here the same, cut from a recorded match.
  const s = load("epl-401878767");
  const sport = sportFor(s);
  const whole = sport.readPlays(s);
  const cut = sport.readPlays({ ...s, commentary: s.commentary.slice(0, 40) });
  assert.equal(cut[cut.length - 1].id, whole[whole.length - 1].id, "its newest play is the newest had");
  assert.ok(whole.length - cut.length > 30, "a third of the plays gone");
  assert.equal(mergeTimeline(whole, cut), whole, "cut short: kept as had");
  // ESPN dropping a play or two (a goal wiped on review) is still taken.
  const two = whole.filter((p) => p.kind !== "handball");
  assert.equal(whole.length - two.length, 2);
  assert.equal(mergeTimeline(whole, two), two);
  // And the poller takes a cut answer only if it comes twice in a row (ESPN's truth then).
  const g = new LiveGame({ sport, league: "soccer/eng.1", event: "401878767", now: () => 0 });
  const live = JSON.parse(JSON.stringify(s));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  g.take(live);
  const short = { ...live, commentary: live.commentary.slice(0, 40) };
  g.take(short);
  assert.equal(g.plays.length, whole.length, "once: ignored");
  g.take(short);
  assert.equal(g.plays.length, cut.length, "twice: taken");
});

/* ---- The poller. ---- */

test("asking: once at the start, then not until the game's start; every 15 s (±10%) while it's on; doubling while ESPN fails; never while hidden; stops when final", async () => {
  const s = load("nba-401909093");
  const sport = sportFor(s);
  const b = bounds(s);
  const vt = virtual(b.first - 45 * MIN);
  const fetch = replayFetch(s, vt, sport);
  let visible = true;
  const g = new LiveGame({ sport, league: "basketball/nba", event: "401909093", fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, visible: () => visible, random: () => 1 });
  assert.equal(g.url, "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909093");
  g.start();
  await vt.settle();
  assert.deepEqual([fetch.asked.length, g.status, g.startsAt], [1, "pre", Date.parse(`${new Date(b.first).toISOString().slice(0, 16)}Z`)]);
  assert.deepEqual(g.line, { provider: "DraftKings", details: "PHI -2.5", overUnder: 237.5, spread: -2.5 });
  assert.deepEqual(g.lineAtStart, g.line);
  assert.deepEqual(g.teams.map((t) => [t.id, t.score, t.winner]), sidesOf(s).map((id) => [id, 0, null]), "the sides, not the header's score");
  // 45 minutes out: wait 10 minutes (a start moved earlier), then up to the start, each wait 0-3 s more (phones apart).
  assert.equal(vt.timers[0].ms, 10 * MIN + 3_000);
  while (vt.now() < g.startsAt) await vt.advance();
  assert.ok(vt.now() - g.startsAt <= 3_000, "asked at the start, give or take 3 s");
  assert.equal(fetch.asked.length, 6, "45 minutes out: every 10 minutes, then the rest");
  assert.deepEqual(Object.values(g.people)[0] && Object.keys(Object.values(g.people)[0]).sort(), ["id", "name", "position", "team"], "who's who, without numbers");
  // On (or about to be): every 15 s, at most 10% more.
  while (g.status === "pre") await vt.advance();
  assert.equal(vt.timers[0].ms, 16_500);
  // ESPN fails: 30 s, 60 s, 120 s ... at most 5 minutes; an answer brings it back to 15 s.
  fetch.down = true;
  const waits = [];
  for (let i = 0; i < 6; i++) {
    await vt.advance();
    waits.push(vt.timers[0].ms);
  }
  assert.deepEqual(waits, [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]);
  assert.equal(g.lastError, "ESPN answered 503");
  fetch.down = false;
  await vt.advance();
  assert.deepEqual([g.failures, vt.timers[0].ms], [0, 16_500]);
  // Hidden: no asks at all; visible again: one at once (it's been longer than 15 s).
  visible = false;
  g.visibilityChanged();
  assert.equal(vt.timers.length, 0);
  const asked = fetch.asked.length;
  vt.set(vt.now() + 20 * MIN);
  visible = true;
  g.visibilityChanged();
  await vt.settle();
  assert.equal(fetch.asked.length, asked + 1);
  assert.equal(vt.timers.length, 1);
  // Visible again before the next ask is due: the rest of the wait.
  visible = false;
  g.visibilityChanged();
  vt.set(vt.now() + 5_000);
  visible = true;
  g.visibilityChanged();
  assert.equal(vt.timers[0].ms, 11_500);
  // ESPN failing: a screen toggled back on keeps the backoff, never an ask at once.
  fetch.down = true;
  await vt.advance();
  assert.equal(g.failures, 1);
  visible = false;
  g.visibilityChanged();
  vt.set(vt.now() + 5_000);
  visible = true;
  const before = fetch.asked.length;
  g.visibilityChanged();
  await vt.settle();
  assert.deepEqual([fetch.asked.length, vt.timers[0].ms], [before, 25_000]);
  fetch.down = false;
  // To the end: final, then nothing more.
  while (await vt.advance());
  assert.ok(g.done && g.final);
  assert.equal(g.nextDelay(), null);
  assert.ok(fetch.asked[fetch.asked.length - 1] >= b.end, "the last ask was the final");
  assert.ok(fetch.asked.every((t, i) => i === 0 || t > fetch.asked[i - 1]), "one ask at a time");
});

test("an answer behind what's had changes nothing: older plays, or 'in' after 'post'", () => {
  const s = load("nhl-401892582");
  const sport = sportFor(s);
  const b = bounds(s);
  const g = new LiveGame({ sport, league: "hockey/nhl", event: "401892582", now: () => 0 });
  const later = b.first + 90 * MIN;
  assert.equal(g.take(asOf(s, later, { sport })), true);
  const had = g.plays;
  assert.equal(g.take(asOf(s, later - 10 * MIN, { sport })), false);
  assert.equal(g.plays, had);
  assert.equal(g.take(asOf(s, later, { sport })), false, "the same answer again brings nothing new");
  assert.equal(g.take(s), true);
  assert.ok(g.final && g.plays[g.plays.length - 1].final);
  assert.equal(g.take(asOf(s, later, { sport })), false);
  assert.equal(g.status, "post");
});

test("ESPN dropping its newest play (wiped on review): an old cache edge's answer doesn't come twice, so the second is taken", () => {
  const s = load("nba-401909093");
  const sport = sportFor(s);
  const g = new LiveGame({ sport, league: "basketball/nba", event: "401909093", now: () => 0 });
  const ans = asOf(s, Date.parse("2026-10-23T00:30:00Z"), { sport });
  g.take(ans);
  const had = g.plays.length;
  const wiped = { ...ans, plays: ans.plays.slice(0, -1) };
  assert.equal(g.take(wiped), false, "once: maybe an old edge's");
  assert.equal(g.plays.length, had);
  assert.equal(g.take(wiped), true, "twice: ESPN's own");
  assert.equal(g.plays.length, had - 1);
  assert.equal(g.take({ ...ans, plays: [] }), false, "an answer with no plays never replaces some");
});

test("ESPN's start time wins while the game is still to start (a start moved later); a callback's error never stops the asking", async () => {
  const s = load("nhl-401892582");
  const sport = sportFor(s);
  const b = bounds(s);
  const vt = virtual(b.first - 3 * 60 * MIN);
  const fetch = replayFetch(s, vt, sport);
  let calls = 0;
  const g = new LiveGame({ sport, league: "hockey/nhl", event: "401892582", startsAt: b.first - 4 * 60 * MIN, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0,
    onChange: () => {
      calls++;
      throw new Error("the page broke");
    },
  });
  const errors = [];
  const log = console.error;
  console.error = (...a) => errors.push(a.join(" "));
  try {
    g.start();
    await vt.settle();
    await vt.advance();
  } finally {
    console.error = log;
  }
  assert.equal(g.startsAt, Date.parse(asOf(s, b.first - MIN, { sport }).header.competitions[0].date), "the page's was 4 hours early");
  assert.equal(calls, 2, "asked again after the callback threw");
  assert.equal(vt.timers.length, 1, "and still asking");
  assert.ok(errors.length === 2 && errors[0].includes("the page broke"));
  g.stop();
});

test("a moment that isn't one counts nothing (a clock stored badly is never the whole game); the end's Infinity counts everything", () => {
  const s = load("mlb-401907963");
  const sport = sportFor(s);
  const plays = sport.timeline(s);
  const sides = sidesOf(s);
  assert.equal(sport.reduce(plays, NaN, sides).plays, 0);
  assert.equal(sport.reduce(plays, "not a time", sides).plays, 0);
  assert.equal(sport.reduce(plays, Infinity, sides).plays, plays.length);
  assert.equal(sport.reduce(plays, undefined, sides).plays, plays.length);
  assert.equal(L.stateOn(sport, plays, { mode: "synced" }, T0, sides).plays, 0, "a synced clock missing its numbers");
  assert.deepEqual(L.stateOn(sport, plays, { mode: "synced" }, T0, sides).score, Object.fromEntries(sides.map((id) => [id, 0])));
});

test("every recorded game through the poller, in virtual time: each answer's state is the recording as known then, but for what a later play settles; the end is ESPN's box score", async () => {
  // What a later play settles, live (L2's As built): football's third-quarter-ending play wiped in the break (the next
  // quarter's first play starts where it did), and a goal on the game's first shot, before any shot named the goalie in that
  // net (the next one does). Every other answer equals the recording.
  const expected = { "nfl-401872958.json": 1, "nhl-401892582.json": 1 };
  for (const { file, summary } of games) {
    const sport = sportFor(summary);
    // By the sport's own play times (college baseball's stat crew stamps its plays 12 hours early).
    const b = bounds(summary, sport);
    const vt = virtual(b.first - 20 * MIN);
    const fetch = replayFetch(summary, vt, sport);
    const truth = known(sport, summary);
    const log = [];
    const behind = [];
    const g = new LiveGame({ sport, league: summary._recorded.league, event: summary._recorded.event, every: 30_000, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
    g.start();
    await vt.settle();
    for (let i = 0; i < 5000 && (await vt.advance()); i++) {
      const at = vt.now();
      log.push({ at, diffs: differences(g.state(L.live()), truth(at, g.final)) });
      // Someone 20 minutes behind, synced: the same game, 20 minutes earlier.
      const m = at - 20 * MIN;
      const late = differences(g.state(L.startAt(m, at)), truth(m, g.final && m >= b.last));
      if (late.length) behind.push(`${new Date(m).toISOString()}: ${late.slice(0, 3).join("; ")}`);
    }
    assert.ok(g.done && g.final, file);
    assert.equal(vt.timers.length, 0, `${file}: no ask after the final`);
    assert.ok(fetch.asked.length > (b.last - b.first) / 30_000, `${file}: asked all game`);
    const { streaks, long } = settles(log, { within: 6 * MIN });
    assert.equal(streaks.length, expected[file] ?? 0, `${file}: ${streaks.map((x) => `${new Date(x.from).toISOString()} ${x.ms / 1000}s ${x.diffs.slice(0, 4).join("; ")}`).join(" | ")}`);
    assert.deepEqual(long, [], `${file}: settled within 6 minutes`);
    assert.deepEqual(behind, [], `${file}: a later watch sees the recording`);
    // The end: ESPN's own box score, every person's every count, and its score.
    const box = sport.readBox(summary);
    const end = g.state(L.ended());
    for (const [id, p] of Object.entries(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[id]?.[k] ?? 0, v, `${file}: ${p.name} ${k}`);
    assert.deepEqual(end.score, Object.fromEntries(box.teams.map((t) => [t.id, t.score])), file);
    assert.ok(fetch.asked.some((t) => t >= b.last && t < b.end), `${file}: an ask between the last play and the final (FINAL_AFTER_MS ${FINAL_AFTER_MS})`);
  }
});
