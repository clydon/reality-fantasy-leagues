"use client";

import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { ordinal } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { TransactionHistory } from "@/components/mid-season/transaction-history";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Port of renderReplenishPanel() (public/app.js). The whole route (server/routes/replenish.js)
// is commissioner-only, so canManage() gating here matches server enforcement exactly -- a
// member never even sees an actionable control they'd be rejected for using.
export function ReplenishPanel({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const r = state.midSeason.replenish;
  const orderLabel = state.settings.replenishOrderBy === "leastPoints" ? "lowest points first" : "highest points first";
  const log = (state.midSeason.log ?? []).filter((e) => e.type === "replenish");

  async function handleStart() {
    await mutate(
      (s) => {
        if (!StateLogic.startReplenish(s)) alert("Nobody has a roster spot to fill right now.");
      },
      () => api.startReplenish(leagueId!)
    );
  }

  async function assign(castawayId: string) {
    await mutate(
      (s) => StateLogic.replenishAssign(s, castawayId),
      () => api.replenishAssign(leagueId!, castawayId)
    );
  }

  async function cancel() {
    await mutate(
      (s) => StateLogic.cancelReplenish(s),
      () => api.cancelReplenish(leagueId!)
    );
  }

  if (!canManage && !r) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Commissioner-run.</p>
        <TransactionHistory state={state} entries={log} />
      </>
    );
  }
  if (!r) {
    return (
      <>
        <p className="mb-2 text-sm text-muted-foreground">
          Re-draft to replace eliminated players and refill your roster. Order: <b>{orderLabel}</b>{" "}
          <span className="text-muted-foreground">(League Settings)</span>.
        </p>
        <Button onClick={handleStart}>Start Replenish</Button>
        <TransactionHistory state={state} entries={log} />
      </>
    );
  }

  const turn = StateLogic.currentReplenishTurn(state);
  if (!turn || turn.isComplete) {
    return (
      <>
        <p className="text-sm font-semibold text-good">Replenish complete.</p>
        {canManage && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={cancel}>
            Clear
          </Button>
        )}
        <TransactionHistory state={state} entries={log} />
      </>
    );
  }

  const player = StateLogic.getPlayer(state, turn.playerId ?? "");
  const fa = StateLogic.freeAgents(state);

  return (
    <>
      <div className="mb-3.5 rounded-lg border-2 bg-card p-3.5" style={{ borderColor: player?.color || "var(--primary)" }}>
        <h4 className="text-base font-bold" style={{ color: player?.color }}>
          {player?.name || "?"}&rsquo;s turn, {ordinal(turn.personalPickNumber)} replenish pick
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Overall pick #{turn.overallPickNumber} <span>({turn.scoreAtStart} pts at the time)</span>
        </p>
      </div>
      {!canManage && <p className="mb-2 text-sm text-muted-foreground">Waiting for your commissioner to assign a Free Agent.</p>}
      {fa.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No free agents remaining.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
          {fa.map((c) => (
            <div
              key={c.id}
              role={canManage ? "button" : undefined}
              tabIndex={canManage ? 0 : undefined}
              className={
                "flex flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-card p-2.5 text-center shadow-sm " +
                (canManage ? "cursor-pointer hover:border-primary" : "opacity-60")
              }
              onClick={() => canManage && assign(c.id)}
              onKeyDown={(e) => canManage && e.key === "Enter" && assign(c.id)}
            >
              <CastawayAvatar
                castaway={c}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xs font-bold"
              />
              <div className="text-xs font-medium leading-tight">{c.name}</div>
              {canManage && (
                <div className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">Assign</div>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <Button variant="destructive" size="sm" className="mt-3" onClick={cancel}>
          Cancel Replenish
        </Button>
      )}
      <TransactionHistory state={state} entries={log} />
    </>
  );
}
