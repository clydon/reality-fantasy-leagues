import crypto from "crypto";
import { byAuthorMark, foldFor, isFolded, revealedBy, type AirTime } from "@/lib/game/chat-fold";
import type { ChatReaction } from "@/lib/game/types";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { AUTHOR_SEEN, authorName, insertMessage, MESSAGE_COLUMNS, messageText, REVEAL_SHARED, withReactions } from "./chat";
import { requireCouch, type CouchRole } from "./couches";
import { pool, HttpError } from "./db";
import { seenThrough } from "./guard";
import { hiddenFromGroup } from "./late-join";
import { notifyCouchChat } from "./push-events";
import { seasonSchedules } from "./schedule";
import { games } from "./show-space";

// One chat per couch and show (docs/PLAN-new-design.md step 4; GET/POST /api/seasons/[id]/chat?couch=). A couch's
// chat about a season is every message in the couch's games on it (league_id: classic's linked-group chat, so both
// designs show one conversation) plus what was said where the couch has no game yet (a show it only watches:
// couch_id and season_id, migration 0110). The new design posts into the couch's first game there when it has one.
//
// Spoiler-safe on the server (guard.ts, chat-fold.ts): once an episode you haven't seen has aired, everyone else's
// messages from its airtime on are sent without their text or reactions, until you ask (`unfold`); on a season watched
// at its own pace (step 14 part 2), a message carrying its author's mark only while that's past yours. Kept small for
// its 5-second poll, as classic's is (docs/HOSTING.md): `v` fingerprints what the answer is built from, worked out in
// the database, so an unchanged chat sends 32 characters.

export interface ChatScope {
  couchId: string;
  seasonId: string;
  /** The couch's games on the season, in the couch's order: their chat is this conversation. */
  leagueIds: string[];
  /** Where a new message goes: the first of them, or null on a show the couch only watches. */
  postTo: string | null;
  role: CouchRole | "viewer";
  /** Runs a game here, or owns the couch: can remove anyone's message, and reveal lines. */
  moderator: boolean;
  /** Someone the couch's games can't see yet (a ghost, late-join.ts): no chat until then. Catching up in the open is
   *  fine: the fold keeps it spoiler-safe (step 9). */
  out: boolean;
}

/** Who you are in this couch's chat about this season. 404 for a couch you're not on, or a season that isn't. */
export async function chatScope(user: SessionUser, seasonId: string, couchId: string | null): Promise<ChatScope> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  const role = await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const here = await games(user.id, { couchIds: [couchId], seasonId });
  const leagueIds = here.map((g) => g.leagueId);
  const out = leagueIds.length ? (await hiddenFromGroup(leagueIds)).has(user.id) : false;
  return {
    couchId,
    seasonId,
    leagueIds,
    postTo: leagueIds[0] ?? null,
    role,
    moderator: role === "owner" || isSuperAdminUser(user) || here.some((g) => g.yourRole === "commissioner" || g.yourRole === "admin"),
    out,
  };
}

/** The scope as SQL over chat_messages (aliased `a`), with its parameters from $n on: leagues, couch, season. */
function inScope(scope: ChatScope, a = "", n = 1): [string, unknown[]] {
  const p = a ? `${a}.` : "";
  return [
    `(${p}league_id = ANY($${n}::uuid[]) OR (${p}league_id IS NULL AND ${p}couch_id = $${n + 1} AND ${p}season_id = $${n + 2}))`,
    [scope.leagueIds, scope.couchId, scope.seasonId],
  ];
}

// Air times only change when research or an admin moves them, and the fold only needs to know which episodes have
// started, so a season's are kept a minute per server rather than worked out on every poll.
const AIR_TTL_MS = 60_000;
const airKept = new Map<string, { at: number; episodes: AirTime[] }>();

async function airTimes(seasonId: string): Promise<AirTime[]> {
  const kept = airKept.get(seasonId);
  if (kept && Date.now() - kept.at < AIR_TTL_MS) return kept.episodes;
  const schedule = (await seasonSchedules([seasonId])).get(seasonId);
  const episodes = (schedule?.episodes ?? []).map((e) => ({ number: e.number, airAt: e.airAt }));
  airKept.set(seasonId, { at: Date.now(), episodes });
  return episodes;
}

export interface ChatLine {
  id: string;
  userId: string | null;
  name: string;
  type: "message" | "reveal";
  /** Null while it's folded for you. */
  text: string | null;
  at: string;
  edited: boolean;
  reactions: Record<string, ChatReaction>;
  folded?: true;
}

export interface CouchChat {
  /** The newest 300, oldest first. */
  messages: ChatLine[];
  /** Past an episode you haven't seen: which one, the latest aired (what "Show them" unfolds through), how many
   *  messages are folded, and who the chat's own reveal lines say has revealed it. `byMark`: every folded one is folded by
   *  its author's mark (a season watched at its own pace), not by airtime. Null when nothing's past you. */
  fold: { episode: number; latest: number; count: number; revealed: string[]; byMark: boolean } | null;
  you: { userId: string; canPost: boolean; moderator: boolean };
  v: string;
}

/**
 * The conversation as you may read it: folded past where you are (chat-fold.ts), unfolded through `unfold` when
 * you've asked. With `v`, just { unchanged } when nothing it's built from has changed.
 */
export async function readCouchChat(
  user: SessionUser,
  scope: ChatScope,
  opts: { v?: string | null; unfold?: number | null } = {}
): Promise<CouchChat | { unchanged: true; v: string } | { out: true }> {
  if (scope.out) return { out: true };
  const [where, params] = inScope(scope);
  // The same parameters, the messages aliased `c` for the reactions' join.
  const [whereC] = inScope(scope, "c");
  const [seen, episodes, fp] = await Promise.all([
    seenThrough(user.id, scope.seasonId),
    airTimes(scope.seasonId),
    pool.query(
      `SELECT md5(concat_ws('|',
         (SELECT string_agg(id::text || ':' || coalesce(edited_at::text, ''), ',' ORDER BY id) FROM chat_messages WHERE ${where} AND type <> 'system'),
         (SELECT string_agg(r.id::text, ',' ORDER BY r.id) FROM chat_reactions r JOIN chat_messages c ON c.id = r.message_id WHERE ${whereC})
       )) AS v`,
      params
    ),
  ]);
  const fold = foldFor(episodes, seen, opts.unfold ?? null);
  const v = crypto
    .createHash("md5")
    .update([fp.rows[0].v, fold ? `${fold.episode}:${fold.latest}:${fold.from}:${fold.mark}` : "-", scope.role, scope.moderator].join("|"))
    .digest("hex");
  if (opts.v === v) return { unchanged: true, v };

  // author_seen decides the fold here and is never sent (ChatLine has no place for it); it, and a reveal line, only from someone who
  // shares Where I am (step 15 part 3: chat.ts AUTHOR_SEEN, REVEAL_SHARED).
  const { rows } = await pool.query(
    `SELECT * FROM (SELECT ${MESSAGE_COLUMNS}, ${AUTHOR_SEEN} FROM chat_messages WHERE ${where} AND type <> 'system' AND ${REVEAL_SHARED("$4")}
        ORDER BY created_at DESC LIMIT 300) recent ORDER BY created_at ASC`,
    [...params, user.id]
  );
  const shown = rows.filter((m) => !isFolded(m, fold, user.id));
  const reacted = new Map((await withReactions(shown)).map((m) => [m.id, m.reactions]));
  let count = 0;
  let byMark = true;
  const messages: ChatLine[] = rows.map((m) => {
    const folded = isFolded(m, fold, user.id);
    if (folded) {
      count++;
      byMark &&= byAuthorMark(m);
    }
    return {
      id: m.id,
      userId: m.user_id,
      name: m.author_name,
      type: m.type,
      text: folded ? null : m.text,
      at: new Date(m.created_at).toISOString(),
      edited: !folded && !!m.edited_at,
      reactions: folded ? {} : (reacted.get(m.id) ?? {}),
      ...(folded ? { folded: true as const } : {}),
    };
  });
  return {
    messages,
    fold: fold ? { episode: fold.episode, latest: fold.latest, count, revealed: revealedBy(rows, fold.episode, user.id), byMark: count > 0 && byMark } : null,
    you: { userId: user.id, canPost: scope.role !== "viewer", moderator: scope.moderator },
    v,
  };
}

/** Posts a message to the couch's chat about the show: into its first game there, else the couch and season. */
export async function postCouchChat(user: SessionUser, scope: ChatScope, rawText: unknown): Promise<ChatLine> {
  if (scope.role === "viewer") throw new HttpError(403, "Only people on the couch can post here");
  if (scope.out) throw new HttpError(403, "Chat opens once you're caught up and in the game");
  const text = messageText(rawText);
  const name = authorName(user as { name: string; username?: string | null });
  const m = await insertMessage(
    user as { id: string; name: string; username?: string | null },
    scope.postTo ? { leagueId: scope.postTo, seasonId: scope.seasonId } : { couchId: scope.couchId, seasonId: scope.seasonId },
    text
  );
  // Everyone in the conversation hears, as it would show them it (step 15 part 2: folded, quiet or not at all).
  notifyCouchChat({ messageId: m.id, authorId: user.id, authorName: name, text, leagueId: scope.postTo, couchId: scope.couchId, seasonId: scope.seasonId });
  return { id: m.id, userId: m.user_id, name: m.author_name, type: "message", text: m.text, at: new Date(m.created_at).toISOString(), edited: false, reactions: {} };
}

/** A message in this conversation, for reacting, editing or removing; 404 when it isn't one. */
export async function messageInScope(scope: ChatScope, messageId: string): Promise<{ user_id: string | null; type: string }> {
  if (!isUuid(messageId)) throw new HttpError(404, "Message not found");
  const [where, params] = inScope(scope, "", 2);
  const { rows } = await pool.query(`SELECT user_id, type FROM chat_messages WHERE id = $1 AND ${where}`, [messageId, ...params]);
  if (!rows.length) throw new HttpError(404, "Message not found");
  return rows[0];
}

/**
 * You've read the conversation up to `at` (the newest message you've seen): forward only, never past now. Moves the
 * couch's read and classic's for each of its games here, so both designs' badges agree.
 */
export async function markCouchChatRead(userId: string, scope: ChatScope, at: unknown): Promise<void> {
  const parsed = typeof at === "string" ? new Date(at) : new Date();
  const when = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();
  await pool.query(
    `INSERT INTO couch_chat_reads (couch_id, season_id, user_id, last_read_at) VALUES ($1, $2, $3, LEAST($4::timestamptz, now()))
     ON CONFLICT (couch_id, season_id, user_id) DO UPDATE SET last_read_at = GREATEST(couch_chat_reads.last_read_at, EXCLUDED.last_read_at)`,
    [scope.couchId, scope.seasonId, userId, when]
  );
  if (scope.leagueIds.length) {
    await pool.query(
      `INSERT INTO chat_reads (league_id, user_id, last_read_at)
       SELECT id, $2, LEAST($3::timestamptz, now()) FROM unnest($1::uuid[]) AS id
       ON CONFLICT (league_id, user_id) DO UPDATE SET last_read_at = GREATEST(chat_reads.last_read_at, EXCLUDED.last_read_at)`,
      [scope.leagueIds, userId, when]
    );
  }
}

/**
 * The Chat tab's badge: how many of the conversation's newest 300 are someone else's and newer than what you've read
 * (the later of this couch's read and classic's in its games here), counted in the database (a number comes back).
 * With `reveal`, also who the chat's reveal lines say has revealed that episode (Tonight's Results are in).
 */
export async function couchChatUnread(user: SessionUser, scope: ChatScope, reveal: number | null): Promise<{ unread: number; revealed?: string[] }> {
  if (scope.out) return { unread: 0 };
  const [where, params] = inScope(scope, "", 2);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS unread FROM (
       SELECT user_id, created_at FROM chat_messages WHERE ${where} AND type <> 'system' ORDER BY created_at DESC LIMIT 300) recent
      WHERE recent.user_id IS DISTINCT FROM $1
        AND date_trunc('milliseconds', recent.created_at) > COALESCE(GREATEST(
              (SELECT last_read_at FROM couch_chat_reads WHERE couch_id = $3 AND season_id = $4 AND user_id = $1),
              (SELECT max(last_read_at) FROM chat_reads WHERE league_id = ANY($2::uuid[]) AND user_id = $1)), '-infinity')`,
    [user.id, ...params]
  );
  const out: { unread: number; revealed?: string[] } = { unread: rows[0].unread as number };
  if (reveal !== null) {
    const [w, p] = inScope(scope);
    const { rows: lines } = await pool.query(
      `SELECT * FROM (SELECT user_id, author_name, type, text, created_at FROM chat_messages WHERE ${w} AND type = 'reveal' AND ${REVEAL_SHARED("$4")}
          ORDER BY created_at DESC LIMIT 200) recent
        ORDER BY created_at`,
      [...p, user.id]
    );
    out.revealed = revealedBy(lines, reveal, user.id);
  }
  return out;
}
