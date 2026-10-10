"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PointsPicker } from "@/components/ui/points-picker";
import { PrimaryButton, fieldCls } from "@/components/setup/settings-ui";

// "Propose a prediction" on the upcoming episode's page (docs/PLAN-ux-declutter.md: it left Overview).
// Anyone in the league can add one, any time before the episode airs. "upcoming" rather than an
// episode id, the same call Overview used to make: the server adds it to the episode about to be
// played (StateLogic.currentEpisode), which is the one this page is showing.
export function ProposePrediction({ state }: { state: LeagueState }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState(Math.min(StateLogic.MAX_BET_POINTS, Math.max(1, state.settings.defaultBetPoints || 1)));
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();
  const trimmed = label.trim();

  async function submit() {
    if (!trimmed) return;
    setOpen(false);
    setLabel("");
    await mutate(
      (s) => StateLogic.addBetToUpcoming(s, trimmed, points, myPlayerId),
      () => api.proposeBet(leagueId!, "upcoming", trimmed, points)
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 items-center gap-2.5 self-start text-[15px] font-semibold text-chyron-line hover:underline"
      >
        <Plus className="size-5" strokeWidth={2.4} aria-hidden />
        Propose a prediction
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Propose a prediction" description="Anyone can add one">
        <form
          className="flex flex-col gap-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">The question</span>
            <input
              className={fieldCls}
              value={label}
              placeholder="e.g. Who wins reward?"
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm font-semibold">Points if correct</span>
            <PointsPicker value={points} onChange={setPoints} />
          </div>
          <PrimaryButton type="submit" disabled={!trimmed}>
            Propose
          </PrimaryButton>
        </form>
      </BottomSheet>
    </>
  );
}
