import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope, fillScope, resultsPrompt } from "@/lib/server/backstage";

// The question Ask an AI hands over (step 5): `kind=quick` (who went home in episode N, for whoever runs a game here) or
// `kind=full` (everything that happened, research's checklist, about everyone still in: anyone on the couch may fill it
// in unless the couch says otherwise, step 6b). Free: nothing is asked here, the person copies it (or opens it in a
// chat) themselves.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const episode = Number(q.get("episode"));
  const kind = q.get("kind");
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode required");
  if (kind !== "quick" && kind !== "full") throw new HttpError(400, "kind must be quick or full");
  const scope = kind === "full" ? await fillScope(user, seasonId, q.get("couch"), episode) : await backstageScope(user, seasonId, q.get("couch"));
  return NextResponse.json(await resultsPrompt(scope, episode, kind));
});
