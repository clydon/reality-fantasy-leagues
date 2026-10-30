// Runs the migrations on a Neon branch of production, then checks step 0b's data there
// (scripts/dev-test/check-foundation-data.js), then runs the rulebooks backfill there (db/backfill-rulebooks.js,
// step R3) and its read-only check that every league would score the same with the rulebooks flag on
// (scripts/rulebooks-flag.js check; the flag itself stays off): the rehearsal docs/PLAN-new-design.md asks for
// before a migration ships. Never production itself: it refuses the host any production backup in backups/ was read
// from (each manifest records it), and without such a backup it asks for --yes after printing the host.
//
//   PowerShell:  $env:REHEARSE_DATABASE_URL = "<the Neon branch's connection string>"
//                node scripts/rehearse-migrations.js
//                Remove-Item Env:REHEARSE_DATABASE_URL
//
// The user runs it with the branch's string in their own terminal (Claude never handles it). It prints only
// the host and database.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");
const { migrate } = require("../db/migrate");
const { describeUrl } = require("./backup-common");

const url = process.env.REHEARSE_DATABASE_URL;
if (!url) throw new Error("set REHEARSE_DATABASE_URL to the Neon branch's connection string");
const host = new URL(url).hostname;
// A Neon compute by its endpoint id (ep-...), so its pooled host (ep-...-pooler) is the same compute as its direct one.
const endpoint = (h) => h.split(".")[0].replace(/-pooler$/, "");
const backups = path.join(__dirname, "..", "backups");
const production = new Set();
for (const dir of fs.existsSync(backups) ? fs.readdirSync(backups) : []) {
  const file = path.join(backups, dir, "manifest.json");
  if (!fs.existsSync(file)) continue;
  const at = JSON.parse(fs.readFileSync(file, "utf8")).source?.at || "";
  if (/neon\.tech/.test(at)) production.add(endpoint(at.split("/")[0].split(":")[0]));
}
console.log(`[rehearse] ${describeUrl(url)}`);
if (production.has(endpoint(host))) throw new Error("that's production (a backup in backups/ was read from it): use a branch's connection string");
if (!production.size && !process.argv.includes("--yes")) {
  throw new Error("no production backup in backups/ to tell production apart: check the host above is the branch's, then add --yes");
}

(async () => {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(pool);
    console.log("[rehearse] migrations applied");
  } finally {
    await pool.end();
  }
  const steps = [
    [path.join(__dirname, "dev-test", "check-foundation-data.js")],
    [path.join(__dirname, "..", "db", "backfill-rulebooks.js")],
    [path.join(__dirname, "rulebooks-flag.js"), "check"],
  ];
  for (const args of steps) {
    const step = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: { ...process.env, CHECK_DATABASE_URL: url, RULEBOOKS_DATABASE_URL: url },
    });
    process.stdout.write(step.stdout + step.stderr);
    if (step.status !== 0) process.exitCode = 1;
  }
})().catch((e) => {
  console.error(`[rehearse] ${e.message}`);
  process.exitCode = 1;
});
