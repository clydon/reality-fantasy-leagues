import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { episodeResults } from "@/lib/server/episode-results";

// One episode's shared results for its page (step 6b): each result with how sure the shared check is of it, your flags,
// the corrections that reached the couch's games and any house ruling. Only once you've seen the episode (403 before).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string; episode: string }> }) => {
  const { seasonId, episode } = await params;
  const user = await requireAuth(req);
  const n = Number(episode);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "episode required");
  return NextResponse.json(await episodeResults(user, seasonId, new URL(req.url).searchParams.get("couch"), n));
});
