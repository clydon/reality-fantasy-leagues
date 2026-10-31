// Dev-only check that back goes where you came from inside a show (the user, 2026-10-30: a game opened from Tonight's "Your
// night", then back, landed on the hub), in a real browser against the dev server, as new-fixture.js's alex (results through
// Episode 5). Each step counts the browser's own history entries (the Navigation API), so a back that "works" by adding a
// page on top doesn't pass:
//   - Tonight › Your night › a game: the phone's back returns to Tonight;
//   - …then the Tonight tab returns to it too, with no second Tonight in the history; another tab after the jump, then back:
//     Tonight;
//   - …then the show bar's Home: the hub you came from (the entries the show added are passed over, none added);
//   - Tonight › "What happened in Episode 5": its page's back says Tonight and goes there; the phone's back too;
//   - an episode opened on the Episodes tab: its back says the tab's name and closes to the list;
//   - an episode page's game line, then back: the episode page;
//   - Tonight › Standings, then back: Tonight;
//   - opened straight from a link (a notification, a reload): the show's Home and an inner page's back take the page's place
//     rather than adding one, so the phone's back never returns to the page you left;
//   - with motion on: the same Home runs the Tune in's reverse, still to the hub you came from;
//   - no page errors.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-show-back.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local database. It shares
// the zt_nd_ fixture with the other check-new-* checks, so never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-show-back runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-show-back.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);
    const tonight = `/show/${sid}/tonight`;
    const isTab = (p) => /^\/show\/[^/]+\/(tonight|episodes|games|cast|chat)(\?|$)/.test(p);
    const missing = [];

    const session = async (motion) => {
      const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, motion });
      closers.push(b.close);
      // A failed load names its address (the console only says "404").
      b.page.on("response", (r) => r.status() >= 400 && missing.push(`${r.status()} ${new URL(r.url()).pathname}`));
      b.page.on("console", (m) => m.type() === "error" && /Failed to load/.test(m.text()) && missing.push(`at ${m.location()?.url ?? "?"}`));
      await b.page.context().addInitScript(() =>
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        })
      );
      const { page } = b;
      /** Where the history is: the page's path (and query) and its entry's place. */
      const at = () => page.evaluate(() => ({ path: location.pathname + location.search, index: navigation.currentEntry.index }));
      const settle = async (pathname) => {
        await page.waitForFunction((p) => location.pathname === p && !document.querySelector("[data-tune-in]"), pathname, { timeout: 15_000 });
        await page.waitForTimeout(500);
      };
      const nightLine = () => page.locator("[data-night-line]").first();
      const tab = (name) => page.locator('nav[aria-label="Show"] a', { hasText: name });
      const pageBack = () => page.locator('[role=dialog][aria-hidden=false] button').first();
      return { ...b, at, settle, nightLine, tab, pageBack };
    };

    // ---- the hub, then the show, as you'd get there ----
    const s = await session("off");
    const { page, BASE, at, settle, nightLine, tab, pageBack } = s;
    await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    await page.locator("[data-upnext] [data-upnext-open]").waitFor({ timeout: 30_000 });
    const hub = await at();
    await page.locator("[data-upnext] [data-upnext-open]").click();
    await settle(tonight);
    const show = await at();
    check(show.index === hub.index + 1, "the hub, then the show: one entry on top", JSON.stringify({ hub, show }));

    // ---- Tonight › Your night › a game, then back ----
    await nightLine().waitFor({ timeout: 30_000 });
    await nightLine().click();
    await settle(`/show/${sid}/games`);
    const game = await at();
    check(game.index === show.index + 1 && game.path.includes("game="), "Your night's game opens on the Games tab, on top of Tonight", JSON.stringify(game));
    await page.screenshot({ path: path.join(out, "1-game-from-tonight.png") });
    await page.goBack();
    await settle(tonight);
    check((await at()).index === show.index, "the phone's back from it: Tonight (the report)", JSON.stringify(await at()));

    // ---- …the Tonight tab instead: back to it, no second Tonight ----
    await nightLine().click();
    await settle(`/show/${sid}/games`);
    await tab("Tonight").click();
    await settle(tonight);
    check((await at()).index === show.index, "after the jump, the Tonight tab goes back to it (no second Tonight)", JSON.stringify(await at()));

    // ---- …another tab after the jump, then back: Tonight ----
    await nightLine().click();
    await settle(`/show/${sid}/games`);
    await tab("Episodes").click();
    await settle(`/show/${sid}/episodes`);
    check((await at()).index === show.index + 1, "another tab after the jump takes the jump's place", JSON.stringify(await at()));
    await page.goBack();
    await settle(tonight);
    check((await at()).index === show.index, "and back from it: Tonight", JSON.stringify(await at()));

    // ---- …the show bar's Home: the hub you came from ----
    await nightLine().click();
    await settle(`/show/${sid}/games`);
    await page.getByRole("button", { name: "Home" }).click();
    await settle("/home");
    check((await at()).index === hub.index, "Home after the jump: the hub you came from, nothing added on top", JSON.stringify({ now: await at(), hub }));

    // ---- Tonight › "What happened in Episode 5" ----
    await page.locator("[data-upnext] [data-upnext-open]").click();
    await settle(tonight);
    const again = await at();
    const what = page.getByRole("link", { name: /What happened in Episode 5/ });
    await what.waitFor({ timeout: 30_000 });
    await what.click();
    await page.waitForURL(`**/show/${sid}/episodes?page=ep5`);
    await pageBack().waitFor();
    await page.waitForTimeout(600);
    const label = (await pageBack().innerText()).trim();
    check(label === "Tonight", "the episode page opened from Tonight: its back says Tonight", label);
    await page.screenshot({ path: path.join(out, "2-episode-from-tonight.png") });
    await pageBack().click();
    await settle(tonight);
    check((await at()).index === again.index, "and goes there", JSON.stringify(await at()));
    await what.click();
    await page.waitForURL(`**/show/${sid}/episodes?page=ep5`);
    await page.waitForTimeout(600);
    await page.goBack();
    await settle(tonight);
    check((await at()).index === again.index, "the phone's back from it: Tonight too", JSON.stringify(await at()));

    // ---- an episode opened on the Episodes tab: back to the list ----
    await tab("Episodes").click();
    await settle(`/show/${sid}/episodes`);
    const list = await at();
    await page.locator('[data-ep="4"]').click();
    await page.waitForURL(`**/show/${sid}/episodes?page=ep4`);
    await pageBack().waitFor();
    await page.waitForTimeout(600);
    const listLabel = (await pageBack().innerText()).trim();
    const tabName = (await tab("Ep").or(tab("Sched")).or(tab("Week")).first().innerText().catch(() => "")).trim();
    check(listLabel !== "Tonight" && listLabel.length > 0 && (!tabName || listLabel === tabName), "an episode opened on the Episodes tab: its back says the tab's name", `${listLabel} / ${tabName}`);

    // ---- …its game line, then back: the episode page ----
    const gl = page.locator("[data-game-line]").first();
    await gl.waitFor({ timeout: 30_000 });
    await gl.click();
    await settle(`/show/${sid}/games`);
    await page.goBack();
    await page.waitForURL(`**/show/${sid}/episodes?page=ep4`);
    await page.waitForTimeout(600);
    check((await at()).index === list.index + 1, "an episode page's game line, then back: the episode page", JSON.stringify(await at()));
    await pageBack().click();
    await page.waitForFunction(() => !location.search.includes("page="), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    check((await at()).index === list.index && (await at()).path === `/show/${sid}/episodes`, "and its back closes it to the list", JSON.stringify(await at()));

    // ---- Tonight › Standings, then back ----
    await tab("Tonight").click();
    await settle(tonight);
    const before = await at();
    const standings = page.getByRole("link", { name: "Standings" });
    await standings.waitFor({ timeout: 30_000 });
    await standings.click();
    await settle(`/show/${sid}/games`);
    await page.goBack();
    await settle(tonight);
    check((await at()).index === before.index, "Tonight's Standings, then back: Tonight", JSON.stringify({ now: await at(), before }));

    // ---- opened straight from a link (a fresh tab: the page is the history's first entry): back takes its place ----
    const fresh = async (url) => {
      const p = await page.context().newPage();
      await p.goto(url, { waitUntil: "networkidle" });
      return p;
    };
    const entry = (p) => p.evaluate(() => ({ path: location.pathname + location.search, index: navigation.currentEntry.index, length: navigation.entries().length }));
    const deep = await fresh(`${BASE}/show/${sid}/games`);
    await deep.getByRole("button", { name: "Home" }).click();
    await deep.waitForFunction(() => location.pathname === "/home" && !document.querySelector("[data-tune-in]"), null, { timeout: 15_000 });
    const deepAt = await entry(deep);
    check(deepAt.index === 0 && deepAt.length === 1, "a show opened from a link: Home takes its place (back won't return to it)", JSON.stringify(deepAt));
    await deep.close();
    const inner = await fresh(`${BASE}/show/${sid}/waivers`);
    const showBack = inner.locator(".nd-showbar button").first();
    await showBack.waitFor({ timeout: 30_000 });
    await showBack.click();
    await inner.waitForFunction((p) => location.pathname.startsWith(p) && !location.pathname.endsWith("/waivers"), `/show/${sid}/`, { timeout: 15_000 });
    const innerAt = await entry(inner);
    check(innerAt.index === 0 && innerAt.length === 1 && isTab(innerAt.path), "an inner page opened from a link (Waivers): its back takes its place, on the show", JSON.stringify(innerAt));
    await inner.close();

    // ---- with motion on: Home runs the Tune in's reverse, to the hub you came from ----
    const m = await session("on");
    await m.page.goto(`${m.BASE}/home`, { waitUntil: "networkidle" });
    await m.page.locator("[data-upnext] [data-upnext-open]").waitFor({ timeout: 30_000 });
    const mHub = await m.at();
    await m.page.locator("[data-upnext] [data-upnext-open]").click();
    await m.settle(tonight);
    await m.nightLine().waitFor({ timeout: 30_000 });
    await m.nightLine().click();
    await m.settle(`/show/${sid}/games`);
    await m.page.getByRole("button", { name: "Home" }).click();
    const reverse = await m.page.locator('[data-tune-in="back"]').waitFor({ timeout: 2000 }).then(() => true, () => false);
    await m.settle("/home");
    check(reverse && (await m.at()).index === mHub.index, "motion on: Home after the jump runs the reverse, to the hub you came from", JSON.stringify({ reverse, now: await m.at(), hub: mHub }));

    // A fresh tab asks for /favicon.ico, which the dev server hasn't got (its console line doesn't say which address).
    const onlyFavicon = missing.every((x) => x.includes("favicon.ico"));
    const real = [...s.errors, ...m.errors].filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]|favicon\.ico/.test(e) && !(onlyFavicon && /Failed to load resource/.test(e)));
    check(real.length === 0, "no page errors", [...real.slice(0, 3), ...missing.slice(0, 5)].join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers.reverse()) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
