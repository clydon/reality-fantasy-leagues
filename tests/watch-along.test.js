// Watch along's rules (src/lib/game/watch-along.ts, docs/PLAN-new-design.md step 13 part 1): which episode a watch along is for, who
// may watch along which, how far into an episode the couch's reactions may be sent (30 s behind your clock, never past what's aired),
// the clock, and what a GIF or a comment may carry. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const W = jiti("../src/lib/game/watch-along.ts");

test("which episode: your next once it's aired, live when it's on, else the next to air", () => {
  assert.deepEqual(W.watchEpisode({ mark: 4, latestAired: 6, next: 7, live: null }), { episode: 5, status: "aired" });
  assert.deepEqual(W.watchEpisode({ mark: 5, latestAired: 6, next: 7, live: 6 }), { episode: 6, status: "live" });
  assert.deepEqual(W.watchEpisode({ mark: 6, latestAired: 6, next: 7, live: null }), { episode: 7, status: "soon" });
  assert.deepEqual(W.watchEpisode({ mark: 0, latestAired: 0, next: 1, live: null }), { episode: 1, status: "soon" });
  assert.equal(W.watchEpisode({ mark: 13, latestAired: 13, next: null, live: null }), null, "season over and seen");
  // Someone who sees everything straight away: what's on, else what's next, else the latest.
  assert.deepEqual(W.watchEpisode({ mark: Infinity, latestAired: 6, next: 7, live: 6 }), { episode: 6, status: "live" });
  assert.deepEqual(W.watchEpisode({ mark: Infinity, latestAired: 6, next: 7, live: null }), { episode: 7, status: "soon" });
  assert.deepEqual(W.watchEpisode({ mark: Infinity, latestAired: 13, next: null, live: null }), { episode: 13, status: "aired" });
});

test("who may watch along what: one you've seen or your next, once it's aired (the next to air is 'soon')", () => {
  const at = { mark: 4, latestAired: 6, next: 7, live: 6 };
  assert.deepEqual(W.mayWatch(5, at), { ok: true, status: "aired" });
  assert.deepEqual(W.mayWatch(2, at), { ok: true, status: "aired" }, "one you've seen, again");
  const ahead = W.mayWatch(6, at);
  assert.equal(ahead.ok, false);
  assert.equal(ahead.status, 403, "past your next one: nothing about it leaves the server");
  assert.match(ahead.error, /Episode 5/);
  assert.deepEqual(W.mayWatch(7, { mark: 6, latestAired: 6, next: 7, live: null }), { ok: true, status: "soon" });
  assert.equal(W.mayWatch(8, { mark: 7, latestAired: 6, next: 7, live: null }).status, 409, "no air time yet");
  assert.deepEqual(W.mayWatch(6, { ...at, mark: Infinity }), { ok: true, status: "live" });
});

test("the couch's reactions: 30 s behind your clock, never past what's aired, nothing before it airs", () => {
  assert.equal(W.LATE_MS, 30_000);
  assert.equal(W.othersThrough(600_000, 3_600_000), 570_000);
  assert.equal(W.othersThrough(20_000, 3_600_000), -1, "under 30 s in: nothing yet");
  assert.equal(W.othersThrough(30_000, 3_600_000), 0);
  // A clock ahead of the airing (live, or a clock gone wrong) is held to what's aired so far.
  assert.equal(W.othersThrough(900_000, 120_000), 90_000);
  assert.equal(W.othersThrough(600_000, null), -1, "not aired");
  assert.equal(W.othersThrough(600_000, -5), -1);
  assert.equal(W.othersThrough(NaN, 3_600_000), -1);
});

test("the clock: runs, stops, moves by and to, never below zero", () => {
  let c = { at: 0, since: null };
  assert.equal(W.clockAt(c, 1000), 0, "stopped stands still");
  c = W.runClock(c, 1000);
  assert.equal(W.clockAt(c, 61_000), 60_000);
  assert.deepEqual(W.runClock(c, 5000), c, "running already");
  c = W.stopClock(c, 61_000);
  assert.deepEqual(c, { at: 60_000, since: null });
  assert.equal(W.clockAt(c, 999_999), 60_000);
  c = W.moveClock(c, 70_000, { byMs: -10_000 });
  assert.deepEqual(c, { at: 50_000, since: null }, "moved while paused stays paused");
  c = W.moveClock(W.runClock(c, 100_000), 105_000, { byMs: 10_000 });
  assert.deepEqual(c, { at: 65_000, since: 105_000 }, "moved while running runs on from there");
  assert.equal(W.moveClock(c, 105_000, { byMs: -999_999 }).at, 0);
  assert.equal(W.moveClock(c, 105_000, { toMs: 1_390_000 }).at, 1_390_000);
});

test("runtimes as people read them, and back", () => {
  assert.equal(W.runtimeText(0), "0:00");
  assert.equal(W.runtimeText(754_900), "12:34");
  assert.equal(W.runtimeText(3_723_000), "1:02:03");
  assert.equal(W.parseRuntime("23:10"), 1_390_000);
  assert.equal(W.parseRuntime(" 12 "), 720_000, "minutes alone");
  assert.equal(W.parseRuntime("1:02:03"), 3_723_000);
  assert.equal(W.parseRuntime("12:75"), null);
  assert.equal(W.parseRuntime("abc"), null);
  assert.equal(W.parseRuntime("999:00"), null, "past six hours");
});

test("what a reaction may carry: GIPHY's own pictures only, a tidy comment", () => {
  const gif = { id: "xT0xeJpnrWC4XWblEk", url: "https://media4.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.webp?cid=1&rid=200w.webp", w: 200, h: 113, title: "  slow   clap " };
  assert.deepEqual(W.cleanGif(gif), { ...gif, title: "slow clap" });
  assert.ok(W.giphyUrl("https://i.giphy.com/x.gif"));
  assert.equal(W.cleanGif({ ...gif, url: "http://media4.giphy.com/x.gif" }), null, "https only");
  assert.equal(W.cleanGif({ ...gif, url: "https://evil.example/giphy.com.gif" }), null, "another host");
  assert.equal(W.cleanGif({ ...gif, url: "https://media.giphy.com.evil.example/x.gif" }), null);
  assert.equal(W.cleanGif({ ...gif, id: "../x" }), null);
  assert.equal(W.cleanGif({ ...gif, w: 0 }), null);
  assert.equal(W.cleanGif(null), null);
  assert.equal(W.cleanText("  that   cold open  "), "that cold open");
  assert.equal(W.cleanText("   "), null);
  assert.equal(W.cleanText(5), null);
  assert.ok(W.isReactKind("fire") && !W.isReactKind("text") && !W.isReactKind("heart"));
});

test("the card's line: who left reactions and how many, never what", () => {
  assert.equal(W.leftLine(["riley", "sam"], 23), "riley and sam left 23 reactions · they show up as you reach them");
  assert.equal(W.leftLine(["riley"], 1), "riley left 1 reaction · they show up as you reach them");
  assert.equal(W.leftLine(["riley", "sam", "jordan", "casey"], 9), "riley, sam and 2 more left 9 reactions · they show up as you reach them");
  assert.match(W.leftLine([], 0), /^Be the first/);
});
