import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// "How this league works" (docs/PLAN-league-explainer.md) was finished or skipped: it doesn't open by
// itself again in this league. Replays (More -> How this league works) never call this.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  await pool.query(
    "UPDATE league_memberships SET explainer_seen_at = now() WHERE league_id=$1 AND user_id=$2 AND explainer_seen_at IS NULL",
    [leagueId, user.id]
  );
  return NextResponse.json({ ok: true });
});
