// Dev-only check for Backstage's Remind everyone (src/lib/server/backstage-remind.ts, the home's Reminders card), against
// the dev server, on new-fixture.js (three linked leagues on a zt Survivor 51, Episode 6 three days off, so lineups and
// picks for it are still open):
//   1. The API as alex (runs all three games): GET says who still has a move open (not alex), nobody reminded yet; POST
//      pushes each of them once and records one reminder_log row per (person, game) with kind "manual"; a second POST
//      sends nobody (the cooldown) and GET says they've all been reminded; a POST from before the cooldown's end stays
//      at zero. Players (sam) are refused; someone off the couch (casey) gets 404.
//   2. In a browser at --width as alex: Backstage's Reminders card counts the people and its button is yellow; after a
//      tap the toast says how many, the card says they've been reminded and the button is off. No page errors.
// Pushes go nowhere here (no push subscriptions on the fixture's accounts); the bell rows (notifications) are checked.
// Screenshots go to <outDir>.
//
//   npm run dev                                                      (in another terminal)
//   node scripts/dev-test/check-backstage-remind.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-backstage-remind runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-backstage-remind.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const q = `?couch=${fx.couchId}`;
    const leagueIds = [fx.leagues.outlast, fx.leagues.lineup, fx.leagues.pool];
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [
      [fx.users.alex, fx.users.riley, fx.users.jordan, fx.users.sam],
    ]);
    const logged = async () => (await pool.query("SELECT user_id, league_id, kind, episode_number FROM reminder_log WHERE league_id = ANY($1::uuid[]) ORDER BY user_id, league_id", [leagueIds])).rows;
    const bells = async () => (await pool.query("SELECT user_id, type FROM notifications WHERE user_id = ANY($1::text[]) AND type = 'reminder'", [Object.values(fx.users)])).rows;

    const as = {};
    for (const who of ["alex", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });

    // ---- 1. the API ----
    let r = await as.alex.call("GET", `/api/seasons/${sid}/backstage/remind${q}`);
    check(r.status === 200 && r.body.people >= 1 && r.body.recent === 0, "GET: people with a move open, none reminded yet", JSON.stringify(r.body));
    check(r.body.next?.number === 6 && !!r.body.next?.airAt, "GET: the next to air is Episode 6", JSON.stringify(r.body.next));
    const people = r.body.people;

    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/remind${q}`, {});
    check(r.status === 200 && r.body.sent === people && r.body.recent === people, `POST: reminded all ${people}`, JSON.stringify(r.body));
    const rows = await logged();
    check(rows.length >= people && rows.every((x) => x.kind === "manual" && x.episode_number === 6) && !rows.some((x) => x.user_id === fx.users.alex), "one reminder_log row per person and game, kind manual, episode 6, never alex", JSON.stringify(rows));
    // The push is sent after the response: give it a moment, then look for the bell rows.
    await new Promise((res) => setTimeout(res, 1500));
    const bell = await bells();
    check(new Set(bell.map((b) => b.user_id)).size === people, "each reminded person has the reminder in their bell", JSON.stringify(bell));

    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/remind${q}`, {});
    check(r.status === 200 && r.body.sent === 0 && r.body.recent === people, "a second POST inside the cooldown sends nobody", JSON.stringify(r.body));
    r = await as.alex.call("GET", `/api/seasons/${sid}/backstage/remind${q}`);
    check(r.body.recent === people && r.body.people === people, "GET: everyone's been reminded", JSON.stringify(r.body));

    // Past the cooldown, they're due again.
    await pool.query("UPDATE reminder_log SET sent_at = sent_at - interval '5 hours' WHERE league_id = ANY($1::uuid[]) AND kind = 'manual'", [leagueIds]);
    r = await as.alex.call("GET", `/api/seasons/${sid}/backstage/remind${q}`);
    check(r.body.recent === 0 && r.body.people === people, "GET after the cooldown: due again", JSON.stringify(r.body));
    // Put them back inside it for the browser part.
    await pool.query("UPDATE reminder_log SET sent_at = now() WHERE league_id = ANY($1::uuid[]) AND kind = 'manual'", [leagueIds]);

    r = await as.sam.call("POST", `/api/seasons/${sid}/backstage/remind${q}`, {});
    check(r.status === 403, "a player is refused", `${r.status}`);
    r = await as.casey.call("GET", `/api/seasons/${sid}/backstage/remind${q}`);
    check(r.status === 403 || r.status === 404, "someone off the couch can't read it", `${r.status}`);

    // ---- 2. the browser ----
    await pool.query("DELETE FROM reminder_log WHERE league_id = ANY($1::uuid[]) AND kind = 'manual'", [leagueIds]);
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page } = b;
    await page.goto(`${require("./browser").BASE}/show/${sid}/backstage`);
    const card = page.locator("[data-remind]");
    await card.waitFor({ timeout: 30000 });
    check((await card.getAttribute("data-people")) === String(people) && (await card.getAttribute("data-recent")) === "0", "the card counts the people with a move open", `${await card.getAttribute("data-people")}/${await card.getAttribute("data-recent")}`);
    const btn = page.locator("[data-remind-send]");
    check(!(await btn.isDisabled()) && /bg-chyron/.test((await btn.getAttribute("class")) || ""), "Remind them is on, and yellow");
    await page.screenshot({ path: path.join(out, "remind-before.png") });
    await btn.click();
    await page.waitForFunction((n) => document.querySelector("[data-remind]")?.getAttribute("data-recent") === String(n), people, { timeout: 15000 });
    check(true, "after the tap, the card says they've been reminded");
    check(await btn.isDisabled(), "Remind them is off until the cooldown passes");
    const toastText = await page.locator("[role=status], [data-toast]").allInnerTexts().catch(() => []);
    check(toastText.some((t) => new RegExp(`Reminded ${people}`).test(t)), "the toast says how many", toastText.join(" | "));
    await page.screenshot({ path: path.join(out, "remind-after.png") });
    check(!b.errors.length, "no page errors", b.errors.join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
