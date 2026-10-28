// Dev-only: looks at 390 (docs/PLAN-playtests.md step P3) at replays left standing by playtest.js. As a player would see
// them: signed in as the tinkerer (zt_pt_tinkerer, who plays and runs every replay's game), each kept replay's couch picked
// as the hub picks one (the `gys.couch` key the couch switcher writes), then each page of the season's show space,
// full length. Screenshots hold real shows' data, so they go in the tapes folder, never in git.
//
//   node scripts/dev-test/playtest.js run the-traitors-us 4 --only=6,14 --keep --before=4     (or --through=N)
//   node scripts/dev-test/playtest-looks.js after-draft [--pages=tonight,games,episodes] [--width=390]
//   node scripts/dev-test/playtest.js down
//
// Writes rfl-tapes\replays\shots\<show>-<season>-<n>-<label>-<page>.png and prints each page's console errors.
// Needs: the lane's dev server (BASE in .env.local; `node scripts/lane.js dev`), and games kept by `run --keep`.
// Touches nothing: it reads the kept zt-pt- rows and looks.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const label = process.argv[2];
const flag = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const pages = flag("pages", "tonight,games,episodes").split(",");
const width = Number(flag("width", "390"));

async function main() {
  if (!label || label.startsWith("--")) throw new Error("Usage: node scripts/dev-test/playtest-looks.js <label> [--pages=tonight,games] [--width=390]");
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("playtest-looks.js only reads a local database (AUTH_DATABASE_URL)");
  const pool = new Pool({ connectionString: DB });
  const { rows } = await pool.query(
    `SELECT DISTINCT c.id AS couch, c.name AS couch_name, ss.id AS season, s.slug, ss.season_number
       FROM couches c JOIN leagues l ON l.couch_id = c.id
       JOIN shows s ON s.slug = l.state->'settings'->>'showId' JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE c.name LIKE 'ZT Playtest ·%' AND s.slug LIKE 'zt-pt-%' AND l.deleted_at IS NULL
      ORDER BY c.name`
  );
  await pool.end();
  if (!rows.length) throw new Error("No replay is standing: run playtest.js run ... --keep first");
  const Tapes = require("./tapes");
  const dir = path.join(Tapes.TAPES, "replays", "shots");
  fs.mkdirSync(dir, { recursive: true });
  const { open } = require("./browser");
  const { page, errors, BASE, close, settle } = await open({ user: "zt_pt_tinkerer", pass: "zt-pass-12345", width, height: 844, motion: "off" });
  try {
    for (const r of rows) {
      const n = r.couch_name.split("·").pop().trim();
      const show = r.slug.replace(/^zt-pt-/, "");
      // The couch this replay's game is on, as the switcher remembers it (data.ts setCouch), before the page reads it.
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
      await page.evaluate((id) => localStorage.setItem("gys.couch", id), r.couch);
      for (const p of pages) {
        errors.length = 0;
        await page.goto(`${BASE}/show/${r.season}/${p}`, { waitUntil: "networkidle" });
        await settle();
        const file = path.join(dir, `${show}-${r.season_number}-${n}-${label}-${p}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`${file}${errors.length ? `\n  console errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
      }
    }
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
