import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leagueState } from "@/lib/server/league-states";
import { readyLeague } from "@/lib/server/league-read";
import { EVERYTHING, seenThrough } from "@/lib/server/guard";
import { LEAGUE_SEASON_JOIN } from "@/lib/server/league-season";
import { readDeal } from "@/lib/server/secret-roles";

// Secret roles among the players (docs/PLAN-start-a-game-gpt.md step A14 part 4, secret-roles.ts). No screen yet (U1's); the
// engine's API.
//
// GET (a member): { roles: { name, count, points, on, reveal, mates } (the game's rules, as its spec says them: public), dealt (the
// deal's made: the game has started), seat (yours, or null), mine: null, or { role, points, mates } when your seat was dealt the role
// (with the spec's `mates`, who else has it and what yours has scored so far as far as you've seen, kept off the table until the
// reveal; without it both null, as your points would say who else has it: they only move for someone else's castaway), revealed:
// null, or { at, holders } once you've seen the reveal's episode }. Nobody else's role before then: the deal lives in
// secret_role_deals, never in the state. Read through readyLeague, so the read that finds the deal due makes it; spoiler-trimmed as
// the Games tab's are (season-games.ts markFor: the season's mark, or a late joiner's own week if earlier). 409 for a game with no
// roles.

const named = (state: { players?: { id: string; name: string }[] }, id: string) => ({ playerId: id, name: (state.players ?? []).find((p) => p.id === id)?.name ?? "" });

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const raw = await leagueState(leagueId);
  if (!raw) throw new HttpError(404, "League not found");
  const state = await readyLeague(leagueId, raw);
  const R = StateLogic.SecretRoleLogic;
  const cfg = R.of(state);
  if (!cfg) throw new HttpError(409, "This game has no secret roles");
  const seat = membership.playerId;
  const [deal, season, own] = await Promise.all([
    readDeal(pool, leagueId),
    pool.query(`SELECT ss.id FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE l.id = $1`, [leagueId]),
    pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, user.id]),
  ]);
  // What they've seen: a role's points are as much a spoiler as the results they come from.
  let mark = season.rows[0]?.id ? await seenThrough(user.id, season.rows[0].id) : EVERYTHING;
  const late = seat ? StateLogic.GhostLogic.lateJoinOf(state, seat) : null;
  if (late?.catchingUp) mark = Math.min(own.rows[0]?.results_seen_through ?? (Number.isInteger(late.startEpisode) ? (late.startEpisode as number) - 1 : 0), mark);
  const view = mark === EVERYTHING ? state : StateLogic.GhostLogic.viewFor(state, seat ?? "", mark);
  const holds = !!(deal && seat && deal.holders.includes(seat));
  const known = R.known(view);
  return NextResponse.json({
    roles: { name: cfg.name, count: cfg.count, points: cfg.points, on: cfg.on, reveal: cfg.reveal, mates: cfg.mates },
    dealt: !!deal,
    seat,
    mine:
      holds && deal && seat
        ? {
            role: deal.role,
            points: cfg.mates || deal.holders.length < 2 ? R.pointsOf(view, seat, deal.holders) : null,
            mates: cfg.mates ? deal.holders.filter((id) => id !== seat).map((id) => named(state, id)) : null,
          }
        : null,
    revealed: known ? { at: known.at, holders: known.holders.map((id) => named(state, id)) } : null,
  });
});
