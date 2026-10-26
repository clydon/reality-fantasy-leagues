// Dev-only fixture for the TV guide (docs/PLAN-new-design.md step 11 part 1), layered on new-fixture.js's couch: shows that
// put something on most of the guide's kinds of card this week, timed from the moment it's brought up.
//   ZT Late Show     a talk show, nightly at 11:35 PM Eastern: alex and riley watch it openly (dashed for alex: no game).
//   ZT Live Now      on the air right now (its Episode 3 started ten minutes ago, an hour long): alex watches it PRIVATELY,
//                    so nobody else on the couch may see it anywhere (the guide's privacy case).
//   ZT Drop Show     a streaming season, all 8 episodes at once two days from now: riley and jordan watch it openly, alex
//                    doesn't (a faded couch show for alex: its sheet, Add to my shows, Hide from guide).
//   ZT Same Night    alex's own show, whose next episode starts at the very moment new-fixture's ZT Traitors next airs (a
//                    couch show for alex: riley watches it openly): "Same time".
// Plus new-fixture's own: ZT Survivor 51 (the couch's games, a move due for alex) and the Traitors.
//
//   const fx = await require("./new-fixture").up(pool);
//   const gd = await require("./guide-fixture").up(pool, fx);   // { seasons: { late, live, drop, same }, traitorsAt }
//   ... node scripts/dev-test/guide-fixture.js up | down          (up brings new-fixture.js up first)
//
// Shows are zt-gd- slugs made by zt_nd_alex, so new-fixture.js's down removes them too; this file's own down takes out only
// what it added. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../../src/lib/game/air-schedule.js");
const newFixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
const SLUGS = ["zt-gd-late-show", "zt-gd-live-now", "zt-gd-drop-show", "zt-gd-same-night"];
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function down(pool) {
  await pool.query("DELETE FROM shows WHERE slug = ANY($1::text[])", [SLUGS]); // seasons, episodes, follows and hidden rows go with them
}

async function up(pool, fx) {
  await down(pool);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const { users } = fx;
  const show = async (slug, name, kind) =>
    (await one(`INSERT INTO shows (slug, name, kind, created_by, set_up_at) VALUES ($1, $2, $3, $4, NULL) RETURNING id`, [slug, name, kind, users.alex])).id;
  const follow = (who, season, priv = false, seen = 0) =>
    pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, following, private) VALUES ($1, $2, $3, true, $4)`, [users[who], season, seen, priv]);
  const episodes = async (season, list) => {
    for (const [number, at, runtime] of list) {
      await pool.query(`INSERT INTO season_episodes (season_id, number, air_at, runtime_min, title, source) VALUES ($1, $2, $3, $4, $5, 'listing')`, [
        season, number, new Date(at).toISOString(), runtime, `Secret title ${number}`,
      ]);
    }
  };
  const now = Date.now();

  // Nightly at 11:35 PM Eastern, a month in.
  const late = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_minutes)
     VALUES ($1, 12, 'airing', current_date - 30, '23:35', 'America/New_York', 'nightly', 60) RETURNING id`,
    [await show(SLUGS[0], "ZT Late Show", "talk")]
  )).id;
  await follow("alex", late, false, 20);
  await follow("riley", late, false, 25);

  // On now: Episode 3 started ten minutes ago; 2 and 1 the two weeks before, 4 a week on.
  const live = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
     VALUES ($1, 1, 'airing', current_date - 14, '20:00', 'America/New_York', 8) RETURNING id`,
    [await show(SLUGS[1], "ZT Live Now", "series")]
  )).id;
  const started = now - 10 * MIN;
  await episodes(live, [[1, started - 14 * DAY, 60], [2, started - 7 * DAY, 60], [3, started, 60], [4, started + 7 * DAY, 60]]);
  await follow("alex", live, true, 2);

  // Every episode at once, two days from now.
  const dropAt = new Date(now + 2 * DAY);
  dropAt.setMinutes(0, 0, 0);
  const drop = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_tz, release, drop_at, episode_count)
     VALUES ($1, 1, 'upcoming', $2::date, 'America/New_York', 'binge', $2, 8) RETURNING id`,
    [await show(SLUGS[2], "ZT Drop Show", "series"), dropAt.toISOString()]
  )).id;
  await episodes(drop, Array.from({ length: 8 }, (_, i) => [i + 1, dropAt.getTime(), 50]));
  await follow("riley", drop);
  await follow("jordan", drop);

  // The Traitors' next airing (new-fixture: weekly at 9 PM Eastern), and alex's show starting at the same moment.
  const { rows: tr } = await pool.query(
    `SELECT to_char(premiere_date, 'YYYY-MM-DD') AS premiere, to_char(air_time, 'HH24:MI') AS air_time, air_tz FROM show_seasons WHERE id = $1`,
    [fx.traitorsSeasonId]
  );
  const season = { premiereDate: tr[0].premiere, airTime: tr[0].air_time, airTz: tr[0].air_tz };
  let traitorsAt = null;
  for (let n = 1; n < 60 && !traitorsAt; n++) {
    const at = Air.episodeAirTime(season, n, {});
    if (at && at.getTime() > now + 30 * MIN) traitorsAt = at;
  }
  const same = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
     VALUES ($1, 3, 'airing', $2::date, '21:00', 'America/New_York', 10) RETURNING id`,
    [await show(SLUGS[3], "ZT Same Night", "competition"), new Date(traitorsAt.getTime() - 21 * DAY).toISOString()]
  )).id;
  await episodes(same, [[3, traitorsAt.getTime() - 7 * DAY, 60], [4, traitorsAt.getTime(), 60], [5, traitorsAt.getTime() + 7 * DAY, 60]]);
  await follow("alex", same, false, 3);

  console.log(`[zt] guide fixture up: late ${late}, live ${live}, drop ${drop} (${dropAt.toISOString()}), same ${same} (${traitorsAt.toISOString()})`);
  return { seasons: { late, live, drop, same }, traitorsAt: traitorsAt.toISOString(), dropAt: dropAt.toISOString() };
}

module.exports = { up, down, SLUGS };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("guide-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up" ? newFixture.up(pool).then((fx) => up(pool, fx)) : cmd === "down" ? down(pool).then(() => console.log("[zt] guide fixture down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
