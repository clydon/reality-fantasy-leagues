// TV listings, the pure half (docs/PLAN-new-design.md step 10 part 1; src/lib/game/listing.ts): a TVmaze answer as Add a
// show's suggestion, the season "add this show" means, its status and episodes, the kind of show guessed from its type, and
// whether a show already here is the same show. Made-up listings, so no network or database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const L = jiti("../src/lib/game/listing.ts");

const NOW = new Date("2026-10-25T18:00:00Z");

test("a listing as a suggestion: where it airs, its year, its art, its kind", () => {
  const hit = L.hitOf({
    id: 42289, name: "Love Island", type: "Reality", genres: ["Romance"], status: "Running", premiered: "2019-07-09",
    network: null, webChannel: { name: "Peacock", country: { code: "US", timezone: "America/New_York" } },
    image: { medium: "m.jpg", original: "o.jpg" }, url: "https://www.tvmaze.com/shows/42289/love-island",
  });
  assert.deepEqual(hit, { tvmazeId: 42289, name: "Love Island", kind: "competition", type: "Reality", network: "Peacock", country: "US", year: 2019, running: true, art: "m.jpg", thumb: "m.jpg", url: "https://www.tvmaze.com/shows/42289/love-island" });
  assert.equal(L.hitOf({ id: 1, name: "X", status: "Ended" }).running, false);
  assert.equal(L.zoneOf({ id: 1, name: "X", network: { name: "ITV2", country: { code: "GB", timezone: "Europe/London" } } }), "Europe/London");
});

test("the kind of show from its listing's type (reality is taken as a competition until Make it a game asks)", () => {
  assert.equal(L.kindOf("Reality"), "competition");
  assert.equal(L.kindOf("Game Show"), "competition");
  assert.equal(L.kindOf("Scripted"), "series");
  assert.equal(L.kindOf("Animation"), "series");
  assert.equal(L.kindOf("Documentary"), "series");
  assert.equal(L.kindOf("Talk Show"), "talk");
  assert.equal(L.kindOf("Variety"), "talk");
  assert.equal(L.kindOf("Award Show"), "talk");
  assert.equal(L.kindOf("Sports"), "sport");
  assert.equal(L.kindOf("Reality", ["Sports"]), "sport");
  assert.equal(L.kindOf(null), "competition");
});

test("the season someone means: on now, else the next, else the latest, else the first listed", () => {
  const s = (number, premiereDate, endDate) => ({ id: number, number, premiereDate, endDate });
  assert.equal(L.pickSeason([s(7, "2025-06-03", "2025-08-25"), s(8, "2026-10-01", "2026-12-20"), s(9, null, null)], NOW).number, 8);
  assert.equal(L.pickSeason([s(7, "2025-06-03", "2025-08-25"), s(8, "2026-11-04", null), s(9, "2027-06-01", null)], NOW).number, 8);
  assert.equal(L.pickSeason([s(6, "2024-06-11", "2024-08-19"), s(7, "2025-06-03", "2025-08-25")], NOW).number, 7);
  assert.equal(L.pickSeason([s(2, null, null), s(1, null, null)], NOW).number, 1);
  assert.equal(L.pickSeason([], NOW), null);
  // Two on at once (a spin-off season overlapping): the later one.
  assert.equal(L.pickSeason([s(3, "2026-09-01", null), s(4, "2026-10-20", null)], NOW).number, 4);
  assert.equal(L.seasonStatus(s(1, "2026-10-25", null), NOW), "airing");
  assert.equal(L.seasonStatus(s(1, "2026-10-26", null), NOW), "upcoming");
  assert.equal(L.seasonStatus(s(1, null, null), NOW), "upcoming");
  assert.equal(L.seasonStatus(s(1, "2026-01-01", "2026-10-24"), NOW), "completed");
});

test("a season's episodes: regular ones in order, each with when it airs; specials left out", () => {
  const eps = L.episodesOf([
    { season: 1, number: 2, type: "regular", name: "Two", airstamp: "2026-10-20T01:00:00+00:00", runtime: 60 },
    { season: 1, number: 1, type: "regular", name: "  One  ", airstamp: "2026-10-13T01:00:00+00:00", runtime: 0 },
    { season: 1, number: null, type: "significant_special", name: "Reunion", airstamp: "2026-12-01T01:00:00+00:00", runtime: 60 },
    { season: 1, number: 3, type: "regular", name: "", airstamp: "2026-10-27T01:00:00+00:00", runtime: 90 },
  ]);
  assert.deepEqual(eps.map((e) => [e.number, e.title, e.runtimeMin]), [[1, "One", null], [2, "Two", 60], [3, null, 90]]);
  assert.equal(eps[0].airAt, "2026-10-13T01:00:00.000Z");
  assert.equal(L.airedOf(eps, NOW), 2);
  assert.equal(L.airedOf([], NOW), 0);
});

test("released all at once is a streaming drop; otherwise weekly; the air time from the schedule", () => {
  const day = (n) => ({ season: 1, number: n, type: "regular", airdate: "2026-10-23", airstamp: "2026-10-23T07:00:00+00:00" });
  assert.deepEqual(L.releaseOf([day(1), day(2), day(3)]), { release: "binge", dropAt: "2026-10-23T07:00:00.000Z" });
  assert.deepEqual(L.releaseOf([day(1), day(2)]), { release: "weekly", dropAt: null });
  assert.deepEqual(L.releaseOf([day(1), { ...day(2), airdate: "2026-10-30" }, day(3)]), { release: "weekly", dropAt: null });
  assert.equal(L.airTimeOf({ id: 1, name: "X", schedule: { time: "9:00" } }), "09:00");
  assert.equal(L.airTimeOf({ id: 1, name: "X", schedule: { time: "" } }), null);
});

test("the same show: same name, same country (a name that doesn't say is American)", () => {
  const us = (name) => ({ name, country: "US" });
  const gb = (name) => ({ name, country: "GB" });
  assert.equal(L.sameShow("Survivor", us("Survivor")), true);
  assert.equal(L.sameShow("Survivor", gb("Survivor")), false);
  assert.equal(L.sameShow("The Traitors (US)", us("The Traitors")), true);
  assert.equal(L.sameShow("The Traitors (US)", gb("The Traitors")), false);
  assert.equal(L.sameShow("Love Island USA", us("Love Island")), true);
  assert.equal(L.sameShow("Love Island USA", gb("Love Island")), false);
  assert.equal(L.sameShow("Big Brother US", us("Big Brother")), true);
  assert.equal(L.sameShow("The Amazing Race (American edition)", us("The Amazing Race")), true);
  assert.equal(L.sameShow("RuPaul's Drag Race (US flagship)", us("RuPaul's Drag Race")), true);
  assert.equal(L.sameShow("Love Island", { name: "Love Island", country: null }), true);
  assert.equal(L.sameShow("Survivor", us("Australian Survivor")), false);
  assert.equal(L.sameShow("Dancing with the Stars", us("Dancing With The Stars")), true);
  assert.deepEqual(L.nameParts("Big Brother UK"), { key: "bigbrother", country: "GB" });
  assert.deepEqual(L.nameParts("US"), { key: "us", country: null });
});

test("a new show's slug", () => {
  assert.equal(L.slugOf("RuPaul's Drag Race"), "rupaul-s-drag-race");
  assert.equal(L.slugOf("Law & Order: SVU"), "law-and-order-svu");
  assert.equal(L.slugOf("!!!"), "show");
});
