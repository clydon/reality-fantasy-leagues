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

// Port of the per-bet block inside renderEpisodeCard() (public/app.js) -- the fuller editor
// version of a bet (editable label/points, remove-a-guess, add-a-guess-on-anyone's-behalf for the
// commissioner), distinct from Overview's read-mostly BetCard which is guess-only.
export function EpisodeBetRow({ ep, bet, state }: { ep: Episode; bet: Bet; state: LeagueState }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bet.label);
  const [points, setPoints] = useState(bet.points);
  const [guessPlayerId, setGuessPlayerId] = useState("");
  const [guessText, setGuessText] = useState("");

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

  async function addGuess() {
    const playerId = canManage ? guessPlayerId : myPlayerId;
    const guess = guessText.trim();
    if (!playerId || !guess) return;
    await mutate(
      (s) => StateLogic.addBetPrediction(s, ep.id, bet.id, playerId, guess),
      () => api.addBetPrediction(leagueId!, ep.id, bet.id, playerId, guess)
    );
    setGuessText("");
  }

  return (
    <div className="mb-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing && canManage ? (
          <>
            <Input
              className="min-w-[140px] flex-1 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label !== bet.label && saveField("label", label)}
            />
            <Input
              type="number"
              title="pts if correct"
              className="w-16 text-sm"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              onBlur={() => points !== bet.points && saveField("points", points)}
            />
          </>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold">{bet.label}</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs" title="points if correct">
              +{bet.points}
            </span>
          </>
        )}
        {creator && (
          <Badge className="text-white" style={{ background: creator.color }} title={`Proposed by ${creator.name}`}>
            {creator.name}
          </Badge>
        )}
        {canToggleEdit && (
          <button
            className="text-xs"
            title={canManage ? "Edit / remove" : "Remove your bet"}
            onClick={() => setEditing((e) => !e)}
          >
            ✏️
          </button>
        )}
      </div>

      {editing && canToggleEdit && (
        <div className="mt-1.5 flex items-center gap-2">
          {!canManage && <span className="text-xs text-muted-foreground">You can remove this until 2 people have guessed.</span>}
          <Button variant="destructive" size="sm" onClick={remove}>
            Remove Bet
          </Button>
        </div>
      )}

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

      <div className="mt-2 flex flex-col gap-1.5">
        {(bet.predictions || []).map((pred) => {
          const pp = StateLogic.getPlayer(state, pred.playerId);
          const verdict = suggestedVerdict(pred.guess);
          return (
            <div key={pred.id} className="flex items-center gap-2 text-xs">
              <Badge className="text-white" style={{ background: pp?.color || "#4a5245" }}>
                {pp?.name || "?"}
              </Badge>
              <span className="flex-1">
                guessed: &ldquo;{pred.guess}&rdquo;
                {verdict !== null && (
                  <span
                    className={verdict ? "ml-1.5 font-semibold text-good" : "ml-1.5 text-muted-foreground"}
                    title="What the episode's research suggests -- check it before grading"
                  >
                    {verdict ? "✓ suggested" : "✗ suggested"}
                  </span>
                )}
              </span>
              <Select
                // Keyed on the grade so it redraws when a grade changes from elsewhere (Apply), since
                // it's an uncontrolled select.
                key={`${pred.id}-${pred.correct}`}
                size="sm"
                disabled={!canManage}
                defaultValue={pred.correct === true ? "true" : pred.correct === false ? "false" : ""}
                onChange={(e) => grade(pred.id, e.target.value)}
              >
                <option value="">—</option>
                <option value="true">Correct</option>
                <option value="false">Incorrect</option>
              </Select>
              {pred.correct === true && (bet.predictions || []).length >= 2 && (
                <Badge variant="secondary" className="bg-good/15 text-good">
                  +{bet.points} pts
                </Badge>
              )}
              {editing && canManage && (
                <button title="Remove guess" onClick={() => removeGuess(pred.id)}>
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {(bet.predictions || []).length === 1 && (
          <p className="text-xs italic text-muted-foreground">Needs 1 more guess to be eligible to pay out.</p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {canManage ? (
          <Select size="sm" value={guessPlayerId} onChange={(e) => setGuessPlayerId(e.target.value)}>
            <option value="">— player —</option>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="self-center text-xs text-muted-foreground">Your guess:</span>
        )}
        <Input
          size="sm"
          className="min-w-[140px] flex-1"
          placeholder="Your guess (free text)"
          value={guessText}
          onChange={(e) => setGuessText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGuess()}
        />
        <Button size="xs" onClick={addGuess}>
          Add Guess
        </Button>
      </div>
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
          This bet was made after the episode was researched, so the research wasn&rsquo;t asked it. Re-running the
          episode&rsquo;s research (Admin → the season → Research, forced) will settle it.
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
