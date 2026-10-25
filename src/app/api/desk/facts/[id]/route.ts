import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { decideFact, deskFact } from "@/lib/server/desk-facts";

// A fact on the desk (step 6b part 2): GET both sides and its history; POST `{ decide: "yes" | "no" }`, `{ edit: { castawayName?,
// method?, eventType? } }` or `{ reopen: true }`. Deciding makes it canonical and locked, and every league follows.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  return NextResponse.json(await deskFact((await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await decideFact(user, (await params).id, await req.json().catch(() => ({}))));
});
