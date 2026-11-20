import { pool } from "./db";
import { HttpError } from "./http-error";
import { previewsLeftIn, SHARE_FLOOR, weeklyShare, weeksLeftIn } from "@/lib/preview-share";

// The previews someone can make a week (docs/PLAN-preview-release.md, decision 4, revised 2026-11-20), in the app's own database: one
// preview_uses row each time one is made, counted over their own week (Monday on, user_settings.tz, else the app's Eastern). The
// week's allowance is their share of the month's budget (src/lib/preview-share.ts: what's left, split between the people previewing
// lately, over the weeks left, 3 to 20), worked out at the first look of their week and kept for it (preview_week_shares). Reopening
// a preview they have costs nothing; a preview that fails to be made gives its use back. Shown as "12 previews left this week".

/** This month's ledger as the preview service keeps it (previews.ts previewUsage), or null when it can't be read. */
export type MonthUsage = { previews: number; cpuMs: number; budgetMs: number } | null;
/** Reads the month only when a share has to be worked out (once a person a week). */
export type MonthReader = () => Promise<MonthUsage>;

const TZ = `COALESCE((SELECT tz FROM user_settings WHERE user_id = $1), 'America/New_York')`;
/** The person's Monday, as a date in their own time zone, and the moment it started. */
const WEEK_DATE = `(date_trunc('week', now() AT TIME ZONE ${TZ}))::date`;
const WEEK_START = `date_trunc('week', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`;

type Db = Pick<typeof pool, "query">;

/** The month's share now, for anyone: previews left in the budget, people who previewed in the last 30 days, weeks left; null
 *  while the month can't be read. (The desk's line, and each week's allowance as it's fixed.) */
export async function shareNow(month: MonthUsage, db: Db = pool, now = new Date()) {
  if (!month) return null;
  const { rows: [p] } = await db.query(`SELECT count(DISTINCT user_id)::int AS k FROM preview_uses WHERE made_at >= now() - interval '30 days'`);
  const basis = { previewsLeft: previewsLeftIn(month), people: p.k as number, weeksLeft: Math.round(weeksLeftIn(now) * 100) / 100 };
  return { each: weeklyShare(basis), ...basis };
}

/** `userId`'s allowance this week: the one fixed at the first look of their week, else their share now (fixed if the month could
 *  be read; the floor, unfixed, if it couldn't, so a moment the service is away never sets a whole week). */
async function weekAllowance(db: Db, userId: string, month: MonthReader): Promise<number> {
  const { rows: [had] } = await db.query(`SELECT allowance FROM preview_week_shares WHERE user_id = $1 AND week_start = ${WEEK_DATE}`, [userId]);
  if (had) return had.allowance;
  const share = await shareNow(await month(), db);
  if (!share) return SHARE_FLOOR;
  const { each, ...basis } = share;
  const { rows: [kept] } = await db.query(
    `INSERT INTO preview_week_shares (user_id, week_start, allowance, basis) VALUES ($1, ${WEEK_DATE}, $2, $3)
       ON CONFLICT (user_id, week_start) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING allowance`,
    [userId, each, JSON.stringify(basis)]
  );
  return kept.allowance;
}

const usedThisWeek = async (db: Db, userId: string) =>
  (await db.query(`SELECT count(*)::int AS k FROM preview_uses WHERE user_id = $1 AND made_at >= ${WEEK_START}`, [userId])).rows[0].k as number;

/** How many previews `userId` has left this week, of their week's allowance. */
export async function previewsLeft(userId: string, month: MonthReader): Promise<{ left: number; perWeek: number }> {
  const perWeek = await weekAllowance(pool, userId, month);
  return { left: Math.max(0, perWeek - (await usedThisWeek(pool, userId))), perWeek };
}

/** One of this week's previews, taken (refused when none is left): its use's id, to give back if the preview isn't made. */
export async function takePreview(userId: string, month: MonthReader): Promise<{ useId: string; left: number }> {
  // The week's allowance first (it may ask the service, which mustn't hold the lock), then the take under it.
  const perWeek = await weekAllowance(pool, userId, month);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    // One take at a time per person, so two taps can't both take the last.
    await db.query("SELECT pg_advisory_xact_lock(hashtext('preview-use:' || $1))", [userId]);
    const used = await usedThisWeek(db, userId);
    if (used >= perWeek) throw new HttpError(429, "No previews left this week: more Monday.");
    const { rows: made } = await db.query(`INSERT INTO preview_uses (user_id) VALUES ($1) RETURNING id`, [userId]);
    await db.query("COMMIT");
    return { useId: String(made[0].id), left: perWeek - used - 1 };
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
