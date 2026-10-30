import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { listingsFor } from "@/lib/server/listings";
import { linkListing, setCount, setWhen, unlinkListing } from "@/lib/server/desk-schedule";
import { deskSetup, setResultsBy, setSeasonName, setSeasonStatus } from "@/lib/server/desk-setup";

// A season's Setup (docs/PLAN-desk-parity.md step 3, part 3a): GET the page; POST one change, each tier 1 with a History
// line and Undo: `{ name }` (blank shows the show and its number), `{ status }` (held over its TV listing's dates),
// `{ statusBack: true }` (its listing's dates move it again), `{ resultsBy: 'leagues' | 'admin' }`. Answers
// `{ changeId, text }`. The schedule (part 3b, desk-schedule.ts): `{ when: { how, premiere, time, tz } }` (When it airs: its times
// win over its listing's) and `{ episodes: n | null }` (classic's prune when it's lowered), each with `preview: true` for
// what moves or what's cleared, before it's saved; `{ listing: { tvmazeId, listingId } }` (Use this listing) and
// `{ unlink: true }`. Finding a listing is GET ./listings.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await deskSetup(id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if ("name" in body) return NextResponse.json(await setSeasonName(user, id, body.name));
  if ("status" in body) return NextResponse.json(await setSeasonStatus(user, id, { status: body.status }));
  if (body.statusBack === true) return NextResponse.json(await setSeasonStatus(user, id, { back: true }));
  if ("resultsBy" in body) return NextResponse.json(await setResultsBy(user, id, body.resultsBy));
  if ("when" in body) return NextResponse.json(await setWhen(user, id, body.when, body.preview === true));
  if ("episodes" in body) return NextResponse.json(await setCount(user, id, body.episodes, body.preview === true));
  if ("listing" in body) return NextResponse.json(await linkListing(user, id, (body.listing ?? {}) as Record<string, unknown>, listingsFor(req)));
  if (body.unlink === true) return NextResponse.json(await unlinkListing(user, id));
  throw new HttpError(400, "Nothing to change");
});
