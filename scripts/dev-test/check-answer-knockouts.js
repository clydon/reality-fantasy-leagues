// Dev-only check of a game of questions' knockouts (docs/PLAN-start-a-game-gpt.md step A11 part 2b: game-spec schema.js
// answerParts and settings.js, state-logic.js AnswerLogic.walk, answer-points.ts walked and asItStands, answers.ts, game-view.ts,
// couch-hub.ts) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex,
// riley, jordan, sam on ZT Survivor 51: results through Episode 5; Episode 6 three days off; everyone has seen 5 but sam, 3).
//   - A game of questions like the stretch request s48 ("Guess every elimination winner; a wrong guess knocks you out"), on
//     Survivor's who goes home: jordan starts a Survival Pool for Episode 6 on, the others join it, and it's made a game of
//     questions through RosterLogic.setGame with the show's ctx (its field: questionsLives): one question each
//     episode, Who goes home?, one life (a wrong answer, or none, costs it), last one standing, one left ending it.
//   - Episode 6, through the answers route before the lock: alex and jordan name who goes home, riley and sam someone else. It
//     airs and its result comes through the season sync: riley and sam are out after 6.
//   - The Games tab as jordan reads it (seen 6): alex and jordan tied first, riley and sam tied after them (out); as sam reads it
//     (seen 5): nobody out yet, all level. riley's sheet asks nothing of her; alex's asks Episode 7's. riley's answer for 7 is
//     refused (409), and so is sam's (the league as it stands: Noticed, the refusal says what he hasn't seen). An answer of
//     riley's for 7 written as if made before her result was in counts for nobody.
//   - Episode 7: alex wrong, jordan right: alex out, jordan the last one standing, over at 7 (the Games tab's `over`; the
//     questions read says it ended with 7 and asks nothing; an answer for 8 refused). The hub as jordan reads it: her place first,
//     the game over, the plaque hers.
//   - A corrected result (the desk's decision for Episode 7 changed, re-decided): worked out again, alex the last one standing,
//     jordan second; the Games tab agrees; the sheet's nights (answer-points.ts sheetNights) say what each night was.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-answer-knockouts.js [--keep]
//
// One fixed scenario on purpose (its answers and boots are the story above), run again whenever a game of questions' knockouts
// change. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database.
// Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-answer-knockouts runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const decide = async (n, names) => {
      for (const name of names) {
        await pool.query(
          `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
           VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
          [sid, n, name]
        );
      }
      await syncSeasonLeagues(sid, null);
    };

    // ---------- The game ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["alex", "riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [QG])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), QG]);
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [QG])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const whoOf = (playerId) => Object.keys(pid).find((k) => pid[k] === playerId);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(QG, sid);
    let st = await league();
    const problems = S.setGame(st, { spec: 1, span: S.gameOf(st).span, get: { by: "none" }, score: { by: "answers", lives: 1 }, ask: [BOOT] }, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    check(!problems.length && st.settings.leagueTypeId === "questions" && st.settings.questionsLives === 1 && S.gameOf(st).rank.by === "standing",
      "  made a game of questions: Who goes home? each episode, one life, last one standing (setGame, the show's ctx)", JSON.stringify({ problems, rank: S.gameOf(st).rank }));

    // ---------- Episode 6 ----------
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    const [X, Y, Z, P, Q] = still;
    for (const who of ["alex", "riley", "jordan", "sam"]) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}`)).body;
    const gameOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === QG) ?? null;
    const said = (g) => (g?.table ?? []).map((t) => [whoOf(t.playerId), t.rank, t.total]);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const answered = [];
    for (const [who, c] of [["alex", X], ["jordan", X], ["riley", Y], ["sam", Z]]) answered.push((await ask(who, { answers: { boot: c.id } })).status);
    check(answered.every((s) => s === 200), `Episode 6's answers: alex and jordan ${X.name}, riley ${Y.name}, sam ${Z.name}`, JSON.stringify(answered));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, [X.name]);
    st = await league();
    // Early results (who went home, nothing scored: the sync marks an episode final on a scoring moment): all a who-goes-home
    // question needs, so its lives count at once (a race or a cut on points would wait).
    const e6 = st.episodes.find((e) => e.number === 6);
    check(S.EpisodeLogic.resultsStage(e6) === "early" && e6.events.some((ev) => ev.castawayId === X.id), `Episode 6's result reaches it (the season sync, early results): ${X.name} home`, JSON.stringify(e6.events));

    // ---------- After 6, as each one has seen it ----------
    await seen("jordan", 6);
    let g = await gameOf("jordan");
    check(same(said(g), [["alex", "T1", 1], ["jordan", "T1", 1], ["riley", "T3", 0], ["sam", "T3", 0]]) || same(said(g), [["jordan", "T1", 1], ["alex", "T1", 1], ["riley", "T3", 0], ["sam", "T3", 0]]) || same(said(g), [["alex", "T1", 1], ["jordan", "T1", 1], ["sam", "T3", 0], ["riley", "T3", 0]]) || same(said(g), [["jordan", "T1", 1], ["alex", "T1", 1], ["sam", "T3", 0], ["riley", "T3", 0]]),
      "the Games tab as jordan reads it: alex and jordan tied first (right), riley and sam tied after (out after 6)", JSON.stringify(said(g)));
    check(g?.over === false, "  not over: two still in", String(g?.over));
    g = await gameOf("sam");
    check(said(g).every((x) => x[1] === "T1" && x[2] === 0) && g?.over === false, "as sam reads it (seen 5): nobody out yet, all level", JSON.stringify(said(g)));
    await seen("riley", 6);
    await seen("alex", 6);
    const rq = await read("riley");
    check(rq.out === 6 && rq.ended === null && rq.episode === 7, "riley's questions read: she's out after 6 (as far as she's seen); Episode 7's asked of the others", JSON.stringify({ out: rq.out, ended: rq.ended, episode: rq.episode }));
    check((await gameOf("riley"))?.sheet === null && (await gameOf("alex"))?.sheet?.of === 1, "  her sheet asks nothing of her; alex's asks Episode 7's one", JSON.stringify({ riley: (await gameOf("riley"))?.sheet, alex: (await gameOf("alex"))?.sheet }));
    r = await ask("riley", { answers: { boot: P.id } });
    check(r.status === 409 && /out of this game/.test(r.body?.error ?? ""), "riley's answer for 7 is refused: she's out", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("sam", { answers: { boot: P.id } });
    check(r.status === 409 && /out of this game/.test(r.body?.error ?? ""), "  and sam's, as the league stands (he hasn't seen 6: Noticed)", `${r.status} ${JSON.stringify(r.body)}`);
    // An answer of riley's for 7 as if made before her result was in: it counts for nobody (she's out after 6).
    await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, $2, 'boot', 7, $3::jsonb)", [QG, pid.riley, JSON.stringify(Q.id)]);

    // ---------- Episode 7 ----------
    check((await ask("alex", { answers: { boot: P.id } })).status === 200 && (await ask("jordan", { answers: { boot: Q.id } })).status === 200, `Episode 7's answers: alex ${P.name}, jordan ${Q.name}`);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [Q.name]);
    await seen("jordan", 7);
    g = await gameOf("jordan");
    check(same(said(g), [["jordan", "1", 2], ["alex", "2", 1], ["riley", "T3", 0], ["sam", "T3", 0]]) || same(said(g), [["jordan", "1", 2], ["alex", "2", 1], ["sam", "T3", 0], ["riley", "T3", 0]]),
      `Episode 7: ${Q.name} home, alex wrong: out; jordan the last one standing (riley's answer for 7 counts for nobody)`, JSON.stringify(said(g)));
    check(g?.over === true, "  over at 7: one left (the Games tab's over)", String(g?.over));
    const jq = await read("jordan");
    check(jq.ended === 7 && jq.episode === null && jq.questions.length === 0 && jq.out === null, "  jordan's questions read: it ended with 7, nothing more asked", JSON.stringify({ ended: jq.ended, episode: jq.episode, n: jq.questions.length }));
    r = await ask("jordan", { episode: 8, answers: { boot: P.id } });
    check(r.status === 409 && /ended with Episode 7/.test(r.body?.error ?? ""), "  an answer for 8 refused: the game ended with 7", `${r.status} ${JSON.stringify(r.body)}`);
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const mine = (hub.games ?? []).find((x) => x.leagueId === QG);
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === QG);
    check(mine?.rank === "1" && mine?.ended === true && plaque?.winners?.length === 1 && plaque.winners[0].userId === fx.users.jordan,
      "the hub as jordan reads it: first, the game over, the plaque hers", JSON.stringify({ mine, plaque }));

    // ---------- A corrected result ----------
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 7 AND castaway_name = $2", [sid, Q.name, P.name]);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const home7 = st.episodes.find((e) => e.number === 7).events.map((ev) => ev.castawayId);
    check(home7.includes(P.id) && !home7.includes(Q.id), `the desk corrects Episode 7: ${P.name} went home, not ${Q.name} (the season sync)`, JSON.stringify(home7));
    g = await gameOf("jordan");
    check((same(said(g), [["alex", "1", 2], ["jordan", "2", 1], ["riley", "T3", 0], ["sam", "T3", 0]]) || same(said(g), [["alex", "1", 2], ["jordan", "2", 1], ["sam", "T3", 0], ["riley", "T3", 0]])) && g?.over === true,
      "  worked out again: alex the last one standing, jordan second; still over at 7", JSON.stringify({ table: said(g), over: g?.over }));
    const { sheetNights } = jiti("../../src/lib/server/answer-points.ts");
    const { readyLeague } = jiti("../../src/lib/server/league-read.ts");
    const ready = await readyLeague(QG, await league());
    const nights = async (who) => Object.fromEntries([...(await sheetNights({ leagueId: QG, state: ready, playerId: pid[who], mark: 7 }))].map(([n, x]) => [n, [x.answered, x.right]]));
    const jn = await nights("jordan");
    const rn = await nights("riley");
    check(same(jn, { 6: [1, 1], 7: [1, 0] }) && same(rn, { 6: [1, 0] }), "  the sheet's nights: jordan right in 6, wrong in 7; riley's 7 isn't a night (she was out)", JSON.stringify({ jordan: jn, riley: rn }));
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
