// Dev-only check for the desk's games (docs/PLAN-desk-parity.md step 6, part 6a), against this lane's dev server, on a
// fixture of its own (zt_dg_ people, the ZT DG Couch with its games on ZT DG Show 2 and one on its ended Season 1, a practice
// game and a public pool on no couch, a crowd for paging, and a game deleted 40 days ago):
//   1. Only site admins: zt_dg_jo (a player) is refused the games routes.
//   2. Find › Games through the API: Playing · Nobody runs it · Ended · Archived · Deleted, their counts, a search by name,
//      couch, season or kind, % taken literally, 25 at a time, the three sorts; a join code from three characters, any case,
//      finding its game whatever the filter (marked as a code hit), and a code no game has; a game deleted more than 30 days
//      ago found nowhere.
//   3. A game's page through the API: its facts (kind, season, couch, players, who runs it, its rulebook), its History, a
//      game nobody runs, a practice game, a public pool (no Archive or Delete: it goes with its season), 404s.
//   4. Archive (tier 1) with its Undo; Delete (restorable 30 days: its seats out, its line in Recent changes, its players
//      told in the bell), found by its code while deleted; Restore and its Undo (deleted again); Delete for good (refused for
//      a game that isn't deleted; a line on its couch). Find's Browse line and search; the couch page's games by season name
//      (Noticed ac).
//   5. Screens at --width: Browse's Games row, Find › Games with a code search (marked), a deleted game by its code with
//      Restore, a code no game has, a game's page (lower third, facts, Part of as links, Join code with Copy, History, Delete
//      last), the Delete's hold with Archive it instead (and its toast's Undo), held to delete, the deleted page and Restore,
//      Delete for good's hold landing on Games, a seat's Open the game and a castaway's refused Remove both opening the game's
//      page. Nothing wider than the screen; no page errors.
//   6. Nothing real moved: every account that isn't zt_ is as it was, and every real league too.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-games.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-games.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_dg_ accounts (their sessions, seats, couch rows and notices), the ZT DG Couch, the zt-dg- games, the ZT DG Show
// and its seasons and cast, and the admin_changes lines on them; --keep leaves the fixture up. Its games' codes all start
// Z9W (no real code may: it refuses to run if one does). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-games runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-games.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dg_${k}`;
const COUCH = "ZT DG Couch";
const SHOW = ["zt-dg-show", "ZT DG Show"];
const PREFIX = "Z9W";
const CROWD = 27;
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows } = await pool.query("SELECT id, couch_id FROM leagues WHERE slug LIKE 'zt-dg-%'");
  const { rows: couch } = await pool.query("SELECT id FROM couches WHERE name = $1", [COUCH]);
  await pool.query(`DELETE FROM admin_changes WHERE (entity = 'game' AND entity_id = ANY($1)) OR (entity = 'couch' AND entity_id = ANY($2)) OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dg\\_%')`, [
    rows.map((r) => r.id),
    couch.map((c) => c.id),
  ]);
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dg\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-dg-%'");
  await pool.query("DELETE FROM couches WHERE name = $1", [COUCH]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW[0]]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dg\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the code checks can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const now = Date.now();
  const add = async (k, o = {}) => {
    const id = `zt-dg-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-dg.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, now() - interval '1 hour')", [id]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["jo", "dana", "eli"]) await add(k);

  // ZT DG Show: Season 1 ended, Season 2 airing, with a cast of one (Ada, on dana's team in Outlast).
  const { rows: sh } = await pool.query("INSERT INTO shows (slug, name, kind, created_by) VALUES ($1, $2, 'competition', $3) RETURNING id", [SHOW[0], SHOW[1], ids.desk]);
  ids.show = sh[0].id;
  ids.s1 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 1, 'completed') RETURNING id", [ids.show])).rows[0].id;
  ids.s2 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 2, 'airing') RETURNING id", [ids.show])).rows[0].id;
  ids.ada = (await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, 'Ada Example', 0) RETURNING id", [ids.s2])).rows[0].id;

  const { rows: c } = await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.jo]);
  ids.couch = c[0].id;
  for (const [i, k] of ["jo", "dana", "eli"].entries()) await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)", [ids.couch, ids[k], i ? "member" : "owner"]);

  let codes = 0;
  const codeOf = () => {
    const n = codes++;
    return `${PREFIX}${AB[Math.floor(n / AB.length) % AB.length]}${AB[n % AB.length]}${AB[crypto.randomInt(AB.length)]}`;
  };
  // A game: its seats (each [user, role]), its kind and season, and how it stands.
  const game = async (key, o) => {
    const s = S.defaultState();
    const seats = o.seats ?? [];
    s.players = seats.map(([k], i) => ({ id: `p${i + 1}`, name: U(k), color: "#5089c9", disabled: false, active: true }));
    s.draftOrder = s.players.map((p) => p.id);
    Object.assign(s.settings, { leagueTypeId: o.type ?? "classic-draft", showId: SHOW[0], wikiSeason: String(o.season ?? 2) });
    if (o.archived) Object.assign(s.settings, { archivedAt: new Date(now - 3 * 864e5).toISOString(), archivedBy: ids.jo });
    if (o.ada) s.castaways = [{ id: "c1", name: "Ada Example", seasonCastId: ids.ada, ownerIds: ["p1"] }];
    let state = S.migrateLeagueState(s);
    // A game over a span (How long: Episode 1 only) whose one episode's results are in: over while its season airs.
    if (o.spanOver) {
      state.settings.endEpisode = 1;
      S.ensureNextEpisode(state);
      state.episodes[0].noExit = true;
    }
    const code = codeOf();
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, solo, created_at, deleted_at, deleted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [o.name, `zt-dg-${key}`, code, state, ids[o.by ?? "jo"], o.solo ? null : ids.couch, o.solo ?? null, new Date(now - (o.age ?? 10) * 864e5), o.deletedDays ? new Date(now - o.deletedDays * 864e5) : null, o.deletedDays ? ids.jo : null]
    );
    ids[key] = rows[0].id;
    ids[`${key}Code`] = code;
    for (const [i, [k, role]] of seats.entries())
      if (!o.deletedDays) await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [ids[key], ids[k], `p${i + 1}`, role]);
  };
  await game("outlast", { name: "ZT DG Outlast", seats: [["jo", "commissioner"], ["dana", "member"], ["eli", "member"]], ada: true, age: 4 });
  await game("pool", { name: "ZT DG Pool", type: "pickem", seats: [["dana", "member"], ["eli", "member"]], age: 5 });
  await game("lineup", { name: "ZT DG Lineup", type: "active-roster", seats: [["jo", "commissioner"], ["dana", "member"]], archived: true, age: 6 });
  await game("old", { name: "ZT DG Old", season: 1, seats: [["jo", "commissioner"], ["eli", "member"]], age: 200 });
  await game("spare", { name: "ZT DG Spare", type: "pickem", seats: [["jo", "commissioner"]], age: 7 });
  await game("practice", { name: "ZT DG Practice", solo: "practice", seats: [["eli", "commissioner"]], by: "eli", age: 8 });
  await game("public", { name: "ZT DG Public", type: "pickem", solo: "public", seats: [["dana", "member"]], age: 9 });
  await game("span", { name: "ZT DG Span", type: "pickem", seats: [["jo", "commissioner"], ["desk", "member"]], spanOver: true, age: 11 });
  await game("ancient", { name: "ZT DG Ancient", type: "pickem", seats: [["jo", "commissioner"]], deletedDays: 40, age: 60 });
  for (let i = 1; i <= CROWD; i++) await game(`crowd${i}`, { name: `ZT DG Crowd ${String(i).padStart(2, "0")}: 100% wrong_answer`, type: "pickem", age: 20 + i });
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || coalesce(deleted_at::text, ''), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dg_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_USERS)).rows[0].h;
  const leaguesBefore = (await pool.query(REAL_LEAGUES)).rows[0].h;
  const closers = [];
  try {
    const ids = await up(pool);
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD }), jo: await api({ user: U("jo"), pass: PASSWORD }) };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const list = async (o) => (await as.desk.call("GET", `/api/desk/games?${new URLSearchParams(o)}`)).body;
    const get = async (id) => (await as.desk.call("GET", `/api/desk/games/${id}`)).body;
    const act = (id, body) => as.desk.call("POST", `/api/desk/games/${id}`, body);
    const names = (l) => l.games.map((g) => g.name);
    const withState = async (id, fn) => {
      const st = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
      fn(st);
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [id, st]);
    };
    const mine = (l) => l.games.filter((g) => /^ZT DG /.test(g.name) && !/Crowd/.test(g.name)).map((g) => g.name);

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", "/api/desk/games"),
      as.jo.call("GET", `/api/desk/games/${ids.outlast}`),
      as.jo.call("POST", `/api/desk/games/${ids.outlast}`, { archive: true }),
      as.jo.call("DELETE", `/api/desk/games/${ids.outlast}`),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the games routes", refused.map((r) => r.status).join(","));

    // ---- 2. Find › Games through the API ----
    const playing = await list({ q: "ZT DG" });
    check(
      JSON.stringify(mine(playing).sort()) === JSON.stringify(["ZT DG Outlast", "ZT DG Pool", "ZT DG Spare", "ZT DG Practice", "ZT DG Public", "ZT DG Span"].sort()),
      "Playing, searched: the couch's live games, the practice game and the public pool (not the archived, ended or long-deleted)",
      JSON.stringify(mine(playing))
    );
    check(playing.counts && ["all", "nobody", "ended", "archived", "deleted"].every((k) => Number.isInteger(playing.counts[k])) && playing.counts.all >= 5 + CROWD, "the chips' counts", JSON.stringify(playing.counts));
    check(playing.code === null, "a search that isn't code-shaped: no code", String(playing.code));
    const pool1 = playing.games.find((g) => g.name === "ZT DG Pool");
    check(pool1?.state === "nobody", "ZT DG Pool: nobody runs it", pool1?.state);
    check(mine(await list({ q: "ZT DG", f: "nobody" })).join() === "ZT DG Pool", "Nobody runs it: ZT DG Pool");
    const arch = await list({ q: "ZT DG", f: "archived" });
    check(mine(arch).join() === "ZT DG Lineup" && arch.games[0].archived?.by === U("jo"), "Archived: ZT DG Lineup, by jo", JSON.stringify(arch.games[0]?.archived));
    check(mine(await list({ q: "ZT DG", f: "ended" })).join() === "ZT DG Old", "Ended: ZT DG Old (its season is over)");
    check(mine(await list({ q: "ZT DG", f: "deleted" })).length === 0, "Deleted: none yet (ZT DG Ancient went 40 days ago)");
    check(mine(await list({ q: COUCH })).length === 4 && !mine(await list({ q: COUCH })).includes("ZT DG Practice"), "by its couch's name", JSON.stringify(mine(await list({ q: COUCH }))));
    check(mine(await list({ q: "ZT DG Show 2" })).length === 6, "by its season's name", JSON.stringify(mine(await list({ q: "ZT DG Show 2" }))));
    check(mine(await list({ q: "weekly lineup", f: "archived" })).join() === "ZT DG Lineup", "by its kind (Weekly Lineup)");
    const crowd1 = await list({ q: "ZT DG Crowd" });
    check(crowd1.total === CROWD && crowd1.games.length === 25, `${CROWD} in the crowd, the first 25`, `${crowd1.total}/${crowd1.games.length}`);
    const crowd2 = await list({ q: "ZT DG Crowd", offset: 25 });
    check(crowd2.games.length === CROWD - 25 && !crowd2.games.some((g) => crowd1.games.some((x) => x.id === g.id)), "the next page: the rest, none twice");
    check(names(crowd1)[0] === "ZT DG Crowd 01: 100% wrong_answer", "Newest first", names(crowd1)[0]);
    check(names(await list({ q: "ZT DG Crowd", sort: "name" }))[0] === "ZT DG Crowd 01: 100% wrong_answer" && names(await list({ q: "ZT DG Crowd", sort: "name", offset: 25 })).at(-1) === `ZT DG Crowd ${CROWD}: 100% wrong_answer`, "Name, A to Z");
    check(names(await list({ q: "ZT DG", sort: "big" }))[0] === "ZT DG Outlast", "Most players: Outlast's three first", names(await list({ q: "ZT DG", sort: "big" }))[0]);
    check((await list({ q: "100%" })).total === CROWD && (await list({ q: "1%0" })).total === 0 && (await list({ q: "wrong_answer" })).total === CROWD, "% and _ taken literally");
    // Join codes: from three characters, any case, whatever the filter.
    const four = ids.outlastCode.slice(0, 4).toLowerCase();
    const byCode = await list({ q: four, f: "archived" });
    check(byCode.code === four.toUpperCase() && byCode.games.some((g) => g.id === ids.outlast && g.codeHit), `four of Outlast's code (${four}), lower case, under Archived: Outlast, marked`, JSON.stringify({ code: byCode.code, g: byCode.games.map((g) => [g.name, g.codeHit]) }));
    const byPrefix = await list({ q: PREFIX.toLowerCase(), f: "ended" });
    check(byPrefix.games.every((g) => g.codeHit) && byPrefix.total === 8 + CROWD, `${PREFIX}: every fixture game but the long-deleted one, whatever the filter`, `${byPrefix.total}`);
    check((await list({ q: ids.outlastCode.slice(0, 2) })).code === null && (await list({ q: "zt dg" })).code === null, "two characters, or two words, aren't a code");
    check((await list({ q: `${ids.outlastCode.slice(0, 3)} ${ids.outlastCode.slice(3)}`.toLowerCase() })).games[0]?.id === ids.outlast, "read out in two threes, lower case: found");
    check((await list({ q: `${ids.outlastCode.slice(0, 3)}-${ids.outlastCode.slice(3)}` })).games[0]?.id === ids.outlast, "a dash in it is fine");
    const none = await list({ q: "QX7P0Z" });
    check(none.total === 0 && none.code === "QX7P0Z", "QX7P0Z: no game, the code said back");
    check((await list({ q: ids.ancientCode, f: "deleted" })).total === 0, "a game deleted 40 days ago: not found by its code");

    // ---- 3. a game's page through the API ----
    const g1 = await get(ids.outlast);
    check(g1.name === "ZT DG Outlast" && g1.game === "Outlast" && g1.season === "ZT DG Show 2" && g1.couch?.id === ids.couch && g1.code === ids.outlastCode && g1.state === "playing", "Outlast: its kind, season, couch, code and state", JSON.stringify({ ...g1, history: undefined }));
    check(g1.players === 3 && g1.runBy.join() === U("jo") && g1.startedBy === U("jo") && g1.others === 5 + CROWD && g1.seasonId === ids.s2 && !g1.off, "its players, who runs it, its couch's other games", JSON.stringify({ p: g1.players, r: g1.runBy, o: g1.others }));
    check(g1.history.at(-1)?.text === `Started by ${U("jo")}`, "History: started by jo", JSON.stringify(g1.history));
    const g2 = await get(ids.pool);
    check(g2.state === "nobody" && g2.runBy.length === 0, "Pool: nobody runs it");
    const gs = await get(ids.span);
    check(gs.state === "ended" && gs.runBy.join() === `${U("jo")},${U("desk")} (site admin)`, "a game over a span: Ended on its page (the app's gameOver); a site admin in a seat runs it too", JSON.stringify({ s: gs.state, r: gs.runBy }));
    const gp = await get(ids.practice);
    check(gp.couch === null && gp.solo === "practice" && gp.others === 0, "a practice game: on no couch");
    const gpub = await get(ids.public);
    check(gpub.solo === "public" && gpub.off === "A season's public pool goes with its season", "a public pool: no Delete here", gpub.off);
    check((await act(ids.public, { delete: true })).status === 409 && (await act(ids.public, { archive: true })).status === 409, "Archive or Delete a public pool: refused");
    check((await as.desk.call("GET", `/api/desk/games/${ids.ancient}`)).status === 404 && (await as.desk.call("GET", "/api/desk/games/not-a-game")).status === 404, "long deleted, or no such game: 404");
    check((await act(ids.outlast, { nothing: true })).status === 400, "an action it doesn't know: 400");

    // ---- 4. Archive, Delete, Restore, Delete for good ----
    const a1 = await act(ids.outlast, { archive: true });
    check(a1.status === 200 && a1.body.text === "ZT DG Outlast archived" && !!a1.body.changeId, "Archive", JSON.stringify(a1.body));
    check((await get(ids.outlast)).state === "archived" && (await act(ids.outlast, { archive: true })).status === 409, "archived; again: refused");
    const archLine = (await pool.query("SELECT batch, undone_at FROM league_changes WHERE league_id = $1 AND kind = 'game.archive'", [ids.outlast])).rows;
    check(archLine.length === 1 && !archLine[0].undone_at, "a line in its Recent changes");
    const h1 = (await get(ids.outlast)).history;
    check(h1.filter((h) => /Archived/.test(h.text)).length === 1 && h1[0].undoable, "History: Archived once, with Undo", JSON.stringify(h1.map((h) => h.text)));
    // Its Commissioner undoes it from Recent changes: the desk's line shows undone, with no Undo.
    const back1 = await as.jo.call("POST", `/api/seasons/${ids.s2}/changes/${archLine[0].batch}/undo?couch=${ids.couch}`, {});
    const h1b = (await get(ids.outlast)).history.find((h) => h.id === a1.body.changeId);
    check(back1.status === 200 && h1b?.undone && !h1b.undoable && (await get(ids.outlast)).state === "playing", "undone from Recent changes: the desk's Archived line shows undone", `${back1.status} ${JSON.stringify(back1.body)} ${JSON.stringify(h1b)}`);
    check((await undo(a1.body.changeId)).status === 409, "and its desk Undo is refused");
    await pool.query("UPDATE league_changes SET undone_at = NULL, undone_by = NULL WHERE batch = $1", [archLine[0].batch]);
    await withState(ids.outlast, (st) => Object.assign(st.settings, { archivedAt: new Date().toISOString(), archivedBy: ids.desk }));
    const ua1 = await undo(a1.body.changeId);
    check(ua1.status === 200 && (await get(ids.outlast)).state === "playing", "Undo: playing again", JSON.stringify(ua1.body));
    check((await pool.query("SELECT undone_at FROM league_changes WHERE league_id = $1 AND kind = 'game.archive'", [ids.outlast])).rows[0].undone_at !== null, "its Recent changes line undone too");
    check((await undo(a1.body.changeId)).status === 409, "Undo again: refused");

    const d1 = await act(ids.outlast, { delete: true });
    check(d1.status === 200 && d1.body.text === "Deleted ZT DG Outlast · restore it from here for 30 days", "Delete", JSON.stringify(d1.body));
    const gd = await get(ids.outlast);
    check(gd.state === "deleted" && gd.restorable && gd.deleted?.by === U("desk") && Date.parse(gd.deleted.until) - Date.parse(gd.deleted.at) === 30 * 864e5, "deleted, restorable, until 30 days on", JSON.stringify(gd.deleted));
    check(gd.runBy.join() === U("jo"), "who ran it, from its delete line");
    check((await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1", [ids.outlast])).rows.length === 0, "its seats are out of it");
    check(gd.history.filter((h) => /deleted|Deleted/.test(h.text)).length === 1 && gd.history[0].text === "Deleted: restorable for 30 days", "History: Deleted once", JSON.stringify(gd.history.map((h) => h.text)));
    check((await act(ids.outlast, { delete: true })).status === 409 && (await act(ids.outlast, { archive: true })).status === 409, "Delete or Archive a deleted game: refused");
    const byCodeDel = await list({ q: ids.outlastCode });
    check(byCodeDel.games.length === 1 && byCodeDel.games[0].state === "deleted" && byCodeDel.games[0].codeHit, "its whole code finds it under Playing, deleted");
    check(mine(await list({ q: "ZT DG", f: "deleted" })).join() === "ZT DG Outlast", "Deleted: Outlast");
    await new Promise((r) => setTimeout(r, 1500));
    const told = (await pool.query("SELECT user_id, title FROM notifications WHERE key LIKE 'game-deleted:%' AND user_id = ANY($1)", [[ids.jo, ids.dana, ids.eli, ids.desk]])).rows;
    check(told.length === 3 && told.every((t) => t.title === "ZT DG Outlast was deleted") && !told.some((t) => t.user_id === ids.desk), "its three players are told (in the bell)", JSON.stringify(told));

    const r1 = await act(ids.outlast, { restore: true });
    check(r1.status === 200 && r1.body.text === `ZT DG Outlast is back on ${COUCH}, with everyone's picks and scores` && !!r1.body.changeId, "Restore", JSON.stringify(r1.body));
    check((await get(ids.outlast)).state === "playing" && (await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1", [ids.outlast])).rows.length === 3, "playing again, its three seats back");
    check((await pool.query("SELECT undone_by FROM league_changes WHERE league_id = $1 AND kind = 'game.delete'", [ids.outlast])).rows[0].undone_by === ids.desk, "its delete line is undone");
    check((await act(ids.outlast, { restore: true })).status === 409, "Restore again: refused");
    check((await undo(r1.body.changeId)).status === 200 && (await get(ids.outlast)).state === "deleted", "Restore's Undo: deleted again");
    check((await undo(r1.body.changeId)).status === 409, "that Undo again: refused");
    const r3 = await act(ids.outlast, { restore: true });
    check(r3.status === 200 && (await get(ids.outlast)).state === "playing", "and restored again");
    const a2 = await act(ids.outlast, { archive: true });
    check((await undo(r3.body.changeId)).status === 409 && (await get(ids.outlast)).state === "archived", "an older Restore's Undo, with an Archive since: refused");
    const hu = (await get(ids.outlast)).history.filter((h) => h.undoable);
    check(hu.length === 1 && hu[0].id === a2.body.changeId, "History: only the newest line has Undo", JSON.stringify(hu.map((h) => h.text)));
    check((await undo(a2.body.changeId)).status === 200 && (await get(ids.outlast)).state === "playing", "the Archive's Undo: playing");

    check((await as.desk.call("DELETE", `/api/desk/games/${ids.spare}`)).status === 409, "Delete for good a game that isn't deleted: refused");
    check((await act(ids.spare, { delete: true })).status === 200, "Spare deleted");
    const gone = await as.desk.call("DELETE", `/api/desk/games/${ids.spare}`);
    check(gone.status === 200 && gone.body.text === `ZT DG Spare on ${COUCH} is gone for good`, "and deleted for good", JSON.stringify(gone.body));
    check(!(await pool.query("SELECT 1 FROM leagues WHERE id = $1", [ids.spare])).rows.length && (await as.desk.call("GET", `/api/desk/games/${ids.spare}`)).status === 404, "gone: no row, 404");
    check((await pool.query("SELECT text FROM admin_changes WHERE entity = 'couch' AND entity_id = $1 AND action = 'game-gone'", [ids.couch])).rows[0]?.text === "Deleted ZT DG Spare for good (Survival Pool on ZT DG Show 2)", "a line on its couch");
    check((await pool.query("SELECT text FROM admin_changes WHERE entity = 'game' AND entity_id = $1 AND action = 'gone'", [ids.spare])).rows[0]?.text === "Deleted for good (Survival Pool on ZT DG Show 2)", "and a record on the game itself");
    check((await pool.query("SELECT 1 FROM couches WHERE id = $1", [ids.couch])).rows.length === 1, "its couch stays (classic's delete took an emptied couch)");

    // Find, Browse and the couch page
    const browse = (await as.desk.call("GET", "/api/desk/find?q=")).body.browse;
    check(Number.isInteger(browse?.games?.playing) && Number.isInteger(browse.games.deleted), "Browse: games playing and deleted", JSON.stringify(browse?.games));
    const found = (await as.desk.call("GET", `/api/desk/find?q=${encodeURIComponent("ZT DG")}`)).body.games;
    check(found?.games.length === 3 && found.total >= 4 + CROWD, "Find: three games and how many match", JSON.stringify({ n: found?.games.length, t: found?.total }));
    const foundCode = (await as.desk.call("GET", `/api/desk/find?q=${ids.outlastCode.slice(0, 4)}`)).body.games;
    check(foundCode?.games[0]?.id === ids.outlast && foundCode.code === ids.outlastCode.slice(0, 4), "Find: a code finds its game");
    const couchPage = (await as.desk.call("GET", `/api/desk/couches/${ids.couch}`)).body;
    check(couchPage.games.find((g) => g.leagueId === ids.outlast)?.season === "ZT DG Show 2", "the couch page names the season (Noticed ac)", JSON.stringify(couchPage.games.map((g) => g.season)));

    // ---- 5. screens ----
    const d = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
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
    await d.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const pg = d.page;
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
    const back = async () => (await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) || "";
    const hold = async () => {
      await pg.waitForTimeout(600);
      const box = await pg.locator("[role=dialog][data-open] [data-hold]").last().boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await pg.waitForTimeout(1800);
      await pg.mouse.up();
    };
    const gameRow = (id) => pg.locator(`[data-game-id='${id}']`);
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    // Browse › Games
    await pg.goto(`${BASE}/desk/find`);
    await pg.waitForFunction(() => /playing/.test(document.querySelector("[data-desk-row='browse-games']")?.textContent || ""), null, { timeout: 20000 });
    check(/^Games\s/.test(await pg.locator("[data-desk-row='browse-games']").innerText()) && /\d+ playing/.test(await pg.locator("[data-desk-row='browse-games']").innerText()), "Browse: a Games row with how many play", await pg.locator("[data-desk-row='browse-games']").innerText());
    await pg.locator("[data-desk-row='browse-games']").click();
    await pg.locator("[data-desk-games]").waitFor({ timeout: 20000 });
    check((await back()) === "Find" && (await pg.locator("[data-games-filter='all'][aria-pressed=true]").count()) === 1, "Games opens on Playing; Back says Find");
    // a code, four characters, lower case
    await pg.locator("[data-games-search]").fill(four);
    await gameRow(ids.outlast).locator("[data-code-hit]").waitFor({ timeout: 15000 });
    await pg.waitForFunction((q) => window.location.search === `?q=${q}`, four, { timeout: 5000 }).catch(() => {});
    const row = await gameRow(ids.outlast).innerText();
    check(new RegExp(`^Join code ${ids.outlastCode}`).test(row.split("\n").slice(1).join(" ")) && (await gameRow(ids.outlast).locator("[data-code-hit]").innerText()) === four.toUpperCase(), "the row leads with Join code, what matched marked", row);
    check(pg.url().endsWith(`/desk/games?q=${four}`), "the search is in the address", pg.url());
    await fits("Games, by a code");
    await shot("games-by-code");
    // a deleted game, by its code, whatever the filter: Restore on its row
    await act(ids.outlast, { delete: true });
    await pg.locator("[data-games-filter='archived']").click().catch(() => {});
    await pg.locator("[data-games-search]").fill(ids.outlastCode);
    await gameRow(ids.outlast).locator("[data-game-restore]").waitFor({ timeout: 15000 });
    check(/deleted/i.test(await gameRow(ids.outlast).innerText()) && /deleted by zt_dg_desk/.test(await gameRow(ids.outlast).innerText()), "deleted, by its code: Deleted, who and until when, with Restore", await gameRow(ids.outlast).innerText());
    await fits("a deleted game by its code");
    await shot("games-deleted-by-code");
    await gameRow(ids.outlast).locator("[data-game-restore]").click();
    check(new RegExp(`ZT DG Outlast is back on ${COUCH}`).test(await toasted(/is back/)), "Restore from the row: the toast says so");
    await pg.waitForFunction((id) => document.querySelector(`[data-game-id='${id}']`)?.getAttribute("data-game-state") === "playing", ids.outlast, { timeout: 15000 });
    check((await get(ids.outlast)).state === "playing", "and it's back");
    // no game has the code
    await pg.locator("[data-games-search]").fill("QX7P0Z");
    await pg.locator("[data-games-empty]").waitFor({ timeout: 15000 });
    const empty = await pg.locator("[data-games-empty]").innerText();
    check(/No game has the code QX7P0Z/i.test(empty) && /never have a 0, O, 1 or I/.test(empty) && /30 days/.test(empty), "a code no game has: why, and that a deleted one's code finds it", empty);
    await shot("games-no-code");
    await pg.locator("[data-games-search]").fill("QX7P");
    await pg.waitForFunction(() => /No code starts that way/.test(document.querySelector("[data-games-empty]")?.textContent || ""), null, { timeout: 15000 });
    check(true, "a start no code has: says so");
    await pg.locator("[data-games-search]").fill("pool");
    await pg.waitForFunction(() => /Nothing matches/.test(document.querySelector("[data-games-empty]")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/Nothing matches .pool./i.test(await pg.locator("[data-games-empty]").innerText().catch(() => "")), "a word with no match isn't called a code", await pg.locator("[data-games-empty]").innerText().catch(() => ""));

    // a game's page
    await pg.locator("[data-games-filter='all']").click();
    await pg.locator("[data-games-search]").fill("ZT DG Outlast");
    await gameRow(ids.outlast).waitFor({ timeout: 15000 });
    await gameRow(ids.outlast).locator("a").click();
    await pg.locator("[data-desk-game='playing']").waitFor({ timeout: 20000 });
    check((await back()) === "Games", "a game from the list: Back says Games", await back());
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Playing" && /^ZT DG Outlast$/i.test(await pg.locator("[data-lower-third-name]").innerText()), "its lower third: Playing, its name");
    const facts = await pg.locator("[data-game-facts]").innerText();
    check(new RegExp(`^Outlast · Started \\w+ \\d+ · 3 players · run by ${U("jo")}$`).test(facts), "its facts: kind, started, players, who runs it", facts);
    check(
      (await pg.locator(`[data-desk-row='part-couch'][href='/desk/couch/${ids.couch}']`).count()) === 1 && (await pg.locator(`[data-desk-row='part-season'][href='/desk/season/${ids.s2}']`).count()) === 1,
      "Part of: its couch and its season, as links"
    );
    check((await pg.locator("[data-game-code] b").innerText()) === ids.outlastCode && /Anyone with it can join ZT DG Couch, then ZT DG Outlast/.test(await pg.locator("[data-game-code-note]").innerText()), "Join code: the code big, who it lets in");
    await pg.locator("[data-game-copy]").click();
    check(new RegExp(`Copied ${ids.outlastCode}`).test(await toasted(/Copied/)), "Copy: the toast says so");
    const last = await pg.evaluate(() => {
      const sections = [...document.querySelectorAll("section")];
      return sections[sections.length - 1]?.getAttribute("data-delete-row");
    });
    check(last === "game" && /Delete ZT DG Outlast/.test(await pg.locator("[data-delete-row='game']").innerText()) && /restorable for 30 days/.test(await pg.locator("[data-delete-row='game']").innerText()), "Delete ZT DG Outlast is the last thing on the page");
    await fits("a game's page");
    await shot("game", true);
    // Delete: the hold, Archive it instead (and its Undo)
    await pg.locator("[data-delete-row='game'] button").click();
    await pg.locator("[data-game-delete]").waitFor({ timeout: 10000 });
    const says = await pg.locator("[data-game-delete]").innerText();
    check(/3 players lose their teams, picks and scores in it, and are told/.test(says) && /ZT DG Couch's other games are untouched/.test(says), "the Delete says what it does", says);
    check((await pg.getByRole("button", { name: "Archive it instead" }).count()) === 1 && /Restorable for 30 days from Games › Deleted/.test(await pg.locator("[role=dialog][data-open]").last().innerText()), "Archive it instead, and how it comes back");
    await fits("the game's Delete");
    await shot("game-delete");
    await pg.getByRole("button", { name: "Archive it instead" }).click();
    check(/ZT DG Outlast archived/.test(await toasted(/archived/)), "Archive it instead: a toast");
    await pg.locator("[data-desk-game='archived']").waitFor({ timeout: 15000 });
    check(/Archived \w+ \d+ by zt_dg_desk · on the trophy shelf/.test(await pg.locator("[data-game-facts]").innerText()) && /The game's over/.test(await pg.locator("[data-game-code-note]").innerText()), "archived: said in its facts, its code lets nobody in");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.locator("[data-desk-game='playing']").waitFor({ timeout: 15000 });
    check((await get(ids.outlast)).state === "playing", "the toast's Undo: playing again");
    // held to delete: the page shows it deleted, with Restore
    await pg.locator("[data-delete-row='game'] button").click();
    await pg.locator("[data-game-delete]").waitFor({ timeout: 10000 });
    await hold();
    check(/Deleted ZT DG Outlast · restore it from here for 30 days/.test(await toasted(/Deleted/)), "held: a toast says it's deleted, and how to restore it");
    await pg.locator("[data-desk-game='deleted']").waitFor({ timeout: 15000 });
    check(/^Deleted by zt_dg_desk \w+ \d+ · until \w+ \d+\. Restore it and everyone's teams/.test(await pg.locator("[data-game-deleted] small").innerText()), "Deleted: by whom, until when, Restore", await pg.locator("[data-game-deleted] small").innerText());
    check((await pg.locator("[data-game-code]").count()) === 0 && /Delete ZT DG Outlast for good, now/.test(await pg.locator("[data-delete-row='game-gone']").innerText()) && /it goes on its own/.test(await pg.locator("[data-delete-row='game-gone']").innerText()), "no code to read out; Delete for good, now, last");
    await fits("a deleted game");
    await shot("game-deleted", true);
    await pg.locator("[data-game-deleted] [data-game-restore]").click();
    check(/is back on ZT DG Couch/.test(await toasted(/is back/)), "Restore: a toast");
    await pg.locator("[data-desk-game='playing']").waitFor({ timeout: 15000 });
    check(true, "Restore: playing again");

    // Delete for good, now: from the deleted page, landing on Games
    await act(ids.pool, { delete: true });
    await pg.goto(`${BASE}/desk/games?f=deleted`);
    await gameRow(ids.pool).waitFor({ timeout: 20000 });
    await gameRow(ids.pool).locator("a").click();
    await pg.locator("[data-desk-game='deleted']").waitFor({ timeout: 20000 });
    await pg.locator("[data-delete-row='game-gone'] button").click();
    await pg.locator("[data-game-gone]").waitFor({ timeout: 10000 });
    check(/It's gone now instead of \w+ \d+, and can't come back/.test(await pg.locator("[data-game-gone]").innerText()) && /Its join code stops finding it/.test(await pg.locator("[data-game-gone]").innerText()), "for good: what it does");
    await shot("game-for-good");
    await hold();
    check(/ZT DG Pool on ZT DG Couch is gone for good/.test(await toasted(/gone for good/)), "held: gone for good");
    await pg.locator("[data-desk-games]").waitFor({ timeout: 15000 });
    check(!(await pool.query("SELECT 1 FROM leagues WHERE id = $1", [ids.pool])).rows.length && (await gameRow(ids.pool).count()) === 0, "back on Games, without it");

    // Open the game from a seat, and from a castaway's refused Remove
    await pg.goto(`${BASE}/desk/person/${ids.jo}`);
    await pg.locator("[data-person-game='ZT DG Outlast']").click();
    await pg.locator("[data-seat-sheet]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-seat-row='open']").getAttribute("href")) === `/desk/game/${ids.outlast}`, "a seat's Open the game: the game's page");
    await pg.locator("[data-seat-row='open']").click();
    await pg.locator("[data-desk-game]").waitFor({ timeout: 15000 });
    check((await back()) === U("jo"), "Back says jo", await back());
    await pg.goto(`${BASE}/desk/season/${ids.s2}/c/${ids.ada}`);
    await pg.locator("[data-delete-row='castaway'] button").click();
    await pg.locator("[data-remove-refused]").waitFor({ timeout: 10000 });
    const theirs = pg.locator(`[data-desk-row='their-game-${ids.outlast}']`);
    check((await theirs.getAttribute("href")) === `/desk/game/${ids.outlast}`, "a castaway's refused Remove: their game is a link to its page");
    await theirs.click();
    await pg.locator("[data-desk-game]").waitFor({ timeout: 15000 });
    check((await pg.locator("[role=dialog][data-open]").count()) === 0, "and the sheet's gone with the page");

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    check((await pool.query(REAL_USERS)).rows[0].h === realBefore, "every real account is as it was");
    check((await pool.query(REAL_LEAGUES)).rows[0].h === leaguesBefore, "every real league is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
