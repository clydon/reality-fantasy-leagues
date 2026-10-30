import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { createDraft } from "@db/show-formats.js";

// Self-serve "Research a new show" (docs/PLAN-rollout-order.md stage 4): any signed-in user, scoped
// to formats THEY created -- see /api/formats/[id] for the ownership check, and create-show/route.ts
// for why this never lets anyone touch an existing show's rules. No listing route: nobody needs "all of my drafts" today -- the wizard holds the one id it just
// created in React state.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { answer?: unknown };
  if (typeof body.answer !== "string" || !body.answer.trim()) throw new HttpError(400, "Paste the chat's answer first");
  try {
    return NextResponse.json({ format: await createDraft(pool, body.answer, user.id) });
  } catch (e) {
    if (e instanceof Error && !("code" in e)) throw new HttpError(400, e.message);
    throw e;
  }
});
