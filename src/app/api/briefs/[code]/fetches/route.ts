import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { briefFetches } from "@/lib/server/ai-briefs";

// Who has read a brief: the ask-ai row's "read by" line, so testing a chat shows straight away
// whether it opened the page. Admin-only while the experiment runs.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ code: string }> }) => {
  await requireSuperAdmin(req);
  const { code } = await params;
  return NextResponse.json({ fetches: await briefFetches(code) });
});
