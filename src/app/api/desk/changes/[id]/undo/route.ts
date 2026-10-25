import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { undoDesk } from "@/lib/server/desk-undo";

// History's Undo on the desk (step 6b part 2): one admin change taken back.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await undoDesk(user, id));
});
