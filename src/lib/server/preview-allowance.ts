import { pool } from "./db";
import { HttpError } from "./http-error";

// The previews someone can make a day (docs/PLAN-preview-release.md, decision 4 and step 8), in the app's own database: one
// preview_uses row each time one is made, counted over their own day (user_settings.tz, else the app's Eastern). Reopening a
// preview they have costs nothing; a preview that fails to be made gives its use back. Shown as "You have 3 previews left today".
export const PER_DAY = 5;
const DAY_START = `date_trunc('day', now() AT TIME ZONE COALESCE((SELECT tz FROM user_settings WHERE user_id = $1), 'America/New_York')) AT TIME ZONE COALESCE((SELECT tz FROM user_settings WHERE user_id = $1), 'America/New_York')`;

/** How many previews `userId` has left today. */
export async function previewsLeft(userId: string): Promise<{ left: number; perDay: number }> {
  const { rows } = await pool.query(`SELECT count(*)::int AS k FROM preview_uses WHERE user_id = $1 AND made_at >= ${DAY_START}`, [userId]);
  return { left: Math.max(0, PER_DAY - rows[0].k), perDay: PER_DAY };
}

/** One of today's previews, taken (refused when none is left): its use's id, to give back if the preview isn't made. */
export async function takePreview(userId: string): Promise<{ useId: string; left: number }> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    // One take at a time per person, so two taps can't both take the last.
    await db.query("SELECT pg_advisory_xact_lock(hashtext('preview-use:' || $1))", [userId]);
    const { rows } = await db.query(`SELECT count(*)::int AS k FROM preview_uses WHERE user_id = $1 AND made_at >= ${DAY_START}`, [userId]);
    if (rows[0].k >= PER_DAY) throw new HttpError(429, "No previews left today: more tomorrow.");
    const { rows: made } = await db.query(`INSERT INTO preview_uses (user_id) VALUES ($1) RETURNING id`, [userId]);
    await db.query("COMMIT");
    return { useId: String(made[0].id), left: PER_DAY - rows[0].k - 1 };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

/** A preview that wasn't made gives its use back. */
export async function giveBack(useId: string) {
  await pool.query(`DELETE FROM preview_uses WHERE id = $1`, [useId]);
}
