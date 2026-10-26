import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { HttpError } from "@/lib/server/db";
import { archiveGame, deleteGame, deletePreview, endGamesOf, unarchiveGame } from "@/lib/server/end-game";

// Backstage › Game settings' "Archive or delete a game" (docs/PLAN-new-design.md step 10 part 2b; end-game.ts), a
// Commissioner's, on a couch (`?couch=`).
//   GET                                      the games here, archived ones too, and which are yours to archive or delete
//   POST { action: "archive", leagueId }     tier 1: stays on the trophy shelf, stops scoring -> { batch } (Undo)
//   POST { action: "unarchive", leagueId }   Bring it back: it scores again -> { batch }
//   POST { action: "delete", leagueId, preview }  tier 3: preview -> the hold sheet's sentence; else -> { batch }
//                                            (restorable from Recent changes for 30 days)
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"), { archived: true });
  return NextResponse.json({ games: endGamesOf(scope) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"), { archived: true });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; leagueId?: unknown; preview?: unknown };
  switch (body.action) {
    case "archive":
      return NextResponse.json(await archiveGame(scope, body.leagueId));
    case "unarchive":
      return NextResponse.json(await unarchiveGame(scope, body.leagueId));
    case "delete":
      return NextResponse.json(body.preview ? await deletePreview(scope, body.leagueId) : await deleteGame(scope, body.leagueId));
    default:
      throw new HttpError(400, "action is archive, unarchive or delete");
  }
});
