// Dev-only check of scoring that combines (docs/PLAN-start-a-game-gpt.md step A9, part 1: game-spec schema.js and answers.js
// windowPoints, state-logic.js AnswerLogic.grade and started, src/lib/server/answers.ts, bingo.ts leagueBingo, migration 0201),
// against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan,
// sam on ZT Survivor 51: results through Episode 5, Episode 6 three days off; everyone has seen 5 but sam, 3).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of eight
//     through RosterLogic.setGame with the show's ctx: a pot of 10 split between everyone who calls the boot, who goes home and
//     who wins immunity (a parlay: both right, double), who finds an idol (only the only one right scores), who goes home with a
//     jackpot that rolls over, who goes home and who wins immunity with any of your points staked, and who wins twice (every
//     change once it's on costs a point, a first call then counting as one; a point less for each episode started when it's
//     made): nine.
//   - Before Episode 6: the read says each one's way (the split, the rollover and its jackpot, what a shrinking call is worth, the
//     most you can stake: none yet); jordan and riley answer; a stake past your points refused.
//   - Episode 6 airs: jordan changes his winner (late 1, one change, worth 9; the same answer again isn't a change; taking it
//     back refused), riley makes her early call (worth 9) and her first sealed winner (a change already: worth 9).
//   - Episode 6's results: jordan 10 (half the pot, the parlay doubled, his stake of 0 right), riley 6; the jackpot rolls to 2
//     for Episode 7; jordan's most stake 10 (11 refused); with 4 staked on the boot, 6 left for immunity (7 refused).
//   - Episode 7's: jordan's jackpot 4 and his stake of 4 won (19), riley's pot alone (10) and her stake of 6 lost; riley at 6 sees
//     her 6. The Games tab ranks them.
//   - Points per bingo line: jordan's second game made a Weekly Bingo at 5 a line from Episode 6; a card for Episode 6 (from
//     before the banks: moments) with one line settled by the results: 5 on the Games tab (a line worth 5); the couch hub
//     reads it too. The flag's check on both.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions-scoring.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-questions-scoring runs against a local database only");
const args = process.argv.slice(2);
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const OUT = { by: "results", take: "out" };
const QUESTIONS = [
  { id: "pot", ask: "Who goes home? 10 points, split between everyone who calls it", answer: "person", points: 10, asked: "each", share: "split", settle: OUT },
  { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: OUT },
  { id: "imm", ask: "Who wins immunity?", answer: "person", points: 1, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } },
  { id: "only", ask: "Who finds an idol? Only if you're the only one", answer: "person", points: 3, asked: "each", share: "only", settle: { by: "moment", moment: "idolFound", take: "who" } },
  { id: "roll", ask: "Who goes home? Nobody right, it rolls over", answer: "person", points: 2, asked: "each", rollover: true, settle: OUT },
  { id: "allin", ask: "Who goes home? Bet any of your points", answer: "person", points: 1, asked: "each", wager: "total", settle: OUT },
  { id: "bet2", ask: "Who wins immunity? Bet any of your points", answer: "person", points: 1, asked: "each", wager: "total", settle: { by: "moment", moment: "individualImmunity", take: "who" } },
  { id: "seal", ask: "Who wins? Every change costs a point", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "change" }, settle: { by: "results", take: "winner" } },
  { id: "early", ask: "Who wins? The earlier the better", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } },
];
const PARLAYS = [{ of: ["boot", "imm"], times: 2 }];

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
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");

    // ---------- A game of them ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const ctx = await questionContext(QG, sid);
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers", parlays: PARLAYS }, ask: QUESTIONS }, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const written = (await league(QG)).state.settings;
    check(!problems.length && written.leagueTypeId === "questions" && G.sameValue(written.parlays, PARLAYS), "  the nine are written: a game of questions, its parlay in its fields (the show's ctx)", JSON.stringify(problems));

    // ---------- Before Episode 6 ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    let g = await read("jordan");
    const ways = Object.fromEntries(["pot", "only", "roll", "seal", "early", "allin"].map((id) => [id, (({ share, rollover, jackpot, shrink, worth, wager, stakeMost }) => ({ share, rollover, jackpot, shrink, worth, wager, stakeMost }))(byId(g, id) ?? {})]));
    check(
      g.episode === 6 && ways.pot.share === "split" && ways.only.share === "only" && ways.roll.rollover === true && ways.roll.jackpot === 0 && ways.seal.worth === 10 && ways.early.worth === 10 && G.sameValue(ways.seal.shrink, { points: 1, per: "change" }) && ways.allin.wager === "total" && ways.allin.stakeMost === 0,
      "jordan reads Episode 6's: the pot split, only the only one, the rollover (no jackpot yet), the winner calls worth 10, any of his points (none yet)",
      JSON.stringify(ways)
    );
    const still = (await league(QG)).state.castaways.filter((c) => c.status !== "eliminated");
    const [gone6, gone7, immune, finder, other, winner, later] = still;
    r = await ask("jordan", { answers: { allin: { answer: gone6.id, stake: 1 } } });
    check(r.status === 400 && /no points to stake/.test(r.body.error ?? JSON.stringify(r.body)), "  a stake with no points yet refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { pot: gone6.id, boot: gone6.id, imm: immune.id, only: finder.id, roll: other.id, allin: { answer: gone6.id, stake: 0 }, seal: winner.id } });
    check(r.status === 200, "jordan answers seven", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("riley", { answers: { pot: gone6.id, boot: other.id, imm: immune.id, only: finder.id, roll: later.id } });
    check(r.status === 200, "riley answers five", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const row = async (who, question) => (await pool.query("SELECT answer, late, changes FROM game_answers WHERE league_id = $1 AND question = $2 AND player_id = (SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $3)", [QG, question, fx.users[who]])).rows[0];
    check(G.sameValue(await row("jordan", "seal"), { answer: winner.id, late: 0, changes: 0 }), "  jordan's winner, sealed before the game: late 0, no changes", JSON.stringify(await row("jordan", "seal")));

    // ---------- Episode 6 airs ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await ask("jordan", { answers: { seal: later.id } });
    check(r.status === 200 && G.sameValue(await row("jordan", "seal"), { answer: later.id, late: 1, changes: 1 }), "Episode 6 on: jordan changes his winner (late 1, one change)", `${r.status} ${JSON.stringify(await row("jordan", "seal"))}`);
    r = await ask("jordan", { answers: { seal: later.id } });
    check(r.status === 200 && (await row("jordan", "seal")).changes === 1, "  the same answer again isn't a change", JSON.stringify(await row("jordan", "seal")));
    r = await ask("jordan", { answers: { seal: null } });
    check(r.status === 409, "  taking it back once the game's on is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);
    let rg0 = await read("riley");
    check(byId(rg0, "seal").worth === 9 && byId(rg0, "early").worth === 9, "riley, with no winner yet: one made now is worth 9 either way", JSON.stringify([byId(rg0, "seal").worth, byId(rg0, "early").worth]));
    r = await ask("riley", { answers: { early: winner.id, seal: winner.id } });
    check(r.status === 200 && (await row("riley", "early")).late === 1 && (await row("riley", "seal")).changes === 1, "riley makes both winner calls now: late 1; her first seal counts as a change", `${r.status} ${JSON.stringify([await row("riley", "early"), await row("riley", "seal")])}`);
    g = await read("jordan");
    rg0 = await read("riley");
    check(byId(g, "seal").worth === 9 && byId(rg0, "early").worth === 9 && byId(rg0, "seal").worth === 9, "  jordan's winner is worth 9 (a change), riley's 9 and 9 (an episode in; sealed late)", JSON.stringify([byId(g, "seal").worth, byId(rg0, "early").worth, byId(rg0, "seal").worth]));

    // ---------- Episode 6's results ----------
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
    await syncSeasonLeagues(sid, null);
    await seen("jordan", 6);
    await seen("riley", 6);
    g = await read("jordan", 6);
    const me = (x) => x?.people.find((p) => p.you);
    const earned6 = Object.fromEntries(["pot", "boot", "imm", "only", "roll", "allin"].map((id) => [id, me(byId(g, id))?.earned ?? null]));
    check(G.sameValue(earned6, { pot: 5, boot: 2, imm: 2, only: 0, roll: 0, allin: 1 }), "jordan at 6: half the pot (5), the parlay doubled (2 and 2), the idol finder two called (0), nobody's jackpot, his stake of 0 right (1)", JSON.stringify(earned6));
    check(g.points === 10, "  10 points", String(g.points));
    const riley6 = byId(g, "imm").people.find((p) => !p.you);
    check(riley6?.earned === 1 && byId(g, "only").people.every((p) => p.right === true && p.earned === 0), "  riley's immunity call alone (1, no parlay); both right on the idol, neither scores", JSON.stringify([riley6, byId(g, "only").people]));
    g = await read("jordan");
    check(g.episode === 7 && byId(g, "roll").jackpot === 2 && byId(g, "allin").stakeMost === 10, "Episode 7's: the jackpot rolled to 2; jordan can stake up to 10", JSON.stringify([g.episode, byId(g, "roll")?.jackpot, byId(g, "allin")?.stakeMost]));
    r = await ask("jordan", { answers: { allin: { answer: gone7.id, stake: 11 } } });
    check(r.status === 400 && /Stake 0 to 10 points/.test(JSON.stringify(r.body)), "  a stake of 11 refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { roll: gone7.id, allin: { answer: gone7.id, stake: 4 }, pot: other.id } });
    check(r.status === 200, "jordan calls 7's boot for the jackpot, stakes 4 on it", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    g = await read("jordan");
    check(byId(g, "bet2").stakeMost === 6 && byId(g, "allin").stakeMost === 10, "  with 4 on the line, 6 left to stake on immunity (the boot's own stake is his to change: 10)", JSON.stringify([byId(g, "bet2")?.stakeMost, byId(g, "allin")?.stakeMost]));
    r = await ask("jordan", { answers: { bet2: { answer: immune.id, stake: 7 } } });
    check(r.status === 400 && /Stake 0 to 6 points/.test(JSON.stringify(r.body)), "  7 on immunity refused: the same points can't be staked twice (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { bet2: { answer: immune.id, stake: 6 }, allin: { answer: gone7.id, stake: 5 } } });
    check(r.status === 400, "  nor 6 and 5 in one go (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { bet2: { answer: immune.id, stake: 6 } } });
    check(r.status === 200, "  6 on immunity", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    r = await ask("riley", { answers: { pot: gone7.id, allin: { answer: other.id, stake: 6 } } });
    check(r.status === 200, "riley calls 7's boot for the pot, stakes all 6 of hers the other way", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);

    // ---------- Episode 7's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [["elimination", gone7.name, "Voted Out", ""]]);
    await syncSeasonLeagues(sid, null);
    await seen("jordan", 7);
    g = await read("jordan", 7);
    const earned7 = Object.fromEntries(["roll", "allin", "pot"].map((id) => [id, me(byId(g, id))?.earned ?? null]));
    check(G.sameValue(earned7, { roll: 4, allin: 5, pot: 0 }), "jordan at 7: the jackpot (4), his stake won (1 and 4)", JSON.stringify(earned7));
    check(g.points === 19, "  19 points", String(g.points));
    const theirs = (id) => byId(g, id).people.find((p) => !p.you)?.earned;
    check(theirs("pot") === 10 && theirs("allin") === -6, "  riley took the pot alone (10) and lost her stake (-6)", JSON.stringify([theirs("pot"), theirs("allin")]));
    const rg = await read("riley", 6);
    check(rg.points === 6, "riley, at 6: her 6", String(rg.points));
    const tableOf = async (who, id) => ((await as[who].call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === id)?.table ?? [];
    const table = await tableOf("jordan", QG);
    check(table[0]?.userId === fx.users.jordan && table[0].total === 19 && table[1]?.total === 10, "the Games tab ranks it: jordan 19, riley 10", JSON.stringify(table.map((t) => [t.name, t.total])));

    // ---------- Points per bingo line ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const BG = r.body.leagueId;
    const bstate = (await league(BG)).state;
    const bp = S.setGame(bstate, { preset: "weekly-bingo", span: { from: 6, to: null }, score: { by: "lines", points: 5 } }, { ctx: await questionContext(BG, sid) });
    if (!bp.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(bstate), BG]);
    const bset = (await league(BG)).state.settings;
    check(r.status === 200 && !bp.length && bset.leagueTypeId === "weekly-bingo" && bset.linePoints === 5, "jordan's second game made a Weekly Bingo at 5 points a line, from Episode 6", JSON.stringify([r.status, bp, bset.leagueTypeId, bset.linePoints]));
    // A card for Episode 6 from before the banks (moments, settled by the results): immunity, the free centre, an idol found.
    const square = (key, label) => ({ key, label });
    const squares = [square("m:fireMaking", "Fire"), square("m:quit", "A quit"), square("m:medevac", "A medevac"), square("m:individualImmunity", "Immunity"), square("free", "Free"), square("m:idolFound", "An idol found"), square("m:rockDraw", "A rock draw"), square("m:shotInTheDark", "A shot in the dark"), square("m:reward", "Reward")];
    const card = (await pool.query("INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, 6, $3::jsonb) ON CONFLICT (user_id, season_id, episode) DO UPDATE SET squares = EXCLUDED.squares RETURNING id", [fx.users.jordan, sid, JSON.stringify(squares)])).rows[0].id;
    await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, 3), ($1, 4), ($1, 5) ON CONFLICT DO NOTHING", [card]);
    const bgame = ((await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === BG);
    check(bgame?.table?.find((t) => t.userId === fx.users.jordan)?.total === 5 && bgame.linePoints === 5, "  jordan's one line on Episode 6's card: 5 on the Games tab, a line worth 5", JSON.stringify([bgame?.table?.map((t) => [t.name, t.total]), bgame?.linePoints]));
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    // The hub reads its standing (at 5 a line, as its table does) for places: only the place leaves the server.
    const hubGame = (hub.games ?? []).find((x) => x.leagueId === BG);
    check(hubGame?.rank === "1" && hubGame.through >= 6, "  the couch hub reads it too: jordan first", JSON.stringify(hubGame ?? Object.keys(hub)));

    // ---------- The flag ----------
    for (const [id, what] of [[QG, "the game of questions"], [BG, "the Weekly Bingo"]]) {
      const flagged = checkLeague((await league(id)).state);
      check(flagged.ok, `the game-specs flag's check passes on ${what}`, JSON.stringify(flagged));
      if (specsOn) check(GameSpecs.carryGame(JSON.parse(JSON.stringify((await league(id)).state.settings)), true) === false, "  and its carried spec is in step");
      else console.log("NOTE  the game-specs flag is off: whether its carried spec is in step was skipped");
    }
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
