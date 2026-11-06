// Dev-only check of the week as a result (docs/PLAN-start-a-game-gpt.md track C, C5: game-spec schema.js and settings.js, state-logic.js
// PickEmLogic's pick of several scored by what they do, ActiveRosterLogic's only and hits, WeekLogic's weeks won) against the dev
// server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor
// 51: results through Episode 5, one going home each, in the boot order; Episode 6 three days off).
//   - The couch's Survival Pool made the user's third game (tracker row p12): three castaways picked each episode, no draft, only
//     the week's objectives counting (immunity, a reward, an idol found), a point for each one each pick hits, the week's winner and
//     the season by weeks won; through RosterLogic.setGame with the show's ctx (its fields: poolScore, poolEach, scoreOnly,
//     scoreHits, poolRank).
//   - Episodes 1 to 3 as each player picked, with their moments (written into the game, as the fixture's own picks are): the Games
//     tab as alex reads it ranks by weeks won, then the points, as the engine does.
//   - Going into 6, through the pick route: riley's three at once are stored in order, a fourth isn't; one taken back through the
//     DELETE route leaves the other two; someone gone home can't be picked.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-weeks.js [--keep]
//
// One fixed scenario on purpose (its picks and moments are the story above), run again whenever C5's pieces change. Brings
// new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's
// zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-weeks runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const OBJECTIVES = ["individualImmunity", "rewardWin", "idolFound"];

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
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [P])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), P]);
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [P])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const whoOf = (playerId) => Object.keys(pid).find((k) => pid[k] === playerId);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const gameOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === P) ?? null;
    const said = (g) => (g?.table ?? []).map((t) => [whoOf(t.playerId), t.rank]);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // ---------- the user's third game ----------
    let st = await league();
    if (specsOn && GameSpecs.carryGame(st.settings, true)) await write(st);
    st = await league();
    const ctx = await questionContext(P, sid);
    // Its own repeat said: the couch's game names the Survival Pool preset, whose pick cycles (fullSpec fills a preset's own).
    const spec = { ...S.gameOf(st), get: { by: "pick", each: 3, repeat: "any" }, count: { pick: true }, score: { by: "moments", points: null, only: OBJECTIVES, hits: "pick" }, rank: { by: "weeks" } };
    const problems = S.setGame(st, spec, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    const g = S.gameOf(st);
    const fields = ["poolScore", "poolEach", "scoreOnly", "scoreHits", "poolRank", "poolRepeat"].map((k) => st.settings[k]);
    check(!problems.length && g.get.each === 3 && g.get.repeat === "any" && g.score.hits === "pick" && same(g.score.only, OBJECTIVES) && g.rank.by === "weeks" && S.getLeagueType(st).id === "pickem"
      && same(fields, ["moments", 3, OBJECTIVES, "pick", "weeks", "any"]),
    "made the user's third game: three picks each episode, only the objectives, hits per pick, weeks won (setGame, the show's ctx)", JSON.stringify({ problems, fields, get: g.get }));

    // ---------- Episodes 1 to 3, as each player picked, with their moments ----------
    const cast = [...st.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const C = (i) => cast[i].id;
    // Ep 1: C10 immunity and an idol, C11 a reward, C12 an idol: alex [10, 11, 12] 2 + 1 + 1 = 4, riley [10, 13, 14] 2, jordan
    // [11, 12, 13] 2, sam [13, 14, 15] 0: alex's week.
    // Ep 2: C13 immunity, C14 a reward: alex [10, 11, 12] 0, riley [13, 14, 15] 2, jordan [13, 16, 17] 1, sam [14, 16, 17] 1: riley's.
    // Ep 3: C15 an idol: alex [15, 16, 17] 1, riley [10, 11, 12] 0, jordan [15, 13, 14] 1, sam none: alex and jordan's.
    // Weeks: alex 2 (5 points), riley 1 (4), jordan 1 (4), sam 0 (1). riley and jordan level on both (one place, T2).
    const moments = { 1: [["individualImmunity", 10], ["idolFound", 10], ["rewardWin", 11], ["idolFound", 12], ["idolFound", 12]], 2: [["individualImmunity", 13], ["rewardWin", 14], ["tribeImmunity", 15]], 3: [["idolFound", 15]] };
    const picks = {
      1: { alex: [10, 11, 12], riley: [10, 13, 14], jordan: [11, 12, 13], sam: [13, 14, 15] },
      2: { alex: [10, 11, 12], riley: [13, 14, 15], jordan: [13, 16, 17], sam: [14, 16, 17] },
      3: { alex: [15, 16, 17], riley: [10, 11, 12], jordan: [15, 13, 14] },
    };
    for (const n of [1, 2, 3]) {
      const ep = st.episodes.find((e) => e.number === n);
      ep.scoringEvents = (ep.scoringEvents || []).concat(moments[n].map(([type, i], k) => ({ id: `zt-c5-${n}-${k}`, type, castawayId: C(i) })));
      ep.picks = Object.entries(picks[n]).map(([who, ids]) => ({ playerId: pid[who], castawayId: C(ids[0]), more: ids.slice(1).map(C) }));
    }
    await write(st);
    st = await league();
    const rows = S.computeScores(st);
    check(same(rows.map((r) => [whoOf(r.playerId), r.total, r.weeks && r.weeks.won]).sort(), [["alex", 5, 2], ["jordan", 4, 1], ["riley", 4, 1], ["sam", 1, 0]])
      && same(S.WeekLogic.run(st).weeks.filter((w) => w.number <= 3).map((w) => w.winners.map(whoOf)), [["alex"], ["riley"], ["alex", "jordan"]]),
    "Episodes 1 to 3: alex's week, riley's, alex and jordan's; alex 2 weeks (5 points), riley and jordan 1 (4), sam none (1)",
      JSON.stringify({ rows: rows.map((r) => [whoOf(r.playerId), r.total, r.weeks]), weeks: S.WeekLogic.run(st).weeks.map((w) => [w.number, w.winners.map(whoOf), w.top]) }));
    let gv = await gameOf("alex");
    check(gv && same(said(gv)[0], ["alex", "1"]) && same(said(gv).slice(1, 3).map((x) => x[1]), ["T2", "T2"]) && same(said(gv)[3], ["sam", "4"]),
      "  the Games tab ranks as the engine does: by weeks won, then the points", JSON.stringify(said(gv)));

    // ---------- going into 6, through the pick route ----------
    const ep6 = st.episodes.find((e) => e.number === 6);
    const put = (who, body) => as[who].call("PUT", `/api/leagues/${P}/episodes/${ep6.id}/picks?quiet`, { playerId: pid[who], ...body });
    let r = await put("riley", { castawayIds: [C(10), C(11), C(12)] });
    st = await league();
    const mine = (who) => S.PickEmLogic.picked(S.PickEmLogic.pickFor(st, ep6.id, pid[who]));
    check(r.status === 200 && same(mine("riley"), [C(10), C(11), C(12)]), "riley's three at once: stored, in order", JSON.stringify({ status: r.status, mine: mine("riley") }));
    r = await put("riley", { castawayId: C(13) });
    st = await league();
    check(same(mine("riley"), [C(10), C(11), C(12)]), "  a fourth isn't added (three each episode)", JSON.stringify(mine("riley")));
    r = await put("jordan", { castawayIds: [C(13), C(0)] });
    st = await league();
    check(mine("jordan").length === 0, "  someone gone home (Episode 1's boot) can't be picked: nothing stored", JSON.stringify(mine("jordan")));
    r = await as.riley.call("DELETE", `/api/leagues/${P}/episodes/${ep6.id}/picks/${pid.riley}?castawayId=${C(11)}`);
    st = await league();
    check(r.status === 200 && same(mine("riley"), [C(10), C(12)]), "  one taken back through the DELETE route: the other two stay", JSON.stringify({ status: r.status, mine: mine("riley") }));
    r = await put("riley", { castawayId: C(14) });
    st = await league();
    check(same(mine("riley"), [C(10), C(12), C(14)]), "  and one added back while there's room", JSON.stringify(mine("riley")));
    // The state every route returns carries the picks, nothing private (a pick isn't hidden before its lock: as a pool's).
    const state = ((await as.sam.call("GET", `/api/leagues/${P}/state`)).body || {}).state;
    const seen = state && state.episodes ? S.PickEmLogic.picked((state.episodes.find((e) => e.id === ep6.id).picks || []).find((p) => p.playerId === pid.riley)) : null;
    check(same(seen, [C(10), C(12), C(14)]), "  the league's state as sam reads it has riley's picks", JSON.stringify(seen));
    gv = await gameOf("riley");
    check(gv && gv.table.length === 4, "  the Games tab still reads it", JSON.stringify(gv && gv.table));
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
