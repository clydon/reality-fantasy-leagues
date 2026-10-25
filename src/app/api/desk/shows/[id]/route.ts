import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskShow } from "@/lib/server/desk-couches";

// A show on the desk (step 6b part 2): its seasons.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskShow((await params).id));
});
