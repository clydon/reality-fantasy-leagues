"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TransactionHistory } from "@/components/mid-season/transaction-history";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { BarButton, CastTile, ConfirmBar, PlainButton, SectionHead, TileGrid, TurnPill, shortNames } from "@/components/draft/draft-ui";
import { whoName } from "@/components/draft/draft-helpers";

// Pickups (the canvas's "Pickups after an elimination"; "replenish" in code and settings data): a
// turn-based round that refills rosters after eliminations. The commissioner starts and ends it; each
// player picks their own replacement on their turn, by select-then-confirm like the draft, and the
// commissioner can pick for anyone (replenish/assign's rule, same as draft/pick). The plate says whose
// turn it is and who they're replacing, with the order underneath.
export function ReplenishPanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const me = useMyPlayerId();
  const mutate = useMutate();
  const [sel, setSel] = useState<{ pick: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const r = state.midSeason.replenish as
    | { sequence: { playerId: string; scoreAtStart: number }[]; index: number; lossIdsByPlayer?: Record<string, string[]> }
    | null;
  const orderLabel =
    state.settings.replenishOrderBy === "leastPoints"
      ? "fewest points first"
      : state.settings.replenishOrderBy === "mostPoints"
        ? "most points first"
        : "reverse draft order, rolling";
  const activeRoster = StateLogic.getLeagueType(state).hasActiveRoster;
  const shared = state.settings.ownershipMode === "shared";
  // Active Roster: who's owed picks right now, from the "down to X" threshold.
  const owed = activeRoster
    ? state.players.map((p) => ({ p, need: StateLogic.replenishNeed(state, p.id) })).filter((x) => x.need > 0)
    : [];
  const log = (state.midSeason.log ?? []).filter((e) => e.type === "replenish");

  async function handleStart() {
    await mutate(
      (s) => {
        if (!StateLogic.startReplenish(s)) alert("Nobody has an eliminated castaway to replace yet.");
      },
      () => api.startReplenish(leagueId!)
    );
  }

  async function cancel(ask: boolean) {
    if (ask && !(await confirm("End this pickup round? Pickups already made stay; nobody else gets one.", { confirmLabel: "End round" }))) return;
    setSel(null);
    await mutate(
      (s) => StateLogic.cancelReplenish(s),
      () => api.cancelReplenish(leagueId!)
    );
  }

  if (!r) {
    return (
      <div className="flex flex-col gap-3">
        {canManage ? (
          <>
            <p className="text-base">
              {activeRoster ? (
                <>
                  A roster down to <b>{StateLogic.MidSeasonLogic.replenishAt(state)}</b> still in the game adds players back up to{" "}
                  {StateLogic.MidSeasonLogic.replenishAt(state) + 1}
                  {shared ? ", from anyone still in the game who isn't already theirs" : " from the free agents"}.
                </>
              ) : (
                <>Players replace eliminated {terms.castaways} with free agents, one pickup per turn.</>
              )}{" "}
              <span className="text-muted-foreground">Order: {orderLabel}.</span>
            </p>
            {activeRoster && (
              <p className="text-sm text-muted-foreground">
                {owed.length === 0
                  ? "Nobody's roster is down that far right now."
                  : `Owed now: ${owed.map((x) => `${x.p.name} (${x.need})`).join(", ")}`}
              </p>
            )}
            <PlainButton onClick={handleStart} className="nav:self-start">
              Start pickup round
            </PlainButton>
          </>
        ) : (
          <p className="text-base text-muted-foreground">
            After eliminations your commissioner starts a pickup round, and you pick up a replacement on your turn.
          </p>
        )}
        <TransactionHistory state={state} entries={log} />
      </div>
    );
  }

  const turn = StateLogic.currentReplenishTurn(state);
  if (!turn || turn.isComplete || !turn.playerId) {
    return (
      <div className="flex flex-col gap-3">
        <CaptionPlate tone="good" tag="Done" title="Pickups complete" subtitle="Every roster that was owed a pickup has it." />
        {canManage && (
          <PlainButton onClick={() => cancel(false)} className="nav:self-start">
            Clear
          </PlainButton>
        )}
        <TransactionHistory state={state} entries={log} />
      </div>
    );
  }

  const pickNo = turn.overallPickNumber!;
  const who = whoName(state, turn.playerId, me);
  const mineTurn = turn.playerId === me;
  const canAct = mineTurn || canManage;
  const lossId = r.lossIdsByPlayer?.[turn.playerId]?.[(turn.personalPickNumber ?? 1) - 1];
  const loss = lossId ? StateLogic.getCastaway(state, lossId) : null;
  const fa = StateLogic.availableFor(state, turn.playerId);
  const names = shortNames(fa);
  const selected = sel && sel.pick === pickNo && fa.some((c) => c.id === sel.id) ? StateLogic.getCastaway(state, sel.id) : null;

  async function assign() {
    if (!selected || busy) return;
    setBusy(true);
    const id = selected.id;
    const ok = await mutate(
      (s) => StateLogic.replenishAssign(s, id),
      () => api.replenishAssign(leagueId!, id)
    );
    setBusy(false);
    if (ok) setSel(null);
  }

  const strip = r.sequence.map((t, i) => ({ ...t, i })).slice(Math.max(0, r.index - 1), r.index + 5);

  return (
    <div className="flex flex-col gap-4">
      <CaptionPlate
        tone={mineTurn ? "chyron" : "quiet"}
        tag={
          mineTurn ? (
            <>
              Your
              <br />
              turn
            </>
          ) : (
            `Pick ${pickNo}`
          )
        }
        title={loss ? `${mineTurn ? "Replace" : `${who}: replace`} ${loss.name.split(" ")[0]}` : `${who} · pick ${pickNo}`}
        subtitle={[`${turn.scoreAtStart ?? 0} pts when the round started`, !canAct && `waiting on ${who}`].filter(Boolean).join(" · ")}
      />

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Pickup order">
        <span className="text-[13px] text-muted-foreground">Order, {orderLabel}:</span>
        {strip.map((t) => (
          <TurnPill key={t.i} you={t.playerId === me} now={t.i === r.index} done={t.i < r.index}>
            {whoName(state, t.playerId, me)}
          </TurnPill>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <SectionHead>
          {shared ? "Available" : "Free agents"} · {fa.length}
        </SectionHead>
        {fa.length === 0 ? (
          <p className="text-base text-muted-foreground">Nobody left to add.</p>
        ) : (
          <TileGrid cols={3}>
            {fa.map((c) => (
              <CastTile
                key={c.id}
                castaway={c}
                label={names.get(c.id)!}
                state={state}
                photoHeight={84}
                mark={selected?.id === c.id ? "add" : undefined}
                onClick={canAct ? () => setSel(selected?.id === c.id ? null : { pick: pickNo, id: c.id }) : undefined}
              />
            ))}
          </TileGrid>
        )}
      </section>

      {canAct && (
        <ConfirmBar note={`${who} ${mineTurn ? "get" : "gets"}`} title={selected ? selected.name : `Choose a ${terms.castaway}`}>
          <BarButton onClick={assign} disabled={!selected || busy}>
            {selected ? (mineTurn ? `Pick up ${names.get(selected.id)}` : `Give to ${who}`) : "Pick up"}
          </BarButton>
        </ConfirmBar>
      )}
      {canManage && (
        <PlainButton danger onClick={() => cancel(true)} className="nav:self-start">
          End pickup round
        </PlainButton>
      )}
      <TransactionHistory state={state} entries={log} />
    </div>
  );
}
