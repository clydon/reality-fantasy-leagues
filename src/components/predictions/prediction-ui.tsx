"use client";

import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { Bet, BetPrediction, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PointsPicker } from "@/components/ui/points-picker";
import { PrimaryButton, fieldCls } from "@/components/setup/settings-ui";
import { cn } from "cn";

// The pieces a prediction is drawn with (DESIGN.md, Predictions), shared by Overview's open ones
// (overview/bet-card.tsx) and an episode's own (episodes/episode-bet-row.tsx): the question's line,
// one line per guess with how it went, the commissioner's ✓ / ✕ grading, and the edit sheet.

/** The question, who asked it and which episode, and what it's worth. `action` is the ⋯ at the end. */
export function QuestionLine({ bet, ep, state, showEpisode, action }: { bet: Bet; ep: Episode; state: LeagueState; showEpisode?: boolean; action?: ReactNode }) {
  const creator = bet.createdByPlayerId ? StateLogic.getPlayer(state, bet.createdByPlayerId) : null;
  const detail = [showEpisode && `Episode ${ep.number}`, creator && `Asked by ${creator.name}`].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <p className="text-base font-semibold leading-snug">{bet.label}</p>
        {detail && <p className="text-[13px] text-muted-foreground">{detail}</p>}
      </div>
      <span className="flex shrink-0 flex-col items-end pt-0.5" title="Points if right">
        <span className="type-num text-[22px] leading-none">+{bet.points}</span>
        <span className="text-[11px] text-muted-foreground">if right</span>
      </span>
      {action}
    </div>
  );
}

/** One guess: the guesser's dot and name, their answer, then how it went (or grading controls). */
export function GuessLine({
  state,
  pred,
  bet,
  grading,
  onGrade,
  onRemove,
  suggested,
  showPending = true,
}: {
  state: LeagueState;
  pred: BetPrediction;
  bet: Bet;
  /** Commissioner grading: ✓ / ✕ (and remove) in place of the result. */
  grading?: boolean;
  onGrade?: (correct: boolean) => void;
  onRemove?: () => void;
  /** What research suggests for this guess, while grading. */
  suggested?: boolean | null;
  /** "Not graded" for a guess with no grade yet; off where nothing could be graded yet (Overview). */
  showPending?: boolean;
}) {
  const p = StateLogic.getPlayer(state, pred.playerId);
  // A prediction pays only when at least two people guessed.
  const paysOut = (bet.predictions || []).length >= 2;
  return (
    <li className="flex min-h-11 items-center gap-2.5">
      <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" style={p?.color ? { background: p.color } : undefined} aria-hidden />
      <span className="min-w-0 flex-1 text-[15px] leading-snug">
        <span className="font-semibold">{p?.name || "?"}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="break-words">{pred.guess}</span>
        {grading && suggested != null && (
          <span className={cn("ml-1.5 text-[13px]", suggested ? "font-semibold text-good" : "text-muted-foreground")} title="What the episode's research suggests: check it before grading">
            {suggested ? "Research: right" : "Research: wrong"}
          </span>
        )}
      </span>
      {grading && onGrade ? (
        <span className="flex shrink-0 items-center gap-1">
          <GradeButton kind="right" on={pred.correct === true} onClick={() => onGrade(true)} who={p?.name} />
          <GradeButton kind="wrong" on={pred.correct === false} onClick={() => onGrade(false)} who={p?.name} />
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${p?.name ?? "this"}'s guess`}
              onClick={onRemove}
              className="flex h-11 shrink-0 items-center px-2 text-[13px] font-semibold text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </span>
      ) : (
        (showPending || pred.correct != null) && <Result correct={pred.correct} points={paysOut ? bet.points : null} />
      )}
    </li>
  );
}

function Result({ correct, points }: { correct: boolean | null | undefined; points: number | null }) {
  if (correct === true)
    return (
      <span className="shrink-0 rounded-[2px] bg-good px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-good-foreground">
        Right{points != null && ` +${points}`}
      </span>
    );
  if (correct === false)
    return <span className="shrink-0 rounded-[2px] bg-muted px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Wrong</span>;
  return <span className="shrink-0 text-[13px] text-muted-foreground">Not graded</span>;
}

/** 44px ✓ or ✕. Right fills teal when chosen; wrong fills with the "You" ink, never red (nobody left). */
function GradeButton({ kind, on, onClick, who }: { kind: "right" | "wrong"; on: boolean; onClick: () => void; who?: string }) {
  const Icon = kind === "right" ? Check : X;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${who ?? "This guess"}: ${kind}`}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-[3px] border focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
        on
          ? kind === "right"
            ? "border-good bg-good text-good-foreground"
            : "border-foreground bg-foreground text-background"
          : "border-input bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="size-5" strokeWidth={2.6} aria-hidden />
    </button>
  );
}

/** The commissioner's sheet for a prediction's question and points. */
export function EditPredictionSheet({ ep, bet, onClose }: { ep: Episode; bet: Bet; onClose: () => void }) {
  const [label, setLabel] = useState(bet.label);
  const [points, setPoints] = useState(bet.points);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const trimmed = label.trim();

  async function save() {
    onClose();
    if (trimmed && trimmed !== bet.label)
      await mutate(
        (s) => StateLogic.updateBet(s, ep.id, bet.id, "label", trimmed),
        () => api.updateBet(leagueId!, ep.id, bet.id, "label", trimmed)
      );
    if (points !== bet.points)
      await mutate(
        (s) => StateLogic.updateBet(s, ep.id, bet.id, "points", points),
        () => api.updateBet(leagueId!, ep.id, bet.id, "points", points)
      );
  }

  return (
    <BottomSheet open onOpenChange={(o) => !o && onClose()} title="Edit prediction">
      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) save();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">The question</span>
          <input className={fieldCls} value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-semibold">Points if right</span>
          <PointsPicker value={points} onChange={setPoints} />
        </div>
        <PrimaryButton type="submit" disabled={!trimmed}>
          Save
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
