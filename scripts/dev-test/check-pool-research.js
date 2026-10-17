// Dev-only test bank: Eliminator Pool Research (docs/PLAN-league-tabs.md, build step 6). Needs npm run dev.
//
//   node scripts/dev-test/check-pool-research.js <outDir> [width] [--dark] [--keep]
//
// Brings linked-fixture.js up, opens the Pool's /research and walks Open to you / Used / Everyone and the
// ranking control (Safety first, then Points). Prints each view's first rows (rank, name, line, count) and
// writes <outDir>/poolresearch-<view>-<width>[-dark].png. Prints page errors. Takes the fixture down at the
// end unless --keep. Nothing here touches a real league: it's all zt-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./linked-fixture");
const S = require("../../src/lib/game/state-logic.js");

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-pool-research.js <outDir> [width] [--dark] [--keep]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const suffix = `${width}${dark ? "-dark" : ""}`;
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const [, , pickem] = await fixture.up(pool, { groupName: "Couch Crew" });
    // The fixture's episodes have no events: give Safety something to rank (Castaway 20 twice in episode 1-2,
    // 13 once, 12 an immunity win) so the order isn't all zeros.
    const { rows } = await pool.query(`SELECT state FROM leagues WHERE id = $1`, [pickem.leagueId]);
    const state = rows[0].state;
    const id = (n) => state.castaways.find((c) => c.name === `Castaway ${n}`)?.id;
    for (const [ep, type, n] of [[1, "individualImmunity", 12], [1, "zeroVotesSafe", 20], [2, "zeroVotesSafe", 20], [2, "survivedVotes", 13], [3, "individualImmunity", 20]]) {
      S.ActiveRosterLogic.addEvent(state, state.episodes.find((e) => e.number === ep).id, type, id(n));
    }
    await pool.query(`UPDATE leagues SET state = $2 WHERE id = $1`, [pickem.leagueId, JSON.stringify(state)]);
    const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width });
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, dark ? "dark" : "light");
    await page.goto(`${BASE}/research?league=${pickem.leagueId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const go = page.locator("button", { hasText: /Let.s go!/ });
    if (await go.count()) await go.first().click().catch(() => {});

    const read = async (view) => {
      const said = await page.evaluate(() => ({
        header: document.querySelector("[data-tour=research-list] > div")?.innerText.replace(/\s*\n+\s*/g, " / ") ?? null,
        rows: [...document.querySelectorAll("[data-tour=research-list] li")].slice(0, 6).map((l) => l.innerText.replace(/\s*\n+\s*/g, " / ")),
        empty: document.querySelector("main p")?.innerText ?? null,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      console.log(`\n${view}  header: ${said.header ?? "(none)"}${said.overflow ? "  OVERFLOW" : ""}`);
      for (const r of said.rows) console.log(`  · ${r}`);
      if (!said.rows.length) console.log(`  ${said.empty}`);
      await page.screenshot({ path: `${out}/poolresearch-${view}-${suffix}.png` });
    };
    for (const name of ["Open to you", "Used", "Everyone"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(300);
      await read(name.split(" ")[0].toLowerCase());
    }
    // The ranking control: open it and list what it offers.
    const rank = page.locator("[data-tour=research-list] > div button").first();
    if (await rank.count()) {
      await rank.click();
      await page.waitForTimeout(300);
      console.log("\nrank options:", await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button, [role=menu] *")].map((b) => b.innerText).filter(Boolean).slice(0, 12)));
      await page.screenshot({ path: `${out}/poolresearch-rankmenu-${suffix}.png` });
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
