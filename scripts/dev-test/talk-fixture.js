// Dev-only test bank for a talk show (docs/PLAN-new-design.md step 12 part 2: Weekly Calls, Call it on a show whose calls the
// couch settles): "ZT Talk Tonight", a zt show of kind talk that's set up as a game (its season's rulebook is the SNL sample's
// blocks, tests/fixtures/rulebook-samples.js, compiled), airing weekly on Saturdays at 11:30 PM Eastern with Episode 4 two days
// from today. On new-fixture.js's people: alex and riley follow it openly through Episode 3, jordan privately through 3, sam
// not at all; nobody plays it yet (a check starts Weekly Calls through the Start a game API).
//
//   node scripts/dev-test/talk-fixture.js up      create it (after new-fixture.js up), print what it made
//   node scripts/dev-test/talk-fixture.js down    remove it (and any game on its season)
//
// Also a module, like hub-fixture.js and guide-fixture.js: `up(pool, fx)` after new-fixture's `up` resolves
// { showId, seasonId, next: 4 }; `down(pool)`. new-fixture's down removes it too (a zt- show made by a zt_nd person, and the
// games zt_nd people started). Keyed on the slug zt-tk-talk. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const SAMPLES = require("../../tests/fixtures/rulebook-samples.js");

const DB = process.env.AUTH_DATABASE_URL || "";
const SLUG = "zt-tk-talk";
const NAME = "ZT Talk Tonight";
/** The next episode to air when it's brought up. */
const NEXT = 4;

async function one(pool, sql, params) {
  return (await pool.query(sql, params)).rows[0];
}

async function down(pool) {
  const { rows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1`,
    [SLUG]
  );
  const seasons = rows.map((r) => r.id);
  if (seasons.length) {
    // Any game a check started on it (Weekly Calls): leagues name their season by show slug and number.
    await pool.query(`DELETE FROM leagues WHERE state->'settings'->>'showId' = $1`, [SLUG]);
    await pool.query(`DELETE FROM rulebooks WHERE owner_kind = 'season' AND season_id = ANY($1::uuid[])`, [seasons]);
  }
  await pool.query(`DELETE FROM shows WHERE slug = $1`, [SLUG]);
}

async function up(pool, fx) {
  await down(pool);
  const users = fx.users;
  const blocks = { ...JSON.parse(JSON.stringify(SAMPLES.snl.blocks || SAMPLES.snl)), show: NAME };
  const compiled = compileRulebook(blocks, { id: `made-${SLUG}` });
  const show = (await one(pool, `INSERT INTO shows (slug, name, format, kind, created_by) VALUES ($1, $2, 'generic', 'talk', $3) RETURNING id`, [SLUG, NAME, users.alex])).id;
  // Weekly on Saturdays at 11:30 PM Eastern: Episode 4 in two days, so the premiere was three weeks before that.
  const season = (await one(
    pool,
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 1, $2, 'airing', current_date + 2 - ${(NEXT - 1) * 7}, '23:30', 'America/New_York', 90, 20) RETURNING id`,
    [show, `${NAME} 1`]
  )).id;
  const book = (await one(
    pool,
    // As Make it a game stores a made show's rulebook (make-game.ts): no legacy aliases to keep.
    `INSERT INTO rulebooks (name, kind, owner_kind, season_id, status, reader, blocks, compiled, compiled_source, aliases, provenance, created_by)
     VALUES ($1, 'talk', 'season', $2, 'in_force', 'research', $3, $4, 'blocks', '{"events": {}, "exits": {}}', $5, $6) RETURNING id`,
    [NAME, season, JSON.stringify(blocks), compiled.data ? JSON.stringify(compiled.data) : null, JSON.stringify({ from: "zt-fixture" }), users.alex]
  )).id;
  await pool.query(`UPDATE show_seasons SET rulebook_id = $1 WHERE id = $2`, [book, season]);
  for (const [who, priv] of [["alex", false], ["riley", false], ["jordan", true]]) {
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, private) VALUES ($1, $2, $3, $4)`, [users[who], season, NEXT - 1, priv]);
  }
  return { showId: show, seasonId: season, next: NEXT };
}

module.exports = { up, down, SLUG, NAME, NEXT };

if (require.main === module) {
  (async () => {
    if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("talk-fixture runs against a local database only");
    const pool = new Pool({ connectionString: DB });
    try {
      const cmd = process.argv[2];
      if (cmd === "down") {
        await down(pool);
        console.log("[zt] talk fixture down");
      } else if (cmd === "up") {
        const { rows } = await pool.query(`SELECT id, username FROM "user" WHERE username LIKE 'zt\\_nd\\_%'`);
        const users = Object.fromEntries(rows.map((r) => [r.username.replace(/^zt_nd_/, ""), r.id]));
        if (!users.alex) throw new Error("bring new-fixture.js up first");
        const out = await up(pool, { users });
        console.log(`[zt] up: ${NAME} (talk), Episode ${out.next} in two days; season ${out.seasonId}`);
      } else {
        throw new Error("usage: talk-fixture.js up|down");
      }
    } finally {
      await pool.end();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
