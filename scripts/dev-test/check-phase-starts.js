// Dev-only check of games that start when a phase of the season starts (docs/PLAN-start-a-game-gpt.md step A3 part 2, "The
// phase start, decided"; src/lib/server/phase-starts.ts, settings.startPhase in state-logic.js), against the dev server, on
// new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three days off, 13
// episodes; Survivor's rulebook: Tribes, then Merged "when about 12 remain"). Added here: the desk's own admin (zt_nd_desk,
// site role admin, on no couch, as check-new-desk.js makes one).
//   API:
//   - Start a game offers "When Merged starts" (never Tribes, the first phase), with its start unknown. A first phase, a phase
//     the season hasn't got, a phase with a later episode or an end too: refused.
//   - jordan starts a Weekly Lineup when Merged starts (in the browser: the sheet's Starts › When Merged starts, its note, the
//     title "when Merged starts", no How long), a Survival Pool the same way, and an Outlast from Episode 9 that Game settings
//     switches to when Merged starts. Each waits: startPhase merged, no start episode, its spec { phase }; nothing asked (no
//     lineup, no pick), nothing scored, a side bet refused ("hasn't started"), Recent changes "from when Merged starts".
//   - Game settings: "When Merged starts, to the season's end", no end to choose while it waits; its start switches to an
//     episode (in the browser: With Episode 9, the toast, Undo back to waiting), never to the first phase, nor by someone who
//     doesn't run it.
//   - The desk confirms Merged began in Episode 5 (in the browser, as zt_nd_desk: the rulebook's "When did Merged start?"):
//     Episode 5 has aired, so every waiting game settles at Episode 6 ("Starts with Merged, at Episode 6" in Recent changes and
//     Game settings; the lineup game asks for Episode 6's lineup, the pool for its pick). A correction to Episode
//     8 moves them all to 8; one to 4 settles them at 6 again (nobody could make moves for 4 or 5); a clear sends them back to
//     waiting.
//   - The season sync settles what the desk didn't: Episode 6's results come in, every one post-merge (a clean switch,
//     db/rulebooks.js knownPhaseStarts), so the sync confirms Merged at 6 on the rulebook and every waiting game settles at 7.
//     Once 6 and 7 have aired, a desk correction to 9 moves none of them
//     (their start has aired), Game settings' start is frozen, and a new game when Merged starts (known, and ahead: Episode 9)
//     is settled at Start a game.
//   - The game-specs flag's check (scripts/game-specs-flag.js checkLeague) passes on a waiting and a settled game, and every
//     game jordan started carries the spec its fields play. With the flag off (as in production) no game carries one: each
//     span is compared as its fields read (specOf), and the carried-spec checks print a NOTE instead.
//   In a real browser at --width (390 by default): Start a game, the Games tab ("Starts when Merged starts ·"), Game settings
//   (waiting, switched, settled) and the desk's confirmation. Nothing wider than the screen; no page errors. Screenshots go to
//   <outDir>.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-phase-starts.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-phase-starts runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-phase-starts.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const DESK = "zt_nd_desk";

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
    const couch = fx.couchId;
    const sid = fx.seasonId;
    // Results an admin accepted reach every league on the season, as on Survivor 51.
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on no couch.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);

    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "jordan"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    as.desk = await api({ user: DESK, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    // The carried spec's span with the game-specs flag on; off (as in production), nothing carries one, so it's the span the
    // fields read as (specOf).
    const specsOn = await GameSpecs.gameSpecsOn(pool);
    if (!specsOn) console.log("NOTE  the game-specs flag is off: spans are compared as the fields read them (specOf), not a carried spec");
    const span = async (id) => {
      const s = (await league(id)).state.settings;
      return { phase: s.startPhase ?? null, at: s.startEpisode ?? null, to: s.endEpisode ?? null, game: specsOn ? (s.game ? s.game.span : undefined) : G.specOf(s).span };
    };
    const opts = async () => (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    const start = (body) => as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, body);
    const gamesOf = async () => (await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games;
    const changes = async () => ((await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines ?? []).map((l) => l.text);
    const settingsOf = async (id) => (await as.jordan.call("GET", `/api/seasons/${sid}/backstage/settings${q}`)).body.games.find((x) => x.leagueId === id);
    const setSettings = (who, id, set) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { leagueId: id, set, text: `Changed where it starts: ${JSON.stringify(set)}` });
    // The season's rulebook (the desk's season page makes it), and the desk's phase write.
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    const rbRow = async () => (await pool.query("SELECT phase_starts, blocks FROM rulebooks WHERE id = $1", [rb])).rows[0];
    check(!!rb && (await rbRow()).blocks.season.phases.map((p) => p.id).join() === "tribes,merged" && !(await rbRow()).phase_starts.merged, "the season's rulebook: Tribes, then Merged (its start unknown)", JSON.stringify(season.rulebook));
    const confirm = (episode) => as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode });

    // ---------- Start a game: When Merged starts ----------
    const o = await opts();
    check(o.phases?.length === 1 && o.phases[0].id === "merged" && o.phases[0].name === "Merged" && o.phases[0].at === null && !!o.phases[0].summary, "Start a game: When Merged starts (its start unknown), never Tribes", JSON.stringify(o.phases));
    for (const [body, why] of [
      [{ phase: "tribes" }, "the first phase (that's Episode 1)"],
      [{ phase: "finale" }, "a phase the season hasn't got"],
      [{ phase: "merged", from: 9 }, "with a later episode too"],
      [{ phase: "merged", to: 9 }, "with an end"],
    ]) {
      const r = await start({ game: "outlast", tell: false, ...body });
      check(r.status === 400, `  a start at ${why}: refused`, `${r.status} ${JSON.stringify(r.body)}`);
    }

    let b = null;
    let d = null;
    let n = 0;
    const shot = async (page, name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
    const wide = async (page, what) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
    };
    let LINEUP = null;
    if (!apiOnly) {
      b = await open({ user: "zt_nd_jordan", pass: PASSWORD, width, height: 844 });
      closers.push(b.close);
      const { page } = b;
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-start-row]").waitFor();
      await page.locator("[data-start-row]").click();
      const sheet = page.locator('[data-start-sheet="competition"]');
      await sheet.waitFor();
      await sheet.locator('[data-start-game="weeklyLineup"]').click();
      const starts = sheet.locator("[data-start-from]");
      await starts.waitFor();
      const merged = starts.locator('[data-start-from-choice="phase:merged"]');
      check(/When Merged starts/.test(await merged.innerText()) && /individual/i.test(await merged.innerText()), "the sheet: Starts offers When Merged starts, with what it is", await merged.innerText());
      await merged.click();
      await page.locator("text=ZT Survivor · when Merged starts").first().waitFor({ timeout: 10000 }).catch(() => {});
      check((await merged.getAttribute("aria-checked")) === "true" && (await page.locator("text=ZT Survivor · when Merged starts").count()) > 0, "  chosen: the title says when Merged starts");
      check(/It waits for Merged to start/.test((await sheet.locator("[data-start-from-note]").textContent()) ?? "") && (await sheet.locator("[data-start-span]").count()) === 0, "  its note says it waits, and How long goes (it runs to the season's end)");
      await starts.scrollIntoViewIfNeeded();
      await shot(page, "start-when-merged");
      await wide(page, "Start a game, when Merged starts");
      await sheet.locator("[data-start-go]").click();
      await page.locator("text=Weekly Lineup started").first().waitFor({ timeout: 20000 });
      const { rows } = await pool.query("SELECT id FROM leagues WHERE created_by = $1 AND state->'settings'->>'startPhase' = 'merged' AND deleted_at IS NULL", [fx.users.jordan]);
      LINEUP = rows[0]?.id ?? null;
    } else {
      const r = await start({ game: "weeklyLineup", tell: false, phase: "merged" });
      check(r.status === 200 && r.body.phase === "merged" && r.body.from === null, "jordan starts Weekly Lineup when Merged starts", JSON.stringify(r.body));
      LINEUP = r.body.leagueId;
    }
    check(!!LINEUP && G.sameValue(await span(LINEUP), { phase: "merged", at: null, to: null, game: { from: { phase: "merged" }, to: null } }), "the Weekly Lineup waits: startPhase merged, no start episode, its spec { phase }", JSON.stringify(LINEUP && (await span(LINEUP))));
    let r = await start({ game: "survivalPool", tell: false, phase: "merged" });
    const POOL = r.body.leagueId;
    check(r.status === 200 && (await span(POOL)).phase === "merged" && (await span(POOL)).at === null, "a Survival Pool when Merged starts, waiting too", JSON.stringify(r.body));
    r = await start({ game: "outlast", tell: false, from: 9 });
    const OUTLAST = r.body.leagueId;
    check(r.status === 200 && (await span(OUTLAST)).at === 9, "an Outlast from Episode 9", JSON.stringify(r.body));
    check((await changes()).some((t) => /started Weekly Lineup from when Merged starts/.test(t)), "  Recent changes: started Weekly Lineup from when Merged starts", JSON.stringify((await changes()).slice(0, 4)));

    // ---------- While it waits ----------
    let games = await gamesOf();
    const gl = games.find((g) => g.leagueId === LINEUP);
    const gp = games.find((g) => g.leagueId === POOL);
    check(gl?.from === null && gl.phase === "Merged" && gl.lineup === null && gl.over === false && gl.table.every((t) => t.total === 0), "while it waits: no start, the phase by name, no lineup asked for, nothing scored, not over", JSON.stringify(gl && { from: gl.from, phase: gl.phase, lineup: gl.lineup, over: gl.over }));
    check(gp?.from === null && gp.pick === null, "  the pool asks for no pick", JSON.stringify(gp && { from: gp.from, pick: gp.pick }));
    const home = (await as.jordan.call("GET", "/api/me/home")).body;
    check(!(home.moves ?? []).some((m) => m.leagueId === LINEUP || m.leagueId === POOL), "  home asks nothing of either", JSON.stringify((home.moves ?? []).map((m) => [m.kind, m.leagueName])));
    r = await as.jordan.call("POST", `/api/leagues/${LINEUP}/episodes/upcoming/bets`, { label: "Who goes first?", points: 1 });
    check(r.status === 409 && /hasn't started/.test(r.body.error ?? ""), "  a side bet: refused, it hasn't started", `${r.status} ${JSON.stringify(r.body)}`);
    const join = (await as.alex.call("GET", `/api/couches/${couch}/games`)).body.games.find((g) => g.leagueId === LINEUP);
    check(join?.start === null && join.span === null && join.underway === false && join.ended === false, "  the couch's join list: no start yet, not underway", JSON.stringify(join && { start: join.start, span: join.span, underway: join.underway }));
    check((await as.alex.call("POST", `/api/couches/${couch}/games/${LINEUP}`, { action: "join" })).status === 200, "  alex joins it");

    // ---------- Game settings ----------
    let gs = await settingsOf(LINEUP);
    check(
      gs?.span.from === null && gs.span.phase?.name === "Merged" && gs.span.started === false && gs.span.ends.length === 0 && gs.span.phases.map((p) => p.id).join() === "merged" && gs.span.starts.map((e) => e.number).join() === "6,7,8,9,10,11,12,13",
      "Game settings: waits for Merged, no end to choose yet; its start can be Merged or any episode still to come",
      JSON.stringify(gs?.span)
    );
    check(gs.span.starts.every((e) => !("title" in e)) && gs.span.ends.every((e) => !("title" in e)), "  numbers only: no episode titles in its lists");
    r = await setSettings("jordan", OUTLAST, { startPhase: "merged" });
    check(r.status === 200 && G.sameValue(await span(OUTLAST), { phase: "merged", at: null, to: null, game: { from: { phase: "merged" }, to: null } }), "  the Outlast from Episode 9 switched to when Merged starts: it waits", JSON.stringify(await span(OUTLAST)));
    r = await setSettings("jordan", OUTLAST, { startPhase: "tribes" });
    check(r.status === 400 && (await span(OUTLAST)).phase === "merged", "  never the first phase", `${r.status} ${JSON.stringify(r.body)}`);
    r = await setSettings("alex", LINEUP, { startEpisode: 9 });
    check(r.status >= 400 && (await span(LINEUP)).phase === "merged", "  alex plays it but doesn't run it: refused", `${r.status}`);
    r = await setSettings("jordan", LINEUP, { endEpisode: 10 });
    check(r.status === 400 && (await span(LINEUP)).to === null, "  no end while it waits", `${r.status} ${JSON.stringify(r.body)}`);
    if (b) {
      const { page } = b;
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const line = page.locator(`[data-span="${LINEUP}"]`);
      await line.waitFor({ timeout: 15000 }).catch(() => {});
      check(/Starts when Merged starts ·/.test((await line.textContent().catch(() => "")) ?? ""), "the Games tab: Starts when Merged starts", await line.textContent().catch(() => ""));
      await line.scrollIntoViewIfNeeded();
      await shot(page, "games-when-merged");
      await wide(page, "the Games tab");

      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const how = page.locator(`[data-settings-league="${LINEUP}"] [data-settings="span"]`);
      await how.waitFor({ timeout: 30000 });
      const text = await how.innerText();
      check(/When Merged starts, to the season's end/.test(text) && /It waits for Merged to start/.test(text) && (await how.locator("[data-span-end]").count()) === 0, "Backstage › Game settings: When Merged starts, to the season's end; it waits; no end to choose", text);
      check((await how.locator("[data-span-start]").inputValue()) === "phase:merged", "  Starts shows When Merged starts");
      await how.scrollIntoViewIfNeeded();
      await shot(page, "settings-waiting");
      await wide(page, "Game settings, waiting");
      await how.locator("[data-span-start]").selectOption("9");
      await page.locator("text=Weekly Lineup starts with Episode 9").first().waitFor({ timeout: 15000 });
      check(G.sameValue(await span(LINEUP), { phase: null, at: 9, to: null, game: { from: 9, to: null } }), "  With Episode 9: an episode start now (the phase goes), the toast says so", JSON.stringify(await span(LINEUP)));
      await page.getByRole("button", { name: "Undo" }).first().click();
      await page.locator("text=Undone").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      check(G.sameValue(await span(LINEUP), { phase: "merged", at: null, to: null, game: { from: { phase: "merged" }, to: null } }), "  Undo: waiting for Merged again", JSON.stringify(await span(LINEUP)));
    } else {
      r = await setSettings("jordan", LINEUP, { startEpisode: 9 });
      check(r.status === 200 && (await span(LINEUP)).phase === null && (await span(LINEUP)).at === 9, "  its start switched to Episode 9", JSON.stringify(r.body));
      r = await as.jordan.call("POST", `/api/seasons/${sid}/changes/${r.body.batch}/undo${q}`);
      check(r.status === 200 && (await span(LINEUP)).phase === "merged" && (await span(LINEUP)).at === null, "  Undo: waiting for Merged again", JSON.stringify(r.body));
    }

    // ---------- The desk confirms when Merged started ----------
    const ALL = [LINEUP, POOL, OUTLAST];
    const ats = async () => (await Promise.all(ALL.map(span))).map((s) => s.at);
    const settled = async (at) => (await Promise.all(ALL.map(span))).every((s) => s.phase === "merged" && s.at === at && G.sameValue(s.game, { from: { phase: "merged", at }, to: null }));
    if (!apiOnly) {
      d = await open({ user: DESK, pass: PASSWORD, width, height: 844 });
      closers.push(d.close);
      await d.page.goto(`${BASE}/desk/rulebook/${rb}`, { waitUntil: "load" });
      await d.page.locator("[data-desk-rulebook]").waitFor({ timeout: 30000 });
      const ask = d.page.locator("[data-confirm-phase='merged']");
      await ask.scrollIntoViewIfNeeded();
      await shot(d.page, "desk-when-did-merged-start");
      await wide(d.page, "the desk's rulebook");
      await ask.locator("[data-phase-episode='5']").click();
      await d.page.locator("text=Merged started in Episode 5").first().waitFor({ timeout: 20000 });
      await d.page.waitForTimeout(500);
    } else check((await confirm(5)).status === 200, "the desk confirms Merged began in Episode 5");
    check((await rbRow()).phase_starts.merged === 5, "the desk: Merged began in Episode 5");
    check(await settled(6), "  every waiting game settles at Episode 6 (Episode 5 has aired: nobody could make moves for it)", JSON.stringify(await ats()));
    check((await changes()).some((t) => /Starts with Merged, at Episode 6/.test(t)), "  Recent changes: Starts with Merged, at Episode 6", JSON.stringify((await changes()).slice(0, 4)));
    games = await gamesOf();
    check(games.find((g) => g.leagueId === LINEUP)?.lineup?.episode === 6 && games.find((g) => g.leagueId === POOL)?.pick?.episode === 6, "  the lineup game asks for Episode 6's lineup, the pool for its pick", JSON.stringify(games.filter((g) => ALL.includes(g.leagueId)).map((g) => [g.gameName, g.from, g.lineup?.episode, g.pick?.episode])));
    gs = await settingsOf(LINEUP);
    check(gs?.span.from === 6 && gs.span.phase?.id === "merged" && gs.span.started === false && gs.span.ends.length > 0, "  Game settings: from Episode 6, with Merged; its end can be chosen now", JSON.stringify(gs?.span));
    if (b) {
      const { page } = b;
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const how = page.locator(`[data-settings-league="${LINEUP}"] [data-settings="span"]`);
      await how.waitFor({ timeout: 30000 });
      check(/Episode 6 to the season's end/.test((await how.locator("[data-span-now]").textContent()) ?? "") && /Starts with Merged, at Episode 6/.test((await how.locator("[data-span-phase]").textContent().catch(() => "")) ?? "") && (await how.locator("[data-span-end]").count()) === 1, "Backstage › Game settings: Episode 6 to the season's end, Starts with Merged, at Episode 6", await how.innerText());
      await how.scrollIntoViewIfNeeded();
      await shot(page, "settings-settled");
      await wide(page, "Game settings, settled");
    }
    r = await confirm(8);
    check(r.status === 200 && (await settled(8)), "a correction to Episode 8 (before it airs): every game moves to 8", JSON.stringify(await ats()));
    r = await confirm(4);
    check(r.status === 200 && (await settled(6)), "  one to Episode 4: back to 6, the first anyone could make moves for", JSON.stringify(await ats()));
    r = await confirm(null);
    check(r.status === 200 && (await Promise.all(ALL.map(span))).every((s) => s.phase === "merged" && s.at === null), "  cleared: every game waits again", JSON.stringify(await ats()));
    check((await changes()).some((t) => /Waits for Merged to start again/.test(t)), "  Recent changes: Waits for Merged to start again");

    // ---------- The season sync settles what the desk didn't ----------
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const result = async (ep, postMerge) => {
      const name = (await league(fx.leagues.outlast)).state.castaways.find((c) => c.status === "active").name;
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), $4)`,
        [sid, ep, name, postMerge]
      );
      await syncSeasonLeagues(sid, null);
    };
    await result(6, true);
    check((await rbRow()).phase_starts.merged === 6, "Episode 6's results come in, every one post-merge: the season sync confirms Merged at 6 from them", JSON.stringify((await rbRow()).phase_starts));
    check(await settled(7), "  and settles every waiting game at 7 (6 has results)", JSON.stringify(await ats()));
    check(await (async () => { const g = (await gamesOf()).find((x) => x.leagueId === LINEUP); return g?.lineup?.episode === 7 && g.table.every((t) => t.total === 0); })(), "  the lineup game asks for Episode 7, nothing scored before it");

    // ---------- Once it's aired, it never moves ----------
    // Episodes 6 and 7 have aired.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 12 WHERE id = $1", [sid]);
    r = await confirm(9);
    check(r.status === 200 && (await settled(7)), "Episodes 6 and 7 aired: a desk correction to 9 moves none of them", JSON.stringify(await ats()));
    gs = await settingsOf(LINEUP);
    check(gs?.span.started === true && gs.span.phases.length === 0, "  Game settings: started, its start frozen", JSON.stringify(gs?.span));
    r = await setSettings("jordan", LINEUP, { startEpisode: 9 });
    check(r.status === 409 && (await span(LINEUP)).at === 7, "  a start moved after it's aired: refused", `${r.status} ${JSON.stringify(r.body)}`);
    const o2 = await opts();
    check(o2.phases.length === 1 && o2.phases[0].at === 9 && o2.nextEpisode === 8, "Start a game: When Merged starts · Episode 9 (known, and ahead)", JSON.stringify({ phases: o2.phases, next: o2.nextEpisode }));
    r = await start({ game: "weeklyLineup", tell: false, phase: "merged" });
    const LATE = r.body.leagueId;
    check(r.status === 200 && r.body.from === 9 && G.sameValue((await span(LATE)).game, { from: { phase: "merged", at: 9 }, to: null }), "  a Weekly Lineup when Merged starts: settled at Start a game, from Episode 9", JSON.stringify(r.body));
    const again = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}&again=${LINEUP}`)).body;
    check(again.again?.phase === "merged", "Run it back keeps the phase start where the season has it still to come", JSON.stringify(again.again));

    // ---------- The flag ----------
    const waiting = (await start({ game: "outlast", tell: false, phase: "merged" })).body.leagueId;
    await confirm(null);
    const checks = await Promise.all([waiting, LINEUP].map(async (id) => checkLeague((await league(id)).state)));
    check((await span(waiting)).at === null && (await span(LINEUP)).at === 7 && checks.every((c) => c.ok), "the game-specs flag's check: a waiting game and a settled one play the same carrying their spec", JSON.stringify(checks));
    if (specsOn) {
      const { rows: made } = await pool.query("SELECT id, state FROM leagues WHERE created_by = $1 AND deleted_at IS NULL", [fx.users.jordan]);
      const drifted = made.filter((l) => !G.sameValue(l.state.settings.game, G.specOf(l.state.settings))).map((l) => l.id);
      check(made.length >= 5 && !drifted.length, `the game-specs flag is on: the ${made.length} games jordan started still carry the spec their fields play`, drifted.join());
    } else console.log("NOTE  the game-specs flag is off: the carried-spec check was skipped");

    for (const x of [b, d]) if (x) check(x.errors.length === 0, `no page errors (${x === b ? "jordan" : "the desk"})`, x.errors.join(" | "));
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
