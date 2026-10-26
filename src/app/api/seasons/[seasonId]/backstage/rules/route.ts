import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { anyLockedDown, FROZEN, pointsWrite, scoringRules } from "@/lib/server/backstage-games";
import { HttpError } from "@/lib/server/db";
import { answerUpdate, changeOurs, followAgain, makeOurs } from "@/lib/server/ours";

// Backstage › Scoring rules (docs/PLAN-new-design.md steps 6a and 6b part 3): GET the rulebook these games follow (or
// the couch's own copy) and each game's points as it counts them, through your mark. POST one action, a Commissioner's,
// each one batch in Recent changes; `preview: true` says what moves first and writes nothing:
//   { action: "ours" }                                   Make it ours
//   { action: "follow", preview? }                       Follow it again
//   { action: "counts", off: [momentId], preview? }      what counts on the couch's copy
//   { action: "moment", add: { label, counted, points } } a moment the couch answers;  { action: "moment", remove: id, preview? }
//   { action: "update", edit, take: boolean, preview? }  a show change: Add it or Skip
//   { action: "points", leagueId, points: { [momentId]: n }, preview? }   a Weekly Lineup's points, the season scored again
// A game here locked down (step 15 part 4: Lock it down) freezes the rules for the season: every action is refused (409).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await scoringRules(scope));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const preview = body.preview === true;
  if (await anyLockedDown(scope.games.map((g) => g.leagueId))) throw new HttpError(409, FROZEN);
  switch (body.action) {
    case "ours":
      return NextResponse.json(await makeOurs(scope));
    case "follow":
      return NextResponse.json(await followAgain(scope, { preview }));
    case "counts":
      return NextResponse.json(await changeOurs(scope, { off: body.off }, { preview }));
    case "moment":
      return NextResponse.json(await changeOurs(scope, { add: body.add as never, remove: body.remove }, { preview }));
    case "update":
      return NextResponse.json(await answerUpdate(scope, body.edit, body.take === true, { preview }));
    case "points":
      return NextResponse.json(await pointsWrite(scope, body.leagueId, { points: body.points, preview }));
    default:
      throw new HttpError(400, "action is ours, follow, counts, moment, update or points");
  }
});
