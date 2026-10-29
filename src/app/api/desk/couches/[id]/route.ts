import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { couchFill, deskCouch } from "@/lib/server/desk-couches";

// A couch on the desk (step 6b part 2): GET; POST `{ anyone: boolean }` (Override who fills in its results). Its games nobody
// runs are handed on through /api/desk/hand-on (docs/PLAN-desk-parity.md step 2: Hand on with no `from`).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskCouch((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { anyone?: unknown };
  if ("anyone" in body) return NextResponse.json(await couchFill(user, id, body.anyone));
  throw new HttpError(400, "anyone");
});
