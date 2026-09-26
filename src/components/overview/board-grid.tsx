"use client";

import { useState } from "react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEventStats } from "@/lib/game/active-roster-rows";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { useMyPlayerId } from "@/lib/store";

// Direct port of renderBoardGrid() (public/app.js) -- grouped by tribe, one card per castaway.
// Tribe grouping always reads the castaway's CURRENT tribeId (GroupLogic keeps it live as the season
// progresses -- a merge, a swap, a new pairing all update it), so once a league records a merge, this
// board reflects it on its own: everyone still in the game ends up under the merged tribe's heading,
// same as any other tribe. Active Roster leagues get a richer layout on top of that (see below); every
// other league type keeps the original: tribes in catalog order (Unassigned first), plain cards --
// CastawayStatCard just doesn't show a points badge or expand for them.
//
// Active Roster:
//   - Tribes/factions are ordered SMALLEST first (a small faction like The Traitors' own Traitors
//     surfaces at the top).
//   - Within a tribe, castaways are SORTED by owner (yours first, then the rest in draft order, free
//     agents last) and by the castaway's own points scored within that -- but not visually grouped
//     into per-owner sections; it's one flat grid per tribe, order only.
//   - Each card shows a points badge and expands on click into a breakdown of what scored those
//     points, one line per category (CastawayStatCard).
export function BoardGrid({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeRoster = StateLogic.getLeagueType(state).hasActiveRoster;

  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes];
  const populated = groups
    .map((g) => ({ g, members: state.castaways.filter((c) => (c.tribeId || null) === g.id) }))
    .filter((x) => x.members.length > 0);
  const ordered = activeRoster ? [...populated].sort((a, b) => a.members.length - b.members.length) : populated;

  return (
    <div className="flex flex-col gap-6">
      {ordered.map(({ g, members }) => {
        const sorted = activeRoster ? sortByOwnerThenPoints(state, members, myPlayerId) : members;
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
  );
}

// Sort only, no visual grouping: yours first, then every other player who owns someone here in the
// league's own player order, free agents (no owner at all) last -- each band sorted by the
// castaway's own points scored, highest first. A shared castaway with more than one owner sorts by
// its EARLIEST-ranked owner (typically yours, if you're one of them).
function sortByOwnerThenPoints(state: LeagueState, members: Castaway[], myPlayerId: string | null): Castaway[] {
  const ownerRank = new Map<string, number>();
  if (myPlayerId) ownerRank.set(myPlayerId, 0);
  state.players.forEach((p) => {
    if (!ownerRank.has(p.id)) ownerRank.set(p.id, ownerRank.size);
  });
  const rankOf = (c: Castaway) => {
    if (c.ownerIds.length === 0) return ownerRank.size; // free agents last
    return Math.min(...c.ownerIds.map((id) => ownerRank.get(id) ?? ownerRank.size));
  };
  return [...members].sort((a, b) => {
    const r = rankOf(a) - rankOf(b);
    if (r !== 0) return r;
    return castawayEventStats(state, b.id).total - castawayEventStats(state, a.id).total;
  });
}
