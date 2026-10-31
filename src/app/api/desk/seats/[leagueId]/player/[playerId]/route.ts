import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { eraseSeat, linkSeat, putBack, removeSeat } from "@/lib/server/desk-seat-moves";

// A seat with nobody signed in to it, by its player id (docs/PLAN-desk-parity.md part 6b): POST `{ link: { to, role } }`
// (tier 1: an account signs in to it), `{ remove: true }` (tier 3: disabled after a draft, gone before) or `{ putBack: true }`
// (a removed seat back, waiting for an account), each answering `{ changeId, text }` for the toast and its Undo; `{ erase: true }`
// (tier 3, no Undo, 2026-10-31): a seat that's out of the game leaves it whole, answering `{ text }`.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; playerId: string }> }) => {
  const user = await requireDesk(req);
  const { leagueId, playerId } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" ? raw : {}) as { link?: unknown; remove?: unknown; putBack?: unknown; erase?: unknown };
  if (body.link && typeof body.link === "object") return NextResponse.json(await linkSeat(user, leagueId, { playerId }, body.link as { to?: unknown; role?: unknown }));
  if (body.remove === true) return NextResponse.json(await removeSeat(user, leagueId, playerId));
  if (body.putBack === true) return NextResponse.json(await putBack(user, leagueId, { playerId }));
  if (body.erase === true) return NextResponse.json(await eraseSeat(user, leagueId, playerId));
  throw new HttpError(400, "link, remove, putBack or erase");
});
