import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskBingo, hideSquare, pasteSquares } from "@/lib/server/desk-bingo";

// A season's Bingo bank (docs/PLAN-desk-parity.md step 4, part 4c; src/lib/server/desk-bingo.ts): GET `?bank=<n>|season` the
// page on that bank; POST `{ bank, paste, preview? }` Paste squares (what it keeps said first, then filed: tier 2), or
// `{ square, hide }` Hide it from new cards or Show it again (tier 1). Each change answers `{ changeId, text }` for the
// toast's Undo. Write them again is Research's Run now (POST .../runs, kind bingo).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await deskBingo(user, id, new URL(req.url).searchParams.get("bank")));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { bank?: unknown; paste?: unknown; preview?: unknown; square?: unknown; hide?: unknown };
  if (body.square !== undefined) return NextResponse.json(await hideSquare(user, id, body));
  return NextResponse.json(await pasteSquares(user, id, body));
});
