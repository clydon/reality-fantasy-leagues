// Dev-only check of one person at their own pace on a live game (docs/PLAN-own-pace-games.md, "One person at their own pace on a
// live game", the user's decisions 2026-11-09): Backstage › Members' "Plays at their own pace" switch, a Commissioner's, per game;
// with it on, a live seat's moves for an aired episode stay open until they've watched it or the next one airs, then score as if
// on time; the couch's quiet marker ("Set after it aired, before they watched"); head to head's "Waiting on jordan's lineup"; their
// due move the yellow with the reason. On new-fixture.js's couch (ZT Survivor 51; alex runs the games, riley is a Game admin in
// Lineup League, results through 5), with Lineup League made head to head (its round robin pairs jordan with sam in Episode 6) and
// the season moved back four days, so Episode 6 aired a day ago (its results in) and Episode 7 is six days off. jordan, the one
// who plays at their own pace, has watched through 5; sam has watched 6.
// In order:
//   - API: alex switches it on for jordan in Lineup League (riley, a Game admin there, can't; nor anyone on a computer player);
//     jordan's game view has Episode 6 open (late, no reveal first), the home's moves list the lineup as late; riley's Episode 6
//     lineup is refused, jordan's is taken and marked late in the league's state; sam's view waits on jordan until it's set, then
//     marks jordan's Episode 6 square; once jordan's watched 6 (or the switch is off) the lineup is refused.
//   - A Prediction Sheet jordan starts before Episode 6 (alex and riley join; "Who goes home?" each episode): with jordan's own switch
//     on there (jordan runs it), jordan's Episode 6 answer is taken after airtime and riley's is refused.
//   - Head to head's records leave the waiting matchup out until it's set; Call it's Episode 6 calls are open to jordan (riley's are
//     closed); the reminders job's after-airtime push (db/reminders.js remindLate, a dry run) goes to jordan once, until it's set.
//   - Screens at `--width` (390 by default): alex's Members sheet for jordan with the switch (flipped there, the toast), jordan's
//     Tonight with the late card, sam's game page waiting on jordan, then after jordan sets it the grid's marker and its foot, and
//     jordan's week in the person sheet.
//
//   npm run dev   (or node scripts/lane.js dev; in another terminal)
//   node scripts/dev-test/check-own-pace-live.js [<outDir>] [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { api, open } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const { remindLate } = require("../../db/reminders.js");
const { loadSeasons } = require("../../db/season-clock.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-own-pace-live runs against a local database only");
const keep = process.argv.includes("--keep");
const width = Number((process.argv.find((a) => a.startsWith("--width=")) || "--width=390").split("=")[1]);
const outDir = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(process.env.TEMP || "/tmp", "own-pace-live");
const WHO = ["alex", "riley", "jordan", "sam"];
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const LATE = "Set after it aired, before they watched";

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const couch = fx.couchId;
    const L = fx.leagues.lineup;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pids[who] = player_id;
    }

    // Lineup League made head to head (no playoffs: the round robin only), as the engine writes a spec.
    let r0;
    let st = await league();
    if (specsOn) GameSpecs.carryGame(st.settings, true);
    const problems = S.setGame(st, { ...S.gameOf(st), rank: { by: "matchups" } }, { ctx: await questionContext(L, sid) });
    check(!problems.length, "Lineup League made head to head", problems);
    // Nobody's Episode 6 lineup set yet (the fixture sets some): jordan's carries in from 5.
    const six = st.episodes.find((e) => e.number === 6);
    if (six) six.lineups = {};
    await write(st);
    // A Prediction Sheet from Episode 6, started by jordan before it airs: "Who goes home?" each episode.
    r0 = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const QG = r0.body.leagueId;
    for (const who of ["alex", "riley"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
    }
    {
      const qs = (await pool.query("SELECT state FROM leagues WHERE id = $1", [QG])).rows[0].state;
      const qp = S.setGame(qs, { spec: 1, span: { from: S.gameOf(qs).span.from, to: null }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT] }, { ctx: await questionContext(QG, sid) });
      if (!qp.length) await pool.query("UPDATE leagues SET state = $1 WHERE id = $2", [JSON.stringify(qs), QG]);
      check(!!QG && !qp.length, "jordan's Prediction Sheet from Episode 6 (alex and riley in)", { start: r0.body, problems: qp });
    }

    // Episode 6 aired a day ago, its results in; 7 six days off.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    st = await league();
    const goner = st.castaways.filter((c) => c.status === "active").sort((a, b) => a.name.localeCompare(b.name))[0];
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, goner.name]
    );
    await syncSeasonLeagues(sid, null);
    // Final, not early (who went home only): every point in, so head to head plays Episode 6.
    st = await league();
    delete st.episodes.find((e) => e.number === 6).resultsStage;
    await write(st);
    await seen("jordan", 5);
    await seen("sam", 6);
    st = await league();
    const ep6 = st.episodes.find((e) => e.number === 6);
    check(!!ep6 && S.EpisodeLogic.hasResults(ep6), "Episode 6 has its results", ep6 && { airsAt: ep6.airsAt });
    const slots = S.ActiveRosterLogic.activeSlots(st);
    const roster = (who) => st.castaways.filter((c) => (c.ownerIds || []).includes(pids[who]) && (c.status === "active" || c.exitEpisodeId === ep6.id)).map((c) => c.id);
    const jordanLineup = roster("jordan").slice(0, slots);
    const putLineup = (who, ids) => as[who].call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${pids[who]}`, { castawayIds: ids });
    const pace = (who, target, on) => as[who].call("PUT", `/api/seasons/${sid}/backstage/members/${fx.users[target]}/pace?couch=${couch}`, { leagueId: L, on });

    // ---------- before the switch ----------
    let r = await putLineup("jordan", jordanLineup);
    check(r.status === 400, "without the switch, jordan's Episode 6 lineup is refused (it aired)", r.body);
    let g = await gameIn("jordan");
    check(g?.late === null && g?.revealFirst === 6, "  and jordan's view says reveal Episode 6 first", { late: g?.late, revealFirst: g?.revealFirst });

    // ---------- the switch ----------
    r = await pace("riley", "jordan", true);
    check(r.status === 403, "riley, a Game admin there, can't switch it", r.body);
    r = await pace("alex", "jordan", true);
    check(r.status === 200 && r.body.on === true, "alex, the Commissioner, switches it on for jordan in Lineup League", r.body);
    r = await as.alex.call("GET", `/api/seasons/${sid}/backstage/members?couch=${couch}`);
    const jm = (r.body.members ?? []).find((m) => m.userId === fx.users.jordan);
    check(!!jm && jm.pace.includes(L) && jm.seesAll === false && (r.body.games ?? []).find((x) => x.leagueId === L)?.pace === true, "  Members says so (pace), and that jordan doesn't see results as they come", jm);
    r = await as.alex.call("GET", `/api/seasons/${sid}/changes?couch=${couch}`);
    check(JSON.stringify(r.body).includes("jordan plays Weekly Lineup at their own pace"), "  a line in Recent changes", r.status);

    // ---------- jordan, behind ----------
    g = await gameIn("jordan");
    check(g?.late?.episode === 6 && g?.revealFirst === null && g?.lineup?.episode === 6 && g?.lineup?.locked === false, "jordan's view: Episode 6 open (late), no reveal first", { late: g?.late, revealFirst: g?.revealFirst, lineup: g?.lineup && { episode: g.lineup.episode, locked: g.lineup.locked } });
    r = await as.jordan.call("GET", "/api/me/home");
    const lateMove = (r.body.moves ?? []).find((m) => m.leagueId === L && m.kind === "lineup");
    check(!!lateMove && lateMove.late === true && lateMove.episode === 6, "  the home's moves list the Episode 6 lineup as late", lateMove);
    g = await gameIn("sam");
    check((g?.waiting ?? []).some((w) => w.playerId === pids.jordan && w.episode === 6), "sam's view waits on jordan for Episode 6", g?.waiting);
    check(g?.matchups?.last?.episode === 6 && g?.matchups?.last?.opponent === pids.jordan, "  sam's Episode 6 matchup is against jordan", g?.matchups?.last);
    r = await putLineup("riley", roster("riley").slice(0, slots));
    check(r.status === 400, "riley's Episode 6 lineup is refused (no switch)", r.body);
    const played = (gv, who) => {
      const rec = (gv?.table ?? []).find((x) => x.playerId === pids[who])?.record;
      return rec ? rec.wins + rec.losses + rec.ties : null;
    };
    check(played(g, "sam") === 5 && played(g, "jordan") === 5 && played(g, "alex") === 6 && g?.matchups?.record && g.matchups.record.wins + g.matchups.record.losses + g.matchups.record.ties === 5,
      "  sam's and jordan's records leave the waiting matchup out (5 played); alex's has 6", { sam: played(g, "sam"), jordan: played(g, "jordan"), alex: played(g, "alex"), mine: g?.matchups?.record });

    // Call it: Episode 6's calls, open to jordan, who hasn't watched it; riley (no switch) is past them.
    r = await as.jordan.call("GET", `/api/seasons/${sid}/calls/6?couch=${couch}`);
    const q6 = (r.body?.questions ?? [])[0];
    check(r.status === 200 && r.body.status === "open" && !!q6, "jordan's Episode 6 calls are open", r.body && { status: r.body.status, questions: (r.body.questions ?? []).length });
    if (q6) {
      r = await as.jordan.call("POST", `/api/seasons/${sid}/calls/6?couch=${couch}`, { calls: { [q6.key]: q6.options[0].key } });
      check(r.status === 200, "  a call for Episode 6 by jordan is taken", r.body);
      await pool.query("DELETE FROM episode_calls WHERE user_id = $1 AND season_id = $2 AND episode = 6", [fx.users.jordan, sid]);
      r = await as.riley.call("POST", `/api/seasons/${sid}/calls/6?couch=${couch}`, { calls: { [q6.key]: q6.options[0].key } });
      check(r.status === 409, "  riley's is refused (closed when it started)", r.body);
    }

    // The Prediction Sheet: jordan switches their own seat on (they run it), then answers Episode 6 after airtime; riley can't.
    r = await as.jordan.call("PUT", `/api/seasons/${sid}/backstage/members/${fx.users.jordan}/pace?couch=${couch}`, { leagueId: QG, on: true });
    check(r.status === 200, "jordan, its Commissioner, switches their own seat on in the Prediction Sheet", r.body);
    const still = st.castaways.filter((c) => c.status === "active").map((c) => c.name);
    const sheet = (await as.jordan.call("GET", `/api/seasons/${sid}/answers?league=${QG}`)).body;
    const boot = (sheet?.questions ?? []).find((x) => x.id === "boot");
    check(sheet?.episode === 6 && boot?.status === "open", "  jordan's sheet is Episode 6's, still open", sheet && { episode: sheet.episode, status: boot?.status });
    const qstate = (await pool.query("SELECT state FROM leagues WHERE id = $1", [QG])).rows[0].state;
    const someone = qstate.castaways.find((c) => c.status === "active")?.id ?? null;
    const answer = (who) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, { episode: 6, answers: { boot: someone } });
    r = await answer("jordan");
    check(r.status === 200 && someone !== null, "  jordan's Episode 6 answer is taken a day after it aired", { status: r.status, body: r.body?.error ?? r.body?.message, someone, still: still.length });
    r = await answer("riley");
    check(r.status === 409, "  riley's is refused", r.body);

    // The reminders job's after-airtime push, as a dry run (nothing sent or recorded).
    const seasonRows = await loadSeasons(pool, "ss.id = $1", [sid]);
    const seasons = new Map(seasonRows.map((x) => [`${x.slug}|${x.season_number}`, x]));
    const leagueRow = (await pool.query("SELECT id, name, state FROM leagues WHERE id = $1", [L])).rows[0];
    let reminded = await remindLate(pool, leagueRow, seasons, new Date(), { dry: true });
    check(reminded === 1, "the reminders job would tell jordan once that Episode 6's lineup is still theirs to set", reminded);

    // ---------- the screens, before jordan sets it ----------
    fs.mkdirSync(outDir, { recursive: true });
    let shotN = 0;
    const shot = async (page, name) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(outDir, `${String(++shotN).padStart(2, "0")}-${name}.png`) });
    };
    // Switch it off by API, then on again through alex's sheet, as a Commissioner would.
    await pace("alex", "jordan", false);
    const a = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    a.page.setDefaultTimeout(15000);
    try {
      await a.page.goto(`${a.BASE}/show/${sid}/backstage/members`);
      await a.page.locator("[data-member-menu$='jordan']").click();
      const sw = a.page.locator(`[data-own-pace] [data-setting='pace-${L}']`);
      await sw.waitFor();
      check((await sw.getAttribute("data-on")) === "off", "alex's sheet for jordan: the switch, off");
      check((await a.page.locator(`[data-own-pace] [data-setting='pace-${fx.leagues.outlast}']`).count()) === 1, "  one a game they play here");
      await sw.click();
      await a.page.locator(`[data-own-pace] [data-setting='pace-${L}'][data-on='on']`).waitFor();
      const toast = await a.page.getByRole("status").first().textContent().catch(() => "");
      check(/jordan plays Weekly Lineup at their own pace/.test(toast || ""), "  flipped on there, the toast says so", toast);
      await shot(a.page, "members-sheet-switch");
      const box = await a.page.locator("[data-member-sheet]").boundingBox();
      check(!!box && box.width <= width, "  the sheet fits the width", box);
    } finally {
      await a.close();
    }
    st = await league();
    check(S.GhostLogic.playsOwnPace(st, pids.jordan), "  and it's on in the league's state");

    const j = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844 });
    j.page.setDefaultTimeout(15000);
    try {
      await j.page.goto(`${j.BASE}/show/${sid}/tonight`);
      const card = j.page.locator(`[data-move='lineup-${L}']`);
      await card.waitFor();
      const text = (await card.textContent()) || "";
      check(/Episode 6 aired · you haven't watched it · set your lineup first/.test(text), "jordan's Tonight: the lineup card says why it's still due", text);
      await card.scrollIntoViewIfNeeded();
      await shot(j.page, "jordan-tonight-late");
      await j.page.goto(`${j.BASE}/show/${sid}/games`);
      const yours = j.page.locator(`[data-your-move='lineup']`).first();
      await yours.waitFor();
      check(/you haven't watched it/.test((await yours.textContent()) || ""), "  the Games tab's card too", await yours.textContent());
      await yours.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(j.page, "jordan-games-late");
    } finally {
      await j.close();
    }

    const sm = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    sm.page.setDefaultTimeout(15000);
    try {
      await sm.page.goto(`${sm.BASE}/show/${sid}/game/${L}`);
      const key = sm.page.locator("[data-waiting-key]");
      await key.waitFor();
      check(/Episode 6: waiting on jordan's lineup/.test((await key.textContent()) || ""), "sam's game page: the grid's foot says Episode 6 waits on jordan's lineup", await key.textContent());
      check((await sm.page.locator(`[data-square='${pids.sam}:6'] [data-waiting]`).count()) === 1 && (await sm.page.locator(`[data-square='${pids.jordan}:6'] [data-waiting]`).count()) === 1,
        "  both squares of that matchup are pending, not won or lost");
      check((await sm.page.locator(`[data-square='${pids.alex}:6'] [data-waiting]`).count()) === 0, "  alex and riley's matchup isn't");
      await key.scrollIntoViewIfNeeded();
      await shot(sm.page, "sam-game-waiting");
      await sm.page.locator(`[data-square='${pids.sam}:6']`).click();
      const waitLine = sm.page.locator("[data-week-pane='6'] [data-waiting-line]").first();
      await waitLine.waitFor();
      check(/Waiting on jordan's lineup/.test((await waitLine.textContent()) || ""), "  sam's Episode 6 in the sheet: Waiting on jordan's lineup", await waitLine.textContent());
      await shot(sm.page, "sam-sheet-waiting");
    } finally {
      await sm.close();
    }

    // ---------- jordan sets it late ----------
    r = await putLineup("jordan", jordanLineup);
    check(r.status === 200, "jordan's Episode 6 lineup is taken, a day after it aired", r.body);
    st = await league();
    const e6 = st.episodes.find((e) => e.number === 6);
    check(JSON.stringify((e6.lineups || {})[pids.jordan]) === JSON.stringify(jordanLineup) && e6.lateSet?.[pids.jordan] === true, "  stored, and marked set late", { lineup: (e6.lineups || {})[pids.jordan], lateSet: e6.lateSet });
    g = await gameIn("sam");
    check(!(g?.waiting ?? []).length, "sam's view no longer waits", g?.waiting);
    check(g?.plays?.rows?.[pids.jordan]?.find((q) => q.episode === 6)?.late === true, "  jordan's Episode 6 square is marked", g?.plays?.rows?.[pids.jordan]);
    check(played(g, "sam") === 6 && played(g, "jordan") === 6, "  both records count Episode 6 now", { sam: played(g, "sam"), jordan: played(g, "jordan") });
    reminded = await remindLate(pool, (await pool.query("SELECT id, name, state FROM leagues WHERE id = $1", [L])).rows[0], seasons, new Date(), { dry: true });
    check(reminded === 0, "  and the reminders job has nothing to say to jordan", reminded);
    g = await gameIn("jordan");
    check(g?.late?.episode === 6 && g?.lineup?.set === true, "jordan can still change it until watching", g?.late);

    const sm2 = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    sm2.page.setDefaultTimeout(15000);
    try {
      await sm2.page.goto(`${sm2.BASE}/show/${sid}/game/${L}`);
      const sq = sm2.page.locator(`[data-square='${pids.jordan}:6'][data-late]`);
      await sq.waitFor();
      check(((await sq.getAttribute("aria-label")) || "").includes(LATE), "sam's grid: jordan's Episode 6 square carries the marker, its label the sentence");
      check(((await sm2.page.locator("[data-late-key]").textContent()) || "").includes(LATE), "  the grid's foot says what the clock means");
      await sm2.page.locator("[data-late-key]").scrollIntoViewIfNeeded();
      await shot(sm2.page, "sam-grid-marker");
      await sq.click();
      const line = sm2.page.locator("[data-late-set]").first();
      await line.waitFor();
      check(((await line.textContent()) || "").includes(LATE), "  jordan's sheet, Episode 6: the same words");
      await shot(sm2.page, "sam-jordan-sheet");
    } finally {
      await sm2.close();
    }

    // ---------- watched, or switched off: closed ----------
    await seen("jordan", 6);
    r = await putLineup("jordan", roster("jordan").slice(1, slots + 1));
    check(r.status === 400, "once jordan's watched 6, the lineup is closed", r.body);
    await seen("jordan", 5);
    await pace("alex", "jordan", false);
    r = await putLineup("jordan", roster("jordan").slice(1, slots + 1));
    check(r.status === 400, "switched off, closed too", r.body);
    console.log(`\nScreens in ${outDir}`);
  } catch (e) {
    failures++;
    console.error(e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
