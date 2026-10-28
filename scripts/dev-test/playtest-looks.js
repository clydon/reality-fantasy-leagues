// Dev-only: looks at 390 (docs/PLAN-playtests.md step P3) at replays left standing by playtest.js. As a player would see
// them: signed in as one of the replays' seats (the tinkerer by default: zt_pt_tinkerer, who plays and runs every replay's
// game), each kept replay's couch picked as the hub picks one (the `gys.couch` key the couch switcher writes), then each
// page of the season's show space, full length. Screenshots hold real shows' data, so they go in the tapes folder, never
// in git.
//
//   node scripts/dev-test/playtest.js run the-traitors-us 4 --only=6,14 --keep --before=4     (or --through=N)
//   node scripts/dev-test/playtest-looks.js after-draft [--pages=tonight,games,episodes] [--width=390] [--as=forgetter]
//                                  [--reveal=N] [--moves]
//   node scripts/dev-test/playtest.js down
//
//   --as=<seat>    signs in as that seat (a role as playtest.js names its accounts: forgetter, driveby, forgetter2...)
//   --reveal=N     also plays episode N's reveal on Tonight as that seat, a screenshot a beat (<label>-reveal-<beat>.png).
//                  The replays mark every episode watched for everyone, so before each couch's pages this puts that seat
//                  where someone who has watched through N - 1 is, in both designs' marks (watchedThrough: its follow of
//                  the kept copy, finished_at with it, and its results_seen_through on the kept games; zt_pt_ rows on a
//                  zt-pt- season, nothing else). The app itself never moves a player's mark back (follows.ts setFollow).
//   --moves        also opens Tonight's Set lineup (the moves sheet) and screenshots it (<label>-moves.png)
//
// Writes rfl-tapes\replays\shots\<show>-<season>-<n>-<label>-<page>.png and prints each page's console errors.
// Needs: the lane's dev server (BASE in .env.local; `node scripts/lane.js dev`), and games kept by `run --keep`.
// Touches nothing but --reveal's marks (above): it reads the kept zt-pt- rows and looks.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const label = process.argv[2];
const flag = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const pages = flag("pages", "tonight,games,episodes").split(",");
const width = Number(flag("width", "390"));
const as = flag("as", "tinkerer");
const revealFlag = flag("reveal", null);
const reveal = revealFlag === null ? null : Number(revealFlag);
const moves = process.argv.includes("--moves");

async function main() {
  if (!label || label.startsWith("--")) throw new Error("Usage: node scripts/dev-test/playtest-looks.js <label> [--pages=tonight,games] [--width=390] [--as=forgetter] [--reveal=N] [--moves]");
  if (!/^[a-z]+\d*$/.test(as)) throw new Error(`--as is a seat's role as its account names it (tinkerer, forgetter, forgetter2...), not ${as}`);
  if (reveal !== null && !(Number.isInteger(reveal) && reveal >= 1)) throw new Error("--reveal needs an episode number");
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("playtest-looks.js only reads a local database (AUTH_DATABASE_URL)");
  const user = `zt_pt_${as}`;
  const pool = new Pool({ connectionString: DB });
  // The kept replays' couches that this seat is on.
  const { rows } = await pool.query(
    `SELECT DISTINCT c.id AS couch, c.name AS couch_name, ss.id AS season, s.slug, ss.season_number
       FROM couches c JOIN leagues l ON l.couch_id = c.id
       JOIN shows s ON s.slug = l.state->'settings'->>'showId' JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
       JOIN couch_members m ON m.couch_id = c.id JOIN "user" u ON u.id = m.user_id
      WHERE c.name LIKE 'ZT Playtest ·%' AND s.slug LIKE 'zt-pt-%' AND l.deleted_at IS NULL AND u.username = $1
      ORDER BY c.name`,
    [user]
  );
  if (!rows.length) {
    await pool.end();
    throw new Error(`No replay is standing with ${user} in it: run playtest.js run ... --keep first`);
  }
  const Tapes = require("./tapes");
  const dir = path.join(Tapes.TAPES, "replays", "shots");
  fs.mkdirSync(dir, { recursive: true });
  const { open } = require("./browser");
  const { page, errors, BASE, close, settle } = await open({ user, pass: "zt-pass-12345", width, height: 844, motion: "off" });
  const done = async () => {
    await close();
    await pool.end();
  };
  const shot = async (base, what) => {
    const file = path.join(dir, `${base}-${label}-${what}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${file}${errors.length ? `\n  console errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
    errors.length = 0;
  };
  try {
    for (const r of rows) {
      const n = r.couch_name.split("·").pop().trim();
      const show = r.slug.replace(/^zt-pt-/, "");
      const base = `${show}-${r.season_number}-${n}`;
      // Each couch from the same place: the reveal moves the seat's progress, and all of a season's couches share it.
      if (reveal !== null) await watchedThrough(pool, user, r.season, reveal - 1);
      // The couch this replay's game is on, as the switcher remembers it (data.ts setCouch), before the page reads it.
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
      await page.evaluate((id) => localStorage.setItem("gys.couch", id), r.couch);
      errors.length = 0;
      for (const p of pages) {
        await page.goto(`${BASE}/show/${r.season}/${p}`, { waitUntil: "networkidle" });
        await settle();
        await shot(base, p);
      }
      if (moves) {
        await page.goto(`${BASE}/show/${r.season}/tonight`, { waitUntil: "networkidle" });
        await settle();
        const set = page.getByRole("button", { name: /^Set lineup$/ }).first();
        if (await set.count()) {
          await set.click();
          await settle();
          await shot(base, "moves");
        } else console.log(`${base}: no Set lineup on Tonight for ${user}`);
      }
      if (reveal !== null) {
        await page.goto(`${BASE}/show/${r.season}/tonight`, { waitUntil: "networkidle" });
        await settle();
        const go = page.getByRole("button", { name: new RegExp(`^Reveal Episode ${reveal}\\b`) }).first();
        if (!(await go.count())) {
          console.log(`${base}: Tonight offers no "Reveal Episode ${reveal}" to ${user}`);
          await shot(base, "reveal-none");
          continue;
        }
        await go.click();
        // Each beat: once its key (data-beat) is a new one, a screenshot, then the stage to go on, until the last.
        let prev = null;
        for (let i = 0; i < 10; i++) {
          await page.waitForFunction((p) => {
            const b = document.querySelector("[data-beat]");
            return !!b && b.getAttribute("data-beat") !== p;
          }, prev, { timeout: 15000 });
          // A beat's own timers run on (the table moves from before to after at 700 ms: reveal.tsx TableBeat).
          await page.waitForTimeout(1500);
          await settle();
          const beat = await page.getAttribute("[data-beat]", "data-beat");
          await shot(base, `reveal-${i + 1}-${beat}`);
          // The reveal's own stage (waivers.tsx has one too).
          const stage = page.locator('[aria-label="The reveal"] [data-stage]');
          if ((await stage.getAttribute("aria-label")) === "The last beat") break;
          if (i === 9) console.log(`${base}: the reveal didn't reach its last beat in 10`);
          prev = beat;
          await stage.click();
        }
      }
    }
  } finally {
    await done();
  }
}

/**
 * A seat put where someone who has watched through episode `n` of a kept zt-pt- copy is, in both designs' marks: its follow
 * (seen_through, and finished_at only while that's the last episode or past it, as follows.ts keeps it) and its
 * results_seen_through on the games kept on that season, where they're past `n`. zt_pt_ rows on a zt-pt- season only.
 */
async function watchedThrough(pool, user, seasonId, n) {
  const f = await pool.query(
    `UPDATE show_follows f SET seen_through = $3, updated_at = now(),
            finished_at = CASE WHEN ss.episode_count > 0 AND $3 >= ss.episode_count THEN f.finished_at END
       FROM "user" u, show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE f.user_id = u.id AND u.username = $1 AND u.username LIKE 'zt\\_pt\\_%' AND f.season_id = ss.id AND ss.id = $2 AND s.slug LIKE 'zt-pt-%'`,
    [user, seasonId, n]
  );
  if (!f.rowCount) throw new Error(`${user} doesn't follow the kept season ${seasonId}, so there's no mark to set for --reveal`);
  const m = await pool.query(
    `UPDATE league_memberships m SET results_seen_through = $3
       FROM "user" u, leagues l, show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE m.user_id = u.id AND u.username = $1 AND u.username LIKE 'zt\\_pt\\_%' AND m.league_id = l.id AND l.slug LIKE 'zt-pt-%'
        AND ss.id = $2 AND s.slug LIKE 'zt-pt-%' AND l.state->'settings'->>'showId' = s.slug AND l.state->'settings'->>'wikiSeason' = ss.season_number::text
        AND m.results_seen_through > $3`,
    [user, seasonId, n]
  );
  console.log(`${user}: watched through episode ${n} (its follow, and ${m.rowCount} game mark(s) moved back)`);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
