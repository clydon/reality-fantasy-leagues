// Dev-only test bank: a linked group under one name, the league strip and the swipe (docs/PLAN-league-tabs.md,
// build step 3). Needs npm run dev.
//
//   node scripts/dev-test/check-league-strip.js <outDir> [width] [--dark] [--name="Couch Crew"] [--keep]
//
// Brings linked-fixture.js up (Classic, Active Roster, Pool; --name gives the group a name, otherwise it goes
// by "Survivor 99"), signs in as its zt_tester, and walks the strip: Overview's header, a chip tap from slot 4
// (Team -> Lineup -> Pick), a chip tap on a page pushed on top (an episode stays put; Waivers falls back to
// the slot when the other game has none), and a real touch swipe, captured mid-drag so the pill can be seen
// between two chips. Prints the header, each chip (with "needs you" and which is open) and where each step
// landed; writes <outDir>/strip-<step>-<width>[-dark].png (the screen, not the whole page). At 880px and
// wider it captures the sidebar's plate and strip instead. Prints page errors. Takes the fixture down at the
// end unless --keep. Nothing here touches a real league: it's all zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error('usage: check-league-strip.js <outDir> [width] [--dark] [--name="Couch Crew"] [--keep]');
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const groupName = (flags.find((f) => f.startsWith("--name=")) || "").slice(7) || null;
  const desktop = width >= 880;
  const suffix = `${width}${dark ? "-dark" : ""}`;
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, { groupName });
    const [classic, roster, pool_] = made;
    // What's New marked read, so its sheet doesn't cover the header.
    const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
    await pool.query(
      `INSERT INTO user_settings (user_id, whats_new_seen) SELECT id, $2 FROM "user" WHERE username=$1
       ON CONFLICT (user_id) DO UPDATE SET whats_new_seen = $2`,
      [fixture.USERNAME, LATEST_RELEASE_ID]
    );
    const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    const chrome = desktop ? "aside" : "header";

    async function settle() {
      await page.waitForTimeout(700);
      const go = page.locator("button", { hasText: /Let.s go!/ });
      if (await go.count()) await go.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    async function report(step) {
      const said = await page.evaluate((sel) => {
        const box = document.querySelector(sel);
        const head = box?.querySelector(sel === "header" ? "[data-tour=header-league]" : '[aria-label="Switch league"]');
        const chips = [...(box?.querySelectorAll("[role=group] button") ?? [])].map(
          (b) => `${b.getAttribute("aria-label")}${b.getAttribute("aria-pressed") === "true" ? " [open]" : ""}`
        );
        return { head: head ? head.innerText.replace(/\n+/g, " / ") : "(none)", chips, path: location.pathname };
      }, chrome);
      console.log(`\n${step}  ${said.path}\n  header: ${said.head}\n  strip:  ${said.chips.length ? said.chips.join(" | ") : "(no strip)"}`);
      await page.screenshot({ path: `${out}/strip-${step}-${suffix}.png` });
      return said;
    }
    async function tapChip(label) {
      await page.locator(`${chrome} [role=group] button`, { hasText: label }).first().click();
      await page.waitForTimeout(1500);
    }
    const go = async (path, league) => {
      await page.goto(`${BASE}${path}?league=${league.leagueId}`, { waitUntil: "networkidle" });
      await settle();
    };

    await go("/", classic);
    await report("overview-classic");
    if (desktop) {
      await tapChip("Pool");
      await report("overview-pool");
    } else {
      await go("/team", classic);
      await report("team-classic");
      await tapChip("Active Roster");
      await report("tap-to-roster");
      await tapChip("Pool");
      await report("tap-to-pool");

      // A page pushed on top: an episode is the same in every game; Waivers isn't (Pool has none).
      await go("/episodes/3", classic);
      await tapChip("Active Roster");
      await report("episode-tap");
      await go("/waivers", classic);
      await report("waivers-classic");
      await tapChip("Pool");
      await report("waivers-tap-to-pool");

      // A real touch swipe on Scoreboard, from the middle game towards the next, held mid-way, then let go.
      await go("/scoreboard", roster);
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      const y = 520;
      await touch("touchStart", 300, y);
      for (let x = 300; x >= 170; x -= 10) {
        await touch("touchMove", x, y);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/strip-swipe-mid-${suffix}.png` });
      for (let x = 170; x >= 60; x -= 15) {
        await touch("touchMove", x, y);
        await page.waitForTimeout(16);
      }
      await touch("touchEnd");
      await page.waitForTimeout(1200);
      await report("swipe-landed");
    }
    if (errors.length) console.log("\nerrors:", errors.slice(0, 5));
    await close();
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
