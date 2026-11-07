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
// by a write carries no mark. L3 part 2d: a categories league on it, read with the sport's stats (statDefs) and its matchup's record.
// L3 part 2e: a squares league on it (ann's squares the top half, bo's the bottom, taken before the opener locked): a read stamps the
// opener's kept score and its digits (drawn by the server, the opener having locked), the read writes once to keep the digits (and
// never the stamp), each pay goes to whoever holds its square, a seat with none takes what's left from the next game, and the viewer
// at their mark is paid nothing. A bracket on the recorded 2026 US Open men's singles (tests/fixtures/espn/atp-189-2026.json, a second
// season of the show): its draw as listed before the final (sports/score.ts drawNow, the provider's card: 128 in it, 64 first-round
// matches, seven rounds, in the league's people), an answer checked against it, then the kept final's draw and the champion's pick
// graded on it. L3 part 2f part 2: a week's slate (a third season): the opener and a game tomorrow, a pick'em of each game ranked by
// confidence, answered through answers.ts (gameQuestions, answerQuestions) by a zt user's seat: the week's question open past its
// episode's own lock, its games with their sides by name, each pick locking at its own game's start (a started game's pick kept, a change
// or a first pick there refused), the confidences each once, then closed at its last game and graded game by game. L8 part 1's
// engine items: daily lineups on a week's slate (a fourth season, closes 'game'): a read stamps each game's start and day's end and
// each holding's games by its team; a holding whose game is on today can't be benched (refused through withLeagueLock), one whose
// game was yesterday can, saved with its time beside the lineup before it (never the stamp); once the week's games are kept, each
// game counts the lineup in force when it started. L3 part 3b: an over/under on each game of a week's slate by its own line (a sixth
// season): the line kept as the question opens for each game that has one (question_lines), never moved after (ESPN's moving), a game
// with none yet unanswerable until it has, a postponed game in the week locked and off, its start locking nothing (the week's lock its
// first game played), graded game by game on the kept lines; and a team's matchup of a game an episode (a seventh): its postponed
// opener's episode has results (nothing scored) so the week moves on, the next game's over/under waiting ("Line coming") and refused
// until its line's read, then open with it; a game moved to another day (not on its day's scoreboard) found on its team's schedule by
// the daily job (refreshSportsEvents), its new start kept with it, on its link and as its episode's air time.
// No app server: readyLeague is what GET /api/leagues/[id]/state and season-games.ts read through. Every row it makes is keyed
// "zt-stats-game" (the show's slug, the league's slug, its user "zt-stats-game-user") or provider "zt-espn-stats"; it removes them at the end (--keep leaves
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
const USER = "zt-stats-game-user";

const { pool, withLeagueLock } = jiti("../../src/lib/server/db.ts");
const { readyLeague } = jiti("../../src/lib/server/league-read.ts");
const { leagueStates } = jiti("../../src/lib/server/league-states.ts");
const { saveFinals } = jiti("../../src/lib/server/sports/finals.ts");
const { stampStats, drawNow, leagueGames } = jiti("../../src/lib/server/sports/score.ts");
const { leagueAnswers, answerStanding } = jiti("../../src/lib/server/answer-points.ts");
const { gameQuestions, answerQuestions } = jiti("../../src/lib/server/answers.ts");
const { sportLocks } = jiti("../../src/lib/server/air-times.ts");
const { refreshSportsEvents } = jiti("../../src/lib/server/sports/matchup.ts");
const { sportOf, storedGame, storedCard, defaultsFor, specContextOf } = jiti("../../src/lib/sports/index.ts");
const Sq = require("../../src/lib/game/sequence/squares.js");
const G = require("../../src/lib/game/game-spec/index.js");
const USOPEN = require("../../tests/fixtures/espn/atp-189-2026.json");
const { statLine, cents } = require("../../src/lib/game/sequence/stats.js");
const S = require("../../src/lib/game/state-logic.js");
const Air = require("../../src/lib/game/air-schedule.js");
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
  const users = await pool.query('DELETE FROM "user" WHERE id = $1', [USER]);
  return leagues.rowCount + shows.rowCount + events.rowCount + users.rowCount;
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

    // L3 part 2d: head to head by the NBA's nine categories on the same season (a lineup of two each, set before the final), its
    // read stamped with the sport's stats (statDefs) beside the lines, the record the categories won and lost.
    {
      const q = structuredClone(state);
      const cats = defaultsFor("basketball").categories.stats;
      check(S.setGame(q, { ...spec, score: { by: "stats", categories: cats }, rank: { by: "categories" } }, { ctx: specContextOf(nba) }).length === 0, "a categories game written as a league's own");
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT categories', $1, 'ZTCATS', $2) RETURNING id", [`${SLUG}-categories`, JSON.stringify(q)])).rows[0].id;
      const c = await readyLeague(id, (await leagueStates([id])).get(id));
      const rec = S.MatchupLogic.view(c, "ann").record;
      check(!!c.statDefs && c.statDefs["FG%"]?.parts && rec.wins + rec.losses + rec.ties === cats.length, "categories: a read hands the sport's stats over beside the lines; the opener's matchup is each of the nine won, lost or tied", JSON.stringify(rec));
      check(!s.statDefs, "a game by points per stat gets no statDefs");
    }

    // L3 part 2e: squares on the same season. ann takes the top half, bo the bottom, before the opener locked (made before its air
    // time was stamped); cy takes none.
    {
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 1);
      q.settings.game = null;
      q.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const spec = defaultsFor("basketball").specs.squares.spec;
      check(S.setGame(q, spec, { ctx: specContextOf(nba) }).length === 0 && S.getLeagueType(q).id === "squares", "a squares game written as a league's own");
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const half = (from) => Array.from({ length: 50 }, (_, i) => from + i);
      check(S.SquaresLogic.take(q, "ann", half(0)) === null && S.SquaresLogic.take(q, "bo", half(50)) === null, "squares taken before the lock");
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT squares', $1, 'ZTSQRS', $2) RETURNING id", [`${SLUG}-squares`, JSON.stringify(q)])).rows[0].id;
      const c = await readyLeague(id, (await leagueStates([id])).get(id));
      const e1 = c.episodes.find((e) => e.number === 1);
      const row = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
      const digits = row.squares?.digits?.["1"];
      check(e1.gameScore?.status === "final" && e1.gameScore.periods?.length === 4 && c.statPeriods === 4, "a read stamps the opener's kept score, each quarter's end, and the sport's periods", JSON.stringify(e1.gameScore?.sides));
      check(!!digits && digits.rows.length === 10 && !row.squares.digits["2"] && !row.episodes.some((e) => "gameScore" in e || "squareDigits" in e), "the read kept the opener's digits (drawn at its lock) and none of the stamp; the game still to play has none");
      const holders = Sq.holdersOf({ ann: half(0), bo: half(50) });
      const want = Sq.squaresPays(S.SquaresLogic.parts(c), e1.gameScore, { digits, holders, regulation: 4 }).totals;
      const rows = S.computeScores(c);
      const got = Object.fromEntries(rows.map((r) => [r.playerId, r.total]));
      check(got.ann === (want.ann || 0) && got.bo === (want.bo || 0) && got.ann + got.bo === 5 && got.cy === 0, "each pay to whoever holds its square: 1, 1 and 1 a quarter and 2 for the final, all of them held", JSON.stringify(got));
      const again = await readyLeague(id, (await leagueStates([id])).get(id));
      check(JSON.stringify(again.episodes.find((e) => e.number === 1).squareDigits ?? again.squares.digits["1"]) === JSON.stringify(digits) && S.computeScores(again).every((r) => r.total === got[r.playerId]), "read again: the same digits, the same points");
      check(S.computeScores(S.GhostLogic.viewFor(c, "ann", 0)).every((r) => r.total === 0), "the viewer's copy at their mark (nothing seen): nothing paid");
      // After the lock: ann's are set; cy (none) can't take a held square, and the squares are all held.
      let refused = null;
      await withLeagueLock(id, (st) => { refused = S.SquaresLogic.take(st, "ann", [1]); });
      check(refused === "Squares are set once the game starts", "after the lock, a seat's squares are set", refused);
      await withLeagueLock(id, (st) => { refused = S.SquaresLogic.take(st, "cy", [7]); });
      check(refused === "Someone has that square already", "a late seat can take only what's left", refused);
    }

    // L3 part 2e: a bracket on the US Open's men's singles, a second season of the show, its card as listed (not final), then kept.
    {
      const tennis = sportOf("tennis/atp");
      const card = storedCard(tennis, USOPEN);
      let final = false;
      const tennisP = { id: P, name: "ZT ESPN", game: async (league, event) => (event === "189" ? { ...structuredClone(card), final } : null) };
      const season2 = (await pool.query("INSERT INTO show_seasons (show_id, season_number) SELECT id, 2 FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 1, $2, 'listing')", [season2, iso(DAY)]);
      await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at) VALUES ($1, 1, $2, 'tennis/atp', '189', $3)", [season2, P, iso(DAY)]);
      await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, final) VALUES ($1, 'tennis/atp', '189', $2, 'pre', false)", [P, iso(DAY)]);
      // The final's winner, named in the league (its cast's provider id), and one of the first round's.
      const box = tennis.readBox(USOPEN);
      const title = box.bouts.find((b) => b.class === "MS" && b.place?.fromFinal === 1);
      const titleResult = tennis.stateAt(USOPEN).bouts[title.id]?.result;
      const winner = titleResult.winner;
      const name = box.people[winner]?.name ?? "The champion";
      await pool.query("INSERT INTO season_cast (season_id, name, role, provider_ids) VALUES ($1, $2, null, $3::jsonb)", [season2, name, JSON.stringify({ [P]: winner })]);
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 2);
      q.settings.game = null;
      S.addCastaway(q, name);
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const spec = defaultsFor("tennis").specs.bracket.spec;
      check(S.setGame(q, spec, { ctx: specContextOf(tennis) }).length === 0 && G.typeOf(spec) === "questions", "a bracket game written as a league's own (a game of questions)");
      S.ensureEpisodeNumber(q, 1, false);
      const champId = q.castaways[0].id;
      const listed = await drawNow(q, 1, "MS", { providers: [tennisP] });
      check(listed?.first === 7 && Object.keys(listed.entrants).length === 128 && listed.matches[7]?.length === 64 && champId in listed.entrants, "the draw as listed before the final: 128 in it, 64 first-round matches, seven rounds, the league's own by its castaway", JSON.stringify({ first: listed?.first, n: Object.keys(listed?.entrants ?? {}).length }));
      const qn = spec.ask[0];
      check(G.answerProblem(qn, { 7: ["nobody"] }, listed) === "Pick only who's in the draw" && G.answerProblem(qn, { 7: [champId] }, listed) === null, "an answer checked against the draw as listed");
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT bracket', $1, 'ZTBRKT', $2) RETURNING id", [`${SLUG}-bracket`, JSON.stringify(q)])).rows[0].id;
      await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, 'ann', 'bracket', 1, $2::jsonb), ($1, 'bo', 'bracket', 1, $3::jsonb)", [id, JSON.stringify({ 1: [champId] }), JSON.stringify({ 1: [`${P}:nobody`] })]);
      // The event final and kept: the draw from the kept card, the champion's pick right.
      final = true;
      await pool.query("UPDATE sports_events SET state = 'post', final = true, final_at = $2 WHERE provider = $1 AND event_id = '189'", [P, iso(-3600_000)]);
      const kept = await saveFinals({ providers: [tennisP], seasons: [season2], now: new Date(now) });
      check(kept.saved === 1, "the US Open kept at its final", JSON.stringify(kept));
      const st = await readyLeague(id, (await leagueStates([id])).get(id));
      const games = (await leagueGames(st)).games;
      const field = await drawNow(st, 1, "MS", { games });
      check(field?.over === true && field.winners[1]?.[0] === champId, "the kept final's draw: over, its champion the league's own");
      const calls = await leagueAnswers({ leagueId: id, state: st, playerId: "ann", mark: null });
      check(calls.right("ann") === 64 && calls.right("bo") === 0, "the champion's pick graded right on the kept final: 64 (the first round's 1, doubling each round to the final)", `${calls.right("ann")}, ${calls.right("bo")}`);
    }

    // L3 part 2f part 2: a question about each game of a week's slate, a third season of the show: its episode the kept 76ers opener
    // (started) and a game tomorrow, ranked by confidence, answered by ann's account through answers.ts (the route's own code).
    {
      // Its premiere yesterday at noon UTC, weekly: Episode 1 locks by the clock then (the lineups' lock), and this week is still it
      // (its results wait for its last game).
      const season3 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, premiere_date, air_time, air_tz, status) SELECT id, 3, (now() AT TIME ZONE 'UTC')::date - 1, '12:00', 'UTC', 'airing' FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      await pool.query("INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key) VALUES ($1, $2, 'basketball/nba', 2027, 'regular', 'week', '[]'::jsonb, $3)", [season3, P, `${SLUG}-slate`]);
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 1, $2, 'listing'), ($1, 2, $3, 'listing')", [season3, iso(-DAY), iso(6 * DAY)]);
      const later = "zt-slate-later";
      for (const [event, at, teams] of [
        ["401909093", -DAY, [{ id: "20", name: "76ers" }, { id: "5", name: "Cavaliers" }]],
        [later, DAY, [{ id: "1", name: "Hawks" }, { id: "2", name: "Celtics" }]],
      ]) await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams) VALUES ($1, 1, $2, 'basketball/nba', $3, $4, $5::jsonb)", [season3, P, event, iso(at), JSON.stringify(teams)]);
      await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final) VALUES ($1, 'basketball/nba', $2, $3, 'pre', $4::jsonb, false)", [P, later, iso(DAY), JSON.stringify([{ id: "1" }, { id: "2" }])]);
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 3);
      q.settings.game = null;
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const pickem = defaultsFor("basketball").specs.pickem.spec;
      const spec = { ...pickem, ask: [{ ...pickem.ask[0], each: "game", confidence: true }] };
      const wrong = S.setGame(q, spec, { ctx: specContextOf(nba) });
      check(wrong.length === 0 && q.settings.game?.ask?.[0]?.each === "game", "a pick'em of each game, ranked by confidence, written as a league's own", JSON.stringify(wrong));
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT each game', $1, 'ZTEACH', $2) RETURNING id", [`${SLUG}-each`, JSON.stringify(q)])).rows[0].id;
      await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, 'zt each', 'zt-stats-game@example.invalid', true, $1, $1, now(), now())`, [USER]);
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'ann', 'member')", [id, USER]);
      await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 1, true)", [USER, season3]);
      // Ann's pick on the opener, made before it started (as the app would have kept it).
      await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, 'ann', 'winner', 1, $2::jsonb)", [id, JSON.stringify({ "401909093": { answer: "20", confidence: 2 } })]);
      const user = { id: USER, name: "zt each", email: "zt-stats-game@example.invalid" };
      const said = async (body) => {
        try {
          return { ok: !!(await answerQuestions(user, season3, id, body)) };
        } catch (e) {
          return { status: e.status, why: e.message };
        }
      };
      const win = (g) => g.questions.find((x) => x.id === "winner");
      const stored = async () => (await pool.query("SELECT answer FROM game_answers WHERE league_id = $1 AND player_id = 'ann' AND question = 'winner' AND episode = 1", [id])).rows[0]?.answer ?? null;
      let g = await gameQuestions(user, season3, id);
      let w = win(g);
      check(g.episode === 1 && w?.each === "game" && w.confidence === true && w.status === "open" && w.episode === 1, "the week's question about each game, open past its episode's own lock while a game is still to start", JSON.stringify(w && { each: w.each, status: w.status, episode: w.episode, week: g.episode }));
      check(w?.games?.map((x) => `${x.id}:${x.started}:${x.sides.map((y) => y.name).join("-")}`).join() === `401909093:true:76ers-Cavaliers,${later}:false:Hawks-Celtics`, "  its games in the order they start, each with its sides by name and whether it's started", JSON.stringify(w?.games));
      check(w?.closesAt === iso(DAY), "  it closes as its last game starts", w?.closesAt);
      let r = await said({ episode: 1, answers: { winner: { [later]: { answer: "1", confidence: 1 } } } });
      check(r.ok && G.sameValue(await stored(), { "401909093": { answer: "20", confidence: 2 }, [later]: { answer: "1", confidence: 1 } }), "a pick for the game still to start, the started game's pick kept as it was", JSON.stringify([r, await stored()]));
      r = await said({ episode: 1, answers: { winner: { "401909093": { answer: "5", confidence: 2 }, [later]: { answer: "1", confidence: 1 } } } });
      check(r.status === 409 && /started: its pick is locked/.test(r.why), "  the started game's pick changed: refused (409)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { winner: { [later]: { answer: "1", confidence: 2 } } } });
      check(r.status === 400 && r.why === "Use each confidence once", "  a confidence the kept pick has: refused (400)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { winner: { "zt-nothing": { answer: "1", confidence: 1 } } } });
      check(r.status === 400 && r.why === "Answer only for its games", "  a game the week hasn't got: refused (400)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { winner: { [later]: { answer: "20", confidence: 1 } } } });
      check(r.status === 400 && r.why === "Pick one of the sides", "  a side that isn't in that game: refused (400)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { winner: null } });
      check(r.ok && G.sameValue(await stored(), { "401909093": { answer: "20", confidence: 2 } }), "  taken back: only the game still to start's pick goes", JSON.stringify([r, await stored()]));
      await pool.query("DELETE FROM game_answers WHERE league_id = $1", [id]);
      r = await said({ episode: 1, answers: { winner: { "401909093": { answer: "20", confidence: 2 } } } });
      check(r.status === 409, "  a first pick for a game that's started: refused (409)", JSON.stringify(r));
      await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, 'ann', 'winner', 1, $2::jsonb), ($1, 'bo', 'winner', 1, $3::jsonb)", [
        id,
        JSON.stringify({ "401909093": { answer: "20", confidence: 2 }, [later]: { answer: "2", confidence: 1 } }),
        JSON.stringify({ "401909093": { answer: "5", confidence: 1 }, [later]: { answer: "1", confidence: 2 } }),
      ]);
      // The later game plays and is kept (the Hawks win): closed, graded game by game, each right pick its confidence.
      await pool.query("UPDATE season_events SET starts_at = $3 WHERE season_id = $1 AND event_id = $2", [season3, later, iso(-3 * 3600_000)]);
      await pool.query(
        "UPDATE sports_events SET starts_at = $2, state = 'post', final = true, final_at = $2, teams = $3::jsonb, lines = '{}'::jsonb, people = '{}'::jsonb, lines_at = now() WHERE provider = $1 AND event_id = $4",
        [P, iso(-3 * 3600_000), JSON.stringify([{ id: "1", score: 110 }, { id: "2", score: 101 }]), later]
      );
      g = await gameQuestions(user, season3, id, 1);
      w = win(g);
      const each = w?.verdict?.each ?? {};
      check(w?.status === "closed" && w.verdict?.state === "known" && G.sameValue(each["401909093"]?.right, ["20"]) && G.sameValue(each[later]?.right, ["1"]), "once its last game started it's closed; once both are final, known game by game", JSON.stringify(w?.verdict));
      const pts = Object.fromEntries((w?.people ?? []).map((x) => [x.playerId, x.earned]));
      check(pts.ann === 2 && pts.bo === 2 && g.points === 2, "  each right pick its confidence: ann's 76ers at 2, bo's Hawks at 2", JSON.stringify([pts, g.points]));
    }

    // L8 part 1's engine items, part 2: a bracket of a league's playoffs, a fifth season of the show made of them (a playoffs slate):
    // the two conference finals tomorrow (Episode 1, a game each here), the Finals in Episode 2, answered by ann's account through
    // answers.ts (the route's own code), then played and graded on the series.
    {
      const season5 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) SELECT id, 5, 'upcoming' FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      await pool.query("INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key) VALUES ($1, $2, 'basketball/nba', 2027, 'post', 'day', '[]'::jsonb, $3)", [season5, P, `${SLUG}-playoffs`]);
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 1, $2, 'listing'), ($1, 2, $3, 'listing')", [season5, iso(DAY), iso(3 * DAY)]);
      const teams = { 1: "Hawks", 2: "Celtics", 3: "Thunder", 4: "Spurs" };
      const side = (n) => ({ id: String(n), name: teams[n] });
      for (const [event, ep, at, a, b, note] of [["zt-po-e1", 1, DAY, 1, 2, "East Finals - Game 1"], ["zt-po-w1", 1, DAY + 3600_000, 3, 4, "West Finals - Game 1"], ["zt-po-f1", 2, 3 * DAY, 1, 3, "NBA Finals - Game 1"]]) {
        await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams, note) VALUES ($1, $2, $3, 'basketball/nba', $4, $5, $6::jsonb, $7)", [season5, ep, P, event, iso(at), JSON.stringify([side(a), side(b)]), note]);
        await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final) VALUES ($1, 'basketball/nba', $2, $3, 'pre', $4::jsonb, false)", [P, event, iso(at), JSON.stringify([{ id: String(a) }, { id: String(b) }])]);
      }
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 5);
      q.settings.game = null;
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const spec = defaultsFor("basketball", "nba").specs.bracket.spec;
      const wrong = S.setGame(q, spec, { ctx: specContextOf(nba, "nba", { playoffs: true }) });
      check(wrong.length === 0 && q.settings.game?.ask?.[0]?.asked === "once", "a bracket of the NBA's playoffs written as a league's own (the NBA's default, on its playoffs)", JSON.stringify(wrong));
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT playoffs', $1, 'ZTPOFF', $2) RETURNING id", [`${SLUG}-playoffs`, JSON.stringify(q)])).rows[0].id;
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'ann', 'member')", [id, USER]);
      await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 0, true)", [USER, season5]);
      const user = { id: USER, name: "zt each", email: "zt-stats-game@example.invalid" };
      const said = async (body) => {
        try {
          return { ok: !!(await answerQuestions(user, season5, id, body)) };
        } catch (e) {
          return { status: e.status, why: e.message };
        }
      };
      const bracketQ = (g) => g.questions.find((x) => x.id === "bracket");
      let w = bracketQ(await gameQuestions(user, season5, id));
      const named = (f) => f.map((x) => x.name).join("-");
      check(w?.status === "open" && w.draw?.first === 2 && w.draw.matches.map(named).join() === "Hawks-Celtics,Thunder-Spurs" && w.draw.entrants.length === 4 && w.draw.entrants.every((e) => e.enters === 2), "before they start: open, its draw the two conference finals by the teams' names", JSON.stringify(w && { status: w.status, draw: w.draw }));
      let r = await said({ episode: w?.episode ?? 0, answers: { bracket: { 2: ["1", "2"] } } });
      check(r.status === 400 && r.why === "Pick one winner of each match", "  both sides of a series picked: refused (400)", JSON.stringify(r));
      r = await said({ episode: w?.episode ?? 0, answers: { bracket: { 2: ["9"] } } });
      check(r.status === 400 && r.why === "Pick only who's in the draw", "  a team not in them: refused (400)", JSON.stringify(r));
      r = await said({ episode: w?.episode ?? 0, answers: { bracket: { 2: ["1", "3"], 1: ["1"] } } });
      const kept = (await pool.query("SELECT episode, answer FROM game_answers WHERE league_id = $1 AND player_id = 'ann' AND question = 'bracket'", [id])).rows;
      check(r.ok && kept.length === 1 && G.sameValue(kept[0].answer, { 2: ["1", "3"], 1: ["1"] }), "  a whole bracket: kept", JSON.stringify([r, kept]));
      await pool.query("INSERT INTO game_answers (league_id, player_id, question, episode, answer) VALUES ($1, 'bo', 'bracket', $2, $3::jsonb)", [id, kept[0]?.episode ?? 0, JSON.stringify({ 2: ["2", "3"], 1: ["3"] })]);
      // Played and kept: the Hawks and the Thunder through, the Hawks the champions.
      for (const [event, a, b, sa, sb, ago] of [["zt-po-e1", 1, 2, 110, 100, 3 * DAY], ["zt-po-w1", 3, 4, 120, 99, 3 * DAY], ["zt-po-f1", 1, 3, 101, 98, DAY]]) {
        await pool.query("UPDATE season_events SET starts_at = $3 WHERE season_id = $1 AND event_id = $2", [season5, event, iso(-ago)]);
        await pool.query("UPDATE sports_events SET starts_at = $2, state = 'post', final = true, final_at = $2, teams = $3::jsonb, lines = '{}'::jsonb, people = '{}'::jsonb, lines_at = now() WHERE provider = $1 AND event_id = $4", [P, iso(-ago), JSON.stringify([{ id: String(a), score: sa }, { id: String(b), score: sb }]), event]);
      }
      await pool.query("UPDATE season_episodes SET air_at = $3 WHERE season_id = $1 AND number = $2", [season5, 1, iso(-3 * DAY)]);
      await pool.query("UPDATE season_episodes SET air_at = $3 WHERE season_id = $1 AND number = $2", [season5, 2, iso(-DAY)]);
      await pool.query("UPDATE show_follows SET seen_through = 2 WHERE user_id = $1 AND season_id = $2", [USER, season5]);
      const g = await gameQuestions(user, season5, id, 2);
      w = bracketQ(g);
      const pts = Object.fromEntries((w?.people ?? []).map((x) => [x.playerId, x.earned]));
      check(w?.status === "closed" && w.verdict?.state === "known" && pts.ann === 4 && pts.bo === 1 && g.points === 4, "played: closed and known on the series, ann's bracket 4 (1 + 1, the champion 2), bo's 1", JSON.stringify({ status: w?.status, verdict: w?.verdict?.state, pts, mine: g.points }));
      r = await said({ episode: kept[0]?.episode ?? 0, answers: { bracket: { 2: ["1", "4"] } } });
      check(r.status === 409 || r.status === 403, "  changed once they've started: refused", JSON.stringify(r));
    }

    // L8 part 1's engine items: daily lineups inside a week's slate (closes 'game'), a fourth season of the show: its week the kept
    // 76ers opener (yesterday), a game going on now (the Hawks' and the Celtics') and one tomorrow (the 76ers' and the Cavaliers'
    // again). Ann's lineup, set before the game locked at each game's start, is two of the 76ers' (ann[0]) and a Hawk (ann[2]).
    {
      const season4 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, premiere_date, air_time, air_tz, status) SELECT id, 4, (now() AT TIME ZONE 'UTC')::date - 1, '12:00', 'UTC', 'airing' FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      await pool.query("INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key) VALUES ($1, $2, 'basketball/nba', 2027, 'regular', 'week', '[]'::jsonb, $3)", [season4, P, `${SLUG}-daily`]);
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 1, $2, 'listing'), ($1, 2, $3, 'listing')", [season4, iso(-DAY), iso(6 * DAY)]);
      const live = "zt-daily-live";
      const tom = "zt-daily-tom";
      const sixers = [{ id: "20", name: "76ers" }, { id: "5", name: "Cavaliers" }];
      for (const [event, at, teams] of [["401909093", -DAY, sixers], [live, -60_000, [{ id: "1", name: "Hawks" }, { id: "2", name: "Celtics" }]], [tom, DAY, sixers]]) {
        await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams) VALUES ($1, 1, $2, 'basketball/nba', $3, $4, $5::jsonb)", [season4, P, event, iso(at), JSON.stringify(teams)]);
      }
      await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final) VALUES ($1, 'basketball/nba', $2, $3, 'in', '[]'::jsonb, false), ($1, 'basketball/nba', $4, $5, 'pre', '[]'::jsonb, false)", [P, live, iso(-60_000), tom, iso(DAY)]);
      // Each one's team as the cast has it (season_cast's group): ann[2] a Hawk and bo[2] a Celtic, for the check.
      const teamOf = new Map([[ann[0], "76ers"], [ann[1], "76ers"], [ann[2], "Hawks"], [bo[0], "Cavaliers"], [bo[1], "Cavaliers"], [bo[2], "Celtics"]]);
      for (const id of [...ann, ...bo]) {
        await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, role, provider_ids) VALUES ($1, $2, $3, $4, $5::jsonb)", [season4, box.people[id].name, teamOf.get(id), null, JSON.stringify({ [P]: id })]);
      }
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 4);
      q.settings.game = null;
      for (const id of [...ann, ...bo]) S.addCastaway(q, box.people[id].name);
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const daily = {
        spec: 1, span: { from: 1, to: null }, pool: { of: "cast", where: null }, get: { by: "draft", each: 3, order: "snake", own: "exclusive" },
        count: { start: 2 }, score: { by: "stats", points: POINTS }, rank: { by: "total" }, closes: "game",
      };
      const wrong = S.setGame(q, daily, { ctx: specContextOf(nba) });
      check(wrong.length === 0 && q.settings.game?.closes === "game", "daily lineups (each locking at its own game's start), written as a league's own", JSON.stringify(wrong));
      const qid = (athlete) => q.castaways.find((c) => c.name === box.people[athlete].name).id;
      q.castaways.forEach((c, i) => { c.ownerIds = [i < 3 ? "ann" : "bo"]; });
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const qe1 = q.episodes.find((e) => e.number === 1);
      qe1.lineups = { ann: [qid(ann[0]), qid(ann[2])], bo: [qid(bo[0]), qid(bo[1])] };
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT daily lineups', $1, 'ZTDAYS', $2) RETURNING id", [`${SLUG}-daily`, JSON.stringify(q)])).rows[0].id;
      const readD = async () => readyLeague(id, (await leagueStates([id])).get(id));
      let s4 = await readD();
      let w1 = s4.episodes.find((e) => e.number === 1);
      const endOfDay = (ms) => Air.zonedToUtc(Air.addDays(Air.localDate(new Date(now + ms), "America/New_York"), 1), "00:00", "America/New_York").toISOString();
      check(Object.keys(w1.gameStarts ?? {}).sort().join() === ["401909093", live, tom].sort().join() && w1.gameStarts[live].at === iso(-60_000) && w1.gameStarts[live].until === endOfDay(-60_000), "a read stamps the week's games: each one's start and the end of its day in the East", JSON.stringify(w1.gameStarts));
      check(G.sameValue((w1.holdingGames?.[qid(ann[2])] ?? []), [live]) && G.sameValue([...(w1.holdingGames?.[qid(ann[0])] ?? [])].sort(), ["401909093", tom].sort()), "  and each holding's games, by its team", JSON.stringify(w1.holdingGames));
      check(!S.ActiveRosterLogic.isLineupLocked(s4, w1.id) && S.ActiveRosterLogic.heldLocked(w1, qid(ann[2])) && !S.ActiveRosterLogic.heldLocked(w1, qid(ann[0])), "the week open until its last game; the Hawk locked while their game is on today, yesterday's 76ers not");
      let why = null;
      await withLeagueLock(id, (st) => { why = S.ActiveRosterLogic.validateLineup(st, w1.id, "ann", [qid(ann[0]), qid(ann[1])]); });
      check(why === `${box.people[ann[2]].name}'s game has started: they stay in your lineup until the day's over`, "benching the Hawk mid-game: refused, as the write sees it", why);
      let set = false;
      await withLeagueLock(id, (st) => { set = S.ActiveRosterLogic.setLineup(st, w1.id, "ann", [qid(ann[1]), qid(ann[2])]); });
      const row = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
      const r1 = row.episodes.find((e) => e.number === 1);
      check(set && r1.lineupsAt?.ann?.length === 2 && G.sameValue(r1.lineupsAt.ann[1].ids, [qid(ann[1]), qid(ann[2])]) && !("gameStarts" in r1) && !("holdingGames" in r1), "swapping yesterday's 76er for another for tomorrow: saved with its time beside the lineup before it, none of the stamp", JSON.stringify(r1.lineupsAt));
      // Both games played and kept (tomorrow's as the opener's lines again, for the check): each game counts its own lineup.
      await pool.query("UPDATE sports_events SET state = 'post', final = true, final_at = now(), lines = '{}'::jsonb, people = '{}'::jsonb, lines_at = now() WHERE provider = $1 AND event_id = $2", [P, live]);
      await pool.query(
        "UPDATE sports_events t SET state = 'post', final = true, final_at = now(), teams = o.teams, lines = o.lines, people = o.people, shape = o.shape, lines_at = now() FROM sports_events o WHERE t.provider = $1 AND t.event_id = $2 AND o.provider = $1 AND o.event_id = '401909093'",
        [P, tom]
      );
      s4 = await readD();
      w1 = s4.episodes.find((e) => e.number === 1);
      const annDaily = cents(phoneOf(ann[0]) + phoneOf(ann[2]) + phoneOf(ann[1]) + phoneOf(ann[2]));
      const boDaily = cents(2 * (phoneOf(bo[0]) + phoneOf(bo[1])));
      check(!!w1.statGames && total(s4, "ann") === annDaily && total(s4, "bo") === boDaily, "the week: the opener for the lineup then, tomorrow's for the one set today (ann), bo's one lineup for both", `${total(s4, "ann")} vs ${annDaily}, ${total(s4, "bo")} vs ${boDaily}`);
      check(S.ActiveRosterLogic.isLineupLocked(s4, w1.id), "once its games are over: locked");
    }

    // L3 part 3b: an over/under on each game of a week's slate, a sixth season of the show: tomorrow's game with no line yet, one in
    // two days with ESPN's line, and one postponed (its start in twelve hours, before either), answered by ann's account.
    {
      const season6 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, premiere_date, air_time, air_tz, status) SELECT id, 6, (now() AT TIME ZONE 'UTC')::date - 1, '12:00', 'UTC', 'airing' FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      await pool.query("INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key) VALUES ($1, $2, 'basketball/nba', 2027, 'regular', 'week', '[]'::jsonb, $3)", [season6, P, `${SLUG}-lines`]);
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, 1, $2, 'listing'), ($1, 2, $3, 'listing')", [season6, iso(-DAY), iso(6 * DAY)]);
      const [ga, gb, gc] = ["zt-line-a", "zt-line-b", "zt-line-off"];
      for (const [event, at, teams, state, odds, called] of [
        [ga, DAY, [{ id: "1", name: "Hawks" }, { id: "2", name: "Celtics" }], "pre", null, null],
        [gb, 2 * DAY, [{ id: "3", name: "Thunder" }, { id: "4", name: "Spurs" }], "pre", { overUnder: 220.5, details: "OKC -4.5" }, null],
        [gc, 12 * 3600_000, [{ id: "20", name: "76ers" }, { id: "5", name: "Cavaliers" }], "post", { overUnder: 231 }, "postponed"],
      ]) {
        await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams, name) VALUES ($1, 1, $2, 'basketball/nba', $3, $4, $5::jsonb, $6)", [season6, P, event, iso(at), JSON.stringify(teams), `${teams[0].name} at ${teams[1].name}`]);
        await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, odds, odds_at, called) VALUES ($1, 'basketball/nba', $2, $3, $4, $5::jsonb, false, $6::jsonb, CASE WHEN $6::jsonb IS NULL THEN NULL ELSE now() END, $7)", [P, event, iso(at), state, JSON.stringify(teams.map((t) => ({ id: t.id }))), odds && JSON.stringify(odds), called]);
      }
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 6);
      q.settings.game = null;
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const pickem = defaultsFor("basketball").specs.pickem.spec;
      const spec = { ...pickem, ask: [{ id: "pts", ask: "Total points: over or under?", answer: "overUnder", settle: { by: "final", take: "total" }, points: 1, asked: "each", closes: "start", each: "game", line: "game" }] };
      const wrong = S.setGame(q, spec, { ctx: specContextOf(nba) });
      check(wrong.length === 0 && q.settings.game?.ask?.[0]?.line === "game", "an over/under on each game by its own line, written as a league's own", JSON.stringify(wrong));
      for (let n = 1; n <= 2; n++) S.ensureEpisodeNumber(q, n, false);
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT lines', $1, 'ZTLINE', $2) RETURNING id", [`${SLUG}-lines`, JSON.stringify(q)])).rows[0].id;
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'ann', 'member')", [id, USER]);
      await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 1, true)", [USER, season6]);
      const user = { id: USER, name: "zt each", email: "zt-stats-game@example.invalid" };
      const said = async (body) => {
        try {
          return { ok: !!(await answerQuestions(user, season6, id, body)) };
        } catch (e) {
          return { status: e.status, why: e.message };
        }
      };
      const kept = async () => Object.fromEntries((await pool.query("SELECT event_id, line::float8 AS line, read_at FROM question_lines WHERE league_id = $1", [id])).rows.map((r) => [r.event_id, r.line]));
      const pts = (g) => g.questions.find((x) => x.id === "pts");
      let g = await gameQuestions(user, season6, id);
      let w = pts(g);
      const lineOf = (w, e) => w?.games?.find((x) => x.id === e)?.line;
      check(w?.status === "open" && lineOf(w, gb) === 220.5 && lineOf(w, ga) === null && G.sameValue(await kept(), { [gb]: 220.5 }), "the week's over/under opens with each game's line as read then (kept), none yet for tomorrow's", JSON.stringify([w?.status, w?.games, await kept()]));
      const off = w?.games?.find((x) => x.id === gc);
      check(off?.started === true && off?.called === "postponed" && lineOf(w, gc) === null, "  the postponed game: locked, said why, no line kept for it", JSON.stringify(off));
      await pool.query("UPDATE sports_events SET odds = '{\"overUnder\": 230}'::jsonb, odds_at = now() WHERE provider = $1 AND event_id = $2", [P, gb]);
      g = await gameQuestions(user, season6, id);
      check(lineOf(pts(g), gb) === 220.5, "  ESPN's line moving after it opened changes nothing: the kept one stays", JSON.stringify(pts(g)?.games));
      let r = await said({ episode: 1, answers: { pts: { [ga]: "under" } } });
      check(r.status === 409 && r.why === "No line for Hawks at Celtics yet: pick it once there is one", "  a pick for the game with no line yet: refused (409)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { pts: { [gc]: "over" } } });
      check(r.status === 409 && r.why === "76ers at Cavaliers was postponed: its pick doesn't count either way", "  a pick for the postponed game: refused (409)", JSON.stringify(r));
      r = await said({ episode: 1, answers: { pts: { [gb]: "over" } } });
      check(r.ok, "  a pick for the game with its line: taken", JSON.stringify(r));
      // ESPN posts tomorrow's line: kept at the next read, its pick open.
      await pool.query("UPDATE sports_events SET odds = '{\"overUnder\": 210}'::jsonb, odds_at = now() WHERE provider = $1 AND event_id = $2", [P, ga]);
      r = await said({ episode: 1, answers: { pts: { [ga]: "under", [gb]: "over" } } });
      check(r.ok && G.sameValue(await kept(), { [gb]: 220.5, [ga]: 210 }), "  once its line's read: kept, and its pick taken", JSON.stringify([r, await kept()]));
      // The week's lock (a weekly one) is its first game played: the postponed one, twelve hours on, locks nothing.
      const locks = await sportLocks(pool, season6, "weekly");
      check(locks.get(1) === iso(DAY), "the week's lock: its first game played (tomorrow's), never the postponed one's start", JSON.stringify([...locks]));
      // Both played and kept: 205 under the kept 210, 230 over the kept 220.5 (ESPN's 230 would have been a push).
      for (const [event, sides] of [[ga, [{ id: "1", score: 100 }, { id: "2", score: 105 }]], [gb, [{ id: "3", score: 120 }, { id: "4", score: 110 }]]]) {
        await pool.query("UPDATE season_events SET starts_at = $3 WHERE season_id = $1 AND event_id = $2", [season6, event, iso(-3 * 3600_000)]);
        await pool.query("UPDATE sports_events SET starts_at = $2, state = 'post', final = true, final_at = $2, teams = $3::jsonb, lines = '{}'::jsonb, people = '{}'::jsonb, lines_at = now() WHERE provider = $1 AND event_id = $4", [P, iso(-3 * 3600_000), JSON.stringify(sides), event]);
      }
      g = await gameQuestions(user, season6, id, 1);
      w = pts(g);
      const each = w?.verdict?.each ?? {};
      check(w?.status === "closed" && w.verdict?.state === "known" && each[ga]?.line === 210 && each[gb]?.line === 220.5 && each[gc]?.state === "off" && each[gc]?.why === "The game was postponed: it doesn't count either way", "closed and known game by game: each on its kept line, the postponed one off", JSON.stringify(w?.verdict));
      check(g.points === 2, "  ann's two right: under 210, over 220.5", JSON.stringify(g.points));
    }

    // L3 part 3b: a team's matchup, a game an episode (a seventh season): Episode 1 the postponed opener (yesterday), Episode 2 a game
    // in six days with no line yet, Episode 3 one moved from its day, its over/under on the game's own line.
    {
      const season7 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, premiere_date, air_time, air_tz, status) SELECT id, 7, (now() AT TIME ZONE 'UTC')::date - 1, '12:00', 'UTC', 'airing' FROM shows WHERE slug = $1 RETURNING id", [SLUG])).rows[0].id;
      const at1 = Air.zonedToUtc(new Date(now - DAY).toISOString().slice(0, 10), "12:00", "UTC").getTime() - now;
      const [m1, m2, m3] = ["zt-m-off", "zt-m-next", "zt-m-moved"];
      const sides = [{ id: "20", name: "76ers" }, { id: "5", name: "Cavaliers" }];
      for (const [n, event, at, state, called] of [[1, m1, at1, "post", "postponed"], [2, m2, at1 + 7 * DAY, "pre", null], [3, m3, at1 + 14 * DAY, "pre", null]]) {
        await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, $2, $3, 'listing')", [season7, n, iso(at)]);
        await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams, name) VALUES ($1, $2, $3, 'basketball/nba', $4, $5, $6::jsonb, '76ers at Cavaliers')", [season7, n, P, event, iso(at), JSON.stringify(sides)]);
        await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, called) VALUES ($1, 'basketball/nba', $2, $3, $4, $5::jsonb, false, $6)", [P, event, iso(at), state, JSON.stringify(sides.map((t) => ({ id: t.id }))), called]);
      }
      await pool.query("INSERT INTO sports_matchups (season_id, provider, league, events, key) VALUES ($1, $2, 'basketball/nba', $3, $4)", [season7, P, [m1, m2, m3], `${SLUG}-matchup`]);
      const q = S.defaultState();
      S.updateSettings(q, "showId", SLUG);
      S.updateSettings(q, "wikiSeason", 7);
      q.settings.game = null;
      q.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
      S.updateSettings(q, "setupComplete", true);
      const pickem = defaultsFor("basketball").specs.pickem.spec;
      const wrong = S.setGame(q, { ...pickem, ask: [pickem.ask[0], { id: "pts", ask: "Total points: over or under?", answer: "overUnder", settle: { by: "final", take: "total" }, points: 1, asked: "each", closes: "start", line: "game" }] }, { ctx: specContextOf(nba) });
      check(wrong.length === 0, "a matchup's pick'em with an over/under on the game's own line, written as a league's own", JSON.stringify(wrong));
      for (let n = 1; n <= 3; n++) S.ensureEpisodeNumber(q, n, false);
      const id = (await pool.query("INSERT INTO leagues (name, slug, join_code, state) VALUES ('ZT matchup lines', $1, 'ZTMLIN', $2) RETURNING id", [`${SLUG}-mlines`, JSON.stringify(q)])).rows[0].id;
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'ann', 'member')", [id, USER]);
      await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 1, true)", [USER, season7]);
      const user = { id: USER, name: "zt each", email: "zt-stats-game@example.invalid" };
      const said = async (body) => {
        try {
          return { ok: !!(await answerQuestions(user, season7, id, body)) };
        } catch (e) {
          return { status: e.status, why: e.message };
        }
      };
      const s7 = await readyLeague(id, (await leagueStates([id])).get(id));
      const e1 = s7.episodes.find((e) => e.number === 1);
      check(e1.gameFinal === true && S.EpisodeLogic.hasResults(e1), "the postponed opener's episode has results (nothing happened): the week moves on past it", JSON.stringify({ gameFinal: e1.gameFinal, gameScore: e1.gameScore }));
      let g = await gameQuestions(user, season7, id);
      let w = g.questions.find((x) => x.id === "pts");
      check(g.episode === 2 && w?.status === "waiting" && w.line === null && g.questions.find((x) => x.id === "winner")?.status === "open", "this week's Episode 2: its over/under waiting for the game's line, who wins open", JSON.stringify([g.episode, w?.status, w?.line]));
      let r = await said({ episode: 2, answers: { pts: "over" } });
      check(r.status === 409 && r.why === "The line isn't out yet: you can answer once it is", "  answered before the line's out: refused (409)", JSON.stringify(r));
      await pool.query("UPDATE sports_events SET odds = '{\"overUnder\": 224.5}'::jsonb, odds_at = now() WHERE provider = $1 AND event_id = $2", [P, m2]);
      g = await gameQuestions(user, season7, id);
      w = g.questions.find((x) => x.id === "pts");
      r = await said({ episode: 2, answers: { pts: "over" } });
      check(w?.status === "open" && w.line === 224.5 && r.ok, "  once ESPN's line is read: open with it shown, and answered", JSON.stringify([w?.status, w?.line, r]));
      // Episode 3's game isn't on its day's scoreboard (moved): the daily job finds it on the 76ers' schedule, three days later.
      const movedTo = iso(at1 + 17 * DAY);
      const ev = (eid, at) => ({ id: eid, league: "basketball/nba", name: "76ers at Cavaliers", short: null, at, state: "pre", final: false, called: null, season: 2027, stage: "regular", note: null, competitors: sides.map((t, i) => ({ team: { id: t.id, name: t.name }, home: i === 1, score: null, winner: null })), parts: [], odds: null });
      const asked = [];
      const prov = {
        id: P, name: "ZT ESPN",
        eventsOn: async (league, d) => { asked.push(`day ${d}`); return []; },
        schedule: async (league, team) => { asked.push(`schedule ${team}`); return team === "20" ? [ev(m2, iso(at1 + 7 * DAY)), ev(m3, movedTo)] : null; },
        game: async () => null, calendar: async () => null, boxScore: async () => null,
      };
      const out = await refreshSportsEvents({ providers: [prov], now: new Date(at1 + 13 * DAY + now), only: [season7] });
      const at3 = (await pool.query("SELECT f.starts_at AS kept, e.starts_at AS linked, ep.air_at FROM sports_events f JOIN season_events e ON e.event_id = f.event_id JOIN season_episodes ep ON ep.season_id = e.season_id AND ep.number = e.episode WHERE f.provider = $1 AND f.event_id = $2 AND e.season_id = $3", [P, m3, season7])).rows[0];
      check(!out.errors.length && asked.filter((x) => x.startsWith("schedule")).length === 1 && [at3.kept, at3.linked, at3.air_at].every((d) => d.toISOString() === movedTo), "a game moved off its day: found on its team's schedule (one call), its new start kept, on its link and as its episode's air time", JSON.stringify({ out, asked, at3 }));
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
