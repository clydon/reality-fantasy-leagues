"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { ordinal } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm-store";

// Port of renderDraft()'s three-way status banner (not started / in progress / complete).
// formatScheduledTime()/draftScheduledAt display isn't wired up (no scheduling UI exists in this
// POC yet), same TODO as SeasonStatusCard's.
export function DraftStatusPanel({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const draftStarted = StateLogic.isDraftStarted(state);
  const turn = StateLogic.currentDraftTurn(state);

  async function handleForceStart() {
    if (!(await confirm("Start the draft now, ignoring any scheduled time?"))) return;
    await mutate(
      (s) => StateLogic.forceStartDraft(s),
      () => api.forceStartDraft(leagueId!)
    );
  }

  if (!draftStarted) {
    return (
      <div className="mb-4 rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-base font-bold">Draft hasn&rsquo;t started yet</h3>
        <p className="mb-3 text-sm text-muted-foreground">No start time has been scheduled yet.</p>
        {canManage && (
          <Button onClick={handleForceStart}>Start Draft Now</Button>
        )}
      </div>
    );
  }

  if (turn && turn.isComplete) {
    return (
      <div className="mb-4 rounded-lg border border-good/40 bg-card p-4 shadow-sm">
        <h3 className="mb-1 text-base font-bold text-good">Draft complete!</h3>
        <p className="text-sm text-muted-foreground">
          Every player has a full roster. Head to Overview or Episodes to start tracking the season.
        </p>
      </div>
    );
  }

  if (turn) {
    const player = StateLogic.getPlayer(state, turn.playerId ?? "");
    return (
      <div className="mb-4 rounded-lg border-2 bg-card p-4 shadow-sm" style={{ borderColor: player?.color || "var(--primary)" }}>
        <h3 className="text-base font-bold" style={{ color: player?.color }}>
          {player?.name || "?"}&rsquo;s turn, {ordinal(turn.personalPickNumber)} pick
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Overall pick #{turn.overallPickNumber}</p>
      </div>
    );
  }

  return null;
}
