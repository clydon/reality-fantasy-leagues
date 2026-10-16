"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import type { Castaway, LeagueState, MidSeasonLogEntry, WaiverPeriod, WaiverResult } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { PhotoSquare } from "@/components/draft/draft-ui";
import { ShuffleIcon } from "@/components/icons";
import { cn } from "cn";
import { dayOf, freeAgencyUntil, isShared, nextEpisodeAirs, playerName, resultWhy, txLabel, useCastNames, when } from "./waivers-model";

// The pieces every Waivers board shares (the "Mid-Season Moves" canvas, boards 1-10 and 13).

export function YouBadge() {
  return <span className="shrink-0 rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>;
}

export function Dot({ color }: { color?: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color ?? "var(--muted-foreground)" }} aria-hidden />;
}

/** A small status chip: "Claims in" (good) or "Not yet" (quiet). */
export function Chip({ tone = "quiet", children }: { tone?: "good" | "quiet"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[2px] px-[7px] py-0.5 text-xs font-bold leading-[1.3]",
        tone === "good" ? "bg-good text-good-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-[1.45] text-muted-foreground", className)}>{children}</p>;
}

/**
 * The week in four steps, as a broadcast's running order: results in, claims, waivers process, free
 * agency. The step that's on now is chyron, filled as far as its time has gone.
 */
export function WeekStrip({ state, period, now, lock }: { state: LeagueState; period: WaiverPeriod; now: number; lock?: boolean }) {
  const processed = period.phase !== "open";
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const { n, airsAt } = nextEpisodeAirs(state, period);
  const frac = (from: string | null | undefined, to: string | null | undefined) => {
    const a = from ? Date.parse(from) : NaN;
    const b = to ? Date.parse(to) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0.5;
    return Math.min(1, Math.max(0.08, (now - a) / (b - a)));
  };
  const steps: { label: string; text: string; at: "done" | "now" | "next"; fill?: number }[] = [
    { label: dayOf(period.openedAt, now), text: `Episode ${period.episode} results in`, at: "done" },
    processed
      ? { label: `Until ${dayOf(period.processAt, now)}`, text: "Claims", at: "done" }
      : { label: "Now", text: "Make your claims", at: "now", fill: frac(period.openedAt, period.processAt) },
    { label: when(processed ? period.run?.at ?? period.processAt : period.processAt, now, true), text: processed ? "Waivers processed" : "Waivers process", at: processed ? "done" : "next" },
    fa
      ? {
          label: processed ? "Now" : period.closesAt ? `Till ${when(period.closesAt, now, true)}` : `Till Ep ${n} results`,
          text: lock ? "Free agency, then lock" : "Free agency",
          at: processed ? "now" : "next",
          fill: processed ? frac(period.run?.at, period.closesAt) : undefined,
        }
      : { label: airsAt ? when(airsAt, now, true) : `Episode ${n}`, text: `Episode ${n} airs`, at: "next" },
  ];
  const nowAt = steps.findIndex((s) => s.at === "now");
  return (
    <ol className="flex gap-1" aria-label={`This week's waivers, step ${nowAt + 1} of 4`}>
      {steps.map((s, i) => (
        <li key={i} className="flex min-w-0 flex-1 flex-col gap-[7px]" aria-current={s.at === "now" ? "step" : undefined}>
          <span
            className="h-1 rounded-[1px] bg-input"
            style={
              s.at === "done"
                ? { background: "var(--chyron-line)" }
                : s.at === "now"
                  ? { background: `linear-gradient(90deg, var(--chyron-line) 0 ${Math.round((s.fill ?? 0.4) * 100)}%, var(--input) ${Math.round((s.fill ?? 0.4) * 100)}% 100%)` }
                  : undefined
            }
          />
          <span className={cn("text-[11px] font-bold uppercase leading-[1.2] tracking-[0.03em]", s.at === "now" ? "text-chyron-line" : "text-muted-foreground")}>
            {s.label}
          </span>
          <span className="text-[13px] leading-[1.3] text-foreground">{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** A section's "How waivers work" link (opens the sheet). */
export function AsideLink({ onClick, href, children }: { onClick?: () => void; href?: string; children: ReactNode }) {
  const cls = "pb-1.5 text-sm font-semibold text-chyron-line hover:underline focus-visible:outline-3 focus-visible:outline-chyron-line";
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** The waiver order, first to last; `chip` says something about each (claims in, moved up). */
export function OrderList({ state, ids, me, chip }: { state: LeagueState; ids: string[]; me: string | null; chip?: (id: string) => ReactNode }) {
  return (
    <ol>
      {ids.map((id, i) => {
        const p = StateLogic.getPlayer(state, id);
        const mine = id === me;
        return (
          <li
            key={id}
            className={cn("flex min-h-12 items-center gap-3 border-b border-border py-1 pl-1 pr-2", mine && "rounded-[3px] border-transparent bg-card")}
          >
            <span className="type-num w-[22px] text-center text-[24px] text-muted-foreground">{i + 1}</span>
            <Dot color={p?.color} />
            <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
              <span className="truncate">{p?.name ?? "?"}</span>
              {mine && <YouBadge />}
            </span>
            {chip?.(id)}
          </li>
        );
      })}
    </ol>
  );
}

/** "Kim, then you, Andrew, Josie and Dee" -- the order as one sentence, for when it isn't the point. */
export function orderSentence(state: LeagueState, ids: string[], me: string | null): string {
  const names = ids.map((id) => playerName(state, id, me));
  if (names.length <= 1) return names[0] ?? "";
  return `${names[0][0].toUpperCase()}${names[0].slice(1)}, then ${names.slice(1, -1).join(", ")}${names.length > 2 ? " and " : ""}${names[names.length - 1]}`;
}

/** A row that opens something: icon or face, a title, a line under it, then whatever's on the end. */
export function LinkRow({
  href,
  lead,
  title,
  detail,
  end,
  hot,
  tour,
}: {
  href?: string;
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  /** The detail line is the thing to do: chyron. */
  hot?: boolean;
  /** A `data-tour` name, for the guided tour to light it. */
  tour?: string;
}) {
  const body = (
    <>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold leading-[1.3]">{title}</span>
        {detail && <span className={cn("text-[13px] leading-[1.3]", hot ? "text-chyron-line" : "text-muted-foreground")}>{detail}</span>}
      </span>
      {end}
      {href && <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 border-b border-border py-2 text-foreground";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-accent/40 focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-chyron-line")} data-tour={tour}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function SwapGlyph() {
  return (
    <span className="flex size-[46px] shrink-0 items-center justify-center rounded-[3px] border border-border bg-card text-muted-foreground" aria-hidden>
      <ShuffleIcon className="size-[22px]" />
    </span>
  );
}

/** A claim's castaway as a small photo with its place in the list (or a red cross: dropping them). */
export function Mini({ c, n, drop }: { c: Castaway | undefined; n?: number; drop?: boolean }) {
  if (!c) return null;
  return (
    <PhotoSquare
      castaway={c}
      size={34}
      badge={
        drop ? (
          <span className="absolute -bottom-1.5 -right-1.5 flex size-[17px] items-center justify-center rounded-full bg-live text-white shadow-[0_0_0_2px_var(--background)]" aria-hidden>
            <X className="size-2.5" strokeWidth={4} />
          </span>
        ) : n !== undefined ? (
          <span className="type-num absolute -bottom-1.5 -right-1.5 flex size-[17px] items-center justify-center rounded-full bg-foreground text-[11px] text-background shadow-[0_0_0_2px_var(--background)]" aria-hidden>
            {n}
          </span>
        ) : undefined
      }
    />
  );
}

/** Out (faded) → in: a pickup or add/drop as two photos. */
export function Pair({ state, from, to, out }: { state: LeagueState; from: string | null | undefined; to: string | null | undefined; out?: boolean }) {
  const a = from ? StateLogic.getCastaway(state, from) : undefined;
  const b = to ? StateLogic.getCastaway(state, to) : undefined;
  return (
    <span className="flex shrink-0 items-center gap-[5px]">
      {a && <PhotoSquare castaway={a} size={36} faded={out} expandable />}
      {a && b && <ArrowRight className="size-3.5 text-muted-foreground" strokeWidth={2.4} aria-label={out ? "replaced by" : "swapped for"} />}
      {b && <PhotoSquare castaway={b} size={36} expandable />}
    </span>
  );
}

/** Completed pickups and add/drops, newest first. */
export function TxRows({ state, entries, me }: { state: LeagueState; entries: MidSeasonLogEntry[]; me: string | null }) {
  if (!entries.length) return null;
  return (
    <ul className="border-t border-border">
      {entries.map((tx) => {
        const p = StateLogic.getPlayer(state, tx.playerId);
        return (
          <li key={tx.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2">
            <Dot color={p?.color} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-semibold leading-[1.3]">
                <span className="truncate">{p?.name ?? "?"}</span>
                {tx.playerId === me && <YouBadge />}
              </span>
              <span className="text-[13px] leading-[1.3] text-muted-foreground">{txLabel(tx)}</span>
            </span>
            <Pair state={state} from={tx.droppedCastawayId} to={tx.addedCastawayId} out={tx.type === "replenish"} />
          </li>
        );
      })}
    </ul>
  );
}

/** One week's run, as the canvas's Results board: pickups, then add/drops, each in waiver order, and why. */
export function RunResults({ state, period, me }: { state: LeagueState; period: WaiverPeriod; me: string | null }) {
  const name = useCastNames(state);
  const run = period.run;
  if (!run) return null;
  const rank = (id: string) => run.orderBefore.indexOf(id) + 1;
  // Shared: the order decided nothing, so it isn't numbered.
  const numbered = !isShared(state);
  const byOrder = (a: WaiverResult, b: WaiverResult) => rank(a.playerId) - rank(b.playerId);
  const pickups = run.results.filter((r) => r.kind === "pickup").sort(byOrder);
  const addDrops = run.results.filter((r) => r.kind === "addDrop").sort(byOrder);
  const row = (r: WaiverResult, i: number) => {
    const p = StateLogic.getPlayer(state, r.playerId);
    const mine = r.playerId === me;
    return (
      <li
        key={`${r.kind}-${r.playerId}-${i}`}
        className={cn(
          "grid min-h-[66px] grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border py-2.5",
          mine && "my-0.5 rounded-[3px] border-transparent bg-card pr-2",
        )}
      >
        <span className="type-num text-center text-[22px] text-muted-foreground">{numbered ? rank(r.playerId) : ""}</span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="flex items-center gap-2 font-semibold leading-[1.3]">
            <Dot color={p?.color} />
            <span className="truncate">{p?.name ?? "?"}</span>
            {mine && <YouBadge />}
          </span>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{resultWhy(state, r, me, name)}</span>
        </span>
        {r.outcome === "got" ? (
          <Pair state={state} from={r.droppedCastawayId} to={r.castawayId} out={r.kind === "pickup"} />
        ) : (
          <span className="pr-1 text-[13px] text-muted-foreground">No change</span>
        )}
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {pickups.length > 0 && (
        <>
          <h4 className="type-caption mt-1.5 text-[15px] text-muted-foreground">Pickups</h4>
          <ol className="border-t border-border">{pickups.map(row)}</ol>
        </>
      )}
      {addDrops.length > 0 && (
        <>
          <h4 className="type-caption mt-1.5 text-[15px] text-muted-foreground">Add/drops</h4>
          <ol className="border-t border-border">{addDrops.map(row)}</ol>
        </>
      )}
      {pickups.length === 0 && addDrops.length === 0 && <Note>Nobody was owed a pickup, and add/drops weren&rsquo;t open.</Note>}
    </div>
  );
}

/** The order after a run, with how far each moved. */
export function OrderAfterRun({ state, period, me }: { state: LeagueState; period: WaiverPeriod; me: string | null }) {
  const run = period.run;
  if (!run) return null;
  return (
    <OrderList
      state={state}
      ids={run.orderAfter}
      me={me}
      chip={(id) => {
        const moved = run.orderBefore.indexOf(id) - run.orderAfter.indexOf(id);
        if (run.orderBefore.indexOf(id) < 0 || moved === 0) return <span className="text-[13px] text-muted-foreground">No change</span>;
        return <span className={cn("text-[13px]", moved > 0 ? "font-semibold text-good" : "text-muted-foreground")}>{moved > 0 ? `Up ${moved}` : `Down ${-moved}`}</span>;
      }}
    />
  );
}

/** "Free agency until Wed 8 PM", for plates. */
export function faTitle(state: LeagueState, period: WaiverPeriod, now: number) {
  return period.closesAt ? `Free agency until ${when(period.closesAt, now, true)}` : `Free agency until Episode ${period.episode + 1}'s results`;
}
export { freeAgencyUntil };
