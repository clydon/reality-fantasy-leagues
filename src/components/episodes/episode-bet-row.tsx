"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Bet, Episode, LeagueState, SuggestedBetAnswer } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api, ApiError } from "@/lib/api";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { MoreButton } from "@/components/setup/settings-ui";
import { ActButton, Notice } from "@/components/admin/admin-ui";
import { EditPredictionSheet, GuessLine, QuestionLine } from "@/components/predictions/prediction-ui";
import { cn } from "cn";

// One prediction on an episode's page: the question, everyone's guess on a line each with how it
// went. Its ⋯ sheet has the commissioner's tools -- grade the guesses (✓ / ✕ in place, with a
// research suggestion to check against), edit the question or points, remove it -- or, for whoever
// asked it, Remove until a second guess is in. PROPOSING happens on the upcoming episode's page
// (propose-prediction.tsx) and GUESSING on Overview (bet-card.tsx): this never creates either.
export function EpisodeBetRow({ ep, bet, state }: { ep: Episode; bet: Bet; state: LeagueState }) {
  const [grading, setGrading] = useState(false);
  const [sheet, setSheet] = useState<null | "menu" | "edit">(null);
  const [showMisses, setShowMisses] = useState(false);

  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const isCreator = !!myPlayerId && bet.createdByPlayerId === myPlayerId;
  const creatorCanDelete = isCreator && (bet.predictions || []).length < 2;
  const hasMenu = canManage || creatorCanDelete;

  // Semantic-search grading aid (db/embeddings.js), fetched on demand rather than on every render --
  // it costs a real embedding call, and most bets on an episode are never opened to grade in a
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

  async function remove() {
    setSheet(null);
    await mutate(
      (s) => StateLogic.removeBet(s, ep.id, bet.id),
      () => api.removeBet(leagueId!, ep.id, bet.id)
    );
  }

  async function grade(predId: string, value: boolean) {
    await mutate(
      (s) => StateLogic.setBetPredictionCorrect(s, ep.id, bet.id, predId, value),
      () => api.setBetPredictionCorrect(leagueId!, ep.id, bet.id, predId, value)
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
      await grade(pred.id, verdict);
    }
  }

  async function removeGuess(predId: string) {
    await mutate(
      (s) => StateLogic.removeBetPrediction(s, ep.id, bet.id, predId),
      () => api.removeBetPrediction(leagueId!, ep.id, bet.id, predId)
    );
  }

  const guesses = bet.predictions || [];
  // Once it's graded, just the winners and their answers; everyone else's behind a chevron. Ungraded,
  // or while the commissioner grades, every guess shows.
  const graded = guesses.some((p) => p.correct === true || p.correct === false);
  const collapsible = graded && !grading;
  const misses = collapsible ? guesses.filter((p) => p.correct !== true) : [];
  const shown = collapsible && !showMisses ? guesses.filter((p) => p.correct === true) : guesses;

  return (
    <div className="flex flex-col gap-1.5 py-3">
      <QuestionLine
        bet={bet}
        ep={ep}
        state={state}
        action={hasMenu && !grading ? <MoreButton label="Prediction actions" onClick={() => setSheet("menu")} className="-my-1.5 -mr-2" /> : undefined}
      />

      <ul className="flex flex-col">
        {shown.map((pred) => (
          <GuessLine
            key={pred.id}
            state={state}
            pred={pred}
            bet={bet}
            grading={grading && canManage}
            onGrade={(v) => grade(pred.id, v)}
            onRemove={() => removeGuess(pred.id)}
            suggested={suggestedVerdict(pred.guess)}
          />
        ))}
      </ul>
      {collapsible && !guesses.some((p) => p.correct === true) && !showMisses && <p className="text-[14px] text-muted-foreground">Nobody got it.</p>}
      {misses.length > 0 && (
        <button
          type="button"
          className="-ml-1 flex min-h-11 items-center gap-1 self-start pr-2 text-[14px] font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => setShowMisses((v) => !v)}
          aria-expanded={showMisses}
        >
          <ChevronDown className={cn("size-[18px] transition-transform", showMisses && "rotate-180")} aria-hidden />
          {showMisses ? "Hide" : "Show"} {misses.length} other guess{misses.length === 1 ? "" : "es"}
        </button>
      )}
      {guesses.length === 0 && <p className="text-[14px] text-muted-foreground">No guesses.</p>}
      {guesses.length === 1 && <p className="text-[13px] text-muted-foreground">Only one guess, so it doesn&rsquo;t pay out.</p>}

      {/* The commissioner's nudge that guesses are waiting, once the episode has results -- opens grading
          in place. (Before then it's still in the ⋯ sheet.) */}
      {canManage && !grading && ungraded.length > 0 && StateLogic.episodeHasResults(ep) && (
        <ActButton className="mt-1 self-start" onClick={() => setGrading(true)}>
          Grade {ungraded.length} guess{ungraded.length === 1 ? "" : "es"}
        </ActButton>
      )}
      {grading && canManage && (
        <div className="mt-1 flex flex-col gap-3">
          <SuggestedAnswerBlock
            suggestion={suggestion}
            loading={suggestionLoading}
            error={suggestionError}
            onFetch={fetchSuggestion}
            onApply={applySuggestion}
            canApply={ungraded.length > 0}
          />
          <ActButton className="self-start" onClick={() => setGrading(false)}>
            Done grading
          </ActButton>
        </div>
      )}

      <BottomSheet
        open={sheet === "menu"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Prediction"
        description={canManage ? undefined : "Until a second person guesses"}
      >
        {canManage && guesses.length > 0 && (
          <SheetAction
            onClick={() => {
              setSheet(null);
              setGrading(true);
            }}
            detail={ungraded.length > 0 ? `${ungraded.length} to grade` : undefined}
          >
            Grade guesses
          </SheetAction>
        )}
        {canManage && <SheetAction onClick={() => setSheet("edit")}>Edit question or points</SheetAction>}
        <SheetAction danger onClick={remove}>
          Remove prediction
        </SheetAction>
      </BottomSheet>
      {sheet === "edit" && <EditPredictionSheet ep={ep} bet={bet} onClose={() => setSheet(null)} />}
    </div>
  );
}

// The grading aid itself: a button that fetches the bet's suggested answer (the suggested-answer
// route: the episode research's own answer to this bet, else the closest research note), then shows
// it. Deliberately never shows an answer without also showing what backs it and how sure it is -- an
// unlabeled suggestion next to the grading buttons is exactly the kind of thing that gets
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ActButton onClick={onFetch}>Suggest from research</ActButton>
        <span className="text-[13px] text-muted-foreground">Free: searches research that&rsquo;s already been run.</span>
      </div>
    );
  }

  const confidence = suggestion && suggestion.status === "ok" && (
    <span className="shrink-0 rounded-[2px] bg-muted px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {suggestion.confidence} confidence
    </span>
  );

  return (
    <div className="flex flex-col gap-2 rounded-[3px] bg-secondary px-3 py-2.5 text-[14px] leading-snug">
      {loading && <Notice tone="quiet">Searching this episode&rsquo;s research…</Notice>}
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <Notice tone="bad">{error}</Notice>
          <ActButton onClick={onFetch}>Try again</ActButton>
        </div>
      )}
      {suggestion && suggestion.status === "no-research" && (
        <p className="text-muted-foreground">No research has been run for this episode yet, so there&rsquo;s nothing to search.</p>
      )}
      {suggestion && suggestion.status === "unconfident" && (
        <p className="text-muted-foreground">
          {suggestion.source === "research"
            ? "The episode’s research couldn’t settle this one from its sources."
            : "Can’t tell confidently from the research."}
        </p>
      )}
      {suggestion && suggestion.status === "ok" && suggestion.source === "research" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {confidence}
            <span>
              Research says: <b>{suggestion.answer}</b>
            </span>
          </div>
          {suggestion.evidence && <p className="text-muted-foreground">{suggestion.evidence}</p>}
          {(suggestion.sources || []).length > 0 && (
            <p className="flex flex-wrap gap-x-2 text-muted-foreground">
              Sources:
              {(suggestion.sources || []).map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="font-semibold text-chyron-line hover:underline" title={url}>
                  {i + 1}
                </a>
              ))}
            </p>
          )}
          {canApply && (
            <ActButton className="self-start" onClick={onApply}>
              Grade the rest as research says
            </ActButton>
          )}
        </>
      )}
      {suggestion && suggestion.status === "ok" && suggestion.source !== "research" && (
        <div className="flex flex-wrap items-start gap-2">
          <span
            title={suggestion.similarity != null ? `${Math.round(suggestion.similarity * 100)}% match to the research` : undefined}
          >
            {confidence}
          </span>
          <span>
            {suggestion.castawayName && <b>{suggestion.castawayName}: </b>}
            {suggestion.answer}
          </span>
        </div>
      )}
      {suggestion && suggestion.source === "search" && suggestion.askedAfterResearch && (
        <p className="text-[13px] text-muted-foreground">
          The episode&rsquo;s research wasn&rsquo;t asked this prediction (it was made after the research ran, or this league is catching
          up), so it&rsquo;s graded by hand. The note above is only the closest match in the research.
        </p>
      )}
    </div>
  );
}
