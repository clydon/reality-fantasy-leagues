// Dev-only check of a pool's knockouts (docs/PLAN-start-a-game-gpt.md step A11 part 2: game-spec schema.js and settings.js,
// state-logic.js PickEmLogic's pick that never repeats and its walk with everyone together, last one standing's end) against the
// dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT
// Survivor 51: results through Episode 5, one going home each, in the boot order; Episode 6 three days off; everyone has seen 5
// but sam, 3). Added here: the desk's own admin (zt_nd_desk, as check-pool-parts.js makes one).
//   - The couch's Survival Pool made the corpus row w047 ("survivor pool but you can't pick the same person twice, and if your
//     pick goes home you're out, last one standing wins, ties split"): a pick that never repeats (a night with nobody left a
//     missed pick), one life, last one standing, one or none left ending it, the night everyone left goes out sharing the win;
//     through RosterLogic.setGame with the show's ctx (its fields: poolRepeat, poolFallback, poolLives, poolRank, rankOneLeft,
//     rankAllOut).
//   - Episodes 1 to 5 as each player picked (written into the game, as the fixture's own picks are): alex, riley and jordan right
//     every time; sam's second pick goes home, so he's out in 2. The Games tab as jordan reads it: three tied first, sam last.
//   - Going into 6, through the pick route: jordan's pick of someone she picked in 2 isn't stored (nobody twice), another is; sam
//     (out) can't pick. Episode 6 airs, two go home (the season sync): riley's pick among them, she's out; two left.
//   - Episode 7: alex's repeat refused too; both left pick someone who goes home: everyone left out the same night, so they share
//     the win (T1), and with none left the game is over at 7 (lastEpisode, the Games tab's `over`); nobody picks for 8.
//   - A corrected result (the desk's decision for Episode 7 changed: jordan's pick stayed after all): the walk works it out
//     again, jordan is the last one standing and wins alone, alex second; still over at 7 (one left).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-pool-knockouts.js [--keep]
//
// One fixed scenario on purpose (its picks and boots are the story above), run again whenever a pool's knockouts change. Brings
// new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-pool-knockouts runs against a local database only");
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
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [P])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), P]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [P])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const whoOf = (playerId) => Object.keys(pid).find((k) => pid[k] === playerId);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
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
    const gameOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === P) ?? null;
    const said = (g) => (g?.table ?? []).map((t) => [whoOf(t.playerId), t.rank]);
    const H = (st, who) => S.pickEmHistory(st, pid[who]);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // ---------- w047's game ----------
    let st = await league();
    if (specsOn && GameSpecs.carryGame(st.settings, true)) await write(st);
    st = await league();
    check(S.getLeagueType(st).id === "pickem" && S.PickEmLogic.parts(st) === null, "the couch's Survival Pool: a plain pool (it cycles, nobody out)", JSON.stringify(S.PickEmLogic.parts(st)));
    const ctx = await questionContext(P, sid);
    const g0 = S.gameOf(st);
    const spec = {
      ...g0,
      get: { ...g0.get, repeat: "never" },
      score: { ...g0.score, lives: 1 },
      rank: { by: "standing", oneLeft: "ends", allOut: "share" },
    };
    const problems = S.setGame(st, spec, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    const parts = S.PickEmLogic.parts(st);
    const fields = ["poolRepeat", "poolFallback", "poolLives", "poolRank", "rankOneLeft", "rankAllOut"].map((k) => st.settings[k]);
    check(!problems.length && parts?.never?.fallback === "miss" && parts.lives === 1 && parts.standing && parts.oneLeft === "ends" && parts.allOut === "share" && same(fields, ["never", "miss", 1, "standing", "ends", "share"]),
      "  made w047's game: nobody picked twice, one life, last one standing, none or one left ending it, a shared win (setGame, the show's ctx)", JSON.stringify({ problems, parts, fields }));

    // ---------- Episodes 1 to 5, as each player picked ----------
    const cast = [...st.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const C = (i) => cast[i].id;
    const N = (i) => cast[i].name;
    check([1, 2, 3, 4, 5].every((n) => st.episodes.find((e) => e.number === n).events.map((ev) => ev.castawayId).join() === C(n - 1)), "the fixture's results: one home each episode, the first five in the boot order");
    const played = {
      alex: [10, 11, 12, 13, 14],
      riley: [9, 8, 7, 6, 5],
      jordan: [15, 16, 17, 5, 6],
      // His second goes home in 2: out, one life.
      sam: [5, 1, null, null, null],
    };
    st.episodes.forEach((e) => { if (e.number <= 5) e.picks = []; });
    for (const [who, list] of Object.entries(played)) {
      list.forEach((i, k) => { if (i !== null) st.episodes.find((e) => e.number === k + 1).picks.push({ playerId: pid[who], castawayId: C(i) }); });
    }
    await write(st);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const h5 = Object.fromEntries(Object.keys(played).map((who) => [who, H(st, who)]));
    check(["alex", "riley", "jordan"].every((w) => h5[w].total === 5 && h5[w].lives === 1 && h5[w].out === null) && h5.sam.out === 2 && h5.sam.total === 1,
      "alex, riley and jordan five right, still in; sam out in 2 (his pick went home: one life)", JSON.stringify(Object.entries(h5).map(([w, h]) => [w, h.total, h.lives, h.out])));
    check(S.lastEpisode(st) === null && !S.gameOver(st), "  three left: the game goes on", JSON.stringify({ last: S.lastEpisode(st) }));
    await seen("jordan", 5);
    let g = await gameOf("jordan");
    check(same(said(g).map((x) => x[1]), ["T1", "T1", "T1", "4"]) && said(g)[3][0] === "sam", "the Games tab as jordan reads it: three tied first, sam last (out)", JSON.stringify(said(g)));

    // ---------- Going into 6: picks through the route ----------
    const e6 = st.episodes.find((e) => e.number === 6);
    const put = (epId, who, castawayId) => as[who].call("PUT", `/api/leagues/${P}/episodes/${epId}/picks?quiet`, { playerId: pid[who], castawayId });
    const pickOf = async (epId, who) => S.pickEmPickFor(await league(), epId, pid[who]);
    let r = await put(e6.id, "jordan", C(16));
    let p = await pickOf(e6.id, "jordan");
    check(r.status === 200 && p === null, `jordan's pick of ${N(16)} isn't stored: she picked them in 2 (nobody twice)`, `${r.status} ${JSON.stringify(p)}`);
    const blocked = S.pickEmEligibility(await league(), e6.id, pid.jordan).blocked[C(16)];
    check(blocked?.reason === "used" && blocked.episode === 2, "  her eligibility says why: used in 2", JSON.stringify(blocked));
    await put(e6.id, "jordan", C(7));
    await put(e6.id, "alex", C(8));
    await put(e6.id, "riley", C(10));
    check((await pickOf(e6.id, "jordan"))?.castawayId === C(7) && (await pickOf(e6.id, "alex"))?.castawayId === C(8) && (await pickOf(e6.id, "riley"))?.castawayId === C(10), `jordan picks ${N(7)}, alex ${N(8)}, riley ${N(10)}`);
    r = await put(e6.id, "sam", C(9));
    check(r.status === 200 && (await pickOf(e6.id, "sam")) === null, "sam is out: his pick isn't stored", String(r.status));

    // ---------- Episode 6: two go home ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, [N(10), N(11)]);
    st = await league();
    check(H(st, "riley").out === 6 && H(st, "alex").out === null && H(st, "jordan").out === null && S.lastEpisode(st) === null,
      `Episode 6: ${N(10)} and ${N(11)} home; riley's pick among them, she's out in 6; alex and jordan left`, JSON.stringify(["alex", "riley", "jordan"].map((w) => [w, H(st, w).out])));

    // ---------- Episode 7: everyone left goes out ----------
    const e7 = st.episodes.find((e) => e.number === 7);
    r = await put(e7.id, "alex", C(12));
    check(r.status === 200 && (await pickOf(e7.id, "alex")) === null, `alex's pick of ${N(12)} isn't stored: he picked them in 3`, String(r.status));
    await put(e7.id, "alex", C(9));
    await put(e7.id, "jordan", C(8));
    check((await pickOf(e7.id, "alex"))?.castawayId === C(9) && (await pickOf(e7.id, "jordan"))?.castawayId === C(8), `alex picks ${N(9)}, jordan ${N(8)}`);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, [N(9), N(8)]);
    st = await league();
    const scores = S.computeScores(st);
    const row = (who) => scores.find((x) => x.playerId === pid[who]);
    check(row("alex").out === 7 && row("jordan").out === 7 && row("alex").shared && row("jordan").shared && S.lastEpisode(st) === 7 && S.gameOver(st),
      `Episode 7: both their picks home: everyone left out the same night, sharing the win; none left, so it's over at 7`, JSON.stringify({ rows: scores.map((x) => [whoOf(x.playerId), x.out, x.total, !!x.shared]), last: S.lastEpisode(st) }));
    await seen("jordan", 7);
    g = await gameOf("jordan");
    const top = said(g);
    check(same(top.map((x) => x[1]), ["T1", "T1", "3", "4"]) && same(top.slice(2).map((x) => x[0]), ["riley", "sam"]) && g?.over === true,
      "  the Games tab as jordan reads it: alex and jordan share first, then riley, sam; over", JSON.stringify({ top, over: g?.over }));
    // Episode 8 made in the league (as the next week's would be), to try a pick for.
    S.ensureEpisodeNumber(st, 8, false);
    await write(st);
    const e8 = (await league()).episodes.find((e) => e.number === 8);
    r = await put(e8.id, "alex", C(13));
    check(r.status === 200 && (await pickOf(e8.id, "alex")) === null && S.pickEmEligibility(await league(), e8.id, pid.alex).ended === 7, "  nobody picks for 8: the game ended with 7", String(r.status));

    // ---------- A corrected result ----------
    // The desk's decision changed (re-decided: a new decided_at is what the sync takes as a change).
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 7 AND castaway_name = $2", [sid, N(8), N(13)]);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const home7 = st.episodes.find((e) => e.number === 7).events.map((ev) => ev.castawayId);
    check(home7.includes(C(13)) && !home7.includes(C(8)), `the desk corrects Episode 7: ${N(13)} went home, not ${N(8)} (the season sync)`, JSON.stringify(home7));
    const fixed = S.computeScores(st);
    check(same(fixed.map((x) => [whoOf(x.playerId), x.out]), [["jordan", null], ["alex", 7], ["riley", 6], ["sam", 2]]) && !fixed.some((x) => x.shared) && S.lastEpisode(st) === 7 && S.gameOver(st),
      "  worked out again: jordan the last one standing, alone; alex second; still over at 7 (one left)", JSON.stringify({ rows: fixed.map((x) => [whoOf(x.playerId), x.out, x.total, !!x.shared]), last: S.lastEpisode(st) }));
    g = await gameOf("jordan");
    check(same(said(g), [["jordan", "1"], ["alex", "2"], ["riley", "3"], ["sam", "4"]]) && g?.over === true, "  the Games tab agrees", JSON.stringify({ table: said(g), over: g?.over }));
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
