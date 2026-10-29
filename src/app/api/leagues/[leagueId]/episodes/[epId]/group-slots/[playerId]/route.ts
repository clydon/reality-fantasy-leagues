import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { forPlayerChange } from "@/lib/server/change-log";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { catchingUpMark } from "@/lib/server/late-join";
import { EVERYTHING, seenThrough } from "@/lib/server/guard";

// A game with group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1, the spec's get.groups: a draft's +1 or +2 slot that
// holds a pair or a team the show forms, StateLogic.GroupSlotLogic). No screen yet (U1's); the engine's API.
//
// GET: what the player's slots hold going into this episode and what's on offer, as they see the league (at their mark: the
// season's, guard.ts, or a late joiner's own week while they catch up, as season-games.ts reads a game), on the groups the game
// has stored (the ones every table scores; each write settles them again, the season sync after every result among them):
// { episode, offered: { groups, sure, why, shared }, slots: [{ slot, status, pick, from, members, unsure, why, points? }] }.
// PUT { slot, groupId }: a group on offer into one of their slots for this episode (null empties it), until its lock. A member
// sets their own; the commissioner anyone's, as lineups. A refused pick is a 400 with the reason (it isn't on offer, the slot
// rides with its group while that lasts, someone else has it in an exclusive game, the episode has started).

const standingsOf = (state: LeagueState, epId: string, playerId: string) => {
  const ep = state.episodes.find((e) => e.id === epId);
  const cfg = StateLogic.GroupSlotLogic.config(state);
  if (!ep || !cfg) return null;
  const ix = StateLogic.GroupSlotLogic.index(state);
  const lines = StateLogic.episodeHasResults(ep) ? StateLogic.GroupSlotLogic.episodeLines(state, ep, playerId, undefined, undefined, ix) : null;
  const slots = Array.from({ length: cfg.slots }, (_, i) => lines?.[i] ?? { slot: i, ...StateLogic.GroupSlotLogic.standing(state, playerId, i, ep.number, ix) });
  return { episode: ep.number, offered: StateLogic.GroupSlotLogic.offered(state, ep.number, ix), slots };
};

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
  const { leagueId, epId, playerId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  const state: LeagueState = rows[0].state;
  if (!StateLogic.GroupSlotLogic.config(state)) throw new HttpError(409, "This game has no group slots");
  const { rows: season } = await pool.query(
    `SELECT ss.id FROM shows s JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = $2 WHERE s.slug = $1`,
    [state.settings.showId ?? null, String(state.settings.wikiSeason ?? "")]
  );
  const seen = season.length ? await seenThrough(user.id, season[0].id) : EVERYTHING;
  // A late joiner catching up: their own week (results_seen_through, as the PUT's catchingUpMark), if earlier.
  const own = StateLogic.GhostLogic.isCatchingUp(state, playerId) ? await catchingUpMark(leagueId, state, playerId).catch(() => 0) : null;
  const mark = own !== null ? Math.min(own, seen) : seen === EVERYTHING ? null : seen;
  const view = StateLogic.GhostLogic.viewFor(state, playerId, mark);
  const out = standingsOf(view, epId, playerId);
  if (!out) throw new HttpError(404, "That episode is ahead of you");
  return NextResponse.json(out);
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string; playerId: string }> }) => {
  const { leagueId, epId, playerId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { slot?: unknown; groupId?: unknown };
  const slot = body.slot;
  const groupId = body.groupId;
  if (!Number.isInteger(slot)) throw new HttpError(400, "slot is a slot's number: 0, or 1 for a second");
  if (groupId === undefined || (groupId !== null && typeof groupId !== "string")) throw new HttpError(400, "groupId is a group's id, or null to empty the slot");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) throw new HttpError(403, "You can only set your own slots");
  const id = groupId as string | null;
  const n = slot as number;
  const state = await withLeagueLock(
    leagueId,
    async (s) => {
      // A late joiner catching up (StateLogic.GhostLogic): their week, as they see the league.
      const mark = await catchingUpMark(leagueId, s, playerId);
      const problem =
        mark === null
          ? StateLogic.GroupSlotLogic.validatePick(s, epId, playerId, n, id)
          : StateLogic.GhostLogic.applyAs(s, playerId, mark, epId, (v) => {
              const p = StateLogic.GroupSlotLogic.validatePick(v, epId, playerId, n, id);
              if (p) return p;
              StateLogic.GroupSlotLogic.setPick(v, epId, playerId, n, id);
              return null;
            });
      if (problem) throw new HttpError(400, problem);
      if (mark === null) StateLogic.GroupSlotLogic.setPick(s, epId, playerId, n, id);
    },
    forPlayerChange(user.id, membership.playerId, playerId, "lineup", (name) => `Set ${name}'s group slot`)
  );
  return stateResponse(req, state);
});
