import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { BRIEF_MAX_CHARS } from "@/lib/server/ai-briefs";
import { askBot, askBotStatus, canUseAskBot } from "@/lib/server/ask-bot";

// "Ask ChatGPT for me" (experimental), the primary action on every Copy prompt step
// (components/ask-ai.tsx): runs a prompt the user was just handed through the ask-AI bot
// (lib/server/ask-bot.ts) and returns the answer for the paste box. Super-admins and commissioners.
//
// The prompt comes from the client, the same trust as the /b/<code> briefs: it's text another route
// just handed this user. The bot answers one question at a time, so a burst queues rather than piles up.
export const maxDuration = 300;

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  if (!(await canUseAskBot(user))) return NextResponse.json({ allowed: false, available: false, busy: false });
  return NextResponse.json({ allowed: true, ...(await askBotStatus()) });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  if (!(await canUseAskBot(user))) throw new HttpError(403, "Commissioners and admins only");
  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) throw new HttpError(400, "prompt required");
  if (prompt.length > BRIEF_MAX_CHARS) throw new HttpError(413, "Prompt too long");
  return NextResponse.json(await askBot(prompt));
});
