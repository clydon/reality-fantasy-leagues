import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { listShared } from "@db/league-rulesets.js";

type RouteParams = { leagueId: string };

// Other leagues' shared rulesets, for a future copy-browsing screen (nothing links here yet --
// POST .../ruleset with from:"league_ruleset" already works against any of these ids). Commissioner
// only, same as every other ruleset write/read-for-copying action.
export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const rulesets = await listShared(pool, { excludeLeagueId: leagueId });
  return NextResponse.json({ rulesets });
});
