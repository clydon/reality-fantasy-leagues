// Dev-only check of scoring that combines, per lineup (docs/PLAN-start-a-game-gpt.md step A9, part 2: game-spec schema.js and
// settings.js, state-logic.js ActiveRosterLogic's captain, best ball, timesFor and episodeScore, EliminationOrderScoringStrategy
// in reverse, the lineup route's captainId, phase-starts.ts), against the dev server, through the API (no screens: they're the
// UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three
// days off; everyone has seen 5 but sam, 3). Added here: the desk's own admin (zt_nd_desk, as check-questions-time.js makes one).
//   - The couch's Weekly Lineup (a shared draft, so two teams can hold the same castaway: each expectation is worked out from
//     each player's own lineup or team, never the engine's sums), carrying its spec when the game-specs flag is on: a captain
//     refused while the game has none; then made a game with a captain who scores double and
//     points that double once Merged starts, through RosterLogic.setGame with the show's ctx (its fields: captainTimes,
//     pointsTimes).
//   - Before Episode 6: jordan sets his lineup and names a captain (stored on the episode); a captain who isn't one of his
//     starters refused; riley's lineup, no captain; jordan can't name sam's.
//   - The desk confirms the merge at Episode 7 ahead: the lineup game records the phase starts (it reads them now), no windows.
//   - Episode 6 airs: jordan's captain change refused (locked with the lineup). Its results: jordan's captain's points doubled,
//     the Games tab's total and week say so; riley's plain.
//   - Episode 7 (the merge, double): nobody names anyone; jordan's captain carries, four times over; riley's starters double.
//   - Best ball: the same game made best 2 of each team of 5, no lineups (the lineup route refuses one now), its waivers replacing
//     a loss right away (best ball has no starters to be short of); Episode 8's results: each player's best two of their team,
//     whoever started.
//   - Reverse: the couch's Outlast made to score the boot order in reverse: each player's points are the cast's size + 1 less
//     each castaway's Outlast points (still in: what they'd score if they went next), on the Games tab too.
//   - The flag's check on both.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-lineup-scoring.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
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
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-lineup-scoring runs against a local database only");
const args = process.argv.slice(2);
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
    const couch = fx.couchId;
    const sid = fx.seasonId;
    const L = fx.leagues.lineup;
    const O = fx.leagues.outlast;
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
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    as.desk = await api({ user: DESK, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const pid = async (id, who) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, fx.users[who]])).rows[0].player_id;
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    check(!!rb, "the season's rulebook (the desk's season page makes it)", JSON.stringify(season.rulebook));
    const tableOf = async (who, id) => ((await as[who].call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === id)?.table ?? [];
    const rowOf = (table, who) => table.find((t) => t.userId === fx.users[who]);
    const decide = async (n, rows) => {
      for (const [kind, name, method, eventType] of rows) {
        await pool.query(
          `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
           VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
          [sid, n, kind, name, method, eventType]
        );
      }
      await syncSeasonLeagues(sid, null);
      // The Games tab reads each league as jordan has seen it.
      await seen("jordan", n);
    };
    const J = await pid(L, "jordan");
    const R = await pid(L, "riley");
    const SAM = await pid(L, "sam");
    const epOf = (state, n) => state.episodes.find((e) => e.number === n);
    const lineup = (who, epId, playerId, body) => as[who].call("PUT", `/api/leagues/${L}/episodes/${epId}/lineups/${playerId}`, body);
    // With the game-specs flag on, the two leagues carry their spec as every league does then (game-specs-flag.js on), so the
    // new parts reach the carried one through setGame.
    if (specsOn) {
      for (const id of [L, O]) {
        const s0 = (await league(id)).state;
        if (GameSpecs.carryGame(s0.settings, true)) await write(id, s0);
      }
    }
    /** What a player's lineup earns from `events` ([castawayId, moment]) in an episode: each of theirs at its points, their
     *  captain's times `cap`, all of it times `times`. Worked out here, from the lineup and the points alone. */
    const lineupGain = (state, epId, playerId, events, captain, cap, times) => {
      const ids = S.ActiveRosterLogic.lineupFor(state, epId, playerId);
      return Math.round(events.reduce((t, [c, type]) => t + (ids.includes(c) ? S.ActiveRosterLogic.pointsFor(state, type) * (c === captain ? cap : 1) * times : 0), 0) * 100) / 100;
    };

    // ---------- A captain, and points that double once Merged starts ----------
    let st = (await league(L)).state;
    const e6 = epOf(st, 6);
    check(!!e6 && S.getLeagueType(st).id === "active-roster" && S.ActiveRosterLogic.activeSlots(st) >= 2, "the couch's Weekly Lineup: Episode 6 is this week's", JSON.stringify([!!e6, S.getLeagueType(st).id, S.ActiveRosterLogic.activeSlots(st)]));
    const mine = (state, playerId) => state.castaways.filter((c) => c.status !== "eliminated" && c.ownerIds.includes(playerId)).map((c) => c.id);
    const jTeam = mine(st, J);
    const rTeam = mine(st, R);
    const slots = S.ActiveRosterLogic.activeSlots(st);
    let r = await lineup("jordan", e6.id, J, { castawayIds: jTeam.slice(0, slots), captainId: jTeam[0] });
    check(r.status === 400 && /no captain/.test(JSON.stringify(r.body)), "a captain refused while the game has none (400)", `${r.status} ${JSON.stringify(r.body)}`);
    const ctx = await questionContext(L, sid);
    const g0 = S.gameOf(st);
    const TIMES = [{ phase: "merged", times: 2 }];
    let problems = S.setGame(st, { ...g0, score: { ...g0.score, captain: { times: 2 }, times: TIMES } }, { ctx });
    if (!problems.length) await write(L, st);
    st = (await league(L)).state;
    check(!problems.length && st.settings.captainTimes === 2 && G.sameValue(st.settings.pointsTimes, TIMES) && S.readsPhases(st), "  made a game with a captain who scores double and Merged's points doubled (setGame, the show's ctx)", JSON.stringify(problems));
    const before = await tableOf("jordan", L);

    // ---------- Before Episode 6 ----------
    const jStart = jTeam.slice(0, slots);
    r = await lineup("jordan", e6.id, J, { castawayIds: jStart, captainId: jTeam[slots] ?? "nobody" });
    check(r.status === 400 && /one of your starters/.test(JSON.stringify(r.body)), "jordan's captain off his lineup refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await lineup("jordan", e6.id, J, { castawayIds: jStart, captainId: jStart[0] });
    st = (await league(L)).state;
    check(r.status === 200 && epOf(st, 6).captains?.[J] === jStart[0], "jordan sets his lineup and names his captain: stored on Episode 6", `${r.status} ${JSON.stringify(epOf(st, 6).captains)}`);
    r = await lineup("jordan", e6.id, SAM, { castawayIds: mine(st, SAM).slice(0, slots), captainId: null });
    check(r.status === 403, "  he can't name sam's (403)", String(r.status));
    const rStart = rTeam.slice(0, slots);
    r = await lineup("riley", e6.id, R, { castawayIds: rStart });
    check(r.status === 200 && S.ActiveRosterLogic.captainFor((await league(L)).state, e6.id, R) === null, "riley sets hers, no captain", `${r.status}`);

    // ---------- The desk confirms the merge at 7, ahead ----------
    r = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 7 });
    st = (await league(L)).state;
    check(r.status === 200 && st.phaseStarts?.merged === 7 && G.sameValue(st.phaseWindows ?? {}, {}), "the desk confirms the merge at 7: the lineup game records the phase's start (no windows: it asks nothing)", JSON.stringify({ status: r.status, starts: st.phaseStarts, windows: st.phaseWindows }));
    check(S.ActiveRosterLogic.timesFor(st, 6) === 1, "  Episode 6 still counts once", String(S.ActiveRosterLogic.timesFor(st, 6)));

    // ---------- Episode 6 airs, and its results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await lineup("jordan", e6.id, J, { castawayIds: jStart, captainId: jStart[1] });
    check(r.status === 400 && /locked/.test(JSON.stringify(r.body)), "Episode 6 on: jordan's captain change refused with his lineup (400)", `${r.status} ${JSON.stringify(r.body)}`);
    const nameOf = (id) => st.castaways.find((c) => c.id === id).name;
    const pts = (type) => S.ActiveRosterLogic.pointsFor(st, type);
    // Who goes home: someone nobody started (so no exit's points land on a lineup).
    const started6 = new Set(Object.values(epOf(st, 6).lineups || {}).flat().concat(st.players.flatMap((p) => S.ActiveRosterLogic.lineupFor(st, e6.id, p.id))));
    const boot6 = st.castaways.find((c) => c.status !== "eliminated" && !started6.has(c.id));
    const ev6 = [[jStart[0], "individualImmunity"], [jStart[1], "idolFound"], [rStart[0], "individualImmunity"]];
    await decide(6, [["elimination", boot6.name, "Voted Out", ""], ...ev6.map(([c, type]) => ["event", nameOf(c), "", type])]);
    const after6 = await tableOf("jordan", L);
    const delta = (a, b, who) => Math.round(((rowOf(b, who)?.total ?? 0) - (rowOf(a, who)?.total ?? 0)) * 100) / 100;
    const want6 = lineupGain(st, e6.id, J, ev6, jStart[0], 2, 1);
    check(want6 > lineupGain(st, e6.id, J, ev6, null, 1, 1) && delta(before, after6, "jordan") === want6 && rowOf(after6, "jordan")?.week === want6, `Episode 6: jordan's captain's ${pts("individualImmunity")} doubled (${want6} in all), the Games tab's week too`, JSON.stringify([delta(before, after6, "jordan"), want6, rowOf(after6, "jordan")?.week]));
    check(delta(before, after6, "riley") === lineupGain(st, e6.id, R, ev6, null, 1, 1), `  riley's plain ${lineupGain(st, e6.id, R, ev6, null, 1, 1)}`, String(delta(before, after6, "riley")));

    // ---------- Episode 7: the merge's, double ----------
    st = (await league(L)).state;
    const e7 = epOf(st, 7);
    check(!!e7 && S.ActiveRosterLogic.captainFor(st, e7.id, J) === jStart[0], "Episode 7: nobody names anyone, jordan's captain carries", JSON.stringify([!!e7, e7 && S.ActiveRosterLogic.captainFor(st, e7.id, J)]));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    const j7 = S.ActiveRosterLogic.lineupFor(st, e7.id, J);
    const r7 = S.ActiveRosterLogic.lineupFor(st, e7.id, R);
    const started7 = new Set(st.players.flatMap((p) => S.ActiveRosterLogic.lineupFor(st, e7.id, p.id)));
    const boot7 = st.castaways.find((c) => c.status !== "eliminated" && !started7.has(c.id));
    const ev7 = [[j7[0], "individualImmunity"], [r7[0], "idolFound"]];
    await decide(7, [["elimination", boot7.name, "Voted Out", ""], ...ev7.map(([c, type]) => ["event", nameOf(c), "", type])]);
    const after7 = await tableOf("jordan", L);
    check(S.ActiveRosterLogic.timesFor((await league(L)).state, 7) === 2, "  Episode 7 counts double: Merged's", String(S.ActiveRosterLogic.timesFor((await league(L)).state, 7)));
    const want7 = lineupGain(st, e7.id, J, ev7, jStart[0], 2, 2);
    check(j7[0] === jStart[0] && delta(after6, after7, "jordan") === want7, `  jordan's captain at the merge: ${pts("individualImmunity")} x 2 x 2, and the rest doubled (${want7})`, JSON.stringify([delta(after6, after7, "jordan"), want7]));
    check(delta(after6, after7, "riley") === lineupGain(st, e7.id, R, ev7, null, 1, 2), `  riley's, doubled (${lineupGain(st, e7.id, R, ev7, null, 1, 2)})`, String(delta(after6, after7, "riley")));
    st = (await league(L)).state;
    const engine = S.computeScores(st);
    check(rowOf(after7, "jordan")?.total === engine.find((e) => e.playerId === J).total, "  the Games tab's totals are the engine's", JSON.stringify([rowOf(after7, "jordan")?.total, engine.find((e) => e.playerId === J)?.total]));

    // ---------- Best ball ----------
    const g1 = S.gameOf(st);
    // Its waivers replace a loss right away: best ball has no starters to be short of ("only when short" is a lineup's).
    const waivers = g1.extras.waivers ? { ...g1.extras.waivers, replace: g1.extras.waivers.replace === "whenShort" ? "always" : g1.extras.waivers.replace } : null;
    problems = S.setGame(st, { ...g1, count: { best: 2 }, score: { by: "moments", points: g1.score.points }, extras: { ...g1.extras, waivers, hideStarters: false } }, { ctx });
    if (!problems.length) await write(L, st);
    st = (await league(L)).state;
    const type = S.getLeagueType(st);
    check(!problems.length && st.settings.bestBall === true && type.id === "active-roster" && type.hasBestBall && !type.hasActiveRoster && !("captainTimes" in st.settings), "best ball: the same game, its best 2 of each team count, no lineups (and no captain)", JSON.stringify([problems, st.settings.bestBall, type.hasBestBall]));
    const e8 = S.EpisodeLogic.ensureEpisodeNumber(st, 8, false);
    await write(L, st);
    r = await lineup("jordan", e8.id, J, { castawayIds: mine(st, J).slice(0, 1) });
    check(r.status === 400 && /no active roster/.test(JSON.stringify(r.body)), "  a lineup refused now (400)", `${r.status} ${JSON.stringify(r.body)}`);
    const before8 = await tableOf("jordan", L);
    st = (await league(L)).state;
    const jNow = mine(st, J);
    const rNow = mine(st, R);
    check(jNow.length >= 3 && rNow.length >= 1, `  jordan has ${jNow.length} still in, riley ${rNow.length}`);
    // Three of jordan's score (2, -0.5 and the immunity's), one of riley's (her last); nobody's goes home.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    const boot8 = st.castaways.find((c) => c.status !== "eliminated" && !c.ownerIds.length);
    const ev8 = [[jNow[0], "idolFound"], [jNow[1], "satOut"], [jNow[2], "individualImmunity"], [rNow[rNow.length - 1], "individualImmunity"]];
    await decide(8, [...(boot8 ? [["elimination", boot8.name, "Voted Out", ""]] : []), ...ev8.map(([c, type]) => ["event", nameOf(c), "", type])]);
    const after8 = await tableOf("jordan", L);
    // Each player's best two of the team they hold, worked out here: each castaway's points from Episode 8's, the two highest.
    const bestTwo = (playerId) => {
      const each = mine(st, playerId).map((c) => ev8.reduce((t, [x, type]) => t + (x === c ? pts(type) : 0), 0));
      return Math.round(each.sort((a, b) => b - a).slice(0, 2).reduce((t, v) => t + v, 0) * 100) / 100;
    };
    check(delta(before8, after8, "jordan") === bestTwo(J), `Episode 8: jordan's best two of his ${jNow.length} (${bestTwo(J)}), whoever he'd have started`, JSON.stringify([delta(before8, after8, "jordan"), bestTwo(J), boot8?.name ?? null]));
    check(delta(before8, after8, "riley") === bestTwo(R), `  riley's best two of hers (${bestTwo(R)})`, String(delta(before8, after8, "riley")));
    check(rowOf(after8, "jordan")?.week === bestTwo(J), "  the Games tab's week is his best two", JSON.stringify(rowOf(after8, "jordan")?.week));

    // ---------- Reverse ----------
    let os = (await league(O)).state;
    const plain = S.computeScores(os);
    problems = S.setGame(os, { ...S.gameOf(os), score: { by: "place", reverse: true } }, { ctx: await questionContext(O, sid) });
    if (!problems.length) await write(O, os);
    os = (await league(O)).state;
    const rev = S.computeScores(os);
    const N = os.castaways.length;
    const held = (playerId) => os.castaways.filter((c) => c.ownerIds.includes(playerId)).length;
    const mirrored = plain.every((p) => rev.find((x) => x.playerId === p.playerId).locked === held(p.playerId) * (N + 1) - p.locked);
    check(!problems.length && os.settings.reverseOrder === true && mirrored, `reverse: the couch's Outlast scores the boot order backwards (each castaway ${N} + 1 less their Outlast points)`, JSON.stringify([problems, plain.map((p) => [p.name, p.locked]), rev.map((p) => [p.name, p.locked])]));
    const out = os.castaways.filter((c) => c.status === "eliminated").sort((a, b) => a.placementOrder - b.placementOrder);
    check(S.EliminationOrderScoringStrategy.castawayPoints(os, out[0]) === N && S.EliminationOrderScoringStrategy.stillInPoints(os) === N - out.length, `  the first one out ${N}; everyone still in ${N - out.length} (what they'd score going home next)`, JSON.stringify([S.EliminationOrderScoringStrategy.castawayPoints(os, out[0]), S.EliminationOrderScoringStrategy.stillInPoints(os), out.length]));
    const oTable = await tableOf("jordan", O);
    const OJ = await pid(O, "jordan");
    check(rowOf(oTable, "jordan")?.total === rev.find((x) => x.playerId === OJ).total, "  the Games tab reads it", JSON.stringify([rowOf(oTable, "jordan"), rev.find((x) => x.playerId === OJ)?.total]));

    // ---------- The flag ----------
    for (const [id, what] of [[L, "the best ball"], [O, "the reverse Outlast"]]) {
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
