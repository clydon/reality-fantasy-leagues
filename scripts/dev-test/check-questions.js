// Dev-only check of questions settled by data (docs/PLAN-start-a-game-gpt.md step A4 part 1: the engine and storage;
// src/lib/server/answers.ts, answer-points.ts, state-logic.js AnswerLogic, migration 0200 game_answers), against the dev
// server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three
// days off, 13 episodes; everyone has seen 5 but sam, 3).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of
//     questions through RosterLogic.setGame (Start a game offers one in part 2): refused without the show's moments (the
//     data-can-settle rule), written with them (answers.ts questionContext). Three questions: Who goes home? and An idol
//     played? each episode, Who wins? once (it locks when the game starts).
//   - Answering (GET/POST /api/seasons/[id]/answers?league=): this week's questions, who you can name (who's still in),
//     yours, how many have answered; nobody else's answer before the lock; what an answer can't be (someone gone, a
//     non-answer, a question it hasn't got, next week's episode); sam, behind, can't name anyone until he's seen Episode 5.
//   - The lock: Episode 6 airs and every question closes (409), then everyone's answers show, still to settle.
//   - Graded on read: Episode 6's results come in (jordan's call goes home, an idol is played). This week's is then the game's
//     Episode 7, whose Who goes home? waits for jordan to see 6; reading Episode 6, jordan, not caught up, sees nothing graded; once he's seen 6, his points, the verdicts and the Games tab's table (ranked by points) say so; riley,
//     still at 5, sees no points. The game-specs flag's check passes on it and nothing drifted.
//   - Side bets: a bet proposed for Episode 6 on the lineup game, guessed before it airs; after, a guess is refused (409) and
//     Your moves offers none; the pool's Rules sheet has no Predictions line (a pool never scored them).
//   - Finale predictions on the Outlast: the classic routes take a pick, refuse typing the result in (the results settle it);
//     the answers API shows them as the game's two questions and writes a final three into the league's state.
//   In a real browser at --width (390 by default), as jordan once he's seen 6: the Games tab's table for the game of
//   questions and its Rules sheet, and the pool's Rules sheet. Nothing wider than the screen; no page errors. Screenshots go
//   to <outDir>.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-questions runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-questions.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

const clone = (v) => JSON.parse(JSON.stringify(v));
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
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);

    // ---------- A game of questions ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(QG, sid);
    const idol = ctx.moments.find((m) => m.id === "idolPlayed");
    check(!!idol && idol.answeredBy === "research" && ctx.results && ctx.winner && ctx.calls === "results", "the show's ctx: research answers idolPlayed, its results say who goes home, someone wins", JSON.stringify(idol));
    const QUESTIONS = [
      { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } },
      { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } },
      { id: "wins", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } },
    ];
    const make = async (opts) => {
      const row = await league(QG);
      const state = row.state;
      const problems = S.setGame(state, { spec: 1, span: S.gameOf(state).span, get: { by: "none" }, score: { by: "answers" }, ask: QUESTIONS }, opts);
      if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), QG]);
      return problems;
    };
    let problems = await make({});
    check(problems.length === 1 && problems[0].at === "ask", "  without the show's moments, setGame refuses its questions (the data rule)", JSON.stringify(problems));
    problems = await make({ ctx });
    const made = (await league(QG)).state;
    check(!problems.length && made.settings.leagueTypeId === "questions" && G.sameValue(made.settings.game?.ask, G.fullSpec({ get: { by: "none" }, score: { by: "answers" }, ask: QUESTIONS }).ask), "  with them it's written: a game of questions, its spec carried", JSON.stringify(problems));

    // ---------- Answering ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    let g = await read("jordan");
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    const faces = byId(g, "out")?.faces ?? [];
    check(g.episode === 6 && g.questions?.length === 3 && g.questions.every((x) => x.status === "open" && x.answered === 0 && x.mine === null), "jordan reads Episode 6's questions: three, open, nobody's answered", JSON.stringify(g).slice(0, 400));
    check(faces.length === 13 && byId(g, "wins")?.faces?.length === 13 && byId(g, "out").closesAt, "  who he can name: the 13 still in; when it locks", String(faces.length));
    const PICK = faces[0];
    r = await ask("jordan", { answers: { out: PICK.id, idol: "yes", wins: faces[1].id } });
    check(r.status === 200 && byId(r.body, "out")?.mine === PICK.id && byId(r.body, "idol")?.mine === "yes" && byId(r.body, "out").answered === 1, "jordan answers all three", JSON.stringify(r.body).slice(0, 300));
    const gone = made.castaways.find((c) => c.status === "eliminated");
    for (const [body, status, why] of [
      [{ answers: { out: gone.id } }, 400, "someone already gone"],
      [{ answers: { idol: "maybe" } }, 400, "yes or no"],
      [{ answers: { quit: "yes" } }, 400, "a question it hasn't got"],
      [{ episode: 7, answers: { idol: "no" } }, 409, "next week's episode"],
      [{ answers: { out: [PICK.id, faces[2].id] } }, 400, "two for a question that names one"],
    ]) {
      r = await ask("riley", body);
      check(r.status === status, `  refused: ${why} (${status})`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    g = await read("riley");
    check(byId(g, "out")?.answered === 1 && byId(g, "out").mine === null && g.questions.every((x) => x.people.length === 0 && x.verdict === null), "riley sees that one has answered, never whose or what", JSON.stringify(byId(g, "out")));
    r = await ask("riley", { answers: { out: faces[3].id, idol: "no" } });
    check(r.status === 200, "riley answers two", JSON.stringify(r.body).slice(0, 200));
    g = await read("sam");
    check(byId(g, "out")?.status === "behind" && byId(g, "out").catchUp === 5 && byId(g, "out").faces === null && byId(g, "idol")?.status === "open", "sam, at Episode 3: Who goes home? waits for him to see 5 (no faces), An idol played? doesn't", JSON.stringify(byId(g, "out")));
    r = await ask("sam", { answers: { out: PICK.id } });
    check(r.status === 403, "  naming someone is refused (403)", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- Side bets, before Episode 6 airs ----------
    const lineup = fx.leagues.lineup;
    r = await as.alex.call("POST", `/api/leagues/${lineup}/episodes/upcoming/bets`, { label: "Does anyone cry at tribal?", points: 2 });
    const ep6 = r.body?.episodes?.find((e) => e.number === 6);
    const bet = ep6?.bets?.find((b) => b.label === "Does anyone cry at tribal?");
    check(r.status === 200 && !!bet, "a side bet on the lineup game, for Episode 6", `${r.status}`);
    const rileyPlayer = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [lineup, fx.users.riley])).rows[0]?.player_id;
    r = await as.riley.call("POST", `/api/leagues/${lineup}/episodes/${ep6.id}/bets/${bet.id}/predictions`, { playerId: rileyPlayer, guess: "Yes" });
    check(r.status === 200, "  riley guesses it before it airs", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);

    // ---------- The lock: Episode 6 airs ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await ask("riley", { answers: { idol: "yes" } });
    check(r.status === 409 && /closed when Episode 6 started/.test(r.body?.error ?? ""), "Episode 6 has started: an answer is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { wins: faces[2].id } });
    check(r.status === 409, "  Who wins? too: it locked when the game started", `${r.status}`);
    g = await read("jordan");
    const outQ = byId(g, "out");
    check(g.questions.every((x) => x.status === "closed") && outQ.people.length === 2 && outQ.people[0].you && outQ.people.every((p) => p.right === null) && outQ.verdict?.state === "waiting", "  locked: everyone's answers show, jordan first, still to settle", JSON.stringify(outQ.people));
    r = await as.sam.call("POST", `/api/leagues/${lineup}/episodes/${ep6.id}/bets/${bet.id}/predictions`, { playerId: (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [lineup, fx.users.sam])).rows[0]?.player_id, guess: "No" });
    check(r.status === 409 && /Predictions for Episode 6 closed/.test(r.body?.error ?? ""), "  a side bet's guess after it started is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);
    const gamesOf = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/games${q}`)).body.games;
    let games = await gamesOf("alex");
    check(!(games.find((x) => x.leagueId === lineup)?.predictions ?? []).some((p) => p.betId === bet.id), "  and Your moves offers it no more", JSON.stringify(games.find((x) => x.leagueId === lineup)?.predictions));
    const poolGame = games.find((x) => x.leagueId === fx.leagues.pool);
    check(!!poolGame && !poolGame.rules.some((l) => l.startsWith("Predictions")) && poolGame.predictions.length === 0, "the pool's Rules sheet says nothing of side bets, and it offers none (a pool never scored them)", JSON.stringify(poolGame?.rules));

    // ---------- Graded on read: Episode 6's results ----------
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const idolBy = faces[5].name;
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), true), ($1, 6, 'event', $3, '', 'idolPlayed', 'accepted', true, now(), true)`,
      [sid, PICK.name, idolBy]
    );
    await syncSeasonLeagues(sid, null);
    const synced = (await league(QG)).state;
    const e6 = synced.episodes.find((e) => e.number === 6);
    check(!!e6 && S.resultsStage(e6) === "final" && e6.events.some((ev) => ev.castawayId === PICK.id), "Episode 6's results reach it: jordan's call goes home, an idol is played (final)", JSON.stringify(e6 && { stage: S.resultsStage(e6), events: e6.events }));
    g = await read("jordan");
    check(g.episode === 7 && byId(g, "out")?.status === "behind" && byId(g, "out").catchUp === 6 && byId(g, "idol")?.status === "open", "this week's questions are the game's, Episode 7: Who goes home? waits for jordan to see 6", JSON.stringify({ episode: g.episode, out: byId(g, "out") }));
    g = await read("jordan", 6);
    check(g.points === 0 && byId(g, "out").verdict?.state === "waiting", "jordan hasn't seen Episode 6: nothing graded for him yet", JSON.stringify({ points: g.points, v: byId(g, "out").verdict }));
    await seen("jordan", 6);
    g = await read("jordan", 6);
    const me = (x) => x.people.find((p) => p.you);
    check(g.points === 3 && byId(g, "out").verdict?.state === "known" && me(byId(g, "out")).right === true && me(byId(g, "out")).earned === 2 && me(byId(g, "idol")).earned === 1, "once he's seen it: Who goes home? right (2), An idol played? right (1), 3 points", JSON.stringify({ points: g.points, out: byId(g, "out").people, idol: byId(g, "idol").people }));
    check(byId(g, "out").people.find((p) => !p.you)?.right === false && byId(g, "wins").verdict?.state === "waiting", "  riley's call was wrong; Who wins? waits for the finale", JSON.stringify(byId(g, "out").people));
    games = await gamesOf("jordan");
    const qGame = games.find((x) => x.leagueId === QG);
    const row = (who) => qGame?.table.find((t) => t.userId === fx.users[who]);
    check(!!qGame && qGame.gameType === "questions" && row("jordan")?.total === 3 && row("jordan")?.place === 1 && row("riley")?.total === 0, "the Games tab: the table ranks by points, jordan first on 3", JSON.stringify(qGame?.table?.map((t) => [t.name, t.total, t.rank])));
    check(!!qGame && qGame.rules[0] === "No draft, no team. Answer three questions:" && qGame.rules.includes("Before each episode: Who goes home? 2 points if you're right."), "  its Rules sheet says each question", JSON.stringify(qGame?.rules));
    games = await gamesOf("riley");
    check(games.find((x) => x.leagueId === QG)?.table.every((t) => t.total === 0), "riley, at Episode 5, sees no points yet (spoiler-safe)", JSON.stringify(games.find((x) => x.leagueId === QG)?.table?.map((t) => t.total)));
    const flagged = checkLeague((await league(QG)).state);
    // In step: carrying it again changes nothing (db/game-specs.js carryGame says whether it wrote).
    check(flagged.ok && GameSpecs.carryGame(clone((await league(QG)).state.settings), true) === false, "the game-specs flag's check passes on it, and its spec is in step", JSON.stringify(flagged));

    // ---------- Finale predictions on the Outlast ----------
    const outlast = fx.leagues.outlast;
    const pid = async (lid, who) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [lid, fx.users[who]])).rows[0]?.player_id;
    r = await as.alex.call("PATCH", `/api/leagues/${outlast}/settings`, { field: "finalePredictionsEnabled", value: true });
    check(r.status === 200 && G.finaleOf(S.gameOf((await league(outlast)).state).ask), "alex switches finale predictions on: the Outlast's spec has its two questions", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    const still = (await league(outlast)).state.castaways.filter((c) => c.status === "active");
    r = await as.riley.call("PATCH", `/api/leagues/${outlast}/finale/predictions/${await pid(outlast, "riley")}`, { idx: 0, value: still[0].id });
    check(r.status === 200, "  riley picks one of her final three in classic (the season's last episode hasn't started)", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    r = await as.alex.call("PATCH", `/api/leagues/${outlast}/finale/actual/winner`, { value: still[0].id });
    check(r.status === 409 && /results settle the finale/.test(r.body?.error ?? ""), "  typing the result in is refused: the results settle it", `${r.status} ${JSON.stringify(r.body)}`);
    const fin = (await as.jordan.call("GET", `/api/seasons/${sid}/answers?league=${outlast}`)).body;
    check(fin.questions?.map((x) => x.id).join() === "top3,winner" && fin.questions.every((x) => x.status === "open" && x.closes === "finale"), "the answers API shows them as the game's two questions, open until the finale", JSON.stringify(fin.questions?.map((x) => [x.id, x.status, x.closes])));
    const three = fin.questions[0].faces.slice(0, 3).map((f) => f.id);
    r = await as.jordan.call("POST", `/api/seasons/${sid}/answers?league=${outlast}`, { answers: { top3: three } });
    const jordanThere = await pid(outlast, "jordan");
    const fp = (await league(outlast)).state.finalePredictions.find((f) => f.playerId === jordanThere);
    check(r.status === 200 && !!fp && G.sameValue(fp.top3, three), "  jordan names his final three there: written into the league's state, where classic reads them", JSON.stringify(fp));

    // ---------- In the browser ----------
    if (!apiOnly) {
      let n = 0;
      const shot = async (page, name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      const fits = async (page, what) => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 0, `  ${what}: nothing wider than the screen at ${width}`, `${over}px over`);
      };
      const b = await open({ user: "zt_nd_jordan", pass: PASSWORD, width, height: 844 });
      closers.push(b.close);
      const page = b.page;
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const table = page.locator(`[data-table="${QG}"]`);
      await table.waitFor({ timeout: 30000 });
      await page.waitForTimeout(600);
      await table.scrollIntoViewIfNeeded();
      const first = table.locator("[data-player]").first();
      check((await first.getAttribute("data-player")) === "zt_nd_jordan" || /jordan/.test((await first.textContent()) ?? ""), "the Games tab: the game of questions' table, jordan on top", (await first.textContent()) ?? "");
      check(await first.isDisabled(), "  its rows are a count, nothing to open (as Weekly Calls')");
      await fits(page, "the Games tab");
      await shot(page, "games-questions-table");
      await table.getByRole("button", { name: "Rules" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("ol").waitFor();
      await page.waitForTimeout(500);
      check(await dialog.getByText("Before each episode: Who goes home? 2 points if you're right.").isVisible(), "  its Rules sheet: each question, when it's asked, what it earns");
      await fits(page, "the Rules sheet");
      await shot(page, "rules-questions");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const poolTable = page.locator(`[data-table="${fx.leagues.pool}"]`);
      await poolTable.scrollIntoViewIfNeeded();
      await poolTable.getByRole("button", { name: "Rules" }).click();
      await dialog.locator("ol").waitFor();
      await page.waitForTimeout(500);
      check((await dialog.getByText(/^Predictions/).count()) === 0, "  the pool's Rules sheet: no Predictions line");
      await shot(page, "rules-pool");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
