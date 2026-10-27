import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { askRecaps, pasteRecaps, recapPromptFor, recapState } from "@/lib/server/episode-recaps";

// Fill in what happened (db/migrations/0143, episode-recaps.ts): a recap of each aired episode of a show you watch or play.
//   GET              which aired episodes have no recap, whether our bot is asking, and whether it answers right now
//   GET ?prompt=1    the prompt to copy (copy and paste)
//   POST { action: "ask" }    our bot asks, after this answers (the page polls GET)
//   POST { answer }           a pasted answer, read and saved now
// Recaps themselves come with the episodes (GET .../episodes), only for an episode you've seen.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (new URL(req.url).searchParams.get("prompt") === "1") return NextResponse.json(await recapPromptFor(user, seasonId));
  return NextResponse.json(await recapState(user, seasonId, botFor(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; answer?: unknown };
  if (body.action === "ask") return NextResponse.json(await askRecaps(user, seasonId, botFor(req)));
  return NextResponse.json(await pasteRecaps(user, seasonId, body.answer));
});
