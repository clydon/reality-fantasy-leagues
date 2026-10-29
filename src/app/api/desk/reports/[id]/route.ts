import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { deleteReport, deskReport, setReportDone } from "@/lib/server/desk-reports";

// A report on the desk (docs/PLAN-desk-parity.md step 2): GET it (their words, where it was sent from, the sender, the game,
// season or couch it came from, History). POST `{ done: true }` (Mark done: out of the Inbox) or `{ done: false }` (Reopen),
// each answering `{ changeId, text }` for the toast's Undo. DELETE: gone for good (tier 3; the sender isn't told). Classic's
// GET /api/admin/reports and DELETE /api/admin/reports/[id] read and deleted the same rows, until step 8.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deskReport(user, (await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { done?: unknown };
  if (!("done" in body)) throw new HttpError(400, "done");
  return NextResponse.json(await setReportDone(user, id, body.done));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deleteReport(user, (await params).id));
});
