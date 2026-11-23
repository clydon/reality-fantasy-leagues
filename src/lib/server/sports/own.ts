import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { CallGame } from "@/lib/sports/fan-call";
import { ownKindOf, type SeasonCall, type SeasonGame } from "@/lib/sports/own-calls";
import { scheduleOf } from "@/lib/sports/teams";
import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { answerQuestions } from "../answers";
import { addGames, regularOf, seasonGames } from "./find";
import { sportsProviders } from "./index";
import { scopeTeams } from "./scope";
import { startSport } from "./start";
import type { SportsProvider } from "./types";

// Solo (docs/PLAN-sports-couch.md C4; docs/design-round/solo-fan-spec.md): a fan's own games on a team (leagues.solo 'own', no couch).
// Your calls: one standing Pick'em on the team's games, started by the first call (no setup screen, no push), each later game asked
// again on the same row; changeable until kickoff. The season call: how many of the team's games left it wins, one a fan a team a
// season, final once made. A game is one of these by its question's id (src/lib/sports/own-calls.ts), on the team's season.
//
//   GET  /api/sports/own?league=&teams=   your calls on the asked teams this season (C2's CallGame shape, one a game called: your pick,
//        its teams and its final's winner, from the provider's cached schedules: no new kind of ESPN call) and your season calls
//        (the wins called, the games they cover), with each asked team's regular season as the season call reads it
//   POST /api/sports/own                  { league, team, event, side | null } your call (null takes it back), or { league, team, wins }
//        the season call

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const ID = /^[\w.-]{1,40}$/;
const MAX_TEAMS = 8;

type Opts = { providers?: SportsProvider[]; now?: Date };

export interface OwnRead {
  calls: CallGame[];
  seasons: SeasonCall[];
  /** Each asked team's regular season, in order, as the season call reads it. */
  schedules: Record<string, SeasonGame[]>;
}

interface OwnGame {
  kind: "calls" | "season";
  leagueId: string;
  seasonId: string;
  team: string | null;
  from: number | null;
  to: number | null;
  state: LeagueState;
}

/** Your own calls and season-call games on a sport's seasons in `league` (archived ones too: a call made stays in the record). */
async function ownGames(userId: string, league: string): Promise<OwnGame[]> {
  const { rows } = await pool.query(
    `SELECT l.id AS league_id, l.state, ss.id AS season_id
       FROM leagues l ${LEAGUE_SEASON_JOIN}
       JOIN shows sh ON sh.id = ss.show_id
       JOIN league_memberships m ON m.league_id = l.id AND m.user_id = $1
      WHERE l.solo = 'own' AND l.created_by = $1 AND l.deleted_at IS NULL
        AND sh.kind = 'sport' AND sh.sports_league LIKE '%:' || $2
      ORDER BY l.created_at`,
    [userId, league]
  );
  const out: OwnGame[] = [];
  for (const r of rows) {
    const state = r.state as LeagueState;
    const kind = ownKindOf({ ask: StateLogic.AnswerLogic.questions(state) });
    if (!kind) continue;
    const team = (await scopeTeams(r.season_id, null, null).catch(() => null))?.[0] ?? null;
    out.push({ kind, leagueId: r.league_id, seasonId: r.season_id, team, from: StateLogic.startEpisode(state), to: StateLogic.endEpisode(state), state });
  }
  return out;
}

/** A team's regular season from the provider's cached schedule, as the season call reads it, and each game's two teams. */
async function seasonOf(league: string, team: string, providers?: SportsProvider[]): Promise<{ season: SeasonGame[]; pairs: Map<string, [string, string]> } | null> {
  const p = (providers ?? sportsProviders())[0];
  if (!p) return null;
  const games = await seasonGames(p, league, team).catch(() => null);
  if (!games) return null;
  const regular = new Set(regularOf(team, games).map((g) => g.id));
  const staged = games.some((g) => g.stage);
  const pairs = new Map<string, [string, string]>();
  const season: SeasonGame[] = [];
  for (const g of scheduleOf(team, games).games) {
    if (g.opponent) pairs.set(g.id, g.home === false ? [team, g.opponent.id] : [g.opponent.id, team]);
    // The regular season's games, and those of them called off (counted as nothing).
    if (!(regular.has(g.id) || (g.calledOff && (!staged || g.stage === "regular")))) continue;
    season.push({ id: g.id, at: g.at, result: g.final ? g.result : null, ...(g.calledOff ? { off: true } : {}) });
  }
  return { season, pairs };
}

/** Each episode's event on a season, and back. */
async function eventsOf(seasonId: string): Promise<{ byEpisode: Map<number, { event: string; at: string | null }>; byEvent: Map<string, number> }> {
  const { rows } = await pool.query("SELECT episode, event_id, starts_at FROM season_events WHERE season_id = $1", [seasonId]);
  const byEpisode = new Map<number, { event: string; at: string | null }>();
  const byEvent = new Map<string, number>();
  for (const r of rows) {
    byEpisode.set(r.episode, { event: r.event_id, at: r.starts_at ? new Date(r.starts_at).toISOString() : null });
    byEvent.set(r.event_id, r.episode);
  }
  return { byEpisode, byEvent };
}

/** Your own calls and season calls in a league on the asked teams. */
export async function ownCalls(user: SessionUser, league: string, teams: string[], opts: Opts = {}): Promise<OwnRead> {
  if (!LEAGUE.test(league)) throw new HttpError(400, "Say which league");
  const now = opts.now ?? new Date();
  const asked = [...new Set(teams.filter((t) => ID.test(t)))].slice(0, MAX_TEAMS);
  const [games, seasons] = await Promise.all([ownGames(user.id, league), Promise.all(asked.map((t) => seasonOf(league, t, opts.providers)))]);
  const byTeam = new Map(asked.map((t, i) => [t, seasons[i]] as const));
  const out: OwnRead = { calls: [], seasons: [], schedules: {} };
  for (const t of asked) out.schedules[t] = byTeam.get(t)?.season ?? [];
  const name = (user as { username?: string | null }).username || user.name;
  for (const g of games) {
    if (!g.team || !byTeam.has(g.team)) continue;
    const s = byTeam.get(g.team);
    const ev = await eventsOf(g.seasonId);
    const { rows } = await pool.query(
      `SELECT a.episode, a.answer, a.created_at FROM game_answers a JOIN league_memberships m ON m.league_id = a.league_id AND m.player_id = a.player_id
        WHERE a.league_id = $1 AND m.user_id = $2 AND a.question = $3 ORDER BY a.episode`,
      [g.leagueId, user.id, g.kind === "calls" ? "yourCall" : "seasonCall"]
    );
    if (g.kind === "calls") {
      for (const r of rows) {
        const e = ev.byEpisode.get(r.episode);
        if (!e || typeof r.answer !== "string") continue;
        const at = e.at;
        const final = s?.season.find((x) => x.id === e.event);
        const pair = s?.pairs.get(e.event) ?? null;
        const winner = !final || final.off || !final.result ? null : final.result === "T" ? "tie" : final.result === "W" ? g.team : (pair?.find((x) => x !== g.team) ?? null);
        out.calls.push({ event: e.event, kind: "call", leagueId: g.leagueId, seasonId: g.seasonId, at, begun: !!at && Date.parse(at) <= now.getTime(), picks: [{ userId: user.id, name, side: r.answer }], winner, teams: pair, own: g.team });
      }
    } else {
      const r = rows[0];
      if (!r || typeof r.answer !== "number") continue;
      const covered: string[] = [];
      const last = g.to ?? Math.max(...ev.byEpisode.keys());
      for (let n = g.from ?? 1; n <= last; n++) {
        const e = ev.byEpisode.get(n);
        if (e) covered.push(e.event);
      }
      out.seasons.push({ team: g.team, leagueId: g.leagueId, seasonId: g.seasonId, wins: r.answer, games: covered, at: r.created_at ? new Date(r.created_at).toISOString() : null });
    }
  }
  return out;
}

/** Your call on one of a team's games (starting your calls on it with the first), or the season call. */
export async function pickOwn(user: SessionUser, body: Record<string, unknown>, opts: Opts = {}): Promise<OwnRead> {
  const league = typeof body.league === "string" ? body.league.toLowerCase() : "";
  const team = typeof body.team === "string" ? body.team : "";
  if (!LEAGUE.test(league) || !ID.test(team)) throw new HttpError(400, "Say which team: { league, team }");
  const now = opts.now ?? new Date();
  const s = await seasonOf(league, team, opts.providers);
  if (!s) throw new HttpError(404, "Their schedule isn't here");
  const lockKey = `own:${user.id}:${league}:${team}`;
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
    const mine = (await ownGames(user.id, league)).filter((g) => g.team === team);
    if (typeof body.wins === "number") {
      // The season call: one a season, over the games still to play; its game page can change it until the next kickoff, then it's pinned.
      const wins = body.wins;
      const left = s.season.filter((g) => !g.result && !g.off && (!g.at || Date.parse(g.at) > now.getTime()));
      if (!left.length) throw new HttpError(409, "Their season's over: the season call opens with the next one");
      if (!Number.isInteger(wins) || wins < 0 || wins > left.length) throw new HttpError(400, `wins: 0 to ${left.length}, the games left`);
      const { seasonId, short } = await teamSeason(user, league, team, opts);
      if (mine.some((g) => g.kind === "season" && g.seasonId === seasonId)) throw new HttpError(409, "You've called this season: one call a season");
      const { byEvent } = await eventsOf(seasonId);
      const from = byEvent.get(left[0].id);
      if (from === undefined) throw new HttpError(409, "Their next game isn't on the season yet: try again in a minute");
      const started = await startSport(user, null, { seasonId, game: "season-call", team, from, name: `${short} season call`, tell: false, pace: "live" }, opts);
      await answerQuestions(user, seasonId, started.leagueId, { episode: from, answers: { seasonCall: wins } }, now);
    } else {
      // Your call on one of their games: the standing game found or started on it, then answered.
      const event = typeof body.event === "string" ? body.event : "";
      if (!ID.test(event)) throw new HttpError(400, "Say which game: { event }");
      const side = body.side === null ? null : typeof body.side === "string" && ID.test(body.side) ? body.side : undefined;
      if (side === undefined) throw new HttpError(400, "side: a team's id, or null to take it back");
      const pair = s.pairs.get(event);
      if (!pair) throw new HttpError(404, "That game isn't on their schedule");
      if (side !== null && !pair.includes(side)) throw new HttpError(400, "Pick one of the game's two teams");
      const g = s.season.find((x) => x.id === event);
      const at = g?.at ?? null;
      if (g?.result || (at && Date.parse(at) <= now.getTime())) throw new HttpError(409, "It's started: calls closed at kickoff");
      const { seasonId, short } = await teamSeason(user, league, team, opts);
      const { byEvent } = await eventsOf(seasonId);
      const episode = byEvent.get(event);
      if (episode === undefined) throw new HttpError(409, "That game isn't on their season yet: try again in a minute");
      let game = mine.find((x) => x.kind === "calls" && x.seasonId === seasonId && !x.state?.settings?.archivedAt && (x.from ?? 1) <= episode && (x.to === null || x.to >= episode)) ?? null;
      if (!game && side === null) return ownCalls(user, league, [team], opts);
      if (!game) {
        const started = await startSport(user, null, { seasonId, game: "own-calls", from: episode, name: `${short} calls`, tell: false, pace: "live" }, opts);
        game = { kind: "calls", leagueId: started.leagueId, seasonId, team, from: episode, to: null, state: {} as LeagueState };
      }
      await answerQuestions(user, seasonId, game.leagueId, { episode, answers: { yourCall: side } }, now);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined);
    client.release();
  }
  return ownCalls(user, league, [team], opts);
}

/** The team's season (made or found, and followed), its whole schedule, and the team's name as the season says it ("Lions"). */
async function teamSeason(user: SessionUser, league: string, team: string, opts: Opts): Promise<{ seasonId: string; short: string }> {
  const added = await addGames(user.id, { league, team, whole: "season" }, { providers: opts.providers });
  return { seasonId: added.seasonId, short: added.name.split(",")[0].trim() || "Your team" };
}
