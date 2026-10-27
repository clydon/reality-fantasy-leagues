import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { foldFor, isFolded, byAuthorMark } from "@/lib/game/chat-fold";
import { pool } from "./db";
import { notifyAfter, userIdsForPlayers, leagueMemberUserIds, leagueName } from "./push-targets";
import { sendPush, type PushMessage, type PushReader } from "./push-core";
import { groupLeagueIds } from "./league-groups";
import { hiddenFromGroup, outOfGroupChat } from "./late-join";
import { EVERYTHING, seenThrough, shares } from "./guard";
import { AUTHOR_SEEN } from "./chat";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { seasonSchedules } from "./schedule";
import { after } from "next/server";
import { clock, nudgeMessage, resultsLine, sendWindow, type WindowSnapshot } from "./waiver-pushes";
import { showWords } from "@/lib/game/show-words";

// One function per pushable event, so each route's trigger is a single line and all the "who gets this, and what does it say"
// decisions live together in one reviewable place.
//
// All of these must be called AFTER the route's write has committed (notifyAfter's rule). Each takes the actor's user id where
// relevant, so nobody is pushed about something they just did themselves.
//
// Notifications by moment (docs/PLAN-new-design.md step 15 part 2): each push is worded per reader. What it may say about an
// episode is what the spoiler guard lets out for that reader (guard.ts seenThrough: their mark on the season, or everything if
// they see results straight away), never one audience split in two; a time is in the reader's own zone (kept from their
// phone); and it opens the design the reader is on (push-core.js: `next` for the new design, `url` for classic). Everyone it's
// for gets it in the bell, whatever their switches say.

// Every classic link carries ?league=, which AuthGate honours on load -- so a push about League B opens League B, not whichever
// league the app would have loaded first.
function link(path: string, leagueId: string) {
  return `${path}?league=${encodeURIComponent(leagueId)}`;
}

function truncate(text: string, max = 120) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
const DEFAULT_TZ = "America/New_York";

/** "Survivor 51": a season the way pushes name it. */
export function seasonLabel(showName: string, seasonNumber: number | null | undefined): string {
  return `${plain(showName).replace(/^The /, "")}${seasonNumber ? ` ${seasonNumber}` : ""}`;
}

interface LeagueSeason {
  seasonId: string | null;
  label: string;
  leagueName: string;
  couchId: string | null;
  airTz: string;
}

/** The season a league plays, as pushes need it (null season: a league not in the catalog, which classic still has). */
export async function leagueSeason(leagueId: string): Promise<LeagueSeason> {
  const { rows } = await pool.query(
    `SELECT l.name, l.couch_id, ss.id AS season_id, ss.season_number, ss.air_tz, s.name AS show_name
       FROM leagues l LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE l.id = $1`,
    [leagueId]
  );
  const r = rows[0];
  return {
    seasonId: (r?.season_id as string) ?? null,
    label: r?.show_name ? seasonLabel(r.show_name, r.season_number) : (r?.name ?? "your league"),
    leagueName: r?.name ?? "your league",
    couchId: (r?.couch_id as string) ?? null,
    airTz: (r?.air_tz as string) || DEFAULT_TZ,
  };
}

/** A season's label and time zone. */
export async function seasonInfo(seasonId: string): Promise<{ label: string; airTz: string; showId: string } | null> {
  const { rows } = await pool.query(
    "SELECT s.id AS show_id, s.name AS show_name, ss.season_number, ss.air_tz FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1",
    [seasonId]
  );
  return rows[0] ? { label: seasonLabel(rows[0].show_name, rows[0].season_number), airTz: rows[0].air_tz || DEFAULT_TZ, showId: rows[0].show_id } : null;
}

/**
 * How far someone may be told about on a season (the guard's mark), or on a league with no season (its own mark, everything
 * when they see results straight away). Fails closed: no mark is episode 0.
 */
async function markOf(userId: string, seasonId: string | null, leagueId: string | null): Promise<number> {
  if (seasonId) return seenThrough(userId, seasonId);
  if (!leagueId) return 0;
  const { rows } = await pool.query(
    `SELECT m.results_seen_through, COALESCE(s.show_results_immediately, false) AS immediate
       FROM league_memberships m LEFT JOIN user_settings s ON s.user_id = m.user_id WHERE m.league_id = $1 AND m.user_id = $2`,
    [leagueId, userId]
  );
  if (!rows.length) return 0;
  if (rows[0].immediate) return EVERYTHING;
  return Number.isInteger(rows[0].results_seen_through) ? rows[0].results_seen_through : 0;
}

/** "Thu 8:00 PM PDT": in the reader's own zone when their phone has said it, else the season's. */
export function readerClock(at: number | string, reader: PushReader, seasonTz: string): string {
  return clock(new Date(at).toISOString(), reader.tz || seasonTz);
}

/** Which of these keys someone has in their bell already (told before). */
async function keysOf(userId: string, keys: string[]): Promise<Set<string>> {
  const { rows } = await pool.query("SELECT key FROM notifications WHERE user_id = $1 AND key = ANY($2::text[])", [userId, keys]);
  return new Set(rows.map((r) => r.key as string));
}

const andList = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// ---------- the draft ----------

/** Draft started, or a pick moved the draft on: tell whoever is now on the clock. */
export function notifyDraftTurn(leagueId: string, state: LeagueState, actorUserId: string | null) {
  notifyAfter("draftTurn", async () => {
    if (!StateLogic.isDraftStarted(state)) return null;
    const turn = StateLogic.currentDraftTurn(state);
    // Blind (shared-ownership) drafts have no turn order, and a finished draft has no one up.
    if (!turn || turn.isComplete || !turn.playerId) return null;
    const userIds = (await userIdsForPlayers(leagueId, [turn.playerId])).filter((id) => id !== actorUserId);
    if (!userIds.length) return null;
    const ls = await leagueSeason(leagueId);
    return {
      userIds,
      seasonId: ls.seasonId,
      message: {
        title: "You're on the clock",
        body: `It's your turn to draft in ${ls.leagueName}.`,
        url: link("/draft", leagueId),
        next: ls.seasonId ? `/show/${ls.seasonId}/draft?game=${leagueId}` : "/home",
        tag: `draft-${leagueId}`,
        seasonId: ls.seasonId,
      },
    };
  });
}

/** Whoever runs the game nudged the player on the clock (the draft room's Nudge): one push to them. False: no account. */
export async function notifyDraftNudge(leagueId: string, playerId: string, byName: string): Promise<boolean> {
  const userIds = await userIdsForPlayers(leagueId, [playerId]);
  if (!userIds.length) return false;
  const ls = await leagueSeason(leagueId);
  notifyAfter("draftTurn", async () => ({
    userIds,
    seasonId: ls.seasonId,
    message: {
      title: "You're on the clock",
      body: `${byName} nudged you: it's your turn to draft in ${ls.leagueName}.`,
      url: link("/draft", leagueId),
      next: ls.seasonId ? `/show/${ls.seasonId}/draft?game=${leagueId}` : "/home",
      tag: `draft-${leagueId}`,
      seasonId: ls.seasonId,
    },
  }));
  return true;
}

// ---------- results ----------

/** Who went home in an episode, by name ("Cristian Chavez", "Nobody"), as the league holds it. */
function outNames(state: LeagueState, ep: LeagueState["episodes"][number]): string {
  if (ep.noExit && !ep.events.length) return "Nobody";
  const names = ep.events.map((ev) => StateLogic.getCastaway(state, ev.castawayId)?.name).filter((n): n is string => !!n);
  return names.length > 2 ? `${names.length} people` : andList(names);
}

/**
 * An episode's results came in (or moved on): the season's moments, Early results are in and Final scores are in, once per
 * person however many of their games play the season (three linked games' results are one notice: the bell's keys
 * results:<season>:<n> and final:<season>:<n>). Early: who went home is in; final: the full results (the morning after). Results
 * that arrive final at once are both, in one notice.
 *
 * The words are the guard's for each reader: someone who has seen the episode (or sees results straight away) hears who went
 * home; anyone else only that results are in, to reveal when they've watched. In a waivers league both end with when the week
 * these results opened processes ("Waivers process Tue 5:00 PM PDT."): every week, to everyone, in the reader's own zone.
 */
export function notifyEpisodeResults(leagueId: string, state: LeagueState, epId: string, actorUserId: string | null) {
  const ep = state.episodes.find((e) => e.id === epId);
  const stage = ep ? StateLogic.resultsStage(ep) : null;
  if (!ep || !stage) return;
  // A game over a span has nothing to say about an episode after its last (another game on the season tells them).
  const end = StateLogic.endEpisode(state);
  if (end !== null && ep.number > end) return;
  const n = ep.number;
  notifyAfter(stage === "early" ? "episodeResults" : "finalScores", async () => {
    const userIds = await leagueMemberUserIds(leagueId, actorUserId, { ghosts: true });
    if (!userIds.length) return null;
    const ls = await leagueSeason(leagueId);
    const scope = ls.seasonId ?? leagueId;
    const R = `results:${scope}:${n}`;
    const F = `final:${scope}:${n}`;
    const names = outNames(state, ep);
    const message = async (reader: PushReader): Promise<PushMessage | null> => {
      const told = await keysOf(reader.userId, [R, F]);
      const kind = stage === "early" ? (told.size ? null : "early") : told.has(F) ? null : told.has(R) ? "final" : "both";
      if (!kind) return null;
      const sees = (await markOf(reader.userId, ls.seasonId, leagueId)) >= n;
      const waiver = kind === "final" ? "" : await resultsLine(pool, state, n, reader.tz);
      const safe = {
        title: `Episode ${n} ${kind === "final" ? "final scores are" : "results are"} in`,
        body: `${ls.label} · Reveal when you've watched.${waiver}`,
      };
      const named = kind !== "final" && sees;
      const words = named
        ? { title: `Episode ${n}: ${names} went home`, body: `${ls.label} · ${kind === "both" ? "Final scores are in." : "Final scores the morning after."}${waiver}` }
        : kind === "final" && sees
          ? { title: safe.title, body: `${ls.label} · See where you stand.` }
          : safe;
      return {
        ...words,
        url: sees ? link("/episodes", leagueId) : link("/", leagueId),
        next: ls.seasonId ? `/show/${ls.seasonId}/tonight` : "/home",
        tag: `results-${scope}-${n}`,
        key: kind === "early" ? R : F,
        seasonId: ls.seasonId,
        ...(named ? { spoils: n, safe } : {}),
        ...(kind === "both" ? { anyOf: ["episodeResults", "finalScores"] } : {}),
      } satisfies PushMessage;
    };
    return { userIds, seasonId: ls.seasonId, message };
  });
}

// ---------- waivers ----------

/**
 * The commissioner's Nudge on the Waivers page: one push to that player, worded for what they may know (waiver-pushes.js
 * nudgeMessage). False when they have no account to reach.
 */
export async function notifyWaiverNudge(leagueId: string, state: LeagueState, playerId: string, byName: string): Promise<boolean> {
  const target = await nudgeMessage(pool, leagueId, state, playerId, byName);
  if (!target) return false;
  notifyAfter("waiverReminder", async () => target);
  return true;
}

/**
 * The commissioner opened, changed or turned off a waiver window: the rotation hears the window's no-names line, anyone whose
 * claim it trimmed hears that instead (waiver-pushes.js windowMessages). `before` is windowSnapshot from inside the lock,
 * before the change.
 */
export function notifyWaiverWindow(leagueId: string, state: LeagueState, before: WindowSnapshot | null, periodId: string, trimmed: string[], actorUserId: string | null) {
  after(() => sendWindow(pool, leagueId, state, before, periodId, trimmed, { actorUserId }));
}

// ---------- predictions ----------

/** A side bet was proposed: everyone but the proposer can now guess. */
export function notifyNewBet(leagueId: string, label: string, actorUserId: string | null) {
  notifyAfter("newBet", async () => {
    const ls = await leagueSeason(leagueId);
    return {
      userIds: await leagueMemberUserIds(leagueId, actorUserId),
      seasonId: ls.seasonId,
      message: {
        title: "New prediction",
        body: truncate(`"${label}" · ${ls.leagueName}`),
        url: link("/", leagueId),
        next: ls.seasonId ? `/show/${ls.seasonId}/tonight` : "/home",
        tag: `bet-${leagueId}`,
        seasonId: ls.seasonId,
      },
    };
  });
}

/**
 * A guess was graded right or wrong: tell the person who made it, if they've seen that episode (right or wrong gives it away;
 * anyone else finds out when they reveal it).
 */
export function notifyBetResult(leagueId: string, state: LeagueState, epId: string, betId: string, predId: string, correct: boolean) {
  notifyAfter("betResult", async () => {
    const ep = state.episodes.find((e) => e.id === epId);
    const bet = ep && (ep.bets || []).find((b) => b.id === betId);
    const pred = bet && bet.predictions.find((p) => p.id === predId);
    if (!ep || !bet || !pred) return null;
    const ls = await leagueSeason(leagueId);
    return {
      userIds: await userIdsForPlayers(leagueId, [pred.playerId]),
      seasonId: ls.seasonId,
      message: async (reader: PushReader) =>
        (await markOf(reader.userId, ls.seasonId, leagueId)) >= ep.number
          ? {
              title: correct ? `You got it right (+${bet.points})` : "Missed that one",
              body: truncate(`"${bet.label}" — you guessed ${pred.guess}`),
              url: link("/", leagueId),
              next: ls.seasonId ? `/show/${ls.seasonId}/games` : "/home",
              tag: `bet-result-${betId}`,
              key: `bet:${betId}:${predId}`,
              seasonId: ls.seasonId,
            }
          : null,
    };
  });
}

// ---------- the couch chat ----------

interface ChatPosted {
  messageId: string;
  authorId: string;
  authorName: string;
  text: string;
  /** Posted into a game's chat (classic's league chat, or the new design's couch chat with a game on the season). */
  leagueId?: string | null;
  /** Posted on a show the couch only watches. */
  couchId?: string | null;
  seasonId?: string | null;
}

/**
 * A message in a couch's chat about a show: everyone in that conversation hears, worded as the chat would show it to them
 * (step 15 part 2). It's one conversation from both designs (couch-chat.ts): the couch's games on the season (classic's
 * linked-group chat), and since this step also a show the couch only watches and the people on the couch who follow the show
 * without playing (on the new design: classic's chat can't show them that conversation).
 *
 * Folded for someone (chat-fold.ts: past where they are) it says who wrote, never what; with Couch chat on Quiet on episode
 * nights (the recommended one) a folded message isn't pushed at all, and Never sends nothing. One notification per
 * conversation on a device, kept up to date. Never in the bell (the Chat tab has its own count).
 */
export function notifyCouchChat(posted: ChatPosted) {
  notifyAfter("chat", async () => {
    let couchId = posted.couchId ?? null;
    let seasonId = posted.seasonId ?? null;
    let label = "";
    let leagueIds: string[] = [];
    if (posted.leagueId) {
      const ls = await leagueSeason(posted.leagueId);
      couchId = ls.couchId;
      seasonId = ls.seasonId;
      label = ls.label;
      // The couch's games on the season, and the league's linked group (classic's conversation): one and the same today.
      const { rows } = couchId && seasonId
        ? await pool.query(
            `SELECT l.id FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE l.couch_id = $1 AND ss.id = $2 AND l.deleted_at IS NULL AND l.solo IS NULL`,
            [couchId, seasonId]
          )
        : { rows: [] as { id: string }[] };
      leagueIds = [...new Set([...rows.map((r) => r.id as string), ...(await groupLeagueIds(posted.leagueId))])];
    } else if (seasonId) {
      label = (await seasonInfo(seasonId))?.label ?? "";
    }
    if (!couchId && !leagueIds.length) return null;

    const [{ rows: players }, { rows: followers }, { rows: msg }, couch] = await Promise.all([
      pool.query("SELECT DISTINCT user_id, league_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [leagueIds]),
      couchId && seasonId
        ? pool.query(
            `SELECT cm.user_id FROM couch_members cm JOIN show_follows f ON f.user_id = cm.user_id AND f.season_id = $2 AND f.following
              WHERE cm.couch_id = $1`,
            [couchId, seasonId]
          )
        : Promise.resolve({ rows: [] as { user_id: string }[] }),
      // Its author's mark only while they share Where I am (chat.ts AUTHOR_SEEN): the words never say they were further along otherwise.
      pool.query(`SELECT user_id, type, created_at, ${AUTHOR_SEEN} FROM chat_messages WHERE id = $1`, [posted.messageId]),
      couchId ? pool.query("SELECT name FROM couches WHERE id = $1", [couchId]) : Promise.resolve({ rows: [] as { name: string }[] }),
    ]);
    const message = msg[0];
    if (!message) return null;
    // Out of the conversation: a ghost the games can't see (both designs), and in classic also someone catching up.
    const [ghosts, catchingUp] = leagueIds.length ? await Promise.all([hiddenFromGroup(leagueIds), outOfGroupChat(leagueIds)]) : [new Set<string>(), new Set<string>()];
    const leagueOf = new Map<string, string>();
    for (const p of players) if (!leagueOf.has(p.user_id)) leagueOf.set(p.user_id, p.league_id);
    const userIds = [...new Set([...leagueOf.keys(), ...followers.map((f) => f.user_id as string)])].filter((id) => id !== posted.authorId && !ghosts.has(id));
    if (!userIds.length) return null;
    const episodes = seasonId ? ((await seasonSchedules([seasonId])).get(seasonId)?.episodes ?? []).map((e) => ({ number: e.number, airAt: e.airAt })) : [];
    // "Survivor 51 · Couch Council" (a couch named for the show says it once).
    const title = [...new Set([label, couch.rows[0]?.name].filter(Boolean))].join(" · ") || (posted.leagueId ? await leagueName(posted.leagueId) : "Couch chat");
    const tag = `chat-${couchId ?? posted.leagueId}-${seasonId ?? ""}`;
    return {
      userIds,
      seasonId,
      bell: false,
      message: async (reader: PushReader): Promise<PushMessage | null> => {
        const inGames = leagueOf.get(reader.userId);
        // Classic shows only a game's chat, and not to someone catching up there.
        if (reader.ui !== "new" && (!inGames || catchingUp.has(reader.userId))) return null;
        const fold = seasonId ? foldFor(episodes, await seenThrough(reader.userId, seasonId), null) : null;
        const folded = isFolded(message, fold, reader.userId);
        if (folded && reader.chat === "quiet") return null;
        return {
          title,
          body: folded
            ? byAuthorMark(message)
              ? `${posted.authorName} sent a message from further along. Catch up to read it.`
              : `${posted.authorName} sent a message. It may be about Episode ${fold!.episode}: catch up when you reveal.`
            : truncate(`${posted.authorName}: ${posted.text}`),
          url: inGames ? link("/chat", inGames) : "/",
          next: seasonId ? `/show/${seasonId}/chat` : "/home",
          tag,
          seasonId,
        };
      },
    };
  });
}

// ---------- joining ----------

/** Someone joined (or came back to) a league: everyone already in it, not the person joining. */
export function notifyMemberJoined(leagueId: string, joinerUserId: string, joinerName: string, returning: boolean) {
  notifyAfter("memberJoined", async () => {
    const userIds = await leagueMemberUserIds(leagueId, joinerUserId);
    if (!userIds.length) return null;
    const ls = await leagueSeason(leagueId);
    return {
      userIds,
      seasonId: ls.seasonId,
      message: {
        title: returning ? "Welcome back" : "New league member",
        body: `${joinerName} ${returning ? "rejoined" : "joined"} ${ls.leagueName}.`,
        url: link("/setup/players", leagueId),
        next: ls.seasonId ? `/show/${ls.seasonId}/games` : "/home",
        tag: `joined-${leagueId}`,
        seasonId: ls.seasonId,
      },
    };
  });
}

/**
 * A late joiner chose where to start (StateLogic.GhostLogic): the commissioners, who are the only ones who can see them, hear
 * about it -- with a link to where they'd add them to the league.
 */
export function notifyLateJoinerStarted(leagueId: string, name: string, startEpisode: number) {
  notifyAfter("memberJoined", async () => {
    const { rows } = await pool.query("SELECT user_id FROM league_memberships WHERE league_id=$1 AND role='commissioner'", [leagueId]);
    if (!rows.length) return null;
    const ls = await leagueSeason(leagueId);
    return {
      userIds: rows.map((r) => r.user_id as string),
      seasonId: ls.seasonId,
      message: {
        title: "A late joiner started",
        body: `${name} is playing ${ls.leagueName} from episode ${startEpisode}, out of sight until you add them.`,
        url: link("/setup/players", leagueId),
        next: ls.seasonId ? `/show/${ls.seasonId}/backstage/members` : "/home",
        tag: `joined-${leagueId}`,
        seasonId: ls.seasonId,
      },
    };
  });
}

/** Invited to a league: reaches the invitee only if the identifier matches an existing account. */
// One push however many leagues it's for: inviting someone to every linked league sends a single "invited you to A, B and C",
// not one per league.
export function notifyInvite(leagueIds: string | string[], identifier: string, inviterName: string) {
  const ids = Array.isArray(leagueIds) ? leagueIds : [leagueIds];
  if (!ids.length) return;
  notifyAfter("invite", async () => {
    const { rows } = await pool.query(`SELECT id FROM "user" WHERE lower(username)=lower($1) OR lower(email)=lower($1)`, [identifier]);
    if (!rows.length) return null;
    const names = await Promise.all(ids.map((id) => leagueName(id)));
    return {
      userIds: rows.map((r) => r.id),
      message: {
        title: ids.length > 1 ? "League invites" : "League invite",
        body: `${inviterName} invited you to ${andList(names)}.`,
        // Pending invites are shown on classic's Dashboard, not inside a league.
        url: "/dashboard",
        next: "/home",
        tag: `invite-${ids[0]}`,
      },
    };
  });
}

/**
 * Someone on the couch asked to join a game whose Who can join is "Ask me first" (step 9): whoever runs it hears, with a link to
 * the show's Backstage, where the request waits in Needs you (classic: the game's players).
 */
export function notifyJoinRequest(leagueId: string, seasonId: string | null, name: string, gameName: string) {
  notifyAfter("memberJoined", async () => {
    const { rows } = await pool.query("SELECT user_id FROM league_memberships WHERE league_id = $1 AND role IN ('commissioner', 'admin')", [leagueId]);
    if (!rows.length) return null;
    return {
      userIds: rows.map((r) => r.user_id as string),
      seasonId,
      message: {
        title: `${name} asked to join ${gameName}`,
        body: "Let them in or not, from Backstage.",
        url: link("/setup/players", leagueId),
        next: seasonId ? `/show/${seasonId}/backstage` : "/home",
        tag: `join-request-${leagueId}`,
        seasonId,
      },
    };
  });
}

/** Whoever runs a game let someone in (step 9): they hear, with a link to the show, where they join it. */
export function notifyLetIn(leagueId: string, seasonId: string | null, userId: string, byName: string, gameName: string) {
  notifyAfter("memberJoined", async () => ({
    userIds: [userId],
    seasonId,
    message: {
      title: `You're in: ${gameName}`,
      body: `${byName} let you in. Pick where you start.`,
      url: link("/", leagueId),
      next: seasonId ? `/show/${seasonId}/games` : "/home",
      tag: `let-in-${leagueId}`,
      seasonId,
    },
  }));
}

/** Someone joined a couch with its code (step 15 part 2): everyone already on it hears. */
export function notifyCouchJoined(couchId: string, joinerUserId: string, joinerName: string) {
  notifyAfter("couchJoined", async () => {
    const { rows } = await pool.query("SELECT c.name, cm.user_id FROM couches c JOIN couch_members cm ON cm.couch_id = c.id WHERE c.id = $1", [couchId]);
    const userIds = rows.map((r) => r.user_id as string).filter((id) => id !== joinerUserId);
    if (!userIds.length) return null;
    return {
      userIds,
      message: {
        title: `${joinerName} joined ${rows[0].name}`,
        body: "Say hi, and ask them what they're watching.",
        url: "/",
        next: "/home",
        tag: `couch-joined-${couchId}`,
        key: `couch-joined:${couchId}:${joinerUserId}`,
      },
    };
  });
}

// ---------- the couch's own moments (step 15 part 2; the new design's alone: moments.js NEW_ONLY) ----------

/** Tell the couch (Start a game): everyone else on it hears, with a link to the show's Games tab, where they join. */
export function notifyGameStarted(o: { userIds: string[]; seasonId: string; leagueId: string; starter: string; show: string; gameName: string; label: string; from: string; span?: string | null }) {
  if (!o.userIds.length) return;
  notifyAfter("gameStarted", async () => ({
    userIds: o.userIds,
    seasonId: o.seasonId,
    message: {
      title: `${o.starter} started a game for ${o.show}`,
      // A game over a span says which ("for Games 4–6"); else where it starts.
      body: `${o.gameName} on ${o.label}, ${o.span ? `for ${o.span}` : `from ${o.from}`}. Join from the Games tab.`,
      next: `/show/${o.seasonId}/games`,
      tag: `started-${o.leagueId}`,
      key: `started:${o.leagueId}`,
      seasonId: o.seasonId,
    },
  }));
}

/** A watch along planned (step 11 part 3): everyone invited hears, the time in their own zone, to the show where I'm in is. */
export function notifyPlanned(o: { planId: string; userIds: string[]; seasonId: string; host: string; episode: number; live: boolean; at: number }) {
  notifyAfter("planned", async () => {
    const info = await seasonInfo(o.seasonId);
    if (!info) return null;
    return {
      userIds: o.userIds,
      seasonId: o.seasonId,
      message: (reader: PushReader) => ({
        title: `${o.host} planned a watch along`,
        body: `${info.label} · Episode ${o.episode} · ${o.live ? "the live airing" : "starting together"}, ${readerClock(o.at, reader, info.airTz)}. Are you in?`,
        next: `/show/${o.seasonId}/tonight`,
        tag: `plan-${o.planId}`,
        key: `planned:${o.planId}`,
        seasonId: o.seasonId,
      }),
    };
  });
}

/** How long a call-off waits before anyone hears: the toast's Undo lasts 5 s, so 8 s is past it (src/new/ui/toast.tsx). */
export const CALLED_OFF_AFTER_MS = 8_000;

/**
 * A watch along called off (step 11 part 3's Call it off): once its Undo has passed, whoever was invited or said I'm in hears.
 * The function waits after answering (nothing on a timer: the request's own after()), then checks it's still called off at
 * the same moment; an Undo, or a second call-off with its own wait, means this one says nothing.
 */
export function notifyPlanOff(o: { planId: string; byUserId: string; byName: string; cancelledAt: string }) {
  after(async () => {
    await new Promise((r) => setTimeout(r, CALLED_OFF_AFTER_MS));
    try {
      const { rows } = await pool.query(
        `SELECT p.season_id, p.episode, p.starts_at, p.cancelled_at,
                ARRAY(SELECT user_id FROM watch_plan_people x WHERE x.plan_id = p.id AND (x.invited OR x.answer = 'in') AND x.user_id <> $2) AS people
           FROM watch_plans p WHERE p.id = $1`,
        [o.planId, o.byUserId]
      );
      const p = rows[0];
      if (!p?.cancelled_at || new Date(p.cancelled_at).toISOString() !== o.cancelledAt || !p.people.length) return;
      const info = await seasonInfo(p.season_id);
      if (!info) return;
      await sendPush(
        pool,
        p.people,
        "planOff",
        (reader: PushReader) => {
          const day = new Intl.DateTimeFormat("en-US", { timeZone: reader.tz || info.airTz, weekday: "long" }).format(new Date(p.starts_at));
          return {
            title: `${o.byName} called off ${day}'s watch along`,
            body: `${info.label} · Episode ${p.episode}.`,
            next: `/show/${p.season_id}/tonight`,
            tag: `plan-${o.planId}`,
            key: `plan-off:${o.planId}:${o.cancelledAt}`,
            seasonId: p.season_id,
          };
        },
        { seasonId: p.season_id }
      );
    } catch (e) {
      console.error("[push] planOff notification failed:", e);
    }
  });
}

/** A poll started (step 12 part 2): the couch's people who may see it (they've seen the episode before it) hear. */
export function notifyPoll(o: { pollId: string; couchId: string; seasonId: string; episode: number; question: string; byUserId: string; byName: string }) {
  notifyAfter("poll", async () => {
    const info = await seasonInfo(o.seasonId);
    if (!info) return null;
    const { rows } = await pool.query(
      `SELECT cm.user_id FROM couch_members cm JOIN show_follows f ON f.user_id = cm.user_id AND f.season_id = $2 AND f.following
        WHERE cm.couch_id = $1 AND cm.user_id <> $3`,
      [o.couchId, o.seasonId, o.byUserId]
    );
    if (!rows.length) return null;
    return {
      userIds: rows.map((r) => r.user_id as string),
      seasonId: o.seasonId,
      message: async (reader: PushReader) =>
        (await seenThrough(reader.userId, o.seasonId)) >= o.episode - 1
          ? {
              title: `${o.byName} started a poll`,
              body: truncate(`${info.label} · Episode ${o.episode}: ${o.question}`),
              next: `/show/${o.seasonId}/tonight`,
              tag: `poll-${o.pollId}`,
              key: `poll:${o.pollId}`,
              seasonId: o.seasonId,
            }
          : null,
    };
  });
}

/**
 * Bingo lines on an episode (step 12 part 3's cards): each person with a line hears "You got a bingo line", and the people on
 * their couches who have a card on that episode hear "riley got a bingo line", only if riley shares her games on the show with
 * that reader (guard.ts shares, asked per reader: she follows it openly, as everywhere bingo shows; step 15 part 3). Only anyone
 * who has seen the episode: a line says which of its moments happened. `lines`: who has a line now (bingo.ts).
 */
export function notifyBingoLines(o: { seasonId: string; episode: number; lines: () => Promise<{ userId: string; name: string; mates: string[] }[]> }) {
  notifyAfter("bingoLine", async () => {
    const lines = await o.lines();
    if (!lines.length) return null;
    const info = await seasonInfo(o.seasonId);
    if (!info) return null;
    // Each reader's notices: their own line, then whoever else's they may hear of.
    const about = new Map<string, { userId: string; name: string }[]>();
    for (const l of lines) {
      about.set(l.userId, [...(about.get(l.userId) ?? []), { userId: l.userId, name: l.name }]);
      for (const m of l.mates) if (m !== l.userId) about.set(m, [...(about.get(m) ?? []), { userId: l.userId, name: l.name }]);
    }
    return {
      userIds: [...about.keys()],
      seasonId: o.seasonId,
      message: async (reader: PushReader) => {
        if ((await seenThrough(reader.userId, o.seasonId)) < o.episode) return null;
        // Only whoever shares their games here with this reader (yours always).
        const mine = [];
        for (const a of about.get(reader.userId) ?? []) if (await shares(reader.userId, a.userId, { kind: "play", seasonId: o.seasonId })) mine.push(a);
        const told = await keysOf(reader.userId, mine.map((a) => `bingo:${o.seasonId}:${o.episode}:${a.userId}`));
        const fresh = mine.filter((a) => !told.has(`bingo:${o.seasonId}:${o.episode}:${a.userId}`));
        const first = fresh.find((a) => a.userId === reader.userId) ?? fresh[0];
        if (!first) return null;
        const yours = first.userId === reader.userId;
        return {
          title: yours ? "You got a bingo line" : `${first.name} got a bingo line`,
          body: `${info.label} · Episode ${o.episode}.`,
          next: `/show/${o.seasonId}/episodes`,
          tag: `bingo-${o.seasonId}-${o.episode}`,
          key: `bingo:${o.seasonId}:${o.episode}:${first.userId}`,
          seasonId: o.seasonId,
        };
      },
    };
  });
}

/**
 * Someone called BINGO on an episode (docs/PLAN-bingo-bank.md step 3; bingo.ts callBingo): the people on that couch who follow
 * the show, are playing that episode or have seen it, and share their games with the caller (guard.ts shares) hear "riley called
 * BINGO · Look at their card", once per caller and episode (a second line called says nothing new). Never the caller. The words
 * say nothing about what happened; the card the link opens is spoiler-guarded (bingo.ts theirBingo).
 */
export function notifyBingoCall(o: { seasonId: string; episode: number; couchId: string; caller: string }) {
  notifyAfter("bingoLine", async () => {
    const info = await seasonInfo(o.seasonId);
    if (!info) return null;
    const { rows } = await pool.query(
      `SELECT m.user_id, (SELECT COALESCE(username, name) FROM "user" WHERE id = $3) AS caller
         FROM couch_members m JOIN show_follows f ON f.user_id = m.user_id AND f.season_id = $1 AND f.following
        WHERE m.couch_id = $2 AND m.user_id <> $3
          AND (f.seen_through >= $4 OR EXISTS (SELECT 1 FROM bingo_cards c WHERE c.user_id = m.user_id AND c.season_id = $1 AND c.episode = $4))`,
      [o.seasonId, o.couchId, o.caller, o.episode]
    );
    if (!rows.length) return null;
    const name = rows[0].caller as string;
    const key = `bingo:${o.seasonId}:${o.episode}:${o.caller}`;
    return {
      userIds: rows.map((r) => r.user_id as string),
      seasonId: o.seasonId,
      message: async (reader: PushReader) => {
        if (!(await shares(reader.userId, o.caller, { kind: "play", seasonId: o.seasonId }))) return null;
        if ((await keysOf(reader.userId, [key])).has(key)) return null;
        return {
          title: `${name} called BINGO`,
          body: `${info.label} · Episode ${o.episode} · Look at their card`,
          next: `/show/${o.seasonId}/tonight?bingo=${o.episode}&of=${o.caller}`,
          tag: `bingo-${o.seasonId}-${o.episode}`,
          key,
          seasonId: o.seasonId,
        };
      },
    };
  });
}

/**
 * Flags settled since last told (community-results.ts tellSettled claims them): whoever raised each hears how it went. They
 * had seen the episode to flag it, so the words may name the result.
 */
/**
 * An episode's results someone asked our bot to look up (research-asks.ts; db/bot-research.js settleAsk): they hear as each one
 * comes in, or that it couldn't be found. No names, so the words are the same whether or not they've seen it. One per ask
 * (asking again after a failure is a new one); on the phone, each replaces the season's last.
 */
export function notifyResearched(o: { userId: string; seasonId: string; episode: number; askedAt: Date; ok: boolean; found: number | null }) {
  notifyAfter("researchDone", async () => {
    const { rows } = await pool.query(
      "SELECT s.name AS show_name, s.castaway_term, s.episode_term, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1",
      [o.seasonId]
    );
    if (!rows[0]) return null;
    const label = seasonLabel(rows[0].show_name, rows[0].season_number);
    const w = showWords({ castaway: rows[0].castaway_term, episode: rows[0].episode_term });
    const ep = `${w.episode} ${o.episode}`;
    const found = o.found ?? 0;
    const words = o.ok
      ? {
          title: `${ep}'s results are in`,
          body: found ? `${label} · ${found === 1 ? "1 result" : `${found} results`}. The ${w.peopleTab} tab counts them now.` : `${label} · Nothing it found was sure enough to count.`,
          next: `/show/${o.seasonId}/cast`,
        }
      : { title: `Couldn't find ${ep}'s results`, body: `${label} · Our bot asked twice. Try again from the ${w.episodesTab} tab.`, next: `/show/${o.seasonId}/episodes` };
    return {
      userIds: [o.userId],
      seasonId: o.seasonId,
      message: { ...words, tag: `research-${o.seasonId}`, key: `research:${o.seasonId}:${o.episode}:${o.askedAt.getTime()}`, seasonId: o.seasonId },
    };
  });
}

export function notifyFlagsSettled(flags: { id: string; userId: string; seasonId: string; episode: number; status: string; what: string | null }[]) {
  for (const f of flags) {
    notifyAfter("flagSettled", async () => {
      const info = await seasonInfo(f.seasonId);
      if (!info) return null;
      // "Danny Kilby · individual immunity": the result as the flag named it (an event's id read as words).
      const [who, kind] = (f.what ?? "").split(" · ");
      const what = f.what ? `${who}${kind ? ` · ${kind.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}` : ""}: ` : "";
      const words =
        f.status === "upheld"
          ? { title: `You were right about Episode ${f.episode}`, body: `${info.label} · ${what}every game has it put right.` }
          : f.status === "kept"
            ? { title: `Episode ${f.episode}'s result stands`, body: `${info.label} · ${what}it was checked and stays.` }
            : { title: `Episode ${f.episode} was checked again`, body: `${info.label} · A full answer came in after your flag; anything it found is in.` };
      return {
        userIds: [f.userId],
        seasonId: f.seasonId,
        message: { ...words, next: `/show/${f.seasonId}/episodes`, tag: `flag-${f.id}`, key: `flag:${f.id}`, seasonId: f.seasonId },
      };
    });
  }
}
