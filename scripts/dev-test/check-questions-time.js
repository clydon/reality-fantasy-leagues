// Dev-only check of time in questions (docs/PLAN-start-a-game-gpt.md step A7: game-spec schema.js and answers.js, state-logic.js
// AnswerLogic's windows and late lock, StateLogic.settlePhases, src/lib/server/answers.ts and phase-starts.ts), against the dev
// server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT
// Survivor 51: results through Episode 5, Episode 6 three days off, the rulebook's phases Tribes then Merged; everyone has
// seen 5 but sam, 3). Added here: the desk's own admin (zt_nd_desk, as check-phase-starts.js makes one).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of
//     questions through RosterLogic.setGame with the show's ctx: Name someone who'll be gone in the next two (every two
//     episodes), Will an idol be played within the next two? (over two), Which episode does the merge happen in? (once), Who
//     finds an idol this phase? (by phase), with a late lock of 72 hours.
//   - Answering Episode 6's: every window opens at 6; an answer for another episode is refused (409).
//   - The desk confirms the merge at Episode 7 while 6 is still to come: the game records it (its phase window opens at 7).
//   - The lock: Episode 6 airs. jordan, who watched it (seen 6), can't answer (409); riley, still at 5, can (the late lock),
//     and sees nobody's answers while she can; jordan sees hers.
//   - Episode 6's results: this week is 7, and the phase question's new window (Merged) opens there; jordan answers it.
//     Episode 7's results.
//   - Graded at each mark: jordan, at 7, has who went home in 6-7, the idol within two, the merge's episode (closest) and who
//     found an idol in Tribes' window (6 alone, the merge at 7): 7 points; riley, at 5, nothing yet. The flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions-time.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-questions-time runs against a local database only");
const args = process.argv.slice(2);
const PASSWORD = fixture.PASSWORD;
const DESK = "zt_nd_desk";

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const QUESTIONS = [
  { id: "gone", ask: "Name someone who'll be gone in the next two", answer: "person", points: 2, asked: "every", every: 2, settle: { by: "results", take: "out" } },
  { id: "within", ask: "Will an idol be played within the next two?", answer: "yesNo", points: 1, asked: "each", over: 2, settle: { by: "moment", moment: "idolPlayed", take: "happened" } },
  { id: "merge", ask: "Which episode does the merge happen in?", answer: "number", points: 3, settle: { by: "phase", phase: "merged", take: "starts" } },
  { id: "phase", ask: "Who finds an idol this phase?", answer: "person", points: 1, pick: 2, asked: "phase", settle: { by: "moment", moment: "idolFound", take: "who" } },
];

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
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
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    as.desk = await api({ user: DESK, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    check(!!rb, "the season's rulebook (the desk's season page makes it)", JSON.stringify(season.rulebook));

    // ---------- A game of questions over windows ----------
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
    check(G.sameValue(ctx.phases.map((p) => p.id), ["tribes", "merged"]), "the show's ctx: two phases, Tribes then Merged", JSON.stringify(ctx.phases));
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: QUESTIONS, extras: { lateLock: { hours: 72 } } }, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const made = (await league(QG)).state;
    check(!problems.length && made.settings.leagueTypeId === "questions" && made.settings.lateLockHours === 72, "  the four are written, with a late lock of 72 hours", JSON.stringify(problems));

    // ---------- Answering Episode 6's ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    let g = await read("jordan");
    check(
      g.episode === 6 && ["gone", "within", "phase"].every((id) => byId(g, id)?.episode === 6 && byId(g, id).status === "open") && byId(g, "merge")?.episode === null,
      "jordan reads Episode 6's: every window opens at 6, the merge's the game's own",
      JSON.stringify(g.questions?.map((x) => [x.id, x.episode, x.status]))
    );
    const still = made.castaways.filter((c) => c.status !== "eliminated");
    const [goesAt6, goesAt7, finder6, finder7, other] = still;
    r = await ask("jordan", { answers: { gone: goesAt6.id, within: "yes", merge: 7, phase: [finder6.id, other.id] } });
    check(r.status === 200, "jordan answers all four", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("riley", { answers: { gone: other.id, within: "no", merge: 9 } });
    check(r.status === 200, "riley answers three", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    r = await ask("riley", { episode: 5, answers: { within: "yes" } });
    check(r.status === 409, "  an answer for another episode is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- The desk confirms the merge at 7, ahead ----------
    r = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 7 });
    let s = (await league(QG)).state;
    check(r.status === 200 && s.phaseStarts?.merged === 7 && s.phaseWindows?.merged === 7, "the desk confirms the merge at 7: the game records it, its phase window opens there", JSON.stringify({ status: r.status, starts: s.phaseStarts, windows: s.phaseWindows }));

    // ---------- The lock: Episode 6 airs ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await seen("jordan", 6);
    r = await ask("jordan", { answers: { within: "no" } });
    check(r.status === 409, "Episode 6 has started: jordan, who's seen it, can't answer (409)", `${r.status} ${JSON.stringify(r.body)}`);
    g = await read("riley");
    check(g.episode === 6 && byId(g, "within")?.status === "open" && g.questions.every((x) => x.people.length === 0), "riley, still at 5: Episode 6's still open for her (the late lock), nobody's answers shown", JSON.stringify(g.questions?.map((x) => [x.id, x.episode, x.status, x.people.length])));
    r = await ask("riley", { answers: { within: "yes" } });
    check(r.status === 200, "  she changes her answer after it started", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    g = await read("jordan", 6);
    const within = byId(g, "within");
    check(within?.status === "closed" && within.people.some((p) => !p.you && p.answer === "yes"), "  jordan sees everyone's, hers among them", JSON.stringify(within?.people));

    // ---------- Episode 6's results, then 7's ----------
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const decide = async (n, rows) => {
      for (const [kind, name, method, eventType] of rows) {
        await pool.query(
          `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
           VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), $7)`,
          [sid, n, kind, name, method, eventType, n >= 7]
        );
      }
      await syncSeasonLeagues(sid, null);
    };
    await decide(6, [["elimination", goesAt6.name, "Voted Out", ""], ["event", other.name, "", "idolPlayed"], ["event", finder6.name, "", "idolFound"]]);
    g = await read("jordan");
    check(g.episode === 7 && byId(g, "phase")?.episode === 7 && byId(g, "phase").status === "open" && byId(g, "gone")?.episode === 6 && byId(g, "gone").status === "closed", "this week is 7: the phase question's new window (Merged) opens there; the two-episode run is still 6's, locked", JSON.stringify(g.questions?.map((x) => [x.id, x.episode, x.status])));
    r = await ask("jordan", { answers: { phase: [finder7.id] } });
    check(r.status === 200, "  jordan answers Merged's", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [["elimination", goesAt7.name, "Voted Out", ""], ["event", finder7.name, "", "idolFound"]]);

    // ---------- Graded, as each one has seen it ----------
    await seen("jordan", 7);
    g = await read("jordan", 6);
    const me = (x) => x.people.find((p) => p.you);
    const earned = ["gone", "within", "merge", "phase"].map((id) => [id, me(byId(g, id))?.earned ?? null]);
    check(G.sameValue(earned, [["gone", 2], ["within", 1], ["merge", 3], ["phase", 1]]), "jordan at 7: gone in 6-7 (2), an idol within two (1), the merge at 7 (3), Tribes' finder in 6 (1)", JSON.stringify(earned));
    check(byId(g, "merge").verdict?.value === 7 && G.sameValue(byId(g, "gone").verdict?.right?.sort(), [goesAt6.id, goesAt7.id].sort()), "  the merge was Episode 7; both who went home count for the run", JSON.stringify([byId(g, "merge").verdict, byId(g, "gone").verdict]));
    const g7 = await read("jordan", 7);
    check(byId(g7, "phase")?.episode === 7 && byId(g7, "phase").verdict?.state === "waiting", "  Merged's window runs to the game's end: still to settle", JSON.stringify(byId(g7, "phase")?.verdict));
    check(g.points === 7, "  7 points", String(g.points));
    const rg = await read("riley", 6);
    check(rg.points === 0 && byId(rg, "merge").verdict?.state === "waiting", "riley, still at 5: nothing settled, not even where the merge was", JSON.stringify({ points: rg.points, v: byId(rg, "merge").verdict }));
    await seen("riley", 7);
    const rg7 = await read("riley", 6);
    check(rg7.points === 1, "  once she's seen 7: her late yes on the idol counts (1)", String(rg7.points));

    // ---------- The flag ----------
    const flagged = checkLeague((await league(QG)).state);
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
    if (specsOn) check(GameSpecs.carryGame(JSON.parse(JSON.stringify((await league(QG)).state.settings)), true) === false, "  and its carried spec is in step");
    else console.log("NOTE  the game-specs flag is off: whether its carried spec is in step was skipped");
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
