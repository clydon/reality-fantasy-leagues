import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { appOnly, endPreview } from "@/lib/server/previews";

// Your preview, gone (docs/PLAN-preview-release.md, decision 6): the game made from it, or you're done with it. Kept or not.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  appOnly();
  const { id } = await params;
  await endPreview(await requireAuth(req), id);
  return NextResponse.json({ ok: true });
});
