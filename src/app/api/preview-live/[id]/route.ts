import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/http-error";
import { closeByOwner, closeLivePreview, livePreviewEntry, livePreviewStory } from "@/lib/server/preview-live";
import { signedBy } from "@/lib/server/preview-signature";

// A live preview (src/lib/server/preview-live.ts), by the session asking: its viewer's on the preview host, or its owner's.
//   GET     its story: the moments as they stand, for its page on the preview host
//   POST    a new way into it, for its owner opening it again (one use, minutes long)
//   DELETE  close it: its copies go now rather than when it ends (the app's own ask, signed, removes it even kept)
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await livePreviewStory(id, await requireAuth(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json({ id, entry: await livePreviewEntry(await requireAuth(req), id) });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // The app's own ask (signed: its owner, by their key), or the story's or its owner's session.
  if (req.headers.get("x-preview-signature")) {
    const text = await req.text();
    if (!signedBy(req, text)) throw new HttpError(401, "Not the app's");
    const { owner } = JSON.parse(text) as { owner?: unknown };
    if (typeof owner !== "string") throw new HttpError(400, "Whose?");
    await closeByOwner(id, owner);
  } else await closeLivePreview(id, await requireAuth(req));
  return NextResponse.json({ ok: true });
});
