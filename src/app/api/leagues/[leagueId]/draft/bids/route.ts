import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { lockBidsFor, readOwnBids, unlockBidsFor } from "@/lib/server/draft";

// An auction's sealed bids (step A10 part 3b of docs/PLAN-start-a-game-gpt.md: StateLogic.AuctionLogic, src/lib/server/auction.ts),
// the engine's API until the draft room's screens (U1):
//   GET     your own bids, so a screen can show them again (self only, as a blind draft's picks: whoever runs the game can't read
//           them, or one player would know everyone's)
//   POST    { playerId?, bids: [{ castawayId, bid }] } locks in a sheet: your own, or someone's when you run the game (an empty
//           sheet: fill them from what's left at the lowest price). The last sheet in settles the auction at once. A refused
//           sheet answers 400 with why: nobody can see the others' bids, so a silent no-op would look like a lock-in.
//   DELETE  { playerId? } withdraws a sheet before it settles, so it can be done again (yours, or anyone's when you run it)
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (!membership.playerId) throw new HttpError(403, "You don't have a team in this game");
  return NextResponse.json({ bids: await readOwnBids(leagueId, membership.playerId) });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const actor = await requireLeagueRole(req, leagueId, "member");
  const { playerId, bids } = (await req.json().catch(() => ({}))) as { playerId?: string; bids?: unknown };
  return NextResponse.json(await lockBidsFor(actor, leagueId, playerId ?? actor.membership.playerId, bids));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const actor = await requireLeagueRole(req, leagueId, "member");
  const { playerId } = (await req.json().catch(() => ({}))) as { playerId?: string };
  return NextResponse.json(await unlockBidsFor(actor, leagueId, typeof playerId === "string" ? playerId : (actor.membership.playerId ?? "")));
});
