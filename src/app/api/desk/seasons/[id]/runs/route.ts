import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireDesk } from "@/lib/server/desk";
import { allRuns, runNow } from "@/lib/server/desk-research";

// Run now on the desk (docs/PLAN-desk-parity.md step 4, part 4a): POST `{ kind, episode, scope? }` queues it (desk_runs,
// 0424) and answers at once with what it waits behind; the run asks after this answers (desk-research.ts drainDeskRuns).
// GET: every run of the season, newest first (Runs' All N). A dev server's stand-in bot comes from the x-gys-bot header.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json({ runs: await allRuns(id) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; episode?: unknown; scope?: unknown };
  return NextResponse.json(await runNow(user, id, body, { bot: botFor(req), origin: new URL(req.url).origin }));
});
