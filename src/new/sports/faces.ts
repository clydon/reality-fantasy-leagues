"use client";

import { useMemo } from "react";
import type { GameView } from "@/lib/game/game-view";
import { useRoster } from "../data";
import { castName, first } from "../show/moves";

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
    // The game's own position for a face first (stamped per person: two players who share a name have their own), the roster's
    // by name only where the game has none.
    return { ...g, cast: g.cast.map((c) => ({ ...c, role: c.role ?? roles.get(c.name.toLowerCase()) ?? null })) };
  }, [g, sport, roster.data]);
}

/**
 * Names for a sheet that reads its own faces (the draft room, the waivers sheets: BACKLOG 88), as the game page names them:
 * `name(n)` an athlete by surname and a defense by its nickname, with an initial only when two in `cast` would read the same
 * (castName); `role(n)` their position ("WR"). A show's cast keeps its first names and no position, as before.
 */
export function useCastNames(seasonId: string, sport: boolean, cast: { name: string }[]) {
  const roster = useRoster(seasonId, sport);
  return useMemo(() => {
    const roles = new Map<string, string>();
    if (sport) for (const grp of roster.data?.groups ?? []) for (const p of grp.people) if (p.role) roles.set(p.name.toLowerCase(), p.role);
    const role = (n: string | null | undefined) => (n ? (roles.get(n.toLowerCase()) ?? null) : null);
    const g = { cast: cast.map((c) => ({ name: c.name, role: role(c.name) })) };
    const name = (n: string | null | undefined) => (!n ? "" : sport ? castName({ name: n, role: role(n) }, g) : first(n));
    return { name, role };
  }, [sport, roster.data, cast]);
}
