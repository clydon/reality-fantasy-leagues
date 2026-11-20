import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { keepLivePreview } from "@/lib/server/preview-live";

// Keep a live preview while its game is made (docs/PLAN-preview-release.md, decision 6): its story left for its last card's Go back
// or Create this game. By its viewer's session (the story, on the preview host) or its owner's.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await keepLivePreview(id, await requireAuth(req)));
});
