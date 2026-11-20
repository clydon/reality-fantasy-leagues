import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/http-error";
import { makeLivePreview } from "@/lib/server/preview-live";

// Make a game's preview now (docs/PLAN-game-preview.md, "On demand"; src/lib/server/preview-live.ts): a made-up season played on the
// server and each of its moments written as a temporary copy of the game, for the story to show live. In development and on the preview service. The first
// moment answers, with a way into its story used once; the rest are written after the response, inside this route's time.
export const maxDuration = 120;

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; season?: unknown; couch?: unknown };
  if (typeof body.game !== "string") throw new HttpError(400, "Which game?");
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return NextResponse.json(await makeLivePreview(user, body.game, { seasonId: str(body.season), couchId: str(body.couch) ?? null }));
});
