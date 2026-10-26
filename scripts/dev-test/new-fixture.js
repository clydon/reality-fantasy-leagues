// Dev-only test bank for the new design's foundation (docs/PLAN-new-design.md step 0b): a zt couch shaped like
// the live one after 0101 and 0103. Three linked leagues (Outlast, Weekly Lineup, Survival Pool) on a zt
// show's season 51, four people on all three (the mock's demo names: alex runs them, riley is a Game admin in
// the lineup league), results through episode 5 and everyone revealed through 5 except sam (3). Weekly at
// 8 PM Eastern, 90 minutes, with episode 6 three days from today. Three starting tribes (Toka, Savu, Dina); the
// season's cast is approved and its accepted results (season_decisions) are the lineup league's, for the stats.
//
// Also, for sharing and access checks: a zt Traitors season that riley follows openly (through 2) and jordan
// privately (through 4), with a made-up cast whose faction rides as its tribe and results through 3 (two Traitors,
// one banished in 2, the other's "voted out a fellow Traitor" in 2: the stats' secret-role guard); and a league
// outside the group on the same season, on its own couch ("ZT Extra": alex and casey), ready to link.
//
// The couch's chat (step 4), timed around the airings: riley, jordan and sam talking before, during and after
// episodes 4 and 5 across the three linked leagues (one conversation), their reveal lines and a few reactions; and,
// on the Traitors (a show the couch only watches, no league), jordan and riley on the couch's own chat. Nothing is
// alex's, so a check can count what alex posts.
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

// The cast: Survivor 51's real castaways and the mock's photos of them (public/mock/showcase), never app users.
// The first one listed goes home first; placement counts up from the first out, the winner last.
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
// Three starting tribes, dealt in turn (the demo builder merges them at episode 6).
const TRIBES = [["toka", "Toka", "#e0b23a"], ["savu", "Savu", "#9b6bd0"], ["dina", "Dina", "#f3214a"]];
const data = {
  id: "zt-nd", showId: SHOW, showName: "ZT Survivor", seasonName: "ZT Survivor 51", episodeCount: EPISODES,
  players: ["alex", "riley", "jordan", "sam"].map((key) => ({ key, name: key, color: "#888" })),
  groups: TRIBES.map(([key, name, color]) => ({ key, name, color })),
  castaways: FACES.map((slug, i) => ({
    key: `k${i}`, name: nameOf(slug), placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`, groupKey: TRIBES[i % 3][0],
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};

// The zt Traitors' cast (step 3's stats guard), made-up people: its wiki-style cast carries the faction as a tribe,
// as Traitors 5's real one does. Episode 1: Hana and Ivo are the Traitors, Bea is murdered; episode 2: Ivo is
// banished, Hana (still in) votes out her fellow Traitor, Cal wins a shield; episode 3: nothing riley (on 2) may see.
const TRAITORS_CAST = ["Ada Moss", "Bea Lund", "Cal Ortiz", "Dev Rao", "Eli Park", "Fay Quinn", "Gus Hale", "Hana Kim", "Ivo Petrov", "Jo Wren"];
const TRAITOR = new Set(["Hana Kim", "Ivo Petrov"]);
const TRAITORS_RESULTS = [
  [1, "role", "Hana Kim", "Traitor", ""], [1, "role", "Ivo Petrov", "Traitor", ""],
  [1, "elimination", "Bea Lund", "Murdered", ""],
  ...TRAITORS_CAST.filter((n) => n !== "Bea Lund").map((n) => [1, "event", n, "", "zeroVotes"]),
  [2, "elimination", "Ivo Petrov", "Banished", ""],
  [2, "event", "Hana Kim", "", "turnedOnTraitor"], [2, "event", "Cal Ortiz", "", "shieldWon"], [2, "event", "Dev Rao", "", "survivedRoundTable"],
  [3, "elimination", "Cal Ortiz", "Murdered", ""], [3, "event", "Eli Park", "", "shieldWon"],
];

/** A season's accepted results, as an admin's review leaves them (season_decisions), from a league's episodes. */
function decisionsFrom(state) {
  const name = new Map(state.castaways.map((c) => [c.id, c.name]));
  return state.episodes.flatMap((ep) => [
    ...(ep.events || []).map((e) => [ep.number, "elimination", name.get(e.castawayId), e.method, ""]),
    ...(ep.scoringEvents || []).map((e) => [ep.number, "event", name.get(e.castawayId), "", e.type]),
  ]);
}

async function insertResults(pool, seasonId, rows) {
  for (const [n, kind, who, method, eventType] of rows) {
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now())`,
      [seasonId, n, kind, who, method, eventType]
    );
  }
}
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
  // The desk's history (step 6b part 2) names what it changed by id, with no foreign key: the fixture's seasons, their
  // rulebooks, results and cast, its couches, and anything zt_nd people changed.
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id = ANY($2::text[]) OR entity_id IN (
       SELECT ss.id::text FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug IN ($3, $4)
       UNION SELECT r.id::text FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug IN ($3, $4)
       UNION SELECT d.id::text FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug IN ($3, $4)
       UNION SELECT c.id::text FROM season_cast c JOIN show_seasons ss ON ss.id = c.season_id JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug IN ($3, $4))`,
    [userIds, couches.map((c) => c.id), SHOW, TRAITORS]
  );
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-nd-%'`); // memberships and Recent changes cascade
  // Questions Backstage parked for Ask an AI (they'd only lose their author with the users, and expire in a week).
  await pool.query(`DELETE FROM ai_briefs WHERE created_by = ANY($1::text[])`, [userIds]);
  if (groups.length) await pool.query(`DELETE FROM league_groups WHERE id = ANY($1::uuid[])`, [groups.map((g) => g.group_id)]);
  if (couches.length) await pool.query(`DELETE FROM couches WHERE id = ANY($1::uuid[])`, [couches.map((c) => c.id)]);
  await pool.query(`DELETE FROM shows WHERE slug IN ($1, $2)`, [SHOW, TRAITORS]); // seasons and follows go with them
  // Shows zt_nd people added (step 10's Add a show: from a check's stand-in listings, fake-listings.js, or by name).
  await pool.query(`DELETE FROM shows WHERE slug LIKE 'zt-%' AND (created_by = ANY($1::text[]) OR (tvmaze_id >= 990000 AND tvmaze_id < 1000000))`, [userIds]);
  // A starting point the desk saved from one of its seasons' rulebooks lives in the library, with no season.
  await pool.query("DELETE FROM rulebooks WHERE owner_kind = 'library' AND (name LIKE 'ZT Survivor%' OR name LIKE 'ZT Traitors%')");
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
  // The season's cast and its accepted results through episode 5 (the stats count these: season-stats.ts), from the
  // lineup league's own, so both agree. Results by leagues (the column's default), so no league is synced from them.
  const lineupState = (await one(`SELECT state FROM leagues WHERE id = $1`, [leagues.lineup])).state;
  for (const [i, slug] of FACES.entries()) {
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)`, [
      season, nameOf(slug), TRIBES[i % 3][1], `/mock/showcase/img/survivor-51/${slug}.jpg`, i,
    ]);
  }
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [season]);
  await insertResults(pool, season, decisionsFrom(lineupState));
  for (const [i, who] of TRAITORS_CAST.entries()) {
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, $2, $3, $4)`, [traitorsSeason, who, TRAITOR.has(who) ? "Traitor" : "Faithful", i]);
  }
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [traitorsSeason]);
  await insertResults(pool, traitorsSeason, TRAITORS_RESULTS);

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

  await seedChat(pool, { couch, season, traitorsSeason, leagues, users });

  console.log(`[zt] up: sign in as ${PEOPLE.map(username).join(" / ")} (password ${PASSWORD}); couch "ZT Survivor 51", 3 linked leagues, episode 6 in 3 days`);
  return { couchId: couch, extraCouchId: extraCouch, seasonId: season, traitorsSeasonId: traitorsSeason, groupId: group, leagues, users };
}

// The couch's chat: [where, who, type, text, episode (whose airtime it's timed from; null for now), offset].
const CHAT = [
  ["outlast", "riley", "message", "Carter is running this camp already", 4, "-1 day"],
  ["lineup", "jordan", "message", "tribal is going to be chaos", 4, "-2 hours"],
  ["pool", "riley", "message", "THAT blindside. I had Brady in my Pool", 4, "40 minutes"],
  ["outlast", "riley", "reveal", "riley revealed episode 4", 4, "1 day"],
  ["lineup", "jordan", "reveal", "jordan revealed episode 4", 4, "1 day 2 hours"],
  ["outlast", "sam", "message", "who are we starting this week", 5, "-1 day"],
  ["outlast", "riley", "message", "Carter, Mike, Danny. Not telling you why.", 5, "-3 hours"],
  ["lineup", "jordan", "message", "that vote was cold", 5, "50 minutes"],
  ["pool", "riley", "message", "called it. Carter was never safe", 5, "55 minutes"],
  ["outlast", "riley", "reveal", "riley revealed episode 5", 5, "12 hours"],
  ["lineup", "jordan", "reveal", "jordan revealed episode 5", 5, "14 hours"],
  ["outlast", "jordan", "message", "anyone rewatching before Tuesday?", null, "-2 hours"],
];
// The Traitors, which the couch watches without a game: riley is on 2, jordan on 4.
const TRAITORS_CHAT = [
  ["riley", "the castle looks unreal this season", 2, "-2 days"],
  ["jordan", "that round table was brutal", 3, "1 hour"],
  ["jordan", "no way the shield goes to Eli again", 3, "2 days"],
];

async function seedChat(pool, { couch, season, traitorsSeason, leagues, users }) {
  // When episode n airs, from the season's own schedule (weekly from the premiere, as schedule.ts works it out).
  const at = `CASE WHEN $2::int IS NULL THEN now() ELSE (((premiere_date + ($2::int - 1) * 7) + air_time) AT TIME ZONE air_tz) END + $3::interval`;
  const ids = [];
  for (const [where, who, type, text, n, offset] of CHAT) {
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (league_id, user_id, author_name, type, text, created_at)
       SELECT $4, $5, $6, $7, $8, ${at} FROM show_seasons WHERE id = $1 RETURNING id`,
      [season, n, offset, leagues[where], users[who], who, type, text]
    );
    ids.push(rows[0].id);
  }
  const react = (i, who, emoji) => pool.query(`INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`, [ids[i], users[who], emoji]);
  await react(0, "jordan", "😂");
  await react(0, "sam", "😂");
  await react(2, "jordan", "😮");
  for (const [who, text, n, offset] of TRAITORS_CHAT) {
    await pool.query(
      `INSERT INTO chat_messages (couch_id, season_id, user_id, author_name, type, text, created_at)
       SELECT $4, $1, $5, $6, 'message', $7, ${at} FROM show_seasons WHERE id = $1`,
      [traitorsSeason, n, offset, couch, users[who], who, text]
    );
  }
}

module.exports = { up, down, PEOPLE, PASSWORD, username, CHAT, TRAITORS_CHAT };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("new-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up" ? up(pool) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
