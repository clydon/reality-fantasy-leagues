// The app's live route (src/lib/server/sports/live-proxy.ts; the user, 2026-11-15: "make sure it's polled by the app, not the
// client"): only a live game's addresses pass, a summary is cut to what the readers read, ESPN is asked at most once per address
// per FLOOR_MS (one ask at a time), a failure serves the last answer marked stale, and the edge keeps an answer for 15 s while a
// game is on.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const P = jiti("../src/lib/server/sports/live-proxy.ts");

const summary = (state) => ({ header: { id: "1", competitions: [{ status: { type: { state } } }] }, boxscore: { players: [] }, plays: [{ id: "p1" }], news: { articles: [1, 2, 3] }, videos: [1], winprobability: [1, 2], pickcenter: [{ provider: { name: "A" } }, { provider: { name: "B" } }] });
const answering = (body, calls) => async (url) => { calls.push(url); return typeof body === "function" ? body() : { ok: true, status: 200, json: async () => body }; };

test("only a live game's addresses pass, their query keys checked", () => {
  const q = (s) => new URLSearchParams(s);
  assert.deepEqual(P.allowed("site", "/apis/site/v2/sports/football/nfl/summary", q("event=401873053&x=1")), { url: "/apis/site/v2/sports/football/nfl/summary?event=401873053", summary: true });
  assert.equal(P.allowed("site", "/apis/site/v2/sports/tennis/atp/scoreboard/306-2026", q("")).url, "/apis/site/v2/sports/tennis/atp/scoreboard/306-2026");
  assert.equal(P.allowed("site", "/apis/site/v2/sports/golf/leaderboard", q("event=401")).url, "/apis/site/v2/sports/golf/leaderboard?event=401");
  assert.equal(P.allowed("core", "/v2/sports/racing/leagues/f1/events/600/competitions/601/competitors", q("limit=50")).url, "/v2/sports/racing/leagues/f1/events/600/competitions/601/competitors?limit=50");
  assert.equal(P.allowed("web", "/apis/common/v3/sports/mma/ufc/fightcenter/600", q("region=us&lang=en&contentorigin=espn")).url, "/apis/common/v3/sports/mma/ufc/fightcenter/600?region=us&lang=en&contentorigin=espn");
  for (const [h, p] of [["site", "/apis/site/v2/sports/football/nfl/teams"], ["site", "/apis/site/v2/sports/football/nfl/news"], ["core", "/v2/sports/football/leagues/nfl/athletes"], ["web", "/apis/common/v3/sports/football/nfl/athletes/1/stats"]]) assert.throws(() => P.allowed(h, p, q("event=1")), /live game/);
  assert.throws(() => P.allowed("site", "/apis/site/v2/sports/football/nfl/summary", q("")), /needs its event/);
  assert.throws(() => P.allowed("site", "/apis/site/v2/sports/football/nfl/summary", q("event=1;drop")), /Bad event/);
});

test("a summary is cut to what the readers read, its line to the first", () => {
  const t = P.trimSummary(summary("in"));
  assert.deepEqual(Object.keys(t).sort(), ["boxscore", "header", "pickcenter", "plays"]);
  assert.deepEqual(t.pickcenter, [{ provider: { name: "A" } }]);
});

test("ESPN is asked once per address per floor, one ask at a time, whoever is watching", async () => {
  P.forgetLive();
  const calls = [];
  const fetch = answering(summary("in"), calls);
  const url = "/apis/site/v2/sports/football/nfl/summary?event=1";
  const many = await Promise.all(Array.from({ length: 20 }, () => P.liveAnswer("site", url, true, { fetch, now: 1000 })));
  assert.equal(calls.length, 1, "twenty phones at once, one ask");
  assert.ok(many.every((a) => a.body === many[0].body && !a.stale && !a.settled));
  assert.ok(!JSON.parse(many[0].body).news, "cut");
  await P.liveAnswer("site", url, true, { fetch, now: 1000 + P.FLOOR_MS - 1 });
  assert.equal(calls.length, 1, "within the floor, the kept answer");
  await P.liveAnswer("site", url, true, { fetch, now: 1000 + P.FLOOR_MS });
  assert.equal(calls.length, 2, "past it, asked again");
  assert.equal(calls[0], "https://site.api.espn.com" + url);
});

test("ESPN failing serves the last answer, marked stale; with none it fails", async () => {
  P.forgetLive();
  const calls = [];
  let ok = true;
  const fetch = answering(() => (ok ? { ok: true, status: 200, json: async () => summary("in") } : { ok: false, status: 503 }), calls);
  const url = "/apis/site/v2/sports/football/nfl/summary?event=2";
  await P.liveAnswer("site", url, true, { fetch, now: 0 });
  ok = false;
  const a = await P.liveAnswer("site", url, true, { fetch, now: 60_000 });
  assert.equal(a.stale, true);
  assert.match(P.cacheControl(a), /s-maxage=5/);
  await assert.rejects(P.liveAnswer("site", url + "9", true, { fetch, now: 60_000 }), /ESPN answered 503/);
});

test("the edge keeps a game on for 15 s, a settled one longer", async () => {
  assert.equal(P.cacheControl({ stale: false, settled: false }), "public, s-maxage=15, stale-while-revalidate=15");
  assert.match(P.cacheControl({ stale: false, settled: true }), /s-maxage=300/);
  P.forgetLive();
  const a = await P.liveAnswer("site", "/apis/site/v2/sports/football/nfl/summary?event=3", true, { fetch: answering(summary("post"), []), now: 0 });
  assert.equal(a.settled, true);
});
