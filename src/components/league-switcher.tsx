"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLeagueStore, type LeagueSummary } from "@/lib/store";
import { useShowCatalog } from "@/lib/use-show-terms";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, CrownIcon } from "@/components/icons";
import { cn } from "cn";
import { useClickOutside } from "@/lib/use-click-outside";

// Type badge and show name per row, both derived from /api/me's own league list (which also
// arrives already sorted) -- no per-league fetch, so nothing re-sorts or pops in after open.
// Shared by the desktop switcher below and MobileNav's own top-bar dropdown.
export function useLeagueTypeBadges(leagues: LeagueSummary[]) {
  const { data: catalog } = useShowCatalog();
  const types = Object.fromEntries(leagues.map((l) => [l.id, l.type]));
  const showNames = Object.fromEntries(
    leagues.map((l) => [l.id, catalog?.shows.find((s) => s.slug === l.showId)?.name ?? null])
  );
  return { types, showNames };
}

// New in this POC -- the live app's "My Leagues" dashboard lets you switch leagues by going back
// to a full separate screen (renderDashboard()); this is the inline equivalent for a single-league
// app shell, needed now that testing a second league (to try a future league type against) is an
// actual workflow, not just a hypothetical. `leagues` (GET /api/auth/me) was already being fetched
// by AuthGate and thrown away after picking [0] -- see store.ts's loadFirstLeague.
// `open` / `onOpenChange` let the sidebar's logo open it too; without them it manages itself.
export function LeagueSwitcher({ open: openProp, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenState(value);
    onOpenChange?.(value);
  };
  const leagues = useLeagueStore((s) => s.leagues);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const { types, showNames } = useLeagueTypeBadges(leagues);
  const currentLeague = leagues.find((l) => l.id === leagueId);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, open, () => setOpen(false));

  function handleOpen() {
    setOpen((o) => !o);
  }

  async function handleSelect(id: string) {
    setOpen(false);
    if (id === leagueId) return;
    await switchLeague(id);
    // Always land on Overview after switching -- whatever tab you were on may not exist, or mean
    // something different, in the new league (e.g. Mid-Season isn't shown for every league type).
    router.push("/");
  }

  if (leagues.length === 0) return null;

  return (
    <div ref={rootRef} className="relative px-2.5 pb-3.5 pt-0.5">
      <button
        className="flex w-full items-center gap-1.5 text-left text-[0.95rem] font-bold text-foreground"
        onClick={handleOpen}
      >
        {currentLeague?.role === "commissioner" && (
          <CrownIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}
        <span className="min-w-0 flex-1 truncate">{leagueName}</span>
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-2.5 right-2.5 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md">
          {leagues.map((l) => (
            <button
              key={l.id}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-secondary",
                l.id === leagueId && "bg-secondary"
              )}
              onClick={() => handleSelect(l.id)}
            >
              <span className="flex w-full items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</span>
                {showNames[l.id] && (
                  <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{showNames[l.id]}</span>
                )}
              </span>
              {(types[l.id] || l.role === "commissioner") && (
                <span className="flex flex-wrap items-center gap-1">
                  {types[l.id] && (
                    <Badge variant="secondary" className="text-[0.65rem]">
                      {types[l.id]}
                    </Badge>
                  )}
                  {l.role === "commissioner" && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600">
                      <CrownIcon className="h-3 w-3 shrink-0" />
                      Commissioner
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
          <button
            className="mt-1 flex w-full items-center rounded-md border-t border-border px-2.5 pb-1 pt-2 text-left text-sm font-semibold text-primary hover:bg-secondary"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard");
            }}
          >
            + Join or create a league
          </button>
        </div>
      )}
    </div>
  );
}
