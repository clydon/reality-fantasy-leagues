import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { startGame, startOptions } from "@/lib/server/start-game";

// Start a game that fits (docs/PLAN-new-design.md step 10 part 2b; start-game.ts), on a couch (`?couch=`).
//   GET ?again=<leagueId>&late=1&start=<n>   what can start here (late: from the episode on now, Include it; start: from a later
//                           listed episode, Starts): the season games and whether each fits, the line for each, why the rest
//                           don't, who on the couch watches it, where it starts, how long it can run (spans, ends: step 6 of
//                           docs/PLAN-sports-data.md), the later episodes it can start with (starts), the phases of the
//                           season it can start with instead (phases: step A3), and (Run it back) the game it plays again;
//                           and a Prediction Sheet's questions from the show's moments (step A4 part 2 of PLAN-start-a-game-gpt.md)
//   POST { game, tell, again, from, phase, to, bots, level, questions }  start it: `game` a key that fits (survivalPool,
//                           weeklyLineup, outlast, questions: a Prediction Sheet asking `questions`, ids of those offered),
//                           `tell` the couch (one push; default on), `again` a finished game of yours to run back, `from` a
//                           later listed episode to start with (none: the next to air), or `phase` one of `phases` to start
//                           when it does (it waits for it, to the season's end), `to` the last episode it plays (none:
//                           to the season's end), `bots` computer players (0-5, a game whose `bots` is true) at `level` (easy,
//                           normal, sharp), `late` from the episode on now, open past its start.
//                           -> { leagueId, name, ... }

/** ?start=9: a whole number, else none. */
const startParam = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await startOptions(user, seasonId, q.get("couch"), q.get("again"), new Date(), q.get("late") === "1", startParam(q.get("start"))));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; tell?: unknown; again?: unknown; from?: unknown; phase?: unknown; to?: unknown; bots?: unknown; level?: unknown; late?: unknown };
  return NextResponse.json(await startGame(user, seasonId, new URL(req.url).searchParams.get("couch"), body));
});
