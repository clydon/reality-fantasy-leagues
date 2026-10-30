// Dev-only check for a season's Setup on the desk (docs/PLAN-desk-parity.md step 3, parts 3a and 3b), against this lane's dev
// server, on a fixture of its own (zt_ds_ people, a ZT DS couch, the ZT DS Show with five seasons: 1 airing on its TV listing
// with two games on it, one ended; 2 ended with nothing playing it but a deleted game, a follower and research; 3 and 5
// airing with no schedule; 4 upcoming on its listing) and TVmaze's stand-in (fake-listings.js: the ZT DS Show with seasons
// 1, 3 and 5, an ended look-alike, and another show's Season 3):
//   1. Only site admins: zt_ds_jo (a player) is refused Setup's read and changes, and a season's Delete.
//   2. Setup's read: the lower third's next episode, its facts, The season's rows, the Schedule as it reads now (the
//      rundown, every episode, When it airs, Episodes, TV listing), Who decides results, the Delete's games in the way.
//   3. Name: set (a History line, Undo), the same again refused, too long refused, blank or the show and its number clears
//      it, an Undo refused once it's been renamed since.
//   4. Status: set on a linked season it holds over the listing's dates (the daily job's statusesByDate leaves it), Back to
//      its listing's dates lets them move it, each with Undo; refused when it's that already.
//   5. Who decides results: You decide (results_admin_since from the switch), the Inbox's Coming up line says so; a result the
//      desk decided (canonical, locked) isn't counted as leaving, as it reaches the games on either setting (since 2026-10-29),
//      so back to sources says nothing leaves; Undo putting the old cutoff back.
//   6. The schedule (3b): When it airs previewed (what moves, the listing's times it wins over, aired episodes put in the
//      future), saved (times_held_at: the listing's rows stop counting, "Set by hand, by zt_ds_desk"), the same again
//      refused; Episodes previewed (cleared, red, fewer than aired, added, not known) and saved with classic's prune; a read
//      of its listing (add-show.ts listedSeason) leaving both; Undo of each. Find it in the TV listings (its season, an ended
//      look-alike greyed, another show's greyed once the show has its listing), Use this listing (the show gains it, every
//      episode's time, held things let go), linked again refused, Undo, Unlink (its times kept), Undo; a held Ended says its
//      listing isn't read (Noticed ar).
//   7. The Delete: refused while games play it (ended ones too), a deleted game doesn't hold it; gone with its research and
//      follows, a line on the show's History.
//   8. Screens at --width: the season page (Running it › Setup's line, its Delete refused with the games listed), Setup
//      (the rundown, All N episodes, Name with the toast's Undo, Status held and Back, Who decides), When it airs (what
//      moves, saved, the toast's Undo), Episodes (fewer than aired: Clear and save, red), a season with no schedule (Set it
//      by hand's What it sets; Find it in the TV listings, its look-alike greyed, Use this listing), its TV listing linked
//      and Unlink it, Delete's hold from Setup landing on the show. Nothing wider than the screen; no page errors.
//   9. Nothing real moved: every account that isn't zt_ is as it was, and no real season's status, results_by, listing or holds.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-setup.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-setup.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_ds_ accounts (their sessions, seats and couch rows), the ZT DS couch and its zt-ds- games, the ZT DS Show and
// its seasons (and the research kept by its show and number), and the admin_changes lines its desk admin makes; --keep
// leaves the fixture up. TVmaze is only ever the stand-in (the x-gys-listings header). Refuses a non-local database. Prints
// PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const listings = require("./fake-listings");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-setup runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-setup.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_ds_${k}`;
const COUCH = "ZT DS Couch";
const SHOW = "zt-ds-show";
const NAME = "ZT DS Show";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  await pool.query(`DELETE FROM admin_changes WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_ds\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-ds-%'");
  await pool.query("DELETE FROM couches WHERE name = $1", [COUCH]);
  await pool.query("DELETE FROM episode_research WHERE show_id IN (SELECT id FROM shows WHERE slug = $1)", [SHOW]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_ds\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-ds-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-ds.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  await add("jo");
  await add("dana");

  const { rows: sh } = await pool.query("INSERT INTO shows (slug, name, kind, created_by, set_up_at, listing) VALUES ($1, $2, 'competition', $3, now(), $4) RETURNING id", [
    SHOW,
    NAME,
    ids.desk,
    JSON.stringify({ name: NAME, network: "ZTN" }),
  ]);
  ids.show = sh[0].id;
  const season = async (n, cols, vals, params = []) => {
    const { rows } = await pool.query(`INSERT INTO show_seasons (show_id, season_number, ${cols}) VALUES ($1, ${n}, ${vals}) RETURNING id`, [ids.show, ...params]);
    return rows[0].id;
  };
  // 1: airing on its listing, Wednesdays-or-whatever 8:05 PM Eastern from two weeks ago, six episodes.
  ids.s1 = await season(1, "status, premiere_date, finale_date, air_time, air_tz, release, episode_count, listing_id", "'airing', current_date - 14, current_date + 21, '20:05', 'America/New_York', 'weekly', 6, 990001");
  // 2: ended last year, nothing plays it now (a deleted game did); someone follows it and research is kept for it.
  ids.s2 = await season(2, "status, premiere_date, finale_date, air_time, air_tz, release, episode_count", "'completed', '2025-03-05', '2025-03-26', '21:00', 'America/New_York', 'weekly', 4");
  // 3: airing with nothing to say when. 4: upcoming on its listing.
  ids.s3 = await season(3, "status", "'airing'");
  ids.s4 = await season(4, "status, premiere_date, air_time, air_tz, release, listing_id", "'upcoming', current_date + 30, '20:00', 'America/New_York', 'weekly', 990004");
  ids.s5 = await season(5, "status", "'airing'");
  await pool.query("INSERT INTO show_follows (user_id, season_id, following) VALUES ($1, $2, true)", [ids.jo, ids.s2]);
  await pool.query(`INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 2, 1, '{}'::jsonb, '{}'::jsonb)`, [ids.show]);

  // The couch: jo and dana; its games on Show 1 (one playing, one ended) and a deleted one on Show 2.
  const { rows: c } = await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.jo]);
  ids.couch = c[0].id;
  for (const [i, k] of ["jo", "dana"].entries()) await pool.query("INSERT INTO couch_members (couch_id, user_id, role, joined_at) VALUES ($1, $2, $3, now())", [ids.couch, ids[k], i ? "member" : "owner"]);
  const game = async (slug, name, season, o = {}) => {
    const s = S.defaultState();
    s.players = ["jo", "dana"].map((k, i) => ({ id: `p${i + 1}`, name: U(k), color: "#5089c9", disabled: false, active: true }));
    s.draftOrder = ["p1", "p2"];
    Object.assign(s.settings, { leagueTypeId: "pickem", showId: SHOW, wikiSeason: String(season) }, o.settings || {});
    const code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[crypto.randomInt(31)]).join("");
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, ${o.deleted ? "now()" : "NULL"}) RETURNING id`,
      [name, slug, code, S.migrateLeagueState(s), ids.jo, ids.couch]
    );
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', 'commissioner'), ($1, $3, 'p2', 'member')", [rows[0].id, ids.jo, ids.dana]);
    return rows[0].id;
  };
  ids.g1 = await game("zt-ds-pool", "ZT DS Pool", 1);
  ids.g2 = await game("zt-ds-old", "ZT DS Old", 1, { settings: { archivedAt: new Date(Date.now() - 864e5).toISOString() } });
  ids.g3 = await game("zt-ds-gone", "ZT DS Gone", 2, { deleted: true });
  // Show 2's own: its public pool (dana plays it) and jo's practice game, on no couch: they go with it.
  for (const [slug, solo, who] of [["zt-ds-pool2", "public", "dana"], ["zt-ds-practice2", "practice", "jo"]]) {
    const s = S.defaultState();
    s.players = [{ id: "p1", name: U(who), color: "#5089c9", disabled: false, active: true }];
    Object.assign(s.settings, { leagueTypeId: "pickem", showId: SHOW, wikiSeason: "2" });
    const { rows } = await pool.query("INSERT INTO leagues (name, slug, join_code, state, created_by, solo, solo_season_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id", [
      `ZT DS ${solo}`,
      slug,
      Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[crypto.randomInt(31)]).join(""),
      S.migrateLeagueState(s),
      ids[who],
      solo,
      ids.s2,
    ]);
    ids[solo] = rows[0].id;
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', $3)", [rows[0].id, ids[who], solo === "public" ? "member" : "commissioner"]);
  }
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_SEASONS = `SELECT md5(string_agg(ss.id || ss.status || ss.results_by || coalesce(ss.name, '') || coalesce(ss.status_held_at::text, '')
    || coalesce(ss.listing_id::text, '') || coalesce(ss.times_held_at::text, '') || coalesce(ss.count_held_at::text, '') || coalesce(ss.episode_count::text, '')
    || coalesce(ss.air_time::text, '') || coalesce(ss.premiere_date::text, ''), ',' ORDER BY ss.id)) AS h
  FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`;

/** TVmaze's stand-in: the ZT DS Show (its Season 1 is Show 1's listing, 990001; Seasons 3 and 5 to be found), an ended
 *  look-alike with no Season 3, and another show with a Season 3. */
function standIn(now = Date.now()) {
  const ztn = { name: "ZTN", country: { name: "United States", code: "US", timezone: "America/New_York" } };
  const show = (id, name, o = {}) => ({ id, name, type: "Reality", language: "English", genres: [], status: o.ended ? "Ended" : "Running", premiered: "2020-01-01", ended: o.ended ?? null, network: o.network ?? ztn, webChannel: null, image: null, url: `https://www.tvmaze.com/shows/${id}`, schedule: { time: "21:00", days: ["Tuesday"] } });
  return [
    { show: show(990101, NAME), seasons: [listings.weekly(990001, 1, 6, 3, now), listings.weekly(9901013, 3, 6, 2, now), listings.weekly(9901015, 5, 8, 3, now)] },
    { show: show(990102, `${NAME} Juniors`, { ended: "2018-05-01" }), seasons: [listings.weekly(9901021, 1, 6, 6, now - 3000 * 864e5)] },
    { show: show(990103, `${NAME} (Australia)`, { network: { name: "ZT Seven", country: { name: "Australia", code: "AU", timezone: "Australia/Sydney" } } }), seasons: [listings.weekly(9901033, 3, 10, 4, now)] },
  ];
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_ds_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_USERS)).rows[0].h;
  const seasonsBefore = (await pool.query(REAL_SEASONS)).rows[0].h;
  const closers = [];
  try {
    const ids = await up(pool);
    const tv = await listings.start({ shows: standIn() });
    closers.push(tv.close);
    const headers = { "x-gys-listings": tv.url };
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD, headers }), jo: await api({ user: U("jo"), pass: PASSWORD, headers }) };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const setup = async (id) => (await as.desk.call("GET", `/api/desk/seasons/${id}/setup`)).body;
    const change = (id, body) => as.desk.call("POST", `/api/desk/seasons/${id}/setup`, body);
    const col = async (id, c) => (await pool.query(`SELECT ${c} AS v FROM show_seasons WHERE id = $1`, [id])).rows[0]?.v;

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", `/api/desk/seasons/${ids.s1}/setup`),
      as.jo.call("POST", `/api/desk/seasons/${ids.s1}/setup`, { name: "x" }),
      as.jo.call("DELETE", `/api/desk/seasons/${ids.s2}`),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused Setup and a season's Delete", refused.map((r) => r.status).join(","));
    check((await as.desk.call("GET", "/api/desk/seasons/not-a-season/setup")).status === 404, "a mistyped season: 404");

    // ---- 2. Setup's read ----
    const s1 = await setup(ids.s1);
    check(s1.status === "airing" && s1.linked && !s1.held && s1.scheduled && s1.zone === "Eastern" && s1.count === 6, "Show 1: airing, linked, scheduled, Eastern, six episodes", JSON.stringify({ ...s1, history: undefined, episodes: undefined }));
    check(/^Episode [2-4] · (tonight|today|tomorrow|\w{3} \w{3} \d+), 8:05 PM$|^Episode [2-4] · on now$/.test(s1.next), "its lower third: the next episode, when", s1.next);
    check(/^2 games on it · [1-3] of 6 aired$/.test(s1.facts), "its facts: games on it, aired of six", s1.facts);
    check(s1.rows.status === "Airing · moves on by its TV listing's dates", "Status: moves on by its listing's dates", s1.rows.status);
    check(/^\w+days 8:05 PM Eastern · from \w{3} \d+$/.test(s1.rows.when) && /^6 · the finale is /.test(s1.rows.episodes) && s1.rows.listing === "ZT DS Show on ZTN · its times, kept current each morning", "When it airs, Episodes and TV listing as it reads now", JSON.stringify(s1.rows));
    check(/^Sources that agree · once \d agree, every game gets it$/.test(s1.rows.results) && s1.resultsBy === "leagues", "Who decides results: sources that agree", s1.rows.results);
    check(/^\w+days 8:05 PM Eastern · 6 episodes · results from sources$/.test(s1.setupLine), "the season page's Setup line", s1.setupLine);
    const runs = s1.rundown.filter((r) => r.kind === "ep");
    check(runs.length >= 2 && runs.length <= 3 && runs.at(-1).title === "Episode 6 · the finale" && runs.every((r) => /^\d{1,2}:\d{2}$/.test(r.hm) && /^[AP]M$/.test(r.ap)), "the rundown: the next two and the finale", JSON.stringify(s1.rundown));
    check(s1.episodes.length === 6 && s1.episodes[0].aired && s1.episodes[5].finale && !s1.episodes[5].aired, "every episode, the aired ones marked, the finale last");
    check(s1.source === "From its TV listing", "the Schedule's aside: from its TV listing");
    check(s1.delete.games.map((g) => `${g.name}${g.ended ? " (ended)" : ""}`).join() === "ZT DS Pool,ZT DS Old (ended)" && s1.delete.line === "Not while 2 games play it", "its Delete: the games in the way, ended ones too", JSON.stringify(s1.delete));
    const s2 = await setup(ids.s2);
    check(s2.status === "completed" && /^4 episodes · ended Mar 26, 2025$/.test(s2.next) && /^\w+days 9:00 PM Eastern · Mar 5, 2025 to Mar 26, 2025$/.test(s2.rows.when) && s2.rundown.length === 0, "Show 2: ended, its run from first to last", `${s2.next} | ${s2.rows.when}`);
    check(s2.delete.games.length === 0 && s2.delete.followers === 1 && s2.delete.line === "Its episodes, cast and results go" && s2.source === "Set by hand", "Show 2: a deleted game doesn't hold it; one follower", JSON.stringify(s2.delete));
    check(s2.delete.pool === 1 && s2.delete.practice === 1 && s2.facts === "2 games on it", "its public pool and a practice game don't hold it either, and count as games on it", `${JSON.stringify(s2.delete)} | ${s2.facts}`);
    const s3 = await setup(ids.s3);
    check(!s3.scheduled && s3.next === "No schedule yet" && s3.rows.when === "Not set" && s3.rows.episodes === "Not known yet" && s3.rows.listing === "Not linked · nothing updates on its own" && s3.setupLine === "No schedule yet: nothing knows when it airs", "Show 3: no schedule", JSON.stringify(s3.rows));
    const s4 = await setup(ids.s4);
    check(s4.status === "upcoming" && /^Premieres · \w{3} \w{3} \d+, 8:00 PM$/.test(s4.next) && s4.byDates === "upcoming", "Show 4: upcoming, premieres", s4.next);

    // ---- 3. Name ----
    let r = await change(ids.s1, { name: "  ZT DS   Fancy " });
    check(r.status === 200 && r.body.text === "Named ZT DS Fancy" && !!r.body.changeId && (await col(ids.s1, "name")) === "ZT DS Fancy", "Name: set, trimmed", JSON.stringify(r.body));
    check((await setup(ids.s1)).history[0]?.text === 'Named "ZT DS Fancy"', "a History line");
    check((await change(ids.s1, { name: "ZT DS Fancy" })).status === 409, "the same name again: refused");
    check((await change(ids.s1, { name: "x".repeat(61) })).status === 400, "61 characters: refused");
    check((await undo(r.body.changeId)).status === 200 && (await col(ids.s1, "name")) === null, "Undo: no name again");
    const a = await change(ids.s1, { name: "ZT DS One" });
    const b = await change(ids.s1, { name: "ZT DS Two" });
    check((await undo(a.body.changeId)).status === 409 && (await col(ids.s1, "name")) === "ZT DS Two", "Undo refused once it's been renamed since");
    r = await change(ids.s1, { name: `${NAME} 1` });
    check(r.status === 200 && (await col(ids.s1, "name")) === null && /Name cleared · it shows as ZT DS Show 1/.test(r.body.text), "the show and its number clears it", r.body.text);
    check((await undo(r.body.changeId)).status === 200 && (await col(ids.s1, "name")) === "ZT DS Two" && (await undo(b.body.changeId)).status === 200 && (await col(ids.s1, "name")) === "ZT DS One", "Undos in turn put each back");
    await change(ids.s1, { name: "" });

    // ---- 4. Status ----
    const { statusesByDate } = loadListings();
    const hold = await change(ids.s1, { status: "airing" });
    check(hold.status === 200 && hold.body.text === "ZT DS Show 1: Airing, held" && !!(await col(ids.s1, "status_held_at")), "the status it has, on a linked season: held where it is", JSON.stringify(hold.body));
    check((await change(ids.s1, { status: "airing" })).status === 409, "the status it has, held already: refused");
    check((await undo(hold.body.changeId)).status === 200 && !(await col(ids.s1, "status_held_at")) && (await col(ids.s1, "status")) === "airing", "Undo: moved by its dates again");
    check((await change(ids.s1, { status: "nope" })).status === 400, "a status that isn't one: refused");
    r = await change(ids.s1, { status: "completed" });
    check(r.status === 200 && (await col(ids.s1, "status")) === "completed" && !!(await col(ids.s1, "status_held_at")), "Ended on a linked season: it holds", JSON.stringify(r.body));
    let held = await setup(ids.s1);
    check(held.held && held.rows.status === "Ended · set by hand, held over its listing" && held.byDates === "airing" && held.history[0].text === "Status: Ended (held over its listing)", "Setup says it's held, and what the dates would make it", held.rows.status);
    if (statusesByDate) {
      await statusesByDate(new Date());
      check((await col(ids.s1, "status")) === "completed", "the daily listings job leaves a held status");
    } else check(false, "the daily listings job's statusesByDate loads");
    const back = await change(ids.s1, { statusBack: true });
    check(back.status === 200 && (await col(ids.s1, "status")) === "airing" && !(await col(ids.s1, "status_held_at")) && back.body.text === "Back to its listing's dates · Airing", "Back to its listing's dates: Airing, not held", JSON.stringify(back.body));
    check((await change(ids.s1, { statusBack: true })).status === 409, "Back again: refused, the dates move it already");
    check((await undo(back.body.changeId)).status === 200 && (await col(ids.s1, "status")) === "completed" && !!(await col(ids.s1, "status_held_at")), "Undo Back: held at Ended again");
    // The first change left it Ended and held, as Back's Undo put it again: so the first one's Undo applies.
    check((await undo(r.body.changeId)).status === 200 && (await col(ids.s1, "status")) === "airing" && !(await col(ids.s1, "status_held_at")), "Undo Ended: Airing, moved by its dates again");
    const twice = await change(ids.s1, { status: "upcoming" });
    await change(ids.s1, { status: "completed" });
    check((await undo(twice.body.changeId)).status === 409, "an Undo refused once its status has moved on since");
    await pool.query("UPDATE show_seasons SET status = 'airing', status_held_at = NULL WHERE id = $1", [ids.s1]);
    r = await change(ids.s3, { status: "upcoming" });
    check(r.status === 200 && (await col(ids.s3, "status")) === "upcoming" && !(await col(ids.s3, "status_held_at")), "a season with no listing: its status set, nothing to hold over");
    await undo(r.body.changeId);
    if (statusesByDate) {
      await pool.query("UPDATE show_seasons SET status = 'airing', status_held_at = NULL WHERE id = $1", [ids.s1]);
      await pool.query("UPDATE show_seasons SET status = 'completed' WHERE id = $1", [ids.s4]);
      await statusesByDate(new Date());
      check((await col(ids.s4, "status")) === "upcoming", "a status not held still moves by its listing's dates");
    }

    // ---- 5. Who decides results ----
    check((await change(ids.s1, { resultsBy: "leagues" })).status === 409 && (await change(ids.s1, { resultsBy: "x" })).status === 400, "sources again, or neither: refused");
    const before = Date.now();
    r = await change(ids.s1, { resultsBy: "admin" });
    const since = await col(ids.s1, "results_admin_since");
    check(r.status === 200 && (await col(ids.s1, "results_by")) === "admin" && since && since.getTime() >= before - 5000 && r.body.text === "You decide ZT DS Show 1's results from now on", "You decide: from the switch on", JSON.stringify(r.body));
    const ad = await setup(ids.s1);
    check(/^You decide · since \w{3} \d+$/.test(ad.rows.results) && /you decide results$/.test(ad.setupLine) && ad.history[0].text === "Results decided on the desk, from now on", "Setup says you decide, since when", ad.rows.results);
    const coming = (await as.desk.call("GET", "/api/desk/inbox")).body.coming.find((c) => c.seasonId === ids.s1);
    check(!coming || (coming.how === "admin" && coming.line === "You decide results · couches' answers count too"), "the Inbox's Coming up says you decide (Noticed al)", JSON.stringify(coming));
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, status, fact_status, decided_at, locked_at)
       VALUES ($1, 1, 'elimination', 'Zt Nobody', 'voted out', 'accepted', 'canonical', now() + interval '1 second', now())`,
      [ids.s1]
    );
    check((await setup(ids.s1)).onlyYours === 0, "a result the desk decided isn't counted as leaving: it reaches the games on either setting");
    const toSources = await change(ids.s1, { resultsBy: "leagues" });
    check(toSources.status === 200 && (await col(ids.s1, "results_by")) === "leagues" && (await setup(ids.s1)).history[0].text === "Results from sources that agree", "back to sources: nothing leaves its games", JSON.stringify(toSources.body));
    check((await undo(toSources.body.changeId)).status === 200 && (await col(ids.s1, "results_by")) === "admin" && (await col(ids.s1, "results_admin_since")).getTime() === since.getTime(), "Undo: you decide again, from the same moment");
    check((await undo(r.body.changeId)).status === 200 && (await col(ids.s1, "results_by")) === "leagues", "Undo the switch: sources again");
    await pool.query("DELETE FROM season_decisions WHERE season_id = $1", [ids.s1]);

    // ---- 6. the schedule (3b) ----
    const ET = "America/New_York";
    const etTime = (t) => new Date(t).toLocaleTimeString("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" });
    const prem1 = await col(ids.s1, "to_char(premiere_date, 'YYYY-MM-DD')");
    // Show 1's listing dates every episode at 8:00 PM Eastern (its own air time says 8:05): the listing's rows win until
    // times are set by hand (Noticed b).
    await pool.query(
      `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, title, source)
       SELECT $1, n, (($2::date + (n - 1) * 7) + time '20:00') AT TIME ZONE 'America/New_York', 60, 'Night ' || n, 'listing' FROM generate_series(1, 6) n`,
      [ids.s1, prem1]
    );
    let sx = await setup(ids.s1);
    check(/ 8:00 PM Eastern · /.test(sx.rows.when) && sx.source === "From its TV listing" && !sx.timesHeld, "the listing's per-episode times win while nothing's set by hand", sx.rows.when);
    check(sx.form.how === "weekly" && sx.form.premiere === prem1 && sx.form.time === "20:05" && sx.form.tz === ET && sx.zones.some(([z, n]) => z === ET && n === "Eastern"), "When it airs opens on what's set", JSON.stringify(sx.form));
    check(/^Its times: \w+days at 8:00 PM Eastern, kept current each morning\.$/.test(sx.listing?.times || "") && /^Its dates move the status on: airing from \w{3} \d+, ended after \w{3} \d+\.$/.test(sx.listing?.dates || ""), "its TV listing's sheet: its times and its dates", JSON.stringify(sx.listing));
    const want = { how: "weekly", premiere: prem1, time: "21:00", tz: ET };
    let pv = (await change(ids.s1, { when: want, preview: true })).body;
    const airedNow = sx.episodes.filter((e) => e.aired).length;
    check(!pv.fresh && !pv.same && pv.moved === 6 - airedNow && pv.rows.length === Math.min(3, pv.moved) && pv.rows[0].from === "8:00 PM" && pv.rows[0].to === "9:00 PM" && pv.listingWins && pv.games === 1 && !pv.bot && (!pv.warn || /^Episode \d has aired/.test(pv.warn.title)), "When it airs, previewed: what moves, from the listing's 8:00 PM", JSON.stringify(pv));
    check(/^\w+days 9:00 PM Eastern: Episode 1 \w{3} \d+, the finale \w{3} \d+\.$/.test(pv.summary) && pv.more === Math.max(0, pv.moved - 3), "its summary, and how many more", pv.summary);
    const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    pv = (await change(ids.s1, { when: { ...want, premiere: later }, preview: true })).body;
    check(!!pv.warn && /aired, but this puts (it|them) in the future$/.test(pv.warn.title), "a first episode a month on: aired episodes would land in the future", JSON.stringify(pv.warn));
    pv = (await change(ids.s1, { when: { ...want, how: "nightly" }, preview: true })).body;
    check(/^Nightly, 9:00 PM Eastern/.test(pv.summary) && pv.moved > 0, "Nightly: its summary", pv.summary);
    check((await change(ids.s1, { when: { ...want, time: "25:00" } })).status === 400 && (await change(ids.s1, { when: { ...want, how: "daily" } })).status === 400 && (await change(ids.s1, { when: { ...want, premiere: "" } })).status === 400, "a bad time, way or date: refused");
    const w = await change(ids.s1, { when: want });
    check(w.status === 200 && /^Saved · Episode \d airs .+, 9:00 PM$/.test(w.body.text) && !!(await col(ids.s1, "times_held_at")) && (await col(ids.s1, "to_char(air_time, 'HH24:MI')")) === "21:00", "saved: its times win over its listing's", JSON.stringify(w.body));
    const dates = (await pool.query("SELECT air_dates FROM season_air_dates WHERE season_id = $1", [ids.s1])).rows[0].air_dates;
    check(Object.keys(dates).length === 0, "the listing's rows no longer count in season_air_dates", JSON.stringify(dates));
    sx = await setup(ids.s1);
    check(/ 9:00 PM Eastern · /.test(sx.rows.when) && sx.source === "Set by hand, by zt_ds_desk" && sx.timesHeld && sx.rows.listing === "ZT DS Show on ZTN · your 9:00 PM wins over its 8:00 PM" && /Yours, 9:00 PM, win\.$/.test(sx.listing.times), "Setup: set by hand, by whom, winning over its listing", `${sx.source} | ${sx.rows.listing} | ${sx.listing.times}`);
    check(sx.history[0].text === "Times changed by hand: " + sx.rows.when.split(" · ")[0], "a History line", sx.history[0].text);
    check((await change(ids.s1, { when: want })).status === 409, "the same times again: refused, nothing moves");
    // Episodes
    const aired1 = sx.episodes.filter((e) => e.aired).length;
    let cp = (await change(ids.s1, { episodes: 1, preview: true })).body;
    check(cp.cleared.length === 2 && /^Episodes 2 to 6 come off the list/.test(cp.cleared[0]) && cp.clears && cp.warn?.title === "Fewer than have aired" && /has aired \d+\./.test(cp.warn.line) && /^The finale was /.test(cp.finale), "Episodes down to 1, previewed: what's cleared, red, fewer than aired", JSON.stringify(cp));
    cp = (await change(ids.s1, { episodes: 8, preview: true })).body;
    check(!cp.cleared.length && !cp.clears && /^Episodes 7 and 8 are added, to \w{3} \w{3} \d+\.$/.test(cp.added || "") && /^The finale is /.test(cp.finale), "up to 8: what's added", JSON.stringify(cp));
    cp = (await change(ids.s1, { episodes: null, preview: true })).body;
    check(/nothing counts as the finale/.test(cp.unknown || "") && cp.finale === "Not known: nothing counts as the finale", "not known yet: what that means", JSON.stringify(cp));
    check((await change(ids.s1, { episodes: 0 })).status === 400 && (await change(ids.s1, { episodes: 6 })).status === 409, "0 episodes or the count it has: refused");
    await pool.query(`INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 1, 2, '{}', '{}'), ($1, 1, 5, '{}', '{}'), ($1, 1, 1, '{}', '{}')`, [ids.show]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, status) VALUES ($1, 4, 'elimination', 'Zt Pending', 'voted out', 'pending'), ($1, 3, 'elimination', 'Zt Kept', 'voted out', 'accepted')`,
      [ids.s1]
    );
    const keep = Math.max(1, aired1 - 1);
    const c = await change(ids.s1, { episodes: keep });
    const left = (await pool.query("SELECT episode_number FROM episode_research WHERE show_id = $1 AND season_number = 1 ORDER BY 1", [ids.show])).rows.map((x) => x.episode_number);
    const dec = (await pool.query("SELECT status FROM season_decisions WHERE season_id = $1 ORDER BY status", [ids.s1])).rows.map((x) => x.status);
    check(c.status === 200 && (await col(ids.s1, "episode_count")) === keep && !!(await col(ids.s1, "count_held_at")) && left.every((n) => n <= keep), `${keep} episodes: saved, held, research past it cleared`, `${JSON.stringify(c.body)} | ${left}`);
    check(dec.join() === (keep < 3 ? "accepted" : "accepted") && /cleared research on \d+ episodes? and 1 result still settling$/.test((await setup(ids.s1)).history[0].text), "a result still settling past it cleared, a confirmed one kept; History says so", `${dec} | ${(await setup(ids.s1)).history[0].text}`);
    // A read of its listing leaves the times and count set by hand (add-show.ts listedSeason, as the daily job reads it).
    const { listedSeason } = loadServer("../../src/lib/server/add-show.ts");
    const theirs = standIn()[0];
    await listedSeason(ids.show, theirs.show, theirs.seasons[0].season, tv.url, new Date(), ids.s1);
    check(
      (await col(ids.s1, "to_char(air_time, 'HH24:MI')")) === "21:00" && (await col(ids.s1, "episode_count")) === keep && (await col(ids.s1, "to_char(premiere_date, 'YYYY-MM-DD')")) === prem1 &&
        Object.keys((await pool.query("SELECT air_dates FROM season_air_dates WHERE season_id = $1", [ids.s1])).rows[0].air_dates).length === 0,
      "a read of its listing leaves what's set by hand"
    );
    check((await undo(c.body.changeId)).status === 200 && (await col(ids.s1, "episode_count")) === 6 && !(await col(ids.s1, "count_held_at")), "Undo the count: 6 again, not held");
    check((await undo(w.body.changeId)).status === 200 && !(await col(ids.s1, "times_held_at")) && (await col(ids.s1, "to_char(air_time, 'HH24:MI')")) === "20:05", "Undo the times: its own 8:05 PM, the listing's rows winning again");
    // (The read above rewrote its listing's rows from the stand-in, whose episodes air at 9:00 PM Eastern in October.)
    sx = await setup(ids.s1);
    check(!/8:05/.test(sx.rows.when) && sx.source === "From its TV listing" && !sx.timesHeld, "Setup: from its TV listing again, its times the listing's", sx.rows.when);
    check((await undo(w.body.changeId)).status === 409, "an Undo once undone: refused");
    await pool.query("DELETE FROM season_decisions WHERE season_id = $1", [ids.s1]);
    await pool.query("DELETE FROM season_episodes WHERE season_id = $1", [ids.s1]);
    // Find it in the TV listings, Use this listing, Unlink it
    const find = async (id, q = NAME) => (await as.desk.call("GET", `/api/desk/seasons/${id}/listings?q=${encodeURIComponent(q)}`)).body;
    let f5 = await find(ids.s5);
    const a5 = f5.hits.find((h) => h.tvmazeId === 990101);
    const jr = f5.hits.find((h) => h.tvmazeId === 990102);
    check(a5 && !a5.off && a5.listingId === 9901015 && /^Season 5 · \w+days \d+:00 PM · 8 episodes · \w{3} \d+ to \w{3} \d+$/.test(a5.line) && a5.fills.length === 3 && /^\w+days at \d+:00 PM Eastern, from \w{3} \d+: Episode 4 is next, /.test(a5.fills[0].text) && /^8 episodes: the finale /.test(a5.fills[1].text), "found: its Season 5, what it fills", JSON.stringify(a5));
    check(jr && jr.off === "ZT DS Show Juniors ended in 2018: it has no Season 5" && jr.line === "Ended 2018 · no season airing now", "an ended look-alike greyed, saying why", JSON.stringify(jr));
    check((await as.jo.call("GET", `/api/desk/seasons/${ids.s5}/listings?q=zt`)).status === 403, "a player can't search from Setup");
    check((await change(ids.s5, { listing: { tvmazeId: 990101, listingId: 9901013 } })).status === 409, "a listing's other season: refused");
    // A recap kept on a listing row (episode-recaps.ts) stays through linking and its Undo.
    await pool.query("INSERT INTO season_episodes (season_id, number, summary, summary_at, source) VALUES ($1, 2, 'ZT a recap', now(), 'listing')", [ids.s5]);
    const l5 = await change(ids.s5, { listing: { tvmazeId: 990101, listingId: 9901015 } });
    const tvmazeOf = async () => (await pool.query("SELECT tvmaze_id FROM shows WHERE id = $1", [ids.show])).rows[0].tvmaze_id;
    const rowsOf = async (id) => (await pool.query("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1 AND source = 'listing' AND air_at IS NOT NULL", [id])).rows[0].n;
    const recapOf = async (id, n) => (await pool.query("SELECT summary FROM season_episodes WHERE season_id = $1 AND number = $2", [id, n])).rows[0]?.summary ?? null;
    check(l5.status === 200 && /^Linked · Episode 4 airs /.test(l5.body.text) && (await col(ids.s5, "listing_id")) === 9901015 && (await tvmazeOf()) === 990101 && (await rowsOf(ids.s5)) === 8 && (await col(ids.s5, "episode_count")) === 8, "Use this listing: linked, the show gains its listing, every episode's time", JSON.stringify(l5.body));
    sx = await setup(ids.s5);
    check(sx.scheduled && sx.linked && sx.source === "From its TV listing" && /^Linked to its TV listing: ZTN, \w+days \d+:00 PM$/.test(sx.history[0].text), "Setup: scheduled from its listing, a History line", `${sx.source} | ${sx.history[0].text}`);
    check((await change(ids.s5, { listing: { tvmazeId: 990101, listingId: 9901015 } })).status === 409, "the same listing again: refused");
    const f3 = await find(ids.s3);
    const au = f3.hits.find((h) => h.tvmazeId === 990103);
    check(au && au.off === "ZT DS Show is linked to another show's listing" && f3.hits.find((h) => h.tvmazeId === 990101 && !h.off && h.listingId === 9901013), "once the show has its listing, another show's is greyed", JSON.stringify(f3.hits.map((h) => [h.tvmazeId, h.off])));
    f5 = await find(ids.s5);
    check(f5.hits.find((h) => h.tvmazeId === 990101)?.off === "ZT DS Show 5 is linked to it already", "its own listing, greyed: linked already");
    check((await recapOf(ids.s5, 2)) === "ZT a recap", "the recap on its listing row stays");
    check((await undo(l5.body.changeId)).status === 200 && (await col(ids.s5, "listing_id")) === null && (await rowsOf(ids.s5)) === 0 && !(await setup(ids.s5)).scheduled && (await recapOf(ids.s5, 2)) === "ZT a recap", "Undo: no listing, no schedule again, the recap kept");
    const l5b = await change(ids.s5, { listing: { tvmazeId: 990101, listingId: 9901015 } });
    await change(ids.s5, { status: "completed" });
    sx = await setup(ids.s5);
    check(/ · not read again while it's held Ended$/.test(sx.rows.listing) && /not read again while it's held Ended/.test(sx.listing.times), "held Ended over dates that say it's on: its listing isn't read again (Noticed ar)", sx.rows.listing);
    await change(ids.s5, { statusBack: true });
    const un = await change(ids.s5, { unlink: true });
    sx = await setup(ids.s5);
    check(un.status === 200 && un.body.text === "Unlinked · its times stay as they are" && (await col(ids.s5, "listing_id")) === null && sx.scheduled && (await rowsOf(ids.s5)) === 8 && sx.source === "Kept from its old listing" && sx.rows.listing === "Not linked · nothing updates on its own", "Unlink it: its times stay, kept from its old listing", `${sx.source} | ${sx.rows.listing}`);
    check((await change(ids.s5, { unlink: true })).status === 409, "unlinked already: refused");
    check((await undo(un.body.changeId)).status === 200 && (await col(ids.s5, "listing_id")) === 9901015, "Undo Unlink: linked again");
    check(l5b.status === 200, "linked again after its Undo");
    // A linking that reads nothing: the stand-in down, the season as it was.
    tv.down = true;
    const failedLink = await change(ids.s3, { listing: { tvmazeId: 990101, listingId: 9901013 } });
    tv.down = false;
    check(failedLink.status === 503 && (await col(ids.s3, "listing_id")) === null, "TV listings not answering: refused, nothing linked", JSON.stringify(failedLink.body));

    // Only aired episodes dated differently (an ended season's wrong first date): saved, nothing in games moves.
    pv = (await change(ids.s2, { when: { how: "weekly", premiere: "2025-03-04", time: "21:00", tz: ET }, preview: true })).body;
    check(!pv.same && pv.airedOnly && pv.moved === 0 && !pv.warn, "an ended season's first date corrected: aired episodes only", JSON.stringify(pv));
    const fix = await change(ids.s2, { when: { how: "weekly", premiere: "2025-03-04", time: "21:00", tz: ET } });
    check(fix.status === 200 && (await col(ids.s2, "to_char(premiere_date, 'YYYY-MM-DD')")) === "2025-03-04" && (await col(ids.s2, "to_char(finale_date, 'YYYY-MM-DD')")) === "2025-03-25", "saved, its finale's date with it", JSON.stringify(fix.body));
    check((await undo(fix.body.changeId)).status === 200 && (await col(ids.s2, "to_char(finale_date, 'YYYY-MM-DD')")) === "2025-03-26", "Undo: its dates as they were");
    // Not known yet keeps the finale's date (the listings' status rule reads it).
    const unk = await change(ids.s2, { episodes: null });
    check(unk.status === 200 && (await col(ids.s2, "episode_count")) === null && (await col(ids.s2, "to_char(finale_date, 'YYYY-MM-DD')")) === "2025-03-26" && (await col(ids.s2, "status")) === "completed", "Episodes: not known yet keeps its finale's date", JSON.stringify(unk.body));
    await undo(unk.body.changeId);

    // ---- 7. the Delete (API) ----
    const del1 = await as.desk.call("DELETE", `/api/desk/seasons/${ids.s1}`);
    check(del1.status === 409 && /2 games play/.test(del1.body.error) && !!(await col(ids.s1, "id")), "Delete refused while games play it", JSON.stringify(del1.body));
    const del4 = await as.desk.call("DELETE", `/api/desk/seasons/${ids.s4}`);
    check(del4.status === 200 && !(await col(ids.s4, "id")) && (await pool.query("SELECT 1 FROM admin_changes WHERE entity = 'show' AND entity_id = $1 AND text = 'Deleted ZT DS Show 4'", [ids.show])).rows.length === 1, "Delete: gone, a line on the show's History", JSON.stringify(del4.body));
    check((await as.desk.call("GET", `/api/desk/seasons/${ids.s4}/setup`)).status === 404, "its Setup is gone too");

    // ---- 8. screens ----
    const d = await open({ user: U("desk"), pass: PASSWORD, width, height: 844, headers });
    closers.push(d.close);
    const failed = [];
    d.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await d.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const pg = d.page;
    let n = 0;
    const shot = async (name, fullPage = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage });
    };
    const fits = async (where) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re) => {
      try {
        await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 15000 });
      } catch {
        /* read what's there */
      }
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const line = async (row) => (await pg.locator(`[data-desk-row='${row}'] small`).first().innerText()).trim();
    const shut = async () => {
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(400);
    };

    // The season page: Running it › Setup's line, and its Delete refused with the games listed
    await pg.goto(`${BASE}/desk/season/${ids.s1}`);
    await pg.locator("[data-desk-row='setup']").waitFor({ timeout: 30000 });
    check(/^\w+days 8:05 PM Eastern · 6 episodes · results from sources$/.test(await line("setup")) && (await pg.locator("[data-desk-row='setup'] [data-off]").count()) === 0, "the season page's Setup row, as mocked, no dot", await line("setup"));
    check(/^Episode \d · /.test(await pg.locator("[data-lower-third-name]").locator("xpath=following-sibling::small").innerText()), "the season page's lower third: its next episode");
    check(/Delete ZT DS Show 1[\s\S]*Not while 2 games play it/.test(await pg.locator("[data-delete-row='season']").innerText()), "the season page ends with its Delete, saying why not");
    await pg.locator("[data-delete-row='season'] button").click();
    await pg.locator("[data-season-blocked]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-desk-row='season-blocker']").count()) === 2 && /ZT DS Old[\s\S]*ended/i.test(await pg.locator("[role=dialog]").innerText()), "refused: the games in the way, the ended one too");
    await fits("the season's Delete, refused");
    await shot("season-delete-refused");
    await shut();

    // Setup
    await pg.locator("[data-desk-row='setup']").click();
    await pg.locator("[data-desk-setup]").waitFor({ timeout: 30000 });
    check((await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) === "ZT DS Show 1", "Back names the season");
    check(/Airing/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")), "Setup's lower third: Airing");
    check((await pg.locator("[data-setup-run]").count()) >= 2 && /Episode 6 · the finale/.test(await pg.locator("[data-setup-rundown]").innerText()), "the rundown: next two and the finale");
    check((await pg.locator("[data-desk-setup] a[href^='/admin']").count()) === 0, "nothing on Setup links to classic admin");
    await fits("Setup");
    await shot("setup");
    await shot("setup-full", true);
    await pg.locator("[data-setup-all]").click();
    await pg.locator("[data-setup-episodes]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-setup-episode]").count()) === 6 && /Eastern time/.test(await pg.locator("[role=dialog]").innerText()), "All 6 episodes, in Eastern time");
    await shot("setup-all-episodes");
    await shut();

    // Name, and the toast's Undo
    await pg.locator("[data-desk-row='setup-name']").click();
    await pg.locator("[data-field-input='season-name']").fill("ZT DS Fancy");
    await shot("setup-name");
    await pg.locator("[data-setup-save]").click();
    check(/Named ZT DS Fancy/.test(await toasted(/Named/)), "a toast says it's named");
    await pg.waitForFunction(() => /ZT DS Fancy/i.test(document.querySelector("[data-lower-third-name]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/ZT DS Fancy/i.test(await pg.locator("[data-lower-third-name]").innerText()), "the lower third takes the name");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /ZT DS Show 1/i.test(document.querySelector("[data-lower-third-name]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check((await col(ids.s1, "name")) === null && /ZT DS Show 1/i.test(await pg.locator("[data-lower-third-name]").innerText()), "the toast's Undo puts it back");
    await pg.locator("[data-desk-row='setup-name']").click();
    await pg.locator("[data-field-input='season-name']").fill("x".repeat(60) + "y");
    check((await pg.locator("[data-field-input='season-name']").inputValue()).length === 60, "the field stops at 60");
    await shut();

    // Status: held, then back to its listing's dates
    await pg.locator("[data-desk-row='setup-status']").click();
    await pg.locator("[data-setup-status='completed']").waitFor({ timeout: 10000 });
    check(/holds until you go back/.test(await pg.locator("[role=dialog]").innerText()), "the sheet says a status chosen here holds");
    await shot("setup-status");
    await pg.locator("[data-setup-status='completed']").click();
    check(/ZT DS Show 1: Ended/.test(await toasted(/Ended/)), "a toast: Ended");
    await pg.waitForFunction(() => /held over its listing/.test(document.querySelector("[data-desk-row='setup-status']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/Ended · set by hand, held over its listing/.test(await line("setup-status")), "Status: held over its listing", await line("setup-status"));
    await pg.locator("[data-desk-row='setup-status']").click();
    await pg.locator("[data-setup-status-back]").waitFor({ timeout: 10000 });
    check(/They'd make it Airing/.test(await pg.locator("[role=dialog]").innerText()), "Back to its listing's dates, and what they'd make it");
    await shot("setup-status-held");
    await pg.locator("[data-setup-status-back]").click();
    check(/Back to its listing's dates · Airing/.test(await toasted(/Back to/)), "a toast: back to its listing's dates");
    await pg.waitForFunction(() => /moves on by/.test(document.querySelector("[data-desk-row='setup-status']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check((await col(ids.s1, "status")) === "airing" && !(await col(ids.s1, "status_held_at")), "airing, not held");

    // Who decides results
    await pg.locator("[data-desk-row='setup-results']").click();
    await pg.locator("[data-setup-results='admin']").waitFor({ timeout: 10000 });
    check(/Recommended/i.test(await pg.locator("[data-setup-results='leagues']").innerText()) && /a result you decide reaches every game on it, a dispute you settle too/.test(await pg.locator("[role=dialog]").innerText()), "the sheet: Sources that agree recommended, and either way");
    await fits("Who decides results");
    await shot("setup-results");
    await pg.locator("[data-setup-results='admin']").click();
    check(/You decide ZT DS Show 1's results from now on/.test(await toasted(/You decide/)), "a toast: you decide from now on");
    await pg.waitForFunction(() => /You decide/.test(document.querySelector("[data-desk-row='setup-results']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/^You decide · since/.test(await line("setup-results")), "Who decides: you, since today");
    check((await pg.locator("[data-history-line]").count()) === 3 && (await pg.locator("[data-history-all]").count()) === 1, "History: the latest three, and All N");
    await shot("setup-after", true);
    await change(ids.s1, { resultsBy: "leagues" });

    // When it airs: what moves, saved, the toast's Undo
    await pg.locator("[data-desk-row='setup-when']").click();
    await pg.locator("[data-when-how='weekly'][aria-checked=true]").waitFor({ timeout: 10000 });
    await pg.locator("[data-when-time]").fill("21:00");
    await pg.locator("[data-when-move]").first().waitFor({ timeout: 15000 });
    check(/8:05 PM[\s\S]*9:00 PM/.test(await pg.locator("[data-when-move]").first().innerText()) && /Lineups and picks in its 1 game lock at the new times/.test(await pg.locator("[data-points='when']").innerText()), "When it airs: each episode's old and new time, and what moves with it");
    check(/^\w+days 9:00 PM Eastern: Episode 1/.test(await pg.locator("[data-when-summary]").innerText()), "its summary line");
    await fits("When it airs");
    await shot("setup-when");
    await shot("setup-when-full", true);
    await pg.locator("[data-when-save]").click();
    check(/^Saved · Episode \d airs .*9:00 PM/.test(await toasted(/Saved/)), "a toast: saved, when the next airs");
    await pg.waitForFunction(() => /9:00 PM/.test(document.querySelector("[data-desk-row='setup-when']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/9:00 PM Eastern/.test(await line("setup-when")) && /Set by hand, by zt_ds_desk/.test(await pg.locator("[data-desk-setup]").innerText()), "When it airs reads 9:00 PM; the Schedule's aside names who set it", await line("setup-when"));
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /8:05 PM/.test(document.querySelector("[data-desk-row='setup-when']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check((await col(ids.s1, "to_char(air_time, 'HH24:MI')")) === "20:05" && !(await col(ids.s1, "times_held_at")), "the toast's Undo puts its times back");

    // Episodes: fewer than have aired turns the button red
    await pg.locator("[data-desk-row='setup-count']").click();
    await pg.locator("[data-count-n]").waitFor({ timeout: 10000 });
    for (let i = 0; i < 6 && (await pg.locator("[data-count-n]").innerText()) !== "1"; i++) await pg.locator("[data-count-step='-1']").click();
    await pg.locator("[data-warn='count']").waitFor({ timeout: 15000 }).catch(() => {});
    check((await pg.locator("[data-count-cleared] li").count()) === 2 && /Fewer than have aired/.test(await pg.locator("[data-warn='count']").innerText()) && /^Clear and save: 1 episode$/i.test((await pg.locator("[data-count-save]").innerText()).trim()), "down to 1: what's cleared, the warning, Clear and save");
    check(/bg-live/.test(await pg.locator("[data-count-save]").getAttribute("class")), "the button turns red");
    await fits("Episodes");
    await shot("setup-count-fewer");
    await shut();
    check((await col(ids.s1, "episode_count")) === 6, "closed unsaved: still 6");

    // A season with no schedule
    await pg.goto(`${BASE}/desk/season/${ids.s3}/setup`);
    await pg.locator("[data-setup-none]").waitFor({ timeout: 30000 });
    check(/No schedule/i.test(await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) && (await pg.locator("[data-setup-run]").count()) === 0, "no schedule: its lower third and no rundown");
    await fits("Setup with no schedule");
    await shot("setup-no-schedule");
    check(/Find it in the TV listings/.test(await pg.locator("[data-setup-find]").innerText()) && /bg-chyron/.test(await pg.locator("[data-setup-find]").getAttribute("class")) && (await pg.locator("[data-setup-hand]").count()) === 1, "no schedule: Find it in the TV listings (the yellow) and Set it by hand");

    // Set it by hand: what it sets, unsaved
    await pg.locator("[data-setup-hand]").click();
    await pg.locator("[data-when-premiere]").waitFor({ timeout: 10000 });
    check(/Pick the day the first episode aired, or airs/.test(await pg.locator("[data-when-summary]").innerText()) && (await pg.locator("[data-when-save]").isDisabled()), "Set it by hand: pick a day first");
    await pg.locator("[data-when-premiere]").fill(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
    await pg.locator("[data-when-move]").first().waitFor({ timeout: 15000 });
    check(/What it sets/i.test(await pg.locator("[data-when-what]").innerText()) && /Reminders, the TV guide and the Inbox's Coming up start/.test(await pg.locator("[data-points='when']").innerText()) && /Save the schedule/.test(await pg.locator("[data-when-save]").innerText()), "What it sets: the next episode, and what starts");
    await shot("setup-by-hand");
    await shut();

    // Find it in the TV listings: its look-alike greyed, Use this listing
    await pg.locator("[data-setup-find]").click();
    await pg.locator("[data-listing-hit='990101']").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-listing-hit='990102'][data-off]").count()) === 1 && (await pg.locator("[data-listing-hit='990103'][data-off]").count()) === 1, "the ended look-alike and another show's listing greyed");
    await pg.locator("[data-listing-hit='990102']").click();
    check(/ended in 2018: it has no Season 3/.test(await toasted(/ended in/)), "tapping a greyed one says why");
    await pg.locator("[data-listing-hit='990101']").click();
    await pg.locator("[data-listing-fills]").waitFor({ timeout: 10000 });
    check(/6 episodes: the finale/.test(await pg.locator("[data-listing-fills]").innerText()) && /It moves the status on by its dates/.test(await pg.locator("[data-listing-fills]").innerText()), "What it fills");
    await fits("Find it in the TV listings");
    await shot("setup-find");
    await pg.locator("[data-listing-use]").click();
    check(/^Linked · Episode 3 airs /.test(await toasted(/Linked/)), "a toast: linked, when the next airs");
    await pg.waitForFunction(() => !document.querySelector("[data-setup-none]") && !!document.querySelector("[data-setup-run]"), null, { timeout: 15000 }).catch(() => {});
    check((await pg.locator("[data-setup-none]").count()) === 0 && (await pg.locator("[data-setup-run]").count()) >= 2 && /From its TV listing/.test(await pg.locator("[data-desk-setup]").innerText()), "linked: the rundown, from its TV listing");
    await shot("setup-linked", true);

    // Its TV listing, then Unlink it
    await pg.locator("[data-desk-row='setup-listing']").click();
    await pg.locator("[data-listing-linked]").waitFor({ timeout: 10000 });
    check(/Its times: \w+days at \d+:00 PM Eastern, kept current each morning/.test(await pg.locator("[data-points='listing']").innerText()), "its TV listing: its times");
    await fits("its TV listing");
    await shot("setup-listing");
    await pg.locator("[data-listing-unlink]").click();
    check(/Unlinked · its times stay as they are/.test(await toasted(/Unlinked/)), "a toast: unlinked, its times stay");
    await pg.waitForFunction(() => /Not linked/.test(document.querySelector("[data-desk-row='setup-listing']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/Not linked/.test(await line("setup-listing")) && (await pg.locator("[data-setup-run]").count()) >= 2 && /Kept from its old listing/.test(await pg.locator("[data-desk-setup]").innerText()), "unlinked: its times kept from its old listing");

    // Delete from Setup: the hold, then the show
    await pg.goto(`${BASE}/desk/season/${ids.s2}/setup`);
    await pg.locator("[data-desk-setup]").waitFor({ timeout: 30000 });
    await pg.locator("[data-delete-row='season'] button").click();
    await pg.locator("[data-season-delete]").waitFor({ timeout: 10000 });
    const consq = await pg.locator("[data-season-delete]").innerText();
    check(/Its episodes, cast and results go/.test(consq) && /Its public pool goes with it, and the 1 person playing it/.test(consq) && /1 practice game on it goes too/.test(consq) && /1 person following it loses it/.test(consq) && /ZT DS Show and its other seasons are untouched/.test(consq), "the hold says what goes (its pool, a practice game, the follower) and what doesn't", consq);
    await fits("the season's Delete");
    await shot("setup-delete");
    const box = await pg.locator("[data-hold]").boundingBox();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pg.mouse.down();
    await pg.waitForTimeout(1800);
    await pg.mouse.up();
    check(/Deleted ZT DS Show 2/.test(await toasted(/Deleted/)), "held: a toast says it's deleted");
    await pg.waitForURL((u) => u.pathname === `/desk/show/${ids.show}`, { timeout: 15000 }).catch(() => {});
    check(new URL(pg.url()).pathname === `/desk/show/${ids.show}`, "it lands on the show's page", pg.url());
    check(
      !(await col(ids.s2, "id")) &&
        !(await pool.query("SELECT 1 FROM episode_research WHERE show_id = $1 AND season_number = 2", [ids.show])).rows.length &&
        !(await pool.query("SELECT 1 FROM show_follows WHERE season_id = $1", [ids.s2])).rows.length,
      "gone with its research and follows"
    );
    check(!!(await pool.query("SELECT 1 FROM leagues WHERE id = $1 AND deleted_at IS NOT NULL", [ids.g3])).rows.length, "the deleted game on it is kept (restorable, on no season)");
    check(!(await pool.query("SELECT 1 FROM leagues WHERE id = ANY($1::uuid[])", [[ids.public, ids.practice]])).rows.length, "its public pool and practice game went with it");
    check(!!(await pool.query("SELECT 1 FROM admin_changes WHERE entity = 'show' AND entity_id = $1 AND text = 'Deleted ZT DS Show 2, with its public pool and 1 practice game'", [ids.show])).rows.length, "the show's History line says what went with it");
    await shot("show-after-delete");

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    check((await pool.query(REAL_USERS)).rows[0].h === realBefore, "every real account is as it was");
    check((await pool.query(REAL_SEASONS)).rows[0].h === seasonsBefore, "every real season's name, status and who decides are as they were");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

/** The daily listings job's status step (tv-listings.ts statusesByDate), loaded from the source; null when it can't be. */
function loadListings() {
  return loadServer("../../src/lib/server/tv-listings.ts");
}

/** A server module, loaded from the source; {} when it can't be. */
function loadServer(file) {
  try {
    const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
    return jiti(file);
  } catch (e) {
    console.error(`couldn't load ${file}:`, e.message);
    return {};
  }
}
