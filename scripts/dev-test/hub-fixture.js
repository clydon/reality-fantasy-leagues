// Dev-only fixture for the hub's couch pages (docs/PLAN-new-design.md step 8: power rankings, the trophy shelf, your
// numbers), layered on new-fixture.js's couch: two finished seasons of its zt show, played by the same four people.
//   ZT Survivor 49 (premiered in March last year): "Cup 49", an Outlast riley won.
//   ZT Survivor 50 (premiered about 230 days ago): "Cup 50", an Outlast riley won again (Ran it back), and "Pool 50",
//   a Survival Pool alex won.
// Everyone has seen both to the end (show_follows and league marks at 13), so the seasons have ended for them: the
// trophy shelf shows, and both seasons count in the rankings (Survivor 49 only all-time). Built from the demo builder at
// episode 13, with the seats' names swapped so the winners are who the checks expect.
//
//   const fx = await require("./new-fixture").up(pool);
//   const hub = await require("./hub-fixture").up(pool, fx);   // { seasons: { s49, s50 }, leagues: { cup49, cup50, pool50 } }
//   ... node scripts/dev-test/hub-fixture.js up | down          (up brings new-fixture.js up first)
//
// Rows are keyed on zt-nd- slugs and the zt show, so new-fixture.js's down removes them too (its leagues by slug, the
// seasons with the show); this file's own down takes out only what it added. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const { tableOf } = jiti("../../src/lib/game/game-view.ts");
const S = require("../../src/lib/game/state-logic.js");
const newFixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
const SHOW = "zt-nd-survivor";
const EPISODES = 13;
const PEOPLE = ["alex", "riley", "jordan", "sam"];
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
// [key, slug, name, season, type, who wins]
const LEAGUES = [
  ["cup49", "zt-nd-s49-cup", "Cup 49", "s49", "classic-draft", "riley"],
  ["cup50", "zt-nd-s50-cup", "Cup 50", "s50", "classic-draft", "riley"],
  ["pool50", "zt-nd-s50-pool", "Pool 50", "s50", "pickem", "alex"],
];

/** A finished season of `type`, its seats renamed so `winner` finished first. */
function finished(type, number, winner) {
  const data = {
    id: `zt-nd-${number}`, showId: SHOW, showName: "ZT Survivor", seasonName: `ZT Survivor ${number}`, episodeCount: EPISODES,
    players: PEOPLE.map((key) => ({ key, name: key, color: "#888" })),
    castaways: FACES.map((slug, i) => ({
      key: `k${i}`, name: nameOf(slug), placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`,
      exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
    })),
  };
  const state = JSON.parse(JSON.stringify(buildDemoState(data, type, EPISODES)));
  S.migrateLeagueState(state);
  state.settings.showId = SHOW;
  state.settings.wikiSeason = number;
  const top = tableOf(state, "", () => null)[0];
  const first = state.players.find((p) => p.id === top.playerId);
  const want = state.players.find((p) => p.name === winner);
  if (first !== want) [first.name, want.name] = [want.name, first.name];
  return state;
}

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-nd-s49-%' OR slug LIKE 'zt-nd-s50-%'`);
  await pool.query(`DELETE FROM show_seasons WHERE season_number IN (49, 50) AND show_id IN (SELECT id FROM shows WHERE slug = $1)`, [SHOW]);
}

async function up(pool, fx) {
  await down(pool);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const show = (await one(`SELECT id FROM shows WHERE slug = $1`, [SHOW])).id;
  const seasons = {
    s49: (await one(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
       VALUES ($1, 49, 'ZT Survivor 49', 'completed', make_date(extract(year FROM current_date)::int - 1, 3, 4), '20:00', 'America/New_York', 90, $2) RETURNING id`,
      [show, EPISODES]
    )).id,
    s50: (await one(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
       VALUES ($1, 50, 'ZT Survivor 50', 'completed', current_date - 230, '20:00', 'America/New_York', 90, $2) RETURNING id`,
      [show, EPISODES]
    )).id,
  };
  const leagues = {};
  for (const [key, slug, name, season, type, winner] of LEAGUES) {
    const state = finished(type, season === "s49" ? 49 : 50, winner);
    leagues[key] = (await one(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, slug, slug.replace(/[^a-z0-9]/g, "").slice(4, 10).toUpperCase().padEnd(6, "O"), JSON.stringify(state), fx.users.alex, fx.couchId]
    )).id;
    for (const who of PEOPLE) {
      await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)`, [
        leagues[key], fx.users[who], state.players.find((p) => p.name === who).id, who === "alex" ? "commissioner" : "member", EPISODES,
      ]);
    }
  }
  for (const season of Object.values(seasons)) {
    for (const who of PEOPLE) {
      await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through`, [
        fx.users[who], season, EPISODES,
      ]);
    }
  }
  console.log("[zt] hub up: ZT Survivor 49 and 50 finished on the couch (Cup 49, Cup 50: riley; Pool 50: alex)");
  return { seasons, leagues };
}

module.exports = { up, down };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("hub-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up" ? newFixture.up(pool).then((fx) => up(pool, fx)) : cmd === "down" ? down(pool).then(() => newFixture.down(pool)).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
