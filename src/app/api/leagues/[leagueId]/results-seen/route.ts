import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { markResultsSeen } from "@/lib/server/results-seen";
import { groupLeagueIds } from "@/lib/server/league-groups";

// "Results are in! -- Reveal": body { through: n } -- this member has now seen results through
// episode n (StateLogic.SpoilerLogic). Forward only.
//
// Linked leagues (league-groups.ts) play the same season, so one reveal is a reveal in all of them
// the member is in. And the conversation hears about it -- one "conor revealed episode 9" line in
// the shared chat -- so everyone knows who's caught up and what's safe to talk about.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { through } = (await req.json().catch(() => ({}))) as { through?: unknown };
  if (!Number.isInteger(through) || (through as number) < 0) throw new HttpError(400, "through must be an episode number");
  const n = through as number;

  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [
    leagueId,
    user.id,
  ]);
  const before: number | null = rows[0]?.results_seen_through ?? null;

  for (const id of await groupLeagueIds(leagueId)) await markResultsSeen(user.id, id, n);

  if (before !== null && n > before) {
    const name = (user as { username?: string | null }).username || user.name;
    const what = n - before === 1 ? `episode ${n}` : `episodes ${before + 1}–${n}`;
    await pool.query(
      "INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, $2, $3, 'reveal', $4)",
      [leagueId, user.id, name, `${name} revealed ${what}`]
    );
  }
  return NextResponse.json({ ok: true });
});
