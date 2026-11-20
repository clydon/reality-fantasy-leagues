import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { closeLivePreview, livePreviewEntry, livePreviewStory } from "@/lib/server/preview-live";

// A live preview (src/lib/server/preview-live.ts), by the session asking: its viewer's on the preview host, or its owner's.
//   GET     its story: the moments as they stand, for its page on the preview host
//   POST    a new way into it, for its owner opening it again (one use, minutes long)
//   DELETE  close it: its copies go now rather than when it ends
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
  await closeLivePreview(id, await requireAuth(req));
  return NextResponse.json({ ok: true });
});
