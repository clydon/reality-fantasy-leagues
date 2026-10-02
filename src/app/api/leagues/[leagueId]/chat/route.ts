import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { withReactions } from "@/lib/server/chat";
import { notifyChat } from "@/lib/server/push-events";
import { groupLeagueIds } from "@/lib/server/league-groups";

// Port of SurvivorDraft's server/routes/chat.js GET/POST /. A linked league's chat is its whole
// group's (league-groups.ts): every linked league's messages, read together -- one conversation.
// The old automated result lines ('system') aren't shown any more; 'reveal' lines are ("conor
// revealed episode 9", the results-seen route).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  const ids = await groupLeagueIds(leagueId);

  // The newest 300, oldest first.
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT id, user_id, author_name, type, text, created_at, edited_at
         FROM chat_messages WHERE league_id = ANY($1::uuid[]) AND type <> 'system'
        ORDER BY created_at DESC LIMIT 300) recent
     ORDER BY created_at ASC`,
    [ids]
  );
  // Everyone in the conversation and how far they've read (null = never opened it), for "Read by":
  // one row per person across the group, with their name for anyone who isn't a player in the
  // league being viewed.
  const { rows: reads } = await pool.query(
    `SELECT m.user_id AS "userId",
            (array_agg(m.player_id) FILTER (WHERE m.league_id = $2))[1] AS "playerId",
            max(r.last_read_at) AS "lastReadAt",
            COALESCE(max(u.username), max(u.name)) AS "name"
       FROM league_memberships m
       JOIN "user" u ON u.id = m.user_id
       LEFT JOIN chat_reads r ON r.league_id = m.league_id AND r.user_id = m.user_id
      WHERE m.league_id = ANY($1::uuid[])
      GROUP BY m.user_id`,
    [ids, leagueId]
  );
  return NextResponse.json({ messages: await withReactions(rows), reads });
});

// Pushes everyone else in the league (one notification per league, kept up to date).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { text: rawText } = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (rawText || "").trim();
  if (!text) throw new HttpError(400, "Message text required");
  if (text.length > 2000) throw new HttpError(400, "Message is too long");

  const authorName = (user as { username?: string | null }).username || user.name;
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1,$2,$3,'message',$4)
     RETURNING id, user_id, author_name, type, text, created_at, edited_at`,
    [leagueId, user.id, authorName, text]
  );
  notifyChat(leagueId, user.id, authorName, text);
  return NextResponse.json({ message: { ...rows[0], reactions: {} } });
});
