import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pickedKindOf, type CallGame } from "@/lib/sports/fan-call";
import { scheduleOf } from "@/lib/sports/teams";
import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { requireCouch } from "../couches";
import { joinGame } from "../couch-joins";
import { answerQuestions } from "../answers";
import { seasonGames } from "./find";
import { sportsProviders } from "./index";
import { startSport } from "./start";
import { couchTeams } from "./team-follows";
import type { SportsProvider } from "./types";

// A fan's call on the couch (docs/PLAN-sports-couch.md C2; docs/design-round/lone-fan-spec.md): one game a game of a couch team's
// that isn't a rivalry, Pick'em on that one game with its picks public as they're made (src/lib/sports/fan-call.ts CALL_SPEC),
// started quietly by a fan's call (a follower on the couch of either team), on the home team's season as C1's rivalry is. Anyone
// else backs or fades the call: a pick of a side. A call stands once anyone else has picked. No push. A game is a call's by its spec.
//
//   GET  /api/sports/calls?couch=&league=&teams=   this season's call and rivalry games on the couch in the league, each with its
//        picks (sides only: never a rivalry's margin) and, once final, its winner; `teams` (the couch's teams there, as the table
//        asks for them) are the schedules the finals are read from (the provider's cached schedules: no new kind of ESPN call)
//   POST /api/sports/calls?couch=                  { league, event, team, side | null }: your call, back or fade (null takes it
//        back), starting the game on a fan's first call and joining you to it

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const ID = /^[\w.-]{1,40}$/;

type Opts = { providers?: SportsProvider[]; now?: Date };

/** The couch's call and rivalry games in a league this season, with every winner pick (public in both). */
export async function couchPicked(couchId: string, league: string, event: string | null, now: Date): Promise<CallGame[]> {
  const { rows } = await pool.query(
    `SELECT l.id AS league_id, l.state, ss.id AS season_id, e.event_id, e.episode, e.starts_at
       FROM leagues l ${LEAGUE_SEASON_JOIN}
       JOIN season_events e ON e.season_id = ss.id
      WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND l.state->'settings'->>'archivedAt' IS NULL AND e.league = $2
        AND ($3::text IS NULL OR e.event_id = $3)
        AND e.starts_at > $4::timestamptz - interval '240 days' AND e.starts_at < $4::timestamptz + interval '15 days'
      ORDER BY l.created_at`,
    [couchId, league, event, now.toISOString()]
  );
  const games = new Map<string, CallGame & { episode: number }>();
  for (const r of rows) {
    const state = r.state as LeagueState;
    const kind = pickedKindOf({ ask: StateLogic.AnswerLogic.questions(state) });
    if (!kind) continue;
    const from = StateLogic.startEpisode(state);
    const to = StateLogic.endEpisode(state);
    if ((from != null && r.episode < from) || (to != null && r.episode > to)) continue;
    // One a meeting and kind: the first made.
    const key = `${kind}:${r.event_id}`;
    if (games.has(key)) continue;
    const at = r.starts_at ? new Date(r.starts_at).toISOString() : null;
    games.set(key, { event: r.event_id, kind, leagueId: r.league_id, seasonId: r.season_id, episode: r.episode, at, begun: !!at && Date.parse(at) <= now.getTime(), picks: [], winner: null, teams: null });
  }
  if (!games.size) return [];
  const list = [...games.values()];
  const { rows: answers } = await pool.query(
    `SELECT a.league_id, a.answer, m.user_id, COALESCE(u.username, u.name) AS who
       FROM game_answers a
       JOIN unnest($1::uuid[], $2::int[]) AS w(league_id, episode) ON a.league_id = w.league_id AND a.episode = w.episode
       JOIN league_memberships m ON m.league_id = a.league_id AND m.player_id = a.player_id
       JOIN "user" u ON u.id = m.user_id
      WHERE a.question = 'winner'
      ORDER BY a.created_at`,
    [list.map((g) => g.leagueId), list.map((g) => g.episode)]
  );
  const byLeague = new Map(list.map((g) => [g.leagueId, g]));
  for (const a of answers) {
    const g = byLeague.get(a.league_id);
    if (g && typeof a.answer === "string" && !g.picks.some((p) => p.userId === a.user_id)) g.picks.push({ userId: a.user_id, name: a.who, side: a.answer });
  }
  return list.map((g) => ({ event: g.event, kind: g.kind, leagueId: g.leagueId, seasonId: g.seasonId, at: g.at, begun: g.begun, picks: g.picks, winner: g.winner, teams: g.teams }));
}

/** Each game's two teams (away, home) and its winner once final ("tie" for a tie), from the asked teams' season schedules. */
async function finalsOf(league: string, teams: string[], providers?: SportsProvider[]): Promise<Map<string, { teams: [string, string]; winner: string | null }>> {
  const p = (providers ?? sportsProviders())[0];
  const out = new Map<string, { teams: [string, string]; winner: string | null }>();
  if (!p) return out;
  await Promise.all(
    [...new Set(teams)].slice(0, 16).map(async (team) => {
      const games = await seasonGames(p, league, team).catch(() => null);
      if (!games) return;
      for (const g of scheduleOf(team, games).games) {
        if (!g.opponent || out.has(g.id)) continue;
        const pair: [string, string] = g.home === false ? [team, g.opponent.id] : [g.opponent.id, team];
        const winner = !g.final || !g.result || g.calledOff ? null : g.result === "W" ? team : g.result === "L" ? g.opponent.id : "tie";
        out.set(g.id, { teams: pair, winner });
      }
    })
  );
  return out;
}

/** The couch's call and rivalry games in a league this season, each with its picks, its teams and its final's winner. */
export async function couchCalls(viewer: SessionUser, couchId: string, league: string, teams: string[], opts: Opts = {}): Promise<CallGame[]> {
  if (!LEAGUE.test(league)) throw new HttpError(400, "Say which league");
  await requireCouch(viewer, couchId);
  const now = opts.now ?? new Date();
  const [games, finals] = await Promise.all([couchPicked(couchId, league, null, now), finalsOf(league, teams.filter((t) => ID.test(t)), opts.providers)]);
  for (const g of games) {
    const f = finals.get(g.event);
    if (f) {
      g.teams = f.teams;
      g.winner = f.winner;
    }
  }
  return games;
}

/** Make, change or take back your call, back or fade (starting the call's game on a fan's first call, and joining you to it). */
export async function pickCall(user: SessionUser, couchId: string, body: Record<string, unknown>, opts: Opts = {}): Promise<CallGame | null> {
  const league = typeof body.league === "string" ? body.league.toLowerCase() : "";
  const event = typeof body.event === "string" ? body.event : "";
  const team = typeof body.team === "string" ? body.team : "";
  if (!LEAGUE.test(league) || !ID.test(event) || !ID.test(team)) throw new HttpError(400, "Say which game: { league, event, team }");
  const side = body.side === null ? null : typeof body.side === "string" && ID.test(body.side) ? body.side : undefined;
  if (side === undefined) throw new HttpError(400, "side: a team's id, or null to take it back");
  await requireCouch(user, couchId);
  const now = opts.now ?? new Date();

  // The game's two teams, and whether you're a fan of either (a follower of it, on this couch).
  const finals = await finalsOf(league, [team], opts.providers);
  const pair = finals.get(event)?.teams;
  if (!pair) throw new HttpError(404, "That game isn't on their schedule");
  if (side !== null && !pair.includes(side)) throw new HttpError(400, "Pick one of the game's two teams");
  const mineTeams = (await couchTeams(user.id, couchId)).filter((t) => t.league === league && pair.includes(t.id) && t.followers.some((f) => f.id === user.id));
  const fan = mineTeams.length > 0;

  const client = await pool.connect();
  let game: CallGame | null = null;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [`call:${couchId}:${event}`]);
    game = (await couchPicked(couchId, league, event, now)).find((g) => g.kind === "call") ?? null;
    if (!game && side === null) return null;
    if (!game) {
      if (!fan) throw new HttpError(409, "Nothing to back yet: a fan calls it first");
      const name = `${(user as { username?: string | null }).username || user.name}'s call`.slice(0, 60);
      const started = await startSport(user, couchId, { league, team, games: [event], game: "call", name, tell: false, only: true }, opts);
      const { rows } = await pool.query("SELECT episode, starts_at FROM season_events WHERE season_id = $1 AND event_id = $2 LIMIT 1", [started.seasonId, event]);
      const at = rows[0]?.starts_at ? new Date(rows[0].starts_at).toISOString() : null;
      game = { event, kind: "call", leagueId: started.leagueId, seasonId: started.seasonId, at, begun: false, picks: [], winner: null, teams: pair };
    }
    if (game.begun) throw new HttpError(409, "It's started: calls closed at kickoff");
    const caller = game.picks[0] ?? null;
    if (caller && caller.userId === user.id && game.picks.length > 1 && side !== caller.side) throw new HttpError(409, "It's been backed: your call stands");
    if (!caller && !fan) throw new HttpError(409, "Nothing to back yet: a fan calls it first");
    const { rows: member } = await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game.leagueId, user.id]);
    if (!member.length) await joinGame(user, couchId, game.leagueId, {});
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`call:${couchId}:${event}`]).catch(() => undefined);
    client.release();
  }
  const { rows: ep } = await pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = $2 LIMIT 1", [game.seasonId, event]);
  await answerQuestions(user, game.seasonId, game.leagueId, { episode: ep[0]?.episode, answers: { winner: side } }, now);
  const after = (await couchPicked(couchId, league, event, now)).find((g) => g.kind === "call") ?? null;
  if (after) after.teams = pair;
  return after;
}
