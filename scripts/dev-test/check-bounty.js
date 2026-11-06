// Dev-only check of a bounty (docs/PLAN-start-a-game-gpt.md step A14 part 3: game-spec schema.js score.bounty and bountyProblems,
// settings.js bounty; formats/votes.js recordOf; src/lib/server/vote-records.ts, the stamp with the air times; the sequence's
// bountyLines; state-logic.js BountyLogic and ScoringLogic.walk) against the dev server, through the API (no screens: they're the UI
// track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6
// three days off; Couch Cup, the couch's Outlast, alex its commissioner; everyone has seen 5 but sam, 3). Expectations are worked
// out from who holds whom (2 points for each vote out by someone on another team), and the engine's own reading of each copy, so the
// check proves research's stored answer reaches the table through the stamp. In order:
//   - Couch Cup gets a bounty of 2 through RosterLogic.setGame with the show's ctx (settings.bounty, still an Outlast, its words);
//     refused beside cuts, nothing written.
//   - Episode 6's research stored as the season's combined answer (who voted for whom: two on other teams and one on the goner's own
//     team voting them out, one free agent, the goner's vote the other way, the count against them matching), then its result through
//     the season sync (the goner voted out). The Games tab as alex, riley and jordan (seen through 6) read it: each the engine's
//     table on that copy, stamped as the server stamps it, and against the same copy without a bounty, the goner's holder 4 down and
//     each voter's holder 2 up; sam (seen through 3) has none of it, and the league as sam reads it carries no record past 3.
//   - A correction: Episode 6's research again with the count against the goner one more than the votes it names. The next read
//     moves nothing (void), and the table is the one without a bounty.
//   - The game-specs flag's check passes on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-bounty.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; the research rows go with its show); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or
// how many failed.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-bounty runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameBy = (a, b) => same(Object.entries(a).sort(), Object.entries(b).sort());

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const L = fx.leagues.outlast;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const { stampVoteRecords } = jiti("../../src/lib/server/vote-records.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    const setGame = async (changes) => {
      const st = await league();
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(L, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(st);
      return problems;
    };
    const totals = (v) => Object.fromEntries(S.computeScores(v).map((r) => [whoOf(r.playerId), r.total]));
    const tableOf = (g) => Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), r.points]));
    // The engine's table on each one's copy, stamped as the server stamps it, and the same copy without the bounty.
    const copies = async (who, mark) => {
      const st = await league();
      await stampVoteRecords(pool, st);
      const view = S.GhostLogic.viewFor(st, pids[who], mark);
      const plain = JSON.parse(JSON.stringify(view));
      delete plain.settings.bounty;
      if (plain.settings.game && plain.settings.game.score) delete plain.settings.game.score.bounty;
      return { view, plain };
    };
    const { rows: [show] } = await pool.query("SELECT ss.show_id, ss.season_number FROM show_seasons ss WHERE ss.id = $1", [sid]);
    const research = async (castaways) => {
      await pool.query("DELETE FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number = 6", [show.show_id, show.season_number]);
      await pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source) VALUES ($1, $2, 6, $3::jsonb, $4::jsonb, 'combined')`,
        [show.show_id, show.season_number, JSON.stringify({ episodeTitle: null, castaways }), JSON.stringify({ provider: "check-bounty: a stand-in answer" })]
      );
    };

    // ---------- the game ----------
    let st = await league();
    const cut = await setGame({ score: { by: "place", bounty: { points: 2 } }, rank: { by: "standing", cut: [{ at: { every: 3 }, out: 1 }] } });
    check(cut.some((p) => p.at === "score.bounty" && /beside cuts/.test(p.problem)) && (await league()).settings.bounty === undefined,
      "Couch Cup with a bounty beside cuts: refused, nothing written", JSON.stringify(cut));
    const problems = await setGame({ score: { by: "place", bounty: { points: 2 } } });
    st = await league();
    const words = G.describeSpec(S.gameOf(st)).sentence;
    check(!problems.length && same(st.settings.bounty, { points: 2 }) && S.getLeagueType(st).id === "classic-draft" && /Bounties: when one of your .* votes out someone else's, you take 2 points from them\./.test(words),
      "Couch Cup gets a bounty of 2 (settings.bounty; still an Outlast; its words)", JSON.stringify({ problems, bounty: st.settings.bounty, words }));

    // ---------- Episode 6: research's votes, then its result ----------
    // The goner: someone on the team of one who's seen Episode 6. Voters: one each on two other teams, one on the goner's own team,
    // and a free agent; the goner votes one of them.
    const ownerOf = (c) => (c.ownerIds ?? [])[0];
    const stillIn = st.castaways.filter((c) => c.status === "active");
    const goner = stillIn.find((c) => ownerOf(c) && ["alex", "riley", "jordan"].includes(whoOf(ownerOf(c))));
    const loser = whoOf(ownerOf(goner));
    const others = [...new Set(stillIn.filter((c) => ownerOf(c) && ownerOf(c) !== ownerOf(goner)).map(ownerOf))].slice(0, 2);
    const voters = others.map((p) => stillIn.find((c) => ownerOf(c) === p));
    const own = stillIn.find((c) => c.id !== goner.id && ownerOf(c) === ownerOf(goner));
    const free = stillIn.find((c) => !(c.ownerIds ?? []).length);
    check(!!goner && voters.length === 2 && !!own, `${goner?.name} (${loser}'s) to go home, voted out by ${voters.map((c) => `${c.name} (${whoOf(ownerOf(c))}'s)`).join(", ")}, ${own?.name} (${loser}'s own) and ${free ? `${free.name} (nobody's)` : "nobody free"}`,
      JSON.stringify({ goner: goner?.name, voters: voters.map((c) => c.name), own: own?.name }));
    const outVotes = [...voters, own, free].filter(Boolean);
    const answer = (count) => stillIn.map((c) => ({
      name: c.name,
      leftTheGame: c.id === goner.id ? "yes" : "no",
      exitMethod: c.id === goner.id ? "Voted Out" : null,
      votedFor: outVotes.includes(c) ? goner.name : c.id === goner.id ? voters[0].name : null,
      votesReceived: c.id === goner.id ? count : c.id === voters[0].id ? 1 : 0,
    }));
    await research(answer(outVotes.length));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, goner.name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    st = await league();
    check(st.castaways.find((c) => c.id === goner.id)?.status === "eliminated", `Episode 6 through the season sync: ${goner.name} voted out`);
    // Each voter on another team takes 2 from the goner's holder; the goner's own team's vote and the free agent's move nothing.
    const moved = { [loser]: -2 * voters.length };
    voters.forEach((c) => { moved[whoOf(ownerOf(c))] = (moved[whoOf(ownerOf(c))] || 0) + 2; });
    for (const who of WHO) {
      const mark = who === "sam" ? 3 : 6;
      const { view, plain } = await copies(who, mark);
      const want = totals(view);
      const without = totals(plain);
      const g = await gameIn(who);
      check(sameBy(tableOf(g), want), `  the Games tab as ${who} reads it (seen through ${mark}): the engine's table on that copy (${JSON.stringify(want)})`,
        JSON.stringify({ api: tableOf(g), want, without }));
      const diff = Object.fromEntries(Object.keys(want).map((k) => [k, Math.round((want[k] - without[k]) * 100) / 100]).filter(([, d]) => d));
      if (mark === 6) check(sameBy(diff, moved), `  ${who}'s copy against the same without a bounty: ${JSON.stringify(moved)}`, JSON.stringify({ diff, moved }));
      else check(!Object.keys(diff).length, `  ${who}'s copy (through 3) has no bounty`, JSON.stringify(diff));
    }
    // The league's state route sends the whole state, results included, and the browser trims it to each one's mark (SpoilerLogic):
    // the record comes with Episode 6's results, and sam's trimmed copy has neither.
    const read = (await as.sam.call("GET", `/api/leagues/${L}/state`)).body;
    const rec6 = (read?.state?.episodes ?? []).find((e) => e.number === 6)?.voteRecord;
    check(!!rec6 && rec6.sure === true && rec6.votes.length === outVotes.length + 1 && same(rec6.out, [goner.id]), "  the league's state as read: Episode 6's record (stamped on the read), sure, every vote by id", JSON.stringify(rec6));
    const samView = S.SpoilerLogic.viewThrough(read.state, read.membership?.resultsSeenThrough ?? 3);
    check(!samView.episodes.some((e) => e.number > 3 && (e.voteRecord || (e.events ?? []).length)), `  sam's copy as the browser trims it (through ${read.membership?.resultsSeenThrough}): no record or result past Episode 3`,
      JSON.stringify(samView.episodes.filter((e) => e.voteRecord).map((e) => e.number)));

    // ---------- a correction: research no longer sure ----------
    await research(answer(outVotes.length + 1));
    for (const who of ["alex", "riley"]) {
      const { view, plain } = await copies(who, 6);
      const g = await gameIn(who);
      check(sameBy(tableOf(g), totals(view)) && sameBy(totals(view), totals(plain)), `  re-researched, its count one more than the votes it names: ${who}'s table moves nothing (void)`,
        JSON.stringify({ api: tableOf(g), want: totals(view), without: totals(plain) }));
    }

    // ---------- the flag ----------
    const flagged = checkLeague(await league());
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`down: ${e.message}`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
