import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pictureOf } from "@/lib/server/profile";

// Someone's picture (docs/PLAN-new-design.md step 15 part 1), for whoever's on a couch with them. Its link carries the
// picture's version (?v=), so the browser keeps it for good and asks again only when it changes: one read per person and
// version. Private: a picture is for the couch, not a shared cache.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;
  const viewer = await requireAuth(req);
  const pic = await pictureOf(viewer, userId);
  if (!pic) return NextResponse.json({ error: "No picture" }, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  return new Response(new Uint8Array(pic.bytes), {
    headers: { "Content-Type": pic.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
