import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { askRoster, pasteRoster, rosterOf, rosterPromptFor } from "@/lib/server/rosters";

// A sport's Players tab (db/migrations/0144, rosters.ts): who's playing, by team, and Fill in who's playing.
//   GET              the roster by team; whether it can be filled in, our bot's ask, and whether it answers right now
//   GET ?prompt=1    the prompt to copy (copy and paste)
//   POST { action: "ask" }    our bot asks, after this answers (the page polls GET)
//   POST { answer }           a pasted answer, read and saved now
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (new URL(req.url).searchParams.get("prompt") === "1") return NextResponse.json(await rosterPromptFor(user, seasonId));
  return NextResponse.json(await rosterOf(user, seasonId, botFor(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; answer?: unknown };
  if (body.action === "ask") return NextResponse.json(await askRoster(user, seasonId, botFor(req)));
  return NextResponse.json(await pasteRoster(user, seasonId, body.answer));
});
