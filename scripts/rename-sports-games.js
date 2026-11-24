// One-off (the user's "yes change it", 2026-11-23; docs/design-round/props-table-spec.md): a one-game game on a team's season
// was named by its index ("Prop sheet · Game 10"); new ones are named by both teams ("Prop sheet · Commanders at Bengals,
// Week 11": sports/game-names.ts, start-game.ts gameName). This renames the ones made before, with the app's own names, so
// they read the same as a game started today. Only a game still named "<kind> · <word> <n>" (never one someone renamed), on a team's
// season (sports_matchups keyed by a team), not deleted, whose episode has a name.
//   node scripts/rename-sports-games.js [--production] [--dry-run]
// Refuses a database that isn't local unless --production says so (AUTH_DATABASE_URL set by the clipboard runner,
// .session-loop/rename-sports-games-prod.ps1, never on the command line). Prints each rename; --dry-run writes nothing.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src"), "@db": path.join(__dirname, "..", "db") } });

const args = process.argv.slice(2);
const has = (k) => args.includes(`--${k}`);
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/;

(async () => {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!LOCAL.test(url) && !has("production")) {
    console.log("Refused: not a local database and no --production. Nothing ran.");
    process.exit(1);
  }
  const { pool } = jiti("../src/lib/server/pool.ts");
  const { sportsGameNames } = jiti("../src/lib/server/sports/game-names.ts");
  const { kindOf } = jiti("../src/lib/game/spans.ts");
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.name, ss.id AS season_id, (l.state->'settings'->>'endEpisode')::int AS last,
              COALESCE((l.state->'settings'->>'startEpisode')::int, (l.state->'settings'->>'fromEpisode')::int) AS first
         FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE l.deleted_at IS NULL AND l.name ~ ' · [A-Za-z]+ [0-9]+$'
          AND EXISTS (SELECT 1 FROM sports_matchups m WHERE m.season_id = ss.id AND m.key LIKE '%:season:%')`
    );
    const names = await sportsGameNames([...new Set(rows.map((r) => r.season_id))]);
    let n = 0;
    for (const r of rows) {
      // The episode its name says ("· Game 10"), which is the one game it plays.
      const ep = Number(/ (\d+)$/.exec(r.name)[1]);
      if (r.last !== null && r.last !== ep) continue;
      const label = names.get(r.season_id)?.[ep]?.long;
      if (!label) {
        console.log(`[rename] skip ${r.id}: no name for episode ${ep} (${r.name})`);
        continue;
      }
      const to = `${kindOf(r.name)} · ${label}`.slice(0, 80);
      console.log(`[rename] ${r.id}: "${r.name}" -> "${to}"`);
      if (!has("dry-run")) await pool.query("UPDATE leagues SET name = $2, updated_at = now() WHERE id = $1 AND name = $3", [r.id, to, r.name]);
      n++;
    }
    console.log(`[rename] ${has("dry-run") ? "would rename" : "renamed"} ${n} of ${rows.length} found`);
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
