// Dev-only fixture: a crew show, for the cast tab's qualifier (the design round's step 5; the user, 2026-11-15: "positions:
// NFL WR, QB; Survivor tribes; Below Deck interior, chief stew, second stew"). One season of "ZT Yacht", a non-competition
// series whose cast is a yacht crew: each person's role (season_cast.role: "Chief stew", "Bosun") and department as their group
// (season_cast.tribe_name: Interior, Deck, Galley), no results yet. zt_nd_alex and zt_nd_riley watch it, so their Cast tab shows
// the crew by department with each one's role under their name.
//
// Layered on new-fixture.js's users (bring it up first: census-app.js --up, or new-fixture.js up). Its show is zt-cr-yacht, made
// by zt_nd_alex, so new-fixture.js's down removes it too; this file's down removes only what it added.
//
//   node scripts/dev-test/crew-fixture.js up      prints the season id: open /show/<id>/cast as zt_nd_alex (zt-pass-12345)
//   node scripts/dev-test/crew-fixture.js down
//
// Refuses a non-local database. Nothing here touches a real account or show.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");

const DB = process.env.AUTH_DATABASE_URL || "";
const SLUG = "zt-cr-yacht";
// [name, role, department]: a crew's usual shape, with a role that leaves mid-season in some seasons (not modelled: no results).
const CREW = [
  ["Kerry Hale", "Captain", "Bridge"],
  ["Aesha Monroe", "Chief stew", "Interior"],
  ["Daisy Kwon", "Second stew", "Interior"],
  ["Ruby Ortiz", "Third stew", "Interior"],
  ["Fraser Bligh", "Bosun", "Deck"],
  ["Gary Penn", "Lead deckhand", "Deck"],
  ["Jess Arlow", "Deckhand", "Deck"],
  ["Tomás Reyes", "Deckhand", "Deck"],
  ["Rachel Stone", "Chef", "Galley"],
];

async function down(pool) {
  await pool.query("DELETE FROM shows WHERE slug = $1", [SLUG]); // its season, cast, episodes and follows go with it
}

async function up(pool) {
  await down(pool);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const users = {};
  for (const who of ["alex", "riley"]) {
    const u = await one(`SELECT id FROM "user" WHERE username = $1`, [`zt_nd_${who}`]);
    if (!u) throw new Error(`zt_nd_${who} isn't here: bring new-fixture.js up first`);
    users[who] = u.id;
  }
  const show = (await one(
    `INSERT INTO shows (slug, name, kind, castaway_term, created_by, set_up_at) VALUES ($1, 'ZT Yacht', 'series', 'Crew member', $2, NULL) RETURNING id`,
    [SLUG, users.alex]
  )).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
     VALUES ($1, 11, 'airing', current_date - 15, '20:00', 'America/New_York', 14) RETURNING id`,
    [show]
  )).id;
  for (const [i, [name, role, dept]] of CREW.entries()) {
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, role, sort_order) VALUES ($1, $2, $3, $4, $5)`, [season, name, dept, role, i]);
  }
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [season]);
  for (const who of ["alex", "riley"]) await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 2, true)`, [users[who], season]);
  console.log(`[zt] crew fixture up: ZT Yacht season ${season} (${CREW.length} crew); /show/${season}/cast as zt_nd_alex`);
  return { season };
}

module.exports = { up, down, SLUG };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("crew-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "down" ? down(pool).then(() => console.log("[zt] crew fixture down")) : up(pool))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
