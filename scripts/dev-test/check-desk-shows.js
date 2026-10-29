// Dev-only check for a show on the desk (docs/PLAN-desk-parity.md part 7a), against this lane's dev server, on a fixture of its
// own (zt_dv_ people; ZT DV Isle, a game with two seasons, games on both, one deleted, and a public pool; ZT DV Quiet, watched
// and not a game, with a follower, a practice game and a cast; ZT DV Gossip, added by name; ZT DV Gone, archived, with a game;
// a crowd for paging):
//   1. Only site admins: zt_dv_oz (a player) is refused the shows routes.
//   2. Find › Shows through the API: All · Airing · Not a game yet · Added by name · Archived, their counts, a search, 25 at a
//      time, both sorts; a row's season, games and who's watching; Browse's line and Find's three.
//   3. A show's page through the API: its seasons with their games and schedules, its words, its research sites, and its
//      Delete's games in the way, by season (ended and deleted ones too; its pool not).
//   4. Add a season: a number that's here refused, a bad status refused (not turned into Ended), Airing with no schedule in the
//      Inbox, from sources that agree, last season's rulebook, a line on the show and the season; Undo, refused once it's used.
//   5. Its words: the show's (a plural only when it isn't the singular's own) and its season's rulebook's, with Undo.
//   6. Research sites: our usual from its wiki, a pasted page kept as its host, a duplicate and a non-site refused, one taken
//      off, back to our usual, Undo; and what research's prompt reads (episode-research.js domainsFor) the same each time.
//   7. Archive and Restore (tier 1, Undo), out of and back in everyone's catalog; adding an archived show by name meanwhile
//      makes a new show (Noticed v, as the page says).
//   8. Delete: refused while it has games (a deleted one too), else gone with its seasons, follows and practice game, a line
//      left in History; a game deleted long enough ago doesn't hold it.
//   9. Screens at --width: Browse's Shows row, Shows searched (the address keeps it) and its Archived row's Restore, a show's
//      page (Delete last), Add a season (a number that's here, then added: the season's page with Undo), Its words with its
//      sample, Research sites (a pasted page, a site off, back to our usual), the Delete refused (Archive it instead, the
//      archived page, Restore), a hold, held landing on Shows, Find's three shows and All N. Nothing wider than the screen.
//  10. Nothing real moved: every account, league and show that isn't zt_ is as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                   (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-shows.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-shows.js --down           (takes the fixture down, nothing else)
//
// up/down: zt_dv_ accounts (their sessions, seats, couch rows, follows and notices), the ZT DV couch, the zt-dv- shows (their
// seasons, rulebooks, research and follows go with them) and games, and the admin_changes lines on them; --keep leaves the
// fixture up. Its join codes all start Z7S (no real one may: it refuses to run if one does). Refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-shows runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-shows.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dv_${k}`;
const COUCH = "ZT DV Couch";
const ISLE = ["zt-dv-isle", "ZT DV Isle"];
const QUIET = ["zt-dv-quiet", "ZT DV Quiet"];
const GOSSIP = ["zt-dv-gossip", "ZT DV Gossip"];
const GONE = ["zt-dv-gone", "ZT DV Gone"];
const PREFIX = "Z7S";
const CROWD = 26;
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows: shows } = await pool.query("SELECT id FROM shows WHERE slug LIKE 'zt-dv-%'");
  const { rows: seasons } = await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug LIKE 'zt-dv-%'");
  const { rows: books } = await pool.query("SELECT r.id FROM rulebooks r WHERE r.season_id = ANY($1::uuid[])", [seasons.map((r) => r.id)]);
  const { rows: games } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-dv-%' OR state->'settings'->>'showId' LIKE 'zt-dv-%'");
  await pool.query(
    `DELETE FROM admin_changes WHERE (entity = 'show' AND entity_id = ANY($1)) OR (entity = 'season' AND entity_id = ANY($2)) OR (entity = 'rulebook' AND entity_id = ANY($3))
        OR (entity = 'game' AND entity_id = ANY($4)) OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dv\\_%')
        OR (entity = 'show' AND text LIKE 'Deleted ZT DV %')`,
    [shows.map((r) => r.id), seasons.map((r) => r.id), books.map((r) => r.id), games.map((r) => r.id)]
  );
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dv\\_%')`);
  await pool.query("DELETE FROM leagues WHERE id = ANY($1::uuid[])", [games.map((r) => r.id)]);
  await pool.query("DELETE FROM couches WHERE name LIKE 'ZT DV %'");
  await pool.query("DELETE FROM shows WHERE slug LIKE 'zt-dv-%'");
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dv\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the code checks can't run here`);
  const { ensureSeasonRulebook } = require("../../db/rulebooks.js");
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const days = (n) => new Date(Date.now() - n * 864e5);
  const add = async (k, o = {}) => {
    const id = `zt-dv-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-dv.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["kim", "fan", "oz"]) await add(k);

  const show = async (key, [slug, name], o = {}) => {
    const { rows } = await pool.query(
      `INSERT INTO shows (slug, name, kind, format, set_up_at, created_by, tvmaze_id, archived, castaway_term, tribe_term, wiki_api_url, created_at)
       VALUES ($1, $2, $3, 'survivor', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [slug, name, o.kind ?? "competition", o.game ? days(30) : null, o.byName ? ids.kim : null, o.tvmaze ?? null, !!o.archived, o.person ?? "Contestant", o.group ?? "Team", o.wiki ?? null, days(o.age ?? 60)]
    );
    ids[key] = rows[0].id;
  };
  const season = async (key, showKey, n, status) => {
    ids[key] = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, $2, $3) RETURNING id", [ids[showKey], n, status])).rows[0].id;
  };
  await show("isle", ISLE, { game: true, person: "Castaway", group: "Tribe" });
  await season("isle1", "isle", 1, "completed");
  await season("isle2", "isle", 2, "airing");
  await ensureSeasonRulebook(pool, ids.isle2);
  for (const [i, [name, tribe]] of [["Zed Vee", "Red"], ["Zoe Vale", "Blue"], ["Zack Vo", "Blue"]].entries())
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, $2, $3, $4)", [ids.isle2, name, tribe, i]);
  await show("quiet", QUIET, { tvmaze: 990771, wiki: "https://zt-dv-quiet.fandom.com/api.php" });
  await season("quiet1", "quiet", 1, "upcoming");
  await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, 'Quinn Vance', 0), ($1, 'Quade Voss', 1)", [ids.quiet1]);
  await pool.query("INSERT INTO show_follows (user_id, season_id) VALUES ($1, $2)", [ids.fan, ids.quiet1]);
  await show("gossip", GOSSIP, { byName: true, person: "Cast" });
  await season("gossip1", "gossip", 1, "upcoming");
  await show("gone", GONE, { game: true, archived: true });
  await season("gone1", "gone", 1, "airing");
  for (let i = 1; i <= CROWD; i++) await show(`crowd${i}`, [`zt-dv-crowd-${i}`, `ZT DV Zz Crowd ${String(i).padStart(2, "0")}`], { game: true });
  await pool.query(`INSERT INTO admin_changes (entity, entity_id, action, text, user_id, created_at) VALUES ('show', $1, 'archive', 'Archived: out of everyone''s search', $2, $3)`, [ids.gone, ids.desk, days(9)]);

  ids.couch = (await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.kim])).rows[0].id;
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'couch')", [ids.couch, ids.kim]);
  let codes = 0;
  const codeOf = () => {
    const n = codes++;
    return `${PREFIX}${AB[Math.floor(n / AB.length) % AB.length]}${AB[n % AB.length]}${AB[crypto.randomInt(AB.length)]}`;
  };
  const game = async (key, o) => {
    const s = S.defaultState();
    s.players = [{ id: "p1", name: U("kim"), color: "#5089c9", disabled: false, active: true }];
    s.draftOrder = ["p1"];
    Object.assign(s.settings, { leagueTypeId: o.type ?? "classic-draft", showId: o.show, wikiSeason: String(o.season) });
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, solo, solo_season_id, deleted_at, deleted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [o.name, `zt-dv-${key}`, codeOf(), S.migrateLeagueState(s), ids.kim, o.solo ? null : ids.couch, o.solo ?? null, o.soloSeason ? ids[o.soloSeason] : null, o.deletedDays ? days(o.deletedDays) : null, o.deletedDays ? ids.kim : null]
    );
    ids[key] = rows[0].id;
    if (!o.deletedDays && !o.solo) await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', 'commissioner')", [ids[key], ids.kim]);
  };
  await game("outlast", { name: "ZT DV Outlast", show: ISLE[0], season: 2 });
  await game("old", { name: "ZT DV Old Lineup", type: "active-roster", show: ISLE[0], season: 1 });
  await game("binned", { name: "ZT DV Binned", type: "pickem", show: ISLE[0], season: 2, deletedDays: 5 });
  await game("pool", { name: "ZT DV Everyone", type: "pickem", show: ISLE[0], season: 2, solo: "public", soloSeason: "isle2" });
  await game("practice", { name: "ZT DV Practice", show: QUIET[0], season: 1, solo: "practice", soloSeason: "quiet1" });
  await game("goneGame", { name: "ZT DV Gone Game", type: "pickem", show: GONE[0], season: 1 });
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text, ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || coalesce(deleted_at::text, ''), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;
const REAL_SHOWS = `SELECT md5(string_agg(s.id || s.name || s.archived::text || s.castaway_term || s.tribe_term || s.episode_term || coalesce(array_to_string(s.research_domains, ' '), '')
    || (SELECT count(*) FROM show_seasons ss WHERE ss.show_id = s.id), ',' ORDER BY s.id)) AS h FROM shows s WHERE s.slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dv_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const before = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_SHOWS].map(async (q) => (await pool.query(q)).rows[0].h));
  const closers = [];
  try {
    const ids = await up(pool);
    const as = {
      desk: await api({ user: U("desk"), pass: PASSWORD }),
      kim: await api({ user: U("kim"), pass: PASSWORD }),
      oz: await api({ user: U("oz"), pass: PASSWORD }),
    };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const list = async (o) => (await as.desk.call("GET", `/api/desk/shows?${new URLSearchParams(o)}`)).body;
    const get = async (id) => (await as.desk.call("GET", `/api/desk/shows/${id}`)).body;
    const act = (id, body) => as.desk.call("POST", `/api/desk/shows/${id}`, body);
    const showRow = async (id) => (await pool.query("SELECT * FROM shows WHERE id = $1", [id])).rows[0];
    const names = (l) => l.shows.filter((s) => !/Crowd/.test(s.name)).map((s) => s.name);
    const ER = require("../../db/episode-research.js");
    const researchSites = async (slug) => (await ER.resolveSeasonResearchContext(pool, slug, 1, 1)).domains.join(", ");

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.oz.call("GET", "/api/desk/shows"),
      as.oz.call("GET", `/api/desk/shows/${ids.quiet}`),
      as.oz.call("POST", `/api/desk/shows/${ids.quiet}`, { archive: true }),
      as.oz.call("DELETE", `/api/desk/shows/${ids.quiet}`),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the shows routes", refused.map((r) => r.status).join(","));

    // ---- 2. Find › Shows ----
    let l = await list({ q: "ZT DV" });
    check(l.total === 3 + CROWD && l.shows.length === 25 && names(l).join() === "ZT DV Gossip,ZT DV Isle,ZT DV Quiet", "All: every ZT DV show but the archived one, by name, 25 at a time", `${l.total} ${names(l)}`);
    const more = await list({ q: "ZT DV", offset: "25", counts: "0" });
    check(more.shows.length === 3 + CROWD - 25 && !more.counts, "the next page: the rest, without the counts", `${more.shows.length}`);
    check(l.counts.archived >= 1 && l.counts.byname >= 1 && l.counts.air >= 1 && l.counts.none >= 2, "the chips' counts", JSON.stringify(l.counts));
    const row = (k) => l.shows.find((s) => s.id === ids[k]);
    check(row("isle").kind === "competition" && row("isle").season === "Season 2" && row("isle").airing && row("isle").games === 2, "ZT DV Isle: a game, Season 2 airing, 2 games (its deleted one and its pool aside)", JSON.stringify(row("isle")));
    check(row("quiet").kind === null && row("quiet").season === "Season 1" && row("quiet").watching === 1 && !row("quiet").byName, "ZT DV Quiet: not a game yet, Season 1, 1 watching", JSON.stringify(row("quiet")));
    check(row("gossip").byName, "ZT DV Gossip: added by name");
    check(names(await list({ q: "ZT DV", f: "air" })).join() === "ZT DV Isle", "Airing: ZT DV Isle");
    check(names(await list({ q: "ZT DV", f: "none" })).join() === "ZT DV Gossip,ZT DV Quiet", "Not a game yet: Gossip and Quiet");
    check(names(await list({ q: "ZT DV", f: "byname" })).join() === "ZT DV Gossip", "Added by name: Gossip");
    const arch = await list({ q: "ZT DV", f: "archived" });
    check(names(arch).join() === "ZT DV Gone" && arch.shows[0].archived?.at, "Archived: Gone, with when", JSON.stringify(arch.shows[0]));
    check((await list({ q: "ZT DV", sort: "games" })).shows[0].name === "ZT DV Isle", "Most games: ZT DV Isle first");
    const browse = (await as.desk.call("GET", "/api/desk/find?q=")).body.browse;
    check(browse?.shows?.all >= 3 + CROWD && browse.shows.airing >= 1 && browse.shows.byName >= 1, "Browse: shows, airing, added by name", JSON.stringify(browse?.shows));
    const found = (await as.desk.call("GET", `/api/desk/find?q=${encodeURIComponent("ZT DV")}`)).body;
    check(found.shows?.shows.length === 3 && found.shows.total === 4 + CROWD && !found.found.some((f) => f.kind === "show"), "Find: three shows and how many match (the archived one too), not in its other rows", JSON.stringify(found.shows?.total));

    // ---- 3. a show's page ----
    let isle = await get(ids.isle);
    check(isle.seasons.map((s) => `${s.number}:${s.status}:${s.games}:${s.scheduled}`).join() === "2:airing:1:false,1:completed:1:false", "its seasons: 2 airing (1 game, no schedule), 1 ended (1 game)", JSON.stringify(isle.seasons));
    check(isle.words.person === "castaway" && isle.words.people === "castaways" && isle.words.group === "tribe" && isle.words.groups === "tribes" && isle.words.episode === "Episode", "its words", JSON.stringify(isle.words));
    check(isle.sample.people === 3 && isle.sample.groups === 2, "its words' sample: 3 people in 2 groups", JSON.stringify(isle.sample));
    check(isle.rulebook?.season === "ZT DV Isle 2", "its newest season's rulebook", JSON.stringify(isle.rulebook));
    const d = isle.delete;
    check(
      d.games === 3 && d.blocked.length === 2 && d.blocked[0].label === "ZT DV Isle 2" && d.blocked[0].count === 2 && d.blocked[0].states.playing === 1 && d.blocked[0].states.deleted === 1 && d.blocked[1].one?.name === "ZT DV Old Lineup" && d.blocked[1].one.state === "ended",
      "its Delete: 3 games in the way by season (Isle 2: 1 playing, 1 deleted; Isle 1: Old Lineup, ended), its pool not",
      JSON.stringify(d.blocked)
    );
    check(d.line === "Not while it has 3 games · archive it instead" && d.pools === 1, "the Delete row's line; its pool goes with it", `${d.line} ${d.pools}`);
    let quiet = await get(ids.quiet);
    check(quiet.delete.games === 0 && quiet.delete.followers === 1 && quiet.delete.practice === 1 && quiet.delete.line === "Its seasons, episodes, cast and results go", "ZT DV Quiet's Delete: nothing in the way; 1 following, 1 practice game", JSON.stringify(quiet.delete));
    check(quiet.kind === "competition" && !quiet.setUp, "a show that isn't a game keeps its kind (New show starts from it)", JSON.stringify([quiet.kind, quiet.setUp]));
    const gw = (await get(ids.gossip)).words;
    check(gw.person === "cast member" && gw.people === "cast", "a show whose word is Cast: a cast member and the cast, as the app says", JSON.stringify(gw));
    check(!quiet.sites.own && quiet.sites.list.map((x) => `${x.host}:${x.from}`).join() === "zt-dv-quiet.fandom.com:wiki,tvline.com:usual,parade.com:usual", "its research sites: our usual, its wiki first", JSON.stringify(quiet.sites));

    // ---- 4. Add a season ----
    let r = await act(ids.isle, { action: "season", number: 2 });
    check(r.status === 409 && /Season 2 is here already/.test(r.body.error), "a number that's here: refused", JSON.stringify(r.body));
    r = await act(ids.isle, { action: "season", number: 3, status: "finished" });
    check(r.status === 400 && !(await pool.query("SELECT 1 FROM show_seasons WHERE show_id = $1 AND season_number = 3", [ids.isle])).rows.length, "a bad status: refused, nothing made (not turned into Ended)", JSON.stringify(r.body));
    r = await act(ids.isle, { action: "season", number: 3, status: "airing" });
    const s3 = r.body.seasonId;
    const s3row = (await pool.query("SELECT status, results_by, rulebook_id FROM show_seasons WHERE id = $1", [s3])).rows[0];
    check(r.status === 200 && s3row?.status === "airing" && s3row.results_by === "leagues" && /^Added ZT DV Isle 3 · next: its schedule$/.test(r.body.text) && r.body.changeId, "Season 3, Airing: made, results from sources that agree", JSON.stringify(r.body).slice(0, 200));
    const s3book = (await pool.query("SELECT parent_id, provenance FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [s3])).rows[0];
    check(!!s3book && !!s3row.rulebook_id, "a set-up show's new season plays by a rulebook of its own from the start", JSON.stringify(s3book));
    check(r.body.history.some((h) => h.text === "Added ZT DV Isle 3 (Airing), playing by last season's rulebook" && h.undoable), "the show's History says so, with Undo");
    check((await as.desk.call("GET", `/api/desk/seasons/${s3}`)).body.history?.some((h) => /Added to ZT DV Isle \(Airing\)/.test(h.text)), "the season's History too");
    let inbox = (await as.desk.call("GET", "/api/desk/inbox")).body.items;
    check(inbox.some((i) => i.kind === "schedule" && i.title === "ZT DV Isle 3 is airing with no schedule"), "airing with no schedule: it's in the Inbox");
    r = await undo(r.body.changeId);
    check(r.status === 200 && !(await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [s3])).rows.length, "Undo: the season goes again", JSON.stringify(r.body));
    inbox = (await as.desk.call("GET", "/api/desk/inbox")).body.items;
    check(!inbox.some((i) => /ZT DV Isle 3/.test(i.title)), "and leaves the Inbox");
    r = await act(ids.quiet, { action: "season" });
    const q2 = r.body.seasonId;
    const q2row = (await pool.query("SELECT season_number, status FROM show_seasons WHERE id = $1", [q2])).rows[0];
    check(r.status === 200 && q2row.season_number === 2 && q2row.status === "upcoming" && !(await pool.query("SELECT 1 FROM rulebooks WHERE season_id = $1", [q2])).rows.length, "with no number or status: the next one, Upcoming (New show's); a show that isn't a game gets no rulebook", JSON.stringify(q2row));
    await pool.query("INSERT INTO show_follows (user_id, season_id) VALUES ($1, $2)", [ids.fan, q2]);
    r = await undo(r.body.changeId);
    check(r.status === 409 && /in use since/.test(r.body.error) && (await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [q2])).rows.length === 1, "Undo once someone follows it: refused, it stays", JSON.stringify(r.body));

    // ---- 5. its words ----
    const bookOf = async (seasonId) => (await pool.query("SELECT id, version, blocks FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [seasonId])).rows[0];
    const v0 = (await bookOf(ids.isle2)).version;
    r = await act(ids.isle, { words: { person: "castaway", people: "castaways", group: "tribe", groups: "tribes", episode: "Episode" } });
    check(r.status === 409, "the same words: refused", JSON.stringify(r.body));
    r = await act(ids.isle, { words: { person: "person", people: "", group: "tribe", groups: "tribes", episode: "Episode" } });
    check(r.status === 400, "a blank word: refused");
    r = await act(ids.isle, { words: { person: "person", people: "people", group: "faction", groups: "factions", episode: "Night" } });
    let sr = await showRow(ids.isle);
    let book = await bookOf(ids.isle2);
    check(
      r.status === 200 && sr.castaway_term === "Person" && sr.castaway_plural === "People" && sr.tribe_term === "Faction" && sr.tribe_plural === null && sr.episode_term === "Night",
      "saved on the show: a plural kept only where it isn't the singular's own (People, not Factions)",
      JSON.stringify([sr.castaway_term, sr.castaway_plural, sr.tribe_term, sr.tribe_plural, sr.episode_term])
    );
    check(
      book.version > v0 && book.blocks.cast.singular === "person" && book.blocks.cast.plural === "people" && book.blocks.parts?.singular === "night" && (!book.blocks.cast.groups || book.blocks.cast.groups.singular === "faction"),
      "and in its season's rulebook (a new version)",
      JSON.stringify({ v: book.version, cast: book.blocks.cast, parts: book.blocks.parts })
    );
    check(/^Saved · people in factions, every Night · 1 rulebook too$/.test(r.body.text) && r.body.words.people === "people", "the toast", r.body.text);
    const cast = (await as.desk.call("GET", `/api/desk/seasons/${ids.isle2}/cast`)).body;
    check(cast.terms?.people === "people" && cast.terms?.groups === "factions", "the season's Cast page reads them", JSON.stringify(cast.terms));
    r = await undo(r.body.changeId);
    sr = await showRow(ids.isle);
    book = await bookOf(ids.isle2);
    check(r.status === 200 && sr.castaway_term === "Castaway" && sr.castaway_plural === null && sr.episode_term === "Episode" && book.blocks.cast.singular === "castaway" && (book.blocks.parts?.singular ?? "episode") === "episode", "Undo: both back", JSON.stringify([sr.castaway_term, book.blocks.cast.singular, book.blocks.parts]));
    // 0429's trigger: a new singular, from anywhere (Make it a game, the listings job, classic), clears a plural set for the old one.
    await pool.query("UPDATE shows SET castaway_plural = 'Folk', tribe_plural = 'Mobs' WHERE id = $1", [ids.gossip]);
    await pool.query("UPDATE shows SET castaway_term = 'Player', updated_at = now() WHERE id = $1", [ids.gossip]);
    sr = await showRow(ids.gossip);
    check(sr.castaway_plural === null && sr.tribe_plural === "Mobs", "a new singular written anywhere clears its plural, and only its own", JSON.stringify([sr.castaway_plural, sr.tribe_plural]));
    await pool.query("UPDATE shows SET castaway_term = 'Cast', tribe_plural = NULL WHERE id = $1", [ids.gossip]);

    // ---- 6. research sites ----
    check((await researchSites(QUIET[0])) === "zt-dv-quiet.fandom.com, tvline.com, parade.com", "research reads our usual too", await researchSites(QUIET[0]));
    r = await act(ids.quiet, { sites: { add: "https://www.RealityTea.com/category/survivor/" } });
    quiet = r.body;
    check(r.status === 200 && quiet.sites.own && quiet.sites.list.at(-1).host === "realitytea.com" && quiet.sites.list.at(-1).from === "added" && r.body.text === "Added realitytea.com · from the next research run", "a pasted page: kept as realitytea.com", JSON.stringify(quiet.sites));
    check((await researchSites(QUIET[0])) === "zt-dv-quiet.fandom.com, tvline.com, parade.com, realitytea.com", "research reads it", await researchSites(QUIET[0]));
    r = await act(ids.quiet, { sites: { add: "realitytea.com" } });
    check(r.status === 409 && /on the list already/.test(r.body.error), "the same site again: refused");
    r = await act(ids.quiet, { sites: { add: "not a site" } });
    check(r.status === 400, "not a site: refused");
    r = await act(ids.quiet, { sites: { remove: "tvline.com" } });
    const offId = r.body.changeId;
    check(r.status === 200 && r.body.sites.list.map((x) => x.host).join() === "zt-dv-quiet.fandom.com,parade.com,realitytea.com", "tvline.com taken off", JSON.stringify(r.body.sites));
    r = await act(ids.quiet, { sites: { usual: true } });
    check(r.status === 200 && !r.body.sites.own && (await showRow(ids.quiet)).research_domains === null, "back to our usual (null)");
    check((await researchSites(QUIET[0])) === "zt-dv-quiet.fandom.com, tvline.com, parade.com", "research reads our usual again");
    r = await undo(offId);
    check(r.status === 409, "an older change's Undo once its sites moved on: refused", JSON.stringify(r.body));
    r = await undo(r.body?.changeId ?? (await get(ids.quiet)).history.find((h) => h.undoable && /our usual/.test(h.text)).id);
    check(r.status === 200 && (await showRow(ids.quiet)).research_domains?.join() === "zt-dv-quiet.fandom.com,parade.com,realitytea.com", "Undo of back to our usual: its own list again", JSON.stringify((await showRow(ids.quiet)).research_domains));
    for (const h of ["zt-dv-quiet.fandom.com", "parade.com"]) await act(ids.quiet, { sites: { remove: h } });
    r = await act(ids.quiet, { sites: { remove: "realitytea.com" } });
    check(r.status === 200 && (await showRow(ids.quiet)).research_domains === null && /research reads our usual sites/.test(r.body.text), "the last one off: our usual", r.body.text);

    // ---- 7. archive and restore ----
    const catalog = async () => JSON.stringify((await as.kim.call("GET", "/api/catalog")).body);
    r = await act(ids.gone, { restore: true });
    check(r.status === 200 && !(await showRow(ids.gone)).archived && r.body.text === "ZT DV Gone is back in everyone's search", "Restore: back in search", JSON.stringify(r.body.text));
    r = await undo(r.body.changeId);
    check(r.status === 200 && (await showRow(ids.gone)).archived, "Undo: archived again");
    r = await act(ids.gossip, { archive: true });
    check(r.status === 200 && (await showRow(ids.gossip)).archived && !(await catalog()).includes(GOSSIP[1]) && r.body.text === "Archived ZT DV Gossip · out of everyone's search", "Archive: out of everyone's search", r.body.text);
    inbox = (await as.desk.call("GET", "/api/desk/inbox")).body.items;
    check(!inbox.some((i) => i.kind === "show" && /ZT DV Gossip/.test(i.title)), "and out of the Inbox (looked at)");
    r = await act(ids.gossip, { archive: true });
    check(r.status === 409, "archived twice: refused");
    const again = await as.kim.call("POST", "/api/me/shows", { name: GOSSIP[1] });
    const againShow = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [again.body.seasonId])).rows[0]?.show_id;
    check(again.status === 200 && again.body.made === true && againShow && againShow !== ids.gossip, "added by name while it's archived: a new show (as its page says)", JSON.stringify(again.body).slice(0, 120));
    r = await undo((await get(ids.gossip)).history.find((h) => h.undoable && /^Archived/.test(h.text)).id);
    check(r.status === 200 && !(await showRow(ids.gossip)).archived && (await catalog()).includes(GOSSIP[1]) && !(await showRow(ids.gossip)).reviewed_at, "Undo: back, and not looked at");
    const findGone = (await as.desk.call("GET", `/api/desk/find?q=${encodeURIComponent(GONE[1])}`)).body.shows;
    check(findGone?.shows.some((x) => x.id === ids.gone && x.archived), "Find finds an archived show too, tagged", JSON.stringify(findGone));
    // Looks fine, then Archive, then Looks fine's Undo: it stays archived (only the look is taken back).
    r = await act(ids.gossip, { action: "reviewed" });
    const fineId = r.body.history.find((h) => h.undoable && h.text === "Looks fine").id;
    r = await act(ids.gossip, { archive: true });
    const archId = r.body.changeId;
    r = await undo(fineId);
    sr = await showRow(ids.gossip);
    check(r.status === 200 && sr.archived && !sr.reviewed_at, "Looks fine's Undo after an Archive: still archived, not looked at", JSON.stringify([sr.archived, sr.reviewed_at]));
    await undo(archId);
    await pool.query("UPDATE shows SET reviewed_at = NULL, reviewed_by = NULL WHERE id = $1", [ids.gossip]);

    // ---- 8. delete ----
    r = await as.desk.call("DELETE", `/api/desk/shows/${ids.isle}`);
    check(r.status === 409 && /3 games are on ZT DV Isle/.test(r.body.error), "Delete ZT DV Isle: refused while it has games", JSON.stringify(r.body));

    // ---- 9. screens ----
    const dsk = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
    closers.push(dsk.close);
    const failed = [];
    dsk.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await dsk.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const pg = dsk.page;
    let n = 0;
    const shot = async (name, full = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage: full });
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
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const backSays = async () => (await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) || "";
    const hold = async () => {
      await pg.waitForTimeout(600);
      const box = await pg.locator("[role=dialog][data-open] [data-hold]").last().boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await pg.waitForTimeout(1800);
      await pg.mouse.up();
    };
    const lastSection = () =>
      pg.evaluate(() => {
        const sections = [...document.querySelectorAll("section")];
        return sections[sections.length - 1]?.getAttribute("data-delete-row");
      });
    const showListRow = (id) => pg.locator(`[data-show-id='${id}']`);
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    // Browse › Shows
    await pg.goto(`${BASE}/desk/find`);
    await pg.waitForFunction(() => /airing/.test(document.querySelector("[data-desk-row='browse-shows']")?.textContent || ""), null, { timeout: 20000 });
    const browseRow = await pg.locator("[data-desk-row='browse-shows']").innerText();
    check(/^Shows\s/.test(browseRow) && /\d+ shows · \d+ airing · \d+ added by name/.test(browseRow), "Browse: a Shows row with how many, airing, added by name", browseRow);
    check(!(await pg.getByText("Airing now").count()), "Browse has no Airing now (Shows › Airing has it)");
    await pg.locator("[data-desk-row='browse-shows']").click();
    await pg.locator("[data-desk-shows]").waitFor({ timeout: 20000 });
    check((await backSays()) === "Find" && (await pg.locator("[data-shows-filter='all'][aria-pressed=true]").count()) === 1, "Shows opens on All; Back says Find");
    await pg.locator("[data-shows-search]").fill("ZT DV");
    await showListRow(ids.isle).waitFor({ timeout: 15000 });
    await pg.waitForFunction(() => window.location.search === "?q=ZT+DV", null, { timeout: 5000 }).catch(() => {});
    check(pg.url().endsWith("/desk/shows?q=ZT+DV"), "the search is in the address", pg.url());
    const isleRow = await showListRow(ids.isle).innerText();
    check(/A game · Season 2 airing · 2 games/.test(isleRow), "the row: a game, its season airing, its games", isleRow);
    check(/Not a game yet · Season 2 · 1 watching|Not a game yet · Season 1 · 1 watching/.test(await showListRow(ids.quiet).innerText()), "a show that isn't a game: who's watching", await showListRow(ids.quiet).innerText());
    check(/Added by name/i.test(await showListRow(ids.gossip).innerText()), "added by name: tagged");
    check((await pg.locator("[data-shows-more]").count()) === 1 && /Show 5 more\s*· 5 left/.test(await pg.locator("[data-shows-more]").innerText()), "Show 5 more · 5 left (a second ZT DV Gossip now)", await pg.locator("[data-shows-more]").innerText().catch(() => ""));
    await fits("Shows, searched");
    await shot("shows");
    await pg.locator("[data-shows-filter='archived']").click();
    await showListRow(ids.gone).waitFor({ timeout: 15000 });
    check(/Archived \w+ \d+ · out of everyone's search/.test(await showListRow(ids.gone).innerText()) && (await showListRow(ids.gone).locator("[data-show-restore]").count()) === 1, "Shows › Archived: when, with Restore", await showListRow(ids.gone).innerText());
    await shot("shows-archived");
    await showListRow(ids.gone).locator("[data-show-restore]").click();
    check(/ZT DV Gone is back in everyone's search/.test(await toasted(/is back/)), "Restore from its row: the toast");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await toasted(/Undone/);
    check((await showRow(ids.gone)).archived, "the toast's Undo: archived again");

    // a show's page
    await pg.goto(`${BASE}/desk/shows?q=ZT+DV`);
    await showListRow(ids.isle).locator("a").click();
    await pg.locator("[data-desk-show='game']").waitFor({ timeout: 20000 });
    check((await backSays()) === "Shows", "a show from the list: Back says Shows", await backSays());
    const lt = await pg.locator("[data-lower-third]").innerText();
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "A game" && /A competition · 2 seasons here/.test(lt), "its lower third: A game, a competition, 2 seasons here", lt);
    const s2row = await pg.locator("[data-desk-row='season-2']").innerText();
    check(/Season 2/.test(s2row) && /Airing · no schedule yet · 1 game/.test(s2row) && (await pg.locator("[data-desk-row='season-2'] [data-off='need']").count()) === 1, "Season 2: airing with no schedule (dotted), 1 game", s2row);
    check(/Ended · 1 game/.test(await pg.locator("[data-desk-row='season-1']").innerText()), "Season 1: ended, 1 game");
    check(/Our usual: tvline\.com, parade\.com/.test(await pg.locator("[data-desk-row='show-sites']").innerText()) && /Castaways, tribes, episodes/.test(await pg.locator("[data-desk-row='show-words']").innerText()), "About the show: Research sites and Its words");
    check((await lastSection()) === "show" && /Not while it has 3 games · archive it instead/.test(await pg.locator("[data-delete-row='show']").innerText()), "Delete ZT DV Isle is the last thing on the page");
    await fits("a show's page");
    await shot("show", true);

    // Add a season: a number that's here, then Upcoming
    await pg.locator("[data-desk-row='show-add-season']").click();
    await pg.locator("[data-add-season]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-add-season-n]").innerText()) === "3" && /The next one/.test(await pg.locator("[data-add-season-line]").innerText()) && (await pg.locator("[data-add-status='upcoming'][aria-checked=true]").count()) === 1, "Add a season: the next one, Upcoming");
    const what = await pg.locator("[data-add-season-what]").innerText();
    check(/It plays by ZT DV Isle 2's rulebook, as its next season\./.test(what) && /Its cast: ask our bot for it on its Cast page\./.test(what) && !/wiki/i.test(what), "what comes with it: last season's rulebook, the cast from our bot, no wiki", what);
    await pg.locator("[data-add-status='airing']").click();
    check(/needs a schedule/.test(await pg.locator("[data-add-season-what]").innerText()) && /On now/.test(await pg.locator("[data-add-status-line]").innerText()), "Airing: it needs a schedule, its Setup next");
    await pg.locator("[data-add-status='upcoming']").click();
    await pg.locator("[data-add-season] [data-step='-1']").click();
    check(/Season 2 is here already/.test(await pg.locator("[data-add-season-line]").innerText()) && (await pg.locator("[data-add-season-go]").isDisabled()) && /Pick a number that isn't here/.test(await pg.locator("[data-add-season-go]").innerText()), "a number that's here: said inline, the button off");
    await fits("Add a season");
    await shot("add-season-dup");
    await pg.locator("[data-add-season] [data-step='1']").click();
    check(/Add Season 3/.test(await pg.locator("[data-add-season-go]").innerText()), "Add Season 3");
    await shot("add-season");
    await pg.locator("[data-add-season-go]").click();
    await pg.locator("[data-desk-season]").waitFor({ timeout: 20000 });
    check(/Added ZT DV Isle 3 · next: its cast/.test(await toasted(/Added/)), "added: lands on the new season's page, the toast says what's next");
    const made = (await pool.query("SELECT id, status FROM show_seasons WHERE show_id = $1 AND season_number = 3", [ids.isle])).rows[0];
    check(made?.status === "upcoming" && new URL(pg.url()).pathname === `/desk/season/${made.id}`, "Season 3, Upcoming: its page", pg.url());
    await shot("added");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await toasted(/Undone/);
    await pg.locator("[data-desk-show]").waitFor({ timeout: 15000 });
    check(!(await pool.query("SELECT 1 FROM show_seasons WHERE show_id = $1 AND season_number = 3", [ids.isle])).rows.length && new URL(pg.url()).pathname === `/desk/show/${ids.isle}`, "the toast's Undo: it goes again, back on the show's page", pg.url());

    // its words
    await pg.goto(`${BASE}/desk/show/${ids.isle}`);
    await pg.locator("[data-desk-row='show-words']").click();
    await pg.locator("[data-words]").waitFor({ timeout: 10000 });
    check(/3 castaways in 2 tribes · Episode \d+ is tonight/.test(await pg.locator("[data-words-sample]").innerText()) && (await pg.locator("[data-words-save]").isDisabled()), "Its words: the sample line; Save off until something changes", await pg.locator("[data-words-sample]").innerText());
    await pg.locator("[data-field-input='word-person']").fill("islander");
    await pg.locator("[data-field-input='word-people']").fill("islanders");
    check(/3 islanders in 2 tribes/.test(await pg.locator("[data-words-sample]").innerText()), "the sample follows as you type");
    check((await pg.locator("[data-words-rulebook]").innerText()) === "ZT DV Isle 2's rulebook", "a link to its season's rulebook");
    await fits("Its words");
    await shot("words");
    await pg.locator("[data-words-save]").click();
    check(/Saved · islanders in tribes, every Episode · 1 rulebook too/.test(await toasted(/Saved/)), "saved: the toast");
    check((await showRow(ids.isle)).castaway_term === "Islander" && /Islanders, tribes, episodes/.test(await pg.locator("[data-desk-row='show-words']").innerText()), "the row reads the new words");

    // research sites
    await pg.locator("[data-desk-row='show-sites']").click();
    await pg.locator("[data-desk-sites='usual']").waitFor({ timeout: 20000 });
    check((await backSays()) === "ZT DV Isle", "Research sites: Back says the show", await backSays());
    check((await pg.locator("[data-site]").count()) === 2 && (await lastSection()) === "show", "our usual two (no wiki), and the show's Delete last");
    await fits("Research sites");
    await shot("sites", true);
    await pg.locator("[data-desk-row='site-add']").click();
    await pg.locator("[data-field-input='site']").fill("https://www.insidesurvivor.com/some/page?x=1");
    check(/Kept as insidesurvivor\.com\./.test(await sheet().innerText()) && /Add insidesurvivor\.com/.test(await pg.locator("[data-site-go]").innerText()), "a pasted page: kept as its address");
    await shot("site-add");
    await pg.locator("[data-site-go]").click();
    check(/Added insidesurvivor\.com/.test(await toasted(/Added/)), "added: the toast");
    await pg.locator("[data-desk-sites='own']").waitFor({ timeout: 15000 });
    check(/Added for ZT DV Isle/.test(await pg.locator("[data-site='insidesurvivor.com']").innerText()), "its row: added for the show");
    await pg.locator("[data-site-off='tvline.com']").click();
    check(/tvline\.com is off its research sites/.test(await toasted(/is off/)), "a site off: the toast");
    await pg.locator("[data-site='tvline.com']").waitFor({ state: "detached", timeout: 15000 });
    await shot("sites-own");
    await pg.locator("[data-sites-usual]").click();
    await pg.locator("[data-desk-sites='usual']").waitFor({ timeout: 15000 });
    check((await showRow(ids.isle)).research_domains === null, "Back to our usual");

    // the Delete refused: archive it instead, then Restore
    await pg.goto(`${BASE}/desk/show/${ids.isle}`);
    await pg.locator("[data-delete-row='show'] button").click();
    await pg.locator("[data-says='show-blocked']").waitFor({ timeout: 10000 });
    const blockers = await pg.locator("[data-show-blockers]").innerText();
    check(/ZT DV Isle 2/.test(blockers) && /2 games: 1 playing, 1 deleted/.test(blockers) && /ZT DV Old Lineup/.test(blockers) && /ended/i.test(blockers), "can't go yet: its games by season, a deleted one too", blockers);
    await fits("the Delete, refused");
    await shot("delete-refused");
    await pg.locator("[data-show-archive-instead]").click();
    check(/Archived ZT DV Isle · out of everyone's search/.test(await toasted(/Archived/)), "Archive it instead: the toast");
    await pg.locator("[data-show-archived]").waitFor({ timeout: 15000 });
    const panel = await pg.locator("[data-show-archived]").innerText();
    check(/Anyone following it keeps it, and its 1 game plays on/.test(panel) && /adding “ZT DV Isle” by name makes a new show/.test(panel) && (await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Archived", "the archived page: Archived, who keeps it, adding it by name", panel);
    await shot("archived", true);
    await pg.locator("[data-show-restore-page]").click();
    check(/ZT DV Isle is back in everyone's search/.test(await toasted(/is back/)), "Restore: the toast");
    await pg.locator("[data-show-archived]").waitFor({ state: "detached", timeout: 15000 });

    // a show with nothing in the way: the hold
    await pg.goto(`${BASE}/desk/show/${ids.quiet}`);
    await pg.locator("[data-desk-show='watching']").waitFor({ timeout: 20000 });
    check(/Season 2 · 1 watching|Season 2 · 2 watching/.test(await pg.locator("[data-lower-third]").innerText()), "not a game: its newest season and who's watching", await pg.locator("[data-lower-third]").innerText());
    await pg.locator("[data-delete-row='show'] button").click();
    await pg.locator("[data-show-delete]").waitFor({ timeout: 10000 });
    const says = await pg.locator("[data-show-delete]").innerText();
    check(/Its 2 seasons go, with every episode, cast and result\./.test(says) && /1 practice game on it goes too\./.test(says) && /1 person following it loses it from their shows and the guide/.test(says) && /Couches' chat about it goes too\./.test(says), "the hold says what goes", says);
    check(/Hold to delete ZT DV Quiet/i.test(await sheet().innerText()) && /Archive it instead/.test(await sheet().innerText()), "Hold to delete, and Archive it instead");
    await fits("the show's Delete");
    await shot("delete-hold");
    await hold();
    check(/Deleted ZT DV Quiet/.test(await toasted(/Deleted/)), "held: Deleted ZT DV Quiet");
    await pg.locator("[data-desk-shows]").waitFor({ timeout: 15000 });
    check(!(await showRow(ids.quiet)) && !(await pool.query("SELECT 1 FROM show_follows WHERE user_id = $1", [ids.fan])).rows.length && !(await pool.query("SELECT 1 FROM leagues WHERE id = $1", [ids.practice])).rows.length, "gone: its seasons, follows and practice game");
    check((await pool.query("SELECT text FROM admin_changes WHERE entity = 'show' AND entity_id = $1 AND action = 'delete'", [ids.quiet])).rows[0]?.text === "Deleted ZT DV Quiet, with 2 seasons and 1 practice game", "a line stays in History");

    // New show's Here already: the shows that are here, from Shows' own read
    await pg.goto(`${BASE}/desk/new`);
    await pg.locator("[data-new-show-q]").fill("ZT DV Isle");
    await pg.locator(`[data-new-show-here='${ids.isle}']`).waitFor({ timeout: 15000 });
    check(/ZT DV Isle\s*A game · Season 2/.test(await pg.locator(`[data-new-show-here='${ids.isle}']`).innerText()), "New show: Here already lists it", await pg.locator(`[data-new-show-here='${ids.isle}']`).innerText());

    // Find's three
    await pg.goto(`${BASE}/desk/find`);
    await pg.locator("[data-find]").fill("ZT DV");
    await pg.locator("[data-find-all-shows]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-desk-item='show']").count()) === 3 && new RegExp(`All ${2 + CROWD + 2} shows matching`).test(await pg.locator("[data-find-all-shows]").innerText()), "Find: three shows and All N", await pg.locator("[data-find-all-shows]").innerText());
    await shot("find");
    await pg.locator("[data-find-all-shows]").click();
    await pg.locator("[data-desk-shows]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-shows-search]").inputValue()) === "ZT DV", "All N: Shows, searched");

    const errs = dsk.errors.filter((e) => !/Failed to load resource/.test(e));
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));

    // ---- 8, last (it takes rows the counts above read): a game deleted long ago doesn't hold a show ----
    await pool.query("UPDATE leagues SET deleted_at = now() - interval '40 days' WHERE id = ANY($1)", [[ids.outlast, ids.old, ids.binned]]);
    r = await as.desk.call("DELETE", `/api/desk/shows/${ids.isle}`);
    check(r.status === 200 && !(await showRow(ids.isle)) && !(await pool.query("SELECT 1 FROM leagues WHERE id = ANY($1)", [[ids.outlast, ids.old, ids.binned, ids.pool]])).rows.length, "its games deleted 40 days ago: it goes, with them and its pool", JSON.stringify(r.body));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    const after = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_SHOWS].map(async (q) => (await pool.query(q)).rows[0].h));
    check(after[0] === before[0], "every real account is as it was");
    check(after[1] === before[1], "every real league is as it was");
    check(after[2] === before[2], "every real show is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
