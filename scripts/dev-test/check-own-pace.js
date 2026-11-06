// Dev-only check of a game at your own pace (docs/PLAN-own-pace-games.md part 1: state-logic.js GhostLogic.paceAll, bot-logic.js
// catchUpTo, start-game.ts, couch-joins.ts, reveal.ts, season-games.ts; start-game.tsx, join-game.tsx, games.tsx) against the dev
// server, through the API and then the screens at 390px, on new-fixture.js's couch (alex, riley) and a REAL finished season in the
// local database (read only: the first completed one with accepted results, or --season=<id>). Every row it makes is the zt couch's.
//   - Start a game on the finished season as alex, up to Episode 3 there: the options aren't blocked, say your own pace, start
//     where alex is (Episode 4) or from the top; Survival Pool fits, the drafts don't (for now). Started with two computer players.
//   - The game: every seat catching up from 4, marks 3, settings.ownPace; alex's membership mark 3; the couch's list doesn't
//     call it ended; its join line says anyone joins from wherever they are.
//   - riley (seen nothing of it) joins: starts at Episode 4 (never before the game's start), catching up.
//   - alex picks for 4 and reveals it: the bots' picks for 4 land then (none before), from who was still in; alex's view moves to
//     5, the others line says riley · Ep 4; riley's strip says alex · Ep 5. alex reveals 5: the words warn "you'll be 2 ahead of
//     riley" on the way (the GET before), nothing blocks.
//   - Screens: Start a game's sheet (the strip, the two starts), the Games tab's row, the join sheet as riley, the catch-up strip
//     and sheet as alex with the gap words.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-own-pace.js [outDir] [--season=<showSeasonId>] [--keep] [--no-shots]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const { api, open } = require("./browser");
const fixture = require("./new-fixture");
const fakeBot = require("./fake-bot");
const bingo = require("./bingo-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-own-pace runs against a local database only");
const args = process.argv.slice(2);
const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const keep = args.includes("--keep");
const shots = !args.includes("--no-shots");
const outDir = args.find((a) => !a.startsWith("--")) || path.join(process.env.TEMP || ".", "own-pace");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${!ok && detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}` : ""}`);
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  const season =
    flag("season") ||
    (
      await pool.query(
        `SELECT ss.id FROM show_seasons ss WHERE ss.status = 'completed' AND EXISTS (SELECT 1 FROM season_decisions d WHERE d.season_id = ss.id AND d.status = 'accepted')
          ORDER BY ss.season_number DESC LIMIT 1`
      )
    ).rows[0]?.id;
  if (!season) throw new Error("no finished season with accepted results in the local database: pass --season=<id>");
  const fx = await fixture.up(pool);
  const couch = fx.couchId;
  // A stand-in bot (never ChatGPT) for the season's bingo bank, which starting a game at your own pace asks for when the season
  // has none: 30 squares written, every one passing the check. Only a season with no bank of its own is asked (and cleaned).
  const fb = await fakeBot.start({
    answer: (prompt) => {
      if (fakeBot.kindOf(prompt) === "bingoCheck") {
        const n = (prompt.match(/^\d+\. /gm) || []).length;
        const checks = Array.from({ length: n }, (_, i) => ({ n: i + 1, seen: true, likely: true, scoring: false, spoiler: false, sameAs: null, likelihood: null, note: "" }));
        return "```json\n" + JSON.stringify({ checks }) + "\n```";
      }
      return bingo.answer(bingo.squares({ likely: 10, maybe: 14, longshot: 6 }));
    },
  });
  const hadBank = (await pool.query("SELECT EXISTS (SELECT 1 FROM bingo_squares WHERE season_id = $1 AND episode IS NULL) AS has", [season])).rows[0].has;
  const alex = await api({ user: fixture.username("alex"), pass: PASSWORD, headers: { "x-gys-bot": fb.url } });
  const riley = await api({ user: fixture.username("riley"), pass: PASSWORD });
  let leagueId = null;
  try {
    // alex is up to Episode 3 of the finished season; riley hasn't started it.
    let r = await alex.call("PUT", `/api/me/follows/${season}`, { following: true, seenThrough: 3 });
    check(r.status === 200, "alex follows the finished season, up to Episode 3", r.body);

    // Start a game: the options.
    r = await alex.call("GET", `/api/seasons/${season}/start?couch=${couch}`);
    check(r.status === 200, "start options read", r.body);
    const o = r.body;
    check(o.blocked === null, "a finished season isn't blocked", o.blocked);
    check(o.ownPace === true && o.pace && o.pace.here === 4 && o.pace.top === 1, "at your own pace, from where alex is (Episode 4) or the top", o.pace);
    check(o.from === 4, "starts where alex is by default", o.from);
    const pool_ = (o.games || []).find((g) => g.key === "survivalPool");
    check(pool_ && pool_.fits && pool_.bots, "Survival Pool fits, with computer players", pool_);
    check((o.games || []).filter((g) => g.key !== "survivalPool").every((g) => !g.fits), "the other games wait (for now)", o.games.map((g) => [g.key, g.fits]));
    r = await alex.call("GET", `/api/seasons/${season}/start?couch=${couch}&start=1`);
    check(r.status === 200 && r.body.from === 1 && r.body.ownPace === true, "from the top is a start too", r.body.from);

    // Start it, with two computer players.
    r = await alex.call("POST", `/api/seasons/${season}/start?couch=${couch}`, { game: "survivalPool", tell: false, bots: 2, level: "normal" });
    check(r.status === 200 && r.body.leagueId, "started Survival Pool at alex's own pace with two computer players", r.body);
    leagueId = r.body.leagueId;
    if (hadBank) console.log("info: the season has a bingo bank already: nothing to ask the bot for");
    else {
      // The season's bank, asked of the stand-in after the answer: in within a couple of minutes.
      let live = 0;
      for (let t = 0; t < 120 && !live; t++) {
        await new Promise((res) => setTimeout(res, 1000));
        live = (await pool.query("SELECT count(*)::int AS n FROM bingo_squares WHERE season_id = $1 AND episode IS NULL AND status = 'live'", [season])).rows[0].n;
      }
      check(live >= 16, "starting it asked our bot for the season's bingo bank, and it's in", { live, asked: fb.asked.length });
    }
    check(r.body.from === 4, "from Episode 4", r.body.from);
    const stateOf = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId])).rows[0].state;
    let s = await stateOf();
    check(s.settings.ownPace === true, "settings.ownPace");
    check(s.players.length === 3 && s.players.every((p) => p.lateJoin && p.lateJoin.startEpisode === 4 && p.lateJoin.catchingUp && p.lateJoin.seenThrough === 3), "every seat, the bots too, catching up from 4 with its mark at 3", s.players.map((p) => p.lateJoin));
    check(s.players.every((p) => !p.ghost), "nobody's a ghost");
    const mark = async (who) => (await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, who])).rows[0]?.results_seen_through;
    check((await mark(fx.users.alex)) === 3, "alex's membership mark is 3", await mark(fx.users.alex));

    // The couch's list: not ended, joinable from wherever you are.
    r = await riley.call("GET", `/api/couches/${couch}/games`);
    const jg = (r.body.games || []).find((g) => g.leagueId === leagueId);
    check(jg && !jg.ended && jg.ownPace === true && jg.mode === "open", "on the couch's list: not ended, at your own pace, open", jg);
    r = await riley.call("GET", `/api/couches/${couch}/games/${leagueId}`);
    check(r.status === 200 && r.body.starts && r.body.starts.live === 4 && r.body.starts.catchUp === null, "riley (seen nothing) would start at Episode 4: nothing to choose", r.body.starts);

    // riley joins.
    r = await riley.call("POST", `/api/couches/${couch}/games/${leagueId}`, { action: "join" });
    check(r.status === 200 && r.body.start === 4 && r.body.catchingUp === true, "riley joined, catching up from 4", r.body);
    s = await stateOf();
    const rp = s.players.find((p) => !p.automated && p.lateJoin && p.id !== s.players[0].id);
    check(rp && rp.lateJoin.seenThrough === 3 && !rp.ghost, "riley's seat: mark 3, in the open", rp && rp.lateJoin);

    // alex's games read: catching up, the others line.
    r = await alex.call("GET", `/api/seasons/${season}/games?couch=${couch}`);
    let gv = (r.body.games || []).find((g) => g.leagueId === leagueId);
    check(gv && gv.catchUp && gv.catchUp.week === 4, "alex's week is Episode 4", gv && gv.catchUp);
    check(gv && gv.ownPace === true && gv.pace && gv.pace.others.length === 1 && gv.pace.others[0].week === 4 && gv.pace.last >= 5, "the others: riley on 4 (no bots in it); the season's last episode", gv && gv.pace);
    check(gv && gv.pick && !gv.pick.pick, "a pick to make for Episode 4", gv && gv.pick);
    // alex picks: the first castaway offered.
    const ep4 = s.episodes.find((e) => e.number === 4);
    const castId = gv && gv.pick && gv.pick.available ? gv.pick.available[0] : null;
    if (castId) {
      r = await alex.call("PUT", `/api/leagues/${leagueId}/episodes/${ep4.id}/picks`, { playerId: gv.playerId, castawayId: castId });
      check(r.status === 200, "alex's pick for Episode 4 lands (an aired episode, open in alex's copy)", r.body);
    } else check(false, "alex has castaways to pick from", gv.pick);
    s = await stateOf();
    check(!(ep4.picks || []).some((p) => s.players.find((x) => x.id === p.playerId)?.automated), "no bot pick before anyone reveals 4");

    // alex reveals Episode 4: the bots pick for 4 then.
    r = await alex.call("POST", `/api/seasons/${season}/catchup`, { leagueId, couch });
    check(r.status === 200 && r.body.episode === 4 && r.body.next === 5, "alex revealed Episode 4, next 5", r.body);
    s = await stateOf();
    const e4 = s.episodes.find((e) => e.number === 4);
    const bots = s.players.filter((p) => p.automated);
    const botPicks = (e4.picks || []).filter((p) => bots.some((b) => b.id === p.playerId));
    check(botPicks.length === 2, "both bots picked for Episode 4 the moment alex revealed it", e4.picks);
    const goneBefore4 = new Set(s.castaways.filter((c) => c.exitEpisodeId && s.episodes.find((e) => e.id === c.exitEpisodeId)?.number < 4).map((c) => c.id));
    check(botPicks.every((p) => !goneBefore4.has(p.castawayId)), "the bots picked from who was still in before 4");
    check(bots.every((b) => b.lateJoin.seenThrough === 4), "the bots' marks moved to 4", bots.map((b) => b.lateJoin));
    check((await mark(fx.users.alex)) === 4, "alex's mark is 4");

    // riley's strip: alex · Ep 5. alex's: riley · Ep 4, and revealing 5 would be two ahead.
    r = await riley.call("GET", `/api/seasons/${season}/games?couch=${couch}`);
    gv = (r.body.games || []).find((g) => g.leagueId === leagueId);
    check(gv && gv.catchUp && gv.catchUp.week === 4 && gv.pace.others[0].week === 5, "riley: on 4, alex on 5", gv && gv.pace);
    r = await alex.call("GET", `/api/seasons/${season}/games?couch=${couch}`);
    gv = (r.body.games || []).find((g) => g.leagueId === leagueId);
    check(gv && gv.catchUp && gv.catchUp.week === 5 && gv.pace.others[0].week === 4, "alex: on 5, riley on 4", gv && gv.pace);
    check(gv && gv.catchUp && gv.catchUp.latest >= 5, "the game has results past 5 to play", gv && gv.catchUp);
    if (!hadBank) {
      r = await alex.call("GET", `/api/seasons/${season}/bingo/5?couch=${couch}`);
      check(r.status === 200 && r.body.status === "open" && r.body.squares.length === 9, "alex's Episode 5 bingo card, dealt from the season's bank, open to tick", r.body && { status: r.body.status, n: r.body.squares?.length });
    }

    // Part 2: the one-night games follow your episode. Call it for alex's next (5) is open on the honour system, the one after
    // waits, the one alex has seen is closed and says how the calls went.
    r = await alex.call("GET", `/api/seasons/${season}/calls/5?couch=${couch}`);
    check(r.status === 200 && r.body.status === "open" && r.body.paced === true && r.body.questions.length > 0, "Call it for Episode 5 (aired, alex's next) is open", r.body && { status: r.body.status, paced: r.body.paced, q: r.body.questions?.length });
    const q5 = r.body.questions && r.body.questions[0];
    if (q5) {
      const x = await alex.call("POST", `/api/seasons/${season}/calls/5?couch=${couch}`, { calls: { [q5.key]: q5.options[0].key } });
      check(x.status === 200 && x.body.mine[q5.key] === q5.options[0].key, "alex calls Episode 5", x.body);
    }
    r = await alex.call("GET", `/api/seasons/${season}/calls/6?couch=${couch}`);
    check(r.status === 200 && r.body.status === "behind" && r.body.catchUp === 5, "Episode 6's calls wait for 5", r.body && { status: r.body.status, catchUp: r.body.catchUp });
    r = await alex.call("GET", `/api/seasons/${season}/calls/4?couch=${couch}`);
    check(r.status === 200 && r.body.status === "closed" && !!r.body.verdicts, "Episode 4 (seen) is closed, with how the calls went", r.body && { status: r.body.status, verdicts: !!r.body.verdicts });
    r = await alex.call("POST", `/api/seasons/${season}/calls/4?couch=${couch}`, { calls: { out: null } });
    check(r.status === 409, "a call on an episode alex has seen is refused", r.body);

    if (shots) {
      fs.mkdirSync(outDir, { recursive: true });
      let n = 0;
      const shot = async (page, name) => {
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
      };
      const RILEY = fixture.username("riley");
      // alex: the Games tab's row, Start a game's sheet (the mock: no banner, no AI card, no How long; number-first starts and the
      // pace line), then Tonight's plate: asking once before a reveal with no pick, then picked, the gap words, the reveal.
      const a = await open({ user: fixture.username("alex"), pass: PASSWORD, width: 390, height: 844 });
      a.page.setDefaultTimeout(15000);
      try {
        await a.page.goto(`${a.BASE}/show/${season}/games`);
        await a.page.locator("[data-start-row='pace']").waitFor();
        await a.page.locator("[data-this-week]").waitFor();
        check((await a.page.getByText("Your Episode 5", { exact: true }).count()) === 1, "the Games tab says Your Episode 5, not This week");
        // One of its calls made (there may be two): the row is there for Episode 5, made or not.
        check((await a.page.locator("[data-this-week] [data-call-row='5']").count()) === 1, "with Call it for Episode 5");
        await a.page.locator("[data-this-week]").scrollIntoViewIfNeeded();
        await shot(a.page, "games-your-episode");
        await a.page.locator("[data-start-row='pace']").click();
        await a.page.locator("[data-start-pace-line]").waitFor();
        await shot(a.page, "start-sheet");
        check((await a.page.locator("[data-start-from-choice='here']").count()) === 1 && (await a.page.locator("[data-start-from-choice='top']").count()) === 1, "Start from: where you are, and from the top");
        const here = await a.page.locator("[data-start-from-choice='here']").textContent();
        // alex has revealed 4 by now (above), so where alex is is 5.
        check(/Episode 5 · where you are/.test(here || "") && /You've seen 1 to 4/.test(here || ""), "the tile reads number first and says what you've seen", here);
        check((await a.page.locator("[data-start-span], [data-no-fit]").count()) === 0 && (await a.page.getByText("Create a game with AI").count()) === 0, "no AI card, no How long, no doesn't-fit line at your own pace");
        await a.page.keyboard.press("Escape");

        await a.page.goto(`${a.BASE}/show/${season}/tonight`);
        const plate = a.page.locator(`[data-pace-plate='${leagueId}']`);
        await plate.waitFor();
        check((await a.page.locator(`[data-catchup='${leagueId}']`).count()) === 0, "no catching-up strip for an own-pace game");
        check((await a.page.locator("[data-phase]").count()) === 0, "no episode heading saying it again");
        check(/Pick who survives/.test((await plate.textContent()) || ""), "the plate asks for the pick first");
        await shot(a.page, "tonight-plate-pick");
        await plate.locator("[data-pace-watched]").click();
        await plate.locator("[data-pace-ask]").waitFor();
        await shot(a.page, "tonight-plate-ask");
        // The pick, through the API (the moves sheet is its own check's), then the plate's next step.
        const g5 = ((await alex.call("GET", `/api/seasons/${season}/games?couch=${couch}`)).body.games || []).find((g) => g.leagueId === leagueId);
        const ep5 = (await stateOf()).episodes.find((e) => e.number === 5);
        r = await alex.call("PUT", `/api/leagues/${leagueId}/episodes/${ep5.id}/picks`, { playerId: g5.playerId, castawayId: g5.pick.available[0] });
        check(r.status === 200, "alex picks for Episode 5", r.body);
        await a.page.reload();
        await plate.locator("[data-pace-reveal]").waitFor();
        await shot(a.page, "tonight-plate-watch");
        const ahead = await plate.locator("[data-pace-reveal]").getAttribute("data-pace-ahead");
        // Names are as the couch shows them everywhere (couchMembers: the username).
        check(ahead === `you'll be 2 ahead of ${RILEY}`, "the reveal button says you'll be 2 ahead of riley", ahead);
        await plate.locator("[data-pace-reveal]").click();
        await a.page.locator("[data-pace-revealed='5']").waitFor();
        await shot(a.page, "revealed-sheet");
        check((await a.page.locator("[data-pace-next]").textContent())?.includes("Pick for Episode 6"), "the way on is Pick for Episode 6");
        check((await a.page.locator("[data-pace-later]").count()) === 1, "and Done for now");
      } finally {
        await a.close();
      }

      // riley: Tonight's plate on Episode 4, quiet about alex (ahead).
      const b = await open({ user: RILEY, pass: PASSWORD, width: 390, height: 844 });
      b.page.setDefaultTimeout(15000);
      try {
        await b.page.goto(`${b.BASE}/show/${season}/tonight`);
        const plate = b.page.locator(`[data-pace-plate='${leagueId}']`);
        await plate.waitFor();
        check((await plate.getAttribute("data-pace-week")) === "4", "riley's plate is on Episode 4");
        check((await plate.locator("[data-pace-near]").count()) === 0, "nobody's behind riley: no line about it");
        await shot(b.page, "riley-plate");
      } finally {
        await b.close();
      }

      // jordan (not in it): the join sheet, a statement with who's playing and where.
      const c = await open({ user: fixture.username("jordan"), pass: PASSWORD, width: 390, height: 844 });
      c.page.setDefaultTimeout(15000);
      try {
        await c.page.goto(`${c.BASE}/show/${season}/games`);
        await c.page.locator(`[data-league='${leagueId}'] [data-join-button]`).click();
        await c.page.locator("[data-join-pace]").waitFor();
        await c.page.locator("[data-join-playing]").waitFor();
        await shot(c.page, "join-sheet");
        const who = (await c.page.locator("[data-join-playing]").textContent()) || "";
        check(/Keeps pace/.test(who) && /On Episode 6/.test(who) && /On Episode 4/.test(who), "who's playing: alex on 6, riley on 4, the computers keep pace", who);
      } finally {
        await c.close();
      }

      // alex plays to the end (reveals with no pick): the finish plate.
      for (let k = 0; k < 40; k++) {
        const x = await alex.call("POST", `/api/seasons/${season}/catchup`, { leagueId, couch });
        if (x.status !== 200 || x.body.next === null) break;
      }
      const d = await open({ user: fixture.username("alex"), pass: PASSWORD, width: 390, height: 844 });
      d.page.setDefaultTimeout(15000);
      try {
        await d.page.goto(`${d.BASE}/show/${season}/tonight`);
        const fin = d.page.locator(`[data-pace-finish='${leagueId}']`);
        await fin.waitFor();
        const text = (await fin.textContent()) || "";
        check(/You finished it/.test(text) && /of 4/.test(text) && new RegExp(`${RILEY} is on Episode 4`).test(text), "the finish plate: your place of 4 (two computers), riley still on 4 with it hidden", text);
        await shot(d.page, "finish-plate");
      } finally {
        await d.close();
      }
      console.log(`screens in ${outDir}`);
    }
  } finally {
    await fb.close();
    if (!keep) {
      if (leagueId) await pool.query("DELETE FROM leagues WHERE id = $1", [leagueId]);
      // Only what this check made on the real season: its bingo bank (when it had none), its runs, the zt cards.
      await pool.query("DELETE FROM bingo_cards WHERE season_id = $1 AND user_id = ANY($2::text[])", [season, Object.values(fx.users)]);
      if (!hadBank) {
        await pool.query("DELETE FROM bingo_squares WHERE season_id = $1 AND episode IS NULL", [season]);
        await pool.query("DELETE FROM bot_research_runs WHERE season_id = $1 AND kind = 'bingo' AND (asked_by = ANY($2::text[]) OR asked_by IS NULL) AND started_at > now() - interval '1 hour'", [season, Object.values(fx.users)]);
      }
      await pool.query("DELETE FROM desk_runs WHERE season_id = $1 AND kind = 'bingo' AND for_season AND (asked_by = ANY($2::text[]) OR asked_by IS NULL) AND asked_at > now() - interval '1 hour'", [season, Object.values(fx.users)]);
      await pool.query("DELETE FROM show_follows WHERE season_id = $1 AND user_id = ANY($2::text[])", [season, Object.values(fx.users)]);
      await fixture.down(pool);
    }
    await pool.end();
  }
  console.log(failures ? `FAIL (${failures})` : "PASS");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
