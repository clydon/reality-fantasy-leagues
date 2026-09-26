"use client";

import { useEffect, useState } from "react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayStatCard } from "@/components/castaway-stat-card";

const HIDE_ELIMINATED_KEY = "board-hide-eliminated";

// Direct port of renderBoardGrid() (public/app.js) -- grouped by tribe, one card per castaway, in a
// bordered card shell matching every other Overview section (this was the one section that didn't
// have it).
//
// Tribe grouping always reads the castaway's CURRENT tribeId (GroupLogic keeps it live as the season
// progresses -- a merge, a swap, a new pairing all update it), so once a league records a merge, this
// board reflects it on its own. Groups are ordered by TOTAL member count, most first: the merged
// tribe inherits everyone who survived to the merge from every original tribe, so it ends up the
// biggest one almost always -- this puts it on top without needing to know which tribe is "the
// merge" by name. (An earlier version sorted by CURRENT active members instead, which looked right
// mid-season but broke at the season's end: by the last episode nobody is "active" any more --
// even the winner's own status is "eliminated" once the season's done -- so every tribe tied at
// zero and the sort fell back to catalog order.)
//
// Within a group: still in the game first, then eliminated ordered by boot order descending (most
// recently eliminated first, working back toward the first boot) -- sort only, no visual
// sub-grouping by owner or anything else.
//
// Active Roster leagues additionally show a points badge and expand on click into a breakdown of
// what scored those points (CastawayStatCard); every other league type keeps plain cards.
export function BoardGrid({ state }: { state: LeagueState }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-browser preference, not app-wide like the Customize Overview panel -- everyone's own call on
  // whether they want to scroll past people who are already out. Defaults to showing everyone
  // (false) so nothing hides before this reads localStorage on mount.
  const [hideEliminated, setHideEliminated] = useState(false);
  const activeRoster = StateLogic.getLeagueType(state).hasActiveRoster;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHideEliminated(localStorage.getItem(HIDE_ELIMINATED_KEY) === "1");
    } catch {
      // localStorage unavailable (private window, blocked) -- just keep showing everyone.
    }
  }, []);

  function toggleHideEliminated() {
    const next = !hideEliminated;
    setHideEliminated(next);
    try {
      localStorage.setItem(HIDE_ELIMINATED_KEY, next ? "1" : "0");
    } catch {
      // Best-effort only -- worst case the toggle resets next visit.
    }
  }

  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes];
  const populated = groups
    .map((g) => ({ g, members: state.castaways.filter((c) => (c.tribeId || null) === g.id) }))
    .filter((x) => x.members.length > 0);
  const ordered = [...populated].sort((a, b) => b.members.length - a.members.length);

  return (
    <div id="board" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Board</h3>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={hideEliminated} onChange={toggleHideEliminated} />
          Hide eliminated
        </label>
      </div>
      <div className="flex flex-col gap-6">
        {ordered.map(({ g, members }) => {
          const visible = hideEliminated ? members.filter((c) => c.status !== "eliminated") : members;
          if (visible.length === 0) return null;
          const sorted = sortActiveFirstThenBootOrder(visible);
          return (
            <div key={g.id ?? "unassigned"}>
              {/* A show with no groups at all (The Traitors) puts everyone here -- no heading needed. */}
              {state.tribes.length > 0 && (
                <h3
                  className="mb-0 inline-block rounded-md px-[13px] py-1.5 text-[0.78rem] uppercase tracking-[1px] text-white"
                  style={{ background: g.color }}
                >
                  {g.name}
                </h3>
              )}
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(126px,1fr))] gap-3">
                {sorted.map((c) => {
                  // Shared-ownership leagues can have several owners per castaway, so this reads
                  // the whole list rather than just ownerIds[0]. The card's border colour still
                  // uses the first owner (a border can only be one colour), but every owner is
                  // named below it.
                  const owners = c.ownerIds
                    .map((id) => StateLogic.getPlayer(state, id))
                    .filter((p): p is NonNullable<typeof p> => !!p);
                  const formerOwner = owners.length === 0 && c.formerOwnerId ? StateLogic.getPlayer(state, c.formerOwnerId) : null;
                  return (
                    <CastawayStatCard
                      key={c.id}
                      state={state}
                      castaway={c}
                      owners={owners}
                      formerOwner={formerOwner ?? undefined}
                      showPoints={activeRoster}
                      showPlacementBadge={!activeRoster}
                      expanded={activeRoster && expandedId === c.id}
                      onToggleExpand={activeRoster ? () => setExpandedId((id) => (id === c.id ? null : c.id)) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Still in the game first, then eliminated by descending boot order (highest placementOrder --
// i.e. most recently gone -- first, working back toward the first boot). Active castaways among
// themselves sort alphabetically, just for a stable, predictable order.
function sortActiveFirstThenBootOrder(members: Castaway[]): Castaway[] {
  return [...members].sort((a, b) => {
    const aOut = a.status === "eliminated";
    const bOut = b.status === "eliminated";
    if (aOut !== bOut) return aOut ? 1 : -1;
    if (!aOut) return a.name.localeCompare(b.name);
    return (b.placementOrder ?? 0) - (a.placementOrder ?? 0);
  });
}
