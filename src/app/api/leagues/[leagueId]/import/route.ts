import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/roster.js POST /import -- commissioner-only, whole-state
// replace from a previously-exported backup, migrated forward before being saved.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") throw new HttpError(400, "Invalid league JSON");

  const state = await withLeagueLock(leagueId, (s) => {
    const migrated = StateLogic.migrateLeagueState(raw);
    Object.keys(s).forEach((k) => delete (s as unknown as Record<string, unknown>)[k]);
    Object.assign(s, migrated);
  });
  return NextResponse.json(state);
});
