// Dev-only: a stand-in for TVmaze (src/lib/server/listings.ts), so a check can search and add shows from "the TV listings"
// (docs/PLAN-new-design.md step 10 part 1) without the real one. It answers the three calls the app makes:
//   GET /search/shows?q=        every show whose name holds the words (case-insensitive), TVmaze's { score, show } rows
//   GET /shows/:id?embed=seasons  the show with _embedded.seasons
//   GET /seasons/:id/episodes   that season's episodes
// Shows are made relative to today, so "aired" stays true whenever the check runs.
//
//   const tv = await require("./fake-listings").start();          // or start({ shows: [...] })
//   // point the dev server at it: header  x-gys-listings: tv.url   (next dev only, loopback only)
//   tv.asked (paths asked, in order);  tv.down = true (every call 503s);  await tv.close();
//
// No database and no app server: only the listings' side. Every show's name starts "ZT " and its id is 990001 and up, so
// nothing it makes can be mistaken for a real show (check-new-watching.js removes what it made).
const http = require("http");

const DAY = 24 * 3600 * 1000;
const iso = (t) => new Date(t).toISOString();
const date = (t) => iso(t).slice(0, 10);

/** A weekly season: `aired` episodes already out (the last a few days ago), `total` in all, at 9 PM Eastern (01:00 UTC). */
function weekly(seasonId, number, total, aired, now = Date.now()) {
  const last = now - 3 * DAY;
  const first = last - (aired - 1) * 7 * DAY;
  const at = (n) => {
    const d = new Date(first + (n - 1) * 7 * DAY);
    d.setUTCHours(1, 0, 0, 0);
    return d.getTime();
  };
  return {
    season: { id: seasonId, number, name: "", episodeOrder: total, premiereDate: date(at(1)), endDate: date(at(total)) },
    episodes: Array.from({ length: total }, (_, i) => ({
      id: seasonId * 100 + i + 1, season: number, number: i + 1, type: "regular", name: `Night ${i + 1}`,
      airdate: date(at(i + 1)), airtime: "21:00", airstamp: iso(at(i + 1)), runtime: 60,
    })),
  };
}

function shows(now = Date.now()) {
  const us = { name: "ZT Network", country: { name: "United States", code: "US", timezone: "America/New_York" } };
  const uk = { name: "ZT Two", country: { name: "United Kingdom", code: "GB", timezone: "Europe/London" } };
  const art = (slug) => `/mock/showcase/art/${slug}.jpg`;
  const shack1 = weekly(9900011, 1, 8, 3, now);
  const shack0 = { season: { id: 9900010, number: 0, name: "", episodeOrder: 2, premiereDate: null, endDate: null }, episodes: [] };
  const old1 = weekly(9900051, 1, 6, 6, now - 400 * DAY);
  const old2 = weekly(9900052, 2, 6, 6, now - 40 * DAY);
  const traitors5 = weekly(9900021, 5, 10, 3, now);
  const drop = {
    season: { id: 9900041, number: 1, name: "", episodeOrder: 4, premiereDate: date(now - 2 * DAY), endDate: date(now - 2 * DAY) },
    episodes: [1, 2, 3, 4].map((n) => ({ id: 990004100 + n, season: 1, number: n, type: "regular", name: `Part ${n}`, airdate: date(now - 2 * DAY), airtime: "", airstamp: iso(now - 2 * DAY), runtime: 50 })),
  };
  const special = { id: 990001199, season: 1, number: null, type: "significant_special", name: "Reunion", airdate: date(now + 30 * DAY), airtime: "21:00", airstamp: iso(now + 30 * DAY), runtime: 60 };
  shack1.episodes.push(special);
  return [
    { show: { id: 990001, name: "ZT Love Shack", type: "Reality", genres: ["Romance"], status: "Running", premiered: shack1.season.premiereDate, network: null, webChannel: us, image: { medium: art("love-island"), original: art("love-island") }, url: "https://www.tvmaze.com/shows/990001", schedule: { time: "21:00", days: ["Monday"] } }, seasons: [shack0, shack1] },
    { show: { id: 990003, name: "ZT Love Shack", type: "Reality", genres: ["Romance"], status: "Ended", premiered: "2015-06-07", network: uk, webChannel: null, image: null, url: "https://www.tvmaze.com/shows/990003", schedule: { time: "21:00", days: ["Monday"] } }, seasons: [weekly(9900031, 1, 8, 8, now - 300 * DAY)] },
    { show: { id: 990002, name: "ZT Traitors", type: "Reality", genres: ["Mystery"], status: "Running", premiered: "2023-01-12", network: us, webChannel: null, image: { medium: art("traitors"), original: art("traitors") }, url: "https://www.tvmaze.com/shows/990002", schedule: { time: "21:00", days: ["Thursday"] } }, seasons: [traitors5] },
    { show: { id: 990004, name: "ZT Drop Show", type: "Scripted", genres: ["Drama"], status: "Running", premiered: drop.season.premiereDate, network: null, webChannel: { name: "ZT Stream", country: null }, image: null, url: "https://www.tvmaze.com/shows/990004", schedule: { time: "", days: [] } }, seasons: [drop] },
    { show: { id: 990005, name: "ZT Old Show", type: "Talk Show", genres: [], status: "Ended", premiered: old1.season.premiereDate, ended: old2.season.endDate, network: us, webChannel: null, image: null, url: "https://www.tvmaze.com/shows/990005", schedule: { time: "23:30", days: ["Friday"] } }, seasons: [old1, old2] },
  ];
}

async function start(opts = {}) {
  const tv = { asked: [], down: false, url: null, shows: opts.shows || shows() };
  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const u = new URL(req.url, "http://x");
    tv.asked.push(u.pathname + u.search);
    if (tv.down) return send(503, { message: "the stand-in listings are down" });
    let m;
    if (u.pathname === "/search/shows") {
      const words = (u.searchParams.get("q") || "").toLowerCase().split(/\s+/).filter(Boolean);
      const hits = tv.shows.filter((s) => words.length && words.every((w) => s.show.name.toLowerCase().includes(w)));
      return send(200, hits.map((s, i) => ({ score: 1 - i / 10, show: s.show })));
    }
    if ((m = u.pathname.match(/^\/shows\/(\d+)$/))) {
      const s = tv.shows.find((x) => x.show.id === Number(m[1]));
      if (!s) return send(404, { name: "Not Found" });
      return send(200, { ...s.show, _embedded: { seasons: s.seasons.map((x) => x.season) } });
    }
    if ((m = u.pathname.match(/^\/seasons\/(\d+)\/episodes$/))) {
      for (const s of tv.shows) for (const x of s.seasons) if (x.season.id === Number(m[1])) return send(200, x.episodes);
      return send(404, { name: "Not Found" });
    }
    return send(404, { name: "Not Found" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  tv.url = `http://127.0.0.1:${server.address().port}`;
  tv.close = () => new Promise((r) => server.close(r));
  return tv;
}

module.exports = { start, shows };
