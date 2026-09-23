"use client";

import { useState } from "react";
import type { Bet, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
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

      <div className="mt-2 flex flex-col gap-1.5">
        {(bet.predictions || []).map((pred) => {
          const pp = StateLogic.getPlayer(state, pred.playerId);
          return (
            <div key={pred.id} className="flex items-center gap-2 text-xs">
              <Badge className="text-white" style={{ background: pp?.color || "#4a5245" }}>
                {pp?.name || "?"}
              </Badge>
              <span className="flex-1">guessed: &ldquo;{pred.guess}&rdquo;</span>
              <Select
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
