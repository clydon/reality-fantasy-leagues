// Dev-only check of a pool's pieces (docs/PLAN-start-a-game-gpt.md step A10 part 2: game-spec schema.js and settings.js,
// state-logic.js PickEmLogic's lives, buyback, mulligans and second pick, PickEmScoringStrategy's last one standing, the pick
// routes' `second`, phase-starts.ts for a buyback until a phase) against the dev server, through the API (no screens: they're
// the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, one going
// home each; Episode 6 three days off; everyone has seen 5 but sam, 3). Added here: the desk's own admin (zt_nd_desk, as
// check-lineup-scoring.js makes one).
//   - The couch's Survival Pool made a pool with two lives, one buyback before the merge (its cost one right pick's point), one
//     mulligan, a second pick and last one standing, through RosterLogic.setGame with the show's ctx (its fields: poolLives,
//     poolBuyback, poolMulligans, poolSecond, poolRank); the season's rulebook (the desk's season page makes it) has the merge's
//     start unknown.
//   - Episodes 1 to 5 replayed as each player picked (written into the game, as the fixture's own picks are): alex and jordan
//     right every time; riley's first wrong pick forgiven, a life lost, then her last, bought back before the merge (as far as
//     data says); sam never picks: forgiven, a life, bought back, out in 4. The engine's lives, outs and totals, and the
//     Games tab's table (last one standing) as jordan reads it.
//   - Going into 6, through the pick route: first and second picks; a second the same as the first, and sam's pick (he's
//     out), not stored; a second cleared on its own (DELETE ?second).
//   - Episode 6 airs and two go home (a double: season_decisions, through the season sync): jordan's two picks both right, two
//     points; alex's second wrong, forgiven by his mulligan (unused till then); riley's first wrong, her buyback used, out in
//     6 (her right second still scores).
//   - The desk confirms the merge at 4 (a correction of what data said): riley's buyback in 4 wasn't before it, so it's taken
//     back and she's out in 4; sam's in 3 stands. Then at 7: hers stands again.
//   - Episode 7, one goes: jordan's second pick (on the one who went) is void, no life lost.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-pool-parts.js [--keep]
//
// One fixed scenario on purpose (its picks and boots are the story above), run again whenever a pool's pieces change. Brings
// new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-pool-parts runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const DESK = "zt_nd_desk";

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const P = fx.leagues.pool;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on no couch.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId, DESK, `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(), deskId, await hashPassword(PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    as.desk = await api({ user: DESK, pass: PASSWORD });
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [P])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), P]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [P])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    check(!!rb, "the season's rulebook (the desk's season page makes it)", JSON.stringify(season.rulebook));
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
    const tableOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === P)?.table ?? [];
    const order = (table) => table.map((t) => Object.keys(fx.users).find((k) => fx.users[k] === t.userId));
    const H = (st, who) => S.pickEmHistory(st, pid[who]);

    // ---------- The pool's pieces ----------
    let st = await league();
    if (specsOn && GameSpecs.carryGame(st.settings, true)) await write(st);
    st = await league();
    check(S.getLeagueType(st).id === "pickem" && S.PickEmLogic.parts(st) === null, "the couch's Survival Pool: a plain pool (no lives, nobody out)", JSON.stringify(S.PickEmLogic.parts(st)));
    const ctx = await questionContext(P, sid);
    const g0 = S.gameOf(st);
    const spec = {
      ...g0,
      get: { ...g0.get, second: { fallback: "void" } },
      score: { ...g0.score, lives: 2, mulligans: 1, buyback: { times: 1, before: { phase: "merged" }, cost: g0.score.points } },
      rank: { by: "standing" },
    };
    const problems = S.setGame(st, spec, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    const parts = S.PickEmLogic.parts(st);
    check(!problems.length && parts && parts.lives === 2 && parts.mulligans === 1 && parts.buyback?.before?.phase === "merged" && parts.second?.fallback === "void" && parts.standing && st.settings.poolLives === 2 && st.settings.poolRank === "standing" && S.readsPhases(st),
      "  made two lives, one buyback before the merge, one mulligan, a second pick and last one standing (setGame, the show's ctx)", JSON.stringify({ problems, parts }));
    check(!st.phaseStarts?.merged, "  the merge's start isn't known yet", JSON.stringify(st.phaseStarts));

    // ---------- Episodes 1 to 5, as each player picked ----------
    const cast = [...st.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const C = (i) => cast[i].id;
    const N = (i) => cast[i].name;
    check([1, 2, 3, 4, 5].every((n) => st.episodes.find((e) => e.number === n).events.map((ev) => ev.castawayId).join() === C(n - 1)), "the fixture's results: one home each episode, the first five in the boot order");
    const played = {
      alex: [10, 11, 12, 13, 14],
      jordan: [15, 16, 10, 11, 12],
      // Wrong (forgiven), wrong (a life), right, wrong (her last: bought back), right.
      riley: [0, 1, 10, 3, 11],
      sam: [null, null, null, null, null],
    };
    st.episodes.forEach((e) => { if (e.number <= 5) e.picks = []; });
    for (const [who, list] of Object.entries(played)) {
      list.forEach((i, k) => { if (i !== null) st.episodes.find((e) => e.number === k + 1).picks.push({ playerId: pid[who], castawayId: C(i) }); });
    }
    await write(st);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const h5 = Object.fromEntries(Object.keys(played).map((who) => [who, H(st, who)]));
    check(h5.alex.total === 5 && h5.alex.lives === 2 && h5.jordan.total === 5 && h5.jordan.lives === 2, "alex and jordan: five right, both lives", JSON.stringify([h5.alex, h5.jordan].map((h) => [h.total, h.lives, h.out])));
    check(h5.riley.rows[0].forgiven && h5.riley.rows[1].lifeLost && h5.riley.rows[3].boughtBack === 1 && h5.riley.lives === 1 && h5.riley.out === null && h5.riley.total === 1 && h5.riley.buybacks === 0,
      "riley: her first wrong pick forgiven, a life in 2, her last in 4, bought back (the merge not known to have started) for a point: 1 point, one life", JSON.stringify(h5.riley));
    check(h5.sam.rows[0].forgiven && h5.sam.rows[2].boughtBack === 1 && h5.sam.out === 4 && h5.sam.total === -1, "sam never picks: forgiven in 1, a life in 2, bought back in 3, out in 4", JSON.stringify(h5.sam));
    await seen("jordan", 5);
    let table = await tableOf("jordan");
    check(order(table).join() === "alex,jordan,riley,sam" || order(table).join() === "jordan,alex,riley,sam", "the Games tab's table, last one standing: alex and jordan (tied), riley, then sam (out)", JSON.stringify(table.map((t) => [order([t])[0], t.rank, t.points])));
    check(table[0].rank === "T1" && table[1].rank === "T1", "  alex and jordan share first", JSON.stringify(table.map((t) => t.rank)));

    // ---------- Going into 6: picks through the route ----------
    const e6 = st.episodes.find((e) => e.number === 6);
    const put = (who, playerId, castawayId, second) => as[who].call("PUT", `/api/leagues/${P}/episodes/${e6.id}/picks?quiet`, { playerId, castawayId, ...(second ? { second: true } : {}) });
    const pickOf = async (who) => S.pickEmPickFor(await league(), e6.id, pid[who]);
    let r = await put("jordan", pid.jordan, C(8));
    r = await put("jordan", pid.jordan, C(9), true);
    let p = await pickOf("jordan");
    check(r.status === 200 && p?.castawayId === C(8) && p?.second === C(9), `jordan picks ${N(8)}, and ${N(9)} second`, `${r.status} ${JSON.stringify(p)}`);
    await put("alex", pid.alex, C(6));
    await put("alex", pid.alex, C(6), true);
    p = await pickOf("alex");
    check(p?.castawayId === C(6) && p?.second === undefined, `alex picks ${N(6)}; the same one second isn't stored`, JSON.stringify(p));
    await put("alex", pid.alex, C(16), true);
    const had = (await pickOf("alex"))?.second;
    r = await as.alex.call("DELETE", `/api/leagues/${P}/episodes/${e6.id}/picks/${pid.alex}?second`);
    p = await pickOf("alex");
    check(had === C(16) && r.status === 200 && p?.castawayId === C(6) && p?.second === undefined, "  a second cleared on its own (DELETE ?second) keeps the first", `${r.status} ${had} ${JSON.stringify(p)}`);
    await put("alex", pid.alex, C(10), true);
    check((await pickOf("alex"))?.second === undefined, `  his second can't be ${N(10)}: he picked them in 1, and hasn't used everyone since (the cycle)`);
    await put("alex", pid.alex, C(5), true);
    await put("riley", pid.riley, C(7));
    await put("riley", pid.riley, C(9), true);
    r = await put("sam", pid.sam, C(8));
    p = await pickOf("sam");
    check(r.status === 200 && p === null && S.pickEmEligibility(await league(), e6.id, pid.sam).out === 4, "sam is out: his pick isn't stored, nobody to pick", `${r.status} ${JSON.stringify(p)}`);
    r = await put("jordan", pid.riley, C(8));
    check(r.status === 403, "  jordan can't pick for riley (403)", String(r.status));

    // ---------- Episode 6: two go home ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, [N(5), N(7)]);
    st = await league();
    check(S.PickEmLogic.double(st, st.episodes.find((e) => e.number === 6)), `Episode 6's results: ${N(5)} and ${N(7)} home, a double`);
    let h = H(st, "jordan");
    let row = h.rows.find((x) => x.episode === 6);
    check(row.correct && row.second?.correct && h.total === 7 && h.lives === 2 && h.currentStreak === 7, "jordan's two picks both right: two points (7), the streak up two", JSON.stringify([row, h.total, h.currentStreak]));
    h = H(st, "alex");
    row = h.rows.find((x) => x.episode === 6);
    check(row.correct && row.second?.correct === false && row.second?.forgiven && h.total === 6 && h.lives === 2 && h.mulligans === 0 && h.currentStreak === 6,
      "alex's second went home: his mulligan, unused till now, forgives it (6 points, both lives, the streak carries on)", JSON.stringify([row, h.total, h.lives, h.mulligans]));
    h = H(st, "riley");
    row = h.rows.find((x) => x.episode === 6);
    check(row.correct === false && row.second?.correct === true && row.out && h.out === 6 && h.total === 2, "riley's first went home: her last life, her buyback used, out in 6 (her right second still scores: 2 points)", JSON.stringify([row, h.total, h.out]));
    await seen("jordan", 6);
    table = await tableOf("jordan");
    check(order(table).join() === "jordan,alex,riley,sam", "the table: jordan, alex (still in), then riley (out in 6), sam (out in 4)", JSON.stringify(table.map((t) => [order([t])[0], t.rank, t.points])));

    // ---------- The desk confirms the merge at 4, then at 7 ----------
    r = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 4 });
    st = await league();
    check(r.status === 200 && st.phaseStarts?.merged === 4, "the desk says the merge began in Episode 4: the pool records it", JSON.stringify({ status: r.status, starts: st.phaseStarts, body: r.status === 200 ? undefined : r.body }));
    h = H(st, "riley");
    check(h.out === 4 && h.total === 1 && !h.rows.some((x) => x.boughtBack), "  riley's buyback in 4 wasn't before it: taken back, she's out in 4", JSON.stringify([h.out, h.total, h.rows.map((x) => x.boughtBack)]));
    h = H(st, "sam");
    check(h.out === 4 && h.rows[2].boughtBack === 1, "  sam's in 3 stands (he's out in 4 all the same)", JSON.stringify([h.out, h.rows.map((x) => x.boughtBack)]));
    table = await tableOf("jordan");
    check(order(table).join() === "jordan,alex,riley,sam", "  the table: riley (1 point) before sam (-1), both out in 4", JSON.stringify(table.map((t) => [order([t])[0], t.points])));
    r = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 7 });
    st = await league();
    check(r.status === 200 && st.phaseStarts?.merged === 7 && H(st, "riley").out === 6, "the desk corrects it to 7: riley's buyback stands again, out in 6", JSON.stringify({ status: r.status, starts: st.phaseStarts, out: H(st, "riley").out }));

    // ---------- Episode 7: one goes ----------
    const e7 = st.episodes.find((e) => e.number === 7);
    await as.jordan.call("PUT", `/api/leagues/${P}/episodes/${e7.id}/picks?quiet`, { playerId: pid.jordan, castawayId: C(13) });
    r = await as.jordan.call("PUT", `/api/leagues/${P}/episodes/${e7.id}/picks?quiet`, { playerId: pid.jordan, castawayId: C(6), second: true });
    check(r.status === 200 && S.pickEmPickFor(await league(), e7.id, pid.jordan)?.second === C(6), `jordan picks ${N(13)}, and ${N(6)} second`, String(r.status));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [N(6)]);
    st = await league();
    h = H(st, "jordan");
    row = h.rows.find((x) => x.episode === 7);
    check(row.correct && row.second?.void === true && row.second.points === 0 && h.lives === 2 && h.total === 8, `Episode 7, one home (${N(6)}): jordan's second is void, no life lost (8 points, both lives)`, JSON.stringify([row, h.total, h.lives]));
    const engine = S.computeScores(st).map((x) => x.playerId);
    await seen("jordan", 7);
    table = await tableOf("jordan");
    check(table.map((t) => t.playerId).join() === engine.join(), "  the Games tab's order is the engine's", JSON.stringify([table.map((t) => t.playerId), engine]));
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
