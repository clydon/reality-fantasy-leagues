// Dev-only check for keeping up with a show (src/lib/server/keep-up.ts, db/migrations/0141), against the dev server, on
// new-fixture.js's couch: alex plays the three Survivor games and doesn't follow "ZT Traitors 5" (weekly from 20 days ago, so
// three episodes have aired and ended; riley follows it through 2). Each Traitors episode is given a title here so the
// title rule shows.
//   API:
//   - the where stepper's episodes (/api/seasons/[id]/aired): every aired one with its air time, titles only as far as you've
//     seen, a sport's always; signed out, nobody's seen anything; a TV listing's (fake-listings.js) come with it;
//   - Live: a new follow of a season still airing starts at Ask (settings Round 2: nothing sent, keep_up 'ask'), the home and
//     the space ask "Seen it?" about Episode 3, Not yet stops it, moving where you are clears Not yet; auto: the home read moves
//     the mark to what's aired; refused on a season you play (409), and a bad value (400); off is always allowed; the bot clock's
//     backstop (advanceAllAuto) moves another person's auto mark;
//   - this season's own When results show (settings Round 2, A7): results "now" and "wait" saved and read back as the space's
//     you.results, null back to the account's, a bad value 400.
//   In a real browser at --width (390 by default), as alex: Tonight's Seen it? card (Not yet, then Seen it, show me); the show's
//   settings page (the gear's, ?page=you): Episodes you've watched opens Where you are (the ledger names each episode and when it
//   aired, I've watched them all sits above it, no Keep me live, a line says what happens as a new one airs, Save says "Through Ep
//   N on <show>" with Undo); When a new episode airs (Ask me first, Mark it watched asks before it turns on, Nothing; I've watched
//   them all moves only the mark); Your settings' When results show lists the show with what it does as a new episode airs and
//   opens its page (a show he plays isn't listed). Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
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
const { open, api, BASE } = require("./browser");
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
    // Nothing said about keeping up: a season still airing starts at Ask (the Recommended choice, so most never set it).
    const f1 = await alex.call("PUT", `/api/me/follows/${tsid}`, { following: true, seenThrough: 2 });
    check(f1.status === 200 && f1.body.keepUp === "ask" && f1.body.seenThrough === 2, "a new follow of a season still airing starts at Ask, with where he is", JSON.stringify(f1.body));
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

    // ---- this season's own When results show (the show's settings page; the guard reads it before the account's) ----
    for (const results of ["now", "wait"]) {
      const r = await alex.call("PUT", `/api/me/follows/${tsid}`, { results });
      const you = (await alex.call("GET", `/api/seasons/${tsid}/space`)).body?.you;
      check(r.status === 200 && r.body.results === results && you?.results === results, `results "${results}" saved, and the space reads it back`, JSON.stringify({ put: r.body, you: you?.results }));
    }
    const cleared = await alex.call("PUT", `/api/me/follows/${tsid}`, { results: null });
    check(cleared.status === 200 && cleared.body.results === null && (await alex.call("GET", `/api/seasons/${tsid}/space`)).body?.you?.results === null, "null: back to the account's choice", JSON.stringify(cleared.body));
    check((await alex.call("PUT", `/api/me/follows/${tsid}`, { results: "later" })).status === 400, "a bad results: 400");
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

      // The toast's words (and its Undo), once one matching `re` is up.
      const toasted = async (re) => {
        await page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15_000 }).catch(() => {});
        return ((await page.locator("[role=status]").textContent().catch(() => "")) || "").trim();
      };
      // A saved change reaches the database a moment after the tap.
      const until = async (fn, ms = 10_000) => {
        for (const end = Date.now() + ms; Date.now() < end; await page.waitForTimeout(250)) if (await fn()) return true;
        return false;
      };

      // ---- the show's settings page: Episodes you've watched opens Where you are ----
      // Where you are lives behind the gear since settings Round 2 (?page=you), its row saying how far he's watched, with the date.
      const openSettings = async () => {
        await page.goto(`${BASE}/show/${tsid}/tonight?page=you`);
        await page.locator(`[data-show-settings="${tsid}"]`).waitFor({ timeout: 30_000 });
      };
      await openSettings();
      const watchedRow = page.locator('[data-show-row="watched"]');
      // The air date comes with the episodes' read, a moment after the page.
      await page.waitForFunction(() => /· \w{3}, \w{3} \d+$/.test(document.querySelector('[data-show-row="watched"] [data-row-value]')?.textContent || ""), null, { timeout: 15_000 }).catch(() => {});
      const watchedValue = await watchedRow.locator("[data-row-value]").innerText();
      check(/^Through Ep 3 · \w{3}, \w{3} \d+$/.test(watchedValue), "the show's settings page: Episodes you've watched, through Ep 3 with its air date", watchedValue);
      await shot("show-settings");
      await fits("the show's settings page");
      await watchedRow.click();
      await sheet.locator("[data-where-ask]").waitFor({ timeout: 15_000 });
      await sheet.locator('[data-ledger-row="3"]').waitFor({ timeout: 15_000 });
      const row3 = (await sheet.locator('[data-ledger-row="3"]').innerText()).replace(/\n+/g, " | ");
      check(/ZT Title 3/.test(row3) && /\w{3}, \w{3} \d+/.test(row3), "the ledger names each episode he's seen and when it aired", row3);
      check((await sheet.locator('[data-setting="where-live"]').count()) === 0, "no Keep me live switch: what happens as a new one airs is the show page's");
      const airsLine = await sheet.locator("[data-where-airs]").innerText().catch(() => "none");
      check((await sheet.locator('[data-where-airs="ask"]').count()) === 1 && /Tonight asks if you've seen it/.test(airsLine) && /under the gear/.test(airsLine), "a line says what happens as a new one airs (he's on Ask), and where to change it", airsLine);
      check((await sheet.locator("[data-where-up-to-date]").count()) === 0, "up to date: no I've watched them all to offer");
      await sheet.locator('[data-ledger-row="2"]').click();
      // The ledger's one shortcut sits above it: the list scrolls in its own frame under it.
      const allBox = await sheet.locator("[data-where-up-to-date]").boundingBox();
      const ledgerBox = await sheet.locator("[data-ledger]").boundingBox();
      check(!!allBox && !!ledgerBox && allBox.y + allBox.height <= ledgerBox.y + 1, "stepping back to Ep 2: I've watched them all, above the ledger", JSON.stringify({ allBox, ledgerBox }));
      await shot("where-behind");
      await fits("the where sheet");
      await sheet.locator("[data-where-save]").click();
      const saved = await toasted(/Through Ep 2 on/);
      check(/Through Ep 2 on ZT Traitors/.test(saved) && /Undo/.test(saved), "Save: \"Through Ep 2 on\" the show, with Undo", saved);
      check(await until(async () => (await follow(fx.users.alex, tsid)).seen_through === 2), "saved on Ep 2");
      await page.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      await until(async () => (await follow(fx.users.alex, tsid)).seen_through === 3);
      const f3 = await follow(fx.users.alex, tsid);
      check(f3.seen_through === 3 && f3.keep_up === "ask", "Undo: back on Ep 3, still Ask", JSON.stringify(f3));

      // ---- When a new episode airs (Your settings' switch until settings Round 2; each show's own page now) ----
      await openSettings();
      const fold = page.locator('[data-fold="new-episode"]');
      await fold.waitFor({ timeout: 15_000 });
      check(/^Ask me if I've seen it$/.test(await fold.locator("[data-fold-value]").innerText()), "When a new episode airs: Ask (where his new follow started)", await fold.locator("[data-fold-value]").innerText());
      await fold.locator("button[aria-expanded]").click();
      const askChoice = fold.locator('[data-choice="keep-ask"]');
      await askChoice.waitFor({ timeout: 5000 });
      check((await askChoice.getAttribute("aria-checked")) === "true" && /recommended/i.test(await askChoice.innerText()), "opened: Ask me is picked, and Recommended");
      check((await fold.locator('[data-choice="keep-auto"]').count()) === 1 && (await fold.locator('[data-choice="keep-off"]').count()) === 1, "then Mark it watched and Nothing");
      await fold.locator('[data-choice="keep-auto"]').click();
      const ask = page.locator('[data-ask="auto"]');
      await ask.waitFor({ timeout: 5000 });
      check(/show as soon as it airs/.test(await ask.innerText()) && (await follow(fx.users.alex, tsid)).keep_up === "ask", "Mark it watched asks first (it can spoil the week he watches late), and nothing's changed yet", await ask.innerText());
      await ask.scrollIntoViewIfNeeded();
      await shot("new-episode-ask");
      await fits("the show's settings page, asking");
      await ask.locator("[data-ask-no]").click();
      check((await ask.count()) === 0 && (await follow(fx.users.alex, tsid)).keep_up === "ask", "Keep it as it is: the ask goes, still Ask");
      await fold.locator('[data-choice="keep-auto"]').click();
      await ask.locator("[data-ask-yes]").click();
      check(await until(async () => (await follow(fx.users.alex, tsid)).keep_up === "auto"), "Mark it watched: it moves along by itself");
      check(/marked watched as each one airs/.test(await toasted(/marked watched/)), "and the toast says so");
      await page.waitForFunction(() => /^Mark it watched$/.test(document.querySelector('[data-fold="new-episode"] [data-fold-value]')?.textContent || ""), null, { timeout: 10_000 }).catch(() => {});
      check((await fold.locator("[data-fold-value]").innerText()) === "Mark it watched", "the row says so", await fold.locator("[data-fold-value]").innerText());
      // Where you are says so too, with nothing about it to set there.
      await watchedRow.click();
      await sheet.locator('[data-where-airs="auto"]').waitFor({ timeout: 15_000 }).catch(() => {});
      check(/counts as watched as it airs/.test(await sheet.locator("[data-where-airs]").innerText().catch(() => "")) && (await sheet.locator('[data-setting="where-live"]').count()) === 0, "Where you are says each new one counts as watched as it airs");
      await page.keyboard.press("Escape");
      await sheet.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      await fold.locator('[data-choice="keep-off"]').click();
      check(await until(async () => (await follow(fx.users.alex, tsid)).keep_up === "off"), "Nothing: he moves it himself");
      // I've watched them all only moves the mark now (it used to turn Live on too).
      await watchedRow.click();
      await sheet.locator('[data-ledger-row="2"]').waitFor({ timeout: 15_000 });
      check(/nothing changes here until you move it/.test(await sheet.locator('[data-where-airs="off"]').innerText().catch(() => "")), "Where you are: nothing changes as a new one airs until he moves it");
      await sheet.locator('[data-ledger-row="2"]').click();
      await sheet.locator("[data-where-up-to-date]").click();
      check((await sheet.locator("[data-ledger-here]").getAttribute("data-ledger-here")) === "3" && (await sheet.locator("[data-where-up-to-date]").count()) === 0, "I've watched them all: the latest, and it goes");
      await sheet.locator("[data-where-save]").click();
      await toasted(/Through Ep 3 on/);
      await sheet.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      const f4 = await follow(fx.users.alex, tsid);
      check(f4.seen_through === 3 && f4.keep_up === "off", "saved: only the mark moved; When a new episode airs is still Nothing", JSON.stringify(f4));

      // ---- Your settings › When results show: the shows that move along, each a link to its own page ----
      await page.goto(`${BASE}/settings`);
      await page.locator('[data-group="results"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-group="results"]').click();
      const airs = page.locator(`[data-settings-airs] [data-airs-show="${tsid}"]`);
      await airs.waitFor({ timeout: 30_000 });
      check((await page.locator(`[data-airs-show="${sid}"]`).count()) === 0, "a show he plays isn't listed (it moves by his reveals)");
      check(/New episodes: you move it yourself/.test(await airs.innerText()), "the Traitors row says what it does as a new episode airs (Nothing, as just set)", (await airs.innerText()).replace(/\n+/g, " | "));
      check((await page.locator("[data-settings-auto], [data-auto-show], [data-auto-warn]").count()) === 0, "no switches here any more: it's set on the show's own page");
      await page.locator("[data-settings-airs]").scrollIntoViewIfNeeded();
      await shot("settings-airs");
      await fits("Settings › When results show");
      await airs.click();
      await page.locator(`[data-show-settings="${tsid}"]`).waitFor({ timeout: 20_000 }).catch(() => {});
      check((await page.locator(`[data-show-settings="${tsid}"]`).isVisible().catch(() => false)) && new URL(page.url()).searchParams.get("page") === "you", "and it opens that show's settings page", page.url());
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
