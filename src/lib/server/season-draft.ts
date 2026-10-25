import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { draftKind, draftView, type DraftGame } from "@/lib/game/draft-view";
import type { SessionUser } from "./auth-helpers";
import { readOwnPicks } from "./blind-draft";
import { pool } from "./db";
import { queuesFor } from "./draft";
import { gamesHere, type GameHere } from "./season-games";

// The drafts on a season for you (docs/PLAN-new-design.md step 7; GET /api/seasons/[id]/draft?couch=): each game of yours
// with a draft, as draft-view.ts words it, from your copy at your mark. Your queue and your own blind picks are read for
// your seat alone (draft_queues, blind_draft_picks); nobody else's are ever read here.
//
// Polled while the draft room is open (every 4 s while a turn-based draft is live, 15 s while a draft waits to start or
// people lock in; docs/HOSTING.md): each read sends the version it has, and an unchanged draft answers just that. The
// league comes through league-states.ts, so an unchanged league costs a hash.

export interface SeasonDraft {
  v: string;
  games: DraftGame[];
}

/** Names for whoever made a pick for someone: their seat's name in that league, else their username. */
async function namesFor(here: GameHere[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const h of here) for (const e of h.state.draftLog ?? []) if (e.by) ids.add(e.by);
  if (!ids.size) return new Map();
  const { rows } = await pool.query(`SELECT id, COALESCE(username, name) AS name FROM "user" WHERE id = ANY($1::text[])`, [[...ids]]);
  return new Map(rows.map((r) => [r.id as string, r.name as string]));
}

export async function seasonDraft(user: SessionUser, seasonId: string, couchId: string | null): Promise<SeasonDraft> {
  const { here: all } = await gamesHere(user, seasonId, couchId);
  const here = all.filter((h) => draftKind(h.state));
  const [queues, names] = await Promise.all([queuesFor(here.map((h) => ({ leagueId: h.game.leagueId, playerId: h.playerId }))), namesFor(here)]);
  const games: DraftGame[] = [];
  for (const h of here) {
    try {
      const B = StateLogic.BlindDraftLogic;
      // Your own blind picks back to you, while they're still private (the reveal moves them into the league).
      const mine = draftKind(h.state) === "blind" && !B.isRevealed(h.state) && B.hasLocked(h.state, h.playerId) ? await readOwnPicks(h.game.leagueId, h.playerId) : null;
      const seatName = (userId: string) => {
        const seat = h.state.players.find((p) => h.userOf(p.id) === userId);
        return seat?.name ?? names.get(userId) ?? null;
      };
      const g = draftView(h.ref, h.state, h.playerId, h.mark, h.userOf, { queue: queues.get(h.game.leagueId) ?? [], mine }, seatName);
      if (g) games.push(g);
    } catch (e) {
      console.error(`[season-draft] league ${h.game.leagueId}:`, e);
    }
  }
  const v = crypto.createHash("sha1").update(JSON.stringify(games)).digest("hex").slice(0, 16);
  return { v, games };
}
