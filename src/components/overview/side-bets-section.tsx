"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { getActiveBets } from "@/lib/game/selectors";
import { useLeagueStore, useCanGuess, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { BetCard } from "./bet-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Direct port of renderBonusBetsSection() (public/app.js). overviewNewBetOpen was a single
// global flag there; here it's this component's own state, same as BetCard's revealedBetCardId.
export function SideBetsSection({ state }: { state: LeagueState }) {
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState(state.settings.defaultBetPoints);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useMyPlayerId();
  const canGuessBets = useCanGuess();
  const mutate = useMutate();

  if (!state.settings.bonusEnabled) return null;
  const rows = getActiveBets(state);
  const needsCount =
    canGuessBets && myPlayerId
      ? rows.filter(({ bet }) => !(bet.predictions || []).some((p) => p.playerId === myPlayerId)).length
      : 0;

  async function submit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    setFormOpen(false);
    setLabel("");
    // "upcoming" rather than an episode id: a brand-new league may have no episodes yet, so the
    // server works out the episode about to be played and creates it if needed.
    await mutate(
      (s) => StateLogic.addBetToUpcoming(s, trimmed, points, myPlayerId),
      () => api.proposeBet(leagueId!, "upcoming", trimmed, points)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          Predictions{" "}
          {needsCount > 0 && (
            <Badge className="ml-1 normal-case">
              {needsCount} need{needsCount === 1 ? "s" : ""} you
            </Badge>
          )}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ ep, bet }) => (
          <BetCard key={bet.id} ep={ep} bet={bet} state={state} />
        ))}
        {formOpen ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-3">
            <Input
              size="sm"
              className="mb-2 w-full"
              placeholder='e.g. "Who wins reward?"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <label className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              Points if correct:
              <Input
                type="number"
                size="sm"
                className="w-16"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="xs" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" onClick={submit}>
                Propose
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-4 text-center text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => setFormOpen(true)}
          >
            <div className="text-xl">+</div>
            <div className="text-sm font-semibold">Propose a Prediction</div>
            <div className="text-xs">Anyone can add one, any time</div>
          </button>
        )}
      </div>
    </div>
  );
}
