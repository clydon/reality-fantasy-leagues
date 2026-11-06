import { TeamSport, sportOf, type StoredGame } from "@/lib/sports";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { SportsUnavailable, type SportsProvider } from "./types";

// A team game's counts, saved once it's final (docs/PLAN-start-a-game-gpt.md track L, L3 part 1; db/migrations/0301): everyone's
// counts in the sport's keys, their teams and positions (src/lib/sports/final.ts StoredGame), on the game's own row
// (sports_events.lines), shared by every season that links it and never asked again. A game scored by stats and the sports settles
// read them (score.ts); what a game shows live is the phone's (its poller), and this is what's saved when it's over. One summary
// per game, once (the provider's `game`). A field's and a card's events aren't saved here yet: their answers are several calls each
// (the phone's pollers', L2 part 2), so they wait for L3's next part.
//
// Run by the daily listings job (refreshSportsEvents, after it keeps the day's finals) and by a season's stats fill (stats.ts, once
// it reads a game's box score as final), for the games just finished.

const DAY = 86_400_000;
/** At most this many games' summaries asked a run. */
const MAX_A_RUN = 60;
/** A final the provider has no counts for this long after it's over: they aren't coming (kept as none). */
const GIVE_UP_MS = 2 * DAY;
/** Finals older than this with no counts are left be (a game linked long after it was played: its season's stats fill reads it). */
const LOOK_BACK_MS = 30 * DAY;

type Queryable = { query: typeof pool.query };

/** One of the provider's events. */
export interface EventRef {
  provider: string;
  league: string;
  event: string;
}

/**
 * Save the counts of team games that are final and have none kept yet (`only`: just these; `seasons`: just the games these seasons
 * link, a check's; else the last LOOK_BACK_MS's, oldest final first), asking the provider at most MAX_A_RUN times. A final the
 * provider has nothing for two days on, or whose answer can't be read (an error the sport's reader throws, logged), is kept as
 * none, so one game never holds up the rest. The provider not answering stops the run with what it saved (said in `errors`).
 * `providers` and `now` are for checks.
 */
export async function saveFinals(opts: { providers?: SportsProvider[]; only?: EventRef[]; seasons?: string[]; now?: Date; db?: Queryable } = {}): Promise<{ saved: number; errors: string[] }> {
  const db = opts.db ?? pool;
  const now = (opts.now ?? new Date()).getTime();
  const providers = opts.providers ?? sportsProviders();
  const only = opts.only ?? null;
  const { rows } = await db.query(
    `SELECT f.provider, f.league, f.event_id, f.final_at FROM sports_events f
      WHERE f.final AND f.lines IS NULL AND jsonb_array_length(f.teams) > 0
        AND ($1::text[] IS NULL OR f.provider || '|' || f.league || '|' || f.event_id = ANY($1::text[]))
        AND ($1::text[] IS NOT NULL OR f.final_at > to_timestamp($2 / 1000.0))
        AND ($3::uuid[] IS NULL OR EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = ANY($3::uuid[]) AND e.provider = f.provider AND e.league = f.league AND e.event_id = f.event_id))
      ORDER BY f.final_at NULLS FIRST`,
    [only ? only.map((e) => `${e.provider}|${e.league}|${e.event}`) : null, now - LOOK_BACK_MS, opts.seasons ?? null]
  );
  let saved = 0;
  let asked = 0;
  const errors: string[] = [];
  // Only a team sport the app reads: a field's or a card's events wait for their own part.
  for (const r of rows) {
    const p = providers.find((x) => x.id === r.provider);
    if (!p || !(sportOf(r.league) instanceof TeamSport)) continue;
    if (asked++ >= MAX_A_RUN) break;
    const old = !!r.final_at && (r.final_at as Date).getTime() < now - GIVE_UP_MS;
    let g: StoredGame | null = null;
    try {
      g = await p.game(r.league, r.event_id);
    } catch (e) {
      if (e instanceof SportsUnavailable) {
        errors.push(`${r.league} ${r.event_id}: ${e.message.slice(0, 160)}`);
        break;
      }
      // An answer the sport's reader can't read: said, and given up on once it's old, as one with nothing.
      console.error("[sports] finals:", r.league, r.event_id, e);
      errors.push(`${r.league} ${r.event_id}: ${(e as Error).message.slice(0, 160)}`);
    }
    if (!g?.final && !old) continue;
    const { rowCount } = await db.query(
      "UPDATE sports_events SET lines = $4::jsonb, people = $5::jsonb, lines_at = to_timestamp($6 / 1000.0), updated_at = now() WHERE provider = $1 AND league = $2 AND event_id = $3 AND lines IS NULL",
      [r.provider, r.league, r.event_id, JSON.stringify(g?.final ? g.lines : {}), JSON.stringify(g?.final ? g.people : {}), now]
    );
    saved += rowCount ?? 0;
  }
  return { saved, errors };
}
