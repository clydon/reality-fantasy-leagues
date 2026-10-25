import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { backstageScope, resultsPrompt } from "@/lib/server/backstage";

// The question Ask an AI hands over (step 5): `kind=quick` (who went home in episode N) or `kind=full` (everything that
// happened, research's checklist; `again=1` asks about everyone again). `prompt` is null when research already
// answered for everyone. Free: nothing is asked here, the person copies it (or opens it in a chat) themselves.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  const scope = await backstageScope(user, seasonId, q.get("couch"));
  const episode = Number(q.get("episode"));
  const kind = q.get("kind");
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode required");
  if (kind !== "quick" && kind !== "full") throw new HttpError(400, "kind must be quick or full");
  return NextResponse.json(await resultsPrompt(scope, episode, kind, q.get("again") === "1"));
});
