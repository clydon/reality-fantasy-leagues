// Dev-only check of a card the bot chooses (docs/PLAN-start-a-game-gpt.md track C, C7 part 2: game-spec schema.js `card: { from:
// 'bot' }`, rankedLines; db/card-research.js, the card run in db/bot-research.js planCards and runJob; src/lib/server/card-choices.ts,
// the stamp with the air times; answers.ts's read and refusal), against the dev server, through the API (no screens: they're the UI
// track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three days
// off). The bot itself is never asked: the run's `ask` is a stand-in, and what it files says so (made_by 'stand-in').
//   - jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of questions through
//     RosterLogic.setGame with the show's ctx: a sheet on a card of two the bot chooses from immunity, an idol found and a reward.
//   - Before the run: Episode 6's lines wait (no moment, `waiting`), and an answer to one is refused (409, the card isn't out).
//   - The card run: planned for Episode 6 two days before it airs (bot research's planner, asked as of then), asked about the three
//     moments, the stand-in's answer (a reward, an idol found; immunity can't happen) filed live. The read's lines: a reward, then an
//     idol found. A second choice filed after it changes nothing (the first stands); the planner has nothing left for Episode 6.
//   - jordan yes, no; riley no, yes; sam yes, yes. Episode 6's results (a reward won, no idol): jordan 2, sam 1, riley 0. Episode 7:
//     nothing chosen and its card not out yet, so it waits; no fallback filed for it. The flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-card-bot.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; card_choices and the run rows go with its season); touches zt rows
// only; refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const BotResearch = require("../../db/bot-research.js");
const CardResearch = require("../../db/card-research.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-card-bot runs against a local database only");
const args = process.argv.slice(2);

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const CARD = { from: "bot", each: 2, of: ["individualImmunity", "idolFound", "rewardWin"] };
const SHEET = [{ id: "sheet", ask: "This week's sheet", answer: "yesNo", points: 1, asked: "each", card: true, settle: { by: "moment", take: "happened" } }];
const STAND_IN = '```json\n{"episode": 6, "moments": ["rewardWin", "idolFound"], "cannot": ["individualImmunity"], "why": "A reward is coming."}\n```';

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");

    // ---------- The game ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: SHEET, card: CARD }, { ctx: await questionContext(QG, sid) });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const written = (await league(QG)).state.settings;
    check(!problems.length && G.sameValue(written.gameCard, { ...CARD, fallback: "spec" }), "  made a game of questions on a card the bot chooses (gameCard, its fallback the list in turn)", JSON.stringify([problems, written.gameCard]));

    // ---------- Before the run ----------
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const lines = (x) => x.questions?.filter((y) => y.card).map((y) => [y.id, y.card.moment, !!y.card.waiting]);
    let g = await read("jordan");
    check(g.episode === 6 && G.sameValue(lines(g), [["sheet.1", null, true], ["sheet.2", null, true]]), "Episode 6's two lines wait: the bot hasn't chosen, and the card isn't out", JSON.stringify([g.episode, lines(g)]));
    r = await ask("jordan", { answers: { "sheet.1": "yes" } });
    check(r.status === 409 && /isn't out yet/.test(r.body?.error || ""), "  an answer to one refused (409): the card isn't out yet", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- The card run ----------
    const season = await BotResearch.loadSeasonForJob(pool, sid);
    const air6 = BotResearch.episodeAirTimes(season).find((e) => e.episode === 6).at;
    const then = new Date(air6.getTime() - 36 * 3600 * 1000);
    const plan = await BotResearch.planCards(pool, then, sid);
    const job = plan.due.find((j) => j.episode === 6 && j.kind === "card");
    check(!!job && job.at.getTime() === air6.getTime() - CardResearch.CARD_BEFORE * 60 * 1000, "the planner has Episode 6's card run, due two days before it airs", JSON.stringify(plan.due.map((j) => [j.episode, j.kind, j.at])));
    let prompt = null;
    const out = await BotResearch.runJob(pool, { ...job, madeBy: "stand-in" }, { ask: async (p) => ((prompt = p), { answer: STAND_IN }) });
    check(out.ok && G.sameValue(out.result.asked, CARD.of) && /- rewardWin: /.test(prompt || ""), "  it asks about the card's three moments and files the stand-in's answer live", JSON.stringify([out.ok, out.message, out.result && out.result.asked]));
    const { rows: filed } = await pool.query("SELECT moments, cannot, status, made_by FROM card_choices WHERE season_id = $1", [sid]);
    check(filed.length === 1 && filed[0].status === "live" && filed[0].made_by === "stand-in" && G.sameValue(filed[0].cannot, ["individualImmunity"]), "  one choice in card_choices, live, a stand-in's", JSON.stringify(filed));
    const { rows: runs } = await pool.query("SELECT kind, slot, ok FROM bot_research_runs WHERE season_id = $1 AND kind = 'card'", [sid]);
    check(runs.length === 1 && runs[0].slot === "card" && runs[0].ok === true, "  its run row: kind card, slot card, ok", JSON.stringify(runs));
    g = await read("jordan");
    check(G.sameValue(lines(g), [["sheet.1", "rewardWin", false], ["sheet.2", "idolFound", false]]), "the read's lines: a reward, then an idol found (the bot's order)", JSON.stringify(lines(g)));
    await CardResearch.storeChoice(pool, sid, 6, CARD.of, { status: "live", moments: ["individualImmunity", "idolFound"], cannot: [] }, { madeBy: "stand-in" });
    g = await read("jordan");
    check(G.sameValue(lines(g), [["sheet.1", "rewardWin", false], ["sheet.2", "idolFound", false]]), "  a second choice filed after it changes nothing: the first stands", JSON.stringify(lines(g)));
    const again = await BotResearch.planCards(pool, then, sid);
    check(!again.due.some((j) => j.episode === 6), "  the planner has nothing left for Episode 6", JSON.stringify(again.due.map((j) => j.episode)));

    // ---------- Answers and Episode 6's results ----------
    for (const [who, a, b] of [["jordan", "yes", "no"], ["riley", "no", "yes"], ["sam", "yes", "yes"]]) {
      r = await ask(who, { answers: { "sheet.1": a, "sheet.2": b } });
      check(r.status === 200, `${who} answers ${a} to a reward, ${b} to an idol`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    // The results move the season's clock four days on (Episode 6 aired yesterday): its card was decided, so it stands as it was.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    const still = (await league(QG)).state.castaways.filter((c) => c.status !== "eliminated");
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false), ($1, 6, 'event', $3, '', 'rewardWin', 'accepted', true, now(), false)`,
      [sid, still[0].name, still[1].name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 6);
    g = await read("jordan", 6);
    check(G.sameValue(lines(g), [["sheet.1", "rewardWin", false], ["sheet.2", "idolFound", false]]) && g.points === 2, "jordan at 6: a reward (yes, right) and no idol (no, right): 2", JSON.stringify([lines(g), g.points]));
    const table = ((await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === QG)?.table ?? [];
    check(G.sameValue(table.map((t) => t.total), [2, 1, 0]) && table[0].userId === fx.users.jordan, "the Games tab ranks them: jordan 2, sam 1, riley 0", JSON.stringify(table.map((t) => [t.name, t.total])));
    const stamped = (await league(QG)).state.episodes.find((e) => e.number === 6).cardChoice;
    check(G.sameValue(stamped, { moments: ["rewardWin", "idolFound"], cannot: ["individualImmunity"] }), "  the league's Episode 6 carries the choice that stood when its card came out", JSON.stringify(stamped));
    g = await read("riley");
    check(g.episode === 7 && G.sameValue(lines(g), [["sheet.1", null, true], ["sheet.2", null, true]]), "riley's Episode 7: nothing chosen, its card not out yet, so its lines wait", JSON.stringify([g.episode, lines(g)]));
    const { rows: decided } = await pool.query("SELECT episode, status, made_by FROM card_choices WHERE season_id = $1 AND status <> 'dropped' ORDER BY created_at", [sid]);
    check(G.sameValue(decided.map((d) => [d.episode, d.status]), [[6, "live"], [6, "live"]]), "  no fallback filed: Episode 6 was decided, Episode 7's card isn't out", JSON.stringify(decided));

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
