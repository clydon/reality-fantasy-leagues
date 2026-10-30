import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { castQuestion } from "@/lib/server/desk-cast-page";

// Paste it's question (docs/PLAN-desk-parity.md part 5a): the prompt our bot asks for the season's cast (cast-prompt.js), for Ask
// an AI's chat links and its copy.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await castQuestion(id));
});
