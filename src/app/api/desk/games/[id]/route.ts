import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deleteForGood, deskGame, deskGameAction, gameOpen, openReadOnly } from "@/lib/server/desk-games";
import { gameSeats } from "@/lib/server/desk-seat-moves";

// A game on the desk (docs/PLAN-desk-parity.md part 6a): GET it (its lower third and facts, how it opens from part 6c, Part
// of, its join code, its seats from part 6b, History).
// POST `{ archive: true }` (tier 1, answering `{ changeId, text }` for the toast's Undo), `{ delete: true }` (tier 3:
// restorable for 30 days, its players told; `{ text }`), `{ restore: true }` (a deleted one back as it was, with Undo) or
// `{ open: true }` (part 6c: Open it read-only's History line, answering what the show space opens).
// DELETE: a deleted game for good, now. (Classic's hard delete, the couch with it when it had no games left, retired at
// docs/PLAN-desk-parity.md step 8.)
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const [game, seats] = await Promise.all([deskGame(id), gameSeats(user, id)]);
  return NextResponse.json({ ...game, seats, open: await gameOpen(user, game) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { archive?: unknown; delete?: unknown; restore?: unknown; open?: unknown };
  if (body.open === true) return NextResponse.json(await openReadOnly(user, id));
  return NextResponse.json(await deskGameAction(user, id, body));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deleteForGood(user, (await params).id));
});
