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
// Part 2 (the screens), on the same timeline:
//   - Start a game offers a Prediction Sheet, its questions from the show's moments (question-choices.ts: Who goes home?, the
//     show's research moments, Who wins?...), the recommended ones on; refused for a question it doesn't offer, none, or the
//     season's in a game over a span. In the browser jordan starts one by taps (Who goes home?, Played an idol?, Who wins?; with
//     --api, the same through the API); riley and sam join it. Its spec carries just those questions.
//   - The home's moves: a sheet still blank is due ("Fill in your sheet (3 questions)"), one half filled says what's left; the
//     Games read's `sheet` says how many are open; sam's waits on Episode 5.
//   - Backstage > Game settings lists its questions (its own on, the rest the show can ask off), switchable by jordan until it
//     starts (added, taken off), refused for riley; read only once it's started, saying why.
//   - In the browser, before Episode 6 airs: the dock and This week say the sheet's due; the dock opens the sheet; jordan names
//     someone, takes it back, names who goes home, says yes to the idol and names a winner, and saves; Tonight's card says
//     it's in. After the lock and the results (jordan at 6): Tonight's Extras and the episode page say how it went, the sheet
//     shows his 3 points, his right answers and the couch's beside them; the Outlast's finale predictions open from Extras
//     and his winner goes into the league's state; Game settings' questions are read only.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions.js <outDir> [--width=390] [--theme=light|dark] [--keep] [--api]
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
// --theme=light: jordan's browser on Studio (dark: Night); none, as his settings say (Night by default).
const theme = (args.find((a) => a.startsWith("--theme=")) || "").slice(8) || null;
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
  // The game-specs flag: on, a game carries its spec (settings.game) and the checks compare it; off (as in production), nothing
  // carries one, so a game's spec is what its fields say (specOf).
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  if (!specsOn) console.log("NOTE  the game-specs flag is off: specs are compared as the fields say them (specOf), not a carried spec");
  const specOf = (settings) => (specsOn ? settings.game ?? {} : G.specOf(settings));
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
    // The browser (part 2's screens), opened once as jordan when it's first needed; never with --api.
    let n = 0;
    let b = null;
    const errors = [];
    const browser = async () => {
      if (!b) {
        if (theme) {
          const t = theme === "light" ? "studio" : "night";
          await pool.query("INSERT INTO user_settings (user_id, theme) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET theme = $2", [fx.users.jordan, t]);
        }
        b = await open({ user: "zt_nd_jordan", pass: PASSWORD, width, height: 844 });
        closers.push(b.close);
        if (theme) await b.page.context().addCookies([{ name: "gys_theme", value: theme === "light" ? "studio" : "night", url: BASE }]);
        b.page.on("pageerror", (e) => errors.push(e.message));
      }
      return b.page;
    };
    const shot = async (page, name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
    const fits = async (page, what) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 0, `  ${what}: nothing wider than the screen at ${width}`, `${over}px over`);
    };
    const toasted = async (page, re) => {
      const t = page.getByText(re).first();
      await t.waitFor({ timeout: 15000 }).catch(() => {});
      return (await t.textContent().catch(() => "")) ?? "";
    };

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
    check(!problems.length && made.settings.leagueTypeId === "questions" && G.sameValue(specOf(made.settings).ask, G.fullSpec({ get: { by: "none" }, score: { by: "answers" }, ask: QUESTIONS }).ask), `  with them it's written: a game of questions, its spec ${specsOn ? "carried" : "as its fields say it"}`, JSON.stringify(problems));

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

    // ---------- Part 2: a Prediction Sheet from Start a game ----------
    const opts = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}`)).body;
    const sheetGame = opts.games?.find((x) => x.key === "questions");
    const offered = (opts.questions ?? []).map((x) => x.id);
    check(
      sheetGame?.fits && sheetGame.name === "Prediction Sheet" && ["out", "m.idolPlayed", "wins", "first", "final3"].every((id) => offered.includes(id)),
      "Start a game offers a Prediction Sheet, its questions from the show's moments",
      JSON.stringify({ g: sheetGame, offered })
    );
    check(G.sameValue(opts.questions.filter((x) => x.on).map((x) => x.id), ["out", offered.find((id) => id.startsWith("m.")), "wins"]), "  Who goes home?, the show's first moment and Who wins? are on", JSON.stringify(opts.questions.filter((x) => x.on)));
    const startSheet = (body) => as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "questions", tell: false, ...body });
    for (const [body, why] of [
      [{ questions: ["nope"] }, "a question it doesn't offer"],
      [{ questions: [] }, "no question"],
      [{ questions: ["out", "wins"], to: opts.ends?.[0]?.number ?? 7 }, "the season's Who wins? in a game over a span"],
    ]) {
      r = await startSheet(body);
      check(r.status === 400, `  refused: ${why} (400)`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    const CHOSEN = ["out", "m.idolPlayed", "wins"];
    const sheetsBefore = (await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND state->'settings'->>'leagueTypeId' = 'questions'", [couch])).rows.map((x) => x.id);
    if (!apiOnly) {
      const page = await browser();
      await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      await page.locator("[data-tonight-start]").waitFor({ timeout: 30000 });
      await page.locator("[data-tonight-start]").click();
      await page.locator("[data-start-game=questions]").waitFor({ timeout: 20000 });
      await page.locator("[data-start-game=questions]").click();
      const list = page.locator("[data-start-questions]");
      await list.waitFor();
      const firstMoment = offered.find((id) => id.startsWith("m."));
      if (firstMoment !== "m.idolPlayed") {
        await list.locator(`[data-start-question="${firstMoment}"]`).click();
        await list.locator(`[data-start-question="m.idolPlayed"]`).click();
      }
      const ticked = await list.locator("[data-start-question][aria-checked=true]").evaluateAll((els) => els.map((e) => e.getAttribute("data-start-question")));
      check(G.sameValue([...ticked].sort(), [...CHOSEN].sort()), "the sheet: The questions, ticked by tap (Who goes home?, Played an idol?, Who wins?)", JSON.stringify(ticked));
      await page.locator("[data-start-tell]").click();
      await page.waitForTimeout(400);
      await fits(page, "Start a game with The questions");
      await shot(page, "start-prediction-sheet");
      await page.locator("[data-start-go]").click();
      const said = await toasted(page, /Prediction Sheet started/);
      check(/Prediction Sheet started/.test(said), '  Start it: "Prediction Sheet started"', said);
    } else {
      r = await startSheet({ questions: CHOSEN });
      check(r.status === 200, "jordan starts a Prediction Sheet with three questions (the API)", JSON.stringify(r.body));
    }
    let QS = null;
    for (let i = 0; i < 20 && !QS; i++) {
      QS = (await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND state->'settings'->>'leagueTypeId' = 'questions' AND NOT (id = ANY($2::uuid[]))", [couch, sheetsBefore])).rows[0]?.id ?? null;
      if (!QS) await new Promise((res) => setTimeout(res, 500));
    }
    const qsState = QS ? (await league(QS)).state : null;
    check(!!QS && G.sameValue(S.AnswerLogic.questions(qsState).map((x) => x.id), CHOSEN) && specOf(qsState.settings).ask?.length === 3, `  it's a game of questions asking just those three, its spec ${specsOn ? "carried" : "as its fields say it"}`, JSON.stringify(qsState && S.AnswerLogic.questions(qsState).map((x) => x.id)));
    for (const who of ["riley", "sam"]) {
      const o2 = await as[who].call("GET", `/api/couches/${couch}/games/${QS}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QS}`, { action: "join", start: o2.body.starts?.live ?? o2.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const homeMoves = async (who) => (await as[who].call("GET", "/api/me/home")).body.moves ?? [];
    let moves = await homeMoves("jordan");
    const due = moves.find((m) => m.kind === "questions" && m.leagueId === QS);
    check(!!due && due.text === "Fill in your sheet (3 questions)" && due.episode === 6 && !!due.deadline && !moves.some((m) => m.kind === "questions" && m.leagueId === QG), "the home's moves: jordan's new sheet is due (3 questions, Episode 6, its lock); the one he's filled in isn't", JSON.stringify(moves.filter((m) => m.kind === "questions")));
    moves = await homeMoves("riley");
    check(moves.some((m) => m.kind === "questions" && m.leagueId === QG && m.text === "Finish your sheet (1 to go)"), "  riley's half-filled sheet says what's left", JSON.stringify(moves.filter((m) => m.kind === "questions")));
    const sheetOfGame = async (who, lid) => ((await as[who].call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === lid)?.sheet;
    let sh = await sheetOfGame("jordan", QS);
    check(sh?.of === 3 && sh.answered === 0 && sh.episode === 6 && !!sh.closesAt && sh.finale === false, "  the Games read's sheet: 3 open, none answered, when it locks", JSON.stringify(sh));
    sh = await sheetOfGame("sam", QS);
    check(sh?.behind === 5 && sh.of === 1, "  sam's: Who goes home? and Who wins? wait on Episode 5 (they name someone), the idol's open", JSON.stringify(sh));

    // Castaway ids are each league's own: the same three people as faces[0..2] above, by name, in the new game.
    const qsOut = byId((await as.jordan.call("GET", `/api/seasons/${sid}/answers?league=${QS}`)).body, "out")?.faces ?? [];
    const QSF = [PICK, faces[1], faces[2]].map((f) => qsOut.find((x) => x.name === f.name)?.id);
    check(QSF.every(Boolean), "  the new game's own ids for the same three people", JSON.stringify(QSF));

    // ---------- Part 2: Backstage's view ----------
    const bsSettings = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/backstage/settings${q}`)).body;
    let qsSet = (await bsSettings("jordan")).games?.find((x) => x.leagueId === QS);
    check(
      qsSet?.questions?.editable && G.sameValue(qsSet.questions.list.filter((x) => x.on).map((x) => x.id), CHOSEN) && qsSet.questions.list.some((x) => x.id === "first" && !x.on),
      "Backstage > Game settings: its three on, the rest the show can ask off, switchable before it starts",
      JSON.stringify(qsSet?.questions)
    );
    const setQs = (who, ids) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings${q}`, { leagueId: QS, questions: ids });
    r = await setQs("jordan", [...CHOSEN, "first"]);
    check(r.status === 200 && G.sameValue(S.AnswerLogic.questions((await league(QS)).state).map((x) => x.id), [...CHOSEN, "first"]), "  jordan adds Who goes home first?", `${r.status} ${JSON.stringify(r.body)}`);
    r = await setQs("jordan", CHOSEN);
    check(r.status === 200 && G.sameValue(S.AnswerLogic.questions((await league(QS)).state).map((x) => x.id), CHOSEN), "  and takes it off again", `${r.status} ${JSON.stringify(r.body)}`);
    r = await setQs("jordan", ["nope"]);
    check(r.status === 400, "  refused: a question it can't ask (400)", `${r.status}`);
    r = await setQs("riley", ["out"]);
    check(r.status === 403 || r.status === 404, "  refused for riley, who doesn't run it", `${r.status}`);
    check((await pool.query("SELECT 1 FROM league_changes WHERE league_id = $1 AND text LIKE '%questions:%'", [QS])).rowCount >= 2, "  each change is a line in Recent changes");
    // Run it back on a Prediction Sheet asks what it asked (its questions, as far as the season's rules can ask them).
    const back = (await as.jordan.call("GET", `/api/seasons/${sid}/start${q}&again=${QS}`)).body;
    check(back.again?.key === "questions" && back.again.gameName === "Prediction Sheet" && G.sameValue(back.again.questions, CHOSEN), "  Run it back's options: the same game, its three questions", JSON.stringify(back.again));

    // ---------- Part 2: answering in the browser, before Episode 6 airs ----------
    if (!apiOnly) {
      const page = await browser();
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const dock = page.locator(".nd-dock");
      await dock.waitFor({ timeout: 30000 });
      await page.waitForTimeout(800);
      check(/your sheet/i.test((await dock.textContent()) ?? ""), "the dock says the sheet's due", (await dock.textContent()) ?? "");
      const row = page.locator(`[data-sheet-row="${QS}"]`);
      // This week's row comes from the Games read, which can land after the dock (a dev server compiling the route first).
      await row.waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
      check(await row.isVisible(), "  and This week has its row");
      // The dock opens the first move due (here a lineup's); This week's row opens the sheet.
      await row.scrollIntoViewIfNeeded();
      await row.click();
      const sheet = page.locator(`[data-sheet="${QS}"]`);
      await sheet.waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      const outQ = sheet.locator("[data-question=out]");
      check((await outQ.locator("[data-answer-face]").count()) === 13 && /Locks/.test((await sheet.locator("[data-sheet-locks]").first().textContent()) ?? ""), "  the sheet: Who goes home? as the 13 still in, its lock and countdown", String(await outQ.locator("[data-answer-face]").count()));
      const face = (qid, id) => sheet.locator(`[data-question="${qid}"] [data-answer-face="${id}"]`);
      await face("out", QSF[1]).click();
      await face("out", QSF[1]).click();
      check((await face("out", QSF[1]).getAttribute("aria-pressed")) === "false", "  a tap again takes an answer back");
      await face("out", QSF[0]).click();
      await sheet.locator("[data-question='m.idolPlayed'] [data-answer-option=yes]").click();
      await face("wins", QSF[1]).click();
      await fits(page, "the sheet");
      await shot(page, "sheet-answering");
      await sheet.locator("[data-sheet-save]").click();
      const said = await toasted(page, /Saved · change until/);
      check(/Saved · change until/.test(said), '  Save: "Saved · change until ..."', said);
      const rows = (await pool.query("SELECT question, answer FROM game_answers WHERE league_id = $1 AND player_id = (SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2)", [QS, fx.users.jordan])).rows;
      const got = Object.fromEntries(rows.map((x) => [x.question, x.answer]));
      check(got.out === QSF[0] && got["m.idolPlayed"] === "yes" && got.wins === QSF[1], "  his three answers are stored", JSON.stringify(got));
      await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const done = page.locator(`[data-done="sheet-done-${QS}"]`);
      await done.waitFor({ timeout: 30000 }).catch(() => {});
      check(await done.isVisible().catch(() => false), 'Tonight\'s card: "Your sheet is in", with Change');
      await done.scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, "tonight-sheet-in");
    } else {
      r = await as.jordan.call("POST", `/api/seasons/${sid}/answers?league=${QS}`, { answers: { out: QSF[0], "m.idolPlayed": "yes", wins: QSF[1] } });
      check(r.status === 200, "jordan fills in his sheet (the API)", `${r.status}`);
    }
    r = await as.riley.call("POST", `/api/seasons/${sid}/answers?league=${QS}`, { answers: { out: QSF[2], "m.idolPlayed": "no" } });
    check(r.status === 200, "riley fills in two of hers", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);

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
    // Part 2's Prediction Sheet, at jordan's mark (6): his three answers graded, riley's beside them; Backstage's list read only.
    const sheet6 = (await as.jordan.call("GET", `/api/seasons/${sid}/answers?league=${QS}&episode=6`)).body;
    const mineIn = (id) => byId(sheet6, id)?.people.find((p) => p.you);
    check(sheet6.points === 3 && mineIn("out")?.right === true && mineIn("m.idolPlayed")?.earned === 1 && byId(sheet6, "wins")?.verdict?.state === "waiting", "the Prediction Sheet at Episode 6: jordan's Who goes home? and idol right, 3 points; Who wins? still to settle", JSON.stringify({ p: sheet6.points, out: byId(sheet6, "out")?.people }));
    check(byId(sheet6, "out")?.people.some((p) => !p.you && p.name === "zt_nd_riley" && p.right === false && p.userId === fx.users.riley) && sheet6.cast.some((c) => c.id === QSF[0]) && sheet6.mark === 6, "  riley's answer beside his, with her face; the cast to name who went home; his mark", JSON.stringify(byId(sheet6, "out")?.people));
    qsSet = (await bsSettings("jordan")).games?.find((x) => x.leagueId === QS);
    check(qsSet?.questions && !qsSet.questions.editable && /answers are in/.test(qsSet.questions.why ?? ""), "  Backstage's questions are read only now, saying why", JSON.stringify(qsSet?.questions));
    r = await setQs("jordan", [...CHOSEN, "first"]);
    check(r.status === 409, "  and a change is refused (409)", `${r.status}`);
    // Its night (Episodes' "Your night") and the reveal: a sheet's points come from its answers, not its state.
    const eps = (await as.jordan.call("GET", `/api/seasons/${sid}/episodes${q}`)).body.episodes ?? [];
    const night = eps.find((e) => e.number === 6)?.lines?.find((l) => l.leagueId === QS);
    check(night?.big === "+3 pts" && night.line === "2 of 2 right", 'Episodes\' "Your night" for it: +3 pts, 2 of 2 right', JSON.stringify(night));
    const rv = await as.riley.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch });
    const rvPart = (rv.body.games ?? []).find((x) => x.leagueId === QS);
    check(rv.status === 200 && rvPart?.title === "0 pts on your sheet" && rvPart.line === "0 of 2 right", "riley reveals Episode 6: her sheet's part, none right", `${rv.status} ${JSON.stringify(rvPart ?? rv.body).slice(0, 300)}`);
    const rvGames = (await as.riley.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? [];
    const rvTable = rvGames.find((x) => x.leagueId === QS)?.table ?? [];
    check(rvTable.find((t) => t.userId === fx.users.jordan)?.total === 3 && rvTable[0]?.userId === fx.users.jordan, "  and now she sees jordan's 3 on the table", JSON.stringify(rvTable.map((t) => [t.name, t.total])));
    const flagged = checkLeague((await league(QG)).state);
    // In step: carrying it again changes nothing (db/game-specs.js carryGame says whether it wrote). With the flag off nothing
    // carries a spec, so there's nothing to be in step: only the flag's own check.
    if (specsOn) check(flagged.ok && GameSpecs.carryGame(clone((await league(QG)).state.settings), true) === false, "the game-specs flag's check passes on it, and its spec is in step", JSON.stringify(flagged));
    else {
      check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
      console.log("NOTE  the game-specs flag is off: whether its carried spec is in step was skipped");
    }

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
      const page = await browser();
      // Part 2: how the sheet went, from Tonight's Extras (the latest jordan's seen, 6).
      await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
      const result = page.locator(`[data-sheet-result-row="6"][data-sheet-league="${QS}"]`);
      await result.waitFor({ timeout: 30000 }).catch(() => {});
      check(/your sheet, 3 points/.test((await result.textContent().catch(() => "")) ?? ""), 'Tonight\'s Extras: "Episode 6: your sheet, 3 points"', (await result.textContent().catch(() => "")) ?? "");
      await result.scrollIntoViewIfNeeded().catch(() => {});
      await result.click();
      const went = page.locator(`[data-sheet="${QS}"][data-sheet-status=closed]`);
      await went.waitFor({ timeout: 20000 });
      await page.waitForTimeout(600);
      check(/3/.test((await went.locator("[data-sheet-score]").textContent()) ?? "") && (await went.locator("[data-question=out] [data-question-mine=right]").count()) === 1, "  the sheet: his 3 points on the plate, Who goes home? right", (await went.locator("[data-sheet-score]").textContent()) ?? "");
      check(/went home/.test((await went.locator("[data-question=out] [data-question-answer]").textContent()) ?? "") && (await went.locator("[data-question=out] [data-question-person]").count()) === 1, "  what was right (who went home), and riley's answer beside his", (await went.locator("[data-question=out] [data-question-answer]").textContent()) ?? "");
      check(/Settles when the season ends/.test((await went.locator("[data-question=wins] [data-question-answer]").textContent()) ?? ""), "  Who wins? settles when the season ends");
      await fits(page, "how the sheet went");
      await shot(page, "sheet-how-it-went");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      // The Outlast's finale predictions, from Extras: jordan named three in the API; now his winner.
      const finale = page.locator(`[data-sheet-row="${outlast}"]`);
      await finale.waitFor({ timeout: 20000 }).catch(() => {});
      check(/Finale predictions/.test((await finale.textContent().catch(() => "")) ?? ""), "Tonight's Extras: the Outlast's Finale predictions", (await finale.textContent().catch(() => "")) ?? "");
      await finale.scrollIntoViewIfNeeded().catch(() => {});
      await finale.click();
      const fin2 = page.locator(`[data-sheet="${outlast}"]`);
      await fin2.waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      check((await fin2.locator("[data-question=top3] [data-answer-face][aria-pressed=true]").count()) === 3, "  his final three are ticked, from the league's state");
      const winner = three[0];
      await fin2.locator(`[data-question=winner] [data-answer-face="${winner}"]`).click();
      await shot(page, "finale-predictions");
      await fin2.locator("[data-sheet-save]").click();
      await toasted(page, /Saved · change until/);
      await page.waitForTimeout(500);
      const fp2 = (await league(outlast)).state.finalePredictions.find((f) => f.playerId === jordanThere);
      check(fp2?.winner === winner && G.sameValue(fp2.top3, three), "  his winner goes into the league's state, his three kept", JSON.stringify(fp2));
      // The episode page: how each sheet went on it.
      await page.goto(`${BASE}/show/${sid}/episodes?page=ep6`, { waitUntil: "load" });
      const epSheet = page.locator(`[data-episode-sheet="${QS}"]`);
      await epSheet.waitFor({ timeout: 30000 }).catch(() => {});
      check(await epSheet.isVisible().catch(() => false), "the episode page: the Prediction Sheet's row under its name");
      await epSheet.scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, "episode-sheet");
      // Backstage > Game settings: its questions, read only now.
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      const bsq = page.locator(`[data-settings-league="${QS}"] [data-settings=questions]`);
      await bsq.waitFor({ timeout: 30000 }).catch(() => {});
      check((await bsq.locator("[data-settings-question]").count()) >= 4 && (await bsq.locator("[data-settings-question]:not([disabled])").count()) === 0 && /answers are in/.test((await bsq.textContent()) ?? ""), "Backstage > Game settings: the questions, read only, saying why", (await bsq.textContent().catch(() => "")) ?? "");
      await bsq.scrollIntoViewIfNeeded().catch(() => {});
      await fits(page, "Game settings");
      await shot(page, "backstage-questions");
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
