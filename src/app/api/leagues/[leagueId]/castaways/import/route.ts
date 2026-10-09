import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { importCast, seasonImportOp } from "@/lib/server/cast-import";
import { leagueCastWrite } from "@/lib/server/season-cast-write";

// Import a pasted cast (docs/PLAN-cast-import-prompt.md) -- commissioner-only. Body `{ proposal }`: the
// chat's answer as reviewed (formats/cast-prompt.js's shape). People, photos and starting groups, then
// starting roles, in one league-locked write so both land together or neither does.
//
// On a league with a season, the cast half goes to the SEASON's cast (season-cast-write.ts), and
// `tribesFromEpisode` is the screen's answer to "were the starting tribes public before the premiere?"
// (null = yes, N = shown in episode N, held until each league reaches it; omitted = not asked). Roles
// stay this league's own episode-1 results.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { proposal?: unknown; tribesFromEpisode?: number | null };
  if (!body.proposal) throw new HttpError(400, "proposal required");
  const readable = <T,>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "That cast couldn't be read.");
    }
  };

  let summary = null as ReturnType<typeof importCast> | null;
  let recordRoles: ReturnType<typeof seasonImportOp>["recordRoles"] | null = null;
  const { state } = await leagueCastWrite(
    leagueId,
    user.id,
    (s) => {
      const built = readable(() => seasonImportOp(s, body.proposal, body.tribesFromEpisode));
      recordRoles = built.recordRoles;
      return built.op;
    },
    (s) => {
      summary = readable(() => importCast(s, body.proposal));
    },
    (s, applied) => {
      const roles = recordRoles!(s);
      summary = { added: { tribes: [], castaways: applied.castaways, skipped: applied.skipped }, roles };
    }
  );
  return NextResponse.json({ state, ...summary! });
});
