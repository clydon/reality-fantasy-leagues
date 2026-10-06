import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { approveFormat, createShowForFormat, getFormat } from "@db/show-formats.js";

type RouteParams = { id: string };

// Self-serve "Approve & create show": re-derives the draft, refuses unless it's approvable, stores
// its data, and ALWAYS creates a brand-new show -- unlike the admin route, there is no `showId` to
// switch an existing show onto this format. That's the one real boundary this whole feature rests
// on: a random signed-in user can make their own new show, never repoint Survivor (or anyone else's
// show) at their own ruleset.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  const existing = await getFormat(pool, id);
  if (!existing) throw new HttpError(404, "Format not found");
  if (existing.createdBy !== user.id) throw new HttpError(403, "Not yours");

  const body = (await req.json().catch(() => ({}))) as { domains?: unknown };
  const domains = Array.isArray(body.domains) ? body.domains.map(String).filter((d) => d.includes(".")) : [];

  const approved = await approveFormat(pool, id, user.id);
  if (!approved) throw new HttpError(404, "Format not found");
  if (approved.refused) {
    return NextResponse.json({ format: approved, error: "It can't be approved yet: fix the problems listed first." }, { status: 409 });
  }

  let show: { id: string; slug: string; name: string } | null = null;
  if (!approved.alreadyApproved) {
    show = await createShowForFormat(pool, approved.data!, { userId: user.id, domains });
  }
  return NextResponse.json({ format: approved, show });
});
