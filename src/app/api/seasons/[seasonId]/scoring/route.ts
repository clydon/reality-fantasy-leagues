import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { lookUpAgain, saveScoring, scoringPageIfAny, type ScoringSave } from "@/lib/server/maker-scoring";

// The maker's scoring (docs/PLAN-maker-scoring.md, maker-scoring.ts): a made game's season, as its maker changes it.
//   GET    every moment's points as the rules are now, the questions research asks (to score a new moment from), the episodes
//          researched, and whether you may change it (whoever made it a game, until a game's played on it) and why not; null
//          for a season with no rulebook of its own
//   POST   { points: { id: n }, add: [{ label, counted, points, uses? }], remove: [id] }: saved as a fix from the premiere,
//          every stored answer read again; answers the page, the new moments that ask a question of their own (`ask`: the
//          episodes need looking up again for them) and the episodes read again
//          { again: "missing" | "full" }: the episodes looked up already asked about again, for just the new questions (the ones
//          with no answer to one) or everything (every one); answers the page and how many it asked about
export const maxDuration = 120;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await scoringPageIfAny(user, seasonId));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as ScoringSave & { again?: unknown };
  if (body.again !== undefined) return NextResponse.json(await lookUpAgain(user, seasonId, body.again));
  return NextResponse.json(await saveScoring(user, seasonId, body));
});
