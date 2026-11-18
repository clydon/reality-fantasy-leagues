// Dev-only test bank: one episode at a time (docs/design-round/step-through-spec.md), someone behind on an airing show. A couch of
// four (zt_st_alex, zt_st_riley, zt_st_jordan, zt_st_sam; password zt-pass-12345) on two shows:
//   ZT Traitors (slug zt-st-traitors), which the couch watches with no game: dressed in The Traitors' real art and Traitors 5's
//     real cast from the local database (names, photos, factions), its first three episodes' results the real ones and the rest
//     made up (one out an episode, in cast order); riley is the viewer behind (through --seen of --aired, --count episodes);
//   ZT Survivor (slug zt-st-survivor), a Weekly Lineup game on the couch (Survivor 51's castaways, the mock's photos), results in
//     through Ep 5 and sam two behind (through 3): a show you play with results waiting.
// The others stand on the ruler: on each show jordan has seen everything, alex one past the viewer.
//
//   node scripts/dev-test/step-fixture.js up [--aired=10 --seen=8 --count=11] [--live]   the user's case by default (2026-11-17's Traitors);
//        --live: riley keeps up with ZT Traitors live (keep_up 'ask'), so Tonight's Live card asks instead of the progress control
//   node scripts/dev-test/step-fixture.js down
//
// Also a module: `const fx = require("./step-fixture"); const ids = await fx.up(pool, { aired, seen, count })`, resolving
// { couchId, traitorsSeasonId, survivorSeasonId, users: { alex, ... } }; `await fx.down(pool)`. `up` takes down first, so it
// re-runs for another situation (a long season: --aired=20 --seen=12 --count=30). Keyed on zt-st- slugs and zt_st_ usernames, so
// `down` can't touch real data or another fixture's zt rows (zt_nd's couch is new-fixture.js's: this one runs beside it). Refuses a
// non-local database. Used by story-step-through.js.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");

const DB = process.env.AUTH_DATABASE_URL || "";
const PASSWORD = "zt-pass-12345";
const PEOPLE = ["alex", "riley", "jordan", "sam"];
const username = (who) => `zt_st_${who}`;
const TRAITORS = "zt-st-traitors";
const SURVIVOR = "zt-st-survivor";
const REAL_TRAITORS = { show: "the-traitors-us", season: 5 };
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// ZT Survivor: Survivor 51's castaways and the mock's photos (public/mock/showcase), as new-fixture.js has them.
const S_EPISODES = 13, S_CURSOR = 5, S_SEEN = 3;
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const TRIBES = [["toka", "Toka", "#e0b23a"], ["savu", "Savu", "#9b6bd0"], ["dina", "Dina", "#f3214a"]];
const survivorData = {
  id: "zt-st", showId: SURVIVOR, showName: "ZT Survivor", seasonName: "ZT Survivor 51", episodeCount: S_EPISODES,
  players: PEOPLE.map((key) => ({ key, name: key, color: "#888" })),
  groups: TRIBES.map(([key, name, color]) => ({ key, name, color })),
  castaways: FACES.map((slug, i) => ({
    key: `k${i}`, name: nameOf(slug), placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`, groupKey: TRIBES[i % 3][0],
    exitEpisode: Math.min(i + 1, S_EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};

function local() {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("step-fixture runs against a local database only");
}

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_st\\_%'`);
  const userIds = users.map((u) => u.id);
  const { rows: couches } = await pool.query(
    `SELECT c.id FROM couches c WHERE (c.created_by = ANY($1::text[]) OR c.id IN (SELECT couch_id FROM leagues WHERE slug LIKE 'zt-st-%'))
        AND NOT EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = c.id AND NOT (m.user_id = ANY($1::text[])))`,
    [userIds]
  );
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-st-%' OR created_by = ANY($1::text[])`, [userIds]);
  if (couches.length) await pool.query(`DELETE FROM couches WHERE id = ANY($1::uuid[])`, [couches.map((c) => c.id)]);
  await pool.query(`DELETE FROM shows WHERE slug IN ($1, $2)`, [TRAITORS, SURVIVOR]); // seasons, cast, results and follows go with them
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_st\\_%'`); // sessions, accounts, follows, members cascade
}

/** A weekly season with `aired` episodes out and the next three days away, at 9 PM Eastern. */
const premiere = (aired) => `current_date + 3 - ${7 * aired}`;

async function up(pool, { aired = 10, seen = 8, count = 11, art = true, live = false } = {}) {
  local();
  if (!(seen >= 0 && seen < aired && aired < count)) throw new Error(`want seen < aired < count (got ${seen}, ${aired}, ${count})`);
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const users = {};
  for (const who of PEOPLE) {
    users[who] = id();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`,
      [users[who], username(who), `${username(who)}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      id(), users[who], hash,
    ]);
  }
  const couch = (await one(`INSERT INTO couches (name, created_by) VALUES ('ZT Step', $1) RETURNING id`, [users.alex])).id;
  for (const who of PEOPLE) await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)`, [couch, users[who], who === "alex" ? "owner" : "member"]);

  // ZT Traitors: the real season's cast, its first episodes' real results, then one out an episode (made up).
  const tShow = (await one(`INSERT INTO shows (slug, name, format, created_by) VALUES ($1, 'ZT Traitors', 'traitors', $2) RETURNING id`, [TRAITORS, users.alex])).id;
  const tSeason = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
     VALUES ($1, 5, 'airing', ${premiere(aired)}, '21:00', 'America/New_York', $2) RETURNING id`,
    [tShow, count]
  )).id;
  const real = (await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2`,
    [REAL_TRAITORS.show, REAL_TRAITORS.season]
  )).rows[0];
  const cast = real ? (await pool.query(`SELECT name, tribe_name, photo_url, sort_order FROM season_cast WHERE season_id = $1 ORDER BY sort_order`, [real.id])).rows : [];
  if (!cast.length) throw new Error("no Traitors 5 cast in the local database to dress ZT Traitors with");
  for (const c of cast)
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)`, [tSeason, c.name, c.tribe_name, c.photo_url, c.sort_order]);
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now(), cast_tribes_confirmed = true WHERE id = $1`, [tSeason]);
  const realResults = (await pool.query(
    `SELECT episode_number, kind, castaway_name, method, event_type FROM season_decisions WHERE season_id = $1 AND status = 'accepted' ORDER BY episode_number, id`,
    [real.id]
  )).rows;
  const realThrough = realResults.reduce((m, r) => Math.max(m, r.episode_number), 0);
  const gone = new Set(realResults.filter((r) => r.kind === "elimination").map((r) => r.castaway_name));
  const traitors = new Set([...cast.filter((c) => c.tribe_name === "Traitor").map((c) => c.name), ...realResults.filter((r) => r.kind === "role").map((r) => r.castaway_name)]);
  const left = cast.map((c) => c.name).filter((n) => !gone.has(n) && !traitors.has(n));
  const rows = realResults.filter((r) => r.episode_number <= aired).map((r) => [r.episode_number, r.kind, r.castaway_name, r.method, r.event_type || ""]);
  for (let n = realThrough + 1; n <= aired && left.length > 2; n++) rows.push([n, "elimination", left.shift(), n % 2 ? "Murdered" : "Banished", ""]);
  for (const [n, kind, who, method, eventType] of rows)
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now())`,
      [tSeason, n, kind, who, method, eventType]
    );
  const tMarks = { riley: seen, alex: seen + 1, jordan: aired, sam: aired };
  for (const who of PEOPLE)
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through, keep_up) VALUES ($1, $2, $3, $4)`, [users[who], tSeason, tMarks[who], live && who === "riley" ? "ask" : "off"]);

  // ZT Survivor: a Weekly Lineup game on the couch, results in through Ep 5, sam through 3.
  const sShow = (await one(`INSERT INTO shows (slug, name, created_by) VALUES ($1, 'ZT Survivor', $2) RETURNING id`, [SURVIVOR, users.alex])).id;
  const sSeason = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 51, 'ZT Survivor 51', 'airing', ${premiere(S_CURSOR)}, '20:00', 'America/New_York', 90, $2) RETURNING id`,
    [sShow, S_EPISODES]
  )).id;
  const state = JSON.parse(JSON.stringify(buildDemoState(survivorData, "active-roster", S_CURSOR)));
  S.migrateLeagueState(state);
  state.settings.showId = SURVIVOR;
  state.settings.wikiSeason = 51;
  const league = (await one(
    `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('Lineup League', 'zt-st-lineup', 'ZTSTLN', $1, $2, $3) RETURNING id`,
    [JSON.stringify(state), users.alex, couch]
  )).id;
  const sMarks = { sam: S_SEEN, alex: S_SEEN + 1, jordan: S_CURSOR, riley: S_CURSOR };
  for (const [j, who] of PEOPLE.entries()) {
    await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)`, [
      league, users[who], state.players[j].id, who === "alex" ? "commissioner" : "member", sMarks[who],
    ]);
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3)`, [users[who], sSeason, sMarks[who]]);
  }
  for (const [i, slug] of FACES.entries())
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)`, [
      sSeason, nameOf(slug), TRIBES[i % 3][1], `/mock/showcase/img/survivor-51/${slug}.jpg`, i,
    ]);
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [sSeason]);
  const name = new Map(state.castaways.map((c) => [c.id, c.name]));
  for (const ep of state.episodes)
    for (const e of ep.events || [])
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
         VALUES ($1, $2, 'elimination', $3, $4, '', 'accepted', true, now())`,
        [sSeason, ep.number, name.get(e.castawayId), e.method]
      );

  if (art) {
    const dress = require("./fixture-art");
    await dress.borrow(pool, TRAITORS, REAL_TRAITORS.show);
    await dress.borrow(pool, SURVIVOR, "survivor");
  }
  return { couchId: couch, traitorsSeasonId: tSeason, survivorSeasonId: sSeason, leagueId: league, users };
}

module.exports = { up, down, PEOPLE, PASSWORD, username };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (k, d) => Number(args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
  local();
  const pool = new Pool({ connectionString: DB });
  (async () => {
    if (args[0] === "down") {
      await down(pool);
      console.log("[zt-st] down");
    } else {
      const ids = await up(pool, { aired: opt("aired", 10), seen: opt("seen", 8), count: opt("count", 11), art: !args.includes("--no-art"), live: args.includes("--live") });
      console.log(`[zt-st] up: sign in as ${PEOPLE.map(username).join(" / ")} (password ${PASSWORD}); ZT Traitors ${ids.traitorsSeasonId}, ZT Survivor ${ids.survivorSeasonId}`);
    }
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
