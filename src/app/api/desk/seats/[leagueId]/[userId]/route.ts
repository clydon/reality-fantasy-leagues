import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { setSeatRole, unlinkSeat } from "@/lib/server/desk-seats";

// A seat on the desk (docs/PLAN-desk-parity.md step 1 part 1c; step 6b's game page shares it): the account `userId`
// signed in to its seat in the game `leagueId`. POST `{ role: "commissioner" | "admin" | "member" }` or `{ unlink: true }`,
// each tier 1, answering `{ changeId, text }` for the toast and its Undo. The only Commissioner's are refused (409).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; userId: string }> }) => {
  const user = await requireDesk(req);
  const { leagueId, userId } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" ? raw : {}) as { role?: unknown; unlink?: unknown };
  if ("role" in body) return NextResponse.json(await setSeatRole(user, leagueId, userId, body.role));
  if (body.unlink === true) return NextResponse.json(await unlinkSeat(user, leagueId, userId));
  throw new HttpError(400, "role, or unlink");
});
