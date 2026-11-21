// Dev-only check of whose players a sports game offers (the user, 2026-11-21: a game's players are its scope's). On nfl-slate-fixture.js
// with its stand-in postseason, the clock an hour before Week 15's first game, through the app's own functions (the sports route's
// start, a league's read, the questions' faces, Game settings), every seat but the maker's a computer player:
//   a team's season    a draft on the Bills' season picks from the Bills' players only (pool.where.teams, its words say so); the
//                      computer players draft only Bills
//   one game           a draft on one Bills game (it goes on the Bills' season) picks from that game's two teams
//   moved              Game settings moves that one game's end to the season's end: it picks from the Bills' alone; back to one game,
//                      the two teams again
//   a question         Pick a few on the Bills' season (a question each game, no pool): each game's question names only the players
//                      in that game (ep.playingTeams), never an opponent from another week
//   a league's slate   a draft on the slate is the whole league's; a question about a week names only teams playing that week (byes
//                      out)
//   too big            Best Ball on a team's season (15 each, a couch of eight: more than one team's players) is refused with "make it
//                      shared"
//
//   node scripts/dev-test/check-sports-scope.js [--keep]
//
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the
// fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const keep = process.argv.includes("--keep");
const BOTS = 3;
const HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
const BILLS = "2";

(async () => {
  const rec = fx.recording().input;
  const weeks = fx.weeksOf(rec);
  const w15 = weeks.find((x) => x.n === 15);
  const w = await fx.up({ at: iso(Date.parse(w15.first) - HOUR), postseason: true, people: 8 });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const Spec = fx.app("../../src/lib/game/game-spec/index.js");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const { backstageScope } = fx.app("../../src/lib/server/backstage.ts");
    const { settingsWrite } = fx.app("../../src/lib/server/backstage-games.ts");
    const read = async (id) => readyLeague(id, await w.league(id));
    const billsGame = w15.games.find((g) => g.home === BILLS || g.away === BILLS);
    const pair = [billsGame.home, billsGame.away].sort();
    fact(`the Bills' Week 15 game: ${billsGame.name} (${pair.join(" v ")})`);

    // Each castaway's team id, by their group's name as the season's linked games name the teams (the server's statTeams, worked out
    // here from the rows so the check doesn't lean on the stamp it checks).
    const teamIdsOf = async (seasonId) => {
      const { rows } = await w.pool.query("SELECT DISTINCT jsonb_array_elements(teams) AS t FROM season_events WHERE season_id = $1", [seasonId]);
      return new Map(rows.map((r) => [String(r.t.name).toLowerCase(), String(r.t.id)]));
    };
    const teamsOfOffered = async (state, seasonId, list) => {
      const ids = await teamIdsOf(seasonId);
      const tribes = new Map((state.tribes ?? []).map((t) => [t.id, String(t.name).toLowerCase()]));
      const byId = new Map(state.castaways.map((c) => [c.id, c]));
      return [...new Set(list.map((x) => ids.get(tribes.get(byId.get(typeof x === "string" ? x : x.id)?.tribeId)) ?? "?"))].sort();
    };
    const start = async (name, body) => {
      const s = await w.start("ann", { tell: false, bots: BOTS, name, ...body });
      // A team's season made just now fills its players after the start (as in production): wait for it.
      await w.settle(s.seasonId);
      return { ...s, name };
    };
    const draftOut = async (s) => {
      await withLeagueLock(s.leagueId, (x) => {
        x.players.forEach((p) => (p.automated = true));
        if (S.gameOf(x).get.by === "draft") S.DraftLogic.forceStart(x);
      });
      let st = await read(s.leagueId);
      for (let i = 0; i < 30 && !S.DraftLogic.currentTurn(st)?.isComplete; i++) st = await read(s.leagueId);
      return st;
    };

    // ---- A team's season: the Bills' players only ----
    const season = await start("ZT bills draft", { league: fx.LEAGUE, team: BILLS, whole: "season", game: "short" });
    let st = await read(season.leagueId);
    fact(`the Bills' season: ${(await w.pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [season.seasonId])).rows[0].n} people listed, ${st.castaways.length} in the game; its pool ${JSON.stringify(S.gameOf(st).pool)}`);
    const where = S.gameOf(st).pool?.where ?? null;
    check(JSON.stringify(where?.teams) === JSON.stringify([BILLS]), `a draft on the Bills' season picks from the Bills' alone (pool.where ${JSON.stringify(where)})`);
    const offered = S.PoolLogic.offered(st);
    check(offered.length > 20 && JSON.stringify(await teamsOfOffered(st, season.seasonId, offered)) === JSON.stringify([BILLS]), `the draft offers ${offered.length} people, all Bills (of ${st.castaways.length} on the season)`);
    const said = Spec.describeSpec(S.gameOf(st), { teamList: [{ id: BILLS, name: "Buffalo Bills" }] });
    check([said.short?.line, ...(said.rules ?? [])].join(" ").includes("Buffalo Bills"), `its words say whose: "${[said.short?.line, ...(said.rules ?? [])].find((x) => x && x.includes("Buffalo Bills")) ?? said.short?.line}"`);
    st = await draftOut(season);
    const held = st.castaways.filter((c) => (c.ownerIds ?? []).length).map((c) => c.id);
    check(held.length === (BOTS + 1) * 3 && JSON.stringify(await teamsOfOffered(st, season.seasonId, held)) === JSON.stringify([BILLS]), `the draft done: ${held.length} drafted, every one a Bill`);

    // ---- One game: its two teams ----
    const one = await start("ZT bills one game", { league: fx.LEAGUE, team: BILLS, games: [billsGame.id], game: "short" });
    check(one.seasonId === season.seasonId, "one Bills game goes on the Bills' season");
    st = await read(one.leagueId);
    check(JSON.stringify([...(S.gameOf(st).pool?.where?.teams ?? [])].sort()) === JSON.stringify(pair), `a draft on one game picks from its two teams (${JSON.stringify(S.gameOf(st).pool?.where)})`);
    const oneOffered = S.PoolLogic.offered(st);
    check(JSON.stringify(await teamsOfOffered(st, one.seasonId, oneOffered)) === JSON.stringify(pair), `it offers ${oneOffered.length} people, all on the two teams`);

    // ---- Moved: Game settings' How long ----
    const scope = await backstageScope(w.users.ann, one.seasonId, w.couchId);
    const last = S.lastEpisode(st) ?? null;
    const regular = (await w.pool.query("SELECT regular_through FROM sports_matchups WHERE season_id = $1", [one.seasonId])).rows[0]?.regular_through;
    await settingsWrite(scope, one.leagueId, { set: { endEpisode: regular } });
    st = await read(one.leagueId);
    check(JSON.stringify(S.gameOf(st).pool?.where?.teams) === JSON.stringify([BILLS]) && S.endEpisode(st) === regular, `its end moved to the regular season's (game ${S.endEpisode(st)}): the Bills' players alone (${JSON.stringify(S.gameOf(st).pool?.where)})`);
    await settingsWrite(scope, one.leagueId, { set: { endEpisode: S.startEpisode(st) } });
    st = await read(one.leagueId);
    check(JSON.stringify([...(S.gameOf(st).pool?.where?.teams ?? [])].sort()) === JSON.stringify(pair), `back to one game: its two teams again (${JSON.stringify(S.gameOf(st).pool?.where)})`);
    void last;

    // ---- A question: each game's players ----
    const few = await start("ZT bills pick a few", { league: fx.LEAGUE, team: BILLS, whole: "season", game: "pickAFew" });
    st = await read(few.leagueId);
    check(!S.gameOf(st).pool?.where?.teams, `Pick a few has no teams of its own (it asks a question each game: ${JSON.stringify(S.gameOf(st).pool)})`);
    const q = S.AnswerLogic.questions(st)[0];
    const from = S.startEpisode(st);
    const eps = [from, from + 1].filter((n) => st.episodes.some((e) => e.number === n));
    for (const n of eps) {
      const faces = S.AnswerLogic.faces(st, q, { playerId: st.players[0].id, episode: n });
      const teams = await teamsOfOffered(st, few.seasonId, faces);
      const ep = st.episodes.find((e) => e.number === n);
      check(teams.length === 2 && teams.includes(BILLS) && faces.length < st.castaways.length / 4, `game ${n}'s question (${ep.title ?? ""}) names ${faces.length} people, of its two teams (${teams.join(" v ")}), of ${st.castaways.length}`, ep.playingTeams);
    }
    const noEp = S.AnswerLogic.faces(st, q, { playerId: st.players[0].id });
    fact(`without an episode (a question asked once): ${noEp.length} people`);

    // ---- A league's slate ----
    const slate = await start("ZT slate draft", { seasonId: w.seasonId, game: "short", only: true });
    st = await read(slate.leagueId);
    check(!S.gameOf(st).pool?.where?.teams, `a draft on the league's slate isn't limited (${S.PoolLogic.offered(st).length} offered of ${st.castaways.length})`);
    const pick = await start("ZT slate pickem", { seasonId: w.seasonId, game: "pickem" });
    st = await read(pick.leagueId);
    const w15ep = st.episodes.find((e) => e.number === 15);
    fact(`the slate's Week 15 plays ${w15ep?.playingTeams?.length ?? 0} teams${w15ep?.byeTeams ? `, ${w15ep.byeTeams.length} on a bye` : ""}`);
    check((w15ep?.playingTeams?.length ?? 0) === w15.games.length * 2, `the slate's Week 15 stamps its teams playing: ${w15ep?.playingTeams?.length} (${w15.games.length} games)`);

    // ---- Too big for one team ----
    let refusal = null;
    try {
      await start("ZT bills best ball", { league: fx.LEAGUE, team: BILLS, whole: "season", game: "bestBall" });
    } catch (e) {
      refusal = e.message;
    }
    check(!!refusal && /shared/.test(refusal), `Best Ball on the Bills' season (15 each, a couch of eight) is refused: "${refusal}"`);
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  if (failures) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
