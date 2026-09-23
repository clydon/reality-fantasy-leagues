import { pool } from "./db";
import type { ChatMessage, ChatReaction } from "@/lib/game/types";

type RawMessage = Omit<ChatMessage, "reactions">;

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
