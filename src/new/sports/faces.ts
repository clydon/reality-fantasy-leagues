"use client";

import { useMemo } from "react";
import type { GameView } from "@/lib/game/game-view";
import { useRoster } from "../data";

// A face carries its qualifier (docs/PLAN-start-a-game-gpt.md Decisions, 2026-11-08; U1's sports slice): a sport's people take
// their position from the season's roster (season_cast.role: ESPN's, "WR", "1B", "G"), matched by name as the cast is, onto the
// game's faces, so every face the page and its sheets draw says it beside their team or state.
export function useWithRoles(g: GameView | null, seasonId: string, sport: boolean): GameView | null {
  const roster = useRoster(seasonId, sport && !!g);
  return useMemo(() => {
    if (!g || !sport || !roster.data) return g;
    const roles = new Map<string, string>();
    for (const grp of roster.data.groups) for (const p of grp.people) if (p.role) roles.set(p.name.toLowerCase(), p.role);
    if (!roles.size) return g;
    return { ...g, cast: g.cast.map((c) => ({ ...c, role: roles.get(c.name.toLowerCase()) ?? c.role ?? null })) };
  }, [g, sport, roster.data]);
}
