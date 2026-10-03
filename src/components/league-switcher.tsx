"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLeagueStore } from "@/lib/store";
import { LeagueMenu } from "@/components/league-menu";
import { ChevronDownIcon, CrownIcon } from "@/components/icons";
import { cn } from "cn";
import { useClickOutside } from "@/lib/use-click-outside";

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
      {/* Its linked group's name (0047), small, above the league's own. */}
      {currentLeague?.group && (
        <div className="truncate text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{currentLeague.group.name}</div>
      )}
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
          <LeagueMenu
            leagues={leagues}
            leagueId={leagueId}
            onSelect={handleSelect}
            onJoinOrCreate={() => {
              setOpen(false);
              router.push("/dashboard");
            }}
          />
        </div>
      )}
    </div>
  );
}
