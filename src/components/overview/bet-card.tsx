"use client";

import { useState } from "react";
import type { Bet, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { isBetSettled } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage, useCanGuess, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { confirm } from "@/lib/confirm-store";
import { cn } from "cn";

// Direct port of renderBetCard() (public/app.js), converted from global toggle-state
// (revealedBetCardId, one flag shared across every card) to local component state -- each card
// owns whether its own delete button is revealed, which is what that global was really modeling.
export function BetCard({ ep, bet, state }: { ep: Episode; bet: Bet; state: LeagueState }) {
  const [revealed, setRevealed] = useState(false);
  const [guess, setGuess] = useState("");
  const canManage = useCanManage();
  const canGuessBets = useCanGuess();
  const myPlayerId = useMyPlayerId();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();

  const mine = myPlayerId ? (bet.predictions || []).find((p) => p.playerId === myPlayerId) : null;
  const canGuessThis = canGuessBets && !mine;
  const creator = bet.createdByPlayerId ? StateLogic.getPlayer(state, bet.createdByPlayerId) : null;
  const isCreator = !!myPlayerId && bet.createdByPlayerId === myPlayerId;
  const canDelete = canManage || (isCreator && (bet.predictions || []).length < 2);
  const needsOneMore = (bet.predictions || []).length === 1 && !isBetSettled(bet);

  async function submitGuess() {
    const g = guess.trim();
    if (!g || !myPlayerId) return;
    const playerId = myPlayerId;
    await mutate(
      (s) => StateLogic.addBetPrediction(s, ep.id, bet.id, playerId, g),
      () => api.addBetPrediction(leagueId!, ep.id, bet.id, playerId, g)
    );
    setGuess("");
  }

  async function grade(predId: string, value: boolean) {
    await mutate(
      (s) => StateLogic.setBetPredictionCorrect(s, ep.id, bet.id, predId, value),
      () => api.setBetPredictionCorrect(leagueId!, ep.id, bet.id, predId, value)
    );
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!(await confirm("Remove this bet? This cannot be undone.", { danger: true, confirmLabel: "Remove" }))) return;
    setRevealed(false);
    mutate(
      (s) => StateLogic.removeBet(s, ep.id, bet.id),
      () => api.removeBet(leagueId!, ep.id, bet.id)
    );
  }

  const borderCls = canGuessThis
    ? "border-primary/50"
    : mine?.correct === true
    ? "border-good/60"
    : mine?.correct === false
    ? "border-destructive/50"
    : "border-border";

  return (
    <div
      className={cn("relative flex flex-col gap-2 rounded-lg border-2 bg-card p-3 shadow-sm", borderCls)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("input,button,select")) return;
        setRevealed((r) => !r);
      }}
    >
      {canDelete && (
        <button
          className={cn("absolute right-1.5 top-1.5 text-xs opacity-0 transition-opacity", revealed && "opacity-100")}
          title="Delete bet"
          onClick={handleDelete}
        >
          🗑
        </button>
      )}
      {canGuessThis && !revealed && (
        <Badge className="absolute -right-1 -top-1 text-[0.6rem]">NEEDS YOUR GUESS</Badge>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold">
          {bet.label}
          {ep.postMerge ? " 🔀" : ""}
        </div>
        <div className="shrink-0 font-mono text-sm font-bold">
          {bet.points}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">pts</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {creator ? (
          <>
            <span
              className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
              style={{ background: creator.color }}
            >
              {creator.name[0]}
            </span>
            proposed by {creator.name}
          </>
        ) : (
          `Episode ${ep.number}`
        )}
      </div>
      {(bet.predictions || []).length > 0 && (
        <div className="flex flex-col gap-1">
          {(bet.predictions || []).map((p) => {
            const pp = StateLogic.getPlayer(state, p.playerId);
            return (
              <div key={p.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                  style={{ background: pp?.color || "#4a5245" }}
                >
                  {(pp?.name || "?")[0]}
                </span>
                <span>
                  {pp?.name || "?"}: &ldquo;{p.guess}&rdquo;
                </span>
                {p.correct === true && (
                  <Badge variant="secondary" className="ml-auto bg-good/15 text-good">
                    +{bet.points} ✓
                  </Badge>
                )}
                {p.correct === false && (
                  <Badge variant="destructive" className="ml-auto">
                    ✗
                  </Badge>
                )}
                {canManage && p.correct === null && (
                  <Select
                    size="sm"
                    className="ml-auto"
                    onChange={(e) => e.target.value && grade(p.id, e.target.value === "true")}
                    defaultValue=""
                  >
                    <option value="">—</option>
                    <option value="true">Correct</option>
                    <option value="false">Incorrect</option>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      )}
      {needsOneMore && <div className="text-[0.7rem] italic text-muted-foreground">Needs 1 more guess to pay out</div>}
      {canGuessThis && (
        <div className="flex gap-1.5">
          <Input
            size="sm"
            className="min-w-0 flex-1"
            placeholder="Your guess..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitGuess()}
          />
          <Button size="xs" onClick={submitGuess}>
            Guess
          </Button>
        </div>
      )}
    </div>
  );
}
