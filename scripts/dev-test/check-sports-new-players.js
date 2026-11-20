// Dev-only check of who reaches a running sports game (docs/PLAN-sports-ready.md, Phase 0 (b), then Phase 1.4's fix): a slate's
// people come from the teams' rosters (cast.ts castFromEvents), but a game's people are its own copy, taken from the season's
// approved cast when it starts (new-game.ts makeLeague: approvedCastFor) and pushed again only by the desk's cast edits
// (season-cast.ts applyApprovedCastToLeagues). Can a player a team signs after the slate's games have started reach a game that's
// running, so someone can claim him?
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN, the clock an hour before the week's first game):
//   a season filled before 220     the season's approval taken away, as every sports season filled before 2026-11-19 is: a game
//                                  started on it takes its people all the same (new-game.ts approves a sport's at the start)
//   as the sports route starts it  the default season game and Best Ball started through start.ts startSport (POST
//                                  /api/sports/start's own function) on the slate as it's made: how many people each has, and
//                                  whether the Commissioner's Start opens the draft (draft.ts startDraft); and the same season
//                                  game as the wizard starts it (start-spec.ts startFromSpec, POST /api/seasons/[id]/start's)
//   a game running                 the same season game (its people approved as they were filled: BACKLOG 220): then the
//                                  week starts, a team signs "ZT Signing" (the stand-in's roster), and production's paths run over
//                                  the rest of the week: the daily job each morning (its slate sync), then the Players tab's read
//                                  (rosters.ts rosterOf: it fills the season's people again once a game has ended since the last fill)
//   where he lands                 the season's people, and the running game's people (who a waiver claim or a draft can name)
//   a trade (step 1.4)             a receiver on a team in the next week's first game traded to a Sunday team: the daily job's
//                                  roster refresh moves him in the season's people and the running game, and his lock in a game
//                                  locking at each player's game follows him (held by the Sunday game)
// What's asserted: a game started on a slate has the slate's people to draft, and a signing reaches the running game. Phase 0
// (2026-11-19) found both failing (BACKLOG 220): a game started through the sports route or the wizard got nobody at all (its draft
// said "Add the cast first"), since nothing approved a slate's people, and with them approved by hand a later signing (or a team on
// a bye that week) reached the season's people but never the game. Phase 1's step 1.0 made it pass the same day: a sport's people
// are approved as they're filled (and at a game's start, for a season filled before), and each fill's new people go into every game
// on the season. Its last line says which.
//
//   node scripts/dev-test/check-sports-new-players.js [--week=9] [--keep]
//
// --week: a week the recording has played (the 2026-11-15 recording's are 1 to 9). Needs the local database and the NFL recording
// (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the fixture's (--keep leaves them; the next run
// removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const HOUR = 3600_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || !week.games.length || week.games.some((g) => g.state !== "post")) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  const w = await fx.up({ at: new Date(Date.parse(week.first) - HOUR).toISOString() });
  try {
    const { startDraft } = fx.app("../../src/lib/server/draft.ts");
    const { rosterOf } = fx.app("../../src/lib/server/rosters.ts");
    const seasonPeople = async () => (await w.pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [w.seasonId])).rows[0].n;
    const open = async (leagueId) => {
      const st = await w.league(leagueId);
      try {
        await startDraft({ user: w.users.ann, membership: { role: "commissioner", playerId: st.players[0].id } }, leagueId);
        return "opened";
      } catch (e) {
        return `refused: ${e.message}`;
      }
    };
    const people = await seasonPeople();
    fact(`the slate: ${w.slate.name}, ${w.slate.episodes} weeks; ${people} people from the teams' rosters; the clock an hour before ${week.label}`);

    // A season filled before BACKLOG 220 (never approved), as every sports season in production was: a game started on it.
    await w.unapprove();
    const before = await w.start("ann", { seasonId: w.seasonId, game: "short", tell: false });
    const beforePeople = (await w.league(before.leagueId)).castaways.length;
    check(beforePeople === people, `a season filled before BACKLOG 220 (never approved): a game started on it takes its people (${beforePeople} of ${people})`);

    // As the sports route starts it.
    let seasonSpec = null;
    for (const game of ["season", "bestBall"]) {
      const s = await w.start("ann", { seasonId: w.seasonId, game, tell: false });
      const st = await w.league(s.leagueId);
      if (game === "season") seasonSpec = fx.app("../../src/lib/game/state-logic.js").gameOf(st);
      check(st.castaways.length > 0, `the sports route's "${game}" game has the slate's people to draft (${st.castaways.length} of ${people})`);
      const draft = await open(s.leagueId);
      check(draft === "opened", `its draft opens (${draft})`);
    }
    // And as the wizard starts the same rules (POST /api/seasons/[id]/start's own function).
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const wz = await startFromSpec(w.users.ann, w.seasonId, w.couchId, { spec: { ...seasonSpec, span: { from: WEEK, to: w.slate.episodes } }, name: "ZT wizard season", tell: false }, new Date());
    const wzPeople = (await w.league(wz.leagueId)).castaways.length;
    check(wzPeople > 0, `the wizard's season game has the slate's people to draft (${wzPeople} of ${people})`);

    // The season game started; the week under way.
    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const atStart = (await w.league(s.leagueId)).castaways.length;
    check(atStart === (await seasonPeople()), `the season game starts with all the season's people (${atStart})`);
    w.advance(new Date(Date.parse(week.first) + HOUR).toISOString());
    const later = week.games[week.games.length - 1];
    const team = w.input.teams.find((t) => t.id === later.home);
    team.roster.push({ id: "zt-nfl-signing-1", name: "ZT Signing", position: "Wide Receiver", abbr: "WR", headshot: "https://a.espncdn.com/i/headshots/nophoto.png" });
    fact(`${week.label} has started (${week.games[0].name}); the ${team.name} sign ZT Signing (their game: ${later.name})`);

    // Production's paths over the rest of the week: the daily job each morning, then the Players tab's read.
    const errors = await w.days(new Date(Date.parse(week.last) + 8 * HOUR).toISOString());
    const inSeason = async () => (await w.pool.query("SELECT 1 FROM season_cast WHERE season_id = $1 AND provider_ids->>'espn' = 'zt-nfl-signing-1'", [w.seasonId])).rows.length > 0;
    const afterDaily = await inSeason();
    fact(`after the week's daily runs (${errors.length} errors): in the season's people? ${afterDaily}`);
    const roster = await rosterOf(w.users.ann, w.seasonId, undefined, w.espn.url);
    await w.settle();
    const afterRead = await inSeason();
    fact(`after the Players tab's read (${roster.people?.length ?? roster.groups?.reduce?.((n, g) => n + g.people.length, 0) ?? "?"} shown): in the season's people? ${afterRead}`);
    check(afterDaily, "the daily job's roster refresh brings the signing into the season's people (step 1.4: no Players tab read needed)");
    const st = await w.league(s.leagueId);
    const inGame = st.castaways.some((c) => c.name === "ZT Signing");
    // Anyone else the season gained after the game started: a team on a bye that week, linked (and filled) only later.
    const { rows: gained } = await w.pool.query("SELECT tribe_name, count(*)::int AS n FROM season_cast WHERE season_id = $1 AND NOT (lower(name) = ANY($2::text[])) GROUP BY 1 ORDER BY 2 DESC", [
      w.seasonId,
      st.castaways.map((c) => c.name.toLowerCase()),
    ]);
    fact(`the season's people now ${await seasonPeople()}, the game's ${st.castaways.length}; the season gained after its start: ${gained.map((g) => `${g.tribe_name} ${g.n}`).join(", ") || "nobody"}`);
    check(inGame, `the signing reaches the running season game's people, so a claim can name him (${st.castaways.length} there)`);

    // A trade (step 1.4): a receiver on a team in next week's first game goes to a team that plays on the Sunday.
    const next = fx.weeksOf(w.input).find((x) => x.n === WEEK + 1);
    const early = next.games[0];
    const late = next.games.find((g) => Date.parse(g.at) - Date.parse(early.at) > 2 * 24 * HOUR && ![g.home, g.away].includes(early.home) && ![g.home, g.away].includes(early.away));
    const from = w.input.teams.find((t) => t.id === early.home);
    const to = w.input.teams.find((t) => t.id === late.home);
    const player = from.roster.find((r) => r.abbr === "WR");
    from.roster = from.roster.filter((r) => r !== player);
    to.roster.push(player);
    fact(`the ${from.name} trade ${player.name} to the ${to.name} (${next.label}: ${early.name}, then ${late.name})`);
    await w.days(new Date(Date.parse(week.last) + 2 * 24 * HOUR + 8 * HOUR).toISOString());
    const { rows: tradedRow } = await w.pool.query("SELECT id, tribe_name FROM season_cast WHERE season_id = $1 AND provider_ids->>'espn' = $2", [w.seasonId, String(player.id)]);
    check(tradedRow[0]?.tribe_name === to.name, `the daily job's roster refresh moves him to the ${to.name} in the season's people (${tradedRow[0]?.tribe_name})`);
    const after = await w.league(s.leagueId);
    const him = after.castaways.find((c) => c.seasonCastId === tradedRow[0]?.id);
    const teamName = (c) => after.tribes.find((t) => t.id === c?.tribeId)?.name;
    check(teamName(him) === to.name, `in the running season game he's a ${to.name.split(" ").at(-1)} now (${teamName(him)})`);
    const { startFromSpec: start } = fx.app("../../src/lib/server/start-spec.ts");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const S = fx.app("../../src/lib/game/state-logic.js");
    const spec = { ...structuredClone(S.gameOf(after)), span: { from: WEEK + 1, to: w.slate.episodes }, closes: "game" };
    const lg = await start(w.users.ann, w.seasonId, w.couchId, { spec, name: "ZT locks at each game", tell: false }, new Date());
    const ls = await readyLeague(lg.leagueId, await w.league(lg.leagueId));
    const lc = ls.castaways.find((c) => c.seasonCastId === tradedRow[0]?.id);
    const held = ls.episodes.find((e) => e.number === WEEK + 1)?.holdingGames?.[lc?.id] ?? [];
    check(held.length === 1 && held[0] === late.id, `his lock follows him: held by ${late.name}, not ${early.name} (${held.join(", ") || "none"})`);

    const routeGetsNobody = wzPeople === 0;
    console.log(
      inGame && !failures
        ? "VERDICT (b): STRUCK: a player signed or traded after the slate's games start reaches a running game, on his new team"
        : `VERDICT (b): CONFIRMED: a player signed after the slate's games start never reaches a running game${routeGetsNobody ? "; wider: a game started through the sports route or the wizard gets nobody at all (nothing approves a slate's people: BACKLOG 220)" : ""}`
    );
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
