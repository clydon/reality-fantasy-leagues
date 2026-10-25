import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { readRun, startAsk } from "@/lib/server/results-ways";

// One tap (step 6c, results-ways.ts): POST `{ episode, kind: "quick" | "full" }` asks our bot this episode's question for
// the couch and answers at once with the run, which goes on after the response (`after`, so this route's maxDuration is
// the bot's whole budget); GET `?run=<id>` is the run, polled by the sheet until it's done or failed. Who went home is
// whoever runs a game here, free; the full results need One tap unlocked for the couch (403 until then). A run for the
// same episode already going is joined. The answer is a source like a paste: nothing about it names who went home.
export const maxDuration = 300;

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; kind?: unknown };
  return NextResponse.json(await startAsk(user, seasonId, new URL(req.url).searchParams.get("couch"), body, botFor(req)));
});

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const url = new URL(req.url);
  return NextResponse.json(await readRun(user, seasonId, url.searchParams.get("couch"), url.searchParams.get("run")));
});
