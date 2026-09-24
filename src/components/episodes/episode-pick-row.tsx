"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useShowTerms } from "@/lib/use-show-terms";

// Pick'em only: the "Your Pick" section of EpisodeCard, modeled on EpisodeBetRow's guess-list
// shape (per-player badge + a picker to submit/change your own, or anyone's if you can manage
// the league) but simpler in a few ways that matter -- there's exactly one pick per player per
// episode (not an accumulating list of guesses), and correctness is auto-derived from this
// episode's logged eliminations rather than manually graded, so there's no grading Select here,
// just a read-only Correct/Incorrect/Pending badge per player.
export function EpisodePicksSection({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const [pickerPlayerId, setPickerPlayerId] = useState("");

  const activePlayerId = canManage ? pickerPlayerId : myPlayerId || "";
  const activeCast = state.castaways.filter((c) => c.status === "active");
  const excludedId = activePlayerId ? StateLogic.previousPickEmPickFor(state, ep.id, activePlayerId)?.castawayId : undefined;
  const eligibleForPicker = activeCast.filter((c) => c.id !== excludedId);

  async function setPick(castawayId: string) {
    const playerId = activePlayerId;
    if (!playerId || !castawayId) return;
    await mutate(
      (s) => StateLogic.setPickEmPick(s, ep.id, playerId, castawayId),
      () => api.setPickEmPick(leagueId!, ep.id, playerId, castawayId)
    );
  }

  async function removePick(playerId: string) {
    await mutate(
      (s) => StateLogic.removePickEmPick(s, ep.id, playerId),
      () => api.removePickEmPick(leagueId!, ep.id, playerId)
    );
  }

  return (
    <div className="border-t border-border pt-3">
      <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Picks</h4>
      <div className="mb-2 flex flex-col gap-1.5">
        {state.players.map((p) => {
          const pick = StateLogic.pickEmPickFor(state, ep.id, p.id);
          const castaway = pick ? StateLogic.getCastaway(state, pick.castawayId) : null;
          // Correctness is only known once this episode's eliminations are logged -- with zero
          // eliminations recorded yet, every pick is genuinely "pending", not "correct by default".
          const decided = ep.events.length > 0;
          const correct = pick && decided ? !ep.events.some((ev) => ev.castawayId === pick.castawayId) : null;
          const canRemove = canManage || p.id === myPlayerId;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <Badge className="text-white" style={{ background: p.color }}>
                {p.name}
              </Badge>
              {pick ? (
                <>
                  <span className="flex-1">picked: {castaway?.name || "?"}</span>
                  {correct === true && (
                    <Badge variant="secondary" className="bg-good/15 text-good">
                      Correct
                    </Badge>
                  )}
                  {correct === false && (
                    <Badge variant="secondary" className="bg-destructive/15 text-destructive">
                      Incorrect
                    </Badge>
                  )}
                  {correct === null && <Badge variant="secondary">Pending</Badge>}
                  {canRemove && (
                    <button title="Remove pick" onClick={() => removePick(p.id)}>
                      ✕
                    </button>
                  )}
                </>
              ) : (
                <span className="flex-1 italic text-muted-foreground">no pick yet</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {canManage ? (
          <Select size="sm" value={pickerPlayerId} onChange={(e) => setPickerPlayerId(e.target.value)}>
            <option value="">— player —</option>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="self-center text-xs text-muted-foreground">Your pick:</span>
        )}
        <Select size="sm" value="" disabled={!activePlayerId} onChange={(e) => setPick(e.target.value)}>
          <option value="">— select {terms.castaway} —</option>
          {eligibleForPicker.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {excludedId && (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          {StateLogic.getCastaway(state, excludedId)?.name} is excluded — same as last episode&rsquo;s pick.
        </p>
      )}
    </div>
  );
}
