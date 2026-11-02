import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { listingsFor } from "@/lib/server/listings";
import { fillPaste, fillPrompt, fillState, goFill, startFill } from "@/lib/server/season-fill";

// Getting it ready (docs/PLAN-getting-it-ready.md, season-fill.ts): a season someone adds gets its rules, its cast and its
// episodes by itself.
//   GET                             how it's going: each step, the cast once it's in, each aired episode's tile (polled while going)
//   GET ?prompt=1                   the step it's on, as a question to copy into your own chat (the free way, always there)
//   POST { action: "start", episodes }   start it (Add a show, after it's added; the show's page, for a game's season with nobody
//                                        in its cast); `episodes` false leaves them; a stopped one starts over. Runs after this answers
//   POST { action: "retry" }        Try again: the same as start
//   POST { action: "go" }           the page that's open carries on a run that stopped partway, when it's due
//   POST { action: "paste", answer }   that question's answer, pasted: the step it's on, then the job carries on
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (new URL(req.url).searchParams.get("prompt") === "1") return NextResponse.json(await fillPrompt(user, seasonId));
  return NextResponse.json(await fillState(seasonId));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; episodes?: unknown; answer?: unknown };
  const o = { base: listingsFor(req), bot: botFor(req) };
  if (body.action === "go") return NextResponse.json(await goFill(seasonId, o));
  if (body.action === "paste") return NextResponse.json(await fillPaste(user, seasonId, body.answer, o));
  return NextResponse.json(await startFill(user, seasonId, { episodes: body.action === "retry" ? undefined : body.episodes }, o));
});
