import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { deskSetup, setResultsBy, setSeasonName, setSeasonStatus } from "@/lib/server/desk-setup";

// A season's Setup (docs/PLAN-desk-parity.md step 3, part 3a): GET the page; POST one change, each tier 1 with a History
// line and Undo: `{ name }` (blank shows the show and its number), `{ status }` (held over its TV listing's dates),
// `{ statusBack: true }` (its listing's dates move it again), `{ resultsBy: 'leagues' | 'admin' }`. Answers
// `{ changeId, text }`. The schedule's changes are part 3b's.
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
  throw new HttpError(400, "Nothing to change");
});
