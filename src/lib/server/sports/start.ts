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
    const added = await addGames(user.id, body as unknown as AddAsk, { providers: opts.providers });
    seasonId = added.seasonId;
    seasonName = added.name;
  }
  const o = await startOptions(user, seasonId, couchId, null, now);
  if (!o.sport) throw new HttpError(409, "That isn't a sport's season");
  if (o.blocked) throw new HttpError(409, o.blocked);
  // From the next game to play (or a later one asked for) to the last, or the one asked for.
  const listed = o.starts.map((e) => e.number);
  if (!listed.length) throw new HttpError(409, "Every game has started: picks closed at the start");
  const from = typeof body.from === "number" && listed.includes(body.from) ? body.from : o.from;
  const last = Math.max(...listed);
  // `only`: that one game (or that one week of a slate).
  const to = body.only === true ? from : typeof body.to === "number" && Number.isInteger(body.to) && body.to >= from && body.to <= last ? body.to : last;
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
