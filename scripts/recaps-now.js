// Asks now for a season's missing episode write-ups and headlines, and prints what it filled: the research clock's last job
// (episode-recaps.ts recapsByItself, the same path runDueRecaps takes on its own) on demand, for a season that shouldn't wait for
// the clock (the user, 2026-11-23: "fill S51 now"). It asks our bot (LLM_BROWSER_API_URL), never a paid key, about the season's
// newest 10 aired episodes without one, and saves only into rows without a write-up.
//
//   node scripts/recaps-now.js <seasonId> [--production]
// Refuses a database that isn't local unless --production says so. For production, AUTH_DATABASE_URL is set by a clipboard window
// (.session-loop/recaps-now-prod.ps1), never on the command line, and only with the user's OK.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src"), "@db": path.join(__dirname, "..", "db") } });
const { recapsByItself, recapsMissing } = jiti("../src/lib/server/episode-recaps.ts");
const { pool } = jiti("../src/lib/server/db.ts");

const args = process.argv.slice(2);
const season = args.find((a) => !a.startsWith("--"));
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/;

(async () => {
  if (!season) throw new Error("usage: node scripts/recaps-now.js <seasonId> [--production]");
  if (!LOCAL.test(process.env.AUTH_DATABASE_URL || "") && !args.includes("--production")) throw new Error("refusing a database that isn't local: say --production");
  const missing = await recapsMissing(season);
  console.log(`[recaps] missing before: ${missing.join(", ") || "none"}`);
  if (!missing.length) return;
  const filled = await recapsByItself(season, null, undefined, 280_000);
  if (filled == null) console.log("[recaps] an ask is already going for this season: nothing asked");
  else console.log(`[recaps] filled ${filled}`);
  const { rows } = await pool.query(
    "SELECT number, headline, left(summary, 70) AS start FROM season_episodes WHERE season_id = $1 AND number = ANY($2::int[]) ORDER BY number",
    [season, missing]
  );
  for (const r of rows) console.log(`  Ep ${r.number}: ${r.headline ?? "(no headline)"} | ${r.start ? `${r.start}…` : "(no write-up)"}`);
  console.log(`[recaps] missing after: ${(await recapsMissing(season)).join(", ") || "none"}`);
})()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
