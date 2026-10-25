import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { confirmPhase, deskRulebook, lockRulebook, reviewAnswer, rulebookPrompt, saveAsTemplate, saveRulebook, setLive, settleSuggestion } from "@/lib/server/desk-rulebooks";
import { settleNotice } from "@/lib/server/show-changes";

// A rulebook on the desk, its editor (step 6b part 2): GET the page (`?prompt=1`: the Check for changes prompt). POST one action:
//   { action: "save", blocks, kind: "fix" | "show_changed", fromEpisode?, summary? }   saved, pushed to its leagues, rescored
//   { action: "live", live }                     its season's leagues play by it (or go back to their show's rules)
//   { action: "phase", phaseId, episode }        when a phase started (null clears it)
//   { action: "lock", lock }   { action: "template" }   { action: "review", answer }   { action: "suggestion", suggestion, status }
//   { action: "notice", notice, status: "added" | "not_new" }   a show change the couches split on, or sent here (6c part 2)
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  if (new URL(req.url).searchParams.get("prompt") === "1") return NextResponse.json(await rulebookPrompt(id));
  return NextResponse.json(await deskRulebook(id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (body.action) {
    case "save":
      return NextResponse.json(await saveRulebook(user, id, body));
    case "live":
      return NextResponse.json(await setLive(user, id, body.live));
    case "phase":
      return NextResponse.json(await confirmPhase(user, id, body));
    case "lock":
      return NextResponse.json(await lockRulebook(user, id, body.lock));
    case "template":
      return NextResponse.json(await saveAsTemplate(user, id));
    case "review":
      return NextResponse.json(await reviewAnswer(id, body.answer));
    case "suggestion":
      return NextResponse.json(await settleSuggestion(user, id, body));
    case "notice":
      await settleNotice(user, String(body.notice ?? ""), body.status);
      return NextResponse.json(await deskRulebook(id));
    default:
      throw new HttpError(400, "Unknown action");
  }
});
