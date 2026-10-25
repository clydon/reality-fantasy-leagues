// Dev-only test bank for playing solo (docs/PLAN-new-design.md step 9 part 3): a curated show nobody plays on a couch, so
// its seasons can have public pools and practice couches (solo.ts: a show an admin set up, its cast in, an episode to come).
//
//   "ZT Solo" (slug zt-so-solo, created_by NULL so it's curated, like a real show an admin made):
//     season 51 airing weekly at 8 PM Eastern, Episode 6 three days from today, its cast approved (Survivor 51's faces from
//       public/mock/showcase, never app users) in three tribes, and who went home in Episodes 1-5 accepted by an admin
//       (results_by 'admin', so the season sync brings them to every league on it, a pool's and a practice couch's too);
//     season 50 finished (nothing solo to play on it).
//   People on no couch, password zt-pass-12345: zt_so_alex (on Episode 5, caught up, follows 50 too), zt_so_riley and
//     zt_so_jordan (on 5), zt_so_sam (on 3: behind). Nobody is in a game yet: the check makes the pool and the practice
//     couch through the app.
//
//   node scripts/dev-test/solo-fixture.js up      create (or refresh) it, print the logins
//   node scripts/dev-test/solo-fixture.js down    remove every row it made, and every solo game on its seasons
//
// Also a module: `const { up, down, PEOPLE, PASSWORD, FACES } = require("./solo-fixture")`; `up(pool)` resolves
// { showId, seasonId, finishedSeasonId, users: { alex, ... }, cast: [{ id, name }] }. Keyed on the zt-so-solo slug and
// zt_so_ usernames (a solo game the app makes is found by its season), so `down` can't touch real data. Refuses a
// non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");

const DB = process.env.AUTH_DATABASE_URL || "";
const PASSWORD = "zt-pass-12345";
const PEOPLE = ["alex", "riley", "jordan", "sam"];
const SEEN = { alex: 5, riley: 5, jordan: 5, sam: 3 };
const username = (who) => `zt_so_${who}`;
const SHOW = "zt-so-solo";
const EPISODES = 13;
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// Survivor 51's castaways and the mock's photos of them; the first five went home in Episodes 1-5, in order.
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const TRIBES = ["Toka", "Savu", "Dina"];
const OUT = 5;

async function down(pool) {
  // Every solo game on its seasons (the app named them), then the show (its seasons, cast, results and follows go with it).
  await pool.query(
    `DELETE FROM leagues WHERE solo_season_id IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)
        OR (solo IS NOT NULL AND created_by IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_so\\_%'))`,
    [SHOW]
  );
  await pool.query(
    `DELETE FROM admin_changes WHERE entity_id IN (SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)`,
    [SHOW]
  );
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  // A couch a check started for one of them (Start a couch from the solo hub), with nobody else on it.
  await pool.query(
    `DELETE FROM couches c WHERE c.created_by IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_so\\_%')
        AND NOT EXISTS (SELECT 1 FROM couch_members m JOIN "user" u ON u.id = m.user_id WHERE m.couch_id = c.id AND u.username NOT LIKE 'zt\\_so\\_%')
        AND NOT EXISTS (SELECT 1 FROM leagues l WHERE l.couch_id = c.id)`
  );
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_so\\_%'`); // sessions, accounts, follows, memberships cascade
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const users = {};
  for (const who of PEOPLE) {
    users[who] = id();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $2, $2, now(), now())`,
      [users[who], username(who), `${username(who)}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      id(), users[who], hash,
    ]);
  }

  const show = (await one(`INSERT INTO shows (slug, name, created_by) VALUES ($1, 'ZT Solo', NULL) RETURNING id`, [SHOW])).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count, results_by)
     VALUES ($1, 51, 'ZT Solo 51', 'airing', current_date + 3 - 35, '20:00', 'America/New_York', 90, $2, 'admin') RETURNING id`,
    [show, EPISODES]
  )).id;
  const finished = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count, results_by)
     VALUES ($1, 50, 'ZT Solo 50', 'completed', current_date - 200, '20:00', 'America/New_York', 90, $2, 'admin') RETURNING id`,
    [show, EPISODES]
  )).id;
  const cast = [];
  for (const s of [season, finished]) {
    for (const [i, slug] of FACES.entries()) {
      const row = await one(`INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
        s, nameOf(slug), TRIBES[i % 3], `/mock/showcase/img/survivor-51/${slug}.jpg`, i,
      ]);
      if (s === season) cast.push({ id: row.id, name: nameOf(slug) });
    }
    await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [s]);
  }
  for (let n = 1; n <= OUT; n++) {
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
       VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now())`,
      [season, n, nameOf(FACES[n - 1])]
    );
  }
  for (const who of PEOPLE) {
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3)`, [users[who], season, SEEN[who]]);
  }
  await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3)`, [users.alex, finished, EPISODES]);
  return { showId: show, seasonId: season, finishedSeasonId: finished, users, cast };
}

/** Who went home in an episode, accepted by an admin (a check's next episode). */
async function addExit(pool, seasonId, episode, name) {
  await pool.query(
    `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
     VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now())`,
    [seasonId, episode, name]
  );
}

module.exports = { up, down, addExit, PEOPLE, PASSWORD, username, FACES, nameOf, SHOW };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("solo-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up"
    ? up(pool).then((fx) => console.log(`[zt] up: ZT Solo 51 (${fx.seasonId}); sign in as ${PEOPLE.map(username).join(", ")} / ${PASSWORD}`))
    : cmd === "down"
      ? down(pool).then(() => console.log("[zt] down"))
      : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
