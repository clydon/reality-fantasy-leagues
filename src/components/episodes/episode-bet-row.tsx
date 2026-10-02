"use client";

import { useState } from "react";
import type { Bet, Episode, LeagueState, SuggestedBetAnswer } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PointsPicker } from "@/components/ui/points-picker";
import { cn } from "cn";

// One bet inside EpisodeCard: everyone's guess on a line each, with how it went. Behind ✏️, the
// commissioner-editing half -- grade guesses, correct the label or points, remove a guess or the
// whole bet. PROPOSING a bet and GUESSING on it happen on Overview only
// (bet-card.tsx): this component never creates a bet or a guess, only edits what's already there.
export function EpisodeBetRow({ ep, bet, state }: { ep: Episode; bet: Bet; state: LeagueState }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bet.label);
  const [points, setPoints] = useState(bet.points);

  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const isCreator = !!myPlayerId && bet.createdByPlayerId === myPlayerId;
  const creatorCanDelete = isCreator && (bet.predictions || []).length < 2;
  const canToggleEdit = canManage || creatorCanDelete;

  // Semantic-search grading aid (db/embeddings.js), fetched on demand rather than on every render --
  // it costs a real embedding call, and most bets on an episode card are never opened to grade in a
  // given visit. See the suggested-answer route's own comment for the same reasoning.
  const [suggestion, setSuggestion] = useState<SuggestedBetAnswer | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  async function fetchSuggestion() {
    setSuggestionLoading(true);
    setSuggestionError(null);
    try {
      setSuggestion(await api.suggestBetAnswer(leagueId!, ep.id, bet.id));
    } catch (e) {
      setSuggestionError(e instanceof ApiError ? e.message : "Could not check for a suggested answer.");
    } finally {
      setSuggestionLoading(false);
    }
  }
  const creator = bet.createdByPlayerId ? StateLogic.getPlayer(state, bet.createdByPlayerId) : null;

  async function saveField(field: "label" | "points", value: string | number) {
    await mutate(
      (s) => StateLogic.updateBet(s, ep.id, bet.id, field, value),
      () => api.updateBet(leagueId!, ep.id, bet.id, field, value)
    );
  }

  async function remove() {
    await mutate(
      (s) => StateLogic.removeBet(s, ep.id, bet.id),
      () => api.removeBet(leagueId!, ep.id, bet.id)
    );
  }

  async function grade(predId: string, value: string) {
    if (!value) return;
    await mutate(
      (s) => StateLogic.setBetPredictionCorrect(s, ep.id, bet.id, predId, value === "true"),
      () => api.setBetPredictionCorrect(leagueId!, ep.id, bet.id, predId, value === "true")
    );
  }

  // A research-settled suggestion's verdict on one guess: right, wrong, or null when there's no
  // research answer to judge it by (no suggestion yet, or only a search result).
  function suggestedVerdict(guess: string): boolean | null {
    if (!suggestion || suggestion.source !== "research" || suggestion.status !== "ok") return null;
    const wanted = guess.trim().toLowerCase();
    return (suggestion.correctGuesses || []).some((g) => g.trim().toLowerCase() === wanted);
  }
  const ungraded = (bet.predictions || []).filter((p) => p.correct === null || p.correct === undefined);

  // Grades every still-ungraded guess the way the research suggests. Guesses already graded by hand
  // are left alone -- the commissioner's call wins.
  async function applySuggestion() {
    for (const pred of ungraded) {
      const verdict = suggestedVerdict(pred.guess);
      if (verdict === null) continue;
      await mutate(
        (s) => StateLogic.setBetPredictionCorrect(s, ep.id, bet.id, pred.id, verdict),
        () => api.setBetPredictionCorrect(leagueId!, ep.id, bet.id, pred.id, verdict)
      );
    }
  }

  async function removeGuess(predId: string) {
    await mutate(
      (s) => StateLogic.removeBetPrediction(s, ep.id, bet.id, predId),
      () => api.removeBetPrediction(leagueId!, ep.id, bet.id, predId)
    );
  }

  const guesses = bet.predictions || [];
  // Pays out only once at least two people have guessed.
  const paysOut = guesses.length >= 2;

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        {editing && canManage ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              className="min-w-[140px] flex-1 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label !== bet.label && saveField("label", label)}
            />
            <PointsPicker
              value={points}
              onChange={(n) => {
                setPoints(n);
                saveField("points", n);
              }}
            />
          </div>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-semibold" title={creator ? `Proposed by ${creator.name}` : undefined}>
            {bet.label}
          </span>
        )}
        <span className="shrink-0 font-mono text-xs text-muted-foreground" title="points if correct">
          +{bet.points}
        </span>
        {/* The commissioner's nudge that guesses are waiting to be graded -- opens the grading tools. */}
        {canManage && !editing && ungraded.length > 0 && (
          <button className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold" onClick={() => setEditing(true)}>
            Grade {ungraded.length}
          </button>
        )}
        {canToggleEdit && (
          <button
            className="shrink-0 text-xs"
            title={canManage ? "Grade / edit" : "Remove your prediction"}
            onClick={() => setEditing((e) => !e)}
          >
            ✏️
          </button>
        )}
      </div>

      {/* Everyone's guess on one line each: who, what, and how it went. */}
      <div className="mt-1 flex flex-col gap-0.5">
        {guesses.map((pred) => {
          const pp = StateLogic.getPlayer(state, pred.playerId);
          const verdict = suggestedVerdict(pred.guess);
          return (
            <div key={pred.id} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pp?.color || "#4a5245" }} />
              <span className="shrink-0 font-semibold">{pp?.name || "?"}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground" title={pred.guess}>
                {pred.guess}
                {editing && verdict !== null && (
                  <span
                    className={verdict ? "ml-1.5 font-semibold text-good" : "ml-1.5"}
                    title="What the episode's research suggests -- check it before grading"
                  >
                    {verdict ? "✓ suggested" : "✗ suggested"}
                  </span>
                )}
              </span>
              {editing && canManage ? (
                <>
                  <Select
                    // Keyed on the grade so it redraws when a grade changes from elsewhere (Apply), since
                    // it's an uncontrolled select.
                    key={`${pred.id}-${pred.correct}`}
                    size="sm"
                    defaultValue={pred.correct === true ? "true" : pred.correct === false ? "false" : ""}
                    onChange={(e) => grade(pred.id, e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="true">Correct</option>
                    <option value="false">Incorrect</option>
                  </Select>
                  <button title="Remove guess" onClick={() => removeGuess(pred.id)}>
                    ✕
                  </button>
                </>
              ) : (
                <span
                  className={cn(
                    "shrink-0 font-mono font-bold",
                    pred.correct === true ? "text-good" : pred.correct === false ? "text-destructive" : "text-muted-foreground"
                  )}
                  title={pred.correct == null ? "Not graded yet" : undefined}
                >
                  {pred.correct === true ? (paysOut ? `✓ +${bet.points}` : "✓") : pred.correct === false ? "✗" : "…"}
                </span>
              )}
            </div>
          );
        })}
        {guesses.length === 0 && <p className="text-xs italic text-muted-foreground">No guesses.</p>}
        {guesses.length === 1 && <p className="text-[0.7rem] text-muted-foreground">Only one guess, so it doesn&rsquo;t pay out.</p>}
      </div>

      {editing && canToggleEdit && (
        <div className="mt-2 flex flex-col gap-2 border-t border-dashed border-border pt-2">
          {canManage && (
            <SuggestedAnswerBlock
              suggestion={suggestion}
              loading={suggestionLoading}
              error={suggestionError}
              onFetch={fetchSuggestion}
              onApply={applySuggestion}
              canApply={ungraded.length > 0}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!canManage && <span className="text-xs text-muted-foreground">You can remove this until 2 people have guessed.</span>}
            {creator && <span className="text-xs text-muted-foreground">Proposed by {creator.name}</span>}
            <Button variant="destructive" size="sm" className="ml-auto" onClick={remove}>
              Remove Prediction
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// The grading aid itself: a button that fetches the bet's suggested answer (the suggested-answer
// route: the episode research's own answer to this bet, else the closest research note), then shows
// it. Deliberately never shows an answer without also showing what backs it and how sure it is -- an
// unlabeled suggestion next to a grading dropdown is exactly the kind of thing that gets
// rubber-stamped without being checked, which defeats the point of it being a SUGGESTION.
function SuggestedAnswerBlock({
  suggestion,
  loading,
  error,
  onFetch,
  onApply,
  canApply,
}: {
  suggestion: SuggestedBetAnswer | null;
  loading: boolean;
  error: string | null;
  onFetch: () => void;
  onApply: () => void;
  canApply: boolean;
}) {
  if (!suggestion && !loading && !error) {
    return (
      <div className="mt-2">
        <Button variant="secondary" size="xs" onClick={onFetch} title="Free — searches research that's already been paid for">
          Suggest an answer from research
        </Button>
        <span className="ml-1.5 text-[0.6rem] text-muted-foreground">free</span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-dashed border-border bg-secondary/40 px-2 py-1.5 text-xs">
      {loading && <span className="italic text-muted-foreground">Searching research for this episode…</span>}
      {error && (
        <span className="font-semibold text-destructive">
          {error} <button className="ml-1 underline" onClick={onFetch}>Try again</button>
        </span>
      )}
      {suggestion && suggestion.status === "no-research" && (
        <span className="italic text-muted-foreground">
          No research has been run for this episode yet, so there&rsquo;s nothing to search.
        </span>
      )}
      {suggestion && suggestion.status === "unconfident" && (
        <span className="italic text-muted-foreground">
          {suggestion.source === "research"
            ? "The episode’s research couldn’t settle this one from its sources."
            : "Can’t determine an answer confidently from research."}
        </span>
      )}
      {suggestion && suggestion.source === "search" && suggestion.askedAfterResearch && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          The episode&rsquo;s research wasn&rsquo;t asked this prediction (it was made after the research ran, or this league is
          catching up), so it&rsquo;s graded by hand. The note above is only the closest match in the research.
        </p>
      )}
      {suggestion && suggestion.status === "ok" && suggestion.source === "research" && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={suggestion.confidence === "high" ? "default" : "secondary"}
              className="h-4 shrink-0 text-[0.6rem]"
            >
              {suggestion.confidence} confidence
            </Badge>
            <span>
              Research says: <b>{suggestion.answer}</b>
            </span>
            {canApply && (
              <Button size="xs" variant="secondary" className="ml-auto" onClick={onApply} title="Grades the guesses not yet graded, as suggested">
                Apply to guesses
              </Button>
            )}
          </div>
          {suggestion.evidence && <span className="text-muted-foreground">{suggestion.evidence}</span>}
          {(suggestion.sources || []).length > 0 && (
            <span className="text-muted-foreground">
              {(suggestion.sources || []).map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-1 underline underline-offset-2" title={url}>
                  [{i + 1}]
                </a>
              ))}
            </span>
          )}
        </div>
      )}
      {suggestion && suggestion.status === "ok" && suggestion.source !== "research" && (
        <div className="flex flex-wrap items-start gap-1.5">
          <Badge
            variant={suggestion.confidence === "high" ? "default" : "secondary"}
            className="h-4 shrink-0 cursor-help text-[0.6rem]"
            title={`Confidence: ${suggestion.confidence}${suggestion.similarity != null ? ` — ${Math.round(suggestion.similarity * 100)}% match to the research` : ""}`}
          >
            {suggestion.confidence} confidence
          </Badge>
          <span>
            {suggestion.castawayName && <b>{suggestion.castawayName}: </b>}
            {suggestion.answer}
          </span>
        </div>
      )}
    </div>
  );
}
