import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";
import { groupLeagueIds } from "@/lib/server/league-groups";
import { outOfChat } from "@/lib/server/late-join";

// The unread badge (use-league-poll.ts, every 15s on every page): how many of the conversation's newest
// 300 messages are someone else's and newer than what this person has read, counted here instead of
// sending the whole conversation to count it. "Read" is the later of the server's mark (chat_reads, across
// the group) and `since`, what this device has seen this session. Both are a message's time as the app
// sends it, in milliseconds, so messages are compared at that precision too: the database keeps
// microseconds, and the message someone just read would otherwise still count.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (await outOfChat(leagueId, membership.playerId)) return NextResponse.json({ unread: 0 });
  const since = new URL(req.url).searchParams.get("since");
  const local = since && !Number.isNaN(new Date(since).getTime()) ? since : null;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS unread FROM (
       SELECT user_id, created_at FROM chat_messages WHERE league_id = ANY($1::uuid[]) AND type <> 'system'
        ORDER BY created_at DESC LIMIT 300) recent
      WHERE recent.user_id IS DISTINCT FROM $2
        AND date_trunc('milliseconds', recent.created_at) > COALESCE(GREATEST(
              (SELECT max(last_read_at) FROM chat_reads WHERE league_id = ANY($1::uuid[]) AND user_id = $2),
              $3::timestamptz), '-infinity')`,
    [await groupLeagueIds(leagueId), user.id, local]
  );
  return NextResponse.json({ unread: rows[0].unread as number });
});
