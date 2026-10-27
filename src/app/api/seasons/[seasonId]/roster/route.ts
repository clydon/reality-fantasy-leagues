import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { askRoster, pasteRoster, rosterOf, rosterPromptFor } from "@/lib/server/rosters";
import { sportsFor } from "@/lib/server/sports";

// A sport's Players tab (db/migrations/0144, rosters.ts): who's playing, by team (from the sports data's linked games first: 0149),
// and Fill in who's playing.
//   GET                  the roster by team, each person's stats as you may see them (0150: coming in, and so far, from the games'
//                        box scores up to where you are); whether it can be filled in, our bot's ask, and whether our bot answers
//                        right now. A sport whose people and stats can come from its games gets them after this answers
//                        (sports/season.ts, sports/stats.ts; the page polls)
//   GET ?prompt=1        the roster prompt to copy (copy and paste)
//   POST { action: "ask" }   the roster: the sports data first, now, else our bot after this answers (the page polls GET)
//   POST { answer }          a pasted answer, read and saved now
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const prompt = new URL(req.url).searchParams.get("prompt");
  if (prompt === "1") return NextResponse.json(await rosterPromptFor(user, seasonId));
  return NextResponse.json(await rosterOf(user, seasonId, botFor(req), sportsFor(req)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; answer?: unknown };
  if (body.action === "ask") return NextResponse.json(await askRoster(user, seasonId, botFor(req), sportsFor(req)));
  return NextResponse.json(await pasteRoster(user, seasonId, body.answer, sportsFor(req)));
});
