import { HttpError } from "@/lib/server/db";
import type { SessionUser } from "@/lib/server/auth-helpers";
import { roomScope } from "@/lib/server/league-chat";
import { leaguePath } from "@/lib/server/sports/find";

/** The room a request names: `?league=football/nfl&couch=<id>` (league-chat.ts). */
export async function roomOf(req: Request, user: SessionUser) {
  const q = new URL(req.url).searchParams;
  const league = leaguePath(q.get("league"));
  if (!league) throw new HttpError(400, "Say which league: ?league=");
  return roomScope(user, league, q.get("couch"));
}
