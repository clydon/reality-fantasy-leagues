"use client";

import { useState } from "react";
import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEventStats } from "@/lib/game/active-roster-rows";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { useMyPlayerId } from "@/lib/store";

// Direct port of renderBoardGrid() (public/app.js) -- grouped by tribe, one card per castaway.
// Active Roster leagues get a richer layout on top of that (see the file-level notes below); every
// other league type keeps the original: tribes in catalog order (Unassigned first), no owner
// subgrouping, plain cards -- CastawayStatCard just doesn't show a points badge or expand for them.
//
// Active Roster:
//   - Tribes/factions are ordered SMALLEST first (a small faction like The Traitors' own Traitors
//     surfaces at the top).
//   - Within a tribe, castaways are grouped by owner -- yours first, then the rest in draft order,
//     free agents last -- each group sorted by the castaway's own points scored, highest first.
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
        const sections = activeRoster ? ownerSections(state, members, myPlayerId) : [{ owner: null, members }];
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
            <div className={activeRoster ? "mt-3 flex flex-col gap-4" : "mt-3"}>
              {sections.map((section, i) => (
                <div key={section.owner?.id ?? `free-agents-${i}`}>
                  {activeRoster && (
                    <h4 className="mb-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
                      {section.owner ? (section.owner.id === myPlayerId ? `${section.owner.name} (you)` : section.owner.name) : "Free agents"}
                    </h4>
                  )}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(126px,1fr))] gap-3">
                    {section.members.map((c) => {
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
                          expanded={activeRoster && expandedId === c.id}
                          onToggleExpand={activeRoster ? () => setExpandedId((id) => (id === c.id ? null : c.id)) : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Splits one tribe's members into owner sections: yours first, then every other player who owns
// someone here in the league's own player order, free agents (no owner at all) last. A shared castaway
// with more than one owner appears in each of their sections -- it's genuinely on both rosters.
// Each section is sorted by the castaway's own points scored, highest first.
function ownerSections(
  state: LeagueState,
  members: Castaway[],
  myPlayerId: string | null
): { owner: Player | null; members: Castaway[] }[] {
  const byPlayerId = new Map<string, Castaway[]>();
  const unowned: Castaway[] = [];
  for (const c of members) {
    if (c.ownerIds.length === 0) {
      unowned.push(c);
      continue;
    }
    for (const pid of c.ownerIds) {
      if (!byPlayerId.has(pid)) byPlayerId.set(pid, []);
      byPlayerId.get(pid)!.push(c);
    }
  }
  const byPoints = (list: Castaway[]) =>
    [...list].sort((a, b) => castawayEventStats(state, b.id).total - castawayEventStats(state, a.id).total);
  const orderedPlayerIds = [
    ...(myPlayerId && byPlayerId.has(myPlayerId) ? [myPlayerId] : []),
    ...state.players.map((p) => p.id).filter((id) => id !== myPlayerId && byPlayerId.has(id)),
  ];
  const sections = orderedPlayerIds.map((pid) => ({
    owner: StateLogic.getPlayer(state, pid) ?? null,
    members: byPoints(byPlayerId.get(pid)!),
  }));
  if (unowned.length > 0) sections.push({ owner: null, members: byPoints(unowned) });
  return sections;
}
