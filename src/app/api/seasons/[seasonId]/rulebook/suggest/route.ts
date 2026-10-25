import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { suggestFix } from "@/lib/server/desk-rulebooks";

// "Something off? Suggest a fix" from How it works (step 6b part 2): `{ about: "segment" | "wayOut" | "scores" | "other", note }`, for
// the desk's Inbox. Nothing changes until the admin fixes the rulebook.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const user = await requireAuth(req);
  const { seasonId } = await params;
  return NextResponse.json(await suggestFix(user, seasonId, new URL(req.url).searchParams.get("couch"), await req.json().catch(() => ({}))));
});
