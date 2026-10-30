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
// FinaleLogic.setPick enforces the same rule server-side).
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-x-2 gap-y-3">
      {pool.map((c) => {
        const idx = selected.indexOf(c.id);
        const picked = idx !== -1;
        const disabled = !editable || (max > 1 && !picked && filledCount >= max);
        // The cast board's face tile (cast-by-tribe.tsx); picked = the chyron-line outline and a
        // chyron badge with its slot (DESIGN.md "Cast tile").
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            aria-pressed={picked}
            className={cn(
              "relative flex min-w-0 flex-col items-center gap-1 rounded-[2px] outline-none focus-visible:ring-[3px] focus-visible:ring-chyron-line",
              disabled && !picked && "opacity-40",
              disabled && "cursor-default"
            )}
            onClick={() => onToggle(c.id)}
          >
            <CastawayAvatar
              castaway={c}
              className={cn(
                "flex aspect-square w-full items-center justify-center rounded-[2px] bg-secondary text-xs font-bold text-muted-foreground [&_img]:object-top",
                picked && "outline outline-[3px] outline-offset-2 outline-chyron-line"
              )}
            />
            {picked && (
              <span className="type-num absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-[2px] bg-chyron text-[13px] text-chyron-foreground">
                {max > 1 ? idx + 1 : "✓"}
              </span>
            )}
            <span className={cn("w-full truncate text-center text-[12px] leading-tight", picked && "font-semibold")}>{c.name.split(" ")[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Port of renderFinalePanel() (public/app.js): each player's Top-3 + Winner prediction, graded by the results (step A4 of
// docs/PLAN-start-a-game-gpt.md: the season's winner and the order everyone finished in, StateLogic.AnswerLogic; whoever
// ran the game used to type the real result in). Predictions lock when the season's last episode starts (the routes say
// so). Cast-photo cards (CastPickGrid above) replace the original's plain <select> dropdowns.
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
  // The results' answer, once the season's over (null while it runs); nothing to pick once it's in.
  const actual = StateLogic.AnswerLogic.finaleActual(state);
  const settled = !!actual.winner || actual.top3.some(Boolean);

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

  // Toggling a card: clear its slot if already picked, otherwise fill the first empty slot.
  function toggleTop3(playerId: string, top3: (string | null)[], castawayId: string) {
    const idx = top3.indexOf(castawayId);
    if (idx !== -1) return setPick(playerId, idx, null);
    const empty = top3.indexOf(null);
    if (empty !== -1) return setPick(playerId, empty, castawayId);
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
          const editable = (canManage || p.id === myPlayerId) && !settled;
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
        until the finale starts.
      </p>

      <h4 className="mb-2 mt-4 text-sm font-bold">
        The result <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-normal">From the results</span>
      </h4>
      {settled ? (
        <>
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Top 3</div>
            <CastPickGrid pool={state.castaways} selected={actual.top3} editable={false} onToggle={() => {}} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Winner</div>
            <CastPickGrid pool={state.castaways} selected={[actual.winner]} editable={false} onToggle={() => {}} />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Once the season&apos;s results are in, the final three and the winner score here on their own.</p>
      )}
    </div>
  );
}
