// Dev-only check for an episode's lock (state-logic.js closedForPlay; Backstage › Settings' Auto / Override, Start a game's
// Include it; 2026-10-27), against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51),
// with Episode 6 moved to have started an hour ago.
//   API:
//   - Start a game knows Episode 6 is on (onAir) and starts at 7; asked with late, from 6;
//   - jordan starts Survival Pool including Episode 6: it starts there, open past its start, and jordan's pick for 6 goes in;
//   - Backstage › Settings: Episode 6's picks open on Override; jordan locks them (Auto again: closed at its start) and a pick is
//     refused; unlocks them again (Override); riley, who doesn't run it, is refused;
//   - a game without Include it starts at 7: Auto, open until its start; Override locks it early, Auto again opens it.
//   In a real browser at --width (390 by default), as jordan: Start a game's Include it switch (the sheet from Episode 6), and
//   Backstage › Settings' lock row (icon, label, the Auto / Override switch, tapped). Nothing wider than the screen; no page
//   errors. Screenshots in <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-episode-lock.js <outDir> [--width=390] [--keep] [--api]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; its down removes the games zt_nd people started, and the
// season with its episode times); touches zt rows only; refuses a non-local database. Shares the zt_nd_ fixture: never run it
// alongside another check that uses it. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-episode-lock runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-episode-lock.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const sid = fx.seasonId;
    const q = `?couch=${fx.couchId}`;
    // Episode 6 started an hour ago; 7 is in six days.
    const at = (n, ms) =>
      pool.query(
        `INSERT INTO season_episodes (season_id, number, air_at) VALUES ($1, $2, $3) ON CONFLICT (season_id, number) DO UPDATE SET air_at = EXCLUDED.air_at`,
        [sid, n, new Date(Date.now() + ms)]
      );
    await at(6, -3600_000);
    await at(7, 6 * 24 * 3600_000);
    const as = {};
    for (const who of ["riley", "jordan"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const state = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const settingsOf = async (who, id) => (await as[who].call("GET", `/api/seasons/${sid}/backstage/settings${q}`)).body.games?.find((g) => g.leagueId === id);
    const lock = (who, id, closed) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { leagueId: id, lock: closed });

    // ---------- Start a game ----------
    let o = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    check(o.onAir?.number === 6 && o.from === 7 && o.late === false, "Start a game knows Episode 6 is on, and starts at 7", JSON.stringify({ onAir: o.onAir, from: o.from }));
    o = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}&late=1`)).body;
    check(o.from === 6 && o.late === true, "Include it: from Episode 6", JSON.stringify({ from: o.from, late: o.late }));
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false, late: true });
    check(r.status === 200 && r.body.from === 6, "jordan starts Survival Pool including Episode 6", JSON.stringify(r.body));
    const game = r.body.leagueId;
    let s = await state(game);
    const ep6 = s.episodes.find((e) => e.number === 6);
    check(s.settings.startEpisode === 6 && ep6?.openPastAir === true, "it starts at 6, open past its start", JSON.stringify({ start: s.settings.startEpisode, ep6 }));
    const me = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game, fx.users.jordan])).rows[0].player_id;
    const still = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
    const pick = (castawayId) => as.jordan.call("PUT", `/api/leagues/${game}/episodes/${ep6.id}/picks`, { playerId: me, castawayId });
    const picked = async () => (await state(game)).episodes.find((e) => e.number === 6).picks?.find((p) => p.playerId === me)?.castawayId ?? null;
    await pick(still[0]);
    check((await picked()) === still[0], "jordan's pick for Episode 6 goes in, after its start");

    // ---------- Backstage › Settings ----------
    let g = await settingsOf("jordan", game);
    check(g?.lock?.episode === 6 && g.lock.what === "picks" && g.lock.closed === false && g.lock.overridden === true, "Settings: Episode 6's picks open, on Override", JSON.stringify(g?.lock));
    r = await lock("jordan", game, true);
    g = await settingsOf("jordan", game);
    check(r.status === 200 && g.lock.closed && !g.lock.overridden && g.lock.why === "air", "locked: back to Auto, closed at its start", JSON.stringify(g.lock));
    await pick(still[1]);
    check((await picked()) === still[0], "and a new pick doesn't go in");
    r = await lock("jordan", game, false);
    g = await settingsOf("jordan", game);
    check(r.status === 200 && !g.lock.closed && g.lock.overridden, "unlocked again: Override", JSON.stringify(g.lock));
    await pick(still[1]);
    check((await picked()) === still[1], "and the pick changes");
    r = await lock("riley", game, true);
    check(r.status === 404 || r.status === 403, "riley, who doesn't run it, can't touch it", `${r.status}`);
    const line = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines.find((l) => /Unlocked Episode 6's picks past its start/.test(l.text));
    check(!!line, "Recent changes says so");

    // ---------- a game without Include it ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const plain = r.body.leagueId;
    g = await settingsOf("jordan", plain);
    check(r.body.from === 7 && g?.lock?.episode === 7 && !g.lock.closed && !g.lock.overridden, "without it: from 7, Auto, open until its start", JSON.stringify(g?.lock));
    await lock("jordan", plain, true);
    g = await settingsOf("jordan", plain);
    check(g.lock.closed && g.lock.overridden && g.lock.why === "hand", "Override locks it early", JSON.stringify(g.lock));
    await lock("jordan", plain, false);
    g = await settingsOf("jordan", plain);
    check(!g.lock.closed && !g.lock.overridden, "Auto again opens it", JSON.stringify(g.lock));

    // ---------- the browser ----------
    if (!apiOnly) {
      const b = await open({ user: "zt_nd_jordan", pass: fixture.PASSWORD, width, height: 844 });
      closers.push(b.close);
      const { page, errors } = b;
      page.setDefaultTimeout(15000);
      let n = 0;
      const shot = async (name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      const wide = async (what) => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };

      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator('[data-start-row="start"]').click();
      await page.locator("[data-start-late]").waitFor({ timeout: 10000 }).catch(() => {});
      check((await page.locator('[data-start-late="off"]').count()) === 1, "Start a game: Include Episode 6 · on now, off");
      await page.locator("[data-start-late]").click();
      await page.getByText("from Episode 6").first().waitFor({ timeout: 8000 }).catch(() => {});
      check((await page.locator('[data-start-late="on"]').count()) === 1 && (await page.getByText("from Episode 6").count()) > 0, "on: the sheet starts from Episode 6");
      await page.locator("[data-start-late]").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400); // not b.settle(): its evaluate crashed the tab here (2026-10-27), the page itself fine
      await shot("start-include");
      await wide("Start a game");
      await page.keyboard.press("Escape");

      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      await page.locator("[data-settings-lock]").first().waitFor({ timeout: 15000 }).catch(() => {});
      const row = page.locator(`[data-settings-game] [data-settings-lock]`).first();
      check((await page.locator('[data-settings-lock="open"] [data-settings-override="on"]').count()) >= 1, "Settings: an open lock on Override");
      await row.scrollIntoViewIfNeeded();
      await shot("settings-lock");
      await wide("Settings");
      const sw = page.locator('[data-settings-lock="open"] [data-settings-override="on"]').first();
      await sw.click();
      await page.locator('[data-settings-lock="locked"] [data-settings-override="off"]').first().waitFor({ timeout: 8000 }).catch(() => {});
      check((await page.locator('[data-settings-lock="locked"] [data-settings-override="off"]').count()) >= 1, "tapped: locked, Auto");
      await page.waitForTimeout(400); // not b.settle(): its evaluate crashed the tab here (2026-10-27), the page itself fine
      await shot("settings-locked");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
