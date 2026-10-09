"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TransactionHistory } from "@/components/mid-season/transaction-history";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { cn } from "cn";
import { BarButton, CastTile, ConfirmBar, PhotoSquare, PlainButton, SectionHead, TileGrid, TurnPill, shortNames } from "@/components/draft/draft-ui";
import { whoName } from "@/components/draft/draft-helpers";

// Swap (the canvas's "Swap window: drop one, add one"): one optional swap each, in priority order.
// The commissioner starts and ends the round; on your turn you pick who to drop and who to add, in
// either order, and confirm both in the bar, or skip. The commissioner can act for anyone (trade/swap
// and trade/skip's rule, same as draft/pick); everyone else sees whose turn it is and the order.
export function TradePanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const me = useMyPlayerId();
  const mutate = useMutate();
  // Both picks belong to one turn; when the turn moves on they're dropped.
  const [sel, setSel] = useState<{ turn: number; drop: string | null; add: string | null }>({ turn: -1, drop: null, add: null });
  const [busy, setBusy] = useState(false);
  const t = state.midSeason.trade;
  const log = (state.midSeason.log ?? []).filter((e) => e.type === "trade");
  const activeRoster = StateLogic.getLeagueType(state).hasActiveRoster;
  const window = activeRoster ? StateLogic.swapWindow(state) : null;

  async function handleStart() {
    await mutate(
      (s) => StateLogic.startTrade(s),
      () => api.startTrade(leagueId!)
    );
  }
  async function skip() {
    await mutate(
      (s) => StateLogic.tradeSkip(s),
      () => api.tradeSkip(leagueId!)
    );
  }
  async function cancel(ask: boolean) {
    if (ask && !(await confirm("End this swap round? Swaps already made stay; nobody else gets one.", { confirmLabel: "End round" }))) return;
    await mutate(
      (s) => StateLogic.cancelTrade(s),
      () => api.cancelTrade(leagueId!)
    );
  }

  if (!t) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base">
          One optional swap each, in priority order.{" "}
          <span className="text-muted-foreground">
            {window
              ? window.due
                ? `The swap window after episode ${window.afterEpisode} is open.`
                : `Next window: after episode ${window.nextAfterEpisode} (every ${StateLogic.MidSeasonLogic.swapEvery(state)} episodes).`
              : canManage
                ? ""
                : "Your commissioner starts a swap round, and you swap or skip on your turn."}
          </span>
        </p>
        {canManage && (
          <PlainButton onClick={handleStart} disabled={!!window && !window.due} className="nav:self-start">
            Start swap round
          </PlainButton>
        )}
        <TransactionHistory state={state} entries={log} />
      </div>
    );
  }

  if (t.index >= t.queue.length) {
    return (
      <div className="flex flex-col gap-3">
        <CaptionPlate tone="good" tag="Done" title="Swap round complete" subtitle="Everyone has had their turn." />
        {canManage && (
          <PlainButton onClick={() => cancel(false)} className="nav:self-start">
            Clear
          </PlainButton>
        )}
        <TransactionHistory state={state} entries={log} />
      </div>
    );
  }

  const turn = t.queue[t.index];
  const who = whoName(state, turn.playerId, me);
  const mineTurn = turn.playerId === me;
  const canAct = mineTurn || canManage;
  const next = t.queue[t.index + 1];
  const owned = state.castaways.filter((c) => c.ownerIds.includes(turn.playerId) && c.status === "active");
  const fa = StateLogic.availableFor(state, turn.playerId);
  const ownedNames = shortNames(owned);
  const faNames = shortNames(fa);
  const cur = sel.turn === t.index ? sel : { turn: t.index, drop: null, add: null };
  const drop = cur.drop && owned.some((c) => c.id === cur.drop) ? StateLogic.getCastaway(state, cur.drop) : null;
  const add = cur.add && fa.some((c) => c.id === cur.add) ? StateLogic.getCastaway(state, cur.add) : null;

  async function swap() {
    if (!drop || !add || busy) return;
    setBusy(true);
    const d = drop.id;
    const a = add.id;
    const ok = await mutate(
      (s) => StateLogic.tradeSwap(s, d, a),
      () => api.tradeSwap(leagueId!, d, a)
    );
    setBusy(false);
    if (ok) setSel({ turn: -1, drop: null, add: null });
  }

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
            "Swap"
          )
        }
        title={mineTurn ? "One swap: drop one, add one" : `${who}: drop one, add one`}
        subtitle={[!canAct && `Waiting on ${who}.`, next ? `Then ${whoName(state, next.playerId, me)}.` : "Last turn of the round."]
          .filter(Boolean)
          .join(" ")}
      />

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Swap order">
        <span className="text-[13px] text-muted-foreground">Order:</span>
        {t.queue.map((q, i) => (
          <TurnPill key={i} you={q.playerId === me} now={i === t.index} done={i < t.index}>
            {whoName(state, q.playerId, me)}
          </TurnPill>
        ))}
      </div>

      {canAct && (
        <>
          <section className="flex flex-col gap-2">
            <SectionHead aside={drop && <span className="pb-1.5 text-[13px] text-muted-foreground">{ownedNames.get(drop.id)} selected</span>}>1 · Drop</SectionHead>
            {owned.length === 0 ? (
              <p className="text-base text-muted-foreground">No active {terms.castaways} to drop.</p>
            ) : (
              <ul className="grid grid-cols-5 gap-x-1.5 gap-y-3 sm:grid-cols-7">
                {owned.map((c) => {
                  const on = drop?.id === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`Drop ${c.name}`}
                        onClick={() => setSel({ ...cur, drop: on ? null : c.id })}
                        className="flex w-full min-w-0 flex-col items-center gap-1 rounded-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron"
                      >
                        <span className={cn("rounded-[3px]", on && "outline-3 outline-offset-2 outline-live")}>
                          <PhotoSquare
                            castaway={c}
                            size={56}
                            badge={
                              on && (
                                <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-live text-white" aria-hidden>
                                  <X className="size-4" strokeWidth={3} />
                                </span>
                              )
                            }
                          />
                        </span>
                        <span className="w-full truncate text-center text-xs font-bold">{ownedNames.get(c.id)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{fa.length} available</span>}>2 · Add</SectionHead>
            {fa.length === 0 ? (
              <p className="text-base text-muted-foreground">Nobody left to add.</p>
            ) : (
              <TileGrid>
                {fa.map((c) => (
                  <CastTile
                    key={c.id}
                    castaway={c}
                    label={faNames.get(c.id)!}
                    state={state}
                    photoHeight={64}
                    mark={add?.id === c.id ? "add" : undefined}
                    onClick={() => setSel({ ...cur, add: add?.id === c.id ? null : c.id })}
                  />
                ))}
              </TileGrid>
            )}
          </section>

          <ConfirmBar
            note={drop ? `${mineTurn ? "Drop" : `${who} drops`} ${drop.name.split(" ")[0]}, ${mineTurn ? "add" : "adds"}` : `Choose who ${mineTurn ? "you drop" : `${who} drops`}`}
            title={add ? add.name : `Choose who to add`}
          >
            <BarButton onClick={swap} disabled={!drop || !add || busy}>
              Swap
            </BarButton>
          </ConfirmBar>

          <PlainButton onClick={skip} className="nav:self-start">
            {mineTurn ? "Skip my swap" : `Skip ${who}`}
          </PlainButton>
        </>
      )}
      {canManage && (
        <PlainButton danger onClick={() => cancel(true)} className="nav:self-start">
          End swap round
        </PlainButton>
      )}
      <TransactionHistory state={state} entries={log} />
    </div>
  );
}
