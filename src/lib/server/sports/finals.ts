import { isDeepStrictEqual } from "node:util";
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
//
// Step 1.2 (docs/PLAN-sports-ready.md): a final is never zeroed silently (one with nothing readable is said on its row, asked again,
// and when kept as none, flagged for the desk), and a kept final is read again for corrections (an NFL stat correction lands
// midweek).

const DAY = 86_400_000;
/** At most this many games or events asked a run, of them at most MAX_EVENTS_A_RUN a field's or a card's (each its poller's calls:
 *  ~135 an F1 weekend, ~36 a UFC card; one not wholly in yet is asked whole again the next run). */
const MAX_A_RUN = 60;
const MAX_EVENTS_A_RUN = 10;
/** A final the provider has no counts for this long after it's over: they aren't coming (kept as none). */
const GIVE_UP_MS = 2 * DAY;
/** Finals older than this with no counts are left be (a game linked long after it was played: its season's stats fill reads it). */
const LOOK_BACK_MS = 30 * DAY;
/** A kept final is read again this long after it was kept, for a correction (step 1.2; the cache keeps a final's answer a day,
 *  so not before). */
const RECHECK_MS = 25 * 3_600_000;
/** ...and once more when the next game of a season linking it starts within this, so a midweek correction (the NFL's) is in
 *  before that game's lineups lock. The daily job's reach: an hourly run (step 1.1) can shorten it. */
const BEFORE_NEXT_MS = 30 * 3_600_000;
/** A final kept as none (nothing readable two days on) is asked again this often, within LOOK_BACK_MS, until it reads. */
const RETRY_MS = 6 * 3_600_000;

type Queryable = { query: typeof pool.query };

/** One of the provider's events. */
export interface EventRef {
  provider: string;
  league: string;
  event: string;
}

/**
 * Save the counts of games and events that are final and have none kept yet (`only`: just these; `seasons`: just the games these seasons
 * link, a check's; else the last LOOK_BACK_MS's, oldest final first), asking the provider at most MAX_A_RUN times, then read kept
 * finals again for corrections (docs/PLAN-sports-ready.md step 1.2; not with `only`). A final whose counts can't be read yet (no box
 * score, or one the sport's reader throws on: logged) is said on its row (read_tries, read_error) and asked again the next run; two
 * days on it's kept as none so its week can finish, but never silently: read_error stays on it (the desk's Inbox lists it) and
 * every run after RETRY_MS asks again until it reads, which then counts as a correction. An event that isn't wholly in by then (a
 * counted series' statistics never filled in) is kept as far as it is. A kept final is read again RECHECK_MS after it was kept and
 * once more when the next game of a season linking it starts within BEFORE_NEXT_MS; an answer that differs is kept with a new
 * lines_at, so every league's table follows (score.ts's stamp reads lines_at). The provider not answering stops the run with what
 * it saved (said in `errors`). `providers` and `now` are for checks.
 */
export async function saveFinals(opts: { providers?: SportsProvider[]; only?: EventRef[]; seasons?: string[]; now?: Date; db?: Queryable } = {}): Promise<{ saved: number; corrected: number; errors: string[] }> {
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
  let corrected = 0;
  let asked = 0;
  let events = 0;
  const errors: string[] = [];
  const where = "provider = $1 AND league = $2 AND event_id = $3";
  // Only a sport the app reads.
  for (const r of rows) {
    const p = providers.find((x) => x.id === r.provider);
    const sport = sportOf(r.league);
    if (!p || !sport) continue;
    if (!(sport instanceof TeamSport) && events++ >= MAX_EVENTS_A_RUN) continue;
    if (asked++ >= MAX_A_RUN) break;
    const old = !!r.final_at && (r.final_at as Date).getTime() < now - GIVE_UP_MS;
    let g: StoredFinal | null = null;
    let why: string | null = null;
    try {
      g = await p.game(r.league, r.event_id);
    } catch (e) {
      // ESPN down (an event's board, a game's summary): the run stops with what it saved. One of an event's later calls failing
      // isn't this: the event comes back not final (eventFinal).
      if (e instanceof SportsUnavailable) {
        errors.push(`${r.league} ${r.event_id}: ${e.message.slice(0, 160)}`);
        break;
      }
      // An answer the sport's reader can't read: said, and asked again (kept as none and flagged once it's old).
      console.error("[sports] finals:", r.league, r.event_id, e);
      errors.push(`${r.league} ${r.event_id}: ${(e as Error).message.slice(0, 160)}`);
      why = `its box score couldn't be read (${(e as Error).message.slice(0, 120)})`;
    }
    const failed = why ?? (g ? "its counts aren't final yet" : "no box score yet");
    if (!g?.final && !old) {
      await db.query(`UPDATE sports_events SET read_tries = read_tries + 1, read_error = $4, updated_at = now() WHERE ${where} AND lines IS NULL`, [r.provider, r.league, r.event_id, failed]);
      continue;
    }
    // Old and not wholly in: a team game's as none (its box score never came final), flagged; an event's as far as it is.
    const kept = g && (g.final || g.kind) ? g : null;
    const flag = kept ? null : why ?? (g ? "its counts never came final" : "no box score two days after the final");
    const shape = kept ? shapeOf(kept) : null;
    const { rowCount } = await db.query(
      `UPDATE sports_events SET lines = $4::jsonb, people = $5::jsonb, shape = $6::jsonb, lines_at = to_timestamp($7 / 1000.0), read_error = $8,
              read_tries = CASE WHEN $8::text IS NULL THEN 0 ELSE read_tries + 1 END, updated_at = now()
        WHERE ${where} AND lines IS NULL`,
      [r.provider, r.league, r.event_id, JSON.stringify(kept?.lines ?? {}), JSON.stringify(kept?.people ?? {}), shape ? JSON.stringify(shape) : null, now, flag]
    );
    saved += rowCount ?? 0;
  }
  if (only || asked >= MAX_A_RUN) return { saved, corrected, errors };

  // Corrections (step 1.2): a kept final read again once a moment it's due at has passed since it was last read (kept or checked):
  // RECHECK_MS after it was kept; BEFORE_NEXT_MS before the next game of a season linking it; RETRY_MS on, one kept as none.
  const { rows: due } = await db.query(
    `SELECT f.provider, f.league, f.event_id, f.lines, f.people, f.shape, f.read_error
       FROM sports_events f
       CROSS JOIN LATERAL (SELECT COALESCE(f.checked_at, f.lines_at) AS last, to_timestamp($3 / 1000.0) AS now) t
       LEFT JOIN LATERAL (
         SELECT min(n.starts_at) AS next FROM season_events s JOIN season_events n ON n.season_id = s.season_id AND n.episode > s.episode
          WHERE s.provider = f.provider AND s.league = f.league AND s.event_id = f.event_id AND n.starts_at > t.now) x ON true
      WHERE f.final AND f.lines IS NOT NULL AND f.lines_at > to_timestamp($1 / 1000.0)
        AND EXISTS (SELECT 1 FROM season_events e WHERE e.provider = f.provider AND e.league = f.league AND e.event_id = f.event_id
                     AND ($2::uuid[] IS NULL OR e.season_id = ANY($2::uuid[])))
        AND ((f.read_error IS NOT NULL AND t.last + make_interval(secs => $4) <= t.now)
          OR (t.last < f.lines_at + make_interval(secs => $5) AND f.lines_at + make_interval(secs => $5) <= t.now)
          OR (x.next IS NOT NULL AND t.last < x.next - make_interval(secs => $6) AND x.next - make_interval(secs => $6) <= t.now))
      ORDER BY t.last
      LIMIT $7`,
    [now - LOOK_BACK_MS, opts.seasons ?? null, now, RETRY_MS / 1000, RECHECK_MS / 1000, BEFORE_NEXT_MS / 1000, MAX_A_RUN - asked]
  );
  for (const r of due) {
    const p = providers.find((x) => x.id === r.provider);
    const sport = sportOf(r.league);
    if (!p || !sport) continue;
    if (!(sport instanceof TeamSport) && events++ >= MAX_EVENTS_A_RUN) continue;
    let g: StoredFinal | null = null;
    try {
      g = await p.game(r.league, r.event_id, { fresh: true });
    } catch (e) {
      if (e instanceof SportsUnavailable) {
        errors.push(`${r.league} ${r.event_id}: ${e.message.slice(0, 160)}`);
        break;
      }
      console.error("[sports] finals, read again:", r.league, r.event_id, e);
      errors.push(`${r.league} ${r.event_id}: ${(e as Error).message.slice(0, 160)}`);
    }
    const kept = g && (g.final || g.kind) ? g : null;
    const shape = kept ? shapeOf(kept) : null;
    // The same answer (JSON's round trip: as the row holds it), or none to read: only when it was read again.
    const plain = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));
    if (!kept || isDeepStrictEqual(plain({ lines: kept.lines ?? {}, people: kept.people ?? {}, shape }), plain({ lines: r.lines, people: r.people, shape: r.shape }))) {
      await db.query(`UPDATE sports_events SET checked_at = to_timestamp($4 / 1000.0), updated_at = now() WHERE ${where}`, [r.provider, r.league, r.event_id, now]);
      continue;
    }
    const { rowCount } = await db.query(
      `UPDATE sports_events SET lines = $4::jsonb, people = $5::jsonb, shape = $6::jsonb, lines_at = to_timestamp($7 / 1000.0), checked_at = to_timestamp($7 / 1000.0),
              read_error = NULL, read_tries = 0, updated_at = now()
        WHERE ${where}`,
      [r.provider, r.league, r.event_id, JSON.stringify(kept.lines ?? {}), JSON.stringify(kept.people ?? {}), shape ? JSON.stringify(shape) : null, now]
    );
    corrected += rowCount ?? 0;
  }
  return { saved, corrected, errors };
}
