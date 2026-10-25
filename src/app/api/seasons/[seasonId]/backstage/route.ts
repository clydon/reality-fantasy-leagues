import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageRead, backstageScope } from "@/lib/server/backstage";

// Backstage for a couch's season (docs/PLAN-new-design.md step 5), for whoever runs a game there: the episodes still
// open, what needs you, and where results stand, naming nobody. `&episode=N` asks about one; `&show=1` is Show me (who
// went home and what happened, and who's still in, for entering it yourself). Not polled.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await backstageScope(user, seasonId, q.get("couch"));
  const episode = Number(q.get("episode"));
  return NextResponse.json(await backstageRead(scope, { episode: Number.isInteger(episode) && episode > 0 ? episode : null, show: q.get("show") === "1" }));
});
