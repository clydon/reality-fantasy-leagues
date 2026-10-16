// Dev-only test bank: screenshots every Waivers board (docs/PLAN-midseason-waivers.md, phase 2) at each
// point in the week, as the three people in waivers-fixture.js, in both leagues. Needs npm run dev.
//
//   node scripts/dev-test/check-waivers-ui.js <outDir> [width] [--dark] [--phase=open,claimed,processed,idle]
//                                             [--only=classic|roster] [--keep]
//
// For each phase it brings waivers-fixture.js up itself (so earlier phases' clicks never leak into
// later ones), then writes <outDir>/<phase>-<league>-<who>-<page>-<n>.png,
// phone-sized shots down the page (Studio unless --dark):
//   comm    Kim, the commissioner: the board (with Commissioner tools), League Settings › Waivers
//   player  Sam, owed a pickup: Overview's More tab and sheet (phones), the board (and its How waivers
//           work sheet), the pickup and add/drop pickers (the pickup picker tapped, then saved), free
//           agency, a past week's results; Research
//   comm    ...and (open phase) the Claim for sheet, then Nudge tapped for Josie
//   all     Overview first, every phase (phase 3): the alert strip's pickup item, the waivers status
//           plate, and once processed the "You got…" plate under the episode's Out plates
//   late    Josie, not revealed: the gated board; then (open phase) the reveal played to its last beat
//           (processed phase: revealed, Josie makes the week's add/drop in free agency, tapped through)
//           (Sam's too, open phase: their mark is put back to episode 2 for it, after their pages)
// Prints page errors. Takes the fixture down at the end unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./waivers-fixture");

const PASS = fixture.PASSWORD;
const USERS = { comm: "zt_wcomm", player: "zt_wplayer", late: "zt_wlate" };

function pagesFor(phase, league, who) {
  const base = "/waivers";
  const out = [["overview", "/"], ["board", base]];
  if (who === "comm") out.push(["settings", "/setup/waivers"]);
  if (who === "player") {
    if (league === "roster") out.push(["research", "/research"]);
    if (phase === "open" || phase === "claimed") out.push(["pickup", `${base}/pickup`], ["adddrop", `${base}/add-drop`]);
    if (phase === "processed") out.push(["fa", `${base}/free-agency`]);
    if (phase === "processed" || phase === "idle") out.push(["results", `${base}/results/3`]);
  }
  return out;
}

// Phone-sized shots down the page (-1, -2, ...): a full-page capture would stretch the viewport, and the
// fixed tab bar and the closed More sheet would land over the page's end.
async function shoot(page, file) {
  const h = page.viewportSize().height;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = h - 220;
  for (let i = 0, y = 0; i < 6; i++, y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${file}-${i + 1}.png` });
    if (y + h >= total) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-waivers-ui.js <outDir> [width] [--dark] [--phase=…] [--only=…] [--keep]");
  const width = parseInt(w, 10);
  const theme = flags.includes("--dark") ? "dark" : "light";
  const phases = ((flags.find((f) => f.startsWith("--phase=")) || "").slice(8) || "open,claimed,processed,idle").split(",");
  const only = (flags.find((f) => f.startsWith("--only=")) || "").slice(7);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    for (const phase of phases) {
      const made = await fixture.up(pool, [`--phase=${phase}`]);
      for (const who of ["comm", "player", "late"]) {
        const { page, errors, BASE, close } = await open({ user: USERS[who], pass: PASS, width });
        await page.addInitScript((t) => {
          localStorage.setItem("rfl.theme", t);
          localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
        }, theme);
        for (const { slug, leagueId } of made) {
          const league = slug.replace("zt-wv-", "");
          if (only && only !== league) continue;
          for (const [name, href] of pagesFor(phase, league, who)) {
            await page.goto(`${BASE}${href}?league=${leagueId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(900);
            const file = `${out}/${phase}-${league}-${who}-${name}`;
            await shoot(page, file);
            // The phone's More sheet from Overview: Waivers' row (Active Roster keeps it there), and the dot
            // on More while a claim is yours. -more-tab is the closed bar, -more the sheet.
            if (name === "overview" && who === "player" && width < 880) {
              // What's new, if it's up, sits over the tab bar.
              const go = page.locator("button", { hasText: /Let.s go!/ });
              if (await go.count()) await go.first().click();
              await page.waitForTimeout(400);
              await page.locator('[data-tour="tab-more"]').screenshot({ path: `${file}-more-tab.png` });
              await page.locator('[data-tour="tab-more"]').click();
              await page.waitForTimeout(500);
              await page.screenshot({ path: `${file}-more.png` });
            }
            // The pickup picker with two free agents tapped (one, shared), then saved: back on the board,
            // which now says the claims are in.
            if (name === "pickup" && phase === "open") {
              const tiles = page.locator('[data-tour="picker-tiles"] button');
              if ((await tiles.count()) >= 2) {
                await tiles.nth(0).click();
                await tiles.nth(1).click();
                await page.waitForTimeout(200);
                await page.screenshot({ path: `${file}-tapped.png` });
                await page.getByRole("button", { name: /^Save (claims|pickup)$/ }).click();
                await page.waitForURL((u) => !u.pathname.endsWith("/pickup"), { timeout: 10000 }).catch(() => {});
                await page.waitForTimeout(1200);
                await shoot(page, `${file}-saved`);
              }
            }
            // How waivers work, from the board.
            if (name === "board" && who === "player" && phase === "open") {
              await page.getByRole("button", { name: "How waivers work" }).first().click();
              await page.waitForTimeout(500);
              await page.screenshot({ path: `${file}-rules.png` });
              await page.locator('[role="dialog"] div.overflow-y-auto').first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
              await page.waitForTimeout(300);
              await page.screenshot({ path: `${file}-rules-end.png` });
              await page.keyboard.press("Escape");
            }
            // The commissioner's Claim for sheet.
            if (name === "board" && who === "comm" && phase === "open") {
              const btn = page.getByRole("button", { name: /^Claim for / }).first();
              if (await btn.count()) {
                await btn.click();
                await page.waitForTimeout(500);
                await page.screenshot({ path: `${file}-claimfor.png` });
                await page.keyboard.press("Escape");
              }
              await page.waitForTimeout(400);
              const nudge = page.getByRole("button", { name: "Nudge" }).first();
              if (await nudge.count()) {
                await nudge.click();
                await page.waitForTimeout(1200);
                await shoot(page, `${file}-nudged`);
              }
            }
          }
          // Free agency for real (processed phase): Josie, revealed now, makes the week's add/drop -- drops
          // their first castaway, adds the first free agent -- then the board shows it under "In free agency".
          if (who === "late" && phase === "processed") {
            await pool.query(
              `UPDATE league_memberships SET results_seen_through=3 WHERE league_id=$1 AND user_id=(SELECT id FROM "user" WHERE username=$2)`,
              [leagueId, USERS.late]
            );
            await page.goto(`${BASE}/waivers/free-agency?league=${leagueId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(900);
            await shoot(page, `${out}/${phase}-${league}-late-fa`);
            await page.getByRole("button", { name: /^Drop / }).first().click();
            await page.locator('[data-tour="picker-tiles"] button').first().click();
            await page.waitForTimeout(200);
            await page.screenshot({ path: `${out}/${phase}-${league}-late-fa-ready.png` });
            await page.getByRole("button", { name: "Add now" }).click();
            await page.waitForURL((u) => !u.pathname.endsWith("/free-agency"), { timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(900);
            await shoot(page, `${out}/${phase}-${league}-late-after-fa`);
          }
          // The reveal played through to its last beat ("Your move"): Josie's (an add/drop week), and, with
          // Sam's mark put back to episode 2 first, Sam's (the pickup for Jelly).
          if ((who === "late" || who === "player") && phase === "open") {
            if (who === "player") {
              await pool.query(
                `UPDATE league_memberships SET results_seen_through=2 WHERE league_id=$1 AND user_id=(SELECT id FROM "user" WHERE username=$2)`,
                [leagueId, USERS.player]
              );
            }
            await page.goto(`${BASE}/reveal/3?league=${leagueId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(900);
            for (let i = 0; i < 15; i++) {
              const next = page.getByRole("button", { name: "Show the next result" });
              if (!(await next.count())) break;
              await next.click({ position: { x: 20, y: 300 } });
              await page.waitForTimeout(450);
            }
            await page.screenshot({ path: `${out}/${phase}-${league}-${who}-reveal-last.png` });
          }
        }
        if (errors.length) console.log(`[${phase} ${who}] errors:`, errors.slice(0, 5));
        await close();
      }
      console.log(`[zt] ${phase} done`);
    }
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
