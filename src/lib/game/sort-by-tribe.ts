import type { Castaway, LeagueState } from "./types";

// Shared by the Free Agents panel and the blind-draft picker: once tribes/factions are set, group
// castaways by faction (in the league's own tribe order, unassigned last) so the draft grid reads
// the same way the tribe-grouped board does; before that there's nothing to group by, so it's
// plain alphabetical.
export function sortByTribe(cast: Castaway[], state: LeagueState): Castaway[] {
  if (state.tribes.length === 0) return [...cast].sort((a, b) => a.name.localeCompare(b.name));
  const tribeOrder = new Map(state.tribes.map((t, i) => [t.id, i]));
  return [...cast].sort((a, b) => {
    const ta = a.tribeId ? (tribeOrder.get(a.tribeId) ?? tribeOrder.size) : tribeOrder.size;
    const tb = b.tribeId ? (tribeOrder.get(b.tribeId) ?? tribeOrder.size) : tribeOrder.size;
    return ta !== tb ? ta - tb : a.name.localeCompare(b.name);
  });
}

/** The same order, split into tribe groups (current tribes, so a revealed swap/merge shows). */
export function groupByTribe(cast: Castaway[], state: LeagueState): { tribe: LeagueState["tribes"][number] | null; members: Castaway[] }[] {
  const sorted = sortByTribe(cast, state);
  if (state.tribes.length === 0) return [{ tribe: null, members: sorted }];
  const groups: { tribe: LeagueState["tribes"][number] | null; members: Castaway[] }[] = [];
  for (const c of sorted) {
    const tribe = state.tribes.find((t) => t.id === c.tribeId) ?? null;
    const last = groups[groups.length - 1];
    if (last && last.tribe?.id === tribe?.id) last.members.push(c);
    else groups.push({ tribe, members: [c] });
  }
  return groups;
}
