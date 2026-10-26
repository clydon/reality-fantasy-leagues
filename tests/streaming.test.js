// Streaming on the couch, the pure half (docs/PLAN-new-design.md step 14 part 1; src/lib/game/streaming.ts): which seasons
// go on the rail, in the rail's order (yours in progress, new drops, planned nights, the couch's most watched, upcoming
// drops), what each chip's tag and who-line say, and that nobody's progress but your own is in it. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = jiti("../src/lib/game/streaming.ts");

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 26, 18).getTime();
const iso = (t) => new Date(t).toISOString();

const season = (over) => ({
  seasonId: over.seasonId,
  name: over.name ?? over.seasonId,
  seasonNumber: 1,
  artUrl: null,
  release: over.release ?? "binge",
  status: over.status ?? "completed",
  dropAt: over.dropAt === undefined ? iso(NOW - 30 * DAY) : over.dropAt,
  network: over.network ?? null,
  episodeCount: over.episodeCount ?? 8,
  latestAired: over.latestAired ?? 8,
  yours: over.yours ?? false,
  seen: over.seen ?? null,
  played: over.played ?? false,
});
const riley = { userId: "r", name: "riley" };
const jordan = { userId: "j", name: "jordan" };
const sam = { userId: "s", name: "sam" };

test("only seasons watched at your own pace: a drop, or a finished season nobody plays here", () => {
  assert.equal(S.ownPace({ release: "binge", status: "airing", played: true }), true);
  assert.equal(S.ownPace({ release: "weekly", status: "completed", played: false }), true);
  assert.equal(S.ownPace({ release: "weekly", status: "completed", played: true }), false, "a finished game season is the trophy shelf's");
  assert.equal(S.ownPace({ release: "weekly", status: "airing", played: false }), false, "a weekly season on the air is the guide's");
  const rail = S.railItems(
    [
      season({ seasonId: "drop", yours: true, seen: 2 }),
      season({ seasonId: "weekly", release: "weekly", status: "airing", yours: true, seen: 2 }),
      season({ seasonId: "played", release: "weekly", status: "completed", yours: true, seen: 3, played: true }),
      season({ seasonId: "wire", release: "weekly", status: "completed", dropAt: null, episodeCount: 13 }),
      season({ seasonId: "nobody", status: "completed" }),
    ],
    { streamers: (id) => (id === "wire" ? [jordan] : []), now: NOW }
  );
  assert.deepEqual(rail.map((x) => x.seasonId), ["drop", "wire"], "yours, or someone on the couch streams it");
});

test("the rail's order: yours in progress, new drops, nights, the couch's most watched, upcoming drops", () => {
  const shows = [
    season({ seasonId: "upcoming", status: "upcoming", dropAt: iso(NOW + 2 * DAY), latestAired: 0, yours: true, seen: 0 }),
    season({ seasonId: "later", status: "upcoming", dropAt: iso(NOW + 5 * DAY), latestAired: 0 }),
    season({ seasonId: "one", network: "Hulu" }),
    season({ seasonId: "planned" }),
    season({ seasonId: "fresh", dropAt: iso(NOW - 2 * DAY), network: "Netflix" }),
    season({ seasonId: "fresher", dropAt: iso(NOW - 1 * DAY) }),
    season({ seasonId: "three" }),
    season({ seasonId: "mine", yours: true, seen: 3, episodeCount: 10, latestAired: 10 }),
  ];
  const streamers = { upcoming: [riley], later: [sam], one: [jordan], planned: [riley], fresh: [sam], fresher: [jordan], three: [riley, jordan, sam], mine: [riley] };
  const plans = [{ id: "p1", seasonId: "planned", at: NOW + DAY, episode: 2 }];
  const rail = S.railItems(shows, { streamers: (id) => streamers[id] ?? [], plans, now: NOW });
  assert.deepEqual(rail.map((x) => x.seasonId), ["mine", "fresher", "fresh", "planned", "three", "one", "upcoming", "later"]);
  assert.deepEqual(rail.map((x) => x.rank), [0, 1, 1, 2, 3, 3, 4, 4]);
  const at = (id) => rail.find((x) => x.seasonId === id);
  assert.deepEqual(at("mine").tag, { kind: "continue", episode: 4 });
  assert.equal(at("mine").progress, 0.3, "your own progress");
  assert.deepEqual(at("fresh").tag, { kind: "new", episodes: 8 });
  assert.deepEqual(at("planned").tag, { kind: "plan", at: NOW + DAY, episode: 2 });
  assert.deepEqual(at("one").tag, { kind: "service", text: "Hulu" });
  assert.deepEqual(at("upcoming").tag, { kind: "drops", at: NOW + 2 * DAY });
  assert.equal(at("upcoming").preDrop, true);
  assert.equal(at("upcoming").progress, null, "nothing to be in before the drop");
  assert.deepEqual(at("upcoming").who, { kind: "waiting", count: 1 });
  assert.equal(S.whoLine(at("three").who), "riley + 2");
  assert.equal(S.whoLine(at("one").who), "jordan");
});

test("a finished one of yours: 'You finished it' while the couch streams it, gone when nobody does", () => {
  const shows = [
    season({ seasonId: "shared", yours: true, seen: 8 }),
    season({ seasonId: "alone", yours: true, seen: 8 }),
    season({ seasonId: "alone-new", yours: true, seen: 8, dropAt: iso(NOW - DAY) }),
    season({ seasonId: "not-started", yours: true, seen: 0 }),
  ];
  const rail = S.railItems(shows, { streamers: (id) => (id === "shared" ? [riley] : []), now: NOW });
  assert.deepEqual(rail.map((x) => x.seasonId).sort(), ["alone-new", "not-started", "shared"]);
  assert.deepEqual(rail.find((x) => x.seasonId === "shared").tag, { kind: "finished" });
  assert.deepEqual(rail.find((x) => x.seasonId === "not-started").who, { kind: "you" });
  assert.equal(S.whoLine({ kind: "you" }), "Just you so far");
  assert.deepEqual(rail.find((x) => x.seasonId === "not-started").tag, { kind: "service", text: "Streaming" });
});

test("spoiler protection off (an unknown mark) is never 'in progress' or 'finished'", () => {
  const rail = S.railItems([season({ seasonId: "x", yours: true, seen: Number.POSITIVE_INFINITY })], { streamers: () => [riley], now: NOW });
  assert.equal(rail[0].rank, 3);
  assert.equal(rail[0].progress, null);
  assert.equal(rail[0].tag.kind, "service");
});

test("who's on now leads the faces, and only when they stream it openly on the couch", () => {
  const shows = [season({ seasonId: "x", yours: true, seen: 2 }), season({ seasonId: "y" })];
  const onNow = [
    { userId: "j", name: "jordan", seasonId: "x" },
    { userId: "s", name: "sam", seasonId: "x" },
    { userId: "z", name: "zed", seasonId: "y" },
  ];
  const rail = S.railItems(shows, { streamers: (id) => (id === "x" ? [riley, jordan, sam] : [riley]), onNow, now: NOW });
  const x = rail.find((i) => i.seasonId === "x");
  assert.deepEqual(x.who, { kind: "on", name: "jordan", more: 1 });
  assert.equal(S.whoLine(x.who), "jordan is on now · +1");
  assert.deepEqual(x.faces.map((f) => f.name), ["jordan", "sam", "riley"]);
  assert.deepEqual(rail.find((i) => i.seasonId === "y").who, { kind: "names", names: ["riley"] }, "someone not streaming it openly here isn't named");
});

test("a drop is new for a week, then the couch's", () => {
  const at = (ago) => S.railItems([season({ seasonId: "x", dropAt: iso(NOW - ago) })], { streamers: () => [riley], now: NOW })[0];
  assert.equal(at(6 * DAY).rank, 1);
  assert.equal(at(8 * DAY).rank, 3);
  assert.equal(at(8 * DAY).tag.kind, "service");
});

test("each season once, even when it's both yours and the couch's", () => {
  const rail = S.railItems([season({ seasonId: "x", yours: true, seen: 1 }), season({ seasonId: "x" })], { streamers: () => [riley], now: NOW });
  assert.equal(rail.length, 1);
  assert.equal(rail[0].yours, true);
});
