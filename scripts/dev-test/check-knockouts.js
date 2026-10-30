// Dev-only check of a draft's race and players knocked out (docs/PLAN-start-a-game-gpt.md step A11 part 1: game-spec schema.js
// rank.race and rank.cut, settings.js draftRank, draftRace and draftCut; state-logic.js KnockoutLogic, endEpisode, rankKey, the
// lineup route's refusals, the waivers' rotation and free agents) against the dev server, through the API (no screens: they're
// the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6
// three days off). Its totals, as the fixture plays them, each team as it stood then (riley's replacement came after Episode 2,
// alex's after 4, so each one's loss stands until then):
//   Couch Cup (an exclusive Outlast of three): after 1, alex 5, riley 6, jordan 6, sam 6; 2: 9, 8, 11, 9; 3: 11, 12, 13, 12;
//   4: 15, 15, 17, 14; 5: 21, 18, 19, 16.
//   Lineup League (a shared Weekly Lineup, three starters): after 1, everyone 1.5; 2: 10.5, 10.5, 10.5, 9.5; 3: 12.5, 12.5, 12.5,
//   11.5; 4: 20, 18, 21, 15.5; 5: 21, 21, 22, 21.
// In order:
//   - Couch Cup made a guillotine (the lowest each episode is out; ties to the total, then nobody tied at the line goes), through
//     RosterLogic.setGame with the show's ctx (its fields: draftRank 'standing', draftCut): alex goes after 1 (he lost one in it,
//     and his replacement came after 4: it doesn't reach back), riley after 2, jordan after 3 (2 points to sam's 3, though he has
//     more), and sam is left: it's over at 3. The Games tab's table (last one standing: sam, jordan, riley, alex, each one's points
//     frozen at their last episode in: 12, 13, 8, 5) and its `over`; the knocked-out players' castaways still in are free agents
//     for sam, theirs still (an exclusive draft); the waivers' rotation is sam alone.
//   - Lineup League made a race to 20 points (draftRace): alex and jordan pass it in 4, so it's over at 4, jordan first (21); a
//     lineup for Episode 6 refused (the game ended with Episode 4).
//   - Lineup League made a cut every two episodes instead (the bottom one by the points over them): sam goes after 2, riley after 4;
//     a lineup for 6 refused for sam (he's out, and so for alex setting it as the commissioner), accepted for alex's own. The Games
//     tab as jordan reads it (seen through 5), and as sam does (through 3: only his own cut, riley still in). Episode 6 airs, through
//     the season sync: who went home alone is early results, so no cut yet; the full results (a scoring moment) make it final, and
//     the cut after 6 leaves one; alex reveals 6 and the Games tab agrees with the engine on who's first and that it's over.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-knockouts.js [--keep]
//
// One fixed scenario on purpose (the fixture's totals are the story above), run again whenever a race or a cut changes. Brings
// new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's
// zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-knockouts runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const O = fx.leagues.outlast;
    const L = fx.leagues.lineup;
    const league = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const seats = async (id) => {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [id])).rows) {
        const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
        if (who) out[who] = player_id;
      }
      return out;
    };
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const gameIn = async (who, id) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === id) ?? null;
    const whoOf = (pids) => (pid) => Object.keys(pids).find((k) => pids[k] === pid);
    const outsBy = (st, pids) => Object.fromEntries([...S.KnockoutLogic.outs(st)].map(([pid, n]) => [whoOf(pids)(pid), n]).sort());
    // A game's spec changed as the engine writes one (there's no screen for it yet): setGame with the show's ctx.
    const setRank = async (id, rank) => {
      const st = await league(id);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(id, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), rank }, { ctx });
      if (!problems.length) await write(id, st);
      return problems;
    };

    // ---------- Couch Cup: the guillotine ----------
    const po = await seats(O);
    let problems = await setRank(O, { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] });
    let st = await league(O);
    check(!problems.length && st.settings.draftRank === "standing" && same(st.settings.draftCut, [{ at: { every: 1 }, out: 1, tie: "keep", quiet: "cut" }]) && S.getLeagueType(st).id === "classic-draft",
      "Couch Cup made a guillotine (draftRank standing, draftCut; still an Outlast)", JSON.stringify({ problems, rank: st.settings.draftRank, cut: st.settings.draftCut }));
    check(same(outsBy(st, po), { alex: 1, jordan: 3, riley: 2 }), "  alex out after 1 (his loss stood until his replacement after 4), riley after 2, jordan after 3 (sam's 3 to his 2)", JSON.stringify(outsBy(st, po)));
    check(S.KnockoutLogic.endsAt(st) === 3 && S.lastEpisode(st) === 3 && S.endEpisode(st) === null && S.gameOver(st), "  sam is left: it's over at 3 (the span it was made with unchanged)", JSON.stringify({ ends: S.KnockoutLogic.endsAt(st), last: S.lastEpisode(st), end: S.endEpisode(st) }));
    let g = await gameIn("jordan", O);
    const rows = (g?.table ?? []).map((r) => [Object.keys(fx.users).find((k) => fx.users[k] === r.userId), r.rank, r.total]);
    check(same(rows, [["sam", "1", 12], ["jordan", "2", 13], ["riley", "3", 8], ["alex", "4", 5]]) && g?.over === true,
      "  the Games tab (as jordan reads it): last one standing, each frozen at their last episode in, and over", JSON.stringify({ rows, over: g?.over }));
    const free = new Set(S.RosterLogic.freeAgents(st).map((c) => c.id));
    const theirs = st.castaways.filter((c) => c.status === "active" && ["alex", "jordan", "riley"].some((w) => (c.ownerIds || []).includes(po[w])));
    check(S.KnockoutLogic.frees(st) && theirs.length > 0 && theirs.every((c) => free.has(c.id)), "  their castaways still in are free agents (an exclusive draft), still theirs for their history", JSON.stringify(theirs.map((c) => c.name)));
    check(same(S.WaiverLogic.rotation(st), [po.sam]), "  the waivers' rotation: sam alone", JSON.stringify(S.WaiverLogic.rotation(st)));

    // ---------- Lineup League: a race to 20 ----------
    const pl = await seats(L);
    problems = await setRank(L, { by: "total", race: { to: 20 } });
    st = await league(L);
    check(!problems.length && same(st.settings.draftRace, { to: 20 }) && st.settings.draftRank === undefined && S.KnockoutLogic.endsAt(st) === 4 && S.gameOver(st),
      "Lineup League made a race to 20 (draftRace): passed in 4, so it's over at 4", JSON.stringify({ problems, race: st.settings.draftRace, ends: S.KnockoutLogic.endsAt(st) }));
    g = await gameIn("riley", L);
    check(g?.over === true && Object.keys(fx.users).find((k) => fx.users[k] === g?.table?.[0]?.userId) === "jordan" && g?.table?.[0]?.total === 21, "  the Games tab: over, jordan first on 21", JSON.stringify({ over: g?.over, first: g?.table?.[0] }));
    const ep6 = st.episodes.find((e) => e.number === 6);
    const lineupFor = (s, pid) => S.Core.ownedCastawayIds(s, pid).filter((id) => S.getCastaway(s, id)?.status === "active").slice(0, S.ActiveRosterLogic.activeSlots(s));
    let r = await as.alex.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${pl.alex}`, { castawayIds: lineupFor(st, pl.alex) });
    check(r.status === 400 && /ended with episode 4/.test(errorOf(r)), "  a lineup for Episode 6 refused: the game ended with Episode 4", `${r.status} ${errorOf(r)}`);

    // ---------- Lineup League: a cut every two episodes ----------
    problems = await setRank(L, { by: "standing", cut: [{ at: { every: 2 } }] });
    st = await league(L);
    check(!problems.length && st.settings.draftRace === undefined && same(outsBy(st, pl), { riley: 4, sam: 2 }) && !S.gameOver(st),
      "Lineup League made a cut every two episodes: sam out after 2, riley after 4; alex and jordan play on", JSON.stringify({ problems, outs: outsBy(st, pl) }));
    r = await as.sam.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${pl.sam}`, { castawayIds: lineupFor(st, pl.sam) });
    check(r.status === 400 && /out of this game/.test(errorOf(r)), "  sam's lineup for 6 refused: he's out", `${r.status} ${errorOf(r)}`);
    r = await as.alex.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${pl.sam}`, { castawayIds: lineupFor(st, pl.sam) });
    check(r.status === 400 && /out of this game/.test(errorOf(r)), "  and alex setting it as the commissioner, refused too", `${r.status} ${errorOf(r)}`);
    r = await as.alex.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${pl.alex}`, { castawayIds: lineupFor(st, pl.alex) });
    check(r.status === 200, "  alex's own lineup for 6 accepted", `${r.status} ${errorOf(r)}`);
    g = await gameIn("jordan", L);
    const lrows = (g?.table ?? []).map((x) => Object.keys(fx.users).find((k) => fx.users[k] === x.userId));
    check(same(lrows.slice(2), ["riley", "sam"]) && g?.over === false, "  the Games tab (as jordan reads it): alex and jordan, then riley, then sam; not over", JSON.stringify({ lrows, over: g?.over }));
    // sam has seen through Episode 3 only: riley's cut (after 4) isn't his to see yet.
    g = await gameIn("sam", L);
    const srows = (g?.table ?? []).map((x) => Object.keys(fx.users).find((k) => fx.users[k] === x.userId));
    check(srows[3] === "sam" && srows.includes("riley") && srows.indexOf("riley") < 3, "  as sam reads it (seen through 3): only his own cut, riley still in", JSON.stringify(srows));

    // Episode 6 airs: someone still in is voted out, through the season sync.
    st = await league(L);
    const goner = st.castaways.filter((c) => c.status === "active").sort((a, b) => a.name.localeCompare(b.name))[0];
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, goner.name]
    );
    await syncSeasonLeagues(sid, null);
    st = await league(L);
    // Who went home alone is early results: the cut waits for the full ones.
    check(S.EpisodeLogic.resultsStage(st.episodes.find((e) => e.number === 6)) === "early" && same(outsBy(st, pl), { riley: 4, sam: 2 }) && !S.gameOver(st),
      `Episode 6's early results (${goner.name} voted out): no cut yet, it waits for the full results`, JSON.stringify(outsBy(st, pl)));
    // The full results: alex's first starter wins immunity.
    const star = S.getCastaway(st, S.ActiveRosterLogic.lineupFor(st, ep6.id, pl.alex).find((id) => id !== goner.id));
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'event', $2, '', 'individualImmunity', 'accepted', true, now(), false)`,
      [sid, star.name]
    );
    await syncSeasonLeagues(sid, null);
    st = await league(L);
    const outs = outsBy(st, pl);
    const sixth = Object.keys(outs).filter((w) => outs[w] === 6);
    check(S.EpisodeLogic.hasResults(st.episodes.find((e) => e.number === 6)) && sixth.length === 1 && ["alex", "jordan"].includes(sixth[0]) && S.gameOver(st) && S.KnockoutLogic.endsAt(st) === 6,
      `the full results (${star.name} wins immunity): the cut after 6 leaves one (${sixth[0]} goes), and it's over at 6`, JSON.stringify({ outs, ends: S.KnockoutLogic.endsAt(st) }));
    r = await as.alex.call("POST", `/api/leagues/${L}/results-seen`, { through: 6 });
    g = await gameIn("alex", L);
    const left = ["alex", "jordan"].find((w) => w !== sixth[0]);
    check(r.status === 200 && g?.over === true && Object.keys(fx.users).find((k) => fx.users[k] === g?.table?.[0]?.userId) === left, `  alex reveals 6: the Games tab agrees, ${left} first, over`, JSON.stringify({ over: g?.over, first: g?.table?.[0] }));
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e && e.stack ? e.stack : e);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `${failures} failed` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
