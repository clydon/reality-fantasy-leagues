import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { isBetSettled } from "./selectors";

export type ActionKind = "invite" | "draftTurn" | "blindDraft" | "midSeasonTurn" | "lineup" | "pick" | "prediction";

export interface ActionItem {
  kind: ActionKind;
  /** Short, imperative: what to do. The league's name is shown alongside it, not in it. */
  text: string;
  /** Where doing it happens, within the league. Hash targets an Overview section. */
  href: string;
  /** "invite" only (from /api/me/actions, not actionItems): which invite, and who sent it. */
  inviteId?: string;
  invitedBy?: string | null;
}

// Everything in one league that's waiting on this player right now -- a pure function of league
// state, so the server can run it across all of a user's leagues (/api/me/actions) and the app-wide
// action bar can show what's due anywhere, not only in the league that's open. Most urgent first:
// turns (others are waiting on you) before weekly choices (a deadline, but nobody's blocked).
//
// Each check mirrors the UI that resolves it, so an item disappears as soon as the thing is done:
// draft-board/blind-draft-panel, mid-season, active-roster-lineup-grid, pickem-pick-grid,
// side-bets-section.
export function actionItems(state: LeagueState, playerId: string): ActionItem[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.disabled || me.active === false) return [];
  const type = StateLogic.getLeagueType(state);
  const items: ActionItem[] = [];

  // Draft: a snake-draft turn, or a blind draft still open to your picks.
  if (type.hasRoster && StateLogic.isDraftStarted(state)) {
    if (state.settings.ownershipMode === "shared") {
      const B = StateLogic.BlindDraftLogic;
      if (!B.isRevealed(state) && B.eligiblePlayers(state).some((p) => p.id === playerId) && !B.hasLocked(state, playerId)) {
        items.push({ kind: "blindDraft", text: "Lock in your draft picks", href: "/draft" });
      }
    } else {
      const turn = StateLogic.currentDraftTurn(state);
      if (turn && !turn.isComplete && turn.playerId === playerId) {
        items.push({ kind: "draftTurn", text: "It's your turn to draft", href: "/draft" });
      }
    }
  }

  // Mid-season: your turn in a running replenish or swap round.
  const rep = StateLogic.currentReplenishTurn(state);
  const trade = state.midSeason?.trade;
  const tradeTurn = trade && trade.index < trade.queue.length ? trade.queue[trade.index].playerId : null;
  if ((rep && !rep.isComplete && rep.playerId === playerId) || tradeTurn === playerId) {
    items.push({
      kind: "midSeasonTurn",
      text: rep && !rep.isComplete && rep.playerId === playerId ? "It's your turn to replenish" : "It's your turn to swap",
      href: "/mid-season",
    });
  }

  // Active Roster: this episode's lineup has open slots you could fill.
  if (type.hasActiveRoster) {
    const ep = StateLogic.currentEpisode(state);
    if (ep && !ep.lineupsLocked && !StateLogic.episodeHasResults(ep)) {
      const available = state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status !== "eliminated");
      const fielded = StateLogic.activeRosterLineupFor(state, ep.id, playerId).filter((id) => available.some((c) => c.id === id));
      const need = Math.min(StateLogic.ActiveRosterLogic.activeSlots(state), available.length);
      if (fielded.length < need) {
        const open = need - fielded.length;
        items.push({
          kind: "lineup",
          text: `Set your episode ${ep.number} lineup (${open} empty slot${open === 1 ? "" : "s"})`,
          href: "/#lineup",
        });
      }
    }
  }

  // Eliminator Pool: no pick yet for the upcoming episode, and someone left to pick.
  if (type.hasWeeklyPicks) {
    const ep = StateLogic.pickEmUpcomingEpisode(state);
    if (
      ep &&
      ep.events.length === 0 &&
      !StateLogic.pickEmPickFor(state, ep.id, playerId) &&
      StateLogic.pickEmEligibility(state, ep.id, playerId).available.length > 0
    ) {
      items.push({ kind: "pick", text: `Make your episode ${ep.number} pick`, href: "/#pickem-grid" });
    }
  }

  // Predictions: open on an episode that hasn't happened yet, and you haven't guessed.
  if (state.settings.bonusEnabled) {
    const pending = state.episodes
      .filter((ep) => !StateLogic.episodeHasResults(ep))
      .flatMap((ep) => ep.bets || [])
      .filter((bet) => !isBetSettled(bet) && !(bet.predictions || []).some((p) => p.playerId === playerId));
    if (pending.length === 1) items.push({ kind: "prediction", text: `Guess "${pending[0].label}"`, href: "/#predictions" });
    else if (pending.length > 1) items.push({ kind: "prediction", text: `${pending.length} predictions need your guess`, href: "/#predictions" });
  }

  return items;
}
