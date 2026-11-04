import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { confirmPhase, deskRulebook, lockRulebook, pasteRulebookAnswer, researchKind, rulebookPrompt, saveAsTemplate, saveRulebook, setLive, settleRulebookAnswer, settleSuggestion } from "@/lib/server/desk-rulebooks";
import { deleteLibraryRulebook, setTemplate, takeOver } from "@/lib/server/desk-library";
import { queueRulebook, takeOverQueue } from "@/lib/server/desk-research";
import { settleNotice } from "@/lib/server/show-changes";
import { getRulebook } from "@db/rulebooks.js";
import { pool } from "@/lib/server/db";

// A rulebook on the desk, its editor (step 6b part 2): GET the page (`?prompt=check|scores[&through=N]`: research's question,
// for Ask an AI's chat links and its copy; `1` is `check`; `through`: only Episodes 1 to N, so nothing later is in it). POST one action:
//   { action: "save", blocks, kind: "fix" | "show_changed", fromEpisode?, summary? }   saved, pushed to its leagues, rescored
//   { action: "live", live }                     its season's leagues play by it (or go back to their show's rules)
//   { action: "phase", phaseId, episode }        when a phase started (null clears it)
//   { action: "lock", lock }   { action: "template" }   { action: "suggestion", suggestion, status }
//   { action: "ask", kind, through? }            Ask our bot (docs/PLAN-rulebook-research.md): Check for changes or What scores,
//                                                queued behind the other Run nows; its answer is staged for the page
//   { action: "paste", kind, answer, through? }  an answer from Ask an AI, staged as our bot's is
//   { action: "answer", answer, status: "used" | "dismissed" }   a staged answer settled (its changes went in the draft, or put away)
//   { action: "notice", notice, status: "added" | "not_new" }   a show change the couches split on, or sent here (6c part 2)
//   { action: "takeOver" }   a player-made rulebook becomes the desk's (step 10 part 3)
//   { action: "template" }   a season's: saved as a starting point ({ id }); a library one: offered as one. { action: "untemplate" }, { action: "delete" }
// Asking drives the queue after the answer (up to 280 s of the bot's), so the route has the whole 300.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const url = new URL(req.url);
  const prompt = url.searchParams.get("prompt");
  if (prompt) return NextResponse.json(await rulebookPrompt(id, prompt === "1" ? "check" : researchKind(prompt), url.searchParams.get("through")));
  const page = await deskRulebook(id, user);
  // While it's asking, a queue whose driver was cut off is this read's to take over.
  if (page.research.check.asking || page.research.scores.asking) await takeOverQueue(new URL(req.url).origin);
  return NextResponse.json(page);
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
    case "template": {
      const r = await getRulebook(pool, id);
      if (r?.ownerKind !== "library") return NextResponse.json(await saveAsTemplate(user, id));
      await setTemplate(user, id, true);
      return NextResponse.json(await deskRulebook(id, user));
    }
    case "untemplate":
      await setTemplate(user, id, false);
      return NextResponse.json(await deskRulebook(id, user));
    case "delete":
      await deleteLibraryRulebook(user, id);
      return NextResponse.json({ ok: true });
    case "takeOver":
      await takeOver(user, id);
      return NextResponse.json(await deskRulebook(id, user));
    case "ask":
      return NextResponse.json(await queueRulebook(user, id, researchKind(body.kind), body.through, { bot: botFor(req), origin: new URL(req.url).origin }));
    case "paste":
      return NextResponse.json(await pasteRulebookAnswer(user, id, researchKind(body.kind), body.answer, body.through));
    case "answer":
      return NextResponse.json(await settleRulebookAnswer(user, id, body));
    case "suggestion":
      return NextResponse.json(await settleSuggestion(user, id, body));
    case "notice":
      await settleNotice(user, String(body.notice ?? ""), body.status);
      return NextResponse.json(await deskRulebook(id, user));
    default:
      throw new HttpError(400, "Unknown action");
  }
});
