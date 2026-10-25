import type { Pool, PoolClient } from "pg";

type Queryable = Pool | PoolClient;

/** show_seasons.id for (show id, season number), or null. */
export function seasonIdFor(pool: Queryable, showId: string, seasonNumber: number): Promise<string | null>;

/** The season's cast as a minimal league-shaped state, for the forgiving name match. */
export function seasonCastState(pool: Queryable, seasonId: string): Promise<{ castaways: { id: string; name: string; tribeName: string | null; status: string }[]; tribes: []; episodes: []; settings: Record<string, never> }>;

/** The season cast's spelling of a name, or the name as given when it doesn't resolve. */
export function canonicalName(castState: Awaited<ReturnType<typeof seasonCastState>>, name: string): string;

/** Upserts one read's worth of decisions for a season (pending rows only move). */
export function stageDecisions(
  pool: Pool,
  seasonId: string,
  items: unknown[],
  source: "wiki" | "research",
  refId: string | null,
  scope?: { episode?: number }
): Promise<{ inserted: number; updated: number; withdrawn: number }>;
