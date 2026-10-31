import { marksAuthor } from "@/lib/game/chat-fold";
import { ownPace } from "@/lib/game/streaming";
import type { ChatMessage, ChatReaction } from "@/lib/game/types";
import type { Gif } from "@/lib/game/watch-along";
import { pool, HttpError } from "./db";
import { seenThrough, switchOn } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { seasonSchedules } from "./schedule";

type RawMessage = Omit<ChatMessage, "reactions">;

// What the two chat APIs share: classic's league chat (/api/leagues/[id]/chat, a linked group's conversation) and
// the new design's couch chat about a show (/api/seasons/[id]/chat, couch-chat.ts), which is the same rows seen
// through a couch and season. Both post, validate, react, edit and remove through here, so a message behaves the same
// whichever design wrote it.

/** The columns a message is sent with (never author_seen: how far someone had seen is nobody else's). */
export const MESSAGE_COLUMNS = "id, user_id, author_name, type, text, gif, created_at, edited_at";

/**
 * chat_messages.author_seen as the fold may go by it (for a query on chat_messages unaliased): only while its author shares Where I
 * am (step 15 part 3's What your couch sees, guard.ts switchOn), else null, so the message folds by airtime and says nothing about
 * how far they were. Never sent: it decides the fold.
 */
export const AUTHOR_SEEN = `CASE WHEN ${switchOn("where", "chat_messages.user_id")} THEN chat_messages.author_seen END AS author_seen`;

/** A reveal line ("riley revealed episode 5") only from someone who shares Where I am, or from `me` (a condition, unaliased). */
export const REVEAL_SHARED = (me: string) => `(chat_messages.type <> 'reveal' OR chat_messages.user_id = ${me} OR ${switchOn("where", "chat_messages.user_id")})`;

/** Where a message goes: a game's chat, or a couch's about a season it has no game on (couch-chat.ts). */
export type ChatPlace = { leagueId: string; seasonId?: string } | { leagueId?: null; couchId: string; seasonId: string };

/**
 * How far the author had seen when they wrote, kept on the message (chat_messages.author_seen, migration 0134) where the couch
 * chat's fold goes by it: a season watched at its own pace (chat-fold.ts marksAuthor; a game's chat is a game "in the
 * conversation"). Their mark (guard.ts seenThrough), or the episode they had open in a watch along in the last few hours when
 * that's further: someone watching Episode 4 along talks about it before End marks it seen. Null: the fold goes by airtime (a
 * weekly season, or someone who sees results straight away, whose mark says nothing).
 */
export async function authorMark(userId: string, place: ChatPlace): Promise<number | null> {
  const played = !!place.leagueId;
  const { rows } = await pool.query(
    place.leagueId && !place.seasonId
      ? `SELECT ss.id, ss.release, ss.status FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE l.id = $1`
      : "SELECT id, release, status FROM show_seasons WHERE id = $1",
    [place.seasonId ?? place.leagueId]
  );
  const season = rows[0] as { id: string; release: "weekly" | "nightly" | "binge"; status: string | null } | undefined;
  if (!season || !ownPace({ ...season, played })) return null;
  const episodes = season.release === "binge" ? [] : ((await seasonSchedules([season.id])).get(season.id)?.episodes ?? []);
  if (!marksAuthor({ ...season, played }, episodes)) return null;
  const [seen, { rows: along }] = await Promise.all([
    seenThrough(userId, season.id),
    pool.query(
      `SELECT max(s.episode)::int AS n FROM watch_session_people p JOIN watch_sessions s ON s.id = p.session_id
        WHERE p.user_id = $1 AND s.season_id = $2 AND p.seen_at > now() - interval '3 hours'`,
      [userId, season.id]
    ),
  ]);
  if (!Number.isFinite(seen)) return null;
  return Math.max(seen, (along[0]?.n as number | null) ?? 0);
}

/** Posts a message, signed with the author's name and, where the fold goes by it, their mark (authorMark). */
export async function insertMessage(user: { id: string; name: string; username?: string | null }, place: ChatPlace, text: string, gif: Gif | null = null): Promise<RawMessage> {
  const mark = await authorMark(user.id, place);
  const couch = "couchId" in place && !place.leagueId ? place : null;
  const { rows } = await pool.query(
    `INSERT INTO chat_messages (league_id, couch_id, season_id, user_id, author_name, type, text, author_seen, gif)
     VALUES ($1, $2, $3, $4, $5, 'message', $6, $7, $8) RETURNING ${MESSAGE_COLUMNS}`,
    [couch ? null : place.leagueId, couch?.couchId ?? null, couch?.seasonId ?? null, user.id, authorName(user), text, mark, gif ? JSON.stringify(gif) : null]
  );
  return rows[0];
}

/** A message's text, trimmed; refused when empty or too long. */
export function messageText(raw: unknown): string {
  const text = (typeof raw === "string" ? raw : "").trim();
  if (!text) throw new HttpError(400, "Message text required");
  if (text.length > 2000) throw new HttpError(400, "Message is too long");
  return text;
}

/** The name a message is signed with: the username, else the account's name. */
export function authorName(user: { name: string; username?: string | null }): string {
  return user.username || user.name;
}

// Port of SurvivorDraft's server/routes/chat.js withReactions -- batches one query for every
// message's reactions rather than N+1ing per message.
export async function withReactions(messages: RawMessage[]): Promise<ChatMessage[]> {
  const ids = messages.map((m) => m.id);
  if (!ids.length) return messages.map((m) => ({ ...m, reactions: {} }));

  const { rows } = await pool.query("SELECT message_id, user_id, emoji FROM chat_reactions WHERE message_id = ANY($1)", [ids]);
  const byMessage: Record<string, Record<string, ChatReaction>> = {};
  for (const r of rows) {
    byMessage[r.message_id] = byMessage[r.message_id] || {};
    byMessage[r.message_id][r.emoji] = byMessage[r.message_id][r.emoji] || { count: 0, userIds: [] };
    byMessage[r.message_id][r.emoji].count++;
    byMessage[r.message_id][r.emoji].userIds.push(r.user_id);
  }
  return messages.map((m) => ({ ...m, reactions: byMessage[m.id] || {} }));
}

/** Toggles a reaction: reacting again with the same emoji takes it off. */
export async function toggleReaction(messageId: string, userId: string, rawEmoji: unknown): Promise<void> {
  const emoji = (typeof rawEmoji === "string" ? rawEmoji : "").trim();
  if (!emoji) throw new HttpError(400, "emoji required");
  const existing = await pool.query("SELECT id FROM chat_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3", [messageId, userId, emoji]);
  if (existing.rows.length) {
    await pool.query("DELETE FROM chat_reactions WHERE id=$1", [existing.rows[0].id]);
  } else {
    await pool.query("INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3)", [messageId, userId, emoji]);
  }
}

/** A message's new text (marked edited), with its reactions. */
export async function editMessage(messageId: string, rawText: unknown): Promise<ChatMessage> {
  const text = messageText(rawText);
  // A GIF is sent as it is (0156): it can be removed, not edited.
  const updated = await pool.query(`UPDATE chat_messages SET text=$1, edited_at=now() WHERE id=$2 AND gif IS NULL RETURNING ${MESSAGE_COLUMNS}`, [text, messageId]);
  if (!updated.rows.length) throw new HttpError(400, "A GIF can't be edited");
  return (await withReactions(updated.rows))[0];
}

/**
 * Who may do what to a message: its author edits and deletes it; whoever runs the conversation (`moderator`) can act
 * on anyone's. A reveal line can't be edited, and only a moderator can remove one.
 */
export function mayChange(m: { user_id: string | null; type: string }, userId: string, moderator: boolean, what: "edit" | "delete"): void {
  if (what === "edit" && m.type !== "message") throw new HttpError(400, "Only messages can be edited");
  if (what === "delete" && m.type !== "message" && !moderator) throw new HttpError(400, "Only messages can be deleted");
  if (m.user_id !== userId && !moderator) throw new HttpError(403, `You can only ${what} your own messages`);
}
