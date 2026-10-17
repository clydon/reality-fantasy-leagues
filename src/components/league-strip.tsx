"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { api } from "@/lib/api";
import { useShowCatalog } from "@/lib/use-show-terms";
import { useSwipeProgress, useSwitchLinked } from "@/components/league-swipe";
import { cn } from "cn";

// Linked groups under one name (docs/PLAN-league-tabs.md): the group's name is the header's, and the
// league strip under it picks the game -- one chip per game, by type, the open one in the You fill, a
// red dot on any other game that needs you. Swiping between games stays (league-swipe.tsx); the pill
// follows the finger. An unlinked league (or a group you're in only one game of) has no strip, and its
// header keeps the league's own name.

const SHORT_TYPE: Record<string, string> = { "Eliminator Pool": "Pool" };
const GAP = 6; // px between chips

export interface LinkedGame {
  id: string;
  label: string;
  /** "Classic · Survivor 51": Overview's line under the group name. */
  detail: string;
}

/** The open league's linked group as the header shows it, or null when it isn't in one with you. From
 *  /api/me's league list, which has each group's leagues together in the order its commissioner set
 *  (the swipe's order too), so the header has it on first paint. */
export function useLinkedGroup(): { name: string; games: LinkedGame[]; index: number } | null {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagues = useLeagueStore((s) => s.leagues);
  const season = useLeagueStore((s) => s.state.settings.wikiSeason);
  const { data: catalog } = useShowCatalog();
  const here = mode === "live" ? leagues.find((l) => l.id === leagueId) : undefined;
  if (!here?.group) return null;
  const rows = leagues.filter((l) => l.group?.id === here.group!.id);
  if (rows.length < 2) return null;
  const index = rows.indexOf(here);
  const name = here.group.name;
  const games = rows.map((l) => {
    // Two games of one type (two Classics): the type can't tell them apart, so each goes by its own name.
    const twin = rows.some((o) => o.id !== l.id && o.type === l.type);
    const show = catalog?.shows.find((s) => s.slug === l.showId)?.name;
    const showSeason = [show, season].filter((x) => x != null && x !== "").join(" ");
    return {
      id: l.id,
      label: twin ? l.name : (SHORT_TYPE[l.type] ?? l.type),
      // The group's name is often the show and season already (league-groups.ts's fallback).
      detail: [twin ? l.name : l.type, showSeason !== name && showSeason].filter(Boolean).join(" · "),
    };
  });
  return { name, games, index };
}

/** Which of your other leagues have something due (the alert strip's own list, /api/me/actions). */
function useNeedsYou(): Set<string> {
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  const { data } = useQuery({
    queryKey: ["my-actions"],
    queryFn: () => api.myActions(),
    enabled: isAuthenticated && !previewingDemo,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  return new Set((data?.items ?? []).filter((it) => it.kind !== "invite").map((it) => it.leagueId));
}

export function LeagueStrip({ className, wrap }: { className?: string; /** Labels may take two lines (the desktop sidebar's narrow rail). */ wrap?: boolean }) {
  const group = useLinkedGroup();
  const pathname = usePathname();
  const needsYou = useNeedsYou();
  const { progress, dragging } = useSwipeProgress();
  const { open } = useSwitchLinked();
  // A tapped chip's game is fetched before it opens; the pill goes there at once.
  const [pending, setPending] = useState<string | null>(null);
  const leagueId = useLeagueStore((s) => s.leagueId);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tapped game has opened
    setPending(null);
  }, [leagueId]);
  if (!group) return null;
  const { games, index } = group;
  const n = games.length;
  const pendingIndex = pending ? games.findIndex((g) => g.id === pending) : -1;
  // Where the pill sits, in chips: between two while a swipe is under way (-1 progress = fully on the next).
  const pos = pendingIndex >= 0 ? pendingIndex : Math.max(0, Math.min(n - 1, index - Math.max(-1, Math.min(1, progress))));
  // Following a finger, no animation; settling, a tap, or a swipe let go, it slides.
  const following = dragging && progress !== 0;
  const w = `((100% - ${(n - 1) * GAP}px) / ${n})`;
  // Only transform moves (it used to animate `left` and `clip-path`, which lay the strip out again on every
  // frame). The pill is `w` wide, so one of its own widths plus a gap is exactly the step to the next chip;
  // the ink labels sit in a layer as wide as the whole strip and are carried back by the same distance, so
  // they stay put while the pill passes over them. Both layers share one transition, so the two cancel at
  // every frame, mid-swipe included.
  const slide = following ? "transition-none" : "transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.3,1)] motion-reduce:transition-none";
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: GAP };

  async function choose(id: string) {
    if (id === leagueId || pending) return;
    setPending(id);
    try {
      await open(id, pathname);
    } catch {
      setPending(null);
    }
  }

  const label = (g: LinkedGame, i: number) => (
    <>
      <span className={wrap ? "line-clamp-2 leading-tight" : "truncate"}>{g.label}</span>
      {i !== index && needsYou.has(g.id) && <span className="size-[7px] shrink-0 rounded-full bg-destructive" />}
    </>
  );
  const chip = "flex min-h-10 min-w-0 items-center justify-center gap-1.5 px-1.5 py-1 text-center text-[13px]";

  return (
    // The padding is the wrapper's: the pill is placed in fractions of the grid's own width.
    <div className={className}>
      <div className="relative grid" style={cols} role="group" aria-label={`${group.name}: games`}>
        {games.map((g, i) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={i === index}
            aria-label={needsYou.has(g.id) && i !== index ? `${g.label}, needs you` : g.label}
            onClick={() => choose(g.id)}
            className={cn(
              chip,
              "rounded-[3px] border border-border bg-background font-medium text-foreground outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
            )}
          >
            {label(g, i)}
          </button>
        ))}
        {/* The open game: a You-fill pill over its chip, and the same labels again in the fill's ink, cut
            to the pill (it clips them) -- so mid-swipe each chip reads right on either side of the pill's edge. */}
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-[3px] bg-foreground", slide)}
          style={{ width: `calc(${w})`, transform: `translateX(calc(${pos} * (100% + ${GAP}px)))` }}
        >
          <div
            className={cn("absolute inset-y-0 left-0 grid font-semibold text-background", slide)}
            style={{ ...cols, width: `calc(${n} * 100% + ${(n - 1) * GAP}px)`, transform: `translateX(calc(${-pos} * (100% + ${GAP}px) / ${n}))` }}
          >
            {games.map((g, i) => (
              <span key={g.id} className={cn(chip, "border border-transparent")}>
                {label(g, i)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
