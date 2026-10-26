// Dev-only: a stand-in for GIPHY (src/lib/server/gifs.ts), so a check can send GIFs in a watch along (docs/PLAN-new-design.md
// step 13 part 1) without a GIPHY key or the internet. It answers GET /v1/gifs/search?q= and /v1/gifs/trending in GIPHY's shape
// (each GIF's fixed_width and fixed_width_small pictures), and serves those pictures itself: the mock's coloured tiles with a word
// (watching.js GIFS), as SVG. Every request is kept in `asked`.
//
//   const gifs = await require("./fake-gifs").start();
//   // point the dev server at it for a request or a browser: header  x-gys-gifs: gifs.url   (next dev only, loopback only)
//   gifs.down = true (searches fail);  gifs.asked;  gifs.GIFS;  await gifs.close();
//
// No database. With no header and no GIPHY_API_KEY, the app has no GIFs at all (no button), which a check can assert too.
const http = require("http");

// The mock's tiles: [word, colour, darker].
const GIFS = [
  ["OMG", "#e56b9f", "#8f3a6a"],
  ["Slow clap", "#ffc531", "#b07d10"],
  ["I knew it", "#35b5a5", "#16665c"],
  ["Nope", "#f2545b", "#7a1d22"],
  ["Popcorn", "#f2804b", "#8a3f17"],
  ["Crying", "#5089c9", "#22466e"],
  ["Plot twist", "#a76bb0", "#4d2a57"],
  ["Iconic", "#f4f2f8", "#8d889c"],
  ["Screaming", "#e0a312", "#6d4c05"],
];
const idOf = (word) => `zt${word.toLowerCase().replace(/[^a-z]+/g, "")}`;

function svg(word, a, b, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="50%" y="54%" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="${Math.round(h / 5)}" fill="#fff">${word.toUpperCase()}</text></svg>`;
}

async function start() {
  const fake = { url: null, down: false, asked: [], GIFS };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    fake.asked.push(u.pathname + u.search);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const pic = u.pathname.match(/^\/media\/([a-z0-9]+)\/(200w|100w)\.svg$/);
    if (pic) {
      const g = GIFS.find((x) => idOf(x[0]) === pic[1]);
      if (!g) return json(404, {});
      const w = pic[2] === "200w" ? 200 : 100;
      res.writeHead(200, { "content-type": "image/svg+xml" });
      return res.end(svg(g[0], g[1], g[2], w, Math.round(w * 0.75)));
    }
    if (u.pathname === "/v1/gifs/search" || u.pathname === "/v1/gifs/trending") {
      if (fake.down) return json(503, { message: "the stand-in is down" });
      if (!u.searchParams.get("api_key")) return json(401, { message: "no key" });
      const q = (u.searchParams.get("q") || "").toLowerCase();
      const list = u.pathname.endsWith("trending") ? GIFS : GIFS.filter((g) => g[0].toLowerCase().includes(q));
      return json(200, {
        data: list.map(([word]) => {
          const id = idOf(word);
          return {
            id,
            title: `${word} GIF`,
            images: {
              fixed_width: { url: `${fake.url}/media/${id}/200w.svg`, width: "200", height: "150" },
              fixed_width_small: { url: `${fake.url}/media/${id}/100w.svg`, width: "100", height: "75" },
            },
          };
        }),
      });
    }
    json(404, {});
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  fake.url = `http://127.0.0.1:${server.address().port}`;
  fake.close = () => new Promise((r) => server.close(r));
  return fake;
}

module.exports = { start, GIFS, idOf };
