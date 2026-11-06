import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { anyLockedDown, FROZEN } from "@/lib/server/backstage-games";
import { HttpError } from "@/lib/server/db";
import { askOurScores, ourScores, ourScoresPrompt, pasteOurScores, putAwayOurScores, settleOurScores } from "@/lib/server/our-scores";

// Backstage › Scoring rules › What scores (docs/PLAN-rulebook-research.md, stage two; src/lib/server/our-scores.ts): on the
// couch's own copy of the rulebook, for a Commissioner. GET the state (`?prompt=1`: the question, for Ask an AI's chat links
// and its copy). POST one action:
//   { action: "ask" }                                       Ask our bot (queued behind the other Run nows)
//   { action: "paste", answer }                             an answer from Ask an AI, staged as our bot's is
//   { action: "settle", answer, accept: { [id]: points }, declined: [id], preview? }   Accept, Adjust or Decline each row shown;
//                                                           what's accepted goes into the copy, the games scored again (previewed)
//   { action: "putAway", answer }                           every row shown, left as it is
// A game here locked down (Lock it down) freezes the rules: ask, settle and put away are refused (409).
// Asking drives the queue after the answer (up to 280 s of the bot's), so the route has the whole 300.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const url = new URL(req.url);
  const scope = await backstageScope(user, seasonId, url.searchParams.get("couch"));
  if (url.searchParams.get("prompt")) return NextResponse.json(await ourScoresPrompt(scope));
  return NextResponse.json(await ourScores(scope, url.origin));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const url = new URL(req.url);
  const scope = await backstageScope(user, seasonId, url.searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action !== "paste" && (await anyLockedDown(scope.games.map((g) => g.leagueId)))) throw new HttpError(409, FROZEN);
  switch (body.action) {
    case "ask":
      return NextResponse.json(await askOurScores(scope, { bot: botFor(req), origin: url.origin }));
    case "paste":
      return NextResponse.json(await pasteOurScores(scope, body.answer));
    case "settle":
      return NextResponse.json(await settleOurScores(scope, { answer: body.answer, accept: body.accept, declined: body.declined, preview: body.preview === true }));
    case "putAway":
      return NextResponse.json(await putAwayOurScores(scope, body.answer));
    default:
      throw new HttpError(400, "action is ask, paste, settle or putAway");
  }
});
