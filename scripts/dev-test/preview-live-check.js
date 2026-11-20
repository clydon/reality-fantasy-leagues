// Dev-only: the on-demand preview end to end (docs/PLAN-game-preview.md, "On demand"), as someone signed in would use it. A zt-pv-
// test account signs in on the app's own host, opens /start/preview-story/live?game=<game>, waits for the server to play the season,
// and steps through the story, shooting each card with its live phone (the real app on the preview host). It checks that the phone
// is signed in as the preview's own viewer while the account's own session is untouched, then closes the story (its copies go) and
// removes the account.
//
//   node --env-file=.env.local scripts/dev-test/preview-live-check.js [--game=pool|fantasy|sheet] [--create] [--out=.ui-atlas/stories/game-preview/live]
//
// Needs this lane's dev server (BASE, default http://localhost:3014) and its database; the browser reaches preview.localhost (any
// *.localhost is this machine).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
process.env.BASE = process.env.BASE || "http://localhost:3014";
const BASE = process.env.BASE;
const { Pool } = require("pg");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const GAME = opt("game", "pool");
// --create: at the last card, Create this game, as someone would: the preview kept while they make it (decision 6), the story's
// page closing leaves it, and asking for the same game again reopens it.
const CREATE = args.includes("--create");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/game-preview/live"));

async function account(db) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID().replace(/-/g, ""), username = "zt_pv_" + id.slice(0, 8), password = "zt-pass-12345";
  await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, 'Pat', $2, true, $3, 'Pat', now(), now())`, [id, username + "@example.invalid", username]);
  await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, await hashPassword(password)]);
  return { id, username, password };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const me = await account(db);
  let browser = null, page = null;
  const errors = [];
  try {
    browser = await require("./browser").launch();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const r = await page.context().request.post(BASE + "/api/auth/sign-in/username", { data: { username: me.username, password: me.password }, headers: { origin: BASE } });
    if (!r.ok()) throw Error("sign-in failed " + r.status());
    // A couch of their own: a preview reads the season as the couch the game would be made on sees it (preview-definition.ts).
    const c = await page.context().request.post(BASE + "/api/couches", { data: { name: "zt-pv couch" }, headers: { origin: BASE } });
    if (!c.ok()) throw Error("couch failed " + c.status());
    // The way into the story (used once), as the page is sent to it.
    let entered = null;
    page.on("request", (q) => { if (q.url().includes("/api/preview-live/enter")) entered = q.url(); });
    const t0 = Date.now();
    await page.goto(`${BASE}/start/preview-story/live?game=${GAME}`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(OUT, `${GAME}-0-making.png`) });
    await page.locator("[data-preview-story]").waitFor({ timeout: 120000 });
    const made = Math.round((Date.now() - t0) / 100) / 10;
    // The phone: the real app on the preview host, shown once its page says it's ready.
    const ready = async () => {
      await page.locator("[data-live-screen] iframe").first().waitFor({ timeout: 30000 });
      await page.locator("[data-live-loading]").first().waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3500);
    };
    await ready();
    const shown = Math.round((Date.now() - t0) / 100) / 10;
    // Who the story is (the preview host, as the preview's viewer), and who the account still is on the app's own host.
    const storyHost = new URL(page.url()).host;
    const phoneMe = await page.evaluate(async () => (await (await fetch("/api/me")).json()).user?.username ?? null).catch(() => null);
    const ownMe = await (await page.context().request.get(BASE + "/api/me")).json().then((j) => j.user?.username ?? null).catch(() => null);
    // Nobody else gets in: the way in a second time, and the story asked by a browser that isn't its viewer.
    // (A page of its own: the browser resolves preview.localhost, Node doesn't.)
    const stranger = await browser.newContext(), sp = await stranger.newPage();
    const again = entered ? (await sp.goto(entered).catch(() => null))?.status() ?? null : null;
    const storyId = new URL(page.url()).pathname.split("/").pop();
    const peek = await sp.evaluate(async (u) => (await fetch(u)).status, `${new URL(page.url()).origin}/api/preview-live/${storyId}`).catch(() => null);
    await stranger.close();
    console.log(`refused: the way in again ${again} (${again === 403 ? "used once" : "WRONG"}), the story to a stranger ${peek} (${peek === 401 || peek === 403 ? "refused" : "WRONG"})`);
    console.log(`made and shown at ${made} s, first phone ready at ${shown} s · the story is on ${storyHost} as ${phoneMe} (${phoneMe && phoneMe !== me.username ? "the preview's viewer" : "WRONG"}) · the app's own host is still ${ownMe} (${ownMe === me.username ? "the account's own" : "WRONG"})`);
    // Each card, each step of its path.
    const cards = await page.locator("[data-progress]").count();
    for (let k = 0; k < cards; k++) {
      const steps = await page.locator("[data-path] [role=tab]").count();
      for (let i = 0; i < steps; i++) {
        if (i) {
          await page.locator("[data-path] [role=tab]").nth(i).click();
          await ready();
        }
        const moment = await page.locator("[data-preview-story]").getAttribute("data-moment");
        const rings = await page.locator("[data-live-screen] [data-ring]").count();
        await page.screenshot({ path: path.join(OUT, `${GAME}-${k + 1}-${moment}${i ? `-s${i + 1}` : ""}.png`) });
        console.log(`  ${k + 1} ${moment} step ${i + 1}: ${rings} ring${rings === 1 ? "" : "s"}`);
      }
      if (k < cards - 1) {
        await page.locator("[data-next]").click();
        await ready();
      }
    }
    if (CREATE) {
      await Promise.all([page.waitForURL((u) => !u.host.startsWith("preview."), { timeout: 30000 }), page.locator("[data-create]").click()]);
      await page.waitForTimeout(2000);
      const [row] = (await db.query(`SELECT kept_until IS NOT NULL AS kept FROM live_previews WHERE id = $1`, [storyId])).rows;
      const again = await page.context().request.post(BASE + "/api/preview-live", { data: { game: GAME }, headers: { origin: BASE } });
      const body = await again.json().catch(() => ({}));
      console.log(`Create this game: on to ${new URL(page.url()).pathname} on the app's host; the preview ${row ? (row.kept ? "kept" : "there but not kept: WRONG") : "gone: WRONG"} after its page closed; asked again, ${body.reopened && body.id === storyId ? "reopened" : "WRONG " + JSON.stringify(body).slice(0, 120)}`);
      // The game made: its owner's close removes it either way.
      await page.context().request.delete(BASE + "/api/preview-live/" + storyId, { headers: { origin: BASE } });
    }
    if (errors.length) console.log("page errors:", errors.slice(0, 5));
  } finally {
    // Leaving closes the story (its copies go); then the account.
    if (page) {
      await page.goto(BASE + "/home").catch(() => {});
      await page.waitForTimeout(1500);
    }
    if (browser) await browser.close();
    await db.query(`DELETE FROM couches WHERE id IN (SELECT couch_id FROM couch_members WHERE user_id = $1 AND role = 'owner')`, [me.id]);
    await db.query(`DELETE FROM "user" WHERE id = $1`, [me.id]);
    await db.end();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
