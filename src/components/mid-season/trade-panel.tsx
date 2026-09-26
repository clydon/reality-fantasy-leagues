"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { TransactionHistory } from "@/components/mid-season/transaction-history";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Port of renderTradePanel() (public/app.js). The live app's transient `tradeDropId` global
// (which castaway the current turn has chosen to drop, before picking a replacement) becomes
// this component's own local state -- same "was a global because there was nowhere else to put
// it" pattern as several other flags already converted elsewhere in this POC.
export function TradePanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const [dropId, setDropId] = useState<string | null>(null);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const t = state.midSeason.trade;
  const log = (state.midSeason.log ?? []).filter((e) => e.type === "trade");

  async function handleStart() {
    await mutate(
      (s) => StateLogic.startTrade(s),
      () => api.startTrade(leagueId!)
    );
  }
  async function swap(addId: string) {
    if (!dropId) return;
    const drop = dropId;
    setDropId(null);
    await mutate(
      (s) => StateLogic.tradeSwap(s, drop, addId),
      () => api.tradeSwap(leagueId!, drop, addId)
    );
  }
  async function skip() {
    setDropId(null);
    await mutate(
      (s) => StateLogic.tradeSkip(s),
      () => api.tradeSkip(leagueId!)
    );
  }
  async function cancel() {
    setDropId(null);
    await mutate(
      (s) => StateLogic.cancelTrade(s),
      () => api.cancelTrade(leagueId!)
    );
  }

  if (!t) {
    return canManage ? (
      <>
        <p className="mb-2 text-sm text-muted-foreground">One optional swap each, reverse draft order.</p>
        <Button onClick={handleStart}>Start Swap Round</Button>
        <TransactionHistory state={state} entries={log} />
      </>
    ) : (
      <>
        <p className="text-sm text-muted-foreground">Commissioner-run.</p>
        <TransactionHistory state={state} entries={log} />
      </>
    );
  }

  if (t.index >= t.queue.length) {
    return (
      <>
        <p className="text-sm font-semibold text-good">Swap round complete.</p>
        {canManage && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={cancel}>
            Clear
          </Button>
        )}
        <TransactionHistory state={state} entries={log} />
      </>
    );
  }

  const turn = t.queue[t.index];
  const player = StateLogic.getPlayer(state, turn.playerId);
  const owned = state.castaways.filter((c) => c.ownerIds.includes(turn.playerId) && c.status === "active");
  const fa = StateLogic.freeAgents(state);
  const effectiveDropId = dropId && owned.some((c) => c.id === dropId) ? dropId : null;
  const dropCastaway = effectiveDropId ? StateLogic.getCastaway(state, effectiveDropId) : null;

  return (
    <>
      <div className="mb-3.5 rounded-lg border-2 bg-card p-3.5" style={{ borderColor: player?.color || "var(--primary)" }}>
        <h4 className="text-base font-bold" style={{ color: player?.color }}>
          {player?.name || "?"}&rsquo;s turn — optional swap
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {!canManage
            ? "Commissioner-run."
            : dropCastaway
            ? <>Dropping <b>{dropCastaway.name}</b> — pick a Free Agent to add below.</>
            : `Click one of this player's ${terms.castaways} below to drop them, or skip this turn.`}
        </p>
      </div>

      {canManage &&
        (!dropCastaway ? (
          <div className="mb-3">
            <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">{player?.name || "?"}&rsquo;s Roster</h4>
            {owned.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">No active {terms.castaways} to drop.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                {owned.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-card p-2.5 text-center shadow-sm hover:border-primary"
                    onClick={() => setDropId(c.id)}
                    onKeyDown={(e) => e.key === "Enter" && setDropId(c.id)}
                  >
                    <CastawayAvatar
                      castaway={c}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
                    />
                    <div className="text-xs font-medium leading-tight">{c.name}</div>
                    <div className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">Drop</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Free Agents ({fa.length})</h4>
            {fa.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">No free agents remaining.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                {fa.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-card p-2.5 text-center shadow-sm hover:border-primary"
                    onClick={() => swap(c.id)}
                    onKeyDown={(e) => e.key === "Enter" && swap(c.id)}
                  >
                    <CastawayAvatar
                      castaway={c}
                      className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
                    />
                    <div className="text-xs font-medium leading-tight">{c.name}</div>
                    <div className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">Add</div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => setDropId(null)}>
              ← Back
            </Button>
          </div>
        ))}

      <p className="mb-2 text-xs text-muted-foreground">
        Order:{" "}
        {t.queue
          .map((q, i) => `${i === t.index ? "→ " : ""}${StateLogic.getPlayer(state, q.playerId)?.name || "?"}`)
          .join("  ·  ")}
      </p>
      {canManage && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={skip}>
            Skip This Player
          </Button>
          <Button variant="destructive" size="sm" onClick={cancel}>
            Cancel Swap Round
          </Button>
        </div>
      )}
      <TransactionHistory state={state} entries={log} />
    </>
  );
}
