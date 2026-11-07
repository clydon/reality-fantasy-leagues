import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { sportsFor, sportsProviders } from "@/lib/server/sports";
import { teamGameWords } from "@/lib/server/team-words";

// The Start-a-game GPT on a team's page (docs/PLAN-start-a-game-gpt.md step G3 part 2, team-words.ts): POST `{ league, team, words,
// couch?, change?: { from, words } | { from, matchup } }` asks our bot to draft the game their words describe from the team's
// schedule, picks its games (or asks which: each option's pick for `change.matchup`), makes or finds them as their matchup's season,
// and answers with our check's result on that season's page and the season. It waits for the bot (search off, ahead of its queue),
// so its maxDuration is the bot's budget. Capped per person a day (429), as on a season's page; new games under the day's cap
// (`refused`). No screen reads it yet (the wizard is U0/U1's).
export const maxDuration = 300;

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // A check's stand-in ESPN (development only); a check that names none never reaches the real one.
  const sports = sportsFor(req);
  if (sports === null) throw new HttpError(503, "Sports aren't available right now");
  return NextResponse.json(await teamGameWords(user, body, { bot: botFor(req), ...(sports ? { providers: sportsProviders({ base: sports }) } : {}) }));
});
