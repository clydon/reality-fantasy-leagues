// Dev-only check of trivia in a game (docs/PLAN-start-a-game-gpt.md step A13 part 1: game-spec schema.js's trivia answer and answers.js's
// grading, trivia-key.ts, answer-points.ts serverFacts, answers.ts's round) against the dev server, through the API (no screens: they're
// the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5, Episode 6 three days off; sam has
// seen through Episode 3). The trivia key is filed here as the bot's trivia run files it (trivia_questions on the fixture's season,
// which goes with it). In order:
//   - The data rule: with the season's research schedule switched to one without a trivia run, the engine lab refuses a trivia game;
//     back to our usual, it starts. The desk's admin (zt_nd_desk, made here) starts two from the lab: T, a game of questions from
//     Episode 6 asking the round of trivia before each episode (a point each), and P1 (the tracker's p1 on this season), Bingo at 5
//     points a line with Trivia alongside, by points. alex, riley, jordan and sam join both.
//   - The round before Episode 6 (the batch written after 5: three live, one the check dropped): alex sees its three questions, no
//     answers; sam (seen 3) is behind until Episode 5. The trivia sheet holds that batch back from alex (who plays a game that asks it)
//     until the round locks, not from casey (who doesn't). alex, riley and jordan answer; an option that isn't one, a dropped question
//     and sam's answer are refused; jordan played one of its questions in the trivia sheet, so that one is refused for jordan (the rest
//     taken); once alex has played one there, a change leaving it out keeps alex's earlier answer to it, and taking it back is refused.
//     alex answers P1's Trivia stage too.
//   - Two flags pull one question from the sheet, not from the game (players' flags are the couch's word); an admin's pull takes it out
//     of the game's round. Episode 6 airs: the game is live, so the round stays open for whoever hasn't watched it and the sheet
//     still holds the batch from alex; once they've watched it the answers close and the sheet gives alex the batch again. Its result comes in through the
//     season sync: graded on the two left. T's table: alex 2, jordan 1, riley 0, sam 0; as sam (seen 3), nothing; P1's overall adds
//     alex's trivia point.
//   - The round before Episode 7: the batch written after 6, answered by alex, then written again (new questions) before Episode 7's
//     lock: alex's answer is void, 0. The round before Episode 8 has no batch: nothing to answer (an answer refused); a batch written
//     once 8 has aired isn't its key, and once 8 has results the round is off: no points either way.
//   - The game-specs flag's check passes on both games and P1's stages.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-trivia-game.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-trivia-game runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const TRIVIA = { id: "trivia", ask: "Trivia about the episode before", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } };
const QUESTIONS = { get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [TRIVIA] };
const T_SPEC = { ...QUESTIONS, span: { from: 6 } };
const P1_SPEC = {
  stages: [
    { id: "bingo", name: "Bingo", game: { preset: "weekly-bingo", span: { from: 6 }, score: { by: "lines", points: 5 } } },
    { id: "trivia", name: "Trivia", alongside: true, game: QUESTIONS },
  ],
  overall: { by: "points" },
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on the couch.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    fx.users.desk = deskId;
    const as = {};
    for (const who of [...WHO, "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, seen, stateOf, gameIn } = k;
    let r;
    const start = (spec) => as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(spec) });

    // ---------- the data rule: a season whose research writes no trivia ----------
    await pool.query(`UPDATE show_seasons SET bot_research_schedule = '[{"kind":"quick","after":0,"on":true},{"kind":"trivia","after":1440,"on":false}]'::jsonb WHERE id = $1`, [sid]);
    r = await start(T_SPEC);
    check(r.status !== 200 && /writes no trivia/.test(JSON.stringify(r.body)), "a season whose research schedule has its trivia run off: the lab refuses a trivia game", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    await pool.query("UPDATE show_seasons SET bot_research_schedule = NULL WHERE id = $1", [sid]);

    // ---------- the two games, joined ----------
    r = await start(T_SPEC);
    const T = r.body?.leagueId;
    check(r.status === 200 && !!T, "our usual writes trivia: the desk's admin starts T, a round of trivia before each episode from 6", `${r.status} ${errorOf(r)}`);
    r = await start(P1_SPEC);
    const P = r.body?.leagueId;
    const TS = (await pool.query("SELECT id FROM leagues WHERE stage_of = $1 AND stage_key = 'trivia'", [P])).rows[0]?.id;
    check(r.status === 200 && !!P && !!TS, "  and P1, Bingo at 5 a line with Trivia alongside (the tracker's p1), each stage a league", `${r.status} ${errorOf(r)}`);
    for (const who of WHO) {
      for (const g of [T, P]) {
        r = await as[who].call("POST", `/api/couches/${couch}/games/${g}`, { action: "join" });
        check(r.status === 200, `  ${who} joins ${g === T ? "T" : "P1"}`, `${r.status} ${errorOf(r)}`);
      }
    }
    const seatsT = await k.seatsOf(T);
    const seatsP = await k.seatsOf(P);

    // ---------- the trivia key, as the bot's trivia run files it ----------
    const t0 = await stateOf(T);
    const names = t0.castaways.filter((c) => c.status === "active").map((c) => c.name);
    // Written a month back (before every lock, however far the check moves the season's clock), or `late`: now.
    const file = async (after, list, late = false) => {
      await pool.query("DELETE FROM trivia_questions WHERE season_id = $1 AND made_after = $2", [sid, after]);
      const ids = [];
      for (const q of list) {
        const { rows } = await pool.query(
          `INSERT INTO trivia_questions (season_id, made_after, episode, kind, question, options, answer, why, source, status, note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'https://example.invalid/recap', $9, $10, now() - make_interval(days => $11::int)) RETURNING id`,
          [sid, after, q.episode, q.kind, q.question, JSON.stringify(q.options), q.answer, q.why ?? null, q.status ?? "live", q.status === "dropped" ? "the check couldn't confirm the answer" : null, late ? 0 : 30]
        );
        ids.push(rows[0].id);
      }
      return ids;
    };
    const [q1, q2, q3, q4] = await file(5, [
      { episode: 5, kind: "cast", question: "Who found the clue in the shelter?", options: names.slice(0, 4), answer: names[1], why: `${names[1]} found it.` },
      { episode: 4, kind: "number", question: "How many votes were cast at the first vote of Episode 4?", options: ["5", "6", "7", "8"], answer: "7" },
      { episode: 5, kind: "text", question: "What was the reward?", options: ["Pizza", "Coffee", "A letter home", "A blanket"], answer: "Coffee" },
      { episode: 5, kind: "text", question: "What colour was the buff?", options: ["Red", "Blue", "Green", "Gold"], answer: "Red", status: "dropped" },
    ]);
    const questions = async (who, league, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${league}${episode ? `&episode=${episode}` : ""}`)).body;
    const trivQ = (body) => (body?.questions ?? []).find((q) => q.answer === "trivia") ?? null;
    let tq = trivQ(await questions("alex", T));
    check(tq?.episode === 6 && tq.status === "open" && tq.trivia?.length === 3 && tq.trivia.every((t) => t.answer === null && !t.played),
      "the round before Episode 6: alex sees its three live questions (the dropped one left out), no answers", JSON.stringify(tq && { episode: tq.episode, status: tq.status, trivia: tq.trivia }));
    check(JSON.stringify(tq?.trivia?.map((t) => t.id)) === JSON.stringify([q1, q2, q3]) && tq.trivia[1].options.join() === "5,6,7,8", "  in the order written, each with its options (a number's smallest first)", JSON.stringify(tq?.trivia));
    // Options shuffled as the sheet deals them (the bot writes the right answer first more often than not), the same for everyone.
    const rileyQ = trivQ(await questions("riley", T));
    const order = (v, id) => (v?.trivia ?? []).find((t) => t.id === id)?.options.join("|");
    check(order(tq, q3) === order(rileyQ, q3) && order(tq, q1) === order(rileyQ, q1) && [...(tq?.trivia?.[2]?.options ?? [])].sort().join() === ["A blanket", "A letter home", "Coffee", "Pizza"].join(),
      "  each question's options shuffled, the same for everyone", JSON.stringify({ alex: [order(tq, q1), order(tq, q3)], riley: [order(rileyQ, q1), order(rileyQ, q3)] }));
    const samQ = trivQ(await questions("sam", T));
    check(samQ?.status === "behind" && samQ.catchUp === 5 && samQ.trivia === null, "  sam (seen 3) is behind: see Episode 5 first, no questions shown", JSON.stringify(samQ && { status: samQ.status, catchUp: samQ.catchUp, trivia: samQ.trivia }));
    // The trivia sheet, which shows each answer as it's tapped: the batch held back from alex until the round locks, not from casey.
    const sheet = async (who, withCouch) => ((await as[who].call("GET", `/api/seasons/${sid}/trivia${withCouch ? `?couch=${couch}` : ""}`)).body?.questions ?? []).map((q) => q.id);
    const batch5 = new Set([q1, q2, q3].map((id) => `r:${id}`));
    let alexSheet = await sheet("alex", true);
    const caseySheet = await sheet("casey", false);
    check(!alexSheet.some((id) => batch5.has(id)) && caseySheet.some((id) => batch5.has(id)), "  the trivia sheet holds the batch back from alex (in a game that asks it) until the round locks, not from casey", JSON.stringify({ alexSheet, caseySheet }));

    // ---------- the answers ----------
    const answer = (who, league, value, episode = 6) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${league}`, { episode, answers: { trivia: value } });
    r = await answer("alex", T, { [q1]: names[1], [q2]: "7", [q3]: "Pizza" });
    check(r.status === 200, "  alex answers all three (two right)", `${r.status} ${errorOf(r)}`);
    r = await answer("riley", T, { [q1]: names[0] });
    check(r.status === 200, "  riley answers one (wrong)", `${r.status} ${errorOf(r)}`);
    r = await answer("alex", T, { [q1]: "Nobody" });
    check(r.status === 400, "  an option that isn't one of its own is refused", `${r.status} ${errorOf(r)}`);
    r = await answer("alex", T, { [q4]: "Red" });
    check(r.status === 400, "  so is the dropped question", `${r.status} ${errorOf(r)}`);
    r = await answer("sam", T, { [q2]: "7" });
    check(r.status === 403, "  and sam's, behind", `${r.status} ${errorOf(r)}`);
    // jordan played q1 in the trivia sheet, where its answer is shown.
    const showId = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [sid])).rows[0].show_id;
    // A play of the week's round that asked q1 (before jordan was in a game that asks trivia): only q1's answer was shown.
    const play = (who, answers) =>
      pool.query(
        `INSERT INTO trivia_plays (user_id, show_id, week, round, season_id, score, questions, answers) VALUES ($1, $2, date_trunc('week', now() AT TIME ZONE 'UTC')::date, '', $3, 1, 3, $4::jsonb)`,
        [fx.users[who], showId, sid, JSON.stringify(answers)]
      );
    await play("jordan", { [`r:${q1}`]: names[1] });
    const jq = trivQ(await questions("jordan", T));
    check(jq?.trivia?.find((t) => t.id === q1)?.played === true && jq.trivia.filter((t) => t.played).length === 1, "  jordan's view: q1 played in the trivia sheet", JSON.stringify(jq?.trivia?.map((t) => [t.id === q1, t.played])));
    r = await answer("jordan", T, { [q1]: names[1], [q2]: "7" });
    check(r.status === 409, "  jordan's answer to it is refused (its answer was shown there)", `${r.status} ${errorOf(r)}`);
    r = await answer("jordan", T, { [q2]: "7", [q3]: "A blanket" });
    check(r.status === 200, "  the rest taken (one right)", `${r.status} ${errorOf(r)}`);
    r = await answer("alex", TS, { [q1]: names[1] });
    check(r.status === 200, "  alex answers P1's Trivia stage (right)", `${r.status} ${errorOf(r)}`);
    // alex plays q1 in the sheet (as a week's round could have asked it): alex's earlier answer to it stands.
    await play("alex", { [`r:${q1}`]: names[1] });
    r = await answer("alex", T, { [q2]: "7" });
    const kept = trivQ(r.body)?.mine;
    check(r.status === 200 && kept?.[q1] === names[1] && kept?.[q2] === "7" && !(q3 in (kept ?? {})), "  alex, having played q1 in the sheet, changes the rest: the earlier q1 answer is kept", `${r.status} ${JSON.stringify(kept)}`);
    r = await answer("alex", T, null);
    check(r.status === 409, "  and can't take it back now", `${r.status} ${errorOf(r)}`);

    // ---------- pulls, the lock, the result ----------
    await pool.query("INSERT INTO trivia_flags (question_id, user_id) VALUES ($1, $2), ($1, $3)", [q2, fx.users.riley, fx.users.sam]);
    tq = trivQ(await questions("alex", T));
    check(JSON.stringify(tq?.trivia?.map((t) => t.id)) === JSON.stringify([q1, q2, q3]), "two players' flags on q2 don't pull it from the game (the couch's word)", JSON.stringify(tq?.trivia?.map((t) => t.id)));
    await pool.query("INSERT INTO trivia_flags (question_id, user_id) VALUES ($1, $2)", [q3, deskId]);
    tq = trivQ(await questions("alex", T));
    check(JSON.stringify(tq?.trivia?.map((t) => t.id)) === JSON.stringify([q1, q2]), "  an admin's pull takes q3 out of the round", JSON.stringify(tq?.trivia?.map((t) => t.id)));
    await k.airs(4);
    // The game is live (the default: docs/PLAN-own-pace-games.md, "Pace is the game's setting"), so the round stays open for whoever
    // hasn't watched Episode 6, and the sheet holds its key back from them for as long (trivia-key.ts heldFromSheet, BACKLOG 64).
    alexSheet = await sheet("alex", true);
    check(!alexSheet.includes(`r:${q1}`) && !alexSheet.some((id) => batch5.has(id)), "Episode 6 airs: the sheet still holds the batch from alex, who hasn't watched it (the round's still open for them)", JSON.stringify(alexSheet));
    for (const who of ["alex", "riley"]) await seen(who, 6);
    r = await answer("riley", T, { [q2]: "7" });
    check(r.status === 409, "  once riley has watched it, the round is closed", `${r.status} ${errorOf(r)}`);
    alexSheet = await sheet("alex", true);
    check(alexSheet.includes(`r:${q1}`) || alexSheet.some((id) => batch5.has(id)), "  and the sheet gives alex, who has now, the batch again", JSON.stringify(alexSheet));
    const goes = names[7];
    await decide(6, "elimination", goes);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    const totals = (g, seats) => Object.fromEntries((g?.table ?? []).map((t) => [Object.keys(seats).find((w) => seats[w] === t.playerId) ?? t.name, t.total]));
    tq = trivQ(await questions("alex", T, 6));
    const earned = Object.fromEntries((tq?.people ?? []).map((p) => [Object.keys(seatsT).find((w) => seatsT[w] === p.playerId), [p.earned, p.right]]));
    check(tq?.verdict?.state === "known" && JSON.stringify(Object.keys(tq.verdict.each ?? {})) === JSON.stringify([q1, q2]), "Episode 6's result through the season sync: the round graded on the two left", JSON.stringify(tq?.verdict));
    check(K.same(earned, { alex: [2, true], riley: [0, false], jordan: [1, true] }), "  alex 2 (q1 and q2), riley none right, jordan 1 (q2)", JSON.stringify(earned));
    check(tq?.trivia?.[0]?.answer === names[1] && tq.trivia[0].why === `${names[1]} found it.`, "  once graded, each question's answer and why", JSON.stringify(tq?.trivia?.[0]));
    let tt = totals(await gameIn("alex", T), seatsT);
    check(tt.alex === 2 && tt.jordan === 1 && tt.riley === 0 && tt.sam === 0, "  T's table: alex 2, jordan 1, riley 0, sam 0", JSON.stringify(tt));
    tt = totals(await gameIn("sam", T), seatsT);
    check(Object.values(tt).every((n) => n === 0), "  as sam (seen 3): nothing graded", JSON.stringify(tt));
    const pt = totals(await gameIn("alex", P), seatsP);
    check(pt.alex === 1 && pt.riley === 0, "  P1's overall: alex's trivia point added to Bingo's (no lines)", JSON.stringify(pt));

    // ---------- the round before 7: written again after it was answered ----------
    const [r1, r2] = await file(6, [
      { episode: 6, kind: "text", question: "What did the tribe build?", options: ["A raft", "A ladder", "A table", "A swing"], answer: "A table" },
      { episode: 6, kind: "number", question: "How many idols were in play?", options: ["0", "1", "2", "3"], answer: "2" },
    ]);
    tq = trivQ(await questions("alex", T));
    check(tq?.episode === 7 && tq.status === "open" && tq.trivia?.length === 2, "the round before Episode 7 (the batch written after 6) is open for alex", JSON.stringify(tq && { episode: tq.episode, status: tq.status, n: tq.trivia?.length }));
    r = await answer("alex", T, { [r1]: "A table", [r2]: "2" }, 7);
    check(r.status === 200, "  alex answers it (both right)", `${r.status} ${errorOf(r)}`);
    await file(6, [
      { episode: 6, kind: "text", question: "Who led the shelter build?", options: ["A", "B", "C", "D"], answer: "A" },
      { episode: 6, kind: "text", question: "What was in the tree mail?", options: ["A map", "A note", "A key", "A bag"], answer: "A note" },
    ]);
    await k.airs(7);
    await decide(7, "elimination", names[6]);
    await seen("alex", 7);
    tq = trivQ(await questions("alex", T, 7));
    const alex7 = (tq?.people ?? []).find((p) => p.playerId === seatsT.alex);
    check(tq?.verdict?.state === "known" && alex7 && alex7.right === null && alex7.earned === 0, "  the batch written again before the result: alex's answer is void (neither right nor wrong), 0", JSON.stringify({ verdict: tq?.verdict?.state, alex7 }));
    tt = totals(await gameIn("alex", T), seatsT);
    check(tt.alex === 2, "  T's table still has alex at 2", JSON.stringify(tt));

    // ---------- the round before 8: no batch ----------
    tq = trivQ(await questions("alex", T));
    check(tq?.episode === 8 && tq.status === "open" && tq.trivia?.length === 0 && /No trivia questions/.test(tq.offWhy ?? ""), "the round before Episode 8 has no batch: nothing to answer, and it says so", JSON.stringify(tq && { episode: tq.episode, trivia: tq.trivia, offWhy: tq.offWhy }));
    r = await answer("alex", T, { [r1]: "A table" }, 8);
    check(r.status === 400, "  an answer is refused", `${r.status} ${errorOf(r)}`);
    await k.airs(7);
    // A batch written once Episode 8 has aired: too late for its round.
    await file(7, [{ episode: 7, kind: "text", question: "What was the twist?", options: ["A", "B", "C", "D"], answer: "A" }], true);
    await decide(8, "elimination", names[5]);
    await seen("alex", 8);
    tq = trivQ(await questions("alex", T, 8));
    check(tq?.verdict?.state === "off" && /no trivia/i.test(tq.verdict.why ?? "") && tq.trivia?.length === 0, "  a batch written once 8 aired isn't its key; with 8's results the round is off: no points either way", JSON.stringify({ verdict: tq?.verdict, trivia: tq?.trivia }));
    tt = totals(await gameIn("alex", T), seatsT);
    check(tt.alex === 2 && tt.jordan === 1, "  T's table: alex 2, jordan 1", JSON.stringify(tt));

    // ---------- the flag ----------
    const stages = (await pool.query("SELECT id, stage_key FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL", [P])).rows;
    for (const [id, what] of [[T, "T"], [P, "P1"], ...stages.map((x) => [x.id, `P1's ${x.stage_key}`])]) {
      const flagged = checkLeague(await stateOf(id));
      check(flagged.ok, `the game-specs flag's check passes on ${what}`, JSON.stringify(flagged));
    }
  } catch (e) {
    out.fail();
    console.error("FAIL  the check threw:", e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down failed:", e.message));
    await pool.end();
    console.log(out.failures() ? `${out.failures()} FAILED` : "ALL PASS");
    process.exit(out.failures() ? 1 : 0);
  }
})();
