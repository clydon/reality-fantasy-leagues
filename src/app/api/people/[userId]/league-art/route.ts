import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { leaguePictureOf } from "@/lib/server/league-art";

// Someone's own picture for a league's art (docs/design-round/league-art-spec.md; league-art.ts), for themselves or whoever's on a
// couch with them, as a face is. Its link carries the version (?v=), so the browser keeps it for good. Private: never a shared cache.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;
  const viewer = await requireAuth(req);
  const pic = await leaguePictureOf(viewer, userId, new URL(req.url).searchParams.get("league") ?? "");
  if (!pic) return NextResponse.json({ error: "No picture" }, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  return new Response(new Uint8Array(pic.bytes), {
    headers: { "Content-Type": pic.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
