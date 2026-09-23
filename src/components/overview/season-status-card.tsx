import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { DashCard, DashBig, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Season Status" card, including its status-body branching
// (not-started / drafting / replenish / trade / complete). formatScheduledTime and the
// draft-scheduling flow aren't wired up yet in this POC -- see the "not started" branch's TODO.
export function SeasonStatusCard({ state }: { state: LeagueState }) {
  const activeCount = state.castaways.filter((c) => c.status === "active").length;
  const eliminatedCount = state.castaways.length - activeCount;
  const draftStarted = StateLogic.isDraftStarted(state);
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);
  const replenishActive = !!state.midSeason.replenish;
  const tradeActive = !!state.midSeason.trade;

  let statusBody: React.ReactNode;
  if (!draftStarted) {
    // TODO(post-POC): port formatScheduledTime + draftScheduledAt display once Draft is ported.
    statusBody = <DashLink>Go to draft →</DashLink>;
  } else if (!draftComplete) {
    const player = turn ? StateLogic.getPlayer(state, turn.playerId ?? "") : undefined;
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">
          <b>{player?.name || "?"}&rsquo;s</b> turn to draft (pick {turn?.personalPickNumber}).
        </p>
        <DashLink>Go to draft →</DashLink>
      </>
    );
  } else if (replenishActive) {
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">Replenish round in progress.</p>
        <DashLink>Resume replenish →</DashLink>
      </>
    );
  } else if (tradeActive) {
    statusBody = (
      <>
        <p className="mt-1.5 text-sm">Swap round in progress.</p>
        <DashLink>Resume swap →</DashLink>
      </>
    );
  } else {
    statusBody = <DashLink>View board ↓</DashLink>;
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
