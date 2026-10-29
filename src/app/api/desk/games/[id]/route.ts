import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deleteForGood, deskGame, deskGameAction } from "@/lib/server/desk-games";

// A game on the desk (docs/PLAN-desk-parity.md part 6a): GET it (its lower third and facts, Part of, its join code, History).
// POST `{ archive: true }` (tier 1, answering `{ changeId, text }` for the toast's Undo), `{ delete: true }` (tier 3:
// restorable for 30 days, its players told; `{ text }`) or `{ restore: true }` (a deleted one back as it was, with Undo).
// DELETE: a deleted game for good, now. Classic's DELETE /api/admin/leagues/[leagueId] (a hard delete, and the couch with
// it when it had no games left) stays until step 8.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskGame((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { archive?: unknown; delete?: unknown; restore?: unknown };
  return NextResponse.json(await deskGameAction(user, id, body));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deleteForGood(user, (await params).id));
});
