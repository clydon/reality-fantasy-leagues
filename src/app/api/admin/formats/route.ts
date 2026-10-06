import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { createDraft, listFormats } from "@db/show-formats.js";

// Stored show formats (docs/PLAN-stage-3-format-proposals.md): formats researched by a web-searching
// chat and reviewed here, as opposed to the built-ins in src/lib/game/formats/. Super-admin only.

export const GET = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  return NextResponse.json({ formats: await listFormats(pool) });
});

// A pasted chat answer becomes a draft, returned with its review. Nothing is approved or applied here:
// a draft is only rows to review.
export const POST = apiRoute(async (req) => {
  const user = await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { answer?: unknown };
  if (typeof body.answer !== "string" || !body.answer.trim()) throw new HttpError(400, "Paste the chat's answer first");
  try {
    return NextResponse.json({ format: await createDraft(pool, body.answer, user.id) });
  } catch (e) {
    // parseProposal's errors are written for the person who pasted ("There's no JSON object...").
    if (e instanceof Error && !("code" in e)) throw new HttpError(400, e.message);
    throw e;
  }
});
