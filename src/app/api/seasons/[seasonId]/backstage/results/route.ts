import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope, fillScope, pasteResults } from "@/lib/server/backstage";

// An answer pasted back from Ask an AI (step 5): `{ episode, kind: "quick" | "full", answer, confirmed? }`. It's a source
// shared with every couch on the season (step 6b): what's trusted reaches every game there on its own, one line in this
// couch's Recent changes with Undo; the rest waits. The answer says how many, not who. The full results may come from
// anyone on the couch (unless it says only people who run games); who went home, from whoever runs a game here. 409 when
// a full answer reads like another episode's: the same body again with `confirmed: true` is you saying it's right.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const couch = new URL(req.url).searchParams.get("couch");
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; kind?: unknown; answer?: unknown; confirmed?: unknown };
  if (!Number.isInteger(body.episode) || (body.episode as number) < 1) throw new HttpError(400, "episode required");
  if (body.kind !== "quick" && body.kind !== "full") throw new HttpError(400, "kind must be quick or full");
  const episode = body.episode as number;
  const scope = body.kind === "full" ? await fillScope(user, seasonId, couch, episode) : await backstageScope(user, seasonId, couch);
  return NextResponse.json(await pasteResults(scope, episode, body.kind, body.answer, { confirmed: body.confirmed === true }));
});
