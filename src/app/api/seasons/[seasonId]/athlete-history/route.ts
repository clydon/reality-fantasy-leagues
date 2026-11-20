import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { athleteHistory } from "@/lib/server/sports/history";

// A sport's athlete's past seasons (the design round's step 6; sports/history.ts): `?name=`, the last three seasons before this one,
// asked when their sheet opens, each cached a day. A check's stand-in world with no stand-in sports data gets none (sportsFor).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  await requireAuth(req);
  const sports = sportsFor(req);
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (sports === null) return NextResponse.json({ seasons: [], source: null, unavailable: false });
  return NextResponse.json(await athleteHistory(seasonId, name, sportsProviders({ base: sports }), new URL(req.url).searchParams.get("team")));
});
