"use client";

import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";

// A grid of cast-photo cards for picking up to `max` castaways (3 for Top-3, 1 for Winner),
// replacing what used to be a bare <select> of names -- same card pattern as the draft/mid-season
// free-agent pickers (see free-agents-panel.tsx). `selected` holds ordered slot values (nulls for
// empty slots); clicking an already-picked card clears its slot, clicking an empty card fills the
// first empty slot, and a card can't be picked into two slots at once (state-logic.js's
// FinaleLogic.setPick/setActualTop3 enforce the same rule server-side).
function CastPickGrid({
  pool,
  selected,
  editable,
  onToggle,
}: {
  pool: Castaway[];
  selected: (string | null)[];
  editable: boolean;
  onToggle: (castawayId: string) => void;
}) {
  const max = selected.length;
  const filledCount = selected.filter(Boolean).length;
  // Single-select (Winner) never needs a slot cleared first -- picking a new card just switches
  // the pick, handled by the caller's onToggle. Only multi-select (Top-3) needs a slot free before
  // it'll accept a new name, since there's no "current slot" to swap into otherwise.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
      {pool.map((c) => {
        const idx = selected.indexOf(c.id);
        const picked = idx !== -1;
        const disabled = !editable || (max > 1 && !picked && filledCount >= max);
        return (
          <div
            key={c.id}
            role={editable ? "button" : undefined}
            tabIndex={editable && !disabled ? 0 : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 text-center",
              picked ? "border-primary bg-primary/10" : "border-border",
              editable && !disabled && "cursor-pointer hover:border-primary",
              disabled && !picked && "opacity-40"
            )}
            onClick={() => editable && !disabled && onToggle(c.id)}
            onKeyDown={(e) => editable && !disabled && e.key === "Enter" && onToggle(c.id)}
          >
            {picked && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                {max > 1 ? idx + 1 : "✓"}
              </span>
            )}
            <CastawayAvatar castaway={c} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-[0.6rem] font-bold" />
            <div className="w-full truncate text-[0.65rem] font-medium leading-tight">{c.name}</div>
          </div>
        );
      })}
    </div>
  );
}

// Port of renderFinalePanel() (public/app.js): each player's Top-3 + Winner prediction, plus the
// commissioner-only Actual Result used to grade them all via ScoringLogic.compute. Cast-photo
// cards (CastPickGrid above) replace the original's plain <select> dropdowns.
export function FinalePanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const s = state.settings;
  const maxBonus = s.finaleTop3Points * 3 + s.finaleWinnerPoints;
  const scores = StateLogic.computeScores(state);
  const finaleOf = (playerId: string) => scores.find((sc) => sc.playerId === playerId)?.finale ?? 0;

  async function setPick(playerId: string, idx: number, value: string | null) {
    await mutate(
      (st) => StateLogic.setFinalePick(st, playerId, idx, value),
      () => api.setFinalePick(leagueId!, playerId, idx, value)
    );
  }
  async function setWinnerPick(playerId: string, value: string | null) {
    await mutate(
      (st) => StateLogic.setFinaleWinnerPick(st, playerId, value),
      () => api.setFinaleWinnerPick(leagueId!, playerId, value)
    );
  }
  async function setActualTop3(idx: number, value: string | null) {
    await mutate(
      (st) => StateLogic.setActualTop3(st, idx, value),
      () => api.setActualTop3(leagueId!, idx, value)
    );
  }
  async function setActualWinner(value: string | null) {
    await mutate(
      (st) => StateLogic.setActualWinner(st, value),
      () => api.setActualWinner(leagueId!, value)
    );
  }

  // Toggling a card: clear its slot if already picked, otherwise fill the first empty slot.
  function toggleTop3(playerId: string, top3: (string | null)[], castawayId: string) {
    const idx = top3.indexOf(castawayId);
    if (idx !== -1) return setPick(playerId, idx, null);
    const empty = top3.indexOf(null);
    if (empty !== -1) return setPick(playerId, empty, castawayId);
  }
  function toggleActualTop3(top3: (string | null)[], castawayId: string) {
    const idx = top3.indexOf(castawayId);
    if (idx !== -1) return setActualTop3(idx, null);
    const empty = top3.indexOf(null);
    if (empty !== -1) return setActualTop3(empty, castawayId);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm">
        <span>
          <b>{s.finaleTop3Points}</b> pt{s.finaleTop3Points === 1 ? "" : "s"} per correct Top-3 name
        </span>
        <span className="text-muted-foreground">+</span>
        <span>
          <b>{s.finaleWinnerPoints}</b> pt{s.finaleWinnerPoints === 1 ? "" : "s"} for the correct Winner
        </span>
        <span className="text-muted-foreground">=</span>
        <span>
          <b>{maxBonus} pts max</b> if you nail all 3 names and the winner
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {s.finalePredictionScope === "ownPicksOnly" ? (
          <>
            Scope: <b>own picks only</b> — predict from your own roster.
          </>
        ) : (
          <>
            Scope: <b>open</b> — predict any {terms.castaway}.
          </>
        )}
      </p>
      <div className="flex flex-col gap-2.5">
        {state.players.map((p) => {
          const fp = state.finalePredictions.find((f) => f.playerId === p.id) || { playerId: p.id, top3: [null, null, null], winner: null };
          const pool = s.finalePredictionScope === "ownPicksOnly" ? state.castaways.filter((c) => c.ownerIds.includes(p.id)) : state.castaways;
          const editable = canManage || p.id === myPlayerId;
          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold" style={{ color: p.color }}>
                  {p.name}
                </span>
                <span className="font-mono text-sm">
                  {finaleOf(p.id)} / {maxBonus}
                </span>
              </div>
              <div className="mb-2">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Top 3</div>
                {pool.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No picks to predict with</span>
                ) : (
                  <CastPickGrid pool={pool} selected={fp.top3} editable={editable} onToggle={(id) => toggleTop3(p.id, fp.top3, id)} />
                )}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Winner</div>
                {pool.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <CastPickGrid
                    pool={pool}
                    selected={[fp.winner]}
                    editable={editable}
                    onToggle={(id) => setWinnerPick(p.id, fp.winner === id ? null : id)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        Best set once, {StateLogic.formatOf(state).hasMerge ? "right after the merge" : "once the field has narrowed"} — edit anytime
        before the finale airs.
      </p>

      <h4 className="mb-2 mt-4 text-sm font-bold">
        Actual Result <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-normal">Commissioner only</span>
      </h4>
      <div className="mb-3">
        <div className="mb-1 text-xs font-semibold text-muted-foreground">Top 3</div>
        <CastPickGrid
          pool={state.castaways}
          selected={state.finaleActual.top3}
          editable={canManage}
          onToggle={(id) => toggleActualTop3(state.finaleActual.top3, id)}
        />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">Winner</div>
        <CastPickGrid
          pool={state.castaways}
          selected={[state.finaleActual.winner]}
          editable={canManage}
          onToggle={(id) => setActualWinner(state.finaleActual.winner === id ? null : id)}
        />
      </div>
    </div>
  );
}
