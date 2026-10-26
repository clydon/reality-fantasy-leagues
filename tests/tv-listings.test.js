// All of TV, the pure half (docs/PLAN-new-design.md step 11 part 2; src/lib/game/tv-listings.ts): what TVmaze's schedules
// become in tv_listings (the evening and drops, in English on a US or worldwide service, never the news; one row per
// episode), the week as the guide reads it, and Also on (the evening by the guide's own days, less what you've excluded,
// the most watched few). Times are built with local constructors, so it holds in any time zone. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const T = jiti("../src/lib/game/tv-listings.ts");
const G = jiti("../src/lib/game/guide.ts");

const US = { name: "ABC", country: { code: "US", timezone: "America/New_York" } };
const show = (id, name, over = {}) => ({ id, name, type: "Reality", language: "English", weight: 50, network: US, webChannel: null, image: { medium: `https://img/${id}.jpg` }, ...over });
const ep = (id, s, over = {}) => ({ id, season: 3, number: 4, type: "regular", name: "A title nobody should see", airdate: "2026-10-27", airtime: "20:00", airstamp: "2026-10-28T00:00:00+00:00", runtime: 60, show: s, ...over });
const web = (id, s, over = {}) => {
  const e = ep(id, null, over);
  delete e.show;
  return { ...e, _embedded: { show: s } };
};

test("Eastern days: the networks' date, and the eight the job reads", () => {
  // 02:00 UTC on Oct 27 is still Oct 26 in the East.
  assert.equal(T.easternDay(new Date("2026-10-27T02:00:00Z")), "2026-10-26");
  assert.equal(T.easternDay(new Date("2026-10-27T05:00:00Z")), "2026-10-27");
  assert.equal(T.easternDay(new Date("2026-10-27T05:00:00Z"), -1), "2026-10-26");
  const days = T.listingDays(new Date("2026-10-29T15:00:00Z"));
  assert.deepEqual(days, ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"], "across the clock change");
});

test("the evening is 5 PM to 3 AM where it airs", () => {
  assert.equal(T.eveningTime("17:00"), true);
  assert.equal(T.eveningTime("23:35"), true);
  assert.equal(T.eveningTime("00:35"), true);
  assert.equal(T.eveningTime("02:59"), true);
  assert.equal(T.eveningTime("03:00"), false);
  assert.equal(T.eveningTime("11:00"), false);
  assert.equal(T.eveningTime("16:59"), false);
  assert.equal(T.eveningTime(""), false);
  assert.equal(T.eveningTime(null), false);
});

test("a day's schedules as rows: the evening and drops, in English on a US or worldwide service, never the news", () => {
  const us = [
    ep(1, show(10, "Prime Time Show", { weight: 99 }), { airtime: "20:00" }),
    ep(2, show(11, "Morning Show", { type: "Talk Show" }), { airtime: "07:00", airstamp: "2026-10-27T11:00:00+00:00" }),
    ep(3, show(12, "The Night News", { type: "News" }), { airtime: "23:00" }),
    ep(4, show(13, "Late Talk", { type: "Talk Show", weight: 98 }), { airtime: "00:35", airstamp: "2026-10-27T04:35:00+00:00", season: 2026, number: 96 }),
    ep(5, show(14, "Reunion Night"), { number: null, type: "significant_special" }),
    ep(6, show(15, "Same Episode Both", { weight: 80 }), { airtime: "21:00" }),
  ];
  const netflix = { name: "Netflix", country: null };
  const stream = [
    web(20, show(30, "Global Drop", { network: null, webChannel: netflix, type: "Documentary", weight: 93 }), { airtime: "", runtime: null, number: 1 }),
    web(21, show(30, "Global Drop", { network: null, webChannel: netflix, type: "Documentary", weight: 93 }), { airtime: "", runtime: null, number: 2 }),
    web(22, show(31, "Soap Abroad", { network: null, webChannel: { name: "BBC iPlayer", country: { code: "GB" } }, type: "Scripted" }), { airtime: "" }),
    web(23, show(32, "Foreign Drama", { network: null, webChannel: netflix, language: "Korean", type: "Scripted" }), { airtime: "" }),
    web(24, show(33, "Stream News", { network: null, webChannel: { name: "NBC.com", country: { code: "US" } }, type: "News" }), { airtime: "" }),
    web(25, show(34, "US Streamer", { network: null, webChannel: { name: "Hulu", country: { code: "US" } }, type: "Scripted", averageRuntime: 45 }), { airtime: "", runtime: null }),
    web(6, show(15, "Same Episode Both", { network: null, webChannel: { name: "Disney+", country: null } }), { airtime: "20:00" }),
    web(26, show(35, "Live Stream Sport", { network: null, webChannel: { name: "Peacock", country: { code: "US" } }, type: "Sports" }), { airtime: "11:00", airstamp: "2026-10-27T15:00:00+00:00" }),
  ];
  const { rows, shows } = T.scheduleRows("2026-10-27", us, stream);
  const byId = new Map(rows.map((r) => [r.episodeId, r]));
  assert.deepEqual([...byId.keys()].sort((a, b) => a - b), [1, 4, 5, 6, 20, 21, 25], "evening, late night, specials, drops; never daytime, news, abroad or another language");
  assert.equal(byId.get(6).network, "ABC", "an episode on a network and its streaming service is one row: the network's");
  assert.equal(byId.get(1).weight, 99);
  assert.equal(byId.get(1).artUrl, "https://img/10.jpg");
  assert.equal(byId.get(1).airAt, "2026-10-28T00:00:00.000Z");
  assert.equal(byId.get(1).binge, false);
  assert.equal(byId.get(20).binge, true, "streaming with no air time: a drop");
  assert.equal(byId.get(20).network, "Netflix");
  assert.equal(byId.get(20).country, null);
  assert.equal(byId.get(5).number, null, "a special has no number");
  assert.equal(byId.get(25).runtimeMin, 45, "no runtime: the show's usual");
  assert.ok(rows.every((r) => !("title" in r) && !JSON.stringify(r).includes("nobody should see")), "never an episode's title");
  const names = shows.map((s) => s.name).sort();
  assert.ok(names.includes("Morning Show") && names.includes("Live Stream Sport"), "every show of the day for linking by name (daytime too)");
  assert.ok(!names.includes("The Night News") && !names.includes("Stream News") && !names.includes("Soap Abroad") && !names.includes("Foreign Drama"), "but never the news, or what isn't watchable here");
  assert.equal(shows.find((s) => s.name === "Prime Time Show").country, "US");
});

test("the week: a show's episodes starting together are one airing, in time order", () => {
  const row = (over) => ({ tvmazeId: 1, name: "A", network: "X", type: "Reality", artUrl: null, weight: 10, airAt: "2026-10-28T00:00:00.000Z", runtimeMin: 60, season: 1, number: 1, binge: false, ...over });
  const week = T.weekListings([
    row({ tvmazeId: 2, name: "Drop", binge: true, number: 2, airAt: "2026-10-27T12:00:00.000Z", runtimeMin: null }),
    row({ tvmazeId: 2, name: "Drop", binge: true, number: 1, airAt: "2026-10-27T12:00:00.000Z", runtimeMin: null }),
    row({ tvmazeId: 1, number: 5 }),
    row({ tvmazeId: 3, name: "Late", number: 9, airAt: "2026-10-28T03:35:00.000Z" }),
  ]);
  assert.deepEqual(week.map((l) => `${l.name}:${l.numbers.join("+")}`), ["Drop:1+2", "A:5", "Late:9"]);
  assert.equal(week[0].runtimeMin, null);
});

// Monday Oct 26, 2026, 6 PM local.
const local = (d, h, m = 0) => new Date(2026, 9, d, h, m);
const NOW = local(26, 18).getTime();
const L = (tvmazeId, at, over = {}) => ({ tvmazeId, name: `Show ${tvmazeId}`, network: "ABC", country: "US", type: "Reality", art: null, weight: 50, airAt: at.toISOString(), runtimeMin: 60, season: 2, numbers: [1], binge: false, ...over });

test("Also on: each guide day's evening, less what's excluded; today without what's over; the most watched few in time order", () => {
  const week = G.guideWeek([], NOW);
  const listings = [
    L(1, local(26, 17, 0), { weight: 90 }), // today, over by 6 PM
    L(2, local(26, 20), { weight: 40 }),
    L(3, local(26, 21), { weight: 95 }),
    L(4, local(26, 22), { weight: 70 }),
    L(5, local(26, 23), { weight: 60 }),
    L(6, local(27, 0, 35), { weight: 99 }), // after midnight: still today's evening
    L(7, local(26, 12), { weight: 100 }), // daytime: never
    L(8, local(26, 9), { binge: true, numbers: [1, 2, 3], network: "Netflix", weight: 30 }), // a drop: all day
    L(9, local(27, 20), { weight: 10 }), // tomorrow
    L(10, local(26, 21, 30), { weight: 99 }), // excluded (yours)
  ];
  const days = T.alsoOn(listings, week, { ids: new Set([10]), names: [] }, NOW);
  assert.equal(days.length, 7);
  const today = days[0];
  assert.deepEqual(today.all.map((l) => l.tvmazeId), [8, 2, 3, 4, 5, 6], "drops first, then by time; not what's over, daytime or yours");
  assert.deepEqual(today.few.map((l) => l.tvmazeId), [3, 4, 6], "the three most watched, in time order");
  assert.deepEqual(days[1].all.map((l) => l.tvmazeId), [9]);
  assert.equal(days[2].all.length, 0);
  // Later in the evening the finished ones go.
  const later = T.alsoOn(listings, week, { ids: new Set(), names: [] }, local(26, 23, 30).getTime())[0];
  assert.deepEqual(later.all.map((l) => l.tvmazeId), [8, 5, 6], "at 11:30 PM: the drop, what's still on, the late show");
  assert.equal(T.alsoOn(listings, week, { ids: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), names: [] }, NOW)[0].all.length, 0, "everything excluded: nothing");
  // A show here without a listing yet is left out by name (an American one: not the same name from abroad).
  const named = T.alsoOn([L(11, local(26, 20), { name: "The Bake Off" }), L(12, local(26, 21), { name: "The Bake Off", country: "GB" })], week, { ids: new Set(), names: ["Bake Off (US)"] }, NOW)[0];
  assert.deepEqual(named.all.map((l) => l.tvmazeId), [12], "by name: the American one left out, the British one stays");
});

test("Also on leaves out daily streaming shows; a whole season's drop and a weekly streaming show stay", () => {
  const week = G.guideWeek([], NOW);
  const stream = { binge: true, network: "Peacock", type: "Scripted" };
  const listings = [
    // A streaming soap: an episode each weekday, the most watched of all.
    ...[26, 27, 28, 29, 30].map((d, i) => L(20, local(d, 3), { ...stream, numbers: [100 + i], weight: 99 })),
    // A twice-weekly streaming show: Monday and Thursday (three days of a nine-day week at most).
    ...[26, 29].map((d, i) => L(21, local(d, 3), { ...stream, numbers: [4 + i], weight: 80 })),
    // A weekly one, and a season dropped whole.
    L(22, local(27, 3), { ...stream, numbers: [6], weight: 70 }),
    L(23, local(28, 3), { ...stream, numbers: [1, 2, 3, 4, 5, 6, 7, 8], network: "Netflix", weight: 60 }),
    L(24, local(26, 20), { weight: 50 }),
  ];
  assert.deepEqual([...T.dailyStreaming(listings)], [20], "only the soap is daily");
  assert.equal(T.dailyStreaming(listings.filter((l) => l.tvmazeId !== 20 || Date.parse(l.airAt) < local(29, 0).getTime())).size, 0, "three days of it: not yet");
  const days = T.alsoOn(listings, week, { ids: new Set(), names: [] }, NOW);
  const ids = (d) => d.all.map((l) => l.tvmazeId);
  assert.deepEqual(ids(days[0]), [21, 24], "today: the twice-weekly show and the evening's, not the soap");
  assert.deepEqual(ids(days[1]), [22], "tomorrow: the weekly streaming show");
  assert.deepEqual(ids(days[2]), [23], "the drop stays as its drop day");
  assert.ok(days.every((d) => !d.few.some((l) => l.tvmazeId === 20)), "the soap is never among the few");
  // A daily show that drops a batch at once: that day's batch stays.
  const batch = [...listings, L(20, local(31, 3), { ...stream, numbers: [105, 106, 107], weight: 99 })];
  assert.deepEqual(T.alsoOn(batch, week, { ids: new Set(), names: [] }, NOW)[5].all.map((l) => l.tvmazeId), [20]);
});

test("a listing's line: never a title; a daily show's year-numbered season left out", () => {
  assert.equal(T.listingLine({ season: 35, numbers: [8], binge: false, network: "ABC" }), "S35 · ABC");
  assert.equal(T.listingLine({ season: 2026, numbers: [96], binge: false, network: "NBC" }), "NBC");
  assert.equal(T.listingLine({ season: 1, numbers: [], binge: false, network: "CBS" }), "Special · CBS");
  assert.equal(T.listingLine({ season: 1, numbers: [1, 2, 3], binge: true, network: "Netflix" }), "S1 · Netflix · 3 episodes");
  assert.equal(T.listingLine({ season: null, numbers: [1], binge: false, network: null }), "On TV");
  const hit = T.hitOfListing({ tvmazeId: 7, name: "Talky", type: "Talk Show", network: "NBC", country: "US", art: "a.jpg" });
  assert.equal(hit.kind, "talk");
  assert.equal(hit.thumb, "a.jpg");
  assert.equal(hit.tvmazeId, 7);
});
