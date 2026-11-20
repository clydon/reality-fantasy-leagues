// A live preview's definition from a real season (docs/PLAN-preview-release.md, step 1; tools/gameplay-bench/preview/definition.cjs,
// src/lib/server/preview-definition.ts), on a made-up season (tests/fixtures/preview-season: the season page's shape, no real
// people): nothing real past the mark goes in, the cast is who they are and nothing a format keeps secret, the episodes between the
// mark and the game's start are made up, and a season that can't be previewed says why. Survivor 51's definition equalling the
// recorded fixture is checked by `node scripts/dev-test/preview-proof.js --dry` against the recordings (real names stay out of git).
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Def = require("../tools/gameplay-bench/preview/definition.cjs");
const R = require("../tools/gameplay-bench/explorer/runtime.cjs");
const { page } = require("./fixtures/preview-season/page.json");

const WEEK = 7 * 24 * 3600 * 1000, EP1 = Date.parse("2030-02-12T01:00:00.000Z");
const cast = Array.from({ length: 18 }, (_, i) => ({ name: "Castaway " + (i + 1), photoUrl: null, tribe: i % 2 ? "Blue" : "Red" }));
const exit = (n, who) => ({ n, kind: "elimination", name: "Castaway " + who, method: "Voted Out", type: null });
const moment = (n, who, type) => ({ n, kind: "event", name: "Castaway " + who, method: null, type });
const REAL = [exit(1, 18), moment(1, 2, "tribeImmunity"), moment(1, 4, "tribeImmunity"), exit(2, 17), moment(2, 1, "rewardWin"), exit(3, 16), moment(3, 3, "tribeImmunity")];
const season = (o = {}) => ({
  label: "Test Island 1", format: "survivor", show: { name: "Test Island", slug: "test-island" }, seasonName: "Season 1", number: 1,
  cast, episodes: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, airAt: new Date(EP1 + i * WEEK).toISOString() })),
  real: REAL.filter((x) => x.n <= (o.mark ?? 3)), mark: 3, from: 4, page, ...o,
});
const code = (c) => (e) => e.code === c;

test("a season at its mark: the real results through it, the rest to come, the clock before the game's first episode", () => {
  const d = Def.build(season(), { base: "fantasy", seed: 7 });
  const ev = d.world.events;
  assert.deepEqual(ev.filter((e) => e.resultStatus === "final").map((e) => e.number), [1, 2, 3]);
  assert.ok(ev.filter((e) => e.number >= 4).every((e) => e.resultStatus === "unavailable"));
  assert.deepEqual(d.world.facts.map((f) => [f.eventId, f.source]), [1, 2, 3].map((n) => ["show-event-" + n, "real-season"]));
  const gone = d.world.facts.flatMap((f) => f.data.events.map((x) => d.world.participants.find((p) => p.id === x.castawayId).name));
  assert.deepEqual(gone, ["Castaway 18", "Castaway 17", "Castaway 16"]);
  assert.equal(Date.parse(d.situation.clock), EP1 + 3 * WEEK - 5 * 3600 * 1000);
  assert.ok(d.world.people.every((p) => ["alex", "riley", "jordan", "sam"].includes(p.id)), "the couch is made up");
});

test("nothing real past the mark: a later result is refused, never quietly dropped", () => {
  assert.throws(() => Def.build({ ...season({ mark: 2, from: 3 }), real: REAL }, { base: "fantasy" }), code("preview-spoiler"));
  assert.throws(() => Def.build({ ...season(), real: [...REAL.slice(0, 2), { ...exit(9, 5) }] }, { base: "fantasy" }), code("preview-spoiler"));
});

test("a cast member is who they are: a format's secret field (the Traitors' role) never goes in", () => {
  const traitors = cast.map((c, i) => (i === 3 ? { ...c, role: "traitor" } : c));
  assert.throws(() => Def.build(season({ cast: traitors }), { base: "fantasy" }), code("preview-spoiler"));
  const d = Def.build(season(), { base: "fantasy" });
  assert.ok(d.world.participants.every((p) => Object.keys(p).every((k) => ["id", "contextId", "name", "photoUrl"].includes(k))));
});

test("behind the game's start: real through the mark, the episodes between made up (someone goes home each)", () => {
  const d = Def.build(season({ mark: 1 }), { base: "fantasy", seed: 7 });
  assert.deepEqual(d.world.facts.map((f) => [f.eventId, f.source]), [["show-event-1", "real-season"], ["show-event-2", "made-up"], ["show-event-3", "made-up"]]);
  const name = (id) => d.world.participants.find((p) => p.id === id).name;
  assert.equal(name(d.world.facts[0].data.events[0].castawayId), "Castaway 18");
  const madeUp = d.world.facts.slice(1).map((f) => name(f.data.events[0].castawayId));
  assert.equal(new Set(["Castaway 18", ...madeUp]).size, 3, "a different person each episode");
  // The same seed makes the same season; another makes another.
  assert.deepEqual(Def.build(season({ mark: 1 }), { base: "fantasy", seed: 7 }).world.facts, d.world.facts);
});

test("the made-up moments' rates come from the episodes through the mark", () => {
  const r = Def.ratesOf(season());
  // 18 + 17 + 16 cast-episodes; three tribe immunities and one reward.
  assert.equal(r.tribeImmunity, 3 / 51);
  assert.equal(r.rewardWin, 1 / 51);
  assert.deepEqual(Def.ratesOf(season({ mark: 0, real: [] })), {});
  assert.deepEqual(Def.ratesOf({ ...season({ mark: 0, real: [] }), rates: { rewardWin: 0.1 } }), { rewardWin: 0.1 });
});

test("a season that can't be previewed says why", () => {
  assert.throws(() => Def.build(season({ cast: cast.slice(0, 2) }), { base: "fantasy" }), (e) => e.code === "preview-season" && /no cast/.test(e.message));
  assert.throws(() => Def.build(season({ from: 3 }), { base: "fantasy" }), (e) => e.code === "preview-season" && /before the mark/.test(e.message));
  assert.throws(() => Def.build(season({ from: 11 }), { base: "fantasy" }), (e) => e.code === "preview-season" && /nothing left/.test(e.message));
  assert.throws(() => Def.build(season(), { base: "no-such-game" }), code("preview-game"));
});

test("the gallery's games build on the season, and the story's made-up nights name only people still in", () => {
  for (const base of ["fantasy", "sheet", "pool"]) {
    const d = Def.build(season(), { base, gameId: base, seed: 7 });
    assert.equal(d.games[0].id, base);
  }
  const s = R.open(Def.build(season(), { base: "fantasy", seed: 7 }));
  try {
    const res = Def.resultsFor(season())(s, 4);
    const named = [...res.events.map((x) => x.castawayId), ...res.scoringEvents.map((x) => x.castawayId)];
    assert.ok(named.length > 0);
    const out = new Set(s.snapshot().contexts.show.facts.flatMap((f) => f.data.events.map((x) => x.castawayId)));
    assert.ok(named.every((id) => !out.has(id)), "nobody already gone");
  } finally { s.dispose(); }
});

test("the server's half: the calendar fills a missing air time a week on, and the made-up season's seed is the person's, the season's and the mark's", () => {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { calendar, seedOf } = jiti("../src/lib/server/preview-season.ts");
  const at = (n) => new Date(EP1 + (n - 1) * WEEK).toISOString();
  const cal = calendar([{ number: 1, airAt: at(1) }, { number: 2, airAt: null }, { number: 3, airAt: at(3) }], 5, { number: 4, airs: at(4) });
  assert.deepEqual(cal.map((e) => e.airAt), [1, 2, 3, 4, 5].map(at));
  assert.equal(seedOf("u", "s", 3), seedOf("u", "s", 3));
  assert.notEqual(seedOf("u", "s", 3), seedOf("u", "s", 4));
  assert.notEqual(seedOf("u", "s", 3), seedOf("v", "s", 3));
});
