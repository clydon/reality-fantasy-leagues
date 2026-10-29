import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { deleteShow, deskShow, deskShowAction } from "@/lib/server/desk-shows";
import { withTmdbFor } from "@/lib/server/show-art";

// A show on the desk (step 6b part 2): its seasons, who added it. POST { action: "reviewed" | "archive" | "season" } (step 10
// part 3): Looks fine, archived, or its next season ({ seasonId }); and the rest of a show's page (part 7a) and its Art and
// photos (part 7b: { art }, asking TMDB, or under `next dev` a check's stand-in from the x-gys-tmdb header).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await withTmdbFor(req, () => deskShow(id)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await withTmdbFor(req, () => deskShowAction(user, id, body)));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deleteShow(user, (await params).id));
});
