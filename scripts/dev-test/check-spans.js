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
//   tab's Run it back · Episodes 8–9 opens the sheet set to Episodes 8–9 and starts it; the trophy shelf's plaques say Episode 6
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

      // Starts: an Outlast from Episode 9.
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-start-row]").waitFor();
      await page.locator("[data-start-row]").click();
      const first = page.locator('[data-start-sheet="competition"]');
      await first.waitFor();
      await first.locator('[data-start-game="outlast"]').click();
      const starts = first.locator("[data-start-from]");
      await starts.waitFor();
      check(/With the next one · Episode 6/.test(await starts.locator('[aria-checked="true"]').innerText()), "the sheet: Starts, with the next one (Episode 6) on", await starts.innerText());
      await starts.locator("[data-start-from-later]").selectOption("9");
      await first.locator("[data-start-from-note]").waitFor({ timeout: 10000 }).catch(() => {});
      await page.locator("text=ZT Survivor · from Episode 9").first().waitFor({ timeout: 10000 }).catch(() => {});
      check((await page.locator("text=ZT Survivor · from Episode 9").count()) > 0 && /It waits for Episode 9/.test((await first.locator("[data-start-from-note]").textContent().catch(() => "")) ?? ""), "  Later › Episode 9: the title says from Episode 9, and that it waits");
      check(/Episode 9 to the season's end/.test((await first.locator('[data-start-span-choice="rest"]').innerText().catch(() => "")) ?? ""), "  How long counts from Episode 9");
      await starts.scrollIntoViewIfNeeded();
      await shot("start-later");
      await wide("Start a game, starting later");
      await first.locator("[data-start-go]").click();
      await page.locator("text=Outlast started").first().waitFor({ timeout: 20000 });
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-start-row]").waitFor();
      await page.locator("[data-start-row]").click();
      const sheet = page.locator('[data-start-sheet="competition"]');
      await sheet.waitFor();
      const how = sheet.locator("[data-start-span]");
      await how.waitFor();
      const choices = await how.locator("[data-start-span-choice]").evaluateAll((els) => els.map((e) => e.getAttribute("data-start-span-choice")));
      check(choices.join() === "rest,one,through" && (await how.locator('[aria-checked="true"]').getAttribute("data-start-span-choice")) === "rest", "the sheet: How long, the rest of the season on, Just Episode 6, Through a later one", choices.join());
      await sheet.locator('[data-start-game="weeklyLineup"]').click();
      await how.locator("[data-start-span-through]").selectOption("7");
      await page.locator("text=ZT Survivor · Episodes 6–7").first().waitFor({ timeout: 5000 }).catch(() => {});
      check((await page.locator("text=ZT Survivor · Episodes 6–7").count()) > 0, "  Through Episode 7: the sheet says Episodes 6–7");
      await how.scrollIntoViewIfNeeded();
      await shot("start-how-long");
      await wide("Start a game");
      await sheet.locator("[data-start-go]").click();
      // Already on the Games tab: the toast says it's done.
      await page.locator("text=Weekly Lineup started").first().waitFor({ timeout: 20000 });
      const { rows } = await pool.query(
        "SELECT id FROM leagues WHERE created_by = $1 AND state->'settings'->>'leagueTypeId' = 'active-roster' AND state->'settings'->>'endEpisode' = '7' AND deleted_at IS NULL",
        [fx.users.jordan]
      );
      LINEUP = rows[0]?.id ?? null;
      check(!!LINEUP && (await league(LINEUP)).state.settings.endEpisode === 7, "Start it: a Weekly Lineup over Episodes 6–7");
      const span = page.locator(`[data-span="${LINEUP}"]`);
      await span.waitFor({ timeout: 15000 }).catch(() => {});
      check(/Episodes 6–7 ·/.test((await span.textContent().catch(() => "")) ?? ""), "  the Games tab's game reads Episodes 6–7", await span.textContent().catch(() => ""));
      check(/Episode 6 ·/.test((await page.locator(`[data-span="${POOL}"]`).textContent().catch(() => "")) ?? ""), "  and the pool's, Episode 6");
      await span.scrollIntoViewIfNeeded();
      await shot("games-spans");
      await wide("the Games tab");
    } else {
      r = await start({ game: "weeklyLineup", tell: false, to: 7 });
      LINEUP = r.body.leagueId;
      check(r.status === 200 && r.body.to === 7, "jordan starts Weekly Lineup over Episodes 6-7", JSON.stringify(r.body));
    }
    check((await joinIt(LINEUP)) === 200, "alex joins the lineup game too");

    // ---------- the Outlast that starts with Episode 9 ----------
    if (apiOnly) {
      r = await start({ game: "outlast", tell: false, from: 9 });
      check(r.status === 200 && r.body.from === 9 && r.body.to === null, "jordan starts Outlast from Episode 9", JSON.stringify(r.body));
    }
    const { rows: laters } = await pool.query(
      "SELECT id FROM leagues WHERE created_by = $1 AND state->'settings'->>'leagueTypeId' = 'classic-draft' AND state->'settings'->>'startEpisode' = '9' AND deleted_at IS NULL",
      [fx.users.jordan]
    );
    const LATER = laters[0]?.id ?? null;
    st = LATER && (await league(LATER)).state;
    check(laters.length === 1 && st.settings.startEpisode === 9 && st.settings.endEpisode == null && st.episodes.some((e) => e.number === 9), "an Outlast from Episode 9: stored so, its first episode made", JSON.stringify(st && { start: st.settings.startEpisode, end: st.settings.endEpisode }));
    const said9 = ((await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines ?? []).map((l) => l.text);
    check(said9.some((t) => /started Outlast from Episode 9/.test(t)), "  Recent changes: started Outlast from Episode 9", JSON.stringify(said9.slice(0, 3)));
    g = (await gamesOf("jordan")).find((x) => x.leagueId === LATER);
    check(g?.from === 9 && g.to === null && g.over === false && g.table.every((t) => t.total === 0), "  its game: from Episode 9, nothing scored before it", JSON.stringify(g && { from: g.from, to: g.to, totals: g.table.map((t) => t.total) }));
    r = await as.jordan.call("POST", `/api/leagues/${LATER}/episodes/upcoming/bets`, { label: "Who goes home first?", points: 1 });
    st = r.status === 200 ? r.body : null;
    check(r.status === 200 && st.episodes.find((e) => e.number === 9)?.bets?.some((x) => x.label === "Who goes home first?"), "  a side bet proposed now goes on Episode 9, its first", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    if (b) {
      const later = b.page.locator(`[data-span="${LATER}"]`);
      await b.page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await later.waitFor({ timeout: 15000 }).catch(() => {});
      check(/Starts with Episode 9 ·/.test((await later.textContent().catch(() => "")) ?? ""), "  the Games tab: Starts with Episode 9", await later.textContent().catch(() => ""));
      await later.scrollIntoViewIfNeeded();
      await shot("games-starts-later");
    }

    // ---------- Game settings: How long ----------
    const settingsOf = async (id) => (await as.jordan.call("GET", `/api/seasons/${sid}/backstage/settings${q}`)).body.games.find((x) => x.leagueId === id);
    const setEnd = (who, id, to) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { leagueId: id, set: { endEpisode: to }, text: `Changed how long it runs: ${to}` });
    const endOf = async (id) => (await league(id)).state.settings.endEpisode ?? null;
    let gs = await settingsOf(LINEUP);
    check(gs?.span.from === 6 && gs.span.to === 7 && gs.span.over === false && gs.span.ends.map((e) => e.number).join() === "6,7,8,9,10,11,12,13", "Game settings: How long, Episodes 6–7, its end can move to any episode still to come", JSON.stringify(gs?.span));
    for (const [to, why] of [[5, "before it starts"], ["8", "not a number"], [99, "the listing hasn't got it"]]) {
      r = await setEnd("jordan", LINEUP, to);
      check(r.status === 400 && (await endOf(LINEUP)) === 7, `  an end ${why}: refused`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await setEnd("alex", LINEUP, 8);
    check(r.status >= 400 && (await endOf(LINEUP)) === 7, "  alex plays it but doesn't run it: refused", `${r.status}`);
    await as.jordan.call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { lockDown: true });
    r = await setEnd("jordan", LINEUP, 8);
    check(r.status === 409 && /Locked down/.test(r.body.error ?? "") && (await endOf(LINEUP)) === 7, "  locked down: frozen", `${r.status} ${JSON.stringify(r.body)}`);
    await as.jordan.call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { lockDown: false });
    if (b) {
      const { page } = b;
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const how = page.locator('[data-settings-game="Weekly Lineup"] [data-settings="span"]');
      await how.waitFor({ timeout: 30000 });
      check(/Episodes 6–7/.test((await how.locator("[data-span-now]").textContent()) ?? ""), "Backstage › Game settings: How long, Episodes 6–7", await how.innerText());
      await how.locator("[data-span-end]").selectOption("8");
      await page.locator("text=Weekly Lineup runs through Episode 8").first().waitFor({ timeout: 15000 });
      check((await endOf(LINEUP)) === 8, "  Through Episode 8: saved, the toast says so");
      await how.locator("[data-span-now]").filter({ hasText: "Episodes 6–8" }).waitFor({ timeout: 15000 }).catch(() => {});
      await how.scrollIntoViewIfNeeded();
      await shot("settings-how-long");
      await wide("Game settings");
      await page.getByRole("button", { name: "Undo" }).first().click();
      await page.locator("text=Undone").first().waitFor({ timeout: 15000 }).catch(() => {});
      check((await endOf(LINEUP)) === 7, "  Undo: back to Episode 7");
    } else {
      r = await setEnd("jordan", LINEUP, 8);
      check(r.status === 200 && !!r.body.batch && (await endOf(LINEUP)) === 8, "  its end moves to Episode 8", JSON.stringify(r.body));
      r = await as.jordan.call("POST", `/api/seasons/${sid}/changes/${r.body.batch}/undo${q}`);
      check(r.status === 200 && (await endOf(LINEUP)) === 7, "  Undo: back to Episode 7", JSON.stringify(r.body));
    }
    const said = ((await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines ?? []).map((l) => l.text);
    check(said.some((t) => /how long/i.test(t)), "  Recent changes says it", JSON.stringify(said.slice(0, 4)));

    // ---------- Game settings: where it starts (step A3) ----------
    const setStart = (who, id, from) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { leagueId: id, set: { startEpisode: from }, text: `Changed where it starts: ${from}` });
    const startOf = async (id) => (await league(id)).state.settings.startEpisode;
    gs = await settingsOf(LATER);
    check(gs?.span.from === 9 && gs.span.started === false && gs.span.starts.map((e) => e.number).join() === "6,7,8,9,10,11,12,13", "Game settings: the Outlast starts with Episode 9, and can start with any episode still to come", JSON.stringify(gs?.span));
    check((await settingsOf(LINEUP))?.span.started === false && (await settingsOf(LINEUP)).span.starts.map((e) => e.number).join() === "6,7", "  the lineup game's start, up to its end (Episode 7)", JSON.stringify((await settingsOf(LINEUP))?.span.starts));
    for (const [from, why] of [[5, "that's aired"], ["10", "that isn't a number"], [99, "the listing hasn't got"]]) {
      r = await setStart("jordan", LATER, from);
      check(r.status === 400 && (await startOf(LATER)) === 9, `  a start ${why}: refused`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await setStart("jordan", LINEUP, 8);
    check(r.status === 400 && (await startOf(LINEUP)) === 6, "  a start after its end: refused", `${r.status} ${JSON.stringify(r.body)}`);
    r = await setStart("alex", LATER, 11);
    check(r.status >= 400 && (await startOf(LATER)) === 9, "  alex doesn't run it: refused", `${r.status}`);
    await as.jordan.call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { lockDown: true });
    r = await setStart("jordan", LATER, 11);
    check(r.status === 409 && /Locked down/.test(r.body.error ?? "") && (await startOf(LATER)) === 9, "  locked down: frozen", `${r.status} ${JSON.stringify(r.body)}`);
    await as.jordan.call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { lockDown: false });
    if (b) {
      const { page } = b;
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const how = page.locator(`[data-settings-league="${LATER}"] [data-settings="span"]`);
      await how.waitFor({ timeout: 30000 });
      check(/Episode 9 to the season's end/.test((await how.locator("[data-span-now]").textContent()) ?? "") && /Move its start before Episode 9 airs/.test(await how.innerText()), "Backstage › Game settings: the Outlast from Episode 9, its start to move before it airs", await how.innerText());
      await how.locator("[data-span-start]").selectOption("11");
      await page.locator("text=Outlast starts with Episode 11").first().waitFor({ timeout: 15000 });
      check((await startOf(LATER)) === 11 && (await league(LATER)).state.episodes.some((e) => e.number === 11), "  Starts › Episode 11: saved (its first episode made), the toast says so");
      await how.locator("[data-span-now]").filter({ hasText: "Episode 11" }).waitFor({ timeout: 15000 }).catch(() => {});
      await how.scrollIntoViewIfNeeded();
      await shot("settings-starts");
      await wide("Game settings, its start");
      await page.getByRole("button", { name: "Undo" }).first().click();
      await page.locator("text=Undone").first().waitFor({ timeout: 15000 }).catch(() => {});
      check((await startOf(LATER)) === 9, "  Undo: back to Episode 9");
    } else {
      r = await setStart("jordan", LATER, 11);
      check(r.status === 200 && !!r.body.batch && (await startOf(LATER)) === 11, "  its start moves to Episode 11", JSON.stringify(r.body));
      r = await as.jordan.call("POST", `/api/seasons/${sid}/changes/${r.body.batch}/undo${q}`);
      check(r.status === 200 && (await startOf(LATER)) === 9, "  Undo: back to Episode 9", JSON.stringify(r.body));
    }
    const saidStart = ((await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines ?? []).map((l) => l.text);
    check(saidStart.some((t) => /where (it|Outlast) starts/i.test(t)), "  Recent changes says it", JSON.stringify(saidStart.slice(0, 4)));

    // ---------- Episode 6 comes in ----------
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    // Episodes 6 and 7 have aired.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 12 WHERE id = $1", [sid]);
    const result = async (ep) => {
      const name = (await league(fx.leagues.outlast)).state.castaways.find((c) => c.status === "active").name;
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now())`,
        [sid, ep, name]
      );
      await syncSeasonLeagues(sid, null);
    };
    await result(6);
    await mark("jordan", 6);
    const games6 = await gamesOf("jordan");
    g = games6.find((x) => x.leagueId === POOL);
    const pool6 = JSON.stringify(g?.table.map((t) => [t.name, t.total, t.points]));
    check(g?.over === true && g.through === 6, "Episode 6 in, jordan's seen it: the pool is over, through 6", JSON.stringify(g && { over: g.over, through: g.through }));
    const lu = games6.find((x) => x.leagueId === LINEUP);
    check(lu?.over === false && lu.lineup?.episode === 7, "  the lineup game runs on, asking for Episode 7's lineup", JSON.stringify(lu && { over: lu.over, lineup: lu.lineup?.episode }));
    check((await joinable(POOL))?.ended === true, "  nobody new joins the pool");
    r = await as.riley.call("POST", `/api/couches/${couch}/games/${POOL}`, { action: "join" });
    check(r.status === 409 && /That game's over/.test(r.body.error ?? ""), "  riley's join: That game's over", `${r.status} ${JSON.stringify(r.body)}`);
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    check(hub.games?.find((x) => x.leagueId === POOL)?.ended === true && hub.games.find((x) => x.leagueId === LINEUP)?.ended === false, "  the couch hub: the pool ended, the lineup game not", JSON.stringify(hub.games?.map((x) => [x.name, x.ended])));
    r = await setEnd("jordan", POOL, 9);
    check(r.status === 409 && /It's over/.test(r.body.error ?? "") && (await endOf(POOL)) === 6 && (await settingsOf(POOL))?.span.over === true, "  the pool's over: its end stays (Game settings says so)", `${r.status} ${JSON.stringify(r.body)}`);
    check((await settingsOf(LINEUP))?.span.ends.map((e) => e.number).join() === "7,8,9,10,11,12,13", "  the lineup game's end can move to Episode 7 on (6 is in)", JSON.stringify((await settingsOf(LINEUP))?.span.ends.map((e) => e.number)));

    // ---------- Episode 7 comes in ----------
    await result(7);
    await mark("jordan", 7);
    const games7 = await gamesOf("jordan");
    const lu7 = games7.find((x) => x.leagueId === LINEUP);
    // Its last lineup stays on show, locked (as a season game's does after its finale); nothing's open.
    check(lu7?.over === true && lu7.through === 7 && (lu7.lineup === null || (lu7.lineup.episode === 7 && lu7.lineup.locked)), "Episode 7 in: the lineup game is over through 7, nothing left open", JSON.stringify(lu7 && { over: lu7.over, through: lu7.through, lineup: lu7.lineup && [lu7.lineup.episode, lu7.lineup.locked] }));
    g = games7.find((x) => x.leagueId === POOL);
    check(g?.through === 6 && JSON.stringify(g.table.map((t) => [t.name, t.total, t.points])) === pool6, "  the pool's table doesn't move: it stands at Episode 6", JSON.stringify(g && { through: g.through }));
    const home = (await as.jordan.call("GET", "/api/me/home")).body;
    check(!(home.moves ?? []).some((m) => m.leagueId === LINEUP || m.leagueId === POOL), "  home asks nothing of either game", JSON.stringify((home.moves ?? []).map((m) => [m.kind, m.leagueName, m.episode])));
    check((await setEnd("jordan", LINEUP, 9)).status === 409, "  and its end can't move now");
    for (const [id, what] of [[POOL, "the pool (over at 6)"], [LINEUP, "the lineup game (over at 7)"]]) {
      r = await as.jordan.call("POST", `/api/leagues/${id}/episodes/upcoming/bets`, { label: "Too late?", points: 1 });
      const bets = (await league(id)).state.episodes.flatMap((e) => (e.bets || []).map((x) => x.label));
      check(r.status === 409 && /This game is over/.test(r.body.error ?? "") && !bets.includes("Too late?"), `  a side bet on ${what}: refused, nothing written`, `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    }
    gs = await settingsOf(LATER);
    check(gs?.span.started === false && gs.span.starts[0]?.number === 8, "  the Outlast from Episode 9 hasn't started: its start can still move, from Episode 8 on", JSON.stringify(gs?.span.starts.map((e) => e.number)));

    // ---------- the trophy shelf and Run it back ----------
    let hub7 = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const plaque = (id) => hub7.trophies?.plaques.find((p) => p.leagueId === id);
    check(plaque(POOL)?.span === "Episode 6" && plaque(LINEUP)?.span === "Episodes 6–7" && plaque(LINEUP)?.label === "ZT Survivor 51", "the trophy shelf: each plaque names its span (Episode 6, Episodes 6–7) under the season", JSON.stringify(hub7.trophies?.plaques.map((p) => [p.label, p.span, p.gameName])));
    const at = (id) => hub7.trophies.plaques.findIndex((p) => p.leagueId === id);
    check(at(LINEUP) >= 0 && at(LINEUP) < at(POOL), "  the span that ended later first (Episodes 6–7, then Episode 6)");
    const backOf = (id) => hub7.again?.find((a) => a.leagueId === id);
    check(backOf(LINEUP)?.seasonId === sid && backOf(LINEUP)?.label === "ZT Survivor 51 · Episodes 8–9", "Run it back: the lineup game on the same season's next two, Episodes 8–9", JSON.stringify(hub7.again));
    check(backOf(POOL)?.label === "ZT Survivor 51 · Episode 8", "  the pool on the next one, Episode 8", JSON.stringify(backOf(POOL)));
    o = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}&again=${LINEUP}`)).body;
    check(o.from === 8 && o.again?.to === 9 && o.again.label === "Episodes 6–7" && o.again.key === "weeklyLineup", "  the start sheet's again: Weekly Lineup, Episodes 8–9 preselected, after Episodes 6–7", JSON.stringify({ from: o.from, again: o.again }));

    if (b) {
      const { page, errors } = b;
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const span = page.locator(`[data-span="${LINEUP}"]`);
      await span.waitFor({ timeout: 15000 }).catch(() => {});
      check(/Final · Episodes 6–7 ·/.test((await span.textContent().catch(() => "")) ?? ""), "the Games tab: Final · Episodes 6–7", await span.textContent().catch(() => ""));
      check(/Final · Episode 6 ·/.test((await page.locator(`[data-span="${POOL}"]`).textContent().catch(() => "")) ?? ""), "  and Final · Episode 6");
      check(/^Through Episode 7\./.test(((await page.locator("text=/^Through Episode/").first().textContent().catch(() => "")) ?? "").trim()), "  the line under the tables is the running games' (Episode 7), not the finished pool's 6");
      await page.locator(`[data-table="${POOL}"]`).scrollIntoViewIfNeeded();
      await shot("games-final");
      await wide("the Games tab, final");

      // Run it back from the Games tab: the latest finished span, the lineup game's, on Episodes 8–9.
      const backRow = page.locator('[data-start-row="again-span"]');
      await backRow.waitFor({ timeout: 20000 });
      check(/Run it back · Episodes 8–9/.test((await backRow.innerText()) ?? ""), "the Games tab: Run it back · Episodes 8–9", await backRow.innerText());
      await backRow.scrollIntoViewIfNeeded();
      await shot("games-run-it-back");
      await backRow.click();
      const sheet = page.locator('[data-start-sheet="competition"]');
      await sheet.waitFor();
      await page.locator("text=ZT Survivor 51 · Episodes 8–9 · the same Weekly Lineup as Episodes 6–7").first().waitFor({ timeout: 10000 }).catch(() => {});
      check((await page.locator("text=ZT Survivor 51 · Episodes 8–9 · the same Weekly Lineup as Episodes 6–7").count()) > 0, "  the sheet: Run it back, Episodes 8–9, the same Weekly Lineup as Episodes 6–7");
      check((await sheet.locator("[data-start-span-through]").inputValue()) === "9" && (await sheet.locator('[data-start-game="weeklyLineup"]').getAttribute("aria-pressed")) === "true", "  How long set to through Episode 9, Weekly Lineup picked");
      await sheet.locator("[data-start-span]").scrollIntoViewIfNeeded();
      await shot("run-it-back-sheet");
      await wide("Run it back");
      await sheet.locator("[data-start-go]").click();
      await page.locator("text=Weekly Lineup started").first().waitFor({ timeout: 20000 });
      const { rows: again } = await pool.query("SELECT id, state FROM leagues WHERE created_by = $1 AND state->'settings'->>'endEpisode' = '9' AND deleted_at IS NULL", [fx.users.jordan]);
      check(again.length === 1 && again[0].state.settings.startEpisode === 8 && again[0].state.settings.leagueTypeId === "active-roster", "  Start it: a Weekly Lineup over Episodes 8–9");
      await page.locator('[data-start-row="again-span"]').filter({ hasText: "Episode 8" }).waitFor({ timeout: 20000 }).catch(() => {});
      check(/Run it back · Episode 8\b/.test((await page.locator('[data-start-row="again-span"]').innerText().catch(() => "")) ?? ""), "  run back: the row moves on to the pool's (Episode 8)", await page.locator("[data-start-row]").innerText().catch(() => ""));

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
