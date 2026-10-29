// Dev-only check for the desk's people and its page frame (docs/PLAN-desk-parity.md step 1, parts 1a and 1b), against
// this lane's dev server, on a fixture of its own (zt_dk_ people, a ZT DK couch with two games): Find › Browse, Find's
// search with "All N people matching", Find › People (search by name, username or email; Everyone · Waiting · Site admins
// · Can't sign in; newest, last active, name; 25 at a time), a person's page in the frame (lower third, facts, couches and
// games as links, History), Back naming where you came from (a person › their couch › back › back to the list as it was),
// Recently opened, Settings regrouped (a dot off recommended, a toast with Undo, Reset to recommended, Settings history);
// and a person's actions (1b): Let in (a waiting row, their page, Who gets in), Stop them signing in and Let them back in,
// Reset password, Name and email, and Act as them (the sheet, the app as them under the Viewing as bar, #3c6ea6, with the
// minutes left, Return back to their page, both ends in their History).
//   1. Only site admins: zt_dk_kat (a player) is refused the people routes and the actions.
//   2. The list's API: filters, searches (username, name, email; a username-only account's stand-in email never shown or
//      matched; % and _ taken literally), sorts, paging, and a person's read. Then each action through the API: what it
//      writes, who it signs out, what it refuses, its History line and its Undo (refused once a later change stands in
//      the way).
//   3. Screens at --width: Find, People, a person, a couch, each action's sheet, the app as kat, Settings and its sheets.
//      Nothing wider than the screen; no page errors.
//   4. Nothing real moved: every account that isn't zt_dk_ is as it was; the settings it changes are put back.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-people.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-people.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_dk_ accounts (and their sessions, seats and couch rows), the "ZT DK Couch" couch and its zt-dk- games, and
// the admin_changes lines its desk admin makes; --keep leaves the fixture up. Refuses a non-local database. Prints
// PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-people runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-people.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dk_${k}`;
const COUCH = "ZT DK Couch";
const CROWD = 26;
const SETTINGS = ["confirm_at", "new_couch_fill", "signups", "tiebreak"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  await pool.query(`DELETE FROM admin_changes WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dk\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-dk-%'");
  await pool.query("DELETE FROM couches WHERE name = $1", [COUCH]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dk\\_%'`);
}

/** The people: a desk admin, a player with a couch and two games, two waiting, one stopped, a username-only account, one
 *  found by their name, and a crowd for paging. Returns their ids by key. */
async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const now = Date.now();
  const add = async (k, o = {}) => {
    const id = `zt-dk-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    const username = U(k);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, banned, "banReason", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $4, $5, $6, $7, $8, $9, now())`,
      [id, o.name ?? username, o.email ?? `${username}@zt-dk.example.com`, username, o.role ?? null, o.approved ?? true, o.banned ?? null, o.banned ? "zt: a test" : null, new Date(now - (o.age ?? 0) * 60000)]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    if (o.seen != null) await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, $2)", [id, new Date(now - o.seen * 60000)]);
    return id;
  };
  await add("desk", { role: "admin", age: 60 * 24 * 40 });
  await add("kat", { age: 60 * 24 * 30, seen: 1 });
  await add("maya", { approved: false, age: 0 });
  await add("noor", { approved: false, age: 60 * 26 });
  await add("ben", { banned: true, age: 60 * 24 * 20, seen: 60 * 24 * 8 });
  await add("solo", { email: `zt_dk_solo.q7w2x9@no-email.invalid`, age: 60 * 24 * 10, seen: 60 * 30 });
  await add("named", { name: "Wren Example", age: 60 * 24 * 12, seen: 60 * 5 });
  for (let i = 1; i <= CROWD; i++) await add(`c${String(i).padStart(2, "0")}`, { age: 60 * 24 * 2 + i * 7, seen: 60 * 24 + i * 13 });
  // kat is on the new design (Act as opens it)
  await pool.query("INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new')", [ids.kat]);
  // kat signed in on two devices
  for (let i = 0; i < 2; i++)
    await pool.query(`INSERT INTO session (id, token, "expiresAt", "createdAt", "updatedAt", "userId") VALUES ($1, $2, $3, now(), now(), $4)`, [
      crypto.randomUUID(),
      `zt-dk-${crypto.randomUUID()}`,
      new Date(now + 7 * 24 * 3600000),
      ids.kat,
    ]);
  // kat's couch: kat started it, c01 is on it; two games, kat runs the first and is Game admin in the second (c01 runs it)
  const { rows: c } = await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.kat]);
  ids.couch = c[0].id;
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role, joined_at) VALUES ($1, $2, 'owner', now() - interval '30 days'), ($1, $3, 'member', now() - interval '20 days')", [ids.couch, ids.kat, ids.c01]);
  const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[crypto.randomInt(31)]).join("");
  for (const [n, type, katRole, c01Role] of [
    [1, "classic-draft", "commissioner", "member"],
    [2, "pickem", "admin", "commissioner"],
  ]) {
    // A whole league's state (a league write loads it: renaming a seat, part 1b), seats p1 and p2.
    const s = S.defaultState();
    s.players = [U("kat"), U("c01")].map((name, i) => ({ id: `p${i + 1}`, name, color: "#5089c9", disabled: false, active: true }));
    s.draftOrder = ["p1", "p2"];
    Object.assign(s.settings, { leagueTypeId: type, showId: "zt-dk-none", wikiSeason: "1" });
    const state = S.migrateLeagueState(s);
    const { rows } = await pool.query("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [
      `ZT DK Game ${n}`,
      `zt-dk-game-${n}`,
      code(),
      state,
      ids.kat,
      ids.couch,
    ]);
    ids[`game${n}`] = rows[0].id;
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', $3), ($1, $4, 'p2', $5)", [rows[0].id, ids.kat, katRole, ids.c01, c01Role]);
  }
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dk_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_USERS)).rows[0].h;
  const settingsBefore = (await pool.query("SELECT key, value FROM app_settings WHERE key = ANY($1)", [SETTINGS])).rows;
  const closers = [];
  try {
    const ids = await up(pool);
    const total = 7 + CROWD;
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD }), kat: await api({ user: U("kat"), pass: PASSWORD }) };

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.kat.call("GET", "/api/desk/people"),
      as.kat.call("GET", `/api/desk/people/${ids.kat}`),
      as.kat.call("GET", "/api/desk/find?q=zt"),
      as.kat.call("POST", `/api/desk/people/${ids.maya}`, { letIn: true }),
      as.kat.call("POST", `/api/desk/people/${ids.c01}/act`, {}),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the people routes", refused.map((r) => r.status).join(","));

    // ---- 2. the list's API ----
    const list = async (o) => (await as.desk.call("GET", `/api/desk/people?${new URLSearchParams(o)}`)).body;
    const names = (l) => l.people.map((p) => p.name);
    const all = await list({ q: "zt_dk" });
    check(all.total === total && all.people.length === 25, `search "zt_dk": ${total} people, the first 25`, `${all.total}/${all.people.length}`);
    check(all.counts.all >= total && all.counts.waiting >= 2 && all.counts.admins >= 1 && all.counts.stopped >= 1, "the chips' counts, unsearched", JSON.stringify(all.counts));
    check(names(all)[0] === U("maya"), "newest first: maya, who signed up just now", names(all)[0]);
    const page2 = await list({ q: "zt_dk", offset: 25 });
    check(page2.people.length === total - 25 && !page2.people.some((p) => names(all).includes(p.name)), "the next page: the rest, none twice", String(page2.people.length));
    check(JSON.stringify(names(await list({ q: "zt_dk", f: "waiting" })).sort()) === JSON.stringify([U("maya"), U("noor")]), "Waiting: maya and noor");
    check(JSON.stringify(names(await list({ q: "zt_dk", f: "admins" }))) === JSON.stringify([U("desk")]), "Site admins: the desk's admin");
    const stopped = await list({ q: "zt_dk", f: "stopped" });
    check(stopped.total === 1 && stopped.people[0].name === U("ben") && stopped.people[0].stopped && !stopped.people[0].waiting, "Can't sign in: ben (stopped, not waiting)");
    check(names(await list({ q: "zt_dk_kat@zt-dk.example" }))[0] === U("kat"), "found by email");
    check(names(await list({ q: "wren exam" }))[0] === U("named"), "found by their name (Wren Example)");
    const solo = (await list({ q: "zt_dk_solo" })).people[0];
    check(solo && solo.email === null, "a username-only account shows no email, not its stand-in", JSON.stringify(solo));
    check(!names(await list({ q: "q7w2x9" })).includes(U("solo")), "and its stand-in email isn't searched");
    check((await list({ q: "zt_dk%" })).total === 0 && (await list({ q: "zt_dk_c0" })).total === 9, "% and _ are taken literally (zt_dk_c0: 9 of the crowd)");
    const byName = names(await list({ q: "zt_dk", sort: "name" }));
    check(byName[0] === U("ben") && byName[1] === U("c01"), "Name, A to Z: ben, then c01", byName.slice(0, 3).join(","));
    const byActive = names(await list({ q: "zt_dk", sort: "active" }));
    check([U("desk"), U("kat")].every((u) => byActive.slice(0, 2).includes(u)) && byActive[2] === U("named"), "Last active: the two signed in just now, then named (5 hours ago)", byActive.slice(0, 3).join(","));
    const neverSeen = (await list({ q: "zt_dk", sort: "active", offset: 25 })).people;
    check(neverSeen.slice(-2).every((p) => [U("maya"), U("noor")].includes(p.name)), "never active sorts last", names({ people: neverSeen }).slice(-3).join(","));
    const kat = (await as.desk.call("GET", `/api/desk/people/${ids.kat}`)).body;
    const katDevices = (await pool.query(`SELECT count(*)::int AS n FROM session WHERE "userId" = $1 AND "impersonatedBy" IS NULL AND "expiresAt" > now()`, [ids.kat])).rows[0].n;
    check(kat.name === U("kat") && kat.devices === katDevices && katDevices >= 2, `kat's page: signed in on ${katDevices} devices`, String(kat.devices));
    const couch = kat.couches?.[0];
    check(
      kat.couches?.length === 1 && couch.id === ids.couch && couch.role === "owner" && couch.people === 2 && couch.games.map((g) => `${g.name}:${g.role}:${g.game}`).join() === "ZT DK Game 1:commissioner:Outlast,ZT DK Game 2:admin:Survival Pool",
      "kat's couch (started it, 2 people) and both games with their roles",
      JSON.stringify(kat.couches)
    );
    check(kat.history.some((h) => h.text === `Started ${COUCH}`) && kat.history.at(-1).text === "Made an account", "kat's History: started the couch, made an account");
    check((await as.desk.call("GET", "/api/desk/people/zt-dk-nobody")).status === 404, "nobody by that id: 404");
    const find0 = (await as.desk.call("GET", "/api/desk/find?q=")).body;
    check(find0.browse?.people.all >= total && find0.browse.people.waiting >= 2 && typeof find0.browse.library.templates === "number", "Find, nothing typed: Browse's counts", JSON.stringify(find0.browse));
    const findQ = (await as.desk.call("GET", "/api/desk/find?q=zt_dk")).body;
    check(findQ.people?.people.length === 3 && findQ.people.total === total, `Find "zt_dk": three people, of ${total}`, JSON.stringify(findQ.people?.total));

    // ---- 2b. a person's actions (part 1b), through the API ----
    const person = async (k) => (await as.desk.call("GET", `/api/desk/people/${ids[k]}`)).body;
    const act = (k, body) => as.desk.call("POST", `/api/desk/people/${ids[k]}`, body);
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const userRow = async (k) => (await pool.query(`SELECT username, name, email, "emailVerified", approved, banned, "banReason" FROM "user" WHERE id = $1`, [ids[k]])).rows[0];
    const sessionsOf = async (k) => (await pool.query(`SELECT count(*)::int AS n FROM session WHERE "userId" = $1`, [ids[k]])).rows[0].n;
    const signIn = (user, pass) =>
      fetch(`${BASE}/api/auth/sign-in/username`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: user, password: pass }) });
    const lineOf = (p, re) => p.history.find((h) => re.test(h.text));

    // Let in, and its Undo
    const letMaya = await act("maya", { letIn: true });
    check(letMaya.status === 200 && (await userRow("maya")).approved === true, "Let in: maya is in", JSON.stringify(letMaya.body));
    check((await act("maya", { letIn: true })).status === 409, "Let in again: refused (in already)");
    check(lineOf(await person("maya"), /^Let in$/)?.undoable === true, "maya's History: Let in, with Undo");
    check((await undo(letMaya.body.changeId)).status === 200 && (await userRow("maya")).approved === false, "its Undo: maya waits again");
    check((await undo(letMaya.body.changeId)).status === 409, "undone already: refused");

    // Stop them signing in, and its Undo
    await api({ user: U("c05"), pass: PASSWORD });
    const c05Cookie = await api({ user: U("c05"), pass: PASSWORD });
    check((await sessionsOf("c05")) >= 2, "c05 signed in on two devices");
    const stopC05 = await act("c05", { signIn: false, why: "zt: testing the stop" });
    const c05 = await userRow("c05");
    check(stopC05.status === 200 && c05.banned === true && c05.banReason === "zt: testing the stop", "Stop c05 signing in, with a reason", JSON.stringify(stopC05.body));
    check((await sessionsOf("c05")) === 0 && (await c05Cookie.call("GET", "/api/me")).status === 401, "c05 is signed out everywhere");
    const refusedSignIn = await signIn(U("c05"), PASSWORD);
    const refusedBody = await refusedSignIn.json().catch(() => ({}));
    check(refusedSignIn.status === 403 && refusedBody.message === "This account can't sign in right now.", "c05 can't sign in, told plainly", `${refusedSignIn.status} ${JSON.stringify(refusedBody)}`);
    const c05Page = await person("c05");
    check(c05Page.stopped && c05Page.stop?.byYou && c05Page.stop.why === "zt: testing the stop" && Date.now() - Date.parse(c05Page.stop.since) < 120000, "c05's page: stopped just now, by you, and why", JSON.stringify(c05Page.stop));
    check(lineOf(c05Page, /^Stopped from signing in: "zt: testing the stop"$/)?.undoable === true, "c05's History: Stopped from signing in, the reason, Undo");
    check((await act("c05", { signIn: false })).status === 409, "stopped already: refused");
    check((await as.desk.call("POST", `/api/desk/people/${ids.desk}`, { signIn: false })).status === 400, "not your own account");
    check((await undo(stopC05.body.changeId)).status === 200 && (await userRow("c05")).banned === false && (await signIn(U("c05"), PASSWORD)).ok, "its Undo: c05 signs in again");

    // Let them back in, and its Undo (stopped again, with the reason they had)
    const benBefore = await person("ben");
    check(benBefore.stop?.why === "zt: a test" && benBefore.stop.since === null, "ben's stop from before the desk: the reason, no date", JSON.stringify(benBefore.stop));
    const benBack = await act("ben", { signIn: true });
    check(benBack.status === 200 && (await userRow("ben")).banned === false && (await person("ben")).stop === null, "Let ben back in");
    check((await act("ben", { signIn: true })).status === 409, "back in already: refused");
    check((await undo(benBack.body.changeId)).status === 200 && (await userRow("ben")).banReason === "zt: a test" && (await userRow("ben")).banned === true, "its Undo: ben stopped again, his reason kept");
    const benPage = await person("ben");
    check(benPage.stop?.why === "zt: a test" && benPage.stop.byYou && Date.now() - Date.parse(benPage.stop.since) < 120000, "and since that Undo, by you", JSON.stringify(benPage.stop));

    // Reset password: a temporary one, the old one gone, signed out everywhere
    const c03Before = await api({ user: U("c03"), pass: PASSWORD });
    const pw = await act("c03", { password: "reset" });
    check(pw.status === 200 && /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/.test(pw.body.password), "Reset c03's password: three groups of four", JSON.stringify(pw.body));
    check((await c03Before.call("GET", "/api/me")).status === 401 && (await sessionsOf("c03")) === 0, "c03 is signed out everywhere");
    check(!(await signIn(U("c03"), PASSWORD)).ok && (await signIn(U("c03"), pw.body.password)).ok, "the old password fails, the temporary one works");
    const pwLine = lineOf(await person("c03"), /^Password reset/);
    check(pwLine && !pwLine.undoable, "c03's History: Password reset, no Undo");
    check((await as.desk.call("POST", `/api/desk/people/${ids.desk}`, { password: "reset" })).status === 400, "not your own password (Settings has it)");

    // Name and email
    await pool.query("INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, $2, $3, 'message', 'zt: hello')", [ids.game1, ids.c01, U("c01")]);
    const seatName = async (g) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [ids[g]])).rows[0].state.players.find((x) => x.id === "p2").name;
    const renamed = await act("c01", { name: "ZT_DK_Cee" });
    check(renamed.status === 200 && renamed.body.renamed && (await userRow("c01")).username === "zt_dk_cee" && (await userRow("c01")).name === "zt_dk_cee", "rename c01: kept in lower case, name and username", JSON.stringify(renamed.body));
    check((await seatName("game1")) === "zt_dk_cee" && (await seatName("game2")) === "zt_dk_cee", "c01's seats in both games take the new name");
    const msg = (await pool.query("SELECT author_name FROM chat_messages WHERE user_id = $1", [ids.c01])).rows[0];
    check(msg?.author_name === "zt_dk_cee", "and the messages c01 wrote");
    check(lineOf(await person("c01"), /^Renamed from zt_dk_c01 to zt_dk_cee$/)?.undoable === true, "c01's History: Renamed from, to, with Undo");
    const taken = await act("c01", { name: U("kat") });
    check(taken.status === 409 && taken.body.field === "name" && taken.body.error === `${U("kat")} is taken`, "a name that's taken: refused, under the name", JSON.stringify(taken.body));
    check((await act("c01", { name: U("desk") })).status === 409, "the admin's own name is taken too (Better Auth's check would have let it by)");
    const short = await act("c01", { name: "ab" });
    check(short.status === 400 && short.body.field === "name" && /3 to 30/.test(short.body.error), "too short: the sign-up rule", JSON.stringify(short.body));
    check((await act("c01", { name: "zt dk!" })).status === 400, "spaces and marks: refused");
    check((await undo(renamed.body.changeId)).status === 200 && (await userRow("c01")).username === U("c01") && (await seatName("game1")) === U("c01"), "its Undo: zt_dk_c01 again, seats too");
    const c04a = await act("c04", { name: "zt_dk_c04a" });
    const c04b = await act("c04", { name: "zt_dk_c04b" });
    check((await undo(c04a.body.changeId)).status === 409 && (await userRow("c04")).username === "zt_dk_c04b", "an Undo after a later rename: refused, nothing changed");
    check((await undo(c04b.body.changeId)).status === 200 && (await userRow("c04")).username === "zt_dk_c04a", "the later one's Undo: back one");
    const soloEmail = await act("solo", { email: "zt_dk_solo@zt-dk.example.com" });
    const soloRow = await userRow("solo");
    check(soloEmail.status === 200 && soloRow.email === "zt_dk_solo@zt-dk.example.com" && soloRow.emailVerified === true, "a username-only account gets an email (counted as checked)", JSON.stringify(soloEmail.body));
    check(lineOf(await person("solo"), /^Email added: zt_dk_solo@zt-dk\.example\.com$/), "solo's History: Email added (the stand-in never named)");
    check((await undo(soloEmail.body.changeId)).status === 200 && (await person("solo")).email === null && (await userRow("solo")).email.endsWith("@no-email.invalid"), "its Undo: back to no email");
    const emailTaken = await act("c06", { email: `${U("kat")}@zt-dk.example.com` });
    check(emailTaken.status === 409 && emailTaken.body.field === "email", "an email another account has: refused, under the email", JSON.stringify(emailTaken.body));
    check((await act("c06", { email: "x@no-email.invalid" })).status === 400, "a stand-in address: refused");
    check((await act("c06", { name: U("c06") })).status === 400, "nothing changed: refused");

    // Act as them: who it's refused for (the browser does the rest)
    const actOn = (k) => as.desk.call("POST", `/api/desk/people/${ids[k]}/act`, {});
    check((await actOn("maya")).status === 409, "Act as someone waiting: refused");
    check((await actOn("ben")).status === 409, "Act as someone who can't sign in: refused");
    check((await actOn("desk")).status === 400, "Act as yourself: refused");
    check((await as.kat.call("DELETE", "/api/desk/acting")).status === 400, "Return when you're nobody else: refused");
    // an hour that never came back through Return ends with the hour
    await pool.query(
      `INSERT INTO admin_changes (entity, entity_id, action, text, after, user_id) VALUES ('person', $1, 'act', 'Started acting as them', $2::jsonb, $3)`,
      [ids.c07, JSON.stringify({ sessionId: "zt-gone", until: new Date(Date.now() - 3600000).toISOString() }), ids.desk]
    );
    check(lineOf(await person("c07"), /^Acting as them ended, by the end of the hour$/), "an hour that ended without Return: its end in History");
    // an hour as c10 that a stop cuts short ends there, in History
    const hour = await as.desk.call("POST", `/api/desk/people/${ids.c10}/act`, {});
    check(hour.status === 200 && (await pool.query(`SELECT count(*)::int AS n FROM session WHERE "userId" = $1 AND "impersonatedBy" = $2`, [ids.c10, ids.desk])).rows[0].n === 1, "Act as c10: an hour as them begins", JSON.stringify(hour.body));
    const cut = await act("c10", { signIn: false });
    const c10Lines = (await person("c10")).history.map((h) => h.text);
    check(c10Lines.includes("Started acting as them") && c10Lines.includes("Acting as them ended: they were signed out") && !c10Lines.some((t) => /by the end of the hour/.test(t)), "stopped mid-hour: the hour ends then, in History", c10Lines.join(" | "));
    await undo(cut.body.changeId);

    // Undo answers to the lines after it: stopped, let back, stopped again
    const s1 = await act("c08", { signIn: false, why: "zt: first" });
    const s2 = await act("c08", { signIn: true });
    const s3 = await act("c08", { signIn: false, why: "zt: again" });
    check((await undo(s1.body.changeId)).status === 409 && (await undo(s2.body.changeId)).status === 409 && (await userRow("c08")).banned === true, "an old stop's or let-back's Undo: refused while a later line stands");
    const c08Since = (await person("c08")).stop?.since;
    const s3At = (await pool.query("SELECT created_at FROM admin_changes WHERE id = $1", [s3.body.changeId])).rows[0].created_at;
    check(c08Since === s3At.toISOString(), "since: the latest stop, not the first", `${c08Since} vs ${s3At.toISOString()}`);
    check((await undo(s3.body.changeId)).status === 200 && (await userRow("c08")).banned === false, "the latest one's Undo: c08 signs in again");
    // stopped again by the Undo of a let back in: since then
    const t1 = await act("c09", { signIn: false });
    const t2 = await act("c09", { signIn: true });
    await new Promise((r) => setTimeout(r, 1100));
    await undo(t2.body.changeId);
    const c09 = await person("c09");
    const t1At = (await pool.query("SELECT created_at FROM admin_changes WHERE id = $1", [t1.body.changeId])).rows[0].created_at;
    check(c09.stopped && Date.parse(c09.stop.since) > t1At.getTime() + 1000 && c09.stop.byYou, "stopped again by an Undo: since the Undo, by you", JSON.stringify(c09.stop));
    await act("c09", { signIn: true });

    // another site admin: not stopped, reset or acted as
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [ids.c11]);
    const asAdmin = [await act("c11", { signIn: false }), await act("c11", { password: "reset" }), await as.desk.call("POST", `/api/desk/people/${ids.c11}/act`, {})];
    check(asAdmin.every((r) => r.status === 409) && (await userRow("c11")).banned !== true, "another site admin: not stopped, reset or acted as", asAdmin.map((r) => r.status).join(","));
    await pool.query(`UPDATE "user" SET role = NULL WHERE id = $1`, [ids.c11]);
    check((await as.desk.call("POST", `/api/desk/people/${ids.c11}`, null)).status === 400, "a body that isn't an object: refused, not a 500");

    // ---- 3. screens ----
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
    const shot = async (name) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
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
    const settingNow = async (k) => (await pool.query("SELECT value FROM app_settings WHERE key = $1", [k])).rows[0]?.value;

    // Find › Browse
    await pg.goto(`${BASE}/desk/find`);
    await pg.locator("[data-desk-row='browse-people']").waitFor({ timeout: 30000 });
    await pg.waitForFunction(() => /accounts/.test(document.querySelector("[data-desk-row='browse-people']")?.textContent || ""), null, { timeout: 15000 });
    const browseLine = await pg.locator("[data-desk-row='browse-people']").innerText();
    check(new RegExp(`${find0.browse.people.all} accounts`).test(browseLine) && /waiting to get in/.test(browseLine), "Browse › People: how many accounts, and who's waiting", browseLine);
    check((await pg.locator("[data-desk-library-link]").count()) === 1, "Browse › Library");
    await fits("Find › Browse");
    await shot("find-browse");

    // Find's search: three people, then All N
    await pg.locator("[data-find]").fill("zt_dk");
    await pg.locator("[data-find-all-people]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-found] [data-desk-item='person']").count()) === 3, "Find: three people who match");
    check(new RegExp(`All ${total} people matching`).test(await pg.locator("[data-find-all-people]").innerText()), `Find: "All ${total} people matching"`);
    await fits("Find, searched");
    await shot("find-search");
    await pg.locator("[data-find-all-people]").click();
    await pg.locator("[data-desk-people]").waitFor({ timeout: 15000 });
    await pg.waitForFunction((t) => document.querySelector("[data-people-count]")?.textContent === `${t} people`, total, { timeout: 15000 });
    check((await pg.locator("[data-people-search]").inputValue()) === "zt_dk", "People opens searched");
    check((await back()) === "Find", "People's Back says Find", await back());
    check((await pg.locator("[data-person-row]").count()) === 25 && /Show 8 more/.test(await pg.locator("[data-people-more]").innerText()), "25 at a time: Show 8 more", await pg.locator("[data-people-more]").innerText().catch(() => "none"));
    await fits("People");
    await shot("people");
    await pg.locator("[data-people-more]").click();
    await pg.waitForFunction((t) => document.querySelectorAll("[data-person-row]").length === t, total, { timeout: 15000 });
    check((await pg.locator("[data-people-more]").count()) === 0, `all ${total} shown, no more to show`);

    // the chips
    await pg.locator("[data-people-filter='waiting']").click();
    await pg.waitForFunction(() => document.querySelector("[data-people-count]")?.textContent === "2 people", null, { timeout: 15000 });
    const waitingRows = await pg.locator("[data-person-row]").allInnerTexts();
    check(waitingRows.length === 2 && waitingRows.every((t) => /Waiting/i.test(t) && /Signed up/.test(t)), "Waiting: two rows, each tagged and saying when they signed up", waitingRows.join(" | "));
    await shot("people-waiting");
    check((await pg.locator("[data-people-filter='stopped']").count()) === 1, "Can't sign in shows while someone can't");
    await pg.locator("[data-people-filter='stopped']").click();
    await pg.waitForFunction(() => document.querySelector("[data-people-count]")?.textContent === "1 person", null, { timeout: 15000 });
    check(/can't sign in/i.test(await pg.locator("[data-person-row]").innerText()), "Can't sign in: ben");
    await pg.locator("[data-people-filter='admins']").click();
    // Can't sign in is "1 person" too: wait for the admin's row itself.
    await pg.locator(`[data-person-row='${U("desk")}']`).waitFor({ timeout: 15000 });
    const adminTags = await pg.locator("[data-person-row] i").allInnerTexts();
    check(adminTags.some((t) => /^you$/i.test(t.trim())), "Site admins: the desk's admin, tagged You", adminTags.join("|"));

    // nobody matches
    await pg.locator("[data-people-filter='waiting']").click();
    await pg.locator("[data-people-search]").fill("zt_dk_nobody");
    await pg.locator("[data-people-empty]").waitFor({ timeout: 15000 });
    check(/nobody matches/i.test(await pg.locator("[data-people-empty]").innerText()) && (await pg.locator("[data-people-everyone]").count()) === 1, "Nobody matches, among the people waiting: Search everyone");
    await fits("People, nobody matches");
    await shot("people-nobody");
    await pg.locator("[data-people-everyone]").click();
    await pg.waitForFunction(() => document.querySelector("[data-people-filter='all']")?.getAttribute("aria-pressed") === "true", null, { timeout: 15000 });
    check((await pg.locator("[data-people-everyone]").count()) === 0, "Search everyone: the filter's Everyone");

    // sort, and the address keeps it
    await pg.locator("[data-people-search]").fill("zt_dk");
    await pg.locator("[data-people-sort]").selectOption("name");
    await pg.waitForFunction((u) => document.querySelector("[data-person-row]")?.getAttribute("data-person-row") === u, U("ben"), { timeout: 15000 });
    check(true, "Name, A to Z: ben first");
    await pg.waitForFunction(() => /q=zt_dk/.test(location.search) && /sort=name/.test(location.search), null, { timeout: 5000 }).catch(() => {});
    check(/q=zt_dk/.test(new URL(pg.url()).search) && /sort=name/.test(new URL(pg.url()).search), "the address keeps the search and the sort", pg.url());
    // an email match is marked
    await pg.locator("[data-people-search]").fill("zt-dk.example");
    await pg.locator("[data-person-row] mark").first().waitFor({ timeout: 15000 });
    check(true, "a match in the email is marked");
    await pg.locator("[data-people-search]").fill("zt_dk");
    await pg.waitForFunction(() => !document.querySelector("[data-person-row] mark") && document.querySelectorAll("[data-person-row]").length >= 25, null, { timeout: 15000 });

    // a person
    await pg.locator("[data-people-search]").fill("zt_dk_k");
    await pg.locator(`[data-person-row='${U("kat")}']`).click();
    await pg.locator(`[data-desk-person='${U("kat")}']`).waitFor({ timeout: 15000 });
    check((await back()) === "People", "kat's Back says People", await back());
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Player" && (await pg.locator("[data-lower-third-name]").innerText()).toLowerCase() === U("kat"), "kat's lower third: Player, kat");
    const facts = await pg.locator("[data-facts]").innerText();
    check(/^Joined /.test(facts) && /active just now|active \d+ minutes ago/.test(facts) && new RegExp(`signed in on ${katDevices} devices`).test(facts), "the facts: joined, active, devices", facts);
    check((await pg.locator(`[data-person-couch='${COUCH}'] a`).count()) === 1, "the couch is a link");
    const games = await pg.locator("[data-person-game]").allInnerTexts();
    check(games.length === 2 && /Commissioner/.test(games[0]) && /Outlast/.test(games[0]) && /Game admin/.test(games[1]) && /Survival Pool/.test(games[1]), "both games, each with its role", games.join(" | "));
    check((await pg.locator("[data-history] > div").count()) === 2, "History: its lines (two, so no All N)");
    await fits("a person");
    await shot("person-kat");
    // kat › the couch › back › back
    await pg.locator(`[data-person-couch='${COUCH}'] a`).click();
    await pg.locator("[data-desk-couch]").waitFor({ timeout: 15000 });
    check((await back()) === U("kat"), "the couch's Back says kat", await back());
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Couch" && (await pg.locator(`[data-desk-row='member'][href='/desk/person/${ids.c01}']`).count()) === 1, "the couch: its lower third, its people as links");
    await fits("a couch");
    await shot("couch");
    await pg.locator("[data-desk-back]").click();
    await pg.locator(`[data-desk-person='${U("kat")}']`).waitFor({ timeout: 15000 });
    check((await back()) === "People", "Back on kat's page: People again");
    await pg.locator("[data-desk-back]").click();
    await pg.locator("[data-desk-people]").waitFor({ timeout: 15000 });
    await pg.waitForFunction(() => document.querySelectorAll("[data-person-row]").length > 0, null, { timeout: 15000 });
    const kept = [await pg.locator("[data-people-search]").inputValue(), await pg.locator("[data-people-sort]").inputValue()];
    check(kept[0] === "zt_dk_k" && kept[1] === "name", "back on People: the search and sort as they were", `${kept.join(",")} at ${pg.url()}`);
    // waiting and stopped people's pages
    await pg.goto(`${BASE}/desk/person/${ids.maya}`);
    await pg.locator("[data-person-state='waiting']").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Waiting", "maya: Waiting, and what that means");
    check((await back()) === "People", "opened from a link, Back falls back to People", await back());
    await shot("person-waiting");
    await pg.goto(`${BASE}/desk/person/${ids.ben}`);
    await pg.locator("[data-person-state='stopped']").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Can't sign in", "ben: Can't sign in");
    // Recently opened
    await pg.goto(`${BASE}/desk/find`);
    await pg.locator("[data-recent]").waitFor({ timeout: 15000 });
    const recent = await pg.locator("[data-recent]").innerText();
    check(recent.includes(U("ben")) && recent.includes(U("kat")) && recent.includes(COUCH) && recent.indexOf(U("ben")) < recent.indexOf(U("kat")), "Find › Recently opened: newest first", recent.replace(/\s+/g, " "));

    // ---- a person's actions (part 1b), on the screens ----
    const sheetOpen = () => pg.locator("[role=dialog]").last();
    const closeSheet = async () => {
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(450);
    };
    const lowerName = async () => ((await pg.locator("[data-lower-third-name]").innerText()) || "").toLowerCase();
    const openPerson = async (k) => {
      await pg.goto(`${BASE}/desk/person/${ids[k]}`);
      await pg.locator(`[data-desk-person]`).waitFor({ timeout: 20000 });
    };
    const undoToast = async () => {
      await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
      await toasted(/Undone/);
    };

    // Let in on a waiting row in People, and the toast's Undo
    await pg.goto(`${BASE}/desk/people?q=zt_dk&f=waiting`);
    await pg.locator(`[data-let-in='${U("maya")}']`).waitFor({ timeout: 20000 });
    await fits("People › Waiting, with Let in");
    await shot("people-waiting-let-in");
    await pg.locator(`[data-let-in='${U("maya")}']`).click();
    check(new RegExp(`${U("maya")} is in · they can play now`).test(await toasted(/is in/)), "Let in on maya's row: a toast says she can play");
    await pg.waitForFunction(() => document.querySelector("[data-people-count]")?.textContent === "1 person", null, { timeout: 15000 });
    check((await userRow("maya")).approved === true, "maya is in, and off the Waiting list");
    await undoToast();
    await pg.waitForFunction(() => document.querySelector("[data-people-count]")?.textContent === "2 people", null, { timeout: 15000 });
    check((await userRow("maya")).approved === false, "the toast's Undo: maya waits again");

    // maya's page: Let her in from it
    await openPerson("maya");
    check((await pg.locator("[data-act='off']").innerText()).includes("Once they're in"), "maya's Act as: off, until she's in");
    await fits("a person waiting");
    await shot("person-waiting-let-in");
    await pg.locator("[data-person-let-in]").click();
    await toasted(/is in/);
    await pg.locator("[data-act='on']").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-person-state]").count()) === 0 && (await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Player", "let in from her page: the panel goes, she's a Player, Act as is on");

    // c06: Stop them signing in, with a reason, then Let them back in
    await openPerson("c06");
    await pg.locator("[data-desk-row='signing']").click();
    await pg.locator("[data-signing-sheet='allowed']").waitFor({ timeout: 10000 });
    await shot("signing-sheet");
    await pg.locator("[data-field-input='why']").fill("zt: testing on the screen");
    await pg.locator("[data-stop]").click();
    check(new RegExp(`${U("c06")} can't sign in`).test(await toasted(/can't sign in/)), "Stop c06 signing in: a toast");
    await pg.locator("[data-person-state='stopped']").waitFor({ timeout: 15000 });
    const stoppedText = await pg.locator("[data-person-state='stopped']").innerText();
    check(/Since \w{3} \d+, by you: "zt: testing on the screen"\. Their seats, scores and messages are untouched\./.test(stoppedText.replace(/\s+/g, " ")), "the panel: since when, by you, why", stoppedText);
    check((await pg.locator("[data-lower-third]").getAttribute("data-lower-third")) === "Can't sign in" && /let them back in first/.test(await pg.locator("[data-act='off']").innerText()), "the lower third says so; Act as is off");
    check(/^Stopped since /.test((await pg.locator("[data-desk-row='signing'] small").innerText()).trim()), "Signing in: Stopped since");
    await fits("a person stopped");
    await shot("person-stopped");
    await pg.locator("[data-desk-row='signing']").click();
    await pg.locator("[data-signing-sheet='stopped']").waitFor({ timeout: 10000 });
    await shot("signing-sheet-stopped");
    await sheetOpen().locator("[data-back-in]").click();
    check(new RegExp(`${U("c06")} can sign in again`).test(await toasted(/sign in again/)), "Let c06 back in, from the sheet");
    await pg.waitForFunction(() => !document.querySelector("[data-person-state='stopped']"), null, { timeout: 15000 });
    check((await userRow("c06")).banned === false, "c06 can sign in");

    // c02: Name and email, a name that's taken, then a rename and its Undo
    await openPerson("c02");
    await pg.locator("[data-desk-row='account']").click();
    await pg.locator("[data-account-sheet]").waitFor({ timeout: 10000 });
    await pg.locator("[data-field-input='name']").fill(U("kat"));
    await pg.locator("[data-account-save]").click();
    await pg.locator("[data-field-error='name']").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-field-error='name']").innerText()) === `${U("kat")} is taken`, "a name that's taken: said under the name");
    await shot("account-sheet-taken");
    await pg.locator("[data-field-input='name']").fill("zt_dk_c02b");
    await pg.locator("[data-account-save]").click();
    check(/Renamed to zt_dk_c02b/.test(await toasted(/Renamed/)), "renamed: a toast says every game shows it");
    await pg.waitForFunction(() => (document.querySelector("[data-lower-third-name]")?.textContent || "").toLowerCase() === "zt_dk_c02b", null, { timeout: 15000 });
    check((await lowerName()) === "zt_dk_c02b", "the lower third has the new name");
    await undoToast();
    await pg.waitForFunction((u) => (document.querySelector("[data-lower-third-name]")?.textContent || "").toLowerCase() === u, U("c02"), { timeout: 15000 });
    check((await userRow("c02")).username === U("c02"), "the toast's Undo: zt_dk_c02 again");

    // solo: Name and email on a username-only account never shows its stand-in
    await openPerson("solo");
    await pg.locator("[data-desk-row='account']").click();
    await pg.locator("[data-account-sheet]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-field-input='email']").inputValue()) === "" && (await pg.locator("[data-field-input='email']").getAttribute("placeholder")) === "None yet", "a username-only account: the email field is empty (None yet)");
    await shot("account-sheet-no-email");
    await closeSheet();

    // c03: Reset password, shown once
    await openPerson("c03");
    await pg.locator("[data-desk-row='password']").click();
    await pg.locator("[data-password-make]").waitFor({ timeout: 10000 });
    await pg.locator("[data-password-make]").click();
    await pg.locator("[data-temp-password]").waitFor({ timeout: 15000 });
    const temp = (await pg.locator("[data-temp-password]").innerText()).trim();
    check(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(temp) && (await signIn(U("c03"), temp)).ok, "the temporary password, shown, works", temp);
    await fits("the password sheet");
    await shot("password-sheet");
    await pg.locator("[data-password-done]").click();
    await pg.waitForTimeout(500);
    await pg.locator("[data-desk-row='password']").click();
    await pg.locator("[data-password-make]").waitFor({ timeout: 10000 });
    check((await pg.locator("[data-temp-password]").count()) === 0, "opened again: it isn't shown again");
    await closeSheet();

    // your own page: no Act as, no Signing in, your password is in Settings
    await openPerson("desk");
    check(/Not on your own page/.test(await pg.locator("[data-act='off']").innerText()), "your own page: Act as is off");
    check((await pg.locator("[data-desk-row='signing']").count()) === 0 && (await pg.locator("[data-desk-row='password']").getAttribute("href")) === "/settings", "no Signing in; Password goes to Settings");
    await fits("your own page");
    await shot("person-you");

    // Act as kat: what it does, the app as kat under the bar, Return back to kat's page, both ends in History
    await openPerson("kat");
    await pg.locator("[data-act='on']").click();
    await pg.locator("[data-act-sheet]").waitFor({ timeout: 10000 });
    check(/For an hour you're zt_dk_kat: anything you do is done as them\. It's in History\./.test((await pg.locator("[data-act-sheet]").innerText()).replace(/\s+/g, " ")), "Act as: the sheet says what it does first");
    await fits("the Act as sheet");
    await shot("act-sheet");
    await pg.locator("[data-act-go]").click();
    await pg.waitForURL((u) => u.pathname === "/home", { timeout: 30000 });
    await pg.locator("[data-viewing-as]").waitFor({ timeout: 30000 });
    const barText = (await pg.locator("[data-viewing-as]").innerText()).replace(/\s+/g, " ");
    check(new RegExp(`Viewing as ${U("kat")} · (60|59) min left`).test(barText), "the app as kat: Viewing as, the minutes left", barText);
    const bar = await pg.locator("[data-viewing-as]").evaluate((el) => getComputedStyle(el).backgroundColor);
    check(bar === "rgb(60, 110, 166)", "the Viewing as bar is #3c6ea6", bar);
    const started = (await pool.query(`SELECT text, user_id FROM admin_changes WHERE entity = 'person' AND entity_id = $1 AND action = 'act'`, [ids.kat])).rows;
    check(started.length === 1 && started[0].user_id === ids.desk, "its start is a line in kat's History, by the desk's admin");
    await fits("the app as kat");
    await shot("viewing-as");
    await pg.locator("[data-viewing-as-return]").click();
    await pg.waitForURL((u) => u.pathname === `/desk/person/${ids.kat}`, { timeout: 30000 });
    await pg.locator(`[data-desk-person='${U("kat")}']`).waitFor({ timeout: 20000 });
    check(new RegExp(`Back to your account · it's in ${U("kat")}'s History`).test(await toasted(/Back to your account/)), "a toast says it's in kat's History");
    const katHistory = await pg.locator("[data-history]").first().innerText();
    check(/Stopped acting as them · under a minute/.test(katHistory) && /Started acting as them/.test(katHistory), "Return: back on kat's page, its end in History", katHistory.replace(/\s+/g, " "));
    check((await pg.locator("[data-viewing-as]").count()) === 0, "and you're you again");
    await shot("act-returned");

    // Settings › Who gets in: the waiting list, Let in from it
    await pg.goto(`${BASE}/desk/settings`);
    await pg.locator("[data-desk-row='signups']").click();
    await pg.locator(`[data-signups-waiting] [data-let-in='${U("noor")}']`).waitFor({ timeout: 15000 });
    check((await pg.locator(`[data-signups-waiting] [data-waiting-row='${U("noor")}']`).innerText()).includes("Signed up"), "Who gets in lists who's waiting, with Let in");
    await fits("Who gets in");
    await shot("who-gets-in");
    await pg.locator(`[data-signups-waiting] [data-let-in='${U("noor")}']`).click();
    await toasted(/is in/);
    await pg.waitForFunction((u) => !document.querySelector(`[data-signups-waiting] [data-waiting-row='${u}']`), U("noor"), { timeout: 15000 });
    check((await userRow("noor")).approved === true, "Let in from Who gets in: noor is in, off the list");
    await closeSheet();

    // Settings
    await pg.goto(`${BASE}/desk/settings`);
    await pg.locator("[data-desk-row='confirm']").waitFor({ timeout: 20000 });
    const heads = await pg.locator("section h2").allInnerTexts();
    const want = ["People", "Results", "Our bot", "Rulebooks", "Changes", "Not on the desk yet"];
    check(want.every((h, i) => heads.map((x) => x.toLowerCase()).indexOf(h.toLowerCase()) === heads.map((x) => x.toLowerCase()).indexOf(want[0].toLowerCase()) + i), "Settings: grouped by the question you have", heads.join(" · "));
    check(/waiting/.test(await pg.locator("[data-desk-row='signups']").innerText()), "Who gets in says who's waiting");
    await fits("Settings");
    await shot("settings");
    const wasConfirm = (await settingNow("confirm_at")) ?? 2;
    if (wasConfirm !== 2) await as.desk.call("PUT", "/api/desk/settings", { confirmAt: 2 });
    await pg.reload();
    await pg.locator("[data-desk-row='confirm']").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-desk-row='confirm'] [data-off]").count()) === 0, "Sources to confirm at 2: no dot");
    await pg.locator("[data-desk-row='confirm']").click();
    await pg.locator("[data-confirm-at='3']").click();
    check(/Sources to confirm a result: 3/.test(await toasted(/Sources to confirm a result: 3/)), "a toast says what changed");
    check((await settingNow("confirm_at")) === 3, "stored: 3");
    await pg.locator("[data-desk-row='confirm'] [data-off]").waitFor({ timeout: 10000 });
    check(true, "off its recommended setting: a dot");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => !document.querySelector("[data-desk-row='confirm'] [data-off]"), null, { timeout: 15000 });
    check((await settingNow("confirm_at")) === 2, "the toast's Undo: back to 2, no dot");
    await pg.locator("[data-desk-row='confirm']").click();
    await pg.locator("[data-confirm-at='4']").click();
    await toasted(/Sources to confirm a result: 4/);
    await pg.locator("[data-desk-row='confirm'] [data-off]").waitFor({ timeout: 10000 });
    await pg.locator("[data-desk-row='confirm']").click();
    await pg.locator("[data-reset-recommended]").waitFor({ timeout: 10000 });
    await shot("settings-confirm-sheet");
    await pg.locator("[data-reset-recommended]").click();
    await toasted(/Sources to confirm a result: 2/);
    check((await settingNow("confirm_at")) === 2, "Reset to recommended: 2");
    await pg.locator("[data-desk-row='history']").click();
    await pg.locator("[role=dialog] [data-history-line]").first().waitFor({ timeout: 10000 });
    const hist = await pg.locator("[role=dialog] [data-history]").innerText();
    check(/Sources to confirm a result: 2 that agree/.test(hist) && /Sources to confirm a result: 4 that agree/.test(hist) && /undone/.test(hist), "Settings history: each change, the undone one marked", hist.replace(/\s+/g, " ").slice(0, 200));
    await shot("settings-history");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(450);

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    // Refusals it asks for: 403s and 404s, and Name and email's taken name (409).
    const bad = failed.filter((x) => !/^(403|404) /.test(x) && !/^409 \/api\/desk\/people\//.test(x));
    check(!errs.length && !bad.length, "no page errors or failed requests", [...errs, ...bad].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    // The settings it changes, as they were (History's Undo leaves a row behind, which down() takes).
    for (const k of SETTINGS) {
      const was = settingsBefore.find((r) => r.key === k);
      if (was) await pool.query("UPDATE app_settings SET value = $2 WHERE key = $1", [k, JSON.stringify(was.value)]);
      else await pool.query("DELETE FROM app_settings WHERE key = $1", [k]);
    }
    if (!keep) await down(pool);
    check((await pool.query(REAL_USERS)).rows[0].h === realBefore, "every real account is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
