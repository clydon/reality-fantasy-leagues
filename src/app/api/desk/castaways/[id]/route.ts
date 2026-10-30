import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deskCastaway, lockCastaway, lookPhoto, overrideCastaway, removeCastaway } from "@/lib/server/desk-cast";
import { listingsFor } from "@/lib/server/listings";

// A castaway on the desk (step 6b part 2; docs/PLAN-desk-parity.md part 5b): GET their page; POST `{ field: "name" | "group" |
// "photo", value }` (Override: every game on the season, `{ changeId, text }` for the toast's Undo), `{ lock: boolean }`, `{ look:
// true }` (Look on TMDB and TVmaze: a photo of them, nothing changed) or `{ remove: true }` (Remove from the cast: refused while
// anything has them).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskCastaway((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { lock?: unknown; look?: unknown; remove?: unknown; field?: unknown; value?: unknown };
  if (typeof body.lock === "boolean") return NextResponse.json(await lockCastaway(user, id, body.lock));
  if (body.look === true) return NextResponse.json(await lookPhoto(id, listingsFor(req)));
  if (body.remove === true) return NextResponse.json(await removeCastaway(user, id));
  return NextResponse.json(await overrideCastaway(user, id, body));
});
