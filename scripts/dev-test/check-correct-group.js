// Dev-only check for correcting a tribe move on the desk (desk-facts.ts decideFact's edit, a group's `method`; the episode
// page's Correct it, "Moved to"), against the dev server, on new-fixture.js's zt Survivor 51 with alex made a site admin for
// the run. As Survivor 51's Episode 3 was: a move decided by hand naming the tribe someone left (Carter "to Savu", when he
// joined Toka).
//   1. The season gets "<someone> moved to Savu" in Episode 3 (canonical, locked), someone on Savu with no move since; every game
//      takes it (Make every game match).
//   2. In the browser at --width: Episode 3's page, the Savu group, their row, Correct it: "Moved to" lists the season's
//      groups; Toka, Correct and accept.
//   3. The fact is Toka (applied, locked); every game's Episode 3 has them moving to Toka, and on Toka now.
// Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-correct-group.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it, alex a site admin); touches zt rows only; refuses a non-local
// database. Prints PASS/FAIL. Shares the zt_nd_ fixture: never run it beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-correct-group runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-correct-group.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  let A = null;
  try {
    const fx = await fixture.up(pool);
    A = fx.users.alex;
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [A]);
    const season = fx.seasonId;
    const games = [fx.leagues.outlast, fx.leagues.lineup, fx.leagues.pool, fx.leagues.extra];

    // ---------- 1. the backwards move ----------
    // Someone still in who started on Savu.
    const { rows: still } = await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.lineup]);
    const st = still[0].state;
    const savu = st.tribes.find((t) => t.name === "Savu");
    const who = st.castaways.find((c) => c.status === "active" && c.tribeId === savu.id && !st.episodes.some((e) => e.number >= 3 && (e.groups || []).some((g) => g.castawayId === c.id)));
    if (!who) throw new Error("nobody still in started on Savu");
    const { rows: ins } = await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, decided_at, locked_at, locked_by)
       VALUES ($1, 3, 'group', $2, 'Savu', '', 'accepted', 'canonical', true, now(), now(), $3) RETURNING id`,
      [season, who.name, A]
    );
    const factId = ins[0].id;
    const alex = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD });
    const m = await alex.call("POST", `/api/desk/seasons/${season}/episodes/3`, { match: true });
    check(m.status === 200, `every game takes "${who.name} moved to Savu"`, JSON.stringify(m.body));
    const page = (await alex.call("GET", `/api/desk/seasons/${season}/episodes/3`)).body;
    check(["Toka", "Savu", "Dina"].every((g) => page.choices.groups.includes(g)), "the episode's choices have the season's groups", JSON.stringify(page.choices.groups));

    // ---------- 2. Correct it, in the browser ----------
    const B = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width });
    closers.push(B.close);
    const pg = B.page;
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(`${BASE}/desk/season/${season}/e/3`);
    await pg.locator("[data-hide-names]").waitFor({ timeout: 30000 });
    if ((await pg.locator("[data-hide-names]").getAttribute("data-hide-names")) === "on") await pg.locator("[data-hide-names]").click();
    await pg.locator('[data-group="Savu"]').click();
    await pg.locator("[data-group-sheet] [data-desk-row]", { hasText: who.name }).click();
    await pg.locator("[data-fact-correct]").first().click();
    const what = pg.locator("select[data-what]");
    await what.waitFor({ timeout: 15000 });
    const offered = await what.locator("option").allInnerTexts();
    check(["Toka", "Savu", "Dina"].every((g) => offered.includes(g)) && /Moved to/.test(await pg.locator("[role=dialog]").last().innerText()), "Correct it: \"Moved to\" lists the groups", JSON.stringify(offered));
    await what.selectOption("Toka");
    await pg.screenshot({ path: path.join(out, "correct-group.png") });
    const wide = await pg.evaluate(() => document.documentElement.scrollWidth);
    check(wide <= width, "nothing wider than the screen", `${wide}px`);
    await pg.locator("[data-correct-go]").click();
    await pg.waitForFunction(() => /Corrected/.test(document.querySelector("[data-toast]")?.textContent || ""), null, { timeout: 30000 }).catch(() => {});

    // ---------- 3. Toka everywhere ----------
    const { rows: f } = await pool.query("SELECT applied, locked_at, status FROM season_decisions WHERE id = $1", [factId]);
    check(f[0].applied?.method === "Toka" && f[0].locked_at && f[0].status === "accepted", "the fact: moved to Toka, locked", JSON.stringify(f[0]));
    const { rows: now } = await pool.query("SELECT id, state FROM leagues WHERE id = ANY($1::uuid[])", [games]);
    const tokaIn = (s) => {
      const toka = s.tribes.find((t) => t.name === "Toka");
      const c = s.castaways.find((x) => x.name === who.name);
      const e3 = s.episodes.find((e) => e.number === 3);
      return (e3.groups || []).some((g) => g.castawayId === c.id && g.tribeId === toka.id) && c.tribeId === toka.id;
    };
    check(now.length === 4 && now.every((r) => tokaIn(r.state)), "every game: Episode 3 moves them to Toka, and they're on Toka now");
    check(!errors.length, "no page errors", errors.join(" | "));
  } catch (e) {
    console.log("FAIL  " + (e.stack || e.message));
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) {
      if (A) await pool.query(`UPDATE "user" SET role = 'user' WHERE id = $1`, [A]).catch(() => {});
      await fixture.down(pool).catch((e) => console.log("down failed: " + e.message));
    }
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
