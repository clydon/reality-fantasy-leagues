"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Port of renderDraft()'s "Draft Order" panel (public/app.js). Drag-and-drop reordering isn't
// ported -- only the ↑↓ buttons, which the live app itself already provides as the touch-device
// fallback for exactly this (dragging doesn't work there either), so this loses nothing that
// doesn't already have a working accessible equivalent in the original.
export function DraftOrderPanel({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  function move(index: number, delta: number) {
    mutate(
      (s) => StateLogic.moveDraftOrder(s, index, delta),
      () => api.reorderDraft(leagueId!, index, index + delta)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Draft Order</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        {canManage
          ? "Use the ↑↓ buttons to set draft order. Picks then snake back and forth automatically (1-2-3, 3-2-1, 1-2-3, ...)."
          : "Commissioner sets the draft order."}
      </p>
      <div className="flex flex-col gap-1.5">
        {state.draftOrder.map((pid, i) => {
          const p = StateLogic.getPlayer(state, pid);
          if (!p) return null;
          return (
            <div
              key={pid}
              className="flex items-center gap-2 rounded-md border-l-4 bg-secondary/50 px-2.5 py-1.5"
              style={{ borderLeftColor: p.color }}
            >
              <span className="flex-1 text-sm">
                <b>{i + 1}.</b> {p.name}
              </span>
              {canManage && (
                <div className="flex gap-1">
                  {i > 0 && (
                    <Button variant="secondary" size="sm" title="Move up" onClick={() => move(i, -1)}>
                      ↑
                    </Button>
                  )}
                  {i < state.draftOrder.length - 1 && (
                    <Button variant="secondary" size="sm" title="Move down" onClick={() => move(i, 1)}>
                      ↓
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
