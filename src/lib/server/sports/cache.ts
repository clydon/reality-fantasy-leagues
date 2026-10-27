import { easternDay } from "@/lib/game/tv-listings";
import { pool } from "../db";
import { SportsUnavailable, type SportsEvent, type SportsProvider } from "./types";

// The sports cache (db/migrations/0148 sports_cache; docs/HOSTING.md): every provider answer, already read into the provider
// shapes (types.ts, a few KB, never the provider's raw answer: an ESPN game summary is ~1 MB), kept in Postgres because a
// serverless function's memory doesn't outlive its request, and Vercel's own data cache is already over its free storage.
// How long each answer is good for comes from the answer itself:
//   leagues, search      a week
//   a day's games        3 minutes while one is being played; 30 days once the day is two days gone and every game on it is over;
//                        an hour otherwise (today's, a future day's: games get added and moved)
//   a roster             a day
//   a game's box score   for good once it's final; 3 minutes while it's being played; an hour before it starts
//   a season line        a day
// When the provider doesn't answer (SportsUnavailable), an answer past its time is served instead (stale beats nothing); with
// none, the caller sees the error. A broken cache (the table missing, the database slow) never breaks a call: it just asks.
// Rows past their time for a week are pruned by the daily listings job (pruneSportsCache).

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Queryable = { query: typeof pool.query };

/** How long an answer is good for, in ms; null: for good. */
type Keep = number | null;

/**
 * `key`'s answer from the cache while it's good, else `ask()` (kept for as long as `keep` says). `db` and `now` are for checks.
 */
export async function cached<T>(key: string, ask: () => Promise<T>, keep: (value: T) => Keep, opts: { db?: Queryable; now?: number } = {}): Promise<T> {
  const db = opts.db ?? pool;
  const now = opts.now ?? Date.now();
  let hit: { value: T; expires_at: Date | null } | undefined;
  try {
    hit = (await db.query("SELECT value, expires_at FROM sports_cache WHERE key = $1", [key])).rows[0];
  } catch (e) {
    console.error("[sports] cache read:", (e as Error).message);
  }
  if (hit && (hit.expires_at === null || hit.expires_at.getTime() > now)) return hit.value;
  let value: T;
  try {
    value = await ask();
  } catch (e) {
    if (e instanceof SportsUnavailable && hit) return hit.value;
    throw e;
  }
  const ms = keep(value);
  try {
    await db.query(
      `INSERT INTO sports_cache (key, value, fetched_at, expires_at) VALUES ($1, $2::jsonb, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, fetched_at = now(), expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(value ?? null), ms == null ? null : new Date(now + ms)]
    );
  } catch (e) {
    console.error("[sports] cache write:", (e as Error).message);
  }
  return value;
}

/** How long a day's games are good for (see the top). */
export function keepDay(events: SportsEvent[], date: string, now: number): Keep {
  if (events.some((e) => e.state === "in" || e.parts.some((p) => p.state === "in"))) return 3 * MIN;
  const past = date < easternDay(new Date(now), -1);
  if (past && events.every((e) => e.state === "post")) return 30 * DAY;
  return HOUR;
}

/**
 * A provider whose every answer goes through the cache. `prefix` keeps a check's rows apart ("zt-sports:"), so it can remove
 * them after; `db` and `now` are for checks too.
 */
export function withCache(p: SportsProvider, opts: { prefix?: string; db?: Queryable; now?: () => number } = {}): SportsProvider {
  const key = (...parts: (string | number)[]) => `${opts.prefix ?? ""}${p.id}:${parts.join(":")}`;
  const at = () => ({ db: opts.db, now: opts.now?.() });
  return {
    id: p.id,
    name: p.name,
    leagues: () => cached(key("leagues"), () => p.leagues(), () => 7 * DAY, at()),
    find: (text) => cached(key("find", text.trim().toLowerCase().replace(/\s+/g, " ")), () => p.find(text), () => 7 * DAY, at()),
    eventsOn: (league, date) => {
      const o = at();
      return cached(key("events", league, date), () => p.eventsOn(league, date), (events) => keepDay(events, date, o.now ?? Date.now()), o);
    },
    roster: (league, team) => cached(key("roster", league, team), () => p.roster(league, team), () => DAY, at()),
    boxScore: (league, event) =>
      cached(key("box", league, event), () => p.boxScore(league, event), (b) => (b?.final ? null : b?.state === "in" ? 3 * MIN : b?.state === "post" ? DAY : HOUR), at()),
    seasonStats: (league, athlete, season) => cached(key("season", league, athlete, season), () => p.seasonStats(league, athlete, season), () => DAY, at()),
  };
}

/** Rows a week past their time (the daily listings job). */
export async function pruneSportsCache(db: Queryable = pool): Promise<number> {
  const { rowCount } = await db.query("DELETE FROM sports_cache WHERE expires_at < now() - interval '7 days'");
  return rowCount ?? 0;
}
