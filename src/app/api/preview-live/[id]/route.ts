import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { closeLivePreview, livePreviewStory } from "@/lib/server/preview-live";

// A live preview's story (src/lib/server/preview-live.ts), by its pass (?e=&t=): its moments, for its page on the preview host; and
// closing it, its copies gone now rather than at the half hour, by its story (the pass) or whoever made it. Development only.
const passOf = (req: Request) => {
  const q = new URL(req.url).searchParams;
  return { expires: Number(q.get("e")), pass: q.get("t") ?? "" };
};

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { expires, pass } = passOf(req);
  return NextResponse.json(livePreviewStory(id, expires, pass));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const by = passOf(req);
  await closeLivePreview(id, by.pass ? by : { userId: (await requireAuth(req)).id });
  return NextResponse.json({ ok: true });
});
