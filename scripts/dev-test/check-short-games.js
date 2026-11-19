// Dev-only check (docs/PLAN-start-a-game-redo.md E2, "Short games at scale"): a show's reads on Round 3's busy season
// (short-games-fixture.js: about 60 one-episode games over 20 episodes on new-fixture's couch), timed through the dev server, for
// someone who's seen everything (alex) and someone two behind (sam). Each read is asked `--runs` times (the first warms the server's
// caches) and its median kept; with `--budget=<ms>`, any read slower than that fails. Prints each read's times and what it returned.
// The reads: Tonight's space, the Games tab (every game), its running games only (`&running=1`) and the archive's first page; then
// the archive paged to its end (`before`), every game over for you exactly once, none past your mark, and running plus archive the
// Games tab's whole.
//
//   npm run dev   (or node scripts/lane.js dev)
//   node scripts/dev-test/check-short-games.js [--runs=3] [--budget=<ms>] [--each=3] [--episodes=20] [--through=19] [--keep]
//   (Round 3's 30-episode season: --episodes=30 --through=29)
//
// Brings the fixture up and takes it down (--keep leaves it); zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_
// couch: never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const shortGames = require("./short-games-fixture");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const RUNS = Number(arg("runs", "3"));
const BUDGET = Number(arg("budget", "0"));
const EACH = Number(arg("each", "3"));
const EPISODES = Number(arg("episodes", "20"));
const THROUGH = Number(arg("through", String(EPISODES - 1)));
const KEEP = process.argv.includes("--keep");

let failed = 0;
const check = (ok, what, more) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) {
    failed++;
    if (more) console.log(`      ${more}`);
  }
};
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

(async () => {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-short-games runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const fx = await shortGames.up(pool, { each: EACH, episodes: EPISODES, through: THROUGH });
  try {
    const sid = fx.seasonId;
    const reads = {
      space: `/api/seasons/${sid}/space`,
      games: `/api/seasons/${sid}/games?couch=${fx.couchId}`,
      running: `/api/seasons/${sid}/games?couch=${fx.couchId}&running=1`,
      archive: `/api/seasons/${sid}/archive?couch=${fx.couchId}`,
      episodes: `/api/seasons/${sid}/episodes?couch=${fx.couchId}`,
    };
    for (const who of ["alex", "sam"]) {
      const me = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
      for (const [name, url] of Object.entries(reads)) {
        const times = [];
        let last = null;
        for (let i = 0; i < RUNS; i++) {
          const t = Date.now();
          last = await me.call("GET", url);
          times.push(Date.now() - t);
        }
        const m = median(times);
        const games = Array.isArray(last.body && last.body.games) ? last.body.games : null;
        const said = games ? `${games.length} games, ${games.filter((g) => g.ended || g.over).length} over` : `${JSON.stringify(last.body).length} bytes`;
        check(last.status === 200 && (!BUDGET || m <= BUDGET), `${who} · ${name}: ${m} ms (runs ${times.join(", ")}) · ${said}${name === "archive" ? `, more: ${last.body.more}` : ""}`, BUDGET && m > BUDGET ? `over the ${BUDGET} ms budget` : last.status !== 200 ? `${last.status} ${JSON.stringify(last.body).slice(0, 200)}` : "");
      }
      // The archive paged to its end: every game over for you once, newest first, none past your mark; running plus archive the whole.
      const all = (await me.call("GET", reads.games)).body;
      const over = all.games.filter((g) => g.over).map((g) => g.leagueId).sort();
      const running = (await me.call("GET", reads.running)).body.games;
      const paged = [];
      let before = null;
      let pages = 0;
      for (; pages < 20; pages++) {
        const r = (await me.call("GET", `${reads.archive}&limit=20${before === null ? "" : `&before=${before}`}`)).body;
        paged.push(...r.games);
        if (!r.more || !r.games.length) break;
        before = r.games[r.games.length - 1].to;
      }
      const ids = paged.map((g) => g.leagueId);
      const mark = all.seenThrough ?? Infinity;
      check(ids.length === new Set(ids).size && JSON.stringify(ids.slice().sort()) === JSON.stringify(over), `${who} · the archive paged to its end (${pages + 1} pages): every game over for you once (${ids.length} of ${over.length})`);
      check(paged.every((g, i) => i === 0 || g.to <= paged[i - 1].to) && paged.every((g) => g.to <= mark), `${who} · newest first, none past your mark (${Number.isFinite(mark) ? mark : "everything"})`);
      check(paged.every((g) => g.winners.length >= 1 && g.you && g.you.place >= 1), `${who} · each kept small: who won it and your place`, JSON.stringify(paged.find((g) => !g.winners.length || !g.you)));
      check(running.length + over.length === all.games.length && running.every((g) => !g.over), `${who} · running (${running.length}) plus the archive (${over.length}): the Games tab's ${all.games.length}`);
    }
  } finally {
    if (!KEEP) await shortGames.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
