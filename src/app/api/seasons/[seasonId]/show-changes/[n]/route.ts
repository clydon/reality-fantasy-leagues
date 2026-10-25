import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { answerShowChange, showChange } from "@/lib/server/show-changes";

// Something the rulebook doesn't have, on an episode's page (docs/PLAN-new-design.md step 6c part 2), once you've seen it:
// GET `{ change }` (null when research said nothing new about the episode); POST `{ isNew }`, your answer. Enough couches
// saying it's new has our bot work out what to add, after the response; the change is read again to see it land.
type Params = { params: Promise<{ seasonId: string; n: string }> };

export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  return NextResponse.json({ change: await showChange(user, seasonId, new URL(req.url).searchParams.get("couch"), Number(n)) });
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId, n } = await params;
  const user = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ change: await answerShowChange(user, seasonId, new URL(req.url).searchParams.get("couch"), Number(n), body, botFor(req)) });
});
