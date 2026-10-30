import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { episodeQuestion } from "@/lib/server/desk-episode";

// Paste an answer's question (docs/PLAN-desk-parity.md part 4b): the plain Ask an AI, the season's checklist for the episode
// as JSON (classic's research/prompt, structured), for the sheet's chat links and its copy.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string; n: string }> }) => {
  await requireDesk(req);
  const { id, n } = await params;
  return NextResponse.json(await episodeQuestion(id, n));
});
