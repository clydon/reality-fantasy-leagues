import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { changeBots, type BotAction } from "@/lib/server/computer-players";

// Backstage › Members' computer players (computer-players.ts), for whoever runs the game (`?couch=`).
// POST { leagueId, action: "add", level } | { leagueId, action: "level", playerId, level } | { leagueId, action: "remove", playerId | all }
//   -> { names }: the computer players it added, changed or took out.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as BotAction;
  return NextResponse.json(await changeBots(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
