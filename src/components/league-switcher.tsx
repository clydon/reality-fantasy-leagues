"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLeagueStore, type LeagueSummary } from "@/lib/store";
import { api } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

// /api/auth/me doesn't return each league's settings (just id/name/join_code/role), so the
// league-type badge shown per row is resolved lazily on first open, not from the initial fetch --
// fine at friend-group scale (a handful of leagues per user), not built to scale further than
// that. Shared by both the desktop switcher below and MobileNav's own top-bar dropdown, which
// needs the same lazy-fetch-and-cache logic but its own layout (see CLAUDE.md: mobile chrome
// stays a separate component from desktop, not duplicated logic).
export function useLeagueTypeBadges(leagues: LeagueSummary[]) {
  const [types, setTypes] = useState<Record<string, string>>({});
  async function resolve() {
    const missing = leagues.filter((l) => !(l.id in types));
    if (missing.length === 0) return;
    const results = await Promise.all(
      missing.map(async (l) => {
        try {
          const { state } = await api.leagueState(l.id);
          return [l.id, StateLogic.getLeagueType(state).name] as const;
        } catch {
          return [l.id, "?"] as const;
        }
      })
    );
    setTypes((prev) => ({ ...prev, ...Object.fromEntries(results) }));
  }
  return { types, resolve };
}

// New in this POC -- the live app's "My Leagues" dashboard lets you switch leagues by going back
// to a full separate screen (renderDashboard()); this is the inline equivalent for a single-league
// app shell, needed now that testing a second league (to try a future league type against) is an
// actual workflow, not just a hypothetical. `leagues` (GET /api/auth/me) was already being fetched
// by AuthGate and thrown away after picking [0] -- see store.ts's loadFirstLeague.
export function LeagueSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const leagues = useLeagueStore((s) => s.leagues);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const { types, resolve } = useLeagueTypeBadges(leagues);

  function handleOpen() {
    setOpen((o) => !o);
    resolve();
  }

  async function handleSelect(id: string) {
    setOpen(false);
    if (id === leagueId) return;
    await switchLeague(id);
  }

  if (leagues.length === 0) return null;

  return (
    <div className="relative px-2.5 pb-3.5 pt-0.5">
      <button
        className="flex w-full items-center gap-1.5 break-words text-left text-[0.95rem] font-bold text-foreground"
        onClick={handleOpen}
      >
        <span className="min-w-0 flex-1 truncate">{leagueName}</span>
        <span className={cn("shrink-0 text-xs text-muted-foreground transition-transform", open && "rotate-180")}>▾</span>
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
                {types[l.id] && (
                  <Badge variant="secondary" className="shrink-0 text-[0.65rem]">
                    {types[l.id]}
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{l.role}</span>
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
