import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { gameWords } from "@/lib/server/game-words";

// The Start-a-game GPT (docs/PLAN-start-a-game-gpt.md step G1, game-words.ts): POST `{ words, couch?, change?: { from, words } }`
// asks our bot to draft the game their words describe on this season's page and answers with our check's result: the spec, what
// the wizard asks, what it can't do yet. It waits for the bot (search off, ahead of its queue: about 20 s), so its maxDuration is
// the bot's budget. Capped per person a day (429). No screen reads it yet (the wizard is U0/U1's).
export const maxDuration = 300;

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { words?: unknown; couch?: unknown; change?: unknown };
  return NextResponse.json(await gameWords(user, seasonId, body, botFor(req)));
});
