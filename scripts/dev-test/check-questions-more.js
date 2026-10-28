// Dev-only check of more answers (docs/PLAN-start-a-game-gpt.md step A8: game-spec schema.js and answers.js, state-logic.js
// AnswerLogic.facts, src/lib/server/answers.ts), against the dev server, through the API (no screens: they're the UI track's),
// on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three days off;
// everyone has seen 5 but sam, 3).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of
//     questions through RosterLogic.setGame with the show's ctx: The next three to go home, in order (every three episodes),
//     Rank who goes home, surest first (confidence), Spread 10 chips on who wins immunity, Will an idol be found tonight? (a
//     wager of up to 5), Who outlasts whom? (three pairs, drawn the same every time) and Who scores the most points tonight?
//     (each castaway's points by the game's rules).
//   - Answering Episode 6's: the read gives the order's and the chips' faces (the 13 still in), the three pairs (faces), the
//     wager's most stake; what an answer can't be (someone gone in an order, 11 chips, a stake of 6, someone not in the pair, a
//     name twice in a ranking).
//   - Episode 6 airs, then Episodes 6, 7 and 8's results: who goes home is each pair's first, an idol found in 6, immunity won.
//   - Graded once jordan has seen 8: the order (3), his confidence's first (3), his chips on the immunity winner (7), his wager
//     (1 and 4 staked), the three pairs (3), who scored most (2): 23, and the Games tab ranks him first; riley's wager lost (-2);
//     riley, at 5, sees nothing. The flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions-more.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-questions-more runs against a local database only");
const args = process.argv.slice(2);
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const QUESTIONS = [
  { id: "order", ask: "The next three to go home, in order", answer: "order", points: 1, pick: 3, asked: "every", every: 3, settle: { by: "results", take: "order" } },
  { id: "sure", ask: "Rank who goes home, surest first", answer: "confidence", points: 1, pick: 3, asked: "each", settle: { by: "results", take: "out" } },
  { id: "chips", ask: "Spread 10 chips on who wins immunity", answer: "chips", points: 1, chips: 10, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } },
  { id: "bet", ask: "Will an idol be found tonight?", answer: "yesNo", points: 1, asked: "each", wager: 5, settle: { by: "moment", moment: "idolFound", take: "happened" } },
  { id: "pairs", ask: "Who outlasts whom?", answer: "pairs", points: 1, pairs: 3, settle: { by: "results", take: "outlast" } },
  { id: "top", ask: "Who scores the most points tonight?", answer: "person", points: 2, asked: "each", settle: { by: "points", take: "most" } },
];

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
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);

    // ---------- A game of them ----------
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
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: QUESTIONS }, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    check(!problems.length && (await league(QG)).state.settings.leagueTypeId === "questions", "  the six are written: a game of questions (the show's ctx, a points leaderboard on research's moments)", JSON.stringify(problems));

    // ---------- Answering Episode 6's ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    let g = await read("jordan");
    const pairs = byId(g, "pairs")?.pairs ?? [];
    check(g.episode === 6 && byId(g, "order")?.faces?.length === 13 && byId(g, "order").pick === 3 && byId(g, "chips")?.chips === 10 && byId(g, "bet")?.wager === 5, "jordan reads Episode 6's: the order's faces (13 still in), its pick, the chips, the wager", JSON.stringify(g.questions?.map((x) => [x.id, x.pick, x.chips, x.wager, x.faces?.length])));
    check(pairs.length === 3 && pairs.every((p) => p.key === G.pairKey(p.faces.map((f) => f.id)) && p.faces.every((f) => f.id && f.name)), "  the three pairs, drawn from who's in at the start, each with its key and faces", JSON.stringify(pairs));
    const again = await read("riley");
    check(G.sameValue(byId(again, "pairs")?.pairs?.map((p) => p.key), pairs.map((p) => p.key)), "  the same pairs for riley", JSON.stringify(byId(again, "pairs")?.pairs));
    // Who goes home in 6, 7 and 8: each pair's first; immunity in 6 to one still in, an idol found in 6.
    const [gone6, gone7, gone8] = pairs.map((p) => p.faces[0]);
    const stays = pairs.map((p) => p.faces[1]);
    const still = (await league(QG)).state.castaways.filter((c) => c.status !== "eliminated");
    const outside = still.filter((c) => !pairs.some((p) => p.faces.some((f) => f.id === c.id)));
    const [immune, finder] = outside;
    const pairAnswer = Object.fromEntries(pairs.map((p) => [p.key, p.faces[1].id]));
    r = await ask("jordan", {
      answers: {
        order: [gone6.id, gone7.id, gone8.id],
        sure: [gone6.id, immune.id, finder.id],
        chips: { [immune.id]: 7, [finder.id]: 3 },
        bet: { answer: "yes", stake: 4 },
        pairs: pairAnswer,
        top: immune.id,
      },
    });
    check(r.status === 200, "jordan answers all six", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const gone = (await league(QG)).state.castaways.find((c) => c.status === "eliminated");
    for (const [body, why] of [
      [{ answers: { order: [gone.id, immune.id] } }, "someone gone in an order"],
      [{ answers: { sure: [immune.id, immune.id] } }, "a name twice in a ranking"],
      [{ answers: { chips: { [immune.id]: 11 } } }, "11 chips"],
      [{ answers: { bet: { answer: "no", stake: 6 } } }, "a stake of 6"],
      [{ answers: { bet: "no" } }, "a wager with no stake"],
      [{ answers: { pairs: { [pairs[0].key]: stays[1].id } } }, "someone not in the pair"],
    ]) {
      r = await ask("riley", body);
      check(r.status === 400, `  refused: ${why} (400)`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await ask("riley", { answers: { bet: { answer: "no", stake: 2 }, pairs: Object.fromEntries(pairs.map((p) => [p.key, p.faces[0].id])) } });
    check(r.status === 200, "riley wagers 2 on no, and calls every pair the other way", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);

    // ---------- Episode 6 airs; 6, 7 and 8's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 18 WHERE id = $1", [sid]);
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const decide = async (n, rows) => {
      for (const [kind, name, method, eventType] of rows) {
        await pool.query(
          `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
           VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
          [sid, n, kind, name, method, eventType]
        );
      }
    };
    await decide(6, [["elimination", gone6.name, "Voted Out", ""], ["event", immune.name, "", "individualImmunity"], ["event", finder.name, "", "idolFound"]]);
    await decide(7, [["elimination", gone7.name, "Voted Out", ""]]);
    await decide(8, [["elimination", gone8.name, "Voted Out", ""]]);
    await syncSeasonLeagues(sid, null);
    const synced = (await league(QG)).state;
    check(S.resultsStage(synced.episodes.find((e) => e.number === 6)) === "final" && [7, 8].every((n) => !!S.resultsStage(synced.episodes.find((e) => e.number === n))), "Episodes 6, 7 and 8's results reach it", JSON.stringify([6, 7, 8].map((n) => S.resultsStage(synced.episodes.find((e) => e.number === n)))));

    // ---------- Graded, as each one has seen it ----------
    await seen("jordan", 8);
    g = await read("jordan", 6);
    const me = (x) => x.people.find((p) => p.you);
    const earned = Object.fromEntries(QUESTIONS.map((x) => [x.id, me(byId(g, x.id))?.earned ?? null]));
    check(G.sameValue(earned, { order: 3, sure: 3, chips: 7, bet: 5, pairs: 3, top: 2 }), "jordan at 8: the order (3), his surest call (3), 7 chips on the immunity winner, his wager (1 and 4 staked), the three pairs, who scored most (2)", JSON.stringify(earned));
    check(g.points === 23, "  23 points", String(g.points));
    check(byId(g, "order").verdict?.state === "known" && G.sameValue(byId(g, "order").verdict.right, [gone6.id, gone7.id, gone8.id]), "  the order was who went home in 6, 7 and 8", JSON.stringify(byId(g, "order").verdict));
    const rileyBet = byId(g, "bet").people.find((p) => !p.you);
    check(rileyBet?.earned === -2 && rileyBet.right === false, "  riley's wager lost: -2", JSON.stringify(rileyBet));
    const rg = await read("riley", 6);
    check(rg.points === 0 && byId(rg, "pairs").verdict?.state === "waiting", "riley, still at 5: nothing settled", JSON.stringify({ points: rg.points, v: byId(rg, "pairs").verdict }));
    const games = (await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? [];
    const table = games.find((x) => x.leagueId === QG)?.table ?? [];
    check(table[0]?.userId === fx.users.jordan && table[0].total === 23, "the Games tab ranks it: jordan first, 23", JSON.stringify(table.map((t) => [t.name, t.total])));

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
