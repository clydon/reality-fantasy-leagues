import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { leagueCastWrite } from "@/lib/server/season-cast-write";
import { plainChange } from "@/lib/server/change-log";

// Port of SurvivorDraft's server/routes/roster.js PATCH/DELETE /tribes/:id -- commissioner-only.
// A starting tribe's NAME is part of the season's cast (docs/PLAN-universal-season-cast.md), so renaming
// or removing one goes through season-cast-write.ts; its colour, and any tribe the season's cast doesn't
// start anyone on (a merge, a swap's new tribe), stay this league's own.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const { field, value } = (await req.json().catch(() => ({}))) as { field?: string; value?: unknown };
  if (!field) throw new HttpError(400, "field required");

  if (field === "name") {
    const { state } = await leagueCastWrite(leagueId, user.id, { type: "tribe-rename", tribeId: id, name: String(value ?? "") }, (s) => {
      StateLogic.updateTribe(s, id, field, value);
    });
    return NextResponse.json(state);
  }

  const state = await withLeagueLock(leagueId, (s) => {
    StateLogic.updateTribe(s, id, field, value);
  }, plainChange(user.id, "cast", "Changed a tribe"));
  return NextResponse.json(state);
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; id: string }> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");

  // castWrite only ever refuses here (a starting tribe can't be removed); otherwise the league's own.
  const { state } = await leagueCastWrite(leagueId, user.id, { type: "tribe-remove", tribeId: id }, (s) => {
    StateLogic.removeTribe(s, id);
  });
  return NextResponse.json(state);
});
