import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { BRIEF_MAX_CHARS, saveBrief } from "@/lib/server/ai-briefs";

// Parks a prompt at /b/<code> for the "Open in ChatGPT/Claude/..." links (components/ask-ai.tsx).
// The prompt is one the signed-in user was just handed by another route, so it's stored as given.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "text required");
  if (text.length > BRIEF_MAX_CHARS) throw new HttpError(413, "Prompt too long");
  const code = await saveBrief(text, user.id);
  return NextResponse.json({ code });
});
