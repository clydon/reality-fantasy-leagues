import { easternDay } from "@/lib/game/tv-listings";
import { isUuid } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { SportsUnavailable, type SeasonLine, type SportsProvider } from "./types";

// An athlete's past seasons (the design round's step 6: the draft room's athlete sheet, and the Players tab's; the user, 2026-11-15:
// "Sports it's important to get historical stats"): the last three seasons before this one, each the provider's regular-season
// lines (every category it shows by default: ESPN's site.web …/athletes/{id}/stats, espn.ts readSeasonStats), asked only when a
// sheet opens and cached a day each in sports_cache (cache.ts "a season line"), nothing polled. This season is the game log's
// (player-log.ts, up to your mark); a finished season is no spoiler. Matched by name to the season's cast and its provider id
// (season_cast.provider_ids), the league and season from the season's slate or its first linked game.

export const PAST = 3;

export interface PastSeason {
  /** The provider's season year (2025), and its own name for it ("2025", "2024-25"). */
  season: number;
  label: string;
  lines: SeasonLine[];
}

export interface AthleteHistory {
  seasons: PastSeason[];
  /** Where it came from ("ESPN"), for the credit; null with nothing to show. */
  source: string | null;
  /** The provider didn't answer: say so, and try again later. */
  unavailable: boolean;
}

const NONE: AthleteHistory = { seasons: [], source: null, unavailable: false };

/** `team`: theirs, for a name two players share (step 1.3); the first of that name without it. */
export async function athleteHistory(seasonId: string, name: string, providers: SportsProvider[], team: string | null = null): Promise<AthleteHistory> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const who = name.trim();
  if (!who || who.length > 120) throw new HttpError(400, "Say who: ?name=");
  const [{ rows: cast }, { rows: slate }, { rows: events }] = await Promise.all([
    pool.query("SELECT provider_ids FROM season_cast WHERE season_id = $1 AND lower(name) = lower($2) AND provider_ids IS NOT NULL AND ($3::text IS NULL OR tribe_name = $3) ORDER BY sort_order LIMIT 1", [seasonId, who, team || null]),
    pool.query("SELECT provider, league, season, stage FROM sports_slates WHERE season_id = $1", [seasonId]),
    pool.query("SELECT provider, league, event_id, starts_at FROM season_events WHERE season_id = $1 AND starts_at IS NOT NULL ORDER BY episode LIMIT 1", [seasonId]),
  ]);
  const ids = (cast[0]?.provider_ids ?? null) as Record<string, string> | null;
  const link = slate[0] ?? events[0];
  if (!ids || !link) return NONE;
  const p = providers.find((x) => x.id === link.provider);
  const athlete = ids[link.provider];
  if (!p || !athlete) return NONE;
  try {
    // The season this one is (the slate says; else the provider names the first linked game's).
    let year: number | null = slate[0]?.season ?? null;
    if (year == null && events[0]) year = (await p.eventsOn(events[0].league, easternDay(new Date(events[0].starts_at)))).find((e) => e.id === events[0].event_id)?.season ?? null;
    if (year == null) return NONE;
    // A postseason's own regular season is this year's, finished: it counts as the first past one.
    const first = slate[0]?.stage === "post" ? year : year - 1;
    const want = Array.from({ length: PAST }, (_, i) => first - i);
    const got = await Promise.all(want.map((y) => p.seasonStats(link.league, athlete, y)));
    const seasons = want.map((y, i) => ({ season: y, label: got[i]?.[0]?.season ?? String(y), lines: got[i] ?? [] })).filter((s) => s.lines.length);
    return { seasons, source: seasons.length ? p.name : null, unavailable: false };
  } catch (e) {
    if (e instanceof SportsUnavailable) return { ...NONE, unavailable: true };
    throw e;
  }
}
