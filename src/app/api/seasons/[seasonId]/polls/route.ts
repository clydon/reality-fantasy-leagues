import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { seasonPolls, startPoll } from "@/lib/server/polls";

// The couch's polls on a season (docs/PLAN-new-design.md step 12 part 2; polls.ts), `?couch=` required:
//   GET   the polls you may see (open ones for the next episode, and the latest closed ones), and whether you can start one
//   POST  { question, cast: true } or { question, options: [two to four] }: a poll for the next episode, open until it airs
type Params = { params: Promise<{ seasonId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  return NextResponse.json(await seasonPolls(user, seasonId, new URL(req.url).searchParams.get("couch")));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { question?: unknown; cast?: unknown; options?: unknown };
  return NextResponse.json(await startPoll(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
