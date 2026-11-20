import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk, settleAgain } from "@/lib/server/desk";

// Settle again (docs/PLAN-results-settle.md A4): POST, site admins only. Every episode the community still has a say in is
// settled again under today's rules, what moves reaches every game (told after final results), and every question still open
// is asked of our bot once more. Run once after the rules changed (2026-11-20); it has no screen of its own.
export const maxDuration = 300;

export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  return NextResponse.json(await settleAgain(user));
});
