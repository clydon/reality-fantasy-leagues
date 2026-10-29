// The rulebooks flag (app_settings 'rulebooks', db/rulebooks.js; docs/PLAN-new-design.md step R3): what it is, a
// read-only check of what turning it on would do, and turning it on or off for every league.
//
//   node scripts/rulebooks-flag.js status   the flag; how many leagues carry settings.rulebook, and how many are behind
//   node scripts/rulebooks-flag.js check    writes nothing: for every league, what syncLeagueRulebook would write and
//                                           that the league scores exactly the same with it (scores, every event and
//                                           its points, the season's end, the catalog); and for every season, that
//                                           its rulebook is the format its research reads. Each league in its own
//                                           rolled-back transaction. Exit 1 on any difference.
//   node scripts/rulebooks-flag.js on       the backfill (db/backfill-rulebooks.js; refuses if a season's rulebook
//                                           isn't its format), the flag on, then settings.rulebook into every league
//   node scripts/rulebooks-flag.js off      the flag off, then settings.rulebook out of every league but a season's switched
//                                           on by itself (rulebook_live) and a couch's own copy: back on showFormat /
//                                           leagueRulesetData, which were never removed
//
// The database is RULEBOOKS_DATABASE_URL if set (a Neon branch, from the user's own terminal), else AUTH_DATABASE_URL
// (.env.local). It prints the host; on or off anywhere but localhost needs --yes. Each league is written under its
// own row lock (db/rulebooks.js syncLeagueRow) and only when its settings.rulebook changed; re-running picks up where
// a run stopped. The check and the switch are db/rulebooks-flag.js's, which the desk's Settings runs too.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { scoringSnapshot, comparePlayed, check, flip, status } = require("../db/rulebooks-flag.js");

async function main() {
  const [command] = process.argv.slice(2);
  const url = process.env.RULEBOOKS_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!url) throw new Error("set AUTH_DATABASE_URL (.env.local) or RULEBOOKS_DATABASE_URL");
  const host = new URL(url).hostname;
  console.log(`[rulebooks] database host: ${host}`);
  if (["on", "off"].includes(command) && !["localhost", "127.0.0.1"].includes(host) && !process.argv.includes("--yes")) {
    throw new Error(`that isn't the local database: check the host above, then add --yes`);
  }
  const pool = new Pool({ connectionString: url });
  try {
    if (command === "status") await status(pool);
    else if (command === "check") {
      const { ok } = await check(pool);
      console.log(`[rulebooks] check: ${ok ? "PASS" : "FAIL"}`);
      if (!ok) process.exitCode = 1;
    } else if (command === "on" || command === "off") await flip(pool, command === "on");
    else throw new Error("usage: node scripts/rulebooks-flag.js status | check | on | off [--yes]");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[rulebooks]", e.message);
    process.exit(1);
  });
}

module.exports = { scoringSnapshot, comparePlayed, check, flip, status };
