import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute, stateResponse } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { forPlayerChange } from "@/lib/server/change-log";
import { withLeagueLock, HttpError } from "@/lib/server/db";

// A game played in teams of players (docs/PLAN-start-a-game-gpt.md step A11 part 5, the spec's rank.teams: the couch split into
// teams that score together, StateLogic.TeamLogic). No screen yet (U1's); the engine's API. What the teams are, and which one a
// seat plays for, is on the Games tab's read (GameView.teams, TableRow.side).
//
// PUT { team }: a seat onto a team ("t1", "t2", ...). A member picks their own, in a game whose teams are chosen, until it starts;
// the commissioner puts anyone on one then, and moves anyone once it has started (from the first episode still to play, so nothing
// played changes). A refused move is a 400 with the reason (the teams are drawn, the game has started, no such team, a late joiner
// playing their own season or still catching up).

export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; playerId: string }> }) => {
  const { leagueId, playerId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const body = (await req.json().catch(() => ({}))) as { team?: unknown };
  if (typeof body.team !== "string" || !body.team) throw new HttpError(400, "team is a team's id: t1, t2, ...");
  const team = body.team;
  const runs = membership.role === "commissioner";
  if (!runs && playerId !== membership.playerId) throw new HttpError(403, "You can only pick your own team");
  // Whoever runs the game picking their own team picks it as anyone would (before the start, in a game whose teams are chosen),
  // unless they're moving it once the game has started.
  const by = runs && playerId !== membership.playerId ? "runs" : "self";
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      const now = Date.now();
      const asRuns = by === "runs" || (runs && StateLogic.TeamLogic.started(s, now));
      const opts = { by: asRuns ? ("runs" as const) : ("self" as const), now };
      const problem = StateLogic.TeamLogic.chooseProblem(s, playerId, team, opts);
      if (problem) throw new HttpError(400, problem);
      StateLogic.TeamLogic.choose(s, playerId, team, opts);
    },
    forPlayerChange(user.id, membership.playerId, playerId, "lineup", (name) => `Put ${name} on a team`)
  );
  return stateResponse(req, state);
});
