// Dev-only check of waivers that start when a phase of the season does (the user, 2026-10-31: "outlast waivers aren't meant to
// start until after merge"; WaiverLogic.startsAt, settings.waiverStartPhase), against the dev server, on new-fixture.js's couch
// (ZT Survivor 51: results through Episode 5; Survivor's rulebook: Tribes, then Merged). Its Outlast is set up as the couch's real
// one is: no replacements, windows only when the Commissioner opens one, nothing open. Added here: the desk's own admin
// (zt_nd_desk, site role admin, on no couch, as check-phase-starts.js makes one).
//   - Backstage › Waivers › Waivers settings, as alex (Commissioner): When they start, From the start or When Merged starts (never
//     Tribes, the first phase); choosing Merged saves it (Recent changes "Waivers start when Merged starts"), the plate says
//     waivers start when Merged starts, and nothing opens while nobody knows when that is.
//   - The players' Waivers page, Outlast: Nothing to do this week, "Waivers start when Merged starts"; How waivers work says
//     they stay on your team until then, then a window to replace everyone who's out.
//   - The desk confirms Merged began in Episode 5 (its results are in): the season's settle records it and the waiver clock
//     opens a window after Episode 5 that replaces everyone who's out (period.starts "merged", the windows' swap); alex sees it
//     open with someone to replace; sam (on Episode 3) still reads it as ahead, with nothing saying where.
//   - Back to From the start: the setting's gone.
//   Nothing wider than the screen, no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-waiver-start.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. It shares
// the zt_nd_ fixture with the other check-new-* checks, so never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-waiver-start runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-waiver-start.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const DESK = "zt_nd_desk";

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
    const L = fx.leagues;
    const q = `?couch=${fx.couchId}`;
    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on no couch.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);

    const as = {};
    for (const who of ["alex", "sam"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const state = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L.outlast])).rows[0].state;
    const admin = async () => (await as.alex.call("GET", `/api/seasons/${sid}/backstage/waivers${q}`)).body.games.find((g) => g.leagueId === L.outlast);
    const weekOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/waivers${q}`)).body.games.find((w) => w.leagueId === L.outlast);

    // ---- Outlast as the couch's real one: no replacements, windows only when opened, nothing open ----
    const set = await as.alex.call("POST", `/api/seasons/${sid}/backstage/waivers${q}`, { leagueId: L.outlast, action: "set", set: { replaceRule: "never", waiverWindows: { schedule: "manual", swaps: 1 } } });
    check(set.status === 200, "Outlast: no replacements, windows only when opened", `${set.status} ${JSON.stringify(set.body).slice(0, 160)}`);
    const s0 = await state();
    s0.midSeason.waivers = { periods: [] };
    await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [L.outlast, JSON.stringify(s0)]);
    await pool.query("DELETE FROM waiver_claims WHERE league_id = $1", [L.outlast]);
    const g0 = await admin();
    check(g0.start.phase === null && g0.start.phases.map((p) => p.id).join() === "merged", "When they start: from the start, or When Merged starts (never Tribes)", JSON.stringify(g0.start));
    const wrong = await as.alex.call("POST", `/api/seasons/${sid}/backstage/waivers${q}`, { leagueId: L.outlast, action: "set", set: { waiverStartPhase: "tribes" } });
    check(wrong.status === 400, "the first phase is refused", String(wrong.status));

    // ---- Backstage, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      })
    );
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    await page.goto(`${BASE}/show/${sid}/backstage/waivers`, { waitUntil: "networkidle" });
    const pick = page.locator('[data-bs-game="Outlast"]');
    if (await pick.count()) await pick.click();
    await page.locator("[data-bs-settings]").waitFor({ timeout: 30_000 });
    await page.locator("[data-bs-settings]").click();
    const starts = page.locator("[data-bs-start]");
    await starts.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    check((await starts.locator("[data-start]").evaluateAll((els) => els.map((e) => e.dataset.start).join())) === "start,merged", "the sheet: From the start, When Merged starts", await starts.innerText());
    check((await starts.locator('[data-start="start"]').getAttribute("aria-pressed")) === "true", "From the start is on");
    await shot("settings-from-the-start");
    await fits("Waivers settings");
    await starts.locator('[data-start="merged"]').click();
    await page.waitForFunction(() => document.querySelector('[data-start="merged"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 10_000 });
    await page.waitForTimeout(400);
    check(/Nothing before it\. Its first episode opens a window to replace everyone who's out/.test(await starts.locator('[data-start="merged"]').innerText()), "When Merged starts: nothing before it, its first episode opens a window", await starts.locator('[data-start="merged"]').innerText());
    await shot("settings-when-merged-starts");
    const s1 = await state();
    check(s1.settings.waiverStartPhase === "merged" && (s1.settings.game === undefined || s1.settings.game.extras.waivers.from?.phase === "merged"), "saved: settings.waiverStartPhase merged (and the spec it carries)", JSON.stringify(s1.settings.game?.extras?.waivers ?? null));
    check(s1.midSeason.waivers.periods.length === 0, "nothing opens while nobody knows when Merged starts");
    const change = (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at DESC LIMIT 1", [L.outlast])).rows[0]?.text ?? "";
    check(change === "Waivers start when Merged starts", "Recent changes: Waivers start when Merged starts", change);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const plate = await page.locator("[data-bs-plate]").innerText();
    check(/Waivers start when Merged starts, then a window to replace everyone who's out/.test(plate), "the plate: waivers start when Merged starts", plate.replace(/\n/g, " | "));
    check(/Starts with Merged/.test(await page.locator("[data-bs-settings]").innerText()), "Waivers settings' line: Starts with Merged");
    await shot("backstage-waiting");

    // ---- the players' Waivers page ----
    await page.goto(`${BASE}/show/${sid}/waivers?game=${L.outlast}`, { waitUntil: "networkidle" });
    const quiet = page.locator('[data-wv-week="quiet"]');
    await quiet.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    check(/Waivers start when Merged starts\. Your team plays as it is till then\./.test(await quiet.innerText()), "Waivers: nothing to do, Waivers start when Merged starts", (await quiet.innerText()).replace(/\n/g, " | "));
    const how = (await weekOf("alex")).how;
    check(/^They stay on your team until Merged starts\. After its first episode, a waiver window lets you replace everyone who's out\. After that, out is out\.$/.test(how.out), "How it works: until Merged starts, then a window to replace everyone", how.out);
    check(how.lanes.replace.every((on) => !on), "When moves happen: nothing yet");
    await shot("waivers-waiting");
    await fits("Waivers, waiting");

    // ---- the desk confirms Merged began in Episode 5: the window opens ----
    const rb = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body.rulebook?.id;
    const confirmed = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 5 });
    check(confirmed.status === 200, "the desk confirms Merged began in Episode 5", `${confirmed.status} ${JSON.stringify(confirmed.body).slice(0, 160)}`);
    const s2 = await state();
    const p = s2.midSeason.waivers.periods.at(-1);
    check(s2.phaseStarts?.merged === 5, "the season's settle records it on Outlast", JSON.stringify(s2.phaseStarts));
    check(!!p && p.episode === 5 && p.phase === "open" && p.window === true && p.replace === true && p.starts === "merged" && p.swaps === 1, "a window opens after Episode 5: replace everyone who's out, the windows' swap", JSON.stringify(p));
    const alexWeek = await weekOf("alex");
    check(alexWeek.stage === "open" && alexWeek.replace.length > 0 && alexWeek.how.starts === null, "alex: the week's open, with someone to replace", JSON.stringify({ stage: alexWeek.stage, replace: alexWeek.replace, starts: alexWeek.how.starts }));
    const samWeek = await weekOf("sam");
    check(samWeek.revealFirst === 5 && samWeek.how.starts === "Waivers start when Merged starts" && samWeek.how.lanes.replace.every((on) => !on), "sam (on Episode 3): reveal Episode 5 first, and nothing says where Merged starts", JSON.stringify({ revealFirst: samWeek.revealFirst, starts: samWeek.how.starts }));
    await page.goto(`${BASE}/show/${sid}/waivers?game=${L.outlast}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shot("waivers-merge-window");
    await fits("Waivers, the merge's window");

    // ---- back to From the start ----
    await page.goto(`${BASE}/show/${sid}/backstage/waivers`, { waitUntil: "networkidle" });
    if (await pick.count()) await pick.click();
    await page.locator("[data-bs-settings]").click();
    await starts.waitFor({ timeout: 10_000 });
    check(/Episode 5 opens a window/.test(await starts.locator('[data-start="merged"]').innerText()), "once it's known: Episode 5 opens a window", await starts.locator('[data-start="merged"]').innerText());
    await starts.locator('[data-start="start"]').click();
    await page.waitForFunction(() => document.querySelector('[data-start="start"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 10_000 });
    const s3 = await state();
    check(s3.settings.waiverStartPhase === undefined && (s3.settings.game === undefined || s3.settings.game.extras.waivers.from === undefined), "From the start: the setting's gone");

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]|favicon\.ico/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
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
