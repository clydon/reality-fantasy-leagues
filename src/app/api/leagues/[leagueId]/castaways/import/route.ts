import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { importCast } from "@/lib/server/cast-import";

// Import a pasted cast (docs/PLAN-cast-import-prompt.md) -- commissioner-only. Body `{ proposal }`: the
// chat's answer as reviewed (formats/cast-prompt.js's shape). People, photos and starting groups, then
// starting roles, in one league-locked write so both land together or neither does.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const { proposal } = (await req.json().catch(() => ({}))) as { proposal?: unknown };
  if (!proposal) throw new HttpError(400, "proposal required");

  let summary = null as ReturnType<typeof importCast> | null;
  const state = await withLeagueLock(leagueId, (s) => {
    try {
      summary = importCast(s, proposal);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "That cast couldn't be read.");
    }
  });
  return NextResponse.json({ state, ...summary! });
});
