// Keeping up with a show (src/lib/server/keep-up.ts, db/migrations/0141): Live's "Seen it?" asks only about an episode that has
// ended past where you are, and not again after Not yet until a newer one ends; the where stepper's episodes say when each aired
// and give a title only as far as you've seen (a sport's always); an episode counts as ended once it has run its length. The
// auto mark's SQL is checked against the database by scripts/dev-test/check-keep-up.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { seenItAsk } = jiti("../src/lib/server/keep-up.ts");
const { latestAired, latestEnded, stepEpisodes } = jiti("../src/lib/server/schedule.ts");

test("Seen it?: only on Live, only past where you are", () => {
  assert.equal(seenItAsk({ keepUp: "ask", seen: 3, notYet: null }, 4), 4);
  assert.equal(seenItAsk({ keepUp: "ask", seen: 4, notYet: null }, 4), null);
  assert.equal(seenItAsk({ keepUp: "off", seen: 3, notYet: null }, 4), null);
  assert.equal(seenItAsk({ keepUp: "auto", seen: 3, notYet: null }, 4), null);
  // Behind by two: it asks about the latest (the card offers both, or Set where you are).
  assert.equal(seenItAsk({ keepUp: "ask", seen: 2, notYet: null }, 4), 4);
});

test("Seen it?: Not yet holds until a newer episode ends", () => {
  assert.equal(seenItAsk({ keepUp: "ask", seen: 3, notYet: 4 }, 4), null);
  assert.equal(seenItAsk({ keepUp: "ask", seen: 3, notYet: 4 }, 5), 5);
});

const schedule = (release = "weekly") => ({
  release,
  dropAt: null,
  airTz: "America/New_York",
  episodeCount: null,
  episodes: [
    { number: 1, airAt: "2026-10-23T00:00:00.000Z", runtimeMin: 180, title: "Game 1: Rays at Brewers", note: null },
    { number: 2, airAt: "2026-10-24T00:00:00.000Z", runtimeMin: null, title: "Game 2: Rays at Brewers", note: null },
    { number: 3, airAt: "2026-10-27T00:00:00.000Z", runtimeMin: 180, title: "Game 3: Brewers at Rays", note: null },
  ],
});

test("an episode has ended once it has run its length (an hour when nobody says); started is aired", () => {
  const during = new Date("2026-10-27T02:00:00.000Z");
  assert.equal(latestAired(schedule(), during), 3);
  assert.equal(latestEnded(schedule(), during), 2);
  assert.equal(latestEnded(schedule(), new Date("2026-10-27T03:00:00.000Z")), 3);
  assert.equal(latestEnded(schedule(), new Date("2026-10-24T00:59:00.000Z")), 1);
  // A streaming season's episodes are out as they drop.
  assert.equal(latestEnded(schedule("binge"), new Date("2026-10-27T00:00:00.000Z")), 3);
});

test("the stepper's episodes: aired ones, dates always, titles as far as you've seen unless it's a sport", () => {
  const eps = schedule().episodes;
  assert.deepEqual(
    stepEpisodes(eps, 2, 1, "competition").map((e) => [e.number, e.title, e.airAt]),
    [
      [1, "Game 1: Rays at Brewers", "2026-10-23T00:00:00.000Z"],
      [2, null, "2026-10-24T00:00:00.000Z"],
    ]
  );
  assert.deepEqual(
    stepEpisodes(eps, 3, 0, "sport").map((e) => e.title),
    ["Game 1: Rays at Brewers", "Game 2: Rays at Brewers", "Game 3: Brewers at Rays"]
  );
});
