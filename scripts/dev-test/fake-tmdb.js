// Dev-only: a stand-in for TMDB's API (src/lib/server/show-art.ts), so a check can find, choose and frame a show's art
// (docs/PLAN-desk-parity.md part 7b) without a TMDB key or the internet. It answers, in TMDB's shape:
//   GET /search/tv?query=        one show, named as asked, id 990901 (only for a query starting "ZT ": nothing else)
//   GET /find/<id>               nothing (the check's shows have no TVmaze id)
//   GET /tv/990901/images        two posters and three backdrops (one wordless, most liked), no logos
//   GET /tv/990901/season/<n>/images            two posters of that season
//   GET /tv/990901/season/<n>/aggregate_credits the cast named in `fake.cast`, each with a profile photo
// and the pictures those name: `fake.picture(url)` gives an SVG for any image.tmdb.org address (or any other: a check routes
// its browser's image requests to it with page.route), its size from the address (w500 a poster, w1280 a backdrop, w185 a
// face), coloured by its name with the name written large near its left edge, so a framing that moves it shows. Every API
// request is kept in `asked`.
//
//   const tmdb = await require("./fake-tmdb").start();
//   // point the dev server at it for a request or a browser: header  x-gys-tmdb: tmdb.url   (next dev only, loopback only)
//   tmdb.cast = ["Zed Vee"];  tmdb.backdropBest = "/zt-da-back-2.jpg";  tmdb.asked;  await tmdb.close();
//
// No database.
const http = require("http");

const SHOW = 990901;
const POSTERS = ["/zt-da-poster-1.jpg", "/zt-da-poster-2.jpg"];
const BACKDROPS = ["/zt-da-back-1.jpg", "/zt-da-back-2.jpg", "/zt-da-back-3.jpg"];

function hue(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** A picture for an image address: its shape from TMDB's size in it (or a wide one), its name written on it. */
function picture(url) {
  const u = new URL(url);
  const size = (u.pathname.match(/\/t\/p\/([a-z0-9]+)\//) || [])[1] || "";
  const SIZES = { w500: [500, 750], w342: [342, 513], w185: [185, 278], w300: [300, 169], w780: [780, 439], w1280: [1280, 720] };
  const [w, h] = SIZES[size] || [1200, 675];
  const name = u.pathname.split("/").pop().replace(/\.\w+$/, "");
  const a = hue(name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a},60%,45%)"/><stop offset="1" stop-color="hsl(${(a + 70) % 360},55%,22%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.78}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.22}" fill="hsl(${(a + 180) % 360},70%,60%)"/><text x="${w * 0.06}" y="${h * 0.56}" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="${Math.round(Math.min(w, h) / 6)}" fill="#fff">${name.toUpperCase().replace(/^ZT-DA-/, "")}</text></svg>`;
}

async function start() {
  const fake = { url: null, asked: [], cast: [], backdropBest: BACKDROPS[0], picture, SHOW, POSTERS, BACKDROPS };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    fake.asked.push(u.pathname + u.search);
    const json = (body) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const vote = (path, best) => ({ file_path: path, iso_639_1: null, vote_average: path === best ? 9 : 5, vote_count: 10, width: 1280, height: 720 });
    let m;
    if (u.pathname === "/search/tv") {
      const q = u.searchParams.get("query") || "";
      return json({ results: /^ZT /.test(q) ? [{ id: SHOW, name: q, original_name: q, origin_country: ["US"], popularity: 1 }] : [] });
    }
    if (u.pathname.startsWith("/find/")) return json({ tv_results: [] });
    if (u.pathname === `/tv/${SHOW}/images`)
      return json({
        posters: POSTERS.map((p, i) => ({ file_path: p, iso_639_1: "en", vote_average: 6 - i, vote_count: 10 })),
        backdrops: BACKDROPS.map((p) => vote(p, fake.backdropBest)),
        logos: [],
      });
    if ((m = u.pathname.match(new RegExp(`^/tv/${SHOW}/season/(\\d+)/images$`))))
      return json({ posters: [1, 2].map((i) => ({ file_path: `/zt-da-s${m[1]}-poster-${i}.jpg`, iso_639_1: "en", vote_average: 6 - i, vote_count: 10 })) });
    if ((m = u.pathname.match(new RegExp(`^/tv/${SHOW}/season/(\\d+)/aggregate_credits$`))))
      return json({ cast: fake.cast.map((name, i) => ({ id: 7000 + i, name, profile_path: `/zt-da-face-${i}.jpg`, roles: [{ character: "Self - Contestant", episode_count: 3 }], total_episode_count: 3 })) });
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status_message: "The resource you requested could not be found." }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${server.address().port}`;
  fake.close = () => new Promise((r) => server.close(r));
  return fake;
}

module.exports = { start, picture };
