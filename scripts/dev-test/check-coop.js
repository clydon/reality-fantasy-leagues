// Dev-only check of co-op against the show (docs/PLAN-start-a-game-gpt.md step A11 part 3: game-spec schema.js answerParts' coop
// and settings.js, state-logic.js AnswerLogic.walk's co-op, answer-points.ts walked and asItStands, answers.ts, game-view.ts,
// couch-hub.ts and couch-standings.ts) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5; Episode 6 three days off;
// everyone has seen 5 but sam, 3).
//   - A co-op game of questions like the dial row win.coop (the stretch request s37's, on Survivor's who goes home): jordan starts
//     a Survival Pool for Episode 6 on, the others join it, and it's made a game of questions through RosterLogic.setGame with the
//     show's ctx: Who goes home? each episode, two lives, the couch's together (questionsLives, questionsRank 'coop'), a night
//     costing one unless one of you named who went home.
//   - Episode 6, through the answers route before the lock: alex names who goes home, riley and jordan someone else, sam nothing.
//     Its result through the season sync: one of you saw it coming, so both lives stand. The Games tab as jordan reads it: one
//     shared place (everyone T1), alex's point, the view's coop (two lives of two, still playing); as sam reads it (seen 5): the
//     same, nothing graded yet.
//   - Episode 7: nobody right (sam silent): one life gone; the questions read says so (coop.lives 1) and asks Episode 8's.
//   - Episode 8: nobody right again: the last life goes, lost by all. The Games tab: over, still one shared place, coop result
//     lost; the questions read: it ended with 8, nothing more asked; an answer for 9 refused. The hub as jordan reads it: the game
//     over, its plaque with no winners (the show won) and its coop result, no title for anyone, and no place in the power
//     rankings from it.
//   - A corrected result (the desk's decision for Episode 8 changed, re-decided, to the one alex and jordan named): worked out
//     again, one life left, the game back on (not over; the questions read no longer says it ended).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-coop.js [--keep]
//
// One fixed scenario on purpose (its answers and boots are the story above), run again whenever co-op changes. Brings new-fixture.js
// up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch
// with other checks: never run two at once. Prints PASS/FAIL.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-coop runs against a local database only");
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
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(QG, sid);
    let st = await league();
    const problems = S.setGame(st, { spec: 1, span: S.gameOf(st).span, get: { by: "none" }, score: { by: "answers", lives: 2 }, rank: { by: "coop" }, ask: [BOOT] }, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    check(!problems.length && st.settings.leagueTypeId === "questions" && st.settings.questionsLives === 2 && st.settings.questionsRank === "coop" && S.gameOf(st).rank.by === "coop",
      "  made a co-op game of questions: Who goes home? each episode, two lives, the couch's (setGame, the show's ctx)", JSON.stringify({ problems, rank: S.gameOf(st).rank }));

    // ---------- Episode 6: one of you saw it coming ----------
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    const [X, Y, Z, P, Q, R, T] = still;
    for (const who of ["alex", "riley", "jordan", "sam"]) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}`)).body;
    const gameOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === QG) ?? null;
    const table = (g) => (g?.table ?? []).map((t) => [t.rank, t.total]).sort((a, b) => b[1] - a[1]);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const answered = [];
    for (const [who, c] of [["alex", X], ["riley", Y], ["jordan", Z]]) answered.push((await ask(who, { answers: { boot: c.id } })).status);
    check(answered.every((s) => s === 200), `Episode 6's answers: alex ${X.name}, riley ${Y.name}, jordan ${Z.name}, sam nothing`, JSON.stringify(answered));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, [X.name]);
    st = await league();
    const e6 = st.episodes.find((e) => e.number === 6);
    check(!!e6 && e6.events.some((ev) => ev.castawayId === X.id), `Episode 6's result reaches it (the season sync): ${X.name} home`, JSON.stringify(e6?.events));
    await seen("jordan", 6);
    let g = await gameOf("jordan");
    check(same(table(g), [["T1", 1], ["T1", 0], ["T1", 0], ["T1", 0]]) && g?.over === false,
      "the Games tab as jordan reads it: one shared place, alex's point; still playing", JSON.stringify({ table: table(g), over: g?.over }));
    check(same(g?.coop, { lives: 2, of: 2, lost: [], result: null }), "  the view's coop: alex saw it coming, both lives stand", JSON.stringify(g?.coop));
    g = await gameOf("sam");
    check(same(table(g), [["T1", 0], ["T1", 0], ["T1", 0], ["T1", 0]]) && g?.coop?.lives === 2, "as sam reads it (seen 5): nothing graded yet, two lives", JSON.stringify({ table: table(g), coop: g?.coop }));

    // ---------- Episode 7: nobody saw it coming ----------
    for (const who of ["alex", "riley", "sam"]) await seen(who, 6);
    check((await ask("alex", { answers: { boot: P.id } })).status === 200 && (await ask("jordan", { answers: { boot: P.id } })).status === 200, `Episode 7's answers: alex and jordan ${P.name}; riley and sam nothing`);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [Q.name]);
    for (const who of ["alex", "riley", "jordan", "sam"]) await seen(who, 7);
    const q7 = await read("jordan");
    check(q7.coop?.lives === 1 && q7.coop?.result === null && q7.ended === null && q7.out === null && q7.episode === 8,
      `Episode 7: ${Q.name} home, nobody named them: one life gone; the questions read says so and asks Episode 8's`, JSON.stringify({ coop: q7.coop, ended: q7.ended, out: q7.out, episode: q7.episode }));

    // ---------- Episode 8: the last life goes ----------
    check((await ask("alex", { answers: { boot: R.id } })).status === 200 && (await ask("jordan", { answers: { boot: R.id } })).status === 200 && (await ask("riley", { answers: { boot: Y.id } })).status === 200,
      `Episode 8's answers: alex and jordan ${R.name}, riley ${Y.name}`);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(8, [T.name]);
    for (const who of ["alex", "riley", "jordan", "sam"]) await seen(who, 8);
    g = await gameOf("jordan");
    check(g?.over === true && (g?.table ?? []).every((t) => t.rank === "T1") && same(g?.coop, { lives: 0, of: 2, lost: [{ episode: 7, question: "boot" }, { episode: 8, question: "boot" }], result: "lost" }),
      `Episode 8: ${T.name} home, nobody named them: the last life gone, lost by all (over, one shared place)`, JSON.stringify({ over: g?.over, table: table(g), coop: g?.coop }));
    const jq = await read("jordan");
    check(jq.ended === 8 && jq.episode === null && jq.questions.length === 0 && jq.out === null && jq.coop?.result === "lost",
      "  jordan's questions read: it ended with 8, nothing more asked, nobody out", JSON.stringify({ ended: jq.ended, episode: jq.episode, n: jq.questions.length, out: jq.out }));
    r = await ask("alex", { episode: 9, answers: { boot: R.id } });
    check(r.status === 409 && /ended with Episode 8/.test(r.body?.error ?? ""), "  an answer for 9 refused: the game ended with 8", `${r.status} ${JSON.stringify(r.body)}`);
    check((await gameOf("alex"))?.sheet === null, "  alex's sheet asks nothing", JSON.stringify((await gameOf("alex"))?.sheet));
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const mine = (hub.games ?? []).find((x) => x.leagueId === QG);
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === QG);
    check(mine?.ended === true && !!plaque && plaque.winners.length === 0 && same(plaque.coop, { result: "lost" }),
      "the hub as jordan reads it: the game over, its plaque with no winners (the show won), its result lost", JSON.stringify({ mine, plaque }));
    // The fixture's other games are all four people's: the power rankings count those that have scored, never the co-op one.
    const others = (hub.games ?? []).filter((x) => x.leagueId !== QG && x.through > 0).length;
    check((hub.rankings?.counted?.all ?? 0) === others, `  and the power rankings leave it out (${others} games counted, not ${others + 1})`, JSON.stringify(hub.rankings?.counted));

    // ---------- A corrected result ----------
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 8 AND castaway_name = $2", [sid, T.name, R.name]);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const home8 = st.episodes.find((e) => e.number === 8).events.map((ev) => ev.castawayId);
    check(home8.includes(R.id) && !home8.includes(T.id), `the desk corrects Episode 8: ${R.name} went home, not ${T.name} (the season sync)`, JSON.stringify(home8));
    g = await gameOf("jordan");
    check(g?.over === false && same(g?.coop, { lives: 1, of: 2, lost: [{ episode: 7, question: "boot" }], result: null }) && same(table(g), [["T1", 2], ["T1", 1], ["T1", 0], ["T1", 0]]),
      "  worked out again: alex and jordan saw 8 coming, one life left, the game back on", JSON.stringify({ over: g?.over, coop: g?.coop, table: table(g) }));
    const jq2 = await read("jordan");
    check(jq2.ended === null && jq2.coop?.lives === 1, "  the questions read no longer says it ended", JSON.stringify({ ended: jq2.ended, coop: jq2.coop, episode: jq2.episode }));
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
