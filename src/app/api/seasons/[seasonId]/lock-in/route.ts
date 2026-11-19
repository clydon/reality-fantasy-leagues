import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, withLeagueLock } from "@/lib/server/db";
import { gamesHere } from "@/lib/server/season-games";

// The episode-night strip's Lock in (docs/design-round/strip-night-spec.md; the user, 2026-11-18: "I made my picks, I'm about to
// watch"; a real lock since 2026-11-19). POST { episode }: you've started watching it, so your moves for it close in every game you
// play on this season, on any couch, as watching closes them (StateLogic.GhostLogic.lockIn, lateWindow; the move routes go by the
// window, own-pace-seats.ts lateMark). Only where it's open to you: a live or own-pace game, the episode aired, you one behind it.
// Lock in, Your moves' "Yes, I'm watching" and Watch along all send it. DELETE { episode } undoes it for a moment only (the toast's
// Undo, within UNDO_MS of it), never later: a mis-tap, not a change of heart mid-episode. Answers { leagues }: the games it changed.
const UNDO_MS = 60_000;

async function episodeOf(req: Request): Promise<number> {
  const { episode } = (await req.json().catch(() => ({}))) as { episode?: unknown };
  if (!Number.isInteger(episode) || (episode as number) < 1) throw new HttpError(400, "episode must be an episode number");
  return episode as number;
}

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const n = await episodeOf(req);
  const { here } = await gamesHere(user, seasonId, null);
  const leagues: string[] = [];
  for (const h of here) {
    // Someone who sees results as they come in is never behind: nothing of theirs stays open past airtime.
    if (h.mark === null || h.mark !== n - 1) continue;
    // Only a game whose window is open on it is written (a save runs a league's after-write work, so none for nothing).
    if (StateLogic.GhostLogic.lateWindow(h.state, h.playerId, h.mark, Date.now())?.episode !== n) continue;
    let locked = false;
    await withLeagueLock(h.game.leagueId, (s) => {
      // Read on the league as it is now (its air times stamped by the lock), not the copy listed above.
      const at = new Date();
      const w = StateLogic.GhostLogic.lateWindow(s, h.playerId, h.mark, at.getTime());
      if (!w || w.episode !== n || h.mark !== n - 1) return;
      locked = StateLogic.GhostLogic.lockIn(s, h.playerId, n, at.toISOString());
    });
    if (locked) leagues.push(h.game.leagueId);
  }
  if (!leagues.length) throw new HttpError(409, `Nothing of yours is open for Episode ${n}`);
  return NextResponse.json({ leagues });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const n = await episodeOf(req);
  const { here } = await gamesHere(user, seasonId, null);
  const now = Date.now();
  const leagues: string[] = [];
  for (const h of here) {
    if (!h.state.episodes?.find((e) => e.number === n)?.lockedIn?.[h.playerId]) continue;
    let undone = false;
    await withLeagueLock(h.game.leagueId, (s) => {
      undone = StateLogic.GhostLogic.unlockIn(s, h.playerId, n, now, UNDO_MS);
    });
    if (undone) leagues.push(h.game.leagueId);
  }
  if (!leagues.length) throw new HttpError(409, "Too late to undo: you said you're watching it");
  return NextResponse.json({ leagues });
});
