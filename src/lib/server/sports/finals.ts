import { TeamSport, shapeOf, sportOf, type StoredFinal } from "@/lib/sports";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { SportsUnavailable, type SportsProvider } from "./types";

// A game's or an event's counts, saved once it's final (docs/PLAN-start-a-game-gpt.md track L, L3 parts 1 and 3; db/migrations/0301
// and 0302): everyone's counts in the sport's keys, their teams and positions, and a field's standings or a card's bouts and
// results (src/lib/sports/final.ts StoredFinal), on the event's own row (sports_events.lines, people, shape), shared by every season
// that links it and never asked again. A game scored by stats and the sports settles read them (score.ts); what a game shows live
// is the phone's (its poller), and this is what's saved when it's over. Once per game or event (the provider's `game`): a team
// game's summary, or a field's or a card's calls as the phone's poller makes them (L2 part 2's feeds), asked once.
//
// Run by the daily listings job (refreshSportsEvents, after it keeps the day's finals) and by a season's stats fill (stats.ts, once
// it reads a game's box score as final), for the games just finished.

const DAY = 86_400_000;
/** At most this many games or events asked a run, of them at most MAX_EVENTS_A_RUN a field's or a card's (each its poller's calls:
 *  ~135 an F1 weekend, ~36 a UFC card; one not wholly in yet is asked whole again the next run). */
const MAX_A_RUN = 60;
const MAX_EVENTS_A_RUN = 10;
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
 * Save the counts of games and events that are final and have none kept yet (`only`: just these; `seasons`: just the games these seasons
 * link, a check's; else the last LOOK_BACK_MS's, oldest final first), asking the provider at most MAX_A_RUN times. A final the
 * provider has nothing for two days on, or whose answer can't be read (an error the sport's reader throws, logged), is kept as
 * none, so one game never holds up the rest; an event that isn't wholly in by then (a counted series' statistics never filled
 * in) is kept as far as it is. The provider not answering stops the run with what it saved (said in `errors`).
 * `providers` and `now` are for checks.
 */
export async function saveFinals(opts: { providers?: SportsProvider[]; only?: EventRef[]; seasons?: string[]; now?: Date; db?: Queryable } = {}): Promise<{ saved: number; errors: string[] }> {
  const db = opts.db ?? pool;
  const now = (opts.now ?? new Date()).getTime();
  const providers = opts.providers ?? sportsProviders();
  const only = opts.only ?? null;
  const { rows } = await db.query(
    `SELECT f.provider, f.league, f.event_id, f.final_at FROM sports_events f
      WHERE f.final AND f.lines IS NULL
        AND ($1::text[] IS NULL OR f.provider || '|' || f.league || '|' || f.event_id = ANY($1::text[]))
        AND ($1::text[] IS NOT NULL OR f.final_at > to_timestamp($2 / 1000.0))
        AND ($3::uuid[] IS NULL OR EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = ANY($3::uuid[]) AND e.provider = f.provider AND e.league = f.league AND e.event_id = f.event_id))
      ORDER BY f.final_at NULLS FIRST`,
    [only ? only.map((e) => `${e.provider}|${e.league}|${e.event}`) : null, now - LOOK_BACK_MS, opts.seasons ?? null]
  );
  let saved = 0;
  let asked = 0;
  let events = 0;
  const errors: string[] = [];
  // Only a sport the app reads.
  for (const r of rows) {
    const p = providers.find((x) => x.id === r.provider);
    const sport = sportOf(r.league);
    if (!p || !sport) continue;
    if (!(sport instanceof TeamSport) && events++ >= MAX_EVENTS_A_RUN) continue;
    if (asked++ >= MAX_A_RUN) break;
    const old = !!r.final_at && (r.final_at as Date).getTime() < now - GIVE_UP_MS;
    let g: StoredFinal | null = null;
    try {
      g = await p.game(r.league, r.event_id);
    } catch (e) {
      // ESPN down (an event's board, a game's summary): the run stops with what it saved. One of an event's later calls failing
      // isn't this: the event comes back not final (eventFinal).
      if (e instanceof SportsUnavailable) {
        errors.push(`${r.league} ${r.event_id}: ${e.message.slice(0, 160)}`);
        break;
      }
      // An answer the sport's reader can't read: said, and given up on once it's old, as one with nothing.
      console.error("[sports] finals:", r.league, r.event_id, e);
      errors.push(`${r.league} ${r.event_id}: ${(e as Error).message.slice(0, 160)}`);
    }
    if (!g?.final && !old) continue;
    // Old and not wholly in: a team game's as none (its box score never came final), an event's as far as it is.
    const kept = g && (g.final || g.kind) ? g : null;
    const shape = kept ? shapeOf(kept) : null;
    const { rowCount } = await db.query(
      "UPDATE sports_events SET lines = $4::jsonb, people = $5::jsonb, shape = $6::jsonb, lines_at = to_timestamp($7 / 1000.0), updated_at = now() WHERE provider = $1 AND league = $2 AND event_id = $3 AND lines IS NULL",
      [r.provider, r.league, r.event_id, JSON.stringify(kept?.lines ?? {}), JSON.stringify(kept?.people ?? {}), shape ? JSON.stringify(shape) : null, now]
    );
    saved += rowCount ?? 0;
  }
  return { saved, errors };
}
