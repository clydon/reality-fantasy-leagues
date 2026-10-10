"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { formatDateTime } from "@/lib/game/selectors";
import { sortByTribe } from "@/lib/game/sort-by-tribe";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { cn } from "cn";
import {
  BarButton,
  CastTile,
  ConfirmBar,
  EmptySlot,
  PhotoSquare,
  PlainButton,
  SectionHead,
  TileGrid,
  TurnPill,
  shortNames,
  useTribeFilter,
} from "./draft-ui";
import { DraftTeams, YouBadge } from "./draft-teams";
import { picksLeftFor, playersInDraftOrder, snakePickOwner, whoName } from "./draft-helpers";

// The turn-based (exclusive ownership) draft, in its three phases (docs/PLAN-ux-redesign.md, 2d; the
// canvas's "Snake draft, 13-pick roster"): before it starts, the order and Start; live, who's on the
// clock, your roster so far and the free agents, picked by select-then-confirm; complete, every team.

/** The commissioner's Start button. The confirm mentions the schedule only when one is set. */
export function StartDraftButton({ state, blind }: { state: LeagueState; blind?: boolean }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const scheduled = formatDateTime(state.settings.draftScheduledAt);
  async function start() {
    const msg = [
      blind ? "Start the draft now? Everyone can start picking." : "Start the draft now? The order can't change after this.",
      scheduled && `It was set to start ${scheduled}.`,
    ]
      .filter(Boolean)
      .join(" ");
    if (!(await confirm(msg, { confirmLabel: "Start draft" }))) return;
    await mutate(
      (s) => StateLogic.forceStartDraft(s),
      () => api.forceStartDraft(leagueId!)
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      data-tour="draft-start"
      className="min-h-12 w-full rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line nav:w-auto nav:self-start"
    >
      Start draft now
    </button>
  );
}

/** The "not started" plate, shared by both draft kinds. */
export function NotStartedPlate({ state }: { state: LeagueState }) {
  const canManage = useCanManage();
  const scheduled = formatDateTime(state.settings.draftScheduledAt);
  return (
    <CaptionPlate
      tone="quiet"
      tag="Draft"
      title={scheduled ? `Starts ${scheduled}` : "Not started yet"}
      subtitle={canManage ? (scheduled ? "Or start it yourself, any time." : "Start it when everyone's in.") : "Your commissioner starts it."}
    />
  );
}

export function PreDraft({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const me = useMyPlayerId();
  const mutate = useMutate();

  function move(index: number, delta: number) {
    mutate(
      (s) => StateLogic.moveDraftOrder(s, index, delta),
      () => api.reorderDraft(leagueId!, index, index + delta)
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NotStartedPlate state={state} />

      <section className="flex flex-col gap-1">
        <SectionHead aside={<span className="pb-1.5 text-sm text-muted-foreground">Snake</span>}>Order</SectionHead>
        <p className="mb-2 text-sm text-muted-foreground">
          Picks go down the list, then back up: 1, 2, 3, then 3, 2, 1.
          {canManage ? " Move people with the arrows." : ""}
        </p>
        <ol className="border-b border-border">
          {state.draftOrder.map((pid, i) => {
            const p = StateLogic.getPlayer(state, pid);
            if (!p) return null;
            return (
              <li key={pid} className="flex min-h-12 items-center gap-3 border-t border-border">
                <span className="type-num w-6 text-center text-[24px] text-muted-foreground">{i + 1}</span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
                {pid === me && <YouBadge />}
                {canManage && (
                  <span className="flex shrink-0">
                    <OrderArrow label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ChevronUp className="size-5" aria-hidden />
                    </OrderArrow>
                    <OrderArrow label={`Move ${p.name} down`} disabled={i === state.draftOrder.length - 1} onClick={() => move(i, 1)}>
                      <ChevronDown className="size-5" aria-hidden />
                    </OrderArrow>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {canManage && <StartDraftButton state={state} />}

      <CastPreview state={state} />
    </div>
  );
}

/** The cast before the draft, collapsed: something to look over while you wait. */
export function CastPreview({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const [open, setOpen] = useState(false);
  const cast = sortByTribe(state.castaways.filter((c) => c.status === "active"), state);
  const names = shortNames(cast);
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center justify-between gap-3 text-left"
      >
        <span className="type-caption text-[24px]">The {terms.castaways}</span>
        <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
          {cast.length}
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <TileGrid>
          {cast.map((c) => (
            <CastTile key={c.id} castaway={c} label={names.get(c.id)!} state={state} photoHeight={64} />
          ))}
        </TileGrid>
      )}
    </section>
  );
}

function OrderArrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-[3px] text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line disabled:opacity-25"
    >
      {children}
    </button>
  );
}

export function LiveDraft({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const me = useMyPlayerId();
  const mutate = useMutate();
  // The selection belongs to one pick: once that pick's made (by anyone), it's gone.
  const [sel, setSel] = useState<{ pick: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const turn = StateLogic.currentDraftTurn(state);
  const fa = sortByTribe(StateLogic.freeAgents(state), state);
  const { shown, chips } = useTribeFilter(fa, state);
  const names = shortNames(fa);
  if (!turn || turn.isComplete || !turn.playerId) return null;

  const pickNo = turn.overallPickNumber!;
  const order = state.draftOrder;
  const n = order.length;
  const size = StateLogic.rosterSize(state);
  const myTurn = turn.playerId === me;
  const canPick = myTurn || canManage;
  const turnName = StateLogic.getPlayer(state, turn.playerId)?.name ?? "?";
  const selected = sel && sel.pick === pickNo && fa.some((c) => c.id === sel.id) ? StateLogic.getCastaway(state, sel.id) : null;

  // Back-to-back picks at the turn of a snake round.
  const nextOwner = snakePickOwner(order, pickNo);
  const twoInRow = nextOwner === turn.playerId && pickNo < n * size;
  const after = (() => {
    for (let i = pickNo; i < n * size; i++) {
      const o = snakePickOwner(order, i);
      if (o !== turn.playerId) return o;
    }
    return undefined;
  })();
  const myNext = me && !myTurn ? picksLeftFor(state, me, pickNo - 1)[0] : undefined;

  let subtitle: string;
  if (myTurn) subtitle = [twoInRow ? "Two in a row." : null, after ? `Then ${whoName(state, after, me)}.` : "Last pick of the draft."].filter(Boolean).join(" ");
  else if (myNext) subtitle = myNext - pickNo === 1 ? "You're next." : `You pick at ${myNext}, ${myNext - pickNo} picks away.`;
  else subtitle = canManage ? "You can pick for them." : after ? `Then ${whoName(state, after, me)}.` : "Last pick of the draft.";

  // A window on the order: the last pick made, this one, and the next few.
  const strip: number[] = [];
  for (let i = Math.max(0, pickNo - 2); i < Math.min(n * size, pickNo + 4); i++) strip.push(i);

  const mine = me ? state.castaways.filter((c) => c.ownerIds.includes(me)) : [];
  const myLeft = me ? picksLeftFor(state, me, pickNo - 1) : [];

  async function draft() {
    if (!selected || busy) return;
    setBusy(true);
    const id = selected.id;
    const ok = await mutate(
      (s) => StateLogic.draftToCurrentTurn(s, id),
      () => api.draftPick(leagueId!, id)
    );
    setBusy(false);
    if (ok) setSel(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <CaptionPlate
        tone={myTurn ? "chyron" : "quiet"}
        tag={
          <>
            On the
            <br />
            clock
          </>
        }
        title={myTurn ? (twoInRow ? `You · picks ${pickNo} and ${pickNo + 1}` : `You · pick ${pickNo}`) : `${turnName} · pick ${pickNo}`}
        subtitle={subtitle}
      />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] nav:mx-0 nav:px-0" aria-label="Pick order">
        {strip.map((i) => {
          const owner = snakePickOwner(order, i);
          return (
            <TurnPill key={i} you={owner === me} now={i === pickNo - 1} done={i < pickNo - 1}>
              <b className="type-num text-[15px]">{i + 1}</b>
              {whoName(state, owner, me)}
            </TurnPill>
          );
        })}
      </div>

      {me && order.includes(me) ? (
        <section className="flex flex-col gap-2">
          <SectionHead aside={<BoardLink />}>
            Your roster · {mine.length} of {size}
          </SectionHead>
          <div className="grid grid-cols-[repeat(7,40px)] justify-between gap-y-1.5 nav:flex nav:flex-wrap nav:justify-start nav:gap-2">
            {mine.map((c) => (
              <PhotoSquare key={c.id} castaway={c} expandable />
            ))}
            {myLeft.map((p) => (
              <EmptySlot key={p}>{p}</EmptySlot>
            ))}
          </div>
        </section>
      ) : (
        <SectionHead aside={<BoardLink />}>Free agents · {fa.length}</SectionHead>
      )}

      {chips}

      {fa.length === 0 ? (
        <p className="text-base text-muted-foreground">No {terms.castaways} left to pick.</p>
      ) : (
        <TileGrid>
          {shown.map((c) => (
            <CastTile
              key={c.id}
              castaway={c}
              label={names.get(c.id)!}
              state={state}
              mark={selected?.id === c.id ? "add" : undefined}
              onClick={canPick ? () => setSel(selected?.id === c.id ? null : { pick: pickNo, id: c.id }) : undefined}
            />
          ))}
        </TileGrid>
      )}

      {canPick ? (
        <ConfirmBar
          note={`Pick ${pickNo}${myTurn ? "" : ` · for ${turnName}`}${selected ? " · selected" : ""}`}
          title={selected ? selected.name : `Choose a ${terms.castaway}`}
        >
          <BarButton onClick={draft} disabled={!selected || busy}>
            {selected ? (myTurn ? `Draft ${names.get(selected.id)}` : `Draft for ${turnName}`) : "Draft"}
          </BarButton>
        </ConfirmBar>
      ) : (
        <ConfirmBar note="On the clock" title={`${turnName} · pick ${pickNo}`} />
      )}
    </div>
  );
}

function BoardLink() {
  return (
    <Link href="/draft/board" className="flex min-h-11 items-end gap-0.5 pb-1.5 text-sm font-semibold text-foreground hover:underline">
      Board
      <ChevronRight className="mb-px size-4" strokeWidth={2.4} aria-hidden />
    </Link>
  );
}

export function DraftComplete({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const size = StateLogic.rosterSize(state);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {/* No Overview / Episodes buttons: the tab bar has both. */}
        <CaptionPlate tone="good" tag="Done" title="Draft complete" subtitle={`Every team has ${size} ${size === 1 ? terms.castaway : terms.castaways}.`} />
      </div>
      <section className="flex flex-col gap-3">
        <SectionHead
          aside={
            <Link href="/draft/board" className="-my-3 py-3 text-sm font-semibold text-chyron-line hover:underline">
              Board
            </Link>
          }
        >
          Teams
        </SectionHead>
        <DraftTeams state={state} />
      </section>
    </div>
  );
}

/** Commissioner only, behind ⋯ → Edit picks: every pick as a row with Undraft. */
export function EditPicks({ state, onDone }: { state: LeagueState; onDone: () => void }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const me = useMyPlayerId();

  async function undraft(castawayId: string, name: string, owner: string) {
    if (!(await confirm(`Undraft ${name}? They go back to the free agents and ${owner} gets the pick back.`, { confirmLabel: "Undraft" }))) return;
    await mutate(
      (s) => StateLogic.undraft(s, castawayId),
      () => api.undraft(leagueId!, castawayId)
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <CaptionPlate tone="quiet" tag="Edit" title="Edit picks" subtitle={`Undraft puts a ${terms.castaway} back in the pool.`} />
      {playersInDraftOrder(state).map((p) => {
        const picks = StateLogic.originalDraftPicks(state, p.id).filter((c) => c.ownerIds.includes(p.id) && c.status === "active");
        return (
          <section key={p.id} className="flex flex-col">
            <div className="flex min-h-9 items-center gap-2 pb-1">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
              {p.id === me && <YouBadge />}
            </div>
            {picks.length === 0 ? (
              <p className="border-t border-border py-3 text-sm text-muted-foreground">Nothing to undraft.</p>
            ) : (
              <ul className="border-b border-border">
                {picks.map((c) => (
                  <li key={c.id} className="flex min-h-14 items-center gap-3 border-t border-border">
                    <PhotoSquare castaway={c} />
                    <span className="min-w-0 flex-1 truncate text-base font-semibold">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => undraft(c.id, c.name, p.name)}
                      className="min-h-11 shrink-0 rounded-[3px] border border-input px-3 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line"
                    >
                      Undraft
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <PlainButton onClick={onDone}>Done</PlainButton>
    </div>
  );
}
