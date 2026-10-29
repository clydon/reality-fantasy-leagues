// Dev-only check for the desk's Inbox and Reports (docs/PLAN-desk-parity.md step 2), against this lane's dev server, on a
// fixture of its own (zt_di_ people, a ZT DI couch whose game nobody runs, ZT DI shows whose seasons air this week, one
// airing with no schedule and one with a cast not sent, two accounts waiting, and reports):
//   1. Only site admins: zt_di_jo (a player) is refused the reports routes.
//   2. The Inbox's API: Needs you most urgent first (a couch nobody runs, no schedule, a cast not sent, accounts waiting with
//      their faces, reports with when), the new words for a rulebook nobody checked and a show added by name (check-new-
//      library.js has those), Coming up (this week's episodes, soonest first, with how results come in: Autopilot, the
//      couches, a talk show's ticks) and the airing season with no schedule left out of it.
//   3. Reports through the API: the list (Open · Done, search by what it says or who sent it, % taken literally, 25 at a
//      time), a report's read (its title, where it was sent from, the sender, the game, season or couch it came from, Act
//      as off for a deleted account), Mark done and Reopen with History lines and Undo (refused once a later change stands),
//      what Report a problem now records (the device), Find's Browse line and search, the sender's page, and Delete.
//   4. A couch nobody runs: Hand on with nobody going, and its Undo putting it back in the Inbox.
//   5. Screens at --width: the Inbox (its tags, faces, Coming up and All N this week), each item opening its page with the
//      row to act on (the couch's Hand it on, the season's Setup page and its Cast row with their dots, People › Waiting, the report),
//      dealing with one clearing it from the Inbox and the tab's count, Find › Reports, a report's page (Mark done, Act as
//      the sender opening their page's sheet, Delete's hold). Nothing wider than the screen; no page errors.
//   6. Nothing real moved: every account that isn't zt_ is as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-inbox.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-inbox.js --down          (takes the fixture down, nothing else)
//
// up/down: zt_di_ accounts (their sessions, seats and couch rows), the ZT DI couch and its zt-di- game, the ZT DI shows and
// their seasons, the reports zt_di_ people sent (and the zt_di_left one with no account), and the admin_changes lines its
// desk admin makes; --keep leaves the fixture up. Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-inbox runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-inbox.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_di_${k}`;
const COUCH = "ZT DI Watchers";
const GAME = "ZT DI Pool";
// The shows: one airing on Autopilot, a talk show, one airing with nothing to say when, one whose cast isn't sent.
const SHOWS = [
  ["zt-di-show", "ZT DI Show", "competition"],
  ["zt-di-talk", "ZT DI Talk", "talk"],
  ["zt-di-nosched", "ZT DI Nosched", "competition"],
  ["zt-di-cast", "ZT DI Cast", "competition"],
];
const CROWD = 26;
const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  await pool.query(`DELETE FROM admin_changes WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_di\\_%')`);
  await pool.query(`DELETE FROM issue_reports WHERE username LIKE 'zt\\_di\\_%'`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-di-%'");
  await pool.query("DELETE FROM couches WHERE name = $1", [COUCH]);
  await pool.query("DELETE FROM shows WHERE slug = ANY($1)", [SHOWS.map((s) => s[0])]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_di\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const now = Date.now();
  const add = async (k, o = {}) => {
    const id = `zt-di-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, $5, $6, now())`,
      [id, U(k), `${U(k)}@zt-di.example.com`, o.role ?? null, o.approved ?? true, new Date(now - (o.age ?? 60 * 24 * 10) * 60000)]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    if (o.seen != null) await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, $2)", [id, new Date(now - o.seen * 60000)]);
  };
  await add("desk", { role: "admin" });
  await add("jo", { seen: 30 });
  await add("dana", { seen: 60 });
  await add("eli", { seen: 600 });
  await add("maya", { approved: false, age: 5 });
  await add("noor", { approved: false, age: 60 * 26 });

  // The shows and their seasons (each a game: set up). Show 1 airs in two days at 8 PM Eastern, on Autopilot; Talk 1
  // tomorrow at 11:30 PM; Nosched 1 is airing with nothing to say when; Cast 1 is upcoming with a cast nobody sent.
  for (const [slug, name, kind] of SHOWS) {
    const { rows } = await pool.query("INSERT INTO shows (slug, name, kind, created_by) VALUES ($1, $2, $3, $4) RETURNING id", [slug, name, kind, ids.desk]);
    ids[slug] = rows[0].id;
  }
  const season = async (slug, sql, params = []) => {
    const { rows } = await pool.query(`INSERT INTO show_seasons (show_id, season_number, ${sql[0]}) VALUES ($1, 1, ${sql[1]}) RETURNING id`, [ids[slug], ...params]);
    return rows[0].id;
  };
  ids.s1 = await season("zt-di-show", [
    "status, premiere_date, air_time, air_tz, release, bot_research_on, bot_research_since, bot_research_schedule",
    "'airing', current_date + 2 - 21, '20:00', 'America/New_York', 'weekly', true, now(), $2",
  ], [JSON.stringify([{ kind: "quick", after: 5, on: true }, { kind: "full", after: 60, on: true }])]);
  ids.talk = await season("zt-di-talk", ["status, premiere_date, air_time, air_tz, release", "'airing', current_date + 1 - 14, '23:30', 'America/New_York', 'weekly'"]);
  ids.nosched = await season("zt-di-nosched", ["status", "'airing'"]);
  ids.cast = await season("zt-di-cast", ["status", "'upcoming'"]);
  for (const [i, n] of ["Ada Example", "Bo Example", "Cy Example"].entries()) await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, $2, $3)", [ids.cast, n, i]);

  // The couch: jo, dana and eli are on it; its one game (a full Survival Pool on ZT DI Show 1) has dana and eli in it and
  // nobody running it (its only Commissioner's gone).
  const { rows: c } = await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.jo]);
  ids.couch = c[0].id;
  for (const [i, k] of ["jo", "dana", "eli"].entries())
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, joined_at) VALUES ($1, $2, $3, now() - make_interval(days => $4))", [ids.couch, ids[k], i ? "member" : "owner", 20 - i]);
  const s = S.defaultState();
  s.players = ["dana", "eli"].map((k, i) => ({ id: `p${i + 1}`, name: U(k), color: "#5089c9", disabled: false, active: true }));
  s.draftOrder = ["p1", "p2"];
  Object.assign(s.settings, { leagueTypeId: "pickem", showId: "zt-di-show", wikiSeason: "1" });
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[crypto.randomInt(31)]).join("");
  const { rows: l } = await pool.query("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ($1, 'zt-di-pool', $2, $3, $4, $5) RETURNING id", [
    GAME,
    code,
    S.migrateLeagueState(s),
    ids.jo,
    ids.couch,
  ]);
  ids.pool = l[0].id;
  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', 'member'), ($1, $3, 'p2', 'member')", [ids.pool, ids.dana, ids.eli]);

  // The reports: jo's problem from Settings on an iPhone, the installed app; jo's idea from Show 1's Cast tab; one from an
  // account deleted since, from the pool, done; and a crowd of done ones for paging.
  const report = async (o) => {
    const { rows } = await pool.query(
      `INSERT INTO issue_reports (user_id, username, league_id, league_name, type, message, route, sent_from, created_at, done_at, done_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [o.user ?? null, o.name, o.league ?? null, o.leagueName ?? null, o.type ?? "issue", o.message, o.route ?? null, o.from ? JSON.stringify(o.from) : null, new Date(now - (o.age ?? 0) * 60000), o.done ? new Date(now - 60000) : null, o.done ? ids.desk : null]
    );
    return rows[0].id;
  };
  ids.r1 = await report({ user: ids.jo, name: U("jo"), message: "Can't see my couch after switching phones. I got a new phone and signed in, and my couch is gone.\nMy games are still on the old phone.", route: "/settings", from: { device: "an iPhone", installed: true }, age: 60 * 20 });
  ids.r2 = await report({ user: ids.jo, name: U("jo"), type: "feature", message: "A recap card after each episode would be fun", route: `/show/${ids.s1}/cast`, age: 60 * 3 });
  ids.r3 = await report({ name: U("left"), league: ids.pool, leagueName: GAME, message: "Lineup didn't save on my phone", route: `/leagues/${ids.pool}`, age: 60 * 24 * 4, done: true });
  for (let i = 1; i <= CROWD; i++) await report({ user: ids.eli, name: U("eli"), message: `zt crowd report ${String(i).padStart(2, "0")}: 100% wrong_answer`, age: 60 * 24 * 5 + i, done: true });
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_di_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_USERS)).rows[0].h;
  const closers = [];
  try {
    const ids = await up(pool);
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD }), jo: await api({ user: U("jo"), pass: PASSWORD, headers: { "user-agent": iPhone } }) };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.jo.call("GET", "/api/desk/reports"),
      as.jo.call("GET", `/api/desk/reports/${ids.r1}`),
      as.jo.call("POST", `/api/desk/reports/${ids.r1}`, { done: true }),
      as.jo.call("DELETE", `/api/desk/reports/${ids.r1}`),
      as.jo.call("GET", "/api/desk/inbox"),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the reports routes and the Inbox", refused.map((r) => r.status).join(","));

    // ---- 2. the Inbox's API ----
    const inbox = async () => (await as.desk.call("GET", "/api/desk/inbox")).body;
    const ib = await inbox();
    const mine = (i) => /ZT DI|zt_di_/.test(`${i.title} ${i.line}`);
    const at = (kind, re = /./) => ib.items.findIndex((i) => i.kind === kind && mine(i) && re.test(`${i.title} ${i.line}`));
    const item = (kind, re) => ib.items[at(kind, re)];
    check(item("stranded")?.title === `Nobody runs ${COUCH}' games` && /Its only Commissioner has gone · 3 people waiting on results/.test(item("stranded").line) && item("stranded").href === `/desk/couch/${ids.couch}`, "a couch nobody runs, opening its page", JSON.stringify(item("stranded")));
    check(item("schedule")?.title === "ZT DI Nosched 1 is airing with no schedule" && item("schedule").href === `/desk/season/${ids.nosched}/setup`, "an airing season with no schedule, opening its Setup", JSON.stringify(item("schedule")));
    check(item("cast")?.title === "ZT DI Cast 1's cast isn't in its games" && /3 people, not approved · no games on it yet/.test(item("cast").line), "a cast not sent", JSON.stringify(item("cast")));
    const people = ib.items.find((i) => i.kind === "people");
    check(!!people && /accounts? waiting to get in/.test(people.title) && people.href === "/desk/people?f=waiting" && people.faces?.length >= 2 && people.faces.length <= 3, "accounts waiting: one item, up to three faces, to People › Waiting", JSON.stringify(people));
    check(people?.faces.slice(0, 2).map((f) => f.name).join() === `${U("maya")},${U("noor")}` || /zt_di_maya/.test(people?.line), "the newest waiting first", JSON.stringify(people?.faces));
    const r1 = item("report", /switching phones/);
    check(r1?.title === "Can't see my couch after switching phones" && r1.line === `From ${U("jo")} · Settings` && !!r1.at && r1.href === `/desk/report/${ids.r1}`, "a report: its first sentence, who and where, when", JSON.stringify(r1));
    check(item("report", /recap card/)?.line === `From ${U("jo")} · an idea`, "an idea says so");
    check(at("report", /Lineup didn't save/) === -1, "a done report isn't in the Inbox");
    const order = ["stranded", "schedule", "cast", "people", "report"].map((k) => (k === "people" ? ib.items.findIndex((i) => i.kind === "people") : at(k)));
    check(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), "most urgent first: couch, schedule, cast, people, reports", order.join(","));
    const firstQuiet = ib.items.findIndex((i) => !["split", "stale", "phase", "change"].includes(i.kind));
    check(ib.items.slice(firstQuiet).every((i) => !["split", "stale", "phase", "change"].includes(i.kind)), "disputes and what the couches split on lead");
    const show1 = ib.coming.find((c) => c.seasonId === ids.s1);
    const talk = ib.coming.find((c) => c.seasonId === ids.talk);
    check(show1?.how === "auto" && show1.line === "Autopilot: who went home, then full results" && show1.episode === 4 && show1.title === null, "Coming up: Show 1's Episode 4 on Autopilot", JSON.stringify(show1));
    check(talk?.how === "talk" && talk.line === "Couches tick what happened", "a talk show: the couches tick what happened", JSON.stringify(talk));
    check(ib.coming.every((c, i) => i === 0 || Date.parse(c.airAt) >= Date.parse(ib.coming[i - 1].airAt)) && ib.coming.indexOf(talk) < ib.coming.indexOf(show1), "soonest first", ib.coming.map((c) => c.season).join(","));
    check(ib.coming.every((c) => Date.parse(c.airAt) <= Date.now() + 7 * 864e5) && !ib.coming.some((c) => c.seasonId === ids.nosched || c.seasonId === ids.cast), "only this week, and no season with nothing to say when");
    check(ib.unscheduled.includes("ZT DI Nosched 1") && !ib.unscheduled.includes("ZT DI Cast 1"), "the airing season with no schedule is said under it (an upcoming one isn't)", JSON.stringify(ib.unscheduled));

    // ---- 3. reports through the API ----
    const list = async (o) => (await as.desk.call("GET", `/api/desk/reports?${new URLSearchParams(o)}`)).body;
    const open0 = await list({ q: "zt_di" });
    check(open0.total === 2 && open0.reports[0].id === ids.r2 && open0.reports[1].id === ids.r1, "Open, searched by who sent it: jo's two, newest first", JSON.stringify(open0.reports.map((r) => r.title)));
    check(open0.counts.open >= 2 && open0.counts.done >= CROWD + 1, "the chips' counts", JSON.stringify(open0.counts));
    const done1 = await list({ q: "zt", f: "done" });
    check(done1.total === CROWD + 1 && done1.reports.length === 25, `Done: ${CROWD + 1}, the first 25`, `${done1.total}/${done1.reports.length}`);
    const done2 = await list({ q: "zt", f: "done", offset: 25 });
    check(done2.reports.length === CROWD + 1 - 25 && !done2.reports.some((r) => done1.reports.some((x) => x.id === r.id)), "the next page: the rest, none twice");
    check((await list({ q: "switching phones" })).reports.map((r) => r.id).join() === ids.r1, "searched by what it says");
    check((await list({ q: "100%", f: "done" })).total === CROWD && (await list({ q: "1%0", f: "done" })).total === 0 && (await list({ q: "wrong_answer", f: "done" })).total === CROWD, "% and _ taken literally");
    const get = async (id) => (await as.desk.call("GET", `/api/desk/reports/${id}`)).body;
    const p1 = await get(ids.r1);
    check(p1.title === "Can't see my couch after switching phones" && p1.message.includes("My games are still on the old phone.") && !p1.idea && !p1.done, "a report's page: its title and their words, whole", JSON.stringify(p1.title));
    check(p1.sentFrom === "Sent from Settings on an iPhone · the installed app · the new design", "where it was sent from", p1.sentFrom);
    check(p1.sender?.id === ids.jo && p1.actOff === null && p1.couch?.id === ids.couch && !p1.game && !p1.season, "the sender, and their couch (Settings has no game)", JSON.stringify({ s: p1.sender, c: p1.couch }));
    check(p1.history.at(-1)?.text === `Sent by ${U("jo")}`, "History: sent by jo");
    const p2 = await get(ids.r2);
    check(p2.idea && p2.season?.id === ids.s1 && p2.season.screen === "Cast" && /^Sent from ZT DI Show 1 · Cast · the new design$/.test(p2.sentFrom), "an idea from a show's Cast tab: the season", `${p2.sentFrom} ${JSON.stringify(p2.season)}`);
    const p3 = await get(ids.r3);
    check(p3.sender === null && p3.actOff === "Their account was deleted" && p3.game?.leagueId === ids.pool && p3.game.couch?.id === ids.couch && p3.done && p3.doneBy === "you", "from an account deleted since: no Act as, the game it came from, done by you", JSON.stringify({ g: p3.game, a: p3.actOff }));
    check(/the classic design/.test(p3.sentFrom), "a classic screen says so", p3.sentFrom);
    check((await as.desk.call("GET", "/api/desk/reports/not-a-report")).status === 404, "no such report: 404");

    // Mark done, Reopen and their Undo
    const mark = (id, done) => as.desk.call("POST", `/api/desk/reports/${id}`, { done });
    const m1 = await mark(ids.r1, true);
    check(m1.status === 200 && m1.body.text === "Done · it leaves the Inbox" && !!m1.body.changeId, "Mark done", JSON.stringify(m1.body));
    check(!(await inbox()).items.some((i) => i.href === `/desk/report/${ids.r1}`), "it leaves the Inbox");
    check((await mark(ids.r1, true)).status === 409, "Mark done again: refused");
    check((await get(ids.r1)).history.some((h) => h.text === "Marked done" && h.undoable), "History: Marked done, with Undo");
    check((await undo(m1.body.changeId)).status === 200 && !(await get(ids.r1)).done && (await inbox()).items.some((i) => i.href === `/desk/report/${ids.r1}`), "Undo: open again, back in the Inbox");
    const m2 = await mark(ids.r1, true);
    const m3 = await mark(ids.r1, false);
    check(m3.status === 200 && m3.body.text === "Reopened · it's in the Inbox", "Reopen");
    check((await undo(m2.body.changeId)).status === 409, "Undo of the first, with a Reopen since: refused");
    check((await undo(m3.body.changeId)).status === 200 && (await get(ids.r1)).done, "Undo of the Reopen: done again");
    await mark(ids.r1, false);
    check((await mark(ids.r1, "yes")).status === 400, "done is true or false");

    // What Report a problem records now: the device from the user agent, the app saying it's installed.
    const sent = await as.jo.call("POST", "/api/reports", { type: "issue", message: "zt: sent from the app", route: "/home", installed: false });
    const sentRow = (await pool.query("SELECT id, sent_from FROM issue_reports WHERE username = $1 AND message = 'zt: sent from the app'", [U("jo")])).rows[0];
    check(sent.status === 200 && sentRow?.sent_from?.device === "an iPhone" && sentRow.sent_from.installed === false, "Report a problem records the device and how the app runs", JSON.stringify(sentRow?.sent_from));
    check((await get(sentRow.id)).sentFrom === "Sent from the hub on an iPhone · in the browser · the new design", "and its page says so");

    // Find: Browse's line and the search; the sender's page
    const browse = (await as.desk.call("GET", "/api/desk/find?q=")).body.browse;
    check(browse?.reports.open >= 3 && browse.reports.done >= CROWD + 1, "Find › Browse: Reports, open and done", JSON.stringify(browse?.reports));
    const found = (await as.desk.call("GET", "/api/desk/find?q=zt crowd")).body.reports;
    check(found?.reports.length === 3 && found.total === CROWD, `Find "zt crowd": three reports, of ${CROWD}`, JSON.stringify(found?.total));
    const jo = (await as.desk.call("GET", `/api/desk/people/${ids.jo}`)).body;
    check(jo.reports?.length === 3 && jo.reports.every((r) => !r.done), "jo's page: the reports jo sent", JSON.stringify(jo.reports?.map((r) => r.title)));

    // ---- 4. a couch nobody runs: Hand on with nobody going, and its Undo ----
    const cand = (await as.desk.call("GET", `/api/desk/hand-on?games=${ids.pool}`)).body;
    check(cand.candidates?.map((c) => c.name).join() === `${U("dana")},${U("eli")}`, "whoever plays it, most active first", JSON.stringify(cand.candidates?.map((c) => c.name)));
    const handed = await as.desk.call("POST", "/api/desk/hand-on", { from: null, moves: [{ leagueId: ids.pool, to: ids.dana }] });
    const roleOf = async (k) => (await pool.query("SELECT role FROM league_memberships WHERE league_id = $1 AND user_id = $2", [ids.pool, ids[k]])).rows[0]?.role;
    check(handed.status === 200 && (await roleOf("dana")) === "commissioner", "handed: dana runs it", JSON.stringify(handed.body));
    check(!(await inbox()).items.some((i) => i.kind === "stranded" && i.href === `/desk/couch/${ids.couch}`), "and the couch leaves the Inbox");
    const couchPage = (await as.desk.call("GET", `/api/desk/couches/${ids.couch}`)).body;
    check(couchPage.history.some((h) => h.id === handed.body.changeId && /^Handed ZT DI Pool on ZT DI Watchers to zt_di_dana$/.test(h.text) && h.undoable), "a line on the couch's History, with Undo", JSON.stringify(couchPage.history.map((h) => h.text)));
    check((await undo(handed.body.changeId)).status === 200 && (await roleOf("dana")) === "member", "Undo: nobody runs it again");
    check((await inbox()).items.some((i) => i.kind === "stranded" && i.href === `/desk/couch/${ids.couch}`), "and it's back in the Inbox");
    check((await as.desk.call("POST", `/api/desk/couches/${ids.couch}`, { hand: { leagueId: ids.pool, userId: ids.dana } })).status === 400, "the couch page's old Hand it to is gone");

    // A report sent from a mistyped show address never breaks a read (the route's season is cast only once it's a uuid).
    const { rows: bad } = await pool.query(
      "INSERT INTO issue_reports (user_id, username, type, message, route, done_at) VALUES ($1, $2, 'issue', 'zt: a mistyped address', '/show/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/cast', now()) RETURNING id",
      [ids.eli, U("eli")]
    );
    const badReads = await Promise.all([as.desk.call("GET", "/api/desk/inbox"), as.desk.call("GET", "/api/desk/reports?f=done&q=mistyped"), as.desk.call("GET", `/api/desk/reports/${bad[0].id}`)]);
    check(badReads.every((r) => r.status === 200) && badReads[1].body.total === 1 && badReads[2].body.season === null && badReads[2].body.sentFrom === "Sent from a show · the new design", "a mistyped show address: every read still works", badReads.map((r) => r.status).join(","));
    await pool.query("DELETE FROM issue_reports WHERE id = $1", [bad[0].id]);

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
    const shot = async (name) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const shotFull = async (name) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage: true });
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
    const tabCount = async () => Number((await pg.locator("[data-desk-tab='inbox'] i").textContent().catch(() => "0")) || 0);
    const toInbox = async () => {
      await pg.goto(`${BASE}/desk`);
      await pg.locator("[data-inbox]").waitFor({ timeout: 20000 });
    };
    const row = (kind, text) => pg.locator(`[data-inbox] [data-desk-item='${kind}']`, { hasText: text });

    // The Inbox
    await toInbox();
    const count0 = await tabCount();
    check(count0 === (await inbox()).items.length && count0 > 0, "the tab's count is what Needs you lists", String(count0));
    check(/couch/i.test(await row("stranded", COUCH).locator("span").first().innerText()), "the couch's row is tagged Couch");
    for (const [k, t, tag] of [["schedule", "ZT DI Nosched 1", /schedule/i], ["cast", "ZT DI Cast 1", /cast/i], ["report", "switching phones", /report/i]])
      check(tag.test(await row(k, t).locator("span").first().innerText()), `the ${k} row is tagged ${tag.source}`);
    check((await pg.locator("[data-inbox] [data-desk-item='people'] [data-face]").count()) >= 2, "accounts waiting: their faces");
    check(/yesterday|hours ago/.test(await row("report", "switching phones").innerText()), "a report says how long ago");
    await pg.locator("[data-coming]").waitFor({ timeout: 10000 });
    const weekText = await pg.locator("[data-coming]").innerText();
    check(/ZT DI Show 1/.test(weekText) && /Episode 4/.test(weekText) && /Autopilot: who went home, then full results/.test(weekText), "Coming up: Show 1, Episode 4, on Autopilot", weekText.replace(/\s+/g, " ").slice(0, 300));
    check(/ZT DI Talk 1/.test(weekText) && /Couches tick what happened/.test(weekText), "and the talk show");
    const ampm = await pg.locator(`[data-week-row='ZT DI Show 1'] b i`).innerText();
    check(/^(AM|PM)$/.test(ampm.trim()), "the time's AM or PM set small, apart from it", ampm);
    check(/ZT DI Nosched 1 (has|have) no schedule/.test(await pg.locator("[data-coming-unscheduled]").innerText()), "the season with no schedule is said under it");
    const shown = await pg.locator("[data-week-row]").count();
    const coming = (await inbox()).coming.length;
    if (coming > 5) {
      check(shown === 5, "five this week, then All N", String(shown));
      await pg.locator("[data-week-all]").click();
      check((await pg.locator("[data-week-row]").count()) === coming, `All ${coming} this week`);
    } else check(shown === coming && (await pg.locator("[data-week-all]").count()) === 0, "every one this week, no All N", `${shown}/${coming}`);
    await fits("the Inbox");
    await shotFull("inbox");

    // A couch nobody runs: its row opens the couch; Hand it on clears it here and from the tab's count
    await row("stranded", COUCH).click();
    await pg.locator("[data-hand-couch]").waitFor({ timeout: 20000 });
    check(/Nobody runs its games/.test(await pg.locator("[data-stranded]").innerText()) && (await back()) === "Inbox", "the couch: Nobody runs its games, with Hand it on; Back says Inbox", await back());
    await fits("a couch nobody runs");
    await shot("couch-nobody");
    await pg.locator("[data-hand-couch]").click();
    await pg.locator(`[data-hand-pick='${U("dana")}']`).waitFor({ timeout: 15000 });
    check(/Hand on ZT DI Pool/i.test(await pg.locator("[role=dialog]").last().innerText()), "the hand-on sheet names the game");
    await fits("the hand-on sheet");
    await shot("couch-hand-on");
    await pg.locator(`[data-hand-pick='${U("eli")}']`).click();
    await pg.locator("[data-hand-go]").click();
    check(new RegExp(`${U("eli")} runs ${GAME} now`).test(await toasted(/runs/)), "a toast says eli runs it now");
    await pg.locator("[data-stranded]").waitFor({ state: "detached", timeout: 15000 });
    check((await roleOf("eli")) === "commissioner", "eli is its Commissioner");
    await toInbox();
    check((await row("stranded", COUCH).count()) === 0 && (await tabCount()) === count0 - 1, "off the Inbox, and the tab's count is one less", `${await tabCount()} vs ${count0}`);

    // No schedule and a cast not sent: their seasons, each with the row to act on and its dot
    await row("schedule", "ZT DI Nosched 1").click();
    await pg.locator("[data-setup-none]").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-setup-classic]").getAttribute("href")) === `/admin/seasons/${ids.nosched}/setup`, "no schedule: its Setup, leading with No schedule yet, set in classic admin until 3b");
    check(/No schedule yet/.test(await pg.locator("[data-lower-third-name]").locator("..").innerText()), "its lower third says no schedule yet");
    await fits("a season with no schedule");
    await shot("setup-no-schedule");
    await pg.goto(`${BASE}/desk/season/${ids.nosched}`);
    await pg.locator("[data-desk-row='setup']").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-desk-row='setup'] [data-off='need']").count()) === 1 && (await pg.locator("[data-desk-row='setup']").getAttribute("href")) === `/desk/season/${ids.nosched}/setup`, "the season page's Setup row carries the dot and opens its Setup");
    await toInbox();
    await row("cast", "ZT DI Cast 1").click();
    await pg.locator("[data-desk-row='cast']").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-desk-row='cast'] [data-off='need']").count()) === 1 && /3 people, not sent to its games/.test(await pg.locator("[data-desk-row='cast']").innerText()), "a cast not sent: the season's Cast row, with its dot");
    await shot("season-cast");

    // Accounts waiting: People › Waiting
    await toInbox();
    await pg.locator("[data-inbox] [data-desk-item='people']").click();
    await pg.locator(`[data-waiting-row='${U("maya")}']`).waitFor({ timeout: 20000 });
    check((await pg.locator("[data-people-filter='waiting'][aria-pressed=true]").count()) === 1, "accounts waiting opens People › Waiting");

    // A report: its page, Mark done (off the Inbox and the count), Reopen, Act as jo
    await toInbox();
    const count1 = await tabCount();
    await row("report", "switching phones").click();
    await pg.locator("[data-desk-report='open']").waitFor({ timeout: 20000 });
    check(/a problem/i.test(await pg.locator("[data-lower-third-name]").innerText()) && /open/i.test(await pg.locator("[data-lower-third]").innerText()), "the report's lower third: Open, A problem");
    check((await pg.locator("[data-report-words]").innerText()).includes("My games are still on the old phone."), "their words, whole");
    check((await pg.locator("[data-report-from]").innerText()).trim() === "Sent from Settings on an iPhone · the installed app · the new design", "where it was sent from");
    check((await pg.locator("[data-desk-row='report-sender']").innerText()).includes(U("jo")) && (await pg.locator("[data-desk-row='report-couch']").innerText()).includes(COUCH), "From: jo, and their couch");
    check((await back()) === "Inbox", "Back says Inbox", await back());
    await fits("a report");
    await shotFull("report");
    await pg.locator("[data-report-done='done']").click();
    check(/Done · it leaves the Inbox/.test(await toasted(/Done/)), "Mark done: a toast says it leaves the Inbox");
    await pg.locator("[data-desk-report='done']").waitFor({ timeout: 15000 });
    await shot("report-done");
    await toInbox();
    check((await row("report", "switching phones").count()) === 0 && (await tabCount()) === count1 - 1, "off the Inbox, and the tab's count is one less", `${await tabCount()} vs ${count1}`);
    await pg.goto(`${BASE}/desk/report/${ids.r1}`);
    await pg.locator("[data-report-done='reopen']").click();
    await toasted(/Reopened/);
    await pg.locator("[data-desk-report='open']").waitFor({ timeout: 15000 });
    check(!(await get(ids.r1)).done, "Reopen: open again");
    await pg.locator("[data-report-act]").click();
    await pg.locator("[data-act-sheet]").waitFor({ timeout: 20000 });
    check(new URL(pg.url()).pathname === `/desk/person/${ids.jo}` && !pg.url().includes("act="), "Act as jo: jo's page with Act as open, the address clean", pg.url());
    await shot("report-act-as");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(450);
    check((await pg.locator("[data-person-reports] [data-desk-row='person-report']").count()) === 3, "jo's page: Reports they sent");
    await pg.goto(`${BASE}/desk/report/${ids.r3}`);
    await pg.locator("[data-desk-report='done']").waitFor({ timeout: 20000 });
    await pg.locator("[data-report-act]").click({ force: true });
    check(/Their account was deleted/.test(await toasted(/deleted/)) && new URL(pg.url()).pathname === `/desk/report/${ids.r3}`, "a deleted account's report: Act as says why, and stays");
    check((await pg.locator("[data-desk-row='report-game']").innerText()).includes(GAME), "From: the game it came from");

    // Find › Reports
    await pg.goto(`${BASE}/desk/find`);
    await pg.waitForFunction(() => /done/.test(document.querySelector("[data-desk-row='browse-reports']")?.textContent || ""), null, { timeout: 20000 });
    check(/open · \d+ done/.test(await pg.locator("[data-desk-row='browse-reports']").innerText()), "Browse: Reports, open and done", await pg.locator("[data-desk-row='browse-reports']").innerText());
    await pg.locator("[data-desk-row='browse-reports']").click();
    await pg.locator("[data-reports-list]").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-reports-filter='open'][aria-pressed=true]").count()) === 1 && (await back()) === "Find", "Reports opens on Open; Back says Find");
    await pg.locator("[data-reports-search]").fill("zt crowd");
    await pg.locator("[data-reports-empty]").waitFor({ timeout: 15000 });
    await pg.locator("[data-reports-other]").click();
    await pg.waitForFunction(() => document.querySelectorAll("[data-report-row]").length === 25, null, { timeout: 15000 });
    check(/Show 1 more/.test(await pg.locator("[data-reports-more]").innerText()), "Done, searched: 25, then Show 1 more", await pg.locator("[data-reports-more]").innerText());
    check(new URL(pg.url()).searchParams.get("f") === "done" && new URL(pg.url()).searchParams.get("q") === "zt crowd", "the search and filter are in the address");
    await fits("Find › Reports");
    await shot("reports-list");
    await pg.locator("[data-reports-more]").click();
    await pg.waitForFunction((n) => document.querySelectorAll("[data-report-row]").length === n, CROWD, { timeout: 15000 });
    await pg.locator("[data-report-row]").first().click();
    await pg.locator("[data-desk-report]").waitFor({ timeout: 20000 });
    check((await back()) === "Reports", "a report from the list: Back says Reports", await back());
    await pg.locator("[data-desk-back]").click();
    await pg.locator("[data-reports-list]").waitFor({ timeout: 20000 });
    check((await pg.locator("[data-reports-search]").inputValue()) === "zt crowd", "Back to the list as it was");

    // Delete, last: the hold, then gone
    await pg.goto(`${BASE}/desk/report/${ids.r2}`);
    await pg.locator("[data-delete-row='report'] button").waitFor({ timeout: 20000 });
    const last = await pg.evaluate(() => {
      const sections = [...document.querySelectorAll("section")];
      return sections[sections.length - 1]?.hasAttribute("data-delete-row");
    });
    check(last && /Delete this report/.test(await pg.locator("[data-delete-row='report']").innerText()), "Delete this report is the last thing on the page");
    await pg.locator("[data-delete-row='report'] button").click();
    await pg.locator("[data-report-delete]").waitFor({ timeout: 10000 });
    check(/goes for good/.test(await pg.locator("[data-report-delete]").innerText()) && (await pg.getByRole("button", { name: "Mark it done instead" }).count()) === 1, "its sheet: gone for good, Mark it done instead");
    await fits("the report's Delete");
    await shot("report-delete");
    const holdBox = await pg.locator("[data-hold]").boundingBox();
    await pg.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
    await pg.mouse.down();
    await pg.waitForTimeout(1800);
    await pg.mouse.up();
    check(/Report deleted/.test(await toasted(/deleted/)), "held: a toast says it's deleted");
    check(!(await pool.query("SELECT 1 FROM issue_reports WHERE id = $1", [ids.r2])).rows.length && (await as.desk.call("GET", `/api/desk/reports/${ids.r2}`)).status === 404, "the report is gone");
    check((await pool.query("SELECT 1 FROM admin_changes WHERE entity = 'report' AND entity_id = $1 AND action = 'delete'", [ids.r2])).rows.length === 1, "a line for the record");

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    // The one refusal it asks for on the screens: none (the 404s are the API's above).
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
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
