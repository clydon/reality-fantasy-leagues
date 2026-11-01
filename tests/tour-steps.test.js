// The first-time tour's steps and what its practice runs use (src/new/tour/steps.ts and plan.ts, docs/PLAN-first-time-tour.md
// version 2): welcome, your Home, add a show, the reveal, start a game, you're set; the practice's show (the first of Survivor, The
// Amazing Race and The Challenge you don't have, set up as a game) and the reveal to play again. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { tourSteps } = jiti("../src/new/tour/steps.ts");
const { demoOf, practiceShowOf, replayOf } = jiti("../src/new/tour/plan.ts");

const ids = (steps) => steps.map((s) => s.id);
const byId = (steps) => Object.fromEntries(steps.map((s) => [s.id, s]));
const at = (o) => ({ solo: false, reminders: "off", show: "The Amazing Race", replay: true, ...o });

test("a couch member: seven steps, welcome first, the three practice runs in the middle, the guide after adding", () => {
  const steps = tourSteps(at({}));
  assert.deepEqual(ids(steps), ["welcome", "home", "add", "guide", "reveal", "start", "done"]);
  const s = byId(steps);
  assert.deepEqual([s.add.act.kind, s.reveal.act.kind, s.start.act.kind], ["add", "reveal", "start"]);
  assert.equal(s.home.union, true);
  assert.equal(s.add.line, "Let's add The Amazing Race. Practice: it won't show up.");
  assert.equal(s.start.line, "Make a Prediction Sheet for The Amazing Race. Practice again: it won't show up.");
  assert.match(s.reveal.line, /replays your last one/);
  assert.equal(s.done.line, "Want a nudge before your picks lock?");
});

test("nothing to practise with: the add and the start in general words; nothing to replay: a made-up reveal", () => {
  const s = byId(tourSteps(at({ show: null, replay: false })));
  assert.equal(s.add.line, "Add any show you watch. Practice: it won't show up.");
  assert.equal(s.start.line, "Make a Prediction Sheet. Practice again: it won't show up.");
  assert.match(s.reveal.line, /made-up one/);
});

test("solo: no game to start without a couch, so the start step pitches one and has no practice", () => {
  const s = byId(tourSteps(at({ solo: true })));
  assert.equal(s.start.act, undefined);
  assert.match(s.start.line, /couch/);
  assert.equal(s.start.targets[0], "[data-solo-start-couch]");
});

test("the last step asks about reminders only while this phone could get them", () => {
  assert.match(byId(tourSteps(at({ reminders: "install" }))).done.line, /Home Screen/);
  assert.match(byId(tourSteps(at({ reminders: null }))).done.line, /Settings/);
});

test("every line is short, every title shorter", () => {
  for (const o of [{}, { solo: true }, { show: null, replay: false }, { reminders: "install" }, { reminders: null }]) {
    for (const s of tourSteps(at(o))) {
      assert.ok(s.line.split(/\s+/).length <= 16, `${s.id}: "${s.line}" is over sixteen words`);
      assert.ok(s.title.length <= 24, `${s.id}: title "${s.title}" is long`);
    }
  }
});

// ---- the practice's show ----

const season = (show, n, o = {}) => ({ seasonId: `${show}-${n}`, show, label: `${show} ${n}`, season: `Season ${n}`, artUrl: null, artPosition: "center", status: "airing", premiere: `20${n}-01-01`, aired: 3, airsOn: "Wed", wall: true, ready: true, curated: true, tvmazeId: null, ...o });
const home = (mine = []) => ({ shows: mine.map((seasonId) => ({ seasonId, following: true, games: [] })) });
const CATALOG = [
  season("Survivor", 51),
  season("Survivor", 50, { status: "completed" }),
  season("The Amazing Race (American edition)", 39),
  season("The Challenge", 42, { status: "upcoming" }),
  season("The Challenge", 41, { status: "completed" }),
];

test("the practice adds Survivor when you don't have it", () => {
  assert.deepEqual(practiceShowOf(CATALOG, home()), { seasonId: "Survivor-51", name: "Survivor", label: "Survivor 51", artUrl: null });
});

test("a show you have in any season is passed over; the name is said without its edition", () => {
  const p = practiceShowOf(CATALOG, home(["Survivor-50"]));
  assert.equal(p.seasonId, "The Amazing Race (American edition)-39");
  assert.equal(p.name, "The Amazing Race");
  assert.equal(p.label, "The Amazing Race 39");
});

test("only a season that's a game already and still to finish; on now before coming up", () => {
  const notReady = CATALOG.map((s) => (s.show.startsWith("The Amazing") ? { ...s, ready: false } : s));
  assert.equal(practiceShowOf(notReady, home(["Survivor-51"])).seasonId, "The Challenge-42");
  const both = [...CATALOG, season("The Challenge", 43, { status: "airing", premiere: "2026-01-01" })];
  assert.equal(practiceShowOf(both, home(["Survivor-51", "The Amazing Race (American edition)-39"])).seasonId, "The Challenge-43");
});

test("all three on your list (or none set up): no practice show", () => {
  assert.equal(practiceShowOf(CATALOG, home(["Survivor-51", "The Amazing Race (American edition)-39", "The Challenge-41"])), null);
  assert.equal(practiceShowOf([], home()), null);
});

// ---- the reveal to play again ----

const show = (seasonId, o = {}) => ({ seasonId, show: { name: `Show ${seasonId}` }, seasonNumber: 1, games: [{}], seenThrough: 3, latestAired: 4, status: "airing", ...o });

test("the last episode you revealed on a show you play, one on now first", () => {
  const r = replayOf({ shows: [show("old", { status: "completed", latestAired: 13, seenThrough: 13 }), show("now", { seenThrough: 4 })] });
  assert.deepEqual(r, { seasonId: "now", n: 4, name: "Show now", season: 1 });
});

test("nothing revealed, or no game on any show: nothing to replay", () => {
  assert.equal(replayOf({ shows: [show("a", { seenThrough: 0 }), show("b", { games: [] })] }), null);
  assert.equal(replayOf({ shows: [] }), null);
});

test("spoilers off (seen null): the latest that's aired", () => {
  assert.equal(replayOf({ shows: [show("a", { seenThrough: null, latestAired: 6 })] }).n, 6);
});

// ---- what the demo adds after yours ----

const have = (...tv) => ({ shows: tv.map((tvmazeId) => ({ show: { tvmazeId } })) });

test("in the NFL's season: Harry Potter, then the NFL's next weekly game (Sunday night on a Sunday afternoon)", () => {
  const sunday = new Date(2026, 10, 1, 15, 0);
  assert.deepEqual(demoOf(have(), sunday), [
    { query: "Harry Potter", tvmazeId: 68803 },
    { query: "Sunday Night Football", tvmazeId: 30940 },
  ]);
});

test("late on Sunday, Monday's; on a Tuesday, Thursday's; one you have is passed over", () => {
  assert.equal(demoOf(have(), new Date(2026, 10, 1, 23, 30))[1].tvmazeId, 30941);
  assert.equal(demoOf(have(), new Date(2026, 10, 3, 12, 0))[1].tvmazeId, 59591);
  assert.deepEqual(demoOf(have(68803, 30940), new Date(2026, 10, 1, 15, 0)), [{ query: "Monday Night Football", tvmazeId: 30941 }]);
});

test("out of the NFL's season: Harry Potter alone", () => {
  assert.deepEqual(demoOf(have(), new Date(2026, 5, 7, 12, 0)), [{ query: "Harry Potter", tvmazeId: 68803 }]);
});
