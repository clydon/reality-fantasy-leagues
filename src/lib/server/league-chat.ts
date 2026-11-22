import crypto from "crypto";
import type { ChatMessage, ChatReaction } from "@/lib/game/types";
import type { Gif } from "@/lib/game/watch-along";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { authorName, messageText, withReactions } from "./chat";
import { requireCouch, type CouchRole } from "./couches";
import { gifFrom, type GifSource } from "./gifs";
import { pool, HttpError } from "./db";
import { notifyLeagueChat } from "./push-events";

// A league's room (docs/PLAN-sports-couch.md B1 session 5; docs/design-round/league-chat-spec.md; migration 0314): the couch's
// talk about a sports league, every message keyed by its couch and league (chat_messages.sports_league), a message about one real
// game carrying that game (sports_event, a thread) and its start (sports_event_at). Reactions, edits and deletes are chat.ts's, so
// a room message behaves as any other. Read as the season chat is (couch-chat.ts): the newest 300, a `v` fingerprint for the
// 5-second poll, `before` for earlier messages, `since` once someone has read back.
//
// Not folded here: a sports game's score is hidden on the phone (sports/scores.tsx useGameScore), as every sports read is, so the
// phone folds a thread's messages written after kickoff for anyone hiding scores; the push holds the words back for them.

export const ROOM_WINDOW = 300;
export const ROOM_PAGE = 100;
const ROOM_SINCE_MAX = 1000;

/** The columns a room message is sent with. */
const COLUMNS = "id, user_id, author_name, type, text, gif, created_at, edited_at, sports_event, sports_event_at, sports_event_name";

export interface RoomScope {
  couchId: string;
  league: string;
  role: CouchRole | "viewer";
  /** Owns the couch (or runs the site): can remove anyone's message. */
  moderator: boolean;
}

/** Who you are in this couch's room about this league. 404 for a couch you're not on. */
export async function roomScope(user: SessionUser, league: string, couchId: string | null): Promise<RoomScope> {
  if (!couchId || !isUuid(couchId)) throw new HttpError(400, "couch required");
  const role = await requireCouch(user, couchId);
  return { couchId, league, role, moderator: role === "owner" || isSuperAdminUser(user) };
}

export interface RoomLine {
  id: string;
  userId: string | null;
  name: string;
  type: "message";
  text: string;
  gif?: Gif | null;
  at: string;
  edited: boolean;
  reactions: Record<string, ChatReaction>;
  /** The game it's about (a thread), and that game's start. */
  event: string | null;
  eventAt: string | null;
  /** The game in words ("Eagles at Jets"), as its author's screen named it. */
  eventName: string | null;
}

export interface RoomChat {
  messages: RoomLine[];
  more: boolean;
  you: { userId: string; canPost: boolean; moderator: boolean };
  gifs?: boolean;
  v: string;
}

type Row = Omit<ChatMessage, "reactions"> & { sports_event: string | null; sports_event_at: Date | null; sports_event_name: string | null };

const WHERE = "couch_id = $1 AND sports_league = $2 AND league_id IS NULL AND type = 'message'";

async function linesOf(rows: Row[]): Promise<RoomLine[]> {
  const reacted = new Map((await withReactions(rows)).map((m) => [m.id, m.reactions]));
  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: m.author_name,
    type: "message" as const,
    text: m.text,
    ...(m.gif ? { gif: m.gif } : {}),
    at: new Date(m.created_at).toISOString(),
    edited: !!m.edited_at,
    reactions: reacted.get(m.id) ?? {},
    event: m.sports_event,
    eventAt: m.sports_event_at ? new Date(m.sports_event_at).toISOString() : null,
    eventName: m.sports_event_name,
  }));
}

/** A message of this room as a place to read from (its time), or the time the reader had for one deleted since. */
async function anchorOf(scope: RoomScope, id: string | null | undefined, at?: string | null): Promise<{ at: Date; id: string } | null> {
  if (!id || !isUuid(id)) return null;
  const { rows } = await pool.query<{ created_at: Date; id: string }>(`SELECT created_at, id FROM chat_messages WHERE ${WHERE} AND id = $3`, [scope.couchId, scope.league, id]);
  if (rows[0]) return { at: rows[0].created_at, id: rows[0].id };
  const was = at ? new Date(at) : null;
  return was && !Number.isNaN(was.getTime()) ? { at: was, id } : null;
}

/** The room as you may read it: the newest 300 (or everything since a message you've read back to). With `v`, { unchanged }. */
export async function readRoom(user: SessionUser, scope: RoomScope, opts: { v?: string | null; since?: string | null; at?: string | null } = {}): Promise<RoomChat | { unchanged: true; v: string }> {
  const { rows: fp } = await pool.query(
    `SELECT md5(concat_ws('|',
       (SELECT string_agg(id::text || ':' || coalesce(edited_at::text, ''), ',' ORDER BY id) FROM chat_messages WHERE ${WHERE}),
       (SELECT string_agg(r.id::text, ',' ORDER BY r.id) FROM chat_reactions r JOIN chat_messages c ON c.id = r.message_id
         WHERE c.couch_id = $1 AND c.sports_league = $2 AND c.league_id IS NULL)
     )) AS v`,
    [scope.couchId, scope.league]
  );
  const v = crypto.createHash("md5").update([fp[0].v, scope.role, scope.moderator].join("|")).digest("hex");
  if (opts.v === v) return { unchanged: true, v };
  const anchor = await anchorOf(scope, opts.since, opts.at);
  const { rows: got } = await pool.query<Row>(
    `SELECT * FROM (SELECT ${COLUMNS} FROM chat_messages WHERE ${WHERE} ${anchor ? "AND (created_at, id) >= ($3, $4)" : ""}
        ORDER BY created_at DESC, id DESC LIMIT ${anchor ? ROOM_SINCE_MAX : ROOM_WINDOW + 1}) recent ORDER BY created_at ASC, id ASC`,
    [scope.couchId, scope.league, ...(anchor ? [anchor.at, anchor.id] : [])]
  );
  const rows = !anchor && got.length > ROOM_WINDOW ? got.slice(1) : got;
  const first = rows[0];
  const more = anchor
    ? (await pool.query(`SELECT EXISTS (SELECT 1 FROM chat_messages WHERE ${WHERE} AND (created_at, id) < ($3, $4)) AS more`, [scope.couchId, scope.league, first?.created_at ?? anchor.at, first?.id ?? anchor.id])).rows[0].more
    : got.length > ROOM_WINDOW;
  return { messages: await linesOf(rows), more: !!more, you: { userId: user.id, canPost: scope.role !== "viewer", moderator: scope.moderator }, v };
}

/** The 100 before a message of this room, oldest first, and whether there are more (a tap for Earlier messages; never polled). */
export async function readEarlierRoom(scope: RoomScope, opts: { before: string | null; at?: string | null }): Promise<{ messages: RoomLine[]; more: boolean }> {
  const anchor = await anchorOf(scope, opts.before, opts.at);
  if (!anchor) throw new HttpError(404, "That message isn't in this chat");
  const { rows: got } = await pool.query<Row>(
    `SELECT * FROM (SELECT ${COLUMNS} FROM chat_messages WHERE ${WHERE} AND (created_at, id) < ($3, $4)
        ORDER BY created_at DESC, id DESC LIMIT ${ROOM_PAGE + 1}) page ORDER BY created_at ASC, id ASC`,
    [scope.couchId, scope.league, anchor.at, anchor.id]
  );
  return { messages: await linesOf(got.length > ROOM_PAGE ? got.slice(1) : got), more: got.length > ROOM_PAGE };
}

/**
 * Posts to the room, in a game's thread when `event` names one (its start in `eventAt`, as the author's screen had it: the fold's
 * kickoff, and `eventName` the push's words for it, "Eagles at Jets").
 */
export async function postRoom(
  user: SessionUser,
  scope: RoomScope,
  body: { text?: unknown; gif?: unknown; event?: unknown; eventAt?: unknown; eventName?: unknown },
  src?: GifSource | null
): Promise<RoomLine> {
  if (scope.role === "viewer") throw new HttpError(403, "Only people on the couch can post here");
  let gif: Gif | null = null;
  if (body.gif !== undefined && body.gif !== null) {
    if (!src) throw new HttpError(409, "GIFs aren't on here");
    gif = gifFrom(src, body.gif);
    if (!gif) throw new HttpError(400, "That GIF isn't one of KLIPY's");
  }
  const text = gif ? "GIF" : messageText(body.text);
  const event = typeof body.event === "string" && /^[A-Za-z0-9-]{1,40}$/.test(body.event) ? body.event : null;
  const at = event && typeof body.eventAt === "string" ? new Date(body.eventAt) : null;
  const eventAt = at && !Number.isNaN(at.getTime()) ? at.toISOString() : null;
  const eventName = event && typeof body.eventName === "string" ? body.eventName.slice(0, 80) : null;
  const name = authorName(user as { name: string; username?: string | null });
  const { rows } = await pool.query<Row>(
    `INSERT INTO chat_messages (couch_id, sports_league, sports_event, sports_event_at, sports_event_name, user_id, author_name, type, text, gif)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'message', $8, $9) RETURNING ${COLUMNS}`,
    [scope.couchId, scope.league, event, eventAt, eventName, user.id, name, text, gif ? JSON.stringify(gif) : null]
  );
  notifyLeagueChat({ messageId: rows[0].id, authorId: user.id, authorName: name, text, couchId: scope.couchId, league: scope.league, event, eventName });
  return (await linesOf(rows))[0];
}

/** A message of this room, for reacting, editing or removing; 404 when it isn't one. */
export async function messageInRoom(scope: RoomScope, messageId: string): Promise<{ user_id: string | null; type: string }> {
  if (!isUuid(messageId)) throw new HttpError(404, "Message not found");
  const { rows } = await pool.query(`SELECT user_id, type FROM chat_messages WHERE ${WHERE} AND id = $3`, [scope.couchId, scope.league, messageId]);
  if (!rows.length) throw new HttpError(404, "Message not found");
  return rows[0];
}

/** You've read the room up to `at` (forward only, never past now). */
export async function markRoomRead(userId: string, scope: RoomScope, at: unknown): Promise<void> {
  const parsed = typeof at === "string" ? new Date(at) : new Date();
  const when = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();
  await pool.query(
    `INSERT INTO league_chat_reads (couch_id, league, user_id, last_read_at) VALUES ($1, $2, $3, LEAST($4::timestamptz, now()))
     ON CONFLICT (couch_id, league, user_id) DO UPDATE SET last_read_at = GREATEST(league_chat_reads.last_read_at, EXCLUDED.last_read_at)`,
    [scope.couchId, scope.league, userId, when]
  );
}

/** The Chat tab's badge: others' messages among the newest 300 that are newer than what you've read. */
export async function roomUnread(userId: string, scope: RoomScope): Promise<{ unread: number }> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS unread FROM (SELECT user_id, created_at FROM chat_messages WHERE ${WHERE} ORDER BY created_at DESC LIMIT 300) recent
      WHERE recent.user_id IS DISTINCT FROM $3
        AND date_trunc('milliseconds', recent.created_at) > COALESCE((SELECT last_read_at FROM league_chat_reads WHERE couch_id = $1 AND league = $2 AND user_id = $3), '-infinity')`,
    [scope.couchId, scope.league, userId]
  );
  return { unread: rows[0].unread as number };
}
