// Dev-only check of head to head, with playoffs (docs/PLAN-start-a-game-gpt.md step A11 part 4: game-spec schema.js rank.by
// 'matchups', rank.playoffs; settings.js draftRank 'matchups' and rankMatchups; state-logic.js MatchupLogic, rankKey, lastEpisode;
// air-times.ts's season length; db.ts's settle of where the playoffs began; game-view.ts's records and matchups; the couch hub's
// plaque) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley,
// jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three days off). Lineup League's points each
// episode, as the fixture plays them (check-knockouts.js has the totals): 1: 1.5 each; 2: alex 9, riley 9, jordan 9, sam 8; 3: 2
// each; 4: 7.5, 5.5, 8.5, 4; 5: 1, 3, 1, 5.5. The round robin over the four in the order they joined: 1 alex-sam riley-jordan, 2
// alex-jordan sam-riley, 3 alex-riley jordan-sam, then again. So after 5: jordan 1-0-4 (22 points), alex 1-0-4 (21), riley 1-2-2
// (21), sam 1-2-2 (21, joined after riley).
// In order:
//   - Lineup League made head to head with the top four in the playoffs, through RosterLogic.setGame with the show's ctx (its
//     fields: draftRank 'matchups', rankMatchups); still a Weekly Lineup. The Games tab as jordan reads it (seen through 5): the
//     standings above, each row's record; its playoffs at the season's end as its schedule says (Episodes 12 and 13: the season's
//     length stamped on the read); jordan's next matchup, sam in Episode 6. As sam reads it (seen through 3): the records through 3.
//   - Made to end with Episode 7 instead: the playoffs are 6 and 7, seeded now (jordan, alex, riley, sam). Episode 6 through the
//     season sync (someone voted out, then a scoring moment for one of sam's starters): the semifinals played, the bracket
//     following each one's points (a tie to the better seed), where the playoffs began kept on the league (settle, on that write).
//   - Episode 7, the final, through the season sync: the champion first in the table (whatever the points), the game over, a
//     lineup for Episode 8 refused; the hub's plaque the champion's, no margin in points.
//   - Episode 7's moment corrected (re-decided) to the other finalist's starter: worked out again, the champion the other one.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-h2h.js [--keep]
//
// One fixed scenario on purpose (the fixture's points are the story above), run again whenever head to head changes. Brings
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-h2h runs against a local database only");
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
    const L = fx.leagues.lineup;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    const records = (g) => (g?.table ?? []).map((r) => [whoIs(r.userId), `${r.record?.wins}-${r.record?.losses}-${r.record?.ties}`]);
    // A game's spec changed as the engine writes one (there's no screen for it yet): setGame with the show's ctx.
    const setGame = async (changes) => {
      const st = await league();
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(L, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(st);
      return problems;
    };
    const decide = async (n, kind, name, eventType) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
        [sid, n, kind, name, kind === "elimination" ? "Voted Out" : "", eventType || ""]
      );
      await syncSeasonLeagues(sid, null);
    };
    // Each seat's points in an episode, as the engine's series has them (what a matchup is played on).
    const pointsAt = (st, n) => {
      const series = S.KnockoutLogic.series(st);
      const i = series.findIndex((x) => x.number === n);
      if (i < 0) return null;
      return Object.fromEntries(WHO.map((w) => [w, Math.round(((series[i].totals.get(pids[w]) || 0) - (i ? series[i - 1].totals.get(pids[w]) || 0 : 0)) * 100) / 100]));
    };

    // ---------- head to head, the playoffs at the season's end ----------
    let problems = await setGame({ rank: { by: "matchups", playoffs: { teams: 4 } } });
    let st = await league();
    check(!problems.length && st.settings.draftRank === "matchups" && same(st.settings.rankMatchups, { playoffs: { teams: 4 } }) && S.getLeagueType(st).id === "active-roster",
      "Lineup League made head to head, the top four in the playoffs (draftRank matchups, rankMatchups; still a Weekly Lineup)", JSON.stringify({ problems, rank: st.settings.draftRank, m: st.settings.rankMatchups }));
    let g = await gameIn("jordan");
    check(same(records(g), [["jordan", "1-0-4"], ["alex", "1-0-4"], ["riley", "1-2-2"], ["sam", "1-2-2"]]) && same((g?.table ?? []).map((r) => r.rank), ["1", "2", "T3", "T3"]),
      "  the Games tab as jordan reads it (seen through 5): jordan and alex on a win and four ties (22 and 21 points), riley and sam level on a win, two losses and two ties (21 each: T3)", JSON.stringify({ records: records(g), ranks: (g?.table ?? []).map((r) => r.rank) }));
    check(g?.matchups?.playoffs?.from === 12 && g?.matchups?.playoffs?.rounds === 2 && g?.matchups?.playoffs?.seeds === null && g?.to === null,
      "  its playoffs at the season's end as its schedule says (13 episodes: 12 and 13), not seeded yet", JSON.stringify(g?.matchups?.playoffs));
    check(same(g?.matchups?.next, { episode: 6, round: null, opponent: pids.sam, stand: null }) && g?.matchups?.last?.episode === 5 && g?.matchups?.last?.result === "tie",
      "  jordan's next matchup: sam, in Episode 6; the last, a tie with alex in 5", JSON.stringify({ next: g?.matchups?.next, last: g?.matchups?.last }));
    g = await gameIn("sam");
    check(same(records(g).sort(), [["alex", "0-0-3"], ["jordan", "0-0-3"], ["riley", "1-0-2"], ["sam", "0-1-2"]]),
      "  as sam reads it (seen through 3): the records through 3", JSON.stringify(records(g)));

    // ---------- a span that ends with Episode 7: the playoffs 6 and 7 ----------
    problems = await setGame({ span: { from: 1, to: 7 } });
    g = await gameIn("jordan");
    const seeds = (g?.matchups?.playoffs?.seeds ?? []).map(whoOf);
    check(!problems.length && g?.matchups?.playoffs?.from === 6 && same(seeds, ["jordan", "alex", "riley", "sam"]) && g?.to === 7,
      "Lineup League made to end with Episode 7: the playoffs are 6 and 7, seeded jordan, alex, riley, sam", JSON.stringify({ problems, playoffs: g?.matchups?.playoffs }));
    check(same(g?.matchups?.next, { episode: 6, round: 1, opponent: pids.sam, stand: null }), "  jordan's next: the first round against sam (1 against 4)", JSON.stringify(g?.matchups?.next));
    st = await league();
    const ep6 = st.episodes.find((e) => e.number === 6);
    const starters = (s, epId, who) => S.ActiveRosterLogic.lineupFor(s, epId, pids[who]);
    // Episode 6: someone in nobody's lineup goes home, then one of sam's starters (not jordan's) wins immunity: the upset.
    const used = new Set(WHO.flatMap((w) => starters(st, ep6.id, w)));
    const goner = st.castaways.filter((c) => c.status === "active" && !used.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))[0];
    const samsStar = S.getCastaway(st, starters(st, ep6.id, "sam").find((id) => !starters(st, ep6.id, "jordan").includes(id)));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, "elimination", goner.name);
    await decide(6, "event", samsStar.name, "individualImmunity");
    st = await league();
    const p6 = pointsAt(st, 6);
    let w = S.MatchupLogic.run(st);
    const semi = (w?.rounds?.[0]?.games ?? []).map((x) => [whoOf(x.a), whoOf(x.b), whoOf(x.winner)]);
    const expect = (a, b, sa, sb) => (p6[a] > p6[b] ? a : p6[b] > p6[a] ? b : sa < sb ? a : b);
    const winners = [expect("jordan", "sam", 1, 4), expect("alex", "riley", 2, 3)];
    check(S.EpisodeLogic.hasResults(st.episodes.find((e) => e.number === 6)) && st.playoffsFrom === 6 && w?.rounds?.[0]?.played && same(semi.map((x) => x[2]), winners),
      `Episode 6 through the season sync (${goner.name} out, ${samsStar.name} immunity): the semifinals played on each one's points (${JSON.stringify(p6)}), won by ${winners.join(" and ")}; where the playoffs began kept (settle)`,
      JSON.stringify({ semi, playoffsFrom: st.playoffsFrom, p6 }));
    for (const who of WHO) await seen(who, 6);
    g = await gameIn("jordan");
    const finalists = winners;
    const other = (x) => finalists.find((f) => f !== x);
    check(g?.over === false && same((g?.table ?? []).slice(0, 2).map((r) => whoIs(r.userId)).sort(), [...finalists].sort()),
      "  the Games tab (seen through 6): the finalists first, not over", JSON.stringify(records(g)));

    // ---------- Episode 7, the final ----------
    st = await league();
    const ep7 = st.episodes.find((e) => e.number === 7);
    check(!!ep7, "  Episode 7 is there to play", JSON.stringify(st.episodes.map((e) => e.number)));
    // One of the lower finalist's starters (not the other's) wins immunity: they should win it, whatever the season's points.
    const [hi, lo] = finalists.slice().sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
    const star = (s, mine, theirs) => S.getCastaway(s, starters(s, ep7.id, mine).find((id) => !starters(s, ep7.id, theirs).includes(id)));
    const loStar = star(st, lo, hi);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await decide(7, "event", loStar.name, "individualImmunity");
    st = await league();
    w = S.MatchupLogic.run(st);
    const p7 = pointsAt(st, 7);
    const champ = p7[lo] > p7[hi] ? lo : hi;
    check(whoOf(w?.champion) === champ && S.gameOver(st) && S.lastEpisode(st) === 7,
      `Episode 7, the final (${loStar.name} immunity, ${lo}'s): ${champ} the champion on ${JSON.stringify(p7)}, the game over`, JSON.stringify({ champion: whoOf(w?.champion), p7 }));
    for (const who of WHO) await seen(who, 7);
    g = await gameIn("alex");
    check(g?.over === true && whoIs(g?.table?.[0]?.userId) === champ && g?.table?.[0]?.record?.champion === true && whoOf(g?.matchups?.playoffs?.champion) === champ,
      `  the Games tab as alex reads it: over, ${champ} first and the champion`, JSON.stringify({ over: g?.over, first: g?.table?.[0], champion: g?.matchups?.playoffs?.champion }));
    // Nothing to set after it: no Episode 8 is made past the game's end, and a lineup for one would be refused.
    const ep8 = st.episodes.find((e) => e.number === 8);
    const lineup = S.Core.ownedCastawayIds(st, pids.alex).filter((id) => S.getCastaway(st, id)?.status === "active").slice(0, S.ActiveRosterLogic.activeSlots(st));
    const r = ep8 ? await as.alex.call("PUT", `/api/leagues/${L}/episodes/${ep8.id}/lineups/${pids.alex}`, { castawayIds: lineup }) : null;
    check(r === null || (r.status === 400 && /ended with episode 7/.test(errorOf(r))), `  nothing to set for Episode 8: ${r === null ? "no Episode 8 past the game's end" : "its lineup refused, the game ended with Episode 7"}`, r && `${r.status} ${errorOf(r)}`);
    check(S.MatchupLogic.moveProblem(st, 8) === "This game ended with episode 7" && g?.matchups?.next === null, "  the engine refuses a move for 8, and nobody has a next matchup", JSON.stringify(g?.matchups?.next));
    const hub = (await as.jordan.call("GET", `/api/couches/${fx.couchId}/hub`)).body;
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === L);
    check(!!plaque && same(plaque.winners.map((x) => whoIs(x.userId)), [champ]) && plaque.by === null,
      `the hub as jordan reads it: the plaque is ${champ}'s, the playoffs' winner, with no margin in points`, JSON.stringify(plaque));

    // ---------- a corrected result ----------
    const hiStar = star(st, hi, lo);
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 7 AND castaway_name = $2", [sid, loStar.name, hiStar.name]);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const q7 = pointsAt(st, 7);
    const champ2 = q7[lo] > q7[hi] ? lo : hi;
    g = await gameIn("alex");
    check(whoOf(S.MatchupLogic.run(st)?.champion) === champ2 && whoIs(g?.table?.[0]?.userId) === champ2 && champ2 === hi,
      `the desk corrects Episode 7 (${hiStar.name}, ${hi}'s, won immunity): worked out again, ${champ2} the champion on ${JSON.stringify(q7)}`, JSON.stringify({ q7, first: g?.table?.[0] }));
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
