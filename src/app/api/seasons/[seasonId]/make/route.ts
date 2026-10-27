import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { listingsFor } from "@/lib/server/listings";
import { askMake, confirmMake, kindMake, makePoll, makePrompt, makeState, pasteMake, restartMake, templateMake } from "@/lib/server/make-game";

// Make it a game (docs/PLAN-new-design.md step 10 part 2a; make-game.ts), for a show that isn't a game yet.
//   GET                   where it stands: who's at it, what's been found, the review (MakeState)
//   GET ?poll=1           what the page polls while our bot asks: a version and whether it's asking (one small row)
//   GET ?prompt=rules|cast  a question to copy into your own chat
//   POST { action }       ask (our bot, after the response: this route's maxDuration is its whole budget; `again`:
//                         "rules" | "cast" asks that over), continue (the cast, when the first ask ran out of time),
//                         paste { part, answer }, kind { kind, start }, restart { part }, confirm (Looks right),
//                         template { template } (the desk's: start from a library rulebook, step 10 part 3)
// `?couch=` is the couch you're on (who started it is named only on your own couch).
export const maxDuration = 300;

type Params = { params: Promise<{ seasonId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  if (q.get("poll")) return NextResponse.json(await makePoll(seasonId));
  if (q.get("prompt")) return NextResponse.json(await makePrompt(user, seasonId, q.get("prompt")));
  return NextResponse.json(await makeState(user, seasonId, q.get("couch"), botFor(req), listingsFor(req)));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const couch = new URL(req.url).searchParams.get("couch");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const base = listingsFor(req);
  switch (body.action) {
    case "ask":
    case "continue":
      return NextResponse.json(await askMake(user, seasonId, couch, body, base, botFor(req)));
    case "paste":
      return NextResponse.json(await pasteMake(user, seasonId, couch, body, base));
    case "kind":
      return NextResponse.json(await kindMake(user, seasonId, couch, body, base));
    case "restart":
      return NextResponse.json(await restartMake(user, seasonId, couch, body, base));
    case "confirm":
      return NextResponse.json(await confirmMake(user, seasonId, couch, base));
    case "template":
      return NextResponse.json(await templateMake(user, seasonId, couch, body, base));
    default:
      throw new HttpError(400, "action is ask, continue, paste, kind, restart, confirm or template");
  }
});
