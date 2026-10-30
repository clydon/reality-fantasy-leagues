import { after, NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireCron } from "@/lib/server/cron";
import { drainDeskRuns } from "@/lib/server/desk-research";

// The desk's Run now queue, handed on (docs/PLAN-desk-parity.md part 4a, desk-research.ts): the request that drove the last
// run calls this so the next one has a request's whole budget. Answers at once; drives the queue after. Bearer CRON_SECRET.
export const maxDuration = 300;

export const POST = apiRoute(async (req) => {
  requireCron(req);
  const origin = new URL(req.url).origin;
  after(() => drainDeskRuns(origin).catch((e) => console.error("[desk-runs]", e)));
  return NextResponse.json({ ok: true }, { status: 202 });
});
