import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { linkCandidates } from "@/lib/server/desk-seat-moves";

// Link an account's list (docs/PLAN-desk-parity.md part 6b): GET ?q= (every account by name, username or email, six at a
// time, the couch's first; none: the couch's people without a seat in the game) &seat= (the account in the seat being
// linked, which can't be chosen). Each says what linking them means here.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await linkCandidates(user, (await params).id, { q: q.get("q"), seat: q.get("seat") }));
});
