import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { forPlayerChange } from "@/lib/server/change-log";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";
import { keeperOptionsFor } from "@/lib/server/keepers";
import { readyLeague } from "@/lib/server/league-read";
import { leagueStates } from "@/lib/server/league-states";

// A game that keeps castaways from last season's (docs/PLAN-start-a-game-gpt.md step A10 part 4, the spec's get.keep,
// StateLogic.KeeperLogic; who can be kept is worked out from the two leagues: keepers.ts). No screen yet (U1's); the engine's API.
//
// GET (?playerId= for another seat's; your own by default): { each, cost, fallback, locked, playerId, options: [{ id, name }] best
// first, chosen: [ids] | null (none named yet: the fallback decides at the draft), kept: once they're locked, everyone's
// [{ playerId, name, castaways: [{ id, name, price? }] }] }. Nothing about an episode: keepers lock before the draft.
// PUT { playerId?, castawayIds }: name a seat's keepers (none is keeping nobody), until the draft starts. A member names their own;
// the commissioner anyone's, as lineups. A refused choice is a 400 with the reason (not one of yours who's back, more than the
// game keeps, someone another seat named first in an exclusive game, the draft has started). Who named them is recorded.

const nameOf = (state: LeagueState, id: string) => StateLogic.getCastaway(state, id)?.name ?? id;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const raw = (await leagueStates([leagueId])).get(leagueId);
  if (!raw) throw new HttpError(404, "League not found");
  const state = await readyLeague(leagueId, raw);
  const k = StateLogic.KeeperLogic.config(state);
  if (!k) throw new HttpError(409, "This game doesn't keep anyone from last season");
  // While they're open, the options as the two leagues have them now, on this read's copy (a write stores them: withLeagueLock).
  const fresh = await keeperOptionsFor(pool, leagueId, state);
  if (fresh) StateLogic.KeeperLogic.setOptions(state, fresh);
  // Anyone's: the game's state carries every seat's options and named keepers anyway (keepers are named in the open before the
  // draft, as in a keeper league; whether they should stay hidden until the lock is the user's: the plan's Noticed).
  const playerId = new URL(req.url).searchParams.get("playerId") || membership.playerId;
  const locked = StateLogic.KeeperLogic.locked(state);
  return NextResponse.json({
    each: k.each,
    cost: k.cost,
    fallback: k.fallback,
    locked,
    playerId,
    options: playerId ? StateLogic.KeeperLogic.options(state, playerId).map((id: string) => ({ id, name: nameOf(state, id) })) : [],
    // What they named that can still be kept (someone who left the cast since is dropped at the lock).
    chosen: playerId ? StateLogic.KeeperLogic.named(state, playerId) : null,
    kept: locked
      ? state.players
          .filter((p) => StateLogic.KeeperLogic.kept(state, p.id).length)
          .map((p) => ({
            playerId: p.id,
            name: p.name,
            castaways: StateLogic.KeeperLogic.kept(state, p.id).map((x: { castawayId: string; price?: number }) => ({ id: x.castawayId, name: nameOf(state, x.castawayId), ...(typeof x.price === "number" ? { price: x.price } : {}) })),
          }))
      : null,
  });
});

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { playerId?: unknown; castawayIds?: unknown };
  const playerId = body.playerId === undefined ? membership.playerId : body.playerId;
  if (typeof playerId !== "string" || !playerId) throw new HttpError(400, "playerId is a seat's id");
  if (!Array.isArray(body.castawayIds) || !body.castawayIds.every((id) => typeof id === "string")) throw new HttpError(400, "castawayIds is a list of castaway ids ([] keeps nobody)");
  if (membership.role !== "commissioner" && playerId !== membership.playerId) throw new HttpError(403, "You can only name your own keepers");
  const ids = body.castawayIds as string[];
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      const problem = StateLogic.KeeperLogic.choose(s, playerId, ids, user.id);
      if (problem) throw new HttpError(400, problem);
    },
    forPlayerChange(user.id, membership.playerId, playerId, "lineup", (name) => `Named ${name}'s keepers`)
  );
  return stateResponse(req, state);
});
