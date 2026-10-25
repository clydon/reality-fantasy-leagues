import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope, pasteResults } from "@/lib/server/backstage";

// An answer pasted back from Ask an AI (step 5): `{ episode, kind: "quick" | "full", answer, again?, confirmed? }`. What's
// trusted applies to every game you run here on its own (option 5B), one batch in Recent changes with Undo; the rest
// waits. The answer says how many, not who. 409 when a full answer reads like another episode's: the same body again
// with `confirmed: true` is you saying it's right.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; kind?: unknown; answer?: unknown; again?: unknown; confirmed?: unknown };
  if (!Number.isInteger(body.episode) || (body.episode as number) < 1) throw new HttpError(400, "episode required");
  if (body.kind !== "quick" && body.kind !== "full") throw new HttpError(400, "kind must be quick or full");
  return NextResponse.json(await pasteResults(scope, body.episode as number, body.kind, body.answer, { again: body.again === true, confirmed: body.confirmed === true }));
});
