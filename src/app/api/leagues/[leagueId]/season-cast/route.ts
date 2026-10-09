import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { castModeFor, leagueCastWrite } from "@/lib/server/season-cast-write";
import type { LeagueState } from "@/lib/game/types";

// The league's side of its season's shared cast (docs/PLAN-universal-season-cast.md;
// src/lib/server/season-cast-write.ts). GET says which situation League Settings is in -- the league's
// own roster, about to create the season's cast, creating it, or a shared one it can't change. POST is
// the creating commissioner's two season-level controls:
//
//   { action: "finish" }                          "Finish cast": only an admin changes it from now on
//   { action: "tribes", tribesFromEpisode: n|null } were the starting tribes public before the premiere
//                                                   (null), or shown in episode n and held until then?
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ state: LeagueState }>("SELECT state FROM leagues WHERE id=$1", [leagueId]);
    if (!rows.length) throw new HttpError(404, "League not found");
    return NextResponse.json(await castModeFor(client, leagueId, rows[0].state));
  } finally {
    client.release();
  }
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { action?: string; tribesFromEpisode?: number | null };
  const op =
    body.action === "finish"
      ? ({ type: "finish" } as const)
      : body.action === "tribes" && "tribesFromEpisode" in body
      ? ({ type: "tribes-hold", tribesFromEpisode: body.tribesFromEpisode ?? null } as const)
      : null;
  if (!op) throw new HttpError(400, 'action must be "finish", or "tribes" with tribesFromEpisode');
  const { state } = await leagueCastWrite(leagueId, user.id, op, () => {
    throw new HttpError(400, "This league isn't on a season, so its cast is its own.");
  });
  return NextResponse.json(state);
});
