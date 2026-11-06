import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isImpersonating, requireAuthSession } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// The first-time tour (docs/PLAN-first-time-tour.md; migration 0158): finished or skipped, so Home doesn't play it again. The
// home read says whether it has (`user.tourSeen`). Kept per account: when it was first seen, and the furthest step it got to.
// An admin acting as someone can take it, but it isn't marked seen for them (0048 was the same bug for What's New).
// Body: { reached: number } (1-based; the step count when it was finished).
export const POST = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const body = (await req.json().catch(() => ({}))) as { reached?: unknown };
  const reached = body.reached;
  if (typeof reached !== "number" || !Number.isInteger(reached) || reached < 1 || reached > 20) {
    throw new HttpError(400, "reached must be the step the tour got to");
  }
  if (isImpersonating(session)) return NextResponse.json({ ok: true, kept: false });
  await pool.query(
    `INSERT INTO user_settings (user_id, tour_seen_at, tour_reached) VALUES ($1, now(), $2)
     ON CONFLICT (user_id) DO UPDATE SET
       tour_seen_at = COALESCE(user_settings.tour_seen_at, now()),
       tour_reached = GREATEST(COALESCE(user_settings.tour_reached, 0), $2),
       updated_at = now()`,
    [session.user.id, reached]
  );
  return NextResponse.json({ ok: true, kept: true });
});
