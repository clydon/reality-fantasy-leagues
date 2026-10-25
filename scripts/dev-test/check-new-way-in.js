// Dev-only check for the way in (docs/PLAN-new-design.md step 9 part 2), against the dev server, on new-fixture.js's
// couch ("ZT Survivor 51": alex, riley, jordan, sam) plus a curated zt show of its own for the catalog ("ZT Way In":
// season 7 airing with Episode 5 aired, season 8 premiering in 10 days) and the desk's admin, zt_nd_desk.
//   API:
//   - the catalog, signed out: on now and coming up first, ZT Way In's two seasons with how far each has aired, nothing
//     about any episode, a player's own show (the fixture's) left out, cached at the edge;
//   - who gets in (the desk's Settings › Who gets in, app_settings 'signups'): a sign-up waits (approve, the default), an
//     invite lets a waiting account in (invites), anyone gets in (open); refused bad values and non-admins; History;
//   - first run's save for a waiting account (its follows, where it is, never past what's aired; the new design's
//     cookie), and everything else refused while it waits (a couch, a join in approve mode);
//   - an email sign-up: no session until it's verified, then signed in.
//   In a real browser at --width (390 by default), signed out: the landing (its sections, Sign in, a show tile starting
//   first run with that show picked, Join with a code to the invite), first run (the wall, search, the step-10 Preview
//   for a show that isn't there, where you are with steppers, Save your shows with a username: no Google button without
//   GOOGLE_CLIENT_ID) ending on the list in approve mode and, with invites letting people in, joining the couch from there;
//   (a waiting account's /home goes to the list); first run with an email (check your email, verified, signed in, the
//   shows saved, Start a couch); the sign-in screen (/home signed out comes here, a wrong password, Forgot password,
//   signing in on to ?next=, signed in already: Open the app, never a ?next= elsewhere); the invite signed out (the couch
//   first, Make an account, where you are, waiting, then let in, joined); the desk's Who gets in. Nothing wider than the
//   screen; no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-way-in.js <outDir> [--width=390] [--keep] [--api]
//
// Sign-ups are zt_nd_wi_ usernames (new-fixture.js's down removes every zt_nd_ account) with @example.invalid emails, or
// a username alone (the app stores that one with a no-email.invalid stand-in). Refuses a non-local database, and a
// RESEND_API_KEY (it would try to send the sign-up emails). Puts Who gets in back as it found it. --api: the API half
// only; --keep leaves the fixture up. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-way-in runs against a local database only");
if (process.env.RESEND_API_KEY) throw new Error("check-new-way-in won't run with RESEND_API_KEY set: its sign-ups would be emailed");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-way-in.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const SHOW = "zt-wi-show";
const DESK = fixture.username("desk");
const wi = (who) => `zt_nd_wi_${who}`;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** A sign-up through Better Auth, as the screens make one: the response and any session cookie it set. */
async function signUp(username, email) {
  const r = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ name: username, username, email, password: PASSWORD }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function signIn(username) {
  const r = await fetch(BASE + "/api/auth/sign-in/username", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const dialog = (page) => page.locator("[role=dialog][data-open]");
const toastText = (page) => page.getByRole("status").last().innerText().catch(() => "");

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const userOf = async (name) => (await pool.query(`SELECT id, approved, "emailVerified" AS verified FROM "user" WHERE username = $1`, [name])).rows[0];
  const signupsWas = (await pool.query("SELECT value FROM app_settings WHERE key = 'signups'")).rows[0]?.value;
  const setMode = (mode) =>
    pool.query(`INSERT INTO app_settings (key, value, updated_at) VALUES ('signups', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(mode)]);
  const down = async () => {
    await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
    // Forgot password's tokens for zt accounts (Better Auth's verification rows name the account, with no foreign key).
    await pool.query(`DELETE FROM verification WHERE identifier LIKE 'reset-password:%' AND value IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_nd\\_%')`);
    if (signupsWas === undefined) await pool.query("DELETE FROM app_settings WHERE key = 'signups'");
    else await setMode(signupsWas);
  };
  let closers = [];
  try {
    const fx = await fixture.up(pool);
    await down();
    await setMode("approve");
    // The catalog's own show, curated (no maker) so the way in lists it.
    const show = (await pool.query(`INSERT INTO shows (slug, name) VALUES ($1, 'ZT Way In') RETURNING id`, [SHOW])).rows[0].id;
    const on = (
      await pool.query(
        `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, episode_count)
         VALUES ($1, 7, 'airing', current_date - 31, '20:00', 'America/New_York', 13) RETURNING id`,
        [show]
      )
    ).rows[0].id;
    const soon = (await pool.query(`INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time) VALUES ($1, 8, 'upcoming', current_date + 10, '20:00') RETURNING id`, [show])).rows[0].id;
    // The desk's admin (fixture.down removes them).
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [deskId]);
    const as = { alex: await api({ user: fixture.username("alex"), pass: PASSWORD }), desk: await api({ user: DESK, pass: PASSWORD }) };
    const code = (await as.alex.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code;
    check(/^[A-Z2-9]{6}$/.test(code || ""), "alex's invite code for ZT Survivor 51", code);

    // ---------- the catalog, signed out ----------
    const cat = await fetch(BASE + "/api/catalog");
    const seasons = (await cat.json()).seasons || [];
    const ours = (id) => seasons.find((s) => s.seasonId === id);
    check(cat.status === 200 && /public/.test(cat.headers.get("cache-control") || ""), "the catalog answers signed out, cached at the edge", cat.headers.get("cache-control"));
    check(ours(on)?.label === "ZT Way In 7" && ours(on).aired === 5 && ours(on).wall && ours(on).status === "airing", "ZT Way In 7: on now, Episode 5 aired, on the wall", JSON.stringify(ours(on)));
    check(ours(soon)?.aired === 0 && ours(soon).wall && ours(soon).status === "upcoming", "ZT Way In 8: coming up, nothing aired", JSON.stringify(ours(soon)));
    check(!seasons.some((s) => s.seasonId === fx.seasonId), "a player's own show (the fixture's ZT Survivor) isn't in it");
    const keys = new Set(seasons.flatMap((s) => Object.keys(s)));
    check([...keys].every((k) => ["seasonId", "show", "label", "season", "artUrl", "artPosition", "status", "premiere", "aired", "airsOn", "wall"].includes(k)), "nothing about any episode in it", [...keys].join());
    const rank = (s) => (s.status === "airing" ? 0 : s.status === "upcoming" ? 1 : 2);
    check(seasons.every((s, i) => !i || rank(seasons[i - 1]) <= rank(s)), "on now first, then coming up, then finished");

    // ---------- who gets in, and a waiting account ----------
    const ann = wi("ann");
    const made = await signUp(ann, `${ann}@example.invalid`);
    check(made.status === 200 && made.body.user?.emailVerified === false && !made.body.token, "an email sign-up makes the account with no session until it's verified", JSON.stringify(made.body).slice(0, 160));
    check((await signIn(ann)).status === 403, "it can't sign in before the link (EMAIL_NOT_VERIFIED)");
    await pool.query(`UPDATE "user" SET "emailVerified" = true WHERE username = $1`, [ann]);
    check((await userOf(ann)).approved === false, "approve (the default): it waits to get in");
    const A = await api({ user: ann, pass: PASSWORD });
    const meA = (await A.call("GET", "/api/me")).body;
    check(meA.user?.approved === false, "once verified it signs in, waiting (GET /api/me approved: false)");
    const fr = await A.call("POST", "/api/me/first-run", { follows: [{ seasonId: on, seenThrough: 3 }, { seasonId: soon, seenThrough: 2 }, { seasonId: "nope" }], ui: "new" });
    check(fr.status === 200 && fr.body.saved === 2, "a waiting account saves first run's shows", JSON.stringify(fr));
    const follows = (await pool.query(`SELECT season_id, seen_through, following, private FROM show_follows WHERE user_id = $1`, [(await userOf(ann)).id])).rows;
    const fOn = follows.find((f) => f.season_id === on);
    const fSoon = follows.find((f) => f.season_id === soon);
    check(fOn?.seen_through === 3 && fOn.following && !fOn.private && fSoon?.following && fSoon.seen_through === 2, "followed openly, with where it is in each", JSON.stringify(follows));
    check((await pool.query(`SELECT ui FROM user_settings WHERE user_id = $1`, [(await userOf(ann)).id])).rows[0]?.ui === "new", "and the new design is the one it opens on");
    check((await A.call("POST", "/api/couches", { name: "ZT Way" })).status === 403, "while it waits, starting a couch is refused");
    const j1 = await A.call("POST", "/api/couches/join", { code });
    check(j1.status === 403 && /Pending/.test(j1.body.error || ""), "approve: joining with an invite is refused too", JSON.stringify(j1));
    check((await as.alex.call("PUT", "/api/desk/settings", { signups: "invites" })).status === 403, "only a site admin changes who gets in");
    check((await as.desk.call("PUT", "/api/desk/settings", { signups: "everyone" })).status === 400, "a mode that isn't one is refused");
    const set = await as.desk.call("PUT", "/api/desk/settings", { signups: "invites" });
    check(set.status === 200 && set.body.settings.signups.mode === "invites" && set.body.settings.signups.waiting >= 1, "the desk: invites let people in (and who's waiting)", JSON.stringify(set.body.settings?.signups));
    check(set.body.history?.some((l) => l.text === "Who gets in: an invite lets people in, anyone else waits"), "History has it");
    const j2 = await A.call("POST", "/api/couches/join", { code });
    check(j2.status === 200 && j2.body.couchId === fx.couchId, "invites: the code lets ann in and onto the couch", JSON.stringify(j2));
    check((await userOf(ann)).approved === true, "ann's let in");
    check((await pool.query(`SELECT via FROM couch_members WHERE couch_id = $1 AND user_id = $2`, [fx.couchId, (await userOf(ann)).id])).rows[0]?.via === "couch", "on the couch in her own right");
    check((await as.desk.call("PUT", "/api/desk/settings", { signups: "open" })).body.settings?.signups.mode === "open", "the desk: anyone gets in");
    const bo = wi("bo");
    await signUp(bo, `${bo}@example.invalid`);
    check((await userOf(bo))?.approved === true, "open: a new account is let in as it's made");
    await as.desk.call("PUT", "/api/desk/settings", { signups: "approve" });
    const cy0 = wi("cy0");
    await signUp(cy0, `${cy0}@example.invalid`);
    check((await userOf(cy0))?.approved === false, "approve again: the next one waits");

    if (apiOnly) return;

    // ---------- the browser, signed out ----------
    const shot = async (page, name) => {
      // After a route change the screen cross-fades: wait for it (a skeleton's pulse never ends, hence the cap).
      await Promise.race([settle(page), page.waitForTimeout(3000)]);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `${name}.png`) });
    };
    const wide = async (page, where) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(w <= width + 1, `${where}: nothing wider than the screen`, `${w}`);
    };
    const fresh = async () => {
      const b = await open({ width, motion: "off" });
      closers.push(b.close);
      // What failed to load, by address: a page error from a refusal the check asks for is expected, any other isn't.
      b.failed = [];
      b.page.on("response", (r) => r.status() >= 400 && b.failed.push(`${r.status()} ${new URL(r.url()).pathname}`));
      await b.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
      return b;
    };

    // The landing.
    const L = await fresh();
    let p = L.page;
    await p.goto(`${BASE}/welcome`);
    await p.locator("[data-landing]").waitFor();
    check((await p.locator("h1").getAttribute("aria-label")) === "Turn any TV show into a game", "the landing's headline");
    check((await p.locator(".lp-sec").count()) === 6 && (await p.locator(".lp-final").count()) === 1, "a hero, six sections and the last call", `${await p.locator(".lp-sec").count()}`);
    check((await p.getByRole("link", { name: "Sign in" }).first().getAttribute("href")) === "/signin", "Sign in goes to the new sign-in");
    await shot(p, "01-welcome");
    await wide(p, "the landing");
    await p.locator("[data-lp-shows]").scrollIntoViewIfNeeded();
    await p.locator("[data-lp-shows] [data-pick='ZT Way In 7']").waitFor({ timeout: 15000 });
    check((await p.locator("[data-lp-shows] .lp-show").count()) === 4, "three show tiles from the catalog, and Any show");
    await shot(p, "02-welcome-shows");
    await p.locator("[data-lp-shows] [data-pick='ZT Way In 7']").click();
    await p.waitForURL(/\/start\/1$/);
    await p.locator("[data-show-wall] [data-pick='ZT Way In 7']").waitFor();
    check((await p.locator("[data-show-wall] [data-pick='ZT Way In 7']").getAttribute("aria-pressed")) === "true", "a show tile starts first run with that show picked");
    check((await p.locator("[data-next]").innerText()).toLowerCase().includes("1 picked"), "Next · 1 picked");
    await p.goto(`${BASE}/welcome`);
    await p.locator("[data-lp='code']").first().click();
    await dialog(p).locator("[data-code-input]").fill(code.toLowerCase());
    await dialog(p).getByRole("button", { name: "Find the couch" }).click();
    await p.waitForURL(new RegExp(`/join/${code}$`));
    check(true, "Join with a code goes to the couch's invite");
    check(L.errors.length === 0, "the landing: no page errors", L.errors.join(" | "));

    // First run, a username alone, approve mode: ends on the list; then invites let it join from there.
    const F = await fresh();
    p = F.page;
    await p.goto(`${BASE}/start/1`);
    await p.locator("[data-show-wall] [data-pick='ZT Way In 7']").waitFor();
    check((await p.locator("[data-show-wall] [data-pick]").count()) === seasons.filter((s) => s.wall).length, "the wall: every season on now or coming up");
    check(await p.locator("[data-next]").isDisabled(), "nothing picked: Pick at least one");
    await p.locator("[data-show-wall] [data-pick='ZT Way In 7']").click();
    await shot(p, "03-start-1");
    await p.locator("[data-search-shows]").click();
    await dialog(p).locator("[data-search-input]").fill("way in");
    await dialog(p).locator("[data-hit='ZT Way In 8']").waitFor();
    check((await dialog(p).locator("[data-hit]").count()) === 2, "search finds both ZT Way In seasons");
    await dialog(p).locator("[data-search-input]").fill("Not A Real Show Zz");
    await dialog(p).locator("[data-preview='start.add-show']").waitFor();
    check(true, "no match: Add a show, a Preview for step 10");
    await shot(p, "04-start-search");
    await dialog(p).locator("[data-search-input]").fill("way in 8");
    await dialog(p).locator("[data-hit='ZT Way In 8']").click();
    await dialog(p).waitFor({ state: "hidden" });
    check((await p.locator("[data-next]").innerText()).toLowerCase().includes("2 picked"), "a search pick joins the wall: 2 picked");
    await p.locator("[data-next]").click();
    await p.waitForURL(/\/start\/2$/);
    await p.locator("[data-where='ZT Way In 7']").waitFor();
    const line = (l) => p.locator(`[data-where='${l}'] [data-where-line]`).innerText();
    check((await line("ZT Way In 7")) === "Haven't started", "where you are starts at Haven't started");
    check((await p.locator("[data-where='ZT Way In 8'] [data-stepper]").count()) === 0 && /^Premieres \w+ \d+$/.test(await line("ZT Way In 8")), "a season not on yet: Premieres <date>, no stepper", await line("ZT Way In 8"));
    const later = p.getByRole("button", { name: "Later in ZT Way In 7" });
    for (let i = 0; i < 3; i++) await later.click();
    check((await line("ZT Way In 7")) === "Seen through Episode 3 of 5", "three in: Seen through Episode 3 of 5");
    for (let i = 0; i < 2; i++) await later.click();
    check((await line("ZT Way In 7")) === "Caught up through Episode 5" && (await later.isDisabled()), "never past what's aired: Caught up through Episode 5");
    await p.getByRole("button", { name: "Earlier in ZT Way In 7" }).click();
    await p.getByRole("button", { name: "Earlier in ZT Way In 7" }).click();
    await shot(p, "05-start-2");
    await p.locator("[data-next]").click();
    await p.waitForURL(/\/start\/3$/);
    await p.locator("[data-account-form]").waitFor();
    check((await p.locator("[data-saving]").innerText()).includes("2 shows"), "Save your shows: 2 shows and where you are in each");
    check((await p.locator("[data-google]").count()) === (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? 1 : 0), "Continue with Google only when its OAuth app is set up");
    await shot(p, "06-start-3");
    const cy = wi("cy");
    await p.locator("#acct-username").fill(cy);
    await p.locator("#acct-password").fill("short");
    await p.locator("[data-account-form] button[type=submit]").click();
    check((await p.locator("#acct-error").innerText()).includes("at least 8"), "a short password is caught before sending");
    await p.locator("#acct-username").fill(fixture.username("alex"));
    await p.locator("#acct-password").fill(PASSWORD);
    await p.locator("[data-account-form] button[type=submit]").click();
    await p.locator("#acct-error").filter({ hasText: "taken" }).waitFor();
    check(true, "a username someone has: That username's taken");
    await p.locator("#acct-username").fill(cy);
    await p.locator("[data-account-form] button[type=submit]").click();
    await p.waitForURL(/\/start\/4$/, { timeout: 20000 });
    await p.locator("[data-waiting]").waitFor();
    check(true, "made with a username: on to step 4, on the list (approve)");
    const cyRow = await userOf(cy);
    check(cyRow?.approved === false && cyRow.verified === true, "a username-only account: verified, waiting", JSON.stringify(cyRow));
    const cyFollows = (await pool.query(`SELECT season_id, seen_through FROM show_follows WHERE user_id = $1 ORDER BY seen_through DESC`, [cyRow.id])).rows;
    check(cyFollows.length === 2 && cyFollows.find((f) => f.season_id === on)?.seen_through === 3 && cyFollows.find((f) => f.season_id === soon)?.seen_through === 0, "its shows saved: ZT Way In 7 at 3, 8 at 0", JSON.stringify(cyFollows));
    check((await p.locator("[data-waiting] [data-choice='join']").count()) === 0, "approve: no way in with a code");
    await shot(p, "07-start-4-waiting");
    await p.goto(`${BASE}/home`);
    await p.waitForURL(/\/start\/4$/);
    check(true, "a waiting account's /home goes to the list");
    await setMode("invites");
    await p.reload();
    await p.locator("[data-waiting] [data-choice='join']").click();
    const boxes = dialog(p).locator("[data-code-boxes] input");
    await boxes.first().fill(code);
    await dialog(p).getByRole("button", { name: "Join" }).click();
    await p.waitForURL(new RegExp(`/join/${code}$`), { timeout: 20000 });
    await p.locator("[data-on-couch]").waitFor({ timeout: 20000 });
    check((await userOf(cy)).approved === true, "invites: the code from the list lets cy in, onto ZT Survivor 51");
    await shot(p, "08-start-joined");
    await wide(p, "first run");
    // The taken username is a 400 from Better Auth, asked for above.
    const unasked = F.failed.filter((f) => f !== "400 /api/auth/sign-up/email");
    check(unasked.length === 0 && F.errors.filter((e) => !/Failed to load resource/.test(e)).length === 0, "first run: no page errors", [...unasked, ...F.errors].join(" | "));

    // First run with an email, in open mode: check your email, verified, signed in, the shows saved, Start a couch.
    await setMode("open");
    const E = await fresh();
    p = E.page;
    await p.goto(`${BASE}/start/1`);
    await p.locator("[data-show-wall] [data-pick='ZT Way In 7']").click();
    await p.locator("[data-next]").click();
    await p.waitForURL(/\/start\/2$/);
    await p.getByRole("button", { name: "Later in ZT Way In 7" }).click();
    await p.locator("[data-next]").click();
    await p.waitForURL(/\/start\/3$/);
    const di = wi("di");
    await p.locator("#acct-username").fill(di);
    await p.locator("#acct-email").fill(`${di}@example.invalid`);
    await p.locator("#acct-password").fill(PASSWORD);
    await p.locator("[data-account-form] button[type=submit]").click();
    await p.locator("[data-check-email]").waitFor();
    check((await p.locator("[data-check-email]").innerText()).includes(`${di}@example.invalid`), "an email: Check <email> for a link");
    await shot(p, "09-start-check-email");
    check((await userOf(di))?.approved === true && (await userOf(di)).verified === false, "open: let in as it's made, the email still to verify");
    await pool.query(`UPDATE "user" SET "emailVerified" = true WHERE username = $1`, [di]);
    // The link signs in and comes back to /start/4; here, signing in with ?next= does the same.
    await p.goto(`${BASE}/signin?next=${encodeURIComponent("/start/4")}`);
    await p.locator("#signin-identifier").fill(di);
    await p.locator("#signin-password").fill(PASSWORD);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL(/\/start\/4$/);
    await p.locator("[data-people]").waitFor();
    await p.waitForFunction(() => !localStorage.getItem("gys.firstRun"), null, { timeout: 15000 });
    const diFollow = (await pool.query(`SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2`, [(await userOf(di)).id, on])).rows[0];
    check(diFollow?.seen_through === 1, "back signed in: the shows kept on this phone are saved (Episode 1)", JSON.stringify(diFollow));
    await shot(p, "10-start-4-people");
    await p.locator("[data-choice='new']").click();
    await dialog(p).locator("[data-couch-name]").fill("ZT Way Couch");
    await dialog(p).getByRole("button", { name: "Start the couch" }).click();
    await dialog(p).locator("[data-couch-made='ZT Way Couch']").waitFor();
    check(/^[A-Z2-9]{6}$/.test((await dialog(p).locator("[data-invite-code]").getAttribute("data-invite-code")) || ""), "Start a couch: made, with its code");
    await dialog(p).getByRole("button", { name: "Go to ZT Way Couch" }).click();
    await p.waitForURL(/\/home$/);
    check(true, "then the hub");
    check(E.errors.length === 0, "first run with an email: no page errors", E.errors.join(" | "));

    // The sign-in screen.
    const S = await fresh();
    p = S.page;
    await p.goto(`${BASE}/home`);
    await p.waitForURL(/\/signin$/);
    check(true, "/home signed out goes to the new sign-in");
    await p.locator("#signin-identifier").fill(fixture.username("alex"));
    await p.locator("#signin-password").fill("not-the-password");
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.locator("#signin-error").waitFor();
    check((await p.locator("#signin-error").innerText()) === "That username or password isn't right.", "a wrong password: plainly");
    await p.locator("[data-forgot]").click();
    await dialog(p).locator("[data-forgot-sheet]").waitFor();
    const reset = await dialog(p).locator("[data-forgot-sheet]").getAttribute("data-forgot-sheet");
    check(reset === "console", "Forgot password: local dev with no email set up writes the link to the console", reset);
    await dialog(p).locator("#reset-email").fill(`${fixture.username("alex")}@example.invalid`);
    await dialog(p).getByRole("button", { name: "Send the link" }).click();
    await dialog(p).locator("[data-reset-sent]").waitFor();
    check((await dialog(p).locator("[data-reset-sent]").innerText()).includes("If an account uses"), "the same answer whatever the email");
    await shot(p, "11-signin-forgot");
    await dialog(p).getByRole("button", { name: "Done" }).click();
    await dialog(p).waitFor({ state: "hidden" });
    await p.goto(`${BASE}/signin?next=${encodeURIComponent(`/join/${code}`)}`);
    await p.locator("#signin-identifier").fill(fixture.username("alex"));
    await p.locator("#signin-password").fill(PASSWORD);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL(new RegExp(`/join/${code}$`));
    check(true, "signing in goes on to ?next=");
    await p.goto(`${BASE}/signin?next=${encodeURIComponent("https://example.invalid/")}`);
    await p.locator("[data-signed-in]").waitFor();
    await shot(p, "12-signin-signed-in");
    await p.getByRole("button", { name: "Open the app" }).click();
    await p.waitForURL((u) => u.origin === BASE && !u.pathname.startsWith("/signin"));
    check(true, "signed in already: Open the app, and a ?next= elsewhere is ignored");
    check(S.errors.filter((e) => !/401|403/.test(e)).length === 0, "sign-in: no page errors", S.errors.join(" | "));

    // The invite, signed out: the couch, Make an account, where you are, waiting; then let in, joined.
    await setMode("approve");
    const I = await fresh();
    p = I.page;
    await p.goto(`${BASE}/join/${code}`);
    await p.locator("[data-invite-way-in]").waitFor();
    check((await p.locator("h1").innerText()).toLowerCase() === `${fixture.username("alex")} saved you a seat`.toLowerCase(), "signed out: the couch first, whose code it is");
    check((await p.locator("[data-join-game]").count()) === 3, "its three games, each with who may join");
    await shot(p, "13-invite");
    await p.locator("[data-join-couch]").click();
    await dialog(p).locator("[data-invite-account]").waitFor();
    check((await dialog(p).innerText()).includes("Free. Then you're on ZT Survivor 51."), "Make an account: Free. Then you're on ZT Survivor 51.");
    await shot(p, "14-invite-account");
    const ed = wi("ed");
    await dialog(p).locator("#acct-username").fill(ed);
    await dialog(p).locator("#acct-password").fill(PASSWORD);
    await dialog(p).locator("[data-account-form] button[type=submit]").click();
    await dialog(p).locator("[data-invite-where]").waitFor({ timeout: 20000 });
    check((await dialog(p).innerText()).toLowerCase().includes("where are you in zt survivor 51?"), "then: Where are you in ZT Survivor 51?");
    await dialog(p).getByRole("button", { name: "Later in ZT Survivor 51" }).click();
    await dialog(p).getByRole("button", { name: "Later in ZT Survivor 51" }).click();
    check((await dialog(p).locator("[data-where-line]").innerText()) === "Seen through Episode 2 of 5", "where you are: Seen through Episode 2 of 5");
    await shot(p, "15-invite-where");
    await dialog(p).locator("[data-where-go]").click();
    await p.locator("[data-waiting]").waitFor();
    check(true, "approve: you're on the list, open this invite again once you're in");
    const edRow = await userOf(ed);
    check((await pool.query(`SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2`, [edRow.id, fx.seasonId])).rows[0]?.seen_through === 2, "where ed is in ZT Survivor 51 is saved");
    check(!(await pool.query(`SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2`, [fx.couchId, edRow.id])).rows.length, "and ed isn't on the couch yet");
    await shot(p, "16-invite-waiting");
    await setMode("invites");
    await p.reload();
    await p.locator("[data-join-couch]").click();
    await dialog(p).locator("[data-where-go]").click();
    await p.locator("[data-on-couch]").waitFor({ timeout: 20000 });
    check((await userOf(ed)).approved === true, "invites: the invite lets ed in, onto the couch");
    check((await p.locator("[data-join-game]").count()) + (await p.locator("[data-join-season] button").count()) > 0, "and its games are his to join");
    await shot(p, "17-invite-joined");
    await wide(p, "the invite");
    check(I.errors.filter((e) => !/403/.test(e)).length === 0, "the invite: no page errors", I.errors.join(" | "));

    // The desk's Who gets in.
    const D = await open({ user: DESK, pass: PASSWORD, width, motion: "off" });
    closers.push(D.close);
    p = D.page;
    await p.goto(`${BASE}/desk/settings`);
    const row = p.getByRole("button", { name: /Who gets in/ });
    await row.waitFor();
    check((await row.innerText()).includes("Invites let people in"), "the desk's People › Who gets in: Invites let people in");
    await row.click();
    await dialog(p).locator("[data-signups='approve']").click();
    await dialog(p).waitFor({ state: "hidden" });
    await p.getByRole("button", { name: /Who gets in/ }).filter({ hasText: "You let each one in" }).waitFor();
    check(true, "switched back to You let each one in, from the sheet");
    await shot(p, "18-desk-who-gets-in");
    check(D.errors.length === 0, "the desk: no page errors", D.errors.join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    await down().catch((e) => console.error("down:", e));
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
