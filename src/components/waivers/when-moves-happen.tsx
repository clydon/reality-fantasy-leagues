"use client";

import type { CSSProperties } from "react";
import type { LeagueState, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { SectionHead } from "@/components/draft/draft-ui";
import { cn } from "cn";
import { latestEpisode, swapPhrase } from "./waivers-words";

// "When moves happen" (the canvas's quiet-week boards): a Replace lane and a Swap lane over episode
// columns, so a player sees the league's rhythm at a glance instead of reading it. A pattern, not a
// calendar -- the season's length isn't known -- so it's ten columns from two before the latest
// episode, sliding along the season and fading out on the right. Past columns are what happened (a
// window the commissioner opened shows there); future ones are the schedule, or, where the
// commissioner decides, one dashed run.

type Cell = "open" | "short" | "none" | "decides";
const COLUMNS = 10;

/** `compact`: under an action (claims open, processed, hidden): the lanes and legend, without the sentence. */
export function WhenMovesHappen({ state, compact = false }: { state: LeagueState; compact?: boolean }) {
  const W = StateLogic.WaiverLogic;
  const rule = W.replaceRule(state);
  const w = W.windows(state);
  const R = StateLogic.rosterSize(state);
  const latest = latestEpisode(state);
  const start = StateLogic.startEpisode(state);
  const first = Math.max(start, latest - 2);
  const cols = Array.from({ length: COLUMNS }, (_, i) => first + i);
  const manual = w.schedule === "manual";
  const byEpisode = new Map<number, WaiverPeriod>(W.periods(state).filter((p) => !p.hidden).map((p) => [p.episode, p]));

  // What happened (past) or what the schedule says (future), after each episode.
  const replaceCell = (n: number): Cell => {
    const p = n <= latest ? byEpisode.get(n) : undefined;
    if (p) return W.windowReplaces(state, p) ? (rule === "whenShort" && p.replace !== true ? "short" : "open") : "none";
    if (n <= latest) return "none";
    if (rule === "always") return "open";
    if (rule === "whenShort") return "short";
    if (rule === "windows") return manual ? "decides" : W.isWindowEpisode(state, n) ? "open" : "none";
    return "none";
  };
  const swapCell = (n: number): Cell => {
    const p = n <= latest ? byEpisode.get(n) : undefined;
    if (p) return W.isWindow(p) && W.swapsAllowed(p) > 0 ? "open" : "none";
    if (n <= latest) return "none";
    if (manual) return "decides";
    return W.isAddDropEpisode(state, n) ? "open" : "none";
  };
  const replace = cols.map(replaceCell);
  const swap = cols.map(swapCell);
  const used = new Set([...replace, ...swap]);

  // One sentence: what the lanes say.
  const n = swapPhrase(w.swaps, R).replace(/^Swap /, "");
  const replaceText =
    rule === "always"
      ? "Replace anyone voted out after any episode."
      : rule === "whenShort"
        ? `Replace once you're down to ${W.shortAt(state)} still in.`
        : rule === "windows" && !manual
          ? "Replace anyone voted out at each waiver window."
          : rule === "never"
            ? "No replacements."
            : "";
  const swapText = manual
    ? "Swaps when your commissioner opens a waiver window."
    : w.swaps <= 0
      ? ""
      : w.schedule === "everyEpisode"
        ? `Swap ${n} after any episode.`
        : `Swap ${n} every ${w.every} episodes.`;
  const summary =
    manual && (rule === "windows" || rule === "never")
      ? `Nothing moves until your commissioner opens a waiver window.${rule === "never" ? " Out is out otherwise." : ""}`
      : [replaceText, swapText].filter(Boolean).join(" ");

  const legend: { label: string; style: CSSProperties }[] = [];
  if (used.has("open")) legend.push({ label: manual ? "Opened" : "Open", style: SWATCH.open });
  if (used.has("short")) legend.push({ label: "Only if you're short", style: SWATCH.short });
  if (used.has("decides")) legend.push({ label: "Your commissioner decides", style: SWATCH.decides });
  legend.push({ label: "Latest episode", style: { width: 14, height: 3, background: "var(--chyron-line)" } });

  const lane = (cells: Cell[], label: string, runLabel?: string) => {
    // A run of "decides" columns at the end is one dashed bar.
    const run = cells.findIndex((c, i) => c === "decides" && cells.slice(i).every((x) => x === "decides"));
    const shown = run < 0 ? cells : cells.slice(0, run);
    return (
      <div className="contents">
        <span className="self-center text-[13px] font-semibold">{label}</span>
        {shown.map((c, i) => (
          <span key={i} className={cn("self-center", cols[i] <= latest && "opacity-45")} style={c === "none" ? EMPTY : { ...CELL, ...SWATCH[c] }} />
        ))}
        {run >= 0 && (
          <span
            className="flex h-7 items-center overflow-hidden whitespace-nowrap rounded-[2px] border-[1.5px] border-dashed border-muted-foreground pl-2 text-xs font-semibold text-muted-foreground"
            style={{ gridColumn: `span ${cells.length - run}` }}
          >
            {runLabel}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHead>When moves happen</SectionHead>
      <figure className="relative m-0 grid grid-cols-[62px_repeat(10,minmax(0,1fr))] gap-x-[3px] gap-y-1.5" aria-label={summary}>
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.025em] text-muted-foreground">After ep</span>
        {cols.map((c) => (
          <span key={c} className={cn("type-num text-center text-[12px]", c === latest ? "text-foreground" : "text-muted-foreground")}>
            {c}
          </span>
        ))}
        {lane(replace, "Replace", replace.includes("decides") ? "Commissioner opens one" : undefined)}
        {lane(swap, "Swap", replace.includes("decides") ? undefined : "Commissioner opens one")}
        <span />
        {cols.map((c) => (
          <span key={c} className="h-[3px] self-center rounded-[1px]" style={c === latest ? { background: "var(--chyron-line)" } : undefined} />
        ))}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-r from-transparent to-background" />
      </figure>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground" aria-hidden>
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span style={{ width: 14, height: 14, borderRadius: 2, ...l.style }} />
            {l.label}
          </span>
        ))}
      </div>
      {!compact && <p className="pt-1 text-sm leading-[1.45]">{summary}</p>}
    </section>
  );
}

const CELL: CSSProperties = { height: 28, borderRadius: 2 };
const EMPTY: CSSProperties = { height: 4, borderRadius: 2, background: "var(--border)" };
const SWATCH: Record<Exclude<Cell, "none">, CSSProperties> = {
  open: { background: "var(--foreground)" },
  short: { background: "repeating-linear-gradient(135deg, var(--foreground) 0 3px, transparent 3px 7px)", boxShadow: "inset 0 0 0 1.5px var(--foreground)" },
  decides: { border: "1.5px dashed var(--muted-foreground)" },
};
