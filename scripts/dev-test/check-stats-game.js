// Dev-only check of L3 part 2 (docs/PLAN-start-a-game-gpt.md track L), the engine's hook: a draft scored by a sport's stats, played
// through the server's own read and write paths on this lane's database. A league (a lineup of two from three each, a captain
// counting double, the NBA's table) on a season of two games: the recorded 76ers home opener (tests/fixtures/espn/
// nba-401909093.json, kept at its final by finals.ts saveFinals from an in-process provider, "zt-espn-stats", so nothing here can
// reach a row of ESPN's) and one still to play. It checks:
//   before the final's kept, nothing scores and the episode has no results; once kept, every read (league-read.ts readyLeague, the
//   state route's and the show space's) stamps the game's lines on the episode (sports/score.ts stampStats), and each seat's points
//   are its starters' stat lines at the table with the captain's doubled, as the phone's scorer gives them; the viewer's copy at
//   their mark (nothing seen) has no lines and no points; a write (db.ts withLeagueLock: a lineup for the next game) hands back a
//   stamped state and saves none of the stamp; a show's league is never stamped.
// L3 part 2c: two games of questions on the same season, the NBA's own pick'em and pick a few (src/lib/sports/defaults), their
// answers in game_answers: before the final's kept, their episode has no results and nothing's graded; once kept, a read marks the
// opener's episode final (ep.gameFinal, no lines) and the server grades them on its games (answer-points.ts leagueAnswers,
// answerStanding: the 76ers won; Maxey's 32 the most), the viewer at their mark (nothing seen) graded on nothing, and the row saved
// by a write carries no mark.
// No app server: readyLeague is what GET /api/leagues/[id]/state and season-games.ts read through. Every row it makes is keyed
// "zt-stats-game" (the show's slug, the league's slug) or provider "zt-espn-stats"; it removes them at the end (--keep leaves
// them; the next run removes them first). Refuses a non-local database. Prints PASS/FAIL.
//
//   node scripts/dev-test/check-stats-game.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-stats-game runs against a local database only");
const keep = process.argv.includes("--keep");
const DAY = 86_400_000;
const P = "zt-espn-stats";
const SLUG = "zt-stats-game";

const { pool, withLeagueLock } = jiti("../../src/lib/server/db.ts");
const { readyLeague } = jiti("../../src/lib/server/league-read.ts");
const { leagueStates } = jiti("../../src/lib/server/league-states.ts");
const { saveFinals } = jiti("../../src/lib/server/sports/finals.ts");
const { stampStats } = jiti("../../src/lib/server/sports/score.ts");
const { leagueAnswers, answerStanding } = jiti("../../src/lib/server/answer-points.ts");
const { sportOf, storedGame, defaultsFor, specContextOf } = jiti("../../src/lib/sports/index.ts");
const { statLine, cents } = require("../../src/lib/game/sequence/stats.js");
const S = require("../../src/lib/game/state-logic.js");
const SIXERS = require("../../tests/fixtures/espn/nba-401909093.json");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function down() {
  const leagues = await pool.query("DELETE FROM leagues WHERE slug = $1 OR slug LIKE $2", [SLUG, `${SLUG}-%`]);
  const shows = await pool.query("DELETE FROM shows WHERE slug = $1", [SLUG]);
  const events = await pool.query("DELETE FROM sports_events WHERE provider = $1", [P]);
  return leagues.rowCount + shows.rowCount + events.rowCount;
}

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  const nba = sportOf("basketball/nba");
  const box = nba.readBox(SIXERS);
  const POINTS = defaultsFor("basketball").specs.season.spec.score.points;
  const kept = storedGame(nba, SIXERS);
  const phoneOf = (id) => statLine({ by: "stats", points: POINTS }, nba.full(kept.lines[id])).points;
  // Each team's three with the most points at the table: ann drafts the 76ers', bo the Cavaliers'.
  const threeOf = (team) => Object.keys(kept.lines).filter((id) => kept.people[id]?.team === team).sort((a, b) => phoneOf(b) - phoneOf(a)).slice(0, 3);
  const ann = threeOf("20");
  const bo = threeOf("5");
  const now = Date.now();
  const iso = (ms) => new Date(now + ms).toISOString();
  const provider = { id: P, name: "ZT ESPN", game: async (league, event) => (event === "401909093" ? storedGame(nba, SIXERS) : null) };
  try {
    const show = (await pool.query("INSERT INTO shows (slug, name, kind) VALUES ($1, 'ZT Stats Game', 'sport') RETURNING id", [SLUG])).rows[0].id;
    const seasonId = (await pool.query("INSERT INTO show_seasons (show_id, season_number) VALUES ($1, 1) RETURNING id", [show])).rows[0].id;
    for (const [ep, event, at, state, final, teams] of [
      [1, "401909093", -DAY, "post", true, [{ id: "20", score: 114 }, { id: "5", score: 106 }]],
      [2, "zt-next", DAY, "pre", false, [{ id: "20" }, { id: "5" }]],
    ]) {
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, $2, $3, 'listing')", [seasonId, ep, iso(at)]);
      await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams) VALUES ($1, $2, $3, 'basketball/nba', $4, $5, $6::jsonb)", [seasonId, ep, P, event, iso(at), JSON.stringify(teams)]);
      await pool.query(
        "INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, final_at) VALUES ($1, 'basketball/nba', $2, $3, $4, $5::jsonb, $6, $7)",
        [P, event, iso(at), state, JSON.stringify(teams), final, final ? iso(at + 3 * 3600_000) : null]
      );
    }
    for (const id of [...ann, ...bo]) {
      await pool.query("INSERT INTO season_cast (season_id, name, role, provider_ids) VALUES ($1, $2, $3, $4::jsonb)", [seasonId, box.people[id].name, null, JSON.stringify({ [P]: id })]);
    }
    // The league: the six drafted, a lineup of two each with a captain, the game carried as data (the game-specs flag).
    const state = S.defaultState();
    S.updateSettings(state, "showId", SLUG);
    S.updateSettings(state, "wikiSeason", 1);
    state.settings.game = null;
    for (const id of [...ann, ...bo]) S.addCastaway(state, box.people[id].name);
    state.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
    S.updateSettings(state, "setupComplete", true);
    const spec = {
      spec: 1, span: { from: 1, to: null }, pool: { of: "cast", where: null }, get: { by: "draft", each: 3, order: "snake", own: "exclusive" },
      count: { start: 2 }, score: { by: "stats", points: POINTS, captain: { times: 2 } }, rank: { by: "total" }, closes: "start",
    };
    const problems = S.setGame(state, spec, { ctx: specContextOf(nba) });
    check(problems.length === 0 && state.settings.game?.score?.by === "stats", "the game written as a league's own, carried as data", JSON.stringify(problems));
    const cid = (athlete) => state.castaways.find((c) => c.name === box.people[athlete].name).id;
    state.castaways.forEach((c, i) => { c.ownerIds = [i < 3 ? "ann" : "bo"]; });
    for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(state, n, false);
    const e1 = state.episodes.find((e) => e.number === 1).id;
    S.ActiveRosterLogic.setLineup(state, e1, "ann", [cid(ann[0]), cid(ann[1])]);
    S.ActiveRosterLogic.setCaptain(state, e1, "ann", cid(ann[0]));
    S.ActiveRosterLogic.setLineup(state, e1, "bo", [cid(bo[0]), cid(bo[2])]);
    const leagueId = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('Stats game check', $1, 'ZTSTAT', $2) RETURNING id", [SLUG, JSON.stringify(state)])).rows[0].id;
    const read = async () => readyLeague(leagueId, (await leagueStates([leagueId])).get(leagueId));
    const total = (s, who) => S.computeScores(s).find((r) => r.playerId === who).total;

    // L3 part 2c: the NBA's pick'em and pick a few on the same season, each with ann's and bo's answers for the opener.
    const asking = {};
    for (const name of ["pickem", "pickAFew"]) {
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 1);
      q.settings.game = null;
      for (const id of [...ann, ...bo]) S.addCastaway(q, box.people[id].name);
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const wrong = S.setGame(q, defaultsFor("basketball").specs[name].spec, { ctx: specContextOf(nba) });
      check(wrong.length === 0 && q.settings.game?.score?.by === "answers", `the NBA's ${name} written as a league's own`, JSON.stringify(wrong));
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ($1, $2, $3, $4) RETURNING id", [`ZT ${name}`, `${SLUG}-${name.toLowerCase()}`, `ZT${name.slice(-3).toUpperCase()}`, JSON.stringify(q)])).rows[0].id;
      const cidIn = (athlete) => q.castaways.find((c) => c.name === box.people[athlete].name).id;
      // The 76ers won; the Cavaliers' and 76ers' top scorers (Maxey and Mitchell tied on 32) are each side's first.
      const rows = name === "pickem"
        ? [["ann", "winner", "20"], ["bo", "winner", "5"]]
        : [["ann", "few", [cidIn(ann[0]), cidIn(bo[0]), cidIn(ann[2])]], ["bo", "few", [cidIn(ann[1]), cidIn(bo[1]), cidIn(bo[2])]]];
      for (const [who, question, answer] of rows) {
        await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, $2, $3, 1, $4::jsonb)", [id, who, question, JSON.stringify(answer)]);
      }
      asking[name] = id;
    }
    const readQ = async (name) => readyLeague(asking[name], (await leagueStates([asking[name]])).get(asking[name]));
    const graded = async (name, st, mark = null) => {
      const calls = await leagueAnswers({ leagueId: asking[name], state: st, playerId: "ann", mark });
      return [calls.right("ann"), calls.right("bo")];
    };
    {
      const q = await readQ("pickem");
      check(!S.EpisodeLogic.hasResults(q.episodes.find((e) => e.number === 1)) && (await graded("pickem", q)).join() === "0,0", "a game of questions, before the final's kept: no results, nothing graded");
    }

    // Before the final's counts are kept: nothing scored, no results.
    let s = await read();
    check(!s.episodes.some((e) => e.statLines) && total(s, "ann") === 0 && !S.EpisodeLogic.hasResults(s.episodes.find((e) => e.number === 1)), "before the final's kept: no lines, no points, no results");

    const r = await saveFinals({ providers: [provider], seasons: [seasonId], now: new Date(now) });
    check(r.saved === 1, "the opener's counts kept at its final", JSON.stringify(r));

    s = await read();
    const ep1 = s.episodes.find((e) => e.number === 1);
    check(!!ep1.statLines && Object.keys(ep1.statLines).length === 6 && !s.episodes.find((e) => e.number === 2).statLines, "a read stamps the final's lines on its episode, the league's six only; the game still to play has none", JSON.stringify(Object.keys(ep1.statLines ?? {})));
    const annWant = cents(2 * phoneOf(ann[0]) + phoneOf(ann[1]));
    const boWant = cents(phoneOf(bo[0]) + phoneOf(bo[2]));
    check(total(s, "ann") === annWant && total(s, "bo") === boWant, "each seat's points: its starters' stat lines at the table, the captain's doubled (as the phone scores them)", `${total(s, "ann")} vs ${annWant}, ${total(s, "bo")} vs ${boWant}`);
    check(S.EpisodeLogic.hasResults(ep1) && S.SpoilerLogic.latestWithResults(s) === 1, "the game's lines are its episode's results");
    const unseen = S.GhostLogic.viewFor(s, "ann", 0);
    check(!unseen.episodes.some((e) => e.statLines) && total(unseen, "ann") === 0, "the viewer's copy at their mark (nothing seen): no lines, no points");
    check(S.GhostLogic.viewFor(s, "ann", 1).episodes.find((e) => e.number === 1).statLines !== undefined, "seen through it: the lines are theirs");

    // A write: the next game's lineup. The state it hands back is stamped; the row it saves isn't.
    const e2 = s.episodes.find((e) => e.number === 2).id;
    const after = await withLeagueLock(leagueId, (st) => { S.ActiveRosterLogic.setLineup(st, e2, "ann", [cid(ann[1]), cid(ann[2])]); });
    check(!!after.episodes.find((e) => e.number === 1).statLines && total(after, "ann") === annWant, "a write hands back the league stamped (its points as they are)");
    const row = (await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId])).rows[0].state;
    check(!row.episodes.some((e) => "statLines" in e || "statBouts" in e) && !("statGroups" in row) && row.episodes.find((e) => e.number === 2).lineups?.ann?.length === 2, "the row it saved has the lineup and none of the stamp");

    // L3 part 2c: the games of questions, once the final's kept.
    for (const [name, want] of [["pickem", "1,0"], ["pickAFew", "6,0"]]) {
      const q = await readQ(name);
      const e1 = q.episodes.find((e) => e.number === 1);
      check(e1.gameFinal === true && !e1.statLines && S.EpisodeLogic.hasResults(e1) && !S.EpisodeLogic.hasResults(q.episodes.find((e) => e.number === 2)), `${name}: a read marks the opener's episode final (no lines); the game still to play has no results`);
      check((await graded(name, q)).join() === want, `${name}: graded on the kept final as it stands`, (await graded(name, q)).join());
      check((await graded(name, S.GhostLogic.viewFor(q, "ann", 0), 0)).join() === "0,0" && !S.GhostLogic.viewFor(q, "ann", 0).episodes.some((e) => e.gameFinal), `${name}: the viewer's copy at their mark (nothing seen): no results, nothing graded`);
      const st = await answerStanding({ leagueId: asking[name], state: q, playerId: "ann", mark: null });
      check(st.through === 1 && st.right("ann") === Number(want[0]), `${name}: the hub's standing is through the opener`, JSON.stringify({ through: st.through }));
    }
    {
      const after = await withLeagueLock(asking.pickem, () => {});
      const row = (await pool.query("SELECT state FROM leagues WHERE id = $1", [asking.pickem])).rows[0].state;
      check(after.episodes.find((e) => e.number === 1).gameFinal === true && !row.episodes.some((e) => "gameFinal" in e), "a write hands back the mark and saves none of it");
    }

    // A show's league is never stamped (nothing asked of the sports tables).
    const plain = S.defaultState();
    check((await stampStats(plain)) === plain && !plain.episodes.some((e) => e.statLines), "a show's league is left as it is");
  } finally {
    if (!keep) await down();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
