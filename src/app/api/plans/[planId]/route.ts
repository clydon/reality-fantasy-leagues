import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { answerPlan, cancelPlan } from "@/lib/server/watch-plans";

// A planned night (docs/PLAN-new-design.md step 11 part 3; watch-plans.ts), for anyone on its couch.
//   POST { answer: "in" | "out" }   I'm in / Can't make it (anyone on the couch can join; whoever planned it is in)
//   POST { cancel: true | false }   call it off, or bring it back (Undo): whoever planned it
//   -> { plan, plans } (your couches' plans still to come, for the home)
export const POST = apiRoute(async (req, { params }: { params: Promise<{ planId: string }> }) => {
  const { planId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { answer?: unknown; cancel?: unknown };
  if ("cancel" in body) return NextResponse.json(await cancelPlan(user, planId, body.cancel));
  if ("answer" in body) return NextResponse.json(await answerPlan(user, planId, body.answer));
  throw new HttpError(400, "answer or cancel");
});
