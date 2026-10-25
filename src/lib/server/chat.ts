import { pool, HttpError } from "./db";
import type { ChatMessage, ChatReaction } from "@/lib/game/types";

type RawMessage = Omit<ChatMessage, "reactions">;

// What the two chat APIs share: classic's league chat (/api/leagues/[id]/chat, a linked group's conversation) and
// the new design's couch chat about a show (/api/seasons/[id]/chat, couch-chat.ts), which is the same rows seen
// through a couch and season. Both validate, react, edit and remove through here, so a message behaves the same
// whichever design wrote it.

/** The columns a message is sent with. */
export const MESSAGE_COLUMNS = "id, user_id, author_name, type, text, created_at, edited_at";

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
  const updated = await pool.query(`UPDATE chat_messages SET text=$1, edited_at=now() WHERE id=$2 RETURNING ${MESSAGE_COLUMNS}`, [text, messageId]);
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
