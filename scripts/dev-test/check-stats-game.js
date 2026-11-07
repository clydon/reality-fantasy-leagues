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
// or a first pick there refused), the confidences each once, then closed at its last game and graded game by game.
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
const { sportOf, storedGame, storedCard, defaultsFor, specContextOf } = jiti("../../src/lib/sports/index.ts");
const Sq = require("../../src/lib/game/sequence/squares.js");
const G = require("../../src/lib/game/game-spec/index.js");
const USOPEN = require("../../tests/fixtures/espn/atp-189-2026.json");
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
