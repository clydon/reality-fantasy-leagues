"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { momentTags } from "@/lib/game/formats/index.js";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { cn } from "cn";

// Research's ranking (research-tab.tsx): every castaway's own points over a window of recent episodes,
// or how often one scoring rule happened for them. Shared with the waiver claim picker, which ranks free
// agents with the same two controls: the window (Season · Last 5 · Last 3 · Last ep) and "Ranked by".

export type Window = "season" | "5" | "3" | "1";
export const WINDOWS: [Window, string][] = [
  ["season", "Season"],
  ["5", "Last 5"],
  ["3", "Last 3"],
  ["1", "Last ep"],
];

export interface EpisodeLine {
  n: number;
  points: number;
  /** Still in the game for it. */
  played: boolean;
  events: { type: string; label: string; points: number }[];
  /** Safe moments this episode (tagged safety: see hasSafety), counted even where the league scores them 0. */
  safe: number;
}

export interface Row {
  c: Castaway;
  points: number;
  /** Safe moments across the window. */
  safety: number;
  played: number;
  avg: number;
  perEpisode: EpisodeLine[];
}

export type Rule = { type: string; label: string; points: number };

/** Episodes revealed to this viewer that have results, oldest first -- optionally including ones
 *  before the league's start episode, which score for nobody but are still how a castaway played. */
export function airedEpisodes(state: LeagueState, includePreseason: boolean) {
  return [...state.episodes]
    .filter((ep) => StateLogic.RevealLogic.isRevealed(state, ep.number))
    .filter((ep) => includePreseason || StateLogic.inPlay(state, ep.number))
    .filter((ep) => ep.events.length > 0 || StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0)
    .sort((a, b) => a.number - b.number);
}

export function buildRows(state: LeagueState, aired: LeagueState["episodes"], window: Window): Row[] {
  const format = StateLogic.formatOf(state);
  const defs = format.events;
  const label = (type: string) => defs.find((d) => d.id === type)?.label ?? type;
  const tagsOf = momentTags(format);
  const inWindow = window === "season" ? aired : aired.slice(-Number(window));
  const rank = eventRank(state);

  // The episode each castaway left in (they played it, then no more).
  const exitEp: Record<string, number> = {};
  for (const ep of state.episodes) for (const ev of ep.events) exitEp[ev.castawayId] = Math.min(exitEp[ev.castawayId] ?? Infinity, ep.number);

  return state.castaways.map((c) => {
    const perEpisode: EpisodeLine[] = inWindow.map((ep) => {
      const line: EpisodeLine = { n: ep.number, points: 0, played: !(exitEp[c.id] < ep.number), events: [], safe: 0 };
      for (const sev of StateLogic.ActiveRosterLogic.episodeEvents(state, ep)) {
        if (sev.castawayId !== c.id) continue;
        if (tagsOf(sev.type).includes("safety")) line.safe++;
        const pts = StateLogic.ActiveRosterLogic.eventPoints(state, sev);
        line.points = StateLogic.roundPoints(line.points + pts);
        // An event this league scores at 0 is noise in the breakdown.
        if (pts !== 0) line.events.push({ type: sev.type, label: label(sev.type), points: pts });
      }
      // In the show's own order (its scoring groups), so an episode reads the same way every week.
      line.events.sort((a, b) => rank(a.type) - rank(b.type));
      return line;
    });
    const points = StateLogic.roundPoints(perEpisode.reduce((s, e) => s + e.points, 0));
    const played = perEpisode.filter((e) => e.played).length;
    const safety = perEpisode.reduce((s, e) => s + e.safe, 0);
    return { c, points, safety, played, avg: played ? points / played : 0, perEpisode };
  });
}

/** What keeps someone off the chopping block, for an Eliminator Pool where surviving beats scoring: the moments tagged
 *  safety (formats/moment-tags.js), Survivor's individual immunity, Tribal with no votes against, and votes survived. A
 *  show whose rules have none has no Safety ranking. */
export const SAFETY_RULE_ID = "__safety";
export const SAFETY_RULE: Rule = { type: SAFETY_RULE_ID, label: "Safety", points: 0 };
export function hasSafety(state: LeagueState): boolean {
  const format = StateLogic.formatOf(state);
  const tagsOf = momentTags(format);
  return format.events.some((d: { id: string }) => tagsOf(d.id).includes("safety"));
}

/** Where an event sits in the show's scoring groups (format.eventCategories, the League Scoring
 *  table's order): group * 1000 + its place in the group. Events in no group come last. */
export function eventRank(state: LeagueState) {
  const f = StateLogic.formatOf(state);
  const cats: { events: string[] }[] = f.eventCategories ?? [];
  const order = new Map<string, number>();
  cats.forEach((c, g) => c.events.forEach((id, k) => order.set(id, g * 1000 + k)));
  const fallback = (type: string) => 999_000 + Math.max(0, f.events.findIndex((d: { id: string }) => d.id === type));
  return (type: string) => order.get(type) ?? fallback(type);
}

/** The rules that happened at least once in these rows, in the show's own order: what you can rank by. */
export function rulesIn(state: LeagueState, rows: Row[]): Rule[] {
  const rank = eventRank(state);
  return [...new Map(rows.flatMap((r) => r.perEpisode.flatMap((e) => e.events.map((x) => [x.type, x] as const)))).values()].sort(
    (a, b) => rank(a.type) - rank(b.type),
  );
}

/** How many times `rule` happened for a castaway in the window. */
export function timesOf(r: Row, rule: Rule): number {
  return r.perEpisode.reduce((n, e) => n + e.events.filter((x) => x.type === rule.type).length, 0);
}

/** The window segmented control: only windows shorter than what's aired ("Last 5" of three is the season). */
export function WindowTabs({ windows, value, onChange }: { windows: [Window, string][]; value: Window; onChange: (w: Window) => void }) {
  if (windows.length < 2) return null;
  return (
    <div role="tablist" aria-label="Which episodes" className="flex rounded-[3px] bg-card p-[3px]">
      {windows.map(([w, label]) => (
        <button
          key={w}
          role="tab"
          aria-selected={value === w}
          className={cn("min-h-10 flex-1 rounded-[2px] text-sm font-semibold", value === w ? "bg-foreground font-bold text-background" : "text-foreground hover:bg-muted")}
          onClick={() => onChange(w)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "RANKED BY Points ▾": what the ranking counts, tap to change it (a sheet of the window's rules). */
export function RankedBy({
  rules,
  rule,
  pointsLabel = "Points",
  onChange,
  className,
}: {
  rules: Rule[];
  rule: Rule | null;
  pointsLabel?: string;
  onChange: (type: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "-ml-1 flex min-h-11 min-w-0 items-center gap-1 rounded-[2px] px-1 text-left text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground outline-none hover:text-foreground focus-visible:bg-accent",
          className,
        )}
      >
        <span className="shrink-0">Ranked by</span>
        <span className={cn("truncate text-[13px] normal-case tracking-normal", rule ? "text-chyron-line" : "text-foreground")}>{rule ? rule.label : pointsLabel}</span>
        <ChevronDown className="size-4 shrink-0" strokeWidth={2.4} aria-hidden />
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Rank by">
        <SheetAction
          detail={!rule ? "Showing" : undefined}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          {pointsLabel}
        </SheetAction>
        {rules.map((x) => (
          <SheetAction
            key={x.type}
            detail={rule?.type === x.type ? "Showing" : undefined}
            onClick={() => {
              onChange(x.type);
              setOpen(false);
            }}
          >
            {x.label}
          </SheetAction>
        ))}
      </BottomSheet>
    </>
  );
}

/**
 * The ranking as state: the window, the rule, and every castaway's row in it. For the claim picker (the
 * window isn't remembered there; Research remembers its own).
 */
export function useRanking(state: LeagueState) {
  const [window, setWindow] = useState<Window>("season");
  const [rankBy, setRankBy] = useState<string | null>(null);
  const aired = useMemo(() => airedEpisodes(state, StateLogic.startEpisode(state) <= 1), [state]);
  const windows = WINDOWS.filter(([w]) => w === "season" || Number(w) < aired.length);
  const shownWindow = windows.some(([w]) => w === window) ? window : "season";
  const rows = useMemo(() => buildRows(state, aired, shownWindow), [state, aired, shownWindow]);
  const rules = rulesIn(state, rows);
  const rule = rankBy ? rules.find((x) => x.type === rankBy) ?? null : null;
  const byId = new Map(rows.map((r) => [r.c.id, r]));
  return { windows, window: shownWindow, setWindow, rules, rule, setRankBy, row: (id: string) => byId.get(id) ?? null, scored: aired.length > 0 };
}
