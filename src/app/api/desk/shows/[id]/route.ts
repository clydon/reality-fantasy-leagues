import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskShow, deskShowAction } from "@/lib/server/desk-couches";

// A show on the desk (step 6b part 2): its seasons, who added it. POST { action: "reviewed" | "archive" | "season" } (step 10
// part 3): Looks fine, archived, or its next season ({ seasonId }).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskShow((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deskShowAction(user, (await params).id, await req.json().catch(() => ({}))));
});
