"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { ordinal } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Select } from "@/components/ui/select";

// Port of renderFinalePanel() (public/app.js): each player's Top-3 + Winner prediction, plus the
// commissioner-only Actual Result used to grade them all via ScoringLogic.compute.
export function FinalePanel({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const s = state.settings;
  const maxBonus = s.finaleTop3Points * 3 + s.finaleWinnerPoints;
  const scores = StateLogic.computeScores(state);
  const finaleOf = (playerId: string) => scores.find((sc) => sc.playerId === playerId)?.finale ?? 0;

  async function setPick(playerId: string, idx: number, value: string) {
    await mutate(
      (st) => StateLogic.setFinalePick(st, playerId, idx, value || null),
      () => api.setFinalePick(leagueId!, playerId, idx, value || null)
    );
  }
  async function setWinnerPick(playerId: string, value: string) {
    await mutate(
      (st) => StateLogic.setFinaleWinnerPick(st, playerId, value || null),
      () => api.setFinaleWinnerPick(leagueId!, playerId, value || null)
    );
  }
  async function setActualTop3(idx: number, value: string) {
    await mutate(
      (st) => StateLogic.setActualTop3(st, idx, value || null),
      () => api.setActualTop3(leagueId!, idx, value || null)
    );
  }
  async function setActualWinner(value: string) {
    await mutate(
      (st) => StateLogic.setActualWinner(st, value || null),
      () => api.setActualWinner(leagueId!, value || null)
    );
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
            Scope: <b>open</b> — predict any castaway.
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
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2].map((i) => (
                      <label key={i} className="flex items-center gap-1 text-xs">
                        {ordinal(i + 1)}
                        <Select
                          className="rounded border border-border bg-card px-1 py-0.5 text-xs"
                          disabled={!editable}
                          defaultValue={fp.top3[i] ?? ""}
                          onChange={(e) => setPick(p.id, i, e.target.value)}
                        >
                          <option value="">—</option>
                          {pool.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Winner</div>
                {pool.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <Select
                    className="rounded border border-border bg-card px-1.5 py-1 text-xs"
                    disabled={!editable}
                    defaultValue={fp.winner ?? ""}
                    onChange={(e) => setWinnerPick(p.id, e.target.value)}
                  >
                    <option value="">—</option>
                    {pool.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">Best set once, right after the merge — edit anytime before the finale airs.</p>

      <h4 className="mb-2 mt-4 text-sm font-bold">
        Actual Result <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-normal">Commissioner only</span>
      </h4>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Top 3:</span>
        {[0, 1, 2].map((i) => (
          <label key={i} className="flex items-center gap-1 text-xs">
            {ordinal(i + 1)}
            <Select
              className="rounded border border-border bg-card px-1 py-0.5 text-xs"
              disabled={!canManage}
              defaultValue={state.finaleActual.top3[i] ?? ""}
              onChange={(e) => setActualTop3(i, e.target.value)}
            >
              <option value="">—</option>
              {state.castaways.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Winner:</span>
        <Select
          className="rounded border border-border bg-card px-1.5 py-1 text-sm"
          disabled={!canManage}
          defaultValue={state.finaleActual.winner ?? ""}
          onChange={(e) => setActualWinner(e.target.value)}
        >
          <option value="">—</option>
          {state.castaways.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
