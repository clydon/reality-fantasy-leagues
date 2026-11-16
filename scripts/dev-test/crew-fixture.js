// Dev-only fixture: a crew show, for the cast tab's qualifier (the design round's step 5; the user, 2026-11-15: "positions:
// NFL WR, QB; Survivor tribes; Below Deck interior, chief stew, second stew"). One season of "ZT Yacht", a non-competition
// series whose cast is a yacht crew, made as Make it a game leaves a show (a season rulebook from Below Deck's library one, with
// its cast properties, department and job: docs/PLAN-cast-properties.md), each crew member's department and job in
// season_cast.props and a made-up bio in season_cast.bio, no tribes and no results yet. zt_nd_alex and zt_nd_riley watch it, so
// their Cast tab shows the crew by department with each one's job under their name, and a face opens who they are.
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
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
const SLUG = "zt-cr-yacht";
const FORMAT = "zt-cr-yacht";
// [name, job, department, bio]: a crew's usual shape (made up), with a bio as a network bills one; Tomás's says only a hometown,
// and Gary's none, as some do.
const CREW = [
  ["Kerry Hale", "Captain", "Bridge", { hometown: "Halifax, NS", age: 52, occupation: "Yacht captain", line: "Twenty years at the helm, and he still reads every guest preference sheet himself." }],
  ["Aesha Monroe", "Chief stew", "Interior", { hometown: "Ocean City, NJ", age: 31, occupation: "Chief stewardess", line: "Runs the interior like a five-star hotel, and expects her team to keep up." }],
  ["Daisy Kwon", "Second stew", "Interior", { hometown: "Perth, Australia", age: 26, occupation: "Stewardess" }],
  ["Ruby Ortiz", "Third stew", "Interior", { hometown: "San Juan, Puerto Rico", age: 24, occupation: "Stewardess", line: "First season on a charter yacht." }],
  ["Fraser Bligh", "Bosun", "Deck", { hometown: "Cork, Ireland", age: 29, occupation: "Bosun" }],
  ["Gary Penn", "Lead deckhand", "Deck", null],
  ["Jess Arlow", "Deckhand", "Deck", { hometown: "Tampa, FL", age: 25, occupation: "Deckhand" }],
  ["Tomás Reyes", "Deckhand", "Deck", { hometown: "Bournemouth, South Coast England" }],
  ["Rachel Stone", "Chef", "Galley", { hometown: "Cape Town, South Africa", age: 34, occupation: "Private chef" }],
];

async function down(pool) {
  await pool.query("DELETE FROM rulebooks WHERE season_id IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)", [SLUG]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SLUG]); // its season, cast, episodes and follows go with it
  await pool.query("DELETE FROM show_formats WHERE id = $1", [FORMAT]);
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
  const blocks = JSON.parse(JSON.stringify(LIBRARY["below-deck"].blocks));
  blocks.show = "ZT Yacht";
  const { data } = compileRulebook(blocks, { id: FORMAT, reader: "research" });
  const show = (await one(
    `INSERT INTO shows (slug, name, kind, castaway_term, created_by, set_up_at, format) VALUES ($1, 'ZT Yacht', 'series', 'Crew member', $2, NULL, $3) RETURNING id`,
    [SLUG, users.alex, FORMAT]
  )).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
     VALUES ($1, 11, 'airing', current_date - 15, '20:00', 'America/New_York', 14) RETURNING id`,
    [show]
  )).id;
  const book = (await one(
    `INSERT INTO rulebooks (name, kind, owner_kind, season_id, status, reader, blocks, compiled, compiled_source, aliases, provenance, review_status)
     VALUES ('ZT Yacht 11', 'series', 'season', $1, 'in_force', 'research', $2, $3, 'blocks', '{"events":{},"exits":{}}', '{"from":"made","by":"zt"}', 'reviewed') RETURNING id`,
    [season, JSON.stringify(blocks), JSON.stringify(data)]
  )).id;
  await pool.query("UPDATE show_seasons SET rulebook_id = $1, rulebook_live = true WHERE id = $2", [book, season]);
  await pool.query(
    `INSERT INTO show_formats (id, name, status, proposal, data, approved_at) VALUES ($1, 'ZT Yacht', 'approved', $2, $3, now()) ON CONFLICT (id) DO UPDATE SET proposal = EXCLUDED.proposal, data = EXCLUDED.data`,
    [FORMAT, JSON.stringify({ madeFrom: "rulebook", rulebookId: book }), JSON.stringify(data)]
  );
  // Gender, every show's (the user, 2026-11-16), as billed; Gary's inferred.
  const GENDER = { Kerry: "Man", Aesha: "Woman", Daisy: "Woman", Ruby: "Woman", Fraser: "Man", Gary: "Man", Jess: "Woman", "Tomás": "Man", Rachel: "Woman" };
  for (const [i, [name, job, department, bio]] of CREW.entries()) {
    const gender = GENDER[name.split(" ")[0]];
    const props = { department, job, gender, genderFrom: name.startsWith("Gary") ? "inferred" : "billed" };
    await pool.query(`INSERT INTO season_cast (season_id, name, props, bio, sort_order) VALUES ($1, $2, $3, $4, $5)`, [season, name, JSON.stringify(props), bio ? JSON.stringify(bio) : null, i]);
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
