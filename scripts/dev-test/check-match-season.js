// Dev-only check for every game having the season's results (season-decisions.ts: results an admin decided reach the games on
// either "Who decides results" setting, and `match`; the desk episode page's Make every game match), against the dev server, on
// new-fixture.js's zt Survivor 51 (couch A's three linked games and couch B's one), with alex made a site admin for the run.
// Set up as production's Survivor 51 was on 2026-10-29: the season's Episodes 1-3 decided by hand on the desk (canonical, locked,
// no source) with "You decide" on, the games' Episodes 1-3 empty, their Episodes 4-5 their own (no season results there).
//   1. Make every game match from Episode 1's page (the desk's API): its sync brings every game the season's Episodes 1-3, none
//      of them news (no results push: the games' newest episode with results is 5); Episodes 2 and 3 then match already.
//   2. Who decides results to Sources that agree (Setup): nothing leaves any game (until this fix, all of Episodes 1-3 did).
//   3. The season gets Episode 4's results (decided, as research settling would), all but one of the lineup game's; it has one
//      more of its own too. The episode page lists it with two of its own, and the other three (who went home only) as missing
//      the season's moments; in the browser at --width, Make every game match and its hold: every game has exactly the
//      season's Episode 4, the lineup game an "Episode 4 corrected" line.
//      Backstage and Episode 4's results read that correction (the game's own result: no ruling to keep).
//   4. Every game's Episodes 1-4 are the same, and the season's; no results push went to anyone.
// Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-match-season.js <outDir> [--width=390] [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-match-season runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-match-season.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** One episode of a league, as sorted lines: who went home and each moment. */
function said(state, n) {
  const ep = state.episodes.find((e) => e.number === n);
  if (!ep) return [];
  const name = (id) => state.castaways.find((c) => c.id === id)?.name;
  return [...(ep.events || []).map((e) => `out ${name(e.castawayId)}`), ...(ep.scoringEvents || []).map((e) => `${e.type} ${name(e.castawayId)}`)].sort();
}
/** The season's results for an episode, as the same lines. */
const seasonSays = (rows, n) => rows.filter((d) => d.episode_number === n).map((d) => (d.kind === "elimination" ? `out ${d.castaway_name}` : `${d.event_type} ${d.castaway_name}`)).sort();

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
    const userIds = Object.values(fx.users);

    // ---------- production's Survivor 51, as it was ----------
    // The season's Episodes 1-3 decided by hand (canonical, locked, no source); its Episodes 4-5 aside (none on the season).
    await pool.query(`UPDATE season_decisions SET fact_status = 'canonical', locked_at = now(), locked_by = $2 WHERE season_id = $1 AND status = 'accepted'`, [season, A]);
    const { rows: later } = await pool.query(`SELECT * FROM season_decisions WHERE season_id = $1 AND episode_number >= 4 ORDER BY episode_number, kind, castaway_name`, [season]);
    await pool.query(`DELETE FROM season_decisions WHERE season_id = $1 AND episode_number >= 4`, [season]);
    await pool.query(`UPDATE show_seasons SET results_by = 'admin', results_admin_since = NULL WHERE id = $1`, [season]);
    // The games: Episodes 1-3 empty (their results come from the season), 4-5 their own.
    for (const id of games) {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [id]);
      const s = rows[0].state;
      const early = new Set(s.episodes.filter((e) => e.number <= 3).map((e) => e.id));
      for (const e of s.episodes) if (early.has(e.id)) Object.assign(e, { events: [], scoringEvents: [], exiled: [], roles: [], groups: [], noExit: false });
      for (const c of s.castaways) if (c.status === "eliminated" && early.has(c.exitEpisodeId)) Object.assign(c, { status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null });
      const out4 = s.castaways.filter((c) => c.status === "eliminated").sort((a, b) => a.placementOrder - b.placementOrder);
      out4.forEach((c, i) => (c.placementOrder = i + 1));
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [id, s]);
      await pool.query("DELETE FROM league_applied_decisions WHERE league_id = $1", [id]);
    }
    const pushes = async () =>
      (await pool.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id = ANY($1::text[]) AND (key LIKE 'results:%' OR key LIKE 'final:%')`, [userIds])).rows[0].n;
    const pushedBefore = await pushes();
    const states = async () => new Map((await pool.query("SELECT id, state FROM leagues WHERE id = ANY($1::uuid[])", [games])).rows.map((r) => [r.id, r.state]));
    const decided = async () => (await pool.query(`SELECT episode_number, kind, castaway_name, event_type FROM season_decisions WHERE season_id = $1 AND status = 'accepted'`, [season])).rows;

    const alex = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD });
    const ep = (n) => `/api/desk/seasons/${season}/episodes/${n}`;

    // ---------- 1. Episodes 1-3 into every game ----------
    const page1 = (await alex.call("GET", ep(1))).body;
    check(page1.apart?.length === 4 && page1.apart.every((g) => g.missing > 0 && !g.own.length), "Episode 1: the page lists all four games as missing the season's results", JSON.stringify(page1.apart?.map((g) => [g.name, g.own.length, g.missing])));
    const r1 = await alex.call("POST", ep(1), { match: true });
    check(r1.status === 200 && /every game matches the season/.test(r1.body.text), "Episode 1: Make every game match", JSON.stringify(r1.body));
    for (const n of [2, 3]) {
      check(!(await alex.call("GET", ep(n))).body.apart?.length, `Episode ${n}: every game matches already (the sync brought every episode)`);
      check((await alex.call("POST", ep(n), { match: true })).status === 409, `Episode ${n}: Make every game match says there's nothing to do`);
    }
    let now = await states();
    let season13 = await decided();
    for (const n of [1, 2, 3]) check(games.every((id) => JSON.stringify(said(now.get(id), n)) === JSON.stringify(seasonSays(season13, n))), `Episode ${n}: every game has exactly the season's results`);

    // ---------- 2. Sources that agree ----------
    const sw = await alex.call("POST", `/api/desk/seasons/${season}/setup`, { resultsBy: "leagues" });
    check(sw.status === 200 && !/left its games/.test(sw.body.text || ""), "Sources that agree: the switch says nothing leaves", JSON.stringify(sw.body));
    now = await states();
    for (const n of [1, 2, 3]) check(games.every((id) => JSON.stringify(said(now.get(id), n)) === JSON.stringify(seasonSays(season13, n))), `Episode ${n}: still in every game after the switch`);
    const page3 = (await alex.call("GET", ep(3))).body;
    check(!page3.apart.length, "Episode 3's page: every game matches");

    // ---------- 3. Episode 4 on the season, and a game with one of its own ----------
    const four = later.filter((d) => d.episode_number === 4);
    const dropped = four.find((d) => d.kind === "event");
    for (const d of four.filter((x) => x !== dropped)) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, fact_status, from_research, decided_at, locked_at, locked_by)
         VALUES ($1, 4, $2, $3, $4, $5, 'accepted', 'canonical', true, now(), now(), $6)`,
        [season, d.kind, d.castaway_name, d.method, d.event_type, A]
      );
    }
    // The lineup game's one more of its own: an extra moment for someone still in.
    {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [fx.leagues.lineup]);
      const s = rows[0].state;
      const e4 = s.episodes.find((e) => e.number === 4);
      const someone = s.castaways.find((c) => c.status === "active");
      e4.scoringEvents.push({ id: "sev_zt_own", type: dropped.event_type, castawayId: someone.id });
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [fx.leagues.lineup, s]);
    }
    const page4 = (await alex.call("GET", ep(4))).body;
    const lineupApart = page4.apart?.find((g) => g.leagueId === fx.leagues.lineup);
    const others = page4.apart?.filter((g) => g.leagueId !== fx.leagues.lineup) ?? [];
    check(lineupApart?.own.length === 2 && lineupApart.missing === 0, "Episode 4's page: the lineup game with two of its own, nothing missing", JSON.stringify(lineupApart));
    check(others.length === 3 && others.every((g) => !g.own.length && g.missing > 0), "Episode 4's page: the other three missing the season's moments, none of their own", JSON.stringify(others.map((g) => [g.name, g.own.length, g.missing])));

    const B = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width });
    closers.push(B.close);
    const pg = B.page;
    const errors = [];
    pg.on("pageerror", (e) => errors.push(e.message));
    await pg.goto(`${BASE}/desk/season/${season}/e/4`);
    await pg.locator("[data-apart]").waitFor({ timeout: 30000 });
    check(/4 games don't match/.test(await pg.locator("[data-apart]").innerText()), "the page says four games don't match");
    await pg.locator("[data-apart]").scrollIntoViewIfNeeded();
    await pg.screenshot({ path: path.join(out, "apart.png") });
    const wide = await pg.evaluate(() => document.documentElement.scrollWidth);
    check(wide <= width, "the episode page: nothing wider than the screen", `${wide}px`);
    await pg.locator("[data-match]").click();
    await pg.locator("[data-match-sheet]").waitFor({ timeout: 15000 });
    await pg.screenshot({ path: path.join(out, "match-sheet.png") });
    await pg.waitForTimeout(600);
    const box = await pg.locator("[role=dialog][data-open] [data-hold]").last().boundingBox();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pg.mouse.down();
    await pg.waitForTimeout(1800);
    await pg.mouse.up();
    await pg.waitForFunction(() => !document.querySelector("[data-apart]"), null, { timeout: 30000 }).catch(() => {});
    check((await pg.locator("[data-apart]").count()) === 0, "held: the page says nothing's apart");
    await pg.screenshot({ path: path.join(out, "matched.png") });

    now = await states();
    const season14 = await decided();
    check(games.every((id) => JSON.stringify(said(now.get(id), 4)) === JSON.stringify(seasonSays(season14, 4))), "Episode 4: every game has exactly the season's results", JSON.stringify(games.map((id) => said(now.get(id), 4).length)));
    const { rows: lines } = await pool.query(`SELECT league_id FROM league_changes WHERE league_id = ANY($1::uuid[]) AND kind = 'results.correction' AND episode = 4`, [games]);
    check(lines.length === 1 && lines[0].league_id === fx.leagues.lineup, "the lineup game has an Episode 4 corrected line", JSON.stringify(lines));
    // That correction is the lineup game's own result taken out (an own: id, not a season decision): the couch's reads take it
    // (production's Backstage and episode results answered 500 on one, 2026-10-29 to 10-30), and it offers no ruling to keep.
    const runs = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD });
    const bs = await runs.call("GET", `/api/seasons/${season}/backstage?couch=${fx.couchId}`);
    const own = (bs.body?.corrections || []).filter((c) => String(c.decisionId).startsWith("own:"));
    check(bs.status === 200 && own.length >= 1 && own.every((c) => c.keepable === false), "Backstage reads the game's own results taken out, with no ruling to keep", `${bs.status} ${JSON.stringify(own.map((c) => [c.decisionId, c.keepable]))}`);
    const res4 = await runs.call("GET", `/api/seasons/${season}/results/4?couch=${fx.couchId}`);
    check(res4.status === 200 && (res4.body?.corrections || []).some((c) => String(c.decisionId).startsWith("own:")), "Episode 4's results read it too", `${res4.status}`);


    // ---------- 4. the same everywhere, nobody pushed ----------
    for (const n of [1, 2, 3, 4]) {
      const one = JSON.stringify(said(now.get(games[0]), n));
      check(games.every((id) => JSON.stringify(said(now.get(id), n)) === one), `Episode ${n}: the same in all four games`);
    }
    await new Promise((r) => setTimeout(r, 4000));
    check((await pushes()) === pushedBefore, "no results push for an old episode coming in", `${pushedBefore} -> ${await pushes()}`);
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
