import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { saveGames, savedGames, unsaveGame } from "@/lib/server/saved-games";

// Your saved games (docs/PLAN-start-a-game-redo.md B1; saved-games.ts): the heart beside Start in Start a game.
//   GET                          your saves, newest first -> { games }
//   POST { base, name, spec, length, from, on, seasonId }   save one (or { games: [...] }, a browser's older saves) -> { games }
//   POST { unsave: key }         take one off -> { games }
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ games: await savedGames(user) });
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body: unknown = await req.json().catch(() => null);
  if (body && typeof body === "object" && "unsave" in body) return NextResponse.json({ games: await unsaveGame(user, (body as { unsave: unknown }).unsave) });
  return NextResponse.json({ games: await saveGames(user, body) });
});
