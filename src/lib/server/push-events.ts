import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";
import { notifyAfter, userIdsForPlayers, leagueMemberUserIds, leagueName } from "./push-targets";

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

/** A replenish or swap round started or advanced: tell the player who's now up. */
export function notifyMidSeasonTurn(leagueId: string, state: LeagueState, actorUserId: string | null) {
  notifyAfter("midSeasonTurn", async () => {
    let playerId: string | undefined;
    let what = "";
    const r = StateLogic.currentReplenishTurn(state);
    const t = state.midSeason.trade;
    if (r && !r.isComplete && r.playerId) {
      playerId = r.playerId;
      what = "replenish pick";
    } else if (t && t.index < t.queue.length) {
      playerId = t.queue[t.index].playerId;
      what = "swap";
    }
    if (!playerId) return null;
    const userIds = (await userIdsForPlayers(leagueId, [playerId])).filter((id) => id !== actorUserId);
    if (!userIds.length) return null;
    return {
      userIds,
      message: {
        title: `You're up for a ${what}`,
        body: `Let your commissioner know your ${what} in ${await leagueName(leagueId)}.`,
        url: link("/mid-season", leagueId),
        tag: `midseason-${leagueId}`,
      },
    };
  });
}

/** Someone was eliminated. Lists everyone out so far this episode, so repeat boots collapse. */
export function notifyEpisodeResults(leagueId: string, state: LeagueState, epId: string, actorUserId: string | null) {
  notifyAfter("episodeResults", async () => {
    const ep = state.episodes.find((e) => e.id === epId);
    if (!ep || !ep.events.length) return null;
    const outs = ep.events
      .map((ev) => {
        const c = StateLogic.getCastaway(state, ev.castawayId);
        return c ? `${c.name} (${ev.method})` : null;
      })
      .filter(Boolean)
      .join(", ");
    return {
      userIds: await leagueMemberUserIds(leagueId, actorUserId),
      message: {
        title: `Episode ${ep.number} results`,
        body: truncate(`${outs} · ${await leagueName(leagueId)}`),
        url: link("/episodes", leagueId),
        tag: `episode-${leagueId}-${ep.number}`,
      },
    };
  });
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
    return {
      userIds: await userIdsForPlayers(leagueId, [pred.playerId]),
      message: {
        title: correct ? `You got it right (+${bet.points})` : "Missed that one",
        body: truncate(`"${bet.label}" — you guessed ${pred.guess}`),
        url: link("/", leagueId),
        tag: `bet-result-${betId}`,
      },
    };
  });
}

/** New chat message: everyone but the author. One notification per league, kept up to date. */
export function notifyChat(leagueId: string, authorUserId: string, authorName: string, text: string) {
  notifyAfter("chat", async () => ({
    userIds: await leagueMemberUserIds(leagueId, authorUserId),
    message: {
      title: await leagueName(leagueId),
      body: truncate(`${authorName}: ${text}`),
      url: link("/chat", leagueId),
      tag: `chat-${leagueId}`,
    },
  }));
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
        url: link("/setup", leagueId),
        tag: `joined-${leagueId}`,
      },
    };
  });
}

/** Invited to a league: reaches the invitee only if the identifier matches an existing account. */
export function notifyInvite(leagueId: string, identifier: string, inviterName: string) {
  notifyAfter("invite", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM "user" WHERE lower(username)=lower($1) OR lower(email)=lower($1)`,
      [identifier]
    );
    if (!rows.length) return null;
    return {
      userIds: rows.map((r) => r.id),
      message: {
        title: "League invite",
        body: `${inviterName} invited you to ${await leagueName(leagueId)}.`,
        // Pending invites are shown on the Dashboard, not inside a league.
        url: "/dashboard",
        tag: `invite-${leagueId}`,
      },
    };
  });
}
