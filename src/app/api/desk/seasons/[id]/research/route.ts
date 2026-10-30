import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { setSeasonBot } from "@/lib/server/desk-bot";
import { deskResearch } from "@/lib/server/desk-research";

// A season's Research and the bot (docs/PLAN-desk-parity.md step 4, part 4a): GET the page (it polls while a run asks or
// waits, and takes over a queue its driver let go of); POST a change to its schedule, `{ on }` (Autopilot), `{ schedule }`
// (its runs: each kind, its minutes, on or off), `{ run: { from, to } }` (one run changed, added or taken off, for every
// episode), `{ addUsual: kind }` (our usual's runs of a kind it hasn't), `{ reset: true }` (it follows our usual again) and/or
// `{ episodeMinutes }` (how long its episodes run); `{ episode, run }` or `{ episode, back: true }` (that episode's own runs,
// or back to the season's), tier 1: answers `{ changeId, text }` for the toast's Undo. `{ makeUsual: true }` (tier 2, its
// sheet says first who it reaches): its runs become our usual.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await deskResearch(id, new URL(req.url).origin));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Parameters<typeof setSeasonBot>[2];
  const { changeId, text } = await setSeasonBot(user, id, body);
  return NextResponse.json({ changeId, text });
});
