import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { setLeagueRole } from "@/lib/server/roles";
import { roleChange } from "@/lib/server/change-log";

// A member's role in this league (db/migrations/0105, roles.ts): body { role: "commissioner" | "admin" |
// "member" }. A Commissioner hands it off or shares it; the last one can't step down (409). The new design's
// Backstage › Members (step 6a) is its screen; the classic app has none.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; userId: string }> }) => {
  const { leagueId, userId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { role } = (await req.json().catch(() => ({}))) as { role?: unknown };
  // A line in Recent changes (step 5), in the same transaction, with Undo.
  const set = await setLeagueRole(leagueId, userId, role, (client, before) => roleChange(client, leagueId, user.id, userId, before, String(role)));
  return NextResponse.json({ role: set });
});
