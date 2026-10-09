import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { leagueCastWrite } from "@/lib/server/season-cast-write";

// The fields that are the season's cast (docs/PLAN-universal-season-cast.md): on a league with a season
// they're written to the season cast and reach every league on it (season-cast-write.ts). Anything else
// stays this league's own, as before.
const CAST_FIELDS = ["name", "photoUrl", "tribeId"] as const;

// Port of SurvivorDraft's server/routes/roster.js PATCH/DELETE /castaways/:id -- commissioner-only.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  if ((CAST_FIELDS as readonly string[]).includes(field)) {
    const op = { type: "update" as const, castawayId: id, field: field as (typeof CAST_FIELDS)[number], value };
    const { state } = await leagueCastWrite(leagueId, user.id, op, (s) => {
      StateLogic.updateCastaway(s, id, field, value);
    });
    return NextResponse.json(state);
  }
  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updateCastaway(s, id, field, value);
  });
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  const { state } = await leagueCastWrite(leagueId, user.id, { type: "remove", castawayId: id }, (s) => {
    StateLogic.removeCastaway(s, id);
  });
  return NextResponse.json(state);
});
