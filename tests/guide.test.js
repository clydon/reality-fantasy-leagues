// The TV guide, the pure half (docs/PLAN-new-design.md step 11 part 1; src/lib/game/guide.ts): your shows' and the couch's
// episodes laid out over seven days in the viewer's own time zone, the Now line, On now, Same time, a streaming drop as one
// card, the due dot, Next up and the episode line. Times are built with local constructors, so it holds in any time zone
// (the week crosses the US clock change on Nov 1, 2026). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const G = jiti("../src/lib/game/guide.ts");

// Monday Oct 26, 2026, 6 PM local.
const local = (d, h, m = 0) => new Date(2026, 9, d, h, m);
const NOW = local(26, 18).getTime();
const iso = (d, h, m = 0) => local(d, h, m).toISOString();

const show = (over) => ({
  seasonId: over.seasonId,
  name: over.name ?? over.seasonId,
  seasonNumber: over.seasonNumber ?? 1,
  artUrl: null,
  release: over.release ?? "weekly",
  week: over.week ?? [],
  tie: over.tie ?? "plays",
  faces: over.faces ?? [],
  dueEpisode: over.dueEpisode ?? null,
});

test("seven local days from today, each from 3 AM (TV listings' day), across a clock change", () => {
  const week = G.guideWeek([], NOW);
  assert.equal(week.length, 7);
  week.forEach((d, i) => {
    const start = new Date(d.start);
    assert.equal(d.offset, i);
    assert.equal(start.getDate(), 26 + i > 31 ? 26 + i - 31 : 26 + i, `day ${i}'s date`);
    assert.equal(start.getHours(), 3, `day ${i} starts at 3 AM`);
  });
  assert.ok(G.guideEmpty(week));
  assert.equal(week[0].nowAt, 0, "an empty today still has a place for the Now line");
});

test("today: what's finished sits before the Now line, what's on now after it, On now while it airs", () => {
  const week = G.guideWeek(
    [
      show({ seasonId: "early", week: [{ number: 3, airAt: iso(26, 9), runtimeMin: 60 }] }),
      show({ seasonId: "live", week: [{ number: 5, airAt: iso(26, 17, 30), runtimeMin: 60 }] }),
      show({ seasonId: "later", week: [{ number: 2, airAt: iso(26, 21), runtimeMin: null }] }),
    ],
    NOW
  );
  const today = week[0];
  assert.deepEqual(today.slots.map((s) => s.seasonId), ["early", "live", "later"]);
  assert.equal(today.nowAt, 1, "the Now line goes before the one on now");
  assert.equal(today.slots[1].live, true);
  assert.equal(today.slots[0].live, false);
  assert.equal(today.slots[2].endsAt - today.slots[2].at, 60 * 60_000, "no runtime: an hour");
  // Once everything today has finished, the Now line goes after them all.
  assert.equal(G.guideWeek([show({ seasonId: "early", week: [{ number: 3, airAt: iso(26, 9), runtimeMin: 60 }] })], NOW)[0].nowAt, 1);
  assert.equal(week[1].nowAt, null, "only today has a Now line");
});

test("Same time: shows starting together are one slot, yours first; a double episode is one card", () => {
  const week = G.guideWeek(
    [
      show({ seasonId: "couchy", tie: "couch", week: [{ number: 7, airAt: iso(27, 21), runtimeMin: 60 }] }),
      show({ seasonId: "watchy", tie: "watches", week: [{ number: 4, airAt: iso(27, 21), runtimeMin: 60 }] }),
      show({ seasonId: "mine", week: [{ number: 5, airAt: iso(27, 21), runtimeMin: 60 }, { number: 6, airAt: iso(27, 21), runtimeMin: 60 }] }),
      show({ seasonId: "solo", week: [{ number: 1, airAt: iso(27, 20), runtimeMin: 60 }] }),
    ],
    NOW
  );
  const tue = week[1];
  assert.equal(tue.slots.length, 2);
  assert.equal(tue.slots[0].seasonId, "solo");
  assert.ok(Array.isArray(tue.slots[1]));
  assert.deepEqual(tue.slots[1].map((c) => c.seasonId), ["mine", "watchy", "couchy"]);
  const mine = tue.slots[1][0];
  assert.deepEqual(mine.numbers, [5, 6]);
  assert.equal(mine.drop, null, "a weekly show's double episode isn't a drop");
  assert.equal(G.episodeLine(mine), "S1 · Ep 5–6");
});

test("a streaming season dropping every episode at once is one card: All 8 drop", () => {
  const drop = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, airAt: iso(28, 3), runtimeMin: 50 }));
  const week = G.guideWeek([show({ seasonId: "stream", release: "binge", tie: "watches", week: drop })], NOW);
  const wed = week[2];
  assert.equal(wed.slots.length, 1);
  assert.equal(wed.slots[0].drop, 8);
  assert.equal(wed.slots[0].live, false, "a drop is never On now");
  assert.equal(G.episodeLine(wed.slots[0]), "S1 · 8 episodes");
});

test("a streaming season is never On now, not even a single episode out minutes ago (step 14)", () => {
  const one = [{ number: 1, airAt: iso(26, 17, 50), runtimeMin: 50 }];
  const [today] = G.guideWeek([show({ seasonId: "special", release: "binge", tie: "watches", week: one })], NOW);
  assert.equal(today.slots.length, 1);
  assert.equal(today.slots[0].drop, null, "one episode isn't a drop of many");
  assert.equal(today.slots[0].live, false);
  const [weekly] = G.guideWeek([show({ seasonId: "weekly", week: one })], NOW);
  assert.equal(weekly.slots[0].live, true, "the same episode on a weekly show is on now");
});

test("the due dot is on the episode a move is for; nothing past the week; Next up when today is empty", () => {
  const week = G.guideWeek(
    [
      show({ seasonId: "surv", dueEpisode: 6, week: [{ number: 6, airAt: iso(28, 20), runtimeMin: 90 }, { number: 7, airAt: local(26 + 9, 20).toISOString(), runtimeMin: 90 }] }),
    ],
    NOW
  );
  const cards = week.flatMap((d) => d.slots.flat());
  assert.equal(cards.length, 1, "Episode 7, nine days out, isn't on the guide");
  assert.equal(cards[0].due, true);
  assert.equal(week[0].slots.length, 0);
  assert.equal(G.nextUpAfter(week, 0).seasonId, "surv");
  assert.equal(G.nextUpAfter(week, 2), null);
  assert.equal(G.episodeLine({ seasonNumber: null, numbers: [3], drop: null }), "Ep 3");
});

test("after midnight is the night before's; a Sunday after the clock change is still its own day (Nov 1, 2026)", () => {
  const week = G.guideWeek(
    [show({ seasonId: "sun", week: [{ number: 3, airAt: iso(32, 20), runtimeMin: 30 }, { number: 2, airAt: iso(32, 0, 30), runtimeMin: 30 }, { number: 1, airAt: iso(31, 23, 30), runtimeMin: 30 }] })],
    NOW
  );
  // Oct 31 23:30 and Nov 1 00:30 are Saturday night (offset 5); Nov 1 at 8 PM is Sunday (offset 6), which starts at 3 AM.
  assert.deepEqual(week[5].slots.map((s) => s.numbers[0]), [1, 2]);
  assert.deepEqual(week[6].slots.map((s) => s.numbers[0]), [3]);
  assert.equal(new Date(week[6].start).getDate(), 1);
  assert.equal(new Date(week[6].start).getHours(), 3);
});

test("at 1:30 AM it's still last night: today is the day before's, its late show on it", () => {
  const late = local(27, 1, 30).getTime();
  const week = G.guideWeek([show({ seasonId: "talk", week: [{ number: 9, airAt: iso(27, 0, 35), runtimeMin: 60 }, { number: 10, airAt: iso(28, 0, 35), runtimeMin: 60 }] })], late);
  assert.equal(new Date(week[0].start).getDate(), 26, "today is Monday's TV day");
  assert.equal(week[0].slots[0].numbers[0], 9);
  assert.equal(week[0].slots[0].live, true, "on now");
  assert.equal(week[1].slots[0].numbers[0], 10, "Tuesday night's is tomorrow's");
  assert.equal(G.eveningAt(late), true, "still the evening (Tonight)");
  assert.equal(G.eveningAt(local(27, 9)), false);
});

const plan = (over) => ({
  id: over.id,
  seasonId: over.seasonId,
  name: over.name ?? over.seasonId,
  seasonNumber: 1,
  artUrl: null,
  episode: over.episode,
  how: over.how ?? "live",
  at: over.at,
  endsAt: over.at + 60 * 60_000,
  faces: over.faces ?? [{ userId: "u1", name: "riley" }],
  you: over.you ?? "invited",
});

test("planned nights (step 11 part 3): one for the airing tags its card; a shared start, or a show not on the guide, is a card of its own", () => {
  const shows = [
    show({ seasonId: "surv", week: [{ number: 6, airAt: iso(29, 20), runtimeMin: 90 }] }),
    show({ seasonId: "late", tie: "watches", week: [{ number: 31, airAt: iso(26, 23, 35), runtimeMin: 60 }] }),
  ];
  const week = G.guideWeek(shows, NOW, undefined, [
    plan({ id: "p1", seasonId: "surv", episode: 6, at: local(29, 20).getTime() }),
    plan({ id: "p2", seasonId: "late", episode: 30, how: "start", at: local(27, 21).getTime(), you: "host" }),
    plan({ id: "p3", seasonId: "elsewhere", name: "Not here", episode: 2, how: "start", at: local(27, 21).getTime(), you: null }),
  ]);
  const thu = week[3].slots[0];
  assert.equal(thu.key, "surv:6", "the airing keeps its own card");
  assert.equal(thu.plan.id, "p1", "and carries the plan");
  const tue = week[1].slots;
  assert.equal(tue.length, 1, "two starting at 9 PM Tuesday: one Same time slot");
  assert.ok(Array.isArray(tue[0]));
  const keys = tue[0].map((c) => c.key);
  assert.deepEqual(keys, ["plan:p2", "plan:p3"], "yours (a show you watch) before the couch's");
  assert.equal(tue[0][0].tie, "watches", "a plan card is tied as its show is");
  assert.equal(tue[0][1].tie, "couch", "a show not on the guide: the couch's");
  assert.deepEqual(tue[0][0].numbers, [30]);
  assert.equal(tue[0][0].plan.how, "start");
  // The Late Show's own airing tonight isn't tagged: the plan is for another episode at another time.
  assert.equal(week[0].slots[0].plan, null);
});

test("a plan on now is live; one a quarter hour off its airing doesn't tag it", () => {
  const shows = [show({ seasonId: "surv", week: [{ number: 6, airAt: iso(26, 17, 30), runtimeMin: 90 }] })];
  const week = G.guideWeek(shows, NOW, undefined, [plan({ id: "p", seasonId: "surv", episode: 6, how: "start", at: local(26, 17, 45).getTime() })]);
  const cards = week[0].slots.flatMap((s) => (Array.isArray(s) ? s : [s]));
  assert.deepEqual(cards.map((c) => c.key), ["surv:6", "plan:p"]);
  assert.equal(cards[0].plan, null);
  assert.equal(cards[1].live, true, "started at 5:45, on now at 6");
});
