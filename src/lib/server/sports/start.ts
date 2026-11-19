import { railSpec, sportRail, type RailGame } from "@/lib/sports/start-games";
import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { startFromSpec, type SpecStarted } from "../start-spec";
import { startOptions } from "../start-game";
import { addGames, addSlate, type AddAsk, type SlateAsk } from "./find";
import type { SportsProvider } from "./types";

// Start a game on a team (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "Start a game on a team", the user's calls
// of 2026-11-09): from a team's sheet, a game (the next one, a series, the rest of the season, a rival's meetings, or a run picked
// like dates) and one of the sport's standard games (start-games.ts sportRail). Starting adds the games (find.ts addGames: made or
// found, shared, followed, under the day's cap) and starts the game on that season through the wizard's own path (start-spec.ts
// startFromSpec: our check again on the season's page, the couch told after the 10-second hold, Undo as the wizard's). A sport's
// season already here (a matchup's or a slate's) starts the same way by its id. Play the next game is this with Pick'em on one game.
// One of a team's games, started from the team, goes on the team's season, that game only (Round 3, the user's call of 2026-11-18): a
// team's daily games then share a Games tab, an archive and a record, as a show's short games do. A run of games, a rival's meetings
// and the whole season are as before; a game outside the regular season, or a season the schedule can't make, keeps its own
// matchup's season.
//
//   GET  /api/sports/start?league=&count=&slate=1      the rail for that many games
//   POST /api/sports/start?couch=  { league, team, games | whole, against?, game, tell?, name? }, { league, slate: {}, game, only? }
//                                  (a league's slate, this week's only), or { seasonId, game, from?, to?, only? }

export interface SportStarted extends SpecStarted {
  seasonId: string;
  /** The season's name ("Eagles at Cowboys, Nov 9"). */
  season: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The rail for `count` of a league's games (GET /api/sports/start). */
export function railFor(league: string, count: number, slate: boolean): RailGame[] {
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) || !Number.isInteger(count) || count < 1 || count > 400) throw new HttpError(400, "Say which league and how many games");
  return sportRail(league, { count, slate });
}

/** One of a team's games on the team's season (made or found, and followed), and its episode there; null when it isn't one game
 *  of a team's, or the team's season can't hold it (not a regular-season game, a schedule too long to make). */
async function teamSeasonFor(user: SessionUser, ask: AddAsk, providers?: SportsProvider[]): Promise<{ seasonId: string; name: string; episode: number } | null> {
  if (!ask || typeof ask !== "object" || ask.whole || typeof ask.team !== "string" || !Array.isArray(ask.games) || ask.games.length !== 1) return null;
  let whole: Awaited<ReturnType<typeof addGames>>;
  try {
    whole = await addGames(user.id, { league: ask.league, team: ask.team, whole: "season" }, { providers });
  } catch (e) {
    // The team's season can't be made (no season listed, too long, the day's cap): the game's own matchup, as before.
    if (e instanceof HttpError && e.status < 500) return null;
    throw e;
  }
  const { rows } = await pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = $2 LIMIT 1", [whole.seasonId, ask.games[0]]);
  const episode = rows[0]?.episode as number | undefined;
  return Number.isInteger(episode) ? { seasonId: whole.seasonId, name: whole.name, episode: episode as number } : null;
}

/** Start one of a sport's standard games on some of a team's games, or on a sport's season that's here. */
export async function startSport(
  user: SessionUser,
  couchId: string | null,
  body: Record<string, unknown>,
  opts: { providers?: SportsProvider[]; now?: Date } = {}
): Promise<SportStarted> {
  const now = opts.now ?? new Date();
  const game = typeof body.game === "string" ? body.game : "";
  if (!game) throw new HttpError(400, "game: which of the sport's games");
  // The season: one here (by id), else the team's games added (made or found, and followed).
  let seasonId: string;
  let seasonName: string;
  // One of a team's games on the team's season: its episode there (it must be the one started, never the next one instead).
  let teamEpisode: number | null = null;
  if (typeof body.seasonId === "string") {
    seasonId = body.seasonId;
    const { rows } = await pool.query("SELECT COALESCE(ss.name, s.name) AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
    if (!rows[0]) throw new HttpError(404, "Season not found");
    seasonName = rows[0].name as string;
  } else if (isObj(body.slate)) {
    // A league's slate (its season week by week, or day by day): made or found, and followed.
    const added = await addSlate(user.id, { league: body.league, slate: body.slate } as SlateAsk, { providers: opts.providers });
    seasonId = added.seasonId;
    seasonName = added.name;
  } else {
    const ask = body as unknown as AddAsk;
    const team = await teamSeasonFor(user, ask, opts.providers);
    const added = team ?? (await addGames(user.id, ask, { providers: opts.providers }));
    seasonId = added.seasonId;
    seasonName = added.name;
    if (team) teamEpisode = team.episode;
  }
  const o = await startOptions(user, seasonId, couchId, null, now);
  if (!o.sport) throw new HttpError(409, "That isn't a sport's season");
  if (o.blocked) throw new HttpError(409, o.blocked);
  // From the next game to play (or a later one asked for) to the last, or the one asked for.
  const listed = o.starts.map((e) => e.number);
  if (!listed.length) throw new HttpError(409, "Every game has started: picks closed at the start");
  if (teamEpisode !== null && !listed.includes(teamEpisode)) throw new HttpError(409, "That game has started: picks closed at the start");
  const from = teamEpisode ?? (typeof body.from === "number" && listed.includes(body.from) ? body.from : o.from);
  const last = Math.max(...listed);
  // `only`: that one game (or that one week of a slate).
  const to = body.only === true || teamEpisode !== null ? from : typeof body.to === "number" && Number.isInteger(body.to) && body.to >= from && body.to <= last ? body.to : last;
  const { rows: slates } = await pool.query("SELECT 1 FROM sports_slates WHERE season_id = $1", [seasonId]);
  const rail = sportRail(o.sport.league, { count: last, slate: slates.length > 0 });
  const pick = rail.find((g) => g.id === game);
  if (!pick) throw new HttpError(400, "That game isn't one this sport plays here");
  const started = await startFromSpec(user, seasonId, couchId, {
    spec: railSpec(pick.spec, from, to),
    name: isObj(body) && typeof body.name === "string" ? body.name : undefined,
    tell: body.tell,
    made: { sport: game },
  }, now);
  return { ...started, seasonId, season: seasonName };
}
