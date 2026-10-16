import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { notifyAfter, userIdsForPlayers, leagueMemberUserIds, leagueName } from "./push-targets";
import { splitBySpoilerProtection } from "./results-seen";
import { groupLeagueIds, groupMemberUserIds } from "./league-groups";
import { outOfGroupChat } from "./late-join";
import { nudgeMessage, resultsLine } from "./waiver-pushes";

// One function per pushable event, so each route's trigger is a single line and all the "who gets
// this, and what does it say" decisions live together in one reviewable place.
//
// All of these must be called AFTER the route's write has committed (notifyAfter's rule). Each takes
// the actor's user id where relevant, so nobody is pushed about something they just did themselves.

// Every link carries ?league=, which AuthGate honours on load -- so a push about League B opens
// League B, not whichever league the app would have loaded first.
function link(path: string, leagueId: string) {
  return `${path}?league=${encodeURIComponent(leagueId)}`;
}

function truncate(text: string, max = 120) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Draft started, or a pick moved the draft on: tell whoever is now on the clock. */
export function notifyDraftTurn(leagueId: string, state: LeagueState, actorUserId: string | null) {
  notifyAfter("draftTurn", async () => {
    if (!StateLogic.isDraftStarted(state)) return null;
    const turn = StateLogic.currentDraftTurn(state);
    // Blind (shared-ownership) drafts have no turn order, and a finished draft has no one up.
    if (!turn || turn.isComplete || !turn.playerId) return null;
    const userIds = (await userIdsForPlayers(leagueId, [turn.playerId])).filter((id) => id !== actorUserId);
    if (!userIds.length) return null;
    return {
      userIds,
      message: {
        title: "You're on the clock",
        body: `It's your turn to draft in ${await leagueName(leagueId)}.`,
        url: link("/draft", leagueId),
        tag: `draft-${leagueId}`,
      },
    };
  });
}

/**
 * Someone was eliminated. Spoiler protection (results-seen.ts) splits the audience: anyone who opted
 * out gets who went home, listing everyone out so far this episode so repeat boots collapse; everyone
 * else only hears that results are in -- the names wait for them to tap Reveal in the app.
 *
 * In a waivers league both end with when the week these results opened processes ("Waivers process Tue
 * 8:00 PM EDT."): every week, to everyone, so it says nothing about who left.
 */
export function notifyEpisodeResults(leagueId: string, state: LeagueState, epId: string, actorUserId: string | null) {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep || !ep.events.length) return;
  // Looked up inside each after() callback (not here, before the write commits), once, shared by both.
  let split: ReturnType<typeof splitBySpoilerProtection> | null = null;
  const audience = () => (split ??= leagueMemberUserIds(leagueId, actorUserId, { ghosts: true }).then(splitBySpoilerProtection));
  let waivers: Promise<string> | null = null;
  const waiverLine = () => (waivers ??= resultsLine(pool, state, ep.number));
  const tag = `episode-${leagueId}-${ep.number}`;
  notifyAfter("episodeResults", async () => {
    const outs = ep.events
      .map((ev) => {
        const c = StateLogic.getCastaway(state, ev.castawayId);
        return c ? `${c.name} (${ev.method})` : null;
      })
      .filter(Boolean)
      .join(", ");
    return {
      userIds: (await audience()).immediate,
      message: {
        title: `Episode ${ep.number} results`,
        body: truncate(`${outs} · ${await leagueName(leagueId)}`) + ((await waiverLine()) ? `.${await waiverLine()}` : ""),
        url: link("/episodes", leagueId),
        tag,
      },
    };
  });
  notifyAfter("episodeResults", async () => ({
    userIds: (await audience()).protectedIds,
    message: {
      title: "Results are in!",
      body: `Episode ${ep.number} · ${await leagueName(leagueId)} — open the app when you're ready.${await waiverLine()}`,
      url: link("/", leagueId),
      tag,
    },
  }));
}

/**
 * The commissioner's Nudge on the Waivers page: one push to that player, worded for what they may know
 * (waiver-pushes.js nudgeMessage). False when they have no account to reach.
 */
export async function notifyWaiverNudge(leagueId: string, state: LeagueState, playerId: string, byName: string): Promise<boolean> {
  const target = await nudgeMessage(pool, leagueId, state, playerId, byName);
  if (!target) return false;
  notifyAfter("waiverReminder", async () => target);
  return true;
}

/** A side bet was proposed: everyone but the proposer can now guess. */
export function notifyNewBet(leagueId: string, label: string, actorUserId: string | null) {
  notifyAfter("newBet", async () => ({
    userIds: await leagueMemberUserIds(leagueId, actorUserId),
    message: {
      title: "New prediction",
      body: truncate(`"${label}" · ${await leagueName(leagueId)}`),
      url: link("/", leagueId),
      tag: `bet-${leagueId}`,
    },
  }));
}

/** A guess was graded right or wrong: tell the person who made it. */
export function notifyBetResult(leagueId: string, state: LeagueState, epId: string, betId: string, predId: string, correct: boolean) {
  notifyAfter("betResult", async () => {
    const ep = state.episodes.find((e) => e.id === epId);
    const bet = ep && (ep.bets || []).find((b) => b.id === betId);
    const pred = bet && bet.predictions.find((p) => p.id === predId);
    if (!bet || !pred) return null;
    // Right or wrong gives the episode away, so only someone who opted out of spoiler protection
    // hears it this way; everyone else finds out when they reveal the results.
    const { immediate } = await splitBySpoilerProtection(await userIdsForPlayers(leagueId, [pred.playerId]));
    return {
      userIds: immediate,
      message: {
        title: correct ? `You got it right (+${bet.points})` : "Missed that one",
        body: truncate(`"${bet.label}" — you guessed ${pred.guess}`),
        url: link("/", leagueId),
        tag: `bet-result-${betId}`,
      },
    };
  });
}

/**
 * New chat message: everyone but the author. One notification per league, kept up to date.
 * Spoiler protection: once an episode someone hasn't revealed has started airing, the chat may be
 * talking about it (SpoilerLogic.chatWindow) -- they hear that a message came in, not what it says.
 */
export function notifyChat(leagueId: string, authorUserId: string, authorName: string, text: string) {
  // Looked up inside the after() callbacks, once, shared by both.
  let split: Promise<{ plain: string[]; guarded: string[]; episode: number | null }> | null = null;
  const audience = () => (split ??= chatAudience(leagueId, authorUserId));
  const tag = `chat-${leagueId}`;
  notifyAfter("chat", async () => ({
    userIds: (await audience()).plain,
    message: { title: await leagueName(leagueId), body: truncate(`${authorName}: ${text}`), url: link("/chat", leagueId), tag },
  }));
  notifyAfter("chat", async () => {
    const { guarded, episode } = await audience();
    return {
      userIds: guarded,
      message: {
        title: await leagueName(leagueId),
        body: `${authorName} sent a message — it may contain episode ${episode} spoilers.`,
        url: link("/chat", leagueId),
        tag,
      },
    };
  });
}

// Everyone in the conversation (a linked league's chat is its whole group's, league-groups.ts), split
// by whether the episode now airing is one they've revealed. Their mark is the furthest across the
// group (a reveal is a reveal in every linked league); never loaded yet means the latest with results,
// what their first load will set it to.
async function chatAudience(leagueId: string, authorUserId: string) {
  const { rows: st } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  const state = st[0]?.state as LeagueState | undefined;
  // Late joiners have no chat (it's the league's conversation, and the league can't see them) -- unless
  // they're an ordinary player in another linked league, and in the conversation through that one.
  const hidden = await outOfGroupChat(await groupLeagueIds(leagueId));
  const userIds = (await groupMemberUserIds(leagueId, authorUserId)).filter((id) => !hidden.has(id));
  if (!state || !userIds.length) return { plain: userIds, guarded: [], episode: null };
  const { immediate } = await splitBySpoilerProtection(userIds);
  const { rows } = await pool.query(
    `SELECT user_id, max(results_seen_through) AS seen FROM league_memberships
      WHERE league_id = ANY($1::uuid[]) AND user_id = ANY($2::text[]) GROUP BY user_id`,
    [await groupLeagueIds(leagueId), userIds]
  );
  const seenBy = new Map(rows.map((r) => [r.user_id as string, r.seen as number | null]));
  const latest = StateLogic.SpoilerLogic.latestWithResults(state);
  const plain: string[] = [];
  const guarded: string[] = [];
  let episode: number | null = null;
  for (const id of userIds) {
    const w = immediate.includes(id) ? null : StateLogic.SpoilerLogic.chatWindow(state, seenBy.get(id) ?? latest);
    if (w) {
      guarded.push(id);
      episode = w.episode;
    } else plain.push(id);
  }
  return { plain, guarded, episode };
}

/** Someone joined (or came back to) a league: everyone already in it, not the person joining. */
export function notifyMemberJoined(leagueId: string, joinerUserId: string, joinerName: string, returning: boolean) {
  notifyAfter("memberJoined", async () => {
    const userIds = await leagueMemberUserIds(leagueId, joinerUserId);
    if (!userIds.length) return null;
    return {
      userIds,
      message: {
        title: returning ? "Welcome back" : "New league member",
        body: `${joinerName} ${returning ? "rejoined" : "joined"} ${await leagueName(leagueId)}.`,
        url: link("/setup/players", leagueId),
        tag: `joined-${leagueId}`,
      },
    };
  });
}

/**
 * A late joiner chose where to start (StateLogic.GhostLogic): the commissioners, who are the only ones
 * who can see them, hear about it -- with a link to where they'd add them to the league.
 */
export function notifyLateJoinerStarted(leagueId: string, name: string, startEpisode: number) {
  notifyAfter("memberJoined", async () => {
    const { rows } = await pool.query("SELECT user_id FROM league_memberships WHERE league_id=$1 AND role='commissioner'", [leagueId]);
    if (!rows.length) return null;
    return {
      userIds: rows.map((r) => r.user_id as string),
      message: {
        title: "A late joiner started",
        body: `${name} is playing ${await leagueName(leagueId)} from episode ${startEpisode}, out of sight until you add them.`,
        url: link("/setup/players", leagueId),
        tag: `joined-${leagueId}`,
      },
    };
  });
}

/** Invited to a league: reaches the invitee only if the identifier matches an existing account. */
// One push however many leagues it's for: inviting someone to every linked league sends a single
// "invited you to A, B and C", not one per league.
export function notifyInvite(leagueIds: string | string[], identifier: string, inviterName: string) {
  const ids = Array.isArray(leagueIds) ? leagueIds : [leagueIds];
  if (!ids.length) return;
  notifyAfter("invite", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM "user" WHERE lower(username)=lower($1) OR lower(email)=lower($1)`,
      [identifier]
    );
    if (!rows.length) return null;
    const names = await Promise.all(ids.map((id) => leagueName(id)));
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    return {
      userIds: rows.map((r) => r.id),
      message: {
        title: ids.length > 1 ? "League invites" : "League invite",
        body: `${inviterName} invited you to ${list}.`,
        // Pending invites are shown on the Dashboard, not inside a league.
        url: "/dashboard",
        tag: `invite-${ids[0]}`,
      },
    };
  });
}
