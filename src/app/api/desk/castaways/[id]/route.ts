import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskCastaway, lockCastaway, overrideCastaway } from "@/lib/server/desk-cast";

// A castaway on the desk (step 6b part 2): GET; POST `{ field: "name" | "group" | "photo", value }` (Override: every league
// on the season) or `{ lock: boolean }`.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskCastaway((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { lock?: unknown; field?: unknown; value?: unknown };
  if (typeof body.lock === "boolean") return NextResponse.json(await lockCastaway(user, id, body.lock));
  return NextResponse.json(await overrideCastaway(user, id, body));
});
