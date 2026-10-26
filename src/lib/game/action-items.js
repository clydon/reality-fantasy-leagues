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
// draft-board/blind-draft-panel, mid-season, lineup/lineup-page, pick/pick-page,
// side-bets-section. `episode` is the episode number a weekly item is for (reminders key on it).
//
// `opts.commissioner`: this player runs the league, so an aired episode with no results is theirs to
// fill in -- listed first, since everyone's week waits on it.
//
// Each item says whose job it is (`who`: "you" for your own moves, "commish" for the commissioner's,
// which Overview's control room shows apart from Up next) and when it's due (`deadline`, for byDue).
function actionItems(state, playerId, seenThrough, opts = {}) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.disabled || me.active === false) return [];
  // An archived game (docs/PLAN-new-design.md step 10 part 2b) stands still: nothing's due in it.
  if (state.settings && state.settings.archivedAt) return [];
  const due = opts.commissioner ? resultsDueEpisode(state, opts.now) : null;
  return [...(due ? [resultsItem(state, due)] : []), ...playerItems(state, playerId, seenThrough)].map((it) => ({
    ...it,
    who: it.kind === "results" ? "commish" : "you",
    deadline: it.deadline ?? null,
  }));
}

// Someone is waiting on these right now (the draft, the league's results, your own start), so they
// come before any deadline.
const NOW_KINDS = new Set(["draftTurn", "blindDraft", "lateJoin", "results"]);

/** When an item is due, for sorting: -Infinity for "now", Infinity for no deadline. */
function dueAt(item) {
  if (NOW_KINDS.has(item.kind)) return -Infinity;
  const t = item.deadline ? Date.parse(item.deadline) : NaN;
  return Number.isFinite(t) ? t : Infinity;
}

/** Soonest first (Up next's order); ties keep their order, which within a league is actionItems'. */
function byDue(a, b) {
  const x = dueAt(a);
  const y = dueAt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// The episode a commissioner should fill in now: the earliest one in play that has aired and has
// nothing recorded. Results come from the commissioner by default; when someone gets there first (an
// admin on an admin-run season, one day paid automation) there's simply nothing due. Never in a
// catching-up league, whose results come with each reveal, and never an episode with no air time,
// since nothing says it has aired. Read from the full state: due is due whether or not the
// commissioner has revealed what's in.
function resultsDueEpisode(state, now) {
  // Weekly Calls (step 12 part 2) has no results of its own: the couch's calls and what it says happened score it.
  if (StateLogic.RevealLogic.isCatchingUp(state) || StateLogic.getLeagueType(state).hasCalls) return null;
  const t = now || Date.now();
  return (
    [...state.episodes]
      .sort((a, b) => a.number - b.number)
      .find((ep) => StateLogic.inPlay(state, ep.number) && !StateLogic.episodeHasResults(ep) && StateLogic.hasAired(ep, t)) || null
  );
}

// Where a commissioner fills in an episode's results. Research asks about the league's season, so it
// needs one; without a show and season the episode's own page is where they're entered by hand.
function resultsHref(state, ep) {
  const { showId, wikiSeason } = state.settings || {};
  return showId && wikiSeason != null ? `/episodes/${ep.number}/research` : `/episodes/${ep.number}`;
}

// Where Waivers live, for every league type (Active Roster once kept them under Research).
function waiversHref() {
  return "/waivers";
}

function resultsItem(state, ep) {
  return { kind: "results", text: `Fill in episode ${ep.number}'s results`, href: resultsHref(state, ep), episode: ep.number };
}

// A player's own to-dos.
function playerItems(state, playerId, seenThrough) {
  // A late joiner (StateLogic.GhostLogic): first, choose where to start. While catching up, these
  // checks would read the league's real latest episode, which is ahead of them (an alert about it
  // would be a spoiler) -- so they're run on the league as THEY see it, ending at their own week
  // (viewFor), and only for the choices that week has: a lineup and a pick. Without their mark
  // (`seenThrough`, from the membership -- the reminder job has none) there's nothing to say.
  const G = StateLogic.GhostLogic;
  if (G.needsStart(state, playerId)) return [{ kind: "lateJoin", text: "Choose where to start", href: "/late-join" }];
  if (G.isCatchingUp(state, playerId)) {
    if (!Number.isInteger(seenThrough)) return [];
    const view = G.viewFor(state, playerId, seenThrough);
    return liveItems(view, playerId).filter((it) => it.kind === "lineup" || it.kind === "pick");
  }
  return [...liveItems(state, playerId), ...waiverItems(state, playerId, seenThrough)];
}

// Waivers (docs/PLAN-midseason-waivers.md, PLAN-waivers-v2.md): only someone you can replace, the one
// claim that isn't optional -- while claims are open and you've no claim in, then in free agency while
// it's still unfilled. Swaps never make an item. It says one of yours left, so nothing until you've revealed the week's
// episode (`seenThrough` null: you see results as they come). `by` is the deadline, for the strip to
// put in the viewer's own time ("Replace Jelly by Tue 8 PM"); `detail` follows the league's name.
function waiverItems(state, playerId, seenThrough) {
  const W = StateLogic.WaiverLogic;
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || (Number.isInteger(seenThrough) && seenThrough < p.episode)) return [];
  const owed = W.replacementsOwed(state, playerId, p);
  if (!owed.count) return [];
  const names = owed.lossIds.map((id) => (StateLogic.getCastaway(state, id)?.name ?? "").split(" ")[0]).filter(Boolean);
  const text = names.length > 1 ? `Replace ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : `Replace ${names[0] ?? "your castaway"}`;
  const base = waiversHref(state);
  if (p.phase === "open") {
    if (p.claimsIn.includes(playerId)) return [];
    const shared = state.settings.ownershipMode === "shared";
    return [
      {
        kind: "pickup",
        text,
        href: `${base}/claim?drop=${encodeURIComponent(owed.lossIds[0])}`,
        by: p.hold ? p.closesAt : p.processAt,
        deadline: p.hold ? p.closesAt : p.processAt,
        detail: shared ? "pick who you want" : "first choice, then backups",
        episode: p.episode,
      },
    ];
  }
  if (!W.freeAgencyOn(state)) return [];
  return [{ kind: "pickup", text, href: `${base}/free-agency?drop=${encodeURIComponent(owed.lossIds[0])}`, by: p.closesAt, deadline: p.closesAt, detail: "free agency · first come", episode: p.episode }];
}

// The checks themselves, on whichever copy of the league the player is playing in.
function liveItems(state, playerId) {
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
          href: "/lineup",
          episode: ep.number,
          // Lineups lock when the episode starts airing.
          deadline: ep.airsAt || null,
        });
      }
    }
  }

  // Eliminator Pool: no pick yet for the upcoming episode, and someone left to pick.
  if (type.hasWeeklyPicks) {
    const ep = StateLogic.pickEmUpcomingEpisode(state);
    if (
      ep &&
      !StateLogic.pickEmDecided(ep, state) &&
      !StateLogic.hasAired(ep) &&
      !StateLogic.pickEmPickFor(state, ep.id, playerId) &&
      StateLogic.pickEmEligibility(state, ep.id, playerId).available.length > 0
    ) {
      items.push({ kind: "pick", text: `Make your episode ${ep.number} pick`, href: "/pick", episode: ep.number, deadline: ep.airsAt || null });
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
        // Nothing locks a guess, but it's about the episode: before it airs.
        deadline: pending.find(({ ep }) => ep.number === episode).ep.airsAt || null,
      });
    }
  }

  return items;
}

module.exports = { actionItems, resultsDueEpisode, resultsHref, waiversHref, dueAt, byDue };
