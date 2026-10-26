import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { deskLibrary, earnShape } from "@/lib/server/desk-library";

// The library on the desk (docs/PLAN-new-design.md step 10 part 3): GET the templates by kind, the proposed shapes, drafts,
// rulebooks players made and every rulebook in use. POST { action: "earn", shape, rulebook? }: a proposed shape two real
// shows play like becomes a starting point, saved from one of their rulebooks ({ id }).
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json(await deskLibrary());
});

export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "earn") return NextResponse.json(await earnShape(user, body));
  throw new HttpError(400, "Unknown action");
});
