// Dev-only: a stand-in for TVmaze (src/lib/server/listings.ts), so a check can search and add shows from "the TV listings"
// (docs/PLAN-new-design.md step 10 part 1) without the real one. It answers the calls the app makes:
//   GET /search/shows?q=        every show whose name holds the words (case-insensitive), TVmaze's { score, show } rows
//   GET /shows/:id?embed=seasons  the show with _embedded.seasons
//   GET /seasons/:id/episodes   that season's episodes
//   GET /shows/:id/cast         the show's main cast (people and the characters they play), for Make it a game
//   GET /schedule?country=US&date=   a day's network airings (step 11 part 2's listings job): every episode of a show on a
//                               US network whose start falls on that date in the East, the show as `show`
//   GET /schedule/web?date=     the day's streaming: every episode of a show on a web channel, the show as `_embedded.show`
//                               (a drop has an empty airtime, as TVmaze's do)
//   GET /updates/shows?since=day  { id: when } for every show, or only `tv.updated`'s ids when a check sets it; when is now,
//                               or `tv.changedAt[id]` (seconds) when a check sets one
// Shows are made relative to today, so "aired" stays true whenever the check runs. The schedules are worked out from the
// shows (so a show a check pushes airs too); `oneNight` makes a show with one season airing at a given moment, `daily` a
// streaming show with an episode a day (step 14 part 2: a streaming soap, which the guide's Also on leaves out).
//
//   const tv = await require("./fake-listings").start();          // or start({ shows: [...] })
//   // point the dev server at it: header  x-gys-listings: tv.url   (next dev only, loopback only)
//   tv.asked (paths asked, in order);  tv.down = true (every call 503s);  tv.updated = [ids] or null;  tv.changedAt = { id: s };
//   await tv.close();
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

const ZONE = "America/New_York";
/** A moment's date and clock time in the East, as TVmaze's US schedule lists them ("2026-10-27", "20:00"). */
function eastern(t) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * A show with one season airing at `at` (a Date or ms): `episodes` of them at once (a streaming drop when `web` is set and
 * `drop` is true), on a US network unless `web` names a streaming service ({ name, country: code or null }). Its season is
 * `season` (1), its popularity `weight` (50), its language `language` ("English"), its type `type` ("Reality").
 */
function oneNight(id, name, at, o = {}) {
  const t = new Date(at).getTime();
  const seasonId = id * 10 + (o.season ?? 1);
  const network = o.web ? null : { name: o.network ?? "ZT Network", country: { name: "United States", code: "US", timezone: ZONE } };
  const webChannel = o.web ? { name: o.web.name, country: o.web.country ? { name: o.web.country, code: o.web.country, timezone: ZONE } : null } : null;
  const n = o.episodes ?? 1;
  const premiere = eastern(t).date;
  return {
    show: {
      id, name, type: o.type ?? "Reality", language: o.language ?? "English", genres: [], status: "Running", premiered: premiere, weight: o.weight ?? 50,
      network, webChannel, image: o.art ? { medium: o.art, original: o.art } : null, url: `https://www.tvmaze.com/shows/${id}`,
      schedule: { time: o.drop ? "" : eastern(t).time, days: [] },
    },
    seasons: [
      {
        season: { id: seasonId, number: o.season ?? 1, name: "", episodeOrder: o.episodeOrder ?? n, premiereDate: premiere, endDate: o.drop || n === 1 ? premiere : null },
        episodes: Array.from({ length: n }, (_, i) => ({
          id: seasonId * 100 + (o.first ?? 1) + i, season: o.season ?? 1, number: (o.first ?? 1) + i, type: "regular", name: `Secret ${name} title ${i + 1}`,
          airdate: premiere, airtime: o.drop ? "" : eastern(t).time, airstamp: new Date(t).toISOString(), runtime: o.drop ? null : (o.runtime ?? 60),
        })),
      },
    ],
  };
}

/**
 * A streaming show with one new episode a day for `days` days from `from` (a Date or ms), each with no air time (TVmaze's
 * daily streaming soaps): on the service `web` ({ name, country: code or null }; a US one by default), popularity `weight`.
 */
function daily(id, name, from, days, o = {}) {
  const t = new Date(from).getTime();
  const seasonId = id * 10 + 1;
  const web = o.web ?? { name: "ZT Daily Stream", country: "US" };
  const webChannel = { name: web.name, country: web.country ? { name: web.country, code: web.country, timezone: ZONE } : null };
  return {
    show: {
      id, name, type: o.type ?? "Scripted", language: "English", genres: [], status: "Running", premiered: eastern(t).date, weight: o.weight ?? 50,
      network: null, webChannel, image: null, url: `https://www.tvmaze.com/shows/${id}`, schedule: { time: "", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
    },
    seasons: [
      {
        season: { id: seasonId, number: 1, name: "", episodeOrder: null, premiereDate: eastern(t).date, endDate: null },
        episodes: Array.from({ length: days }, (_, i) => {
          const at = t + i * DAY;
          return { id: seasonId * 100 + i + 1, season: 1, number: i + 1, type: "regular", name: `Secret ${name} title ${i + 1}`, airdate: eastern(at).date, airtime: "", airstamp: iso(at), runtime: 30 };
        }),
      },
    ],
  };
}

/** Every episode of the stand-in's shows as TVmaze's schedules list them on `date` (Eastern): the network's, or streaming. */
function scheduleOf(list, date, streaming) {
  const out = [];
  for (const s of list) {
    if (!!s.show.webChannel !== streaming || (!streaming && s.show.network?.country?.code !== "US")) continue;
    const show = { weight: 50, language: "English", ...s.show };
    for (const x of s.seasons) {
      for (const e of x.episodes) {
        if (!e.airstamp) continue;
        const at = eastern(Date.parse(e.airstamp));
        if (at.date !== date) continue;
        const entry = { ...e, airdate: at.date, airtime: e.airtime === "" ? "" : at.time };
        out.push(streaming ? { ...entry, _embedded: { show } } : { ...entry, show });
      }
    }
  }
  return out.sort((a, b) => a.airstamp.localeCompare(b.airstamp));
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
  const person = (name, character, image) => ({ person: { id: 0, name, image: image ? { medium: image } : null }, character: character ? { id: 0, name: character, image: null } : null, self: character === "Self", voice: false });
  const crew = weekly(9900061, 2, 12, 4, now);
  const race = weekly(9900071, 2026, 20, 6, now);
  const special = { id: 990001199, season: 1, number: null, type: "significant_special", name: "Reunion", airdate: date(now + 30 * DAY), airtime: "21:00", airstamp: iso(now + 30 * DAY), runtime: 60 };
  shack1.episodes.push(special);
  return [
    { show: { id: 990001, name: "ZT Love Shack", type: "Reality", genres: ["Romance"], status: "Running", premiered: shack1.season.premiereDate, network: null, webChannel: us, image: { medium: art("love-island"), original: art("love-island") }, url: "https://www.tvmaze.com/shows/990001", schedule: { time: "21:00", days: ["Monday"] } }, seasons: [shack0, shack1] },
    { show: { id: 990003, name: "ZT Love Shack", type: "Reality", genres: ["Romance"], status: "Ended", premiered: "2015-06-07", network: uk, webChannel: null, image: null, url: "https://www.tvmaze.com/shows/990003", schedule: { time: "21:00", days: ["Monday"] } }, seasons: [weekly(9900031, 1, 8, 8, now - 300 * DAY)] },
    { show: { id: 990002, name: "ZT Traitors", type: "Reality", genres: ["Mystery"], status: "Running", premiered: "2023-01-12", network: us, webChannel: null, image: { medium: art("traitors"), original: art("traitors") }, url: "https://www.tvmaze.com/shows/990002", schedule: { time: "21:00", days: ["Thursday"] } }, seasons: [traitors5] },
    { show: { id: 990004, name: "ZT Drop Show", type: "Scripted", genres: ["Drama"], status: "Running", premiered: drop.season.premiereDate, network: null, webChannel: { name: "ZT Stream", country: null }, image: null, url: "https://www.tvmaze.com/shows/990004", schedule: { time: "", days: [] } }, seasons: [drop], cast: [person("Lee Actor", "Nora Vale", null), person("Max Player", "Dr. Ives", null)] },
    { show: { id: 990005, name: "ZT Old Show", type: "Talk Show", genres: [], status: "Ended", premiered: old1.season.premiereDate, ended: old2.season.endDate, network: us, webChannel: null, image: null, url: "https://www.tvmaze.com/shows/990005", schedule: { time: "23:30", days: ["Friday"] } }, seasons: [old1, old2], cast: [person("Pat Host", "Self"), person("Robin Regular", "Self"), person("Sam Sidekick", "Bandleader")] },
    { show: { id: 990011, name: "ZT Yacht Life", type: "Reality", genres: ["Travel"], status: "Running", premiered: crew.season.premiereDate, network: us, webChannel: null, image: { medium: art("below-deck"), original: art("below-deck") }, url: "https://www.tvmaze.com/shows/990011", schedule: { time: "20:00", days: ["Monday"] } }, seasons: [crew],
      cast: [person("Cap Rivers", "Captain"), person("Dee Chief", "Chief Stew"), person("Bo Sun", "Bosun"), person("Ash Deck", "Self"), person("Kit Galley", "Chef")] },
    { show: { id: 990012, name: "ZT Grand Prix", type: "Sports", genres: [], status: "Running", premiered: race.season.premiereDate, network: us, webChannel: null, image: { medium: art("f1"), original: art("f1") }, url: "https://www.tvmaze.com/shows/990012", schedule: { time: "15:00", days: ["Sunday"] } }, seasons: [race], cast: [] },
  ];
}

async function start(opts = {}) {
  const tv = { asked: [], down: false, url: null, shows: opts.shows || shows(), updated: null, changedAt: {} };
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
    if ((m = u.pathname.match(/^\/shows\/(\d+)\/cast$/))) {
      const s = tv.shows.find((x) => x.show.id === Number(m[1]));
      if (!s) return send(404, { name: "Not Found" });
      return send(200, s.cast || []);
    }
    if (u.pathname === "/schedule" || u.pathname === "/schedule/web") {
      const date = u.searchParams.get("date") || "";
      if (u.pathname === "/schedule" && u.searchParams.get("country") !== "US") return send(200, []);
      return send(200, scheduleOf(tv.shows, date, u.pathname === "/schedule/web"));
    }
    if (u.pathname === "/updates/shows") {
      const at = Math.floor(Date.now() / 1000);
      const ids = tv.updated ?? tv.shows.map((s) => s.show.id);
      return send(200, Object.fromEntries(ids.map((id) => [String(id), tv.changedAt[id] ?? at])));
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

module.exports = { start, shows, oneNight, daily, eastern };
