import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { linkSeat, putBack, takeOutSeat } from "@/lib/server/desk-seat-moves";
import { setSeatRole, unlinkSeat } from "@/lib/server/desk-seats";

// A seat on the desk (docs/PLAN-desk-parity.md step 1 part 1c and step 6 part 6b): the account `userId` signed in to its seat
// in the game `leagueId`, or out of it. POST `{ role: "commissioner" | "admin" | "member" }`, `{ unlink: true }`, `{ link:
// { to, role } }` (another account signs in to their seat; they come out), `{ takeOut: true }` (tier 3, the app's takeOut)
// or `{ putBack: true }` (someone out of the game back in their own seat), each answering `{ changeId, text }` for the toast
// and its Undo. The only Commissioner's are refused (409). Classic's league memberships and players routes stay until step 8.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; userId: string }> }) => {
  const user = await requireDesk(req);
  const { leagueId, userId } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" ? raw : {}) as { role?: unknown; unlink?: unknown; link?: unknown; takeOut?: unknown; putBack?: unknown };
  if ("role" in body) return NextResponse.json(await setSeatRole(user, leagueId, userId, body.role));
  if (body.unlink === true) return NextResponse.json(await unlinkSeat(user, leagueId, userId));
  if (body.link && typeof body.link === "object") return NextResponse.json(await linkSeat(user, leagueId, { userId }, body.link as { to?: unknown; role?: unknown }));
  if (body.takeOut === true) return NextResponse.json(await takeOutSeat(user, leagueId, userId));
  if (body.putBack === true) return NextResponse.json(await putBack(user, leagueId, { userId }));
  throw new HttpError(400, "role, unlink, link, takeOut or putBack");
});
