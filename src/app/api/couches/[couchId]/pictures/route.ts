import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { couchPictureOf } from "@/lib/server/couch-pictures";

// One of a couch's pictures (docs/PLAN-team-logos.md L4), for someone on that couch: ?key=team:<league>:<team id>. Its link carries
// the picture's version (&v=), so the browser keeps it for good and asks again only when it changes. Private: a couch's picture is
// for the couch, never a shared cache, and a 404 says nothing about whether the couch has one.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ couchId: string }> }) => {
  const { couchId } = await params;
  const viewer = await requireAuth(req);
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const pic = /^[0-9a-f-]{36}$/i.test(couchId) && key ? await couchPictureOf(viewer, couchId, key) : null;
  if (!pic) return NextResponse.json({ error: "No picture" }, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  return new Response(new Uint8Array(pic.bytes), {
    headers: { "Content-Type": pic.type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
