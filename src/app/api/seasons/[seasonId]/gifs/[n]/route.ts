import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { episodeGifs, episodeNumber, reactToEpisode } from "@/lib/server/episode-gifs";
import { gifsFor } from "@/lib/server/gifs";

// React with a GIF (docs/PLAN-gif-reactions.md; episode-gifs.ts), for an episode you've seen, on a couch (`?couch=`; without one,
// or on a couch of one, only yours):
//   GET   yours, and the couch's people who picked one; `search` says whether GIFs are set up here (KLIPY_API_KEY)
//   POST  { gif } (a pick from /api/gifs) yours, or again; { gif: null } takes it back; answers as GET does
// 403 for an episode you haven't seen.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const read = await episodeGifs(user, seasonId, new URL(req.url).searchParams.get("couch"), episodeNumber(n));
  return NextResponse.json({ ...read, search: !!gifsFor(req) });
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { gif?: unknown };
  const src = gifsFor(req);
  const read = await reactToEpisode(user, seasonId, new URL(req.url).searchParams.get("couch"), n, body, src);
  return NextResponse.json({ ...read, search: !!src });
});
