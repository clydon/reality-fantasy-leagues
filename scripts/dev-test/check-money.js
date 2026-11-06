// Dev-only check of money (docs/PLAN-start-a-game-gpt.md track C, C6: game-spec schema.js score.bank and ask[].odds, answers.js
// stakeLines and wagerParts, the sequence's stakes, state-logic.js AnswerLogic.grade, src/lib/server/answers.ts), against the dev
// server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor
// 51: results through Episode 5, Episode 6 three days off).
//   - The user's first game with a fixed sheet: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a
//     game of questions through RosterLogic.setGame with the show's ctx: a bank of 100 everyone starts with, who goes home (any of
//     your bank, at the pool's odds, no points of its own), who wins immunity (up to 20 of your bank, even money, 1 point) and p24's
//     who goes home (up to 5, a 10-point pot split between everyone right).
//   - Before Episode 6: the read says each one's odds and the most you can stake (100, 20, 5); 101 refused; jordan stakes 90 on the
//     boot, and then 10 is all he has left for immunity (20 refused); then 85, 10 and 5 in one go, the whole bank; riley stakes hers;
//     sam stakes 95 on the boot, then takes it back and stakes 20 on immunity in one go (what it held is free again), then settles
//     on 15 on the boot.
//   - Episode 6's results: the boot's pool, riley's 40 wrong split between jordan's 85 and sam's 15 right (34 and 6); jordan's
//     immunity stake of 10 won with its point; the pot: jordan's 5 and sam's 5 shares of 10, jordan's stake of 5 won, riley's 2 lost.
//     jordan 100 + 34 + 11 + 10 = 155, sam 100 + 6 + 5 = 111, riley 100 - 40 - 2 = 58. The Games tab ranks them; riley's next stakes
//     are held to her 58; the flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-money.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-money runs against a local database only");
const args = process.argv.slice(2);

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const OUT = { by: "results", take: "out" };
const SHEET = [
  { id: "boot", ask: "Who goes home? Stake any of your bank, the pool's odds", answer: "person", points: 0, asked: "each", wager: "total", odds: "pool", settle: OUT },
  { id: "imm", ask: "Who wins immunity? Stake up to 20", answer: "person", points: 1, asked: "each", wager: 20, settle: { by: "moment", moment: "individualImmunity", take: "who" } },
  { id: "pot", ask: "Who goes home? Stake up to 5, the pot split", answer: "person", points: 10, asked: "each", wager: 5, share: "split", settle: OUT },
];
const BANK = { start: 100 };

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
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers", bank: BANK }, ask: SHEET }, { ctx: await questionContext(QG, sid) });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const written = (await league(QG)).state.settings;
    check(!problems.length && written.leagueTypeId === "questions" && G.sameValue(written.questionsBank, BANK) && written.questions[0].odds === "pool", "  made the user's first game with a fixed sheet: a bank of 100 in its fields, the pool's odds with its questions", JSON.stringify(problems));

    // ---------- Before Episode 6 ----------
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    const ways = (g) => Object.fromEntries(SHEET.map(({ id }) => [id, [byId(g, id)?.odds, byId(g, id)?.stakeMost]]));
    let g = await read("jordan");
    check(g.episode === 6 && G.sameValue(ways(g), { boot: ["pool", 100], imm: ["even", 20], pot: ["even", 5] }) && g.points === 100, "jordan reads Episode 6's: the pool's odds on the boot, even money on the rest; up to 100, 20 and 5 of his bank of 100", JSON.stringify([g.episode, g.points, ways(g)]));
    const still = (await league(QG)).state.castaways.filter((c) => c.status !== "eliminated");
    const [gone6, immune, other] = still;
    r = await ask("jordan", { answers: { boot: { answer: gone6.id, stake: 101 } } });
    check(r.status === 400 && /Stake 0 to 100 points/.test(JSON.stringify(r.body)), "  101 on the boot refused: more than his bank (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { boot: { answer: gone6.id, stake: 90 } } });
    check(r.status === 200, "  jordan stakes 90 on the boot", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    g = await read("jordan");
    check(G.sameValue(ways(g), { boot: ["pool", 100], imm: ["even", 10], pot: ["even", 5] }), "  with 90 on the line, 10 is all he has left for immunity (the boot's own is his to change: 100)", JSON.stringify(ways(g)));
    r = await ask("jordan", { answers: { imm: { answer: immune.id, stake: 20 } } });
    check(r.status === 400 && /Stake 0 to 10 points/.test(JSON.stringify(r.body)), "  20 on immunity refused: a fixed stake is held to what's left of the bank (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { boot: { answer: gone6.id, stake: 85 }, imm: { answer: immune.id, stake: 10 }, pot: { answer: gone6.id, stake: 5 } } });
    check(r.status === 200, "  85 on the boot, 10 on immunity and 5 on the pot in one go: the whole 100", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("riley", { answers: { boot: { answer: other.id, stake: 40 }, pot: { answer: other.id, stake: 2 } } });
    check(r.status === 200, "riley stakes 40 on the boot and 2 on the pot, both the other way", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("sam", { answers: { boot: { answer: gone6.id, stake: 95 } } });
    check(r.status === 200, "sam stakes 95 on the boot", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("sam", { answers: { imm: { answer: immune.id, stake: 20 }, boot: null } });
    check(r.status === 200, "  then takes it back and stakes 20 on immunity in one go: what the boot held is free again", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("sam", { answers: { imm: null, boot: { answer: gone6.id, stake: 15 }, pot: { answer: gone6.id, stake: 0 } } });
    check(r.status === 200, "  and settles on 15 on the boot, nothing on the pot, immunity taken back", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);

    // ---------- Episode 6's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false), ($1, 6, 'event', $3, '', 'individualImmunity', 'accepted', true, now(), false)`,
      [sid, gone6.name, immune.name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 6);
    // The boot's pool: riley's 40 split between jordan's 85 and sam's 15 (of 100): 34 and 6. Immunity: jordan's stake of 10 and its
    // point. The pot: jordan and sam right, 5 each, jordan's stake of 5 won, riley's 2 lost.
    // jordan 100 + 34 + 11 + 10 = 155, sam 100 + 6 + 5 = 111, riley 100 - 40 - 2 = 58.
    g = await read("jordan", 6);
    const me = (x) => x?.people.find((p) => p.you);
    const earned = (x, who) => Object.fromEntries(SHEET.map(({ id }) => [id, (who ? byId(x, id)?.people.find((p) => p.name === who) : me(byId(x, id)))?.earned ?? null]));
    check(G.sameValue(earned(g), { boot: 34, imm: 11, pot: 10 }) && g.points === 155, "jordan at 6: the pool's 34, immunity's 11 (10 staked and a point), the pot's 10 (5 and his 5): 155", JSON.stringify([earned(g), g.points]));
    const theirs = (id, name) => byId(g, id).people.find((p) => !p.you && p.name.includes(name))?.earned;
    check(theirs("boot", "sam") === 6 && theirs("boot", "riley") === -40 && theirs("pot", "riley") === -2 && theirs("pot", "sam") === 5, "  sam's share of the pool (6) and of the pot (5); riley's stakes lost (-40, -2)", JSON.stringify(byId(g, "boot").people.map((p) => [p.name, p.earned])));
    g = await read("riley", 6);
    check(g.points === 58, "riley at 6: 58 of her bank", String(g.points));
    const table = ((await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === QG)?.table ?? [];
    check(G.sameValue(table.map((t) => t.total), [155, 111, 58]) && table[0].userId === fx.users.jordan, "the Games tab ranks them by what's in the bank: jordan 155, sam 111, riley 58", JSON.stringify(table.map((t) => [t.name, t.total])));
    g = await read("riley");
    check(g.episode === 7 && byId(g, "boot").stakeMost === 58 && byId(g, "imm").stakeMost === 20, "riley's Episode 7: up to 58 on the boot, 20 on immunity", JSON.stringify([g.episode, byId(g, "boot")?.stakeMost, byId(g, "imm")?.stakeMost]));

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
