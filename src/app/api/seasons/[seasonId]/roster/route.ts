import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { askRoster, askStats, pasteRoster, pasteStats, rosterOf, rosterPromptFor, statsPromptFor } from "@/lib/server/rosters";

// A sport's Players tab (db/migrations/0144, rosters.ts): who's playing, by team, and Fill in who's playing.
//   GET                  the roster by team, each person's stats as you may see them (0145: coming in, and so far up to where you
//                        are); whether it can be filled in, our bots' asks, and whether our bot answers right now
//   GET ?prompt=1        the roster prompt to copy (copy and paste); ?prompt=stats the stats one
//   POST { action: "ask" | "stats" }        our bot asks for the roster, or the stats, after this answers (the page polls GET)
//   POST { answer, part?: "stats" }         a pasted answer, read and saved now
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const prompt = new URL(req.url).searchParams.get("prompt");
  if (prompt === "stats") return NextResponse.json(await statsPromptFor(user, seasonId));
  if (prompt === "1") return NextResponse.json(await rosterPromptFor(user, seasonId));
  return NextResponse.json(await rosterOf(user, seasonId, botFor(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; answer?: unknown; part?: unknown };
  if (body.action === "ask") return NextResponse.json(await askRoster(user, seasonId, botFor(req)));
  if (body.action === "stats") return NextResponse.json(await askStats(user, seasonId, botFor(req)));
  if (body.part === "stats") return NextResponse.json(await pasteStats(user, seasonId, body.answer));
  return NextResponse.json(await pasteRoster(user, seasonId, body.answer));
});
