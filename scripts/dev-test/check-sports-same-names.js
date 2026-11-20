// Dev-only check of players who share a name (docs/PLAN-sports-ready.md step 1.3, BACKLOG 145): a sport's people are unique by the
// provider's id (migration 0308), not by name, so two players with one name are two people everywhere a game reads them. Before
// it, a season's cast was unique by name and whichever team played first kept it: the other player couldn't be drafted, and
// scoring and locks that matched by name could hand one the other's lines or game.
//
// On nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN, the clock an hour before the week's first game;
// the recording has six such pairs, Justin Jefferson's among them), as zt-nfl-ann:
//   the season's people  every pair is two people, each with their own ESPN id, team and position
//   a game's people      the default season game (POST /api/sports/start's "season") has both of each pair, each linked to their
//                        own row (castaway.seasonCastId), each with their own position as the game reads it (cast-props.ts)
//   drafted apart        the draft opened and one of a pair picked: the other is still free (draft.ts startDraft, pickInDraft)
//   scored apart         the week played (the daily job each morning): each pair member who played has their own line on their
//                        own castaway as the game reads its lines (score.ts leagueGames), never the other's
//   a game log           the athlete sheet's (sports/player-log.ts), asked with their team: that player's games alone
//   locked apart         a game locking at each player's game (closes: 'game', the wizard's spec): each one held by their own
//                        team's game (air-times.ts stampGameLocks)
// Prints PASS/FAIL; its last line says whether repeated names are kept apart.
//
//   node scripts/dev-test/check-sports-same-names.js [--week=9] [--keep]
//
// Needs the local database (migration 0308 applied) and the NFL recording (see nfl-slate-fixture.js); no app server, never the
// real ESPN. Its rows are the fixture's (--keep leaves them). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const input = fx.recording().input;
  const week = fx.weeksOf(input).find((w) => w.n === WEEK);
  if (!week || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  // The recording's repeated names: each with its two (or more) players, their ids, teams and positions.
  const byName = new Map();
  for (const t of input.teams) for (const p of t.roster ?? []) (byName.get(p.name.toLowerCase()) ?? byName.set(p.name.toLowerCase(), []).get(p.name.toLowerCase())).push({ id: String(p.id), name: p.name, team: t.name, teamId: t.id, abbr: p.abbr });
  const pairs = [...byName.values()].filter((l) => l.length > 1);
  fact(`the recording's repeated names: ${pairs.map((l) => `${l[0].name} (${l.map((p) => `${p.team.split(" ").at(-1)} ${p.abbr}`).join(", ")})`).join("; ")}`);

  const w = await fx.up({ at: new Date(Date.parse(week.first) - 3600_000).toISOString() });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { leagueGames } = fx.app("../../src/lib/server/sports/score.ts");
    const { startDraft, pickInDraft } = fx.app("../../src/lib/server/draft.ts");
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    // The week played (the daily job each morning): its finals kept, and every team's people in (a team on a bye that week is
    // linked a few days on, by the slate's sync).
    await w.days(new Date(Date.parse(week.last) + 8 * 3600_000).toISOString());
    const { rows: cast } = await w.pool.query("SELECT id, name, tribe_name, role, provider_ids->>'espn' AS espn FROM season_cast WHERE season_id = $1", [w.seasonId]);
    const rowOf = new Map(cast.map((r) => [r.espn, r]));
    const kept = pairs.filter((l) => l.every((p) => rowOf.has(p.id)));
    check(kept.length === pairs.length, `every repeated name is ${pairs[0]?.length ?? 2} people in the season, each by their ESPN id (${kept.length} of ${pairs.length} pairs)`, pairs.filter((l) => !kept.includes(l)).map((l) => l[0].name));
    check(kept.every((l) => l.every((p) => rowOf.get(p.id).tribe_name === p.team && rowOf.get(p.id).role === (p.abbr ?? "").toUpperCase())), "each one with their own team and position");

    // The default season game.
    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const state = await readyLeague(s.leagueId, await w.league(s.leagueId));
    const castawayOf = new Map(state.castaways.filter((c) => c.seasonCastId).map((c) => [c.seasonCastId, c]));
    const inGame = kept.filter((l) => l.every((p) => castawayOf.has(rowOf.get(p.id).id)));
    check(inGame.length === kept.length, `the season game has both of each pair, each linked to their own row (${inGame.length} of ${kept.length})`);
    const roleRight = inGame.every((l) => l.every((p) => state.castProps?.[castawayOf.get(rowOf.get(p.id).id).id]?.position === (p.abbr ?? "").toUpperCase()));
    check(roleRight, "each one's position, as the game reads it, is their own");

    // Drafted apart: one of a pair picked, the other still free.
    const pair = inGame.find((l) => l.length === 2) ?? inGame[0];
    if (pair) {
      const [a, b] = pair.map((p) => castawayOf.get(rowOf.get(p.id).id));
      const seat = state.players[0].id;
      const actor = { user: w.users.ann, membership: { role: "commissioner", playerId: seat } };
      await startDraft(actor, s.leagueId);
      await pickInDraft(actor, s.leagueId, a.id);
      const after = await w.league(s.leagueId);
      const owners = (c) => after.castaways.find((x) => x.id === c.id)?.ownerIds ?? [];
      check(owners(a).includes(seat) && owners(b).length === 0, `drafted apart: ${pair[0].name} of the ${pair[0].team} picked, the ${pair[1].team}' still free`, { a: owners(a), b: owners(b) });
    }

    // Scored apart: each one's line on their own castaway (the game's own adds derived stats: compare the final's counts).
    const { rows: finals } = await w.pool.query(
      `SELECT f.lines FROM season_events e JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id WHERE e.season_id = $1 AND e.episode = $2 AND f.final AND f.lines IS NOT NULL`,
      [w.seasonId, WEEK]
    );
    const lineOf = (espn) => finals.map((f) => f.lines?.[espn]).find(Boolean) ?? null;
    const fresh = await readyLeague(s.leagueId, await w.league(s.leagueId));
    const lines = (await leagueGames(fresh))?.lines.get(WEEK) ?? {};
    const played = inGame.flatMap((l) => l.map((p) => ({ p, line: lineOf(p.id), castaway: castawayOf.get(rowOf.get(p.id).id) }))).filter((x) => x.line);
    const own = played.filter((x) => Object.entries(x.line).every(([k, v]) => lines[x.castaway.id]?.[k] === v));
    fact(`${played.length} of the pairs' players have a line in ${week.label} (${played.map((x) => `${x.p.name} ${x.p.team.split(" ").at(-1)}`).join(", ")})`);
    check(played.length > 0 && own.length === played.length, `scored apart: each one's ${week.label} line is on their own castaway (${own.length} of ${played.length})`, played.filter((x) => !own.includes(x)).map((x) => ({ who: `${x.p.name} ${x.p.team}`, espn: x.p.id, want: x.line, got: lines[x.castaway.id] ?? null, castaway: x.castaway.id, row: rowOf.get(x.p.id)?.id })));

    // A player's game log (the athlete sheet's: sports/player-log.ts), asked with their team: only their own games.
    await fx.app("../../src/lib/server/sports/stats.ts").statsFromEvents(w.seasonId, { providers: w.providers });
    const { playerLog } = fx.app("../../src/lib/server/sports/player-log.ts");
    const logs = [];
    for (const x of played) logs.push({ x, mine: await playerLog(w.users.ann, w.seasonId, x.p.name, x.p.team), any: await playerLog(w.users.ann, w.seasonId, x.p.name) });
    fact(`game logs by name alone: ${logs.map((l) => `${l.x.p.name} ${[...new Set(l.any.games.map((g) => g.team))].join(" + ")}`).join("; ")}`);
    check(logs.length > 0 && logs.every((l) => l.mine.games.length > 0 && l.mine.games.every((g) => g.team === l.x.p.team)), `a game log asked with the team is that player's alone (${logs.length} players)`);

    // Locked apart: a game locking at each player's game, the week after.
    const next = fx.weeksOf(input).find((x) => x.n === WEEK + 1);
    const spec = { ...structuredClone(S.gameOf(fresh)), span: { from: WEEK + 1, to: w.slate.episodes }, closes: "game" };
    const g = await startFromSpec(w.users.ann, w.seasonId, w.couchId, { spec, name: "ZT locks at each game", tell: false }, new Date());
    const gs = await readyLeague(g.leagueId, await w.league(g.leagueId));
    const ep = gs.episodes.find((e) => e.number === WEEK + 1);
    const gc = new Map(gs.castaways.filter((c) => c.seasonCastId).map((c) => [c.seasonCastId, c]));
    const gameOfTeam = (teamId) => next.games.find((x) => x.home === teamId || x.away === teamId)?.id ?? null;
    const locks = inGame.flatMap((l) => l.map((p) => ({ p, held: ep?.holdingGames?.[gc.get(rowOf.get(p.id).id)?.id] ?? [], want: gameOfTeam(p.teamId) })));
    const right = locks.filter((x) => (x.want ? x.held.length === 1 && x.held[0] === x.want : x.held.length === 0));
    check(!!ep?.holdingGames && right.length === locks.length, `locked apart: each one held by their own team's ${next.label} game (${right.length} of ${locks.length})`, locks.filter((x) => !right.includes(x)).map((x) => `${x.p.name} ${x.p.team}: ${x.held} want ${x.want}`));

    console.log(failures ? "VERDICT (145): NOT YET: players who share a name are still mixed up somewhere above" : "VERDICT (145): players who share a name are two people: kept, drafted, scored and locked apart");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
