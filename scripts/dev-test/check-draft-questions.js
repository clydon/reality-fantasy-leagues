// Dev-only check of a draft's own questions beyond its finale predictions (docs/PLAN-start-a-game-gpt.md track C, C2 part 4c:
// game-spec schema.js draftQuestions, finaleIn, draftAskPlace; settings.js draftQuestions; state-logic.js AnswerLogic.lines and
// withLines, ScoringLogic.walk's line, each row's `questions`; answer-points.ts walked, asItStands, leagueAnswers and draftLines;
// answers.ts on a draft; season-games.ts and couch-hub.ts carrying the lines) against the dev server, through the API (no screens:
// they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through
// Episode 5, Episode 6 three days off; Couch Cup, the couch's Outlast; everyone has seen 5 but sam, 3). Expectations are the engine's
// own reading of each copy (the numbers by hand are tests/draft-questions.test.js's), so the check proves the server grades a
// draft's questions, and carries their points into its table, as the engine does. In order:
//   - Couch Cup asks its finale predictions and two questions of its own (who goes home, 2 points; who of yours goes home, 1 point),
//     through RosterLogic.setGame with the show's ctx: its own questions in settings.draftQuestions, its finale predictions in their
//     fields, still an Outlast.
//   - Answering (GET/POST /api/seasons/[id]/answers?league=): its four questions, this week's two open for Episode 6 (yours from your
//     own team only), the finale predictions until the finale; a finale prediction goes into the league's state, a question of its
//     own into game_answers; nobody else's answer before the lock; the home's move and the Games read's sheet count its own two (its
//     finale predictions an extra, never a move).
//   - Episode 6 airs and its results come in through the season sync (alex's call goes home): the Games tab's table, as alex, riley and
//     jordan (seen through 6) and sam (3) read it, is the engine's on each one's copy with the questions' lines (alex's 2 in it; sam's
//     copy has none of Episode 6's); the answers route says who was right and what each earned; the hub's place for alex is the Games
//     tab's.
//   - Its questions beside a cut each episode: refused (who's out decides the moves its own writes take, which read it as stored).
//   - Couch Cup made head to head: the Games tab's records are the engine's on the copy with the lines (their points in each week).
//   - The game-specs flag's check passes on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-draft-questions.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-draft-questions runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } };
const MINE = { id: "mine", ask: "Which of yours goes home?", answer: "person", from: "team", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const FINALE = G.finaleQuestions({ top3: 1, winner: 3, from: "any" });

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameBy = (a, b) => same(Object.entries(a).sort(), Object.entries(b).sort());

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const L = fx.leagues.outlast;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const stored = async () => (await pool.query("SELECT player_id, question, episode, answer FROM game_answers WHERE league_id = $1", [L])).rows.map((r) => ({ playerId: r.player_id, question: r.question, episode: r.episode, answer: r.answer }));
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const answersOf = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${L}${episode ? `&episode=${episode}` : ""}`)).body;
    const answer = (who, answers) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${L}`, { answers });
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    const setGame = async (changes) => {
      const st = await league();
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(L, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(st);
      return problems;
    };
    const decide = async (n, name) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
        [sid, n, name]
      );
      await syncSeasonLeagues(sid, null);
    };
    // The engine's own reading of a copy at `mark` (null: everything), with the questions' lines as the server grades them.
    const engineCopy = async (who, mark) => {
      const st = await league();
      const view = S.GhostLogic.viewFor(st, pids[who], mark);
      return { view, lined: S.AnswerLogic.withLines(view, S.AnswerLogic.lines(view, await stored(), S.AnswerLogic.facts(view))) };
    };
    const totals = (v) => Object.fromEntries(S.computeScores(v).map((r) => [whoOf(r.playerId), r.total]));
    const tableOf = (g) => Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), r.points]));
    const byId = (body, id) => (body?.questions ?? []).find((q) => q.id === id);

    // ---------- its finale predictions and two questions of its own ----------
    const problems = await setGame({ ask: [...FINALE, BOOT, MINE] });
    let st = await league();
    check(!problems.length && same((st.settings.draftQuestions ?? []).map((q) => q.id), ["boot", "mine"]) && st.settings.finalePredictionsEnabled === true && S.getLeagueType(st).id === "classic-draft" && S.piecesOf(st).hasDraftQuestions === true,
      "Couch Cup asks its finale predictions and two questions of its own (settings.draftQuestions; still an Outlast)", JSON.stringify({ problems, dq: st.settings.draftQuestions, fin: st.settings.finalePredictionsEnabled }));

    // ---------- answering ----------
    let a = await answersOf("alex");
    const boot = byId(a, "boot");
    const mine = byId(a, "mine");
    const teamOf = (s, who) => s.castaways.filter((c) => (c.ownerIds ?? []).includes(pids[who])).map((c) => c.id);
    const alexTeam = new Set(teamOf(st, "alex"));
    check(same((a?.questions ?? []).map((q) => q.id), ["top3", "winner", "boot", "mine"]) && boot?.status === "open" && boot?.episode === 6 && byId(a, "winner")?.closes === "finale",
      "The answers route: its four questions, this week's two open for Episode 6, the finale predictions until the finale", JSON.stringify((a?.questions ?? []).map((q) => [q.id, q.status, q.episode, q.closes])));
    check((mine?.faces ?? []).length > 0 && mine.faces.every((f) => alexTeam.has(f.id)) && mine.from === "team",
      "  who of yours goes home names only alex's own team", JSON.stringify(mine?.faces));
    // The home's moves: Couch Cup's sheet is due, its two questions (its finale predictions an extra beside it, never a move).
    const homeMoves = async (who) => ((await as[who].call("GET", "/api/me/home")).body.moves ?? []).filter((m) => m.kind === "questions" && m.leagueId === L);
    let moves = await homeMoves("alex");
    check(moves.length === 1 && moves[0].text === "Fill in your sheet (2 questions)" && moves[0].episode === 6, "  the home's moves: alex's sheet is due, its two questions (not the finale predictions)", JSON.stringify(moves));
    const stillIn = st.castaways.filter((c) => c.status !== "eliminated");
    const goner = stillIn.find((c) => alexTeam.has(c.id)) ?? stillIn[0];
    const other = stillIn.find((c) => c.id !== goner.id);
    let r = await answer("alex", { boot: goner.id, mine: goner.id });
    check(r.status === 200, "  alex names who goes home, and one of his own (the same one)", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    moves = await homeMoves("alex");
    check(moves.length === 0, "  then nothing's due for alex there (his finale predictions still blank: an extra)", JSON.stringify(moves));
    r = await answer("riley", { boot: other.id });
    check(r.status === 200, "  riley names someone else", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const notRileys = stillIn.find((c) => !teamOf(st, "riley").includes(c.id));
    r = await answer("riley", { mine: notRileys.id });
    check(r.status === 400, "  riley's own team only: someone else's refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await answer("jordan", { boot: goner.id, winner: other.id });
    check(r.status === 200, "  jordan names who goes home and a winner", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    st = await league();
    const rows = await stored();
    check(same(rows.map((x) => `${whoOf(x.playerId)}:${x.question}:${x.episode}`).sort(), ["alex:boot:6", "alex:mine:6", "jordan:boot:6", "riley:boot:6"]) && (st.finalePredictions ?? []).find((f) => f.playerId === pids.jordan)?.winner === other.id,
      "  its own questions' answers in game_answers, the finale prediction in the league's state", JSON.stringify({ rows, fp: st.finalePredictions }));
    a = await answersOf("riley");
    check(byId(a, "boot")?.answered === 3 && (byId(a, "boot")?.people ?? []).length === 0 && byId(a, "boot")?.mine === other.id,
      "  riley sees how many have answered, nobody else's answer before the lock", JSON.stringify(byId(a, "boot")));
    let g = await gameIn("alex");
    check(!!g?.sheet && g.sheet.finale === false && g.sheet.episode === 6 && g.sheet.of === 2 && g.sheet.answered === 2,
      "  the Games read's sheet as alex reads it: this week's two questions, both answered (the finale predictions not counted)", JSON.stringify(g?.sheet));

    // ---------- Episode 6 airs; its results come in (alex's call goes home) ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, goner.name);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    st = await league();
    check(st.castaways.find((c) => c.id === goner.id)?.status === "eliminated", `Episode 6 through the season sync: ${goner.name} voted out`);
    for (const who of WHO) {
      const mark = who === "sam" ? 3 : 6;
      const { view, lined } = await engineCopy(who, mark);
      const want = totals(lined);
      g = await gameIn(who);
      check(sameBy(tableOf(g), want), `  the Games tab as ${who} reads it (seen through ${mark}): the engine's table on that copy with the questions' lines (${JSON.stringify(want)})`,
        JSON.stringify({ api: tableOf(g), want, without: totals(view) }));
      if (who === "alex") {
        const row = S.computeScores(lined).find((x) => x.playerId === pids.alex);
        check(row?.questions === 3 && want.alex === totals(view).alex + 3, "  alex's row: his two right calls' 3 points (2 and 1) beside the Outlast's", JSON.stringify(row));
      }
      if (who === "sam") check(sameBy(want, totals(view)), "  sam's copy (seen through 3) has none of Episode 6's points", JSON.stringify({ want, without: totals(view) }));
    }
    // (This week is Episode 7 now: Episode 6's, read by its number.)
    a = await answersOf("alex", 6);
    const people = Object.fromEntries((byId(a, "boot")?.people ?? []).map((p) => [whoIs(p.userId), [p.right, p.earned]]));
    check(byId(a, "boot")?.status === "closed" && same(people.alex, [true, 2]) && same(people.riley, [false, 0]) && same(people.jordan, [true, 2]) && same(byId(a, "mine")?.people?.[0] && [byId(a, "mine").people[0].right, byId(a, "mine").people[0].earned], [true, 1]),
      "  the answers route after the lock: everyone's answers, who was right and what each earned", JSON.stringify({ people, mine: byId(a, "mine")?.people }));
    const hub = (await as.alex.call("GET", `/api/couches/${fx.couchId}/hub`)).body;
    const there = (hub?.games ?? []).find((x) => x.leagueId === L);
    g = await gameIn("alex");
    check(!!there && there.rank === g?.you?.rank, `  the hub's place for alex in Couch Cup is the Games tab's (${g?.you?.rank})`, JSON.stringify({ hub: there?.rank, games: g?.you?.rank }));

    // ---------- not beside its cuts (who's out decides the moves its own writes take) ----------
    const cut = await setGame({ rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] } });
    check(cut.length === 1 && /beside its cuts or a race/.test(cut[0].problem) && (await league()).settings.draftRank === undefined,
      "Couch Cup's questions beside a cut each episode: refused, nothing written", JSON.stringify(cut));

    // ---------- head to head on them ----------
    const h2h = await setGame({ rank: { by: "matchups" } });
    check(!h2h.length, "Couch Cup made head to head", JSON.stringify(h2h));
    const { lined } = await engineCopy("jordan", 6);
    const w = S.MatchupLogic.run(lined);
    const want = Object.fromEntries(WHO.map((who) => { const x = w.records.get(pids[who]) || { wins: 0, losses: 0, ties: 0 }; return [who, `${x.wins}-${x.losses}-${x.ties}`]; }));
    g = await gameIn("jordan");
    const got = Object.fromEntries((g?.table ?? []).map((x) => [whoIs(x.userId), x.record ? `${x.record.wins}-${x.record.losses}-${x.record.ties}` : null]));
    check(sameBy(got, want), `  the Games tab's records as jordan reads them are the engine's on the copy with the lines (${JSON.stringify(want)})`, JSON.stringify({ got, want }));
    const week6 = (w.weeks.find((x) => x.number === 6)?.games ?? []).map((x) => [whoOf(x.a), x.aPoints, whoOf(x.b), x.bPoints]);
    const grew = S.KnockoutLogic.series(lined);
    const at = (n) => new Map((grew.find((x) => x.number === n) || { totals: [] }).totals);
    check(week6.every(([p, pts]) => Math.abs(pts - ((at(6).get(pids[p]) || 0) - (at(5).get(pids[p]) || 0))) < 0.005),
      "  Episode 6's matchups on what each scored in it, the questions' points in it", JSON.stringify(week6));

    // ---------- the game-specs flag's check ----------
    const flagged = checkLeague(await league());
    check(flagged.ok, "The game-specs flag's check passes on Couch Cup", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  threw: ${e && e.stack ? e.stack : e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`(fixture down: ${e.message})`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
