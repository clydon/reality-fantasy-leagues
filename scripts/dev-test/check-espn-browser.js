// Dev-only: the phone's poller in a browser (docs/PLAN-start-a-game-gpt.md track L, step L2: "How live stays free" rests on
// phones asking ESPN themselves). A page on its own local origin, in the testing bank's headless Chromium (browser.js), runs
// the poller itself (src/lib/sports/live.ts and each sport's reader, transpiled for the browser by TypeScript as they're asked
// for: no bundler):
//  - by default against the stand-in ESPN (fake-espn.js) on another origin, replaying a recorded game of each sport at --speed
//    (240x: a 3-hour game in 45 s), so every ask is a real cross-origin fetch answered with ESPN's CORS header
//    (Access-Control-Allow-Origin: *): each game asked all the way to its final, the poller stopping there, its end equal to
//    ESPN's box score on every number;
//  - with --espn, against the real ESPN, one ask a game (a finished one per sport), the browser as it is. ESPN's CDN (Akamai)
//    refuses a headless browser's user agent ("HeadlessChrome") with a 403 and no CORS header (found 2026-10-28), which a
//    browser reports as "blocked by CORS policy"; a normal browser's user agent gets Access-Control-Allow-Origin: * from any
//    origin (checked with plain HTTP requests). So the real check is a person's own browser: in its devtools console, on any
//    page,
//      fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909093").then((r) => console.log(r.status))
//    prints 200 when ESPN answers that browser.
//
//   node scripts/dev-test/check-espn-browser.js [--speed=240] [--games=nba-401909093,nhl-401892582]
//   node scripts/dev-test/check-espn-browser.js --espn [--events=basketball/nba:401909093,...]
//
// No app server, no database; --espn makes two real calls a game (the poller's ask, then the box score to compare). Exits 1 on a failure (with --espn: ESPN refusing the browser).
const http = require("http");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { launch } = require("./browser");
const fakeEspn = require("./fake-espn");

const ROOT = path.join(__dirname, "..", "..");
const FIXTURES = path.join(ROOT, "tests", "fixtures", "espn");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const SPEED = Number(args.speed || 240);
// One game a sport: the recorded fixtures (tests/fixtures/espn/).
const GAMES = String(args.games || "nba-401909093,mlb-401907924,nfl-401873017,nhl-401892582").split(",");
const FINISHED = String(args.events || "basketball/nba:401909093,baseball/mlb:401907924,football/nfl:401873017,hockey/nhl:401892582").split(",");

/** A module of the repo as the browser asks for it (/m/src/lib/sports/live.ts): TypeScript to JavaScript, its imports made URLs. */
function serveModule(rel) {
  const file = path.join(ROOT, rel);
  if (!file.startsWith(path.join(ROOT, "src")) || !fs.existsSync(file)) return null;
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return js.replace(/(\bfrom\s+|\bimport\s*\(?\s*)(["'])([^"']+)\2/g, (all, lead, q, spec) => {
    let to;
    if (spec.startsWith("@/")) to = path.join(ROOT, "src", spec.slice(2));
    else if (spec.startsWith(".")) to = path.resolve(path.dirname(file), spec);
    else return all;
    if (!path.extname(to)) to += ".ts";
    return `${lead}${q}/m/${path.relative(ROOT, to).split(path.sep).join("/")}${q}`;
  });
}

// The page: each game's poller, to its final (a replay, on the replay's clock) or for one ask (ESPN's finished games).
const PAGE = `<!doctype html><meta charset="utf-8"><title>The poller in a browser</title>
<script type="module">
window.run = async (games) => {
  const { LiveGame } = await import("/m/src/lib/sports/live.ts");
  const sports = {
    baseball: (await import("/m/src/lib/sports/baseball.ts")).Baseball,
    basketball: (await import("/m/src/lib/sports/basketball.ts")).Basketball,
    football: (await import("/m/src/lib/sports/football.ts")).Football,
    hockey: (await import("/m/src/lib/sports/hockey.ts")).Hockey,
  };
  return Promise.all(games.map(async (c) => {
    const sport = new sports[c.league.split("/")[0]]();
    const r = { ...c };
    const replay = c.replay;
    let finished;
    const done = new Promise((ok) => (finished = ok));
    const g = new LiveGame({
      sport, league: c.league, event: c.event, base: c.base,
      ...(replay ? { now: () => replay.from + (Date.now() - replay.wall) * replay.speed, setTimer: (run, ms) => setTimeout(run, ms / replay.speed) } : {}),
      onChange: (x) => { if (x.done || !replay) finished(); },
    });
    if (replay) g.start(); else g.poll();
    await Promise.race([done, new Promise((ok) => setTimeout(ok, c.timeout))]);
    g.stop();
    r.poller = { asks: g.asks, status: g.status, final: g.final, done: g.done, plays: g.plays.length, failures: g.failures, error: g.lastError, line: g.line };
    if (g.final) {
      // ESPN's own box score, from its final answer (one more ask): the poller keeps who's who, not ESPN's numbers.
      const box = sport.readBox(await (await fetch(g.url)).json());
      const end = g.stateAt(null);
      r.poller.numbers = 0;
      r.poller.wrong = [];
      for (const [id, p] of Object.entries(box.people)) for (const [k, v] of Object.entries(p.stats)) {
        r.poller.numbers++;
        if ((end.lines[id]?.[k] ?? 0) !== v) r.poller.wrong.push(p.name + " " + k);
      }
    }
    return r;
  }));
};
window.ready = true;
</script>`;

(async () => {
  let espn = null;
  let games;
  if (args.espn) {
    games = FINISHED.map((x) => {
      const [league, event] = x.split(":");
      return { league, event, base: "https://site.api.espn.com", timeout: 60_000 };
    });
  } else {
    espn = await fakeEspn.start();
    games = GAMES.map((name) => {
      const summary = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name.replace(/\.json$/, "")}.json`), "utf8"));
      const r = espn.replay(summary, { speed: SPEED });
      // Long enough for the whole replay at its speed, and half a minute more.
      return { league: r.league, event: r.event, base: espn.url, name, replay: { from: r.at(), wall: Date.now(), speed: SPEED }, timeout: (r.end - r.at() + 60_000) / SPEED + 30_000 };
    });
  }
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    if (u.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(PAGE);
    }
    const js = u.pathname.startsWith("/m/") ? serveModule(decodeURIComponent(u.pathname.slice(3))) : null;
    if (js == null) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(js);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  // A replay restarts its clock as the page starts.
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(origin);
  await page.waitForFunction(() => window.ready === true);
  if (espn) {
    for (const [i, g] of games.entries()) {
      espn.replays[i].set(g.replay.from);
      g.replay.wall = Date.now();
    }
  }
  const t0 = Date.now();
  const results = await page.evaluate((c) => window.run(c), games);
  await browser.close();
  server.close();
  if (espn) await espn.close();

  let bad = 0;
  console.log(`The poller in a page at ${origin} (headless Chromium), asking ${args.espn ? "the real ESPN" : `the stand-in ESPN at another origin (${SPEED}x)`}:`);
  for (const r of results) {
    const p = r.poller;
    const ok = p && !p.error && p.final && p.done && p.wrong?.length === 0 && (args.espn ? p.asks === 1 : p.asks > 100);
    if (!ok) bad++;
    const end = p.final ? `final, its end equal to ESPN's box score on ${p.numbers - p.wrong.length} of ${p.numbers} numbers${p.wrong.length ? ` (not: ${p.wrong.slice(0, 5).join(", ")})` : ""}` : `${p.status}`;
    console.log(`${ok ? "OK  " : "FAIL"}  ${r.league} ${r.event}: ${p.asks} ask(s) (${p.failures} failing at the end), ${p.plays} plays, ${end}${p.error ? `; ${p.error}` : ""}`);
  }
  const shown = [...new Set(errors)];
  for (const e of shown.slice(0, 6)) console.log(`        page error: ${e}`);
  if (args.espn && bad) console.log("\nESPN refused this browser. Headless Chromium's user agent is refused by ESPN's CDN (a 403 with no CORS header); a person's own browser is the real check (the header comment's one-liner).");
  console.log(`\n${results.length - bad} of ${results.length} pass (${Math.round((Date.now() - t0) / 1000)} s).`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
