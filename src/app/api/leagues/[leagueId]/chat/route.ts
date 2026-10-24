import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { outOfChat, outOfGroupChat } from "@/lib/server/late-join";
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
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  // Late joiners have no chat until they're caught up and in the league (late-join.ts).
  if (await outOfChat(leagueId, membership.playerId)) return NextResponse.json({ messages: [], reads: [] });
  const ids = await groupLeagueIds(leagueId);

  // The open chat polls every 5s (chat-tab.tsx). `v` fingerprints everything the answer is built from
  // (messages and edits, reactions, reads, members, and the leagues' states, which decide who's out of
  // the conversation), computed in the database so only 32 characters come back; when the caller already
  // has that version, nothing else is read or sent.
  const { rows: ver } = await pool.query(
    `SELECT md5(concat_ws('|',
       (SELECT string_agg(id::text || ':' || coalesce(edited_at::text, ''), ',' ORDER BY id)
          FROM chat_messages WHERE league_id = ANY($1::uuid[]) AND type <> 'system'),
       (SELECT string_agg(r.id::text, ',' ORDER BY r.id)
          FROM chat_reactions r JOIN chat_messages c ON c.id = r.message_id WHERE c.league_id = ANY($1::uuid[])),
       (SELECT string_agg(league_id::text || ':' || user_id || ':' || last_read_at::text, ',' ORDER BY league_id, user_id)
          FROM chat_reads WHERE league_id = ANY($1::uuid[])),
       (SELECT string_agg(league_id::text || ':' || user_id || ':' || player_id, ',' ORDER BY league_id, user_id)
          FROM league_memberships WHERE league_id = ANY($1::uuid[])),
       (SELECT string_agg(id::text || ':' || md5(state::text), ',' ORDER BY id) FROM leagues WHERE id = ANY($1::uuid[]))
     )) AS v`,
    [ids]
  );
  const v = ver[0].v as string;
  if (new URL(req.url).searchParams.get("v") === v) return NextResponse.json({ unchanged: true, v });

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
  // Nobody reads as a late joiner the league can't see, in this league or any linked one (late-join.ts).
  const out = await outOfGroupChat(ids);
  const visibleReads = reads.filter((r) => !out.has(r.userId));
  return NextResponse.json({ messages: await withReactions(rows), reads: visibleReads, v });
});

// Pushes everyone else in the league (one notification per league, kept up to date).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  if (await outOfChat(leagueId, membership.playerId)) throw new HttpError(403, "Chat opens once you're in the league");
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
