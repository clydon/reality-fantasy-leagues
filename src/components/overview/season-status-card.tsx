import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { DashCard, DashBig, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Season Status" card, including its status-body branching
// (not-started / drafting / replenish / trade / complete). formatScheduledTime and the
// draft-scheduling flow aren't wired up yet in this POC -- see the "not started" branch's TODO.
export function SeasonStatusCard({ state }: { state: LeagueState }) {
  const activeCount = state.castaways.filter((c) => c.status === "active").length;
  const eliminatedCount = state.castaways.length - activeCount;
  const hasRoster = StateLogic.getLeagueType(state).hasRoster;
  const draftStarted = StateLogic.isDraftStarted(state);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);
  const replenishActive = !!state.midSeason.replenish;
  const tradeActive = !!state.midSeason.trade;

  let statusBody: React.ReactNode;
  if (!hasRoster) {
    // No draft/roster concept at all (pickem) -- the "not started / drafting / replenish / trade
    // / complete" branches below all describe classic-draft's own season lifecycle, none of which
    // apply. Show the one thing that IS this league type's season lifecycle instead: how many
    // players have made a pick for the latest episode.
    const latestEp = [...state.episodes].sort((a, b) => b.number - a.number)[0];
    statusBody = latestEp ? (
      <>
        <p className="mt-1.5 text-sm">
          Episode {latestEp.number}: {(latestEp.picks || []).length}/{state.players.length} players have picked.
        </p>
        <DashLink href="/episodes">Go to Episodes →</DashLink>
      </>
    ) : (
      <DashLink href="/episodes">Add an episode to start picking →</DashLink>
    );
  } else if (!draftStarted) {
    // TODO(post-POC): port formatScheduledTime + draftScheduledAt display once Draft is ported.
    statusBody = <DashLink href="/draft">Go to draft →</DashLink>;
  } else if (!draftComplete && state.settings.ownershipMode === "shared") {
    // A blind draft in progress has no turn to report -- everyone submits simultaneously, so
    // currentTurn is null until the reveal. Without this branch the turn-based case below would
    // render "?'s turn to draft (pick undefined)".
    const waiting = StateLogic.BlindDraftLogic.waitingOn(state).length;
    const locked = StateLogic.BlindDraftLogic.lockedPlayerIds(state).length;
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">
          Blind draft: <b>{locked}</b> of <b>{locked + waiting}</b> locked in.
        </p>
        <DashLink href="/draft">{waiting === 0 ? "Revealing →" : "Go to draft →"}</DashLink>
      </>
    );
  } else if (!draftComplete) {
    const player = turn ? StateLogic.getPlayer(state, turn.playerId ?? "") : undefined;
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">
          <b>{player?.name || "?"}&rsquo;s</b> turn to draft (pick {turn?.personalPickNumber}).
        </p>
        <DashLink href="/draft">Go to draft →</DashLink>
      </>
    );
  } else if (replenishActive) {
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">Pickup round in progress.</p>
        <DashLink href="/mid-season">Go to pickups →</DashLink>
      </>
    );
  } else if (tradeActive) {
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">Swap round in progress.</p>
        <DashLink href="/mid-season">Resume swap →</DashLink>
      </>
    );
  } else {
    statusBody = <DashLink href="#board">View board ↓</DashLink>;
  }

  return (
    <DashCard title="Season Status">
      <DashBig>
        {activeCount}
        <span className="ml-1 text-base text-muted-foreground"> / {state.castaways.length} left</span>
      </DashBig>
      <p className="mt-1.5 text-sm text-muted-foreground">{eliminatedCount} eliminated so far.</p>
      {statusBody}
    </DashCard>
  );
}
