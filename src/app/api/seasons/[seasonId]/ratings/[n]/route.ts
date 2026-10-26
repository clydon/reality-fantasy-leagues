import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { episodeVerdict, rateEpisode } from "@/lib/server/ratings";

// Rate it (docs/PLAN-new-design.md step 12 part 1; ratings.ts), for an episode you've seen, on a couch (`?couch=`; without one,
// or on a couch of one, the verdict is everyone on Game Your Show's):
//   GET   the episode's verdict: your stars and take, the couch's people who rated it, their stars and takes, the average
//   POST  { stars: 1-5, take?: string ("" takes it away) }: rate it, or again; answers the verdict
// 403 for an episode you haven't seen.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const episode = Number(n);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "Which episode?");
  return NextResponse.json(await episodeVerdict(user, seasonId, new URL(req.url).searchParams.get("couch"), episode));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { stars?: unknown; take?: unknown };
  return NextResponse.json(await rateEpisode(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body));
});
