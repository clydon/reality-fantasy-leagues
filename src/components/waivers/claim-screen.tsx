"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Plus } from "lucide-react";
import type { Castaway, LeagueState, WaiverClaim, WaiverPair, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { PhotoSquare, SectionHead } from "@/components/draft/draft-ui";
import { cn } from "cn";
import { Note } from "./waivers-ui";
import { claimGroups, isShared, ordinal, placeInLine, useCastNames, useWaiversBase, viewerWeek, when, type ClaimSave } from "./waivers-model";
import { latestEpisode, nextWindow, swapPhrase } from "./waivers-words";

// The claim screen (docs/PLAN-waivers-v2.md "2A"; the "Waivers v2 options" canvas): your team, with
// Replace on each castaway who's out and Swap on each still in, then your claims grouped by spot -- one
// group per replacement, then the swaps -- so it reads that you get one per spot and the rest are
// backups. Shared ownership shows the team only: nobody can lose a free agent to anyone, so there's
// nothing to rank.

type Week = ReturnType<typeof viewerWeek>;

/** A castaway's points so far, as the team rows show them (Classic: outlasting; Active Roster: events). */
export function castawayPts(state: LeagueState, c: Castaway): number {
  return StateLogic.getLeagueType(state).hasActiveRoster
    ? StateLogic.WaiverLogic.castawayPoints(state, c.id)
    : StateLogic.EliminationOrderScoringStrategy.castawayPoints(state, c);
}

/** The player's castaways out of the game and not yet replaced (not the winner), oldest first. */
export function unreplaced(state: LeagueState, me: string): Castaway[] {
  const winner = StateLogic.formatOf(state).winnerExitMethod;
  return state.castaways
    .filter((c) => c.ownerIds.includes(me) && c.status === "eliminated" && !c.replenishClaimed && c.exitMethod !== winner)
    .sort((a, b) => (a.placementOrder ?? 0) - (b.placementOrder ?? 0));
}

export const claimHref = (base: string, dropId: string, forId?: string | null) =>
  `${base}/claim?drop=${encodeURIComponent(dropId)}${forId ? `&for=${encodeURIComponent(forId)}` : ""}`;

// ---- The top line ----

export interface PlateProps {
  tag: string;
  tone: "chyron" | "good" | "quiet" | "live";
  title: string;
  subtitle?: string;
}

/** An open week with something to do: "REPLACE PATT · SWAP 1 / Due Tue 8:05 PM · you're 3rd in line". */
export function openPlate(state: LeagueState, period: WaiverPeriod, me: string, w: Week, now: number, name: (id: string) => string): PlateProps {
  const R = StateLogic.rosterSize(state);
  const losses = w.owed.lossIds;
  const replace = losses.length === 0 ? "" : losses.length <= 2 ? `Replace ${losses.map(name).join(" and ")}` : `Replace ${losses.length}`;
  const swap = w.swapsLeft > 0 ? swapPhrase(w.swapsAllowed >= R ? R : w.swapsLeft, R) : "";
  const due = period.hold ? "Due when your commissioner says" : `Due ${when(period.processAt, now)}`;
  const pos = placeInLine(state, me);
  const line = isShared(state) ? "you get who you pick" : pos ? `you're ${ordinal(pos)} in line` : "";
  return {
    tag: w.claimIn ? "In" : StateLogic.WaiverLogic.isWindow(period) ? "Window" : "Waivers",
    tone: w.claimIn ? "good" : "chyron",
    title: [replace, swap].filter(Boolean).join(" · "),
    subtitle: [w.claimIn ? due.replace(/^Due/, "Change until") : due, line].filter(Boolean).join(" · "),
  };
}

/** A week with nothing to do (or between weeks): why, and when that changes ("The top line in other weeks"). */
export function quietPlate(state: LeagueState, me: string | null, name: (id: string) => string): PlateProps {
  const W = StateLogic.WaiverLogic;
  const rule = W.replaceRule(state);
  const manual = W.windows(state).schedule === "manual";
  const latest = latestEpisode(state);
  const nextSwap = nextWindow(state, latest, true);
  const nextAny = nextWindow(state, latest, false);
  const swapLine = manual ? "Your commissioner opens waiver windows" : nextSwap ? `Next swap window: after Episode ${nextSwap}` : "";
  const quiet = (title: string, subtitle?: string): PlateProps => ({ tag: "Waivers", tone: "quiet", title, subtitle: subtitle || undefined });
  if (StateLogic.MidSeasonLogic.seasonOver(state) && latest > 0) return quiet("No more waivers this season", "Nobody's left in the game to claim.");
  const lost = me ? unreplaced(state, me) : [];
  const names = lost.length <= 2 ? lost.map((c) => name(c.id)).join(" and ") : `${lost.length} of yours`;
  if (lost.length && rule === "windows")
    return quiet(
      `${names} ${lost.length === 1 ? "waits" : "wait"} for a window`,
      manual || !nextAny ? "Replaceable when your commissioner opens a waiver window." : `Replaceable after Episode ${nextAny}. On your team till then.`,
    );
  if (lost.length && rule === "whenShort" && me) {
    const inGame = StateLogic.MidSeasonLogic.inGameCount(state, me);
    return quiet(`${inGame} still in: enough to start`, `Replacements start when you're down to ${W.shortAt(state)}.`);
  }
  if (lost.length && rule === "never") return quiet("Out is out in this league", [`${names} ${lost.length === 1 ? "stays" : "stay"} on your team.`, swapLine && `${swapLine}.`].filter(Boolean).join(" "));
  return quiet("Nothing to do this week", swapLine);
}

// ---- Your team ----

/**
 * Every castaway on your team: Replace on one you may replace, Swap on one still in while you have a
 * swap left. `href(dropId)` is where each goes (the claim picker, or free agency once claims have
 * processed). Shared: a castaway with a pick saved shows it ("Sharonda for Patt · Joins your team Tue
 * 8:05 PM") with Change.
 */
export function YourTeam({
  state,
  me,
  w,
  claim,
  href,
  joins,
  heading = "Your team",
}: {
  state: LeagueState;
  me: string;
  w: Week;
  claim?: WaiverClaim;
  href: (dropId: string) => string;
  /** Shared, claims open: when a pick joins ("Tue 8:05 PM"). */
  joins?: string;
  heading?: string;
}) {
  const name = useCastNames(state);
  const shared = isShared(state);
  const winner = StateLogic.formatOf(state).winnerExitMethod;
  const team = state.castaways
    .filter((c) => c.ownerIds.includes(me) && c.exitMethod !== winner && !(c.status !== "active" && c.replenishClaimed))
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || castawayPts(state, b) - castawayPts(state, a));
  const pairs = claim?.pairs ?? [];
  const swapsPlanned = new Set(pairs.filter((x) => StateLogic.getCastaway(state, x.dropId)?.status === "active").map((x) => x.dropId));
  const canSwap = (c: Castaway) => w.swapsLeft > 0 && (!shared || swapsPlanned.has(c.id) || swapsPlanned.size < w.swapsLeft);
  return (
    <section className="flex flex-col">
      <SectionHead
        aside={
          w.swapsAllowed > 0 && (
            <span className="flex items-center gap-1.5 pb-1.5 text-[13px] text-muted-foreground">
              Swaps allowed
              <span className="type-num flex h-6 min-w-6 items-center justify-center rounded-[3px] bg-foreground px-1.5 text-[16px] text-background">
                {w.swapsAllowed >= StateLogic.rosterSize(state) ? "All" : w.swapsLeft}
              </span>
            </span>
          )
        }
      >
        {heading}
      </SectionHead>
      <ul className="border-t border-border">
        {team.map((c, i) => {
          const out = c.status !== "active";
          const replaceable = out && w.owed.lossIds.includes(c.id);
          const pick = shared ? pairs.find((x) => x.dropId === c.id) : undefined;
          const pts = castawayPts(state, c);
          const action = replaceable ? "Replace" : !out && canSwap(c) ? "Swap" : null;
          return (
            <li key={c.id} className="grid min-h-[62px] grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2">
              {pick ? (
                <span className="relative">
                  <PhotoSquare castaway={StateLogic.getCastaway(state, pick.addId)!} size={46} />
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-[3px] shadow-[0_0_0_2px_var(--background)]">
                    <PhotoSquare castaway={c} size={24} faded />
                  </span>
                </span>
              ) : (
                <PhotoSquare castaway={c} size={46} faded={out} />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 truncate text-base font-semibold">
                  {pick ? (
                    <>
                      {name(pick.addId)} <span className="font-normal text-muted-foreground">for {name(c.id)}</span>
                    </>
                  ) : (
                    <>
                      {name(c.id)}
                      {out && <span className="rounded-[2px] bg-live px-1.5 py-px text-[11px] font-bold uppercase tracking-[0.025em] text-live-foreground">Out</span>}
                    </>
                  )}
                </span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {pick ? (joins ? `Joins your team ${joins}` : "Joins your team when claims are due") : out ? `Their ${pts} pts stay${!replaceable && w.owed.lossIds.length ? " · no replacement yet" : ""}` : `${pts} pts`}
                </span>
              </span>
              {action && (
                <Link
                  href={href(c.id)}
                  data-tour={replaceable && i === team.findIndex((x) => w.owed.lossIds.includes(x.id)) ? "waivers-pickup" : undefined}
                  className="flex min-h-11 min-w-[88px] items-center justify-center rounded-[6px] border border-input px-3 text-sm font-bold text-foreground hover:bg-secondary focus-visible:outline-3 focus-visible:outline-chyron-line"
                >
                  {pick ? "Change" : action}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---- Your claims, grouped by spot ----

/**
 * The ranked claims, one group per spot: "REPLACING PATT · You get 1" (first choice, then backups), then
 * "SWAP · 1 ALLOWED · You get 1". A row's grip drags it up or down its group; tapping the grip opens a
 * sheet with Move up, Move down and Remove. Each group ends with "+ Add a backup".
 */
export function YourClaims({
  state,
  period,
  me,
  w,
  claim,
  save,
  now,
}: {
  state: LeagueState;
  period: WaiverPeriod;
  me: string;
  w: Week;
  claim: WaiverClaim;
  save: (input: ClaimSave) => Promise<string | null>;
  now: number;
}) {
  const router = useRouter();
  const base = useWaiversBase();
  const name = useCastNames(state);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ group: number; i: number } | null>(null);
  const [whoOpen, setWhoOpen] = useState(false);
  const g = claimGroups(state, period, me, claim.pairs);
  // Groups as lists of pairs: each replacement, then the swaps.
  const groups: WaiverPair[][] = [
    ...g.replacements.map((r) => r.adds.map((addId) => ({ addId, dropId: r.dropId }))),
    ...(w.swapsLeft > 0 || g.swaps.length ? [g.swaps] : []),
  ];
  // Only groups with claims in them show: for a spot with none, the team's Replace or Swap is the way in.
  const isSwapGroup = (k: number) => k >= g.replacements.length;
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const team = state.castaways.filter((c) => c.ownerIds.includes(me) && c.status === "active");

  async function commit(next: WaiverPair[][]) {
    setBusy(true);
    setError(null);
    const err = await save({ pairs: next.flat() });
    setBusy(false);
    if (err) setError(err);
  }
  const move = (k: number, from: number, to: number) => {
    if (to < 0 || to >= groups[k].length || to === from) return;
    const next = groups.map((x) => [...x]);
    const [it] = next[k].splice(from, 1);
    next[k].splice(to, 0, it);
    commit(next);
  };
  const remove = (k: number, i: number) => commit(groups.map((x, j) => (j === k ? x.filter((_, n) => n !== i) : x)));

  if (!claim.pairs.length) return null;
  const pts = (id: string) => {
    const c = StateLogic.getCastaway(state, id);
    return c ? castawayPts(state, c) : 0;
  };
  const allowed = w.swapsAllowed >= StateLogic.rosterSize(state) ? "All" : String(w.swapsAllowed);
  const open = sheet ? groups[sheet.group]?.[sheet.i] : undefined;
  const sheetTitle = !open || !sheet ? "" : isSwapGroup(sheet.group) ? `${name(open.addId)} for ${name(open.dropId)}` : name(open.addId);
  return (
    <section className="flex flex-col">
      <SectionHead>Your claims</SectionHead>
      {groups.map((list, k) => {
        if (!list.length) return null;
        const swapGroup = isSwapGroup(k);
        const get = swapGroup ? w.swapsLeft : 1;
        return (
          <div key={swapGroup ? "swap" : list[0].dropId} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3 pb-1 pt-3.5">
              <h3 className="type-caption text-[19px]">{swapGroup ? `Swap · ${allowed} allowed` : `Replacing ${name(list[0].dropId)}`}</h3>
              <span className="text-[13px] text-muted-foreground">You get {get >= StateLogic.rosterSize(state) ? "any" : get}</span>
            </div>
            <ReorderList
              items={list}
              keyOf={(x) => `${x.addId}|${x.dropId}`}
              onMove={(from, to) => move(k, from, to)}
              onTap={(i) => setSheet({ group: k, i })}
              disabled={busy}
              row={(x, i) => {
                const first = i === 0;
                const detail = swapGroup
                  ? [
                      first ? "First choice" : i < get ? "Also" : i === 1 ? `Only if ${name(list[0].addId)}'s taken` : "If those above don't go",
                      first && `${name(x.dropId)}'s ${pts(x.dropId)} pts go`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : first
                    ? "First choice"
                    : i === 1
                      ? `If ${name(list[0].addId)}'s taken`
                      : "If those above are taken";
                const add = StateLogic.getCastaway(state, x.addId);
                const drop = StateLogic.getCastaway(state, x.dropId);
                return (
                  <>
                    <span className="type-num text-center text-[22px]">{i + 1}</span>
                    {swapGroup && add && drop ? (
                      <span className="relative">
                        <PhotoSquare castaway={add} size={40} />
                        <span className="absolute -bottom-1.5 -right-1.5 rounded-[3px] shadow-[0_0_0_2px_var(--background)]">
                          <PhotoSquare castaway={drop} size={22} />
                        </span>
                      </span>
                    ) : (
                      add && <PhotoSquare castaway={add} size={40} />
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-base font-semibold">{swapGroup ? `${name(x.addId)} for ${name(x.dropId)}` : name(x.addId)}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{detail}</span>
                    </span>
                  </>
                );
              }}
            />
            {swapGroup ? (
              <button type="button" onClick={() => setWhoOpen(true)} className={ADD_BACKUP}>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                Add a backup
              </button>
            ) : (
              <Link href={claimHref(base, list[0].dropId)} className={ADD_BACKUP}>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                Add a backup
              </Link>
            )}
          </div>
        );
      })}
      {error && <p className="pt-2 font-semibold text-live">{error}</p>}
      <Note className="pt-3 text-[13px]">
        {fa ? `Then free agency until airtime${period.closesAt ? `, ${when(period.closesAt, now, true)}` : ""}.` : "No free agency after: these are your claims for the week."}
      </Note>

      <BottomSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        title={sheetTitle}
      >
        {sheet && (
          <div className="flex flex-col">
            {sheet.i > 0 && (
              <SheetAction
                onClick={() => {
                  move(sheet.group, sheet.i, sheet.i - 1);
                  setSheet(null);
                }}
              >
                Move up
              </SheetAction>
            )}
            {sheet.i < (groups[sheet.group]?.length ?? 0) - 1 && (
              <SheetAction
                onClick={() => {
                  move(sheet.group, sheet.i, sheet.i + 1);
                  setSheet(null);
                }}
              >
                Move down
              </SheetAction>
            )}
            <SheetAction
              danger
              onClick={() => {
                remove(sheet.group, sheet.i);
                setSheet(null);
              }}
            >
              Remove
            </SheetAction>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={whoOpen} onOpenChange={setWhoOpen} title="Swap who?">
        <div className="flex flex-col">
          {team.map((c) => (
            <SheetAction
              key={c.id}
              detail={`${castawayPts(state, c)} pts`}
              onClick={() => {
                setWhoOpen(false);
                router.push(claimHref(base, c.id));
              }}
            >
              {name(c.id)}
            </SheetAction>
          ))}
        </div>
      </BottomSheet>
    </section>
  );
}

const ADD_BACKUP =
  "flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-chyron-line hover:underline focus-visible:outline-3 focus-visible:outline-chyron-line";

/**
 * Rows a grip can drag up or down. A tap on the grip (no drag) is `onTap`, which keyboard users get too:
 * the grip is a real button. While dragging, the row follows the finger and the others make room.
 */
function ReorderList<T>({
  items,
  keyOf,
  row,
  onMove,
  onTap,
  disabled,
}: {
  items: T[];
  keyOf: (x: T) => string;
  row: (x: T, i: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  onTap: (i: number) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<{ i: number; dy: number; h: number } | null>(null);
  const start = useRef<{ y: number; i: number; h: number; dy: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const target = (d: { i: number; dy: number; h: number }) => Math.max(0, Math.min(items.length - 1, d.i + Math.round(d.dy / d.h)));
  const down = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || items.length < 2) return;
    const li = e.currentTarget.closest("li");
    start.current = { y: e.clientY, i, h: li ? li.getBoundingClientRect().height : 58, dy: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveTo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    s.dy = e.clientY - s.y;
    if (Math.abs(s.dy) > 6) s.moved = true;
    if (s.moved) setDrag({ i: s.i, dy: s.dy, h: s.h });
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s || !s.moved) return;
    moved.current = true;
    const to = target(s);
    if (to !== s.i) onMove(s.i, to);
  };
  const shift = (i: number) => {
    if (!drag) return undefined;
    if (i === drag.i) return { transform: `translateY(${drag.dy}px)`, zIndex: 1, position: "relative" as const };
    const to = target(drag);
    if (drag.i < i && i <= to) return { transform: `translateY(${-drag.h}px)` };
    if (to <= i && i < drag.i) return { transform: `translateY(${drag.h}px)` };
    return undefined;
  };
  return (
    <ol className="border-t border-border">
      {items.map((x, i) => (
        <li
          key={keyOf(x)}
          style={shift(i)}
          className={cn(
            "grid min-h-[58px] grid-cols-[22px_40px_minmax(0,1fr)_44px] items-center gap-2.5 border-b border-border bg-background py-1.5",
            drag && drag.i !== i && "transition-transform duration-150",
            drag?.i === i && "shadow-plate",
          )}
        >
          {row(x, i)}
          <button
            type="button"
            aria-label="Move or remove"
            disabled={disabled}
            onPointerDown={down(i)}
            onPointerMove={moveTo}
            onPointerUp={up}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
            onClick={() => {
              if (moved.current) {
                moved.current = false;
                return;
              }
              onTap(i);
            }}
            className="flex size-11 touch-none items-center justify-center rounded-[3px] text-muted-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line disabled:opacity-50"
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        </li>
      ))}
    </ol>
  );
}
