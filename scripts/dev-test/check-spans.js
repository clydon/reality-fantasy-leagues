// Dev-only check of a game over a span (docs/PLAN-sports-data.md step 6; src/lib/game/spans.ts, settings.endEpisode in
// state-logic.js, start-game.ts), against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51:
// results through Episode 5, Episode 6 three days off, 13 episodes).
//   API:
//   - How long, read from the season: the rest of the season (first), just Episode 6, any later episode as the end; and, on a
//     season whose episodes are linked to games (season_events, as a sport's are: added here as Games 6-9, 6-8 between the
//     same two teams), "This series" through Game 8. An end the listing hasn't got, one before the start, or a string: refused.
//   - jordan starts Survival Pool for just Episode 6 (its settings, Recent changes "for Episode 6", the Games tab's game says
//     it ends there and isn't over, its rules say so, the couch's join list says "Episode 6 only").
//   - Episode 6 comes in: that game is over at jordan's Episode 6 (and stays through 6), nobody new joins it ("That game's
//     over"), the couch hub's shelf has it ended; Weekly Lineup over Episodes 6-7 (started in the browser) still runs and asks
//     for Episode 7's lineup. Episode 7 comes in: the lineup game is over through 7, and asks for nothing more; the pool's
//     table doesn't move. (alex joins both, so they count on the trophy shelf.)
//   - Game settings' How long (the follow-up): the lineup game's end moves to Episode 8 and back (Undo), never to an episode
//     before it starts or that isn't a number, never while it's locked down, by nobody but its Commissioner, and not at all
//     once it's over.
//   - Once both are over: their plaques on the trophy shelf name their spans (Episode 6, Episodes 6–7); Run it back offers each
//     on its season's next span from Episode 8 (the pool's one episode, the lineup's two: Episodes 8–9), the start sheet's
//     again preselects it, and running the lineup game back on Episodes 8–9 takes it off the list (the pool's stays).
//   In a real browser at --width (390 by default), as jordan: the Games tab's Start a game shows How long (the rest of the season
//   on, Just Episode 6, Through a later one), picking Through Episode 7 says "Episodes 6–7" in the sheet's title, Start it, and
//   the Games tab's game reads "Episodes 6–7 ·"; after the results, "Final · Episode 6" and "Final · Episodes 6–7"; Backstage ›
//   Game settings' How long moves the end to Episode 8 (the toast's Undo puts it back) and reads Final once it's over; the Games
//   tab's Again for Episode 8 (Round 3: finished spans are in its results) opens the sheet set to Episodes 8–9 and starts it; the trophy shelf's plaques say Episode 6
//   and Episodes 6–7. Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//   Starts (step A3 of docs/PLAN-start-a-game-gpt.md), API: the options list the next episode and every later listed one;
//   ?start=9 reads them from Episode 9 (How long counts from there); a start that's aired, isn't listed, comes with Include it
//   or after its end is refused. An Outlast from Episode 9 (in the browser: the sheet's Starts, Later › Episode 9, its note and
//   "from Episode 9" in the title) is stored so, says "started Outlast from Episode 9" in Recent changes, plays nothing before
//   9, takes a side bet on Episode 9, and reads "Starts with Episode 9 ·" on the Games tab. Game settings moves its start to
//   any episode still to come (11, then Undo), never to one that's aired, unlisted, by someone who doesn't run it, or locked
//   down; it still moves once 6 and 7 are in (from 8 on). Side bets on the pool and the lineup game once they're over: refused.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-spans.js <outDir> [--width=390] [--keep] [--api]
// (Start a game's own lengths, since B1, are check-start-a-game.js's and wizard-coverage.js's: the browser here reads the Games tab.)
//
// --api: the API half only (the lineup game is then started through the API). Brings new-fixture.js up and takes it down
// (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks:
// never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-spans runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-spans.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    // Results an admin accepted reach every league on the season, as on Survivor 51.
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const opts = async () => (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    const start = (body) => as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, body);
    const gamesOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/games${q}`)).body.games;
    const joinable = async (id) => (await as.riley.call("GET", `/api/couches/${couch}/games`)).body.games.find((g) => g.leagueId === id);
    const mark = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);

    // ---------- How long ----------
    let o = await opts();
    check(o.from === 6 && o.spans.map((s) => s.kind).join() === "rest,one", "How long: the rest of the season, then just Episode 6 (no linked games: no series)", JSON.stringify(o.spans));
    check(o.spans[0].to === null && o.spans[0].line === "Episode 6 to the season's end" && o.spans[1].to === 6 && o.spans[1].label === "Just Episode 6", "  the rest of the season first (the default), then Just Episode 6", JSON.stringify(o.spans));
    check(o.ends.map((e) => e.number).join() === "7,8,9,10,11,12,13", "  any later episode can be the end", JSON.stringify(o.ends.map((e) => e.number)));

    // A season whose episodes are linked to games (as a sport's are: season_events), Games 6-8 between the same two teams.
    const teams = (a, b) => JSON.stringify([{ id: a, name: `ZT ${a}` }, { id: b, name: `ZT ${b}` }]);
    for (const n of [6, 7, 8, 9]) {
      await pool.query("INSERT INTO season_episodes (season_id, number, title, source) VALUES ($1, $2, $3, 'listing') ON CONFLICT (season_id, number) DO UPDATE SET title = EXCLUDED.title", [sid, n, `Game ${n}: ZT Rays at ZT Brewers`]);
      await pool.query(
        "INSERT INTO season_events (season_id, episode, provider, league, event_id, teams) VALUES ($1, $2, 'espn', 'zt/zt', $3, $4::jsonb)",
        [sid, n, `zt-${n}`, n < 9 ? teams("Rays", "Brewers") : teams("Rays", "Cubs")]
      );
    }
    o = await opts();
    const series = o.spans.find((s) => s.kind === "series");
    check(series?.to === 8 && series.line === "Episodes 6–8 · ZT Rays and ZT Brewers", "linked games between the same teams: This series, through Episode 8", JSON.stringify(o.spans));
    check(o.spans.find((s) => s.kind === "one")?.line === "Game 6: ZT Rays at ZT Brewers" && o.ends[0].title === "Game 7: ZT Rays at ZT Brewers", "  each with its listing's title");
    await pool.query("DELETE FROM season_events WHERE season_id = $1", [sid]);
    await pool.query("DELETE FROM season_episodes WHERE season_id = $1 AND number BETWEEN 6 AND 9", [sid]);

    for (const [to, why] of [[99, "the listing hasn't got it"], [5, "before it starts"], ["7", "not a number"]]) {
      const r = await start({ game: "survivalPool", tell: false, to });
      check(r.status === 400 && /Pick an end the listing has/.test(r.body.error ?? ""), `an end ${why}: refused`, `${r.status} ${JSON.stringify(r.body)}`);
    }

    // ---------- Starts (step A3): with the next episode, or any later listed one ----------
    check(o.nextEpisode === 6 && o.starts.map((e) => e.number).join() === "6,7,8,9,10,11,12,13" && !!o.starts[0].airAt, "Starts: with the next one (Episode 6, when it airs), or any later listed episode", JSON.stringify(o.starts.map((e) => e.number)));
    check(
      o.starts.find((e) => e.number === 6)?.title === "Game 6: ZT Rays at ZT Brewers" && o.starts.filter((e) => e.number >= 10).every((e) => e.title === null),
      "  titles only where they give nothing away: a linked game's matchup, never a show's episode title before it airs",
      JSON.stringify(o.starts.map((e) => [e.number, e.title]))
    );
    const optsFrom = async (n) => (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}&start=${n}`)).body;
    const from9 = await optsFrom(9);
    check(
      from9.from === 9 && from9.nextEpisode === 6 && from9.spans[0].line === "Episode 9 to the season's end" && from9.ends.map((e) => e.number).join() === "10,11,12,13",
      "  ?start=9: the options from Episode 9 (How long counts from there)",
      JSON.stringify({ from: from9.from, spans: from9.spans, ends: from9.ends.map((e) => e.number) })
    );
    check((await optsFrom(5)).from === 6 && (await optsFrom(99)).from === 6, "  a start that's aired, or that the listing hasn't got: the next one");
    for (const [body, why] of [[{ from: 99 }, "the listing hasn't got"], [{ from: 5 }, "has aired"], [{ from: 9, late: true }, "comes with Include it"], [{ from: 9, to: 8 }, "comes after its end"]]) {
      const r0 = await start({ game: "outlast", tell: false, ...body });
      check(r0.status === 400, `  a start that ${why}: refused`, `${r0.status} ${JSON.stringify(r0.body)}`);
    }

    // ---------- Survival Pool, just Episode 6 ----------
    let r = await start({ game: "survivalPool", tell: false, to: 6 });
    const POOL = r.body.leagueId;
    let st = (await league(POOL))?.state;
    check(r.status === 200 && r.body.from === 6 && r.body.to === 6 && st?.settings.startEpisode === 6 && st.settings.endEpisode === 6, "jordan starts Survival Pool for just Episode 6", JSON.stringify(r.body));
    const lines = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines ?? [];
    check(lines.some((l) => /started Survival Pool for Episode 6/.test(l.text)), "  Recent changes: started Survival Pool for Episode 6", JSON.stringify(lines.slice(0, 3).map((l) => l.text)));
    let g = (await gamesOf("jordan")).find((x) => x.leagueId === POOL);
    check(g?.to === 6 && g.from === 6 && g.over === false, "  its game: Episode 6 to Episode 6, not over", JSON.stringify(g && { from: g.from, to: g.to, over: g.over }));
    check(g?.rules.some((x) => /It's one episode: Episode 6, then it's over/.test(x)), "  its rules say so", JSON.stringify(g?.rules));
    const j = await joinable(POOL);
    check(j?.span?.from === 6 && j.span.to === 6 && j.ended === false, "  the couch's join list carries its span (its line: \"Episode 6 only.\")", JSON.stringify(j && { span: j.span, ended: j.ended }));
    // Two on it, so it counts on the trophy shelf.
    const joinIt = async (id) => (await as.alex.call("POST", `/api/couches/${couch}/games/${id}`, { action: "join" })).status;
    check((await joinIt(POOL)) === 200, "  alex joins it");

    // ---------- Weekly Lineup over Episodes 6-7 (the browser starts it; --api starts it here) ----------
    let LINEUP = null;
    let b = null;
    let n = 0;
    const shot = async (name) => b && b.page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
    const wide = async (what) => {
      const over = await b.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
    };
    if (!apiOnly) {
      b = await open({ user: "zt_nd_jordan", pass: PASSWORD, width, height: 844 });
      closers.push(b.close);
      const { page } = b;

      // Start a game's lengths are the show's stages since B1 (docs/PLAN-start-a-game-redo.md: the gallery's How long?); a later
      // listed episode as the start and a picked last episode aren't in its design, so both games start through the API here and
      // the browser reads the Games tab's lines.
      r = await start({ game: "outlast", tell: false, from: 9 });
      check(r.status === 200 && r.body.from === 9 && r.body.to === null, "jordan starts Outlast from Episode 9", JSON.stringify(r.body));
      r = await start({ game: "weeklyLineup", tell: false, to: 7 });
      LINEUP = r.body.leagueId;
      check(r.status === 200 && r.body.to === 7 && (await league(LINEUP)).state.settings.endEpisode === 7, "jordan starts a Weekly Lineup over Episodes 6–7", JSON.stringify(r.body));
      // Round 3 (B3): a span that's over leaves the Games tab for its results and the archive; Again offers it on what comes next.
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-results] [data-result-row]").first().waitFor({ timeout: 30000 }).catch(() => {});
      check((await page.locator(`[data-result-row="${LINEUP}"]`).count()) === 1, "the Games tab: the finished lineup game in Episode 7's results", await page.locator("[data-results]").innerText().catch(() => ""));
      check((await page.locator(`[data-table="${LINEUP}"], [data-table="${POOL}"]`).count()) === 0, "  and neither finished game has a row of its own");
      await shot("games-final");
      await wide("the Games tab, final");

      // Again from the Games tab: the newest finished span, the lineup game's, on Episodes 8–9.
      const backRow = page.locator(`[data-again-line] [data-again="${LINEUP}"]`);
      await backRow.waitFor({ timeout: 20000 });
      check(/Again for Episode 8/.test((await page.locator("[data-again-line]").innerText()) ?? ""), "the Games tab: Again for Episode 8", await page.locator("[data-again-line]").innerText());
      await backRow.scrollIntoViewIfNeeded();
      await shot("games-run-it-back");
      await backRow.click();
      // Start a game (B1): Again opens the old game on its own screen, on the next stretch (Episodes 8–9).
      await page.locator("[data-gallery=base]").waitFor({ timeout: 60000 });
      const length = await page.locator("[data-gallery-length]").innerText();
      check(/Weekly Lineup/i.test(await page.locator("[data-gallery-title]").innerText()) && /Episode 8 to Episode 9/.test(length), "  Again: the same Weekly Lineup on its screen, Episode 8 to Episode 9", `${await page.locator("[data-gallery-title]").innerText()} · ${length.split("\n").slice(0, 3).join(" · ")}`);
      await shot("run-it-back-sheet");
      await wide("Run it back");
      await page.locator("[data-gallery-start]").click();
      await page.locator("text=Weekly Lineup started").first().waitFor({ timeout: 20000 });
      const { rows: again } = await pool.query("SELECT id, state FROM leagues WHERE created_by = $1 AND state->'settings'->>'endEpisode' = '9' AND deleted_at IS NULL", [fx.users.jordan]);
      check(again.length === 1 && again[0].state.settings.startEpisode === 8 && again[0].state.settings.leagueTypeId === "active-roster", "  Start: a Weekly Lineup over Episodes 8–9");
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-whats-on]").waitFor({ timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      check((await page.locator(`[data-again="${LINEUP}"]`).count()) === 0, "  then the lineup game's Again is gone (it's on again)");
      // The pool's Again is on its own page (it ended an episode before the newest results).
      await page.goto(`${BASE}/show/${sid}/game/${POOL}`, { waitUntil: "load" });
      await page.locator(`[data-again="${POOL}"]`).waitFor({ timeout: 30000 }).catch(() => {});
      check(/Again for Episode 8\b/.test((await page.locator(`[data-again="${POOL}"]`).innerText().catch(() => "")) ?? ""), "  the pool's page: Again for Episode 8", await page.locator("[data-game-page]").innerText().catch(() => ""));

      // Game settings once it's over: Final, nothing to change.
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const lineupHow = page.locator(`[data-settings-game="Weekly Lineup"] [data-settings="span"]`).filter({ hasText: "Final" });
      await lineupHow.first().waitFor({ timeout: 30000 }).catch(() => {});
      check(/Final · Episodes 6–7/.test((await lineupHow.first().innerText().catch(() => "")) ?? "") && (await lineupHow.first().locator("[data-span-end]").count()) === 0, "Game settings, over: Final · Episodes 6–7, nothing to change");

      // The trophy shelf.
      await page.goto(`${BASE}/home?page=trophies`, { waitUntil: "load" });
      const shelf = page.locator('[data-couch-page="trophies"]');
      await shelf.locator("[data-plaque]").first().waitFor({ timeout: 30000 });
      const spans = await shelf.locator("[data-plaque-span]").allTextContents();
      check(spans.includes("Episode 6") && spans.includes("Episodes 6–7"), "the trophy shelf: plaques say Episode 6 and Episodes 6–7", JSON.stringify(spans));
      const backs = await shelf.locator("[data-run-it-back]").innerText().catch(() => "");
      check(/ZT Survivor 51 · Episode 8/.test(backs) && !/Episodes 8–9/.test(backs), "  Run it back lists the pool's next (Episode 8), not the lineup's (run back already)", backs);
      await shelf.locator("[data-plaque-span]").first().scrollIntoViewIfNeeded();
      await shot("trophy-shelf");
      await wide("the trophy shelf");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    } else {
      r = await start({ game: "weeklyLineup", tell: false, again: LINEUP, to: 9 });
      check(r.status === 200 && r.body.from === 8 && r.body.to === 9, "run the lineup game back on Episodes 8-9", JSON.stringify(r.body));
    }
    hub7 = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    check(!backOf(LINEUP) && !!backOf(POOL), "run back: the hub offers the lineup game no more, the pool still", JSON.stringify(hub7.again));

    if (await GameSpecs.gameSpecsOn(pool)) {
      // Every write above (Start a game's, the start and the end moved and undone) kept each game's carried spec in step.
      const { rows: made } = await pool.query("SELECT id, state FROM leagues WHERE created_by = $1 AND deleted_at IS NULL", [fx.users.jordan]);
      const drifted = made.filter((l) => !G.sameValue(l.state.settings.game, G.specOf(l.state.settings))).map((l) => l.id);
      check(made.length >= 4 && !drifted.length, `the game-specs flag is on: the ${made.length} games jordan started still carry the spec their fields play`, drifted.join());
    } else console.log("NOTE  the game-specs flag is off: the carried-spec check was skipped");
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    await jiti("../../src/lib/server/db.ts").pool.end().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
