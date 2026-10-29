import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskPerson } from "@/lib/server/desk-people";

// A person on the desk (docs/PLAN-desk-parity.md step 1): who they are, their couches and games, their History.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deskPerson(user, (await params).id));
});
