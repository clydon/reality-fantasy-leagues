"use client";

import type { LeagueState } from "@/lib/game/types";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";
import { Button } from "@/components/ui/button";

// Port of renderDraft()'s "Draft Results" panel -- who each player originally drafted, unaffected
// by later Replenish/Swap (see the live app's own note: current rosters live on Scoreboard).
export function DraftResultsPanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  // Shared ownership: a castaway can legitimately sit on several rosters at once, and Undraft only
  // takes a castawayId -- there'd be no way to say WHICH owner to strip -- so it's hidden here in
  // that mode (BlindDraftStrategy.undo is inert for the same reason).
  const shared = state.settings.ownershipMode === "shared";

  async function handleUndraft(castawayId: string) {
    await mutate(
      (s) => StateLogic.undraft(s, castawayId),
      () => api.undraft(leagueId!, castawayId)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Draft Results</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Who each player originally drafted — this doesn&rsquo;t change after the draft.{" "}
        {shared
          ? `This league shares ownership, so the same ${terms.castaway} may appear on more than one roster.`
          : "For CURRENT rosters (after any mid-season Replenish or Swap), see the Scoreboard tab."}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.players.map((p) => {
          const picks = state.castaways.filter(
            (c) => c.acquiredVia === "draft" && (c.ownerIds.includes(p.id) || c.formerOwnerId === p.id)
          );
          return (
            <div key={p.id} className="rounded-md border-2 bg-secondary/40 p-2.5" style={{ borderColor: p.color }}>
              <div className="mb-1 text-sm font-bold" style={{ color: p.color }}>
                {p.name} ({picks.length}/{StateLogic.rosterSize(state)} drafted)
              </div>
              {picks.length === 0 ? (
                <div className="text-xs text-muted-foreground">No picks yet</div>
              ) : (
                picks.map((c) => (
                  <div key={c.id} className="my-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <CastawayAvatar
                        castaway={c}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[0.6rem] font-bold"
                      />
                      {c.name}
                      <RoleBadge state={state} castawayId={c.id} />{" "}
                      {c.status === "eliminated" && <span className="text-muted-foreground">(#{c.placementOrder})</span>}
                      {!c.ownerIds.includes(p.id) && (
                        <span className="text-muted-foreground">— {c.departedVia === "trade" ? "swapped away" : "replenished away"}</span>
                      )}
                    </span>
                    {!shared && c.ownerIds.includes(p.id) && c.status === "active" && canManage && (
                      <Button variant="secondary" size="sm" onClick={() => handleUndraft(c.id)}>
                        Undraft
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
