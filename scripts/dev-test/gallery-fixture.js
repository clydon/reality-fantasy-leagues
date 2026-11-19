// Dev-only test bank: Start a game's gallery on real seasons (docs/PLAN-start-a-game-redo.md Round 2). In a local database that
// holds real seasons (the cast-properties lane's rfl_castprops: Survivor 51 through Episode 8, Below Deck 13 with no results yet, The
// Challenge 42 all aired), new-fixture.js's zt couch, with its four people following those seasons at set marks: alex and jordan up
// to date, sam one episode behind, riley two. So the gallery's When moves lock has someone behind on each, as the round's frames
// need. Sharing is left at its default (on), so the couch sees the marks.
//
//   node scripts/dev-test/gallery-fixture.js up   --db=rfl_castprops [--behind=sam:1,riley:2]
//   node scripts/dev-test/gallery-fixture.js down --db=rfl_castprops
//
// Also a module: `require("./gallery-fixture").up(pool, { behind })` resolves new-fixture's ids plus `seasons` (each real season's id,
// label and aired count) and `marks`. Touches only zt rows: new-fixture.js's zt-nd- couch, shows and zt_nd_ people, and those people's
// follows. Refuses a non-local database. Shares new-fixture's couch with other checks: never run two at once on the same database.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const fixture = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DB0 = process.env.AUTH_DATABASE_URL || "";
const dbNamed = (name) => (name ? DB0.replace(/\/([^/?]+)(\?.*)?$/, (m, d, q) => `/${name}${q ?? ""}`) : DB0);

/** The real seasons the gallery is shot on, when the database has them: by show name and season number. */
const REAL = [
  ["Survivor", 51],
  ["Below Deck", 13],
  ["The Challenge", 42],
  ["The Traitors (US)", 5],
];

/** The stand-in sports seasons check-sports-couch.js leaves (--keep): its football league's Eagles season and its basketball league's
 *  Sixers–Knicks series, by their league show's slug, the season with the most games. Followed when they're there. */
const SPORTS = [
  ["ztcf", "ZT Eagles"],
  ["ztcb", "ZT Sixers"],
];

async function seasonsIn(pool) {
  const out = [];
  for (const [slug, label] of SPORTS) {
    const r = await pool.query(
      `SELECT ss.id,
              (SELECT count(*)::int FROM season_episodes e WHERE e.season_id = ss.id AND e.air_at IS NOT NULL AND e.air_at <= now()) AS aired
         FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id
        WHERE sh.slug = $1
        ORDER BY (SELECT count(*) FROM season_episodes e WHERE e.season_id = ss.id) DESC LIMIT 1`,
      [slug]
    );
    if (r.rows[0]) out.push({ id: r.rows[0].id, label, aired: r.rows[0].aired, sport: true });
  }
  for (const [show, n] of REAL) {
    const r = await pool.query(
      `SELECT ss.id, sh.name, ss.season_number AS n,
              GREATEST((SELECT count(*)::int FROM season_episodes e WHERE e.season_id = ss.id AND e.air_at IS NOT NULL AND e.air_at <= now()),
                       (SELECT COALESCE(max(episode_number), 0)::int FROM season_decisions d WHERE d.season_id = ss.id AND d.status = 'accepted')) AS aired
         FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.name = $1 AND ss.season_number = $2`,
      [show, n]
    );
    if (r.rows[0]) out.push({ id: r.rows[0].id, label: `${show.replace(/\s*\(.*\)$/, "").replace(/^The /, "")} ${n}`, aired: r.rows[0].aired });
  }
  return out;
}

async function up(pool, { behind = { sam: 1, riley: 2 } } = {}) {
  const fx = await fixture.up(pool);
  const seasons = await seasonsIn(pool);
  const marks = [];
  for (const s of seasons) {
    for (const [who, id] of Object.entries(fx.users)) {
      if (!["alex", "riley", "jordan", "sam"].includes(who)) continue;
      const seen = Math.max(0, s.aired - (behind[who] || 0));
      await pool.query(
        `INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through, following = true, updated_at = now()`,
        [id, s.id, seen]
      );
      marks.push({ who, season: s.label, seen });
    }
  }
  return { ...fx, seasons, marks };
}

async function down(pool) {
  const seasons = await seasonsIn(pool);
  const ids = seasons.map((s) => s.id);
  if (ids.length) await pool.query(`DELETE FROM show_follows WHERE season_id = ANY($1::uuid[]) AND user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_nd\\_%')`, [ids]);
  await fixture.down(pool);
}

if (require.main === module) {
  (async () => {
    const url = dbNamed(opt("db", null));
    if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("gallery-fixture runs against a local database only");
    const pool = new Pool({ connectionString: url });
    try {
      if (args[0] === "down") {
        await down(pool);
        console.log("down: the zt couch and its follows on the real seasons are gone");
      } else {
        const behind = Object.fromEntries((opt("behind", "sam:1,riley:2") || "").split(",").filter(Boolean).map((x) => x.split(":")).map(([k, v]) => [k, Number(v)]));
        const r = await up(pool, { behind });
        console.log(`up: couch ${r.couchId}; ${r.seasons.map((s) => `${s.label} (${s.id}, ${s.aired} aired)`).join("; ")}`);
        console.log(`    sign in as zt_nd_alex / ${fixture.PASSWORD}; marks: ${r.marks.filter((m) => m.season === r.seasons[0]?.label).map((m) => `${m.who} ${m.seen}`).join(", ")}`);
      }
    } finally {
      await pool.end();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { up, down, seasonsIn };
