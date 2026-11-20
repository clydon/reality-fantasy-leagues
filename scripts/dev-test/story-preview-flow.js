// Dev-only frames for the live preview's flow around its story (docs/design-round/preview-flow-spec.md, step 14 of
// docs/PLAN-preview-release.md): the wait, its slow line, every refusal, moments arriving in the progress strip, a moment that never
// came, a used link, an ended story, and the desk's Game previews row and sheet. Each is the real page at --width; the refusals and the
// slow wait are the real frame fed the server's own answers (the browser's route stands in for the server: no limit is really hit),
// and the never-made moment is the real story fed its own answer with its last moment's screens taken away. A zt_pv_ admin account
// signs in (made here, removed after); one real preview is made (the Survival pool) and closed.
//
//   node --env-file=.env.local scripts/dev-test/story-preview-flow.js [--width=390] [--out=.ui-atlas/stories/preview-flow] [--before]
//
// --before shoots only the wait and two refusals (with today's committed live-story.tsx swapped in by hand first: the story's
// "before" frames). Needs this lane's dev server (BASE, default http://localhost:3014) and its database; the browser reaches
// preview.localhost (any *.localhost is this machine). Prints each frame it wrote.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const BASE = process.env.BASE || "http://localhost:3014";
const PREVIEW = BASE.replace("://", "://preview.");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const WIDTH = Number(opt("width", "390"));
const BEFORE = args.includes("--before");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/preview-flow"), BEFORE ? "before" : "after");

/** The server's answers each refusal stands for (src/lib/server: their own statuses and words). */
const REFUSALS = [
  ["none-left", 429, "No previews left this week: more Monday."],
  ["busy", 503, "Busy: try again in a minute."],
  ["full", 503, "Previews are full this month: back on the 1st."],
  ["down", null, ""],
  ["off", 403, "Previews aren't open yet."],
  ["couch", 422, "Start or join a couch to preview a game"],
  ["season", 422, "No preview for this season: nothing can start here"],
  ["game", 422, "No preview for this game yet"],
  ["signin", 401, "Sign in first"],
  ["failed", 500, "The preview service couldn't make it."],
];

async function account(db) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID().replace(/-/g, ""), username = "zt_pv_" + id.slice(0, 8), password = "zt-pass-12345";
  await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, 'Pat', $2, true, $3, 'Pat', 'admin', now(), now())`, [id, username + "@example.invalid", username]);
  await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, await hashPassword(password)]);
  return { id, username, password };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const me = await account(db);
  let browser = null, storyId = null, context = null;
  const shot = async (page, name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    console.log("  " + path.relative(process.cwd(), file));
  };
  try {
    browser = await require("./browser").launch();
    context = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    // Next's development badge isn't the app's: hidden from the frames.
    const noBadge = () => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); });
    await context.addInitScript(noBadge);
    const page = await context.newPage();
    const r = await context.request.post(BASE + "/api/auth/sign-in/username", { data: { username: me.username, password: me.password }, headers: { origin: BASE } });
    if (!r.ok()) throw Error("sign-in failed " + r.status());
    const c = await context.request.post(BASE + "/api/couches", { data: { name: "zt-pv couch" }, headers: { origin: BASE } });
    if (!c.ok()) throw Error("couch failed " + c.status());

    // The wait, held open (the server's answer never comes until the frame is shot), then past 8 seconds.
    let release = () => {};
    await page.route("**/api/preview-live", (route) => new Promise((done) => (release = () => done(route.abort().catch(() => {})))));
    await page.goto(`${BASE}/start/preview-story/live?game=pool`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await shot(page, "1-wait");
    if (!BEFORE) {
      await page.waitForTimeout(8000);
      await shot(page, "2-wait-slow");
    }
    release();
    await page.unroute("**/api/preview-live");

    // Each refusal, as the server answers it.
    for (const [why, status, error] of BEFORE ? REFUSALS.filter(([w]) => w === "none-left" || w === "busy") : REFUSALS) {
      await page.route("**/api/preview-live", (route) => (status === null ? route.abort("connectionrefused") : route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error }) })));
      await page.goto(`${BASE}/start/preview-story/live?game=pool`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-live-making]:not([data-live-making=making])").waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      await shot(page, `3-refusal-${why}`);
      await page.unroute("**/api/preview-live");
    }
    if (BEFORE) return;

    // A real one: the story as it opens, moments still landing in the progress strip.
    await page.goto(`${BASE}/start/preview-story/live?game=pool`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-preview-story]").waitFor({ timeout: 120000 });
    storyId = new URL(page.url()).pathname.split("/").pop();
    await page.waitForTimeout(600);
    const coming = await page.locator("[data-progress-state=coming]").count();
    await shot(page, "4-story-arriving");
    console.log(`    moments still coming when it opened: ${coming}`);
    await page.locator("[data-progress-state=coming]").first().waitFor({ state: "detached", timeout: 120000 }).catch(() => {});

    // A moment that never came: the story's own answer with its last moment's screens taken away (simulated: no make failed).
    // (A second tab of the same browser, so the first stays open and the preview with it; the answer is changed in that tab as it
    // arrives.)
    const tab = await context.newPage();
    await tab.addInitScript((id) => {
      const real = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const res = await real(input, init);
        const url = typeof input === "string" ? input : input.url;
        if (!url.endsWith(`/api/preview-live/${id}`) || (init && init.method && init.method !== "GET") || !res.ok) return res;
        const body = await res.clone().json();
        const last = body.moments[body.moments.length - 1];
        last.screens = last.screens.map((s) => ({ ...s, path: null }));
        return new Response(JSON.stringify({ ...body, complete: true, failed: "stopped" }), { status: 200, headers: { "content-type": "application/json" } });
      };
    }, storyId);
    await tab.goto(page.url(), { waitUntil: "domcontentloaded" });
    await tab.locator("[data-preview-story]").waitFor({ timeout: 30000 });
    const n = await tab.locator("[data-progress]").count();
    await tab.locator("[data-progress]").nth(n - 1).click();
    await tab.waitForTimeout(800);
    await shot(tab, "5-story-never-made");

    // Someone else: a way in that's spent (or never was), and the story opened without its viewer's session.
    const stranger = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await stranger.addInitScript(noBadge);
    const sp = await stranger.newPage();
    await sp.goto(`${PREVIEW}/api/preview-live/enter?w=not-a-way-in&to=${encodeURIComponent(`/start/preview-story/live/${storyId}`)}`, { waitUntil: "domcontentloaded" });
    await sp.locator("[data-live-making=gone]").waitFor({ timeout: 15000 });
    console.log(`    a used link lands on ${new URL(sp.url()).pathname}`);
    await shot(sp, "6-link-used");
    await sp.goto(`${PREVIEW}/start/preview-story/live/${storyId}`, { waitUntil: "domcontentloaded" });
    await sp.locator("[data-live-making=gone]").waitFor({ timeout: 15000 });
    await shot(sp, "7-story-ended");
    await stranger.close();

    // The desk: Settings' People, its Game previews row, and its sheet.
    await page.goto(`${BASE}/desk/settings`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-desk-row=previews], [data=previews], button:has-text('Game previews')").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, "8-desk-settings");
    await page.locator("button:has-text('Game previews')").first().click();
    await page.locator("[data-previews-month]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, "9-desk-previews-sheet");
    // The same sheet near the budget (simulated: the settings' answer with the month at 85%).
    await page.route("**/api/desk/settings", async (route) => {
      const res = await route.fetch(), body = await res.json();
      body.settings.previews = { who: "everyone", month: { previews: 410, cpuMs: 0.85 * 3600000, budgetMs: 3600000 } };
      await route.fulfill({ response: res, json: body });
    });
    await page.goto(`${BASE}/desk/settings`, { waitUntil: "domcontentloaded" });
    await page.locator("button:has-text('Game previews')").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, "10-desk-near-budget");
    await page.locator("button:has-text('Game previews')").first().click();
    await page.locator("[data-previews-month]").waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, "11-desk-sheet-near-budget");
    // Past the budget, and the service not answering (simulated the same way).
    for (const [name, month] of [["12-desk-sheet-full", { previews: 512, cpuMs: 1.02 * 3600000, budgetMs: 3600000 }], ["13-desk-sheet-not-answering", null]]) {
      await page.unroute("**/api/desk/settings");
      await page.route("**/api/desk/settings", async (route) => {
        const res = await route.fetch(), body = await res.json();
        body.settings.previews = { who: "everyone", month };
        await route.fulfill({ response: res, json: body });
      });
      await page.goto(`${BASE}/desk/settings`, { waitUntil: "domcontentloaded" });
      await page.locator("button:has-text('Game previews')").first().click({ timeout: 30000 });
      await page.locator("[data-previews-month]").waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      await shot(page, name);
    }
  } finally {
    // Its owner closes the preview (its copies go with it), then the account.
    if (storyId && context) await context.request.delete(`${BASE}/api/preview-live/${storyId}`, { headers: { origin: BASE } }).catch(() => {});
    if (browser) await browser.close();
    await db.query(`DELETE FROM couches WHERE id IN (SELECT couch_id FROM couch_members WHERE user_id = $1 AND role = 'owner')`, [me.id]);
    await db.query(`DELETE FROM "user" WHERE id = $1`, [me.id]);
    await db.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
