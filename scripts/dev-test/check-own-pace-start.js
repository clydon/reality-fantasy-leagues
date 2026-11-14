// Dev-only check of a game set at its own pace BEFORE its first episode airs (docs/PLAN-own-pace-games.md, "Pace is the game's
// setting", step 2: the user's decisions 2026-11-13): chosen when the game starts (the wizard's "When moves lock"), made and
// drafted as a live game is (the draft stays together), then waiting for people from its first results on, all season. Against
// the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51; results through Episode 5; Episode 6
// three days out). check-own-pace.js covers a game made on an episode that has aired; check-own-pace-live.js a live game's
// late window and its tiles. In order:
//   - API: the start options recommend own pace for a show (own, live, strict to choose from); a pace that isn't one is refused;
//     Game settings can't turn a live game to own pace. alex starts a Weekly Lineup (shared teams, a private draft) at its own
//     pace with a computer player; riley and jordan join before it starts. It's made as a live game: settings.ownPace and
//     startedTogether, no seat a late joiner, Game settings reads "own", the draft room lists it, nobody's asked to pick a team.
//   - The draft, together: everyone locks their picks in private and it reveals for all at once (the computer player too).
//   - Episode 6 airs (the season moved back four days), no results yet: riley's lineup for it is still taken, marked late, with
//     no closing time (the game waits).
//   - Episode 6's results land: every seat is catching up from 6 (the computer player too). alex reveals it through the one
//     reveal: caught up, the computer player with them; riley and jordan aren't. jordan, still on 5, changes their Episode 6
//     lineup after the results (their own copy): taken. jordan reveals 6: caught up, their mark here 6.
//   - Episode 7's results land: everyone who had caught up is catching up again (it keeps waiting all season).
//   - Screens at `--width` (390 by default): Start a game's sheet with "When moves lock" (the one line, then Change: the three
//     choices, Recommended on the first; At airtime chosen and back), nothing wider than the screen; Backstage > Game settings for
//     the game ("When you've watched it", chosen when it started; its lock row says who it stays open for), then alex's Tonight and
//     the game's own page with Episode 7 still to reveal (to look at: nothing asserted).
//
//   npm run dev   (or node scripts/lane.js dev; in another terminal)
//   node scripts/dev-test/check-own-pace-start.js [<outDir>] [--width=390] [--keep] [--no-shots]
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
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-own-pace-start runs against a local database only");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
const shots = !args.includes("--no-shots");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").split("=")[1]);
const outDir = args.find((a) => !a.startsWith("--")) || path.join(process.env.TEMP || "/tmp", "own-pace-start");
const WHO = ["alex", "riley", "jordan"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail !== undefined ? `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)}` : ""}`);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const couch = fx.couchId;
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const settingsOf = async (who, leagueId) => ((await as[who].call("GET", `/api/seasons/${sid}/backstage/settings?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === leagueId) ?? null;
    const gameIn = async (who, leagueId) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === leagueId) ?? null;
    const late = (st, pid) => st.players.find((p) => p.id === pid)?.lateJoin ?? null;
    const boot = async (n) => {
      const st = await stateOf(fx.leagues.lineup);
      const goner = st.castaways.filter((c) => c.status === "active").sort((a, b) => a.name.localeCompare(b.name))[0];
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
        [sid, n, goner.name]
      );
      await syncSeasonLeagues(sid, null);
    };

    // ---------- the choice, as the game starts ----------
    let r = await as.alex.call("GET", `/api/seasons/${sid}/start?wizard=1&couch=${couch}`);
    check(r.status === 200 && r.body.runs?.recommended === "own" && ["own", "live", "strict"].every((m) => (r.body.runs?.choices ?? []).includes(m)), "Start a game recommends own pace for a show, with live and strict to choose", r.body.runs ?? r.status);
    r = await as.alex.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "weeklyLineup", tell: false, pace: "whenever" });
    check(r.status === 400, "a pace that isn't one is refused", r.body);
    r = await as.alex.call("PATCH", `/api/seasons/${sid}/backstage/settings?couch=${couch}`, { leagueId: fx.leagues.lineup, pace: "own" });
    check(r.status === 400, "a running live game can't be turned to its own pace (chosen when a game starts)", r.body);
    r = await as.alex.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "weeklyLineup", tell: false, pace: "own", bots: 1 });
    const G = r.body.leagueId;
    check(r.status === 200 && !!G, "alex starts a Weekly Lineup at its own pace, from Episode 6, with a computer player", r.body);
    if (!G) throw new Error("no game to check");
    for (const who of ["riley", "jordan"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${G}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${G}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `${who} joins before it starts`, j.body);
    }
    let st = await stateOf(G);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [G])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pids[who] = player_id;
    }
    const bot = st.players.find((p) => p.automated)?.id;
    check(st.settings.ownPace === true && st.settings.startedTogether === true && S.GhostLogic.pace(st) === "own", "it's at its own pace, made before it aired", { ownPace: st.settings.ownPace, startedTogether: st.settings.startedTogether });
    check(st.players.every((p) => !p.lateJoin) && st.players.filter((p) => !p.disabled).length === 4, "  made as a live game: four seats, none a late joiner yet", st.players.map((p) => [p.name, p.lateJoin ?? null]));
    check((await settingsOf("alex", G))?.pace?.mode === "own", "  Game settings reads own pace", await settingsOf("alex", G).then((x) => x?.pace));
    r = await as.alex.call("GET", `/api/seasons/${sid}/changes?couch=${couch}`);
    check(JSON.stringify(r.body).includes("at their own pace"), "  Recent changes says it started at their own pace", r.status);
    r = await as.riley.call("GET", `/api/seasons/${sid}/draft?couch=${couch}`);
    check(r.status === 200 && (r.body.games ?? []).some((d) => d.leagueId === G), "  the draft room lists it: its draft is a live game's, together", (r.body.games ?? []).map((d) => d.leagueId));
    let g = await gameIn("riley", G);
    check(!!g && !g.pace?.team, "  nobody is asked to pick a team on their own", g?.pace ?? null);

    // ---------- the draft, together ----------
    r = await as.alex.call("POST", `/api/leagues/${G}/draft/force-start`, {});
    check(r.status === 200, "alex opens the draft", r.body);
    st = await stateOf(G);
    const size = S.GhostLogic.teamSize(st);
    const cast = st.castaways.filter((c) => c.status === "active").map((c) => c.id);
    for (const [i, who] of WHO.entries()) {
      r = await as[who].call("POST", `/api/leagues/${G}/draft/blind/lock`, { playerId: pids[who], castawayIds: cast.slice(i, i + size) });
      check(r.status === 200, `${who} locks ${size} in private`, r.body);
      if (i < WHO.length - 1) check(!S.BlindDraftLogic.isRevealed(await stateOf(G)), "  nothing shows until everyone's in");
    }
    st = await stateOf(G);
    const teamOf = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
    check(S.BlindDraftLogic.isRevealed(st) && [...WHO.map((w) => pids[w]), bot].every((pid) => teamOf(st, pid).length === size), "the draft reveals for everyone at once, the computer player's team too", { revealed: S.BlindDraftLogic.isRevealed(st), teams: st.players.map((p) => teamOf(st, p.id).length) });

    // ---------- Episode 6 airs; no results yet ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await syncSeasonLeagues(sid, null);
    st = await stateOf(G);
    const ep6 = st.episodes.find((e) => e.number === 6);
    const slots = S.ActiveRosterLogic.activeSlots(st);
    check(!!ep6 && !S.EpisodeLogic.hasResults(ep6) && !!ep6.airsAt && Date.parse(ep6.airsAt) < Date.now(), "Episode 6 has aired, its results not in", ep6 && { airsAt: ep6.airsAt });
    const putLineup = (who, ids, ep = ep6) => as[who].call("PUT", `/api/leagues/${G}/episodes/${ep.id}/lineups/${pids[who]}`, { castawayIds: ids });
    g = await gameIn("riley", G);
    check(g?.late?.episode === 6 && !g?.late?.until, "riley's view: Episode 6 still open after airtime, with no closing time (the game waits)", g?.late ?? null);
    r = await putLineup("riley", teamOf(st, pids.riley).slice(0, slots));
    st = await stateOf(G);
    check(r.status === 200 && st.episodes.find((e) => e.number === 6).lateSet?.[pids.riley] === true, "  riley's lineup for it is taken, and marked as set after it aired", r.body);

    // ---------- its results land: everyone is catching up from 6 ----------
    await boot(6);
    st = await stateOf(G);
    check(S.EpisodeLogic.hasResults(st.episodes.find((e) => e.number === 6)), "Episode 6's results are in");
    check(
      [...WHO.map((w) => pids[w]), bot].every((pid) => late(st, pid)?.startEpisode === 6 && late(st, pid)?.catchingUp === true && late(st, pid)?.seenThrough === 5),
      "every seat is catching up from Episode 6, the computer player too",
      st.players.map((p) => [p.name, p.lateJoin ?? null])
    );
    g = await gameIn("alex", G);
    check(!!g?.pace && (g.pace.others ?? []).length === 2 && g.pace.others.every((o) => o.week === 6), "  alex's view: at your own pace, riley and jordan on Episode 6", g?.pace ?? null);
    r = await as.alex.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch });
    st = await stateOf(G);
    check(r.status === 200 && late(st, pids.alex)?.catchingUp === false && late(st, pids.alex)?.seenThrough === 6, "alex reveals Episode 6: caught up", { status: r.status, late: late(st, pids.alex) });
    check(late(st, bot)?.catchingUp === false && late(st, bot)?.seenThrough === 6, "  the computer player with them", late(st, bot));
    check(late(st, pids.riley)?.catchingUp === true && late(st, pids.jordan)?.catchingUp === true, "  riley and jordan are where they were", [late(st, pids.riley), late(st, pids.jordan)]);
    // jordan, still on 5, changes their Episode 6 lineup after its results: their own copy has it open.
    const jTeam = teamOf(st, pids.jordan);
    r = await putLineup("jordan", jTeam.slice(-slots));
    st = await stateOf(G);
    check(r.status === 200 && JSON.stringify(st.episodes.find((e) => e.number === 6).lineups?.[pids.jordan]) === JSON.stringify(jTeam.slice(-slots)), "jordan, who hasn't watched it, sets their Episode 6 lineup after the results: taken", r.body);
    r = await putLineup("alex", teamOf(st, pids.alex).slice(-slots));
    check(r.status === 400, "  alex, who has, can't change theirs", r.body);
    r = await as.jordan.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch });
    st = await stateOf(G);
    const jMark = (await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [G, fx.users.jordan])).rows[0]?.results_seen_through ?? null;
    check(r.status === 200 && late(st, pids.jordan)?.catchingUp === false && jMark === 6, "jordan reveals Episode 6: caught up, their mark here 6", { status: r.status, late: late(st, pids.jordan), jMark });

    // ---------- the next results: it keeps waiting ----------
    await boot(7);
    st = await stateOf(G);
    check(S.EpisodeLogic.hasResults(st.episodes.find((e) => e.number === 7)), "Episode 7's results are in");
    check(
      [pids.alex, pids.jordan, bot].every((pid) => late(st, pid)?.catchingUp === true && late(st, pid)?.seenThrough === 6) && late(st, pids.riley)?.catchingUp === true && late(st, pids.riley)?.seenThrough === 5,
      "everyone who had caught up is catching up again from 7; riley is still on 6",
      st.players.map((p) => [p.name, p.lateJoin ?? null])
    );
    g = await gameIn("alex", G);
    check(g?.lineup?.episode === 7 && g?.lineup?.locked === false, "  alex's view: Episode 7's lineup open on their own copy", g?.lineup && { episode: g.lineup.episode, locked: g.lineup.locked });

    // ---------- screens ----------
    if (shots) {
      fs.mkdirSync(outDir, { recursive: true });
      let shotN = 0;
      const shot = async (page, name) => {
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(outDir, `${String(++shotN).padStart(2, "0")}-${name}.png`) });
      };
      const a = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
      a.page.setDefaultTimeout(20000);
      const errors = [];
      a.page.on("pageerror", (e) => errors.push(String(e)));
      try {
        await a.page.goto(`${a.BASE}/show/${sid}/games`);
        await a.page.locator("[data-start-row]").first().click();
        const paceBox = a.page.locator("[data-start-pace]");
        await paceBox.waitFor();
        await paceBox.scrollIntoViewIfNeeded();
        let said = ((await paceBox.textContent()) || "").replace(/\s+/g, " ");
        check((await paceBox.getAttribute("data-start-pace")) === "own" && /When moves lock/i.test(said) && /When you.ve watched it\./.test(said) && /the game waits for each of you/.test(said), "the wizard: When moves lock, own pace already chosen, in one line", said);
        const wide = await a.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const bb = await paceBox.boundingBox();
        check(wide <= 0 && !!bb && bb.x >= 0 && bb.x + bb.width <= width, "  nothing wider than the screen", { wide, bb });
        await shot(a.page, "wizard-when-moves-lock");
        await a.page.locator("[data-start-pace-change]").click();
        const choices = a.page.locator("[data-start-pace-choice]");
        check((await choices.count()) === 3 && (await a.page.locator("[data-start-pace-choice=own][aria-checked=true]").count()) === 1 && /Recommended/.test((await a.page.locator("[data-start-pace-choice=own]").textContent()) || ""), "  Change: three choices, the first chosen and Recommended");
        const tall = await choices.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        check(tall.every((h) => h >= 44), "  each a full tap target", tall);
        await paceBox.scrollIntoViewIfNeeded();
        await shot(a.page, "wizard-when-moves-lock-open");
        await a.page.locator("[data-start-pace-choice=strict]").click();
        await a.page.locator("[data-start-pace-change]").click();
        said = ((await paceBox.textContent()) || "").replace(/\s+/g, " ");
        check((await paceBox.getAttribute("data-start-pace")) === "strict" && /At airtime\./.test(said), "  At airtime chosen: the line says so", said);
        await shot(a.page, "wizard-at-airtime");
        await a.page.keyboard.press("Escape");
        await a.page.goto(`${a.BASE}/show/${sid}/backstage/settings`);
        const row = a.page.locator(`[data-settings=pace][data-pace=own]`).first();
        await row.waitFor();
        await row.scrollIntoViewIfNeeded();
        said = ((await row.textContent()) || "").replace(/\s+/g, " ");
        check(/When you.ve watched it\./.test(said) && /At your own pace/.test(said) && /Chosen when the game started/.test(said), "Game settings: When you've watched it, at your own pace, chosen when the game started", said);
        await shot(a.page, "settings-own-pace");
        check(/later for anyone who hasn.t watched it|still open to anyone who hasn.t watched it/.test((await a.page.locator("body").textContent()) || ""), "  its lock row says a move stays open for whoever hasn't watched");
        // Tonight and the game's own page, with Episode 7's results in and alex still to reveal it (as it looks on a season still airing).
        await a.page.goto(`${a.BASE}/show/${sid}/tonight`);
        await a.page.waitForLoadState("networkidle").catch(() => {});
        await a.page.waitForTimeout(1500);
        await shot(a.page, "tonight-own-pace-behind");
        await a.page.goto(`${a.BASE}/show/${sid}/game/${G}`);
        await a.page.locator("[data-game-strip], main").first().waitFor();
        await shot(a.page, "game-own-pace-behind");
        check(!errors.length, "no page errors", errors);
      } finally {
        await a.close();
      }
      console.log(`\nScreens in ${outDir}`);
    }
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
