import { after } from "next/server";
import { pool } from "../db";
import { castFromEvents, holdFill, releaseFill, type CastFill } from "./cast";
import { linkSeason, MAX_SEASONS, type SeasonLink } from "./link";
import type { SportsProvider } from "./types";

// A sport season and its sports data, together (docs/PLAN-sports-data.md steps 2 and 3): its episodes linked to the provider's games
// (link.ts), then its people from those games (cast.ts). Run after the answer when someone adds a sport (add-show.ts), by the daily
// listings job (tv-listings.ts) and from the Players tab (rosters.ts).

/** Link a season's games, then fill in (or add to) its people from them. `held`: the caller holds the season's fill. */
export async function followSeason(seasonId: string, opts: { providers?: SportsProvider[]; now?: Date; held?: boolean } = {}): Promise<{ link: SeasonLink; cast: CastFill | null }> {
  const link = await linkSeason(seasonId, { providers: opts.providers, now: opts.now });
  const cast = link.linked ? await castFromEvents(seasonId, { providers: opts.providers, now: opts.now, held: opts.held }) : null;
  return { link, cast };
}

/**
 * `task` after the answer, holding the season's fill (taken now, so the page asking sees it going at once), and letting it go with
 * how it went. Outside a request (a script) it runs now instead. False when another fill is going.
 */
export async function fillLater(seasonId: string, task: () => Promise<CastFill | null>, userId: string | null = null): Promise<boolean> {
  if (!(await holdFill(seasonId, userId))) return false;
  const run = async () => {
    try {
      const cast = await task();
      await releaseFill(seasonId, cast?.message ?? null, cast?.filled ?? 0);
    } catch (e) {
      console.error("[sports] fill:", e);
      await releaseFill(seasonId, "Couldn't fill in who's playing. Try again in a bit.", null).catch(() => {});
    }
  };
  try {
    after(run);
  } catch {
    await run();
  }
  return true;
}

/** After the answer (a sport just added): link its season and fill in its people. Outside a request the daily listings job does it. */
export function linkLater(seasonId: string) {
  try {
    after(task);
  } catch {
    /* not in a request */
  }
  async function task() {
    try {
      await followSeason(seasonId);
    } catch (e) {
      console.error("[sports] link later:", e);
    }
  }
}

/**
 * The daily listings job's part: every sport season on now (or finished in the last fortnight) with episodes still to link, when
 * it's due a look (sports_links.next_at) or its listing changed since; each linked, then its people filled in or added to. `only`
 * (a check's seasons) looks at just those, archived or not.
 */
export async function linkSportSeasons(opts: { providers?: SportsProvider[]; now?: Date; only?: string[] } = {}): Promise<{ seasons: number; linked: number; people: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const { rows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id LEFT JOIN sports_links l ON l.season_id = ss.id
      WHERE s.kind = 'sport'
        AND (CASE WHEN $2::uuid[] IS NULL THEN s.archived = false AND (ss.status <> 'completed' OR ss.finale_date >= ($1::timestamptz - interval '14 days')::date)
                  ELSE ss.id = ANY($2::uuid[]) END)
        AND (l.season_id IS NULL OR l.next_at <= $1 OR EXISTS (SELECT 1 FROM season_episodes e WHERE e.season_id = ss.id AND e.updated_at > l.checked_at))
        AND EXISTS (SELECT 1 FROM season_episodes e WHERE e.season_id = ss.id AND e.air_at <= $1::timestamptz + interval '8 days'
                     AND NOT EXISTS (SELECT 1 FROM season_events v WHERE v.season_id = e.season_id AND v.episode = e.number))
      ORDER BY ss.premiere_date DESC NULLS LAST LIMIT ${MAX_SEASONS}`,
    [now, opts.only ?? null]
  );
  let linked = 0;
  let people = 0;
  const errors: string[] = [];
  for (const r of rows) {
    try {
      const f = await followSeason(r.id, { providers: opts.providers, now });
      linked += f.link.added;
      people += f.cast?.filled ?? 0;
    } catch (e) {
      console.error("[sports] link:", e);
      errors.push((e as Error).message.slice(0, 200));
    }
  }
  return { seasons: rows.length, linked, people, errors };
}
