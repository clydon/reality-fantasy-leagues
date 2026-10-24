// Dev-only test bank for the new design's foundation (docs/PLAN-new-design.md step 0b): a zt couch shaped like
// the live one after 0101 and 0103. Three linked leagues (Outlast, Weekly Lineup, Survival Pool) on a zt
// show's season 51, four people on all three (the mock's demo names: alex runs them, riley is a Game admin in
// the lineup league), results through episode 5 and everyone revealed through 5 except sam (3). Weekly at
// 8 PM Eastern, 90 minutes, with episode 6 three days from today.
//
// Also, for sharing and access checks: a zt Traitors season that riley follows openly and jordan privately; and
// a league outside the group on the same season, on its own couch ("ZT Extra": alex and casey), ready to link.
//
//   node scripts/dev-test/new-fixture.js up      create (or refresh) it, print the logins
//   node scripts/dev-test/new-fixture.js down    remove every row it made
//
// Also a module: `const { up, down, PEOPLE, PASSWORD } = require("./new-fixture")`; `up` resolves
// { couchId, extraCouchId, seasonId, traitorsSeasonId, groupId, leagues: { outlast, lineup, pool, extra }, users: { alex, ... } }.
// Every row is keyed on zt-nd- slugs and zt_nd_ usernames, so `down` can't touch real data. Refuses a
// non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
const PASSWORD = "zt-pass-12345";
const PEOPLE = ["alex", "riley", "jordan", "sam", "casey"];
const username = (who) => `zt_nd_${who}`;
const SHOW = "zt-nd-survivor";
const TRAITORS = "zt-nd-traitors";
const EPISODES = 13;
const CURSOR = 5; // results in through episode 5
const SEEN = { alex: 5, riley: 5, jordan: 5, sam: 3 };
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

const data = {
  id: "zt-nd", showId: SHOW, showName: "ZT Survivor", seasonName: "ZT Survivor 51", episodeCount: EPISODES,
  players: ["alex", "riley", "jordan", "sam"].map((key) => ({ key, name: key, color: "#888" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 18 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const LEAGUES = [
  ["outlast", "zt-nd-outlast", "Couch Cup", "classic-draft"],
  ["lineup", "zt-nd-lineup", "Lineup League", "active-roster"],
  ["pool", "zt-nd-pool", "Pool Party", "pickem"],
];

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_nd\\_%'`);
  const userIds = users.map((u) => u.id);
  // Couches the fixture or a check made: on zt-nd leagues, or made by zt_nd people, with nobody else on them.
  const { rows: couches } = await pool.query(
    `SELECT c.id FROM couches c
      WHERE (c.created_by = ANY($1::text[]) OR c.id IN (SELECT couch_id FROM leagues WHERE slug LIKE 'zt-nd-%'))
        AND NOT EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = c.id AND NOT (m.user_id = ANY($1::text[])))`,
    [userIds]
  );
  const { rows: groups } = await pool.query(`SELECT DISTINCT group_id FROM leagues WHERE slug LIKE 'zt-nd-%' AND group_id IS NOT NULL`);
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-nd-%'`); // memberships cascade
  if (groups.length) await pool.query(`DELETE FROM league_groups WHERE id = ANY($1::uuid[])`, [groups.map((g) => g.group_id)]);
  if (couches.length) await pool.query(`DELETE FROM couches WHERE id = ANY($1::uuid[])`, [couches.map((c) => c.id)]);
  await pool.query(`DELETE FROM shows WHERE slug IN ($1, $2)`, [SHOW, TRAITORS]); // seasons and follows go with them
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_nd\\_%'`); // sessions, accounts, follows cascade
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

  // Episode 6 airs three days from today at 8 PM Eastern: the premiere was five weeks before that.
  const show = (await one(`INSERT INTO shows (slug, name, created_by) VALUES ($1, 'ZT Survivor', $2) RETURNING id`, [SHOW, users.alex])).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 51, 'ZT Survivor 51', 'airing', current_date + 3 - 35, '20:00', 'America/New_York', 90, $2) RETURNING id`,
    [show, EPISODES]
  )).id;
  const traitorsShow = (await one(`INSERT INTO shows (slug, name, format, created_by) VALUES ($1, 'ZT Traitors', 'traitors', $2) RETURNING id`, [TRAITORS, users.alex])).id;
  const traitorsSeason = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time) VALUES ($1, 5, 'airing', current_date - 20, '21:00') RETURNING id`,
    [traitorsShow]
  )).id;

  // The couch, as 0101 makes one from a linked group with no name: the show and season, its maker the owner.
  const couch = (await one(`INSERT INTO couches (name, created_by) VALUES ('ZT Survivor 51', $1) RETURNING id`, [users.alex])).id;
  const group = (await one(`INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id`, [users.alex])).id;
  const leagues = {};
  const build = (type, players) => {
    const state = JSON.parse(JSON.stringify(buildDemoState({ ...data, players: players.map((key) => ({ key, name: key, color: "#888" })) }, type, CURSOR)));
    S.migrateLeagueState(state);
    state.settings.showId = SHOW;
    state.settings.wikiSeason = 51;
    return state;
  };
  const insertLeague = async (slug, name, state, groupId, pos, couchId) =>
    (await one(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, slug, slug.replace(/[^a-z]/g, "").slice(4, 10).toUpperCase().padEnd(6, "O"), JSON.stringify(state), users.alex, groupId, pos, couchId]
    )).id;
  for (const [i, [key, slug, name, type]] of LEAGUES.entries()) {
    const state = build(type, ["alex", "riley", "jordan", "sam"]);
    leagues[key] = await insertLeague(slug, name, state, group, i, couch);
    for (const [j, who] of ["alex", "riley", "jordan", "sam"].entries()) {
      const role = who === "alex" ? "commissioner" : who === "riley" && key === "lineup" ? "admin" : "member";
      await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)`, [
        leagues[key], users[who], state.players[j].id, role, SEEN[who],
      ]);
    }
  }
  for (const who of ["alex", "riley", "jordan", "sam"]) {
    await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)`, [couch, users[who], who === "alex" ? "owner" : "member"]);
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3)`, [users[who], season, SEEN[who]]);
  }
  await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 2)`, [users.riley, traitorsSeason]);
  await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, private) VALUES ($1, $2, 4, true)`, [users.jordan, traitorsSeason]);

  // A league outside the group on the same season, on a couch of its own: alex runs it, casey plays.
  const extraCouch = (await one(`INSERT INTO couches (name, created_by) VALUES ('ZT Extra', $1) RETURNING id`, [users.alex])).id;
  const extraState = build("pickem", ["alex", "casey"]);
  leagues.extra = await insertLeague("zt-nd-extra", "ZT Extra", extraState, null, null, extraCouch);
  for (const [j, who] of ["alex", "casey"].entries()) {
    await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, 5)`, [
      leagues.extra, users[who], extraState.players[j].id, who === "alex" ? "commissioner" : "member",
    ]);
    await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)`, [extraCouch, users[who], who === "alex" ? "owner" : "member"]);
  }
  await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 5)`, [users.casey, season]);

  console.log(`[zt] up: sign in as ${PEOPLE.map(username).join(" / ")} (password ${PASSWORD}); couch "ZT Survivor 51", 3 linked leagues, episode 6 in 3 days`);
  return { couchId: couch, extraCouchId: extraCouch, seasonId: season, traitorsSeasonId: traitorsSeason, groupId: group, leagues, users };
}

module.exports = { up, down, PEOPLE, PASSWORD, username };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("new-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up" ? up(pool) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
