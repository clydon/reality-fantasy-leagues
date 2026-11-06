// The first-time tour's steps and what its practice runs use (src/new/tour/steps.ts and plan.ts, docs/PLAN-first-time-tour.md
// version 3): welcome, up top, down Home a section a beat, then hands on (your moves, add a show, flip a show, the TV guide, the
// reveal, start a game), you're set; the practice's show (the first of Survivor, The Amazing Race and The Challenge you don't have,
// set up as a game) and the reveal to play again. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { numbered, tourSteps } = jiti("../src/new/tour/steps.ts");
const { demoOf, practiceShowOf, replayOf } = jiti("../src/new/tour/plan.ts");

const ids = (steps) => steps.map((s) => s.id);
const byId = (steps) => Object.fromEntries(steps.map((s) => [s.id, s]));
const at = (o) => ({ solo: false, reminders: "off", show: "The Amazing Race", replay: true, moves: true, flip: true, ...o });

test("a couch member: up top, down Home a section a beat, then hands on, each real thing tapped by them", () => {
  const steps = tourSteps(at({}));
  assert.deepEqual(ids(steps), ["welcome", "home", "shows", "week", "feed", "more", "moves", "add", "flip", "guide", "reveal", "start", "done"]);
  const s = byId(steps);
  assert.deepEqual(
    ["moves", "add", "flip", "reveal", "start"].map((k) => s[k].act.kind),
    ["moves", "add", "flip", "reveal", "start"]
  );
  assert.deepEqual([s.add.act.skip, s.reveal.act.skip, s.start.act.skip], ["Skip adding a show", "Skip the reveal", "Skip starting a game"]);
  assert.ok(["shows", "week", "feed", "more"].every((k) => s[k].part === "down" && s[k].optional && !s[k].act));
  assert.equal(s.flip.tap, "[data-flip]");
  assert.equal(s.guide.play, "[data-guide-tv]");
  assert.equal(s.home.union, true);
  assert.ok(steps.filter((x) => x.act).every((x) => x.act.label === "Tap it"), "the plate says Tap it: it points at the real thing, never does it");
  assert.equal(s.add.line, "Let's add The Amazing Race. Practice: nothing's saved.");
  assert.equal(s.start.line, "Make a Prediction Sheet for The Amazing Race. Practice again: nothing's saved.");
  assert.match(s.reveal.line, /replays your last one/);
  assert.equal(s.done.title, "That's a wrap");
  assert.equal(s.done.line, "Want a nudge before your picks lock?");
});

test("real results waiting past the replay's episode: the reveal step says they stay sealed", () => {
  const s = byId(tourSteps(at({ sealed: { now: 4, replays: 3 } })));
  assert.equal(s.reveal.line, "Nothing shows until you tap Reveal. Episode 4 stays sealed: this replays Episode 3.");
});

test("the count: down Home's beats share one number, ten in all", () => {
  const steps = tourSteps(at({}));
  const { nums, of } = numbered(steps);
  assert.equal(of, 10);
  assert.deepEqual(nums, [1, 2, 3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10]);
  // A beat this Home hasn't got is left out before the count (tour.tsx onHome): the rest close up.
  const less = steps.filter((x) => x.id !== "more" && x.id !== "feed");
  assert.deepEqual(numbered(less).nums.slice(0, 5), [1, 2, 3, 3, 4]);
});

test("nothing due: the moves step explains the top line, with nothing to tap; no games to flip: no flip step", () => {
  const s = byId(tourSteps(at({ moves: false, flip: false })));
  assert.equal(s.moves.act, undefined);
  assert.match(s.moves.line, /shows up here/);
  assert.equal(s.flip, undefined);
  assert.equal(numbered(tourSteps(at({ flip: false }))).of, 9);
});

test("nothing to practise with: the add and the start in general words; nothing to replay: a made-up reveal", () => {
  const s = byId(tourSteps(at({ show: null, replay: false })));
  assert.equal(s.add.line, "Add any show you watch. Practice: nothing's saved.");
  assert.equal(s.start.line, "Make a Prediction Sheet. Practice again: nothing's saved.");
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
  assert.match(byId(tourSteps(at({ reminders: null }))).done.line, /your picture/);
});

test("every line is short, every title shorter", () => {
  for (const o of [{}, { solo: true }, { show: null, replay: false }, { reminders: "install" }, { reminders: null }, { moves: false, flip: false }]) {
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
  assert.deepEqual(practiceShowOf(CATALOG, home()), { seasonId: "Survivor-51", name: "Survivor", label: "Survivor 51", artUrl: null, tvmazeId: null });
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

test("the demo adds one show, Saturday Night Live (no sports: they aren't set up yet)", () => {
  assert.deepEqual(demoOf(have()), [{ query: "Saturday Night Live", tvmazeId: 361 }]);
});

test("one you have is passed over", () => {
  assert.deepEqual(demoOf(have(361)), []);
});
