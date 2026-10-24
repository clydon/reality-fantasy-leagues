// Read-only check of step 0b's data (docs/PLAN-new-design.md): on any database, after migrations 0100-0105,
// every league is on a couch, everyone in a league is on its couch, a linked group is one couch, every couch
// with people has one owner, and each person's progress on a season (show_follows) is at least the furthest of
// their leagues' marks. Prints counts only, never names. zt- fixtures are left out.
//
//   node scripts/dev-test/check-foundation-data.js                 the local database (.env.local)
//   $env:CHECK_DATABASE_URL = "<a Neon branch>"; node scripts/dev-test/check-foundation-data.js
//
// For a Neon branch: the user runs it with the branch's connection string in their own terminal (Claude
// never handles it), after `node db/migrate.js` against the same branch. Exits 1 on any problem.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { describeUrl } = require("../backup-common");

const URL_ = process.env.CHECK_DATABASE_URL || process.env.AUTH_DATABASE_URL;
const REAL = "l.slug NOT LIKE 'zt-%'";
const CHECKS = [
  ["leagues without a couch", `SELECT count(*) FROM leagues l WHERE ${REAL} AND l.couch_id IS NULL`],
  ["league members not on its couch", `SELECT count(*) FROM league_memberships m JOIN leagues l ON l.id = m.league_id
     WHERE ${REAL} AND NOT EXISTS (SELECT 1 FROM couch_members c WHERE c.couch_id = l.couch_id AND c.user_id = m.user_id)`],
  ["linked groups split across couches", `SELECT count(*) FROM (SELECT l.group_id FROM leagues l WHERE ${REAL} AND l.group_id IS NOT NULL
     GROUP BY 1 HAVING count(DISTINCT l.couch_id) > 1) g`],
  ["couches with people but not one owner", `SELECT count(*) FROM couches c WHERE EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = c.id)
     AND (SELECT count(*) FROM couch_members m WHERE m.couch_id = c.id AND m.role = 'owner') <> 1`],
  ["progress behind a league's mark", `SELECT count(*) FROM (
     SELECT m.user_id, ss.id AS season_id, max(COALESCE(m.results_seen_through, 0)) AS want
       FROM league_memberships m JOIN leagues l ON l.id = m.league_id
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ${REAL} GROUP BY 1, 2) x
     LEFT JOIN show_follows f ON f.user_id = x.user_id AND f.season_id = x.season_id
     WHERE f.seen_through IS NULL OR f.seen_through < x.want`],
];

(async () => {
  if (!URL_) throw new Error("no database: set CHECK_DATABASE_URL or AUTH_DATABASE_URL");
  const pool = new Pool({ connectionString: URL_ });
  try {
    console.log(`[check] ${describeUrl(URL_)}`);
    const { rows: m } = await pool.query("SELECT version FROM schema_migrations WHERE version >= '0100' ORDER BY version");
    console.log(`  migrations from 0100: ${m.map((r) => r.version.slice(0, 4)).join(", ") || "none"}`);
    const { rows: n } = await pool.query(
      `SELECT (SELECT count(*) FROM couches)::int AS couches, (SELECT count(*) FROM couch_members)::int AS members,
              (SELECT count(*) FROM leagues WHERE slug NOT LIKE 'zt-%')::int AS leagues, (SELECT count(*) FROM show_follows)::int AS follows`
    );
    console.log(`  ${n[0].leagues} leagues, ${n[0].couches} couches, ${n[0].members} couch members, ${n[0].follows} follows`);
    let problems = 0;
    for (const [what, sql] of CHECKS) {
      const count = Number((await pool.query(sql)).rows[0].count);
      problems += count;
      console.log(`  ${count ? "PROBLEM" : "ok     "} ${what}: ${count}`);
    }
    console.log(problems ? `[check] ${problems} problems` : "[check] all good");
    if (problems) process.exitCode = 1;
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
