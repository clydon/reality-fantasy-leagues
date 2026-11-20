// Sports results within the hour (docs/PLAN-sports-ready.md step 1.1, part 1): the sports part of the daily listings job
// (src/lib/server/sports/matchup.ts refreshSportsEvents), run every hour by the "Reminders and waivers" GitHub Actions job, so a
// game's final is in the standings within an hour of ESPN's instead of the next morning. What a run does, each step only when it's
// due (a run with nothing due asks ESPN for little: its answers are cached in sports_cache):
//   each slate's games near now linked (a makeup, a moved game); each sports season's people refilled once a day (signings,
//   trades, injuries); each linked game from three days back to a week ahead read from its day's scoreboard until it's final;
//   each new final's box score kept; kept finals read again for corrections (a day after, and before the next game); a final
//   nothing could be read for asked again every six hours.
// The daily listings job still runs the same part each morning (the fallback); the two are safe together (each write is guarded).
//
// Needs AUTH_DATABASE_URL (the job's secret; .env.local by hand). No key: ESPN's public API, with the app's own User-Agent.
//   node db/sports-refresh.js                       what the job runs
//   node db/sports-refresh.js --base=<url> --only=<season id,...>   a check's (a stand-in ESPN, its seasons only: never the real one)
// Exits 1 only when the run itself fails; ESPN not answering for a game is said and left for the next run.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local"), quiet: true });
const path = require("path");

const root = path.join(__dirname, "..");
const opt = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;

/** A check's seasons' leagues (`--only`), so its run never reads anyone else's game. */
async function leaguesOn(pool, seasonIds) {
  const { rows } = await pool.query(
    `SELECT l.id FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = ANY($1::uuid[])`,
    [seasonIds]
  );
  return rows.map((r) => r.id);
}

async function main() {
  if (!process.env.AUTH_DATABASE_URL) {
    console.log("[sports-refresh] no AUTH_DATABASE_URL: nothing to do");
    return;
  }
  const after = require("./after-now");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src"), "@db": __dirname, "next/server": path.join(__dirname, "after-now.js") } });
  const { refreshSportsEvents } = jiti("../src/lib/server/sports/matchup.ts");
  const { sportsProviders } = jiti("../src/lib/server/sports/index.ts");
  const { pool } = jiti("../src/lib/server/db.ts");
  const base = opt("base");
  const only = opt("only") ? opt("only").split(",").filter(Boolean) : undefined;
  const started = Date.now();
  try {
    const r = await refreshSportsEvents({ ...(base ? { providers: sportsProviders({ base, prefix: opt("prefix") ?? undefined }) } : {}), ...(only ? { only } : {}) });
    await after.settled();
    console.log(`[sports-refresh] ${r.days} days read, ${r.stored} games kept, ${r.finals} finals saved, ${r.corrected} corrected in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    for (const e of r.errors.slice(0, 10)) console.log(`[sports-refresh]   ${e}`);
    if (r.errors.length > 10) console.log(`[sports-refresh]   ...and ${r.errors.length - 10} more`);
    // Step 2.6: every sports game at its own pace readied, so a seat the next game's start has passed moves on within the hour.
    const { keepAllSportPace } = jiti("../src/lib/server/sport-pace-clock.ts");
    const paced = await keepAllSportPace(only ? await leaguesOn(pool, only) : undefined);
    await after.settled();
    if (paced) console.log(`[sports-refresh] ${paced} game${paced === 1 ? "" : "s"} at their own pace kept up`);
  } finally {
    await after.settled().catch(() => {});
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[sports-refresh] failed:", e);
  process.exitCode = 1;
});
