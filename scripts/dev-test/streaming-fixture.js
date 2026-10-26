// Dev-only fixture for streaming shows and the rail (docs/PLAN-new-design.md step 14), layered on new-fixture.js's couch (alex,
// riley, jordan, sam; casey on another couch): seasons watched at your own pace, each a kind of chip on alex's rail, timed from
// the moment it's brought up. Shows are "not a game yet" series with a TV listing's service (shows.listing.network) and the
// mock's key art.
//   ZT Severed       a streaming season (S2), all 10 dropped 20 days ago on Apple TV+: alex is on 3 (Continue · Ep 4),
//                    riley and jordan stream it openly. riley planned Episode 7 for Saturday 9 PM, jordan's in.
//   ZT Fresh Drop    all 6 dropped two days ago on Netflix: sam streams it, alex doesn't (a new drop with a ＋).
//   ZT Old Wire      a finished weekly season from 2002 (13 episodes), nobody plays it: jordan watches it openly and planned
//                    Episode 2 for tomorrow 9 PM (the couch's planned night).
//   ZT Done Binge    dropped 40 days ago on Hulu: alex finished it, riley streams it ("You finished it").
//   ZT Coming Soon   all 8 drop in three days at 9 PM Eastern on HBO Max: alex and riley follow it (an upcoming drop, "1 waiting").
//   ZT Alone Binge   dropped 60 days ago: only alex, who finished it (not on the rail).
//   ZT Secret Stream dropped 10 days ago: sam watches it PRIVATELY (on sam's rail, nobody else's).
// So alex's rail is Severed, Fresh Drop, Old Wire, Done Binge, Coming Soon (See all 5).
//
//   const fx = await require("./new-fixture").up(pool);
//   const st = await require("./streaming-fixture").up(pool, fx);   // { seasons: { severed, fresh, wire, done, soon, alone, secret }, plans, dropAt }
//   ... node scripts/dev-test/streaming-fixture.js up | down          (up brings new-fixture.js up first)
//
// Shows are zt-st- slugs made by zt_nd_alex, so new-fixture.js's down removes them too (and the plans and follows with them);
// this file's own down takes out only what it added. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const newFixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const SHOWS = {
  severed: ["zt-st-severed", "ZT Severed", "severance", "Apple TV+"],
  fresh: ["zt-st-fresh-drop", "ZT Fresh Drop", "squid-game", "Netflix"],
  wire: ["zt-st-old-wire", "ZT Old Wire", "the-wire", "HBO Max"],
  done: ["zt-st-done-binge", "ZT Done Binge", "the-bear", "Hulu"],
  soon: ["zt-st-coming-soon", "ZT Coming Soon", "harry-potter", "HBO Max"],
  alone: ["zt-st-alone-binge", "ZT Alone Binge", "slow-horses", "Apple TV+"],
  secret: ["zt-st-secret-stream", "ZT Secret Stream", "stranger-things", "Netflix"],
};
const SLUGS = Object.values(SHOWS).map((s) => s[0]);

async function down(pool) {
  await pool.query("DELETE FROM shows WHERE slug = ANY($1::text[])", [SLUGS]); // seasons, follows, plans and sessions go with them
}

/** A time `days` from today at `hh:mm` Eastern. */
async function easternAt(pool, days, hhmm) {
  const { rows } = await pool.query(`SELECT ((current_date + $1::int) + $2::time) AT TIME ZONE 'America/New_York' AS at`, [days, hhmm]);
  return rows[0].at;
}

async function up(pool, fx) {
  await down(pool);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const { users } = fx;
  const show = async (key) => {
    const [slug, name, art, network] = SHOWS[key];
    return (
      await one(
        `INSERT INTO shows (slug, name, kind, created_by, set_up_at, art_url, listing) VALUES ($1, $2, 'series', $3, NULL, $4, $5) RETURNING id`,
        [slug, name, users.alex, `/mock/showcase/art/${art}.jpg`, JSON.stringify({ name, network, country: "US", type: "Scripted", kind: "series" })]
      )
    ).id;
  };
  const binge = async (key, number, count, dropAt) =>
    (
      await one(
        `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_tz, release, drop_at, episode_count)
         VALUES ($1, $2, $3, ($4::timestamptz AT TIME ZONE 'America/New_York')::date, 'America/New_York', 'binge', $4, $5) RETURNING id`,
        [await show(key), number, new Date(dropAt).getTime() > Date.now() ? "upcoming" : "completed", new Date(dropAt).toISOString(), count]
      )
    ).id;
  const follow = (who, season, seen = 0, priv = false) =>
    pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, following, private) VALUES ($1, $2, $3, true, $4)`, [users[who], season, seen, priv]);
  const plan = async (season, episode, at, host, ins) => {
    const id = (
      await one(`INSERT INTO watch_plans (couch_id, season_id, episode, how, starts_at, created_by) VALUES ($1, $2, $3, 'start', $4, $5) RETURNING id`, [
        fx.couchId, season, episode, at, users[host],
      ])
    ).id;
    await pool.query(`INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) VALUES ($1, $2, 'in', false, now())`, [id, users[host]]);
    for (const who of ins) await pool.query(`INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) VALUES ($1, $2, 'in', true, now())`, [id, users[who]]);
    return id;
  };
  const now = Date.now();
  const seasons = {};

  seasons.severed = await binge("severed", 2, 10, now - 20 * DAY);
  await follow("alex", seasons.severed, 3);
  await follow("riley", seasons.severed, 6);
  await follow("jordan", seasons.severed, 9);

  seasons.fresh = await binge("fresh", 1, 6, now - 2 * DAY);
  await follow("sam", seasons.fresh, 2);

  // A finished weekly season from long ago: nobody plays it, so it's watched at your own pace.
  seasons.wire = (
    await one(
      `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count, episode_minutes)
       VALUES ($1, 1, 'completed', '2002-06-02', '21:00', 'America/New_York', 13, 60) RETURNING id`,
      [await show("wire")]
    )
  ).id;
  await follow("jordan", seasons.wire, 4);

  seasons.done = await binge("done", 4, 8, now - 40 * DAY);
  await follow("alex", seasons.done, 8);
  await follow("riley", seasons.done, 2);

  const dropAt = await easternAt(pool, 3, "21:00");
  seasons.soon = await binge("soon", 1, 8, dropAt);
  await follow("alex", seasons.soon, 0);
  await follow("riley", seasons.soon, 0);

  seasons.alone = await binge("alone", 1, 6, now - 60 * DAY);
  await follow("alex", seasons.alone, 6);

  seasons.secret = await binge("secret", 1, 6, now - 10 * DAY);
  await follow("sam", seasons.secret, 1, true);

  // The couch's planned nights: Severed Episode 7 on Saturday at 9 PM (riley, jordan in), Old Wire Episode 2 tomorrow at 9 PM (jordan).
  const saturday = (6 - new Date().getDay() + 7) % 7 || 7;
  const plans = {
    severed: await plan(seasons.severed, 7, await easternAt(pool, saturday, "21:00"), "riley", ["jordan"]),
    wire: await plan(seasons.wire, 2, await easternAt(pool, 1, "21:00"), "jordan", []),
  };
  return { seasons, plans, dropAt };
}

module.exports = { up, down, SLUGS };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("streaming-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up"
    ? newFixture.up(pool).then((fx) => up(pool, fx)).then((st) => console.log("[zt] streaming fixture up:", st.seasons))
    : cmd === "down"
      ? down(pool).then(() => console.log("[zt] streaming fixture down"))
      : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
