import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskCouch, deskCouchAction } from "@/lib/server/desk-couches";

// A couch on the desk (step 6b part 2): GET it (a deleted one too, within its 30 days); POST `{ anyone: boolean }` (Override
// who fills in its results), `{ delete: true }` (docs/PLAN-desk-parity.md part 6d, tier 3: its games go too, its people come
// off it and are told, restorable for 30 days from Couches › Deleted; `{ text }`) or `{ restore: true }` (a deleted one back
// with its people and the games it took; `{ changeId, text }` for the toast's Undo). Its games nobody runs are handed on
// through /api/desk/hand-on (docs/PLAN-desk-parity.md step 2: Hand on with no `from`).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskCouch((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { anyone?: unknown; delete?: unknown; restore?: unknown };
  return NextResponse.json(await deskCouchAction(user, id, body));
});
