// Dev-only check for keeping up with a show (src/lib/server/keep-up.ts, db/migrations/0141), against the dev server, on
// new-fixture.js's couch: alex plays the three Survivor games and doesn't follow "ZT Traitors 5" (weekly from 20 days ago, so
// three episodes have aired and ended; riley follows it through 2). Each Traitors episode is given a title here so the
// title rule shows.
//   API:
//   - the where stepper's episodes (/api/seasons/[id]/aired): every aired one with its air time, titles only as far as you've
//     seen, a sport's always; signed out, nobody's seen anything; a TV listing's (fake-listings.js) come with it;
//   - Live: keepUp "ask" saved, the home and the space ask "Seen it?" about Episode 3, Not yet stops it, moving where you are
//     clears Not yet; auto: the home read moves the mark to what's aired; refused on a season you play (409), and a bad value
//     (400); off is always allowed; the bot clock's backstop (advanceAllAuto) moves another person's auto mark.
//   In a real browser at --width (390 by default), as alex: Tonight's Seen it? card (Not yet, then Seen it, show me), the where
//   sheet (each step names its episode and date, I'm up to date turns Live on, Keep me live), Settings' Move along by itself
//   (the spoiler warning before it turns on). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-keep-up.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a
// non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE, openFold } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-keep-up runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-keep-up.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  const headers = { "x-gys-listings": tv.url };
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tsid = fx.traitorsSeasonId;
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/traitors.jpg' WHERE slug = 'zt-nd-traitors'`);
    for (const n of [1, 2, 3]) {
      await pool.query(`INSERT INTO season_episodes (season_id, number, title, source) VALUES ($1, $2, $3, 'listing')`, [tsid, n, `ZT Title ${n}`]);
    }
    const alex = await api({ user: "zt_nd_alex", pass: PASSWORD, headers });
    const anon = (url) => fetch(BASE + url, { headers }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const follow = async (userId, seasonId) => (await pool.query("SELECT * FROM show_follows WHERE user_id = $1 AND season_id = $2", [userId, seasonId])).rows[0];
    const homeShow = async () => ((await alex.call("GET", "/api/me/home")).body.shows ?? []).find((s) => s.seasonId === tsid);

    // ---- the stepper's episodes ----
    const e0 = (await alex.call("GET", `/api/seasons/${tsid}/aired`)).body?.episodes ?? [];
    check(e0.length === 3 && e0.every((e) => e.airAt && e.title === null), "aired: three episodes with air times, no titles before he's seen any", JSON.stringify(e0));
    const signedOut = (await anon(`/api/seasons/${tsid}/aired`)).body?.episodes ?? [];
    check(signedOut.length === 3 && signedOut.every((e) => e.title === null), "signed out: the same, nobody's seen anything", JSON.stringify(signedOut));
    const listing = (await anon("/api/listings/990001")).body;
    check(listing?.episodes?.length === 3 && listing.episodes.every((e) => e.airAt && e.title === null), "a TV listing's aired episodes come with it (a competition: no titles)", JSON.stringify(listing?.episodes));

    // ---- Live ----
    const f1 = await alex.call("PUT", `/api/me/follows/${tsid}`, { following: true, seenThrough: 2, keepUp: "ask" });
    check(f1.status === 200 && f1.body.keepUp === "ask" && f1.body.seenThrough === 2, "Live saved with where he is", JSON.stringify(f1.body));
    const e1 = (await alex.call("GET", `/api/seasons/${tsid}/aired`)).body?.episodes ?? [];
    check(e1.map((e) => e.title).join() === "ZT Title 1,ZT Title 2,", "titles as far as he's seen", JSON.stringify(e1.map((e) => e.title)));
    await pool.query(`UPDATE shows SET kind = 'sport' WHERE slug = 'zt-nd-traitors'`);
    const e2 = (await alex.call("GET", `/api/seasons/${tsid}/aired`)).body?.episodes ?? [];
    check(e2.every((e) => e.title), "a sport's titles always (the matchups)", JSON.stringify(e2.map((e) => e.title)));
    await pool.query(`UPDATE shows SET kind = 'competition' WHERE slug = 'zt-nd-traitors'`);
    const h1 = await homeShow();
    check(h1?.keepUp === "ask" && h1.seenIt === 3, "the home asks Seen it? about Episode 3", JSON.stringify({ keepUp: h1?.keepUp, seenIt: h1?.seenIt }));
    const sp = (await alex.call("GET", `/api/seasons/${tsid}/space`)).body;
    check(sp?.you?.keepUp === "ask" && sp.you.seenIt === 3, "so does the space", JSON.stringify(sp?.you));
    await alex.call("PUT", `/api/me/follows/${tsid}`, { notYet: 3 });
    check((await homeShow())?.seenIt === null && (await follow(fx.users.alex, tsid)).not_yet === 3, "Not yet: it stops asking about Episode 3");
    await alex.call("PUT", `/api/me/follows/${tsid}`, { seenThrough: 3 });
    const f2 = await follow(fx.users.alex, tsid);
    check(f2.seen_through === 3 && f2.not_yet === null && f2.keep_up === "ask", "moving where he is answers it (Not yet cleared, still Live)", JSON.stringify(f2));

    // ---- auto ----
    await alex.call("PUT", `/api/me/follows/${tsid}`, { seenThrough: 1, keepUp: "auto" });
    const h2 = await homeShow();
    check(h2?.keepUp === "auto" && h2.seenThrough === 3 && h2.seenIt === null, "auto: the home read moves him to what's aired", JSON.stringify({ keepUp: h2?.keepUp, seen: h2?.seenThrough }));
    check((await follow(fx.users.alex, tsid)).seen_through === 3, "written to the one mark (show_follows.seen_through)");
    const played = await alex.call("PUT", `/api/me/follows/${sid}`, { keepUp: "ask" });
    check(played.status === 409, "refused on a season he plays", JSON.stringify(played));
    check((await alex.call("PUT", `/api/me/follows/${sid}`, { keepUp: "off" })).status === 200, "off is always allowed");
    check((await alex.call("PUT", `/api/me/follows/${tsid}`, { keepUp: "sometimes" })).status === 400, "a bad keepUp: 400");
    // The bot clock's backstop moves someone who hasn't opened the app.
    await pool.query(`UPDATE show_follows SET keep_up = 'auto' WHERE user_id = $1 AND season_id = $2`, [fx.users.riley, tsid]);
    const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
    const { advanceAllAuto } = jiti("../../src/lib/server/keep-up.ts");
    const moved = await advanceAllAuto(pool);
    check(moved >= 1 && (await follow(fx.users.riley, tsid)).seen_through === 3, "the bot clock moves riley's auto mark too", `${moved}`);

    if (!apiOnly) {
      // Back to Live, on Episode 2, for the browser.
      await pool.query(`UPDATE show_follows SET keep_up = 'ask', seen_through = 2, not_yet = NULL WHERE user_id = $1 AND season_id = $2`, [fx.users.alex, tsid]);
      const b = await open({ user: "zt_nd_alex", pass: PASSWORD, width, motion: "off", headers });
      await b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
      close = b.close;
      const page = b.page;
      let n = 0;
      const shot = async (name) => {
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where) => {
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
      };
      const sheet = page.locator("[role=dialog][data-open]");

      // ---- Tonight's Seen it? ----
      await page.goto(`${BASE}/show/${tsid}/tonight`);
      const card = page.locator("[data-seen-it]");
      await card.waitFor({ timeout: 30_000 });
      check(/Episode 3 just aired/.test(await card.innerText()), "Tonight: Episode 3 just aired, Seen it?", await card.innerText());
      await shot("seen-it");
      await fits("Tonight with Seen it?");
      await page.locator("[data-seen-it-not-yet]").click();
      await card.waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
      check((await card.count()) === 0 && (await follow(fx.users.alex, tsid)).not_yet === 3, "Not yet: the card goes, Episode 3 stays hidden");
      await pool.query(`UPDATE show_follows SET not_yet = NULL WHERE user_id = $1 AND season_id = $2`, [fx.users.alex, tsid]);
      await page.reload();
      await card.waitFor({ timeout: 30_000 });
      await page.locator("[data-seen-it-yes]").click();
      await card.waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
      check((await card.count()) === 0 && (await follow(fx.users.alex, tsid)).seen_through === 3, "Seen it, show me: he's on Episode 3");

      // ---- the where sheet ----
      await page.locator("[data-following] button").first().click();
      await sheet.locator("[data-where-ask]").waitFor({ timeout: 15_000 });
      await sheet.locator("[data-where-step]").waitFor({ timeout: 15_000 });
      const step3 = await sheet.locator("[data-where-step]").innerText();
      check(/^ZT Title 3 · \w{3}, \w{3} \d+$/.test(step3), "each step names its episode and when it aired", step3);
      check((await sheet.locator('[data-setting="where-live"]').getAttribute("data-on")) === "on", "Keep me live is on (he's Live)");
      await sheet.locator('[aria-label^="Earlier in"]').click();
      const step2 = await sheet.locator("[data-where-step]").innerText();
      check(/^ZT Title 2 · /.test(step2), "stepping back names Episode 2", step2);
      await sheet.locator('[data-setting="where-live"]').click();
      check((await sheet.locator('[data-setting="where-live"]').getAttribute("data-on")) === "off", "Keep me live switches off");
      await shot("where-behind");
      await fits("the where sheet");
      await sheet.locator("[data-where-up-to-date]").click();
      check(
        (await sheet.locator('[data-stepper] b').innerText()) === "3" && (await sheet.locator('[data-setting="where-live"]').getAttribute("data-on")) === "on",
        "I'm up to date: the latest, and Live back on"
      );
      check((await sheet.locator("[data-where-up-to-date]").count()) === 0, "and it goes once you're up to date");
      await shot("where-up-to-date");
      await sheet.locator("[data-where-save]").click();
      await sheet.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      const f3 = await follow(fx.users.alex, tsid);
      check(f3.seen_through === 3 && f3.keep_up === "ask", "saved: Episode 3, Live", JSON.stringify(f3));

      // ---- Settings: Move along by itself ----
      await page.goto(`${BASE}/settings`);
      // A fold under Everything else since the 2026-10-31 redesign: Shows that move along by themselves, shut, saying which.
      await page.locator('[data-fold="auto"]').waitFor({ timeout: 30_000 });
      check(/None: you move each one along/.test(await page.locator('[data-fold="auto"] [data-fold-value]').innerText()), "shut, its row says none move along by themselves yet");
      await openFold(page, "auto");
      const auto = page.locator(`[data-auto-show="${tsid}"]`);
      await auto.waitFor({ timeout: 30_000 });
      check((await page.locator(`[data-settings-auto] [data-auto-show="${sid}"]`).count()) === 0, "a show he plays isn't offered");
      check(/Live: asks/.test(await auto.innerText()), "the Traitors row says it's Live", await auto.innerText());
      await auto.locator('[role="switch"]').click();
      await page.locator("[data-auto-warn]").waitFor({ timeout: 5000 });
      check(/This can spoil it/.test(await page.locator("[data-auto-warn]").innerText()) && (await follow(fx.users.alex, tsid)).keep_up === "ask", "turning it on warns first, and nothing's changed yet");
      await page.locator("[data-auto-warn]").scrollIntoViewIfNeeded();
      await shot("settings-auto-warn");
      await fits("Settings");
      await page.locator("[data-auto-confirm]").click();
      await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("data-on") === "on", `[data-setting="auto-${tsid}"]`, { timeout: 15_000 }).catch(() => {});
      check((await follow(fx.users.alex, tsid)).keep_up === "auto", "Turn it on: it moves along by itself");
      await page.waitForFunction(() => !/None/.test(document.querySelector('[data-fold="auto"] [data-fold-value]')?.textContent || "None"), null, { timeout: 15_000 }).catch(() => {});
      check(!/None/.test(await page.locator('[data-fold="auto"] [data-fold-value]').innerText()), "and its row names the show", await page.locator('[data-fold="auto"] [data-fold-value]').innerText());
      await page.goto(`${BASE}/show/${tsid}/tonight`);
      await page.locator("[data-following] button").first().click();
      await sheet.locator("[data-where-auto]").waitFor({ timeout: 15_000 }).catch(() => {});
      check((await sheet.locator("[data-where-auto]").count()) === 1 && (await sheet.locator('[data-setting="where-live"]').count()) === 0, "the where sheet says so instead of offering Live");
      check(!b.errors.length, "no page errors", b.errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close();
    await tv.close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
