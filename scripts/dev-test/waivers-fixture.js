// Dev-only test bank: a league in a mid-season waiver week (docs/PLAN-midseason-waivers.md), at any
// point in it -- for checking the waiver routes (check-waivers.js) and, from phase 2, the Waivers page.
//
//   node scripts/dev-test/waivers-fixture.js up [--phase=open|claimed|processed|idle] [--airs-in=HOURS]
//   node scripts/dev-test/waivers-fixture.js down
//
// The design canvas's Couch Crew, after Episode 3 (Jelly is out, so Sam is owed a pickup; Episode 3 is
// an add/drop week). A throwaway season (Survivor 991, "zt-waivers", airing weekly, Episode 4 airing
// --airs-in hours from now, default 30, so waivers process in about 6) and two unlinked leagues on it,
// both on waivers with Pickups and Add/drops on:
//   zt-wv-classic  "Waivers Classic"  Classic, exclusive ownership (contested claims, free agents)
//   zt-wv-roster   "Waivers Roster"   Active Roster, shared ownership (2 active + 1 bench; Sam is down
//                                     to 1 still in, so owed one)
// Five seats in each, in waiver order Kim, Sam, Andrew, Josie, Dee. Three are people, all password
// zt-pass-12345:
//   zt_wcomm    Kim, the commissioner, seen through episode 3
//   zt_wplayer  Sam, seen through episode 3 (owed the pickup)
//   zt_wlate    Josie, seen through episode 2 only: hasn't revealed, so waivers are gated for them
// Andrew and Dee are computer players (they claim when the week processes).
//   --phase=open       waivers open, no claims yet (default)
//   --phase=claimed    Sam's canvas claims are in (pickup Rob then Maggie; drop Kilby for Maggie then
//                      Patt), and Kim's add/drop (Mike for Rob, then Ori)
//   --phase=processed  ...and processed by the commissioner: free agency is open
//   --phase=idle       ...and Episode 4 has aired: the week is closed, the next opens with its results
//
// Every row is keyed on the "zt-wv-" slug prefix, the "zt-waivers" season name and the zt_w usernames,
// so `down` can't touch real data. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { stampAirTimes } = jiti("../../src/lib/server/air-times.ts");
const S = require("../../src/lib/game/state-logic.js");
const Waivers = require("../../src/lib/server/waivers.js");

const PASSWORD = "zt-pass-12345";
const SEASON = 991;
const SEASON_NAME = "zt-waivers";
const TZ = "America/New_York";
const EPISODES = 13;
// [seat, username or null for a computer player, results seen through]
const SEATS = [
  ["Kim", "zt_wcomm", 3],
  ["Sam", "zt_wplayer", 3],
  ["Andrew", null, 3],
  ["Josie", "zt_wlate", 2],
  ["Dee", null, 3],
];
const TEAMS = {
  Kim: ["Mike", "Eric", "Kristin"],
  Sam: ["Jelly", "Kilby", "Thien An"],
  Andrew: ["Carter", "Brady", "Cristian"],
  Josie: ["Lewis", "Jenna", "Sharonda"],
  Dee: ["Alexis", "Gabe", "Kyle"],
};
const FREE = ["Rob", "Maggie", "Ori", "Patt", "Aaliyah", "Linnea"];
const OUT = [["Ana", 1], ["Devin", 2], ["Jelly", 3]];
const TRIBES = [["Blue", "#5089c9"], ["Orange", "#f2804b"], ["Teal", "#35b5a5"]];
const LEAGUES = [
  ["zt-wv-classic", "Waivers Classic", "classic-draft"],
  ["zt-wv-roster", "Waivers Roster", "active-roster"],
];
const PHASES = ["open", "claimed", "processed", "idle"];
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const slugId = (name) => "c-" + name.toLowerCase().replace(/\W+/g, "-");

// The wall-clock date and time in TZ of an instant, so episode 4 airs exactly when asked.
function local(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function buildState(type) {
  const roster = type === "active-roster";
  const players = SEATS.map(([name, username]) => ({
    id: "p-" + name.toLowerCase(), name, color: "#888", active: true, disabled: false,
    ...(username ? {} : { automated: true, botLevel: "solid" }),
  }));
  const pid = (name) => "p-" + name.toLowerCase();
  const names = [...Object.values(TEAMS).flat(), ...FREE, "Ana", "Devin"];
  const tribes = TRIBES.map(([name, color]) => ({ id: "t-" + name.toLowerCase(), name, color }));
  const state = S.migrateLeagueState({
    settings: {
      leagueTypeId: type, showId: "survivor", showFormat: "survivor", wikiSeason: SEASON,
      ownershipMode: roster ? "shared" : "exclusive", startEpisode: 1,
      replenishEnabled: true, tradeEnabled: true, swapEvery: 3, replenishOrderBy: "rolling",
      waiverProcessHours: 24,
      ...(roster ? { activeSlots: 2, benchSlots: 1 } : { teamSize: 3 }),
    },
    players,
    // Reverse draft order is the waiver order: Kim, Sam, Andrew, Josie, Dee.
    draftOrder: ["Dee", "Josie", "Andrew", "Sam", "Kim"].map(pid),
    tribes,
    castaways: names.map((name, i) => ({
      id: slugId(name), name, tribeId: tribes[i % 3].id, photoUrl: "", status: "active", placementOrder: null,
      exitMethod: null, exitEpisodeId: null, acquiredVia: null, formerOwnerId: null, departedVia: null,
      ownerIds: Object.entries(TEAMS).filter(([, team]) => team.includes(name)).map(([owner]) => pid(owner)),
    })),
    episodes: Array.from({ length: EPISODES }, (_, i) => ({
      id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {},
    })),
  });
  state.draftPicksMade = 15;
  // Active Roster: Sam down to one still in (Jelly and Kilby both out in episode 3), and a few points.
  const out = roster ? [...OUT, ["Kilby", 3]] : OUT;
  out.forEach(([name, ep]) => S.addElimination(state, `ep${ep}`, slugId(name), "Voted Out"));
  if (roster) {
    const ev = S.formatOf(state).events.find((e) => S.ActiveRosterLogic.pointsFor(state, e.id) > 0);
    if (ev) [["Rob", 1], ["Maggie", 2], ["Mike", 3], ["Lewis", 3]].forEach(([name, ep]) => S.addScoringEvent(state, `ep${ep}`, ev.id, slugId(name)));
  }
  return state;
}

// The canvas's claims (boards 2, 3 and 5).
const CLAIMS = {
  "p-sam": (roster) => (roster ? { pickupIds: ["Rob", "Maggie"].map(slugId) } : { pickupIds: ["Rob", "Maggie"].map(slugId), dropId: slugId("Kilby"), addIds: ["Maggie", "Patt"].map(slugId) }),
  "p-kim": () => ({ dropId: slugId("Mike"), addIds: ["Rob", "Ori"].map(slugId) }),
};

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-wv-%'`); // memberships and claims cascade
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]);
  await pool.query(`DELETE FROM "user" WHERE username = ANY($1)`, [SEATS.map((s) => s[1]).filter(Boolean)]);
}

async function up(pool, args = []) {
  await down(pool);
  const phase = (args.find((a) => a.startsWith("--phase=")) || "--phase=open").slice(8);
  if (!PHASES.includes(phase)) throw new Error("--phase must be " + PHASES.join(", "));
  const airsIn = Number((args.find((a) => a.startsWith("--airs-in=")) || "--airs-in=30").slice(10));
  // Waivers opened yesterday; episode 4 airs --airs-in hours from now (or aired two hours ago, for idle).
  const now = Date.now();
  const ep4 = local(new Date(now + (phase === "idle" ? -2 : airsIn) * 3600e3));
  const premiere = new Date(`${ep4.date}T12:00:00Z`);
  premiere.setUTCDate(premiere.getUTCDate() - 7 * 3);

  const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, results_by, cast_size)
     VALUES ($1,$2,$3,'airing',$4,$5,$6,$7,'leagues',$8)`,
    [show[0].id, SEASON, SEASON_NAME, premiere.toISOString().slice(0, 10), ep4.time, TZ, EPISODES, 23]
  );

  const { hashPassword } = await import("better-auth/crypto");
  const userIds = {};
  for (const [, username] of SEATS) {
    if (!username) continue;
    const userId = id();
    userIds[username] = userId;
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

  const made = [];
  for (const [slug, name, type] of LEAGUES) {
    const state = buildState(type);
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ($1,$2,$3,'{}'::jsonb,$4) RETURNING id`,
      [name, slug, ("WV" + slug.slice(6, 10)).toUpperCase().padEnd(6, "Z"), userIds.zt_wcomm]
    );
    const leagueId = rows[0].id;
    for (const [seat, username, seen] of SEATS) {
      if (!username) continue;
      await pool.query(
        `INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1,$2,$3,$4,$5)`,
        [leagueId, userIds[username], "p-" + seat.toLowerCase(), username === "zt_wcomm" ? "commissioner" : "member", seen]
      );
    }
    // The week as the server would run it: under a transaction, air times stamped, the clock synced.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await stampAirTimes(client, state);
      await Waivers.syncWaivers(client, leagueId, state, now - 20 * 3600e3); // opened yesterday afternoon
      if (phase !== "open") {
        for (const [playerId, make] of Object.entries(CLAIMS)) {
          const saved = await Waivers.saveClaim(client, leagueId, state, playerId, make(type === "active-roster"), userIds.zt_wcomm);
          if (saved.error) throw new Error(`${slug} ${playerId}: ${saved.error}`);
        }
      }
      if (phase === "processed" || phase === "idle") {
        const refused = await Waivers.processNow(client, leagueId, state, now);
        if (refused) throw new Error(refused);
      }
      await Waivers.syncWaivers(client, leagueId, state, now);
      S.ensureNextEpisode(state);
      await client.query("UPDATE leagues SET state=$1 WHERE id=$2", [JSON.stringify(state), leagueId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const p = S.WaiverLogic.periods(state).slice(-1)[0];
    made.push({ slug, leagueId, phase: p ? p.phase : "none" });
  }
  made.forEach((m) => console.log(`[zt] ${m.slug} ${m.leagueId}: waiver week ${m.phase}`));
  console.log(`[zt] up: --phase=${phase}, episode 4 ${phase === "idle" ? "aired" : "airs"} ${ep4.date} ${ep4.time} ${TZ}`);
  console.log(`[zt] sign in as zt_wcomm (commissioner), zt_wplayer or zt_wlate (not revealed), password ${PASSWORD}`);
  return made;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const [cmd, ...args] = process.argv.slice(2);
  (cmd === "up" ? up(pool, args) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up [--phase=…] [--airs-in=H] | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { up, down, slugId, PASSWORD };
