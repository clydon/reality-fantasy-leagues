// Dev-only check of show art and cast photos in the new design (docs/RESEARCH-show-art-and-cast-photos.md), against the dev
// server and the real TMDB (TMDB_READ_TOKEN in .env.local), on new-fixture.js's zt Survivor 51 couch:
//   1. The finder (src/lib/server/show-art.ts), run here outside a request, on the zt show pointed at Survivor's TMDB entry:
//      the show's poster, header image and logo, season 51's own poster, and the cast's photos by name, reaching every
//      linked league (the season's cast is approved).
//   2. What players see (alex): the show's tall header filled by the wide image, a compact bar (Backstage), the hub, and
//      Settings › Credits (TMDB's logo and notice, TVmaze, Wikimedia, "Ask for something to come down").
//   3. The desk (its own zt_nd_ admin): the show's Art section, Choose art (pick another header image: chosen by hand),
//      Back to automatic, and No art or photos (the art and found photos come down, in leagues too) and back on.
//   4. Nothing wider than the screen; no page errors; every real league's state as it was.
//
//   node scripts/dev-test/check-show-art-ui.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only. Refuses a non-local database.
// Screenshots go to <outDir> (keep it outside the repo: they show the fixture, not real data, but still).
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./new-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-show-art-ui runs against a local database only");
if (!process.env.TMDB_READ_TOKEN) throw new Error("TMDB_READ_TOKEN isn't in .env.local");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-show-art-ui.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const DESK = fixture.username("artdesk");
const SURVIVOR_TMDB = 14658;
const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";
const TMDB = /^https:\/\/image\.tmdb\.org\//;

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const realBefore = (await pool.query(REAL_LEAGUES)).rows;
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const { rows: showRows } = await pool.query("SELECT id FROM shows WHERE slug = 'zt-nd-survivor'");
    const showId = showRows[0].id;
    // Link every game's castaways to the season's cast, as real games are (that's how a season's photos reach them).
    const ids = new Map((await pool.query("SELECT id, name FROM season_cast WHERE season_id = $1", [sid])).rows.map((r) => [r.name, r.id]));
    for (const id of Object.values(fx.leagues)) {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [id]);
      for (const c of rows[0].state.castaways) if (ids.has(c.name)) c.seasonCastId = ids.get(c.name);
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [id, JSON.stringify(rows[0].state)]);
    }
    // The desk's admin, a zt_nd_ person (fixture.down removes them), on no couch.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`,
      [deskId, DESK, `${DESK}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);

    // ---- 1. the finder ----
    await pool.query("UPDATE shows SET tmdb_id = $2, art_url = NULL, art_by_hand = false WHERE id = $1", [showId, SURVIVOR_TMDB]);
    await pool.query("UPDATE season_cast SET photo_url = NULL WHERE season_id = $1", [sid]);
    const art = jiti("../../src/lib/server/show-art.ts");
    const found = await art.findArtForShow(showId);
    const { rows: [show] } = await pool.query("SELECT art_url, backdrop_url, logo_url FROM shows WHERE id = $1", [showId]);
    const { rows: [season] } = await pool.query("SELECT art_url FROM show_seasons WHERE id = $1", [sid]);
    const { rows: cast } = await pool.query("SELECT name, photo_url FROM season_cast WHERE season_id = $1", [sid]);
    check(TMDB.test(show.art_url ?? "") && TMDB.test(show.backdrop_url ?? "") && TMDB.test(show.logo_url ?? ""), "the show's poster, header image and logo, from TMDB");
    check(TMDB.test(season.art_url ?? ""), "season 51's own poster");
    const withPhoto = cast.filter((c) => TMDB.test(c.photo_url ?? ""));
    check(withPhoto.length >= cast.length * 0.6, `cast photos by name: ${withPhoto.length} of ${cast.length}`, cast.filter((c) => !c.photo_url).map((c) => c.name).join(", "));
    const { rows: [lg] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.lineup]);
    check(lg.state.castaways.some((c) => TMDB.test(c.photoUrl ?? "")), "the photos reached the games on the season");
    console.log(`      (found: ${JSON.stringify(found)})`);

    // ---- browsers ----
    const hide = (page) =>
      page.addInitScript(() => {
        addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
    let n = 0;
    const shot = async (page, name) => {
      await page.waitForTimeout(400);
      await Promise.race([settle(page), page.waitForTimeout(3000)]);
      await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
    };
    const fits = async (page, where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const imgSrc = (page, sel) => page.locator(sel).first().getAttribute("src").catch(() => null);

    // ---- 2. what players see ----
    const al = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(al.close);
    await hide(al.page);
    await al.page.goto(`${process.env.BASE || "http://localhost:3000"}/show/${sid}/tonight?couch=${fx.couchId}`);
    await al.page.locator(".nd-showbar").first().waitFor({ timeout: 60000 });
    check((await imgSrc(al.page, `.nd-showbar img[data-art]`)) === show.backdrop_url, "the show's header is the wide image");
    await shot(al.page, "show-header");
    await fits(al.page, "the show");
    await al.page.goto(`${process.env.BASE || "http://localhost:3000"}/show/${sid}/backstage/history?couch=${fx.couchId}`).catch(() => {});
    await al.page.waitForTimeout(1500);
    if (await al.page.locator(".nd-showbar").count()) await shot(al.page, "compact-bar");
    await al.page.goto(`${process.env.BASE || "http://localhost:3000"}/home?hub=focus`, { waitUntil: "load" });
    await al.page.locator("[data-art]").first().waitFor({ timeout: 60000 }).catch(() => {});
    check(await al.page.locator(`img[src="${season.art_url}"]`).count() > 0, "the hub's cards show the season's own poster");
    await shot(al.page, "hub");
    await al.page.goto(`${process.env.BASE || "http://localhost:3000"}/settings`, { waitUntil: "load" });
    await al.page.locator("[data-settings-help]").waitFor({ timeout: 60000 });
    await al.page.locator("[data-settings-help]").getByText("Credits", { exact: true }).click();
    await al.page.locator("[data-credits]").waitFor({ timeout: 10000 });
    const credits = (await al.page.locator("[data-credits]").textContent()) ?? "";
    check(/not\s+endorsed, certified, or otherwise approved by TMDB/.test(credits) && (await al.page.locator('[data-credit="tmdb"] img').count()) === 1, "Credits: TMDB's logo and notice");
    check(/TVmaze/.test(credits) && /Wikimedia Commons/.test(credits), "Credits: TVmaze and Wikimedia");
    await shot(al.page, "credits");
    await fits(al.page, "Credits");

    // ---- 3. the desk ----
    const d = await open({ user: DESK, pass: fixture.PASSWORD, width, height: 844 });
    closers.push(d.close);
    await hide(d.page);
    await d.page.goto(`${process.env.BASE || "http://localhost:3000"}/desk/show/${showId}`);
    await d.page.locator("[data-desk-art]").waitFor({ timeout: 60000 });
    await d.page.locator("[data-desk-art]").scrollIntoViewIfNeeded();
    await shot(d.page, "desk-art");
    await fits(d.page, "the desk's show");
    await d.page.locator("[data-art-choose]").click();
    await d.page.locator("[data-art-pick=backdrop]").first().waitFor({ timeout: 60000 });
    await shot(d.page, "choose-art");
    await fits(d.page, "Choose art");
    const backdrops = d.page.locator("[data-art-pick=backdrop]");
    check((await backdrops.count()) > 1, `Choose art offers header images (${await backdrops.count()})`);
    // Pick one that isn't the current one.
    const pickIdx = (await backdrops.first().getAttribute("aria-pressed")) === "true" ? 1 : 0;
    await backdrops.nth(pickIdx).click();
    await d.page.waitForTimeout(2500);
    const { rows: [picked] } = await pool.query("SELECT backdrop_url, art_by_hand FROM shows WHERE id = $1", [showId]);
    check(picked.art_by_hand && picked.backdrop_url !== show.backdrop_url, "a chosen header image is kept, chosen by hand");
    check((await backdrops.nth(pickIdx).getAttribute("aria-pressed")) === "true", "the chosen one is marked");
    await shot(d.page, "chosen");
    await d.page.locator("[data-art-automatic]").click();
    await d.page.waitForTimeout(4000);
    const { rows: [auto] } = await pool.query("SELECT backdrop_url, art_by_hand FROM shows WHERE id = $1", [showId]);
    check(!auto.art_by_hand && auto.backdrop_url === show.backdrop_url, "Back to automatic: the finder's pick again");

    await d.page.locator('[data-switch="art-off"]').click();
    await d.page.waitForTimeout(3500);
    const { rows: [off] } = await pool.query("SELECT art_off, art_url, backdrop_url FROM shows WHERE id = $1", [showId]);
    const { rows: offCast } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1 AND photo_url IS NOT NULL", [sid]);
    const { rows: [lgOff] } = await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.lineup]);
    check(off.art_off && !off.art_url && !off.backdrop_url, "No art or photos: the show's art is down");
    check(offCast[0].n === 0 && !lgOff.state.castaways.some((c) => TMDB.test(c.photoUrl ?? "")), "…and the found photos, in the games too");
    await d.page.locator("[data-desk-art]").scrollIntoViewIfNeeded();
    await shot(d.page, "art-off");
    await al.page.goto(`${process.env.BASE || "http://localhost:3000"}/show/${sid}/tonight?couch=${fx.couchId}`);
    await al.page.locator(".nd-showbar").first().waitFor({ timeout: 60000 });
    check((await al.page.locator(".nd-showbar img[data-art]").count()) === 0, "players see no art for it");
    await d.page.locator('[data-switch="art-off"]').click();
    await d.page.waitForTimeout(6000);
    const { rows: [on] } = await pool.query("SELECT art_off, backdrop_url FROM shows WHERE id = $1", [showId]);
    check(!on.art_off && TMDB.test(on.backdrop_url ?? ""), "switched back on: found again");

    // ---- 4. nothing real moved, no errors ----
    const realAfter = (await pool.query(REAL_LEAGUES)).rows;
    check(JSON.stringify(realAfter) === JSON.stringify(realBefore), "every real league's state is as it was");
    for (const [who, b] of [["alex", al], ["desk", d]]) {
      const errs = (b.errors ?? []).filter((e) => !/Failed to load resource/.test(e));
      check(!errs.length, `no page errors (${who})`, errs.join(" | "));
    }
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
