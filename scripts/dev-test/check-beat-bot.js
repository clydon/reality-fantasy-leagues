// Dev-only check of the bot's call as an opponent (docs/PLAN-start-a-game-gpt.md step A14 part 2) against the dev server, through the
// API (no screens: they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5,
// Episode 6 three days off). The bot is never asked here: a stand-in call is filed in its place (db/bot-calls.js fileCalls, made_by
// 'stand-in'), as the bot's run will file its own (step A14 part 2b). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts a game of questions from the engine lab: who goes home, against
//     the bot (2 points, a week the bot didn't call playing as usual), and the same against the bot where a week it didn't call
//     doesn't count ("void"). alex, riley, jordan and sam join.
//   - Before Episode 6's lock: the stand-in calls the first question (C6: wrong, C5 goes home), not the second; a call naming someone
//     already out, one on a question not played against the bot and one on an episode the game doesn't ask then are refused. alex
//     and riley answer C5, jordan C6 (the bot's), on both. Before the lock everyone sees only that the bot has called (or not),
//     nothing of what, and the game's state (every route returns it whole) carries no call.
//   - Episode 6 airs: closed, the bot's call shown with everyone's, a call now refused. Its result (C5 out): alex and riley beat the
//     bot (2 each), jordan didn't; the void question didn't count (the bot made no call), neither right nor wrong. The table: 2, 2, 0;
//     its bot line: one call, none right, alex and riley one beat each.
//   - Episode 7: the stand-in calls both (C7, who goes home); alex says C7 on both, riley C8. Its result: alex was right but so was the
//     bot (nothing), the void question now plays as any (nothing either: the bot got it). The table unchanged; the line: three calls,
//     two right, alex beaten twice.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-beat-bot.js [--keep]
//
// One fixed scenario on purpose (its episodes, calls and answers are the story above), run again whenever the bot's call or what reads
// it changes. Brings new-fixture.js up and takes it down (--keep leaves it); the bot's calls go with the zt league (ON DELETE CASCADE).
// Touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once.
// Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const BotCalls = require("../../db/bot-calls.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-beat-bot runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf, same } = K;

const QUESTIONS = {
  get: { by: "none" },
  score: { by: "answers" },
  rank: { by: "total" },
  ask: [
    { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } },
    { id: "strict", ask: "Who goes home? (only when the bot calls it)", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot", none: "void" } },
  ],
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin, on the couch (check-stages.js's).
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, seen, stateOf, gameIn } = k;
    let r;

    // ---------- the game from the engine lab; the couch joins ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(QUESTIONS) });
    const Q = r.body?.leagueId;
    check(r.status === 200 && !!Q, "the desk's admin starts a game of questions played against the bot, from the engine lab", `${r.status} ${errorOf(r)}`);
    const q0 = await stateOf(Q);
    check(same(S.gameOf(q0).ask.map((x) => x.beat), [{ by: "bot", none: "plays" }, { by: "bot", none: "void" }]), "  as its spec says (a week the bot didn't call plays as usual by default)", JSON.stringify(S.gameOf(q0).ask.map((x) => x.beat)));
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${Q}`, { action: "join" });
      check(r.status === 200, `  ${who} joins`, `${r.status} ${errorOf(r)}`);
    }
    const seats = await k.seatsOf(Q);
    const cast = [...q0.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const id = (i) => cast[i].id;
    const gone = q0.castaways.find((c) => c.status === "eliminated");

    // ---------- before Episode 6's lock: the stand-in's call, and the answers ----------
    const file = (calls) => BotCalls.fileCalls(pool, Q, calls, { madeBy: "stand-in" });
    let filed = await file([
      { question: "boot", episode: 6, answer: id(6), note: "A stand-in's call" },
      { question: "boot", episode: 6, answer: gone.id },
      { question: "nope", episode: 6, answer: id(6) },
    ]);
    check(same(filed.filed, [{ question: "boot", episode: 6 }]) && filed.refused.length === 2 && /Name someone still in/.test(filed.refused[0].why) && /against the bot/.test(filed.refused[1].why),
      "the stand-in calls who goes home in Episode 6 (C6); a call naming someone already out and one on a question not against the bot are refused", JSON.stringify(filed));
    filed = await file([{ question: "boot", episode: 3, answer: id(6) }, { question: "boot", episode: 12, answer: id(6) }]);
    check(same(filed.filed, [{ question: "boot", episode: 12 }]) && /doesn't ask it then/.test(filed.refused[0]?.why ?? ""), "  one on an episode before the game's start (3) is refused; a later window still open (12) can be called early", JSON.stringify(filed));
    await pool.query("DELETE FROM bot_calls WHERE league_id = $1 AND episode = 12", [Q]);
    const questions = async (who, n = 6) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${Q}&episode=${n}`)).body;
    const qOf = (body, qid) => (body?.questions ?? []).find((x) => x.id === qid) ?? null;
    const answer = (who, n, answers) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${Q}`, { episode: n, answers });
    r = await answer("alex", 6, { boot: id(5), strict: id(5) });
    check(r.status === 200, "alex answers C5 on both", `${r.status} ${errorOf(r)}`);
    r = await answer("riley", 6, { boot: id(5), strict: id(5) });
    check(r.status === 200, "  riley the same", `${r.status} ${errorOf(r)}`);
    r = await answer("jordan", 6, { boot: id(6), strict: id(6) });
    check(r.status === 200, "  jordan C6 (the bot's call)", `${r.status} ${errorOf(r)}`);
    let body = await questions("riley");
    let boot = qOf(body, "boot");
    let strict = qOf(body, "strict");
    check(boot?.status === "open" && same(boot.bot, { called: true, answer: null, right: null }) && same(strict?.bot, { called: false, answer: null, right: null }) && boot.people.length === 0,
      "  before the lock riley sees only that the bot has called the first (nothing of what) and not the second", JSON.stringify({ boot: boot && { status: boot.status, bot: boot.bot, people: boot.people.length }, strict: strict?.bot }));
    const st = await as.riley.call("GET", `/api/leagues/${Q}/state`);
    check(st.status === 200 && !JSON.stringify(st.body).includes("stand-in") && !JSON.stringify(st.body).includes("bot_calls"),
      "  the game's state (which every route returns whole) carries no call: it's kept apart (bot_calls)", `${st.status}`);

    // ---------- Episode 6 airs, then its result ----------
    await k.airs(4);
    filed = await file([{ question: "strict", episode: 6, answer: id(5) }]);
    check(filed.filed.length === 0 && /locked/.test(filed.refused[0]?.why ?? ""), "Episode 6 airs: a call now is refused (the bot calls before the lock)", JSON.stringify(filed));
    body = await questions("alex");
    boot = qOf(body, "boot");
    check(boot?.status === "closed" && boot.people.length === 3 && same(boot.bot, { called: true, answer: id(6), right: null }) && boot.verdict?.state === "waiting",
      "  closed: the bot's call shown with everyone's answers, still waiting for the result", JSON.stringify(boot && { status: boot.status, bot: boot.bot, people: boot.people.length, verdict: boot.verdict }));
    await decide(6, "elimination", N(5));
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    body = await questions("alex");
    boot = qOf(body, "boot");
    strict = qOf(body, "strict");
    const person = (q, who) => q?.people.find((p) => p.playerId === seats[who]);
    check(boot?.verdict?.state === "known" && same(boot.bot, { called: true, answer: id(6), right: false }) && person(boot, "alex")?.earned === 2 && person(boot, "riley")?.earned === 2 && person(boot, "jordan")?.right === false && person(boot, "jordan")?.earned === 0,
      "Episode 6's result (C5): the bot was wrong; alex and riley beat it, 2 each; jordan didn't", JSON.stringify(boot && { bot: boot.bot, people: boot.people.map((p) => [p.name, p.right, p.earned]) }));
    check(strict?.verdict?.state === "off" && /The bot made no call/.test(strict.verdict.why) && strict.people.every((p) => p.right === null && p.earned === 0),
      "  the void question didn't count either way (the bot made no call): neither right nor wrong", JSON.stringify(strict && { verdict: strict.verdict, people: strict.people.map((p) => [p.name, p.right, p.earned]) }));
    let view = await gameIn("alex", Q);
    const total = (who) => view?.table?.find((x) => x.playerId === seats[who])?.total ?? 0;
    check(total("alex") === 2 && total("riley") === 2 && total("jordan") === 0 && total("sam") === 0 && !view.table.some((x) => /bot/i.test(x.name)),
      "  the table: alex 2, riley 2, jordan and sam nothing; the bot is no seat on it", JSON.stringify(view?.table?.map((x) => [x.name, x.total])));
    check(same(view?.bot, { called: 1, right: 0, vs: { [seats.alex]: { beat: 1, beaten: 0 }, [seats.riley]: { beat: 1, beaten: 0 }, [seats.jordan]: { beat: 0, beaten: 0 } } }),
      "  its line beside the table: one call, none right; alex and riley beat it once", JSON.stringify(view?.bot));
    const sam = await gameIn("sam", Q);
    check(same(sam?.bot, { called: 0, right: 0, vs: {} }), "  sam (seen 3) sees no call settled yet", JSON.stringify(sam?.bot));

    // ---------- Episode 7: the bot gets it ----------
    filed = await file([{ question: "boot", episode: 7, answer: id(7) }, { question: "strict", episode: 7, answer: id(7) }]);
    check(filed.filed.length === 2, "Episode 7: the stand-in calls C7 on both", JSON.stringify(filed));
    r = await answer("alex", 7, { boot: id(7), strict: id(7) });
    check(r.status === 200, "  alex says C7 on both", `${r.status} ${errorOf(r)}`);
    r = await answer("riley", 7, { boot: id(8), strict: id(8) });
    check(r.status === 200, "  riley C8", `${r.status} ${errorOf(r)}`);
    await k.airs(7);
    await decide(7, "elimination", N(7));
    for (const who of ["alex", "riley"]) await seen(who, 7);
    body = await questions("alex", 7);
    boot = qOf(body, "boot");
    strict = qOf(body, "strict");
    check(same(boot?.bot, { called: true, answer: id(7), right: true }) && person(boot, "alex")?.right === true && person(boot, "alex")?.earned === 0 && strict?.verdict?.state === "known" && person(strict, "alex")?.earned === 0,
      "  its result (C7): alex was right, but so was the bot: nothing on either (the void question plays as any once the bot calls)", JSON.stringify({ boot: boot && { bot: boot.bot, people: boot.people.map((p) => [p.name, p.right, p.earned]) }, strict: strict?.verdict }));
    view = await gameIn("alex", Q);
    check(total("alex") === 2 && total("riley") === 2, "  the table unchanged", JSON.stringify(view?.table?.map((x) => [x.name, x.total])));
    check(view?.bot?.called === 3 && view.bot.right === 2 && same(view.bot.vs[seats.alex], { beat: 1, beaten: 2 }) && same(view.bot.vs[seats.riley], { beat: 1, beaten: 2 }),
      "  the line: three calls, two right; alex and riley each beat it once and were beaten twice", JSON.stringify(view?.bot));
    const stored = await BotCalls.storedCalls(pool, Q);
    check(stored.length === 3 && stored.every((c) => c.madeBy === "stand-in") && stored[0].note === "A stand-in's call", "  the calls kept: three, each a stand-in's", JSON.stringify(stored.map((c) => [c.question, c.episode, c.madeBy])));
  } catch (e) {
    out.fail();
    console.error(e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
  }
  console.log(out.failures() ? `${out.failures()} FAILED` : "ALL PASS");
  process.exit(out.failures() ? 1 : 0);
})();
