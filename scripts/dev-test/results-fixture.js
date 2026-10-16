// Dev-only test bank: a commissioner whose episode results are theirs to fill in -- the setup for
// checking the Episodes tab's week, the "fill in the results" task (Episodes, the alert strip, the
// morning-after push) and the results page, for every league type at once.
//
//   node scripts/dev-test/results-fixture.js up [--staged] [--when=aired|airing|upcoming]
//   node scripts/dev-test/results-fixture.js down
//
// Makes a throwaway season (Survivor season 990, named "zt-results", results_by 'leagues', airing
// weekly) and three unlinked leagues on it -- Classic, Active Roster, Eliminator Pool -- with results
// in through episode 3. Two users in each: zt_comm (the commissioner, player "tester") and zt_player
// (an ordinary player, "ann"), both pass zt-pass-12345, both seen through episode 3.
//   --when=aired     episode 4 aired last night and has no results (default): the commissioner's job
//   --when=airing    episode 4 started 30 minutes ago
//   --when=upcoming  episode 4 airs in two days: lineups and picks still open
//   --staged         research has already staged episode 4's results (one exit, one scoring event)
//
// Every row is keyed on the "zt-" slug prefix, the "zt-results" season name and the zt_ usernames, so
// `down` can't touch real data. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const USERS = [
  ["zt_comm", "commissioner", 0],
  ["zt_player", "member", 1],
];
const PASSWORD = "zt-pass-12345";
const SEASON = 990;
const SEASON_NAME = "zt-results";
const EPISODES = 12;
const CURSOR = 3; // results in through episode 3; episode 4 is the one in question
const TZ = "America/New_York";
const data = {
  id: "zt", showId: "survivor", showName: "Survivor", seasonName: "Results test", episodeCount: EPISODES,
  players: ["tester", "ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#888" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${String.fromCharCode(65 + i)}`, placement: 18 - i,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const LEAGUES = [
  ["zt-res-classic", "Results Classic", "classic-draft"],
  ["zt-res-roster", "Results Roster", "active-roster"],
  ["zt-res-pool", "Results Pool", "pickem"],
];
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// The wall-clock date and time in TZ of an instant, so episode 4 airs exactly when asked.
function local(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-res-%'`); // memberships cascade
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]); // decisions cascade
  await pool.query(`DELETE FROM "user" WHERE username = ANY($1)`, [USERS.map((u) => u[0])]); // sessions/accounts cascade
}

async function up(pool, args) {
  await down(pool);
  const when = (args.find((a) => a.startsWith("--when=")) || "--when=aired").slice(7);
  const offsetMs = { aired: -26 * 3600e3, airing: -30 * 60e3, upcoming: 2 * 86400e3 }[when];
  if (offsetMs === undefined) throw new Error("--when must be aired, airing or upcoming");
  const ep4 = local(new Date(Date.now() + offsetMs));
  // "Last night" is a prime-time slot, not 26 hours ago to the minute.
  if (when === "aired") ep4.time = "20:00";
  const premiere = new Date(`${ep4.date}T12:00:00Z`);
  premiere.setUTCDate(premiere.getUTCDate() - 7 * 3);

  const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  const { rows: season } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, results_by, cast_size)
     VALUES ($1,$2,$3,'airing',$4,$5,$6,$7,'leagues',$8) RETURNING id`,
    [show[0].id, SEASON, SEASON_NAME, premiere.toISOString().slice(0, 10), ep4.time, TZ, EPISODES, data.castaways.length]
  );

  const { hashPassword } = await import("better-auth/crypto");
  const userIds = [];
  for (const [username] of USERS) {
    const userId = id();
    userIds.push(userId);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,true,$2,$2,'user',now(),now())`,
      [userId, username, `${username}@example.invalid`]
    );
    await pool.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
      [id(), userId, await hashPassword(PASSWORD)]
    );
  }

  let eventId = null;
  for (const [slug, name, type] of LEAGUES) {
    const state = JSON.parse(JSON.stringify(buildDemoState(data, type, CURSOR)));
    S.migrateLeagueState(state);
    state.settings.showId = "survivor";
    state.settings.wikiSeason = SEASON;
    eventId = eventId || S.formatOf(state).events[0]?.id || null;
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, slug, slug.slice(7, 13).toUpperCase().padEnd(6, "Z"), JSON.stringify(state), userIds[0]]
    );
    for (const [i, [, role, seat]] of USERS.entries()) {
      await pool.query(
        `INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, userIds[i], state.players[seat].id, role, CURSOR]
      );
    }
  }

  if (args.includes("--staged")) {
    const staged = [
      ["elimination", data.castaways[CURSOR].name, "Voted Out", ""],
      ...(eventId ? [["event", data.castaways[CURSOR + 4].name, "", eventId]] : []),
    ];
    for (const [kind, who, method, eventType] of staged) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, from_research, confidence)
         VALUES ($1,4,$2,$3,$4,$5,true,'high')`,
        [season[0].id, kind, who, method, eventType]
      );
    }
  }
  console.log(`[zt] up: episode 4 ${when} (${ep4.date} ${ep4.time} ${TZ})${args.includes("--staged") ? ", research staged" : ""}`);
  console.log(`[zt] sign in as zt_comm (commissioner) or zt_player (player), password ${PASSWORD}`);
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const [cmd, ...args] = process.argv.slice(2);
  (cmd === "up" ? up(pool, args) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up [--staged] [--when=…] | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { up, down };
