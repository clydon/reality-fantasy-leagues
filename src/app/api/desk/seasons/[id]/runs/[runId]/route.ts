import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { runQuestion } from "@/lib/server/desk-research";

// One run's question (docs/PLAN-desk-parity.md part 4a, a run's sheet: The question), rebuilt as it would be asked now.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string; runId: string }> }) => {
  await requireDesk(req);
  const { id, runId } = await params;
  return NextResponse.json(await runQuestion(id, runId));
});
