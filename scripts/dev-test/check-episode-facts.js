// Dev-only check of episode facts in a game (docs/PLAN-start-a-game-gpt.md step A13 part 2: game-spec schema.js's `settle: { by:
// 'fact' }` and answers.js's grading, formats/episode-facts.js, episode-facts.ts, answer-points.ts serverFacts, answers.ts's ctx and
// engine-lab.ts's) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (ZT
// Survivor 51: 13 episodes, results through Episode 5, Episode 6 three days off; sam has seen through Episode 3). Research's answers
// are filed here as the bot's full run stores them (episode_research, source 'combined', its episodeFacts section; the fixture's
// show takes them with it). In order:
//   - The data rule: the show has never been asked (no stored answer has the section, and the season tapes measured nothing for a
//     zt- show): the lab refuses a title-quote game. Research's answers for Episodes 1 to 5, each sure who said its title: five,
//     still refused (not yet the six it takes to know). One more, an earlier season's: six of six, reliable, and the desk's admin
//     (zt_nd_desk, made here) starts two from the lab, Q (who says the title quote, a point, from Episode 6) and QT (which tribe it
//     comes from); alex, riley, jordan and sam join both.
//   - Before Episode 6: alex, riley and jordan pick, sam's (seen 3) refused. Episode 6 airs and its result comes in through the
//     season sync, but research hasn't said who said its title: waiting. Its answer lands (sure, jordan's pick): jordan 1, the
//     others 0, QT's tribe (Devin's, riley's answer) right for whoever named it; sam (seen 3) sees nothing graded. Research is corrected (alex's pick):
//     read again at once, alex 1 and jordan 0.
//   - Episode 7: research is sure the host said it: void for everyone, no points either way, and it says why. Episode 8: research
//     isn't sure who said it: void. Episode 9: waiting while its answer isn't stored (Episode 10's being in changes nothing), void
//     once it lands without the fact.
//   - The game-specs flag's check passes on both games.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-episode-facts.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-episode-facts runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const QUOTE = { id: "quote", ask: "Who says the title quote?", answer: "person", points: 1, asked: "each", settle: { by: "fact", fact: "titleQuote", take: "who" } };
const TRIBE = { ...QUOTE, id: "tribe", ask: "Which tribe does the title quote come from?", answer: "group" };
const game = (q) => ({ get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, span: { from: 6 }, ask: [q] });

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    fx.users.desk = deskId;
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, seen, stateOf, gameIn } = k;
    let r;
    const start = (spec) => as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(spec) });
    const showId = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [sid])).rows[0].show_id;
    // Research's stored answer for an episode, as the bot's full run stores it: its episodeFacts section (a title quote said by
    // `by`, sure or not, or the section's own value), on this season unless `season` says another.
    const research = async (n, titleQuote, season = 51) => {
      const payload = { episodeTitle: `Episode ${n}`, summary: "", castaways: [], ...(titleQuote === undefined ? {} : { episodeFacts: { titleQuote } }) };
      await pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source) VALUES ($1, $2, $3, $4::jsonb, '{"provider":"check"}'::jsonb, 'combined')
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload, researched_at = now()`,
        [showId, season, n, JSON.stringify(payload)]
      );
    };
    const said = (by, sure = "high") => ({ isQuote: "yes", line: "a line from the episode", by, sure });

    // ---------- the data rule: research's own returns on the show ----------
    r = await start(game(QUOTE));
    check(r.status !== 200 && /hasn't been asked who says the episode's title quote on this show yet/.test(JSON.stringify(r.body)), "the show never asked: the lab refuses a title-quote game", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const cast = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [sid])).rows.map((x) => x.name);
    for (let n = 1; n <= 5; n++) await research(n, said(cast[n + 6]));
    r = await start(game(QUOTE));
    check(r.status !== 200 && /on 5 of this show's episodes, not yet the 6/.test(JSON.stringify(r.body)), "  asked on five episodes, each sure: still refused (not yet the six it takes)", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    // An earlier season of the show, with its own cast (the measure reads each answer's name against its season's cast).
    const s50 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 50, 'completed') RETURNING id", [showId])).rows[0].id;
    await pool.query("INSERT INTO season_cast (season_id, name) VALUES ($1, 'Pat Doe')", [s50]);
    await research(1, said("Pat Doe"), 50);
    r = await start(game(QUOTE));
    const Q = r.body?.leagueId;
    check(r.status === 200 && !!Q, "  six of six (one an earlier season's): reliable, and the desk's admin starts Q (who says it, from Episode 6)", `${r.status} ${errorOf(r)}`);
    r = await start(game(TRIBE));
    const QT = r.body?.leagueId;
    check(r.status === 200 && !!QT, "  and QT (which tribe it comes from)", `${r.status} ${errorOf(r)}`);
    for (const who of WHO) {
      for (const g of [Q, QT]) {
        r = await as[who].call("POST", `/api/couches/${couch}/games/${g}`, { action: "join" });
        check(r.status === 200, `  ${who} joins ${g === Q ? "Q" : "QT"}`, `${r.status} ${errorOf(r)}`);
      }
    }
    const seatsQ = await k.seatsOf(Q);
    const seatsT = await k.seatsOf(QT);

    // ---------- Episode 6 ----------
    const s0 = await stateOf(Q);
    const still = s0.castaways.filter((c) => c.status === "active");
    const [A, R, J] = [still[0], still[1], still[2]];
    const answer = (who, league, question, value, episode = 6) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${league}`, { episode, answers: { [question]: value } });
    for (const [who, c] of [["alex", A], ["riley", R], ["jordan", J]]) {
      r = await answer(who, Q, "quote", c.id);
      check(r.status === 200, `before Episode 6: ${who} picks ${c.name}`, `${r.status} ${errorOf(r)}`);
    }
    r = await answer("sam", Q, "quote", A.id);
    check(r.status === 403, "  sam's (seen 3) refused", `${r.status} ${errorOf(r)}`);
    const sT = await stateOf(QT);
    const tribeOf = (name) => sT.castaways.find((c) => c.name === name)?.tribeId;
    const tribeName = (id) => sT.tribes.find((t) => t.id === id)?.name;
    r = await answer("alex", QT, "tribe", tribeOf(A.name));
    check(r.status === 200, `  alex names ${tribeName(tribeOf(A.name))} in QT`, `${r.status} ${errorOf(r)}`);
    r = await answer("riley", QT, "tribe", tribeOf(J.name));
    check(r.status === 200, `  riley names ${tribeName(tribeOf(J.name))}`, `${r.status} ${errorOf(r)}`);
    await k.airs(4);
    await decide(6, "elimination", still[still.length - 1].name);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    const questions = async (who, league, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${league}${episode ? `&episode=${episode}` : ""}`)).body;
    const qOf = (body, id) => (body?.questions ?? []).find((q) => q.id === id) ?? null;
    let q = qOf(await questions("alex", Q, 6), "quote");
    check(q?.verdict?.state === "waiting", "Episode 6's result is in, but research hasn't said who said its title: waiting", JSON.stringify(q?.verdict));
    await research(6, said(J.name));
    const totals = (g, seats) => Object.fromEntries((g?.table ?? []).map((t) => [Object.keys(seats).find((w) => seats[w] === t.playerId) ?? t.name, t.total]));
    q = qOf(await questions("alex", Q, 6), "quote");
    check(q?.verdict?.state === "known" && JSON.stringify(q.verdict.right) === JSON.stringify([J.id]), `  research's answer lands (sure, ${J.name}): known`, JSON.stringify(q?.verdict));
    let tt = totals(await gameIn("alex", Q), seatsQ);
    check(tt.jordan === 1 && tt.alex === 0 && tt.riley === 0 && tt.sam === 0, "  Q's table: jordan 1, the rest 0", JSON.stringify(tt));
    const right = { alex: tribeOf(J.name) === tribeOf(A.name) ? 1 : 0, riley: 1 };
    tt = totals(await gameIn("alex", QT), seatsT);
    check(tt.alex === right.alex && tt.riley === right.riley, `  QT's table: the tribe ${J.name} was on (${tribeName(tribeOf(J.name))}) scores`, JSON.stringify({ tt, right }));
    tt = totals(await gameIn("sam", Q), seatsQ);
    check(Object.values(tt).every((n) => n === 0), "  as sam (seen 3): nothing graded", JSON.stringify(tt));
    await research(6, said(A.name));
    tt = totals(await gameIn("alex", Q), seatsQ);
    check(tt.alex === 1 && tt.jordan === 0, `  research corrected (${A.name}): read again at once, alex 1 and jordan 0`, JSON.stringify(tt));

    // ---------- Episodes 7 to 9: the fallbacks ----------
    const play = async (n, gone, facts, picks) => {
      for (const [who, c] of picks) {
        r = await answer(who, Q, "quote", c.id, n);
        check(r.status === 200, `  before Episode ${n}: ${who} picks ${c.name}`, `${r.status} ${errorOf(r)}`);
      }
      await k.airs(7);
      await decide(n, "elimination", gone);
      for (const who of ["alex", "riley", "jordan"]) await seen(who, n);
      for (const [m, f] of facts) await research(m, f);
      return qOf(await questions("alex", Q, n), "quote");
    };
    q = await play(7, still[still.length - 2].name, [[7, said("Jeff Probst")]], [["alex", A], ["riley", R]]);
    check(q?.verdict?.state === "off" && /^Jeff Probst said it, who wasn't one to pick: it doesn't count either way/.test(q.verdict.why ?? ""), "Episode 7: research is sure the host said it: void, and it says why", JSON.stringify(q?.verdict));
    q = await play(8, still[still.length - 3].name, [[8, said(R.name, "low")]], [["riley", R]]);
    check(q?.verdict?.state === "off" && /wasn't sure who says the title quote/.test(q.verdict.why ?? ""), "Episode 8: research isn't sure (it said riley's pick): void", JSON.stringify(q?.verdict));
    q = await play(9, still[still.length - 4].name, [], [["jordan", J]]);
    check(q?.verdict?.state === "waiting", "Episode 9: its result is in, research's answer isn't stored yet: waiting", JSON.stringify(q?.verdict));
    await research(10, said(J.name));
    q = qOf(await questions("alex", Q, 9), "quote");
    check(q?.verdict?.state === "waiting", "  still waiting once Episode 10's is (each episode's own answer settles it)", JSON.stringify(q?.verdict));
    await research(9, undefined);
    q = qOf(await questions("alex", Q, 9), "quote");
    check(q?.verdict?.state === "off" && /Research didn't say/.test(q.verdict.why ?? ""), "  its answer lands without the fact (a pass that left it out): void", JSON.stringify(q?.verdict));
    tt = totals(await gameIn("alex", Q), seatsQ);
    check(tt.alex === 1 && tt.riley === 0 && tt.jordan === 0, "  Q's table: alex 1, riley 0, jordan 0 (none of the void ones counted)", JSON.stringify(tt));

    // ---------- the flag ----------
    for (const [id, what] of [[Q, "Q"], [QT, "QT"]]) {
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
