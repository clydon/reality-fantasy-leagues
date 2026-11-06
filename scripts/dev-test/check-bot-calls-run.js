// Dev-only check of the bot's own call run (docs/PLAN-start-a-game-gpt.md step A14 part 2b: db/call-research.js, the call run in
// db/bot-research.js planCalls and runJob, filed through db/bot-calls.js fileCalls), against the dev server, through the API (no screens:
// they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: results through Episode 5, Episode 6 three days off). The bot
// itself is never asked: the run's `ask` is a stand-in, and what it files says so (made_by 'stand-in'). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts a game of questions from the engine lab, against the bot: who goes
//     home each episode, whether an idol is played each episode, and who wins (asked once, before the game's first episode). alex and
//     riley join.
//   - Seven hours before Episode 6 airs, nothing's due yet; the planner's next is six hours before it (CALL_BEFORE). Five hours before,
//     the game's call run for Episode 6 is due (slot call:<the game>), asking about all three.
//   - The run: the prompt lists who's still in by id (nobody gone) and the three questions; the stand-in answers who goes home by name,
//     no idol, and who wins with someone already out: two filed, that one refused (listed on the run), so the try failed. Twenty-five
//     minutes on it's due again and asks about who wins alone; the stand-in's answer is filed and the try worked. A window there left
//     uncalled (its call taken out) is asked again though the lock's last try worked. Nothing left for Episode 6; the next run is Episode 7's, six hours before it.
//   - riley's read before the lock: the bot has called all three (nothing of what). Episode 6 airs: the planner has nothing for it, and
//     a run for it now asks nothing (locked).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-bot-calls-run.js [--keep]
//
// One fixed scenario on purpose, run again whenever the call run or what it files changes. Brings new-fixture.js up and takes it down
// (--keep leaves it); the calls go with the zt league (ON DELETE CASCADE), the run rows with its season. Touches zt rows only; refuses
// a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or
// how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const GameSpecs = require("../../db/game-specs.js");
const BotCalls = require("../../db/bot-calls.js");
const BotResearch = require("../../db/bot-research.js");
const CallResearch = require("../../db/call-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-bot-calls-run runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf, same } = K;
const HOUR = 3600 * 1000;

const QUESTIONS = {
  get: { by: "none" },
  score: { by: "answers" },
  rank: { by: "total" },
  ask: [
    { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } },
    { id: "idol", ask: "Will an idol be played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" }, beat: { by: "bot" } },
    { id: "winner", ask: "Who wins?", answer: "person", points: 5, asked: "once", closes: "finale", settle: { by: "results", take: "winner" }, beat: { by: "bot" } },
  ],
};
const answerOf = (calls) => "```json\n" + JSON.stringify({ episode: 6, calls }) + "\n```";

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin, on the couch (check-beat-bot.js's).
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
    let r;

    // ---------- the game; the couch joins ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(QUESTIONS) });
    const Q = r.body?.leagueId;
    check(r.status === 200 && !!Q, "the desk's admin starts a game of questions against the bot (who goes home, an idol, who wins)", `${r.status} ${errorOf(r)}`);
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${Q}`, { action: "join" });
      check(r.status === 200, `  ${who} joins`, `${r.status} ${errorOf(r)}`);
    }
    const q0 = await k.stateOf(Q);
    const still = q0.castaways.filter((c) => c.status !== "eliminated");
    const gone = q0.castaways.find((c) => c.status === "eliminated");

    // ---------- the planner ----------
    const season = await BotResearch.loadSeasonForJob(pool, sid);
    const airs = BotResearch.episodeAirTimes(season);
    const air6 = airs.find((e) => e.episode === 6).at.getTime();
    const air7 = airs.find((e) => e.episode === 7).at.getTime();
    const ours = (plan) => plan.due.filter((j) => j.kind === "call" && j.leagueId === Q);
    let plan = await BotResearch.planCalls(pool, new Date(air6 - 7 * HOUR), sid);
    check(!ours(plan).length && plan.next && plan.next.getTime() === air6 - CallResearch.CALL_BEFORE * 60 * 1000,
      "seven hours before Episode 6 airs: nothing due; the next run six hours before it", JSON.stringify([ours(plan).map((j) => j.episode), plan.next]));
    const then = new Date(air6 - 5 * HOUR);
    plan = await BotResearch.planRuns(pool, { now: then, seasonId: sid });
    const job = ours(plan).find((j) => j.episode === 6);
    check(!!job && job.slot === `call:${Q}` && job.at.getTime() === air6 - 6 * HOUR, "  five hours before: the game's call run for Episode 6 is due (bot research's planner), slot call:<the game>", JSON.stringify(plan.due.map((j) => [j.kind, j.episode, j.slot])));

    // ---------- the run: one refused, asked again ----------
    let prompt = null;
    let run = await BotResearch.runJob(pool, { ...job, madeBy: "stand-in" }, {
      ask: async (p) => ((prompt = p), { answer: answerOf({ boot: { answer: still[3].name, why: "On the outs." }, idol: { answer: "No" }, winner: { answer: gone.id } }) }),
    });
    check(/- boot: Who goes home\? About episode 6\./.test(prompt || "") && /- winner: Who wins\? About the season as a whole/.test(prompt || "") && prompt.includes(`- ${still[0].id}: ${still[0].name}`) && !prompt.includes(`- ${gone.id}:`),
      "the prompt: the three questions, who's still in by id, nobody gone", (prompt || "").slice(0, 600));
    check(run.ok === false && same(run.result.filed, [{ question: "boot", episode: 6 }, { question: "idol", episode: 6 }]) && run.result.refused.length === 1 && run.result.refused[0].question === "winner" && /still in/.test(run.result.refused[0].why) && /refused: winner/.test(run.message),
      "  two filed (who goes home by name, no idol); who wins naming someone out refused and listed: the try failed", JSON.stringify([run.ok, run.message, run.result && run.result.filed]));
    plan = await BotResearch.planCalls(pool, new Date(then.getTime() + 25 * 60 * 1000), sid);
    const retry = ours(plan).find((j) => j.episode === 6);
    check(!!retry, "  twenty-five minutes on it's due again", JSON.stringify(plan.due.map((j) => [j.kind, j.episode])));
    prompt = null;
    run = await BotResearch.runJob(pool, { ...retry, madeBy: "stand-in" }, { ask: async (p) => ((prompt = p), { answer: answerOf({ winner: { answer: still[1].id } }) }) });
    check(run.ok === true && same(run.result.asked, ["winner"]) && !/- boot:/.test(prompt || "") && same(run.result.filed, [{ question: "winner", episode: 0 }]),
      "  asked again about who wins alone, filed: the try worked", JSON.stringify([run.ok, run.message, run.result && run.result.asked]));
    const { rows: runs } = await pool.query("SELECT kind, slot, episode_number, ok FROM bot_research_runs WHERE season_id = $1 AND kind = 'call' ORDER BY started_at", [sid]);
    check(same(runs.map((x) => [x.kind, x.slot, x.episode_number, x.ok]), [["call", `call:${Q}`, 6, false], ["call", `call:${Q}`, 6, true]]), "  its run rows: kind call, its game's slot, Episode 6, failed then ok", JSON.stringify(runs));
    const stored = await BotCalls.storedCalls(pool, Q);
    check(same(stored.map((c) => [c.question, c.episode, c.answer, c.madeBy]), [["winner", 0, still[1].id, "stand-in"], ["boot", 6, still[3].id, "stand-in"], ["idol", 6, "no", "stand-in"]]) && stored.find((c) => c.question === "boot").note === "On the outs.",
      "  the calls kept: who wins, who goes home (its id, its reason), no idol", JSON.stringify(stored.map((c) => [c.question, c.episode, c.answer, c.note])));
    // A window at a lock already called that turns up uncalled (a phase's, a question added: here its call taken out) gets tries of its
    // own, though the lock's last try worked.
    await pool.query("DELETE FROM bot_calls WHERE league_id = $1 AND question = 'idol'", [Q]);
    plan = await BotResearch.planCalls(pool, new Date(then.getTime() + 28 * 60 * 1000), sid);
    const again = ours(plan).find((j) => j.episode === 6);
    run = again ? await BotResearch.runJob(pool, { ...again, madeBy: "stand-in" }, { ask: async () => ({ answer: answerOf({ idol: { answer: "no" } }) }) }) : null;
    check(!!again && run.ok && same(run.result.asked, ["idol"]), "  a window there left uncalled is asked again, though the lock's last try worked", JSON.stringify([!!again, run && run.message]));
    plan = await BotResearch.planCalls(pool, new Date(then.getTime() + 30 * 60 * 1000), sid);
    check(!ours(plan).some((j) => j.episode === 6) && plan.next && plan.next.getTime() === air7 - 6 * HOUR, "  nothing left for Episode 6; the next run is Episode 7's, six hours before it", JSON.stringify([ours(plan).map((j) => j.episode), plan.next]));

    // ---------- what players see; the lock ----------
    await k.seen("riley", 5);
    const body = (await as.riley.call("GET", `/api/seasons/${sid}/answers?league=${Q}&episode=6`)).body;
    const bots = Object.fromEntries((body?.questions ?? []).map((x) => [x.id, x.bot]));
    check(same(bots, { boot: { called: true, answer: null, right: null }, idol: { called: true, answer: null, right: null }, winner: { called: true, answer: null, right: null } }),
      "riley before the lock: the bot has called all three, nothing of what", JSON.stringify(bots));
    await k.airs(4);
    const aired = await BotResearch.loadSeasonForJob(pool, sid);
    plan = await BotResearch.planCalls(pool, new Date(), sid);
    check(!ours(plan).some((j) => j.episode <= 6), "Episode 6 airs: the planner has nothing for it", JSON.stringify(ours(plan).map((j) => j.episode)));
    await pool.query("DELETE FROM bot_calls WHERE league_id = $1 AND question = 'idol'", [Q]);
    let asked = false;
    run = await BotResearch.runJob(pool, { ...job, season: aired, madeBy: "stand-in" }, { ask: async () => ((asked = true), { answer: answerOf({ idol: { answer: "yes" } }) }) });
    check(run.ok === true && !asked && /nothing left to call/.test(run.message), "  a run for it now asks nothing: it's locked", JSON.stringify([run.ok, run.message, asked]));
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
