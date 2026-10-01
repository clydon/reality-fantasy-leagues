// What's waiting on a player in one league -- the app-wide action bar (action-bar.tsx, via
// /api/me/actions) and the hourly reminder job (db/reminders.js) both read this, so it's plain
// CommonJS for the same reason state-logic.js and air-schedule.js are: the job requires it under bare
// node. Types in action-items.d.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const StateLogic = require("./state-logic.js");

// Settled once every guess on it has been graded (selectors.ts's isBetSettled, repeated here so this
// file needs nothing that isn't plain JS).
function isBetSettled(bet) {
  const preds = bet.predictions || [];
  return preds.length > 0 && preds.every((p) => p.correct !== null);
}

// Everything in one league that's waiting on this player right now, as a pure function of league
// state. Most urgent first: turns (others are waiting on you) before weekly choices (a deadline, but
// nobody's blocked).
//
// Each check mirrors the UI that resolves it, so an item disappears as soon as the thing is done:
// draft-board/blind-draft-panel, mid-season, active-roster-lineup-grid, pickem-pick-grid,
// side-bets-section. `episode` is the episode number a weekly item is for (reminders key on it).
function actionItems(state, playerId) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.disabled || me.active === false) return [];
  const type = StateLogic.getLeagueType(state);
  const items = [];

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
  const repMine = !!(rep && !rep.isComplete && rep.playerId === playerId);
  const trade = state.midSeason && state.midSeason.trade;
  const tradeTurn = trade && trade.index < trade.queue.length ? trade.queue[trade.index].playerId : null;
  if (repMine || tradeTurn === playerId) {
    items.push({ kind: "midSeasonTurn", text: repMine ? "It's your turn to replenish" : "It's your turn to swap", href: "/mid-season" });
  }

  // Active Roster: this episode's lineup has open slots you could fill.
  if (type.hasActiveRoster) {
    const ep = StateLogic.currentEpisode(state);
    if (ep && !StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id)) {
      const available = state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status !== "eliminated");
      const fielded = StateLogic.activeRosterLineupFor(state, ep.id, playerId).filter((id) => available.some((c) => c.id === id));
      const need = Math.min(StateLogic.ActiveRosterLogic.activeSlots(state), available.length);
      if (fielded.length < need) {
        const open = need - fielded.length;
        items.push({
          kind: "lineup",
          text: `Set your episode ${ep.number} lineup (${open} empty slot${open === 1 ? "" : "s"})`,
          href: "/#lineup",
          episode: ep.number,
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
      !StateLogic.hasAired(ep) &&
      !StateLogic.pickEmPickFor(state, ep.id, playerId) &&
      StateLogic.pickEmEligibility(state, ep.id, playerId).available.length > 0
    ) {
      items.push({ kind: "pick", text: `Make your episode ${ep.number} pick`, href: "/#pickem-grid", episode: ep.number });
    }
  }

  // Predictions: open on an episode that hasn't happened yet, and you haven't guessed.
  if (state.settings.bonusEnabled) {
    const open = state.episodes.filter((ep) => !StateLogic.episodeHasResults(ep));
    const pending = open
      .flatMap((ep) => (ep.bets || []).map((bet) => ({ ep, bet })))
      .filter(({ bet }) => !isBetSettled(bet) && !(bet.predictions || []).some((p) => p.playerId === playerId));
    if (pending.length) {
      const episode = Math.min(...pending.map(({ ep }) => ep.number));
      items.push({
        kind: "prediction",
        text: pending.length === 1 ? `Guess "${pending[0].bet.label}"` : `${pending.length} predictions need your guess`,
        href: "/#predictions",
        episode,
      });
    }
  }

  return items;
}

module.exports = { actionItems };
