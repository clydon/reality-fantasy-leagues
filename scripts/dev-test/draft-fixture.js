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
//
// The design round's step 6 (the Games tab and the draft room) adds two reusable shapes:
//   - `live: N` (CLI --live=N): Couch Cup's draft started and N picks made in its order, each the best still free by a
//     plain ranking (the cast's order, a little shuffled by a fixed seed), alex's queue three deep: a draft room mid-draft.
//     With N landing on alex's turn (N = 1 or 6 in the mock's order riley, alex, jordan, sam), it's "You're up".
//   - `sport: true` (CLI --sport): a third game on its own season, "ZT Football" (a show of kind 'sport', Player/Team/Game),
//     344 athletes in the bench's NFL shares (QB 40, RB 80, WR 110, TE 50, PK 32, DEF 32), each with a position
//     (season_cast.role) and a team (tribe_name). Real names and ESPN headshots come from the ignored recording
//     (.ui-atlas/fixtures/espn, scripts/dev-test/espn-snapshot.js) when it's on this machine; else generated ("QB 1").
//     With the recording, each athlete carries their ESPN id and the season a slate (the NFL, 2026), so an athlete's sheet reads
//     their real past seasons from ESPN (cached a day); generated athletes have none. Its game, "Gridiron", is Weekly Lineup with each player on one team: a snake draft of 15 each (9 start, 6 bench), started
//     and `live` picks in too, so the room is a real-size pool draft. Real people stay in the ignored .ui-atlas frames.
//   node scripts/dev-test/draft-fixture.js up --live=6 --sport
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
const SPORT_SHOW = "zt-dr-football";
// The bench's real-size NFL pool (tools/gameplay-bench/explorer/runtime-sports.cjs REAL.football).
const SPORT_SHARES = { QB: 40, RB: 80, WR: 110, TE: 50, PK: 32, DEF: 32 };
const SPORT_TEAMS = ["Bengals", "Bills", "Chiefs", "Eagles", "Lions", "Packers", "Ravens", "49ers", "Cowboys", "Dolphins", "Jets", "Rams", "Seahawks", "Steelers", "Texans", "Vikings"];

/** 344 athletes: the recording's real ones when it's here (name, position, team, headshot), else generated. */
function athletes() {
  try {
    const Roster = require("../../tools/gameplay-bench/explorer/sports-roster.cjs");
    const got = Roster.pool(Roster.load("football/nfl")).athletes;
    if (got.length >= 300) return got.map((a) => ({ name: a.name, role: a.role, team: a.teamName || a.teamAbbr || null, photo: a.headshot || null, espn: a.id || null }));
  } catch {
    // No recording on this machine: generated below.
  }
  const out = [];
  for (const [role, n] of Object.entries(SPORT_SHARES)) for (let i = 0; i < n; i++) out.push({ name: role === "DEF" ? `${SPORT_TEAMS[i % 16]} D/ST ${i + 1}` : `${role} ${i + 1}`, role, team: SPORT_TEAMS[i % 16], photo: null, espn: null });
  return out;
}

/** A fixed shuffle (the pick ranking's small variety), so a rerun drafts the same. */
function seeded(list, seed = 7) {
  const a = [...list];
  let x = seed;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 16807) % 2147483647;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The draft started and `n` picks made in its order: each the best still free by `rank` (castaway ids, best first). */
function draftSome(s, n, rank) {
  S.forceStartDraft(s);
  for (let k = 0; k < n; k++) {
    const turn = S.currentDraftTurn(s);
    if (!turn) break;
    const free = rank.find((cid) => !s.castaways.find((c) => c.id === cid)?.ownerIds?.length);
    if (!free) break;
    S.draftToCurrentTurn(s, free);
  }
  return s;
}
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
  await pool.query(`DELETE FROM rulebooks WHERE season_id IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)`, [SPORT_SHOW]);
  await pool.query(`DELETE FROM shows WHERE slug = ANY($1::text[])`, [[SHOW, SPORT_SHOW]]); // seasons, cast and follows go with it
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
  // Each castaway's bio as Survivor 51's cast has it here (cast properties' research: hometown, age, occupation, the network's
  // line), so the room's sheet says who they are before the premiere; none when this database has no research yet.
  const bios = new Map(
    (await pool.query(
      `SELECT lower(sc.name) AS name, sc.bio FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id
        WHERE s.slug = 'survivor' AND ss.season_number = 51 AND sc.bio IS NOT NULL`
    ).catch(() => ({ rows: [] }))).rows.map((r) => [r.name, r.bio])
  );
  for (const [i, slug] of FACES.entries()) {
    const bio = bios.get(nameOf(slug).toLowerCase()) ?? null;
    const row = await one(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order, bio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [season, nameOf(slug), TRIBES[i % 3][0], `/mock/showcase/img/survivor-51/${slug}.jpg`, i, bio ? JSON.stringify(bio) : null]
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
  const live = opts.live ?? 0;
  for (const [i, [key, slug, name, type, shared]] of games.entries()) {
    const state = leagueState(type, shared, size, players, cast);
    // Mid-draft (step 6): Couch Cup started with `live` picks in, best first by a fixed ranking of the cast.
    if (key === "outlast" && live > 0) draftSome(state, live, seeded(state.castaways.map((c) => c.id)));
    leagues[key] = (await one(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, slug, `ZTDR${i}X`, JSON.stringify(state), users.alex, group, i, couch]
    )).id;
    for (const who of players) {
      const role = who === "alex" ? "commissioner" : who === "riley" && key === "outlast" ? "admin" : "member";
      const seat = state.players.find((p) => p.name === who).id;
      await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, 0)`, [leagues[key], users[who], seat, role]);
    }
    // alex's queue, three deep (the free ones from the far end of the ranking: a queue that isn't just the next picks).
    if (key === "outlast" && live > 0 && players.includes("alex")) {
      const free = state.castaways.filter((c) => !c.ownerIds?.length).map((c) => c.id);
      await pool.query(`INSERT INTO draft_queues (league_id, player_id, castaway_ids, updated_at) VALUES ($1, $2, $3::jsonb, now())`, [leagues[key], state.players.find((p) => p.name === "alex").id, JSON.stringify(free.slice(-3))]);
    }
  }
  let sport = null;
  if (opts.sport) sport = await upSport(pool, { one, users, couch, players, live });
  for (const who of PEOPLE) {
    await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)`, [couch, users[who], who === "alex" ? "owner" : "member"]);
    await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 0)`, [users[who], season]);
  }
  console.log(
    `[zt] up: sign in as ${PEOPLE.map(username).join(" / ")} (password ${PASSWORD}); couch "ZT Draft Night", a snake and a blind draft, ${live ? `the snake ${live} picks in` : "not started"}; /show/${season}/draft` +
      (sport ? `; ZT Football ${sport.real ? "(real athletes)" : "(generated athletes)"} /show/${sport.seasonId}/draft` : "")
  );
  return { couchId: couch, seasonId: season, groupId: group, leagues: { ...leagues, ...(sport ? { gridiron: sport.leagueId } : {}) }, users, cast: cast.map(({ id: cid, name }) => ({ id: cid, name })), sport };
}

/** ZT Football: 344 athletes by position and team, and Gridiron, a snake draft of 15 each, `live` picks in. */
async function upSport(pool, { one, users, couch, players, live }) {
  const pool344 = athletes();
  const real = pool344.some((a) => a.photo);
  const show = (await one(
    `INSERT INTO shows (slug, name, created_by, kind, castaway_term, tribe_term, episode_term, set_up_at) VALUES ($1, 'ZT Football', $2, 'sport', 'Player', 'Team', 'Game', now()) RETURNING id`,
    [SPORT_SHOW, users.alex]
  )).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 2026, 'ZT Football 2026', 'upcoming', current_date + 7, '13:00', 'America/New_York', 180, 17) RETURNING id`,
    [show]
  )).id;
  // One statement: hundreds of rows.
  await pool.query(
    `INSERT INTO season_cast (season_id, name, photo_url, sort_order, role, tribe_name, provider_ids)
     SELECT $1, x.name, x.photo, x.n - 1, x.role, x.team, CASE WHEN x.espn IS NULL THEN NULL ELSE jsonb_build_object('espn', x.espn) END
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) WITH ORDINALITY AS x(name, photo, role, team, espn, n)`,
    [season, pool344.map((a) => a.name), pool344.map((a) => a.photo), pool344.map((a) => a.role), pool344.map((a) => a.team), pool344.map((a) => a.espn)]
  );
  // With real athletes, the season is the NFL's as a real sports season is (its slate: league and year), so an athlete's sheet can
  // read their past seasons from ESPN (sports/history.ts; cached a day in sports_cache). Its windows stay empty: no games linked.
  if (real) {
    await pool.query(
      `INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key, synced_at) VALUES ($1, 'espn', 'football/nfl', 2026, 'regular', 'week', '[]'::jsonb, $2, now())`,
      [season, `zt-dr:${season}`]
    );
  }
  const cast = (await pool.query(`SELECT id, name, photo_url, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order`, [season])).rows;
  await pool.query(`UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1`, [season]);
  const group = (await one(`INSERT INTO league_groups (name, created_by) VALUES ('ZT Gridiron', $1) RETURNING id`, [users.alex])).id;
  const s = S.defaultState();
  s.players = [];
  s.draftOrder = [];
  for (const who of players) S.addPlayer(s, who);
  s.settings.leagueTypeId = "active-roster";
  s.settings.ownershipMode = "exclusive";
  s.settings.showId = SPORT_SHOW;
  s.settings.wikiSeason = 2026;
  s.settings.setupComplete = true;
  s.settings.activeSlots = 9;
  s.settings.benchSlots = 6;
  const teams = [...new Set(cast.map((c) => c.tribe_name).filter(Boolean))];
  S.applyCastImport(s, {
    tribes: teams.map((name) => ({ name, color: "#8a8f98" })),
    castaways: cast.map((c) => ({ id: c.id, name: c.name, photoUrl: c.photo_url, tribeName: c.tribe_name })),
  });
  s.draftOrder = ORDER.filter((w) => players.includes(w)).map((w) => s.players.find((p) => p.name === w).id);
  const state = S.migrateLeagueState(s);
  // The recording is best first: picks go roughly by it, with a little variety.
  if (live > 0) draftSome(state, live, [...seeded(state.castaways.slice(0, 24).map((c) => c.id), 11), ...state.castaways.slice(24).map((c) => c.id)]);
  const leagueId = (await one(
    `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ('Gridiron', 'zt-dr-gridiron', 'ZTDR9X', $1, $2, $3, 0, $4) RETURNING id`,
    [JSON.stringify(state), users.alex, group, couch]
  )).id;
  for (const who of players) {
    await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, 0)`, [
      leagueId, users[who], state.players.find((p) => p.name === who).id, who === "alex" ? "commissioner" : "member",
    ]);
  }
  for (const who of PEOPLE) await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 0)`, [users[who], season]);
  return { seasonId: season, leagueId, real, athletes: cast.length };
}

module.exports = { up, down, PEOPLE, PASSWORD, username, ORDER };

if (require.main === module) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("draft-fixture runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  const flag = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  (cmd === "up" ? up(pool, { live: Number(flag("live") ?? 0), sport: process.argv.includes("--sport") }) : cmd === "down" ? down(pool).then(() => console.log("[zt] down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
