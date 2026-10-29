// Dev-only check for the desk's people and its page frame (docs/PLAN-desk-parity.md step 1, part 1a), against this
// lane's dev server, on a fixture of its own (zt_dk_ people, a ZT DK couch with two games): Find › Browse, Find's search
// with "All N people matching", Find › People (search by name, username or email; Everyone · Waiting · Site admins ·
// Can't sign in; newest, last active, name; 25 at a time), a person's page in the frame (lower third, facts, couches and
// games as links, History), Back naming where you came from (a person › their couch › back › back to the list as it was),
// Recently opened, Settings regrouped (a dot off recommended, a toast with Undo, Reset to recommended, Settings history),
// and the Viewing as bar's colour (#3c6ea6).
//   1. Only site admins: zt_dk_kat (a player) is refused the people routes.
//   2. The list's API: filters, searches (username, name, email; a username-only account's stand-in email never shown or
//      matched; % and _ taken literally), sorts, paging, and a person's read.
//   3. Screens at --width: Find, People, a person, a couch, Settings and its sheets. Nothing wider than the screen; no
//      page errors.
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
    const state = { settings: { leagueTypeId: type, showId: "zt-dk-none", wikiSeason: "1" }, players: [{ id: "p1", name: U("kat") }, { id: "p2", name: U("c01") }] };
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
    const refused = await Promise.all([as.kat.call("GET", "/api/desk/people"), as.kat.call("GET", `/api/desk/people/${ids.kat}`), as.kat.call("GET", "/api/desk/find?q=zt")]);
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

    // the Viewing as bar: as c02 (no couch), on the desk's refusal
    const imp = await pg.request.post(`${BASE}/api/admin/users/${ids.c02}/impersonate`, { headers: { origin: BASE } });
    check(imp.ok(), "acting as c02 (classic's impersonation, until 1b)", String(imp.status()));
    await pg.goto(`${BASE}/desk`);
    await pg.getByText("Viewing as").waitFor({ timeout: 20000 });
    const bar = await pg.getByText("Viewing as").evaluate((el) => getComputedStyle(el.closest("div")).backgroundColor);
    check(bar === "rgb(60, 110, 166)", "the Viewing as bar is #3c6ea6", bar);
    await shot("viewing-as");
    const stop = await pg.request.post(`${BASE}/api/auth/admin/stop-impersonating`, { headers: { origin: BASE, "content-type": "application/json" }, data: {} });
    check(stop.ok(), "back to the desk's admin", String(stop.status()));

    const errs = d.errors.filter((e) => !/Failed to load resource/.test(e));
    const bad = failed.filter((x) => !/^(403|404) /.test(x));
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
