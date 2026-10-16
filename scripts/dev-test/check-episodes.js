// Screenshots the Episodes tab and the episode-results flow for each results-fixture league, as the
// commissioner and as an ordinary player. Needs results-fixture.js up + npm run dev.
//   node scripts/dev-test/check-episodes.js <outDir> [width] [--dark] [--only=classic|roster|pool] [--who=comm|player]
// Writes <outDir>/<who>-<league>-<page>.png (full page; Studio unless --dark). The notifications
// nudge is snoozed so the alert strip shows the league's own items. Prints any page errors.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");

const PAGES = {
  comm: [["episodes", "/episodes"], ["overview", "/"], ["ep4", "/episodes/4"], ["results", "/episodes/4/research"]],
  player: [["episodes", "/episodes"], ["overview", "/"], ["ep4", "/episodes/4"]],
};

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-episodes.js <outDir> [width] [--dark] [--only=…] [--who=…]");
  const width = parseInt(w, 10);
  const only = (flags.find((f) => f.startsWith("--only=")) || "").slice(7);
  const whoOnly = (flags.find((f) => f.startsWith("--who=")) || "").slice(6);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows: leagues } = await pool.query(`SELECT id, slug FROM leagues WHERE slug LIKE 'zt-res-%' ORDER BY slug`);
  await pool.end();
  if (!leagues.length) throw new Error("no fixture leagues: run results-fixture.js up");
  for (const [who, user] of [["comm", "zt_comm"], ["player", "zt_player"]]) {
    const { page, errors, BASE, close } = await open({ user, pass: "zt-pass-12345", width });
    if (whoOnly && whoOnly !== who) { await close(); continue; }
    const theme = flags.includes("--dark") ? "dark" : "light";
    await page.addInitScript((t) => {
      localStorage.setItem("rfl.theme", t);
      localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
    }, theme);
    for (const l of leagues) {
      const short = l.slug.replace("zt-res-", "");
      if (only && only !== short) continue;
      for (const [name, href] of PAGES[who]) {
        await page.goto(`${BASE}${href}${href.includes("?") ? "&" : "?"}league=${l.id}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/${who}-${short}-${name}.png`, fullPage: true });
        // Sticky bars cover the end of a full-page capture: the bottom as the viewer sees it, too.
        if (name === "results") {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${out}/${who}-${short}-${name}-end.png` });
        }
      }
    }
    if (errors.length) console.log(`[${who}] errors:`, errors.slice(0, 5));
    await close();
  }
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
