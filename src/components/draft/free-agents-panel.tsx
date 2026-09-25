"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RoleBadge } from "@/components/role-badge";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { cn } from "cn";

// Port of renderDraft()'s "Free Agents" panel -- click a castaway to draft them for whoever's
// turn it is. The commissioner-drafting-on-someone-else's-behalf confirmation dialog is ported
// too, now via the app's own styled confirm() rather than window.confirm().
export function FreeAgentsPanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();
  const mutate = useMutate();

  const fa = StateLogic.freeAgents(state);
  const draftStarted = StateLogic.isDraftStarted(state);
  const turn = StateLogic.currentDraftTurn(state);
  const canPick = draftStarted && !!turn && !turn.isComplete && (canManage || turn.playerId === myPlayerId);
  const turnPlayer = turn && !turn.isComplete ? StateLogic.getPlayer(state, turn.playerId ?? "") : null;

  async function pick(castawayId: string) {
    if (!draftStarted || !turn || turn.isComplete) return;
    if (turn.playerId !== myPlayerId) {
      const castaway = StateLogic.getCastaway(state, castawayId);
      const ok = await confirm(
        `You are drafting a pick for ${turnPlayer?.name || "this player"}. Are you sure you want to draft ${castaway?.name || `this ${terms.castaway}`}?`
      );
      if (!ok) return;
    }
    await mutate(
      (s) => StateLogic.draftToCurrentTurn(s, castawayId),
      () => api.draftPick(leagueId!, castawayId)
    );
  }

  let hint: string;
  if (!draftStarted) hint = "Waiting for the draft to start.";
  else if (turn && turn.isComplete) hint = "Draft complete — no more picks to make.";
  else if (!turnPlayer) hint = "";
  else if (canPick) hint = `Click a ${terms.castaway} below to draft them for ${turnPlayer.name}.`;
  else hint = `Waiting for ${turnPlayer.name} to pick...`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        Free Agents ({fa.length})
      </h3>
      {hint && <p className="mb-3 text-sm text-muted-foreground">{hint}</p>}
      {fa.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No free agents remaining.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
          {fa.map((c) => (
            <div
              key={c.id}
              role={canPick ? "button" : undefined}
              tabIndex={canPick ? 0 : undefined}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-card p-2.5 text-center shadow-sm",
                canPick ? "cursor-pointer hover:border-primary" : "opacity-60"
              )}
              onClick={() => canPick && pick(c.id)}
              onKeyDown={(e) => canPick && e.key === "Enter" && pick(c.id)}
            >
              <CastawayAvatar
                castaway={c}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xs font-bold"
              />
              <div className="text-xs font-medium leading-tight">
                {c.name}
                <RoleBadge state={state} castawayId={c.id} />
              </div>
              {canPick && (
                <div className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">Draft</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
