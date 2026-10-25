// Dev-only test bank for the new design's draft room and blind draft (docs/PLAN-new-design.md step 7): a zt couch about
// to draft. A zt Survivor season 52 that premieres in a week (8 PM Eastern, weekly), its cast approved (Survivor 51's
// faces from public/mock/showcase, three tribes), and a couch "ZT Draft Night" with two linked games on it, neither
// drafted yet and neither scheduled:
//   - "Couch Cup", Outlast with each castaway on one team: a turn-based (snake) draft of 4 each, in the mock's order
//     riley, alex, jordan, sam. alex is its Commissioner, riley a Game admin.
//   - "Lineup League", Weekly Lineup with castaways on several teams: a blind draft of 4 each (3 starters and a bench).
//     alex is its Commissioner.
// The people are the mock's demo names: zt_dr_alex, zt_dr_riley, zt_dr_jordan, zt_dr_sam (password zt-pass-12345).
//
//   node scripts/dev-test/draft-fixture.js up      create (or refresh) it, print the logins
//   node scripts/dev-test/draft-fixture.js down    remove every row it made
//
// Also a module: `const { up, down, PEOPLE, PASSWORD, username } = require("./draft-fixture")`; `up(pool, { size, players })`
// resolves { couchId, seasonId, groupId, leagues: { outlast, lineup }, users: { alex, ... }, cast: [{ id, name }] }.
// `size`: each team's size (default 4); `players`: who's in both games (default all four). Every row is keyed on zt-dr-
// slugs and zt_dr_ usernames, so `down` can't touch real data. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
const PASSWORD = "zt-pass-12345";
const PEOPLE = ["alex", "riley", "jordan", "sam"];
const ORDER = ["riley", "alex", "jordan", "sam"];
const username = (who) => `zt_dr_${who}`;
const SHOW = "zt-dr-survivor";
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const TRIBES = [["Toka", "#e0b23a"], ["Savu", "#9b6bd0"], ["Dina", "#f3214a"]];

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_dr\\_%'`);
  const userIds = users.map((u) => u.id);
  const { rows: couches } = await pool.query(
    `SELECT c.id FROM couches c
      WHERE (c.created_by = ANY($1::text[]) OR c.id IN (SELECT couch_id FROM leagues WHERE slug LIKE 'zt-dr-%'))
        AND NOT EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = c.id AND NOT (m.user_id = ANY($1::text[])))`,
    [userIds]
  );
  const { rows: groups } = await pool.query(`SELECT DISTINCT group_id FROM leagues WHERE slug LIKE 'zt-dr-%' AND group_id IS NOT NULL`);
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-dr-%'`); // memberships, queues, blind picks, Recent changes cascade
  if (groups.length) await pool.query(`DELETE FROM league_groups WHERE id = ANY($1::uuid[])`, [groups.map((g) => g.group_id)]);
  if (couches.length) await pool.query(`DELETE FROM couches WHERE id = ANY($1::uuid[])`, [couches.map((c) => c.id)]);
  await pool.query(`DELETE FROM rulebooks WHERE season_id IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)`, [SHOW]);
  await pool.query(`DELETE FROM shows WHERE slug = $1`, [SHOW]); // seasons, cast and follows go with it
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dr\\_%'`); // sessions, accounts cascade
}

/** A league about to draft, as Create a game leaves one: the season's cast in (linked to it), the players seated. */
function leagueState(type, shared, size, players, cast) {
  const s = S.defaultState();
  s.players = [];
  s.draftOrder = [];
  for (const who of players) S.addPlayer(s, who);
  s.settings.leagueTypeId = type;
  s.settings.ownershipMode = shared ? "shared" : "exclusive";
  s.settings.showId = SHOW;
  s.settings.wikiSeason = 52;
  s.settings.setupComplete = true;
  if (type === "active-roster") {
    s.settings.activeSlots = size - 1;
    s.settings.benchSlots = 1;
  } else s.settings.teamSize = size;
  S.applyCastImport(s, {
    tribes: TRIBES.map(([name, color]) => ({ name, color })),
    castaways: cast.map((c) => ({ id: c.id, name: c.name, photoUrl: c.photo, tribeName: c.tribe })),
  });
  // The mock's order: riley first.
  s.draftOrder = ORDER.filter((w) => players.includes(w)).map((w) => s.players.find((p) => p.name === w).id);
  return S.migrateLeagueState(s);
}

async function up(pool, opts = {}) {
  await down(pool);
  const size = opts.size ?? 4;
  const players = opts.players ?? PEOPLE;
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

  const show = (await one(`INSERT INTO shows (slug, name, created_by) VALUES ($1, 'ZT Survivor', $2) RETURNING id`, [SHOW, users.alex])).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 52, 'ZT Survivor 52', 'upcoming', current_date + 7, '20:00', 'America/New_York', 90, 13) RETURNING id`,
    [show]
  )).id;
  const cast = [];
  for (const [i, slug] of FACES.entries()) {
    const row = await one(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [season, nameOf(slug), TRIBES[i % 3][0], `/mock/showcase/img/survivor-51/${slug}.jpg`, i]
    );
    cast.push({ id: row.id, name: nameOf(slug), tribe: TRIBES[i % 3][0], photo: `/mock/showcase/img/survivor-51/${slug}.jpg` });
  }
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [season]);

  const couch = (await one(`INSERT INTO couches (name, created_by) VALUES ('ZT Draft Night', $1) RETURNING id`, [users.alex])).id;
  const group = (await one(`INSERT INTO league_groups (name, created_by) VALUES ('ZT Draft Night', $1) RETURNING id`, [users.alex])).id;
  const leagues = {};
  const games = [
    ["outlast", "zt-dr-outlast", "Couch Cup", "classic-draft", false],
    ["lineup", "zt-dr-lineup", "Lineup League", "active-roster", true],
  ];
  for (const [i, [key, slug, name, type, shared]] of games.entries()) {
    const state = leagueState(type, shared, size, players, cast);
    leagues[key] = (await one(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, slug, `ZTDR${i}X`, JSON.stringify(state), users.alex, group, i, couch]
    )).id;
    for (const who of players) {
      const role = who === "alex" ? "commissioner" : who === "riley" && key === "outlast" ? "admin" : "member";
      const seat = state.players.find((p) => p.name === who).id;
      await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, 0)`, [leagues[key], users[who], seat, role]);
    }
  }
  for (const who of PEOPLE) {
    await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)`, [couch, users[who], who === "alex" ? "owner" : "member"]);
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 0)`, [users[who], season]);
  }
  console.log(`[zt] up: sign in as ${PEOPLE.map(username).join(" / ")} (password ${PASSWORD}); couch "ZT Draft Night", a snake and a blind draft, not started`);
  return { couchId: couch, seasonId: season, groupId: group, leagues, users, cast: cast.map(({ id: cid, name }) => ({ id: cid, name })) };
}

module.exports = { up, down, PEOPLE, PASSWORD, username, ORDER };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("draft-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up" ? up(pool) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
