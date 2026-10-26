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

test("seven local days from today, each from its own midnight, across a clock change", () => {
  const week = G.guideWeek([], NOW);
  assert.equal(week.length, 7);
  week.forEach((d, i) => {
    const start = new Date(d.start);
    assert.equal(d.offset, i);
    assert.equal(start.getDate(), 26 + i > 31 ? 26 + i - 31 : 26 + i, `day ${i}'s date`);
    assert.equal(start.getHours(), 0, `day ${i} starts at midnight`);
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

test("a Sunday after the clock change is still its own day (Nov 1, 2026)", () => {
  const week = G.guideWeek([show({ seasonId: "sun", week: [{ number: 2, airAt: iso(32, 0, 30), runtimeMin: 30 }, { number: 1, airAt: iso(31, 23, 30), runtimeMin: 30 }] })], NOW);
  // Oct 31 23:30 is Saturday (offset 5); Nov 1 00:30 is Sunday (offset 6).
  assert.equal(week[5].slots.length, 1);
  assert.equal(week[5].slots[0].numbers[0], 1);
  assert.equal(week[6].slots.length, 1);
  assert.equal(week[6].slots[0].numbers[0], 2);
});
