import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { removeMember } from "@/lib/server/backstage-members";

// Takes someone out of the couch's games here (step 6a, tier 3: the screen asks for a hold). `{ preview: true }` answers
// what it would do (their games, whether their seat stays in the standings) and why it can't (the last Commissioner).
// Restorable from Recent changes for 30 days. `{ league }`: out of that one game only (settings Round 3a, A14).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; userId: string }> }) => {
  const { seasonId, userId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { preview?: unknown; league?: unknown };
  const league = typeof body.league === "string" && body.league ? body.league : null;
  return NextResponse.json(await removeMember(user, seasonId, new URL(req.url).searchParams.get("couch"), userId, body.preview === true, league));
});
