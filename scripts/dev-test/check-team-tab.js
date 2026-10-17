// Dev-only test bank: Team / Lineup's waiver banner and Waivers section (docs/PLAN-league-tabs.md, build
// step 2) in every waiver setting waivers-fixture.js can make. Needs npm run dev.
//
//   node scripts/dev-test/check-team-tab.js <outDir> [width] [--dark] [--phase=open|claimed|processed|idle]
//                                           [--who=player,late,comm] [--keep]
//
// Brings waivers-fixture.js up with --scenarios at the phase (default open), then for each person and
// each zt-wv-* league opens slot 4 (/team: it draws Lineup in an Active Roster league) and writes
// <outDir>/<phase>-<league>-<who>[-dark].png, the whole page. Prints what each page says -- the banner
// (tag · title · subtitle, or "no banner"), the way in, and How it works here's rows -- so a setting's
// rows coming and going can be read without opening every picture. Prints page errors. Takes the
// fixture down at the end unless --keep. Nothing here touches a real league: it's all zt-wv-*.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./waivers-fixture");

const USERS = { comm: "zt_wcomm", player: "zt_wplayer", late: "zt_wlate" };

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-team-tab.js <outDir> [width] [--dark] [--phase=…] [--who=…] [--keep]");
  const width = parseInt(w, 10);
  const dark = flags.includes("--dark");
  const phase = (flags.find((f) => f.startsWith("--phase=")) || "").slice(8) || "open";
  const who = ((flags.find((f) => f.startsWith("--who=")) || "").slice(6) || "player,late").split(",");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, [`--phase=${phase}`, "--scenarios"]);
    for (const person of who) {
      const { page, errors, BASE, close } = await open({ user: USERS[person], pass: fixture.PASSWORD, width });
      await page.addInitScript((t) => {
        localStorage.setItem("rfl.theme", t);
        localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
      }, dark ? "dark" : "light");
      for (const { slug, leagueId } of made) {
        await page.goto(`${BASE}/team?league=${leagueId}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(900);
        const go = page.locator("button", { hasText: /Let.s go!/ });
        if (await go.count()) await go.first().click().catch(() => {});
        const said = await page.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          const banner = [...main.querySelectorAll('a[href^="/waivers"]')].find((a) => a.querySelector(".tag-cut"));
          const way = main.querySelector('[data-tour="team-waivers"]');
          const rows = [...main.querySelectorAll("dl > div")].map((d) => [...d.children].map((x) => x.innerText.replace(/\n+/g, " / ")).join(": "));
          return {
            banner: banner ? banner.innerText.replace(/\n+/g, " · ") : "no banner",
            way: way ? way.innerText.replace(/\n+/g, " · ") : "no Waivers section",
            rows,
          };
        });
        const name = `${phase}-${slug.replace(/^zt-wv-/, "")}-${person}${dark ? "-dark" : ""}`;
        console.log(`\n${name}\n  banner: ${said.banner}\n  way in: ${said.way}`);
        for (const r of said.rows) console.log(`    ${r}`);
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width, height: Math.max(h, 844) });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${out}/${name}.png` });
        await page.setViewportSize({ width, height: 844 });
      }
      if (errors.length) console.log("errors:", errors.slice(0, 5));
      await close();
    }
  } finally {
    if (!flags.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
