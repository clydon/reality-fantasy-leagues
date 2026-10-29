// Dev-only check for the desk's couches (docs/PLAN-desk-parity.md step 6, part 6d), against this lane's dev server, on a
// fixture of its own (zt_dh_ people; the ZT DH Den with three games and one deleted before it, an invite code and a game's
// join code; the ZT DH Booth, kim's other couch; a test couch; a crowd for paging; and a couch deleted 40 days ago):
//   1. Only site admins: zt_dh_oz (a player) is refused the couches routes.
//   2. Find › Couches through the API: All · Nobody runs it · New this month · Deleted, their counts, a search by name or by
//      who runs it, 25 at a time, the three sorts; a row's people, games, who runs them and the games nobody runs; a couch
//      deleted more than 30 days ago found nowhere.
//   3. A couch's page through the API: started, its people, its games, who runs them, History; a test couch has no Delete.
//   4. Delete (tier 3): its games deleted too (each with its line, the one deleted before it left as it was), its people off
//      it, told once each (not once a game), restorable for 30 days; every couch read leaving it out (their home, the couch's
//      own read, a site admin's too, its invite code and its games' join codes, the desk's Inbox and Find, a person's page);
//      a game it took restorable only with it; the couch deleted 40 days ago gone for good. Restore: its people and the games
//      it took back as they were, with Undo (deleted again, nobody told twice; refused once something's changed since);
//      someone whose account went meanwhile doesn't come back.
//   5. Screens at --width: Browse's Couches row, Find › Couches searched (the address keeps it), a couch's page (lower third,
//      facts, Delete last), the Delete's hold, held landing on Couches › Deleted, the deleted page with Restore, a game it took,
//      Restore and the toast's Undo, Restore from the list's row, Find's three couches and All N, a test couch's Delete.
//      Nothing wider than the screen; no page errors.
//   6. Nothing real moved: every account, league and couch that isn't zt_ is as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                   (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-couches.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-couches.js --down         (takes the fixture down, nothing else)
//
// up/down: zt_dh_ accounts (their sessions, seats, couch rows and notices), the ZT DH couches and their invites, the zt-dh-
// games, the ZT DH Show and its season, the test couch, and the admin_changes lines on them; --keep leaves the fixture up. Its
// codes all start Z6H (no real one may: it refuses to run if one does). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-couches runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-couches.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dh_${k}`;
const DEN = "ZT DH Den";
const BOOTH = "ZT DH Booth";
const SHOW = ["zt-dh-show", "ZT DH Show"];
const PREFIX = "Z6H";
const INVITE = "Z6HJNV";
const CROWD = 27;
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-dh-%'");
  const { rows: couches } = await pool.query("SELECT id FROM couches WHERE name LIKE 'ZT DH %'");
  await pool.query(
    `DELETE FROM admin_changes WHERE (entity = 'game' AND entity_id = ANY($1)) OR (entity = 'couch' AND entity_id = ANY($2)) OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dh\\_%')`,
    [rows.map((r) => r.id), couches.map((c) => c.id)]
  );
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dh\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-dh-%'");
  await pool.query("DELETE FROM couches WHERE name LIKE 'ZT DH %'");
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW[0]]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dh\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1 UNION ALL SELECT 1 FROM couch_invites WHERE code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league or invite outside the fixture has a code starting ${PREFIX}: the code checks can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const now = Date.now();
  const days = (n) => new Date(now - n * 864e5);
  const add = async (k, o = {}) => {
    const id = `zt-dh-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-dh.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, now() - interval '1 hour')", [id]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["kim", "lee", "max", "ned", "oz"]) await add(k);

  const { rows: sh } = await pool.query("INSERT INTO shows (slug, name, kind, created_by) VALUES ($1, $2, 'competition', $3) RETURNING id", [SHOW[0], SHOW[1], ids.desk]);
  ids.show = sh[0].id;
  ids.season = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 1, 'airing') RETURNING id", [ids.show])).rows[0].id;

  // A couch: its people ([user, role]) and when it started (and went, for the long-deleted one).
  const couch = async (key, name, people, o = {}) => {
    const { rows } = await pool.query("INSERT INTO couches (name, created_by, created_at, deleted_at, deleted_by) VALUES ($1, $2, $3, $4, $5) RETURNING id", [
      name,
      people[0] ? ids[people[0][0]] : null,
      days(o.age ?? 2),
      o.deletedDays ? days(o.deletedDays) : null,
      o.deletedDays ? ids.desk : null,
    ]);
    ids[key] = rows[0].id;
    for (const [k, role] of people) await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via, joined_at) VALUES ($1, $2, $3, 'couch', $4)", [ids[key], ids[k], role, days(o.age ?? 2)]);
  };
  await couch("den", DEN, [["kim", "owner"], ["lee", "member"], ["max", "member"]], { age: 2 });
  await couch("booth", BOOTH, [["ned", "owner"], ["kim", "member"]], { age: 40 });
  await couch("test", "ZT DH Test", [["desk", "owner"]], { age: 45 });
  await pool.query("INSERT INTO test_couches (couch_id, owner_id, rules) VALUES ($1, $2, 'same') ON CONFLICT DO NOTHING", [ids.test, ids.desk]);
  await couch("ancient", "ZT DH Ancient", [], { age: 90, deletedDays: 40 });
  for (let i = 1; i <= CROWD; i++) await couch(`crowd${i}`, `ZT DH Crowd ${String(i).padStart(2, "0")}`, [], { age: 50 + i });
  await pool.query("INSERT INTO couch_invites (code, couch_id, created_by) VALUES ($1, $2, $3)", [INVITE, ids.den, ids.kim]);

  let codes = 0;
  const codeOf = () => {
    const n = codes++;
    return `${PREFIX}${AB[Math.floor(n / AB.length) % AB.length]}${AB[n % AB.length]}${AB[crypto.randomInt(AB.length)]}`;
  };
  const game = async (key, o) => {
    const s = S.defaultState();
    const seats = o.seats ?? [];
    s.players = seats.map(([k], i) => ({ id: `p${i + 1}`, name: U(k), color: "#5089c9", disabled: false, active: true }));
    s.draftOrder = s.players.map((p) => p.id);
    Object.assign(s.settings, { leagueTypeId: o.type ?? "classic-draft", showId: SHOW[0], wikiSeason: "1" });
    if (o.archived) Object.assign(s.settings, { archivedAt: days(3).toISOString(), archivedBy: ids.kim });
    const code = codeOf();
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, created_at, deleted_at, deleted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [o.name, `zt-dh-${key}`, code, S.migrateLeagueState(s), ids[o.by ?? "kim"], ids[o.couch ?? "den"], days(o.age ?? 2), o.deletedDays ? days(o.deletedDays) : null, o.deletedDays ? ids.kim : null]
    );
    ids[key] = rows[0].id;
    ids[`${key}Code`] = code;
    if (!o.deletedDays) for (const [i, [k, role]] of seats.entries()) await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [ids[key], ids[k], `p${i + 1}`, role]);
  };
  await game("outlast", { name: "ZT DH Outlast", seats: [["kim", "commissioner"], ["lee", "member"], ["max", "member"]] });
  await game("pool", { name: "ZT DH Pool", type: "pickem", seats: [["lee", "member"], ["max", "member"]] });
  await game("lineup", { name: "ZT DH Lineup", type: "active-roster", seats: [["kim", "commissioner"], ["lee", "member"]], archived: true });
  await game("old", { name: "ZT DH Old", type: "pickem", seats: [["kim", "commissioner"]], deletedDays: 5 });
  await game("boothGame", { name: "ZT DH Booth Game", type: "pickem", couch: "booth", by: "ned", seats: [["ned", "commissioner"], ["kim", "member"]], age: 40 });
  await game("ancientGame", { name: "ZT DH Ancient Game", type: "pickem", couch: "ancient", deletedDays: 40, age: 90 });
  // The old game's delete line, as Backstage writes it (its seats in the undo), so it could come back on its own.
  await pool.query(
    `INSERT INTO league_changes (league_id, user_id, kind, tier, text, undo, batch, undo_until, created_at)
     VALUES ($1, $2, 'game.delete', 3, 'zt_dh_kim deleted ZT DH Old (restorable for 30 days)', $3, $4, $5, $6)`,
    [ids.old, ids.kim, JSON.stringify({ type: "game", memberships: [{ league_id: ids.old, user_id: ids.kim, player_id: "p1", role: "commissioner" }], groupId: null, groupPosition: null, commissioners: [ids.kim] }), crypto.randomUUID(), days(-25), days(5)]
  );
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || coalesce(deleted_at::text, ''), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;
const REAL_COUCHES = `SELECT md5(string_agg(c.id || c.name || coalesce(c.deleted_at::text, '') || (SELECT count(*) FROM couch_members m WHERE m.couch_id = c.id), ',' ORDER BY c.id)) AS h
  FROM couches c WHERE c.name NOT LIKE 'ZT %'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dh_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const before = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_COUCHES].map(async (q) => (await pool.query(q)).rows[0].h));
  const closers = [];
  try {
    const ids = await up(pool);
    const as = {
      desk: await api({ user: U("desk"), pass: PASSWORD }),
      kim: await api({ user: U("kim"), pass: PASSWORD }),
      oz: await api({ user: U("oz"), pass: PASSWORD }),
    };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const list = async (o) => (await as.desk.call("GET", `/api/desk/couches?${new URLSearchParams(o)}`)).body;
    const get = async (id) => (await as.desk.call("GET", `/api/desk/couches/${id}`)).body;
    const act = (id, body) => as.desk.call("POST", `/api/desk/couches/${id}`, body);
    const game = async (id) => (await as.desk.call("GET", `/api/desk/games/${id}`)).body;
    const mine = (l) => l.couches.filter((c) => /^ZT DH /.test(c.name) && !/Crowd/.test(c.name)).map((c) => c.name);
    const deletedAt = async (id) => (await pool.query("SELECT deleted_at::text AS at FROM leagues WHERE id = $1", [id])).rows[0]?.at ?? null;
    const membersOf = async (id) => (await pool.query("SELECT user_id, role, via FROM couch_members WHERE couch_id = $1 ORDER BY user_id", [id])).rows;
    const seatsOf = async (id) => (await pool.query("SELECT count(*)::int AS n FROM league_memberships WHERE league_id = $1", [id])).rows[0].n;
    const homeCouches = async (who) => ((await as[who].call("GET", "/api/me/home")).body.couches ?? []).map((c) => c.name);
    const told = async (key) => (await pool.query("SELECT user_id FROM notifications WHERE key LIKE $1 AND user_id = ANY($2)", [key, [ids.kim, ids.lee, ids.max, ids.ned, ids.desk]])).rows.map((r) => r.user_id);

    // ---- 1. only site admins ----
    const refused = await Promise.all([as.oz.call("GET", "/api/desk/couches"), as.oz.call("GET", `/api/desk/couches/${ids.den}`), as.oz.call("POST", `/api/desk/couches/${ids.den}`, { delete: true })]);
    check(refused.every((r) => r.status === 403), "a player is refused the couches routes", refused.map((r) => r.status).join(","));

    // ---- 2. Find › Couches through the API ----
    const all = await list({ q: "ZT DH" });
    check(JSON.stringify(mine(all).sort()) === JSON.stringify([DEN, BOOTH, "ZT DH Test"].sort()), "All, searched: the fixture's couches (not the long-deleted one)", JSON.stringify(mine(all)));
    check(all.total === 3 + CROWD && all.couches.length === 25, `${3 + CROWD} match, the first 25`, `${all.total}/${all.couches.length}`);
    check(all.counts && ["all", "nobody", "new", "deleted"].every((k) => Number.isInteger(all.counts[k])) && all.counts.all >= 3 + CROWD, "the chips' counts", JSON.stringify(all.counts));
    const den = all.couches.find((c) => c.name === DEN);
    check(den?.people === 3 && den.games === 3 && den.runBy.join() === U("kim") && den.stranded === 1 && !den.deleted, "the Den's row: 3 people, 3 games (not the one deleted before), run by kim, 1 nobody runs", JSON.stringify(den));
    const booth = all.couches.find((c) => c.name === BOOTH);
    check(booth?.people === 2 && booth.games === 1 && booth.runBy.join() === U("ned") && booth.stranded === 0, "the Booth's row", JSON.stringify(booth));
    check(all.couches.find((c) => c.name === "ZT DH Crowd 01")?.runBy.length === 0, "a couch with nobody and no games: nobody runs it");
    check(JSON.stringify(mine(await list({ q: "ZT DH", f: "nobody" }))) === JSON.stringify([DEN]), "Nobody runs it: the Den (its Pool has no Commissioner)");
    check(mine(await list({ q: "ZT DH", f: "new" })).includes(DEN) && !mine(await list({ q: "ZT DH", f: "new" })).includes(BOOTH), "New this month: the Den, not the Booth (40 days old)");
    check(mine(await list({ q: "ZT DH", f: "deleted" })).length === 0, "Deleted: none yet (the Ancient went 40 days ago)");
    check(JSON.stringify(mine(await list({ q: U("ned") }))) === JSON.stringify([BOOTH]), "by who runs it (ned runs the Booth's game)");
    check(mine(await list({ q: U("kim") })).sort().join() === [BOOTH, DEN].sort().join() || mine(await list({ q: U("kim") })).join() === DEN, "by who has it or runs its games (kim)", mine(await list({ q: U("kim") })).join());
    const page2 = await list({ q: "ZT DH", offset: 25 });
    check(page2.couches.length === 3 + CROWD - 25 && !page2.couches.some((c) => all.couches.some((x) => x.id === c.id)), "the next page: the rest, none twice");
    check(all.couches[0].name === DEN || all.couches[0].name === "ZT DH Test" || all.couches[0].startedAt >= all.couches[1].startedAt, "Newest first", all.couches.slice(0, 3).map((c) => c.name).join());
    check((await list({ q: "ZT DH", sort: "big" })).couches[0].name === DEN, "Most people: the Den's three first");
    check((await list({ q: "ZT DH Crowd", sort: "name" })).couches[0].name === "ZT DH Crowd 01", "Name, A to Z");
    check((await list({ q: "ZT DH Ancient", f: "deleted" })).total === 0, "a couch deleted 40 days ago: found nowhere");

    // ---- 3. a couch's page through the API ----
    const c1 = await get(ids.den);
    check(c1.name === DEN && c1.members.length === 3 && c1.games.length === 3 && c1.runBy.join() === U("kim") && c1.stranded.length === 1 && !c1.deleted && c1.off === null, "the Den: its people, games, who runs them, the game nobody runs", JSON.stringify({ ...c1, history: undefined }));
    check(c1.history.at(-1)?.text === `Started by ${U("kim")}` && Number.isFinite(Date.parse(c1.startedAt)), "History: started by kim", JSON.stringify(c1.history.map((h) => h.text)));
    const ct = await get(ids.test);
    check(ct.off === "A test couch goes from Settings › Test couch" && (await act(ids.test, { delete: true })).status === 409, "a test couch: no Delete here", ct.off);
    check((await as.desk.call("GET", `/api/desk/couches/${ids.ancient}`)).status === 404 && (await as.desk.call("GET", "/api/desk/couches/not-a-couch")).status === 404, "long deleted, or no such couch: 404");
    check((await act(ids.den, { nothing: true })).status === 400 && (await act(ids.den, { restore: true })).status === 409, "an action it doesn't know: 400; Restore one that isn't deleted: 409");

    // ---- 4. Delete, Restore ----
    check((await homeCouches("kim")).sort().join() === [BOOTH, DEN].sort().join(), "before: kim's home has both couches", (await homeCouches("kim")).join());
    check((await as.oz.call("GET", `/api/couches/invite/${INVITE}`)).status === 200, "before: the Den's invite code opens it");
    check((await as.kim.call("GET", `/api/seasons/${ids.season}/chat?couch=${ids.den}`)).status === 200 && (await as.kim.call("GET", `/api/couches/${ids.den}/hub`)).status === 200, "before: kim reads its chat and its hub");
    const oldAt = await deletedAt(ids.old);
    const d1 = await act(ids.den, { delete: true });
    check(d1.status === 200 && d1.body.text === `Deleted ${DEN} and its 3 games · restore from here for 30 days`, "Delete", JSON.stringify(d1.body));
    const { rows: cr } = await pool.query("SELECT deleted_at::text AS at, deleted_by FROM couches WHERE id = $1", [ids.den]);
    check(!!cr[0].at && cr[0].deleted_by === ids.desk, "the couch is deleted, by the desk");
    check((await membersOf(ids.den)).length === 0, "its people are off it");
    const atOf = await Promise.all(["outlast", "pool", "lineup"].map((k) => deletedAt(ids[k])));
    check(atOf.every((a) => a === cr[0].at), "its three games went with it, at the same moment", JSON.stringify([cr[0].at, ...atOf]));
    check((await deletedAt(ids.old)) === oldAt, "the game deleted before it is left as it was");
    check((await seatsOf(ids.outlast)) === 0, "their seats out of them (kept in each one's line)");
    const lines = (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 AND kind = 'game.delete'", [ids.outlast])).rows.map((r) => r.text);
    check(lines.join() === `${U("desk")} deleted ZT DH Outlast with ${DEN} (restorable for 30 days)`, "each game's line in Recent changes says so", lines.join());
    const gd = await game(ids.outlast);
    check(gd.state === "deleted" && gd.deleted?.couch === "with" && gd.restorable === false && gd.history[0]?.text === `Deleted with ${DEN}: restorable for 30 days`, "a game it took: deleted with it, not restorable on its own", JSON.stringify({ d: gd.deleted, r: gd.restorable, h: gd.history[0] }));
    const alone = await as.desk.call("POST", `/api/desk/games/${ids.outlast}`, { restore: true });
    check(alone.status === 409 && new RegExp(`${DEN} is deleted: restore it, and its games come back with it`).test(alone.body.error || ""), "Restore that game alone: refused, saying why", JSON.stringify(alone.body));
    check((await game(ids.old)).deleted?.couch === "gone", "the game deleted before: its couch is gone too");
    const cd = await get(ids.den);
    check(cd.deleted?.by === U("desk") && cd.deleted.restorable && Date.parse(cd.deleted.until) - Date.parse(cd.deleted.at) === 30 * 864e5, "its page: deleted, by whom, until 30 days on, restorable", JSON.stringify(cd.deleted));
    check(cd.members.length === 3 && cd.games.length === 3 && cd.games.every((g) => g.deleted) && cd.runBy.join() === U("kim") && cd.stranded.length === 0, "its page: who was on it, and the games it took", JSON.stringify({ m: cd.members.length, g: cd.games.map((g) => [g.name, g.deleted]), r: cd.runBy }));
    check(cd.history[0]?.text === "Deleted, with 3 games: restorable for 30 days" && !cd.history[0].undoable, "History: Deleted, with 3 games", JSON.stringify(cd.history.slice(0, 2)));
    check((await act(ids.den, { delete: true })).status === 409 && (await act(ids.den, { anyone: false })).status === 409, "Delete again, or Override on it: refused");
    const late = await pool
      .query("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('ZT DH Late', 'zt-dh-late', $1, '{}'::jsonb, $2, $3)", [`${PREFIX}ZZZ`, ids.kim, ids.den])
      .then(() => "made", (e) => e.message);
    check(late === "That couch was deleted", "a game started on it now: refused by the database", late);
    // every couch read leaves it out
    check((await homeCouches("kim")).join() === BOOTH, "kim's home: the Booth only (her other couch untouched)", (await homeCouches("kim")).join());
    check((await as.kim.call("GET", `/api/couches/${ids.den}`)).status === 404 && (await as.desk.call("GET", `/api/couches/${ids.den}`)).status === 404, "the couch's own read: 404, for a site admin too");
    check((await as.kim.call("GET", `/api/seasons/${ids.season}/chat?couch=${ids.den}`)).status === 404, "its chat: not there (404)");
    check((await as.kim.call("GET", `/api/couches/${ids.den}/hub`)).status === 404, "its hub: not there (404)");
    check((await as.oz.call("GET", `/api/couches/invite/${INVITE}`)).status === 404 && (await as.oz.call("POST", "/api/couches/join", { code: INVITE })).status === 404, "its invite code leads nowhere");
    check((await as.oz.call("GET", `/api/couches/invite/${ids.outlastCode}`)).status === 404, "nor do its games' join codes");
    check(!(await list({ q: "ZT DH" })).couches.some((c) => c.name === DEN) && JSON.stringify(mine(await list({ q: "ZT DH", f: "deleted" }))) === JSON.stringify([DEN]), "Find › Couches: on Deleted only");
    check(JSON.stringify(mine(await list({ q: U("kim"), f: "deleted" }))) === JSON.stringify([DEN]), "Deleted, searched by who had it (kim): the Den");
    check((await list({ offset: "Infinity" })).couches?.length === 0, "an offset past the end: an empty page, not an error");
    const delRow = (await list({ q: "ZT DH", f: "deleted" })).couches[0];
    check(delRow.people === 3 && delRow.games === 3 && delRow.deleted?.by === U("desk"), "its Deleted row: who was on it, the games it took, who deleted it", JSON.stringify(delRow));
    check(!((await as.desk.call("GET", `/api/desk/find?q=${encodeURIComponent(DEN)}`)).body.couches?.couches ?? []).length, "Find's search leaves it out");
    check((await as.desk.call("GET", "/api/desk/find?q=")).body.browse?.couches?.deleted >= 1, "Browse: deleted, restorable");
    check(!(await as.desk.call("GET", "/api/desk/inbox")).body.items.some((i) => i.href === `/desk/couch/${ids.den}`), "the Inbox: its game nobody runs is gone with it");
    check(!(await as.desk.call("GET", `/api/desk/people/${ids.kim}`)).body.couches.some((c) => c.id === ids.den), "kim's page on the desk: not on it");
    check(!(await pool.query("SELECT 1 FROM couches WHERE id = $1", [ids.ancient])).rows.length && !(await pool.query("SELECT 1 FROM leagues WHERE id = $1", [ids.ancientGame])).rows.length, "the couch deleted 40 days ago is gone for good, with its game");
    await new Promise((r) => setTimeout(r, 1500));
    const toldNow = await told("couch-deleted:%");
    check(toldNow.length === 3 && [ids.kim, ids.lee, ids.max].every((u) => toldNow.includes(u)) && !toldNow.includes(ids.ned), "kim, lee and max are told once each", JSON.stringify(toldNow));
    check((await told("game-deleted:%")).length === 0, "not once a game");
    const title = (await pool.query("SELECT title, body FROM notifications WHERE key LIKE 'couch-deleted:%' AND user_id = $1", [ids.kim])).rows[0];
    check(title?.title === `${DEN} was deleted` && /with its 3 games/.test(title.body) && /30 days/.test(title.body), "what they're told", JSON.stringify(title));

    const r1 = await act(ids.den, { restore: true });
    check(r1.status === 200 && r1.body.text === `${DEN} is back, with 3 games` && !!r1.body.changeId, "Restore", JSON.stringify(r1.body));
    const back = await membersOf(ids.den);
    check(back.length === 3 && back.find((m) => m.user_id === ids.kim)?.role === "owner" && back.every((m) => m.via === "couch"), "its people back as they were", JSON.stringify(back));
    check((await Promise.all(["outlast", "pool", "lineup"].map((k) => deletedAt(ids[k])))).every((a) => a === null) && (await seatsOf(ids.outlast)) === 3, "the games it took are back, their seats too");
    check((await game(ids.lineup)).state === "archived" && (await deletedAt(ids.old)) === oldAt, "the archived one still archived; the one deleted before still deleted");
    const cb = await get(ids.den);
    check(!cb.deleted && cb.history[0]?.text === "Restored, with 3 games: its people, games and chat as they were" && cb.history[0].undoable && cb.history.find((h) => /^Deleted, with/.test(h.text))?.undone, "History: Restored with Undo; the Delete undone", JSON.stringify(cb.history.slice(0, 3)));
    check((await game(ids.outlast)).history.some((h) => h.text === `Restored with ${DEN}: everyone's teams, picks and scores as they were`), "and a line on each game");
    check((await homeCouches("kim")).sort().join() === [BOOTH, DEN].sort().join() && (await as.oz.call("GET", `/api/couches/invite/${INVITE}`)).status === 200, "kim's home has it again; its code opens it");
    check((await act(ids.den, { restore: true })).status === 409, "Restore again: refused");
    check((await undo(r1.body.changeId)).status === 200 && !!(await get(ids.den)).deleted && (await membersOf(ids.den)).length === 0, "Restore's Undo: deleted again");
    await new Promise((r) => setTimeout(r, 1200));
    check((await told("couch-deleted:%")).length === 3, "nobody told twice");
    check((await undo(r1.body.changeId)).status === 409, "that Undo again: refused");
    const r2 = await act(ids.den, { restore: true });
    check(r2.status === 200 && !(await get(ids.den)).deleted, "restored again");
    const arch = await as.desk.call("POST", `/api/desk/games/${ids.outlast}`, { archive: true });
    check((await undo(r2.body.changeId)).status === 409 && !(await get(ids.den)).deleted, "Restore's Undo with a game archived since: refused");
    check((await get(ids.den)).history.filter((h) => h.undoable && /^Restored/.test(h.text)).map((h) => h.id).join() === r2.body.changeId, "History: only the newest Restore has Undo");
    await undo(arch.body.changeId);
    // someone whose account goes while it's deleted doesn't come back
    check((await act(ids.den, { delete: true })).status === 200, "deleted again");
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [ids.max]);
    check(!(await get(ids.den)).history.some((h) => h.undoable && /^Restored/.test(h.text)), "deleted: no Restore's Undo in its History");
    const r3 = await act(ids.den, { restore: true });
    check(r3.status === 200 && (await membersOf(ids.den)).length === 2 && (await seatsOf(ids.outlast)) === 2, "restored without max, whose account went meanwhile", JSON.stringify(await membersOf(ids.den)));

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
    const backSays = async () => (await pg.locator("[data-desk-back]").getAttribute("data-desk-back")) || "";
    const hold = async () => {
      await pg.waitForTimeout(600);
      const box = await pg.locator("[role=dialog][data-open] [data-hold]").last().boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await pg.waitForTimeout(1800);
      await pg.mouse.up();
    };
    const couchRow = (id) => pg.locator(`[data-couch-id='${id}']`);
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    // Browse › Couches
    await pg.goto(`${BASE}/desk/find`);
    await pg.waitForFunction(() => /couch/.test(document.querySelector("[data-desk-row='browse-couches']")?.textContent || ""), null, { timeout: 20000 });
    const browseRow = await pg.locator("[data-desk-row='browse-couches']").innerText();
    check(/^Couches\s/.test(browseRow) && /\d+ couches/.test(browseRow) && /\d+ nobody runs/.test(browseRow), "Browse: a Couches row with how many, and how many nobody runs", browseRow);
    await pg.locator("[data-desk-row='browse-couches']").click();
    await pg.locator("[data-desk-couches]").waitFor({ timeout: 20000 });
    check((await backSays()) === "Find" && (await pg.locator("[data-couches-filter='all'][aria-pressed=true]").count()) === 1, "Couches opens on All; Back says Find");
    check((await pg.locator("[data-couches-search]").getAttribute("placeholder")) === "Couch name, or who runs it", "its search: couch name, or who runs it");
    await pg.locator("[data-couches-search]").fill("ZT DH Den");
    await couchRow(ids.den).waitFor({ timeout: 15000 });
    await pg.waitForFunction(() => window.location.search === "?q=ZT+DH+Den", null, { timeout: 5000 }).catch(() => {});
    const denRow = await couchRow(ids.den).innerText();
    check(/Nobody runs it/i.test(denRow) && new RegExp(`2 people · 3 games · run by ${U("kim")} · 1 nobody runs`).test(denRow), "the row: its tag, people, games, who runs them", denRow);
    check(pg.url().endsWith("/desk/couches?q=ZT+DH+Den"), "the search is in the address", pg.url());
    await fits("Couches, searched");
    await shot("couches-search");
    await pg.locator("[data-couches-search]").fill("ZT DH");
    await pg.locator("[data-couches-more]").waitFor({ timeout: 15000 });
    await pg.locator("[data-couches-sort]").selectOption("big");
    await pg.waitForFunction(() => /Most people/.test(document.querySelector("[data-desk-couches]")?.textContent || ""), null, { timeout: 5000 });
    check(pg.url().includes("sort=big"), "the sort in the address too", pg.url());
    await shot("couches-list");

    // a couch's page, and its Delete
    await pg.locator("[data-couches-search]").fill("ZT DH Den");
    await couchRow(ids.den).waitFor({ timeout: 15000 });
    await couchRow(ids.den).locator("a").click();
    await pg.locator("[data-desk-couch='ok']").waitFor({ timeout: 20000 });
    check((await backSays()) === "Couches", "a couch from the list: Back says Couches", await backSays());
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Couch" && /Nobody runs some of its games/i.test(await pg.locator("[data-lower-third]").innerText()), "its lower third: Couch, nobody runs some of its games");
    check(/^Started \w+ \d+ · 2 people · 3 games$/.test(await pg.locator("[data-couch-facts]").innerText()), "its facts: started, people, games", await pg.locator("[data-couch-facts]").innerText());
    const last = await pg.evaluate(() => {
      const sections = [...document.querySelectorAll("section")];
      return sections[sections.length - 1]?.getAttribute("data-delete-row");
    });
    check(last === "couch" && /Delete ZT DH Den/.test(await pg.locator("[data-delete-row='couch']").innerText()) && /Its 3 games go too · restorable for 30 days/.test(await pg.locator("[data-delete-row='couch']").innerText()), "Delete ZT DH Den is the last thing on the page");
    await fits("a couch's page");
    await shot("couch", true);
    await pg.locator("[data-delete-row='couch'] button").click();
    await pg.locator("[data-couch-delete]").waitFor({ timeout: 10000 });
    const says = await pg.locator("[data-couch-delete]").innerText();
    check(
      /Its 2 people come off it and are told\. They keep their accounts and their other couches\./.test(says) && /Its 3 games are deleted too: everyone's teams, picks and scores in them\./.test(says) && /Its chat and history go with it\./.test(says),
      "the Delete says what it does",
      says
    );
    const sheet = await pg.locator("[role=dialog][data-open]").last().innerText();
    check(/Restorable for 30 days from Couches › Deleted/.test(sheet) && /Hold to delete ZT DH Den/i.test(sheet), "how it comes back, and Hold to delete", sheet);
    await fits("the couch's Delete");
    await shot("couch-delete");
    await hold();
    check(/Deleted ZT DH Den and its 3 games · restore from here for 30 days/.test(await toasted(/Deleted/)), "held: the toast says so, and where to restore it");
    await pg.locator("[data-desk-couches]").waitFor({ timeout: 15000 });
    await couchRow(ids.den).waitFor({ timeout: 15000 });
    check(pg.url().includes("f=deleted") && (await pg.locator("[data-couches-filter='deleted'][aria-pressed=true]").count()) === 1, "it lands on Couches › Deleted", pg.url());
    const gone = await couchRow(ids.den).innerText();
    check(/Deleted/i.test(gone) && new RegExp(`Deleted by ${U("desk")} \\w+ \\d+ · until \\w+ \\d+`).test(gone) && (await couchRow(ids.den).locator("[data-couch-restore]").count()) === 1, "its row: Deleted, by whom, until when, with Restore", gone);
    await fits("Couches › Deleted");
    await shot("couches-deleted");

    // the deleted couch's page, and a game it took
    await couchRow(ids.den).locator("a").click();
    await pg.locator("[data-desk-couch='deleted']").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Deleted", "its lower third: Deleted");
    check(new RegExp(`^Deleted by ${U("desk")} \\w+ \\d+ · until \\w+ \\d+\\. Its games and chat come back with it\\.$`).test(await pg.locator("[data-couch-deleted] small").innerText()), "Deleted: by whom, until when, what comes back", await pg.locator("[data-couch-deleted] small").innerText());
    check((await pg.locator("[data-desk-row='member']").count()) === 2 && (await pg.locator("[data-desk-row='game']", { hasText: "Deleted" }).count()) === 3, "who was on it, and its three games, Deleted");
    check((await pg.locator("[data-delete-row]").count()) === 0 && /^Started \w+ \d+ · 2 people · 3 games$/.test(await pg.locator("[data-couch-facts]").innerText()), "no Delete on it; its facts count the games it took", await pg.locator("[data-couch-facts]").innerText());
    await fits("a deleted couch");
    await shot("couch-deleted", true);
    await pg.locator("[data-desk-row='game']", { hasText: "ZT DH Outlast" }).click();
    await pg.locator("[data-desk-game='deleted']").waitFor({ timeout: 15000 });
    check(new RegExp(`It went with ${DEN}, and comes back with it from Couches › Deleted\\.`).test(await pg.locator("[data-game-deleted] small").innerText()) && (await pg.locator("[data-game-deleted] [data-game-restore]").count()) === 0, "a game it took: it comes back with the couch, no Restore of its own", await pg.locator("[data-game-deleted] small").innerText());
    await shot("game-went-with");
    await pg.goto(`${BASE}/desk/games?f=deleted&q=ZT+DH`);
    await pg.locator(`[data-game-id='${ids.outlast}']`).waitFor({ timeout: 15000 });
    check(new RegExp(`deleted with ${DEN}`).test(await pg.locator(`[data-game-id='${ids.outlast}']`).innerText()) && (await pg.locator(`[data-game-id='${ids.outlast}'] [data-game-restore]`).count()) === 0, "Games › Deleted: deleted with the Den, no Restore on its row", await pg.locator(`[data-game-id='${ids.outlast}']`).innerText());

    // Restore from its page, the toast's Undo, then Restore from the list's row
    await pg.goto(`${BASE}/desk/couch/${ids.den}`);
    await pg.locator("[data-couch-deleted] [data-couch-restore]").click();
    check(/ZT DH Den is back, with 3 games/.test(await toasted(/is back/)), "Restore: the toast says so");
    await pg.locator("[data-desk-couch='ok']").waitFor({ timeout: 15000 });
    check((await membersOf(ids.den)).length === 2, "and it's back");
    await shot("couch-restored");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.locator("[data-desk-couch='deleted']").waitFor({ timeout: 15000 });
    check(!!(await get(ids.den)).deleted, "the toast's Undo: deleted again");
    await pg.goto(`${BASE}/desk/couches?f=deleted&q=ZT+DH`);
    await couchRow(ids.den).locator("[data-couch-restore]").click();
    check(/ZT DH Den is back, with 3 games/.test(await toasted(/is back/)), "Restore from its row: the toast");
    await pg.waitForFunction((id) => !document.querySelector(`[data-couch-id='${id}']`), ids.den, { timeout: 15000 }).catch(() => {});
    check((await couchRow(ids.den).count()) === 0 && !(await get(ids.den)).deleted, "and it leaves Deleted");

    // Find's search: three couches, and All N
    await pg.goto(`${BASE}/desk/find`);
    await pg.locator("[data-find]").fill("ZT DH");
    await pg.locator("[data-find-all-couches]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-desk-item='couch']").count()) === 3 && new RegExp(`All ${3 + CROWD} couches matching`).test(await pg.locator("[data-find-all-couches]").innerText()), "Find: three couches and All N", await pg.locator("[data-find-all-couches]").innerText());
    check(/^Couch · /.test((await pg.locator("[data-desk-item='couch']").first().innerText()).split("\n").slice(1).join(" ")), "each says it's a couch");
    await fits("Find, searched");
    await shot("find-couches");
    await pg.locator("[data-find-all-couches]").click();
    await pg.locator("[data-desk-couches]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-couches-search]").inputValue()) === "ZT DH", "All N: Couches, searched");

    // a test couch's Delete
    await pg.goto(`${BASE}/desk/couch/${ids.test}`);
    await pg.locator("[data-delete-row='couch']").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-delete-row='couch'] button").count()) === 0 && /A test couch goes from Settings › Test couch/.test(await pg.locator("[data-delete-row='couch']").innerText()), "a test couch: its Delete says where it goes from");
    await shot("couch-test");

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    // The 404s and 409s this check asked for by hand are the API's, not the page's.
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    const after = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_COUCHES].map(async (q) => (await pool.query(q)).rows[0].h));
    check(after[0] === before[0], "every real account is as it was");
    check(after[1] === before[1], "every real league is as it was");
    check(after[2] === before[2], "every real couch is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
