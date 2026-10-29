// Dev-only check for a game's seats on the desk (docs/PLAN-desk-parity.md step 6, part 6b), against this lane's dev server,
// on a fixture of its own (zt_dt_ people on the ZT DT Couch: ZT DT Outlast, drafted, with jo its only Commissioner, dana,
// eli and fern signed in, mo's seat saved by jo's invite and cam out (left); ZT DT Pool, no draft, with an empty seat zed;
// ZT DT Spare to delete and bring back; a practice game; gus, wai (waiting) and sto (stopped) on the couch, not in a game;
// kat on no couch; tmp, whose account goes while Spare is deleted):
//   1. Only site admins: a player is refused the seat routes and Link's list.
//   2. A game's seats through the API: signed in (role, alone, other games), empty (saved by an invite), out (left), the
//      draft; Link's list (the couch's people without a seat, each said: on the couch, out, waiting, stopped; a search of
//      every account, six at a time, kat not on the couch; the seat's own account "here").
//   3. Link (tier 1): refused for someone waiting, stopped or out, and when it would leave no Commissioner (Noticed p); gus to
//      mo's empty seat as a Player (the seat named gus in the tables: Noticed o; a line in Recent changes, History lines, the
//      bell), its Undo; kat, not on the couch, to fern's seat as a Game admin (Noticed q: fern comes out and stays on the
//      couch, kat joins it), its Undo (kat off the couch, fern back); eli, in the game, to mo's seat (eli's own left empty,
//      "unlinked"), its Undo; a practice game refused.
//   4. Take out (tier 3, the app's takeOut, Noticed n): the only Commissioner refused; fern after the draft (the seat stays,
//      disabled; fern stays on the couch; out, "by you"), its Undo; dana from the pool before a draft (the seat goes), Put
//      back (a new seat, with Undo putting them out again as they were).
//   5. Put back cam (left): their own seat and name, the line that took them out marked undone, the bell; its Undo (out
//      again, as left).
//   6. Remove a seat (tier 3): mo's after the draft (disabled, out as removed; Put back: empty again); zed's in the pool
//      before one (gone; its Undo brings it back); a deleted game brought back without an account deleted meanwhile reads
//      that seat as empty, "its account was deleted" (Noticed ah).
//   7. Screens at --width: the game's Seats ("4 in · 1 empty · 1 out"), a seat's sheet (Act as, Link another, Unlink, Take out
//      last), Link an account (the couch first, a search, kat picked, the role, what moves) and the toast's Undo, an empty
//      seat's Link, the only Commissioner's sheet, Take out's hold, someone out and Put back, an empty seat's Remove, and the
//      person page's seat sheet with Open the game. Nothing wider than the screen; no page errors.
//   8. Nothing real moved: every account that isn't zt_ is as it was, and every real league too.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-seats.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-seats.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_dt_ accounts (their sessions, seats, couch rows and notices), the ZT DT Couch, the zt-dt- games (codes start
// Z8T: it refuses to run if a real code does), and the admin_changes lines on them; --keep leaves the fixture up. Refuses a
// non-local database. Prints PASS/FAIL. Doesn't share a fixture with check-desk-games.js (zt_dg_), so both may run at once.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-seats runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-seats.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dt_${k}`;
const COUCH = "ZT DT Couch";
const PREFIX = "Z8T";
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-dt-%'");
  const { rows: couch } = await pool.query("SELECT id FROM couches WHERE name = $1", [COUCH]);
  await pool.query(
    `DELETE FROM admin_changes WHERE (entity = 'game' AND entity_id = ANY($1)) OR (entity = 'couch' AND entity_id = ANY($2))
       OR entity_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dt\\_%') OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dt\\_%')`,
    [rows.map((r) => r.id), couch.map((c) => c.id)]
  );
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dt\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-dt-%'");
  await pool.query("DELETE FROM couches WHERE name = $1", [COUCH]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dt\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the checks can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-dt-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, banned, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, $5, $6, now(), now())`,
      [id, U(k), `${U(k)}@zt-dt.example.com`, o.role ?? null, o.approved ?? true, o.banned ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, now() - $2::interval)", [id, `${o.ago ?? 60} minutes`]);
  };
  await add("desk", { role: "admin" });
  for (const [k, ago] of [["jo", 12], ["dana", 55], ["eli", 180], ["fern", 4 * 1440], ["gus", 10], ["cam", 2 * 1440], ["kat", 6 * 1440], ["tmp", 30]]) await add(k, { ago });
  await add("wai", { approved: false });
  await add("sto", { banned: true });

  const { rows: c } = await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.jo]);
  ids.couch = c[0].id;
  for (const k of ["jo", "dana", "eli", "fern", "gus", "cam", "wai", "sto", "tmp"])
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, $3, $4)", [ids.couch, ids[k], k === "jo" ? "owner" : "member", ["gus", "wai", "sto", "cam"].includes(k) ? "couch" : "game"]);

  let codes = 0;
  const codeOf = () => {
    const n = codes++;
    return `${PREFIX}${AB[Math.floor(n / AB.length) % AB.length]}${AB[n % AB.length]}${AB[crypto.randomInt(AB.length)]}`;
  };
  // A game: its seats (each [key, role] signed in, or [name] for a seat nobody's in), its kind, whether it's drafted.
  const game = async (key, o) => {
    const s = S.defaultState();
    s.players = o.seats.map(([k], i) => ({ id: `p${i + 1}`, name: ids[k] ? U(k) : k, color: "#5089c9", disabled: false, active: true }));
    s.draftOrder = s.players.map((p) => p.id);
    Object.assign(s.settings, { leagueTypeId: o.type ?? "classic-draft" });
    let state = S.migrateLeagueState(s);
    if (o.drafted) state.draftPicksMade = 1;
    for (const [i, [k]] of o.seats.entries()) if (o.out?.includes(k)) S.disablePlayer(state, `p${i + 1}`, ids[k]);
    const code = codeOf();
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, solo, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - interval '9 days') RETURNING id`,
      [o.name, `zt-dt-${key}`, code, state, ids[o.by ?? "jo"], o.solo ? null : ids.couch, o.solo ?? null]
    );
    ids[key] = rows[0].id;
    for (const [i, [k, role]] of o.seats.entries())
      if (ids[k] && role && !o.out?.includes(k)) await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [ids[key], ids[k], `p${i + 1}`, role]);
  };
  await game("outlast", { name: "ZT DT Outlast", drafted: true, seats: [["jo", "commissioner"], ["dana", "member"], ["eli", "member"], ["fern", "member"], ["mo"], ["cam", "member"]], out: ["cam"] });
  await game("pool", { name: "ZT DT Pool", type: "pickem", seats: [["jo", "commissioner"], ["dana", "member"], ["eli", "member"], ["zed"]] });
  await game("spare", { name: "ZT DT Spare", type: "pickem", seats: [["jo", "commissioner"], ["tmp", "member"]] });
  await game("practice", { name: "ZT DT Practice", solo: "practice", by: "eli", seats: [["eli", "commissioner"]] });
  // mo's seat, saved by jo's invite; cam left Outlast (a member line as the app's leave writes it, by cam)
  await pool.query("INSERT INTO league_invites (league_id, invited_by, identifier, player_id, created_at) VALUES ($1, $2, 'zt_dt_mo', 'p5', now() - interval '8 days')", [ids.outlast, ids.jo]);
  await pool.query(
    `INSERT INTO league_changes (batch, league_id, user_id, kind, tier, text, undo, undo_until, created_at) VALUES ($1, $2, $3, 'member', 3, 'zt_dt_cam left the games', $4, now() + interval '30 days', now() - interval '3 days')`,
    [crypto.randomUUID(), ids.outlast, ids.cam, JSON.stringify({ type: "member", userId: ids.cam, playerId: "p6", name: U("cam"), role: "member", seen: null, removed: false })]
  );
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || coalesce(deleted_at::text, '') || md5(state::text), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dt_ fixture down");
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
    const seats = async (id = ids.outlast) => (await as.desk.call("GET", `/api/desk/games/${id}`)).body.seats;
    const seat = (userId, body, league = ids.outlast) => as.desk.call("POST", `/api/desk/seats/${league}/${userId}`, body);
    const emptySeat = (playerId, body, league = ids.outlast) => as.desk.call("POST", `/api/desk/seats/${league}/player/${playerId}`, body);
    const accounts = async (o, league = ids.outlast) => (await as.desk.call("GET", `/api/desk/games/${league}/accounts?${new URLSearchParams(o)}`)).body;
    const state = async (id = ids.outlast) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const member = async (k, id = ids.outlast) => (await pool.query("SELECT player_id, role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, ids[k]])).rows[0] ?? null;
    const onCouch = async (k) => (await pool.query("SELECT via FROM couch_members WHERE couch_id = $1 AND user_id = $2", [ids.couch, ids[k]])).rows[0]?.via ?? null;
    const seatNamed = async (pid, id = ids.outlast) => (await state(id)).players.find((p) => p.id === pid);
    const told = async (k, re) => (await pool.query("SELECT title FROM notifications WHERE user_id = $1", [ids[k]])).rows.some((r) => re.test(r.title));

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", `/api/desk/games/${ids.outlast}/accounts`),
      as.jo.call("POST", `/api/desk/seats/${ids.outlast}/${ids.fern}`, { takeOut: true }),
      as.jo.call("POST", `/api/desk/seats/${ids.outlast}/player/p5`, { remove: true }),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the seat routes and Link's list", refused.map((r) => r.status).join(","));

    // ---- 2. a game's seats ----
    let st = await seats();
    check(
      JSON.stringify(st.in.map((x) => [x.person.name, x.role, x.alone])) ===
        JSON.stringify([[U("jo"), "commissioner", true], [U("dana"), "member", false], [U("eli"), "member", false], [U("fern"), "member", false]]),
      "signed in: jo (the only Commissioner) first, then dana, eli and fern",
      JSON.stringify(st.in.map((x) => [x.person.name, x.role]))
    );
    check(st.in.find((x) => x.person.name === U("dana")).otherGames === 1 && st.in.find((x) => x.person.name === U("fern")).otherGames === 0, "each with their other games on the couch");
    check(st.empty.length === 1 && st.empty[0].name === "mo" && st.empty[0].why === "saved" && st.empty[0].by === U("jo"), "empty: mo's seat, saved by jo's invite", JSON.stringify(st.empty));
    check(st.out.length === 1 && st.out[0].person?.name === U("cam") && st.out[0].how === "left" && st.out[0].stays && st.out[0].onCouch && st.out[0].name === U("cam"), "out: cam, who left (their team stays; still on the couch)", JSON.stringify(st.out));
    check(st.drafted === true && st.noLink === null, "Outlast has drafted; accounts can be linked");
    const list = await accounts({});
    const rel = (l) => Object.fromEntries(l.list.map((c) => [c.name, c.rel]));
    const r0 = rel(list);
    check(r0[U("gus")] === "onCouch" && r0[U("cam")] === "out" && r0[U("wai")] === "waiting" && r0[U("sto")] === "stopped" && !(U("jo") in r0) && !(U("kat") in r0) && list.searched === false,
      "Link's list: the couch's people without a seat (gus; cam out, wai waiting, sto stopped)", JSON.stringify(r0));
    const kat = await accounts({ q: "zt_dt_kat" });
    check(kat.searched && kat.list.length === 1 && kat.list[0].rel === "notOnCouch", "a search finds kat, not on the couch", JSON.stringify(kat));
    const many = await accounts({ q: "zt_dt_" });
    check(many.list.length === 6 && many.total >= 11 && many.list.slice(0, 3).every((c) => c.rel !== "notOnCouch"), "six at a time, the couch's first, with how many match", JSON.stringify({ n: many.list.length, t: many.total }));
    const here = await accounts({ q: "zt_dt_fern", seat: ids.fern });
    check(here.list[0]?.rel === "here", "the seat's own account: signed in to it now");

    // ---- 3. Link ----
    for (const [k, why] of [["wai", /waiting/], ["sto", /can't sign in/], ["cam", /Put back/]]) {
      const r = await emptySeat("p5", { link: { to: ids[k], role: "member" } });
      check(r.status === 409 && why.test(r.body.error), `Link refused for ${k}`, `${r.status} ${r.body.error}`);
    }
    const lastC = await seat(ids.jo, { link: { to: ids.dana, role: "member" } });
    check(lastC.status === 409 && /Every game needs a Commissioner/.test(lastC.body.error), "Link refused when it'd leave no Commissioner (Noticed p)", JSON.stringify(lastC.body));
    const joMoves = await emptySeat("p5", { link: { to: ids.jo, role: "member" } });
    check(joMoves.status === 409 && /Commissioner/.test(joMoves.body.error), "and when the only Commissioner moves seats as a Player");
    const lk = await emptySeat("p5", { link: { to: ids.gus, role: "member" } });
    check(lk.status === 200 && lk.body.text === `${U("gus")} is in mo's seat in ZT DT Outlast`, "gus linked to mo's seat", JSON.stringify(lk.body));
    check(JSON.stringify(await member("gus")) === JSON.stringify({ player_id: "p5", role: "member" }) && (await seatNamed("p5")).name === U("gus"), "gus signs in to p5, and the seat's named gus in the tables (Noticed o)");
    check((await pool.query("SELECT text FROM league_changes WHERE league_id = $1 AND kind = 'member' AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1", [ids.outlast])).rows[0]?.text === `Linked ${U("gus")} to mo's seat`, "a line in the game's Recent changes");
    check((await pool.query("SELECT 1 FROM admin_changes WHERE entity = 'person' AND entity_id = $1 AND action = 'linked'", [ids.gus])).rows.length === 1, "and in gus's History");
    await new Promise((r) => setTimeout(r, 800));
    check(await told("gus", /You're in ZT DT Outlast/), "gus is told (the bell)");
    check((await undo(lk.body.changeId)).status === 200 && !(await member("gus")) && (await seatNamed("p5")).name === "mo", "its Undo: gus out, the seat mo's again");
    check((await seats()).empty.find((e) => e.name === "mo")?.why === "saved", "mo's seat is saved by the invite again");

    const lk2 = await seat(ids.fern, { link: { to: ids.kat, role: "admin" } });
    check(lk2.status === 200 && /zt_dt_kat is in zt_dt_fern's seat in ZT DT Outlast, as a Game admin/.test(lk2.body.text), "kat linked to fern's seat as a Game admin (Noticed q)", JSON.stringify(lk2.body));
    check(JSON.stringify(await member("kat")) === JSON.stringify({ player_id: "p4", role: "admin" }) && !(await member("fern")), "kat in p4, fern out of it");
    check((await onCouch("kat")) === "game" && (await onCouch("fern")) === "couch", "kat joins the couch; fern stays on it", `${await onCouch("kat")} ${await onCouch("fern")}`);
    check((await pool.query("SELECT 1 FROM admin_changes WHERE entity = 'person' AND entity_id = $1 AND action = 'moved-out'", [ids.fern])).rows.length === 1, "fern's History says they moved out");
    check((await undo(lk2.body.changeId)).status === 200, "its Undo");
    check(JSON.stringify(await member("fern")) === JSON.stringify({ player_id: "p4", role: "member" }) && !(await member("kat")) && (await seatNamed("p4")).name === U("fern"), "fern back in p4 as a Player, the seat fern's");
    check((await onCouch("kat")) === null && (await onCouch("fern")) === "game", "kat off the couch again; fern as they were", `${await onCouch("kat")} ${await onCouch("fern")}`);

    const lk3 = await emptySeat("p5", { link: { to: ids.eli, role: "member" } });
    check(lk3.status === 200 && (await member("eli")).player_id === "p5", "eli, in the game, linked to mo's seat");
    st = await seats();
    check(st.empty.some((e) => e.playerId === "p3" && e.why === "unlinked" && e.name === U("eli")), "eli's own seat is left empty, unlinked", JSON.stringify(st.empty));
    // their old seat removed meanwhile: the Undo can't put them back in it until it's back
    const rm3 = await emptySeat("p3", { remove: true });
    check(rm3.status === 200 && (await undo(lk3.body.changeId)).status === 409, "eli's old seat removed meanwhile: the link's Undo is refused");
    check((await emptySeat("p3", { putBack: true })).status === 200, "the seat put back, waiting for an account");
    check((await undo(lk3.body.changeId)).status === 200 && (await member("eli")).player_id === "p3" && (await seatNamed("p5")).name === "mo", "its Undo: eli back in their own seat");
    check(!(await seats()).empty.some((e) => e.playerId === "p5" && e.why === "unlinked"), "a seat put back isn't called unlinked");
    const prac = await seat(ids.eli, { link: { to: ids.gus, role: "member" } }, ids.practice);
    check(prac.status === 409 && /practice game/.test(prac.body.error) && (await seats(ids.practice)).noLink, "a practice game: no Link");

    // ---- 4. Take out ----
    const joOut = await seat(ids.jo, { takeOut: true });
    check(joOut.status === 409 && /Commissioner/.test(joOut.body.error), "Take out the only Commissioner: refused");
    const to = await seat(ids.fern, { takeOut: true });
    check(to.status === 200 && to.body.text === `${U("fern")} is out of ZT DT Outlast`, "fern taken out", JSON.stringify(to.body));
    const p4 = await seatNamed("p4");
    check(p4?.disabled && p4.disabledFromUserId === ids.fern && !(await member("fern")) && (await onCouch("fern")) === "couch", "after the draft: their seat stays, disabled, theirs to reclaim; they stay on the couch (Noticed n)");
    st = await seats();
    const fernOut = st.out.find((o) => o.person?.name === U("fern"));
    check(fernOut?.how === "out" && fernOut.by === "you" && fernOut.stays, "out: taken out, by you", JSON.stringify(fernOut));
    check((await pool.query("SELECT tier, undo->>'type' AS t FROM league_changes WHERE league_id = $1 AND kind = 'member' ORDER BY created_at DESC LIMIT 1", [ids.outlast])).rows[0]?.t === "member", "Recent changes has it, restorable");
    check((await undo(to.body.changeId)).status === 200 && (await member("fern"))?.player_id === "p4" && !(await seatNamed("p4")).disabled, "its Undo: fern back in their seat");
    const dana = await seat(ids.dana, { takeOut: true }, ids.pool);
    check(dana.status === 200 && !(await state(ids.pool)).players.some((p) => p.id === "p2"), "dana out of the pool before a draft: the seat goes");
    st = await seats(ids.pool);
    const danaOut = st.out.find((o) => o.person?.name === U("dana"));
    check(danaOut && !danaOut.stays && danaOut.playerId === "p2", "out of the pool, the seat gone", JSON.stringify(st.out));
    const pb = await seat(ids.dana, { putBack: true }, ids.pool);
    const danaSeat = (await member("dana", ids.pool))?.player_id;
    check(pb.status === 200 && danaSeat && danaSeat !== "p2" && (await seatNamed(danaSeat, ids.pool)).name === U("dana"), "Put back: a new seat in their name", JSON.stringify(pb.body));
    check((await undo(pb.body.changeId)).status === 200 && !(await member("dana", ids.pool)) && (await seats(ids.pool)).out.some((o) => o.person?.name === U("dana") && o.how === "out"), "its Undo: out again, as they were");

    // ---- 5. Put back cam ----
    const cam = await seat(ids.cam, { putBack: true });
    check(cam.status === 200 && cam.body.text === `${U("cam")} is back in ZT DT Outlast, with their team and points`, "Put back cam", JSON.stringify(cam.body));
    const p6 = await seatNamed("p6");
    check((await member("cam"))?.player_id === "p6" && !p6.disabled && p6.name === U("cam"), "their own seat, in their name");
    check((await pool.query("SELECT undone_at FROM league_changes WHERE league_id = $1 AND text = 'zt_dt_cam left the games'", [ids.outlast])).rows[0]?.undone_at, "the line that took them out is marked undone");
    await new Promise((r) => setTimeout(r, 800));
    check(await told("cam", /You're back in ZT DT Outlast/), "cam is told");
    check((await undo(cam.body.changeId)).status === 200 && !(await member("cam")) && (await seatNamed("p6")).disabled, "its Undo: out again");
    check((await seats()).out.find((o) => o.person?.name === U("cam"))?.how === "left", "and the page says they left, as before");

    // ---- 6. Remove a seat ----
    const rm = await emptySeat("p5", { remove: true });
    check(rm.status === 200 && (await seatNamed("p5")).disabled && !(await seatNamed("p5")).disabledFromUserId, "mo's seat removed after the draft: disabled, nobody's", JSON.stringify(rm.body));
    st = await seats();
    check(st.out.some((o) => !o.person && o.how === "removed" && o.name === "mo" && o.by === "you" && o.stays) && !st.empty.length, "out: mo's seat, removed by you", JSON.stringify(st.out));
    const back = await emptySeat("p5", { putBack: true });
    check(back.status === 200 && !(await seatNamed("p5")).disabled && (await seats()).empty.some((e) => e.playerId === "p5"), "Put the seat back: empty again", JSON.stringify(back.body));
    const zed = await emptySeat("p4", { remove: true }, ids.pool);
    check(zed.status === 200 && !(await state(ids.pool)).players.some((p) => p.id === "p4"), "zed's seat in the pool, before a draft: gone");
    check((await seats(ids.pool)).out.some((o) => o.name === "zed" && !o.stays), "out: zed's seat");
    check((await undo(zed.body.changeId)).status === 200 && (await state(ids.pool)).players.some((p) => p.name === "zed" && !p.disabled), "its Undo: zed's seat back");
    // Noticed ah: Spare deleted, tmp's account gone meanwhile, Spare back
    check((await as.desk.call("POST", `/api/desk/games/${ids.spare}`, { delete: true })).status === 200, "Spare deleted");
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [ids.tmp]);
    check((await as.desk.call("POST", `/api/desk/games/${ids.spare}`, { restore: true })).status === 200, "tmp's account gone; Spare back");
    const spare = await seats(ids.spare);
    check(spare.empty.some((e) => e.playerId === "p2" && e.why === "deleted"), "tmp's seat: empty, its account deleted (Noticed ah)", JSON.stringify(spare.empty));

    // ---- 7. screens ----
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
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const hold = async () => {
      await pg.waitForTimeout(600);
      const box = await pg.locator("[role=dialog][data-open] [data-hold]").last().boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await pg.waitForTimeout(1800);
      await pg.mouse.up();
    };
    const page = async () => {
      await pg.goto(`${BASE}/desk/game/${ids.outlast}`);
      await pg.locator("[data-game-seats]").waitFor({ timeout: 20000 });
    };
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    await page();
    const section = await pg.locator("[data-game-seats]").evaluate((el) => el.closest("section")?.innerText ?? "");
    check(/4 in · 1 empty · 1 out/.test(section), "Seats: 4 in · 1 empty · 1 out", section.slice(0, 200));
    // (jo signed in for section 1, so fern's row is the one that still reads as the fixture set it)
    check(
      /Commissioner/.test(await pg.locator(`[data-seat='${U("jo")}']`).innerText()) && /Active 4 days ago/.test(await pg.locator(`[data-seat='${U("fern")}']`).innerText()) && /Player/.test(await pg.locator(`[data-seat='${U("fern")}']`).innerText()),
      "a signed-in row: active, role"
    );
    check(/mo's seat/.test(await pg.locator("[data-seat-empty='mo']").innerText()) && /Saved by zt_dt_jo's invite · nobody signed in/.test(await pg.locator("[data-seat-empty='mo']").innerText()), "an empty seat: saved by jo's invite, with Link");
    check(/Out of it/i.test(section) && /Their teams stay in the standings/.test(section) && /Left \w+ \d+/.test(await pg.locator(`[data-seat-out='${U("cam")}']`).innerText()), "Out of it: cam, left", section);
    check(/A seat is a place in the game/.test(section), "what a seat is");
    const order = await pg.evaluate(() => [...document.querySelectorAll("section")].map((s) => s.querySelector("h2")?.textContent?.trim() || s.getAttribute("data-delete-row") || ""));
    const at = (t) => order.findIndex((x) => new RegExp(`^${t}$`, "i").test(x));
    check(at("Join code") < at("Seats") && at("Seats") < at("History"), "Seats sits between Join code and History", order.join(" | "));
    await fits("the game's Seats");
    await pg.locator("[data-game-seats]").scrollIntoViewIfNeeded();
    await shot("seats");

    // fern's seat
    await pg.locator(`[data-seat='${U("fern")}']`).click();
    await pg.locator("[data-seat-sheet]").waitFor({ timeout: 10000 });
    const rows = await pg.locator("[data-seat-sheet] [data-seat-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-seat-row")));
    check(JSON.stringify(rows) === JSON.stringify(["act", "link", "unlink", "take-out"]), "fern's sheet: Act as, Link another, Unlink, Take out last", JSON.stringify(rows));
    check(/Signed in to this seat · active 4 days ago/.test(await pg.locator("[data-desk-row='seat-who']").innerText()) && /Their seat stays in the standings, unplayed/.test(await pg.locator("[data-seat-row='take-out']").innerText()), "who's in it; Take out says the seat stays");
    await fits("a seat's sheet");
    await shot("seat");
    // Link another account: the couch first, a search, kat
    await pg.locator("[data-seat-row='link']").click();
    await pg.locator("[data-link-list='couch']").waitFor({ timeout: 10000 });
    check(/^On ZT DT Couch, not in ZT DT Outlast/i.test(await sheet().locator("h2").nth(1).innerText().catch(() => "")) || /On ZT DT Couch, not in ZT DT Outlast/i.test(await sheet().innerText()), "Link: the couch's people without a seat first");
    check((await pg.locator(`[data-link-pick='${U("cam")}']`).getAttribute("aria-disabled")) === "true" && /Left ZT DT Outlast \w+ \d+: Put back gives them their own seat/.test(await pg.locator(`[data-link-pick='${U("cam")}']`).innerText()), "cam can't be chosen: Put back instead");
    await shot("link-couch");
    await pg.locator("[data-link-search]").fill("zt_dt_kat");
    await pg.locator("[data-link-list='search']").waitFor({ timeout: 10000 });
    await pg.locator(`[data-link-pick='${U("kat")}']`).click();
    await pg.locator("[data-link-role='admin']").click();
    const sum = await pg.locator("[data-link-summary]").innerText();
    check(
      /zt_dt_kat signs in to zt_dt_fern's seat: its team, picks and scores are theirs from now on, and it's named zt_dt_kat in the tables\./.test(sum) &&
        /zt_dt_fern comes out of ZT DT Outlast and stays on ZT DT Couch\./.test(sum) &&
        /zt_dt_kat joins ZT DT Couch too\./.test(sum) &&
        /is told/.test(sum),
      "what moves: the seat's name, fern out, kat joins the couch, told",
      sum
    );
    await fits("Link an account");
    await shot("link-kat");
    await pg.locator("[data-link-go]").click();
    check(/zt_dt_kat is in zt_dt_fern's seat in ZT DT Outlast, as a Game admin/.test(await toasted(/is in/)), "Link: the toast");
    await pg.locator(`[data-seat='${U("kat")}']`).waitFor({ timeout: 15000 });
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.locator(`[data-seat='${U("fern")}']`).waitFor({ timeout: 15000 });
    check(!(await member("kat")) && (await member("fern"))?.player_id === "p4", "the toast's Undo: fern back");
    // an empty seat's Link
    await pg.locator("[data-seat-link='mo']").click();
    await pg.locator("[data-link-list='couch']").waitFor({ timeout: 10000 });
    await pg.locator(`[data-link-pick='${U("gus")}']`).click();
    check((await pg.locator("[data-link-role='member']").getAttribute("aria-checked")) === "true", "an empty seat: Player by default");
    await pg.locator("[data-link-go]").click();
    check(/zt_dt_gus is in mo's seat/.test(await toasted(/is in/)), "gus in mo's seat");
    await pg.locator(`[data-seat='${U("gus")}']`).waitFor({ timeout: 15000 });
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.locator("[data-seat-empty='mo']").waitFor({ timeout: 15000 });
    // jo, who runs it alone, picked for mo's seat: they stay Commissioner
    await pg.locator("[data-seat-link='mo']").click();
    await pg.locator("[data-link-search]").fill("zt_dt_jo");
    await pg.locator(`[data-link-pick='${U("jo")}']`).click();
    check(
      (await pg.locator("[data-link-role='commissioner']").getAttribute("aria-checked")) === "true" &&
        (await pg.locator("[data-link-role='member']").getAttribute("aria-disabled")) === "true" &&
        /zt_dt_jo runs ZT DT Outlast alone, so they stay Commissioner/.test(await sheet().innerText()),
      "picking someone who runs it alone: they stay Commissioner"
    );
    await pg.locator("[data-link-search]").fill("zt_dt_gus");
    await pg.locator(`[data-link-pick='${U("gus")}']`).waitFor({ timeout: 10000 });
    check((await pg.locator("[data-link-foot]").count()) === 0, "a new search drops a pick it doesn't show");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(400);
    // the only Commissioner
    await pg.locator(`[data-seat='${U("jo")}']`).click();
    await pg.locator("[data-seat-alone]").waitFor({ timeout: 10000 });
    check(
      /runs ZT DT Outlast alone\. Hand it on first/.test(await pg.locator("[data-seat-alone]").innerText()) &&
        (await pg.locator("[data-seat-row='take-out']").getAttribute("aria-disabled")) === "true" &&
        (await pg.locator("[data-seat-row='unlink']").getAttribute("aria-disabled")) === "true" &&
        (await pg.locator("[data-seat-role='member']").getAttribute("aria-disabled")) === "true",
      "jo runs it alone: Hand it on; other roles, Unlink and Take out dimmed"
    );
    await shot("seat-alone", true);
    await pg.locator("[data-seat-row='link']").click();
    await pg.locator("[data-link-list]").waitFor({ timeout: 10000 });
    await pg.locator(`[data-link-pick='${U("gus")}']`).click();
    check((await pg.locator("[data-link-role='commissioner']").getAttribute("aria-checked")) === "true" && (await pg.locator("[data-link-role='member']").getAttribute("aria-disabled")) === "true" && /it stays Commissioner/.test(await sheet().innerText()), "linking the only Commissioner's seat: it stays Commissioner");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(400);
    // Take out fern: the hold
    await pg.locator(`[data-seat='${U("fern")}']`).click();
    await pg.locator("[data-seat-row='take-out']").click();
    await pg.locator("[data-take-out]").waitFor({ timeout: 10000 });
    const says = await pg.locator("[data-take-out]").innerText();
    check(/Their seat stays in the standings with its team and points, and nobody plays it/.test(says) && /They stay on ZT DT Couch\./.test(says) && /put them back from this game's page/.test(says), "Take out: what it does", says);
    check((await pg.getByRole("button", { name: "Unlink their account instead" }).count()) === 1, "Unlink their account instead");
    await fits("Take out");
    await shot("take-out");
    await hold();
    check(/zt_dt_fern is out of ZT DT Outlast/.test(await toasted(/is out of/)), "held: fern is out");
    await pg.locator(`[data-seat-out='${U("fern")}']`).waitFor({ timeout: 15000 });
    check(/Taken out \w+ \d+, by you/.test(await pg.locator(`[data-seat-out='${U("fern")}']`).innerText()), "under Out of it: taken out, by you");
    // someone out: Put back
    await pg.locator(`[data-seat-out='${U("cam")}']`).click();
    await pg.locator("[data-out-sheet]").waitFor({ timeout: 10000 });
    const outSays = await pg.locator("[data-says='seat-out']").innerText();
    check(/zt_dt_cam left ZT DT Outlast on \w+ \d+\. Its team stays in the standings with its points; nobody plays it\. zt_dt_cam is still on ZT DT Couch\./.test(outSays), "cam's seat: what happened", outSays);
    check(/They sign in to it again as a Player, with its team and points\. They're told\./.test(await sheet().innerText()), "Put back: as a Player, told");
    await shot("out-cam");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(400);
    await pg.locator(`[data-seat-out='${U("fern")}']`).click();
    await pg.locator("[data-out-back]").click();
    check(/zt_dt_fern is back in ZT DT Outlast, with their team and points/.test(await toasted(/is back in/)), "Put fern back: the toast");
    await pg.locator(`[data-seat='${U("fern")}']`).waitFor({ timeout: 15000 });
    // an empty seat: Remove
    await pg.locator("[data-seat-empty='mo'] button").first().click();
    await pg.locator("[data-empty-sheet]").waitFor({ timeout: 10000 });
    check(/zt_dt_jo saved it for mo with an invite on \w+ \d+\. Whoever accepts that invite gets the seat/.test(await sheet().innerText()), "mo's seat: who saved it and how it fills");
    await shot("empty");
    await pg.locator("[data-seat-row='remove-seat']").click();
    await pg.locator("[data-remove-seat]").waitFor({ timeout: 10000 });
    check(/It stays in the standings with its team and points, and nobody can sign in to it/.test(await pg.locator("[data-remove-seat]").innerText()) && /invite still lets mo onto ZT DT Couch, as a new player/.test(await pg.locator("[data-remove-seat]").innerText()), "Remove: what it does");
    await shot("remove-seat");
    await hold();
    check(/mo's seat is out of ZT DT Outlast/.test(await toasted(/is out of/)), "held: the seat's out");
    await pg.locator("[data-seat-out='mo']").waitFor({ timeout: 15000 });
    check(/Removed \w+ \d+, by you/.test(await pg.locator("[data-seat-out='mo']").innerText()), "under Out of it: removed, by you");
    await fits("the game after");
    await shot("seats-after", true);
    // the person page's seat sheet
    await pg.goto(`${BASE}/desk/person/${ids.dana}`);
    await pg.locator("[data-person-game='ZT DT Outlast']").click();
    await pg.locator("[data-seat-sheet]").waitFor({ timeout: 10000 });
    const prows = await pg.locator("[data-seat-sheet] [data-seat-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-seat-row")));
    check(JSON.stringify(prows) === JSON.stringify(["link", "unlink", "open", "take-out"]), "from the person: Link another, Unlink, Open the game, Take out last", JSON.stringify(prows));
    check(/The game's page: its seats, its code, its delete/.test(await pg.locator("[data-seat-row='open']").innerText()), "Open the game: its seats, its code, its delete");
    await shot("person-seat");

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    check(!errs.length && !failed.filter((f) => !/^409 /.test(f)).length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
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
