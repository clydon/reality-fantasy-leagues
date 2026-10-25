import { QUICK_DOUBTS, type QuickDoubt } from "@/lib/game/results-changes";
import type { QuickAnswer } from "@db/bot-research.js";
import { pool } from "./db";

// A quick check that waits (docs/PLAN-new-design.md step 6c; db/migrations/0115): an answer about who went home that
// can't be trusted on its own (one source, a name not in the cast, no way out given). Step 5 kept it only on the open
// page; now it's kept here until someone who runs a game says It's right or Not right, or results arrive another way. A
// couch's own (pasted, or One tap) shows on that couch; the bot's scheduled check (couch_id NULL) on every couch with a
// game on the season. The answer keeps its names: Backstage shows them only behind Show me.

export type WaitVia = "paste" | "tap" | "autopilot";

export interface QuickWait {
  id: string;
  episode: number;
  /** Null: the bot's own check, shown to every couch on the season. */
  couchId: string | null;
  via: WaitVia;
  /** Who sent it (null for the bot's own), by name and id. */
  by: string | null;
  sentBy: string | null;
  at: string;
  doubt: QuickDoubt;
  /** The doubt in a sentence. */
  line: string;
  sources: number;
  answer: QuickAnswer;
}

/** Keeps an answer that waits, in place of any the same couch (or the bot) left waiting for the episode. */
export async function keepWait(input: { seasonId: string; episode: number; couchId: string | null; sentBy: string | null; via: WaitVia; answer: QuickAnswer; doubt: QuickDoubt }): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE quick_waits SET closed_at = now(), outcome = 'replaced'
        WHERE season_id = $1 AND episode_number = $2 AND couch_id IS NOT DISTINCT FROM $3 AND closed_at IS NULL`,
      [input.seasonId, input.episode, input.couchId]
    );
    const { rows } = await client.query(
      `INSERT INTO quick_waits (season_id, episode_number, couch_id, sent_by, via, answer, doubt) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
      [input.seasonId, input.episode, input.couchId, input.sentBy, input.via, JSON.stringify(input.answer), input.doubt]
    );
    await client.query("COMMIT");
    return rows[0].id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** The newest answer waiting for an episode on this couch: the couch's own, else the bot's. */
export async function openWait(seasonId: string, episode: number, couchId: string): Promise<QuickWait | null> {
  const { rows } = await pool.query(
    `SELECT w.id, w.episode_number, w.couch_id, w.via, w.answer, w.doubt, w.created_at, w.sent_by, COALESCE(u.username, u.name) AS who
       FROM quick_waits w LEFT JOIN "user" u ON u.id = w.sent_by
      WHERE w.season_id = $1 AND w.episode_number = $2 AND (w.couch_id = $3 OR w.couch_id IS NULL) AND w.closed_at IS NULL
      ORDER BY (w.couch_id IS NULL), w.created_at DESC LIMIT 1`,
    [seasonId, episode, couchId]
  );
  const r = rows[0];
  if (!r) return null;
  const doubt = (r.doubt in QUICK_DOUBTS ? r.doubt : "one-source") as QuickDoubt;
  return {
    id: r.id,
    episode: r.episode_number,
    couchId: r.couch_id,
    via: r.via,
    by: r.who ?? null,
    sentBy: r.sent_by ?? null,
    at: r.created_at.toISOString(),
    doubt,
    line: QUICK_DOUBTS[doubt],
    sources: Array.isArray(r.answer?.sources) ? r.answer.sources.length : 0,
    answer: r.answer,
  };
}

/**
 * Closes one wait a couch can see (It's right, Not right: its own, or the bot's), or every one a couch or the bot left
 * for an episode (results came in).
 */
export async function closeWaits(
  where: { id: string; seasonId: string; couchId: string } | { seasonId: string; episode: number; couchId: string | null },
  outcome: "right" | "not-right" | "replaced",
  by: string | null
): Promise<void> {
  if ("id" in where) {
    await pool.query(
      `UPDATE quick_waits SET closed_at = now(), closed_by = $4, outcome = $5
        WHERE id = $1 AND season_id = $2 AND (couch_id = $3 OR couch_id IS NULL) AND closed_at IS NULL`,
      [where.id, where.seasonId, where.couchId, by, outcome]
    );
    return;
  }
  await pool.query(
    `UPDATE quick_waits SET closed_at = now(), closed_by = $4, outcome = $5
      WHERE season_id = $1 AND episode_number = $2 AND couch_id IS NOT DISTINCT FROM $3 AND closed_at IS NULL`,
    [where.seasonId, where.episode, where.couchId, by, outcome]
  );
}
