"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { getActiveBets, getUpcomingEpisode } from "@/lib/game/selectors";
import { useLeagueStore, useCanGuess, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { BetCard } from "./bet-card";

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
    const ep = getUpcomingEpisode(state);
    setFormOpen(false);
    setLabel("");
    await mutate(
      (s) => StateLogic.addBet(s, ep.id, trimmed, points, myPlayerId),
      () => api.proposeBet(leagueId!, ep.id, trimmed, points)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          Side Bets{" "}
          {needsCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-bold normal-case text-primary-foreground">
              {needsCount} need{needsCount === 1 ? "s" : ""} you
            </span>
          )}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ ep, bet }) => (
          <BetCard key={bet.id} ep={ep} bet={bet} state={state} />
        ))}
        {formOpen ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-3">
            <input
              className="mb-2 w-full rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder='e.g. "Who wins reward?"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <label className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              Points if correct:
              <input
                type="number"
                className="w-16 rounded border border-border bg-card px-1.5 py-0.5 text-xs"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button className="text-xs text-muted-foreground" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground" onClick={submit}>
                Propose
              </button>
            </div>
          </div>
        ) : (
          <button
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-4 text-center text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => setFormOpen(true)}
          >
            <div className="text-xl">+</div>
            <div className="text-sm font-semibold">Propose a Bet</div>
            <div className="text-xs">Anyone can add one, any time</div>
          </button>
        )}
      </div>
    </div>
  );
}
