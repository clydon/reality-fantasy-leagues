import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { bingoQuestion } from "@/lib/server/desk-bingo";

// Paste squares' question (docs/PLAN-desk-parity.md part 4c): `?bank=<n>|season`, the prompt our bot asks for that bank, for
// Ask an AI's chat links and its copy.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await bingoQuestion(id, new URL(req.url).searchParams.get("bank")));
});
