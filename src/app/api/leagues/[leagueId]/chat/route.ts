import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { withReactions } from "@/lib/server/chat";

// Port of SurvivorDraft's server/routes/chat.js GET/POST /.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");

  const { rows } = await pool.query(
    `SELECT id, user_id, author_name, type, text, created_at, edited_at
     FROM chat_messages WHERE league_id=$1 ORDER BY created_at ASC LIMIT 300`,
    [leagueId]
  );
  return NextResponse.json({ messages: await withReactions(rows) });
});

// Push-notification-on-new-message isn't ported (out of scope, same as every other domain).
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
  return NextResponse.json({ message: { ...rows[0], reactions: {} } });
});
