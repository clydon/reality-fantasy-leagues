import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskPerson } from "@/lib/server/desk-couches";

// A person on the desk (step 6b part 2): their couches and games, to look up.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskPerson((await params).id));
});
