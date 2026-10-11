"use client";

import { useState } from "react";
import { create } from "zustand";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "cn";

// A late joiner's one reminder that they're not watching live (StateLogic.GhostLogic,
// docs/PLAN-late-joiners.md). Everything else on their screens looks exactly like the league does
// for anyone else -- the league just ends at their week. Like a broadcast's corner bug:
//
//   REPLAY · EP 4   catching up, on episode 4
//   OFF AIR         caught up, but the league can't see them yet (a ghost)
//
// Tapping it opens the catch-up sheet: where they are, and "Jump to the latest episode", which asks
// a second time and says exactly what it will show before it does anything.

export interface LateJoinStatus {
  catchingUp: boolean;
  ghost: boolean;
  /** The episode they're playing now (their mark + 1). */
  week: number;
  /** The league's latest episode with results. */
  latest: number;
  startEpisode: number | null;
}

/** The viewer's late-join status, or null for anyone else. */
export function useLateJoin(): LateJoinStatus | null {
  const raw = useLeagueStore((s) => s.rawState);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? 0);
  const mode = useLeagueStore((s) => s.mode);
  if (mode !== "live" || !me) return null;
  const late = StateLogic.GhostLogic.lateJoinOf(raw, me);
  const ghost = StateLogic.GhostLogic.isGhost(StateLogic.getPlayer(raw, me));
  if (!late || late.startEpisode === null || (!late.catchingUp && !ghost)) return null;
  return { catchingUp: late.catchingUp, ghost, week: seen + 1, latest: StateLogic.SpoilerLogic.latestWithResults(raw), startEpisode: late.startEpisode };
}

const useCatchUpSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** The bug. `header` sits in the mobile top bar (where chat would be: late joiners have none). */
export function ReplayBug({ variant = "header", className }: { variant?: "header" | "page"; className?: string }) {
  const status = useLateJoin();
  const setOpen = useCatchUpSheet((s) => s.setOpen);
  if (!status) return null;
  const label = status.catchingUp ? `Replay, episode ${status.week}. Catching up` : "Off air. The league can't see you yet";
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      className={cn(
        "type-caption inline-flex shrink-0 items-stretch overflow-hidden rounded-[2px] leading-none shadow-plate focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
        variant === "header" ? "h-7 justify-self-end text-[13px]" : "h-8 text-[14px]",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 bg-plate px-2 tracking-[0.06em] text-plate-foreground">
        {/* The broadcast's live/record dot: red while replaying, hollow when off air. */}
        <span
          aria-hidden
          className={cn("size-[7px] rounded-full", status.catchingUp ? "bg-live" : "border-[1.5px] border-plate-muted")}
        />
        {status.catchingUp ? "Replay" : "Off air"}
      </span>
      {status.catchingUp && (
        <span className="flex items-center bg-chyron pl-1.5 pr-2 tracking-[0.04em] text-chyron-foreground [clip-path:polygon(6px_0,100%_0,100%_100%,0_100%)]">
          Ep {status.week}
        </span>
      )}
    </button>
  );
}

/** The catch-up sheet, mounted once in AuthGate's shell. */
export function CatchUpSheet() {
  const status = useLateJoin();
  const open = useCatchUpSheet((s) => s.open);
  const setOpen = useCatchUpSheet((s) => s.setOpen);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  if (!status) return null;
  const { week, latest, catchingUp, ghost } = status;
  const behind = Math.max(0, latest - week + 1);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={confirming ? `Jump to episode ${latest}?` : catchingUp ? "You're catching up" : "You're off air"}
      hideCancel
    >
      {confirming ? (
        <>
          <p className="text-[15px] leading-snug text-muted-foreground">
            This reveals {behind === 1 ? `episode ${week}` : `episodes ${week} to ${latest}`} all at once: who went home, every score and
            the standings. If you haven&rsquo;t watched {behind === 1 ? "it" : "them"}, {behind === 1 ? "it" : "they"} will be spoiled.
          </p>
          <p className="mt-3 text-[15px] leading-snug text-muted-foreground">
            You won&rsquo;t get to make picks or set a lineup for {behind === 1 ? "it" : "the episodes you skip"}. You can&rsquo;t go back.
          </p>
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={close}
              className="min-h-12 flex-[1.4] rounded-[3px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              Keep catching up
            </button>
            <button
              type="button"
              onClick={() => {
                markResultsSeen(latest, { jump: true });
                close();
              }}
              className="min-h-12 flex-1 rounded-[3px] border border-live px-3 text-[15px] font-bold text-live hover:bg-live/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              Reveal through {latest}
            </button>
          </div>
        </>
      ) : (
        <>
          {catchingUp ? (
            <>
              <Progress status={status} />
              <p className="mt-4 text-[15px] leading-snug text-muted-foreground">
                You&rsquo;re playing episode {week} as if it airs tonight. Make your picks, watch it, then reveal it. Nothing after it exists
                here until you do, so nothing can spoil it.
              </p>
            </>
          ) : (
            <p className="text-[15px] leading-snug text-muted-foreground">You&rsquo;re caught up and playing live, alongside the league.</p>
          )}
          {ghost && (
            <p className="mt-3 text-[15px] leading-snug text-muted-foreground">
              The league can&rsquo;t see you yet: you&rsquo;re on your own scoreboard, they aren&rsquo;t told you&rsquo;re here, and chat opens
              once your commissioner adds you.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={close}
              className="min-h-12 rounded-[3px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              {catchingUp ? `Back to episode ${week}` : "Done"}
            </button>
            {catchingUp && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-12 rounded-[3px] border border-input bg-card text-[15px] font-bold text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
              >
                Jump to the latest episode
              </button>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

/** Episodes from their start to the latest, as a strip: watched, this week, still to come. */
function Progress({ status }: { status: LateJoinStatus }) {
  const from = status.startEpisode ?? 1;
  const eps: number[] = [];
  for (let n = from; n <= status.latest; n++) eps.push(n);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="type-caption text-[17px]">Episode {status.week}</span>
        <span className="type-num text-[13px] text-muted-foreground">
          {status.week - from} of {status.latest - from + 1} watched
        </span>
      </div>
      <div className="mt-2 flex gap-[3px]" aria-hidden>
        {eps.map((n) => (
          <span
            key={n}
            className={cn("h-2 flex-1 rounded-[1px]", n < status.week ? "bg-foreground" : n === status.week ? "bg-chyron" : "bg-input")}
          />
        ))}
      </div>
    </div>
  );
}

/** Whether the viewer's choice for this week (a lineup or a pick) is still missing, for the reveal's warning. */
export function weekChoiceMissing(state: LeagueState, me: string, episode: number): "lineup" | "pick" | null {
  const ep = state.episodes.find((e) => e.number === episode);
  if (!ep) return null;
  const type = StateLogic.getLeagueType(state);
  if (type.hasActiveRoster) {
    const owned = state.castaways.filter((c) => c.ownerIds.includes(me) && c.status !== "eliminated").length;
    const need = Math.min(StateLogic.ActiveRosterLogic.activeSlots(state), owned);
    return StateLogic.activeRosterLineupFor(state, ep.id, me).length < need ? "lineup" : null;
  }
  if (type.id === "pickem") return StateLogic.pickEmPickFor(state, ep.id, me) ? null : "pick";
  return null;
}
