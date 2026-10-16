// Dev-only test bank: a throwaway user in a LINKED group of three leagues (Classic, Active Roster,
// Eliminator Pool) on one made-up season, with results hidden for the last two episodes -- the setup
// for checking the reveal, the league dropdown, swipe between leagues, and anything else linked.
//
//   node scripts/dev-test/linked-fixture.js up        create (or refresh) it, print the login
//   node scripts/dev-test/linked-fixture.js down      remove every row it made
//
// Everything is keyed on the "zt-" slug prefix and the "zt_tester" username, so `down` can't touch
// real data, and it never touches the real "conor" account. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const USERNAME = "zt_tester";
const PASSWORD = "zt-pass-12345";
const EPISODES = 12;
const CURSOR = 6; // results in through episode 6
const SEEN = 4; // the tester has revealed through 4: episodes 5-6 wait for the reveal
const data = {
  id: "zt", showId: "survivor", showName: "Survivor", seasonName: "Test", episodeCount: EPISODES,
  players: ["tester", "ann", "bo"].map((key) => ({ key, name: key, color: "#888" })),
  castaways: Array.from({ length: 20 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 20 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 19 ? "Sole Survivor" : "Voted Out",
  })),
};
const LEAGUES = [
  ["zt-classic", "Hosers", "classic-draft"],
  ["zt-roster", "The Very Long Island Crew Roster League", "active-roster"],
  ["zt-pool", "Pool Party", "pickem"],
];
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

async function down(pool) {
  const { rows } = await pool.query(`SELECT id, group_id FROM leagues WHERE slug LIKE 'zt-%'`);
  const groups = [...new Set(rows.map((r) => r.group_id).filter(Boolean))];
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-%'`); // memberships cascade
  if (groups.length) await pool.query(`DELETE FROM league_groups WHERE id = ANY($1::uuid[])`, [groups]);
  await pool.query(`DELETE FROM "user" WHERE username = $1`, [USERNAME]); // sessions/accounts cascade
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,$2,$2,'admin',now(),now())`,
    [userId, USERNAME, `${USERNAME}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
    [id(), userId, await hashPassword(PASSWORD)]
  );
  const { rows: g } = await pool.query(`INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id`, [userId]);
  for (const [i, [slug, name, type]] of LEAGUES.entries()) {
    const state = JSON.parse(JSON.stringify(buildDemoState(data, type, CURSOR)));
    S.migrateLeagueState(state);
    state.settings.showId = "survivor";
    state.settings.wikiSeason = 99;
    const me = state.players[0].id;
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, slug, slug.slice(3, 9).toUpperCase().padEnd(6, "X"), JSON.stringify(state), userId, g[0].id, i]
    );
    await pool.query(
      `INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1,$2,$3,'commissioner',$4)`,
      [rows[0].id, userId, me, SEEN]
    );
  }
  console.log(`[zt] up: sign in as ${USERNAME} / ${PASSWORD}; 3 linked leagues, episodes ${SEEN + 1}-${CURSOR} hidden`);
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const cmd = process.argv[2];
  (cmd === "up" ? up(pool) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
