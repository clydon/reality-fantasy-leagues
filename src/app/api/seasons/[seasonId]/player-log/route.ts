import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { playerLog } from "@/lib/server/sports/player-log";

// A sport's player's game log (docs/PLAN-start-a-game-gpt.md U1's sports slice; sports/player-log.ts): `?name=`, each game's line
// newest first, up to where you may be told (guard.ts), and whether a later game's is in.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await playerLog(user, seasonId, new URL(req.url).searchParams.get("name") ?? ""));
});
